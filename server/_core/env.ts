import { z } from "zod";

/**
 * Zentrale, Zod-validierte Umgebungskonfiguration.
 *
 * Ziel: Fehlende oder falsch getippte Secrets sollen beim Start klar auffallen –
 * nicht erst mitten in einem Request als verwirrendes `undefined`. Das Modul
 * wirft bewusst NICHT beim Import (sonst brechen Tests, die nur Teilbereiche
 * nutzen). Stattdessen prüft `validateEnv()` beim Server-Boot streng und meldet
 * Probleme deutlich.
 */

const RAW = process.env;

// Vollständiges Schema aller bekannten Variablen. Optionale Integrationen
// (Google, Spotify, Supabase, ElevenLabs) dürfen fehlen; ihr Fehlen wird beim
// Boot als Warnung ausgegeben, damit man weiß, welche Features inaktiv sind.
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),

  // Kern (für den Serverbetrieb erforderlich)
  DATABASE_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(1).optional(),

  // Plattform-/Forge-Anbindung
  VITE_APP_ID: z.string().optional(),
  OAUTH_SERVER_URL: z.string().url().optional().or(z.literal("")),
  OWNER_OPEN_ID: z.string().optional(),
  BUILT_IN_FORGE_API_URL: z.string().optional(),
  BUILT_IN_FORGE_API_KEY: z.string().optional(),

  // Direkte KI-Anbindung (eigener Anthropic-Key statt Plattform-Proxy)
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  // Lokaler Passwort-Login (ersetzt den Plattform-OAuth beim Self-Hosting).
  APP_PASSWORD: z.string().optional(),
  OWNER_NAME: z.string().optional(),

  // Öffentliche Basis-URL der App (z.B. https://ai-gross-ict.ch) – Grundlage
  // der OAuth-Redirect-URIs für Google und Spotify. Ohne Angabe wird sie aus
  // dem Request abgeleitet.
  APP_URL: z.string().url().optional().or(z.literal("")),

  // Optionale Integrationen
  ELEVENLABS_API_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  MS_CLIENT_ID: z.string().optional(),
  MS_CLIENT_SECRET: z.string().optional(),
  SPOTIFY_CLIENT_ID: z.string().optional(),
  SPOTIFY_CLIENT_SECRET: z.string().optional(),
  SUPABASE_URL: z.string().url().optional().or(z.literal("")),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // Verschlüsselung ruhender OAuth-Tokens (optional; ohne Schlüssel bleibt
  // die bisherige Klartextspeicherung als Rückfall aktiv).
  TOKEN_ENCRYPTION_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(RAW);

// Beim Import tolerant bleiben: bei Parse-Fehlern (z.B. ungültige URL) auf die
// Rohwerte zurückfallen, damit Importe nie hart scheitern. Die strenge Prüfung
// erfolgt in validateEnv().
const values = parsed.success
  ? parsed.data
  : ({
      NODE_ENV:
        (RAW.NODE_ENV as "development" | "production" | "test") ??
        "development",
      PORT: Number(RAW.PORT) || 3000,
      DATABASE_URL: RAW.DATABASE_URL,
      JWT_SECRET: RAW.JWT_SECRET,
      VITE_APP_ID: RAW.VITE_APP_ID,
      OAUTH_SERVER_URL: RAW.OAUTH_SERVER_URL,
      OWNER_OPEN_ID: RAW.OWNER_OPEN_ID,
      BUILT_IN_FORGE_API_URL: RAW.BUILT_IN_FORGE_API_URL,
      BUILT_IN_FORGE_API_KEY: RAW.BUILT_IN_FORGE_API_KEY,
      ANTHROPIC_API_KEY: RAW.ANTHROPIC_API_KEY,
      ANTHROPIC_MODEL: RAW.ANTHROPIC_MODEL,
      OPENAI_API_KEY: RAW.OPENAI_API_KEY,
      APP_PASSWORD: RAW.APP_PASSWORD,
      OWNER_NAME: RAW.OWNER_NAME,
      APP_URL: RAW.APP_URL,
      ELEVENLABS_API_KEY: RAW.ELEVENLABS_API_KEY,
      GOOGLE_CLIENT_ID: RAW.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: RAW.GOOGLE_CLIENT_SECRET,
      MS_CLIENT_ID: RAW.MS_CLIENT_ID,
      MS_CLIENT_SECRET: RAW.MS_CLIENT_SECRET,
      SPOTIFY_CLIENT_ID: RAW.SPOTIFY_CLIENT_ID,
      SPOTIFY_CLIENT_SECRET: RAW.SPOTIFY_CLIENT_SECRET,
      SUPABASE_URL: RAW.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: RAW.SUPABASE_SERVICE_ROLE_KEY,
      TOKEN_ENCRYPTION_KEY: RAW.TOKEN_ENCRYPTION_KEY,
    } as z.infer<typeof envSchema>);

