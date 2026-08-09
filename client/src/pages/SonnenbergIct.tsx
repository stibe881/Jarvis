import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";
import { Building2, FileText, ClipboardList, BarChart3, Mail, Loader2, Copy, Download, ChevronDown } from "lucide-react";
import jsPDF from "jspdf";

function exportDocPdf(title: string, content: string, footer: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210, margin = 20, contentW = pageW - margin * 2;
  let y = 20;

  // Header
  doc.setFillColor(15, 40, 80);
  doc.rect(0, 0, pageW, 40, "F");
  doc.setTextColor(100, 160, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("SONNENBERG BAAR", margin, 16);
  doc.setTextColor(180, 200, 230);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Kompetenzzentrum Sehen Verhalten Sprechen", margin, 24);
  doc.text("ICT-Abteilung · Stefan Gross, Leiter ICT", margin, 30);
  doc.text(new Date().toLocaleDateString("de-CH"), pageW - margin, 24, { align: "right" });
  y = 52;

  // Titel
  doc.setDrawColor(100, 160, 255);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 7;
  doc.setTextColor(15, 40, 80);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, margin, y);
  y += 10;

  // Inhalt
  const plain = content.replace(/^#{1,6}\s+/gm, "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/^[-*]\s+/gm, "• ").replace(/^\d+\.\s+/gm, "").trim();
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40, 40, 40);
  const lines = doc.splitTextToSize(plain, contentW);
  for (const line of lines) {
    if (y + 5.5 > 282) { doc.addPage(); y = 20; }
    if (line.match(/^[A-ZÄÖÜ][A-ZÄÖÜ\s]{3,}:?$/) || line.startsWith("•")) {
      doc.setFont("helvetica", "bold"); doc.setTextColor(15, 40, 80);
    } else {
      doc.setFont("helvetica", "normal"); doc.setTextColor(40, 40, 40);
    }
    doc.text(line, margin, y); y += 5.5;
  }

  // Footer
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFillColor(240, 245, 255);
    doc.rect(0, 282, pageW, 15, "F");
    doc.setFontSize(8); doc.setTextColor(100, 100, 120); doc.setFont("helvetica", "normal");
    doc.text(footer, margin, 290);
    doc.text(`Seite ${i} / ${total}`, pageW - margin, 290, { align: "right" });
  }
  doc.save(`${title.replace(/\s+/g, "_")}_${new Date().toLocaleDateString("de-CH").replace(/\./g, "-")}.pdf`);
}

// ── Gemeinsame Ergebnis-Anzeige ───────────────────────────────────────────────
function ResultBox({ content, onPdf, pdfTitle }: { content: string; onPdf: () => void; pdfTitle: string }) {
  return (
    <div className="jarvis-card rounded-xl p-4 space-y-3 border border-blue-500/20">
      <div className="flex justify-between items-center">
        <span className="font-jarvis text-xs text-blue-400">ERGEBNIS</span>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => { navigator.clipboard.writeText(content); toast.success("Kopiert!"); }}>
            <Copy size={12} /> Kopieren
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-blue-400 hover:text-blue-300" onClick={onPdf}>
            <Download size={12} /> PDF
          </Button>
        </div>
      </div>
      <div className="bg-background/50 rounded-lg p-3 text-sm max-h-96 overflow-auto">
        <Streamdown>{content}</Streamdown>
      </div>
    </div>
  );
}

