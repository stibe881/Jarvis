# Jarvis – Projekt TODO

## Backend
- [x] Datenbankschema: conversations, messages, notes, tasks, uploaded_files
- [x] Anthropic API Key als Secret setzen (ANTHROPIC_API_KEY)
- [x] Claude Chat-Route mit Streaming (SSE) via direktem Anthropic SDK
- [x] Voice-Transcription-Route (Whisper)
- [x] Text-to-Speech-Ausgabe (Browser Web Speech API)
- [x] Datei-Upload-Route (S3 + Analyse durch Claude)
- [x] Web-Suche-Route (DuckDuckGo API)
- [x] Notizen CRUD (erstellen, lesen, aktualisieren, löschen, suchen)
- [x] Aufgaben/Kalender CRUD (erstellen, erledigen, nach Datum filtern)
- [x] Gesprächsverlauf speichern und laden

## Web-Frontend
- [x] Globales Dark-Theme (futuristisch, blau/cyan Akzente)
- [x] DashboardLayout mit Sidebar-Navigation
- [x] Jarvis Chat-Seite mit Streaming, Markdown-Rendering, Datei-Upload
- [x] Animierte Jarvis-Statusanzeige (Pulsring / Orb)
- [x] Spracheingabe (Mikrofon → Whisper)
- [x] Sprachausgabe (Text-to-Speech via Web Speech API)
- [x] Notizen-Seite (Liste, Erstellen, Bearbeiten, Suchen)
- [x] Aufgaben/Kalender-Seite (Liste, Erstellen, Erledigen, Datum)
- [x] Datei-Upload in Chat integriert
- [x] Web-Suche in Chat integriert

## Tests
- [x] Backend-Unit-Tests für Chat-Route (13 Tests, alle grün)
- [x] Backend-Unit-Tests für Notizen/Aufgaben

## Neue Features (Phase 2)
- [x] Mobile-Layout: responsiv, Bottom-Navigation auf kleinen Bildschirmen
- [x] Chat-Sidebar auf Mobile: ausblendbar per Hamburger-Menü
- [x] Bessere Dateianalyse: PDFs und Bilder als Claude Vision/File-Input senden
- [x] Push-Benachrichtigungen für Aufgaben-Fälligkeiten (notifyOwner)
- [x] Expo iOS-App: Chat, Notizen, Aufgaben (ZIP-Archiv)

## Google Calendar-Integration
- [x] Google OAuth-Secrets setzen (Client ID + Secret)
- [x] DB-Schema: google_tokens Tabelle
- [x] OAuth-Flow: /api/oauth/google/callback
- [x] Google Calendar API: Termine lesen, erstellen, bearbeiten, löschen
- [x] Kalender-UI: Monats-/Wochenansicht mit Terminen
- [x] Chat-Integration: Jarvis versteht Kalender-Befehle

## Phase 3 – 13 Verbesserungen
- [x] 1 Onboarding-Wizard beim ersten Start (Profil, Kalender, Sprachausgabe)
- [ ] 4 PWA mit Benachrichtigungs-Badge (offene Aufgaben + Tickets)
- [x] 6 Kontextbewusstes Nachfragen bei unklaren Anfragen
- [x] 7 Proaktive Tagesplanung (Prioritäten-Vorschlag)
- [x] 8 Lernende Quick-Action-Vorschläge (prompt_stats) – Backend
- [x] 9 Dokument-Zusammenfassung mit Handlungsempfehlungen
- [x] 10 E-Mail-Entwurf aus App-Kontext (Mahnung, Angebot, Nachfrage)
- [x] 14 Dokumenten-Vorlagen mit Platzhaltern und PDF-Export
- [ ] 16 Desktop-Widget als installierbare PWA im Kompaktmodus
- [x] 17 Aufgaben-Delegation mit E-Mail-Entwurf und Frist
- [x] 18 Sprachnotizen mit Transkription und Kategorisierung
- [x] 19 Wöchentlicher Bericht (Freitag-Cron) – Handler bereit, Cron nach Deploy
- [x] 20 Webhook-API für externe Integrationen (API-Keys)
- [ ] 8b Lernende Vorschläge im Chat-Frontend anzeigen

## Phase 4 – Geräte- und Musiksteuerung
- [ ] Spotify OAuth (Client ID/Secret, Refresh-Token-Speicherung)
- [ ] Spotify-Steuerung: abspielen, pausieren, weiter, Playlist/Song suchen, Lautstärke
- [ ] Chat-Integration: spotify_action-Block (z.B. "Spiele Coldplay")
- [ ] iPhone-Anbindung über Kurzbefehle: Befehls-Queue-Endpoint
- [ ] WhatsApp-Nachricht senden über Kurzbefehl-Automation
- [ ] Wecker/Timer stellen über Kurzbefehl-Automation
- [ ] Einrichtungsanleitung für iOS-Kurzbefehle
