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
import { templatesRouter } from "./routers/templates";
import { delegationRouter } from "./routers/delegation";
import { voiceNotesRouter } from "./routers/voiceNotes";
import { webhooksRouter } from "./routers/webhooks";
import { spotifyRouter } from "./routers/spotify";
import { deviceRouter } from "./routers/deviceCommands";
import { newsRouter } from "./routers/news";

export const appRouter = router({
  system: systemRouter,
  news: newsRouter,
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
  templates: templatesRouter,
  delegation: delegationRouter,
  voiceNotes: voiceNotesRouter,
  webhooks: webhooksRouter,
  spotify: spotifyRouter,
  device: deviceRouter,
});

export type AppRouter = typeof appRouter;
