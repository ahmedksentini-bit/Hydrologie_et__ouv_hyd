// Lecture interactive de l'abaque du coefficient de ruissellement.
// On montre la planche entière avec la case retenue en surbrillance : n'afficher
// que la valeur lue interdirait le contrôle « suis-je sur la bonne ligne ? ».
import { coefficientRuissellement, indiceVegetation } from "./solvers-hydro.js";

const el = (id) => document.getElementById(id);
const num = (id) => parseFloat((el(id).value || "").replace(",", "."));

const LIGNES = [
  ["Pente faible (0–2 %) ou moyenne (2–8 %)", [0.40, 0.50, 0.60], (p) => p <= 8],
  ["Pente forte (> 8 %)", [0.50, 0.60, 0.70], (p) => p > 8],
];

function maj() {
  const pente = num("aPente"), couv = num("aCouv");
  const lu = coefficientRuissellement(pente, couv);
  const iv = indiceVegetation(couv);

  el("aTable").innerHTML = `<table class="resultats abaque">
    <thead><tr><th>Classe de pente</th><th>indice 1</th><th>indice 2</th><th>indice 3</th></tr></thead>
    <tbody>${LIGNES.map(([nom, vals, active]) => {
      const ligneActive = lu && active(pente);
      return `<tr>${[`<td>${nom}</td>`, ...vals.map((v, k) =>
        `<td class="q${ligneActive && iv === k + 1 ? " retenue" : ""}">${v.toFixed(2).replace(".", ",")}</td>`)].join("")}</tr>`;
    }).join("")}</tbody></table>`;

  if (!lu) {
    el("aOut").innerHTML = !(pente > 0)
      ? "Pente du bassin à renseigner : sans elle, la classe de pente est inconnue."
      : "Couverture végétale à mesurer : sans elle, l'indice de végétation (1, 2 ou 3) n'existe pas — et donc C non plus.";
    return;
  }
  const libelle = { faible: "faible (0 à 2 %)", moyenne: "moyenne (2 à 8 %)", forte: "forte (> 8 %)" }[lu.classePente];
  const couvLib = iv === 1 ? "plus de 50 % du bassin couvert"
    : iv === 2 ? "30 à 50 % du bassin couvert" : "moins de 30 % du bassin couvert";
  el("aOut").innerHTML =
    `<strong>C = ${lu.C.toFixed(2).replace(".", ",")}</strong>
     <small> — pente ${libelle} · indice de végétation ${iv} (${couvLib}).</small>`;
}

for (const id of ["aPente", "aCouv"]) el(id).addEventListener("input", maj);
maj();
