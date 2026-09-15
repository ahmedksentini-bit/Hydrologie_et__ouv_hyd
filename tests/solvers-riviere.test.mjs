// Hydraulique du lit naturel. Les propriétés vérifiées ici sont celles que le
// chapitre 9 affiche comme des résultats : elles doivent tenir sans le
// solveur, sur des sections dont on sait calculer la réponse à la main.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as r from "../src/solvers-riviere.js";

const OUED = JSON.parse(readFileSync(new URL("../data/oued-demo.json", import.meta.url)));
const SECTION = r.sectionNaturelle(OUED.points, OUED.sousSections);
const proche = (a, b, eps, msg) =>
  assert.ok(Math.abs(a - b) <= eps, `${msg} : ${a} contre ${b} attendu (± ${eps})`);

// Un trapèze de plafond 10 m, fruit 2/1, sert de témoin : sa géométrie se
// calcule de tête, et un écart révèle une erreur de découpage.
const TRAPEZE = r.sectionNaturelle(
  [{ x: -13, z: 4 }, { x: -5, z: 0 }, { x: 5, z: 0 }, { x: 13, z: 4 }],
  [{ x0: -13, x1: 13, strickler: "litGalets", nom: "lit" }]);

test("géométrie du trapèze témoin, à la main", () => {
  const t = r.trancheMouillee(TRAPEZE, -13, 13, 2);
  proche(t.aire, 28, 1e-9, "aire (10 + 2·2·2)·… = (10+18)/2·2");
  proche(t.miroir, 18, 1e-9, "largeur au miroir 10 + 2·(2·2)");
  // deux talus de longueur √(4² + 2²) = 4,4721 et un plafond de 10 m
  proche(t.perimetre, 10 + 2 * Math.hypot(4, 2), 1e-9, "périmètre mouillé");
});

test("le tirant normal est la réciproque exacte du débit", () => {
  const J = 0.002;
  const Q = r.debitA(TRAPEZE, 2, J).Q;
  proche(r.tirantNormal(TRAPEZE, Q, J), 2, 1e-5, "z retrouvé");
  for (const cote of [0.4, 1.1, 3.2]) {
    const q = r.debitA(SECTION, SECTION.zMin + cote, OUED.pente).Q;
    proche(r.tirantNormal(SECTION, q, OUED.pente) - SECTION.zMin, cote, 1e-3, `cote ${cote}`);
  }
});

test("au niveau critique, le Froude vaut un", () => {
  // Attention : le Froude que rend debitA est celui de l'écoulement UNIFORME à
  // cette cote, pas celui du débit imposé. Ici, c'est le second qu'on vérifie.
  for (const Q of [20, 60, 120]) {
    const zc = r.coteCritique(SECTION, Q);
    const { aire, miroir } = r.trancheMouillee(SECTION, SECTION.xMin, SECTION.xMax, zc);
    const Fr = (Q / aire) / Math.sqrt((r.G * aire) / miroir);
    proche(Fr, 1, 2e-3, `Froude critique à ${Q} m³/s`);
  }
});

test("les verticales de séparation n'entrent pas dans le périmètre mouillé", () => {
  // La somme des périmètres des trois lits doit valoir le périmètre de la
  // section prise d'un seul tenant : aucune longueur n'est ajoutée aux
  // interfaces, et aucune n'est perdue.
  for (const z of [137.9, 138.2]) {
    const d = r.debitA(SECTION, z, OUED.pente);
    const entier = r.trancheMouillee(SECTION, SECTION.xMin, SECTION.xMax, z);
    proche(d.perimetre, entier.perimetre, 1e-9, `périmètre à ${z}`);
    proche(d.aire, entier.aire, 1e-9, `aire à ${z}`);
  }
});

