// Carte des stations de Montana. Cliquer une station donne ses paramètres, la
// table complète de a(T) et sa famille de courbes IDF.
//
// Le point du chapitre : « le » a d'une station n'existe pas. La table en donne
// un par période de retour, et ce a(T) n'est croissant sur AUCUNE station — il
// culmine vers dix ans puis redescend. C'est le produit a(T)·T^c qui porte la
// croissance de l'intensité avec T. Prendre un seul a et le multiplier par T^c
// est une approximation, exacte à la seule période dont on a pris le a.
import { montana } from "./solvers-hydro.js";
import { RAMPE_SEQUENTIELLE, ABSENT, classerContinu, couleurDe } from "./echelle.js";
import { chargerFrontieres, projection, fondDeCarte, graticule, FOND,
         calqueSurvol, attacherSurvol } from "./carte-fond.js";

const el = (id) => document.getElementById(id);
const num = (id) => parseFloat((el(id).value || "").replace(",", "."));
const fr = (x, d) => Number.isFinite(x)
  ? x.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";

const JEU = await fetch("data/stations-montana.json").then((r) => r.json());
const FRONTIERES = await chargerFrontieres();
const PLACEES = JEU.stations.filter((s) => s.position === "wgs84");
let choisie = JEU.stations.find((s) => s.nom === "Kasserine") || JEU.stations[0];

/** a interpolé à une période quelconque : linéaire en ln T entre deux colonnes. */
function aInterpole(s, T) {
  const Ts = Object.keys(s.aT).map(Number).sort((a, b) => a - b);
  if (T <= Ts[0]) return { a: s.aT[Ts[0]], exact: T === Ts[0], borne: T < Ts[0] };
  const dernier = Ts[Ts.length - 1];
  if (T >= dernier) return { a: s.aT[dernier], exact: T === dernier, borne: T > dernier };
  for (let i = 1; i < Ts.length; i++) {
    if (T <= Ts[i]) {
      const [T0, T1] = [Ts[i - 1], Ts[i]];
      if (T === T0) return { a: s.aT[T0], exact: true, borne: false };
      if (T === T1) return { a: s.aT[T1], exact: true, borne: false };
      const u = (Math.log(T) - Math.log(T0)) / (Math.log(T1) - Math.log(T0));
      return { a: s.aT[T0] + u * (s.aT[T1] - s.aT[T0]), exact: false, borne: false };
    }
  }
  return { a: s.aT[dernier], exact: false, borne: true };
}

/** Intensité complète : i = a(T)·t^(−b)·T^c. */
const intensite = (s, t, T) => {
  const { a } = aInterpole(s, T);
  return montana(a, s.b, s.c, t, T);
};

const valeurAffichee = (s) => {
  const t = num("mT_duree"), T = parseFloat(el("mT_periode").value);
  switch (el("mGrandeur").value) {
    case "b": return s.b;
    case "c": return s.c;
    default: return intensite(s, t, T);
  }
};

let zoneCarte = { x0: 0, y0: 0, x1: 0, y1: 0 };

// ── Zoom ──────────────────────────────────────────────────────────────────
// À l'échelle du pays, dix-sept paires de stations tiennent dans moins de
// quatorze pixels — soit moins que le diamètre d'une pastille : elles se
// recouvrent, et on ne peut ni les distinguer ni les cliquer séparément.
//
// Le zoom est GÉOGRAPHIQUE et non graphique : on rétrécit la fenêtre en
// degrés puis on reprojette. Tout suit — le découpage des frontières, le pas
// du graticule, le placement des étiquettes. Mettre un `scale()` sur le SVG
// aurait grossi du même coup les traits, les rayons et les textes, et décalé
// les cibles de survol, qui raisonnent en pixels.
const FENETRE_PLEINE = { lon0: 7.6, lat0: 30.0, lon1: 11.8, lat1: 37.7 };
const ZOOM_MAX = 4;
// Faute de station choisie qui soit placée, on vise le barycentre du semis :
// vingt des trente stations sont au nord de 36°, le centre du pays est vide.
const BARYCENTRE = {
  lon: PLACEES.reduce((a, s) => a + s.lon, 0) / PLACEES.length,
  lat: PLACEES.reduce((a, s) => a + s.lat, 0) / PLACEES.length,
};
let zoom = 1;
let centre = null;                       // dernière station PLACÉE choisie

/**
 * Fenêtre affichée. Le zoom se fait autour de la station choisie — elle reste
 * donc toujours en vue — et la fenêtre est calée dans l'emprise du pays : on
 * ne dérive jamais sur du vide.
 */
