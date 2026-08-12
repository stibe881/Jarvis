import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertConversation,
  InsertMessage,
  InsertNote,
  InsertTask,
  conversations,
  messages,
  notes,
  tasks,
  InsertUser,
  users,
} from "../drizzle/schema";
import {
  googleTokens,
  memories,
  userProfiles,
  InsertUserProfile,
} from "../drizzle/schema";
import {
  documentTemplates,
  InsertDocumentTemplate,
  delegations,
  InsertDelegation,
  voiceNotes,
  InsertVoiceNote,
  promptStats,
  webhookKeys,
  webhookEvents,
} from "../drizzle/schema";
import { spotifyTokens, deviceCommands, ttsUsage } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
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

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ─── Conversations ────────────────────────────────────────────────────────────

export async function createConversation(data: InsertConversation) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(conversations).values(data).$returningId();
  return result;
}

export async function getConversationsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt));
}

export async function getConversationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id))
    .limit(1);
  return result[0];
}

export async function updateConversationTitle(id: number, title: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(conversations).set({ title }).where(eq(conversations.id, id));
}

export async function deleteConversation(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(messages).where(eq(messages.conversationId, id));
  await db.delete(conversations).where(eq(conversations.id, id));
}

// ─── Messages ────────────────────────────────────────────────────────────────

export async function addMessage(data: InsertMessage) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(messages).values(data).$returningId();
  return result;
}

export async function getMessagesByConversation(conversationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);
}

// ─── Notes ────────────────────────────────────────────────────────────────────

export async function createNote(data: InsertNote) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(notes).values(data).$returningId();
  return result;
}

export async function getNotesByUser(userId: number, search?: string) {
  const db = await getDb();
  if (!db) return [];
  if (search) {
    return db
      .select()
      .from(notes)
      .where(
        and(
          eq(notes.userId, userId),
          or(
            like(notes.title, `%${search}%`),
            like(notes.content, `%${search}%`)
          )
        )
      )
      .orderBy(desc(notes.updatedAt));
  }
  return db
    .select()
    .from(notes)
    .where(eq(notes.userId, userId))
    .orderBy(desc(notes.updatedAt));
}

export async function getNoteById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, userId)))
    .limit(1);
  return result[0];
}

export async function updateNote(
  id: number,
  userId: number,
  data: Partial<InsertNote>
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(notes)
    .set(data)
    .where(and(eq(notes.id, id), eq(notes.userId, userId)));
}

export async function deleteNote(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(notes).where(and(eq(notes.id, id), eq(notes.userId, userId)));
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export async function createTask(data: InsertTask) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(tasks).values(data).$returningId();
  return result;
}

export async function getTasksByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(tasks)
    .where(eq(tasks.userId, userId))
    .orderBy(tasks.dueDate, desc(tasks.createdAt));
}

export async function updateTask(
  id: number,
  userId: number,
  data: Partial<InsertTask>
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(tasks)
    .set(data)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
}

export async function deleteTask(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
}

// ─── Google Token Helpers ─────────────────────────────────────────────────────

export async function getGoogleToken(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(googleTokens)
    .where(eq(googleTokens.userId, userId))
    .limit(1);
  return rows[0];
}

export async function upsertGoogleToken(data: {
  userId: number;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt: number;
  scope?: string | null;
  email?: string | null;
}) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(googleTokens)
    .values(data)
    .onDuplicateKeyUpdate({
      set: {
        accessToken: data.accessToken,
        ...(data.refreshToken ? { refreshToken: data.refreshToken } : {}),
        expiresAt: data.expiresAt,
        scope: data.scope ?? null,
        email: data.email ?? null,
      },
    });
}

export async function deleteGoogleToken(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(googleTokens).where(eq(googleTokens.userId, userId));
}

// ─── Memory Helpers ───────────────────────────────────────────────────────────

export async function getMemoriesByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(memories)
    .where(eq(memories.userId, userId))
    .orderBy(memories.category, memories.key);
}

export async function upsertMemory(
  userId: number,
  category: string,
  key: string,
  value: string,
  source = "chat"
) {
  const db = await getDb();
  if (!db) return;

  const embedding = null;

  // Prüfen ob bereits vorhanden (gleicher key)
  const existing = await db
    .select()
    .from(memories)
    .where(and(eq(memories.userId, userId), eq(memories.key, key)))
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(memories)
      .set({ value, category, source, embedding, updatedAt: new Date() })
      .where(and(eq(memories.userId, userId), eq(memories.key, key)));
  } else {
    await db
      .insert(memories)
      .values({ userId, category, key, value, source, embedding });
  }
}

export async function deleteMemory(userId: number, id: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(memories)
    .where(and(eq(memories.id, id), eq(memories.userId, userId)));
}

// ─── User Profile ─────────────────────────────────────────────────────────────

export async function getUserProfile(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);
  return result[0] ?? null;
}

export async function upsertUserProfile(
  userId: number,
  data: Partial<
    Omit<InsertUserProfile, "id" | "userId" | "createdAt" | "updatedAt">
  >
) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(userProfiles)
    .values({ userId, ...data })
    .onDuplicateKeyUpdate({ set: { ...data, updatedAt: new Date() } });
}

