// Moteur d'exercices : une banque par chapitre, trois modes de travail.
//   entraînement — correction et explication à chaque question ;
//   examen       — aucune correction avant la remise, puis le score ;
//   révision     — le corrigé d'emblée, pour relire une méthode.
// Deux types de question : « choix » (une bonne réponse) et « nombre » (avec tolérance).

const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export async function chargerBanque(chapitreId) {
  try {
    const r = await fetch(`data/exercices-${chapitreId}.json`);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

export function rendreListe(banque, ouvrir) {
  if (!banque || !banque.exercices.length)
    return `<p class="method-note">Exercices de ce chapitre : en cours de rédaction.</p>`;
  return `<section class="exercise-list">${banque.exercices.map((e, i) => `
    <button class="exercise-card" data-exo="${esc(e.id)}">
      <span class="exercise-index">${i + 1}</span>
      <span><strong>${esc(e.titre)}</strong>
        <small>Niveau ${e.difficulte} · ${e.questions.length} question${e.questions.length > 1 ? "s" : ""}</small></span>
      <span class="arrow">→</span></button>`).join("")}</section>`;
}

const MODES = [["entrainement", "Entraînement"], ["examen", "Examen"], ["revision", "Révision"]];

export function rendreExercice(exo, conteneur, onRetour) {
  let mode = "entrainement";

  function dessiner() {
    const corrige = mode === "revision";
    conteneur.innerHTML = `
      <button class="back" id="retourExos">← Exercices du chapitre</button>
      <section class="chapter-banner"><span class="num">${exo.difficulte}</span>
        <div><h1>${esc(exo.titre)}</h1><p>Niveau ${exo.difficulte}</p></div></section>
      <div class="exo-modes">${MODES.map(([v, t]) =>
        `<button data-mode="${v}"${v === mode ? ' class="active"' : ""}>${t}</button>`).join("")}</div>
      <div class="card"><h2>Énoncé</h2><p class="statement">${esc(exo.enonce)}</p></div>
      <div class="card">
        <h2>Questions</h2>
        ${exo.questions.map((q, i) => bloc(q, i, corrige)).join("")}
        ${mode === "examen"
          ? `<div class="actions"><button class="primary" id="remettre">Remettre la copie</button></div>`
          : ""}
        <div id="score"></div>
      </div>`;

    conteneur.querySelector("#retourExos").addEventListener("click", onRetour);
    conteneur.querySelectorAll("[data-mode]").forEach((b) =>
      b.addEventListener("click", () => { mode = b.dataset.mode; dessiner(); }));

    if (mode === "entrainement") {
      exo.questions.forEach((q, i) => {
        conteneur.querySelectorAll(`[name="q${i}"]`).forEach((input) =>
          input.addEventListener("change", () => corriger(q, i)));
        const champ = conteneur.querySelector(`#n${i}`);
        if (champ) champ.addEventListener("change", () => corriger(q, i));
      });
    }
    const remise = conteneur.querySelector("#remettre");
    if (remise) remise.addEventListener("click", () => {
      let bons = 0;
      exo.questions.forEach((q, i) => { if (corriger(q, i)) bons++; });
      const part = bons / exo.questions.length;
      conteneur.querySelector("#score").innerHTML =
        `<div class="exo-score${part < 0.5 ? " faible" : ""}">${bons} / ${exo.questions.length}
         — ${part >= 0.8 ? "maîtrisé" : part >= 0.5 ? "à consolider" : "à revoir"}</div>`;
      remise.disabled = true;
    });
  }

  function bloc(q, i, corrige) {
    const corps = q.type === "choix"
      ? `<div class="exo-choix" id="c${i}">${q.options.map((o, k) => `
          <label data-opt="${k}"><input type="radio" name="q${i}" value="${k}"> ${esc(o)}</label>`).join("")}</div>`
      : `<div class="answer-row"><div class="input-wrap">
           <input id="n${i}" type="text" inputmode="decimal" placeholder="votre réponse">
           ${q.unite ? `<span class="unit">${esc(q.unite)}</span>` : ""}</div></div>`;
    return `<div class="exo-question">
      <p class="question-title">${i + 1}. ${esc(q.texte)}</p>
      ${corps}
      <p class="feedback" id="f${i}"></p>
      <div class="exo-explication" id="e${i}"${corrige ? "" : " hidden"}>${esc(q.explication)}</div>
    </div>`;
  }

  function corriger(q, i) {
    const feedback = conteneur.querySelector(`#f${i}`);
    let juste = false;
    if (q.type === "choix") {
      const choisi = conteneur.querySelector(`[name="q${i}"]:checked`);
      if (!choisi) { feedback.textContent = "Pas de réponse."; feedback.className = "feedback bad"; }
      else {
        juste = Number(choisi.value) === q.reponse;
        conteneur.querySelectorAll(`#c${i} label`).forEach((l) => {
          const k = Number(l.dataset.opt);
          l.classList.toggle("juste", k === q.reponse);
          l.classList.toggle("faux", k === Number(choisi.value) && !juste);
        });
        feedback.textContent = juste ? "Exact." : "Ce n'est pas la bonne réponse.";
        feedback.className = `feedback ${juste ? "good" : "bad"}`;
      }
    } else {
      const v = parseFloat((conteneur.querySelector(`#n${i}`).value || "").replace(",", "."));
      if (!Number.isFinite(v)) { feedback.textContent = "Pas de réponse."; feedback.className = "feedback bad"; }
      else {
        juste = Math.abs(v - q.reponse) <= (q.tolerance ?? 0);
        const fr = (x) => x.toLocaleString("fr-FR", { maximumFractionDigits: 3 });
        feedback.textContent = juste
          ? "Exact."
          : `Attendu : ${fr(q.reponse)}${q.unite ? " " + q.unite : ""}` +
            `${q.tolerance ? ` (± ${fr(q.tolerance)})` : ""}.`;
        feedback.className = `feedback ${juste ? "good" : "bad"}`;
      }
    }
    conteneur.querySelector(`#e${i}`).hidden = false;
    return juste;
  }

  dessiner();
}
