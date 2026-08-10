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
import { budgetState, currentYearMonth, shortenForSpeech, MAX_CHARS_PER_SPEECH } from "../ttsBudget";

const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY ?? "";
const JARVIS_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";

export async function handleTtsStream(req: Request, res: Response, userId: number) {
  try {
    // GET erlaubt die Wiedergabe direkt über `audio.src` – nur so kann der
    // Browser abspielen, während die Daten noch eintreffen. Bei POST müsste der
    // Client die Antwort erst vollständig einlesen.
    const src = req.method === "GET" ? (req.query ?? {}) : (req.body ?? {});
    const body = src as { text?: string; voiceId?: string; shorten?: boolean | string };
    const rawText = (body.text ?? "").trim();
    if (!rawText) {
      res.status(400).json({ error: "Kein Text übergeben" });
      return;
    }

    // Budget prüfen
    const used = await getTtsUsage(userId, currentYearMonth());
    const state = budgetState(used);
    if (state.remaining <= 0) {
      res.status(429).json({ error: "Monatliches Sprachausgabe-Budget aufgebraucht" });
      return;
    }

    const shorten = body.shorten !== false && body.shorten !== "false";
    const limit = Math.min(shorten ? MAX_CHARS_PER_SPEECH : 2500, state.remaining);
    const { spoken } = shorten
      ? shortenForSpeech(rawText, limit)
      : { spoken: rawText.slice(0, limit) };
    if (!spoken) {
      res.status(400).json({ error: "Kein sprechbarer Text vorhanden" });
      return;
    }

    const voiceId = body.voiceId || JARVIS_VOICE_ID;
    const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`);
    // Höchste Latenz-Optimierung und kleines Format: schnellster erster Ton.
    // Gemessen: Flash-Modell ~1,8 s bis zum ersten Audiopaket,
    // Turbo ~4,0 s, multilingual (komplette Datei) ~4,2 s.
    url.searchParams.set("optimize_streaming_latency", "4");
    url.searchParams.set("output_format", "mp3_22050_32");

    const upstream = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: spoken,
        model_id: "eleven_flash_v2_5",
        voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true },
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text().catch(() => "");
      console.error("[TTS-Stream]", upstream.status, errText.slice(0, 300));
      res.status(502).json({ error: `Sprachausgabe fehlgeschlagen (${upstream.status})` });
      return;
    }

    // Verbrauch sofort buchen (der Text steht bereits fest)
    const total = await addTtsUsage(userId, currentYearMonth(), spoken.length);
    const usage = budgetState(total);

    res.status(200);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    // Nutzungsdaten als Kopfzeilen mitgeben, damit die Anzeige aktuell bleibt
    res.setHeader("X-Tts-Chars-Used", String(usage.charsUsed));
    res.setHeader("X-Tts-Remaining", String(usage.remaining));
    res.setHeader("X-Tts-Level", usage.level);
    res.setHeader("X-Tts-Percent", String(usage.percentUsed));
    res.setHeader("X-Tts-Limit", String(usage.limit));

    // Datenstrom unverändert durchleiten
    const reader = upstream.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) res.write(Buffer.from(value));
    }
    res.end();
  } catch (e) {
    console.error("[TTS-Stream] Fehler:", e);
    if (!res.headersSent) res.status(500).json({ error: "Sprachausgabe fehlgeschlagen" });
    else res.end();
  }
}
