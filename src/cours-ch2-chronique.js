// D'où vient la série des maxima annuels.
//
// Le chapitre commence par « une valeur par an » sans jamais montrer ce qu'on
// jette pour l'obtenir. Trois dessins le montrent : la chronique de vingt ans,
// une année isolée, et le profil de l'année civile — celui qui fait apparaître
// les quatre-vingts jours où il n'a JAMAIS plu en vingt ans.
//
// La chronique est construite pour que ses maxima annuels soient exactement la
// série que le calculateur ajuste plus bas. Les deux figures parlent du même
// poste ; changer la série change la chronique.
import { chronique, statistiques, moisDe, MOIS, NOMS_MOIS, JOURS_AN }
  from "./solvers-chronique.js";

const el = (id) => document.getElementById(id);
const fr = (x, d) => Number.isFinite(x)
  ? x.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";

const C = {
  pluie: "#7dd3fc", pluieForte: "#0284c7", max: "#b45309", axe: "#94a3b8",
  texte: "#334155", muet: "#94a3b8", sec: "#fca5a5", grille: "#eef2f7",
};

const lireSerie = () => (el("gSerie")?.value || "")
  .split(/[\s,;]+/).map((v) => parseFloat(v.replace(",", ".")))
  .filter((v) => Number.isFinite(v) && v > 0);

let etat = null;

