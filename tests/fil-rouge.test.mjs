// Le fil rouge. Deux choses à tenir, et une seule vaut la peine d'être testée
// automatiquement : que la chaîne soit CONTINUE — que l'entrée de chaque étape
// soit littéralement la sortie de la précédente — et que chaque nombre affiché
// se retrouve à partir des solveurs de base, sans passer par le module du fil
// rouge. Un cas d'école qui dérive est pire qu'un cas absent : il enseigne faux
// avec l'autorité d'une page publiée.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chaine, ETAPES } from "../src/solvers-fil-rouge.js";
import * as hyd from "../src/solvers-hydro.js";
import * as dim from "../src/solvers-dimensionnement.js";
import * as ann from "../src/solvers-annexes.js";
import * as riv from "../src/solvers-riviere.js";
import * as ouv from "../src/solvers-ouvrages.js";

const lire = (f) => JSON.parse(readFileSync(new URL(`../data/${f}.json`, import.meta.url)));
const CAS = lire("fil-rouge");
const TABLES = { montana: lire("stations-montana"), sogreah: lire("stations-sogreah") };
const c = chaine(CAS, TABLES);
const proche = (a, b, eps, msg) =>
  assert.ok(Math.abs(a - b) <= eps, `${msg} : ${a} contre ${b} (± ${eps})`);

test("les dix étapes sont numérotées dans l'ordre d'exécution", () => {
  assert.equal(ETAPES.length, 10);
  ETAPES.forEach((e, i) => assert.equal(e.n, i + 1, `numéro de ${e.id}`));
  assert.equal(new Set(ETAPES.map((e) => e.id)).size, 10, "identifiants distincts");
  // L'ordre n'est PAS celui des chapitres : c'est tout l'enseignement de la page.
  assert.deepEqual(ETAPES.map((e) => e.chapitre),
    ["ch1", "ch2", "ch5", "ch3", "ch4", "ch9", "ch7", "ch6", "ch8", "ch9"],
    "la période de retour passe avant l'averse, et l'oued avant l'ouvrage");
});

test("le cas d'école est cohérent avec lui-même", () => {
  const o = CAS.oued;
  assert.equal(o.sousSections[0].x0, o.points[0].x, "le premier lit part du premier point levé");
  assert.equal(o.sousSections[o.sousSections.length - 1].x1, o.points[o.points.length - 1].x,
    "le dernier lit finit au dernier point levé");
  for (let i = 1; i < o.sousSections.length; i++)
    assert.equal(o.sousSections[i].x0, o.sousSections[i - 1].x1, "les lits se touchent sans trou");
  // L'altitude minimale du bassin EST le lit au droit de l'ouvrage : c'est ce
  // qui rend le Δh de Ghorbel calculable sans donnée supplémentaire.
  const fond = Math.min(...o.points.map((p) => p.z));
  proche(CAS.bassin.altitudes.Hmin, fond, 0.01, "Hmin du bassin = fond de l'oued au franchissement");
  // Le lit s'écoule bien de l'amont vers l'aval.
  assert.ok(CAS.franchissement.zTnEntree > CAS.franchissement.zTnSortie, "sens d'écoulement");
  const planche = TABLES.sogreah.stations.find((x) => x.nom === CAS.pluie.stationSogreah);
  assert.ok(planche, "la station de planche existe");
  assert.ok(planche.P0 < planche.P10 && planche.P10 < planche.P100, "P0 < P10 < P100");
  assert.ok(TABLES.montana.stations.some((x) => x.nom === CAS.pluie.stationMontana),
    "la station de Montana existe");
});

test("étape 1 — la morphométrie se retrouve depuis solvers-hydro", () => {
  const { S, P } = CAS.bassin, A = CAS.bassin.altitudes;
  proche(c.morpho.Ic, hyd.gravelius(P, S), 1e-12, "Ic");
  assert.ok(c.morpho.Ic >= hyd.IC_MINIMUM, "Ic au-dessus du plancher géométrique");
  const rect = hyd.rectangleEquivalent(S, P);
  proche(c.morpho.rect.L, rect.L, 1e-12, "longueur du rectangle");
  proche(c.morpho.Ig, hyd.indiceGlobalPente(A.H5, A.H95, rect.L), 1e-12, "Ig");
  proche(c.morpho.dh, A.H50 - A.Hmin, 1e-12, "Δh de Ghorbel");
  proche(c.morpho.penteThalwegPct, ((A.Hmax - A.Hmin) / (CAS.bassin.L * 1000)) * 100, 1e-12, "pente du thalweg");
});

