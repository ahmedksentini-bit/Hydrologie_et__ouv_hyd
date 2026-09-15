// Le temps de concentration, montré au lieu d'être défini.
//
// tc est le temps que met la goutte la plus éloignée pour atteindre
// l'exutoire. Tant qu'elle n'est pas arrivée, une partie du bassin ne
// contribue pas encore : le débit monte. Quand elle arrive, tout le bassin
// contribue en même temps — et c'est là, et seulement là, que le débit est
// maximal. D'où la règle du chapitre : l'averse de projet dure tc.
//
// Le bassin est celui du chapitre 1, avec son vrai réseau. Le cheminement se
// fait à deux vitesses, versant puis réseau ; elles se choisissent, et le
// sélecteur montre ce que ce choix coûte.
import { tempsDeParcours, surfaceTemps, hydrogramme, semisGouttes,
         positionGoutte, VITESSES } from "./solvers-concentration.js";

const el = (id) => document.getElementById(id);
const fr = (x, d) => Number.isFinite(x)
  ? x.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";

const RAMPE = ["#dbeafe", "#bfdbfe", "#93c5fd", "#60a5fa", "#3b82f6",
               "#2563eb", "#1d4ed8", "#1e40af", "#1e3a8a", "#172554"];
const BANDES = RAMPE.length;
const C = { limite: "#475569", reseau: "#0284c7", exutoire: "#b91c1c",
            goutte: "#0ea5e9", loin: "#b45309", muet: "#94a3b8", texte: "#334155" };

const BASSIN = await fetch("data/bassin-demo.json").then((r) => r.json());

let carte = null, courbe = null, gouttes = null, boite = null;
let t = 0, marche = false, depart = 0, boucle = null;

/** Boîte englobante du bassin, en mailles. */
function cadrer(c) {
  let x0 = c.nx, y0 = c.ny, x1 = 0, y1 = 0;
  for (let i = 0; i < c.temps.length; i++) {
    if (!c.dedans[i]) continue;
    const x = i % c.nx, y = (i - (i % c.nx)) / c.nx;
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x0: x0 - 2, y0: y0 - 2, x1: x1 + 3, y1: y1 + 3 };
}

/** Le bassin, dessiné UNE FOIS : ensuite on ne touche qu'aux opacités. */
function construireCarte() {
  const W = 470, H = 430, MG = 8, MD = 8, MH = 22, MB = 26;
  const b = boite;
  const k = Math.min((W - MG - MD) / (b.x1 - b.x0), (H - MH - MB) / (b.y1 - b.y0));
  const x0 = MG + ((W - MG - MD) - (b.x1 - b.x0) * k) / 2;
  const y0 = MH + ((H - MH - MB) - (b.y1 - b.y0) * k) / 2;
  const X = (x) => x0 + (x - b.x0) * k, Y = (y) => y0 + (y - b.y0) * k;

  // Les mailles sont réparties en bandes de temps ; une bande, un chemin.
  const bandes = Array.from({ length: BANDES }, () => []);
  for (let i = 0; i < carte.temps.length; i++) {
    if (!carte.dedans[i]) continue;
    const x = i % carte.nx, y = (i - (i % carte.nx)) / carte.nx;
    const q = Math.min(BANDES - 1, Math.floor((carte.temps[i] / carte.tc) * BANDES));
    bandes[q].push(`M${X(x).toFixed(1)},${Y(y).toFixed(1)}h${k.toFixed(2)}v${k.toFixed(2)}h-${k.toFixed(2)}Z`);
  }
  const calques = bandes.map((d, q) =>
    `<path id="tcBande${q}" d="${d.join("")}" fill="${RAMPE[q]}" fill-opacity="0.13"/>`).join("");

  const limite = `<path d="${BASSIN.limite.map((p, i) =>
    `${i ? "L" : "M"}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join("")}Z"
    fill="none" stroke="${C.limite}" stroke-width="1.6" stroke-linejoin="round"/>`;
  const accMax = Math.max(...BASSIN.reseau.map((s) => s[4]));
  const reseau = BASSIN.reseau.map(([x1, y1, x2, y2, acc]) =>
    `<line x1="${X(x1).toFixed(1)}" y1="${Y(y1).toFixed(1)}" x2="${X(x2).toFixed(1)}"
       y2="${Y(y2).toFixed(1)}" stroke="${C.reseau}"
       stroke-width="${(0.5 + 2.2 * Math.sqrt(acc / accMax)).toFixed(2)}"
       stroke-linecap="round" opacity=".55"/>`).join("");
  const [xe, ye] = BASSIN.exutoire;
  const loin = carte.pointLePlusLoin;

  el("tcCarte").innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" id="tcSvg" role="img"
      aria-label="Le bassin, ses isochrones et les gouttes qui cheminent vers l'exutoire">
    <g id="tcBandes">${calques}</g>${reseau}${limite}
    <g id="tcIso"></g>
    <circle cx="${X(loin[0]).toFixed(1)}" cy="${Y(loin[1]).toFixed(1)}" r="5" fill="none"
      stroke="${C.loin}" stroke-width="1.6" stroke-dasharray="2.5 2"/>
    <text x="${(X(loin[0]) + (X(loin[0]) > W / 2 ? -9 : 9)).toFixed(1)}"
      y="${(Y(loin[1]) + 4).toFixed(1)}" font-size="10" font-weight="800" fill="${C.loin}"
      text-anchor="${X(loin[0]) > W / 2 ? "end" : "start"}" paint-order="stroke" stroke="#fff"
      stroke-width="3">départ de la plus éloignée</text>
    <circle cx="${X(xe).toFixed(1)}" cy="${Y(ye).toFixed(1)}" r="5" fill="${C.exutoire}"
      stroke="#fff" stroke-width="1.5"/>
    <text x="${(X(xe) + 9).toFixed(1)}" y="${(Y(ye) + 4).toFixed(1)}" font-size="10.5"
      font-weight="800" fill="${C.exutoire}" paint-order="stroke" stroke="#fff"
      stroke-width="3">exutoire</text>
    <g id="tcGouttes"></g>
    <text x="${MG}" y="14" font-size="10.5" font-weight="800" fill="#075985">
      Surface qui contribue</text>
    <text x="${W - MD}" y="${H - 8}" font-size="9" fill="${C.muet}" text-anchor="end">
      teinte : temps de parcours jusqu'à l'exutoire</text>
  </svg>`;
  return { X, Y, k };
}

