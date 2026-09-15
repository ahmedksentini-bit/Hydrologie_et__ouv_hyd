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
  const scripts = readdirSync(join(racine, "src")).filter((f) => /^cours-ch\d+(-[a-z]+)?\.js$/.test(f));
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

test("les stations SOGREAH sont cohérentes et dans l'emprise des planches", () => {
  const j = JSON.parse(lire("data/stations-sogreah.json"));
  assert.equal(j.stations.length, 19);
  for (const s of j.stations) {
    assert.ok(s.nom && Number.isFinite(s.lon) && Number.isFinite(s.lat), `${s.nom} : coordonnées`);
    // les planches couvrent le Centre et le Sud, rien au-dessus de 36,3° N
    assert.ok(s.lat > 32 && s.lat < 36.3, `${s.nom} : latitude hors des planches`);
    assert.ok(s.lon > 7.5 && s.lon < 11.6, `${s.nom} : longitude hors des planches`);
    // la seule règle universelle
    if (s.P10 !== null) assert.ok(s.P10 < s.P100, `${s.nom} : P10 < P100`);
    // et le drapeau doit correspondre à la donnée, pas la précéder
    const depasse = s.P10 !== null && s.P0 >= s.P10;
    assert.equal(!!s.seuilAuDessusDeP10, depasse, `${s.nom} : drapeau P0 ≥ P10`);
  }
  const marquees = j.stations.filter((s) => s.seuilAuDessusDeP10).map((s) => s.nom);
  assert.deepEqual(marquees, ["Tozeur", "Kébili", "Douz"], "le Sud saharien");
  assert.equal(j.stations.filter((s) => s.P10 === null).length, 1, "une lecture incomplète");
});

test("l'échelle séquentielle de la carte est monotone et d'une seule teinte", () => {
  const src = lire("src/echelle.js");
  const m = /const RAMPE_SEQUENTIELLE = \[([^\]]+)\]/.exec(src);
  assert.ok(m, "rampe déclarée");
  const rampe = m[1].match(/#[0-9a-f]{6}/gi);
  assert.equal(rampe.length, 5, "cinq pas contrôlés");

  // luminance relative WCAG : elle doit décroître strictement (clair → foncé)
  const lum = (hex) => {
    const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const L = rampe.map(lum);
  for (let i = 1; i < L.length; i++)
    assert.ok(L[i] < L[i - 1], `pas ${i} : clarté non décroissante`);
  // le pas le plus clair doit rester lisible sur le fond de carte #f8fafc
  const contraste = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  assert.ok(contraste(rampe[0], "#f8fafc") >= 2,
    `pas le plus clair à ${contraste(rampe[0], "#f8fafc").toFixed(2)}:1, plancher 2:1`);
  // une seule teinte : tous les pas dominés par le bleu
  for (const c of rampe) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    assert.ok(b > r && b >= g, `${c} n'est pas dans la teinte bleue`);
  }
});

test("stations de Montana — a(T) seul n'est jamais croissant, a(T)·T^c toujours", () => {
  const j = JSON.parse(lire("data/stations-montana.json"));
  assert.equal(j.stations.length, 45);
  let aSeulCroissant = 0, produitCroissant = 0;
  for (const s of j.stations) {
    assert.ok(Number.isFinite(s.b) && Number.isFinite(s.c), `${s.nom} : b et c`);
    const Ts = Object.keys(s.aT).map(Number).sort((a, b) => a - b);
    assert.deepEqual(Ts, j.periodes, `${s.nom} : toutes les périodes`);
    const croissant = (f) => Ts.every((T, i) => i === 0 || f(T) > f(Ts[i - 1]));
    if (croissant((T) => s.aT[T])) aSeulCroissant++;
    if (croissant((T) => s.aT[T] * T ** s.c)) produitCroissant++;
    // position : ou bien recoupée avec ses deux coordonnées, ou bien absente des deux
    if (s.position === "wgs84") {
      assert.ok(Number.isFinite(s.lat) && Number.isFinite(s.lon), `${s.nom} : coordonnées`);
      assert.ok(s.lat > 30 && s.lat < 38 && s.lon > 7 && s.lon < 12, `${s.nom} : hors de Tunisie`);
    } else {
      assert.equal(s.lat, undefined, `${s.nom} : ne doit porter aucune coordonnée`);
    }
  }
  // c'est l'affirmation du cours, mot pour mot
  assert.equal(aSeulCroissant, 0, "aucune station n'a un a(T) croissant de bout en bout");
  assert.equal(produitCroissant, 45, "toutes ont un a(T)·T^c croissant");
  assert.equal(j.stations.filter((s) => s.position === "wgs84").length, 30, "trente placées");
});

test("le tableau de Kasserine affiché dans le cours est celui du fichier", () => {
  const j = JSON.parse(lire("data/stations-montana.json"));
  const k = j.stations.find((s) => s.nom === "Kasserine");
  assert.deepEqual([k.b, k.c], [0.633, 0.178], "la station de référence du cours");
  assert.equal(k.aT["10"], 211, "le 211 du calculateur est le a du décennal");
  const html = lire("cours.html");
  // les deux lignes du tableau doivent correspondre au calcul
  for (const T of j.periodes) {
    assert.ok(html.includes(`>${k.aT[T]}</td>`), `a(${T}) = ${k.aT[T]} absent du cours`);
    const produit = Math.round(k.aT[T] * T ** k.c);
    assert.ok(html.includes(`>${produit}</td>`), `a(${T})·T^c = ${produit} absent du cours`);
  }
  // l'écart annoncé entre le a décennal et le a centennal
  const ecart = (k.aT["10"] - k.aT["100"]) / k.aT["100"] * 100;
  assert.ok(ecart > 5.5 && ecart < 6.5, `écart annoncé « 6 % » : ${ecart.toFixed(1)} %`);
});
