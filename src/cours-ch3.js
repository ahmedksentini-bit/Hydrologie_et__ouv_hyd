// Faisceau des courbes intensité–durée–fréquence, en échelles logarithmiques :
// la forme i = a·t^(−b)·T^c y devient une famille de droites parallèles, dont
// l'écartement est commandé par c et la pente par b.
import { montana, dureeEffective } from "./solvers-hydro.js";

const el = (id) => document.getElementById(id);
const num = (id) => parseFloat((el(id).value || "").replace(",", "."));
const fr = (x, d) => x.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });

const DUREES = [5, 1440];                       // bornes de l'axe des durées, en minutes
const REPERES_T = [5, 15, 30, 60, 180, 720, 1440];
const COURBES = [2, 10, 100];

function maj() {
  const a = num("iA"), b = num("iB"), c = num("iC");
  const tc = num("iTc"), T = num("iT"), P10 = num("iP10");
  const tmin = num("iTmin") || 0;
  const tUtilise = dureeEffective(tc, tmin);   // une IDF ne s'extrapole pas sous sa durée de calage
  if (!(a > 0 && b > 0 && tc > 0 && T > 1)) {
    el("iFig").innerHTML = "";
    el("iOut").textContent = "Renseigner a, b, le temps de concentration et la période de retour.";
    return;
  }

  const L = 470, H = 270, MG = 42, MD = 14, MH = 14, MB = 34;
  const iMax = montana(a, b, c, DUREES[0], Math.max(100, T));
  const iMin = montana(a, b, c, DUREES[1], 2);
  const lx = (t) => MG + ((Math.log10(t) - Math.log10(DUREES[0])) /
    (Math.log10(DUREES[1]) - Math.log10(DUREES[0]))) * (L - MG - MD);
  const ly = (i) => H - MB - ((Math.log10(i) - Math.log10(iMin)) /
    (Math.log10(iMax) - Math.log10(iMin))) * (H - MH - MB);

  const courbe = (Tc, couleur, largeur) => {
    const pts = [];
    for (let k = 0; k <= 40; k++) {
      const t = DUREES[0] * Math.pow(DUREES[1] / DUREES[0], k / 40);
      pts.push(`${lx(t).toFixed(1)},${ly(montana(a, b, c, t, Tc)).toFixed(1)}`);
    }
    return `<polyline points="${pts.join(" ")}" fill="none" stroke="${couleur}" stroke-width="${largeur}"/>`;
  };

  const grille = REPERES_T.map((t) =>
    `<line x1="${lx(t).toFixed(1)}" y1="${MH}" x2="${lx(t).toFixed(1)}" y2="${H - MB}"
       stroke="#eef2f7" stroke-width="1"/>
     <text x="${lx(t).toFixed(1)}" y="${H - MB + 13}" font-size="9.5" fill="#64748b"
       text-anchor="middle">${t >= 60 ? t / 60 + " h" : t}</text>`).join("");

  const niveaux = [1, 2, 5, 10, 20, 50, 100, 200].filter((v) => v >= iMin && v <= iMax);
  const ordonnees = niveaux.map((v) =>
    `<line x1="${MG}" y1="${ly(v).toFixed(1)}" x2="${L - MD}" y2="${ly(v).toFixed(1)}"
       stroke="#eef2f7" stroke-width="1"/>
     <text x="${MG - 5}" y="${(ly(v) + 3).toFixed(1)}" font-size="9.5" fill="#64748b"
       text-anchor="end">${v}</text>`).join("");

  const i = montana(a, b, c, tUtilise, T);
  const xPt = lx(Math.max(tUtilise, DUREES[0]));
  const borne = tUtilise > tc + 1e-9
    ? `<line x1="${lx(DUREES[0]).toFixed(1)}" y1="${MH}" x2="${lx(DUREES[0]).toFixed(1)}"
             y2="${H - MB}" stroke="#b45309" stroke-width="1.5"/>` : "";
  const marqueur = `${borne}
    <line x1="${xPt.toFixed(1)}" y1="${ly(i).toFixed(1)}" x2="${xPt.toFixed(1)}"
          y2="${H - MB}" stroke="#b45309" stroke-width="1" stroke-dasharray="3 3"/>
    <line x1="${MG}" y1="${ly(i).toFixed(1)}" x2="${xPt.toFixed(1)}" y2="${ly(i).toFixed(1)}"
          stroke="#b45309" stroke-width="1" stroke-dasharray="3 3"/>
    <circle cx="${xPt.toFixed(1)}" cy="${ly(i).toFixed(1)}" r="4.5" fill="#b45309"/>`;

  el("iFig").innerHTML = `<svg viewBox="0 0 ${L} ${H}" width="100%" role="img"
      aria-label="Courbes intensité-durée-fréquence en échelles logarithmiques">
      ${ordonnees}${grille}
      ${COURBES.map((Tc) => courbe(Tc, "#93c5fd", 1.6)).join("")}
      ${courbe(T, "#0369a1", 2.4)}
      ${marqueur}
      ${COURBES.map((Tc) => `<text x="${L - MD - 2}" y="${(ly(montana(a, b, c, DUREES[1], Tc)) - 4).toFixed(1)}"
         font-size="9.5" fill="#3b82f6" text-anchor="end">T = ${Tc}</text>`).join("")}
      <text x="${MG}" y="${H - 4}" font-size="10" fill="#475569">durée (min, puis h)</text>
      <text transform="translate(12,${(H / 2).toFixed(0)}) rotate(-90)" font-size="10"
            fill="#475569" text-anchor="middle">intensité (mm/h)</text>
    </svg>`;

  const lame = (i * tUtilise) / 60;
  const part = P10 > 0 ? (lame / P10) * 100 : NaN;
  const alerte = P10 > 0 && lame > 0.8 * P10;
  const ecrete = tUtilise > tc + 1e-9;
  el("iOut").innerHTML =
    `<strong>i = ${fr(i, 2)} mm/h</strong> à ${ecrete
        ? `la durée minimale calée de ${fr(tUtilise, 1)} min` : `t<sub>c</sub> = ${fr(tc, 1)} min`}
     et T = ${fr(T, 0)} ans.
     <small> — lame d'eau ${fr(lame, 1)} mm${Number.isFinite(part)
        ? `, soit ${fr(part, 0)} % de la P10 journalière du site` : ""}.
     ${ecrete ? `Le temps de concentration annoncé (${fr(tc, 1)} min) est sous la durée de
        calage : la courbe n'y est pas renseignée et l'intensité est évaluée à la borne.
        Un t<sub>c</sub> aussi court doit d'abord être vérifié — c'est souvent une erreur
        d'unité.` : alerte ? "Au-delà de 80 % de P10 : vérifier l'unité de durée des coefficients."
              : "Proportion plausible pour une averse de cette durée."}</small>`;
}

for (const id of ["iA", "iB", "iC", "iTc", "iT", "iP10"]) el(id).addEventListener("input", maj);
maj();
