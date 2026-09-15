// Pourquoi la courbe IDF descend.
//
// La question revient toujours, et la réponse tient en une phrase qu'il faut
// voir pour croire : une fenêtre plus longue est FORCÉE d'avaler des moments
// moins intenses. On ne choisit pas où la placer — on prend le maximum, et le
// maximum d'une moyenne sur une heure ne peut pas égaler celui d'une moyenne
// sur cinq minutes, parce que l'heure contient les cinq minutes ET cinquante-
// cinq autres.
//
// L'animation le montre pas à pas : pour chaque durée, la fenêtre balaie
// l'enregistrement, on retient le maximum, et on plante le point (t, i). Dix
// points plus tard, la courbe est là — et elle descend.
import { ENREGISTREMENT, N_PAS, PAS_FIN, DUREES_IDF, balayage, courbeIdf,
         ajusterMontana } from "./solvers-averse.js";

const el = (id) => document.getElementById(id);
const fr = (x, d) => Number.isFinite(x)
  ? x.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";

const C = { pluie: "#7dd3fc", pluieForte: "#0284c7", fenetre: "#f59e0b",
            record: "#b45309", point: "#0369a1", muet: "#94a3b8", texte: "#334155" };

const BALAYAGES = DUREES_IDF.map((min) => balayage(min / 60));
const POINTS = courbeIdf();
const MONTANA = ajusterMontana(POINTS);
const I_MAX = Math.max(...ENREGISTREMENT) / PAS_FIN;

let etape = 0;          // indice de la durée en cours
let avance = 0;         // 0 → 1 : position de la fenêtre dans le balayage
let marche = false, depart = 0;
const PAR_ETAPE = 2100; // ms par durée

