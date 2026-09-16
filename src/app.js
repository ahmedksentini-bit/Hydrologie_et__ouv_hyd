// Accueil et navigation par chapitre. Le contenu vient de data/chapitres.json :
// ajouter un chapitre ou une notion ne demande aucune modification de ce fichier.

import { chargerBanque, rendreListe, rendreExercice } from "./exercices.js";
import { chargerJson } from "./donnees.js";

const app = document.getElementById("app");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

let COURS = null;

async function charger() {
  COURS = await chargerJson("data/chapitres.json");
}

function exercicesDisponibles(ch) {
  return Number(ch.exercices || 0);
}

function accueil() {
  const { cours, parties, chapitres } = COURS;
  const parPartie = parties.map((p) => {
    const liste = chapitres.filter((c) => c.partie === p.id);
    return `<div class="section-title"><div><h2>Partie ${esc(p.id)} — ${esc(p.titre)}</h2>
      <p>${esc(p.resume)}</p></div></div>
      <section class="chapter-grid">${liste.map(carteChapitre).join("")}</section>`;
  }).join("");

  app.innerHTML = `
  <section class="hero">
    <p class="eyebrow">${esc(cours.sous_titre)}</p>
    <h1>${esc(cours.titre)}</h1>
    <p>Du bassin versant au débit de projet, puis du débit de projet à l'ouvrage
       dimensionné — avec les cartes, les abaques et les domaines de validité.</p>
    <div class="signature">${esc(cours.etablissement)}<br><strong>${esc(cours.enseignant)}</strong></div>
  </section>

  <div class="section-title"><div><h2>Ressources du cours</h2>
    <p>Le polycopié, le cours interactif, les exercices et les exerciseurs.</p></div></div>
  <section class="resource-grid">
    <a class="resource" href="docs/fascicule-debits-de-projet.pdf" rel="noopener"><span class="resource-mark">PDF</span>
      <h3>Polycopié</h3><p>Premier fascicule : averse de projet et débits de projet
      (chapitres 3 et 4). Les autres suivent.</p></a>
    <a class="resource" href="cours.html"><span class="resource-mark">§</span>
      <h3>Cours interactif</h3><p>Figures, cartes et calculateurs intégrés au fil du texte.</p></a>
    <a class="resource" href="exerciseur.html"><span class="resource-mark">∑</span>
      <h3>Exerciseur</h3><p>Le débit de projet calculé par toutes les méthodes, avec la synthèse.</p></a>
    <a class="resource" href="fil-rouge.html"><span class="resource-mark">⟶</span>
      <h3>Fil rouge</h3><p>Un seul franchissement, calculé du bassin versant à la protection
      de sortie — les neuf chapitres enchaînés sur un même cas.</p></a>
  </section>

  ${parPartie}`;

  app.querySelectorAll("[data-chapitre]").forEach((b) =>
    b.addEventListener("click", () => ouvrirChapitre(b.dataset.chapitre)));
}

function carteChapitre(ch) {
  const n = exercicesDisponibles(ch);
  const etat = n > 0 ? `${n} exercice${n > 1 ? "s" : ""} →`
             : ch.cours ? "cours disponible →"
             : "en préparation";
  return `<button class="chapter" data-chapitre="${esc(ch.id)}">
    <span class="num">${ch.number}</span>
    <h3>${esc(ch.title)}</h3>
    <p>${esc(ch.description)}</p>
    <span class="count">${etat}</span>
  </button>`;
}

async function ouvrirChapitre(id) {
  const ch = COURS.chapitres.find((c) => c.id === id);
  if (!ch) return;
  location.hash = `#${id}`;
  const banque = await chargerBanque(id);
  app.innerHTML = `
    <button class="back" id="retour">← Tous les chapitres</button>
    <section class="chapter-banner"><span class="num">${ch.number}</span>
      <div><h1>${esc(ch.title)}</h1><p>${esc(ch.description)}</p></div></section>
    <div class="card">
      <h2>Notions traitées</h2>
      <ul class="notions">${ch.notions.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
      <div class="actions">
        <a class="primary" href="cours.html#${esc(ch.id)}">Cours interactif</a>
        <a class="secondary" href="exerciseur.html#${esc(ch.id)}">Exerciseur</a>
      </div>
    </div>
    <div class="card" id="zoneExos">
      <h2>Exercices</h2>
      ${rendreListe(banque, null)}
    </div>`;
  if (!ch.cours) {
    const lien = app.querySelector('a.primary[href^="cours.html"]');
    if (lien) { lien.classList.replace("primary", "ghost"); lien.textContent = "Cours en préparation"; }
  }
  document.getElementById("retour").addEventListener("click", () => {
    location.hash = "";
    accueil();
  });
  app.querySelectorAll("[data-exo]").forEach((b) =>
    b.addEventListener("click", () => {
      const exo = banque.exercices.find((e) => e.id === b.dataset.exo);
      rendreExercice(exo, app, () => ouvrirChapitre(id));
      app.focus();
    }));
  app.focus();
}

function router() {
  const id = location.hash.replace("#", "");
  if (id && COURS.chapitres.some((c) => c.id === id)) ouvrirChapitre(id);
  else accueil();
}

charger().then(() => {
  router();
  window.addEventListener("hashchange", router);
  document.getElementById("homeButton").addEventListener("click", () => {
    location.hash = "";
    accueil();
  });
}).catch((e) => {
  app.innerHTML = `<div class="card"><h2>Chargement impossible</h2><p>${esc(e.message)}</p></div>`;
});

// Installation PWA : le bouton n'apparaît que si le navigateur le propose.
let invite = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  invite = e;
  const b = document.getElementById("installButton");
  b.hidden = false;
  b.addEventListener("click", async () => { b.hidden = true; invite.prompt(); invite = null; });
});
// L'enregistrement du service worker est dans src/socle.js, chargé par les
// quatre pages : le faire ici seulement laissait les lecteurs qui ouvrent
// directement le cours sur une version périmée.
