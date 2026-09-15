// Le fil rouge : un seul ouvrage, calculé d'un bout à l'autre du cours.
//
// Ce module ne contient AUCUNE formule. Il enchaîne les solveurs des neuf
// chapitres, dans l'ordre où le projet les demande, et rend toutes les valeurs
// intermédiaires. C'est la seule façon d'empêcher un cas d'école de dériver :
// si un chiffre du chapitre 4 change, celui du chapitre 7 change avec lui, ou
// bien un test tombe.
//
// L'ordre n'est pas celui des chapitres, et c'est le premier enseignement :
//   1 → 2 → 5 → 3 → 4     ce que le bassin produit — la période de retour d'abord,
//                         puisque c'est elle qui commande l'averse et les débits
//   9 a                   ce que l'oued impose  (le TW que le chapitre 6 réclame)
//   7 (précalage) → 6 → 7 l'ouvrage, calé puis dimensionné
//   8                     ce qu'on pose autour
//   9 b                   le contrôle : ressaut, et crue exceptionnelle
import * as hyd from "./solvers-hydro.js";
import * as ouv from "./solvers-ouvrages.js";
import * as dim from "./solvers-dimensionnement.js";
import * as ann from "./solvers-annexes.js";
import * as riv from "./solvers-riviere.js";

/** Les neuf étapes, leur titre et le chapitre dont elles sortent. */
export const ETAPES = [
  { id: "morpho", n: 1, chapitre: "ch1", titre: "Le bassin, mesuré",
    sort: "S, P, L, Ic, Ig — la morphométrie qui nourrit toutes les régionalisations" },
  { id: "pluies", n: 2, chapitre: "ch2", titre: "La pluie, ajustée",
    sort: "P₁₀ et P₁₀₀ de la station, confrontés à la planche SOGREAH" },
  { id: "periode", n: 3, chapitre: "ch5", titre: "La période de retour",
    sort: "T, qui décide en amont de tout le reste" },
  { id: "averse", n: 4, chapitre: "ch3", titre: "L'averse de projet",
    sort: "le temps de concentration, et l'intensité de Montana qu'il commande" },
  { id: "debits", n: 5, chapitre: "ch4", titre: "Les débits, et ce qu'on en retient",
    sort: "sept méthodes, trois applicables, un débit de projet" },
  { id: "oued", n: 6, chapitre: "ch9", titre: "L'oued, et le niveau qu'il impose",
    sort: "la cote du plan d'eau naturel, donc le TW" },
  { id: "calage", n: 7, chapitre: "ch7", titre: "Le précalage",
    sort: "la longueur et la pente de l'ouvrage, déduites du levé" },
  { id: "ouvrage", n: 8, chapitre: "ch6", titre: "L'ouvrage, dimensionné",
    sort: "la section retenue, sa charge amont et sa revanche" },
  { id: "protection", n: 9, chapitre: "ch8", titre: "Ce qu'on pose autour",
    sort: "l'enrochement de sortie et le fossé de plateforme" },
  { id: "controle", n: 10, chapitre: "ch9", titre: "Les contrôles",
    sort: "le ressaut à la sortie, et ce qui se passe à la crue exceptionnelle" },
];

/** Les méthodes de débit, dans l'ordre du chapitre 4. */
const METHODES = ["rationnelle", "sogreah", "ghorbel", "kallel", "fersi", "frigui", "francou"];

/** Coefficient a de Montana à la période T, interpolé comme au chapitre 3. */
function aMontana(station, T) {
  const Ts = Object.keys(station.aT).map(Number).sort((x, y) => x - y);
  if (T <= Ts[0]) return { a: station.aT[Ts[0]], exact: T === Ts[0], borne: T < Ts[0] };
  const dernier = Ts[Ts.length - 1];
  if (T >= dernier) return { a: station.aT[dernier], exact: T === dernier, borne: T > dernier };
  for (let i = 1; i < Ts.length; i++) {
    const [T0, T1] = [Ts[i - 1], Ts[i]];
    if (T >= T0 && T <= T1) {
      if (T === T0) return { a: station.aT[T0], exact: true, borne: false };
      const u = (T - T0) / (T1 - T0);
      return { a: station.aT[T0] + u * (station.aT[T1] - station.aT[T0]), exact: false, borne: false };
    }
  }
  return { a: station.aT[dernier], exact: false, borne: true };
}

