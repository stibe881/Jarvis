import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createTemplate,
  getTemplatesByUser,
  getTemplateById,
  updateTemplate,
  deleteTemplate,
  incrementTemplateUsage,
} from "../db";
import { invokeLLM } from "../_core/llm";
import { TRPCError } from "@trpc/server";

const categoryEnum = z.enum([
  "quote",
  "invoice",
  "concept",
  "report",
  "email",
  "procurement",
  "minutes",
  "other",
]);
const contextEnum = z.enum(["gross_ict", "sonnenberg", "general"]);

// Platzhalter aus Vorlagentext extrahieren: {{name}}
function extractPlaceholders(content: string): string[] {
  const rx = /\{\{\s*([a-zA-Z0-9_äöüÄÖÜ\s-]+?)\s*\}\}/g;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = rx.exec(content)) !== null) found.add(m[1].trim());
  return Array.from(found);
}

// Standard-Vorlagen für Gross ICT und Sonnenberg
const STARTER_TEMPLATES: Array<{
  name: string;
  category: z.infer<typeof categoryEnum>;
  context: z.infer<typeof contextEnum>;
  description: string;
  content: string;
}> = [
  {
    name: "Angebot Webseite (Gross ICT)",
    category: "quote",
    context: "gross_ict",
    description: "Standard-Angebot für eine KMU-Webseite mit Festpreis.",
    content: `# Angebot – Webseite {{Kundenname}}

**Gross ICT** · Stefan Gross · gross-ict.ch
Datum: {{Datum}}
Angebots-Nr.: {{Angebotsnummer}}

## Ausgangslage
{{Ausgangslage}}

## Leistungsumfang
| Position | Beschreibung | Betrag (CHF) |
|---|---|---|
| 1 | Konzept und Struktur | {{Betrag Konzept}} |
| 2 | Design und Umsetzung | {{Betrag Umsetzung}} |
| 3 | Inhalte einpflegen | {{Betrag Inhalte}} |
| 4 | Suchmaschinen-Grundoptimierung | {{Betrag SEO}} |
| 5 | Schulung und Übergabe | {{Betrag Schulung}} |

**Gesamtbetrag: CHF {{Gesamtbetrag}}** (exkl. MWST)

## Nicht enthalten
{{Ausschluesse}}

## Termine
Start: {{Startdatum}} · Fertigstellung: {{Fertigstellung}}

## Konditionen
Zahlung: 50 % bei Auftragserteilung, 50 % nach Abnahme. Gültigkeit: 30 Tage.

Freundliche Grüsse
Stefan Gross, Gross ICT`,
  },
  {
    name: "Zahlungserinnerung (Gross ICT)",
    category: "email",
    context: "gross_ict",
    description: "Freundliche erste Zahlungserinnerung für offene Rechnungen.",
    content: `Betreff: Zahlungserinnerung Rechnung {{Rechnungsnummer}}

Guten Tag {{Anrede}}

Bei der Durchsicht unserer Buchhaltung ist mir aufgefallen, dass die Rechnung {{Rechnungsnummer}} vom {{Rechnungsdatum}} über CHF {{Betrag}} noch offen ist. Die Zahlungsfrist ist am {{Faelligkeitsdatum}} abgelaufen.

Vermutlich ist die Rechnung untergegangen – ich bitte Sie, den Betrag bis {{Neue Frist}} zu überweisen. Sollten Sie die Zahlung bereits ausgelöst haben, betrachten Sie diese Nachricht als gegenstandslos.

Bei Fragen zur Rechnung stehe ich gerne zur Verfügung.

Freundliche Grüsse
Stefan Gross
Gross ICT · gross-ict.ch`,
  },
  {
    name: "IT-Konzept (Sonnenberg)",
    category: "concept",
    context: "sonnenberg",
    description:
      "Struktur für ein IT-Konzept zur Vorlage bei der Geschäftsleitung.",
    content: `# IT-Konzept: {{Titel}}

Kompetenzzentrum Sonnenberg, Baar · Abteilung ICT
Verfasser: Stefan Gross, Leiter ICT · Datum: {{Datum}}

## 1. Ausgangslage
{{Ausgangslage}}

## 2. Handlungsbedarf
{{Handlungsbedarf}}

## 3. Zielsetzung
{{Ziele}}

## 4. Lösungsvarianten
### Variante A – {{Variante A}}
Beschreibung, Vorteile, Nachteile, Kosten: CHF {{Kosten A}}

### Variante B – {{Variante B}}
Beschreibung, Vorteile, Nachteile, Kosten: CHF {{Kosten B}}

## 5. Empfehlung
{{Empfehlung}}

## 6. Kosten und Finanzierung
Investition: CHF {{Investition}} · Wiederkehrend pro Jahr: CHF {{Betriebskosten}}

## 7. Umsetzungsplan
{{Umsetzungsplan}}

## 8. Risiken und Massnahmen
{{Risiken}}

## 9. Antrag
{{Antrag}}`,
  },
  {
    name: "Beschaffungsantrag (Sonnenberg)",
    category: "procurement",
    context: "sonnenberg",
    description:
      "Antrag für eine ICT-Beschaffung inklusive Begründung und Kosten.",
    content: `# Beschaffungsantrag {{Beschaffungsnummer}}

Kompetenzzentrum Sonnenberg, Baar · Abteilung ICT
Antragsteller: Stefan Gross, Leiter ICT · Datum: {{Datum}}

## Gegenstand
{{Gegenstand}}

## Begründung
{{Begruendung}}

## Angebotsvergleich
| Anbieter | Lösung | Preis (CHF) | Bemerkung |
|---|---|---|---|
| {{Anbieter 1}} | {{Loesung 1}} | {{Preis 1}} | {{Bemerkung 1}} |
| {{Anbieter 2}} | {{Loesung 2}} | {{Preis 2}} | {{Bemerkung 2}} |
| {{Anbieter 3}} | {{Loesung 3}} | {{Preis 3}} | {{Bemerkung 3}} |

## Empfehlung
{{Empfehlung}}

## Kosten
Investition einmalig: CHF {{Investition}}
Betriebskosten pro Jahr: CHF {{Betriebskosten}}
Budgetposition: {{Budgetposition}}

## Termin
Gewünschte Beschaffung bis: {{Termin}}

## Unterschriften
Antragsteller: ________________  Geschäftsleitung: ________________`,
  },
  {
    name: "Sitzungsprotokoll",
    category: "minutes",
    context: "general",
    description: "Strukturiertes Protokoll mit Beschlüssen und Pendenzen.",
    content: `# Protokoll: {{Sitzungstitel}}

Datum: {{Datum}} · Zeit: {{Zeit}} · Ort: {{Ort}}
Teilnehmende: {{Teilnehmende}}
Protokoll: Stefan Gross

## 1. Traktanden
{{Traktanden}}

## 2. Besprochene Punkte
{{Inhalt}}

## 3. Beschlüsse
| Nr. | Beschluss | Verantwortlich |
|---|---|---|
| 1 | {{Beschluss 1}} | {{Verantwortlich 1}} |
| 2 | {{Beschluss 2}} | {{Verantwortlich 2}} |

## 4. Pendenzen
| Nr. | Aufgabe | Verantwortlich | Termin |
|---|---|---|---|
| 1 | {{Pendenz 1}} | {{Wer 1}} | {{Termin 1}} |
| 2 | {{Pendenz 2}} | {{Wer 2}} | {{Termin 2}} |

## 5. Nächste Sitzung
{{Naechste Sitzung}}`,
  },
  {
    name: "IT-Statusbericht (Sonnenberg)",
    category: "report",
    context: "sonnenberg",
    description: "Monatlicher Statusbericht der Abteilung ICT.",
    content: `# ICT-Statusbericht {{Periode}}

Kompetenzzentrum Sonnenberg, Baar · Leiter ICT: Stefan Gross

## Kurzfazit
{{Kurzfazit}}

## Laufende Projekte
| Projekt | Status | Fortschritt | Bemerkung |
|---|---|---|---|
| {{Projekt 1}} | {{Status 1}} | {{Fortschritt 1}} | {{Bemerkung 1}} |
| {{Projekt 2}} | {{Status 2}} | {{Fortschritt 2}} | {{Bemerkung 2}} |

## Betrieb und Support
Tickets erledigt: {{Tickets erledigt}} · Offen: {{Tickets offen}}
Verfügbarkeit: {{Verfuegbarkeit}}

## Sicherheit
{{Sicherheit}}

## Kosten
Budgetverbrauch: {{Budgetverbrauch}}

## Ausblick
{{Ausblick}}`,
  },
];

