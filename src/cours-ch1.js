// Rectangle équivalent dessiné à l'échelle, à côté du disque de même surface.
// Le dessin sert à faire voir ce que l'indice de compacité mesure : l'écart
// entre le contour du bassin et celui du disque le plus ramassé possible.
import { rectangleEquivalent, IC_MINIMUM } from "./solvers-hydro.js";
import { chargerJson } from "./donnees.js";

const el = (id) => document.getElementById(id);
const num = (id) => parseFloat((el(id).value || "").replace(",", "."));
const fr = (x, d) => x.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });

function maj() {
  const S = num("qS"), P = num("qP");
  if (!(S > 0 && P > 0)) {
    el("qFig").innerHTML = "";
    el("qOut").textContent = "Renseigner la surface et le périmètre.";
    return;
  }
  const { Ic, L, l, quasiCirculaire } = rectangleEquivalent(S, P);

  // rectangle et disque côte à côte, à la même échelle : les superposer
  // rendait la figure illisible et faisait tomber l'étiquette sur le tracé.
  const rDisque = Math.sqrt(S / Math.PI);
  const ECART = 26;                                  // px entre les deux formes
  const LARGEUR = 430, MARGE = 8, HAUT = 26, BAS = 22;
  const k = (LARGEUR - 2 * MARGE - ECART) / (L + 2 * rDisque);   // px par km
  const hUtile = Math.max(l, 2 * rDisque) * k;
  const H = hUtile + HAUT + BAS;
  const xDisque = MARGE + L * k + ECART;

  el("qFig").innerHTML = `
    <svg viewBox="0 0 ${LARGEUR} ${Math.round(H)}" width="100%" role="img"
         aria-label="Rectangle équivalent et disque de même surface, à la même échelle">
      <rect x="${MARGE}" y="${(HAUT + (hUtile - l * k) / 2).toFixed(1)}"
            width="${(L * k).toFixed(1)}" height="${(l * k).toFixed(1)}"
            fill="#bae6fd" stroke="#0369a1" stroke-width="2" rx="2"/>
      <text x="${MARGE}" y="18" fill="#075985" font-size="11" font-weight="700">
        rectangle équivalent</text>
      <text x="${MARGE}" y="${(H - 6).toFixed(0)}" fill="#0369a1" font-size="11">
        ${fr(L, 2)} × ${fr(l, 2)} km</text>
      <circle cx="${(xDisque + rDisque * k).toFixed(1)}"
              cy="${(HAUT + hUtile / 2).toFixed(1)}" r="${(rDisque * k).toFixed(1)}"
              fill="#ecfeff" stroke="#0891b2" stroke-width="2" stroke-dasharray="5 4"/>
      <text x="${xDisque.toFixed(0)}" y="18" fill="#0e7490" font-size="11" font-weight="700">
        disque de même surface</text>
      <text x="${xDisque.toFixed(0)}" y="${(H - 6).toFixed(0)}" fill="#0e7490" font-size="11">
        rayon ${fr(rDisque, 2)} km</text>
    </svg>`;

  const controle = L * l;
  const forme = Ic < 1.25 ? "ramassé" : Ic < 1.5 ? "modérément allongé" : "très allongé";
  el("qOut").innerHTML = quasiCirculaire
    ? `<strong>I<sub>c</sub> = ${fr(Ic, 3)}</strong> <small>— sous le plancher géométrique
       de ${fr(IC_MINIMUM, 3)} : aucun contour ne peut être plus ramassé qu'un disque.
       Le rectangle dégénère en carré et le contrôle L × l = S ne tient plus
       (${fr(controle, 2)} contre ${fr(S, 2)} km²). Reprendre la mesure du périmètre.</small>`
    : `<strong>I<sub>c</sub> = ${fr(Ic, 3)}</strong> — bassin ${forme}.
       <small>Rectangle ${fr(L, 2)} × ${fr(l, 2)} km ·
       contrôle L × l = ${fr(controle, 2)} km² pour S = ${fr(S, 2)} km².</small>`;
}

for (const id of ["qS", "qP"]) el(id).addEventListener("input", maj);
maj();

// ── Carte du bassin de démonstration et courbe hypsométrique ───────────────
// Les deux figures lisent le MÊME fichier : une carte et une courbe ne sont
// pas deux objets mais deux lectures du même relief, et c'est le propos.

const BV = await chargerJson("data/bassin-demo.json");

const COTES = [
  ["Hmax", "#94a3b8"], ["H5", "#b45309"], ["H50", "#0369a1"],
  ["H95", "#15803d"], ["Hmin", "#94a3b8"],
];

