import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getGoogleToken, upsertGoogleToken, deleteGoogleToken } from "../db";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI =
  "https://jarvisai-h2rxxjj4.manus.space/api/oauth/google/callback";
const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  "email",
  "profile",
].join(" ");

// ─── Token-Refresh ────────────────────────────────────────────────────────────
async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: number }> {
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = (await resp.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!resp.ok || !data.access_token)
    throw new Error(`Token-Refresh fehlgeschlagen: ${data.error}`);
  return {
    accessToken: data.access_token,
    expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
  };
}

// ─── Gültiges Access-Token holen (auto-refresh) ───────────────────────────────
async function getValidAccessToken(userId: number): Promise<string> {
  const token = await getGoogleToken(userId);
  if (!token)
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Google Kalender nicht verbunden. Bitte zuerst verbinden.",
    });

  // Token noch gültig (60s Puffer)?
  if (token.expiresAt > Math.floor(Date.now() / 1000) + 60) {
    return token.accessToken;
  }

  // Refresh
  if (!token.refreshToken)
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Kein Refresh-Token. Bitte Google Kalender neu verbinden.",
    });
  const refreshed = await refreshAccessToken(token.refreshToken);
  await upsertGoogleToken({
    userId,
    accessToken: refreshed.accessToken,
    expiresAt: refreshed.expiresAt,
    refreshToken: token.refreshToken,
    email: token.email,
  });
  return refreshed.accessToken;
}

// ─── Google Calendar API-Aufruf ───────────────────────────────────────────────
async function gcalFetch(
  userId: number,
  path: string,
  options: RequestInit = {}
) {
  const accessToken = await getValidAccessToken(userId);
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
  return resp.json();
}

export const calendarRouter = router({
  // Verbindungsstatus prüfen
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const token = await getGoogleToken(ctx.user.id);
    return {
      connected: !!token,
      email: token?.email ?? null,
    };
  }),

  // OAuth-Login-URL generieren
  getAuthUrl: protectedProcedure.query(async ({ ctx }) => {
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: SCOPES,
      access_type: "offline",
      prompt: "consent",
      state: String(ctx.user.id),
    });
    return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` };
  }),

  // Verbindung trennen
  disconnect: protectedProcedure.mutation(async ({ ctx }) => {
    await deleteGoogleToken(ctx.user.id);
    return { success: true };
  }),

  // Kalender-Liste
  listCalendars: protectedProcedure.query(async ({ ctx }) => {
    const data = (await gcalFetch(ctx.user.id, "/users/me/calendarList")) as {
      items?: Array<{
        id: string;
        summary: string;
        primary?: boolean;
        backgroundColor?: string;
      }>;
    };
    return data.items ?? [];
  }),

  // Termine abrufen
  listEvents: protectedProcedure
    .input(
      z.object({
        calendarId: z.string().default("primary"),
        timeMin: z.string().optional(), // ISO 8601
        timeMax: z.string().optional(),
        maxResults: z.number().default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const params = new URLSearchParams({
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: String(input.maxResults),
        ...(input.timeMin ? { timeMin: input.timeMin } : {}),
        ...(input.timeMax ? { timeMax: input.timeMax } : {}),
      });
      const data = (await gcalFetch(
        ctx.user.id,
        `/calendars/${encodeURIComponent(input.calendarId)}/events?${params}`
      )) as {
        items?: Array<{
          id: string;
          summary?: string;
          description?: string;
          start?: { dateTime?: string; date?: string };
          end?: { dateTime?: string; date?: string };
          location?: string;
          status?: string;
          htmlLink?: string;
          colorId?: string;
        }>;
      };
      return data.items ?? [];
    }),

  // Termin erstellen
  createEvent: protectedProcedure
    .input(
      z.object({
        calendarId: z.string().default("primary"),
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
      const event = {
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
      const data = await gcalFetch(
        ctx.user.id,
        `/calendars/${encodeURIComponent(input.calendarId)}/events`,
        {
          method: "POST",
          body: JSON.stringify(event),
        }
      );
      return data as { id: string; summary: string; htmlLink: string };
    }),

  // Termin bearbeiten
  updateEvent: protectedProcedure
    .input(
      z.object({
        calendarId: z.string().default("primary"),
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
      // Erst aktuellen Termin laden
      const current = (await gcalFetch(
        ctx.user.id,
        `/calendars/${encodeURIComponent(input.calendarId)}/events/${input.eventId}`
      )) as Record<string, unknown>;
      const patch: Record<string, unknown> = { ...current };
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
        `/calendars/${encodeURIComponent(input.calendarId)}/events/${input.eventId}`,
        {
          method: "PUT",
          body: JSON.stringify(patch),
        }
      );
    }),

  // Termin löschen
  deleteEvent: protectedProcedure
    .input(
      z.object({
        calendarId: z.string().default("primary"),
        eventId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/events/${input.eventId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${await getValidAccessToken(ctx.user.id)}`,
          },
        }
      );
      return { success: true };
    }),
});
