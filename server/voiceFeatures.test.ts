import { describe, it, expect } from "vitest";
import { detectWakeWord } from "../shared/wakeWord";
import {
  budgetState,
  currentYearMonth,
  shortenForSpeech,
  stripForSpeech,
  MAX_CHARS_PER_SPEECH,
  MONTHLY_CHAR_LIMIT,
} from "./ttsBudget";

describe("Wake-Word-Erkennung", () => {
  it("erkennt «Hey Jarvis» am Satzanfang", () => {
    expect(detectWakeWord("Hey Jarvis").detected).toBe(true);
    expect(detectWakeWord("Hallo Jarvis").detected).toBe(true);
    expect(detectWakeWord("Jarvis").detected).toBe(true);
  });

  it("gibt den Auftrag nach dem Aktivierungswort zurück", () => {
    const r = detectWakeWord("Hey Jarvis, zeig mir die offenen Rechnungen");
    expect(r.detected).toBe(true);
    expect(r.rest).toBe("zeig mir die offenen rechnungen");
  });

  it("gibt einen leeren Auftrag zurück, wenn nur der Name gesagt wurde", () => {
    expect(detectWakeWord("Hey Jarvis").rest).toBe("");
  });

  it("akzeptiert typische Fehlerkennungen des Namens", () => {
    expect(detectWakeWord("Hey Jarvas").detected).toBe(true);
    expect(detectWakeWord("Hoi Charvis").detected).toBe(true);
  });

  it("reagiert nicht, wenn der Name mitten im Satz vorkommt", () => {
    expect(
      detectWakeWord(
        "Ich habe gestern mit meinem Kollegen über Jarvis gesprochen"
      ).detected
    ).toBe(false);
  });

  it("reagiert nicht auf beliebige Sätze", () => {
    expect(detectWakeWord("Wie ist das Wetter heute?").detected).toBe(false);
    expect(detectWakeWord("").detected).toBe(false);
  });
});

describe("Sprachausgabe-Text bereinigen", () => {
  it("entfernt Markdown-Auszeichnungen", () => {
    expect(stripForSpeech("## Titel\n\n**Wichtig**: das *hier*")).toBe(
      "Titel. Wichtig: das hier"
    );
  });

  it("entfernt Codeblöcke vollständig", () => {
    const out = stripForSpeech(
      "Hier der Code:\n```ts\nconst a = 1;\n```\nFertig."
    );
    expect(out).not.toContain("const a");
    expect(out).toContain("Fertig");
  });

  it("behält nur den Linktext", () => {
    expect(stripForSpeech("Siehe [Webseite](https://gross-ict.ch)")).toBe(
      "Siehe Webseite"
    );
  });

  it("entfernt Listenzeichen", () => {
    expect(stripForSpeech("- Erster Punkt\n- Zweiter Punkt")).toBe(
      "Erster Punkt Zweiter Punkt"
    );
  });
});

describe("Kurzfassung für die Sprachausgabe", () => {
  it("lässt kurze Texte unverändert", () => {
    const r = shortenForSpeech("Guten Morgen, Sir.");
    expect(r.spoken).toBe("Guten Morgen, Sir.");
    expect(r.truncated).toBe(false);
  });

  it("kürzt lange Texte auf das Limit", () => {
    const long = "Dies ist ein Satz. ".repeat(80);
    const r = shortenForSpeech(long);
    expect(r.truncated).toBe(true);
    expect(r.spoken.length).toBeLessThanOrEqual(MAX_CHARS_PER_SPEECH + 2);
  });

  it("kürzt möglichst an einer Satzgrenze", () => {
    const long = "Erster Satz ist hier. ".repeat(40);
    const r = shortenForSpeech(long);
    expect(r.spoken.endsWith(".")).toBe(true);
  });

  it("respektiert ein individuelles Limit", () => {
    const r = shortenForSpeech(
      "Ein etwas längerer Satz zum Testen der Kürzung.",
      20
    );
    expect(r.spoken.length).toBeLessThanOrEqual(22);
    expect(r.truncated).toBe(true);
  });
});

describe("Zeichen-Budget", () => {
  it("berechnet das Restbudget", () => {
    const s = budgetState(2000);
    expect(s.remaining).toBe(MONTHLY_CHAR_LIMIT - 2000);
    expect(s.percentUsed).toBe(20);
    expect(s.level).toBe("ok");
  });

  it("warnt ab 75 Prozent", () => {
    expect(budgetState(7600).level).toBe("warn");
  });

  it("meldet kritisch ab 90 Prozent", () => {
    expect(budgetState(9200).level).toBe("critical");
  });

  it("meldet aufgebraucht bei erreichtem Limit", () => {
    const s = budgetState(MONTHLY_CHAR_LIMIT);
    expect(s.level).toBe("exhausted");
    expect(s.remaining).toBe(0);
  });

  it("liefert den Abrechnungsmonat im Format YYYY-MM", () => {
    expect(currentYearMonth(new Date("2026-08-10T00:00:00Z"))).toBe("2026-08");
    expect(currentYearMonth(new Date("2026-01-05T00:00:00Z"))).toBe("2026-01");
  });
});
