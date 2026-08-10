import type { Request, Response } from "express";
import { upsertGoogleToken } from "../db";
import { getUserByOpenId } from "../db";
import { sdk } from "../_core/sdk";
import { getGoogleRedirectUri } from "../_core/baseUrl";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

export async function handleGoogleOAuthCallback(req: Request, res: Response) {
  try {
    const { code, state, error } = req.query as Record<string, string>;

    if (error) {
      return res.redirect(`/calendar?error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      return res.redirect("/calendar?error=missing_params");
    }

    // Nutzer-ID aus state (gesetzt beim Login-URL-Aufruf)
    const userId = parseInt(state);
    if (isNaN(userId)) {
      return res.redirect("/calendar?error=invalid_state");
    }

    // Authorization Code gegen Tokens tauschen
    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        // Muss exakt der redirect_uri aus der Auth-URL (calendar.getAuthUrl)
        // entsprechen – beide leiten sich aus derselben Basis-URL ab.
        redirect_uri: getGoogleRedirectUri(req),
      }),
    });

    const tokenData = (await tokenResp.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      error?: string;
    };

    if (!tokenResp.ok || !tokenData.access_token) {
      console.error("[Google OAuth] Token-Fehler:", tokenData);
      return res.redirect(
        `/calendar?error=${encodeURIComponent(tokenData.error ?? "token_error")}`
      );
    }

    // E-Mail-Adresse des Google-Kontos abrufen
    let email: string | null = null;
    try {
      const userInfoResp = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        }
      );
      const userInfo = (await userInfoResp.json()) as { email?: string };
      email = userInfo.email ?? null;
    } catch {
      /* ignorieren */
    }

    // Token in DB speichern
    await upsertGoogleToken({
      userId,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token ?? null,
      expiresAt: Math.floor(Date.now() / 1000) + (tokenData.expires_in ?? 3600),
      scope: tokenData.scope ?? null,
      email,
    });

    // Zurück zur Kalender-Seite mit Erfolg
    return res.redirect("/calendar?connected=true");
  } catch (err) {
    console.error("[Google OAuth Callback Error]", err);
    return res.redirect("/calendar?error=server_error");
  }
}
