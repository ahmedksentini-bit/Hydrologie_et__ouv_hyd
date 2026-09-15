// Ouvrages annexes. Les contrôles portent d'abord sur les INVARIANTS du
// chapitre : les familles d'angles, la valeur de référence de la proposition
// esthétique, le fait qu'un biseau ne dépende que de D, et la réciprocité
// d'Isbash. Les vérifications hydrauliques sont des propriétés (Manning au
// tirant normal, Froude = 1 au critique, quantité de mouvement au ressaut).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as a from "../src/solvers-annexes.js";

const proche = (x, y, tol, msg) =>
  assert.ok(Math.abs(x - y) <= tol, `${msg} : ${x} vs ${y} (± ${tol})`);

test("proposition esthétique — la chaîne en grades", () => {
  const r = a.anglesEsthetiques(3, 90);
  proche(r.phiG, 100, 1e-12, "un ouvrage droit fait 100 grades");
  proche(r.alphaG, 15.27, 1e-12, "α_g = 15 + 0,03·L²");
  proche(r.alpha, 13.743, 1e-9, "valeur de référence pour L = 3 m");
  proche(r.beta, r.alpha, 1e-9, "sur un ouvrage droit, β = α");
  proche(a.anglesEsthetiques(5, 90).alpha, 14.175, 1e-9, "L = 5 m");
  // sur un biais, β s'écarte de α
  const biais = a.anglesEsthetiques(4, 80);
  assert.ok(Math.abs(biais.beta - biais.alpha) > 1, "sur un biais, β ≠ α");
  proche(biais.phiG, 80 / 0.9, 1e-12, "conversion du biais en grades");
  // α croît avec l'ouverture, lentement
  assert.ok(a.anglesEsthetiques(10, 90).alpha > a.anglesEsthetiques(3, 90).alpha);
  assert.equal(a.anglesEsthetiques(0, 90), null, "pas d'ouverture, pas d'angle");
});

test("familles d'angles — chacune refuse ce qu'elle n'a pas mesuré", () => {
  assert.equal(a.angleAdmissible("box-ailes-evasees", 45).ok, true);
  assert.equal(a.angleAdmissible("box-ailes-evasees", 30).ok, true, "borne incluse");
  assert.equal(a.angleAdmissible("box-ailes-evasees", 75).ok, true, "borne incluse");
  assert.equal(a.angleAdmissible("box-ailes-evasees", 20).ok, false);
  assert.match(a.angleAdmissible("box-ailes-evasees", 80).motif, /plage 30° à 75°/);
  // la famille discrète : deux valeurs, rien entre les deux
  assert.equal(a.angleAdmissible("box-ailes-15", 15).ok, true);
  assert.equal(a.angleAdmissible("box-ailes-15", 90).ok, true);
  assert.equal(a.angleAdmissible("box-ailes-15", 45).ok, false, "l'intervalle n'est pas couvert");
  assert.match(a.angleAdmissible("box-ailes-15", 45).motif, /ne couvre que 15° et 90°/);
  // valeurs imposées
  assert.equal(a.angleAdmissible("box-ailes-paralleles", 0).ok, true);
  assert.equal(a.angleAdmissible("box-ailes-paralleles", 10).ok, false);
  assert.equal(a.angleAdmissible("box-ailes-45-biseau", 45).ok, true);
  assert.equal(a.angleAdmissible("box-ailes-45-biseau", 44).ok, false);
  // murs frontaux : aucun angle à choisir
  for (const id of ["mur-frontal-chanfrein", "mur-frontal-biseau"])
    assert.match(a.angleAdmissible(id, 45).motif, /pas de mur en aile/);
  assert.equal(a.angleAdmissible("inconnue", 45).ok, false);
});

test("le complémentaire 90° − α : refusé sous 7,45 m d'ouverture, admis au-delà", () => {
  const admis = (L) => a.angleAdmissible("box-ailes-evasees",
    90 - a.anglesEsthetiques(L, 90).alpha).ok;
  for (const L of [3, 4, 5, 6, 7]) assert.equal(admis(L), false, `L = ${L} m : refusé, donc visible`);
  for (const L of [7.5, 8, 10]) assert.equal(admis(L), true, `L = ${L} m : admis, donc muet`);
  // la borne exacte : 90 − 0,9·(15 + 0,03·L²) = 75
  const Lbascule = Math.sqrt(((90 - 75) / 0.9 - 15) / 0.03);
  proche(Lbascule, 7.4536, 1e-3, "ouverture de bascule");
  proche(a.anglesEsthetiques(Lbascule, 90).alpha, 15, 1e-9, "α y vaut exactement 15°");
});

