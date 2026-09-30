// Le bandeau de panne ne doit parler que du site. Cas vécu : un bloqueur de
// publicité arrête la mesure d'audience que Cloudflare ajoute aux pages, et le
// bandeau rouge annonçait « une ressource n'a pas pu être chargée » à un
// lecteur dont le cours marchait parfaitement.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ORIGINE = "https://hyd.ksr-infra.org";
// Module ES exécuté comme un script : seul son `export` gêne.
const source = readFileSync(new URL("../src/socle.js", import.meta.url), "utf8").replace(/^export /gm, "");

function monter() {
  const lignes = [];
  let boite = null;
  const element = () => ({ style: {}, childElementCount: 0, setAttribute() {}, addEventListener() {},
    appendChild(x) { this.childElementCount++; lignes.push(x); } });
  const ecouteurs = {};
  const contexte = {
    URL, console,
    location: { href: `${ORIGINE}/cours.html`, origin: ORIGINE, pathname: "/cours.html" },
    navigator: {},
    window: { innerWidth: 390, innerHeight: 844, addEventListener: (type, f) => { ecouteurs[type] = f; } },
    document: { getElementById: () => boite, createElement: element, body: { appendChild: (b) => { boite = b; } } },
  };
  vm.createContext(contexte);
  vm.runInContext(source, contexte);
  return { erreur: (e) => ecouteurs.error(e), lignes };
}

test("une ressource d'un autre site bloquée ne déclenche pas le bandeau", () => {
  const { erreur, lignes } = monter();
  erreur({ target: { tagName: "SCRIPT", src: "https://static.cloudflareinsights.com/beacon.min.js/v31edd6df95cf4e85" } });
  erreur({ target: { tagName: "LINK", href: "https://fonts.googleapis.com/css2?family=Inter" } });
  assert.equal(lignes.length, 0);
});

test("une ressource du site qui manque déclenche le bandeau", () => {
  const { erreur, lignes } = monter();
  erreur({ target: { tagName: "SCRIPT", src: `${ORIGINE}/src/cours-ch2.js` } });
  erreur({ target: { tagName: "IMG", src: "assets/icon.svg" } });
  assert.equal(lignes.length, 2);
  assert.match(lignes[0].innerHTML, /cours-ch2\.js/);
});

test("seules les erreurs de nos scripts sont signalées", () => {
  const { erreur, lignes } = monter();
  erreur({ message: "Script error.", filename: "" });
  erreur({ message: "TypeError: x is undefined", filename: "chrome-extension://abcdef/contenu.js" });
  assert.equal(lignes.length, 0, "extension ou script étranger : rien à signaler");
  erreur({ message: "ReferenceError: pl is not defined", filename: `${ORIGINE}/src/cours-ch3.js` });
  assert.equal(lignes.length, 1);
  assert.match(lignes[0].innerHTML, /pl is not defined/);
});
