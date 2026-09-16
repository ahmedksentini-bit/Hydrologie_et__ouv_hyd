// Lecture des abaques BCEOM, confrontée au calcul HDS-5 du chapitre 6.
// L'abaque ne dimensionne pas : il contrôle. C'est pourquoi les deux valeurs
// sont affichées côte à côte avec leur écart, et jamais l'une à la place de
// l'autre.
import { preparer, lireAbaque, DEBIT_REDUIT, ecartRelatif } from "./solvers-abaques.js";
import { calculerOuvrage, entreePar } from "./solvers-ouvrages.js";
import { chargerJson } from "./donnees.js";

const el = (id) => document.getElementById(id);
const num = (id) => parseFloat((el(id).value || "").replace(",", "."));
const fr = (x, d) => Number.isFinite(x)
  ? x.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";

const JEU = preparer(await chargerJson("data/abaques-bceom.json"));

/** Hypothèses de la contre-épreuve HDS-5 : l'abaque n'en porte aucune. */
const REF = { L: 12, J: 0.01, K: 70, tw: 0 };

/**
 * Correspondance abaque ↔ entrée HDS-5, EXPLICITE et partielle.
 * Aucun rapprochement silencieux : une courbe sans ligne ici ne se compare à
 * rien, et le dit. Les rapprochements approchés sont marqués comme tels.
 */
const CORRESPONDANCES = [
  { figure: 77, courbe: "A_ailes_30_75", entree: "box-ailes-evasees", exacte: true },
  { figure: 77, courbe: "B_mur_de_tete_sans_ailes", entree: "box-ailes-15", exacte: false,
    note: "mur de tête sans aile rapproché du mur frontal à 90°" },
  { figure: 77, courbe: "C_saillante_ou_sifflet", entree: "box-ailes-paralleles", exacte: false,
    note: "rapprochement approché : aucune tête saillante de dalot au catalogue HDS-5 du cours" },
  { figure: 72, courbe: "emboitement_femelle", entree: "buse-emboitement", exacte: true },
  { figure: 71, courbe: "tete_saillante_hors_remblai", entree: "buse-metal-saillie", exacte: true },
];
const correspondance = (figure, courbe) =>
  CORRESPONDANCES.find((c) => c.figure === figure && c.courbe === courbe) || null;

const LIBELLE_OUVRAGE = {
  71: "Buse métallique circulaire, D ≤ 2 m",
  72: "Buse béton circulaire à emboîtement femelle",
  73: "Grande buse métallique, D > 2 m, entrée chanfreinée",
  75: "Buse arche",
  77: "Dalot rectangulaire",
};

