/**
 * Nachbearbeitung der Antworttexte auf dem Server.
 *
 * Nutzt die geteilte Bereinigung aus `shared/cleanText.ts`, damit Server und
 * Browser genau dieselben Regeln anwenden.
 */
export { removeInternalTags } from "../shared/cleanText";
