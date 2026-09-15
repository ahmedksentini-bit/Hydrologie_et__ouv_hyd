// Ajustement de séries hydrologiques : plusieurs lois, l'incertitude qui va
// avec, et les trois questions qu'il faut poser AVANT d'ajustir quoi que ce soit.
//
// L'ordre compte. Un ajustement suppose que la série soit stationnaire,
// indépendante et homogène. Ces trois hypothèses se testent ; elles ne se
// postulent pas. Une série qui les met en défaut peut encore s'ajuster
// techniquement — le résultat n'aura simplement plus le sens qu'on lui prête.
import { phiInv, phi, gammaFn, moments, lMoments, studentInv, alea,
         quantileEmpirique, pBilaterale } from "./stats-numerique.js";

/** Virgule décimale : ces résumés s'affichent tels quels. */
const vg = (x, d) => x.toFixed(d).replace(".", ",").replace("-", "\u2212");

/** Fréquence au non-dépassement associée à une période de retour. */
export const frequenceDe = (T) => 1 - 1 / T;
/** Variable réduite de Gumbel. */
export const yGumbel = (T) => -Math.log(-Math.log(frequenceDe(T)));

// ── Les lois ───────────────────────────────────────────────────────────────

/** Gumbel par les moments : a = σ√6/π, u = μ − 0,5772·a. */
function ajusterGumbel(serie) {
  const m = moments(serie);
  if (!m) return null;
  const a = (m.ecartType * Math.sqrt(6)) / Math.PI;
  const u = m.moyenne - 0.5772156649 * a;
  return { params: { u, a }, resume: `u = ${vg(u, 2)} · a = ${vg(a, 2)}`,
           quantile: (T) => u + a * yGumbel(T), moments: m };
}

/** Log-normale (Galton) : loi normale sur ln(x). */
function ajusterGalton(serie) {
  const x = serie.filter((v) => v > 0);
  if (x.length < 2) return null;
  const m = moments(x.map(Math.log));
  if (!m) return null;
  const { moyenne: mu, ecartType: sigma } = m;
  return { params: { mu, sigma },
           resume: `μ(ln x) = ${vg(mu, 3)} · σ(ln x) = ${vg(sigma, 3)}`,
           quantile: (T) => Math.exp(mu + sigma * phiInv(frequenceDe(T))) };
}

/**
 * GEV par les L-moments (algorithme de Hosking).
 * CONVENTION DE SIGNE : ici k > 0 borne la queue supérieure (type III) et
 * k < 0 l'alourdit (type II, Fréchet). La convention inverse (ξ = −k) est tout
 * aussi répandue — une valeur de forme ne se recopie jamais sans sa convention.
 */
function ajusterGev(serie) {
  const L = lMoments(serie);
  if (!L || !(L.l2 > 0)) return null;
  const c = 2 / (3 + L.t3) - Math.log(2) / Math.log(3);
  const k = 7.8590 * c + 2.9554 * c * c;
  let alpha, xi;
  if (Math.abs(k) < 1e-6) {                          // dégénère en Gumbel
    alpha = L.l2 / Math.log(2);
    xi = L.l1 - 0.5772156649 * alpha;
  } else {
    const g = gammaFn(1 + k);
    alpha = (L.l2 * k) / ((1 - Math.pow(2, -k)) * g);
    xi = L.l1 - (alpha * (1 - g)) / k;
  }
  const quantile = (T) => {
    const y = -Math.log(frequenceDe(T));
    return Math.abs(k) < 1e-6 ? xi - alpha * Math.log(y)
                              : xi + (alpha * (1 - Math.pow(y, k))) / k;
  };
  return { params: { xi, alpha, k },
           resume: `ξ = ${vg(xi, 2)} · α = ${vg(alpha, 2)} · k = ${vg(k, 3)}`,
           quantile, lMoments: L };
}