test("étape 2 — l'ajustement de Gumbel, et l'écart à la planche", () => {
  const g = hyd.ajustementGumbel(CAS.pluie.serie);
  proche(c.pluies.P10, hyd.quantileGumbel(g, 10), 1e-12, "P10");
  proche(c.pluies.P100, hyd.quantileGumbel(g, 100), 1e-12, "P100");
  assert.ok(c.pluies.P10 < c.pluies.P100, "la décennale sous la centennale");
  // L'écart affiché est bien un écart relatif à la planche, pas l'inverse.
  proche(c.pluies.ecartP10, c.pluies.P10 / c.pluies.planche.P10 - 1, 1e-12, "écart P10");
  // La station confirme la zone à mieux que 5 % sur la décennale : si ce
  // n'était plus vrai, le cas d'école aurait cessé d'être vraisemblable.
  assert.ok(Math.abs(c.pluies.ecartP10) < 0.05,
    `la série et la planche doivent rester proches sur P10 (${(100 * c.pluies.ecartP10).toFixed(1)} %)`);
});

test("étape 3 — la période de retour sort de la règle du chapitre 5", () => {
  proche(c.periode.T, hyd.periodeRetour({ categorie: CAS.route.categorie,
    ouvrage: CAS.route.ouvrage, S: CAS.bassin.S, tjma: CAS.route.tjma }), 0, "T");
  assert.equal(c.periode.impose, false, "sans option, T n'est pas imposée");
  proche(c.periode.risque30ans, hyd.risqueDepassement(c.periode.T, 30), 1e-12, "risque sur 30 ans");
  assert.ok(c.periode.risque30ans > 0.4,
    "une cinquantennale sur trente ans : le risque doit rester élevé, c'est le message");
});

test("étape 4 — le temps de concentration est la médiane des quatre formules", () => {
  const t = hyd.tempsConcentration({ S: CAS.bassin.S, L: CAS.bassin.L,
    D: c.morpho.denivelee, iPct: c.morpho.penteThalwegPct, Hmoy: c.morpho.hMoyRelative });
  const quatre = [t.kirpich, t.ventura, t.passini, t.giandotti].sort((a, b) => a - b);
  proche(c.averse.tc, (quatre[1] + quatre[2]) / 2, 1e-12, "tc médian");
  proche(c.averse.ecartExtremes, quatre[3] / quatre[0], 1e-12, "écart entre extrêmes");
  assert.ok(c.averse.ecartExtremes > 2, "les quatre formules doivent visiblement diverger");
  // L'intensité vient de Montana à la station nommée, au T de l'étape 3.
  const st = TABLES.montana.stations.find((x) => x.nom === CAS.pluie.stationMontana);
  proche(c.averse.intensite,
    hyd.montana(c.averse.a.a, st.b, st.c, hyd.dureeEffective(c.averse.tc), c.periode.T),
    1e-12, "intensité de Montana");
  // Et la plateforme reçoit la MÊME averse sur une fenêtre bien plus courte.
  assert.ok(c.averse.intensitePlateforme > 3 * c.averse.intensite,
    "l'intensité sur la plateforme doit être bien supérieure : c'est la courbe IDF");
});

