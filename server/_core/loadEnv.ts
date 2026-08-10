import { existsSync } from "fs";
import path from "path";
import { config as loadDotenv } from "dotenv";

/**
 * Lädt die `.env` robust – unabhängig vom Arbeitsverzeichnis.
 *
 * `dotenv/config` sucht nur im aktuellen Arbeitsverzeichnis (`process.cwd()`).
 * Managed-Hosting-Panels (konsoleH, Plesk/Passenger) starten den Prozess aber
 * oft aus einem anderen Verzeichnis. Die `.env` wird dann nicht gefunden, die
 * Pflichtvariablen fehlen und der Server bricht beim Start ab – nach aussen
 * sichtbar nur als „Service Unavailable" (503).
 *
 * Deshalb wird zusätzlich neben dem Bundle (`dist/`) und darüber (Projekt-
 * wurzel) gesucht. Die erste gefundene Datei gewinnt; bereits gesetzte
 * Umgebungsvariablen werden nie überschrieben.
 *
 * WICHTIG: Dieses Modul lädt die Datei als Seiteneffekt beim Import und muss
 * deshalb als ALLERERSTES importiert werden (`import "./loadEnv"`). In ES-
 * Modulen laufen alle Imports vor dem Modulcode – ein Funktionsaufruf im
 * Rumpf käme zu spät, weil `./env` `process.env` schon beim Laden ausliest.
 */
const candidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(import.meta.dirname, ".env"),
  path.resolve(import.meta.dirname, "..", ".env"),
  path.resolve(import.meta.dirname, "..", "..", ".env"),
];

for (const file of candidates) {
  if (existsSync(file)) {
    loadDotenv({ path: file });
    break;
  }
}
