import { describe, it, expect } from "vitest";
import {
  parseActions, formatObservations, formatStepLog, isWritingAction, STEP_LOG_MARKER,
  hasNextStep, ensureNextStep, runAgentLoop, type AgentStep, type LoopMessage, type ParsedAction,
} from "./agent";
import { stripForSpeech } from "./ttsBudget";

describe("Aktionsblöcke erkennen", () => {
  it("findet einen app_action-Block und entfernt ihn aus dem Text", () => {
    const raw = 'Ich schaue nach.\n<app_action>{"action":"list_overdue_invoices"}</app_action>';
    const { text, actions } = parseActions(raw);
    expect(actions).toHaveLength(1);
    expect(actions[0].tag).toBe("app_action");
    expect(actions[0].payload.action).toBe("list_overdue_invoices");
    expect(text).toBe("Ich schaue nach.");
    expect(text).not.toContain("app_action");
  });

  it("erkennt mehrere Aktionen unterschiedlicher Werkzeuge in einer Antwort", () => {
    const raw = [
      "Einen Moment.",
      '<app_action>{"action":"dashboard"}</app_action>',
      '<tasks_action>{"action":"list"}</tasks_action>',
      '<calendar_action>{"action":"list_events"}</calendar_action>',
    ].join("\n");
    const { text, actions } = parseActions(raw);
    expect(actions).toHaveLength(3);
    expect(actions.map((a) => a.tag).sort()).toEqual(["app_action", "calendar_action", "tasks_action"]);
    expect(text).toBe("Einen Moment.");
  });

  it("erkennt mehrere Blöcke desselben Werkzeugs", () => {
    const raw = '<app_action>{"action":"dashboard"}</app_action><app_action>{"action":"list_leads"}</app_action>';
    const { actions } = parseActions(raw);
    expect(actions).toHaveLength(2);
  });

  it("entfernt fehlerhaftes JSON aus dem Text ohne die Antwort zu verlieren", () => {
    const raw = 'Hier bitte.\n<app_action>{kaputt}</app_action>';
    const { text, actions } = parseActions(raw);
    expect(actions).toHaveLength(0);
    expect(text).toBe("Hier bitte.");
    expect(text).not.toContain("app_action");
  });

  it("lässt Antworten ohne Aktionen unverändert", () => {
    const { text, actions } = parseActions("Guten Morgen, Sir.");
    expect(actions).toHaveLength(0);
    expect(text).toBe("Guten Morgen, Sir.");
  });

  it("erkennt device_action über das Feld type", () => {
    const raw = '<device_action>{"type":"alarm","time":"06:30"}</device_action>';
    const { actions } = parseActions(raw);
    expect(actions[0].payload.type).toBe("alarm");
  });
});

describe("Beobachtungen für das Modell", () => {
  it("stellt Werkzeug-Ergebnisse strukturiert dar", () => {
    const steps: AgentStep[] = [
      { kind: "app_action", action: "list_overdue_invoices", result: "5 Rechnungen offen", label: "App · list_overdue_invoices" },
    ];
    const out = formatObservations(steps);
    expect(out).toContain("[Werkzeug app_action/list_overdue_invoices]");
    expect(out).toContain("5 Rechnungen offen");
  });
});

describe("Schritt-Protokoll", () => {
  const steps: AgentStep[] = [
    { kind: "app_action", action: "list_customers", result: "ok", label: "App · list_customers: Muster" },
    { kind: "tasks_action", action: "create", result: "ok", label: "Aufgaben · create" },
  ];

  it("hängt das Protokoll mit Marker an", () => {
    const log = formatStepLog(steps);
    expect(log).toContain(STEP_LOG_MARKER);
    expect(log).toContain("App · list_customers: Muster");
    expect(log).toContain("Aufgaben · create");
  });

  it("liefert bei fehlenden Schritten einen leeren String", () => {
    expect(formatStepLog([])).toBe("");
  });

  it("wird nicht mitgesprochen", () => {
    const answer = "Fünf Rechnungen sind offen." + formatStepLog(steps);
    expect(stripForSpeech(answer)).toBe("Fünf Rechnungen sind offen.");
  });
});

describe("Schreibende Aktionen", () => {
  it("erkennt verändernde Aktionen", () => {
    expect(isWritingAction("mark_invoice_paid")).toBe(true);
    expect(isWritingAction("create_invoice")).toBe(true);
    expect(isWritingAction("delete_event")).toBe(true);
  });

  it("stuft lesende Aktionen nicht als verändernd ein", () => {
    expect(isWritingAction("dashboard")).toBe(false);
    expect(isWritingAction("list_customers")).toBe(false);
    expect(isWritingAction("customer_dossier")).toBe(false);
  });
});

describe("Konkreter nächster Schritt", () => {
  it("erkennt einen konkreten Vorschlag", () => {
    expect(hasNextStep("Fünf Rechnungen offen. Soll ich Mahnungen vorbereiten?")).toBe(true);
    expect(hasNextStep("Möchtest du, dass ich eine Aufgabe anlege?")).toBe(true);
  });

  it("wertet Floskeln nicht als Vorschlag", () => {
    expect(hasNextStep("Hier die Liste. Kann ich sonst noch etwas tun?")).toBe(false);
    expect(hasNextStep("Das war alles.")).toBe(false);
  });

  it("ergänzt einen passenden Vorschlag nach Werkzeugeinsatz", () => {
    const steps: AgentStep[] = [
      { kind: "app_action", action: "list_overdue_invoices", result: "ok", label: "App · list_overdue_invoices" },
    ];
    const out = ensureNextStep("Es sind fünf Rechnungen überfällig.", steps);
    expect(out).toContain("Zahlungserinnerungen");
    expect(hasNextStep(out)).toBe(true);
  });

  it("lässt Antworten ohne Werkzeugeinsatz unverändert", () => {
    expect(ensureNextStep("Guten Morgen, Sir.", [])).toBe("Guten Morgen, Sir.");
  });

  it("ergänzt nichts, wenn schon ein Vorschlag vorhanden ist", () => {
    const steps: AgentStep[] = [{ kind: "app_action", action: "dashboard", result: "ok", label: "App · dashboard" }];
    const text = "Alles im grünen Bereich. Soll ich die Details zeigen?";
    expect(ensureNextStep(text, steps)).toBe(text);
  });
});

