// La banque d'exercices ne doit pas dériver des solveurs : les réponses
// numériques sont recalculées ici, et la structure est contrôlée.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as h from "../src/solvers-hydro.js";
import * as o from "../src/solvers-ouvrages.js";

const banque = (ch) => JSON.parse(readFileSync(new URL(`../data/exercices-${ch}.json`, import.meta.url)));
const q = (b, exoId, i) => b.exercices.find((e) => e.id === exoId).questions[i];
const vaut = (question, valeur, msg) =>
  assert.ok(Math.abs(valeur - question.reponse) <= question.tolerance,
    `${msg} : solveur ${valeur.toFixed(3)}, banque ${question.reponse} (± ${question.tolerance})`);

for (const ch of ["ch1", "ch2", "ch3", "ch4", "ch5", "ch6"]) {
  test(`banque ${ch} — structure`, () => {
    const b = banque(ch);
    assert.equal(b.chapitre, ch);
    assert.ok(b.exercices.length > 0);
    for (const e of b.exercices) {
      assert.ok(e.id.startsWith(ch + "-"), `identifiant ${e.id}`);
      assert.ok(e.titre && e.enonce && e.questions.length, e.id);
      assert.ok(e.difficulte >= 1 && e.difficulte <= 3, `difficulté de ${e.id}`);
      for (const qu of e.questions) {
        assert.ok(qu.texte && qu.explication, `${e.id} : texte et explication`);
        if (qu.type === "choix") {
          assert.ok(Array.isArray(qu.options) && qu.options.length >= 2, `${e.id} : options`);
          assert.ok(Number.isInteger(qu.reponse) && qu.reponse >= 0 && qu.reponse < qu.options.length,
            `${e.id} : indice de réponse hors des options`);
        } else if (qu.type === "nombre") {
          assert.ok(Number.isFinite(qu.reponse), `${e.id} : réponse numérique`);
          assert.ok(Number.isFinite(qu.tolerance) && qu.tolerance >= 0, `${e.id} : tolérance`);
        } else assert.fail(`${e.id} : type de question inconnu « ${qu.type} »`);
      }
    }
  });
}

test("ch1 — rectangle équivalent de BV2 recalculé", () => {
  const b = banque("ch1");
  const { Ic, L, l } = h.rectangleEquivalent(42, 31);
  vaut(q(b, "ch1-e1", 0), Ic, "Ic");
  vaut(q(b, "ch1-e1", 1), L, "L_rect");
  vaut(q(b, "ch1-e1", 2), l, "l_rect");
  vaut(q(b, "ch1-e1", 3), L * l, "contrôle L×l");
});

test("ch1 — indices de compacité des trois bassins", () => {
  const b = banque("ch1");
  vaut(q(b, "ch1-e2", 0), h.gravelius(7.2, 2.35), "Ic de BV1");
  vaut(q(b, "ch1-e2", 1), h.gravelius(82, 265), "Ic de BV3");
});

test("ch1 — effet de l'échelle sur les indices", () => {
  const b = banque("ch1");
  const fin = h.rectangleEquivalent(42, 37);
  vaut(q(b, "ch1-e3", 0), fin.Ic, "Ic au tracé fin");
  vaut(q(b, "ch1-e3", 1), fin.L, "L_rect au tracé fin");
  vaut(q(b, "ch1-e3", 2), h.indiceGlobalPente(740, 418, fin.L), "Ig au tracé fin");
});

test("ch1 — indices de pente et densité de drainage", () => {
  const b = banque("ch1");
  const { L } = h.rectangleEquivalent(42, 31);
  const Ig = h.indiceGlobalPente(740, 418, L);
  vaut(q(b, "ch1-e4", 0), Ig, "Ig");
  vaut(q(b, "ch1-e4", 1), (Ig / (1.8 * 10) - 1) * 100, "écart au raccourci Ieq×10");
  vaut(q(b, "ch1-e6", 0), h.densiteDrainage(63, 42), "densité de drainage");
});

test("ch1 — les trois dénivelées de BV1", () => {
  const b = banque("ch1");
  vaut(q(b, "ch1-e5", 0), 739 - 693, "Δh de Ghorbel");
  vaut(q(b, "ch1-e5", 1), 744 - 690, "Hmoy de Giandotti");
  vaut(q(b, "ch1-e5", 2), 789 - 693, "D de Kirpich");
});

