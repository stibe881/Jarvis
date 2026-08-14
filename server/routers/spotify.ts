import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Request, Response } from "express";
import { protectedProcedure, router } from "../_core/trpc";
import { getSpotifyToken, upsertSpotifyToken, deleteSpotifyToken } from "../db";
import { getSpotifyRedirectUri } from "../_core/baseUrl";

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET ?? "";

/** Benötigte Berechtigungen für Wiedergabesteuerung und Suche. */
const SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "playlist-read-private",
  "user-library-read",
  "user-top-read",
  "user-read-private",
  "user-read-email",
].join(" ");

function basicAuth() {
  return (
    "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")
  );
}

/** Gültigen Access-Token holen, bei Bedarf über Refresh-Token erneuern. */
export async function getValidSpotifyAccessToken(
  userId: number
): Promise<string | null> {
  const row = await getSpotifyToken(userId);
  if (!row) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  if (row.expiresAt > nowSec + 60) return row.accessToken;
  if (!row.refreshToken) return null;

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuth(),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: row.refreshToken,
    }),
  });
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
  };
  if (!res.ok || !data.access_token) {
    console.error("[Spotify] Refresh fehlgeschlagen", data);
    return null;
  }
  await upsertSpotifyToken({
    userId,
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? row.refreshToken,
    expiresAt: nowSec + (data.expires_in ?? 3600),
    scope: row.scope,
    displayName: row.displayName,
    product: row.product,
  });
  return data.access_token;
}

type SpotifyCall = { status: number; data: unknown };

/** Ruft die Spotify-Web-API auf. */
async function spotifyFetch(
  token: string,
  path: string,
  init: { method?: string; body?: unknown } = {}
): Promise<SpotifyCall> {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });
  if (res.status === 204) return { status: 204, data: null };
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

// ── OAuth-Callback (Express) ─────────────────────────────────────────────────

export async function handleSpotifyOAuthCallback(req: Request, res: Response) {
  try {
    const { code, state, error } = req.query as Record<string, string>;
    if (error)
      return res.redirect(
        `/integrations?spotify_error=${encodeURIComponent(error)}`
      );
    if (!code || !state)
      return res.redirect("/integrations?spotify_error=missing_params");

    const userId = parseInt(state, 10);
    if (Number.isNaN(userId))
      return res.redirect("/integrations?spotify_error=invalid_state");

    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: basicAuth(),
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        // Muss exakt der redirect_uri aus getAuthUrl entsprechen – beide
        // leiten sich aus derselben Basis-URL ab.
        redirect_uri: getSpotifyRedirectUri(req),
      }),
    });
    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      error?: string;
    };
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("[Spotify OAuth] Token-Fehler", tokenData);
      return res.redirect(
        `/integrations?spotify_error=${encodeURIComponent(tokenData.error ?? "token_error")}`
      );
    }

    // Profil abrufen (Name + Premium-Status)
    let displayName: string | null = null;
    let product: string | null = null;
    try {
      const me = await spotifyFetch(tokenData.access_token, "/me");
      const info = me.data as {
        display_name?: string;
        product?: string;
      } | null;
      displayName = info?.display_name ?? null;
      product = info?.product ?? null;
    } catch {
      /* ignorieren */
    }

    await upsertSpotifyToken({
      userId,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token ?? null,
      expiresAt: Math.floor(Date.now() / 1000) + (tokenData.expires_in ?? 3600),
      scope: tokenData.scope ?? null,
      displayName,
      product,
    });

    return res.redirect("/integrations?spotify=connected");
  } catch (err) {
    console.error("[Spotify OAuth Callback Error]", err);
    return res.redirect("/integrations?spotify_error=server_error");
  }
}

// ── Aktions-Dispatcher für den Chat ──────────────────────────────────────────

type TrackInfo = {
  name: string;
  artists?: { name: string }[];
  uri: string;
  album?: { name: string };
};

function formatTrack(t: TrackInfo) {
  const artists = (t.artists ?? []).map(a => a.name).join(", ");
  return artists ? `${t.name} – ${artists}` : t.name;
}

/**
 * Führt eine Spotify-Aktion aus und gibt eine für den Nutzer lesbare Antwort zurück.
 * Wird sowohl vom Chat (spotify_action) als auch vom tRPC-Router verwendet.
 */
