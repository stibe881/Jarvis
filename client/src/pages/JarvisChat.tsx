import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import {
  Send, Mic, MicOff, Volume2, VolumeX, Plus, Trash2,
  Paperclip, Globe, X, FileText, Loader2, ChevronLeft, MessageSquare
} from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { JarvisOrb } from "@/components/JarvisLayout";

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
  const { user } = useAuth();
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const ttsEnabledRef = useRef(true);
  const ttsUnlockedRef = useRef(false); // iOS: speechSynthesis muss einmal per User-Gesture entsperrt werden
  const [ttsUnlocked, setTtsUnlocked] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [uploadedFile, setUploadedFile] = useState<{ url: string; key: string; name: string; mime: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [showConvSidebar, setShowConvSidebar] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false); // synchroner Guard für startListening
  const [autoListen, setAutoListen] = useState(false); // kontinuierlicher Zuhör-Modus
  const autoListenRef = useRef(false); // synchron für Callbacks
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const voicesLoadedRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const startListeningRef = useRef<(() => void) | null>(null); // Ref für Circular-Dep-Vermeidung

  // Stimmen vorladen
  useEffect(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => { voicesLoadedRef.current = true; };
      }
    }
  }, []);

  // TTS-Funktion
  const speakText = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;
    if (!ttsUnlockedRef.current) {
      console.warn("[TTS] Noch nicht entsperrt – bitte Sprachausgabe-Banner antippen");
      return;
    }
    window.speechSynthesis.cancel();
    const clean = text.replace(/[#*`_~>\[\]()]/g, "").replace(/\n+/g, " ").trim().slice(0, 600);
    if (!clean) return;
    const utterance = new SpeechSynthesisUtterance(clean);
    // Sprache und Tonlage werden nach Stimmen-Auswahl unten gesetzt
    const voices = window.speechSynthesis.getVoices();
    // Jarvis-Stimme: Deutsch, tiefe männliche Stimme bevorzugt
    const jarvisVoice =
      voices.find(v => v.lang === "de-DE" && v.name.toLowerCase().includes("stefan")) ||
      voices.find(v => v.lang === "de-DE" && v.name.toLowerCase().includes("markus")) ||
      voices.find(v => v.lang === "de-DE" && !v.name.toLowerCase().includes("anna") && !v.name.toLowerCase().includes("female")) ||
      voices.find(v => v.lang.startsWith("de")) ||
      voices.find(v => v.default);
    if (jarvisVoice) utterance.voice = jarvisVoice;
    // Deutsch, tiefe Stimme, leicht langsamer
    utterance.lang = jarvisVoice?.lang || "de-DE";
    utterance.rate = 0.90;
    utterance.pitch = 0.80; // tiefer = männlicher Klang
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      // Kontinuierlicher Modus: nach Antwort automatisch wieder zuhören
      if (autoListenRef.current) {
        setTimeout(() => {
          if (autoListenRef.current) startListeningRef.current?.();
        }, 600); // 600ms Pause nach Antwort
      }
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      if (autoListenRef.current) {
        setTimeout(() => {
          if (autoListenRef.current) startListeningRef.current?.();
        }, 600);
      }
    };
    // iOS-Fix: speak in setTimeout(0) damit es auch nach async-Calls funktioniert
    setTimeout(() => window.speechSynthesis.speak(utterance), 0);
  }, []);

  // TTS einmalig entsperren (per User-Gesture)
  const unlockTts = useCallback(() => {
    if (!("speechSynthesis" in window)) return;
    const unlock = new SpeechSynthesisUtterance("");
    window.speechSynthesis.speak(unlock);
    ttsUnlockedRef.current = true;
    ttsEnabledRef.current = true;
    setTtsUnlocked(true);
    setTtsEnabled(true);
    voicesLoadedRef.current = true;
    window.speechSynthesis.getVoices();
  }, []);

  const toggleTts = useCallback(() => {
    if (!ttsUnlockedRef.current) {
      unlockTts();
      return;
    }
    if (isSpeaking) {
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
    } else {
      const next = !ttsEnabled;
      setTtsEnabled(next);
      ttsEnabledRef.current = next;
    }
  }, [ttsEnabled, isSpeaking, unlockTts]);

  const utils = trpc.useUtils();
  const { data: conversations } = trpc.chat.listConversations.useQuery();
  const createConvMutation = trpc.chat.createConversation.useMutation({
    onSuccess: (data) => {
      utils.chat.listConversations.invalidate();
      if (data?.id) setActiveConvId(data.id);
    },
  });
  const deleteConvMutation = trpc.chat.deleteConversation.useMutation({
    onSuccess: () => utils.chat.listConversations.invalidate(),
  });
  const uploadMutation = trpc.chat.uploadFile.useMutation();
  const searchMutation = trpc.chat.webSearch.useMutation();
  const sendMessageMutation = trpc.chat.sendMessage.useMutation();

  const { data: dbMessages } = trpc.chat.getMessages.useQuery(
    { conversationId: activeConvId! },
    { enabled: !!activeConvId }
  );

  useEffect(() => {
    if (dbMessages) setMessages(dbMessages as Message[]);
  }, [dbMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, interimText]);

  // Kern-Funktion: Nachricht senden
  const sendMessageFromText = useCallback(async (text: string, file?: typeof uploadedFile) => {
    if (!text.trim() && !file) return;
    if (isStreaming) return;

    let convId = activeConvId;
    if (!convId) {
      const result = await createConvMutation.mutateAsync({});
      convId = result?.id ?? null;
      if (convId) setActiveConvId(convId);
    }
    if (!convId) return;

    const userMsg: Message = { role: "user", content: text, fileUrl: file?.url, fileName: file?.name };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMsg]);

    // Optionale Web-Suche
    let searchResults: Array<{ title: string; snippet: string; url: string }> = [];
    if (searchEnabled && text.trim()) {
      try {
        const sr = await searchMutation.mutateAsync({ query: text });
        searchResults = sr.results;
      } catch { /* ignorieren */ }
    }

    try {
      const result = await sendMessageMutation.mutateAsync({
        conversationId: convId,
        message: text,
        fileUrl: file?.url ?? undefined,
        fileName: file?.name ?? undefined,
        searchResults,
      });

      const fullText = result.response;
      utils.chat.listConversations.invalidate();

      // Pseudo-Streaming: Wort für Wort einblenden
      const words = fullText.split(" ");
      let displayed = "";
      const delay = Math.max(8, Math.min(35, 1200 / words.length));
      for (let i = 0; i < words.length; i++) {
        displayed += (i > 0 ? " " : "") + words[i];
        const snap = displayed;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], content: snap };
          return updated;
        });
        await new Promise(r => setTimeout(r, delay));
      }

      // TTS
      if (fullText) speakText(fullText);
    } catch {
      toast.error("Fehler beim Senden der Nachricht");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsStreaming(false);
      utils.chat.getMessages.invalidate({ conversationId: convId });
    }
  }, [isStreaming, activeConvId, searchEnabled, createConvMutation, searchMutation, sendMessageMutation, speakText, utils]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() && !uploadedFile) return;
    const file = uploadedFile;
    const text = input;
    setInput("");
    setUploadedFile(null);
    await sendMessageFromText(text, file ?? undefined);
  }, [input, uploadedFile, sendMessageFromText]);

  // startListeningRef aktuell halten (für speakText Callback)
  useEffect(() => {
    startListeningRef.current = startListening;
  });

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
    const SpeechRecognitionAPI = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: SpeechRecognitionInstance = new SpeechRecognitionAPI();
    recognition.lang = "de-DE";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      isListeningRef.current = true;
      setIsListening(true);
      setInterimText("");
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
        // Finales Ergebnis: State sofort zurücksetzen
        isListeningRef.current = false;
        setIsListening(false);
        setInterimText("");
        recognitionRef.current = null;
        // KEIN abort() – recognition endet natürlich
        sendMessageFromText(final.trim());
      }
    };

    recognition.onerror = (event: any) => {
      isListeningRef.current = false;
      setIsListening(false);
      setInterimText("");
      recognitionRef.current = null;
      if (event.error === "not-allowed") {
        toast.error("Mikrofon-Zugriff verweigert. Bitte in den Browser-Einstellungen erlauben.");
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
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      isListeningRef.current = false;
      setIsListening(false);
      recognitionRef.current = null;
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

    // TTS stoppen während Aufnahme
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);

    // Falls noch aktiv: stoppen (KEIN abort – stop() lässt onend feuern)
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignorieren */ }
      recognitionRef.current = null;
      isListeningRef.current = false;
      // Kurze Pause damit onend feuern kann, dann neu starten
      setTimeout(() => createAndStartRecognition(), 300);
      return;
    }

    // Direkt starten (keine Pause nötig wenn keine aktive Instanz)
    createAndStartRecognition();
  }, [createAndStartRecognition]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignorieren */ }
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Datei zu groß (max. 10 MB)"); return; }
    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const result = await uploadMutation.mutateAsync({ fileName: file.name, fileBase64: base64, mimeType: file.type });
        setUploadedFile({ url: result.url, key: result.key, name: result.fileName, mime: result.mimeType });
        toast.success(`${file.name} hochgeladen`);
      };
      reader.readAsDataURL(file);
    } catch { toast.error("Upload fehlgeschlagen"); }
    finally { setIsUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const stopSpeaking = () => { window.speechSynthesis?.cancel(); setIsSpeaking(false); };

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Mobile Overlay */}
      {showConvSidebar && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/60" onClick={() => setShowConvSidebar(false)} />
      )}

      {/* Conversation Sidebar */}
      <div className={cn(
        "flex flex-col bg-sidebar/80 border-r border-border transition-all duration-200",
        "md:w-52 md:flex-shrink-0 md:relative md:translate-x-0",
        "fixed top-0 bottom-0 left-0 z-40 w-72",
        showConvSidebar ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-3 border-b border-border flex items-center gap-2">
          <Button
            onClick={() => { setActiveConvId(null); setMessages([]); createConvMutation.mutate({}); setShowConvSidebar(false); }}
            size="sm"
            className="flex-1 gap-2 bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30 font-jarvis text-xs tracking-wider"
          >
            <Plus size={14} /> NEUES GESPRÄCH
          </Button>
          <button className="md:hidden text-muted-foreground hover:text-primary p-1" onClick={() => setShowConvSidebar(false)}>
            <ChevronLeft size={18} />
          </button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {conversations?.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  "group flex items-center gap-2 px-2 py-2 rounded text-xs cursor-pointer transition-all",
                  activeConvId === conv.id ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
                onClick={() => { setActiveConvId(conv.id); setShowConvSidebar(false); }}
              >
                <span className="flex-1 truncate">{conv.title}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteConvMutation.mutate({ id: conv.id }); if (activeConvId === conv.id) { setActiveConvId(null); setMessages([]); } }}
                  className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 md:px-6 py-3 border-b border-border">
          <button className="md:hidden text-muted-foreground hover:text-primary p-1 flex-shrink-0" onClick={() => setShowConvSidebar(true)}>
            <MessageSquare size={18} />
          </button>
          <JarvisOrb size={28} />
          <div className="min-w-0">
            <h2 className="font-jarvis text-sm font-bold text-primary">JARVIS</h2>
            <p className="text-xs text-muted-foreground truncate">
              {isStreaming ? <span className="text-primary animate-pulse">Denkt nach...</span>
               : isListening ? <span className="text-green-400 animate-pulse">Hört zu...</span>
               : isSpeaking ? <span className="text-cyan-400 animate-pulse">Spricht...</span>
               : "Bereit"}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setSearchEnabled(!searchEnabled)}
              className={cn("gap-1 text-xs px-2", searchEnabled ? "text-primary" : "text-muted-foreground")} title="Web-Suche">
              <Globe size={14} />
              <span className="hidden sm:inline">{searchEnabled ? "Suche AN" : "Suche AUS"}</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={isSpeaking ? stopSpeaking : toggleTts}
              className={cn("gap-1 text-xs px-2 border", ttsUnlocked && ttsEnabled ? "text-primary border-primary/30 bg-primary/10" : "text-muted-foreground border-transparent")} title="Sprachausgabe">
              {isSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
              <span className="hidden sm:inline">{isSpeaking ? "Stopp" : ttsUnlocked && ttsEnabled ? "🔊 AN" : "🔇 AUS"}</span>
            </Button>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-3 md:px-6 py-4" ref={scrollRef as React.RefObject<HTMLDivElement>}>
          {/* TTS-Unlock-Banner */}
          {!ttsUnlocked && (
            <div className="mx-auto max-w-sm mb-4 mt-2">
              <button
                onClick={unlockTts}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-all group"
              >
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/30">
                  <Volume2 size={16} className="text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-semibold text-primary">Sprachausgabe aktivieren</p>
                  <p className="text-xs text-muted-foreground">Tippe hier damit Jarvis mit dir sprechen kann</p>
                </div>
              </button>
            </div>
          )}
          {messages.length === 0 && !isListening ? (
            <div className="flex flex-col items-center justify-center h-full gap-6 py-20">
              <JarvisOrb size={80} />
              <div className="text-center">
                <h3 className="font-jarvis text-2xl font-bold text-primary jarvis-glow-text mb-2">
                  Hallo{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
                </h3>
                <p className="text-muted-foreground">Wie kann ich dir heute helfen?</p>
              </div>
              <div className="grid grid-cols-2 gap-3 max-w-lg w-full">
                {["Erkläre mir Quantencomputing", "Schreibe eine E-Mail", "Analysiere diese Datei", "Suche aktuelle Neuigkeiten"].map((s) => (
                  <button key={s} onClick={() => setInput(s)}
                    className="text-left p-3 rounded-lg jarvis-card text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              {messages.map((msg, i) => (
                <div key={i} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                  {msg.role === "assistant" && <div className="flex-shrink-0 mt-1"><JarvisOrb size={28} /></div>}
                  <div className={cn(
                    "max-w-[80%] rounded-xl px-4 py-3 text-sm",
                    msg.role === "user" ? "bg-primary/20 text-foreground border border-primary/30 ml-auto" : "bg-card border border-border text-foreground"
                  )}>
                    {msg.fileName && (
                      <div className="flex items-center gap-2 mb-2 text-xs text-primary/80 border-b border-border pb-2">
                        <FileText size={12} />{msg.fileName}
                      </div>
                    )}
                    {msg.role === "assistant" ? (
                      <Streamdown className="prose prose-invert prose-sm max-w-none">{msg.content}</Streamdown>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                    {msg.role === "assistant" && !msg.content && isStreaming && (
                      <div className="flex gap-1 items-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
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
          {uploadedFile && (
            <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary">
              <FileText size={12} />
              <span className="flex-1 truncate">{uploadedFile.name}</span>
              <button onClick={() => setUploadedFile(null)} className="hover:text-destructive"><X size={12} /></button>
            </div>
          )}

          {/* Großer Mikrofon-Button (Gemini-Style) wenn kein Text eingegeben */}
          {!input.trim() && !uploadedFile && (
            <div className="flex flex-col items-center gap-2 mb-3">
              <button
                onClick={isListening ? stopListening : startListening}
                disabled={isStreaming}
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
              {/* Kontinuierlicher Zuhör-Modus Toggle */}
              <button
                onClick={() => {
                  const next = !autoListen;
                  setAutoListen(next);
                  autoListenRef.current = next;
                  if (next && !isListening && !isStreaming) {
                    startListening();
                  } else if (!next) {
                    stopListening();
                  }
                }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all border",
                  autoListen
                    ? "bg-primary/20 border-primary/50 text-primary"
                    : "bg-transparent border-border text-muted-foreground hover:border-primary/30 hover:text-primary"
                )}
                title="Kontinuierlicher Zuhör-Modus"
              >
                <div className={cn("w-1.5 h-1.5 rounded-full", autoListen ? "bg-primary animate-pulse" : "bg-muted-foreground")} />
                {autoListen ? "Hands-free AN" : "Hands-free"}
              </button>
            </div>
          )}

          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isListening ? "Höre zu..." : "Frag Jarvis etwas... (Enter zum Senden)"}
                className="min-h-[52px] max-h-[200px] resize-none bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50"
                disabled={isStreaming || isListening}
              />
            </div>
            <div className="flex flex-col gap-1">
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.txt,.md,.doc,.docx,.png,.jpg,.jpeg,.webp" />
              <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={isUploading}
                className="h-8 w-8 text-muted-foreground hover:text-primary" title="Datei hochladen">
                {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
              </Button>
              {input.trim() && (
                <Button variant="ghost" size="icon" onClick={isListening ? stopListening : startListening} disabled={isStreaming}
                  className={cn("h-8 w-8", isListening ? "text-red-400 animate-pulse" : "text-muted-foreground hover:text-primary")}
                  title={isListening ? "Aufnahme stoppen" : "Spracheingabe"}>
                  {isListening ? <MicOff size={14} /> : <Mic size={14} />}
                </Button>
              )}
              <Button size="icon" onClick={sendMessage} disabled={isStreaming || (!input.trim() && !uploadedFile)}
                className="h-8 w-8 bg-primary text-primary-foreground hover:bg-primary/90">
                {isStreaming ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
