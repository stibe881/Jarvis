import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { UserPlus, Trash2, Copy, Mail, Loader2, RefreshCw, CheckCircle2 } from "lucide-react";
import { useState } from "react";

const STATUS_LABELS: Record<string, string> = {
  open: "Offen", in_progress: "In Arbeit", done: "Erledigt", cancelled: "Abgebrochen",
};

export default function JarvisDelegation() {
  const utils = trpc.useUtils();
  const { data: items, isLoading } = trpc.delegation.list.useQuery();
  const createMutation = trpc.delegation.create.useMutation({
    onSuccess: () => {
      toast.success("Delegation erstellt – E-Mail-Entwurf ist bereit");
      utils.delegation.list.invalidate();
      setDialogOpen(false);
      setName(""); setEmail(""); setTitle(""); setDetails(""); setDue("");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.delegation.update.useMutation({
    onSuccess: () => utils.delegation.list.invalidate(),
  });
  const removeMutation = trpc.delegation.remove.useMutation({
    onSuccess: () => { toast.success("Gelöscht"); utils.delegation.list.invalidate(); },
  });
  const regenMutation = trpc.delegation.regenerateEmail.useMutation({
    onSuccess: () => { toast.success("Neuer Entwurf erstellt"); utils.delegation.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [due, setDue] = useState("");

  const mailtoLink = (to: string | null, draft: string | null) => {
    if (!draft) return "#";
    const lines = draft.split("\n");
    const subjectLine = lines.find(l => /^betreff\s*:/i.test(l.trim()));
    const subject = subjectLine ? subjectLine.replace(/^betreff\s*:/i, "").trim() : "Aufgabe";
    const bodyText = lines.filter(l => l !== subjectLine).join("\n").trim();
    return `mailto:${to ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-jarvis text-2xl font-bold text-primary jarvis-glow-text">DELEGATION</h1>
          <p className="text-sm text-muted-foreground">Aufgaben zuweisen – Jarvis schreibt die E-Mail dazu</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <UserPlus size={15} /> Aufgabe delegieren
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Lade Delegationen…</p>}

      {!isLoading && (items ?? []).length === 0 && (
        <Card className="p-8 text-center">
          <UserPlus className="mx-auto text-muted-foreground mb-3" size={30} />
          <p className="text-sm text-muted-foreground">Noch keine Aufgaben delegiert.</p>
        </Card>
      )}

      <div className="space-y-3">
        {(items ?? []).map(d => (
          <Card key={d.id} className="p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-medium text-sm">{d.title}</h3>
                <p className="text-xs text-muted-foreground">
                  An {d.assigneeName}{d.assigneeEmail ? ` (${d.assigneeEmail})` : ""}
                  {d.dueDate ? ` · Frist ${new Date(d.dueDate).toLocaleDateString("de-CH")}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={d.status} onValueChange={(v) => updateMutation.mutate({ id: d.id, status: v as "open" | "in_progress" | "done" | "cancelled" })}>
                  <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
                <button onClick={() => removeMutation.mutate({ id: d.id })} className="text-muted-foreground hover:text-destructive">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {d.details && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{d.details}</p>}

            {d.emailDraft && (
              <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{d.emailDraft}</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { navigator.clipboard.writeText(d.emailDraft ?? ""); toast.success("Kopiert"); }}>
                    <Copy size={13} /> Kopieren
                  </Button>
                  <a href={mailtoLink(d.assigneeEmail, d.emailDraft)}>
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => updateMutation.mutate({ id: d.id, markEmailSent: true })}>
                      <Mail size={13} /> In E-Mail öffnen
                    </Button>
                  </a>
                  <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => regenMutation.mutate({ id: d.id, tone: "dringend" })} disabled={regenMutation.isPending}>
                    {regenMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Dringlicher formulieren
                  </Button>
                  {d.emailSentAt && (
                    <span className="text-[10px] text-primary flex items-center gap-1">
                      <CheckCircle2 size={12} /> versendet am {new Date(d.emailSentAt).toLocaleDateString("de-CH")}
                    </span>
                  )}
                </div>
              </div>
            )}

            <Badge variant="outline" className="text-[10px]">{STATUS_LABELS[d.status]}</Badge>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-jarvis">Aufgabe delegieren</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Name der Person, z.B. Bine" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="E-Mail-Adresse (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input placeholder="Was soll erledigt werden?" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea placeholder="Details und Kontext (optional)" value={details} onChange={(e) => setDetails(e.target.value)} rows={4} />
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Frist</label>
              <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button
              onClick={() => createMutation.mutate({
                assigneeName: name,
                assigneeEmail: email || undefined,
                title,
                details: details || undefined,
                dueDate: due ? new Date(due).getTime() : undefined,
                generateEmail: true,
              })}
              disabled={!name.trim() || !title.trim() || createMutation.isPending}
              className="gap-2"
            >
              {createMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : null}
              Erstellen und E-Mail entwerfen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

