// Contrôles structurels des pages. Deux pannes silencieuses sont visées :
//  · deux éléments portant le même id — getElementById ne renvoie que le
//    premier, et un chapitre écrit alors dans la figure d'un autre ;
//  · un script de figure qui appelle el("xxx") sans que cet id existe — la
//    page se charge, la figure reste vide, et rien ne le signale.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const lire = (f) => readFileSync(join(racine, f), "utf-8");
const PAGES = ["index.html", "cours.html", "exerciseur.html"];

const idsDe = (html) => [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);

for (const page of PAGES) {
  test(`${page} — aucun identifiant en double`, () => {
    const vus = new Set(), doubles = new Set();
    for (const id of idsDe(lire(page))) (vus.has(id) ? doubles : vus).add(id);
    assert.deepEqual([...doubles], [], `identifiants en double dans ${page}`);
  });
}

test("les figures du cours ne visent que des identifiants existants", () => {
  const ids = new Set(idsDe(lire("cours.html")));
  const scripts = readdirSync(join(racine, "src")).filter((f) => /^cours-ch\d+\.js$/.test(f));
  assert.ok(scripts.length >= 7, "un script de figure par chapitre rédigé");
  for (const f of scripts) {
    const src = lire(join("src", f));
    for (const [, id] of src.matchAll(/\bel\("([^"]+)"\)/g))
      assert.ok(ids.has(id), `${f} appelle el("${id}") — absent de cours.html`);
    // chaque script doit être chargé par la page
    assert.ok(lire("cours.html").includes(`src/${f}`), `${f} n'est pas chargé par cours.html`);
  }
});

test("le service worker précharge tout ce que les pages utilisent", () => {
  const sw = lire("sw.js");
  const attendus = [...new Set([
    ...PAGES,
    ...readdirSync(join(racine, "src")).map((f) => `src/${f}`),
  ])];
  for (const f of attendus)
    assert.ok(sw.includes(`"./${f}"`), `${f} absent de la coquille du service worker`);
});

test("chaque chapitre annoncé disponible a bien sa section et sa banque", () => {
  const { chapitres } = JSON.parse(lire("data/chapitres.json"));
  const html = lire("cours.html");
  const banques = new Set(readdirSync(join(racine, "data"))
    .map((f) => /^exercices-(ch\d+)\.json$/.exec(f)?.[1]).filter(Boolean));
  for (const c of chapitres) {
    if (c.cours) assert.ok(html.includes(`id="${c.id}"`), `${c.id} annoncé mais absent du cours`);
    if (c.exercices) {
      assert.ok(banques.has(c.id), `${c.id} annonce des exercices sans banque`);
      const b = JSON.parse(lire(`data/exercices-${c.id}.json`));
      assert.equal(b.exercices.length, c.exercices,
        `${c.id} : ${b.exercices.length} exercices en banque, ${c.exercices} annoncés`);
    }
  }
});