function fenetreCourante() {
  if (zoom <= 1) return FENETRE_PLEINE;
  const { lon0, lat0, lon1, lat1 } = FENETRE_PLEINE;
  const f = Math.pow(2, zoom - 1);
  const dLon = (lon1 - lon0) / f, dLat = (lat1 - lat0) / f;
  const c = centre || BARYCENTRE;
  const cale = (v, d, min, max) => Math.min(Math.max(v - d / 2, min), max - d);
  const a = cale(c.lon, dLon, lon0, lon1), b = cale(c.lat, dLat, lat0, lat1);
  return { lon0: a, lat0: b, lon1: a + dLon, lat1: b + dLat };
}

const dansFenetre = (s, f) =>
  s.lon >= f.lon0 && s.lon <= f.lon1 && s.lat >= f.lat0 && s.lat <= f.lat1;

/** Graduations : le pas le plus fin qui tienne en huit lignes, bords exclus. */
function graduations(min, max) {
  const pas = [0.05, 0.1, 0.25, 0.5, 1, 2].find((x) => (max - min) / x <= 8) ?? 2;
  const marge = (max - min) * 0.02, out = [];
  for (let v = Math.ceil(min / pas) * pas; v <= max + 1e-9; v += pas) {
    const x = Math.round(v * 1000) / 1000;
    if (x > min + marge && x < max - marge) out.push(x);
  }
  return out;
}

function carte(classes) {
  const FENETRE = fenetreCourante();
  const proj = projection(FENETRE, { largeurMax: 250, hauteurMax: 420,
                                     mg: 40, md: 12, mh: 12, mb: 28 });
  const { px, py, zone } = proj;
  zoneCarte = zone;
  const W = Math.round(proj.largeur), H = Math.round(proj.hauteur);
  const base = fondDeCarte(FRONTIERES, px, py, zone, FENETRE, "clipMontana");

  // Hors fenêtre, on ne dessine pas : le masque suffirait à cacher le point
  // mais laisserait sa cible dans l'arbre, et un survol fantôme avec.
  const pts = PLACEES.filter((s) => dansFenetre(s, FENETRE))
    .sort((a, b) => a.lat - b.lat).map((s) => {
    const x = px(s.lon), y = py(s.lat), actif = s.nom === choisie.nom;
    const aGauche = s.lon > 10.2;
    const v = valeurAffichee(s);
    const detail = el("mGrandeur").value === "i"
      ? `${fr(v, 1)} mm/h à ${fr(num("mT_duree"), 0)} min et ${el("mT_periode").value} ans`
      : `${el("mGrandeur").selectedOptions[0].textContent} = ${fr(v, 3)}`;
    return `<g class="station${actif ? " actif" : ""}" data-nom="${s.nom}"
        data-detail="${detail}" tabindex="0" role="button"
        aria-label="${s.nom} — ${detail}">
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="12" fill="transparent" class="cible"/>
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${actif ? 7.5 : 5}"
        fill="${couleurDe(v, classes)}" stroke="${actif ? "#0f172a" : FOND.principal}"
        stroke-width="${actif ? 2.2 : 2}"/>
      ${actif ? `<text x="${(x + (aGauche ? -11 : 11)).toFixed(1)}" y="${(y + 3.2).toFixed(1)}"
        font-size="10.5" fill="#0f172a" font-weight="800" paint-order="stroke"
        stroke="${FOND.principal}" stroke-width="3"
        text-anchor="${aGauche ? "end" : "start"}">${s.nom}</text>` : ""}
    </g>`;
  }).join("");

  return `<svg viewBox="0 0 ${W} ${H}" class="carte-bv" width="100%" role="img"
      aria-label="Carte de la Tunisie et des stations de Montana dont la position est recoupée">
    <defs>${base.defs}</defs>${base.fond}
    ${graticule(px, py, zone, graduations(FENETRE.lon0, FENETRE.lon1),
                            graduations(FENETRE.lat0, FENETRE.lat1))}
    ${base.reperes}<g clip-path="url(#clipMontana)">${pts}</g>
    ${calqueSurvol("survolMontana")}</svg>`;
}

function legende(classes) {
  const g = el("mGrandeur").selectedOptions[0].textContent;
  const unite = el("mGrandeur").value === "i" ? " mm/h" : "";
  const d = el("mGrandeur").value === "i" ? 0 : 3;
  return `<div class="echelle"><small>${g}${unite ? " (mm/h)" : ""}</small>
    <div class="echelle-pas">${classes.map((c) =>
      `<span><i style="background:${c.couleur}"></i>${fr(c.min, d)}–${fr(c.max, d)}</span>`).join("")}
    </div></div>`;
}

