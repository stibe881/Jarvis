import { describe, it, expect } from "vitest";

/**
 * Validiert die hinterlegten Spotify-Zugangsdaten über den
 * Client-Credentials-Flow (leichtgewichtiger Token-Endpoint).
 *
 * Live-Test: läuft nur, wenn die Spotify-Secrets gesetzt sind. Ohne Secrets
 * (z.B. in CI) wird die Suite übersprungen statt rot zu werden.
 */
const HAS_SPOTIFY = Boolean(
  process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET
);

describe.skipIf(!HAS_SPOTIFY)("Spotify-Zugangsdaten", () => {
  it("erhält ein Access-Token von Spotify", async () => {
    const id = process.env.SPOTIFY_CLIENT_ID;
    const secret = process.env.SPOTIFY_CLIENT_SECRET;

    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
      },
      body: "grant_type=client_credentials",
    });

    const data = (await res.json()) as {
      access_token?: string;
      error?: string;
    };
    expect(res.status, `Spotify-Antwort: ${JSON.stringify(data)}`).toBe(200);
    expect(typeof data.access_token).toBe("string");
    expect((data.access_token ?? "").length).toBeGreaterThan(20);
  }, 20000);
});
