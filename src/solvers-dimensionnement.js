// Dimensionnement : le problème inverse du chapitre 6.
//
// Le chapitre 6 calcule HW à partir d'une géométrie donnée. Ici la géométrie
// est l'inconnue, et il n'existe aucune formule qui la donne : le catalogue est
// discret (largeurs au mètre, hauteurs au demi-mètre, diamètres normalisés) et
// les exigences sont des inégalités. On énumère, on filtre, on classe.
//
// Deux natures de règles, à ne jamais confondre :
//   · les CRITÈRES DURS éliminent — un seul manquement suffit ;
//   · le SCORE ordonne ce qui reste — c'est une préférence de projet, pas une
//     loi physique, et elle se discute.
import { calculerOuvrage } from "./solvers-ouvrages.js";

/** Diamètres courants des buses préfabriquées (m). */
export const DIAMETRES = [0.60, 0.80, 1.00, 1.20, 1.50, 1.80, 2.00, 2.50, 3.00];

/** Pas des pentes de projet (%) : un ouvrage ne se cale pas au millième. */
export const PAS_PENTE = 0.1;

/** Exigences par défaut d'un projet neuf. Toutes réglables : ce sont des choix. */
export const LIMITES = {
  remplissageMax: 75,   // % de la hauteur, au tirant normal
  vitesseMax: 3.0,      // m/s
  rapportHWmax: 1.2,    // HW/D : mise en charge amont admise
  revancheMin: 0.50,    // m sous le point bas de la chaussée
};

/**
 * Pente de calage déduite de la pente critique : premier multiple de 0,1 %
 * qui atteint Ic, par EXCÈS et non par arrondi.
 * Arrondir au plus proche ferait passer Ic = 0,519 % à 0,5 % — soit en dessous
 * de la pente critique, donc de l'autre côté du régime. Le plafond donne 0,6 %.
 * Une Ic déjà pile sur un multiple reste inchangée.
 */
export function penteDeCalage(icPct) {
  if (!(icPct > 0)) return 0;
  return Math.round(Math.ceil(icPct / PAS_PENTE - 1e-9) * PAS_PENTE * 1000) / 1000;
}

/** Règle de forme des dalots : la hauteur ne dépasse pas la largeur, qui ne la dépasse pas de plus de 2 m. */
export const formeDalotAdmissible = (B, D) => D <= B + 1e-9 && B <= D + 2 + 1e-9;

// ── Calage altimétrique ────────────────────────────────────────────────────
// Quatre cotes qui ne se confondent jamais : radier (fil d'eau), terrain
// naturel, plan d'eau, chaussée. Une cote lue sur un MNT est du terrain
// naturel — ni un fil d'eau, ni la chaussée finie.

/** Radier de sortie : Z amont − J·L, L étant la longueur HORIZONTALE. */
export const coteRadierAval = (zRadierAmont, J, L) => zRadierAmont - J * L;

/** Plan d'eau amont : radier d'entrée + charge. */
export const cotePheAmont = (zRadierAmont, HW) => zRadierAmont + HW;

/** Profondeur aval TW : hauteur d'eau au-dessus du radier de SORTIE, jamais négative. */
export const profondeurAval = (zPheAval, zRadierAval) => Math.max(0, zPheAval - zRadierAval);

/** Revanche R = cote du point bas de la chaussée − cote du plan d'eau amont. */
export const revanche = (zRoute, zPheAmont) => zRoute - zPheAmont;

/** Quatre verdicts, pas deux : l'absence de cote de route n'est pas une conformité. */
export function verdictRevanche(R, revancheMin = LIMITES.revancheMin) {
  if (!Number.isFinite(R)) return "non vérifiable";
  if (R < -1e-4) return "surverse de la route";
  if (R + 1e-4 < revancheMin) return "insuffisante";
  return "conforme";
}

// ── Surverse routière ──────────────────────────────────────────────────────

/** Déversoir épais sur la chaussée : Q = Cd·kt·Lr·Hr^1,5 (Cd ≈ 1,70 en SI). */
export const debitDeversoir = (Cd, kt, Lr, Hr) =>
  Hr > 0 && Lr > 0 ? Cd * kt * Lr * Math.pow(Hr, 1.5) : 0;

/**
 * Partage du débit entre l'ouvrage et la route.
 * Le fonctionnement de l'ouvrage est RECALCULÉ à chaque débit essayé : la
 * hauteur sur la crête ne se déduit jamais du débit total. C'est une équation
 * implicite, résolue par dichotomie sur le débit qui passe dans l'ouvrage.
 */
