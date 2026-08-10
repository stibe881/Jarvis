# Jarvis iOS-App: Build & Upload zu App Store Connect (Expo/EAS)

> Diese Anleitung führt die Expo-App (das separate ZIP-Archiv, **nicht** dieses
> Web-Repo) über **EAS Build** und **EAS Submit** in App Store Connect / TestFlight.
> Sie muss **lokal auf deinem Mac** mit deinen Apple- und Expo-Zugangsdaten
> ausgeführt werden – aus der Cloud-Sandbox ist das nicht möglich (keine
> Credentials, kein Zugriff auf das Apple-Developer-Portal).

## 0. Voraussetzungen (einmalig)

- **Apple Developer Program** aktiv (99 USD/Jahr) → https://developer.apple.com/account
- **Expo-Konto** → https://expo.dev (kostenlos)
- **Node + EAS CLI** lokal:
  ```bash
  npm install -g eas-cli
  eas login            # mit deinem Expo-Konto
  ```
- Das **Expo-App-Projekt** entpackt (aus dem ZIP) und `npm install` darin ausgeführt.
- Ein **App-Eintrag in App Store Connect** (siehe Schritt 3).

## 1. `eas.json` im Expo-Projekt anlegen

Lege diese Datei im Wurzelverzeichnis des Expo-Projekts ab (nicht in diesem Web-Repo):

```json
{
  "cli": {
    "version": ">= 12.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": true }
    },
    "production": {
      "autoIncrement": true,
      "ios": {
        "resourceClass": "m-medium"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "DEINE_APPLE_ID_EMAIL",
        "ascAppId": "APP_STORE_CONNECT_APP_ID",
        "appleTeamId": "DEIN_TEAM_ID"
      }
    }
  }
}
```

- `ascAppId`: die numerische App-ID aus App Store Connect (App → App-Informationen → Apple-ID).
- `appleTeamId`: aus https://developer.apple.com/account → Membership.
- `appleId`: die E-Mail deines Apple-Developer-Kontos.

## 2. `app.json` / `app.config.js` prüfen

Stelle sicher, dass die iOS-Metadaten gesetzt sind:

```json
{
  "expo": {
    "name": "Jarvis",
    "slug": "jarvis",
    "version": "1.0.0",
    "ios": {
      "bundleIdentifier": "me.stibe.jarvis",
      "buildNumber": "1",
      "supportsTablet": true,
      "infoPlist": {
        "NSMicrophoneUsageDescription": "Jarvis nutzt das Mikrofon für Sprachbefehle.",
        "NSSpeechRecognitionUsageDescription": "Für die Umwandlung deiner Sprache in Text."
      }
    },
    "icon": "./assets/icon.png"
  }
}
```

- `bundleIdentifier` muss exakt dem in App Store Connect angelegten Bundle
  entsprechen und ist nach der ersten Veröffentlichung **unveränderlich**.
- Mit `"autoIncrement": true` (in `eas.json`) erhöht EAS die `buildNumber`
  automatisch bei jedem Production-Build.
- Icon: 1024×1024 px, ohne Alphakanal/Transparenz.

## 3. App in App Store Connect registrieren (einmalig)

1. https://appstoreconnect.apple.com → **Apps** → **+** → **Neue App**
2. Plattform iOS, Name „Jarvis", Primärsprache Deutsch, Bundle-ID auswählen
   (muss zuvor unter developer.apple.com → Identifiers angelegt sein),
   SKU frei wählbar (z. B. `jarvis-ios`).
3. Die dabei vergebene **Apple-ID (numerisch)** → in `eas.json` als `ascAppId`.

## 4. Production-Build erstellen

```bash
eas build --platform ios --profile production
```

- Beim ersten Mal fragt EAS nach Signing: **„Let EAS manage credentials"** wählen –
  EAS erzeugt und verwaltet Distribution-Zertifikat und Provisioning-Profil.
- Der Build läuft auf Expos Servern; am Ende gibt es eine `.ipa`-Datei/URL.

## 5. Zu App Store Connect / TestFlight hochladen

Empfohlen: **App-Store-Connect-API-Key** (kein App-spezifisches Passwort nötig).

1. App Store Connect → **Users and Access** → **Integrations / Keys** →
   API-Key mit Rolle „App Manager" erzeugen, `.p8` herunterladen, **Key ID**
   und **Issuer ID** notieren.
2. Hochladen:
   ```bash
   eas submit --platform ios --profile production --latest
   ```
   EAS fragt nach dem `.p8`-Key (oder nimm die zuletzt erstellte Build via `--latest`).

Alternativ ohne API-Key: `appleId` + App-spezifisches Passwort
(https://account.apple.com → Anmeldung & Sicherheit → App-spezifische Passwörter).

## 6. TestFlight & Review

- Nach dem Upload erscheint der Build nach einigen Minuten unter
  **TestFlight** (erst nach Verarbeitung testbar).
- Für die Veröffentlichung: App Store Connect → **App Store** → Version anlegen,
  Screenshots (mind. 6,7"‑iPhone), Beschreibung, Keywords, Datenschutz-Angaben
  („App-Datenschutz") ausfüllen → **Zur Prüfung einreichen**.
- Erst-Reviews dauern meist 24–48 h.

## Einzeiler für Folge-Releases

```bash
# Version in app.json anheben (oder buildNumber via autoIncrement)
eas build --platform ios --profile production --auto-submit
```

`--auto-submit` baut und lädt in einem Schritt hoch.

## Häufige Stolpersteine

- **Bundle-ID stimmt nicht** mit App Store Connect überein → Build lässt sich
  nicht submitten. Vorher in `app.json` und im Developer-Portal abgleichen.
- **Icon mit Transparenz** → Apple lehnt ab. 1024×1024 opak (ohne Alpha).
- **Fehlende Usage-Descriptions** (Mikrofon/Sprache) → Ablehnung im Review.
  In `infoPlist` setzen (siehe Schritt 2).
- **`buildNumber` nicht erhöht** → Upload-Fehler „redundant binary". Mit
  `autoIncrement` in `eas.json` vermeiden.
- **Export-Compliance**: Bei erster Version fragt App Store Connect nach
  Verschlüsselung – wenn nur HTTPS-Standard genutzt wird, „Nein" bzw. die
  Ausnahme wählen.

---

Kurzfassung der Reihenfolge:
`eas login` → `eas.json` + `app.json` prüfen → App in ASC anlegen →
`eas build -p ios --profile production` → `eas submit -p ios --latest` →
TestFlight → Review einreichen.
