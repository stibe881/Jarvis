import type { Express } from "express";
import express from "express";
import path from "path";

export function registerStorageProxy(app: Express) {
  const uploadDir = path.resolve(process.cwd(), "uploads");
  // Serviere Dateien aus dem lokalen uploads-Ordner unter dem Präfix /manus-storage/
  app.use("/manus-storage", express.static(uploadDir));
}
