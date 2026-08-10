import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createDeviceCommand,
  getDeviceCommandsByUser,
  deleteDeviceCommand,
  markDeviceCommandDone,
} from "../db";

/**
 * Befehle, die auf dem iPhone über die Kurzbefehle-App ausgeführt werden.
 * Jarvis legt sie in die Queue, das iPhone holt sie über
 * GET /api/device/commands?key=<API-Key> ab.
 */
export type DeviceCommandType = "whatsapp" | "alarm" | "timer" | "reminder" | "speak";

/** Erzeugt einen lesbaren Text für die Bestätigung im Chat. */
export function describeDeviceCommand(type: string, params: Record<string, unknown>): string {
  const s = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : "");
  switch (type) {
    case "whatsapp":
      return `WhatsApp an ${s("recipient") || "Kontakt"}: „${s("message")}“`;
    case "alarm":
      return `Wecker um ${s("time")}${s("label") ? ` (${s("label")})` : ""}`;
    case "timer":
      return `Timer über ${params.minutes ?? "?"} Minuten${s("label") ? ` (${s("label")})` : ""}`;
    case "reminder":
      return `Erinnerung: „${s("message")}“${s("time") ? ` um ${s("time")}` : ""}`;
    case "speak":
      return `Ansage: „${s("text")}“`;
    default:
      return `Befehl ${type}`;
  }
}

/**
 * Legt einen Befehl in die Queue und gibt eine Antwort für den Chat zurück.
 */
export async function queueDeviceCommand(
  userId: number,
  type: string,
  params: Record<string, unknown>
): Promise<string> {
  const allowed = ["whatsapp", "alarm", "timer", "reminder", "speak"];
  if (!allowed.includes(type)) {
    return `Unbekannter Geräte-Befehl: ${type}`;
  }

  // Pflichtfelder prüfen, damit der Kurzbefehl nicht ins Leere läuft
  if (type === "whatsapp" && (!params.recipient || !params.message)) {
    return "Für eine WhatsApp-Nachricht brauche ich den Empfänger und den Text.";
  }
  if (type === "alarm" && !params.time) {
    return "Für welche Uhrzeit soll ich den Wecker stellen?";
  }
  if (type === "timer" && !params.minutes) {
    return "Über wie viele Minuten soll der Timer laufen?";
  }

  const summary = describeDeviceCommand(type, params);
  await createDeviceCommand(userId, type, params, summary);
  return `📲 An dein iPhone übergeben: ${summary}\n\n_Der Kurzbefehl führt den Befehl beim nächsten Abruf aus._`;
}

export const deviceRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await getDeviceCommandsByUser(ctx.user.id);
    return rows.map((r) => ({
      ...r,
      params: (() => { try { return JSON.parse(r.payload) as Record<string, unknown>; } catch { return {}; } })(),
    }));
  }),

  create: protectedProcedure
    .input(z.object({
      type: z.enum(["whatsapp", "alarm", "timer", "reminder", "speak"]),
      recipient: z.string().optional(),
      message: z.string().optional(),
      time: z.string().optional(),
      minutes: z.number().optional(),
      label: z.string().optional(),
      text: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { type, ...params } = input;
      const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined));
      const message = await queueDeviceCommand(ctx.user.id, type, clean);
      return { message };
    }),

  markDone: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await markDeviceCommandDone(input.id, ctx.user.id);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteDeviceCommand(input.id, ctx.user.id);
      return { success: true };
    }),
});
