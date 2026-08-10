# Deployment: Jarvis auf Hetzner Webhosting (Plesk + Node.js/Passenger)

Für Domain **ai-gross-ict.ch** auf Hetzner Managed Webhosting mit Node.js
(Plesk-Oberfläche, Node läuft über Phusion Passenger) und SSH-Zugang.

## ⚠️ Wichtige Voraussetzungen zuerst lesen

Die App läuft **unabhängig von der ursprünglichen Plattform (Manus/Forge)**:
Die KI nutzt deinen eigenen Anthropic-Key, der Login ein lokales Passwort.

| Variable            | Wofür                                  | Ohne sie …                        |
| ------------------- | -------------------------------------- | --------------------------------- |
| `DATABASE_URL`      | MySQL-Verbindung                       | Server startet nicht (Produktion) |
| `JWT_SECRET`        | Signieren des Session-Cookies          | Server startet nicht (Produktion) |
| `ANTHROPIC_API_KEY` | KI/Chat (Claude, direkt bei Anthropic) | **Chat/KI antwortet nicht**       |
| `APP_PASSWORD`      | Lokaler Login                          | **kein Login möglich**            |

`JWT_SECRET` kannst du selbst erzeugen: `openssl rand -hex 32`.
Der Anthropic-Key kommt aus <https://console.anthropic.com/settings/keys>.

> Die alten Plattform-Variablen (`OAUTH_SERVER_URL`, `VITE_APP_ID`,
> `BUILT_IN_FORGE_API_KEY`) werden **nicht mehr gebraucht**. Sind sie gesetzt,
> nutzt die App weiterhin den alten Weg – lass sie beim Self-Hosting einfach weg.

**Node-Version:** mindestens **20.11** (der Code nutzt `import.meta.dirname`).
In Plesk Node 20 LTS oder 22 wählen.

---

## Laufzeit-Layout (nach dem Build)

```
app/                 ← Application Root (das geklonte Repo)
  dist/
    index.js         ← Server-Bundle  → Passenger "Application Startup File"
    public/          ← gebautes Frontend → "Document Root"
  node_modules/      ← Produktions-Abhängigkeiten (zur Laufzeit nötig!)
  .env               ← Secrets
  package.json
```

Wichtig: Das Server-Bundle wird mit `--packages=external` gebaut, d. h. die
`node_modules` müssen zur Laufzeit vorhanden sein.

---

## Schritt 1 – Domain in Plesk anlegen

1. Plesk → **Websites & Domains** → Domain `ai-gross-ict.ch` hinzufügen
   (bzw. Abo dafür).
2. DNS: Bei deinem Domain-Provider einen **A-Record** (und ggf. AAAA) auf die
   IP des Hetzner-Webhostings setzen. Steht die Domain schon bei Hetzner, macht
   Plesk das meist automatisch.

## Schritt 2 – Code per SSH holen und bauen

```bash
ssh dein-user@dein-hetzner-host

# In das Domain-Verzeichnis wechseln (Pfad ggf. anpassen)
cd ~/ai-gross-ict.ch        # oder /var/www/vhosts/ai-gross-ict.ch

# Repo klonen
git clone https://github.com/stibe881/Jarvis.git app
cd app

# pnpm bereitstellen (Plesk liefert node+npm; corepack aktiviert pnpm)
corepack enable && corepack prepare pnpm@10.4.1 --activate
# Falls corepack fehlt:  npm install -g pnpm

pnpm install
pnpm build
```

> **RAM-Hinweis:** Der Frontend-Build ist speicherhungrig (mermaid/wasm-Chunks).
> Bricht `pnpm build` auf einem kleinen Plan mit „JavaScript heap out of memory"
> ab, baue **lokal** und lade nur `dist/` hoch, dann auf dem Server
> `pnpm install --prod` für die Laufzeit-Abhängigkeiten:
>
> ```bash
> # lokal:
> pnpm build
> rsync -av dist package.json pnpm-lock.yaml dein-user@host:~/ai-gross-ict.ch/app/
> # auf dem Server:
> cd ~/ai-gross-ict.ch/app && pnpm install --prod
> ```

## Schritt 3 – `.env` anlegen

