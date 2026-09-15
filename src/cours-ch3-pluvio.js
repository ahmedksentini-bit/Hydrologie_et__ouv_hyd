// Pluviomètre et pluviographe, sur la MÊME averse.
//
// Tout le chapitre repose sur une distinction d'instrument que personne
// n'énonce jamais : le pluviomètre rend un cumul, le pluviographe rend une
// intensité. Montana, la méthode rationnelle et les courbes IDF ont toutes
// besoin de la seconde ; un siècle de relevés ne contient souvent que la
// première. D'où deux animations côte à côte, alimentées par la même averse :
// on voit les deux instruments recevoir la même pluie et n'en rapporter pas
// la même chose.

import { AVERSE, DUREE, intensite, cumul, intensiteMax } from "./solvers-averse.js";

const el = (id) => document.getElementById(id);
const fr = (x, d) => Number.isFinite(x)
  ? x.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";


const TOTAL = cumul(DUREE);
const I_MOY = TOTAL / DUREE;
const I_30 = intensiteMax(0.5);

const C = {
  ciel: "#e0f2fe", goutte: "#38bdf8", eau: "#0ea5e9", eauFoncee: "#0369a1",
  metal: "#94a3b8", metalFonce: "#64748b", trait: "#334155", papier: "#fffbeb",
  encre: "#b45309", texte: "#334155", muet: "#94a3b8",
};

const heure = (t) => {
  const h = Math.floor(t), m = Math.round((t - h) * 60);
  return `${String(h).padStart(2, "0")} h ${String(m % 60).padStart(2, "0")}`;
};

/** Pluie : des gouttes dont la DENSITÉ suit l'intensité du moment. */
function pluie(t, x0, x1, y0, y1, graine) {
  const i = intensite(t);
  if (i <= 0) return "";
  const n = Math.min(26, Math.round(3 + i * 0.42));
  const out = [];
  for (let k = 0; k < n; k++) {
    const a = Math.sin((k + 1) * 12.9898 + graine) * 43758.5453;
    const rx = a - Math.floor(a);
    const b = Math.sin((k + 1) * 78.233 + graine) * 43758.5453;
    const phase = b - Math.floor(b);
    const chute = ((t * (18 + i * 0.25) + phase) % 1);
    const x = x0 + rx * (x1 - x0);
    const y = y0 + chute * (y1 - y0);
    out.push(`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x - 1.4).toFixed(1)}"
      y2="${(y + 7).toFixed(1)}" stroke="${C.goutte}" stroke-width="1.5"
      stroke-linecap="round" opacity="${(0.45 + 0.4 * chute).toFixed(2)}"/>`);
  }
  return out.join("");
}

const entonnoir = (cx, y) => `
  <path d="M${cx - 34},${y} L${cx + 34},${y} L${cx + 6},${y + 26} L${cx - 6},${y + 26} Z"
    fill="${C.metal}" stroke="${C.metalFonce}" stroke-width="1.2" stroke-linejoin="round"/>
  <rect x="${cx - 6}" y="${y + 26}" width="12" height="10" fill="${C.metal}" stroke="${C.metalFonce}" stroke-width="1"/>`;

// ── Pluviomètre : une éprouvette, et un relevé par jour ────────────────────