/** Famille de courbes IDF de la station, en log-log. */
function courbesIdf(s) {
  const L = 360, H = 260, MG = 46, MD = 54, MH = 12, MB = 32;
  const tMin = 5, tMax = 1440;
  const Ts = JEU.periodes;
  const iMax = intensite(s, tMin, Ts[Ts.length - 1]), iMin = intensite(s, tMax, Ts[0]);
  const px = (t) => MG + ((Math.log10(t) - Math.log10(tMin)) / (Math.log10(tMax) - Math.log10(tMin))) * (L - MG - MD);
  const py = (i) => H - MB - ((Math.log10(i) - Math.log10(iMin)) / (Math.log10(iMax) - Math.log10(iMin))) * (H - MH - MB);
  const durees = Array.from({ length: 41 }, (_, k) =>
    Math.pow(10, Math.log10(tMin) + (k / 40) * (Math.log10(tMax) - Math.log10(tMin))));

  // Les six courbes convergent aux longues durées : leurs étiquettes se
  // superposeraient. On les écarte verticalement d'au moins onze pixels.
  let derniere = Infinity;
  const etiquettes = [...Ts].reverse().map((T) => {
    const yb = Math.min(py(intensite(s, tMax, T)) + 3, derniere - 11);
    derniere = yb;
    return { T, y: yb };
  });
  const lignes = Ts.map((T, k) => {
    const coul = RAMPE_SEQUENTIELLE[Math.min(k, RAMPE_SEQUENTIELLE.length - 1)];
    const d = durees.map((t, j) => `${j ? "L" : "M"}${px(t).toFixed(1)},${py(intensite(s, t, T)).toFixed(1)}`).join("");
    const e = etiquettes.find((x) => x.T === T);
    return `<path d="${d}" fill="none" stroke="${coul}" stroke-width="2"/>
      <line x1="${(L - MD).toFixed(1)}" y1="${py(intensite(s, tMax, T)).toFixed(1)}"
        x2="${(L - MD + 4).toFixed(1)}" y2="${(e.y - 3).toFixed(1)}" stroke="${coul}"
        stroke-width="0.8" opacity=".6"/>
      <text x="${L - MD + 6}" y="${e.y.toFixed(1)}" font-size="9.5"
        fill="${coul}" font-weight="700">${T} ans</text>`;
  }).join("");

  const grad = [10, 30, 60, 180, 720].map((t) =>
    `<line x1="${px(t).toFixed(1)}" y1="${MH}" x2="${px(t).toFixed(1)}" y2="${H - MB}"
       stroke="#eef2f7" stroke-width="1"/>
     <text x="${px(t).toFixed(1)}" y="${H - MB + 13}" font-size="9.5" fill="#64748b"
       text-anchor="middle">${t}</text>`).join("");
  const ord = [10, 30, 100, 300].filter((i) => i >= iMin && i <= iMax).map((i) =>
    `<line x1="${MG}" y1="${py(i).toFixed(1)}" x2="${(L - MD).toFixed(1)}" y2="${py(i).toFixed(1)}"
       stroke="#eef2f7" stroke-width="1"/>
     <text x="${MG - 6}" y="${(py(i) + 3).toFixed(1)}" font-size="9.5" fill="#64748b"
       text-anchor="end">${i}</text>`).join("");

  const t0 = num("mT_duree"), T0 = parseFloat(el("mT_periode").value);
  const point = t0 >= tMin && t0 <= tMax
    ? `<circle cx="${px(t0).toFixed(1)}" cy="${py(intensite(s, t0, T0)).toFixed(1)}" r="4.5"
         fill="#be123c"/>` : "";

  return `<svg viewBox="0 0 ${L} ${H}" width="100%" role="img"
      aria-label="Courbes intensité-durée-fréquence de la station, échelles logarithmiques">
    ${ord}${grad}${lignes}${point}
    <text x="${MG}" y="${H - 4}" font-size="9.5" fill="#475569">durée (min)</text>
    <text transform="translate(12,${(H / 2).toFixed(0)}) rotate(-90)" font-size="9.5"
          fill="#475569" text-anchor="middle">intensité (mm/h)</text>
  </svg>`;
}

