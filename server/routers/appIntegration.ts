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
    sbFetch(`/invoices?status=in.(open,sent)&select=id,total&limit=1000`),
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


// ── Angebot erstellen mit Positionen ─────────────────────────────────────────
export async function createQuoteWithItems(data: {
  customer_id: string; notes?: string; valid_until?: string;
  items: Array<{ description: string; quantity: number; unit_price: number; vat_rate?: number; unit?: string }>;
}) {
  const quote = await sbFetch("/quotes", { method: "POST", body: JSON.stringify({
    customer_id: data.customer_id, quote_date: new Date().toISOString().split("T")[0],
    valid_until: data.valid_until, notes: data.notes, status: "draft",
    subtotal: data.items.reduce((s, i) => s + i.quantity * i.unit_price, 0),
    total: data.items.reduce((s, i) => s + i.quantity * i.unit_price * (1 + (i.vat_rate ?? 8.1) / 100), 0),
    tax: data.items.reduce((s, i) => s + i.quantity * i.unit_price * (i.vat_rate ?? 8.1) / 100, 0),
  }) });
  const q = Array.isArray(quote) ? quote[0] : quote;
  for (const item of data.items) {
    await sbFetch("/quote_items", { method: "POST", body: JSON.stringify({
      quote_id: q.id, description: item.description, quantity: item.quantity,
      unit_price: item.unit_price, vat_rate: item.vat_rate ?? 8.1,
      total: item.quantity * item.unit_price, unit: item.unit ?? "Stk.",
    }) });
  }
  return q;
}

// ── Rechnung als bezahlt markieren ────────────────────────────────────────────
export async function markInvoicePaid(id: string) {
  return sbFetch(`/invoices?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({
    status: "paid", paid_amount: null, updated_at: new Date().toISOString(),
  }) });
}

// ── Rechnung erstellen ────────────────────────────────────────────────────────
export async function createInvoice(data: {
  customer_id: string; due_date?: string; notes?: string;
  items: Array<{ description: string; quantity: number; unit_price: number; vat_rate?: number; unit?: string }>;
}) {
  const subtotal = data.items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const vat = data.items.reduce((s, i) => s + i.quantity * i.unit_price * (i.vat_rate ?? 8.1) / 100, 0);
  const invoice = await sbFetch("/invoices", { method: "POST", body: JSON.stringify({
    customer_id: data.customer_id, invoice_date: new Date().toISOString().split("T")[0],
    due_date: data.due_date ?? new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    notes: data.notes, status: "unpaid", subtotal, vat_amount: vat, total: subtotal + vat,
  }) });
  const inv = Array.isArray(invoice) ? invoice[0] : invoice;
  for (const item of data.items) {
    await sbFetch("/invoice_items", { method: "POST", body: JSON.stringify({
      invoice_id: inv.id, description: item.description, quantity: item.quantity,
      unit_price: item.unit_price, vat_rate: item.vat_rate ?? 8.1,
      total: item.quantity * item.unit_price, unit: item.unit ?? "Stk.",
    }) });
  }
  return inv;
}

// ── Ticket-Kommentar hinzufügen ───────────────────────────────────────────────
export async function addTicketComment(ticketId: string, comment: string, isInternal = false) {
  return sbFetch("/ticket_comments", { method: "POST", body: JSON.stringify({
    ticket_id: ticketId, comment, is_internal: isInternal,
    user_name: "Jarvis (Stefan Gross)", is_system: false,
  }) });
}

// ── Ticket-Priorität ändern ───────────────────────────────────────────────────
export async function updateTicketPriority(id: string, priority: string) {
  return sbFetch(`/tickets?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ priority, updated_at: new Date().toISOString() }) });
}

// ── Verträge ──────────────────────────────────────────────────────────────────
export async function listContracts(limit = 20, status?: string) {
  const q = status ? `?status=eq.${status}&limit=${limit}&order=created_at.desc` : `?limit=${limit}&order=created_at.desc`;
  const contracts = await sbFetch(`/contracts${q}`);
  for (const c of contracts) {
    if (c.customer_id) {
      try { const cu = await getCustomer(c.customer_id); c._customer = cu ? (cu.company_name || `${cu.first_name ?? ""} ${cu.last_name ?? ""}`.trim()) : "Unbekannt"; }
      catch { c._customer = "Unbekannt"; }
    }
  }
  return contracts;
}

// ── Ausgaben ──────────────────────────────────────────────────────────────────
export async function listExpenses(limit = 20) {
  return sbFetch(`/expenses?limit=${limit}&order=expense_date.desc`);
}

export async function createExpense(data: {
  description: string; amount: number; category?: string;
  expense_date?: string; notes?: string; supplier?: string;
}) {
  return sbFetch("/expenses", { method: "POST", body: JSON.stringify({
    ...data, expense_date: data.expense_date ?? new Date().toISOString().split("T")[0],
    vat_rate: 8.1,
  }) });
}

// ── Projektaufgaben ───────────────────────────────────────────────────────────
export async function listProjectTasks(projectId: string) {
  return sbFetch(`/project_tasks?project_id=eq.${projectId}&order=sort_order.asc`);
}

