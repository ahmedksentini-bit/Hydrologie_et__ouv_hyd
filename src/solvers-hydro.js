// Solveurs d'hydrologie — méthodes tunisiennes.
// Fonctions pures, sans dépendance : utilisables par l'exerciseur, le cours
// interactif et les tests. Unités indiquées formule par formule.

// ── Tables régionales ───────────────────────────────────────────────────────

/** Rapports de fréquence de Ghorbel, par zone puis par période de retour. */
export const GHORBEL_R = {
  I:   { 2: 0.86, 5: 1.39, 10: 1.79, 20: 2.19, 50: 2.72, 100: 3.12 },
  II:  { 2: 0.70, 5: 1.33, 10: 1.98, 20: 2.84, 50: 4.40, 100: 6.04 },
  III: { 2: 0.59, 5: 1.45, 10: 2.34, 20: 3.52, 50: 5.68, 100: 7.93 },
  IV:  { 2: 0.50, 5: 1.60, 10: 2.50, 20: 3.50, 50: 5.10, 100: 6.20 },
  V:   { 2: 0.30, 5: 1.00, 10: 2.20, 20: 3.70, 50: 6.70, 100: 9.20 },
};

export const GHORBEL_ZONES = {
  I:   "Extrême nord",
  II:  "Rive droite Mejerda, Cap-Bon, Zeroud amont",
  III: "Meliane, Merguellil, nord Zeroud",
  IV:  "Sahel",
  V:   "Sud",
};

/** Coefficients de fréquence de Fersi, par secteur. Pas de T = 2 ans. */
export const FERSI_Y = {
  SudEst:   { 5: 1.28,  10: 2.22,  20: 3.82,  50: 6.59,  100: 10.2 },
  SudOuest: { 5: 1.145, 10: 2.068, 20: 3.507, 50: 6.808, 100: 10.337 },
};

/** Frigui : Am et n par région, λ calé pour 2, 5, 10 et 50 ans seulement. */
export const FRIGUI = {
  Nord:          { Am: 26.2, n: 0.47, lambda: { 2: 0.20, 5: 0.34, 10: 0.45, 50: 0.80 } },
  Medjerda:      { Am: 53.5, n: 0.53, lambda: { 2: 0.15, 5: 0.27, 10: 0.38, 50: 0.78 } },
  CapBonMeliane: { Am: 38.4, n: 0.44, lambda: { 2: 0.10, 5: 0.22, 10: 0.35, 50: 0.77 } },
  CentreSud:     { Am: 76.7, n: 0.44, lambda: { 2: 0.08, 5: 0.21, 10: 0.33, 50: 0.74 } },
};

/** Kallel : q0 et α par région. Le Centre-Sahel change de q0 au-delà de 20 ans. */
export const KALLEL = {
  NordCapBon:     { q0: 5.5,  alpha: 0.5 },
  NoyauDorsale:   { q0: 2.6,  alpha: 0.8 },
  CentreSahel:    { q0: null, alpha: 0.5 },   // 14,3 si T ≤ 20 ans, 24,7 au-delà
  SudEstSudOuest: { q0: 12.35, alpha: 0.5 },
};

/** Francou–Rodier : K régionaux usuels en Tunisie. */
export const FRANCOU_K = {
  NordMedjerda:    { K: 3.8, label: "Nord / Medjerda (~100 ans)" },
  NordIchkeul:     { K: 4.0, label: "Nord / Ichkeul centennale" },
  NordCatastrophe: { K: 4.5, label: "Nord catastrophe (indicatif)" },
  CentreDorsale:   { K: 4.8, label: "Centre dorsale (~50–100 ans)" },
  Zeroud:          { K: 5.6, label: "Zéroud / Sidi Saad (fort)" },
  Sud50:           { K: 4.3, label: "Sud / Centre-Sud (~50 ans)" },
  Sud100:          { K: 5.0, label: "Sud / Centre-Sud (~100–200 ans)" },
};

// ── Morphométrie ────────────────────────────────────────────────────────────

/** Indice de compacité de Gravelius : Ic = P / (2√(πS)) — P km, S km². */
export const gravelius = (P, S) => (S > 0 ? P / (2 * Math.sqrt(Math.PI * S)) : 0);

/**
 * Rectangle équivalent : même surface et même indice de compacité que le bassin.
 * Renvoie { L, l } en km. Contrôle : L × l = S.
 */
