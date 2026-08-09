import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getMemoriesByUser, upsertMemory, deleteMemory } from "../db";

export const memoryRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return getMemoriesByUser(ctx.user.id);
  }),

  upsert: protectedProcedure
    .input(z.object({
      category: z.string().default("fact"),
      key: z.string(),
      value: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await upsertMemory(ctx.user.id, input.category, input.key, input.value, "manual");
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteMemory(ctx.user.id, input.id);
      return { success: true };
    }),
});

