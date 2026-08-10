import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Users,
  Ticket,
  FileText,
  Receipt,
  FolderKanban,
  Target,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

// ── Typen ─────────────────────────────────────────────────────────────────────
type Customer = {
  id: string;
  company_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  status?: string;
};
type Ticket = {
  id: string;
  title: string;
  status: string;
  priority: string;
  _customer?: string;
  created_at: string;
};
type Quote = {
  id: string;
  quote_number: string;
  status: string;
  total?: number;
  _customer?: string;
  quote_date: string;
};
type Invoice = {
  id: string;
  invoice_number: string;
  status: string;
  total?: number;
  _customer?: string;
  due_date?: string;
};
type Project = {
  id: string;
  project_number: string;
  title: string;
  status: string;
  budget?: number;
};
type Lead = {
  id: string;
  name: string;
  company?: string;
  status: string;
  value?: number;
};
type Contract = {
  id: string;
  contract_number?: string;
  title: string;
  status: string;
  amount?: number;
  _customer?: string;
  end_date?: string;
  billing_cycle?: string;
};
type Expense = {
  id: string;
  description: string;
  amount: number;
  category?: string;
  expense_date: string;
  supplier?: string;
};
type Product = {
  id: string;
  name: string;
  price: number;
  unit?: string;
  category?: string;
  description?: string;
};

const PRIORITY_ICON: Record<string, string> = {
  high: "🔴",
  medium: "🟡",
  low: "🟢",
};

/** Kundenname als Verweis aufs Dossier – öffnet mit einem Klick alle Informationen. */
function CustomerLink({
  name,
  onOpen,
}: {
  name?: string;
  onOpen: (name?: string) => void;
}) {
  if (!name) return <>–</>;
  return (
    <button
      onClick={e => {
        e.stopPropagation();
        onOpen(name);
      }}
      className="underline decoration-dotted underline-offset-2 transition-colors hover:text-primary"
      title={`Dossier von ${name} öffnen`}
    >
      {name}
    </button>
  );
}
const STATUS_COLOR: Record<string, string> = {
  open: "text-blue-400",
  closed: "text-muted-foreground",
  draft: "text-amber-400",
  sent: "text-blue-400",
  accepted: "text-green-400",
  rejected: "text-red-400",
  paid: "text-green-400",
  unpaid: "text-amber-400",
  overdue: "text-red-400",
  active: "text-green-400",
  completed: "text-muted-foreground",
  new: "text-blue-400",
};

function StatCard({
  icon: Icon,
  label,
  value,
  color = "text-primary",
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <div className="jarvis-card rounded-xl p-4 border border-border flex items-center gap-3">
      <div
        className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center bg-current/10",
          color
            .replace("text-", "bg-")
            .replace("-400", "-400/10")
            .replace("-500", "-500/10")
        )}
      >
        <Icon size={20} className={color} />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

const TABS = [
  { id: "overview", label: "Übersicht" },
  { id: "tickets", label: "Tickets" },
  { id: "quotes", label: "Angebote" },
  { id: "invoices", label: "Rechnungen" },
  { id: "projects", label: "Projekte" },
  { id: "leads", label: "Leads" },
  { id: "customers", label: "Kunden" },
  { id: "contracts", label: "Verträge" },
  { id: "expenses", label: "Ausgaben" },
  { id: "products", label: "Produkte" },
];

