import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getGoogleToken,
  upsertGoogleToken,
  deleteGoogleToken,
  getMicrosoftToken,
  upsertMicrosoftToken,
  deleteMicrosoftToken,
} from "../db";
import { getGoogleRedirectUri, getMsRedirectUri } from "../_core/baseUrl";

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  "email",
  "profile",
].join(" ");

const MS_SCOPES = ["Calendars.ReadWrite", "offline_access", "User.Read"].join(
  " "
);

// ─── Token-Refresh Google ─────────────────────────────────────────────────────
async function refreshGoogleAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: number }> {
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = (await resp.json()) as any;
  if (!resp.ok || !data.access_token)
    throw new Error(`Google Token-Refresh fehlgeschlagen: ${data.error}`);
  return {
    accessToken: data.access_token,
    expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
  };
}

// ─── Token-Refresh Microsoft ──────────────────────────────────────────────────
async function refreshMsAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: number }> {
  const resp = await fetch(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.MS_CLIENT_ID ?? "",
        client_secret: process.env.MS_CLIENT_SECRET ?? "",
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    }
  );
  const data = (await resp.json()) as any;
  if (!resp.ok || !data.access_token)
    throw new Error(`MS Token-Refresh fehlgeschlagen: ${data.error}`);
  return {
    accessToken: data.access_token,
    expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
  };
}

// ─── Gültiges Access-Token holen (auto-refresh) ───────────────────────────────
async function getValidGoogleAccessToken(userId: number): Promise<string> {
  const token = await getGoogleToken(userId);
  if (!token) throw new TRPCError({ code: "UNAUTHORIZED" });
  if (token.expiresAt > Math.floor(Date.now() / 1000) + 60)
    return token.accessToken;
  if (!token.refreshToken) throw new TRPCError({ code: "UNAUTHORIZED" });
  const refreshed = await refreshGoogleAccessToken(token.refreshToken);
  await upsertGoogleToken({
    userId,
    accessToken: refreshed.accessToken,
    expiresAt: refreshed.expiresAt,
    refreshToken: token.refreshToken,
    email: token.email,
  });
  return refreshed.accessToken;
}

async function getValidMsAccessToken(userId: number): Promise<string> {
  const token = await getMicrosoftToken(userId);
  if (!token) throw new TRPCError({ code: "UNAUTHORIZED" });
  if (token.expiresAt > Math.floor(Date.now() / 1000) + 60)
    return token.accessToken;
  if (!token.refreshToken) throw new TRPCError({ code: "UNAUTHORIZED" });
  const refreshed = await refreshMsAccessToken(token.refreshToken);
  await upsertMicrosoftToken({
    userId,
    accessToken: refreshed.accessToken,
    expiresAt: refreshed.expiresAt,
    refreshToken: token.refreshToken,
    email: token.email,
  });
  return refreshed.accessToken;
}