export async function executeSpotifyAction(
  userId: number,
  action: string,
  params: Record<string, unknown>
): Promise<string> {
  const token = await getValidSpotifyAccessToken(userId);
  if (!token) {
    return "⚠️ Spotify ist nicht verbunden. Verbinde dein Konto unter **Verbindungen → Spotify**.";
  }

  const noDevice =
    "⚠️ Kein aktives Spotify-Gerät gefunden. Öffne Spotify auf dem iPhone, Mac oder im Browser und starte kurz ein Lied – danach kann ich die Wiedergabe steuern.";

  const str = (k: string) =>
    typeof params[k] === "string" ? (params[k] as string) : undefined;
  const num = (k: string) =>
    typeof params[k] === "number" ? (params[k] as number) : undefined;

  switch (action) {
    case "play": {
      const query = str("query");
      // Ohne Suchbegriff: Wiedergabe fortsetzen
      if (!query) {
        const r = await spotifyFetch(token, "/me/player/play", {
          method: "PUT",
        });
        if (r.status === 404) return noDevice;
        if (r.status === 403)
          return "⚠️ Für die Wiedergabesteuerung wird Spotify Premium benötigt.";
        return "▶️ Wiedergabe gestartet.";
      }
      // Mit Suchbegriff: passenden Titel/Playlist/Album suchen und abspielen
      const type = str("type") ?? "track";
      const search = await spotifyFetch(
        token,
        `/search?q=${encodeURIComponent(query)}&type=${type}&limit=1&market=CH`
      );
      const sd = search.data as Record<string, { items?: unknown[] }> | null;
      const items = sd?.[`${type}s`]?.items ?? [];
      if (!items.length)
        return `Ich habe zu "${query}" nichts auf Spotify gefunden.`;

      if (type === "track") {
        const track = items[0] as TrackInfo;
        const r = await spotifyFetch(token, "/me/player/play", {
          method: "PUT",
          body: { uris: [track.uri] },
        });
        if (r.status === 404) return noDevice;
        if (r.status === 403)
          return "⚠️ Für die Wiedergabesteuerung wird Spotify Premium benötigt.";
        return `▶️ Spiele **${formatTrack(track)}**. (Hinweis: Falls nichts zu hören ist, öffne kurz die Spotify App auf dem Handy, um das Gerät aufzuwecken.)`;
      }
      const ctx = items[0] as { uri: string; name: string };
      const r = await spotifyFetch(token, "/me/player/play", {
        method: "PUT",
        body: { context_uri: ctx.uri },
      });
      if (r.status === 404) return noDevice;
      if (r.status === 403)
        return "⚠️ Für die Wiedergabesteuerung wird Spotify Premium benötigt.";
      const label =
        type === "playlist"
          ? "Playlist"
          : type === "album"
            ? "Album"
            : "Künstler";
      return `▶️ Spiele ${label} **${ctx.name}**. (Hinweis: Falls nichts zu hören ist, öffne kurz die Spotify App auf dem Handy, um das Gerät aufzuwecken.)`;
    }

    case "pause": {
      const r = await spotifyFetch(token, "/me/player/pause", {
        method: "PUT",
      });
      if (r.status === 404) return noDevice;
      return "⏸️ Wiedergabe pausiert.";
    }

    case "next": {
      const r = await spotifyFetch(token, "/me/player/next", {
        method: "POST",
      });
      if (r.status === 404) return noDevice;
      return "⏭️ Nächster Titel.";
    }

    case "previous": {
      const r = await spotifyFetch(token, "/me/player/previous", {
        method: "POST",
      });
      if (r.status === 404) return noDevice;
      return "⏮️ Vorheriger Titel.";
    }

    case "volume": {
      const level = num("level") ?? 50;
      const clamped = Math.max(0, Math.min(100, Math.round(level)));
      const r = await spotifyFetch(
        token,
        `/me/player/volume?volume_percent=${clamped}`,
        { method: "PUT" }
      );
      if (r.status === 404) return noDevice;
      return `🔊 Lautstärke auf ${clamped}% gesetzt.`;
    }

    case "shuffle": {
      const on = params.enabled !== false;
      const r = await spotifyFetch(token, `/me/player/shuffle?state=${on}`, {
        method: "PUT",
      });
      if (r.status === 404) return noDevice;
      return on
        ? "🔀 Zufallswiedergabe eingeschaltet."
        : "➡️ Zufallswiedergabe ausgeschaltet.";
    }

    case "current": {
      const r = await spotifyFetch(
        token,
        "/me/player/currently-playing?market=CH"
      );
      if (r.status === 204 || !r.data)
        return "Momentan läuft nichts auf Spotify.";
      const d = r.data as { item?: TrackInfo; is_playing?: boolean };
      if (!d.item) return "Momentan läuft nichts auf Spotify.";
      const state = d.is_playing ? "▶️ Läuft gerade" : "⏸️ Pausiert";
      const album = d.item.album?.name ? ` (Album: ${d.item.album.name})` : "";
      return `${state}: **${formatTrack(d.item)}**${album}`;
    }

    case "search": {
      const query = str("query");
      if (!query) return "Was soll ich auf Spotify suchen?";
      const type = str("type") ?? "track";
      const r = await spotifyFetch(
        token,
        `/search?q=${encodeURIComponent(query)}&type=${type}&limit=5&market=CH`
      );
      const sd = r.data as Record<string, { items?: unknown[] }> | null;
      const items = (sd?.[`${type}s`]?.items ?? []) as TrackInfo[];
      if (!items.length) return `Zu "${query}" habe ich nichts gefunden.`;
      return (
        `**Suchergebnisse für "${query}":**\n` +
        items.map((t, i) => `${i + 1}. ${formatTrack(t)}`).join("\n")
      );
    }

    case "playlists": {
      const r = await spotifyFetch(token, "/me/playlists?limit=20");
      const d = r.data as {
        items?: { name: string; tracks?: { total: number } }[];
      } | null;
      const items = d?.items ?? [];
      if (!items.length) return "Du hast keine Playlists.";
      return (
        `**Deine Playlists (${items.length}):**\n` +
        items
          .map(
            p => `• ${p.name}${p.tracks ? ` (${p.tracks.total} Titel)` : ""}`
          )
          .join("\n")
      );
    }

    case "devices": {
      const r = await spotifyFetch(token, "/me/player/devices");
      const d = r.data as {
        devices?: { name: string; type: string; is_active: boolean }[];
      } | null;
      const devices = d?.devices ?? [];
      if (!devices.length) return noDevice;
      return (
        `**Verfügbare Geräte:**\n` +
        devices
          .map(
            dev =>
              `• ${dev.name} (${dev.type})${dev.is_active ? " – aktiv" : ""}`
          )
          .join("\n")
      );
    }

    default:
      return `Unbekannte Spotify-Aktion: ${action}`;
  }
}

