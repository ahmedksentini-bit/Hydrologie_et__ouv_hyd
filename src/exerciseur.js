// Exerciseur — débit de projet. Les solveurs sont dans solvers-hydro.js ;
// ce fichier ne fait que la saisie, l'enchaînement et l'affichage des motifs.
import * as h from "./solvers-hydro.js";

const CHAMPS = {
  fMorpho: [
    ["S", "Surface S", "km²", 2.35], ["P", "Périmètre P", "km", 7.2],
    ["L", "Longueur de l'écoulement", "km", 2.85], ["D", "Dénivelé du profil", "m", 96],
    ["Ieq", "Pente équivalente Ieq", "%", 3.4], ["H5", "H 5 %", "m", 800],
    ["H95", "H 95 %", "m", 696], ["Hmoy", "H moyenne", "m", 744],
    ["Hmin", "H minimale", "m", 690], ["Hmed", "H médiane", "m", 739],
    ["Zfr", "Altitude au franchissement", "m", 693],
    ["couv", "Couverture végétale", "%", 38],
  ],
  fPluies: [
    ["Pan", "Pluie annuelle", "mm", 300], ["P0", "Seuil P0 (carte)", "mm", 20],
    ["P10", "P10 journalière (carte)", "mm", 75], ["P100", "P100 journalière (carte)", "mm", 120],
  ],
  fIdf: [
    ["a", "Coefficient a", "", 211], ["b", "Exposant b", "", 0.633],
    ["c", "Exposant c (sur T)", "", 0.178], ["tmin", "Durée minimale calée", "min", 5],
  ],
};

const SELECTS = [
  ["tcRetenu", "Temps de concentration retenu",
    [["kirpich", "Kirpich"], ["ventura", "Ventura"], ["passini", "Passini"], ["giandotti", "Giandotti"]], "kirpich"],
  ["ghorbel", "Zone Ghorbel",
    [["", "hors zone"], ...Object.keys(h.GHORBEL_R).map((z) => [z, `${z} — ${h.GHORBEL_ZONES[z]}`])], "II"],
  ["kallel", "Région Kallel",
    [["", "hors zone"], ["NordCapBon", "Nord & Cap-Bon"], ["NoyauDorsale", "Noyau de la dorsale"],
     ["CentreSahel", "Centre & Sahel"], ["SudEstSudOuest", "Sud-Est & Sud-Ouest"]], "NoyauDorsale"],
  ["fersi", "Secteur Fersi",
    [["", "hors zone"], ["SudEst", "Sud-Est"], ["SudOuest", "Sud-Ouest"]], ""],
  ["frigui", "Région Frigui",
    [["", "hors zone"], ["Nord", "Nord"], ["Medjerda", "Medjerda"],
     ["CapBonMeliane", "Cap-Bon & Meliane"], ["CentreSud", "Centre & Sud"]], "CentreSud"],
  ["francou", "Région Francou–Rodier",
    [["", "non retenue"], ...Object.entries(h.FRANCOU_K).map(([k, v]) => [k, v.label])], "CentreDorsale"],
  // Zones IV et V : la base est ln (publication de Ghorbel). Le sélecteur ne rouvre pas
  // la question — il sert à montrer en séance ce que coûte l'autre lecture.
  ["ghorbelLog", "Base du logarithme, zones IV et V <small>(démonstration)</small>",
    [["ln", "ln — formule de Ghorbel"], ["log10", "log₁₀ — lecture fautive"]], "ln"],
];

const el = (id) => document.getElementById(id);
const val = (n) => parseFloat(el(n).value.replace(",", "."));
const fr = (x, d) => x.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
const f2 = (x) => x.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function construire() {
  for (const [zone, champs] of Object.entries(CHAMPS)) {
    el(zone).innerHTML = champs.map(([id, label, unite, def]) =>
      `<div class="field"><label for="${id}">${label}</label>
        <div class="input-wrap"><input id="${id}" type="text" inputmode="decimal" value="${def}">
        ${unite ? `<span class="unit">${unite}</span>` : ""}</div></div>`).join("");
  }
  el("fRegions").innerHTML =
    `<div class="field"><label for="T">Période de retour T</label>
      <div class="input-wrap"><input id="T" type="text" inputmode="numeric" value="30">
      <span class="unit">ans</span></div></div>` +
    SELECTS.map(([id, label, options, def]) =>
      `<div class="field"><label for="${id}">${label}</label>
        <div class="input-wrap"><select id="${id}">${options.map(([v, t]) =>
          `<option value="${v}"${v === def ? " selected" : ""}>${t}</option>`).join("")}</select></div></div>`).join("");
}

