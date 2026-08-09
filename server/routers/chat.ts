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
import { getGoogleToken, upsertGoogleToken } from "../db";
import { executeAppAction } from "./appIntegration";
import { getMemoriesByUser, upsertMemory, getUserProfile } from "../db";

// Kalender-Aktionen direkt ausführen (für Chat-Integration)
async function executeCalendarAction(userId: number, action: string, params: Record<string, unknown>): Promise<string> {
  try {
    const token = await getGoogleToken(userId);
    if (!token) return "Google Kalender ist nicht verbunden.";
    let accessToken = token.accessToken;
    if (token.expiresAt <= Math.floor(Date.now() / 1000) + 60 && token.refreshToken) {
      const rr = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, refresh_token: token.refreshToken, grant_type: "refresh_token" }) });
      const rd = await rr.json() as { access_token?: string; expires_in?: number };
      if (rd.access_token) { accessToken = rd.access_token; await upsertGoogleToken({ userId, accessToken, expiresAt: Math.floor(Date.now() / 1000) + (rd.expires_in ?? 3600), refreshToken: token.refreshToken, email: token.email }); }
    }
    const headers: Record<string, string> = { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" };
    const calId = (params.calendarId as string) ?? "primary";
    if (action === "list_events") {
      const now = new Date(); const tMin = (params.timeMin as string) ?? now.toISOString(); const tMax = (params.timeMax as string) ?? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const resp = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?singleEvents=true&orderBy=startTime&maxResults=20&timeMin=${encodeURIComponent(tMin)}&timeMax=${encodeURIComponent(tMax)}`, { headers });
      const data = await resp.json() as { items?: Array<{ id: string; summary?: string; start?: { dateTime?: string; date?: string }; location?: string; organizer?: { email?: string; displayName?: string; self?: boolean }; attendees?: Array<{ email?: string; displayName?: string; self?: boolean; organizer?: boolean; responseStatus?: string }> }> };
      if (!data.items || data.items.length === 0) return "Keine Termine in diesem Zeitraum.";
      const tz = "Europe/Zurich";
      return data.items.map(ev => {
        const d = new Date(ev.start?.dateTime ?? ev.start?.date ?? "");
        const dateStr = d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: tz });
        const timeStr = ev.start?.dateTime ? d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: tz }) : "Ganztägig";
        // Einladung erkennen: organizer ist nicht der Nutzer selbst
        let inviteInfo = "";
        if (ev.organizer && !ev.organizer.self) {
          const organizerName = ev.organizer.displayName || ev.organizer.email?.split("@")[0] || "jemanden";
          inviteInfo = ` [Einladung von ${organizerName}]`;
        }
        return `• ${dateStr} ${timeStr}: ${ev.summary ?? "Termin"}${ev.location ? ` (${ev.location})` : ""}${inviteInfo}`;
      }).join("\n");
    }
    if (action === "create_event") {
      const event = { summary: params.summary, description: params.description, location: params.location, start: { dateTime: params.startDateTime, timeZone: "Europe/Zurich" }, end: { dateTime: params.endDateTime, timeZone: "Europe/Zurich" } };
      const resp = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`, { method: "POST", headers, body: JSON.stringify(event) });
      const data = await resp.json() as { summary?: string; htmlLink?: string };
      return `Termin "${data.summary}" wurde erstellt.`;
    }
    if (action === "delete_event") {
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${params.eventId}`, { method: "DELETE", headers });
      return "Termin wurde gelöscht.";
    }
    if (action === "update_event" || action === "invite_attendee") {
      // Aktuellen Termin laden
      const getResp = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${params.eventId}`, { headers });
      if (!getResp.ok) return `Termin nicht gefunden (ID: ${params.eventId}).`;
      const current = await getResp.json() as Record<string, unknown>;

      if (action === "invite_attendee") {
        // Gast hinzufügen
        const existingAttendees = (current.attendees as Array<{ email: string }> | undefined) ?? [];
        const newEmail = params.email as string;
        if (!newEmail) return "Bitte eine E-Mail-Adresse angeben.";
        if (existingAttendees.some(a => a.email === newEmail)) return `${newEmail} ist bereits eingeladen.`;
        const updatedEvent = { ...current, attendees: [...existingAttendees, { email: newEmail }] };
        const putResp = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${params.eventId}`, { method: "PUT", headers, body: JSON.stringify(updatedEvent) });
        const putData = await putResp.json() as { summary?: string };
        return `${newEmail} wurde zum Termin "${putData.summary}" eingeladen.`;
      }

      if (action === "update_event") {
        const patch: Record<string, unknown> = { ...current };
        if (params.summary) patch.summary = params.summary;
        if (params.description !== undefined) patch.description = params.description;
        if (params.location !== undefined) patch.location = params.location;
        if (params.startDateTime) patch.start = { dateTime: params.startDateTime, timeZone: "Europe/Zurich" };
        if (params.endDateTime) patch.end = { dateTime: params.endDateTime, timeZone: "Europe/Zurich" };
        const putResp = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${params.eventId}`, { method: "PUT", headers, body: JSON.stringify(patch) });
        const putData = await putResp.json() as { summary?: string };
        return `Termin "${putData.summary}" wurde aktualisiert.`;
      }
    }
    if (action === "get_event") {
      // Termin-ID aus Kontext suchen (letzter Termin aus list_events)
      const tMin = (params.timeMin as string) ?? new Date().toISOString();
      const tMax = (params.timeMax as string) ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const resp = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?singleEvents=true&orderBy=startTime&maxResults=50&timeMin=${encodeURIComponent(tMin)}&timeMax=${encodeURIComponent(tMax)}`, { headers });
      const data = await resp.json() as { items?: Array<{ id: string; summary?: string; start?: { dateTime?: string; date?: string }; attendees?: Array<{ email: string; displayName?: string }> }> };
      const keyword = (params.keyword as string ?? "").toLowerCase();
      const found = data.items?.find(ev => (ev.summary ?? "").toLowerCase().includes(keyword));
      if (!found) return `Kein Termin mit "${params.keyword}" gefunden.`;
      const attendees = found.attendees?.map(a => a.displayName ?? a.email).join(", ") ?? "keine";
      return `Termin gefunden: "${found.summary}" (ID: ${found.id})\nTeilnehmer: ${attendees}`;
    }
    return `Unbekannte Aktion: "${action}". Verfügbar: list_events, create_event, update_event, delete_event, invite_attendee, get_event.`;
  } catch (err) { return `Kalender-Fehler: ${err instanceof Error ? err.message : String(err)}`; }
}

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

  // ─── tRPC-basierte Chat-Mutation (kein SSE, funktioniert in Produktion) ──────
  sendMessage: protectedProcedure
    .input(z.object({
      conversationId: z.number(),
      message: z.string(),
      fileUrl: z.string().optional(),
      fileName: z.string().optional(),
      searchResults: z.array(z.object({ title: z.string(), snippet: z.string(), url: z.string() })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { conversationId, message, fileUrl, fileName, searchResults } = input;
      const userId = ctx.user.id;

      const conv = await getConversationById(conversationId);
      if (!conv || conv.userId !== userId) throw new TRPCError({ code: "FORBIDDEN" });

      const history = await getMessagesByConversation(conversationId);

      // Benutzer-Nachricht speichern
      await addMessage({ conversationId, role: "user", content: message, fileUrl: fileUrl ?? null, fileName: fileName ?? null });

      // Kalender-Kontext laden
      let calendarContext = "";
      try {
        const upcoming = await executeCalendarAction(userId, "list_events", { timeMin: new Date().toISOString(), timeMax: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() });
        if (!upcoming.includes("nicht verbunden") && !upcoming.includes("Keine Termine")) calendarContext = `\n\nDeine nächsten Termine (7 Tage):\n${upcoming}`;
      } catch { /* ignorieren */ }

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
          const lines = Object.entries(grouped).map(([cat, items]) => `[${cat}]\n${items.join("\n")}`).join("\n\n");
          memoryContext = `\n\nGespeichertes Wissen über den Nutzer:\n${lines}`;
        }
      } catch { /* ignorieren */ }

      // Nutzerprofil laden
      let profileContext = "";
      try {
        const profile = await getUserProfile(userId);
        if (profile) {
          const parts: string[] = [];
          if (profile.displayName) parts.push(`Name des Nutzers: ${profile.displayName}`);
          if (profile.occupation) parts.push(`Beruf: ${profile.occupation}`);
          if (profile.location) parts.push(`Standort: ${profile.location}`);
          if (profile.interests) parts.push(`Interessen/Hobbys: ${profile.interests}`);
          if (profile.workContext) parts.push(`Beruflicher Kontext: ${profile.workContext}`);
          if (profile.personalNotes) parts.push(`Persönliche Notizen: ${profile.personalNotes}`);
          if (parts.length > 0) profileContext = `

Nutzerprofil:
${parts.join("\n")}`;
          // Anredeform und Jarvis-Name
          const jarvisName = profile.jarvisName ?? "Jarvis";
          const addressForm = profile.addressForm ?? "sir";
          const addressStr = addressForm === "sir" ? "Spreche den Nutzer mit 'Sir' an" : addressForm === "du" ? `Spreche den Nutzer mit '${profile.displayName ?? "du"}' an` : `Spreche den Nutzer mit '${profile.displayName ?? "du"}' an`;
          const personalityStr = profile.jarvisPersonality ? `\n\nPersönlichkeit: ${profile.jarvisPersonality}` : "";
          const langStr = profile.language === "en" ? "Antworte auf Englisch." : profile.language === "auto" ? "Antworte in der Sprache des Nutzers." : "Antworte auf Deutsch.";
          const systemPrompt = `Du bist ${jarvisName}, ein hochintelligenter, freundlicher und äußerst kompetenter persönlicher KI-Assistent. ${addressStr}.
${langStr} Präzise, hilfreich und mit einem leicht professionellen Ton – ähnlich wie der Jarvis aus Iron Man.
Du kannst Dateien analysieren, Web-Suchergebnisse verarbeiten, Notizen, Aufgaben und den Google Kalender verwalten. Du hast ein dauerhaftes Gedächtnis.${personalityStr}
Heute ist der ${new Date().toLocaleDateString("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`;
          // Weiter mit dem Rest des System-Prompts (Kalender/Gedächtnis-Aktionen)
          const grossIctContext = `

GROSS ICT ASSISTENT: Stefan betreibt im Nebenerwerb die Firma Gross ICT (gross-ict.ch) in Zell, Luzern.
Leistungen: Webseiten (ab CHF 1'500), Web-Apps (ab CHF 15'000), Mobile Apps (ab CHF 20'000), IT-Support, Netzwerk, Security, Server – für KMU in der Zentralschweiz.
Wenn Stefan Hilfe zu Gross ICT braucht (Angebote, Texte, Kundenprojekte), kannst du helfen. Verwende immer CHF (nicht €) und Schweizer Schreibweise (ss statt ß).`;
          const fullSystemPrompt = systemPrompt + grossIctContext + `

KALENDER: Wenn der Nutzer Kalender-Aktionen möchte, füge am Ende deiner Antwort GENAU EINEN Aktionsblock ein:
<calendar_action>{"action":"list_events","timeMin":"ISO8601","timeMax":"ISO8601"}</calendar_action>
<calendar_action>{"action":"create_event","summary":"Titel","startDateTime":"2026-08-10T14:00:00","endDateTime":"2026-08-10T15:00:00","description":"","location":""}</calendar_action>
<calendar_action>{"action":"update_event","eventId":"ID","summary":"neuer Titel"}</calendar_action>
<calendar_action>{"action":"delete_event","eventId":"ID"}</calendar_action>
<calendar_action>{"action":"invite_attendee","eventId":"ID","email":"person@example.com"}</calendar_action>
<calendar_action>{"action":"get_event","keyword":"Suchbegriff"}</calendar_action>
WICHTIG: Zeige dem Nutzer NIE den rohen Aktionsblock.

GEDÄCHTNIS: Wenn der Nutzer wichtige Informationen mitteilt, speichere sie:
<memory_action>{"category":"person","key":"Bine E-Mail","value":"bine@example.com"}</memory_action>
Kategorien: person, contact, preference, project, fact. Zeige dem Nutzer NIE den rohen memory_action-Block.

APP (Gross ICT ERP/CRM): Stefan hat eine eigene App mit Kunden, Angeboten, Rechnungen, Tickets, Projekten, Leads, Verträgen, Ausgaben und Produkten.
Wenn Stefan etwas aus seiner App möchte, füge am Ende deiner Antwort GENAU EINEN app_action-Block ein.
Verfügbare Aktionen (Beispiele):

LESEN:
<app_action>{"action":"dashboard"}</app_action>
<app_action>{"action":"list_customers","search":"Muster"}</app_action>
<app_action>{"action":"list_tickets","status":"open"}</app_action>
<app_action>{"action":"list_quotes","status":"draft"}</app_action>
<app_action>{"action":"list_invoices","status":"open"}</app_action>  // offen = open + sent
<app_action>{"action":"list_overdue_invoices"}</app_action>
<app_action>{"action":"list_projects","status":"active"}</app_action>
<app_action>{"action":"list_leads"}</app_action>
<app_action>{"action":"list_contracts"}</app_action>
<app_action>{"action":"list_expenses"}</app_action>
<app_action>{"action":"list_products"}</app_action>
<app_action>{"action":"list_project_tasks","project_id":"uuid-hier"}</app_action>

ERSTELLEN:
<app_action>{"action":"create_customer","company_name":"Muster AG","email":"info@muster.ch","phone":"+41 41 xxx"}</app_action>
<app_action>{"action":"create_ticket","title":"Problem mit Drucker","description":"Drucker druckt nicht","priority":"medium"}</app_action>
<app_action>{"action":"create_lead","name":"Max Muster","company":"Muster AG","email":"max@muster.ch","value":5000}</app_action>
<app_action>{"action":"create_project","title":"Webseite Muster AG","customer_id":"uuid","budget":3500}</app_action>
<app_action>{"action":"create_project_task","project_id":"uuid","title":"Design erstellen","priority":"high"}</app_action>
<app_action>{"action":"create_expense","description":"Büromaterial","amount":45.80,"category":"Büro","supplier":"Migros"}</app_action>
<app_action>{"action":"create_quote","customer_id":"uuid","notes":"Angebot Webseite","items":[{"description":"Webseite Design","quantity":1,"unit_price":1500},{"description":"Hosting Setup","quantity":1,"unit_price":200}]}</app_action>
<app_action>{"action":"create_invoice","customer_id":"uuid","items":[{"description":"IT-Support Mai","quantity":5,"unit_price":120,"unit":"Std."}]}</app_action>

ÄNDERN:
<app_action>{"action":"update_ticket_status","id":"uuid","status":"closed"}</app_action>
<app_action>{"action":"update_ticket_priority","id":"uuid","priority":"high"}</app_action>
<app_action>{"action":"add_ticket_comment","ticket_id":"uuid","comment":"Problem wurde behoben","is_internal":false}</app_action>
<app_action>{"action":"mark_invoice_paid","id":"uuid"}</app_action>
<app_action>{"action":"update_lead_status","id":"uuid","status":"qualified"}</app_action>
<app_action>{"action":"update_quote_status","id":"uuid","status":"sent"}</app_action>

WICHTIG: Zeige dem Nutzer NIE den rohen app_action-Block. Führe die Aktion aus und zeige das Ergebnis natürlich in der Antwort.
STATUS-WERTE in der App:
- Rechnungen: open (offen), sent (gesendet), paid (bezahlt), draft (Entwurf)
- Offene/unbezahlte Rechnungen = status "open" (der Filter deckt open+sent ab)
- Tickets: open, in_progress, resolved, closed
- Angebote: draft, sent, accepted, rejected
- Projekte: active, completed, on_hold, cancelled
- Leads: new, contacted, qualified, proposal, won, lost
Wenn du eine ID brauchst, frage zuerst nach dem Kunden/Ticket/Projekt und nutze dann die zurückgegebene ID.
${profileContext}${calendarContext}${memoryContext}`;

          // LLM aufrufen mit Profil-Kontext
          type LLMMessage = { role: "system" | "user" | "assistant"; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> };
          const llmMessages2: LLMMessage[] = [
            { role: "system", content: fullSystemPrompt },
            ...history.map((m) => ({ role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant", content: m.content })),
          ];
          let userContent2: string | Array<{ type: string; text?: string; image_url?: { url: string } }> = message;
          if (searchResults && searchResults.length > 0) {
            const ctxStr = searchResults.map((r) => `**${r.title}**: ${r.snippet} (${r.url})`).join("\n");
            userContent2 = `${message}\n\n[Web-Suchergebnisse:\n${ctxStr}]`;
          }
          if (fileUrl && fileName) {
            const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
            const isImage = ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);
            const baseUrl = ENV.forgeApiUrl?.replace("/v1", "") ?? "";
            const absUrl = fileUrl.startsWith("http") ? fileUrl : `${baseUrl}${fileUrl}`;
            if (isImage) {
              userContent2 = [{ type: "image_url", image_url: { url: absUrl } }, { type: "text", text: typeof userContent2 === "string" ? userContent2 || `Analysiere dieses Bild: ${fileName}` : message }];
            } else {
              let fileContent = "";
              try { const fr = await fetch(absUrl); if (fr.ok) { fileContent = await fr.text(); if (fileContent.length > 8000) fileContent = fileContent.slice(0, 8000) + "\n...[gekürzt]"; } } catch { /* ignorieren */ }
              userContent2 = fileContent ? `${typeof userContent2 === "string" ? userContent2 : message}\n\n[Dateiinhalt von ${fileName}:\n\`\`\`\n${fileContent}\n\`\`\`]` : `${typeof userContent2 === "string" ? userContent2 : message}\n\n[Datei: ${fileName}]`;
            }
          }
          llmMessages2.push({ role: "user", content: userContent2 as string });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const llmResp2 = await invokeLLM({ model: "claude-sonnet-4-5", max_tokens: 4096, messages: llmMessages2 as any });
          let fullResponse2 = (llmResp2.choices[0]?.message?.content as string) ?? "";
          // calendar_action und memory_action verarbeiten
          const calActionRegex = /<calendar_action>([\s\S]*?)<\/calendar_action>/g;
          let calMatch2;
          let calResults2 = "";
          while ((calMatch2 = calActionRegex.exec(fullResponse2)) !== null) {
            try {
              const calParams = JSON.parse(calMatch2[1]);
              const calResult = await executeCalendarAction(userId, calParams.action, calParams);
              calResults2 += `

**Kalender:** ${calResult}`;
            } catch { /* ignorieren */ }
          }
          fullResponse2 = fullResponse2.replace(/<calendar_action>[\s\S]*?<\/calendar_action>/g, "").trim();
          if (calResults2) fullResponse2 += calResults2;
          const memActionRegex = /<memory_action>([\s\S]*?)<\/memory_action>/g;
          let memMatch2;
          while ((memMatch2 = memActionRegex.exec(fullResponse2)) !== null) {
            try {
              const memParams = JSON.parse(memMatch2[1]);
              if (memParams.key && memParams.value) await upsertMemory(userId, memParams.category ?? "fact", memParams.key, memParams.value, "chat");
            } catch { /* ignorieren */ }
          }
          fullResponse2 = fullResponse2.replace(/<memory_action>[\s\S]*?<\/memory_action>/g, "").trim();
          const convTitle = fullResponse2.slice(0, 50).replace(/[\n]/g, " ").trim();
          if (history.length === 0) await updateConversationTitle(conversationId, convTitle || message.slice(0, 50));
          await addMessage({ conversationId, role: "assistant", content: fullResponse2 });
          return { response: fullResponse2 };
        }
      } catch (e) {
        console.error("[Profile] Fehler beim Laden:", e);
      }

      // Fallback ohne Profil
      const systemPrompt = `Du bist Jarvis, ein hochintelligenter, freundlicher und äußerst kompetenter persönlicher KI-Assistent.
Du antwortest immer auf Deutsch, präzise, hilfreich und mit einem leicht professionellen Ton – ähnlich wie der Jarvis aus Iron Man.
Du kannst Dateien analysieren, Web-Suchergebnisse verarbeiten, Notizen, Aufgaben und den Google Kalender verwalten. Du hast ein dauerhaftes Gedächtnis.
Heute ist der ${new Date().toLocaleDateString("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.

KALENDER: Wenn der Nutzer Kalender-Aktionen möchte, füge am Ende deiner Antwort GENAU EINEN Aktionsblock ein:
<calendar_action>{"action":"list_events","timeMin":"ISO8601","timeMax":"ISO8601"}</calendar_action>
<calendar_action>{"action":"create_event","summary":"Titel","startDateTime":"2026-08-10T14:00:00","endDateTime":"2026-08-10T15:00:00","description":"","location":""}</calendar_action>
<calendar_action>{"action":"update_event","eventId":"ID","summary":"neuer Titel"}</calendar_action>
<calendar_action>{"action":"delete_event","eventId":"ID"}</calendar_action>
<calendar_action>{"action":"invite_attendee","eventId":"ID","email":"person@example.com"}</calendar_action>
<calendar_action>{"action":"get_event","keyword":"Suchbegriff"}</calendar_action>
WICHTIG: Zeige dem Nutzer NIE den rohen Aktionsblock.

GEDÄCHTNIS: Wenn der Nutzer wichtige Informationen mitteilt, speichere sie:
<memory_action>{"category":"person","key":"Bine E-Mail","value":"bine@example.com"}</memory_action>
Kategorien: person, contact, preference, project, fact. Zeige dem Nutzer NIE den rohen memory_action-Block.

APP (Gross ICT ERP/CRM): Stefan hat eine eigene App mit Kunden, Angeboten, Rechnungen, Tickets, Projekten, Leads, Verträgen, Ausgaben und Produkten.
Wenn Stefan etwas aus seiner App möchte, füge am Ende deiner Antwort GENAU EINEN app_action-Block ein.
Verfügbare Aktionen (Beispiele):

LESEN:
<app_action>{"action":"dashboard"}</app_action>
<app_action>{"action":"list_customers","search":"Muster"}</app_action>
<app_action>{"action":"list_tickets","status":"open"}</app_action>
<app_action>{"action":"list_quotes","status":"draft"}</app_action>
<app_action>{"action":"list_invoices","status":"open"}</app_action>  // offen = open + sent
<app_action>{"action":"list_overdue_invoices"}</app_action>
<app_action>{"action":"list_projects","status":"active"}</app_action>
<app_action>{"action":"list_leads"}</app_action>
<app_action>{"action":"list_contracts"}</app_action>
<app_action>{"action":"list_expenses"}</app_action>
<app_action>{"action":"list_products"}</app_action>
<app_action>{"action":"list_project_tasks","project_id":"uuid-hier"}</app_action>

ERSTELLEN:
<app_action>{"action":"create_customer","company_name":"Muster AG","email":"info@muster.ch","phone":"+41 41 xxx"}</app_action>
<app_action>{"action":"create_ticket","title":"Problem mit Drucker","description":"Drucker druckt nicht","priority":"medium"}</app_action>
<app_action>{"action":"create_lead","name":"Max Muster","company":"Muster AG","email":"max@muster.ch","value":5000}</app_action>
<app_action>{"action":"create_project","title":"Webseite Muster AG","customer_id":"uuid","budget":3500}</app_action>
<app_action>{"action":"create_project_task","project_id":"uuid","title":"Design erstellen","priority":"high"}</app_action>
<app_action>{"action":"create_expense","description":"Büromaterial","amount":45.80,"category":"Büro","supplier":"Migros"}</app_action>
<app_action>{"action":"create_quote","customer_id":"uuid","notes":"Angebot Webseite","items":[{"description":"Webseite Design","quantity":1,"unit_price":1500},{"description":"Hosting Setup","quantity":1,"unit_price":200}]}</app_action>
<app_action>{"action":"create_invoice","customer_id":"uuid","items":[{"description":"IT-Support Mai","quantity":5,"unit_price":120,"unit":"Std."}]}</app_action>

ÄNDERN:
<app_action>{"action":"update_ticket_status","id":"uuid","status":"closed"}</app_action>
<app_action>{"action":"update_ticket_priority","id":"uuid","priority":"high"}</app_action>
<app_action>{"action":"add_ticket_comment","ticket_id":"uuid","comment":"Problem wurde behoben","is_internal":false}</app_action>
<app_action>{"action":"mark_invoice_paid","id":"uuid"}</app_action>
<app_action>{"action":"update_lead_status","id":"uuid","status":"qualified"}</app_action>
<app_action>{"action":"update_quote_status","id":"uuid","status":"sent"}</app_action>

WICHTIG: Zeige dem Nutzer NIE den rohen app_action-Block. Führe die Aktion aus und zeige das Ergebnis natürlich in der Antwort.
STATUS-WERTE in der App:
- Rechnungen: open (offen), sent (gesendet), paid (bezahlt), draft (Entwurf)
- Offene/unbezahlte Rechnungen = status "open" (der Filter deckt open+sent ab)
- Tickets: open, in_progress, resolved, closed
- Angebote: draft, sent, accepted, rejected
- Projekte: active, completed, on_hold, cancelled
- Leads: new, contacted, qualified, proposal, won, lost
Wenn du eine ID brauchst, frage zuerst nach dem Kunden/Ticket/Projekt und nutze dann die zurückgegebene ID.
${calendarContext}${memoryContext}`;

      type LLMMessage = { role: "system" | "user" | "assistant"; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> };
      const llmMessages: LLMMessage[] = [
        { role: "system", content: systemPrompt },
        ...history.map((m) => ({ role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant", content: m.content })),
      ];

      // Aktuelle Nachricht aufbauen
      let userContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }> = message;
      if (searchResults && searchResults.length > 0) {
        const ctxStr = searchResults.map((r) => `**${r.title}**: ${r.snippet} (${r.url})`).join("\n");
        userContent = `${message}\n\n[Web-Suchergebnisse:\n${ctxStr}]`;
      }
      if (fileUrl && fileName) {
        const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
        const isImage = ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);
        const baseUrl = ENV.forgeApiUrl?.replace("/v1", "") ?? "";
        const absUrl = fileUrl.startsWith("http") ? fileUrl : `${baseUrl}${fileUrl}`;
        if (isImage) {
          userContent = [{ type: "image_url", image_url: { url: absUrl } }, { type: "text", text: typeof userContent === "string" ? userContent || `Analysiere dieses Bild: ${fileName}` : message }];
        } else {
          let fileContent = "";
          try { const fr = await fetch(absUrl); if (fr.ok) { fileContent = await fr.text(); if (fileContent.length > 8000) fileContent = fileContent.slice(0, 8000) + "\n...[gekürzt]"; } } catch { /* ignorieren */ }
          userContent = fileContent ? `${typeof userContent === "string" ? userContent : message}\n\n[Dateiinhalt von ${fileName}:\n\`\`\`\n${fileContent}\n\`\`\`]` : `${typeof userContent === "string" ? userContent : message}\n\n[Datei: ${fileName}]`;
        }
      }
      llmMessages.push({ role: "user", content: userContent as string });

      // LLM aufrufen (nicht-streaming)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const llmResp = await invokeLLM({ model: "claude-sonnet-4-5", max_tokens: 4096, messages: llmMessages as any });
      let fullResponse = (llmResp.choices[0]?.message?.content as string) ?? "";

      // calendar_action-Blöcke verarbeiten
      const calMatches: RegExpExecArray[] = [];
      let cm: RegExpExecArray | null;
      const calRx = /<calendar_action>([\s\S]*?)<\/calendar_action>/g;
      while ((cm = calRx.exec(fullResponse)) !== null) calMatches.push(cm);
      let cleanResponse = fullResponse.replace(/<calendar_action>[\s\S]*?<\/calendar_action>/g, "").trim();
      const calendarResults: string[] = [];
      for (const match of calMatches) {
        try {
          const ad = JSON.parse(match[1].trim()) as Record<string, unknown>;
          const result = await executeCalendarAction(userId, ad.action as string, ad);
          calendarResults.push(result);
          cleanResponse += `\n\n**Kalender:** ${result}`;
        } catch (e) { cleanResponse += `\n\n**Kalender-Fehler:** ${e instanceof Error ? e.message : String(e)}`; }
      }

      // memory_action-Blöcke verarbeiten
      const memMatches: RegExpExecArray[] = [];
      let mm2: RegExpExecArray | null;
      const memRx = /<memory_action>([\s\S]*?)<\/memory_action>/g;
      while ((mm2 = memRx.exec(cleanResponse)) !== null) memMatches.push(mm2);
      cleanResponse = cleanResponse.replace(/<memory_action>[\s\S]*?<\/memory_action>/g, "").trim();
      for (const match of memMatches) {
        try {
          const md = JSON.parse(match[1].trim()) as { category?: string; key?: string; value?: string };
          if (md.key && md.value) await upsertMemory(userId, md.category ?? "fact", md.key, md.value, "chat");
        } catch { /* ignorieren */ }
      }

      // ── app_action-Blöcke ausführen ──────────────────────────────────────
      // Robuster Parser: auch fullResponse prüfen falls cleanResponse den Block verloren hat
      const appSource = cleanResponse.includes("<app_action>") ? cleanResponse : fullResponse;
      console.log("[AppAction] Suche in:", appSource.includes("<app_action>") ? "gefunden" : "nicht gefunden", "| cleanResponse length:", cleanResponse.length);
      const appRx2 = /<app_action>([\s\S]*?)<\/app_action>/g;
      const appM2: RegExpExecArray[] = [];
      let ax: RegExpExecArray | null;
      while ((ax = appRx2.exec(appSource)) !== null) appM2.push(ax);
      console.log("[AppAction] Matches:", appM2.length);
      cleanResponse = cleanResponse.replace(/<app_action>[\s\S]*?<\/app_action>/g, "").trim();
      for (const match of appM2) {
        try {
          const rawJson = match[1].trim();
          console.log("[AppAction] Raw JSON:", rawJson);
          const ad2 = JSON.parse(rawJson) as { action: string; [k: string]: unknown };
          const { action: appAct, ...appParams } = ad2;
          console.log("[AppAction] Executing:", appAct, appParams);
          const appResult = await executeAppAction(appAct, appParams);
          console.log("[AppAction] Result:", appResult.slice(0, 200));
          cleanResponse = cleanResponse + "\n\n" + appResult;
        } catch (e) { console.error("[AppAction sendMessage]", e); }
      }

      // Antwort speichern
      await addMessage({ conversationId, role: "assistant", content: cleanResponse });

      // Gesprächstitel generieren (nur beim ersten Austausch)
      if (history.length === 0) {
        try {
          const titleRes = await invokeLLM({ model: "claude-haiku-4-5", max_tokens: 30, messages: [{ role: "user", content: `Erstelle einen kurzen Gesprächstitel (max. 5 Wörter, kein Punkt am Ende) für diese Frage: "${message}"` }] });
          const title = titleRes.choices[0]?.message?.content;
          await updateConversationTitle(conversationId, typeof title === "string" ? title.trim() : message.slice(0, 40));
        } catch { /* optional */ }
      }

      return { response: cleanResponse, conversationId };
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

    // Kalender-Kontext laden
    let calendarContext = "";
    if (userId) {
      try {
        const upcoming = await executeCalendarAction(userId, "list_events", { timeMin: new Date().toISOString(), timeMax: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() });
        if (!upcoming.includes("nicht verbunden") && !upcoming.includes("Keine Termine")) calendarContext = `\n\nDeine nächsten Termine (7 Tage):\n${upcoming}`;
      } catch { /* ignorieren */ }
    }

    // Gedächtnis laden
    let memoryContext = "";
    if (userId) {
      try {
        const mems = await getMemoriesByUser(userId);
        if (mems.length > 0) {
          const grouped: Record<string, string[]> = {};
          for (const m of mems) {
            if (!grouped[m.category]) grouped[m.category] = [];
            grouped[m.category].push(`${m.key}: ${m.value}`);
          }
          const lines = Object.entries(grouped).map(([cat, items]) => `[${cat}]\n${items.join("\n")}`).join("\n\n");
          memoryContext = `\n\nGespeichertes Wissen über den Nutzer:\n${lines}`;
        }
      } catch { /* ignorieren */ }
    }

    const systemPrompt = `Du bist Jarvis, ein hochintelligenter, freundlicher und äußerst kompetenter persönlicher KI-Assistent.
Du antwortest immer auf Deutsch, präzise, hilfreich und mit einem leicht professionellen Ton – ähnlich wie der Jarvis aus Iron Man.
Du kannst Dateien analysieren, Web-Suchergebnisse verarbeiten, Notizen, Aufgaben und den Google Kalender verwalten.
Heute ist der ${new Date().toLocaleDateString("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.

KALENDER: Wenn der Nutzer Kalender-Aktionen möchte, füge am Ende deiner Antwort GENAU EINEN Aktionsblock ein (kein sichtbarer XML-Block für den Nutzer):
<calendar_action>{"action":"list_events","timeMin":"ISO8601","timeMax":"ISO8601"}</calendar_action>
<calendar_action>{"action":"create_event","summary":"Titel","startDateTime":"2026-08-10T14:00:00","endDateTime":"2026-08-10T15:00:00","description":"","location":""}</calendar_action>
<calendar_action>{"action":"update_event","eventId":"ID","summary":"neuer Titel","startDateTime":"ISO","endDateTime":"ISO"}</calendar_action>
<calendar_action>{"action":"delete_event","eventId":"ID"}</calendar_action>
<calendar_action>{"action":"invite_attendee","eventId":"ID","email":"person@example.com"}</calendar_action>
<calendar_action>{"action":"get_event","keyword":"Suchbegriff"}</calendar_action>
WICHTIG: Wenn du eine eventId brauchst (für update/delete/invite), nutze zuerst get_event um die ID zu finden, dann führe die gewünschte Aktion aus. Zeige dem Nutzer NIE den rohen Aktionsblock.

GEDÄCHTNIS: Wenn der Nutzer wichtige Informationen mitteilt (Namen, E-Mail, Telefon, Präferenzen, Fakten über Personen oder Projekte), speichere sie mit einem memory_action-Block am Ende deiner Antwort:
<memory_action>{"category":"person","key":"Bine E-Mail","value":"bine@example.com"}</memory_action>
<memory_action>{"category":"preference","key":"Lieblingsfarbe","value":"Blau"}</memory_action>
Kategorien: person, contact, preference, project, fact. Speichere NUR wenn der Nutzer explizit eine Information mitteilt. Zeige dem Nutzer NIE den rohen memory_action-Block.
${calendarContext}${memoryContext}`;

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
      // ── calendar_action-Blöcke aus Antwort herausfiltern und ausführen ──────
      const calActionRegex = /<calendar_action>([\s\S]*?)<\/calendar_action>/g;
      const calMatches: RegExpExecArray[] = [];
      let m: RegExpExecArray | null;
      while ((m = calActionRegex.exec(fullResponse)) !== null) calMatches.push(m);
      let cleanResponse = fullResponse.replace(/<calendar_action>[\s\S]*?<\/calendar_action>/g, "").trim();

      if (calMatches.length > 0 && userId) {
        for (const match of calMatches) {
          try {
            const actionData = JSON.parse(match[1].trim()) as Record<string, unknown>;
            const action = actionData.action as string;
            const result = await executeCalendarAction(userId, action, actionData);
            // Ergebnis als Extra-Chunk senden
            const resultText = `\n\n**Kalender:** ${result}`;
            cleanResponse += resultText;
            res.write(`data: ${JSON.stringify({ text: resultText })}\n\n`);
          } catch (e) {
            const errText = `\n\n**Kalender-Fehler:** ${e instanceof Error ? e.message : String(e)}`;
            cleanResponse += errText;
            res.write(`data: ${JSON.stringify({ text: errText })}\n\n`);
          }
        }
      }

      // ── memory_action-Blöcke herausfiltern und speichern ─────────────────────
      const memActionRegex = /<memory_action>([\s\S]*?)<\/memory_action>/g;
      const memMatches: RegExpExecArray[] = [];
      let mm: RegExpExecArray | null;
      while ((mm = memActionRegex.exec(cleanResponse)) !== null) memMatches.push(mm);
      cleanResponse = cleanResponse.replace(/<memory_action>[\s\S]*?<\/memory_action>/g, "").trim();

      if (memMatches.length > 0 && userId) {
        for (const match of memMatches) {
          try {
            const memData = JSON.parse(match[1].trim()) as { category?: string; key?: string; value?: string };
            if (memData.key && memData.value) {
              await upsertMemory(userId, memData.category ?? "fact", memData.key, memData.value, "chat");
            }
          } catch { /* ignorieren */ }
        }
      }

      // ── app_action-Blöcke ausführen und Ergebnis einfügen ─────────────────
      const appActionRegex = /<app_action>([\s\S]*?)<\/app_action>/g;
      const appMatches: RegExpExecArray[] = [];
      let am: RegExpExecArray | null;
      while ((am = appActionRegex.exec(cleanResponse)) !== null) appMatches.push(am);
      cleanResponse = cleanResponse.replace(/<app_action>[\s\S]*?<\/app_action>/g, "").trim();

      if (appMatches.length > 0) {
        for (const match of appMatches) {
          try {
            const actionData = JSON.parse(match[1].trim()) as { action: string; [key: string]: unknown };
            const { action, ...params } = actionData;
            const result = await executeAppAction(action, params);
            cleanResponse = cleanResponse + "\n\n" + result;
          } catch (e) {
            console.error("[AppAction] Fehler:", e);
          }
        }
      }

      // Antwort in DB speichern (ohne action-Blöcke)
      await addMessage({ conversationId, role: "assistant", content: cleanResponse });

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
