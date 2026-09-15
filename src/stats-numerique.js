// Noyau numérique des statistiques : fonctions spéciales et quantiles.
// Écrit une fois, vérifié contre des valeurs connues, réutilisé partout — un
// ajustement ne doit jamais dépendre d'une approximation improvisée sur place.

const LANCZOS = [
  676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012,
  9.9843695780195716e-6, 1.5056327351493116e-7,
];

/** ln Γ(x), approximation de Lanczos (g = 7, n = 9) — 15 chiffres significatifs. */
export function lnGamma(x) {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  x -= 1;
  let a = 0.99999999999980993;
  for (let i = 0; i < 8; i++) a += LANCZOS[i] / (x + i + 1);
  const t = x + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

export const gammaFn = (x) => x < 0.5
  ? Math.PI / (Math.sin(Math.PI * x) * Math.exp(lnGamma(1 - x)))
  : Math.exp(lnGamma(x));

/** Fonction gamma incomplète régularisée P(a,x), série et fraction continue. */
function gammaP(a, x) {
  if (x <= 0) return 0;
  if (x < a + 1) {                                   // développement en série
    let ap = a, somme = 1 / a, terme = somme;
    for (let i = 0; i < 400; i++) {
      ap += 1; terme *= x / ap; somme += terme;
      if (Math.abs(terme) < Math.abs(somme) * 1e-16) break;
    }
    return somme * Math.exp(-x + a * Math.log(x) - lnGamma(a));
  }
  // fraction continue de Lentz pour Q(a,x) = 1 − P(a,x)
  const min = Number.MIN_VALUE / 1e-14;
  let b = x + 1 - a, c = 1 / min, d = 1 / b, h = d;
  for (let i = 1; i < 400; i++) {
    const an = -i * (i - a);
    b += 2; d = an * d + b; if (Math.abs(d) < min) d = min;
    c = b + an / c; if (Math.abs(c) < min) c = min;
    d = 1 / d;
    const delta = d * c; h *= delta;
    if (Math.abs(delta - 1) < 1e-16) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h;
}

/** Fonction d'erreur, par la gamma incomplète : erf(x) = signe(x)·P(½, x²). */
export const erf = (x) => (x >= 0 ? 1 : -1) * gammaP(0.5, x * x);
export const erfc = (x) => 1 - erf(x);

/** Fonction de répartition de la loi normale centrée réduite. */
export const phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));

/** Densité de la loi normale centrée réduite. */
export const dphi = (z) => Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);

// Coefficients d'Acklam pour l'inverse de la loi normale.
const A = [-3.969683028665376e+1, 2.209460984245205e+2, -2.759285104469687e+2,
           1.383577518672690e+2, -3.066479806614716e+1, 2.506628277459239e+0];
const B = [-5.447609879822406e+1, 1.615858368580409e+2, -1.556989798598866e+2,
           6.680131188771972e+1, -1.328068155288572e+1];
const C = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e+0,
           -2.549732539343734e+0, 4.374664141464968e+0, 2.938163982698783e+0];
const D = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e+0,
           3.754408661907416e+0];

/**
 * Quantile de la loi normale centrée réduite : Φ⁻¹(p).
 * Approximation d'Acklam (1,15·10⁻⁹) suivie d'UNE correction de Halley, qui
 * ramène l'erreur au niveau de celle de Φ — soit la précision machine.
 */
export function phiInv(p) {
  if (!(p > 0 && p < 1)) return p <= 0 ? -Infinity : Infinity;
  const bas = 0.02425, haut = 1 - bas;
  let z;
  if (p < bas) {
    const q = Math.sqrt(-2 * Math.log(p));
    z = (((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5]) /
        ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1);
  } else if (p > haut) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    z = -(((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5]) /
         ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1);
  } else {
    const q = p - 0.5, r = q * q;
    z = (((((A[0] * r + A[1]) * r + A[2]) * r + A[3]) * r + A[4]) * r + A[5]) * q /
        (((((B[0] * r + B[1]) * r + B[2]) * r + B[3]) * r + B[4]) * r + 1);
  }
  const e = phi(z) - p, u = e / dphi(z);
  return z - u / (1 + 0.5 * z * u);                  // Halley
}

