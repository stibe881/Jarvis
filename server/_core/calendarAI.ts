import { getGoogleTokens, getMicrosoftTokens } from "../db";
import { gcalFetch, msFetch } from "../routers/calendar";

export async function executeCalendarAction(
  userId: number,
  action: string,
  params: Record<string, unknown>
): Promise<string> {
  const gTokens = await getGoogleTokens(userId);
  const msTokens = await getMicrosoftTokens(userId);

  if (gTokens.length === 0 && msTokens.length === 0) {
    return "Kein Kalender ist verbunden.";
  }

  // Helper to get all enabled calendars
  const getEnabledCalendars = async () => {
    const enabled: {
      provider: "google" | "ms";
      email: string;
      rawId: string;
      name: string;
    }[] = [];

    for (const gToken of gTokens) {
      if (!gToken.email) continue;
      let disabledList: string[] = [];
      try {
        disabledList = JSON.parse(gToken.disabledCalendars || "[]");
      } catch (e) {}

      const gData = (await gcalFetch(
        userId,
        gToken.email,
        "/users/me/calendarList"
      ).catch(() => null)) as any;
      if (gData?.items) {
        for (const c of gData.items) {
          if (!disabledList.includes(c.id)) {
            enabled.push({
              provider: "google",
              email: gToken.email,
              rawId: c.id,
              name: c.summary,
            });
          }
        }
      }
    }

    for (const msToken of msTokens) {
      if (!msToken.email) continue;
      let disabledList: string[] = [];
      try {
        disabledList = JSON.parse(msToken.disabledCalendars || "[]");
      } catch (e) {}

      const msData = (await msFetch(
        userId,
        msToken.email,
        "/me/calendars"
      ).catch(() => null)) as any;
      if (msData?.value) {
        for (const c of msData.value) {
          if (!disabledList.includes(c.id)) {
            enabled.push({
              provider: "ms",
              email: msToken.email,
              rawId: c.id,
              name: c.name,
            });
          }
        }
      }
    }
    return enabled;
  };

  const enabledCalendars = await getEnabledCalendars();
  if (enabledCalendars.length === 0) {
    return "Es sind keine Kalender aktiviert.";
  }

  const calIdParam = params.calendarId as string;

  if (action === "list_events") {
    const now = new Date();
    const tMin = (params.timeMin as string) ?? now.toISOString();
    const tMax =
      (params.timeMax as string) ??
      new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const allEvents: { start: number; text: string }[] = [];
    const tz = "Europe/Zurich";

    for (const cal of enabledCalendars) {
      if (cal.provider === "google") {
        const data = (await gcalFetch(
          userId,
          cal.email,
          `/calendars/${encodeURIComponent(cal.rawId)}/events?singleEvents=true&orderBy=startTime&maxResults=20&timeMin=${encodeURIComponent(tMin)}&timeMax=${encodeURIComponent(tMax)}`
        ).catch(() => null)) as any;

        if (data?.items) {
          for (const ev of data.items) {
            const d = new Date(ev.start?.dateTime ?? ev.start?.date ?? "");
            const dateStr = d.toLocaleDateString("de-DE", {
              weekday: "short",
              day: "2-digit",
              month: "2-digit",
              timeZone: tz,
            });
            const timeStr = ev.start?.dateTime
              ? d.toLocaleTimeString("de-DE", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: tz,
                })
              : "Ganztägig";
            let inviteInfo = "";
            if (ev.organizer && !ev.organizer.self) {
              const organizerName =
                ev.organizer.displayName ||
                ev.organizer.email?.split("@")[0] ||
                "jemanden";
              inviteInfo = ` [Einladung von ${organizerName}]`;
            }
            allEvents.push({
              start: d.getTime(),
              text: `• [${cal.name}] ${dateStr} ${timeStr}: ${ev.summary ?? "Termin"}${ev.location ? ` (${ev.location})` : ""}${inviteInfo}`,
            });
          }
        }
      } else {
        const data = (await msFetch(
          userId,
          cal.email,
          `/me/calendars/${encodeURIComponent(cal.rawId)}/events?$filter=start/dateTime ge '${tMin}' and start/dateTime le '${tMax}'&$orderby=start/dateTime&$top=20`
        ).catch(() => null)) as any;

        if (data?.value) {
          for (const ev of data.value) {
            const d = new Date(
              ev.start?.dateTime ? ev.start.dateTime + "Z" : ""
            );
            const dateStr = d.toLocaleDateString("de-DE", {
              weekday: "short",
              day: "2-digit",
              month: "2-digit",
              timeZone: tz,
            });
            const timeStr = !ev.isAllDay
              ? d.toLocaleTimeString("de-DE", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: tz,
                })
              : "Ganztägig";
            let inviteInfo = "";
            if (ev.organizer?.emailAddress?.name) {
              inviteInfo = ` [Einladung von ${ev.organizer.emailAddress.name}]`;
            }
            allEvents.push({
              start: d.getTime(),
              text: `• [${cal.name}] ${dateStr} ${timeStr}: ${ev.subject ?? "Termin"}${ev.location?.displayName ? ` (${ev.location.displayName})` : ""}${inviteInfo}`,
            });
          }
        }
      }
    }

    allEvents.sort((a, b) => a.start - b.start);
    if (allEvents.length === 0) return "Keine Termine in diesem Zeitraum.";
    return allEvents.map(e => e.text).join("\n");
  }

  // Determine target calendar for write operations
  let targetCal = enabledCalendars[0];
  if (calIdParam && calIdParam !== "primary") {
    const [provider, email, ...rawIdParts] = calIdParam.split(":");
    const rawId = rawIdParts.join(":");
    const found = enabledCalendars.find(
      c => c.provider === provider && c.email === email && c.rawId === rawId
    );
    if (found) targetCal = found;
  }

  if (action === "create_event") {
    if (targetCal.provider === "google") {
      const event = {
        summary: params.summary,
        description: params.description,
        location: params.location,
        start: { dateTime: params.startDateTime, timeZone: "Europe/Zurich" },
        end: { dateTime: params.endDateTime, timeZone: "Europe/Zurich" },
      };
      const data = (await gcalFetch(
        userId,
        targetCal.email,
        `/calendars/${encodeURIComponent(targetCal.rawId)}/events`,
        {
          method: "POST",
          body: JSON.stringify(event),
        }
      )) as any;
      return `Termin "${data.summary}" wurde in [${targetCal.name}] erstellt.`;
    } else {
      const event = {
        subject: params.summary,
        body: { contentType: "text", content: params.description ?? "" },
        location: { displayName: params.location ?? "" },
        start: { dateTime: params.startDateTime, timeZone: "Europe/Zurich" },
        end: { dateTime: params.endDateTime, timeZone: "Europe/Zurich" },
      };
      const data = (await msFetch(
        userId,
        targetCal.email,
        `/me/calendars/${encodeURIComponent(targetCal.rawId)}/events`,
        {
          method: "POST",
          body: JSON.stringify(event),
        }
      )) as any;
      return `Termin "${data.subject}" wurde in [${targetCal.name}] erstellt.`;
    }
  }

  if (action === "update_event") {
    if (!params.eventId) return "Event ID fehlt.";
    if (targetCal.provider === "google") {
      const event: any = {};
      if (params.summary) event.summary = params.summary;
      if (params.description) event.description = params.description;
      if (params.location) event.location = params.location;
      if (params.startDateTime)
        event.start = {
          dateTime: params.startDateTime,
          timeZone: "Europe/Zurich",
        };
      if (params.endDateTime)
        event.end = { dateTime: params.endDateTime, timeZone: "Europe/Zurich" };

      await gcalFetch(
        userId,
        targetCal.email,
        `/calendars/${encodeURIComponent(targetCal.rawId)}/events/${params.eventId}`,
        {
          method: "PATCH",
          body: JSON.stringify(event),
        }
      );
      return `Termin wurde in [${targetCal.name}] aktualisiert.`;
    } else {
      const event: any = {};
      if (params.summary) event.subject = params.summary;
      if (params.description)
        event.body = { contentType: "text", content: params.description };
      if (params.location) event.location = { displayName: params.location };
      if (params.startDateTime)
        event.start = {
          dateTime: params.startDateTime,
          timeZone: "Europe/Zurich",
        };
      if (params.endDateTime)
        event.end = { dateTime: params.endDateTime, timeZone: "Europe/Zurich" };

      await msFetch(
        userId,
        targetCal.email,
        `/me/calendars/${encodeURIComponent(targetCal.rawId)}/events/${params.eventId}`,
        {
          method: "PATCH",
          body: JSON.stringify(event),
        }
      );
      return `Termin wurde in [${targetCal.name}] aktualisiert.`;
    }
  }

  if (action === "delete_event") {
    if (!params.eventId) return "Event ID fehlt.";
    if (targetCal.provider === "google") {
      await gcalFetch(
        userId,
        targetCal.email,
        `/calendars/${encodeURIComponent(targetCal.rawId)}/events/${params.eventId}`,
        { method: "DELETE" }
      );
      return `Termin in [${targetCal.name}] gelöscht.`;
    } else {
      await msFetch(
        userId,
        targetCal.email,
        `/me/calendars/${encodeURIComponent(targetCal.rawId)}/events/${params.eventId}`,
        { method: "DELETE" }
      );
      return `Termin in [${targetCal.name}] gelöscht.`;
    }
  }

  return "Unbekannte Kalender-Aktion.";
}
