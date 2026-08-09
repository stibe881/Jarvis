import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import {
  Send, Mic, MicOff, Volume2, VolumeX, Plus, Trash2,
  Paperclip, Globe, X, FileText, Loader2, ChevronLeft, MessageSquare
} from "lucide-react";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
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

export default function JarvisChat() {
  const { user } = useAuth();
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true); // TTS standardmäßig AN
  const ttsEnabledRef = useRef(true); // TTS standardmäßig AN
  const [uploadedFile, setUploadedFile] = useState<{ url: string; key: string; name: string; mime: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [showConvSidebar, setShowConvSidebar] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const voicesLoadedRef = useRef(false);

  // TTS-Toggle: ref synchron halten damit sendMessage immer aktuellen Wert sieht
  const toggleTts = useCallback(() => {
    if (isSpeaking) {
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
    } else {
      const next = !ttsEnabled;
      setTtsEnabled(next);
      ttsEnabledRef.current = next;
      // Stimmen vorladen (iOS braucht das im User-Gesture-Kontext)
      if (next && "speechSynthesis" in window && !voicesLoadedRef.current) {
        window.speechSynthesis.getVoices();
        voicesLoadedRef.current = true;
      }
    }
  }, [ttsEnabled, isSpeaking]);

  // Stimmen beim Mount vorladen
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
    if (!ttsEnabledRef.current || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    // Markdown-Zeichen entfernen, auf 600 Zeichen kürzen
    const clean = text.replace(/[#*`_~>]/g, "").replace(/\n+/g, " ").trim().slice(0, 600);
    if (!clean) return;
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = "de-DE";
    utterance.rate = 0.92;
    utterance.pitch = 0.9;
    // Deutsche Stimme bevorzugen
    const voices = window.speechSynthesis.getVoices();
    const deVoice = voices.find(v => v.lang.startsWith("de") && !v.name.includes("Google")) ||
                    voices.find(v => v.lang.startsWith("de")) ||
                    voices.find(v => v.default);
    if (deVoice) utterance.voice = deVoice;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

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
  const transcribeMutation = trpc.chat.transcribeAudio.useMutation();
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
  }, [messages]);

  // sendMessageFromText: direkt mit Text aufrufen (für Voice-Auto-Send)
  const sendMessageFromText = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;
    let convId = activeConvId;
    if (!convId) {
      const result = await createConvMutation.mutateAsync({});
      convId = result?.id ?? null;
      if (convId) setActiveConvId(convId);
    }
    if (!convId) return;
    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMsg]);
    try {
      const result = await sendMessageMutation.mutateAsync({ conversationId: convId, message: text });
      const fullText = result.response;
      utils.chat.listConversations.invalidate();
      const words = fullText.split(" ");
      let displayed = "";
      const delay = Math.max(10, Math.min(40, 1500 / words.length));
      for (let i = 0; i < words.length; i++) {
        displayed += (i > 0 ? " " : "") + words[i];
        const snap = displayed;
        setMessages((prev) => { const updated = [...prev]; updated[updated.length - 1] = { ...updated[updated.length - 1], content: snap }; return updated; });
        await new Promise(r => setTimeout(r, delay));
      }
      if (fullText) speakText(fullText);
    } catch { toast.error("Fehler beim Senden"); setMessages((prev) => prev.slice(0, -1)); }
    finally { setIsStreaming(false); utils.chat.getMessages.invalidate({ conversationId: convId }); }
  }, [isStreaming, activeConvId, createConvMutation, sendMessageMutation, speakText, utils]);

  const startNewConversation = useCallback(async () => {
    const result = await createConvMutation.mutateAsync({});
    return result?.id;
  }, [createConvMutation]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() && !uploadedFile) return;
    if (isStreaming) return;

    let convId = activeConvId;
    if (!convId) {
      const result = await createConvMutation.mutateAsync({});
      convId = result?.id ?? null;
      if (convId) setActiveConvId(convId);
    }
    if (!convId) return;

    const userMsg: Message = {
      role: "user",
      content: input,
      fileUrl: uploadedFile?.url,
      fileName: uploadedFile?.name,
    };
    setMessages((prev) => [...prev, userMsg]);
    const sentInput = input;
    setInput("");
    setUploadedFile(null);
    setIsStreaming(true);

    // Optionale Web-Suche
    let searchResults: Array<{ title: string; snippet: string; url: string }> = [];
    if (searchEnabled && sentInput.trim()) {
      setIsSearching(true);
      try {
        const sr = await searchMutation.mutateAsync({ query: sentInput });
        searchResults = sr.results;
      } catch { /* ignorieren */ }
      setIsSearching(false);
    }

    // Streaming-Antwort
    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      // tRPC-Mutation (funktioniert zuverlässig in Produktion)
      const result = await sendMessageMutation.mutateAsync({
        conversationId: convId,
        message: sentInput,
        fileUrl: userMsg.fileUrl ?? undefined,
        fileName: userMsg.fileName ?? undefined,
        searchResults,
      });

      const fullText = result.response;
      utils.chat.listConversations.invalidate();

      // Pseudo-Streaming: Wort für Wort einblenden
      const words = fullText.split(" ");
      let displayed = "";
      const delay = Math.max(10, Math.min(40, 1500 / words.length));
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

      // TTS nach vollständiger Anzeige
      if (fullText) speakText(fullText);
    } catch (err) {
      toast.error("Fehler beim Senden der Nachricht");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsStreaming(false);
      utils.chat.getMessages.invalidate({ conversationId: convId });
    }
  }, [input, uploadedFile, isStreaming, activeConvId, searchEnabled, createConvMutation, searchMutation, sendMessageMutation, speakText, utils]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(",")[1];
          try {
            const result = await transcribeMutation.mutateAsync({ audioBase64: base64 });
            if (result.text) {
              const transcribed = result.text.trim();
              // Automatisch senden (Voice-Auto-Send)
              sendMessageFromText(transcribed);
            }
          } catch {
            toast.error("Transkription fehlgeschlagen");
          }
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      toast.error("Mikrofon-Zugriff verweigert");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Datei zu groß (max. 10 MB)"); return; }
    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const result = await uploadMutation.mutateAsync({
          fileName: file.name,
          fileBase64: base64,
          mimeType: file.type,
        });
        setUploadedFile({ url: result.url, key: result.key, name: result.fileName, mime: result.mimeType });
        toast.success(`${file.name} hochgeladen`);
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error("Upload fehlgeschlagen");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const stopSpeaking = () => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  };

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Conversation Sidebar – Desktop immer sichtbar, Mobile als Overlay */}
      {/* Mobile Overlay-Backdrop */}
      {showConvSidebar && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/60"
          onClick={() => setShowConvSidebar(false)}
        />
      )}
      <div className={cn(
        "flex flex-col bg-sidebar/80 border-r border-border transition-all duration-200",
        // Desktop: immer sichtbar, feste Breite
        "md:w-52 md:flex-shrink-0 md:relative md:translate-x-0",
        // Mobile: als Slide-in-Panel
        "fixed top-0 bottom-0 left-0 z-40 w-72",
        showConvSidebar ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-3 border-b border-border flex items-center gap-2">
          <Button
            onClick={() => { setActiveConvId(null); setMessages([]); startNewConversation(); setShowConvSidebar(false); }}
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
                  activeConvId === conv.id
                    ? "bg-primary/20 text-primary jarvis-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
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
          {/* Mobile: Gespräche-Button */}
          <button
            className="md:hidden text-muted-foreground hover:text-primary p-1 flex-shrink-0"
            onClick={() => setShowConvSidebar(true)}
            title="Gespräche"
          >
            <MessageSquare size={18} />
          </button>
          <JarvisOrb size={28} />
          <div className="min-w-0">
            <h2 className="font-jarvis text-sm font-bold text-primary">JARVIS</h2>
            <p className="text-xs text-muted-foreground truncate">
              {isStreaming ? (
                <span className="text-primary animate-pulse">Verarbeite...</span>
              ) : isSearching ? (
                <span className="text-primary animate-pulse">Suche...</span>
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
              className={cn("gap-1 text-xs px-2", searchEnabled ? "text-primary" : "text-muted-foreground")}
              title="Web-Suche"
            >
              <Globe size={14} />
              <span className="hidden sm:inline">{searchEnabled ? "Suche AN" : "Suche AUS"}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTts}
              className={cn("gap-1 text-xs px-2", ttsEnabled ? "text-primary" : "text-muted-foreground")}
              title="Sprachausgabe"
            >
              {isSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
              <span className="hidden sm:inline">{isSpeaking ? "Stopp" : ttsEnabled ? "TTS AN" : "TTS AUS"}</span>
            </Button>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-3 md:px-6 py-4" ref={scrollRef as React.RefObject<HTMLDivElement>}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-6 py-20">
              <JarvisOrb size={80} />
              <div className="text-center">
                <h3 className="font-jarvis text-2xl font-bold text-primary jarvis-glow-text mb-2">
                  Hallo{user?.name ? `, ${user.name}` : ""}
                </h3>
                <p className="text-muted-foreground">Wie kann ich dir heute helfen?</p>
              </div>
              <div className="grid grid-cols-2 gap-3 max-w-lg w-full">
                {["Erkläre mir Quantencomputing", "Schreibe eine E-Mail", "Analysiere diese Datei", "Suche aktuelle Neuigkeiten"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="text-left p-3 rounded-lg jarvis-card text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              {messages.map((msg, i) => (
                <div key={i} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                  {msg.role === "assistant" && (
                    <div className="flex-shrink-0 mt-1">
                      <JarvisOrb size={28} />
                    </div>
                  )}
                  <div className={cn(
                    "max-w-[75%] rounded-xl px-4 py-3 text-sm",
                    msg.role === "user"
                      ? "bg-primary/20 text-foreground border border-primary/30 ml-auto"
                      : "bg-card border border-border text-foreground"
                  )}>
                    {msg.fileName && (
                      <div className="flex items-center gap-2 mb-2 text-xs text-primary/80 border-b border-border pb-2">
                        <FileText size={12} />
                        {msg.fileName}
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
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Frag Jarvis etwas... (Enter zum Senden, Shift+Enter für neue Zeile)"
                className="min-h-[52px] max-h-[200px] resize-none bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50 pr-12"
                disabled={isStreaming}
              />
            </div>
            <div className="flex flex-col gap-1">
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.txt,.md,.doc,.docx,.png,.jpg,.jpeg,.webp" />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="h-8 w-8 text-muted-foreground hover:text-primary"
                title="Datei hochladen"
              >
                {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={transcribeMutation.isPending}
                className={cn("h-8 w-8", isRecording ? "text-destructive animate-pulse" : "text-muted-foreground hover:text-primary")}
                title={isRecording ? "Aufnahme stoppen" : "Spracheingabe"}
              >
                {transcribeMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : isRecording ? <MicOff size={14} /> : <Mic size={14} />}
              </Button>
              <Button
                size="icon"
                onClick={sendMessage}
                disabled={isStreaming || (!input.trim() && !uploadedFile)}
                className="h-8 w-8 bg-primary hover:bg-primary/90 text-primary-foreground jarvis-glow-sm"
              >
                {isStreaming ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