/** Panneau du haut : l'enregistrement, la fenêtre, le record en cours. */
function panneauEnregistrement() {
  const W = 620, H = 250, MG = 46, MD = 14, MH = 30, MB = 38;
  const b = BALAYAGES[etape], min = DUREES_IDF[etape];
  const kx = (W - MG - MD) / N_PAS;
  const ky = (H - MH - MB) / (I_MAX * 1.08);
  const X = (k) => MG + k * kx, Y = (i) => H - MB - i * ky;

  const barres = ENREGISTREMENT.map((mm, k) => mm <= 0 ? "" :
    `<rect x="${X(k).toFixed(2)}" y="${Y(mm / PAS_FIN).toFixed(2)}"
       width="${Math.max(kx, 0.7).toFixed(2)}" height="${(H - MB - Y(mm / PAS_FIN)).toFixed(2)}"
       fill="${C.pluie}"/>`).join("");

  const nBal = b.hauteurs.length;
  const pos = Math.min(nBal - 1, Math.floor(avance * (nBal - 1)));
  const courante = b.hauteurs[pos];
  // Le record ATTEINT jusqu'ici, pas celui de tout le balayage : on montre la
  // recherche en train de se faire, pas son résultat connu d'avance.
  let record = -1, ouRecord = 0;
  for (let k = 0; k <= pos; k++) if (b.hauteurs[k] > record) { record = b.hauteurs[k]; ouRecord = k; }

  const cadre = (debut, couleur, epais, remplir) =>
    `<rect x="${X(debut).toFixed(2)}" y="${MH}" width="${(b.n * kx).toFixed(2)}"
       height="${(H - MB - MH).toFixed(2)}" fill="${remplir ? couleur : "none"}"
       fill-opacity="${remplir ? 0.16 : 0}" stroke="${couleur}" stroke-width="${epais}"/>`;

  const heures = [0, 6, 12, 18, 24].map((hh) => {
    const k = (hh / 24) * N_PAS;
    return `<text x="${X(k).toFixed(1)}" y="${H - MB + 14}" font-size="9.5" fill="${C.muet}"
      text-anchor="middle">${hh} h</text>`;
  }).join("");
  const niveaux = [50, 100, 150].filter((v) => v < I_MAX * 1.08).map((v) =>
    `<line x1="${MG}" y1="${Y(v).toFixed(1)}" x2="${W - MD}" y2="${Y(v).toFixed(1)}"
       stroke="#eef2f7" stroke-width="1"/>
     <text x="${MG - 5}" y="${(Y(v) + 3).toFixed(1)}" font-size="9.5" fill="${C.muet}"
       text-anchor="end">${v}</text>`).join("");

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img"
      aria-label="L'enregistrement du pluviographe, balayé par une fenêtre de durée fixe">
    ${niveaux}${barres}
    ${cadre(ouRecord, C.record, 1.6, false)}
    ${cadre(pos, C.fenetre, 2, true)}
    <line x1="${MG}" y1="${H - MB}" x2="${W - MD}" y2="${H - MB}" stroke="${C.muet}" stroke-width="1"/>
    ${heures}
    <text x="${MG}" y="14" font-size="11" font-weight="800" fill="#075985">
      Enregistrement du pluviographe — intensité (mm/h)</text>
    <text x="${MG}" y="26" font-size="10" fill="${C.fenetre}" font-weight="700">
      fenêtre de ${min} min : ${fr(courante, 1)} mm</text>
    <text x="${(MG + 190)}" y="26" font-size="10" fill="${C.record}" font-weight="700">
      meilleure jusqu'ici : ${fr(record, 1)} mm → ${fr((record / min) * 60, 1)} mm/h</text>
  </svg>`;
}

/** Panneau du bas : les points plantés, et la courbe quand ils y sont tous. */
function panneauCourbe() {
  const W = 620, H = 260, MG = 52, MD = 76, MH = 22, MB = 38;
  const tMin = 4, tMax = 1700, iMin = 2.5, iMax = 220;
  const X = (t) => MG + ((Math.log10(t) - Math.log10(tMin)) / (Math.log10(tMax) - Math.log10(tMin))) * (W - MG - MD);
  const Y = (i) => H - MB - ((Math.log10(i) - Math.log10(iMin)) / (Math.log10(iMax) - Math.log10(iMin))) * (H - MH - MB);

  const grilleX = [5, 15, 30, 60, 120, 360, 720, 1440].map((t) =>
    `<line x1="${X(t).toFixed(1)}" y1="${MH}" x2="${X(t).toFixed(1)}" y2="${H - MB}"
       stroke="#eef2f7" stroke-width="1"/>
     <text x="${X(t).toFixed(1)}" y="${H - MB + 14}" font-size="9" fill="${C.muet}"
       text-anchor="middle">${t}</text>`).join("");
  const grilleY = [5, 10, 25, 50, 100, 200].map((i) =>
    `<line x1="${MG}" y1="${Y(i).toFixed(1)}" x2="${W - MD}" y2="${Y(i).toFixed(1)}"
       stroke="#eef2f7" stroke-width="1"/>
     <text x="${MG - 5}" y="${(Y(i) + 3).toFixed(1)}" font-size="9" fill="${C.muet}"
       text-anchor="end">${i}</text>`).join("");

  const poses = POINTS.slice(0, etape + (avance >= 0.999 ? 1 : 0));
  const trace = poses.length > 1
    ? `<path d="${poses.map((p, k) => `${k ? "L" : "M"}${X(p.min).toFixed(1)},${Y(p.intensite).toFixed(1)}`).join("")}"
        fill="none" stroke="${C.point}" stroke-width="1.6" opacity=".55"/>` : "";
  const marques = poses.map((p) =>
    `<circle cx="${X(p.min).toFixed(1)}" cy="${Y(p.intensite).toFixed(1)}" r="4"
       fill="${C.point}"/>`).join("");

  // La goutte en cours de construction : le point provisoire du balayage.
  const b = BALAYAGES[etape], min = DUREES_IDF[etape];
  const nBal = b.hauteurs.length;
  const pos = Math.min(nBal - 1, Math.floor(avance * (nBal - 1)));
  let record = -1;
  for (let k = 0; k <= pos; k++) if (b.hauteurs[k] > record) record = b.hauteurs[k];
  const iProv = (record / min) * 60;
  const provisoire = avance < 0.999 && iProv > iMin
    ? `<circle cx="${X(min).toFixed(1)}" cy="${Y(iProv).toFixed(1)}" r="5" fill="none"
        stroke="${C.record}" stroke-width="2"/>
       <line x1="${X(min).toFixed(1)}" y1="${Y(iProv).toFixed(1)}" x2="${X(min).toFixed(1)}"
        y2="${H - MB}" stroke="${C.record}" stroke-width="1" stroke-dasharray="3 2"/>` : "";

  const toutes = poses.length === POINTS.length;
  const courbe = toutes
    ? `<path d="${Array.from({ length: 60 }, (_, k) => {
        const t = Math.pow(10, Math.log10(tMin) + (k / 59) * (Math.log10(tMax) - Math.log10(tMin)));
        return `${k ? "L" : "M"}${X(t).toFixed(1)},${Y(MONTANA.a * Math.pow(t, -MONTANA.b)).toFixed(1)}`;
      }).join("")}" fill="none" stroke="#b91c1c" stroke-width="1.8" stroke-dasharray="6 3"/>
      <text x="${W - MD + 4}" y="${Y(MONTANA.a * Math.pow(900, -MONTANA.b)).toFixed(1)}"
        font-size="9.5" font-weight="800" fill="#b91c1c">i = ${fr(MONTANA.a, 0)}·t<tspan
        font-size="7" dy="-4">−${fr(MONTANA.b, 3)}</tspan><tspan x="${W - MD + 4}" dy="14"
        font-size="9" font-weight="400">R² = ${fr(MONTANA.r2, 3)}</tspan></text>` : "";

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img"
      aria-label="La courbe intensité-durée en construction, un point par durée">
    ${grilleX}${grilleY}${trace}${marques}${provisoire}${courbe}
    <line x1="${MG}" y1="${H - MB}" x2="${W - MD}" y2="${H - MB}" stroke="${C.muet}" stroke-width="1"/>
    <text x="${MG}" y="14" font-size="11" font-weight="800" fill="#075985">
      Intensité maximale (mm/h) contre durée (min) — échelles logarithmiques</text>
    <text x="${((MG + W - MD) / 2).toFixed(0)}" y="${H - 6}" font-size="9.5" fill="${C.texte}"
      text-anchor="middle">durée de la fenêtre (min)</text>
  </svg>`;
}

