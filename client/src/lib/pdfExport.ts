import jsPDF from "jspdf";

interface QuoteData {
  title: string;
  customerName: string;
  customerEmail?: string | null;
  content: string;
  totalAmount?: number | null;
  createdAt: Date;
}

export function exportQuotePdf(quote: QuoteData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const margin = 20;
  const contentW = pageW - margin * 2;
  let y = 20;

  // ── Header ──────────────────────────────────────────────────────────────
  doc.setFillColor(10, 25, 47); // Dunkelblau
  doc.rect(0, 0, pageW, 40, "F");

  doc.setTextColor(0, 180, 216); // Cyan
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("GROSS ICT", margin, 18);

  doc.setTextColor(180, 200, 220);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("gross-ict.ch · ICT-Dienstleistungen Zentralschweiz", margin, 26);
  doc.text("Zell, Luzern · Schweiz", margin, 32);

  // Datum rechts
  doc.setTextColor(180, 200, 220);
  doc.setFontSize(9);
  const dateStr = new Date(quote.createdAt).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
  doc.text(dateStr, pageW - margin, 26, { align: "right" });

  y = 55;

  // ── Empfänger ────────────────────────────────────────────────────────────
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(quote.customerName, margin, y);
  y += 6;
  if (quote.customerEmail) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(quote.customerEmail, margin, y);
    y += 6;
  }
  y += 4;

  // ── Titel ────────────────────────────────────────────────────────────────
  doc.setDrawColor(0, 180, 216);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  doc.setTextColor(10, 25, 47);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(quote.title, margin, y);
  y += 10;

  // ── Inhalt (Markdown → Plain Text) ───────────────────────────────────────
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  // Markdown vereinfacht in lesbaren Text konvertieren
  const plain = quote.content
    .replace(/^#{1,6}\s+/gm, "") // Überschriften
    .replace(/\*\*(.+?)\*\*/g, "$1") // Fett
    .replace(/\*(.+?)\*/g, "$1") // Kursiv
    .replace(/`(.+?)`/g, "$1") // Code
    .replace(/^[-*]\s+/gm, "• ") // Listen
    .replace(/^\d+\.\s+/gm, "") // Nummerierte Listen
    .trim();

  const lines = doc.splitTextToSize(plain, contentW);
  const lineHeight = 5.5;
  const pageH = 297;
  const footerH = 20;

  for (const line of lines) {
    if (y + lineHeight > pageH - footerH) {
      doc.addPage();
      y = 20;
    }
    // Abschnittsüberschriften fett darstellen (Zeilen die mit "•" oder Grossbuchstaben beginnen)
    if (line.match(/^[A-ZÄÖÜ][A-ZÄÖÜ\s]{3,}:?$/) || line.startsWith("•")) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(10, 25, 47);
    } else {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(40, 40, 40);
    }
    doc.text(line, margin, y);
    y += lineHeight;
  }

  // ── Gesamtbetrag ─────────────────────────────────────────────────────────
  if (quote.totalAmount) {
    y += 8;
    if (y + 15 > pageH - footerH) { doc.addPage(); y = 20; }
    doc.setDrawColor(0, 180, 216);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);
    y += 8;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(10, 25, 47);
    doc.text(`Gesamtbetrag: CHF ${quote.totalAmount.toLocaleString("de-CH")}`, pageW - margin, y, { align: "right" });
    y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("Alle Preise in CHF, exkl. MwSt.", pageW - margin, y, { align: "right" });
  }

  // ── Footer ───────────────────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(240, 245, 250);
    doc.rect(0, pageH - 15, pageW, 15, "F");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    doc.text("Gross ICT · gross-ict.ch · stefan.gross@gross-ict.ch", margin, pageH - 7);
    doc.text(`Seite ${i} / ${totalPages}`, pageW - margin, pageH - 7, { align: "right" });
  }

  // ── Download ─────────────────────────────────────────────────────────────
  const fileName = `Angebot_${quote.customerName.replace(/\s+/g, "_")}_${dateStr.replace(/\./g, "-")}.pdf`;
  doc.save(fileName);
}
