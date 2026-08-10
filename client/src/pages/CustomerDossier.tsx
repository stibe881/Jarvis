import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Building2,
  Mail,
  Phone,
  MapPin,
  Ticket,
  FileText,
  Receipt,
  FolderKanban,
  FileSignature,
  AlertTriangle,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";

const chf = (n: number) =>
  `CHF ${n.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const dateStr = (v: unknown) => {
  if (typeof v !== "string") return "–";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "–" : d.toLocaleDateString("de-CH");
};

const statusColor = (status: string) => {
  const s = status.toLowerCase();
  if (["paid", "closed", "completed", "won", "accepted"].includes(s))
    return "border-green-500/40 text-green-400";
  if (["open", "sent", "active", "in_progress", "new"].includes(s))
    return "border-primary/40 text-primary";
  if (["draft", "on_hold", "contacted"].includes(s))
    return "border-muted-foreground/40 text-muted-foreground";
  if (["overdue", "rejected", "lost", "cancelled"].includes(s))
    return "border-destructive/40 text-destructive";
  return "border-border text-muted-foreground";
};

/** Kunden-Dossier: alle Informationen zu einem Kunden auf einer Seite. */
export default function CustomerDossier() {
  const [location] = useLocation();

  // Deep-Link: /customer?id=<uuid>&name=<Anzeigename> öffnet das Dossier direkt.
  // Wird aus der Kundenliste in «Meine App» verwendet.
  const params = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const linkedId = params.get("id");
  const linkedName = params.get("name");

  const [query, setQuery] = useState(linkedName ?? "");
  const [submitted, setSubmitted] = useState<string | null>(linkedId ?? null);

  // Auf Navigation innerhalb der App reagieren (z.B. zweiter Klick aus der Liste)
  useEffect(() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    const next = new URLSearchParams(search);
    const id = next.get("id");
    const name = next.get("name");
    if (id) {
      setSubmitted(id);
      setQuery(name ?? "");
    }
  }, [location]);

  const { data: customers } = trpc.appDashboard.customers.useQuery(
    { search: query.length >= 2 ? query : undefined, limit: 8 },
    { enabled: query.length >= 2 && !submitted }
  );

  const {
    data: dossier,
    isLoading,
    isError,
  } = trpc.appDashboard.customerDossier.useQuery(
    { idOrName: submitted ?? "" },
    { enabled: !!submitted }
  );

  const stats = dossier?.stats;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
      <div>
        <h1 className="font-jarvis text-2xl font-bold text-primary jarvis-glow-text">
          KUNDEN-DOSSIER
        </h1>
        <p className="text-sm text-muted-foreground">
          Alle Informationen zu einem Kunden auf einen Blick – ideal zur
          Vorbereitung von Gesprächen
        </p>
      </div>

      {/* Suche */}
      <Card className="p-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              className="pl-9"
              placeholder="Kundenname eingeben, z.B. Muster AG"
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setSubmitted(null);
              }}
              onKeyDown={e => {
                if (e.key === "Enter" && query.trim())
                  setSubmitted(query.trim());
              }}
            />
          </div>
          <Button
            disabled={!query.trim()}
            onClick={() => setSubmitted(query.trim())}
          >
            Dossier laden
          </Button>
        </div>

        {/* Vorschläge während der Eingabe */}
        {!submitted && (customers ?? []).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {(customers as Record<string, string>[]).map(c => {
              const label =
                c.company_name ||
                `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() ||
                "Unbekannt";
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setQuery(label);
                    setSubmitted(c.id);
                  }}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {isLoading && submitted && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map(i => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </div>
      )}

      {isError && (
        <Card className="p-4">
          <p className="text-sm text-destructive">
            Das Dossier konnte nicht geladen werden. Bitte erneut versuchen.
          </p>
        </Card>
      )}

      {submitted && !isLoading && !dossier && (
        <Card className="p-6 text-center">
          <Building2 size={28} className="mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Kein Kunde gefunden, der zu „{submitted}" passt.
          </p>
        </Card>
      )}

      {dossier && stats && (
        <div className="space-y-5">
          {/* Kopf mit Stammdaten */}
          <Card className="p-5 border-primary/30">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="font-jarvis text-xl text-primary">
                  {dossier.label}
                </h2>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {typeof dossier.customer.email === "string" &&
                    dossier.customer.email && (
                      <span className="flex items-center gap-1.5">
                        <Mail size={12} /> {dossier.customer.email}
                      </span>
                    )}
                  {typeof dossier.customer.phone === "string" &&
                    dossier.customer.phone && (
                      <span className="flex items-center gap-1.5">
                        <Phone size={12} /> {dossier.customer.phone}
                      </span>
                    )}
                  {typeof dossier.customer.city === "string" &&
                    dossier.customer.city && (
                      <span className="flex items-center gap-1.5">
                        <MapPin size={12} />{" "}
                        {String(dossier.customer.postal_code ?? "")}{" "}
                        {dossier.customer.city}
                      </span>
                    )}
                </div>
              </div>
              {stats.overdueCount > 0 && (
                <Badge
                  variant="outline"
                  className="gap-1.5 border-destructive/40 text-destructive"
                >
                  <AlertTriangle size={12} /> {stats.overdueCount} überfällig
                </Badge>
              )}
            </div>
          </Card>

          {/* Kennzahlen */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Offene Rechnungen",
                value: chf(stats.openInvoiceAmount),
                sub: `${stats.openInvoiceCount} Stück`,
                icon: Receipt,
                warn: stats.overdueCount > 0,
              },
              {
                label: "Bezahlter Umsatz",
                value: chf(stats.revenueTotal),
                sub: "gesamt",
                icon: TrendingUp,
              },
              {
                label: "Offene Angebote",
                value: chf(stats.openQuoteAmount),
                sub: `${stats.openQuoteCount} Stück`,
                icon: FileText,
              },
              {
                label: "Offene Tickets",
                value: String(stats.openTickets),
                sub: `${stats.totalTickets} insgesamt`,
                icon: Ticket,
              },
            ].map(({ label, value, sub, icon: Icon, warn }) => (
              <Card
                key={label}
                className={warn ? "p-4 border-destructive/30" : "p-4"}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <Icon
                    size={14}
                    className={warn ? "text-destructive" : "text-primary"}
                  />
                </div>
                <p
                  className={
                    warn
                      ? "mt-1.5 text-lg font-semibold text-destructive"
                      : "mt-1.5 text-lg font-semibold text-foreground"
                  }
                >
                  {value}
                </p>
                <p className="text-[10px] text-muted-foreground">{sub}</p>
              </Card>
            ))}
          </div>

          {/* Listen */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <Ticket size={15} />
                <h3 className="text-sm font-jarvis tracking-wide">TICKETS</h3>
                <Badge variant="outline" className="ml-auto text-[10px]">
                  {dossier.tickets.length}
                </Badge>
              </div>
              {dossier.tickets.length === 0 && (
                <p className="text-xs text-muted-foreground">Keine Tickets.</p>
              )}
              {dossier.tickets.slice(0, 8).map((t, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 rounded-md border border-border p-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">
                      {String(t.title ?? "Ohne Titel")}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {dateStr(t.created_at)}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`flex-shrink-0 text-[10px] ${statusColor(String(t.status ?? ""))}`}
                  >
                    {String(t.status ?? "?")}
                  </Badge>
                </div>
              ))}
            </Card>

            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <Receipt size={15} />
                <h3 className="text-sm font-jarvis tracking-wide">
                  RECHNUNGEN
                </h3>
                <Badge variant="outline" className="ml-auto text-[10px]">
                  {dossier.invoices.length}
                </Badge>
              </div>
              {dossier.invoices.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Keine Rechnungen.
                </p>
              )}
              {dossier.invoices.slice(0, 8).map((inv, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 rounded-md border border-border p-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">
                      {String(inv.invoice_number ?? inv.number ?? "Rechnung")}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      fällig {dateStr(inv.due_date)}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`flex-shrink-0 text-[10px] ${statusColor(String(inv.status ?? ""))}`}
                  >
                    {String(inv.status ?? "?")}
                  </Badge>
                </div>
              ))}
            </Card>

            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <FileText size={15} />
                <h3 className="text-sm font-jarvis tracking-wide">ANGEBOTE</h3>
                <Badge variant="outline" className="ml-auto text-[10px]">
                  {dossier.quotes.length}
                </Badge>
              </div>
              {dossier.quotes.length === 0 && (
                <p className="text-xs text-muted-foreground">Keine Angebote.</p>
              )}
              {dossier.quotes.slice(0, 8).map((q, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 rounded-md border border-border p-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">
                      {String(
                        q.quote_number ?? q.number ?? q.notes ?? "Angebot"
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {dateStr(q.created_at)}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`flex-shrink-0 text-[10px] ${statusColor(String(q.status ?? ""))}`}
                  >
                    {String(q.status ?? "?")}
                  </Badge>
                </div>
              ))}
            </Card>

            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <FolderKanban size={15} />
                <h3 className="text-sm font-jarvis tracking-wide">
                  PROJEKTE & VERTRÄGE
                </h3>
              </div>
              {dossier.projects.length === 0 &&
                dossier.contracts.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Keine Projekte oder Verträge.
                  </p>
                )}
              {dossier.projects.slice(0, 5).map((p, i) => (
                <div
                  key={`p${i}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-border p-2.5"
                >
                  <p className="truncate text-xs font-medium">
                    {String(p.title ?? p.name ?? "Projekt")}
                  </p>
                  <Badge
                    variant="outline"
                    className={`flex-shrink-0 text-[10px] ${statusColor(String(p.status ?? ""))}`}
                  >
                    {String(p.status ?? "?")}
                  </Badge>
                </div>
              ))}
              {dossier.contracts.slice(0, 5).map((v, i) => (
                <div
                  key={`v${i}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-border p-2.5"
                >
                  <p className="flex min-w-0 items-center gap-1.5 truncate text-xs font-medium">
                    <FileSignature
                      size={11}
                      className="flex-shrink-0 text-muted-foreground"
                    />
                    {String(v.title ?? v.name ?? "Vertrag")}
                  </p>
                  <Badge
                    variant="outline"
                    className={`flex-shrink-0 text-[10px] ${statusColor(String(v.status ?? ""))}`}
                  >
                    {String(v.status ?? "?")}
                  </Badge>
                </div>
              ))}
            </Card>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Tipp: Frage Jarvis im Chat „Erzähl mir alles über {dossier.label}"
            für eine gesprochene Lagebeurteilung.
          </p>
        </div>
      )}

      {!submitted && !isLoading && (
        <Card className="p-8 text-center">
          <Building2
            size={32}
            className="mx-auto mb-3 text-muted-foreground/60"
          />
          <p className="text-sm text-muted-foreground">
            Gib einen Kundennamen ein, um das vollständige Dossier zu laden.
          </p>
        </Card>
      )}
    </div>
  );
}