// ─── API-Aufruf Helpers ───────────────────────────────────────────────────────
async function gcalFetch(
  userId: number,
  path: string,
  options: RequestInit = {}
) {
  const accessToken = await getValidGoogleAccessToken(userId);
  const resp = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Google Calendar Fehler: ${resp.status} ${err.slice(0, 200)}`,
    });
  }
  // Manche DELETE Aufrufe haben keinen Body
  if (resp.status === 204) return {};
  return resp.json();
}

async function msFetch(
  userId: number,
  path: string,
  options: RequestInit = {}
) {
  const accessToken = await getValidMsAccessToken(userId);
  const resp = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: 'outlook.timezone="Europe/Zurich"',
      ...(options.headers ?? {}),
    },
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `MS Graph Fehler: ${resp.status} ${err.slice(0, 200)}`,
    });
  }
  if (resp.status === 204) return {};
  return resp.json();
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const calendarRouter = router({
  // Verbindungsstatus prüfen
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const gToken = await getGoogleToken(ctx.user.id);
    const msToken = await getMicrosoftToken(ctx.user.id);
    return {
      connected: !!gToken || !!msToken,
      googleConnected: !!gToken,
      googleEmail: gToken?.email ?? null,
      msConnected: !!msToken,
      msEmail: msToken?.email ?? null,
    };
  }),

  // OAuth-Login-URL generieren
  getAuthUrl: protectedProcedure.query(async ({ ctx }) => {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      redirect_uri: getGoogleRedirectUri(ctx.req),
      response_type: "code",
      scope: GOOGLE_SCOPES,
      access_type: "offline",
      prompt: "consent",
      state: JSON.stringify({ userId: ctx.user.id }),
    });
    // Base64 Encode State
    const stateB64 = Buffer.from(params.get("state")!).toString("base64");
    params.set("state", stateB64);
    return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` };
  }),

  getMsAuthUrl: protectedProcedure.query(async ({ ctx }) => {
    const params = new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID ?? "",
      redirect_uri: getMsRedirectUri(ctx.req),
      response_type: "code",
      scope: MS_SCOPES,
      state: JSON.stringify({ userId: ctx.user.id }),
    });
    // Base64 Encode State
    const stateB64 = Buffer.from(params.get("state")!).toString("base64");
    params.set("state", stateB64);
    return {
      url: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`,
    };
  }),

  // Verbindung trennen
  disconnect: protectedProcedure.mutation(async ({ ctx }) => {
    await deleteGoogleToken(ctx.user.id);
    return { success: true };
  }),

  disconnectMs: protectedProcedure.mutation(async ({ ctx }) => {
    await deleteMicrosoftToken(ctx.user.id);
    return { success: true };
  }),

  // Kalender-Liste
  listCalendars: protectedProcedure.query(async ({ ctx }) => {
    const gToken = await getGoogleToken(ctx.user.id);
    const msToken = await getMicrosoftToken(ctx.user.id);
    const calendars: Array<{
      id: string;
      summary: string;
      primary?: boolean;
      backgroundColor?: string;
    }> = [];

    if (gToken) {
      const gData = (await gcalFetch(
        ctx.user.id,
        "/users/me/calendarList"
      )) as any;
      if (gData.items) {
        calendars.push(
          ...gData.items.map((c: any) => ({
            id: `google:${c.id}`,
            summary: c.summary,
            primary: c.primary,
            backgroundColor: c.backgroundColor,
          }))
        );
      }
    }

    if (msToken) {
      const msData = (await msFetch(ctx.user.id, "/me/calendars")) as any;
      if (msData.value) {
        calendars.push(
          ...msData.value.map((c: any) => ({
            id: `ms:${c.id}`,
            summary: c.name,
            primary: c.isDefaultCalendar,
            backgroundColor: c.hexColor,
          }))
        );
      }
    }

    return calendars;
  }),

  // Termine abrufen
  listEvents: protectedProcedure
    .input(
      z.object({
        calendarId: z.string().default("google:primary"),
        timeMin: z.string().optional(), // ISO 8601
        timeMax: z.string().optional(),
        maxResults: z.number().default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const isMs = input.calendarId.startsWith("ms:");
      const rawCalId = input.calendarId.replace(/^(google:|ms:)/, "");

      if (isMs) {
        const query: string[] = [
          `$top=${input.maxResults}`,
          `$orderby=start/dateTime`,
        ];
        if (input.timeMin || input.timeMax) {
          const filters: string[] = [];
          if (input.timeMin)
            filters.push(`start/dateTime ge '${input.timeMin}'`);
          if (input.timeMax) filters.push(`end/dateTime le '${input.timeMax}'`);
          query.push(`$filter=${filters.join(" and ")}`);
        }
        const data = (await msFetch(
          ctx.user.id,
          `/me/calendars/${encodeURIComponent(rawCalId)}/events?${query.join("&")}`
        )) as any;

        return (data.value ?? []).map((e: any) => ({
          id: e.id,
          summary: e.subject,
          description: e.bodyPreview,
          start: {
            dateTime: e.start?.dateTime ? e.start.dateTime + "Z" : undefined,
          },
          end: { dateTime: e.end?.dateTime ? e.end.dateTime + "Z" : undefined },
          location: e.location?.displayName,
          htmlLink: e.webLink,
        }));
      } else {
        const params = new URLSearchParams({
          singleEvents: "true",
          orderBy: "startTime",
          maxResults: String(input.maxResults),
          ...(input.timeMin ? { timeMin: input.timeMin } : {}),
          ...(input.timeMax ? { timeMax: input.timeMax } : {}),
        });
        const data = (await gcalFetch(
          ctx.user.id,
          `/calendars/${encodeURIComponent(rawCalId)}/events?${params}`
        )) as any;
        return data.items ?? [];
      }
    }),

  // Termin erstellen
  createEvent: protectedProcedure
    .input(
      z.object({
        calendarId: z.string().default("google:primary"),
        summary: z.string(),
        description: z.string().optional(),
        location: z.string().optional(),
        startDateTime: z.string(), // ISO 8601
        endDateTime: z.string(),
        timeZone: z.string().default("Europe/Zurich"),
        allDay: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const isMs = input.calendarId.startsWith("ms:");
      const rawCalId = input.calendarId.replace(/^(google:|ms:)/, "");

      if (isMs) {
        const msEvent = {
          subject: input.summary,
          body: { contentType: "text", content: input.description ?? "" },
          location: { displayName: input.location ?? "" },
          start: { dateTime: input.startDateTime, timeZone: input.timeZone },
          end: { dateTime: input.endDateTime, timeZone: input.timeZone },
          isAllDay: input.allDay,
        };
        const data = (await msFetch(
          ctx.user.id,
          `/me/calendars/${encodeURIComponent(rawCalId)}/events`,
          { method: "POST", body: JSON.stringify(msEvent) }
        )) as any;
        return { id: data.id, summary: data.subject, htmlLink: data.webLink };
      } else {
        const gEvent = {
          summary: input.summary,
          description: input.description,
          location: input.location,
          start: input.allDay
            ? { date: input.startDateTime.split("T")[0] }
            : { dateTime: input.startDateTime, timeZone: input.timeZone },
          end: input.allDay
            ? { date: input.endDateTime.split("T")[0] }
            : { dateTime: input.endDateTime, timeZone: input.timeZone },
        };
        const data = (await gcalFetch(
          ctx.user.id,
          `/calendars/${encodeURIComponent(rawCalId)}/events`,
          { method: "POST", body: JSON.stringify(gEvent) }
        )) as any;
        return { id: data.id, summary: data.summary, htmlLink: data.htmlLink };
      }
    }),

  // Termin bearbeiten
  updateEvent: protectedProcedure
    .input(
      z.object({
        calendarId: z.string().default("google:primary"),
        eventId: z.string(),
        summary: z.string().optional(),
        description: z.string().optional(),
        location: z.string().optional(),
        startDateTime: z.string().optional(),
        endDateTime: z.string().optional(),
        timeZone: z.string().default("Europe/Zurich"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const isMs = input.calendarId.startsWith("ms:");
      const rawCalId = input.calendarId.replace(/^(google:|ms:)/, "");

      if (isMs) {
        const patch: Record<string, any> = {};
        if (input.summary) patch.subject = input.summary;
        if (input.description !== undefined)
          patch.body = { contentType: "text", content: input.description };
        if (input.location !== undefined)
          patch.location = { displayName: input.location };
        if (input.startDateTime)
          patch.start = {
            dateTime: input.startDateTime,
            timeZone: input.timeZone,
          };
        if (input.endDateTime)
          patch.end = { dateTime: input.endDateTime, timeZone: input.timeZone };

        return msFetch(
          ctx.user.id,
          `/me/calendars/${encodeURIComponent(rawCalId)}/events/${input.eventId}`,
          { method: "PATCH", body: JSON.stringify(patch) }
        );
      } else {
        const current = (await gcalFetch(
          ctx.user.id,
          `/calendars/${encodeURIComponent(rawCalId)}/events/${input.eventId}`
        )) as any;
        const patch: Record<string, any> = { ...current };
        if (input.summary) patch.summary = input.summary;
        if (input.description !== undefined)
          patch.description = input.description;
        if (input.location !== undefined) patch.location = input.location;
        if (input.startDateTime)
          patch.start = {
            dateTime: input.startDateTime,
            timeZone: input.timeZone,
          };
        if (input.endDateTime)
          patch.end = { dateTime: input.endDateTime, timeZone: input.timeZone };
        return gcalFetch(
          ctx.user.id,
          `/calendars/${encodeURIComponent(rawCalId)}/events/${input.eventId}`,
          { method: "PUT", body: JSON.stringify(patch) }
        );
      }
    }),

  // Termin löschen
  deleteEvent: protectedProcedure
    .input(
      z.object({
        calendarId: z.string().default("google:primary"),
        eventId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const isMs = input.calendarId.startsWith("ms:");
      const rawCalId = input.calendarId.replace(/^(google:|ms:)/, "");

      if (isMs) {
        await msFetch(
          ctx.user.id,
          `/me/calendars/${encodeURIComponent(rawCalId)}/events/${input.eventId}`,
          { method: "DELETE" }
        );
      } else {
        await gcalFetch(
          ctx.user.id,
          `/calendars/${encodeURIComponent(rawCalId)}/events/${input.eventId}`,
          { method: "DELETE" }
        );
      }
      return { success: true };
    }),
});
