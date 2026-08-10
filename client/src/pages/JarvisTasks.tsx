import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Plus,
  Trash2,
  CheckSquare,
  Square,
  Calendar,
  AlertCircle,
  Bell,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Task = {
  id: number;
  title: string;
  description?: string | null;
  completed: boolean;
  priority: "low" | "medium" | "high";
  dueDate?: number | null;
  createdAt: Date;
};

const priorityColors = {
  low: "text-chart-2 border-chart-2/30 bg-chart-2/10",
  medium: "text-chart-1 border-chart-1/30 bg-chart-1/10",
  high: "text-destructive border-destructive/30 bg-destructive/10",
};

const priorityLabels = { low: "Niedrig", medium: "Mittel", high: "Hoch" };

export default function JarvisTasks() {
  const [isCreating, setIsCreating] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "done">("all");
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "medium" as "low" | "medium" | "high",
    dueDate: "",
  });

  const utils = trpc.useUtils();
  const { data: tasks, isLoading } = trpc.tasks.list.useQuery();
  const createMutation = trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate();
      setIsCreating(false);
      setForm({ title: "", description: "", priority: "medium", dueDate: "" });
      toast.success("Aufgabe erstellt");
    },
  });
  const toggleMutation = trpc.tasks.toggleComplete.useMutation({
    onSuccess: () => utils.tasks.list.invalidate(),
  });
  const deleteMutation = trpc.tasks.delete.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate();
      toast.success("Aufgabe gelöscht");
    },
  });
  const checkDueMutation = trpc.notifications.checkDueTasks.useMutation({
    onSuccess: data => {
      if (data.sent) {
        toast.success(
          `Benachrichtigung gesendet: ${data.overdue} überfällig, ${data.dueSoon} bald fällig`
        );
      } else {
        toast.info(
          data.message ?? "Keine fälligen Aufgaben – alles im grünen Bereich!"
        );
      }
    },
    onError: () => toast.error("Benachrichtigung fehlgeschlagen"),
  });

  const filteredTasks =
    tasks?.filter(t => {
      if (filter === "pending") return !t.completed;
      if (filter === "done") return t.completed;
      return true;
    }) ?? [];

  const pending = tasks?.filter(t => !t.completed).length ?? 0;
  const done = tasks?.filter(t => t.completed).length ?? 0;

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-3 md:px-6 py-3 md:py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <CheckSquare className="text-primary" size={20} />
          <h1 className="font-jarvis text-lg font-bold text-primary">
            AUFGABEN
          </h1>
          <div className="flex gap-2 ml-4">
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {pending} offen
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {done} erledigt
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => checkDueMutation.mutate()}
            disabled={checkDueMutation.isPending}
            title="Fällige Aufgaben prüfen & Benachrichtigung senden"
            className="gap-1 text-muted-foreground hover:text-primary text-xs px-2"
          >
            <Bell
              size={14}
              className={checkDueMutation.isPending ? "animate-pulse" : ""}
            />
            <span className="hidden sm:inline">Erinnern</span>
          </Button>
          <Button
            onClick={() => setIsCreating(true)}
            size="sm"
            className="gap-2 bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30 font-jarvis text-xs tracking-wider"
          >
            <Plus size={14} />{" "}
            <span className="hidden sm:inline">NEUE AUFGABE</span>
            <span className="sm:hidden">NEU</span>
          </Button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 px-6 py-3 border-b border-border">
        {(["all", "pending", "done"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-md transition-all",
              filter === f
                ? "bg-primary/20 text-primary border border-primary/30"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            {f === "all" ? "Alle" : f === "pending" ? "Offen" : "Erledigt"}
          </button>
        ))}
      </div>

      {/* Tasks List */}
      <ScrollArea className="flex-1 px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-muted-foreground text-sm animate-pulse">
              Lade Aufgaben...
            </div>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <CheckSquare size={48} className="text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">
              Keine Aufgaben gefunden.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTasks.map(task => (
              <div
                key={task.id}
                className={cn(
                  "group flex items-start gap-3 p-4 rounded-xl jarvis-card hover:border-primary/30 transition-all",
                  task.completed && "opacity-50"
                )}
              >
                <button
                  onClick={() =>
                    toggleMutation.mutate({
                      id: task.id,
                      completed: !task.completed,
                    })
                  }
                  className={cn(
                    "mt-0.5 flex-shrink-0 transition-colors",
                    task.completed
                      ? "text-primary"
                      : "text-muted-foreground hover:text-primary"
                  )}
                >
                  {task.completed ? (
                    <CheckSquare size={18} />
                  ) : (
                    <Square size={18} />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        task.completed && "line-through text-muted-foreground"
                      )}
                    >
                      {task.title}
                    </span>
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full border",
                        priorityColors[task.priority]
                      )}
                    >
                      {priorityLabels[task.priority]}
                    </span>
                  </div>
                  {task.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {task.description}
                    </p>
                  )}
                  {task.dueDate && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <Calendar size={10} />
                      {new Date(task.dueDate).toLocaleDateString("de-DE", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                      {task.dueDate < Date.now() && !task.completed && (
                        <span className="text-destructive flex items-center gap-0.5 ml-1">
                          <AlertCircle size={10} /> Überfällig
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => deleteMutation.mutate({ id: task.id })}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all flex-shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Create Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="font-jarvis text-primary">
              NEUE AUFGABE
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Aufgabentitel"
              className="bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50"
            />
            <Textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Beschreibung (optional)"
              rows={3}
              className="bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50 resize-none"
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Priorität
                </label>
                <Select
                  value={form.priority}
                  onValueChange={v =>
                    setForm({
                      ...form,
                      priority: v as "low" | "medium" | "high",
                    })
                  }
                >
                  <SelectTrigger className="bg-input border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground">
                    <SelectItem value="low">Niedrig</SelectItem>
                    <SelectItem value="medium">Mittel</SelectItem>
                    <SelectItem value="high">Hoch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Fälligkeitsdatum
                </label>
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={e => setForm({ ...form, dueDate: e.target.value })}
                  className="bg-input border-border text-foreground focus:border-primary/50"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setIsCreating(false)}>
                Abbrechen
              </Button>
              <Button
                onClick={() => {
                  if (!form.title.trim()) {
                    toast.error("Bitte einen Titel eingeben");
                    return;
                  }
                  createMutation.mutate({
                    title: form.title,
                    description: form.description || undefined,
                    priority: form.priority,
                    dueDate: form.dueDate
                      ? new Date(form.dueDate).getTime()
                      : undefined,
                  });
                }}
                disabled={createMutation.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Erstellen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
