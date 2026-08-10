import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Mic,
  Square,
  Trash2,
  Loader2,
  StickyNote,
  CheckSquare,
} from "lucide-react";
import { useRef, useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

export default function JarvisVoiceNotes() {
  const utils = trpc.useUtils();
  const { data: notes, isLoading } = trpc.voiceNotes.list.useQuery();
  const recordMutation = trpc.voiceNotes.record.useMutation({
    onSuccess: r => {
      if (!r.transcript) {
        toast.error("Es wurde nichts erkannt");
        return;
      }
      const extras: string[] = [];
      if (r.createdNote) extras.push("Notiz erstellt");
      if (r.createdTask) extras.push("Aufgabe erstellt");
      toast.success(
        `Sprachnotiz gespeichert${extras.length ? ` (${extras.join(", ")})` : ""}`
      );
      utils.voiceNotes.list.invalidate();
    },
    onError: e => toast.error(`Fehler: ${e.message}`),
  });
  const removeMutation = trpc.voiceNotes.remove.useMutation({
    onSuccess: () => utils.voiceNotes.list.invalidate(),
  });

  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsRef = useRef(0);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    []
  );

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const duration = secondsRef.current;
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(",")[1] ?? "";
          if (!base64) {
            toast.error("Aufnahme leer");
            return;
          }
          recordMutation.mutate({
            audioBase64: base64,
            mimeType: "audio/webm",
            durationSec: duration,
          });
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setSeconds(0);
      secondsRef.current = 0;
      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setSeconds(secondsRef.current);
      }, 1000);
    } catch {
      toast.error("Mikrofon-Zugriff nicht möglich");
    }
  }, [recordMutation]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
      <div>
        <h1 className="font-jarvis text-2xl font-bold text-primary jarvis-glow-text">
          SPRACHNOTIZEN
        </h1>
        <p className="text-sm text-muted-foreground">
          Einfach reden – Jarvis transkribiert, fasst zusammen und legt bei
          Bedarf automatisch eine Aufgabe an
        </p>
      </div>

      <Card className="p-6 flex flex-col items-center gap-4">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={recordMutation.isPending}
          className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center border-2 transition-all active:scale-95 duration-150",
            isRecording
              ? "bg-destructive/20 border-destructive text-destructive animate-pulse"
              : "bg-primary/15 border-primary/50 text-primary hover:bg-primary/25"
          )}
        >
          {recordMutation.isPending ? (
            <Loader2 size={28} className="animate-spin" />
          ) : isRecording ? (
            <Square size={26} />
          ) : (
            <Mic size={28} />
          )}
        </button>
        <p className="text-sm text-muted-foreground">
          {recordMutation.isPending
            ? "Wird transkribiert und analysiert…"
            : isRecording
              ? `Aufnahme läuft – ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
              : "Tippe zum Aufnehmen"}
        </p>
      </Card>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Lade Sprachnotizen…</p>
      )}

      {!isLoading && (notes ?? []).length === 0 && (
        <Card className="p-8 text-center">
          <Mic className="mx-auto text-muted-foreground mb-3" size={30} />
          <p className="text-sm text-muted-foreground">
            Noch keine Sprachnotizen aufgenommen.
          </p>
        </Card>
      )}

      <div className="space-y-3">
        {(notes ?? []).map(n => (
          <Card key={n.id} className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {n.category}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(n.createdAt).toLocaleString("de-CH", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {n.noteId && (
                  <span className="text-[10px] text-primary flex items-center gap-1">
                    <StickyNote size={11} /> Notiz
                  </span>
                )}
                {n.taskId && (
                  <span className="text-[10px] text-primary flex items-center gap-1">
                    <CheckSquare size={11} /> Aufgabe
                  </span>
                )}
              </div>
              <button
                onClick={() => removeMutation.mutate({ id: n.id })}
                className="text-muted-foreground hover:text-destructive flex-shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
            {n.summary && <p className="text-sm font-medium">{n.summary}</p>}
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">
              {n.transcript}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
