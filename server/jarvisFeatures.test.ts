import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ── DB-Mocks für die neuen Features ──────────────────────────────────────────

vi.mock("./db", () => ({
  // Vorlagen
  createTemplate: vi.fn().mockResolvedValue({ id: 7 }),
  getTemplatesByUser: vi.fn().mockResolvedValue([
    {
      id: 7,
      userId: 1,
      name: "Angebot Webseite",
      category: "quote",
      context: "gross_ict",
      description: "Standard-Angebot",
      content: "Kunde: {{Kundenname}}\nPreis: {{Betrag}}",
      placeholders: JSON.stringify(["Kundenname", "Betrag"]),
      isFavorite: false,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  getTemplateById: vi.fn().mockResolvedValue({
    id: 7,
    userId: 1,
    name: "Angebot Webseite",
    category: "quote",
    context: "gross_ict",
    description: null,
    content: "Kunde: {{Kundenname}}\nPreis: {{Betrag}}",
    placeholders: JSON.stringify(["Kundenname", "Betrag"]),
    isFavorite: false,
    usageCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  updateTemplate: vi.fn().mockResolvedValue(undefined),
  deleteTemplate: vi.fn().mockResolvedValue(undefined),
  incrementTemplateUsage: vi.fn().mockResolvedValue(undefined),
  // Delegation
  createDelegation: vi.fn().mockResolvedValue({ id: 3 }),
  getDelegationsByUser: vi.fn().mockResolvedValue([
    {
      id: 3,
      userId: 1,
      assigneeName: "Bine",
      assigneeEmail: "bine@example.com",
      title: "Rechnung prüfen",
      details: null,
      dueDate: null,
      status: "open",
      emailDraft: "Betreff: Rechnung prüfen\n\nHallo Bine",
      emailSentAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  getDelegationById: vi.fn().mockResolvedValue({
    id: 3,
    userId: 1,
    assigneeName: "Bine",
    assigneeEmail: "bine@example.com",
    title: "Rechnung prüfen",
    details: null,
    dueDate: null,
    status: "open",
    emailDraft: null,
    emailSentAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  updateDelegation: vi.fn().mockResolvedValue(undefined),
  deleteDelegation: vi.fn().mockResolvedValue(undefined),
  // Sprachnotizen
  createVoiceNote: vi.fn().mockResolvedValue({ id: 11 }),
  getVoiceNotesByUser: vi.fn().mockResolvedValue([
    {
      id: 11,
      userId: 1,
      transcript: "Bine anrufen wegen Rechnung",
      summary: "Bine anrufen",
      category: "task",
      durationSec: 4,
      noteId: null,
      taskId: 5,
      createdAt: new Date(),
    },
  ]),
  deleteVoiceNote: vi.fn().mockResolvedValue(undefined),
  // Webhooks
  createWebhookKey: vi
    .fn()
    .mockResolvedValue({ id: 2, apiKey: "jarvis_testkey_123456" }),
  getWebhookKeysByUser: vi.fn().mockResolvedValue([
    {
      id: 2,
      userId: 1,
      label: "Gross ICT App",
      apiKey: "jarvis_testkey_123456",
      isActive: true,
      callCount: 0,
      lastUsedAt: null,
      createdAt: new Date(),
    },
  ]),
  deleteWebhookKey: vi.fn().mockResolvedValue(undefined),
  findWebhookKey: vi.fn().mockResolvedValue(null),
  touchWebhookKey: vi.fn().mockResolvedValue(undefined),
  createWebhookEvent: vi.fn().mockResolvedValue({ id: 1 }),
  getWebhookEventsByUser: vi.fn().mockResolvedValue([
    {
      id: 1,
      userId: 1,
      source: "Gross ICT App",
      title: "Neues Ticket",
      body: "Drucker",
      notified: true,
      createdAt: new Date(),
    },
  ]),
  // Prompt-Statistik
  trackPrompt: vi.fn().mockResolvedValue(undefined),
  getTopPrompts: vi.fn().mockResolvedValue([
    {
      intent: "offene_rechnungen",
      label: "Offene Rechnungen zeigen",
      promptText: "Zeige mir alle offenen Rechnungen.",
      count: 5,
    },
  ]),
  // Notizen/Aufgaben (von Sprachnotizen genutzt)
  createNote: vi.fn().mockResolvedValue({ id: 21 }),
  createTask: vi.fn().mockResolvedValue({ id: 22 }),
  getNotesByUser: vi.fn().mockResolvedValue([]),
  getTasksByUser: vi.fn().mockResolvedValue([]),
  // Chat/Konversationen
  createConversation: vi.fn().mockResolvedValue({ id: 1 }),
  getConversationsByUser: vi.fn().mockResolvedValue([]),
  getConversationById: vi.fn().mockResolvedValue({
    id: 1,
    userId: 1,
    title: "Test",
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  getMessagesByConversation: vi.fn().mockResolvedValue([]),
  addMessage: vi.fn().mockResolvedValue({ id: 1 }),
  deleteConversation: vi.fn().mockResolvedValue(undefined),
  updateConversationTitle: vi.fn().mockResolvedValue(undefined),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
  getMemoriesByUser: vi.fn().mockResolvedValue([]),
  upsertMemory: vi.fn().mockResolvedValue(undefined),
  getUserProfile: vi.fn().mockResolvedValue(null),
  getGoogleTokens: vi.fn().mockResolvedValue(null),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content:
            "Betreff: Rechnung prüfen\n\nHallo Bine\n\nBitte prüfe die Rechnung.\n\nFreundliche Grüsse\nStefan",
        },
      },
    ],
  }),
}));

vi.mock("./routers/elevenlabs", () => ({
  elevenLabsRouter: { _def: { procedures: {} } },
  transcribeWithElevenLabs: vi
    .fn()
    .mockResolvedValue("Bine anrufen wegen der offenen Rechnung"),
}));

function makeCtx(userId = 1): TrpcContext {
  return {
    user: {
      id: userId,
      openId: "test-open-id",
      name: "Stefan",
      email: "stefan@example.com",
      role: "admin",
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    req: {} as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res: {} as any,
  } as unknown as TrpcContext;
}

describe("Vorlagen", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listet Vorlagen des Nutzers", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.templates.list();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Angebot Webseite");
  });

  it("erkennt Platzhalter beim Erstellen automatisch", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const db = await import("./db");
    await caller.templates.create({
      name: "Test-Vorlage",
      category: "quote",
      context: "gross_ict",
      content: "Sehr geehrte {{Anrede}}, Betrag: {{Betrag}}, Frist: {{Frist}}",
    });
    expect(db.createTemplate).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const arg = (db.createTemplate as any).mock.calls[0][0];
    const placeholders = JSON.parse(arg.placeholders) as string[];
    expect(placeholders).toEqual(["Anrede", "Betrag", "Frist"]);
  });

  it("setzt Werte ohne KI direkt ein", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.templates.fill({
      id: 7,
      values: { Kundenname: "Muster AG", Betrag: "CHF 2'500" },
      autoComplete: false,
    });
    expect(result.content).toContain("Muster AG");
    expect(result.content).toContain("CHF 2'500");
    expect(result.content).not.toContain("{{");
  });
});

describe("Delegation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("erstellt eine Delegation mit E-Mail-Entwurf", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const db = await import("./db");
    const result = await caller.delegation.create({
      assigneeName: "Bine",
      assigneeEmail: "bine@example.com",
      title: "Rechnung prüfen",
      generateEmail: true,
    });
    expect(result.id).toBe(3);
    expect(db.createDelegation).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const arg = (db.createDelegation as any).mock.calls[0][0];
    expect(arg.emailDraft).toContain("Betreff:");
  });

  it("listet Delegationen", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.delegation.list();
    expect(result[0].assigneeName).toBe("Bine");
  });
});

describe("Webhook-API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("erstellt einen API-Schlüssel mit Präfix jv_", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const db = await import("./db");
    await caller.webhooks.createKey({ label: "Gross ICT App" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const key = (db.createWebhookKey as any).mock.calls[0][2] as string;
    expect(key.startsWith("jv_")).toBe(true);
    expect(key.length).toBeGreaterThan(20);
  });

  it("listet empfangene Ereignisse", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const events = await caller.webhooks.listEvents({ limit: 10 });
    expect(events[0].title).toBe("Neues Ticket");
  });
});

describe("Sprachnotizen", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listet gespeicherte Sprachnotizen", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.voiceNotes.list();
    expect(result[0].transcript).toContain("Bine");
  });
});

describe("Lernende Vorschläge", () => {
  beforeEach(() => vi.clearAllMocks());

  it("liefert genau vier Vorschläge und priorisiert häufige Anfragen", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.chat.suggestions();
    expect(result).toHaveLength(4);
    expect(result[0].label).toBe("Offene Rechnungen zeigen");
  });
});
