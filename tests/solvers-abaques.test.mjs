// Abaques BCEOM. Le contrôle le plus fort est celui des ANCRES : les points
// cités dans les exemples numériques imprimés du manuel doivent être retrouvés
// par le lecteur. Vient ensuite l'interdiction d'extrapoler, qui est la règle
// la plus facile à perdre en refactorant.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as a from "../src/solvers-abaques.js";
import { calculerOuvrage } from "../src/solvers-ouvrages.js";

const donnees = JSON.parse(readFileSync(new URL("../data/abaques-bceom.json", import.meta.url)));
const JEU = a.preparer(donnees);

test("les ancres des exemples imprimés sont retrouvées", () => {
  let n = 0;
  for (const ab of donnees.abaques)
    for (const anc of ab.ancres || []) {
      const c = ab.courbes.find((x) => x.id === anc.courbe);
      assert.ok(c, `courbe ${anc.courbe} de la figure ${ab.figure}`);
      const lu = a.lireCourbe(c, anc["Q*"]);
      assert.equal(lu.motif, null, `ancre ${ab.figure}/${anc.courbe} dans le domaine`);
      const ecart = Math.abs(lu.valeur - anc["H1*"]) / anc["H1*"];
      assert.ok(ecart < 0.005,
        `figure ${ab.figure}, ${anc.courbe}, Q* = ${anc["Q*"]} : lu ${lu.valeur.toFixed(4)}, `
        + `imprimé ${anc["H1*"]} (${anc.origine})`);
      n++;
    }
  assert.ok(n >= 6, `${n} ancres contrôlées`);
});

test("aucune extrapolation, dans un sens comme dans l'autre", () => {
  for (const ab of donnees.abaques)
    for (const c of ab.courbes) {
      const qMin = c.points[0][0], qMax = c.points[c.points.length - 1][0];
      assert.equal(a.lireCourbe(c, qMin * 0.99).valeur, null, `sous le domaine (${ab.figure}/${c.id})`);
      assert.equal(a.lireCourbe(c, qMax * 1.01).valeur, null, `au-dessus (${ab.figure}/${c.id})`);
      assert.match(a.lireCourbe(c, qMin * 0.5).motif, /sous le domaine tracé/);
      assert.match(a.lireCourbe(c, qMax * 2).motif, /au-dessus du domaine tracé/);
      // les bornes elles-mêmes se lisent
      assert.ok(a.lireCourbe(c, qMin).valeur > 0, `borne basse lisible (${ab.figure}/${c.id})`);
      assert.ok(a.lireCourbe(c, qMax).valeur > 0, `borne haute lisible (${ab.figure}/${c.id})`);
    }
});

test("interpolation en log₁₀/log₁₀, et courbes croissantes", () => {
  for (const ab of donnees.abaques)
    for (const c of ab.courbes) {
      // chaque courbe est strictement croissante en Q* comme en H1*
      for (let i = 1; i < c.points.length; i++) {
        assert.ok(c.points[i][0] > c.points[i - 1][0], `Q* croissant (${ab.figure}/${c.id})`);
        assert.ok(c.points[i][1] >= c.points[i - 1][1], `H1* non décroissant (${ab.figure}/${c.id})`);
      }
      // les points tabulés se relisent exactement
      for (const [q, h] of c.points)
        assert.ok(Math.abs(a.lireCourbe(c, q).valeur - h) < 1e-9,
          `point tabulé relu (${ab.figure}/${c.id}, Q* = ${q})`);
      // au milieu d'un intervalle, la lecture est bien celle de la droite en log-log
      const [q0, h0] = c.points[0], [q1, h1] = c.points[1];
      const qm = Math.sqrt(q0 * q1);
      const attendu = Math.pow(10, (Math.log10(h0) + Math.log10(h1)) / 2);
      assert.ok(Math.abs(a.lireCourbe(c, qm).valeur - attendu) < 1e-9,
        `milieu géométrique (${ab.figure}/${c.id})`);
    }
});

test("les variables réduites du code sont celles du fichier de données", () => {
  for (const ab of donnees.abaques) {
    const def = a.DEBIT_REDUIT[ab.figure];
    assert.ok(def, `figure ${ab.figure} définie dans le code`);
    assert.equal(def.formule, ab.definitions["Q*"],
      `figure ${ab.figure} : formule du code ≠ fichier`);
    assert.equal(ab.definitions["H1*"], "H1 / D", `figure ${ab.figure} : ordonnée`);
  }
  // le piège : les buses circulaires n'ont PAS la normalisation de l'arche
  const Q = 8, D = 1.5;
  const circulaire = a.DEBIT_REDUIT[71].calc({ Q, D });
  const parSection = Q / ((Math.PI * D * D / 4) * Math.sqrt(2 * a.G * D));
  assert.ok(Math.abs(parSection / circulaire - 4 / Math.PI) < 1e-9,
    "le rapport entre les deux normalisations vaut bien 4/π");
});

test("lecture complète et contre-épreuve HDS-5 sur le dalot du chapitre", () => {
  const f77 = JEU.parFigure.get(77);
  const lu = a.lireAbaque(f77, "A_ailes_30_75", { Q: 8, D: 1.5, B: 2 });
  assert.equal(lu.motif, null);
  // Q* recalculé à la main
  assert.ok(Math.abs(lu.qReduit - 8 / (2 * 1.5 * Math.sqrt(2 * 9.81 * 1.5))) < 1e-12, "Q*");
  assert.ok(lu.H1 > 1.8 && lu.H1 < 2.05, `H1 = ${lu.H1.toFixed(3)} m`);

  // HDS-5 sur la même configuration, contrôle à l'entrée
  const r = calculerOuvrage({ forme: "dalot", B: 2, D: 1.5, cellules: 1, Q: 8,
    L: 12, J: 0.01, K: 70, entree: "box-ailes-evasees", tw: 0 });
  const ecart = Math.abs(a.ecartRelatif(r.entreeC.HW, lu.H1));
  assert.ok(ecart < 10,
    `deux méthodes indépendantes à ${ecart.toFixed(1)} % : abaque ${lu.H1.toFixed(3)} m, `
    + `HDS-5 ${r.entreeC.HW.toFixed(3)} m`);
});

test("refus explicites", () => {
  const f77 = JEU.parFigure.get(77);
  assert.match(a.lireAbaque(f77, "A_ailes_30_75", { Q: 8, D: 1.5 }).erreur, /largeur du dalot/);
  assert.match(a.lireAbaque(f77, "A_ailes_30_75", { Q: 0, D: 1.5, B: 2 }).erreur, /débit et hauteur/);
  const f75 = JEU.parFigure.get(75);
  assert.match(a.lireAbaque(f75, "courbe_1_mur_de_tete", { Q: 4, D: 1.5 }).erreur, /section de l'arche/);
  // hors domaine : pas une erreur, une lecture impossible avec son motif
  const bas = a.lireAbaque(f77, "A_ailes_30_75", { Q: 0.4, D: 1.5, B: 2 });
  assert.equal(bas.erreur, undefined);
  assert.equal(bas.H1, null);
  assert.match(bas.motif, /on n'extrapole pas/);
});
