// Fond de carte commun aux cartes de stations : frontières, mer, terres
// voisines. Il SITUE, il ne mesure pas — d'où un tracé volontairement effacé,
// qui ne doit jamais entrer en concurrence avec les points de données.
//
// Les frontières viennent de Natural Earth (domaine public), découpées sur la
// fenêtre des cartes et simplifiées à 0,008° ≈ 900 m.
//
// CONTRASTE : la rampe séquentielle a été contrôlée sur le fond #f8fafc, qui
// est celui des terres tunisiennes — là où se trouvent presque toutes les
// stations. Sur la mer ou les terres voisines, plus soutenues, le pas le plus
// clair tomberait sous le plancher de 2:1. C'est l'ANNEAU de séparation porté
// par chaque point qui règle le cas : la pastille se lit toujours contre
// #f8fafc, quel que soit ce qu'il y a dessous.

import { chargerJson } from "./donnees.js";

export const FOND = {
  mer: "#eaf4fb",
  voisin: "#f1f5f9", voisinTrait: "#dde5ec",
  principal: "#f8fafc", principalTrait: "#94a3b8",
  graticule: "#dbe5ed", etiquette: "#94a3b8",
};

/**
 * Projection équirectangulaire à aspect VRAI : un degré de longitude vaut
 * cos(latitude moyenne) degré de latitude au sol. Sans ce facteur, la Tunisie
 * apparaît deux fois trop large — invisible tant qu'on ne trace qu'un
 * graticule, flagrant dès qu'on dessine un contour.
 * La carte est centrée dans la boîte disponible et n'en occupe que ce qu'il
 * faut : mieux vaut du blanc autour qu'un pays déformé.
 */
export function projection({ lon0, lat0, lon1, lat1 }, { largeurMax, hauteurMax, mg, md, mh, mb }) {
  const k = Math.cos((((lat0 + lat1) / 2) * Math.PI) / 180);
  const dispoL = largeurMax - mg - md, dispoH = hauteurMax - mh - mb;
  const echelle = Math.min(dispoL / ((lon1 - lon0) * k), dispoH / (lat1 - lat0));
  const L = (lon1 - lon0) * k * echelle, H = (lat1 - lat0) * echelle;
  const x0 = mg + (dispoL - L) / 2, y0 = mh + (dispoH - H) / 2;
  return {
    px: (lon) => x0 + ((lon - lon0) / (lon1 - lon0)) * L,
    py: (lat) => y0 + H - ((lat - lat0) / (lat1 - lat0)) * H,
    zone: { x0, y0, x1: x0 + L, y1: y0 + H },
    largeur: x0 + L + md, hauteur: y0 + H + mb, echelle,
  };
}

// Un cache par fichier : le cours a deux fonds, la Tunisie et l'Afrique de
// l'Ouest, et un cache unique servirait l'un à la place de l'autre.
const caches = new Map();
export async function chargerFrontieres(fichier = "data/frontieres.json") {
  if (!caches.has(fichier))
    caches.set(fichier, await chargerJson(fichier));
  return caches.get(fichier);
}

