import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  BALL_COLORS,
  JACK_COLORS,
  detectScene,
  scoreRound,
  type BallColorKey,
  type DetectionResult,
  type JackColorKey,
  type PlayerScore,
  type Point,
} from "@/lib/bocciaVision";
import {
  Camera,
  CameraOff,
  Crosshair,
  ImagePlus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  Trash2,
  Trophy,
  Video,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

interface Player {
  id: string;
  name: string;
  color: BallColorKey;
}

interface Setup {
  players: Player[];
  jackColor: JackColorKey;
  ballsPerPlayer: number;
}

const STORAGE_KEY = "jarvis-boccia-setup";
/** Breite des verkleinerten Analyse-Bildes (Performance vs. Genauigkeit) */
const PROC_WIDTH = 192;
/** Analyse-Intervall in Millisekunden */
const DETECT_INTERVAL = 350;

function loadSetup(): Setup {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Setup;
      if (Array.isArray(parsed.players) && parsed.players.length >= 2) {
        return parsed;
      }
    }
  } catch {
    // defekter Eintrag → Standardwerte verwenden
  }
  return {
    players: [
      { id: "p1", name: "Spieler 1", color: "rot" },
      { id: "p2", name: "Spieler 2", color: "blau" },
    ],
    jackColor: "weiss",
    ballsPerPlayer: 3,
  };
}

export default function JarvisBoccia() {
  const [phase, setPhase] = useState<"setup" | "play">("setup");
  const [setup, setSetup] = useState<Setup>(loadSetup);

  const startGame = () => {
    const colors = setup.players.map(p => p.color);
    if (new Set(colors).size !== colors.length) {
      toast.error("Jeder Spieler braucht eine eigene Farbe");
      return;
    }
    if (setup.players.some(p => !p.name.trim())) {
      toast.error("Bitte allen Spielern einen Namen geben");
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(setup));
    setPhase("play");
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-jarvis text-2xl font-bold text-primary jarvis-glow-text">
            BOCCIA-ZÄHLER
          </h1>
          <p className="text-sm text-muted-foreground">
            Kamera auf das Spielfeld halten – Jarvis zählt die Punkte
          </p>
        </div>
        {phase === "play" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPhase("setup")}
            className="gap-2 flex-shrink-0"
          >
            <Settings2 size={14} />
            Einrichten
          </Button>
        )}
      </div>

      {phase === "setup" ? (
        <SetupView setup={setup} onChange={setSetup} onStart={startGame} />
      ) : (
        <PlayView setup={setup} />
      )}
    </div>
  );
}

// ─────────────────────────── Einrichtung ───────────────────────────

