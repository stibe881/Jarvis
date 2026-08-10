import { describe, it, expect } from "vitest";

/**
 * Prüft die Zustandsregeln der Sprachbedienung als reine Logik.
 *
 * Hintergrund: Nach einer Antwort blieb die Sprachausgabe hängen, wenn der
 * Browser die Wiedergabe blockierte. Da «spricht gerade» dann nie zurückgesetzt
 * wurde, startete die Spracherkennung nicht mehr – die zweite Spracheingabe
 * lief ins Leere. Diese Regeln sichern den Ablauf ab.
 */

type VoiceState = {
  isStreaming: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  isBusy: boolean;
  autoListen: boolean;
  wakeWord: boolean;
};

/** Darf die Spracherkennung jetzt (neu) starten? */
export function mayResumeListening(s: VoiceState): boolean {
  if (!s.autoListen && !s.wakeWord) return false;
  if (s.isStreaming || s.isSpeaking) return false;
  if (s.isListening || s.isBusy) return false;
  return true;
}

/** Zustand nach dem Ende der Sprachausgabe – egal auf welchem Weg. */
export function afterSpeechEnded(s: VoiceState): VoiceState {
  return { ...s, isSpeaking: false };
}

const base: VoiceState = {
  isStreaming: false, isSpeaking: false, isListening: false,
  isBusy: false, autoListen: false, wakeWord: false,
};

describe("Wann darf wieder zugehört werden", () => {
  it("nicht ohne Hands-free oder Wake-Word", () => {
    expect(mayResumeListening(base)).toBe(false);
  });

  it("im Hands-free-Modus, wenn nichts läuft", () => {
    expect(mayResumeListening({ ...base, autoListen: true })).toBe(true);
  });

  it("im Wake-Word-Modus, wenn nichts läuft", () => {
    expect(mayResumeListening({ ...base, wakeWord: true })).toBe(true);
  });

  it("nicht während einer laufenden Antwort", () => {
    expect(mayResumeListening({ ...base, autoListen: true, isStreaming: true })).toBe(false);
  });

  it("nicht während Jarvis spricht", () => {
    expect(mayResumeListening({ ...base, autoListen: true, isSpeaking: true })).toBe(false);
  });

  it("nicht wenn schon zugehört wird (kein Doppelstart)", () => {
    expect(mayResumeListening({ ...base, autoListen: true, isListening: true })).toBe(false);
  });

  it("nicht wenn noch eine Anfrage in Arbeit ist", () => {
    expect(mayResumeListening({ ...base, wakeWord: true, isBusy: true })).toBe(false);
  });
});

describe("Zustand nach der Sprachausgabe", () => {
  it("setzt «spricht» zurück, auch wenn die Wiedergabe blockiert wurde", () => {
    const blocked = afterSpeechEnded({ ...base, autoListen: true, isSpeaking: true });
    expect(blocked.isSpeaking).toBe(false);
    // Genau das war der Fehler: danach muss wieder zugehört werden dürfen
    expect(mayResumeListening(blocked)).toBe(true);
  });

  it("führt bei fehlender Sprachausgabe trotzdem zum Weiterhören", () => {
    // Antwort fertig, aber Budget aufgebraucht → kein Ton, dennoch weiterhören
    const afterNoAudio = afterSpeechEnded({ ...base, wakeWord: true, isStreaming: false });
    expect(mayResumeListening(afterNoAudio)).toBe(true);
  });

  it("bleibt gesperrt, solange die Antwort noch läuft", () => {
    const stillStreaming = afterSpeechEnded({ ...base, autoListen: true, isStreaming: true });
    expect(mayResumeListening(stillStreaming)).toBe(false);
  });
});
