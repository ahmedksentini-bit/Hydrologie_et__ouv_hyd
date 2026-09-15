// Contrôles du moteur de dimensionnement. On vérifie autant que possible des
// PROPRIÉTÉS (tout admissible tient réellement les critères, la pente de calage
// n'est jamais sous Ic, le bilan du partage boucle) plutôt que des valeurs
// recopiées depuis une exécution précédente.
import test from "node:test";
import assert from "node:assert/strict";
import * as d from "../src/solvers-dimensionnement.js";
import { calculerOuvrage } from "../src/solvers-ouvrages.js";

const proche = (a, b, tol, msg) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg} : ${a} vs ${b} (± ${tol})`);

test("pente de calage — plafond, jamais arrondi", () => {
  proche(d.penteDeCalage(0.519), 0.6, 1e-9, "0,519 % relevé à 0,6 %");
  proche(d.penteDeCalage(0.5), 0.5, 1e-9, "un multiple exact reste en place");
  proche(d.penteDeCalage(0.7), 0.7, 1e-9, "0,700 % reste 0,700 %");
  proche(d.penteDeCalage(0.3779), 0.4, 1e-9, "0,3779 % relevé à 0,4 %");
  assert.equal(d.penteDeCalage(0), 0, "pas de pente critique, pas de calage");
  // propriété : le résultat n'est jamais sous Ic, et jamais plus d'un pas au-dessus
  for (let ic = 0.01; ic < 3; ic += 0.007) {
    const J = d.penteDeCalage(ic);
    assert.ok(J >= ic - 1e-9, `calage sous Ic pour ${ic}`);
    assert.ok(J < ic + d.PAS_PENTE, `calage à plus d'un pas au-dessus pour ${ic}`);
  }
});

test("catalogue — la règle de forme filtre, et tout ce qui sort la respecte", () => {
  const cat = d.catalogue("dalot", { Bmin: 1, Bmax: 4, Dmin: 1, Dmax: 3 });
  assert.equal(cat.length, 12, "12 géométries admissibles sur 20 couples");
  for (const { B, D } of cat) {
    assert.ok(D <= B + 1e-9, `hauteur ${D} au-dessus de la largeur ${B}`);
    assert.ok(B <= D + 2 + 1e-9, `largeur ${B} à plus de 2 m au-dessus de ${D}`);
  }
  assert.equal(d.formeDalotAdmissible(4, 1.5), false, "4 × 1,5 écarté");
  assert.equal(d.formeDalotAdmissible(1, 1.5), false, "plus haut que large écarté");
  const buses = d.catalogue("buse", { Dmin: 1, Dmax: 3 });
  assert.deepEqual(buses.map((x) => x.D), [1.0, 1.2, 1.5, 1.8, 2.0, 2.5, 3.0]);
});

test("critères durs — chacun élimine seul", () => {
  const ok = { capaciteDepassee: false, remplissage: 0.5, vitesse: 2.5, HWsurD: 0.8 };
  assert.deepEqual(d.motifsDeRejet(ok), [], "candidat conforme : aucun motif");
  assert.equal(d.motifsDeRejet({ ...ok, vitesse: 3.01 }).length, 1, "la vitesse seule élimine");
  assert.equal(d.motifsDeRejet({ ...ok, remplissage: 0.76 }).length, 1, "le remplissage seul élimine");
  assert.equal(d.motifsDeRejet({ ...ok, HWsurD: 1.21 }).length, 1, "la charge amont seule élimine");
  assert.equal(d.motifsDeRejet({ ...ok, capaciteDepassee: true }).length, 1, "la capacité seule élimine");
  assert.equal(d.motifsDeRejet(ok, d.LIMITES, 0.2).length, 1, "une revanche insuffisante élimine");
  assert.deepEqual(d.motifsDeRejet(ok, d.LIMITES, 0.9), [], "une revanche conforme n'élimine pas");
  // une revanche absente n'est PAS un motif de rejet — mais n'est pas une conformité
  assert.deepEqual(d.motifsDeRejet(ok, d.LIMITES, NaN), [], "revanche inconnue : pas de rejet");
  assert.equal(d.verdictRevanche(NaN), "non vérifiable");
});

test("recherche — tout candidat retenu tient réellement les critères", () => {
  const s = d.proposer({ forme: "dalot", Q: 12, L: 14, J: 0.005, K: 70,
                         entree: "box-ailes-evasees", tw: 0, cellulesMax: 4 });
  assert.equal(s.examines, 48, "12 géométries × 4 cellules");
  assert.ok(s.admissibles.length > 0 && s.admissibles.length < s.examines);
  for (const c of s.admissibles) {
    // recalcul indépendant depuis le moteur du chapitre 6
    const r = calculerOuvrage({ forme: "dalot", B: c.B, D: c.D, cellules: c.cellules,
      Q: 12, L: 14, J: c.J, K: 70, entree: "box-ailes-evasees", tw: 0 });
    proche(r.HW, c.r.HW, 1e-9, `${c.libelle} : HW de la recherche ≠ moteur`);
    assert.ok(!r.capaciteDepassee, `${c.libelle} : capacité`);
    assert.ok(r.remplissage * 100 <= 75 + 1e-9, `${c.libelle} : remplissage`);
    assert.ok(r.vitesse <= 3 + 1e-9, `${c.libelle} : vitesse`);
    assert.ok(r.HWsurD <= 1.2 + 1e-9, `${c.libelle} : HW/D`);
  }
  // le classement est bien décroissant
  for (let i = 1; i < s.admissibles.length; i++)
    assert.ok(s.admissibles[i - 1].score >= s.admissibles[i].score, "classement décroissant");
  assert.equal(s.retenue, s.admissibles[0], "la retenue est la tête du classement");
});

