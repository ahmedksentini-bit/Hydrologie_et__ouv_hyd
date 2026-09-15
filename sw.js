// Service worker.
//
// Stratégie RÉSEAU D'ABORD pour tout ce qui vient du site, cache en secours.
// La version précédente servait la coquille depuis le cache en priorité : une
// page mise à jour n'atteignait jamais un visiteur déjà venu, qui gardait la
// première version du cours indéfiniment. Sur un site en cours de rédaction,
// c'est le pire des compromis — le cache ne doit servir que hors connexion.
const VERSION = "hyd-v9";
const COQUILLE = [
  "./", "./index.html", "./cours.html", "./exerciseur.html",
  "./styles.css", "./enhancements.css", "./site.css",
  "./src/app.js", "./src/exerciseur.js", "./src/exercices.js",
  "./src/solvers-hydro.js", "./src/solvers-ouvrages.js", "./src/solvers-averse.js", "./src/solvers-chronique.js", "./src/solvers-concentration.js", "./src/solvers-dimensionnement.js",
  "./src/carte-fond.js", "./src/echelle.js", "./src/solvers-abaques.js", "./src/solvers-annexes.js", "./src/solvers-stats.js", "./src/stats-numerique.js", "./src/tableaux.js",
  "./src/cours-ch1.js", "./src/cours-ch2.js", "./src/cours-ch2-chronique.js", "./src/cours-ch3.js", "./src/cours-ch3-pluvio.js", "./src/cours-ch3-concentration.js", "./src/cours-ch3-montana.js",
  "./src/cours-ch4.js", "./src/cours-ch4-stations.js", "./src/cours-ch5.js", "./src/cours-ch6.js", "./src/cours-ch6-abaques.js", "./src/cours-ch7.js", "./src/cours-ch7-precalage.js", "./src/cours-ch8.js",
  "./assets/icon.svg", "./manifest.webmanifest",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => Promise.allSettled(COQUILLE.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((noms) => Promise.all(noms.filter((n) => n !== VERSION).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== location.origin) return;

  e.respondWith(
    fetch(request)
      .then((reponse) => {
        // On ne met en cache que les réponses réellement servies.
        if (reponse && reponse.ok) {
          const copie = reponse.clone();
          caches.open(VERSION).then((c) => c.put(request, copie));
        }
        return reponse;
      })
      .catch(() => caches.match(request).then((c) => c || caches.match("./index.html")))
  );
});
