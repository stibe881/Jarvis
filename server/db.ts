import { and, desc, eq, like, or } from "drizzle-orm";
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
import { googleTokens, memories } from "../drizzle/schema";
import { ENV } from './_core/env';

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
      values.role = 'admin';
      updateSet.role = 'admin';
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

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

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
  return db.select().from(conversations).where(eq(conversations.userId, userId)).orderBy(desc(conversations.updatedAt));
}

export async function getConversationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
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
  return db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(messages.createdAt);
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
    return db.select().from(notes).where(
      and(
        eq(notes.userId, userId),
        or(like(notes.title, `%${search}%`), like(notes.content, `%${search}%`))
      )
    ).orderBy(desc(notes.updatedAt));
  }
  return db.select().from(notes).where(eq(notes.userId, userId)).orderBy(desc(notes.updatedAt));
}

export async function getNoteById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(notes).where(and(eq(notes.id, id), eq(notes.userId, userId))).limit(1);
  return result[0];
}

export async function updateNote(id: number, userId: number, data: Partial<InsertNote>) {
  const db = await getDb();
  if (!db) return;
  await db.update(notes).set(data).where(and(eq(notes.id, id), eq(notes.userId, userId)));
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
  return db.select().from(tasks).where(eq(tasks.userId, userId)).orderBy(tasks.dueDate, desc(tasks.createdAt));
}

export async function updateTask(id: number, userId: number, data: Partial<InsertTask>) {
  const db = await getDb();
  if (!db) return;
  await db.update(tasks).set(data).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
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
  const rows = await db.select().from(googleTokens).where(eq(googleTokens.userId, userId)).limit(1);
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
  await db.insert(googleTokens).values(data).onDuplicateKeyUpdate({
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
  return db.select().from(memories).where(eq(memories.userId, userId)).orderBy(memories.category, memories.key);
}

export async function upsertMemory(userId: number, category: string, key: string, value: string, source = "chat") {
  const db = await getDb();
  if (!db) return;
  // Prüfen ob bereits vorhanden (gleicher key)
  const existing = await db.select().from(memories).where(and(eq(memories.userId, userId), eq(memories.key, key))).limit(1);
  if (existing.length > 0) {
    await db.update(memories).set({ value, category, source, updatedAt: new Date() }).where(and(eq(memories.userId, userId), eq(memories.key, key)));
  } else {
    await db.insert(memories).values({ userId, category, key, value, source });
  }
}

export async function deleteMemory(userId: number, id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(memories).where(and(eq(memories.id, id), eq(memories.userId, userId)));
}
