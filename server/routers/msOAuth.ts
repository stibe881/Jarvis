import type { Request, Response } from "express";
import { upsertMicrosoftToken } from "../db";
import { getMsRedirectUri } from "../_core/baseUrl";

export async function handleMsOAuthCallback(req: Request, res: Response) {
  try {
    const { code, state, error, error_description } = req.query as Record<
      string,
      string
    >;

    if (error) {
      console.error("[MS OAuth] Error:", error, error_description);
      return res.redirect("/calendar?error=" + encodeURIComponent(error));
    }

    if (!code || !state) {
      return res.redirect("/calendar?error=missing_code");
    }

    // state enthält userId, verpackt in Base64 (wie bei Google)
    const stateStr = Buffer.from(state as string, "base64").toString("utf-8");
    const stateObj = JSON.parse(stateStr);
    const userId = stateObj.userId;

    if (!userId) {
      return res.redirect("/calendar?error=invalid_state");
    }

    // Code gegen Tokens tauschen
    const tokenResp = await fetch(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.MS_CLIENT_ID ?? "",
          client_secret: process.env.MS_CLIENT_SECRET ?? "",
          code,
          grant_type: "authorization_code",
          redirect_uri: getMsRedirectUri(req),
        }),
      }
    );

    if (!tokenResp.ok) {
      const err = await tokenResp.text();
      console.error("[MS OAuth] Token error:", err);
      return res.redirect("/calendar?error=token_failed");
    }

    const data = await tokenResp.json();
    const { access_token, refresh_token, expires_in, scope } = data;
    const expiresAt = Math.floor(Date.now() / 1000) + expires_in;

    // Email extrahieren
    // Bei Microsoft Graph ruft man /me auf, um das Profil zu erhalten
    const profileResp = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    let email = null;
    if (profileResp.ok) {
      const profile = await profileResp.json();
      email = profile.mail || profile.userPrincipalName || null;
    }

    // Token speichern
    await upsertMicrosoftToken({
      userId: Number(userId),
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt,
      scope,
      email,
    });

    // Zurück zur App
    res.redirect("/calendar?success=ms");
  } catch (err) {
    console.error("[MS OAuth] Callback error:", err);
    res.redirect("/calendar?error=internal_error");
  }
}
