import { describe, it, expect } from "vitest";
import { customerLabel, formatDossier, type CustomerDossier } from "./routers/appIntegration";

describe("Kunden-Dossier – Anzeigename", () => {
  it("bevorzugt den Firmennamen", () => {
    expect(customerLabel({ company_name: "Muster AG", first_name: "Max", last_name: "Muster" })).toBe("Muster AG");
  });

  it("fällt auf Vor- und Nachname zurück", () => {
    expect(customerLabel({ first_name: "Max", last_name: "Muster" })).toBe("Max Muster");
  });

  it("gibt Unbekannt zurück, wenn nichts vorhanden ist", () => {
    expect(customerLabel(null)).toBe("Unbekannt");
    expect(customerLabel({})).toBe("Unbekannt");
  });
});

function makeDossier(): CustomerDossier {
  return {
    customer: { id: "abc", company_name: "Muster AG", email: "info@muster.ch", phone: "+41 41 111 22 33" },
    label: "Muster AG",
    tickets: [
      { title: "Drucker defekt", status: "open", priority: "high", created_at: "2026-08-01T10:00:00Z" },
      { title: "Passwort zurücksetzen", status: "closed", priority: "low", created_at: "2026-07-20T10:00:00Z" },
    ],
    quotes: [{ status: "sent", total: 2500 }],
    invoices: [
      { invoice_number: "R-2026-001", status: "open", due_date: "2026-07-01", total: 1200 },
      { invoice_number: "R-2026-002", status: "paid", due_date: "2026-06-01", total: 800 },
    ],
    projects: [{ title: "Webseite", status: "active" }],
    contracts: [{ title: "Wartungsvertrag", status: "active" }],
    stats: {
      openTickets: 1, totalTickets: 2,
      openInvoiceCount: 1, openInvoiceAmount: 1200, paidInvoiceAmount: 800,
      overdueCount: 1, overdueAmount: 1200,
      openQuoteCount: 1, openQuoteAmount: 2500,
      activeProjects: 1, revenueTotal: 800,
    },
  };
}

describe("Kunden-Dossier – Textausgabe", () => {
  it("enthält den Kundennamen als Titel", () => {
    expect(formatDossier(makeDossier())).toContain("Kunden-Dossier: Muster AG");
  });

  it("weist offene und überfällige Rechnungen mit Beträgen aus", () => {
    const text = formatDossier(makeDossier());
    expect(text).toContain("Offene Rechnungen: 1");
    expect(text).toContain("überfällig: 1");
    expect(text).toMatch(/CHF 1['’ ]?200/);
  });

  it("listet Tickets, Rechnungen, Projekte und Verträge", () => {
    const text = formatDossier(makeDossier());
    expect(text).toContain("Drucker defekt");
    expect(text).toContain("R-2026-001");
    expect(text).toContain("Webseite");
    expect(text).toContain("Wartungsvertrag");
  });

  it("zeigt Kontaktdaten an", () => {
    const text = formatDossier(makeDossier());
    expect(text).toContain("info@muster.ch");
    expect(text).toContain("+41 41 111 22 33");
  });

  it("lässt den Überfällig-Hinweis weg, wenn nichts überfällig ist", () => {
    const d = makeDossier();
    d.stats.overdueCount = 0;
    d.stats.overdueAmount = 0;
    expect(formatDossier(d)).not.toContain("überfällig");
  });
});
