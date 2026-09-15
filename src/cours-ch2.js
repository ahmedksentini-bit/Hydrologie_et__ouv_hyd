// Chapitre 2 — deux calculateurs sur une même série saisie en ordre
// chronologique : d'abord les trois hypothèses testées, ensuite l'ajustement.
// C'est l'ordre du travail réel, et c'est pourquoi les blocs sont dans cet ordre.
import { LOIS, ajuster, frequenceEmpirique, yGumbel, ecartKs, ecartQuadratique,
         bandeGumbel, bandeBootstrap, controlerSerie, niveauApplicable }
  from "./solvers-stats.js";

const el = (id) => document.getElementById(id);
const fr = (x, d) => Number.isFinite(x)
  ? x.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";
const PERIODES = [2, 5, 10, 20, 50, 100];

const COULEUR = { gumbel: "#0369a1", gev: "#b45309", galton: "#15803d",
                  pearson3: "#7c3aed", exponentielle: "#be123c" };

// Séries d'école : chacune met en défaut UNE hypothèse et une seule, pour que
// la comparaison des quatre tests soit lisible.
const EXEMPLES = {
  tendance: "39 60 32 43 50 70 51 56 39 62 49 67 52 53 63 25 93 68 68 40 48 67 79 67 73 75 63 74 56 89",
  rupture: "71 31 19 33 30 45 22 15 37 80 75 74 51 59 85 47 70 70 66 42 76 61 40 74 54 45 77 55 41 78",
  persistante: "25 20 26 40 50 51 67 69 82 66 63 38 26 17 34 35 33 36 35 49 62 51 29 39 50 29 37 48 67 64",
};

const lireSerie = () => (el("gSerie").value || "")
  .split(/[\s,;]+/).map((v) => parseFloat(v.replace(",", ".")))
  .filter((v) => Number.isFinite(v) && v > 0);

// ── Bloc 1 : les trois hypothèses ──────────────────────────────────────────

