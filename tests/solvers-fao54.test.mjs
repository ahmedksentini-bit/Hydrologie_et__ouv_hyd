// Jeu FAO 54. Ces tests ne vérifient pas mes formules : ils reproduisent les
// EXEMPLES CHIFFRÉS DU BULLETIN, pages 55 à 73, à partir des ancres transcrites
// avec les tables. C'est le seul contrôle qui vaille pour un portage — une
// formule peut être joliment écrite et fausse, un exemple du manuel non.
//
// Tolérance : 2 %, comme les campagnes de BVTrace d'où viennent ces tables. Le
// manuel imprime ses résultats à deux chiffres significatifs et arrondit ses
// intermédiaires ; exiger mieux serait exiger ses arrondis, pas sa méthode.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as f from "../src/solvers-fao54.js";
import { coefficientAbattement } from "../src/solvers-hydro.js";

const lire = (n) => JSON.parse(readFileSync(new URL(`../data/${n}.json`, import.meta.url)));
const CIEH = lire("cieh-fao54"), ORSTOM = lire("orstom-fao54"), CHECK = lire("checklist-fao54");
const a2 = (v, attendu, msg, pct = 2) =>
  assert.ok(Math.abs(v - attendu) <= (Math.abs(attendu) * pct) / 100,
    `${msg} : ${v} contre ${attendu} du manuel (± ${pct} %)`);

test("l'abattement du bulletin est celui du chapitre 2, pas un second", () => {
  // Deux modules, une seule équation 1.9 : si elles divergent, un chapitre ment.
  for (const [pan, s] of [[300, 5], [500, 6], [550, 30], [900, 250]])
    assert.ok(Math.abs(f.abattement(pan, s) - coefficientAbattement(pan, s)) < 1e-12,
      `abattement divergent à Pan ${pan}, S ${s}`);
  for (const anc of CIEH.ancres_validation.abattement)
    a2(f.abattement(anc.pan, anc.s_km2), anc.a_attendu, `abattement page ${anc.page}`);
});

test("CIEH — les dix débits imprimés du manuel se retrouvent", () => {
  const pm10Par = { 6: 76.5, 30: 70.4 };   // valeurs des deux bassins du manuel
  for (const anc of CIEH.ancres_validation.q10) {
    const reg = CIEH.regressions.lignes.find((r) => r.no === anc.no_tableau);
    assert.ok(reg, `régression n° ${anc.no_tableau} absente de la table`);
    const r = f.ciehQ10(reg, { S: anc.s_km2, Ig: anc.ig, Kr10: anc.kr10, Dd: anc.dd,
                               Pm10: anc.pm10 ?? pm10Par[anc.s_km2] });
    assert.equal(r.motif, null, `n° ${anc.no_tableau} : ${r.motif}`);
    a2(r.Q10, anc.q10_attendu, `CIEH n° ${anc.no_tableau} (page ${anc.page})`);
  }
});

test("CIEH — aucune régression ne porte d'exposant sur la pluie annuelle", () => {
  // La pluie annuelle SÉLECTIONNE la zone, elle n'entre pas dans le calcul.
  // Un exposant sur Pan serait le signe d'une colonne décalée à la relecture.
  for (const reg of CIEH.regressions.lignes)
    assert.ok(!("pan" in reg) && !("p" in reg),
      `la régression n° ${reg.no} porte un exposant sur Pan`);
  assert.equal(CIEH.regressions.lignes.length, 48, "les 48 lignes du tableau 11");
});

test("CIEH — une variable exigée mais absente annule le calcul, avec son motif", () => {
  const avecDd = CIEH.regressions.lignes.find((r) => r.dd !== undefined);
  const r = f.ciehQ10(avecDd, { S: 30, Ig: 15, Kr10: 34 });        // Dd manquant
  assert.equal(r.Q10, null, "pas de valeur par défaut");
  assert.match(r.motif, /Dd/, "le motif nomme la donnée manquante");
  // Et la liste des variables exigées est celle de l'équation, dans l'ordre.
  assert.deepEqual(f.variablesDe({ a: 1, s: 0.5, ig: 0.3 }), ["S", "Ig"]);
});