/** Pearson III par le facteur de fréquence de Wilson-Hilferty. */
function ajusterPearson3(serie) {
  const m = moments(serie);
  if (!m) return null;
  const Cs = m.asymetrie;
  const K = (T) => {
    const z = phiInv(frequenceDe(T));
    if (Math.abs(Cs) < 1e-8) return z;
    const k = Cs / 6;
    return (2 / Cs) * (Math.pow((z - k) * k + 1, 3) - 1);
  };
  return { params: { moyenne: m.moyenne, ecartType: m.ecartType, Cs },
           resume: `μ = ${vg(m.moyenne, 1)} · σ = ${vg(m.ecartType, 1)} · Cs = ${vg(Cs, 3)}`,
           quantile: (T) => m.moyenne + K(T) * m.ecartType,
           horsDomaine: Math.abs(Cs) > 2,
           moments: m };
}

/** Exponentielle à deux paramètres, par les moments : x_T = x₀ + b·ln T. */
function ajusterExponentielle(serie) {
  const m = moments(serie);
  if (!m) return null;
  const b = m.ecartType, x0 = m.moyenne - m.ecartType;
  return { params: { x0, b }, resume: `x₀ = ${vg(x0, 2)} · b = ${vg(b, 2)}`,
           quantile: (T) => x0 + b * Math.log(T) };
}

export const LOIS = [
  { id: "gumbel", nom: "Gumbel", methode: "moments", ajuster: ajusterGumbel,
    note: "la référence en climat méditerranéen et semi-aride ; droite sur papier de Gumbel" },
  { id: "gev", nom: "GEV", methode: "L-moments", ajuster: ajusterGev,
    note: "généralise Gumbel avec un paramètre de forme k, estimé par les L-moments" },
  { id: "galton", nom: "Log-normale", methode: "moments sur ln x", ajuster: ajusterGalton,
    note: "loi de Galton : normale sur les logarithmes ; courbe, jamais droite, sur papier de Gumbel" },
  { id: "pearson3", nom: "Pearson III", methode: "moments + Wilson-Hilferty", ajuster: ajusterPearson3,
    note: "ajoute l'asymétrie observée ; l'approximation perd sa validité au-delà de |Cs| = 2" },
  { id: "exponentielle", nom: "Exponentielle", methode: "moments", ajuster: ajusterExponentielle,
    note: "cas limite à un seul paramètre d'échelle ; utile comme borne de comparaison" },
];

export const loiPar = (id) => LOIS.find((l) => l.id === id) || null;

/** Ajuste une série par une loi et renvoie l'objet d'ajustement enrichi. */
export function ajuster(idLoi, serie) {
  const loi = loiPar(idLoi);
  if (!loi) return null;
  const a = loi.ajuster(serie);
  return a ? { ...a, id: loi.id, nom: loi.nom, methode: loi.methode, n: serie.length } : null;
}

// ── Position de tracage et qualité de l'ajustement ─────────────────────────

/** Fréquence empirique au non-dépassement du rang i (1 = la plus FAIBLE). */
export const frequenceEmpirique = (i, n, methode = "weibull") =>
  methode === "hazen" ? (i - 0.5) / n
  : methode === "cunnane" ? (i - 0.4) / (n + 0.2)
  : i / (n + 1);

/**
 * Écart de Kolmogorov-Smirnov entre l'échantillon et la loi ajustée.
 * AVERTISSEMENT : les paramètres étant estimés sur l'échantillon lui-même, la
 * valeur critique 1,36/√n est OPTIMISTE — elle vaut pour une loi entièrement
 * spécifiée d'avance. À lire comme un classement entre lois, pas comme un
 * verdict d'acceptation.
 */
export function ecartKs(serie, ajustement, methode = "weibull") {
  const x = serie.filter(Number.isFinite).sort((a, b) => a - b);
  const n = x.length;
  if (!n || !ajustement) return null;
  let D = 0, ou = 0;
  for (let i = 1; i <= n; i++) {
    const F = frequenceTheorique(ajustement, x[i - 1]);
    const ecart = Math.max(Math.abs(i / n - F), Math.abs(F - (i - 1) / n));
    if (ecart > D) { D = ecart; ou = x[i - 1]; }
  }
  return { D, ou, critique5: 1.36 / Math.sqrt(n), n };
}