test("pente libre — chaque candidat est calé au-dessus de SA pente critique", () => {
  const s = d.proposer({ forme: "dalot", Q: 12, L: 14, J: 0, K: 70,
                         entree: "box-ailes-evasees", tw: 0, cellulesMax: 4 });
  for (const c of s.admissibles) {
    assert.ok(c.J * 100 >= c.r.penteCritique * 100 - 1e-9,
      `${c.libelle} : calé sous Ic (${(c.J * 100).toFixed(3)} % < ${(c.r.penteCritique * 100).toFixed(3)} %)`);
    proche(c.J * 100, d.penteDeCalage(c.r.penteCritique * 100), 1e-9, `${c.libelle} : pas de projet`);
  }
  // à 1 % la vitesse élimine beaucoup plus qu'à 0,5 % : c'est elle le levier
  const compte = (J) => d.proposer({ forme: "dalot", Q: 12, L: 14, J, K: 70,
    entree: "box-ailes-evasees", tw: 0, cellulesMax: 4 })
    .candidats.filter((c) => c.motifs.some((m) => m.startsWith("vitesse"))).length;
  assert.ok(compte(0.01) > 2 * compte(0.005), "la vitesse est le critère sensible à la pente");
});

test("chaîne des cotes — aller-retour cohérent", () => {
  const zAm = 100, J = 0.004, L = 14, HW = 1.22;
  proche(d.coteRadierAval(zAm, J, L), 99.944, 1e-9, "radier aval");
  proche(d.cotePheAmont(zAm, HW), 101.22, 1e-9, "plan d'eau amont");
  proche(d.revanche(102, d.cotePheAmont(zAm, HW)), 0.78, 1e-9, "revanche");
  // TW ne devient jamais négatif : une cote d'eau sous le radier donne une sortie libre
  proche(d.profondeurAval(99.5, 99.944), 0, 1e-12, "plan d'eau sous le radier aval");
  proche(d.profondeurAval(100.5, 99.944), 0.556, 1e-9, "profondeur aval");
  assert.equal(d.verdictRevanche(0.78), "conforme");
  assert.equal(d.verdictRevanche(0.333), "insuffisante");
  assert.equal(d.verdictRevanche(-0.162), "surverse de la route");
  assert.equal(d.verdictRevanche(0.5), "conforme", "le seuil lui-même est conforme");
});

test("surverse — le bilan des débits boucle et la formule se retrouve", () => {
  proche(d.debitDeversoir(1.70, 1.0, 30, 0.177), 1.70 * 30 * Math.pow(0.177, 1.5), 1e-12, "déversoir");
  assert.equal(d.debitDeversoir(1.70, 1.0, 30, -0.1), 0, "pas de crête atteinte, pas de débit");

  const ouv = { forme: "dalot", B: 3, D: 1.5, cellules: 2, L: 14, J: 0.004, K: 70,
                entree: "box-ailes-evasees", tw: 0 };
  const p = d.partageDebit({ ...ouv, Q: 22 }, { zRadierAmont: 100, zRoute: 101.5, Lr: 30 });
  assert.ok(p.partage, "la route déverse à 22 m³/s");
  proche(p.qOuvrage + p.qRoute, 22, 1e-3, "bilan des débits");
  // le débit déversé se retrouve depuis la cote résolue, sans passer par le solveur
  proche(p.qRoute, d.debitDeversoir(1.70, 1.0, 30, p.zEau - 101.5), 5e-3, "déversoir à la cote résolue");
  // et la cote résolue est bien SOUS celle qu'on obtiendrait sans partager
  const sansPartage = d.cotePheAmont(100, calculerOuvrage({ ...ouv, Q: 22 }).HW);
  assert.ok(p.zEau < sansPartage - 0.1, "ignorer le partage surestime la cote amont");

  // sous la crête, aucun partage
  const bas = d.partageDebit({ ...ouv, Q: 12 }, { zRadierAmont: 100, zRoute: 101.5, Lr: 30 });
  assert.equal(bas.partage, false, "pas de surverse au débit de projet");
  assert.equal(bas.qRoute, 0);
});

test("§6 de la note DGPC N°1054/2019", () => {
  const basse = d.reglesDgpcSix(1.0, 34);
  assert.ok(basse.some((r) => r.regle === "hauteur minimale" && r.verdict === "non conforme"),
    "1,00 m écarté par la hauteur minimale");
  const haute = d.reglesDgpcSix(1.5, 45);
  assert.ok(!haute.some((r) => r.verdict === "non conforme"), "1,50 m conforme");
  assert.ok(haute.some((r) => r.texte.includes("15 cm")), "hauteur morte de 10 % × H");
  assert.ok(d.reglesDgpcSix(2.0, 85).some((r) => r.regle === "PHE ≤ 80 % de H"),
    "remplissage de 85 % signalé");
  assert.ok(!d.reglesDgpcSix(2.0, 70).some((r) => r.regle === "PHE ≤ 80 % de H"),
    "remplissage de 70 % non signalé");
});
