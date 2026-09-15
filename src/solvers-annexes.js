// Ouvrages annexes : têtes et murs en aile, protection contre l'affouillement,
// fossés, descentes d'eau, assainissement de la plateforme.
//
// L'INVARIANT DU CHAPITRE : une tête d'ouvrage a DEUX descriptions
// indépendantes, qui ne se mélangent jamais.
//   · l'hydraulique vient de HDS-5 — coefficients K, M, C, Y, Kpente, Ke, et
//     les familles d'angles que l'abaque a réellement testées ;
//   · la géométrie vient du guide de conception des ponts-cadres — longueurs,
//     épaisseurs, fruits, semelle, joints.
// Déplacer un angle À L'INTÉRIEUR de sa famille ne change aucun coefficient.
// En sortir les invalide tous : on ne lit plus rien sur l'abaque.

export const G = 9.81;

// ── A. Têtes d'ouvrage : familles d'angles ────────────────────────────────

/**
 * Contrainte d'angle par configuration d'entrée. L'angle se mesure DEPUIS
 * L'AXE DE L'OUVRAGE : 0° = prolongement des piédroits, 90° = mur frontal.
 * Ne jamais convertir en 90° − α : c'est la convention de la source.
 */
export const REGLES_ANGLE = {
  "box-ailes-evasees": { genre: "plage", min: 30, max: 75, defaut: 45,
    libelle: "ailes évasées de 30° à 75°" },
  "box-ailes-15": { genre: "discret", valeurs: [15, 90], defaut: 90,
    libelle: "ailes à 15° ou mur frontal à 90°" },
  "box-ailes-paralleles": { genre: "impose", defaut: 0,
    libelle: "ailes parallèles" },
  "box-ailes-45-biseau": { genre: "impose", defaut: 45,
    libelle: "ailes à 45° avec biseau supérieur" },
  "mur-frontal-chanfrein": { genre: "sansAile",
    libelle: "mur frontal, chanfreins de 19 mm sur trois arêtes" },
  "mur-frontal-biseau": { genre: "sansAile",
    libelle: "mur frontal, biseaux à 45° sur trois arêtes" },
};

/** Traitement d'arête, indissociable de la configuration hydraulique. */
export const ARETES = {
  "box-ailes-evasees": { libelle: "arête vive", vive: true },
  "box-ailes-15": { libelle: "arête vive", vive: true },
  "box-ailes-paralleles": { libelle: "arête vive", vive: true },
  "box-ailes-45-biseau": { libelle: "biseau supérieur (0,043 D)", biseauSurD: 0.043 },
  "mur-frontal-chanfrein": { libelle: "chanfreins de 19 mm sur trois arêtes",
    chanfrein19: true, troisAretes: true },
  "mur-frontal-biseau": { libelle: "biseaux à 45° sur trois arêtes",
    biseauSurD: 0.042, biseauSurB: 0.042, troisAretes: true },
};

/**
 * L'angle demandé est-il admissible pour cette configuration ?
 * Un angle hors famille ne CORRIGE pas les coefficients : il les invalide.
 */
export function angleAdmissible(idEntree, angleDeg) {
  const r = REGLES_ANGLE[idEntree];
  if (!r) return { ok: false, motif: "configuration d'entrée inconnue" };
  if (r.genre === "sansAile")
    return { ok: false, motif: `${r.libelle} : pas de mur en aile, aucun angle à choisir` };
  if (r.genre === "impose")
    return Math.abs(angleDeg - r.defaut) < 1e-9
      ? { ok: true }
      : { ok: false, motif: `angle imposé à ${r.defaut}° par cette configuration` };
  if (r.genre === "discret")
    return r.valeurs.some((v) => Math.abs(angleDeg - v) < 1e-9)
      ? { ok: true }
      : { ok: false, motif: `l'abaque ne couvre que ${r.valeurs.join("° et ")}° — `
          + `l'intervalle entre les deux relève des ailes évasées, pas de cette configuration` };
  return angleDeg >= r.min - 1e-9 && angleDeg <= r.max + 1e-9
    ? { ok: true }
    : { ok: false, motif: `hors de la plage ${r.min}° à ${r.max}° testée par l'abaque` };
}

