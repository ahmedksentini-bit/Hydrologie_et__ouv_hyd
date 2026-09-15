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
