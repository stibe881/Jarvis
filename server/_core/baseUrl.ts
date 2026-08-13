import type { Request } from "express";

/**
 * Öffentliche Basis-URL der App – für OAuth-Redirect-URIs (Google, Spotify).
 *
 * Früher war hier die Manus-Preview-Domain hart codiert; nach dem Umzug auf
 * eine eigene Domain schickte Google den Nutzer nach der Zustimmung deshalb
 * zurück zu manus.space statt zur eigenen Installation.
 *
 * Reihenfolge:
 * 1. `APP_URL` aus der Umgebung (empfohlen, deterministisch),
 * 2. sonst aus dem Request abgeleitet. Achtung: Hinter Proxys ohne
 *    X-Forwarded-Proto (z.B. Hetzner konsoleH) meldet Express "http",
 *    obwohl die Seite über HTTPS läuft – für öffentliche Hosts nehmen wir
 *    deshalb https an, nur localhost bleibt http.
 */
export function getAppBaseUrl(req?: Request): string {
  const configured = process.env.APP_URL;
  if (configured) return configured.replace(/\/+$/, "");

  const host = req?.headers.host;
  if (host) {
    const forwarded = req?.headers["x-forwarded-proto"];
    const forwardedProto = Array.isArray(forwarded)
      ? forwarded[0]
      : forwarded?.split(",")[0]?.trim();
    const isLocal = /^(localhost|127\.|\[::1\])/.test(host);
    const proto = forwardedProto || (isLocal ? "http" : "https");
    return `${proto}://${host}`;
  }

  return "http://localhost:3000";
}

/**
 * Redirect-URI für den Google-OAuth-Flow. Muss in der Google Cloud Console
 * (APIs & Dienste → Anmeldedaten → OAuth-Client) als autorisierte
 * Weiterleitungs-URI eingetragen sein, z.B.
 * `https://ai-gross-ict.ch/api/oauth/google/callback`.
 */
export function getGoogleRedirectUri(req?: Request): string {
  return `${getAppBaseUrl(req)}/api/oauth/google/callback`;
}

/**
 * Redirect-URI für den Spotify-OAuth-Flow. Muss im Spotify Developer
 * Dashboard unter "Redirect URIs" eingetragen sein, z.B.
 * `https://ai-gross-ict.ch/api/oauth/spotify/callback`.
 */
export function getSpotifyRedirectUri(req?: Request): string {
  return `${getAppBaseUrl(req)}/api/oauth/spotify/callback`;
}

/**
 * Redirect-URI für den Microsoft-OAuth-Flow (Hotmail/Outlook/Exchange).
 * Muss in der Azure/Entra-ID App Registration hinterlegt sein.
 */
export function getMsRedirectUri(req?: Request): string {
  return `${getAppBaseUrl(req)}/api/oauth/ms/callback`;
}