/** Profondeur du biseau supérieur (m) : fraction de D, la hauteur INTÉRIEURE. */
export function biseauSuperieur(idEntree, D) {
  const a = ARETES[idEntree];
  if (!a) return 0;
  if (a.chanfrein19) return 0.019;
  return a.biseauSurD ? a.biseauSurD * D : 0;
}

/** Profondeur des biseaux latéraux (m) : fraction de B. */
export function biseauLateral(idEntree, B) {
  const a = ARETES[idEntree];
  if (!a) return 0;
  if (a.chanfrein19) return 0.019;
  return a.biseauSurB ? a.biseauSurB * B : 0;
}

// ── A bis. Géométrie des murs : la proposition esthétique, en grades ──────

export const EPAISSEUR_TETE_MIN = 0.25;
export const EPAISSEUR_TETE_MAX_USUELLE = 0.30;

/**
 * Angles esthétiques proposés par le guide de conception des ponts-cadres.
 * La formule est écrite EN GRADES et il faut y rester jusqu'au bout :
 *   φ_g = φ_deg / 0,9   ·   α_g = 15 + 0,03·L²   ·   β_g = 0,008·(φ_g + 25)·α_g
 * puis retour en degrés par α_deg = 0,9·α_g.
 * L est l'ouverture droite (m), φ le biais (90° = ouvrage droit, soit 100 gr).
 * Pour L = 3 m sur un ouvrage droit : α = β = 13,743°.
 */
export function anglesEsthetiques(ouvertureDroiteM, biaisDeg = 90) {
  if (!(ouvertureDroiteM > 0)) return null;
  const phiG = biaisDeg / 0.9;
  const alphaG = 15 + 0.03 * ouvertureDroiteM * ouvertureDroiteM;
  const betaG = 0.008 * (phiG + 25) * alphaG;
  return { alphaG, betaG, alpha: 0.9 * alphaG, beta: 0.9 * betaG, phiG };
}

/**
 * Épaisseur en pied d'un mur, depuis l'épaisseur en tête et les fruits.
 *   e_base = (e_tête + (f_ext + f_int)·h) / (1 + f_ext + f_int)
 * Prédimensionnement : il reste à justifier par le calcul de stabilité.
 */
export function epaisseurBase(epaisseurTete, hauteurMur, fruitExt = 0, fruitInt = 0) {
  const f = fruitExt + fruitInt;
  if (!(hauteurMur > 0)) return epaisseurTete;
  return (epaisseurTete + f * hauteurMur) / (1 + f);
}

/** Contrôles sur l'épaisseur en tête. */
export function verifierEpaisseurTete(e) {
  if (!(e > 0)) return { verdict: "non définie", motif: "épaisseur en tête à renseigner" };
  if (e < EPAISSEUR_TETE_MIN - 1e-9)
    return { verdict: "refusée",
      motif: `${e.toFixed(2)} m sous le minimum de ${EPAISSEUR_TETE_MIN.toFixed(2)} m : bétonnage impossible` };
  if (e > EPAISSEUR_TETE_MAX_USUELLE + 1e-9)
    return { verdict: "hors plage usuelle",
      motif: `au-delà de la plage usuelle ${EPAISSEUR_TETE_MIN.toFixed(2)}–${EPAISSEUR_TETE_MAX_USUELLE.toFixed(2)} m` };
  return { verdict: "conforme", motif: "" };
}

// ── B. Affouillement et protection de sortie ──────────────────────────────

/** Coefficients d'Isbash : 0,86 en forte turbulence, 1,20 en faible. */
export const C_ISBASH = { forte: 0.86, faible: 1.20 };

/**
 * Taille de bloc d'Isbash. La relation d'origine s'écrit
 *   V = C·√( 2g·(S_s − 1)·d50 )   d'où   d50 = V² / ( 2g·C²·(S_s − 1) )
 * S_s est la densité de la roche (2,65 pour un calcaire ou un granite courant).
 * La sortie d'un ouvrage est une zone de FORTE turbulence : C = 0,86.
 */
export function isbash(V, { Ss = 2.65, C = C_ISBASH.forte } = {}) {
  if (!(V > 0) || !(Ss > 1) || !(C > 0)) return null;
  return (V * V) / (2 * G * C * C * (Ss - 1));
}

