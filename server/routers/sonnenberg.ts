import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";

const SONNENBERG_CONTEXT = `Du bist Jarvis, der persönliche Assistent von Stefan Gross, Leiter ICT beim SONNENBERG Baar.

SONNENBERG Baar ist ein Kompetenzzentrum Sehen Verhalten Sprechen in Baar, Kanton Zug.
Es ist eine führende Institution für Kinder, Jugendliche und Erwachsene mit Unterstützungsbedarf in den Bereichen Verhalten, Sprache, Sehen und Blindheit.

Stefan Gross ist Leiter ICT (Abteilungsleiter ICT) beim SONNENBERG Baar.
Er arbeitet 3 Tage pro Woche vor Ort in Baar und 2 Tage im Homeoffice.
E-Mail: stefan.gross@sonnenberg-baar.ch

Schreibe alle Dokumente auf Deutsch, professionell und institutionell. Verwende Schweizer Schreibweise (ss statt ß, CHF).
Berücksichtige den sozialen Auftrag der Institution bei allen Formulierungen.`;

export const sonnenbergRouter = router({
  // ── IT-Konzept generieren ─────────────────────────────────────────────────
  generateConcept: protectedProcedure
    .input(
      z.object({
        topic: z.string().min(1),
        scope: z.string().optional(),
        background: z.string().optional(),
        type: z
          .enum([
            "it_concept",
            "security_concept",
            "migration_plan",
            "infrastructure_plan",
            "other",
          ])
          .default("it_concept"),
      })
    )
    .mutation(async ({ input }) => {
      const typeLabels: Record<string, string> = {
        it_concept: "IT-Konzept",
        security_concept: "Sicherheitskonzept",
        migration_plan: "Migrationsplan",
        infrastructure_plan: "Infrastrukturkonzept",
        other: "Konzept",
      };
      const prompt = `${SONNENBERG_CONTEXT}

Erstelle ein professionelles ${typeLabels[input.type]} für den SONNENBERG Baar zum Thema: "${input.topic}"
${input.scope ? `Umfang/Scope: ${input.scope}` : ""}
${input.background ? `Hintergrund: ${input.background}` : ""}

Das Dokument soll enthalten:
1. Ausgangslage und Zielsetzung
2. Ist-Analyse (falls relevant)
3. Soll-Zustand / Lösungsansatz
4. Massnahmen und Umsetzungsschritte
5. Zeitplan und Ressourcen
6. Risiken und Massnahmen
7. Kosten (Schätzung in CHF, falls relevant)

Format: Markdown, professionell, für interne Verwendung beim SONNENBERG Baar.`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resp = await invokeLLM({
        model: "claude-sonnet-4-5",
        max_tokens: 3000,
        messages: [{ role: "user", content: prompt }] as any,
      });
      return { content: (resp.choices[0]?.message?.content as string) ?? "" };
    }),

  // ── Beschaffungsantrag generieren ─────────────────────────────────────────
  generateProcurement: protectedProcedure
    .input(
      z.object({
        item: z.string().min(1), // Was wird beschafft
        quantity: z.number().optional(),
        estimatedCost: z.number().optional(), // CHF
        justification: z.string().optional(),
        urgency: z.enum(["low", "medium", "high"]).default("medium"),
      })
    )
    .mutation(async ({ input }) => {
      const urgencyLabels = { low: "Tief", medium: "Mittel", high: "Hoch" };
      const prompt = `${SONNENBERG_CONTEXT}

Erstelle einen formellen Beschaffungsantrag für den SONNENBERG Baar:
- Beschaffungsgegenstand: ${input.item}
${input.quantity ? `- Menge: ${input.quantity} Stück` : ""}
${input.estimatedCost ? `- Geschätzte Kosten: CHF ${input.estimatedCost.toLocaleString("de-CH")}` : ""}
${input.justification ? `- Begründung: ${input.justification}` : ""}
- Dringlichkeit: ${urgencyLabels[input.urgency]}

Der Antrag soll enthalten:
1. Antragsteller: Stefan Gross, Leiter ICT, Datum: ${new Date().toLocaleDateString("de-CH")}
2. Beschreibung der Beschaffung
3. Begründung / Notwendigkeit (auch im Kontext der Institution)
4. Kostenaufstellung (inkl. Folgekosten wie Wartung, Lizenzen)
5. Alternativen (kurz)
6. Empfehlung
7. Unterschriftszeile für Genehmigung

Format: Markdown, formell, für interne Genehmigung.`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resp = await invokeLLM({
        model: "claude-sonnet-4-5",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }] as any,
      });
      return { content: (resp.choices[0]?.message?.content as string) ?? "" };
    }),

  // ── Sitzungsnotizen strukturieren ─────────────────────────────────────────
  structureMeetingNotes: protectedProcedure
    .input(
      z.object({
        rawNotes: z.string().min(1),
        meetingTitle: z.string().optional(),
        participants: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const prompt = `${SONNENBERG_CONTEXT}

Strukturiere folgende Sitzungsnotizen professionell:
${input.meetingTitle ? `Sitzung: ${input.meetingTitle}` : ""}
${input.participants ? `Teilnehmende: ${input.participants}` : ""}
Datum: ${new Date().toLocaleDateString("de-CH")}

Rohe Notizen:
${input.rawNotes}

Erstelle ein strukturiertes Protokoll mit:
1. Sitzungsinformationen (Titel, Datum, Teilnehmende)
2. Traktanden / Besprochene Punkte
3. Beschlüsse und Entscheidungen
4. Offene Punkte / Pendenzen (mit Verantwortlichen falls erwähnt)
5. Nächste Schritte

Format: Markdown, professionell, klar strukturiert.`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resp = await invokeLLM({
        model: "claude-sonnet-4-5",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }] as any,
      });
      return { content: (resp.choices[0]?.message?.content as string) ?? "" };
    }),

  // ── IT-Statusbericht generieren ───────────────────────────────────────────
  generateStatusReport: protectedProcedure
    .input(
      z.object({
        period: z.string().optional(), // z.B. "August 2026"
        completedItems: z.string().optional(),
        ongoingItems: z.string().optional(),
        plannedItems: z.string().optional(),
        issues: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const period =
        input.period ??
        new Date().toLocaleDateString("de-CH", {
          month: "long",
          year: "numeric",
        });
      const prompt = `${SONNENBERG_CONTEXT}

Erstelle einen IT-Statusbericht für den SONNENBERG Baar für den Zeitraum: ${period}

${input.completedItems ? `Erledigte Aufgaben/Projekte:\n${input.completedItems}` : ""}
${input.ongoingItems ? `\nLaufende Projekte:\n${input.ongoingItems}` : ""}
${input.plannedItems ? `\nGeplante Massnahmen:\n${input.plannedItems}` : ""}
${input.issues ? `\nProbleme/Herausforderungen:\n${input.issues}` : ""}

Der Statusbericht soll enthalten:
1. Zusammenfassung (Executive Summary)
2. Erledigte Aufgaben und Projekte
3. Laufende Projekte (mit Status)
4. Geplante Massnahmen nächste Periode
5. Herausforderungen und Risiken
6. Kennzahlen (falls relevant: Tickets, Ausfallzeiten, etc.)

Format: Markdown, professionell, für Geschäftsleitung oder Vorgesetzte.`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resp = await invokeLLM({
        model: "claude-sonnet-4-5",
        max_tokens: 2500,
        messages: [{ role: "user", content: prompt }] as any,
      });
      return { content: (resp.choices[0]?.message?.content as string) ?? "" };
    }),

  // ── Allgemeiner ICT-Text für Sonnenberg ───────────────────────────────────
  generateText: protectedProcedure
    .input(
      z.object({
        type: z.enum([
          "email",
          "announcement",
          "policy",
          "training_material",
          "other",
        ]),
        topic: z.string().min(1),
        details: z.string().optional(),
        audience: z
          .enum(["management", "staff", "external", "all"])
          .default("staff"),
      })
    )
    .mutation(async ({ input }) => {
      const typeLabels: Record<string, string> = {
        email: "E-Mail",
        announcement: "Ankündigung / Mitteilung",
        policy: "IT-Richtlinie / Policy",
        training_material: "Schulungsunterlagen",
        other: "Text",
      };
      const audienceLabels: Record<string, string> = {
        management: "Geschäftsleitung",
        staff: "Mitarbeitende",
        external: "externe Stellen",
        all: "alle Beteiligten",
      };
      const prompt = `${SONNENBERG_CONTEXT}

Schreibe einen ${typeLabels[input.type]} für den SONNENBERG Baar:
Thema: ${input.topic}
Zielgruppe: ${audienceLabels[input.audience]}
${input.details ? `Details: ${input.details}` : ""}

Berücksichtige den sozialen Auftrag der Institution. Schreibe professionell, klar und verständlich.
Format: Markdown.`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resp = await invokeLLM({
        model: "claude-sonnet-4-5",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }] as any,
      });
      return { content: (resp.choices[0]?.message?.content as string) ?? "" };
    }),
});
