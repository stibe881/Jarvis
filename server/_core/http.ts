/**
 * Gemeinsame HTTP-Helfer für ausgehende Aufrufe an externe Dienste
 * (Google, S3, Supabase, ElevenLabs, DuckDuckGo).
 *
 * Zweck: kein Aufruf darf den Server unbegrenzt blockieren. Jeder externe
 * `fetch` bekommt ein hartes Timeout; optional wird bei 5xx/Netzfehlern mit
 * Exponential-Backoff erneut versucht.
 */

const DEFAULT_TIMEOUT_MS = 10_000;

export type TimeoutInit = NonNullable<Parameters<typeof fetch>[1]> & {
  /** Timeout in Millisekunden (Standard: 10s). */
  timeoutMs?: number;
};

/** `fetch` mit hartem Timeout via AbortController. */
export async function fetchWithTimeout(
  url: string,
  init: TimeoutInit = {}
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // Falls der Aufrufer selbst ein Signal mitgibt, beide verknüpfen.
  if (signal) {
    if (signal.aborted) controller.abort();
    else
      signal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
  }
  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * `fetch` mit Timeout UND Retry (Exponential-Backoff mit Jitter) bei
 * 429/5xx-Antworten und Netzfehlern. Gibt die finale Response zurück, damit
 * bestehende Fehlerbehandlung der Aufrufer greift.
 */
export async function fetchWithRetry(
  url: string,
  init: TimeoutInit = {},
  opts: { retries?: number; baseDelayMs?: number; maxDelayMs?: number } = {}
): Promise<Response> {
  const { retries = 3, baseDelayMs = 400, maxDelayMs = 8_000 } = opts;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, init);
      if (response.ok || response.status < 500 || attempt === retries) {
        return response;
      }
      try {
        await response.body?.cancel();
      } catch {
        // Body bereits abgeschlossen.
      }
    } catch (error) {
      lastError = error;
      if (attempt === retries) throw error;
    }
    const cap = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
    await sleep(cap / 2 + Math.random() * (cap / 2));
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Anfrage an ${url} nach ${retries} Versuchen fehlgeschlagen`);
}
