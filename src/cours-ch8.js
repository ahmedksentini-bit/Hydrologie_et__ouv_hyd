// Chapitre 8 — trois figures : la tête et ses deux descriptions, la protection
// de sortie, puis la chaîne averse → fossé → descente d'eau.
import { REGLES_ANGLE, ARETES, angleAdmissible, anglesEsthetiques, biseauSuperieur,
         biseauLateral, epaisseurBase, verifierEpaisseurTete, EPAISSEUR_TETE_MIN,
         isbash, vitesseIsbash, masseBloc, longueurProtection, C_ISBASH,
         VITESSES_ADMISSIBLES, dimensionnerFosse, descenteEau, debitPlateforme }
  from "./solvers-annexes.js";
import { montana } from "./solvers-hydro.js";

const el = (id) => document.getElementById(id);
const num = (id) => parseFloat((el(id).value || "").replace(",", "."));
const fr = (x, d) => Number.isFinite(x)
  ? x.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";

// Station de référence du chapitre 3, reprise telle quelle.
const STATION = { a: 211, b: 0.633, c: 0.178 };

// ── 1. La tête ────────────────────────────────────────────────────────────

/**
 * Vue en plan d'une tête. L'angle est mesuré depuis l'axe de l'ouvrage :
 * 0° prolonge les piédroits, 90° donne un mur frontal. C'est la convention de
 * la source, et la figure la rend visible plutôt que de la faire réciter.
 */
