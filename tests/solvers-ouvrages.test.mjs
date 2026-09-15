// Contrôles du moteur hydraulique. Les vérifications sont autant que possible
// des propriétés physiques (Froude = 1 à la profondeur critique, Manning au
// tirant normal) plutôt que des valeurs recopiées.
import test from "node:test";
import assert from "node:assert/strict";
import * as o from "../src/solvers-ouvrages.js";

const proche = (a, b, tol, msg) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg} : ${a.toFixed(5)} vs ${b} (± ${tol})`);

test("géométrie de la section circulaire", () => {
  const s = o.sectionCirculaire(1.2);
  proche(s.airePleine, (Math.PI * 1.44) / 4, 1e-9, "aire pleine");
  proche(s.aire(1.2), s.airePleine, 1e-6, "aire à section pleine");
  proche(s.aire(0.6), s.airePleine / 2, 1e-6, "aire à mi-hauteur");
  proche(s.largeurAuMiroir(0.6), 1.2, 1e-6, "largeur au miroir à mi-hauteur");
  proche(s.rayonPlein, 0.3, 1e-9, "rayon hydraulique plein = D/4");
});

test("profondeur critique — Froude vaut 1", () => {
  for (const [sec, q] of [[o.sectionRectangulaire(2, 1.5), 4],
                          [o.sectionCirculaire(1.2), 1.2]]) {
    const yc = sec.profondeurCritique(q);
    assert.ok(yc > 0 && yc < sec.hauteur, "profondeur critique dans la section");
    const Fr = (q * q * sec.largeurAuMiroir(yc)) / (o.G * Math.pow(sec.aire(yc), 3));
    proche(Fr, 1, 1e-4, `Froude à yc (${sec.forme})`);
  }
  // formule analytique du rectangle
  proche(o.sectionRectangulaire(2, 3).profondeurCritique(4),
         Math.cbrt((4 * 4) / (o.G * 2 * 2)), 1e-6, "yc rectangulaire = (q²/g b²)^⅓");
});

test("tirant normal — Manning-Strickler est vérifié", () => {
  const sec = o.sectionRectangulaire(2, 1.5);
  const yn = o.profondeurNormale(sec, 4, 70, 0.01);
  assert.ok(yn > 0 && yn < 1.5, "tirant dans la section");
  proche(o.debitance(sec, yn, 70, 0.01), 4, 1e-4, "débit au tirant normal");
  // capacité dépassée : le tirant sature à la hauteur
  assert.equal(o.profondeurNormale(sec, 500, 70, 0.01), 1.5, "capacité dépassée");
});

test("contrôle à l'entrée — régimes et continuité de la transition", () => {
  const sec = o.sectionRectangulaire(2, 1.5);
  const e = o.entreePar("box-ailes-evasees");
  const bas = o.controleEntree(sec, e, 1.0, 0.01, 0.8);
  const haut = o.controleEntree(sec, e, 12, 0.01, 1.6);
  assert.equal(bas.regime, "dénoyée");
  assert.equal(haut.regime, "noyée");
  // aux deux bornes, le régime bascule sans saut de formule appliquée
  const qAt = (X) => (X * sec.airePleine * Math.sqrt(sec.hauteur)) / 1.811;
  const b1 = o.controleEntree(sec, e, qAt(o.X_DENOYEE), 0.01, 1.0);
  proche(b1.ratio, b1.ratioDenoyee, 1e-9, "à X = 1,93 on applique la forme dénoyée");
  const b2 = o.controleEntree(sec, e, qAt(o.X_NOYEE), 0.01, 1.0);
  proche(b2.ratio, b2.ratioNoyee, 1e-9, "à X = 2,21 on applique la forme noyée");
  // dans la transition, le ratio est encadré par les deux formes
  const mid = o.controleEntree(sec, e, qAt(2.07), 0.01, 1.0);
  assert.equal(mid.regime, "transition");
  assert.ok(mid.ratio >= Math.min(mid.ratioDenoyee, mid.ratioNoyee) &&
            mid.ratio <= Math.max(mid.ratioDenoyee, mid.ratioNoyee), "interpolation encadrée");
});

test("correction de pente : +0,70 pour l'entrée métallique coupée au talus", () => {
  const sec = o.sectionCirculaire(1.2);
  const talus = o.entreePar("buse-metal-talus");
  const saillie = o.entreePar("buse-metal-saillie");
  assert.equal(talus.Kpente, 0.70);
  assert.equal(saillie.Kpente, -0.50);
  // une pente plus forte ABAISSE la charge partout sauf pour cette entrée
  const r1 = o.controleEntree(sec, saillie, 2, 0.01, 1.0).ratioNoyee;
  const r2 = o.controleEntree(sec, saillie, 2, 0.05, 1.0).ratioNoyee;
  assert.ok(r2 < r1, "Kpente négatif : la pente abaisse HW/D");
  const t1 = o.controleEntree(sec, talus, 2, 0.01, 1.0).ratioNoyee;
  const t2 = o.controleEntree(sec, talus, 2, 0.05, 1.0).ratioNoyee;
  assert.ok(t2 > t1, "Kpente positif : la pente relève HW/D");
});

test("état de la sortie — déduit de la profondeur aval, jamais choisi", () => {
  assert.equal(o.etatSortie(0, 1.5), "libre");
  assert.equal(o.etatSortie(0.4, 1.5), "partiellement noyée");
  assert.equal(o.etatSortie(1.5, 1.5), "noyée");
  assert.equal(o.etatSortie(2.0, 1.5), "noyée");
  // « libre » n'est jamais annoncé dès qu'il y a de l'eau au radier aval
  assert.equal(o.etatSortie(0.01, 1.5), "partiellement noyée");
});

test("contrôle à la sortie — énergie en pleine section et approximation FHWA", () => {
  const sec = o.sectionRectangulaire(2, 1.5);
  const noyee = o.controleSortie(sec, 4, 70, 12, 0.01, 1.8, 1.0, 0.4);
  assert.equal(noyee.methode, "énergie en pleine section");
  proche(noyee.HW, 1.8 + noyee.pertes - 0.01 * 12, 1e-9, "HW = TW + pertes − J·L");
  const libre = o.controleSortie(sec, 4, 70, 12, 0.01, 0, 1.0, 0.4);
  assert.equal(libre.methode, "approximation FHWA");
  proche(libre.h0, (1.0 + 1.5) / 2, 1e-9, "h0 = (yc + D)/2 en sortie libre");
  // pertes : entrée, frottement, sortie
  proche(libre.pertes, libre.perteEntree + libre.perteFrottement + libre.perteSortie, 1e-12, "somme des pertes");
});

test("chaîne complète — HW est le maximum des deux contrôles", () => {
  const base = { forme: "dalot", B: 2, D: 1.5, Q: 8, L: 12, J: 0.01, K: 70,
                 entree: "box-ailes-evasees", tw: 0 };
  const r = o.calculerOuvrage(base);
  proche(r.HW, Math.max(r.entreeC.HW, r.sortieC.HW), 1e-12, "HW = max");
  assert.equal(r.controle, r.entreeC.HW >= r.sortieC.HW ? "entrée" : "sortie");
  // relever l'aval fait passer le contrôle à la sortie
  const noye = o.calculerOuvrage({ ...base, tw: 2.5 });
  assert.equal(noye.etatSortie, "noyée");
  assert.equal(noye.controle, "sortie", "un aval haut commande l'ouvrage");
  assert.ok(noye.HW > r.HW, "et relève le niveau amont");
});

test("chaîne complète — refus explicites", () => {
  assert.match(o.calculerOuvrage({ Q: 8, entree: null }).erreur, /Entrée non choisie/);
  assert.match(o.calculerOuvrage({ forme: "dalot", Q: 8, entree: "buse-arete-vive" }).erreur,
    /ne décrit pas un dalot/);
  assert.match(o.calculerOuvrage({ forme: "dalot", B: 2, D: 1.5, Q: 0,
    entree: "box-ailes-evasees" }).erreur, /Données incomplètes/);
});

test("influence de l'aval : distincte de l'état de la sortie", () => {
  const base = { forme: "dalot", B: 2, D: 1.5, Q: 4, L: 12, J: 0.01, K: 70,
                 entree: "box-ailes-evasees" };
  const yc = o.sectionRectangulaire(2, 1.5).profondeurCritique(4);
  const bas = o.calculerOuvrage({ ...base, tw: yc * 0.5 });
  assert.equal(bas.etatSortie, "partiellement noyée", "il y a de l'eau à la sortie");
  assert.equal(bas.avalInfluence, false, "mais elle ne commande pas la ligne d'eau");
  const haut = o.calculerOuvrage({ ...base, tw: yc * 1.2 });
  assert.equal(haut.avalInfluence, true, "au-delà de yc, l'aval commande");
});