// ── IT-Konzept ────────────────────────────────────────────────────────────────
function ConceptTab() {
  const mutation = trpc.sonnenberg.generateConcept.useMutation();
  const [form, setForm] = useState({ topic: "", scope: "", background: "", type: "it_concept" as const });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      <div className="jarvis-card rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Dokumenttyp</Label>
            <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as typeof form.type }))}>
              <SelectTrigger className="bg-input border-border mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="it_concept">IT-Konzept</SelectItem>
                <SelectItem value="security_concept">Sicherheitskonzept</SelectItem>
                <SelectItem value="migration_plan">Migrationsplan</SelectItem>
                <SelectItem value="infrastructure_plan">Infrastrukturkonzept</SelectItem>
                <SelectItem value="other">Sonstiges Konzept</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs text-muted-foreground">Thema *</Label><Input value={form.topic} onChange={set("topic")} placeholder="z.B. WLAN-Erneuerung, Microsoft 365 Migration..." className="bg-input border-border mt-1" /></div>
          <div><Label className="text-xs text-muted-foreground">Scope / Umfang</Label><Input value={form.scope} onChange={set("scope")} placeholder="z.B. alle Standorte, nur Verwaltung..." className="bg-input border-border mt-1" /></div>
          <div><Label className="text-xs text-muted-foreground">Hintergrund</Label><Input value={form.background} onChange={set("background")} placeholder="z.B. Veraltete Infrastruktur, Sicherheitslücken..." className="bg-input border-border mt-1" /></div>
        </div>
        <Button onClick={() => mutation.mutate(form)} disabled={!form.topic || mutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white gap-1">
          {mutation.isPending ? <><Loader2 size={12} className="animate-spin" /> Generiere...</> : <><FileText size={12} /> Konzept generieren</>}
        </Button>
      </div>
      {mutation.data && <ResultBox content={mutation.data.content} pdfTitle={form.topic} onPdf={() => exportDocPdf(form.topic, mutation.data!.content, "SONNENBERG Baar · ICT-Abteilung · stefan.gross@sonnenberg-baar.ch")} />}
    </div>
  );
}

// ── Beschaffungsantrag ────────────────────────────────────────────────────────
function ProcurementTab() {
  const mutation = trpc.sonnenberg.generateProcurement.useMutation();
  const [form, setForm] = useState({ item: "", quantity: "", estimatedCost: "", justification: "", urgency: "medium" as const });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      <div className="jarvis-card rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2"><Label className="text-xs text-muted-foreground">Beschaffungsgegenstand *</Label><Input value={form.item} onChange={set("item")} placeholder="z.B. 10x Laptop Dell Latitude 5540, Firewall Fortinet..." className="bg-input border-border mt-1" /></div>
          <div><Label className="text-xs text-muted-foreground">Menge</Label><Input type="number" value={form.quantity} onChange={set("quantity")} placeholder="10" className="bg-input border-border mt-1" /></div>
          <div><Label className="text-xs text-muted-foreground">Geschätzte Kosten (CHF)</Label><Input type="number" value={form.estimatedCost} onChange={set("estimatedCost")} placeholder="15000" className="bg-input border-border mt-1" /></div>
          <div>
            <Label className="text-xs text-muted-foreground">Dringlichkeit</Label>
            <Select value={form.urgency} onValueChange={v => setForm(f => ({ ...f, urgency: v as typeof form.urgency }))}>
              <SelectTrigger className="bg-input border-border mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Tief</SelectItem>
                <SelectItem value="medium">Mittel</SelectItem>
                <SelectItem value="high">Hoch (dringend)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div><Label className="text-xs text-muted-foreground">Begründung</Label><Textarea value={form.justification} onChange={set("justification")} rows={2} placeholder="Warum wird diese Beschaffung benötigt?" className="bg-input border-border mt-1 resize-none" /></div>
        <Button onClick={() => mutation.mutate({ ...form, quantity: form.quantity ? Number(form.quantity) : undefined, estimatedCost: form.estimatedCost ? Number(form.estimatedCost) : undefined })} disabled={!form.item || mutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white gap-1">
          {mutation.isPending ? <><Loader2 size={12} className="animate-spin" /> Generiere...</> : <><ClipboardList size={12} /> Antrag generieren</>}
        </Button>
      </div>
      {mutation.data && <ResultBox content={mutation.data.content} pdfTitle={`Beschaffungsantrag_${form.item}`} onPdf={() => exportDocPdf(`Beschaffungsantrag: ${form.item}`, mutation.data!.content, "SONNENBERG Baar · ICT-Abteilung · stefan.gross@sonnenberg-baar.ch")} />}
    </div>
  );
}

