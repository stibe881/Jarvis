import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { grossIctProjects, grossIctQuotes } from "../../drizzle/schema";
import { and, eq, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { TRPCError } from "@trpc/server";

const GROSS_ICT_CONTEXT = `Du bist Jarvis, der persönliche Assistent von Stefan Gross, Inhaber von Gross ICT (gross-ict.ch).
Gross ICT ist eine regionale ICT-Agentur in der Zentralschweiz (Sitz: Zell, Luzern) für KMU, Vereine und Privatpersonen.

Leistungen und Preise:
- Webseiten: ab CHF 1'500 (Festpreis, suchmaschinenfreundlich, selbst pflegbar)
- Web-Applikationen: ab CHF 15'000 (Kundenportale, Buchungssysteme, individuelle Tools)
- Mobile Apps (iOS/Android): ab CHF 20'000
- IT-Support & Helpdesk: auf Anfrage
- Netzwerk & WLAN-Planung: auf Anfrage
- Security (Netzwerk, Endgeräte, Daten): auf Anfrage
- Server (lokal, Cloud, hybrid, Backup): auf Anfrage

Stil: professionell, direkt, lokal verankert, kein Callcenter, ein Ansprechpartner, Festpreise.
Sprache: Deutsch (Schweizer Stil, CHF statt €).`;

export const grossIctRouter = router({
  // ── Projekte ──────────────────────────────────────────────────────────────
  listProjects: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(grossIctProjects)
      .where(eq(grossIctProjects.userId, ctx.user.id))
      .orderBy(desc(grossIctProjects.updatedAt));
  }),

  createProject: protectedProcedure
    .input(
      z.object({
        customerName: z.string().min(1),
        customerEmail: z.string().email().optional(),
        customerPhone: z.string().optional(),
        projectTitle: z.string().min(1),
        description: z.string().optional(),
        service: z
          .enum([
            "website",
            "webapp",
            "app",
            "support",
            "security",
            "network",
            "server",
            "other",
          ])
          .default("other"),
        status: z
          .enum(["lead", "offer", "active", "completed", "cancelled"])
          .default("lead"),
        budget: z.number().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db
        .insert(grossIctProjects)
        .values({ userId: ctx.user.id, ...input })
        .$returningId();
      return result;
    }),

  updateProject: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        customerName: z.string().optional(),
        customerEmail: z.string().optional(),
        customerPhone: z.string().optional(),
        projectTitle: z.string().optional(),
        description: z.string().optional(),
        service: z
          .enum([
            "website",
            "webapp",
            "app",
            "support",
            "security",
            "network",
            "server",
            "other",
          ])
          .optional(),
        status: z
          .enum(["lead", "offer", "active", "completed", "cancelled"])
          .optional(),
        budget: z.number().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...data } = input;
      await db
        .update(grossIctProjects)
        .set(data)
        .where(
          and(
            eq(grossIctProjects.id, id),
            eq(grossIctProjects.userId, ctx.user.id)
          )
        );
      return { success: true };
    }),

  deleteProject: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .delete(grossIctProjects)
        .where(
          and(
            eq(grossIctProjects.id, input.id),
            eq(grossIctProjects.userId, ctx.user.id)
          )
        );
      return { success: true };
    }),

  // ── Angebote ──────────────────────────────────────────────────────────────
  listQuotes: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(grossIctQuotes)
      .where(eq(grossIctQuotes.userId, ctx.user.id))
      .orderBy(desc(grossIctQuotes.updatedAt));
  }),

  generateQuote: protectedProcedure
    .input(
      z.object({
        customerName: z.string(),
        customerEmail: z.string().optional(),
        service: z.string(),
        requirements: z.string(), // Freitext-Beschreibung der Anforderungen
        budget: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const prompt = `${GROSS_ICT_CONTEXT}

Erstelle ein professionelles Angebot für folgenden Kunden:
- Kunde: ${input.customerName}
- Leistung: ${input.service}
- Anforderungen: ${input.requirements}
${input.budget ? `- Budget: CHF ${input.budget}` : ""}

Das Angebot soll enthalten:
1. Kurze Einleitung (persönlich, lokal)
2. Leistungsbeschrieb (was genau wird geliefert)
3. Preis (Festpreis in CHF, aufgeschlüsselt wenn sinnvoll)
4. Zeitplan (realistisch)
5. Nächste Schritte

Format: Markdown, professionell, auf Deutsch (Schweizer Stil).`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resp = await invokeLLM({
        model: "claude-sonnet-4-5",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }] as any,
      });
      const content = (resp.choices[0]?.message?.content as string) ?? "";

      // Angebot in DB speichern
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const title = `Angebot ${input.service} – ${input.customerName}`;
      const [result] = await db
        .insert(grossIctQuotes)
        .values({
          userId: ctx.user.id,
          customerName: input.customerName,
          customerEmail: input.customerEmail ?? null,
          title,
          content,
          totalAmount: input.budget ?? null,
          status: "draft",
        })
        .$returningId();

      return { id: result?.id, title, content };
    }),

  updateQuoteStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["draft", "sent", "accepted", "rejected"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(grossIctQuotes)
        .set({ status: input.status })
        .where(
          and(
            eq(grossIctQuotes.id, input.id),
            eq(grossIctQuotes.userId, ctx.user.id)
          )
        );
      return { success: true };
    }),

  deleteQuote: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .delete(grossIctQuotes)
        .where(
          and(
            eq(grossIctQuotes.id, input.id),
            eq(grossIctQuotes.userId, ctx.user.id)
          )
        );
      return { success: true };
    }),

  // ── Text-Assistent ────────────────────────────────────────────────────────
  generateText: protectedProcedure
    .input(
      z.object({
        type: z.enum([
          "blog",
          "service_description",
          "social_media",
          "email",
          "other",
        ]),
        topic: z.string(),
        details: z.string().optional(),
        tone: z
          .enum(["professional", "friendly", "technical"])
          .default("professional"),
      })
    )
    .mutation(async ({ input }) => {
      const typeLabels: Record<string, string> = {
        blog: "Blogartikel",
        service_description: "Leistungsbeschrieb für die Website",
        social_media: "Social-Media-Post (LinkedIn/Instagram)",
        email: "E-Mail an Kunden",
        other: "Text",
      };
      const toneLabels: Record<string, string> = {
        professional: "professionell und seriös",
        friendly: "freundlich und persönlich",
        technical: "technisch und präzise",
      };

      const prompt = `${GROSS_ICT_CONTEXT}

Schreibe einen ${typeLabels[input.type]} für Gross ICT zum Thema: "${input.topic}"
${input.details ? `Zusätzliche Details: ${input.details}` : ""}
Ton: ${toneLabels[input.tone]}

Der Text soll zum Stil von gross-ict.ch passen: lokal verankert, direkt, kein Marketing-Blabla, ein konkreter Ansprechpartner.
Format: Markdown.`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resp = await invokeLLM({
        model: "claude-sonnet-4-5",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }] as any,
      });
      const content = (resp.choices[0]?.message?.content as string) ?? "";
      return { content };
    }),
});
