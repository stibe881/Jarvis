import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { chatRouter } from "./routers/chat";
import { notesRouter } from "./routers/notes";
import { tasksRouter } from "./routers/tasks";
import { notificationsRouter } from "./routers/notifications";
import { calendarRouter } from "./routers/calendar";
import { memoryRouter } from "./routers/memory";
import { profileRouter } from "./routers/profile";
import { grossIctRouter } from "./routers/grossIct";
import { sonnenbergRouter } from "./routers/sonnenberg";
import { appDashboardRouter } from "./routers/appDashboard";
import { elevenLabsRouter } from "./routers/elevenlabs";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  chat: chatRouter,
  notes: notesRouter,
  tasks: tasksRouter,
  notifications: notificationsRouter,
  calendar: calendarRouter,
  memory: memoryRouter,
  profile: profileRouter,
  grossIct: grossIctRouter,
  sonnenberg: sonnenbergRouter,
  appDashboard: appDashboardRouter,
  elevenlabs: elevenLabsRouter,
});

export type AppRouter = typeof appRouter;