// ── Sitzungsnotizen ───────────────────────────────────────────────────────────
function MeetingTab() {
  const mutation = trpc.sonnenberg.structureMeetingNotes.useMutation();
  const [form, setForm] = useState({ rawNotes: "", meetingTitle: "", participants: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      <div className="jarvis-card rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label className="text-xs text-muted-foreground">Sitzungstitel</Label><Input value={form.meetingTitle} onChange={set("meetingTitle")} placeholder="z.B. ICT-Abteilungssitzung August 2026" className="bg-input border-border mt-1" /></div>
          <div><Label className="text-xs text-muted-foreground">Teilnehmende</Label><Input value={form.participants} onChange={set("participants")} placeholder="z.B. Stefan Gross, Max Muster, ..." className="bg-input border-border mt-1" /></div>
        </div>
        <div><Label className="text-xs text-muted-foreground">Rohe Notizen *</Label><Textarea value={form.rawNotes} onChange={set("rawNotes")} rows={6} placeholder="Tippe oder füge deine Sitzungsnotizen hier ein – Jarvis strukturiert sie professionell..." className="bg-input border-border mt-1 resize-none" /></div>
        <Button onClick={() => mutation.mutate(form)} disabled={!form.rawNotes || mutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white gap-1">
          {mutation.isPending ? <><Loader2 size={12} className="animate-spin" /> Strukturiere...</> : <><ClipboardList size={12} /> Protokoll erstellen</>}
        </Button>
      </div>
      {mutation.data && <ResultBox content={mutation.data.content} pdfTitle={form.meetingTitle || "Sitzungsprotokoll"} onPdf={() => exportDocPdf(form.meetingTitle || "Sitzungsprotokoll", mutation.data!.content, "SONNENBERG Baar · ICT-Abteilung · stefan.gross@sonnenberg-baar.ch")} />}
    </div>
  );
}

// ── Statusbericht ─────────────────────────────────────────────────────────────
function StatusTab() {
  const mutation = trpc.sonnenberg.generateStatusReport.useMutation();
  const [form, setForm] = useState({ period: "", completedItems: "", ongoingItems: "", plannedItems: "", issues: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      <div className="jarvis-card rounded-xl p-4 space-y-3">
        <div><Label className="text-xs text-muted-foreground">Berichtszeitraum</Label><Input value={form.period} onChange={set("period")} placeholder="z.B. August 2026" className="bg-input border-border mt-1" /></div>
        <div><Label className="text-xs text-muted-foreground">Erledigte Aufgaben / Projekte</Label><Textarea value={form.completedItems} onChange={set("completedItems")} rows={2} placeholder="Was wurde abgeschlossen?" className="bg-input border-border mt-1 resize-none" /></div>
        <div><Label className="text-xs text-muted-foreground">Laufende Projekte</Label><Textarea value={form.ongoingItems} onChange={set("ongoingItems")} rows={2} placeholder="Was ist in Bearbeitung?" className="bg-input border-border mt-1 resize-none" /></div>
        <div><Label className="text-xs text-muted-foreground">Geplante Massnahmen</Label><Textarea value={form.plannedItems} onChange={set("plannedItems")} rows={2} placeholder="Was ist als nächstes geplant?" className="bg-input border-border mt-1 resize-none" /></div>
        <div><Label className="text-xs text-muted-foreground">Probleme / Herausforderungen</Label><Textarea value={form.issues} onChange={set("issues")} rows={2} placeholder="Offene Probleme, Risiken..." className="bg-input border-border mt-1 resize-none" /></div>
        <Button onClick={() => mutation.mutate(form)} disabled={mutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white gap-1">
          {mutation.isPending ? <><Loader2 size={12} className="animate-spin" /> Generiere...</> : <><BarChart3 size={12} /> Statusbericht generieren</>}
        </Button>
      </div>
      {mutation.data && <ResultBox content={mutation.data.content} pdfTitle={`IT-Statusbericht_${form.period || "aktuell"}`} onPdf={() => exportDocPdf(`IT-Statusbericht ${form.period || ""}`, mutation.data!.content, "SONNENBERG Baar · ICT-Abteilung · stefan.gross@sonnenberg-baar.ch")} />}
    </div>
  );
}

// ── Texte / E-Mails ───────────────────────────────────────────────────────────
function TextTab() {
  const mutation = trpc.sonnenberg.generateText.useMutation();
  const [form, setForm] = useState({ type: "email" as const, topic: "", details: "", audience: "staff" as const });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      <div className="jarvis-card rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Textart</Label>
            <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as typeof form.type }))}>
              <SelectTrigger className="bg-input border-border mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">E-Mail</SelectItem>
                <SelectItem value="announcement">Ankündigung / Mitteilung</SelectItem>
                <SelectItem value="policy">IT-Richtlinie / Policy</SelectItem>
                <SelectItem value="training_material">Schulungsunterlagen</SelectItem>
                <SelectItem value="other">Sonstiger Text</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Zielgruppe</Label>
            <Select value={form.audience} onValueChange={v => setForm(f => ({ ...f, audience: v as typeof form.audience }))}>
              <SelectTrigger className="bg-input border-border mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="staff">Mitarbeitende</SelectItem>
                <SelectItem value="management">Geschäftsleitung</SelectItem>
                <SelectItem value="external">Externe Stellen</SelectItem>
                <SelectItem value="all">Alle</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2"><Label className="text-xs text-muted-foreground">Thema *</Label><Input value={form.topic} onChange={set("topic")} placeholder="z.B. Passwort-Richtlinie, Systemwartung am Wochenende..." className="bg-input border-border mt-1" /></div>
        </div>
        <div><Label className="text-xs text-muted-foreground">Zusätzliche Details</Label><Textarea value={form.details} onChange={set("details")} rows={2} placeholder="Weitere Informationen..." className="bg-input border-border mt-1 resize-none" /></div>
        <Button onClick={() => mutation.mutate(form)} disabled={!form.topic || mutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white gap-1">
          {mutation.isPending ? <><Loader2 size={12} className="animate-spin" /> Generiere...</> : <><Mail size={12} /> Text generieren</>}
        </Button>
      </div>
      {mutation.data && <ResultBox content={mutation.data.content} pdfTitle={form.topic} onPdf={() => exportDocPdf(form.topic, mutation.data!.content, "SONNENBERG Baar · ICT-Abteilung · stefan.gross@sonnenberg-baar.ch")} />}
    </div>
  );
}

