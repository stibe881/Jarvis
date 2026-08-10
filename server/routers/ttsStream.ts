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
    // GET erlaubt die Wiedergabe direkt über `audio.src` – nur so kann der
    // Browser abspielen, während die Daten noch eintreffen. Bei POST müsste der
    // Client die Antwort erst vollständig einlesen.
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

    // Verbindlich ist der Kontostand bei ElevenLabs. Der lokale Zähler dient
    // nur als Rückfall, wenn der Dienst nicht erreichbar ist.
    const live = await fetchLiveQuota();
    const localUsed = await getTtsUsage(userId, currentYearMonth());
    const state = live ?? budgetState(localUsed);
    if (state.remaining <= 0) {
      res.status(429).json({
        error: "Sprachausgabe-Guthaben aufgebraucht",
        remaining: 0,
        resetAt: live?.resetAt ?? null,
      });
      return;
    }

    // Reine Vorabprüfung: der Client will nur wissen, ob Guthaben da ist.
    // So vermeidet er, das Audio-Element auf eine Fehlerseite zu richten.
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

    const voiceId = body.voiceId || JARVIS_VOICE_ID;
    const url = new URL(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`
    );
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
        // Höhere Stabilität und kein Stil-Anteil: ElevenLabs variiert damit die
        // Betonung weniger stark, wodurch aufeinanderfolgende Antworten
        // gleichmässiger laut klingen. `use_speaker_boost` bleibt aus, weil es
        // die Lautheit je nach Aufnahme unterschiedlich stark anhebt.
        voice_settings: {
          stability: 0.75,
          similarity_boost: 0.8,
          style: 0,
          use_speaker_boost: false,
        },
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text().catch(() => "");
      console.error("[TTS-Stream]", upstream.status, errText.slice(0, 300));
      // ElevenLabs meldet ein erschöpftes Guthaben als 401 mit quota_exceeded
      if (errText.includes("quota_exceeded")) {
        invalidateQuotaCache();
        res.status(429).json({ error: "Sprachausgabe-Guthaben aufgebraucht" });
        return;
      }
      res
        .status(502)
        .json({ error: `Sprachausgabe fehlgeschlagen (${upstream.status})` });
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
    if (!res.headersSent)
      res.status(500).json({ error: "Sprachausgabe fehlgeschlagen" });
    else res.end();
  }
}
