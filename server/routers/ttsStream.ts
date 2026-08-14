/**
 * Gestreamte Sprachausgabe.
 *
 * Ausgangslage: Die tRPC-Mutation erzeugt zuerst die komplette MP3-Datei,
 * kodiert sie als Base64 und schickt sie dann als Ganzes. Gemessen dauerte das
 * rund 3,6 bis 4,2 Sekunden – die Sprachausgabe setzte darum deutlich später
 * ein als der geschriebene Text.
 *
 * Diese Express-Route leitet den Audiostrom von ElevenLabs unverändert an den
 * Browser weiter. Das Audio-Element beginnt dadurch schon zu spielen, während
 * der Rest noch übertragen wird.
 */

import type { Request, Response } from "express";
import { addTtsUsage, getTtsUsage } from "../db";
import {
  budgetState,
  currentYearMonth,
  shortenForSpeech,
  MAX_CHARS_PER_SPEECH,
} from "../ttsBudget";
import { fetchLiveQuota, invalidateQuotaCache } from "../ttsQuota";

const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY ?? "";
const JARVIS_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";

export async function handleTtsStream(
  req: Request,
  res: Response,
  userId: number
) {
  try {
    const src = req.method === "GET" ? (req.query ?? {}) : (req.body ?? {});
    const body = src as {
      text?: string;
      voiceId?: string;
      shorten?: boolean | string;
      checkOnly?: boolean | string;
    };
    const rawText = (body.text ?? "").trim();
    if (!rawText) {
      res.status(400).json({ error: "Kein Text übergeben" });
      return;
    }

    const openAiKey = process.env.OPENAI_API_KEY ?? "";
    const useOpenAI = Boolean(openAiKey);

    // Wenn OpenAI aktiv ist, ignorieren wir die ElevenLabs-Quotas.
    let state = {
      remaining: 9999999,
      limit: 9999999,
      percentUsed: 0,
      charsUsed: 0,
      level: "green",
    };
    let live = null;

    if (!useOpenAI) {
      live = await fetchLiveQuota();
      const localUsed = await getTtsUsage(userId, currentYearMonth());
      state = live ?? budgetState(localUsed);
      if (state.remaining <= 0) {
        res.status(429).json({
          error: "Sprachausgabe-Guthaben aufgebraucht",
          remaining: 0,
          resetAt: live?.resetAt ?? null,
        });
        return;
      }
    }

    if (body.checkOnly === true || body.checkOnly === "true") {
      res.status(200).json({
        ok: true,
        remaining: state.remaining,
        resetAt: live?.resetAt ?? null,
      });
      return;
    }

    const shorten = body.shorten !== false && body.shorten !== "false";
    const limit = Math.min(
      shorten ? MAX_CHARS_PER_SPEECH : 2500,
      state.remaining
    );
    const { spoken } = shorten
      ? shortenForSpeech(rawText, limit)
      : { spoken: rawText.slice(0, limit) };
    if (!spoken) {
      res.status(400).json({ error: "Kein sprechbarer Text vorhanden" });
      return;
    }

    let upstream: globalThis.Response;

    if (useOpenAI) {
      // OpenAI TTS
      upstream = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1",
          input: spoken,
          voice: "onyx",
          response_format: "mp3",
        }),
      });
    } else {
      // ElevenLabs TTS
      const voiceId = body.voiceId || JARVIS_VOICE_ID;
      const url = new URL(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`
      );
      url.searchParams.set("optimize_streaming_latency", "4");
      url.searchParams.set("output_format", "mp3_22050_32");

      upstream = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_KEY,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: spoken,
          model_id: "eleven_flash_v2_5",
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.8,
            style: 0,
            use_speaker_boost: false,
          },
        }),
      });
    }

    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text().catch(() => "");
      console.error("[TTS-Stream]", upstream.status, errText.slice(0, 300));
      if (!useOpenAI && errText.includes("quota_exceeded")) {
        invalidateQuotaCache();
        res.status(429).json({ error: "Sprachausgabe-Guthaben aufgebraucht" });
        return;
      }
      let errorMessage = `Sprachausgabe fehlgeschlagen (${upstream.status})`;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.error && parsed.error.message) {
          errorMessage = `OpenAI API Fehler: ${parsed.error.message}`;
        }
      } catch (e) {
        // Fallback wenn es kein JSON ist
      }
      res
        .status(502)
        .json({ error: errorMessage, details: errText.slice(0, 500) });
      return;
    }

    const total = await addTtsUsage(userId, currentYearMonth(), spoken.length);
    const usage = useOpenAI ? state : budgetState(total);

    res.status(200);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Tts-Chars-Used", String(usage.charsUsed));
    res.setHeader("X-Tts-Remaining", String(usage.remaining));
    res.setHeader("X-Tts-Level", usage.level);
    res.setHeader("X-Tts-Percent", String(usage.percentUsed));
    res.setHeader("X-Tts-Limit", String(usage.limit));

    const reader = upstream.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) res.write(Buffer.from(value));
    }
    res.end();
  } catch (e) {
    console.error("[TTS-Stream] Fehler:", e);
    if (!res.headersSent)
      res.status(500).json({ error: "Sprachausgabe fehlgeschlagen" });
    else res.end();
  }
}
