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
 * Plancher géométrique de l'indice de compacité : le disque minimise le
 * périmètre à surface donnée, donc Ic ≥ 2/√π / … = 1,128. Une valeur inférieure
 * n'est pas un bassin très ramassé, c'est une mesure fausse.
 */
export const IC_MINIMUM = 1.128;

/**
 * Rectangle équivalent : même surface et même indice de compacité que le bassin.
 * Renvoie { Ic, L, l } en km, et `quasiCirculaire` quand Ic descend sous le
 * plancher géométrique — le rectangle dégénère alors en carré et le contrôle
 * L × l = S n'est plus vérifié : c'est le signe qu'il faut reprendre le tracé.
 */
export function rectangleEquivalent(S, P) {
  const Ic = gravelius(P, S);
  if (!(Ic > 0)) return { Ic: 0, L: 0, l: 0, quasiCirculaire: false };
  const brut = 1 - Math.pow(IC_MINIMUM / Ic, 2);
  const quasiCirculaire = brut <= 0;
  const f = (Ic * Math.sqrt(S)) / IC_MINIMUM;
  const r = Math.sqrt(Math.max(0, brut));
  return { Ic, L: f * (1 + r), l: f * (1 - r), quasiCirculaire };
}

/**
 * Densité de drainage : Dd = longueur totale du réseau / surface, en km/km².
 * Elle dépend de l'échelle de la carte sur laquelle le réseau a été relevé :
 * la valeur ne vaut rien sans l'échelle qui l'accompagne.
 */
export const densiteDrainage = (longueurTotaleKm, S) =>
  S > 0 ? longueurTotaleKm / S : 0;

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

// ── Ajustement statistique des pluies (loi de Gumbel) ──────────────────────

/**
 * Ajustement d'une série de maxima annuels par la loi de Gumbel, méthode des
 * moments : gradex a = σ√6/π, mode u = μ − 0,5772·a.
 * `serie` est la liste des maxima annuels, dans n'importe quel ordre.
 * L'écart-type est celui de l'ÉCHANTILLON (dénominateur n − 1).
 */
export function ajustementGumbel(serie) {
  const x = (serie || []).filter((v) => Number.isFinite(v));
  const n = x.length;
  if (n < 2) return null;
  const moyenne = x.reduce((a, v) => a + v, 0) / n;
  const ecartType = Math.sqrt(x.reduce((a, v) => a + (v - moyenne) ** 2, 0) / (n - 1));
  const gradex = (ecartType * Math.sqrt(6)) / Math.PI;
  return { n, moyenne, ecartType, gradex, mode: moyenne - 0.5772 * gradex };
}

/** Quantile de période de retour T : x_T = u + a · y_T. */
export const quantileGumbel = (ajust, T) =>
  ajust && T > 1 ? ajust.mode + ajust.gradex * gumbel(T) : 0;

/** Période de retour d'une valeur observée, d'après l'ajustement. */
export function periodeRetourDe(ajust, x) {
  if (!ajust || !(ajust.gradex > 0)) return 0;
  const y = (x - ajust.mode) / ajust.gradex;
  const F = Math.exp(-Math.exp(-y));
  return F >= 1 ? Infinity : 1 / (1 - F);
}

/**
 * Position de tracage d'une valeur de rang `rang` (1 = la plus forte) dans une
 * série de n valeurs : fréquence au non-dépassement.
 *   Weibull (défaut) : F = 1 − rang/(n+1)   ·   Hazen : F = 1 − (rang − 0,5)/n
 * Les points empiriques ainsi placés servent à juger l'ajustement à l'œil.
 */
export const positionTracage = (rang, n, methode = "weibull") =>
  methode === "hazen" ? 1 - (rang - 0.5) / n : 1 - rang / (n + 1);

/** Variable réduite correspondant à une fréquence au non-dépassement. */
export const variableReduite = (F) => -Math.log(-Math.log(F));

/**
 * Coefficient d'abattement spatial du bulletin FAO n° 54 (équation 1.9) :
 *   A = 1 − [(161 − 0,042·P_an)/1000] · log₁₀(S)
 * Il ramène une pluie PONCTUELLE à sa moyenne sur le bassin. Le jeu tunisien ne
 * l'applique pas : l'effet de surface y est porté par S^0,75 chez SOGREAH et par
 * S dans la méthode rationnelle. Ne pas cumuler les deux.
 */