function fiche() {
  const s = choisie, t = num("mT_duree"), T = parseFloat(el("mT_periode").value);
  const Ts = Object.keys(s.aT).map(Number).sort((a, b) => a - b);
  const aMax = Math.max(...Ts.map((x) => s.aT[x]));
  const { a, exact } = aInterpole(s, T);

  el("mFiche").innerHTML = `<h4 style="margin:0 0 4px">${s.nom}</h4>
    <p class="method-note" style="margin:0 0 10px">code ${s.code || "—"} ·
      b = ${fr(s.b, 3)} · c = ${fr(s.c, 3)} ·
      ${s.position === "wgs84"
        ? `${fr(s.lon, 3)}° E · ${fr(s.lat, 3)}° N`
        : "<strong>position non recoupée</strong> — paramètres utilisables, station non placée"}</p>
    <table class="resultats abaque"><thead><tr><th>T (ans)</th>
      ${Ts.map((x) => `<th>${x}</th>`).join("")}</tr></thead>
      <tbody><tr><td>a(T)</td>${Ts.map((x) =>
        `<td class="${s.aT[x] === aMax ? "q retenue" : "q"}">${s.aT[x]}</td>`).join("")}</tr>
      <tr><td>a(T)·T<sup>c</sup></td>${Ts.map((x) =>
        `<td class="motif" style="text-align:right">${fr(s.aT[x] * Math.pow(x, s.c), 0)}</td>`).join("")}</tr>
      </tbody></table>
    <p class="method-note">a(T) culmine à ${aMax} vers 10–20 ans puis redescend : pris seul, il
      ferait décroître l'intensité au-delà. C'est la seconde ligne — a(T)·T<sup>c</sup> — qui
      croît, et c'est elle qui porte la période de retour.</p>
    ${courbesIdf(s)}
    <p class="final-result"><strong>i = ${fr(intensite(s, t, T), 2)} mm/h</strong>
      à t = ${fr(t, 0)} min et T = ${T} ans
      <small><br>a(${T}) = ${fr(a, 1)}${exact ? " (colonne tabulée)"
        : " — interpolé linéairement en ln T entre deux colonnes"} ·
      i = ${fr(a, 1)} × ${fr(t, 0)}<sup>−${fr(s.b, 3)}</sup> × ${T}<sup>${fr(s.c, 3)}</sup>.</small></p>`;
}

/** Choisir une station recentre le zoom sur elle, si elle est placée. */
function choisir(nom) {
  choisie = JEU.stations.find((s) => s.nom === nom);
  if (choisie.position === "wgs84") centre = choisie;
  el("mStation").value = choisie.nom;
  maj();
}

function reglerZoom(n) {
  const avant = zoom;
  zoom = Math.min(Math.max(n, 1), ZOOM_MAX);
  if (zoom !== avant) maj();
}

function etatZoom() {
  const f = fenetreCourante();
  const n = PLACEES.filter((s) => dansFenetre(s, f)).length;
  el("mZoomPlus").disabled = zoom >= ZOOM_MAX;
  el("mZoomMoins").disabled = zoom <= 1;
  el("mZoomEtat").innerHTML = zoom <= 1
    ? `Vue d'ensemble — les ${PLACEES.length} stations placées.`
    : `Zoom ×${Math.pow(2, zoom - 1)} autour de ${centre ? centre.nom : "la zone dense"} —
       ${n} station${n > 1 ? "s" : ""} sur ${PLACEES.length} dans la fenêtre.`;
  el("mZoomReset").hidden = zoom <= 1;
}

function maj() {
  // L'échelle de couleur reste calée sur les TRENTE stations, pas sur les
  // seules visibles : une pastille doit garder la même couleur d'un zoom à
  // l'autre, sinon on croit lire une variation là où on n'a changé que le cadre.
  const classes = classerContinu(PLACEES.map(valeurAffichee));
  el("mCarte").innerHTML = carte(classes);
  el("mEchelle").innerHTML = legende(classes);
  etatZoom();
  attacherSurvol(el("mCarte"), "survolMontana", zoneCarte);
  for (const g of el("mCarte").querySelectorAll(".station")) {
    g.addEventListener("click", () => choisir(g.dataset.nom));
    g.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choisir(g.dataset.nom); }
    });
  }
  fiche();
}

el("mStation").innerHTML = JEU.stations
  .map((s) => `<option value="${s.nom}"${s.nom === choisie.nom ? " selected" : ""}>${
    s.nom}${s.position === "wgs84" ? "" : " — non placée"}</option>`).join("");
el("mStation").addEventListener("change", () => choisir(el("mStation").value));
for (const id of ["mGrandeur", "mT_periode"]) el(id).addEventListener("change", maj);
el("mT_duree").addEventListener("input", maj);
el("mZoomPlus").addEventListener("click", () => reglerZoom(zoom + 1));
el("mZoomMoins").addEventListener("click", () => reglerZoom(zoom - 1));
el("mZoomReset").addEventListener("click", () => reglerZoom(1));
// Au clavier : une station a le focus, « + » et « − » agissent sans viser un bouton.
el("mCarte").parentElement.addEventListener("keydown", (e) => {
  if (e.key === "+" || e.key === "=") { e.preventDefault(); reglerZoom(zoom + 1); }
  if (e.key === "-" || e.key === "_") { e.preventDefault(); reglerZoom(zoom - 1); }
});
maj();