/** Test d'appartenance à un anneau, par lancer de rayon. */
function dansAnneau(lon, lat, anneau) {
  let dedans = false;
  for (let i = 0, j = anneau.length - 1; i < anneau.length; j = i++) {
    const [xi, yi] = anneau[i], [xj, yj] = anneau[j];
    if ((yi > lat) !== (yj > lat)
        && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}

const surTerre = (lon, lat, frontieres) =>
  frontieres.pays.some((p) => p.anneaux.some((a) => dansAnneau(lon, lat, a)));

/**
 * Fond de carte pour une projection donnée.
 * `px`/`py` convertissent lon/lat en pixels ; `zone` délimite la zone de tracé ;
 * `fenetre` donne les bornes géographiques affichées.
 */
export function fondDeCarte(frontieres, px, py, zone, fenetre, idClip,
                            nomMer = "Méditerranée") {
  const { x0, y0, x1, y1 } = zone;
  const { lon0, lat0, lon1, lat1 } = fenetre;
  const chemin = (anneau) => anneau
    .map((p, i) => `${i ? "L" : "M"}${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`).join("") + "Z";

  const pays = frontieres.pays.map((p) => {
    const d = p.anneaux.map(chemin).join(" ");
    return `<path d="${d}" fill="${p.principal ? FOND.principal : FOND.voisin}"
      stroke="${p.principal ? FOND.principalTrait : FOND.voisinTrait}"
      stroke-width="${p.principal ? 1.1 : 0.8}" stroke-linejoin="round" fill-rule="evenodd"/>`;
  }).join("");

  // Une étiquette placée au barycentre peut tomber au bord et se faire couper
  // par le masque. On l'y ramène : mieux vaut une position approchée qu'un mot
  // tronqué.
  const largeurTexte = (t, taille, espacement) => t.length * (0.62 * taille + espacement);
  const poser = (lon, lat, texte, taille, espacement) => {
    const w = largeurTexte(texte, taille, espacement);
    const x = Math.min(Math.max(px(lon), x0 + w / 2 + 5), x1 - w / 2 - 5);
    const y = Math.min(Math.max(py(lat), y0 + taille + 4), y1 - 6);
    return { x, y, tient: x1 - x0 > w + 10 };
  };

  // Chaque étiquette de pays se pose au barycentre de ses sommets VISIBLES :
  // elle suit ainsi la fenêtre au lieu d'être calée une fois pour toutes.
  const visible = (p) => p[0] >= lon0 && p[0] <= lon1 && p[1] >= lat0 && p[1] <= lat1;
  const etiquettes = frontieres.pays.filter((p) => !p.principal).map((p) => {
    const pts = p.anneaux.flat().filter(visible);
    if (pts.length < 8) return "";
    const lon = pts.reduce((a, q) => a + q[0], 0) / pts.length;
    const lat = pts.reduce((a, q) => a + q[1], 0) / pts.length;
    const pos = poser(lon, lat, p.nom, 9, 1.4);
    if (!pos.tient) return "";
    return `<text x="${pos.x.toFixed(1)}" y="${pos.y.toFixed(1)}" font-size="9"
      fill="${FOND.etiquette}" text-anchor="middle" letter-spacing="1.4"
      style="text-transform:uppercase">${p.nom}</text>`;
  }).join("");

  // La mer se nomme au point le plus au large de la fenêtre : on balaie une
  // grille, on écarte ce qui est à terre ou trop près d'un bord, et on garde le
  // point le plus éloigné de toute côte. Un ancrage choisi à la main finit
  // toujours par tomber sur un trait de côte dès que la fenêtre change.
  const sommets = frontieres.pays.flatMap((p) => p.anneaux.flat());
  const w = largeurTexte(nomMer, 8.5, 1.2);
  let mer = "", meilleur = -1;
  if (x1 - x0 > w + 10) {
    for (let i = 1; i < 28; i++) for (let j = 1; j < 28; j++) {
      const lon = lon0 + (i / 28) * (lon1 - lon0), lat = lat0 + (j / 28) * (lat1 - lat0);
      const x = px(lon), y = py(lat);
      if (x - w / 2 < x0 + 5 || x + w / 2 > x1 - 5 || y < y0 + 14 || y > y1 - 8) continue;
      if (surTerre(lon, lat, frontieres)) continue;
      let d = Infinity;
      for (const q of sommets) {
        const e = (q[0] - lon) * (q[0] - lon) + (q[1] - lat) * (q[1] - lat);
        if (e < d) d = e;
      }
      if (d > meilleur) {
        meilleur = d;
        mer = `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="8.5"
          fill="#93b8cf" text-anchor="middle" letter-spacing="1.2"
          style="text-transform:uppercase">${nomMer}</text>`;
      }
    }
  }

  return {
    defs: `<clipPath id="${idClip}"><rect x="${x0}" y="${y0}"
      width="${x1 - x0}" height="${y1 - y0}"/></clipPath>`,
    fond: `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="${FOND.mer}"/>
      <g clip-path="url(#${idClip})">${pays}</g>`,
    reperes: `<g clip-path="url(#${idClip})">${etiquettes}${mer}</g>`,
  };
}

/** Graticule, tracé PAR-DESSUS les terres et sous les données. */
export function graticule(px, py, zone, pasLon, pasLat) {
  const { x0, y0, x1, y1 } = zone;
  // Zoomée, une carte gradue au quart ou au dixième de degré : 8,25 et non 8.25.
  const etiq = (v) => Number.isInteger(v)
    ? String(v) : v.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  const lignes = [];
  for (const lon of pasLon)
    lignes.push(`<line x1="${px(lon).toFixed(1)}" y1="${y0}" x2="${px(lon).toFixed(1)}" y2="${y1}"
        stroke="${FOND.graticule}" stroke-width="0.7" opacity=".7"/>
      <text x="${px(lon).toFixed(1)}" y="${y1 + 14}" font-size="10" fill="#64748b"
        text-anchor="middle">${etiq(lon)}° E</text>`);
  for (const lat of pasLat)
    lignes.push(`<line x1="${x0}" y1="${py(lat).toFixed(1)}" x2="${x1}" y2="${py(lat).toFixed(1)}"
        stroke="${FOND.graticule}" stroke-width="0.7" opacity=".7"/>
      <text x="${x0 - 6}" y="${(py(lat) + 3).toFixed(1)}" font-size="10" fill="#64748b"
        text-anchor="end">${etiq(lat)}° N</text>`);
  return lignes.join("");
}

// ── Survol : le nom de la station, tout de suite ──────────────────────────
// Le <title> natif d'SVG met près d'une seconde à paraître, ne se style pas et
// ne suit pas le clavier. On dessine donc l'étiquette nous-mêmes, dans un
// calque placé EN DERNIER : en SVG l'ordre du document fait l'ordre
// d'empilement, et une étiquette écrite dans le groupe de la station passerait
// sous les pastilles tracées après elle.

/** Calque vide, à insérer en dernier dans le SVG. */
export const calqueSurvol = (id) => `<g id="${id}" class="survol-carte" pointer-events="none"></g>`;

/**
 * Câble le survol et le focus clavier sur les `.station` d'un SVG.
 * Chaque station porte son texte dans `data-nom` et `data-detail`.
 */
export function attacherSurvol(racine, idCalque, zone) {
  const calque = racine.querySelector(`#${idCalque}`);
  if (!calque) return;
  const { x0, x1, y0, y1 } = zone;

  const cacher = () => { calque.innerHTML = ""; };

  const montrer = (g) => {
    const c = g.querySelector("circle");
    if (!c) return;
    const cx = parseFloat(c.getAttribute("cx")), cy = parseFloat(c.getAttribute("cy"));
    const nom = g.dataset.nom || "", detail = g.dataset.detail || "";
    const taille = 10.5, petite = 9;
    // Largeur estimée : on ne peut pas mesurer un texte avant de l'avoir posé.
    const w = Math.max(nom.length * 0.60 * taille, detail.length * 0.56 * petite) + 14;
    const h = detail ? 32 : 20;
    const aGauche = cx + 12 + w > x1;                 // bascule près du bord droit
    let bx = aGauche ? cx - 12 - w : cx + 12;
    let by = cy - h / 2;
    bx = Math.min(Math.max(bx, x0 + 2), x1 - w - 2);
    by = Math.min(Math.max(by, y0 + 2), y1 - h - 2);

    calque.innerHTML = `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}"
        width="${w.toFixed(1)}" height="${h}" rx="5" fill="#0f172a" opacity=".92"/>
      <text x="${(bx + 7).toFixed(1)}" y="${(by + 13.5).toFixed(1)}" font-size="${taille}"
        fill="#fff" font-weight="700">${nom}</text>
      ${detail ? `<text x="${(bx + 7).toFixed(1)}" y="${(by + 26).toFixed(1)}"
        font-size="${petite}" fill="#bae6fd">${detail}</text>` : ""}`;
  };

  for (const g of racine.querySelectorAll(".station")) {
    g.addEventListener("mouseenter", () => montrer(g));
    g.addEventListener("focus", () => montrer(g));
    g.addEventListener("mouseleave", cacher);
    g.addEventListener("blur", cacher);
  }
  racine.addEventListener("mouseleave", cacher);
}