/** Carte du bassin en coordonnées de grille. `zSurligne` met une courbe en avant. */
function carteBassin({ contours = true, reseau = true, limite = true,
                       remplissage = true, route = true, zSurligne = null,
                       hauteurMax = 340 } = {}) {
  const { nx, ny } = BV.grille;
  const poly = (pts) => pts.map((p) => `${p[0]},${p[1]}`).join(" ");

  const fond = remplissage
    ? `<polygon points="${poly(BV.limite)}" fill="#e0f2fe" opacity=".75"/>` : "";

  const isolignes = contours ? BV.contours.map((c) => {
    const vif = zSurligne !== null && c.z === zSurligne;
    return `<polyline points="${poly(c.p)}" fill="none"
      stroke="${vif ? "#b45309" : "#cbd5e1"}" stroke-width="${vif ? 1.3 : 0.45}"
      stroke-linejoin="round"/>`;
  }).join("") : "";

  const cours = reseau ? BV.reseau.map(([x1, y1, x2, y2, a]) =>
    `<line x1="${x1 + 0.5}" y1="${y1 + 0.5}" x2="${x2 + 0.5}" y2="${y2 + 0.5}"
       stroke="#0891b2" stroke-width="${(0.25 + 0.55 * Math.log10(a)).toFixed(2)}"
       stroke-linecap="round"/>`).join("") : "";

  const crete = limite
    ? `<polygon points="${poly(BV.limite)}" fill="none" stroke="#0f172a"
         stroke-width="0.9" stroke-dasharray="2.4 1.6" stroke-linejoin="round"/>` : "";

  const voie = route
    ? `<line x1="0" y1="${BV.ligneRoute + 0.5}" x2="${nx}" y2="${BV.ligneRoute + 0.5}"
         stroke="#7c2d12" stroke-width="1.1" opacity=".75"/>` : "";

  const [ex, ey] = BV.exutoire;
  return `<svg viewBox="0 0 ${nx} ${ny}" class="carte-bv" width="100%"
      style="max-height:${hauteurMax}px" role="img"
      aria-label="Carte du bassin versant : courbes de niveau, réseau, ligne de partage des eaux">
      ${fond}${isolignes}${cours}${crete}${voie}
      <circle cx="${ex + 0.5}" cy="${ey + 0.5}" r="2.2" fill="#b91c1c"/>
      <circle cx="${ex + 0.5}" cy="${ey + 0.5}" r="4" fill="none" stroke="#b91c1c" stroke-width="0.8"/>
    </svg>`;
}

function majCarte() {
  const on = (id) => el(id).checked;
  el("cFig").innerHTML = carteBassin({
    contours: on("cContours"), reseau: on("cReseau"), limite: on("cLimite"),
    remplissage: on("cRemplissage"), route: on("cRoute"),
  });
  const { Ic, L, l } = rectangleEquivalent(BV.aire, BV.perimetre);
  const A = BV.altitudes;
  el("cOut").innerHTML =
    `<strong>S = ${fr(BV.aire, 2)} km² · P = ${fr(BV.perimetre, 2)} km ·
     I<sub>c</sub> = ${fr(Ic, 3)}</strong>
     <small><br>Rectangle équivalent ${fr(L, 2)} × ${fr(l, 2)} km ·
     altitudes de ${fr(A.Hmin, 0)} à ${fr(A.Hmax, 0)} m ·
     exutoire au point rouge, sur le tracé de la route.
     Le périmètre est ici mesuré sur le contour lissé : sur la marche d'escalier des
     cellules il vaudrait ${fr(BV.perimetre / 0.9, 1)} km, et I<sub>c</sub> monterait à
     ${fr(rectangleEquivalent(BV.aire, BV.perimetre / 0.9).Ic, 3)}. Le paragraphe suivant
     dit pourquoi : le périmètre dépend de la finesse du tracé, et I<sub>c</sub> lui est
     proportionnel.</small>`;
}

/** Part de la surface située au-dessus d'une altitude, lue sur l'hypsométrie. */
function fractionAuDessus(z) {
  const h = BV.hypsometrie;                          // [altitude, fraction], décroissant
  if (z >= h[0][0]) return 0;
  if (z <= h[h.length - 1][0]) return 1;
  for (let i = 1; i < h.length; i++)
    if (h[i][0] <= z) {
      const [z1, f1] = h[i - 1], [z0, f0] = h[i];
      return z1 === z0 ? f0 : f1 + ((z1 - z) / (z1 - z0)) * (f0 - f1);
    }
  return 1;
}

