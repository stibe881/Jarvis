import type { Request, Response } from "express";
import { createContext } from "../_core/context";
import { ENV } from "../_core/env";
import { invokeLLM } from "../_core/llm";
import {
  addMessage,
  createConversation,
  getConversationById,
  getMessagesByConversation,
  updateConversationTitle,
} from "../db";
import { runAgentLoop, formatStepLog, executeAction } from "../agent";
import type { LoopMessage } from "../agent";
import { jarvisTools } from "../_core/tools";
import { executeCalendarAction } from "../_core/calendarAI";
import { buildChatSystemPrompt } from "./chat";
import { fetchWithTimeout } from "../_core/http";
import { rememberPending } from "../pendingApproval";
import { removeInternalTags } from "../cleanResponse";

export async function handleChatStream(req: Request, res: Response) {
  const ctx = await createContext({ req, res } as any);
  if (!ctx.user) {
    return res.status(401).json({ error: "Nicht authentifiziert" });
  }

  const {
    message,
    conversationId: reqConversationId,
    searchResults,
    fileUrl,
    fileName,
    approved,
    context,
  } = req.body;

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Nachricht fehlt" });
  }

  // SSE Header setzen
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const userId = ctx.user.id;
    let conversationId = reqConversationId;
    let history: { role: string; content: string }[] = [];

    if (conversationId) {
      const conv = await getConversationById(conversationId);
      if (!conv) {
        return res.status(404).json({ error: "Konversation nicht gefunden" });
      }
      history = await getMessagesByConversation(conversationId);
    } else {
      const newConv = await createConversation({
        userId,
        title: message.slice(0, 40),
      });
      conversationId = newConv.id;
    }

    await addMessage({
      conversationId,
      role: "user",
      content: message,
    });

    let systemPrompt = await buildChatSystemPrompt(userId, message);

    if (context) {
      const parts = [];
      if (context.location) {
        parts.push(
          `- GPS: Breitengrad ${context.location.lat}, Längengrad ${context.location.lng}`
        );
      }
      if (context.battery) {
        parts.push(`- Batteriestatus: ${context.battery}`);
      }
      if (parts.length > 0) {
        systemPrompt += `\n\nGERÄTE-KONTEXT (Smartphone/Browser des Nutzers):\n${parts.join("\n")}`;
      }
    }

    let userContent: any = message;
    if (searchResults && searchResults.length > 0) {
      const ctxStr = searchResults
        .map((r: any) => `**${r.title}**: ${r.snippet} (${r.url})`)
        .join("\n");
      userContent = `${message}\n\n[Web-Suchergebnisse:\n${ctxStr}]`;
    }
    if (fileUrl && fileName) {
      const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
      const isImage = ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);
      const baseUrl = ENV.forgeApiUrl?.replace("/v1", "") ?? "";
      const absUrl = fileUrl.startsWith("http")
        ? fileUrl
        : `${baseUrl}${fileUrl}`;
      if (isImage) {
        userContent = [
          { type: "image_url", image_url: { url: absUrl } },
          {
            type: "text",
            text:
              typeof userContent === "string"
                ? userContent || `Analysiere dieses Bild: ${fileName}`
                : message,
          },
        ];
      } else {
        let fileContent = "";
        try {
          const fr = await fetchWithTimeout(absUrl);
          if (fr.ok) {
            fileContent = await fr.text();
            if (fileContent.length > 8000)
              fileContent = fileContent.slice(0, 8000) + "\n...[gekürzt]";
          }
        } catch {}
        userContent = fileContent
          ? `${typeof userContent === "string" ? userContent : message}\n\n[Dateiinhalt von ${fileName}:\n\`\`\`\n${fileContent}\n\`\`\`]`
          : `${typeof userContent === "string" ? userContent : message}\n\n[Datei: ${fileName}]`;
      }
    }

    const llmMessages: LoopMessage[] = [
      { role: "system", content: systemPrompt },
      ...history.map(m => ({
        role: (m.role === "assistant" ? "assistant" : "user") as
          | "user"
          | "assistant",
        content: m.content,
      })),
      { role: "user", content: userContent },
    ];

    // Erste Antwort mit Streaming
    const onStream = (chunk: string) => sendEvent("text", { chunk });
    const onStep = (step: any) => sendEvent("step", step);

    const firstResp = await invokeLLM({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      messages: llmMessages as any,
      
      onStream,
    });

    const msgContent = firstResp.choices[0]?.message;
    const fullResponse = {
      text: typeof msgContent?.content === "string" ? msgContent.content : "",
      tool_calls: msgContent?.tool_calls,
    };

    // Agenten-Schleife
    const loopFb = await runAgentLoop({
      firstResponse: fullResponse,
      messages: llmMessages,
      approved: Boolean(approved),
      onStream,
      onStep,
      runAction: async parsed => {
        return executeAction(
          { userId, runCalendar: executeCalendarAction },
          parsed
        );
      },
      callModel: async (msgs, streamCb) => {
        const next = await invokeLLM({
          model: "claude-sonnet-4-5",
          max_tokens: 4096,
          messages: msgs as any,
          
          onStream: streamCb,
        });
        const msg = next.choices[0]?.message;
        return {
          text: typeof msg?.content === "string" ? msg.content : "",
          tool_calls: msg?.tool_calls,
        };
      },
    });

    const cleanResponse =
      removeInternalTags(loopFb.text) + formatStepLog(loopFb.steps);
    rememberPending(conversationId, loopFb.pending);

    await addMessage({
      conversationId,
      role: "assistant",
      content: cleanResponse,
    });

    if (history.length <= 1) {
      try {
        const titleRes = await invokeLLM({
          model: "claude-haiku-4-5",
          max_tokens: 30,
          messages: [
            {
              role: "user",
              content: `Erstelle einen kurzen Gesprächstitel (max. 5 Wörter, kein Punkt am Ende) für diese Frage: "${message}"`,
            },
          ],
        });
        const title = titleRes.choices[0]?.message?.content;
        await updateConversationTitle(
          conversationId,
          typeof title === "string" ? title.trim() : message.slice(0, 40)
        );
      } catch {
        /* ignorieren */
      }
    }

    sendEvent("done", { conversationId, response: cleanResponse });
    res.end();
  } catch (err: any) {
    console.error("Stream error:", err);
    sendEvent("error", { message: err.message });
    res.end();
  }
}
