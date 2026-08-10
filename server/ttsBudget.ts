/**
 * Zeichen-Budget und Kurzfassung für die Sprachausgabe.
 *
 * Der ElevenLabs-Free-Plan erlaubt 10'000 Zeichen pro Monat. Damit das Budget
 * für möglichst viele Antworten reicht, spricht Jarvis eine gekürzte Fassung,
 * während der vollständige Text im Chat sichtbar bleibt.
 */

/** Monatliches Zeichenbudget des ElevenLabs-Free-Plans. */
export const MONTHLY_CHAR_LIMIT = 10_000;

/**
 * Maximale Zeichen pro einzelner Sprachausgabe.
 *
 * Bei 450 Zeichen reichte das Monatsbudget nur für etwa 22 Antworten und war
 * nach kurzer Zeit erschöpft. Mit 260 Zeichen sind es rund 38 Antworten,
 * ohne dass die gesprochene Zusammenfassung unbrauchbar kurz wird. Der
 * vollständige Text bleibt im Chat sichtbar.
 */
export const MAX_CHARS_PER_SPEECH = 260;

/** Abrechnungsmonat im Format YYYY-MM. */
export function currentYearMonth(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Entfernt Markdown, Emojis und Aufzählungszeichen, damit nichts mitgesprochen wird. */
export function stripForSpeech(text: string): string {
  return text
    // Protokoll der ausgeführten Schritte nie mitsprechen
    .replace(/⟦schritte⟧[\s\S]*$/g, " ")
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
    .trim();
}

/**
 * Kürzt einen Text auf ganze Sätze innerhalb des Zeichenlimits.
 * Gibt zusätzlich zurück, ob gekürzt wurde, damit die App einen Hinweis zeigen kann.
 */
export function shortenForSpeech(text: string, limit = MAX_CHARS_PER_SPEECH): { spoken: string; truncated: boolean } {
  const clean = stripForSpeech(text);
  if (clean.length <= limit) return { spoken: clean, truncated: false };

  // Möglichst an einer Satzgrenze abschneiden
  const window = clean.slice(0, limit);
  const lastSentence = Math.max(window.lastIndexOf(". "), window.lastIndexOf("! "), window.lastIndexOf("? "));
  if (lastSentence > limit * 0.5) {
    return { spoken: window.slice(0, lastSentence + 1).trim(), truncated: true };
  }

  // Sonst am letzten Wort abschneiden
  const lastSpace = window.lastIndexOf(" ");
  const cut = lastSpace > limit * 0.5 ? window.slice(0, lastSpace) : window;
  return { spoken: `${cut.trim()} …`, truncated: true };
}

/** Restbudget und Warnstufe berechnen. */
export function budgetState(charsUsed: number, limit = MONTHLY_CHAR_LIMIT) {
  const remaining = Math.max(0, limit - charsUsed);
  const percentUsed = limit === 0 ? 100 : Math.min(100, Math.round((charsUsed / limit) * 100));
  const level: "ok" | "warn" | "critical" | "exhausted" =
    remaining === 0 ? "exhausted" : percentUsed >= 90 ? "critical" : percentUsed >= 75 ? "warn" : "ok";
  return { charsUsed, limit, remaining, percentUsed, level };
}
