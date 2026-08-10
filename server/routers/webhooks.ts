import { z } from "zod";
import { randomBytes } from "crypto";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createWebhookKey,
  getWebhookKeysByUser,
  deleteWebhookKey,
  getWebhookEventsByUser,
} from "../db";

export const webhooksRouter = router({
  listKeys: protectedProcedure.query(async ({ ctx }) => {
    return getWebhookKeysByUser(ctx.user.id);
  }),

  createKey: protectedProcedure
    .input(z.object({ label: z.string().min(1).max(120) }))
    .mutation(async ({ ctx, input }) => {
      const apiKey = `jv_${randomBytes(24).toString("hex")}`;
      return createWebhookKey(ctx.user.id, input.label, apiKey);
    }),

  removeKey: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteWebhookKey(input.id, ctx.user.id);
      return { success: true };
    }),

  listEvents: protectedProcedure
    .input(
      z.object({ limit: z.number().min(1).max(200).default(50) }).optional()
    )
    .query(async ({ ctx, input }) => {
      return getWebhookEventsByUser(ctx.user.id, input?.limit ?? 50);
    }),
});
