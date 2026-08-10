import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";
import {
  Briefcase,
  FileText,
  PenTool,
  Plus,
  Trash2,
  CheckCircle,
  Clock,
  XCircle,
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
} from "lucide-react";
import { exportQuotePdf } from "@/lib/pdfExport";

// ── Projekte ──────────────────────────────────────────────────────────────────
const SERVICE_LABELS: Record<string, string> = {
  website: "Webseite",
  webapp: "Web-App",
  app: "Mobile App",
  support: "IT-Support",
  security: "Security",
  network: "Netzwerk",
  server: "Server",
  other: "Sonstiges",
};
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  lead: {
    label: "Lead",
    color: "text-blue-400 border-blue-400/30 bg-blue-400/10",
  },
  offer: {
    label: "Angebot",
    color: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  },
  active: {
    label: "Aktiv",
    color: "text-green-400 border-green-400/30 bg-green-400/10",
  },
  completed: {
    label: "Abgeschlossen",
    color: "text-muted-foreground border-border bg-muted/20",
  },
  cancelled: {
    label: "Storniert",
    color: "text-red-400 border-red-400/30 bg-red-400/10",
  },
};
const QUOTE_STATUS: Record<string, { label: string; icon: React.ReactNode }> = {
  draft: { label: "Entwurf", icon: <Clock size={12} /> },
  sent: { label: "Gesendet", icon: <Send size={12} /> },
  accepted: { label: "Angenommen", icon: <CheckCircle size={12} /> },
  rejected: { label: "Abgelehnt", icon: <XCircle size={12} /> },
};

