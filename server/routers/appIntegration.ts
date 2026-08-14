/**
 * Supabase App-Integration für Jarvis
 * Verbindet Jarvis mit Stefans eigener App (Gross ICT ERP/CRM/Ticketing)
 * Tabellen: customers, quotes, invoices, tickets, projects, leads, products
 */

import { fetchWithTimeout } from "../_core/http";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const headers = () => ({
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
});

async function sbFetch(path: string, options: RequestInit = {}) {
  const resp = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    timeoutMs: 10_000,
    headers: {
      ...headers(),
      ...((options.headers as Record<string, string>) ?? {}),
    },
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Supabase ${resp.status}: ${err}`);
  }
  return resp.json();
}

/**
 * Bereinigt einen Freitext-Suchbegriff für den PostgREST-Filter.
 *
 * `encodeURIComponent` kodiert die PostgREST-Sonderzeichen `(`, `)`, `,` und `*`
 * NICHT – ein Suchbegriff mit `)` oder `,` könnte daher aus der `or=(…)`-Gruppe
 * ausbrechen und den Filter manipulieren (die Query läuft mit dem Service-Role-
 * Key und umgeht RLS). Deshalb: strikte Whitelist. Erlaubt sind Buchstaben
 * (inkl. Umlaute/Unicode), Ziffern, Leerzeichen und wenige harmlose Zeichen für
 * Namen/E-Mails. Alles andere wird entfernt.
 */
function sanitizeSearchTerm(input: string): string {
  return (
    input
      .normalize("NFC")
      // Strukturzeichen der PostgREST-Filtergrammatik entfernen: ( ) , * " ' \
      // sowie Steuerzeichen. Buchstaben (inkl. Umlaute) bleiben erhalten.
      .replace(/[(),*"'\\]/g, " ")
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100)
  );
}

/** Erlaubt nur UUID-/ID-taugliche Zeichen für `…=eq.<id>`-Filter. */
function sanitizeId(input: string): string {
  return String(input)
    .replace(/[^a-zA-Z0-9-]/g, "")
    .slice(0, 64);
}

/** Erlaubt nur Status-Slugs (Buchstaben, Ziffern, Unterstrich) für Filter. */
function sanitizeStatus(input: string): string {
  return String(input)
    .replace(/[^a-zA-Z0-9_]/g, "")
    .slice(0, 40);
}

/** Baut eine sichere Listen-Query mit geklammertem Limit und bereinigtem Status. */
function listQuery(
  limit: number,
  status?: string,
  orderBy = "created_at.desc"
): string {
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 100);
  const term = status ? sanitizeStatus(status) : "";
  return term
    ? `?status=eq.${term}&limit=${safeLimit}&order=${orderBy}`
    : `?limit=${safeLimit}&order=${orderBy}`;
}

// ── Kunden ────────────────────────────────────────────────────────────────────
export async function listCustomers(limit = 20, search?: string) {
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 100);
  const term = search ? sanitizeSearchTerm(search) : "";
  const q = term
    ? `?or=(company_name.ilike.*${encodeURIComponent(term)}*,first_name.ilike.*${encodeURIComponent(term)}*,last_name.ilike.*${encodeURIComponent(term)}*,email.ilike.*${encodeURIComponent(term)}*)&limit=${safeLimit}&order=created_at.desc`
    : `?limit=${safeLimit}&order=created_at.desc`;
  return sbFetch(`/customers${q}`);
}

export async function createCustomer(data: {
  first_name?: string;
  last_name?: string;
  company_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  notes?: string;
}) {
  return sbFetch("/customers", { method: "POST", body: JSON.stringify(data) });
}

export async function getCustomer(id: string) {
  const rows = await sbFetch(`/customers?id=eq.${sanitizeId(id)}&limit=1`);
  return rows[0] ?? null;
}

/** Anzeigename eines Kundendatensatzes. */
export function customerLabel(c: Record<string, unknown> | null): string {
  if (!c) return "Unbekannt";
  const company =
    typeof c.company_name === "string" ? c.company_name.trim() : "";
  if (company) return company;
  const first = typeof c.first_name === "string" ? c.first_name : "";
  const last = typeof c.last_name === "string" ? c.last_name : "";
  const name = `${first} ${last}`.trim();
  return name || "Unbekannt";
}

/**
 * Kunden-Dossier: fasst alle Daten eines Kunden zusammen –
 * Stammdaten, Tickets, Angebote, Rechnungen, Projekte, Verträge.
 */
export type CustomerDossier = {
  customer: Record<string, unknown>;
  label: string;
  tickets: Record<string, unknown>[];
  quotes: Record<string, unknown>[];
  invoices: Record<string, unknown>[];
  projects: Record<string, unknown>[];
  contracts: Record<string, unknown>[];
  stats: {
    openTickets: number;
    totalTickets: number;
    openInvoiceCount: number;
    openInvoiceAmount: number;
    paidInvoiceAmount: number;
    overdueCount: number;
    overdueAmount: number;
    openQuoteCount: number;
    openQuoteAmount: number;
    activeProjects: number;
    revenueTotal: number;
  };
};

/** Findet einen Kunden über die ID oder – wenn keine ID vorliegt – per Namenssuche. */
export async function findCustomer(
  idOrName: string
): Promise<Record<string, unknown> | null> {
  const looksLikeUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      idOrName
    );
  if (looksLikeUuid) {
    const byId = await getCustomer(idOrName);
    if (byId) return byId;
  }
  const results = await listCustomers(5, idOrName);
  return Array.isArray(results) && results.length > 0 ? results[0] : null;
}

function num(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export async function getCustomerDossier(
  idOrName: string
): Promise<CustomerDossier | null> {
  const customer = await findCustomer(idOrName);
  if (!customer) return null;
  const id = String(customer.id);

  // Alle zugehörigen Datensätze parallel laden; einzelne Fehler sollen das
  // Dossier nicht verhindern (z.B. wenn eine Tabelle anders heisst).
  const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  };

  const [tickets, quotes, invoices, projects, contracts] = await Promise.all([
    safe(
      () =>
        sbFetch(
          `/tickets?customer_id=eq.${id}&order=created_at.desc&limit=50`
        ) as Promise<Record<string, unknown>[]>,
      []
    ),
    safe(
      () =>
        sbFetch(
          `/quotes?customer_id=eq.${id}&order=created_at.desc&limit=50`
        ) as Promise<Record<string, unknown>[]>,
      []
    ),
    safe(
      () =>
        sbFetch(
          `/invoices?customer_id=eq.${id}&order=created_at.desc&limit=50`
        ) as Promise<Record<string, unknown>[]>,
      []
    ),
    safe(
      () =>
        sbFetch(
          `/projects?customer_id=eq.${id}&order=created_at.desc&limit=50`
        ) as Promise<Record<string, unknown>[]>,
      []
    ),
    safe(
      () =>
        sbFetch(
          `/contracts?customer_id=eq.${id}&order=created_at.desc&limit=50`
        ) as Promise<Record<string, unknown>[]>,
      []
    ),
  ]);

  const today = new Date().toISOString().split("T")[0];
  const openInvoices = invoices.filter(i =>
    ["open", "sent"].includes(String(i.status))
  );
  const paidInvoices = invoices.filter(i => String(i.status) === "paid");
  const overdue = openInvoices.filter(
    i => typeof i.due_date === "string" && i.due_date < today
  );
  const openQuotes = quotes.filter(q =>
    ["draft", "sent"].includes(String(q.status))
  );

  const amount = (row: Record<string, unknown>) =>
    num(row.total ?? row.total_amount ?? row.amount ?? row.gross_total);

  return {
    customer,
    label: customerLabel(customer),
    tickets,
    quotes,
    invoices,
    projects,
    contracts,
    stats: {
      openTickets: tickets.filter(t =>
        ["open", "in_progress"].includes(String(t.status))
      ).length,
      totalTickets: tickets.length,
      openInvoiceCount: openInvoices.length,
      openInvoiceAmount: openInvoices.reduce((s, i) => s + amount(i), 0),
      paidInvoiceAmount: paidInvoices.reduce((s, i) => s + amount(i), 0),
      overdueCount: overdue.length,
      overdueAmount: overdue.reduce((s, i) => s + amount(i), 0),
      openQuoteCount: openQuotes.length,
      openQuoteAmount: openQuotes.reduce((s, q) => s + amount(q), 0),
      activeProjects: projects.filter(p => String(p.status) === "active")
        .length,
      revenueTotal: paidInvoices.reduce((s, i) => s + amount(i), 0),
    },
  };
}

/** Formatiert das Dossier als lesbaren Text für die Chat-Antwort. */
export function formatDossier(d: CustomerDossier): string {
  const chf = (n: number) =>
    `CHF ${n.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const date = (v: unknown) => {
    if (typeof v !== "string") return "";
    const parsed = new Date(v);
    return Number.isNaN(parsed.getTime())
      ? ""
      : parsed.toLocaleDateString("de-CH");
  };
  const c = d.customer;
  const lines: string[] = [];

  lines.push(`## Kunden-Dossier: ${d.label}`);
  const contact: string[] = [];
  if (typeof c.email === "string" && c.email)
    contact.push(`E-Mail: ${c.email}`);
  if (typeof c.phone === "string" && c.phone)
    contact.push(`Telefon: ${c.phone}`);
  const addr = [c.address, `${c.postal_code ?? ""} ${c.city ?? ""}`.trim()]
    .filter(x => typeof x === "string" && x)
    .join(", ");
  if (addr) contact.push(`Adresse: ${addr}`);
  if (contact.length > 0) lines.push(contact.join(" · "));

  lines.push("");
  lines.push("**Lage auf einen Blick**");
  lines.push(
    `- Offene Rechnungen: ${d.stats.openInvoiceCount} (${chf(d.stats.openInvoiceAmount)})`
  );
  if (d.stats.overdueCount > 0) {
    lines.push(
      `- Davon überfällig: ${d.stats.overdueCount} (${chf(d.stats.overdueAmount)})`
    );
  }
  lines.push(`- Bezahlter Umsatz: ${chf(d.stats.revenueTotal)}`);
  lines.push(
    `- Offene Angebote: ${d.stats.openQuoteCount} (${chf(d.stats.openQuoteAmount)})`
  );
  lines.push(
    `- Offene Tickets: ${d.stats.openTickets} von ${d.stats.totalTickets} insgesamt`
  );
  lines.push(`- Laufende Projekte: ${d.stats.activeProjects}`);

  if (d.tickets.length > 0) {
    lines.push("");
    lines.push("**Letzte Tickets**");
    for (const t of d.tickets.slice(0, 5)) {
      lines.push(
        `- ${t.title ?? "Ohne Titel"} – ${t.status ?? "?"}${t.priority ? ` (${t.priority})` : ""}${date(t.created_at) ? `, ${date(t.created_at)}` : ""}`
      );
    }
  }

  if (d.invoices.length > 0) {
    lines.push("");
    lines.push("**Letzte Rechnungen**");
    for (const i of d.invoices.slice(0, 5)) {
      const nr = i.invoice_number ?? i.number ?? i.id;
      lines.push(
        `- ${nr} – ${i.status ?? "?"}${date(i.due_date) ? `, fällig ${date(i.due_date)}` : ""}`
      );
    }
  }

  if (d.projects.length > 0) {
    lines.push("");
    lines.push("**Projekte**");
    for (const p of d.projects.slice(0, 5)) {
      lines.push(`- ${p.title ?? p.name ?? "Ohne Titel"} – ${p.status ?? "?"}`);
    }
  }

  if (d.contracts.length > 0) {
    lines.push("");
    lines.push("**Verträge**");
    for (const v of d.contracts.slice(0, 5)) {
      lines.push(`- ${v.title ?? v.name ?? "Vertrag"} – ${v.status ?? "?"}`);
    }
  }

  return lines.join("\n");
}