test("CIEH — le tableau 9 rend le Kr10 des deux exemples", () => {
  for (const anc of CIEH.ancres_validation.kr10_geologie) {
    const k = f.kr10Geologie(CIEH, anc.categorie, anc.pan);
    a2(k.valeur, anc.kr10_attendu, `Kr10 ${anc.categorie} à ${anc.pan} mm`);
    assert.ok(k.r < 0.7, "la corrélation du tableau 9 est faible, et doit le rester à l'affichage");
  }
  assert.equal(f.kr10Geologie(CIEH, "inexistant", 500), null);
});

test("CIEH — la synthèse est une médiane sur plusieurs régressions, pas une formule", () => {
  const e = { S: 30, Ig: 15, Pm10: 70.4, Kr10: 34, Dd: 5.7 };
  const tous = f.ciehToutes(CIEH, e);
  const ok = tous.filter((r) => r.Q10 > 0);
  assert.ok(ok.length > 20, "la plupart des régressions doivent aboutir sur ce bassin complet");
  const s = f.syntheseCieh(ok);
  assert.ok(s.min < s.mediane && s.mediane < s.max, "min < médiane < max");
  assert.ok(s.etendue > 2, `l'étendue des régressions est large (${s.etendue.toFixed(1)}) — c'est le message`);
  // Une sélection explicite ne retient que les lignes demandées.
  assert.equal(f.ciehToutes(CIEH, e, [5, 10, 11]).length, 3);
});

test("ORSTOM — le petit bassin du manuel, page 55", () => {
  const pb = ORSTOM.ancres_validation.petit_bassin, at = pb.attendus;
  const base = { S: pb.s_km2, Ig: pb.ig, classe: pb.classe, Pan: pb.pan, P10: pb.p10,
                 zone: "sahelien" };
  // D'abord le REFUS : S < 10 km² et Ig > 15 m/km, hors du domaine analytique.
  const k = f.orstomKr10(ORSTOM, base);
  assert.equal(k.Kr10, null, "Kr10 doit être refusé hors du domaine des équations 3.2/3.3");
  assert.match(k.motif, /figures 9 et 10/, "le motif renvoie aux abaques non digitalisés");

  // Puis la chaîne, avec le Kr10 lu sur l'abaque et le ratio évalué sur le terrain.
  const r = f.orstomChaine(ORSTOM, { ...base, Kr10Saisi: pb.kr10_graphique,
                                     ratioRetarde: at.ratio_retarde });
  a2(r.A, at.abattement, "abattement");
  a2(r.Pm10, at.pm10, "Pm10");
  a2(r.Lr10, at.lr10, "lame ruisselée");
  a2(r.Vr10, at.vr10, "volume ruisselé");
  a2(r.Tb10, at.tb10_min, "temps de base");
  a2(r.Tm10, at.tm10_min, "temps de montée");
  a2(r.Qm10, at.qm10, "débit moyen");
  a2(r.Qr10, at.qr10, "débit de pointe ruisselé");
  a2(r.Q10, at.q10, "Q10");
  a2(r.Vret10, at.vret10, "volume retardé");
  a2(r.Vc10, at.vc10, "volume de crue");
  assert.equal(r.alpha10, ORSTOM.debits.alpha10_defaut, "alpha par défaut = 2,6");
});

test("ORSTOM — le bassin moyen du manuel, page 58", () => {
  const bm = ORSTOM.ancres_validation.bassin_moyen, at = bm.attendus;
  const e = { S: bm.s_km2, Ig: bm.ig, ordinal: bm.ordinal_infiltrabilite, Pan: bm.pan,
              P10: bm.p10, zone: "sahelien", alpha10: at.alpha10, ratioRetarde: at.ratio_retarde };
  // Kr10 analytique, cette fois : S = 30 km² et Ig = 15 m/km sont dans le domaine.
  const k = f.orstomKr10(ORSTOM, e);
  a2(k.kr70, at.kr70, "Kr70");
  a2(k.kr100, at.kr100, "Kr100");
  a2(k.Kr10, at.kr10, "Kr10 interpolé sur P10");
  const r = f.orstomChaine(ORSTOM, e);
  a2(r.Pm10, at.pm10, "Pm10");
  a2(r.Tb10, at.tb10_min, "temps de base");
  a2(r.Tm10, at.tm10_min, "temps de montée");
  a2(r.Qm10, at.qm10, "débit moyen");
  a2(r.Q10, at.q10, "Q10");
  a2(r.Vc10, at.vc10, "volume de crue");
  // L'ordinal fractionnaire reproduit la pondération surfacique du manuel :
  // 80 % I + 20 % RI ⇒ 1,2, et l'interpolation y est linéaire.
  assert.equal(f.ordinalDe("I"), 1);
  assert.equal(f.ordinalDe("RI"), 2);
  const pur = f.orstomKr10(ORSTOM, { ...e, ordinal: 1 });
  const ri = f.orstomKr10(ORSTOM, { ...e, ordinal: 2 });
  a2(k.Kr10, pur.Kr10 + 0.2 * (ri.Kr10 - pur.Kr10), "pondération surfacique par l'ordinal", 0.01);
});

