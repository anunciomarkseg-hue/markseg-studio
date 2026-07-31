// Service worker do MarkSeg Mural / Conversas.
// - Páginas e estáticos: network-first (sempre o conteúdo novo; cai no cache só offline).
// - APIs (/api/*): só rede, nunca cacheia (evita dado velho).
// - Push: mostra aviso de mensagem nova e leva pro app ao clicar.
const CACHE = "markseg-mural-v2";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // APIs nunca do cache — sempre rede (feed, versão, mural etc.)
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req)),
  );
});

// ---- Push (avisos de mensagem nova nas Conversas) ----
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || "MarkSeg";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || "markseg-feed",
      // urgente: fica na tela até a pessoa fechar + vibra forte
      requireInteraction: Boolean(data.requireInteraction),
      silent: false,
      vibrate: data.urgent ? [300, 150, 300, 150, 400] : [120],
      data: { url: data.url || "/conversas" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/conversas";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of all) {
        if (c.url.includes(target) && "focus" in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })(),
  );
});
