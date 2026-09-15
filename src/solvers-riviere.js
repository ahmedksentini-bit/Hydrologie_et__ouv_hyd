// Hydraulique du lit naturel : ce qui produit le niveau aval du chapitre 6.
//
// Le chapitre 6 écrit que TW « vient soit d'une PHE connue, soit d'un CALCUL DU
// CHENAL RÉCEPTEUR ». Ce module fait ce calcul. Il sert aussi à ce que le
// chapitre 6 laisse de côté : jusqu'où remonte l'exhaussement à l'amont d'un
// ouvrage, et où se forme le ressaut à sa sortie.
//
// Un lit naturel n'est pas un canal : le lit mineur et le lit majeur n'ont ni
// la même profondeur ni la même rugosité, et les traiter d'un bloc surestime
// le débit. On calcule donc SOUS-SECTION PAR SOUS-SECTION.

export const G = 9.81;

/** Coefficients de Strickler usuels pour un lit naturel. Ce sont des ordres
 *  de grandeur : ils se déclarent, et le résultat y est très sensible. */
export const STRICKLER = [
  { id: "beton", nom: "Béton lisse", K: 75 },
  { id: "litSable", nom: "Lit sableux régulier", K: 35 },
  { id: "litGravier", nom: "Lit de graviers", K: 30 },
  { id: "litGalets", nom: "Lit de galets, berges nettes", K: 25 },
  { id: "litIrregulier", nom: "Lit irrégulier, quelques blocs", K: 20 },
  { id: "berges", nom: "Berges herbeuses", K: 18 },
  { id: "majeurCultive", nom: "Lit majeur cultivé", K: 14 },
  { id: "majeurBroussailles", nom: "Lit majeur broussailleux", K: 10 },
  { id: "majeurBoise", nom: "Lit majeur boisé", K: 7 },
];
export const kDe = (id) => (STRICKLER.find((s) => s.id === id) || { K: 20 }).K;

/**
 * Section en travers : une polyligne de points {x, z} de rive gauche à rive
 * droite, et une liste de sous-sections {x0, x1, strickler}. Les limites des
 * sous-sections sont des VERTICALES : elles ne comptent pas comme périmètre
 * mouillé, puisque l'eau y frotte contre l'eau et non contre le lit.
 */
export function sectionNaturelle(points, sousSections) {
  const p = [...points].sort((a, b) => a.x - b.x);
  return {
    points: p,
    sousSections,
    zMin: Math.min(...p.map((q) => q.z)),
    zMax: Math.max(...p.map((q) => q.z)),
    xMin: p[0].x, xMax: p[p.length - 1].x,
  };
}

/** Altitude du fond à l'abscisse x, par interpolation sur la polyligne. */
export function fondEn(section, x) {
  const p = section.points;
  if (x <= p[0].x) return p[0].z;
  if (x >= p[p.length - 1].x) return p[p.length - 1].z;
  for (let i = 1; i < p.length; i++) {
    if (x <= p[i].x) {
      const u = (x - p[i - 1].x) / (p[i].x - p[i - 1].x || 1);
      return p[i - 1].z + u * (p[i].z - p[i - 1].z);
    }
  }
  return p[p.length - 1].z;
}

/**
 * Aire, périmètre mouillé et largeur au miroir d'une TRANCHE [x0, x1] pour un
 * plan d'eau à la cote z. Le périmètre ne compte que le fond : les verticales
 * de séparation en sont exclues.
 */
export function trancheMouillee(section, x0, x1, z) {
  const bornes = [x0, ...section.points.map((q) => q.x).filter((x) => x > x0 && x < x1), x1];
  let aire = 0, perimetre = 0, miroir = 0;
  for (let i = 1; i < bornes.length; i++) {
    const xa = bornes[i - 1], xb = bornes[i];
    const za = fondEn(section, xa), zb = fondEn(section, xb);
    const ha = z - za, hb = z - zb;
    if (ha <= 0 && hb <= 0) continue;
    let xA = xa, xB = xb, hA = ha, hB = hb;
    if (ha <= 0 || hb <= 0) {
      // Le plan d'eau coupe le segment : on ne garde que la part mouillée.
      const u = ha / (ha - hb);
      const xc = xa + u * (xb - xa);
      if (ha > 0) { xB = xc; hB = 0; } else { xA = xc; hA = 0; }
    }
    const dx = xB - xA;
    if (dx <= 0) continue;
    aire += ((hA + hB) / 2) * dx;
    perimetre += Math.hypot(dx, hA - hB);
    miroir += dx;
  }
  return { aire, perimetre, miroir };
}