export function rectangleEquivalent(S, P) {
  const Ic = gravelius(P, S);
  if (!(Ic > 0)) return { Ic: 0, L: 0, l: 0 };
  const disc = Math.max(0, 1 - Math.pow(1.128 / Ic, 2));
  const f = (Ic * Math.sqrt(S)) / 1.128;
  const r = Math.sqrt(disc);
  return { Ic, L: f * (1 + r), l: f * (1 - r) };
}

/** Indice global de pente : Ig = (H5% − H95%) / L_rectangle — en m/km. */
export const indiceGlobalPente = (H5, H95, Lrect) => (Lrect > 0 ? (H5 - H95) / Lrect : 0);

// ── Temps de concentration ──────────────────────────────────────────────────
// Kirpich et Ventura rendent des MINUTES, Passini et Giandotti des HEURES.

/** Kirpich (min) — L et D en mètres. */
export const kirpich = (Lm, Dm) =>
  Lm > 0 && Dm > 0 ? 0.0195 * Math.pow(Math.pow(Lm, 3) / Dm, 0.385) : 0;

/** Ventura (min) — S km², i en % (= cm/m). */
export const ventura = (S, iPct) =>
  S > 0 && iPct > 0 ? 76 * Math.sqrt(S / iPct) : 0;

/** Passini (h) — S km², L km, i en %. */
export const passini = (S, L, iPct) =>
  S > 0 && L > 0 && iPct > 0 ? (0.108 * Math.cbrt(S * L)) / Math.sqrt(iPct / 100) : 0;

/** Giandotti (h) — Hmoy = altitude moyenne − altitude minimale, en m. */
export const giandotti = (S, L, Hmoy) =>
  S > 0 && L > 0 && Hmoy > 0
    ? (4 * Math.sqrt(S) + 1.5 * L) / (0.8 * Math.sqrt(Hmoy))
    : 0;

/** Les quatre formules, ramenées aux minutes. */
export function tempsConcentration({ S, L, D, iPct, Hmoy }) {
  const passiniH = passini(S, L, iPct);
  const giandottiH = giandotti(S, L, Hmoy);
  return {
    kirpich: kirpich(L * 1000, D),
    ventura: ventura(S, iPct),
    passini: passiniH * 60,
    giandotti: giandottiH * 60,
    passiniHeures: passiniH,
    giandottiHeures: giandottiH,
  };
}

// ── Intensité de pluie ──────────────────────────────────────────────────────

/**
 * Montana : i = a · t^(−b) · T^c — i en mm/h, t en MINUTES, T en années.
 * `c` est l'exposant de la période de retour, sans dimension : à ne pas
 * confondre avec le décalage de durée de la variante i = a/(t+c)^b.
 */
export const montana = (a, b, c, tMin, T) =>
  tMin > 0 && T > 0 ? a * Math.pow(tMin, -b) * Math.pow(T, c) : 0;

/** Durée réellement injectée : jamais sous la plus petite durée calée. */
export const dureeEffective = (tcMin, tMinTable = 5) =>
  tcMin > 0 ? Math.max(tcMin, tMinTable) : 0;

// ── Coefficient de ruissellement (abaque pente × végétation) ───────────────

export const CLASSES_PENTE = { faible: [0, 2], moyenne: [2, 8], forte: [8, Infinity] };

/** Indice de végétation : > 50 % ⇒ 1 · 30 à 50 % ⇒ 2 · < 30 % ⇒ 3. */
export function indiceVegetation(couverturePct) {
  if (!(couverturePct >= 0 && couverturePct <= 100)) return null;
  if (couverturePct > 50) return 1;
  return couverturePct >= 30 ? 2 : 3;
}

/** C lu dans l'abaque. Renvoie null si l'une des deux entrées manque. */
export function coefficientRuissellement(pentePct, couverturePct) {
  const iv = indiceVegetation(couverturePct);
  if (iv === null || !(pentePct > 0)) return null;
  const forte = pentePct > 8;
  const ligne = forte ? [0.50, 0.60, 0.70] : [0.40, 0.50, 0.60];
  return {
    C: ligne[iv - 1],
    indiceVegetation: iv,
    classePente: pentePct < 2 ? "faible" : forte ? "forte" : "moyenne",
  };
}

// ── Méthodes de calcul du débit ─────────────────────────────────────────────

/** Méthode rationnelle : Q = 0,278·C·i·S — i mm/h, S km². Domaine S < 4 km². */
export const rationnelle = (C, iMmH, S) => 0.278 * C * iMmH * S;

/** Variable réduite de Gumbel. */
export const gumbel = (T) => -Math.log(-Math.log(1 - 1 / T));