function ProjectsTab() {
  const { data: projects, refetch } = trpc.grossIct.listProjects.useQuery();
  const createMutation = trpc.grossIct.createProject.useMutation({
    onSuccess: () => {
      refetch();
      setShowForm(false);
      setForm(defaultForm);
      toast.success("Projekt erstellt");
    },
  });
  const updateMutation = trpc.grossIct.updateProject.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Gespeichert");
    },
  });
  const deleteMutation = trpc.grossIct.deleteProject.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Gelöscht");
    },
  });

  const defaultForm = {
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    projectTitle: "",
    description: "",
    service: "website" as const,
    status: "lead" as const,
    budget: "",
    notes: "",
  };
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {projects?.length ?? 0} Projekte
        </p>
        <Button
          size="sm"
          onClick={() => setShowForm(!showForm)}
          className="gap-1 bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30"
        >
          <Plus size={14} /> Neues Projekt
        </Button>
      </div>

      {showForm && (
        <div className="jarvis-card rounded-xl p-4 space-y-3 border border-primary/30">
          <h3 className="font-jarvis text-xs text-primary">NEUES PROJEKT</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">
                Kundenname *
              </Label>
              <Input
                value={form.customerName}
                onChange={set("customerName")}
                placeholder="Max Muster AG"
                className="bg-input border-border mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">E-Mail</Label>
              <Input
                value={form.customerEmail}
                onChange={set("customerEmail")}
                placeholder="max@example.ch"
                className="bg-input border-border mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Telefon</Label>
              <Input
                value={form.customerPhone}
                onChange={set("customerPhone")}
                placeholder="+41 41 xxx xx xx"
                className="bg-input border-border mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                Projekttitel *
              </Label>
              <Input
                value={form.projectTitle}
                onChange={set("projectTitle")}
                placeholder="Neue Webseite"
                className="bg-input border-border mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Leistung</Label>
              <Select
                value={form.service}
                onValueChange={v =>
                  setForm(f => ({ ...f, service: v as typeof form.service }))
                }
              >
                <SelectTrigger className="bg-input border-border mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SERVICE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                Budget (CHF)
              </Label>
              <Input
                type="number"
                value={form.budget}
                onChange={set("budget")}
                placeholder="1500"
                className="bg-input border-border mt-1"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">
              Beschreibung
            </Label>
            <Textarea
              value={form.description}
              onChange={set("description")}
              rows={2}
              className="bg-input border-border mt-1 resize-none"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() =>
                createMutation.mutate({
                  ...form,
                  budget: form.budget ? Number(form.budget) : undefined,
                })
              }
              disabled={
                !form.customerName ||
                !form.projectTitle ||
                createMutation.isPending
              }
              className="bg-primary text-primary-foreground"
            >
              {createMutation.isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                "Erstellen"
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowForm(false)}
            >
              Abbrechen
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {projects?.map(p => (
          <div
            key={p.id}
            className="jarvis-card rounded-xl border border-border overflow-hidden"
          >
            <div
              className="flex items-center gap-3 p-3 cursor-pointer"
              onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-foreground truncate">
                    {p.projectTitle}
                  </span>
                  <span
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full border",
                      STATUS_LABELS[p.status]?.color
                    )}
                  >
                    {STATUS_LABELS[p.status]?.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {p.customerName} · {SERVICE_LABELS[p.service]}
                  {p.budget ? ` · CHF ${p.budget.toLocaleString("de-CH")}` : ""}
                </p>
              </div>
              {expandedId === p.id ? (
                <ChevronUp
                  size={16}
                  className="text-muted-foreground flex-shrink-0"
                />
              ) : (
                <ChevronDown
                  size={16}
                  className="text-muted-foreground flex-shrink-0"
                />
              )}
            </div>
            {expandedId === p.id && (
              <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
                {p.description && (
                  <p className="text-sm text-foreground/80">{p.description}</p>
                )}
                {p.notes && (
                  <p className="text-xs text-muted-foreground italic">
                    {p.notes}
                  </p>
                )}
                <div className="flex gap-2 flex-wrap">
                  <Select
                    value={p.status}
                    onValueChange={v =>
                      updateMutation.mutate({
                        id: p.id,
                        status: v as typeof p.status,
                      })
                    }
                  >
                    <SelectTrigger className="h-7 text-xs bg-input border-border w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([v, { label }]) => (
                        <SelectItem key={v} value={v}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate({ id: p.id })}
                  >
                    <Trash2 size={12} className="mr-1" /> Löschen
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
        {projects?.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-8">
            Noch keine Projekte. Erstelle dein erstes Projekt!
          </p>
        )}
      </div>
    </div>
  );
}

// ── Angebote ──────────────────────────────────────────────────────────────────
function QuotesTab() {
  const { data: quotes, refetch } = trpc.grossIct.listQuotes.useQuery();
  const generateMutation = trpc.grossIct.generateQuote.useMutation({
    onSuccess: () => {
      refetch();
      setShowForm(false);
      toast.success("Angebot erstellt!");
    },
  });
  const updateStatusMutation = trpc.grossIct.updateQuoteStatus.useMutation({
    onSuccess: () => refetch(),
  });
  const deleteMutation = trpc.grossIct.deleteQuote.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Gelöscht");
    },
  });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    customerName: "",
    customerEmail: "",
    service: "Webseite",
    requirements: "",
    budget: "",
  });
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {quotes?.length ?? 0} Angebote
        </p>
        <Button
          size="sm"
          onClick={() => setShowForm(!showForm)}
          className="gap-1 bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30"
        >
          <Plus size={14} /> Neues Angebot
        </Button>
      </div>

      {showForm && (
        <div className="jarvis-card rounded-xl p-4 space-y-3 border border-primary/30">
          <h3 className="font-jarvis text-xs text-primary">
            ANGEBOT GENERIEREN
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">
                Kundenname *
              </Label>
              <Input
                value={form.customerName}
                onChange={set("customerName")}
                placeholder="Max Muster AG"
                className="bg-input border-border mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">E-Mail</Label>
              <Input
                value={form.customerEmail}
                onChange={set("customerEmail")}
                placeholder="max@example.ch"
                className="bg-input border-border mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                Leistung *
              </Label>
              <Input
                value={form.service}
                onChange={set("service")}
                placeholder="z.B. Webseite, Web-App, IT-Support"
                className="bg-input border-border mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                Budget (CHF)
              </Label>
              <Input
                type="number"
                value={form.budget}
                onChange={set("budget")}
                placeholder="1500"
                className="bg-input border-border mt-1"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">
              Anforderungen *
            </Label>
            <Textarea
              value={form.requirements}
              onChange={set("requirements")}
              rows={3}
              placeholder="Beschreibe was der Kunde braucht..."
              className="bg-input border-border mt-1 resize-none"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() =>
                generateMutation.mutate({
                  ...form,
                  budget: form.budget ? Number(form.budget) : undefined,
                })
              }
              disabled={
                !form.customerName ||
                !form.requirements ||
                generateMutation.isPending
              }
              className="bg-primary text-primary-foreground gap-1"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 size={12} className="animate-spin" /> Generiere...
                </>
              ) : (
                <>
                  <FileText size={12} /> Angebot generieren
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowForm(false)}
            >
              Abbrechen
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {quotes?.map(q => (
          <div
            key={q.id}
            className="jarvis-card rounded-xl border border-border overflow-hidden"
          >
            <div
              className="flex items-center gap-3 p-3 cursor-pointer"
              onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-foreground truncate">
                  {q.title}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    {QUOTE_STATUS[q.status]?.icon}
                    {QUOTE_STATUS[q.status]?.label}
                  </span>
                  {q.totalAmount && (
                    <span>· CHF {q.totalAmount.toLocaleString("de-CH")}</span>
                  )}
                  <span>
                    · {new Date(q.createdAt).toLocaleDateString("de-CH")}
                  </span>
                </div>
              </div>
              {expandedId === q.id ? (
                <ChevronUp
                  size={16}
                  className="text-muted-foreground flex-shrink-0"
                />
              ) : (
                <ChevronDown
                  size={16}
                  className="text-muted-foreground flex-shrink-0"
                />
              )}
            </div>
            {expandedId === q.id && (
              <div className="px-3 pb-3 border-t border-border pt-3 space-y-3">
                <div className="bg-background/50 rounded-lg p-3 text-sm max-h-64 overflow-auto">
                  <Streamdown>{q.content}</Streamdown>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      navigator.clipboard.writeText(q.content);
                      toast.success("Kopiert!");
                    }}
                  >
                    <Copy size={12} /> Kopieren
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs gap-1 text-primary hover:text-primary"
                    onClick={() =>
                      exportQuotePdf({
                        title: q.title,
                        customerName: q.customerName,
                        customerEmail: q.customerEmail,
                        content: q.content,
                        totalAmount: q.totalAmount,
                        createdAt: q.createdAt,
                      })
                    }
                  >
                    <Download size={12} /> PDF
                  </Button>
                  <Select
                    value={q.status}
                    onValueChange={v =>
                      updateStatusMutation.mutate({
                        id: q.id,
                        status: v as typeof q.status,
                      })
                    }
                  >
                    <SelectTrigger className="h-7 text-xs bg-input border-border w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(QUOTE_STATUS).map(([v, { label }]) => (
                        <SelectItem key={v} value={v}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate({ id: q.id })}
                  >
                    <Trash2 size={12} className="mr-1" /> Löschen
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
        {quotes?.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-8">
            Noch keine Angebote. Generiere dein erstes Angebot!
          </p>
        )}
      </div>
    </div>
  );
}