function panneauPluviometre(t, horloge) {
  const W = 320, H = 270;
  const cx = 58, yEnt = 62;
  const xC = cx - 18, yHaut = 104, yBas = 216, largeur = 36;
  const MAX = 60;                                     // graduation de l'éprouvette, mm
  const c = cumul(t);
  const hEau = ((yBas - yHaut) * Math.min(c, MAX)) / MAX;
  const fini = t >= DUREE - 1e-9;

  const grad = [];
  for (let mm = 10; mm <= MAX; mm += 10) {
    const y = yBas - ((yBas - yHaut) * mm) / MAX;
    grad.push(`<line x1="${xC}" y1="${y.toFixed(1)}" x2="${xC + 7}" y2="${y.toFixed(1)}"
        stroke="${C.metalFonce}" stroke-width="0.8"/>
      <text x="${xC + largeur + 4}" y="${(y + 3).toFixed(1)}" font-size="8.5"
        fill="${C.muet}">${mm}</text>`);
  }

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img"
      aria-label="Pluviomètre : l'eau s'accumule dans une éprouvette, et le relevé donne un seul nombre pour la journée">
    <rect x="0" y="0" width="${W}" height="62" fill="${C.ciel}"/>
    ${pluie(horloge, 4, W - 4, -6, 62, 1)}
    <text x="8" y="15" font-size="12" font-weight="800" fill="#075985">Pluviomètre</text>
    <text x="8" y="28" font-size="9.5" fill="${C.metalFonce}">il additionne</text>
    ${entonnoir(cx, yEnt)}
    <rect x="${xC}" y="${yHaut}" width="${largeur}" height="${yBas - yHaut}" rx="3"
      fill="#fff" stroke="${C.metalFonce}" stroke-width="1.4"/>
    <rect x="${xC + 1}" y="${(yBas - hEau).toFixed(1)}" width="${largeur - 2}"
      height="${hEau.toFixed(1)}" fill="${C.eau}" opacity=".8"/>
    <line x1="${xC + 1}" y1="${(yBas - hEau).toFixed(1)}" x2="${xC + largeur - 1}"
      y2="${(yBas - hEau).toFixed(1)}" stroke="${C.eauFoncee}" stroke-width="1.6"/>
    ${grad.join("")}
    <text x="${cx}" y="${H - 34}" font-size="10" fill="${C.texte}" text-anchor="middle">éprouvette</text>
    <text x="${cx}" y="${H - 21}" font-size="9" fill="${C.muet}" text-anchor="middle">graduée en mm</text>

    <rect x="128" y="86" width="184" height="136" rx="9" fill="${C.papier}" stroke="#fde68a"/>
    <text x="140" y="104" font-size="10" font-weight="800" fill="${C.encre}">Carnet du poste</text>
    <line x1="140" y1="110" x2="300" y2="110" stroke="#fde68a"/>
    <text x="140" y="126" font-size="9.5" fill="${C.encre}">16/09 · 0,0 mm</text>
    <text x="140" y="140" font-size="9.5" fill="${C.encre}">17/09 · 2,5 mm</text>
    <text x="140" y="158" font-size="12" font-weight="800" fill="${C.encre}">18/09 ·
      ${fini ? `${fr(TOTAL, 1)} mm` : "…"}</text>
    <text x="140" y="178" font-size="9" fill="${C.encre}" opacity=".85">relevé de 07 h,
      une fois par jour</text>
    <text x="140" y="198" font-size="9.5" fill="#b91c1c" font-weight="700">
      ${fini ? `intensité moyenne ${fr(I_MOY, 1)} mm/h` : "intensité : non mesurée"}</text>
    <text x="140" y="212" font-size="9" fill="#b91c1c">
      ${fini ? "— mais rien sur les pointes" : "l'instrument ne la connaît pas"}</text>
    <text x="8" y="${H - 18}" font-size="9.5" fill="${C.texte}">Un nombre par jour.</text>
    <text x="8" y="${H - 6}" font-size="9" fill="${C.muet}">Une bruine de 24 h et un orage de
      30 min donnent la même ligne de carnet.</text>
  </svg>`;
}

// ── Pluviographe : un auget qui bascule, et un hyétogramme qui s'écrit ─────

function panneauPluviographe(t, horloge) {
  const W = 320, H = 270;
  const cx = 58, yEnt = 62;
  const i = intensite(t);
  // Le basculement est RALENTI pour être visible : à 60 mm/h un auget de
  // 0,2 mm bascule cinq fois par minute, soit bien plus vite que l'animation.
  const rythme = i > 0 ? Math.min(0.6 + i / 14, 5) : 0;
  const angle = rythme > 0 ? 15 * Math.sin(horloge * rythme * 2 * Math.PI) : 0;

  const x0 = 132, x1 = 310, yB = 196, yH = 108;
  const ech = (v) => yB - (yH - yB) * 0 - ((yB - yH) * Math.min(v, 60)) / 60;
  const barres = [];
  for (const [a, b, v] of AVERSE) {
    if (v <= 0 || t <= a) continue;
    const fin = Math.min(t, b);
    const xa = x0 + ((x1 - x0) * a) / DUREE, xb = x0 + ((x1 - x0) * fin) / DUREE;
    barres.push(`<rect x="${xa.toFixed(1)}" y="${ech(v).toFixed(1)}"
      width="${Math.max(xb - xa, 0.8).toFixed(1)}" height="${(yB - ech(v)).toFixed(1)}"
      fill="${C.eau}" opacity=".85"/>`);
  }
  const xNow = x0 + ((x1 - x0) * t) / DUREE;
  const reperes = [0, 6, 12, 18, 24].map((h) => {
    const x = x0 + ((x1 - x0) * h) / DUREE;
    return `<line x1="${x.toFixed(1)}" y1="${yB}" x2="${x.toFixed(1)}" y2="${yB + 3}"
        stroke="${C.muet}" stroke-width="0.8"/>
      <text x="${x.toFixed(1)}" y="${yB + 13}" font-size="8.5" fill="${C.muet}"
        text-anchor="middle">${h} h</text>`;
  }).join("");
  const niveaux = [20, 40, 60].map((v) =>
    `<line x1="${x0}" y1="${ech(v).toFixed(1)}" x2="${x1}" y2="${ech(v).toFixed(1)}"
       stroke="#e2e8f0" stroke-width="0.8"/>
     <text x="${x0 - 4}" y="${(ech(v) + 3).toFixed(1)}" font-size="8.5" fill="${C.muet}"
       text-anchor="end">${v}</text>`).join("");

  // Intensité maximale sur 30 min DÉJÀ enregistrée à l'instant t.
  let i30 = 0;
  for (let u = 0; u <= t - 0.5 + 1e-9; u += 1 / 120)
    i30 = Math.max(i30, (cumul(u + 0.5) - cumul(u)) / 0.5);

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img"
      aria-label="Pluviographe : un auget basculeur compte la pluie par petites doses horodatées, et trace le hyétogramme">
    <rect x="0" y="0" width="${W}" height="62" fill="${C.ciel}"/>
    ${pluie(horloge, 4, W - 4, -6, 62, 7)}
    <text x="8" y="15" font-size="12" font-weight="800" fill="#0f766e">Pluviographe</text>
    <text x="8" y="28" font-size="9.5" fill="${C.metalFonce}">il horodate</text>
    ${entonnoir(cx, yEnt)}
    <g transform="translate(${cx},118) rotate(${angle.toFixed(1)})">
      <path d="M-26,-8 L0,6 L26,-8 L26,-2 L0,13 L-26,-2 Z" fill="${C.metal}"
        stroke="${C.metalFonce}" stroke-width="1.1" stroke-linejoin="round"/>
      <path d="M-24,-6 L-2,5 L-2,-6 Z" fill="${C.eau}" opacity="${i > 0 ? 0.85 : 0.25}"/>
    </g>
    <circle cx="${cx}" cy="118" r="2.6" fill="${C.metalFonce}"/>
    <path d="M${cx - 12},134 L${cx + 12},134 L${cx + 8},150 L${cx - 8},150 Z" fill="#fff"
      stroke="${C.metalFonce}" stroke-width="1.1"/>
    <text x="${cx}" y="168" font-size="10" fill="${C.texte}" text-anchor="middle">auget basculeur</text>
    <text x="${cx}" y="181" font-size="9" fill="${C.muet}" text-anchor="middle">0,2 mm par bascule</text>
    <text x="${cx}" y="197" font-size="9" fill="${C.muet}" text-anchor="middle">(ralenti pour être vu)</text>

    ${niveaux}${barres.join("")}
    <line x1="${xNow.toFixed(1)}" y1="${yH - 6}" x2="${xNow.toFixed(1)}" y2="${yB}"
      stroke="${C.encre}" stroke-width="1" stroke-dasharray="3 2"/>
    <line x1="${x0}" y1="${yB}" x2="${x1}" y2="${yB}" stroke="${C.metalFonce}" stroke-width="1"/>
    ${reperes}
    <text x="${x0}" y="${yH - 12}" font-size="9.5" font-weight="800" fill="#0f766e">
      hyétogramme — intensité en mm/h</text>
    <text x="${x0}" y="${H - 42}" font-size="10" font-weight="800" fill="#0f766e">
      i max sur 30 min : ${fr(i30, 1)} mm/h</text>
    <text x="${x0}" y="${H - 29}" font-size="9" fill="${C.texte}">cumul ${fr(cumul(t), 1)} mm
      · il est ${heure(t)}</text>
    <text x="8" y="${H - 18}" font-size="9.5" fill="${C.texte}">Une intensité par pas de temps.</text>
    <text x="8" y="${H - 6}" font-size="9" fill="${C.muet}">C'est elle, et elle seule, qui donne
      les courbes IDF.</text>
  </svg>`;
}

