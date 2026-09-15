// Contrôles numériques des solveurs, sur trois bassins de référence
// (BV1 Kasserine 2,35 km² · BV2 dorsale 42 km² · BV3 Sud-Est 265 km²).
import test from "node:test";
import assert from "node:assert/strict";
import * as h from "../src/solvers-hydro.js";

const proche = (obtenu, attendu, tol, msg) =>
  assert.ok(Math.abs(obtenu - attendu) <= tol,
    `${msg} : obtenu ${obtenu.toFixed(4)}, attendu ${attendu} (± ${tol})`);

test("morphométrie — Gravelius et rectangle équivalent", () => {
  const { Ic, L, l } = h.rectangleEquivalent(2.35, 7.2);
  proche(Ic, 1.3249, 5e-4, "Ic");
  proche(L, 2.745, 5e-3, "L_rect");
  proche(l, 0.856, 5e-3, "l_rect");
  proche(L * l, 2.35, 1e-3, "contrôle L×l = S");
  proche(h.indiceGlobalPente(800, 696, L), 37.89, 0.02, "Ig");
});

test("temps de concentration — quatre formules, unités ramenées aux minutes", () => {
  const tc = h.tempsConcentration({ S: 2.35, L: 2.85, D: 96, iPct: 3.4, Hmoy: 54 });
  proche(tc.kirpich, 32.90, 0.02, "Kirpich");
  proche(tc.ventura, 63.18, 0.02, "Ventura");
  proche(tc.passiniHeures, 1.104, 2e-3, "Passini (h)");
  proche(tc.passini, 66.24, 0.05, "Passini (min)");
  proche(tc.giandottiHeures, 1.770, 2e-3, "Giandotti (h)");
  proche(tc.giandotti, 106.21, 0.05, "Giandotti (min)");
});

test("Montana — i = a·t^(−b)·T^c et facteur d'unité 60^b", () => {
  const i = h.montana(211, 0.633, 0.178, 32.90, 30);
  proche(i, 42.35, 0.02, "i à tc = 32,90 min, T = 30 ans");
  // t en heures au lieu de minutes : rapport exactement 60^b
  const iHeures = h.montana(211, 0.633, 0.178, 32.90 / 60, 30);
  proche(iHeures / i, Math.pow(60, 0.633), 1e-9, "rapport heures/minutes");
  // la borne de durée ne s'extrapole pas sous la table
  assert.equal(h.dureeEffective(1.104, 5), 5);
  assert.equal(h.dureeEffective(32.9, 5), 32.9);
});

test("abaque du coefficient de ruissellement", () => {
  assert.deepEqual(h.coefficientRuissellement(3.4, 38),
    { C: 0.5, indiceVegetation: 2, classePente: "moyenne" });
  assert.equal(h.coefficientRuissellement(3.4, 28).C, 0.6);
  assert.equal(h.coefficientRuissellement(3.4, 55).C, 0.4);
  assert.equal(h.coefficientRuissellement(9, 38).C, 0.6, "pente forte");
  // faible et moyenne partagent la même ligne : la frontière à 2 % ne change rien
  assert.equal(h.coefficientRuissellement(1.5, 38).C, h.coefficientRuissellement(3.4, 38).C);
  assert.equal(h.coefficientRuissellement(3.4, NaN), null, "couverture non mesurée");
});

test("méthode rationnelle — BV1", () => {
  proche(h.rationnelle(0.5, 42.35, 2.35), 13.83, 0.01, "Q");
});

test("SOGREAH — interpolation de Gumbel et débit", () => {
  proche(h.gumbel(30), 3.3843, 5e-4, "Y30");
  proche(h.gumbel(50), 3.9019, 5e-4, "Y50");
  proche(h.gumbel(100), 4.6001, 5e-4, "Y100");
  proche(h.sogreahPluie(30, 75, 120), 96.72, 0.01, "P30 BV1");
  proche(h.sogreahDebit(2.35, 96.72, 20), 12.13, 0.01, "Q30 BV1");
  proche(h.sogreahPluie(50, 100, 160), 142.18, 0.01, "P50 BV2");
  proche(h.sogreahDebit(42, 142.18, 20), 167.98, 0.01, "Q50 BV2");
  assert.equal(h.sogreahPluie(100, 60, 250), 250, "T ≥ 100 : P_T = P100");
  proche(h.sogreahDebit(265, 250, 40), 1149.40, 0.01, "Q100 BV3");
});