/**
 * Rückwärtskompatibler ENV-Export. Bestehende Importe erwarten genau diese
 * Schlüssel – Form daher unverändert lassen.
 */
export const ENV = {
  appId: values.VITE_APP_ID ?? "",
  cookieSecret: values.JWT_SECRET ?? "",
  databaseUrl: values.DATABASE_URL ?? "",
  oAuthServerUrl: values.OAUTH_SERVER_URL ?? "",
  ownerOpenId: values.OWNER_OPEN_ID ?? "",
  isProduction: values.NODE_ENV === "production",
  forgeApiUrl: values.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: values.BUILT_IN_FORGE_API_KEY ?? "",
};

/** Voll typisierter Zugriff auf alle Variablen. */
export const env = values;

// Für den Betrieb zwingend erforderliche Variablen.
const REQUIRED_KEYS = ["DATABASE_URL", "JWT_SECRET"] as const;

// Optionale Integrationen: Fehlen deaktiviert nur das jeweilige Feature.
const OPTIONAL_GROUPS: Record<string, readonly string[]> = {
  "Sprachausgabe (ElevenLabs)": ["ELEVENLABS_API_KEY"],
  "Google Kalender": ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  "Microsoft Kalender": ["MS_CLIENT_ID", "MS_CLIENT_SECRET"],
  Spotify: ["SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET"],
  "ERP (Supabase)": ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
};

/**
 * Strenge Prüfung beim Server-Boot. Fehlende Pflichtvariablen führen in
 * Produktion zum Abbruch; im Entwicklungsmodus nur zu einer deutlichen Warnung,
 * damit man lokal ohne komplette Secrets arbeiten kann.
 */
export function validateEnv(): void {
  if (!parsed.success) {
    console.error("[env] Ungültige Umgebungsvariablen:");
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
  }

  const missingRequired = REQUIRED_KEYS.filter(key => !RAW[key]);
  if (missingRequired.length > 0) {
    const msg = `[env] Fehlende Pflicht-Umgebungsvariablen: ${missingRequired.join(", ")}`;
    if (values.NODE_ENV === "production") {
      throw new Error(msg);
    }
    console.warn(`${msg} (im Entwicklungsmodus toleriert)`);
  }

  // Mindestens ein LLM-Backend muss konfiguriert sein: eigener Anthropic-Key
  // (bevorzugt) oder der alte Forge-Proxy.
  if (!RAW.ANTHROPIC_API_KEY && !RAW.BUILT_IN_FORGE_API_KEY) {
    const msg =
      "[env] Kein LLM-Backend konfiguriert: ANTHROPIC_API_KEY (empfohlen) oder BUILT_IN_FORGE_API_KEY setzen";
    if (values.NODE_ENV === "production") {
      throw new Error(msg);
    }
    console.warn(`${msg} (im Entwicklungsmodus toleriert)`);
  }

  for (const [feature, keys] of Object.entries(OPTIONAL_GROUPS)) {
    const missing = keys.filter(key => !RAW[key]);
    if (missing.length > 0) {
      console.warn(`[env] ${feature} inaktiv – fehlt: ${missing.join(", ")}`);
    }
  }
}
