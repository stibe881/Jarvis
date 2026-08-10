import { describe, it, expect } from "vitest";

/**
 * Prüft die ElevenLabs-Anbindung gegen die echte API.
 * Läuft absichtlich live, weil der Fehler «Jarvis spricht nicht» sonst
 * nicht nachweisbar ist (Kontingent, Schlüssel, Stimme).
 */
const KEY = process.env.ELEVENLABS_API_KEY ?? "";
const VOICE = "JBFqnCBsd6RMkjVDRZzb";

describe("ElevenLabs Sprachausgabe", () => {
  it("hat einen API-Schlüssel konfiguriert", () => {
    expect(KEY.length).toBeGreaterThan(10);
  });

  it("liefert das Nutzungskontingent des Abos", async () => {
    const r = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": KEY },
    });
    const body = await r.text();
    console.log("[Subscription]", r.status, body.slice(0, 400));
    expect(r.ok).toBe(true);
  }, 20000);

  it("erzeugt Audio für einen kurzen Satz", async () => {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}`, {
      method: "POST",
      headers: { "xi-api-key": KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        text: "Guten Morgen, Sir.",
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.8 },
      }),
    });
    if (!r.ok) {
      console.log("[TTS-Fehler]", r.status, (await r.text()).slice(0, 600));
    }
    expect(r.ok).toBe(true);
    const buf = await r.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(1000);
  }, 30000);
});