function planTete(angleDeg, sansAile) {
  const W = 380, H = 220, axeY = 110, xTete = 180, demiB = 34, xFin = 372;
  const rad = (angleDeg * Math.PI) / 180;
  const Lm = 92;
  const aile = (signe) => {
    const x2 = xTete - Lm * Math.cos(rad);
    const y2 = axeY + signe * (demiB + Lm * Math.sin(rad));
    return `<line x1="${xTete}" y1="${(axeY + signe * demiB).toFixed(1)}"
      x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#0f766e" stroke-width="5"
      stroke-linecap="round"/>`;
  };
  // arc de cotation entre l'axe (vers l'amont) et l'aile supérieure
  const r = 46;
  const arc = sansAile ? "" : `<path d="M${(xTete - r).toFixed(1)},${axeY - demiB}
      A${r},${r} 0 0 1 ${(xTete - r * Math.cos(rad)).toFixed(1)},${(axeY - demiB - r * Math.sin(rad)).toFixed(1)}"
      fill="none" stroke="#b45309" stroke-width="1.3"/>
    <text x="${(xTete - r - 6).toFixed(1)}" y="${(axeY - demiB - 10).toFixed(1)}" font-size="11"
      fill="#b45309" font-weight="800" text-anchor="end">${fr(angleDeg, 0)}°</text>`;

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img"
      aria-label="Vue en plan de la tête d'ouvrage : angle des murs en aile mesuré depuis l'axe">
    <line x1="60" y1="${axeY}" x2="${xFin}" y2="${axeY}" stroke="#94a3b8"
      stroke-width="1" stroke-dasharray="7 4"/>
    <text x="${xFin}" y="${axeY - 6}" font-size="10" fill="#64748b" text-anchor="end">axe de l'ouvrage</text>
    <rect x="${xTete}" y="${axeY - demiB - 7}" width="${xFin - xTete}" height="7" fill="#94a3b8"/>
    <rect x="${xTete}" y="${axeY + demiB}" width="${xFin - xTete}" height="7" fill="#94a3b8"/>
    <rect x="${xTete}" y="${axeY - demiB}" width="${xFin - xTete}" height="${2 * demiB}"
      fill="#e0f2fe" opacity=".7"/>
    <text x="${xTete + 60}" y="${axeY + 4}" font-size="11" fill="#0369a1" font-weight="700">ouvrage</text>
    ${sansAile
      ? `<line x1="${xTete}" y1="${axeY - demiB - 34}" x2="${xTete}" y2="${axeY + demiB + 34}"
           stroke="#0f766e" stroke-width="6" stroke-linecap="round"/>
         <text x="${xTete - 10}" y="${axeY - demiB - 42}" font-size="11" fill="#0f766e"
           font-weight="700" text-anchor="end">mur frontal, sans aile</text>`
      : aile(-1) + aile(1) + arc}
    <line x1="62" y1="${axeY}" x2="${xTete - Lm - 18}" y2="${axeY}"
      stroke="#0891b2" stroke-width="1.6"/>
    <path d="M${xTete - Lm - 18},${axeY} l-12,-5 v10 z" fill="#0891b2"/>
    <text x="64" y="${axeY + 18}" font-size="10" fill="#0e7490">écoulement</text>
  </svg>`;
}

function majTete() {
  const id = el("tEntree").value;
  const angle = num("tAngle"), L = num("tL"), biais = num("tBiais");
  const D = num("tD"), ep = num("tEp"), h = num("tH"), fruit = num("tFruit");
  const regle = REGLES_ANGLE[id], sansAile = regle.genre === "sansAile";
  const verdict = angleAdmissible(id, angle);
  const esth = anglesEsthetiques(L, biais);
  const eBase = epaisseurBase(ep, h, fruit, 0);
  const vEp = verifierEpaisseurTete(ep);

  el("tAngle").disabled = sansAile;
  el("tAngle").closest(".field").style.opacity = sansAile ? 0.45 : 1;
  el("tFig").innerHTML = planTete(sansAile ? 90 : angle, sansAile);

  const domaine = regle.genre === "plage" ? `plage ${regle.min}° à ${regle.max}°`
    : regle.genre === "discret" ? `${regle.valeurs.join("° ou ")}° — et rien entre les deux`
    : regle.genre === "impose" ? `${regle.defaut}° imposé` : "pas de mur en aile";

  el("tTable").innerHTML = `<table class="resultats">
    <thead><tr><th>Description</th><th>Ce qu'elle fixe ici</th></tr></thead>
    <tbody>
      <tr${verdict.ok || sansAile ? "" : ' class="alerte"'}>
        <td>Hydraulique (HDS-5)</td>
        <td class="motif">${regle.libelle} · angles admissibles : <strong>${domaine}</strong> ·
          ${ARETES[id].libelle}${sansAile ? "" :
            (verdict.ok ? ` · l'angle de ${fr(angle, 0)}° est dans la famille : les coefficients ne bougent pas`
                        : ` · <strong>${verdict.motif}</strong> — les coefficients ne s'appliquent plus`)}</td></tr>
      <tr><td>Arêtes</td><td class="motif">${ARETES[id].vive
        ? "arête vive : aucun biseau, aucun chanfrein"
        : `biseau supérieur ${fr(biseauSuperieur(id, D) * 100, 1)} cm — fraction de
           D = ${fr(D, 2)} m, jamais de la hauteur de remblai · biseaux latéraux
           ${fr(biseauLateral(id, L) * 100, 1)} cm`}</td></tr>
      ${sansAile ? "" : `<tr><td>Géométrie (guide PICF)</td>
        <td class="motif">proposition esthétique : α<sub>g</sub> = 15 + 0,03 × ${fr(L, 2)}² =
          ${fr(esth.alphaG, 3)} gr → <strong>α = ${fr(esth.alpha, 3)}°</strong> ·
          β = ${fr(esth.beta, 3)}°${Math.abs(biais - 90) > 1e-9
            ? " — ouvrage biais : α ≠ β, et les quatre ailes diffèrent"
            : " — ouvrage droit : α = β"}</td></tr>`}
      <tr${vEp.verdict === "conforme" ? "" : ' class="alerte"'}>
        <td>Épaisseurs</td>
        <td class="motif">en tête ${fr(ep, 3)} m — ${vEp.verdict}${vEp.motif ? ` (${vEp.motif})` : ""} ·
          en pied ${fr(eBase, 3)} m par prédimensionnement, <strong>à justifier</strong> par
          le calcul de stabilité</td></tr>
    </tbody></table>`;

  el("tOut").innerHTML = sansAile
    ? `<strong>${regle.libelle}</strong> — aucun mur en aile, donc aucun angle à choisir.
       <small><br>Le traitement d'arête suffit à décrire la tête du point de vue
       hydraulique. Une buse est dans ce cas quelle que soit sa tête : ni piédroit,
       ni mur en aile.</small>`
    : verdict.ok
      ? `<strong>Angle de ${fr(angle, 0)}° admissible</strong> — ${domaine}.
         <small><br>Les coefficients HDS-5 de cette configuration s'appliquent tels quels.
         Le guide de conception proposerait, pour l'harmonie, α = ${fr(esth.alpha, 3)}° —
         ${Math.abs(angle - esth.alpha) < 5 ? "proche de la valeur retenue"
           : "sensiblement différent, ce qui est admis : la proposition esthétique n'est pas une contrainte hydraulique"}.</small>`
      : `<strong>Angle de ${fr(angle, 0)}° refusé</strong> — ${verdict.motif}.
         <small><br>Ce n'est pas un avertissement de confort : hors de sa famille, la
         configuration n'a plus de coefficients. Il faut changer de configuration, pas
         forcer l'angle.</small>`;
}