describe("Mehrstufige Werkzeugnutzung", () => {
  /** Hilfsfunktion: Aktion ausführen mit vorgegebenen Ergebnissen. */
  const fakeRunner = (results: Record<string, string>) => async (parsed: ParsedAction): Promise<AgentStep> => {
    const action = String(parsed.payload.action ?? parsed.payload.type ?? "");
    return { kind: parsed.tag, action, result: results[action] ?? "ok", label: `${parsed.tag} · ${action}` };
  };

  it("beschafft fehlende Daten selbst: erst Kunde suchen, dann Ticket erstellen", async () => {
    const modelAnswers = [
      // Runde 2: nutzt die gefundene ID
      '<app_action>{"action":"create_ticket","customer_id":"cust-77","title":"Drucker defekt"}</app_action>',
      // Runde 3: fertige Antwort
      "Das Ticket für Muster AG wurde erstellt. Soll ich es priorisieren?",
    ];
    let call = 0;
    const messages: LoopMessage[] = [{ role: "system", content: "prompt" }];

    const result = await runAgentLoop({
      firstResponse: 'Ich suche den Kunden.\n<app_action>{"action":"list_customers","search":"Muster"}</app_action>',
      messages,
      runAction: fakeRunner({
        list_customers: "Muster AG (id: cust-77)",
        create_ticket: "Ticket T-118 erstellt",
      }),
      callModel: async () => modelAnswers[call++],
    });

    expect(result.rounds).toBe(2);
    expect(result.steps.map((s) => s.action)).toEqual(["list_customers", "create_ticket"]);
    expect(result.text).toContain("Ticket für Muster AG");
    // Die Kunden-ID wurde nie beim Nutzer erfragt, sondern selbst beschafft
    expect(result.text).not.toContain("welche ID");
  });

  it("gibt die Beobachtungen an das Modell zurück", async () => {
    const messages: LoopMessage[] = [];
    await runAgentLoop({
      firstResponse: '<app_action>{"action":"dashboard"}</app_action>',
      messages,
      runAction: fakeRunner({ dashboard: "22 Kunden, 5 überfällige Rechnungen" }),
      callModel: async () => "Alles erfasst. Soll ich die überfälligen Rechnungen zeigen?",
    });
    const observation = messages.find((m) => typeof m.content === "string" && (m.content as string).includes("[Werkzeug "));
    expect(observation).toBeDefined();
    expect(String(observation?.content)).toContain("22 Kunden");
  });

  it("beendet die Schleife ohne Aktionen sofort", async () => {
    const result = await runAgentLoop({
      firstResponse: "Guten Morgen, Sir.",
      messages: [],
      runAction: fakeRunner({}),
      callModel: async () => { throw new Error("darf nicht aufgerufen werden"); },
    });
    expect(result.rounds).toBe(0);
    expect(result.steps).toHaveLength(0);
    expect(result.text).toBe("Guten Morgen, Sir.");
  });

  it("bricht nach der Höchstzahl an Runden ab und liefert saubere Antwort", async () => {
    const result = await runAgentLoop({
      firstResponse: '<app_action>{"action":"dashboard"}</app_action>',
      messages: [],
      // Das Modell fordert endlos weitere Aktionen
      callModel: async () => '<app_action>{"action":"dashboard"}</app_action>',
      runAction: fakeRunner({ dashboard: "ok" }),
      maxRounds: 3,
    });
    expect(result.rounds).toBe(3);
    expect(result.text).not.toContain("app_action");
  });

  it("führt mehrere Aktionen einer Runde parallel im Protokoll", async () => {
    const result = await runAgentLoop({
      firstResponse: '<app_action>{"action":"dashboard"}</app_action><tasks_action>{"action":"list"}</tasks_action>',
      messages: [],
      runAction: fakeRunner({ dashboard: "ok", list: "3 Aufgaben" }),
      callModel: async () => "Zusammengefasst. Soll ich priorisieren?",
    });
    expect(result.steps).toHaveLength(2);
    expect(result.rounds).toBe(1);
  });

  it("verliert bei einem Werkzeugfehler die Antwort nicht", async () => {
    const result = await runAgentLoop({
      firstResponse: '<app_action>{"action":"mark_invoice_paid","id":"x"}</app_action>',
      messages: [],
      runAction: async (parsed) => ({
        kind: parsed.tag, action: "mark_invoice_paid",
        result: "Fehler: Rechnung nicht gefunden", label: "App · mark_invoice_paid",
      }),
      callModel: async () => "Die Rechnung wurde nicht gefunden. Soll ich nach der richtigen Nummer suchen?",
    });
    expect(result.text).toContain("nicht gefunden");
    expect(hasNextStep(result.text)).toBe(true);
  });
});
