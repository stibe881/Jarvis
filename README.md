# Jarvis – persönlicher KI-Assistent

Jarvis ist ein sprachfähiger KI-Assistent im Stil von Iron Man: Chat mit
Werkzeug-gestützter Agenten-Schleife, Sprachein- und -ausgabe, Kalender,
Aufgaben, Notizen, Musiksteuerung und Anbindung an ein ERP.

## Tech-Stack

- **Frontend:** React 19, Vite, wouter, TanStack Query, tRPC-Client, Tailwind, Radix UI
- **Backend:** Express, tRPC, Drizzle ORM (MySQL)
- **KI:** Anthropic Claude (über eine Forge-/LLM-Anbindung), Whisper (STT)
- **Sprache:** ElevenLabs TTS mit Browser-Stimme als Rückfall
- **Integrationen:** Google Kalender, Spotify, Supabase (ERP), iOS-Kurzbefehle

## Projektstruktur

```
client/    React-Frontend (Seiten, Komponenten, Hooks)
server/    Express + tRPC
  _core/   Framework-Glue (Env, Logging, Rate-Limit, Auth, LLM, ...)
  routers/ tRPC-Router und Express-Handler pro Feature
shared/    Von Client und Server gemeinsam genutzter Code (cleanText, wakeWord)
drizzle/   Datenbankschema und Migrationen
```

## Einrichtung

1. **Abhängigkeiten installieren**

   ```bash
   pnpm install
   ```

2. **Umgebungsvariablen setzen** (`.env` im Projektwurzelverzeichnis)

   Pflicht:

   | Variable                 | Zweck                            |
   | ------------------------ | -------------------------------- |
   | `DATABASE_URL`           | MySQL-Verbindung                 |
   | `JWT_SECRET`             | Signieren der Session-Cookies    |
   | `BUILT_IN_FORGE_API_KEY` | Zugang zur LLM-/Claude-Anbindung |

   Optional (aktivieren jeweils ein Feature):

   | Variable                                     | Feature                               |
   | -------------------------------------------- | ------------------------------------- |
   | `ELEVENLABS_API_KEY`                         | Sprachausgabe                         |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`   | Google Kalender                       |
   | `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | Spotify-Steuerung                     |
   | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`  | ERP-Kundendaten                       |
   | `TOKEN_ENCRYPTION_KEY`                       | Verschlüsselung ruhender OAuth-Tokens |

   Fehlt eine Pflichtvariable, bricht der Server beim Start mit einer klaren
   Meldung ab (in Produktion) bzw. warnt (in Entwicklung). Fehlende optionale
   Variablen deaktivieren nur das jeweilige Feature.

3. **Datenbank migrieren**

   ```bash
   pnpm db:push
   ```

4. **Entwicklungsserver starten**

   ```bash
   pnpm dev
   ```

## Skripte

| Skript               | Zweck                                 |
| -------------------- | ------------------------------------- |
| `pnpm dev`           | Entwicklungsserver mit Hot-Reload     |
| `pnpm build`         | Produktions-Build (Client + Server)   |
| `pnpm start`         | Produktionsserver starten             |
| `pnpm check`         | TypeScript-Typprüfung                 |
| `pnpm lint`          | ESLint                                |
| `pnpm format`        | Prettier (schreibend)                 |
| `pnpm format:check`  | Prettier-Prüfung (nur lesend, für CI) |
| `pnpm test`          | Vitest (einmalig)                     |
| `pnpm test:coverage` | Tests mit Coverage-Bericht            |

## Qualität

- **CI:** `.github/workflows/ci.yml` prüft bei jedem Push/PR Typen, Lint,
  Formatierung und Tests.
- **Pre-commit:** husky + lint-staged formatieren und linten geänderte Dateien
  automatisch vor jedem Commit.
- **Tests:** Vitest-Unit-Tests unter `server/**/*.test.ts`. Netzabhängige
  Live-Tests (ElevenLabs, Spotify) laufen nur, wenn die passenden Secrets
  gesetzt sind, und werden sonst übersprungen.

## Gesundheits-Check

`GET /health` (bzw. `/api/health`) liefert `{ status: "ok", uptime }` für
Monitoring und Deployment-Probes.
