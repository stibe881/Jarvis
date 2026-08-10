import { describe, it, expect } from "vitest";
import { JARVIS_PERSONA, JARVIS_PERSONA_SHORT } from "./persona";

/**
 * Sichert die von Stefan gewünschte Persönlichkeit ab: kultiviert britisch,
 * «Sir»-Anrede, trockener Sarkasmus – bei kritischen Themen jedoch nüchtern.
 */
describe("Jarvis-Persönlichkeit", () => {
  it("legt die «Sir»-Anrede fest", () => {
    expect(JARVIS_PERSONA).toContain("Sir");
    expect(JARVIS_PERSONA).toContain("Sehr wohl, Sir");
  });

  it("fordert britisches Understatement und trockenen Sarkasmus", () => {
    expect(JARVIS_PERSONA).toMatch(/Understatement/);
    expect(JARVIS_PERSONA).toMatch(/Sarkasmus/);
  });

  it("nennt die typischen Formulierungen", () => {
    expect(JARVIS_PERSONA).toContain("Es wäre vielleicht ratsam, Sir");
    expect(JARVIS_PERSONA).toContain("Wenn ich so frei sein darf");
  });

  it("verlangt Sachlichkeit bei Zahlen und kritischen Themen", () => {
    expect(JARVIS_PERSONA).toMatch(/Zahlen, Termine, Beträge und Namen bleiben exakt/);
    expect(JARVIS_PERSONA).toMatch(/kritischen oder dringenden Sachverhalten/);
  });

  it("weist den Sarkasmus als respektvoll aus (keine Beleidigungen)", () => {
    expect(JARVIS_PERSONA).toMatch(/niemals verletzend/);
  });

  it("stellt eine Kurzfassung für Benachrichtigungen bereit", () => {
    expect(JARVIS_PERSONA_SHORT).toContain("Sir");
    expect(JARVIS_PERSONA_SHORT.length).toBeLessThan(400);
  });
});