// ── Angebote ──────────────────────────────────────────────────────────────────
export async function listQuotes(limit = 20, status?: string) {
  const q = listQuery(limit, status);
  const quotes = await sbFetch(`/quotes${q}`);
  // Kundennamen nachladen
  for (const q of quotes) {
    if (q.customer_id) {
      try {
        const c = await getCustomer(q.customer_id);
        q._customer = c
          ? c.company_name ||
            `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()
          : "Unbekannt";
      } catch {
        q._customer = "Unbekannt";
      }
    }
  }
  return quotes;
}

export async function createQuote(data: {
  customer_id: string;
  quote_date?: string;
  valid_until?: string;
  notes?: string;
  status?: string;
}) {
  return sbFetch("/quotes", {
    method: "POST",
    body: JSON.stringify({ ...data, status: data.status ?? "draft" }),
  });
}

export async function updateQuoteStatus(id: string, status: string) {
  return sbFetch(`/quotes?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

// ── Rechnungen ────────────────────────────────────────────────────────────────
export async function listInvoices(limit = 20, status?: string) {
  const q = listQuery(limit, status);
  const invoices = await sbFetch(`/invoices${q}`);
  for (const inv of invoices) {
    if (inv.customer_id) {
      try {
        const c = await getCustomer(inv.customer_id);
        inv._customer = c
          ? c.company_name ||
            `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()
          : "Unbekannt";
      } catch {
        inv._customer = "Unbekannt";
      }
    }
  }
  return invoices;
}

export async function getOverdueInvoices() {
  const today = new Date().toISOString().split("T")[0];
  return sbFetch(
    `/invoices?status=neq.paid&due_date=lt.${today}&order=due_date.asc&limit=20`
  );
}

// ── Tickets ───────────────────────────────────────────────────────────────────
export async function listTickets(limit = 20, status?: string) {
  const q = listQuery(limit, status);
  const tickets = await sbFetch(`/tickets${q}`);
  for (const t of tickets) {
    if (t.customer_id) {
      try {
        const c = await getCustomer(t.customer_id);
        t._customer = c
          ? c.company_name ||
            `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()
          : "Unbekannt";
      } catch {
        t._customer = "Unbekannt";
      }
    }
  }
  return tickets;
}

export async function createTicket(data: {
  customer_id?: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  assigned_to?: string;
}) {
  const { assigned_to, ...rest } = data;
  let assignedToId = assigned_to;
  if (assignedToId && !assignedToId.includes("-")) {
    const users = await sbFetch(`/users?name=ilike.*${assignedToId}*`);
    if (users && users.length > 0) {
      assignedToId = users[0].id;
    } else {
      assignedToId = undefined;
    }
  }

  return sbFetch("/tickets", {
    method: "POST",
    body: JSON.stringify({
      ...rest,
      ...(assignedToId ? { assigned_to: assignedToId } : {}),
      status: data.status ?? "open",
      priority: data.priority ?? "medium",
    }),
  });
}

async function resolveTicketId(idOrTitle: string) {
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      idOrTitle
    )
  ) {
    return idOrTitle;
  }
  const cleanTitle = sanitizeSearchTerm(idOrTitle);
  const tickets = await sbFetch(
    `/tickets?title=ilike.*${encodeURIComponent(cleanTitle)}*`
  );
  if (tickets && tickets.length > 0) {
    return tickets[0].id;
  }
  throw new Error(`Ticket mit Titel/ID '${idOrTitle}' nicht gefunden.`);
}

export async function assignTicket(id: string, user_name: string) {
  const cleanName = sanitizeSearchTerm(user_name);
  const users = await sbFetch(
    `/users?name=ilike.*${encodeURIComponent(cleanName)}*`
  );
  if (!users || users.length === 0) {
    throw new Error(`Mitarbeiter '${user_name}' nicht gefunden.`);
  }

  const realId = await resolveTicketId(id);
  return sbFetch(`/tickets?id=eq.${realId}`, {
    method: "PATCH",
    body: JSON.stringify({
      assigned_to: users[0].id,
      updated_at: new Date().toISOString(),
    }),
  });
}

export async function updateTicketStatus(id: string, status: string) {
  const realId = await resolveTicketId(id);
  return sbFetch(`/tickets?id=eq.${realId}`, {
    method: "PATCH",
    body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
  });
}

// ── Projekte ──────────────────────────────────────────────────────────────────
export async function listProjects(limit = 20, status?: string) {
  const q = listQuery(limit, status);
  return sbFetch(`/projects${q}`);
}

export async function getProject(id: string) {
  const rows = await sbFetch(`/projects?id=eq.${id}&limit=1`);
  return rows[0] ?? null;
}

// ── Leads ─────────────────────────────────────────────────────────────────────
export async function listLeads(limit = 20, status?: string) {
  const q = listQuery(limit, status);
  return sbFetch(`/leads${q}`);
}

export async function createLead(data: {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  status?: string;
  notes?: string;
  value?: number;
}) {
  return sbFetch("/leads", {
    method: "POST",
    body: JSON.stringify({ ...data, status: data.status ?? "new" }),
  });
}

// ── Dashboard-Zusammenfassung ─────────────────────────────────────────────────
export async function getAppDashboard() {
  const today = new Date().toISOString().split("T")[0];
  const [
    customers,
    openTickets,
    openQuotes,
    openInvoices,
    overdueInvoices,
    activeProjects,
    newLeads,
  ] = await Promise.allSettled([
    sbFetch("/customers?select=id&limit=1000"),
    sbFetch("/tickets?status=eq.open&select=id&limit=1000"),
    sbFetch("/quotes?status=eq.draft&select=id&limit=1000"),
    sbFetch(`/invoices?status=in.(open,sent)&select=id,total&limit=1000`),
    sbFetch(
      `/invoices?status=in.(open,sent)&due_date=lt.${today}&select=id,total&limit=1000`
    ),
    sbFetch("/projects?status=eq.active&select=id&limit=1000"),
    sbFetch("/leads?status=eq.new&select=id&limit=1000"),
  ]);

  const get = (r: PromiseSettledResult<unknown[]>) =>
    r.status === "fulfilled" ? r.value : [];

  const openList = get(
    openInvoices as PromiseSettledResult<unknown[]>
  ) as Array<{ total?: number }>;
  const openTotal = openList.reduce((s, i) => s + (i.total ?? 0), 0);

  const overdueList = get(
    overdueInvoices as PromiseSettledResult<unknown[]>
  ) as Array<{ total?: number }>;
  const overdueTotal = overdueList.reduce((s, i) => s + (i.total ?? 0), 0);

  return {
    customers: get(customers as PromiseSettledResult<unknown[]>).length,
    openTickets: get(openTickets as PromiseSettledResult<unknown[]>).length,
    openQuotes: get(openQuotes as PromiseSettledResult<unknown[]>).length,
    openInvoices: openList.length,
    openTotal,
    overdueInvoices: overdueList.length,
    overdueTotal,
    activeProjects: get(activeProjects as PromiseSettledResult<unknown[]>)
      .length,
    newLeads: get(newLeads as PromiseSettledResult<unknown[]>).length,
  };
}

// ── Angebot erstellen mit Positionen ─────────────────────────────────────────
export async function createQuoteWithItems(data: {
  customer_id: string;
  notes?: string;
  valid_until?: string;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    vat_rate?: number;
    unit?: string;
  }>;
}) {
  const quote = await sbFetch("/quotes", {
    method: "POST",
    body: JSON.stringify({
      customer_id: data.customer_id,
      quote_date: new Date().toISOString().split("T")[0],
      valid_until: data.valid_until,
      notes: data.notes,
      status: "draft",
      subtotal: data.items.reduce((s, i) => s + i.quantity * i.unit_price, 0),
      total: data.items.reduce(
        (s, i) =>
          s + i.quantity * i.unit_price * (1 + (i.vat_rate ?? 8.1) / 100),
        0
      ),
      tax: data.items.reduce(
        (s, i) => s + (i.quantity * i.unit_price * (i.vat_rate ?? 8.1)) / 100,
        0
      ),
    }),
  });
  const q = Array.isArray(quote) ? quote[0] : quote;
  for (const item of data.items) {
    await sbFetch("/quote_items", {
      method: "POST",
      body: JSON.stringify({
        quote_id: q.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        vat_rate: item.vat_rate ?? 8.1,
        total: item.quantity * item.unit_price,
        unit: item.unit ?? "Stk.",
      }),
    });
  }
  return q;
}

// ── Rechnung als bezahlt markieren ────────────────────────────────────────────
export async function markInvoicePaid(id: string) {
  return sbFetch(`/invoices?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "paid",
      paid_amount: null,
      updated_at: new Date().toISOString(),
    }),
  });
}

// ── Rechnung erstellen ────────────────────────────────────────────────────────
export async function createInvoice(data: {
  customer_id: string;
  due_date?: string;
  notes?: string;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    vat_rate?: number;
    unit?: string;
  }>;
}) {
  const subtotal = data.items.reduce(
    (s, i) => s + i.quantity * i.unit_price,
    0
  );
  const vat = data.items.reduce(
    (s, i) => s + (i.quantity * i.unit_price * (i.vat_rate ?? 8.1)) / 100,
    0
  );
  const invoice = await sbFetch("/invoices", {
    method: "POST",
    body: JSON.stringify({
      customer_id: data.customer_id,
      invoice_date: new Date().toISOString().split("T")[0],
      due_date:
        data.due_date ??
        new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      notes: data.notes,
      status: "unpaid",
      subtotal,
      vat_amount: vat,
      total: subtotal + vat,
    }),
  });
  const inv = Array.isArray(invoice) ? invoice[0] : invoice;
  for (const item of data.items) {
    await sbFetch("/invoice_items", {
      method: "POST",
      body: JSON.stringify({
        invoice_id: inv.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        vat_rate: item.vat_rate ?? 8.1,
        total: item.quantity * item.unit_price,
        unit: item.unit ?? "Stk.",
      }),
    });
  }
  return inv;
}

// ── Ticket-Kommentar hinzufügen ───────────────────────────────────────────────
export async function addTicketComment(
  ticketId: string,
  comment: string,
  isInternal = false
) {
  return sbFetch("/ticket_comments", {
    method: "POST",
    body: JSON.stringify({
      ticket_id: ticketId,
      comment,
      is_internal: isInternal,
      user_name: "Jarvis (Stefan Gross)",
      is_system: false,
    }),
  });
}

// ── Ticket-Priorität ändern ───────────────────────────────────────────────────
export async function updateTicketPriority(id: string, priority: string) {
  return sbFetch(`/tickets?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ priority, updated_at: new Date().toISOString() }),
  });
}

