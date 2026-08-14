import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  Brain,
  Plus,
  Trash2,
  Edit2,
  User,
  Heart,
  Briefcase,
  Star,
  Info,
  MapPin,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: "person", label: "Person", icon: User, color: "text-blue-400" },
  { value: "contact", label: "Kontakt", icon: User, color: "text-cyan-400" },
  {
    value: "address",
    label: "Adressen",
    icon: MapPin,
    color: "text-emerald-400",
  },
  {
    value: "preference",
    label: "Präferenz",
    icon: Heart,
    color: "text-pink-400",
  },
  {
    value: "project",
    label: "Projekt",
    icon: Briefcase,
    color: "text-yellow-400",
  },
  { value: "fact", label: "Fakt", icon: Info, color: "text-green-400" },
  { value: "other", label: "Sonstiges", icon: Star, color: "text-purple-400" },
];

function getCatInfo(cat: string) {
  return (
    CATEGORIES.find(c => c.value === cat) ?? CATEGORIES[CATEGORIES.length - 1]
  );
}

export default function JarvisMemory() {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ category: "fact", key: "", value: "" });
  const [filterCat, setFilterCat] = useState<string>("all");
  const [search, setSearch] = useState("");

  const utils = trpc.useUtils();
  const { data: memories, isLoading } = trpc.memory.list.useQuery();

  const upsertMutation = trpc.memory.upsert.useMutation({
    onSuccess: () => {
      utils.memory.list.invalidate();
      setShowModal(false);
      setEditingId(null);
      setForm({ category: "fact", key: "", value: "" });
      toast.success(
        editingId ? "Erinnerung aktualisiert" : "Erinnerung gespeichert"
      );
    },
    onError: e => toast.error(e.message),
  });

  const deleteMutation = trpc.memory.delete.useMutation({
    onSuccess: () => {
      utils.memory.list.invalidate();
      toast.success("Erinnerung gelöscht");
    },
    onError: e => toast.error(e.message),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm({ category: "fact", key: "", value: "" });
    setShowModal(true);
  };

  const openEdit = (mem: {
    id: number;
    category: string;
    key: string;
    value: string;
  }) => {
    setEditingId(mem.id);
    setForm({ category: mem.category, key: mem.key, value: mem.value });
    setShowModal(true);
  };

  const save = () => {
    if (!form.key.trim()) {
      toast.error("Bitte einen Schlüssel eingeben");
      return;
    }
    if (!form.value.trim()) {
      toast.error("Bitte einen Wert eingeben");
      return;
    }
    upsertMutation.mutate(form);
  };

  const filtered = (memories ?? []).filter(m => {
    const matchCat = filterCat === "all" || m.category === filterCat;
    const term = search.toLowerCase();
    const matchSearch =
      term === "" ||
      m.key.toLowerCase().includes(term) ||
      m.value.toLowerCase().includes(term);
    return matchCat && matchSearch;
  });

  // Gruppiert nach Kategorie
  const grouped = filtered.reduce<Record<string, typeof filtered>>((acc, m) => {
    if (!acc[m.category]) acc[m.category] = [];
    acc[m.category].push(m);
    return acc;
  }, {});

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 md:px-6 py-3 border-b border-border flex-shrink-0">
        <Brain className="text-primary flex-shrink-0" size={18} />
        <h1 className="font-jarvis text-base font-bold text-primary">
          GEDÄCHTNIS
        </h1>
        <span className="text-xs text-muted-foreground hidden sm:inline">
          {memories?.length ?? 0} Erinnerungen gespeichert
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Suchen..."
            className="h-7 text-xs w-24 sm:w-40 bg-transparent border-border"
          />
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="h-7 text-xs w-32 bg-transparent border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              {CATEGORIES.map(c => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={openCreate}
            size="sm"
            className="gap-1 text-xs bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30 font-jarvis tracking-wider px-2"
          >
            <Plus size={14} /> <span className="hidden sm:inline">NEU</span>
          </Button>
        </div>
      </div>

      {/* Inhalt */}
      <div className="flex-1 min-h-0 w-full overflow-y-auto scroll-smooth">
        <div className="p-3 md:p-6">
          {isLoading && (
            <div className="text-center text-muted-foreground py-12">
              Lade Erinnerungen...
            </div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                <Brain className="text-primary" size={28} />
              </div>
              <div>
                <p className="font-jarvis text-primary font-bold">
                  KEIN GEDÄCHTNIS
                </p>
                <p className="text-muted-foreground text-sm mt-1">
                  Sage Jarvis im Chat wichtige Informationen – er merkt sie sich
                  automatisch.
                  <br />
                  Oder füge sie manuell hinzu.
                </p>
              </div>
              <Button
                onClick={openCreate}
                className="bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 font-jarvis tracking-wider gap-2"
              >
                <Plus size={14} /> ERSTE ERINNERUNG
              </Button>
            </div>
          )}
          {Object.entries(grouped).map(([cat, items]) => {
            const catInfo = getCatInfo(cat);
            const Icon = catInfo.icon;
            return (
              <div key={cat} className="mb-6">
                <div
                  className={cn(
                    "flex items-center gap-2 mb-3 font-jarvis text-xs font-bold tracking-wider uppercase",
                    catInfo.color
                  )}
                >
                  <Icon size={14} />
                  {catInfo.label}
                  <span className="text-muted-foreground font-normal normal-case">
                    ({items.length})
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map(mem => (
                    <div
                      key={mem.id}
                      className="group flex items-start gap-3 p-3 rounded-lg bg-card border border-border hover:border-primary/30 transition-all"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-muted-foreground font-medium mb-0.5">
                          {mem.key}
                        </div>
                        <div className="text-sm text-foreground">
                          {mem.value}
                        </div>
                        <div className="text-xs text-muted-foreground/50 mt-1">
                          {mem.source === "chat"
                            ? "🤖 Von Jarvis gelernt"
                            : "✏️ Manuell"}{" "}
                          ·{" "}
                          {new Date(mem.updatedAt).toLocaleDateString("de-DE")}
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          onClick={() => openEdit(mem)}
                          className="text-muted-foreground hover:text-primary p-1"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`"${mem.key}" löschen?`))
                              deleteMutation.mutate({ id: mem.id });
                          }}
                          className="text-muted-foreground hover:text-destructive p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      <Dialog
        open={showModal}
        onOpenChange={o => {
          setShowModal(o);
          if (!o) {
            setEditingId(null);
            setForm({ category: "fact", key: "", value: "" });
          }
        }}
      >
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-jarvis text-primary">
              {editingId ? "ERINNERUNG BEARBEITEN" : "NEUE ERINNERUNG"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Select
              value={form.category}
              onValueChange={v => setForm({ ...form, category: v })}
            >
              <SelectTrigger className="bg-input border-border">
                <SelectValue placeholder="Kategorie" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={form.key}
              onChange={e => setForm({ ...form, key: e.target.value })}
              placeholder='Schlüssel (z.B. "Bine E-Mail") *'
              className="bg-input border-border"
            />
            <Input
              value={form.value}
              onChange={e => setForm({ ...form, value: e.target.value })}
              placeholder='Wert (z.B. "bine@example.com") *'
              className="bg-input border-border"
            />
            <Button
              onClick={save}
              disabled={upsertMutation.isPending}
              className="w-full bg-primary text-primary-foreground font-jarvis tracking-wider"
            >
              {upsertMutation.isPending ? "Speichern..." : "SPEICHERN"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
