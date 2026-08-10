import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  FileText,
  Plus,
  Star,
  Trash2,
  Sparkles,
  Download,
  Copy,
  Loader2,
  Wand2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<string, string> = {
  quote: "Angebot",
  invoice: "Rechnung",
  concept: "Konzept",
  report: "Bericht",
  email: "E-Mail",
  procurement: "Beschaffung",
  minutes: "Protokoll",
  other: "Sonstiges",
};
const CONTEXT_LABELS: Record<string, string> = {
  gross_ict: "Gross ICT",
  sonnenberg: "Sonnenberg",
  general: "Allgemein",
};

export default function JarvisTemplates() {
  const utils = trpc.useUtils();
  const { data: templates, isLoading } = trpc.templates.list.useQuery();
  const seedMutation = trpc.templates.seedStarters.useMutation({
    onSuccess: r => {
      toast.success(`${r.added} Vorlagen hinzugefügt`);
      utils.templates.list.invalidate();
    },
    onError: e => toast.error(e.message),
  });
  const createMutation = trpc.templates.create.useMutation({
    onSuccess: () => {
      toast.success("Vorlage gespeichert");
      utils.templates.list.invalidate();
      setEditorOpen(false);
    },
    onError: e => toast.error(e.message),
  });
  const updateMutation = trpc.templates.update.useMutation({
    onSuccess: () => utils.templates.list.invalidate(),
  });
  const removeMutation = trpc.templates.remove.useMutation({
    onSuccess: () => {
      toast.success("Vorlage gelöscht");
      utils.templates.list.invalidate();
    },
  });
  const fillMutation = trpc.templates.fill.useMutation({
    onSuccess: r => {
      setResult(r.content);
      toast.success("Dokument erstellt");
    },
    onError: e => toast.error(e.message),
  });

  const [filter, setFilter] = useState<string>("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<string>("other");
  const [newContext, setNewContext] = useState<string>("general");
  const [newDescription, setNewDescription] = useState("");
  const [newContent, setNewContent] = useState("");

  const [activeId, setActiveId] = useState<number | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [extraContext, setExtraContext] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const active = templates?.find(t => t.id === activeId) ?? null;
  const activePlaceholders = useMemo<string[]>(() => {
    if (!active?.placeholders) return [];
    try {
      return JSON.parse(active.placeholders) as string[];
    } catch {
      return [];
    }
  }, [active]);

  const filtered = (templates ?? []).filter(
    t => filter === "all" || t.context === filter
  );

  const openTemplate = (id: number) => {
    setActiveId(id);
    setValues({});
    setExtraContext("");
    setResult(null);
  };

  const downloadPdf = async () => {
    if (!result || !active) return;
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const margin = 18;
    const maxWidth = 210 - margin * 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(
      result.replace(/[#*`]/g, ""),
      maxWidth
    ) as string[];
    let y = margin;
    for (const line of lines) {
      if (y > 280) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += 5;
    }
    doc.save(`${active.name.replace(/[^a-zA-Z0-9äöüÄÖÜ -]/g, "")}.pdf`);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-jarvis text-2xl font-bold text-primary jarvis-glow-text">
            VORLAGEN
          </h1>
          <p className="text-sm text-muted-foreground">
            Wiederkehrende Dokumente in Sekunden erstellen
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            className="gap-2"
          >
            {seedMutation.isPending ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Sparkles size={15} />
            )}
            Standard-Vorlagen laden
          </Button>
          <Button onClick={() => setEditorOpen(true)} className="gap-2">
            <Plus size={15} /> Neue Vorlage
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ["all", "Alle"],
          ["gross_ict", "Gross ICT"],
          ["sonnenberg", "Sonnenberg"],
          ["general", "Allgemein"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
              filter === key
                ? "bg-primary/20 text-primary border-primary/40"
                : "text-muted-foreground border-border hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Lade Vorlagen…</p>
      )}

      {!isLoading && filtered.length === 0 && (
        <Card className="p-8 text-center space-y-3">
          <FileText className="mx-auto text-muted-foreground" size={32} />
          <p className="text-sm text-muted-foreground">
            Noch keine Vorlagen vorhanden.
          </p>
          <Button
            variant="outline"
            onClick={() => seedMutation.mutate()}
            className="gap-2"
          >
            <Sparkles size={15} /> Standard-Vorlagen laden
          </Button>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(t => (
          <Card
            key={t.id}
            className="p-4 space-y-2 hover:border-primary/40 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium text-sm leading-snug">{t.name}</h3>
              <button
                onClick={() =>
                  updateMutation.mutate({ id: t.id, isFavorite: !t.isFavorite })
                }
                className={cn(
                  "flex-shrink-0",
                  t.isFavorite
                    ? "text-primary"
                    : "text-muted-foreground hover:text-primary"
                )}
                title="Favorit"
              >
                <Star size={15} fill={t.isFavorite ? "currentColor" : "none"} />
              </button>
            </div>
            {t.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {t.description}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="text-[10px]">
                {CONTEXT_LABELS[t.context]}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {CATEGORY_LABELS[t.category]}
              </Badge>
              {t.usageCount > 0 && (
                <Badge variant="outline" className="text-[10px]">
                  {t.usageCount}× genutzt
                </Badge>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                className="flex-1 gap-1.5 text-xs"
                onClick={() => openTemplate(t.id)}
              >
                <Wand2 size={13} /> Ausfüllen
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeMutation.mutate({ id: t.id })}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Dialog
        open={activeId !== null}
        onOpenChange={o => {
          if (!o) {
            setActiveId(null);
            setResult(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-jarvis">{active?.name}</DialogTitle>
          </DialogHeader>

          {!result && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Fülle aus, was du weisst. Leere Felder kann Jarvis auf Wunsch
                sinnvoll ergänzen.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {activePlaceholders.map(ph => (
                  <div key={ph} className="space-y-1">
                    <label className="text-xs text-muted-foreground">
                      {ph}
                    </label>
                    <Input
                      value={values[ph] ?? ""}
                      onChange={e =>
                        setValues(v => ({ ...v, [ph]: e.target.value }))
                      }
                      placeholder={ph}
                    />
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Zusätzlicher Kontext für Jarvis (optional)
                </label>
                <Textarea
                  value={extraContext}
                  onChange={e => setExtraContext(e.target.value)}
                  placeholder="z.B. Kunde will Umsetzung bis Ende September, Budget knapp"
                  rows={3}
                />
              </div>
            </div>
          )}

          {result && (
            <Textarea
              value={result}
              onChange={e => setResult(e.target.value)}
              rows={22}
              className="font-mono text-xs"
            />
          )}

          <DialogFooter className="flex-wrap gap-2">
            {!result && (
              <>
                <Button
                  variant="outline"
                  onClick={() =>
                    activeId &&
                    fillMutation.mutate({
                      id: activeId,
                      values,
                      autoComplete: false,
                    })
                  }
                  disabled={fillMutation.isPending}
                >
                  Nur einsetzen
                </Button>
                <Button
                  onClick={() =>
                    activeId &&
                    fillMutation.mutate({
                      id: activeId,
                      values,
                      autoComplete: true,
                      extraContext: extraContext || undefined,
                    })
                  }
                  disabled={fillMutation.isPending}
                  className="gap-2"
                >
                  {fillMutation.isPending ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Sparkles size={15} />
                  )}
                  Von Jarvis ergänzen
                </Button>
              </>
            )}
            {result && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(result);
                    toast.success("Kopiert");
                  }}
                  className="gap-2"
                >
                  <Copy size={15} /> Kopieren
                </Button>
                <Button onClick={downloadPdf} className="gap-2">
                  <Download size={15} /> Als PDF
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-jarvis">Neue Vorlage</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Name der Vorlage"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Kategorie" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={newContext} onValueChange={setNewContext}>
                <SelectTrigger>
                  <SelectValue placeholder="Bereich" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTEXT_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              placeholder="Kurzbeschreibung (optional)"
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
            />
            <Textarea
              placeholder={
                "Vorlagentext mit Platzhaltern in doppelten geschweiften Klammern"
              }
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              rows={14}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Platzhalter werden automatisch erkannt: alles in doppelten
              geschweiften Klammern wird später zum Eingabefeld.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={() =>
                createMutation.mutate({
                  name: newName,
                  category: newCategory as
                    | "quote"
                    | "invoice"
                    | "concept"
                    | "report"
                    | "email"
                    | "procurement"
                    | "minutes"
                    | "other",
                  context: newContext as "gross_ict" | "sonnenberg" | "general",
                  description: newDescription || undefined,
                  content: newContent,
                })
              }
              disabled={
                !newName.trim() ||
                !newContent.trim() ||
                createMutation.isPending
              }
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
