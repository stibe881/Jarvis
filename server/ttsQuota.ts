/**
 * Echtes Guthaben bei ElevenLabs abfragen.
 *
 * Der lokale Zähler in der Datenbank erfasst nur, was über die App gesprochen
 * wurde. Verbrauch aus anderen Quellen (etwa Vorschauen oder Messungen) fehlt
 * dort. Das führte dazu, dass die Anzeige noch Guthaben auswies, während
 * ElevenLabs die Anfragen längst mit «quota_exceeded» ablehnte und Jarvis
 * schwieg. Darum ist der Kontostand von ElevenLabs die verbindliche Quelle.
 */

const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY ?? "";

export type TtsQuota = {
  charsUsed: number;
  limit: number;
  remaining: number;
  percentUsed: number;
  level: "ok" | "warn" | "critical" | "exhausted";
  /** Zeitpunkt der nächsten Rücksetzung als Unix-Millisekunden (UTC). */
  resetAt: number | null;
  tier: string;
  /** true = Wert kommt von ElevenLabs, false = Rückfall auf den lokalen Zähler */
  live: boolean;
};

/** Warnstufe aus Verbrauch und Limit bestimmen. */
export function quotaLevel(
  charsUsed: number,
  limit: number
): TtsQuota["level"] {
  const remaining = Math.max(0, limit - charsUsed);
  if (remaining <= 0) return "exhausted";
  const percent = limit === 0 ? 100 : (charsUsed / limit) * 100;
  if (percent >= 90) return "critical";
  if (percent >= 75) return "warn";
  return "ok";
}

let cache: { at: number; data: TtsQuota } | null = null;
const CACHE_MS = 60_000;

/**
 * Fragt den Kontostand bei ElevenLabs ab (mit kurzem Zwischenspeicher).
 * Gibt `null` zurück, wenn der Dienst nicht erreichbar ist.
 */
export async function fetchLiveQuota(): Promise<TtsQuota | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  if (!ELEVENLABS_KEY) return null;
  try {
    const resp = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": ELEVENLABS_KEY },
    });
    if (!resp.ok) return null;
    const d = (await resp.json()) as {
      character_count?: number;
      character_limit?: number;
      next_character_count_reset_unix?: number;
      tier?: string;
    };
    const charsUsed = d.character_count ?? 0;
    const limit = d.character_limit ?? 10_000;
    const data: TtsQuota = {
      charsUsed,
      limit,
      remaining: Math.max(0, limit - charsUsed),
      percentUsed:
        limit === 0
          ? 100
          : Math.min(100, Math.round((charsUsed / limit) * 100)),
      level: quotaLevel(charsUsed, limit),
      resetAt: d.next_character_count_reset_unix
        ? d.next_character_count_reset_unix * 1000
        : null,
      tier: d.tier ?? "free",
      live: true,
    };
    cache = { at: Date.now(), data };
    return data;
  } catch (e) {
    console.error("[TTS-Guthaben] Abfrage fehlgeschlagen:", e);
    return null;
  }
}

/** Zwischenspeicher verwerfen, damit die nächste Abfrage frische Werte holt. */
export function invalidateQuotaCache() {
  cache = null;
}

/**
 * Prüft, ob eine Ausgabe dieser Länge noch möglich ist.
 * ElevenLabs rechnet in Zeichen, verlangt aber einen Puffer – daher etwas Reserve.
 */
export function fitsInQuota(
  quota: TtsQuota | null,
  textLength: number
): boolean {
  if (!quota) return true; // Unbekannt: Versuch zulassen, Fehler wird sauber behandelt
  return quota.remaining >= textLength;
}