/**
 * Débit à la cote z, sous-section par sous-section (méthode des lits séparés).
 *
 *   Q = Σ K_i · A_i · R_i^(2/3) · √J
 *
 * Renvoie aussi le calcul FAUTIF qu'on rencontre souvent — un Strickler unique
 * pondéré appliqué à la section entière — pour pouvoir montrer l'écart.
 */
export function debitA(section, z, J) {
  if (!(J > 0)) return null;
  const lits = section.sousSections.map((s) => {
    const t = trancheMouillee(section, s.x0, s.x1, z);
    const R = t.perimetre > 0 ? t.aire / t.perimetre : 0;
    const K = kDe(s.strickler);
    const debitance = t.aire > 0 && R > 0 ? K * t.aire * Math.pow(R, 2 / 3) : 0;
    return { ...s, K, ...t, R, debitance, Q: debitance * Math.sqrt(J) };
  });
  const Q = lits.reduce((a, l) => a + l.Q, 0);
  const aire = lits.reduce((a, l) => a + l.aire, 0);
  const perimetre = lits.reduce((a, l) => a + l.perimetre, 0);
  const miroir = lits.reduce((a, l) => a + l.miroir, 0);

  // Le calcul d'un seul bloc : Strickler pondéré par le périmètre mouillé,
  // appliqué à l'aire et au rayon hydraulique de la section entière.
  const Kglobal = perimetre > 0
    ? lits.reduce((a, l) => a + l.K * l.perimetre, 0) / perimetre : 0;
  const Rglobal = perimetre > 0 ? aire / perimetre : 0;
  const Qbloc = aire > 0 && Rglobal > 0
    ? Kglobal * aire * Math.pow(Rglobal, 2 / 3) * Math.sqrt(J) : 0;

  return {
    z, Q, aire, perimetre, miroir, lits,
    vitesse: aire > 0 ? Q / aire : 0,
    froude: aire > 0 && miroir > 0 ? (Q / aire) / Math.sqrt((G * aire) / miroir) : 0,
    Qbloc, ecartBloc: Q > 0 ? Qbloc / Q - 1 : 0,
  };
}

