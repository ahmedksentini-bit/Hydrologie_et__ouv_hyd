// Abaques de niveau amont en sortie libre — Nguyen Van Tuu, « La route et
// l'hydraulique », BCEOM 1979, figures 71 à 77.
//
// CE QUE CES ABAQUES SONT, ET CE QU'ILS NE SONT PAS
// Ils donnent une lecture graphique de la charge amont en sortie libre. Ce
// sont des CONTRE-ÉPREUVES : on les lit à côté du calcul HDS-5 du chapitre 6,
// jamais à sa place. Deux méthodes indépendantes qui se rejoignent valent
// mieux qu'une méthode raffinée toute seule ; quand elles divergent, c'est
// l'écart qui est l'information.
//
// DEUX RÈGLES NON NÉGOCIABLES
//  · interpolation linéaire en log₁₀(Q*) / log₁₀(H1*), comme sur le papier ;
//  · AUCUNE extrapolation — hors du domaine tracé, on ne lit rien et on dit
//    pourquoi. Prolonger une courbe relevée sur un scan ancien reviendrait à
//    inventer des points que l'auteur n'a jamais publiés.

export const G = 9.81;

/** Virgule décimale : ces motifs sont affichés tels quels. */
const vg = (x, d) => x.toFixed(d).replace(".", ",");

/**
 * Variable réduite du débit, par figure. Reprise mot pour mot des définitions
 * portées par le fichier de données — un test vérifie qu'elles n'ont pas dérivé.
 * Attention : les buses circulaires (71, 72, 73) n'emploient PAS la même
 * normalisation que l'arche et le dalot. Le rapport est 4/π ≈ 1,273 ; confondre
 * les deux décale la lecture d'un quart.
 */
export const DEBIT_REDUIT = {
  71: { formule: "Q / sqrt(2*g*D^5)", forme: "buse",
        calc: ({ Q, D }) => Q / Math.sqrt(2 * G * Math.pow(D, 5)) },
  72: { formule: "Q / sqrt(2*g*D^5)", forme: "buse",
        calc: ({ Q, D }) => Q / Math.sqrt(2 * G * Math.pow(D, 5)) },
  73: { formule: "Q / sqrt(2*g*D^5)", forme: "buse",
        calc: ({ Q, D }) => Q / Math.sqrt(2 * G * Math.pow(D, 5)) },
  75: { formule: "Q / (A*sqrt(2*g*D))", forme: "arche",
        calc: ({ Q, D, A }) => Q / (A * Math.sqrt(2 * G * D)) },
  77: { formule: "Q / (B*D*sqrt(2*g*D))", forme: "dalot",
        calc: ({ Q, D, B }) => Q / (B * D * Math.sqrt(2 * G * D)) },
};

/** Charge un jeu d'abaques (le fichier de données du cours). */
export function preparer(donnees) {
  const parFigure = new Map();
  for (const a of donnees.abaques) parFigure.set(a.figure, a);
  return { ...donnees, parFigure };
}

/**
 * Lecture d'une courbe : H1* pour un Q* donné, par interpolation linéaire en
 * log₁₀/log₁₀. Renvoie `null` avec un motif hors du domaine tracé.
 */
export function lireCourbe(courbe, qReduit) {
  const pts = courbe.points;
  const qMin = pts[0][0], qMax = pts[pts.length - 1][0];
  if (!(qReduit > 0))
    return { valeur: null, motif: "débit réduit nul ou négatif" };
  const bornes = `${vg(qMin, 2)} à ${vg(qMax, 2)}`;
  if (qReduit < qMin)
    return { valeur: null, motif: `Q* = ${vg(qReduit, 4)} sous le domaine tracé `
      + `(${bornes}) — l'abaque ne descend pas plus bas, et on n'extrapole pas` };
  if (qReduit > qMax)
    return { valeur: null, motif: `Q* = ${vg(qReduit, 4)} au-dessus du domaine tracé `
      + `(${bornes}) — l'ouvrage est trop chargé pour cette planche` };

  for (let i = 1; i < pts.length; i++) {
    if (qReduit <= pts[i][0] + 1e-12) {
      const [q0, h0] = pts[i - 1], [q1, h1] = pts[i];
      if (q1 === q0) return { valeur: h1, motif: null };
      const t = (Math.log10(qReduit) - Math.log10(q0)) / (Math.log10(q1) - Math.log10(q0));
      const h = Math.pow(10, Math.log10(h0) + t * (Math.log10(h1) - Math.log10(h0)));
      return { valeur: h, motif: null };
    }
  }
  return { valeur: pts[pts.length - 1][1], motif: null };
}

/**
 * Lecture complète : géométrie → Q* → H1* → H1. `geom` porte Q, D et selon la
 * figure B (dalot) ou A (arche).
 */
export function lireAbaque(abaque, idCourbe, geom) {
  const def = DEBIT_REDUIT[abaque.figure];
  if (!def) return { erreur: `figure ${abaque.figure} sans variable réduite définie` };
  const courbe = abaque.courbes.find((c) => c.id === idCourbe) || abaque.courbes[0];
  if (!(geom.D > 0 && geom.Q > 0)) return { erreur: "débit et hauteur à renseigner" };
  if (def.forme === "dalot" && !(geom.B > 0)) return { erreur: "largeur du dalot à renseigner" };
  if (def.forme === "arche" && !(geom.A > 0)) return { erreur: "section de l'arche à renseigner" };

  const qReduit = def.calc(geom);
  const { valeur, motif } = lireCourbe(courbe, qReduit);
  return {
    figure: abaque.figure, courbe, qReduit, formule: def.formule,
    h1Reduit: valeur, motif,
    H1: valeur === null ? null : valeur * geom.D,
    incertitude: abaque.incertitude, qualite: abaque.qualite,
  };
}

/** Écart relatif entre deux charges, en pourcentage — pour la contre-épreuve. */
export const ecartRelatif = (a, b) =>
  Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? ((a - b) / b) * 100 : NaN;
