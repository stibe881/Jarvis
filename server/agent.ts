/**
 * Agenten-Kern für Jarvis.
 *
 * Bisher konnte Jarvis pro Antwort nur genau einen Aktionsblock ausführen und
 * musste das Ergebnis dem Nutzer sofort zeigen. Dadurch war er kein handelnder
 * Assistent, sondern ein Textgenerator mit einem einzigen Werkzeuggriff.
 *
 * Dieses Modul führt alle Aktionsblöcke einer Antwort aus, gibt die Ergebnisse
 * als Werkzeug-Beobachtung an das Modell zurück und lässt es weiterarbeiten,
 * bis die Aufgabe erledigt ist (mehrstufige Schleife). Damit kann Jarvis
 * eigenständig Daten beschaffen: erst den Kunden suchen, dann dessen Rechnungen
 * laden, dann eine Aufgabe erstellen – alles in einem Zug.
 */

import { executeAppAction } from "./routers/appIntegration";
import { executeSpotifyAction } from "./routers/spotify";
import { queueDeviceCommand } from "./routers/deviceCommands";
import { createNote, createTask, getNotesByUser, getTasksByUser, updateTask, upsertMemory } from "./db";

/** Ein einzelner ausgeführter Schritt – wird dem Nutzer als Protokoll gezeigt. */
export type AgentStep = {
  /** Art des Werkzeugs, z.B. "app" oder "calendar". */
  kind: string;
  /** Konkrete Aktion, z.B. "list_invoices". */
  action: string;
  /** Ergebnis in Textform, wie es das Modell als Beobachtung erhält. */
  result: string;
  /** Kurzbeschreibung für die Anzeige im Chat. */
  label: string;
};

/** Aktionen, die Daten verändern und deshalb im Protokoll hervorgehoben werden. */
const WRITING_ACTIONS = [
  "create_customer", "create_ticket", "create_lead", "create_project", "create_project_task",
  "create_expense", "create_quote", "create_invoice", "update_ticket_status", "update_ticket_priority",
  "add_ticket_comment", "mark_invoice_paid", "update_lead_status", "update_quote_status",
  "create_event", "update_event", "delete_event", "invite_attendee",
  "create_note", "create_task", "complete_task",
];

export function isWritingAction(action: string): boolean {
  return WRITING_ACTIONS.includes(action);
}

/** Alle unterstützten Aktionsblöcke mit ihrem XML-Tag. */
export const ACTION_TAGS = [
  "app_action", "calendar_action", "memory_action",
  "spotify_action", "device_action", "notes_action", "tasks_action",
] as const;

export type ActionTag = (typeof ACTION_TAGS)[number];

export type ParsedAction = {
  tag: ActionTag;
  /** Rohes JSON aus dem Block. */
  payload: Record<string, unknown>;
};

/**
 * Liest alle Aktionsblöcke aus einer Modellantwort und entfernt sie aus dem Text.
 * Gibt den bereinigten Text und die gefundenen Aktionen zurück.
 */
export function parseActions(response: string): { text: string; actions: ParsedAction[] } {
  let text = response;
  const actions: ParsedAction[] = [];

  for (const tag of ACTION_TAGS) {
    const rx = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g");
    let m: RegExpExecArray | null;
    while ((m = rx.exec(response)) !== null) {
      try {
        const payload = JSON.parse(m[1].trim()) as Record<string, unknown>;
        actions.push({ tag, payload });
      } catch {
        // Fehlerhaftes JSON überspringen – der Block wird trotzdem entfernt,
        // damit der Nutzer keinen technischen Müll sieht.
      }
    }
    text = text.replace(new RegExp(`<${tag}>[\\s\\S]*?</${tag}>`, "g"), "");
  }

  return { text: text.replace(/\n{3,}/g, "\n\n").trim(), actions };
}