export async function createProjectTask(data: {
  project_id: string; title: string; description?: string;
  status?: string; priority?: string; due_date?: string;
}) {
  return sbFetch("/project_tasks", { method: "POST", body: JSON.stringify({
    ...data, status: data.status ?? "todo", priority: data.priority ?? "medium",
  }) });
}

// ── Produkte ──────────────────────────────────────────────────────────────────
export async function listProducts(limit = 30) {
  return sbFetch(`/products?is_active=eq.true&limit=${limit}&order=name.asc`);
}

// ── Lead-Status ändern ────────────────────────────────────────────────────────
export async function updateLeadStatus(id: string, status: string) {
  return sbFetch(`/leads?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status, updated_at: new Date().toISOString() }) });
}

// ── Projekt erstellen ─────────────────────────────────────────────────────────
export async function createProject(data: {
  title: string; description?: string; customer_id?: string;
  status?: string; budget?: number; start_date?: string; end_date?: string; priority?: string;
}) {
  return sbFetch("/projects", { method: "POST", body: JSON.stringify({
    ...data, status: data.status ?? "active", priority: data.priority ?? "medium",
  }) });
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

      case "create_quote": {
        const result = await createQuoteWithItems(params as Parameters<typeof createQuoteWithItems>[0]);
        return `✅ Angebot erstellt: **Angebot ${result.quote_number}** für Kunde ${params.customer_id} (ID: ${result.id}, Total: CHF ${Number(result.total ?? 0).toLocaleString("de-CH")})`;
      }
      case "create_invoice": {
        const result = await createInvoice(params as Parameters<typeof createInvoice>[0]);
        return `✅ Rechnung erstellt: **Rechnung ${result.invoice_number}** (ID: ${result.id}, Total: CHF ${Number(result.total ?? 0).toLocaleString("de-CH")}, fällig: ${result.due_date})`;
      }
      case "mark_invoice_paid": {
        await markInvoicePaid(params.id as string);
        return `✅ Rechnung ${params.id} als **bezahlt** markiert.`;
      }
      case "add_ticket_comment": {
        await addTicketComment(params.ticket_id as string, params.comment as string, params.is_internal as boolean ?? false);
        return `✅ Kommentar zu Ticket ${params.ticket_id} hinzugefügt.`;
      }
      case "update_ticket_priority": {
        await updateTicketPriority(params.id as string, params.priority as string);
        return `✅ Ticket ${params.id} Priorität auf **${params.priority}** gesetzt.`;
      }
      case "list_contracts": {
        const data = await listContracts(10, params.status as string);
        if (!data.length) return "Keine Verträge gefunden.";
        return `**Verträge (${data.length}):**\n` + data.map((c: Record<string, string | number>) =>
          `• [${c.status}] ${c.title} – ${c._customer ?? "–"} – CHF ${Number(c.amount ?? 0).toLocaleString("de-CH")}/Mt. (bis: ${c.end_date ?? "unbefristet"})`
        ).join("\n");
      }
      case "list_expenses": {
        const data = await listExpenses(10);
        if (!data.length) return "Keine Ausgaben gefunden.";
        const total = data.reduce((s: number, e: Record<string, number>) => s + (e.amount ?? 0), 0);
        return `**Ausgaben (${data.length}), Total: CHF ${total.toLocaleString("de-CH")}:**\n` +
          data.map((e: Record<string, string | number>) =>
            `• ${e.expense_date} – ${e.description} – CHF ${Number(e.amount ?? 0).toLocaleString("de-CH")} (${e.category ?? "–"})`
          ).join("\n");
      }
      case "create_expense": {
        const result = await createExpense(params as Parameters<typeof createExpense>[0]);
        const e = Array.isArray(result) ? result[0] : result;
        return `✅ Ausgabe erfasst: **${e.description}** – CHF ${Number(e.amount ?? 0).toLocaleString("de-CH")}`;
      }
      case "list_products": {
        const data = await listProducts();
        if (!data.length) return "Keine Produkte gefunden.";
        return `**Produkte (${data.length}):**\n` + data.map((p: Record<string, string | number>) =>
          `• ${p.name} – CHF ${Number(p.price ?? 0).toLocaleString("de-CH")} / ${p.unit ?? "Stk."} (${p.category ?? "–"})`
        ).join("\n");
      }
      case "list_project_tasks": {
        const data = await listProjectTasks(params.project_id as string);
        if (!data.length) return "Keine Aufgaben für dieses Projekt.";
        return `**Projektaufgaben (${data.length}):**\n` + data.map((t: Record<string, string>) =>
          `• [${t.status}] ${t.title} (${t.priority ?? "medium"})`
        ).join("\n");
      }
      case "create_project_task": {
        const result = await createProjectTask(params as Parameters<typeof createProjectTask>[0]);
        const t = Array.isArray(result) ? result[0] : result;
        return `✅ Aufgabe erstellt: **${t.title}** in Projekt ${params.project_id}`;
      }
      case "create_project": {
        const result = await createProject(params as Parameters<typeof createProject>[0]);
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