export const coefficientAbattement = (Pan, S) =>
  S > 0 ? 1 - ((161 - 0.042 * Pan) / 1000) * Math.log10(S) : 1;

/** SOGREAH — pluie de projet interpolée en variable de Gumbel entre P10 et P100. */
export function sogreahPluie(T, P10, P100) {
  if (T <= 10) return P10;
  if (T >= 100) return P100;
  return P10 + ((gumbel(T) - 2.25) / (4.6 - 2.25)) * (P100 - P10);
}

/**
 * SOGREAH — Q = S^0,75 · (P_T − P0) / 12.
 * Borné à zéro : sous le seuil de ruissellement, il n'y a pas de débit négatif,
 * il n'y a pas de ruissellement. Le cas se rencontre réellement dans le Sud
 * saharien, où P0 = 50 mm dépasse la pluie journalière décennale de 40 mm.
 */
export const sogreahDebit = (S, PT, P0) =>
  PT > P0 ? (Math.pow(S, 0.75) * (PT - P0)) / 12 : 0;

/**
 * Le seuil est-il atteint ? À dire explicitement plutôt que de laisser un zéro
 * se confondre avec une case vide.
 */
export const sogreahRuisselle = (PT, P0) => PT > P0
  ? { ruisselle: true, motif: null }
  : { ruisselle: false,
      motif: `pluie de projet ${PT.toFixed(1).replace(".", ",")} mm sous le seuil de `
        + `ruissellement ${P0.toFixed(0)} mm : la formule ne produit aucun débit à cette `
        + `période de retour` };

/**
 * Ghorbel zones I à III — P en MÈTRES (pluie annuelle / 1000), Δh en m, L en km.
 * Δh = altitude médiane du bassin − altitude au franchissement.
 */
export const ghorbelQmax123 = (S, Pm, dh, L, Ic) =>
  L > 0 && Ic > 0 ? Math.pow(S, 0.8) * ((1.075 * Math.sqrt((Pm * dh) / L)) / Ic - 0.232) : 0;

/**
 * Ghorbel zones IV et V — seule la surface intervient, sous un logarithme NÉPÉRIEN
 * (publication d'origine). La notation « log(S) » qu'on rencontre souvent n'oblige à rien :
 * entre `ln` et `log10` l'écart est un facteur ln(10) ≈ 2,30. Le paramètre `base` n'existe
 * que pour chiffrer cette erreur — tout appel de production le laisse à sa valeur.
 */
export const ghorbelQmax45 = (S, base = "ln") =>
  S > 0 ? 85 * (base === "log10" ? Math.log10(S) : Math.log(S)) : 0;

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

/**
 * Risque de dépassement : probabilité qu'un débit de période de retour T soit
 * atteint ou dépassé au moins une fois pendant n années.
 *   R = 1 − (1 − 1/T)^n
 * Une période de retour n'est pas une garantie : à T = 50 ans sur 30 ans de vie,
 * le risque vaut encore 45 %.
 */
export const risqueDepassement = (T, n) =>
  T > 0 && n > 0 ? 1 - Math.pow(1 - 1 / T, n) : 0;

/**
 * Période de retour pour un risque accepté sur n années — réciproque de la
 * précédente : T = 1 / (1 − (1 − R)^(1/n)).
 */
export const periodePourRisque = (R, n) =>
  R > 0 && R < 1 && n > 0 ? 1 / (1 - Math.pow(1 - R, 1 / n)) : 0;

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

// ── Domaines de validité ───────────────────────────────────────────────────
// Les bornes ne coïncident jamais d'une méthode à l'autre, et c'est le piège :
// on croit comparer sept estimations alors que trois seulement sont dans leur
// domaine. Elles sont déclarées ICI, en un seul endroit, pour que le tableau
// du cours, la figure du chapitre 4 et l'exerciseur ne puissent pas diverger.
//
// Sources : les manuels d'origine, tels que repris dans l'aide-mémoire du
// cours. Une borne inconnue s'écrit null, jamais Infinity déguisé en règle.

