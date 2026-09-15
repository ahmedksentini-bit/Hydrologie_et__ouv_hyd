// Rectangle équivalent dessiné à l'échelle, à côté du disque de même surface.
// Le dessin sert à faire voir ce que l'indice de compacité mesure : l'écart
// entre le contour du bassin et celui du disque le plus ramassé possible.
import { rectangleEquivalent, IC_MINIMUM } from "./solvers-hydro.js";

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