/** Cote du plan d'eau qui fait passer Q en régime uniforme, par dichotomie. */
export function tirantNormal(section, Q, J, tol = 1e-6) {
  if (!(Q > 0 && J > 0)) return null;
  let lo = section.zMin, hi = section.zMax;
  if (debitA(section, hi, J).Q < Q) return null;          // déborde la section levée
  for (let i = 0; i < 200 && hi - lo > tol; i++) {
    const m = (lo + hi) / 2;
    if (debitA(section, m, J).Q < Q) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

/** Cote critique : Q²·T / (g·A³) = 1. */
export function coteCritique(section, Q, tol = 1e-6) {
  if (!(Q > 0)) return null;
  const f = (z) => {
    const t = section.sousSections.reduce((a, s) => {
      const u = trancheMouillee(section, s.x0, s.x1, z);
      return { aire: a.aire + u.aire, miroir: a.miroir + u.miroir };
    }, { aire: 0, miroir: 0 });
    if (t.aire <= 0 || t.miroir <= 0) return -1;
    return (Q * Q * t.miroir) / (G * Math.pow(t.aire, 3)) - 1;
  };
  let lo = section.zMin + 1e-9, hi = section.zMax;
  if (f(hi) > 0) return null;
  for (let i = 0; i < 200 && hi - lo > tol; i++) {
    const m = (lo + hi) / 2;
    if (f(m) > 0) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

/** Courbe de tarage : la cote du plan d'eau pour une série de débits. */
export const courbeTarage = (section, J, debits) =>
  debits.map((Q) => {
    const z = tirantNormal(section, Q, J);
    return { Q, z, ...(z === null ? {} : debitA(section, z, J)) };
  });

// ── Régime graduellement varié : le remous ─────────────────────────────────
// À l'amont d'un ouvrage, le plan d'eau est relevé ; il rejoint le tirant
// normal en s'en approchant asymptotiquement. La question de projet n'est pas
// « de combien » à l'ouvrage — le chapitre 6 le donne — mais « jusqu'où » :
// c'est cette longueur qui dit quelles parcelles sont touchées.
//
// Méthode des tronçons, remontée depuis l'aval. Entre deux sections distantes
// de Δx, on écrit la conservation de l'énergie :
//
//   z₂ + V₂²/2g = z₁ + V₁²/2g + J_f · Δx
//
// avec J_f la pente de frottement moyenne, tirée de la débitance : J_f = (Q/K)².
// Le lit est supposé PRISMATIQUE — même forme d'un bout à l'autre. Sur un oued
// réel il ne l'est pas, et c'est la première limite de ce calcul.

const etat = (section, h, J) => {
  const z = section.zMin + h;
  const d = debitA(section, z, 1);                 // débitance : J = 1 pour l'isoler
  return d;
};

/**
 * Ligne d'eau à l'amont, pas à pas.
 * `hAval` est la profondeur imposée à l'aval (au-dessus du fond de la section).
 */
export function remous(section, { Q, J, hAval, pas = 25, longueur = 3000 }) {
  if (!(Q > 0 && J > 0 && hAval > 0)) return null;
  const hn = (tirantNormal(section, Q, J) ?? section.zMin) - section.zMin;
  const carac = (h) => {
    const d = debitA(section, section.zMin + h, 1);
    const K = d.lits.reduce((a, l) => a + l.debitance, 0);
    const A = d.aire, T = d.miroir;
    const V = A > 0 ? Q / A : 0;
    return { h, A, T, V, K,
             Jf: K > 0 ? Math.pow(Q / K, 2) : Infinity,
             charge: V * V / (2 * G),
             Fr: A > 0 && T > 0 ? V / Math.sqrt((G * A) / T) : 0 };
  };

  const points = [];
  let h = hAval, x = 0;
  points.push({ x: 0, ...carac(h), zFond: 0, z: h });
  for (let i = 1; i * pas <= longueur; i++) {
    const aval = carac(h);
    // Le fond monte de J·Δx vers l'amont : on cherche la profondeur amont qui
    // équilibre l'énergie. Bissection sur h, bornée par le tirant normal.
    const f = (h2) => {
      const am = carac(h2);
      return (J * pas + h2 + am.charge) - (h + aval.charge + ((aval.Jf + am.Jf) / 2) * pas);
    };
    let lo = Math.min(h, hn) * 0.5, hi = Math.max(h, hn) * 1.5 + 0.5;
    if (f(lo) * f(hi) > 0) break;
    for (let k = 0; k < 80; k++) {
      const m = (lo + hi) / 2;
      if (f(lo) * f(m) <= 0) hi = m; else lo = m;
    }
    h = (lo + hi) / 2;
    x = i * pas;
    points.push({ x, ...carac(h), zFond: J * x, z: J * x + h });
    if (Math.abs(h - hn) < 0.01) break;             // rejoint le tirant normal
  }
  const dernier = points[points.length - 1];
  return {
    points, hNormal: hn,
    portee: dernier.x,
    rejointNormal: Math.abs(dernier.h - hn) < 0.011,
    exhaussement: points[0].h - hn,
  };
}

// ── Ressaut hydraulique ────────────────────────────────────────────────────

/**
 * Profondeur conjuguée de Bélanger, perte de charge et longueur.
 *
 *   y₂ = (y₁/2)·(√(1 + 8·Fr₁²) − 1)      ΔE = (y₂ − y₁)³ / (4·y₁·y₂)
 *
 * La longueur n'est pas une formule exacte : les guides donnent 5 à 7 fois
 * (y₂ − y₁) selon l'auteur et le nombre de Froude. On retient 6, et on le dit.
 */
export function ressaut(y1, Fr1) {
  if (!(y1 > 0 && Fr1 > 0)) return null;
  if (Fr1 <= 1) return { possible: false, motif: "l'écoulement amont est déjà fluvial : pas de ressaut" };
  const y2 = (y1 / 2) * (Math.sqrt(1 + 8 * Fr1 * Fr1) - 1);
  const perte = Math.pow(y2 - y1, 3) / (4 * y1 * y2);
  return {
    possible: true, y1, Fr1, y2, perte,
    longueur: 6 * (y2 - y1),
    // Classification usuelle, qui commande le type de bassin de dissipation.
    type: Fr1 < 1.7 ? "ondulé" : Fr1 < 2.5 ? "faible" : Fr1 < 4.5 ? "oscillant"
        : Fr1 < 9 ? "stable" : "fort",
  };
}

/**
 * Où se place le ressaut à la sortie d'un ouvrage : on compare la conjuguée
 * du jet sortant au niveau aval imposé.
 */
export function positionRessaut(y1, Fr1, hAval) {
  const r = ressaut(y1, Fr1);
  if (!r?.possible) return { ...r, position: "aucun" };
  if (hAval >= r.y2 * 1.02)
    return { ...r, position: "noyé",
      note: "le niveau aval dépasse la conjuguée : le ressaut est repoussé sur la sortie et se noie" };
  if (hAval <= r.y2 * 0.98)
    return { ...r, position: "rejeté",
      note: "le niveau aval est trop bas : le ressaut part vers l'aval, hors de la protection" };
  return { ...r, position: "en place", note: "le ressaut se forme au droit de la sortie" };
}