// ─── Dokumenten-Vorlagen ──────────────────────────────────────────────────────

export async function createTemplate(data: InsertDocumentTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Keine Datenbankverbindung");
  const [result] = await db
    .insert(documentTemplates)
    .values(data)
    .$returningId();
  return result;
}

export async function getTemplatesByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(documentTemplates)
    .where(eq(documentTemplates.userId, userId))
    .orderBy(
      desc(documentTemplates.isFavorite),
      desc(documentTemplates.usageCount)
    );
}

export async function getTemplateById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const r = await db
    .select()
    .from(documentTemplates)
    .where(
      and(eq(documentTemplates.id, id), eq(documentTemplates.userId, userId))
    )
    .limit(1);
  return r[0] ?? null;
}

export async function updateTemplate(
  id: number,
  userId: number,
  data: Partial<InsertDocumentTemplate>
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(documentTemplates)
    .set(data)
    .where(
      and(eq(documentTemplates.id, id), eq(documentTemplates.userId, userId))
    );
}

export async function deleteTemplate(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(documentTemplates)
    .where(
      and(eq(documentTemplates.id, id), eq(documentTemplates.userId, userId))
    );
}

export async function incrementTemplateUsage(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  // Atomar erhöhen statt read-then-write (spart einen Roundtrip und ist race-frei).
  await db
    .update(documentTemplates)
    .set({ usageCount: sql`${documentTemplates.usageCount} + 1` })
    .where(
      and(eq(documentTemplates.id, id), eq(documentTemplates.userId, userId))
    );
}

// ─── Delegationen ─────────────────────────────────────────────────────────────

export async function createDelegation(data: InsertDelegation) {
  const db = await getDb();
  if (!db) throw new Error("Keine Datenbankverbindung");
  const [result] = await db.insert(delegations).values(data).$returningId();
  return result;
}

export async function getDelegationsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(delegations)
    .where(eq(delegations.userId, userId))
    .orderBy(desc(delegations.createdAt));
}

export async function updateDelegation(
  id: number,
  userId: number,
  data: Partial<InsertDelegation>
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(delegations)
    .set(data)
    .where(and(eq(delegations.id, id), eq(delegations.userId, userId)));
}

export async function deleteDelegation(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(delegations)
    .where(and(eq(delegations.id, id), eq(delegations.userId, userId)));
}

// ─── Sprachnotizen ────────────────────────────────────────────────────────────

export async function createVoiceNote(data: InsertVoiceNote) {
  const db = await getDb();
  if (!db) throw new Error("Keine Datenbankverbindung");
  const [result] = await db.insert(voiceNotes).values(data).$returningId();
  return result;
}

export async function getVoiceNotesByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(voiceNotes)
    .where(eq(voiceNotes.userId, userId))
    .orderBy(desc(voiceNotes.createdAt))
    .limit(100);
}

export async function deleteVoiceNote(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(voiceNotes)
    .where(and(eq(voiceNotes.id, id), eq(voiceNotes.userId, userId)));
}

// ─── Lernende Vorschläge ──────────────────────────────────────────────────────

export async function trackPrompt(
  userId: number,
  intent: string,
  label: string,
  promptText: string
) {
  const db = await getDb();
  if (!db) return;
  const existing = await db
    .select()
    .from(promptStats)
    .where(and(eq(promptStats.userId, userId), eq(promptStats.intent, intent)))
    .limit(1);
  if (existing[0]) {
    await db
      .update(promptStats)
      .set({
        count: sql`${promptStats.count} + 1`,
        lastUsedAt: Date.now(),
        label,
        promptText,
      })
      .where(eq(promptStats.id, existing[0].id));
  } else {
    await db.insert(promptStats).values({
      userId,
      intent,
      label,
      promptText,
      count: 1,
      lastUsedAt: Date.now(),
    });
  }
}

export async function getTopPrompts(userId: number, limit = 4) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(promptStats)
    .where(eq(promptStats.userId, userId))
    .orderBy(desc(promptStats.count), desc(promptStats.lastUsedAt))
    .limit(limit);
}

// ─── Webhook-Schlüssel und Ereignisse ─────────────────────────────────────────

export async function createWebhookKey(
  userId: number,
  label: string,
  apiKey: string
) {
  const db = await getDb();
  if (!db) throw new Error("Keine Datenbankverbindung");
  const [result] = await db
    .insert(webhookKeys)
    .values({ userId, label, apiKey })
    .$returningId();
  return { id: result.id, apiKey };
}

export async function getWebhookKeysByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(webhookKeys)
    .where(eq(webhookKeys.userId, userId))
    .orderBy(desc(webhookKeys.createdAt));
}

export async function findWebhookKey(apiKey: string) {
  const db = await getDb();
  if (!db) return null;
  const r = await db
    .select()
    .from(webhookKeys)
    .where(eq(webhookKeys.apiKey, apiKey))
    .limit(1);
  return r[0] ?? null;
}