/** SOGREAH — pluie de projet interpolée en variable de Gumbel entre P10 et P100. */
export function sogreahPluie(T, P10, P100) {
  if (T <= 10) return P10;
  if (T >= 100) return P100;
  return P10 + ((gumbel(T) - 2.25) / (4.6 - 2.25)) * (P100 - P10);
}

/** SOGREAH — Q = S^0,75 · (P_T − P0) / 12. */
export const sogreahDebit = (S, PT, P0) => (Math.pow(S, 0.75) * (PT - P0)) / 12;

/**
 * Ghorbel zones I à III — P en MÈTRES (pluie annuelle / 1000), Δh en m, L en km.
 * Δh = altitude médiane du bassin − altitude au franchissement.
 */
export const ghorbelQmax123 = (S, Pm, dh, L, Ic) =>
  L > 0 && Ic > 0 ? Math.pow(S, 0.8) * ((1.075 * Math.sqrt((Pm * dh) / L)) / Ic - 0.232) : 0;

/**
 * Ghorbel zones IV et V — seule la surface intervient.
 * La base du logarithme doit être celle de la publication d'origine :
 * entre `ln` et `log10` l'écart est un facteur ln(10) ≈ 2,30.
 */
export const ghorbelQmax45 = (S, base = "log10") =>
  S > 0 ? 85 * (base === "ln" ? Math.log(S) : Math.log10(S)) : 0;

/** Kallel : Q = q0 · S^α · T^0,41. */
export function kallel(region, S, T) {
  const r = KALLEL[region];
  if (!r || !(S > 0) || !(T > 0)) return 0;
  const q0 = region === "CentreSahel" ? (T <= 20 ? 14.3 : 24.7) : r.q0;
  return q0 * Math.pow(S, r.alpha) * Math.pow(T, 0.41);
}

/** Fersi, étape 1 : écoulement annuel moyen (mm) — P mm/an, Ig m/km. */
export const fersiEcoulement = (Pan, Ig) => (Ig > 0 ? 0.01639 * Pan * Math.sqrt(Ig) : 0);

/** Fersi, étape 2 : débit maximum annuel moyen (m³/s). */
export function fersiQxMoyen(Hemoy, S) {
  if (!(S > 0)) return 0;
  const terme = S < 1 ? Math.log10(S + 2) : S < 2 ? Math.log10(S + 1) : Math.log10(S);
  return 0.266 * Hemoy * Math.sqrt(S) * terme;
}

/** Fersi, étape 3 : passage à la période de retour. */
export const fersiQx = (QxMoy, S, Ig, yT) =>
  S > 0 && Ig > 0 ? yT * Math.pow((S * Ig) / 270, -0.423) * QxMoy : 0;

/** Frigui : Q = λ · Am / (S+1)^n · S. */
export function frigui(region, S, T) {
  const r = FRIGUI[region];
  if (!r) return null;
  const lambda = r.lambda[T];
  if (lambda === undefined) return null;      // période non calée
  return (lambda * r.Am * S) / Math.pow(S + 1, r.n);
}

/** Francou–Rodier : Q = 10⁶ · (S/10⁸)^(1 − K/10). Enveloppe, S ≥ 100 km². */
export const francouRodier = (S, K) =>
  S > 0 && K > 0 ? 1e6 * Math.pow(S / 1e8, 1 - K / 10) : 0;

// ── Synthèse ────────────────────────────────────────────────────────────────

/**
 * Min, médiane, max et coefficient de variation d'un jeu de débits.
 * N'y faire entrer que les méthodes réellement applicables : une valeur
 * calculée hors domaine n'est pas une estimation.
 */
export function synthese(valeurs) {
  const v = valeurs.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (!v.length) return null;
  const n = v.length;
  const mediane = n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
  const moyenne = v.reduce((a, x) => a + x, 0) / n;
  const ecartType = Math.sqrt(v.reduce((a, x) => a + (x - moyenne) ** 2, 0) / n);
  return {
    n, min: v[0], max: v[n - 1], mediane, moyenne, ecartType,
    cv: moyenne > 0 ? (ecartType / moyenne) * 100 : 0,
  };
}

/** Période de retour de projet — note circulaire DGPC N°1054/2019, §4. */
export function periodeRetour({ categorie, ouvrage, S, tjma = 0 }) {
  if (ouvrage === "submersible") return 100;
  if (categorie === "autoroute") return 100;
  if (categorie === "piste") return S >= 100 ? 100 : S >= 10 ? 50 : 30;
  if (ouvrage === "art") return 100;
  if (S >= 100 || tjma > 3300) return 100;
  if (tjma > 650) return 50;
  return S >= 10 ? 50 : 30;
}
