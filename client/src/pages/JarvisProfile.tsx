import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User, Briefcase, MapPin, Heart, Brain, MessageSquare, Globe, Save, Loader2, Bot, Volume2, Play } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const addressOptions = [
  { value: "sir", label: "Sir / Ma'am (formell)", desc: "Jarvis spricht dich förmlich an" },
  { value: "du", label: "Du (persönlich)", desc: "Jarvis spricht dich persönlich an" },
  { value: "name", label: "Beim Namen", desc: "Jarvis nennt deinen Namen" },
];

const languageOptions = [
  { value: "de", label: "Deutsch", flag: "🇩🇪" },
  { value: "en", label: "Englisch", flag: "🇬🇧" },
  { value: "auto", label: "Automatisch", flag: "🌐" },
];

export default function JarvisProfile() {
  const { user } = useAuth();
  const { data: profile, isLoading } = trpc.profile.get.useQuery();
  const updateMutation = trpc.profile.update.useMutation({
    onSuccess: () => toast.success("Profil gespeichert – Jarvis kennt dich jetzt besser!"),
    onError: () => toast.error("Fehler beim Speichern"),
  });
  const utils = trpc.useUtils();
  const { data: voicesData } = trpc.elevenlabs.voices.useQuery();
  const ttsMutation = trpc.elevenlabs.tts.useMutation();
  const [previewVoiceId, setPreviewVoiceId] = useState<string | null>(null);

  const previewVoice = (voiceId: string, name: string) => {
    setPreviewVoiceId(voiceId);
    ttsMutation.mutate({ text: `Hallo, ich bin ${name}. Wie kann ich Ihnen helfen, Sir?`, voiceId }, {
      onSuccess: (data) => {
        try {
          const binary = atob(data.audio);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const blob = new Blob([bytes], { type: "audio/mpeg" });
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.onended = () => { URL.revokeObjectURL(url); setPreviewVoiceId(null); };
          audio.play().catch(() => setPreviewVoiceId(null));
        } catch { setPreviewVoiceId(null); }
      },
      onError: () => { setPreviewVoiceId(null); toast.error("Vorschau fehlgeschlagen"); },
    });
  };

  const [form, setForm] = useState({
    displayName: "",
    occupation: "",
    location: "",
    jarvisName: "Jarvis",
    addressForm: "sir" as "sir" | "du" | "name",
    interests: "",
    workContext: "",
    personalNotes: "",
    jarvisPersonality: "",
    language: "de" as "de" | "en" | "auto",
    elevenLabsVoiceId: "JBFqnCBsd6RMkjVDRZzb",
  });

  useEffect(() => {
    if (profile) {
      setForm({
        displayName: profile.displayName ?? "",
        occupation: profile.occupation ?? "",
        location: profile.location ?? "",
        jarvisName: profile.jarvisName ?? "Jarvis",
        addressForm: (profile.addressForm as "sir" | "du" | "name") ?? "sir",
        interests: profile.interests ?? "",
        workContext: profile.workContext ?? "",
        personalNotes: profile.personalNotes ?? "",
        jarvisPersonality: profile.jarvisPersonality ?? "",
        language: (profile.language as "de" | "en" | "auto") ?? "de",
        elevenLabsVoiceId: profile.elevenLabsVoiceId ?? "JBFqnCBsd6RMkjVDRZzb",
      });
    } else if (!isLoading && user) {
      // Standardwerte aus OAuth-Profil
      setForm(f => ({ ...f, displayName: user.name ?? "" }));
    }
  }, [profile, isLoading, user]);

  const handleSave = () => {
    updateMutation.mutate(form, {
      onSuccess: () => utils.profile.get.invalidate(),
    });
  };

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto px-4 md:px-8 py-6 max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
          <User size={24} className="text-primary" />
        </div>
        <div>
          <h1 className="font-jarvis text-xl font-bold text-primary">PROFIL & EINSTELLUNGEN</h1>
          <p className="text-sm text-muted-foreground">Hilf Jarvis dich besser kennenzulernen</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Persönliche Infos */}
        <section className="jarvis-card rounded-xl p-5 space-y-4">
          <h2 className="font-jarvis text-sm font-bold text-primary flex items-center gap-2">
            <User size={14} /> PERSÖNLICHE INFORMATIONEN
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Dein Name</Label>
              <Input value={form.displayName} onChange={set("displayName")} placeholder="Stefan" className="bg-input border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1"><Briefcase size={12} /> Beruf</Label>
              <Input value={form.occupation} onChange={set("occupation")} placeholder="z.B. Unternehmer, Entwickler..." className="bg-input border-border" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1"><MapPin size={12} /> Standort</Label>
              <Input value={form.location} onChange={set("location")} placeholder="z.B. Baar, Schweiz" className="bg-input border-border" />
            </div>
          </div>
        </section>

        {/* Jarvis-Verhalten */}
        <section className="jarvis-card rounded-xl p-5 space-y-4">
          <h2 className="font-jarvis text-sm font-bold text-primary flex items-center gap-2">
            <Bot size={14} /> JARVIS-VERHALTEN
          </h2>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Name des Assistenten</Label>
            <Input value={form.jarvisName} onChange={set("jarvisName")} placeholder="Jarvis" className="bg-input border-border" />
            <p className="text-xs text-muted-foreground">So nennt sich dein Assistent selbst</p>
          </div>

          {/* Anredeform */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1"><MessageSquare size={12} /> Anredeform</Label>
            <div className="grid grid-cols-1 gap-2">
              {addressOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setForm(f => ({ ...f, addressForm: opt.value as "sir" | "du" | "name" }))}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                    form.addressForm === opt.value
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border bg-transparent text-muted-foreground hover:border-primary/30"
                  )}
                >
                  <div className={cn("w-3 h-3 rounded-full border-2 flex-shrink-0", form.addressForm === opt.value ? "border-primary bg-primary" : "border-muted-foreground")} />
                  <div>
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs opacity-70">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Sprache */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1"><Globe size={12} /> Antwortsprache</Label>
            <div className="flex gap-2">
              {languageOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setForm(f => ({ ...f, language: opt.value as "de" | "en" | "auto" }))}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-1 p-3 rounded-lg border text-sm transition-all",
                    form.language === opt.value
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  )}
                >
                  <span className="text-lg">{opt.flag}</span>
                  <span className="text-xs">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Interessen & Kontext */}
        <section className="jarvis-card rounded-xl p-5 space-y-4">
          <h2 className="font-jarvis text-sm font-bold text-primary flex items-center gap-2">
            <Heart size={14} /> INTERESSEN & KONTEXT
          </h2>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Hobbys & Interessen</Label>
            <Textarea value={form.interests} onChange={set("interests")} placeholder="z.B. Technologie, Sport, Familie, Kochen..." className="bg-input border-border resize-none" rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1"><Briefcase size={12} /> Beruflicher Kontext</Label>
            <Textarea value={form.workContext} onChange={set("workContext")} placeholder="z.B. Ich führe ein Unternehmen im Bereich... Meine Hauptaufgaben sind..." className="bg-input border-border resize-none" rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Weitere persönliche Notizen</Label>
            <Textarea value={form.personalNotes} onChange={set("personalNotes")} placeholder="z.B. Ich habe zwei Kinder, lebe in der Schweiz, spreche Deutsch und Englisch..." className="bg-input border-border resize-none" rows={3} />
          </div>
        </section>

        {/* Jarvis-Persönlichkeit */}
        <section className="jarvis-card rounded-xl p-5 space-y-4">
          <h2 className="font-jarvis text-sm font-bold text-primary flex items-center gap-2">
            <Brain size={14} /> JARVIS-PERSÖNLICHKEIT
          </h2>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Wie soll sich Jarvis verhalten?</Label>
            <Textarea
              value={form.jarvisPersonality}
              onChange={set("jarvisPersonality")}
              placeholder="z.B. Sei direkt und präzise. Verwende technische Fachbegriffe. Mache gelegentlich einen trockenen Witz. Erinnere mich an wichtige Deadlines..."
              className="bg-input border-border resize-none"
              rows={4}
            />
            <p className="text-xs text-muted-foreground">Beschreibe in eigenen Worten wie Jarvis sich verhalten soll</p>
          </div>
        </section>


        {/* ElevenLabs Stimmen-Auswahl */}
        <section className="jarvis-card rounded-xl p-5 space-y-4">
          <h2 className="font-jarvis text-sm font-bold text-primary flex items-center gap-2">
            <Volume2 size={14} /> JARVIS-STIMME (ELEVENLABS)
          </h2>
          <p className="text-xs text-muted-foreground">Wähle die Stimme mit der Jarvis mit dir spricht. Klicke auf ▶ um eine Vorschau zu hören.</p>
          {!voicesData || voicesData.length === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><Loader2 size={12} className="animate-spin" /> Stimmen werden geladen...</div>
          ) : (
            <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1">
              {voicesData.map((v: { id: string; name: string; gender: string; accent: string; useCase: string }) => (
                <div
                  key={v.id}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all",
                    form.elevenLabsVoiceId === v.id
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setForm(f => ({ ...f, elevenLabsVoiceId: v.id }))}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{v.name}</p>
                    <p className="text-xs opacity-60">{v.accent ?? ""} {v.gender ?? ""} {v.useCase ? `· ${v.useCase}` : ""}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); previewVoice(v.id, v.name); }}
                    disabled={ttsMutation.isPending}
                    className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center hover:bg-primary/30 transition-all disabled:opacity-50"
                    title={`${v.name} anhören`}
                  >
                    {previewVoiceId === v.id ? <Loader2 size={12} className="animate-spin text-primary" /> : <Play size={11} className="text-primary ml-0.5" />}
                  </button>
                  {form.elevenLabsVoiceId === v.id && (
                    <span className="text-[10px] font-bold text-primary tracking-wider">AKTIV</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Speichern */}
        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-jarvis tracking-wider gap-2"
          size="lg"
        >
          {updateMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          PROFIL SPEICHERN
        </Button>
      </div>
    </div>
  );
}
