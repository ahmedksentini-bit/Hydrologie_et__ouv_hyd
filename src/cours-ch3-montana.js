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

const el = (id) => document.getElementById(id);
const num = (id) => parseFloat((el(id).value || "").replace(",", "."));
const fr = (x, d) => Number.isFinite(x)
  ? x.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";

const JEU = await fetch("data/stations-montana.json").then((r) => r.json());
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

function carte(classes) {
  const W = 400, H = 420, MG = 42, MD = 14, MH = 14, MB = 30;
  const lon0 = 7.8, lon1 = 11.6, lat0 = 30.2, lat1 = 37.6;
  const px = (lon) => MG + ((lon - lon0) / (lon1 - lon0)) * (W - MG - MD);
  const py = (lat) => H - MB - ((lat - lat0) / (lat1 - lat0)) * (H - MH - MB);

  const grat = [];
  for (let lon = 8; lon <= 11.5; lon += 1)
    grat.push(`<line x1="${px(lon).toFixed(1)}" y1="${MH}" x2="${px(lon).toFixed(1)}" y2="${H - MB}"
        stroke="#eef2f7" stroke-width="1"/>
      <text x="${px(lon).toFixed(1)}" y="${H - MB + 14}" font-size="10" fill="#64748b"
        text-anchor="middle">${lon}° E</text>`);
  for (let lat = 31; lat <= 37; lat += 1)
    grat.push(`<line x1="${MG}" y1="${py(lat).toFixed(1)}" x2="${W - MD}" y2="${py(lat).toFixed(1)}"
        stroke="#eef2f7" stroke-width="1"/>
      <text x="${MG - 6}" y="${(py(lat) + 3).toFixed(1)}" font-size="10" fill="#64748b"
        text-anchor="end">${lat}° N</text>`);

  // Trente noms sur un même écran sont illisibles : seule la station retenue
  // porte son nom, les autres se survolent. La carte sert à situer, la fiche à lire.
  const pts = [...PLACEES].sort((a, b) => a.lat - b.lat).map((s) => {
    const x = px(s.lon), y = py(s.lat), actif = s.nom === choisie.nom;
    const aGauche = s.lon > 10.2;
    const v = valeurAffichee(s);
    return `<g class="station${actif ? " actif" : ""}" data-nom="${s.nom}" tabindex="0"
        role="button" aria-label="${s.nom}">
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${actif ? 8 : 5.5}"
        fill="${couleurDe(v, classes)}" stroke="${actif ? "#0f172a" : "#f8fafc"}"
        stroke-width="${actif ? 2.2 : 1.8}"/>
      <title>${s.nom} — ${el("mGrandeur").value === "i" ? fr(v, 1) + " mm/h"
        : el("mGrandeur").selectedOptions[0].textContent + " " + fr(v, 3)}</title>
      ${actif ? `<text x="${(x + (aGauche ? -11 : 11)).toFixed(1)}" y="${(y + 3.2).toFixed(1)}"
        font-size="10.5" fill="#0f172a" font-weight="800"
        text-anchor="${aGauche ? "end" : "start"}">${s.nom}</text>` : ""}
    </g>`;
  }).join("");

  return `<svg viewBox="0 0 ${W} ${H}" class="carte-bv" width="100%" role="img"
      aria-label="Carte des stations de Montana dont la position est recoupée">
    ${grat.join("")}${pts}</svg>`;
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

function maj() {
  const classes = classerContinu(PLACEES.map(valeurAffichee));
  el("mCarte").innerHTML = carte(classes);
  el("mEchelle").innerHTML = legende(classes);
  for (const g of el("mCarte").querySelectorAll(".station")) {
    const prendre = () => {
      choisie = JEU.stations.find((s) => s.nom === g.dataset.nom);
      el("mStation").value = choisie.nom;
      maj();
    };
    g.addEventListener("click", prendre);
    g.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); prendre(); }
    });
  }
  fiche();
}

el("mStation").innerHTML = JEU.stations
  .map((s) => `<option value="${s.nom}"${s.nom === choisie.nom ? " selected" : ""}>${
    s.nom}${s.position === "wgs84" ? "" : " — non placée"}</option>`).join("");
el("mStation").addEventListener("change", () => {
  choisie = JEU.stations.find((s) => s.nom === el("mStation").value);
  maj();
});
for (const id of ["mGrandeur", "mT_periode"]) el(id).addEventListener("change", maj);
el("mT_duree").addEventListener("input", maj);
maj();