/** Kurzbeschreibung eines Schritts für die Anzeige im Chat. */
function describe(tag: ActionTag, action: string, params: Record<string, unknown>): string {
  const name = (params.customer ?? params.search ?? params.title ?? params.query ?? params.recipient ?? "") as string;
  const suffix = name ? `: ${String(name).slice(0, 40)}` : "";
  const map: Record<string, string> = {
    app_action: "App",
    calendar_action: "Kalender",
    memory_action: "Gedächtnis",
    spotify_action: "Spotify",
    device_action: "iPhone",
    notes_action: "Notizen",
    tasks_action: "Aufgaben",
  };
  return `${map[tag] ?? tag} · ${action}${suffix}`;
}

/** Werkzeuge rund um Notizen – damit Jarvis selbst nachschlagen und festhalten kann. */
async function executeNotesAction(userId: number, action: string, params: Record<string, unknown>): Promise<string> {
  if (action === "list" || action === "search") {
    const search = typeof params.search === "string" ? params.search : undefined;
    const notes = await getNotesByUser(userId, search);
    if (notes.length === 0) return "Keine Notizen gefunden.";
    return notes.slice(0, 15).map((n) => `- ${n.title}: ${(n.content ?? "").slice(0, 160)}`).join("\n");
  }
  if (action === "create") {
    const title = typeof params.title === "string" ? params.title : "Notiz";
    const content = typeof params.content === "string" ? params.content : "";
    await createNote({ userId, title, content });
    return `Notiz «${title}» wurde gespeichert.`;
  }
  return `Unbekannte Notizen-Aktion: ${action}`;
}

/** Werkzeuge rund um Aufgaben – Jarvis kann Fälligkeiten prüfen und Aufgaben anlegen. */
async function executeTasksAction(userId: number, action: string, params: Record<string, unknown>): Promise<string> {
  if (action === "list") {
    const tasks = await getTasksByUser(userId);
    const open = tasks.filter((t) => !t.completed);
    if (open.length === 0) return "Keine offenen Aufgaben.";
    return open.slice(0, 20).map((t) => {
      const due = t.dueDate ? ` (fällig: ${new Date(t.dueDate).toLocaleDateString("de-CH")})` : "";
      return `- [id:${t.id}] ${t.title}${due} · Priorität: ${t.priority ?? "normal"}`;
    }).join("\n");
  }
  if (action === "create") {
    const title = typeof params.title === "string" ? params.title : "";
    if (!title) return "Für eine Aufgabe wird ein Titel benötigt.";
    const raw = typeof params.priority === "string" ? params.priority : "medium";
    const priority: "low" | "medium" | "high" =
      raw === "low" || raw === "high" ? raw : "medium";
    const parsedDue = typeof params.due_date === "string" ? new Date(params.due_date) : null;
    const dueDate = parsedDue && !Number.isNaN(parsedDue.getTime()) ? parsedDue.getTime() : null;
    await createTask({
      userId, title, priority,
      description: typeof params.description === "string" ? params.description : null,
      dueDate,
    });
    return `Aufgabe «${title}» wurde erstellt.`;
  }
  if (action === "complete") {
    const id = Number(params.id);
    if (!Number.isFinite(id)) return "Für das Abschliessen wird eine Aufgaben-ID benötigt.";
    await updateTask(id, userId, { completed: true });
    return `Aufgabe ${id} wurde als erledigt markiert.`;
  }
  return `Unbekannte Aufgaben-Aktion: ${action}`;
}

export type ExecuteContext = {
  userId: number;
  /** Kalender-Aktionen liegen im Chat-Router, daher als Funktion übergeben. */
  runCalendar: (userId: number, action: string, params: Record<string, unknown>) => Promise<string>;
};

/**
 * Führt eine einzelne Aktion aus und liefert das Ergebnis als Beobachtung.
 * Fehler werden abgefangen und als Text zurückgegeben, damit das Modell
 * darauf reagieren kann statt die ganze Antwort zu verlieren.
 */