// ── Verträge ──────────────────────────────────────────────────────────────────
export async function listContracts(limit = 20, status?: string) {
  const q = listQuery(limit, status);
  const contracts = await sbFetch(`/contracts${q}`);
  for (const c of contracts) {
    if (c.customer_id) {
      try {
        const cu = await getCustomer(c.customer_id);
        c._customer = cu
          ? cu.company_name ||
            `${cu.first_name ?? ""} ${cu.last_name ?? ""}`.trim()
          : "Unbekannt";
      } catch {
        c._customer = "Unbekannt";
      }
    }
  }
  return contracts;
}

// ── Ausgaben ──────────────────────────────────────────────────────────────────
export async function listExpenses(limit = 20) {
  return sbFetch(`/expenses?limit=${limit}&order=expense_date.desc`);
}

export async function createExpense(data: {
  description: string;
  amount: number;
  category?: string;
  expense_date?: string;
  notes?: string;
  supplier?: string;
}) {
  return sbFetch("/expenses", {
    method: "POST",
    body: JSON.stringify({
      ...data,
      expense_date: data.expense_date ?? new Date().toISOString().split("T")[0],
      vat_rate: 8.1,
    }),
  });
}

// ── Projektaufgaben ───────────────────────────────────────────────────────────
export async function listProjectTasks(projectId: string) {
  return sbFetch(
    `/project_tasks?project_id=eq.${projectId}&order=sort_order.asc`
  );
}

