/**
 * Erkennung des Aktivierungsworts („Hey Jarvis").
 *
 * Die Spracherkennung liefert je nach Dialekt unterschiedliche Schreibweisen,
 * daher werden mehrere Varianten akzeptiert. Wird nach dem Aktivierungswort
 * noch etwas gesagt, gibt `rest` diesen Auftrag direkt zurück.
 */

/** Akzeptierte Varianten des Namens, wie die Spracherkennung ihn liefert. */
const NAME_VARIANTS = [
  "jarvis",
  "jarvas",
  "jarwis",
  "jervis",
  "jarves",
  "charvis",
  "dscharvis",
];

/** Vorangestellte Anreden, die ignoriert werden dürfen. */
const GREETINGS = ["hey", "hei", "hallo", "hoi", "ok", "okay", "he", "hä"];

export type WakeWordResult = {
  /** Wurde das Aktivierungswort erkannt? */
  detected: boolean;
  /** Der Auftrag nach dem Aktivierungswort, sofern direkt mitgesprochen. */
  rest: string;
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,!?;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectWakeWord(text: string): WakeWordResult {
  const normalized = normalize(text);
  if (!normalized) return { detected: false, rest: "" };

  const words = normalized.split(" ");
  // Das Aktivierungswort muss am Anfang stehen (maximal nach einer Anrede)
  for (let i = 0; i < Math.min(words.length, 3); i++) {
    const word = words[i];
    if (NAME_VARIANTS.includes(word)) {
      // Alles davor darf nur eine Anrede sein
      const before = words.slice(0, i);
      if (before.every(w => GREETINGS.includes(w))) {
        const rest = words
          .slice(i + 1)
          .join(" ")
          .trim();
        return { detected: true, rest };
      }
    }
  }
  return { detected: false, rest: "" };
}
