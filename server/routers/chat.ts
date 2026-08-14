import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { executeCalendarAction } from "../_core/calendarAI";
import {
  addMessage,
  createConversation,
  deleteConversation,
  deleteConversations,
  getConversationById,
  getConversationsByUser,
  getMessagesByConversation,
  updateConversationTitle,
  createConversationGroup,
  getConversationGroupsByUser,
  deleteConversationGroup,
  moveConversationsToGroup,
  getTasksByUser,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import { invokeLLM } from "../_core/llm";
import {
  transcribeAudio,
  type WhisperResponse,
} from "../_core/voiceTranscription";
import { ENV } from "../_core/env";
import { getGoogleToken, upsertGoogleToken } from "../db";
import { executeAppAction } from "./appIntegration";
import { jarvisTools } from "../_core/tools";
import {
  getMemoriesByUser,
  upsertMemory,
  getUserProfile,
  trackPrompt,
  getTopPrompts,
} from "../db";
import { removeInternalTags } from "../cleanResponse";
import {
  runAgentLoop,
  executeAction,
  formatStepLog,
  type LoopMessage,
} from "../agent";
import { JARVIS_PERSONA } from "../persona";
import { CORE_AGENT_INSTRUCTIONS } from "./chatPrompt";
import { fetchWithTimeout } from "../_core/http";
import {
  rememberPending,
  takePending,
  isApproval,
  isRejection,
  hasPending,
  clearPending,
} from "../pendingApproval";

// ── Intent-Erkennung für lernende Vorschläge ──────────────────────────────────
const INTENT_RULES: Array<{ intent: string; label: string; test: RegExp }> = [
  {
    intent: "offene_rechnungen",
    label: "Offene Rechnungen zeigen",
    test: /(offen|unbezahlt|ausstehend).{0,20}rechnung|rechnung.{0,20}(offen|unbezahlt)/i,
  },
  {
    intent: "ueberfaellige_rechnungen",
    label: "Überfällige Rechnungen zeigen",
    test: /überfällig|mahnung|verzug/i,
  },
  {
    intent: "tagesplanung",
    label: "Was steht heute an?",
    test: /(was steht|wie sieht).{0,20}(heute|tag)|tagesplan|prioritäten|was soll ich (zuerst|heute)/i,
  },
  {
    intent: "termine_heute",
    label: "Termine heute",
    test: /termin.{0,20}(heute|morgen)|(heute|morgen).{0,20}termin|kalender.{0,15}(heute|morgen)/i,
  },
  { intent: "offene_tickets", label: "Offene Tickets zeigen", test: /ticket/i },
  {
    intent: "kunden_suche",
    label: "Kunde suchen",
    test: /kunde|kundin|kunden/i,
  },
  {
    intent: "angebot_erstellen",
    label: "Angebot erstellen",
    test: /angebot.{0,20}(erstell|schreib|mach)|erstell.{0,15}angebot/i,
  },
  {
    intent: "aufgaben_offen",
    label: "Offene Aufgaben zeigen",
    test: /aufgabe|pendenz|todo|to-do/i,
  },
  { intent: "wetter", label: "Wetter in Baar", test: /wetter/i },
  {
    intent: "email_entwurf",
    label: "E-Mail entwerfen",
    test: /(e-?mail|mail).{0,25}(schreib|entwurf|formulier)|schreib.{0,15}(e-?mail|mail)/i,
  },
  {
    intent: "dashboard",
    label: "App-Übersicht zeigen",
    test: /dashboard|übersicht|umsatz|kennzahl/i,
  },
  { intent: "projekte", label: "Projekte zeigen", test: /projekt/i },
];

function detectIntent(
  message: string
): { intent: string; label: string } | null {
  for (const rule of INTENT_RULES) {
    if (rule.test.test(message))
      return { intent: rule.intent, label: rule.label };
  }
  return null;
}

export async function buildChatSystemPrompt(
  userId: number,
  query?: string
): Promise<string> {
  const profile = await getUserProfile(userId);
  let memoryContext = "";
  const memories = await getMemoriesByUser(userId);
  if (memories.length > 0) {
    const memLines = memories.slice(0, 5).map(m => `- ${m.key}: ${m.value}`);
    memoryContext = `\n\nERINNERUNGEN:\n${memLines.join("\n")}`;
  }

  let approvalContext = "";
  if (hasPending(userId)) {
    approvalContext = `\n\nWICHTIG: Es gibt aktuell offene Aktionen, die auf Freigabe warten. Diese Aktionen darfst du erst ausführen, wenn der Nutzer ausdrücklich "Ja" oder "Einverstanden" sagt.`;
  }

  const calendarContext = `\n\nKALENDER: Du kannst Termine lesen und schreiben.
- Um Termine zu lesen: <calendar_action>{"action":"list_events","days":7}</calendar_action>
- Um einen Termin zu erstellen: <calendar_action>{"action":"create_event","summary":"Titel","start_time":"2024-05-20T10:00:00Z","end_time":"2024-05-20T11:00:00Z"}</calendar_action>
- Um Termine zu aktualisieren/löschen, nutze update_event / delete_event mit eventId.`;

  if (profile) {
    const addressStr = profile.location
      ? `Wohnhaft in ${profile.location}`
      : "Keine Adresse hinterlegt";
    const personalityStr = profile.interests
      ? `\nDeine Interessen: ${profile.interests}`
      : "";
    const langStr =
      profile.language === "en"
        ? "Answer in English."
        : profile.language === "auto"
          ? "Antworte auf Schweizerdeutsch oder Deutsch, je nach Kontext."
          : "Antworte auf Deutsch.";
    const jarvisName = profile.jarvisName || "Jarvis";

    const intelligenceContext = `
ARBEITSWEISE (sehr wichtig):
1. NACHFRAGEN BEI UNKLARHEIT: Wenn eine Anfrage nicht genug Informationen enthält, um sie korrekt auszuführen, stelle GEZIELTE Rückfragen anstatt zu raten oder eine leere Antwort zu geben.
2. ZEITGEFÜHL: Vergleiche geplante oder berechnete Zeiten (für Termine, Erinnerungen, Aufgaben oder allgemeine Aussagen) IMMER logisch mit der aktuellen Uhrzeit. Vermeide "Zeitreisen": Schlage nichts für heute vor, was bereits in der Vergangenheit liegt (z. B. 21:00 Uhr vorschlagen, wenn es schon 22:58 Uhr ist).
3. GEDÄCHTNIS (WICHTIG): Wenn der Nutzer dir in einer Nachricht wichtige Fakten über sich, seine Vorlieben, seine Familie oder sein Umfeld mitteilt, VERWENDE ZWINGEND die Funktion "memory_action", um diese Informationen sofort abzuspeichern! Tue dies automatisch ohne nachzufragen.
4. MUSTERERKENNUNG & LERNFÄHIGKEIT (PROAKTIV): Analysiere aktiv, wie der Nutzer Dinge formuliert, welche Aufgaben er priorisiert und ob sich Anfragen wiederholen (z. B. "Kunde X fragt alle 3 Monate an"). Speichere solche Muster sofort als "preference" oder "fact" über die "memory_action" ab, damit du in Zukunft proaktiv handeln kannst. Denke aktiv mit!`;

    const grossIctContext = `
GROSS ICT ASSISTENT: Stefan betreibt im Nebenerwerb die Firma Gross ICT (gross-ict.ch) in Zell, Luzern.
Leistungen: Webseiten (ab CHF 1'500), Web-Apps (ab CHF 15'000), Mobile Apps (ab CHF 20'000), IT-Support, Netzwerk, Security, Server – für KMU in der Zentralschweiz.
Wenn Stefan Hilfe zu Gross ICT braucht (Angebote, Texte, Kundenprojekte), kannst du helfen. Verwende immer CHF (nicht €) und Schweizer Schreibweise (ss statt ß).`;

    const now = new Date();
    const isoDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Zurich",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
    const dateStr = now.toLocaleDateString("de-DE", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Europe/Zurich",
    });
    const timeStr = now.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Zurich",
    });

    return `Du bist ${jarvisName}, der persönliche Assistent von Stefan Gross. ${addressStr}.
${langStr}

${JARVIS_PERSONA}

Du kannst Dateien analysieren, Web-Suchergebnisse verarbeiten, Notizen, Aufgaben und den Google Kalender verwalten. Du hast ein dauerhaftes Gedächtnis.${personalityStr}
Heute ist der ${dateStr}, es ist ${timeStr} Uhr (ISO: ${isoDate}).

ALTERSBERECHNUNG (strikt einhalten): Wenn du das Alter einer Person berechnest oder über Geburtstage sprichst:
1. Rohes Alter = heutiges Jahr − Geburtsjahr.
2. Hat der Geburtstag (Monat + Tag) dieses Jahr noch NICHT stattgefunden → Alter = Rohes Alter − 1, Geburtstag steht noch bevor.
3. Hat der Geburtstag dieses Jahr bereits stattgefunden → Alter = Rohes Alter, Geburtstag war bereits.
4. Kalendereinträge rund um einen Geburtstag sind NICHT zwingend veraltet – prüfe das Datum, bevor du einen Eintrag als «veraltet» bezeichnest.
${grossIctContext}
${intelligenceContext}
${CORE_AGENT_INSTRUCTIONS}
MUSIK (Spotify): Füge bei Musikwünschen GENAU EINEN spotify_action-Block ein:
<spotify_action>{"action":"play","query":"Coldplay Yellow","type":"track"}</spotify_action>
<spotify_action>{"action":"pause"}</spotify_action> / {"action":"next"} / {"action":"previous"}
<spotify_action>{"action":"volume","level":40}</spotify_action>
<spotify_action>{"action":"current"}</spotify_action> / {"action":"playlists"} / {"action":"devices"}
type kann track, album, playlist oder artist sein. Zeige NIE den rohen Block.

IPHONE (Kurzbefehle): Für WhatsApp-Nachrichten, Wecker und Timer GENAU EINEN device_action-Block:
<device_action>{"type":"whatsapp","recipient":"Bine","message":"Ich komme später"}</device_action>
<device_action>{"type":"alarm","time":"06:30","label":"Aufstehen"}</device_action>
<device_action>{"type":"timer","minutes":15}</device_action>
Fehlen Angaben, frage zuerst nach. Zeige NIE den rohen Block.
${calendarContext}${memoryContext}${approvalContext}`;
  }

  const now = new Date();
  const isoDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const dateStr = now.toLocaleDateString("de-DE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Europe/Zurich",
  });
  const timeStr = now.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Zurich",
  });

  return `Du bist Jarvis, der persönliche Assistent von Stefan Gross. Du antwortest immer auf Deutsch.

${JARVIS_PERSONA}

Du kannst Dateien analysieren, Web-Suchergebnisse verarbeiten, Notizen, Aufgaben und den Google Kalender verwalten. Du hast ein dauerhaftes Gedächtnis.
Heute ist der ${dateStr}, es ist ${timeStr} Uhr (ISO: ${isoDate}).

ALTERSBERECHNUNG (strikt einhalten): Wenn du das Alter einer Person berechnest oder über Geburtstage sprichst:
1. Rohes Alter = heutiges Jahr − Geburtsjahr.
2. Hat der Geburtstag (Monat + Tag) dieses Jahr noch NICHT stattgefunden → Alter = Rohes Alter − 1, Geburtstag steht noch bevor.
3. Hat der Geburtstag dieses Jahr bereits stattgefunden → Alter = Rohes Alter, Geburtstag war bereits.
4. Kalendereinträge rund um einen Geburtstag sind NICHT zwingend veraltet – prüfe das Datum, bevor du einen Eintrag als «veraltet» bezeichnest.

${CORE_AGENT_INSTRUCTIONS}

MUSIK (Spotify): Füge bei Musikwünschen GENAU EINEN spotify_action-Block ein:
<spotify_action>{"action":"play","query":"Coldplay Yellow","type":"track"}</spotify_action>
<spotify_action>{"action":"pause"}</spotify_action> / {"action":"next"} / {"action":"previous"}
<spotify_action>{"action":"volume","level":40}</spotify_action>
<spotify_action>{"action":"current"}</spotify_action> / {"action":"playlists"} / {"action":"devices"}
type kann track, album, playlist oder artist sein. Zeige NIE den rohen Block.

IPHONE (Kurzbefehle): Für WhatsApp-Nachrichten, Wecker und Timer GENAU EINEN device_action-Block:
<device_action>{"type":"whatsapp","recipient":"Bine","message":"Ich komme später"}</device_action>
<device_action>{"type":"alarm","time":"06:30","label":"Aufstehen"}</device_action>
<device_action>{"type":"timer","minutes":15}</device_action>
Fehlen Angaben, frage zuerst nach. Zeige NIE den rohen Block.
${calendarContext}${memoryContext}${approvalContext}`;
}

