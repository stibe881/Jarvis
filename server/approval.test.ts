import { describe, it, expect, beforeEach } from "vitest";
import { runAgentLoop, isCriticalAction, describeCritical, type AgentStep, type ParsedAction } from "./agent";
import {
  rememberPending, takePending, hasPending, peekPending, clearPending,
  isApproval, isRejection, type PendingAction,
} from "./pendingApproval";

/** Aktion ausführen mit vorgegebenen Ergebnissen. */
const fakeRunner = (results: Record<string, string>) => async (parsed: ParsedAction): Promise<AgentStep> => {
  const action = String(parsed.payload.action ?? parsed.payload.type ?? "");
  return { kind: parsed.tag, action, result: results[action] ?? "ok", label: `${parsed.tag} · ${action}` };
};

describe("Kritische Aktionen erkennen", () => {
  it("stuft Geld- und Versandaktionen als kritisch ein", () => {
    expect(isCriticalAction("mark_invoice_paid")).toBe(true);
    expect(isCriticalAction("create_invoice")).toBe(true);
    expect(isCriticalAction("delete_event")).toBe(true);
    expect(isCriticalAction("whatsapp")).toBe(true);
    expect(isCriticalAction("invite_attendee")).toBe(true);
  });

  it("lässt harmlose Aktionen ohne Freigabe zu", () => {
    expect(isCriticalAction("list_customers")).toBe(false);
    expect(isCriticalAction("create_note")).toBe(false);
    expect(isCriticalAction("create_task")).toBe(false);
    expect(isCriticalAction("create_lead")).toBe(false);
    expect(isCriticalAction("play")).toBe(false);
  });

  it("beschreibt kritische Aktionen verständlich mit Daten", () => {
    expect(describeCritical("app_action", "mark_invoice_paid", { id: "R-2026-014" })).toContain("R-2026-014");
    expect(describeCritical("device_action", "whatsapp", { recipient: "Bine", message: "Komme später" })).toContain("Bine");
    expect(describeCritical("calendar_action", "delete_event", { summary: "Zahnarzt" })).toContain("Zahnarzt");
  });
});

describe("Bestätigungspflicht in der Agenten-Schleife", () => {
  it("führt eine kritische Aktion NICHT aus, sondern merkt sie vor", async () => {
    let executed = false;
    const result = await runAgentLoop({
      firstResponse: '<app_action>{"action":"mark_invoice_paid","id":"R-2026-014"}</app_action>',
      messages: [],
      runAction: async (parsed) => {
        executed = true;
        return { kind: parsed.tag, action: "mark_invoice_paid", result: "bezahlt", label: "x" };
      },
      callModel: async () => "Ich habe die Rechnung R-2026-014 gefunden.",
    });

    expect(executed).toBe(false);
    expect(result.pending).toHaveLength(1);
    expect(result.pending[0].action).toBe("mark_invoice_paid");
    expect(result.steps).toHaveLength(0);
    // Die Antwort enthält eine Rückfrage
    expect(result.text.toLowerCase()).toContain("freigabe");
  });

  it("führt die kritische Aktion nach Freigabe aus", async () => {
    let executed = false;
    const result = await runAgentLoop({
      firstResponse: '<app_action>{"action":"mark_invoice_paid","id":"R-2026-014"}</app_action>',
      messages: [],
      approved: true,
      runAction: async (parsed) => {
        executed = true;
        return { kind: parsed.tag, action: "mark_invoice_paid", result: "Rechnung als bezahlt markiert", label: "App · mark_invoice_paid" };
      },
      callModel: async () => "Erledigt. Soll ich die Quittung erstellen?",
    });

    expect(executed).toBe(true);
    expect(result.pending).toHaveLength(0);
    expect(result.steps).toHaveLength(1);
    expect(result.text).toContain("Erledigt");
  });

  it("führt harmlose Aktionen ohne Freigabe direkt aus", async () => {
    const result = await runAgentLoop({
      firstResponse: '<tasks_action>{"action":"create","title":"Nachfassen"}</tasks_action>',
      messages: [],
      runAction: fakeRunner({ create: "Aufgabe erstellt" }),
      callModel: async () => "Aufgabe angelegt. Soll ich eine Frist setzen?",
    });
    expect(result.pending).toHaveLength(0);
    expect(result.steps).toHaveLength(1);
  });

  it("trennt harmlose und kritische Aktionen in derselben Runde", async () => {
    const result = await runAgentLoop({
      firstResponse: '<app_action>{"action":"list_invoices"}</app_action><app_action>{"action":"mark_invoice_paid","id":"R-1"}</app_action>',
      messages: [],
      runAction: fakeRunner({ list_invoices: "5 offen", mark_invoice_paid: "bezahlt" }),
      callModel: async () => "Fünf Rechnungen offen. Soll ich R-1 als bezahlt markieren?",
    });
    expect(result.steps.map((s) => s.action)).toEqual(["list_invoices"]);
    expect(result.pending.map((p) => p.action)).toEqual(["mark_invoice_paid"]);
  });
});

describe("Freigabe im Gespräch erkennen", () => {
  it("erkennt Zustimmung in verschiedenen Formen", () => {
    for (const yes of ["Ja", "ja bitte", "Mach das", "Okay", "einverstanden", "Jä", "Ja, mach"]) {
      expect(isApproval(yes)).toBe(true);
    }
  });

  it("erkennt Ablehnung nicht als Freigabe", () => {
    for (const no of ["Nein", "nicht jetzt", "Abbrechen", "warte", "doch nicht", "Nö"]) {
      expect(isApproval(no)).toBe(false);
    }
  });

  it("wertet eine neue inhaltliche Anfrage nicht als Freigabe", () => {
    expect(isApproval("Zeig mir die offenen Tickets von Muster AG bitte")).toBe(false);
    expect(isApproval("Wie ist das Wetter?")).toBe(false);
  });
});

