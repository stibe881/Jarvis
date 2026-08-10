import { describe, it, expect } from "vitest";

/**
 * Bildet die Sende-Logik des Chats nach: Während eine Antwort läuft, darf eine
 * neue Nachricht NICHT verworfen werden, sondern muss in die Warteschlange
 * wandern und danach automatisch gesendet werden. Das war die Ursache dafür,
 * dass nur die erste Anfrage beantwortet wurde.
 */
class ChatSender {
  busy = false;
  queued: string | null = null;
  sent: string[] = [];

  /** Entspricht sendMessageFromText im Frontend. */
  send(text: string): "sent" | "queued" | "ignored" {
    if (!text.trim()) return "ignored";
    if (this.busy) {
      this.queued = text.trim();
      return "queued";
    }
    this.busy = true;
    this.sent.push(text.trim());
    return "sent";
  }

  /** Entspricht dem finally-Block plus dem useEffect für die Warteschlange. */
  finish(): void {
    this.busy = false;
    const queued = this.queued;
    if (queued) {
      this.queued = null;
      this.send(queued);
    }
  }
}

describe("Chat-Sendelogik", () => {
  it("sendet die erste Nachricht sofort", () => {
    const c = new ChatSender();
    expect(c.send("Hallo Jarvis")).toBe("sent");
    expect(c.sent).toEqual(["Hallo Jarvis"]);
  });

  it("legt eine zweite Nachricht während der Antwort in die Warteschlange", () => {
    const c = new ChatSender();
    c.send("Erste Frage");
    expect(c.send("Zweite Frage")).toBe("queued");
    expect(c.sent).toEqual(["Erste Frage"]);
  });

  it("sendet die Nachricht aus der Warteschlange nach dem Ende der Antwort", () => {
    const c = new ChatSender();
    c.send("Erste Frage");
    c.send("Zweite Frage");
    c.finish();
    expect(c.sent).toEqual(["Erste Frage", "Zweite Frage"]);
  });

  it("erlaubt beliebig viele Anfragen nacheinander", () => {
    const c = new ChatSender();
    for (const text of ["Frage 1", "Frage 2", "Frage 3", "Frage 4"]) {
      c.send(text);
      c.finish();
    }
    expect(c.sent).toEqual(["Frage 1", "Frage 2", "Frage 3", "Frage 4"]);
  });

  it("verwirft leere Eingaben", () => {
    const c = new ChatSender();
    expect(c.send("   ")).toBe("ignored");
    expect(c.sent).toHaveLength(0);
  });

  it("überschreibt die Warteschlange mit der neuesten Eingabe", () => {
    const c = new ChatSender();
    c.send("Erste Frage");
    c.send("Alte zweite Frage");
    c.send("Neue zweite Frage");
    c.finish();
    expect(c.sent).toEqual(["Erste Frage", "Neue zweite Frage"]);
  });
});