test("biseaux — fraction de D seulement, jamais d'une hauteur de remblai", () => {
  proche(a.biseauSuperieur("box-ailes-45-biseau", 1.5), 0.0645, 1e-9, "0,043 × 1,50");
  proche(a.biseauSuperieur("box-ailes-45-biseau", 3.0), 0.129, 1e-9, "proportionnel à D");
  assert.equal(a.biseauSuperieur("box-ailes-evasees", 1.5), 0, "arête vive : aucun biseau");
  proche(a.biseauSuperieur("mur-frontal-chanfrein", 1.5), 0.019, 1e-12, "chanfrein fixe de 19 mm");
  proche(a.biseauSuperieur("mur-frontal-chanfrein", 4.0), 0.019, 1e-12, "un chanfrein ne dépend pas de D");
  proche(a.biseauLateral("mur-frontal-biseau", 3.0), 0.042 * 3, 1e-12, "biseau latéral sur B");
  // propriété : la fonction n'a qu'un paramètre dimensionnel, donc rien ne peut
  // y faire entrer une hauteur de remblai par accident
  assert.equal(a.biseauSuperieur.length, 2, "biseauSuperieur(idEntrée, D)");
});

test("épaisseurs de mur", () => {
  proche(a.epaisseurBase(0.25, 2.5, 0.10, 0), 0.5 / 1.1, 1e-12, "(0,25 + 0,10×2,5)/1,10");
  proche(a.epaisseurBase(0.25, 4.0, 0.15, 0), (0.25 + 0.6) / 1.15, 1e-12, "mur plus haut");
  proche(a.epaisseurBase(0.25, 3, 0, 0), 0.25, 1e-12, "sans fruit, l'épaisseur ne varie pas");
  assert.ok(a.epaisseurBase(0.25, 4, 0.1, 0) > a.epaisseurBase(0.25, 2, 0.1, 0), "croît avec h");
  assert.equal(a.verifierEpaisseurTete(0.25).verdict, "conforme", "le minimum lui-même passe");
  assert.equal(a.verifierEpaisseurTete(0.20).verdict, "refusée");
  assert.equal(a.verifierEpaisseurTete(0.35).verdict, "hors plage usuelle");
  assert.equal(a.verifierEpaisseurTete(0).verdict, "non définie");
  proche(a.EPAISSEUR_TETE_MIN, 0.25, 1e-12, "minimum de bétonnage");
});

test("aucune longueur de mur n'est calculée depuis une hauteur", () => {
  // La règle « longueur = 1,4 H bornée à 2,5–6 m » ne figure dans aucun guide.
  // Ce contrôle interdit sa réintroduction discrète.
  const source = readFileSync(new URL("../src/solvers-annexes.js", import.meta.url), "utf-8");
  assert.ok(!/1\.4\s*\*\s*[Hh]|longueurMur|longueurAile/.test(source),
    "une longueur de mur ne se calcule pas depuis la hauteur de l'ouvrage");
  assert.ok(!Object.keys(a).some((k) => /longueurMur|longueurAile/i.test(k)),
    "aucune fonction de longueur de mur exportée");
});

test("Isbash — réciprocité et loi en V⁶", () => {
  const d = a.isbash(2.75);
  proche(d, 2.75 ** 2 / (2 * a.G * 0.86 ** 2 * 1.65), 1e-12, "formule directe");
  proche(a.vitesseIsbash(d), 2.75, 1e-9, "aller-retour vitesse → d50 → vitesse");
  // d50 ∝ V² et masse ∝ d50³, donc masse ∝ V⁶
  proche(a.masseBloc(a.isbash(4)) / a.masseBloc(a.isbash(2)), 64, 1e-6, "doubler V multiplie par 64");
  proche(a.masseBloc(a.isbash(3)) / a.masseBloc(a.isbash(2)), Math.pow(1.5, 6), 1e-6, "(3/2)⁶");
  proche(a.masseBloc(a.isbash(3)), 73.69, 0.05, "bloc à 3 m/s");
  proche(a.masseBloc(a.isbash(2)), 6.47, 0.02, "bloc à 2 m/s");
  // la faible turbulence demande des blocs plus petits, dans le rapport (0,86/1,20)²
  proche(a.isbash(3, { C: a.C_ISBASH.faible }) / a.isbash(3),
    (a.C_ISBASH.forte / a.C_ISBASH.faible) ** 2, 1e-12, "effet du coefficient");
  assert.equal(a.isbash(0), null);
});

test("longueur de protection — nulle quand la vitesse est déjà admissible", () => {
  assert.equal(a.longueurProtection(6, 1.2, 1.5).L, 0, "rien à protéger");
  const p = a.longueurProtection(6, 2.751, 1.5);
  proche(p.L, 1.5 * 6 * (2.751 / 1.5 - 1), 1e-12, "formule d'expansion");
  proche(p.L, 7.504, 0.01, "terre végétalisée");
  proche(a.longueurProtection(6, 2.751, 0.8).L, 21.944, 0.01, "terre nue");
  // décroissante avec la vitesse admissible, croissante avec la largeur
  assert.ok(a.longueurProtection(6, 2.751, 0.8).L > a.longueurProtection(6, 2.751, 2.0).L);
  assert.ok(a.longueurProtection(12, 2.751, 1.5).L > a.longueurProtection(6, 2.751, 1.5).L);
  assert.equal(a.longueurProtection(0, 2, 1), null);
});

