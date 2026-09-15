// Hydraulique des dalots et des buses — équations HDS-5 (FHWA) et énergie.
//
// Une seule chaîne, quelle que soit la forme :
//   géométrie → Manning-Strickler → profondeur critique → contrôle à l'entrée
//   → contrôle à la sortie → HW = max(HW_entrée, HW_sortie)
// Manning ne fixe pas à lui seul le niveau amont : il donne la capacité, le
// tirant normal, la vitesse et la pente de frottement. Le niveau amont est le
// maximum de DEUX calculs indépendants.

export const G = 9.81;

/** Bornes de la zone de transition HDS-5 sur l'intensité adimensionnelle X. */
export const X_DENOYEE = 1.93, X_NOYEE = 2.21;

/** Tolérance de classement des profondeurs de sortie (m) : 0,1 mm. */
export const TOLERANCE = 1e-4;

// ── Géométrie des sections ─────────────────────────────────────────────────

/** Dalot rectangulaire de largeur b et de hauteur D (m). */
export function sectionRectangulaire(b, D) {
  const cl = (y) => Math.min(Math.max(y, 0), D);
  return {
    forme: "dalot", hauteur: D, largeur: b,
    aire: (y) => b * cl(y),
    perimetre: (y) => b + 2 * cl(y),
    largeurAuMiroir: () => b,
    airePleine: b * D,
    rayonPlein: (b * D) / (2 * (b + D)),
    profondeurCritique: (q) => Math.min(Math.cbrt((q * q) / (G * b * b)), D),
  };
}

/** Buse circulaire de diamètre D (m). */
export function sectionCirculaire(D) {
  const cl = (y) => Math.min(Math.max(y, 1e-12), D);
  const theta = (y) => 2 * Math.acos(1 - (2 * cl(y)) / D);
  const aire = (y) => ((D * D) / 8) * (theta(y) - Math.sin(theta(y)));
  const largeurAuMiroir = (y) => D * Math.sin(theta(y) / 2);
  return {
    forme: "buse", hauteur: D, largeur: D,
    aire, perimetre: (y) => (D * theta(y)) / 2, largeurAuMiroir,
    airePleine: (Math.PI * D * D) / 4,
    rayonPlein: D / 4,
    profondeurCritique(q) {
      // Q²·T / (g·A³) = 1, résolu par dichotomie sur la profondeur.
      let lo = 1e-9, hi = D;
      const f = (y) => (q * q * largeurAuMiroir(y)) / (G * Math.pow(aire(y), 3)) - 1;
      if (f(hi) > 0) return D;                      // critique au-delà de la section pleine
      for (let i = 0; i < 200; i++) {
        const mid = 0.5 * (lo + hi);
        if (f(mid) > 0) lo = mid; else hi = mid;
      }
      return 0.5 * (lo + hi);
    },
  };
}

// ── Manning-Strickler ──────────────────────────────────────────────────────

/** Débitance Q(y) = K·A·R^(2/3)·√J. */
export function debitance(sec, y, K, J) {
  const A = sec.aire(y), P = sec.perimetre(y);
  return P > 0 && J > 0 ? K * A * Math.pow(A / P, 2 / 3) * Math.sqrt(J) : 0;
}

/**
 * Tirant normal, par dichotomie bornée à la profondeur de débitance maximale :
 * sur une buse, Q(y) redescend au-delà de ~0,94 D et une dichotomie non bornée
 * pourrait retourner la racine haute, physiquement instable.
 */
export function profondeurNormale(sec, q, K, J) {
  if (!(J > 0)) return sec.hauteur;
  let yPic = sec.hauteur, qPic = 0;
  for (let i = 1; i <= 100; i++) {
    const y = (i / 100) * sec.hauteur;
    const qi = debitance(sec, y, K, J);
    if (qi > qPic) { qPic = qi; yPic = y; }
  }
  if (qPic < q) return sec.hauteur;                 // capacité dépassée
  let lo = 1e-9, hi = yPic;
  for (let i = 0; i < 200; i++) {
    const mid = 0.5 * (lo + hi);
    if (debitance(sec, mid, K, J) < q) lo = mid; else hi = mid;
  }
  return 0.5 * (lo + hi);
}

/** Pente de frottement à pleine section, traitée en conduite fermée. */
export const penteFrottementPleine = (sec, q, K) =>
  Math.pow(q / (K * sec.airePleine * Math.pow(sec.rayonPlein, 2 / 3)), 2);

/**
 * Pente critique : celle pour laquelle le tirant NORMAL vaut le tirant
 * CRITIQUE. On écrit Manning-Strickler au tirant critique et on en tire J :
 *
 *     I_c = [ q / (K · A_c · R_c^(2/3)) ]²
 *
 * Elle ne dépend pas de la longueur de l'ouvrage, mais elle dépend du
 * coefficient de rugosité — sur un même dalot 2,00 × 1,50 à 6 m³/s, I_c passe
 * de 0,30 % à K = 90 à 0,98 % à K = 50. Le régime d'écoulement se joue donc en
 * partie sur un coefficient qu'on a choisi.
 */
