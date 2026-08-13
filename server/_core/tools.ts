import { Tool } from "./llm";

export const jarvisTools: Tool[] = [
  {
    type: "function",
    function: {
      name: "app_action",
      description:
        "App-spezifische Aktionen ausführen (z.B. Angebote, Rechnungen, Tickets)",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string" },
        },
        additionalProperties: true,
      } as any,
    },
  },
  {
    type: "function",
    function: {
      name: "calendar_action",
      description:
        "Google Kalender verwalten (Termine auslesen, erstellen, aktualisieren, löschen)",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: [
              "list_events",
              "create_event",
              "update_event",
              "delete_event",
              "invite_attendee",
              "get_event",
            ],
          },
          days: { type: "number" },
          summary: { type: "string" },
          start_time: {
            type: "string",
            description: "ISO 8601 Datum/Uhrzeit (z.B. 2024-05-20T10:00:00Z)",
          },
          end_time: { type: "string" },
          eventId: { type: "string" },
          email: { type: "string" },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "memory_action",
      description:
        "Wissen über den Nutzer dauerhaft speichern (Fakten, Vorlieben, Kontaktinfos)",
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["person", "contact", "preference", "project", "fact"],
          },
          key: { type: "string" },
          value: { type: "string" },
        },
        required: ["category", "key", "value"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "spotify_action",
      description: "Spotify steuern (Play, Pause, Next, Volume)",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: [
              "play",
              "pause",
              "next",
              "previous",
              "volume",
              "current",
              "playlists",
              "devices",
            ],
          },
          query: { type: "string" },
          type: {
            type: "string",
            enum: ["track", "album", "playlist", "artist"],
          },
          level: { type: "number" },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "device_action",
      description: "Aktionen auf dem iPhone auslösen (WhatsApp, Wecker, Timer)",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["whatsapp", "alarm", "timer"] },
          recipient: { type: "string" },
          message: { type: "string" },
          time: { type: "string", description: "Uhrzeit z.B. 06:30" },
          minutes: { type: "number" },
        },
        required: ["type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "notes_action",
      description: "Notizen des Nutzers abrufen oder neue anlegen",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "search", "create"] },
          search: { type: "string" },
          title: { type: "string" },
          content: { type: "string" },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "tasks_action",
      description: "Aufgaben des Nutzers verwalten",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "create"] },
          title: { type: "string" },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          dueDate: { type: "string", description: "ISO 8601 Date" },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_task",
      description:
        "Eine autonome Aufgabe planen, die Jarvis im Hintergrund für den Nutzer ausführt (einmalig oder wiederkehrend).",
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description:
              "Der klare Auftrag für Jarvis (z.B. 'Prüfe meine neuen E-Mails' oder 'Fasse den Bericht zusammen').",
          },
          cronExpression: {
            type: "string",
            description:
              "Optional: Ein Cron-Ausdruck für wiederkehrende Tasks (z.B. '0 8 * * *' für jeden Tag um 08:00 Uhr). Wenn leer, wird der Task als einmalig (sofort) interpretiert.",
          },
          runAt: {
            type: "string",
            description:
              "Optional: ISO 8601 Datum/Zeit für eine einmalige Ausführung in der Zukunft (z.B. '2024-05-20T10:00:00Z').",
          },
        },
        required: ["prompt"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "github_action",
      description:
        "GitHub Repositories abrufen (öffentliche Repos des Nutzers)",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list_repos", "get_repo"] },
          repoName: {
            type: "string",
            description: "Name des Repositories (nur für get_repo)",
          },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "email_action",
      description: "E-Mails abrufen (Microsoft 365 / Outlook)",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list_unread", "search"] },
          query: { type: "string" },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Eine Websuche durchführen (z.B. für Konkurrenz-Monitoring)",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "maps_action",
      description: "Google Maps Karte für den Nutzer einblenden (als Antwort-Widget)",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string" },
          mode: { type: "string", enum: ["place", "directions"] },
          origin: { type: "string" },
        },
        required: ["location", "mode"],
      },
    },
  },
];
