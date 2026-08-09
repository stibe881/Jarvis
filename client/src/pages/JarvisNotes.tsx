import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Search, Trash2, Edit2, StickyNote, Tag } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Note = { id: number; title: string; content: string; tags?: string | null; updatedAt: Date };

export default function JarvisNotes() {
  const [search, setSearch] = useState("");
  const [editNote, setEditNote] = useState<Note | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", tags: "" });

  const utils = trpc.useUtils();
  const { data: notes, isLoading } = trpc.notes.list.useQuery({ search: search || undefined });
  const createMutation = trpc.notes.create.useMutation({
    onSuccess: () => { utils.notes.list.invalidate(); setIsCreating(false); setForm({ title: "", content: "", tags: "" }); toast.success("Notiz erstellt"); },
  });
  const updateMutation = trpc.notes.update.useMutation({
    onSuccess: () => { utils.notes.list.invalidate(); setEditNote(null); toast.success("Notiz gespeichert"); },
  });
  const deleteMutation = trpc.notes.delete.useMutation({
    onSuccess: () => { utils.notes.list.invalidate(); toast.success("Notiz gelöscht"); },
  });

  const openEdit = (note: Note) => {
    setEditNote(note);
    setForm({ title: note.title, content: note.content, tags: note.tags ?? "" });
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <StickyNote className="text-primary" size={20} />
          <h1 className="font-jarvis text-lg font-bold text-primary">NOTIZEN</h1>
        </div>
        <Button
          onClick={() => { setIsCreating(true); setForm({ title: "", content: "", tags: "" }); }}
          size="sm"
          className="gap-2 bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30 font-jarvis text-xs tracking-wider"
        >
          <Plus size={14} /> NEUE NOTIZ
        </Button>
      </div>

      {/* Search */}
      <div className="px-6 py-3 border-b border-border">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Notizen durchsuchen..."
            className="pl-9 bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50"
          />
        </div>
      </div>

      {/* Notes Grid */}
      <ScrollArea className="flex-1 px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-muted-foreground text-sm animate-pulse">Lade Notizen...</div>
          </div>
        ) : notes?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <StickyNote size={48} className="text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">Noch keine Notizen vorhanden.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {notes?.map((note) => (
              <div key={note.id} className="jarvis-card rounded-xl p-4 flex flex-col gap-3 group hover:border-primary/30 transition-all">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-foreground text-sm line-clamp-1 flex-1">{note.title}</h3>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(note as Note)} className="text-muted-foreground hover:text-primary p-1"><Edit2 size={12} /></button>
                    <button onClick={() => deleteMutation.mutate({ id: note.id })} className="text-muted-foreground hover:text-destructive p-1"><Trash2 size={12} /></button>
                  </div>
                </div>
                <p className="text-muted-foreground text-xs line-clamp-4 flex-1">{note.content}</p>
                {note.tags && (
                  <div className="flex flex-wrap gap-1">
                    {note.tags.split(",").map((t) => (
                      <span key={t} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        <Tag size={8} />{t.trim()}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground/50">{new Date(note.updatedAt).toLocaleDateString("de-DE")}</p>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreating || !!editNote} onOpenChange={(open) => { if (!open) { setIsCreating(false); setEditNote(null); } }}>
        <DialogContent className="bg-card border-border text-foreground max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-jarvis text-primary">{editNote ? "NOTIZ BEARBEITEN" : "NEUE NOTIZ"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Titel"
              className="bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50"
            />
            <Textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Inhalt..."
              rows={8}
              className="bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50 resize-none"
            />
            <Input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="Tags (kommagetrennt, z.B. Arbeit, Ideen)"
              className="bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => { setIsCreating(false); setEditNote(null); }}>Abbrechen</Button>
              <Button
                onClick={() => {
                  if (!form.title.trim()) { toast.error("Bitte einen Titel eingeben"); return; }
                  if (editNote) {
                    updateMutation.mutate({ id: editNote.id, ...form });
                  } else {
                    createMutation.mutate(form);
                  }
                }}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Speichern
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

