import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import {
  getAppDashboard,
  listCustomers,
  listTickets,
  listQuotes,
  listInvoices,
  listProjects,
  listLeads,
  getOverdueInvoices,
  listContracts,
  listExpenses,
  listProducts,
  getCustomerDossier,
} from "./appIntegration";

export const appDashboardRouter = router({
  summary: protectedProcedure.query(() => getAppDashboard()),
  customers: protectedProcedure
    .input(
      z.object({ search: z.string().optional(), limit: z.number().default(20) })
    )
    .query(({ input }) => listCustomers(input.limit, input.search)),
  tickets: protectedProcedure
    .input(z.object({ status: z.string().optional() }))
    .query(({ input }) => listTickets(20, input.status)),
  quotes: protectedProcedure
    .input(z.object({ status: z.string().optional() }))
    .query(({ input }) => listQuotes(20, input.status)),
  invoices: protectedProcedure
    .input(z.object({ status: z.string().optional() }))
    .query(({ input }) => listInvoices(20, input.status)),
  overdueInvoices: protectedProcedure.query(() => getOverdueInvoices()),
  projects: protectedProcedure
    .input(z.object({ status: z.string().optional() }))
    .query(({ input }) => listProjects(20, input.status)),
  leads: protectedProcedure
    .input(z.object({ status: z.string().optional() }))
    .query(({ input }) => listLeads(20, input.status)),
  contracts: protectedProcedure
    .input(z.object({ status: z.string().optional() }))
    .query(({ input }) => listContracts(20, input.status)),
  expenses: protectedProcedure.query(() => listExpenses(30)),
  products: protectedProcedure.query(() => listProducts(50)),
  /** Vollständiges Kunden-Dossier: Stammdaten, Tickets, Angebote, Rechnungen, Projekte, Verträge */
  customerDossier: protectedProcedure
    .input(z.object({ idOrName: z.string().min(1) }))
    .query(({ input }) => getCustomerDossier(input.idOrName)),
});
