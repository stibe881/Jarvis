/**
 * Zwischenspeicher für Aktionen, die auf Stefans Freigabe warten.
 *
 * Kritische Aktionen (Rechnung als bezahlt markieren, WhatsApp senden,
 * Termin löschen) werden nicht direkt ausgeführt. Sie landen hier, Jarvis
 * fragt nach, und ein klares "Ja" in der nächsten Nachricht gibt sie frei.
 *
 * Bewusst im Arbeitsspeicher: eine Freigabe soll nur für die unmittelbar
 * folgende Antwort gelten und nicht nach einem Neustart wieder auftauchen.
 */

import type { PendingAction } from "./agent";

type Entry = { actions: PendingAction[]; createdAt: number };

const store = new Map<number, Entry>();

/** Freigaben verfallen nach fünf Minuten, damit nichts unbeabsichtigt ausgelöst wird. */
const TTL_MS = 5 * 60 * 1000;

/**
 * Neue kritische Aktionen vormerken.
 *
 * Eine leere Liste löscht eine bestehende Vormerkung NICHT: fragt Stefan zwischen
 * Rückfrage und Freigabe etwas anderes, soll seine Zustimmung danach immer noch
 * greifen. Verworfen wird nur bei ausdrücklicher Ablehnung oder Zeitablauf.
 */
export function rememberPending(
  conversationId: number,
  actions: PendingAction[]
): void {
  if (actions.length === 0) return;
  store.set(conversationId, { actions, createdAt: Date.now() });
}

export function takePending(conversationId: number): PendingAction[] {
  const entry = store.get(conversationId);
  if (!entry) return [];
  store.delete(conversationId);
  if (Date.now() - entry.createdAt > TTL_MS) return [];
  return entry.actions;
}

export function hasPending(conversationId: number): boolean {
  const entry = store.get(conversationId);
  if (!entry) return false;
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(conversationId);
    return false;
  }
  return true;
}

/** Vorgemerkte Aktionen ansehen, ohne sie zu verbrauchen. */
export function peekPending(conversationId: number): PendingAction[] {
  const entry = store.get(conversationId);
  if (!entry) return [];
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(conversationId);
    return [];
  }
  return entry.actions;
}

/** Vormerkung ausdrücklich verwerfen (z.B. bei "nein"). */
export function clearPending(conversationId: number): void {
  store.delete(conversationId);
}

/** Wörter, mit denen Stefan eine vorgemerkte Aktion freigibt. */
const YES = [
  "ja",
  "jawohl",
  "jo",
  "jä",
  "genau",
  "bitte",
  "mach",
  "machs",
  "mach das",
  "mach es",
  "ausführen",
  "führe aus",
  "los",
  "okay",
  "ok",
  "einverstanden",
  "passt",
  "gerne",
  "bestätigt",
  "bestätige",
  "freigegeben",
  "gib frei",
  "erledige",
  "tu das",
  "ja bitte",
];

const NO = [
  "nein",
  "nicht",
  "stopp",
  "stop",
  "abbrechen",
  "lass",
  "doch nicht",
  "warte",
  "nö",
  "nei",
];

/**
 * Prüft, ob eine Nachricht eine ausdrückliche Ablehnung ist.
 * Nur dann wird die Vormerkung verworfen – bei allen anderen Nachrichten
 * (z.B. Rückfragen) bleibt sie erhalten, bis die Frist abläuft.
 */
export function isRejection(message: string): boolean {
  const t = message
    .toLowerCase()
    .trim()
    .replace(/[!.,;:?]+$/g, "");
  if (!t || t.length > 60) return false;
  return NO.some(
    n => t === n || t.startsWith(n + " ") || t.startsWith(n + ",")
  );
}

/**
 * Prüft, ob eine Nachricht eine Freigabe ist.
 *
 * Absichtlich streng: die Nachricht muss kurz sein und mit einer Zustimmung
 * beginnen. Eine neue, inhaltliche Anfrage gilt nie als Freigabe.
 */
export function isApproval(message: string): boolean {
  const t = message
    .toLowerCase()
    .trim()
    .replace(/[!.,;:?]+$/g, "");
  if (!t) return false;
  if (t.length > 60) return false;
  if (NO.some(n => t === n || t.startsWith(n + " "))) return false;
  return YES.some(
    y => t === y || t.startsWith(y + " ") || t.startsWith(y + ",")
  );
}
