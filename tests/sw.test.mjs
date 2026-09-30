// Service worker : exécution réelle de sw.js dans un bac à sable, avec un
// cache simulé. Deux pannes visées : un .js ou un .json gardé des heures par
// le navigateur (Cloudflare) ferait tourner une page neuve avec des fichiers
// d'hier ; et hors connexion, une donnée absente ne doit jamais recevoir du
// HTML à sa place.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ORIGINE = "https://hyd.ksr-infra.org";
const source = readFileSync(new URL("../sw.js", import.meta.url), "utf8");

function monter({ cache = {}, enLigne = false, appels = [] }) {
  const ecouteurs = {};
  const cle = (x) => new URL(typeof x === "string" ? x : x.url, `${ORIGINE}/sw.js`).pathname;
  const contexte = {
    self: null, location: { origin: ORIGINE }, URL, Request, Response, Headers, Promise, console,
    caches: {
      match: async (x) => cache[cle(x)] ?? undefined,
      open: async () => ({ put: async () => {} }),
      keys: async () => [], delete: async () => true,
    },
    fetch: async (requete, init = {}) => {
      appels.push({ url: typeof requete === "string" ? requete : requete.url,
        cache: init.cache ?? requete.cache ?? "default", requete });
      if (!enLigne) throw new TypeError("Failed to fetch");
      return new Response("réseau", { status: 200 });
    },
  };
  contexte.self = { addEventListener: (type, f) => { ecouteurs[type] = f; }, skipWaiting: () => {}, clients: { claim: async () => {} } };
  vm.createContext(contexte);
  vm.runInContext(source, contexte);
  return async (chemin, mode = "navigate", entetes = {}) => {
    let promesse = null;
    const url = `${ORIGINE}${chemin}`;
    // Une requête de navigation ne se construit pas (mode interdit) : on la simule.
    const request = mode === "navigate" ? { method: "GET", url, mode } : new Request(url, { mode, headers: entetes });
    ecouteurs.fetch({ request, respondWith: (p) => { promesse = p; } });
    return promesse;
  };
}

test("en ligne : le réseau passe d'abord", async () => {
  const servir = monter({ cache: { "/cours.html": new Response("ANCIEN") }, enLigne: true });
  assert.equal(await (await servir("/cours.html")).text(), "réseau");
});

// Cloudflare fait garder les scripts quatre heures par le navigateur : sans
// revalidation, une page neuve chargerait des modules d'hier de même adresse.
test("en ligne : scripts et données sont revalidés, pas lus dans le cache HTTP", async () => {
  const appels = [];
  const servir = monter({ enLigne: true, appels });
  await servir("/src/cours-ch3-idf.js", "cors");
  await servir("/data/stations-montana.json", "cors");
  await servir("/cours.html", "navigate");
  assert.equal(appels[0].cache, "no-cache");
  assert.equal(appels[1].cache, "no-cache");
  assert.equal(appels[2].cache, "default", "une navigation garde sa requête d'origine");
});

test("en ligne : une lecture partielle garde son en-tête Range", async () => {
  const appels = [];
  const servir = monter({ enLigne: true, appels });
  await servir("/docs/fascicule-debits-de-projet.pdf", "cors", { Range: "bytes=0-65535" });
  assert.equal(appels[0].cache, "no-cache");
  assert.equal(appels[0].requete.headers.get("Range"), "bytes=0-65535");
});

test("hors ligne : la coquille pour une navigation, une panne franche pour une donnée", async () => {
  const servir = monter({ cache: { "/index.html": new Response("ACCUEIL") } });
  assert.equal(await (await servir("/chapitre-inexistant")).text(), "ACCUEIL");
  const donnee = await servir("/data/exercices-ch99.json", "cors");
  assert.equal(donnee.status, 504, "une donnée absente doit échouer franchement");
  assert.match(donnee.headers.get("Content-Type"), /text\/plain/);
});
