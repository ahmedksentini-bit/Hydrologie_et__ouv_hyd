// Le temps de concentration, pris par sa définition et non par une formule.
//
// tc est le temps que met la goutte hydrauliquement la PLUS ÉLOIGNÉE pour
// atteindre l'exutoire. Les formules du chapitre — Kirpich, Ventura, Passini,
// Giandotti — sont des ajustements empiriques de cette durée. Ce module la
// calcule autrement : en faisant réellement cheminer l'eau sur le bassin de
// démonstration, à deux vitesses.
//
//   sur les versants, jusqu'au premier talweg : V_versant (ruissellement diffus)
//   dans le réseau, du talweg à l'exutoire   : V_reseau  (écoulement concentré)
//
// Deux vitesses, c'est le modèle le plus simple qui ne soit pas faux : une
// seule vitesse ferait arriver l'eau des crêtes aussi vite que celle du lit.
// Le résultat n'est pas « le » tc — il dépend des deux vitesses choisies — mais
// il montre d'où vient la notion, et pourquoi elle borne la durée de l'averse
// de projet.

/** Vitesses usuelles (m/s). Elles se déclarent : elles commandent le résultat. */
export const VITESSES = { versant: 0.30, reseau: 1.20 };

const clef = (x, y) => x * 4096 + y;

/** Point dans un polygone, par lancer de rayon. */
function dansPolygone(x, y, poly) {
  let dedans = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}

/**
 * Temps de parcours de chaque maille du bassin jusqu'à l'exutoire.
 *
 * Renvoie une carte des temps (en minutes), le temps de concentration, et la
 * courbe surface–temps : la surface qui contribue à l'instant t.
 */
export function tempsDeParcours(bassin, vitesses = VITESSES) {
  const { nx, ny, pas } = bassin.grille;           // pas en km
  const pasM = pas * 1000;
  const [xe, ye] = bassin.exutoire;

  // ── 1. Le réseau est un arbre orienté : chaque nœud a un successeur, et
  // en le suivant on tombe sur l'exutoire. On remonte donc les distances
  // depuis l'exutoire, une seule fois par nœud.
  const suivant = new Map();
  for (const [x1, y1, x2, y2] of bassin.reseau) suivant.set(clef(x1, y1), [x2, y2]);
  const distReseau = new Map();                    // en mètres, le long du réseau
  const longueur = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1) * pasM;
  const resoudre = (x, y) => {
    const chemin = [];
    let cx = x, cy = y;
    while (!distReseau.has(clef(cx, cy))) {
      if (cx === xe && cy === ye) { distReseau.set(clef(cx, cy), 0); break; }
      const s = suivant.get(clef(cx, cy));
      if (!s) { distReseau.set(clef(cx, cy), Infinity); break; }
      chemin.push([cx, cy, s]);
      [cx, cy] = s;
    }
    for (let i = chemin.length - 1; i >= 0; i--) {
      const [ax, ay, [bx, by]] = chemin[i];
      distReseau.set(clef(ax, ay), distReseau.get(clef(bx, by)) + longueur(ax, ay, bx, by));
    }
  };
  for (const [x1, y1] of bassin.reseau) resoudre(x1, y1);
  resoudre(xe, ye);

  // ── 2. Chaque maille du bassin rejoint le nœud de réseau le plus proche.
  // Une transformée de distance multi-source suffit : on part de tous les
  // nœuds à la fois et on propage en huit connexités.
  const INF = Infinity;
  const tempsVersant = new Float64Array(nx * ny).fill(INF);
  const tMin = new Float64Array(nx * ny).fill(INF);
  const file = [];
  for (const [c, d] of distReseau) {
    if (!Number.isFinite(d)) continue;
    const x = Math.floor(c / 4096), y = c % 4096;
    if (x < 0 || x >= nx || y < 0 || y >= ny) continue;
    const i = y * nx + x;
    tempsVersant[i] = 0;
    tMin[i] = (d / vitesses.reseau) / 60;          // minutes, par le réseau seul
    file.push(i);
  }
  const dxs = [1, -1, 0, 0, 1, 1, -1, -1], dys = [0, 0, 1, -1, 1, -1, 1, -1];
  // Propagation par vagues : le coût d'un pas est constant à diagonale près,
  // ce qui suffit à une distance de versant sur une grille régulière.
  for (let tete = 0; tete < file.length; tete++) {
    const i = file[tete], x = i % nx, y = (i - (i % nx)) / nx;
    for (let k = 0; k < 8; k++) {
      const nx2 = x + dxs[k], ny2 = y + dys[k];
      if (nx2 < 0 || nx2 >= nx || ny2 < 0 || ny2 >= ny) continue;
      const j = ny2 * nx + nx2;
      const cout = tempsVersant[i] + (k < 4 ? pasM : pasM * Math.SQRT2);
      if (cout < tempsVersant[j] - 1e-9) {
        tempsVersant[j] = cout;
        tMin[j] = tMin[i] - tempsVersant[i] / vitesses.versant / 60
          + cout / vitesses.versant / 60;
        file.push(j);
      }
    }
  }

  // ── 3. On ne garde que l'intérieur du bassin.
  const dedans = new Uint8Array(nx * ny);
  const temps = new Float64Array(nx * ny).fill(NaN);
  let tc = 0, mailles = 0, loin = null;
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    if (!dansPolygone(x + 0.5, y + 0.5, bassin.limite)) continue;
    const i = y * nx + x;
    if (!Number.isFinite(tMin[i])) continue;
    dedans[i] = 1; mailles++;
    temps[i] = tMin[i];
    if (tMin[i] > tc) { tc = tMin[i]; loin = [x, y]; }
  }

  return { nx, ny, pas, temps, dedans, mailles, tc, pointLePlusLoin: loin,
           aireMaille: pas * pas, vitesses };
}

