import type { Request, Response } from "express";
import {
  findWebhookKey,
  touchWebhookKey,
  claimPendingDeviceCommands,
  markDeviceCommandDone,
} from "../db";

/**
 * Öffentlicher Endpoint für die iOS-Kurzbefehle-App.
 *
 * GET  /api/device/commands?key=<API-Key>
 *   → liefert alle wartenden Befehle als JSON und markiert sie als ausgeliefert.
 * POST /api/device/commands/done?key=<API-Key>  { id: number }
 *   → meldet die Ausführung zurück.
 *
 * Authentifizierung über die gleichen API-Schlüssel wie die Webhook-API
 * (Verbindungen → API-Schlüssel).
 */
async function authenticate(req: Request) {
  const key =
    (req.query.key as string | undefined) ??
    (req.headers["x-api-key"] as string | undefined) ??
    req.headers.authorization?.replace(/^Bearer\s+/i, "") ??
    undefined;
  if (!key) return null;
  const row = await findWebhookKey(key);
  if (!row || !row.isActive) return null;
  await touchWebhookKey(row.id, row.callCount);
  return row;
}

export async function handleDeviceCommandsFetch(req: Request, res: Response) {
  try {
    const keyRow = await authenticate(req);
    if (!keyRow)
      return res.status(401).json({ error: "Ungültiger API-Schlüssel" });

    const rows = await claimPendingDeviceCommands(keyRow.userId, 10);
    const commands = rows.map(r => {
      let params: Record<string, unknown> = {};
      try {
        params = JSON.parse(r.payload) as Record<string, unknown>;
      } catch {
        /* leer */
      }
      return { id: r.id, type: r.type, summary: r.summary ?? "", ...params };
    });

    // Kurzbefehle-freundliche Antwort: erstes Element separat, damit
    // einfache Automationen ohne Schleife funktionieren.
    return res.json({
      count: commands.length,
      commands,
      first: commands[0] ?? null,
    });
  } catch (err) {
    console.error("[Device Commands Fetch]", err);
    return res.status(500).json({ error: "Serverfehler" });
  }
}

export async function handleDeviceCommandDone(req: Request, res: Response) {
  try {
    const keyRow = await authenticate(req);
    if (!keyRow)
      return res.status(401).json({ error: "Ungültiger API-Schlüssel" });

    const body = (req.body ?? {}) as { id?: number | string; status?: string };
    const id = typeof body.id === "string" ? parseInt(body.id, 10) : body.id;
    if (!id || Number.isNaN(id))
      return res.status(400).json({ error: "id fehlt" });

    await markDeviceCommandDone(
      id,
      keyRow.userId,
      body.status === "failed" ? "failed" : "done"
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error("[Device Command Done]", err);
    return res.status(500).json({ error: "Serverfehler" });
  }
}