```bash
cd ~/ai-gross-ict.ch/app
cat > .env <<'ENV'
NODE_ENV=production
# PORT wird von Passenger gesetzt – nicht selbst setzen.

DATABASE_URL=mysql://jqviwy_0:PASSWORT@m0s8.your-database.de:3306/jarvis
JWT_SECRET=<dein-jwt-secret>

# KI (eigener Anthropic-Key – ersetzt die Plattform-Anbindung):
ANTHROPIC_API_KEY=<dein-anthropic-key>

# Login (lokales Passwort – ersetzt den Plattform-OAuth):
APP_PASSWORD=<dein-wunschpasswort>
OWNER_NAME=Stefan

# Optionale Features:
ELEVENLABS_API_KEY=<...>
GOOGLE_CLIENT_ID=<...>
GOOGLE_CLIENT_SECRET=<...>
SPOTIFY_CLIENT_ID=<...>
SPOTIFY_CLIENT_SECRET=<...>
SUPABASE_URL=<...>
SUPABASE_SERVICE_ROLE_KEY=<...>
TOKEN_ENCRYPTION_KEY=<optional>
ENV
chmod 600 .env
```

> `VITE_APP_ID` wird zur **Build-Zeit** ins Frontend eingebacken. Ist der Wert
> beim `pnpm build` nicht gesetzt, ggf. mit gesetzter Variable neu bauen.

## Schritt 4 – Node.js in Plesk konfigurieren

Plesk → Domain `ai-gross-ict.ch` → **Node.js**:

- **Node.js-Version:** 20 (≥ 20.11) oder 22
- **Application Root:** `.../ai-gross-ict.ch/app`
- **Document Root:** `.../ai-gross-ict.ch/app/dist/public`
- **Application Startup File:** `dist/index.js`
- **Application Mode:** `production`
- **Custom environment variables:** entweder hier eintragen **oder** aus `.env`
  (die App lädt `.env` via dotenv). `NODE_ENV=production` sicherstellen.

Dann **„Enable Node.js"** bzw. **„Restart App"** klicken.

> Passenger setzt `PORT` selbst und leitet Anfragen an den Node-Prozess. Der
> Server bindet dank der Anpassung genau auf diesen Port/Socket – nichts weiter
> zu tun.

## Schritt 5 – HTTPS aktivieren

Plesk → Domain → **SSL/TLS-Zertifikate** → **Let's Encrypt** ausstellen
(inkl. `www.`-Alias). Danach „Weiterleitung von HTTP zu HTTPS" aktivieren.

## Schritt 6 – Testen

- `https://ai-gross-ict.ch/health` → sollte `{"status":"ok",...}` liefern.
- Startseite lädt (SPA), Login-Fluss testen (braucht OAuth-Config).

---

## Updates einspielen

```bash
cd ~/ai-gross-ict.ch/app
git pull origin main
pnpm install
pnpm build
# App neu starten: in Plesk "Restart App" ODER:
mkdir -p tmp && touch tmp/restart.txt
```

Passenger startet den Node-Prozess neu, sobald sich `tmp/restart.txt` ändert.

## Fehlersuche

- **502 / „We're sorry"**: Passenger-Log ansehen
  (Plesk → Node.js → „Show logs", oder `~/ai-gross-ict.ch/logs/`).
- **„Cannot find module"**: `node_modules` fehlt/unvollständig → `pnpm install`
  im Application Root, dann Restart.
- **`import.meta.dirname` undefined / Pfadfehler**: Node-Version < 20.11 →
  in Plesk höhere Version wählen.
- **Weisse Seite, aber /health ok**: Document Root zeigt nicht auf
  `dist/public`, oder `pnpm build` lief nicht.
- **Login schlägt fehl**: `OAUTH_SERVER_URL`/`VITE_APP_ID` fehlen oder der
  OAuth-Server ist nicht erreichbar.
- **KI antwortet nicht**: `BUILT_IN_FORGE_API_URL/KEY` fehlen oder ungültig.
- **DB-Fehler**: `DATABASE_URL` prüfen; der Hetzner-DB-Host muss vom Webhosting
  aus erreichbar sein (bei Hetzner i. d. R. der Fall).
