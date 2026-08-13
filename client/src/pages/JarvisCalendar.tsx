import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Calendar,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  RefreshCw,
  Unlink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

type GCalEvent = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  htmlLink?: string;
};

const CALENDAR_COLORS: Record<string, string> = {
  primary: "bg-blue-500/20 border-blue-500/40 text-blue-300",
  default: "bg-cyan-500/20 border-cyan-500/40 text-cyan-300",
};

function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Zurich",
  });
}

function formatTime(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Zurich",
  });
}

function toLocalDatetimeInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function JarvisCalendar() {
  const [selectedCalendar, setSelectedCalendar] = useState("primary");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "list">("month");
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<GCalEvent | null>(null);
  const [form, setForm] = useState({
    summary: "",
    description: "",
    location: "",
    startDateTime: "",
    endDateTime: "",
    allDay: false,
  });

  const utils = trpc.useUtils();
  const { data: status } = trpc.calendar.getStatus.useQuery();
  const { data: authUrl } = trpc.calendar.getAuthUrl.useQuery(undefined, {
    enabled: !status?.googleConnected,
  });
  const { data: msAuthUrl } = trpc.calendar.getMsAuthUrl.useQuery(undefined, {
    enabled: !status?.msConnected,
  });
  const { data: calendars } = trpc.calendar.listCalendars.useQuery(undefined, {
    enabled: !!status?.connected,
  });

  // Zeitraum für aktuellen Monat
  const timeMin = useMemo(() => {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    return d.toISOString();
  }, [currentDate]);
  const timeMax = useMemo(() => {
    const d = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0,
      23,
      59,
      59
    );
    return d.toISOString();
  }, [currentDate]);

  const {
    data: events,
    isLoading: eventsLoading,
    refetch,
  } = trpc.calendar.listEvents.useQuery(
    { calendarId: selectedCalendar, timeMin, timeMax, maxResults: 100 },
    { enabled: !!status?.connected }
  );

  const disconnectMutation = trpc.calendar.disconnect.useMutation({
    onSuccess: () => {
      utils.calendar.getStatus.invalidate();
      toast.success("Google Kalender getrennt");
    },
  });

  const disconnectMsMutation = trpc.calendar.disconnectMs.useMutation({
    onSuccess: () => {
      utils.calendar.getStatus.invalidate();
      toast.success("Microsoft Kalender getrennt");
    },
  });

  const createMutation = trpc.calendar.createEvent.useMutation({
    onSuccess: () => {
      utils.calendar.listEvents.invalidate();
      setShowEventModal(false);
      resetForm();
      toast.success("Termin erstellt");
    },
    onError: e => toast.error(e.message),
  });

  const updateMutation = trpc.calendar.updateEvent.useMutation({
    onSuccess: () => {
      utils.calendar.listEvents.invalidate();
      setShowEventModal(false);
      setEditingEvent(null);
      resetForm();
      toast.success("Termin aktualisiert");
    },
    onError: e => toast.error(e.message),
  });

  const deleteMutation = trpc.calendar.deleteEvent.useMutation({
    onSuccess: () => {
      utils.calendar.listEvents.invalidate();
      toast.success("Termin gelöscht");
    },
    onError: e => toast.error(e.message),
  });

  const resetForm = () =>
    setForm({
      summary: "",
      description: "",
      location: "",
      startDateTime: "",
      endDateTime: "",
      allDay: false,
    });

  const openCreate = () => {
    resetForm();
    setEditingEvent(null);
    setShowEventModal(true);
  };

  const openEdit = (ev: GCalEvent) => {
    setEditingEvent(ev);
    setForm({
      summary: ev.summary ?? "",
      description: ev.description ?? "",
      location: ev.location ?? "",
      startDateTime: toLocalDatetimeInput(ev.start?.dateTime ?? ev.start?.date),
      endDateTime: toLocalDatetimeInput(ev.end?.dateTime ?? ev.end?.date),
      allDay: !ev.start?.dateTime,
    });
    setShowEventModal(true);
  };

  const saveEvent = () => {
    if (!form.summary.trim()) {
      toast.error("Bitte Titel eingeben");
      return;
    }
    if (!form.startDateTime || !form.endDateTime) {
      toast.error("Bitte Start- und Endzeit eingeben");
      return;
    }
    const startISO = new Date(form.startDateTime).toISOString();
    const endISO = new Date(form.endDateTime).toISOString();
    if (editingEvent) {
      updateMutation.mutate({
        calendarId: selectedCalendar,
        eventId: editingEvent.id,
        summary: form.summary,
        description: form.description,
        location: form.location,
        startDateTime: startISO,
        endDateTime: endISO,
      });
    } else {
      createMutation.mutate({
        calendarId: selectedCalendar,
        summary: form.summary,
        description: form.description,
        location: form.location,
        startDateTime: startISO,
        endDateTime: endISO,
        allDay: form.allDay,
      });
    }
  };

  // Monatsansicht: Tage des Monats
  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: Array<{ date: Date | null; events: GCalEvent[] }> = [];
    // Leere Felder vor dem 1.
    for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++)
      days.push({ date: null, events: [] });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dayEvents = (events ?? []).filter(ev => {
        const evDate = new Date(ev.start?.dateTime ?? ev.start?.date ?? "");
        return (
          evDate.getDate() === d &&
          evDate.getMonth() === month &&
          evDate.getFullYear() === year
        );
      });
      days.push({ date, events: dayEvents });
    }
    return days;
  }, [currentDate, events]);

  const monthName = currentDate.toLocaleDateString("de-DE", {
    month: "long",
    year: "numeric",
  });
  const today = new Date();

  // ── Nicht verbunden ──────────────────────────────────────────────────────────
  if (!status?.connected) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-6 p-8">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Calendar className="text-primary" size={28} />
          </div>
          <h2 className="font-jarvis text-xl font-bold text-primary">
            KALENDER VERBINDEN
          </h2>
          <p className="text-muted-foreground text-sm">
            Verbinde deinen Kalender, damit Jarvis Termine lesen, erstellen und
            bearbeiten kann.
          </p>
          <div className="flex flex-col gap-2 w-full mt-2">
            {authUrl?.url && (
              <Button
                onClick={() => (window.location.href = authUrl.url)}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-jarvis tracking-wider gap-2"
              >
                <ExternalLink size={16} />
                GOOGLE KALENDER
              </Button>
            )}
            {msAuthUrl?.url && (
              <Button
                onClick={() => (window.location.href = msAuthUrl.url)}
                className="w-full bg-[#00a4ef] text-white hover:bg-[#00a4ef]/90 font-jarvis tracking-wider gap-2"
              >
                <ExternalLink size={16} />
                MICROSOFT KALENDER
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 md:px-6 py-3 border-b border-border flex-shrink-0">
        <Calendar className="text-primary flex-shrink-0" size={18} />
        <h1 className="font-jarvis text-base font-bold text-primary">
          KALENDER
        </h1>
        {status.email && (
          <span className="text-xs text-muted-foreground hidden sm:inline truncate max-w-[180px]">
            {status.email}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="text-muted-foreground hover:text-primary px-2"
          >
            <RefreshCw size={14} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={openCreate}
            className="gap-1 text-xs bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30 font-jarvis tracking-wider px-2"
          >
            <Plus size={14} /> <span className="hidden sm:inline">TERMIN</span>
          </Button>

          {/* Connect / Disconnect Google */}
          {!status.googleConnected ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (authUrl?.url) window.location.href = authUrl.url;
              }}
              className="text-muted-foreground hover:text-primary px-2"
              title="Google Kalender verbinden"
            >
              <Plus size={14} /> G
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => disconnectMutation.mutate()}
              className="text-muted-foreground hover:text-destructive px-2"
              title="Google trennen"
            >
              <Unlink size={14} /> G
            </Button>
          )}

          {/* Connect / Disconnect Microsoft */}
          {!status.msConnected ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (msAuthUrl?.url) window.location.href = msAuthUrl.url;
              }}
              className="text-muted-foreground hover:text-[#00a4ef] px-2"
              title="Microsoft Kalender verbinden"
            >
              <Plus size={14} /> M
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => disconnectMsMutation.mutate()}
              className="text-muted-foreground hover:text-destructive px-2"
              title="Microsoft trennen"
            >
              <Unlink size={14} /> M
            </Button>
          )}
        </div>
      </div>

      {/* Kalender-Auswahl */}
      {calendars && calendars.length > 1 && (
        <div className="flex gap-2 px-3 md:px-6 py-2 border-b border-border overflow-x-auto flex-shrink-0">
          {calendars.map(cal => (
            <button
              key={cal.id}
              onClick={() => setSelectedCalendar(cal.id)}
              className={cn(
                "text-xs px-3 py-1 rounded-full border transition-all whitespace-nowrap",
                selectedCalendar === cal.id
                  ? "bg-primary/20 text-primary border-primary/40"
                  : "text-muted-foreground border-border hover:text-foreground"
              )}
            >
              {cal.summary}
            </button>
          ))}
        </div>
      )}

      {/* Monat-Navigation + View-Toggle */}
      <div className="flex items-center gap-2 px-3 md:px-6 py-2 border-b border-border flex-shrink-0">
        <button
          onClick={() =>
            setCurrentDate(
              new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
            )
          }
          className="text-muted-foreground hover:text-primary p-1"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="font-jarvis text-sm text-primary font-bold flex-1 text-center capitalize">
          {monthName}
        </span>
        <button
          onClick={() =>
            setCurrentDate(
              new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
            )
          }
          className="text-muted-foreground hover:text-primary p-1"
        >
          <ChevronRight size={18} />
        </button>
        <div className="flex gap-1 ml-2">
          {(["month", "list"] as const).map(v => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              className={cn(
                "text-xs px-2 py-1 rounded border transition-all",
                viewMode === v
                  ? "bg-primary/20 text-primary border-primary/40"
                  : "text-muted-foreground border-border"
              )}
            >
              {v === "month" ? "Monat" : "Liste"}
            </button>
          ))}
        </div>
      </div>

      {/* Monatsansicht */}
      {viewMode === "month" && (
        <div className="flex-1 overflow-auto p-2 md:p-4">
          {/* Wochentage */}
          <div className="grid grid-cols-7 mb-1">
            {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map(d => (
              <div
                key={d}
                className="text-center text-xs text-muted-foreground py-1 font-medium"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {monthDays.map((cell, i) => {
              const isToday =
                cell.date && cell.date.toDateString() === today.toDateString();
              return (
                <div
                  key={i}
                  className={cn(
                    "min-h-[60px] md:min-h-[80px] rounded-lg p-1 border transition-all",
                    cell.date
                      ? "border-border hover:border-primary/30 cursor-default"
                      : "border-transparent",
                    isToday ? "border-primary/50 bg-primary/5" : ""
                  )}
                >
                  {cell.date && (
                    <>
                      <div
                        className={cn(
                          "text-xs font-medium mb-1 w-5 h-5 flex items-center justify-center rounded-full",
                          isToday
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground"
                        )}
                      >
                        {cell.date.getDate()}
                      </div>
                      <div className="space-y-0.5">
                        {cell.events.slice(0, 2).map(ev => (
                          <button
                            key={ev.id}
                            onClick={() => openEdit(ev)}
                            className="w-full text-left text-[10px] px-1 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 truncate hover:bg-primary/30 transition-all"
                          >
                            {ev.start?.dateTime
                              ? formatTime(ev.start.dateTime) + " "
                              : ""}
                            {ev.summary ?? "Termin"}
                          </button>
                        ))}
                        {cell.events.length > 2 && (
                          <div className="text-[10px] text-muted-foreground px-1">
                            +{cell.events.length - 2} mehr
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Listenansicht */}
      {viewMode === "list" && (
        <ScrollArea className="flex-1">
          <div className="p-3 md:p-6 space-y-2">
            {eventsLoading && (
              <div className="text-center text-muted-foreground py-8">
                Lade Termine...
              </div>
            )}
            {!eventsLoading && (!events || events.length === 0) && (
              <div className="text-center text-muted-foreground py-8">
                Keine Termine in diesem Monat
              </div>
            )}
            {events?.map(ev => (
              <div
                key={ev.id}
                className="group flex items-start gap-3 p-3 rounded-lg bg-card border border-border hover:border-primary/30 transition-all"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-foreground truncate">
                    {ev.summary ?? "Termin"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {ev.start?.dateTime
                      ? `${formatDate(ev.start.dateTime)} ${formatTime(ev.start.dateTime)} – ${formatTime(ev.end?.dateTime)}`
                      : formatDate(ev.start?.date)}
                  </div>
                  {ev.location && (
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      📍 {ev.location}
                    </div>
                  )}
                  {ev.description && (
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {ev.description}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    onClick={() => openEdit(ev)}
                    className="text-muted-foreground hover:text-primary p-1"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`"${ev.summary}" löschen?`))
                        deleteMutation.mutate({
                          calendarId: selectedCalendar,
                          eventId: ev.id,
                        });
                    }}
                    className="text-muted-foreground hover:text-destructive p-1"
                  >
                    <Trash2 size={14} />
                  </button>
                  {ev.htmlLink && (
                    <a
                      href={ev.htmlLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary p-1"
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Termin-Modal */}
      <Dialog
        open={showEventModal}
        onOpenChange={o => {
          setShowEventModal(o);
          if (!o) {
            setEditingEvent(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-jarvis text-primary">
              {editingEvent ? "TERMIN BEARBEITEN" : "NEUER TERMIN"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input
              value={form.summary}
              onChange={e => setForm({ ...form, summary: e.target.value })}
              placeholder="Titel *"
              className="bg-input border-border"
            />
            <Input
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Beschreibung"
              className="bg-input border-border"
            />
            <Input
              value={form.location}
              onChange={e => setForm({ ...form, location: e.target.value })}
              placeholder="Ort"
              className="bg-input border-border"
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Start *
                </label>
                <input
                  type="datetime-local"
                  value={form.startDateTime}
                  onChange={e =>
                    setForm({ ...form, startDateTime: e.target.value })
                  }
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Ende *
                </label>
                <input
                  type="datetime-local"
                  value={form.endDateTime}
                  onChange={e =>
                    setForm({ ...form, endDateTime: e.target.value })
                  }
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                onClick={saveEvent}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="flex-1 bg-primary text-primary-foreground font-jarvis tracking-wider"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Speichern..."
                  : "SPEICHERN"}
              </Button>
              {editingEvent && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (confirm("Termin löschen?")) {
                      deleteMutation.mutate({
                        calendarId: selectedCalendar,
                        eventId: editingEvent.id,
                      });
                      setShowEventModal(false);
                    }
                  }}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 size={16} />
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