/** La phrase qui répond à la question, réécrite à chaque durée. */
function commentaire() {
  const min = DUREES_IDF[etape];
  const p = POINTS[etape], p0 = POINTS[0];
  const faits = avance >= 0.999;
  if (!faits)
    return `La fenêtre de <strong>${min} min</strong> balaie les 24 heures. On ne choisit pas
      où la poser : on garde la position qui contient le plus d'eau.`;
  if (etape === 0)
    return `Sur <strong>5 minutes</strong>, la fenêtre se cale exactement sur la pointe :
      ${fr(p.hauteur, 1)} mm, soit <strong>${fr(p.intensite, 0)} mm/h</strong>. C'est le plus
      fort que cet enregistrement puisse donner.`;
  const perte = (1 - p.intensite / p0.intensite) * 100;
  return `Sur <strong>${min} min</strong>, la meilleure fenêtre ramasse ${fr(p.hauteur, 1)} mm —
    plus d'eau qu'en 5 min, mais étalée : <strong>${fr(p.intensite, 0)} mm/h</strong>, soit
    ${fr(perte, 0)} % de moins. Elle n'a pas le choix : ${min} minutes, c'est la pointe
    <em>plus</em> ${fr(min - 5, 0)} minutes de pluie plus faible.`;
}

function dessiner() {
  el("idfEnr").innerHTML = panneauEnregistrement();
  el("idfCourbe").innerHTML = panneauCourbe();
  el("idfDuree").textContent = `${DUREES_IDF[etape]} min`;
  el("idfMot").innerHTML = commentaire();
  el("idfEtape").value = String(etape);
}

function image(ms) {
  if (marche) {
    // `ms` est l'horodatage du DÉBUT de la frame : il peut précéder de quelques
    // dixièmes de milliseconde le performance.now() pris dans lancer(). Sans
    // ce max(0), u devient négatif, Math.floor le porte à −1, et BALAYAGES[−1]
    // n'existe pas — une image sur deux plantait au chargement.
    const u = Math.max(0, (ms - depart) / PAR_ETAPE);
    etape = Math.min(DUREES_IDF.length - 1, Math.floor(u));
    avance = Math.min(1, (u - Math.floor(u)) * 1.25);      // un temps d'arrêt sur le résultat
    if (u >= DUREES_IDF.length) { etape = DUREES_IDF.length - 1; avance = 1; arreter(); }
    dessiner();
  }
  requestAnimationFrame(image);
}

const arreter = () => {
  marche = false;
  el("idfPlay").textContent =
    etape === DUREES_IDF.length - 1 && avance >= 0.999 ? "Rejouer" : "Lecture";
};
function lancer() {
  if (etape === DUREES_IDF.length - 1 && avance >= 0.999) { etape = 0; avance = 0; }
  marche = true;
  depart = performance.now() - (etape + avance / 1.25) * PAR_ETAPE;
  el("idfPlay").textContent = "Pause";
}

el("idfPlay").addEventListener("click", () => (marche ? arreter() : lancer()));
el("idfEtape").addEventListener("input", () => {
  arreter();
  etape = parseInt(el("idfEtape").value, 10);
  avance = 1;
  dessiner();
  el("idfPlay").textContent = "Lecture";
});
el("idfEtape").max = String(DUREES_IDF.length - 1);

// Point d'entrée de l'outil de capture : il pose l'animation à un instant
// précis pour en tirer une image. Rien d'autre ne s'en sert.
window.__idfPoser = (e, a) => {
  arreter();
  etape = Math.min(DUREES_IDF.length - 1, Math.max(0, e));
  avance = Math.min(1, Math.max(0, a));
  dessiner();
};

dessiner();
requestAnimationFrame(image);
if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) lancer();