test("les lits séparés donnent plus que le bloc unique dès le débordement", () => {
  const zBerge = Math.min(OUED.berges.gauche, OUED.berges.droite);
  // Sous les berges, un seul lit coule : les deux méthodes coïncident.
  const dedans = r.debitA(SECTION, zBerge - 0.05, OUED.pente);
  proche(dedans.ecartBloc, 0, 1e-9, "aucun écart tant que le lit majeur est sec");
  // Au-dessus, l'écart se creuse et ne se referme jamais.
  let precedent = 0;
  for (const z of [137.7, 137.9, 138.1, 138.3]) {
    const d = r.debitA(SECTION, z, OUED.pente);
    assert.ok(d.Q > d.Qbloc, `à ${z}, les lits séparés doivent l'emporter`);
    assert.ok(d.ecartBloc < precedent, `à ${z}, l'écart doit continuer de se creuser`);
    precedent = d.ecartBloc;
  }
});

test("le bloc unique fait DÉCROÎTRE le débit quand la crue déborde", () => {
  // C'est l'argument du chapitre : la courbe de tarage d'un seul bloc n'est
  // pas seulement fausse, elle n'est pas inversible.
  const zBerge = Math.min(OUED.berges.gauche, OUED.berges.droite);
  const avant = r.debitA(SECTION, zBerge - 0.02, OUED.pente).Qbloc;
  const apres = r.debitA(SECTION, zBerge + 0.08, OUED.pente).Qbloc;
  assert.ok(apres < avant,
    `le bloc unique devrait décroître au débordement : ${avant} puis ${apres}`);
  // Les lits séparés, eux, restent strictement croissants.
  let dernier = 0;
  for (let z = SECTION.zMin + 0.2; z < SECTION.zMax; z += 0.1) {
    const Q = r.debitA(SECTION, z, OUED.pente).Q;
    assert.ok(Q > dernier, `tarage non monotone à la cote ${z.toFixed(2)}`);
    dernier = Q;
  }
});

test("la courbe de tarage refuse d'extrapoler au-delà du levé", () => {
  const qMax = r.debitA(SECTION, SECTION.zMax, OUED.pente).Q;
  assert.equal(r.tirantNormal(SECTION, qMax * 1.2, OUED.pente), null,
    "au-delà du levé, il faut un refus, pas une berge inventée");
  const courbe = r.courbeTarage(SECTION, OUED.pente, [50, 100, qMax * 1.2]);
  assert.equal(courbe[2].z, null, "la courbe marque le point hors levé");
  assert.ok(courbe[0].z < courbe[1].z, "la courbe reste croissante");
});

test("le remous décroît, rejoint le tirant normal, et sa portée suit la pente", () => {
  const hn = r.tirantNormal(SECTION, 120, OUED.pente) - SECTION.zMin;
  const m = r.remous(SECTION, { Q: 120, J: OUED.pente, hAval: hn + 0.6, pas: 20, longueur: 6000 });
  proche(m.hNormal, hn, 1e-9, "tirant normal rappelé");
  proche(m.exhaussement, 0.6, 1e-9, "exhaussement à l'ouvrage");
  assert.ok(m.rejointNormal, "la ligne d'eau doit rejoindre le tirant normal");
  for (let i = 1; i < m.points.length; i++)
    assert.ok(m.points[i].h < m.points[i - 1].h,
      `la profondeur doit décroître vers l'amont (point ${i})`);
  proche(m.points[m.points.length - 1].h, hn, 0.011, "la dernière profondeur est la normale");

  // Doubler la pente raccourcit franchement la portée ; doubler l'exhaussement
  // ne l'allonge que d'un cinquième. C'est le tableau publié au chapitre 3.
  const portee = (J, exh) => {
    const h = r.tirantNormal(SECTION, 120, J) - SECTION.zMin;
    return r.remous(SECTION, { Q: 120, J, hAval: h + exh, pas: 20, longueur: 20000 }).portee;
  };
  assert.ok(portee(0.005, 0.6) < portee(0.0025, 0.6) / 2,
    "la pente doublée doit plus que diviser la portée par deux");
  const p60 = portee(0.0025, 0.6), p80 = portee(0.0025, 0.8);
  assert.ok(p80 > p60 && p80 < p60 * 1.3,
    `l'exhaussement doit peu jouer : ${p60} m puis ${p80} m`);
});