const SERIE_CH2 = [28, 62, 35, 19, 47, 88, 31, 24, 55, 41, 73, 22, 36, 110, 44, 29, 51, 38, 67, 26];

test("ch2 — ajustement de Gumbel recalculé", () => {
  const b = banque("ch2");
  const a = h.ajustementGumbel(SERIE_CH2);
  vaut(q(b, "ch2-e1", 0), a.moyenne, "moyenne");
  vaut(q(b, "ch2-e1", 1), a.ecartType, "écart-type");
  vaut(q(b, "ch2-e1", 2), a.gradex, "gradex");
  vaut(q(b, "ch2-e1", 3), a.mode, "mode");
  vaut(q(b, "ch2-e2", 0), h.quantileGumbel(a, 10), "P10");
  vaut(q(b, "ch2-e2", 1), h.quantileGumbel(a, 100), "P100");
  vaut(q(b, "ch2-e2", 2), h.periodeRetourDe(a, 110), "période du maximum observé");
});

test("ch2 — positions de tracage et abattement recalculés", () => {
  const b = banque("ch2");
  vaut(q(b, "ch2-e3", 0), 1 / (1 - h.positionTracage(1, 20)), "Weibull");
  vaut(q(b, "ch2-e3", 1), 1 / (1 - h.positionTracage(1, 20, "hazen")), "Hazen");
  vaut(q(b, "ch2-e5", 0), h.coefficientAbattement(320, 42), "abattement 42 km²");
  vaut(q(b, "ch2-e5", 1), h.coefficientAbattement(300, 2.35), "abattement 2,35 km²");
});

const IDF = { a: 211, b: 0.633, c: 0.178 };
const iKas = (t, T) => h.montana(IDF.a, IDF.b, IDF.c, t, T);

test("ch3 — lecture de la courbe IDF recalculée", () => {
  const b = banque("ch3");
  vaut(q(b, "ch3-e1", 0), iKas(30, 10), "i à 30 min, T = 10");
  vaut(q(b, "ch3-e1", 1), iKas(30, 100), "i à 30 min, T = 100");
  vaut(q(b, "ch3-e1", 2), iKas(30, 100) / iKas(30, 10), "rapport des périodes");
  vaut(q(b, "ch3-e1", 3), iKas(30, 10) / iKas(60, 10), "rapport des durées");
});

test("ch3 — choix du temps de concentration recalculé", () => {
  const b = banque("ch3");
  vaut(q(b, "ch3-e2", 0), h.rationnelle(0.5, iKas(32.9, 30), 2.35), "débit avec Kirpich");
  vaut(q(b, "ch3-e2", 1), h.rationnelle(0.5, iKas(106.21, 30), 2.35), "débit avec Giandotti");
  vaut(q(b, "ch3-e2", 3), iKas(1.104, 30) / iKas(66.24, 30), "facteur d'unité");
});

test("ch3 — lames d'eau et borne de durée recalculées", () => {
  const b = banque("ch3");
  vaut(q(b, "ch3-e3", 0), (iKas(30, 10) * 30) / 60, "lame à 30 min");
  vaut(q(b, "ch3-e3", 1), (iKas(120, 10) * 120) / 60, "lame à 2 h");
  vaut(q(b, "ch3-e4", 0), iKas(3, 10), "intensité à 3 min");
  vaut(q(b, "ch3-e4", 1), iKas(h.dureeEffective(3, 5), 10), "intensité à la borne");
  vaut(q(b, "ch3-e4", 2), h.rationnelle(0.6, iKas(h.dureeEffective(3, 5), 10), 0.85), "débit borné");
});

test("ch3 — les deux formes de Montana", () => {
  const b = banque("ch3");
  vaut(q(b, "ch3-e5", 0), iKas(30, 10), "forme en puissance");
  // variante de Talbot : le même triplet, c pris pour un décalage de durée
  vaut(q(b, "ch3-e5", 1), 211 / Math.pow(30 + 0.178, 0.633), "variante de Talbot");
});

test("ch4 — morphométrie de BV1 recalculée", () => {
  const b = banque("ch4");
  const { Ic, L } = h.rectangleEquivalent(2.35, 7.2);
  vaut(q(b, "ch4-e1", 0), Ic, "Ic");
  vaut(q(b, "ch4-e1", 1), L, "L_rect");
  vaut(q(b, "ch4-e1", 2), h.indiceGlobalPente(800, 696, L), "Ig");
  vaut(q(b, "ch4-e1", 3), 739 - 693, "Δh");
});

