/**
 * Textbereinigung, die Server und Browser gemeinsam nutzen.
 *
 * Das Modell hat interne Kategorie-Markierungen aus dem Gedächtnis-Kontext
 * («[person]», «[context]» …) wörtlich in Antworten übernommen. Sie erschienen
 * im Chat und wurden mitgesprochen. Die Ursache ist behoben; diese Funktion
 * schützt zusätzlich bereits gespeicherte Gespräche.
 */

const INTERNE_TAGS =
  "person|contact|preference|project|fact|context|memory|profil|profile|kalender|calendar";

/** Entfernt interne Kategorie-Markierungen, Werkzeug-XML-Tags und räumt Satzzeichen auf. */
export function removeInternalTags(text: string): string {
  if (!text) return text;
  return (
    text
      // Entferne alle Werkzeug-XML-Blöcke (z.B. <app_action>...</app_action>)
      // Das (?:<\/[a-z_]+_action>|$) stellt sicher, dass es auch während dem Streamen
      // ausgeblendet wird, wenn das schließende Tag noch fehlt.
      // WICHTIG: <maps_action> NICHT entfernen, da das Frontend diese braucht!
      .replace(
        /<(?!maps_action>)[a-z_]+_action>[\s\S]*?(?:<\/(?!maps_action>)[a-z_]+_action>|$)/gi,
        ""
      )
      .replace(new RegExp(`\\s*\\[(?:${INTERNE_TAGS})\\]`, "gi"), "")
      .replace(/\s+([.,;:!?])/g, "$1")
      .replace(/[ \t]{2,}/g, " ")
  );
}

/** Zerlegt einen Text in ganze Sätze. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Baut eine hörbare Kurzfassung: die ersten Sätze, ein Hinweis auf den
 * vollständigen Text, dann der Schlusssatz. Der Schluss ist meist die
 * Rückfrage oder der Vorschlag – wird er weggelassen, wirkt die Antwort
 * abgebrochen.
 *
 * Wird von der ElevenLabs-Stimme (Server) und der Browser-Stimme (Client)
 * gemeinsam genutzt, damit beide gleich klingen.
 */
export function buildSpokenSummary(clean: string, limit: number): string {
  const hinweis = "Die vollständige Antwort steht im Chat.";

  // Sehr kleines Limit: der Hinweis passt nicht sinnvoll dazu
  if (limit < hinweis.length + 40) {
    const window = clean.slice(0, Math.max(1, limit - 2));
    const lastSpace = window.lastIndexOf(" ");
    const cut =
      lastSpace > window.length * 0.4 ? window.slice(0, lastSpace) : window;
    return `${cut.trim()} …`;
  }

  const sentences = splitSentences(clean);

  // Ohne erkennbare Sätze: sauber am Wort abschneiden
  if (sentences.length <= 1) {
    const window = clean.slice(0, Math.max(0, limit - hinweis.length - 2));
    const lastSpace = window.lastIndexOf(" ");
    const cut =
      lastSpace > window.length * 0.5 ? window.slice(0, lastSpace) : window;
    return `${cut.trim()} … ${hinweis}`;
  }

  const schluss = sentences[sentences.length - 1];
  const budgetAnfang = limit - schluss.length - hinweis.length - 4;

  const anfang: string[] = [];
  let laenge = 0;
  for (const satz of sentences.slice(0, -1)) {
    if (laenge + satz.length + 1 > budgetAnfang) break;
    anfang.push(satz);
    laenge += satz.length + 1;
  }

  if (anfang.length === 0) {
    return `${hinweis} ${schluss}`.slice(0, limit).trim();
  }

  const ergebnis = `${anfang.join(" ")} ${hinweis} ${schluss}`.trim();
  return ergebnis.length <= limit ? ergebnis : ergebnis.slice(0, limit).trim();
}
