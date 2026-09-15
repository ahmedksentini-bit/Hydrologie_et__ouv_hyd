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

// ── Toutes les régionalisations sur un même bassin ─────────────────────────
// Règle du chapitre, appliquée ici sans exception : une méthode qui ne sort
// pas DIT pourquoi. Une case vide se lit comme une panne, et pousse à
// interpoler entre deux périodes tabulées — ce qu'aucun manuel n'autorise.
import {
  DOMAINES, resumeDomaine, motifsHorsDomaine,
  GHORBEL_R, GHORBEL_ZONES, FERSI_Y, FRIGUI, KALLEL, FRANCOU_K,
  rectangleEquivalent, sogreahPluie, sogreahDebit, sogreahRuisselle,
  ghorbelQmax123, ghorbelQmax45,
  kallel, fersiEcoulement, fersiQxMoyen, fersiQx, frigui, francouRodier, synthese,
} from "./solvers-hydro.js";

const fr = (x, d) => Number.isFinite(x)
  ? x.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";

const LIBELLES = {
  kallel: { NordCapBon: "Nord et Cap-Bon", NoyauDorsale: "Noyau de la dorsale",
            CentreSahel: "Centre et Sahel", SudEstSudOuest: "Sud-Est et Sud-Ouest" },
  frigui: { Nord: "Nord", Medjerda: "Medjerda", CapBonMeliane: "Cap-Bon et Meliane",
            CentreSud: "Centre et Sud" },
  fersi: { SudEst: "Sud-Est", SudOuest: "Sud-Ouest" },
};

function options(id, entrees, defaut) {
  el(id).innerHTML = entrees.map(([v, t]) =>
    `<option value="${v}"${v === defaut ? " selected" : ""}>${t}</option>`).join("");
}

/** Une méthode : soit un débit avec le détail des coefficients, soit un motif de refus. */
function methodes(d) {
  const { S, T, Pan, dh, Ig, P0, P10, P100, Ic, L, zone, regKallel, regFrigui, secFersi, K } = d;
  const out = [];

  // SOGREAH — calée entre 10 et 100 ans, la pluie s'interpolant en variable de Gumbel.
  if (T < 10) out.push({ nom: "SOGREAH", refus: "calée entre 10 et 100 ans : sous 10 ans, P_T sortirait de l'interpolation" });
  else {
    const PT = sogreahPluie(T, P10, P100);
    const seuil = sogreahRuisselle(PT, P0);
    if (!seuil.ruisselle) out.push({ nom: "SOGREAH", refus: seuil.motif });
    else out.push({ nom: "SOGREAH", Q: sogreahDebit(S, PT, P0),
      detail: `P_T = ${fr(PT, 1)} mm (interpolée en y entre P10 et P100) · S^0,75 = ${fr(Math.pow(S, 0.75), 2)}` });
  }

  // Ghorbel — table R_T fermée : 2, 5, 10, 20, 50, 100.
  const R = GHORBEL_R[zone]?.[T];
  if (R === undefined)
    out.push({ nom: `Ghorbel ${zone}`, refus: `R_T non tabulé à ${T} ans (table : 2, 5, 10, 20, 50, 100)` });
  else {
    const grande = zone === "IV" || zone === "V";
    const Qmax = grande ? ghorbelQmax45(S) : ghorbelQmax123(S, Pan / 1000, dh, L, Ic);
    out.push({ nom: `Ghorbel ${zone}`, Q: R * Qmax,
      detail: grande
        ? `Q_max = 85·ln(${fr(S, 1)}) = ${fr(Qmax, 2)} · R = ${fr(R, 2)}`
        : `Q_max = ${fr(Qmax, 2)} avec P = ${fr(Pan / 1000, 3)} m, Δh = ${fr(dh, 0)} m, L = ${fr(L, 2)} km, Ic = ${fr(Ic, 3)} · R = ${fr(R, 2)}` });
  }

  // Kallel — analytique en T, mais calée sur les grands bassins.
  if (S < 100) out.push({ nom: "Kallel", refus: `calée pour S ≥ 100 km² (ici ${fr(S, 1)} km²)` });
  else {
    const r = KALLEL[regKallel];
    const q0 = regKallel === "CentreSahel" ? (T <= 20 ? 14.3 : 24.7) : r.q0;
    out.push({ nom: "Kallel", Q: kallel(regKallel, S, T),
      detail: `q₀ = ${fr(q0, 2)} · α = ${fr(r.alpha, 2)} · T^0,41 = ${fr(Math.pow(T, 0.41), 3)}` });
  }

  // Fersi — table y_T sans 2 ans, et domaine de pluie annoncé.
  const y = FERSI_Y[secFersi]?.[T];
  if (Pan > 400) out.push({ nom: "Fersi", refus: `domaine annoncé : pluie annuelle ≤ 400 mm (ici ${fr(Pan, 0)} mm)` });
  else if (y === undefined)
    out.push({ nom: "Fersi", refus: `y_T non tabulé à ${T} ans (table : 5, 10, 20, 50, 100)` });
  else {
    const He = fersiEcoulement(Pan, Ig);
    const Qm = fersiQxMoyen(He, S);
    out.push({ nom: "Fersi", Q: fersiQx(Qm, S, Ig, y),
      detail: `He = ${fr(He, 2)} mm · Qx moyen = ${fr(Qm, 2)} m³/s · y = ${fr(y, 3)}` });
  }

  // Frigui — λ calé pour 2, 5, 10 et 50 ans seulement.
  const r = FRIGUI[regFrigui];
  if (r.lambda[T] === undefined)
    out.push({ nom: "Frigui", refus: `λ non calé à ${T} ans (calages : 2, 5, 10 et 50 ans)` });
  else out.push({ nom: "Frigui", Q: frigui(regFrigui, S, T),
    detail: `λ = ${fr(r.lambda[T], 2)} · Am = ${fr(r.Am, 1)} · n = ${fr(r.n, 2)}` });

  // Francou–Rodier — enveloppe, hors synthèse par construction.
  if (S < 100) out.push({ nom: "Francou–Rodier", refus: `enveloppe valable pour S ≥ 100 km² (ici ${fr(S, 1)} km²)`, enveloppe: true });
  else out.push({ nom: "Francou–Rodier", Q: francouRodier(S, K), enveloppe: true,
    detail: `K = ${fr(K, 1)} · exposant 1 − K/10 = ${fr(1 - K / 10, 2)} — enveloppe de crues observées` });

  return out;
}

