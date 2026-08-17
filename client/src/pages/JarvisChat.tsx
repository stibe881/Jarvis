import { trpc } from "@/lib/trpc";
import { MapView } from "@/components/Map";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import {
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Plus,
  Trash2,
  Paperclip,
  Globe,
  X,
  FileText,
  Loader2,
  ChevronLeft,
  MessageSquare,
  Wrench,
  ChevronDown,
  CheckSquare,
  Folder,
  FolderPlus,
  FolderOpen,
} from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { detectWakeWord } from "@shared/wakeWord";
import { cn } from "@/lib/utils";
import { JarvisOrb } from "@/components/JarvisLayout";
import { removeInternalTags, buildSpokenSummary } from "@shared/cleanText";

type Message = {
  id?: number;
  role: "user" | "assistant" | "system";
  content: string;
  fileUrl?: string | null;
  fileName?: string | null;
  createdAt?: Date;
};

// Web Speech API – any-basiert für maximale Browser-Kompatibilität
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionInstance = any;

export default function JarvisChat() {
  return <JarvisChatInner />;
}

/** Marker, mit dem der Server das Protokoll der ausgeführten Schritte anhängt. */
const STEP_LOG_MARKER = "⟦schritte⟧ ";

/**
 * Antwort von Jarvis darstellen. Hat Jarvis Werkzeuge benutzt, wird das
 * Protokoll der Schritte separat und einklappbar unter der Antwort gezeigt.
 */