test("ORSTOM — le temps de base ne s'extrapole pas hors des branches", () => {
  // Interpolation logarithmique dans la plage que le manuel laisse vide, et la
  // borne haute est la borne INFÉRIEURE de la plage imprimée (« 45-50 » ⇒ 45).
  const bm = ORSTOM.ancres_validation.bassin_moyen, at = bm.attendus;
  const e = { Ig: 15, ordinal: 1.2, zone: "sahelien" };
  a2(f.orstomTb10(ORSTOM, { ...e, S: 10 }), at.tb10_s10, "Tb10 à S = 10 km²");
  a2(f.orstomTb10(ORSTOM, { ...e, S: 45 }), at.tb10_s45, "Tb10 à S = 45 km²");
  a2(f.orstomTm10(ORSTOM, { ...e, S: 10 }), at.tm10_s10, "Tm10 à S = 10 km²");
  a2(f.orstomTm10(ORSTOM, { ...e, S: 45 }), at.tm10_s45, "Tm10 à S = 45 km²");
  // La valeur à 30 km² est entre les deux, et du bon côté de la moyenne
  // arithmétique puisque l'interpolation est logarithmique.
  const t30 = f.orstomTb10(ORSTOM, { ...e, S: 30 });
  assert.ok(t30 > at.tb10_s10 && t30 < at.tb10_s45, "Tb10 encadré");
  assert.ok(t30 > (at.tb10_s10 + at.tb10_s45) / 2, "interpolation logarithmique, pas linéaire");
});

test("ORSTOM — le Gradex mène du décennal au centennal", () => {
  const bm = ORSTOM.ancres_validation.bassin_moyen, at = bm.attendus;
  const e = { S: bm.s_km2, Ig: bm.ig, ordinal: bm.ordinal_infiltrabilite, Pan: bm.pan,
              P10: bm.p10, zone: "sahelien", alpha10: at.alpha10, ratioRetarde: at.ratio_retarde };
  const r = f.orstomChaine(ORSTOM, e);
  // C = 1 + ((P100−P10)/P10)·(Tb/24)^0,12 / Kr10, Tb en HEURES et Kr en FRACTION.
  const attendu = 1 + (0.45 * Math.pow(r.Tb10 / 60 / 24, 0.12)) / (r.Kr10 / 100);
  a2(r.C100, attendu, "coefficient de passage", 0.01);
  assert.ok(r.Q100 > r.Q10, "la centennale dépasse la décennale");
  // Avec P100 saisie, le rapport se calcule au lieu d'être approché.
  const avecP100 = f.orstomChaine(ORSTOM, { ...e, P100: bm.p10 * 1.6 });
  a2(avecP100.ratioP, 0.6, "rapport calculé sur les pluies", 0.01);
  assert.match(avecP100.sourceRatio, /calculé/);
});