test("étape 5 — les sept méthodes, leurs domaines et la valeur retenue", () => {
  const { S } = CAS.bassin, T = c.periode.T, Pan = CAS.pluie.Pan;
  for (const m of c.debits.table) {
    const motifs = hyd.motifsHorsDomaine(m.id, { S, Pan, T, zone: CAS.zones[m.id] });
    assert.deepEqual(m.motifs, motifs, `motifs de ${m.id}`);
    assert.equal(m.applicable, motifs.length === 0 && Number.isFinite(m.Q) && m.Q > 0,
      `applicabilité de ${m.id}`);
  }
  // Chaque valeur, recalculée sans passer par le module du fil rouge.
  const planche = c.pluies.planche;
  const parId = Object.fromEntries(c.debits.table.map((m) => [m.id, m.Q]));
  proche(parId.sogreah, hyd.sogreahDebit(S, hyd.sogreahPluie(T, planche.P10, planche.P100),
    planche.P0), 1e-12, "SOGREAH");
  proche(parId.ghorbel, hyd.ghorbelQmax123(S, Pan / 1000, c.morpho.dh, CAS.bassin.L, c.morpho.Ic)
    * hyd.GHORBEL_R[CAS.zones.ghorbel][T], 1e-12, "Ghorbel");
  proche(parId.frigui, hyd.frigui(CAS.zones.frigui, S, T), 1e-12, "Frigui");
  proche(parId.rationnelle, hyd.rationnelle(c.debits.C.C, c.averse.intensite, S), 1e-12, "rationnelle");
  // La rationnelle est calculée ET écartée : les deux à la fois.
  const rat = c.debits.table.find((m) => m.id === "rationnelle");
  assert.ok(rat.Q > 0 && !rat.applicable, "la rationnelle est chiffrée mais hors domaine");
  // La retenue est bien la médiane des seules applicables.
  const syn = hyd.synthese(c.debits.retenues.map((m) => m.Q));
  proche(c.debits.Q, syn.mediane, 1e-12, "débit retenu");
  proche(c.debits.Qexceptionnel, syn.max, 1e-12, "débit exceptionnel");
  assert.equal(c.debits.alerteCv, syn.cv > 50, "alerte de dispersion");
});

test("étape 6 — l'oued produit le TW, et rien d'autre ne le produit", () => {
  const sec = riv.sectionNaturelle(CAS.oued.points, CAS.oued.sousSections);
  proche(c.oued.zPlanEau, riv.tirantNormal(sec, c.debits.Q, CAS.oued.pente), 1e-9, "plan d'eau");
  proche(c.TW, c.oued.zPlanEau - c.calage.zRadierAval, 1e-12, "TW = plan d'eau − radier aval");
  assert.ok(c.oued.etat.froude < 1, "l'oued doit rester fluvial : c'est ce qui fait remonter l'aval");
  // Le levé doit dominer franchement la crue de projet, sinon le cas d'école
  // enseignerait à travailler au bord du vide.
  assert.ok(c.oued.capaciteDuLeve > 2 * c.debits.Q,
    `le levé (${c.oued.capaciteDuLeve.toFixed(0)} m³/s) doit dominer la crue de projet`);
});

test("étape 7 — la pente de l'ouvrage tombe du levé, elle n'est pas choisie", () => {
  const g = dim.precaler({ chaussee: CAS.route.chaussee, accotement: CAS.route.accotement,
    hauteurRemblai: CAS.route.hauteurRemblai, fruitTalus: CAS.route.fruitTalus,
    biaisDeg: CAS.route.biaisDeg, zTnEntree: CAS.franchissement.zTnEntree,
    zTnSortie: CAS.franchissement.zTnSortie, decaissement: CAS.franchissement.decaissement,
    hauteurOuvrage: CAS.franchissement.hauteurOuvrage });
  proche(c.calage.L, g.L, 1e-12, "longueur");
  proche(c.calage.J, g.J, 1e-12, "pente");
  assert.ok(c.calage.valide, "le précalage doit être valide");
  // J·L vaut la chute, par construction : c'est la définition du précalage.
  proche(c.calage.J * c.calage.L, c.calage.chute, 1e-12, "J·L = chute");
  // La couverture n'est pas la hauteur de remblai, et l'écart est celui du cours.
  proche(CAS.route.hauteurRemblai - c.calage.couvertureAmont,
    CAS.franchissement.hauteurOuvrage + CAS.franchissement.zTnEntree - c.calage.zTnAxe
      - CAS.franchissement.decaissement, 1e-9, "remblai − couverture");
  assert.ok(c.calage.couvertureAmont < CAS.route.hauteurRemblai,
    "la couverture est toujours inférieure à la hauteur de remblai");
});

