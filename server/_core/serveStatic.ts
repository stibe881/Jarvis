import express, { type Express } from "express";
import fs from "fs";
import path from "path";

/**
 * Statische Dateien für den Production-Modus ausliefern.
 * Diese Datei importiert KEIN Vite – sie wird im Production-Build
 * ohne Dev-Abhängigkeiten benötigt.
 */
export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // Fallback: Alle unbekannten Routen an index.html weiterleiten (SPA)
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