/** Vitesse admissible d'un enrochement donné — la réciproque d'Isbash. */
export const vitesseIsbash = (d50, { Ss = 2.65, C = C_ISBASH.forte } = {}) =>
  d50 > 0 ? C * Math.sqrt(2 * G * (Ss - 1) * d50) : 0;

/** Masse d'un bloc de diamètre médian d50, assimilé à une sphère (kg). */
export const masseBloc = (d50, { rho = 2650 } = {}) =>
  d50 > 0 ? rho * (Math.PI / 6) * Math.pow(d50, 3) : 0;

/**
 * Longueur de protection par expansion du jet — ORDRE DE GRANDEUR.
 * Hypothèse : le jet s'élargit de 1 pour 3 de chaque côté et la profondeur
 * reste voisine, si bien que la vitesse décroît comme l'inverse de la largeur.
 *   V(L) = V₀·W₀/W   avec   W = W₀ + 2L/3
 * d'où, pour ramener la vitesse à V_adm :   L = 1,5·W₀·(V₀/V_adm − 1)
 * Ce calcul ignore le ressaut et le fond réel : il donne un ordre de grandeur,
 * pas une longueur de projet. Les guides tabulent des longueurs qui priment.
 */
export function longueurProtection(W0, V0, Vadm) {
  if (!(W0 > 0 && V0 > 0 && Vadm > 0)) return null;
  if (V0 <= Vadm) return { L: 0, motif: "la vitesse de sortie est déjà admissible" };
  return { L: 1.5 * W0 * (V0 / Vadm - 1), motif: null };
}

/**
 * Vitesses admissibles : ORDRES DE GRANDEUR, à confronter aux prescriptions.
 * Une seule ligne se calcule au lieu de se lire — celle de l'enrochement, dont
 * la vitesse admissible est précisément ce que donne Isbash à partir de d50.
 */
export const VITESSES_ADMISSIBLES = [
  { id: "terre", libelle: "Terre nue, limons", min: 0.6, max: 0.8, calculee: false },
  { id: "terre-vegetalisee", libelle: "Terre végétalisée, gazon établi", min: 1.2, max: 1.5, calculee: false },
  { id: "enrochement", libelle: "Enrochement", min: null, max: null, calculee: true },
  { id: "maconnerie", libelle: "Maçonnerie, perré", min: 2.5, max: 3.5, calculee: false },
  { id: "beton", libelle: "Béton", min: 4.0, max: 6.0, calculee: false },
];

// ── C. Fossés : section trapézoïdale ──────────────────────────────────────

/** Fossé trapézoïdal de largeur en plafond b et de fruit m (horizontal/vertical). */
export function sectionTrapeze(b, m) {
  return {
    b, m,
    aire: (y) => (b + m * y) * y,
    perimetre: (y) => b + 2 * y * Math.sqrt(1 + m * m),
    largeurAuMiroir: (y) => b + 2 * m * y,
    /** Q = K·A·R^(2/3)·√J */
    debit(y, K, J) {
      const A = this.aire(y), P = this.perimetre(y);
      return P > 0 && J > 0 ? K * A * Math.pow(A / P, 2 / 3) * Math.sqrt(J) : 0;
    },
    /** Profondeur critique : Q²·T/(g·A³) = 1. */
    profondeurCritique(Q) {
      let lo = 1e-9, hi = 50;
      const f = (y) => (Q * Q * this.largeurAuMiroir(y)) / (G * Math.pow(this.aire(y), 3)) - 1;
      for (let i = 0; i < 200; i++) {
        const mid = 0.5 * (lo + hi);
        if (f(mid) > 0) lo = mid; else hi = mid;
      }
      return 0.5 * (lo + hi);
    },
  };
}

/**
 * Tirant normal d'un fossé. Contrairement à une buse, la débitance d'un
 * trapèze croît indéfiniment avec y : la dichotomie n'a pas besoin d'être
 * bornée à un maximum, elle l'est seulement par une profondeur physique.
 */
