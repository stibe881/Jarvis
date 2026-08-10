import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plug,
  Plus,
  Trash2,
  Copy,
  Loader2,
  Bell,
  KeyRound,
  Music,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Smartphone,
  Link2,
  Unlink,
  RefreshCw,
} from "lucide-react";
import { useState, useEffect } from "react";

export default function JarvisIntegrations() {
  const utils = trpc.useUtils();
  const { data: keys, isLoading } = trpc.webhooks.listKeys.useQuery();
  const { data: events } = trpc.webhooks.listEvents.useQuery({ limit: 30 });
  const { data: spotifyStatus } = trpc.spotify.status.useQuery();
  const { data: nowPlaying, refetch: refetchNowPlaying } =
    trpc.spotify.nowPlaying.useQuery(undefined, {
      enabled: !!spotifyStatus?.connected,
      refetchInterval: 15000,
    });
  const { data: authUrl } = trpc.spotify.getAuthUrl.useQuery(undefined, {
    enabled: !!spotifyStatus?.configured && !spotifyStatus?.connected,
    retry: false,
  });
  const { data: deviceCmds } = trpc.device.list.useQuery();

  const control = trpc.spotify.control.useMutation({
    onSuccess: r => {
      toast.success(r.message.replace(/\*\*/g, ""));
      refetchNowPlaying();
    },
    onError: e => toast.error(e.message),
  });
  const disconnectSpotify = trpc.spotify.disconnect.useMutation({
    onSuccess: () => {
      toast.success("Spotify getrennt");
      utils.spotify.status.invalidate();
    },
  });
  const deleteCmd = trpc.device.delete.useMutation({
    onSuccess: () => {
      utils.device.list.invalidate();
    },
  });

  const createKey = trpc.webhooks.createKey.useMutation({
    onSuccess: r => {
      setNewKey(r.apiKey);
      setLabel("");
      utils.webhooks.listKeys.invalidate();
      toast.success("Schlüssel erstellt");
    },
    onError: e => toast.error(e.message),
  });
  const removeKey = trpc.webhooks.removeKey.useMutation({
    onSuccess: () => {
      toast.success("Schlüssel gelöscht");
      utils.webhooks.listKeys.invalidate();
    },
  });

  const [label, setLabel] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Rückmeldung nach dem Spotify-OAuth-Redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("spotify") === "connected") {
      toast.success("Spotify verbunden");
      utils.spotify.status.invalidate();
      window.history.replaceState({}, "", "/integrations");
    }
    const err = params.get("spotify_error");
    if (err) {
      toast.error(`Spotify-Fehler: ${err}`);
      window.history.replaceState({}, "", "/integrations");
    }
  }, [utils]);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const endpoint = `${baseUrl}/api/webhook/jarvis`;
  const deviceEndpoint = `${baseUrl}/api/device/commands`;

  const curlExample = `curl -X POST "${endpoint}" \\
  -H "Content-Type: application/json" \\
  -H "X-Jarvis-Key: DEIN_SCHLUESSEL" \\
  -d '{"title":"Neues Ticket","body":"Kunde Muster AG: Drucker druckt nicht","source":"Gross ICT App"}'`;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
      <div>
        <h1 className="font-jarvis text-2xl font-bold text-primary jarvis-glow-text">
          VERBINDUNGEN
        </h1>
        <p className="text-sm text-muted-foreground">
          Spotify, iPhone-Kurzbefehle und externe Dienste mit Jarvis verbinden
        </p>
      </div>

      {/* ── Spotify ── */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-primary">
            <Music size={16} />
            <h2 className="text-sm font-jarvis tracking-wide">SPOTIFY</h2>
          </div>
          {spotifyStatus?.connected ? (
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-[10px] border-green-500/40 text-green-400"
              >
                {spotifyStatus.displayName ?? "verbunden"}
              </Badge>
              {spotifyStatus.isPremium === false && (
                <Badge
                  variant="outline"
                  className="text-[10px] border-amber-500/40 text-amber-400"
                >
                  kein Premium
                </Badge>
              )}
            </div>
          ) : (
            <Badge variant="outline" className="text-[10px]">
              nicht verbunden
            </Badge>
          )}
        </div>

        {!spotifyStatus?.connected && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Verbinde dein Spotify-Konto, damit Jarvis auf Zuruf Musik
              abspielen kann („Spiele Coldplay", „Nächster Song", „Lautstärke
              auf 30").
            </p>
            <Button
              className="gap-1.5"
              disabled={!authUrl?.url}
              onClick={() => {
                if (authUrl?.url) window.location.href = authUrl.url;
              }}
            >
              <Link2 size={14} /> Spotify verbinden
            </Button>
          </div>
        )}

        {spotifyStatus?.connected && (
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-muted/20 p-3">
              {nowPlaying && "playing" in nowPlaying && nowPlaying.title ? (
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {nowPlaying.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {nowPlaying.artist}
                  </p>
                  <p className="text-[10px] text-primary mt-1">
                    {nowPlaying.playing ? "läuft" : "pausiert"}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Momentan läuft nichts.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => control.mutate({ action: "previous" })}
              >
                <SkipBack size={14} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => control.mutate({ action: "play" })}
              >
                <Play size={14} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => control.mutate({ action: "pause" })}
              >
                <Pause size={14} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => control.mutate({ action: "next" })}
              >
                <SkipForward size={14} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => control.mutate({ action: "devices" })}
              >
                Geräte
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => refetchNowPlaying()}
              >
                <RefreshCw size={13} />
              </Button>
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Song, Album oder Playlist abspielen…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && searchQuery.trim()) {
                    control.mutate({
                      action: "play",
                      query: searchQuery.trim(),
                      type: "track",
                    });
                    setSearchQuery("");
                  }
                }}
              />
              <Button
                size="sm"
                disabled={!searchQuery.trim() || control.isPending}
                onClick={() => {
                  control.mutate({
                    action: "play",
                    query: searchQuery.trim(),
                    type: "track",
                  });
                  setSearchQuery("");
                }}
              >
                {control.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Play size={14} />
                )}
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground"
              onClick={() => disconnectSpotify.mutate()}
            >
              <Unlink size={13} /> Verbindung trennen
            </Button>
          </div>
        )}
      </Card>

      {/* ── iPhone-Kurzbefehle ── */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-primary">
          <Smartphone size={16} />
          <h2 className="text-sm font-jarvis tracking-wide">
            IPHONE (KURZBEFEHLE)
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Jarvis legt Befehle wie WhatsApp-Nachrichten, Wecker oder Timer in
          eine Warteschlange. Ein Kurzbefehl auf dem iPhone holt sie ab und
          führt sie aus.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => {
            window.location.href = "/shortcuts";
          }}
        >
          <Smartphone size={13} /> Schritt-für-Schritt-Anleitung öffnen
        </Button>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Abruf-URL (GET, mit API-Schlüssel)
          </p>
          <div className="flex gap-2">
            <Input
              readOnly
              value={`${deviceEndpoint}?key=DEIN_SCHLUESSEL`}
              className="font-mono text-xs"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                navigator.clipboard.writeText(
                  `${deviceEndpoint}?key=DEIN_SCHLUESSEL`
                );
                toast.success("Kopiert");
              }}
            >
              <Copy size={14} />
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Warteschlange</p>
          {(deviceCmds ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">Noch keine Befehle.</p>
          )}
          {(deviceCmds ?? []).slice(0, 10).map(c => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border p-2.5"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">
                  {c.summary ?? c.type}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(c.createdAt).toLocaleString("de-CH", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge
                  variant="outline"
                  className={
                    c.status === "pending"
                      ? "text-[10px] border-amber-500/40 text-amber-400"
                      : c.status === "done"
                        ? "text-[10px] border-green-500/40 text-green-400"
                        : "text-[10px]"
                  }
                >
                  {c.status === "pending"
                    ? "wartet"
                    : c.status === "delivered"
                      ? "abgeholt"
                      : c.status === "done"
                        ? "erledigt"
                        : "fehlgeschlagen"}
                </Badge>
                <button
                  onClick={() => deleteCmd.mutate({ id: c.id })}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-primary">
          <Plug size={16} />
          <h2 className="text-sm font-jarvis tracking-wide">SCHNITTSTELLE</h2>
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Endpoint (POST)</p>
          <div className="flex gap-2">
            <Input readOnly value={endpoint} className="font-mono text-xs" />
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                navigator.clipboard.writeText(endpoint);
                toast.success("Kopiert");
              }}
            >
              <Copy size={14} />
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Beispiel</p>
          <pre className="rounded-md border border-border bg-muted/30 p-3 text-[10px] overflow-x-auto whitespace-pre">
            {curlExample}
          </pre>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => {
              navigator.clipboard.writeText(curlExample);
              toast.success("Kopiert");
            }}
          >
            <Copy size={13} /> Beispiel kopieren
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Felder: <span className="font-mono">title</span> (Pflicht),{" "}
          <span className="font-mono">body</span>,{" "}
          <span className="font-mono">source</span>,
          <span className="font-mono"> notify</span> (Standard true – sendet dir
          eine Push-Benachrichtigung).
        </p>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-primary">
          <KeyRound size={16} />
          <h2 className="text-sm font-jarvis tracking-wide">API-SCHLÜSSEL</h2>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Bezeichnung, z.B. Gross ICT App"
            value={label}
            onChange={e => setLabel(e.target.value)}
          />
          <Button
            onClick={() => createKey.mutate({ label })}
            disabled={!label.trim() || createKey.isPending}
            className="gap-1.5"
          >
            {createKey.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Plus size={14} />
            )}{" "}
            Erstellen
          </Button>
        </div>

        {newKey && (
          <div className="rounded-md border border-primary/40 bg-primary/10 p-3 space-y-2">
            <p className="text-xs text-primary">
              Neuer Schlüssel – jetzt kopieren, er wird nur hier vollständig
              angezeigt:
            </p>
            <div className="flex gap-2">
              <Input readOnly value={newKey} className="font-mono text-xs" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(newKey);
                  toast.success("Kopiert");
                }}
              >
                <Copy size={14} />
              </Button>
            </div>
          </div>
        )}

        {isLoading && (
          <p className="text-sm text-muted-foreground">Lade Schlüssel…</p>
        )}

        <div className="space-y-2">
          {(keys ?? []).map(k => (
            <div
              key={k.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{k.label}</p>
                <p className="text-xs text-muted-foreground font-mono truncate">
                  {k.apiKey.slice(0, 10)}…{k.apiKey.slice(-4)}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant="outline" className="text-[10px]">
                  {k.callCount}× genutzt
                </Badge>
                <button
                  onClick={() => removeKey.mutate({ id: k.id })}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {!isLoading && (keys ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">
              Noch kein Schlüssel erstellt.
            </p>
          )}
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-primary">
          <Bell size={16} />
          <h2 className="text-sm font-jarvis tracking-wide">
            LETZTE EREIGNISSE
          </h2>
        </div>
        {(events ?? []).length === 0 && (
          <p className="text-xs text-muted-foreground">
            Noch keine Ereignisse empfangen.
          </p>
        )}
        <div className="space-y-2">
          {(events ?? []).map(ev => (
            <div
              key={ev.id}
              className="rounded-md border border-border p-3 space-y-1"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{ev.title}</span>
                <Badge variant="outline" className="text-[10px]">
                  {ev.source}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(ev.createdAt).toLocaleString("de-CH", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              {ev.body && (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                  {ev.body}
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