export function penteCritique(sec, q, K) {
  const yc = Math.min(sec.profondeurCritique(q), sec.hauteur);
  const A = sec.aire(yc), P = sec.perimetre(yc);
  return A > 0 && P > 0 && K > 0 ? Math.pow(q / (K * A * Math.pow(A / P, 2 / 3)), 2) : 0;
}

/** Nombre de Froude à un tirant donné : Fr = V / √(g·A/T). */
export function froude(sec, y, q) {
  const A = sec.aire(y), T = sec.largeurAuMiroir(y);
  return A > 0 && T > 0 ? (q / A) / Math.sqrt((G * A) / T) : 0;
}

// ── Catalogue d'entrées (HDS-5, annexe A) ──────────────────────────────────
// Piège de nomenclature : l'ABAQUE distingue le matériau, l'ÉCHELLE distingue
// l'entrée. Les trois entrées béton ne sont donc pas les abaques 1, 2 et 3.

export const ENTREES = [
  { id: "box-ailes-evasees", forme: "dalot", materiau: "béton", abaque: 8, echelle: "1",
    libelle: "Ailes évasées 30° à 75°", forme_eq: 1,
    K: 0.026, M: 1.0, C: 0.0347, Y: 0.81, Kpente: -0.50, Ke: 0.40 },
  { id: "box-ailes-15", forme: "dalot", materiau: "béton", abaque: 8, echelle: "2",
    libelle: "Ailes à 15° ou mur frontal à 90°", forme_eq: 1,
    K: 0.061, M: 0.75, C: 0.0400, Y: 0.80, Kpente: -0.50, Ke: 0.50 },
  { id: "box-ailes-paralleles", forme: "dalot", materiau: "béton", abaque: 8, echelle: "3",
    libelle: "Ailes parallèles", forme_eq: 1,
    K: 0.061, M: 0.75, C: 0.0423, Y: 0.82, Kpente: -0.50, Ke: 0.70 },
  { id: "buse-arete-vive", forme: "buse", materiau: "béton", abaque: 1, echelle: "1",
    libelle: "Bout droit avec mur de tête, arête vive", forme_eq: 1,
    K: 0.0098, M: 2.00, C: 0.0398, Y: 0.67, Kpente: -0.50, Ke: 0.50 },
  { id: "buse-emboitement", forme: "buse", materiau: "béton", abaque: 1, echelle: "2",
    libelle: "Emboîtement femelle avec mur de tête", forme_eq: 1,
    K: 0.0018, M: 2.00, C: 0.0292, Y: 0.74, Kpente: -0.50, Ke: 0.20 },
  { id: "buse-metal-talus", forme: "buse", materiau: "métal ondulé", abaque: 2, echelle: "2",
    libelle: "Entrée coupée suivant le talus", forme_eq: 1,
    K: 0.0210, M: 1.33, C: 0.0463, Y: 0.75, Kpente: +0.70, Ke: 0.70 },
  { id: "buse-metal-saillie", forme: "buse", materiau: "métal ondulé", abaque: 2, echelle: "3",
    libelle: "Extrémité en saillie", forme_eq: 1,
    K: 0.0340, M: 1.50, C: 0.0553, Y: 0.54, Kpente: -0.50, Ke: 0.90 },
];

export const entreePar = (id) => ENTREES.find((e) => e.id === id) || null;
export const entreesPour = (forme) => ENTREES.filter((e) => e.forme === forme);

// ── Contrôle à l'entrée ────────────────────────────────────────────────────

/**
 * Équations HDS-5, annexe A. L'intensité adimensionnelle vaut
 *   X = 1,811 · q / (A_pleine · √D)      (q = débit par cellule)
 * puis, selon le régime :
 *   dénoyée, forme 1 : HW/D = E_c/D + K·X^M + K_pente·J
 *   dénoyée, forme 2 : HW/D = K·X^M
 *   noyée            : HW/D = C·X² + Y + K_pente·J
 * Entre X = 1,93 et X = 2,21, on interpole linéairement : la transition n'est
 * pas une frontière physique, c'est un raccord entre deux ajustements.
 */
export function controleEntree(sec, entree, q, J, energieCritique) {
  const D = sec.hauteur;
  const X = (1.811 * q) / (sec.airePleine * Math.sqrt(D));
  const denoyee = entree.forme_eq === 1
    ? energieCritique / D + entree.K * Math.pow(X, entree.M) + entree.Kpente * J
    : entree.K * Math.pow(X, entree.M);
  const noyee = entree.C * X * X + entree.Y + entree.Kpente * J;

  let ratio, regime;
  if (X <= X_DENOYEE) { ratio = denoyee; regime = "dénoyée"; }
  else if (X >= X_NOYEE) { ratio = noyee; regime = "noyée"; }
  else {
    const t = (X - X_DENOYEE) / (X_NOYEE - X_DENOYEE);
    ratio = (1 - t) * denoyee + t * noyee;
    regime = "transition";
  }
  return { X, ratio, ratioDenoyee: denoyee, ratioNoyee: noyee, regime, HW: ratio * D };
}

