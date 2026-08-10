import rateLimit from "express-rate-limit";

/**
 * Rate-Limiting schützt vor versehentlichen Schleifen und Missbrauch – und
 * damit direkt vor unnötigen Kosten bei Anthropic/ElevenLabs sowie vor
 * Brute-Force gegen die API-Key-Endpunkte.
 */

// Allgemeines Limit für die tRPC-API (großzügig, pro IP).
export const apiLimiter = rateLimit({
  windowMs: 60_000, // 1 Minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Zu viele Anfragen. Bitte kurz warten." },
});

// Strenges Limit für öffentliche, API-Key-geschützte Endpunkte
// (Webhook, Device-Queue) – hier ist Brute-Force gegen den Schlüssel die Gefahr.
export const publicEndpointLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Rate limit exceeded." },
});

// Sehr strenges Limit für teure Sprachausgabe (ElevenLabs kostet echtes Geld).
export const ttsLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Zu viele Sprachausgabe-Anfragen. Bitte kurz warten." },
});
