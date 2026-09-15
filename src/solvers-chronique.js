// Une chronique journalière de vingt ans, d'où sortent les maxima annuels.
//
// Le chapitre part de la série des maxima sans jamais montrer d'où elle vient.
// Or ce qu'on jette en la construisant est considérable : sur 7 305 jours, on
// en garde vingt. Ce module fabrique la chronique correspondante — saisons
// humides en grappes, étés vides, un maximum par an — de façon DÉTERMINISTE,
// et surtout de façon à ce que ses maxima annuels soient EXACTEMENT la série
// que le calculateur ajuste. Les deux figures parlent donc du même poste.
//
// Le régime est celui du nord tunisien : pluies d'octobre à mars, averses les
// plus fortes en automne, juillet quasiment sec.
import { alea } from "./stats-numerique.js";

/** Longueur des mois, année non bissextile — la chronique n'en a pas besoin. */
export const MOIS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const NOMS_MOIS = ["jan", "fév", "mar", "avr", "mai", "juin",
                          "juil", "août", "sep", "oct", "nov", "déc"];
export const JOURS_AN = 365;

/** Probabilité qu'il pleuve, et hauteur moyenne d'un jour pluvieux (mm). */
const P_MOIS = [0.22, 0.20, 0.16, 0.14, 0.08, 0.03, 0.01, 0.02, 0.09, 0.14, 0.18, 0.22];
const H_MOIS = [6, 6, 6, 6, 5, 4, 3, 5, 10, 11, 9, 7];

/** Mois d'un jour de l'année (0 = 1er janvier). */
export function moisDe(jour) {
  let j = jour % JOURS_AN;
  for (let m = 0; m < 12; m++) { if (j < MOIS[m]) return m; j -= MOIS[m]; }
  return 11;
}

/**
 * Chronique de `maxima.length` années.
 *
 * Chaque année est tirée puis ÉCRÊTÉE à 75 % du maximum imposé, avant qu'on
 * y pose ce maximum sur un jour d'automne ou d'hiver. Sans cet écrêtage, un
 * tirage pourrait dépasser la valeur imposée et le « maximum annuel » de la
 * figure ne serait plus celui de la série ajustée — l'ensemble du propos
 * tomberait.
 */
export function chronique(maxima, graine = 20240211) {
  const r = alea(graine);
  const jours = [];
  const repere = [];
  for (const [an, maxAn] of maxima.entries()) {
    const annee = new Array(JOURS_AN).fill(0);
    for (let j = 0; j < JOURS_AN; j++) {
      const m = moisDe(j);
      if (r() < P_MOIS[m]) {
        // Loi exponentielle : beaucoup de petites pluies, quelques fortes.
        const h = -H_MOIS[m] * Math.log(1 - r() * 0.999);
        annee[j] = Math.min(Math.round(h * 10) / 10, maxAn * 0.75);
      }
    }
    // Le maximum tombe en saison humide, de septembre à mars.
    const fenetre = [];
    for (let j = 0; j < JOURS_AN; j++) {
      const m = moisDe(j);
      if (m >= 8 || m <= 2) fenetre.push(j);
    }
    const jMax = fenetre[Math.floor(r() * fenetre.length)];
    annee[jMax] = maxAn;
    repere.push({ an, jour: an * JOURS_AN + jMax, jourAn: jMax, valeur: maxAn });
    jours.push(...annee);
  }
  return { jours, maxima: repere, annees: maxima.length };
}

/** Ce que la chronique dit, et que la série des maxima ne dit plus. */
export function statistiques(c) {
  const n = c.jours.length;
  const pluvieux = c.jours.filter((v) => v > 0).length;
  const total = c.jours.reduce((a, v) => a + v, 0);
  // Pour chaque jour de l'année, en combien d'années sur vingt a-t-il plu ?
  const profil = new Array(JOURS_AN).fill(0);
  for (let j = 0; j < n; j++) if (c.jours[j] > 0) profil[j % JOURS_AN]++;
  const jamais = profil.filter((v) => v === 0).length;
  return {
    jours: n, pluvieux, secs: n - pluvieux,
    partSecs: (n - pluvieux) / n,
    totalAnnuel: total / c.annees,
    profil, jamais,
    retenus: c.maxima.length,
    partRetenue: c.maxima.length / n,
  };
}
