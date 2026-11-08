// GymPlan Service Worker — Offline-Fallback fürs Gym-WLAN.
// - Statische Next-Assets (/_next/static, gehasht): cache-first
// - Seitenaufrufe: network-first, bei Funkloch die zuletzt geladene Version
//   (z.B. die laufende Workout-Session; Eingaben liegen eh in localStorage)
// - Alles andere (Server Actions = POST, RSC-Requests, APIs): nie gecacht
const VERSION = "v1";
const STATIC_CACHE = `gymplan-static-${VERSION}`;
const PAGE_CACHE = "gymplan-pages"; // wird beim Logout/Login geleert
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll([OFFLINE_URL, "/icon-192.png"])),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("gymplan-static-") && k !== STATIC_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Gehashte Build-Assets, Icons, Übungsbilder
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/exercise-images/") ||
    /\.(png|jpg|jpeg|gif|webp|svg|woff2?)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Seiten-Navigation (Login-Seite selbst nie cachen)
  if (req.mode === "navigate" && !url.pathname.startsWith("/login")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Nur echte Seiten, keine Redirects (z.B. auf /login) speichern
          if (res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(PAGE_CACHE).then((c) => c.put(url.pathname, copy));
          }
          return res;
        })
        .catch(() =>
          caches
            .match(url.pathname, { cacheName: PAGE_CACHE })
            .then((hit) => hit || caches.match(OFFLINE_URL)),
        ),
    );
  }
});