function courbeHypso(zLue) {
  const L = 340, H = 300, MG = 44, MD = 52, MH = 12, MB = 34;
  const A = BV.altitudes;
  const zMin = Math.floor(A.Hmin / 50) * 50, zMax = Math.ceil(A.Hmax / 50) * 50;
  const px = (f) => MG + f * (L - MG - MD);
  const py = (z) => H - MB - ((z - zMin) / (zMax - zMin)) * (H - MH - MB);

  const trace = BV.hypsometrie.map(([z, f], i) =>
    `${i ? "L" : "M"}${px(f).toFixed(1)},${py(z).toFixed(1)}`).join("");

  const reperes = COTES.map(([cle, couleur]) => {
    const z = A[cle], f = fractionAuDessus(z);
    return `<line x1="${MG}" y1="${py(z).toFixed(1)}" x2="${px(f).toFixed(1)}"
        y2="${py(z).toFixed(1)}" stroke="${couleur}" stroke-width="1"
        stroke-dasharray="3 2" opacity=".8"/>
      <text x="${L - MD + 4}" y="${(py(z) + 3).toFixed(1)}" font-size="10" fill="${couleur}"
        font-weight="700">${cle} ${Math.round(z)}</text>`;
  }).join("");

  const f = fractionAuDessus(zLue);
  const lecture = `<line x1="${MG}" y1="${py(zLue).toFixed(1)}" x2="${(L - MD).toFixed(1)}"
      y2="${py(zLue).toFixed(1)}" stroke="#b45309" stroke-width="1.6"/>
    <line x1="${px(f).toFixed(1)}" y1="${MH}" x2="${px(f).toFixed(1)}"
      y2="${H - MB}" stroke="#b45309" stroke-width="1" stroke-dasharray="4 3"/>
    <circle cx="${px(f).toFixed(1)}" cy="${py(zLue).toFixed(1)}" r="4.5" fill="#b45309"/>`;

  const graduations = [0, 0.25, 0.5, 0.75, 1].map((v) =>
    `<text x="${px(v).toFixed(1)}" y="${H - MB + 14}" font-size="10" fill="#64748b"
       text-anchor="middle">${Math.round(v * 100)}</text>`).join("");
  const altitudes = [];
  for (let z = zMin; z <= zMax; z += 100)
    altitudes.push(`<line x1="${MG}" y1="${py(z).toFixed(1)}" x2="${(L - MD).toFixed(1)}"
        y2="${py(z).toFixed(1)}" stroke="#eef2f7" stroke-width="1"/>
      <text x="${MG - 6}" y="${(py(z) + 3).toFixed(1)}" font-size="10" fill="#64748b"
        text-anchor="end">${z}</text>`);

  return `<svg viewBox="0 0 ${L} ${H}" width="100%" role="img"
      aria-label="Courbe hypsométrique : altitude en fonction de la part de surface située au-dessus">
      ${altitudes.join("")}${graduations}
      <path d="${trace}" fill="none" stroke="#0369a1" stroke-width="2.2"/>
      ${reperes}${lecture}
      <text x="${MG}" y="${H - 6}" font-size="10" fill="#475569">% de la surface au-dessus</text>
      <text transform="translate(12,${(H / 2).toFixed(0)}) rotate(-90)" font-size="10"
            fill="#475569" text-anchor="middle">altitude (m)</text>
    </svg>`;
}

function majHypso() {
  const z = parseFloat(el("hAlt").value);
  el("hAltVal").textContent = `${z} m`;
  el("hFig").innerHTML = `<div class="duo">
    <div>${carteBassin({ zSurligne: z, route: false, hauteurMax: 300 })}</div>
    <div>${courbeHypso(z)}</div></div>`;

  const A = BV.altitudes;
  const f = fractionAuDessus(z);
  const { L } = rectangleEquivalent(BV.aire, BV.perimetre);
  const Ig = (A.H5 - A.H95) / L;
  el("hOut").innerHTML =
    `<strong>Au-dessus de ${fr(z, 0)} m : ${fr(f * 100, 1)} % de la surface</strong>,
     soit ${fr(f * BV.aire, 2)} km² sur ${fr(BV.aire, 2)}.
     <small><br>I<sub>g</sub> = (H5 % − H95 %) / L<sub>rect</sub> =
     (${fr(A.H5, 1)} − ${fr(A.H95, 1)}) / ${fr(L, 2)} = <strong>${fr(Ig, 1)} m/km</strong>.
     En prenant H<sub>max</sub> − H<sub>min</sub> à la place, on obtiendrait
     ${fr((A.Hmax - A.Hmin) / L, 1)} m/km, soit
     ${fr(((A.Hmax - A.Hmin) / (A.H5 - A.H95) - 1) * 100, 0)} % de plus —
     pour deux points qui ne portent presque aucune surface. C'est la raison des
     quantiles 5 % et 95 %.</small>`;
}

for (const id of ["cContours", "cReseau", "cLimite", "cRemplissage", "cRoute"])
  el(id).addEventListener("change", majCarte);
el("hAlt").addEventListener("input", majHypso);
majCarte();
majHypso();