let proj = null;

/** Hydrogramme et courbe surface–temps, redessinés à chaque image. */
function panneauDebit() {
  const W = 470, H = 300, MG = 46, MD = 58, MH = 22, MB = 34;
  const duree = parseFloat(el("tcDuree").value) * carte.tc;
  const Q = hydrogramme(carte, courbe, { duree });
  const tMax = carte.tc + Math.max(duree, carte.tc * 0.35);
  const kx = (W - MG - MD) / tMax;
  const qs = [];
  for (let u = 0; u <= tMax; u += tMax / 260) qs.push([u, Q(u)]);
  const qMax = Math.max(...qs.map((p) => p[1]), 1e-9);
  const ky = (H - MH - MB) / (qMax * 1.12);
  const X = (u) => MG + u * kx, Y = (q) => H - MB - q * ky;

  const aire = `<path d="M${X(0).toFixed(1)},${(H - MB).toFixed(1)}${
    qs.map(([u, q]) => `L${X(u).toFixed(1)},${Y(q).toFixed(1)}`).join("")}L${X(tMax).toFixed(1)},${(H - MB).toFixed(1)}Z"
    fill="#bae6fd" opacity=".55"/>`;
  const trait = `<path d="${qs.map(([u, q], i) =>
    `${i ? "L" : "M"}${X(u).toFixed(1)},${Y(q).toFixed(1)}`).join("")}"
    fill="none" stroke="#0369a1" stroke-width="2"/>`;
  // La courbe surface–temps, en pointillé, sur la même échelle de temps.
  const sTemps = `<path d="${courbe.map((p, i) =>
    `${i ? "L" : "M"}${X(p.t).toFixed(1)},${(H - MB - p.part * (H - MH - MB) * 0.86).toFixed(1)}`).join("")}"
    fill="none" stroke="${C.muet}" stroke-width="1.4" stroke-dasharray="5 3"/>`;

  const qNow = Q(t);
  const graduations = [];
  for (let u = 0; u <= tMax; u += 60)
    graduations.push(`<line x1="${X(u).toFixed(1)}" y1="${H - MB}" x2="${X(u).toFixed(1)}"
        y2="${H - MB + 4}" stroke="${C.muet}"/>
      <text x="${X(u).toFixed(1)}" y="${H - MB + 15}" font-size="9" fill="${C.muet}"
        text-anchor="middle">${u / 60} h</text>`);

  el("tcDebit").innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img"
      aria-label="Hydrogramme : le débit monte tant que des gouttes arrivent, et plafonne quand le bassin entier contribue">
    <line x1="${X(carte.tc).toFixed(1)}" y1="${MH}" x2="${X(carte.tc).toFixed(1)}"
      y2="${H - MB}" stroke="${C.loin}" stroke-width="1.4" stroke-dasharray="4 3"/>
    <text x="${(X(carte.tc) + 4).toFixed(1)}" y="${MH + 9}" font-size="9.5" font-weight="800"
      fill="${C.loin}">t<tspan font-size="7" dy="2">c</tspan><tspan dy="-2"> = ${fr(carte.tc, 0)} min</tspan></text>
    ${aire}${sTemps}${trait}
    <line x1="${X(t).toFixed(1)}" y1="${MH}" x2="${X(t).toFixed(1)}" y2="${H - MB}"
      stroke="${C.goutte}" stroke-width="1.2"/>
    <circle cx="${X(t).toFixed(1)}" cy="${Y(qNow).toFixed(1)}" r="4" fill="#0369a1"/>
    <line x1="${MG}" y1="${H - MB}" x2="${W - MD}" y2="${H - MB}" stroke="${C.muet}" stroke-width="1"/>
    ${graduations.join("")}
    <text x="${MG}" y="14" font-size="10.5" font-weight="800" fill="#075985">
      Débit à l'exutoire — ${fr(qNow, 1)} m³/s</text>
    <text x="${W - MD + 4}" y="${(Y(qMax) + 4).toFixed(1)}" font-size="9" font-weight="700"
      fill="#0369a1">${fr(qMax, 1)} m³/s<tspan x="${W - MD + 4}" dy="10"
      font-weight="400" fill="${C.muet}">pointe</tspan></text>
    <text x="${W - MD + 4}" y="${(H - MB - (H - MH - MB) * 0.86 + 26).toFixed(1)}" font-size="9"
      fill="${C.muet}">— — surface<tspan x="${W - MD + 4}" dy="10">contributive</tspan></text>
    <text x="${MG}" y="${H - 6}" font-size="9" fill="${C.texte}">averse uniforme de
      ${fr(duree, 0)} min ${duree < carte.tc - 1 ? "— plus courte que t_c : le bassin entier ne contribue jamais"
        : "— au moins t_c : le débit atteint son maximum"}</text>
  </svg>`;
}

/** Ce qui bouge : les opacités des bandes, les gouttes, les compteurs. */
function animer() {
  const part = Math.min(1, t / carte.tc);
  for (let q = 0; q < BANDES; q++) {
    const arrivee = ((q + 1) / BANDES) * carte.tc;
    const noeud = el(`tcBande${q}`);
    if (noeud) noeud.setAttribute("fill-opacity", t >= arrivee ? "0.95"
      : t > (q / BANDES) * carte.tc ? "0.55" : "0.13");
  }
  let contribue = 0;
  for (let i = 0; i < carte.temps.length; i++)
    if (carte.dedans[i] && carte.temps[i] <= t) contribue++;
  el("tcPart").textContent = `${fr((contribue / carte.mailles) * 100, 0)} %`;

  const { X, Y } = proj;
  const marques = [];
  for (const [k, chemin] of gouttes.entries()) {
    const p = positionGoutte(chemin, t);
    if (!p) continue;
    const derniere = k === gouttes.length - 1;
    marques.push(`<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}"
      r="${derniere ? 4.5 : 2.6}" fill="${derniere ? C.loin : C.goutte}"
      ${derniere ? 'stroke="#fff" stroke-width="1.4"' : ""}/>`);
  }
  el("tcGouttes").innerHTML = marques.join("");

  const restant = Math.max(0, carte.tc - t);
  el("tcHeure").textContent = `${fr(t, 0)} min`;
  el("tcRestant").innerHTML = restant > 0.5
    ? `la goutte la plus éloignée est encore à <strong>${fr(restant, 0)} min</strong> de l'exutoire`
    : `<strong>elle est arrivée</strong> — tout le bassin contribue, le débit est maximal`;
  panneauDebit();
}

