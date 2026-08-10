# Diagnose: Sprachprobleme (10.08.2026)

## Gemeldete Symptome
- Jarvis spricht überhaupt nicht mehr (Text erscheint, kein Ton).
- Zweite Spracheingabe löst nicht aus; «Höre zu» bleibt stehen. Getippt funktioniert alles.

## Geprüft
- ElevenLabs API live getestet: funktioniert.
  - Abo: `tier=free`, `character_count=5328`, `character_limit=10000`
  - Reset: unix `1788944464`
  - TTS für «Guten Morgen, Sir.» liefert gültige MP3.
- Lokaler Zähler `tts_usage`: userId 1, `2026-08`, nur 389 Zeichen → blockiert nicht.

## Wahrscheinliche Ursache (Browser, nicht Server)
1. **Autoplay-Sperre**: Bei Spracheingabe wird die Nachricht ohne direkten Klick gesendet.
   `audio.play()` wird dann vom Browser blockiert; der Fehler landete nur in der Konsole.
2. **Hängender Zustand**: Wenn das Audio nie startet, bleibt `isSpeaking` gesetzt, dadurch
   startet die Spracherkennung nicht neu → zweite Eingabe wirkungslos.
3. **Unvollständiger Lebenszyklus** der Web Speech API: `onend`/`onerror`/`onnomatch`
   setzen den Zustand nicht immer zurück.

## Lösung
- Ein einziges Audio-Element wird wiederverwendet und einmalig per Nutzerklick
  freigegeben (Banner «Sprachausgabe aktivieren» **oder** Mikrofon-Knopf).
  Der Freigabe-Status wird nur gesetzt, wenn der Browser die Wiedergabe wirklich
  erlaubt hat; wird sie später blockiert, erscheint der Hinweis erneut.
- Jeder Weg (Erfolg, Fehler, blockierte Wiedergabe, aufgebrauchtes Budget)
  setzt «spricht gerade» zurück und löst das Weiterhören zentral aus.
- Die Spracherkennung wird bei jedem Start hart neu aufgebaut (`abort()` statt
  `stop()`), ein Wächter-Timer (3 s) verhindert einen hängenden «Höre zu»-Zustand,
  und ein zusätzlicher Effekt startet nach jeder fertigen Antwort erneut.

## Prüfpfad für zwei Spracheingaben hintereinander
1. Chat öffnen, einmal auf **«Sprachausgabe aktivieren»** tippen (Bestätigung erscheint).
2. Im Kopfbereich muss «🔊 AN» stehen.
3. Mikrofon antippen, eine kurze Frage sprechen → Antwort erscheint **und** wird gesprochen.
4. Direkt danach Mikrofon erneut antippen und eine zweite Frage sprechen
   → muss ebenfalls gesendet und gesprochen werden.
5. Zusatzprüfung: «Hands-free» aktivieren und zwei Fragen ohne Knopfdruck stellen.
6. Bleibt «Höre zu» stehen, erscheint nach 3 Sekunden ein Hinweis – dann liegt
   ein Mikrofon-Zugriffsproblem im Browser vor, kein Zustandsfehler mehr.