test("ch4 — temps de concentration de BV1 recalculés", () => {
  const b = banque("ch4");
  const tc = h.tempsConcentration({ S: 2.35, L: 2.85, D: 96, iPct: 3.4, Hmoy: 54 });
  vaut(q(b, "ch4-e2", 0), tc.kirpich, "Kirpich");
  vaut(q(b, "ch4-e2", 1), tc.passini, "Passini");
  vaut(q(b, "ch4-e2", 2), tc.giandotti, "Giandotti");
  vaut(q(b, "ch4-e2", 3), tc.giandotti / tc.kirpich, "rapport des tc");
});

test("ch4 — chaîne rationnelle de BV1 recalculée", () => {
  const b = banque("ch4");
  const tc = 32.9036, i = h.montana(211, 0.633, 0.178, tc, 30);
  vaut(q(b, "ch4-e3", 0), i, "intensité");
  vaut(q(b, "ch4-e3", 1), h.coefficientRuissellement(3.4, 38).C, "coefficient C");
  vaut(q(b, "ch4-e3", 2), h.rationnelle(0.5, i, 2.35), "débit rationnel");
  vaut(q(b, "ch4-e3", 3), (i * tc) / 60, "lame d'eau");
  vaut(q(b, "ch4-e3", 4), h.montana(211, 0.633, 0.178, tc / 60, 30), "lecture en heures");
});

test("ch4 — SOGREAH de BV1 recalculée", () => {
  const b = banque("ch4");
  vaut(q(b, "ch4-e4", 0), h.gumbel(30), "Y30");
  const PT = h.sogreahPluie(30, 75, 120);
  vaut(q(b, "ch4-e4", 1), PT, "P30");
  vaut(q(b, "ch4-e4", 2), h.sogreahDebit(2.35, PT, 20), "Q30");
});

test("ch4 — Ghorbel de BV2 et le piège de Δh", () => {
  const b = banque("ch4");
  const Ic = h.gravelius(31, 42);
  vaut(q(b, "ch4-e5", 0), Ic, "Ic");
  const qmax = h.ghorbelQmax123(42, 0.32, 158, 12.5, Ic);
  vaut(q(b, "ch4-e5", 1), qmax, "Qmax(moy)");
  vaut(q(b, "ch4-e5", 2), qmax * h.GHORBEL_R.III[50], "Q50");
  const faux = h.ghorbelQmax123(42, 0.32, 410, 12.5, Ic);
  vaut(q(b, "ch4-e5", 3), (faux / qmax - 1) * 100, "surestimation");
});

test("ch4 — Fersi et Kallel de BV3 recalculés", () => {
  const b = banque("ch4");
  const He = h.fersiEcoulement(180, 4.55);
  vaut(q(b, "ch4-e6", 0), He, "He");
  const QxMoy = h.fersiQxMoyen(He, 265);
  vaut(q(b, "ch4-e6", 1), QxMoy, "Qx_moy");
  vaut(q(b, "ch4-e6", 2), h.fersiQx(QxMoy, 265, 4.55, h.FERSI_Y.SudEst[100]), "Qx100");
  vaut(q(b, "ch4-e6", 3), h.kallel("SudEstSudOuest", 265, 100), "Kallel");
});

test("ch4 — synthèse de BV2 recalculée", () => {
  const b = banque("ch4");
  const toutes = [154.79, 167.98, 455.56, 483.16];
  vaut(q(b, "ch4-e8", 0), h.synthese(toutes).mediane, "médiane des quatre");
  vaut(q(b, "ch4-e8", 2), h.synthese(toutes.slice(0, 3)).mediane, "médiane sans Francou-Rodier");
  assert.ok(Math.abs(h.synthese(toutes).cv - 48.9) < 0.2, "CV annoncé dans l'énoncé");
});

test("ch5 — risque et période de retour recalculés", () => {
  const b = banque("ch5");
  vaut(q(b, "ch5-e3", 0), h.risqueDepassement(50, 30) * 100, "risque T=50 n=30");
  vaut(q(b, "ch5-e3", 1), h.risqueDepassement(100, 30) * 100, "risque T=100 n=30");
  vaut(q(b, "ch5-e3", 2), h.periodePourRisque(0.1, 30), "T pour 10 % sur 30 ans");
  vaut(q(b, "ch5-e5", 2),
    h.periodeRetour({ categorie: "classee", ouvrage: "dalot", S: 9.8, tjma: 650 }), "frontière TJMA");
});