function recalculer() {
  const v = el("tcVitesses").value.split("/").map(Number);
  carte = tempsDeParcours(BASSIN, { versant: v[0], reseau: v[1] });
  courbe = surfaceTemps(carte, 80);
  gouttes = semisGouttes(carte, 70);
  boite = cadrer(carte);
  proj = construireCarte();
  el("tcTemps").max = String(Math.round(carte.tc * 1.6));
  el("tcTc").textContent = `${fr(carte.tc, 0)} min`;
  animer();
}

function image(ms) {
  if (marche) {
    const duree = 14000;                          // tc + 60 % en quatorze secondes
    t = ((ms - depart) / duree) * carte.tc * 1.6;
    if (t >= carte.tc * 1.6) { t = carte.tc * 1.6; arreter(); }
    el("tcTemps").value = String(t);
    animer();
  }
  boucle = requestAnimationFrame(image);
}
function arreter() { marche = false; el("tcPlay").textContent = t >= carte.tc * 1.6 ? "Rejouer" : "Lecture"; }
function lancer() {
  if (t >= carte.tc * 1.6 - 1e-6) t = 0;
  marche = true;
  depart = performance.now() - (t / (carte.tc * 1.6)) * 14000;
  el("tcPlay").textContent = "Pause";
}

el("tcPlay").addEventListener("click", () => (marche ? arreter() : lancer()));
el("tcTemps").addEventListener("input", () => {
  arreter(); t = parseFloat(el("tcTemps").value); animer();
  el("tcPlay").textContent = t >= carte.tc * 1.6 ? "Rejouer" : "Lecture";
});
el("tcDuree").addEventListener("input", () => {
  el("tcDureeVal").textContent = `${fr(parseFloat(el("tcDuree").value) * carte.tc, 0)} min`;
  animer();
});
el("tcVitesses").addEventListener("change", () => { t = 0; recalculer(); });

recalculer();
el("tcDureeVal").textContent = `${fr(parseFloat(el("tcDuree").value) * carte.tc, 0)} min`;
boucle = requestAnimationFrame(image);
if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) lancer();
