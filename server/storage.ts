import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { ENV } from "./_core/env";

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const uploadDir = path.resolve(process.cwd(), "uploads");
  const filePath = path.join(uploadDir, key);

  // Stelle sicher, dass der Zielordner existiert
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  const bufferData = typeof data === "string" ? Buffer.from(data) : data;
  await fs.writeFile(filePath, bufferData);

  // Der Pfad beginnt mit /manus-storage/, was in storageProxy abgefangen wird
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGet(
  relKey: string
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  const baseUrl = ENV.appUrl || "";
  // Für lokales Hosting reicht die öffentliche URL völlig aus (kein Presigned Hash nötig)
  return `${baseUrl}/manus-storage/${key}`;
}