export const templatesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return getTemplatesByUser(ctx.user.id);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return getTemplateById(input.id, ctx.user.id);
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        category: categoryEnum.default("other"),
        context: contextEnum.default("general"),
        description: z.string().optional(),
        content: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const placeholders = extractPlaceholders(input.content);
      return createTemplate({
        userId: ctx.user.id,
        name: input.name,
        category: input.category,
        context: input.context,
        description: input.description ?? null,
        content: input.content,
        placeholders: JSON.stringify(placeholders),
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        category: categoryEnum.optional(),
        context: contextEnum.optional(),
        description: z.string().optional(),
        content: z.string().optional(),
        isFavorite: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const data: Record<string, unknown> = { ...rest };
      if (rest.content)
        data.placeholders = JSON.stringify(extractPlaceholders(rest.content));
      await updateTemplate(id, ctx.user.id, data);
      return { success: true };
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteTemplate(input.id, ctx.user.id);
      return { success: true };
    }),

  // Standard-Vorlagen einmalig anlegen
  seedStarters: protectedProcedure.mutation(async ({ ctx }) => {
    const existing = await getTemplatesByUser(ctx.user.id);
    const existingNames = new Set(existing.map(t => t.name));
    let added = 0;
    for (const t of STARTER_TEMPLATES) {
      if (existingNames.has(t.name)) continue;
      await createTemplate({
        userId: ctx.user.id,
        name: t.name,
        category: t.category,
        context: t.context,
        description: t.description,
        content: t.content,
        placeholders: JSON.stringify(extractPlaceholders(t.content)),
      });
      added++;
    }
    return { added };
  }),

  // Vorlage ausfüllen: bekannte Werte einsetzen, Rest von Jarvis ergänzen lassen
  fill: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        values: z.record(z.string(), z.string()),
        autoComplete: z.boolean().default(false),
        extraContext: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tpl = await getTemplateById(input.id, ctx.user.id);
      if (!tpl)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Vorlage nicht gefunden.",
        });

      let result = tpl.content;
      for (const [key, value] of Object.entries(input.values)) {
        const rx = new RegExp(
          `\\{\\{\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\}\\}`,
          "g"
        );
        result = result.replace(rx, value);
      }

      if (input.autoComplete) {
        const remaining = extractPlaceholders(result);
        if (remaining.length > 0) {
          const prompt = `Du bist Jarvis, der Assistent von Stefan Gross (Gross ICT und Leiter ICT im Kompetenzzentrum Sonnenberg in Baar).
Fülle im folgenden Dokument alle noch offenen Platzhalter in der Form {{Platzhalter}} mit plausiblen, professionellen Inhalten aus.
Schweizer Schreibweise: "ss" statt "ß", CHF als Währung, Datumsformat dd.mm.yyyy.
Gib NUR das fertige Dokument zurück, ohne Erklärungen und ohne Codeblock.

${input.extraContext ? `Zusätzlicher Kontext von Stefan:\n${input.extraContext}\n\n` : ""}Dokument:
${result}`;
          const resp = await invokeLLM({
            model: "claude-sonnet-4-5",
            max_tokens: 4000,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            messages: [{ role: "user", content: prompt }] as any,
          });
          const filled = (resp.choices[0]?.message?.content as string) ?? "";
          if (filled.trim()) result = filled.trim();
        }
      }

      await incrementTemplateUsage(input.id, ctx.user.id);
      return { content: result, name: tpl.name };
    }),
});
