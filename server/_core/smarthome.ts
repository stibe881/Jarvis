export interface SmarthomeActionParams {
  table: string;
  operation: "select" | "insert" | "update" | "delete";
  match?: Record<string, any>;
  body?: any;
  select?: string;
}

export async function executeSmarthomeAction(params: SmarthomeActionParams): Promise<any> {
  const { table, operation, match, body, select } = params;
  
  const baseUrl = process.env.SMARTHOME_SUPABASE_URL;
  const key = process.env.SMARTHOME_SERVICE_ROLE_KEY;
  
  if (!baseUrl || !key) {
    return "Fehler: Supabase Zugangsdaten für Smarthome Pro sind nicht in der .env hinterlegt.";
  }

  const url = new URL(`${baseUrl}/rest/v1/${table}`);
  
  if (select) {
    url.searchParams.append("select", select);
  } else if (operation === "select" || operation === "insert" || operation === "update") {
    url.searchParams.append("select", "*");
  }

  if (match) {
    for (const [k, v] of Object.entries(match)) {
      url.searchParams.append(k, `eq.${v}`);
    }
  }

  const headers: Record<string, string> = {
    "apikey": key,
    "Authorization": `Bearer ${key}`,
    "Content-Type": "application/json",
  };

  if (operation === "insert" || operation === "update") {
    headers["Prefer"] = "return=representation";
  }

  const method = operation === "select" ? "GET" : 
                 operation === "insert" ? "POST" : 
                 operation === "update" ? "PATCH" : "DELETE";

  try {
    const res = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    if (!res.ok) {
      const err = await res.text();
      return `Fehler bei der Datenbankabfrage (${res.status}): ${err}`;
    }

    if (res.status === 204 || operation === "delete") {
      return "Aktion erfolgreich ausgeführt (Keine Daten zurückgegeben).";
    }

    const data = await res.json();
    return data;
  } catch (error: any) {
    return `Netzwerkfehler bei Smarthome API: ${error.message}`;
  }
}
