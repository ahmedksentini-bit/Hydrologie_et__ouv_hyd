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

test("plancher géométrique de Gravelius et rectangle dégénéré", () => {
  // bassin réel : le contrôle L × l = S tient
  const normal = h.rectangleEquivalent(42, 31);
  assert.equal(normal.quasiCirculaire, false);
  proche(normal.L * normal.l, 42, 1e-3, "contrôle L×l");
  // Ic sous 1,128 : géométriquement impossible, le rectangle dégénère en carré
  const impossible = h.rectangleEquivalent(42, 24);
  assert.ok(impossible.Ic < h.IC_MINIMUM, "Ic sous le plancher");
  assert.equal(impossible.quasiCirculaire, true);
  proche(impossible.L, impossible.l, 1e-9, "le rectangle devient un carré");
  assert.ok(Math.abs(impossible.L * impossible.l - 42) > 1, "le contrôle L×l ne tient plus");
});

test("densité de drainage", () => {
  proche(h.densiteDrainage(63, 42), 1.5, 1e-9, "Dd");
  assert.equal(h.densiteDrainage(63, 0), 0);
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

const SERIE = [28, 62, 35, 19, 47, 88, 31, 24, 55, 41, 73, 22, 36, 110, 44, 29, 51, 38, 67, 26];

test("ajustement de Gumbel par les moments", () => {
  const a = h.ajustementGumbel(SERIE);
  assert.equal(a.n, 20);
  proche(a.moyenne, 46.30, 0.01, "moyenne");
  proche(a.ecartType, 23.7666, 0.001, "écart-type d'échantillon");
  proche(a.gradex, 18.5308, 0.001, "gradex");
  proche(a.mode, 35.6040, 0.001, "mode");
  proche(h.quantileGumbel(a, 10), 77.31, 0.02, "P10");
  proche(h.quantileGumbel(a, 100), 120.85, 0.02, "P100");
  // aller-retour : la période de retour du quantile redonne la période
  proche(h.periodeRetourDe(a, h.quantileGumbel(a, 50)), 50, 1e-6, "aller-retour");
  proche(h.periodeRetourDe(a, 110), 55.9, 0.1, "période du maximum observé");
  assert.equal(h.ajustementGumbel([42]), null, "série trop courte");
});

test("positions de tracage et variable réduite", () => {
  proche(h.positionTracage(1, 20), 20 / 21, 1e-9, "Weibull, rang 1");
  proche(1 / (1 - h.positionTracage(1, 20)), 21, 1e-9, "période empirique du maximum");
  proche(h.positionTracage(1, 20, "hazen"), 1 - 0.5 / 20, 1e-9, "Hazen, rang 1");
  // la variable réduite est la réciproque de la fréquence
  proche(h.variableReduite(1 - 1 / 10), h.gumbel(10), 1e-9, "réciprocité");
});

test("abattement spatial du bulletin FAO n° 54", () => {
  proche(h.coefficientAbattement(320, 42), 0.7605, 1e-3, "42 km²");
  proche(h.coefficientAbattement(300, 2.35), 0.9449, 1e-3, "2,35 km²");
  proche(h.coefficientAbattement(180, 265), 0.6282, 1e-3, "265 km²");
  proche(h.coefficientAbattement(320, 1), 1, 1e-9, "1 km² : pas d'abattement");
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
  // zones IV et V : le logarithme est NÉPÉRIEN, et c'est la valeur par défaut
  proche(h.ghorbelQmax45(265), 474.28, 0.01, "Qmax défaut");
  assert.equal(h.ghorbelQmax45(265), h.ghorbelQmax45(265, "ln"), "le défaut est ln");
  proche(h.ghorbelQmax45(265, "log10"), 205.98, 0.01, "Qmax log10");
  proche(h.ghorbelQmax45(265) / h.ghorbelQmax45(265, "log10"), Math.LN10, 1e-9, "facteur ln(10)");
});

test("Ghorbel IV/V — ln recoupe Kallel, log10 non", () => {
  // Deux régionalisations indépendantes couvrant le Sahel : leurs ordres de grandeur
  // doivent s'encadrer. Avec ln elles se croisent ; avec log10 Ghorbel resterait
  // systématiquement sous Kallel, d'un facteur qui atteint 4.
  const R = h.GHORBEL_R.IV[100];
  const rapport = (S, base) =>
    (R * h.ghorbelQmax45(S, base)) / h.kallel("CentreSahel", S, 100);
  const bornes = (base) => {
    const v = [];
    for (let S = 100; S <= 2000; S += 1) v.push(rapport(S, base));
    return [Math.min(...v), Math.max(...v)];
  };
  const [minLn, maxLn] = bornes("ln");
  assert.ok(minLn < 1 && maxLn > 1, `ln encadre Kallel (${minLn} … ${maxLn})`);
  proche(minLn, 0.549, 1e-3, "borne basse ln");
  proche(maxLn, 1.487, 1e-3, "borne haute ln");
  const [, maxLog] = bornes("log10");
  assert.ok(maxLog < 1, `log10 reste sous Kallel partout (max ${maxLog})`);
  proche(1 / maxLog, 1.55, 0.01, "écart minimal de log10 à Kallel");

  // croisement des deux méthodes, cité dans le cours
  let a = 100, b = 2000;
  const g = (S) => rapport(S, "ln") - 1;
  for (let i = 0; i < 200; i++) { const m = (a + b) / 2; if (g(a) * g(m) <= 0) b = m; else a = m; }
  proche((a + b) / 2, 362, 1, "croisement vers 360 km²");

  // la formule est presque plate : ×20 sur S ne fait que ×1,65 sur Qmax
  proche(h.ghorbelQmax45(2000) / h.ghorbelQmax45(100), 1.651, 1e-3, "aplatissement");
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

test("risque de dépassement pendant la durée de vie", () => {
  proche(h.risqueDepassement(100, 1) * 100, 1, 1e-9, "un an à T = 100");
  proche(h.risqueDepassement(50, 30) * 100, 45.45, 0.01, "30 ans de vie à T = 50");
  proche(h.risqueDepassement(100, 30) * 100, 26.03, 0.01, "30 ans de vie à T = 100");
  proche(h.risqueDepassement(30, 30) * 100, 63.83, 0.01, "30 ans de vie à T = 30");
  // réciproque : la période qui ramène le risque à la valeur visée
  const T = h.periodePourRisque(0.10, 30);
  proche(T, 285.24, 0.05, "10 % de risque sur 30 ans");
  proche(h.risqueDepassement(T, 30), 0.10, 1e-9, "aller-retour");
});

test("période de retour — note circulaire DGPC N°1054/2019, §4", () => {
  assert.equal(h.periodeRetour({ categorie: "classee", ouvrage: "dalot", S: 2.35, tjma: 520 }), 30);
  assert.equal(h.periodeRetour({ categorie: "classee", ouvrage: "dalot", S: 42, tjma: 1800 }), 50);
  assert.equal(h.periodeRetour({ categorie: "classee", ouvrage: "art", S: 265, tjma: 4200 }), 100);
  assert.equal(h.periodeRetour({ categorie: "piste", ouvrage: "buse", S: 12, tjma: 40 }), 50);
  assert.equal(h.periodeRetour({ categorie: "autoroute", ouvrage: "dalot", S: 3, tjma: 9000 }), 100);
  assert.equal(h.periodeRetour({ categorie: "classee", ouvrage: "submersible", S: 150, tjma: 300 }), 100);
});

// La couverture en période de retour est affichée comme un tableau dans le
// cours : elle doit rester celle des tables du moteur, sans dérive silencieuse.
test("couverture en période de retour des régionalisations", () => {
  const T_DGPC = [30, 50, 100];
  // Ghorbel : 2, 5, 10, 20, 50, 100 dans les cinq zones — jamais 30
  for (const zone of Object.keys(h.GHORBEL_ZONES)) {
    assert.deepEqual(Object.keys(h.GHORBEL_R[zone]).map(Number).sort((a, b) => a - b),
      [2, 5, 10, 20, 50, 100], `Ghorbel ${zone}`);
    assert.equal(h.GHORBEL_R[zone][30], undefined, `Ghorbel ${zone} ne couvre pas 30 ans`);
  }
  // Fersi : pas de 2 ans, pas de 30 ans
  for (const sec of Object.keys(h.FERSI_Y)) {
    assert.deepEqual(Object.keys(h.FERSI_Y[sec]).map(Number).sort((a, b) => a - b),
      [5, 10, 20, 50, 100], `Fersi ${sec}`);
    assert.equal(h.FERSI_Y[sec][2], undefined, `Fersi ${sec} ne couvre pas 2 ans`);
  }
  // Frigui : 2, 5, 10 et 50 seulement — ni 20, ni 30, ni 100
  for (const reg of Object.keys(h.FRIGUI)) {
    assert.deepEqual(Object.keys(h.FRIGUI[reg].lambda).map(Number).sort((a, b) => a - b),
      [2, 5, 10, 50], `Frigui ${reg}`);
    for (const T of [20, 30, 100])
      assert.equal(h.frigui(reg, 100, T), null, `Frigui ${reg} refuse ${T} ans`);
  }
  // Kallel est analytique : elle répond à toutes les périodes de la note DGPC
  for (const T of T_DGPC)
    for (const reg of Object.keys(h.KALLEL))
      assert.ok(h.kallel(reg, 150, T) > 0, `Kallel ${reg} à ${T} ans`);
  // et le saut du Centre-Sahel au-delà de 20 ans est bien un saut
  const avant = h.kallel("CentreSahel", 150, 20), apres = h.kallel("CentreSahel", 150, 21);
  assert.ok(apres / avant > 1.6, `saut du Centre-Sahel : ×${(apres / avant).toFixed(2)}`);
});

test("SOGREAH interpole en variable de Gumbel, pas en T", () => {
  const P10 = 72, P100 = 118;
  assert.equal(h.sogreahPluie(10, P10, P100), P10, "à 10 ans, P10");
  assert.equal(h.sogreahPluie(100, P10, P100), P100, "à 100 ans, P100");
  const P50 = h.sogreahPluie(50, P10, P100);
  // interpolation linéaire en T donnerait bien moins : (50−10)/(100−10) = 44 %
  const lineaire = P10 + ((50 - 10) / (100 - 10)) * (P100 - P10);
  assert.ok(P50 > lineaire + 3,
    `en y : ${P50.toFixed(1)} mm, en T : ${lineaire.toFixed(1)} mm — l'écart doit être net`);
  // et la position en y se retrouve
  const attendu = P10 + ((h.gumbel(50) - 2.25) / (4.6 - 2.25)) * (P100 - P10);
  assert.ok(Math.abs(P50 - attendu) < 1e-9, "position en variable réduite");
});

// Le seuil de ruissellement peut dépasser la pluie décennale : c'est le cas du
// Sud saharien, et la formule doit le dire au lieu de sortir un débit négatif.
test("SOGREAH — sous le seuil, aucun débit, et le motif est explicite", () => {
  // Tozeur : P0 = 50 mm, P10 = 40 mm
  const PT10 = h.sogreahPluie(10, 40, 70);
  assert.equal(PT10, 40, "à 10 ans, P_T vaut P10");
  const verdict = h.sogreahRuisselle(PT10, 50);
  assert.equal(verdict.ruisselle, false);
  assert.match(verdict.motif, /sous le seuil de ruissellement/);
  assert.equal(h.sogreahDebit(50, PT10, 50), 0, "zéro, jamais un débit négatif");
  // à une période plus rare, le seuil est franchi
  const PT50 = h.sogreahPluie(50, 40, 70);
  assert.ok(PT50 > 50, `P_T à 50 ans vaut ${PT50.toFixed(1)} mm`);
  assert.equal(h.sogreahRuisselle(PT50, 50).ruisselle, true);
  assert.ok(h.sogreahDebit(50, PT50, 50) > 0);
  // la borne est exacte : au seuil lui-même, rien ne ruisselle
  assert.equal(h.sogreahDebit(50, 50, 50), 0, "P_T = P0 : pas de ruissellement");
  assert.equal(h.sogreahRuisselle(50, 50).ruisselle, false);
  // et le cas courant reste inchangé
  proche(h.sogreahDebit(2.35, 96.72, 20), 12.13, 0.01, "Kasserine, inchangé");
});

test("domaines de validité — les bornes déclarées sont celles qu'on applique", () => {
  // Le tableau du cours est engendré par DOMAINES ; ce test vérifie que
  // DOMAINES dit bien ce que la synthèse du chapitre 4 refuse. Les deux
  // avaient toutes les raisons de diverger : l'une est un tableau, l'autre
  // une suite de conditions écrites à des mois d'écart.
  const attendu = {
    rationnelle: { surface: { max: 4 } },
    kallel: { surface: { min: 100 } },
    francou: { surface: { min: 100 } },
    sogreah: { pluieAnnuelle: { max: 500 } },
    fersi: { pluieAnnuelle: { max: 400 } },
  };
  for (const [id, bornes] of Object.entries(attendu))
    for (const [champ, valeurs] of Object.entries(bornes))
      assert.deepEqual(h.DOMAINES[id][champ], valeurs, `${id}.${champ}`);
  // Les périodes tabulées viennent des tables elles-mêmes.
  assert.deepEqual(h.DOMAINES.ghorbel.periodes, Object.keys(h.GHORBEL_R.I).map(Number));
  assert.deepEqual(h.DOMAINES.fersi.periodes, Object.keys(h.FERSI_Y.SudEst).map(Number));
  assert.deepEqual(h.DOMAINES.frigui.periodes, Object.keys(h.FRIGUI.Nord.lambda).map(Number));
  assert.equal(h.DOMAINES.kallel.periodes, "analytique");
});

test("hors domaine : les motifs se cumulent au lieu de se masquer", () => {
  // Un petit bassin très arrosé, à une période que personne ne tabule : la
  // plupart des méthodes sont hors domaine pour DEUX raisons. N'en dire
  // qu'une induit en erreur sur ce qu'il faudrait changer.
  const cas = { S: 8, Pan: 620, T: 30, zone: "II" };
  assert.deepEqual(h.motifsHorsDomaine("rationnelle", cas).length, 1);
  assert.equal(h.motifsHorsDomaine("kallel", cas).length, 1, "Kallel : la surface seule");
  assert.equal(h.motifsHorsDomaine("fersi", cas).length, 2, "Fersi : la pluie ET la table");
  assert.match(h.motifsHorsDomaine("fersi", cas)[0], /pluie annuelle > 400/);
  assert.match(h.motifsHorsDomaine("fersi", cas)[1], /hors table/);
  // Zone non choisie : le motif vient en premier, c'est le plus facile à corriger.
  assert.match(h.motifsHorsDomaine("ghorbel", { ...cas, zone: null })[0], /hors zone/);
  // À T = 30 ans — la note DGPC — seules trois méthodes répondent sur un
  // grand bassin. C'est l'affirmation du cours, vérifiée ici.
  const grand = { S: 120, Pan: 320, T: 30, zone: "II" };
  const applicables = Object.keys(h.DOMAINES)
    .filter((id) => h.motifsHorsDomaine(id, grand).length === 0);
  assert.deepEqual(applicables, ["sogreah", "kallel", "francou"]);
});

test("le résumé de domaine reste lisible et complet", () => {
  for (const id of Object.keys(h.DOMAINES)) {
    const r = h.resumeDomaine(id);
    assert.ok(r.length > 5, `${id} : résumé vide`);
    assert.ok(!r.includes("undefined") && !r.includes("null"), `${id} : ${r}`);
  }
  assert.equal(h.resumeDomaine("rationnelle"), "S < 4 km²");
  assert.equal(h.resumeDomaine("kallel"), "S ≥ 100 km² · tout T (analytique) · zone à choisir");
});
