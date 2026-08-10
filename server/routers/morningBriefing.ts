import type { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { getDb } from "../db";
import { tasks, users } from "../../drizzle/schema";
import { and, eq, isNull, or, lte } from "drizzle-orm";
import { getGoogleToken, upsertGoogleToken } from "../db";
import { notifyOwner } from "../_core/notification";

// Hilfsfunktion: Google Kalender Termine für heute abrufen
async function getTodayEvents(userId: number): Promise<string[]> {
  try {
    const token = await getGoogleToken(userId);
    if (!token) return [];

    let accessToken = token.accessToken;
    // Token erneuern falls abgelaufen
    if (
      token.expiresAt <= Math.floor(Date.now() / 1000) + 60 &&
      token.refreshToken
    ) {
      const rr = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          refresh_token: token.refreshToken,
          grant_type: "refresh_token",
        }),
      });
      const rd = (await rr.json()) as {
        access_token?: string;
        expires_in?: number;
      };
      if (rd.access_token) {
        accessToken = rd.access_token;
        await upsertGoogleToken({
          userId,
          accessToken,
          expiresAt: Math.floor(Date.now() / 1000) + (rd.expires_in ?? 3600),
          refreshToken: token.refreshToken,
          email: token.email,
        });
      }
    }

    const tz = "Europe/Zurich";
    const now = new Date();
    // Heute 00:00 und 23:59 in Zürich-Zeit
    const todayStart = new Date(
      now.toLocaleDateString("en-CA", { timeZone: tz }) + "T00:00:00+02:00"
    );
    const todayEnd = new Date(
      now.toLocaleDateString("en-CA", { timeZone: tz }) + "T23:59:59+02:00"
    );

    const resp = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=10&timeMin=${encodeURIComponent(todayStart.toISOString())}&timeMax=${encodeURIComponent(todayEnd.toISOString())}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = (await resp.json()) as {
      items?: Array<{
        summary?: string;
        start?: { dateTime?: string; date?: string };
        organizer?: { self?: boolean; displayName?: string; email?: string };
      }>;
    };

    if (!data.items || data.items.length === 0) return [];

    return data.items.map(ev => {
      const d = new Date(ev.start?.dateTime ?? ev.start?.date ?? "");
      const timeStr = ev.start?.dateTime
        ? d.toLocaleTimeString("de-DE", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: tz,
          })
        : "Ganztägig";
      const inviteStr =
        ev.organizer && !ev.organizer.self
          ? ` (Einladung von ${ev.organizer.displayName || ev.organizer.email?.split("@")[0] || "jemanden"})`
          : "";
      return `${timeStr}: ${ev.summary ?? "Termin"}${inviteStr}`;
    });
  } catch (e) {
    console.error("[MorningBriefing] Kalender-Fehler:", e);
    return [];
  }
}

// Hilfsfunktion: Offene Aufgaben für heute abrufen
async function getTodayTasks(userId: number): Promise<string[]> {
  try {
    const db = await getDb();
    if (!db) return [];
    const now = Date.now();
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const openTasks = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          eq(tasks.completed, false),
          or(isNull(tasks.dueDate), lte(tasks.dueDate, todayEnd.getTime()))
        )
      )
      .limit(10);

    return openTasks.map(t => {
      const priority =
        t.priority === "high" ? "🔴" : t.priority === "medium" ? "🟡" : "🟢";
      return `${priority} ${t.title}`;
    });
  } catch (e) {
    console.error("[MorningBriefing] Aufgaben-Fehler:", e);
    return [];
  }
}

// Express Handler für den Heartbeat-Cron