test("étape 8 — la section retenue est celle que rend proposer()", () => {
  const s = dim.proposer({ forme: "dalot", Q: c.debits.Q, L: c.calage.L, J: c.calage.J,
    K: CAS.franchissement.K, entree: CAS.franchissement.entree, tw: c.TW, cellulesMax: 6,
    bornes: { Bmin: 2, Bmax: 5, Dmin: CAS.franchissement.hauteurOuvrage,
              Dmax: CAS.franchissement.hauteurOuvrage },
    limites: { vitesseMax: c.options.vitesseMax },
    zRadierAmont: c.calage.zRadierAmont, zRoute: c.calage.zPlateforme });
  assert.equal(c.ouvrage.libelle, s.retenue.libelle, "section retenue");
  proche(c.ouvrage.r.HW, s.retenue.r.HW, 1e-12, "charge amont");
  assert.equal(c.ouvrage.verdictRevanche, "conforme", "la revanche doit être conforme");
  // Le débit qui entre dans l'ouvrage EST celui de l'étape 5, cellule par cellule.
  proche(c.ouvrage.r.q * c.ouvrage.cellules, c.debits.Q, 1e-9, "Q réparti entre les cellules");
  proche(c.ouvrage.TW, c.TW, 1e-12, "le TW de l'étape 6 est celui du calcul");
  proche(c.ouvrage.zPhe, c.calage.zRadierAmont + c.ouvrage.r.HW, 1e-12, "cote de la PHE");
  proche(c.ouvrage.revanche, c.calage.zPlateforme - c.ouvrage.zPhe, 1e-9, "revanche");
  // Le régime vient de la comparaison de la pente précalée à la pente critique.
  assert.equal(c.ouvrage.r.regime, c.calage.J > c.ouvrage.r.penteCritique ? "torrentiel" : "fluvial");
  assert.equal(c.ouvrage.regimeDePente.regime, c.ouvrage.r.regime, "les deux lectures concordent");
});

test("étape 9 — la protection est calée sur la vitesse que l'étape 8 a produite", () => {
  proche(c.protection.V0, c.ouvrage.r.vitesse, 1e-12, "vitesse de sortie");
  proche(c.protection.d50, ann.isbash(c.ouvrage.r.vitesse), 1e-12, "d50 d'Isbash");
  // Isbash et sa réciproque doivent boucler : c'est le contrôle du chapitre 8.
  proche(ann.vitesseIsbash(c.protection.d50), c.protection.V0, 1e-9, "Isbash inversé");
  // La cible n'est pas une vitesse de catalogue : c'est celle de l'oued.
  proche(c.protection.Vcible, c.oued.etat.vitesse, 1e-12, "cible = vitesse de l'oued");
  proche(c.protection.longueur.L,
    ann.longueurProtection(c.ouvrage.largeurTotale, c.protection.V0, c.protection.Vcible).L,
    1e-12, "longueur de protection");
  assert.ok(c.protection.longueur.L < c.protection.longueurSiTalusNu.L,
    "viser la vitesse de l'oued doit coûter moins que viser un talus nu");
  // Le fossé reçoit l'intensité de la PLATEFORME, pas celle du bassin.
  proche(c.protection.plateforme.Q,
    ann.debitPlateforme({ i: c.averse.intensitePlateforme, largeur: CAS.route.plateforme.largeur,
      longueur: CAS.route.plateforme.longueur }).Q, 1e-12, "débit de plateforme");
});

test("étape 10 — les contrôles repassent par l'oued", () => {
  const sec = riv.sectionNaturelle(CAS.oued.points, CAS.oued.sousSections);
  assert.equal(c.controle.ressauts.length, 3, "le ressaut est cherché à trois débits");
  proche(c.controle.ressauts[0].q, c.debits.Q, 1e-12, "le premier est le débit de projet");
  for (const r of c.controle.ressauts) {
    proche(r.z, riv.tirantNormal(sec, r.q, CAS.oued.pente), 1e-9, `plan d'eau à ${r.q}`);
    proche(r.tw, r.z - c.calage.zRadierAval, 1e-12, `TW à ${r.q}`);
    assert.ok(["noyé", "en place", "rejeté", "aucun"].includes(r.position.position),
      "position nommée");
  }
  // Et le contrôle à la crue forte se fait au maximum des méthodes applicables.
  proche(c.controle.zExc, riv.tirantNormal(sec, c.debits.Qexceptionnel, CAS.oued.pente), 1e-9,
    "plan d'eau à la crue exceptionnelle");
  if (c.controle.partage.partage)
    proche(c.controle.partage.qOuvrage + c.controle.partage.qRoute, c.debits.Qexceptionnel,
      0.05, "le partage ouvrage / route boucle sur le débit total");
});