/** Fréquence théorique d'une valeur, par inversion numérique du quantile. */
export function frequenceTheorique(ajustement, x) {
  let lo = 1.0000001, hi = 1e9;                      // recherche sur T
  if (ajustement.quantile(lo) >= x) return 0;
  if (ajustement.quantile(hi) <= x) return 1;
  for (let i = 0; i < 200; i++) {
    const mid = Math.sqrt(lo * hi);                  // dichotomie en échelle log
    if (ajustement.quantile(mid) < x) lo = mid; else hi = mid;
  }
  return frequenceDe(Math.sqrt(lo * hi));
}

/** Écart quadratique moyen entre points empiriques et loi, en unité de la série. */
export function ecartQuadratique(serie, ajustement, methode = "weibull") {
  const x = serie.filter(Number.isFinite).sort((a, b) => a - b);
  const n = x.length;
  if (!n) return null;
  let s = 0;
  for (let i = 1; i <= n; i++) {
    const T = 1 / (1 - frequenceEmpirique(i, n, methode));
    s += (x[i - 1] - ajustement.quantile(T)) ** 2;
  }
  return Math.sqrt(s / n);
}

// ── Incertitude sur le quantile ────────────────────────────────────────────

/**
 * Intervalle de confiance analytique du quantile de Gumbel (formule de Kite) :
 *   S_e = (σ/√n)·√(1 + 1,1396·K + 1,1·K²),  K = (y_T − 0,5772)·√6/π
 * puis x_T ± t_{n−1} · S_e. Ne vaut QUE pour Gumbel ajusté par les moments.
 */
export function intervalleGumbel(serie, T, niveau = 0.95) {
  const m = moments(serie);
  if (!m || !(T > 1)) return null;
  const K = ((yGumbel(T) - 0.5772156649) * Math.sqrt(6)) / Math.PI;
  const delta = Math.sqrt(1 + 1.1396 * K + 1.1 * K * K);
  const se = (m.ecartType / Math.sqrt(m.n)) * delta;
  const t = studentInv(1 - (1 - niveau) / 2, m.n - 1);
  const xT = ajusterGumbel(serie).quantile(T);
  return { xT, se, delta, K, t, bas: xT - t * se, haut: xT + t * se, niveau, methode: "Kite" };
}

/**
 * Intervalle par rééchantillonnage (bootstrap) : on retire B échantillons de
 * même taille avec remise, on réajuste à chaque fois, et on lit les percentiles
 * des quantiles obtenus. Applicable à TOUTE loi, au prix du calcul.
 * Le tirage est déterministe : la même série donne le même intervalle.
 */
export function intervalleBootstrap(serie, idLoi, T, { B = 600, niveau = 0.95, graine = 20240101 } = {}) {
  const x = serie.filter(Number.isFinite);
  const n = x.length;
  if (n < 3 || !(T > 1)) return null;
  const hasard = alea(graine);
  const tirages = [];
  for (let b = 0; b < B; b++) {
    const ech = Array.from({ length: n }, () => x[Math.floor(hasard() * n)]);
    const a = ajuster(idLoi, ech);
    const q = a?.quantile(T);
    if (Number.isFinite(q)) tirages.push(q);
  }
  if (tirages.length < B / 2) return null;
  const alpha = (1 - niveau) / 2;
  const base = ajuster(idLoi, x);
  return { xT: base.quantile(T), B: tirages.length, niveau,
           bas: quantileEmpirique(tirages, alpha),
           haut: quantileEmpirique(tirages, 1 - alpha),
           median: quantileEmpirique(tirages, 0.5), methode: "bootstrap" };
}

/**
 * Bande de confiance sur toute une gamme de périodes de retour.
 * Le rééchantillonnage n'est fait QU'UNE FOIS : chaque échantillon tiré sert à
 * évaluer toutes les périodes, au lieu de refaire B ajustements par point.
 */
