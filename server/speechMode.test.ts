import { describe, it, expect } from "vitest";

/**
 * Entscheidungslogik für die Sprachausgabe.
 *
 * Hintergrund: Das ElevenLabs-Guthaben war nach kurzer Zeit aufgebraucht, weil
 * Jarvis auch getippte Antworten vorgelesen hat. Der Modus «nur bei
 * Sprachbedienung» halbiert den Verbrauch im Alltag, weil im Büro meist
 * getippt wird.
 */

type Modus = "always" | "voice-only" | "never";
type Quelle = "sprache" | "tippen";

/** Dieselbe Bedingung wie im Chat: entscheidet, ob gesprochen wird. */
function darfSprechen(modus: Modus, quelle: Quelle): boolean {
  return modus === "always" || (modus === "voice-only" && quelle === "sprache");
}

/** Durchschalt-Reihenfolge des Knopfes im Chat. */
function naechsterModus(aktuell: Modus): Modus {
  const reihenfolge: Modus[] = ["always", "voice-only", "never"];
  return reihenfolge[(reihenfolge.indexOf(aktuell) + 1) % reihenfolge.length];
}

describe("Sprachausgabe-Modus", () => {
  it("übersetzt den Profilwert in den Chat-Modus", () => {
    // Im Profil steht "voiceOnly" (Enum-Schreibweise), im Chat "voice-only"
    const ausProfil = (wert: string | null | undefined) =>
      wert ? (wert === "voiceOnly" ? "voice-only" : wert) : null;
    expect(ausProfil("voiceOnly")).toBe("voice-only");
    expect(ausProfil("always")).toBe("always");
    expect(ausProfil("never")).toBe("never");
    expect(ausProfil(null)).toBeNull();
  });

  it("übersetzt den Chat-Modus zurück in den Profilwert", () => {
    const zumProfil = (m: Modus) => (m === "voice-only" ? "voiceOnly" : m);
    expect(zumProfil("voice-only")).toBe("voiceOnly");
    expect(zumProfil("always")).toBe("always");
    expect(zumProfil("never")).toBe("never");
  });

  it("spricht im Modus «immer» unabhängig von der Quelle", () => {
    expect(darfSprechen("always", "sprache")).toBe(true);
    expect(darfSprechen("always", "tippen")).toBe(true);
  });

  it("spricht im Modus «nur bei Sprachbedienung» ausschliesslich nach Spracheingabe", () => {
    expect(darfSprechen("voice-only", "sprache")).toBe(true);
    expect(darfSprechen("voice-only", "tippen")).toBe(false);
  });

  it("bleibt im Modus «nie» immer stumm", () => {
    expect(darfSprechen("never", "sprache")).toBe(false);
    expect(darfSprechen("never", "tippen")).toBe(false);
  });

  it("schaltet die Modi im Kreis durch", () => {
    expect(naechsterModus("always")).toBe("voice-only");
    expect(naechsterModus("voice-only")).toBe("never");
    expect(naechsterModus("never")).toBe("always");
  });

  it("spart im Alltag rund die Hälfte des Guthabens", () => {
    // Angenommener Alltag: 10 getippte und 4 gesprochene Anfragen
    const anfragen: Quelle[] = [
      ...Array<Quelle>(10).fill("tippen"),
      ...Array<Quelle>(4).fill("sprache"),
    ];
    const zeichenProAntwort = 260;
    const immer = anfragen.filter(q => darfSprechen("always", q)).length * zeichenProAntwort;
    const nurSprache = anfragen.filter(q => darfSprechen("voice-only", q)).length * zeichenProAntwort;
    expect(immer).toBe(14 * 260);
    expect(nurSprache).toBe(4 * 260);
    // Deutliche Einsparung: weniger als ein Drittel des Verbrauchs
    expect(nurSprache).toBeLessThan(immer / 3);
  });
});