// ── Hauptseite ────────────────────────────────────────────────────────────────
const TABS = [
  { id: "concept", label: "IT-Konzepte", icon: FileText },
  { id: "procurement", label: "Beschaffung", icon: ClipboardList },
  { id: "meeting", label: "Sitzungsnotizen", icon: ChevronDown },
  { id: "status", label: "Statusbericht", icon: BarChart3 },
  { id: "text", label: "E-Mails & Texte", icon: Mail },
];

export default function SonnenbergIct() {
  const [activeTab, setActiveTab] = useState("concept");

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center">
            <Building2 size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="font-jarvis text-lg font-bold text-blue-400">SONNENBERG BAAR</h1>
            <p className="text-xs text-muted-foreground">ICT-Assistent · Leiter ICT</p>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex gap-1 flex-wrap">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                activeTab === id
                  ? "bg-blue-600/20 border border-blue-500/40 text-blue-400"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              )}
            >
              <Icon size={13} />{label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab-Inhalt */}
      <div className="flex-1 overflow-auto px-4 md:px-6 py-4">
        {activeTab === "concept" && <ConceptTab />}
        {activeTab === "procurement" && <ProcurementTab />}
        {activeTab === "meeting" && <MeetingTab />}
        {activeTab === "status" && <StatusTab />}
        {activeTab === "text" && <TextTab />}
      </div>
    </div>
  );
}
