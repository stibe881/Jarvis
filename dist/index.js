var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/_core/env.ts
import { z } from "zod";
function validateEnv() {
  if (!parsed.success) {
    console.error("[env] Ung\xFCltige Umgebungsvariablen:");
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
  }
  const missingRequired = REQUIRED_KEYS.filter((key) => !RAW[key]);
  if (missingRequired.length > 0) {
    const msg = `[env] Fehlende Pflicht-Umgebungsvariablen: ${missingRequired.join(", ")}`;
    if (values.NODE_ENV === "production") {
      throw new Error(msg);
    }
    console.warn(`${msg} (im Entwicklungsmodus toleriert)`);
  }
  if (!RAW.ANTHROPIC_API_KEY && !RAW.BUILT_IN_FORGE_API_KEY) {
    const msg = "[env] Kein LLM-Backend konfiguriert: ANTHROPIC_API_KEY (empfohlen) oder BUILT_IN_FORGE_API_KEY setzen";
    if (values.NODE_ENV === "production") {
      throw new Error(msg);
    }
    console.warn(`${msg} (im Entwicklungsmodus toleriert)`);
  }
  for (const [feature, keys] of Object.entries(OPTIONAL_GROUPS)) {
    const missing = keys.filter((key) => !RAW[key]);
    if (missing.length > 0) {
      console.warn(`[env] ${feature} inaktiv \u2013 fehlt: ${missing.join(", ")}`);
    }
  }
}
var RAW, envSchema, parsed, values, ENV, env, REQUIRED_KEYS, OPTIONAL_GROUPS;
var init_env = __esm({
  "server/_core/env.ts"() {
    "use strict";
    RAW = process.env;
    envSchema = z.object({
      NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
      PORT: z.coerce.number().int().positive().default(3e3),
      // Kern (für den Serverbetrieb erforderlich)
      DATABASE_URL: z.string().min(1).optional(),
      JWT_SECRET: z.string().min(1).optional(),
      // Plattform-/Forge-Anbindung
      VITE_APP_ID: z.string().optional(),
      OAUTH_SERVER_URL: z.string().url().optional().or(z.literal("")),
      OWNER_OPEN_ID: z.string().optional(),
      BUILT_IN_FORGE_API_URL: z.string().optional(),
      BUILT_IN_FORGE_API_KEY: z.string().optional(),
      // Direkte KI-Anbindung (eigener Anthropic-Key statt Plattform-Proxy)
      ANTHROPIC_API_KEY: z.string().optional(),
      ANTHROPIC_MODEL: z.string().optional(),
      OPENAI_API_KEY: z.string().optional(),
      // Lokaler Passwort-Login (ersetzt den Plattform-OAuth beim Self-Hosting).
      APP_PASSWORD: z.string().optional(),
      OWNER_NAME: z.string().optional(),
      // Öffentliche Basis-URL der App (z.B. https://ai-gross-ict.ch) – Grundlage
      // der OAuth-Redirect-URIs für Google und Spotify. Ohne Angabe wird sie aus
      // dem Request abgeleitet.
      APP_URL: z.string().url().optional().or(z.literal("")),
      // Optionale Integrationen
      ELEVENLABS_API_KEY: z.string().optional(),
      GOOGLE_CLIENT_ID: z.string().optional(),
      GOOGLE_CLIENT_SECRET: z.string().optional(),
      MS_CLIENT_ID: z.string().optional(),
      MS_CLIENT_SECRET: z.string().optional(),
      SPOTIFY_CLIENT_ID: z.string().optional(),
      SPOTIFY_CLIENT_SECRET: z.string().optional(),
      SUPABASE_URL: z.string().url().optional().or(z.literal("")),
      SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
      // Verschlüsselung ruhender OAuth-Tokens (optional; ohne Schlüssel bleibt
      // die bisherige Klartextspeicherung als Rückfall aktiv).
      TOKEN_ENCRYPTION_KEY: z.string().optional()
    });
    parsed = envSchema.safeParse(RAW);
    values = parsed.success ? parsed.data : {
      NODE_ENV: RAW.NODE_ENV ?? "development",
      PORT: Number(RAW.PORT) || 3e3,
      DATABASE_URL: RAW.DATABASE_URL,
      JWT_SECRET: RAW.JWT_SECRET,
      VITE_APP_ID: RAW.VITE_APP_ID,
      OAUTH_SERVER_URL: RAW.OAUTH_SERVER_URL,
      OWNER_OPEN_ID: RAW.OWNER_OPEN_ID,
      BUILT_IN_FORGE_API_URL: RAW.BUILT_IN_FORGE_API_URL,
      BUILT_IN_FORGE_API_KEY: RAW.BUILT_IN_FORGE_API_KEY,
      ANTHROPIC_API_KEY: RAW.ANTHROPIC_API_KEY,
      ANTHROPIC_MODEL: RAW.ANTHROPIC_MODEL,
      OPENAI_API_KEY: RAW.OPENAI_API_KEY,
      APP_PASSWORD: RAW.APP_PASSWORD,
      OWNER_NAME: RAW.OWNER_NAME,
      APP_URL: RAW.APP_URL,
      ELEVENLABS_API_KEY: RAW.ELEVENLABS_API_KEY,
      GOOGLE_CLIENT_ID: RAW.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: RAW.GOOGLE_CLIENT_SECRET,
      MS_CLIENT_ID: RAW.MS_CLIENT_ID,
      MS_CLIENT_SECRET: RAW.MS_CLIENT_SECRET,
      SPOTIFY_CLIENT_ID: RAW.SPOTIFY_CLIENT_ID,
      SPOTIFY_CLIENT_SECRET: RAW.SPOTIFY_CLIENT_SECRET,
      SUPABASE_URL: RAW.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: RAW.SUPABASE_SERVICE_ROLE_KEY,
      TOKEN_ENCRYPTION_KEY: RAW.TOKEN_ENCRYPTION_KEY
    };
    ENV = {
      appId: values.VITE_APP_ID ?? "",
      cookieSecret: values.JWT_SECRET ?? "",
      databaseUrl: values.DATABASE_URL ?? "",
      oAuthServerUrl: values.OAUTH_SERVER_URL ?? "",
      ownerOpenId: values.OWNER_OPEN_ID ?? "",
      isProduction: values.NODE_ENV === "production",
      forgeApiUrl: values.BUILT_IN_FORGE_API_URL ?? "",
      forgeApiKey: values.BUILT_IN_FORGE_API_KEY ?? ""
    };
    env = values;
    REQUIRED_KEYS = ["DATABASE_URL", "JWT_SECRET"];
    OPTIONAL_GROUPS = {
      "Sprachausgabe (ElevenLabs)": ["ELEVENLABS_API_KEY"],
      "Google Kalender": ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
      "Microsoft Kalender": ["MS_CLIENT_ID", "MS_CLIENT_SECRET"],
      Spotify: ["SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET"],
      "ERP (Supabase)": ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
    };
  }
});

// server/_core/logger.ts
import { pinoHttp } from "pino-http";
import pino from "pino";
var logger, httpLogger;
var init_logger = __esm({
  "server/_core/logger.ts"() {
    "use strict";
    init_env();
    logger = pino({
      level: env.NODE_ENV === "production" ? "info" : "debug",
      // Sensible Felder nie loggen.
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          'req.headers["xi-api-key"]',
          "*.apiKey",
          "*.accessToken",
          "*.refreshToken"
        ],
        censor: "[redacted]"
      }
    });
    httpLogger = pinoHttp({
      logger,
      // Gesundheits-Checks nicht in jeder Zeile mitloggen.
      autoLogging: {
        ignore: (req) => req.url === "/health" || req.url === "/api/health"
      }
    });
  }
});

// shared/const.ts
var COOKIE_NAME, ONE_YEAR_MS, AXIOS_TIMEOUT_MS, UNAUTHED_ERR_MSG, NOT_ADMIN_ERR_MSG, OAUTH_STATE_COOKIE, decodeOAuthState;
var init_const = __esm({
  "shared/const.ts"() {
    "use strict";
    COOKIE_NAME = "app_session_id";
    ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
    AXIOS_TIMEOUT_MS = 3e4;
    UNAUTHED_ERR_MSG = "Please login (10001)";
    NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
    OAUTH_STATE_COOKIE = "__Host-oauth_state";
    decodeOAuthState = (state) => {
      let decoded;
      try {
        decoded = atob(state);
      } catch {
        return { redirectUri: "" };
      }
      try {
        const parsed2 = JSON.parse(decoded);
        if (parsed2 && typeof parsed2.redirectUri === "string") return parsed2;
      } catch {
      }
      return { redirectUri: decoded };
    };
  }
});

// drizzle/schema.ts
var schema_exports = {};
__export(schema_exports, {
  agentTasks: () => agentTasks,
  conversationGroups: () => conversationGroups,
  conversations: () => conversations,
  delegations: () => delegations,
  deviceCommands: () => deviceCommands,
  documentTemplates: () => documentTemplates,
  googleTokens: () => googleTokens,
  grossIctProjects: () => grossIctProjects,
  grossIctQuotes: () => grossIctQuotes,
  memories: () => memories,
  messages: () => messages,
  microsoftTokens: () => microsoftTokens,
  notes: () => notes,
  promptStats: () => promptStats,
  pushSubscriptions: () => pushSubscriptions,
  scheduledTasks: () => scheduledTasks,
  spotifyTokens: () => spotifyTokens,
  tasks: () => tasks,
  ttsUsage: () => ttsUsage,
  userProfiles: () => userProfiles,
  users: () => users,
  voiceNotes: () => voiceNotes,
  webhookEvents: () => webhookEvents,
  webhookKeys: () => webhookKeys
});
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
  uniqueIndex,
  varchar
} from "drizzle-orm/mysql-core";
var users, conversationGroups, conversations, messages, notes, tasks, pushSubscriptions, googleTokens, microsoftTokens, memories, userProfiles, agentTasks, grossIctProjects, grossIctQuotes, documentTemplates, delegations, voiceNotes, promptStats, webhookKeys, scheduledTasks, webhookEvents, spotifyTokens, deviceCommands, ttsUsage;
var init_schema = __esm({
  "drizzle/schema.ts"() {
    "use strict";
    users = mysqlTable("users", {
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
      lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
    });
    conversationGroups = mysqlTable(
      "conversation_groups",
      {
        id: int("id").autoincrement().primaryKey(),
        userId: int("userId").notNull(),
        name: varchar("name", { length: 255 }).notNull(),
        createdAt: timestamp("createdAt").defaultNow().notNull(),
        updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
      },
      (t2) => [index("conversation_groups_userId_idx").on(t2.userId)]
    );
    conversations = mysqlTable(
      "conversations",
      {
        id: int("id").autoincrement().primaryKey(),
        userId: int("userId").notNull(),
        groupId: int("groupId"),
        // Optionaler Ordner
        title: varchar("title", { length: 255 }).notNull().default("Neues Gespr\xE4ch"),
        createdAt: timestamp("createdAt").defaultNow().notNull(),
        updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
      },
      (t2) => [index("conversations_userId_idx").on(t2.userId)]
    );
    messages = mysqlTable(
      "messages",
      {
        id: int("id").autoincrement().primaryKey(),
        conversationId: int("conversationId").notNull(),
        role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
        content: text("content").notNull(),
        fileUrl: varchar("fileUrl", { length: 1024 }),
        fileKey: varchar("fileKey", { length: 512 }),
        fileName: varchar("fileName", { length: 255 }),
        createdAt: timestamp("createdAt").defaultNow().notNull()
      },
      (t2) => [index("messages_conversationId_idx").on(t2.conversationId)]
    );
    notes = mysqlTable(
      "notes",
      {
        id: int("id").autoincrement().primaryKey(),
        userId: int("userId").notNull(),
        title: varchar("title", { length: 255 }).notNull(),
        content: text("content").notNull(),
        tags: varchar("tags", { length: 512 }),
        createdAt: timestamp("createdAt").defaultNow().notNull(),
        updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
      },
      (t2) => [index("notes_userId_idx").on(t2.userId)]
    );
    tasks = mysqlTable(
      "tasks",
      {
        id: int("id").autoincrement().primaryKey(),
        userId: int("userId").notNull(),
        title: varchar("title", { length: 255 }).notNull(),
        description: text("description"),
        completed: boolean("completed").default(false).notNull(),
        priority: mysqlEnum("priority", ["low", "medium", "high"]).default("medium").notNull(),
        dueDate: bigint("dueDate", { mode: "number" }),
        createdAt: timestamp("createdAt").defaultNow().notNull(),
        updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
      },
      (t2) => [
        index("tasks_userId_idx").on(t2.userId),
        index("tasks_userId_completed_idx").on(t2.userId, t2.completed)
      ]
    );
    pushSubscriptions = mysqlTable(
      "push_subscriptions",
      {
        id: int("id").autoincrement().primaryKey(),
        userId: int("userId").notNull(),
        endpoint: text("endpoint").notNull(),
        p256dh: text("p256dh").notNull(),
        auth: varchar("auth", { length: 512 }).notNull(),
        createdAt: timestamp("createdAt").defaultNow().notNull()
      },
      (t2) => [index("push_subscriptions_userId_idx").on(t2.userId)]
    );
    googleTokens = mysqlTable(
      "google_tokens",
      {
        id: int("id").autoincrement().primaryKey(),
        userId: int("userId").notNull(),
        accessToken: text("accessToken").notNull(),
        refreshToken: text("refreshToken"),
        expiresAt: int("expiresAt").notNull(),
        // Unix timestamp in seconds
        scope: text("scope"),
        email: varchar("email", { length: 320 }).notNull(),
        disabledCalendars: text("disabledCalendars").default("[]").notNull(),
        createdAt: timestamp("createdAt").defaultNow().notNull(),
        updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
      },
      (t2) => [uniqueIndex("google_tokens_userId_email_idx").on(t2.userId, t2.email)]
    );
    microsoftTokens = mysqlTable(
      "microsoft_tokens",
      {
        id: int("id").autoincrement().primaryKey(),
        userId: int("userId").notNull(),
        accessToken: text("accessToken").notNull(),
        refreshToken: text("refreshToken"),
        expiresAt: int("expiresAt").notNull(),
        // Unix timestamp in seconds
        scope: text("scope"),
        email: varchar("email", { length: 320 }).notNull(),
        disabledCalendars: text("disabledCalendars").default("[]").notNull(),
        createdAt: timestamp("createdAt").defaultNow().notNull(),
        updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
      },
      (t2) => [uniqueIndex("microsoft_tokens_userId_email_idx").on(t2.userId, t2.email)]
    );
    memories = mysqlTable(
      "memories",
      {
        id: int("id").autoincrement().primaryKey(),
        userId: int("userId").notNull(),
        category: varchar("category", { length: 64 }).notNull().default("fact"),
        // Kategorien: person, preference, fact, contact, project, other
        key: varchar("key", { length: 255 }).notNull(),
        value: text("value").notNull(),
        embedding: json("embedding"),
        // Speichert den Vector als Float-Array für Cosine Similarity
        source: varchar("source", { length: 64 }).default("chat"),
        // source: chat = aus Gespräch gelernt, manual = manuell eingetragen
        createdAt: timestamp("createdAt").defaultNow().notNull(),
        updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
      },
      (t2) => [
        // Lookup nach Nutzer und Upsert-Schlüssel (userId + key) beschleunigen.
        index("memories_userId_idx").on(t2.userId),
        index("memories_userId_key_idx").on(t2.userId, t2.key)
      ]
    );
    userProfiles = mysqlTable("user_profiles", {
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
      interests: text("interests"),
      // Hobbys und Interessen
      workContext: text("workContext"),
      // Beruflicher Kontext
      personalNotes: text("personalNotes"),
      // Weitere persönliche Infos
      // Jarvis-Persönlichkeit
      jarvisPersonality: text("jarvisPersonality"),
      // Eigene Beschreibung wie Jarvis sich verhalten soll
      language: mysqlEnum("language", ["de", "en", "auto"]).default("de"),
      elevenLabsVoiceId: varchar("elevenLabsVoiceId", { length: 64 }).default(
        "JBFqnCBsd6RMkjVDRZzb"
      ),
      // George (britisch, männlich)
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
      expoPushToken: varchar("expoPushToken", { length: 255 }),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    agentTasks = mysqlTable(
      "agent_tasks",
      {
        id: int("id").autoincrement().primaryKey(),
        userId: int("userId").notNull(),
        executeAt: timestamp("executeAt").notNull(),
        instruction: text("instruction").notNull(),
        status: mysqlEnum("status", ["pending", "completed", "failed"]).default("pending").notNull(),
        result: text("result"),
        // LLM Output nach Ausführung
        createdAt: timestamp("createdAt").defaultNow().notNull(),
        updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
      },
      (t2) => [
        index("agent_tasks_status_executeAt_idx").on(t2.status, t2.executeAt),
        index("agent_tasks_userId_idx").on(t2.userId)
      ]
    );
    grossIctProjects = mysqlTable(
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
          "other"
        ]).default("other").notNull(),
        status: mysqlEnum("status", [
          "lead",
          "offer",
          "active",
          "completed",
          "cancelled"
        ]).default("lead").notNull(),
        budget: int("budget"),
        // CHF
        notes: text("notes"),
        createdAt: timestamp("createdAt").defaultNow().notNull(),
        updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
      },
      (t2) => [index("gross_ict_projects_userId_idx").on(t2.userId)]
    );
    grossIctQuotes = mysqlTable(
      "gross_ict_quotes",
      {
        id: int("id").autoincrement().primaryKey(),
        userId: int("userId").notNull(),
        projectId: int("projectId"),
        customerName: varchar("customerName", { length: 255 }).notNull(),
        customerEmail: varchar("customerEmail", { length: 320 }),
        title: varchar("title", { length: 255 }).notNull(),
        content: text("content").notNull(),
        // Markdown-Angebot
        totalAmount: int("totalAmount"),
        // CHF
        status: mysqlEnum("status", ["draft", "sent", "accepted", "rejected"]).default("draft").notNull(),
        createdAt: timestamp("createdAt").defaultNow().notNull(),
        updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
      },
      (t2) => [index("gross_ict_quotes_userId_idx").on(t2.userId)]
    );
    documentTemplates = mysqlTable(
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
          "other"
        ]).default("other").notNull(),
        context: mysqlEnum("context", ["gross_ict", "sonnenberg", "general"]).default("general").notNull(),
        description: text("description"),
        content: text("content").notNull(),
        // Markdown mit {{platzhaltern}}
        placeholders: text("placeholders"),
        // JSON-Array der Platzhalter-Namen
        isFavorite: boolean("isFavorite").default(false).notNull(),
        usageCount: int("usageCount").default(0).notNull(),
        createdAt: timestamp("createdAt").defaultNow().notNull(),
        updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
      },
      (t2) => [index("document_templates_userId_idx").on(t2.userId)]
    );
    delegations = mysqlTable(
      "delegations",
      {
        id: int("id").autoincrement().primaryKey(),
        userId: int("userId").notNull(),
        taskId: int("taskId"),
        // optional: Verweis auf tasks
        assigneeName: varchar("assigneeName", { length: 128 }).notNull(),
        assigneeEmail: varchar("assigneeEmail", { length: 320 }),
        title: varchar("title", { length: 255 }).notNull(),
        details: text("details"),
        dueDate: bigint("dueDate", { mode: "number" }),
        status: mysqlEnum("status", ["open", "in_progress", "done", "cancelled"]).default("open").notNull(),
        emailDraft: text("emailDraft"),
        // von Jarvis generierter E-Mail-Text
        emailSentAt: bigint("emailSentAt", { mode: "number" }),
        createdAt: timestamp("createdAt").defaultNow().notNull(),
        updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
      },
      (t2) => [index("delegations_userId_idx").on(t2.userId)]
    );
    voiceNotes = mysqlTable(
      "voice_notes",
      {
        id: int("id").autoincrement().primaryKey(),
        userId: int("userId").notNull(),
        transcript: text("transcript").notNull(),
        summary: text("summary"),
        category: varchar("category", { length: 64 }).default("allgemein"),
        audioUrl: varchar("audioUrl", { length: 1024 }),
        durationSec: int("durationSec"),
        noteId: int("noteId"),
        // wenn als Notiz gespeichert
        taskId: int("taskId"),
        // wenn als Aufgabe erkannt
        createdAt: timestamp("createdAt").defaultNow().notNull()
      },
      (t2) => [index("voice_notes_userId_idx").on(t2.userId)]
    );
    promptStats = mysqlTable(
      "prompt_stats",
      {
        id: int("id").autoincrement().primaryKey(),
        userId: int("userId").notNull(),
        intent: varchar("intent", { length: 128 }).notNull(),
        // z.B. "offene_rechnungen"
        label: varchar("label", { length: 255 }).notNull(),
        // Anzeigetext für Quick-Action
        promptText: text("promptText").notNull(),
        // was gesendet wird
        count: int("count").default(1).notNull(),
        lastUsedAt: bigint("lastUsedAt", { mode: "number" }).notNull(),
        createdAt: timestamp("createdAt").defaultNow().notNull()
      },
      (t2) => [
        index("prompt_stats_userId_idx").on(t2.userId),
        index("prompt_stats_userId_intent_idx").on(t2.userId, t2.intent)
      ]
    );
    webhookKeys = mysqlTable("webhook_keys", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      label: varchar("label", { length: 128 }).notNull(),
      apiKey: varchar("apiKey", { length: 96 }).notNull().unique(),
      isActive: boolean("isActive").default(true).notNull(),
      lastUsedAt: bigint("lastUsedAt", { mode: "number" }),
      callCount: int("callCount").default(0).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    scheduledTasks = mysqlTable("scheduled_tasks", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      cronExpression: varchar("cronExpression", { length: 100 }),
      // optional für wiederkehrende
      runAt: timestamp("runAt"),
      // für einmalige Tasks
      prompt: text("prompt").notNull(),
      // Der Prompt für den Agenten
      isActive: boolean("isActive").default(true).notNull(),
      lastRunAt: timestamp("lastRunAt"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    webhookEvents = mysqlTable(
      "webhook_events",
      {
        id: int("id").autoincrement().primaryKey(),
        userId: int("userId").notNull(),
        source: varchar("source", { length: 128 }).notNull(),
        title: varchar("title", { length: 255 }).notNull(),
        body: text("body"),
        notified: boolean("notified").default(false).notNull(),
        createdAt: timestamp("createdAt").defaultNow().notNull()
      },
      (t2) => [index("webhook_events_userId_idx").on(t2.userId)]
    );
    spotifyTokens = mysqlTable("spotify_tokens", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull().unique(),
      accessToken: text("accessToken").notNull(),
      refreshToken: text("refreshToken"),
      expiresAt: int("expiresAt").notNull(),
      // Unix timestamp in Sekunden
      scope: text("scope"),
      displayName: varchar("displayName", { length: 255 }),
      product: varchar("product", { length: 32 }),
      // premium | free
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    deviceCommands = mysqlTable(
      "device_commands",
      {
        id: int("id").autoincrement().primaryKey(),
        userId: int("userId").notNull(),
        // whatsapp | alarm | timer | reminder | speak
        type: varchar("type", { length: 32 }).notNull(),
        payload: text("payload").notNull(),
        // JSON-Parameter
        summary: varchar("summary", { length: 255 }),
        // lesbare Kurzbeschreibung
        status: mysqlEnum("status", ["pending", "delivered", "done", "failed"]).default("pending").notNull(),
        deliveredAt: bigint("deliveredAt", { mode: "number" }),
        createdAt: timestamp("createdAt").defaultNow().notNull()
      },
      (t2) => [
        // Die iOS-Queue pollt nach userId + status = pending; zusammengesetzter Index.
        index("device_commands_userId_status_idx").on(t2.userId, t2.status)
      ]
    );
    ttsUsage = mysqlTable(
      "tts_usage",
      {
        id: int("id").autoincrement().primaryKey(),
        userId: int("userId").notNull(),
        /** Abrechnungsmonat im Format YYYY-MM, z.B. 2026-08 */
        yearMonth: varchar("yearMonth", { length: 7 }).notNull(),
        charsUsed: int("charsUsed").default(0).notNull(),
        requestCount: int("requestCount").default(0).notNull(),
        createdAt: timestamp("createdAt").defaultNow().notNull(),
        updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
      },
      (t2) => [
        // Upsert/Lookup nach userId + Abrechnungsmonat.
        index("tts_usage_userId_yearMonth_idx").on(t2.userId, t2.yearMonth)
      ]
    );
  }
});

// server/db.ts
var db_exports = {};
__export(db_exports, {
  addMessage: () => addMessage,
  addTtsUsage: () => addTtsUsage,
  claimPendingDeviceCommands: () => claimPendingDeviceCommands,
  createConversation: () => createConversation,
  createConversationGroup: () => createConversationGroup,
  createDelegation: () => createDelegation,
  createDeviceCommand: () => createDeviceCommand,
  createNote: () => createNote,
  createTask: () => createTask,
  createTemplate: () => createTemplate,
  createVoiceNote: () => createVoiceNote,
  createWebhookEvent: () => createWebhookEvent,
  createWebhookKey: () => createWebhookKey,
  deleteConversation: () => deleteConversation,
  deleteConversationGroup: () => deleteConversationGroup,
  deleteConversations: () => deleteConversations,
  deleteDelegation: () => deleteDelegation,
  deleteDeviceCommand: () => deleteDeviceCommand,
  deleteGoogleToken: () => deleteGoogleToken,
  deleteMemory: () => deleteMemory,
  deleteMicrosoftToken: () => deleteMicrosoftToken,
  deleteNote: () => deleteNote,
  deleteSpotifyToken: () => deleteSpotifyToken,
  deleteTask: () => deleteTask,
  deleteTemplate: () => deleteTemplate,
  deleteVoiceNote: () => deleteVoiceNote,
  deleteWebhookKey: () => deleteWebhookKey,
  findWebhookKey: () => findWebhookKey,
  getConversationById: () => getConversationById,
  getConversationGroupsByUser: () => getConversationGroupsByUser,
  getConversationsByUser: () => getConversationsByUser,
  getDb: () => getDb,
  getDelegationsByUser: () => getDelegationsByUser,
  getDeviceCommandsByUser: () => getDeviceCommandsByUser,
  getGoogleToken: () => getGoogleToken,
  getGoogleTokens: () => getGoogleTokens,
  getMemoriesByUser: () => getMemoriesByUser,
  getMessagesByConversation: () => getMessagesByConversation,
  getMicrosoftToken: () => getMicrosoftToken,
  getMicrosoftTokens: () => getMicrosoftTokens,
  getNoteById: () => getNoteById,
  getNotesByUser: () => getNotesByUser,
  getSpotifyToken: () => getSpotifyToken,
  getTasksByUser: () => getTasksByUser,
  getTemplateById: () => getTemplateById,
  getTemplatesByUser: () => getTemplatesByUser,
  getTopPrompts: () => getTopPrompts,
  getTtsUsage: () => getTtsUsage,
  getUserByOpenId: () => getUserByOpenId,
  getUserProfile: () => getUserProfile,
  getVoiceNotesByUser: () => getVoiceNotesByUser,
  getWebhookEventsByUser: () => getWebhookEventsByUser,
  getWebhookKeysByUser: () => getWebhookKeysByUser,
  incrementTemplateUsage: () => incrementTemplateUsage,
  markDeviceCommandDone: () => markDeviceCommandDone,
  moveConversationToGroup: () => moveConversationToGroup,
  moveConversationsToGroup: () => moveConversationsToGroup,
  touchWebhookKey: () => touchWebhookKey,
  trackPrompt: () => trackPrompt,
  updateConversationTitle: () => updateConversationTitle,
  updateDelegation: () => updateDelegation,
  updateNote: () => updateNote,
  updateTask: () => updateTask,
  updateTemplate: () => updateTemplate,
  upsertGoogleToken: () => upsertGoogleToken,
  upsertMemory: () => upsertMemory,
  upsertMicrosoftToken: () => upsertMicrosoftToken,
  upsertSpotifyToken: () => upsertSpotifyToken,
  upsertUser: () => upsertUser,
  upsertUserProfile: () => upsertUserProfile
});
import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values2 = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values2[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values2.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values2.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values2.role = "admin";
      updateSet.role = "admin";
    }
    if (!values2.lastSignedIn) {
      values2.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values2).onDuplicateKeyUpdate({
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function createConversation(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(conversations).values(data).$returningId();
  return result;
}
async function getConversationsByUser(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(conversations).where(eq(conversations.userId, userId)).orderBy(desc(conversations.updatedAt)).limit(30);
}
async function getConversationById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
  return result[0];
}
async function updateConversationTitle(id, title) {
  const db = await getDb();
  if (!db) return;
  await db.update(conversations).set({ title }).where(eq(conversations.id, id));
}
async function deleteConversation(id) {
  const db = await getDb();
  if (!db) return;
  await db.delete(messages).where(eq(messages.conversationId, id));
  await db.delete(conversations).where(eq(conversations.id, id));
}
async function deleteConversations(ids) {
  const db = await getDb();
  if (!db || ids.length === 0) return;
  await db.delete(messages).where(inArray(messages.conversationId, ids));
  await db.delete(conversations).where(inArray(conversations.id, ids));
}
async function createConversationGroup(data) {
  const db = await getDb();
  if (!db) return void 0;
  const [result] = await db.insert(conversationGroups).values(data);
  return result.insertId;
}
async function getConversationGroupsByUser(userId) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(conversationGroups).where(eq(conversationGroups.userId, userId)).orderBy(desc(conversationGroups.createdAt));
}
async function deleteConversationGroup(id) {
  const db = await getDb();
  if (!db) return;
  await db.update(conversations).set({ groupId: null }).where(eq(conversations.groupId, id));
  await db.delete(conversationGroups).where(eq(conversationGroups.id, id));
}
async function moveConversationToGroup(conversationId, groupId) {
  const db = await getDb();
  if (!db) return;
  await db.update(conversations).set({ groupId, updatedAt: /* @__PURE__ */ new Date() }).where(eq(conversations.id, conversationId));
}
async function moveConversationsToGroup(conversationIds, groupId) {
  const db = await getDb();
  if (!db || conversationIds.length === 0) return;
  await db.update(conversations).set({ groupId, updatedAt: /* @__PURE__ */ new Date() }).where(inArray(conversations.id, conversationIds));
}
async function addMessage(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(messages).values(data).$returningId();
  return result;
}
async function getMessagesByConversation(conversationId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(messages.createdAt);
}
async function createNote(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(notes).values(data).$returningId();
  return result;
}
async function getNotesByUser(userId, search) {
  const db = await getDb();
  if (!db) return [];
  if (search) {
    return db.select().from(notes).where(
      and(
        eq(notes.userId, userId),
        or(
          like(notes.title, `%${search}%`),
          like(notes.content, `%${search}%`)
        )
      )
    ).orderBy(desc(notes.updatedAt));
  }
  return db.select().from(notes).where(eq(notes.userId, userId)).orderBy(desc(notes.updatedAt));
}
async function getNoteById(id, userId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(notes).where(and(eq(notes.id, id), eq(notes.userId, userId))).limit(1);
  return result[0];
}
async function updateNote(id, userId, data) {
  const db = await getDb();
  if (!db) return;
  await db.update(notes).set(data).where(and(eq(notes.id, id), eq(notes.userId, userId)));
}
async function deleteNote(id, userId) {
  const db = await getDb();
  if (!db) return;
  await db.delete(notes).where(and(eq(notes.id, id), eq(notes.userId, userId)));
}
async function createTask(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(tasks).values(data).$returningId();
  return result;
}
async function getTasksByUser(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tasks).where(eq(tasks.userId, userId)).orderBy(tasks.dueDate, desc(tasks.createdAt));
}
async function updateTask(id, userId, data) {
  const db = await getDb();
  if (!db) return;
  await db.update(tasks).set(data).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
}
async function deleteTask(id, userId) {
  const db = await getDb();
  if (!db) return;
  await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
}
async function getGoogleToken(userId, email) {
  const db = await getDb();
  if (!db) return void 0;
  let condition = eq(googleTokens.userId, userId);
  if (email) {
    condition = and(eq(googleTokens.userId, userId), eq(googleTokens.email, email));
  }
  const rows = await db.select().from(googleTokens).where(condition).limit(1);
  return rows[0];
}
async function getGoogleTokens(userId) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(googleTokens).where(eq(googleTokens.userId, userId));
}
async function upsertGoogleToken(data) {
  const db = await getDb();
  if (!db) return;
  await db.insert(googleTokens).values({
    ...data,
    email: data.email ?? "",
    // ensure email is not null for insert if missing, though it's required in schema
    disabledCalendars: data.disabledCalendars ?? "[]"
  }).onDuplicateKeyUpdate({
    set: {
      accessToken: data.accessToken,
      ...data.refreshToken ? { refreshToken: data.refreshToken } : {},
      expiresAt: data.expiresAt,
      scope: data.scope ?? "",
      email: data.email ?? "",
      ...data.disabledCalendars ? { disabledCalendars: data.disabledCalendars } : {}
    }
  });
}
async function deleteGoogleToken(userId, email) {
  const db = await getDb();
  if (!db) return;
  if (email) {
    await db.delete(googleTokens).where(
      and(eq(googleTokens.userId, userId), eq(googleTokens.email, email))
    );
  } else {
    await db.delete(googleTokens).where(eq(googleTokens.userId, userId));
  }
}
async function getMicrosoftToken(userId, email) {
  const db = await getDb();
  if (!db) return void 0;
  let condition = eq(microsoftTokens.userId, userId);
  if (email) {
    condition = and(eq(microsoftTokens.userId, userId), eq(microsoftTokens.email, email));
  }
  const rows = await db.select().from(microsoftTokens).where(condition).limit(1);
  return rows[0];
}
async function getMicrosoftTokens(userId) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(microsoftTokens).where(eq(microsoftTokens.userId, userId));
}
async function upsertMicrosoftToken(data) {
  const db = await getDb();
  if (!db) return;
  await db.insert(microsoftTokens).values({
    ...data,
    email: data.email ?? "",
    disabledCalendars: data.disabledCalendars ?? "[]"
  }).onDuplicateKeyUpdate({
    set: {
      accessToken: data.accessToken,
      ...data.refreshToken ? { refreshToken: data.refreshToken } : {},
      expiresAt: data.expiresAt,
      scope: data.scope ?? "",
      email: data.email ?? "",
      ...data.disabledCalendars ? { disabledCalendars: data.disabledCalendars } : {}
    }
  });
}
async function deleteMicrosoftToken(userId, email) {
  const db = await getDb();
  if (!db) return;
  if (email) {
    await db.delete(microsoftTokens).where(
      and(
        eq(microsoftTokens.userId, userId),
        eq(microsoftTokens.email, email)
      )
    );
  } else {
    await db.delete(microsoftTokens).where(eq(microsoftTokens.userId, userId));
  }
}
async function getMemoriesByUser(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(memories).where(eq(memories.userId, userId)).orderBy(memories.category, memories.key);
}
async function upsertMemory(userId, category, key, value, source = "chat") {
  const db = await getDb();
  if (!db) return;
  const embedding = null;
  const existing = await db.select().from(memories).where(and(eq(memories.userId, userId), eq(memories.key, key))).limit(1);
  if (existing.length > 0) {
    await db.update(memories).set({ value, category, source, embedding, updatedAt: /* @__PURE__ */ new Date() }).where(and(eq(memories.userId, userId), eq(memories.key, key)));
  } else {
    await db.insert(memories).values({ userId, category, key, value, source, embedding });
  }
}
async function deleteMemory(userId, id) {
  const db = await getDb();
  if (!db) return;
  await db.delete(memories).where(and(eq(memories.id, id), eq(memories.userId, userId)));
}
async function getUserProfile(userId) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  return result[0] ?? null;
}
async function upsertUserProfile(userId, data) {
  const db = await getDb();
  if (!db) return;
  await db.insert(userProfiles).values({ userId, ...data }).onDuplicateKeyUpdate({ set: { ...data, updatedAt: /* @__PURE__ */ new Date() } });
}
async function createTemplate(data) {
  const db = await getDb();
  if (!db) throw new Error("Keine Datenbankverbindung");
  const [result] = await db.insert(documentTemplates).values(data).$returningId();
  return result;
}
async function getTemplatesByUser(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(documentTemplates).where(eq(documentTemplates.userId, userId)).orderBy(
    desc(documentTemplates.isFavorite),
    desc(documentTemplates.usageCount)
  );
}
async function getTemplateById(id, userId) {
  const db = await getDb();
  if (!db) return null;
  const r = await db.select().from(documentTemplates).where(
    and(eq(documentTemplates.id, id), eq(documentTemplates.userId, userId))
  ).limit(1);
  return r[0] ?? null;
}
async function updateTemplate(id, userId, data) {
  const db = await getDb();
  if (!db) return;
  await db.update(documentTemplates).set(data).where(
    and(eq(documentTemplates.id, id), eq(documentTemplates.userId, userId))
  );
}
async function deleteTemplate(id, userId) {
  const db = await getDb();
  if (!db) return;
  await db.delete(documentTemplates).where(
    and(eq(documentTemplates.id, id), eq(documentTemplates.userId, userId))
  );
}
async function incrementTemplateUsage(id, userId) {
  const db = await getDb();
  if (!db) return;
  await db.update(documentTemplates).set({ usageCount: sql`${documentTemplates.usageCount} + 1` }).where(
    and(eq(documentTemplates.id, id), eq(documentTemplates.userId, userId))
  );
}
async function createDelegation(data) {
  const db = await getDb();
  if (!db) throw new Error("Keine Datenbankverbindung");
  const [result] = await db.insert(delegations).values(data).$returningId();
  return result;
}
async function getDelegationsByUser(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(delegations).where(eq(delegations.userId, userId)).orderBy(desc(delegations.createdAt));
}
async function updateDelegation(id, userId, data) {
  const db = await getDb();
  if (!db) return;
  await db.update(delegations).set(data).where(and(eq(delegations.id, id), eq(delegations.userId, userId)));
}
async function deleteDelegation(id, userId) {
  const db = await getDb();
  if (!db) return;
  await db.delete(delegations).where(and(eq(delegations.id, id), eq(delegations.userId, userId)));
}
async function createVoiceNote(data) {
  const db = await getDb();
  if (!db) throw new Error("Keine Datenbankverbindung");
  const [result] = await db.insert(voiceNotes).values(data).$returningId();
  return result;
}
async function getVoiceNotesByUser(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(voiceNotes).where(eq(voiceNotes.userId, userId)).orderBy(desc(voiceNotes.createdAt)).limit(100);
}
async function deleteVoiceNote(id, userId) {
  const db = await getDb();
  if (!db) return;
  await db.delete(voiceNotes).where(and(eq(voiceNotes.id, id), eq(voiceNotes.userId, userId)));
}
async function trackPrompt(userId, intent, label, promptText) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(promptStats).where(and(eq(promptStats.userId, userId), eq(promptStats.intent, intent))).limit(1);
  if (existing[0]) {
    await db.update(promptStats).set({
      count: sql`${promptStats.count} + 1`,
      lastUsedAt: Date.now(),
      label,
      promptText
    }).where(eq(promptStats.id, existing[0].id));
  } else {
    await db.insert(promptStats).values({
      userId,
      intent,
      label,
      promptText,
      count: 1,
      lastUsedAt: Date.now()
    });
  }
}
async function getTopPrompts(userId, limit = 4) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(promptStats).where(eq(promptStats.userId, userId)).orderBy(desc(promptStats.count), desc(promptStats.lastUsedAt)).limit(limit);
}
async function createWebhookKey(userId, label, apiKey) {
  const db = await getDb();
  if (!db) throw new Error("Keine Datenbankverbindung");
  const [result] = await db.insert(webhookKeys).values({ userId, label, apiKey }).$returningId();
  return { id: result.id, apiKey };
}
async function getWebhookKeysByUser(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(webhookKeys).where(eq(webhookKeys.userId, userId)).orderBy(desc(webhookKeys.createdAt));
}
async function findWebhookKey(apiKey) {
  const db = await getDb();
  if (!db) return null;
  const r = await db.select().from(webhookKeys).where(eq(webhookKeys.apiKey, apiKey)).limit(1);
  return r[0] ?? null;
}
async function touchWebhookKey(id, currentCount) {
  const db = await getDb();
  if (!db) return;
  await db.update(webhookKeys).set({ lastUsedAt: Date.now(), callCount: currentCount + 1 }).where(eq(webhookKeys.id, id));
}
async function deleteWebhookKey(id, userId) {
  const db = await getDb();
  if (!db) return;
  await db.delete(webhookKeys).where(and(eq(webhookKeys.id, id), eq(webhookKeys.userId, userId)));
}
async function createWebhookEvent(userId, source, title, body, notified) {
  const db = await getDb();
  if (!db) return;
  await db.insert(webhookEvents).values({ userId, source, title, body, notified });
}
async function getWebhookEventsByUser(userId, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(webhookEvents).where(eq(webhookEvents.userId, userId)).orderBy(desc(webhookEvents.createdAt)).limit(limit);
}
async function getSpotifyToken(userId) {
  const db = await getDb();
  if (!db) return void 0;
  const rows = await db.select().from(spotifyTokens).where(eq(spotifyTokens.userId, userId)).limit(1);
  return rows[0];
}
async function upsertSpotifyToken(data) {
  const db = await getDb();
  if (!db) return;
  await db.insert(spotifyTokens).values(data).onDuplicateKeyUpdate({
    set: {
      accessToken: data.accessToken,
      ...data.refreshToken ? { refreshToken: data.refreshToken } : {},
      expiresAt: data.expiresAt,
      scope: data.scope ?? null,
      displayName: data.displayName ?? null,
      product: data.product ?? null,
      updatedAt: /* @__PURE__ */ new Date()
    }
  });
}
async function deleteSpotifyToken(userId) {
  const db = await getDb();
  if (!db) return;
  await db.delete(spotifyTokens).where(eq(spotifyTokens.userId, userId));
}
async function createDeviceCommand(userId, type, payload, summary) {
  const db = await getDb();
  if (!db) throw new Error("Keine Datenbankverbindung");
  const [result] = await db.insert(deviceCommands).values({ userId, type, payload: JSON.stringify(payload), summary }).$returningId();
  return result;
}
async function claimPendingDeviceCommands(userId, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(deviceCommands).where(
    and(
      eq(deviceCommands.userId, userId),
      eq(deviceCommands.status, "pending")
    )
  ).orderBy(deviceCommands.createdAt).limit(limit);
  if (rows.length === 0) return rows;
  await db.update(deviceCommands).set({ status: "delivered", deliveredAt: Date.now() }).where(
    inArray(
      deviceCommands.id,
      rows.map((r) => r.id)
    )
  );
  return rows;
}
async function getDeviceCommandsByUser(userId, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(deviceCommands).where(eq(deviceCommands.userId, userId)).orderBy(desc(deviceCommands.createdAt)).limit(limit);
}
async function markDeviceCommandDone(id, userId, status = "done") {
  const db = await getDb();
  if (!db) return;
  await db.update(deviceCommands).set({ status }).where(and(eq(deviceCommands.id, id), eq(deviceCommands.userId, userId)));
}
async function deleteDeviceCommand(id, userId) {
  const db = await getDb();
  if (!db) return;
  await db.delete(deviceCommands).where(and(eq(deviceCommands.id, id), eq(deviceCommands.userId, userId)));
}
async function getTtsUsage(userId, yearMonth) {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select().from(ttsUsage).where(and(eq(ttsUsage.userId, userId), eq(ttsUsage.yearMonth, yearMonth))).limit(1);
  return rows[0]?.charsUsed ?? 0;
}
async function addTtsUsage(userId, yearMonth, chars) {
  const db = await getDb();
  if (!db) return chars;
  const rows = await db.select().from(ttsUsage).where(and(eq(ttsUsage.userId, userId), eq(ttsUsage.yearMonth, yearMonth))).limit(1);
  const existing = rows[0];
  if (!existing) {
    await db.insert(ttsUsage).values({ userId, yearMonth, charsUsed: chars, requestCount: 1 });
    return chars;
  }
  const total = existing.charsUsed + chars;
  await db.update(ttsUsage).set({
    charsUsed: sql`${ttsUsage.charsUsed} + ${chars}`,
    requestCount: sql`${ttsUsage.requestCount} + 1`
  }).where(eq(ttsUsage.id, existing.id));
  return total;
}
var _db;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    init_schema();
    init_schema();
    init_schema();
    init_env();
    _db = null;
  }
});

// shared/_core/errors.ts
var HttpError, ForbiddenError;
var init_errors = __esm({
  "shared/_core/errors.ts"() {
    "use strict";
    HttpError = class extends Error {
      constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.name = "HttpError";
      }
    };
    ForbiddenError = (msg) => new HttpError(403, msg);
  }
});

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var isNonEmptyString, EXCHANGE_TOKEN_PATH, GET_USER_INFO_PATH, GET_USER_INFO_WITH_JWT_PATH, OAuthService, createOAuthHttpClient, SDKServer, CRON_OPEN_ID_PREFIX, sdk;
var init_sdk = __esm({
  "server/_core/sdk.ts"() {
    "use strict";
    init_const();
    init_errors();
    init_db();
    init_env();
    isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
    EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
    GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
    GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
    OAuthService = class {
      constructor(client2) {
        this.client = client2;
        if (ENV.oAuthServerUrl) {
          console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
        } else if (process.env.APP_PASSWORD) {
          console.log("[OAuth] Nicht konfiguriert \u2013 lokaler Passwort-Login aktiv.");
        } else {
          console.error(
            "[OAuth] Kein Login konfiguriert: APP_PASSWORD (lokal) oder OAUTH_SERVER_URL setzen."
          );
        }
      }
      decodeState(state) {
        return decodeOAuthState(state).redirectUri;
      }
      async getTokenByCode(code, state) {
        const payload = {
          clientId: ENV.appId,
          grantType: "authorization_code",
          code,
          redirectUri: this.decodeState(state)
        };
        const { data } = await this.client.post(
          EXCHANGE_TOKEN_PATH,
          payload
        );
        return data;
      }
      async getUserInfoByToken(token) {
        const { data } = await this.client.post(
          GET_USER_INFO_PATH,
          {
            accessToken: token.accessToken
          }
        );
        return data;
      }
    };
    createOAuthHttpClient = () => axios.create({
      baseURL: ENV.oAuthServerUrl,
      timeout: AXIOS_TIMEOUT_MS
    });
    SDKServer = class {
      client;
      oauthService;
      constructor(client2 = createOAuthHttpClient()) {
        this.client = client2;
        this.oauthService = new OAuthService(this.client);
      }
      deriveLoginMethod(platforms, fallback) {
        if (fallback && fallback.length > 0) return fallback;
        if (!Array.isArray(platforms) || platforms.length === 0) return null;
        const set = new Set(
          platforms.filter((p) => typeof p === "string")
        );
        if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
        if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
        if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
        if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
          return "microsoft";
        if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
        const first = Array.from(set)[0];
        return first ? first.toLowerCase() : null;
      }
      /**
       * Exchange OAuth authorization code for access token
       * @example
       * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
       */
      async exchangeCodeForToken(code, state) {
        return this.oauthService.getTokenByCode(code, state);
      }
      /**
       * Get user information using access token
       * @example
       * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
       */
      async getUserInfo(accessToken) {
        const data = await this.oauthService.getUserInfoByToken({
          accessToken
        });
        const loginMethod = this.deriveLoginMethod(
          data?.platforms,
          data?.platform ?? data.platform ?? null
        );
        return {
          ...data,
          platform: loginMethod,
          loginMethod
        };
      }
      parseCookies(cookieHeader) {
        if (!cookieHeader) {
          return /* @__PURE__ */ new Map();
        }
        const parsed2 = parseCookieHeader(cookieHeader);
        return new Map(Object.entries(parsed2));
      }
      getSessionSecret() {
        const secret = ENV.cookieSecret;
        return new TextEncoder().encode(secret);
      }
      /**
       * Create a session token for a Manus user openId
       * @example
       * const sessionToken = await sdk.createSessionToken(userInfo.openId);
       */
      async createSessionToken(openId, options = {}) {
        return this.signSession(
          {
            openId,
            // Self-Hosting hat keine Plattform-App-ID (VITE_APP_ID). verifySession
            // verwirft Tokens mit leerer appId – ohne Fallback wäre jedes frisch
            // ausgestellte Login-Token sofort ungültig (Symptom: Login-Schleife).
            appId: ENV.appId || "jarvis-selfhosted",
            name: options.name || ""
          },
          options
        );
      }
      async signSession(payload, options = {}) {
        const issuedAt = Date.now();
        const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
        const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
        const secretKey = this.getSessionSecret();
        return new SignJWT({
          openId: payload.openId,
          appId: payload.appId,
          name: payload.name
        }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
      }
      async verifySession(cookieValue) {
        if (!cookieValue) {
          console.warn("[Auth] Missing session cookie");
          return null;
        }
        try {
          const secretKey = this.getSessionSecret();
          const { payload } = await jwtVerify(cookieValue, secretKey, {
            algorithms: ["HS256"]
          });
          const { openId, appId, name } = payload;
          if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
            console.error("[Auth] Session payload missing required fields:", {
              openId,
              appId,
              name
            });
            return null;
          }
          return {
            openId,
            appId,
            name
          };
        } catch (error) {
          console.error(
            "[Auth] Session verification failed (JWT invalid or expired):",
            String(error)
          );
          return null;
        }
      }
      async getUserInfoWithJwt(jwtToken) {
        const payload = {
          jwtToken,
          projectId: ENV.appId
        };
        const { data } = await this.client.post(
          GET_USER_INFO_WITH_JWT_PATH,
          payload
        );
        const loginMethod = this.deriveLoginMethod(
          data?.platforms,
          data?.platform ?? data.platform ?? null
        );
        return {
          ...data,
          platform: loginMethod,
          loginMethod
        };
      }
      async authenticateRequest(req) {
        const cookies = this.parseCookies(req.headers.cookie);
        let sessionToken = cookies.get(COOKIE_NAME);
        if (!sessionToken) {
          const authHeader = req.headers.authorization;
          if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
            sessionToken = authHeader.slice(7);
          }
        }
        const session = await this.verifySession(sessionToken);
        if (!session) {
          console.error(
            "[Auth] authenticateRequest failed: session is null. Cookie was:",
            sessionToken
          );
          throw ForbiddenError("Invalid session cookie");
        }
        if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
          const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
          const taskUid = userInfo.taskUid ?? null;
          if (!taskUid) {
            throw ForbiddenError("Cron session missing task_uid");
          }
          return buildCronUser(userInfo);
        }
        const sessionUserId = session.openId;
        const signedInAt = /* @__PURE__ */ new Date();
        let user = await getUserByOpenId(sessionUserId);
        if (!user) {
          try {
            const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
            await upsertUser({
              openId: userInfo.openId,
              name: userInfo.name || null,
              email: userInfo.email ?? null,
              loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
              lastSignedIn: signedInAt
            });
            user = await getUserByOpenId(userInfo.openId);
          } catch (error) {
            console.error("[Auth] Failed to sync user from OAuth:", error);
            throw ForbiddenError("Failed to sync user info");
          }
        }
        if (!user) {
          console.error(
            "[Auth] authenticateRequest failed: user still not found after sync for openId:",
            sessionUserId
          );
          throw ForbiddenError("User not found after sync");
        }
        await upsertUser({
          openId: user.openId,
          lastSignedIn: signedInAt
        });
        return user;
      }
    };
    CRON_OPEN_ID_PREFIX = "cron_";
    sdk = new SDKServer();
  }
});

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t, router, publicProcedure, requireUser, protectedProcedure, adminProcedure;
var init_trpc = __esm({
  "server/_core/trpc.ts"() {
    "use strict";
    init_const();
    t = initTRPC.context().create({
      transformer: superjson
    });
    router = t.router;
    publicProcedure = t.procedure;
    requireUser = t.middleware(async (opts) => {
      const { ctx, next } = opts;
      if (!ctx.user) {
        throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
      }
      return next({
        ctx: {
          ...ctx,
          user: ctx.user
        }
      });
    });
    protectedProcedure = t.procedure.use(requireUser);
    adminProcedure = t.procedure.use(
      t.middleware(async (opts) => {
        const { ctx, next } = opts;
        if (!ctx.user || ctx.user.role !== "admin") {
          throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
        }
        return next({
          ctx: {
            ...ctx,
            user: ctx.user
          }
        });
      })
    );
  }
});

// server/_core/baseUrl.ts
function getAppBaseUrl(req) {
  const configured = process.env.APP_URL;
  if (configured) return configured.replace(/\/+$/, "");
  const host = req?.headers.host;
  if (host) {
    const forwarded = req?.headers["x-forwarded-proto"];
    const forwardedProto = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0]?.trim();
    const isLocal = /^(localhost|127\.|\[::1\])/.test(host);
    const proto = forwardedProto || (isLocal ? "http" : "https");
    return `${proto}://${host}`;
  }
  return "http://localhost:3000";
}
function getGoogleRedirectUri(req) {
  return `${getAppBaseUrl(req)}/api/oauth/google/callback`;
}
function getSpotifyRedirectUri(req) {
  return `${getAppBaseUrl(req)}/api/oauth/spotify/callback`;
}
function getMsRedirectUri(req) {
  return `${getAppBaseUrl(req)}/api/oauth/ms/callback`;
}
var init_baseUrl = __esm({
  "server/_core/baseUrl.ts"() {
    "use strict";
  }
});

// server/routers/calendar.ts
import { z as z3 } from "zod";
import { TRPCError as TRPCError3 } from "@trpc/server";
async function refreshGoogleAccessToken(refreshToken) {
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });
  const data = await resp.json();
  if (!resp.ok || !data.access_token)
    throw new Error(`Google Token-Refresh fehlgeschlagen: ${data.error}`);
  return {
    accessToken: data.access_token,
    expiresAt: Math.floor(Date.now() / 1e3) + (data.expires_in ?? 3600)
  };
}
async function refreshMsAccessToken(refreshToken) {
  const resp = await fetch(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.MS_CLIENT_ID ?? "",
        client_secret: process.env.MS_CLIENT_SECRET ?? "",
        refresh_token: refreshToken,
        grant_type: "refresh_token"
      })
    }
  );
  const data = await resp.json();
  if (!resp.ok || !data.access_token)
    throw new Error(`MS Token-Refresh fehlgeschlagen: ${data.error}`);
  return {
    accessToken: data.access_token,
    expiresAt: Math.floor(Date.now() / 1e3) + (data.expires_in ?? 3600)
  };
}
async function getValidGoogleAccessToken(userId, email) {
  const token = await getGoogleToken(userId, email);
  if (!token) throw new TRPCError3({ code: "UNAUTHORIZED" });
  if (token.expiresAt > Math.floor(Date.now() / 1e3) + 60)
    return token.accessToken;
  if (!token.refreshToken) throw new TRPCError3({ code: "UNAUTHORIZED" });
  const refreshed = await refreshGoogleAccessToken(token.refreshToken);
  await upsertGoogleToken({
    userId,
    accessToken: refreshed.accessToken,
    expiresAt: refreshed.expiresAt,
    refreshToken: token.refreshToken,
    email: token.email
  });
  return refreshed.accessToken;
}
async function getValidMsAccessToken(userId, email) {
  const token = await getMicrosoftToken(userId, email);
  if (!token) throw new TRPCError3({ code: "UNAUTHORIZED" });
  if (token.expiresAt > Math.floor(Date.now() / 1e3) + 60)
    return token.accessToken;
  if (!token.refreshToken) throw new TRPCError3({ code: "UNAUTHORIZED" });
  const refreshed = await refreshMsAccessToken(token.refreshToken);
  await upsertMicrosoftToken({
    userId,
    accessToken: refreshed.accessToken,
    expiresAt: refreshed.expiresAt,
    refreshToken: token.refreshToken,
    email: token.email
  });
  return refreshed.accessToken;
}
async function gcalFetch(userId, email, path4, options = {}) {
  const accessToken = await getValidGoogleAccessToken(userId, email);
  const resp = await fetch(`https://www.googleapis.com/calendar/v3${path4}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers ?? {}
    }
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new TRPCError3({
      code: "INTERNAL_SERVER_ERROR",
      message: `Google Calendar Fehler: ${resp.status} ${err.slice(0, 200)}`
    });
  }
  if (resp.status === 204) return {};
  return resp.json();
}
async function msFetch(userId, email, path4, options = {}) {
  const accessToken = await getValidMsAccessToken(userId, email);
  const resp = await fetch(`https://graph.microsoft.com/v1.0${path4}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: 'outlook.timezone="UTC"',
      ...options.headers ?? {}
    }
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new TRPCError3({
      code: "INTERNAL_SERVER_ERROR",
      message: `MS Graph Fehler: ${resp.status} ${err.slice(0, 200)}`
    });
  }
  if (resp.status === 204) return {};
  return resp.json();
}
var GOOGLE_SCOPES, MS_SCOPES, calendarRouter;
var init_calendar = __esm({
  "server/routers/calendar.ts"() {
    "use strict";
    init_trpc();
    init_db();
    init_baseUrl();
    GOOGLE_SCOPES = [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
      "email",
      "profile"
    ].join(" ");
    MS_SCOPES = ["Calendars.ReadWrite", "Mail.Read", "offline_access", "User.Read"].join(
      " "
    );
    calendarRouter = router({
      // Verbindungsstatus prüfen
      getStatus: protectedProcedure.query(async ({ ctx }) => {
        const gTokens = await getGoogleTokens(ctx.user.id);
        const msTokens = await getMicrosoftTokens(ctx.user.id);
        return {
          connected: gTokens.length > 0 || msTokens.length > 0,
          googleAccounts: gTokens.map((t2) => ({
            email: t2.email,
            provider: "google"
          })),
          msAccounts: msTokens.map((t2) => ({ email: t2.email, provider: "ms" })),
          // Fallbacks for old UI if any
          googleConnected: gTokens.length > 0,
          googleEmail: gTokens[0]?.email ?? null,
          msConnected: msTokens.length > 0,
          msEmail: msTokens[0]?.email ?? null
        };
      }),
      // OAuth-Login-URL generieren
      getAuthUrl: protectedProcedure.query(async ({ ctx }) => {
        const params = new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID ?? "",
          redirect_uri: getGoogleRedirectUri(ctx.req),
          response_type: "code",
          scope: GOOGLE_SCOPES,
          access_type: "offline",
          prompt: "consent",
          state: JSON.stringify({ userId: ctx.user.id })
        });
        const stateB64 = Buffer.from(params.get("state")).toString("base64");
        params.set("state", stateB64);
        return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` };
      }),
      getMsAuthUrl: protectedProcedure.query(async ({ ctx }) => {
        const params = new URLSearchParams({
          client_id: process.env.MS_CLIENT_ID ?? "",
          redirect_uri: getMsRedirectUri(ctx.req),
          response_type: "code",
          scope: MS_SCOPES,
          state: JSON.stringify({ userId: ctx.user.id })
        });
        const stateB64 = Buffer.from(params.get("state")).toString("base64");
        params.set("state", stateB64);
        return {
          url: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`
        };
      }),
      // Verbindung trennen
      disconnect: protectedProcedure.input(z3.object({ email: z3.string().optional() }).optional()).mutation(async ({ ctx, input }) => {
        await deleteGoogleToken(ctx.user.id, input?.email);
        return { success: true };
      }),
      disconnectMs: protectedProcedure.input(z3.object({ email: z3.string().optional() }).optional()).mutation(async ({ ctx, input }) => {
        await deleteMicrosoftToken(ctx.user.id, input?.email);
        return { success: true };
      }),
      // Kalender-Liste
      listCalendars: protectedProcedure.query(async ({ ctx }) => {
        const gTokens = await getGoogleTokens(ctx.user.id);
        const msTokens = await getMicrosoftTokens(ctx.user.id);
        const calendars = [];
        for (const gToken of gTokens) {
          if (!gToken.email) continue;
          const gData = await gcalFetch(
            ctx.user.id,
            gToken.email,
            "/users/me/calendarList?showHidden=true"
          );
          let disabledList = [];
          try {
            disabledList = JSON.parse(gToken.disabledCalendars || "[]");
          } catch (e) {
            disabledList = [];
          }
          if (gData.items) {
            calendars.push(
              ...gData.items.map((c) => ({
                id: `google:${gToken.email}:${c.id}`,
                summary: `[${gToken.email}] ${c.summary}`,
                primary: c.primary,
                backgroundColor: c.backgroundColor,
                enabled: !disabledList.includes(c.id)
              }))
            );
          }
        }
        for (const msToken of msTokens) {
          if (!msToken.email) continue;
          let allMsCalendars = [];
          try {
            const groupsData = await msFetch(
              ctx.user.id,
              msToken.email,
              "/me/calendarGroups"
            );
            if (groupsData.value) {
              const groupPromises = groupsData.value.map(
                (group) => msFetch(ctx.user.id, msToken.email, `/me/calendarGroups/${group.id}/calendars`)
              );
              const groupsCalendars = await Promise.all(groupPromises);
              for (const group of groupsCalendars) {
                if (group.value) {
                  allMsCalendars.push(...group.value);
                }
              }
            } else {
              const msData = await msFetch(
                ctx.user.id,
                msToken.email,
                "/me/calendars"
              );
              if (msData.value) allMsCalendars.push(...msData.value);
            }
          } catch (e) {
            console.error("Error fetching MS calendars:", e);
          }
          let disabledList = [];
          try {
            disabledList = JSON.parse(msToken.disabledCalendars || "[]");
          } catch (e) {
            disabledList = [];
          }
          if (allMsCalendars.length > 0) {
            calendars.push(
              ...allMsCalendars.map((c) => ({
                id: `ms:${msToken.email}:${c.id}`,
                summary: `[${msToken.email}] ${c.name}`,
                primary: c.isDefaultCalendar,
                backgroundColor: c.hexColor,
                enabled: !disabledList.includes(c.id)
              }))
            );
          }
        }
        return calendars;
      }),
      // Kalender aktivieren/deaktivieren
      toggleCalendar: protectedProcedure.input(z3.object({ calendarId: z3.string(), enabled: z3.boolean() })).mutation(async ({ ctx, input }) => {
        const [provider, email, ...rawIdParts] = input.calendarId.split(":");
        const rawCalId = rawIdParts.join(":");
        if (provider === "google") {
          const token = await getGoogleToken(ctx.user.id, email);
          if (!token) throw new TRPCError3({ code: "NOT_FOUND" });
          let disabledList = [];
          try {
            disabledList = JSON.parse(token.disabledCalendars || "[]");
          } catch (e) {
          }
          if (input.enabled) {
            disabledList = disabledList.filter((id) => id !== rawCalId);
          } else {
            if (!disabledList.includes(rawCalId)) disabledList.push(rawCalId);
          }
          await upsertGoogleToken({
            ...token,
            disabledCalendars: JSON.stringify(disabledList)
          });
        } else if (provider === "ms") {
          const token = await getMicrosoftToken(ctx.user.id, email);
          if (!token) throw new TRPCError3({ code: "NOT_FOUND" });
          let disabledList = [];
          try {
            disabledList = JSON.parse(token.disabledCalendars || "[]");
          } catch (e) {
          }
          if (input.enabled) {
            disabledList = disabledList.filter((id) => id !== rawCalId);
          } else {
            if (!disabledList.includes(rawCalId)) disabledList.push(rawCalId);
          }
          await upsertMicrosoftToken({
            ...token,
            disabledCalendars: JSON.stringify(disabledList)
          });
        }
        return { success: true };
      }),
      // Termine abrufen
      listEvents: protectedProcedure.input(
        z3.object({
          calendarId: z3.string().default("google:primary"),
          timeMin: z3.string().optional(),
          // ISO 8601
          timeMax: z3.string().optional(),
          maxResults: z3.number().default(50)
        })
      ).query(async ({ ctx, input }) => {
        const [provider, email, ...rawIdParts] = input.calendarId.split(":");
        const rawCalId = rawIdParts.join(":");
        const isMs = provider === "ms";
        if (isMs) {
          const query = [
            `$top=${input.maxResults}`,
            `$orderby=start/dateTime`
          ];
          if (input.timeMin || input.timeMax) {
            const filters = [];
            if (input.timeMin)
              filters.push(`start/dateTime ge '${input.timeMin}'`);
            if (input.timeMax) filters.push(`end/dateTime le '${input.timeMax}'`);
            query.push(`$filter=${filters.join(" and ")}`);
          }
          const data = await msFetch(
            ctx.user.id,
            email,
            `/me/calendars/${encodeURIComponent(rawCalId)}/events?${query.join("&")}`
          );
          return (data.value ?? []).map((e) => ({
            id: e.id,
            summary: e.subject,
            description: e.bodyPreview,
            start: {
              dateTime: e.start?.dateTime ? e.start.dateTime + "Z" : void 0
            },
            end: { dateTime: e.end?.dateTime ? e.end.dateTime + "Z" : void 0 },
            location: e.location?.displayName,
            htmlLink: e.webLink
          }));
        } else {
          const params = new URLSearchParams({
            singleEvents: "true",
            orderBy: "startTime",
            maxResults: String(input.maxResults),
            ...input.timeMin ? { timeMin: input.timeMin } : {},
            ...input.timeMax ? { timeMax: input.timeMax } : {}
          });
          const data = await gcalFetch(
            ctx.user.id,
            email,
            `/calendars/${encodeURIComponent(rawCalId)}/events?${params}`
          );
          return data.items ?? [];
        }
      }),
      // Termin erstellen
      createEvent: protectedProcedure.input(
        z3.object({
          calendarId: z3.string().default("google:primary"),
          summary: z3.string(),
          description: z3.string().optional(),
          location: z3.string().optional(),
          startDateTime: z3.string(),
          // ISO 8601
          endDateTime: z3.string(),
          timeZone: z3.string().default("Europe/Zurich"),
          allDay: z3.boolean().default(false)
        })
      ).mutation(async ({ ctx, input }) => {
        const [provider, email, ...rawIdParts] = input.calendarId.split(":");
        const rawCalId = rawIdParts.join(":");
        const isMs = provider === "ms";
        if (isMs) {
          const msEvent = {
            subject: input.summary,
            body: { contentType: "text", content: input.description ?? "" },
            location: { displayName: input.location ?? "" },
            start: { dateTime: input.startDateTime, timeZone: input.timeZone },
            end: { dateTime: input.endDateTime, timeZone: input.timeZone },
            isAllDay: input.allDay
          };
          const data = await msFetch(
            ctx.user.id,
            email,
            `/me/calendars/${encodeURIComponent(rawCalId)}/events`,
            { method: "POST", body: JSON.stringify(msEvent) }
          );
          return { id: data.id, summary: data.subject, htmlLink: data.webLink };
        } else {
          const gEvent = {
            summary: input.summary,
            description: input.description,
            location: input.location,
            start: input.allDay ? { date: input.startDateTime.split("T")[0] } : { dateTime: input.startDateTime, timeZone: input.timeZone },
            end: input.allDay ? { date: input.endDateTime.split("T")[0] } : { dateTime: input.endDateTime, timeZone: input.timeZone }
          };
          const data = await gcalFetch(
            ctx.user.id,
            email,
            `/calendars/${encodeURIComponent(rawCalId)}/events`,
            { method: "POST", body: JSON.stringify(gEvent) }
          );
          return { id: data.id, summary: data.summary, htmlLink: data.htmlLink };
        }
      }),
      // Termin bearbeiten
      updateEvent: protectedProcedure.input(
        z3.object({
          calendarId: z3.string().default("google:primary"),
          eventId: z3.string(),
          summary: z3.string().optional(),
          description: z3.string().optional(),
          location: z3.string().optional(),
          startDateTime: z3.string().optional(),
          endDateTime: z3.string().optional(),
          timeZone: z3.string().default("Europe/Zurich")
        })
      ).mutation(async ({ ctx, input }) => {
        const [provider, email, ...rawIdParts] = input.calendarId.split(":");
        const rawCalId = rawIdParts.join(":");
        const isMs = provider === "ms";
        if (isMs) {
          const patch = {};
          if (input.summary) patch.subject = input.summary;
          if (input.description !== void 0)
            patch.body = { contentType: "text", content: input.description };
          if (input.location !== void 0)
            patch.location = { displayName: input.location };
          if (input.startDateTime)
            patch.start = {
              dateTime: input.startDateTime,
              timeZone: input.timeZone
            };
          if (input.endDateTime)
            patch.end = { dateTime: input.endDateTime, timeZone: input.timeZone };
          return msFetch(
            ctx.user.id,
            email,
            `/me/calendars/${encodeURIComponent(rawCalId)}/events/${input.eventId}`,
            { method: "PATCH", body: JSON.stringify(patch) }
          );
        } else {
          const current = await gcalFetch(
            ctx.user.id,
            email,
            `/calendars/${encodeURIComponent(rawCalId)}/events/${input.eventId}`
          );
          const patch = { ...current };
          if (input.summary) patch.summary = input.summary;
          if (input.description !== void 0)
            patch.description = input.description;
          if (input.location !== void 0) patch.location = input.location;
          if (input.startDateTime)
            patch.start = {
              dateTime: input.startDateTime,
              timeZone: input.timeZone
            };
          if (input.endDateTime)
            patch.end = { dateTime: input.endDateTime, timeZone: input.timeZone };
          return gcalFetch(
            ctx.user.id,
            email,
            `/calendars/${encodeURIComponent(rawCalId)}/events/${input.eventId}`,
            { method: "PUT", body: JSON.stringify(patch) }
          );
        }
      }),
      // Termin löschen
      deleteEvent: protectedProcedure.input(
        z3.object({
          calendarId: z3.string().default("google:primary"),
          eventId: z3.string()
        })
      ).mutation(async ({ ctx, input }) => {
        const [provider, email, ...rawIdParts] = input.calendarId.split(":");
        const rawCalId = rawIdParts.join(":");
        const isMs = provider === "ms";
        if (isMs) {
          await msFetch(
            ctx.user.id,
            email,
            `/me/calendars/${encodeURIComponent(rawCalId)}/events/${input.eventId}`,
            { method: "DELETE" }
          );
        } else {
          await gcalFetch(
            ctx.user.id,
            email,
            `/calendars/${encodeURIComponent(rawCalId)}/events/${input.eventId}`,
            { method: "DELETE" }
          );
        }
        return { success: true };
      })
    });
  }
});

// server/_core/calendarAI.ts
async function executeCalendarAction(userId, action, params) {
  const gTokens = await getGoogleTokens(userId);
  const msTokens = await getMicrosoftTokens(userId);
  if (gTokens.length === 0 && msTokens.length === 0) {
    return "Kein Kalender ist verbunden.";
  }
  const getEnabledCalendars = async () => {
    const enabled = [];
    for (const gToken of gTokens) {
      if (!gToken.email) continue;
      let disabledList = [];
      try {
        disabledList = JSON.parse(gToken.disabledCalendars || "[]");
      } catch (e) {
      }
      const gData = await gcalFetch(
        userId,
        gToken.email,
        "/users/me/calendarList"
      ).catch(() => null);
      if (gData?.items) {
        for (const c of gData.items) {
          if (!disabledList.includes(c.id)) {
            enabled.push({
              provider: "google",
              email: gToken.email,
              rawId: c.id,
              name: c.summary
            });
          }
        }
      }
    }
    for (const msToken of msTokens) {
      if (!msToken.email) continue;
      let disabledList = [];
      try {
        disabledList = JSON.parse(msToken.disabledCalendars || "[]");
      } catch (e) {
      }
      const msData = await msFetch(
        userId,
        msToken.email,
        "/me/calendars"
      ).catch(() => null);
      if (msData?.value) {
        for (const c of msData.value) {
          if (!disabledList.includes(c.id)) {
            enabled.push({
              provider: "ms",
              email: msToken.email,
              rawId: c.id,
              name: c.name
            });
          }
        }
      }
    }
    return enabled;
  };
  const enabledCalendars = await getEnabledCalendars();
  if (enabledCalendars.length === 0) {
    return "Es sind keine Kalender aktiviert.";
  }
  const calIdParam = params.calendarId;
  if (action === "list_events") {
    const now = /* @__PURE__ */ new Date();
    const tMin = params.timeMin ?? now.toISOString();
    const tMax = params.timeMax ?? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1e3).toISOString();
    const allEvents = [];
    const tz = "Europe/Zurich";
    for (const cal of enabledCalendars) {
      if (cal.provider === "google") {
        const data = await gcalFetch(
          userId,
          cal.email,
          `/calendars/${encodeURIComponent(cal.rawId)}/events?singleEvents=true&orderBy=startTime&maxResults=20&timeMin=${encodeURIComponent(tMin)}&timeMax=${encodeURIComponent(tMax)}`
        ).catch(() => null);
        if (data?.items) {
          for (const ev of data.items) {
            const d = new Date(ev.start?.dateTime ?? ev.start?.date ?? "");
            const dateStr = d.toLocaleDateString("de-DE", {
              weekday: "short",
              day: "2-digit",
              month: "2-digit",
              timeZone: tz
            });
            const timeStr = ev.start?.dateTime ? d.toLocaleTimeString("de-DE", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: tz
            }) : "Ganzt\xE4gig";
            let inviteInfo = "";
            if (ev.organizer && !ev.organizer.self) {
              const organizerName = ev.organizer.displayName || ev.organizer.email?.split("@")[0] || "jemanden";
              inviteInfo = ` [Einladung von ${organizerName}]`;
            }
            allEvents.push({
              start: d.getTime(),
              text: `\u2022 [${cal.name}] ${dateStr} ${timeStr}: ${ev.summary ?? "Termin"}${ev.location ? ` (${ev.location})` : ""}${inviteInfo}`
            });
          }
        }
      } else {
        const data = await msFetch(
          userId,
          cal.email,
          `/me/calendars/${encodeURIComponent(cal.rawId)}/events?$filter=start/dateTime ge '${tMin}' and start/dateTime le '${tMax}'&$orderby=start/dateTime&$top=20`
        ).catch(() => null);
        if (data?.value) {
          for (const ev of data.value) {
            const d = /* @__PURE__ */ new Date(
              ev.start?.dateTime ? ev.start.dateTime + "Z" : ""
            );
            const dateStr = d.toLocaleDateString("de-DE", {
              weekday: "short",
              day: "2-digit",
              month: "2-digit",
              timeZone: tz
            });
            const timeStr = !ev.isAllDay ? d.toLocaleTimeString("de-DE", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: tz
            }) : "Ganzt\xE4gig";
            let inviteInfo = "";
            if (ev.organizer?.emailAddress?.name) {
              inviteInfo = ` [Einladung von ${ev.organizer.emailAddress.name}]`;
            }
            allEvents.push({
              start: d.getTime(),
              text: `\u2022 [${cal.name}] ${dateStr} ${timeStr}: ${ev.subject ?? "Termin"}${ev.location?.displayName ? ` (${ev.location.displayName})` : ""}${inviteInfo}`
            });
          }
        }
      }
    }
    allEvents.sort((a, b) => a.start - b.start);
    if (allEvents.length === 0) return "Keine Termine in diesem Zeitraum.";
    return allEvents.map((e) => e.text).join("\n");
  }
  let targetCal = enabledCalendars[0];
  if (calIdParam && calIdParam !== "primary") {
    const [provider, email, ...rawIdParts] = calIdParam.split(":");
    const rawId = rawIdParts.join(":");
    const found = enabledCalendars.find(
      (c) => c.provider === provider && c.email === email && c.rawId === rawId
    );
    if (found) targetCal = found;
  }
  if (action === "create_event") {
    if (targetCal.provider === "google") {
      const event = {
        summary: params.summary,
        description: params.description,
        location: params.location,
        start: { dateTime: params.startDateTime, timeZone: "Europe/Zurich" },
        end: { dateTime: params.endDateTime, timeZone: "Europe/Zurich" }
      };
      const data = await gcalFetch(
        userId,
        targetCal.email,
        `/calendars/${encodeURIComponent(targetCal.rawId)}/events`,
        {
          method: "POST",
          body: JSON.stringify(event)
        }
      );
      return `Termin "${data.summary}" wurde in [${targetCal.name}] erstellt.`;
    } else {
      const event = {
        subject: params.summary,
        body: { contentType: "text", content: params.description ?? "" },
        location: { displayName: params.location ?? "" },
        start: { dateTime: params.startDateTime, timeZone: "Europe/Zurich" },
        end: { dateTime: params.endDateTime, timeZone: "Europe/Zurich" }
      };
      const data = await msFetch(
        userId,
        targetCal.email,
        `/me/calendars/${encodeURIComponent(targetCal.rawId)}/events`,
        {
          method: "POST",
          body: JSON.stringify(event)
        }
      );
      return `Termin "${data.subject}" wurde in [${targetCal.name}] erstellt.`;
    }
  }
  if (action === "update_event") {
    if (!params.eventId) return "Event ID fehlt.";
    if (targetCal.provider === "google") {
      const event = {};
      if (params.summary) event.summary = params.summary;
      if (params.description) event.description = params.description;
      if (params.location) event.location = params.location;
      if (params.startDateTime)
        event.start = {
          dateTime: params.startDateTime,
          timeZone: "Europe/Zurich"
        };
      if (params.endDateTime)
        event.end = { dateTime: params.endDateTime, timeZone: "Europe/Zurich" };
      await gcalFetch(
        userId,
        targetCal.email,
        `/calendars/${encodeURIComponent(targetCal.rawId)}/events/${params.eventId}`,
        {
          method: "PATCH",
          body: JSON.stringify(event)
        }
      );
      return `Termin wurde in [${targetCal.name}] aktualisiert.`;
    } else {
      const event = {};
      if (params.summary) event.subject = params.summary;
      if (params.description)
        event.body = { contentType: "text", content: params.description };
      if (params.location) event.location = { displayName: params.location };
      if (params.startDateTime)
        event.start = {
          dateTime: params.startDateTime,
          timeZone: "Europe/Zurich"
        };
      if (params.endDateTime)
        event.end = { dateTime: params.endDateTime, timeZone: "Europe/Zurich" };
      await msFetch(
        userId,
        targetCal.email,
        `/me/calendars/${encodeURIComponent(targetCal.rawId)}/events/${params.eventId}`,
        {
          method: "PATCH",
          body: JSON.stringify(event)
        }
      );
      return `Termin wurde in [${targetCal.name}] aktualisiert.`;
    }
  }
  if (action === "delete_event") {
    if (!params.eventId) return "Event ID fehlt.";
    if (targetCal.provider === "google") {
      await gcalFetch(
        userId,
        targetCal.email,
        `/calendars/${encodeURIComponent(targetCal.rawId)}/events/${params.eventId}`,
        { method: "DELETE" }
      );
      return `Termin in [${targetCal.name}] gel\xF6scht.`;
    } else {
      await msFetch(
        userId,
        targetCal.email,
        `/me/calendars/${encodeURIComponent(targetCal.rawId)}/events/${params.eventId}`,
        { method: "DELETE" }
      );
      return `Termin in [${targetCal.name}] gel\xF6scht.`;
    }
  }
  return "Unbekannte Kalender-Aktion.";
}
var init_calendarAI = __esm({
  "server/_core/calendarAI.ts"() {
    "use strict";
    init_db();
    init_calendar();
  }
});

// server/storage.ts
function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (!forgeUrl || !forgeKey) {
    throw new Error(
      "Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
function appendHashSuffix(relKey) {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = appendHashSuffix(normalizeKey(relKey));
  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", key);
  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` }
  });
  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }
  const { url: s3Url } = await presignResp.json();
  if (!s3Url) throw new Error("Forge returned empty presign URL");
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data], { type: contentType });
  const uploadResp = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob
  });
  if (!uploadResp.ok) {
    throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  }
  return { key, url: `/manus-storage/${key}` };
}
var init_storage = __esm({
  "server/storage.ts"() {
    "use strict";
    init_env();
  }
});

// server/_core/anthropicLlm.ts
import Anthropic from "@anthropic-ai/sdk";
function getClient() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY ist nicht konfiguriert");
    client = new Anthropic({ apiKey });
  }
  return client;
}
function anthropicEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
function toBlock(part) {
  if (typeof part === "string") {
    return part ? { type: "text", text: part } : null;
  }
  if (part.type === "text") {
    return part.text ? { type: "text", text: part.text } : null;
  }
  if (part.type === "image_url") {
    return { type: "image", source: { type: "url", url: part.image_url.url } };
  }
  return null;
}
function toContent(content) {
  if (typeof content === "string") return content;
  const parts = Array.isArray(content) ? content : [content];
  const blocks = parts.map(toBlock).filter((b) => b !== null);
  return blocks.length > 0 ? blocks : "";
}
async function invokeViaAnthropic(params) {
  let model = process.env.ANTHROPIC_MODEL || params.model || "claude-sonnet-5";
  if (model === "claude-sonnet-4-5") {
    model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
  }
  if (model.includes("sonnet") && !model.includes("claude-sonnet-5")) {
    model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
  } else if (model.includes("haiku") || model.includes("fable")) {
    model = process.env.ANTHROPIC_MODEL || "claude-fable-5";
  } else if (model.includes("opus") && !model.includes("claude-opus-5")) {
    model = process.env.ANTHROPIC_MODEL || "claude-opus-5";
  }
  const maxTokens = params.max_tokens ?? params.maxTokens ?? 4096;
  const systemParts = [];
  const messages2 = [];
  for (const m of params.messages) {
    if (m.role === "system") {
      const c = m.content;
      systemParts.push(typeof c === "string" ? c : JSON.stringify(c));
      continue;
    }
    const role = m.role === "assistant" ? "assistant" : "user";
    messages2.push({ role, content: toContent(m.content) });
  }
  if (messages2.length === 0 || messages2[0].role !== "user") {
    messages2.unshift({ role: "user", content: "." });
  }
  const tools = params.tools?.map((t2) => ({
    name: t2.function.name,
    description: t2.function.description ?? "",
    input_schema: t2.function.parameters ?? {
      type: "object",
      properties: {}
    }
  }));
  if (params.onStream) {
    const stream = await getClient().messages.create({
      model,
      max_tokens: maxTokens,
      ...systemParts.length > 0 ? { system: systemParts.join("\n\n") } : {},
      messages: messages2,
      tools,
      stream: true
    });
    let fullText = "";
    const toolCalls2 = [];
    let currentToolCall = null;
    for await (const chunk of stream) {
      if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
        fullText += chunk.delta.text;
        params.onStream(chunk.delta.text);
      } else if (chunk.type === "content_block_start" && chunk.content_block.type === "tool_use") {
        currentToolCall = {
          id: chunk.content_block.id,
          type: "function",
          function: { name: chunk.content_block.name, arguments: "" }
        };
        toolCalls2.push(currentToolCall);
      } else if (chunk.type === "content_block_delta" && chunk.delta.type === "input_json_delta") {
        if (currentToolCall) {
          currentToolCall.function.arguments += chunk.delta.partial_json;
        }
      }
    }
    return {
      id: "stream-id",
      created: Math.floor(Date.now() / 1e3),
      model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: fullText,
            tool_calls: toolCalls2.length > 0 ? toolCalls2 : void 0
          },
          finish_reason: toolCalls2.length > 0 ? "tool_calls" : "stop"
        }
      ],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    };
  }
  const resp = await getClient().messages.create({
    model,
    max_tokens: maxTokens,
    ...systemParts.length > 0 ? { system: systemParts.join("\n\n") } : {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: messages2,
    tools
  });
  const text2 = resp.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const toolCalls = resp.content.filter((b) => b.type === "tool_use").map((b) => ({
    id: b.id,
    type: "function",
    function: {
      name: b.name,
      arguments: JSON.stringify(b.input)
    }
  }));
  return {
    id: resp.id,
    created: Math.floor(Date.now() / 1e3),
    model: resp.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: text2,
          tool_calls: toolCalls.length > 0 ? toolCalls : void 0
        },
        finish_reason: resp.stop_reason === "tool_use" ? "tool_calls" : "stop"
      }
    ],
    usage: {
      prompt_tokens: resp.usage.input_tokens,
      completion_tokens: resp.usage.output_tokens,
      total_tokens: resp.usage.input_tokens + resp.usage.output_tokens
    }
  };
}
var client;
var init_anthropicLlm = __esm({
  "server/_core/anthropicLlm.ts"() {
    "use strict";
    client = null;
  }
});

// server/_core/llm.ts
async function invokeLLM(params) {
  if (anthropicEnabled()) {
    return invokeViaAnthropic(params);
  }
  assertApiKey();
  const {
    messages: messages2,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
    model,
    thinking,
    reasoning,
    maxTokens,
    max_tokens
  } = params;
  const payload = {
    messages: messages2.map(normalizeMessage)
  };
  if (model) {
    payload.model = model;
  }
  if (tools && tools.length > 0) {
    payload.tools = tools;
  }
  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }
  const resolvedMaxTokens = max_tokens ?? maxTokens;
  if (typeof resolvedMaxTokens === "number") {
    payload.max_tokens = resolvedMaxTokens;
  }
  if (thinking) {
    payload.thinking = thinking;
  }
  if (reasoning) {
    payload.reasoning = reasoning;
  }
  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema
  });
  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }
  const response = await fetchWithBackoff(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} \u2013 ${errorText}`
    );
  }
  return await response.json();
}
var ensureArray, normalizeContentPart, normalizeMessage, normalizeToolChoice, resolveApiUrl, assertApiKey, normalizeResponseFormat, RETRY_MAX_RETRIES, RETRY_BASE_DELAY_MS, RETRY_MAX_DELAY_MS, sleep, parseRetryAfter, computeBackoffDelay, fetchWithBackoff;
var init_llm = __esm({
  "server/_core/llm.ts"() {
    "use strict";
    init_env();
    init_anthropicLlm();
    ensureArray = (value) => Array.isArray(value) ? value : [value];
    normalizeContentPart = (part) => {
      if (typeof part === "string") {
        return { type: "text", text: part };
      }
      if (part.type === "text") {
        return part;
      }
      if (part.type === "image_url") {
        return part;
      }
      if (part.type === "file_url") {
        return part;
      }
      throw new Error("Unsupported message content part");
    };
    normalizeMessage = (message) => {
      const { role, name, tool_call_id } = message;
      if (role === "tool" || role === "function") {
        const content = ensureArray(message.content).map((part) => typeof part === "string" ? part : JSON.stringify(part)).join("\n");
        return {
          role,
          name,
          tool_call_id,
          content
        };
      }
      const contentParts = ensureArray(message.content).map(normalizeContentPart);
      if (contentParts.length === 1 && contentParts[0].type === "text") {
        return {
          role,
          name,
          content: contentParts[0].text
        };
      }
      return {
        role,
        name,
        content: contentParts
      };
    };
    normalizeToolChoice = (toolChoice, tools) => {
      if (!toolChoice) return void 0;
      if (toolChoice === "none" || toolChoice === "auto") {
        return toolChoice;
      }
      if (toolChoice === "required") {
        if (!tools || tools.length === 0) {
          throw new Error(
            "tool_choice 'required' was provided but no tools were configured"
          );
        }
        if (tools.length > 1) {
          throw new Error(
            "tool_choice 'required' needs a single tool or specify the tool name explicitly"
          );
        }
        return {
          type: "function",
          function: { name: tools[0].function.name }
        };
      }
      if ("name" in toolChoice) {
        return {
          type: "function",
          function: { name: toolChoice.name }
        };
      }
      return toolChoice;
    };
    resolveApiUrl = () => ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0 ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions` : "https://forge.manus.im/v1/chat/completions";
    assertApiKey = () => {
      if (!ENV.forgeApiKey) {
        throw new Error("Weder ANTHROPIC_API_KEY noch BUILT_IN_FORGE_API_KEY ist in der .env-Datei hinterlegt!");
      }
    };
    normalizeResponseFormat = ({
      responseFormat,
      response_format,
      outputSchema,
      output_schema
    }) => {
      const explicitFormat = responseFormat || response_format;
      if (explicitFormat) {
        if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
          throw new Error(
            "responseFormat json_schema requires a defined schema object"
          );
        }
        return explicitFormat;
      }
      const schema = outputSchema || output_schema;
      if (!schema) return void 0;
      if (!schema.name || !schema.schema) {
        throw new Error("outputSchema requires both name and schema");
      }
      return {
        type: "json_schema",
        json_schema: {
          name: schema.name,
          schema: schema.schema,
          ...typeof schema.strict === "boolean" ? { strict: schema.strict } : {}
        }
      };
    };
    RETRY_MAX_RETRIES = 4;
    RETRY_BASE_DELAY_MS = 500;
    RETRY_MAX_DELAY_MS = 3e4;
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    parseRetryAfter = (value) => {
      if (!value) return void 0;
      const seconds = Number(value);
      if (Number.isFinite(seconds)) return Math.max(0, seconds * 1e3);
      const at = Date.parse(value);
      return Number.isNaN(at) ? void 0 : Math.max(0, at - Date.now());
    };
    computeBackoffDelay = (attempt, retryAfterMs) => {
      const cap = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
      const jittered = cap / 2 + Math.random() * (cap / 2);
      return Math.min(Math.max(jittered, retryAfterMs ?? 0), RETRY_MAX_DELAY_MS);
    };
    fetchWithBackoff = async (url, init) => {
      let lastError;
      for (let attempt = 0; attempt <= RETRY_MAX_RETRIES; attempt++) {
        try {
          const response = await fetch(url, init);
          if (response.ok || attempt === RETRY_MAX_RETRIES) {
            return response;
          }
          const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
          try {
            await response.body?.cancel();
          } catch {
          }
          console.warn(
            `LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after status ${response.status}`
          );
          await sleep(computeBackoffDelay(attempt, retryAfterMs));
        } catch (error) {
          lastError = error;
          if (attempt === RETRY_MAX_RETRIES) throw error;
          console.warn(
            `LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after network error`
          );
          await sleep(computeBackoffDelay(attempt));
        }
      }
      throw lastError instanceof Error ? lastError : new Error("LLM request failed after exhausting retries");
    };
  }
});

// server/_core/voiceTranscription.ts
async function transcribeAudio(options) {
  try {
    if (!ENV.forgeApiUrl) {
      return {
        error: "Voice transcription service is not configured",
        code: "SERVICE_ERROR",
        details: "BUILT_IN_FORGE_API_URL is not set"
      };
    }
    if (!ENV.forgeApiKey) {
      return {
        error: "Voice transcription service authentication is missing",
        code: "SERVICE_ERROR",
        details: "BUILT_IN_FORGE_API_KEY is not set"
      };
    }
    let audioBuffer;
    let mimeType;
    try {
      const response2 = await fetch(options.audioUrl);
      if (!response2.ok) {
        return {
          error: "Failed to download audio file",
          code: "INVALID_FORMAT",
          details: `HTTP ${response2.status}: ${response2.statusText}`
        };
      }
      audioBuffer = Buffer.from(await response2.arrayBuffer());
      mimeType = response2.headers.get("content-type") || "audio/mpeg";
      const sizeMB = audioBuffer.length / (1024 * 1024);
      if (sizeMB > 16) {
        return {
          error: "Audio file exceeds maximum size limit",
          code: "FILE_TOO_LARGE",
          details: `File size is ${sizeMB.toFixed(2)}MB, maximum allowed is 16MB`
        };
      }
    } catch (error) {
      return {
        error: "Failed to fetch audio file",
        code: "SERVICE_ERROR",
        details: error instanceof Error ? error.message : "Unknown error"
      };
    }
    const formData = new FormData();
    const filename = `audio.${getFileExtension(mimeType)}`;
    const audioBlob = new Blob([new Uint8Array(audioBuffer)], {
      type: mimeType
    });
    formData.append("file", audioBlob, filename);
    formData.append("model", "whisper-1");
    formData.append("response_format", "verbose_json");
    const prompt = options.prompt || (options.language ? `Transcribe the user's voice to text, the user's working language is ${getLanguageName(options.language)}` : "Transcribe the user's voice to text");
    formData.append("prompt", prompt);
    const baseUrl = ENV.forgeApiUrl.endsWith("/") ? ENV.forgeApiUrl : `${ENV.forgeApiUrl}/`;
    const fullUrl = new URL("v1/audio/transcriptions", baseUrl).toString();
    const response = await fetch(fullUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "Accept-Encoding": "identity"
      },
      body: formData
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return {
        error: "Transcription service request failed",
        code: "TRANSCRIPTION_FAILED",
        details: `${response.status} ${response.statusText}${errorText ? `: ${errorText}` : ""}`
      };
    }
    const whisperResponse = await response.json();
    if (!whisperResponse.text || typeof whisperResponse.text !== "string") {
      return {
        error: "Invalid transcription response",
        code: "SERVICE_ERROR",
        details: "Transcription service returned an invalid response format"
      };
    }
    return whisperResponse;
  } catch (error) {
    return {
      error: "Voice transcription failed",
      code: "SERVICE_ERROR",
      details: error instanceof Error ? error.message : "An unexpected error occurred"
    };
  }
}
function getFileExtension(mimeType) {
  const mimeToExt = {
    "audio/webm": "webm",
    "audio/mp3": "mp3",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/wave": "wav",
    "audio/ogg": "ogg",
    "audio/m4a": "m4a",
    "audio/mp4": "m4a"
  };
  return mimeToExt[mimeType] || "audio";
}
function getLanguageName(langCode) {
  const langMap = {
    en: "English",
    es: "Spanish",
    fr: "French",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
    ru: "Russian",
    ja: "Japanese",
    ko: "Korean",
    zh: "Chinese",
    ar: "Arabic",
    hi: "Hindi",
    nl: "Dutch",
    pl: "Polish",
    tr: "Turkish",
    sv: "Swedish",
    da: "Danish",
    no: "Norwegian",
    fi: "Finnish"
  };
  return langMap[langCode] || langCode;
}
var init_voiceTranscription = __esm({
  "server/_core/voiceTranscription.ts"() {
    "use strict";
    init_env();
  }
});

// shared/cleanText.ts
function removeInternalTags(text2) {
  if (!text2) return text2;
  return text2.replace(
    /<(?!maps_action>)[a-z_]+_action>[\s\S]*?(?:<\/(?!maps_action>)[a-z_]+_action>|$)/gi,
    ""
  ).replace(new RegExp(`\\s*\\[(?:${INTERNE_TAGS})\\]`, "gi"), "").replace(/\s+([.,;:!?])/g, "$1").replace(/[ \t]{2,}/g, " ");
}
function splitSentences(text2) {
  return text2.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
}
function buildSpokenSummary(clean, limit) {
  const hinweis = "Die vollst\xE4ndige Antwort steht im Chat.";
  if (limit < hinweis.length + 40) {
    const window = clean.slice(0, Math.max(1, limit - 2));
    const lastSpace = window.lastIndexOf(" ");
    const cut = lastSpace > window.length * 0.4 ? window.slice(0, lastSpace) : window;
    return `${cut.trim()} \u2026`;
  }
  const sentences = splitSentences(clean);
  if (sentences.length <= 1) {
    const window = clean.slice(0, Math.max(0, limit - hinweis.length - 2));
    const lastSpace = window.lastIndexOf(" ");
    const cut = lastSpace > window.length * 0.5 ? window.slice(0, lastSpace) : window;
    return `${cut.trim()} \u2026 ${hinweis}`;
  }
  const schluss = sentences[sentences.length - 1];
  const budgetAnfang = limit - schluss.length - hinweis.length - 4;
  const anfang = [];
  let laenge = 0;
  for (const satz of sentences.slice(0, -1)) {
    if (laenge + satz.length + 1 > budgetAnfang) break;
    anfang.push(satz);
    laenge += satz.length + 1;
  }
  if (anfang.length === 0) {
    return `${hinweis} ${schluss}`.slice(0, limit).trim();
  }
  const ergebnis = `${anfang.join(" ")} ${hinweis} ${schluss}`.trim();
  return ergebnis.length <= limit ? ergebnis : ergebnis.slice(0, limit).trim();
}
var INTERNE_TAGS;
var init_cleanText = __esm({
  "shared/cleanText.ts"() {
    "use strict";
    INTERNE_TAGS = "person|contact|preference|project|fact|context|memory|profil|profile|kalender|calendar";
  }
});

// server/cleanResponse.ts
var init_cleanResponse = __esm({
  "server/cleanResponse.ts"() {
    "use strict";
    init_cleanText();
  }
});

// server/_core/http.ts
async function fetchWithTimeout(url, init = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (signal) {
    if (signal.aborted) controller.abort();
    else
      signal.addEventListener("abort", () => controller.abort(), {
        once: true
      });
  }
  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
async function fetchWithRetry(url, init = {}, opts = {}) {
  const { retries = 3, baseDelayMs = 400, maxDelayMs = 8e3 } = opts;
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, init);
      if (response.ok || response.status < 500 || attempt === retries) {
        return response;
      }
      try {
        await response.body?.cancel();
      } catch {
      }
    } catch (error) {
      lastError = error;
      if (attempt === retries) throw error;
    }
    const cap = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
    await sleep2(cap / 2 + Math.random() * (cap / 2));
  }
  throw lastError instanceof Error ? lastError : new Error(`Anfrage an ${url} nach ${retries} Versuchen fehlgeschlagen`);
}
var DEFAULT_TIMEOUT_MS, sleep2;
var init_http = __esm({
  "server/_core/http.ts"() {
    "use strict";
    DEFAULT_TIMEOUT_MS = 1e4;
    sleep2 = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  }
});

// server/routers/appIntegration.ts
async function sbFetch(path4, options = {}) {
  const resp = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1${path4}`, {
    ...options,
    timeoutMs: 1e4,
    headers: {
      ...headers(),
      ...options.headers ?? {}
    }
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Supabase ${resp.status}: ${err}`);
  }
  return resp.json();
}
function sanitizeSearchTerm(input) {
  return input.normalize("NFC").replace(/[(),*"'\\]/g, " ").replace(/[\x00-\x1f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}
function sanitizeId(input) {
  return String(input).replace(/[^a-zA-Z0-9-]/g, "").slice(0, 64);
}
function sanitizeStatus(input) {
  return String(input).replace(/[^a-zA-Z0-9_]/g, "").slice(0, 40);
}
function listQuery(limit, status, orderBy = "created_at.desc") {
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 100);
  const term = status ? sanitizeStatus(status) : "";
  return term ? `?status=eq.${term}&limit=${safeLimit}&order=${orderBy}` : `?limit=${safeLimit}&order=${orderBy}`;
}
async function listCustomers(limit = 20, search) {
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 100);
  const term = search ? sanitizeSearchTerm(search) : "";
  const q = term ? `?or=(company_name.ilike.*${encodeURIComponent(term)}*,first_name.ilike.*${encodeURIComponent(term)}*,last_name.ilike.*${encodeURIComponent(term)}*,email.ilike.*${encodeURIComponent(term)}*)&limit=${safeLimit}&order=created_at.desc` : `?limit=${safeLimit}&order=created_at.desc`;
  return sbFetch(`/customers${q}`);
}
async function createCustomer(data) {
  return sbFetch("/customers", { method: "POST", body: JSON.stringify(data) });
}
async function getCustomer(id) {
  const rows = await sbFetch(`/customers?id=eq.${sanitizeId(id)}&limit=1`);
  return rows[0] ?? null;
}
function customerLabel(c) {
  if (!c) return "Unbekannt";
  const company = typeof c.company_name === "string" ? c.company_name.trim() : "";
  if (company) return company;
  const first = typeof c.first_name === "string" ? c.first_name : "";
  const last = typeof c.last_name === "string" ? c.last_name : "";
  const name = `${first} ${last}`.trim();
  return name || "Unbekannt";
}
async function findCustomer(idOrName) {
  const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    idOrName
  );
  if (looksLikeUuid) {
    const byId = await getCustomer(idOrName);
    if (byId) return byId;
  }
  const results = await listCustomers(5, idOrName);
  return Array.isArray(results) && results.length > 0 ? results[0] : null;
}
function num(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed2 = parseFloat(value);
    return Number.isNaN(parsed2) ? 0 : parsed2;
  }
  return 0;
}
async function getCustomerDossier(idOrName) {
  const customer = await findCustomer(idOrName);
  if (!customer) return null;
  const id = String(customer.id);
  const safe = async (fn, fallback) => {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  };
  const [tickets, quotes, invoices, projects, contracts] = await Promise.all([
    safe(
      () => sbFetch(
        `/tickets?customer_id=eq.${id}&order=created_at.desc&limit=50`
      ),
      []
    ),
    safe(
      () => sbFetch(
        `/quotes?customer_id=eq.${id}&order=created_at.desc&limit=50`
      ),
      []
    ),
    safe(
      () => sbFetch(
        `/invoices?customer_id=eq.${id}&order=created_at.desc&limit=50`
      ),
      []
    ),
    safe(
      () => sbFetch(
        `/projects?customer_id=eq.${id}&order=created_at.desc&limit=50`
      ),
      []
    ),
    safe(
      () => sbFetch(
        `/contracts?customer_id=eq.${id}&order=created_at.desc&limit=50`
      ),
      []
    )
  ]);
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const openInvoices = invoices.filter(
    (i) => ["open", "sent"].includes(String(i.status))
  );
  const paidInvoices = invoices.filter((i) => String(i.status) === "paid");
  const overdue = openInvoices.filter(
    (i) => typeof i.due_date === "string" && i.due_date < today
  );
  const openQuotes = quotes.filter(
    (q) => ["draft", "sent"].includes(String(q.status))
  );
  const amount = (row) => num(row.total ?? row.total_amount ?? row.amount ?? row.gross_total);
  return {
    customer,
    label: customerLabel(customer),
    tickets,
    quotes,
    invoices,
    projects,
    contracts,
    stats: {
      openTickets: tickets.filter(
        (t2) => ["open", "in_progress"].includes(String(t2.status))
      ).length,
      totalTickets: tickets.length,
      openInvoiceCount: openInvoices.length,
      openInvoiceAmount: openInvoices.reduce((s, i) => s + amount(i), 0),
      paidInvoiceAmount: paidInvoices.reduce((s, i) => s + amount(i), 0),
      overdueCount: overdue.length,
      overdueAmount: overdue.reduce((s, i) => s + amount(i), 0),
      openQuoteCount: openQuotes.length,
      openQuoteAmount: openQuotes.reduce((s, q) => s + amount(q), 0),
      activeProjects: projects.filter((p) => String(p.status) === "active").length,
      revenueTotal: paidInvoices.reduce((s, i) => s + amount(i), 0)
    }
  };
}
function formatDossier(d) {
  const chf = (n) => `CHF ${n.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const date = (v) => {
    if (typeof v !== "string") return "";
    const parsed2 = new Date(v);
    return Number.isNaN(parsed2.getTime()) ? "" : parsed2.toLocaleDateString("de-CH");
  };
  const c = d.customer;
  const lines = [];
  lines.push(`## Kunden-Dossier: ${d.label}`);
  const contact = [];
  if (typeof c.email === "string" && c.email)
    contact.push(`E-Mail: ${c.email}`);
  if (typeof c.phone === "string" && c.phone)
    contact.push(`Telefon: ${c.phone}`);
  const addr = [c.address, `${c.postal_code ?? ""} ${c.city ?? ""}`.trim()].filter((x) => typeof x === "string" && x).join(", ");
  if (addr) contact.push(`Adresse: ${addr}`);
  if (contact.length > 0) lines.push(contact.join(" \xB7 "));
  lines.push("");
  lines.push("**Lage auf einen Blick**");
  lines.push(
    `- Offene Rechnungen: ${d.stats.openInvoiceCount} (${chf(d.stats.openInvoiceAmount)})`
  );
  if (d.stats.overdueCount > 0) {
    lines.push(
      `- Davon \xFCberf\xE4llig: ${d.stats.overdueCount} (${chf(d.stats.overdueAmount)})`
    );
  }
  lines.push(`- Bezahlter Umsatz: ${chf(d.stats.revenueTotal)}`);
  lines.push(
    `- Offene Angebote: ${d.stats.openQuoteCount} (${chf(d.stats.openQuoteAmount)})`
  );
  lines.push(
    `- Offene Tickets: ${d.stats.openTickets} von ${d.stats.totalTickets} insgesamt`
  );
  lines.push(`- Laufende Projekte: ${d.stats.activeProjects}`);
  if (d.tickets.length > 0) {
    lines.push("");
    lines.push("**Letzte Tickets**");
    for (const t2 of d.tickets.slice(0, 5)) {
      lines.push(
        `- ${t2.title ?? "Ohne Titel"} \u2013 ${t2.status ?? "?"}${t2.priority ? ` (${t2.priority})` : ""}${date(t2.created_at) ? `, ${date(t2.created_at)}` : ""}`
      );
    }
  }
  if (d.invoices.length > 0) {
    lines.push("");
    lines.push("**Letzte Rechnungen**");
    for (const i of d.invoices.slice(0, 5)) {
      const nr = i.invoice_number ?? i.number ?? i.id;
      lines.push(
        `- ${nr} \u2013 ${i.status ?? "?"}${date(i.due_date) ? `, f\xE4llig ${date(i.due_date)}` : ""}`
      );
    }
  }
  if (d.projects.length > 0) {
    lines.push("");
    lines.push("**Projekte**");
    for (const p of d.projects.slice(0, 5)) {
      lines.push(`- ${p.title ?? p.name ?? "Ohne Titel"} \u2013 ${p.status ?? "?"}`);
    }
  }
  if (d.contracts.length > 0) {
    lines.push("");
    lines.push("**Vertr\xE4ge**");
    for (const v of d.contracts.slice(0, 5)) {
      lines.push(`- ${v.title ?? v.name ?? "Vertrag"} \u2013 ${v.status ?? "?"}`);
    }
  }
  return lines.join("\n");
}
async function listQuotes(limit = 20, status) {
  const q = listQuery(limit, status);
  const quotes = await sbFetch(`/quotes${q}`);
  for (const q2 of quotes) {
    if (q2.customer_id) {
      try {
        const c = await getCustomer(q2.customer_id);
        q2._customer = c ? c.company_name || `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() : "Unbekannt";
      } catch {
        q2._customer = "Unbekannt";
      }
    }
  }
  return quotes;
}
async function listInvoices(limit = 20, status) {
  const q = listQuery(limit, status);
  const invoices = await sbFetch(`/invoices${q}`);
  for (const inv of invoices) {
    if (inv.customer_id) {
      try {
        const c = await getCustomer(inv.customer_id);
        inv._customer = c ? c.company_name || `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() : "Unbekannt";
      } catch {
        inv._customer = "Unbekannt";
      }
    }
  }
  return invoices;
}
async function getOverdueInvoices() {
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  return sbFetch(
    `/invoices?status=neq.paid&due_date=lt.${today}&order=due_date.asc&limit=20`
  );
}
async function listTickets(limit = 20, status) {
  const q = listQuery(limit, status);
  const tickets = await sbFetch(`/tickets${q}`);
  for (const t2 of tickets) {
    if (t2.customer_id) {
      try {
        const c = await getCustomer(t2.customer_id);
        t2._customer = c ? c.company_name || `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() : "Unbekannt";
      } catch {
        t2._customer = "Unbekannt";
      }
    }
  }
  return tickets;
}
async function createTicket(data) {
  const { assigned_to, ...rest } = data;
  let assignedToId = assigned_to;
  if (assignedToId && !assignedToId.includes("-")) {
    const users2 = await sbFetch(`/users?name=ilike.*${assignedToId}*`);
    if (users2 && users2.length > 0) {
      assignedToId = users2[0].id;
    } else {
      assignedToId = void 0;
    }
  }
  return sbFetch("/tickets", {
    method: "POST",
    body: JSON.stringify({
      ...rest,
      ...assignedToId ? { assigned_to: assignedToId } : {},
      status: data.status ?? "open",
      priority: data.priority ?? "medium"
    })
  });
}
async function resolveTicketId(idOrTitle) {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    idOrTitle
  )) {
    return idOrTitle;
  }
  const cleanTitle = sanitizeSearchTerm(idOrTitle);
  const tickets = await sbFetch(
    `/tickets?title=ilike.*${encodeURIComponent(cleanTitle)}*`
  );
  if (tickets && tickets.length > 0) {
    return tickets[0].id;
  }
  throw new Error(`Ticket mit Titel/ID '${idOrTitle}' nicht gefunden.`);
}
async function assignTicket(id, user_name, customer_name) {
  const cleanName = sanitizeSearchTerm(user_name);
  const users2 = await sbFetch(
    `/users?name=ilike.*${encodeURIComponent(cleanName)}*`
  );
  if (!users2 || users2.length === 0) {
    throw new Error(`Mitarbeiter '${user_name}' nicht gefunden.`);
  }
  let finalCustomerId;
  if (customer_name) {
    const cleanCustomer = sanitizeSearchTerm(customer_name);
    const customers = await sbFetch(
      `/customers?company_name=ilike.*${encodeURIComponent(cleanCustomer)}*`
    );
    if (customers && customers.length > 0) {
      finalCustomerId = customers[0].id;
    }
  }
  const realId = await resolveTicketId(id);
  const body = {
    assigned_to: users2[0].id,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (finalCustomerId) {
    body.customer_id = finalCustomerId;
  }
  return sbFetch(`/tickets?id=eq.${realId}`, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}
async function updateTicketStatus(id, status) {
  const realId = await resolveTicketId(id);
  return sbFetch(`/tickets?id=eq.${realId}`, {
    method: "PATCH",
    body: JSON.stringify({ status, updated_at: (/* @__PURE__ */ new Date()).toISOString() })
  });
}
async function listProjects(limit = 20, status) {
  const q = listQuery(limit, status);
  return sbFetch(`/projects${q}`);
}
async function listLeads(limit = 20, status) {
  const q = listQuery(limit, status);
  return sbFetch(`/leads${q}`);
}
async function createLead(data) {
  return sbFetch("/leads", {
    method: "POST",
    body: JSON.stringify({ ...data, status: data.status ?? "new" })
  });
}
async function getAppDashboard() {
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const [
    customers,
    openTickets,
    openQuotes,
    openInvoices,
    overdueInvoices,
    activeProjects,
    newLeads
  ] = await Promise.allSettled([
    sbFetch("/customers?select=id&limit=1000"),
    sbFetch("/tickets?status=eq.open&select=id&limit=1000"),
    sbFetch("/quotes?status=eq.draft&select=id&limit=1000"),
    sbFetch(`/invoices?status=in.(open,sent)&select=id,total&limit=1000`),
    sbFetch(
      `/invoices?status=in.(open,sent)&due_date=lt.${today}&select=id,total&limit=1000`
    ),
    sbFetch("/projects?status=eq.active&select=id&limit=1000"),
    sbFetch("/leads?status=eq.new&select=id&limit=1000")
  ]);
  const get = (r) => r.status === "fulfilled" ? r.value : [];
  const openList = get(
    openInvoices
  );
  const openTotal = openList.reduce((s, i) => s + (i.total ?? 0), 0);
  const overdueList = get(
    overdueInvoices
  );
  const overdueTotal = overdueList.reduce((s, i) => s + (i.total ?? 0), 0);
  return {
    customers: get(customers).length,
    openTickets: get(openTickets).length,
    openQuotes: get(openQuotes).length,
    openInvoices: openList.length,
    openTotal,
    overdueInvoices: overdueList.length,
    overdueTotal,
    activeProjects: get(activeProjects).length,
    newLeads: get(newLeads).length
  };
}
async function createQuoteWithItems(data) {
  const quote = await sbFetch("/quotes", {
    method: "POST",
    body: JSON.stringify({
      customer_id: data.customer_id,
      quote_date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      valid_until: data.valid_until,
      notes: data.notes,
      status: "draft",
      subtotal: data.items.reduce((s, i) => s + i.quantity * i.unit_price, 0),
      total: data.items.reduce(
        (s, i) => s + i.quantity * i.unit_price * (1 + (i.vat_rate ?? 8.1) / 100),
        0
      ),
      tax: data.items.reduce(
        (s, i) => s + i.quantity * i.unit_price * (i.vat_rate ?? 8.1) / 100,
        0
      )
    })
  });
  const q = Array.isArray(quote) ? quote[0] : quote;
  for (const item of data.items) {
    await sbFetch("/quote_items", {
      method: "POST",
      body: JSON.stringify({
        quote_id: q.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        vat_rate: item.vat_rate ?? 8.1,
        total: item.quantity * item.unit_price,
        unit: item.unit ?? "Stk."
      })
    });
  }
  return q;
}
async function markInvoicePaid(id) {
  return sbFetch(`/invoices?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "paid",
      paid_amount: null,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    })
  });
}
async function createInvoice(data) {
  const subtotal = data.items.reduce(
    (s, i) => s + i.quantity * i.unit_price,
    0
  );
  const vat = data.items.reduce(
    (s, i) => s + i.quantity * i.unit_price * (i.vat_rate ?? 8.1) / 100,
    0
  );
  const invoice = await sbFetch("/invoices", {
    method: "POST",
    body: JSON.stringify({
      customer_id: data.customer_id,
      invoice_date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      due_date: data.due_date ?? new Date(Date.now() + 30 * 864e5).toISOString().split("T")[0],
      notes: data.notes,
      status: "unpaid",
      subtotal,
      vat_amount: vat,
      total: subtotal + vat
    })
  });
  const inv = Array.isArray(invoice) ? invoice[0] : invoice;
  for (const item of data.items) {
    await sbFetch("/invoice_items", {
      method: "POST",
      body: JSON.stringify({
        invoice_id: inv.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        vat_rate: item.vat_rate ?? 8.1,
        total: item.quantity * item.unit_price,
        unit: item.unit ?? "Stk."
      })
    });
  }
  return inv;
}
async function addTicketComment(ticketId, comment, isInternal = false) {
  return sbFetch("/ticket_comments", {
    method: "POST",
    body: JSON.stringify({
      ticket_id: ticketId,
      comment,
      is_internal: isInternal,
      user_name: "Jarvis (Stefan Gross)",
      is_system: false
    })
  });
}
async function updateTicketPriority(id, priority) {
  return sbFetch(`/tickets?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ priority, updated_at: (/* @__PURE__ */ new Date()).toISOString() })
  });
}
async function listContracts(limit = 20, status) {
  const q = listQuery(limit, status);
  const contracts = await sbFetch(`/contracts${q}`);
  for (const c of contracts) {
    if (c.customer_id) {
      try {
        const cu = await getCustomer(c.customer_id);
        c._customer = cu ? cu.company_name || `${cu.first_name ?? ""} ${cu.last_name ?? ""}`.trim() : "Unbekannt";
      } catch {
        c._customer = "Unbekannt";
      }
    }
  }
  return contracts;
}
async function listExpenses(limit = 20) {
  return sbFetch(`/expenses?limit=${limit}&order=expense_date.desc`);
}
async function createExpense(data) {
  return sbFetch("/expenses", {
    method: "POST",
    body: JSON.stringify({
      ...data,
      expense_date: data.expense_date ?? (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      vat_rate: 8.1
    })
  });
}
async function listProjectTasks(projectId) {
  return sbFetch(
    `/project_tasks?project_id=eq.${projectId}&order=sort_order.asc`
  );
}
async function createProjectTask(data) {
  return sbFetch("/project_tasks", {
    method: "POST",
    body: JSON.stringify({
      ...data,
      status: data.status ?? "todo",
      priority: data.priority ?? "medium"
    })
  });
}
async function listProducts(limit = 30) {
  return sbFetch(`/products?is_active=eq.true&limit=${limit}&order=name.asc`);
}
async function updateLeadStatus(id, status) {
  return sbFetch(`/leads?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status, updated_at: (/* @__PURE__ */ new Date()).toISOString() })
  });
}
async function createProject(data) {
  return sbFetch("/projects", {
    method: "POST",
    body: JSON.stringify({
      ...data,
      status: data.status ?? "active",
      priority: data.priority ?? "medium"
    })
  });
}
async function executeAppAction(action, params) {
  try {
    switch (action) {
      case "list_customers": {
        const data = await listCustomers(10, params.search);
        if (!data.length) return "Keine Kunden gefunden.";
        return `**Kunden (${data.length}):**
` + data.map(
          (c) => `\u2022 ${c.company_name || `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()} \u2013 ${c.email ?? "keine E-Mail"} (${c.status ?? "aktiv"})`
        ).join("\n");
      }
      case "create_customer": {
        const result = await createCustomer(
          params
        );
        const c = Array.isArray(result) ? result[0] : result;
        return `\u2705 Kunde erstellt: **${c.company_name || `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()}** (ID: ${c.id})`;
      }
      case "customer_dossier": {
        const key = params.customer ?? params.name ?? params.id ?? params.search;
        if (!key) return "F\xFCr welchen Kunden soll ich das Dossier erstellen?";
        const dossier = await getCustomerDossier(key);
        if (!dossier)
          return `Ich habe keinen Kunden gefunden, der zu \u201E${key}" passt.`;
        return formatDossier(dossier);
      }
      case "list_tickets": {
        const data = await listTickets(10, params.status);
        if (!data.length) return "Keine Tickets gefunden.";
        const priorityIcon = {
          high: "\u{1F534}",
          medium: "\u{1F7E1}",
          low: "\u{1F7E2}"
        };
        return `**Tickets (${data.length}):**
` + data.map(
          (t2) => `\u2022 ${priorityIcon[t2.priority] ?? "\u26AA"} [${t2.status}] ${t2.title} \u2013 ${t2._customer ?? "Unbekannt"}`
        ).join("\n");
      }
      case "create_ticket": {
        const result = await createTicket(
          params
        );
        const t2 = Array.isArray(result) ? result[0] : result;
        return `\u2705 Ticket erstellt: **${t2.title}** (ID: ${t2.id}, Status: ${t2.status})`;
      }
      case "update_ticket_status": {
        await updateTicketStatus(params.id, params.status);
        return `\u2705 Ticket ${params.id} Status auf **${params.status}** gesetzt.`;
      }
      case "assign_ticket": {
        await assignTicket(params.id, params.user_name);
        return `\u2705 Ticket ${params.id} an Mitarbeiter **${params.user_name}** zugewiesen.`;
      }
      case "list_quotes": {
        const data = await listQuotes(10, params.status);
        if (!data.length) return "Keine Angebote gefunden.";
        return `**Angebote (${data.length}):**
` + data.map(
          (q) => `\u2022 [${q.status}] Angebot ${q.quote_number} \u2013 ${q._customer ?? "Unbekannt"} \u2013 CHF ${Number(q.total ?? 0).toLocaleString("de-CH")}`
        ).join("\n");
      }
      case "list_invoices": {
        const data = await listInvoices(10, params.status);
        if (!data.length) return "Keine Rechnungen gefunden.";
        return `**Rechnungen (${data.length}):**
` + data.map(
          (inv) => `\u2022 [${inv.status}] Rechnung ${inv.invoice_number} \u2013 ${inv._customer ?? "Unbekannt"} \u2013 CHF ${Number(inv.total ?? 0).toLocaleString("de-CH")} (f\xE4llig: ${inv.due_date ?? "\u2013"})`
        ).join("\n");
      }
      case "list_overdue_invoices": {
        const data = await getOverdueInvoices();
        if (!data.length) return "Keine \xFCberf\xE4lligen Rechnungen. \u{1F389}";
        const total = data.reduce(
          (s, i) => s + (i.total ?? 0),
          0
        );
        return `**\xDCberf\xE4llige Rechnungen (${data.length}), Total: CHF ${total.toLocaleString("de-CH")}:**
` + data.map(
          (inv) => `\u2022 Rechnung ${inv.invoice_number} \u2013 CHF ${Number(inv.total ?? 0).toLocaleString("de-CH")} \u2013 f\xE4llig seit ${inv.due_date}`
        ).join("\n");
      }
      case "list_projects": {
        const data = await listProjects(10, params.status);
        if (!data.length) return "Keine Projekte gefunden.";
        return `**Projekte (${data.length}):**
` + data.map(
          (p) => `\u2022 [${p.status}] ${p.title} (Nr. ${p.project_number}) \u2013 Budget: CHF ${Number(p.budget ?? 0).toLocaleString("de-CH")}`
        ).join("\n");
      }
      case "list_leads": {
        const data = await listLeads(10, params.status);
        if (!data.length) return "Keine Leads gefunden.";
        return `**Leads (${data.length}):**
` + data.map(
          (l) => `\u2022 [${l.status}] ${l.name} \u2013 ${l.company ?? "\u2013"} \u2013 CHF ${Number(l.value ?? 0).toLocaleString("de-CH")}`
        ).join("\n");
      }
      case "create_lead": {
        const result = await createLead(
          params
        );
        const l = Array.isArray(result) ? result[0] : result;
        return `\u2705 Lead erstellt: **${l.name}** (${l.company ?? "\u2013"}, ID: ${l.id})`;
      }
      case "dashboard": {
        const d = await getAppDashboard();
        let invoiceInfo = `\u2022 \u{1F4C4} Offene Rechnungen: ${d.openInvoices} (CHF ${d.openTotal.toLocaleString("de-CH")})`;
        if (d.overdueInvoices > 0) {
          invoiceInfo += `
\u2022 \u26A0\uFE0F Davon \xFCberf\xE4llig: ${d.overdueInvoices} (CHF ${d.overdueTotal.toLocaleString("de-CH")})`;
        }
        return `**App-Dashboard:**
\u2022 \u{1F465} Kunden: ${d.customers}
\u2022 \u{1F3AB} Offene Tickets: ${d.openTickets}
\u2022 \u{1F4DD} Offene Angebote: ${d.openQuotes}
${invoiceInfo}
\u2022 \u{1F680} Aktive Projekte: ${d.activeProjects}
\u2022 \u{1F3AF} Neue Leads: ${d.newLeads}`;
      }
      case "create_quote": {
        const result = await createQuoteWithItems(
          params
        );
        return `\u2705 Angebot erstellt: **Angebot ${result.quote_number}** f\xFCr Kunde ${params.customer_id} (ID: ${result.id}, Total: CHF ${Number(result.total ?? 0).toLocaleString("de-CH")})`;
      }
      case "create_invoice": {
        const result = await createInvoice(
          params
        );
        return `\u2705 Rechnung erstellt: **Rechnung ${result.invoice_number}** (ID: ${result.id}, Total: CHF ${Number(result.total ?? 0).toLocaleString("de-CH")}, f\xE4llig: ${result.due_date})`;
      }
      case "mark_invoice_paid": {
        await markInvoicePaid(params.id);
        return `\u2705 Rechnung ${params.id} als **bezahlt** markiert.`;
      }
      case "add_ticket_comment": {
        await addTicketComment(
          params.ticket_id,
          params.comment,
          params.is_internal ?? false
        );
        return `\u2705 Kommentar zu Ticket ${params.ticket_id} hinzugef\xFCgt.`;
      }
      case "update_ticket_priority": {
        await updateTicketPriority(
          params.id,
          params.priority
        );
        return `\u2705 Ticket ${params.id} Priorit\xE4t auf **${params.priority}** gesetzt.`;
      }
      case "list_contracts": {
        const data = await listContracts(10, params.status);
        if (!data.length) return "Keine Vertr\xE4ge gefunden.";
        return `**Vertr\xE4ge (${data.length}):**
` + data.map(
          (c) => `\u2022 [${c.status}] ${c.title} \u2013 ${c._customer ?? "\u2013"} \u2013 CHF ${Number(c.amount ?? 0).toLocaleString("de-CH")}/Mt. (bis: ${c.end_date ?? "unbefristet"})`
        ).join("\n");
      }
      case "list_expenses": {
        const data = await listExpenses(10);
        if (!data.length) return "Keine Ausgaben gefunden.";
        const total = data.reduce(
          (s, e) => s + (e.amount ?? 0),
          0
        );
        return `**Ausgaben (${data.length}), Total: CHF ${total.toLocaleString("de-CH")}:**
` + data.map(
          (e) => `\u2022 ${e.expense_date} \u2013 ${e.description} \u2013 CHF ${Number(e.amount ?? 0).toLocaleString("de-CH")} (${e.category ?? "\u2013"})`
        ).join("\n");
      }
      case "create_expense": {
        const result = await createExpense(
          params
        );
        const e = Array.isArray(result) ? result[0] : result;
        return `\u2705 Ausgabe erfasst: **${e.description}** \u2013 CHF ${Number(e.amount ?? 0).toLocaleString("de-CH")}`;
      }
      case "list_products": {
        const data = await listProducts();
        if (!data.length) return "Keine Produkte gefunden.";
        return `**Produkte (${data.length}):**
` + data.map(
          (p) => `\u2022 ${p.name} \u2013 CHF ${Number(p.price ?? 0).toLocaleString("de-CH")} / ${p.unit ?? "Stk."} (${p.category ?? "\u2013"})`
        ).join("\n");
      }
      case "list_project_tasks": {
        const data = await listProjectTasks(params.project_id);
        if (!data.length) return "Keine Aufgaben f\xFCr dieses Projekt.";
        return `**Projektaufgaben (${data.length}):**
` + data.map(
          (t2) => `\u2022 [${t2.status}] ${t2.title} (${t2.priority ?? "medium"})`
        ).join("\n");
      }
      case "create_project_task": {
        const result = await createProjectTask(
          params
        );
        const t2 = Array.isArray(result) ? result[0] : result;
        return `\u2705 Aufgabe erstellt: **${t2.title}** in Projekt ${params.project_id}`;
      }
      case "create_project": {
        const result = await createProject(
          params
        );
        const p = Array.isArray(result) ? result[0] : result;
        return `\u2705 Projekt erstellt: **${p.title}** (Nr. ${p.project_number}, ID: ${p.id})`;
      }
      case "update_lead_status": {
        await updateLeadStatus(params.id, params.status);
        return `\u2705 Lead ${params.id} Status auf **${params.status}** gesetzt.`;
      }
      default:
        return `Unbekannte App-Aktion: ${action}`;
    }
  } catch (e) {
    return `Fehler bei App-Aktion ${action}: ${String(e)}`;
  }
}
var SUPABASE_URL, SUPABASE_KEY, headers;
var init_appIntegration = __esm({
  "server/routers/appIntegration.ts"() {
    "use strict";
    init_http();
    SUPABASE_URL = process.env.SUPABASE_URL ?? "";
    SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    headers = () => ({
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    });
  }
});

// server/routers/spotify.ts
import { z as z4 } from "zod";
import { TRPCError as TRPCError4 } from "@trpc/server";
function basicAuth() {
  return "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
}
async function getValidSpotifyAccessToken(userId) {
  const row = await getSpotifyToken(userId);
  if (!row) return null;
  const nowSec = Math.floor(Date.now() / 1e3);
  if (row.expiresAt > nowSec + 60) return row.accessToken;
  if (!row.refreshToken) return null;
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuth()
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: row.refreshToken
    })
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    console.error("[Spotify] Refresh fehlgeschlagen", data);
    return null;
  }
  await upsertSpotifyToken({
    userId,
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? row.refreshToken,
    expiresAt: nowSec + (data.expires_in ?? 3600),
    scope: row.scope,
    displayName: row.displayName,
    product: row.product
  });
  return data.access_token;
}
async function spotifyFetch(token, path4, init = {}) {
  const res = await fetch(`https://api.spotify.com/v1${path4}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...init.body ? { "Content-Type": "application/json" } : {}
    },
    ...init.body ? { body: JSON.stringify(init.body) } : {}
  });
  if (res.status === 204) return { status: 204, data: null };
  const text2 = await res.text();
  let data = null;
  try {
    data = text2 ? JSON.parse(text2) : null;
  } catch {
    data = text2;
  }
  return { status: res.status, data };
}
async function handleSpotifyOAuthCallback(req, res) {
  try {
    const { code, state, error } = req.query;
    if (error)
      return res.redirect(
        `/integrations?spotify_error=${encodeURIComponent(error)}`
      );
    if (!code || !state)
      return res.redirect("/integrations?spotify_error=missing_params");
    const userId = parseInt(state, 10);
    if (Number.isNaN(userId))
      return res.redirect("/integrations?spotify_error=invalid_state");
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: basicAuth()
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        // Muss exakt der redirect_uri aus getAuthUrl entsprechen – beide
        // leiten sich aus derselben Basis-URL ab.
        redirect_uri: getSpotifyRedirectUri(req)
      })
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("[Spotify OAuth] Token-Fehler", tokenData);
      return res.redirect(
        `/integrations?spotify_error=${encodeURIComponent(tokenData.error ?? "token_error")}`
      );
    }
    let displayName = null;
    let product = null;
    try {
      const me = await spotifyFetch(tokenData.access_token, "/me");
      const info = me.data;
      displayName = info?.display_name ?? null;
      product = info?.product ?? null;
    } catch {
    }
    await upsertSpotifyToken({
      userId,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token ?? null,
      expiresAt: Math.floor(Date.now() / 1e3) + (tokenData.expires_in ?? 3600),
      scope: tokenData.scope ?? null,
      displayName,
      product
    });
    return res.redirect("/integrations?spotify=connected");
  } catch (err) {
    console.error("[Spotify OAuth Callback Error]", err);
    return res.redirect("/integrations?spotify_error=server_error");
  }
}
function formatTrack(t2) {
  const artists = (t2.artists ?? []).map((a) => a.name).join(", ");
  return artists ? `${t2.name} \u2013 ${artists}` : t2.name;
}
async function executeSpotifyAction(userId, action, params) {
  const token = await getValidSpotifyAccessToken(userId);
  if (!token) {
    return "\u26A0\uFE0F Spotify ist nicht verbunden. Verbinde dein Konto unter **Verbindungen \u2192 Spotify**.";
  }
  const noDevice = "\u26A0\uFE0F Kein aktives Spotify-Ger\xE4t gefunden. \xD6ffne Spotify auf dem iPhone, Mac oder im Browser und starte kurz ein Lied \u2013 danach kann ich die Wiedergabe steuern.";
  const str = (k) => typeof params[k] === "string" ? params[k] : void 0;
  const num2 = (k) => typeof params[k] === "number" ? params[k] : void 0;
  switch (action) {
    case "play": {
      const query = str("query");
      if (!query) {
        const r2 = await spotifyFetch(token, "/me/player/play", {
          method: "PUT"
        });
        if (r2.status === 404) return noDevice;
        if (r2.status === 403)
          return "\u26A0\uFE0F F\xFCr die Wiedergabesteuerung wird Spotify Premium ben\xF6tigt.";
        return "\u25B6\uFE0F Wiedergabe gestartet.";
      }
      const type = str("type") ?? "track";
      const search = await spotifyFetch(
        token,
        `/search?q=${encodeURIComponent(query)}&type=${type}&limit=1&market=CH`
      );
      const sd = search.data;
      const items = sd?.[`${type}s`]?.items ?? [];
      if (!items.length)
        return `Ich habe zu "${query}" nichts auf Spotify gefunden.`;
      if (type === "track") {
        const track = items[0];
        const r2 = await spotifyFetch(token, "/me/player/play", {
          method: "PUT",
          body: { uris: [track.uri] }
        });
        if (r2.status === 404) return noDevice;
        if (r2.status === 403)
          return "\u26A0\uFE0F F\xFCr die Wiedergabesteuerung wird Spotify Premium ben\xF6tigt.";
        return `\u25B6\uFE0F Spiele **${formatTrack(track)}**. (Hinweis: Falls nichts zu h\xF6ren ist, \xF6ffne kurz die Spotify App auf dem Handy, um das Ger\xE4t aufzuwecken.)`;
      }
      const ctx = items[0];
      const r = await spotifyFetch(token, "/me/player/play", {
        method: "PUT",
        body: { context_uri: ctx.uri }
      });
      if (r.status === 404) return noDevice;
      if (r.status === 403)
        return "\u26A0\uFE0F F\xFCr die Wiedergabesteuerung wird Spotify Premium ben\xF6tigt.";
      const label = type === "playlist" ? "Playlist" : type === "album" ? "Album" : "K\xFCnstler";
      return `\u25B6\uFE0F Spiele ${label} **${ctx.name}**. (Hinweis: Falls nichts zu h\xF6ren ist, \xF6ffne kurz die Spotify App auf dem Handy, um das Ger\xE4t aufzuwecken.)`;
    }
    case "pause": {
      const r = await spotifyFetch(token, "/me/player/pause", {
        method: "PUT"
      });
      if (r.status === 404) return noDevice;
      return "\u23F8\uFE0F Wiedergabe pausiert.";
    }
    case "next": {
      const r = await spotifyFetch(token, "/me/player/next", {
        method: "POST"
      });
      if (r.status === 404) return noDevice;
      return "\u23ED\uFE0F N\xE4chster Titel.";
    }
    case "previous": {
      const r = await spotifyFetch(token, "/me/player/previous", {
        method: "POST"
      });
      if (r.status === 404) return noDevice;
      return "\u23EE\uFE0F Vorheriger Titel.";
    }
    case "volume": {
      const level = num2("level") ?? 50;
      const clamped = Math.max(0, Math.min(100, Math.round(level)));
      const r = await spotifyFetch(
        token,
        `/me/player/volume?volume_percent=${clamped}`,
        { method: "PUT" }
      );
      if (r.status === 404) return noDevice;
      return `\u{1F50A} Lautst\xE4rke auf ${clamped}% gesetzt.`;
    }
    case "shuffle": {
      const on = params.enabled !== false;
      const r = await spotifyFetch(token, `/me/player/shuffle?state=${on}`, {
        method: "PUT"
      });
      if (r.status === 404) return noDevice;
      return on ? "\u{1F500} Zufallswiedergabe eingeschaltet." : "\u27A1\uFE0F Zufallswiedergabe ausgeschaltet.";
    }
    case "current": {
      const r = await spotifyFetch(
        token,
        "/me/player/currently-playing?market=CH"
      );
      if (r.status === 204 || !r.data)
        return "Momentan l\xE4uft nichts auf Spotify.";
      const d = r.data;
      if (!d.item) return "Momentan l\xE4uft nichts auf Spotify.";
      const state = d.is_playing ? "\u25B6\uFE0F L\xE4uft gerade" : "\u23F8\uFE0F Pausiert";
      const album = d.item.album?.name ? ` (Album: ${d.item.album.name})` : "";
      return `${state}: **${formatTrack(d.item)}**${album}`;
    }
    case "search": {
      const query = str("query");
      if (!query) return "Was soll ich auf Spotify suchen?";
      const type = str("type") ?? "track";
      const r = await spotifyFetch(
        token,
        `/search?q=${encodeURIComponent(query)}&type=${type}&limit=5&market=CH`
      );
      const sd = r.data;
      const items = sd?.[`${type}s`]?.items ?? [];
      if (!items.length) return `Zu "${query}" habe ich nichts gefunden.`;
      return `**Suchergebnisse f\xFCr "${query}":**
` + items.map((t2, i) => `${i + 1}. ${formatTrack(t2)}`).join("\n");
    }
    case "playlists": {
      const r = await spotifyFetch(token, "/me/playlists?limit=20");
      const d = r.data;
      const items = d?.items ?? [];
      if (!items.length) return "Du hast keine Playlists.";
      return `**Deine Playlists (${items.length}):**
` + items.map(
        (p) => `\u2022 ${p.name}${p.tracks ? ` (${p.tracks.total} Titel)` : ""}`
      ).join("\n");
    }
    case "devices": {
      const r = await spotifyFetch(token, "/me/player/devices");
      const d = r.data;
      const devices = d?.devices ?? [];
      if (!devices.length) return noDevice;
      return `**Verf\xFCgbare Ger\xE4te:**
` + devices.map(
        (dev) => `\u2022 ${dev.name} (${dev.type})${dev.is_active ? " \u2013 aktiv" : ""}`
      ).join("\n");
    }
    default:
      return `Unbekannte Spotify-Aktion: ${action}`;
  }
}
var CLIENT_ID, CLIENT_SECRET, SCOPES, spotifyRouter;
var init_spotify = __esm({
  "server/routers/spotify.ts"() {
    "use strict";
    init_trpc();
    init_db();
    init_baseUrl();
    CLIENT_ID = process.env.SPOTIFY_CLIENT_ID ?? "";
    CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET ?? "";
    SCOPES = [
      "user-read-playback-state",
      "user-modify-playback-state",
      "user-read-currently-playing",
      "playlist-read-private",
      "user-library-read",
      "user-top-read",
      "user-read-private",
      "user-read-email"
    ].join(" ");
    spotifyRouter = router({
      /** Status der Verbindung. */
      status: protectedProcedure.query(async ({ ctx }) => {
        const row = await getSpotifyToken(ctx.user.id);
        return {
          connected: !!row,
          displayName: row?.displayName ?? null,
          product: row?.product ?? null,
          isPremium: row?.product === "premium",
          configured: !!CLIENT_ID && !!CLIENT_SECRET
        };
      }),
      /** Autorisierungs-URL für den OAuth-Flow. */
      getAuthUrl: protectedProcedure.query(({ ctx }) => {
        if (!CLIENT_ID) {
          throw new TRPCError4({
            code: "PRECONDITION_FAILED",
            message: "Spotify ist nicht konfiguriert."
          });
        }
        const url = new URL("https://accounts.spotify.com/authorize");
        url.searchParams.set("client_id", CLIENT_ID);
        url.searchParams.set("response_type", "code");
        url.searchParams.set("redirect_uri", getSpotifyRedirectUri(ctx.req));
        url.searchParams.set("scope", SCOPES);
        url.searchParams.set("state", String(ctx.user.id));
        url.searchParams.set("show_dialog", "false");
        return { url: url.toString() };
      }),
      disconnect: protectedProcedure.mutation(async ({ ctx }) => {
        await deleteSpotifyToken(ctx.user.id);
        return { success: true };
      }),
      /** Aktuell laufender Titel (für die UI). */
      nowPlaying: protectedProcedure.query(async ({ ctx }) => {
        const token = await getValidSpotifyAccessToken(ctx.user.id);
        if (!token) return { connected: false };
        const r = await spotifyFetch(
          token,
          "/me/player/currently-playing?market=CH"
        );
        if (r.status === 204 || !r.data)
          return { connected: true, playing: false };
        const d = r.data;
        if (!d.item) return { connected: true, playing: false };
        return {
          connected: true,
          playing: !!d.is_playing,
          title: d.item.name,
          artist: (d.item.artists ?? []).map((a) => a.name).join(", "),
          album: d.item.album?.name ?? null
        };
      }),
      /** Steuerbefehl aus der UI. */
      control: protectedProcedure.input(
        z4.object({
          action: z4.enum([
            "play",
            "pause",
            "next",
            "previous",
            "volume",
            "shuffle",
            "current",
            "search",
            "playlists",
            "devices"
          ]),
          query: z4.string().optional(),
          type: z4.enum(["track", "album", "playlist", "artist"]).optional(),
          level: z4.number().min(0).max(100).optional(),
          enabled: z4.boolean().optional()
        })
      ).mutation(async ({ ctx, input }) => {
        const { action, ...params } = input;
        const message = await executeSpotifyAction(ctx.user.id, action, params);
        return { message };
      })
    });
  }
});

// server/routers/deviceCommands.ts
import { z as z5 } from "zod";
function describeDeviceCommand(type, params) {
  const s = (k) => typeof params[k] === "string" ? params[k] : "";
  switch (type) {
    case "whatsapp":
      return `WhatsApp an ${s("recipient") || "Kontakt"}: \u201E${s("message")}\u201C`;
    case "alarm":
      return `Wecker um ${s("time")}${s("label") ? ` (${s("label")})` : ""}`;
    case "timer":
      return `Timer \xFCber ${params.minutes ?? "?"} Minuten${s("label") ? ` (${s("label")})` : ""}`;
    case "reminder":
      return `Erinnerung: \u201E${s("message")}\u201C${s("time") ? ` um ${s("time")}` : ""}`;
    case "speak":
      return `Ansage: \u201E${s("text")}\u201C`;
    default:
      return `Befehl ${type}`;
  }
}
async function queueDeviceCommand(userId, type, params) {
  const allowed = ["whatsapp", "alarm", "timer", "reminder", "speak"];
  if (!allowed.includes(type)) {
    return `Unbekannter Ger\xE4te-Befehl: ${type}`;
  }
  if (type === "whatsapp" && (!params.recipient || !params.message)) {
    return "F\xFCr eine WhatsApp-Nachricht brauche ich den Empf\xE4nger und den Text.";
  }
  if (type === "alarm" && !params.time) {
    return "F\xFCr welche Uhrzeit soll ich den Wecker stellen?";
  }
  if (type === "timer" && !params.minutes) {
    return "\xDCber wie viele Minuten soll der Timer laufen?";
  }
  const summary = describeDeviceCommand(type, params);
  await createDeviceCommand(userId, type, params, summary);
  return `\u{1F4F2} An dein iPhone \xFCbergeben: ${summary}

_Der Kurzbefehl f\xFChrt den Befehl beim n\xE4chsten Abruf aus._`;
}
var deviceRouter;
var init_deviceCommands = __esm({
  "server/routers/deviceCommands.ts"() {
    "use strict";
    init_trpc();
    init_db();
    deviceRouter = router({
      list: protectedProcedure.query(async ({ ctx }) => {
        const rows = await getDeviceCommandsByUser(ctx.user.id);
        return rows.map((r) => ({
          ...r,
          params: (() => {
            try {
              return JSON.parse(r.payload);
            } catch {
              return {};
            }
          })()
        }));
      }),
      create: protectedProcedure.input(
        z5.object({
          type: z5.enum(["whatsapp", "alarm", "timer", "reminder", "speak"]),
          recipient: z5.string().optional(),
          message: z5.string().optional(),
          time: z5.string().optional(),
          minutes: z5.number().optional(),
          label: z5.string().optional(),
          text: z5.string().optional()
        })
      ).mutation(async ({ ctx, input }) => {
        const { type, ...params } = input;
        const clean = Object.fromEntries(
          Object.entries(params).filter(([, v]) => v !== void 0)
        );
        const message = await queueDeviceCommand(ctx.user.id, type, clean);
        return { message };
      }),
      markDone: protectedProcedure.input(z5.object({ id: z5.number() })).mutation(async ({ ctx, input }) => {
        await markDeviceCommandDone(input.id, ctx.user.id);
        return { success: true };
      }),
      delete: protectedProcedure.input(z5.object({ id: z5.number() })).mutation(async ({ ctx, input }) => {
        await deleteDeviceCommand(input.id, ctx.user.id);
        return { success: true };
      })
    });
  }
});

// server/_core/smarthome.ts
async function executeSmarthomeAction(params) {
  const { table, operation, match, body, select } = params;
  const baseUrl = process.env.SMARTHOME_SUPABASE_URL;
  const key = process.env.SMARTHOME_SERVICE_ROLE_KEY;
  if (!baseUrl || !key) {
    return "Fehler: Supabase Zugangsdaten f\xFCr Smarthome Pro sind nicht in der .env hinterlegt.";
  }
  const url = new URL(`${baseUrl}/rest/v1/${table}`);
  if (select) {
    url.searchParams.append("select", select);
  } else if (operation === "select" || operation === "insert" || operation === "update") {
    url.searchParams.append("select", "*");
  }
  if (match) {
    for (const [k, v] of Object.entries(match)) {
      url.searchParams.append(k, `eq.${v}`);
    }
  }
  const headers2 = {
    "apikey": key,
    "Authorization": `Bearer ${key}`,
    "Content-Type": "application/json"
  };
  if (operation === "insert" || operation === "update") {
    headers2["Prefer"] = "return=representation";
  }
  const method = operation === "select" ? "GET" : operation === "insert" ? "POST" : operation === "update" ? "PATCH" : "DELETE";
  try {
    const res = await fetch(url.toString(), {
      method,
      headers: headers2,
      body: body ? JSON.stringify(body) : void 0
    });
    if (!res.ok) {
      const err = await res.text();
      return `Fehler bei der Datenbankabfrage (${res.status}): ${err}`;
    }
    if (res.status === 204 || operation === "delete") {
      return "Aktion erfolgreich ausgef\xFChrt (Keine Daten zur\xFCckgegeben).";
    }
    const data = await res.json();
    return data;
  } catch (error) {
    return `Netzwerkfehler bei Smarthome API: ${error.message}`;
  }
}
var init_smarthome = __esm({
  "server/_core/smarthome.ts"() {
    "use strict";
  }
});

// server/_core/homeassistant.ts
async function executeHomeAssistantAction(params) {
  const baseUrl = process.env.HA_BASE_URL;
  const token = process.env.HA_ACCESS_TOKEN;
  if (!baseUrl || !token) {
    return "Fehler: Home Assistant Zugangsdaten (HA_BASE_URL, HA_ACCESS_TOKEN) sind nicht in der .env hinterlegt.";
  }
  const headers2 = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };
  try {
    if (params.action === "get_states") {
      const res = await fetch(`${baseUrl}/api/states`, { headers: headers2 });
      if (!res.ok) throw new Error(`Status ${res.status}: ${await res.text()}`);
      const states = await res.json();
      if (params.entityId) {
        const entity = states.find((s) => s.entity_id === params.entityId);
        return entity || `Entit\xE4t ${params.entityId} nicht gefunden.`;
      }
      const ACTIONABLE_DOMAINS = [
        "light",
        "switch",
        "climate",
        "cover",
        "scene",
        "script",
        "media_player",
        "automation"
      ];
      const filtered = states.filter((s) => {
        const domain = s.entity_id.split(".")[0];
        return ACTIONABLE_DOMAINS.includes(domain);
      });
      return filtered.map((s) => ({
        entity_id: s.entity_id,
        state: s.state,
        friendly_name: s.attributes?.friendly_name
      }));
    }
    if (params.action === "call_service") {
      if (!params.domain || !params.service) {
        return "Fehler: F\xFCr call_service m\xFCssen 'domain' und 'service' angegeben werden.";
      }
      const serviceData = { ...params.serviceData || {} };
      if (params.service === "turn_off" && serviceData.brightness !== void 0) {
        delete serviceData.brightness;
      }
      const res = await fetch(
        `${baseUrl}/api/services/${params.domain}/${params.service}`,
        {
          method: "POST",
          headers: headers2,
          body: JSON.stringify(serviceData)
        }
      );
      if (!res.ok) throw new Error(`Status ${res.status}: ${await res.text()}`);
      return await res.json();
    }
    return "Fehler: Unbekannte Aktion.";
  } catch (error) {
    return `Netzwerkfehler bei Home Assistant API: ${error.message}`;
  }
}
var init_homeassistant = __esm({
  "server/_core/homeassistant.ts"() {
    "use strict";
  }
});

// server/routers/news.ts
var news_exports = {};
__export(news_exports, {
  fetchLatestNews: () => fetchLatestNews,
  newsRouter: () => newsRouter
});
async function fetchLatestNews() {
  const feeds = [
    { name: "SRF", url: "https://www.srf.ch/news/bnf/rss/1646" },
    { name: "Blick", url: "https://www.blick.ch/news/rss.xml" },
    { name: "20 Minuten", url: "https://www.20min.ch/rss/rss.xml" }
  ];
  const results = await Promise.allSettled(
    feeds.map(async (f) => {
      const res = await fetch(f.url);
      if (!res.ok) throw new Error("Fetch failed");
      const xml = await res.text();
      const items = [];
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      while ((match = itemRegex.exec(xml)) !== null && items.length < 5) {
        const itemContent = match[1];
        const titleMatch = itemContent.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
        const descMatch = itemContent.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/);
        const title = titleMatch ? titleMatch[1] || titleMatch[2] : "Ohne Titel";
        const desc4 = descMatch ? descMatch[1] || descMatch[2] : "";
        items.push({
          title: title.trim(),
          description: desc4.replace(/<[^>]*>?/gm, "").trim().substring(0, 150) + "...",
          source: f.name
        });
      }
      return items;
    })
  );
  return results.filter((r) => r.status === "fulfilled").map((r) => r.value).flat();
}
var newsRouter;
var init_news = __esm({
  "server/routers/news.ts"() {
    "use strict";
    init_trpc();
    newsRouter = router({
      getLatest: protectedProcedure.query(async () => {
        return await fetchLatestNews();
      })
    });
  }
});

// server/agent.ts
var agent_exports = {};
__export(agent_exports, {
  ACTION_TAGS: () => ACTION_TAGS,
  MAX_AGENT_ROUNDS: () => MAX_AGENT_ROUNDS,
  STEP_LOG_MARKER: () => STEP_LOG_MARKER,
  describeCritical: () => describeCritical,
  ensureNextStep: () => ensureNextStep,
  executeAction: () => executeAction,
  formatObservations: () => formatObservations,
  formatStepLog: () => formatStepLog,
  hasNextStep: () => hasNextStep,
  isCriticalAction: () => isCriticalAction,
  isWritingAction: () => isWritingAction,
  parseActions: () => parseActions,
  runAgentLoop: () => runAgentLoop
});
async function executeGithubAction(userId, action, params) {
  try {
    const username = "stibe881";
    if (action === "list_repos") {
      const response = await fetch(
        `https://api.github.com/users/${username}/repos?per_page=100`,
        {
          headers: { "User-Agent": "Jarvis-AI" }
        }
      );
      if (!response.ok)
        return `Fehler beim Abrufen der Repositories: ${response.status}`;
      const repos = await response.json();
      return JSON.stringify(
        repos.map((r) => ({
          name: r.name,
          description: r.description,
          url: r.html_url,
          language: r.language,
          updated_at: r.updated_at
        }))
      );
    } else if (action === "get_repo") {
      if (!params.repoName) return "repoName fehlt.";
      const response = await fetch(
        `https://api.github.com/repos/${username}/${params.repoName}`,
        {
          headers: { "User-Agent": "Jarvis-AI" }
        }
      );
      if (!response.ok)
        return `Fehler beim Abrufen des Repositories: ${response.status}`;
      const repo = await response.json();
      return JSON.stringify({
        name: repo.name,
        description: repo.description,
        url: repo.html_url,
        language: repo.language,
        created_at: repo.created_at,
        updated_at: repo.updated_at,
        open_issues: repo.open_issues_count,
        forks: repo.forks_count,
        stars: repo.stargazers_count
      });
    }
    return `Unbekannte GitHub Aktion: ${action}`;
  } catch (e) {
    return `GitHub API Fehler: ${e.message}`;
  }
}
function isWritingAction(action) {
  return WRITING_ACTIONS.includes(action);
}
function isCriticalAction(action) {
  return CRITICAL_ACTIONS.includes(action);
}
function describeCritical(tag, action, payload) {
  const val = (k) => payload[k] === void 0 || payload[k] === null ? "" : String(payload[k]);
  switch (action) {
    case "mark_invoice_paid":
      return `Rechnung ${val("id") || val("number") || "(unbekannt)"} als bezahlt markieren`;
    case "create_invoice":
      return `Neue Rechnung f\xFCr Kunde ${val("customer_id") || val("customer") || "(unbekannt)"} erstellen`;
    case "update_quote_status":
      return `Angebotsstatus auf \xAB${val("status")}\xBB \xE4ndern`;
    case "invite_attendee":
      return `${val("email")} zum Termin einladen`;
    case "whatsapp":
      return `WhatsApp an ${val("recipient")}: \xAB${val("message").slice(0, 80)}\xBB`;
    case "delete_event":
      return `Termin ${val("eventId") || val("summary")} l\xF6schen`;
    case "update_ticket_status":
      return `Ticket-Status auf \xAB${val("status")}\xBB \xE4ndern`;
    default:
      return `${tag}/${action}`;
  }
}
function parseActions(response) {
  let text2 = response;
  const actions = [];
  for (const tag of ACTION_TAGS) {
    const rx = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g");
    let m;
    while ((m = rx.exec(response)) !== null) {
      try {
        const payload = JSON.parse(m[1].trim());
        actions.push({ tag, payload });
      } catch {
      }
    }
    if (tag !== "maps_action") {
      text2 = text2.replace(new RegExp(`<${tag}>[\\s\\S]*?</${tag}>`, "g"), "");
    }
  }
  return { text: text2.replace(/\n{3,}/g, "\n\n").trim(), actions };
}
function describe(tag, action, params) {
  const name = params.customer ?? params.search ?? params.title ?? params.query ?? params.recipient ?? "";
  const suffix = name ? `: ${String(name).slice(0, 40)}` : "";
  const map = {
    app_action: "App",
    calendar_action: "Kalender",
    memory_action: "Ged\xE4chtnis",
    spotify_action: "Spotify",
    device_action: "iPhone",
    notes_action: "Notizen",
    tasks_action: "Aufgaben",
    schedule_task: "Hintergrund-Task",
    github_action: "GitHub"
  };
  return `${map[tag] ?? tag} \xB7 ${action}${suffix}`;
}
async function executeNotesAction(userId, action, params) {
  if (action === "list" || action === "search") {
    const search = typeof params.search === "string" ? params.search : void 0;
    const notes2 = await getNotesByUser(userId, search);
    if (notes2.length === 0) return "Keine Notizen gefunden.";
    return notes2.slice(0, 15).map((n) => `- ${n.title}: ${(n.content ?? "").slice(0, 160)}`).join("\n");
  }
  if (action === "create") {
    const title = typeof params.title === "string" ? params.title : "Notiz";
    const content = typeof params.content === "string" ? params.content : "";
    await createNote({ userId, title, content });
    return `Notiz \xAB${title}\xBB wurde gespeichert.`;
  }
  return `Unbekannte Notizen-Aktion: ${action}`;
}
async function executeTasksAction(userId, action, params) {
  if (action === "list") {
    const tasks2 = await getTasksByUser(userId);
    const open = tasks2.filter((t2) => !t2.completed);
    if (open.length === 0) return "Keine offenen Aufgaben.";
    return open.slice(0, 20).map((t2) => {
      const due = t2.dueDate ? ` (f\xE4llig: ${new Date(t2.dueDate).toLocaleDateString("de-CH")})` : "";
      return `- [id:${t2.id}] ${t2.title}${due} \xB7 Priorit\xE4t: ${t2.priority ?? "normal"}`;
    }).join("\n");
  }
  if (action === "create") {
    const title = typeof params.title === "string" ? params.title : "";
    if (!title) return "F\xFCr eine Aufgabe wird ein Titel ben\xF6tigt.";
    const raw = typeof params.priority === "string" ? params.priority : "medium";
    const priority = raw === "low" || raw === "high" ? raw : "medium";
    const parsedDue = typeof params.due_date === "string" ? new Date(params.due_date) : null;
    const dueDate = parsedDue && !Number.isNaN(parsedDue.getTime()) ? parsedDue.getTime() : null;
    await createTask({
      userId,
      title,
      priority,
      description: typeof params.description === "string" ? params.description : null,
      dueDate
    });
    return `Aufgabe \xAB${title}\xBB wurde erstellt.`;
  }
  if (action === "complete") {
    const id = Number(params.id);
    if (!Number.isFinite(id))
      return "F\xFCr das Abschliessen wird eine Aufgaben-ID ben\xF6tigt.";
    await updateTask(id, userId, { completed: true });
    return `Aufgabe ${id} wurde als erledigt markiert.`;
  }
  return `Unbekannte Aufgaben-Aktion: ${action}`;
}
async function executeScheduleTask(userId, params) {
  const { getDb: getDb2 } = await Promise.resolve().then(() => (init_db(), db_exports));
  const db = await getDb2();
  if (!db) return "Fehler: DB nicht verf\xFCgbar";
  const { scheduledTasks: scheduledTasks2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
  const prompt = typeof params.prompt === "string" ? params.prompt : "";
  if (!prompt) return "Fehler: Ein Prompt wird f\xFCr den Task ben\xF6tigt.";
  const cronExpression = typeof params.cronExpression === "string" ? params.cronExpression : null;
  let runAt = null;
  if (typeof params.runAt === "string" && params.runAt.trim()) {
    const d = new Date(params.runAt);
    if (!Number.isNaN(d.getTime())) {
      runAt = d.getTime();
    }
  }
  const isImmediate = !cronExpression && !runAt;
  await db.insert(scheduledTasks2).values({
    userId,
    prompt,
    cronExpression,
    runAt: isImmediate ? /* @__PURE__ */ new Date() : runAt ? new Date(runAt) : null,
    isActive: true
  });
  if (cronExpression) {
    return `Wiederkehrender Task erstellt: \xAB${prompt}\xBB (Cron: ${cronExpression})`;
  } else if (!isImmediate) {
    return `Einmaliger Task erstellt f\xFCr ${new Date(runAt).toLocaleString("de-CH")}: \xAB${prompt}\xBB`;
  } else {
    return `Task erstellt und wird in K\xFCrze ausgef\xFChrt: \xAB${prompt}\xBB`;
  }
}
async function executeAction(ctx, parsed2) {
  const { tag, payload } = parsed2;
  const action = typeof payload.action === "string" ? payload.action : typeof payload.type === "string" ? payload.type : "";
  let label = describe(tag, action, payload);
  try {
    let result;
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
        if (!key || !value) {
          result = "F\xFCr das Ged\xE4chtnis werden Schl\xFCssel und Wert ben\xF6tigt.";
          break;
        }
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
      case "schedule_task": {
        result = await executeScheduleTask(ctx.userId, payload);
        break;
      }
      case "github_action": {
        const { action: _a, ...params } = payload;
        result = await executeGithubAction(ctx.userId, action, params);
        break;
      }
      case "email_action": {
        const msTokens = await getMicrosoftTokens(ctx.userId);
        if (msTokens.length === 0) {
          result = "Kein Microsoft-Konto verkn\xFCpft.";
          break;
        }
        const email = msTokens[0].email;
        if (action === "list_unread") {
          try {
            const data = await msFetch(
              ctx.userId,
              email,
              "/me/mailFolders/inbox/messages?$filter=isRead eq false&$top=10"
            );
            if (!data.value || data.value.length === 0) {
              result = "Keine ungelesenen E-Mails gefunden.";
            } else {
              result = data.value.map(
                (m) => `- Von: ${m.sender?.emailAddress?.name}
  Betreff: ${m.subject}
  Auszug: ${m.bodyPreview}`
              ).join("\n\n");
            }
          } catch (e) {
            result = "Fehler beim Abruf der Mails: " + e.message;
          }
        } else {
          result = "Unbekannte Mail-Aktion";
        }
        break;
      }
      case "web_search": {
        const query = typeof payload.query === "string" ? payload.query : "";
        try {
          const res = await fetch(
            "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query)
          );
          const html = await res.text();
          const results = [];
          const snippetRegex = /<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/g;
          let match;
          while ((match = snippetRegex.exec(html)) !== null && results.length < 5) {
            results.push("- " + match[1].replace(/<\/?[^>]+(>|$)/g, "").trim());
          }
          if (results.length === 0) result = "Keine Suchergebnisse gefunden.";
          else result = results.join("\n");
        } catch (e) {
          result = "Fehler bei der Websuche: " + e.message;
        }
        break;
      }
      case "maps_action": {
        result = `Google Maps Ansicht f\xFCr ${payload.location || "den Ort"} wurde direkt im Chat-Verlauf eingeblendet.`;
        break;
      }
      case "news_action": {
        try {
          const { fetchLatestNews: fetchLatestNews2 } = await Promise.resolve().then(() => (init_news(), news_exports));
          const allNews = await fetchLatestNews2();
          let filteredNews = allNews;
          const sourceFilter = typeof payload.source === "string" ? payload.source.toLowerCase() : null;
          if (sourceFilter && sourceFilter !== "alle") {
            filteredNews = allNews.filter(
              (n) => n.source.toLowerCase().includes(sourceFilter)
            );
            if (filteredNews.length === 0) filteredNews = allNews;
          }
          result = JSON.stringify(filteredNews.slice(0, 5));
        } catch (e) {
          result = `Fehler beim Abrufen der News: ${e.message}`;
        }
        break;
      }
      case "smarthome_action": {
        const smarthomeResult = await executeSmarthomeAction(payload);
        result = JSON.stringify(smarthomeResult, null, 2);
        label = `Smarthome DB: ${payload.operation} auf ${payload.table}`;
        break;
      }
      case "home_assistant_action": {
        const haResult = await executeHomeAssistantAction(payload);
        result = JSON.stringify(haResult, null, 2);
        label = `Home Assistant: ${payload.action}`;
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
function formatObservations(steps) {
  return steps.map((s) => `[Werkzeug ${s.kind}/${s.action}]
${s.result}`).join("\n\n");
}
function hasNextStep(text2) {
  const tail = text2.slice(-320).toLowerCase();
  if (!tail.includes("?")) return false;
  const empty = [
    "kann ich sonst",
    "sonst noch etwas",
    "brauchst du noch",
    "wie kann ich dir"
  ];
  if (empty.some((p) => tail.includes(p))) return false;
  const concrete = [
    "soll ich",
    "m\xF6chtest du, dass ich",
    "darf ich",
    "sollen wir"
  ];
  return concrete.some((p) => tail.includes(p));
}
function ensureNextStep(text2, steps) {
  if (steps.length === 0 || hasNextStep(text2)) return text2;
  const actions = steps.map((s) => s.action);
  let suggestion = "Soll ich daraus eine Aufgabe mit Frist anlegen?";
  if (actions.some((a) => a.includes("overdue"))) {
    suggestion = "Soll ich f\xFCr die \xFCberf\xE4lligen Posten Zahlungserinnerungen vorbereiten?";
  } else if (actions.some((a) => a.includes("invoice"))) {
    suggestion = "Soll ich zu den offenen Rechnungen eine Nachfass-Aufgabe anlegen?";
  } else if (actions.some((a) => a.includes("quote"))) {
    suggestion = "Soll ich beim Kunden zum Angebot nachfassen?";
  } else if (actions.some((a) => a.includes("ticket"))) {
    suggestion = "Soll ich ein Ticket priorisieren oder einen Kommentar hinterlegen?";
  } else if (actions.some((a) => a.includes("event"))) {
    suggestion = "Soll ich einen dieser Termine verschieben oder eine Erinnerung setzen?";
  } else if (actions.some((a) => a.includes("dossier") || a.includes("customer"))) {
    suggestion = "Soll ich f\xFCr diesen Kunden den n\xE4chsten Schritt vorbereiten?";
  }
  return `${text2.trim()}

${suggestion}`;
}
async function runAgentLoop(opts) {
  const maxRounds = opts.maxRounds ?? MAX_AGENT_ROUNDS;
  const steps = [];
  const pending = [];
  const mapsActionsToAppend = [];
  let current = opts.firstResponse;
  let rounds = 0;
  for (let round = 0; round < maxRounds; round++) {
    let text2 = "";
    let actions = [];
    if (typeof current === "string") {
      const parsed2 = parseActions(current);
      text2 = parsed2.text;
      actions = parsed2.actions;
      for (const a of parsed2.actions) {
        if (a.tag === "maps_action") {
          mapsActionsToAppend.push(
            `<maps_action>${JSON.stringify(a.payload)}</maps_action>`
          );
        }
      }
    } else {
      const parsed2 = parseActions(current.text);
      text2 = parsed2.text;
      actions = parsed2.actions;
      for (const a of parsed2.actions) {
        if (a.tag === "maps_action") {
          mapsActionsToAppend.push(
            `<maps_action>${JSON.stringify(a.payload)}</maps_action>`
          );
        }
      }
      if (current.tool_calls) {
        for (const tc of current.tool_calls) {
          try {
            const payload = JSON.parse(tc.function.arguments || "{}");
            actions.push({ tag: tc.function.name, payload });
            if (tc.function.name === "maps_action") {
              mapsActionsToAppend.push(
                `<maps_action>${JSON.stringify(payload)}</maps_action>`
              );
            }
          } catch {
          }
        }
      }
    }
    if (actions.length === 0) {
      current = text2;
      break;
    }
    rounds++;
    const roundSteps = [];
    for (const parsed2 of actions) {
      const actionName = String(
        parsed2.payload.action ?? parsed2.payload.type ?? ""
      );
      if (!opts.approved && isCriticalAction(actionName)) {
        const description = describeCritical(
          parsed2.tag,
          actionName,
          parsed2.payload
        );
        pending.push({
          tag: parsed2.tag,
          action: actionName,
          payload: parsed2.payload,
          description
        });
        roundSteps.push({
          kind: parsed2.tag,
          action: actionName,
          label: `Freigabe n\xF6tig \xB7 ${actionName}`,
          result: `NICHT AUSGEF\xDCHRT \u2013 diese Aktion braucht die ausdr\xFCckliche Freigabe von Stefan: ${description}. Frage ihn in einem Satz, ob du sie ausf\xFChren darfst, und f\xFChre sie erst nach einem klaren Ja aus.`
        });
        continue;
      }
      const step = await opts.runAction(parsed2);
      roundSteps.push(step);
      steps.push(step);
      if (opts.onStep) {
        opts.onStep(step);
      }
    }
    opts.messages.push({
      role: "assistant",
      content: text2 || "(Werkzeuge werden ausgef\xFChrt)"
    });
    opts.messages.push({
      role: "user",
      content: `[Ergebnisse deiner Werkzeuge \u2013 der Nutzer sieht diese Nachricht nicht]

${formatObservations(roundSteps)}

Wenn du f\xFCr die Aufgabe noch Daten brauchst, nutze weitere Aktionsbl\xF6cke. Wenn du alles hast, formuliere jetzt die endg\xFCltige Antwort \u2013 ohne Aktionsbl\xF6cke, mit den konkreten Zahlen und Namen aus den Ergebnissen. Schliesse mit genau einem konkreten Vorschlag f\xFCr den n\xE4chsten Schritt.`
    });
    current = await opts.callModel(opts.messages, opts.onStream);
    if (round === maxRounds - 1) {
      current = typeof current === "string" ? parseActions(current).text : parseActions(current.text).text;
    }
  }
  let finalText = typeof current === "string" ? current.trim() : current.text.trim();
  if (mapsActionsToAppend.length > 0) {
    finalText += `

${mapsActionsToAppend.join("\n")}`;
  }
  finalText = ensureNextStep(finalText, steps);
  if (pending.length > 0 && !hasNextStep(finalText)) {
    const list = pending.map((p) => `\u2022 ${p.description}`).join("\n");
    finalText = `${finalText}

Daf\xFCr brauche ich deine Freigabe:
${list}

Soll ich das ausf\xFChren?`;
  }
  return { text: finalText, steps, rounds, pending };
}
function formatStepLog(steps) {
  if (steps.length === 0) return "";
  const lines = steps.map((s) => s.label);
  return `

${STEP_LOG_MARKER}${lines.join(" | ")}`;
}
var WRITING_ACTIONS, CRITICAL_ACTIONS, ACTION_TAGS, STEP_LOG_MARKER, MAX_AGENT_ROUNDS;
var init_agent = __esm({
  "server/agent.ts"() {
    "use strict";
    init_appIntegration();
    init_spotify();
    init_deviceCommands();
    init_db();
    init_calendar();
    init_smarthome();
    init_homeassistant();
    WRITING_ACTIONS = [
      "create_customer",
      "create_ticket",
      "create_lead",
      "create_project",
      "create_project_task",
      "create_expense",
      "create_quote",
      "create_invoice",
      "update_ticket_status",
      "update_ticket_priority",
      "add_ticket_comment",
      "mark_invoice_paid",
      "update_lead_status",
      "update_quote_status",
      "create_event",
      "update_event",
      "delete_event",
      "invite_attendee",
      "create_note",
      "create_task",
      "complete_task"
    ];
    CRITICAL_ACTIONS = [
      // Geld und Buchhaltung
      "mark_invoice_paid",
      "create_invoice",
      // Nach aussen wirksam
      "update_quote_status",
      "invite_attendee",
      "whatsapp",
      // Löschen und Verwerfen
      "delete_event",
      "update_ticket_status"
    ];
    ACTION_TAGS = [
      "app_action",
      "calendar_action",
      "memory_action",
      "spotify_action",
      "device_action",
      "notes_action",
      "tasks_action",
      "schedule_task",
      "github_action",
      "email_action",
      "web_search",
      "maps_action",
      "news_action",
      "smarthome_action",
      "home_assistant_action"
    ];
    STEP_LOG_MARKER = "\u27E6schritte\u27E7 ";
    MAX_AGENT_ROUNDS = 5;
  }
});

// server/persona.ts
var JARVIS_PERSONA, JARVIS_PERSONA_SHORT;
var init_persona = __esm({
  "server/persona.ts"() {
    "use strict";
    JARVIS_PERSONA = `## Deine Pers\xF6nlichkeit (verbindlich)

Du bist J.A.R.V.I.S., der kultivierte britische Assistent aus Iron Man \u2013 im Dienst von Stefan Gross.

**Tonalit\xE4t:** \xC4usserst h\xF6flich, kultiviert und gesch\xE4ftsm\xE4ssig, dabei von tiefer, fast famili\xE4rer Loyalit\xE4t zu Stefan getragen. Nie unterw\xFCrfig, nie kumpelhaft. Begr\xFCsse Stefan NICHT in jeder Nachricht neu (z.B. nicht jedes Mal "Guten Tag, Sir"), sondern steige im laufenden Chat direkt ins Thema ein.

**Ausdrucksweise:** Gehobenes, pr\xE4zise artikuliertes Vokabular. Britisches Understatement statt Superlative. Ein sehr trockener, subtiler Sarkasmus \u2013 besonders wenn Stefan leichtsinnige, impulsive oder terminlich unm\xF6gliche Dinge vorhat. Der Sarkasmus bleibt stets respektvoll und niemals verletzend.

**Interaktionsstil:** Du sprichst Stefan mit \xABSir\xBB an, wenn es passt \u2013 nicht in jedem Satz, sondern dort, wo es Haltung zeigt. Du analysierst Situationen sofort, lieferst datenbasierte Fakten und beh\xE4ltst den menschlichen Kontext im Blick. Du weist dezent auf Risiken hin, statt zu warnen wie ein Handbuch.

**Typische Formulierungen** (sparsam und abwechslungsreich einsetzen, nicht mechanisch wiederholen):
- \xABSehr wohl, Sir.\xBB
- \xABGuten Tag, Sir.\xBB
- \xABWie Sie w\xFCnschen, Sir.\xBB
- \xABDie Daten zeigen \u2026\xBB / \xABMeinen Aufzeichnungen zufolge \u2026\xBB
- \xABEs w\xE4re vielleicht ratsam, Sir \u2026\xBB
- \xABIch erlaube mir den Hinweis, dass \u2026\xBB
- \xABWenn ich so frei sein darf \u2026\xBB

**Beispiele f\xFCr den richtigen Ton:**
- Statt \xABDu hast heute 7 Termine!\xBB \u2192 \xABSie haben heute sieben Termine, Sir. Ein durchaus ambitionierter Tagesplan.\xBB
- Statt \xABDie Rechnung ist \xFCberf\xE4llig\xBB \u2192 \xABDie Rechnung von Muster AG ist seit 45 Tagen \xFCberf\xE4llig. Ich erlaube mir den Hinweis, dass Geduld eine Tugend ist \u2013 Liquidit\xE4t allerdings auch.\xBB
- Statt \xABFehler, das ging nicht\xBB \u2192 \xABDas ist leider fehlgeschlagen, Sir. Ich vermute, der Dienst teilt meine Auffassung von Zuverl\xE4ssigkeit nicht.\xBB

**Grenzen:** Der Ton \xE4ndert nichts an der Sachlichkeit. Zahlen, Termine, Betr\xE4ge und Namen bleiben exakt. Bei kritischen oder dringenden Sachverhalten tritt der Sarkasmus vollst\xE4ndig zur\xFCck und du wirst n\xFCchtern und klar.`;
    JARVIS_PERSONA_SHORT = `Schreibe als J.A.R.V.I.S. aus Iron Man: kultiviert britisch, h\xF6flich, gehobenes Vokabular, \xABSir\xBB-Anrede wo passend, trockener und subtiler Sarkasmus. Zahlen und Fakten bleiben exakt.`;
  }
});

// server/routers/chatPrompt.ts
var CORE_AGENT_INSTRUCTIONS;
var init_chatPrompt = __esm({
  "server/routers/chatPrompt.ts"() {
    "use strict";
    CORE_AGENT_INSTRUCTIONS = `HANDLUNGSF\xC4HIGKEIT (das Wichtigste \xFCberhaupt):
Du bist kein Textgenerator, sondern ein handelnder Assistent mit echten Werkzeugen. Du arbeitest in Runden:
In jeder Runde darfst du EINEN ODER MEHRERE Aktionsbl\xF6cke einsetzen. Deren Ergebnisse bekommst du anschliessend
als Beobachtung zur\xFCck (der Nutzer sieht diese Zwischenschritte nicht) und darfst dann weitere Werkzeuge nutzen,
bis die Aufgabe wirklich erledigt ist. Du hast bis zu f\xFCnf Runden.

Daraus folgt:
- BESCHAFFE FEHLENDE DATEN SELBST, statt danach zu fragen. Brauchst du eine Kunden-ID f\xFCr eine Rechnung,
  suche den Kunden zuerst mit list_customers und verwende dann die zur\xFCckgegebene ID. Frage nur nach, wenn
  die Information nirgends in deinen Werkzeugen steht (z.B. ein gew\xFCnschter Betrag oder Wunschtermin).
- KETTE SCHRITTE ZUSAMMEN. Beispiel "Schreib eine Mahnung an den Kunden mit der \xE4ltesten \xFCberf\xE4lligen Rechnung":
  Runde 1 list_overdue_invoices, Runde 2 customer_dossier f\xFCr den betroffenen Kunden, Runde 3 die Mahnung
  mit den echten Zahlen schreiben und eine Aufgabe zum Nachfassen anlegen.
- ERLEDIGE DIE GANZE AUFGABE. Wenn Stefan sagt "k\xFCmmere dich darum", f\xFChre die n\xF6tigen Schritte aus statt
  nur zu erkl\xE4ren, was man tun k\xF6nnte.
- ERFINDE NIE Daten. Alle Zahlen, Namen, IDs und Fristen m\xFCssen aus einer Werkzeug-Beobachtung oder aus
  Stefans Nachricht stammen.
- Wenn ein Werkzeug einen Fehler meldet, erkl\xE4re kurz was schiefging und schlage einen Alternativweg vor.

BEST\xC4TIGUNG BEI KRITISCHEN AKTIONEN:
Folgende Aktionen werden NICHT sofort ausgef\xFChrt, sondern erst nach Stefans ausdr\xFCcklicher Zustimmung:
Rechnung als bezahlt markieren, Rechnung erstellen, Angebotsstatus \xE4ndern, Ticket-Status \xE4ndern,
Termin l\xF6schen, jemanden zu einem Termin einladen, WhatsApp-Nachricht senden.
Wenn du so eine Aktion f\xFCr n\xF6tig h\xE4ltst, nutze den Aktionsblock trotzdem \u2013 das System merkt sie vor
und meldet dir "NICHT AUSGEF\xDCHRT". Frage Stefan dann in EINEM Satz konkret nach der Freigabe und nenne
dabei die betroffenen Daten (Rechnungsnummer, Kunde, Betrag, Empf\xE4nger). Sagt er "Ja", wird die Aktion
im n\xE4chsten Zug ausgef\xFChrt. Alles Lesende und harmlos Schreibende (Notizen, Aufgaben, Kommentare,
Kunden/Leads/Projekte anlegen, Musik) f\xFChrst du ohne R\xFCckfrage aus.

PROAKTIVE INTELLIGENZ (was einen echten Assistenten ausmacht):

A) ZUSAMMENH\xC4NGE ERKENNEN: Verkn\xFCpfe Informationen aus verschiedenen Quellen, statt sie nur aufzulisten.
   - Ein Kunde hat eine \xFCberf\xE4llige Rechnung UND ein offenes Ticket? Weise darauf hin, dass man das Ticket
     vielleicht erst nach Zahlungseingang priorisieren sollte.
   - Ein Angebot ist seit \xFCber zwei Wochen "sent" und ohne Reaktion? Schlage vor nachzufassen.
   - Ein Termin \xFCberschneidet sich mit einer f\xE4lligen Aufgabe? Melde den Konflikt aktiv.
   - Ein Projekt ist "active", aber es gibt keine Rechnung dazu? Frage, ob abgerechnet werden soll.

B) N\xC4CHSTER SCHRITT: Beende jede Antwort, die Daten oder Ergebnisse enth\xE4lt, mit genau EINEM konkreten,
   sofort ausf\xFChrbaren Vorschlag \u2013 keine Floskeln wie "Sag mir, wenn du Hilfe brauchst".
   Gute Beispiele: "Soll ich f\xFCr die drei \xFCberf\xE4lligen Rechnungen Mahnungen vorbereiten?",
   "Soll ich eine Aufgabe zum Nachfassen bei Muster AG anlegen (Frist Freitag)?".
   Formuliere den Vorschlag so, dass ein "Ja" von Stefan ausreicht, damit du ihn ausf\xFChren kannst.

C) SELBST\xC4NDIG NACHFASSEN: Erkennst du eine Pendenz, die sonst untergeht (Angebot ohne Antwort,
   Rechnung kurz vor Verfall, Ticket ohne Bearbeitung), lege ungefragt eine Aufgabe mit Frist an
   und erw\xE4hne das in einem Satz. Lieber eine Aufgabe zu viel als eine vergessene Pendenz.

D) BEWERTEN STATT AUFZ\xC4HLEN: Wenn du Listen zeigst, nenne zuerst in einem Satz die Kernaussage
   ("F\xFCnf Rechnungen offen, davon zwei \xFCber 30 Tage \xFCberf\xE4llig \u2013 zusammen CHF 922"), danach die Details.

E) AUTONOMES GED\xC4CHTNIS: Merke dir selbst\xE4ndig wichtige Details aus dem Gespr\xE4ch (z.B. Namen, Vorlieben, Fakten, Projekt-Ideen), auch wenn Stefan nicht explizit darum bittet. Nutze daf\xFCr unaufgefordert den <memory_action>-Block, um dieses Wissen dauerhaft f\xFCr die Zukunft zu speichern. Erw\xE4hne kurz beil\xE4ufig in deiner Antwort, dass du dir das gemerkt hast.

NOTIZEN: Du kannst Notizen durchsuchen und anlegen:
<notes_action>{"action":"list","search":"Passwort"}</notes_action>
<notes_action>{"action":"create","title":"Besprechung Muster AG","content":"Kernpunkte ..."}</notes_action>

AUFGABEN: Du kannst Aufgaben lesen, anlegen und abschliessen:
<tasks_action>{"action":"list"}</tasks_action>
<tasks_action>{"action":"create","title":"Mahnung Muster AG senden","priority":"high","due_date":"2026-08-15"}</tasks_action>
<tasks_action>{"action":"complete","id":42}</tasks_action>
Nutze diese Werkzeuge aktiv: erkennst du im Gespr\xE4ch eine offene Pendenz, lege selbst eine Aufgabe an
und sage Stefan in einem Satz, dass du das getan hast.

KALENDER & PREDICTIVE SCHEDULING: Wenn der Nutzer Kalender-Aktionen m\xF6chte, nutze einen Aktionsblock:
<calendar_action>{"action":"list_events","timeMin":"ISO8601","timeMax":"ISO8601"}</calendar_action>
<calendar_action>{"action":"create_event","summary":"Titel","startDateTime":"2026-08-10T14:00:00","endDateTime":"2026-08-10T15:00:00","description":"","location":""}</calendar_action>
<calendar_action>{"action":"update_event","eventId":"ID","summary":"neuer Titel"}</calendar_action>
<calendar_action>{"action":"delete_event","eventId":"ID"}</calendar_action>
<calendar_action>{"action":"invite_attendee","eventId":"ID","email":"person@example.com"}</calendar_action>
<calendar_action>{"action":"get_event","keyword":"Suchbegriff"}</calendar_action>
WICHTIG (Predictive Scheduling): Ber\xFCcksichtige IMMER Stefans Arbeitsrhythmus (z.B. Feierabend um 15:30 an bestimmten Tagen, Pausenzeiten), wenn du Termine vorschl\xE4gst. Suche diese Vorlieben im Ged\xE4chtnis (memory_action). Schlage keine Termine au\xDFerhalb seiner \xFCblichen Arbeitszeiten vor!
WICHTIG: Zeige dem Nutzer NIE den rohen Aktionsblock.

GITHUB: Wenn Stefan nach seinen Repositories (Code-Projekten) fragt, nutze das GitHub-Werkzeug:
<github_action>{"action":"list_repos"}</github_action>
<github_action>{"action":"get_repo","repoName":"Jarvis"}</github_action>
Zeige auch hier NIE den rohen Block, sondern pr\xE4sentiere die Antwort in nat\xFCrlicher Sprache.

GED\xC4CHTNIS: Wenn der Nutzer wichtige Informationen mitteilt, speichere sie:
<memory_action>{"category":"person","key":"Bine E-Mail","value":"bine@example.com"}</memory_action>
Kategorien: person, contact, preference, project, fact, address.
WICHTIG: Wenn der Nutzer dir eine Adresse (z.B. Wohnort, B\xFCro, Firma) nennt, speichere diese SOFORT und unaufgefordert unter der Kategorie 'address' ab!
WICHTIG zur Ausgabe: Verwende in deinen Antworten NIE interne Markierungen in eckigen Klammern wie [person], [context], [preference], [project], [fact] oder [address]. Das sind technische Kategorien aus dem gespeicherten Wissen und d\xFCrfen im Antworttext nicht auftauchen. Formuliere den Inhalt in nat\xFCrlicher Sprache.
Kategorien-Hinweis Ende. Zeige dem Nutzer NIE den rohen memory_action-Block.

E-MAIL: Du kannst ungelesene E-Mails abrufen oder Mails durchsuchen:
<email_action>{"action":"list_unread"}</email_action>
Nutze dies proaktiv, um \xFCberf\xE4llige Kundenanfragen zu erkennen, Angebote nachzufassen oder wichtige Anh\xE4nge in Notizen zu sichern. Erstelle bei Bedarf selbst\xE4ndig Tasks daf\xFCr.

WEB-SUCHE & KONKURRENZ: Du kannst das Internet durchsuchen, um z.B. Konkurrenz-Monitoring durchzuf\xFChren (Preise und Angebote anderer IT-Dienstleister in der Zentralschweiz):
<web_search>{"query":"IT Dienstleister Zentralschweiz Preise"}</web_search>

MAPS: Du kannst Google Maps Karten direkt f\xFCr den Nutzer einblenden:
<maps_action>{"location":"Zell LU","mode":"place"}</maps_action>
Nutze dies, wenn der Nutzer nach Standorten, Verkehr oder Routen fragt. Die Karte erscheint dann direkt hier im Chat als interaktives Widget.

APP (Gross ICT ERP/CRM): Stefan hat eine eigene App mit Kunden, Angeboten, Rechnungen, Tickets, Projekten, Leads, Vertr\xE4gen, Ausgaben und Produkten.
Wenn Stefan etwas aus seiner App m\xF6chte, nutze app_action-Bl\xF6cke. Du darfst mehrere pro Runde einsetzen,
wenn du unabh\xE4ngige Informationen brauchst (z.B. Dashboard und \xFCberf\xE4llige Rechnungen gleichzeitig).
Verf\xFCgbare Aktionen (Beispiele):

LESEN:
<app_action>{"action":"dashboard"}</app_action>
<app_action>{"action":"list_customers","search":"Muster"}</app_action>
<app_action>{"action":"list_tickets","status":"open"}</app_action>
<app_action>{"action":"list_quotes","status":"draft"}</app_action>
<app_action>{"action":"list_invoices","status":"open"}</app_action>  // offen = open + sent
<app_action>{"action":"list_overdue_invoices"}</app_action>
<app_action>{"action":"list_projects","status":"active"}</app_action>
<app_action>{"action":"list_leads"}</app_action>
<app_action>{"action":"list_contracts"}</app_action>
<app_action>{"action":"list_expenses"}</app_action>
<app_action>{"action":"list_products"}</app_action>
<app_action>{"action":"list_project_tasks","project_id":"uuid-hier"}</app_action>
<app_action>{"action":"customer_dossier","customer":"Muster AG"}</app_action>

KUNDEN-DOSSIER: Wenn Stefan eine Gesamtuebersicht zu einem Kunden moechte (z.B. "Erzaehl mir alles ueber Muster AG",
"Wie steht es mit Kunde X", "Lagebeurteilung Muster AG"), nutze customer_dossier. Das liefert Stammdaten,
offene Rechnungen mit Betraegen, ueberfaellige Posten, Angebote, Tickets, Projekte und Vertraege in einem Block.
Fasse danach in zwei bis drei Saetzen zusammen, was auffaellt und was du als naechsten Schritt empfiehlst.

ERSTELLEN:
<app_action>{"action":"create_customer","company_name":"Muster AG","email":"info@muster.ch","phone":"+41 41 xxx"}</app_action>
<app_action>{"action":"create_ticket","customer_id":"uuid","title":"Problem mit Drucker","description":"Drucker druckt nicht","priority":"medium", "assigned_to":"stefan"}</app_action>
<app_action>{"action":"create_lead","name":"Max Muster","company":"Muster AG","email":"max@muster.ch","value":5000}</app_action>
<app_action>{"action":"create_project","title":"Webseite Muster AG","customer_id":"uuid","budget":3500}</app_action>
<app_action>{"action":"create_project_task","project_id":"uuid","title":"Design erstellen","priority":"high"}</app_action>
<app_action>{"action":"create_expense","description":"B\xFCromaterial","amount":45.80,"category":"B\xFCro","supplier":"Migros"}</app_action>
<app_action>{"action":"create_quote","customer_id":"uuid","notes":"Angebot Webseite","items":[{"description":"Webseite Design","quantity":1,"unit_price":1500},{"description":"Hosting Setup","quantity":1,"unit_price":200}]}</app_action>
<app_action>{"action":"create_invoice","customer_id":"uuid","items":[{"description":"IT-Support Mai","quantity":5,"unit_price":120,"unit":"Std."}]}</app_action>

\xC4NDERN:
<app_action>{"action":"update_ticket_status","id":"uuid","status":"closed"}</app_action>
<app_action>{"action":"assign_ticket","id":"uuid","user_name":"stefan","customer_name":"Muster AG"}</app_action>
<app_action>{"action":"update_ticket_priority","id":"uuid","priority":"high"}</app_action>
<app_action>{"action":"add_ticket_comment","ticket_id":"uuid","comment":"Problem wurde behoben","is_internal":false}</app_action>
<app_action>{"action":"mark_invoice_paid","id":"uuid"}</app_action>
<app_action>{"action":"update_lead_status","id":"uuid","status":"qualified"}</app_action>
<app_action>{"action":"update_quote_status","id":"uuid","status":"sent"}</app_action>

WICHTIG: Zeige dem Nutzer NIE den rohen app_action-Block. F\xFChre die Aktion aus und zeige das Ergebnis nat\xFCrlich in der Antwort.
KRITISCHE REGEL: Du MUSST f\xFCr JEDE Aktion ZWINGEND die XML-Tags <app_action>...</app_action> verwenden. Wenn du nur JSON wie {"action":"..."} schreibst, WIRD ES IGNORIERT und schl\xE4gt fehl!
STATUS-WERTE in der App:
- Rechnungen: open (offen), sent (gesendet), paid (bezahlt), draft (Entwurf)
- Offene/unbezahlte Rechnungen = status "open" (der Filter deckt open+sent ab)
- Tickets: open, in_progress, resolved, closed
- Angebote: draft, sent, accepted, rejected
- Projekte: active, completed, on_hold, cancelled
- Leads: new, contacted, qualified, proposal, won, lost
Wenn du eine ID brauchst, hole sie SELBST: erst list_customers / list_tickets / list_projects aufrufen,
dann die zur\xFCckgegebene ID in der n\xE4chsten Runde verwenden. Frage Stefan nicht nach technischen IDs.

SMARTHOME PRO: Stefan hat die "Smarthome Pro" Supabase Datenbank angebunden. Du kannst darauf via smarthome_action zugreifen.
Beispiele f\xFCr Aktionen:
<smarthome_action>{"table":"family_routines","operation":"select"}</smarthome_action>
<smarthome_action>{"table":"packing_lists","operation":"insert","body":{"title":"Urlaub","household_id":"uuid"}}</smarthome_action>
<smarthome_action>{"table":"household_cameras","operation":"update","match":{"id":"uuid"},"body":{"is_active":true}}</smarthome_action>
Da du das genaue Datenmodell nicht auswendig kennst, kannst du jederzeit mit operation: "select" auf eine Tabelle zugreifen, um ihre Spalten und Werte zu untersuchen, bevor du \xC4nderungen vornimmst.

HOME ASSISTANT (Smarthome Pro): Stefan hat sein echtes Smarthome (Home Assistant) angebunden. Du kannst ALLE Ger\xE4te aus der Smarthome Pro App steuern.
WICHTIG: Nutze IMMER \`home_assistant_action\` f\xFCr Ger\xE4te! Erstelle daf\xFCr NIEMALS eine Aufgabe!
Unterst\xFCtzte Domains und Aktionen:
- **Licht** (light): \`turn_on\` (optional mit \`brightness\`), \`turn_off\` (WICHTIG: KEINE \`brightness\` bei turn_off!), \`toggle\`
- **Rolll\xE4den / Storen** (cover): \`open_cover\`, \`close_cover\`, \`set_cover_position\`. WICHTIG: F\xFCr spezielle Storen-Positionen (Essbereich, K\xFCche Balkon, K\xFCche/K\xFCchenfenster, Wohnzimmer/Sofa, Spielpl\xE4tzchen, Terrasse) rufe \`press\` auf den zugeh\xF6rigen Button auf, z.B. \`button.evb_sofa_my_position\`.
- **Staubsauger** (vacuum.robi): \`start\`, \`pause\`, \`return_to_base\`, oder \`send_command\` mit \`{"command":"app_segment_clean","params":[roomId]}\`.
- **Media Player** (media_player.fernseher_im_wohnzimmer_2, media_player.hub_lina): \`play_media\`, \`media_play_pause\`, \`media_stop\`.
- **Spotify via Cast** (spotcast): \`start\` mit \`{"uri":"spotify:playlist:...", "device_name":"Lina Speaker"}\`.
Beispiele:
<home_assistant_action>{"action":"call_service","domain":"light","service":"turn_on","serviceData":{"entity_id":"light.wohnzimmer"}}</home_assistant_action>
<home_assistant_action>{"action":"call_service","domain":"cover","service":"set_cover_position","serviceData":{"entity_id":"cover.wohnzimmer","position":50}}</home_assistant_action>
<home_assistant_action>{"action":"call_service","domain":"button","service":"press","serviceData":{"entity_id":"button.evb_sofa_my_position"}}</home_assistant_action>
<home_assistant_action>{"action":"get_states"}</home_assistant_action> (Gibt dir blitzschnell alle relevanten Ger\xE4te zur\xFCck)
WICHTIG F\xDCR DIE GESCHWINDIGKEIT: Nutze \`get_states\` NUR im absoluten Notfall! Versuche IMMER sofort \`call_service\` im ersten Schritt zu nutzen (z.B. \`light.buero\`, \`light.wohnzimmer\`). Behalte deinen normalen, h\xF6flichen Stil bei, aber verzichte auf \xFCberfl\xFCssige Romane.

KARTEN & GPS:
Wenn du eine Karte \xFCber \`<maps_action>\` anzeigst, LIES NIEMALS DIE L\xC4NGEN- ODER BREITENGRADE VOR! Beschreibe den Ort nur kurz ("Die Karte zu [Ort] wurde eingeblendet").

ALLGEMEINE KRITISCHE REGELN F\xDCR AKTIONEN:
1. Du MUSST f\xFCr JEDE Aktion ZWINGEND die korrekten XML-Tags (z.B. <app_action>...</app_action> oder <home_assistant_action>...</home_assistant_action>) verwenden.
2. Das Format \`[app_action: ...]\` oder reines JSON OHNE XML-Tags ist FALSCH und wird vom System ignoriert.
3. Du kannst Aktionen NICHT in Gedanken simulieren. Wenn du eine Aktion ausf\xFChrst, musst du das XML-Tag ausgeben. Das System antwortet dir dann in einer neuen Nachricht mit dem Ergebnis.
4. ERFINDE NIEMALS das Ergebnis einer Aktion (z.B. "Ich habe das Skript ausgef\xFChrt", ohne wirklich das Tag generiert zu haben).`;
  }
});

// server/pendingApproval.ts
function rememberPending(conversationId, actions) {
  if (actions.length === 0) return;
  store.set(conversationId, { actions, createdAt: Date.now() });
}
function takePending(conversationId) {
  const entry = store.get(conversationId);
  if (!entry) return [];
  store.delete(conversationId);
  if (Date.now() - entry.createdAt > TTL_MS) return [];
  return entry.actions;
}
function hasPending(conversationId) {
  const entry = store.get(conversationId);
  if (!entry) return false;
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(conversationId);
    return false;
  }
  return true;
}
function clearPending(conversationId) {
  store.delete(conversationId);
}
function isRejection(message) {
  const t2 = message.toLowerCase().trim().replace(/[!.,;:?]+$/g, "");
  if (!t2 || t2.length > 60) return false;
  return NO.some(
    (n) => t2 === n || t2.startsWith(n + " ") || t2.startsWith(n + ",")
  );
}
function isApproval(message) {
  const t2 = message.toLowerCase().trim().replace(/[!.,;:?]+$/g, "");
  if (!t2) return false;
  if (t2.length > 60) return false;
  if (NO.some((n) => t2 === n || t2.startsWith(n + " "))) return false;
  return YES.some(
    (y) => t2 === y || t2.startsWith(y + " ") || t2.startsWith(y + ",")
  );
}
var store, TTL_MS, YES, NO;
var init_pendingApproval = __esm({
  "server/pendingApproval.ts"() {
    "use strict";
    store = /* @__PURE__ */ new Map();
    TTL_MS = 5 * 60 * 1e3;
    YES = [
      "ja",
      "jawohl",
      "jo",
      "j\xE4",
      "genau",
      "bitte",
      "mach",
      "machs",
      "mach das",
      "mach es",
      "ausf\xFChren",
      "f\xFChre aus",
      "los",
      "okay",
      "ok",
      "einverstanden",
      "passt",
      "gerne",
      "best\xE4tigt",
      "best\xE4tige",
      "freigegeben",
      "gib frei",
      "erledige",
      "tu das",
      "ja bitte"
    ];
    NO = [
      "nein",
      "nicht",
      "stopp",
      "stop",
      "abbrechen",
      "lass",
      "doch nicht",
      "warte",
      "n\xF6",
      "nei"
    ];
  }
});

// server/routers/chat.ts
import { TRPCError as TRPCError5 } from "@trpc/server";
import { z as z6 } from "zod";
function detectIntent(message) {
  for (const rule of INTENT_RULES) {
    if (rule.test.test(message))
      return { intent: rule.intent, label: rule.label };
  }
  return null;
}
async function buildChatSystemPrompt(userId, query) {
  const profile = await getUserProfile(userId);
  let memoryContext = "";
  const memories2 = await getMemoriesByUser(userId);
  if (memories2.length > 0) {
    const memLines = memories2.slice(0, 5).map((m) => `- ${m.key}: ${m.value}`);
    memoryContext = `

ERINNERUNGEN:
${memLines.join("\n")}`;
  }
  let approvalContext = "";
  if (hasPending(userId)) {
    approvalContext = `

WICHTIG: Es gibt aktuell offene Aktionen, die auf Freigabe warten. Diese Aktionen darfst du erst ausf\xFChren, wenn der Nutzer ausdr\xFCcklich "Ja" oder "Einverstanden" sagt.`;
  }
  const calendarContext = `

KALENDER: Du kannst Termine lesen und schreiben.
- Um Termine zu lesen: <calendar_action>{"action":"list_events","days":7}</calendar_action>
- Um einen Termin zu erstellen: <calendar_action>{"action":"create_event","summary":"Titel","start_time":"2024-05-20T10:00:00Z","end_time":"2024-05-20T11:00:00Z"}</calendar_action>
- Um Termine zu aktualisieren/l\xF6schen, nutze update_event / delete_event mit eventId.`;
  if (profile) {
    const addressStr = profile.location ? `Wohnhaft in ${profile.location}` : "Keine Adresse hinterlegt";
    const personalityStr = profile.interests ? `
Deine Interessen: ${profile.interests}` : "";
    const langStr = profile.language === "en" ? "Answer in English." : profile.language === "auto" ? "Antworte auf Schweizerdeutsch oder Deutsch, je nach Kontext." : "Antworte auf Deutsch.";
    const jarvisName = profile.jarvisName || "Jarvis";
    const intelligenceContext = `
ARBEITSWEISE (sehr wichtig):
1. NACHFRAGEN BEI UNKLARHEIT: Wenn eine Anfrage nicht genug Informationen enth\xE4lt, um sie korrekt auszuf\xFChren, stelle GEZIELTE R\xFCckfragen anstatt zu raten oder eine leere Antwort zu geben.
2. ZEITGEF\xDCHL: Vergleiche geplante oder berechnete Zeiten (f\xFCr Termine, Erinnerungen, Aufgaben oder allgemeine Aussagen) IMMER logisch mit der aktuellen Uhrzeit. Vermeide "Zeitreisen": Schlage nichts f\xFCr heute vor, was bereits in der Vergangenheit liegt (z. B. 21:00 Uhr vorschlagen, wenn es schon 22:58 Uhr ist).
3. GED\xC4CHTNIS (WICHTIG): Wenn der Nutzer dir in einer Nachricht wichtige Fakten \xFCber sich, seine Vorlieben, seine Familie oder sein Umfeld mitteilt, VERWENDE ZWINGEND die Funktion "memory_action", um diese Informationen sofort abzuspeichern! Tue dies automatisch ohne nachzufragen.
4. MUSTERERKENNUNG & LERNF\xC4HIGKEIT (PROAKTIV): Analysiere aktiv, wie der Nutzer Dinge formuliert, welche Aufgaben er priorisiert und ob sich Anfragen wiederholen (z. B. "Kunde X fragt alle 3 Monate an"). Speichere solche Muster sofort als "preference" oder "fact" \xFCber die "memory_action" ab, damit du in Zukunft proaktiv handeln kannst. Denke aktiv mit!`;
    const grossIctContext = `
GROSS ICT ASSISTENT: Stefan betreibt im Nebenerwerb die Firma Gross ICT (gross-ict.ch) in Zell, Luzern.
Leistungen: Webseiten (ab CHF 1'500), Web-Apps (ab CHF 15'000), Mobile Apps (ab CHF 20'000), IT-Support, Netzwerk, Security, Server \u2013 f\xFCr KMU in der Zentralschweiz.
Wenn Stefan Hilfe zu Gross ICT braucht (Angebote, Texte, Kundenprojekte), kannst du helfen. Verwende immer CHF (nicht \u20AC) und Schweizer Schreibweise (ss statt \xDF).`;
    const now2 = /* @__PURE__ */ new Date();
    const isoDate2 = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Zurich",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(now2);
    const dateStr2 = now2.toLocaleDateString("de-DE", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Europe/Zurich"
    });
    const timeStr2 = now2.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Zurich"
    });
    return `Du bist ${jarvisName}, der pers\xF6nliche Assistent von Stefan Gross. ${addressStr}.
${langStr}

${JARVIS_PERSONA}

Du kannst Dateien analysieren, Web-Suchergebnisse verarbeiten, Notizen, Aufgaben und den Google Kalender verwalten. Du hast ein dauerhaftes Ged\xE4chtnis.${personalityStr}
Heute ist der ${dateStr2}, es ist ${timeStr2} Uhr (ISO: ${isoDate2}).

ALTERSBERECHNUNG (strikt einhalten): Wenn du das Alter einer Person berechnest oder \xFCber Geburtstage sprichst:
1. Rohes Alter = heutiges Jahr \u2212 Geburtsjahr.
2. Hat der Geburtstag (Monat + Tag) dieses Jahr noch NICHT stattgefunden \u2192 Alter = Rohes Alter \u2212 1, Geburtstag steht noch bevor.
3. Hat der Geburtstag dieses Jahr bereits stattgefunden \u2192 Alter = Rohes Alter, Geburtstag war bereits.
4. Kalendereintr\xE4ge rund um einen Geburtstag sind NICHT zwingend veraltet \u2013 pr\xFCfe das Datum, bevor du einen Eintrag als \xABveraltet\xBB bezeichnest.
${grossIctContext}
${intelligenceContext}
${CORE_AGENT_INSTRUCTIONS}
MUSIK (Spotify): F\xFCge bei Musikw\xFCnschen GENAU EINEN spotify_action-Block ein:
<spotify_action>{"action":"play","query":"Coldplay Yellow","type":"track"}</spotify_action>
<spotify_action>{"action":"pause"}</spotify_action> / {"action":"next"} / {"action":"previous"}
<spotify_action>{"action":"volume","level":40}</spotify_action>
<spotify_action>{"action":"current"}</spotify_action> / {"action":"playlists"} / {"action":"devices"}
type kann track, album, playlist oder artist sein. Zeige NIE den rohen Block.

IPHONE (Kurzbefehle): F\xFCr WhatsApp-Nachrichten, Wecker und Timer GENAU EINEN device_action-Block:
<device_action>{"type":"whatsapp","recipient":"Bine","message":"Ich komme sp\xE4ter"}</device_action>
<device_action>{"type":"alarm","time":"06:30","label":"Aufstehen"}</device_action>
<device_action>{"type":"timer","minutes":15}</device_action>
Fehlen Angaben, frage zuerst nach. Zeige NIE den rohen Block.
${calendarContext}${memoryContext}${approvalContext}`;
  }
  const now = /* @__PURE__ */ new Date();
  const isoDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
  const dateStr = now.toLocaleDateString("de-DE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Europe/Zurich"
  });
  const timeStr = now.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Zurich"
  });
  return `Du bist Jarvis, der pers\xF6nliche Assistent von Stefan Gross. Du antwortest immer auf Deutsch.

${JARVIS_PERSONA}

Du kannst Dateien analysieren, Web-Suchergebnisse verarbeiten, Notizen, Aufgaben und den Google Kalender verwalten. Du hast ein dauerhaftes Ged\xE4chtnis.
Heute ist der ${dateStr}, es ist ${timeStr} Uhr (ISO: ${isoDate}).

ALTERSBERECHNUNG (strikt einhalten): Wenn du das Alter einer Person berechnest oder \xFCber Geburtstage sprichst:
1. Rohes Alter = heutiges Jahr \u2212 Geburtsjahr.
2. Hat der Geburtstag (Monat + Tag) dieses Jahr noch NICHT stattgefunden \u2192 Alter = Rohes Alter \u2212 1, Geburtstag steht noch bevor.
3. Hat der Geburtstag dieses Jahr bereits stattgefunden \u2192 Alter = Rohes Alter, Geburtstag war bereits.
4. Kalendereintr\xE4ge rund um einen Geburtstag sind NICHT zwingend veraltet \u2013 pr\xFCfe das Datum, bevor du einen Eintrag als \xABveraltet\xBB bezeichnest.

${CORE_AGENT_INSTRUCTIONS}

MUSIK (Spotify): F\xFCge bei Musikw\xFCnschen GENAU EINEN spotify_action-Block ein:
<spotify_action>{"action":"play","query":"Coldplay Yellow","type":"track"}</spotify_action>
<spotify_action>{"action":"pause"}</spotify_action> / {"action":"next"} / {"action":"previous"}
<spotify_action>{"action":"volume","level":40}</spotify_action>
<spotify_action>{"action":"current"}</spotify_action> / {"action":"playlists"} / {"action":"devices"}
type kann track, album, playlist oder artist sein. Zeige NIE den rohen Block.

IPHONE (Kurzbefehle): F\xFCr WhatsApp-Nachrichten, Wecker und Timer GENAU EINEN device_action-Block:
<device_action>{"type":"whatsapp","recipient":"Bine","message":"Ich komme sp\xE4ter"}</device_action>
<device_action>{"type":"alarm","time":"06:30","label":"Aufstehen"}</device_action>
<device_action>{"type":"timer","minutes":15}</device_action>
Fehlen Angaben, frage zuerst nach. Zeige NIE den rohen Block.
${calendarContext}${memoryContext}${approvalContext}`;
}
var INTENT_RULES, chatRouter;
var init_chat = __esm({
  "server/routers/chat.ts"() {
    "use strict";
    init_calendarAI();
    init_db();
    init_trpc();
    init_storage();
    init_llm();
    init_voiceTranscription();
    init_env();
    init_db();
    init_cleanResponse();
    init_agent();
    init_persona();
    init_chatPrompt();
    init_http();
    init_pendingApproval();
    INTENT_RULES = [
      {
        intent: "offene_rechnungen",
        label: "Offene Rechnungen zeigen",
        test: /(offen|unbezahlt|ausstehend).{0,20}rechnung|rechnung.{0,20}(offen|unbezahlt)/i
      },
      {
        intent: "ueberfaellige_rechnungen",
        label: "\xDCberf\xE4llige Rechnungen zeigen",
        test: /überfällig|mahnung|verzug/i
      },
      {
        intent: "tagesplanung",
        label: "Was steht heute an?",
        test: /(was steht|wie sieht).{0,20}(heute|tag)|tagesplan|prioritäten|was soll ich (zuerst|heute)/i
      },
      {
        intent: "termine_heute",
        label: "Termine heute",
        test: /termin.{0,20}(heute|morgen)|(heute|morgen).{0,20}termin|kalender.{0,15}(heute|morgen)/i
      },
      { intent: "offene_tickets", label: "Offene Tickets zeigen", test: /ticket/i },
      {
        intent: "kunden_suche",
        label: "Kunde suchen",
        test: /kunde|kundin|kunden/i
      },
      {
        intent: "angebot_erstellen",
        label: "Angebot erstellen",
        test: /angebot.{0,20}(erstell|schreib|mach)|erstell.{0,15}angebot/i
      },
      {
        intent: "aufgaben_offen",
        label: "Offene Aufgaben zeigen",
        test: /aufgabe|pendenz|todo|to-do/i
      },
      { intent: "wetter", label: "Wetter in Baar", test: /wetter/i },
      {
        intent: "email_entwurf",
        label: "E-Mail entwerfen",
        test: /(e-?mail|mail).{0,25}(schreib|entwurf|formulier)|schreib.{0,15}(e-?mail|mail)/i
      },
      {
        intent: "dashboard",
        label: "App-\xDCbersicht zeigen",
        test: /dashboard|übersicht|umsatz|kennzahl/i
      },
      { intent: "projekte", label: "Projekte zeigen", test: /projekt/i }
    ];
    chatRouter = router({
      listConversations: protectedProcedure.query(async ({ ctx }) => {
        return getConversationsByUser(ctx.user.id);
      }),
      // Lernende Quick-Action-Vorschläge auf Basis der Nutzungshäufigkeit
      suggestions: protectedProcedure.query(async ({ ctx }) => {
        const top = await getTopPrompts(ctx.user.id, 4);
        const fallback = [
          {
            label: "Was steht heute an?",
            promptText: "Was steht heute an? Erstelle mir eine priorisierte Tagesplanung."
          },
          {
            label: "Offene Rechnungen zeigen",
            promptText: "Zeige mir alle offenen Rechnungen."
          },
          {
            label: "Offene Tickets zeigen",
            promptText: "Welche Tickets sind noch offen?"
          },
          {
            label: "Termine diese Woche",
            promptText: "Welche Termine habe ich diese Woche?"
          }
        ];
        if (top.length === 0) return fallback;
        const mapped = top.map((t2) => ({ label: t2.label, promptText: t2.promptText }));
        for (const f of fallback) {
          if (mapped.length >= 4) break;
          if (!mapped.some((m) => m.label === f.label)) mapped.push(f);
        }
        return mapped.slice(0, 4);
      }),
      createConversation: protectedProcedure.input(z6.object({ title: z6.string().optional() })).mutation(async ({ ctx, input }) => {
        return createConversation({
          userId: ctx.user.id,
          title: input.title ?? "Neues Gespr\xE4ch"
        });
      }),
      deleteConversation: protectedProcedure.input(z6.object({ id: z6.number() })).mutation(async ({ ctx, input }) => {
        const conv = await getConversationById(input.id);
        if (!conv || conv.userId !== ctx.user.id)
          throw new TRPCError5({ code: "FORBIDDEN" });
        await deleteConversation(input.id);
        return { success: true };
      }),
      deleteConversations: protectedProcedure.input(z6.object({ ids: z6.array(z6.number()) })).mutation(async ({ ctx, input }) => {
        for (const id of input.ids) {
          const conv = await getConversationById(id);
          if (conv && conv.userId !== ctx.user.id) {
            throw new TRPCError5({ code: "FORBIDDEN" });
          }
        }
        await deleteConversations(input.ids);
        return { success: true };
      }),
      // ─── Groups ────────────────────────────────────────────────────────────────
      listGroups: protectedProcedure.query(async ({ ctx }) => {
        return getConversationGroupsByUser(ctx.user.id);
      }),
      createGroup: protectedProcedure.input(z6.object({ name: z6.string().min(1) })).mutation(async ({ ctx, input }) => {
        const id = await createConversationGroup({
          userId: ctx.user.id,
          name: input.name
        });
        return { id };
      }),
      deleteGroup: protectedProcedure.input(z6.object({ id: z6.number() })).mutation(async ({ ctx, input }) => {
        await deleteConversationGroup(input.id);
        return { success: true };
      }),
      moveToGroup: protectedProcedure.input(
        z6.object({
          conversationIds: z6.array(z6.number()),
          groupId: z6.number().nullable()
        })
      ).mutation(async ({ ctx, input }) => {
        for (const id of input.conversationIds) {
          const conv = await getConversationById(id);
          if (conv && conv.userId !== ctx.user.id) {
            throw new TRPCError5({ code: "FORBIDDEN" });
          }
        }
        await moveConversationsToGroup(input.conversationIds, input.groupId);
        return { success: true };
      }),
      // ─── Morning Briefing ──────────────────────────────────────────────────────
      generateMorningBriefing: protectedProcedure.query(async ({ ctx }) => {
        const todayStart = /* @__PURE__ */ new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = /* @__PURE__ */ new Date();
        todayEnd.setHours(23, 59, 59, 999);
        let calendarContext = "";
        try {
          const upcoming = await executeCalendarAction(ctx.user.id, "list_events", {
            timeMin: todayStart.toISOString(),
            timeMax: todayEnd.toISOString()
          });
          calendarContext = upcoming && Array.isArray(upcoming) && upcoming.length > 0 ? `Heutige Termine:
${upcoming.map(
            (e) => `- ${e.summary} (${e.start?.dateTime || e.start?.date || "?"})`
          ).join("\n")}` : "Keine Termine f\xFCr heute.";
        } catch (e) {
          calendarContext = "Kalender konnte nicht abgerufen werden.";
        }
        const tasks2 = await getTasksByUser(ctx.user.id);
        const pendingTasks = tasks2.filter((t2) => !t2.completed);
        const tasksContext = pendingTasks.length > 0 ? `Offene Aufgaben:
${pendingTasks.map((t2) => `- [${t2.priority}] ${t2.title}`).join("\n")}` : "Keine offenen Aufgaben.";
        const systemPrompt = `Du bist Jarvis, der pers\xF6nliche Assistent von Stefan Gross.
Es ist fr\xFCh am Tag. Deine Aufgabe ist es, ein kurzes, pr\xE4gnantes "Morning Briefing" (Tagesplanung) zu generieren.
Analysiere die heutigen Termine und offenen Aufgaben und schreibe einen kurzen, motivierenden Text (max. 3-4 S\xE4tze oder Bulletpoints).
Heb besonders wichtige Aufgaben (high priority) oder nahende Termine hervor.
Antworte auf Deutsch.`;
        const llmMessages = [
          { role: "system", content: systemPrompt },
          { role: "user", content: `${calendarContext}

${tasksContext}` }
        ];
        try {
          const llmResp = await invokeLLM({
            model: "claude-sonnet-4-5",
            max_tokens: 500,
            messages: llmMessages
          });
          return {
            briefing: llmResp.choices[0]?.message?.content || "Konnte kein Briefing generieren."
          };
        } catch (e) {
          console.error("Error generating morning briefing:", e);
          return { briefing: "Fehler beim Generieren der Tagesplanung." };
        }
      }),
      getMessages: protectedProcedure.input(z6.object({ conversationId: z6.number() })).query(async ({ ctx, input }) => {
        const conv = await getConversationById(input.conversationId);
        if (!conv || conv.userId !== ctx.user.id)
          throw new TRPCError5({ code: "FORBIDDEN" });
        return getMessagesByConversation(input.conversationId);
      }),
      uploadFile: protectedProcedure.input(
        z6.object({
          fileName: z6.string(),
          fileBase64: z6.string(),
          mimeType: z6.string()
        })
      ).mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.fileBase64, "base64");
        const key = `jarvis/${ctx.user.id}/files/${Date.now()}-${input.fileName}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        return { url, key, fileName: input.fileName, mimeType: input.mimeType };
      }),
      transcribeAudio: protectedProcedure.input(
        z6.object({ audioBase64: z6.string(), mimeType: z6.string().optional() })
      ).mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.audioBase64, "base64");
        const key = `jarvis/${ctx.user.id}/audio/${Date.now()}.webm`;
        const { url } = await storagePut(
          key,
          buffer,
          input.mimeType ?? "audio/webm"
        );
        const baseUrl = ENV.forgeApiUrl?.replace("/v1", "") ?? "";
        const fullUrl = `${baseUrl}${url}`;
        const result = await transcribeAudio({
          audioUrl: fullUrl,
          language: "de"
        });
        if ("error" in result)
          throw new TRPCError5({
            code: "INTERNAL_SERVER_ERROR",
            message: result.error
          });
        return { text: result.text };
      }),
      webSearch: protectedProcedure.input(z6.object({ query: z6.string() })).mutation(async ({ input }) => {
        try {
          const response = await fetchWithTimeout(
            `https://api.duckduckgo.com/?q=${encodeURIComponent(input.query)}&format=json&no_html=1&skip_disambig=1`
          );
          const data = await response.json();
          const results = [];
          if (data.AbstractText) {
            results.push({
              title: "Zusammenfassung",
              url: data.AbstractURL ?? "",
              snippet: data.AbstractText
            });
          }
          if (data.RelatedTopics) {
            for (const topic of data.RelatedTopics.slice(0, 5)) {
              if (topic.Text && topic.FirstURL) {
                results.push({
                  title: topic.Text.slice(0, 80),
                  url: topic.FirstURL,
                  snippet: topic.Text
                });
              }
            }
          }
          return { results, query: input.query };
        } catch {
          return { results: [], query: input.query };
        }
      }),
      // ─── tRPC-basierte Chat-Mutation (kein SSE, funktioniert in Produktion) ──────
      sendMessage: protectedProcedure.input(
        z6.object({
          conversationId: z6.number(),
          message: z6.string(),
          fileUrl: z6.string().optional(),
          fileName: z6.string().optional(),
          searchResults: z6.array(
            z6.object({
              title: z6.string(),
              snippet: z6.string(),
              url: z6.string()
            })
          ).optional(),
          context: z6.object({
            location: z6.object({ lat: z6.number(), lng: z6.number() }).optional(),
            battery: z6.string().optional()
          }).optional()
        })
      ).mutation(async ({ ctx, input }) => {
        const {
          conversationId,
          message,
          fileUrl,
          fileName,
          searchResults,
          context
        } = input;
        const userId = ctx.user.id;
        const conv = await getConversationById(conversationId);
        if (!conv || conv.userId !== userId)
          throw new TRPCError5({ code: "FORBIDDEN" });
        const history = await getMessagesByConversation(conversationId);
        await addMessage({
          conversationId,
          role: "user",
          content: message,
          fileUrl: fileUrl ?? null,
          fileName: fileName ?? null
        });
        const wasPending = hasPending(conversationId);
        const approvedNow = wasPending && isApproval(message);
        const rejectedNow = wasPending && !approvedNow && isRejection(message);
        if (rejectedNow) clearPending(conversationId);
        let approvalContext = "";
        if (approvedNow) {
          const approvedActions = takePending(conversationId);
          const executed = [];
          for (const p of approvedActions) {
            const step = await executeAction(
              { userId, runCalendar: executeCalendarAction },
              { tag: p.tag, payload: p.payload }
            );
            executed.push(`- ${p.description}: ${step.result}`);
          }
          approvalContext = executed.length > 0 ? `

FREIGEGEBEN UND BEREITS AUSGEF\xDCHRT: Stefan hat zugestimmt, die folgenden Aktionen wurden gerade ausgef\xFChrt. Best\xE4tige das kurz mit den echten Ergebnissen und f\xFChre sie NICHT erneut aus:
${executed.join("\n")}` : "";
        } else if (rejectedNow) {
          approvalContext = "\n\nABGELEHNT: Stefan hat die vorgemerkte Aktion abgelehnt. Best\xE4tige kurz, dass du sie nicht ausgef\xFChrt hast, und frage nach der gew\xFCnschten Alternative.";
        }
        try {
          const detected = detectIntent(message);
          if (detected)
            await trackPrompt(
              userId,
              detected.intent,
              detected.label,
              message.slice(0, 400)
            );
        } catch (e) {
          console.error("[PromptStats]", e);
        }
        let calendarContext = "";
        try {
          const upcoming = await executeCalendarAction(userId, "list_events", {
            timeMin: (/* @__PURE__ */ new Date()).toISOString(),
            timeMax: new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3).toISOString()
          });
          if (!upcoming.includes("nicht verbunden") && !upcoming.includes("Keine Termine"))
            calendarContext = `

Deine n\xE4chsten Termine (7 Tage):
${upcoming}`;
        } catch {
        }
        let memoryContext = "";
        try {
          const mems = await getMemoriesByUser(userId);
          if (mems.length > 0) {
            const grouped = {};
            for (const m of mems) {
              if (!grouped[m.category]) grouped[m.category] = [];
              grouped[m.category].push(`${m.key}: ${m.value}`);
            }
            const namen = {
              person: "Personen",
              contact: "Kontakte",
              preference: "Vorlieben",
              project: "Projekte",
              fact: "Fakten",
              address: "Adressen",
              context: "Kontext"
            };
            const lines = Object.entries(grouped).map(([cat, items]) => `${namen[cat] ?? cat}:
${items.join("\n")}`).join("\n\n");
            memoryContext = `

Gespeichertes Wissen \xFCber den Nutzer:
${lines}`;
          }
        } catch {
        }
        let profileContext = "";
        try {
          const profile = await getUserProfile(userId);
          if (profile) {
            const parts = [];
            if (profile.displayName)
              parts.push(`Name des Nutzers: ${profile.displayName}`);
            if (profile.occupation) parts.push(`Beruf: ${profile.occupation}`);
            if (profile.location) parts.push(`Standort: ${profile.location}`);
            if (profile.interests)
              parts.push(`Interessen/Hobbys: ${profile.interests}`);
            if (profile.workContext)
              parts.push(`Beruflicher Kontext: ${profile.workContext}`);
            if (profile.personalNotes)
              parts.push(`Pers\xF6nliche Notizen: ${profile.personalNotes}`);
            if (parts.length > 0)
              profileContext = `

Nutzerprofil:
${parts.join("\n")}`;
            const jarvisName = profile.jarvisName ?? "Jarvis";
            const addressForm = profile.addressForm ?? "sir";
            const addressStr = addressForm === "sir" ? "Spreche den Nutzer mit 'Sir' an" : addressForm === "du" ? `Spreche den Nutzer mit '${profile.displayName ?? "du"}' an` : `Spreche den Nutzer mit '${profile.displayName ?? "du"}' an`;
            const personalityStr = profile.jarvisPersonality ? `

Pers\xF6nlichkeit: ${profile.jarvisPersonality}` : "";
            const langStr = profile.language === "en" ? "Antworte auf Englisch." : profile.language === "auto" ? "Antworte in der Sprache des Nutzers." : "Antworte auf Deutsch.";
            const systemPrompt2 = `Du bist ${jarvisName}, der pers\xF6nliche Assistent von Stefan Gross. ${addressStr}.
${langStr}

${JARVIS_PERSONA}

Du kannst Dateien analysieren, Web-Suchergebnisse verarbeiten, Notizen, Aufgaben und den Google Kalender verwalten. Du hast ein dauerhaftes Ged\xE4chtnis.${personalityStr}
WICHTIG: Nutze f\xFCr echte "Erinnerungen" (z.B. "Erinnere mich um X Uhr an Y") zwingend das 'schedule_task' Werkzeug (Hintergrund-Task), damit der Nutzer eine Push-Benachrichtigung erh\xE4lt! Nutze den Kalender NUR f\xFCr tats\xE4chliche "Termine" oder wenn explizit ein Kalendereintrag gew\xFCnscht ist.
Heute ist der ${(/* @__PURE__ */ new Date()).toLocaleDateString("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Europe/Zurich" })}, es ist ${(/* @__PURE__ */ new Date()).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" })} Uhr (ISO: ${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}).

ALTERSBERECHNUNG (strikt einhalten): Wenn du das Alter einer Person berechnest oder \xFCber Geburtstage sprichst:
1. Rohes Alter = heutiges Jahr \u2212 Geburtsjahr.
2. Hat der Geburtstag (Monat + Tag) dieses Jahr noch NICHT stattgefunden \u2192 Alter = Rohes Alter \u2212 1, Geburtstag steht noch bevor.
3. Hat der Geburtstag dieses Jahr bereits stattgefunden \u2192 Alter = Rohes Alter, Geburtstag war bereits.
4. Kalendereintr\xE4ge rund um einen Geburtstag sind NICHT zwingend veraltet \u2013 pr\xFCfe das Datum, bevor du einen Eintrag als \xABveraltet\xBB bezeichnest.`;
            const grossIctContext = `

GROSS ICT ASSISTENT: Stefan betreibt im Nebenerwerb die Firma Gross ICT (gross-ict.ch) in Zell, Luzern.
Leistungen: Webseiten (ab CHF 1'500), Web-Apps (ab CHF 15'000), Mobile Apps (ab CHF 20'000), IT-Support, Netzwerk, Security, Server \u2013 f\xFCr KMU in der Zentralschweiz.
Wenn Stefan Hilfe zu Gross ICT braucht (Angebote, Texte, Kundenprojekte), kannst du helfen. Verwende immer CHF (nicht \u20AC) und Schweizer Schreibweise (ss statt \xDF).`;
            const intelligenceContext = `

ARBEITSWEISE (sehr wichtig):

1. NACHFRAGEN BEI UNKLARHEIT: Wenn eine Anfrage nicht genug Informationen enth\xE4lt, um sie korrekt auszuf\xFChren, stelle GEZIELTE R\xFCckfragen anstatt zu raten oder eine leere Antwort zu geben.
   Beispiel Termin: fehlen Datum, Uhrzeit, Dauer oder Titel, frage konkret: "F\xFCr wann? Wie lange? Mit wem?"
   Beispiel Rechnung/Angebot: fehlen Kunde, Positionen oder Betrag, frage genau danach.
   Stelle maximal drei R\xFCckfragen auf einmal und nummeriere sie. Wenn du bereits 80 % der Informationen hast, mache einen konkreten Vorschlag und bitte nur um Best\xE4tigung.
   Wenn du eine R\xFCckfrage stellst, f\xFChre KEINE Aktion aus.

2. PROAKTIVE TAGESPLANUNG: Wenn Stefan nach dem Tag, dem Plan, den Priorit\xE4ten oder einer \xDCbersicht fragt ("Was steht heute an?", "Wie sieht mein Tag aus?", "Was soll ich zuerst machen?"), erstelle eine priorisierte Tagesplanung:
   - Fasse Termine und Aufgaben in einer knappen Liste zusammen
   - Setze eine klare Reihenfolge mit Begr\xFCndung (Fristen, Termine, Aufwand)
   - Nenne h\xF6chstens drei Punkte als "heute wirklich wichtig"
   - Weise auf Konflikte hin (z.B. Aufgabe f\xE4llig, aber ganzer Tag verplant)
   - Schliesse mit einer kurzen Frage, ob du Aufgaben verschieben oder Priorit\xE4ten anpassen sollst

3. DOKUMENT-ZUSAMMENFASSUNG: Wenn eine Datei angeh\xE4ngt ist, strukturiere deine Antwort so:
   **Kurzfazit** (zwei bis drei S\xE4tze) \xB7 **Die wichtigsten Punkte** (Stichworte) \xB7 **Zahlen und Fristen** (falls vorhanden) \xB7 **Handlungsempfehlung** (konkrete n\xE4chste Schritte f\xFCr Stefan) \xB7 **Offene Fragen** (falls etwas unklar bleibt)

4. E-MAIL-ENTW\xDCRFE: Wenn Stefan eine E-Mail, Mahnung, Zahlungserinnerung oder Nachfrage braucht, schreibe einen vollst\xE4ndigen, versandfertigen Entwurf:
   - Beginne mit "Betreff: ..."
   - Passende Anrede und Grussformel mit Stefans Namen
   - Sachlich, freundlich, maximal 200 W\xF6rter
   - Wenn es um einen Kunden aus der App geht, hole zuerst die Daten mit einem app_action-Block (Kunde, Rechnungsnummer, Betrag, F\xE4lligkeit) und schreibe die E-Mail dann mit den echten Werten
   - Erfinde NIE Rechnungsnummern, Betr\xE4ge oder Daten. Fehlt eine Angabe, frage nach oder markiere sie klar als [Platzhalter]

5. VORLAGEN: F\xFCr wiederkehrende Dokumente (Angebot, IT-Konzept, Beschaffungsantrag, Protokoll, Statusbericht) gibt es im Bereich "Vorlagen" fertige Muster mit Platzhaltern. Weise Stefan darauf hin, wenn eine Vorlage schneller w\xE4re.`;
            let fullSystemPrompt = systemPrompt2 + grossIctContext + intelligenceContext + `

${CORE_AGENT_INSTRUCTIONS}

MUSIK (Spotify): Stefan kann sein Spotify-Konto verbinden. Wenn er Musik h\xF6ren will, f\xFCge GENAU EINEN spotify_action-Block ein:
<spotify_action>{"action":"play","query":"Coldplay Yellow","type":"track"}</spotify_action>
<spotify_action>{"action":"play","query":"Deep Focus","type":"playlist"}</spotify_action>
<spotify_action>{"action":"play"}</spotify_action>            // Wiedergabe fortsetzen
<spotify_action>{"action":"pause"}</spotify_action>
<spotify_action>{"action":"next"}</spotify_action>
<spotify_action>{"action":"previous"}</spotify_action>
<spotify_action>{"action":"volume","level":40}</spotify_action>
<spotify_action>{"action":"shuffle","enabled":true}</spotify_action>
<spotify_action>{"action":"current"}</spotify_action>          // was l\xE4uft gerade
<spotify_action>{"action":"search","query":"Jazz","type":"playlist"}</spotify_action>
<spotify_action>{"action":"playlists"}</spotify_action>
<spotify_action>{"action":"devices"}</spotify_action>
type kann track, album, playlist oder artist sein. Zeige NIE den rohen spotify_action-Block.

IPHONE (\xFCber Kurzbefehle): Stefan kann Jarvis bitten, WhatsApp-Nachrichten zu senden oder Wecker/Timer zu stellen.
Diese Befehle landen in einer Warteschlange, die sein iPhone abholt. F\xFCge GENAU EINEN device_action-Block ein:
<device_action>{"type":"whatsapp","recipient":"Bine","message":"Ich komme etwas sp\xE4ter"}</device_action>
<device_action>{"type":"alarm","time":"06:30","label":"Aufstehen"}</device_action>
<device_action>{"type":"timer","minutes":15,"label":"Pause"}</device_action>
<device_action>{"type":"reminder","message":"Rechnung Muster AG pr\xFCfen","time":"14:00"}</device_action>
Wenn Angaben fehlen (Empf\xE4nger, Text, Uhrzeit), frage zuerst nach. Zeige NIE den rohen device_action-Block.
${profileContext}${calendarContext}${memoryContext}${approvalContext}`;
            if (context) {
              const parts2 = [];
              if (context.location) {
                parts2.push(
                  `- GPS: Breitengrad ${context.location.lat}, L\xE4ngengrad ${context.location.lng}`
                );
              }
              if (context.battery) {
                parts2.push(`- Batteriestatus: ${context.battery}`);
              }
              if (parts2.length > 0) {
                fullSystemPrompt += `

GER\xC4TE-KONTEXT (Smartphone/Browser des Nutzers):
${parts2.join("\n")}`;
              }
            }
            const llmMessages2 = [
              { role: "system", content: fullSystemPrompt },
              ...history.map((m) => ({
                role: m.role === "assistant" ? "assistant" : "user",
                content: m.content
              }))
            ];
            let userContent2 = message;
            if (searchResults && searchResults.length > 0) {
              const ctxStr = searchResults.map((r) => `**${r.title}**: ${r.snippet} (${r.url})`).join("\n");
              userContent2 = `${message}

[Web-Suchergebnisse:
${ctxStr}]`;
            }
            if (fileUrl && fileName) {
              const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
              const isImage = ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);
              const baseUrl = ENV.forgeApiUrl?.replace("/v1", "") ?? "";
              const absUrl = fileUrl.startsWith("http") ? fileUrl : `${baseUrl}${fileUrl}`;
              if (isImage) {
                userContent2 = [
                  { type: "image_url", image_url: { url: absUrl } },
                  {
                    type: "text",
                    text: typeof userContent2 === "string" ? userContent2 || `Analysiere dieses Bild: ${fileName}` : message
                  }
                ];
              } else {
                let fileContent = "";
                try {
                  const fr = await fetchWithTimeout(absUrl);
                  if (fr.ok) {
                    fileContent = await fr.text();
                    if (fileContent.length > 8e3)
                      fileContent = fileContent.slice(0, 8e3) + "\n...[gek\xFCrzt]";
                  }
                } catch {
                }
                userContent2 = fileContent ? `${typeof userContent2 === "string" ? userContent2 : message}

[Dateiinhalt von ${fileName}:
\`\`\`
${fileContent}
\`\`\`]` : `${typeof userContent2 === "string" ? userContent2 : message}

[Datei: ${fileName}]`;
              }
            }
            llmMessages2.push({ role: "user", content: userContent2 });
            const llmResp2 = await invokeLLM({
              model: "claude-sonnet-4-5",
              max_tokens: 4096,
              messages: llmMessages2
            });
            const msgContent2 = llmResp2.choices[0]?.message;
            const fullResponse2 = {
              text: typeof msgContent2?.content === "string" ? msgContent2.content : "",
              tool_calls: msgContent2?.tool_calls
            };
            const loopP = await runAgentLoop({
              firstResponse: fullResponse2,
              messages: llmMessages2,
              runAction: (parsed2) => executeAction(
                { userId, runCalendar: executeCalendarAction },
                parsed2
              ),
              callModel: async (msgs) => {
                const next = await invokeLLM({
                  model: "claude-sonnet-4-5",
                  max_tokens: 4096,
                  messages: msgs
                });
                const msg = next.choices[0]?.message;
                return {
                  text: typeof msg?.content === "string" ? msg.content : "",
                  tool_calls: msg?.tool_calls
                };
              }
              // Hat Stefan im vorherigen Zug zugestimmt, dürfen kritische Aktionen laufen
            });
            const finalResponseText2 = removeInternalTags(loopP.text) + formatStepLog(loopP.steps);
            rememberPending(conversationId, loopP.pending);
            const convTitleP = finalResponseText2.slice(0, 50).replace(/[\n]/g, " ").trim();
            if (history.length <= 1) {
              await updateConversationTitle(
                conversationId,
                convTitleP || message.slice(0, 50)
              );
            }
            await addMessage({
              conversationId,
              role: "assistant",
              content: finalResponseText2
            });
            return { response: finalResponseText2 };
          }
        } catch (e) {
          console.error("[Profile] Fehler beim Laden:", e);
        }
        let systemPrompt = await buildChatSystemPrompt(userId, message);
        if (context) {
          const parts = [];
          if (context.location) {
            parts.push(
              `- GPS: Breitengrad ${context.location.lat}, L\xE4ngengrad ${context.location.lng}`
            );
          }
          if (context.battery) {
            parts.push(`- Batteriestatus: ${context.battery}`);
          }
          if (parts.length > 0) {
            systemPrompt += `

GER\xC4TE-KONTEXT (Smartphone/Browser des Nutzers):
${parts.join("\n")}`;
          }
        }
        systemPrompt += `Du bist Jarvis, der pers\xF6nliche Assistent von Stefan Gross. Du antwortest immer auf Deutsch.

${JARVIS_PERSONA}

Du kannst Dateien analysieren, Web-Suchergebnisse verarbeiten, Notizen, Aufgaben und den Google Kalender verwalten. Du hast ein dauerhaftes Ged\xE4chtnis.
WICHTIG: Nutze f\xFCr echte "Erinnerungen" (z.B. "Erinnere mich um X Uhr an Y") zwingend das 'schedule_task' Werkzeug (Hintergrund-Task), damit der Nutzer eine Push-Benachrichtigung erh\xE4lt! Nutze den Kalender NUR f\xFCr tats\xE4chliche "Termine" oder wenn explizit ein Kalendereintrag gew\xFCnscht ist.
Heute ist der ${(/* @__PURE__ */ new Date()).toLocaleDateString("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Europe/Zurich" })}, es ist ${(/* @__PURE__ */ new Date()).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" })} Uhr (ISO: ${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}).

ALTERSBERECHNUNG (strikt einhalten): Wenn du das Alter einer Person berechnest oder \xFCber Geburtstage sprichst:
1. Rohes Alter = heutiges Jahr \u2212 Geburtsjahr.
2. Hat der Geburtstag (Monat + Tag) dieses Jahr noch NICHT stattgefunden \u2192 Alter = Rohes Alter \u2212 1, Geburtstag steht noch bevor.
3. Hat der Geburtstag dieses Jahr bereits stattgefunden \u2192 Alter = Rohes Alter, Geburtstag war bereits.
4. Kalendereintr\xE4ge rund um einen Geburtstag sind NICHT zwingend veraltet \u2013 pr\xFCfe das Datum, bevor du einen Eintrag als \xABveraltet\xBB bezeichnest.

${CORE_AGENT_INSTRUCTIONS}

MUSIK (Spotify): F\xFCge bei Musikw\xFCnschen GENAU EINEN spotify_action-Block ein:
<spotify_action>{"action":"play","query":"Coldplay Yellow","type":"track"}</spotify_action>
<spotify_action>{"action":"pause"}</spotify_action> / {"action":"next"} / {"action":"previous"}
<spotify_action>{"action":"volume","level":40}</spotify_action>
<spotify_action>{"action":"current"}</spotify_action> / {"action":"playlists"} / {"action":"devices"}
type kann track, album, playlist oder artist sein. Zeige NIE den rohen Block.

IPHONE (Kurzbefehle): F\xFCr WhatsApp-Nachrichten, Wecker und Timer GENAU EINEN device_action-Block:
<device_action>{"type":"whatsapp","recipient":"Bine","message":"Ich komme sp\xE4ter"}</device_action>
<device_action>{"type":"alarm","time":"06:30","label":"Aufstehen"}</device_action>
<device_action>{"type":"timer","minutes":15}</device_action>
Fehlen Angaben, frage zuerst nach. Zeige NIE den rohen Block.
${calendarContext}${memoryContext}${approvalContext}`;
        const llmMessages = [
          { role: "system", content: systemPrompt },
          ...history.map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content
          }))
        ];
        let userContent = message;
        if (searchResults && searchResults.length > 0) {
          const ctxStr = searchResults.map((r) => `**${r.title}**: ${r.snippet} (${r.url})`).join("\n");
          userContent = `${message}

[Web-Suchergebnisse:
${ctxStr}]`;
        }
        if (fileUrl && fileName) {
          const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
          const isImage = ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);
          const baseUrl = ENV.forgeApiUrl?.replace("/v1", "") ?? "";
          const absUrl = fileUrl.startsWith("http") ? fileUrl : `${baseUrl}${fileUrl}`;
          if (isImage) {
            userContent = [
              { type: "image_url", image_url: { url: absUrl } },
              {
                type: "text",
                text: typeof userContent === "string" ? userContent || `Analysiere dieses Bild: ${fileName}` : message
              }
            ];
          } else {
            let fileContent = "";
            try {
              const fr = await fetchWithTimeout(absUrl);
              if (fr.ok) {
                fileContent = await fr.text();
                if (fileContent.length > 8e3)
                  fileContent = fileContent.slice(0, 8e3) + "\n...[gek\xFCrzt]";
              }
            } catch {
            }
            userContent = fileContent ? `${typeof userContent === "string" ? userContent : message}

[Dateiinhalt von ${fileName}:
\`\`\`
${fileContent}
\`\`\`]` : `${typeof userContent === "string" ? userContent : message}

[Datei: ${fileName}]`;
          }
        }
        llmMessages.push({ role: "user", content: userContent });
        const llmResp = await invokeLLM({
          model: "claude-sonnet-4-5",
          max_tokens: 4096,
          messages: llmMessages
        });
        const msgContent = llmResp.choices[0]?.message;
        const fullResponse = {
          text: typeof msgContent?.content === "string" ? msgContent.content : "",
          tool_calls: msgContent?.tool_calls
        };
        const loopFb = await runAgentLoop({
          firstResponse: fullResponse,
          messages: llmMessages,
          runAction: (parsed2) => executeAction({ userId, runCalendar: executeCalendarAction }, parsed2),
          callModel: async (msgs) => {
            const next = await invokeLLM({
              model: "claude-sonnet-4-5",
              max_tokens: 4096,
              messages: msgs
            });
            const msg = next.choices[0]?.message;
            return {
              text: typeof msg?.content === "string" ? msg.content : "",
              tool_calls: msg?.tool_calls
            };
          }
        });
        const cleanResponse = removeInternalTags(loopFb.text) + formatStepLog(loopFb.steps);
        rememberPending(conversationId, loopFb.pending);
        await addMessage({
          conversationId,
          role: "assistant",
          content: cleanResponse
        });
        if (history.length === 0) {
          try {
            const titleRes = await invokeLLM({
              model: "claude-haiku-4-5",
              max_tokens: 30,
              messages: [
                {
                  role: "user",
                  content: `Erstelle einen kurzen Gespr\xE4chstitel (max. 5 W\xF6rter, kein Punkt am Ende) f\xFCr diese Frage: "${message}"`
                }
              ]
            });
            const title = titleRes.choices[0]?.message?.content;
            await updateConversationTitle(
              conversationId,
              typeof title === "string" ? title.trim() : message.slice(0, 40)
            );
          } catch {
          }
        }
        return { response: cleanResponse, conversationId };
      })
    });
  }
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}
var init_context = __esm({
  "server/_core/context.ts"() {
    "use strict";
    init_sdk();
  }
});

// server/routers/streamEndpoint.ts
var streamEndpoint_exports = {};
__export(streamEndpoint_exports, {
  handleChatStream: () => handleChatStream
});
async function handleChatStream(req, res) {
  const ctx = await createContext({ req, res });
  if (false) {
    return res.status(401).json({ error: "Nicht authentifiziert" });
  }
  const {
    message,
    conversationId: reqConversationId,
    searchResults,
    fileUrl,
    fileName,
    approved,
    context
  } = req.body;
  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Nachricht fehlt" });
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  const sendEvent = (event, data) => {
    res.write(`event: ${event}
data: ${JSON.stringify(data)}

`);
  };
  try {
    const userId = 1;
    let conversationId = reqConversationId;
    let history = [];
    if (conversationId) {
      const conv = await getConversationById(conversationId);
      if (!conv) {
        return res.status(404).json({ error: "Konversation nicht gefunden" });
      }
      history = await getMessagesByConversation(conversationId);
    } else {
      const newConv = await createConversation({
        userId,
        title: message.slice(0, 40)
      });
      conversationId = newConv.id;
    }
    await addMessage({
      conversationId,
      role: "user",
      content: message
    });
    let systemPrompt = await buildChatSystemPrompt(userId, message);
    if (context) {
      const parts = [];
      if (context.location) {
        parts.push(
          `- GPS: Breitengrad ${context.location.lat}, L\xE4ngengrad ${context.location.lng}`
        );
      }
      if (context.battery) {
        parts.push(`- Batteriestatus: ${context.battery}`);
      }
      if (parts.length > 0) {
        systemPrompt += `

GER\xC4TE-KONTEXT (Smartphone/Browser des Nutzers):
${parts.join("\n")}`;
      }
    }
    let userContent = message;
    if (searchResults && searchResults.length > 0) {
      const ctxStr = searchResults.map((r) => `**${r.title}**: ${r.snippet} (${r.url})`).join("\n");
      userContent = `${message}

[Web-Suchergebnisse:
${ctxStr}]`;
    }
    if (fileUrl && fileName) {
      const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
      const isImage = ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);
      const baseUrl = ENV.forgeApiUrl?.replace("/v1", "") ?? "";
      const absUrl = fileUrl.startsWith("http") ? fileUrl : `${baseUrl}${fileUrl}`;
      if (isImage) {
        userContent = [
          { type: "image_url", image_url: { url: absUrl } },
          {
            type: "text",
            text: typeof userContent === "string" ? userContent || `Analysiere dieses Bild: ${fileName}` : message
          }
        ];
      } else {
        let fileContent = "";
        try {
          const fr = await fetchWithTimeout(absUrl);
          if (fr.ok) {
            fileContent = await fr.text();
            if (fileContent.length > 8e3)
              fileContent = fileContent.slice(0, 8e3) + "\n...[gek\xFCrzt]";
          }
        } catch {
        }
        userContent = fileContent ? `${typeof userContent === "string" ? userContent : message}

[Dateiinhalt von ${fileName}:
\`\`\`
${fileContent}
\`\`\`]` : `${typeof userContent === "string" ? userContent : message}

[Datei: ${fileName}]`;
      }
    }
    const llmMessages = [
      { role: "system", content: systemPrompt },
      ...history.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content
      })),
      { role: "user", content: userContent }
    ];
    const onStream = (chunk) => sendEvent("text", { chunk });
    const onStep = (step) => sendEvent("step", step);
    const firstResp = await invokeLLM({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      messages: llmMessages,
      onStream
    });
    const msgContent = firstResp.choices[0]?.message;
    const fullResponse = {
      text: typeof msgContent?.content === "string" ? msgContent.content : "",
      tool_calls: msgContent?.tool_calls
    };
    const loopFb = await runAgentLoop({
      firstResponse: fullResponse,
      messages: llmMessages,
      approved: Boolean(approved),
      onStream,
      onStep,
      runAction: async (parsed2) => {
        return executeAction(
          { userId, runCalendar: executeCalendarAction },
          parsed2
        );
      },
      callModel: async (msgs, streamCb) => {
        const next = await invokeLLM({
          model: "claude-sonnet-4-5",
          max_tokens: 4096,
          messages: msgs,
          onStream: streamCb
        });
        const msg = next.choices[0]?.message;
        return {
          text: typeof msg?.content === "string" ? msg.content : "",
          tool_calls: msg?.tool_calls
        };
      }
    });
    const cleanResponse = removeInternalTags(loopFb.text) + formatStepLog(loopFb.steps);
    rememberPending(conversationId, loopFb.pending);
    await addMessage({
      conversationId,
      role: "assistant",
      content: cleanResponse
    });
    if (history.length <= 1) {
      try {
        const titleRes = await invokeLLM({
          model: "claude-haiku-4-5",
          max_tokens: 30,
          messages: [
            {
              role: "user",
              content: `Erstelle einen kurzen Gespr\xE4chstitel (max. 5 W\xF6rter, kein Punkt am Ende) f\xFCr diese Frage: "${message}"`
            }
          ]
        });
        const title = titleRes.choices[0]?.message?.content;
        await updateConversationTitle(
          conversationId,
          typeof title === "string" ? title.trim() : message.slice(0, 40)
        );
      } catch {
      }
    }
    sendEvent("done", { conversationId, response: cleanResponse });
    res.end();
  } catch (err) {
    console.error("Stream error:", err);
    sendEvent("error", { message: err.message });
    res.end();
  }
}
var init_streamEndpoint = __esm({
  "server/routers/streamEndpoint.ts"() {
    "use strict";
    init_context();
    init_env();
    init_llm();
    init_db();
    init_agent();
    init_calendarAI();
    init_chat();
    init_http();
    init_pendingApproval();
    init_cleanResponse();
  }
});

// server/_core/vite.ts
var vite_exports = {};
__export(vite_exports, {
  serveStatic: () => serveStatic2,
  setupVite: () => setupVite
});
import express2 from "express";
import fs2 from "fs";
import { nanoid } from "nanoid";
import path3 from "path";
async function createViteServer(app, server) {
  const { createServer: createServer2 } = await import("vite");
  const configFile = path3.resolve(import.meta.dirname, "../../vite.config.ts");
  const vite = await createServer2({
    configFile,
    server: {
      middlewareMode: true,
      hmr: { server },
      allowedHosts: true
    },
    appType: "custom"
  });
  return vite;
}
async function setupVite(app, server) {
  const vite = await createViteServer(app, server);
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path3.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic2(app) {
  const distPath = process.env.NODE_ENV === "development" ? path3.resolve(import.meta.dirname, "../..", "dist", "public") : path3.resolve(import.meta.dirname, "public");
  if (!fs2.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.use(express2.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path3.resolve(distPath, "index.html"));
  });
}
var init_vite = __esm({
  "server/_core/vite.ts"() {
    "use strict";
  }
});

// server/backgroundTasks.ts
var backgroundTasks_exports = {};
__export(backgroundTasks_exports, {
  runBackgroundTasks: () => runBackgroundTasks,
  startBackgroundWorker: () => startBackgroundWorker
});
import { eq as eq5, and as and5, lte as lte2, asc, desc as desc3 } from "drizzle-orm";
import axios2 from "axios";
function getNextCronTime(cronExp, fromDate = /* @__PURE__ */ new Date()) {
  const next = new Date(fromDate);
  next.setHours(next.getHours() + 1);
  return next;
}
async function runBackgroundTasks() {
  const db = await getDb();
  if (!db) return;
  const now = /* @__PURE__ */ new Date();
  try {
    const dueTasks = await db.select().from(scheduledTasks).where(
      and5(eq5(scheduledTasks.isActive, true), lte2(scheduledTasks.runAt, now))
    ).orderBy(asc(scheduledTasks.runAt));
    for (const task of dueTasks) {
      logger.info(
        `F\xFChre geplanten Task aus: ID ${task.id}, Prompt: ${task.prompt}`
      );
      let nextRunAt = null;
      let isActive = false;
      if (task.cronExpression) {
        nextRunAt = getNextCronTime(task.cronExpression, now);
        isActive = true;
      }
      await db.update(scheduledTasks).set({
        lastRunAt: now,
        runAt: nextRunAt,
        isActive
      }).where(eq5(scheduledTasks.id, task.id));
      const userRes = await db.select().from(users).where(eq5(users.id, task.userId)).limit(1);
      const user = userRes[0];
      const profileRes = await db.select().from(userProfiles).where(eq5(userProfiles.userId, task.userId)).limit(1);
      const profile = profileRes[0];
      if (!user) continue;
      const timeStr = `Heute ist der ${(/* @__PURE__ */ new Date()).toLocaleDateString("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Europe/Zurich" })}, es ist ${(/* @__PURE__ */ new Date()).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" })} Uhr (ISO: ${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}).`;
      const systemPrompt = `Du bist Jarvis. F\xFChre den folgenden geplanten Hintergrund-Task aus und fasse das Ergebnis kurz zusammen.
${timeStr}`;
      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: task.prompt }
          ]
        });
        const ctx = await createContext({});
        ctx.user = user;
        const initialResponseText = typeof response === "string" ? response : response.choices[0]?.message?.content || "";
        let firstResponseText = "";
        if (typeof initialResponseText === "string") {
          firstResponseText = initialResponseText;
        } else {
          firstResponseText = initialResponseText.map((c) => c.type === "text" ? c.text : "").join("\n");
        }
        const loopResult = await runAgentLoop({
          firstResponse: firstResponseText,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: task.prompt }
          ],
          callModel: async (messages2) => {
            const res = await invokeLLM({ messages: messages2 });
            const content = res.choices[0]?.message?.content || "";
            if (typeof content === "string") return content;
            return content.map((c) => c.type === "text" ? c.text : "").join("\n");
          },
          runAction: async (parsed2) => {
            const { executeAction: executeAction2 } = await Promise.resolve().then(() => (init_agent(), agent_exports));
            return executeAction2(
              {
                userId: user.id,
                runCalendar: async () => "Not supported in background task yet"
              },
              parsed2
            );
          },
          maxRounds: 3
        });
        const notifyChat = profile?.notifyChat ?? true;
        const notifyPush = profile?.notifyPush ?? false;
        const notifyEmail = profile?.notifyEmail ?? false;
        const resultText = loopResult.text || "Aufgabe wurde ohne Text-Ergebnis abgeschlossen.";
        if (notifyChat) {
          const convRes = await db.select().from(conversations).where(eq5(conversations.userId, user.id)).orderBy(desc3(conversations.updatedAt)).limit(1);
          const lastConv = convRes[0];
          if (lastConv) {
            await db.insert(messages).values({
              conversationId: lastConv.id,
              role: "assistant",
              content: `[Hintergrund-Task: ${task.prompt}]
${resultText}`
            });
            await db.update(conversations).set({ updatedAt: /* @__PURE__ */ new Date() }).where(eq5(conversations.id, lastConv.id));
          }
        }
        if (notifyPush && profile?.expoPushToken) {
          const token = profile.expoPushToken;
          if (token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[")) {
            try {
              await axios2.post(
                "https://exp.host/--/api/v2/push/send",
                {
                  to: token,
                  sound: "default",
                  title: "Jarvis",
                  body: resultText.slice(0, 200),
                  data: { type: "reminder" }
                },
                {
                  headers: {
                    Accept: "application/json",
                    "Accept-encoding": "gzip, deflate",
                    "Content-Type": "application/json"
                  }
                }
              );
              logger.info(`Push-Notification gesendet an User ${user.id}`);
            } catch (pushErr) {
              logger.error(
                { pushErr },
                "Fehler beim Senden der Push-Notification"
              );
            }
          } else {
            logger.warn(
              `Ung\xFCltiger Expo-Push-Token f\xFCr User ${user.id}: ${token}`
            );
          }
        }
        if (notifyEmail) {
          logger.info(`W\xFCrde E-Mail senden an User ${user.id}: ${resultText}`);
        }
      } catch (err) {
        logger.error(
          { err },
          `Fehler bei Ausf\xFChrung von Hintergrund-Task ${task.id}`
        );
      }
    }
  } catch (err) {
    logger.error({ err }, "Fehler beim Pr\xFCfen geplanter Tasks");
  }
}
function startBackgroundWorker() {
  setInterval(() => {
    runBackgroundTasks().catch((err) => {
      logger.error({ err }, "Background Worker Error");
    });
  }, 30 * 1e3);
  logger.info("Background Worker gestartet.");
}
var init_backgroundTasks = __esm({
  "server/backgroundTasks.ts"() {
    "use strict";
    init_db();
    init_schema();
    init_llm();
    init_logger();
    init_agent();
    init_context();
  }
});

// server/_core/loadEnv.ts
import { existsSync } from "fs";
import path from "path";
import { config as loadDotenv } from "dotenv";
var candidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(import.meta.dirname, ".env"),
  path.resolve(import.meta.dirname, "..", ".env"),
  path.resolve(import.meta.dirname, "..", "..", ".env")
];
for (const file of candidates) {
  if (existsSync(file)) {
    loadDotenv({ path: file });
    break;
  }
}

// server/_core/index.ts
init_env();
init_logger();
import express3 from "express";
import { createServer } from "http";
import net from "net";

// server/_core/rateLimit.ts
import rateLimit from "express-rate-limit";
var apiLimiter = rateLimit({
  windowMs: 6e4,
  // 1 Minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Zu viele Anfragen. Bitte kurz warten." }
});
var publicEndpointLimiter = rateLimit({
  windowMs: 6e4,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Rate limit exceeded." }
});
var ttsLimiter = rateLimit({
  windowMs: 6e4,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Zu viele Sprachausgabe-Anfragen. Bitte kurz warten." }
});

// server/_core/index.ts
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// server/_core/oauth.ts
init_const();
init_db();
import { parse as parseCookieHeader2 } from "cookie";

// server/_core/cookies.ts
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: true
  };
}

// server/_core/oauth.ts
init_sdk();
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader2(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, {
      path: "/",
      secure: true,
      sameSite: "none"
    });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS
      });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/localAuth.ts
init_const();
init_db();
import { timingSafeEqual } from "crypto";
init_sdk();
var LOCAL_OWNER_OPEN_ID = "local_owner";
function localAuthEnabled() {
  return Boolean(process.env.APP_PASSWORD);
}
function passwordMatches(input, expected) {
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
function registerLocalAuthRoutes(app) {
  app.get("/api/auth/mode", (_req, res) => {
    res.json({ mode: localAuthEnabled() ? "password" : "oauth" });
  });
  app.post("/api/auth/login", async (req, res) => {
    const expected = process.env.APP_PASSWORD;
    if (!expected) {
      res.status(503).json({ error: "Login ist nicht konfiguriert." });
      return;
    }
    const password = req.body?.password;
    if (typeof password !== "string" || !passwordMatches(password, expected)) {
      res.status(401).json({ error: "Falsches Passwort." });
      return;
    }
    try {
      const name = process.env.OWNER_NAME || "Stefan";
      await upsertUser({
        openId: LOCAL_OWNER_OPEN_ID,
        name,
        loginMethod: "password",
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(LOCAL_OWNER_OPEN_ID, {
        name,
        expiresInMs: ONE_YEAR_MS
      });
      res.cookie(COOKIE_NAME, sessionToken, {
        ...getSessionCookieOptions(req),
        maxAge: ONE_YEAR_MS
      });
      res.json({ ok: true });
    } catch (error) {
      console.error("[LocalAuth] Login fehlgeschlagen", error);
      res.status(500).json({ error: "Login fehlgeschlagen." });
    }
  });
}

// server/_core/storageProxy.ts
init_env();
function registerStorageProxy(app) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(
          `[StorageProxy] forge error: ${forgeResp.status} ${body}`
        );
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/routers.ts
init_const();

// server/_core/systemRouter.ts
import { z as z2 } from "zod";

// server/_core/notification.ts
init_env();
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/systemRouter.ts
init_trpc();
var systemRouter = router({
  health: publicProcedure.input(
    z2.object({
      timestamp: z2.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z2.object({
      title: z2.string().min(1, "title is required"),
      content: z2.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
init_trpc();
init_chat();

// server/routers/notes.ts
init_db();
init_trpc();
import { TRPCError as TRPCError6 } from "@trpc/server";
import { z as z7 } from "zod";
var notesRouter = router({
  list: protectedProcedure.input(z7.object({ search: z7.string().optional() })).query(async ({ ctx, input }) => {
    return getNotesByUser(ctx.user.id, input.search);
  }),
  create: protectedProcedure.input(
    z7.object({
      title: z7.string().min(1),
      content: z7.string(),
      tags: z7.string().optional()
    })
  ).mutation(async ({ ctx, input }) => {
    return createNote({ userId: ctx.user.id, ...input });
  }),
  update: protectedProcedure.input(
    z7.object({
      id: z7.number(),
      title: z7.string().optional(),
      content: z7.string().optional(),
      tags: z7.string().optional()
    })
  ).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    const note = await getNoteById(id, ctx.user.id);
    if (!note) throw new TRPCError6({ code: "NOT_FOUND" });
    await updateNote(id, ctx.user.id, data);
    return { success: true };
  }),
  delete: protectedProcedure.input(z7.object({ id: z7.number() })).mutation(async ({ ctx, input }) => {
    await deleteNote(input.id, ctx.user.id);
    return { success: true };
  })
});

// server/routers/tasks.ts
init_db();
init_trpc();
import { z as z8 } from "zod";
var tasksRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return getTasksByUser(ctx.user.id);
  }),
  create: protectedProcedure.input(
    z8.object({
      title: z8.string().min(1),
      description: z8.string().optional(),
      priority: z8.enum(["low", "medium", "high"]).optional(),
      dueDate: z8.number().optional()
    })
  ).mutation(async ({ ctx, input }) => {
    return createTask({ userId: ctx.user.id, ...input });
  }),
  update: protectedProcedure.input(
    z8.object({
      id: z8.number(),
      title: z8.string().optional(),
      description: z8.string().optional(),
      completed: z8.boolean().optional(),
      priority: z8.enum(["low", "medium", "high"]).optional(),
      dueDate: z8.number().nullable().optional()
    })
  ).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    await updateTask(
      id,
      ctx.user.id,
      data
    );
    return { success: true };
  }),
  delete: protectedProcedure.input(z8.object({ id: z8.number() })).mutation(async ({ ctx, input }) => {
    await deleteTask(input.id, ctx.user.id);
    return { success: true };
  }),
  toggleComplete: protectedProcedure.input(z8.object({ id: z8.number(), completed: z8.boolean() })).mutation(async ({ ctx, input }) => {
    await updateTask(input.id, ctx.user.id, { completed: input.completed });
    return { success: true };
  })
});

// server/routers/notifications.ts
init_trpc();
import { z as z9 } from "zod";
init_db();
var notificationsRouter = router({
  // Teste Benachrichtigung senden
  testNotification: protectedProcedure.input(z9.object({ title: z9.string(), content: z9.string() })).mutation(async ({ input }) => {
    const ok = await notifyOwner({
      title: input.title,
      content: input.content
    });
    return { success: ok };
  }),
  // Fällige Aufgaben prüfen und Benachrichtigung senden
  checkDueTasks: protectedProcedure.mutation(async ({ ctx }) => {
    const tasks2 = await getTasksByUser(ctx.user.id);
    const now = Date.now();
    const soon = now + 24 * 60 * 60 * 1e3;
    const overdue = tasks2.filter(
      (t2) => !t2.completed && t2.dueDate && t2.dueDate < now
    );
    const dueSoon = tasks2.filter(
      (t2) => !t2.completed && t2.dueDate && t2.dueDate >= now && t2.dueDate <= soon
    );
    if (overdue.length === 0 && dueSoon.length === 0) {
      return { sent: false, message: "Keine f\xE4lligen Aufgaben" };
    }
    const lines = [];
    if (overdue.length > 0) {
      lines.push(`**\xDCberf\xE4llig (${overdue.length}):**`);
      overdue.slice(0, 5).forEach(
        (t2) => lines.push(
          `\u2022 ${t2.title} \u2013 f\xE4llig ${new Date(t2.dueDate).toLocaleDateString("de-DE")}`
        )
      );
    }
    if (dueSoon.length > 0) {
      lines.push(`
**Bald f\xE4llig (${dueSoon.length}):**`);
      dueSoon.slice(0, 5).forEach(
        (t2) => lines.push(
          `\u2022 ${t2.title} \u2013 f\xE4llig ${new Date(t2.dueDate).toLocaleDateString("de-DE")}`
        )
      );
    }
    const ok = await notifyOwner({
      title: `\u23F0 Jarvis: ${overdue.length + dueSoon.length} Aufgabe(n) f\xE4llig`,
      content: lines.join("\n")
    });
    return { sent: ok, overdue: overdue.length, dueSoon: dueSoon.length };
  })
});

// server/routers.ts
init_calendar();

// server/routers/memory.ts
init_trpc();
init_db();
import { z as z10 } from "zod";
var memoryRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return getMemoriesByUser(ctx.user.id);
  }),
  upsert: protectedProcedure.input(
    z10.object({
      category: z10.string().default("fact"),
      key: z10.string(),
      value: z10.string()
    })
  ).mutation(async ({ ctx, input }) => {
    await upsertMemory(
      ctx.user.id,
      input.category,
      input.key,
      input.value,
      "manual"
    );
    return { success: true };
  }),
  delete: protectedProcedure.input(z10.object({ id: z10.number() })).mutation(async ({ ctx, input }) => {
    await deleteMemory(ctx.user.id, input.id);
    return { success: true };
  })
});

// server/routers/profile.ts
init_trpc();
init_db();
import { z as z11 } from "zod";
var profileRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    return await getUserProfile(ctx.user.id);
  }),
  update: protectedProcedure.input(
    z11.object({
      displayName: z11.string().max(128).optional(),
      occupation: z11.string().max(255).optional(),
      location: z11.string().max(255).optional(),
      jarvisName: z11.string().max(64).optional(),
      addressForm: z11.enum(["sir", "du", "name"]).optional(),
      interests: z11.string().optional(),
      workContext: z11.string().optional(),
      personalNotes: z11.string().optional(),
      jarvisPersonality: z11.string().optional(),
      language: z11.enum(["de", "en", "auto"]).optional(),
      elevenLabsVoiceId: z11.string().max(64).optional(),
      speechMode: z11.enum(["always", "voiceOnly", "never"]).optional(),
      notifyPush: z11.boolean().optional(),
      notifyWebpush: z11.boolean().optional(),
      notifyEmail: z11.boolean().optional(),
      notifyChat: z11.boolean().optional(),
      expoPushToken: z11.string().max(255).optional()
    })
  ).mutation(async ({ ctx, input }) => {
    await upsertUserProfile(ctx.user.id, input);
    return { success: true };
  })
});

// server/routers/grossIct.ts
init_trpc();
init_db();
init_schema();
init_llm();
import { z as z12 } from "zod";
import { and as and2, eq as eq2, desc as desc2 } from "drizzle-orm";
import { TRPCError as TRPCError7 } from "@trpc/server";
var GROSS_ICT_CONTEXT = `Du bist Jarvis, der pers\xF6nliche Assistent von Stefan Gross, Inhaber von Gross ICT (gross-ict.ch).
Gross ICT ist eine regionale ICT-Agentur in der Zentralschweiz (Sitz: Zell, Luzern) f\xFCr KMU, Vereine und Privatpersonen.

Leistungen und Preise:
- Webseiten: ab CHF 1'500 (Festpreis, suchmaschinenfreundlich, selbst pflegbar)
- Web-Applikationen: ab CHF 15'000 (Kundenportale, Buchungssysteme, individuelle Tools)
- Mobile Apps (iOS/Android): ab CHF 20'000
- IT-Support & Helpdesk: auf Anfrage
- Netzwerk & WLAN-Planung: auf Anfrage
- Security (Netzwerk, Endger\xE4te, Daten): auf Anfrage
- Server (lokal, Cloud, hybrid, Backup): auf Anfrage

Stil: professionell, direkt, lokal verankert, kein Callcenter, ein Ansprechpartner, Festpreise.
Sprache: Deutsch (Schweizer Stil, CHF statt \u20AC).`;
var grossIctRouter = router({
  // ── Projekte ──────────────────────────────────────────────────────────────
  listProjects: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(grossIctProjects).where(eq2(grossIctProjects.userId, ctx.user.id)).orderBy(desc2(grossIctProjects.updatedAt));
  }),
  createProject: protectedProcedure.input(
    z12.object({
      customerName: z12.string().min(1),
      customerEmail: z12.string().email().optional(),
      customerPhone: z12.string().optional(),
      projectTitle: z12.string().min(1),
      description: z12.string().optional(),
      service: z12.enum([
        "website",
        "webapp",
        "app",
        "support",
        "security",
        "network",
        "server",
        "other"
      ]).default("other"),
      status: z12.enum(["lead", "offer", "active", "completed", "cancelled"]).default("lead"),
      budget: z12.number().optional(),
      notes: z12.string().optional()
    })
  ).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR" });
    const [result] = await db.insert(grossIctProjects).values({ userId: ctx.user.id, ...input }).$returningId();
    return result;
  }),
  updateProject: protectedProcedure.input(
    z12.object({
      id: z12.number(),
      customerName: z12.string().optional(),
      customerEmail: z12.string().optional(),
      customerPhone: z12.string().optional(),
      projectTitle: z12.string().optional(),
      description: z12.string().optional(),
      service: z12.enum([
        "website",
        "webapp",
        "app",
        "support",
        "security",
        "network",
        "server",
        "other"
      ]).optional(),
      status: z12.enum(["lead", "offer", "active", "completed", "cancelled"]).optional(),
      budget: z12.number().optional(),
      notes: z12.string().optional()
    })
  ).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR" });
    const { id, ...data } = input;
    await db.update(grossIctProjects).set(data).where(
      and2(
        eq2(grossIctProjects.id, id),
        eq2(grossIctProjects.userId, ctx.user.id)
      )
    );
    return { success: true };
  }),
  deleteProject: protectedProcedure.input(z12.object({ id: z12.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR" });
    await db.delete(grossIctProjects).where(
      and2(
        eq2(grossIctProjects.id, input.id),
        eq2(grossIctProjects.userId, ctx.user.id)
      )
    );
    return { success: true };
  }),
  // ── Angebote ──────────────────────────────────────────────────────────────
  listQuotes: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(grossIctQuotes).where(eq2(grossIctQuotes.userId, ctx.user.id)).orderBy(desc2(grossIctQuotes.updatedAt));
  }),
  generateQuote: protectedProcedure.input(
    z12.object({
      customerName: z12.string(),
      customerEmail: z12.string().optional(),
      service: z12.string(),
      requirements: z12.string(),
      // Freitext-Beschreibung der Anforderungen
      budget: z12.number().optional()
    })
  ).mutation(async ({ ctx, input }) => {
    const prompt = `${GROSS_ICT_CONTEXT}

Erstelle ein professionelles Angebot f\xFCr folgenden Kunden:
- Kunde: ${input.customerName}
- Leistung: ${input.service}
- Anforderungen: ${input.requirements}
${input.budget ? `- Budget: CHF ${input.budget}` : ""}

Das Angebot soll enthalten:
1. Kurze Einleitung (pers\xF6nlich, lokal)
2. Leistungsbeschrieb (was genau wird geliefert)
3. Preis (Festpreis in CHF, aufgeschl\xFCsselt wenn sinnvoll)
4. Zeitplan (realistisch)
5. N\xE4chste Schritte

Format: Markdown, professionell, auf Deutsch (Schweizer Stil).`;
    const resp = await invokeLLM({
      model: "claude-sonnet-4-5",
      max_tokens: 2e3,
      messages: [{ role: "user", content: prompt }]
    });
    const content = resp.choices[0]?.message?.content ?? "";
    const db = await getDb();
    if (!db) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR" });
    const title = `Angebot ${input.service} \u2013 ${input.customerName}`;
    const [result] = await db.insert(grossIctQuotes).values({
      userId: ctx.user.id,
      customerName: input.customerName,
      customerEmail: input.customerEmail ?? null,
      title,
      content,
      totalAmount: input.budget ?? null,
      status: "draft"
    }).$returningId();
    return { id: result?.id, title, content };
  }),
  updateQuoteStatus: protectedProcedure.input(
    z12.object({
      id: z12.number(),
      status: z12.enum(["draft", "sent", "accepted", "rejected"])
    })
  ).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR" });
    await db.update(grossIctQuotes).set({ status: input.status }).where(
      and2(
        eq2(grossIctQuotes.id, input.id),
        eq2(grossIctQuotes.userId, ctx.user.id)
      )
    );
    return { success: true };
  }),
  deleteQuote: protectedProcedure.input(z12.object({ id: z12.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR" });
    await db.delete(grossIctQuotes).where(
      and2(
        eq2(grossIctQuotes.id, input.id),
        eq2(grossIctQuotes.userId, ctx.user.id)
      )
    );
    return { success: true };
  }),
  // ── Text-Assistent ────────────────────────────────────────────────────────
  generateText: protectedProcedure.input(
    z12.object({
      type: z12.enum([
        "blog",
        "service_description",
        "social_media",
        "email",
        "other"
      ]),
      topic: z12.string(),
      details: z12.string().optional(),
      tone: z12.enum(["professional", "friendly", "technical"]).default("professional")
    })
  ).mutation(async ({ input }) => {
    const typeLabels = {
      blog: "Blogartikel",
      service_description: "Leistungsbeschrieb f\xFCr die Website",
      social_media: "Social-Media-Post (LinkedIn/Instagram)",
      email: "E-Mail an Kunden",
      other: "Text"
    };
    const toneLabels = {
      professional: "professionell und seri\xF6s",
      friendly: "freundlich und pers\xF6nlich",
      technical: "technisch und pr\xE4zise"
    };
    const prompt = `${GROSS_ICT_CONTEXT}

Schreibe einen ${typeLabels[input.type]} f\xFCr Gross ICT zum Thema: "${input.topic}"
${input.details ? `Zus\xE4tzliche Details: ${input.details}` : ""}
Ton: ${toneLabels[input.tone]}

Der Text soll zum Stil von gross-ict.ch passen: lokal verankert, direkt, kein Marketing-Blabla, ein konkreter Ansprechpartner.
Format: Markdown.`;
    const resp = await invokeLLM({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }]
    });
    const content = resp.choices[0]?.message?.content ?? "";
    return { content };
  })
});

// server/routers/sonnenberg.ts
init_trpc();
init_llm();
import { z as z13 } from "zod";
var SONNENBERG_CONTEXT = `Du bist Jarvis, der pers\xF6nliche Assistent von Stefan Gross, Leiter ICT beim SONNENBERG Baar.

SONNENBERG Baar ist ein Kompetenzzentrum Sehen Verhalten Sprechen in Baar, Kanton Zug.
Es ist eine f\xFChrende Institution f\xFCr Kinder, Jugendliche und Erwachsene mit Unterst\xFCtzungsbedarf in den Bereichen Verhalten, Sprache, Sehen und Blindheit.

Stefan Gross ist Leiter ICT (Abteilungsleiter ICT) beim SONNENBERG Baar.
Er arbeitet 3 Tage pro Woche vor Ort in Baar und 2 Tage im Homeoffice.
E-Mail: stefan.gross@sonnenberg-baar.ch

Schreibe alle Dokumente auf Deutsch, professionell und institutionell. Verwende Schweizer Schreibweise (ss statt \xDF, CHF).
Ber\xFCcksichtige den sozialen Auftrag der Institution bei allen Formulierungen.`;
var sonnenbergRouter = router({
  // ── IT-Konzept generieren ─────────────────────────────────────────────────
  generateConcept: protectedProcedure.input(
    z13.object({
      topic: z13.string().min(1),
      scope: z13.string().optional(),
      background: z13.string().optional(),
      type: z13.enum([
        "it_concept",
        "security_concept",
        "migration_plan",
        "infrastructure_plan",
        "other"
      ]).default("it_concept")
    })
  ).mutation(async ({ input }) => {
    const typeLabels = {
      it_concept: "IT-Konzept",
      security_concept: "Sicherheitskonzept",
      migration_plan: "Migrationsplan",
      infrastructure_plan: "Infrastrukturkonzept",
      other: "Konzept"
    };
    const prompt = `${SONNENBERG_CONTEXT}

Erstelle ein professionelles ${typeLabels[input.type]} f\xFCr den SONNENBERG Baar zum Thema: "${input.topic}"
${input.scope ? `Umfang/Scope: ${input.scope}` : ""}
${input.background ? `Hintergrund: ${input.background}` : ""}

Das Dokument soll enthalten:
1. Ausgangslage und Zielsetzung
2. Ist-Analyse (falls relevant)
3. Soll-Zustand / L\xF6sungsansatz
4. Massnahmen und Umsetzungsschritte
5. Zeitplan und Ressourcen
6. Risiken und Massnahmen
7. Kosten (Sch\xE4tzung in CHF, falls relevant)

Format: Markdown, professionell, f\xFCr interne Verwendung beim SONNENBERG Baar.`;
    const resp = await invokeLLM({
      model: "claude-sonnet-4-5",
      max_tokens: 3e3,
      messages: [{ role: "user", content: prompt }]
    });
    return { content: resp.choices[0]?.message?.content ?? "" };
  }),
  // ── Beschaffungsantrag generieren ─────────────────────────────────────────
  generateProcurement: protectedProcedure.input(
    z13.object({
      item: z13.string().min(1),
      // Was wird beschafft
      quantity: z13.number().optional(),
      estimatedCost: z13.number().optional(),
      // CHF
      justification: z13.string().optional(),
      urgency: z13.enum(["low", "medium", "high"]).default("medium")
    })
  ).mutation(async ({ input }) => {
    const urgencyLabels = { low: "Tief", medium: "Mittel", high: "Hoch" };
    const prompt = `${SONNENBERG_CONTEXT}

Erstelle einen formellen Beschaffungsantrag f\xFCr den SONNENBERG Baar:
- Beschaffungsgegenstand: ${input.item}
${input.quantity ? `- Menge: ${input.quantity} St\xFCck` : ""}
${input.estimatedCost ? `- Gesch\xE4tzte Kosten: CHF ${input.estimatedCost.toLocaleString("de-CH")}` : ""}
${input.justification ? `- Begr\xFCndung: ${input.justification}` : ""}
- Dringlichkeit: ${urgencyLabels[input.urgency]}

Der Antrag soll enthalten:
1. Antragsteller: Stefan Gross, Leiter ICT, Datum: ${(/* @__PURE__ */ new Date()).toLocaleDateString("de-CH")}
2. Beschreibung der Beschaffung
3. Begr\xFCndung / Notwendigkeit (auch im Kontext der Institution)
4. Kostenaufstellung (inkl. Folgekosten wie Wartung, Lizenzen)
5. Alternativen (kurz)
6. Empfehlung
7. Unterschriftszeile f\xFCr Genehmigung

Format: Markdown, formell, f\xFCr interne Genehmigung.`;
    const resp = await invokeLLM({
      model: "claude-sonnet-4-5",
      max_tokens: 2e3,
      messages: [{ role: "user", content: prompt }]
    });
    return { content: resp.choices[0]?.message?.content ?? "" };
  }),
  // ── Sitzungsnotizen strukturieren ─────────────────────────────────────────
  structureMeetingNotes: protectedProcedure.input(
    z13.object({
      rawNotes: z13.string().min(1),
      meetingTitle: z13.string().optional(),
      participants: z13.string().optional()
    })
  ).mutation(async ({ input }) => {
    const prompt = `${SONNENBERG_CONTEXT}

Strukturiere folgende Sitzungsnotizen professionell:
${input.meetingTitle ? `Sitzung: ${input.meetingTitle}` : ""}
${input.participants ? `Teilnehmende: ${input.participants}` : ""}
Datum: ${(/* @__PURE__ */ new Date()).toLocaleDateString("de-CH")}

Rohe Notizen:
${input.rawNotes}

Erstelle ein strukturiertes Protokoll mit:
1. Sitzungsinformationen (Titel, Datum, Teilnehmende)
2. Traktanden / Besprochene Punkte
3. Beschl\xFCsse und Entscheidungen
4. Offene Punkte / Pendenzen (mit Verantwortlichen falls erw\xE4hnt)
5. N\xE4chste Schritte

Format: Markdown, professionell, klar strukturiert.`;
    const resp = await invokeLLM({
      model: "claude-sonnet-4-5",
      max_tokens: 2e3,
      messages: [{ role: "user", content: prompt }]
    });
    return { content: resp.choices[0]?.message?.content ?? "" };
  }),
  // ── IT-Statusbericht generieren ───────────────────────────────────────────
  generateStatusReport: protectedProcedure.input(
    z13.object({
      period: z13.string().optional(),
      // z.B. "August 2026"
      completedItems: z13.string().optional(),
      ongoingItems: z13.string().optional(),
      plannedItems: z13.string().optional(),
      issues: z13.string().optional()
    })
  ).mutation(async ({ input }) => {
    const period = input.period ?? (/* @__PURE__ */ new Date()).toLocaleDateString("de-CH", {
      month: "long",
      year: "numeric"
    });
    const prompt = `${SONNENBERG_CONTEXT}

Erstelle einen IT-Statusbericht f\xFCr den SONNENBERG Baar f\xFCr den Zeitraum: ${period}

${input.completedItems ? `Erledigte Aufgaben/Projekte:
${input.completedItems}` : ""}
${input.ongoingItems ? `
Laufende Projekte:
${input.ongoingItems}` : ""}
${input.plannedItems ? `
Geplante Massnahmen:
${input.plannedItems}` : ""}
${input.issues ? `
Probleme/Herausforderungen:
${input.issues}` : ""}

Der Statusbericht soll enthalten:
1. Zusammenfassung (Executive Summary)
2. Erledigte Aufgaben und Projekte
3. Laufende Projekte (mit Status)
4. Geplante Massnahmen n\xE4chste Periode
5. Herausforderungen und Risiken
6. Kennzahlen (falls relevant: Tickets, Ausfallzeiten, etc.)

Format: Markdown, professionell, f\xFCr Gesch\xE4ftsleitung oder Vorgesetzte.`;
    const resp = await invokeLLM({
      model: "claude-sonnet-4-5",
      max_tokens: 2500,
      messages: [{ role: "user", content: prompt }]
    });
    return { content: resp.choices[0]?.message?.content ?? "" };
  }),
  // ── Allgemeiner ICT-Text für Sonnenberg ───────────────────────────────────
  generateText: protectedProcedure.input(
    z13.object({
      type: z13.enum([
        "email",
        "announcement",
        "policy",
        "training_material",
        "other"
      ]),
      topic: z13.string().min(1),
      details: z13.string().optional(),
      audience: z13.enum(["management", "staff", "external", "all"]).default("staff")
    })
  ).mutation(async ({ input }) => {
    const typeLabels = {
      email: "E-Mail",
      announcement: "Ank\xFCndigung / Mitteilung",
      policy: "IT-Richtlinie / Policy",
      training_material: "Schulungsunterlagen",
      other: "Text"
    };
    const audienceLabels = {
      management: "Gesch\xE4ftsleitung",
      staff: "Mitarbeitende",
      external: "externe Stellen",
      all: "alle Beteiligten"
    };
    const prompt = `${SONNENBERG_CONTEXT}

Schreibe einen ${typeLabels[input.type]} f\xFCr den SONNENBERG Baar:
Thema: ${input.topic}
Zielgruppe: ${audienceLabels[input.audience]}
${input.details ? `Details: ${input.details}` : ""}

Ber\xFCcksichtige den sozialen Auftrag der Institution. Schreibe professionell, klar und verst\xE4ndlich.
Format: Markdown.`;
    const resp = await invokeLLM({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }]
    });
    return { content: resp.choices[0]?.message?.content ?? "" };
  })
});

// server/routers/appDashboard.ts
init_trpc();
init_appIntegration();
import { z as z14 } from "zod";
var appDashboardRouter = router({
  summary: protectedProcedure.query(() => getAppDashboard()),
  customers: protectedProcedure.input(
    z14.object({ search: z14.string().optional(), limit: z14.number().default(20) })
  ).query(({ input }) => listCustomers(input.limit, input.search)),
  tickets: protectedProcedure.input(z14.object({ status: z14.string().optional() })).query(({ input }) => listTickets(20, input.status)),
  quotes: protectedProcedure.input(z14.object({ status: z14.string().optional() })).query(({ input }) => listQuotes(20, input.status)),
  invoices: protectedProcedure.input(z14.object({ status: z14.string().optional() })).query(({ input }) => listInvoices(20, input.status)),
  overdueInvoices: protectedProcedure.query(() => getOverdueInvoices()),
  projects: protectedProcedure.input(z14.object({ status: z14.string().optional() })).query(({ input }) => listProjects(20, input.status)),
  leads: protectedProcedure.input(z14.object({ status: z14.string().optional() })).query(({ input }) => listLeads(20, input.status)),
  contracts: protectedProcedure.input(z14.object({ status: z14.string().optional() })).query(({ input }) => listContracts(20, input.status)),
  expenses: protectedProcedure.query(() => listExpenses(30)),
  products: protectedProcedure.query(() => listProducts(50)),
  /** Vollständiges Kunden-Dossier: Stammdaten, Tickets, Angebote, Rechnungen, Projekte, Verträge */
  customerDossier: protectedProcedure.input(z14.object({ idOrName: z14.string().min(1) })).query(({ input }) => getCustomerDossier(input.idOrName))
});

// server/routers/elevenlabs.ts
init_trpc();
init_db();
import { z as z15 } from "zod";

// server/ttsBudget.ts
init_cleanText();
var MONTHLY_CHAR_LIMIT = 1e4;
var MAX_CHARS_PER_SPEECH = 1200;
function currentYearMonth(date = /* @__PURE__ */ new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
function stripForSpeech(text2) {
  return text2.replace(/⟦schritte⟧[\s\S]*$/g, " ").replace(
    /\s*\[(?:person|contact|preference|project|fact|context|memory|profil|profile|kalender|calendar)\]/gi,
    ""
  ).replace(/```[\s\S]*?```/g, " ").replace(/`([^`]*)`/g, "$1").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/^\s{0,3}#{1,6}\s*/gm, "").replace(/^\s*[-*+•]\s+/gm, "").replace(/^\s*>\s?/gm, "").replace(/[*_~|]/g, "").replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "").replace(/[\u2600-\u27BF\u2B00-\u2BFF\uFE0F\u2190-\u21FF]/g, "").replace(/[ \t]+/g, " ").replace(/\n{2,}/g, ". ").replace(/\n/g, " ").replace(/\s*\.\s*\./g, ".").replace(/\s+([.,;:!?])/g, "$1").trim();
}
function shortenForSpeech(text2, limit = MAX_CHARS_PER_SPEECH) {
  const clean = stripForSpeech(text2);
  if (clean.length <= limit) return { spoken: clean, truncated: false };
  return { spoken: buildSpokenSummary(clean, limit), truncated: true };
}
function budgetState(charsUsed, limit = MONTHLY_CHAR_LIMIT) {
  const remaining = Math.max(0, limit - charsUsed);
  const percentUsed = limit === 0 ? 100 : Math.min(100, Math.round(charsUsed / limit * 100));
  const level = remaining === 0 ? "exhausted" : percentUsed >= 90 ? "critical" : percentUsed >= 75 ? "warn" : "ok";
  return { charsUsed, limit, remaining, percentUsed, level };
}

// server/ttsQuota.ts
var ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY ?? "";
function quotaLevel(charsUsed, limit) {
  const remaining = Math.max(0, limit - charsUsed);
  if (remaining <= 0) return "exhausted";
  const percent = limit === 0 ? 100 : charsUsed / limit * 100;
  if (percent >= 90) return "critical";
  if (percent >= 75) return "warn";
  return "ok";
}
var cache = null;
var CACHE_MS = 6e4;
async function fetchLiveQuota() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  if (!ELEVENLABS_KEY) return null;
  try {
    const resp = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": ELEVENLABS_KEY }
    });
    if (!resp.ok) return null;
    const d = await resp.json();
    const charsUsed = d.character_count ?? 0;
    const limit = d.character_limit ?? 1e4;
    const data = {
      charsUsed,
      limit,
      remaining: Math.max(0, limit - charsUsed),
      percentUsed: limit === 0 ? 100 : Math.min(100, Math.round(charsUsed / limit * 100)),
      level: quotaLevel(charsUsed, limit),
      resetAt: d.next_character_count_reset_unix ? d.next_character_count_reset_unix * 1e3 : null,
      tier: d.tier ?? "free",
      live: true
    };
    cache = { at: Date.now(), data };
    return data;
  } catch (e) {
    console.error("[TTS-Guthaben] Abfrage fehlgeschlagen:", e);
    return null;
  }
}
function invalidateQuotaCache() {
  cache = null;
}

// server/routers/elevenlabs.ts
init_http();
var ELEVENLABS_KEY2 = process.env.ELEVENLABS_API_KEY ?? "";
var JARVIS_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";
var elevenLabsRouter = router({
  tts: protectedProcedure.input(
    z15.object({
      text: z15.string().min(1).max(2500),
      voiceId: z15.string().optional(),
      /** false = vollständigen Text sprechen (z.B. Stimmen-Vorschau) */
      shorten: z15.boolean().default(true),
      /** true = schnelles Turbo-Modell (kürzere Wartezeit bis zum ersten Ton) */
      fast: z15.boolean().default(true)
    })
  ).mutation(async ({ ctx, input }) => {
    const voiceId = input.voiceId ?? JARVIS_VOICE_ID;
    const openAiKey = process.env.OPENAI_API_KEY ?? "";
    const useOpenAI = Boolean(openAiKey);
    let state = {
      remaining: 9999999,
      limit: 9999999,
      percentUsed: 0,
      charsUsed: 0,
      level: "green"
    };
    let live = null;
    if (!useOpenAI) {
      live = await fetchLiveQuota();
      const used = await getTtsUsage(ctx.user.id, currentYearMonth());
      state = live ?? budgetState(used);
      if (state.remaining <= 0) {
        throw new Error(
          "QUOTA_EXHAUSTED: Das Sprachausgabe-Guthaben ist aufgebraucht. Jarvis wechselt auf die Browser-Stimme, die Antworten erscheinen weiterhin im Chat."
        );
      }
    }
    const limit = Math.min(
      input.shorten ? MAX_CHARS_PER_SPEECH : 2500,
      state.remaining
    );
    const { spoken, truncated } = input.shorten ? shortenForSpeech(input.text, limit) : {
      spoken: input.text.slice(0, limit),
      truncated: input.text.length > limit
    };
    if (!spoken) throw new Error("Kein sprechbarer Text vorhanden.");
    let resp;
    if (useOpenAI) {
      resp = await fetchWithRetry("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        timeoutMs: 2e4,
        headers: {
          Authorization: `Bearer ${openAiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "tts-1",
          input: spoken,
          voice: "onyx",
          response_format: "mp3"
        })
      });
    } else {
      resp = await fetchWithRetry(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          timeoutMs: 2e4,
          headers: {
            "xi-api-key": ELEVENLABS_KEY2,
            "Content-Type": "application/json",
            Accept: "audio/mpeg"
          },
          body: JSON.stringify({
            text: spoken,
            model_id: "eleven_flash_v2_5",
            voice_settings: {
              stability: 0.75,
              similarity_boost: 0.8,
              style: 0,
              use_speaker_boost: false
            }
          })
        }
      );
    }
    if (!resp.ok) {
      const err = await resp.text();
      if (!useOpenAI && err.includes("quota_exceeded")) {
        invalidateQuotaCache();
        throw new Error(
          "QUOTA_EXHAUSTED: Das Sprachausgabe-Guthaben ist aufgebraucht. Jarvis wechselt auf die Browser-Stimme."
        );
      }
      throw new Error(`TTS Fehler: ${resp.status} \u2013 ${err}`);
    }
    const arrayBuffer = await resp.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const total = await addTtsUsage(
      ctx.user.id,
      currentYearMonth(),
      spoken.length
    );
    return {
      audio: base64,
      mimeType: "audio/mpeg",
      spokenText: spoken,
      truncated,
      usage: useOpenAI ? state : budgetState(total)
    };
  }),
  /** Aktueller Zeichenverbrauch des Monats */
  usage: protectedProcedure.query(async ({ ctx }) => {
    const openAiKey = process.env.OPENAI_API_KEY ?? "";
    if (openAiKey) {
      return {
        remaining: 9999999,
        limit: 9999999,
        percentUsed: 0,
        charsUsed: 0,
        level: "green",
        yearMonth: currentYearMonth(),
        monthlyLimit: 9999999,
        resetAt: null,
        tier: "openai",
        live: true,
        localCharsUsed: 0
      };
    }
    const live = await fetchLiveQuota();
    const used = await getTtsUsage(ctx.user.id, currentYearMonth());
    if (live) {
      return {
        ...live,
        yearMonth: currentYearMonth(),
        monthlyLimit: live.limit,
        localCharsUsed: used
      };
    }
    return {
      ...budgetState(used),
      yearMonth: currentYearMonth(),
      monthlyLimit: MONTHLY_CHAR_LIMIT,
      resetAt: null,
      tier: "unbekannt",
      live: false,
      localCharsUsed: used
    };
  }),
  // ── Verfügbare Stimmen auflisten ──────────────────────────────────────────
  voices: protectedProcedure.query(async () => {
    if (!ELEVENLABS_KEY2) {
      return [
        { id: "onyx", name: "Onyx (OpenAI)", gender: "male", accent: "neutral", useCase: "general" },
        { id: "alloy", name: "Alloy (OpenAI)", gender: "neutral", accent: "neutral", useCase: "general" },
        { id: "echo", name: "Echo (OpenAI)", gender: "male", accent: "neutral", useCase: "general" },
        { id: "fable", name: "Fable (OpenAI)", gender: "neutral", accent: "british", useCase: "general" },
        { id: "nova", name: "Nova (OpenAI)", gender: "female", accent: "neutral", useCase: "general" },
        { id: "shimmer", name: "Shimmer (OpenAI)", gender: "female", accent: "neutral", useCase: "general" }
      ];
    }
    const resp = await fetchWithTimeout("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": ELEVENLABS_KEY2 },
      timeoutMs: 1e4
    });
    if (!resp.ok) throw new Error("Stimmen konnten nicht abgerufen werden");
    const data = await resp.json();
    return data.voices.map((v) => ({
      id: v.voice_id,
      name: v.name,
      gender: v.labels?.gender ?? "unknown",
      accent: v.labels?.accent ?? "unknown",
      useCase: v.labels?.use_case ?? "general"
    }));
  }),
  // ── STT: Audio → Text via ElevenLabs Speech-to-Text ──────────────────────
  stt: protectedProcedure.input(
    z15.object({
      audioBase64: z15.string(),
      mimeType: z15.string().default("audio/webm"),
      language: z15.string().default("de")
      // de für Deutsch/Schweizerdeutsch
    })
  ).mutation(async ({ input }) => {
    const audioBuffer = Buffer.from(input.audioBase64, "base64");
    const blob = new Blob([audioBuffer], { type: input.mimeType });
    const formData = new FormData();
    formData.append(
      "file",
      blob,
      `audio.${input.mimeType.split("/")[1] ?? "webm"}`
    );
    formData.append("model_id", "scribe_v1");
    formData.append(
      "language_code",
      input.language === "de" ? "deu" : input.language
    );
    const resp = await fetchWithTimeout(
      "https://api.elevenlabs.io/v1/speech-to-text",
      {
        method: "POST",
        headers: { "xi-api-key": ELEVENLABS_KEY2 },
        body: formData,
        timeoutMs: 3e4
      }
    );
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`ElevenLabs STT Fehler: ${resp.status} \u2013 ${err}`);
    }
    const result = await resp.json();
    return {
      text: result.text ?? result.words?.map((w) => w.text).join(" ") ?? ""
    };
  })
});

// server/routers/templates.ts
init_trpc();
init_db();
init_llm();
import { z as z16 } from "zod";
import { TRPCError as TRPCError8 } from "@trpc/server";
var categoryEnum = z16.enum([
  "quote",
  "invoice",
  "concept",
  "report",
  "email",
  "procurement",
  "minutes",
  "other"
]);
var contextEnum = z16.enum(["gross_ict", "sonnenberg", "general"]);
function extractPlaceholders(content) {
  const rx = /\{\{\s*([a-zA-Z0-9_äöüÄÖÜ\s-]+?)\s*\}\}/g;
  const found = /* @__PURE__ */ new Set();
  let m;
  while ((m = rx.exec(content)) !== null) found.add(m[1].trim());
  return Array.from(found);
}
var STARTER_TEMPLATES = [
  {
    name: "Angebot Webseite (Gross ICT)",
    category: "quote",
    context: "gross_ict",
    description: "Standard-Angebot f\xFCr eine KMU-Webseite mit Festpreis.",
    content: `# Angebot \u2013 Webseite {{Kundenname}}

**Gross ICT** \xB7 Stefan Gross \xB7 gross-ict.ch
Datum: {{Datum}}
Angebots-Nr.: {{Angebotsnummer}}

## Ausgangslage
{{Ausgangslage}}

## Leistungsumfang
| Position | Beschreibung | Betrag (CHF) |
|---|---|---|
| 1 | Konzept und Struktur | {{Betrag Konzept}} |
| 2 | Design und Umsetzung | {{Betrag Umsetzung}} |
| 3 | Inhalte einpflegen | {{Betrag Inhalte}} |
| 4 | Suchmaschinen-Grundoptimierung | {{Betrag SEO}} |
| 5 | Schulung und \xDCbergabe | {{Betrag Schulung}} |

**Gesamtbetrag: CHF {{Gesamtbetrag}}** (exkl. MWST)

## Nicht enthalten
{{Ausschluesse}}

## Termine
Start: {{Startdatum}} \xB7 Fertigstellung: {{Fertigstellung}}

## Konditionen
Zahlung: 50 % bei Auftragserteilung, 50 % nach Abnahme. G\xFCltigkeit: 30 Tage.

Freundliche Gr\xFCsse
Stefan Gross, Gross ICT`
  },
  {
    name: "Zahlungserinnerung (Gross ICT)",
    category: "email",
    context: "gross_ict",
    description: "Freundliche erste Zahlungserinnerung f\xFCr offene Rechnungen.",
    content: `Betreff: Zahlungserinnerung Rechnung {{Rechnungsnummer}}

Guten Tag {{Anrede}}

Bei der Durchsicht unserer Buchhaltung ist mir aufgefallen, dass die Rechnung {{Rechnungsnummer}} vom {{Rechnungsdatum}} \xFCber CHF {{Betrag}} noch offen ist. Die Zahlungsfrist ist am {{Faelligkeitsdatum}} abgelaufen.

Vermutlich ist die Rechnung untergegangen \u2013 ich bitte Sie, den Betrag bis {{Neue Frist}} zu \xFCberweisen. Sollten Sie die Zahlung bereits ausgel\xF6st haben, betrachten Sie diese Nachricht als gegenstandslos.

Bei Fragen zur Rechnung stehe ich gerne zur Verf\xFCgung.

Freundliche Gr\xFCsse
Stefan Gross
Gross ICT \xB7 gross-ict.ch`
  },
  {
    name: "IT-Konzept (Sonnenberg)",
    category: "concept",
    context: "sonnenberg",
    description: "Struktur f\xFCr ein IT-Konzept zur Vorlage bei der Gesch\xE4ftsleitung.",
    content: `# IT-Konzept: {{Titel}}

Kompetenzzentrum Sonnenberg, Baar \xB7 Abteilung ICT
Verfasser: Stefan Gross, Leiter ICT \xB7 Datum: {{Datum}}

## 1. Ausgangslage
{{Ausgangslage}}

## 2. Handlungsbedarf
{{Handlungsbedarf}}

## 3. Zielsetzung
{{Ziele}}

## 4. L\xF6sungsvarianten
### Variante A \u2013 {{Variante A}}
Beschreibung, Vorteile, Nachteile, Kosten: CHF {{Kosten A}}

### Variante B \u2013 {{Variante B}}
Beschreibung, Vorteile, Nachteile, Kosten: CHF {{Kosten B}}

## 5. Empfehlung
{{Empfehlung}}

## 6. Kosten und Finanzierung
Investition: CHF {{Investition}} \xB7 Wiederkehrend pro Jahr: CHF {{Betriebskosten}}

## 7. Umsetzungsplan
{{Umsetzungsplan}}

## 8. Risiken und Massnahmen
{{Risiken}}

## 9. Antrag
{{Antrag}}`
  },
  {
    name: "Beschaffungsantrag (Sonnenberg)",
    category: "procurement",
    context: "sonnenberg",
    description: "Antrag f\xFCr eine ICT-Beschaffung inklusive Begr\xFCndung und Kosten.",
    content: `# Beschaffungsantrag {{Beschaffungsnummer}}

Kompetenzzentrum Sonnenberg, Baar \xB7 Abteilung ICT
Antragsteller: Stefan Gross, Leiter ICT \xB7 Datum: {{Datum}}

## Gegenstand
{{Gegenstand}}

## Begr\xFCndung
{{Begruendung}}

## Angebotsvergleich
| Anbieter | L\xF6sung | Preis (CHF) | Bemerkung |
|---|---|---|---|
| {{Anbieter 1}} | {{Loesung 1}} | {{Preis 1}} | {{Bemerkung 1}} |
| {{Anbieter 2}} | {{Loesung 2}} | {{Preis 2}} | {{Bemerkung 2}} |
| {{Anbieter 3}} | {{Loesung 3}} | {{Preis 3}} | {{Bemerkung 3}} |

## Empfehlung
{{Empfehlung}}

## Kosten
Investition einmalig: CHF {{Investition}}
Betriebskosten pro Jahr: CHF {{Betriebskosten}}
Budgetposition: {{Budgetposition}}

## Termin
Gew\xFCnschte Beschaffung bis: {{Termin}}

## Unterschriften
Antragsteller: ________________  Gesch\xE4ftsleitung: ________________`
  },
  {
    name: "Sitzungsprotokoll",
    category: "minutes",
    context: "general",
    description: "Strukturiertes Protokoll mit Beschl\xFCssen und Pendenzen.",
    content: `# Protokoll: {{Sitzungstitel}}

Datum: {{Datum}} \xB7 Zeit: {{Zeit}} \xB7 Ort: {{Ort}}
Teilnehmende: {{Teilnehmende}}
Protokoll: Stefan Gross

## 1. Traktanden
{{Traktanden}}

## 2. Besprochene Punkte
{{Inhalt}}

## 3. Beschl\xFCsse
| Nr. | Beschluss | Verantwortlich |
|---|---|---|
| 1 | {{Beschluss 1}} | {{Verantwortlich 1}} |
| 2 | {{Beschluss 2}} | {{Verantwortlich 2}} |

## 4. Pendenzen
| Nr. | Aufgabe | Verantwortlich | Termin |
|---|---|---|---|
| 1 | {{Pendenz 1}} | {{Wer 1}} | {{Termin 1}} |
| 2 | {{Pendenz 2}} | {{Wer 2}} | {{Termin 2}} |

## 5. N\xE4chste Sitzung
{{Naechste Sitzung}}`
  },
  {
    name: "IT-Statusbericht (Sonnenberg)",
    category: "report",
    context: "sonnenberg",
    description: "Monatlicher Statusbericht der Abteilung ICT.",
    content: `# ICT-Statusbericht {{Periode}}

Kompetenzzentrum Sonnenberg, Baar \xB7 Leiter ICT: Stefan Gross

## Kurzfazit
{{Kurzfazit}}

## Laufende Projekte
| Projekt | Status | Fortschritt | Bemerkung |
|---|---|---|---|
| {{Projekt 1}} | {{Status 1}} | {{Fortschritt 1}} | {{Bemerkung 1}} |
| {{Projekt 2}} | {{Status 2}} | {{Fortschritt 2}} | {{Bemerkung 2}} |

## Betrieb und Support
Tickets erledigt: {{Tickets erledigt}} \xB7 Offen: {{Tickets offen}}
Verf\xFCgbarkeit: {{Verfuegbarkeit}}

## Sicherheit
{{Sicherheit}}

## Kosten
Budgetverbrauch: {{Budgetverbrauch}}

## Ausblick
{{Ausblick}}`
  }
];
var templatesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return getTemplatesByUser(ctx.user.id);
  }),
  get: protectedProcedure.input(z16.object({ id: z16.number() })).query(async ({ ctx, input }) => {
    return getTemplateById(input.id, ctx.user.id);
  }),
  create: protectedProcedure.input(
    z16.object({
      name: z16.string().min(1),
      category: categoryEnum.default("other"),
      context: contextEnum.default("general"),
      description: z16.string().optional(),
      content: z16.string().min(1)
    })
  ).mutation(async ({ ctx, input }) => {
    const placeholders = extractPlaceholders(input.content);
    return createTemplate({
      userId: ctx.user.id,
      name: input.name,
      category: input.category,
      context: input.context,
      description: input.description ?? null,
      content: input.content,
      placeholders: JSON.stringify(placeholders)
    });
  }),
  update: protectedProcedure.input(
    z16.object({
      id: z16.number(),
      name: z16.string().optional(),
      category: categoryEnum.optional(),
      context: contextEnum.optional(),
      description: z16.string().optional(),
      content: z16.string().optional(),
      isFavorite: z16.boolean().optional()
    })
  ).mutation(async ({ ctx, input }) => {
    const { id, ...rest } = input;
    const data = { ...rest };
    if (rest.content)
      data.placeholders = JSON.stringify(extractPlaceholders(rest.content));
    await updateTemplate(id, ctx.user.id, data);
    return { success: true };
  }),
  remove: protectedProcedure.input(z16.object({ id: z16.number() })).mutation(async ({ ctx, input }) => {
    await deleteTemplate(input.id, ctx.user.id);
    return { success: true };
  }),
  // Standard-Vorlagen einmalig anlegen
  seedStarters: protectedProcedure.mutation(async ({ ctx }) => {
    const existing = await getTemplatesByUser(ctx.user.id);
    const existingNames = new Set(existing.map((t2) => t2.name));
    let added = 0;
    for (const t2 of STARTER_TEMPLATES) {
      if (existingNames.has(t2.name)) continue;
      await createTemplate({
        userId: ctx.user.id,
        name: t2.name,
        category: t2.category,
        context: t2.context,
        description: t2.description,
        content: t2.content,
        placeholders: JSON.stringify(extractPlaceholders(t2.content))
      });
      added++;
    }
    return { added };
  }),
  // Vorlage ausfüllen: bekannte Werte einsetzen, Rest von Jarvis ergänzen lassen
  fill: protectedProcedure.input(
    z16.object({
      id: z16.number(),
      values: z16.record(z16.string(), z16.string()),
      autoComplete: z16.boolean().default(false),
      extraContext: z16.string().optional()
    })
  ).mutation(async ({ ctx, input }) => {
    const tpl = await getTemplateById(input.id, ctx.user.id);
    if (!tpl)
      throw new TRPCError8({
        code: "NOT_FOUND",
        message: "Vorlage nicht gefunden."
      });
    let result = tpl.content;
    for (const [key, value] of Object.entries(input.values)) {
      const rx = new RegExp(
        `\\{\\{\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\}\\}`,
        "g"
      );
      result = result.replace(rx, value);
    }
    if (input.autoComplete) {
      const remaining = extractPlaceholders(result);
      if (remaining.length > 0) {
        const prompt = `Du bist Jarvis, der Assistent von Stefan Gross (Gross ICT und Leiter ICT im Kompetenzzentrum Sonnenberg in Baar).
F\xFClle im folgenden Dokument alle noch offenen Platzhalter in der Form {{Platzhalter}} mit plausiblen, professionellen Inhalten aus.
Schweizer Schreibweise: "ss" statt "\xDF", CHF als W\xE4hrung, Datumsformat dd.mm.yyyy.
Gib NUR das fertige Dokument zur\xFCck, ohne Erkl\xE4rungen und ohne Codeblock.

${input.extraContext ? `Zus\xE4tzlicher Kontext von Stefan:
${input.extraContext}

` : ""}Dokument:
${result}`;
        const resp = await invokeLLM({
          model: "claude-sonnet-4-5",
          max_tokens: 4e3,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          messages: [{ role: "user", content: prompt }]
        });
        const filled = resp.choices[0]?.message?.content ?? "";
        if (filled.trim()) result = filled.trim();
      }
    }
    await incrementTemplateUsage(input.id, ctx.user.id);
    return { content: result, name: tpl.name };
  })
});

// server/routers/delegation.ts
init_trpc();
init_db();
init_llm();
import { z as z17 } from "zod";
import { TRPCError as TRPCError9 } from "@trpc/server";
var statusEnum = z17.enum(["open", "in_progress", "done", "cancelled"]);
function formatDate(ts) {
  if (!ts) return "ohne festes Datum";
  return new Date(ts).toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}
var delegationRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return getDelegationsByUser(ctx.user.id);
  }),
  create: protectedProcedure.input(
    z17.object({
      assigneeName: z17.string().min(1),
      assigneeEmail: z17.string().email().optional(),
      title: z17.string().min(1),
      details: z17.string().optional(),
      dueDate: z17.number().optional(),
      generateEmail: z17.boolean().default(true)
    })
  ).mutation(async ({ ctx, input }) => {
    let emailDraft = null;
    if (input.generateEmail) {
      try {
        const profile = await getUserProfile(ctx.user.id);
        const senderName = profile?.displayName ?? ctx.user.name ?? "Stefan Gross";
        const prompt = `Schreibe eine kurze, freundliche und klare E-Mail auf Deutsch (Schweizer Schreibweise, "ss" statt "\xDF"), in der ${senderName} die folgende Aufgabe an ${input.assigneeName} delegiert.

Aufgabe: ${input.title}
${input.details ? `Details: ${input.details}` : ""}
Frist: ${formatDate(input.dueDate)}

Anforderungen an die E-Mail:
- Beginne mit einer Betreffzeile in der Form "Betreff: ..."
- Pers\xF6nliche Anrede
- Aufgabe pr\xE4zise beschreiben, damit klar ist, was erwartet wird
- Frist klar nennen
- Freundlicher Abschluss mit Grussformel und ${senderName}
- Maximal 180 W\xF6rter
Gib nur den E-Mail-Text zur\xFCck, ohne weitere Erkl\xE4rungen.`;
        const resp = await invokeLLM({
          model: "claude-sonnet-4-5",
          max_tokens: 900,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          messages: [{ role: "user", content: prompt }]
        });
        emailDraft = resp.choices[0]?.message?.content ?? null;
      } catch (e) {
        console.error("[Delegation] E-Mail-Entwurf fehlgeschlagen:", e);
      }
    }
    return createDelegation({
      userId: ctx.user.id,
      assigneeName: input.assigneeName,
      assigneeEmail: input.assigneeEmail ?? null,
      title: input.title,
      details: input.details ?? null,
      dueDate: input.dueDate ?? null,
      emailDraft
    });
  }),
  update: protectedProcedure.input(
    z17.object({
      id: z17.number(),
      status: statusEnum.optional(),
      title: z17.string().optional(),
      details: z17.string().optional(),
      dueDate: z17.number().nullable().optional(),
      assigneeName: z17.string().optional(),
      assigneeEmail: z17.string().optional(),
      emailDraft: z17.string().optional(),
      markEmailSent: z17.boolean().optional()
    })
  ).mutation(async ({ ctx, input }) => {
    const { id, markEmailSent, ...rest } = input;
    const data = { ...rest };
    if (markEmailSent) data.emailSentAt = Date.now();
    await updateDelegation(id, ctx.user.id, data);
    return { success: true };
  }),
  remove: protectedProcedure.input(z17.object({ id: z17.number() })).mutation(async ({ ctx, input }) => {
    await deleteDelegation(input.id, ctx.user.id);
    return { success: true };
  }),
  regenerateEmail: protectedProcedure.input(
    z17.object({
      id: z17.number(),
      tone: z17.enum(["freundlich", "sachlich", "dringend"]).default("freundlich")
    })
  ).mutation(async ({ ctx, input }) => {
    const all = await getDelegationsByUser(ctx.user.id);
    const d = all.find((x) => x.id === input.id);
    if (!d)
      throw new TRPCError9({
        code: "NOT_FOUND",
        message: "Delegation nicht gefunden."
      });
    const profile = await getUserProfile(ctx.user.id);
    const senderName = profile?.displayName ?? ctx.user.name ?? "Stefan Gross";
    const prompt = `Schreibe eine E-Mail auf Deutsch (Schweizer Schreibweise) im Tonfall "${input.tone}", in der ${senderName} die Aufgabe "${d.title}" an ${d.assigneeName} delegiert.
${d.details ? `Details: ${d.details}` : ""}
Frist: ${formatDate(d.dueDate)}
Beginne mit "Betreff: ", danach der E-Mail-Text. Maximal 180 W\xF6rter. Gib nur die E-Mail zur\xFCck.`;
    const resp = await invokeLLM({
      model: "claude-sonnet-4-5",
      max_tokens: 900,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: [{ role: "user", content: prompt }]
    });
    const emailDraft = resp.choices[0]?.message?.content ?? "";
    await updateDelegation(input.id, ctx.user.id, { emailDraft });
    return { emailDraft };
  })
});

// server/routers/voiceNotes.ts
init_trpc();
init_db();
init_llm();
import { z as z18 } from "zod";
var ELEVENLABS_KEY3 = process.env.ELEVENLABS_API_KEY ?? "";
async function transcribeWithElevenLabs(audioBase64, mimeType) {
  const audioBuffer = Buffer.from(audioBase64, "base64");
  const blob = new Blob([audioBuffer], { type: mimeType });
  const formData = new FormData();
  formData.append("file", blob, `audio.${mimeType.split("/")[1] ?? "webm"}`);
  formData.append("model_id", "scribe_v1");
  formData.append("language_code", "deu");
  const resp = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": ELEVENLABS_KEY3 },
    body: formData
  });
  if (!resp.ok) throw new Error(`Transkription fehlgeschlagen: ${resp.status}`);
  const result = await resp.json();
  return result.text ?? result.words?.map((w) => w.text).join(" ") ?? "";
}
async function analyseTranscript(transcript) {
  const prompt = `Analysiere die folgende Sprachnotiz von Stefan Gross (Leiter ICT im Kompetenzzentrum Sonnenberg Baar und Inhaber von Gross ICT).

Sprachnotiz: "${transcript}"

Antworte AUSSCHLIESSLICH mit einem JSON-Objekt in genau dieser Form, ohne Codeblock und ohne weitere Erkl\xE4rung:
{"summary":"ein bis zwei S\xE4tze Zusammenfassung","category":"eine von: Gross ICT, Sonnenberg, Idee, Termin, Aufgabe, Kontakt, Allgemein","isTask":true oder false,"taskTitle":"kurzer Aufgabentitel falls isTask true, sonst leer","dueHint":"genannte Frist im Klartext falls vorhanden, sonst leer"}

Schweizer Schreibweise verwenden ("ss" statt "\xDF").`;
  try {
    const resp = await invokeLLM({
      model: "claude-sonnet-4-5",
      max_tokens: 500,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: [{ role: "user", content: prompt }]
    });
    const raw = (resp.choices[0]?.message?.content ?? "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const parsed2 = JSON.parse(raw);
    return {
      summary: parsed2.summary ?? transcript.slice(0, 140),
      category: parsed2.category ?? "Allgemein",
      isTask: Boolean(parsed2.isTask),
      taskTitle: parsed2.taskTitle || void 0,
      dueHint: parsed2.dueHint || void 0
    };
  } catch (e) {
    console.error("[VoiceNotes] Analyse fehlgeschlagen:", e);
    return {
      summary: transcript.slice(0, 140),
      category: "Allgemein",
      isTask: false
    };
  }
}
var voiceNotesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return getVoiceNotesByUser(ctx.user.id);
  }),
  // Audio hochladen, transkribieren, analysieren und speichern
  record: protectedProcedure.input(
    z18.object({
      audioBase64: z18.string(),
      mimeType: z18.string().default("audio/webm"),
      durationSec: z18.number().optional(),
      autoCreateTask: z18.boolean().default(true),
      alsoSaveAsNote: z18.boolean().default(true)
    })
  ).mutation(async ({ ctx, input }) => {
    const transcript = await transcribeWithElevenLabs(
      input.audioBase64,
      input.mimeType
    );
    if (!transcript.trim()) {
      return {
        transcript: "",
        summary: "",
        category: "Allgemein",
        createdTask: false,
        createdNote: false,
        id: 0
      };
    }
    const analysis = await analyseTranscript(transcript);
    let noteId = null;
    let taskId = null;
    if (input.alsoSaveAsNote) {
      try {
        const title = analysis.summary.slice(0, 80) || "Sprachnotiz";
        const res = await createNote({
          userId: ctx.user.id,
          title,
          content: `${transcript}

---
*Sprachnotiz vom ${(/* @__PURE__ */ new Date()).toLocaleString("de-CH", { timeZone: "Europe/Zurich" })}*`,
          tags: `Sprachnotiz,${analysis.category}`
        });
        noteId = res?.id ?? null;
      } catch (e) {
        console.error("[VoiceNotes] Notiz anlegen fehlgeschlagen:", e);
      }
    }
    if (input.autoCreateTask && analysis.isTask && analysis.taskTitle) {
      try {
        const res = await createTask({
          userId: ctx.user.id,
          title: analysis.taskTitle,
          description: `Aus Sprachnotiz: ${transcript}${analysis.dueHint ? `
Frist laut Notiz: ${analysis.dueHint}` : ""}`
        });
        taskId = res?.id ?? null;
      } catch (e) {
        console.error("[VoiceNotes] Aufgabe anlegen fehlgeschlagen:", e);
      }
    }
    const created = await createVoiceNote({
      userId: ctx.user.id,
      transcript,
      summary: analysis.summary,
      category: analysis.category,
      durationSec: input.durationSec ?? null,
      noteId,
      taskId
    });
    return {
      id: created.id,
      transcript,
      summary: analysis.summary,
      category: analysis.category,
      createdTask: taskId !== null,
      createdNote: noteId !== null
    };
  }),
  remove: protectedProcedure.input(z18.object({ id: z18.number() })).mutation(async ({ ctx, input }) => {
    await deleteVoiceNote(input.id, ctx.user.id);
    return { success: true };
  })
});

// server/routers/webhooks.ts
init_trpc();
init_db();
import { z as z19 } from "zod";
import { randomBytes } from "crypto";
var webhooksRouter = router({
  listKeys: protectedProcedure.query(async ({ ctx }) => {
    return getWebhookKeysByUser(ctx.user.id);
  }),
  createKey: protectedProcedure.input(z19.object({ label: z19.string().min(1).max(120) })).mutation(async ({ ctx, input }) => {
    const apiKey = `jv_${randomBytes(24).toString("hex")}`;
    return createWebhookKey(ctx.user.id, input.label, apiKey);
  }),
  removeKey: protectedProcedure.input(z19.object({ id: z19.number() })).mutation(async ({ ctx, input }) => {
    await deleteWebhookKey(input.id, ctx.user.id);
    return { success: true };
  }),
  listEvents: protectedProcedure.input(
    z19.object({ limit: z19.number().min(1).max(200).default(50) }).optional()
  ).query(async ({ ctx, input }) => {
    return getWebhookEventsByUser(ctx.user.id, input?.limit ?? 50);
  })
});

// server/routers.ts
init_spotify();
init_deviceCommands();
init_news();
var appRouter = router({
  system: systemRouter,
  news: newsRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true
      };
    })
  }),
  chat: chatRouter,
  notes: notesRouter,
  tasks: tasksRouter,
  notifications: notificationsRouter,
  calendar: calendarRouter,
  memory: memoryRouter,
  profile: profileRouter,
  grossIct: grossIctRouter,
  sonnenberg: sonnenbergRouter,
  appDashboard: appDashboardRouter,
  elevenlabs: elevenLabsRouter,
  templates: templatesRouter,
  delegation: delegationRouter,
  voiceNotes: voiceNotesRouter,
  webhooks: webhooksRouter,
  spotify: spotifyRouter,
  device: deviceRouter
});

// server/_core/index.ts
init_context();

// server/_core/serveStatic.ts
import express from "express";
import fs from "fs";
import path2 from "path";
function serveStatic(app) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/routers/googleOAuth.ts
init_db();
init_baseUrl();
async function handleGoogleOAuthCallback(req, res) {
  try {
    const { code, state, error } = req.query;
    if (error) {
      return res.redirect(`/calendar?error=${encodeURIComponent(error)}`);
    }
    if (!code || !state) {
      return res.redirect("/calendar?error=missing_params");
    }
    const stateStr = Buffer.from(state, "base64").toString("utf-8");
    let userId = null;
    try {
      userId = JSON.parse(stateStr).userId;
    } catch (e) {
      console.error("[Google OAuth] Invalid state JSON:", e);
    }
    if (!userId) {
      return res.redirect("/calendar?error=invalid_state");
    }
    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        code,
        grant_type: "authorization_code",
        // Muss exakt der redirect_uri aus der Auth-URL (calendar.getAuthUrl)
        // entsprechen – beide leiten sich aus derselben Basis-URL ab.
        redirect_uri: getGoogleRedirectUri(req)
      })
    });
    const tokenData = await tokenResp.json();
    if (!tokenResp.ok || !tokenData.access_token) {
      console.error("[Google OAuth] Token-Fehler:", tokenData);
      return res.redirect(
        `/calendar?error=${encodeURIComponent(tokenData.error ?? "token_error")}`
      );
    }
    let email = null;
    try {
      const userInfoResp = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: { Authorization: `Bearer ${tokenData.access_token}` }
        }
      );
      const userInfo = await userInfoResp.json();
      email = userInfo.email ?? null;
    } catch {
    }
    if (!email) {
      console.error("[Google OAuth] No email found in profile");
      return res.redirect("/calendar?error=no_email");
    }
    await upsertGoogleToken({
      userId,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token ?? null,
      expiresAt: Math.floor(Date.now() / 1e3) + (tokenData.expires_in ?? 3600),
      scope: tokenData.scope ?? null,
      email
    });
    return res.redirect("/calendar?connected=true");
  } catch (err) {
    console.error("[Google OAuth Callback Error]", err);
    return res.redirect("/calendar?error=server_error");
  }
}

// server/routers/msOAuth.ts
init_db();
init_baseUrl();
async function handleMsOAuthCallback(req, res) {
  try {
    const { code, state, error, error_description } = req.query;
    if (error) {
      console.error("[MS OAuth] Error:", error, error_description);
      return res.redirect("/calendar?error=" + encodeURIComponent(error));
    }
    if (!code || !state) {
      return res.redirect("/calendar?error=missing_code");
    }
    const stateStr = Buffer.from(state, "base64").toString("utf-8");
    const stateObj = JSON.parse(stateStr);
    const userId = stateObj.userId;
    if (!userId) {
      return res.redirect("/calendar?error=invalid_state");
    }
    const tokenResp = await fetch(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.MS_CLIENT_ID ?? "",
          client_secret: process.env.MS_CLIENT_SECRET ?? "",
          code,
          grant_type: "authorization_code",
          redirect_uri: getMsRedirectUri(req)
        })
      }
    );
    if (!tokenResp.ok) {
      const err = await tokenResp.text();
      console.error("[MS OAuth] Token error:", err);
      return res.redirect("/calendar?error=token_failed");
    }
    const data = await tokenResp.json();
    const { access_token, refresh_token, expires_in, scope } = data;
    const expiresAt = Math.floor(Date.now() / 1e3) + expires_in;
    const profileResp = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    let email = null;
    if (profileResp.ok) {
      const profile = await profileResp.json();
      email = profile.mail || profile.userPrincipalName || null;
    }
    if (!email) {
      console.error("[MS OAuth] No email found in profile");
      return res.redirect("/calendar?error=no_email");
    }
    await upsertMicrosoftToken({
      userId: Number(userId),
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt,
      scope,
      email
    });
    res.redirect("/calendar?success=ms");
  } catch (err) {
    console.error("[MS OAuth] Callback error:", err);
    res.redirect("/calendar?error=internal_error");
  }
}

// server/routers/morningBriefing.ts
init_sdk();
init_db();
init_schema();
init_db();
import { and as and3, eq as eq3, isNull, or as or2, lte } from "drizzle-orm";
async function getTodayEvents(userId) {
  try {
    const token = await getGoogleToken(userId);
    if (!token) return [];
    let accessToken = token.accessToken;
    if (token.expiresAt <= Math.floor(Date.now() / 1e3) + 60 && token.refreshToken) {
      const rr = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          refresh_token: token.refreshToken,
          grant_type: "refresh_token"
        })
      });
      const rd = await rr.json();
      if (rd.access_token) {
        accessToken = rd.access_token;
        await upsertGoogleToken({
          userId,
          accessToken,
          expiresAt: Math.floor(Date.now() / 1e3) + (rd.expires_in ?? 3600),
          refreshToken: token.refreshToken,
          email: token.email
        });
      }
    }
    const tz = "Europe/Zurich";
    const now = /* @__PURE__ */ new Date();
    const todayStart = /* @__PURE__ */ new Date(
      now.toLocaleDateString("en-CA", { timeZone: tz }) + "T00:00:00+02:00"
    );
    const todayEnd = /* @__PURE__ */ new Date(
      now.toLocaleDateString("en-CA", { timeZone: tz }) + "T23:59:59+02:00"
    );
    const resp = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=10&timeMin=${encodeURIComponent(todayStart.toISOString())}&timeMax=${encodeURIComponent(todayEnd.toISOString())}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await resp.json();
    if (!data.items || data.items.length === 0) return [];
    return data.items.map((ev) => {
      const d = new Date(ev.start?.dateTime ?? ev.start?.date ?? "");
      const timeStr = ev.start?.dateTime ? d.toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: tz
      }) : "Ganzt\xE4gig";
      const inviteStr = ev.organizer && !ev.organizer.self ? ` (Einladung von ${ev.organizer.displayName || ev.organizer.email?.split("@")[0] || "jemanden"})` : "";
      return `${timeStr}: ${ev.summary ?? "Termin"}${inviteStr}`;
    });
  } catch (e) {
    console.error("[MorningBriefing] Kalender-Fehler:", e);
    return [];
  }
}
async function getTodayTasks(userId) {
  try {
    const db = await getDb();
    if (!db) return [];
    const now = Date.now();
    const todayEnd = /* @__PURE__ */ new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const openTasks = await db.select().from(tasks).where(
      and3(
        eq3(tasks.userId, userId),
        eq3(tasks.completed, false),
        or2(isNull(tasks.dueDate), lte(tasks.dueDate, todayEnd.getTime()))
      )
    ).limit(10);
    return openTasks.map((t2) => {
      const priority = t2.priority === "high" ? "\u{1F534}" : t2.priority === "medium" ? "\u{1F7E1}" : "\u{1F7E2}";
      return `${priority} ${t2.title}`;
    });
  } catch (e) {
    console.error("[MorningBriefing] Aufgaben-Fehler:", e);
    return [];
  }
}
async function handleMorningBriefing(req, res) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) {
      return res.status(403).json({ error: "cron-only" });
    }
    const db = await getDb();
    if (!db) return res.json({ ok: true, skipped: "no-db" });
    const ownerOpenId = process.env.OWNER_OPEN_ID;
    if (!ownerOpenId) return res.json({ ok: true, skipped: "no-owner" });
    const ownerRows = await db.select().from(users).where(eq3(users.openId, ownerOpenId)).limit(1);
    if (!ownerRows[0])
      return res.json({ ok: true, skipped: "owner-not-found" });
    const ownerId = ownerRows[0].id;
    const ownerName = ownerRows[0].name ?? "Stefan";
    const [events, todayTasks] = await Promise.all([
      getTodayEvents(ownerId),
      getTodayTasks(ownerId)
    ]);
    const today = (/* @__PURE__ */ new Date()).toLocaleDateString("de-DE", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Europe/Zurich"
    });
    let body = `Guten Morgen, Sir. Ihre Lagebeurteilung f\xFCr ${today}:

`;
    if (events.length > 0) {
      const kommentar = events.length >= 6 ? "Ein durchaus ambitionierter Tagesplan." : events.length >= 4 ? "Gut gef\xFCllt, aber beherrschbar." : "";
      body += `\u{1F4C5} **Termine heute (${events.length}):** ${kommentar}
${events.map((e) => `\u2022 ${e}`).join("\n")}

`;
    } else {
      body += `\u{1F4C5} Keine Termine heute, Sir. Eine Seltenheit, die man nutzen sollte.

`;
    }
    if (todayTasks.length > 0) {
      body += `\u2705 **Offene Aufgaben (${todayTasks.length}):**
${todayTasks.map((t2) => `\u2022 ${t2}`).join("\n")}`;
    } else {
      body += `\u2705 Keine offenen Aufgaben f\xFCr heute. Meinen Aufzeichnungen zufolge ein tadelloser Zustand.`;
    }
    await notifyOwner({
      title: `\u2600\uFE0F Morgen-Briefing, Sir \u2013 ${today}`,
      content: body
    });
    console.log(
      `[MorningBriefing] Briefing gesendet f\xFCr ${ownerName}: ${events.length} Termine, ${todayTasks.length} Aufgaben`
    );
    res.json({ ok: true, events: events.length, tasks: todayTasks.length });
  } catch (e) {
    console.error("[MorningBriefing] Fehler:", e);
    res.status(500).json({ error: String(e) });
  }
}

// server/routers/weeklyReport.ts
init_sdk();
init_db();
init_schema();
import { and as and4, eq as eq4, gte } from "drizzle-orm";
init_llm();
init_persona();
init_appIntegration();
async function handleWeeklyReport(req, res) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });
    const db = await getDb();
    if (!db) return res.json({ ok: true, skipped: "no-db" });
    const ownerOpenId = process.env.OWNER_OPEN_ID;
    if (!ownerOpenId) return res.json({ ok: true, skipped: "no-owner" });
    const ownerRows = await db.select().from(users).where(eq4(users.openId, ownerOpenId)).limit(1);
    if (!ownerRows[0])
      return res.json({ ok: true, skipped: "owner-not-found" });
    const ownerId = ownerRows[0].id;
    const ownerName = ownerRows[0].name ?? "Stefan";
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3);
    const allTasks = await db.select().from(tasks).where(eq4(tasks.userId, ownerId));
    const doneThisWeek = allTasks.filter(
      (t2) => t2.completed && t2.updatedAt >= weekAgo
    );
    const stillOpen = allTasks.filter((t2) => !t2.completed);
    const overdueTasks = stillOpen.filter(
      (t2) => t2.dueDate && t2.dueDate < Date.now()
    );
    const weekNotes = await db.select().from(notes).where(and4(eq4(notes.userId, ownerId), gte(notes.createdAt, weekAgo)));
    const weekVoiceNotes = await db.select().from(voiceNotes).where(
      and4(eq4(voiceNotes.userId, ownerId), gte(voiceNotes.createdAt, weekAgo))
    );
    const openDelegations = (await db.select().from(delegations).where(eq4(delegations.userId, ownerId))).filter((d) => d.status === "open" || d.status === "in_progress");
    let appSummary = "";
    try {
      appSummary = await executeAppAction("dashboard", {});
    } catch (e) {
      console.error("[WeeklyReport] App-Dashboard nicht erreichbar:", e);
    }
    const kw = (() => {
      const d = /* @__PURE__ */ new Date();
      const target = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
      );
      const dayNr = (target.getUTCDay() + 6) % 7;
      target.setUTCDate(target.getUTCDate() - dayNr + 3);
      const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
      const diff = target.getTime() - firstThursday.getTime();
      return 1 + Math.round(diff / (7 * 24 * 3600 * 1e3));
    })();
    const facts = `Erledigte Aufgaben diese Woche: ${doneThisWeek.length}
${doneThisWeek.slice(0, 12).map((t2) => `- ${t2.title}`).join("\n")}

Noch offene Aufgaben: ${stillOpen.length} (davon \xFCberf\xE4llig: ${overdueTasks.length})
${overdueTasks.slice(0, 8).map((t2) => `- \xDCBERF\xC4LLIG: ${t2.title}`).join("\n")}
${stillOpen.filter((t2) => !overdueTasks.includes(t2)).slice(0, 8).map((t2) => `- ${t2.title}`).join("\n")}

Neue Notizen: ${weekNotes.length}
Neue Sprachnotizen: ${weekVoiceNotes.length}
Offene Delegationen: ${openDelegations.length}
${openDelegations.slice(0, 6).map((d) => `- ${d.title} \u2192 ${d.assigneeName}`).join("\n")}

${appSummary ? `Aktuelle Zahlen aus der Gross ICT App:
${appSummary}` : ""}`;
    let body = "";
    try {
      const prompt = `Du bist Jarvis, der pers\xF6nliche Assistent von ${ownerName} (Leiter ICT im Kompetenzzentrum Sonnenberg Baar und Inhaber von Gross ICT).
Schreibe einen kompakten Wochenr\xFCckblick f\xFCr Kalenderwoche ${kw} auf Deutsch in Schweizer Schreibweise ("ss" statt "\xDF", CHF, Datumsformat dd.mm.yyyy).

Struktur:
1. Ein Satz Gesamtfazit der Woche
2. "Erledigt" \u2013 die wichtigsten Erfolge (Stichworte)
3. "Offen und dringend" \u2013 was n\xE4chste Woche Priorit\xE4t hat
4. "Empfehlung" \u2013 zwei bis drei konkrete Vorschl\xE4ge f\xFCr n\xE4chste Woche

${JARVIS_PERSONA_SHORT}

Maximal 250 W\xF6rter, keine erfundenen Zahlen. Nutze nur die folgenden Fakten:

${facts}`;
      const resp = await invokeLLM({
        model: "claude-sonnet-4-5",
        max_tokens: 1200,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: [{ role: "user", content: prompt }]
      });
      body = resp.choices[0]?.message?.content ?? "";
    } catch (e) {
      console.error("[WeeklyReport] LLM-Fehler:", e);
    }
    if (!body.trim()) body = `Wochenr\xFCckblick KW ${kw}

${facts}`;
    await notifyOwner({
      title: `\u{1F4CA} Jarvis Wochenbericht \u2013 KW ${kw}`,
      content: body
    });
    res.json({
      ok: true,
      kw,
      done: doneThisWeek.length,
      open: stillOpen.length,
      overdue: overdueTasks.length
    });
  } catch (e) {
    console.error("[WeeklyReport] Fehler:", e);
    res.status(500).json({
      error: String(e),
      stack: e instanceof Error ? e.stack : void 0,
      timestamp: Date.now()
    });
  }
}

// server/routers/webhookEndpoint.ts
init_db();
async function handleJarvisWebhook(req, res) {
  try {
    const headerKey = req.headers["x-jarvis-key"] ?? (typeof req.headers.authorization === "string" && req.headers.authorization.startsWith("Bearer ") ? req.headers.authorization.slice(7) : void 0);
    if (!headerKey) {
      return res.status(401).json({ error: "API-Schl\xFCssel fehlt. Header X-Jarvis-Key setzen." });
    }
    const keyRow = await findWebhookKey(headerKey.trim());
    if (!keyRow || !keyRow.isActive) {
      return res.status(401).json({ error: "Ung\xFCltiger oder deaktivierter API-Schl\xFCssel." });
    }
    const body = req.body ?? {};
    const title = (body.title ?? "Jarvis-Ereignis").toString().slice(0, 240);
    const content = (body.body ?? body.message ?? "").toString().slice(0, 8e3);
    const source = (body.source ?? keyRow.label).toString().slice(0, 120);
    const shouldNotify = body.notify !== false;
    let notified = false;
    if (shouldNotify) {
      try {
        await notifyOwner({
          title: `\u{1F514} ${title}`,
          content: content || `Ereignis von ${source}`
        });
        notified = true;
      } catch (e) {
        console.error("[Webhook] Benachrichtigung fehlgeschlagen:", e);
      }
    }
    await createWebhookEvent(
      keyRow.userId,
      source,
      title,
      content || null,
      notified
    );
    await touchWebhookKey(keyRow.id, keyRow.callCount);
    res.json({ ok: true, notified });
  } catch (e) {
    console.error("[Webhook] Fehler:", e);
    res.status(500).json({ error: String(e) });
  }
}

// server/_core/index.ts
init_spotify();

// server/routers/deviceEndpoint.ts
init_db();
async function authenticate(req) {
  const key = req.query.key ?? req.headers["x-api-key"] ?? req.headers.authorization?.replace(/^Bearer\s+/i, "") ?? void 0;
  if (!key) return null;
  const row = await findWebhookKey(key);
  if (!row || !row.isActive) return null;
  await touchWebhookKey(row.id, row.callCount);
  return row;
}
async function handleDeviceCommandsFetch(req, res) {
  try {
    const keyRow = await authenticate(req);
    if (!keyRow)
      return res.status(401).json({ error: "Ung\xFCltiger API-Schl\xFCssel" });
    const rows = await claimPendingDeviceCommands(keyRow.userId, 10);
    const commands = rows.map((r) => {
      let params = {};
      try {
        params = JSON.parse(r.payload);
      } catch {
      }
      return { id: r.id, type: r.type, summary: r.summary ?? "", ...params };
    });
    return res.json({
      count: commands.length,
      commands,
      first: commands[0] ?? null
    });
  } catch (err) {
    console.error("[Device Commands Fetch]", err);
    return res.status(500).json({ error: "Serverfehler" });
  }
}
async function handleDeviceCommandDone(req, res) {
  try {
    const keyRow = await authenticate(req);
    if (!keyRow)
      return res.status(401).json({ error: "Ung\xFCltiger API-Schl\xFCssel" });
    const body = req.body ?? {};
    const id = typeof body.id === "string" ? parseInt(body.id, 10) : body.id;
    if (!id || Number.isNaN(id))
      return res.status(400).json({ error: "id fehlt" });
    await markDeviceCommandDone(
      id,
      keyRow.userId,
      body.status === "failed" ? "failed" : "done"
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error("[Device Command Done]", err);
    return res.status(500).json({ error: "Serverfehler" });
  }
}

// server/routers/ttsStream.ts
init_db();
var ELEVENLABS_KEY4 = process.env.ELEVENLABS_API_KEY ?? "";
var JARVIS_VOICE_ID2 = "JBFqnCBsd6RMkjVDRZzb";
async function handleTtsStream(req, res, userId) {
  try {
    const src = req.method === "GET" ? req.query ?? {} : req.body ?? {};
    const body = src;
    const rawText = (body.text ?? "").trim();
    if (!rawText) {
      res.status(400).json({ error: "Kein Text \xFCbergeben" });
      return;
    }
    const openAiKey = process.env.OPENAI_API_KEY ?? "";
    const useOpenAI = Boolean(openAiKey);
    let state = {
      remaining: 9999999,
      limit: 9999999,
      percentUsed: 0,
      charsUsed: 0,
      level: "green"
    };
    let live = null;
    if (!useOpenAI) {
      live = await fetchLiveQuota();
      const localUsed = await getTtsUsage(userId, currentYearMonth());
      state = live ?? budgetState(localUsed);
      if (state.remaining <= 0) {
        res.status(429).json({
          error: "Sprachausgabe-Guthaben aufgebraucht",
          remaining: 0,
          resetAt: live?.resetAt ?? null
        });
        return;
      }
    }
    if (body.checkOnly === true || body.checkOnly === "true") {
      res.status(200).json({
        ok: true,
        remaining: state.remaining,
        resetAt: live?.resetAt ?? null
      });
      return;
    }
    const shorten = body.shorten !== false && body.shorten !== "false";
    const limit = Math.min(
      shorten ? MAX_CHARS_PER_SPEECH : 2500,
      state.remaining
    );
    const { spoken } = shorten ? shortenForSpeech(rawText, limit) : { spoken: rawText.slice(0, limit) };
    if (!spoken) {
      res.status(400).json({ error: "Kein sprechbarer Text vorhanden" });
      return;
    }
    let upstream;
    if (useOpenAI) {
      upstream = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "tts-1",
          input: spoken,
          voice: "onyx",
          response_format: "mp3"
        })
      });
    } else {
      const voiceId = body.voiceId || JARVIS_VOICE_ID2;
      const url = new URL(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`
      );
      url.searchParams.set("optimize_streaming_latency", "4");
      url.searchParams.set("output_format", "mp3_22050_32");
      upstream = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_KEY4,
          "Content-Type": "application/json",
          Accept: "audio/mpeg"
        },
        body: JSON.stringify({
          text: spoken,
          model_id: "eleven_flash_v2_5",
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.8,
            style: 0,
            use_speaker_boost: false
          }
        })
      });
    }
    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text().catch(() => "");
      console.error("[TTS-Stream]", upstream.status, errText.slice(0, 300));
      if (!useOpenAI && errText.includes("quota_exceeded")) {
        invalidateQuotaCache();
        res.status(429).json({ error: "Sprachausgabe-Guthaben aufgebraucht" });
        return;
      }
      let errorMessage = `Sprachausgabe fehlgeschlagen (${upstream.status})`;
      try {
        const parsed2 = JSON.parse(errText);
        if (parsed2.error && parsed2.error.message) {
          errorMessage = `OpenAI API Fehler: ${parsed2.error.message}`;
        }
      } catch (e) {
      }
      res.status(502).json({ error: errorMessage, details: errText.slice(0, 500) });
      return;
    }
    const total = await addTtsUsage(userId, currentYearMonth(), spoken.length);
    const usage = useOpenAI ? state : budgetState(total);
    res.status(200);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Tts-Chars-Used", String(usage.charsUsed));
    res.setHeader("X-Tts-Remaining", String(usage.remaining));
    res.setHeader("X-Tts-Level", usage.level);
    res.setHeader("X-Tts-Percent", String(usage.percentUsed));
    res.setHeader("X-Tts-Limit", String(usage.limit));
    const reader = upstream.body.getReader();
    for (; ; ) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) res.write(Buffer.from(value));
    }
    res.end();
  } catch (e) {
    console.error("[TTS-Stream] Fehler:", e);
    if (!res.headersSent)
      res.status(500).json({ error: "Sprachausgabe fehlgeschlagen" });
    else res.end();
  }
}

// server/_core/index.ts
if (process.env.NODE_OPTIONS?.includes("listen_systemd_fd") || process.env.LISTEN_FDS) {
  process.env.NODE_ENV = "production";
}
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function startServer() {
  validateEnv();
  const app = express3();
  const server = createServer(app);
  app.use(httpLogger);
  app.use(express3.json({ limit: "50mb" }));
  app.use(express3.urlencoded({ limit: "50mb", extended: true }));
  const health = (_req, res) => res.json({ status: "ok", uptime: process.uptime() });
  app.get("/health", health);
  app.get("/api/health", health);
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.use("/api/auth/login", publicEndpointLimiter);
  registerLocalAuthRoutes(app);
  app.get("/api/oauth/google/callback", handleGoogleOAuthCallback);
  app.get("/api/oauth/ms/callback", handleMsOAuthCallback);
  app.get("/api/oauth/spotify/callback", handleSpotifyOAuthCallback);
  app.post(
    "/api/tts/stream",
    ttsLimiter,
    async (req, res) => {
      const ctx = await createContext({ req, res });
      if (!ctx.user) {
        res.status(401).json({ error: "Nicht authentifiziert" });
        return;
      }
      await handleTtsStream(req, res, ctx.user.id);
    }
  );
  app.get(
    "/api/tts/stream",
    ttsLimiter,
    async (req, res) => {
      const ctx = await createContext({ req, res });
      if (!ctx.user) {
        res.status(401).json({ error: "Nicht authentifiziert" });
        return;
      }
      await handleTtsStream(req, res, ctx.user.id);
    }
  );
  const { handleChatStream: handleChatStream2 } = await Promise.resolve().then(() => (init_streamEndpoint(), streamEndpoint_exports));
  app.post("/api/chat/stream", handleChatStream2);
  app.post("/api/scheduled/morning-briefing", handleMorningBriefing);
  app.post("/api/scheduled/weekly-report", handleWeeklyReport);
  app.post("/api/webhook/jarvis", publicEndpointLimiter, handleJarvisWebhook);
  app.get(
    "/api/device/commands",
    publicEndpointLimiter,
    handleDeviceCommandsFetch
  );
  app.post(
    "/api/device/commands/done",
    publicEndpointLimiter,
    handleDeviceCommandDone
  );
  app.use(
    "/api/trpc",
    apiLimiter,
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  if (process.env.NODE_ENV === "development") {
    const { setupVite: setupVite2 } = await Promise.resolve().then(() => (init_vite(), vite_exports));
    await setupVite2(app, server);
  } else {
    serveStatic(app);
  }
  Promise.resolve().then(() => (init_backgroundTasks(), backgroundTasks_exports)).then((m) => m.startBackgroundWorker()).catch((err) => logger.error({ err }, "Failed to start background worker"));
  const argPort = process.argv.slice(2).find((a) => /^\d{2,5}$/.test(a));
  const envPort = process.env.PORT || argPort;
  const hatSystemdShim = (process.env.NODE_OPTIONS ?? "").includes(
    "listen_systemd_fd"
  );
  const hatSocketActivation = Boolean(process.env.LISTEN_FDS);
  if (hatSystemdShim || hatSocketActivation) {
    const ziel = hatSystemdShim ? Number(envPort) || 3e3 : { fd: 3 };
    server.listen(ziel, () => {
      logger.info("Server running (systemd socket activation)");
    });
    return;
  }
  if (envPort) {
    const listenTarget = /^\d+$/.test(envPort) ? Number(envPort) : envPort;
    const quelle = process.env.PORT ? "PORT-Variable" : "Aufrufargument";
    server.listen(listenTarget, () => {
      logger.info(
        `Server running (listening on ${listenTarget}, via ${quelle})`
      );
    });
  } else {
    const port = await findAvailablePort(3e3);
    logger.warn(
      `Kein Port vorgegeben (weder PORT noch Argument) \u2013 nutze automatisch ${port}. Hinter einem Webserver ist das meist die Ursache f\xFCr 503.`
    );
    server.listen(port, () => {
      logger.info(`Server running on http://localhost:${port}/`);
    });
  }
}
startServer().catch((err) => {
  logger.error({ err }, "Server failed to start");
  const fallbackServer = createServer((req, res) => {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end(
      "Server failed to start: " + (err instanceof Error ? err.stack : String(err))
    );
  });
  const envPort = process.env.PORT || process.argv.slice(2).find((a) => /^\d{2,5}$/.test(a));
  const hatSystemdShim = (process.env.NODE_OPTIONS ?? "").includes(
    "listen_systemd_fd"
  );
  const hatSocketActivation = Boolean(process.env.LISTEN_FDS);
  if (hatSystemdShim || hatSocketActivation) {
    fallbackServer.listen({ fd: 3 });
  } else if (envPort) {
    const listenTarget = /^\d+$/.test(envPort) ? Number(envPort) : envPort;
    fallbackServer.listen(listenTarget);
  } else {
    fallbackServer.listen(3e3);
  }
});