export async function executeAction(ctx: ExecuteContext, parsed: ParsedAction): Promise<AgentStep> {
  const { tag, payload } = parsed;
  const action = typeof payload.action === "string" ? payload.action : typeof payload.type === "string" ? payload.type : "";
  const label = describe(tag, action, payload);

  try {
    let result: string;
    switch (tag) {
      case "app_action": {
        const { action: _a, ...params } = payload;
        result = await executeAppAction(action, params);
        break;
      }
      case "calendar_action": {
        result = await ctx.runCalendar(ctx.userId, action, payload);
        break;
      }
      case "memory_action": {
        const key = typeof payload.key === "string" ? payload.key : "";
        const value = typeof payload.value === "string" ? payload.value : "";
        if (!key || !value) { result = "Für das Gedächtnis werden Schlüssel und Wert benötigt."; break; }
        const category = typeof payload.category === "string" ? payload.category : "fact";
        await upsertMemory(ctx.userId, category, key, value, "chat");
        result = `Gemerkt: ${key} = ${value}`;
        break;
      }
      case "spotify_action": {
        const { action: _a, ...params } = payload;
        result = await executeSpotifyAction(ctx.userId, action, params);
        break;
      }
      case "device_action": {
        const { type: _t, ...params } = payload;
        result = await queueDeviceCommand(ctx.userId, action, params);
        break;
      }
      case "notes_action": {
        const { action: _a, ...params } = payload;
        result = await executeNotesAction(ctx.userId, action, params);
        break;
      }
      case "tasks_action": {
        const { action: _a, ...params } = payload;
        result = await executeTasksAction(ctx.userId, action, params);
        break;
      }
      default:
        result = `Unbekanntes Werkzeug: ${tag}`;
    }
    return { kind: tag, action, result, label };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[Agent] ${tag}/${action} fehlgeschlagen:`, msg);
    return { kind: tag, action, result: `Fehler: ${msg}`, label };
  }
}

/** Beobachtungen für das Modell aufbereiten. */
export function formatObservations(steps: AgentStep[]): string {
  return steps
    .map((s) => `[Werkzeug ${s.kind}/${s.action}]\n${s.result}`)
    .join("\n\n");
}

/** Protokoll der ausgeführten Schritte für die Anzeige im Chat. */
/** Marker, an dem das Frontend das Schritt-Protokoll erkennt. */
export const STEP_LOG_MARKER = "⟦schritte⟧ ";

/** Maximale Anzahl Werkzeug-Runden pro Anfrage. */
export const MAX_AGENT_ROUNDS = 5;

/**
 * Prüft, ob eine Antwort mit einem konkreten nächsten Schritt endet.
 *
 * Jarvis soll nach datenhaltigen Antworten immer einen ausführbaren Vorschlag
 * machen. Fehlt dieser, ergänzt `ensureNextStep` einen passenden Satz, damit
 * ein "Ja" von Stefan genügt.
 */
export function hasNextStep(text: string): boolean {
  const tail = text.slice(-320).toLowerCase();
  if (!tail.includes("?")) return false;
  // Floskeln zählen nicht als konkreter Vorschlag
  const empty = ["kann ich sonst", "sonst noch etwas", "brauchst du noch", "wie kann ich dir"];
  if (empty.some((p) => tail.includes(p))) return false;
  const concrete = ["soll ich", "möchtest du, dass ich", "darf ich", "sollen wir"];
  return concrete.some((p) => tail.includes(p));
}

/**
 * Ergänzt bei Bedarf einen konkreten nächsten Schritt, passend zu den
 * ausgeführten Werkzeugen. Antworten ohne Werkzeugeinsatz bleiben unverändert.
 */
export function ensureNextStep(text: string, steps: AgentStep[]): string {
  if (steps.length === 0 || hasNextStep(text)) return text;

  const actions = steps.map((s) => s.action);
  let suggestion = "Soll ich daraus eine Aufgabe mit Frist anlegen?";
  if (actions.some((a) => a.includes("overdue"))) {
    suggestion = "Soll ich für die überfälligen Posten Zahlungserinnerungen vorbereiten?";
  } else if (actions.some((a) => a.includes("invoice"))) {
    suggestion = "Soll ich zu den offenen Rechnungen eine Nachfass-Aufgabe anlegen?";
  } else if (actions.some((a) => a.includes("quote"))) {
    suggestion = "Soll ich beim Kunden zum Angebot nachfassen?";
  } else if (actions.some((a) => a.includes("ticket"))) {
    suggestion = "Soll ich ein Ticket priorisieren oder einen Kommentar hinterlegen?";
  } else if (actions.some((a) => a.includes("event"))) {
    suggestion = "Soll ich einen dieser Termine verschieben oder eine Erinnerung setzen?";
  } else if (actions.some((a) => a.includes("dossier") || a.includes("customer"))) {
    suggestion = "Soll ich für diesen Kunden den nächsten Schritt vorbereiten?";
  }
  return `${text.trim()}\n\n${suggestion}`;
}

/** Eine Nachricht, wie sie an das Modell geht. */
export type LoopMessage = { role: "system" | "user" | "assistant"; content: unknown };

export type RunAgentLoopOptions = {
  /** Erste Modellantwort, die möglicherweise Aktionsblöcke enthält. */
  firstResponse: string;
  /** Gesprächsverlauf, wird um Beobachtungen erweitert. */
  messages: LoopMessage[];
  /** Ruft das Modell erneut auf und liefert die nächste Antwort. */
  callModel: (messages: LoopMessage[]) => Promise<string>;
  /** Führt eine einzelne Aktion aus. */
  runAction: (parsed: ParsedAction) => Promise<AgentStep>;
  /** Maximale Anzahl Runden. */
  maxRounds?: number;
};

/**
 * Mehrstufige Werkzeugnutzung: führt alle Aktionsblöcke aus, gibt die
 * Ergebnisse als Beobachtung zurück und lässt das Modell weiterarbeiten,
 * bis keine Aktionen mehr angefordert werden.
 *
 * Dadurch kann Jarvis fehlende Daten selbst beschaffen: erst den Kunden
 * suchen, dann mit der erhaltenen ID die nächste Aktion ausführen.
 */
export async function runAgentLoop(opts: RunAgentLoopOptions): Promise<{ text: string; steps: AgentStep[]; rounds: number }> {
  const maxRounds = opts.maxRounds ?? MAX_AGENT_ROUNDS;
  const steps: AgentStep[] = [];
  let current = opts.firstResponse;
  let rounds = 0;

  for (let round = 0; round < maxRounds; round++) {
    const { text, actions } = parseActions(current);
    if (actions.length === 0) { current = text; break; }

    rounds++;
    const roundSteps: AgentStep[] = [];
    for (const parsed of actions) {
      const step = await opts.runAction(parsed);
      roundSteps.push(step);
      steps.push(step);
    }

    opts.messages.push({ role: "assistant", content: text || "(Werkzeuge werden ausgeführt)" });
    opts.messages.push({
      role: "user",
      content: `[Ergebnisse deiner Werkzeuge – der Nutzer sieht diese Nachricht nicht]\n\n${formatObservations(roundSteps)}\n\nWenn du für die Aufgabe noch Daten brauchst, nutze weitere Aktionsblöcke. Wenn du alles hast, formuliere jetzt die endgültige Antwort – ohne Aktionsblöcke, mit den konkreten Zahlen und Namen aus den Ergebnissen. Schliesse mit genau einem konkreten Vorschlag für den nächsten Schritt.`,
    });

    current = await opts.callModel(opts.messages);

    if (round === maxRounds - 1) current = parseActions(current).text;
  }

  return { text: ensureNextStep(current.trim(), steps), steps, rounds };
}

export function formatStepLog(steps: AgentStep[]): string {
  if (steps.length === 0) return "";
  // Eigener Marker, den das Frontend als aufklappbares Protokoll rendert.
  // Bewusst kein HTML, damit die Markdown-Ausgabe sauber bleibt.
  const lines = steps.map((s) => s.label);
  return `\n\n${STEP_LOG_MARKER}${lines.join(" | ")}`;
}
