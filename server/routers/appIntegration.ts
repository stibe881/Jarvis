/**
 * Supabase App-Integration für Jarvis
 * Verbindet Jarvis mit Stefans eigener App (Gross ICT ERP/CRM/Ticketing)
 * Tabellen: customers, quotes, invoices, tickets, projects, leads, products
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const headers = () => ({
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "return=representation",
});

async function sbFetch(path: string, options: RequestInit = {}) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: { ...headers(), ...(options.headers as Record<string, string> ?? {}) },
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Supabase ${resp.status}: ${err}`);
  }
  return resp.json();
}

// ── Kunden ────────────────────────────────────────────────────────────────────
export async function listCustomers(limit = 20, search?: string) {
  const q = search
    ? `?or=(company_name.ilike.*${encodeURIComponent(search)}*,first_name.ilike.*${encodeURIComponent(search)}*,last_name.ilike.*${encodeURIComponent(search)}*,email.ilike.*${encodeURIComponent(search)}*)&limit=${limit}&order=created_at.desc`
    : `?limit=${limit}&order=created_at.desc`;
  return sbFetch(`/customers${q}`);
}

export async function createCustomer(data: {
  first_name?: string; last_name?: string; company_name?: string;
  email?: string; phone?: string; address?: string; city?: string;
  postal_code?: string; country?: string; notes?: string;
}) {
  return sbFetch("/customers", { method: "POST", body: JSON.stringify(data) });
}

export async function getCustomer(id: string) {
  const rows = await sbFetch(`/customers?id=eq.${id}&limit=1`);
  return rows[0] ?? null;
}

// ── Angebote ──────────────────────────────────────────────────────────────────
export async function listQuotes(limit = 20, status?: string) {
  const q = status ? `?status=eq.${status}&limit=${limit}&order=created_at.desc` : `?limit=${limit}&order=created_at.desc`;
  const quotes = await sbFetch(`/quotes${q}`);
  // Kundennamen nachladen
  for (const q of quotes) {
    if (q.customer_id) {
      try {
        const c = await getCustomer(q.customer_id);
        q._customer = c ? (c.company_name || `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()) : "Unbekannt";
      } catch { q._customer = "Unbekannt"; }
    }
  }
  return quotes;
}

export async function createQuote(data: {
  customer_id: string; quote_date?: string; valid_until?: string;
  notes?: string; status?: string;
}) {
  return sbFetch("/quotes", { method: "POST", body: JSON.stringify({ ...data, status: data.status ?? "draft" }) });
}

export async function updateQuoteStatus(id: string, status: string) {
  return sbFetch(`/quotes?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
}

// ── Rechnungen ────────────────────────────────────────────────────────────────
export async function listInvoices(limit = 20, status?: string) {
  const q = status ? `?status=eq.${status}&limit=${limit}&order=created_at.desc` : `?limit=${limit}&order=created_at.desc`;
  const invoices = await sbFetch(`/invoices${q}`);
  for (const inv of invoices) {
    if (inv.customer_id) {
      try {
        const c = await getCustomer(inv.customer_id);
        inv._customer = c ? (c.company_name || `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()) : "Unbekannt";
      } catch { inv._customer = "Unbekannt"; }
    }
  }
  return invoices;
}

export async function getOverdueInvoices() {
  const today = new Date().toISOString().split("T")[0];
  return sbFetch(`/invoices?status=neq.paid&due_date=lt.${today}&order=due_date.asc&limit=20`);
}

// ── Tickets ───────────────────────────────────────────────────────────────────
export async function listTickets(limit = 20, status?: string) {
  const q = status ? `?status=eq.${status}&limit=${limit}&order=created_at.desc` : `?limit=${limit}&order=created_at.desc`;
  const tickets = await sbFetch(`/tickets${q}`);
  for (const t of tickets) {
    if (t.customer_id) {
      try {
        const c = await getCustomer(t.customer_id);
        t._customer = c ? (c.company_name || `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()) : "Unbekannt";
      } catch { t._customer = "Unbekannt"; }
    }
  }
  return tickets;
}

export async function createTicket(data: {
  customer_id?: string; title: string; description?: string;
  status?: string; priority?: string;
}) {
  return sbFetch("/tickets", { method: "POST", body: JSON.stringify({ ...data, status: data.status ?? "open", priority: data.priority ?? "medium" }) });
}

export async function updateTicketStatus(id: string, status: string) {
  return sbFetch(`/tickets?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status, updated_at: new Date().toISOString() }) });
}

// ── Projekte ──────────────────────────────────────────────────────────────────
export async function listProjects(limit = 20, status?: string) {
  const q = status ? `?status=eq.${status}&limit=${limit}&order=created_at.desc` : `?limit=${limit}&order=created_at.desc`;
  return sbFetch(`/projects${q}`);
}

export async function getProject(id: string) {
  const rows = await sbFetch(`/projects?id=eq.${id}&limit=1`);
  return rows[0] ?? null;
}

// ── Leads ─────────────────────────────────────────────────────────────────────
export async function listLeads(limit = 20, status?: string) {
  const q = status ? `?status=eq.${status}&limit=${limit}&order=created_at.desc` : `?limit=${limit}&order=created_at.desc`;
  return sbFetch(`/leads${q}`);
}

export async function createLead(data: {
  name: string; company?: string; email?: string; phone?: string;
  status?: string; notes?: string; value?: number;
}) {
  return sbFetch("/leads", { method: "POST", body: JSON.stringify({ ...data, status: data.status ?? "new" }) });
}

// ── Dashboard-Zusammenfassung ─────────────────────────────────────────────────
export async function getAppDashboard() {
  const [customers, openTickets, openQuotes, overdueInvoices, activeProjects, newLeads] = await Promise.allSettled([
    sbFetch("/customers?select=id&limit=1000"),
    sbFetch("/tickets?status=eq.open&select=id&limit=1000"),
    sbFetch("/quotes?status=eq.draft&select=id&limit=1000"),
    sbFetch(`/invoices?status=neq.paid&due_date=lt.${new Date().toISOString().split("T")[0]}&select=id,total&limit=1000`),
    sbFetch("/projects?status=eq.active&select=id&limit=1000"),
    sbFetch("/leads?status=eq.new&select=id&limit=1000"),
  ]);

  const get = (r: PromiseSettledResult<unknown[]>) => r.status === "fulfilled" ? r.value : [];

  const overdueList = get(overdueInvoices as PromiseSettledResult<unknown[]>) as Array<{ total?: number }>;
  const overdueTotal = overdueList.reduce((s, i) => s + (i.total ?? 0), 0);

  return {
    customers: (get(customers as PromiseSettledResult<unknown[]>)).length,
    openTickets: (get(openTickets as PromiseSettledResult<unknown[]>)).length,
    openQuotes: (get(openQuotes as PromiseSettledResult<unknown[]>)).length,
    overdueInvoices: overdueList.length,
    overdueTotal,
    activeProjects: (get(activeProjects as PromiseSettledResult<unknown[]>)).length,
    newLeads: (get(newLeads as PromiseSettledResult<unknown[]>)).length,
  };
}

// ── Haupt-Action-Dispatcher (für Chat-Integration) ────────────────────────────
export async function executeAppAction(action: string, params: Record<string, unknown>): Promise<string> {
  try {
    switch (action) {
      case "list_customers": {
        const data = await listCustomers(10, params.search as string);
        if (!data.length) return "Keine Kunden gefunden.";
        return `**Kunden (${data.length}):**\n` + data.map((c: Record<string, string>) =>
          `• ${c.company_name || `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()} – ${c.email ?? "keine E-Mail"} (${c.status ?? "aktiv"})`
        ).join("\n");
      }
      case "create_customer": {
        const result = await createCustomer(params as Parameters<typeof createCustomer>[0]);
        const c = Array.isArray(result) ? result[0] : result;
        return `✅ Kunde erstellt: **${c.company_name || `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()}** (ID: ${c.id})`;
      }
      case "list_tickets": {
        const data = await listTickets(10, params.status as string);
        if (!data.length) return "Keine Tickets gefunden.";
        const priorityIcon: Record<string, string> = { high: "🔴", medium: "🟡", low: "🟢" };
        return `**Tickets (${data.length}):**\n` + data.map((t: Record<string, string>) =>
          `• ${priorityIcon[t.priority] ?? "⚪"} [${t.status}] ${t.title} – ${t._customer ?? "Unbekannt"}`
        ).join("\n");
      }
      case "create_ticket": {
        const result = await createTicket(params as Parameters<typeof createTicket>[0]);
        const t = Array.isArray(result) ? result[0] : result;
        return `✅ Ticket erstellt: **${t.title}** (ID: ${t.id}, Status: ${t.status})`;
      }
      case "update_ticket_status": {
        await updateTicketStatus(params.id as string, params.status as string);
        return `✅ Ticket ${params.id} Status auf **${params.status}** gesetzt.`;
      }
      case "list_quotes": {
        const data = await listQuotes(10, params.status as string);
        if (!data.length) return "Keine Angebote gefunden.";
        return `**Angebote (${data.length}):**\n` + data.map((q: Record<string, string | number>) =>
          `• [${q.status}] Angebot ${q.quote_number} – ${q._customer ?? "Unbekannt"} – CHF ${Number(q.total ?? 0).toLocaleString("de-CH")}`
        ).join("\n");
      }
      case "list_invoices": {
        const data = await listInvoices(10, params.status as string);
        if (!data.length) return "Keine Rechnungen gefunden.";
        return `**Rechnungen (${data.length}):**\n` + data.map((inv: Record<string, string | number>) =>
          `• [${inv.status}] Rechnung ${inv.invoice_number} – ${inv._customer ?? "Unbekannt"} – CHF ${Number(inv.total ?? 0).toLocaleString("de-CH")} (fällig: ${inv.due_date ?? "–"})`
        ).join("\n");
      }
      case "list_overdue_invoices": {
        const data = await getOverdueInvoices();
        if (!data.length) return "Keine überfälligen Rechnungen. 🎉";
        const total = data.reduce((s: number, i: Record<string, number>) => s + (i.total ?? 0), 0);
        return `**Überfällige Rechnungen (${data.length}), Total: CHF ${total.toLocaleString("de-CH")}:**\n` +
          data.map((inv: Record<string, string | number>) =>
            `• Rechnung ${inv.invoice_number} – CHF ${Number(inv.total ?? 0).toLocaleString("de-CH")} – fällig seit ${inv.due_date}`
          ).join("\n");
      }
      case "list_projects": {
        const data = await listProjects(10, params.status as string);
        if (!data.length) return "Keine Projekte gefunden.";
        return `**Projekte (${data.length}):**\n` + data.map((p: Record<string, string | number>) =>
          `• [${p.status}] ${p.title} (Nr. ${p.project_number}) – Budget: CHF ${Number(p.budget ?? 0).toLocaleString("de-CH")}`
        ).join("\n");
      }
      case "list_leads": {
        const data = await listLeads(10, params.status as string);
        if (!data.length) return "Keine Leads gefunden.";
        return `**Leads (${data.length}):**\n` + data.map((l: Record<string, string | number>) =>
          `• [${l.status}] ${l.name} – ${l.company ?? "–"} – CHF ${Number(l.value ?? 0).toLocaleString("de-CH")}`
        ).join("\n");
      }
      case "create_lead": {
        const result = await createLead(params as Parameters<typeof createLead>[0]);
        const l = Array.isArray(result) ? result[0] : result;
        return `✅ Lead erstellt: **${l.name}** (${l.company ?? "–"}, ID: ${l.id})`;
      }
      case "dashboard": {
        const d = await getAppDashboard();
        return `**App-Dashboard:**\n• 👥 Kunden: ${d.customers}\n• 🎫 Offene Tickets: ${d.openTickets}\n• 📄 Offene Angebote: ${d.openQuotes}\n• ⚠️ Überfällige Rechnungen: ${d.overdueInvoices} (CHF ${d.overdueTotal.toLocaleString("de-CH")})\n• 🚀 Aktive Projekte: ${d.activeProjects}\n• 🎯 Neue Leads: ${d.newLeads}`;
      }
      default:
        return `Unbekannte App-Aktion: ${action}`;
    }
  } catch (e) {
    return `Fehler bei App-Aktion ${action}: ${String(e)}`;
  }
}
