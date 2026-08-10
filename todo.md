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
- [x] 4 PWA mit Benachrichtigungs-Badge (offene Aufgaben + Tickets)
- [x] 6 Kontextbewusstes Nachfragen bei unklaren Anfragen
- [x] 7 Proaktive Tagesplanung (Prioritäten-Vorschlag)
- [x] 8 Lernende Quick-Action-Vorschläge (prompt_stats) – Backend
- [x] 9 Dokument-Zusammenfassung mit Handlungsempfehlungen
- [x] 10 E-Mail-Entwurf aus App-Kontext (Mahnung, Angebot, Nachfrage)
- [x] 14 Dokumenten-Vorlagen mit Platzhaltern und PDF-Export
- [x] 16 Desktop-Widget als installierbare PWA im Kompaktmodus
- [x] 17 Aufgaben-Delegation mit E-Mail-Entwurf und Frist
- [x] 18 Sprachnotizen mit Transkription und Kategorisierung
- [x] 19 Wöchentlicher Bericht (Freitag-Cron) – Handler bereit, Cron nach Deploy
- [x] 20 Webhook-API für externe Integrationen (API-Keys)
- [x] 8b Lernende Vorschläge im Chat-Frontend anzeigen
- [x] Wochenbericht-Cron nach Deployment anlegen (Freitag 16:00 Zürich, task_uid QFvDg6RoXpcDWUCmp8nt6E)

## Phase 4 – Geräte- und Musiksteuerung
- [x] Spotify OAuth (Client ID/Secret, Refresh-Token-Speicherung)
- [x] Spotify-Steuerung: abspielen, pausieren, weiter, Playlist/Song suchen, Lautstärke
- [x] Chat-Integration: spotify_action-Block (z.B. "Spiele Coldplay")
- [x] iPhone-Anbindung über Kurzbefehle: Befehls-Queue-Endpoint
- [x] WhatsApp-Nachricht senden über Kurzbefehl-Automation
- [x] Wecker/Timer stellen über Kurzbefehl-Automation
- [x] Einrichtungsanleitung für iOS-Kurzbefehle (Seite /shortcuts mit Schritt-für-Schritt-Anleitung)

## Phase 5 – Fehlerbehebung und weitere Verbesserungen
- [x] BUG: Nur eine Anfrage pro Sitzung möglich – zweite Anfrage wird ignoriert (Warteschlange statt Verwerfen, synchrone Sperre, Auto-Zuhören erst nach Antwortende)
- [x] Kunden-Dossier: Backend-Aggregation (Kunde, Tickets, Angebote, Rechnungen, Projekte, Verträge)
- [x] Kunden-Dossier: Detailseite im Frontend mit allen Kundendaten
- [x] Kunden-Dossier: Chat-Aktion "Erzähl mir alles über Kunde X" (app_action customer_dossier)
- [x] Sprachausgabe: Zeichen-Budget-Anzeige für ElevenLabs (10'000/Monat)
- [x] Sprachausgabe: Kurzfassung für TTS bei langen Antworten
- [x] Sprachausgabe: Wake-Word "Hey Jarvis" für Hands-free-Einstieg
- [x] Kundenliste in «Meine App» verlinkt direkt aufs Kunden-Dossier (ein Klick)
- [x] Agenten-Schleife: Jarvis führt mehrere Werkzeuge nacheinander aus bis die Aufgabe erledigt ist
- [x] Werkzeug-Katalog vereinheitlichen (App, Kalender, Aufgaben, Notizen, Spotify, Gerät, Gedächtnis)
- [x] Jarvis beschafft fehlende Daten selbstständig statt nachzufragen
- [x] Proaktive Handlungsvorschläge nach jeder Antwort (erzwungen via ensureNextStep + Tests)
- [x] Ausgeführte Schritte im Chat sichtbar machen (Aktionsprotokoll)
- [x] Bestätigung bei kritischen Aktionen (Rechnung bezahlt/erstellt, Termin löschen, Einladung, WhatsApp, Status-Änderungen) – werden vorgemerkt und erst nach klarem «Ja» ausgeführt

## Phase 6 – Spracheingabe-Bug
- [x] BUG: Zweite Spracheingabe löst nicht mehr aus – alte Erkennungs-Instanz wird nun hart beendet und neu aufgebaut, Wächter-Timer verhindert hängenden «Höre zu»-Zustand
- [x] BUG: Jarvis spricht nicht mehr – Ursache war die Autoplay-Sperre des Browsers bei Sprachbedienung. Ton wird jetzt einmalig per Klick freigegeben (auch über den Mikrofon-Knopf) und dauerhaft wiederverwendet
- [x] Sprachausgabe-Zustand wird bei Erfolg, Fehler, blockierter Wiedergabe und aufgebrauchtem Budget zurückgesetzt und löst das Weiterhören zentral aus; beim ausdrücklichen Stopp bleibt es bewusst aus
- [x] Freigabe-Status wird nur nach tatsächlich erlaubter Wiedergabe gesetzt und bei Blockade überall zurückgenommen
- [x] Prüfpfad für zwei aufeinanderfolgende Spracheingaben dokumentiert (DIAGNOSE_SPRACHE.md)
- [x] BUG: «Sprachausgabe aktivieren» meldete immer «Ton blockiert» – die Freigabe nutzte eine ungültige MP3-Daten-URL. Jetzt Freigabe über WebAudio (stiller Puffer) plus Anwärmen des Audio-Elements, mit hörbarer Probeansage als Bestätigung
- [x] Ausweichweg: schlägt `<audio>.play()` fehl, wird die Antwort über WebAudio abgespielt (wichtig für iOS/Safari)
