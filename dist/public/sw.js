// Jarvis Service Worker – minimaler App-Shell-Cache und Badge-Support
const CACHE = "jarvis-shell-v1";

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// Netz zuerst, Cache nur als Fallback für Navigationen (keine API-Antworten cachen)
self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches
            .open(CACHE)
            .then(c => c.put("/", copy))
            .catch(() => undefined);
          return res;
        })
        .catch(() => caches.match("/").then(r => r ?? Response.error()))
    );
  }
});

// Badge aus der App heraus setzen
self.addEventListener("message", event => {
  const data = event.data || {};
  if (data.type === "SET_BADGE" && "setAppBadge" in navigator) {
    if (data.count > 0)
      navigator.setAppBadge(data.count).catch(() => undefined);
    else navigator.clearAppBadge?.().catch(() => undefined);
  }
});

// Push-Benachrichtigungen anzeigen und Badge aktualisieren
self.addEventListener("push", event => {
  let payload = { title: "Jarvis", body: "" };
  try {
    payload = event.data ? event.data.json() : payload;
  } catch {
    /* Klartext */
  }
  event.waitUntil(
    self.registration.showNotification(payload.title ?? "Jarvis", {
      body: payload.body ?? "",
      icon: "/manus-storage/jarvis-icon-512_46b72ed1.png",
      badge: "/manus-storage/jarvis-icon-512_46b72ed1.png",
      tag: "jarvis",
    })
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("/"));
});