function barres(liste) {
  const valides = liste.filter((m) => m.Q > 0);
  if (!valides.length) return "";
  const L = 460, hLigne = 26, MG = 118, MD = 56;
  const H = valides.length * hLigne + 14;
  const max = Math.max(...valides.map((m) => m.Q));
  return `<svg viewBox="0 0 ${L} ${H}" width="100%" role="img"
      aria-label="Débits comparés des méthodes régionales">
    ${valides.map((m, i) => {
      const y = i * hLigne + 8, w = ((L - MG - MD) * m.Q) / max;
      return `<text x="${MG - 8}" y="${y + 12}" font-size="11" fill="#334155"
          text-anchor="end">${m.nom}</text>
        <rect x="${MG}" y="${y + 2}" width="${w.toFixed(1)}" height="14" rx="3"
          fill="${m.enveloppe ? "#fcd34d" : "#38bdf8"}"
          ${m.enveloppe ? 'stroke="#b45309" stroke-width="1" stroke-dasharray="4 2"' : ""}/>
        <text x="${(MG + w + 6).toFixed(1)}" y="${y + 13}" font-size="11" fill="#0369a1"
          font-weight="700">${fr(m.Q, 1)}</text>`;
    }).join("")}
  </svg>`;
}

function majRegio() {
  const n = (id) => parseFloat((el(id).value || "").replace(",", "."));
  const S = n("gS"), P = n("gP");
  if (!(S > 0 && P > 0)) {
    el("gRegioTable").innerHTML = ""; el("gRegioFig").innerHTML = "";
    el("gRegioOut").textContent = "Renseigner la surface et le périmètre.";
    return;
  }
  const { Ic, L } = rectangleEquivalent(S, P);
  const T = parseInt(el("gT").value, 10);
  const liste = methodes({
    S, T, Pan: n("gPan"), dh: n("gDh"), Ig: n("gIg"),
    P0: n("gP0"), P10: n("gP10"), P100: n("gP100"), Ic, L,
    zone: el("gZone").value, regKallel: el("gKallel").value,
    regFrigui: el("gFrigui").value, secFersi: el("gFersi").value,
    K: parseFloat(el("gK").value),
  });

  el("gRegioTable").innerHTML = `<table class="resultats">
    <thead><tr><th>Méthode</th><th>Q (m³/s)</th><th>Coefficients employés, ou motif</th></tr></thead>
    <tbody>${liste.map((m) => `<tr${m.refus ? ' class="alerte"' : ""}>
      <td>${m.nom}</td>
      <td class="q">${m.Q > 0 ? fr(m.Q, 1) : "—"}</td>
      <td class="motif">${m.refus ? `<strong>ne sort pas</strong> — ${m.refus}` : m.detail}</td>
    </tr>`).join("")}</tbody></table>`;

  el("gRegioFig").innerHTML = barres(liste);

  const retenues = liste.filter((m) => m.Q > 0 && !m.enveloppe);
  const s = synthese(retenues.map((m) => m.Q));
  const env = liste.find((m) => m.enveloppe && m.Q > 0);
  const muettes = liste.filter((m) => m.refus && !m.enveloppe);

  el("gRegioOut").innerHTML = !s
    ? `<strong>Aucune méthode applicable à T = ${T} ans sur ce bassin.</strong>
       <small><br>Le tableau dit pourquoi, ligne par ligne. Changer de période de retour
       n'est pas une option libre — c'est la note DGPC qui la fixe.</small>`
    : `<strong>${s.n} méthode${s.n > 1 ? "s" : ""} sur les ${liste.length - 1} de fréquence :
       médiane ${fr(s.mediane, 1)} m³/s</strong>, de ${fr(s.min, 1)} à ${fr(s.max, 1)} m³/s,
       dispersion ${fr(s.cv, 0)} %.
       <small><br>${muettes.length
         ? `${muettes.length} méthode${muettes.length > 1 ? "s" : ""} hors calage à
            ${T} ans : ${muettes.map((m) => m.nom).join(", ")}. `
         : ""}${env
         ? `L'enveloppe de Francou–Rodier donne ${fr(env.Q, 1)} m³/s ; elle
            <strong>n'entre pas dans la synthèse</strong> — c'est une borne de
            vraisemblance, pas une estimation de fréquence. ${env.Q < s.max
              ? "Ici elle passe SOUS le maximum des méthodes : le débit le plus fort est à réexaminer."
              : "Les estimations restent en dessous, ce qui est le comportement attendu."}`
         : ""}
       ${s.cv > 60 ? " La dispersion dépasse 60 % : retenir une médiane sans discuter serait une moyenne d'ignorances." : ""}</small>`;
}