/** Panneau 1 — les vingt ans, jour par jour. */
function vingtAns(c, st) {
  const W = 980, H = 236, MG = 46, MD = 12, MH = 18, MB = 34;
  const n = c.jours.length;
  const kx = (W - MG - MD) / n;
  const yMax = Math.max(...c.maxima.map((m) => m.valeur)) * 1.08;
  const ky = (H - MH - MB) / yMax;
  const X = (j) => MG + j * kx, Y = (v) => H - MB - v * ky;

  const traits = [];
  for (let j = 0; j < n; j++) {
    const v = c.jours[j];
    if (v <= 0) continue;
    traits.push(`M${X(j).toFixed(2)},${(H - MB).toFixed(1)}V${Y(v).toFixed(2)}`);
  }
  const separations = [];
  for (let a = 0; a <= c.annees; a++) {
    const x = X(a * JOURS_AN);
    separations.push(`<line x1="${x.toFixed(1)}" y1="${MH}" x2="${x.toFixed(1)}"
        y2="${H - MB}" stroke="${C.grille}" stroke-width="1"/>`);
    if (a < c.annees && a % 2 === 0)
      separations.push(`<text x="${(x + (JOURS_AN * kx) / 2).toFixed(1)}" y="${H - MB + 13}"
        font-size="9.5" fill="${C.muet}" text-anchor="middle">an ${a + 1}</text>`);
  }
  const niveaux = [25, 50, 75, 100].filter((v) => v < yMax).map((v) =>
    `<line x1="${MG}" y1="${Y(v).toFixed(1)}" x2="${W - MD}" y2="${Y(v).toFixed(1)}"
       stroke="${C.grille}" stroke-width="1"/>
     <text x="${MG - 5}" y="${(Y(v) + 3).toFixed(1)}" font-size="9.5" fill="${C.muet}"
       text-anchor="end">${v}</text>`).join("");

  const pointes = c.maxima.map((m) => `
    <line x1="${X(m.jour).toFixed(2)}" y1="${(H - MB).toFixed(1)}" x2="${X(m.jour).toFixed(2)}"
      y2="${Y(m.valeur).toFixed(2)}" stroke="${C.max}" stroke-width="1.6"/>
    <circle cx="${X(m.jour).toFixed(2)}" cy="${Y(m.valeur).toFixed(2)}" r="3"
      fill="${C.max}" stroke="#fff" stroke-width="1"/>`).join("");

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img"
      aria-label="Pluies journalières sur vingt ans : des grappes en saison humide, des étés vides, et le maximum de chaque année mis en évidence">
    ${niveaux}${separations.join("")}
    <path d="${traits.join("")}" stroke="${C.pluie}" stroke-width="0.7" fill="none"/>
    ${pointes}
    <line x1="${MG}" y1="${H - MB}" x2="${W - MD}" y2="${H - MB}" stroke="${C.axe}" stroke-width="1"/>
    <text x="${MG}" y="${MH - 5}" font-size="10" font-weight="800" fill="#075985">
      pluie journalière (mm) — ${fr(st.jours, 0)} jours</text>
    <text x="${W - MD}" y="${MH - 5}" font-size="10" font-weight="800" fill="${C.max}"
      text-anchor="end">● les ${c.annees} maxima annuels — tout le reste est écarté</text>
  </svg>`;
}

/** Panneau 2 — une année, jour par jour. */
function uneAnnee(c, an) {
  const W = 980, H = 190, MG = 46, MD = 12, MH = 18, MB = 32;
  const jours = c.jours.slice(an * JOURS_AN, (an + 1) * JOURS_AN);
  const m = c.maxima[an];
  const kx = (W - MG - MD) / JOURS_AN;
  const yMax = Math.max(m.valeur * 1.12, 20);
  const ky = (H - MH - MB) / yMax;
  const X = (j) => MG + j * kx, Y = (v) => H - MB - v * ky;

  const barres = jours.map((v, j) => v <= 0 ? "" :
    `<line x1="${X(j + 0.5).toFixed(2)}" y1="${(H - MB).toFixed(1)}"
       x2="${X(j + 0.5).toFixed(2)}" y2="${Y(v).toFixed(2)}"
       stroke="${j === m.jourAn ? C.max : C.pluieForte}" stroke-width="1.8"
       opacity="${j === m.jourAn ? 1 : 0.75}"/>`).join("");

  let debut = 0;
  const mois = MOIS.map((d, k) => {
    const x0 = X(debut), x1 = X(debut + d);
    debut += d;
    return `<line x1="${x0.toFixed(1)}" y1="${MH}" x2="${x0.toFixed(1)}" y2="${H - MB}"
        stroke="${C.grille}" stroke-width="1"/>
      <text x="${((x0 + x1) / 2).toFixed(1)}" y="${H - MB + 13}" font-size="9.5"
        fill="${k >= 5 && k <= 7 ? "#b91c1c" : C.muet}" text-anchor="middle">${NOMS_MOIS[k]}</text>`;
  }).join("");

  const pluvieux = jours.filter((v) => v > 0).length;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img"
      aria-label="Une année de la chronique, jour par jour, avec son maximum">
    ${mois}
    <line x1="${MG}" y1="${H - MB}" x2="${W - MD}" y2="${H - MB}" stroke="${C.axe}" stroke-width="1"/>
    ${barres}
    <line x1="${X(m.jourAn + 0.5).toFixed(2)}" y1="${Y(m.valeur).toFixed(2)}"
      x2="${(X(m.jourAn + 0.5) + 30).toFixed(2)}" y2="${(Y(m.valeur) - 10).toFixed(2)}"
      stroke="${C.max}" stroke-width="0.9"/>
    <text x="${(X(m.jourAn + 0.5) + 33).toFixed(2)}" y="${(Y(m.valeur) - 8).toFixed(2)}"
      font-size="10.5" font-weight="800" fill="${C.max}">${fr(m.valeur, 0)} mm —
      la valeur retenue pour l'an ${an + 1}</text>
    <text x="${MG}" y="${MH - 5}" font-size="10" font-weight="800" fill="#075985">
      an ${an + 1} — ${pluvieux} jours de pluie, ${JOURS_AN - pluvieux} jours secs,
      ${fr(jours.reduce((a, v) => a + v, 0), 0)} mm au total</text>
  </svg>`;
}

/** Panneau 3 — le profil de l'année civile, sur les vingt ans cumulés. */
function profilAnnuel(c, st) {
  const W = 980, H = 150, MG = 46, MD = 12, MH = 18, MB = 32;
  const kx = (W - MG - MD) / JOURS_AN;
  const yMax = Math.max(...st.profil, 1);
  const ky = (H - MH - MB) / (yMax * 1.1);      // un peu d'air : les plus hautes barres
                                                // touchaient le bord supérieur
  const X = (j) => MG + j * kx, Y = (v) => H - MB - v * ky;

  const barres = st.profil.map((v, j) =>
    `<line x1="${X(j + 0.5).toFixed(2)}" y1="${(H - MB).toFixed(1)}"
       x2="${X(j + 0.5).toFixed(2)}" y2="${Y(v).toFixed(2)}"
       stroke="${v === 0 ? C.sec : C.pluieForte}" stroke-width="1.8"
       opacity="${v === 0 ? 1 : 0.8}"/>`).join("");
  // Les jours à zéro sont soulignés : c'est eux qu'il faut voir.
  const zeros = st.profil.map((v, j) => v === 0
    ? `<line x1="${X(j).toFixed(2)}" y1="${(H - MB + 2).toFixed(1)}" x2="${X(j + 1).toFixed(2)}"
        y2="${(H - MB + 2).toFixed(1)}" stroke="${C.sec}" stroke-width="3"/>` : "").join("");

  let debut = 0;
  const mois = MOIS.map((d, k) => {
    const x0 = X(debut), x1 = X(debut + d);
    debut += d;
    return `<text x="${((x0 + x1) / 2).toFixed(1)}" y="${H - MB + 15}" font-size="9.5"
      fill="${C.muet}" text-anchor="middle">${NOMS_MOIS[k]}</text>`;
  }).join("");

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img"
      aria-label="Pour chaque jour de l'année, le nombre d'années sur vingt où il a plu ce jour-là">
    <line x1="${MG}" y1="${Y(yMax).toFixed(1)}" x2="${W - MD}" y2="${Y(yMax).toFixed(1)}"
      stroke="${C.grille}" stroke-width="1"/>
    <text x="${MG - 5}" y="${(Y(yMax) + 3).toFixed(1)}" font-size="9.5" fill="${C.muet}"
      text-anchor="end">${yMax}</text>
    ${barres}${zeros}${mois}
    <line x1="${MG}" y1="${H - MB}" x2="${W - MD}" y2="${H - MB}" stroke="${C.axe}" stroke-width="1"/>
    <text x="${MG}" y="${MH - 5}" font-size="10" font-weight="800" fill="#075985">
      sur les ${c.annees} ans, en combien d'années a-t-il plu ce jour-là ?</text>
    <text x="${W - MD}" y="${MH - 5}" font-size="10" font-weight="800" fill="#b91c1c"
      text-anchor="end">${st.jamais} jours de l'année n'ont jamais vu la pluie</text>
  </svg>`;
}

function maj() {
  const serie = lireSerie();
  if (serie.length < 2) return;
  const c = chronique(serie);
  const st = statistiques(c);
  etat = { c, st };
  el("chAns").max = String(c.annees);
  const an = Math.min(Math.max(parseInt(el("chAns").value, 10) || 1, 1), c.annees) - 1;
  el("chAnsVal").textContent = `an ${an + 1}`;
  el("chVingt").innerHTML = vingtAns(c, st);
  el("chAnnee").innerHTML = uneAnnee(c, an);
  el("chProfil").innerHTML = profilAnnuel(c, st);
  el("chJours").textContent = fr(st.jours, 0);
  el("chPluvieux").textContent = fr(st.pluvieux, 0);
  el("chSecs").textContent = `${fr(st.secs, 0)} (${fr(st.partSecs * 100, 0)} %)`;
  el("chTotal").textContent = `${fr(st.totalAnnuel, 0)} mm`;
  el("chRetenus").textContent = `${st.retenus} sur ${fr(st.jours, 0)} — ${fr(st.partRetenue * 100, 2)} %`;
  el("chJamais").textContent = `${st.jamais} jours`;
}

el("chAns").addEventListener("input", maj);
el("gSerie")?.addEventListener("input", maj);
maj();