const mediane = (v) => {
  const x = [...v].sort((a, b) => a - b);
  return x.length % 2 ? x[(x.length - 1) / 2] : (x[x.length / 2 - 1] + x[x.length / 2]) / 2;
};

/**
 * La chaîne complète.
 * `tables` porte les deux jeux de référence du cours : les stations de Montana
 * et les lectures de planches SOGREAH. `options` n'ouvre que trois vannes —
 * la période de retour, la règle de retenue, et la vitesse au-delà de laquelle
 * on refuse un candidat.
 */
export function chaine(cas, tables, options = {}) {
  const regle = options.regle ?? "mediane";
  const vitesseMax = options.vitesseMax ?? 4.0;

  // ── 1. Morphométrie ──────────────────────────────────────────────────────
  const { S, P, L } = cas.bassin;
  const A = cas.bassin.altitudes;
  const Ic = hyd.gravelius(P, S);
  const rect = hyd.rectangleEquivalent(S, P);
  const Ig = hyd.indiceGlobalPente(A.H5, A.H95, rect.L);
  const morpho = {
    S, P, L, Ic, rect, Ig,
    icPlancher: Ic >= hyd.IC_MINIMUM,
    densiteDrainage: hyd.densiteDrainage(cas.bassin.longueurReseau, S),
    denivelee: A.Hmax - A.Hmin,
    penteThalwegPct: ((A.Hmax - A.Hmin) / (L * 1000)) * 100,
    dh: A.H50 - A.Hmin,               // Δh de Ghorbel : médiane − franchissement
    hMoyRelative: A.Hmoy - A.Hmin,    // ce que demande Giandotti
    altitudes: A,
  };

  // ── 2. Pluies ────────────────────────────────────────────────────────────
  const gum = hyd.ajustementGumbel(cas.pluie.serie);
  const planche = tables.sogreah.stations.find((x) => x.nom === cas.pluie.stationSogreah);
  const pluies = {
    station: cas.pluie.station, serie: cas.pluie.serie, ajustement: gum,
    P10: hyd.quantileGumbel(gum, 10), P100: hyd.quantileGumbel(gum, 100),
    planche,
    // La planche est une valeur de ZONE, la série une valeur de POSTE : on
    // regarde l'écart plutôt que de choisir au hasard.
    ecartP10: planche?.P10 ? hyd.quantileGumbel(gum, 10) / planche.P10 - 1 : null,
    ecartP100: planche?.P100 ? hyd.quantileGumbel(gum, 100) / planche.P100 - 1 : null,
    retourDuMax: hyd.periodeRetourDe(gum, Math.max(...cas.pluie.serie)),
    abattement: hyd.coefficientAbattement(cas.pluie.Pan, S),
  };

  // ── 5. Période de retour (elle commande le chapitre 4, donc elle passe avant)
  const Tauto = hyd.periodeRetour({ categorie: cas.route.categorie, ouvrage: cas.route.ouvrage,
                                    S, tjma: cas.route.tjma });
  const T = options.T ?? Tauto;
  const periode = {
    T, Tauto, impose: options.T != null && options.T !== Tauto,
    risque10ans: hyd.risqueDepassement(T, 10),
    risque30ans: hyd.risqueDepassement(T, 30),
    categorie: cas.route.categorie, tjma: cas.route.tjma,
  };

  // ── 3. Averse de projet ──────────────────────────────────────────────────
  const tcs = hyd.tempsConcentration({ S, L, D: morpho.denivelee,
    iPct: morpho.penteThalwegPct, Hmoy: morpho.hMoyRelative });
  const quatre = [tcs.kirpich, tcs.ventura, tcs.passini, tcs.giandotti];
  const tc = mediane(quatre);
  const stationM = tables.montana.stations.find((x) => x.nom === cas.pluie.stationMontana);
  const aT = aMontana(stationM, T);
  const tEff = hyd.dureeEffective(tc);
  const averse = {
    formules: tcs, tc, ecartExtremes: Math.max(...quatre) / Math.min(...quatre),
    tEff, station: stationM, a: aT,
    intensite: hyd.montana(aT.a, stationM.b, stationM.c, tEff, T),
    // À quoi ressemblerait l'intensité si l'on prenait le tc le plus court :
    intensiteTcCourt: hyd.montana(aT.a, stationM.b, stationM.c,
      hyd.dureeEffective(Math.min(...quatre)), T),
    // La plateforme n'a pas le temps de concentration du bassin : quelques
    // minutes contre deux heures. Même averse, même station, même période —
    // et une intensité plusieurs fois plus forte, parce que la durée change.
    dureePlateforme: hyd.dureeEffective(0.1),
    intensitePlateforme: hyd.montana(aT.a, stationM.b, stationM.c, hyd.dureeEffective(0.1), T),
  };

  // ── 4. Débits ────────────────────────────────────────────────────────────
  const C = hyd.coefficientRuissellement(morpho.penteThalwegPct, cas.bassin.couvertureVegetale);
  const PT = hyd.sogreahPluie(T, planche.P10, planche.P100);
  const qGhorbelBase = hyd.ghorbelQmax123(S, cas.pluie.Pan / 1000, morpho.dh, L, Ic);
  const He = hyd.fersiEcoulement(cas.pluie.Pan, Ig);
  const valeurs = {
    rationnelle: hyd.rationnelle(C.C, averse.intensite, S),
    sogreah: hyd.sogreahDebit(S, PT, planche.P0),
    ghorbel: qGhorbelBase * (hyd.GHORBEL_R[cas.zones.ghorbel]?.[T] ?? NaN),
    kallel: cas.zones.kallel ? hyd.kallel(cas.zones.kallel, S, T) : NaN,
    fersi: cas.zones.fersi
      ? hyd.fersiQx(hyd.fersiQxMoyen(He, S), S, Ig, hyd.FERSI_Y[cas.zones.fersi]?.[T]) : NaN,
    frigui: cas.zones.frigui ? hyd.frigui(cas.zones.frigui, S, T) : NaN,
    francou: NaN,
  };
  const table = METHODES.map((id) => {
    const motifs = hyd.motifsHorsDomaine(id, { S, Pan: cas.pluie.Pan, T, zone: cas.zones[id] });
    const Q = valeurs[id];
    return { id, nom: hyd.DOMAINES[id].nom, Q: Number.isFinite(Q) ? Q : null,
             motifs, applicable: motifs.length === 0 && Number.isFinite(Q) && Q > 0 };
  });
  const retenues = table.filter((m) => m.applicable);
  const syn = hyd.synthese(retenues.map((m) => m.Q));
  const Qretenu = regle === "min" ? syn.min : regle === "max" ? syn.max : syn.mediane;
  const porteuse = retenues.find((m) => Math.abs(m.Q - Qretenu) < 1e-9) ?? null;
  const debits = {
    C, PT, seuil: hyd.sogreahRuisselle(PT, planche.P0), qGhorbelBase, He,
    table, retenues, synthese: syn, regle, Q: Qretenu, porteuse,
    alerteCv: syn.cv > 50,
    // La plus haute des méthodes applicables : c'est elle qu'on ira éprouver
    // sur l'ouvrage, au titre de la crue exceptionnelle.
    Qexceptionnel: syn.max,
    specifique: Qretenu / S,
  };

  // ── 6 (ch9 a). L'oued : la cote du plan d'eau, donc le TW ────────────────
  const section = riv.sectionNaturelle(cas.oued.points, cas.oued.sousSections);
  const Joued = cas.oued.pente;
  const zPlanEau = riv.tirantNormal(section, Qretenu, Joued);
  const etatOued = zPlanEau === null ? null : riv.debitA(section, zPlanEau, Joued);
  const oued = {
    section, pente: Joued, zPlanEau, etat: etatOued,
    capaciteDuLeve: riv.debitA(section, section.zMax, Joued).Q,
    zCritique: riv.coteCritique(section, Qretenu),
    deborde: zPlanEau !== null && zPlanEau > Math.min(cas.oued.berges.gauche, cas.oued.berges.droite),
    horsLeve: zPlanEau === null,
  };

  // ── 7 a. Précalage ───────────────────────────────────────────────────────
  const f = cas.franchissement;
  const calage = dim.precaler({
    chaussee: cas.route.chaussee, accotement: cas.route.accotement,
    hauteurRemblai: cas.route.hauteurRemblai, fruitTalus: cas.route.fruitTalus,
    biaisDeg: cas.route.biaisDeg, zTnEntree: f.zTnEntree, zTnSortie: f.zTnSortie,
    decaissement: f.decaissement, hauteurOuvrage: f.hauteurOuvrage,
  });
  const TW = zPlanEau === null ? null : Math.max(0, zPlanEau - calage.zRadierAval);

  // ── 8 (ch6 + ch7 b). L'ouvrage ───────────────────────────────────────────
  const choix = TW === null ? null : dim.proposer({
    forme: "dalot", Q: Qretenu, L: calage.L, J: calage.J, K: f.K, entree: f.entree, tw: TW,
    cellulesMax: 6, bornes: { Bmin: 2, Bmax: 5, Dmin: f.hauteurOuvrage, Dmax: f.hauteurOuvrage },
    limites: { vitesseMax }, zRadierAmont: calage.zRadierAmont, zRoute: calage.zPlateforme,
  });
  const ret = choix?.retenue ?? null;
  const ouvrage = ret && {
    ...ret, TW,
    zPhe: dim.cotePheAmont(calage.zRadierAmont, ret.r.HW),
    verdictRevanche: dim.verdictRevanche(ret.revanche),
    dgpc: dim.reglesDgpcSix(ret.D, 100 * ret.r.remplissage),
    regimeDePente: dim.regimeDePente(calage.J, ret.r.penteCritique),
    largeurTotale: ret.cellules * ret.B,
    // Refus par la seule vitesse : à dire, puisque c'est la limite qu'on a déplacée.
    refusesParLaVitesse: choix.candidats.filter((c) =>
      c.motifs.length === 1 && c.motifs[0].startsWith("vitesse")).length,
    examines: choix.examines, admissibles: choix.admissibles.length,
    tousLesCandidats: choix.candidats,
  };

  // ── 9 (ch8). Protection et assainissement ────────────────────────────────
  const protection = ouvrage && (() => {
    const V0 = ouvrage.r.vitesse;
    const d50 = ann.isbash(V0);
    // La cible n'est pas une vitesse de catalogue : c'est celle que l'oued
    // supporte déjà, puisque c'est lui qui reçoit.
    const Vcible = etatOued?.vitesse ?? 1.35;
    const plateforme = ann.debitPlateforme({
      i: averse.intensitePlateforme, largeur: cas.route.plateforme.largeur,
      longueur: cas.route.plateforme.longueur });
    return {
      V0, d50, masse: ann.masseBloc(d50), vitesseDuBloc: ann.vitesseIsbash(d50),
      Vcible, longueur: ann.longueurProtection(ouvrage.largeurTotale, V0, Vcible),
      longueurSiTalusNu: ann.longueurProtection(ouvrage.largeurTotale, V0, 0.70),
      ailes: ann.angleAdmissible(cas.franchissement.entree, cas.franchissement.angleAiles),
      plateforme,
      fosse: ann.dimensionnerFosse({ Q: plateforme.Q, b: 0.4, m: 1.5,
        J: cas.route.plateforme.penteFosse, K: 30 }),
    };
  })();

  // ── 10 (ch9 b). Contrôles ────────────────────────────────────────────────
  const controle = ouvrage && (() => {
    // Le ressaut se cherche à plusieurs débits : c'est aux crues courantes,
    // quand l'oued est bas, que la sortie est la plus dénoyée.
    const ressauts = [Qretenu, Qretenu / 3, Qretenu / 8].map((q) => {
      const z = riv.tirantNormal(section, q, Joued);
      if (z === null) return null;
      const tw = Math.max(0, z - calage.zRadierAval);
      const r = ouv.calculerOuvrage({ forme: "dalot", B: ouvrage.B, D: ouvrage.D,
        cellules: ouvrage.cellules, Q: q, L: calage.L, J: calage.J, K: f.K,
        entree: f.entree, tw });
      const y1 = Math.min(r.profondeurNormale, ouvrage.D);
      return { q, z, tw, y1, Fr1: r.froude, etatSortie: r.etatSortie,
               position: riv.positionRessaut(y1, r.froude, tw) };
    }).filter(Boolean);

    const zExc = riv.tirantNormal(section, debits.Qexceptionnel, Joued);
    const twExc = zExc === null ? 0 : Math.max(0, zExc - calage.zRadierAval);
    const partage = dim.partageDebit(
      { forme: "dalot", B: ouvrage.B, D: ouvrage.D, cellules: ouvrage.cellules,
        Q: debits.Qexceptionnel, L: calage.L, J: calage.J, K: f.K, entree: f.entree, tw: twExc },
      { zRadierAmont: calage.zRadierAmont, zRoute: calage.zPlateforme,
        Lr: cas.route.longueurDeversante });
    return { ressauts, zExc, twExc, partage,
             horsLeveExceptionnel: zExc === null,
             surverse: partage.partage === true };
  })();

  return { cas, options: { T, regle, vitesseMax },
           morpho, pluies, averse, debits, periode, oued, calage, TW, ouvrage, protection, controle };
}
