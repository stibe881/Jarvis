import { eq, and, lte, asc, desc } from "drizzle-orm";
import { getDb } from "./db";
import {
  scheduledTasks,
  userProfiles,
  users,
  conversations,
  messages as dbMessages,
} from "../drizzle/schema";
import { invokeLLM, Message } from "./_core/llm";
import { logger } from "./_core/logger";
import { runAgentLoop } from "./agent";
import { createContext } from "./_core/context";
import axios from "axios";

// Sehr simpler Cron-Evaluator für den Anfang (unterstützt nur "*", "*/n" und genaue Zahlen)
function getNextCronTime(
  cronExp: string,
  fromDate: Date = new Date()
): Date | null {
  // Für jetzt ignorieren wir echte Cron-Auswertung, wenn wir keinen Parser haben.
  // Ein vollständiger Parser wäre hier zu komplex. Wir nutzen es als Platzhalter.
  // Wir könnten es auf eine Stunde in der Zukunft setzen als Fallback.
  const next = new Date(fromDate);
  next.setHours(next.getHours() + 1); // Fallback
  return next;
}

export async function runBackgroundTasks() {
  const db = await getDb();
  if (!db) return;

  const now = new Date();

  try {
    // Finde alle aktiven Tasks, die jetzt fällig sind (runAt <= now)
    const dueTasks = await db
      .select()
      .from(scheduledTasks)
      .where(
        and(eq(scheduledTasks.isActive, true), lte(scheduledTasks.runAt, now))
      )
      .orderBy(asc(scheduledTasks.runAt));

    for (const task of dueTasks) {
      logger.info(
        `Führe geplanten Task aus: ID ${task.id}, Prompt: ${task.prompt}`
      );

      // Task als "in Bearbeitung" / aktualisiert markieren (verhindert Doppel-Ausführung)
      let nextRunAt: Date | null = null;
      let isActive = false;

      if (task.cronExpression) {
        nextRunAt = getNextCronTime(task.cronExpression, now);
        isActive = true;
      }

      await db
        .update(scheduledTasks)
        .set({
          lastRunAt: now,
          runAt: nextRunAt,
          isActive,
        })
        .where(eq(scheduledTasks.id, task.id));

      // Führe Agenten aus
      const userRes = await db
        .select()
        .from(users)
        .where(eq(users.id, task.userId))
        .limit(1);
      const user = userRes[0];
      const profileRes = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, task.userId))
        .limit(1);
      const profile = profileRes[0];

      if (!user) continue;

      const timeStr = `Heute ist der ${new Date().toLocaleDateString("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Europe/Zurich" })}, es ist ${new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" })} Uhr (ISO: ${new Date().toISOString().split("T")[0]}).`;
      const systemPrompt = `Du bist Jarvis. Führe den folgenden geplanten Hintergrund-Task aus und fasse das Ergebnis kurz zusammen.\n${timeStr}`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: task.prompt },
          ],
        });

        const ctx = await createContext({} as any);
        ctx.user = user;

        const initialResponseText =
          typeof response === "string"
            ? response
            : response.choices[0]?.message?.content || "";
        let firstResponseText = "";
        if (typeof initialResponseText === "string") {
          firstResponseText = initialResponseText;
        } else {
          firstResponseText = initialResponseText
            .map(c => (c.type === "text" ? c.text : ""))
            .join("\n");
        }

        const loopResult = await runAgentLoop({
          firstResponse: firstResponseText,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: task.prompt },
          ] as any,
          callModel: async (messages: any) => {
            const res = await invokeLLM({ messages });
            const content = res.choices[0]?.message?.content || "";
            if (typeof content === "string") return content;
            return content
              .map((c: any) => (c.type === "text" ? c.text : ""))
              .join("\n");
          },
          runAction: async parsed => {
            const { executeAction } = await import("./agent");
            return executeAction(
              {
                userId: user.id,
                runCalendar: async () => "Not supported in background task yet",
              },
              parsed
            );
          },
          maxRounds: 3,
        });

        // 3. Benachrichtigen (Chat, Push, Email) basierend auf User-Profil
        const notifyChat = profile?.notifyChat ?? true;
        const notifyPush = profile?.notifyPush ?? false;
        const notifyEmail = profile?.notifyEmail ?? false;

        const resultText =
          loopResult.text || "Aufgabe wurde ohne Text-Ergebnis abgeschlossen.";

        if (notifyChat) {
          const convRes = await db
            .select()
            .from(conversations)
            .where(eq(conversations.userId, user.id))
            .orderBy(desc(conversations.updatedAt))
            .limit(1);
          const lastConv = convRes[0];

          if (lastConv) {
            await db.insert(dbMessages).values({
              conversationId: lastConv.id,
              role: "assistant",
              content: `[Hintergrund-Task: ${task.prompt}]\n${resultText}`,
            });
            await db
              .update(conversations)
              .set({ updatedAt: new Date() })
              .where(eq(conversations.id, lastConv.id));
          }
        }

        if (notifyPush && profile?.expoPushToken) {
          const token = profile.expoPushToken;
          // Simple Check für den Token (ExponentPushToken[...] oder ExponentPushToken[...])
          if (
            token.startsWith("ExponentPushToken[") ||
            token.startsWith("ExpoPushToken[")
          ) {
            try {
              await axios.post(
                "https://exp.host/--/api/v2/push/send",
                {
                  to: token,
                  sound: "default",
                  title: "Jarvis",
                  body: resultText.slice(0, 200),
                  data: { type: "reminder" },
                },
                {
                  headers: {
                    Accept: "application/json",
                    "Accept-encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                  },
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
              `Ungültiger Expo-Push-Token für User ${user.id}: ${token}`
            );
          }
        }
        if (notifyEmail) {
          logger.info(`Würde E-Mail senden an User ${user.id}: ${resultText}`);
        }
      } catch (err) {
        logger.error(
          { err },
          `Fehler bei Ausführung von Hintergrund-Task ${task.id}`
        );
      }
    }
  } catch (err) {
    logger.error({ err }, "Fehler beim Prüfen geplanter Tasks");
  }
}

export function startBackgroundWorker() {
  // Prüfe alle 30 Sekunden
  setInterval(() => {
    runBackgroundTasks().catch(err => {
      logger.error({ err }, "Background Worker Error");
    });
  }, 30 * 1000);
  logger.info("Background Worker gestartet.");
}