// ── Contrôle à la sortie ───────────────────────────────────────────────────

/** État de la sortie, déduit de la profondeur aval — jamais choisi. */
export function etatSortie(tw, D) {
  if (tw >= D - TOLERANCE) return "noyée";
  return tw > TOLERANCE ? "partiellement noyée" : "libre";
}

/**
 * Contrôle à la sortie par l'équation d'énergie.
 *   pertes = (Ke + Ks)·V²/2g + J_f·L,   avec V la vitesse en section pleine
 *   sortie noyée  : HW = TW + pertes − J·L
 *   sinon         : h0 = max(TW, (y_c + D)/2) puis HW = h0 + pertes − J·L
 * La seconde forme est l'approximation FHWA : elle n'est valable que si le
 * résultat reste au-dessus de 0,75 D, faute de quoi il faut un calcul de remous.
 */
export function controleSortie(sec, q, K, L, J, tw, yc, Ke, Ks = 1.0) {
  const D = sec.hauteur;
  const V = q / sec.airePleine;
  const hv = (V * V) / (2 * G);
  const perteEntree = Ke * hv;
  const perteFrottement = penteFrottementPleine(sec, q, K) * L;
  const perteSortie = Ks * hv;
  const pertes = perteEntree + perteFrottement + perteSortie;
  const etat = etatSortie(tw, D);

  if (etat === "noyée") {
    return { HW: tw + pertes - J * L, methode: "énergie en pleine section",
             V, hv, perteEntree, perteFrottement, perteSortie, pertes, horsDomaine: false };
  }
  const h0 = Math.max(tw, (Math.min(yc, D) + D) / 2);
  const HW = Math.max(0, h0 + pertes - J * L);
  return { HW, h0, methode: "approximation FHWA",
           V, hv, perteEntree, perteFrottement, perteSortie, pertes,
           horsDomaine: HW < 0.75 * D - TOLERANCE };
}

// ── Chaîne complète ────────────────────────────────────────────────────────

/**
 * Calcul complet d'un ouvrage. `Q` est le débit TOTAL, réparti entre `cellules`.
 * Renvoie les deux niveaux amont, celui qui commande, et les grandeurs qui
 * servent au dimensionnement (vitesse, remplissage, revanche).
 */
export function calculerOuvrage({
  forme = "dalot", B = 2, D = 1.5, cellules = 1, Q, L = 12, J = 0.01,
  K = 70, entree, tw = 0, Ks = 1.0, KeForce = null, vitesseMax = 3.0,
}) {
  const ent = typeof entree === "string" ? entreePar(entree) : entree;
  if (!ent) return { erreur: "Entrée non choisie : aucun coefficient HDS-5 applicable." };
  if (ent.forme !== forme) return { erreur: `L'entrée « ${ent.libelle} » ne décrit pas un ${forme}.` };
  if (!(Q > 0 && D > 0 && L > 0 && K > 0 && (forme === "buse" || B > 0)))
    return { erreur: "Données incomplètes (Q, dimensions, L, K)." };

  const sec = forme === "buse" ? sectionCirculaire(D) : sectionRectangulaire(B, D);
  const n = Math.max(1, Math.round(cellules));
  const q = Q / n;

  const capacite = debitance(sec, sec.hauteur, K, J) ;
  const yn = profondeurNormale(sec, q, K, J);
  const capaciteDepassee = yn >= sec.hauteur - TOLERANCE;
  const V = q / sec.aire(Math.min(yn, sec.hauteur));
  const yc = sec.profondeurCritique(q);
  const ycEff = Math.min(yc, sec.hauteur);
  const Vc = q / sec.aire(ycEff);
  const energieCritique = ycEff + (Vc * Vc) / (2 * G);
  const Ic = penteCritique(sec, q, K);

  const Ke = KeForce ?? ent.Ke;
  const entreeC = controleEntree(sec, ent, q, J, energieCritique);
  const sortieC = controleSortie(sec, q, K, L, J, tw, ycEff, Ke, Ks);

  const HW = Math.max(entreeC.HW, sortieC.HW);
  const controle = entreeC.HW >= sortieC.HW ? "entrée" : "sortie";

  return {
    section: sec, entree: ent, q, cellules: n,
    capaciteParCellule: capacite, capaciteDepassee,
    profondeurNormale: yn, profondeurCritique: yc, energieCritique,
    vitesse: V, vitesseOk: V <= vitesseMax, penteCritique: Ic,
    penteSuperieureACritique: J > Ic,
    froude: froude(sec, Math.min(yn, sec.hauteur), q),
    regime: J > Ic ? "torrentiel" : "fluvial",
    remplissage: Math.min(yn, sec.hauteur) / sec.hauteur,
    etatSortie: etatSortie(tw, sec.hauteur),
    avalInfluence: tw > ycEff + TOLERANCE,
    entreeC, sortieC, Ke,
    HW, HWsurD: HW / sec.hauteur, controle,
  };
}
