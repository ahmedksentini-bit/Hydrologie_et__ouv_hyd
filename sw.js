// Service worker : coquille de l'application en cache, réseau d'abord pour les
// données afin qu'une mise à jour du cours arrive sans vider le cache à la main.
const VERSION = "hyd-v1";
const COQUILLE = [
  "./", "./index.html", "./cours.html", "./exerciseur.html",
  "./styles.css", "./enhancements.css", "./site.css",
  "./src/app.js", "./src/exerciseur.js", "./src/solvers-hydro.js",
  "./assets/icon.svg", "./manifest.webmanifest",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(COQUILLE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((noms) => Promise.all(noms.filter((n) => n !== VERSION).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // Données et documents : réseau d'abord, cache en secours hors connexion.
  if (url.pathname.includes("/data/") || url.pathname.includes("/docs/")) {
    e.respondWith(
      fetch(request)
        .then((r) => { const copie = r.clone(); caches.open(VERSION).then((c) => c.put(request, copie)); return r; })
        .catch(() => caches.match(request))
    );
    return;
  }

  e.respondWith(caches.match(request).then((c) => c || fetch(request)));
});
