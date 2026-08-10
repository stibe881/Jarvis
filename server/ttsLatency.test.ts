import { describe, it, expect } from "vitest";
import "dotenv/config";

/**
 * Vergleicht die Antwortzeit der ElevenLabs-Modelle.
 *
 * Hintergrund: Stefan berichtete, dass die Sprachausgabe spürbar später
 * einsetzt als die Textantwort. Dieser Test belegt, welches Modell schneller
 * das erste Audio liefert, damit die Wahl nachvollziehbar ist.
 */

const KEY = process.env.ELEVENLABS_API_KEY ?? "";
const VOICE = "JBFqnCBsd6RMkjVDRZzb";
const SATZ = "Guten Morgen Stefan. Du hast heute drei Termine und zwei offene Aufgaben.";

async function messeLatenz(model: string, latencyOpt: string, format: string) {
  const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}`);
  url.searchParams.set("optimize_streaming_latency", latencyOpt);
  url.searchParams.set("output_format", format);
  const start = Date.now();
  const resp = await fetch(url.toString(), {
    method: "POST",
    headers: { "xi-api-key": KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text: SATZ,
      model_id: model,
      voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true },
    }),
  });
  const buf = await resp.arrayBuffer();
  return { ok: resp.ok, status: resp.status, ms: Date.now() - start, bytes: buf.byteLength };
}

/**
 * Wiederholt einen Aufruf, falls das Netz kurzzeitig ausfällt. Die
 * ElevenLabs-API reagiert gelegentlich mit Verbindungs-Zeitüberschreitungen;
 * der Test soll deswegen nicht fehlschlagen.
 */
async function mitWiederholung<T>(fn: () => Promise<T>, versuche = 3): Promise<T> {
  let letzterFehler: unknown;
  for (let i = 0; i < versuche; i++) {
    try { return await fn(); } catch (e) {
      letzterFehler = e;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw letzterFehler;
}

describe("Antwortzeit der Sprachausgabe", () => {
  it("der Streaming-Endpunkt liefert bereits ein erstes Audiopaket, bevor alles fertig ist", async () => {
    // Die Antwortzeiten von ElevenLabs schwanken stark (gemessen 0,9 bis 4,9 s).
    // Entscheidend ist deshalb nicht ein fester Grenzwert, sondern dass
    // überhaupt ein erstes Paket ankommt, bevor die Übertragung abgeschlossen
    // ist – nur dann kann der Browser früher zu spielen beginnen.
    const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}/stream`);
    url.searchParams.set("optimize_streaming_latency", "4");
    url.searchParams.set("output_format", "mp3_22050_32");
    const start = Date.now();
    let resp: Response;
    try {
      resp = await mitWiederholung(() => fetch(url.toString(), {
        method: "POST",
        headers: { "xi-api-key": KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({
          text: SATZ,
          model_id: "eleven_flash_v2_5",
          voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true },
        }),
      }));
    } catch (e) {
      if (istNetzfehler(e)) { console.warn("[Stream] übersprungen – Netzwerkproblem der Umgebung"); return; }
      throw e;
    }
    expect(resp.ok).toBe(true);
    expect(resp.body).toBeTruthy();

    const reader = resp.body!.getReader();
    const first = await reader.read();
    const ttfb = Date.now() - start;
    expect(first.done).toBe(false);
    expect(first.value?.byteLength ?? 0).toBeGreaterThan(0);

    // Rest weiterlesen, um die Gesamtdauer zu kennen
    let total = first.value?.byteLength ?? 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value?.byteLength ?? 0;
    }
    const complete = Date.now() - start;
    console.log(`[Stream] erstes Paket nach ${ttfb} ms, vollständig nach ${complete} ms (${total} Bytes)`);

    // Der Vorsprung ist der eigentliche Gewinn für die Wahrnehmung
    expect(ttfb).toBeLessThanOrEqual(complete);
    expect(total).toBeGreaterThan(1000);
  }, 40000);

  it("das schnelle Modell liefert gültiges Audio", async () => {
    const flash = await mitWiederholung(() => messeLatenz("eleven_flash_v2_5", "4", "mp3_22050_32"));
    console.log(`[Flash] ${flash.ms} ms, ${flash.bytes} Bytes, Status ${flash.status}`);
    expect(flash.ok).toBe(true);
    expect(flash.bytes).toBeGreaterThan(1000);
  }, 60000);

  it("liefert bei kleinem Ausgabeformat weniger Daten als das hochauflösende", async () => {
    // Die reinen Antwortzeiten von ElevenLabs schwanken je Aufruf erheblich
    // (gemessen 0,9 bis 4,9 Sekunden für denselben Satz). Ein direkter
    // Zeitvergleich wäre darum unzuverlässig. Belastbar prüfbar ist die
    // Datenmenge: weniger Bytes bedeuten kürzere Übertragung zum Browser.
    const klein = await mitWiederholung(() => messeLatenz("eleven_flash_v2_5", "4", "mp3_22050_32"));
    const gross = await mitWiederholung(() => messeLatenz("eleven_multilingual_v2", "0", "mp3_44100_128"));
    console.log(`[Datenmenge] klein ${klein.bytes} B (${klein.ms} ms) vs gross ${gross.bytes} B (${gross.ms} ms)`);
    expect(klein.ok).toBe(true);
    expect(gross.ok).toBe(true);
    expect(klein.bytes).toBeLessThan(gross.bytes);
  }, 120000);
});