/** Courbe surface–temps : la part du bassin qui contribue à l'instant t. */
export function surfaceTemps(carte, nPas = 60) {
  const out = [];
  for (let k = 0; k <= nPas; k++) {
    const t = (carte.tc * k) / nPas;
    let n = 0;
    for (let i = 0; i < carte.temps.length; i++)
      if (carte.dedans[i] && carte.temps[i] <= t) n++;
    out.push({ t, part: n / carte.mailles, aire: n * carte.aireMaille });
  }
  return out;
}

/**
 * Hydrogramme de la méthode rationnelle, en surface contributive.
 * Averse uniforme de durée `duree` : le débit monte tant que de nouvelles
 * surfaces atteignent l'exutoire, plafonne quand le bassin entier contribue,
 * puis décroît quand la pluie cesse.
 */
export function hydrogramme(carte, courbe, { duree, C = 0.4, intensite = 30 }) {
  const part = (t) => {
    if (t <= 0) return 0;
    if (t >= carte.tc) return 1;
    let lo = 0, hi = courbe.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (courbe[m].t <= t) lo = m; else hi = m; }
    const a = courbe[lo], b = courbe[hi];
    return a.part + ((t - a.t) / (b.t - a.t || 1)) * (b.part - a.part);
  };
  const aire = carte.mailles * carte.aireMaille;            // km²
  const Qmax = (C * intensite * aire) / 3.6;                 // m³/s
  return (t) => Qmax * (part(t) - part(t - duree));
}

/**
 * Chemin suivi par une goutte partie de (x, y) : on descend le champ des temps
 * de parcours jusqu'à l'exutoire. Chaque point porte son temps restant, ce qui
 * permet de placer la goutte à n'importe quel instant sans rejouer le trajet.
 */
export function cheminGoutte(carte, x, y) {
  const { nx, ny, temps, dedans } = carte;
  const pts = [];
  let cx = x, cy = y, garde = 0;
  while (garde++ < 4000) {
    const i = cy * nx + cx;
    if (!dedans[i] || !Number.isFinite(temps[i])) break;
    pts.push({ x: cx, y: cy, t: temps[i] });
    if (temps[i] <= 1e-6) break;
    let meilleur = null, tMin = temps[i];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const ax = cx + dx, ay = cy + dy;
      if (ax < 0 || ax >= nx || ay < 0 || ay >= ny) continue;
      const j = ay * nx + ax;
      if (dedans[j] && Number.isFinite(temps[j]) && temps[j] < tMin - 1e-9) {
        tMin = temps[j]; meilleur = [ax, ay];
      }
    }
    if (!meilleur) break;
    [cx, cy] = meilleur;
  }
  return pts;
}

/** Position d'une goutte à l'instant `t`, ou null si elle est déjà arrivée. */
export function positionGoutte(chemin, t) {
  if (!chemin.length) return null;
  const restant = chemin[0].t - t;
  if (restant <= 0) return null;                  // arrivée
  if (restant >= chemin[0].t) return chemin[0];   // pas encore partie
  let lo = 0, hi = chemin.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (chemin[m].t >= restant) lo = m; else hi = m;
  }
  const a = chemin[lo], b = chemin[hi];
  const u = (a.t - restant) / ((a.t - b.t) || 1);
  return { x: a.x + u * (b.x - a.x), y: a.y + u * (b.y - a.y), t: restant };
}

/** Un semis de gouttes réparti sur le bassin, toujours le même. */
export function semisGouttes(carte, n = 70) {
  const cellules = [];
  for (let i = 0; i < carte.temps.length; i++)
    if (carte.dedans[i] && Number.isFinite(carte.temps[i])) cellules.push(i);
  const out = [];
  for (let k = 0; k < n; k++) {
    const i = cellules[Math.floor(((k + 0.5) / n) * cellules.length)];
    const x = i % carte.nx, y = (i - (i % carte.nx)) / carte.nx;
    out.push(cheminGoutte(carte, x, y));
  }
  // La goutte la plus éloignée ferme la marche : c'est elle qui définit tc.
  if (carte.pointLePlusLoin) out.push(cheminGoutte(carte, ...carte.pointLePlusLoin));
  return out;
}