// ── Text-Assistent ─────────────────────────────────────────────────────────────
function TextTab() {
  const generateMutation = trpc.grossIct.generateText.useMutation();
  const [form, setForm] = useState({
    type: "blog" as const,
    topic: "",
    details: "",
    tone: "professional" as const,
  });
  const [result, setResult] = useState("");
  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const handleGenerate = () => {
    generateMutation.mutate(form, {
      onSuccess: data => setResult(data.content),
    });
  };

  return (
    <div className="space-y-4">
      <div className="jarvis-card rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Textart</Label>
            <Select
              value={form.type}
              onValueChange={v =>
                setForm(f => ({ ...f, type: v as typeof form.type }))
              }
            >
              <SelectTrigger className="bg-input border-border mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="blog">Blogartikel</SelectItem>
                <SelectItem value="service_description">
                  Leistungsbeschrieb (Website)
                </SelectItem>
                <SelectItem value="social_media">Social-Media-Post</SelectItem>
                <SelectItem value="email">E-Mail an Kunden</SelectItem>
                <SelectItem value="other">Sonstiger Text</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Ton</Label>
            <Select
              value={form.tone}
              onValueChange={v =>
                setForm(f => ({ ...f, tone: v as typeof form.tone }))
              }
            >
              <SelectTrigger className="bg-input border-border mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Professionell</SelectItem>
                <SelectItem value="friendly">
                  Freundlich & persönlich
                </SelectItem>
                <SelectItem value="technical">Technisch & präzise</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Thema *</Label>
          <Input
            value={form.topic}
            onChange={set("topic")}
            placeholder="z.B. WLAN-Planung für KMU, Webseite für Vereine..."
            className="bg-input border-border mt-1"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">
            Zusätzliche Details
          </Label>
          <Textarea
            value={form.details}
            onChange={set("details")}
            rows={2}
            placeholder="Zielgruppe, besondere Punkte, Länge..."
            className="bg-input border-border mt-1 resize-none"
          />
        </div>
        <Button
          onClick={handleGenerate}
          disabled={!form.topic || generateMutation.isPending}
          className="bg-primary text-primary-foreground gap-1"
        >
          {generateMutation.isPending ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Generiere...
            </>
          ) : (
            <>
              <PenTool size={14} /> Text generieren
            </>
          )}
        </Button>
      </div>

      {result && (
        <div className="jarvis-card rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-jarvis text-xs text-primary">
              GENERIERTER TEXT
            </h3>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1"
              onClick={() => {
                navigator.clipboard.writeText(result);
                toast.success("Kopiert!");
              }}
            >
              <Copy size={12} /> Kopieren
            </Button>
          </div>
          <div className="bg-background/50 rounded-lg p-3 text-sm max-h-96 overflow-auto">
            <Streamdown>{result}</Streamdown>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Hauptseite ────────────────────────────────────────────────────────────────
const TABS = [
  { id: "projects", label: "Projekte", icon: Briefcase },
  { id: "quotes", label: "Angebote", icon: FileText },
  { id: "texts", label: "Texte", icon: PenTool },
];

export default function GrossIct() {
  const [activeTab, setActiveTab] = useState("projects");

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center">
            <Briefcase size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="font-jarvis text-lg font-bold text-primary">
              GROSS ICT
            </h1>
            <p className="text-xs text-muted-foreground">
              gross-ict.ch · Assistent-Modus
            </p>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex gap-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                activeTab === id
                  ? "bg-primary/20 border border-primary/40 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              )}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab-Inhalt */}
      <div className="flex-1 overflow-auto px-4 md:px-6 py-4">
        {activeTab === "projects" && <ProjectsTab />}
        {activeTab === "quotes" && <QuotesTab />}
        {activeTab === "texts" && <TextTab />}
      </div>
    </div>
  );
}