test("fossé trapézoïdal — Manning et Froude vérifiés", () => {
  const sec = a.sectionTrapeze(0.4, 1.5);
  proche(sec.aire(1), 0.4 + 1.5, 1e-12, "A = (b + m·y)·y");
  proche(sec.perimetre(1), 0.4 + 2 * Math.sqrt(1 + 2.25), 1e-12, "P = b + 2y√(1+m²)");
  proche(sec.largeurAuMiroir(1), 0.4 + 3, 1e-12, "T = b + 2my");
  // un fruit nul redonne un rectangle
  const rect = a.sectionTrapeze(2, 0);
  proche(rect.aire(0.5), 1, 1e-12, "rectangle");
  proche(rect.profondeurCritique(4), Math.cbrt((4 * 4) / (a.G * 4)), 1e-6, "yc rectangulaire");
  // Manning est vérifié au tirant normal
  const yn = a.profondeurNormaleFosse(sec, 0.0358, 30, 0.01);
  proche(sec.debit(yn, 30, 0.01), 0.0358, 1e-6, "débit au tirant normal");
  proche(yn, 0.1131, 5e-4, "tirant du fossé de référence");
  // Froude vaut 1 à la profondeur critique
  const yc = sec.profondeurCritique(0.0358);
  proche((0.0358 ** 2 * sec.largeurAuMiroir(yc)) / (a.G * sec.aire(yc) ** 3), 1, 1e-4, "Froude = 1");
  assert.equal(a.profondeurNormaleFosse(sec, 1e6, 30, 0.01), null, "hors de portée");
});

test("dimensionnement du fossé — verdicts de revêtement", () => {
  const r = a.dimensionnerFosse({ Q: 0.0358, b: 0.4, m: 1.5, J: 0.01, K: 30 });
  proche(r.vitesse, 0.0358 / r.aire, 1e-12, "V = Q/A");
  proche(r.vitesse, 0.556, 0.005, "vitesse du cas de référence");
  assert.equal(r.regime, "fluvial");
  assert.equal(r.vitesseOk, true, "0,56 m/s sous les 1,5 m/s du gazon");
  proche(r.largeurEmprise, 0.4 + 2 * 1.5 * r.hauteur, 1e-12, "emprise en gueule");
  // sur terre nue, la même vitesse ne passe plus à forte pente
  const fort = a.dimensionnerFosse({ Q: 0.0358, b: 0.4, m: 1.5, J: 0.08, K: 30, revetement: "terre" });
  assert.equal(fort.vitesseOk, false, "1,15 m/s au-delà des 0,8 m/s de la terre nue");
  // l'enrochement calcule sa vitesse admissible au lieu de la lire
  const enr = a.dimensionnerFosse({ Q: 0.0358, b: 0.4, m: 1.5, J: 0.08, K: 25,
    revetement: "enrochement", d50: 0.20 });
  proche(enr.vitesseAdmissible, a.vitesseIsbash(0.20), 1e-12, "vitesse admissible calculée");
  assert.equal(a.VITESSES_ADMISSIBLES.filter((v) => v.calculee).length, 1,
    "une seule ligne du tableau se calcule");
});

test("descente d'eau — torrentiel, et ressaut de Bélanger", () => {
  const d = a.descenteEau({ Q: 0.0358, largeur: 0.4, penteTalus: 2 / 3, K: 65 });
  proche(d.vitesse, 3.955, 0.01, "vitesse sur talus 3/2");
  proche(d.Froude, 8.391, 0.01, "nombre de Froude");
  assert.equal(d.regime, "torrentiel");
  proche(d.conjuguee, 0.2576, 5e-4, "profondeur conjuguée");
  // contrôle indépendant : la quantité de mouvement se conserve au ressaut
  const q = 0.0358 / 0.4;
  const M = (y) => (q * q) / (a.G * y) + (y * y) / 2;
  proche(M(d.conjuguee), M(d.yn), 1e-6, "force spécifique conservée de part et d'autre");
  // une pente douce ne produit pas de régime torrentiel
  assert.equal(a.descenteEau({ Q: 0.0358, largeur: 0.4, penteTalus: 0.002, K: 65 }).regime, "fluvial");
});

test("débit de plateforme", () => {
  const p = a.debitPlateforme({ i: 102.2616, largeur: 7, longueur: 200 });
  proche(p.S, 0.0014, 1e-12, "1 400 m² en km²");
  proche(p.Q, 0.278 * 0.9 * 102.2616 * 0.0014, 1e-12, "méthode rationnelle");
  proche(p.Q * 1000, 35.82, 0.05, "35,8 L/s");
  // proportionnel à la longueur de collecte : c'est la variable de projet
  proche(a.debitPlateforme({ i: 102.2616, largeur: 7, longueur: 400 }).Q, 2 * p.Q, 1e-12,
    "doubler la collecte double le débit");
  assert.equal(a.debitPlateforme({ i: 0, largeur: 7, longueur: 200 }), null);
});
