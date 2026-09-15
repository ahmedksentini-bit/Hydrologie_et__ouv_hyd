// Ajustement d'une série de maxima annuels par la loi de Gumbel, tracé sur le
// papier où la loi devient une droite : en abscisse la variable réduite, en
// ordonnée la pluie. Les points empiriques jugent l'ajustement à l'œil.
import { ajustementGumbel, quantileGumbel, positionTracage,
         variableReduite, gumbel } from "./solvers-hydro.js";

const el = (id) => document.getElementById(id);
const fr = (x, d) => x.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
const PERIODES = [2, 5, 10, 20, 50, 100];

function lireSerie() {
  return (el("gSerie").value || "")
    .split(/[\s,;]+/).map((v) => parseFloat(v.replace(",", ".")))
    .filter((v) => Number.isFinite(v) && v > 0);
}

function figure(serie, ajust) {
  const L = 470, H = 260, MG = 46, MD = 12, MH = 14, MB = 30;
  const yMin = -1.5, yMax = 5.0;                       // variable réduite affichée
  const xs = [...serie].sort((a, b) => b - a);
  const pMax = Math.max(quantileGumbel(ajust, 100), xs[0]) * 1.08;
  const px = (y) => MG + ((y - yMin) / (yMax - yMin)) * (L - MG - MD);
  const py = (p) => H - MB - (p / pMax) * (H - MH - MB);

  const droite = `<line x1="${px(yMin).toFixed(1)}" y1="${py(ajust.mode + ajust.gradex * yMin).toFixed(1)}"
      x2="${px(yMax).toFixed(1)}" y2="${py(ajust.mode + ajust.gradex * yMax).toFixed(1)}"
      stroke="#0369a1" stroke-width="2"/>`;

  const points = xs.map((x, i) => {
    const F = positionTracage(i + 1, serie.length);
    return `<circle cx="${px(variableReduite(F)).toFixed(1)}" cy="${py(x).toFixed(1)}"
            r="3" fill="#0891b2" opacity=".85"/>`;
  }).join("");

  const graduations = PERIODES.map((T) => {
    const x = px(gumbel(T));
    return `<line x1="${x.toFixed(1)}" y1="${MH}" x2="${x.toFixed(1)}" y2="${H - MB}"
              stroke="#dbe5ed" stroke-width="1"/>
            <text x="${x.toFixed(1)}" y="${H - MB + 13}" font-size="10" fill="#64748b"
              text-anchor="middle">${T}</text>`;
  }).join("");

  const ordonnees = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const p = f * pMax;
    return `<line x1="${MG}" y1="${py(p).toFixed(1)}" x2="${L - MD}" y2="${py(p).toFixed(1)}"
              stroke="#eef2f7" stroke-width="1"/>
            <text x="${MG - 6}" y="${(py(p) + 3).toFixed(1)}" font-size="10" fill="#64748b"
              text-anchor="end">${Math.round(p)}</text>`;
  }).join("");

  el("gFig").innerHTML = `<svg viewBox="0 0 ${L} ${H}" width="100%" role="img"
      aria-label="Ajustement de Gumbel : pluie en fonction de la variable réduite">
      ${ordonnees}${graduations}${droite}${points}
      <text x="${MG}" y="${H - 4}" font-size="10" fill="#475569">période de retour (ans)</text>
      <text transform="translate(13,${(H / 2).toFixed(0)}) rotate(-90)" font-size="10"
            fill="#475569" text-anchor="middle">pluie journalière (mm)</text>
    </svg>`;
}

function maj() {
  const serie = lireSerie();
  const ajust = ajustementGumbel(serie);
  if (!ajust) {
    el("gFig").innerHTML = ""; el("gTable").innerHTML = "";
    el("gOut").textContent = "Saisir au moins deux maxima annuels.";
    return;
  }
  figure(serie, ajust);
  el("gTable").innerHTML = `<table class="resultats"><thead><tr>
      <th>T (ans)</th>${PERIODES.map((T) => `<th>${T}</th>`).join("")}</tr></thead>
    <tbody>
      <tr><td>variable réduite y</td>${PERIODES.map((T) =>
        `<td class="q">${fr(gumbel(T), 2)}</td>`).join("")}</tr>
      <tr><td>pluie ajustée (mm)</td>${PERIODES.map((T) =>
        `<td class="q">${fr(quantileGumbel(ajust, T), 1)}</td>`).join("")}</tr>
    </tbody></table>`;

  const maxObs = Math.max(...serie);
  const tEmpirique = 1 / (1 - positionTracage(1, ajust.n));
  el("gOut").innerHTML =
    `<strong>n = ${ajust.n} ans</strong> · moyenne ${fr(ajust.moyenne, 1)} mm ·
     écart-type ${fr(ajust.ecartType, 1)} mm ·
     gradex a = ${fr(ajust.gradex, 2)} · mode u = ${fr(ajust.mode, 2)}
     <small> — le maximum observé (${fr(maxObs, 0)} mm) se place à T = ${fr(tEmpirique, 0)} ans,
     et non à ${ajust.n} ans. Au-delà de ${ajust.n} ans environ, la lecture est une
     extrapolation : elle s'écrit.</small>`;
}

el("gSerie").addEventListener("input", maj);
maj();