describe("Zwischenspeicher für Freigaben", () => {
  beforeEach(() => { clearPending(999); });

  it("merkt Aktionen pro Gespräch und gibt sie einmalig zurück", () => {
    rememberPending(999, [{ tag: "app_action", action: "mark_invoice_paid", payload: { id: "R-1" }, description: "Rechnung R-1" }]);
    expect(hasPending(999)).toBe(true);
    const taken = takePending(999);
    expect(taken).toHaveLength(1);
    // Nach dem Abholen ist der Speicher leer – keine doppelte Ausführung
    expect(hasPending(999)).toBe(false);
    expect(takePending(999)).toHaveLength(0);
  });

  it("behält die Vormerkung, wenn zwischendurch keine neue Aktion anfällt", () => {
    rememberPending(999, [{ tag: "app_action", action: "mark_invoice_paid", payload: { id: "R-1" }, description: "Rechnung R-1" }]);
    // Nächste Runde ohne kritische Aktion (z.B. Stefan fragt etwas nach)
    rememberPending(999, []);
    expect(hasPending(999)).toBe(true);
    expect(peekPending(999)).toHaveLength(1);
    // Ansehen verbraucht die Vormerkung nicht
    expect(hasPending(999)).toBe(true);
  });

  it("verwirft die Vormerkung nur bei ausdrücklicher Ablehnung", () => {
    rememberPending(999, [{ tag: "app_action", action: "mark_invoice_paid", payload: { id: "R-1" }, description: "Rechnung R-1" }]);
    clearPending(999);
    expect(hasPending(999)).toBe(false);
  });
});

describe("Ablehnung erkennen", () => {
  it("erkennt klare Ablehnungen", () => {
    for (const no of ["Nein", "nein danke", "Abbrechen", "Stopp", "doch nicht", "Nö"]) {
      expect(isRejection(no)).toBe(true);
    }
  });

  it("wertet Zustimmung nicht als Ablehnung", () => {
    expect(isRejection("Ja bitte")).toBe(false);
    expect(isRejection("Mach das")).toBe(false);
  });

  it("wertet eine neue Anfrage nicht als Ablehnung", () => {
    expect(isRejection("Zeig mir bitte alle offenen Rechnungen von Muster AG")).toBe(false);
  });
});

/**
 * Ende-zu-Ende-Ablauf der Freigabe, wie ihn der Chat-Router umsetzt:
 * vormerken → Rückfrage → Ja/Nein → deterministische Ausführung.
 */
describe("Freigabe-Ablauf im Gespräch", () => {
  const CONV = 4242;
  beforeEach(() => { clearPending(CONV); });

  /** Bildet die Logik aus chat.ts nachvollziehbar ab. */
  async function handleTurn(message: string, executor: (p: PendingAction) => Promise<string>) {
    const wasPending = hasPending(CONV);
    const approved = wasPending && isApproval(message);
    const rejected = wasPending && !approved && isRejection(message);
    if (rejected) { clearPending(CONV); return { executed: [] as string[], state: "rejected" as const }; }
    if (approved) {
      const actions = takePending(CONV);
      const executed: string[] = [];
      for (const p of actions) executed.push(await executor(p));
      return { executed, state: "executed" as const };
    }
    return { executed: [] as string[], state: wasPending ? "still-pending" as const : "none" as const };
  }

  it("führt eine kritische Aktion erst nach klarem Ja aus", async () => {
    // Runde 1: Jarvis merkt die Aktion vor
    const loop = await runAgentLoop({
      firstResponse: '<app_action>{"action":"mark_invoice_paid","id":"R-2026-014"}</app_action>',
      messages: [],
      runAction: async () => { throw new Error("darf nicht ausgeführt werden"); },
      callModel: async () => "Ich habe Rechnung R-2026-014 gefunden.",
    });
    rememberPending(CONV, loop.pending);
    expect(hasPending(CONV)).toBe(true);

    // Runde 2: Stefan fragt etwas anderes – Vormerkung bleibt, nichts wird ausgeführt
    const mid = await handleTurn("Wie hoch war der Betrag nochmal?", async () => "sollte nicht laufen");
    expect(mid.state).toBe("still-pending");
    expect(mid.executed).toHaveLength(0);
    expect(hasPending(CONV)).toBe(true);

    // Runde 3: Stefan stimmt zu – Aktion wird ausgeführt
    const done = await handleTurn("Ja bitte", async (p) => `${p.action} ausgeführt für ${String(p.payload.id)}`);
    expect(done.state).toBe("executed");
    expect(done.executed).toEqual(["mark_invoice_paid ausgeführt für R-2026-014"]);
    // Danach ist die Vormerkung verbraucht – kein zweites Mal
    expect(hasPending(CONV)).toBe(false);
    const again = await handleTurn("Ja", async () => "darf nicht nochmal laufen");
    expect(again.executed).toHaveLength(0);
  });

  it("verwirft die Aktion bei Ablehnung", async () => {
    rememberPending(CONV, [{ tag: "device_action", action: "whatsapp", payload: { recipient: "Bine" }, description: "WhatsApp an Bine" }]);
    const res = await handleTurn("Nein, abbrechen", async () => "darf nicht laufen");
    expect(res.state).toBe("rejected");
    expect(res.executed).toHaveLength(0);
    expect(hasPending(CONV)).toBe(false);
  });
});