// ── 2. La protection de sortie ────────────────────────────────────────────

function courbeMasse(V, opts) {
  const L = 440, H = 200, MG = 52, MD = 16, MH = 12, MB = 32;
  const vMin = 0.8, vMax = 4.2;
  const mMax = masseBloc(isbash(vMax, opts));
  const px = (v) => MG + ((v - vMin) / (vMax - vMin)) * (L - MG - MD);
  const py = (m) => H - MB - (Math.log10(Math.max(m, 0.05) / 0.05) / Math.log10(mMax / 0.05)) * (H - MH - MB);
  const pas = Array.from({ length: 61 }, (_, i) => vMin + (i / 60) * (vMax - vMin));
  const graduations = [1, 10, 100, 1000].filter((m) => m <= mMax).map((m) =>
    `<line x1="${MG}" y1="${py(m).toFixed(1)}" x2="${L - MD}" y2="${py(m).toFixed(1)}"
       stroke="#eef2f7" stroke-width="1"/>
     <text x="${MG - 6}" y="${(py(m) + 3).toFixed(1)}" font-size="10" fill="#64748b"
       text-anchor="end">${m} kg</text>`).join("");
  const abscisses = [1, 1.5, 2, 2.5, 3, 3.5, 4].map((v) =>
    `<text x="${px(v).toFixed(1)}" y="${H - MB + 14}" font-size="10" fill="#64748b"
       text-anchor="middle">${String(v).replace(".", ",")}</text>`).join("");
  const m = masseBloc(isbash(V, opts));
  return `<svg viewBox="0 0 ${L} ${H}" width="100%" role="img"
      aria-label="Masse du bloc de protection en fonction de la vitesse de sortie, échelle logarithmique">
    ${graduations}${abscisses}
    <path d="${pas.map((v, i) => `${i ? "L" : "M"}${px(v).toFixed(1)},${py(masseBloc(isbash(v, opts))).toFixed(1)}`).join("")}"
      fill="none" stroke="#b45309" stroke-width="2.4"/>
    ${V >= vMin && V <= vMax ? `<line x1="${px(V).toFixed(1)}" y1="${py(m).toFixed(1)}"
      x2="${px(V).toFixed(1)}" y2="${H - MB}" stroke="#be123c" stroke-width="1.2"
      stroke-dasharray="4 3"/>
      <circle cx="${px(V).toFixed(1)}" cy="${py(m).toFixed(1)}" r="5" fill="#be123c"/>` : ""}
    <text x="${MG}" y="${H - 4}" font-size="10" fill="#475569">vitesse de sortie (m/s)</text>
  </svg>`;
}