function ligne(nom, q, statut, motif) {
  const ok = statut === "ok";
  return `<tr class="${ok ? "" : "ecarte"}"><td>${nom}</td>
    <td class="q">${ok ? f2(q) : "—"}</td>
    <td class="motif">${ok ? fr(q / window.__S, 2) + " m³/s/km²" : motif}</td></tr>`;
}

function calculer() {
  const S = val("S"), P = val("P"), L = val("L"), D = val("D"), Ieq = val("Ieq");
  const Pan = val("Pan"), P0 = val("P0"), P10 = val("P10"), P100 = val("P100");
  const T = val("T");
  window.__S = S;
  const alerte = [];

  // ── morphométrie
  const { Ic, L: Lrect, l: lrect } = h.rectangleEquivalent(S, P);
  const Ig = h.indiceGlobalPente(val("H5"), val("H95"), Lrect);
  const dh = val("Hmed") - val("Zfr");
  const Hmoy = val("Hmoy") - val("Hmin");
  if (!(P0 < P10 && P10 < P100)) alerte.push("Lectures de cartes incohérentes : il faut P0 &lt; P10 &lt; P100.");

  // ── temps de concentration et intensité
  const tc = h.tempsConcentration({ S, L, D, iPct: Ieq, Hmoy });
  const tcRetenu = tc[el("tcRetenu").value];
  const tUtilise = h.dureeEffective(tcRetenu, val("tmin"));
  if (tUtilise > tcRetenu + 1e-9)
    alerte.push(`tc = ${f2(tcRetenu)} min est sous la durée minimale calée ` +
                `(${f2(val("tmin"))} min) : intensité évaluée à ${f2(tUtilise)} min.`);
  const i = h.montana(val("a"), val("b"), val("c"), tUtilise, T);
  const lame = (i * tUtilise) / 60;
  if (lame > 0.8 * P10)
    alerte.push(`Lame d'eau ${f2(lame)} mm en ${f2(tUtilise)} min, soit ` +
                `${(lame / P10 * 100).toFixed(0)} % de P10 : vérifier l'unité de durée des coefficients.`);

  // ── méthodes
  const rows = [];
  const retenus = [];

  const abaque = h.coefficientRuissellement(Ieq, val("couv"));
  if (S >= 4) rows.push(ligne("Rationnelle", 0, "ko", "hors domaine : S ≥ 4 km²"));
  else if (!abaque) rows.push(ligne("Rationnelle", 0, "ko", "couverture végétale non mesurée"));
  else {
    const q = h.rationnelle(abaque.C, i, S);
    rows.push(ligne(`Rationnelle <small>C = ${fr(abaque.C, 2)}</small>`, q, "ok"));
    retenus.push(q);
  }

  if (Pan > 500) rows.push(ligne("SOGREAH", 0, "ko", "hors domaine : pluie annuelle > 500 mm"));
  else {
    const PT = h.sogreahPluie(T, P10, P100);
    if (PT <= P0) rows.push(ligne("SOGREAH", 0, "ko", "P_T ≤ P0 : pas de ruissellement"));
    else {
      const seuil = h.sogreahRuisselle(PT, P0);
      if (!seuil.ruisselle) rows.push(ligne("SOGREAH", 0, "ko", seuil.motif));
      else { const q = h.sogreahDebit(S, PT, P0); rows.push(ligne("SOGREAH", q, "ok")); retenus.push(q); }
    }
  }

  const zg = el("ghorbel").value;
  if (!zg) rows.push(ligne("Ghorbel", 0, "ko", "hors zone"));
  else {
    const R = h.GHORBEL_R[zg][T];
    if (R === undefined)
      rows.push(ligne("Ghorbel", 0, "ko",
        `hors table : T calés ${Object.keys(h.GHORBEL_R[zg]).join(", ")} ans`));
    else {
      const base = el("ghorbelLog").value;
      const grande = zg === "IV" || zg === "V";
      const qmax = grande
        ? h.ghorbelQmax45(S, base)
        : h.ghorbelQmax123(S, Pan / 1000, dh, L, Ic);
      const q = qmax * R;
      rows.push(ligne(`Ghorbel <small>zone ${zg}</small>`, q, q > 0 ? "ok" : "ko", "Qmax négatif : vérifier P, Δh, L, Ic"));
      if (q > 0) retenus.push(q);
      if (zg === "V") alerte.push("Ghorbel zone V : peu testée, résultat indicatif.");
      if (grande && base === "log10")
        alerte.push("<strong>Démonstration, pas un calcul de projet.</strong> Ghorbel écrit "
          + "85·ln(S) ; lire log₁₀ divise Q<sub>max</sub> par ln(10) ≈ 2,30 — ici "
          + `${f2(h.ghorbelQmax45(S, "ln") * R)} m³/s deviennent ${f2(qmax * R)} m³/s.`);
    }
  }

  const rk = el("kallel").value;
  if (!rk) rows.push(ligne("Kallel", 0, "ko", "hors zone"));
  else if (S < 100) rows.push(ligne("Kallel", 0, "ko", "hors domaine : S < 100 km²"));
  else { const q = h.kallel(rk, S, T); rows.push(ligne("Kallel", q, "ok")); retenus.push(q); }

  const sf = el("fersi").value;
  if (!sf) rows.push(ligne("Fersi", 0, "ko", "hors zone"));
  else if (Pan > 400) rows.push(ligne("Fersi", 0, "ko", "hors domaine : pluie annuelle > 400 mm"));
  else {
    const y = h.FERSI_Y[sf][T];
    if (y === undefined)
      rows.push(ligne("Fersi", 0, "ko", `hors table : T calés ${Object.keys(h.FERSI_Y[sf]).join(", ")} ans`));
    else {
      const q = h.fersiQx(h.fersiQxMoyen(h.fersiEcoulement(Pan, Ig), S), S, Ig, y);
      rows.push(ligne("Fersi", q, "ok")); retenus.push(q);
    }
  }

  const rf = el("frigui").value;
  if (!rf) rows.push(ligne("Frigui", 0, "ko", "hors zone"));
  else {
    const q = h.frigui(rf, S, T);
    if (q === null)
      rows.push(ligne("Frigui", 0, "ko",
        `hors table : λ calé ${Object.keys(h.FRIGUI[rf].lambda).join(", ")} ans`));
    else { rows.push(ligne("Frigui", q, "ok")); retenus.push(q); }
  }

  const regionFrancou = el("francou").value;
  if (!regionFrancou) rows.push(ligne("Francou–Rodier", 0, "ko", "région non retenue"));
  else {
    const q = h.francouRodier(S, h.FRANCOU_K[regionFrancou].K);
    if (S < 100) rows.push(ligne("Francou–Rodier", 0, "ko",
      `enveloppe hors domaine (S < 100 km²) — donnerait ${f2(q)} m³/s`));
    else { rows.push(ligne("Francou–Rodier", q, "ok")); retenus.push(q); }
  }

  // ── affichage
  el("resultats").innerHTML = `
    <div class="data-summary">
      <span><small>Ic</small><strong>${fr(Ic, 3)}</strong></span>
      <span><small>Rectangle équivalent</small><strong>${fr(Lrect, 2)} × ${fr(lrect, 2)} km</strong></span>
      <span><small>Ig</small><strong>${fr(Ig, 2)} m/km</strong></span>
      <span><small>Δh de Ghorbel</small><strong>${fr(dh, 0)} m</strong></span>
      <span><small>tc retenu</small><strong>${f2(tcRetenu)} min</strong></span>
      <span><small>Intensité i</small><strong>${f2(i)} mm/h</strong></span>
    </div>
    <table class="resultats"><thead><tr><th>Méthode</th><th>Q (m³/s)</th>
      <th>débit spécifique / motif</th></tr></thead><tbody>${rows.join("")}</tbody></table>
    ${alerte.map((a) => `<p class="hint">${a}</p>`).join("")}`;

  const s = h.synthese(retenus);
  el("synthese").innerHTML = s
    ? `<div class="final-result"><strong>Médiane : ${f2(s.mediane)} m³/s</strong>
         <small> — sur ${s.n} méthode${s.n > 1 ? "s" : ""} applicable${s.n > 1 ? "s" : ""}</small></div>
       <div class="data-summary" style="margin-top:12px">
         <span><small>Minimum</small><strong>${f2(s.min)} m³/s</strong></span>
         <span><small>Maximum</small><strong>${f2(s.max)} m³/s</strong></span>
         <span><small>Moyenne</small><strong>${f2(s.moyenne)} m³/s</strong></span>
         <span><small>Coefficient de variation</small><strong>${fr(s.cv, 1)} %</strong></span>
       </div>
       ${s.cv > 50 ? `<p class="hint">Forte dispersion (CV = ${s.cv.toFixed(0)} %) :
         la médiane ne suffit pas à justifier un débit. Regarder la structure du faisceau —
         deux couples cohérents très éloignés ne se résument pas par leur milieu.</p>` : ""}
       <p class="method-note">La médiane propose un débit, elle ne le justifie pas : le débit
          de projet s'argumente par le domaine de validité et la cohérence entre familles
          de méthodes.</p>`
    : `<p class="feedback bad">Aucune méthode applicable avec ces données.</p>`;
}

construire();
el("calculer").addEventListener("click", calculer);
el("reinit").addEventListener("click", () => { construire(); calculer(); });
calculer();