function SetupView({
  setup,
  onChange,
  onStart,
}: {
  setup: Setup;
  onChange: (s: Setup) => void;
  onStart: () => void;
}) {
  const usedColors = new Set(setup.players.map(p => p.color));

  const updatePlayer = (id: string, patch: Partial<Player>) => {
    onChange({
      ...setup,
      players: setup.players.map(p => (p.id === id ? { ...p, ...patch } : p)),
    });
  };

  const addPlayer = () => {
    const free = BALL_COLORS.find(c => !usedColors.has(c.key));
    if (!free) {
      toast.error("Alle Farben sind vergeben");
      return;
    }
    onChange({
      ...setup,
      players: [
        ...setup.players,
        {
          id: `p${Date.now()}`,
          name: `Spieler ${setup.players.length + 1}`,
          color: free.key,
        },
      ],
    });
  };

  const removePlayer = (id: string) => {
    onChange({ ...setup, players: setup.players.filter(p => p.id !== id) });
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <Card className="p-4 space-y-4">
        <h2 className="text-sm font-jarvis tracking-wide text-primary">
          SPIELER & KUGELFARBEN
        </h2>
        {setup.players.map(player => (
          <div key={player.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={player.name}
                onChange={e =>
                  updatePlayer(player.id, { name: e.target.value })
                }
                placeholder="Name"
                className="flex-1"
              />
              {setup.players.length > 2 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removePlayer(player.id)}
                  className="text-muted-foreground hover:text-destructive flex-shrink-0"
                >
                  <Trash2 size={16} />
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {BALL_COLORS.map(color => {
                const takenByOther =
                  usedColors.has(color.key) && player.color !== color.key;
                return (
                  <button
                    key={color.key}
                    onClick={() =>
                      updatePlayer(player.id, { color: color.key })
                    }
                    disabled={takenByOther}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs transition-all",
                      player.color === color.key
                        ? "border-primary bg-primary/15 text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/50",
                      takenByOther && "opacity-30 cursor-not-allowed"
                    )}
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-white/20"
                      style={{ backgroundColor: color.css }}
                    />
                    {color.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {setup.players.length < BALL_COLORS.length && (
          <Button
            variant="outline"
            size="sm"
            onClick={addPlayer}
            className="gap-2"
          >
            <Plus size={14} />
            Spieler hinzufügen
          </Button>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <h2 className="text-sm font-jarvis tracking-wide text-primary">
          ZIELKUGEL & KUGELN PRO SPIELER
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground w-24">Zielkugel:</span>
          {JACK_COLORS.map(color => (
            <button
              key={color.key}
              onClick={() => onChange({ ...setup, jackColor: color.key })}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs transition-all",
                setup.jackColor === color.key
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border text-muted-foreground hover:border-primary/50"
              )}
            >
              <span
                className="w-3 h-3 rounded-full border border-white/20"
                style={{ backgroundColor: color.css }}
              />
              {color.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground w-24">
            Kugeln/Spieler:
          </span>
          {[1, 2, 3, 4, 5, 6].map(n => (
            <button
              key={n}
              onClick={() => onChange({ ...setup, ballsPerPlayer: n })}
              className={cn(
                "w-8 h-8 rounded-md border text-xs transition-all",
                setup.ballsPerPlayer === n
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border text-muted-foreground hover:border-primary/50"
              )}
            >
              {n}
            </button>
          ))}
        </div>
        {usedColors.has(setup.jackColor as BallColorKey) && (
          <p className="text-xs text-amber-400">
            Hinweis: Die Zielkugel hat dieselbe Farbe wie ein Spieler. Jarvis
            wertet dann die kleinste erkannte Kugel dieser Farbe als Zielkugel –
            eine eigene Farbe ist zuverlässiger.
          </p>
        )}
      </Card>

      <Card className="p-4 space-y-2 border-primary/30">
        <h2 className="text-sm font-jarvis tracking-wide text-primary">
          TIPPS FÜR GUTE ERKENNUNG
        </h2>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
          <li>Von schräg oben filmen, damit alle Kugeln sichtbar sind</li>
          <li>Gleichmässiges Licht, keine harten Schatten auf den Kugeln</li>
          <li>
            Wird die Zielkugel nicht gefunden, einfach im Bild antippen – dann
            gilt diese Stelle als Zielkugel
          </li>
          <li>
            Ohne Live-Kamera geht es auch per Foto: „Foto analysieren" nimmt ein
            Bild auf und wertet es aus
          </li>
        </ul>
      </Card>

      <Button
        onClick={onStart}
        className="w-full gap-2 font-jarvis tracking-widest"
      >
        <Camera size={16} />
        KAMERA STARTEN
      </Button>
    </div>
  );
}

// ─────────────────────────── Spielansicht ───────────────────────────

function PlayView({ setup }: { setup: Setup }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const procCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const manualJackRef = useRef<Point | null>(null);
  const photoElRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [frozen, setFrozen] = useState(false);
  /** Objekt-URL eines aufgenommenen Fotos; ersetzt das Livebild als Quelle */
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [manualJack, setManualJack] = useState<Point | null>(null);
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [roundScores, setRoundScores] = useState<PlayerScore[] | null>(null);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [roundsPlayed, setRoundsPlayed] = useState(0);

  manualJackRef.current = manualJack;

  const playerByColor = useMemo(() => {
    const map = new Map<BallColorKey, Player>();
    for (const p of setup.players) map.set(p.color, p);
    return map;
  }, [setup.players]);

  // ── Kamera starten/stoppen ──
  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
          setCameraReady(true);
        }
      } catch {
        if (!cancelled) {
          setCameraError(
            "Live-Kamera nicht verfügbar. Du kannst stattdessen ein Foto vom Spielfeld aufnehmen – es wird genauso ausgewertet."
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // ── Erkennungsschleife (Quelle: Livebild oder aufgenommenes Foto) ──
  useEffect(() => {
    if (!cameraReady && !photoUrl) return;

    const interval = setInterval(() => {
      const overlay = overlayRef.current;
      if (!overlay) return;

      let source: HTMLVideoElement | HTMLImageElement | null;
      let srcW: number;
      let srcH: number;
      if (photoUrl) {
        source = photoElRef.current;
        srcW = source?.naturalWidth ?? 0;
        srcH = source?.naturalHeight ?? 0;
      } else {
        source = videoRef.current;
        srcW = (source as HTMLVideoElement | null)?.videoWidth ?? 0;
        srcH = (source as HTMLVideoElement | null)?.videoHeight ?? 0;
        if (frozen) return;
      }
      if (!source || srcW === 0) return;

      if (!procCanvasRef.current) {
        procCanvasRef.current = document.createElement("canvas");
      }
      const proc = procCanvasRef.current;
      const scale = PROC_WIDTH / srcW;
      proc.width = PROC_WIDTH;
      proc.height = Math.round(srcH * scale);
      const ctx = proc.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(source, 0, 0, proc.width, proc.height);

      const image = ctx.getImageData(0, 0, proc.width, proc.height);
      const result = detectScene(image, {
        ballColors: setup.players.map(p => p.color),
        jackColor: setup.jackColor,
        maxBallsPerColor: setup.ballsPerPlayer,
      });
      setDetection(result);

      const jack = manualJackRef.current ?? result.jack;
      if (jack) {
        setRoundScores(
          scoreRound(
            jack,
            setup.players.map(p => ({
              playerId: p.id,
              balls: (result.balls[p.color] ?? []).map(b => ({
                x: b.x,
                y: b.y,
              })),
            }))
          )
        );
      } else {
        setRoundScores(null);
      }

      drawOverlay(overlay, srcW, srcH, result, jack, playerByColor, setup);
    }, DETECT_INTERVAL);

    return () => clearInterval(interval);
  }, [cameraReady, frozen, setup, playerByColor, photoUrl]);

  // ── Zielkugel manuell antippen ──
  const handleTap = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const overlay = overlayRef.current;
      const srcW = photoUrl
        ? (photoElRef.current?.naturalWidth ?? 0)
        : (videoRef.current?.videoWidth ?? 0);
      const srcH = photoUrl
        ? (photoElRef.current?.naturalHeight ?? 0)
        : (videoRef.current?.videoHeight ?? 0);
      if (!overlay || srcW === 0) return;
      const rect = overlay.getBoundingClientRect();
      const scale = PROC_WIDTH / srcW;
      setManualJack({
        x: ((e.clientX - rect.left) / rect.width) * srcW * scale,
        y: ((e.clientY - rect.top) / rect.height) * srcH * scale,
      });
      toast.success("Zielkugel manuell gesetzt");
    },
    [photoUrl]
  );

  const toggleFreeze = () => {
    const video = videoRef.current;
    if (!video) return;
    if (frozen) {
      video.play();
    } else {
      video.pause();
    }
    setFrozen(!frozen);
  };

  // ── Foto aufnehmen/auswählen: öffnet auf dem Handy direkt die Kamera ──
  const onPhotoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPhotoUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    setManualJack(null);
    // gleiche Datei soll erneut wählbar sein
    e.target.value = "";
  };

  const backToLive = () => {
    setPhotoUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setManualJack(null);
  };

  const commitRound = () => {
    if (!roundScores) return;
    const winner = roundScores.find(s => s.points > 0);
    setTotals(prev => {
      const next = { ...prev };
      for (const s of roundScores) {
        next[s.playerId] = (next[s.playerId] ?? 0) + s.points;
      }
      return next;
    });
    setRoundsPlayed(n => n + 1);
    setManualJack(null);
    const name = winner
      ? setup.players.find(p => p.id === winner.playerId)?.name
      : null;
    toast.success(
      name
        ? `Runde gewertet: ${winner!.points} Punkt${winner!.points === 1 ? "" : "e"} für ${name}`
        : "Runde gewertet"
    );
  };

  const resetTotals = () => {
    setTotals({});
    setRoundsPlayed(0);
    toast.success("Spielstand zurückgesetzt");
  };

  const leader = roundScores?.find(s => s.points > 0);
  const leaderPlayer = leader
    ? setup.players.find(p => p.id === leader.playerId)
    : null;
  const jackVisible = manualJack !== null || detection?.jack != null;

  return (
    <div className="space-y-4">
      {/* ── Kamerabild/Foto mit Overlay ── */}
      <Card className="p-0 overflow-hidden relative bg-black">
        {photoUrl ? (
          <div className="relative">
            <img
              ref={photoElRef}
              src={photoUrl}
              alt="Aufgenommenes Spielfeld"
              className="w-full block"
            />
            <canvas
              ref={overlayRef}
              onClick={handleTap}
              className="absolute inset-0 w-full h-full cursor-crosshair"
            />
            {!jackVisible && (
              <div className="absolute bottom-2 left-2 right-2 flex justify-center pointer-events-none">
                <Badge variant="secondary" className="gap-1.5">
                  <Crosshair size={12} />
                  Zielkugel nicht erkannt – im Bild antippen
                </Badge>
              </div>
            )}
          </div>
        ) : cameraError ? (
          <div className="aspect-video flex flex-col items-center justify-center gap-4 p-6 text-center">
            <CameraOff size={32} className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground max-w-sm">
              {cameraError}
            </p>
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2"
            >
              <ImagePlus size={14} />
              Foto aufnehmen
            </Button>
          </div>
        ) : (
          <div className="relative">
            <video ref={videoRef} playsInline muted className="w-full block" />
            <canvas
              ref={overlayRef}
              onClick={handleTap}
              className="absolute inset-0 w-full h-full cursor-crosshair"
            />
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-sm text-muted-foreground animate-pulse">
                  Kamera wird gestartet…
                </p>
              </div>
            )}
            {cameraReady && !jackVisible && (
              <div className="absolute bottom-2 left-2 right-2 flex justify-center pointer-events-none">
                <Badge variant="secondary" className="gap-1.5">
                  <Crosshair size={12} />
                  Zielkugel nicht erkannt – im Bild antippen
                </Badge>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ── Steuerleiste ── */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onPhotoSelected}
        className="hidden"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="gap-2"
        >
          <ImagePlus size={14} />
          {photoUrl ? "Neues Foto" : "Foto analysieren"}
        </Button>
        {photoUrl && !cameraError && (
          <Button
            variant="outline"
            size="sm"
            onClick={backToLive}
            className="gap-2"
          >
            <Video size={14} />
            Live-Kamera
          </Button>
        )}
        {!photoUrl && !cameraError && (
          <Button
            variant="outline"
            size="sm"
            onClick={toggleFreeze}
            disabled={!cameraReady}
            className="gap-2"
          >
            {frozen ? <Play size={14} /> : <Pause size={14} />}
            {frozen ? "Weiter" : "Standbild"}
          </Button>
        )}
        {manualJack && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setManualJack(null)}
            className="gap-2"
          >
            <Crosshair size={14} />
            Manuelle Zielkugel entfernen
          </Button>
        )}
        <Button
          size="sm"
          onClick={commitRound}
          disabled={!leader}
          className="gap-2 ml-auto"
        >
          <Trophy size={14} />
          Runde übernehmen
        </Button>
      </div>

      {/* ── Aktuelle Runde ── */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-jarvis tracking-wide text-primary">
            AKTUELLE RUNDE
          </h2>
          {leaderPlayer && leader && (
            <Badge className="gap-1.5">
              <Trophy size={12} />
              {leaderPlayer.name}: {leader.points} Punkt
              {leader.points === 1 ? "" : "e"}
            </Badge>
          )}
        </div>
        {roundScores ? (
          <div className="space-y-2">
            {setup.players.map(player => {
              const score = roundScores.find(s => s.playerId === player.id);
              const colorDef = BALL_COLORS.find(c => c.key === player.color)!;
              const ballCount = detection?.balls[player.color]?.length ?? 0;
              return (
                <div
                  key={player.id}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md border",
                    score && score.points > 0
                      ? "border-primary/50 bg-primary/10"
                      : "border-border"
                  )}
                >
                  <span
                    className="w-4 h-4 rounded-full border border-white/20 flex-shrink-0"
                    style={{ backgroundColor: colorDef.css }}
                  />
                  <span className="text-sm font-medium flex-1 truncate">
                    {player.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {ballCount} Kugel{ballCount === 1 ? "" : "n"} erkannt
                  </span>
                  <span className="text-lg font-jarvis text-primary w-8 text-right">
                    {score?.points ?? 0}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {photoUrl
              ? "Zielkugel nicht gefunden – tippe sie im Foto an."
              : cameraError
                ? "Nimm ein Foto vom Spielfeld auf, um die Punkte zu zählen."
                : cameraReady
                  ? "Warte auf Zielkugel… Kamera auf das Spielfeld richten oder Zielkugel im Bild antippen."
                  : "Kamera wird gestartet…"}
          </p>
        )}
      </Card>

      {/* ── Gesamtstand ── */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-jarvis tracking-wide text-primary">
            GESAMTSTAND
            {roundsPlayed > 0 && (
              <span className="text-muted-foreground font-sans normal-case tracking-normal">
                {" "}
                · {roundsPlayed} Runde{roundsPlayed === 1 ? "" : "n"}
              </span>
            )}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetTotals}
            className="gap-2 text-muted-foreground"
          >
            <RotateCcw size={14} />
            Zurücksetzen
          </Button>
        </div>
        <div className="space-y-2">
          {[...setup.players]
            .sort((a, b) => (totals[b.id] ?? 0) - (totals[a.id] ?? 0))
            .map(player => {
              const colorDef = BALL_COLORS.find(c => c.key === player.color)!;
              return (
                <div key={player.id} className="flex items-center gap-3">
                  <span
                    className="w-4 h-4 rounded-full border border-white/20 flex-shrink-0"
                    style={{ backgroundColor: colorDef.css }}
                  />
                  <span className="text-sm flex-1 truncate">{player.name}</span>
                  <span className="text-xl font-jarvis text-primary">
                    {totals[player.id] ?? 0}
                  </span>
                </div>
              );
            })}
        </div>
      </Card>
    </div>
  );
}

/** Erkannte Kugeln und Zielkugel als Markierungen über Video oder Foto zeichnen */
function drawOverlay(
  overlay: HTMLCanvasElement,
  srcW: number,
  srcH: number,
  detection: DetectionResult,
  jack: Point | null,
  playerByColor: Map<BallColorKey, Player>,
  setup: Setup
) {
  overlay.width = srcW;
  overlay.height = srcH;
  const ctx = overlay.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, overlay.width, overlay.height);

  // Analyse lief auf PROC_WIDTH – Markierungen aufs volle Bild hochskalieren
  const scale = srcW / PROC_WIDTH;
  const lineWidth = Math.max(2, srcW / 400);
  ctx.lineWidth = lineWidth;
  ctx.font = `${Math.max(12, srcW / 55)}px sans-serif`;

  for (const [colorKey, blobs] of Object.entries(detection.balls)) {
    const def = BALL_COLORS.find(c => c.key === colorKey);
    const player = playerByColor.get(colorKey as BallColorKey);
    if (!def || !blobs) continue;
    for (const blob of blobs) {
      const r = (Math.max(blob.width, blob.height) / 2 + 2) * scale;
      ctx.strokeStyle = def.css;
      ctx.beginPath();
      ctx.arc(blob.x * scale, blob.y * scale, r, 0, Math.PI * 2);
      ctx.stroke();
      if (player) {
        ctx.fillStyle = def.css;
        ctx.fillText(
          player.name,
          blob.x * scale - r,
          blob.y * scale - r - lineWidth * 2
        );
      }
    }
  }

  if (jack) {
    const jackCss =
      JACK_COLORS.find(c => c.key === setup.jackColor)?.css ?? "#ffffff";
    const x = jack.x * scale;
    const y = jack.y * scale;
    const r = 10 * scale * 0.5;
    ctx.strokeStyle = jackCss;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    // Fadenkreuz für die Zielkugel
    ctx.beginPath();
    ctx.moveTo(x - r * 1.6, y);
    ctx.lineTo(x + r * 1.6, y);
    ctx.moveTo(x, y - r * 1.6);
    ctx.lineTo(x, y + r * 1.6);
    ctx.stroke();
  }
}