/** Fonction bêta incomplète régularisée I_x(a,b), fraction continue de Lentz. */
function betaI(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b)
    + a * Math.log(x) + b * Math.log(1 - x));
  if (x >= (a + 1) / (a + b + 2)) return 1 - betaI(b, a, 1 - x);
  const min = 1e-300;
  let c = 1, d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < min) d = min;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let num = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + num * d; if (Math.abs(d) < min) d = min;
    c = 1 + num / c; if (Math.abs(c) < min) c = min;
    d = 1 / d; h *= d * c;
    num = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + num * d; if (Math.abs(d) < min) d = min;
    c = 1 + num / c; if (Math.abs(c) < min) c = min;
    d = 1 / d;
    const delta = d * c; h *= delta;
    if (Math.abs(delta - 1) < 1e-15) break;
  }
  return (front * h) / a;
}

/** Fonction de répartition de la loi de Student à ν degrés de liberté. */
export function studentCdf(t, nu) {
  const x = nu / (nu + t * t);
  const p = 0.5 * betaI(nu / 2, 0.5, x);
  return t > 0 ? 1 - p : p;
}

/** Quantile de Student, par dichotomie sur une fonction monotone. */
export function studentInv(p, nu) {
  if (!(p > 0 && p < 1)) return p <= 0 ? -Infinity : Infinity;
  let lo = -200, hi = 200;
  for (let i = 0; i < 200; i++) {
    const mid = 0.5 * (lo + hi);
    if (studentCdf(mid, nu) < p) lo = mid; else hi = mid;
  }
  return 0.5 * (lo + hi);
}

/** Probabilité bilatérale associée à une statistique normale réduite. */
export const pBilaterale = (u) => 2 * (1 - phi(Math.abs(u)));

/**
 * Générateur pseudo-aléatoire déterministe (mulberry32). Un rééchantillonnage
 * doit être REPRODUCTIBLE : deux lectures de la même page donnent le même
 * intervalle, et un test peut le vérifier.
 */
export function alea(graine = 20240101) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Quantile empirique d'un échantillon, par interpolation linéaire des rangs. */
export function quantileEmpirique(echantillon, p) {
  const x = [...echantillon].sort((a, b) => a - b);
  if (!x.length) return NaN;
  const h = (x.length - 1) * p, i = Math.floor(h);
  return i + 1 < x.length ? x[i] + (h - i) * (x[i + 1] - x[i]) : x[x.length - 1];
}

/** Moments d'échantillon : moyenne, écart-type (n − 1) et coefficient d'asymétrie. */
export function moments(serie) {
  const x = serie.filter(Number.isFinite), n = x.length;
  if (n < 2) return null;
  const moyenne = x.reduce((a, v) => a + v, 0) / n;
  const m2 = x.reduce((a, v) => a + (v - moyenne) ** 2, 0);
  const ecartType = Math.sqrt(m2 / (n - 1));
  const m3 = x.reduce((a, v) => a + (v - moyenne) ** 3, 0);
  const asymetrie = n > 2 && ecartType > 0
    ? (n * m3) / ((n - 1) * (n - 2) * ecartType ** 3) : 0;
  return { n, moyenne, ecartType, asymetrie };
}

/**
 * L-moments d'échantillon (λ₁, λ₂, λ₃) et rapport t₃, estimateurs sans biais
 * de Hosking. Ils sont moins sensibles aux valeurs extrêmes que les moments
 * classiques — ce qui compte sur des séries de vingt à trente ans.
 */
export function lMoments(serie) {
  const x = serie.filter(Number.isFinite).sort((a, b) => a - b);
  const n = x.length;
  if (n < 3) return null;
  let b0 = 0, b1 = 0, b2 = 0;
  for (let j = 1; j <= n; j++) {
    b0 += x[j - 1];
    b1 += ((j - 1) / (n - 1)) * x[j - 1];
    b2 += (((j - 1) * (j - 2)) / ((n - 1) * (n - 2))) * x[j - 1];
  }
  b0 /= n; b1 /= n; b2 /= n;
  const l1 = b0, l2 = 2 * b1 - b0, l3 = 6 * b2 - 6 * b1 + b0;
  return { n, l1, l2, l3, t3: l2 !== 0 ? l3 / l2 : 0 };
}
