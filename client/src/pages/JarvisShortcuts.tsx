import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Smartphone, Copy, KeyRound, MessageCircle, AlarmClock, Timer, Loader2, Plus } from "lucide-react";
import { useState } from "react";

/**
 * Einrichtungsanleitung für die iOS-Kurzbefehle-App.
 * Jarvis legt Befehle in eine Warteschlange, der Kurzbefehl holt sie ab.
 */
export default function JarvisShortcuts() {
  const utils = trpc.useUtils();
  const { data: keys } = trpc.webhooks.listKeys.useQuery();
  const createKey = trpc.webhooks.createKey.useMutation({
    onSuccess: (r) => {
      setNewKey(r.apiKey);
      utils.webhooks.listKeys.invalidate();
      toast.success("Schlüssel erstellt");
    },
    onError: (e) => toast.error(e.message),
  });
  const [newKey, setNewKey] = useState<string | null>(null);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const activeKey = newKey ?? keys?.[0]?.apiKey ?? "DEIN_SCHLUESSEL";
  const fetchUrl = `${baseUrl}/api/device/commands?key=${activeKey}`;
  const doneUrl = `${baseUrl}/api/device/commands/done?key=${activeKey}`;

  const copy = (text: string, label = "Kopiert") => {
    navigator.clipboard.writeText(text);
    toast.success(label);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
      <div>
        <h1 className="font-jarvis text-2xl font-bold text-primary jarvis-glow-text">IPHONE-KURZBEFEHLE</h1>
        <p className="text-sm text-muted-foreground">
          Damit Jarvis WhatsApp-Nachrichten senden und Wecker stellen kann
        </p>
      </div>

      <Card className="p-4 space-y-3 border-primary/30">
        <div className="flex items-center gap-2 text-primary">
          <Smartphone size={16} />
          <h2 className="text-sm font-jarvis tracking-wide">WIE ES FUNKTIONIERT</h2>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Apple erlaubt es keiner Webseite, direkt auf WhatsApp oder die Uhr-App zuzugreifen. Der Weg
          führt über die Kurzbefehle-App: Jarvis legt deinen Befehl in eine Warteschlange, und ein
          Kurzbefehl auf dem iPhone holt ihn ab und führt ihn dort aus. Du startest den Kurzbefehl per
          Siri („Hey Siri, Jarvis"), über das Home-Bildschirm-Symbol oder automatisch per Zeitplan.
        </p>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-primary">
          <KeyRound size={16} />
          <h2 className="text-sm font-jarvis tracking-wide">SCHRITT 1 – API-SCHLÜSSEL</h2>
        </div>
        {(keys ?? []).length === 0 && !newKey ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Du brauchst einen Schlüssel, damit nur dein iPhone die Befehle abholen kann.
            </p>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={createKey.isPending}
              onClick={() => createKey.mutate({ label: "iPhone Kurzbefehle" })}
            >
              {createKey.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Schlüssel für iPhone erstellen
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Dein Schlüssel (in der URL unten bereits eingesetzt)</p>
            <div className="flex gap-2">
              <Input readOnly value={activeKey} className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => copy(activeKey)}>
                <Copy size={14} />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-primary">
          <MessageCircle size={16} />
          <h2 className="text-sm font-jarvis tracking-wide">SCHRITT 2 – KURZBEFEHL „JARVIS" ANLEGEN</h2>
        </div>

        <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
          <p>Öffne die <strong className="text-foreground">Kurzbefehle</strong>-App → Plus-Symbol → Aktion hinzufügen.</p>

          <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2">
            <p className="text-foreground font-medium">Aktion 1: Inhalt von URL abrufen</p>
            <p>Suche nach <span className="font-mono">Inhalt von URL abrufen</span> und füge die Aktion ein. Trage diese URL ein:</p>
            <div className="flex gap-2">
              <Input readOnly value={fetchUrl} className="font-mono text-[10px]" />
              <Button variant="outline" size="icon" onClick={() => copy(fetchUrl, "URL kopiert")}>
                <Copy size={14} />
              </Button>
            </div>
            <p>Methode bleibt <span className="font-mono">GET</span>.</p>
          </div>

          <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1.5">
            <p className="text-foreground font-medium">Aktion 2: Wörterbuchwert abrufen</p>
            <p>Schlüssel: <span className="font-mono">first</span> – aus dem Ergebnis der URL-Abfrage. Damit erhältst du den nächsten wartenden Befehl.</p>
          </div>

          <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1.5">
            <p className="text-foreground font-medium">Aktion 3: Wörterbuchwert abrufen</p>
            <p>Schlüssel: <span className="font-mono">type</span> – aus dem Wörterbuch von Aktion 2. Das ist die Art des Befehls.</p>
          </div>

          <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1.5">
            <p className="text-foreground font-medium">Aktion 4: Wenn (If)</p>
            <p>
              Bedingung: <span className="font-mono">type</span> ist <span className="font-mono">whatsapp</span>
            </p>
            <p className="pl-3">
              → Wörterbuchwert <span className="font-mono">recipient</span> und <span className="font-mono">message</span> abrufen<br />
              → Aktion <span className="font-mono">Nachricht senden</span> mit App <span className="font-mono">WhatsApp</span>,
              Empfänger = recipient, Text = message
            </p>
            <p className="pt-1">
              <strong className="text-foreground">Sonst wenn</strong> <span className="font-mono">type</span> ist <span className="font-mono">alarm</span>:
            </p>
            <p className="pl-3">
              → Wörterbuchwert <span className="font-mono">time</span> abrufen<br />
              → Aktion <span className="font-mono">Wecker erstellen</span> mit dieser Uhrzeit
            </p>
            <p className="pt-1">
              <strong className="text-foreground">Sonst wenn</strong> <span className="font-mono">type</span> ist <span className="font-mono">timer</span>:
            </p>
            <p className="pl-3">
              → Wörterbuchwert <span className="font-mono">minutes</span> abrufen<br />
              → Aktion <span className="font-mono">Timer starten</span> über diese Minuten
            </p>
            <p className="pt-1">
              <strong className="text-foreground">Sonst wenn</strong> <span className="font-mono">type</span> ist <span className="font-mono">reminder</span>:
            </p>
            <p className="pl-3">
              → Wörterbuchwert <span className="font-mono">message</span> abrufen<br />
              → Aktion <span className="font-mono">Erinnerung hinzufügen</span>
            </p>
          </div>

          <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2">
            <p className="text-foreground font-medium">Aktion 5 (optional): Rückmeldung senden</p>
            <p>
              Ganz am Ende noch eine <span className="font-mono">Inhalt von URL abrufen</span>-Aktion mit Methode
              <span className="font-mono"> POST</span>, Anfragetext <span className="font-mono">JSON</span> und dem Feld
              <span className="font-mono"> id</span> (Wert = <span className="font-mono">id</span> aus Aktion 2):
            </p>
            <div className="flex gap-2">
              <Input readOnly value={doneUrl} className="font-mono text-[10px]" />
              <Button variant="outline" size="icon" onClick={() => copy(doneUrl, "URL kopiert")}>
                <Copy size={14} />
              </Button>
            </div>
            <p>Damit wird der Befehl in Jarvis als „erledigt" markiert.</p>
          </div>

          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-1.5">
            <p className="text-foreground font-medium">Schritt 3 – Kurzbefehl benennen und starten</p>
            <p>
              Nenne den Kurzbefehl <strong className="text-foreground">Jarvis</strong>. Dann kannst du ihn mit
              „Hey Siri, Jarvis" starten. Für automatischen Abruf: Kurzbefehle-App → Automation →
              Neue Automation → Tageszeit oder „Wenn ich das iPhone entsperre" → Kurzbefehl ausführen.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-primary">
          <AlarmClock size={16} />
          <h2 className="text-sm font-jarvis tracking-wide">BEISPIEL-BEFEHLE FÜR JARVIS</h2>
        </div>
        <div className="space-y-2 text-xs">
          {[
            { icon: MessageCircle, text: "Schreibe Bine auf WhatsApp, dass ich später komme" },
            { icon: AlarmClock, text: "Stelle mir einen Wecker auf 06:30" },
            { icon: Timer, text: "Starte einen Timer über 15 Minuten" },
            { icon: MessageCircle, text: "Erinnere mich um 14:00 an die Rechnung Muster AG" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2.5 rounded-md border border-border p-2.5">
              <Icon size={14} className="text-primary flex-shrink-0" />
              <span className="text-muted-foreground">„{text}"</span>
            </div>
          ))}
        </div>
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="text-xs text-amber-200/80">
            <Badge variant="outline" className="mr-2 text-[10px] border-amber-500/40 text-amber-400">Hinweis</Badge>
            Die Befehle werden ausgeführt, sobald der Kurzbefehl auf dem iPhone läuft – nicht sofort.
            Für zeitkritische Dinge starte den Kurzbefehl per Siri direkt nach dem Auftrag an Jarvis.
          </p>
        </div>
      </Card>
    </div>
  );
}
