import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { JarvisOrb } from "@/components/JarvisLayout";
import {
  CalendarDays,
  Check,
  ChevronRight,
  Loader2,
  Volume2,
  User,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "jarvis_onboarding_done";

export default function OnboardingWizard() {
  const utils = trpc.useUtils();
  const { data: profile, isLoading } = trpc.profile.get.useQuery();
  const { data: calStatus } = trpc.calendar.getStatus.useQuery(undefined, {
    retry: false,
  });
  const { data: authUrlData } = trpc.calendar.getAuthUrl.useQuery(undefined, {
    retry: false,
  });
  const { data: msAuthUrlData } = trpc.calendar.getMsAuthUrl.useQuery(
    undefined,
    {
      retry: false,
    }
  );
  const { data: voices } = trpc.elevenlabs.voices.useQuery(undefined, {
    retry: false,
  });
  const saveProfile = trpc.profile.update.useMutation({
    onSuccess: () => utils.profile.get.invalidate(),
  });
  const ttsMutation = trpc.elevenlabs.tts.useMutation();
  const seedTemplates = trpc.templates.seedStarters.useMutation();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const [displayName, setDisplayName] = useState("");
  const [occupation, setOccupation] = useState("");
  const [location, setLocation] = useState("");
  const [addressForm, setAddressForm] = useState<"sir" | "du" | "name">("sir");
  const [voiceId, setVoiceId] = useState("JBFqnCBsd6RMkjVDRZzb");
  const [workContext, setWorkContext] = useState("");

  // Wizard nur beim ersten Start zeigen (kein Profil-Name gesetzt und nicht abgeschlossen)
  useEffect(() => {
    if (isLoading) return;
    const done = localStorage.getItem(STORAGE_KEY) === "1";
    if (done) return;
    if (!profile?.displayName) {
      setOpen(true);
    } else {
      localStorage.setItem(STORAGE_KEY, "1");
    }
  }, [isLoading, profile]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName ?? "");
      setOccupation(profile.occupation ?? "");
      setLocation(profile.location ?? "");
      setAddressForm((profile.addressForm as "sir" | "du" | "name") ?? "sir");
      setVoiceId(profile.elevenLabsVoiceId ?? "JBFqnCBsd6RMkjVDRZzb");
      setWorkContext(profile.workContext ?? "");
    }
  }, [profile]);

  const finish = async () => {
    try {
      await saveProfile.mutateAsync({
        displayName: displayName || undefined,
        occupation: occupation || undefined,
        location: location || undefined,
        addressForm,
        elevenLabsVoiceId: voiceId,
        workContext: workContext || undefined,
      });
      seedTemplates.mutate();
      localStorage.setItem(STORAGE_KEY, "1");
      toast.success("Jarvis ist eingerichtet");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    }
  };

  const skip = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };

  const previewVoice = () => {
    ttsMutation.mutate(
      {
        text: `Guten Tag${displayName ? ` ${displayName}` : ""}. Ich bin Jarvis und stehe ab jetzt zu Ihrer Verfügung.`,
        voiceId,
      },
      {
        onSuccess: data => {
          const binary = atob(data.audio);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++)
            bytes[i] = binary.charCodeAt(i);
          const url = URL.createObjectURL(
            new Blob([bytes], { type: "audio/mpeg" })
          );
          new Audio(url).play().catch(() => undefined);
        },
        onError: () => toast.error("Vorschau nicht möglich"),
      }
    );
  };

  const steps = [
    {
      icon: Sparkles,
      title: "Willkommen bei Jarvis",
      body: (
        <div className="space-y-4 text-center">
          <JarvisOrb size={80} />
          <p className="text-sm text-muted-foreground">
            In drei kurzen Schritten ist Jarvis auf dich eingestellt: Profil,
            Kalender und Stimme. Danach kannst du sofort per Text oder Sprache
            mit ihm arbeiten.
          </p>
        </div>
      ),
    },
    {
      icon: User,
      title: "Wer bist du?",
      body: (
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Name</label>
            <Input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="z.B. Stefan"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              Beruf / Rolle
            </label>
            <Input
              value={occupation}
              onChange={e => setOccupation(e.target.value)}
              placeholder="z.B. Leiter ICT"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Wohnort</label>
            <Input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="z.B. Baar"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              Wie soll Jarvis dich ansprechen?
            </label>
            <Select
              value={addressForm}
              onValueChange={v => setAddressForm(v as "sir" | "du" | "name")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sir">Sir (wie im Film)</SelectItem>
                <SelectItem value="du">Beim Vornamen, du</SelectItem>
                <SelectItem value="name">Beim Namen, Sie</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              Beruflicher Kontext (optional)
            </label>
            <Textarea
              value={workContext}
              onChange={e => setWorkContext(e.target.value)}
              rows={3}
              placeholder="z.B. zwei Tage Homeoffice, drei Tage in Baar, eigenes Geschäft Gross ICT"
            />
          </div>
        </div>
      ),
    },
    {
      icon: CalendarDays,
      title: "Kalender verbinden",
      body: (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Mit dem Google Kalender kann Jarvis Termine lesen, erstellen und
            dich morgens über den Tag informieren.
          </p>
          {calStatus?.connected ? (
            <div className="flex flex-col gap-2">
              {calStatus.googleConnected && (
                <div className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 p-3 text-sm text-primary">
                  <Check size={16} /> Google Kalender verbunden
                  {calStatus.googleEmail ? ` (${calStatus.googleEmail})` : ""}
                </div>
              )}
              {calStatus.msConnected && (
                <div className="flex items-center gap-2 rounded-md border border-[#00a4ef]/40 bg-[#00a4ef]/10 p-3 text-sm text-[#00a4ef]">
                  <Check size={16} /> Microsoft Kalender verbunden
                  {calStatus.msEmail ? ` (${calStatus.msEmail})` : ""}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => {
                  if (authUrlData?.url) window.location.href = authUrlData.url;
                  else toast.error("Google-Link nicht verfügbar");
                }}
              >
                <CalendarDays size={15} /> Google Kalender verbinden
              </Button>
              <Button
                variant="outline"
                className="w-full gap-2 border-[#00a4ef]/40 text-[#00a4ef] hover:bg-[#00a4ef]/10 hover:text-[#00a4ef]"
                onClick={() => {
                  if (msAuthUrlData?.url)
                    window.location.href = msAuthUrlData.url;
                  else toast.error("Microsoft-Link nicht verfügbar");
                }}
              >
                <CalendarDays size={15} /> Microsoft Kalender verbinden
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Du kannst diesen Schritt auch später im Bereich Kalender erledigen.
          </p>
        </div>
      ),
    },
    {
      icon: Volume2,
      title: "Stimme wählen",
      body: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            So klingt Jarvis, wenn er mit dir spricht. Du kannst die Stimme
            jederzeit im Profil ändern.
          </p>
          <Select value={voiceId} onValueChange={setVoiceId}>
            <SelectTrigger>
              <SelectValue placeholder="Stimme wählen" />
            </SelectTrigger>
            <SelectContent>
              {(
                voices ?? [
                  {
                    id: "JBFqnCBsd6RMkjVDRZzb",
                    name: "George (britisch, männlich)",
                  },
                ]
              ).map(v => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={previewVoice}
            disabled={ttsMutation.isPending}
          >
            {ttsMutation.isPending ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Volume2 size={15} />
            )}
            Stimme anhören
          </Button>
        </div>
      ),
    },
  ];

  const current = steps[step];
  const Icon = current.icon;

  return (
    <Dialog
      open={open}
      onOpenChange={o => {
        if (!o) skip();
      }}
    >
      <DialogContent className="max-w-md">
        <div className="space-y-5">
          <div className="flex items-center gap-2 text-primary">
            <Icon size={18} />
            <h2 className="font-jarvis text-lg font-bold tracking-wide">
              {current.title}
            </h2>
          </div>

          {current.body}

          <div className="flex items-center justify-center gap-1.5">
            {steps.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === step ? "w-6 bg-primary" : "w-1.5 bg-muted"
                )}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={skip}
              className="text-muted-foreground"
            >
              Später
            </Button>
            <div className="flex gap-2">
              {step > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStep(s => s - 1)}
                >
                  Zurück
                </Button>
              )}
              {step < steps.length - 1 ? (
                <Button
                  size="sm"
                  onClick={() => setStep(s => s + 1)}
                  className="gap-1.5"
                >
                  Weiter <ChevronRight size={14} />
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={finish}
                  disabled={saveProfile.isPending}
                  className="gap-1.5"
                >
                  {saveProfile.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  Fertig
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
