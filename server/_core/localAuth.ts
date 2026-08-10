import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { timingSafeEqual } from "crypto";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

/**
 * Lokaler Passwort-Login für den Self-Hosting-Betrieb.
 *
 * Ersetzt den Plattform-OAuth-Flow: Statt eines externen Auth-Servers genügt
 * ein Passwort aus `APP_PASSWORD`. Bei Erfolg wird derselbe JWT-Session-Cookie
 * gesetzt wie zuvor, sodass die restliche Anwendung (sdk.authenticateRequest,
 * protectedProcedure) unverändert weiterläuft.
 *
 * Bewusst einfach gehalten: Jarvis ist eine Einzelnutzer-App. Es gibt genau
 * einen Besitzer-Datensatz; ohne gesetztes APP_PASSWORD ist der Login aus.
 */

/** Feste openId des lokalen Besitzers. */
export const LOCAL_OWNER_OPEN_ID = "local_owner";

/** Ist der lokale Passwort-Login aktiv? */
export function localAuthEnabled(): boolean {
  return Boolean(process.env.APP_PASSWORD);
}

/** Zeitkonstanter Vergleich, damit die Antwortzeit das Passwort nicht verrät. */
function passwordMatches(input: string, expected: string): boolean {
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function registerLocalAuthRoutes(app: Express) {
  // Zeigt dem Frontend, welcher Login-Weg gilt.
  app.get("/api/auth/mode", (_req: Request, res: Response) => {
    res.json({ mode: localAuthEnabled() ? "password" : "oauth" });
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const expected = process.env.APP_PASSWORD;
    if (!expected) {
      res.status(503).json({ error: "Login ist nicht konfiguriert." });
      return;
    }

    const password = (req.body as { password?: unknown })?.password;
    if (typeof password !== "string" || !passwordMatches(password, expected)) {
      res.status(401).json({ error: "Falsches Passwort." });
      return;
    }

    try {
      const name = process.env.OWNER_NAME || "Stefan";
      await db.upsertUser({
        openId: LOCAL_OWNER_OPEN_ID,
        name,
        loginMethod: "password",
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(LOCAL_OWNER_OPEN_ID, {
        name,
        expiresInMs: ONE_YEAR_MS,
      });

      res.cookie(COOKIE_NAME, sessionToken, {
        ...getSessionCookieOptions(req),
        maxAge: ONE_YEAR_MS,
      });
      res.json({ ok: true });
    } catch (error) {
      console.error("[LocalAuth] Login fehlgeschlagen", error);
      res.status(500).json({ error: "Login fehlgeschlagen." });
    }
  });
}