function graphique(abaque, idCourbe, lecture) {
  const L = 470, H = 300, MG = 46, MD = 146, MH = 14, MB = 34;
  const tous = abaque.courbes.flatMap((c) => c.points);
  const qMin = Math.min(...tous.map((p) => p[0])), qMax = Math.max(...tous.map((p) => p[0]));
  const hMin = Math.min(...tous.map((p) => p[1])), hMax = Math.max(...tous.map((p) => p[1]));
  const lx = Math.log10(qMin), lX = Math.log10(qMax);
  const ly = Math.log10(hMin), lY = Math.log10(hMax);
  const px = (q) => MG + ((Math.log10(q) - lx) / (lX - lx)) * (L - MG - MD);
  const py = (h) => H - MB - ((Math.log10(h) - ly) / (lY - ly)) * (H - MH - MB);
  const COUL = ["#0369a1", "#b45309", "#15803d"];

  const grilleX = [0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 1, 1.4].filter((v) => v >= qMin && v <= qMax);
  const grilleY = [0.3, 0.5, 0.7, 1, 1.5, 2, 3].filter((v) => v >= hMin && v <= hMax);

  const courbes = abaque.courbes.map((c, i) => {
    const vif = c.id === idCourbe;
    return `<path d="${c.points.map((p, k) =>
        `${k ? "L" : "M"}${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`).join("")}"
      fill="none" stroke="${COUL[i % 3]}" stroke-width="${vif ? 2.6 : 1.2}"
      opacity="${vif ? 1 : 0.45}"/>
      <text x="${L - MD + 6}" y="${(MH + 14 + i * 26).toFixed(0)}" font-size="10"
        fill="${COUL[i % 3]}" font-weight="${vif ? 800 : 500}">
        <tspan>■</tspan> ${c.libelle.length > 26 ? c.libelle.slice(0, 25) + "…" : c.libelle}</text>`;
  }).join("");

  const ancres = (abaque.ancres || []).map((a) =>
    `<circle cx="${px(a["Q*"]).toFixed(1)}" cy="${py(a["H1*"]).toFixed(1)}" r="4"
       fill="none" stroke="#0f172a" stroke-width="1.4"/>`).join("");

  const point = lecture && lecture.h1Reduit !== null
    ? `<line x1="${px(lecture.qReduit).toFixed(1)}" y1="${H - MB}"
         x2="${px(lecture.qReduit).toFixed(1)}" y2="${py(lecture.h1Reduit).toFixed(1)}"
         stroke="#be123c" stroke-width="1.2" stroke-dasharray="4 3"/>
       <line x1="${MG}" y1="${py(lecture.h1Reduit).toFixed(1)}"
         x2="${px(lecture.qReduit).toFixed(1)}" y2="${py(lecture.h1Reduit).toFixed(1)}"
         stroke="#be123c" stroke-width="1.2" stroke-dasharray="4 3"/>
       <circle cx="${px(lecture.qReduit).toFixed(1)}" cy="${py(lecture.h1Reduit).toFixed(1)}"
         r="5" fill="#be123c"/>` : "";

  return `<svg viewBox="0 0 ${L} ${H}" width="100%" role="img"
      aria-label="Abaque BCEOM : charge amont réduite en fonction du débit réduit, axes logarithmiques">
    ${grilleX.map((v) => `<line x1="${px(v).toFixed(1)}" y1="${MH}" x2="${px(v).toFixed(1)}"
        y2="${H - MB}" stroke="#eef2f7" stroke-width="1"/>
      <text x="${px(v).toFixed(1)}" y="${H - MB + 14}" font-size="10" fill="#64748b"
        text-anchor="middle">${String(v).replace(".", ",")}</text>`).join("")}
    ${grilleY.map((v) => `<line x1="${MG}" y1="${py(v).toFixed(1)}" x2="${(L - MD).toFixed(1)}"
        y2="${py(v).toFixed(1)}" stroke="#eef2f7" stroke-width="1"/>
      <text x="${MG - 6}" y="${(py(v) + 3).toFixed(1)}" font-size="10" fill="#64748b"
        text-anchor="end">${String(v).replace(".", ",")}</text>`).join("")}
    ${courbes}${ancres}${point}
    <text x="${MG}" y="${H - 4}" font-size="10" fill="#475569">Q* (échelle log)</text>
    <text transform="translate(13,${(H / 2).toFixed(0)}) rotate(-90)" font-size="10"
          fill="#475569" text-anchor="middle">H1 / D (échelle log)</text>
  </svg>`;
}

function remplirCourbes() {
  const fig = parseInt(el("abPlanche").value, 10);
  const a = JEU.parFigure.get(fig);
  el("abCourbe").innerHTML = a.courbes.map((c) =>
    `<option value="${c.id}">${c.libelle}</option>`).join("");
  const forme = DEBIT_REDUIT[fig].forme;
  const champB = el("abB").closest(".field");
  champB.style.opacity = forme === "dalot" ? 1 : 0.4;
  el("abB").disabled = forme !== "dalot";
}

function maj() {
  const fig = parseInt(el("abPlanche").value, 10);
  const abaque = JEU.parFigure.get(fig);
  const idCourbe = el("abCourbe").value;
  const forme = DEBIT_REDUIT[fig].forme;
  const D = num("abD"), Q = num("abQ"), B = num("abB");
  const geom = { Q, D, B, A: forme === "arche" ? 0.8 * Math.PI * D * D / 4 : undefined };

  const lu = lireAbaque(abaque, idCourbe, geom);
  el("abFig").innerHTML = graphique(abaque, idCourbe, lu.erreur ? null : lu);

  if (lu.erreur) {
    el("abTable").innerHTML = "";
    el("abOut").textContent = lu.erreur;
    return;
  }

  const corr = correspondance(fig, idCourbe);
  let hds = null, ent = null;
  if (corr) {
    ent = entreePar(corr.entree);
    const r = calculerOuvrage({
      forme: ent.forme, B: forme === "dalot" ? B : D, D, cellules: 1, Q,
      L: REF.L, J: REF.J, K: REF.K, entree: corr.entree, tw: REF.tw,
    });
    if (!r.erreur) hds = r;
  }

  const ecart = hds ? ecartRelatif(hds.entreeC.HW, lu.H1) : NaN;
  el("abTable").innerHTML = `<table class="resultats">
    <thead><tr><th>Source</th><th>Charge amont (m)</th><th>Détail</th></tr></thead>
    <tbody>
      <tr><td>Abaque BCEOM, figure ${fig}</td>
        <td class="q">${lu.H1 === null ? "—" : fr(lu.H1, 3)}</td>
        <td class="motif">Q* = ${fr(lu.qReduit, 4)} par ${lu.formule}${
          lu.h1Reduit === null ? ` · <strong>hors domaine</strong> — ${lu.motif}`
          : ` · H1/D = ${fr(lu.h1Reduit, 3)} · incertitude annoncée du relevé ± ${lu.incertitude} %`}</td></tr>
      ${hds ? `<tr><td>HDS-5, contrôle à l'entrée</td>
        <td class="q">${fr(hds.entreeC.HW, 3)}</td>
        <td class="motif">entrée « ${ent.libelle} » · X = ${fr(hds.entreeC.X, 3)} ·
          entrée ${hds.entreeC.regime}${corr.exacte ? ""
            : ` · <strong>correspondance approchée</strong> : ${corr.note}`}</td></tr>`
      : `<tr class="alerte"><td>HDS-5</td><td class="q">—</td>
        <td class="motif">aucune correspondance au catalogue du chapitre 6 pour cette courbe :
          la comparaison n'est pas faite plutôt que faite au plus proche</td></tr>`}
    </tbody></table>`;

  // Trois bandes plutôt que deux : à ± l'incertitude du relevé les deux
  // méthodes concordent ; jusqu'au double, l'écart reste du même ordre que la
  // précision de lecture ; au-delà seulement, il y a quelque chose à comprendre.
  const bande = (e, u) => Math.abs(e) <= u ? "accord"
    : Math.abs(e) <= 2 * u ? "limite" : "ecart";

  el("abOut").innerHTML = lu.h1Reduit === null
    ? `<strong>L'abaque ne lit rien ici.</strong>
       <small><br>${lu.motif}. Ce n'est pas une panne : c'est la planche qui s'arrête là.
       ${hds ? `Le calcul, lui, répond quand même : HDS-5 donne
         ${fr(hds.entreeC.HW, 3)} m au contrôle à l'entrée. C'est exactement pourquoi
         l'abaque reste une contre-épreuve et le calcul le moteur — l'un a un domaine
         tracé, l'autre une formule qui ne s'arrête pas.`
         : "Changer de planche, ou revenir au calcul."}</small>`
    : hds
      ? `<strong>Abaque ${fr(lu.H1, 3)} m · HDS-5 ${fr(hds.entreeC.HW, 3)} m ·
         écart ${ecart > 0 ? "+" : ""}${fr(ecart, 1)} %</strong>
         <small><br>${{
           accord: `Les deux méthodes se rejoignent dans l'incertitude annoncée du relevé
              graphique (± ${lu.incertitude} %). Deux constructions sans rapport — une planche
              française de 1979 et des régressions américaines — qui tombent d'accord :
              c'est le meilleur contrôle dont on dispose.`,
           limite: `L'écart reste du même ordre que la précision de lecture de la planche
              (± ${lu.incertitude} %), sans tenir dedans. Compatible, donc, mais sans la
              marge qui permettrait de s'en satisfaire : à confirmer sur une autre
              configuration avant d'en tirer une confiance.`,
           ecart: `L'écart vaut plus du double de l'incertitude annoncée du relevé
              (± ${lu.incertitude} %). Il faut le comprendre avant de retenir l'une ou l'autre
              valeur : forme de tête mal appariée, lecture au bord du domaine, ou géométrie
              que la planche ne couvre pas.`,
         }[bande(ecart, lu.incertitude)]}
         Le calcul HDS-5 suppose ici L = ${REF.L} m, J = ${fr(REF.J * 100, 0)} %,
         K = ${REF.K} et une sortie libre ; l'abaque, lui, n'en porte aucune — d'où la
         comparaison sur le seul contrôle à l'entrée, le seul que les deux décrivent.
         ${hds.controle === "sortie"
           ? " À noter : sur cet ouvrage c'est en réalité la sortie qui commande, et l'abaque ne le voit pas."
           : ""}</small>`
      : `<strong>Abaque : H1 = ${fr(lu.H1, 3)} m</strong> (H1/D = ${fr(lu.h1Reduit, 3)}).
         <small><br>Pas de contre-épreuve possible : cette courbe n'a pas d'équivalent au
         catalogue HDS-5 du chapitre 6. Rapprocher une tête « au plus proche » pour pouvoir
         afficher un écart donnerait un nombre sans contenu.</small>`;
}

el("abPlanche").innerHTML = JEU.abaques.map((a) =>
  `<option value="${a.figure}"${a.figure === 77 ? " selected" : ""}>Figure ${a.figure} — ${LIBELLE_OUVRAGE[a.figure]}</option>`).join("");
el("abPlanche").addEventListener("change", () => { remplirCourbes(); maj(); });
for (const id of ["abCourbe", "abQ", "abD", "abB"])
  el(id).addEventListener(el(id).tagName === "SELECT" ? "change" : "input", maj);
remplirCourbes();
maj();
