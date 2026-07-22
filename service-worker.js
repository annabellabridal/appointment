/**
 * service-worker.js
 * Basit önbellek (cache-first) — uygulama internetsiz de açılsın.
 */

const CACHE = "randevu-takip-v4";
const ASSETS = [
  "index.html",
  "style.css",
  "config.js",
  "db.js",
  "utils.js",
  "auth.js",
  "appointments.js",
  "dashboard.js",
  "calendar.js",
  "customers.js",
  "records.js",
  "income.js",
  "todos.js",
  "stats.js",
  "settings.js",
  "reminders.js",
  "app.js",
  "manifest.json",
  "assets/icons/icon.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).catch(() => caches.match("index.html"))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res.ok && new URL(req.url).origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return res;
        });
    })
  );
});
