import { useEffect } from "react";
import { trpc } from "@/lib/trpc";

/**
 * Setzt das App-Icon-Badge (PWA) auf die Anzahl offener Aufgaben + offener Tickets.
 * Läuft nur wenn der Browser die Badging-API unterstützt (iOS ab 16.4 im Home-Screen-Modus).
 */
export function useAppBadge() {
  const { data: tasks } = trpc.tasks.list.useQuery(undefined, {
    refetchInterval: 5 * 60 * 1000,
  });
  const { data: appSummary } = trpc.appDashboard.summary.useQuery(undefined, {
    refetchInterval: 5 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    const openTasks = (tasks ?? []).filter((t) => !t.completed).length;
    const openTickets = appSummary?.openTickets ?? 0;
    const total = openTasks + openTickets;

    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };

    if (typeof nav.setAppBadge === "function") {
      if (total > 0) nav.setAppBadge(total).catch(() => undefined);
      else nav.clearAppBadge?.().catch(() => undefined);
    }

    // Titel als Fallback für Desktop-Browser ohne Badging-API
    document.title = total > 0
      ? `(${total}) Jarvis – Dein persönlicher KI-Assistent`
      : "Jarvis – Dein persönlicher KI-Assistent";

    navigator.serviceWorker?.controller?.postMessage({ type: "SET_BADGE", count: total });
  }, [tasks, appSummary]);
}