export async function touchWebhookKey(id: number, currentCount: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(webhookKeys)
    .set({ lastUsedAt: Date.now(), callCount: currentCount + 1 })
    .where(eq(webhookKeys.id, id));
}

export async function deleteWebhookKey(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(webhookKeys)
    .where(and(eq(webhookKeys.id, id), eq(webhookKeys.userId, userId)));
}

export async function createWebhookEvent(
  userId: number,
  source: string,
  title: string,
  body: string | null,
  notified: boolean
) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(webhookEvents)
    .values({ userId, source, title, body, notified });
}

export async function getWebhookEventsByUser(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(webhookEvents)
    .where(eq(webhookEvents.userId, userId))
    .orderBy(desc(webhookEvents.createdAt))
    .limit(limit);
}

// ─── Spotify-Tokens ───────────────────────────────────────────────────────────

export async function getSpotifyToken(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(spotifyTokens)
    .where(eq(spotifyTokens.userId, userId))
    .limit(1);
  return rows[0];
}

export async function upsertSpotifyToken(data: {
  userId: number;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt: number;
  scope?: string | null;
  displayName?: string | null;
  product?: string | null;
}) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(spotifyTokens)
    .values(data)
    .onDuplicateKeyUpdate({
      set: {
        accessToken: data.accessToken,
        ...(data.refreshToken ? { refreshToken: data.refreshToken } : {}),
        expiresAt: data.expiresAt,
        scope: data.scope ?? null,
        displayName: data.displayName ?? null,
        product: data.product ?? null,
        updatedAt: new Date(),
      },
    });
}

export async function deleteSpotifyToken(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(spotifyTokens).where(eq(spotifyTokens.userId, userId));
}

// ─── Geräte-Befehle (iOS-Kurzbefehle) ─────────────────────────────────────────

export async function createDeviceCommand(
  userId: number,
  type: string,
  payload: unknown,
  summary: string
) {
  const db = await getDb();
  if (!db) throw new Error("Keine Datenbankverbindung");
  const [result] = await db
    .insert(deviceCommands)
    .values({ userId, type, payload: JSON.stringify(payload), summary })
    .$returningId();
  return result;
}

/** Holt alle wartenden Befehle und markiert sie als ausgeliefert. */
export async function claimPendingDeviceCommands(userId: number, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(deviceCommands)
    .where(
      and(
        eq(deviceCommands.userId, userId),
        eq(deviceCommands.status, "pending")
      )
    )
    .orderBy(deviceCommands.createdAt)
    .limit(limit);
  if (rows.length === 0) return rows;
  // Ein einziges UPDATE statt eines pro Zeile (vorher N+1).
  await db
    .update(deviceCommands)
    .set({ status: "delivered", deliveredAt: Date.now() })
    .where(
      inArray(
        deviceCommands.id,
        rows.map(r => r.id)
      )
    );
  return rows;
}

export async function getDeviceCommandsByUser(userId: number, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(deviceCommands)
    .where(eq(deviceCommands.userId, userId))
    .orderBy(desc(deviceCommands.createdAt))
    .limit(limit);
}

export async function markDeviceCommandDone(
  id: number,
  userId: number,
  status: "done" | "failed" = "done"
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(deviceCommands)
    .set({ status })
    .where(and(eq(deviceCommands.id, id), eq(deviceCommands.userId, userId)));
}

export async function deleteDeviceCommand(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(deviceCommands)
    .where(and(eq(deviceCommands.id, id), eq(deviceCommands.userId, userId)));
}

// ─── ElevenLabs-Zeichenverbrauch ──────────────────────────────────────────────

/** Verbrauchte Zeichen im angegebenen Monat (Format YYYY-MM). */
export async function getTtsUsage(
  userId: number,
  yearMonth: string
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select()
    .from(ttsUsage)
    .where(and(eq(ttsUsage.userId, userId), eq(ttsUsage.yearMonth, yearMonth)))
    .limit(1);
  return rows[0]?.charsUsed ?? 0;
}

/** Bucht Zeichen auf den Monat und gibt den neuen Gesamtwert zurück. */
export async function addTtsUsage(
  userId: number,
  yearMonth: string,
  chars: number
): Promise<number> {
  const db = await getDb();
  if (!db) return chars;
  const rows = await db
    .select()
    .from(ttsUsage)
    .where(and(eq(ttsUsage.userId, userId), eq(ttsUsage.yearMonth, yearMonth)))
    .limit(1);
  const existing = rows[0];
  if (!existing) {
    await db
      .insert(ttsUsage)
      .values({ userId, yearMonth, charsUsed: chars, requestCount: 1 });
    return chars;
  }
  const total = existing.charsUsed + chars;
  // Atomar im DB-Server erhöhen (verhindert verlorene Updates bei parallelen Aufrufen).
  await db
    .update(ttsUsage)
    .set({
      charsUsed: sql`${ttsUsage.charsUsed} + ${chars}`,
      requestCount: sql`${ttsUsage.requestCount} + 1`,
    })
    .where(eq(ttsUsage.id, existing.id));
  return total;
}
