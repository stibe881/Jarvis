// MUSS als Erstes stehen: lädt die .env, bevor ein anderes Modul process.env liest.
import "./loadEnv";
import express from "express";
import { createServer } from "http";
import net from "net";
import { validateEnv } from "./env";
import { httpLogger, logger } from "./logger";
import { apiLimiter, publicEndpointLimiter, ttsLimiter } from "./rateLimit";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerLocalAuthRoutes } from "./localAuth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { handleGoogleOAuthCallback } from "../routers/googleOAuth";
import { handleMorningBriefing } from "../routers/morningBriefing";
import { handleWeeklyReport } from "../routers/weeklyReport";
import { handleJarvisWebhook } from "../routers/webhookEndpoint";
import { handleSpotifyOAuthCallback } from "../routers/spotify";
import {
  handleDeviceCommandsFetch,
  handleDeviceCommandDone,
} from "../routers/deviceEndpoint";
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
  // Umgebungsvariablen früh und streng prüfen: fehlende Pflicht-Secrets sollen
  // beim Start klar auffallen, nicht erst mitten in einem Request.
  validateEnv();

  const app = express();
  const server = createServer(app);
  // Strukturiertes Request-Logging (redigiert Secrets, ignoriert /health).
  app.use(httpLogger);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Liveness-/Readiness-Probe für Monitoring und Deployment-Health-Checks.
  const health = (_req: express.Request, res: express.Response) =>
    res.json({ status: "ok", uptime: process.uptime() });
  app.get("/health", health);
  app.get("/api/health", health);

  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // Lokaler Passwort-Login (Self-Hosting); Brute-Force-Schutz über das
  // strenge Limit für öffentliche Endpunkte.
  app.use("/api/auth/login", publicEndpointLimiter);
  registerLocalAuthRoutes(app);
  // Google Calendar OAuth Callback
  app.get("/api/oauth/google/callback", handleGoogleOAuthCallback);
  // Spotify OAuth Callback
  app.get("/api/oauth/spotify/callback", handleSpotifyOAuthCallback);
  // Gestreamte Sprachausgabe: das Audio beginnt zu spielen, während es noch lädt
  app.post(
    "/api/tts/stream",
    ttsLimiter,
    async (req: express.Request, res: express.Response) => {
      const ctx = await createContext({ req, res } as Parameters<
        typeof createContext
      >[0]);
      if (!ctx.user) {
        res.status(401).json({ error: "Nicht authentifiziert" });
        return;
      }
      await handleTtsStream(req, res, ctx.user.id);
    }
  );
  // Gleiche Funktion als GET: erlaubt `audio.src = "/api/tts/stream?text=…"`,
  // damit der Browser die Wiedergabe startet, bevor alles geladen ist.
  app.get(
    "/api/tts/stream",
    ttsLimiter,
    async (req: express.Request, res: express.Response) => {
      const ctx = await createContext({ req, res } as Parameters<
        typeof createContext
      >[0]);
      if (!ctx.user) {
        res.status(401).json({ error: "Nicht authentifiziert" });
        return;
      }
      await handleTtsStream(req, res, ctx.user.id);
    }
  );
  // Heartbeat-Cron: Tägliche Morgen-Zusammenfassung
  app.post("/api/scheduled/morning-briefing", handleMorningBriefing);
  // Heartbeat-Cron: Wöchentlicher Bericht (Freitag)
  app.post("/api/scheduled/weekly-report", handleWeeklyReport);
  // Öffentlicher Webhook-Eingang für externe Dienste (API-Key-geschützt)
  app.post("/api/webhook/jarvis", publicEndpointLimiter, handleJarvisWebhook);
  // Befehls-Queue für iOS-Kurzbefehle (API-Key-geschützt)
  app.get(
    "/api/device/commands",
    publicEndpointLimiter,
    handleDeviceCommandsFetch
  );
  app.post(
    "/api/device/commands/done",
    publicEndpointLimiter,
    handleDeviceCommandDone
  );
  // tRPC API
  app.use(
    "/api/trpc",
    apiLimiter,
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

  // Wenn die Umgebung einen Port/Socket vorgibt (Passenger auf Plesk-/Managed-
  // Hosting, PaaS, Docker), MUSS genau darauf gelauscht werden – ohne Port-
  // Probing. Unter Passenger würde ein Probe-Server über die gepatchte
  // listen()-Methode sogar den vom Prozessmanager erwarteten Socket belegen.
  // Nur im lokalen Dev (kein PORT gesetzt) suchen wir einen freien Port.
  // Manche Panels (z.B. Hetzner konsoleH) übergeben den Port nicht als
  // Umgebungsvariable, sondern als Aufrufargument: `node dist/index.js 40123`.
  // Lauschen wir dann auf dem falschen Port, findet der Webserver nichts und
  // meldet nur 503 – ohne jeden Hinweis im Log. Deshalb beide Wege prüfen.
  const argPort = process.argv.slice(2).find(a => /^\d{2,5}$/.test(a));
  const envPort = process.env.PORT || argPort;

  if (envPort) {
    // Rein numerische Werte als TCP-Port, alles andere als Socket-Pfad behandeln.
    const listenTarget: string | number = /^\d+$/.test(envPort)
      ? Number(envPort)
      : envPort;
    const quelle = process.env.PORT ? "PORT-Variable" : "Aufrufargument";
    server.listen(listenTarget, () => {
      logger.info(
        `Server running (listening on ${listenTarget}, via ${quelle})`
      );
    });
  } else {
    const port = await findAvailablePort(3000);
    logger.warn(
      "Kein Port vorgegeben (weder PORT noch Argument) – nutze automatisch " +
        `${port}. Hinter einem Webserver ist das meist die Ursache für 503.`
    );
    server.listen(port, () => {
      logger.info(`Server running on http://localhost:${port}/`);
    });
  }
}

startServer().catch(err => {
  logger.error({ err }, "Server failed to start");
  process.exit(1);
});
