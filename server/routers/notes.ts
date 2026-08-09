import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createNote,
  deleteNote,
  getNoteById,
  getNotesByUser,
  updateNote,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";

export const notesRouter = router({
  list: protectedProcedure
    .input(z.object({ search: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return getNotesByUser(ctx.user.id, input.search);
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      content: z.string(),
      tags: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return createNote({ userId: ctx.user.id, ...input });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      content: z.string().optional(),
      tags: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const note = await getNoteById(id, ctx.user.id);
      if (!note) throw new TRPCError({ code: "NOT_FOUND" });
      await updateNote(id, ctx.user.id, data);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteNote(input.id, ctx.user.id);
      return { success: true };
    }),
});