function AssistantMessage({ content }: { content: string }) {
  const [open, setOpen] = useState(false);
  const idx = content.indexOf(STEP_LOG_MARKER);
  // Interne Kategorie-Markierungen ausblenden – sie sind technische Hinweise
  // aus dem Gedächtnis-Kontext und gehören nicht in die Antwort.
  const roh = idx >= 0 ? content.slice(0, idx).trim() : content;

  // Bereinige den Text für die Anzeige (entferne den rohen XML-Block, da wir die Karte separiert rendern)
  const displayText = roh
    .replace(/<maps_action>[\s\S]*?<\/maps_action>/gi, "")
    .trim();

  let mapLocation: string | null = null;
  let mapOrigin: string | null = null;
  let mapDestination: string | null = null;
  const mapsMatch = roh.match(/<maps_action>([\s\S]*?)<\/maps_action>/i);
  if (mapsMatch) {
    try {
      const payload = JSON.parse(mapsMatch[1]);
      mapLocation = payload.location || null;
      mapOrigin = payload.origin || null;
      mapDestination = payload.destination || null;
    } catch (e) {}
  }

  const text = removeInternalTags(displayText);
  const steps =
    idx >= 0
      ? content
          .slice(idx + STEP_LOG_MARKER.length)
          .split(" | ")
          .map(s => s.trim())
          .filter(Boolean)
      : [];

  return (
    <>
      <Streamdown className="prose prose-sm md:prose-base dark:prose-invert max-w-none text-foreground/90 whitespace-pre-wrap leading-relaxed marker:text-foreground/70">
        {text}
      </Streamdown>
      {(mapLocation || (mapOrigin && mapDestination)) && (
        <div className="mt-3 rounded-xl overflow-hidden border border-border">
          <MapView
            address={mapLocation || undefined}
            origin={mapOrigin || undefined}
            destination={mapDestination || undefined}
            className="h-64"
          />
        </div>
      )}
      {steps.length > 0 && (
        <div className="mt-3 border-t border-border/60 pt-2">
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-primary"
          >
            <Wrench size={11} />
            {steps.length} {steps.length === 1 ? "Schritt" : "Schritte"}{" "}
            ausgeführt
            <ChevronDown
              size={11}
              className={cn(
                "transition-transform duration-200",
                open && "rotate-180"
              )}
            />
          </button>
          {open && (
            <ul className="mt-1.5 space-y-1">
              {steps.map((s, i) => (
                <li
                  key={i}
                  className="flex gap-2 text-[11px] text-muted-foreground"
                >
                  <span className="text-primary/60">{i + 1}.</span>
                  <span className="font-mono">{s}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

function JarvisChatInner() {
  const { data: profile } = trpc.profile.get.useQuery();
  // Sprachmodus im Profil speichern, damit er auf allen Geräten gilt
  const saveSpeechMode = trpc.profile.update.useMutation();
  const { user } = useAuth();
  // Widget-Modus (?widget=1): kompakte Ansicht ohne Gesprächsliste
  const [isWidget] = useState(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("widget") === "1"
  );
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const ttsEnabledRef = useRef(true);
  // Zeichen-Budget der Sprachausgabe (ElevenLabs Free-Plan: 10'000 Zeichen/Monat)
  const [ttsUsage, setTtsUsage] = useState<{
    charsUsed: number;
    limit: number;
    remaining: number;
    percentUsed: number;
    level: string;
  } | null>(null);
  const [ttsResetAt, setTtsResetAt] = useState<number | null>(null);
  const ttsUnlockedRef = useRef(false); // iOS: speechSynthesis muss einmal per User-Gesture entsperrt werden
  const [ttsUnlocked, setTtsUnlocked] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<
    Array<{
      url: string;
      key: string;
      name: string;
      mime: string;
    }>
  >([]);
  const [isUploading, setIsUploading] = useState(false);
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [showConvSidebar, setShowConvSidebar] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false); // synchroner Guard für startListening
  const [autoListen, setAutoListen] = useState(false); // kontinuierlicher Zuhör-Modus
  const autoListenRef = useRef(false); // synchron für Callbacks
  // Wake-Word-Modus: Jarvis lauscht dauerhaft und reagiert erst auf "Hey Jarvis"
  const [wakeWordMode, setWakeWordMode] = useState(false);
  const wakeWordModeRef = useRef(false);
  const [wakeArmed, setWakeArmed] = useState(false); // true = Aktivierungswort erkannt, nächster Satz geht an Jarvis
  const wakeArmedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const voicesLoadedRef = useRef(false);

  const startListeningRef = useRef<(() => void) | null>(null); // Ref für Circular-Dep-Vermeidung
  // Synchrone Sperre: State-Updates greifen zu spät für schnelle Folgeaufrufe
  const isBusyRef = useRef(false);
  // Text, der während einer laufenden Antwort erkannt wurde und danach gesendet wird
  const queuedTextRef = useRef<string | null>(null);
  // Läuft ein Wort-für-Wort-Einblenden? Wird abgebrochen, wenn eine neue Anfrage kommt
  const streamRunIdRef = useRef(0);
  // Nach dem Sprechen wieder zuhören – aber erst wenn die Antwort fertig ist
  const wantAutoListenRef = useRef(false);
  const [autoListenTick, setAutoListenTick] = useState(0);
  // Wächter: startet die Erkennung nicht innerhalb weniger Sekunden, wird der
  // Zustand zurückgesetzt, damit der Mikrofon-Knopf nie blockiert bleibt.
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref auf createAndStartRecognition, damit ein Neustart aus der Funktion
  // selbst möglich ist, ohne eine Abhängigkeitsschleife zu erzeugen.
  const createAndStartRecognitionRef = useRef<(() => void) | null>(null);

  // ── ElevenLabs ────────────────────────────────────────────────────────────
  const elTtsMutation = trpc.elevenlabs.tts.useMutation();
  const elSttMutation = trpc.elevenlabs.stt.useMutation();
  const elAudioRef = useRef<HTMLAudioElement | null>(null);
  // Wiederverwendetes Audio-Element: einmal per Klick freigegeben, danach darf
  // der Browser es auch ohne direkte Nutzeraktion abspielen. Ohne diesen Trick
  // blockiert die Autoplay-Sperre die Sprachausgabe bei Spracheingabe.
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef(false);
  // WebAudio-Kontext: zuverlässigste Methode, die Tonausgabe auf iOS/Safari
  // per Nutzeraktion freizuschalten (ein kurzer stiller Puffer genügt).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const audioCtxRef = useRef<any>(null);

  /** Liefert das dauerhaft genutzte Audio-Element (wird nur einmal erzeugt). */
  const getAudioEl = useCallback(() => {
    if (!audioElRef.current) {
      const el = new Audio();
      el.preload = "auto";
      // Feste Grundlautstärke: verhindert, dass einzelne Antworten
      // spürbar lauter oder leiser kommen als andere.
      el.volume = 1;
      // Nötig, damit das Element über WebAudio geleitet werden darf
      el.crossOrigin = "anonymous";
      audioElRef.current = el;
    }
    return audioElRef.current;
  }, []);

  /**
   * Gemeinsame Lautstärke-Kette für alle Wiedergabewege.
   *
   * ElevenLabs liefert je nach Text unterschiedlich laute Aufnahmen. Ohne
   * Ausgleich klingt jede Antwort anders laut. Ein Kompressor dämpft laute
   * Stellen, ein fester Verstärker hebt das Ergebnis wieder an – damit ist
   * die wahrgenommene Lautstärke über alle Antworten hinweg gleich.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const audioChainRef = useRef<{ input: any; ctx: any } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mediaSourceRef = useRef<any>(null);

  /** Erzeugt (einmalig) den Audio-Kontext. */
  const getAudioCtx = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const Ctx = w.AudioContext || w.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
    return audioCtxRef.current;
  }, []);

  /**
   * Liefert den Eingang der Lautstärke-Kette. Alles, was hier hineingeht,
   * klingt gleich laut.
   */
  const getAudioChain = useCallback(() => {
    const ctx = getAudioCtx();
    if (!ctx) return null;
    if (audioChainRef.current?.ctx === ctx) return audioChainRef.current;

    // Kompressor: dämpft Spitzen, damit leise und laute Aufnahmen sich annähern
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 12;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    // Verstärker: hebt das komprimierte Signal auf ein einheitliches Niveau
    const gain = ctx.createGain();
    gain.value = 1;
    gain.gain.value = 1.6;

    compressor.connect(gain);
    gain.connect(ctx.destination);

    audioChainRef.current = { input: compressor, ctx };
    return audioChainRef.current;
  }, [getAudioCtx]);

  /**
   * Verbindet das Audio-Element mit der Lautstärke-Kette. Das darf pro
   * Element nur einmal passieren, deshalb wird die Quelle gemerkt.
   */
  const attachElementToChain = useCallback(() => {
    const ctx = getAudioCtx();
    const chain = getAudioChain();
    if (!ctx || !chain) return;
    if (mediaSourceRef.current) return;
    try {
      const el = getAudioEl();
      const source = ctx.createMediaElementSource(el);
      source.connect(chain.input);
      mediaSourceRef.current = source;
    } catch (e) {
      // Manche Browser erlauben das nicht – dann bleibt es beim direkten Ton
      console.warn("[Lautstärke-Kette]", e);
    }
  }, [getAudioCtx, getAudioChain, getAudioEl]);

  /**
   * Gibt die Tonausgabe frei. Muss aus einem echten Klick heraus aufgerufen
   * werden – danach funktioniert die Wiedergabe auch bei Sprachbedienung.
   * Liefert true, sobald der Browser die Wiedergabe erlaubt hat.
   */
  const unlockAudio = useCallback(async (): Promise<boolean> => {
    let ok = false;

    // 1) WebAudio freischalten – funktioniert auf iOS zuverlässig
    try {
      const ctx = getAudioCtx();
      if (ctx) {
        if (ctx.state === "suspended") await ctx.resume();
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
        ok = ctx.state === "running";
      }
    } catch (e) {
      console.error("[WebAudio-Freigabe]", e);
    }

    // Lautstärke-Kette gleich beim Freischalten aufbauen, damit die erste
    // Antwort schon gleich laut klingt wie alle folgenden
    try {
      attachElementToChain();
    } catch {
      /* ignorieren */
    }

    // 2) Zusätzlich das Audio-Element „anwärmen" (stumm, ohne echte Quelle),
    //    damit spätere play()-Aufrufe als erlaubt gelten.
    try {
      const el = getAudioEl();
      el.muted = true;
      const p = el.play();
      if (p && typeof p.then === "function") await p.catch(() => undefined);
      try {
        el.pause();
      } catch {
        /* ignorieren */
      }
      el.muted = false;
    } catch {
      /* ignorieren */
    }

    // Ohne WebAudio-Unterstützung gilt die Freigabe trotzdem als erteilt –
    // der eigentliche Beweis ist die erste erfolgreiche Wiedergabe.

    const hasWebAudio = Boolean(
      (window as any).AudioContext || (window as any).webkitAudioContext
    );
    audioUnlockedRef.current = ok || !hasWebAudio;
    return audioUnlockedRef.current;
  }, [getAudioEl, attachElementToChain, getAudioCtx]);

  /**
   * Nach dem Sprechen wieder zuhören – zentral, damit jeder Weg (Erfolg,
   * Fehler, blockierte Wiedergabe) denselben Zustand hinterlässt.
   */
  const resumeListeningAfterSpeech = useCallback(() => {
    if (autoListenRef.current || wakeWordModeRef.current) {
      wantAutoListenRef.current = true;
      setAutoListenTick(t => t + 1);
    }
  }, []);

  /**
   * Spielt Audio über WebAudio ab. Ausweichweg für Browser, die
   * `<audio>.play()` ohne direkte Nutzeraktion ablehnen (v.a. iOS/Safari).
   * Liefert true, wenn die Wiedergabe gestartet wurde.
   */
  const playViaWebAudio = useCallback(
    async (data: ArrayBuffer, onDone: () => void): Promise<boolean> => {
      try {
        const ctx = getAudioCtx();
        if (!ctx) return false;
        if (ctx.state === "suspended") await ctx.resume();
        if (ctx.state !== "running") return false;
        const buffer = await ctx.decodeAudioData(data.slice(0));
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        // Über dieselbe Lautstärke-Kette wie der Hauptweg, damit beide
        // Wege gleich laut klingen
        const chain = getAudioChain();
        if (chain) source.connect(chain.input);
        else source.connect(ctx.destination);
        source.onended = onDone;
        source.start(0);
        audioUnlockedRef.current = true;
        return true;
      } catch (e) {
        console.error("[WebAudio-Wiedergabe]", e);
        return false;
      }
    },
    [getAudioCtx, getAudioChain]
  );

  const playElevenLabsAudio = useCallback(
    (base64: string) => {
      const el = getAudioEl();
      let url: string | null = null;
      const finish = () => {
        setIsSpeaking(false);
        if (url) {
          URL.revokeObjectURL(url);
          url = null;
        }
        elAudioRef.current = null;
        resumeListeningAfterSpeech();
      };
      try {
        // Laufende Wiedergabe beenden
        try {
          el.pause();
        } catch {
          /* ignorieren */
        }
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: "audio/mpeg" });
        url = URL.createObjectURL(blob);
        el.src = url;
        el.muted = false;
        el.volume = 1;
        // Auch dieser Weg läuft über die Lautstärke-Kette
        attachElementToChain();
        el.onended = finish;
        el.onerror = finish;
        elAudioRef.current = el;
        setIsSpeaking(true);
        const p = el.play();
        if (p && typeof p.catch === "function") {
          p.then(() => {
            audioUnlockedRef.current = true;
          }).catch((err: unknown) => {
            console.error("[Audio blockiert]", err);
            // Ausweichweg: über WebAudio abspielen. Das funktioniert auf iOS
            // auch dann, wenn <audio>.play() abgelehnt wird.
            void (async () => {
              const played = await playViaWebAudio(
                bytes.buffer as ArrayBuffer,
                finish
              );
              if (played) return;
              // Auch das ging nicht: Zustand zurücksetzen, damit nichts hängt
              finish();
              audioUnlockedRef.current = false;
              ttsUnlockedRef.current = false;
              setTtsUnlocked(false);
              toast.error(
                "Der Browser hat den Ton blockiert. Tippe einmal auf «Sprachausgabe aktivieren».",
                { duration: 6000 }
              );
            })();
          });
        }
      } catch (e) {
        console.error("[ElevenLabs Audio]", e);
        finish();
      }
    },
    [
      getAudioEl,
      resumeListeningAfterSpeech,
      playViaWebAudio,
      attachElementToChain,
    ]
  );

  // Stimmen vorladen
  useEffect(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => {
          voicesLoadedRef.current = true;
        };
      }
    }
  }, []);

  // Sprachausgabe-Modus: bestimmt, wann Jarvis überhaupt spricht.
  // "always"     = bei jeder Antwort
  // "voice-only" = nur wenn die Frage per Sprache kam (Standard, spart Guthaben)
  // "never"      = nie sprechen
  const [speechMode, setSpeechMode] = useState<
    "always" | "voice-only" | "never"
  >("voice-only");
  const speechModeRef = useRef<"always" | "voice-only" | "never">("voice-only");
  useEffect(() => {
    speechModeRef.current = speechMode;
  }, [speechMode]);
  // Quelle einer zurückgestellten Nachricht, damit die Sprachausgabe stimmt
  const queuedSourceRef = useRef<"sprache" | "tippen">("tippen");

  // Verbrauchsabfrage per Ref, da die Abfrage weiter unten deklariert wird.
  const refetchUsageRef = useRef<(() => void) | null>(null);

  // Ausweichweg (tRPC-Mutation) per Ref, damit speakText ihn nutzen kann,
  // ohne dass eine Abhängigkeitsschleife entsteht.
  const speakViaMutationRef = useRef<
    ((clean: string, voiceId: string | undefined) => void) | null
  >(null);

  /**
   * Browser-Stimme als Ersatz, wenn ElevenLabs nicht verfügbar ist (etwa bei
   * aufgebrauchtem Guthaben). Besser eine einfache Stimme als Schweigen.
   */
  const speakViaBrowser = useCallback(
    (clean: string) => {
      if (!("speechSynthesis" in window)) {
        setIsSpeaking(false);
        resumeListeningAfterSpeech();
        return;
      }
      window.speechSynthesis.cancel();
      // Die Browser-Stimme kostet nichts – daher den ganzen Text sprechen
      // Dieselbe Kurzfassung wie bei der ElevenLabs-Stimme, damit beide gleich
      // klingen: sehr lange Texte enden nicht mitten im Satz, sondern mit Hinweis
      // und Schlusssatz. Die Browser-Stimme darf länger sprechen (kostet nichts).
      const gesprochen =
        clean.length <= 4000 ? clean : buildSpokenSummary(clean, 4000);
      const utterance = new SpeechSynthesisUtterance(gesprochen);
      // Tiefe, ruhige Stimme – so nah wie möglich am Jarvis-Klang
      utterance.lang = "de-DE";
      utterance.rate = 0.92;
      utterance.pitch = 0.75;
      // Feste Lautstärke, damit der Ersatzweg nicht lauter oder leiser ist
      utterance.volume = 1;
      const stimmen = window.speechSynthesis.getVoices();
      const bevorzugt =
        stimmen.find(
          v => /stefan|markus|conrad/i.test(v.name) && v.lang.startsWith("de")
        ) ?? stimmen.find(v => v.lang.startsWith("de"));
      if (bevorzugt) utterance.voice = bevorzugt;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        resumeListeningAfterSpeech();
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        resumeListeningAfterSpeech();
      };
      setTimeout(() => window.speechSynthesis.speak(utterance), 0);
    },
    [resumeListeningAfterSpeech]
  );

  // TTS-Funktion
  const speakText = useCallback(
    (text: string) => {
      if (!ttsEnabledRef.current) return;
      // Nur grob vorreinigen – das Server-Modul kürzt satzweise und rechnet das Budget ab
      const clean = text
        // Schritt-Protokoll und interne Kategorie-Markierungen nie mitsprechen
        .replace(/⟦schritte⟧[\s\S]*$/g, " ")
        .replace(/<maps_action>[\s\S]*?<\/maps_action>/gi, " ")
        .replace(
          /\s*\[(?:person|contact|preference|project|fact|context|memory|profil|profile|kalender|calendar)\]/gi,
          ""
        )
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/\n+/g, " ")
        .replace(/\s+([.,;:!?])/g, "$1")
        .trim()
        .slice(0, 2500);
      if (!clean) return;
      const voiceId = profile?.elevenLabsVoiceId ?? undefined;

      // Schnellster Weg: das Audio-Element lädt direkt von der Stream-Adresse.
      // Der Browser beginnt zu spielen, sobald genug Daten da sind – die Datei
      // muss nicht erst vollständig geladen werden. Vorher wurde die komplette
      // MP3 erzeugt, base64-kodiert und übertragen (gemessen rund 4 Sekunden).
      const el = getAudioEl();
      const finish = () => {
        setIsSpeaking(false);
        elAudioRef.current = null;
        resumeListeningAfterSpeech();
      };
      try {
        el.pause();
      } catch {
        /* ignorieren */
      }
      el.onended = finish;
      el.onerror = null;
      el.muted = false;
      el.volume = 1;
      // Über die Lautstärke-Kette leiten, damit jede Antwort gleich laut klingt
      attachElementToChain();
      elAudioRef.current = el;
      setIsSpeaking(true);

      void (async () => {
        try {
          // Zuerst prüfen, ob überhaupt Guthaben vorhanden ist. Sonst würde das
          // Audio-Element eine Fehlerseite laden und Jarvis bliebe still.
          const vorabPruefung = await fetch("/api/tts/stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ text: "x", shorten: true, checkOnly: true }),
          }).catch(() => null);
          if (vorabPruefung && vorabPruefung.status === 429) {
            toast.warning(
              "Sprachausgabe-Guthaben aufgebraucht – Jarvis nutzt vorübergehend die Browser-Stimme."
            );
            refetchUsageRef.current?.();
            speakViaBrowser(clean);
            return;
          }

          // Adresse mit Text als Abfrageparameter: dadurch kann das
          // Audio-Element selbst laden und fortschreitend abspielen.
          const params = new URLSearchParams({ text: clean, shorten: "true" });
          if (voiceId) params.set("voiceId", voiceId);
          const streamUrl = `/api/tts/stream?${params.toString()}`;

          let fehlerBehandelt = false;
          const beiFehler = () => {
            if (fehlerBehandelt) return;
            fehlerBehandelt = true;
            console.warn(
              "[TTS-Stream] Wiedergabe fehlgeschlagen, nutze Browser-Stimme"
            );
            speakViaBrowser(clean);
          };

          el.src = streamUrl;
          el.onended = finish;
          el.onerror = beiFehler;
          await el.play();
          audioUnlockedRef.current = true;
          // Verbrauchsanzeige nachziehen: der Server hat die Zeichen gebucht.
          // Kopfzeilen sind bei `audio.src` nicht lesbar, daher kurz nachfragen.
          setTimeout(() => {
            refetchUsageRef.current?.();
          }, 900);
        } catch (e) {
          console.error("[TTS-Stream]", e);
          // Ausweichweg: Browser-Stimme, damit Jarvis nicht verstummt
          speakViaBrowser(clean);
        }
      })();
    },
    [
      getAudioEl,
      resumeListeningAfterSpeech,
      profile?.elevenLabsVoiceId,
      speakViaBrowser,
      attachElementToChain,
    ]
  );

  /** Ausweichweg über die tRPC-Mutation (langsamer, aber robust). */
  const speakViaMutation = useCallback(
    (clean: string, voiceId: string | undefined) => {
      elTtsMutation.mutate(
        { text: clean, voiceId, shorten: true },
        {
          onSuccess: data => {
            playElevenLabsAudio(data.audio);
            if (data.usage) setTtsUsage(data.usage);
            if (data.usage && data.usage.level === "critical") {
              toast.warning(
                `Sprachausgabe-Budget fast aufgebraucht: ${data.usage.remaining} Zeichen übrig.`
              );
            }
          },
          onError: err => {
            // Budget aufgebraucht: klarer Hinweis statt stiller Fallback
            if (err.message.includes("Budget")) {
              toast.error(
                "Sprachausgabe-Budget für diesen Monat aufgebraucht. Antworten erscheinen weiterhin im Chat."
              );
              resumeListeningAfterSpeech();
              return;
            }
            console.error("[TTS]", err);
            // Fallback: Web Speech API
            if (!("speechSynthesis" in window)) {
              resumeListeningAfterSpeech();
              return;
            }
            window.speechSynthesis.cancel();
            // Die Browser-Stimme kostet nichts – daher den ganzen Text sprechen
            // Dieselbe Kurzfassung wie bei der ElevenLabs-Stimme, damit beide gleich
            // klingen: sehr lange Texte enden nicht mitten im Satz, sondern mit Hinweis
            // und Schlusssatz. Die Browser-Stimme darf länger sprechen (kostet nichts).
            const gesprochen =
              clean.length <= 4000 ? clean : buildSpokenSummary(clean, 4000);
            const utterance = new SpeechSynthesisUtterance(gesprochen);
            utterance.lang = "de-DE";
            utterance.rate = 0.9;
            utterance.pitch = 0.8;
            utterance.volume = 1;
            utterance.onstart = () => setIsSpeaking(true);
            utterance.onend = () => {
              setIsSpeaking(false);
              resumeListeningAfterSpeech();
            };
            utterance.onerror = () => {
              setIsSpeaking(false);
              resumeListeningAfterSpeech();
            };
            setTimeout(() => window.speechSynthesis.speak(utterance), 0);
          },
        }
      );
    },
    [
      elTtsMutation,
      playElevenLabsAudio,
      resumeListeningAfterSpeech,
      profile?.elevenLabsVoiceId,
    ]
  );

  // Ausweichweg per Ref bereitstellen (wird in speakText genutzt)
  useEffect(() => {
    speakViaMutationRef.current = speakViaMutation;
  });

  // TTS einmalig entsperren (per User-Gesture)
  const unlockTts = useCallback(async () => {
    // Wichtigster Teil: das HTML-Audio-Element freigeben, damit ElevenLabs
    // auch bei Sprachbedienung abspielen darf.
    await unlockAudio();
    if ("speechSynthesis" in window) {
      const unlock = new SpeechSynthesisUtterance("");
      window.speechSynthesis.speak(unlock);
      window.speechSynthesis.getVoices();
      voicesLoadedRef.current = true;
    }
    // Freigabe gilt jetzt als erteilt. Der endgültige Beweis ist die erste
    // echte Wiedergabe – schlägt die fehl, erscheint der Hinweis erneut.
    ttsUnlockedRef.current = true;
    ttsEnabledRef.current = true;
    setTtsUnlocked(true);
    setTtsEnabled(true);
    // Kurze Probeansage im Jarvis-Ton (absichtlich knapp, um Guthaben zu sparen)
    speakText("Sehr wohl, Sir. Systeme bereit.");
    // Hinweis, was der gewählte Modus bedeutet
    if (speechModeRef.current === "voice-only") {
      toast.info(
        "Jarvis spricht nur bei Sprachbedienung. Zum Umschalten den Lautsprecher antippen."
      );
    }
  }, [unlockAudio, speakText]);

  const toggleTts = useCallback(() => {
    if (!ttsUnlockedRef.current) {
      unlockTts();
      return;
    }
    // Durchschalten: immer → nur bei Sprachbedienung → nie → immer
    const reihenfolge: Array<"always" | "voice-only" | "never"> = [
      "always",
      "voice-only",
      "never",
    ];
    const next =
      reihenfolge[(reihenfolge.indexOf(speechMode) + 1) % reihenfolge.length];
    setSpeechMode(next);
    speechModeRef.current = next;
    localStorage.setItem("jarvis-speech-mode", next);
    // Zusätzlich im Profil ablegen, damit die Wahl auch am iPhone gilt
    saveSpeechMode.mutate({
      speechMode: next === "voice-only" ? "voiceOnly" : next,
    });

    // "nie" schaltet die Ausgabe komplett ab und stoppt eine laufende Wiedergabe
    const aktiv = next !== "never";
    setTtsEnabled(aktiv);
    ttsEnabledRef.current = aktiv;
    if (!aktiv) {
      window.speechSynthesis?.cancel();
      try {
        audioElRef.current?.pause();
      } catch {
        /* ignorieren */
      }
      elAudioRef.current = null;
      setIsSpeaking(false);
    }

    const texte = {
      always: "Jarvis spricht bei jeder Antwort.",
      "voice-only":
        "Jarvis spricht nur, wenn du ihn per Sprache fragst – das schont das Guthaben.",
      never: "Sprachausgabe aus. Antworten erscheinen nur im Chat.",
    } as const;
    toast.info(texte[next]);
  }, [speechMode, unlockTts, saveSpeechMode]);

  // Modus beim Laden übernehmen. Das Profil hat Vorrang (gilt geräteübergreifend),
  // die lokale Einstellung dient als Rückfall, solange das Profil noch lädt.
  useEffect(() => {
    // Im Profil wird "voiceOnly" geschrieben, im Chat "voice-only"
    const ausProfil = profile?.speechMode
      ? ((profile.speechMode === "voiceOnly"
          ? "voice-only"
          : profile.speechMode) as "always" | "voice-only" | "never")
      : null;
    const lokal = localStorage.getItem("jarvis-speech-mode");
    const modus =
      ausProfil ??
      (lokal === "always" || lokal === "voice-only" || lokal === "never"
        ? lokal
        : null);
    if (!modus) return;
    setSpeechMode(modus);
    speechModeRef.current = modus;
    const aktiv = modus !== "never";
    setTtsEnabled(aktiv);
    ttsEnabledRef.current = aktiv;
  }, [profile?.speechMode]);

  const [manageMode, setManageMode] = useState(false);
  const [selectedConvs, setSelectedConvs] = useState<number[]>([]);

  const utils = trpc.useUtils();
  const { data: conversations } = trpc.chat.listConversations.useQuery();
  const { data: suggestions } = trpc.chat.suggestions.useQuery();
  const { data: groups } = trpc.chat.listGroups.useQuery();
  const createGroupMutation = trpc.chat.createGroup.useMutation({
    onSuccess: () => utils.chat.listGroups.invalidate(),
  });
  const moveToGroupMutation = trpc.chat.moveToGroup.useMutation({
    onSuccess: () => {
      utils.chat.listConversations.invalidate();
      utils.chat.listGroups.invalidate();
      setSelectedConvs([]);
      setManageMode(false);
    },
  });
  const [expandedGroups, setExpandedGroups] = useState<number[]>([]);
  const createConvMutation = trpc.chat.createConversation.useMutation({
    onSuccess: data => {
      utils.chat.listConversations.invalidate();
      if (data?.id) setActiveConvId(data.id);
    },
  });
  const deleteConvMutation = trpc.chat.deleteConversation.useMutation({
    onSuccess: () => utils.chat.listConversations.invalidate(),
  });

  const deleteConvsMutation = trpc.chat.deleteConversations.useMutation({
    onSuccess: () => {
      utils.chat.listConversations.invalidate();
      if (activeConvId && selectedConvs.includes(activeConvId)) {
        setActiveConvId(null);
        setMessages([]);
      }
      setSelectedConvs([]);
      setManageMode(false);
    },
  });

  const uploadMutation = trpc.chat.uploadFile.useMutation();
  const searchMutation = trpc.chat.webSearch.useMutation();
  const sendMessageMutation = trpc.chat.sendMessage.useMutation();

  const { data: dbMessages } = trpc.chat.getMessages.useQuery(
    { conversationId: activeConvId! },
    { enabled: !!activeConvId }
  );

  // Zeichen-Budget der Sprachausgabe laden
  const { data: usageData, refetch: refetchUsage } =
    trpc.elevenlabs.usage.useQuery();
  useEffect(() => {
    refetchUsageRef.current = () => {
      void refetchUsage();
    };
  }, [refetchUsage]);
  useEffect(() => {
    if (usageData) {
      setTtsUsage(usageData);
      setTtsResetAt(usageData.resetAt ?? null);
    }
  }, [usageData]);

  useEffect(() => {
    if (dbMessages && !isBusyRef.current) setMessages(dbMessages as Message[]);
  }, [dbMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 50);
    }
  }, [messages, interimText]);

  // Kern-Funktion: Nachricht senden
  const sendMessageFromText = useCallback(
    async (
      text: string,
      files?: typeof uploadedFiles,
      quelle: "sprache" | "tippen" = "tippen"
    ) => {
      if (!text.trim() && (!files || files.length === 0)) return;
      // Läuft noch eine Antwort? Dann Text merken und nach dem Ende automatisch senden,
      // statt ihn stillschweigend zu verwerfen (das war die Ursache für „nur eine Antwort").
      if (isBusyRef.current) {
        queuedTextRef.current = text.trim();
        queuedSourceRef.current = quelle;
        toast.info(
          "Ich beantworte noch die letzte Frage – deine neue Nachricht folgt gleich."
        );
        return;
      }
      isBusyRef.current = true;

      let convId = activeConvId;
      try {
        if (!convId) {
          const result = await createConvMutation.mutateAsync({});
          convId = result?.id ?? null;
          if (convId) setActiveConvId(convId);
        }
      } catch (e) {
        console.error("[createConversation]", e);
      }
      if (!convId) {
        isBusyRef.current = false;
        toast.error(
          "Gespräch konnte nicht gestartet werden. Bitte erneut versuchen."
        );
        return;
      }

      const userMsg: Message = {
        role: "user",
        content: text,
        fileUrl: files && files.length > 0 ? files[0].url : undefined,
        fileName: files && files.length > 0 ? files[0].name : undefined,
      };
      setMessages(prev => [...prev, userMsg]);
      setIsStreaming(true);
      const assistantMsg: Message = { role: "assistant", content: "" };
      setMessages(prev => [...prev, assistantMsg]);

      // Optionale Web-Suche
      let searchResults: Array<{
        title: string;
        snippet: string;
        url: string;
      }> = [];
      if (searchEnabled && text.trim()) {
        try {
          const sr = await searchMutation.mutateAsync({ query: text });
          searchResults = sr.results;
        } catch {
          /* ignorieren */
        }
      }

      try {
        // Authorization-Header holen (analog zu main.tsx für WebView/Safari)
        let authHeader = "";
        try {
          const raw = sessionStorage.getItem("manus-cookie");
          if (raw) {
            const prefix = `manus-session=`;
            const pair = raw.split(";").find(s => s.trim().startsWith(prefix));
            const token = pair?.trim().slice(prefix.length);
            if (token) authHeader = `Bearer ${token}`;
          }
        } catch {}

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (authHeader) headers["Authorization"] = authHeader;

        // Smart Context: Battery & GPS
        let smartContext:
          | { battery?: string; location?: { lat: number; lng: number } }
          | undefined;
        try {
          const contextObj: any = {};
          // Battery
          if ("getBattery" in navigator) {
            const battery = await (navigator as any).getBattery();
            contextObj.battery = `${Math.round(battery.level * 100)}%${battery.charging ? " (lädt)" : ""}`;
          }
          // GPS (kurzer Timeout)
          if ("geolocation" in navigator) {
            const getPos = () =>
              new Promise<GeolocationPosition>((resolve, reject) => {
                let bestPos: GeolocationPosition | null = null;

                const timeoutId = setTimeout(() => {
                  if (typeof watchId !== "undefined")
                    navigator.geolocation.clearWatch(watchId);
                  if (bestPos) resolve(bestPos);
                  else reject(new Error("Timeout beim Warten auf GPS-Signal"));
                }, 10000);

                const watchId = navigator.geolocation.watchPosition(
                  pos => {
                    // Update best position if accuracy is better
                    if (
                      !bestPos ||
                      pos.coords.accuracy < bestPos.coords.accuracy
                    ) {
                      bestPos = pos;
                    }
                    // If accuracy is good enough (e.g. < 30 meters), we accept it immediately
                    if (pos.coords.accuracy <= 30) {
                      clearTimeout(timeoutId);
                      navigator.geolocation.clearWatch(watchId);
                      resolve(pos);
                    }
                  },
                  err => {
                    if (!bestPos) {
                      clearTimeout(timeoutId);
                      if (typeof watchId !== "undefined")
                        navigator.geolocation.clearWatch(watchId);
                      reject(err);
                    }
                  },
                  {
                    timeout: 10000,
                    maximumAge: 0,
                    enableHighAccuracy: true,
                  }
                );
              });
            try {
              const pos = await getPos();
              contextObj.location = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
              };
            } catch {
              // ignore GPS error or timeout
            }
          }
          if (Object.keys(contextObj).length > 0) smartContext = contextObj;
        } catch (e) {
          console.error("Smart Context error", e);
        }

        const response = await fetch("/api/chat/stream", {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({
            conversationId: convId,
            message: text,
            context: smartContext,
            files: files?.length ? files : undefined,
            searchResults,
          }),
        });

        if (!response.ok) {
          let errMsg = "Unbekannter Fehler aufgetreten";
          try {
            const data = await response.json();
            errMsg = data.error || errMsg;
          } catch {}
          throw new Error(errMsg);
        }
        if (!response.body)
          throw new Error("Stream konnte nicht gelesen werden.");
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let done = false;
        let fullText = "";
        let displayedText = "";

        // Puffer für abgeschnittene Server-Sent Events (SSE)
        let buffer = "";

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split("\n\n");
            // Der letzte Teil ist evtl. unvollständig, also im Puffer lassen
            buffer = parts.pop() || "";

            for (const ev of parts) {
              if (ev.startsWith("event: ")) {
                const lines = ev.split("\n");
                const eventName = lines[0].slice(7);
                const dataLine = lines
                  .find(l => l.startsWith("data: "))
                  ?.slice(6);
                if (dataLine) {
                  try {
                    const data = JSON.parse(dataLine);
                    if (eventName === "text") {
                      fullText += data.chunk;
                      // Verstecke die XML-Befehle und deren JSON-Inhalt live im UI
                      displayedText = fullText.replace(
                        /<(?:[a-z_]+_)?action>[\s\S]*?(?:<\/(?:[a-z_]+_)?action>|$)/gi,
                        ""
                      );
                      setMessages(prev => {
                        const updated = [...prev];
                        if (updated.length > 0) {
                          updated[updated.length - 1] = {
                            ...updated[updated.length - 1],
                            content: displayedText,
                          };
                        }
                        return updated;
                      });
                    } else if (eventName === "done") {
                      fullText = data.response; // Beinhaltet auch das Schritt-Protokoll
                      setMessages(prev => {
                        const updated = [...prev];
                        if (updated.length > 0) {
                          updated[updated.length - 1] = {
                            ...updated[updated.length - 1],
                            content: fullText,
                          };
                        }
                        return updated;
                      });
                    } else if (eventName === "error") {
                      throw new Error(
                        data.message || "Unbekannter Stream-Fehler"
                      );
                    }
                  } catch (e) {
                    console.error("Fehler beim Parsen von SSE", e);
                  }
                }
              }
            }
          }
        }

        utils.chat.listConversations.invalidate();
        // Titel wird vom Backend erst nach dem `done`-Event generiert;
        // deshalb nach 2 Sekunden nochmals laden.
        setTimeout(() => utils.chat.listConversations.invalidate(), 2000);

        const modus = speechModeRef.current;
        const darfSprechen =
          modus === "always" ||
          (modus === "voice-only" && quelle === "sprache");
        if (fullText && darfSprechen) speakText(fullText);
      } catch (err) {
        console.error("[sendMessage] Fehler:", err);
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`Fehler: ${msg.slice(0, 120)}`);
        setMessages(prev => prev.slice(0, -1));
      } finally {
        isBusyRef.current = false;
        setIsStreaming(false);
        utils.chat.getMessages.invalidate({ conversationId: convId });
      }
    },
    [
      activeConvId,
      searchEnabled,
      createConvMutation,
      searchMutation,
      speakText,
      utils,
    ]
  );

  // In der Warteschlange stehende Nachricht senden, sobald die Antwort fertig ist
  useEffect(() => {
    if (isStreaming) return;
    const queued = queuedTextRef.current;
    if (queued) {
      queuedTextRef.current = null;
      const quelle = queuedSourceRef.current;
      const timer = setTimeout(() => {
        sendMessageFromText(queued, undefined, quelle);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isStreaming, sendMessageFromText]);

  // Hands-free: erst wieder zuhören, wenn keine Antwort mehr läuft
  useEffect(() => {
    if (!wantAutoListenRef.current) return;
    if (isStreaming || isSpeaking) return;
    if (!autoListenRef.current && !wakeWordModeRef.current) {
      wantAutoListenRef.current = false;
      return;
    }
    wantAutoListenRef.current = false;
    const timer = setTimeout(() => {
      const wanted = autoListenRef.current || wakeWordModeRef.current;
      if (wanted && !isBusyRef.current && !isListeningRef.current)
        startListeningRef.current?.();
    }, 500);
    return () => clearTimeout(timer);
  }, [autoListenTick, isStreaming, isSpeaking]);

  // Nach jeder abgeschlossenen Antwort im Hands-free-/Wake-Word-Modus erneut
  // zuhören – auch dann, wenn die Sprachausgabe nichts abgespielt hat.
  useEffect(() => {
    if (isStreaming) return;
    if (!autoListenRef.current && !wakeWordModeRef.current) return;
    if (isSpeaking || isListeningRef.current || isBusyRef.current) return;
    const timer = setTimeout(() => {
      if (
        (autoListenRef.current || wakeWordModeRef.current) &&
        !isListeningRef.current &&
        !isBusyRef.current
      ) {
        startListeningRef.current?.();
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [isStreaming, isSpeaking]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() && uploadedFiles.length === 0) return;
    const currentFiles = [...uploadedFiles];
    const text = input;
    setInput("");
    setUploadedFiles([]);
    await sendMessageFromText(text, currentFiles);
  }, [input, uploadedFiles, sendMessageFromText]);

  // Refs aktuell halten (vermeidet Abhängigkeitsschleifen in Callbacks)
  useEffect(() => {
    startListeningRef.current = startListening;
    createAndStartRecognitionRef.current = createAndStartRecognition;
  });

  // Beim Verlassen der Seite alles sauber beenden
  useEffect(() => {
    return () => {
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignorieren */
      }
      try {
        audioElRef.current?.pause();
      } catch {
        /* ignorieren */
      }
      window.speechSynthesis?.cancel();
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Neue Recognition-Instanz erstellen und starten
  const createAndStartRecognition = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SpeechRecognitionAPI =
      w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition: SpeechRecognitionInstance = new SpeechRecognitionAPI();
    recognition.lang = "de-CH"; // Schweizerdeutsch bevorzugt, fällt auf Hochdeutsch zurück
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3; // Mehr Alternativen für bessere Schweizerdeutsch-Erkennung

    recognition.onstart = () => {
      isListeningRef.current = true;
      setIsListening(true);
      setInterimText("");
      if (watchdogRef.current) {
        clearTimeout(watchdogRef.current);
        watchdogRef.current = null;
      }
    };

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setInterimText(interim);
      if (final) {
        // Finales Ergebnis: direkt senden
        isListeningRef.current = false;
        setIsListening(false);
        setInterimText("");
        recognitionRef.current = null;
        const spoken = final.trim();
        if (!spoken) return;

        // Wake-Word-Modus: erst auf "Hey Jarvis" reagieren
        if (wakeWordModeRef.current && !wakeArmedRef.current) {
          const detection = detectWakeWord(spoken);
          if (!detection.detected) {
            // Kein Aktivierungswort – einfach weiterlauschen
            wantAutoListenRef.current = true;
            setAutoListenTick(t => t + 1);
            return;
          }
          if (detection.rest) {
            // "Hey Jarvis, wie ist das Wetter?" – direkt ausführen
            sendMessageFromText(detection.rest, undefined, "sprache");
            return;
          }
          // Nur das Aktivierungswort – jetzt auf den Auftrag warten
          wakeArmedRef.current = true;
          setWakeArmed(true);
          wantAutoListenRef.current = true;
          setAutoListenTick(t => t + 1);
          return;
        }

        if (wakeWordModeRef.current && wakeArmedRef.current) {
          wakeArmedRef.current = false;
          setWakeArmed(false);
        }

        {
          // sendMessageFromText legt den Text bei laufender Antwort selbst in die
          // Warteschlange – er geht also nie verloren.
          sendMessageFromText(spoken, undefined, "sprache");
        }
      }
    };

    recognition.onerror = (event: any) => {
      isListeningRef.current = false;
      setIsListening(false);
      setInterimText("");
      recognitionRef.current = null;
      if (event.error === "not-allowed") {
        toast.error(
          "Mikrofon-Zugriff verweigert. Bitte in den Browser-Einstellungen erlauben."
        );
      } else if (event.error === "no-speech") {
        // Kein Fehler bei Stille – einfach ignorieren
      } else if (event.error !== "aborted") {
        toast.error(`Sprachfehler: ${event.error}`);
      }
    };

    recognition.onend = () => {
      // Immer aufräumen wenn recognition endet
      isListeningRef.current = false;
      setIsListening(false);
      setInterimText("");
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
      // Wake-Word-Modus: dauerhaft weiterlauschen, solange nichts läuft
      if (wakeWordModeRef.current && !isBusyRef.current) {
        wantAutoListenRef.current = true;
        setAutoListenTick(t => t + 1);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      // Falls onstart nicht innerhalb von 3 Sekunden kommt, ist die Instanz tot
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
      watchdogRef.current = setTimeout(() => {
        if (!isListeningRef.current) {
          try {
            recognition.abort();
          } catch {
            /* ignorieren */
          }
          if (recognitionRef.current === recognition)
            recognitionRef.current = null;
          setIsListening(false);
          toast.error(
            "Das Mikrofon hat nicht gestartet. Bitte nochmals antippen."
          );
        }
      }, 3000);
    } catch {
      isListeningRef.current = false;
      setIsListening(false);
      recognitionRef.current = null;
      // Häufigster Grund: die alte Instanz läuft noch. Kurz warten, dann erneut.
      setTimeout(() => {
        if (!isListeningRef.current) createAndStartRecognitionRef.current?.();
      }, 400);
    }
  }, [sendMessageFromText]);

  // Web Speech API – direkte Browser-Transkription
  const startListening = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (!w.SpeechRecognition && !w.webkitSpeechRecognition) {
      toast.error("Spracherkennung wird von diesem Browser nicht unterstützt.");
      return;
    }

    // Der Mikrofon-Klick ist eine echte Nutzeraktion: gleich die Tonausgabe
    // freigeben, damit Jarvis später auch bei Sprachbedienung sprechen darf.
    if (!audioUnlockedRef.current) unlockAudio();

    // Laufende Sprachausgabe beenden, damit sie nicht mit aufgenommen wird
    window.speechSynthesis?.cancel();
    try {
      audioElRef.current?.pause();
    } catch {
      /* ignorieren */
    }
    elAudioRef.current = null;
    setIsSpeaking(false);

    // Falls noch eine Instanz existiert: hart beenden und neu aufbauen.
    // abort() ist hier richtig, weil wir die Instanz ohnehin verwerfen –
    // stop() konnte hängen bleiben, wodurch die zweite Aufnahme nie startete.
    const old = recognitionRef.current;
    if (old) {
      recognitionRef.current = null;
      isListeningRef.current = false;
      try {
        old.onend = null;
        old.onresult = null;
        old.onerror = null;
      } catch {
        /* ignorieren */
      }
      try {
        old.abort();
      } catch {
        /* ignorieren */
      }
      setTimeout(() => createAndStartRecognition(), 250);
      return;
    }

    createAndStartRecognition();
  }, [createAndStartRecognition, unlockAudio]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignorieren */
      }
      recognitionRef.current = null;
    }
    isListeningRef.current = false;
    setIsListening(false);
    setInterimText("");
  }, []);

  // autoListenRef synchron mit autoListen halten
  useEffect(() => {
    autoListenRef.current = autoListen;
  }, [autoListen]);

  // wakeWordModeRef synchron halten
  useEffect(() => {
    wakeWordModeRef.current = wakeWordMode;
  }, [wakeWordMode]);

  /** Wake-Word-Modus umschalten: Jarvis lauscht dauerhaft auf „Hey Jarvis". */
  const toggleWakeWord = useCallback(() => {
    const next = !wakeWordMode;
    setWakeWordMode(next);
    wakeWordModeRef.current = next;
    wakeArmedRef.current = false;
    setWakeArmed(false);
    if (next) {
      // Hands-free deaktivieren – die beiden Modi würden sich gegenseitig neu starten
      setAutoListen(false);
      autoListenRef.current = false;
      if (!isListeningRef.current && !isBusyRef.current) startListening();
      toast.info("Wake-Word aktiv: Sag «Hey Jarvis», um mich anzusprechen.");
    } else {
      stopListening();
    }
  }, [wakeWordMode, startListening, stopListening]);

  const processAndUploadFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Datei zu groß (max. 10 MB)");
      return;
    }
    setIsUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await uploadMutation.mutateAsync({
        fileName: file.name,
        fileBase64: base64,
        mimeType: file.type,
      });
      setUploadedFiles(prev => [
        ...prev,
        {
          url: result.url,
          key: result.key,
          name: result.fileName,
          mime: result.mimeType,
        }
      ]);
      toast.success(`${file.name} hochgeladen`);
    } catch {
      toast.error("Upload fehlgeschlagen");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      for (const file of files) {
        await processAndUploadFile(file);
      }
    }
  };

  /**
   * Beendet jede Form der Sprachausgabe und hinterlässt einen sauberen Zustand.
   * `resume` steuert, ob danach im Hands-free-/Wake-Word-Modus wieder zugehört
   * werden soll – beim ausdrücklichen Stoppen durch Stefan bewusst nicht.
   */
  const stopSpeaking = useCallback(
    (resume = false) => {
      window.speechSynthesis?.cancel();
      try {
        audioElRef.current?.pause();
      } catch {
        /* ignorieren */
      }
      elAudioRef.current = null;
      setIsSpeaking(false);
      if (resume) resumeListeningAfterSpeech();
    },
    [resumeListeningAfterSpeech]
  );

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Mobile Overlay */}
      {showConvSidebar && !isWidget && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/60"
          onClick={() => setShowConvSidebar(false)}
        />
      )}

      {/* Conversation Sidebar */}
      <div
        className={cn(
          "flex flex-col bg-sidebar/80 border-r border-border transition-all duration-200 overflow-hidden",
          "md:w-56 md:flex-shrink-0 md:relative md:translate-x-0",
          "fixed top-0 bottom-0 left-0 z-40 w-56",
          showConvSidebar
            ? "translate-x-0"
            : "-translate-x-full md:translate-x-0",
          isWidget && "hidden"
        )}
      >
        <div className="p-3 border-b border-border flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                setActiveConvId(null);
                setMessages([]);
                createConvMutation.mutate({});
                setShowConvSidebar(false);
              }}
            >
              <Plus size={14} className="flex-shrink-0" />{" "}
              <span className="truncate">NEUES GESPRÄCH</span>
            </Button>
            <button
              className="md:hidden text-muted-foreground hover:text-primary p-1"
              onClick={() => setShowConvSidebar(false)}
              aria-label="Seitenleiste schließen"
            >
              <ChevronLeft size={18} />
            </button>
          </div>
          {conversations && conversations.length > 0 && (
            <div className="flex justify-between items-center px-1">
              <button
                onClick={() => {
                  setManageMode(!manageMode);
                  setSelectedConvs([]);
                }}
                className="text-[10px] text-muted-foreground hover:text-primary uppercase tracking-wider font-semibold"
              >
                {manageMode ? "Fertig" : "Verwalten"}
              </button>
              {manageMode && selectedConvs.length > 0 && (
                <div className="flex items-center gap-2">
                  <select
                    className="text-[10px] bg-background text-muted-foreground border rounded px-1"
                    value=""
                    onChange={e => {
                      if (e.target.value) {
                        moveToGroupMutation.mutate({
                          conversationIds: selectedConvs,
                          groupId:
                            e.target.value === "none"
                              ? null
                              : parseInt(e.target.value),
                        });
                      }
                    }}
                  >
                    <option value="">Verschieben...</option>
                    <option value="none">Ohne Ordner</option>
                    {groups?.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() =>
                      deleteConvsMutation.mutate({ ids: selectedConvs })
                    }
                    className="text-[10px] text-destructive hover:text-red-400 uppercase tracking-wider font-semibold flex items-center gap-1"
                  >
                    <Trash2 size={10} /> {selectedConvs.length}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <ScrollArea className="flex-1 min-h-0">
          {manageMode && (
            <div className="p-2 border-b">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-7 gap-1"
                onClick={() => {
                  const name = prompt("Name der neuen Gruppe:");
                  if (name) createGroupMutation.mutate({ name });
                }}
              >
                <FolderPlus size={12} /> Neuer Ordner
              </Button>
            </div>
          )}
          <div className="p-2 space-y-1">
            {/* Groups */}
            {groups?.map(group => {
              const isExpanded = expandedGroups.includes(group.id);
              const groupConvs =
                conversations?.filter(c => c.groupId === group.id) || [];
              return (
                <div key={`group-${group.id}`} className="mb-1">
                  <div
                    className="flex items-center gap-2 px-2 py-1.5 rounded text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground hover:bg-accent/50"
                    onClick={() =>
                      setExpandedGroups(prev =>
                        prev.includes(group.id)
                          ? prev.filter(id => id !== group.id)
                          : [...prev, group.id]
                      )
                    }
                  >
                    {isExpanded ? (
                      <FolderOpen size={12} />
                    ) : (
                      <Folder size={12} />
                    )}
                    <span className="flex-1 truncate">{group.name}</span>
                    <span className="text-[10px] opacity-50">
                      {groupConvs.length}
                    </span>
                  </div>
                  {isExpanded && groupConvs.length > 0 && (
                    <div className="pl-3 mt-1 space-y-1 border-l ml-3 border-border/50">
                      {groupConvs.map(conv => (
                        <div
                          key={conv.id}
                          className={cn(
                            "group flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer transition-all",
                            activeConvId === conv.id && !manageMode
                              ? "bg-primary/20 text-primary"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent",
                            manageMode &&
                              selectedConvs.includes(conv.id) &&
                              "bg-accent text-foreground"
                          )}
                          onClick={() => {
                            if (manageMode) {
                              setSelectedConvs(prev =>
                                prev.includes(conv.id)
                                  ? prev.filter(id => id !== conv.id)
                                  : [...prev, conv.id]
                              );
                            } else {
                              setActiveConvId(conv.id);
                              setShowConvSidebar(false);
                            }
                          }}
                        >
                          {manageMode && (
                            <div
                              className={cn(
                                "w-3 h-3 rounded-sm border flex items-center justify-center flex-shrink-0",
                                selectedConvs.includes(conv.id)
                                  ? "bg-primary border-primary text-primary-foreground"
                                  : "border-muted-foreground"
                              )}
                            >
                              {selectedConvs.includes(conv.id) && (
                                <CheckSquare size={10} />
                              )}
                            </div>
                          )}
                          <span className="flex-1 truncate">{conv.title}</span>
                          {!manageMode && (
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                deleteConvMutation.mutate({ id: conv.id });
                                if (activeConvId === conv.id) {
                                  setActiveConvId(null);
                                  setMessages([]);
                                }
                              }}
                              className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Ungrouped */}
            {groups && groups.length > 0 && (
              <div className="h-px bg-border my-2" />
            )}
            {conversations
              ?.filter(c => !c.groupId)
              .map(conv => (
                <div
                  key={conv.id}
                  className={cn(
                    "group flex items-center gap-2 px-2 py-2 rounded text-xs cursor-pointer transition-all",
                    activeConvId === conv.id && !manageMode
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent",
                    manageMode &&
                      selectedConvs.includes(conv.id) &&
                      "bg-accent text-foreground"
                  )}
                  onClick={() => {
                    if (manageMode) {
                      setSelectedConvs(prev =>
                        prev.includes(conv.id)
                          ? prev.filter(id => id !== conv.id)
                          : [...prev, conv.id]
                      );
                    } else {
                      setActiveConvId(conv.id);
                      setShowConvSidebar(false);
                    }
                  }}
                >
                  {manageMode && (
                    <div
                      className={cn(
                        "w-3 h-3 rounded-sm border flex items-center justify-center flex-shrink-0",
                        selectedConvs.includes(conv.id)
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-muted-foreground"
                      )}
                    >
                      {selectedConvs.includes(conv.id) && (
                        <CheckSquare size={10} />
                      )}
                    </div>
                  )}
                  <span className="flex-1 truncate">{conv.title}</span>
                  {!manageMode && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        deleteConvMutation.mutate({ id: conv.id });
                        if (activeConvId === conv.id) {
                          setActiveConvId(null);
                          setMessages([]);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity flex-shrink-0"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div
          className={cn(
            "flex items-center gap-2 border-b border-border",
            isWidget ? "px-3 py-2" : "px-3 md:px-6 py-3"
          )}
        >
          {!isWidget && (
            <button
              className="md:hidden text-muted-foreground hover:text-primary p-1 flex-shrink-0"
              onClick={() => setShowConvSidebar(true)}
              aria-label="Gespräche anzeigen"
            >
              <MessageSquare size={18} />
            </button>
          )}
          {isWidget ? (
            <Button
              onClick={() => {
                setActiveConvId(null);
                setMessages([]);
                createConvMutation.mutate({});
              }}
              size="sm"
              variant="ghost"
              className="gap-1 text-primary hover:bg-primary/20 px-2"
              title="Neues Gespräch"
            >
              <Plus size={14} />
            </Button>
          ) : (
            <JarvisOrb size={28} />
          )}
          <div className="min-w-0">
            {!isWidget && (
              <h2 className="font-jarvis text-sm font-bold text-primary">
                JARVIS
              </h2>
            )}
            <p
              className="text-xs text-muted-foreground truncate"
              aria-live="polite"
              role="status"
            >
              {isStreaming ? (
                <span className="text-primary animate-pulse">
                  Denkt nach...
                </span>
              ) : isListening ? (
                <span className="text-green-400 animate-pulse">Hört zu...</span>
              ) : isSpeaking ? (
                <span className="text-cyan-400 animate-pulse">Spricht...</span>
              ) : (
                "Bereit"
              )}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchEnabled(!searchEnabled)}
              className={cn(
                "gap-1 text-xs px-2",
                searchEnabled ? "text-primary" : "text-muted-foreground"
              )}
              title="Web-Suche"
            >
              <Globe size={14} />
              <span className="hidden sm:inline">
                {searchEnabled ? "Suche AN" : "Suche AUS"}
              </span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={isSpeaking ? () => stopSpeaking(false) : toggleTts}
              className={cn(
                "gap-1 text-xs px-2 border",
                ttsUnlocked && ttsEnabled
                  ? "text-primary border-primary/30 bg-primary/10"
                  : "text-muted-foreground border-transparent"
              )}
              title={
                speechMode === "always"
                  ? "Sprachausgabe: bei jeder Antwort (antippen zum Wechseln)"
                  : speechMode === "voice-only"
                    ? "Sprachausgabe: nur bei Sprachbedienung – schont das Guthaben (antippen zum Wechseln)"
                    : "Sprachausgabe: aus (antippen zum Wechseln)"
              }
            >
              {isSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
              <span className="hidden sm:inline">
                {isSpeaking
                  ? "Stopp"
                  : !ttsUnlocked
                    ? "🔇 AUS"
                    : speechMode === "always"
                      ? "🔊 Immer"
                      : speechMode === "voice-only"
                        ? "🎤 Nur Sprache"
                        : "🔇 Aus"}
              </span>
              <span className="sm:hidden">
                {isSpeaking
                  ? "■"
                  : !ttsUnlocked
                    ? ""
                    : speechMode === "always"
                      ? "∞"
                      : speechMode === "voice-only"
                        ? "🎤"
                        : ""}
              </span>
            </Button>
            {/* Zeichen-Budget der Sprachausgabe */}
            {ttsUsage && (
              <span
                title={
                  ttsUsage.level === "exhausted"
                    ? `Guthaben aufgebraucht (${ttsUsage.charsUsed} von ${ttsUsage.limit} Zeichen). Jarvis nutzt die Browser-Stimme.` +
                      (ttsResetAt
                        ? ` Neues Guthaben ab ${new Date(ttsResetAt).toLocaleDateString("de-CH")}.`
                        : "")
                    : `Sprachausgabe: ${ttsUsage.charsUsed} von ${ttsUsage.limit} Zeichen verbraucht` +
                      (ttsResetAt
                        ? `, Rücksetzung am ${new Date(ttsResetAt).toLocaleDateString("de-CH")}`
                        : "")
                }
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] tabular-nums",
                  ttsUsage.level === "exhausted" ||
                    ttsUsage.level === "critical"
                    ? "border-destructive/40 text-destructive"
                    : ttsUsage.level === "warn"
                      ? "border-yellow-500/40 text-yellow-400"
                      : "border-border text-muted-foreground"
                )}
              >
                {ttsUsage.level === "exhausted" ? (
                  <>
                    <span className="hidden md:inline">
                      Guthaben leer – Browser-Stimme
                    </span>
                    <span className="md:hidden">0%</span>
                  </>
                ) : (
                  <>
                    <span className="hidden md:inline">
                      {ttsUsage.remaining.toLocaleString("de-CH")} Zeichen übrig
                    </span>
                    <span className="md:hidden">
                      {Math.max(0, 100 - ttsUsage.percentUsed)}%
                    </span>
                  </>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Messages */}
        <ScrollArea
          className="flex-1 min-h-0 px-3 md:px-6 py-4"
          ref={scrollRef as React.RefObject<HTMLDivElement>}
        >
          {messages.length === 0 && !isListening ? (
            <div className="flex flex-col items-center justify-center h-full gap-6 py-20">
              <JarvisOrb size={80} />
              <div className="text-center">
                <h3 className="font-jarvis text-2xl font-bold text-primary jarvis-glow-text mb-2">
                  Hallo{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
                </h3>
                <p className="text-muted-foreground">
                  Wie kann ich dir heute helfen?
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 w-full px-4">
                {(
                  suggestions ?? [
                    {
                      label: "Was steht heute an?",
                      promptText:
                        "Was steht heute an? Erstelle mir eine priorisierte Tagesplanung.",
                    },
                    {
                      label: "Offene Rechnungen zeigen",
                      promptText: "Zeige mir alle offenen Rechnungen.",
                    },
                    {
                      label: "Offene Tickets zeigen",
                      promptText: "Welche Tickets sind noch offen?",
                    },
                    {
                      label: "Termine diese Woche",
                      promptText: "Welche Termine habe ich diese Woche?",
                    },
                  ]
                ).map(s => (
                  <button
                    key={s.label}
                    onClick={() => setInput(s.promptText)}
                    className="text-left p-3 rounded-lg jarvis-card text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex gap-3",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {msg.role === "assistant" && (
                    <div className="flex-shrink-0 mt-1">
                      <JarvisOrb size={28} />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-xl px-4 py-3 text-sm",
                      msg.role === "user"
                        ? "bg-primary/20 text-foreground border border-primary/30 ml-auto"
                        : "bg-card border border-border text-foreground"
                    )}
                  >
                    {msg.fileName && (
                      <div className="flex items-center gap-2 mb-2 text-xs text-primary/80 border-b border-border pb-2">
                        <FileText size={12} />
                        {msg.fileName}
                      </div>
                    )}
                    {msg.role === "assistant" ? (
                      <AssistantMessage content={msg.content} />
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                    {msg.role === "assistant" &&
                      !msg.content &&
                      isStreaming && (
                        <div className="flex gap-1 items-center">
                          <div
                            className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
                            style={{ animationDelay: "0ms" }}
                          />
                          <div
                            className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
                            style={{ animationDelay: "150ms" }}
                          />
                          <div
                            className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
                            style={{ animationDelay: "300ms" }}
                          />
                        </div>
                      )}
                  </div>
                </div>
              ))}
              {/* Interim-Text während Spracherkennung */}
              {isListening && (
                <div className="flex gap-3 justify-end">
                  <div className="max-w-[80%] rounded-xl px-4 py-3 text-sm bg-primary/10 border border-primary/20 text-primary/70 italic">
                    {interimText || "Höre zu..."}
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Input Area */}
        <div className="px-3 md:px-6 py-3 border-t border-border">
          {uploadedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {uploadedFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary max-w-[200px]"
                >
                  <FileText size={12} className="flex-shrink-0" />
                  <span className="truncate">{file.name}</span>
                  <button
                    onClick={() =>
                      setUploadedFiles(prev => prev.filter((_, i) => i !== idx))
                    }
                    className="hover:text-destructive flex-shrink-0 ml-1"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Großer Mikrofon-Button (Gemini-Style) wenn kein Text eingegeben */}
          {!input.trim() && uploadedFiles.length === 0 && (
            <div className="flex flex-col items-center gap-2 mb-3">
              <button
                onClick={() => {
                  const next = !autoListen;
                  setAutoListen(next);
                  autoListenRef.current = next;
                  if (next && !isListening && !isBusyRef.current) {
                    startListening();
                  } else if (!next) {
                    stopListening();
                  }
                }}
                className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg",
                  isListening
                    ? "bg-red-500/20 border-2 border-red-500 text-red-400 scale-110 animate-pulse"
                    : isSpeaking
                      ? "bg-cyan-500/20 border-2 border-cyan-500 text-cyan-400 scale-105"
                      : "bg-primary/20 border-2 border-primary/50 text-primary hover:bg-primary/30 hover:scale-105 active:scale-95",
                  isStreaming && "opacity-50 cursor-not-allowed"
                )}
                title={isListening ? "Aufnahme stoppen" : "Jarvis sprechen"}
              >
                {isListening ? <MicOff size={28} /> : <Mic size={28} />}
              </button>
            </div>
          )}

          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <Textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={e => {
                  const items = e.clipboardData?.items;
                  if (!items) return;
                  for (let i = 0; i < items.length; i++) {
                    if (items[i].type.startsWith("image/")) {
                      const file = items[i].getAsFile();
                      if (file) {
                        processAndUploadFile(file);
                        e.preventDefault();
                      }
                    }
                  }
                }}
                placeholder={
                  isListening
                    ? "Höre zu..."
                    : "Frag Jarvis etwas... (Enter zum Senden)"
                }
                className="min-h-[52px] max-h-[200px] resize-none bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50"
                disabled={isListening}
              />
            </div>
            <div className="flex flex-col gap-1">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileUpload}
                accept="image/*,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="h-8 w-8 text-muted-foreground hover:text-primary"
                title="Datei hochladen"
                aria-label="Datei hochladen"
              >
                {isUploading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Paperclip size={14} />
                )}
              </Button>
              {input.trim() && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (isListening) {
                      setAutoListen(false);
                      autoListenRef.current = false;
                      stopListening();
                    } else {
                      setAutoListen(true);
                      autoListenRef.current = true;
                      startListening();
                    }
                  }}
                  className={cn(
                    "h-8 w-8",
                    isListening
                      ? "text-red-400 animate-pulse"
                      : "text-muted-foreground hover:text-primary"
                  )}
                  title={
                    isListening ? "Hands-free stoppen" : "Hands-free starten"
                  }
                  aria-label={
                    isListening ? "Aufnahme stoppen" : "Spracheingabe starten"
                  }
                >
                  {isListening ? <MicOff size={14} /> : <Mic size={14} />}
                </Button>
              )}
              <Button
                size="icon"
                onClick={sendMessage}
                disabled={!input.trim() && uploadedFiles.length === 0}
                className="h-8 w-8 bg-primary text-primary-foreground hover:bg-primary/90"
                aria-label="Nachricht senden"
              >
                {isStreaming ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
