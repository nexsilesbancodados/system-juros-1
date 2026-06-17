// System Juros Service Worker — offline-aware
// - NetworkFirst para navegações HTML, com fallback /offline.html
// - StaleWhileRevalidate para JS/CSS/imagens
// - Nunca cacheia Supabase, APIs ou rotas internas (~oauth)
const VERSION = "sj-v6";
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const HTML_CACHE = `${VERSION}-html`;
const OFFLINE_URL = "/offline.html";

const PRECACHE = [OFFLINE_URL, "/favicon.webp"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE).catch(() => {})));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (e) => {
  if (e.data?.type === "SKIP_WAITING") self.skipWaiting();
});

const isAsset = (url) => /\.(?:js|mjs|css|woff2?|ttf|otf|png|jpg|jpeg|webp|svg|gif|ico)$/.test(url.pathname);

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never touch cross-origin (Supabase, CDNs, external APIs)
  if (url.origin !== location.origin) return;

  // Denylist: oauth and api endpoints always go to network
  if (url.pathname.startsWith("/~oauth") || url.pathname.startsWith("/api/")) return;
  if (url.pathname === "/manifest.json") return;

  // HTML navigations → NetworkFirst with offline fallback
  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(HTML_CACHE);
          cache.put(request, fresh.clone());
          return fresh;
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;
          return caches.match(OFFLINE_URL);
        }
      })()
    );
    return;
  }

  // Static assets → StaleWhileRevalidate
  if (isAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res && res.status === 200 && res.type === "basic") cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })()
    );
  }
});
