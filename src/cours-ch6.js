// Calculateur d'ouvrage : les deux contrôles menés jusqu'au bout, celui qui
// commande mis en évidence, et un profil en long à l'échelle.
import { calculerOuvrage, entreesPour } from "./solvers-ouvrages.js";

const el = (id) => document.getElementById(id);
const num = (id) => parseFloat((el(id).value || "").replace(",", "."));
const fr = (x, d) => Number.isFinite(x)
  ? x.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";

function remplirEntrees() {
  const forme = el("oForme").value;
  const liste = entreesPour(forme);
  el("oEntree").innerHTML = liste.map((e) =>
    `<option value="${e.id}">${e.libelle} — ${e.materiau}, abaque ${e.abaque}, échelle ${e.echelle}</option>`).join("");
  el("oB").disabled = forme === "buse";
  el("oB").closest(".field").style.opacity = forme === "buse" ? 0.45 : 1;
}

function profil(r, J, L, tw) {
  const D = r.section.hauteur, HW = r.HW;
  const W = 460, H = 180, MG = 30, MD = 16, MB = 26, MH = 12;
  const chute = J * L;
  const hautTotal = Math.max(HW, chute + D, tw + 0.3) * 1.12;
  const ky = (H - MH - MB) / hautTotal;
  const kx = (W - MG - MD) / L;
  const y0 = H - MB;                               // radier de sortie
  const yRad = (x) => y0 - (chute * (1 - x / L)) * ky;   // radier, de l'amont vers l'aval

  const amont = MG, aval = MG + L * kx;
  const radierAmont = yRad(0), radierAval = yRad(L);
  const plafondAmont = radierAmont - D * ky, plafondAval = radierAval - D * ky;
  const eauAmont = radierAmont - HW * ky;
  const eauAval = radierAval - tw * ky;

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img"
      aria-label="Profil en long de l'ouvrage, niveaux amont et aval">
    <polygon points="${amont},${radierAmont.toFixed(1)} ${aval},${radierAval.toFixed(1)}
      ${aval},${plafondAval.toFixed(1)} ${amont},${plafondAmont.toFixed(1)}"
      fill="#e2e8f0" stroke="#475569" stroke-width="1.6"/>
    <line x1="${amont - 22}" y1="${eauAmont.toFixed(1)}" x2="${amont}" y2="${eauAmont.toFixed(1)}"
      stroke="#0369a1" stroke-width="2.4"/>
    <line x1="${amont}" y1="${eauAmont.toFixed(1)}" x2="${amont}" y2="${radierAmont.toFixed(1)}"
      stroke="#0369a1" stroke-width="1" stroke-dasharray="3 3"/>
    <text x="${amont - 24}" y="${(eauAmont - 5).toFixed(1)}" font-size="10" fill="#0369a1"
      text-anchor="start">HW = ${fr(HW, 2)} m</text>
    ${tw > 0.001 ? `<line x1="${aval}" y1="${eauAval.toFixed(1)}" x2="${aval + 22}"
      y2="${eauAval.toFixed(1)}" stroke="#0891b2" stroke-width="2.4"/>
      <text x="${aval + 20}" y="${(eauAval - 5).toFixed(1)}" font-size="10" fill="#0e7490"
        text-anchor="end">TW = ${fr(tw, 2)} m</text>` : ""}
    <line x1="${amont}" y1="${(y0 + 6).toFixed(1)}" x2="${aval}" y2="${(y0 + 6).toFixed(1)}"
      stroke="#94a3b8" stroke-width="1"/>
    <text x="${((amont + aval) / 2).toFixed(0)}" y="${(y0 + 19).toFixed(1)}" font-size="10"
      fill="#64748b" text-anchor="middle">L = ${fr(L, 0)} m · J = ${fr(J * 100, 1)} %</text>
    <text x="${(amont + 8).toFixed(0)}" y="${((radierAmont + plafondAmont) / 2 + 4).toFixed(1)}"
      font-size="10" fill="#334155">D = ${fr(D, 2)} m</text>
  </svg>`;
}

function maj() {
  const forme = el("oForme").value;
  const J = num("oJ") / 100, L = num("oL"), tw = num("oTw") || 0;
  const r = calculerOuvrage({
    forme, B: num("oB"), D: num("oD"), cellules: num("oN"), Q: num("oQ"),
    L, J, K: num("oK"), entree: el("oEntree").value, tw,
  });
  if (r.erreur) {
    el("oFig").innerHTML = ""; el("oTable").innerHTML = "";
    el("oOut").textContent = r.erreur;
    return;
  }

  el("oFig").innerHTML = profil(r, J, L, tw);

  const gagne = (c) => r.controle === c ? " q retenue" : " q";
  el("oTable").innerHTML = `<table class="resultats abaque">
    <thead><tr><th>Contrôle</th><th>HW (m)</th><th>détail</th></tr></thead>
    <tbody>
      <tr><td>à l'entrée</td><td class="${gagne("entrée")}">${fr(r.entreeC.HW, 3)}</td>
        <td class="motif">X = ${fr(r.entreeC.X, 3)} · entrée ${r.entreeC.regime} ·
          HW/D = ${fr(r.entreeC.ratio, 3)}</td></tr>
      <tr><td>à la sortie</td><td class="${gagne("sortie")}">${fr(r.sortieC.HW, 3)}</td>
        <td class="motif">${r.sortieC.methode} · pertes ${fr(r.sortieC.pertes, 3)} m
          (entrée ${fr(r.sortieC.perteEntree, 3)} · frottement ${fr(r.sortieC.perteFrottement, 3)} ·
          sortie ${fr(r.sortieC.perteSortie, 3)})</td></tr>
    </tbody></table>
    <div class="data-summary" style="margin-top:12px">
      <span><small>Profondeur critique y<sub>c</sub></small><strong>${fr(r.profondeurCritique, 3)} m</strong></span>
      <span><small>Tirant normal y<sub>n</sub></small><strong>${fr(r.profondeurNormale, 3)} m</strong></span>
      <span><small>Vitesse</small><strong>${fr(r.vitesse, 2)} m/s</strong></span>
      <span><small>Remplissage</small><strong>${fr(r.remplissage * 100, 0)} %</strong></span>
      <span><small>État de la sortie</small><strong>${r.etatSortie}</strong></span>
      <span><small>K<sub>e</sub> de l'entrée</small><strong>${fr(r.Ke, 2)}</strong></span>
    </div>`;

  const notes = [];
  if (!r.vitesseOk) notes.push(`vitesse ${fr(r.vitesse, 2)} m/s au-delà de 3 m/s : protection de sortie à prévoir`);
  if (r.capaciteDepassee) notes.push("capacité de la section atteinte : l'ouvrage se met en charge");
  if (r.sortieC.horsDomaine) notes.push("approximation FHWA sous 0,75 D : valeur indicative, à confronter à un calcul de remous");
  if (r.penteSuperieureACritique && r.etatSortie !== "noyée") notes.push("pente supérieure à la pente critique : ressaut possible à la sortie");
  if (r.etatSortie === "partiellement noyée" && !r.avalInfluence)
    notes.push("il y a de l'eau à la sortie, mais sous y<sub>c</sub> : l'aval ne commande pas encore la ligne d'eau");

  el("oOut").innerHTML =
    `<strong>HW = ${fr(r.HW, 3)} m</strong> — contrôle
     <strong>${r.controle === "entrée" ? "à l'entrée" : "à la sortie"}</strong>,
     soit HW/D = ${fr(r.HWsurD, 2)}.
     ${notes.length ? `<small><br>${notes.join(" · ")}.</small>` : ""}`;
}

el("oForme").addEventListener("change", () => { remplirEntrees(); maj(); });
for (const id of ["oEntree", "oQ", "oB", "oD", "oN", "oL", "oJ", "oK", "oTw"])
  el(id).addEventListener("input", maj);
remplirEntrees();
maj();
