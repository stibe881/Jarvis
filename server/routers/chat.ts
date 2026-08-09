import Anthropic from "@anthropic-ai/sdk";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  addMessage,
  createConversation,
  deleteConversation,
  getConversationById,
  getConversationsByUser,
  getMessagesByConversation,
  updateConversationTitle,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import { transcribeAudio, type WhisperResponse } from "../_core/voiceTranscription";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const chatRouter = router({
  // Gespräche abrufen
  listConversations: protectedProcedure.query(async ({ ctx }) => {
    return getConversationsByUser(ctx.user.id);
  }),

  // Neues Gespräch erstellen
  createConversation: protectedProcedure
    .input(z.object({ title: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const result = await createConversation({
        userId: ctx.user.id,
        title: input.title ?? "Neues Gespräch",
      });
      return result;
    }),

  // Gespräch löschen
  deleteConversation: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const conv = await getConversationById(input.id);
      if (!conv || conv.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await deleteConversation(input.id);
      return { success: true };
    }),

  // Nachrichten eines Gesprächs abrufen
  getMessages: protectedProcedure
    .input(z.object({ conversationId: z.number() }))
    .query(async ({ ctx, input }) => {
      const conv = await getConversationById(input.conversationId);
      if (!conv || conv.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      return getMessagesByConversation(input.conversationId);
    }),

  // Datei hochladen für Chat-Analyse
  uploadFile: protectedProcedure
    .input(z.object({
      fileName: z.string(),
      fileBase64: z.string(),
      mimeType: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.fileBase64, "base64");
      const key = `jarvis/${ctx.user.id}/files/${Date.now()}-${input.fileName}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      return { url, key, fileName: input.fileName, mimeType: input.mimeType };
    }),

  // Spracheingabe transkribieren
  transcribeAudio: protectedProcedure
    .input(z.object({ audioBase64: z.string(), mimeType: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.audioBase64, "base64");
      const key = `jarvis/${ctx.user.id}/audio/${Date.now()}.webm`;
      const { url } = await storagePut(key, buffer, input.mimeType ?? "audio/webm");
      const fullUrl = `${process.env.BUILT_IN_FORGE_API_URL?.replace("/v1", "") ?? ""}${url}`;
      const result = await transcribeAudio({ audioUrl: fullUrl, language: "de" });
      if ("error" in result) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error });
      return { text: (result as WhisperResponse).text };
    }),

  // Web-Suche
  webSearch: protectedProcedure
    .input(z.object({ query: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const response = await fetch(
          `https://api.duckduckgo.com/?q=${encodeURIComponent(input.query)}&format=json&no_html=1&skip_disambig=1`
        );
        const data = await response.json() as {
          AbstractText?: string;
          AbstractURL?: string;
          RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
        };
        const results: Array<{ title: string; url: string; snippet: string }> = [];
        if (data.AbstractText) {
          results.push({ title: "Zusammenfassung", url: data.AbstractURL ?? "", snippet: data.AbstractText });
        }
        if (data.RelatedTopics) {
          for (const topic of data.RelatedTopics.slice(0, 5)) {
            if (topic.Text && topic.FirstURL) {
              results.push({ title: topic.Text.slice(0, 80), url: topic.FirstURL, snippet: topic.Text });
            }
          }
        }
        return { results, query: input.query };
      } catch {
        return { results: [], query: input.query };
      }
    }),
});

// Streaming-Chat-Handler (Express-Route, kein tRPC wegen SSE)
import type { Request, Response } from "express";

export async function handleChatStream(req: Request, res: Response) {
  try {
    const { conversationId, message, fileUrl, fileName, searchResults } = req.body as {
      conversationId: number;
      message: string;
      fileUrl?: string;
      fileName?: string;
      searchResults?: Array<{ title: string; snippet: string; url: string }>;
    };

    // Nachrichten aus DB laden
    // Sicherheitsprüfung: Gespräch muss dem Nutzer gehören
    const userId = (req as Request & { user?: { id: number } }).user?.id;
    const conv = await getConversationById(conversationId);
    if (!conv || conv.userId !== userId) {
      res.status(403).json({ error: "Zugriff verweigert" });
      return;
    }

    const history = await getMessagesByConversation(conversationId);

    // Benutzer-Nachricht speichern
    await addMessage({
      conversationId,
      role: "user",
      content: message,
      fileUrl: fileUrl ?? null,
      fileName: fileName ?? null,
    });

    // Kontext aufbauen
    const systemPrompt = `Du bist Jarvis, ein hochintelligenter, freundlicher und äußerst kompetenter persönlicher KI-Assistent. 
Du antwortest immer auf Deutsch, präzise, hilfreich und mit einem leicht professionellen Ton – ähnlich wie der Jarvis aus Iron Man.
Du kannst Dateien analysieren, Web-Suchergebnisse verarbeiten, Notizen und Aufgaben verwalten und bei allen Alltagsaufgaben helfen.
Heute ist der ${new Date().toLocaleDateString("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`;

    const anthropicMessages: Anthropic.MessageParam[] = history.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

    // Aktuelle Nachricht mit optionalem Kontext
    let userContent = message;
    if (searchResults && searchResults.length > 0) {
      const searchContext = searchResults.map((r) => `**${r.title}**: ${r.snippet} (${r.url})`).join("\n");
      userContent = `${message}\n\n[Web-Suchergebnisse für Kontext:\n${searchContext}]`;
    }
    if (fileUrl && fileName) {
      userContent = `${userContent}\n\n[Datei hochgeladen: ${fileName} – bitte analysiere diese Datei]`;
    }

    anthropicMessages.push({ role: "user", content: userContent });

    // SSE-Header setzen
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    let fullResponse = "";
    let finished = false;

    res.on("close", () => { finished = true; });

    const stream = await anthropic.messages.stream({
      model: "claude-opus-4-5",
      max_tokens: 4096,
      system: systemPrompt,
      messages: anthropicMessages,
    });

    for await (const chunk of stream) {
      if (finished) break;
      if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
        const text = chunk.delta.text;
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    if (!finished) {
      // Antwort in DB speichern
      await addMessage({ conversationId, role: "assistant", content: fullResponse });

      // Gesprächstitel automatisch generieren (nur beim ersten Austausch)
      if (history.length === 0) {
        const titleRes = await anthropic.messages.create({
          model: "claude-haiku-4-5",
          max_tokens: 30,
          messages: [{ role: "user", content: `Erstelle einen kurzen Gesprächstitel (max. 5 Wörter) für diese Frage: "${message}"` }],
        });
        const title = titleRes.content[0]?.type === "text" ? titleRes.content[0].text.trim() : message.slice(0, 40);
        await updateConversationTitle(conversationId, title);
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    }
  } catch (err) {
    console.error("[Chat Stream Error]", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Fehler beim Chat" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Fehler beim Generieren der Antwort" })}\n\n`);
      res.end();
    }
  }
}