options("gZone", Object.entries(GHORBEL_ZONES).map(([k, v]) => [k, `${k} — ${v}`]), "III");
options("gKallel", Object.entries(LIBELLES.kallel), "CentreSahel");
options("gFrigui", Object.entries(LIBELLES.frigui), "CentreSud");
options("gFersi", Object.entries(LIBELLES.fersi), "SudEst");
options("gK", Object.entries(FRANCOU_K).map(([, v]) => [v.K, `K = ${v.K} — ${v.label}`]), 4.3);
for (const id of ["gS", "gP", "gT", "gPan", "gDh", "gIg", "gP0", "gP10", "gP100",
                  "gZone", "gKallel", "gFrigui", "gFersi", "gK"])
  el(id).addEventListener(el(id).tagName === "SELECT" ? "change" : "input", majRegio);
majRegio();

// ── Le tableau des domaines, engendré par les bornes appliquées ────────────
// Il n'est pas recopié : une borne modifiée dans DOMAINES se propage ici, et
// un test confronte les deux. Un tableau de synthèse recopié à la main finit
// toujours par contredire le calcul qu'il résume.

el("gDomaines").innerHTML = `<table class="resultats">
  <thead><tr><th>Méthode</th><th>Domaine annoncé</th><th>Ce qui arrive hors domaine</th></tr></thead>
  <tbody>${Object.entries(DOMAINES).map(([id, d]) => `
    <tr><td>${d.nom}</td>
      <td class="motif">${resumeDomaine(id)}${d.condition ? `<small>${d.condition}</small>` : ""}</td>
      <td class="motif">${d.enveloppe
        ? "la valeur se calcule, mais elle ne signifie rien"
        : "inapplicable — la méthode est écartée avec son motif"}${
        d.note ? `<small>${d.note}</small>` : ""}</td></tr>`).join("")}
  </tbody></table>`;
