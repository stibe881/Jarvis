import { bigint, boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull().default("Neues Gespräch"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

// Messages (Nachrichten in einem Gespräch)
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: text("content").notNull(),
  fileUrl: varchar("fileUrl", { length: 1024 }),
  fileKey: varchar("fileKey", { length: 512 }),
  fileName: varchar("fileName", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

// Notes (Notizen)
export const notes = mysqlTable("notes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  tags: varchar("tags", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Note = typeof notes.$inferSelect;
export type InsertNote = typeof notes.$inferInsert;

// Tasks (Aufgaben / Kalender)
export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  completed: boolean("completed").default(false).notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high"]).default("medium").notNull(),
  dueDate: bigint("dueDate", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

// Push-Abonnements (Browser Web Push)
export const pushSubscriptions = mysqlTable("push_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: varchar("auth", { length: 512 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

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
export const memories = mysqlTable("memories", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  category: varchar("category", { length: 64 }).notNull().default("fact"),
  // Kategorien: person, preference, fact, contact, project, other
  key: varchar("key", { length: 255 }).notNull(),
  value: text("value").notNull(),
  source: varchar("source", { length: 64 }).default("chat"),
  // source: chat = aus Gespräch gelernt, manual = manuell eingetragen
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

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
  interests: text("interests"),       // Hobbys und Interessen
  workContext: text("workContext"),    // Beruflicher Kontext
  personalNotes: text("personalNotes"), // Weitere persönliche Infos
  // Jarvis-Persönlichkeit
  jarvisPersonality: text("jarvisPersonality"), // Eigene Beschreibung wie Jarvis sich verhalten soll
  language: mysqlEnum("language", ["de", "en", "auto"]).default("de"),
  elevenLabsVoiceId: varchar("elevenLabsVoiceId", { length: 64 }).default("JBFqnCBsd6RMkjVDRZzb"), // George (britisch, männlich)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = typeof userProfiles.$inferInsert;

// ── Gross ICT Kundenprojekte ──────────────────────────────────────────────────
export const grossIctProjects = mysqlTable("gross_ict_projects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  customerName: varchar("customerName", { length: 255 }).notNull(),
  customerEmail: varchar("customerEmail", { length: 320 }),
  customerPhone: varchar("customerPhone", { length: 64 }),
  projectTitle: varchar("projectTitle", { length: 255 }).notNull(),
  description: text("description"),
  service: mysqlEnum("service", ["website", "webapp", "app", "support", "security", "network", "server", "other"]).default("other").notNull(),
  status: mysqlEnum("status", ["lead", "offer", "active", "completed", "cancelled"]).default("lead").notNull(),
  budget: int("budget"), // CHF
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type GrossIctProject = typeof grossIctProjects.$inferSelect;
export type InsertGrossIctProject = typeof grossIctProjects.$inferInsert;

// ── Gross ICT Angebote ────────────────────────────────────────────────────────
export const grossIctQuotes = mysqlTable("gross_ict_quotes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId"),
  customerName: varchar("customerName", { length: 255 }).notNull(),
  customerEmail: varchar("customerEmail", { length: 320 }),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(), // Markdown-Angebot
  totalAmount: int("totalAmount"), // CHF
  status: mysqlEnum("status", ["draft", "sent", "accepted", "rejected"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type GrossIctQuote = typeof grossIctQuotes.$inferSelect;
export type InsertGrossIctQuote = typeof grossIctQuotes.$inferInsert;

// ── Dokumenten-Vorlagen ───────────────────────────────────────────────────────
export const documentTemplates = mysqlTable("document_templates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  category: mysqlEnum("category", ["quote", "invoice", "concept", "report", "email", "procurement", "minutes", "other"]).default("other").notNull(),
  context: mysqlEnum("context", ["gross_ict", "sonnenberg", "general"]).default("general").notNull(),
  description: text("description"),
  content: text("content").notNull(), // Markdown mit {{platzhaltern}}
  placeholders: text("placeholders"), // JSON-Array der Platzhalter-Namen
  isFavorite: boolean("isFavorite").default(false).notNull(),
  usageCount: int("usageCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type DocumentTemplate = typeof documentTemplates.$inferSelect;
export type InsertDocumentTemplate = typeof documentTemplates.$inferInsert;

// ── Aufgaben-Delegation ───────────────────────────────────────────────────────
export const delegations = mysqlTable("delegations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  taskId: int("taskId"), // optional: Verweis auf tasks
  assigneeName: varchar("assigneeName", { length: 128 }).notNull(),
  assigneeEmail: varchar("assigneeEmail", { length: 320 }),
  title: varchar("title", { length: 255 }).notNull(),
  details: text("details"),
  dueDate: bigint("dueDate", { mode: "number" }),
  status: mysqlEnum("status", ["open", "in_progress", "done", "cancelled"]).default("open").notNull(),
  emailDraft: text("emailDraft"), // von Jarvis generierter E-Mail-Text
  emailSentAt: bigint("emailSentAt", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Delegation = typeof delegations.$inferSelect;
export type InsertDelegation = typeof delegations.$inferInsert;

// ── Sprachnotizen ─────────────────────────────────────────────────────────────
export const voiceNotes = mysqlTable("voice_notes", {
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
});
export type VoiceNote = typeof voiceNotes.$inferSelect;
export type InsertVoiceNote = typeof voiceNotes.$inferInsert;

// ── Lernende Vorschläge (Nutzungsstatistik von Chat-Intents) ─────────────────
export const promptStats = mysqlTable("prompt_stats", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  intent: varchar("intent", { length: 128 }).notNull(), // z.B. "offene_rechnungen"
  label: varchar("label", { length: 255 }).notNull(),   // Anzeigetext für Quick-Action
  promptText: text("promptText").notNull(),             // was gesendet wird
  count: int("count").default(1).notNull(),
  lastUsedAt: bigint("lastUsedAt", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
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

export const webhookEvents = mysqlTable("webhook_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  source: varchar("source", { length: 128 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body"),
  notified: boolean("notified").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type InsertWebhookEvent = typeof webhookEvents.$inferInsert;
