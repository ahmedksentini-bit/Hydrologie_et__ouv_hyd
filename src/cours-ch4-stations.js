// Carte interactive des lectures SOGREAH. Les planches du chapitre sont des
// images : on y lit une zone, on n'y clique pas. Cette carte porte les mêmes
// valeurs, mais rattachées à des coordonnées — et cliquer une localité donne la
// lecture complète, puis ce que la formule en fait.
//
// Échelle de couleur : une seule teinte, du clair au foncé (magnitude), en cinq
// pas contrôlés — clarté monotone, écart suffisant entre pas voisins, et le pas
// le plus clair au-dessus du plancher de contraste 2:1 sur le fond de carte.
// Jamais d'arc-en-ciel : la couleur doit se lire comme un ordre.
import { sogreahPluie, sogreahDebit, sogreahRuisselle, gumbel } from "./solvers-hydro.js";
import { RAMPE_SEQUENTIELLE, ABSENT, classer, couleurDe } from "./echelle.js";
import { chargerFrontieres, projection, fondDeCarte, graticule, FOND } from "./carte-fond.js";

const el = (id) => document.getElementById(id);
const fr = (x, d) => Number.isFinite(x)
  ? x.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";

const JEU = await fetch("data/stations-sogreah.json").then((r) => r.json());
const FRONTIERES = await chargerFrontieres();
const RAMPE = RAMPE_SEQUENTIELLE;

let choisie = JEU.stations.find((s) => s.nom === "Kasserine");

/** Classes de couleur : une par valeur distincte, le couple le plus serré fusionnant au-delà de cinq. */
const classes = (grandeur) =>
  classer(JEU.stations.map((s) => s[grandeur])).map((c) => ({ ...c,
    libelle: c.valeurs.length === 1 ? String(c.min) : `${c.min}–${c.max}` }));


function carte(grandeur, cls) {
  const FENETRE = { lon0: 7.7, lat0: 32.4, lon1: 11.7, lat1: 36.1 };
  const proj = projection(FENETRE, { largeurMax: 420, hauteurMax: 340,
                                     mg: 40, md: 12, mh: 12, mb: 28 });
  const { px, py, zone } = proj;
  const W = Math.round(proj.largeur), H = Math.round(proj.hauteur);
  const base = fondDeCarte(FRONTIERES, px, py, zone, FENETRE, "clipSogreah");

  // Seule la station retenue porte son nom : dix-neuf étiquettes sur une carte
  // de cette taille ne se lisent pas. Les autres se survolent.
  const points = [...JEU.stations].sort((a, b) => a.lat - b.lat).map((s) => {
    const i = JEU.stations.indexOf(s);
    const x = px(s.lon), y = py(s.lat);
    const actif = s.nom === choisie.nom;
    const aGauche = s.lon > 10.4;
    const v = s[grandeur];
    return `<g class="station${actif ? " actif" : ""}" data-i="${i}" tabindex="0"
        role="button" aria-label="${s.nom}, ${grandeur} ${v === null ? "non lu" : v + " mm"}">
      <title>${s.nom} — ${grandeur} ${v === null ? "non lu" : v + " mm"}</title>
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${actif ? 8 : 5.5}"
        fill="${couleurDe(v, cls)}" stroke="${actif ? "#0f172a" : FOND.principal}"
        stroke-width="${actif ? 2.4 : 2}"/>
      ${actif ? `<text x="${(x + (aGauche ? -12 : 12)).toFixed(1)}" y="${(y + 3.5).toFixed(1)}"
        font-size="11" fill="#0f172a" font-weight="800" paint-order="stroke"
        stroke="${FOND.principal}" stroke-width="3"
        text-anchor="${aGauche ? "end" : "start"}">${s.nom}</text>` : ""}
    </g>`;
  }).join("");

  return `<svg viewBox="0 0 ${W} ${H}" class="carte-bv" width="100%" role="img"
      aria-label="Carte de la Tunisie et des localités où les cartes SOGREAH ont été lues">
    <defs>${base.defs}</defs>${base.fond}
    ${graticule(px, py, zone, [8, 9, 10, 11], [33, 34, 35, 36])}
    ${base.reperes}<g clip-path="url(#clipSogreah)">${points}</g></svg>`;
}