// ── tRPC-Router ──────────────────────────────────────────────────────────────

export const spotifyRouter = router({
  /** Status der Verbindung. */
  status: protectedProcedure.query(async ({ ctx }) => {
    const row = await getSpotifyToken(ctx.user.id);
    return {
      connected: !!row,
      displayName: row?.displayName ?? null,
      product: row?.product ?? null,
      isPremium: row?.product === "premium",
      configured: !!CLIENT_ID && !!CLIENT_SECRET,
    };
  }),

  /** Autorisierungs-URL für den OAuth-Flow. */
  getAuthUrl: protectedProcedure.query(({ ctx }) => {
    if (!CLIENT_ID) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Spotify ist nicht konfiguriert.",
      });
    }
    const url = new URL("https://accounts.spotify.com/authorize");
    url.searchParams.set("client_id", CLIENT_ID);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", getSpotifyRedirectUri(ctx.req));
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("state", String(ctx.user.id));
    url.searchParams.set("show_dialog", "false");
    return { url: url.toString() };
  }),

  disconnect: protectedProcedure.mutation(async ({ ctx }) => {
    await deleteSpotifyToken(ctx.user.id);
    return { success: true };
  }),

  /** Aktuell laufender Titel (für die UI). */
  nowPlaying: protectedProcedure.query(async ({ ctx }) => {
    const token = await getValidSpotifyAccessToken(ctx.user.id);
    if (!token) return { connected: false as const };
    const r = await spotifyFetch(
      token,
      "/me/player/currently-playing?market=CH"
    );
    if (r.status === 204 || !r.data)
      return { connected: true as const, playing: false as const };
    const d = r.data as {
      item?: TrackInfo;
      is_playing?: boolean;
      progress_ms?: number;
    };
    if (!d.item) return { connected: true as const, playing: false as const };
    return {
      connected: true as const,
      playing: !!d.is_playing,
      title: d.item.name,
      artist: (d.item.artists ?? []).map(a => a.name).join(", "),
      album: d.item.album?.name ?? null,
    };
  }),

  /** Steuerbefehl aus der UI. */
  control: protectedProcedure
    .input(
      z.object({
        action: z.enum([
          "play",
          "pause",
          "next",
          "previous",
          "volume",
          "shuffle",
          "current",
          "search",
          "playlists",
          "devices",
        ]),
        query: z.string().optional(),
        type: z.enum(["track", "album", "playlist", "artist"]).optional(),
        level: z.number().min(0).max(100).optional(),
        enabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { action, ...params } = input;
      const message = await executeSpotifyAction(ctx.user.id, action, params);
      return { message };
    }),
});
