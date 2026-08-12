import {
  bigint,
  boolean,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Conversations (Chat-Sitzungen)
export const conversations = mysqlTable(
  "conversations",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    title: varchar("title", { length: 255 })
      .notNull()
      .default("Neues Gespräch"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => [index("conversations_userId_idx").on(t.userId)]
);

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

// Messages (Nachrichten in einem Gespräch)
export const messages = mysqlTable(
  "messages",
  {
    id: int("id").autoincrement().primaryKey(),
    conversationId: int("conversationId").notNull(),
    role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
    content: text("content").notNull(),
    fileUrl: varchar("fileUrl", { length: 1024 }),
    fileKey: varchar("fileKey", { length: 512 }),
    fileName: varchar("fileName", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  t => [index("messages_conversationId_idx").on(t.conversationId)]
);

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

// Notes (Notizen)
export const notes = mysqlTable(
  "notes",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    content: text("content").notNull(),
    tags: varchar("tags", { length: 512 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => [index("notes_userId_idx").on(t.userId)]
);

export type Note = typeof notes.$inferSelect;
export type InsertNote = typeof notes.$inferInsert;

// Tasks (Aufgaben / Kalender)
export const tasks = mysqlTable(
  "tasks",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    completed: boolean("completed").default(false).notNull(),
    priority: mysqlEnum("priority", ["low", "medium", "high"])
      .default("medium")
      .notNull(),
    dueDate: bigint("dueDate", { mode: "number" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => [
    index("tasks_userId_idx").on(t.userId),
    index("tasks_userId_completed_idx").on(t.userId, t.completed),
  ]
);

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

// Push-Abonnements (Browser Web Push)
export const pushSubscriptions = mysqlTable(
  "push_subscriptions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: varchar("auth", { length: 512 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  t => [index("push_subscriptions_userId_idx").on(t.userId)]
);

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptions.$inferInsert;

// Google OAuth Tokens
export const googleTokens = mysqlTable("google_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken"),
  expiresAt: int("expiresAt").notNull(), // Unix timestamp in seconds
  scope: text("scope"),
  email: varchar("email", { length: 320 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GoogleToken = typeof googleTokens.$inferSelect;
export type InsertGoogleToken = typeof googleTokens.$inferInsert;

// Jarvis Gedächtnis
export const memories = mysqlTable(
  "memories",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    category: varchar("category", { length: 64 }).notNull().default("fact"),
    // Kategorien: person, preference, fact, contact, project, other
    key: varchar("key", { length: 255 }).notNull(),
    value: text("value").notNull(),
    embedding: json("embedding"), // Speichert den Vector als Float-Array für Cosine Similarity
    source: varchar("source", { length: 64 }).default("chat"),
    // source: chat = aus Gespräch gelernt, manual = manuell eingetragen
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => [
    // Lookup nach Nutzer und Upsert-Schlüssel (userId + key) beschleunigen.
    index("memories_userId_idx").on(t.userId),
    index("memories_userId_key_idx").on(t.userId, t.key),
  ]
);

export type Memory = typeof memories.$inferSelect;
export type InsertMemory = typeof memories.$inferInsert;

// Nutzerprofil für Jarvis-Persönlichkeit
export const userProfiles = mysqlTable("user_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  // Persönliche Infos
  displayName: varchar("displayName", { length: 128 }),
  occupation: varchar("occupation", { length: 255 }),
  location: varchar("location", { length: 255 }),
  // Jarvis-Verhalten
  jarvisName: varchar("jarvisName", { length: 64 }).default("Jarvis"),
  addressForm: mysqlEnum("addressForm", ["sir", "du", "name"]).default("sir"),
  // Freitext-Felder
  interests: text("interests"), // Hobbys und Interessen
  workContext: text("workContext"), // Beruflicher Kontext
  personalNotes: text("personalNotes"), // Weitere persönliche Infos
  // Jarvis-Persönlichkeit
  jarvisPersonality: text("jarvisPersonality"), // Eigene Beschreibung wie Jarvis sich verhalten soll
  language: mysqlEnum("language", ["de", "en", "auto"]).default("de"),
  elevenLabsVoiceId: varchar("elevenLabsVoiceId", { length: 64 }).default(
    "JBFqnCBsd6RMkjVDRZzb"
  ), // George (britisch, männlich)
  // Wann Jarvis sprechen soll. "voiceOnly" ist Standard und schont das
  // ElevenLabs-Guthaben, weil getippte Nachrichten stumm bleiben.
  speechMode: mysqlEnum("speechMode", ["always", "voiceOnly", "never"]).default(
    "voiceOnly"
  ),
  // Benachrichtigungen für autonome Hintergrund-Tasks
  notifyPush: boolean("notifyPush").default(false),
  notifyWebpush: boolean("notifyWebpush").default(false),
  notifyEmail: boolean("notifyEmail").default(false),
  notifyChat: boolean("notifyChat").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = typeof userProfiles.$inferInsert;

// ── Agent Tasks (Hintergrund-Aufgaben) ───────────────────────────────────────
export const agentTasks = mysqlTable(
  "agent_tasks",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    executeAt: timestamp("executeAt").notNull(),
    instruction: text("instruction").notNull(),
    status: mysqlEnum("status", ["pending", "completed", "failed"])
      .default("pending")
      .notNull(),
    result: text("result"), // LLM Output nach Ausführung
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => [
    index("agent_tasks_status_executeAt_idx").on(t.status, t.executeAt),
    index("agent_tasks_userId_idx").on(t.userId),
  ]
);
export type AgentTask = typeof agentTasks.$inferSelect;
export type InsertAgentTask = typeof agentTasks.$inferInsert;

// ── Gross ICT Kundenprojekte ──────────────────────────────────────────────────
export const grossIctProjects = mysqlTable(
  "gross_ict_projects",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    customerName: varchar("customerName", { length: 255 }).notNull(),
    customerEmail: varchar("customerEmail", { length: 320 }),
    customerPhone: varchar("customerPhone", { length: 64 }),
    projectTitle: varchar("projectTitle", { length: 255 }).notNull(),
    description: text("description"),
    service: mysqlEnum("service", [
      "website",
      "webapp",
      "app",
      "support",
      "security",
      "network",
      "server",
      "other",
    ])
      .default("other")
      .notNull(),
    status: mysqlEnum("status", [
      "lead",
      "offer",
      "active",
      "completed",
      "cancelled",
    ])
      .default("lead")
      .notNull(),
    budget: int("budget"), // CHF
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => [index("gross_ict_projects_userId_idx").on(t.userId)]
);
export type GrossIctProject = typeof grossIctProjects.$inferSelect;
export type InsertGrossIctProject = typeof grossIctProjects.$inferInsert;

// ── Gross ICT Angebote ────────────────────────────────────────────────────────
export const grossIctQuotes = mysqlTable(
  "gross_ict_quotes",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    projectId: int("projectId"),
    customerName: varchar("customerName", { length: 255 }).notNull(),
    customerEmail: varchar("customerEmail", { length: 320 }),
    title: varchar("title", { length: 255 }).notNull(),
    content: text("content").notNull(), // Markdown-Angebot
    totalAmount: int("totalAmount"), // CHF
    status: mysqlEnum("status", ["draft", "sent", "accepted", "rejected"])
      .default("draft")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => [index("gross_ict_quotes_userId_idx").on(t.userId)]
);
export type GrossIctQuote = typeof grossIctQuotes.$inferSelect;
export type InsertGrossIctQuote = typeof grossIctQuotes.$inferInsert;

// ── Dokumenten-Vorlagen ───────────────────────────────────────────────────────
export const documentTemplates = mysqlTable(
  "document_templates",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    category: mysqlEnum("category", [
      "quote",
      "invoice",
      "concept",
      "report",
      "email",
      "procurement",
      "minutes",
      "other",
    ])
      .default("other")
      .notNull(),
    context: mysqlEnum("context", ["gross_ict", "sonnenberg", "general"])
      .default("general")
      .notNull(),
    description: text("description"),
    content: text("content").notNull(), // Markdown mit {{platzhaltern}}
    placeholders: text("placeholders"), // JSON-Array der Platzhalter-Namen
    isFavorite: boolean("isFavorite").default(false).notNull(),
    usageCount: int("usageCount").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => [index("document_templates_userId_idx").on(t.userId)]
);
export type DocumentTemplate = typeof documentTemplates.$inferSelect;
export type InsertDocumentTemplate = typeof documentTemplates.$inferInsert;

// ── Aufgaben-Delegation ───────────────────────────────────────────────────────
export const delegations = mysqlTable(
  "delegations",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    taskId: int("taskId"), // optional: Verweis auf tasks
    assigneeName: varchar("assigneeName", { length: 128 }).notNull(),
    assigneeEmail: varchar("assigneeEmail", { length: 320 }),
    title: varchar("title", { length: 255 }).notNull(),
    details: text("details"),
    dueDate: bigint("dueDate", { mode: "number" }),
    status: mysqlEnum("status", ["open", "in_progress", "done", "cancelled"])
      .default("open")
      .notNull(),
    emailDraft: text("emailDraft"), // von Jarvis generierter E-Mail-Text
    emailSentAt: bigint("emailSentAt", { mode: "number" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => [index("delegations_userId_idx").on(t.userId)]
);
export type Delegation = typeof delegations.$inferSelect;
export type InsertDelegation = typeof delegations.$inferInsert;

// ── Sprachnotizen ─────────────────────────────────────────────────────────────
export const voiceNotes = mysqlTable(
  "voice_notes",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    transcript: text("transcript").notNull(),
    summary: text("summary"),
    category: varchar("category", { length: 64 }).default("allgemein"),
    audioUrl: varchar("audioUrl", { length: 1024 }),
    durationSec: int("durationSec"),
    noteId: int("noteId"), // wenn als Notiz gespeichert
    taskId: int("taskId"), // wenn als Aufgabe erkannt
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  t => [index("voice_notes_userId_idx").on(t.userId)]
);
export type VoiceNote = typeof voiceNotes.$inferSelect;
export type InsertVoiceNote = typeof voiceNotes.$inferInsert;

// ── Lernende Vorschläge (Nutzungsstatistik von Chat-Intents) ─────────────────
export const promptStats = mysqlTable(
  "prompt_stats",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    intent: varchar("intent", { length: 128 }).notNull(), // z.B. "offene_rechnungen"
    label: varchar("label", { length: 255 }).notNull(), // Anzeigetext für Quick-Action
    promptText: text("promptText").notNull(), // was gesendet wird
    count: int("count").default(1).notNull(),
    lastUsedAt: bigint("lastUsedAt", { mode: "number" }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  t => [
    index("prompt_stats_userId_idx").on(t.userId),
    index("prompt_stats_userId_intent_idx").on(t.userId, t.intent),
  ]
);
export type PromptStat = typeof promptStats.$inferSelect;
export type InsertPromptStat = typeof promptStats.$inferInsert;

// ── Webhook-API-Schlüssel und Eingänge ───────────────────────────────────────
export const webhookKeys = mysqlTable("webhook_keys", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  label: varchar("label", { length: 128 }).notNull(),
  apiKey: varchar("apiKey", { length: 96 }).notNull().unique(),
  isActive: boolean("isActive").default(true).notNull(),
  lastUsedAt: bigint("lastUsedAt", { mode: "number" }),
  callCount: int("callCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type WebhookKey = typeof webhookKeys.$inferSelect;
export type InsertWebhookKey = typeof webhookKeys.$inferInsert;

// Geplante Hintergrund-Tasks
export const scheduledTasks = mysqlTable("scheduled_tasks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  cronExpression: varchar("cronExpression", { length: 100 }), // optional für wiederkehrende
  runAt: timestamp("runAt"), // für einmalige Tasks
  prompt: text("prompt").notNull(), // Der Prompt für den Agenten
  isActive: boolean("isActive").default(true).notNull(),
  lastRunAt: timestamp("lastRunAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ScheduledTask = typeof scheduledTasks.$inferSelect;
export type InsertScheduledTask = typeof scheduledTasks.$inferInsert;

export const webhookEvents = mysqlTable(
  "webhook_events",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    source: varchar("source", { length: 128 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    body: text("body"),
    notified: boolean("notified").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  t => [index("webhook_events_userId_idx").on(t.userId)]
);
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type InsertWebhookEvent = typeof webhookEvents.$inferInsert;

// ── Spotify-Tokens (pro Nutzer) ───────────────────────────────────────────────
export const spotifyTokens = mysqlTable("spotify_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken"),
  expiresAt: int("expiresAt").notNull(), // Unix timestamp in Sekunden
  scope: text("scope"),
  displayName: varchar("displayName", { length: 255 }),
  product: varchar("product", { length: 32 }), // premium | free
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SpotifyToken = typeof spotifyTokens.$inferSelect;
export type InsertSpotifyToken = typeof spotifyTokens.$inferInsert;

// ── Befehls-Queue für iOS-Kurzbefehle (WhatsApp, Wecker, Timer) ───────────────
export const deviceCommands = mysqlTable(
  "device_commands",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    // whatsapp | alarm | timer | reminder | speak
    type: varchar("type", { length: 32 }).notNull(),
    payload: text("payload").notNull(), // JSON-Parameter
    summary: varchar("summary", { length: 255 }), // lesbare Kurzbeschreibung
    status: mysqlEnum("status", ["pending", "delivered", "done", "failed"])
      .default("pending")
      .notNull(),
    deliveredAt: bigint("deliveredAt", { mode: "number" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  t => [
    // Die iOS-Queue pollt nach userId + status = pending; zusammengesetzter Index.
    index("device_commands_userId_status_idx").on(t.userId, t.status),
  ]
);
export type DeviceCommand = typeof deviceCommands.$inferSelect;
export type InsertDeviceCommand = typeof deviceCommands.$inferInsert;

// ── ElevenLabs-Zeichenverbrauch (Free-Plan: 10'000 Zeichen pro Monat) ─────────
export const ttsUsage = mysqlTable(
  "tts_usage",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    /** Abrechnungsmonat im Format YYYY-MM, z.B. 2026-08 */
    yearMonth: varchar("yearMonth", { length: 7 }).notNull(),
    charsUsed: int("charsUsed").default(0).notNull(),
    requestCount: int("requestCount").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => [
    // Upsert/Lookup nach userId + Abrechnungsmonat.
    index("tts_usage_userId_yearMonth_idx").on(t.userId, t.yearMonth),
  ]
);
export type TtsUsage = typeof ttsUsage.$inferSelect;
export type InsertTtsUsage = typeof ttsUsage.$inferInsert;
