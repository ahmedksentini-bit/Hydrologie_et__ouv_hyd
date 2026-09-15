// L'averse de démonstration du chapitre 3, et ce qu'on en tire.
//
// Séparée de la figure parce qu'elle se vérifie : 48 mm en 24 h dont 30 en une
// demi-heure, soit une moyenne de 2 mm/h et une pointe de 60 — un facteur 30
// entre ce que rapporte un pluviomètre et ce que rapporte un pluviographe.
// Ce chiffre est affiché dans le cours ; il doit donc être recalculable.

// Averse de 48 mm sur 24 h, dont 30 en une demi-heure : [début, fin, mm/h].
export const AVERSE = [
  [0, 6, 0], [6, 9, 1.0], [9, 10.5, 0], [10.5, 11, 60], [11, 14, 3.0], [14, 24, 0.6],
];
export const DUREE = 24;

export function intensite(t) {
  for (const [a, b, i] of AVERSE) if (t >= a && t < b) return i;
  return 0;
}

/** Cumul depuis le début, en mm. */
export function cumul(t) {
  let s = 0;
  for (const [a, b, i] of AVERSE) {
    if (t <= a) break;
    s += i * (Math.min(t, b) - a);
  }
  return s;
}

/** Intensité maximale sur une fenêtre glissante, en mm/h. */
export function intensiteMax(dureeHeures, pas = 1 / 120) {
  let best = 0;
  for (let t = 0; t <= DUREE - dureeHeures + 1e-9; t += pas)
    best = Math.max(best, (cumul(t + dureeHeures) - cumul(t)) / dureeHeures);
  return best;
}

// ── Un enregistrement au pas de cinq minutes ───────────────────────────────
// L'averse ci-dessus est décrite par paliers : elle suffit à opposer les deux
// instruments, mais son orage est un rectangle, et un rectangle donne la même
// intensité maximale sur 5, 15 et 30 minutes. Pour montrer d'où vient la
// DÉCROISSANCE de la courbe IDF, il faut un orage qui ait une pointe — c'est
// ce que donne un vrai pluviographe.
//
// Enregistrement synthétique mais structuré : 24 h au pas de 5 minutes, corps
// d'averse modéré, et une pointe brève au milieu.

export const PAS_FIN = 5 / 60;                    // heures
export const N_PAS = Math.round(DUREE / PAS_FIN); // 288 pas

/** Hauteur tombée pendant le pas k (mm), k de 0 à 287. */
function pasEnregistrement(k) {
  const t = k * PAS_FIN;                          // heure du début du pas
  let i = 0;                                      // mm/h
  if (t >= 6 && t < 9) i = 1.2;                   // pluie d'approche
  else if (t >= 9.5 && t < 10.5) i = 3.5;         // le corps s'installe
  else if (t >= 10.5 && t < 11.5) {
    // La pointe : montée rapide, sommet bref, décrue plus lente.
    const u = (t - 10.5) / 1.0;
    i = u < 0.28 ? 20 + (150 - 20) * (u / 0.28)
      : 150 * Math.exp(-3.1 * (u - 0.28));
  } else if (t >= 11.5 && t < 14) i = 6.5;        // traîne
  else if (t >= 14 && t < 19) i = 1.6;
  else if (t >= 19 && t < 22) i = 0.6;
  return i * PAS_FIN;
}

export const ENREGISTREMENT = Array.from({ length: N_PAS }, (_, k) => pasEnregistrement(k));

/** Hauteur cumulée sur une fenêtre de `n` pas commençant au pas `k`. */
export const hauteurFenetre = (debut, n) => {
  let s = 0;
  for (let k = debut; k < debut + n && k < N_PAS; k++) s += ENREGISTREMENT[k];
  return s;
};

/**
 * Fenêtre glissante : la position et la hauteur du MAXIMUM pour une durée
 * donnée, et toute la suite des hauteurs balayées — c'est ce balayage que
 * l'animation rejoue.
 */
export function balayage(dureeHeures) {
  const n = Math.max(1, Math.round(dureeHeures / PAS_FIN));
  const hauteurs = [];
  let max = -1, ou = 0;
  for (let k = 0; k + n <= N_PAS; k++) {
    const hgt = hauteurFenetre(k, n);
    hauteurs.push(hgt);
    if (hgt > max) { max = hgt; ou = k; }
  }
  return { n, hauteurs, hauteur: max, debut: ou, intensite: max / dureeHeures };
}

/** Les durées auxquelles on lit une courbe IDF, en minutes. */
export const DUREES_IDF = [5, 10, 15, 30, 60, 120, 240, 360, 720, 1440];

/** Le point (durée, intensité maximale) pour chaque durée. */
export const courbeIdf = () => DUREES_IDF.map((min) => {
  const b = balayage(min / 60);
  return { min, intensite: b.intensite, hauteur: b.hauteur, debut: b.debut, n: b.n };
});

/** Ajustement de Montana i = a·t^(−b) sur les points, par moindres carrés en log. */
export function ajusterMontana(points = courbeIdf()) {
  const n = points.length;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const p of points) {
    const x = Math.log(p.min), y = Math.log(p.intensite);
    sx += x; sy += y; sxx += x * x; sxy += x * y;
  }
  const b = -(n * sxy - sx * sy) / (n * sxx - sx * sx);
  const a = Math.exp((sy + b * sx) / n);
  // Coefficient de détermination, en log.
  const moy = sy / n;
  let sct = 0, scr = 0;
  for (const p of points) {
    const y = Math.log(p.intensite), yc = Math.log(a) - b * Math.log(p.min);
    sct += (y - moy) ** 2; scr += (y - yc) ** 2;
  }
  return { a, b, r2: 1 - scr / sct };
}
