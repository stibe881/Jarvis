import { describe, it, expect, beforeEach } from "vitest";
import "dotenv/config";
import {
  quotaLevel,
  fitsInQuota,
  fetchLiveQuota,
  invalidateQuotaCache,
  type TtsQuota,
} from "./ttsQuota";

/**
 * Hintergrund: Jarvis verstummte, weil der lokale Zähler noch Guthaben auswies,
 * ElevenLabs die Anfragen aber mit «quota_exceeded» ablehnte. Der Kontostand
 * bei ElevenLabs muss deshalb die verbindliche Quelle sein.
 */
describe("Guthaben der Sprachausgabe", () => {
  beforeEach(() => invalidateQuotaCache());

  it("stuft den Verbrauch korrekt ein", () => {
    expect(quotaLevel(0, 10000)).toBe("ok");
    expect(quotaLevel(7000, 10000)).toBe("ok");
    expect(quotaLevel(7500, 10000)).toBe("warn");
    expect(quotaLevel(9000, 10000)).toBe("critical");
    expect(quotaLevel(10000, 10000)).toBe("exhausted");
    expect(quotaLevel(12000, 10000)).toBe("exhausted");
  });

  it("erkennt, ob ein Text noch ins Guthaben passt", () => {
    const quota: TtsQuota = {
      charsUsed: 9949,
      limit: 10000,
      remaining: 51,
      percentUsed: 99,
      level: "critical",
      resetAt: null,
      tier: "free",
      live: true,
    };
    expect(fitsInQuota(quota, 40)).toBe(true);
    expect(fitsInQuota(quota, 160)).toBe(false);
    // Unbekanntes Guthaben: Versuch zulassen
    expect(fitsInQuota(null, 5000)).toBe(true);
  });

  it("fragt den echten Kontostand bei ElevenLabs ab", async () => {
    const quota = await fetchLiveQuota();
    if (!quota) {
      console.warn("[Guthaben] übersprungen – Dienst nicht erreichbar");
      return;
    }
    console.log(
      `[Guthaben] ${quota.charsUsed}/${quota.limit} verbraucht, ${quota.remaining} übrig, Plan ${quota.tier}`
    );
    expect(quota.live).toBe(true);
    expect(quota.limit).toBeGreaterThan(0);
    expect(quota.charsUsed).toBeGreaterThanOrEqual(0);
    expect(quota.remaining).toBe(Math.max(0, quota.limit - quota.charsUsed));
    expect(["ok", "warn", "critical", "exhausted"]).toContain(quota.level);
  }, 30000);

  it("nutzt einen Zwischenspeicher, damit nicht jede Ausgabe eine Abfrage auslöst", async () => {
    const erste = await fetchLiveQuota();
    if (!erste) return;
    const start = Date.now();
    const zweite = await fetchLiveQuota();
    const dauer = Date.now() - start;
    expect(zweite).toEqual(erste);
    // Aus dem Zwischenspeicher muss es praktisch sofort kommen
    expect(dauer).toBeLessThan(100);
  }, 30000);
});
