import { pinoHttp } from "pino-http";
import pino from "pino";
import { env } from "./env";

/**
 * Strukturiertes Logging via pino. In Entwicklung menschenlesbar (pino-pretty
 * falls vorhanden), in Produktion als JSON für Log-Aggregation.
 *
 * Wichtig für einen Assistenten mit kostenpflichtigen externen APIs
 * (Anthropic/ElevenLabs): Fehler und langsame Aufrufe sollen sichtbar sein,
 * statt in leeren `catch {}`-Blöcken zu verschwinden.
 */
export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  // Sensible Felder nie loggen.
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      'req.headers["xi-api-key"]',
      "*.apiKey",
      "*.accessToken",
      "*.refreshToken",
    ],
    censor: "[redacted]",
  },
});

export const httpLogger = pinoHttp({
  logger,
  // Gesundheits-Checks nicht in jeder Zeile mitloggen.
  autoLogging: {
    ignore: req => req.url === "/health" || req.url === "/api/health",
  },
});
