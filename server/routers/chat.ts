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
import { invokeLLM } from "../_core/llm";
import { ENV } from "../_core/env";

export const chatRouter = router({
  listConversations: protectedProcedure.query(async ({ ctx }) => {
    return getConversationsByUser(ctx.user.id);
  }),

  createConversation: protectedProcedure
    .input(z.object({ title: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return createConversation({
        userId: ctx.user.id,
        title: input.title ?? "Neues Gespräch",
      });
    }),

  deleteConversation: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const conv = await getConversationById(input.id);
      if (!conv || conv.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await deleteConversation(input.id);
      return { success: true };
    }),

  getMessages: protectedProcedure
    .input(z.object({ conversationId: z.number() }))
    .query(async ({ ctx, input }) => {
      const conv = await getConversationById(input.conversationId);
      if (!conv || conv.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      return getMessagesByConversation(input.conversationId);
    }),

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

  transcribeAudio: protectedProcedure
    .input(z.object({ audioBase64: z.string(), mimeType: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.audioBase64, "base64");
      const key = `jarvis/${ctx.user.id}/audio/${Date.now()}.webm`;
      const { url } = await storagePut(key, buffer, input.mimeType ?? "audio/webm");
      const baseUrl = ENV.forgeApiUrl?.replace("/v1", "") ?? "";
      const fullUrl = `${baseUrl}${url}`;
      const result = await transcribeAudio({ audioUrl: fullUrl, language: "de" });
      if ("error" in result) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error });
      return { text: (result as WhisperResponse).text };
    }),

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

// ─── Streaming-Chat-Handler via Manus Forge LLM (SSE) ────────────────────────
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

    const systemPrompt = `Du bist Jarvis, ein hochintelligenter, freundlicher und äußerst kompetenter persönlicher KI-Assistent.
Du antwortest immer auf Deutsch, präzise, hilfreich und mit einem leicht professionellen Ton – ähnlich wie der Jarvis aus Iron Man.
Du kannst Dateien analysieren, Web-Suchergebnisse verarbeiten, Notizen und Aufgaben verwalten und bei allen Alltagsaufgaben helfen.
Heute ist der ${new Date().toLocaleDateString("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`;

    // Nachrichten-History aufbauen
    type LLMMessage = { role: "system" | "user" | "assistant"; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> };
    const llmMessages: LLMMessage[] = [
      { role: "system", content: systemPrompt },
      ...history.map((m) => ({
        role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
        content: m.content,
      })),
    ];

    // Aktuelle Nachricht aufbauen
    let userContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }> = message;

    if (searchResults && searchResults.length > 0) {
      const ctx = searchResults.map((r) => `**${r.title}**: ${r.snippet} (${r.url})`).join("\n");
      userContent = `${message}\n\n[Web-Suchergebnisse:\n${ctx}]`;
    }

    if (fileUrl && fileName) {
      const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
      const isImage = ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);
      const baseUrl = ENV.forgeApiUrl?.replace("/v1", "") ?? "";
      const absUrl = fileUrl.startsWith("http") ? fileUrl : `${baseUrl}${fileUrl}`;

      if (isImage) {
        userContent = [
          { type: "image_url", image_url: { url: absUrl } },
          { type: "text", text: typeof userContent === "string" ? userContent || `Analysiere dieses Bild: ${fileName}` : message },
        ];
      } else {
        // Text/PDF: Inhalt laden
        let fileContent = "";
        try {
          const fr = await fetch(absUrl);
          if (fr.ok) {
            fileContent = await fr.text();
            if (fileContent.length > 8000) fileContent = fileContent.slice(0, 8000) + "\n...[gekürzt]";
          }
        } catch { /* ignorieren */ }
        userContent = fileContent
          ? `${typeof userContent === "string" ? userContent : message}\n\n[Dateiinhalt von ${fileName}:\n\`\`\`\n${fileContent}\n\`\`\`]`
          : `${typeof userContent === "string" ? userContent : message}\n\n[Datei: ${fileName}]`;
      }
    }

    llmMessages.push({ role: "user", content: userContent as string });

    // SSE-Header setzen
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    let finished = false;
    res.on("close", () => { finished = true; });

    // Streaming via Forge API (OpenAI-kompatibel)
    const forgeUrl = `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`;
    const streamResp = await fetch(forgeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ENV.forgeApiKey}`,
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        messages: llmMessages,
        max_tokens: 4096,
        stream: true,
      }),
    });

    if (!streamResp.ok || !streamResp.body) {
      const errText = await streamResp.text();
      throw new Error(`LLM Fehler: ${streamResp.status} ${errText}`);
    }

    const reader = streamResp.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";

    while (true) {
      if (finished) break;
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          const text = parsed.choices?.[0]?.delta?.content ?? "";
          if (text) {
            fullResponse += text;
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
          }
        } catch { /* ignorieren */ }
      }
    }

    if (!finished) {
      // Antwort in DB speichern
      await addMessage({ conversationId, role: "assistant", content: fullResponse });

      // Gesprächstitel generieren (nur beim ersten Austausch)
      if (history.length === 0) {
        try {
          const titleRes = await invokeLLM({
            model: "claude-haiku-4-5",
            max_tokens: 30,
            messages: [{ role: "user", content: `Erstelle einen kurzen Gesprächstitel (max. 5 Wörter, kein Punkt am Ende) für diese Frage: "${message}"` }],
          });
          const title = titleRes.choices[0]?.message?.content;
          const titleText = typeof title === "string" ? title.trim() : message.slice(0, 40);
          await updateConversationTitle(conversationId, titleText);
        } catch { /* Titel-Generierung ist optional */ }
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
