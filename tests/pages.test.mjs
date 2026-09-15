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

test("le bassin de démonstration est cohérent", () => {
  const bv = JSON.parse(lire("data/bassin-demo.json"));
  assert.ok(bv.aire > 0 && bv.perimetre > 0, "surface et périmètre");
  const { nx, ny } = bv.grille;
  // la surface annoncée doit correspondre à la grille
  assert.ok(bv.aire < nx * ny * bv.grille.pas ** 2, "surface inférieure à la grille");
  // le contour est fermé
  const [a, b] = [bv.limite[0], bv.limite[bv.limite.length - 1]];
  assert.deepEqual(a, b, "ligne de partage des eaux fermée");
  // l'hypsométrie décroît de Hmax à Hmin, et couvre bien [0,1]
  const h = bv.hypsometrie;
  assert.equal(h[0][1], 0); assert.equal(h[h.length - 1][1], 1);
  for (let i = 1; i < h.length; i++) {
    assert.ok(h[i][0] <= h[i - 1][0] + 1e-9, `hypsométrie non décroissante au rang ${i}`);
    assert.ok(h[i][1] > h[i - 1][1], `fractions non croissantes au rang ${i}`);
  }
  const A = bv.altitudes;
  assert.ok(A.Hmin <= A.H95 && A.H95 <= A.H50 && A.H50 <= A.H5 && A.H5 <= A.Hmax,
    "altitudes caractéristiques ordonnées");
  assert.ok(A.Hmoy > A.Hmin && A.Hmoy < A.Hmax, "altitude moyenne dans la plage");
  // le réseau et les contours restent dans la grille
  for (const [x1, y1, x2, y2] of bv.reseau)
    assert.ok(x1 >= 0 && x1 < nx && y1 >= 0 && y1 < ny && x2 >= 0 && x2 < nx && y2 >= 0 && y2 < ny,
      "segment de réseau hors grille");
  // l'exutoire est sur le tracé de la route
  assert.equal(bv.exutoire[1], bv.ligneRoute, "exutoire sur la route");
});