// ── Le contraste, en chiffres ──────────────────────────────────────────────

// Le tableau du bilan est ÉCRIT DANS LA PAGE, pas injecté : posé au chargement,
// il est encapsulé comme les autres par src/tableaux.js, et il ne relance pas
// l'observateur soixante fois par seconde. Seules deux cases changent avec
// l'heure, et elles changent par textContent.

function bilan(t) {
  const fini = t >= DUREE - 1e-9;
  el("pvMm").textContent = fini ? `${fr(TOTAL, 1)} mm` : "—";
  el("pvMoy").textContent = fini ? `${fr(I_MOY, 1)} mm/h` : "—";
}

// ── Horloge ────────────────────────────────────────────────────────────────

const SECONDES = 20;                   // les 24 heures en vingt secondes
let t = 0, marche = false, depart = 0, horloge = 0, boucle = null;

function dessiner() {
  el("pvMetre").innerHTML = panneauPluviometre(t, horloge);
  el("pvGraphe").innerHTML = panneauPluviographe(t, horloge);
  el("pvTemps").value = String(t);
  el("pvHeure").textContent = heure(t);
  bilan(t);
}

function image(ms) {
  horloge = ms / 1000;
  if (marche) {
    // max(0) : `ms` peut précéder le départ de quelques dixièmes de
    // milliseconde, et l'horloge affichait alors « −1 h 00 ».
    t = Math.min(DUREE, Math.max(0, ((ms - depart) / 1000 / SECONDES) * DUREE));
    if (t >= DUREE) arreter();
  }
  dessiner();
  boucle = requestAnimationFrame(image);
}

function arreter() {
  marche = false;
  el("pvPlay").textContent = t >= DUREE ? "Rejouer" : "Lecture";
}

function lancer() {
  if (t >= DUREE - 1e-9) t = 0;
  marche = true;
  depart = performance.now() - (t / DUREE) * SECONDES * 1000;
  el("pvPlay").textContent = "Pause";
}

el("pvPlay").addEventListener("click", () => (marche ? arreter() : lancer()));
el("pvTemps").addEventListener("input", () => {
  arreter();
  t = parseFloat(el("pvTemps").value);
  el("pvPlay").textContent = t >= DUREE ? "Rejouer" : "Lecture";
});
// Trois moments qui valent d'être vus directement, sans attendre.
for (const [id, instant] of [["pvAvant", 9.7], ["pvOrage", 10.8], ["pvApres", 24]])
  el(id).addEventListener("click", () => {
    arreter(); t = instant;
    el("pvPlay").textContent = t >= DUREE ? "Rejouer" : "Lecture";
  });

boucle = requestAnimationFrame(image);
// On ne démarre pas tout seul si la personne a demandé moins d'animation.
if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) lancer();
