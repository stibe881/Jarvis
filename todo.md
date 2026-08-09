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