export function bandeBootstrap(serie, idLoi, listeT, { B = 400, niveau = 0.95, graine = 20240101 } = {}) {
  const x = serie.filter(Number.isFinite);
  const n = x.length;
  if (n < 3) return null;
  const hasard = alea(graine);
  const colonnes = listeT.map(() => []);
  for (let b = 0; b < B; b++) {
    const ech = Array.from({ length: n }, () => x[Math.floor(hasard() * n)]);
    const a = ajuster(idLoi, ech);
    if (!a) continue;
    listeT.forEach((T, i) => {
      const q = a.quantile(T);
      if (Number.isFinite(q)) colonnes[i].push(q);
    });
  }
  const alpha = (1 - niveau) / 2;
  const base = ajuster(idLoi, x);
  return listeT.map((T, i) => ({
    T, xT: base.quantile(T),
    bas: quantileEmpirique(colonnes[i], alpha),
    haut: quantileEmpirique(colonnes[i], 1 - alpha),
  }));
}

/** Bande de confiance analytique de Gumbel, même signature. */
export const bandeGumbel = (serie, listeT, niveau = 0.95) =>
  listeT.map((T) => {
    const ic = intervalleGumbel(serie, T, niveau);
    return { T, xT: ic.xT, bas: ic.bas, haut: ic.haut };
  });

// ── Les trois hypothèses, testées ──────────────────────────────────────────

/** Rangs moyens (les ex æquo partagent le rang moyen). */
function rangs(x) {
  const ordre = x.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(x.length);
  let i = 0;
  while (i < ordre.length) {
    let j = i;
    while (j + 1 < ordre.length && ordre[j + 1][0] === ordre[i][0]) j++;
    const moyen = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[ordre[k][1]] = moyen;
    i = j + 1;
  }
  return r;
}

const verdict = (p, seuil = 0.05) => p >= seuil ? "hypothèse conservée" : "hypothèse rejetée";

/**
 * STATIONNARITÉ — test de Mann-Kendall sur la tendance, plus la pente de Sen.
 * S = ΣΣ signe(x_j − x_i) ; sous H₀ (pas de tendance) S est centré.
 * Le test est non paramétrique : il ne suppose aucune loi, et résiste aux
 * valeurs extrêmes — ce qui est exactement la situation d'une série de maxima.
 */
export function mannKendall(serie, seuil = 0.05) {
  const x = serie.filter(Number.isFinite), n = x.length;
  if (n < 4) return null;
  let S = 0;
  for (let i = 0; i < n - 1; i++)
    for (let j = i + 1; j < n; j++) S += Math.sign(x[j] - x[i]);

  const comptes = new Map();
  for (const v of x) comptes.set(v, (comptes.get(v) || 0) + 1);
  let correction = 0;
  for (const t of comptes.values()) if (t > 1) correction += t * (t - 1) * (2 * t + 5);
  const variance = (n * (n - 1) * (2 * n + 5) - correction) / 18;
  const Z = S > 0 ? (S - 1) / Math.sqrt(variance)
          : S < 0 ? (S + 1) / Math.sqrt(variance) : 0;

  const pentes = [];
  for (let i = 0; i < n - 1; i++)
    for (let j = i + 1; j < n; j++) pentes.push((x[j] - x[i]) / (j - i));
  const sen = quantileEmpirique(pentes, 0.5);

  const p = pBilaterale(Z);
  return { test: "Mann-Kendall", hypothese: "stationnarité (absence de tendance)",
           n, S, variance, Z, p, sen, seuil, verdict: verdict(p, seuil),
           sens: p < seuil ? (S > 0 ? "tendance à la hausse" : "tendance à la baisse") : "aucune tendance décelée" };
}

/**
 * INDÉPENDANCE — test de Wald-Wolfowitz sur l'autocorrélation d'ordre 1.
 * R = Σ x_i·x_{i+1} + x_1·x_n, comparé à son espérance sous permutation
 * aléatoire de la série. L'ORDRE CHRONOLOGIQUE est donc essentiel : ce test
 * n'a aucun sens sur une série qu'on a triée.
 */