function majProtection() {
  const V = num("pV"), W0 = num("pW"), Ss = num("pSs"), C = parseFloat(el("pC").value);
  if (!(V > 0 && W0 > 0 && Ss > 1)) {
    el("pFig").innerHTML = ""; el("pTable").innerHTML = "";
    el("pOut").textContent = "Renseigner la vitesse, la largeur et la densité.";
    return;
  }
  const opts = { Ss, C };
  const d50 = isbash(V, opts), m = masseBloc(d50);
  el("pFig").innerHTML = courbeMasse(V, opts);

  const lits = VITESSES_ADMISSIBLES.map((r) => {
    const Vadm = r.calculee ? vitesseIsbash(0.20, { Ss }) : r.max;
    const p = longueurProtection(W0, V, Vadm);
    return { ...r, Vadm, L: p ? p.L : null, motif: p ? p.motif : null };
  });

  el("pTable").innerHTML = `<table class="resultats">
    <thead><tr><th>Lit récepteur</th><th>V admissible</th><th>Longueur de protection</th></tr></thead>
    <tbody>${lits.map((r) => `<tr>
      <td>${r.libelle}${r.calculee ? " (d<sub>50</sub> = 0,20 m)" : ""}</td>
      <td class="motif">${fr(r.Vadm, 2)} m/s${r.calculee ? " — <strong>calculée</strong> par Isbash" : ""}</td>
      <td class="q">${r.L === null ? "—" : r.L === 0 ? "aucune" : fr(r.L, 1) + " m"}</td></tr>`).join("")}
    </tbody></table>
    <div class="data-summary" style="margin-top:12px">
      <span><small>d<sub>50</sub> d'Isbash</small><strong>${fr(d50, 3)} m</strong></span>
      <span><small>Masse du bloc</small><strong>${fr(m, 1)} kg</strong></span>
      <span><small>Contrôle : V admissible de ce bloc</small><strong>${fr(vitesseIsbash(d50, opts), 3)} m/s</strong></span>
      <span><small>Coefficient retenu</small><strong>C = ${fr(C, 2)}</strong></span>
    </div>`;

  const m2 = masseBloc(isbash(V + 0.5, opts));
  el("pOut").innerHTML =
    `<strong>d<sub>50</sub> = ${fr(d50, 3)} m, soit un bloc de ${fr(m, 1)} kg.</strong>
     <small><br>La masse varie comme V⁶ : cinquante centimètres par seconde de plus la
     porteraient à ${fr(m2, 1)} kg, soit ${fr(m2 / m, 1)} fois plus. Le contrôle ci-dessus
     redonne exactement la vitesse d'entrée — c'est la même relation lue dans l'autre
     sens.</small>`;
}

// ── 3. De l'averse au fossé, et du fossé à la descente ────────────────────

