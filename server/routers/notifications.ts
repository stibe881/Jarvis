import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { notifyOwner } from "../_core/notification";
import { getTasksByUser } from "../db";

export const notificationsRouter = router({
  // Teste Benachrichtigung senden
  testNotification: protectedProcedure
    .input(z.object({ title: z.string(), content: z.string() }))
    .mutation(async ({ input }) => {
      const ok = await notifyOwner({
        title: input.title,
        content: input.content,
      });
      return { success: ok };
    }),

  // Fällige Aufgaben prüfen und Benachrichtigung senden
  checkDueTasks: protectedProcedure.mutation(async ({ ctx }) => {
    const tasks = await getTasksByUser(ctx.user.id);
    const now = Date.now();
    const soon = now + 24 * 60 * 60 * 1000; // 24h

    const overdue = tasks.filter(
      t => !t.completed && t.dueDate && t.dueDate < now
    );
    const dueSoon = tasks.filter(
      t => !t.completed && t.dueDate && t.dueDate >= now && t.dueDate <= soon
    );

    if (overdue.length === 0 && dueSoon.length === 0) {
      return { sent: false, message: "Keine fälligen Aufgaben" };
    }

    const lines: string[] = [];
    if (overdue.length > 0) {
      lines.push(`**Überfällig (${overdue.length}):**`);
      overdue
        .slice(0, 5)
        .forEach(t =>
          lines.push(
            `• ${t.title} – fällig ${new Date(t.dueDate!).toLocaleDateString("de-DE")}`
          )
        );
    }
    if (dueSoon.length > 0) {
      lines.push(`\n**Bald fällig (${dueSoon.length}):**`);
      dueSoon
        .slice(0, 5)
        .forEach(t =>
          lines.push(
            `• ${t.title} – fällig ${new Date(t.dueDate!).toLocaleDateString("de-DE")}`
          )
        );
    }

    const ok = await notifyOwner({
      title: `⏰ Jarvis: ${overdue.length + dueSoon.length} Aufgabe(n) fällig`,
      content: lines.join("\n"),
    });

    return { sent: ok, overdue: overdue.length, dueSoon: dueSoon.length };
  }),
});