export function partageDebit(params, { zRadierAmont, zRoute, Lr, Cd = 1.70, kt = 1.0 }) {
  const evalue = (q) => {
    const r = calculerOuvrage({ ...params, Q: q });
    if (r.erreur) return null;
    const zEau = cotePheAmont(zRadierAmont, r.HW);
    return { r, zEau, Hr: Math.max(0, zEau - zRoute),
             qRoute: debitDeversoir(Cd, kt, Lr, zEau - zRoute) };
  };

  const plein = evalue(params.Q);
  if (!plein) return { erreur: "Calcul impossible pour ce débit." };
  if (plein.Hr <= 0)
    return { partage: false, qOuvrage: params.Q, qRoute: 0, ...plein };

  // f(q) = q + Qroute(q) − Qtotal, croissante : dichotomie sûre.
  let lo = 1e-6, hi = params.Q;
  for (let i = 0; i < 80; i++) {
    const mid = 0.5 * (lo + hi);
    const e = evalue(mid);
    if (!e) break;
    if (mid + e.qRoute < params.Q) lo = mid; else hi = mid;
  }
  const q = 0.5 * (lo + hi);
  const e = evalue(q);
  return { partage: true, qOuvrage: q, qRoute: params.Q - q,
           ecartBilan: Math.abs(q + e.qRoute - params.Q), ...e };
}

// ── Critères durs et score ─────────────────────────────────────────────────

/** Motifs de rejet d'un candidat. Liste vide = candidat acceptable. */
export function motifsDeRejet(r, lim = LIMITES, R = NaN) {
  const m = [];
  if (!r || r.erreur) return ["calcul impossible"];
  if (r.capaciteDepassee) m.push("capacité de la section dépassée");
  if (r.remplissage * 100 > lim.remplissageMax + 1e-9)
    m.push(`remplissage ${(r.remplissage * 100).toFixed(0)} % > ${lim.remplissageMax} %`);
  if (r.vitesse > lim.vitesseMax + 1e-9)
    m.push(`vitesse ${r.vitesse.toFixed(2)} m/s > ${lim.vitesseMax.toFixed(2)} m/s`);
  if (r.HWsurD > lim.rapportHWmax + 1e-9)
    m.push(`HW/D = ${r.HWsurD.toFixed(2)} > ${lim.rapportHWmax}`);
  if (Number.isFinite(R) && verdictRevanche(R, lim.revancheMin) !== "conforme")
    m.push(`revanche ${verdictRevanche(R, lim.revancheMin)} (${R.toFixed(2)} m)`);
  return m;
}

/**
 * Score de préférence. Convention de projet, explicitement arbitraire :
 * pénalise les cellules et l'encombrement, récompense un remplissage moyen,
 * une vitesse de curage, une charge amont modérée et une revanche confortable.
 * L'encombrement compté est celui du rectangle enveloppe (n·B·D), pas la
 * section d'écoulement : ce sont la fouille et les têtes qui coûtent.
 */
export function score(r, n, B, D, R = NaN, lim = LIMITES) {
  let s = 100;
  s -= (n - 1) * 8;
  s -= n * B * D * 1.5;

  const f = r.remplissage * 100;
  if (f >= 50 && f <= 70) s += 12;
  else if (f >= 40 && f < 50) s += 4;
  else if (f > 70 && f <= 75) s += 2;
  else s -= Math.abs(f - 60) * 0.2;

  const v = r.vitesse;
  if (v >= 2.0 && v <= 3.0) s += 10;
  else if (v >= 1.5 && v < 2.0) s += 4;
  else if (v > 3.0 && v <= 3.5) s += 2;
  else s -= Math.abs(v - 2.5) * 2;

  const ratio = r.HWsurD;
  if (ratio <= 0.8) s += 18;
  else if (ratio <= 1.0) s += 12;
  else if (ratio <= lim.rapportHWmax) s += 4;

  if (Number.isFinite(R)) {
    if (R >= lim.revancheMin + 0.5) s += 8;
    else if (R + 1e-4 >= lim.revancheMin) s += 3;
  }
  return s;
}

// ── Recherche ──────────────────────────────────────────────────────────────

/** Virgule décimale. */
const vg = (x, d) => x.toFixed(d).replace(".", ",");

/** Couples (B, D) ou diamètres du catalogue, selon la forme. */
export function catalogue(forme, { Bmin = 1, Bmax = 4, Dmin = 1, Dmax = 3 } = {}) {
  if (forme === "buse")
    return DIAMETRES.filter((d) => d >= Dmin - 1e-9 && d <= Dmax + 1e-9).map((d) => ({ B: d, D: d }));
  const out = [];
  for (let B = Math.max(1, Math.round(Bmin)); B <= Bmax + 1e-9; B += 1)
    for (let D = Math.max(0.5, Math.round(Dmin * 2) / 2); D <= Dmax + 1e-9; D += 0.5)
      if (formeDalotAdmissible(B, D)) out.push({ B: Math.round(B), D: Math.round(D * 10) / 10 });
  return out;
}