export default function AppDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [customerSearch, setCustomerSearch] = useState("");
  const [, navigate] = useLocation();

  /** Öffnet das Kunden-Dossier mit einem Klick aus der Kundenliste. */
  const openDossier = (id: string, label: string) => {
    navigate(
      `/customer?id=${encodeURIComponent(id)}&name=${encodeURIComponent(label)}`
    );
  };

  /** Öffnet das Dossier anhand des Kundennamens (aus Ticket-, Rechnungs- oder Angebotslisten). */
  const openDossierByName = (name?: string) => {
    if (!name || name === "–") return;
    navigate(
      `/customer?id=${encodeURIComponent(name)}&name=${encodeURIComponent(name)}`
    );
  };

  const summary = trpc.appDashboard.summary.useQuery();
  const tickets = trpc.appDashboard.tickets.useQuery(
    { status: undefined },
    { enabled: activeTab === "tickets" }
  );
  const quotes = trpc.appDashboard.quotes.useQuery(
    { status: undefined },
    { enabled: activeTab === "quotes" }
  );
  const invoices = trpc.appDashboard.invoices.useQuery(
    { status: undefined },
    { enabled: activeTab === "invoices" }
  );
  const overdueInvoices = trpc.appDashboard.overdueInvoices.useQuery(
    undefined,
    { enabled: activeTab === "invoices" }
  );
  const projects = trpc.appDashboard.projects.useQuery(
    { status: undefined },
    { enabled: activeTab === "projects" }
  );
  const leads = trpc.appDashboard.leads.useQuery(
    { status: undefined },
    { enabled: activeTab === "leads" }
  );
  const customers = trpc.appDashboard.customers.useQuery(
    { search: customerSearch || undefined },
    { enabled: activeTab === "customers" }
  );
  const contracts = trpc.appDashboard.contracts.useQuery(
    { status: undefined },
    { enabled: activeTab === "contracts" }
  );
  const expenses = trpc.appDashboard.expenses.useQuery(undefined, {
    enabled: activeTab === "expenses",
  });
  const products = trpc.appDashboard.products.useQuery(undefined, {
    enabled: activeTab === "products",
  });

  const s = summary.data;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 border border-green-500/40 flex items-center justify-center">
              <FolderKanban size={20} className="text-green-400" />
            </div>
            <div>
              <h1 className="font-jarvis text-lg font-bold text-green-400">
                GROSS ICT APP
              </h1>
              <p className="text-xs text-muted-foreground">
                ERP · CRM · Ticketing · Live-Daten
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1 text-xs"
            onClick={() => summary.refetch()}
          >
            <RefreshCw
              size={12}
              className={summary.isFetching ? "animate-spin" : ""}
            />{" "}
            Aktualisieren
          </Button>
        </div>
        <div className="flex gap-1 flex-wrap">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                activeTab === id
                  ? "bg-green-500/20 border border-green-500/40 text-green-400"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 md:px-6 py-4 space-y-4">
        {/* Übersicht */}
        {activeTab === "overview" && (
          <>
            {summary.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <StatCard
                  icon={Users}
                  label="Kunden"
                  value={s?.customers ?? 0}
                  color="text-blue-400"
                />
                <StatCard
                  icon={Ticket}
                  label="Offene Tickets"
                  value={s?.openTickets ?? 0}
                  color="text-amber-400"
                />
                <StatCard
                  icon={FileText}
                  label="Offene Angebote"
                  value={s?.openQuotes ?? 0}
                  color="text-purple-400"
                />
                <StatCard
                  icon={AlertTriangle}
                  label="Überfällige Rechnungen"
                  value={s?.overdueInvoices ?? 0}
                  color="text-red-400"
                />
                <StatCard
                  icon={FolderKanban}
                  label="Aktive Projekte"
                  value={s?.activeProjects ?? 0}
                  color="text-green-400"
                />
                <StatCard
                  icon={Target}
                  label="Neue Leads"
                  value={s?.newLeads ?? 0}
                  color="text-cyan-400"
                />
              </div>
            )}
            {s && s.overdueInvoices > 0 && (
              <div className="jarvis-card rounded-xl p-3 border border-red-500/30 bg-red-500/5 flex items-center gap-2">
                <AlertTriangle
                  size={16}
                  className="text-red-400 flex-shrink-0"
                />
                <p className="text-sm text-red-300">
                  {s.overdueInvoices} überfällige Rechnung
                  {s.overdueInvoices > 1 ? "en" : ""} – Total: CHF{" "}
                  {s.overdueTotal.toLocaleString("de-CH")}
                </p>
              </div>
            )}
          </>
        )}

        {/* Tickets */}
        {activeTab === "tickets" && (
          <div className="space-y-2">
            {tickets.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-primary" />
              </div>
            ) : (
              ((tickets.data as Ticket[]) ?? []).map(t => (
                <div
                  key={t.id}
                  className="jarvis-card rounded-xl p-3 border border-border"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-sm">
                      {PRIORITY_ICON[t.priority] ?? "⚪"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground">
                        {t.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <CustomerLink
                          name={t._customer}
                          onOpen={openDossierByName}
                        />{" "}
                        ·{" "}
                        <span className={STATUS_COLOR[t.status] ?? ""}>
                          {t.status}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
            {!tickets.isLoading &&
              ((tickets.data as Ticket[]) ?? []).length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-8">
                  Keine Tickets gefunden.
                </p>
              )}
          </div>
        )}

        {/* Angebote */}
        {activeTab === "quotes" && (
          <div className="space-y-2">
            {quotes.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-primary" />
              </div>
            ) : (
              ((quotes.data as Quote[]) ?? []).map(q => (
                <div
                  key={q.id}
                  className="jarvis-card rounded-xl p-3 border border-border"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm text-foreground">
                        Angebot {q.quote_number}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <CustomerLink
                          name={q._customer}
                          onOpen={openDossierByName}
                        />{" "}
                        · {new Date(q.quote_date).toLocaleDateString("de-CH")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        CHF {Number(q.total ?? 0).toLocaleString("de-CH")}
                      </p>
                      <p
                        className={cn("text-xs", STATUS_COLOR[q.status] ?? "")}
                      >
                        {q.status}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Rechnungen */}
        {activeTab === "invoices" && (
          <div className="space-y-2">
            {overdueInvoices.data &&
              (overdueInvoices.data as Invoice[]).length > 0 && (
                <div className="jarvis-card rounded-xl p-3 border border-red-500/30 bg-red-500/5">
                  <p className="text-xs font-medium text-red-400 mb-2">
                    ⚠️ Überfällige Rechnungen
                  </p>
                  {(overdueInvoices.data as Invoice[]).map(inv => (
                    <p key={inv.id} className="text-xs text-red-300">
                      • Rechnung {inv.invoice_number} – CHF{" "}
                      {Number(inv.total ?? 0).toLocaleString("de-CH")} – fällig:{" "}
                      {inv.due_date}
                    </p>
                  ))}
                </div>
              )}
            {invoices.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-primary" />
              </div>
            ) : (
              ((invoices.data as Invoice[]) ?? []).map(inv => (
                <div
                  key={inv.id}
                  className="jarvis-card rounded-xl p-3 border border-border"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm text-foreground">
                        Rechnung {inv.invoice_number}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <CustomerLink
                          name={inv._customer}
                          onOpen={openDossierByName}
                        />{" "}
                        · fällig: {inv.due_date ?? "–"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        CHF {Number(inv.total ?? 0).toLocaleString("de-CH")}
                      </p>
                      <p
                        className={cn(
                          "text-xs",
                          STATUS_COLOR[inv.status] ?? ""
                        )}
                      >
                        {inv.status}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Projekte */}
        {activeTab === "projects" && (
          <div className="space-y-2">
            {projects.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-primary" />
              </div>
            ) : (
              ((projects.data as Project[]) ?? []).map(p => (
                <div
                  key={p.id}
                  className="jarvis-card rounded-xl p-3 border border-border"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm text-foreground">
                        {p.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Nr. {p.project_number} ·{" "}
                        <span className={STATUS_COLOR[p.status] ?? ""}>
                          {p.status}
                        </span>
                      </p>
                    </div>
                    {p.budget && (
                      <p className="text-sm font-medium">
                        CHF {Number(p.budget).toLocaleString("de-CH")}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Leads */}
        {activeTab === "leads" && (
          <div className="space-y-2">
            {leads.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-primary" />
              </div>
            ) : (
              ((leads.data as Lead[]) ?? []).map(l => (
                <div
                  key={l.id}
                  className="jarvis-card rounded-xl p-3 border border-border"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm text-foreground">
                        {l.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {l.company ?? "–"} ·{" "}
                        <span className={STATUS_COLOR[l.status] ?? ""}>
                          {l.status}
                        </span>
                      </p>
                    </div>
                    {l.value && (
                      <p className="text-sm font-medium">
                        CHF {Number(l.value).toLocaleString("de-CH")}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Kunden */}
        {activeTab === "customers" && (
          <div className="space-y-3">
            <input
              value={customerSearch}
              onChange={e => setCustomerSearch(e.target.value)}
              placeholder="Kunden suchen..."
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
            {customers.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-primary" />
              </div>
            ) : (
              ((customers.data as Customer[]) ?? []).map(c => {
                const label =
                  c.company_name ||
                  `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() ||
                  "Unbekannt";
                return (
                  <button
                    key={c.id}
                    onClick={() => openDossier(c.id, label)}
                    className="jarvis-card w-full rounded-xl p-3 border border-border text-left transition-all hover:border-primary/50 hover:bg-primary/5 active:scale-[0.99] flex items-center gap-3 group"
                    title={`Dossier von ${label} öffnen`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-foreground truncate">
                        {label}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.email ?? "–"} · {c.status ?? "aktiv"}
                      </p>
                    </div>
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground group-hover:text-primary transition-colors">
                      <span className="hidden sm:inline">Dossier</span>
                      <ChevronRight size={14} />
                    </span>
                  </button>
                );
              })
            )}
            {!customers.isLoading &&
              ((customers.data as Customer[]) ?? []).length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-8">
                  Keine Kunden gefunden.
                </p>
              )}
          </div>
        )}

        {/* Verträge */}
        {activeTab === "contracts" && (
          <div className="space-y-2">
            {contracts.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-primary" />
              </div>
            ) : (
              ((contracts.data as Contract[]) ?? []).map(c => (
                <div
                  key={c.id}
                  className="jarvis-card rounded-xl p-3 border border-border"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm text-foreground">
                        {c.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c._customer ?? "–"} ·{" "}
                        <span className={STATUS_COLOR[c.status] ?? ""}>
                          {c.status}
                        </span>
                        {c.end_date ? ` · bis ${c.end_date}` : ""}
                      </p>
                    </div>
                    {c.amount && (
                      <p className="text-sm font-medium">
                        CHF {Number(c.amount).toLocaleString("de-CH")}
                        {c.billing_cycle ? "/" + c.billing_cycle : ""}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
            {!contracts.isLoading &&
              ((contracts.data as Contract[]) ?? []).length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-8">
                  Keine Verträge gefunden.
                </p>
              )}
          </div>
        )}

        {/* Ausgaben */}
        {activeTab === "expenses" && (
          <div className="space-y-2">
            {expenses.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-primary" />
              </div>
            ) : (
              (() => {
                const data = (expenses.data as Expense[]) ?? [];
                const total = data.reduce((s, e) => s + (e.amount ?? 0), 0);
                return (
                  <>
                    {data.length > 0 && (
                      <div className="jarvis-card rounded-xl p-3 border border-primary/20 bg-primary/5 text-center">
                        <p className="text-sm font-medium text-primary">
                          Total: CHF {total.toLocaleString("de-CH")}
                        </p>
                      </div>
                    )}
                    {data.map(e => (
                      <div
                        key={e.id}
                        className="jarvis-card rounded-xl p-3 border border-border"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-sm text-foreground">
                              {e.description}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {e.expense_date} · {e.category ?? "–"}
                              {e.supplier ? ` · ${e.supplier}` : ""}
                            </p>
                          </div>
                          <p className="text-sm font-medium">
                            CHF {Number(e.amount).toLocaleString("de-CH")}
                          </p>
                        </div>
                      </div>
                    ))}
                    {data.length === 0 && (
                      <p className="text-center text-muted-foreground text-sm py-8">
                        Keine Ausgaben gefunden.
                      </p>
                    )}
                  </>
                );
              })()
            )}
          </div>
        )}

        {/* Produkte */}
        {activeTab === "products" && (
          <div className="space-y-2">
            {products.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-primary" />
              </div>
            ) : (
              ((products.data as Product[]) ?? []).map(p => (
                <div
                  key={p.id}
                  className="jarvis-card rounded-xl p-3 border border-border"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm text-foreground">
                        {p.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.category ?? "–"}
                        {p.description
                          ? ` · ${p.description.slice(0, 60)}`
                          : ""}
                      </p>
                    </div>
                    <p className="text-sm font-medium text-right">
                      CHF {Number(p.price).toLocaleString("de-CH")}
                      <br />
                      <span className="text-xs text-muted-foreground">
                        / {p.unit ?? "Stk."}
                      </span>
                    </p>
                  </div>
                </div>
              ))
            )}
            {!products.isLoading &&
              ((products.data as Product[]) ?? []).length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-8">
                  Keine Produkte gefunden.
                </p>
              )}
          </div>
        )}
      </div>
    </div>
  );
}
