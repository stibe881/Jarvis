import Anthropic from "@anthropic-ai/sdk";
import type {
  InvokeParams,
  InvokeResult,
  Message,
  MessageContent,
} from "./llm";

/**
 * Direkte Anbindung an die Anthropic Messages API – Ersatz für den früheren
 * Manus/Forge-Proxy. Übersetzt die OpenAI-artigen Nachrichten der App in das
 * Anthropic-Format und gibt das gewohnte `{ choices: [{ message }] }`-Format
 * zurück, damit alle Aufrufer unverändert bleiben.
 *
 * Aktiv, sobald `ANTHROPIC_API_KEY` gesetzt ist (siehe invokeLLM in llm.ts).
 */

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY ist nicht konfiguriert");
    client = new Anthropic({ apiKey });
  }
  return client;
}

/** Ist die direkte Anthropic-Anbindung aktiv? */
export function anthropicEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

type AnthropicBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "url"; url: string } };

/** Wandelt einen einzelnen Inhaltsteil in einen Anthropic-Block. */
function toBlock(part: MessageContent): AnthropicBlock | null {
  if (typeof part === "string") {
    return part ? { type: "text", text: part } : null;
  }
  if (part.type === "text") {
    return part.text ? { type: "text", text: part.text } : null;
  }
  if (part.type === "image_url") {
    return { type: "image", source: { type: "url", url: part.image_url.url } };
  }
  // file_url u.ä. werden nicht unterstützt und übersprungen.
  return null;
}

/** Baut den Inhalt einer Nachricht (String, einzelner Teil oder Array) für Anthropic. */
function toContent(content: Message["content"]): string | AnthropicBlock[] {
  if (typeof content === "string") return content;
  const parts: MessageContent[] = Array.isArray(content) ? content : [content];
  const blocks = parts
    .map(toBlock)
    .filter((b): b is AnthropicBlock => b !== null);
  return blocks.length > 0 ? blocks : "";
}

export async function invokeViaAnthropic(
  params: InvokeParams
): Promise<InvokeResult> {
  const model = params.model ?? "claude-sonnet-4-5";
  const maxTokens = params.max_tokens ?? params.maxTokens ?? 4096;

  // System-Nachrichten einsammeln; sie werden bei Anthropic als eigenes Feld
  // übergeben, nicht als Nachricht.
  const systemParts: string[] = [];
  const messages: Array<{
    role: "user" | "assistant";
    content: string | AnthropicBlock[];
  }> = [];

  for (const m of params.messages) {
    if (m.role === "system") {
      const c = m.content;
      systemParts.push(typeof c === "string" ? c : JSON.stringify(c));
      continue;
    }
    const role = m.role === "assistant" ? "assistant" : "user";
    messages.push({ role, content: toContent(m.content) });
  }

  // Anthropic verlangt, dass die erste Nachricht eine User-Nachricht ist.
  if (messages.length === 0 || messages[0].role !== "user") {
    messages.unshift({ role: "user", content: "." });
  }

  if (params.onStream) {
    const stream = await getClient().messages.create({
      model,
      max_tokens: maxTokens,
      ...(systemParts.length > 0 ? { system: systemParts.join("\n\n") } : {}),
      messages: messages as any,
      stream: true,
    });

    let fullText = "";
    for await (const chunk of stream) {
      if (
        chunk.type === "content_block_delta" &&
        chunk.delta.type === "text_delta"
      ) {
        fullText += chunk.delta.text;
        params.onStream(chunk.delta.text);
      }
    }

    return {
      id: "stream-id",
      created: Math.floor(Date.now() / 1000),
      model: model,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: fullText },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };
  }

  const resp = await getClient().messages.create({
    model,
    max_tokens: maxTokens,
    ...(systemParts.length > 0 ? { system: systemParts.join("\n\n") } : {}),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: messages as any,
  });

  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map(b => b.text)
    .join("");

  return {
    id: resp.id,
    created: Math.floor(Date.now() / 1000),
    model: resp.model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: text },
        finish_reason: resp.stop_reason ?? "stop",
      },
    ],
    usage: {
      prompt_tokens: resp.usage.input_tokens,
      completion_tokens: resp.usage.output_tokens,
      total_tokens: resp.usage.input_tokens + resp.usage.output_tokens,
    },
  };
}
