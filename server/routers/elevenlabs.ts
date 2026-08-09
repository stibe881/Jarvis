/**
 * ElevenLabs Integration für Jarvis
 * TTS: Text-to-Speech mit Jarvis-Stimme (George – britisch, warm)
 * STT: Speech-to-Text mit Whisper (Schweizerdeutsch-kompatibel)
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY ?? "";
// George – Warm, Captivating Storyteller (britisch, männlich, reif) – am nächsten an Iron Man Jarvis
const JARVIS_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";

// ── TTS: Text → Audio (MP3 als Base64) ───────────────────────────────────────
export const elevenLabsRouter = router({
  tts: protectedProcedure
    .input(z.object({
      text: z.string().min(1).max(2500),
      voiceId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const voiceId = input.voiceId ?? JARVIS_VOICE_ID;
      const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_KEY,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg",
        },
        body: JSON.stringify({
          text: input.text,
          model_id: "eleven_multilingual_v2", // Unterstützt Deutsch/Schweizerdeutsch
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
            style: 0.2,
            use_speaker_boost: true,
          },
        }),
      });

      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`ElevenLabs TTS Fehler: ${resp.status} – ${err}`);
      }

      const arrayBuffer = await resp.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      return { audio: base64, mimeType: "audio/mpeg" };
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
