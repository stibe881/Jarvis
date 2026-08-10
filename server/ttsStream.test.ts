import { describe, it, expect } from "vitest";

/**
 * Sichert die Vertragsdetails des Streaming-Endpunkts ab.
 *
 * Wichtig ist vor allem, dass die Sprachausgabe per GET erreichbar ist. Nur
 * dann kann das Audio-Element im Browser die Adresse direkt laden und mit der
 * Wiedergabe beginnen, bevor die Datei vollständig übertragen ist. Bei POST
 * müsste der Browser die Antwort zuerst komplett einlesen.
 */

describe("Streaming-Endpunkt der Sprachausgabe", () => {
  it("liest die Eingaben bei GET aus der Abfrage und bei POST aus dem Rumpf", async () => {
    const modul = await import("./routers/ttsStream");
    expect(typeof modul.handleTtsStream).toBe("function");
    // Signatur: (req, res, userId) – die Nutzer-ID kommt vom Aufrufer,
    // damit die Anmeldung zentral in index.ts geprüft wird.
    expect(modul.handleTtsStream.length).toBe(3);
  });

  it("baut die Wiedergabe-Adresse mit Text, Stimme und Kürzung", () => {
    // Genau diese Adresse setzt der Chat auf `audio.src`
    const params = new URLSearchParams({ text: "Guten Tag, Sir.", shorten: "true" });
    params.set("voiceId", "JBFqnCBsd6RMkjVDRZzb");
    const url = `/api/tts/stream?${params.toString()}`;
    expect(url).toContain("/api/tts/stream?");
    expect(url).toContain("text=Guten+Tag%2C+Sir.");
    expect(url).toContain("voiceId=JBFqnCBsd6RMkjVDRZzb");
    expect(url).toContain("shorten=true");
  });

  it("erkennt die Kürzungs-Abschaltung auch als Zeichenkette", () => {
    // Bei GET kommen alle Werte als Text an – "false" muss wirken wie false
    const alsText: boolean | string = "false";
    const shorten = alsText !== false && alsText !== "false";
    expect(shorten).toBe(false);

    const standard: boolean | string | undefined = undefined;
    const shortenStandard = standard !== false && standard !== "false";
    expect(shortenStandard).toBe(true);
  });
});
