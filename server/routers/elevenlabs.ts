/**
 * ElevenLabs Integration für Jarvis
 * TTS: Text-to-Speech mit Jarvis-Stimme (George – britisch, warm)
 * STT: Speech-to-Text mit Whisper (Schweizerdeutsch-kompatibel)
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { addTtsUsage, getTtsUsage } from "../db";
import {
  MONTHLY_CHAR_LIMIT, MAX_CHARS_PER_SPEECH,
  budgetState, currentYearMonth, shortenForSpeech,
} from "../ttsBudget";
import { fetchLiveQuota, invalidateQuotaCache } from "../ttsQuota";

const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY ?? "";
// George – Warm, Captivating Storyteller (britisch, männlich, reif) – am nächsten an Iron Man Jarvis
const JARVIS_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";

// ── TTS: Text → Audio (MP3 als Base64) ───────────────────────────────────────
export const elevenLabsRouter = router({
  tts: protectedProcedure
    .input(z.object({
      text: z.string().min(1).max(2500),
      voiceId: z.string().optional(),
      /** false = vollständigen Text sprechen (z.B. Stimmen-Vorschau) */
      shorten: z.boolean().default(true),
      /** true = schnelles Turbo-Modell (kürzere Wartezeit bis zum ersten Ton) */
      fast: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const voiceId = input.voiceId ?? JARVIS_VOICE_ID;

      // Verbindlich ist der Kontostand bei ElevenLabs (der lokale Zähler kennt
      // nur den Verbrauch über diese App).
      const live = await fetchLiveQuota();
      const used = await getTtsUsage(ctx.user.id, currentYearMonth());
      const state = live ?? budgetState(used);
      if (state.remaining <= 0) {
        throw new Error(
          "QUOTA_EXHAUSTED: Das Sprachausgabe-Guthaben ist aufgebraucht. " +
          "Jarvis wechselt auf die Browser-Stimme, die Antworten erscheinen weiterhin im Chat."
        );
      }

      // Kurzfassung sprechen, damit das Budget für viele Antworten reicht
      const limit = Math.min(input.shorten ? MAX_CHARS_PER_SPEECH : 2500, state.remaining);
      const { spoken, truncated } = input.shorten
        ? shortenForSpeech(input.text, limit)
        : { spoken: input.text.slice(0, limit), truncated: input.text.length > limit };
      if (!spoken) throw new Error("Kein sprechbarer Text vorhanden.");

      const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_KEY,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg",
        },
        body: JSON.stringify({
          text: spoken,
          // Gleiches Modell und gleiche Einstellungen wie im Stream-Weg
          // (server/routers/ttsStream.ts). Sonst klingt Jarvis je nach
          // genutztem Weg unterschiedlich laut.
          model_id: "eleven_flash_v2_5",
          voice_settings: {
            // Höhere Stabilität, kein Stil-Anteil und kein Speaker-Boost:
            // ElevenLabs variiert damit Betonung und Lautheit weniger stark
            stability: 0.75,
            similarity_boost: 0.8,
            style: 0,
            use_speaker_boost: false,
          },
        }),
      });

      if (!resp.ok) {
        const err = await resp.text();
        if (err.includes("quota_exceeded")) {
          invalidateQuotaCache();
          throw new Error(
            "QUOTA_EXHAUSTED: Das Sprachausgabe-Guthaben ist aufgebraucht. " +
            "Jarvis wechselt auf die Browser-Stimme."
          );
        }
        throw new Error(`ElevenLabs TTS Fehler: ${resp.status} – ${err}`);
      }

      const arrayBuffer = await resp.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      // Verbrauch buchen
      const total = await addTtsUsage(ctx.user.id, currentYearMonth(), spoken.length);
      return {
        audio: base64,
        mimeType: "audio/mpeg",
        spokenText: spoken,
        truncated,
        usage: budgetState(total),
      };
    }),

  /** Aktueller Zeichenverbrauch des Monats */
  usage: protectedProcedure.query(async ({ ctx }) => {
    const live = await fetchLiveQuota();
    const used = await getTtsUsage(ctx.user.id, currentYearMonth());
    if (live) {
      return {
        ...live,
        yearMonth: currentYearMonth(),
        monthlyLimit: live.limit,
        localCharsUsed: used,
      };
    }
    return {
      ...budgetState(used),
      yearMonth: currentYearMonth(),
      monthlyLimit: MONTHLY_CHAR_LIMIT,
      resetAt: null,
      tier: "unbekannt",
      live: false,
      localCharsUsed: used,
    };
  }),

  // ── Verfügbare Stimmen auflisten ──────────────────────────────────────────
  voices: protectedProcedure.query(async () => {
    const resp = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": ELEVENLABS_KEY },
    });
    if (!resp.ok) throw new Error("Stimmen konnten nicht abgerufen werden");
    const data = await resp.json() as { voices: Array<{ voice_id: string; name: string; labels?: Record<string, string> }> };
    return data.voices.map(v => ({
      id: v.voice_id,
      name: v.name,
      gender: v.labels?.gender ?? "unknown",
      accent: v.labels?.accent ?? "unknown",
      useCase: v.labels?.use_case ?? "general",
    }));
  }),

  // ── STT: Audio → Text via ElevenLabs Speech-to-Text ──────────────────────
  stt: protectedProcedure
    .input(z.object({
      audioBase64: z.string(),
      mimeType: z.string().default("audio/webm"),
      language: z.string().default("de"), // de für Deutsch/Schweizerdeutsch
    }))
    .mutation(async ({ input }) => {
      const audioBuffer = Buffer.from(input.audioBase64, "base64");
      const blob = new Blob([audioBuffer], { type: input.mimeType });

      const formData = new FormData();
      formData.append("file", blob, `audio.${input.mimeType.split("/")[1] ?? "webm"}`);
      formData.append("model_id", "scribe_v1"); // ElevenLabs Scribe – beste Qualität
      formData.append("language_code", input.language === "de" ? "deu" : input.language);

      const resp = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
        method: "POST",
        headers: { "xi-api-key": ELEVENLABS_KEY },
        body: formData,
      });

      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`ElevenLabs STT Fehler: ${resp.status} – ${err}`);
      }

      const result = await resp.json() as { text?: string; words?: Array<{ text: string }> };
      return { text: result.text ?? result.words?.map(w => w.text).join(" ") ?? "" };
    }),
});