test("Bélanger : conjuguée, perte et réciprocité", () => {
  // Valeur classique : y₁ = 0,30 m, Fr₁ = 3 → y₂ = 0,15·(√73 − 1) = 1,1316 m
  const j = r.ressaut(0.30, 3);
  proche(j.y2, 0.15 * (Math.sqrt(73) - 1), 1e-9, "conjuguée");
  proche(j.perte, Math.pow(j.y2 - 0.30, 3) / (4 * 0.30 * j.y2), 1e-12, "perte de charge");
  proche(j.longueur, 6 * (j.y2 - 0.30), 1e-12, "longueur");
  // Au voisinage de Fr₁ = 1 la conjuguée tend vers y₁ : le ressaut s'annule.
  proche(r.ressaut(0.5, 1.001).y2, 0.5, 2e-3, "conjuguée au voisinage du critique");
  assert.equal(r.ressaut(0.5, 1).possible, false, "à Fr = 1 il n'y a rien à ressauter");
  assert.equal(r.ressaut(0.5, 0.8).possible, false, "pas de ressaut en fluvial");
  // La perte croît avec le Froude, toujours.
  let perte = 0;
  for (const Fr of [1.5, 2, 3, 5, 8]) {
    const e = r.ressaut(0.4, Fr);
    assert.ok(e.perte > perte, `perte croissante (Fr = ${Fr})`);
    perte = e.perte;
  }
});

test("la position du ressaut se lit sur la comparaison au niveau aval", () => {
  const { y2 } = r.ressaut(0.40, 3.5);
  assert.equal(r.positionRessaut(0.40, 3.5, y2 * 0.7).position, "rejeté");
  assert.equal(r.positionRessaut(0.40, 3.5, y2).position, "en place");
  assert.equal(r.positionRessaut(0.40, 3.5, y2 * 1.3).position, "noyé");
  assert.equal(r.positionRessaut(0.40, 0.8, 1).position, "aucun");
});

test("le Strickler du lit mineur commande, celui du lit majeur non", () => {
  const avec = (kMineur, kMajeur) => r.tirantNormal(
    r.sectionNaturelle(OUED.points, OUED.sousSections.map((s, i) =>
      ({ ...s, strickler: i === 1 ? kMineur : kMajeur }))), 120, OUED.pente);
  const reference = avec("litGalets", "majeurCultive");
  // Une classe d'écart en lit mineur : au moins quinze centimètres.
  assert.ok(Math.abs(avec("litGravier", "majeurCultive") - reference) > 0.15,
    "le lit mineur doit peser lourd");
  // La même amplitude en lit majeur : moins de trois centimètres.
  assert.ok(Math.abs(avec("litGalets", "majeurBoise") - reference) < 0.03,
    "le lit majeur ne doit presque rien peser sur la cote");
  // …et pourtant il ruine le bloc unique.
  const d = r.debitA(r.sectionNaturelle(OUED.points, OUED.sousSections), reference, OUED.pente);
  const partMajeur = (d.lits[0].Q + d.lits[2].Q) / d.Q;
  assert.ok(partMajeur < 0.02, `le lit majeur porte ${(100 * partMajeur).toFixed(1)} % du débit`);
  assert.ok(d.ecartBloc < -0.4, "et le bloc unique se trompe pourtant de plus de 40 %");
});

test("la table de Strickler est cohérente et décroissante", () => {
  for (let i = 1; i < r.STRICKLER.length; i++)
    assert.ok(r.STRICKLER[i].K < r.STRICKLER[i - 1].K, "table rangée du plus lisse au plus rugueux");
  assert.equal(r.kDe("litGalets"), 25);
  assert.equal(r.kDe("inconnu"), 20, "une rugosité inconnue doit retomber sur une valeur sûre");
});
