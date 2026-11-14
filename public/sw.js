// Explore's service worker (Pulsus Platform): keeps the app and its public figures
// available offline, and refreshes them whenever there is a connection.
const CACHE = "pulsus-explore-v3";
const CORE = ["/", "/offline.html", "/manifest.webmanifest", "/icon-192.png", "/pulsus-explore-emblem-night.png", "/pulsus-explore-logo.png", "/pulsus-explore-logo-night.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network first, so figures are always fresh; the cache when offline.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || (req.mode === "navigate" ? caches.match("/offline.html") : undefined)))
  );
});