test("Ghorbel — zones I à III puis IV et V", () => {
  const Ic = h.gravelius(31, 42);
  const qmax = h.ghorbelQmax123(42, 0.320, 158, 12.5, Ic);
  proche(qmax, 27.25, 0.01, "Qmax(moy) BV2");
  proche(qmax * h.GHORBEL_R.III[50], 154.79, 0.02, "Q50 BV2");
  // Δh = Hmax − Hmin au lieu de Hméd − Zfranchissement : +71 %
  const faux = h.ghorbelQmax123(42, 0.320, 410, 12.5, Ic);
  proche(faux / qmax - 1, 0.714, 2e-3, "surestimation due à Δh");
  // base du logarithme en zones IV et V : facteur ln(10)
  proche(h.ghorbelQmax45(265, "log10"), 205.98, 0.01, "Qmax log10");
  proche(h.ghorbelQmax45(265, "ln"), 474.28, 0.01, "Qmax ln");
  proche(h.ghorbelQmax45(265, "ln") / h.ghorbelQmax45(265, "log10"), Math.LN10, 1e-9, "rapport");
});

test("Kallel — BV3", () => {
  proche(h.kallel("SudEstSudOuest", 265, 100), 1328.28, 0.02, "Q100");
  // le Centre-Sahel change de q0 au-delà de 20 ans
  assert.ok(h.kallel("CentreSahel", 200, 50) > h.kallel("CentreSahel", 200, 20) * 1.5);
});

test("Fersi — trois étapes, BV3", () => {
  const He = h.fersiEcoulement(180, 4.55);
  proche(He, 6.2930, 5e-4, "He_moy");
  const QxMoy = h.fersiQxMoyen(He, 265);
  proche(QxMoy, 66.03, 0.02, "Qx_moy");
  proche(h.fersiQx(QxMoy, 265, 4.55, h.FERSI_Y.SudEst[100]), 357.65, 0.02, "Qx100");
  // exposant net de Ig = +0,5 − 0,423 = +0,077 : erreur de 21 % ⇒ +1,5 %
  const avecIgFaux = h.fersiQx(h.fersiQxMoyen(h.fersiEcoulement(180, 5.5), 265), 265, 5.5, 10.2);
  proche(avecIgFaux / 357.65 - 1, 0.015, 2e-3, "faible sensibilité à Ig");
});

test("Frigui — λ calé pour 2, 5, 10 et 50 ans seulement", () => {
  proche(h.frigui("CentreSud", 42, 50), 455.56, 0.02, "Q50 BV2");
  assert.equal(h.frigui("CentreSud", 265, 100), null, "T = 100 ans non calé");
  assert.equal(h.frigui("CentreSud", 42, 30), null, "T = 30 ans non calé");
});

test("Francou–Rodier — enveloppe", () => {
  proche(h.francouRodier(42, 4.8), 483.16, 0.02, "BV2");
  proche(h.francouRodier(265, 5.0), 1627.88, 0.02, "BV3");
  // hors domaine sous 100 km² : le débit spécifique explose
  assert.ok(h.francouRodier(2.35, 4.8) / 2.35 > 40, "extrapolation vers les petits bassins");
});

test("synthèse — médiane et dispersion", () => {
  const s = h.synthese([12.13, 13.83]);
  proche(s.mediane, 12.98, 0.01, "médiane BV1");
  proche(s.cv, 6.6, 0.1, "CV BV1");
  const t = h.synthese([154.79, 167.98, 455.56, 483.16]);
  proche(t.mediane, 311.77, 0.01, "médiane BV2");
  proche(t.cv, 48.9, 0.1, "CV BV2");
  assert.equal(h.synthese([]), null);
});

test("période de retour — note circulaire DGPC N°1054/2019, §4", () => {
  assert.equal(h.periodeRetour({ categorie: "classee", ouvrage: "dalot", S: 2.35, tjma: 520 }), 30);
  assert.equal(h.periodeRetour({ categorie: "classee", ouvrage: "dalot", S: 42, tjma: 1800 }), 50);
  assert.equal(h.periodeRetour({ categorie: "classee", ouvrage: "art", S: 265, tjma: 4200 }), 100);
  assert.equal(h.periodeRetour({ categorie: "piste", ouvrage: "buse", S: 12, tjma: 40 }), 50);
  assert.equal(h.periodeRetour({ categorie: "autoroute", ouvrage: "dalot", S: 3, tjma: 9000 }), 100);
  assert.equal(h.periodeRetour({ categorie: "classee", ouvrage: "submersible", S: 150, tjma: 300 }), 100);
});