export function waldWolfowitz(serie, seuil = 0.05) {
  const x = serie.filter(Number.isFinite), n = x.length;
  if (n < 4) return null;
  let R = x[0] * x[n - 1];
  for (let i = 0; i < n - 1; i++) R += x[i] * x[i + 1];
  const s = [1, 2, 3, 4].map((r) => x.reduce((a, v) => a + Math.pow(v, r), 0));
  const [s1, s2, s3, s4] = s;
  const esperance = (s1 * s1 - s2) / (n - 1);
  const variance = (s2 * s2 - s4) / (n - 1) - esperance * esperance
    + (Math.pow(s1, 4) - 4 * s1 * s1 * s2 + 4 * s1 * s3 + s2 * s2 - 2 * s4)
      / ((n - 1) * (n - 2));
  const u = (R - esperance) / Math.sqrt(variance);
  const p = pBilaterale(u);
  return { test: "Wald-Wolfowitz", hypothese: "indépendance des valeurs successives",
           n, R, esperance, variance, u, p, seuil, verdict: verdict(p, seuil) };
}

/**
 * HOMOGÉNÉITÉ — test de Wilcoxon-Mann-Whitney entre les deux moitiés de la
 * série. Détecte un décalage de niveau entre le début et la fin de la période
 * d'observation : changement de site du poste, d'appareil, d'observateur.
 */
export function wilcoxon(serie, seuil = 0.05) {
  const x = serie.filter(Number.isFinite), n = x.length;
  if (n < 8) return null;
  const coupe = Math.floor(n / 2);
  const n1 = coupe, n2 = n - coupe;
  const r = rangs(x);
  const W = r.slice(0, coupe).reduce((a, v) => a + v, 0);
  const esperance = (n1 * (n + 1)) / 2;

  const comptes = new Map();
  for (const v of x) comptes.set(v, (comptes.get(v) || 0) + 1);
  let correction = 0;
  for (const t of comptes.values()) if (t > 1) correction += t * t * t - t;
  const variance = ((n1 * n2) / 12) * (n + 1 - correction / (n * (n - 1)));
  const u = (W - esperance) / Math.sqrt(variance);
  const p = pBilaterale(u);
  return { test: "Wilcoxon-Mann-Whitney", hypothese: "homogénéité des deux moitiés",
           n, n1, n2, W, esperance, variance, u, p, seuil, verdict: verdict(p, seuil) };
}

/**
 * HOMOGÉNÉITÉ, variante — test de Pettitt : cherche une RUPTURE sans en fixer
 * la date à l'avance, là où Wilcoxon coupe au milieu par convention.
 * U_t = 2·Σ(rangs jusqu'à t) − t(n+1) ; K = max|U_t| ; p ≈ 2·exp(−6K²/(n³+n²)).
 */
export function pettitt(serie, seuil = 0.05) {
  const x = serie.filter(Number.isFinite), n = x.length;
  if (n < 8) return null;
  const r = rangs(x);
  let cumul = 0, K = 0, tau = 0, signe = 0;
  for (let t = 1; t <= n; t++) {
    cumul += r[t - 1];
    const U = 2 * cumul - t * (n + 1);
    if (Math.abs(U) > K) { K = Math.abs(U); tau = t; signe = Math.sign(U); }
  }
  const p = Math.min(1, 2 * Math.exp((-6 * K * K) / (n * n * n + n * n)));
  return { test: "Pettitt", hypothese: "absence de rupture", n, K, tau, p, seuil,
           verdict: verdict(p, seuil),
           sens: p < seuil ? (signe < 0 ? "niveau plus élevé après la rupture"
                                        : "niveau plus faible après la rupture") : "aucune rupture décelée" };
}

/** Les trois hypothèses d'un coup, dans l'ordre où elles se posent. */
export function controlerSerie(serie, seuil = 0.05) {
  const essais = [mannKendall(serie, seuil), waldWolfowitz(serie, seuil),
                  wilcoxon(serie, seuil), pettitt(serie, seuil)].filter(Boolean);
  return { essais, toutesConservees: essais.every((e) => e.p >= seuil), seuil };
}
