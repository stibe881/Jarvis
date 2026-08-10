import { describe, it, expect } from "vitest";
import { describeDeviceCommand } from "./routers/deviceCommands";

describe("Geräte-Befehle (iOS-Kurzbefehle)", () => {
  it("beschreibt eine WhatsApp-Nachricht lesbar", () => {
    const text = describeDeviceCommand("whatsapp", {
      recipient: "Bine",
      message: "Ich komme später",
    });
    expect(text).toContain("Bine");
    expect(text).toContain("Ich komme später");
  });

  it("beschreibt einen Wecker mit Uhrzeit", () => {
    expect(
      describeDeviceCommand("alarm", { time: "06:30", label: "Aufstehen" })
    ).toContain("06:30");
  });

  it("beschreibt einen Timer mit Minuten", () => {
    expect(describeDeviceCommand("timer", { minutes: 15 })).toContain("15");
  });

  it("fällt bei unbekanntem Typ nicht aus", () => {
    expect(describeDeviceCommand("unbekannt", {})).toContain("unbekannt");
  });
});

describe("Spotify-Aktionsblock-Parser", () => {
  /** Gleiche Logik wie im Chat-Router: Blöcke extrahieren und entfernen. */
  function parseSpotifyBlocks(text: string) {
    const rx = /<spotify_action>([\s\S]*?)<\/spotify_action>/g;
    const found: Record<string, unknown>[] = [];
    let m: RegExpExecArray | null;
    while ((m = rx.exec(text)) !== null) {
      found.push(JSON.parse(m[1].trim()) as Record<string, unknown>);
    }
    const clean = text
      .replace(/<spotify_action>[\s\S]*?<\/spotify_action>/g, "")
      .trim();
    return { found, clean };
  }

  it("erkennt einen Play-Block und entfernt ihn aus der Antwort", () => {
    const answer =
      'Gerne, ich spiele das.\n<spotify_action>{"action":"play","query":"Coldplay Yellow","type":"track"}</spotify_action>';
    const { found, clean } = parseSpotifyBlocks(answer);
    expect(found).toHaveLength(1);
    expect(found[0].action).toBe("play");
    expect(found[0].query).toBe("Coldplay Yellow");
    expect(clean).not.toContain("spotify_action");
  });

  it("erkennt mehrere Blöcke", () => {
    const answer =
      '<spotify_action>{"action":"pause"}</spotify_action><spotify_action>{"action":"volume","level":30}</spotify_action>';
    const { found } = parseSpotifyBlocks(answer);
    expect(found).toHaveLength(2);
    expect(found[1].level).toBe(30);
  });

  it("lässt Antworten ohne Block unverändert", () => {
    const { found, clean } = parseSpotifyBlocks(
      "Ich habe keine Musik gestartet."
    );
    expect(found).toHaveLength(0);
    expect(clean).toBe("Ich habe keine Musik gestartet.");
  });
});

describe("device_action-Parser", () => {
  it("erkennt einen WhatsApp-Block", () => {
    const answer =
      'Erledigt.\n<device_action>{"type":"whatsapp","recipient":"Bine","message":"Bin unterwegs"}</device_action>';
    const rx = /<device_action>([\s\S]*?)<\/device_action>/g;
    const m = rx.exec(answer);
    expect(m).not.toBeNull();
    const parsed = JSON.parse(m![1].trim()) as {
      type: string;
      recipient: string;
    };
    expect(parsed.type).toBe("whatsapp");
    expect(parsed.recipient).toBe("Bine");
    expect(
      answer.replace(/<device_action>[\s\S]*?<\/device_action>/g, "").trim()
    ).toBe("Erledigt.");
  });
});