/**
 * Énumère le catalogue, évalue chaque candidat avec le moteur du chapitre 6,
 * applique les critères durs puis classe les survivants.
 * Pente `J` nulle ou absente = pente libre : chaque candidat est calé au
 * premier multiple de 0,1 % au-dessus de SA pente critique.
 */
export function proposer({
  forme = "dalot", Q, L = 12, J = 0, K = 70, entree, tw = 0, Ks = 1.0,
  cellulesMax = 4, limites = {}, bornes = {},
  zRadierAmont = null, zRoute = null,
}) {
  const lim = { ...LIMITES, ...limites };
  const penteLibre = !(J > 0);
  const candidats = [];

  for (const { B, D } of catalogue(forme, bornes))
    for (let n = 1; n <= cellulesMax; n++) {
      const base = { forme, B, D, cellules: n, Q, L, K, entree, tw, Ks,
                     vitesseMax: lim.vitesseMax };
      let Jc = penteLibre ? 0.005 : J;
      let r = calculerOuvrage({ ...base, J: Jc });
      if (r.erreur) continue;
      if (penteLibre) {
        // Ic ne dépend pas de J : une seule reprise suffit.
        Jc = penteDeCalage(r.penteCritique * 100) / 100;
        if (Jc > 0) r = calculerOuvrage({ ...base, J: Jc });
        if (r.erreur) continue;
      }
      const R = zRadierAmont != null && zRoute != null
        ? revanche(zRoute, cotePheAmont(zRadierAmont, r.HW)) : NaN;
      const motifs = motifsDeRejet(r, lim, R);
      candidats.push({
        cellules: n, B, D, J: Jc, r, revanche: R,
        motifs, retenu: motifs.length === 0,
        score: motifs.length === 0 ? score(r, n, B, D, R, lim) : -Infinity,
        // Séparateur décimal français : ce libellé s'affiche tel quel.
        libelle: forme === "buse" ? `${n} × Ø ${vg(D, 2)} m` : `${n} × ${B} × ${vg(D, 1)} m`,
      });
    }

  const admissibles = candidats.filter((c) => c.retenu).sort((a, b) => b.score - a.score);
  return {
    candidats, admissibles, retenue: admissibles[0] || null,
    examines: candidats.length, rejetes: candidats.length - admissibles.length,
  };
}

// ── Règles §6 de la note circulaire DGPC N°1054/2019 ───────────────────────
// Elles ne remplacent pas les critères hydrauliques : elles s'y ajoutent, et
// portent sur l'exploitation de l'ouvrage — curage, entretien, dépôts.

export function reglesDgpcSix(D, remplissagePct) {
  const regles = [];
  if (D < 1.5)
    regles.push({ regle: "hauteur minimale", verdict: "non conforme",
      texte: `hauteur ${D.toFixed(2)} m < 1,50 m : entretien et curage difficiles` });
  if (D <= 5.0 && remplissagePct > 80)
    regles.push({ regle: "PHE ≤ 80 % de H", verdict: "non conforme",
      texte: `remplissage ${remplissagePct.toFixed(0)} % > 80 % : à proscrire` });
  if (D <= 5.0)
    regles.push({ regle: "hauteur morte", verdict: "à prévoir",
      texte: `hauteur morte de ${(0.10 * D * 100).toFixed(0)} cm (10 % × H) pour les dépôts solides` });
  return regles;
}

// ── Précalage : d'où vient la pente ────────────────────────────────────────
// La pente d'un ouvrage n'est presque jamais une variable libre. Elle tombe
// d'une chaîne de trois maillons, et le calcul hydraulique ne commence qu'au
// bout de cette chaîne :
//
//   largeur des éléments de la voie → longueur de l'ouvrage → cotes d'entrée
//   et de sortie levées sur le terrain → pente.
//
// D'où ce point, que la pratique dément souvent : rien ne garantit que cette
// pente soit supérieure à la pente critique.

/** Épaisseur usuelle d'un mur de tête, de part et d'autre (m). */
export const EPAISSEUR_TETE = 0.30;

/**
 * Emprise de la route : ce que le remblai occupe au sol, de pied à pied,
 * mesuré PERPENDICULAIREMENT à l'axe.
 */
export function empriseRoute({ chaussee, accotement = 0, hauteurRemblai, fruitTalus = 1.5 }) {
  const plateforme = chaussee + 2 * accotement;
  return { plateforme, emprise: plateforme + 2 * fruitTalus * hauteurRemblai };
}

