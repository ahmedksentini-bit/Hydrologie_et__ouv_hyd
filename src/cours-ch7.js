// Dimensionnement : le catalogue énuméré, le filtre rendu visible, le
// classement assumé comme une préférence. Ce qui compte pédagogiquement n'est
// pas la solution retenue mais QUEL critère élimine les autres.
import { entreesPour } from "./solvers-ouvrages.js";
import { proposer, cotePheAmont, coteRadierAval, verdictRevanche, reglesDgpcSix }
  from "./solvers-dimensionnement.js";

const el = (id) => document.getElementById(id);
const num = (id) => parseFloat((el(id).value || "").replace(",", "."));
const fr = (x, d) => Number.isFinite(x)
  ? x.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";

/** Famille d'un motif de rejet, pour compter ce qui élimine réellement. */
function famille(motif) {
  if (motif.startsWith("capacité")) return "capacité dépassée";
  if (motif.startsWith("remplissage")) return "remplissage > limite";
  if (motif.startsWith("vitesse")) return "vitesse > admissible";
  if (motif.startsWith("HW/D")) return "charge amont HW/D";
  if (motif.startsWith("revanche")) return "revanche";
  return motif;
}

function remplirEntrees() {
  const forme = el("dimForme").value;
  el("dimEntree").innerHTML = entreesPour(forme).map((e) =>
    `<option value="${e.id}">${e.libelle} — ${e.materiau}</option>`).join("");
}

function maj() {
  const forme = el("dimForme").value;
  const J = (num("dimJ") || 0) / 100, L = num("dimL"), K = num("dimK");
  const zRadier = num("dimZr"), zRoute = num("dimZc");
  const avecCotes = Number.isFinite(zRadier) && Number.isFinite(zRoute);

  const s = proposer({
    forme, Q: num("dimQ"), L, J, K, entree: el("dimEntree").value, tw: 0,
    cellulesMax: Math.max(1, Math.min(6, Math.round(num("dimN")) || 1)),
    limites: { vitesseMax: num("dimV") || 3 },
    zRadierAmont: avecCotes ? zRadier : null,
    zRoute: avecCotes ? zRoute : null,
  });

  if (!s.retenue) {
    el("dimTable").innerHTML = "";
    el("dimRejets").innerHTML = compteurRejets(s);
    el("dimOut").innerHTML = `<strong>Aucun candidat acceptable</strong> sur les
      ${s.examines} examinés. Le tableau ci-dessus dit quel critère bloque :
      c'est lui qu'il faut reprendre, pas la section au hasard.`;
    return;
  }

  const lignes = s.admissibles.slice(0, 6).map((c, i) => {
    const marque = i === 0 ? "q retenue" : "q";
    return `<tr><td>${c.libelle}</td>
      <td class="${marque}">${fr(c.r.HW, 3)}</td>
      <td class="motif">J = ${fr(c.J * 100, 1)} % · HW/D = ${fr(c.r.HWsurD, 2)} ·
        V = ${fr(c.r.vitesse, 2)} m/s · remplissage ${fr(c.r.remplissage * 100, 0)} % ·
        contrôle ${c.r.controle === "entrée" ? "à l'entrée" : "à la sortie"}</td>
      <td class="q">${fr(c.score, 1)}</td></tr>`;
  }).join("");

  el("dimTable").innerHTML = `<table class="resultats abaque">
    <thead><tr><th>Ouvrage</th><th>HW (m)</th><th>détail</th><th>score</th></tr></thead>
    <tbody>${lignes}</tbody></table>
    <p class="method-note">${s.admissibles.length} candidats acceptables sur
      ${s.examines} examinés. Le classement ordonne une préférence de projet : il ne
      dit pas que les suivants sont faux.</p>`;

  el("dimRejets").innerHTML = compteurRejets(s) + calage(s.retenue, L, zRadier, zRoute, avecCotes);

  const r = s.retenue.r;
  const dgpc = reglesDgpcSix(s.retenue.D, r.remplissage * 100)
    .filter((x) => x.verdict === "non conforme");
  el("dimOut").innerHTML =
    `<strong>${s.retenue.libelle} à ${fr(s.retenue.J * 100, 1)} %</strong> —
     HW = ${fr(r.HW, 3)} m, contrôle
     ${r.controle === "entrée" ? "à l'entrée" : "à la sortie"}.
     ${dgpc.length
       ? `<small><br>§6 note DGPC N°1054/2019 : ${dgpc.map((x) => x.texte).join(" · ")}.
          Le premier du classement est écarté par une règle d'exploitation — reprendre
          le candidat suivant qui la respecte.</small>`
       : `<small><br>§6 note DGPC N°1054/2019 : hauteur et remplissage conformes ;
          prévoir une hauteur morte de ${fr(0.10 * s.retenue.D * 100, 0)} cm pour les dépôts.</small>`}`;
}

function compteurRejets(s) {
  const comptes = new Map();
  for (const c of s.candidats)
    for (const f of new Set(c.motifs.map(famille)))
      comptes.set(f, (comptes.get(f) || 0) + 1);
  if (!comptes.size) return "";
  const tri = [...comptes].sort((a, b) => b[1] - a[1]);
  return `<table class="resultats" style="margin-top:14px">
    <thead><tr><th>Critère mis en défaut</th><th>Candidats concernés</th></tr></thead>
    <tbody>${tri.map(([f, n]) =>
      `<tr><td>${f}</td><td class="q">${n} / ${s.examines}</td></tr>`).join("")}</tbody></table>
    <p class="method-note">Un candidat peut manquer plusieurs critères à la fois : les
      lignes ne s'additionnent pas. Le critère le plus fréquent est celui sur lequel agir.</p>`;
}

function calage(c, L, zRadier, zRoute, avecCotes) {
  if (!avecCotes) {
    return `<p class="method-note" style="margin-top:14px">Cotes non renseignées :
      revanche <strong>non vérifiable</strong> — ce qui n'est pas une conformité.</p>`;
  }
  const zAval = coteRadierAval(zRadier, c.J, L);
  const zPhe = cotePheAmont(zRadier, c.r.HW);
  const v = verdictRevanche(c.revanche);
  return `<div class="data-summary" style="margin-top:14px">
      <span><small>Radier amont</small><strong>${fr(zRadier, 2)} m</strong></span>
      <span><small>Radier aval (− J·L)</small><strong>${fr(zAval, 2)} m</strong></span>
      <span><small>Plan d'eau amont (+ HW)</small><strong>${fr(zPhe, 2)} m</strong></span>
      <span><small>Point bas chaussée</small><strong>${fr(zRoute, 2)} m</strong></span>
      <span><small>Revanche</small><strong>${fr(c.revanche, 2)} m</strong></span>
      <span><small>Verdict</small><strong>${v}</strong></span>
    </div>`;
}

el("dimForme").addEventListener("change", () => { remplirEntrees(); maj(); });
for (const id of ["dimEntree", "dimQ", "dimL", "dimJ", "dimK", "dimV", "dimN", "dimZr", "dimZc"])
  el(id).addEventListener("input", maj);
remplirEntrees();
maj();
