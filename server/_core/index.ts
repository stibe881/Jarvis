import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { handleChatStream } from "../routers/chat";
import { handleGoogleOAuthCallback } from "../routers/googleOAuth";
import { handleMorningBriefing } from "../routers/morningBriefing";
import { handleWeeklyReport } from "../routers/weeklyReport";
import { handleJarvisWebhook } from "../routers/webhookEndpoint";
import { handleSpotifyOAuthCallback } from "../routers/spotify";
import { handleDeviceCommandsFetch, handleDeviceCommandDone } from "../routers/deviceEndpoint";
import { handleTtsStream } from "../routers/ttsStream";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // Google Calendar OAuth Callback
  app.get("/api/oauth/google/callback", handleGoogleOAuthCallback);
  // Spotify OAuth Callback
  app.get("/api/oauth/spotify/callback", handleSpotifyOAuthCallback);
  // Jarvis Chat Streaming (SSE) – beide Pfade registrieren
  const streamHandler = async (req: express.Request, res: express.Response) => {
    const ctx = await createContext({ req, res } as Parameters<typeof createContext>[0]);
    if (!ctx.user) {
      res.status(401).json({ error: "Nicht authentifiziert" });
      return;
    }
    (req as express.Request & { user: typeof ctx.user }).user = ctx.user;
    await handleChatStream(req as Parameters<typeof handleChatStream>[0], res as Parameters<typeof handleChatStream>[1]);
  };
  app.post("/api/chat/stream", streamHandler);
  app.post("/api/stream", streamHandler);
  // Gestreamte Sprachausgabe: das Audio beginnt zu spielen, während es noch lädt
  app.post("/api/tts/stream", async (req: express.Request, res: express.Response) => {
    const ctx = await createContext({ req, res } as Parameters<typeof createContext>[0]);
    if (!ctx.user) {
      res.status(401).json({ error: "Nicht authentifiziert" });
      return;
    }
    await handleTtsStream(req, res, ctx.user.id);
  });
  // Gleiche Funktion als GET: erlaubt `audio.src = "/api/tts/stream?text=…"`,
  // damit der Browser die Wiedergabe startet, bevor alles geladen ist.
  app.get("/api/tts/stream", async (req: express.Request, res: express.Response) => {
    const ctx = await createContext({ req, res } as Parameters<typeof createContext>[0]);
    if (!ctx.user) {
      res.status(401).json({ error: "Nicht authentifiziert" });
      return;
    }
    await handleTtsStream(req, res, ctx.user.id);
  });
  // Heartbeat-Cron: Tägliche Morgen-Zusammenfassung
  app.post("/api/scheduled/morning-briefing", handleMorningBriefing);
  // Heartbeat-Cron: Wöchentlicher Bericht (Freitag)
  app.post("/api/scheduled/weekly-report", handleWeeklyReport);
  // Öffentlicher Webhook-Eingang für externe Dienste (API-Key-geschützt)
  app.post("/api/webhook/jarvis", handleJarvisWebhook);
  // Befehls-Queue für iOS-Kurzbefehle (API-Key-geschützt)
  app.get("/api/device/commands", handleDeviceCommandsFetch);
  app.post("/api/device/commands/done", handleDeviceCommandDone);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