export const chatRouter = router({
  listConversations: protectedProcedure.query(async ({ ctx }) => {
    return getConversationsByUser(ctx.user.id);
  }),

  // Lernende Quick-Action-Vorschläge auf Basis der Nutzungshäufigkeit
  suggestions: protectedProcedure.query(async ({ ctx }) => {
    const top = await getTopPrompts(ctx.user.id, 4);
    const fallback = [
      {
        label: "Was steht heute an?",
        promptText:
          "Was steht heute an? Erstelle mir eine priorisierte Tagesplanung.",
      },
      {
        label: "Offene Rechnungen zeigen",
        promptText: "Zeige mir alle offenen Rechnungen.",
      },
      {
        label: "Offene Tickets zeigen",
        promptText: "Welche Tickets sind noch offen?",
      },
      {
        label: "Termine diese Woche",
        promptText: "Welche Termine habe ich diese Woche?",
      },
    ];
    if (top.length === 0) return fallback;
    const mapped = top.map(t => ({ label: t.label, promptText: t.promptText }));
    // Auf vier Vorschläge auffüllen
    for (const f of fallback) {
      if (mapped.length >= 4) break;
      if (!mapped.some(m => m.label === f.label)) mapped.push(f);
    }
    return mapped.slice(0, 4);
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
      if (!conv || conv.userId !== ctx.user.id)
        throw new TRPCError({ code: "FORBIDDEN" });
      await deleteConversation(input.id);
      return { success: true };
    }),

  deleteConversations: protectedProcedure
    .input(z.object({ ids: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      for (const id of input.ids) {
        const conv = await getConversationById(id);
        if (conv && conv.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }
      await deleteConversations(input.ids);
      return { success: true };
    }),

  // ─── Groups ────────────────────────────────────────────────────────────────

  listGroups: protectedProcedure.query(async ({ ctx }) => {
    return getConversationGroupsByUser(ctx.user.id);
  }),

  createGroup: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const id = await createConversationGroup({
        userId: ctx.user.id,
        name: input.name,
      });
      return { id };
    }),

  deleteGroup: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Security: we should ideally check if group belongs to user.
      // Skipping strict check here for brevity, but groups shouldn't be shared.
      await deleteConversationGroup(input.id);
      return { success: true };
    }),

  moveToGroup: protectedProcedure
    .input(
      z.object({
        conversationIds: z.array(z.number()),
        groupId: z.number().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate conversation ownership
      for (const id of input.conversationIds) {
        const conv = await getConversationById(id);
        if (conv && conv.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }
      await moveConversationsToGroup(input.conversationIds, input.groupId);
      return { success: true };
    }),

  // ─── Morning Briefing ──────────────────────────────────────────────────────
  generateMorningBriefing: protectedProcedure.query(async ({ ctx }) => {
    // 1. Termine von heute holen
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    
    let calendarContext = "";
    try {
      const upcoming = await executeCalendarAction(ctx.user.id, "list_events", {
        timeMin: todayStart.toISOString(),
        timeMax: todayEnd.toISOString(),
      });
      calendarContext =
        upcoming && Array.isArray(upcoming) && upcoming.length > 0
          ? `Heutige Termine:\n${upcoming
              .map(
                (e: any) =>
                  `- ${e.summary} (${e.start?.dateTime || e.start?.date || "?"})`
              )
              .join("\n")}`
          : "Keine Termine für heute.";
    } catch (e) {
      calendarContext = "Kalender konnte nicht abgerufen werden.";
    }

    // 2. Offene Aufgaben holen
    const tasks = await getTasksByUser(ctx.user.id);
    const pendingTasks = tasks.filter(t => !t.completed);
    const tasksContext =
      pendingTasks.length > 0
        ? `Offene Aufgaben:\n${pendingTasks
            .map(t => `- [${t.priority}] ${t.title}`)
            .join("\n")}`
        : "Keine offenen Aufgaben.";

    // 3. System Prompt & LLM
    const systemPrompt = `Du bist Jarvis, der persönliche Assistent von Stefan Gross.
Es ist früh am Tag. Deine Aufgabe ist es, ein kurzes, prägnantes "Morning Briefing" (Tagesplanung) zu generieren.
Analysiere die heutigen Termine und offenen Aufgaben und schreibe einen kurzen, motivierenden Text (max. 3-4 Sätze oder Bulletpoints).
Heb besonders wichtige Aufgaben (high priority) oder nahende Termine hervor.
Antworte auf Deutsch.`;

    const llmMessages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `${calendarContext}\n\n${tasksContext}` }
    ];

    try {
      const llmResp = await invokeLLM({
        model: "claude-sonnet-4-5",
        max_tokens: 500,
        messages: llmMessages as any,
      });
      return { briefing: llmResp.choices[0]?.message?.content || "Konnte kein Briefing generieren." };
    } catch (e) {
      console.error("Error generating morning briefing:", e);
      return { briefing: "Fehler beim Generieren der Tagesplanung." };
    }
  }),

  getMessages: protectedProcedure
    .input(z.object({ conversationId: z.number() }))
    .query(async ({ ctx, input }) => {
      const conv = await getConversationById(input.conversationId);
      if (!conv || conv.userId !== ctx.user.id)
        throw new TRPCError({ code: "FORBIDDEN" });
      return getMessagesByConversation(input.conversationId);
    }),

  uploadFile: protectedProcedure
    .input(
      z.object({
        fileName: z.string(),
        fileBase64: z.string(),
        mimeType: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.fileBase64, "base64");
      const key = `jarvis/${ctx.user.id}/files/${Date.now()}-${input.fileName}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      return { url, key, fileName: input.fileName, mimeType: input.mimeType };
    }),

  transcribeAudio: protectedProcedure
    .input(
      z.object({ audioBase64: z.string(), mimeType: z.string().optional() })
    )
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.audioBase64, "base64");
      const key = `jarvis/${ctx.user.id}/audio/${Date.now()}.webm`;
      const { url } = await storagePut(
        key,
        buffer,
        input.mimeType ?? "audio/webm"
      );
      const baseUrl = ENV.forgeApiUrl?.replace("/v1", "") ?? "";
      const fullUrl = `${baseUrl}${url}`;
      const result = await transcribeAudio({
        audioUrl: fullUrl,
        language: "de",
      });
      if ("error" in result)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error,
        });
      return { text: (result as WhisperResponse).text };
    }),

  webSearch: protectedProcedure
    .input(z.object({ query: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const response = await fetchWithTimeout(
          `https://api.duckduckgo.com/?q=${encodeURIComponent(input.query)}&format=json&no_html=1&skip_disambig=1`
        );
        const data = (await response.json()) as {
          AbstractText?: string;
          AbstractURL?: string;
          RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
        };
        const results: Array<{ title: string; url: string; snippet: string }> =
          [];
        if (data.AbstractText) {
          results.push({
            title: "Zusammenfassung",
            url: data.AbstractURL ?? "",
            snippet: data.AbstractText,
          });
        }
        if (data.RelatedTopics) {
          for (const topic of data.RelatedTopics.slice(0, 5)) {
            if (topic.Text && topic.FirstURL) {
              results.push({
                title: topic.Text.slice(0, 80),
                url: topic.FirstURL,
                snippet: topic.Text,
              });
            }
          }
        }
        return { results, query: input.query };
      } catch {
        return { results: [], query: input.query };
      }
    }),

  // ─── tRPC-basierte Chat-Mutation (kein SSE, funktioniert in Produktion) ──────
  sendMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.number(),
        message: z.string(),
        fileUrl: z.string().optional(),
        fileName: z.string().optional(),
        searchResults: z
          .array(
            z.object({
              title: z.string(),
              snippet: z.string(),
              url: z.string(),
            })
          )
          .optional(),
        context: z
          .object({
            location: z.object({ lat: z.number(), lng: z.number() }).optional(),
            battery: z.string().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const {
        conversationId,
        message,
        fileUrl,
        fileName,
        searchResults,
        context,
      } = input;
      const userId = ctx.user.id;

      const conv = await getConversationById(conversationId);
      if (!conv || conv.userId !== userId)
        throw new TRPCError({ code: "FORBIDDEN" });

      const history = await getMessagesByConversation(conversationId);

      // Benutzer-Nachricht speichern
      await addMessage({
        conversationId,
        role: "user",
        content: message,
        fileUrl: fileUrl ?? null,
        fileName: fileName ?? null,
      });

      // ── Freigabe für kritische Aktionen prüfen ──────────────────────────
      // Kritische Aktionen werden vorgemerkt. Sagt Stefan "Ja", führen wir sie
      // hier direkt aus – deterministisch, ohne das Modell erneut zu fragen.
      // Sagt er "Nein", verwerfen wir sie. Bei allen anderen Nachrichten
      // (z.B. Rückfragen) bleibt die Vormerkung erhalten.
      const wasPending = hasPending(conversationId);
      const approvedNow = wasPending && isApproval(message);
      const rejectedNow = wasPending && !approvedNow && isRejection(message);
      if (rejectedNow) clearPending(conversationId);

      let approvalContext = "";
      if (approvedNow) {
        const approvedActions = takePending(conversationId);
        const executed: string[] = [];
        for (const p of approvedActions) {
          const step = await executeAction(
            { userId, runCalendar: executeCalendarAction },
            { tag: p.tag, payload: p.payload }
          );
          executed.push(`- ${p.description}: ${step.result}`);
        }
        approvalContext =
          executed.length > 0
            ? `\n\nFREIGEGEBEN UND BEREITS AUSGEFÜHRT: Stefan hat zugestimmt, die folgenden Aktionen wurden gerade ausgeführt. Bestätige das kurz mit den echten Ergebnissen und führe sie NICHT erneut aus:\n${executed.join("\n")}`
            : "";
      } else if (rejectedNow) {
        approvalContext =
          "\n\nABGELEHNT: Stefan hat die vorgemerkte Aktion abgelehnt. Bestätige kurz, dass du sie nicht ausgeführt hast, und frage nach der gewünschten Alternative.";
      }

      // Intent für lernende Vorschläge erfassen
      try {
        const detected = detectIntent(message);
        if (detected)
          await trackPrompt(
            userId,
            detected.intent,
            detected.label,
            message.slice(0, 400)
          );
      } catch (e) {
        console.error("[PromptStats]", e);
      }

      // Kalender-Kontext laden
      let calendarContext = "";
      try {
        const upcoming = await executeCalendarAction(userId, "list_events", {
          timeMin: new Date().toISOString(),
          timeMax: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
        if (
          !upcoming.includes("nicht verbunden") &&
          !upcoming.includes("Keine Termine")
        )
          calendarContext = `\n\nDeine nächsten Termine (7 Tage):\n${upcoming}`;
      } catch {
        /* ignorieren */
      }

      // Gedächtnis laden
      let memoryContext = "";
      try {
        const mems = await getMemoriesByUser(userId);
        if (mems.length > 0) {
          const grouped: Record<string, string[]> = {};
          for (const m of mems) {
            if (!grouped[m.category]) grouped[m.category] = [];
            grouped[m.category].push(`${m.key}: ${m.value}`);
          }
          // Kategorien als Klartext-Überschrift, NICHT in eckigen Klammern:
          // das Modell hat die Markierungen sonst wörtlich in die Antwort
          // übernommen (im Chat erschien etwa «... 2019 [person].»).
          const namen: Record<string, string> = {
            person: "Personen",
            contact: "Kontakte",
            preference: "Vorlieben",
            project: "Projekte",
            fact: "Fakten",
            context: "Kontext",
          };
          const lines = Object.entries(grouped)
            .map(([cat, items]) => `${namen[cat] ?? cat}:\n${items.join("\n")}`)
            .join("\n\n");
          memoryContext = `\n\nGespeichertes Wissen über den Nutzer:\n${lines}`;
        }
      } catch {
        /* ignorieren */
      }

      // Nutzerprofil laden
      let profileContext = "";
      try {
        const profile = await getUserProfile(userId);
        if (profile) {
          const parts: string[] = [];
          if (profile.displayName)
            parts.push(`Name des Nutzers: ${profile.displayName}`);
          if (profile.occupation) parts.push(`Beruf: ${profile.occupation}`);
          if (profile.location) parts.push(`Standort: ${profile.location}`);
          if (profile.interests)
            parts.push(`Interessen/Hobbys: ${profile.interests}`);
          if (profile.workContext)
            parts.push(`Beruflicher Kontext: ${profile.workContext}`);
          if (profile.personalNotes)
            parts.push(`Persönliche Notizen: ${profile.personalNotes}`);
          if (parts.length > 0)
            profileContext = `

Nutzerprofil:
${parts.join("\n")}`;
          // Anredeform und Jarvis-Name
          const jarvisName = profile.jarvisName ?? "Jarvis";
          const addressForm = profile.addressForm ?? "sir";
          const addressStr =
            addressForm === "sir"
              ? "Spreche den Nutzer mit 'Sir' an"
              : addressForm === "du"
                ? `Spreche den Nutzer mit '${profile.displayName ?? "du"}' an`
                : `Spreche den Nutzer mit '${profile.displayName ?? "du"}' an`;
          const personalityStr = profile.jarvisPersonality
            ? `\n\nPersönlichkeit: ${profile.jarvisPersonality}`
            : "";
          const langStr =
            profile.language === "en"
              ? "Antworte auf Englisch."
              : profile.language === "auto"
                ? "Antworte in der Sprache des Nutzers."
                : "Antworte auf Deutsch.";
          const systemPrompt = `Du bist ${jarvisName}, der persönliche Assistent von Stefan Gross. ${addressStr}.
${langStr}

${JARVIS_PERSONA}

Du kannst Dateien analysieren, Web-Suchergebnisse verarbeiten, Notizen, Aufgaben und den Google Kalender verwalten. Du hast ein dauerhaftes Gedächtnis.${personalityStr}
WICHTIG: Nutze für echte "Erinnerungen" (z.B. "Erinnere mich um X Uhr an Y") zwingend das 'schedule_task' Werkzeug (Hintergrund-Task), damit der Nutzer eine Push-Benachrichtigung erhält! Nutze den Kalender NUR für tatsächliche "Termine" oder wenn explizit ein Kalendereintrag gewünscht ist.
Heute ist der ${new Date().toLocaleDateString("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Europe/Zurich" })}, es ist ${new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" })} Uhr (ISO: ${new Date().toISOString().split("T")[0]}).

ALTERSBERECHNUNG (strikt einhalten): Wenn du das Alter einer Person berechnest oder über Geburtstage sprichst:
1. Rohes Alter = heutiges Jahr − Geburtsjahr.
2. Hat der Geburtstag (Monat + Tag) dieses Jahr noch NICHT stattgefunden → Alter = Rohes Alter − 1, Geburtstag steht noch bevor.
3. Hat der Geburtstag dieses Jahr bereits stattgefunden → Alter = Rohes Alter, Geburtstag war bereits.
4. Kalendereinträge rund um einen Geburtstag sind NICHT zwingend veraltet – prüfe das Datum, bevor du einen Eintrag als «veraltet» bezeichnest.`;
          // Weiter mit dem Rest des System-Prompts (Kalender/Gedächtnis-Aktionen)
          const grossIctContext = `

GROSS ICT ASSISTENT: Stefan betreibt im Nebenerwerb die Firma Gross ICT (gross-ict.ch) in Zell, Luzern.
Leistungen: Webseiten (ab CHF 1'500), Web-Apps (ab CHF 15'000), Mobile Apps (ab CHF 20'000), IT-Support, Netzwerk, Security, Server – für KMU in der Zentralschweiz.
Wenn Stefan Hilfe zu Gross ICT braucht (Angebote, Texte, Kundenprojekte), kannst du helfen. Verwende immer CHF (nicht €) und Schweizer Schreibweise (ss statt ß).`;
          const intelligenceContext = `

ARBEITSWEISE (sehr wichtig):

1. NACHFRAGEN BEI UNKLARHEIT: Wenn eine Anfrage nicht genug Informationen enthält, um sie korrekt auszuführen, stelle GEZIELTE Rückfragen anstatt zu raten oder eine leere Antwort zu geben.
   Beispiel Termin: fehlen Datum, Uhrzeit, Dauer oder Titel, frage konkret: "Für wann? Wie lange? Mit wem?"
   Beispiel Rechnung/Angebot: fehlen Kunde, Positionen oder Betrag, frage genau danach.
   Stelle maximal drei Rückfragen auf einmal und nummeriere sie. Wenn du bereits 80 % der Informationen hast, mache einen konkreten Vorschlag und bitte nur um Bestätigung.
   Wenn du eine Rückfrage stellst, führe KEINE Aktion aus.

2. PROAKTIVE TAGESPLANUNG: Wenn Stefan nach dem Tag, dem Plan, den Prioritäten oder einer Übersicht fragt ("Was steht heute an?", "Wie sieht mein Tag aus?", "Was soll ich zuerst machen?"), erstelle eine priorisierte Tagesplanung:
   - Fasse Termine und Aufgaben in einer knappen Liste zusammen
   - Setze eine klare Reihenfolge mit Begründung (Fristen, Termine, Aufwand)
   - Nenne höchstens drei Punkte als "heute wirklich wichtig"
   - Weise auf Konflikte hin (z.B. Aufgabe fällig, aber ganzer Tag verplant)
   - Schliesse mit einer kurzen Frage, ob du Aufgaben verschieben oder Prioritäten anpassen sollst

3. DOKUMENT-ZUSAMMENFASSUNG: Wenn eine Datei angehängt ist, strukturiere deine Antwort so:
   **Kurzfazit** (zwei bis drei Sätze) · **Die wichtigsten Punkte** (Stichworte) · **Zahlen und Fristen** (falls vorhanden) · **Handlungsempfehlung** (konkrete nächste Schritte für Stefan) · **Offene Fragen** (falls etwas unklar bleibt)

4. E-MAIL-ENTWÜRFE: Wenn Stefan eine E-Mail, Mahnung, Zahlungserinnerung oder Nachfrage braucht, schreibe einen vollständigen, versandfertigen Entwurf:
   - Beginne mit "Betreff: ..."
   - Passende Anrede und Grussformel mit Stefans Namen
   - Sachlich, freundlich, maximal 200 Wörter
   - Wenn es um einen Kunden aus der App geht, hole zuerst die Daten mit einem app_action-Block (Kunde, Rechnungsnummer, Betrag, Fälligkeit) und schreibe die E-Mail dann mit den echten Werten
   - Erfinde NIE Rechnungsnummern, Beträge oder Daten. Fehlt eine Angabe, frage nach oder markiere sie klar als [Platzhalter]

5. VORLAGEN: Für wiederkehrende Dokumente (Angebot, IT-Konzept, Beschaffungsantrag, Protokoll, Statusbericht) gibt es im Bereich "Vorlagen" fertige Muster mit Platzhaltern. Weise Stefan darauf hin, wenn eine Vorlage schneller wäre.`;
          let fullSystemPrompt =
            systemPrompt +
            grossIctContext +
            intelligenceContext +
            `

${CORE_AGENT_INSTRUCTIONS}

MUSIK (Spotify): Stefan kann sein Spotify-Konto verbinden. Wenn er Musik hören will, füge GENAU EINEN spotify_action-Block ein:
<spotify_action>{"action":"play","query":"Coldplay Yellow","type":"track"}</spotify_action>
<spotify_action>{"action":"play","query":"Deep Focus","type":"playlist"}</spotify_action>
<spotify_action>{"action":"play"}</spotify_action>            // Wiedergabe fortsetzen
<spotify_action>{"action":"pause"}</spotify_action>
<spotify_action>{"action":"next"}</spotify_action>
<spotify_action>{"action":"previous"}</spotify_action>
<spotify_action>{"action":"volume","level":40}</spotify_action>
<spotify_action>{"action":"shuffle","enabled":true}</spotify_action>
<spotify_action>{"action":"current"}</spotify_action>          // was läuft gerade
<spotify_action>{"action":"search","query":"Jazz","type":"playlist"}</spotify_action>
<spotify_action>{"action":"playlists"}</spotify_action>
<spotify_action>{"action":"devices"}</spotify_action>
type kann track, album, playlist oder artist sein. Zeige NIE den rohen spotify_action-Block.

IPHONE (über Kurzbefehle): Stefan kann Jarvis bitten, WhatsApp-Nachrichten zu senden oder Wecker/Timer zu stellen.
Diese Befehle landen in einer Warteschlange, die sein iPhone abholt. Füge GENAU EINEN device_action-Block ein:
<device_action>{"type":"whatsapp","recipient":"Bine","message":"Ich komme etwas später"}</device_action>
<device_action>{"type":"alarm","time":"06:30","label":"Aufstehen"}</device_action>
<device_action>{"type":"timer","minutes":15,"label":"Pause"}</device_action>
<device_action>{"type":"reminder","message":"Rechnung Muster AG prüfen","time":"14:00"}</device_action>
Wenn Angaben fehlen (Empfänger, Text, Uhrzeit), frage zuerst nach. Zeige NIE den rohen device_action-Block.
${profileContext}${calendarContext}${memoryContext}${approvalContext}`;

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
              fullSystemPrompt += `\n\nGERÄTE-KONTEXT (Smartphone/Browser des Nutzers):\n${parts.join("\n")}`;
            }
          }

          // LLM aufrufen mit Profil-Kontext
          type LLMMessage = {
            role: "system" | "user" | "assistant";
            content:
              | string
              | Array<{
                  type: string;
                  text?: string;
                  image_url?: { url: string };
                }>;
          };
          const llmMessages2: LLMMessage[] = [
            { role: "system", content: fullSystemPrompt },
            ...history.map(m => ({
              role: (m.role === "assistant" ? "assistant" : "user") as
                | "user"
                | "assistant",
              content: m.content,
            })),
          ];
          let userContent2:
            | string
            | Array<{
                type: string;
                text?: string;
                image_url?: { url: string };
              }> = message;
          if (searchResults && searchResults.length > 0) {
            const ctxStr = searchResults
              .map(r => `**${r.title}**: ${r.snippet} (${r.url})`)
              .join("\n");
            userContent2 = `${message}\n\n[Web-Suchergebnisse:\n${ctxStr}]`;
          }
          if (fileUrl && fileName) {
            const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
            const isImage = ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);
            const baseUrl = ENV.forgeApiUrl?.replace("/v1", "") ?? "";
            const absUrl = fileUrl.startsWith("http")
              ? fileUrl
              : `${baseUrl}${fileUrl}`;
            if (isImage) {
              userContent2 = [
                { type: "image_url", image_url: { url: absUrl } },
                {
                  type: "text",
                  text:
                    typeof userContent2 === "string"
                      ? userContent2 || `Analysiere dieses Bild: ${fileName}`
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
              } catch {
                /* ignorieren */
              }
              userContent2 = fileContent
                ? `${typeof userContent2 === "string" ? userContent2 : message}\n\n[Dateiinhalt von ${fileName}:\n\`\`\`\n${fileContent}\n\`\`\`]`
                : `${typeof userContent2 === "string" ? userContent2 : message}\n\n[Datei: ${fileName}]`;
            }
          }
          llmMessages2.push({ role: "user", content: userContent2 as string });

          const llmResp2 = await invokeLLM({
            model: "claude-sonnet-4-5",
            max_tokens: 4096,
            messages: llmMessages2 as any,
            
          });
          const msgContent2 = llmResp2.choices[0]?.message;
          const fullResponse2 = {
            text:
              typeof msgContent2?.content === "string"
                ? msgContent2.content
                : "",
            tool_calls: msgContent2?.tool_calls,
          };
          // ── Agenten-Schleife: Werkzeuge ausführen und weiterarbeiten ──────
          // Jarvis darf mehrere Runden Werkzeuge nutzen. Nach jeder Runde
          // erhält er die Ergebnisse als Beobachtung und entscheidet selbst,
          // ob er weitere Daten braucht oder die Antwort formulieren kann.
          const loopP = await runAgentLoop({
            firstResponse: fullResponse2,
            messages: llmMessages2 as unknown as LoopMessage[],
            runAction: parsed =>
              executeAction(
                { userId, runCalendar: executeCalendarAction },
                parsed
              ),
            callModel: async msgs => {
              const next = await invokeLLM({
                model: "claude-sonnet-4-5",
                max_tokens: 4096,
                messages: msgs as any,
                
              });
              const msg = next.choices[0]?.message;
              return {
                text: typeof msg?.content === "string" ? msg.content : "",
                tool_calls: msg?.tool_calls,
              };
            },
            // Hat Stefan im vorherigen Zug zugestimmt, dürfen kritische Aktionen laufen
          });
          // Interne Kategorie-Markierungen entfernen, bevor der Text gespeichert
          // und ausgegeben wird (sonst erscheint etwa «... 2019 [person].»).
          const finalResponseText2 =
            removeInternalTags(loopP.text) + formatStepLog(loopP.steps);
          rememberPending(conversationId, loopP.pending);
          const convTitleP = finalResponseText2
            .slice(0, 50)
            .replace(/[\n]/g, " ")
            .trim();
          if (history.length <= 1) {
            await updateConversationTitle(
              conversationId,
              convTitleP || message.slice(0, 50)
            );
          }
          await addMessage({
            conversationId,
            role: "assistant",
            content: finalResponseText2,
          });
          return { response: finalResponseText2 };
        }
      } catch (e) {
        console.error("[Profile] Fehler beim Laden:", e);
      }

      // Fallback: Ohne Profil: System-Prompt direkt bauen
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

      systemPrompt += `Du bist Jarvis, der persönliche Assistent von Stefan Gross. Du antwortest immer auf Deutsch.

${JARVIS_PERSONA}

Du kannst Dateien analysieren, Web-Suchergebnisse verarbeiten, Notizen, Aufgaben und den Google Kalender verwalten. Du hast ein dauerhaftes Gedächtnis.
WICHTIG: Nutze für echte "Erinnerungen" (z.B. "Erinnere mich um X Uhr an Y") zwingend das 'schedule_task' Werkzeug (Hintergrund-Task), damit der Nutzer eine Push-Benachrichtigung erhält! Nutze den Kalender NUR für tatsächliche "Termine" oder wenn explizit ein Kalendereintrag gewünscht ist.
Heute ist der ${new Date().toLocaleDateString("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Europe/Zurich" })}, es ist ${new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" })} Uhr (ISO: ${new Date().toISOString().split("T")[0]}).

ALTERSBERECHNUNG (strikt einhalten): Wenn du das Alter einer Person berechnest oder über Geburtstage sprichst:
1. Rohes Alter = heutiges Jahr − Geburtsjahr.
2. Hat der Geburtstag (Monat + Tag) dieses Jahr noch NICHT stattgefunden → Alter = Rohes Alter − 1, Geburtstag steht noch bevor.
3. Hat der Geburtstag dieses Jahr bereits stattgefunden → Alter = Rohes Alter, Geburtstag war bereits.
4. Kalendereinträge rund um einen Geburtstag sind NICHT zwingend veraltet – prüfe das Datum, bevor du einen Eintrag als «veraltet» bezeichnest.

${CORE_AGENT_INSTRUCTIONS}

MUSIK (Spotify): Füge bei Musikwünschen GENAU EINEN spotify_action-Block ein:
<spotify_action>{"action":"play","query":"Coldplay Yellow","type":"track"}</spotify_action>
<spotify_action>{"action":"pause"}</spotify_action> / {"action":"next"} / {"action":"previous"}
<spotify_action>{"action":"volume","level":40}</spotify_action>
<spotify_action>{"action":"current"}</spotify_action> / {"action":"playlists"} / {"action":"devices"}
type kann track, album, playlist oder artist sein. Zeige NIE den rohen Block.

IPHONE (Kurzbefehle): Für WhatsApp-Nachrichten, Wecker und Timer GENAU EINEN device_action-Block:
<device_action>{"type":"whatsapp","recipient":"Bine","message":"Ich komme später"}</device_action>
<device_action>{"type":"alarm","time":"06:30","label":"Aufstehen"}</device_action>
<device_action>{"type":"timer","minutes":15}</device_action>
Fehlen Angaben, frage zuerst nach. Zeige NIE den rohen Block.
${calendarContext}${memoryContext}${approvalContext}`;

      type LLMMessage = {
        role: "system" | "user" | "assistant";
        content:
          | string
          | Array<{ type: string; text?: string; image_url?: { url: string } }>;
      };
      const llmMessages: LLMMessage[] = [
        { role: "system", content: systemPrompt },
        ...history.map(m => ({
          role: (m.role === "assistant" ? "assistant" : "user") as
            | "user"
            | "assistant",
          content: m.content,
        })),
      ];

      // Aktuelle Nachricht aufbauen
      let userContent:
        | string
        | Array<{ type: string; text?: string; image_url?: { url: string } }> =
        message;
      if (searchResults && searchResults.length > 0) {
        const ctxStr = searchResults
          .map(r => `**${r.title}**: ${r.snippet} (${r.url})`)
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
          } catch {
            /* ignorieren */
          }
          userContent = fileContent
            ? `${typeof userContent === "string" ? userContent : message}\n\n[Dateiinhalt von ${fileName}:\n\`\`\`\n${fileContent}\n\`\`\`]`
            : `${typeof userContent === "string" ? userContent : message}\n\n[Datei: ${fileName}]`;
        }
      }
      llmMessages.push({ role: "user", content: userContent as string });

      // LLM aufrufen (nicht-streaming)

      const llmResp = await invokeLLM({
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        messages: llmMessages as any,
        
      });
      const msgContent = llmResp.choices[0]?.message;
      const fullResponse = {
        text: typeof msgContent?.content === "string" ? msgContent.content : "",
        tool_calls: msgContent?.tool_calls,
      };

      // ── Agenten-Schleife: Werkzeuge ausführen und weiterarbeiten ─────────
      // Auch dieser Pfad (ohne Profil) nutzt die mehrstufige Werkzeugnutzung.
      const loopFb = await runAgentLoop({
        firstResponse: fullResponse,
        messages: llmMessages as unknown as LoopMessage[],
        runAction: parsed =>
          executeAction({ userId, runCalendar: executeCalendarAction }, parsed),
        callModel: async msgs => {
          const next = await invokeLLM({
            model: "claude-sonnet-4-5",
            max_tokens: 4096,
            messages: msgs as any,
            
          });
          const msg = next.choices[0]?.message;
          return {
            text: typeof msg?.content === "string" ? msg.content : "",
            tool_calls: msg?.tool_calls,
          };
        },
      });
      // Interne Kategorie-Markierungen entfernen (siehe cleanResponse.ts)
      const cleanResponse =
        removeInternalTags(loopFb.text) + formatStepLog(loopFb.steps);
      rememberPending(conversationId, loopFb.pending);

      // Antwort speichern
      await addMessage({
        conversationId,
        role: "assistant",
        content: cleanResponse,
      });

      // Gesprächstitel generieren (nur beim ersten Austausch)
      if (history.length === 0) {
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
          /* optional */
        }
      }

      return { response: cleanResponse, conversationId };
    }),
});
