import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock DB-Funktionen
vi.mock("./db", () => ({
  createNote: vi.fn().mockResolvedValue({ id: 1 }),
  getNotesByUser: vi.fn().mockResolvedValue([
    { id: 1, userId: 1, title: "Test-Notiz", content: "Inhalt", tags: "test", createdAt: new Date(), updatedAt: new Date() },
  ]),
  getNoteById: vi.fn().mockResolvedValue({ id: 1, userId: 1, title: "Test-Notiz", content: "Inhalt", tags: null, createdAt: new Date(), updatedAt: new Date() }),
  updateNote: vi.fn().mockResolvedValue(undefined),
  deleteNote: vi.fn().mockResolvedValue(undefined),
  createTask: vi.fn().mockResolvedValue({ id: 1 }),
  getTasksByUser: vi.fn().mockResolvedValue([
    { id: 1, userId: 1, title: "Test-Aufgabe", description: null, completed: false, priority: "medium", dueDate: null, createdAt: new Date(), updatedAt: new Date() },
  ]),
  updateTask: vi.fn().mockResolvedValue(undefined),
  deleteTask: vi.fn().mockResolvedValue(undefined),
  createConversation: vi.fn().mockResolvedValue({ id: 1 }),
  getConversationsByUser: vi.fn().mockResolvedValue([]),
  getConversationById: vi.fn().mockResolvedValue({ id: 1, userId: 1, title: "Test", createdAt: new Date(), updatedAt: new Date() }),
  getMessagesByConversation: vi.fn().mockResolvedValue([]),
  addMessage: vi.fn().mockResolvedValue({ id: 1 }),
  deleteConversation: vi.fn().mockResolvedValue(undefined),
  updateConversationTitle: vi.fn().mockResolvedValue(undefined),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ key: "test-key", url: "/manus-storage/test-key" }),
}));

vi.mock("./_core/voiceTranscription", () => ({
  transcribeAudio: vi.fn().mockResolvedValue({ text: "Transkribierter Text", language: "de", duration: 2, segments: [] }),
}));

function makeCtx(userId = 1): TrpcContext {
  return {
    user: {
      id: userId,
      openId: "test-open-id",
      name: "Test Nutzer",
      email: "test@example.com",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("Jarvis – Notizen-Router", () => {
  it("listet Notizen eines Nutzers auf", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.notes.list({});
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]).toHaveProperty("title");
  });

  it("erstellt eine neue Notiz", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.notes.create({ title: "Neue Notiz", content: "Inhalt hier", tags: "test" });
    expect(result).toHaveProperty("id");
  });

  it("aktualisiert eine Notiz", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.notes.update({ id: 1, title: "Aktualisierter Titel" });
    expect(result).toEqual({ success: true });
  });

  it("löscht eine Notiz", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.notes.delete({ id: 1 });
    expect(result).toEqual({ success: true });
  });
});

describe("Jarvis – Aufgaben-Router", () => {
  it("listet Aufgaben eines Nutzers auf", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.tasks.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("erstellt eine neue Aufgabe", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.tasks.create({ title: "Neue Aufgabe", priority: "high" });
    expect(result).toHaveProperty("id");
  });

  it("markiert eine Aufgabe als erledigt", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.tasks.toggleComplete({ id: 1, completed: true });
    expect(result).toEqual({ success: true });
  });

  it("löscht eine Aufgabe", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.tasks.delete({ id: 1 });
    expect(result).toEqual({ success: true });
  });
});

describe("Jarvis – Chat-Router", () => {
  it("listet Gespräche eines Nutzers auf", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.chat.listConversations();
    expect(Array.isArray(result)).toBe(true);
  });

  it("erstellt ein neues Gespräch", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.chat.createConversation({ title: "Neues Gespräch" });
    expect(result).toHaveProperty("id");
  });

  it("ruft Nachrichten eines Gesprächs ab", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.chat.getMessages({ conversationId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("löscht ein Gespräch", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.chat.deleteConversation({ id: 1 });
    expect(result).toEqual({ success: true });
  });
});

describe("Jarvis – Auth-Router", () => {
  it("gibt den aktuellen Nutzer zurück", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toHaveProperty("id", 1);
    expect(result).toHaveProperty("name", "Test Nutzer");
  });
});