test("les domaines d'ORSTOM et du CIEH ne coïncident pas", () => {
  const d = { cieh: CIEH, orstom: ORSTOM };
  // 300 mm : hors CIEH (borne 400), dans ORSTOM (borne 150).
  const sec = f.controlerDomaines(d, { S: 50, Pan: 300, zone: "sahelien" });
  assert.ok(sec.some((x) => x.methode === "CIEH"), "le CIEH doit se plaindre à 300 mm");
  assert.ok(!sec.some((x) => x.methode === "ORSTOM"), "ORSTOM ne doit pas se plaindre à 300 mm");
  // 1300 mm : hors des deux.
  assert.equal(f.controlerDomaines(d, { S: 50, Pan: 1300 })
    .filter((x) => x.methode === "ORSTOM").length > 0, true);
  // 1200 km² : dans ORSTOM (1500), hors CIEH (1000).
  const grand = f.controlerDomaines(d, { S: 1200, Pan: 800, zone: "sahelien" });
  assert.ok(grand.some((x) => x.methode === "CIEH" && /1000/.test(x.texte)));
  // La zone déclarée qui contredit la pluie : signalée, pas corrigée.
  const incoherent = f.controlerDomaines(d, { S: 50, Pan: 1000, zone: "sahelien" });
  assert.ok(incoherent.some((x) => /tropical/.test(x.texte)),
    "une zone sahélienne à 1000 mm doit être signalée");
  // Et ce sont des AVERTISSEMENTS : le calcul aboutit quand même.
  const r = f.orstomChaine(ORSTOM, { S: 50, Ig: 10, classe: "I", Pan: 1300, P10: 90, zone: "sahelien" });
  assert.ok(r.Q10 > 0, "hors domaine, le calcul aboutit — il est seulement fragile");
});

test("la rationnelle voyage, ses paramètres non", () => {
  // Sans IDF locale, on refuse : la table de Montana du chapitre 3 est tunisienne.
  const sans = f.rationnelleLocale({ C: 0.45, S: 3.2, tcMin: 40 });
  assert.equal(sans.Q, null, "pas d'intensité empruntée");
  assert.match(sans.motif, /IDF locale/);
  assert.match(sans.motif, /tunisiennes/, "le motif dit POURQUOI on ne peut pas transposer");
  // Sans C, on refuse aussi : l'abaque pente × végétation est tunisien.
  const sansC = f.rationnelleLocale({ S: 3.2, tcMin: 40, idf: { a: 800, b: -0.7 } });
  assert.equal(sansC.Q, null);
  assert.match(sansC.motif, /coefficient de ruissellement/);
  // Avec les deux, la formule universelle s'applique.
  const r = f.rationnelleLocale({ C: 0.45, S: 3.2, tcMin: 40, idf: { a: 800, b: -0.7 } });
  const i = 800 * Math.pow(40, -0.7);
  assert.ok(Math.abs(r.intensite - i) < 1e-9, "intensité de l'IDF locale");
  assert.ok(Math.abs(r.Q - 0.278 * 0.45 * i * 3.2) < 1e-9, "Q = 0,278·C·i·S");
  // La durée ne descend jamais sous le minimum de la table calée.
  const court = f.rationnelleLocale({ C: 0.45, S: 0.2, tcMin: 2, idf: { a: 800, b: -0.7 } });
  assert.ok(Math.abs(court.intensite - 800 * Math.pow(5, -0.7)) < 1e-9, "durée plafonnée à 5 min");
  assert.match(court.source, /plafonnée/);
});

test("la check-list pèse plus lourd que la précision des méthodes", () => {
  assert.equal(CHECK.zones.length, 2, "une liste sahélienne et une liste tropicale");
  assert.equal(CHECK.zones[0].items.length, 24);
  assert.equal(CHECK.zones[1].items.length, 19);
  // L'item 1a est bloquant dans les DEUX zones : la frange littorale.
  for (const zone of ["sahelien", "tropical"]) {
    const bl = f.itemsBloquants(CHECK, zone);
    assert.equal(bl.length, 1, `un seul item bloquant en zone ${zone}`);
    assert.equal(bl[0].code, "1a");
    assert.match(bl[0].texte, /ne s'appliquent pas/);
  }
  // Le cumul de deux corrections de même nature est MULTIPLICATIF : deux
  // réductions de 30 % donnent 0,49, pas 0,40. C'est le seul cumul défendable.
  assert.ok(Math.abs(f.cumulerCorrections([0.7, 0.7]) - 0.49) < 1e-12);
  assert.equal(f.cumulerCorrections([]), 1, "sans correction cochée, effet neutre");
});
