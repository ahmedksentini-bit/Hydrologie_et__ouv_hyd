// La banque d'exercices ne doit pas dériver des solveurs : les réponses
// numériques sont recalculées ici, et la structure est contrôlée.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as h from "../src/solvers-hydro.js";

const banque = (ch) => JSON.parse(readFileSync(new URL(`../data/exercices-${ch}.json`, import.meta.url)));
const q = (b, exoId, i) => b.exercices.find((e) => e.id === exoId).questions[i];
const vaut = (question, valeur, msg) =>
  assert.ok(Math.abs(valeur - question.reponse) <= question.tolerance,
    `${msg} : solveur ${valeur.toFixed(3)}, banque ${question.reponse} (± ${question.tolerance})`);

for (const ch of ["ch4", "ch5"]) {
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