function majFosse() {
  const tc = num("fTc"), T = parseFloat(el("fT").value);
  const larg = num("fLarg"), long = num("fLong");
  const b = num("fB"), m = num("fM"), J = num("fJ") / 100;
  const rev = el("fRev").value;
  const i = montana(STATION.a, STATION.b, STATION.c, tc, T);
  const plate = debitPlateforme({ i, largeur: larg, longueur: long });
  if (!plate || !(J > 0)) {
    el("fTable").innerHTML = "";
    el("fOut").textContent = "Renseigner la durée, la géométrie drainée et la pente.";
    return;
  }
  const K = rev === "beton" ? 65 : rev === "maconnerie" ? 50 : rev === "enrochement" ? 25 : 30;
  const f = dimensionnerFosse({ Q: plate.Q, b, m, J, K, revetement: rev });
  const d = descenteEau({ Q: plate.Q, largeur: Math.max(b, 0.3), penteTalus: 2 / 3, K: 65 });
  const iBassin = montana(STATION.a, STATION.b, STATION.c, 32.9, T);

  el("fTable").innerHTML = `<table class="resultats">
    <thead><tr><th>Étape</th><th>Valeur</th><th>Détail</th></tr></thead>
    <tbody>
      <tr><td>Intensité</td><td class="q">${fr(i, 1)} mm/h</td>
        <td class="motif">i = 211·t<sup>−0,633</sup>·T<sup>0,178</sup> à t = ${fr(tc, 0)} min et
          T = ${T} ans · au t<sub>c</sub> du bassin (32,9 min) elle ne vaudrait que
          ${fr(iBassin, 1)} mm/h, soit ${fr(i / iBassin, 1)} fois moins</td></tr>
      <tr><td>Surface drainée</td><td class="q">${fr(plate.S * 1e6, 0)} m²</td>
        <td class="motif">${fr(larg, 1)} m × ${fr(long, 0)} m · C = ${fr(plate.C, 2)} (chaussée revêtue)</td></tr>
      <tr><td>Débit collecté</td><td class="q">${fr(plate.Q * 1000, 1)} L/s</td>
        <td class="motif">Q = 0,278 × ${fr(plate.C, 2)} × ${fr(i, 1)} × ${fr(plate.S, 6)}</td></tr>
      ${f.erreur ? `<tr class="alerte"><td>Fossé</td><td class="q">—</td>
        <td class="motif">${f.erreur}</td></tr>`
      : `<tr${f.vitesseOk ? "" : ' class="alerte"'}><td>Fossé</td>
        <td class="q">${fr(f.yn * 100, 1)} cm</td>
        <td class="motif">V = ${fr(f.vitesse, 3)} m/s contre ${fr(f.vitesseAdmissible, 2)} m/s admissibles
          (${f.revetement.libelle}) · ${f.regime} · emprise ${fr(f.largeurEmprise, 2)} m
          pour une hauteur de ${fr(f.hauteur, 2)} m</td></tr>`}
      ${d.erreur ? "" : `<tr><td>Descente sur talus 3/2</td>
        <td class="q">${fr(d.yn * 100, 1)} cm</td>
        <td class="motif">V = ${fr(d.vitesse, 2)} m/s · Froude ${fr(d.Froude, 1)} · ${d.regime} ·
          ressaut en pied : conjuguée ${fr(d.conjuguee * 100, 1)} cm, soit
          ${fr(d.conjuguee / d.yn, 0)} fois le tirant amont</td></tr>`}
    </tbody></table>`;

  const notes = [];
  if (!f.erreur && f.vitesse < 0.3)
    notes.push("la vitesse est si faible que le fossé s'envasera : c'est l'entretien, pas l'hydraulique, qui le dimensionne");
  if (!f.erreur && !f.vitesseOk)
    notes.push(`vitesse au-delà de l'admissible du revêtement : passer au revêtement supérieur ou réduire la pente`);
  if (!f.erreur && f.yn < 0.08)
    notes.push("tirant sous 8 cm : la section minimale d'entretien commandera, pas le débit");
  if (!d.erreur && d.vitesse > 3)
    notes.push(`descente à ${fr(d.vitesse, 1)} m/s : revêtement bétonné ou préfabriqué obligatoire, et ouvrage de pied pour recevoir le ressaut`);

  el("fOut").innerHTML =
    `<strong>${fr(plate.Q * 1000, 1)} L/s à évacuer${f.erreur ? "" :
      `, tirant ${fr(f.yn * 100, 1)} cm, vitesse ${fr(f.vitesse, 2)} m/s`}.</strong>
     ${notes.length ? `<small><br>${notes.join(" · ")}.</small>` : ""}`;
}

// ── Câblage ───────────────────────────────────────────────────────────────

el("tEntree").innerHTML = Object.entries(REGLES_ANGLE).map(([id, r]) =>
  `<option value="${id}">${r.libelle}</option>`).join("");
el("fRev").innerHTML = VITESSES_ADMISSIBLES.map((r) =>
  `<option value="${r.id}"${r.id === "terre-vegetalisee" ? " selected" : ""}>${r.libelle}</option>`).join("");

el("tEntree").addEventListener("change", () => {
  const r = REGLES_ANGLE[el("tEntree").value];
  if (r.genre !== "sansAile" && r.defaut !== undefined) el("tAngle").value = String(r.defaut);
  majTete();
});
for (const id of ["tAngle", "tL", "tBiais", "tD", "tEp", "tH", "tFruit"])
  el(id).addEventListener("input", majTete);
for (const id of ["pV", "pW", "pSs"]) el(id).addEventListener("input", majProtection);
el("pC").addEventListener("change", majProtection);
for (const id of ["fTc", "fLarg", "fLong", "fB", "fM", "fJ"])
  el(id).addEventListener("input", majFosse);
for (const id of ["fT", "fRev"]) el(id).addEventListener("change", majFosse);

majTete(); majProtection(); majFosse();
