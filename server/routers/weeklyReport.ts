import type { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { getDb } from "../db";
import { tasks, users, notes, voiceNotes, delegations } from "../../drizzle/schema";
import { and, eq, gte } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";
import { invokeLLM } from "../_core/llm";
import { executeAppAction } from "./appIntegration";

/**
 * Wöchentlicher Bericht – Heartbeat-Cron, Freitag 15:00 UTC (17:00 Zürich).
 * POST /api/scheduled/weekly-report
 */
export async function handleWeeklyReport(req: Request, res: Response) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = await (sdk as any).authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });

    const db = await getDb();
    if (!db) return res.json({ ok: true, skipped: "no-db" });

    const ownerOpenId = process.env.OWNER_OPEN_ID;
    if (!ownerOpenId) return res.json({ ok: true, skipped: "no-owner" });

    const ownerRows = await db.select().from(users).where(eq(users.openId, ownerOpenId)).limit(1);
    if (!ownerRows[0]) return res.json({ ok: true, skipped: "owner-not-found" });
    const ownerId = ownerRows[0].id;
    const ownerName = ownerRows[0].name ?? "Stefan";

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Erledigte und offene Aufgaben
    const allTasks = await db.select().from(tasks).where(eq(tasks.userId, ownerId));
    const doneThisWeek = allTasks.filter(t => t.completed && t.updatedAt >= weekAgo);
    const stillOpen = allTasks.filter(t => !t.completed);
    const overdueTasks = stillOpen.filter(t => t.dueDate && t.dueDate < Date.now());

    // Notizen und Sprachnotizen der Woche
    const weekNotes = await db.select().from(notes)
      .where(and(eq(notes.userId, ownerId), gte(notes.createdAt, weekAgo)));
    const weekVoiceNotes = await db.select().from(voiceNotes)
      .where(and(eq(voiceNotes.userId, ownerId), gte(voiceNotes.createdAt, weekAgo)));

    // Offene Delegationen
    const openDelegations = (await db.select().from(delegations)
      .where(eq(delegations.userId, ownerId)))
      .filter(d => d.status === "open" || d.status === "in_progress");

    // Zahlen aus der Gross ICT App
    let appSummary = "";
    try {
      appSummary = await executeAppAction("dashboard", {});
    } catch (e) {
      console.error("[WeeklyReport] App-Dashboard nicht erreichbar:", e);
    }

    const kw = (() => {
      const d = new Date();
      const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      const dayNr = (target.getUTCDay() + 6) % 7;
      target.setUTCDate(target.getUTCDate() - dayNr + 3);
      const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
      const diff = target.getTime() - firstThursday.getTime();
      return 1 + Math.round(diff / (7 * 24 * 3600 * 1000));
    })();

    const facts = `Erledigte Aufgaben diese Woche: ${doneThisWeek.length}
${doneThisWeek.slice(0, 12).map(t => `- ${t.title}`).join("\n")}

Noch offene Aufgaben: ${stillOpen.length} (davon überfällig: ${overdueTasks.length})
${overdueTasks.slice(0, 8).map(t => `- ÜBERFÄLLIG: ${t.title}`).join("\n")}
${stillOpen.filter(t => !overdueTasks.includes(t)).slice(0, 8).map(t => `- ${t.title}`).join("\n")}

Neue Notizen: ${weekNotes.length}
Neue Sprachnotizen: ${weekVoiceNotes.length}
Offene Delegationen: ${openDelegations.length}
${openDelegations.slice(0, 6).map(d => `- ${d.title} → ${d.assigneeName}`).join("\n")}

${appSummary ? `Aktuelle Zahlen aus der Gross ICT App:\n${appSummary}` : ""}`;

    let body = "";
    try {
      const prompt = `Du bist Jarvis, der persönliche Assistent von ${ownerName} (Leiter ICT im Kompetenzzentrum Sonnenberg Baar und Inhaber von Gross ICT).
Schreibe einen kompakten Wochenrückblick für Kalenderwoche ${kw} auf Deutsch in Schweizer Schreibweise ("ss" statt "ß", CHF, Datumsformat dd.mm.yyyy).

Struktur:
1. Ein Satz Gesamtfazit der Woche
2. "Erledigt" – die wichtigsten Erfolge (Stichworte)
3. "Offen und dringend" – was nächste Woche Priorität hat
4. "Empfehlung" – zwei bis drei konkrete Vorschläge für nächste Woche

Maximal 250 Wörter, sachlich und motivierend, keine erfundenen Zahlen. Nutze nur die folgenden Fakten:

${facts}`;
      const resp = await invokeLLM({
        model: "claude-sonnet-4-5",
        max_tokens: 1200,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: [{ role: "user", content: prompt }] as any,
      });
      body = (resp.choices[0]?.message?.content as string) ?? "";
    } catch (e) {
      console.error("[WeeklyReport] LLM-Fehler:", e);
    }

    if (!body.trim()) body = `Wochenrückblick KW ${kw}\n\n${facts}`;

    await notifyOwner({
      title: `📊 Jarvis Wochenbericht – KW ${kw}`,
      content: body,
    });

    res.json({
      ok: true,
      kw,
      done: doneThisWeek.length,
      open: stillOpen.length,
      overdue: overdueTasks.length,
    });
  } catch (e) {
    console.error("[WeeklyReport] Fehler:", e);
    res.status(500).json({ error: String(e), stack: e instanceof Error ? e.stack : undefined, timestamp: Date.now() });
  }
}