function majTests() {
  const serie = lireSerie();
  const seuil = parseFloat(el("gSeuil").value);
  if (serie.length < 8) {
    el("gTests").innerHTML = "";
    el("gVerdict").textContent = "Saisir au moins huit valeurs pour que les tests aient un sens.";
    return;
  }
  const { essais, hypotheses, retenu } = controlerSerie(serie, seuil);
  const rejetes = essais.filter((e) => e.p < seuil);

  el("gTests").innerHTML = `<table class="resultats">
    <thead><tr><th>Test</th><th>Hypothèse</th><th>Statistique</th><th>p</th>
      <th>Conservée à partir de</th><th>Verdict</th></tr></thead>
    <tbody>${essais.map((e) => `<tr${e.p < seuil ? ' class="alerte"' : ""}>
      <td>${e.test}</td><td class="motif">${e.hypothese}</td>
      <td class="motif">${detail(e)}</td>
      <td class="q">${e.p < 1e-4 ? "&lt; 0,0001" : fr(e.p, 4)}</td>
      <td class="${e.test === retenu.test && e.famille === retenu.famille ? "q retenue" : "q"}">${fr((1 - e.p) * 100, 2)} %</td>
      <td class="motif"><strong>${e.verdict}</strong>${e.sens ? ` — ${e.sens}` : ""}</td>
    </tr>`).join("")}</tbody></table>
    <div class="data-summary" style="margin-top:12px">
      ${hypotheses.map((h) => `<span><small>${h.famille} — ${h.test}</small>
        <strong>${fr(h.niveau * 100, 2)} %</strong></span>`).join("")}
      <span><small><strong>Niveau retenu</strong> = max des trois</small>
        <strong>${fr(retenu.niveau * 100, 2)} %</strong></span>
    </div>`;

  // Un niveau ÉLEVÉ n'est pas une bonne nouvelle : il dit qu'une hypothèse ne
  // tient que de justesse. C'est le contresens que ce bloc doit empêcher.
  const eleve = retenu.niveau >= 0.95, confortable = retenu.niveau < 0.80;
  el("gVerdict").innerHTML =
    `<strong>Les trois hypothèses ne tiennent simultanément qu'à partir de
     ${fr(retenu.niveau * 100, 2)} % de confiance</strong> — c'est
     ${retenu.test} (${retenu.famille}) qui commande.
     <small><br>${confortable
       ? `Niveau modeste : les trois hypothèses tiennent facilement, et lire l'ajustement à
          95 % est alors plus exigeant que la série ne le réclame.`
       : eleve
         ? `<strong>Un niveau élevé n'est pas une bonne nouvelle</strong> : il dit qu'il faut
            se réclamer de ${fr(retenu.niveau * 100, 2)} % de confiance pour continuer à
            conserver l'hypothèse de ${retenu.famille}. Autrement dit, elle ne tient que de
            justesse. Chercher la cause dans l'histoire du poste — déplacement, changement
            d'appareil, aménagement du bassin — avant de toucher au calcul.`
         : `Niveau intermédiaire : aucune hypothèse n'est franchement mise en défaut, mais
            aucune n'est confortable non plus.`}
     ${rejetes.length ? `<br>Au seuil de ${fr(seuil * 100, 0)} % que vous avez choisi,
       ${rejetes.length} test${rejetes.length > 1 ? "s rejettent" : " rejette"} :
       ${rejetes.map((e) => e.test).join(", ")}.` : ""}
     <br>Ce niveau retenu ne dépend <em>pas</em> du seuil choisi ci-dessus : il ne se coche
     pas, il se déduit. C'est lui que l'ajustement reprend plus bas.</small>`;
}

const detail = (e) => e.test === "Mann-Kendall"
    ? `S = ${e.S} · Z = ${fr(e.Z, 2)} · pente de Sen ${fr(e.sen, 2)} /an`
  : e.test === "Wald-Wolfowitz" ? `u = ${fr(e.u, 2)}`
  : e.test === "Pettitt" ? `K = ${e.K} · rupture supposée au rang ${e.tau}`
  : `W = ${fr(e.W, 0)} · u = ${fr(e.u, 2)}`;

// ── Bloc 2 : ajustement, comparaison, encadrement ──────────────────────────

function figure(serie, ajustements, bande, position) {
  const L = 480, H = 300, MG = 46, MD = 14, MH = 14, MB = 32;
  const yMin = -1.5, yMax = 5.3;
  const xs = [...serie].sort((a, b) => a - b);
  const n = xs.length;
  const plafond = Math.max(
    ...ajustements.map((a) => a.quantile(1 / (1 - Math.exp(-Math.exp(-yMax))))),
    ...(bande ? bande.map((b) => b.haut) : []), xs[n - 1]) * 1.06;
  const px = (y) => MG + ((y - yMin) / (yMax - yMin)) * (L - MG - MD);
  const py = (v) => H - MB - (v / plafond) * (H - MH - MB);
  const Tde = (y) => 1 / (1 - Math.exp(-Math.exp(-y)));

  const pas = Array.from({ length: 61 }, (_, i) => yMin + (i / 60) * (yMax - yMin));
  const courbe = (a) => `<path d="${pas.map((y, i) =>
      `${i ? "L" : "M"}${px(y).toFixed(1)},${py(a.quantile(Tde(y))).toFixed(1)}`).join("")}"
      fill="none" stroke="${COULEUR[a.id]}" stroke-width="${a.id === "gumbel" ? 2.4 : 1.6}"
      ${a.id === "gumbel" ? "" : 'stroke-dasharray="5 3"'}/>`;

  const aire = bande ? `<path d="${
      bande.map((b, i) => `${i ? "L" : "M"}${px(yGumbel(b.T)).toFixed(1)},${py(b.haut).toFixed(1)}`).join("")
      }${[...bande].reverse().map((b) => `L${px(yGumbel(b.T)).toFixed(1)},${py(b.bas).toFixed(1)}`).join("")}Z"
      fill="#0369a1" opacity=".10"/>` : "";

  const points = xs.map((x, i) => {
    const F = frequenceEmpirique(i + 1, n, position);
    return `<circle cx="${px(-Math.log(-Math.log(F))).toFixed(1)}" cy="${py(x).toFixed(1)}"
            r="3" fill="#0f172a" opacity=".7"/>`;
  }).join("");

  const graduations = PERIODES.map((T) => {
    const x = px(yGumbel(T));
    return `<line x1="${x.toFixed(1)}" y1="${MH}" x2="${x.toFixed(1)}" y2="${H - MB}"
              stroke="#dbe5ed" stroke-width="1"/>
            <text x="${x.toFixed(1)}" y="${H - MB + 13}" font-size="10" fill="#64748b"
              text-anchor="middle">${T}</text>`;
  }).join("");

  const ordonnees = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const v = f * plafond;
    return `<line x1="${MG}" y1="${py(v).toFixed(1)}" x2="${L - MD}" y2="${py(v).toFixed(1)}"
              stroke="#eef2f7" stroke-width="1"/>
            <text x="${MG - 6}" y="${(py(v) + 3).toFixed(1)}" font-size="10" fill="#64748b"
              text-anchor="end">${Math.round(v)}</text>`;
  }).join("");

  el("gFig").innerHTML = `<svg viewBox="0 0 ${L} ${H}" width="100%" role="img"
      aria-label="Ajustements comparés sur papier de Gumbel, avec intervalle de confiance">
      ${ordonnees}${graduations}${aire}${ajustements.map(courbe).join("")}${points}
      <text x="${MG}" y="${H - 4}" font-size="10" fill="#475569">période de retour (ans)</text>
      <text transform="translate(13,${(H / 2).toFixed(0)}) rotate(-90)" font-size="10"
            fill="#475569" text-anchor="middle">pluie journalière (mm)</text>
    </svg>`;
}

function majAjustement() {
  const serie = lireSerie();
  const position = el("gPosition").value;
  const idLoi = el("gLoi").value;

  // Le niveau de l'intervalle vient par défaut des tests de la série : le doute
  // sur les hypothèses se propage ainsi jusqu'au doute sur le quantile.
  const choixNiveau = el("gNiveau").value;
  const dicte = choixNiveau === "tests" && serie.length >= 8
    ? controlerSerie(serie).retenu : null;
  const applicable = dicte ? niveauApplicable(dicte.niveau) : null;
  const niveau = applicable ? applicable.niveau
    : choixNiveau === "tests" ? 0.95 : parseFloat(choixNiveau);

  if (serie.length < 3) {
    el("gFig").innerHTML = ""; el("gTable").innerHTML = ""; el("gLegende").innerHTML = "";
    el("gOut").textContent = "Saisir au moins trois maxima annuels.";
    return;
  }

  const ajustements = LOIS.map((l) => ajuster(l.id, serie)).filter(Boolean);
  const choisi = ajustements.find((a) => a.id === idLoi) || ajustements[0];

  const mode = el("gBande").value;
  const methode = mode === "aucune" ? null
    : mode === "bootstrap" ? "bootstrap"
    : choisi.id === "gumbel" ? "kite" : "bootstrap";
  // La bande doit couvrir toute la largeur tracée, depuis y = −1,5.
  const grille = PERIODES.concat([1.02, 1.05, 1.1, 1.25, 1.5, 3, 7, 15, 30, 70, 200])
    .sort((a, b) => a - b);
  const bande = methode === "kite" ? bandeGumbel(serie, grille, niveau)
    : methode === "bootstrap" ? bandeBootstrap(serie, choisi.id, grille, { niveau }) : null;

  // Un encadrement PAR LOI : sans cela le tableau montrerait cinq valeurs
  // centrales, invariantes par construction, et une seule ligne d'intervalle
  // — celle de la loi encadrée. On ne verrait donc pas le niveau agir.
  const bandeDe = (a) => methode === null ? null
    : (mode !== "bootstrap" && a.id === "gumbel")
      ? bandeGumbel(serie, PERIODES, niveau)
      : bandeBootstrap(serie, a.id, PERIODES, { niveau });
  const bandes = new Map(ajustements.map((a) => [a.id, bandeDe(a)]));
  const borneHaute = el("gValeur").value === "haute" && methode !== null;

  figure(serie, ajustements, bande, position);

  el("gLegende").innerHTML = `<div class="data-summary" style="margin-top:10px">${
    ajustements.map((a) => {
      const ks = ecartKs(serie, a);
      // Pastille en SVG : elle rend aussi le trait plein ou tireté de la courbe.
      const trait = `<svg width="24" height="8" style="vertical-align:middle" aria-hidden="true">
        <line x1="1" y1="4" x2="23" y2="4" stroke="${COULEUR[a.id]}" stroke-width="2.6"
          ${a.id === "gumbel" ? "" : 'stroke-dasharray="5 3"'}/></svg>`;
      return `<span><small>${trait} ${a.nom}</small>
        <strong>${a.resume}</strong>
        <small>KS D = ${fr(ks.D, 4)} · écart quadratique ${fr(ecartQuadratique(serie, a), 2)} mm${
          a.horsDomaine ? " · <strong>|Cs| &gt; 2 : hors domaine</strong>" : ""}</small></span>`;
    }).join("")}</div>`;

  const cellule = (a, T) => {
    const b = bandes.get(a.id);
    const centrale = a.quantile(T);
    if (!b) return `${fr(centrale, 1)}`;
    const ligne = b.find((x) => x.T === T);
    return borneHaute
      ? `${fr(ligne.haut, 1)}<small style="display:block;font-weight:500;color:#64748b">${fr(centrale, 1)}</small>`
      : `${fr(centrale, 1)}<small style="display:block;font-weight:500;color:#64748b">≤ ${fr(ligne.haut, 1)}</small>`;
  };

  el("gTable").innerHTML = `<table class="resultats abaque" style="margin-top:14px">
    <thead><tr><th>T (ans)</th>${PERIODES.map((T) => `<th>${T}</th>`).join("")}</tr></thead>
    <tbody>
      <tr><td>variable réduite y</td>${PERIODES.map((T) =>
        `<td class="q">${fr(yGumbel(T), 2)}</td>`).join("")}</tr>
      ${ajustements.map((a) => `<tr><td>${a.nom}</td>${PERIODES.map((T) =>
        `<td class="${a.id === choisi.id ? "q retenue" : "q"}">${cellule(a, T)}</td>`).join("")}</tr>`).join("")}
    </tbody></table>
    <p class="method-note">${methode === null
      ? "Sans intervalle, chaque case ne porte que la valeur centrale — invariante par construction : elle ne dépend pas du niveau de confiance, seulement de la loi et de la série."
      : borneHaute
        ? `Chiffre principal : <strong>la borne haute de l'intervalle à ${fr(niveau * 100, 2)} %</strong>,
           c'est-à-dire la valeur de projet. En dessous, en gris, la valeur centrale de la loi —
           elle, ne bouge pas avec le niveau.`
        : `Chiffre principal : la valeur centrale de la loi, qui ne dépend pas du niveau de confiance.
           En dessous, la borne haute de l'intervalle à ${fr(niveau * 100, 2)} %.`}
      ${methode === null ? "" : `Les intervalles sont calculés loi par loi : ${
        methode === "kite" ? "formule de Kite pour Gumbel, rééchantillonnage pour les autres"
                           : "rééchantillonnage pour toutes"}.`}</p>`;

  const ks = ecartKs(serie, choisi);
  const meilleur = ajustements.reduce((a, b) => ecartKs(serie, b).D < ecartKs(serie, a).D ? b : a);
  // Intervalle de la loi encadrée, aux périodes du tableau.
  const ic = bandes.get(choisi.id);
  const icCent = ic?.find((b) => b.T === 100);
  const etendue = ajustements.map((a) => a.quantile(100));
  const retenue = borneHaute && ic ? icCent.haut : choisi.quantile(100);
  el("gOut").innerHTML =
    `<strong>${choisi.nom}</strong> (${choisi.methode}) — ${choisi.resume} ·
     ${borneHaute && icCent
       ? `<strong>valeur de projet au centennal : ${fr(retenue, 1)} mm</strong> —
          borne haute de l'intervalle à ${fr(niveau * 100, 2)} % (${fr(icCent.bas, 0)} à
          ${fr(icCent.haut, 0)} mm par ${methode === "kite" ? "la formule de Kite" : "bootstrap"}),
          pour une valeur centrale de ${fr(choisi.quantile(100), 1)} mm.`
       : icCent
         ? `x₁₀₀ = ${fr(choisi.quantile(100), 1)} mm, intervalle à ${fr(niveau * 100, 2)} % :
            ${fr(icCent.bas, 0)} à ${fr(icCent.haut, 0)} mm
            (${methode === "kite" ? "formule de Kite" : "bootstrap"}).`
         : `x₁₀₀ = ${fr(choisi.quantile(100), 1)} mm.`}
     ${dicte ? `<small><br><strong>Niveau dicté par les tests de la série</strong> :
       ${fr(dicte.niveau * 100, 2)} %, commandé par ${dicte.test} (${dicte.famille})${
         applicable.borne ? ` — ${applicable.sens} à ${fr(niveau * 100, 1)} % pour rester
         exploitable` : ""}. Une série dont un test passe de justesse impose ainsi un
       intervalle plus large : le doute sur les hypothèses se propage jusqu'au quantile.</small>`
       : ""}
     <small><br>Les cinq lois s'échelonnent de ${fr(Math.min(...etendue), 0)} à
     ${fr(Math.max(...etendue), 0)} mm au centennal${icCent
       ? ` — soit ${fr(Math.max(...etendue) - Math.min(...etendue), 0)} mm d'écart entre lois,
         contre ${fr(icCent.haut - icCent.bas, 0)} mm de largeur d'intervalle sur la seule
         ${choisi.nom.toLowerCase()}` : ""}.
     Écart de Kolmogorov-Smirnov le plus faible : ${meilleur.nom} (D = ${fr(ecartKs(serie, meilleur).D, 4)}) ;
     la valeur critique approchée à 5 % vaut ${fr(ks.critique5, 3)}, mais les paramètres
     étant estimés sur la série elle-même, elle est optimiste : à lire comme un classement,
     pas comme un verdict.</small>`;
}

// ── Câblage ────────────────────────────────────────────────────────────────

el("gLoi").innerHTML = LOIS.map((l) =>
  `<option value="${l.id}">${l.nom} — ${l.methode}</option>`).join("");

const tout = () => { majTests(); majAjustement(); };
el("gSerie").addEventListener("input", () => { el("gExemple").value = ""; tout(); });
el("gSeuil").addEventListener("change", majTests);
el("gExemple").addEventListener("change", () => {
  const v = el("gExemple").value;
  if (EXEMPLES[v]) { el("gSerie").value = EXEMPLES[v]; tout(); }
});
for (const id of ["gLoi", "gBande", "gNiveau", "gPosition", "gValeur"])
  el(id).addEventListener("change", majAjustement);
tout();
