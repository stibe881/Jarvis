/**
 * Zeichen-Budget und Kurzfassung für die Sprachausgabe.
 *
 * Der ElevenLabs-Free-Plan erlaubt 10'000 Zeichen pro Monat. Damit das Budget
 * für möglichst viele Antworten reicht, spricht Jarvis eine gekürzte Fassung,
 * während der vollständige Text im Chat sichtbar bleibt.
 */

import { buildSpokenSummary } from "../shared/cleanText";

/** Monatliches Zeichenbudget des ElevenLabs-Free-Plans. */
export const MONTHLY_CHAR_LIMIT = 10_000;

/**
 * Maximale Zeichen pro einzelner Sprachausgabe.
 *
 * 260 Zeichen waren zu knapp: Jarvis brach mitten im Satz ab. Mit 1200 Zeichen
 * werden normale Antworten vollständig gesprochen; nur sehr lange Texte werden
 * an einer Satzgrenze gekürzt. Das Guthaben wird stattdessen über den Modus
 * «nur bei Sprachbedienung» geschont, der getippte Antworten stumm lässt.
 */
export const MAX_CHARS_PER_SPEECH = 1200;

/** Abrechnungsmonat im Format YYYY-MM. */
export function currentYearMonth(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Entfernt Markdown, Emojis und Aufzählungszeichen, damit nichts mitgesprochen wird. */
export function stripForSpeech(text: string): string {
  return (
    text
      // Protokoll der ausgeführten Schritte nie mitsprechen
      .replace(/⟦schritte⟧[\s\S]*$/g, " ")
      // Interne Kategorie-Markierungen aus dem Gedächtnis-Kontext nie mitsprechen
      // (etwa «[person]», «[context]») – sie sind technische Hinweise, kein Inhalt
      .replace(
        /\s*\[(?:person|contact|preference|project|fact|context|memory|profil|profile|kalender|calendar)\]/gi,
        ""
      )
      // Codeblöcke ganz entfernen – die will niemand vorgelesen bekommen
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`([^`]*)`/g, "$1")
      // Markdown-Links: nur den Linktext behalten
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      // Überschriften, Listenzeichen, Zitate
      .replace(/^\s{0,3}#{1,6}\s*/gm, "")
      .replace(/^\s*[-*+•]\s+/gm, "")
      .replace(/^\s*>\s?/gm, "")
      // Betonungen und Tabellenstriche
      .replace(/[*_~|]/g, "")
      // Emojis und Symbole (Surrogate-Bereich ohne u-Flag, damit es zum Build-Target passt)
      .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "")
      .replace(/[\u2600-\u27BF\u2B00-\u2BFF\uFE0F\u2190-\u21FF]/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{2,}/g, ". ")
      .replace(/\n/g, " ")
      .replace(/\s*\.\s*\./g, ".")
      // Leerzeichen vor Satzzeichen entfernen, die durch das Entfernen entstehen
      .replace(/\s+([.,;:!?])/g, "$1")
      .trim()
  );
}

/**
 * Kürzt einen Text auf ganze Sätze innerhalb des Zeichenlimits.
 * Gibt zusätzlich zurück, ob gekürzt wurde, damit die App einen Hinweis zeigen kann.
 */
export function shortenForSpeech(
  text: string,
  limit = MAX_CHARS_PER_SPEECH
): { spoken: string; truncated: boolean } {
  const clean = stripForSpeech(text);
  if (clean.length <= limit) return { spoken: clean, truncated: false };

  // Sehr lange Texte werden nicht einfach abgeschnitten – das klang, als würde
  // Jarvis mitten im Gedanken verstummen. Stattdessen entsteht eine Kurzfassung
  // aus Anfang und Schluss, ergänzt um einen Hinweis auf den vollen Text.
  // Die Logik liegt in shared/cleanText.ts, damit die Browser-Stimme identisch klingt.
  return { spoken: buildSpokenSummary(clean, limit), truncated: true };
}

/** Restbudget und Warnstufe berechnen. */
export function budgetState(charsUsed: number, limit = MONTHLY_CHAR_LIMIT) {
  const remaining = Math.max(0, limit - charsUsed);
  const percentUsed =
    limit === 0 ? 100 : Math.min(100, Math.round((charsUsed / limit) * 100));
  const level: "ok" | "warn" | "critical" | "exhausted" =
    remaining === 0
      ? "exhausted"
      : percentUsed >= 90
        ? "critical"
        : percentUsed >= 75
          ? "warn"
          : "ok";
  return { charsUsed, limit, remaining, percentUsed, level };
}
