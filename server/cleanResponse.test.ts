import { describe, it, expect } from "vitest";
import { removeInternalTags } from "./cleanResponse";
import { stripForSpeech, shortenForSpeech, MAX_CHARS_PER_SPEECH } from "./ttsBudget";

/**
 * Hintergrund: In einer Antwort über Stefans Kinder erschienen im Chat die
 * internen Markierungen «[person]» und «[context]». Sie kamen aus dem
 * Gedächtnis-Kontext, wurden vom Modell übernommen und auch mitgesprochen.
 */
describe("Bereinigung interner Markierungen", () => {
  it("entfernt Markierungen samt vorangehendem Leerzeichen", () => {
    const roh = "Levin, Ihr Sohn, geboren am 15. Juni 2019 [person]. Ich erlaube mir den Hinweis.";
    expect(removeInternalTags(roh)).toBe("Levin, Ihr Sohn, geboren am 15. Juni 2019. Ich erlaube mir den Hinweis.");
  });

  it("entfernt mehrere verschiedene Markierungen in einem Text", () => {
    const roh = "Schulstart am 17. August 2026 [context]. Lina, geboren am 16. August 2024 [person]; Geburtstag steht an [context].";
    const sauber = removeInternalTags(roh);
    expect(sauber).not.toContain("[context]");
    expect(sauber).not.toContain("[person]");
    expect(sauber).toContain("Schulstart am 17. August 2026.");
    expect(sauber).toContain("Geburtstag steht an.");
  });

  it("arbeitet unabhängig von der Gross-/Kleinschreibung", () => {
    expect(removeInternalTags("Notiz [Person] und [CONTEXT] weg")).toBe("Notiz und weg");
  });

  it("lässt gewollte Klammerausdrücke unberührt", () => {
    const roh = "Siehe Quelle [1] und den Hinweis [siehe Anhang].";
    expect(removeInternalTags(roh)).toBe(roh);
  });

  it("verträgt leere Eingaben", () => {
    expect(removeInternalTags("")).toBe("");
  });
});

describe("Gesprochene Fassung", () => {
  it("spricht interne Markierungen nicht mit", () => {
    const roh = "Levin, geboren am 15. Juni 2019 [person]. Ein bedeutender Meilenstein.";
    const gesprochen = stripForSpeech(roh);
    expect(gesprochen).not.toContain("[person]");
    expect(gesprochen).toBe("Levin, geboren am 15. Juni 2019. Ein bedeutender Meilenstein.");
  });

  it("spricht normale Antworten vollständig aus", () => {
    // Eine typische Antwort wie im Screenshot – rund 700 Zeichen
    const antwort = "Meinen Aufzeichnungen zufolge, Sir, sind Sie stolzer Vater von zwei Kindern. " +
      "Levin, Ihr Sohn, geboren am 15. Juni 2019. Ich erlaube mir den Hinweis, dass für ihn am kommenden Montag, " +
      "den 17. August 2026, der Schulstart bevorsteht. Ein gewiss bedeutender Meilenstein. " +
      "Lina, Ihre Tochter, geboren am 16. August 2024. Meine Daten zeigen, dass bei ihr in den kommenden Tagen " +
      "der Geburtstag ansteht; der Kalender verzeichnet bereits eine Geboriparty am Samstag sowie die Feierlichkeiten am Sonntag. " +
      "Wenn ich so frei sein darf: Ein äusserst lebhafter August, der Ihnen gewiss einiges abverlangen wird.";
    const { spoken, truncated } = shortenForSpeech(antwort);
    expect(truncated).toBe(false);
    expect(spoken.endsWith("abverlangen wird.")).toBe(true);
  });

  it("bildet bei sehr langen Texten eine Kurzfassung statt hart abzuschneiden", () => {
    const langerText = ("Dies ist ein vollständiger Satz mit ausreichender Länge. ").repeat(40) +
      "Soll ich eine Erinnerung einrichten, Sir?";
    const { spoken, truncated } = shortenForSpeech(langerText);
    expect(truncated).toBe(true);
    expect(spoken.length).toBeLessThanOrEqual(MAX_CHARS_PER_SPEECH);
    // Der Hinweis auf den vollen Text ist enthalten
    expect(spoken).toContain("Die vollständige Antwort steht im Chat.");
    // Der Schlusssatz (die Rückfrage) wird mitgesprochen, damit Stefan antworten kann
    expect(spoken.trim().endsWith("Soll ich eine Erinnerung einrichten, Sir?")).toBe(true);
  });

  it("schneidet Texte ohne Satzzeichen sauber am Wort ab", () => {
    const ohneSatzzeichen = "wort ".repeat(400).trim();
    const { spoken, truncated } = shortenForSpeech(ohneSatzzeichen);
    expect(truncated).toBe(true);
    expect(spoken.length).toBeLessThanOrEqual(MAX_CHARS_PER_SPEECH);
    expect(spoken).toContain("…");
    // Nicht mitten im Wort abgeschnitten
    expect(spoken).not.toMatch(/wor …/);
  });

  it("spricht das Schritt-Protokoll nicht mit", () => {
    const mitProtokoll = "Die Rechnung ist bezahlt.⟦schritte⟧mark_invoice_paid | list_invoices";
    expect(stripForSpeech(mitProtokoll)).toBe("Die Rechnung ist bezahlt.");
  });
});
