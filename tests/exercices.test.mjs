// La banque d'exercices ne doit pas dériver des solveurs : les réponses
// numériques sont recalculées ici, et la structure est contrôlée.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as h from "../src/solvers-hydro.js";
import * as o from "../src/solvers-ouvrages.js";
import * as dim from "../src/solvers-dimensionnement.js";
import * as st from "../src/solvers-stats.js";
import * as riv from "../src/solvers-riviere.js";
import * as fao from "../src/solvers-fao54.js";

const banque = (ch) => JSON.parse(readFileSync(new URL(`../data/exercices-${ch}.json`, import.meta.url)));
const q = (b, exoId, i) => b.exercices.find((e) => e.id === exoId).questions[i];
const vaut = (question, valeur, msg) =>
  assert.ok(Math.abs(valeur - question.reponse) <= question.tolerance,
    `${msg} : solveur ${valeur.toFixed(3)}, banque ${question.reponse} (± ${question.tolerance})`);

for (const ch of ["ch1", "ch2", "ch3", "ch4", "ch5", "ch6", "ch7", "ch8", "ch9", "ch10"]) {
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

// ── Chapitre 7 : les réponses sortent de la recherche, pas d'un relevé ──────
const ENTREE7 = "box-ailes-evasees";
const SITE7 = { forme: "dalot", Q: 12, L: 14, K: 70, entree: ENTREE7, tw: 0, cellulesMax: 4 };

test("ch7 — catalogue et nombre de candidats", () => {
  const b = banque("ch7");
  vaut(q(b, "ch7-e1", 0), dim.catalogue("dalot", { Bmin: 1, Bmax: 4, Dmin: 1, Dmax: 3 }).length, "géométries");
  vaut(q(b, "ch7-e1", 1), dim.proposer({ ...SITE7, J: 0.005 }).examines, "candidats examinés");
});

test("ch7 — la pente change le nombre d'admissibles", () => {
  const b = banque("ch7");
  vaut(q(b, "ch7-e2", 0), dim.proposer({ ...SITE7, J: 0.01 }).admissibles.length, "admissibles à 1 %");
  vaut(q(b, "ch7-e2", 1), dim.proposer({ ...SITE7, J: 0.005 }).admissibles.length, "admissibles à 0,5 %");
});

test("ch7 — pentes de calage", () => {
  const b = banque("ch7");
  vaut(q(b, "ch7-e3", 0), dim.penteDeCalage(0.3779), "calage de 0,3779 %");
  vaut(q(b, "ch7-e3", 1), dim.penteDeCalage(0.519), "calage de 0,519 %");
  vaut(q(b, "ch7-e3", 3), dim.penteDeCalage(0.700), "calage de 0,700 %");
});

test("ch7 — la solution retenue et sa chaîne de cotes", () => {
  const b = banque("ch7");
  const s = dim.proposer({ ...SITE7, J: 0, zRadierAmont: 100, zRoute: 102 });
  const c = s.retenue;
  assert.equal(c.libelle, "2 × 3 × 1,5 m", "solution retenue à pente libre");
  assert.equal(c.J, 0.004, "calée à 0,4 %");
  vaut(q(b, "ch7-e4", 0), dim.coteRadierAval(100, c.J, 14), "radier aval");
  vaut(q(b, "ch7-e4", 1), dim.cotePheAmont(100, c.r.HW), "plan d'eau amont");
  vaut(q(b, "ch7-e4", 2), c.revanche, "revanche");
  assert.equal(dim.verdictRevanche(c.revanche), "conforme");
});

test("ch7 — vérification au débit majorant", () => {
  const b = banque("ch7");
  const ouv = { forme: "dalot", B: 3, D: 1.5, cellules: 2, L: 14, J: 0.004, K: 70, entree: ENTREE7, tw: 0 };
  const r = o.calculerOuvrage({ ...ouv, Q: 18 });
  vaut(q(b, "ch7-e6", 0), dim.cotePheAmont(100, r.HW), "cote amont à Q100");
  vaut(q(b, "ch7-e6", 1), dim.revanche(102, dim.cotePheAmont(100, r.HW)), "revanche à Q100");
  assert.equal(dim.verdictRevanche(dim.revanche(102, dim.cotePheAmont(100, r.HW))), "insuffisante");
  // la surverse annoncée vers 26 m³/s
  assert.ok(dim.revanche(102, dim.cotePheAmont(100, o.calculerOuvrage({ ...ouv, Q: 26 }).HW)) < 0,
    "la route déverse à 26 m³/s");
  assert.ok(dim.revanche(102, dim.cotePheAmont(100, o.calculerOuvrage({ ...ouv, Q: 22 }).HW)) > 0,
    "mais pas encore à 22 m³/s");
});

test("ch7 — partage du débit avec la route", () => {
  const b = banque("ch7");
  const ouv = { forme: "dalot", B: 3, D: 1.5, cellules: 2, L: 14, J: 0.004, K: 70, entree: ENTREE7, tw: 0 };
  const sansPartage = dim.cotePheAmont(100, o.calculerOuvrage({ ...ouv, Q: 22 }).HW);
  vaut(q(b, "ch7-e7", 0), sansPartage, "cote sans partage");
  const p = dim.partageDebit({ ...ouv, Q: 22 }, { zRadierAmont: 100, zRoute: 101.5, Lr: 30 });
  vaut(q(b, "ch7-e7", 2), p.qOuvrage, "débit dans l'ouvrage");
  vaut(q(b, "ch7-e7", 3), sansPartage - p.zEau, "surestimation de la cote");
});

test("ch7 — §6 DGPC et comparaison dalot / buse", () => {
  const b = banque("ch7");
  vaut(q(b, "ch7-e8", 2), 0.10 * 1.5 * 100, "hauteur morte en cm");
  assert.ok(dim.reglesDgpcSix(1.0, 34).some((x) => x.verdict === "non conforme"),
    "le 4 × 3,0 × 1,0 est écarté par le §6");

  const buse = dim.proposer({ forme: "buse", Q: 12, L: 14, J: 0, K: 70,
    entree: "buse-emboitement", tw: 0, cellulesMax: 4, zRadierAmont: 100, zRoute: 102 });
  const dalot = dim.proposer({ ...SITE7, J: 0, zRadierAmont: 100, zRoute: 102 });
  assert.equal(buse.retenue.libelle, "4 × Ø 1,50 m", "solution buse retenue");
  vaut(q(b, "ch7-e9", 1), buse.retenue.r.HW - dalot.retenue.r.HW, "écart de charge amont");
});

// ── Chapitre 2 : statistiques — les réponses sortent des solveurs ──────────
const SERIE2 = [28, 62, 35, 19, 47, 88, 31, 24, 55, 41, 73, 22, 36, 110, 44, 29, 51, 38, 67, 26];

test("ch2 — écarts entre lois au décennal et au centennal", () => {
  const b = banque("ch2");
  const q10 = st.LOIS.map((l) => st.ajuster(l.id, SERIE2).quantile(10));
  const q100 = st.LOIS.map((l) => st.ajuster(l.id, SERIE2).quantile(100));
  vaut(q(b, "ch2-e9", 0), Math.max(...q10) - Math.min(...q10), "écart au décennal");
  vaut(q(b, "ch2-e9", 1), Math.max(...q100) - Math.min(...q100), "écart au centennal");
  // l'énoncé cite les cinq quantiles : ils doivent correspondre aux solveurs
  const cites = [120.8, 144.9, 125.6, 122.4, 132.0];
  st.LOIS.forEach((l, i) => assert.ok(Math.abs(q100[i] - cites[i]) < 0.1,
    `${l.nom} : énoncé ${cites[i]}, solveur ${q100[i].toFixed(1)}`));
});

test("ch2 — intervalle de Kite au centennal", () => {
  const b = banque("ch2");
  const ic = st.intervalleGumbel(SERIE2, 100);
  vaut(q(b, "ch2-e10", 0), ic.K, "facteur de fréquence");
  vaut(q(b, "ch2-e10", 1), ic.se, "écart-type de l'estimation");
  vaut(q(b, "ch2-e10", 2), ic.haut - ic.bas, "largeur de l'intervalle");
  // le rapport annoncé entre incertitude et écart entre lois
  const q100 = st.LOIS.map((l) => st.ajuster(l.id, SERIE2).quantile(100));
  const rapport = (ic.haut - ic.bas) / (Math.max(...q100) - Math.min(...q100));
  assert.ok(rapport > 3 && rapport < 4.5, `rapport annoncé « près de quatre fois » : ${rapport.toFixed(2)}`);
  // et le bootstrap plus étroit, comme l'affirme la dernière question
  assert.ok(st.intervalleBootstrap(SERIE2, "gumbel", 100).haut < ic.haut,
    "bootstrap plus étroit dans la queue haute");
});

test("ch2 — la rupture de l'exercice est bien au rang annoncé", () => {
  const b = banque("ch2");
  const rupture = "71 31 19 33 30 45 22 15 37 80 75 74 51 59 85 47 70 70 66 42 76 61 40 74 54 45 77 55 41 78"
    .split(" ").map(Number);
  const pt = st.pettitt(rupture);
  vaut(q(b, "ch2-e7", 2), pt.tau, "rang de la rupture");
  assert.ok(pt.p < 0.05 && st.wilcoxon(rupture).p > 0.05,
    "Pettitt rejette là où Wilcoxon conserve");
});

// ── Chapitre 6, TD corrigé à l'abaque : tout se recalcule ──────────────────
import * as abq from "../src/solvers-abaques.js";
const ABAQUES = abq.preparer(JSON.parse(
  readFileSync(new URL("../data/abaques-bceom.json", import.meta.url))));
const F77 = ABAQUES.parFigure.get(77), F72 = ABAQUES.parFigure.get(72);
const DALOT_TD = { forme: "dalot", B: 3, D: 1.5, Q: 12, L: 14, J: 0.004, K: 70,
                   entree: "box-ailes-evasees", tw: 0 };

test("ch6 — variable réduite du TD", () => {
  const b = banque("ch6");
  vaut(q(b, "ch6-e8", 1), Math.sqrt(2 * abq.G * 1.5), "√(2gD)");
  const lu = abq.lireAbaque(F77, "A_ailes_30_75", { Q: 6, D: 1.5, B: 3 });
  vaut(q(b, "ch6-e8", 2), lu.qReduit, "Q* à deux cellules");
});

test("ch6 — interpolation de la planche 77 refaite", () => {
  const b = banque("ch6");
  const courbe = F77.courbes.find((c) => c.id === "A_ailes_30_75");
  const Q = 6 / (3 * 1.5 * Math.sqrt(2 * abq.G * 1.5));
  // l'énoncé cite l'encadrement (0,20 ; 0,70) et (0,25 ; 0,78)
  let i = 1; while (courbe.points[i][0] < Q) i++;
  assert.deepEqual(courbe.points[i - 1], [0.2, 0.7], "borne basse citée dans l'énoncé");
  assert.deepEqual(courbe.points[i], [0.25, 0.78], "borne haute citée dans l'énoncé");
  const [q0, h0] = courbe.points[i - 1], [q1, h1] = courbe.points[i];
  const t = (Math.log10(Q) - Math.log10(q0)) / (Math.log10(q1) - Math.log10(q0));
  vaut(q(b, "ch6-e9", 0), t, "position relative t");
  const H1r = abq.lireCourbe(courbe, Q).valeur;
  vaut(q(b, "ch6-e9", 1), H1r, "H1/D lu");
  vaut(q(b, "ch6-e9", 2), H1r * 1.5, "H1 en mètres");
  // l'écart log-log / linéaire annoncé à 0,05 %
  const lineaire = h0 + ((Q - q0) / (q1 - q0)) * (h1 - h0);
  assert.ok(Math.abs(H1r - lineaire) / lineaire * 100 < 0.1,
    `écart log-log / linéaire annoncé négligeable : ${(Math.abs(H1r - lineaire) / lineaire * 100).toFixed(3)} %`);
});

test("ch6 — le contrôle bascule à la sortie, et l'abaque ne le voit pas", () => {
  const b = banque("ch6");
  const r3 = o.calculerOuvrage({ ...DALOT_TD, cellules: 3 });
  vaut(q(b, "ch6-e10", 0), r3.sortieC.pertes, "pertes au contrôle à la sortie");
  vaut(q(b, "ch6-e10", 1), r3.sortieC.HW, "charge sous contrôle à la sortie");
  assert.equal(r3.controle, "sortie", "à trois cellules, la sortie commande");

  const lu3 = abq.lireAbaque(F77, "A_ailes_30_75", { Q: 4, D: 1.5, B: 3 });
  const ecartEntree = Math.abs(abq.ecartRelatif(r3.entreeC.HW, lu3.H1));
  assert.ok(ecartEntree < 6,
    `l'abaque suit le contrôle à l'entrée à ${ecartEntree.toFixed(1)} %`);

  const r4 = o.calculerOuvrage({ ...DALOT_TD, cellules: 4 });
  const lu4 = abq.lireAbaque(F77, "A_ailes_30_75", { Q: 3, D: 1.5, B: 3 });
  vaut(q(b, "ch6-e10", 3), abq.ecartRelatif(lu4.H1, r4.HW), "écart abaque / retenu à 4 cellules");

  // la propriété enseignée : l'abaque sous-estime TOUJOURS la charge retenue
  for (const n of [1, 2, 3, 4]) {
    const r = o.calculerOuvrage({ ...DALOT_TD, cellules: n });
    const lu = abq.lireAbaque(F77, "A_ailes_30_75", { Q: 12 / n, D: 1.5, B: 3 });
    assert.ok(lu.H1 < r.HW, `${n} cellules : abaque ${lu.H1.toFixed(3)} < retenu ${r.HW.toFixed(3)}`);
  }
  // le tableau du corrigé : entrée commande à 1 et 2 cellules, sortie à 3 et 4
  for (const [n, attendu] of [[1, "entrée"], [2, "entrée"], [3, "sortie"], [4, "sortie"]])
    assert.equal(o.calculerOuvrage({ ...DALOT_TD, cellules: n }).controle, attendu,
      `contrôle à ${n} cellules`);
});

test("ch6 — hors domaine et non-transférabilité de Q*", () => {
  const b = banque("ch6");
  const hd = abq.lireAbaque(F72, "emboitement_femelle", { Q: 1, D: 1.5 });
  vaut(q(b, "ch6-e11", 0), hd.qReduit, "Q* de la buse à 1 m³/s");
  assert.equal(hd.H1, null, "sous le domaine tracé");
  // le calcul répond là où la planche se tait
  const hds = o.calculerOuvrage({ forme: "buse", D: 1.5, cellules: 1, Q: 1, L: 14,
    J: 0.005, K: 70, entree: "buse-emboitement", tw: 0 });
  assert.ok(hds.HW > 0.9 && hds.HW < 1.0, `HDS-5 répond : ${hds.HW.toFixed(3)} m`);
  assert.equal(hds.controle, "sortie");

  // même Q* sur deux planches, deux lectures
  const qDalot = abq.lireAbaque(F77, "A_ailes_30_75", { Q: 6, D: 1.5, B: 3 });
  const qBuse = abq.lireAbaque(F72, "emboitement_femelle", { Q: 3, D: 1.5 });
  vaut(q(b, "ch6-e11", 2), qBuse.qReduit, "Q* de la buse à 3 m³/s");
  assert.ok(Math.abs(qDalot.qReduit - qBuse.qReduit) < 1e-4,
    "les deux configurations partagent bien le même Q*");
  assert.ok(Math.abs(qDalot.h1Reduit - qBuse.h1Reduit) > 0.15,
    "mais pas la même charge réduite");
});

test("ch6 — le sens de l'erreur de normalisation, tel que le cours l'affirme", () => {
  const c72 = F72.courbes[0], c77 = F77.courbes.find((c) => c.id === "A_ailes_30_75");
  const D = 1.5;
  // buse lue avec la formule d'arche : Q* × 4/π, donc charge MAJORÉE
  const bon = 3 / Math.sqrt(2 * abq.G * Math.pow(D, 5));
  const faux = 3 / ((Math.PI * D * D / 4) * Math.sqrt(2 * abq.G * D));
  assert.ok(Math.abs(faux / bon - 4 / Math.PI) < 1e-9, "rapport 4/π");
  assert.ok(abq.lireCourbe(c72, faux).valeur > abq.lireCourbe(c72, bon).valeur,
    "la charge lue est majorée, donc l'erreur va dans le sens prudent");
  // dalot lu avec la formule de buse : Q* × B/D
  const bon2 = 6 / (3 * D * Math.sqrt(2 * abq.G * D));
  const faux2 = 6 / Math.sqrt(2 * abq.G * Math.pow(D, 5));
  assert.ok(Math.abs(faux2 / bon2 - 3 / D) < 1e-9, "rapport B/D");
  assert.ok(abq.lireCourbe(c77, faux2).valeur > abq.lireCourbe(c77, bon2).valeur,
    "majorée là aussi");
  // et les deux formules coïncident exactement quand B = D
  assert.ok(Math.abs(3 / (D * D * Math.sqrt(2 * abq.G * D))
    - 3 / Math.sqrt(2 * abq.G * Math.pow(D, 5))) < 1e-12, "B = D : mêmes formules");
});

// ── Chapitre 8 : têtes, protection, fossés ────────────────────────────────
import * as an from "../src/solvers-annexes.js";
const STATION8 = { a: 211, b: 0.633, c: 0.178 };
const i8 = (t, T) => h.montana(STATION8.a, STATION8.b, STATION8.c, t, T);

test("ch8 — proposition esthétique", () => {
  const b = banque("ch8");
  vaut(q(b, "ch8-e3", 0), an.anglesEsthetiques(3, 90).alpha, "α pour L = 3 m");
  vaut(q(b, "ch8-e3", 1), an.anglesEsthetiques(5, 90).alpha, "α pour L = 5 m");
  // l'énoncé cite 76,257° comme complémentaire, et le dit refusé
  const comp = 90 - an.anglesEsthetiques(3, 90).alpha;
  assert.ok(Math.abs(comp - 76.257) < 0.01, `complémentaire ${comp.toFixed(3)}°`);
  assert.equal(an.angleAdmissible("box-ailes-evasees", comp).ok, false, "refusé à L = 3 m");
  assert.equal(an.angleAdmissible("box-ailes-evasees",
    90 - an.anglesEsthetiques(8, 90).alpha).ok, true, "admis à L = 8 m, donc muet");
});

test("ch8 — biseaux et épaisseurs", () => {
  const b = banque("ch8");
  vaut(q(b, "ch8-e4", 0), an.biseauSuperieur("box-ailes-45-biseau", 1.5) * 100, "biseau en cm");
  vaut(q(b, "ch8-e4", 1), an.epaisseurBase(0.25, 2.5, 0.10, 0), "épaisseur en pied");
  assert.equal(an.verifierEpaisseurTete(0.20).verdict, "refusée", "0,20 m refusé");
});

test("ch8 — Isbash sur la sortie de l'ouvrage du chapitre 7", () => {
  const b = banque("ch8");
  const V = o.calculerOuvrage({ forme: "dalot", B: 3, D: 1.5, cellules: 2, Q: 12,
    L: 14, J: 0.004, K: 70, entree: "box-ailes-evasees", tw: 0 }).vitesse;
  assert.ok(Math.abs(V - 2.75) < 0.01, `vitesse de sortie ${V.toFixed(3)} m/s`);
  const d50 = an.isbash(V);
  vaut(q(b, "ch8-e5", 0), d50, "d50");
  vaut(q(b, "ch8-e5", 1), an.masseBloc(d50), "masse du bloc");
  vaut(q(b, "ch8-e5", 3), an.vitesseIsbash(0.20), "vitesse admissible d'un d50 de 0,20 m");
  // la loi en V⁶ que l'énoncé annonce
  assert.ok(Math.abs(an.masseBloc(an.isbash(3)) / an.masseBloc(an.isbash(2)) - 11.39) < 0.01);
});

test("ch8 — longueurs de protection", () => {
  const b = banque("ch8");
  const V = 2.75061;
  vaut(q(b, "ch8-e6", 0), an.longueurProtection(6, V, 1.5).L, "terre végétalisée");
  vaut(q(b, "ch8-e6", 1), an.longueurProtection(6, V, 0.8).L, "terre nue");
  vaut(q(b, "ch8-e6", 2), an.longueurProtection(6, V, an.vitesseIsbash(0.20)).L, "enrochement");
  // le rapport de dix annoncé dans le cours
  const rapport = an.longueurProtection(6, V, 0.8).L / an.longueurProtection(6, V, an.vitesseIsbash(0.20)).L;
  assert.ok(rapport > 8 && rapport < 12, `facteur annoncé « par dix » : ${rapport.toFixed(1)}`);
});

test("ch8 — la chaîne averse → fossé → descente", () => {
  const b = banque("ch8");
  vaut(q(b, "ch8-e7", 0), i8(6, 10), "intensité à 6 min");
  vaut(q(b, "ch8-e7", 1), i8(32.9, 10), "intensité au tc du bassin");
  assert.ok(i8(6, 10) / i8(32.9, 10) > 2.9, "près de trois fois plus fort");
  const plate = an.debitPlateforme({ i: i8(6, 10), largeur: 7, longueur: 200 });
  vaut(q(b, "ch8-e7", 3), plate.Q * 1000, "débit en L/s");

  const f = an.dimensionnerFosse({ Q: plate.Q, b: 0.4, m: 1.5, J: 0.01, K: 30 });
  vaut(q(b, "ch8-e8", 0), f.yn * 100, "tirant du fossé en cm");
  vaut(q(b, "ch8-e8", 1), f.vitesse, "vitesse dans le fossé");
  const d = an.descenteEau({ Q: plate.Q, largeur: 0.4, penteTalus: 2 / 3, K: 65 });
  vaut(q(b, "ch8-e8", 3), d.vitesse, "vitesse dans la descente");
  vaut(q(b, "ch8-e8", 4), d.conjuguee * 100, "conjuguée en cm");
  assert.ok(d.conjuguee / d.yn > 10, "onze fois le tirant amont");
});

test("ch2 — le niveau de confiance dicté par les tests", () => {
  const b = banque("ch2");
  const r = st.controlerSerie(SERIE2);
  const indep = r.hypotheses.find((x) => x.famille === "indépendance");
  const homo = r.hypotheses.find((x) => x.famille === "homogénéité");
  vaut(q(b, "ch2-e11", 0), indep.niveau * 100, "niveau de l'indépendance");
  vaut(q(b, "ch2-e11", 1), homo.niveau * 100, "niveau de l'homogénéité");
  vaut(q(b, "ch2-e11", 2), r.retenu.niveau * 100, "niveau retenu");
  assert.equal(r.retenu.famille, "indépendance", "c'est Wald-Wolfowitz qui commande");
  // l'homogénéité retient bien le pire de ses deux tests
  assert.equal(homo.test, "Wilcoxon-Mann-Whitney");

  const persistante = "25 20 26 40 50 51 67 69 82 66 63 38 26 17 34 35 33 36 35 49 62 51 29 39 50 29 37 48 67 64"
    .split(" ").map(Number);
  const rp = st.controlerSerie(persistante);
  const niv = (serie, r2) => st.niveauApplicable(r2.retenu.niveau).niveau;
  const ic1 = st.intervalleGumbel(SERIE2, 100, niv(SERIE2, r));
  const ic2 = st.intervalleGumbel(persistante, 100, niv(persistante, rp));
  vaut(q(b, "ch2-e12", 1), ic1.haut - ic1.bas, "largeur de la série confortable");
  vaut(q(b, "ch2-e12", 2), ic2.haut - ic2.bas, "largeur de la série suspecte");
  // le renversement annoncé par la dernière question
  const a95 = st.intervalleGumbel(SERIE2, 100, 0.95);
  const b95 = st.intervalleGumbel(persistante, 100, 0.95);
  assert.ok(b95.haut - b95.bas < a95.haut - a95.bas,
    "à 95 % pour les deux, la suspecte paraît la plus sûre");
});

test("ch4 — le seuil de ruissellement de Tozeur", () => {
  const b = banque("ch4");
  const [P0, P10, P100] = [50, 40, 70];
  vaut(q(b, "ch4-e9", 1), h.sogreahPluie(10, P10, P100), "P_T à 10 ans");
  // la période à laquelle le seuil est franchi, par dichotomie
  let lo = 10, hi = 100;
  for (let i = 0; i < 200; i++) {
    const m = (lo + hi) / 2;
    if (h.sogreahPluie(m, P10, P100) < P0) lo = m; else hi = m;
  }
  vaut(q(b, "ch4-e9", 3), (lo + hi) / 2, "période de franchissement du seuil");
  vaut(q(b, "ch4-e9", 4), h.sogreahDebit(50, h.sogreahPluie(50, P10, P100), P0), "Q à 50 ans");
  // et le refus à 10 ans
  assert.equal(h.sogreahDebit(50, h.sogreahPluie(10, P10, P100), P0), 0);
  // la station de l'énoncé existe bien dans le fichier, avec ces valeurs
  const j = JSON.parse(readFileSync(new URL("../data/stations-sogreah.json", import.meta.url)));
  const t = j.stations.find((s) => s.nom === "Tozeur");
  assert.deepEqual([t.P0, t.P10, t.P100], [P0, P10, P100], "lecture de Tozeur");
  assert.equal(t.seuilAuDessusDeP10, true);
});

test("ch3 — la table a(T) de la station de référence", () => {
  const b = banque("ch3");
  const j = JSON.parse(readFileSync(new URL("../data/stations-montana.json", import.meta.url)));
  const k = j.stations.find((s) => s.nom === "Kasserine");
  // l'énoncé cite la table : elle doit être celle du fichier
  for (const [T, a] of Object.entries({ 2: 193, 5: 208, 10: 211, 20: 213, 50: 206, 100: 199 }))
    assert.equal(k.aT[T], a, `a(${T})`);
  // a(30) interpolé en ln T
  const u = (Math.log(30) - Math.log(20)) / (Math.log(50) - Math.log(20));
  vaut(q(b, "ch3-e6", 2), k.aT["20"] + u * (k.aT["50"] - k.aT["20"]), "a(30) interpolé");
  vaut(q(b, "ch3-e6", 3), (k.aT["10"] - k.aT["100"]) / k.aT["100"] * 100, "surestimation à 100 ans");
  // et le produit annoncé dans la question 1
  const produit = j.periodes.map((T) => Math.round(k.aT[T] * T ** k.c));
  assert.deepEqual(produit, [218, 277, 318, 363, 413, 452], "a(T)·T^c cité dans l'explication");
});

test("ch7 — précalage et alignement recalculés", () => {
  const b = banque("ch7");
  const SITE = {
    chaussee: 6, accotement: 1.5, hauteurRemblai: 3.0, fruitTalus: 1.5,
    zTnEntree: 135.420, zTnSortie: 135.343, decaissement: 0.25, hauteurOuvrage: 1.5,
  };
  const droit = dim.precaler({ ...SITE, biaisDeg: 90 });
  const aligne = dim.precaler({ ...SITE, biaisDeg: 60 });
  const sec = o.sectionRectangulaire(2, 1.5), Q = 5, K = 70;
  const Ic = o.penteCritique(sec, Q, K);

  vaut(q(b, "ch7-e10", 0), droit.emprise, "emprise de pied à pied");
  vaut(q(b, "ch7-e10", 1), droit.zRadierAmont, "radier d'entrée");
  vaut(q(b, "ch7-e10", 2), droit.couvertureAmont, "couverture amont");
  vaut(q(b, "ch7-e10", 3), droit.couvertureAmont + droit.couvertureAval, "somme des couvertures");
  vaut(q(b, "ch7-e10", 4), droit.L, "longueur posé droit");
  vaut(q(b, "ch7-e10", 5), aligne.L, "longueur aligné");
  vaut(q(b, "ch7-e10", 6), aligne.L - droit.L, "surcoût de l'alignement");
  vaut(q(b, "ch7-e10", 7), droit.J * 100, "pente posé droit");
  vaut(q(b, "ch7-e10", 8), aligne.J * 100, "pente aligné");
  vaut(q(b, "ch7-e10", 9), Ic * 100, "pente critique");

  // Le cœur de l'exercice : une décision prise EN PLAN change le régime.
  assert.equal(dim.regimeDePente(droit.J, Ic).regime, "torrentiel");
  assert.equal(dim.regimeDePente(aligne.J, Ic).regime, "fluvial");
  assert.equal(q(b, "ch7-e10", 10).reponse, 2, "l'option « torrentiel droit, fluvial aligné »");

  // Et les deux écarts à la bascule restent hors de la bande des 5 %, sans quoi
  // la question précédente n'aurait pas de réponse ferme.
  assert.ok(Math.abs(droit.J / Ic - 1) > 0.05 && Math.abs(aligne.J / Ic - 1) > 0.05,
    "les deux cas doivent trancher franchement");
  // …mais assez près pour que la question sur K se pose : à K = 60 tout bascule.
  const Ic60 = o.penteCritique(sec, Q, 60);
  assert.equal(dim.regimeDePente(droit.J, Ic60).regime, "fluvial",
    "à K = 60 l'ouvrage droit devient fluvial lui aussi");

  const rehausse = dim.precaler({ ...SITE, biaisDeg: 60, hauteurRemblai: 4.0 });
  vaut(q(b, "ch7-e10", 12), rehausse.L - aligne.L, "allongement dû au rehaussement");
});

test("ch4 — le choix de la zone recalculé", () => {
  const b = banque("ch4");
  const S = 150, P = 62, Pan = 340, dh = 210, T = 100;
  const { L } = h.rectangleEquivalent(S, P);
  const Ic = h.gravelius(P, S);
  const qmax = h.ghorbelQmax123(S, Pan / 1000, dh, L, Ic);

  vaut(q(b, "ch4-e11", 1), qmax * h.GHORBEL_R.II[T], "Ghorbel zone II");
  vaut(q(b, "ch4-e11", 2), qmax * h.GHORBEL_R.III[T], "Ghorbel zone III");
  vaut(q(b, "ch4-e11", 3), h.GHORBEL_R.III[T] / h.GHORBEL_R.II[T], "rapport des deux zones");
  vaut(q(b, "ch4-e11", 5), h.kallel("NoyauDorsale", S, T), "Kallel dorsale");
  vaut(q(b, "ch4-e11", 6), h.kallel("CentreSahel", S, T), "Kallel Centre-Sahel");
  vaut(q(b, "ch4-e11", 7), h.kallel("CentreSahel", S, T) / h.kallel("NoyauDorsale", S, T),
    "rapport des deux régions");

  // Le cœur de l'exercice : le zonage pèse plus lourd que la morphométrie.
  // Un écart de 10 % sur la surface — déjà généreux pour un MNT — ne déplace
  // pas le débit autant que le choix d'une région voisine.
  const parSurface = h.kallel("NoyauDorsale", S * 1.1, T) / h.kallel("NoyauDorsale", S, T);
  const parZone = h.kallel("CentreSahel", S, T) / h.kallel("NoyauDorsale", S, T);
  assert.ok(parZone > 8 * (parSurface - 1) + 1,
    `le zonage (×${parZone.toFixed(2)}) doit dominer 10 % de surface (×${parSurface.toFixed(3)})`);

  // Les trois motifs de refus sont bien distincts sur ce bassin : Fersi est
  // hors ZONE (sa pluie passe), Frigui hors TABLE (sa zone convient).
  assert.equal(h.motifsHorsDomaine("fersi", { S, Pan, T, zone: null })[0].startsWith("hors zone"), true);
  assert.equal(h.motifsHorsDomaine("fersi", { S, Pan, T, zone: "SudEst" }).length, 0,
    "la pluie de 340 mm est dans le domaine de Fersi");
  assert.match(h.motifsHorsDomaine("frigui", { S, Pan, T, zone: "CentreSud" })[0], /hors table/);
});

test("ch9 — l'oued de démonstration recalculé", () => {
  const b = banque("ch9");
  const oued = JSON.parse(readFileSync(new URL("../data/oued-demo.json", import.meta.url)));
  const S = riv.sectionNaturelle(oued.points, oued.sousSections);
  const J = oued.pente;

  // e1 — lits séparés contre bloc unique, au-dessus des berges
  const d = riv.debitA(S, 137.90, J);
  vaut(q(b, "ch9-e1", 0), d.Q, "débit par lits séparés");
  vaut(q(b, "ch9-e1", 1), d.Qbloc, "débit d'un seul bloc");

  // e2 — le périmètre du lit mineur exclut les verticales de séparation
  const mineur = d.lits[1];
  vaut(q(b, "ch9-e2", 0), mineur.perimetre, "périmètre du lit mineur");
  vaut(q(b, "ch9-e2", 2), mineur.R, "rayon hydraulique du lit mineur");
  const bornes = oued.sousSections[1];
  const seul = riv.trancheMouillee(S, bornes.x0, bornes.x1, 137.90);
  assert.ok(Math.abs(mineur.perimetre - seul.perimetre) < 1e-9,
    "aucune longueur ajoutée aux interfaces");

  // e3 — la courbe de tarage produit TW
  const z100 = riv.tirantNormal(S, 100, J);
  vaut(q(b, "ch9-e3", 0), z100, "cote du plan d'eau à 100 m³/s");
  vaut(q(b, "ch9-e3", 1), z100 - 135.40, "TW au-dessus du radier de sortie");

  // e4 — régime
  const d100 = riv.debitA(S, z100, J);
  vaut(q(b, "ch9-e4", 0), d100.vitesse, "vitesse moyenne");
  vaut(q(b, "ch9-e4", 1), d100.froude, "Froude");
  vaut(q(b, "ch9-e4", 2), riv.coteCritique(S, 100), "cote critique");

  // e5 — portée du remous, et son effondrement quand la pente double
  const portee = (pente) => {
    const hn = riv.tirantNormal(S, 100, pente) - S.zMin;
    return riv.remous(S, { Q: 100, J: pente, hAval: hn + 0.5, pas: 20, longueur: 20000 }).portee;
  };
  vaut(q(b, "ch9-e5", 0), portee(J), "portée à 0,25 %");
  vaut(q(b, "ch9-e5", 1), portee(0.005), "portée à 0,50 %");

  // e6 — Bélanger
  const j = riv.ressaut(0.40, 3.5);
  vaut(q(b, "ch9-e6", 0), j.y2, "conjuguée");
  vaut(q(b, "ch9-e6", 1), j.perte, "perte de charge");
  vaut(q(b, "ch9-e6", 2), j.longueur, "longueur du ressaut");
  assert.equal(j.type, "oscillant", "type de ressaut annoncé par l'énoncé");

  // e7 — les trois positions, dans l'ordre des options de la banque
  const positions = ["rejeté", "en place", "noyé"];
  [1.30, 1.79, 2.10].forEach((TW, i) => {
    assert.equal(riv.positionRessaut(0.40, 3.5, TW).position, positions[i],
      `position du ressaut pour TW = ${TW}`);
  });

  // e8 — ce que coûte une classe de Strickler
  const graviers = riv.sectionNaturelle(oued.points, oued.sousSections.map((ss, i) =>
    ({ ...ss, strickler: i === 1 ? "litGravier" : ss.strickler })));
  const zGraviers = riv.tirantNormal(graviers, 100, J);
  vaut(q(b, "ch9-e8", 0), zGraviers, "cote avec un lit de graviers");
  vaut(q(b, "ch9-e8", 1), (zGraviers - z100) * 100, "déplacement en centimètres");

  // e9 — le débit que le levé permet encore de calculer
  vaut(q(b, "ch9-e9", 2), riv.debitA(S, S.zMax, J).Q, "débit à la limite du levé");
  assert.equal(riv.tirantNormal(S, 185, J), null, "185 m³/s est bien hors du levé");
});

test("ch10 — les exemples du bulletin FAO 54 recalculés", () => {
  const b = banque("ch10");
  const CIEH = JSON.parse(readFileSync(new URL("../data/cieh-fao54.json", import.meta.url)));
  const ORSTOM = JSON.parse(readFileSync(new URL("../data/orstom-fao54.json", import.meta.url)));

  // e2 — la rationnelle avec une IDF locale
  const i = 800 * Math.pow(40, -0.7);
  vaut(q(b, "ch10-e2", 2), i, "intensité de l'IDF locale");
  vaut(q(b, "ch10-e2", 3), fao.rationnelleLocale({ C: 0.45, S: 3.2, tcMin: 40,
    idf: { a: 800, b: -0.7 } }).Q, "débit rationnel");

  // e3 — abattement de Vuillaume
  vaut(q(b, "ch10-e3", 0), fao.abattement(550, 30), "abattement");

  // e4 — deux régressions du manuel, et l'erreur de pourcent
  const r10 = CIEH.regressions.lignes.find((r) => r.no === 10);
  const r5 = CIEH.regressions.lignes.find((r) => r.no === 5);
  vaut(q(b, "ch10-e4", 0), fao.ciehQ10(r10, { S: 30, Ig: 15, Kr10: 34 }).Q10, "CIEH n° 10");
  vaut(q(b, "ch10-e4", 1), fao.ciehQ10(r10, { S: 30, Ig: 15, Kr10: 0.34 }).Q10, "Kr10 en fraction");
  vaut(q(b, "ch10-e4", 2), fao.ciehQ10(r5, { S: 30, Ig: 15, Dd: 5.7 }).Q10, "CIEH n° 5");
  // Et l'erreur de pourcent vaut bien un facteur 100^0,534.
  const rapport = fao.ciehQ10(r10, { S: 30, Ig: 15, Kr10: 34 }).Q10
                / fao.ciehQ10(r10, { S: 30, Ig: 15, Kr10: 0.34 }).Q10;
  assert.ok(Math.abs(rapport - Math.pow(100, r10.kr10)) < 1e-9, "le facteur est 100^k");

  // e5 — la sélection par le site
  const prop = fao.proposerRegressions(CIEH, { Pan: 550, lonDeg: -1.5, pays: null });
  vaut(q(b, "ch10-e5", 0), prop.filter((x) => x.retenue).length, "régressions autorisées");

  // e6 — la chaîne ORSTOM du bassin moyen
  const e = { S: 30, Ig: 15, ordinal: 1.2, Pan: 550, P10: 88, zone: "sahelien",
              alpha10: 1.9, ratioRetarde: 0.04 };
  vaut(q(b, "ch10-e6", 0), fao.orstomKr10(ORSTOM, e).Kr10, "Kr10");
  vaut(q(b, "ch10-e6", 1), fao.orstomTb10(ORSTOM, e), "temps de base");
  const ro = fao.orstomChaine(ORSTOM, e);
  vaut(q(b, "ch10-e6", 2), ro.Qm10, "débit moyen");
  vaut(q(b, "ch10-e6", 3), ro.Q10, "Q10");

  // e7 — le petit bassin, et son débit spécifique
  const petit = fao.orstomChaine(ORSTOM, { S: 6, Ig: 20, classe: "RI", Pan: 500, P10: 86,
    zone: "sahelien", Kr10Saisi: 33, ratioRetarde: 0.05 });
  vaut(q(b, "ch10-e7", 2), petit.Q10 / 6, "débit spécifique du petit bassin");

  // e9 — le cumul multiplicatif
  vaut(q(b, "ch10-e9", 3), fao.cumulerCorrections([0.7, 0.7]), "cumul de deux réductions");

  // e10 — le Gradex
  vaut(q(b, "ch10-e10", 1), ro.C100, "coefficient de passage");
  vaut(q(b, "ch10-e10", 2), ro.Q100, "débit centennal");
});

test("les deux jeux de méthodes ne se rencontrent jamais dans le cours", () => {
  // Un débit tunisien et un débit FAO 54 n'estiment pas la même chose à partir
  // des mêmes données : aucun module ne doit importer les deux et les additionner.
  const fr = readFileSync(new URL("../src/solvers-fil-rouge.js", import.meta.url), "utf-8");
  assert.ok(!/solvers-fao54/.test(fr), "le fil rouge, tunisien, ne doit pas importer le jeu FAO 54");
  const ch10 = readFileSync(new URL("../src/cours-ch10.js", import.meta.url), "utf-8");
  assert.ok(!/GHORBEL|sogreah|kallel|frigui|francou/i.test(ch10),
    "le chapitre 10 ne doit pas convoquer les régionalisations tunisiennes");
  // Et la synthèse du chapitre 4 ne connaît pas le CIEH.
  const hyd = readFileSync(new URL("../src/solvers-hydro.js", import.meta.url), "utf-8");
  assert.ok(!/cieh|orstom/i.test(hyd), "solvers-hydro ne doit rien savoir du jeu FAO 54");
});