const sinBiais = (deg) => Math.sin((Math.min(Math.max(deg, 20), 160) * Math.PI) / 180);

/**
 * Précalage complet.
 *
 * La longueur ne se mesure PAS de pied de talus à pied de talus : les têtes se
 * posent là où l'intrados perce la face de talus, et au droit de l'ouvrage
 * cette face est plus haute que le pied. On compte donc, de chaque côté, la
 * largeur de talus au-dessus de l'ouvrage seulement — soit m fois la
 * COUVERTURE, la hauteur de remblai au-dessus de l'intrados :
 *
 *   L = [ l_plateforme + m·(c_amont + c_aval) ] / sin(biais) + 2·e_tête
 *
 * (D'autres conventions existent — tête au pied de talus, tête à mi-hauteur.
 * Elles allongent l'ouvrage ; celle-ci est la plus courte qui couvre encore
 * l'intrados partout. Ce qui compte est de la déclarer.)
 *
 * La longueur dépend donc de la HAUTEUR de l'ouvrage : un ouvrage plus haut
 * laisse moins de couverture, perce le talus plus près de la chaussée, et se
 * raccourcit. Et comme la cote de sortie vaut Z_entrée − J·L, tandis que
 * J = chute / L, le système boucle sur lui-même. On l'itère ; il converge en
 * deux passes, la couverture aval ne changeant que de quelques centimètres.
 */
export function precaler({
  chaussee, accotement = 0, hauteurRemblai, fruitTalus = 1.5, biaisDeg = 90,
  epaisseurTete = EPAISSEUR_TETE, zTnEntree, zTnSortie, decaissement = 0,
  hauteurOuvrage,
}) {
  const { plateforme, emprise } = empriseRoute({ chaussee, accotement, hauteurRemblai, fruitTalus });
  const sin = sinBiais(biaisDeg);
  const zTnAxe = (zTnEntree + zTnSortie) / 2;
  const zPlateforme = zTnAxe + hauteurRemblai;
  const zRadierAmont = zTnEntree - decaissement;
  const chute = zTnEntree - zTnSortie;

  let L = (emprise / sin) + 2 * epaisseurTete, J = 0, zRadierAval = zRadierAmont;
  let cAmont = 0, cAval = 0, passes = 0;
  for (; passes < 8; passes++) {
    J = chute / L;
    zRadierAval = zRadierAmont - J * L;
    cAmont = zPlateforme - (zRadierAmont + hauteurOuvrage);
    cAval = zPlateforme - (zRadierAval + hauteurOuvrage);
    const Lsuivant = (plateforme + fruitTalus * (Math.max(cAmont, 0) + Math.max(cAval, 0))) / sin
      + 2 * epaisseurTete;
    if (Math.abs(Lsuivant - L) < 1e-6) { L = Lsuivant; break; }
    L = Lsuivant;
  }
  J = chute / L;
  zRadierAval = zRadierAmont - J * L;

  const couvertureMin = Math.min(cAmont, cAval);
  return {
    plateforme, emprise, zPlateforme, zTnAxe,
    couvertureAmont: cAmont, couvertureAval: cAval, couvertureMin,
    L, Lentre: L - 2 * epaisseurTete, allongement: 1 / sin, chute, J,
    zRadierAmont, zRadierAval, passes,
    valide: J > 0 && couvertureMin > 0,
    motif: couvertureMin <= 0
      ? "l'ouvrage ne passe pas sous ce remblai : il manque "
        + `${(-couvertureMin).toFixed(2).replace(".", ",")} m `
        + "de couverture au-dessus de l'intrados"
      : J > 0 ? null
      : J === 0 ? "terrain plat entre les deux extrémités : aucune pente ne se déduit du levé"
      : "la cote de sortie est au-dessus de la cote d'entrée : le sens d'écoulement est inversé",
  };
}

/**
 * Régime dans l'ouvrage, par comparaison à la pente critique.
 * Sous la pente critique l'écoulement est FLUVIAL (y_n > y_c, Fr < 1), au-dessus
 * TORRENTIEL. Les trois critères — pente, tirant, Froude — basculent ensemble ;
 * c'est le même fait dit trois fois.
 */
export function regimeDePente(J, Ic) {
  if (!(Ic > 0)) return { regime: "indéterminé", ecart: NaN, limite: false };
  const ecart = J / Ic;
  return {
    regime: J > Ic ? "torrentiel" : "fluvial",
    ecart,
    limite: Math.abs(ecart - 1) < 0.05,     // à 5 % près de la bascule
  };
}