function legende(grandeur, cls) {
  const g = JEU.grandeurs.find((x) => x.id === grandeur);
  return `<div class="echelle">
    <small>${g.libelle} (${g.unite})</small>
    <div class="echelle-pas">${cls.map((c) =>
      `<span><i style="background:${c.couleur}"></i>${c.libelle}</span>`).join("")}
      ${JEU.stations.some((s) => s[grandeur] === null)
        ? `<span><i style="background:${ABSENT}"></i>non lu</span>` : ""}</div>
  </div>`;
}

function fiche() {
  const T = parseFloat(el("stT").value), S = parseFloat((el("stS").value || "").replace(",", "."));
  const s = choisie;
  const lignes = [
    ["Coordonnées", `${fr(s.lon, 2)}° E · ${fr(s.lat, 2)}° N`],
    ["Seuil de ruissellement P₀", s.P0 === null ? "non lu" : `${s.P0} mm`],
    ["Pluie décennale P₁₀", s.P10 === null ? "non lu sur la planche" : `${s.P10} mm`],
    ["Pluie centennale P₁₀₀", s.P100 === null ? "non lu" : `${s.P100} mm`],
  ];

  let calcul = "";
  if (s.P10 === null || s.P100 === null) {
    calcul = `<p class="method-note"><strong>Lecture incomplète.</strong> La planche ne porte
      pas de valeur exploitable de P₁₀ à ${s.nom} : la pluie de projet ne peut pas s'interpoler,
      et la formule ne sort pas. Ce n'est pas une panne — c'est l'étendue de la planche.</p>`;
  } else {
    const PT = sogreahPluie(T, s.P10, s.P100);
    const seuil = sogreahRuisselle(PT, s.P0);
    const Q = sogreahDebit(S, PT, s.P0);
    lignes.push(["Pluie de projet P_T à " + T + " ans",
      `${fr(PT, 1)} mm — interpolée en variable de Gumbel (y = ${fr(gumbel(T), 2)})`]);
    calcul = seuil.ruisselle
      ? `<p class="final-result"><strong>Q = ${fr(Q, 1)} m³/s</strong> sur ${fr(S, 0)} km²
         <small><br>Q = S<sup>0,75</sup>·(P_T − P₀)/12 = ${fr(Math.pow(S, 0.75), 2)} ×
         (${fr(PT, 1)} − ${s.P0}) / 12. Débit spécifique ${fr(Q / S, 2)} m³/s/km².</small></p>`
      : `<p class="final-result"><strong>Aucun débit à ${T} ans.</strong>
         <small><br>${seuil.motif}. Ce n'est pas un zéro par défaut : c'est le seuil de
         ruissellement qui n'est pas atteint. Dans le Sud saharien, P₀ = 50 mm dépasse la
         pluie journalière décennale de 40 mm — il faut une crue plus rare pour que quoi que
         ce soit ruisselle.</small></p>`;
  }

  el("stFiche").innerHTML = `<h4 style="margin:0 0 10px">${s.nom}</h4>
    <table class="resultats"><tbody>${lignes.map(([a, b]) =>
      `<tr><td>${a}</td><td class="motif">${b}</td></tr>`).join("")}</tbody></table>
    ${s.seuilAuDessusDeP10
      ? `<div class="hint" style="margin-top:10px"><strong>P₀ ≥ P₁₀ ici.</strong> Le contrôle
         de cohérence usuel « P₀ &lt; P₁₀ &lt; P₁₀₀ » ne tient pas dans le Sud : seul
         P₁₀ &lt; P₁₀₀ est universel.</div>` : ""}
    ${calcul}`;
}

function maj() {
  const grandeur = el("stGrandeur").value;
  const cls = classes(grandeur);
  el("stCarte").innerHTML = carte(grandeur, cls);
  el("stEchelle").innerHTML = legende(grandeur, cls);
  for (const g of el("stCarte").querySelectorAll(".station")) {
    const choisir = () => { choisie = JEU.stations[+g.dataset.i]; maj(); };
    g.addEventListener("click", choisir);
    g.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choisir(); }
    });
  }
  fiche();
}

el("stGrandeur").innerHTML = JEU.grandeurs.map((g) =>
  `<option value="${g.id}"${g.id === "P100" ? " selected" : ""}>${g.libelle}</option>`).join("");
el("stGrandeur").addEventListener("change", maj);
for (const id of ["stT", "stS"]) el(id).addEventListener(el(id).tagName === "SELECT" ? "change" : "input", fiche);
maj();