async function getWeatherBaar(): Promise<string> {
  try {
    // Open-Meteo API – kostenlos, kein API-Key nötig
    // Baar, Kanton Zug: lat=47.1959, lon=8.5295
    const url =
      "https://api.open-meteo.com/v1/forecast?latitude=47.1959&longitude=8.5295&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&timezone=Europe%2FZurich&forecast_days=1";
    const resp = await fetch(url);
    if (!resp.ok) return "";
    const data = (await resp.json()) as {
      current: {
        temperature_2m: number;
        apparent_temperature: number;
        precipitation: number;
        weather_code: number;
        wind_speed_10m: number;
      };
      daily: {
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_sum: number[];
        weather_code: number[];
      };
    };
    const wc = data.current.weather_code;
    const desc =
      wc <= 1
        ? "☀️ Klar"
        : wc <= 3
          ? "⛅ Bewölkt"
          : wc <= 49
            ? "🌫️ Nebel"
            : wc <= 67
              ? "🌧️ Regen"
              : wc <= 77
                ? "❄️ Schnee"
                : wc <= 82
                  ? "🌦️ Schauer"
                  : "⛈️ Gewitter";
    const t = data.current.temperature_2m.toFixed(1);
    const tMax = data.daily.temperature_2m_max[0]?.toFixed(1) ?? "?";
    const tMin = data.daily.temperature_2m_min[0]?.toFixed(1) ?? "?";
    const wind = data.current.wind_speed_10m.toFixed(0);
    const rain = data.daily.precipitation_sum[0]?.toFixed(1) ?? "0";
    return `🌤️ **Wetter Baar:** ${desc}, ${t}°C (Min ${tMin}°C / Max ${tMax}°C), Wind ${wind} km/h${parseFloat(rain) > 0 ? `, Niederschlag ${rain} mm` : ""}`;
  } catch {
    return "";
  }
}

export async function handleMorningBriefing(req: Request, res: Response) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = await (sdk as any).authenticateRequest(req);
    if (!user.isCron) {
      return res.status(403).json({ error: "cron-only" });
    }

    // Alle Nutzer mit Google-Token holen (die den Kalender verbunden haben)
    const db = await getDb();
    if (!db) return res.json({ ok: true, skipped: "no-db" });

    // Owner-Nutzer finden (OWNER_OPEN_ID)
    const ownerOpenId = process.env.OWNER_OPEN_ID;
    if (!ownerOpenId) return res.json({ ok: true, skipped: "no-owner" });

    const ownerRows = await db
      .select()
      .from(users)
      .where(eq(users.openId, ownerOpenId))
      .limit(1);
    if (!ownerRows[0])
      return res.json({ ok: true, skipped: "owner-not-found" });

    const ownerId = ownerRows[0].id;
    const ownerName = ownerRows[0].name ?? "Stefan";

    // Termine und Aufgaben abrufen
    const [events, todayTasks] = await Promise.all([
      getTodayEvents(ownerId),
      getTodayTasks(ownerId),
    ]);

    // Zusammenfassung aufbauen
    const today = new Date().toLocaleDateString("de-DE", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Europe/Zurich",
    });

    // Anrede im Jarvis-Ton (kultiviert, britisch, «Sir»)
    let body = `Guten Morgen, Sir. Ihre Lagebeurteilung für ${today}:\n\n`;

    if (events.length > 0) {
      const kommentar =
        events.length >= 6
          ? "Ein durchaus ambitionierter Tagesplan."
          : events.length >= 4
            ? "Gut gefüllt, aber beherrschbar."
            : "";
      body += `📅 **Termine heute (${events.length}):** ${kommentar}\n${events.map(e => `• ${e}`).join("\n")}\n\n`;
    } else {
      body += `📅 Keine Termine heute, Sir. Eine Seltenheit, die man nutzen sollte.\n\n`;
    }

    if (todayTasks.length > 0) {
      body += `✅ **Offene Aufgaben (${todayTasks.length}):**\n${todayTasks.map(t => `• ${t}`).join("\n")}`;
    } else {
      body += `✅ Keine offenen Aufgaben für heute. Meinen Aufzeichnungen zufolge ein tadelloser Zustand.`;
    }

    // Benachrichtigung senden
    await notifyOwner({
      title: `☀️ Morgen-Briefing, Sir – ${today}`,
      content: body,
    });

    console.log(
      `[MorningBriefing] Briefing gesendet für ${ownerName}: ${events.length} Termine, ${todayTasks.length} Aufgaben`
    );
    res.json({ ok: true, events: events.length, tasks: todayTasks.length });
  } catch (e) {
    console.error("[MorningBriefing] Fehler:", e);
    res.status(500).json({ error: String(e) });
  }
}