// ── chapitre 6 : les réponses viennent du moteur hydraulique ───────────────
const DALOT = { forme: "dalot", B: 2, D: 1.5, Q: 8, L: 12, J: 0.01, K: 70,
                entree: "box-ailes-evasees", tw: 0 };

test("ch6 — les deux contrôles du dalot recalculés", () => {
  const b = banque("ch6");
  const r = o.calculerOuvrage(DALOT);
  vaut(q(b, "ch6-e1", 0), r.profondeurCritique, "profondeur critique");
  vaut(q(b, "ch6-e1", 1), r.entreeC.X, "intensité X");
  vaut(q(b, "ch6-e1", 2), r.entreeC.HW, "HW contrôle à l'entrée");
  vaut(q(b, "ch6-e1", 3), r.sortieC.HW, "HW contrôle à la sortie");
  vaut(q(b, "ch6-e1", 4), r.HW, "HW retenu");
  assert.equal(r.controle, "entrée", "le contrôle est bien à l'entrée");
});

test("ch6 — aval noyé et allongement recalculés", () => {
  const b = banque("ch6");
  const noye = o.calculerOuvrage({ ...DALOT, tw: 2.5 });
  assert.equal(noye.etatSortie, "noyée");
  vaut(q(b, "ch6-e2", 1), noye.sortieC.HW, "HW sortie noyée");
  vaut(q(b, "ch6-e2", 2), noye.HW, "HW retenu");
  assert.equal(noye.controle, "sortie");
  const longue = o.calculerOuvrage({ ...DALOT, L: 45 });
  vaut(q(b, "ch6-e3", 0), longue.entreeC.HW, "HW entrée inchangé par la longueur");
  vaut(q(b, "ch6-e3", 1), longue.sortieC.HW, "HW sortie après allongement");
  assert.ok(longue.sortieC.HW < o.calculerOuvrage(DALOT).sortieC.HW,
    "allonger sur une pente abaisse HW sous contrôle à la sortie");
});

test("ch6 — tête et cellules recalculées", () => {
  const b = banque("ch6");
  vaut(q(b, "ch6-e4", 0),
    o.calculerOuvrage({ ...DALOT, entree: "box-ailes-paralleles" }).entreeC.HW, "ailes parallèles");
  const deux = o.calculerOuvrage({ ...DALOT, cellules: 2 });
  vaut(q(b, "ch6-e4", 2), deux.entreeC.X, "X à deux cellules");
  vaut(q(b, "ch6-e4", 3), deux.HW, "HW à deux cellules");
  assert.equal(deux.entreeC.regime, "transition", "le régime bascule en transition");
});

test("ch6 — buse et exception de la correction de pente", () => {
  const b = banque("ch6");
  const base = { forme: "buse", D: 1.2, Q: 2, L: 14, J: 0.015, K: 70, tw: 0 };
  const vive = o.calculerOuvrage({ ...base, entree: "buse-arete-vive" });
  vaut(q(b, "ch6-e5", 0), vive.entreeC.X, "X de la buse");
  vaut(q(b, "ch6-e5", 1), vive.entreeC.HW, "HW entrée béton arête vive");
  const talus = o.calculerOuvrage({ ...base, entree: "buse-metal-talus" });
  vaut(q(b, "ch6-e5", 2), talus.entreeC.HW, "HW entrée métallique au talus");
  assert.ok(talus.entreeC.HW > vive.entreeC.HW, "l'entrée au talus demande plus de charge");
});

test("ch6 — vitesse et régime recalculés", () => {
  const b = banque("ch6");
  const r = o.calculerOuvrage(DALOT);
  vaut(q(b, "ch6-e6", 0), r.profondeurNormale, "tirant normal");
  vaut(q(b, "ch6-e6", 1), r.vitesse, "vitesse");
  assert.ok(r.profondeurNormale < r.profondeurCritique, "écoulement torrentiel");
  assert.equal(r.penteSuperieureACritique, true, "pente au-dessus de la pente critique");
  assert.equal(r.vitesseOk, false, "au-delà de la vitesse admissible de 3 m/s");
});
