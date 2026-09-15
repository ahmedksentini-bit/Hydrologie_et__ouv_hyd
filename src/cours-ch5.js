// Calculateurs du chapitre 5 : risque sur la durée de vie et sélecteur DGPC §4.
import { risqueDepassement, periodeRetour } from "./solvers-hydro.js";

const el = (id) => document.getElementById(id);
const num = (id) => parseFloat(el(id).value.replace(",", "."));
const pct = (x) => x.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function majRisque() {
  const T = num("rT"), n = num("rN");
  if (!(T > 0 && n > 0)) { el("rOut").textContent = "Renseigner T et n."; return; }
  const R = risqueDepassement(T, n) * 100;
  const juge = R > 60 ? "élevé" : R > 30 ? "notable" : R > 10 ? "modéré" : "faible";
  el("rOut").innerHTML =
    `Risque d'au moins un dépassement en ${n} ans : <strong>${pct(R)} %</strong>
     <small> — ${juge}. La crue de projet n'est pas un plafond.</small>`;
}

function majDgpc() {
  const categorie = el("dCat").value, ouvrage = el("dOuv").value;
  const S = num("dS"), tjma = num("dT");
  if (!(S > 0)) { el("dOut").textContent = "Renseigner la surface du bassin."; return; }
  const T = periodeRetour({ categorie, ouvrage, S, tjma: tjma || 0 });
  const motif =
    ouvrage === "submersible" ? "ouvrage submersible : 100 ans quelle que soit la route"
    : categorie === "autoroute" ? "autoroute, express ou rocade : 100 ans"
    : categorie === "piste" ? `piste rurale : seule la surface intervient (S = ${S} km²)`
    : ouvrage === "art" ? "route classée avec ouvrage d'art : systématiquement 100 ans"
    : S >= 100 ? "route classée, S ≥ 100 km² : 100 ans quel que soit le trafic"
    : tjma > 3300 ? "route classée, TJMA > 3300 : 100 ans"
    : tjma > 650 ? "route classée, 650 < TJMA ≤ 3300"
    : S >= 10 ? "route classée, TJMA ≤ 650 et 10 ≤ S < 100 km²"
    : "route classée, TJMA ≤ 650 et S < 10 km²";
  const alerte = T === 30
    ? ` <small>— à 30 ans, Ghorbel, Fersi et Frigui sortent de leurs tables.</small>` : "";
  el("dOut").innerHTML = `<strong>T = ${T} ans</strong> <small>— ${motif}.</small>${alerte}`;
}

for (const id of ["rT", "rN"]) el(id).addEventListener("input", majRisque);
for (const id of ["dCat", "dOuv", "dS", "dT"]) el(id).addEventListener("input", majDgpc);
majRisque();
majDgpc();
