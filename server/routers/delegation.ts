import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createDelegation,
  getDelegationsByUser,
  updateDelegation,
  deleteDelegation,
  getUserProfile,
} from "../db";
import { invokeLLM } from "../_core/llm";
import { TRPCError } from "@trpc/server";

const statusEnum = z.enum(["open", "in_progress", "done", "cancelled"]);

function formatDate(ts?: number | null): string {
  if (!ts) return "ohne festes Datum";
  return new Date(ts).toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export const delegationRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return getDelegationsByUser(ctx.user.id);
  }),

  create: protectedProcedure
    .input(
      z.object({
        assigneeName: z.string().min(1),
        assigneeEmail: z.string().email().optional(),
        title: z.string().min(1),
        details: z.string().optional(),
        dueDate: z.number().optional(),
        generateEmail: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let emailDraft: string | null = null;

      if (input.generateEmail) {
        try {
          const profile = await getUserProfile(ctx.user.id);
          const senderName =
            profile?.displayName ?? ctx.user.name ?? "Stefan Gross";
          const prompt = `Schreibe eine kurze, freundliche und klare E-Mail auf Deutsch (Schweizer Schreibweise, "ss" statt "ß"), in der ${senderName} die folgende Aufgabe an ${input.assigneeName} delegiert.

Aufgabe: ${input.title}
${input.details ? `Details: ${input.details}` : ""}
Frist: ${formatDate(input.dueDate)}

Anforderungen an die E-Mail:
- Beginne mit einer Betreffzeile in der Form "Betreff: ..."
- Persönliche Anrede
- Aufgabe präzise beschreiben, damit klar ist, was erwartet wird
- Frist klar nennen
- Freundlicher Abschluss mit Grussformel und ${senderName}
- Maximal 180 Wörter
Gib nur den E-Mail-Text zurück, ohne weitere Erklärungen.`;
          const resp = await invokeLLM({
            model: "claude-sonnet-4-5",
            max_tokens: 900,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            messages: [{ role: "user", content: prompt }] as any,
          });
          emailDraft = (resp.choices[0]?.message?.content as string) ?? null;
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
        emailDraft,
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: statusEnum.optional(),
        title: z.string().optional(),
        details: z.string().optional(),
        dueDate: z.number().nullable().optional(),
        assigneeName: z.string().optional(),
        assigneeEmail: z.string().optional(),
        emailDraft: z.string().optional(),
        markEmailSent: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, markEmailSent, ...rest } = input;
      const data: Record<string, unknown> = { ...rest };
      if (markEmailSent) data.emailSentAt = Date.now();
      await updateDelegation(id, ctx.user.id, data);
      return { success: true };
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteDelegation(input.id, ctx.user.id);
      return { success: true };
    }),

  regenerateEmail: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        tone: z
          .enum(["freundlich", "sachlich", "dringend"])
          .default("freundlich"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const all = await getDelegationsByUser(ctx.user.id);
      const d = all.find(x => x.id === input.id);
      if (!d)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Delegation nicht gefunden.",
        });
      const profile = await getUserProfile(ctx.user.id);
      const senderName =
        profile?.displayName ?? ctx.user.name ?? "Stefan Gross";
      const prompt = `Schreibe eine E-Mail auf Deutsch (Schweizer Schreibweise) im Tonfall "${input.tone}", in der ${senderName} die Aufgabe "${d.title}" an ${d.assigneeName} delegiert.
${d.details ? `Details: ${d.details}` : ""}
Frist: ${formatDate(d.dueDate)}
Beginne mit "Betreff: ", danach der E-Mail-Text. Maximal 180 Wörter. Gib nur die E-Mail zurück.`;
      const resp = await invokeLLM({
        model: "claude-sonnet-4-5",
        max_tokens: 900,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: [{ role: "user", content: prompt }] as any,
      });
      const emailDraft = (resp.choices[0]?.message?.content as string) ?? "";
      await updateDelegation(input.id, ctx.user.id, { emailDraft });
      return { emailDraft };
    }),
});