export function profondeurNormaleFosse(sec, Q, K, J, yMax = 20) {
  if (!(Q > 0 && K > 0 && J > 0)) return null;
  let lo = 1e-9, hi = yMax;
  if (sec.debit(hi, K, J) < Q) return null;          // hors de portée
  for (let i = 0; i < 200; i++) {
    const mid = 0.5 * (lo + hi);
    if (sec.debit(mid, K, J) < Q) lo = mid; else hi = mid;
  }
  return 0.5 * (lo + hi);
}

/**
 * Dimensionnement d'un fossé : tirant, vitesse, régime, revanche, verdict de
 * revêtement. `revanche` est la garde au-dessus du plan d'eau.
 */
export function dimensionnerFosse({ Q, b = 0.4, m = 1.5, J, K = 30, profondeur = null,
                                    revancheMin = 0.10, revetement = "terre-vegetalisee",
                                    d50 = 0.20, Ss = 2.65 }) {
  if (!(Q > 0 && J > 0 && K > 0)) return { erreur: "débit, pente et rugosité à renseigner" };
  const sec = sectionTrapeze(b, m);
  const yn = profondeurNormaleFosse(sec, Q, K, J);
  if (yn === null) return { erreur: "aucun tirant normal dans la plage : revoir la pente ou la section" };
  const A = sec.aire(yn), V = Q / A;
  const yc = sec.profondeurCritique(Q);
  const rev = VITESSES_ADMISSIBLES.find((r) => r.id === revetement) || VITESSES_ADMISSIBLES[1];
  const Vadm = rev.calculee ? vitesseIsbash(d50, { Ss }) : rev.max;
  const hauteur = profondeur ?? yn + revancheMin;
  return {
    section: sec, yn, yc, aire: A, vitesse: V,
    perimetre: sec.perimetre(yn), rayon: A / sec.perimetre(yn),
    largeurAuMiroir: sec.largeurAuMiroir(yn),
    regime: yn < yc ? "torrentiel" : "fluvial",
    revetement: rev, vitesseAdmissible: Vadm, vitesseOk: V <= Vadm + 1e-9,
    hauteur, revanche: hauteur - yn, revancheOk: hauteur - yn >= revancheMin - 1e-9,
    largeurEmprise: b + 2 * m * hauteur,
  };
}

// ── D. Descente d'eau sur talus ───────────────────────────────────────────

/**
 * Descente d'eau rectangulaire sur un talus : le régime y est torrentiel et le
 * tirant normal, très faible, donne une vitesse élevée. On la calcule par
 * Manning sur la pente du talus, et on la compare à la vitesse admissible du
 * revêtement — puis on dimensionne la dissipation en pied.
 */
export function descenteEau({ Q, largeur, penteTalus, K = 65 }) {
  if (!(Q > 0 && largeur > 0 && penteTalus > 0)) return { erreur: "données incomplètes" };
  const sec = sectionTrapeze(largeur, 0);            // rectangle = trapèze de fruit nul
  const yn = profondeurNormaleFosse(sec, Q, K, penteTalus, 10);
  if (yn === null) return { erreur: "aucun tirant normal" };
  const V = Q / sec.aire(yn);
  const yc = sec.profondeurCritique(Q);
  const Froude = V / Math.sqrt(G * yn);
  return { yn, yc, vitesse: V, Froude, regime: Froude > 1 ? "torrentiel" : "fluvial",
           // Ressaut en pied : profondeur conjuguée de Bélanger.
           conjuguee: (yn / 2) * (Math.sqrt(1 + 8 * Froude * Froude) - 1) };
}

// ── E. Assainissement de la plateforme ────────────────────────────────────

/**
 * Débit collecté par un demi-profil de plateforme, méthode rationnelle.
 * `largeur` est la largeur drainée vers le fossé (m), `longueur` la longueur
 * de collecte entre deux exutoires (m), `i` l'intensité du chapitre 3 (mm/h).
 * Le coefficient de ruissellement d'une chaussée revêtue est proche de 1.
 */
export function debitPlateforme({ C = 0.90, i, largeur, longueur }) {
  if (!(i > 0 && largeur > 0 && longueur > 0)) return null;
  const S = (largeur * longueur) / 1e6;              // km²
  return { S, Q: 0.278 * C * i * S, C, i, largeur, longueur };
}
