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
      name: "news_action",
      description: "Die neuesten Nachrichten (News) von SRF, Blick und 20 Minuten abrufen.",
      parameters: {
        type: "object",
        properties: {
          source: { type: "string", description: "Optional: 'SRF', 'Blick' oder '20 Minuten'" }
        },
        required: [],
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
  {
    type: "function",
    function: {
      name: "smarthome_action",
      description: "Interaktion mit der Smarthome Pro App (Lese- und Schreibzugriff auf alle Tabellen der Supabase-Datenbank)",
      parameters: {
        type: "object",
        properties: {
          table: { type: "string", description: "Name der Tabelle (z.B. family_routines, packing_lists, household_cameras)" },
          operation: { type: "string", enum: ["select", "insert", "update", "delete"], description: "Die auszuführende Datenbank-Operation" },
          match: { type: "object", description: "Optional: Filter für SELECT, UPDATE, DELETE (z.B. {'id': '123'} oder {'household_id': '456'})" },
          body: { type: "object", description: "Optional: Die Datenstruktur, die für INSERT oder UPDATE geschrieben werden soll" },
          select: { type: "string", description: "Optional: Spaltenauswahl für SELECT (z.B. 'id, name, status'), standardmäßig '*'" }
        },
        required: ["table", "operation"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "home_assistant_action",
      description: "Interaktion mit Home Assistant (Geräte steuern, Lichter schalten, Status auslesen)",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["get_states", "call_service"], description: "Die auszuführende Aktion. get_states liest Sensoren/Lichter, call_service steuert sie." },
          domain: { type: "string", description: "Nur für call_service: Die Domain (z.B. 'light', 'switch', 'climate', 'script')" },
          service: { type: "string", description: "Nur für call_service: Der Service (z.B. 'turn_on', 'turn_off', 'set_temperature')" },
          serviceData: { type: "object", description: "Nur für call_service: Zusätzliche Daten (meistens {'entity_id': 'light.wohnzimmer'}, oder {'entity_id': '...', 'brightness': 255})" },
          entityId: { type: "string", description: "Nur für get_states: Spezifische entity_id (z.B. 'light.wohnzimmer'), falls nur ein Gerät gelesen werden soll." }
        },
        required: ["action"],
      },
    },
  },
];
