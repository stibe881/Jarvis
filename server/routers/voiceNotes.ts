import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { createVoiceNote, getVoiceNotesByUser, deleteVoiceNote, createNote, createTask } from "../db";
import { invokeLLM } from "../_core/llm";

const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY ?? "";

type Analysis = {
  summary: string;
  category: string;
  isTask: boolean;
  taskTitle?: string;
  dueHint?: string;
};

async function transcribeWithElevenLabs(audioBase64: string, mimeType: string): Promise<string> {
  const audioBuffer = Buffer.from(audioBase64, "base64");
  const blob = new Blob([audioBuffer], { type: mimeType });
  const formData = new FormData();
  formData.append("file", blob, `audio.${mimeType.split("/")[1] ?? "webm"}`);
  formData.append("model_id", "scribe_v1");
  formData.append("language_code", "deu");
  const resp = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": ELEVENLABS_KEY },
    body: formData,
  });
  if (!resp.ok) throw new Error(`Transkription fehlgeschlagen: ${resp.status}`);
  const result = await resp.json() as { text?: string; words?: Array<{ text: string }> };
  return result.text ?? result.words?.map(w => w.text).join(" ") ?? "";
}

async function analyseTranscript(transcript: string): Promise<Analysis> {
  const prompt = `Analysiere die folgende Sprachnotiz von Stefan Gross (Leiter ICT im Kompetenzzentrum Sonnenberg Baar und Inhaber von Gross ICT).

Sprachnotiz: "${transcript}"

Antworte AUSSCHLIESSLICH mit einem JSON-Objekt in genau dieser Form, ohne Codeblock und ohne weitere Erklärung:
{"summary":"ein bis zwei Sätze Zusammenfassung","category":"eine von: Gross ICT, Sonnenberg, Idee, Termin, Aufgabe, Kontakt, Allgemein","isTask":true oder false,"taskTitle":"kurzer Aufgabentitel falls isTask true, sonst leer","dueHint":"genannte Frist im Klartext falls vorhanden, sonst leer"}

Schweizer Schreibweise verwenden ("ss" statt "ß").`;
  try {
    const resp = await invokeLLM({
      model: "claude-sonnet-4-5",
      max_tokens: 500,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: [{ role: "user", content: prompt }] as any,
    });
    const raw = ((resp.choices[0]?.message?.content as string) ?? "").trim()
      .replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(raw) as Analysis;
    return {
      summary: parsed.summary ?? transcript.slice(0, 140),
      category: parsed.category ?? "Allgemein",
      isTask: Boolean(parsed.isTask),
      taskTitle: parsed.taskTitle || undefined,
      dueHint: parsed.dueHint || undefined,
    };
  } catch (e) {
    console.error("[VoiceNotes] Analyse fehlgeschlagen:", e);
    return { summary: transcript.slice(0, 140), category: "Allgemein", isTask: false };
  }
}

export const voiceNotesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return getVoiceNotesByUser(ctx.user.id);
  }),

  // Audio hochladen, transkribieren, analysieren und speichern
  record: protectedProcedure
    .input(z.object({
      audioBase64: z.string(),
      mimeType: z.string().default("audio/webm"),
      durationSec: z.number().optional(),
      autoCreateTask: z.boolean().default(true),
      alsoSaveAsNote: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const transcript = await transcribeWithElevenLabs(input.audioBase64, input.mimeType);
      if (!transcript.trim()) {
        return { transcript: "", summary: "", category: "Allgemein", createdTask: false, createdNote: false, id: 0 };
      }

      const analysis = await analyseTranscript(transcript);

      let noteId: number | null = null;
      let taskId: number | null = null;

      if (input.alsoSaveAsNote) {
        try {
          const title = analysis.summary.slice(0, 80) || "Sprachnotiz";
          const res = await createNote({
            userId: ctx.user.id,
            title,
            content: `${transcript}\n\n---\n*Sprachnotiz vom ${new Date().toLocaleString("de-CH", { timeZone: "Europe/Zurich" })}*`,
            tags: `Sprachnotiz,${analysis.category}`,
          });
          noteId = res?.id ?? null;
        } catch (e) { console.error("[VoiceNotes] Notiz anlegen fehlgeschlagen:", e); }
      }

      if (input.autoCreateTask && analysis.isTask && analysis.taskTitle) {
        try {
          const res = await createTask({
            userId: ctx.user.id,
            title: analysis.taskTitle,
            description: `Aus Sprachnotiz: ${transcript}${analysis.dueHint ? `\nFrist laut Notiz: ${analysis.dueHint}` : ""}`,
          });
          taskId = res?.id ?? null;
        } catch (e) { console.error("[VoiceNotes] Aufgabe anlegen fehlgeschlagen:", e); }
      }

      const created = await createVoiceNote({
        userId: ctx.user.id,
        transcript,
        summary: analysis.summary,
        category: analysis.category,
        durationSec: input.durationSec ?? null,
        noteId,
        taskId,
      });

      return {
        id: created.id,
        transcript,
        summary: analysis.summary,
        category: analysis.category,
        createdTask: taskId !== null,
        createdNote: noteId !== null,
      };
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteVoiceNote(input.id, ctx.user.id);
      return { success: true };
    }),
});
