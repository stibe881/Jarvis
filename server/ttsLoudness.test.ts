import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Die Lautstärke von Jarvis schwankte von Antwort zu Antwort. Zwei Ursachen:
 *
 * 1. Die beiden Server-Wege nutzten unterschiedliche Modelle und
 *    Stimm-Einstellungen (inkl. `use_speaker_boost`, das die Lautheit je
 *    nach Aufnahme unterschiedlich stark anhebt).
 * 2. Im Browser lief der Ton ohne Ausgleich direkt zur Ausgabe, sodass die
 *    von ElevenLabs gelieferte Lautheit ungefiltert durchkam.
 *
 * Diese Tests halten beide Korrekturen fest.
 */

const lese = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("Einheitliche Lautheit der Sprachausgabe", () => {
  const stream = lese("server/routers/ttsStream.ts");
  const mutation = lese("server/routers/elevenlabs.ts");

  it("beide Server-Wege nutzen dasselbe Modell", () => {
    expect(stream).toContain('model_id: "eleven_flash_v2_5"');
    expect(mutation).toContain('model_id: "eleven_flash_v2_5"');
  });

  it("kein Speaker-Boost, weil er die Lautheit unterschiedlich anhebt", () => {
    expect(stream).toContain("use_speaker_boost: false");
    expect(mutation).toContain("use_speaker_boost: false");
  });

  it("hohe Stabilität und kein Stil-Anteil in beiden Wegen", () => {
    for (const datei of [stream, mutation]) {
      expect(datei).toContain("stability: 0.75");
      expect(datei).toContain("style: 0,");
    }
  });
});

describe("Lautstärke-Kette im Browser", () => {
  const chat = lese("client/src/pages/JarvisChat.tsx");

  it("nutzt einen Kompressor, um Lautheitsunterschiede auszugleichen", () => {
    expect(chat).toContain("createDynamicsCompressor");
    expect(chat).toContain("threshold.value = -24");
    expect(chat).toContain("ratio.value = 4");
  });

  it("hebt das komprimierte Signal mit festem Verstärker an", () => {
    expect(chat).toContain("createGain");
    expect(chat).toContain("gain.gain.value = 1.6");
  });

  it("leitet das Audio-Element durch die Kette", () => {
    expect(chat).toContain("createMediaElementSource");
    expect(chat).toContain("attachElementToChain");
  });

  it("setzt in allen Wegen eine feste Lautstärke", () => {
    // Audio-Element
    expect(chat).toContain("el.volume = 1");
    // Browser-Stimme (beide Stellen)
    const treffer = chat.match(/utterance\.volume = 1/g) ?? [];
    expect(treffer.length).toBeGreaterThanOrEqual(2);
  });

  it("führt den WebAudio-Ausweichweg über dieselbe Kette", () => {
    // Der Puffer-Weg darf nicht direkt an die Ausgabe gehen
    expect(chat).toContain("if (chain) source.connect(chain.input)");
  });
});