export const DOMAINES = {
  rationnelle: {
    nom: "Rationnelle", surface: { max: 4 },
    motifSurface: "au-delà, l'hypothèse de pluie uniforme sur tout le bassin tombe",
    zone: false, periodes: null,
  },
  sogreah: {
    nom: "SOGREAH", pluieAnnuelle: { max: 500 }, periodes: { min: 10, max: 100 },
    motifPluie: "méthode calée sur les régions à pluie annuelle modérée",
    motifPeriode: "P_T s'interpole entre P₁₀ et P₁₀₀ : hors de cet intervalle, on extrapole",
    zone: false, condition: "P_T doit dépasser P₀, sinon il n'y a pas de ruissellement",
  },
  ghorbel: {
    nom: "Ghorbel", zone: true, periodes: [2, 5, 10, 20, 50, 100],
    note: "la zone V est peu testée : résultat indicatif",
  },
  kallel: {
    nom: "Kallel", surface: { min: 100 }, zone: true, periodes: "analytique",
    motifSurface: "calée sur les grands bassins",
  },
  fersi: {
    nom: "Fersi", pluieAnnuelle: { max: 400 }, zone: true, periodes: [5, 10, 20, 50, 100],
    motifPluie: "méthode calée sur les bassins du Sud",
  },
  frigui: {
    nom: "Frigui", zone: true, periodes: [2, 5, 10, 50],
    note: "ni 20, ni 30, ni 100 ans : la note DGPC ne tombe jamais dans cette table",
  },
  francou: {
    nom: "Francou–Rodier", surface: { min: 100 }, zone: true, periodes: null,
    enveloppe: true,
    motifSurface: "enveloppe des crues observées : en dessous, l'extrapolation n'a pas de sens",
  },
};

/**
 * Une méthode est-elle dans son domaine ici ? Renvoie la liste des motifs de
 * refus — vide si elle s'applique. Le pluriel compte : une méthode peut être
 * hors domaine pour deux raisons à la fois, et ne le dire qu'à moitié induit
 * en erreur sur ce qu'il faudrait changer.
 */
export function motifsHorsDomaine(id, { S, Pan, T, zone } = {}) {
  const d = DOMAINES[id];
  if (!d) return [`méthode inconnue : ${id}`];
  const motifs = [];
  if (d.zone && !zone) motifs.push("hors zone : aucune région retenue");
  if (d.surface?.max != null && S != null && S >= d.surface.max)
    motifs.push(`S ≥ ${d.surface.max} km² — ${d.motifSurface}`);
  if (d.surface?.min != null && S != null && S < d.surface.min)
    motifs.push(`S < ${d.surface.min} km² — ${d.motifSurface}`);
  if (d.pluieAnnuelle?.max != null && Pan != null && Pan > d.pluieAnnuelle.max)
    motifs.push(`pluie annuelle > ${d.pluieAnnuelle.max} mm — ${d.motifPluie}`);
  if (Array.isArray(d.periodes) && T != null && !d.periodes.includes(T))
    motifs.push(`T = ${T} ans hors table (calages : ${d.periodes.join(", ")} ans)`);
  if (d.periodes && !Array.isArray(d.periodes) && d.periodes !== "analytique" && T != null) {
    if (T < d.periodes.min || T > d.periodes.max)
      motifs.push(`T = ${T} ans hors de ${d.periodes.min}–${d.periodes.max} ans — ${d.motifPeriode}`);
  }
  return motifs;
}

/** Résumé lisible d'un domaine, pour un tableau. */
export function resumeDomaine(id) {
  const d = DOMAINES[id];
  const bouts = [];
  if (d.surface?.max != null) bouts.push(`S < ${d.surface.max} km²`);
  if (d.surface?.min != null) bouts.push(`S ≥ ${d.surface.min} km²`);
  if (d.pluieAnnuelle?.max != null) bouts.push(`pluie annuelle ≤ ${d.pluieAnnuelle.max} mm`);
  if (Array.isArray(d.periodes)) bouts.push(`T ∈ {${d.periodes.join(", ")}} ans`);
  else if (d.periodes === "analytique") bouts.push("tout T (analytique)");
  else if (d.periodes) bouts.push(`T de ${d.periodes.min} à ${d.periodes.max} ans`);
  if (d.zone) bouts.push("zone à choisir");
  return bouts.length ? bouts.join(" · ") : "aucune borne annoncée";
}
