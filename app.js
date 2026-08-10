/**
 * Einstiegspunkt-Brücke für Managed-Hosting-Panels.
 *
 * Manche Panels (z.B. Hetzner konsoleH) erwarten standardmässig `app.js` im
 * Arbeitsverzeichnis. Der eigentliche Server liegt nach `pnpm build` aber in
 * `dist/index.js`. Diese Datei startet ihn, damit beide Angaben funktionieren –
 * `app.js` genauso wie `dist/index.js`.
 */
import "./dist/index.js";
