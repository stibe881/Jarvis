import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getUserProfile, upsertUserProfile } from "../db";

export const profileRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    return await getUserProfile(ctx.user.id);
  }),

  update: protectedProcedure
    .input(z.object({
      displayName: z.string().max(128).optional(),
      occupation: z.string().max(255).optional(),
      location: z.string().max(255).optional(),
      jarvisName: z.string().max(64).optional(),
      addressForm: z.enum(["sir", "du", "name"]).optional(),
      interests: z.string().optional(),
      workContext: z.string().optional(),
      personalNotes: z.string().optional(),
      jarvisPersonality: z.string().optional(),
      language: z.enum(["de", "en", "auto"]).optional(),
      elevenLabsVoiceId: z.string().max(64).optional(),
      speechMode: z.enum(["always", "voiceOnly", "never"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await upsertUserProfile(ctx.user.id, input);
      return { success: true };
    }),
});
