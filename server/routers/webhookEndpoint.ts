import type { Request, Response } from "express";
import { findWebhookKey, touchWebhookKey, createWebhookEvent } from "../db";
import { notifyOwner } from "../_core/notification";

/**
 * Öffentlicher Webhook-Eingang für externe Dienste.
 * POST /api/webhook/jarvis
 * Header: X-Jarvis-Key: <apiKey>   (alternativ Authorization: Bearer <apiKey>)
 * Body:  { "title": "Neues Ticket", "body": "Details...", "source": "Gross ICT App", "notify": true }
 */
export async function handleJarvisWebhook(req: Request, res: Response) {
  try {
    const headerKey = (req.headers["x-jarvis-key"] as string | undefined)
      ?? (typeof req.headers.authorization === "string" && req.headers.authorization.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : undefined);

    if (!headerKey) {
      return res.status(401).json({ error: "API-Schlüssel fehlt. Header X-Jarvis-Key setzen." });
    }

    const keyRow = await findWebhookKey(headerKey.trim());
    if (!keyRow || !keyRow.isActive) {
      return res.status(401).json({ error: "Ungültiger oder deaktivierter API-Schlüssel." });
    }

    const body = (req.body ?? {}) as { title?: string; body?: string; message?: string; source?: string; notify?: boolean };
    const title = (body.title ?? "Jarvis-Ereignis").toString().slice(0, 240);
    const content = (body.body ?? body.message ?? "").toString().slice(0, 8000);
    const source = (body.source ?? keyRow.label).toString().slice(0, 120);
    const shouldNotify = body.notify !== false;

    let notified = false;
    if (shouldNotify) {
      try {
        await notifyOwner({ title: `🔔 ${title}`, content: content || `Ereignis von ${source}` });
        notified = true;
      } catch (e) {
        console.error("[Webhook] Benachrichtigung fehlgeschlagen:", e);
      }
    }

    await createWebhookEvent(keyRow.userId, source, title, content || null, notified);
    await touchWebhookKey(keyRow.id, keyRow.callCount);

    res.json({ ok: true, notified });
  } catch (e) {
    console.error("[Webhook] Fehler:", e);
    res.status(500).json({ error: String(e) });
  }
}
