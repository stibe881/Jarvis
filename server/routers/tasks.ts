import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createTask,
  deleteTask,
  getTasksByUser,
  updateTask,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";

export const tasksRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return getTasksByUser(ctx.user.id);
  }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      priority: z.enum(["low", "medium", "high"]).optional(),
      dueDate: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return createTask({ userId: ctx.user.id, ...input });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      description: z.string().optional(),
      completed: z.boolean().optional(),
      priority: z.enum(["low", "medium", "high"]).optional(),
      dueDate: z.number().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await updateTask(id, ctx.user.id, data as Parameters<typeof updateTask>[2]);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteTask(input.id, ctx.user.id);
      return { success: true };
    }),

  toggleComplete: protectedProcedure
    .input(z.object({ id: z.number(), completed: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await updateTask(input.id, ctx.user.id, { completed: input.completed });
      return { success: true };
    }),
});