test("changer la période de retour déplace TOUTE la chaîne", () => {
  const cas = (T) => chaine(CAS, TABLES, { T });
  const c10 = cas(10), c50 = cas(50), c100 = cas(100);
  // Le débit croît avec la période — pour chaque méthode applicable.
  for (const id of ["sogreah", "ghorbel"]) {
    const q = (x) => x.debits.table.find((m) => m.id === id).Q;
    assert.ok(q(c10) < q(c50) && q(c50) < q(c100), `${id} doit croître avec T`);
  }
  // Frigui n'est calée ni à 20 ni à 100 ans : le domaine change AVEC la période.
  assert.ok(cas(50).debits.table.find((m) => m.id === "frigui").applicable, "Frigui à 50 ans");
  assert.ok(!cas(20).debits.table.find((m) => m.id === "frigui").applicable,
    "Frigui n'a pas de λ à 20 ans : la table décide, pas l'interpolation");
  assert.ok(!cas(100).debits.table.find((m) => m.id === "frigui").applicable, "ni à 100 ans");
  // Et la conséquence porte jusqu'au bout : plus de débit, plus de charge amont.
  assert.ok(c10.debits.Q < c50.debits.Q, "le débit retenu croît de 10 à 50 ans");
  assert.ok(c10.TW < c50.TW, "le niveau dans l'oued suit");
  // La charge amont, elle, n'est PAS monotone d'une chaîne à l'autre : à chaque
  // débit, le catalogue est réénuméré et la section change. Ce qui est monotone,
  // c'est la charge à SECTION FIXÉE — et c'est ce qu'il faut vérifier, sinon on
  // teste l'optimiseur au lieu de l'hydraulique.
  const meme = (T) => ouv.calculerOuvrage({ forme: "dalot", B: c50.ouvrage.B, D: c50.ouvrage.D,
    cellules: c50.ouvrage.cellules, Q: cas(T).debits.Q, L: c50.calage.L, J: c50.calage.J,
    K: CAS.franchissement.K, entree: CAS.franchissement.entree, tw: cas(T).TW });
  assert.ok(meme(10).HW < meme(50).HW && meme(50).HW < meme(100).HW,
    "à section fixée, la charge amont croît avec la période de retour");
  assert.notEqual(c10.ouvrage?.libelle, c50.ouvrage?.libelle,
    "une décennale et une cinquantennale ne donnent pas le même ouvrage");
});

test("la règle de retenue change l'ouvrage, pas seulement le débit", () => {
  const min = chaine(CAS, TABLES, { regle: "min" });
  const med = chaine(CAS, TABLES, { regle: "mediane" });
  const max = chaine(CAS, TABLES, { regle: "max" });
  assert.ok(min.debits.Q < med.debits.Q && med.debits.Q < max.debits.Q, "les trois règles s'ordonnent");
  assert.notEqual(min.ouvrage?.libelle, max.ouvrage?.libelle,
    "retenir la plus faible ou la plus forte ne donne pas le même ouvrage");
});

test("relever le plafond de vitesse est ce qui rend l'ouvrage possible", () => {
  // C'est la décision assumée de la page : à 3 m/s le catalogue est vide.
  assert.equal(chaine(CAS, TABLES, { vitesseMax: 3.0 }).ouvrage, null,
    "à 3 m/s, aucun candidat : la page doit le dire plutôt que d'en inventer un");
  assert.ok(chaine(CAS, TABLES, { vitesseMax: 4.0 }).ouvrage, "à 4 m/s, une section passe");
});

test("aucun résultat n'est écrit en dur dans la page", () => {
  // Le mode de panne visé : un chiffre recopié dans la prose, qui cesse de
  // suivre le calcul dès qu'un solveur bouge. On cherche les valeurs clés,
  // formatées comme la page les afficherait.
  const src = readFileSync(new URL("../src/cours-fil-rouge.js", import.meta.url), "utf-8");
  const fr = (x, d) => x.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const interdits = [
    fr(c.debits.Q, 1), fr(c.TW, 2), fr(c.ouvrage.r.HW, 2), fr(c.calage.L, 2),
    fr(100 * c.calage.J, 3), fr(100 * c.protection.d50, 0), c.ouvrage.libelle,
  ];
  for (const v of interdits)
    assert.ok(!src.includes(v), `« ${v} » est écrit en dur dans cours-fil-rouge.js`);
});