export async function createProjectTask(data: {
  project_id: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  due_date?: string;
}) {
  return sbFetch("/project_tasks", {
    method: "POST",
    body: JSON.stringify({
      ...data,
      status: data.status ?? "todo",
      priority: data.priority ?? "medium",
    }),
  });
}

// ── Produkte ──────────────────────────────────────────────────────────────────
export async function listProducts(limit = 30) {
  return sbFetch(`/products?is_active=eq.true&limit=${limit}&order=name.asc`);
}

// ── Lead-Status ändern ────────────────────────────────────────────────────────
export async function updateLeadStatus(id: string, status: string) {
  return sbFetch(`/leads?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
  });
}

// ── Projekt erstellen ─────────────────────────────────────────────────────────
export async function createProject(data: {
  title: string;
  description?: string;
  customer_id?: string;
  status?: string;
  budget?: number;
  start_date?: string;
  end_date?: string;
  priority?: string;
}) {
  return sbFetch("/projects", {
    method: "POST",
    body: JSON.stringify({
      ...data,
      status: data.status ?? "active",
      priority: data.priority ?? "medium",
    }),
  });
}

// ── Haupt-Action-Dispatcher (für Chat-Integration) ────────────────────────────
export async function executeAppAction(
  action: string,
  params: Record<string, unknown>
): Promise<string> {
  try {
    switch (action) {
      case "list_customers": {
        const data = await listCustomers(10, params.search as string);
        if (!data.length) return "Keine Kunden gefunden.";
        return (
          `**Kunden (${data.length}):**\n` +
          data
            .map(
              (c: Record<string, string>) =>
                `• ${c.company_name || `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()} – ${c.email ?? "keine E-Mail"} (${c.status ?? "aktiv"})`
            )
            .join("\n")
        );
      }
      case "create_customer": {
        const result = await createCustomer(
          params as Parameters<typeof createCustomer>[0]
        );
        const c = Array.isArray(result) ? result[0] : result;
        return `✅ Kunde erstellt: **${c.company_name || `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()}** (ID: ${c.id})`;
      }
      case "customer_dossier": {
        const key = (params.customer ??
          params.name ??
          params.id ??
          params.search) as string | undefined;
        if (!key) return "Für welchen Kunden soll ich das Dossier erstellen?";
        const dossier = await getCustomerDossier(key);
        if (!dossier)
          return `Ich habe keinen Kunden gefunden, der zu „${key}" passt.`;
        return formatDossier(dossier);
      }
      case "list_tickets": {
        const data = await listTickets(10, params.status as string);
        if (!data.length) return "Keine Tickets gefunden.";
        const priorityIcon: Record<string, string> = {
          high: "🔴",
          medium: "🟡",
          low: "🟢",
        };
        return (
          `**Tickets (${data.length}):**\n` +
          data
            .map(
              (t: Record<string, string>) =>
                `• ${priorityIcon[t.priority] ?? "⚪"} [${t.status}] ${t.title} – ${t._customer ?? "Unbekannt"}`
            )
            .join("\n")
        );
      }
      case "create_ticket": {
        const result = await createTicket(
          params as Parameters<typeof createTicket>[0]
        );
        const t = Array.isArray(result) ? result[0] : result;
        return `✅ Ticket erstellt: **${t.title}** (ID: ${t.id}, Status: ${t.status})`;
      }
      case "update_ticket_status": {
        await updateTicketStatus(params.id as string, params.status as string);
        return `✅ Ticket ${params.id} Status auf **${params.status}** gesetzt.`;
      }
      case "assign_ticket": {
        await assignTicket(params.id as string, params.user_name as string);
        return `✅ Ticket ${params.id} an Mitarbeiter **${params.user_name}** zugewiesen.`;
      }
      case "list_quotes": {
        const data = await listQuotes(10, params.status as string);
        if (!data.length) return "Keine Angebote gefunden.";
        return (
          `**Angebote (${data.length}):**\n` +
          data
            .map(
              (q: Record<string, string | number>) =>
                `• [${q.status}] Angebot ${q.quote_number} – ${q._customer ?? "Unbekannt"} – CHF ${Number(q.total ?? 0).toLocaleString("de-CH")}`
            )
            .join("\n")
        );
      }
      case "list_invoices": {
        const data = await listInvoices(10, params.status as string);
        if (!data.length) return "Keine Rechnungen gefunden.";
        return (
          `**Rechnungen (${data.length}):**\n` +
          data
            .map(
              (inv: Record<string, string | number>) =>
                `• [${inv.status}] Rechnung ${inv.invoice_number} – ${inv._customer ?? "Unbekannt"} – CHF ${Number(inv.total ?? 0).toLocaleString("de-CH")} (fällig: ${inv.due_date ?? "–"})`
            )
            .join("\n")
        );
      }
      case "list_overdue_invoices": {
        const data = await getOverdueInvoices();
        if (!data.length) return "Keine überfälligen Rechnungen. 🎉";
        const total = data.reduce(
          (s: number, i: Record<string, number>) => s + (i.total ?? 0),
          0
        );
        return (
          `**Überfällige Rechnungen (${data.length}), Total: CHF ${total.toLocaleString("de-CH")}:**\n` +
          data
            .map(
              (inv: Record<string, string | number>) =>
                `• Rechnung ${inv.invoice_number} – CHF ${Number(inv.total ?? 0).toLocaleString("de-CH")} – fällig seit ${inv.due_date}`
            )
            .join("\n")
        );
      }
      case "list_projects": {
        const data = await listProjects(10, params.status as string);
        if (!data.length) return "Keine Projekte gefunden.";
        return (
          `**Projekte (${data.length}):**\n` +
          data
            .map(
              (p: Record<string, string | number>) =>
                `• [${p.status}] ${p.title} (Nr. ${p.project_number}) – Budget: CHF ${Number(p.budget ?? 0).toLocaleString("de-CH")}`
            )
            .join("\n")
        );
      }
      case "list_leads": {
        const data = await listLeads(10, params.status as string);
        if (!data.length) return "Keine Leads gefunden.";
        return (
          `**Leads (${data.length}):**\n` +
          data
            .map(
              (l: Record<string, string | number>) =>
                `• [${l.status}] ${l.name} – ${l.company ?? "–"} – CHF ${Number(l.value ?? 0).toLocaleString("de-CH")}`
            )
            .join("\n")
        );
      }
      case "create_lead": {
        const result = await createLead(
          params as Parameters<typeof createLead>[0]
        );
        const l = Array.isArray(result) ? result[0] : result;
        return `✅ Lead erstellt: **${l.name}** (${l.company ?? "–"}, ID: ${l.id})`;
      }
      case "dashboard": {
        const d = await getAppDashboard();
        let invoiceInfo = `• 📄 Offene Rechnungen: ${d.openInvoices} (CHF ${d.openTotal.toLocaleString("de-CH")})`;
        if (d.overdueInvoices > 0) {
          invoiceInfo += `\n• ⚠️ Davon überfällig: ${d.overdueInvoices} (CHF ${d.overdueTotal.toLocaleString("de-CH")})`;
        }
        return `**App-Dashboard:**\n• 👥 Kunden: ${d.customers}\n• 🎫 Offene Tickets: ${d.openTickets}\n• 📝 Offene Angebote: ${d.openQuotes}\n${invoiceInfo}\n• 🚀 Aktive Projekte: ${d.activeProjects}\n• 🎯 Neue Leads: ${d.newLeads}`;
      }

      case "create_quote": {
        const result = await createQuoteWithItems(
          params as Parameters<typeof createQuoteWithItems>[0]
        );
        return `✅ Angebot erstellt: **Angebot ${result.quote_number}** für Kunde ${params.customer_id} (ID: ${result.id}, Total: CHF ${Number(result.total ?? 0).toLocaleString("de-CH")})`;
      }
      case "create_invoice": {
        const result = await createInvoice(
          params as Parameters<typeof createInvoice>[0]
        );
        return `✅ Rechnung erstellt: **Rechnung ${result.invoice_number}** (ID: ${result.id}, Total: CHF ${Number(result.total ?? 0).toLocaleString("de-CH")}, fällig: ${result.due_date})`;
      }
      case "mark_invoice_paid": {
        await markInvoicePaid(params.id as string);
        return `✅ Rechnung ${params.id} als **bezahlt** markiert.`;
      }
      case "add_ticket_comment": {
        await addTicketComment(
          params.ticket_id as string,
          params.comment as string,
          (params.is_internal as boolean) ?? false
        );
        return `✅ Kommentar zu Ticket ${params.ticket_id} hinzugefügt.`;
      }
      case "update_ticket_priority": {
        await updateTicketPriority(
          params.id as string,
          params.priority as string
        );
        return `✅ Ticket ${params.id} Priorität auf **${params.priority}** gesetzt.`;
      }
      case "list_contracts": {
        const data = await listContracts(10, params.status as string);
        if (!data.length) return "Keine Verträge gefunden.";
        return (
          `**Verträge (${data.length}):**\n` +
          data
            .map(
              (c: Record<string, string | number>) =>
                `• [${c.status}] ${c.title} – ${c._customer ?? "–"} – CHF ${Number(c.amount ?? 0).toLocaleString("de-CH")}/Mt. (bis: ${c.end_date ?? "unbefristet"})`
            )
            .join("\n")
        );
      }
      case "list_expenses": {
        const data = await listExpenses(10);
        if (!data.length) return "Keine Ausgaben gefunden.";
        const total = data.reduce(
          (s: number, e: Record<string, number>) => s + (e.amount ?? 0),
          0
        );
        return (
          `**Ausgaben (${data.length}), Total: CHF ${total.toLocaleString("de-CH")}:**\n` +
          data
            .map(
              (e: Record<string, string | number>) =>
                `• ${e.expense_date} – ${e.description} – CHF ${Number(e.amount ?? 0).toLocaleString("de-CH")} (${e.category ?? "–"})`
            )
            .join("\n")
        );
      }
      case "create_expense": {
        const result = await createExpense(
          params as Parameters<typeof createExpense>[0]
        );
        const e = Array.isArray(result) ? result[0] : result;
        return `✅ Ausgabe erfasst: **${e.description}** – CHF ${Number(e.amount ?? 0).toLocaleString("de-CH")}`;
      }
      case "list_products": {
        const data = await listProducts();
        if (!data.length) return "Keine Produkte gefunden.";
        return (
          `**Produkte (${data.length}):**\n` +
          data
            .map(
              (p: Record<string, string | number>) =>
                `• ${p.name} – CHF ${Number(p.price ?? 0).toLocaleString("de-CH")} / ${p.unit ?? "Stk."} (${p.category ?? "–"})`
            )
            .join("\n")
        );
      }
      case "list_project_tasks": {
        const data = await listProjectTasks(params.project_id as string);
        if (!data.length) return "Keine Aufgaben für dieses Projekt.";
        return (
          `**Projektaufgaben (${data.length}):**\n` +
          data
            .map(
              (t: Record<string, string>) =>
                `• [${t.status}] ${t.title} (${t.priority ?? "medium"})`
            )
            .join("\n")
        );
      }
      case "create_project_task": {
        const result = await createProjectTask(
          params as Parameters<typeof createProjectTask>[0]
        );
        const t = Array.isArray(result) ? result[0] : result;
        return `✅ Aufgabe erstellt: **${t.title}** in Projekt ${params.project_id}`;
      }
      case "create_project": {
        const result = await createProject(
          params as Parameters<typeof createProject>[0]
        );
        const p = Array.isArray(result) ? result[0] : result;
        return `✅ Projekt erstellt: **${p.title}** (Nr. ${p.project_number}, ID: ${p.id})`;
      }
      case "update_lead_status": {
        await updateLeadStatus(params.id as string, params.status as string);
        return `✅ Lead ${params.id} Status auf **${params.status}** gesetzt.`;
      }
      default:
        return `Unbekannte App-Aktion: ${action}`;
    }
  } catch (e) {
    return `Fehler bei App-Aktion ${action}: ${String(e)}`;
  }
}
