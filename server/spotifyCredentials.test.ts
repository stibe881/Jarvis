import { describe, it, expect } from "vitest";

/**
 * Validiert die hinterlegten Spotify-Zugangsdaten über den
 * Client-Credentials-Flow (leichtgewichtiger Token-Endpoint).
 */
describe("Spotify-Zugangsdaten", () => {
  it("erhält ein Access-Token von Spotify", async () => {
    const id = process.env.SPOTIFY_CLIENT_ID;
    const secret = process.env.SPOTIFY_CLIENT_SECRET;
    expect(id, "SPOTIFY_CLIENT_ID fehlt").toBeTruthy();
    expect(secret, "SPOTIFY_CLIENT_SECRET fehlt").toBeTruthy();

    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
      },
      body: "grant_type=client_credentials",
    });

    const data = (await res.json()) as { access_token?: string; error?: string };
    expect(res.status, `Spotify-Antwort: ${JSON.stringify(data)}`).toBe(200);
    expect(typeof data.access_token).toBe("string");
    expect((data.access_token ?? "").length).toBeGreaterThan(20);
  }, 20000);
});
