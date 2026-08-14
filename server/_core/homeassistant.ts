export interface HomeAssistantActionParams {
  action: "get_states" | "call_service";
  domain?: string;
  service?: string;
  serviceData?: Record<string, any>;
  entityId?: string; // Optional filter for get_states
}

export async function executeHomeAssistantAction(
  params: HomeAssistantActionParams
): Promise<any> {
  const baseUrl = process.env.HA_BASE_URL;
  const token = process.env.HA_ACCESS_TOKEN;

  if (!baseUrl || !token) {
    return "Fehler: Home Assistant Zugangsdaten (HA_BASE_URL, HA_ACCESS_TOKEN) sind nicht in der .env hinterlegt.";
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  try {
    if (params.action === "get_states") {
      const res = await fetch(`${baseUrl}/api/states`, { headers });
      if (!res.ok) throw new Error(`Status ${res.status}: ${await res.text()}`);

      const states = await res.json();

      // Filter states if entityId is provided, otherwise return all
      if (params.entityId) {
        const entity = states.find((s: any) => s.entity_id === params.entityId);
        return entity || `Entität ${params.entityId} nicht gefunden.`;
      }

      const ACTIONABLE_DOMAINS = [
        "light",
        "switch",
        "climate",
        "cover",
        "scene",
        "script",
        "media_player",
        "automation",
      ];
      const filtered = states.filter((s: any) => {
        const domain = s.entity_id.split(".")[0];
        return ACTIONABLE_DOMAINS.includes(domain);
      });

      // To prevent massive payloads, we might want to map to a summary if there are many entities
      return filtered.map((s: any) => ({
        entity_id: s.entity_id,
        state: s.state,
        friendly_name: s.attributes?.friendly_name,
      }));
    }

    if (params.action === "call_service") {
      if (!params.domain || !params.service) {
        return "Fehler: Für call_service müssen 'domain' und 'service' angegeben werden.";
      }

      const serviceData = { ...(params.serviceData || {}) };
      // Sicherheitsmassnahme: turn_off akzeptiert keine brightness
      if (
        params.service === "turn_off" &&
        serviceData.brightness !== undefined
      ) {
        delete serviceData.brightness;
      }

      const res = await fetch(
        `${baseUrl}/api/services/${params.domain}/${params.service}`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(serviceData),
        }
      );

      if (!res.ok) throw new Error(`Status ${res.status}: ${await res.text()}`);
      return await res.json();
    }

    return "Fehler: Unbekannte Aktion.";
  } catch (error: any) {
    return `Netzwerkfehler bei Home Assistant API: ${error.message}`;
  }
}
