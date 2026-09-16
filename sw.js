// Service worker.
//
// Stratégie RÉSEAU D'ABORD pour tout ce qui vient du site, cache en secours.
// La version précédente servait la coquille depuis le cache en priorité : une
// page mise à jour n'atteignait jamais un visiteur déjà venu, qui gardait la
// première version du cours indéfiniment. Sur un site en cours de rédaction,
// c'est le pire des compromis — le cache ne doit servir que hors connexion.
const VERSION = "hyd-v17";
const COQUILLE = [
  "./", "./index.html", "./cours.html", "./exerciseur.html", "./fil-rouge.html",
  "./styles.css", "./enhancements.css", "./site.css",
  "./src/app.js", "./src/exerciseur.js", "./src/exercices.js", "./src/donnees.js", "./src/socle.js",
  "./src/solvers-hydro.js", "./src/solvers-ouvrages.js", "./src/solvers-averse.js", "./src/solvers-chronique.js", "./src/solvers-concentration.js", "./src/solvers-riviere.js", "./src/solvers-fao54.js", "./src/solvers-fil-rouge.js", "./src/solvers-dimensionnement.js",
  "./src/carte-fond.js", "./src/echelle.js", "./src/solvers-abaques.js", "./src/solvers-annexes.js", "./src/solvers-stats.js", "./src/stats-numerique.js", "./src/tableaux.js",
  "./src/cours-ch1.js", "./src/cours-ch2.js", "./src/cours-ch2-chronique.js", "./src/cours-ch3.js", "./src/cours-ch3-pluvio.js", "./src/cours-ch3-concentration.js", "./src/cours-ch3-idf.js", "./src/cours-ch3-montana.js",
  "./src/cours-ch4.js", "./src/cours-ch4-stations.js", "./src/cours-ch4-reperes.js", "./src/cours-ch5.js", "./src/cours-ch6.js", "./src/cours-ch6-abaques.js", "./src/cours-ch7.js", "./src/cours-ch7-precalage.js", "./src/cours-ch8.js", "./src/cours-ch9.js", "./src/cours-ch10.js", "./src/cours-fil-rouge.js",
  "./assets/icon.svg", "./manifest.webmanifest",
  // Les données : un chapitre sans son fichier est un chapitre vide.
  "./data/abaques-bceom.json", "./data/bassin-demo.json", "./data/chapitres.json", "./data/checklist-fao54.json", "./data/cieh-fao54.json", "./data/exercices-ch1.json", "./data/exercices-ch10.json", "./data/exercices-ch2.json", "./data/exercices-ch3.json", "./data/exercices-ch4.json", "./data/exercices-ch5.json", "./data/exercices-ch6.json", "./data/exercices-ch7.json", "./data/exercices-ch8.json", "./data/exercices-ch9.json", "./data/fil-rouge.json", "./data/frontieres-afrique.json", "./data/frontieres.json", "./data/isohyetes-pan-fao54.json", "./data/montana-afrique.json", "./data/orstom-fao54.json", "./data/oued-demo.json", "./data/reperes-tunisie.json", "./data/stations-montana.json", "./data/stations-sogreah.json",
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

// La page peut demander à la nouvelle version de prendre la main tout de suite.
// Sans cela, un onglet resté ouvert — le cas courant sur téléphone — garde
// l'ancien service worker et ses défauts jusqu'à sa fermeture.
self.addEventListener("message", (e) => {
  if (e.data?.type === "prendre-la-main") self.skipWaiting();
  // La page demande quelle version la sert : c'est la première chose à savoir
  // quand un lecteur signale une panne depuis son téléphone.
  if (e.data?.type === "version") e.ports?.[0]?.postMessage({ version: VERSION });
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
      .catch(() => caches.match(request).then((c) => {
        if (c) return c;
        // Hors ligne et absent du cache. Le repli sur la coquille ne vaut QUE
        // pour une navigation : servir index.html à la place d'un .json ou
        // d'un .js transforme une panne réseau franche en erreur d'analyse au
        // fond d'un module, et le chapitre reste vide sans un mot. Une panne
        // doit se voir comme une panne.
        if (request.mode === "navigate") return caches.match("./index.html");
        return new Response(`Ressource indisponible hors ligne : ${new URL(request.url).pathname}`,
          { status: 504, statusText: "Hors ligne", headers: { "Content-Type": "text/plain" } });
      }))
  );
});
