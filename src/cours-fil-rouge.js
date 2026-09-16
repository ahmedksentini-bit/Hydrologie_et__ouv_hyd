// Le fil rouge : l'affichage. Tout le calcul est dans solvers-fil-rouge.js, et
// tout ce qui s'affiche ici en vient. Aucune valeur n'est écrite en dur dans
// cette page : c'est la règle qui empêche un cas d'école de dériver.
import { chaine, ETAPES } from "./solvers-fil-rouge.js";
import { DOMAINES } from "./solvers-hydro.js";
import { chargerDonnees, signalerPanne } from "./donnees.js";

const el = (id) => document.getElementById(id);
const fr = (x, d = 2) => Number.isFinite(x)
  ? x.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";
const pc = (x, d = 0) => Number.isFinite(x) ? `${fr(100 * x, d)} %` : "—";

let CAS, MONTANA, SOGREAH;
try {
  [CAS, MONTANA, SOGREAH] = await chargerDonnees("fil-rouge", "stations-montana", "stations-sogreah");
} catch (e) {
  signalerPanne(["frSynoptique", "frProfil", "frEtapes", "frBilan", "frAlerte"], e);
  throw e;
}
const TABLES = { montana: MONTANA, sogreah: SOGREAH };

const LIB_CATEGORIE = { classee: "classée (RN, RR, RL)", autoroute: "autoroute", piste: "piste" };

const C = { tn: "#d6d3d1", tnTrait: "#78716c", beton: "#cbd5e1", betonTrait: "#475569",
            eau: "#7dd3fc", eauTrait: "#0369a1", route: "#1f2937", repere: "#b45309",
            muet: "#94a3b8", cote: "#475569", alerte: "#b91c1c", bon: "#15803d" };

// ── La chaîne, en une vue ──────────────────────────────────────────────────

function synoptique(c) {
  const lignes = [
    { e: "morpho", entre: "un MNT et un tracé",
      sort: `S = ${fr(c.morpho.S, 2)} km² · I<sub>c</sub> = ${fr(c.morpho.Ic, 3)} · I<sub>g</sub> = ${fr(c.morpho.Ig, 1)} m/km` },
    { e: "pluies", entre: "30 ans de maxima journaliers",
      sort: `P<sub>10</sub> = ${fr(c.pluies.P10, 1)} mm · P<sub>100</sub> = ${fr(c.pluies.P100, 1)} mm` },
    { e: "periode", entre: `route ${LIB_CATEGORIE[c.periode.categorie] ?? c.periode.categorie}, ${c.periode.tjma} v/j, S = ${fr(c.morpho.S, 1)} km²`,
      sort: `<strong>T = ${c.periode.T} ans</strong>${c.periode.impose ? " (imposée)" : ""}` },
    { e: "averse", entre: `S, L, la pente du thalweg, et T`,
      sort: `t<sub>c</sub> = ${fr(c.averse.tc, 0)} min · i = ${fr(c.averse.intensite, 1)} mm/h` },
    { e: "debits", entre: "la morphométrie, les pluies, T",
      sort: `<strong>Q = ${fr(c.debits.Q, 1)} m³/s</strong> — ${c.debits.retenues.length} méthodes applicables sur 7` },
    { e: "oued", entre: `Q et le levé de l'oued`,
      sort: c.oued.horsLeve ? `<span class="motif">hors du levé</span>`
        : `plan d'eau ${fr(c.oued.zPlanEau, 2)} m → <strong>TW = ${fr(c.TW, 2)} m</strong>` },
    { e: "calage", entre: "le levé du lit, la largeur de la route, le biais",
      sort: `L = ${fr(c.calage.L, 2)} m · J = ${fr(100 * c.calage.J, 3)} %` },
    { e: "ouvrage", entre: "Q, TW, L, J",
      sort: c.ouvrage ? `<strong>${c.ouvrage.libelle}</strong> · HW = ${fr(c.ouvrage.r.HW, 2)} m · revanche ${fr(c.ouvrage.revanche, 2)} m`
        : `<span class="motif">aucun candidat admissible</span>` },
    { e: "protection", entre: "la vitesse de sortie et celle de l'oued",
      sort: c.protection ? `d₅₀ = ${fr(100 * c.protection.d50, 0)} cm sur ${fr(c.protection.longueur.L, 0)} m` : "—" },
    { e: "controle", entre: "l'ouvrage retenu, aux crues courantes et à la crue forte",
      sort: c.controle
        ? `ressaut ${c.controle.ressauts[0]?.position.position ?? "—"} · crue forte : ${c.controle.surverse ? "la route déverse" : "pas de surverse"}`
        : "—" },
  ];
  return `<table class="resultats synoptique">
    <thead><tr><th>Étape</th><th>Ce qui entre</th><th>Ce qui sort, et passe à la suivante</th></tr></thead>
    <tbody>${lignes.map(({ e, entre, sort }) => {
      const m = ETAPES.find((x) => x.id === e);
      return `<tr><td><strong>${m.n}. ${m.titre}</strong><br>
        <small><a href="cours.html#${m.chapitre}">chapitre ${m.chapitre.slice(2)}</a></small></td>
        <td class="motif">${entre}</td><td>${sort}</td></tr>`;
    }).join("")}</tbody></table>`;
}

// ── Le franchissement, en coupe ────────────────────────────────────────────

function profil(c) {
  if (!c.ouvrage) return `<p class="feedback bad">Pas d'ouvrage retenu : la coupe n'a rien à montrer.</p>`;
  const W = 680, H = 300, MG = 56, MD = 96, MH = 26, MB = 34;
  const g = c.calage, o = c.ouvrage, r = o.r;
  const demi = g.L / 2 + 10;
  const zBas = Math.min(g.zRadierAval, c.cas.oued.points[8].z) - 1.2;
  const zHaut = g.zPlateforme + 0.9;
  const X = (x) => MG + ((x + demi) / (2 * demi)) * (W - MG - MD);
  const Y = (z) => H - MB - ((z - zBas) / (zHaut - zBas)) * (H - MH - MB);

  // Terrain naturel : la pente du lit, de part et d'autre du franchissement.
  const zTn = (x) => c.cas.franchissement.zTnEntree - c.cas.oued.pente * (x + g.L / 2);
  const tn = `<path d="M${X(-demi)},${Y(zTn(-demi))} L${X(demi)},${Y(zTn(demi))}
    L${X(demi)},${H - MB} L${X(-demi)},${H - MB}Z" fill="${C.tn}" stroke="${C.tnTrait}" stroke-width="1.2"/>`;

  // Remblai. La coupe suit l'AXE DE L'OUVRAGE, pas l'axe de la route : le biais
  // étire la plateforme et les talus dans le même rapport qu'il étire l'ouvrage.
  // Les dessiner à leur largeur vraie ferait sortir le dalot du remblai.
  const etire = g.allongement;
  const demiPlate = (g.plateforme * etire) / 2;
  const fruit = c.cas.route.fruitTalus * etire;
  const piedAm = -demiPlate - fruit * (g.zPlateforme - zTn(-demiPlate));
  const piedAv = demiPlate + fruit * (g.zPlateforme - zTn(demiPlate));
  const remblai = `<path d="M${X(piedAm)},${Y(zTn(piedAm))} L${X(-demiPlate)},${Y(g.zPlateforme)}
    L${X(demiPlate)},${Y(g.zPlateforme)} L${X(piedAv)},${Y(zTn(piedAv))}Z"
    fill="#e7e5e4" stroke="${C.tnTrait}" stroke-width="1.2" stroke-linejoin="round"/>`;

  // L'ouvrage, de tête à tête.
  const xAm = -g.L / 2, xAv = g.L / 2;
  const boite = `<path d="M${X(xAm)},${Y(g.zRadierAmont)} L${X(xAv)},${Y(g.zRadierAval)}
      L${X(xAv)},${Y(g.zRadierAval + o.D)} L${X(xAm)},${Y(g.zRadierAmont + o.D)}Z"
      fill="#fff" stroke="${C.betonTrait}" stroke-width="2"/>`;

  // Les deux plans d'eau : la charge à l'amont, le niveau naturel à l'aval.
  const eauAmont = `<path d="M${X(-demi)},${Y(c.ouvrage.zPhe)} L${X(xAm)},${Y(c.ouvrage.zPhe)}
      L${X(xAm)},${Y(g.zRadierAmont)} L${X(-demi)},${Y(zTn(-demi))}Z"
      fill="${C.eau}" opacity=".55"/>
    <line x1="${X(-demi)}" y1="${Y(c.ouvrage.zPhe)}" x2="${X(xAm)}" y2="${Y(c.ouvrage.zPhe)}"
      stroke="${C.eauTrait}" stroke-width="2"/>`;
  const eauAval = `<path d="M${X(xAv)},${Y(c.oued.zPlanEau)} L${X(demi)},${Y(c.oued.zPlanEau)}
      L${X(demi)},${Y(zTn(demi))} L${X(xAv)},${Y(g.zRadierAval)}Z" fill="${C.eau}" opacity=".55"/>
    <line x1="${X(xAv)}" y1="${Y(c.oued.zPlanEau)}" x2="${X(demi)}" y2="${Y(c.oued.zPlanEau)}"
      stroke="${C.eauTrait}" stroke-width="2"/>`;

  const cote = (x, z1, z2, texte, couleur, dx = 0) => `
    <line x1="${X(x) + dx}" y1="${Y(z1)}" x2="${X(x) + dx}" y2="${Y(z2)}" stroke="${couleur}"
      stroke-width="1.3" marker-start="url(#frF)" marker-end="url(#frF)"/>
    <text x="${X(x) + dx + 5}" y="${(Y(z1) + Y(z2)) / 2 + 3.5}" font-size="9.5" font-weight="700"
      fill="${couleur}">${texte}</text>`;

  const niveau = (z, texte, couleur, x1 = -demi, x2 = demi) => `
    <line x1="${X(x1)}" y1="${Y(z)}" x2="${X(x2)}" y2="${Y(z)}" stroke="${couleur}"
      stroke-width="0.9" stroke-dasharray="4 3" opacity=".65"/>
    <line x1="${X(demi)}" y1="${Y(z)}" x2="${W - MD + 2}" y2="${Y(z)}" stroke="${couleur}"
      stroke-width="0.7" stroke-dasharray="2 3" opacity=".45"/>
    <text x="${W - MD + 5}" y="${Y(z) + 3}" font-size="9" fill="${couleur}">${texte}</text>`;

  const protège = c.protection ? `
    <line x1="${X(xAv)}" y1="${Y(zTn(xAv)) + 6}" x2="${X(Math.min(xAv + c.protection.longueur.L, demi))}"
      y2="${Y(zTn(xAv)) + 6}" stroke="${C.repere}" stroke-width="3"/>
    <text x="${X(xAv) + 4}" y="${Y(zTn(xAv)) + 18}" font-size="9" fill="${C.repere}">
      enrochement d₅₀ ${fr(100 * c.protection.d50, 0)} cm sur ${fr(c.protection.longueur.L, 0)} m</text>` : "";

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img"
      aria-label="Coupe du franchissement : remblai, ouvrage, plan d'eau amont et aval">
    <defs><marker id="frF" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="5" markerHeight="5"
      orient="auto"><path d="M0,0L8,4L0,8Z" fill="${C.cote}"/></marker></defs>
    ${tn}${eauAmont}${eauAval}${remblai}${boite}
    <line x1="${X(-demiPlate)}" y1="${Y(g.zPlateforme)}" x2="${X(demiPlate)}" y2="${Y(g.zPlateforme)}"
      stroke="${C.route}" stroke-width="3.5"/>
    ${niveau(g.zPlateforme, `chaussée ${fr(g.zPlateforme, 2)}`, C.route)}
    ${niveau(c.ouvrage.zPhe, `PHE ${fr(c.ouvrage.zPhe, 2)}`, C.eauTrait, -demi, xAm)}
    ${niveau(c.oued.zPlanEau, `oued ${fr(c.oued.zPlanEau, 2)}`, "#0891b2", xAv, demi)}
    ${cote(-demiPlate + 0.6, c.ouvrage.zPhe, g.zPlateforme, `revanche ${fr(c.ouvrage.revanche, 2)} m`, C.cote)}
    ${cote(xAv + 2.2, g.zRadierAval, c.oued.zPlanEau, `TW ${fr(c.TW, 2)} m`, "#0891b2")}
    ${cote(xAm - 2.2, g.zRadierAmont, c.ouvrage.zPhe, `HW ${fr(r.HW, 2)} m`, C.eauTrait)}
    ${protège}
    <text x="${X(0)}" y="${Y((g.zRadierAmont + g.zRadierAval) / 2 + o.D / 2) - 6}" font-size="10"
      font-weight="800" fill="${C.betonTrait}" text-anchor="middle">${o.libelle}</text>
    <text x="${X(0)}" y="${Y((g.zRadierAmont + g.zRadierAval) / 2) + 13}" font-size="9"
      fill="${C.cote}" text-anchor="middle">L = ${fr(g.L, 2)} m · J = ${fr(100 * g.J, 3)} % · biais ${c.cas.route.biaisDeg}°</text>
    <text x="${MG}" y="14" font-size="10.5" font-weight="800" fill="#075985">
      ${c.cas.projet.nom} — ${c.cas.projet.route}, PK ${c.cas.projet.pk}</text>
    <text x="${W - MD}" y="14" font-size="8.5" fill="${C.muet}" text-anchor="end">
      hauteurs exagérées ${fr(((H - MH - MB) / (zHaut - zBas)) / ((W - MG - MD) / (2 * demi)), 0)} fois</text>
  </svg>`;
}

// ── Les dix étapes, dans le détail ─────────────────────────────────────────

const carte = (m, corps) => `<section class="card" id="fr-${m.id}">
  <h2>${m.n} · ${m.titre} <small style="font-weight:500;color:#64748b">—
    <a href="cours.html#${m.chapitre}">chapitre ${m.chapitre.slice(2)}</a></small></h2>
  ${corps}</section>`;

// data-summary : la feuille commune y rend small et strong en blocs, dans une
// case bordée. C'est le rendu qu'il faut ici, pas celui de data-grid.
const grille = (paires) => `<div class="data-summary">${paires.map(([k, v, note]) =>
  `<span><small>${k}</small><strong>${v}</strong>${note ? `<small class="note">${note}</small>` : ""}</span>`
).join("")}</div>`;

function etapes(c) {
  const E = (id) => ETAPES.find((x) => x.id === id);
  const out = [];

  out.push(carte(E("morpho"), `
    <p>Tout commence par une délimitation. Quatre nombres en sortent, et ce sont eux que
       toutes les régionalisations du chapitre 4 réclameront.</p>
    ${grille([
      ["Surface S", `${fr(c.morpho.S, 2)} km²`, "elle décide à elle seule de quatre méthodes sur sept"],
      ["Périmètre P", `${fr(c.morpho.P, 2)} km`],
      ["Indice de compacité I<sub>c</sub>", fr(c.morpho.Ic, 3),
       c.morpho.icPlancher ? "au-dessus du plancher 1,128 : mesure cohérente" : "sous le plancher géométrique : mesure fausse"],
      ["Rectangle équivalent", `${fr(c.morpho.rect.L, 2)} × ${fr(c.morpho.rect.l, 2)} km`],
      ["Indice global de pente I<sub>g</sub>", `${fr(c.morpho.Ig, 2)} m/km`, "(H₅ − H₉₅) / L du rectangle"],
      ["Densité de drainage", `${fr(c.morpho.densiteDrainage, 2)} km/km²`],
      ["Thalweg L", `${fr(c.morpho.L, 2)} km`, `pente moyenne ${fr(c.morpho.penteThalwegPct, 2)} %`],
      ["Δh de Ghorbel", `${fr(c.morpho.dh, 0)} m`, "H médiane − altitude au franchissement"],
    ])}
    <p class="method-note">L'altitude minimale du bassin est celle du lit au droit de
       l'ouvrage : c'est ce qui rend Δh calculable sans autre donnée. Un bassin délimité
       ailleurs qu'au franchissement ne donnerait pas le même Δh — et Ghorbel changerait.</p>`));

  const pl = c.pluies;
  out.push(carte(E("pluies"), `
    <p>Trente maxima journaliers à la station de ${pl.station}, ajustés par Gumbel. La
       planche SOGREAH, elle, donne une valeur de <em>zone</em> — pas de poste. Les deux
       sources se confrontent&nbsp;; elles ne se remplacent pas.</p>
    ${grille([
      ["Moyenne de la série", `${fr(pl.ajustement.moyenne, 1)} mm`, `sur ${pl.ajustement.n} années`],
      ["Écart-type", `${fr(pl.ajustement.ecartType, 1)} mm`],
      ["Gradex", `${fr(pl.ajustement.gradex, 2)} mm`, "σ·√6/π — la pente de la droite de Gumbel"],
      ["P₁₀ ajustée", `${fr(pl.P10, 1)} mm`, `planche : ${pl.planche.P10} mm · écart ${pc(pl.ecartP10, 1)}`],
      ["P₁₀₀ ajustée", `${fr(pl.P100, 1)} mm`, `planche : ${pl.planche.P100} mm · écart ${pc(pl.ecartP100, 1)}`],
      ["Période de retour du maximum observé", `${fr(pl.retourDuMax, 0)} ans`,
       `${fr(Math.max(...pl.serie), 1)} mm, sur ${pl.ajustement.n} ans de relevés`],
    ])}
    <div class="sanity-check"><h3>Deux sources, deux réponses — et c'est normal</h3>
      <p>La décennale de la série et celle de la planche ne s'écartent que de
         ${pc(Math.abs(pl.ecartP10), 1)} : la station confirme la zone. La centennale, elle,
         s'écarte de ${pc(Math.abs(pl.ecartP100), 1)}, et dans le sens attendu — trente ans de
         relevés ne contraignent pas la queue de distribution, alors que la planche, calée
         sur des séries longues, s'y montre plus prudente.</p>
      <p>Pour la suite, <strong>SOGREAH reçoit les valeurs de sa planche</strong>, et pas
         celles de la série : une méthode se nourrit des données sur lesquelles elle a été
         calée. Mélanger les deux, c'est appliquer une formule à des entrées qu'elle n'a
         jamais vues.</p></div>`));

  const pe = c.periode;
  out.push(carte(E("periode"), `
    <p>Rien de ce qui suit n'a de sens sans elle : le débit, la section, la revanche
       changent tous avec T. Elle ne se choisit pas au jugé, elle se lit dans la note.</p>
    ${grille([
      ["Période retenue", `${pe.T} ans`, pe.impose ? `imposée ici ; la note donnerait ${pe.Tauto} ans` : "celle que donne la règle"],
      ["Catégorie", LIB_CATEGORIE[pe.categorie] ?? pe.categorie],
      ["Trafic", `${pe.tjma} v/j`],
      ["Surface du bassin", `${fr(c.morpho.S, 2)} km²`, "≥ 10 km² : c'est ce seuil qui fait basculer la règle"],
      ["Risque sur 10 ans", pc(pe.risque10ans, 0), "probabilité d'au moins un dépassement"],
      ["Risque sur 30 ans", pc(pe.risque30ans, 0), "la durée de vie d'un ouvrage courant"],
    ])}
    <p class="method-note">Le risque n'est pas l'inverse de la période : sur trente ans, une
       crue cinquantennale a ${pc(pe.risque30ans, 0)} de chances de survenir au moins une fois.
       C'est cette phrase, et non « T = ${pe.T} ans », qu'il faut savoir dire au maître d'ouvrage.</p>`));

  const av = c.averse;
  out.push(carte(E("averse"), `
    <p>Quatre formules pour un seul temps de concentration, et elles ne s'accordent pas.
       L'écart entre la plus courte et la plus longue est d'un facteur
       <strong>${fr(av.ecartExtremes, 1)}</strong>.</p>
    <table class="resultats"><thead><tr><th>Formule</th><th>t<sub>c</sub></th>
      <th>Intensité de Montana à ce t<sub>c</sub></th></tr></thead><tbody>
      ${[["Kirpich", av.formules.kirpich], ["Ventura", av.formules.ventura],
         ["Passini", av.formules.passini], ["Giandotti", av.formules.giandotti]]
        .map(([n, t]) => `<tr><td>${n}</td><td class="q">${fr(t, 1)} min</td>
          <td class="q">${fr(av.station.aT[c.options.T] ? av.a.a * Math.pow(Math.max(t, 5), -av.station.b) * Math.pow(c.options.T, av.station.c) : NaN, 1)} mm/h</td></tr>`).join("")}
      <tr class="alerte"><td><strong>Médiane retenue</strong></td>
        <td class="q"><strong>${fr(av.tc, 1)} min</strong></td>
        <td class="q"><strong>${fr(av.intensite, 1)} mm/h</strong></td></tr>
    </tbody></table>
    ${grille([
      ["Station de Montana", av.station.nom, `b = ${av.station.b} · c = ${av.station.c}`],
      ["Coefficient a(T)", fr(av.a.a, 0), av.a.exact ? `lu directement à ${c.options.T} ans` : av.a.borne ? "hors table : valeur de bord" : "interpolé entre deux périodes"],
      ["Durée injectée", `${fr(av.tEff, 1)} min`, "jamais sous la plus petite durée calée (5 min)"],
      ["Intensité au t<sub>c</sub> le plus court", `${fr(av.intensiteTcCourt, 1)} mm/h`,
       `soit ${fr(av.intensiteTcCourt / av.intensite, 2)} fois celle qu'on retient`],
      ["Intensité sur la plateforme", `${fr(av.intensitePlateforme, 1)} mm/h`,
       `à ${fr(av.dureePlateforme, 0)} min — la plateforme n'a pas le t<sub>c</sub> du bassin`],
    ])}
    <div class="hint">Le rapport de ${fr(av.intensitePlateforme / av.intensite, 1)} entre les
      deux dernières lignes n'est pas une contradiction : c'est la courbe IDF. Même averse,
      même station, même période de retour — mais une fenêtre de ${fr(av.dureePlateforme, 0)}
      minutes au lieu de ${fr(av.tc, 0)}. C'est pourquoi un fossé de plateforme ne se
      dimensionne jamais avec l'intensité du bassin versant.</div>`));

  const d = c.debits;
  out.push(carte(E("debits"), `
    <p>Sept méthodes, et la première chose à faire n'est pas de les calculer : c'est de
       regarder lesquelles ont le droit de s'appliquer ici.</p>
    <table class="resultats"><thead><tr><th>Méthode</th><th>Débit</th><th>Domaine</th></tr></thead>
      <tbody>${d.table.map((m) => `<tr class="${m.applicable ? "" : "ecarte"}">
        <td>${m.nom}</td>
        <td class="q">${m.Q === null ? "—" : `${fr(m.Q, 1)} m³/s`}</td>
        <td class="motif">${m.applicable
          ? `<span style="color:${C.bon}">applicable</span>`
          : m.motifs.join(" · ") || "hors domaine"}</td></tr>`).join("")}
      </tbody></table>
    ${grille([
      ["Méthodes applicables", `${d.retenues.length} sur 7`],
      ["Minimum", `${fr(d.synthese.min, 1)} m³/s`],
      ["Médiane", `${fr(d.synthese.mediane, 1)} m³/s`],
      ["Maximum", `${fr(d.synthese.max, 1)} m³/s`],
      ["Coefficient de variation", `${fr(d.synthese.cv, 0)} %`,
       d.alerteCv ? "au-delà de 50 % : la médiane seule ne suffit plus" : "sous 50 % : dispersion acceptable"],
      ["<strong>Débit de projet retenu</strong>", `<strong>${fr(d.Q, 1)} m³/s</strong>`,
       `${d.regle === "mediane" ? "la médiane" : d.regle === "min" ? "la plus faible" : "la plus forte"}${d.porteuse ? `, portée par ${d.porteuse.nom}` : ""}`],
      ["Débit spécifique", `${fr(d.specifique, 2)} m³/s/km²`, "à confronter à ce qu'on sait de la région"],
    ])}
    ${d.alerteCv ? `<div class="sanity-check"><h3>La dispersion dépasse le seuil : on ne peut plus se contenter d'une médiane</h3>
      <p>Les ${d.retenues.length} méthodes applicables s'étalent de ${fr(d.synthese.min, 1)} à
         ${fr(d.synthese.max, 1)} m³/s, soit un facteur
         ${fr(d.synthese.max / d.synthese.min, 1)}. Le coefficient de variation atteint
         ${fr(d.synthese.cv, 0)} %, au-delà du seuil de 50 % que le chapitre 4 pose comme
         limite de confiance. La médiane reste le meilleur point de départ, mais elle
         <strong>ne correspond plus à un consensus</strong> : elle désigne simplement celle
         du milieu.</p>
      <p>Ce que le projet doit faire, alors, c'est ce que fait la dernière étape de cette
         page : retenir ${fr(d.Q, 1)} m³/s pour le dimensionnement, et <strong>éprouver
         l'ouvrage à ${fr(d.Qexceptionnel, 1)} m³/s</strong>, la plus forte des estimations
         applicables, pour savoir ce qui arrive si c'est elle qui avait raison.</p></div>`
      : `<p class="method-note">La dispersion reste sous le seuil : la médiane se défend seule.</p>`}
    <p class="method-note">La méthode rationnelle est calculée et affichée alors qu'elle est
       hors domaine — ${fr(d.table[0].Q ?? NaN, 1)} m³/s. C'est volontaire : on montre ce
       qu'elle donnerait, puis on l'écarte. Une méthode écartée en silence est une méthode
       qu'un relecteur croira oubliée.</p>`));

  const ou = c.oued;
  out.push(carte(E("oued"), `
    <p>Le chapitre 6 réclame un niveau aval TW. Il ne se devine pas : il sort du levé de
       l'oued et du débit qu'on vient de retenir.</p>
    ${ou.horsLeve ? `<p class="feedback bad">À ${fr(c.debits.Q, 1)} m³/s, le plan d'eau sort
      de la section levée, qui s'arrête à ${fr(ou.capaciteDuLeve, 0)} m³/s. Le calcul
      s'arrête ici — et c'est le levé qu'il faut reprendre, pas la formule.</p>` : `
    ${grille([
      ["Cote du plan d'eau", `${fr(ou.zPlanEau, 3)} m`, `en régime uniforme, pente ${fr(100 * ou.pente, 2)} %`],
      ["<strong>Niveau aval TW</strong>", `<strong>${fr(c.TW, 3)} m</strong>`,
       `au-dessus du radier de sortie, à ${fr(c.calage.zRadierAval, 2)} m`],
      ["Vitesse moyenne", `${fr(ou.etat.vitesse, 2)} m/s`, "c'est elle qui servira de cible à la protection"],
      ["Nombre de Froude", fr(ou.etat.froude, 3), ou.etat.froude < 1 ? "fluvial : l'aval commande" : "torrentiel"],
      ["Cote critique", `${fr(ou.zCritique, 3)} m`, `soit ${fr(ou.zPlanEau - ou.zCritique, 2)} m sous le plan d'eau`],
      ["L'oued déborde-t-il ?", ou.deborde ? "oui, dans le lit majeur" : "non, tout tient dans le lit mineur"],
      ["Capacité du levé", `${fr(ou.capaciteDuLeve, 0)} m³/s`,
       `soit ${fr(ou.capaciteDuLeve / c.debits.Q, 1)} fois le débit de projet`],
      ["Écart du calcul d'un seul bloc", pc(ou.etat.ecartBloc, 0), "les lits séparés ne sont pas un raffinement"],
    ])}`}`));

  const g = c.calage;
  out.push(carte(E("calage"), `
    <p>La pente de l'ouvrage n'est pas une variable de projet. Elle tombe d'une chaîne :
       la largeur de la route fixe la longueur, la longueur et le levé fixent la pente.</p>
    ${grille([
      ["Plateforme", `${fr(g.plateforme, 2)} m`, `chaussée ${fr(c.cas.route.chaussee, 2)} m + 2 accotements de ${fr(c.cas.route.accotement, 2)} m`],
      ["Couverture amont / aval", `${fr(g.couvertureAmont, 2)} / ${fr(g.couvertureAval, 2)} m`,
       "du dessus de l'ouvrage à la chaussée — sans rapport avec la hauteur de remblai"],
      ["Hauteur de remblai", `${fr(c.cas.route.hauteurRemblai, 2)} m`,
       `du terrain naturel à la chaussée : ${fr(c.cas.route.hauteurRemblai - g.couvertureAmont, 2)} m de plus que la couverture`],
      ["<strong>Longueur de l'ouvrage</strong>", `<strong>${fr(g.L, 2)} m</strong>`,
       `dont ${fr(g.L - g.Lentre, 2)} m de têtes, et un allongement de ${pc(g.allongement - 1, 1)} dû au biais de ${c.cas.route.biaisDeg}°`],
      ["Chute entre les deux têtes", `${fr(g.chute, 3)} m`, "c'est le levé qui la donne, pas le projeteur"],
      ["<strong>Pente J</strong>", `<strong>${fr(100 * g.J, 3)} %</strong>`, "= chute / longueur"],
      ["Emprise au sol", `${fr(g.emprise, 1)} m`, "plateforme + les deux talus"],
      ["Cotes des radiers", `${fr(g.zRadierAmont, 2)} → ${fr(g.zRadierAval, 2)} m`],
    ])}
    <div class="hint">Relever la chaussée d'un mètre allongerait l'ouvrage de
      ${fr(2 * c.cas.route.fruitTalus / Math.sin(c.cas.route.biaisDeg * Math.PI / 180), 2)} m —
      c'est 2·m/sin(biais), et rien d'autre. À chute imposée par le terrain, allonger
      l'ouvrage, c'est l'aplatir : la pente tomberait à
      ${fr(100 * g.chute / (g.L + 2 * c.cas.route.fruitTalus / Math.sin(c.cas.route.biaisDeg * Math.PI / 180)), 3)} %.</div>`));

  if (!c.ouvrage) {
    out.push(carte(E("ouvrage"), `<p class="feedback bad">Aucun candidat du catalogue ne
      satisfait les quatre critères à ${fr(c.debits.Q, 1)} m³/s avec une vitesse plafonnée à
      ${fr(c.options.vitesseMax, 1)} m/s. Ce n'est pas une panne de calcul : c'est le
      résultat. Il faut relever le plafond de vitesse — en assumant la protection qui va
      avec — ou changer de type d'ouvrage.</p>`));
    return out;
  }

  const o = c.ouvrage, r = o.r;
  out.push(carte(E("ouvrage"), `
    <p>Le catalogue est énuméré, chaque candidat passe par le moteur du chapitre 6, et les
       quatre critères tranchent. ${o.examines} candidats examinés,
       <strong>${o.admissibles} retenus</strong>.</p>
    ${grille([
      ["<strong>Section retenue</strong>", `<strong>${o.libelle}</strong>`, `${fr(o.largeurTotale, 0)} m de largeur totale`],
      ["Charge amont HW", `${fr(r.HW, 3)} m`, `HW/D = ${fr(r.HWsurD, 2)} · contrôle à l'${r.controle}`],
      ["Cote de la PHE", `${fr(o.zPhe, 2)} m`, `radier amont ${fr(g.zRadierAmont, 2)} m + HW`],
      ["Revanche", `${fr(o.revanche, 2)} m`, `sous la chaussée à ${fr(g.zPlateforme, 2)} m — ${o.verdictRevanche}`],
      ["État de la sortie", r.etatSortie, `TW = ${fr(c.TW, 2)} m pour une hauteur de ${fr(o.D, 2)} m`],
      ["Remplissage", pc(r.remplissage, 0), `tirant normal ${fr(r.profondeurNormale, 2)} m`],
      ["Vitesse", `${fr(r.vitesse, 2)} m/s`, `plafond posé à ${fr(c.options.vitesseMax, 1)} m/s`],
      ["Pente critique I<sub>c</sub>", `${fr(100 * r.penteCritique, 3)} %`,
       `contre J = ${fr(100 * g.J, 3)} % : régime <strong>${r.regime}</strong>`],
      ["Froude dans l'ouvrage", fr(r.froude, 2), `y<sub>n</sub> = ${fr(r.profondeurNormale, 2)} m, y<sub>c</sub> = ${fr(r.profondeurCritique, 2)} m`],
    ])}
    <div class="sanity-check"><h3>C'est la vitesse qui a failli tout refuser</h3>
      <p>Le levé impose J = ${fr(100 * g.J, 3)} %, et la pente critique de la section retenue
         vaut ${fr(100 * r.penteCritique, 3)} %. La première dépasse la seconde de
         ${pc(o.regimeDePente.ecart - 1, 0)} : l'écoulement est <strong>${r.regime}</strong>,
         et la vitesse s'établit à ${fr(r.vitesse, 2)} m/s.</p>
      <p>Avec le plafond usuel de 3 m/s, <strong>aucun</strong> candidat ne passait. Ce
         plafond est une convention de projet, pas une loi : on l'a porté à
         ${fr(c.options.vitesseMax, 1)} m/s, et l'étape suivante en paie le prix en
         enrochement. C'est une décision, elle doit être écrite comme telle — pas un critère
         qu'on assouplit en silence.</p></div>
    <table class="resultats"><thead><tr><th>Règle DGPC §6</th><th>Verdict</th></tr></thead>
      <tbody>${o.dgpc.length ? o.dgpc.map((x) => `<tr><td>${x.regle}</td>
        <td class="motif">${x.texte}</td></tr>`).join("")
        : `<tr><td colspan="2" class="motif">aucune réserve</td></tr>`}</tbody></table>`));

  const pr = c.protection;
  out.push(carte(E("protection"), `
    <p>L'ouvrage rend son eau à ${fr(pr.V0, 2)} m/s dans un lit qui, lui, roule à
       ${fr(pr.Vcible, 2)} m/s. Toute la protection tient dans cet écart.</p>
    ${grille([
      ["Vitesse en sortie", `${fr(pr.V0, 2)} m/s`],
      ["Vitesse de l'oued au même débit", `${fr(pr.Vcible, 2)} m/s`, "le lit vit avec depuis toujours : c'est la cible"],
      ["<strong>Enrochement d₅₀</strong>", `<strong>${fr(100 * pr.d50, 0)} cm</strong>`,
       `Isbash à forte turbulence · bloc de ${fr(pr.masse, 0)} kg`],
      ["Vitesse admissible de ce bloc", `${fr(pr.vitesseDuBloc, 2)} m/s`, "la réciproque d'Isbash : le contrôle boucle"],
      ["<strong>Longueur de protection</strong>", `<strong>${fr(pr.longueur.L, 1)} m</strong>`,
       `1,5 · W₀ · (V₀/V<sub>adm</sub> − 1), avec W₀ = ${fr(c.ouvrage.largeurTotale, 0)} m`],
      ["S'il fallait atteindre un talus nu", `${fr(pr.longueurSiTalusNu.L, 0)} m`,
       "à 0,70 m/s : six fois plus long, pour une cible qui n'est pas celle du site"],
      ["Angle des ailes", `${c.cas.franchissement.angleAiles}°`,
       pr.ailes.ok ? "dans le domaine de l'entrée retenue" : pr.ailes.motif ?? "hors domaine"],
      ["Fossé de plateforme", `${fr(1000 * pr.plateforme.Q, 0)} l/s`,
       `${fr(1e6 * pr.plateforme.S, 0)} m² drainés, à ${fr(c.averse.intensitePlateforme, 0)} mm/h`],
      ["Tirant dans le fossé", pr.fosse.yn != null ? `${fr(pr.fosse.yn, 3)} m` : "—",
       pr.fosse.vitesse != null ? `vitesse ${fr(pr.fosse.vitesse, 2)} m/s` : ""],
    ])}
    <div class="hint">La cible n'est pas une vitesse de catalogue. Les vitesses admissibles
      du chapitre 8 s'appliquent à ce qu'on <em>construit</em> : un talus, un fossé, un
      revêtement neuf. L'oued, lui, a fait son lit et vit avec son transport solide. Ramener
      l'écoulement à la vitesse de l'oued suffit ; viser 0,70 m/s reviendrait à protéger le
      lit contre lui-même, sur ${fr(pr.longueurSiTalusNu.L, 0)} m.</div>`));

  const ct = c.controle;
  const ress = ct.ressauts;
  out.push(carte(E("controle"), `
    <p>Deux vérifications ferment la boucle, et toutes deux repassent par le chapitre 9 :
       où se forme le ressaut, et que devient la route si la plus forte des estimations
       avait raison.</p>
    <h3>Le ressaut, à trois débits</h3>
    <p>On ne le cherche pas qu'au débit de projet : c'est aux crues courantes, quand l'oued
       est bas, que la sortie est la plus dénoyée.</p>
    <table class="resultats"><thead><tr><th>Débit</th><th>TW</th><th>y₁ · Fr₁</th>
      <th>Conjuguée y₂</th><th>Position</th></tr></thead>
      <tbody>${ress.map((x) => `<tr><td>${fr(x.q, 1)} m³/s${Math.abs(x.q - c.debits.Q) < 1e-9 ? " <small>(projet)</small>" : ""}</td>
        <td class="q">${fr(x.tw, 2)} m</td>
        <td class="q">${fr(x.y1, 2)} m · ${fr(x.Fr1, 2)}</td>
        <td class="q">${x.position.possible ? `${fr(x.position.y2, 2)} m` : "—"}</td>
        <td class="motif">${x.position.possible ? x.position.position : "pas de ressaut : la sortie est déjà fluviale"}</td></tr>`).join("")}
      </tbody></table>
    <p class="method-note">${ress.some((x) => x.position.position === "rejeté")
      ? `Au moins un débit place le ressaut au-delà de la protection : c'est le cas qui coûte
         cher, et il commande d'allonger l'enrochement jusqu'à couvrir la longueur du ressaut.`
      : ress.every((x) => x.Fr1 < 1.5)
        ? `Aucun ressaut digne de ce nom. Le Froude en sortie ne dépasse jamais
           ${fr(Math.max(...ress.map((x) => x.Fr1)), 2)} : la conjuguée ne s'écarte du tirant
           que de quelques centimètres, et le niveau aval la couvre à tous les débits essayés.
           <strong>Ce n'est donc pas un ressaut qui commande la protection ici, c'est la
           vitesse</strong> — ${fr(c.ouvrage.r.vitesse, 2)} m/s contre
           ${fr(c.oued.etat.vitesse, 2)} m/s dans le lit. Il fallait le vérifier pour le
           savoir : rien, dans le calcul de l'ouvrage, ne l'annonçait.`
        : `Aucun ressaut rejeté : à tous les débits essayés, la conjuguée reste sous le
           niveau aval, et la dissipation se fait au droit de la sortie ou dans l'ouvrage.`}</p>
    <h3>La crue exceptionnelle</h3>
    <p>La plus forte des méthodes applicables donnait ${fr(c.debits.Qexceptionnel, 1)} m³/s,
       soit ${fr(c.debits.Qexceptionnel / c.debits.Q, 1)} fois le débit retenu. On ne
       dimensionne pas dessus — on regarde ce qu'elle ferait.</p>
    ${ct.horsLeveExceptionnel
      ? `<p class="feedback bad">À ce débit, le plan d'eau sort du levé de l'oued : le
         contrôle ne peut pas être conduit sans retourner sur le terrain.</p>`
      : grille([
      ["Plan d'eau dans l'oued", `${fr(ct.zExc, 2)} m`, `TW porté à ${fr(ct.twExc, 2)} m`],
      ["Débit passant dans l'ouvrage", `${fr(ct.partage.qOuvrage ?? c.debits.Qexceptionnel, 1)} m³/s`],
      ["Débit déversant sur la route", `${fr(ct.partage.qRoute ?? 0, 1)} m³/s`,
       ct.surverse ? `sur ${fr(c.cas.route.longueurDeversante, 0)} m de crête` : "aucun"],
      ["Lame d'eau sur la chaussée", ct.surverse ? `${fr(ct.partage.Hr, 2)} m` : "0",
       ct.surverse ? "la route fonctionne en déversoir" : "la chaussée reste hors d'eau"],
      ["Cote du plan d'eau amont", `${fr(ct.partage.zEau ?? 0, 2)} m`,
       `chaussée à ${fr(g.zPlateforme, 2)} m`],
    ])}
    ${ct.surverse ? `<div class="sanity-check"><h3>À cette crue, la route déverse — et ce n'est pas forcément un défaut</h3>
      <p>Sous ${fr(ct.partage.Hr, 2)} m de lame, la chaussée passe
         ${fr(ct.partage.qRoute, 1)} m³/s, soit ${pc(ct.partage.qRoute / c.debits.Qexceptionnel, 0)}
         du total. Un ouvrage qui passerait seul ${fr(c.debits.Qexceptionnel, 1)} m³/s
         demanderait une section hors de proportion avec le reste du projet.</p>
      <p>Deux réponses possibles, et il faut choisir explicitement : assumer la route
         <strong>submersible</strong> à cette fréquence — ce qui se signale, se protège en
         crête et se porte au dossier — ou bien retenir un débit de projet plus élevé et
         payer l'ouvrage correspondant. Ce qu'on ne peut pas faire, c'est ignorer la
         question parce que la méthode qui la pose était la plus forte des trois.</p></div>` : ""}`));

  return out;
}

// ── Le bilan ───────────────────────────────────────────────────────────────

function bilan(c) {
  const d = c.debits;
  return `
    <p>Une seule page, et trois choses qu'un cours découpé en chapitres ne peut pas montrer.</p>
    <div class="sanity-check"><h3>1 · Une décision prise au chapitre 4 se paie au chapitre 8</h3>
      <p>Le débit retenu, ${fr(d.Q, 1)} m³/s, sort d'un choix entre
         ${d.retenues.length} estimations qui s'étalent sur un facteur
         ${fr(d.synthese.max / d.synthese.min, 1)}. Ce choix fixe le niveau dans l'oued, donc
         le TW, donc la section, donc la vitesse en sortie, donc
         ${c.protection ? `des blocs de ${fr(100 * c.protection.d50, 0)} cm sur ${fr(c.protection.longueur.L, 0)} m` : "la protection"}.
         Prendre la plus faible au lieu de la médiane ne fait pas gagner « un peu de marge » :
         cela change l'ouvrage. Le sélecteur en haut de page le montre en deux clics.</p></div>
    <div class="sanity-check"><h3>2 · Les domaines de validité ne sont pas une formalité</h3>
      <p>Sur sept méthodes, ${7 - d.retenues.length} sont écartées ici, et pour des motifs
         différents : une surface trop grande, une surface trop petite, une zone qui ne
         couvre pas le site, une période de retour absente de la table. Chacune aurait rendu
         un nombre — ${d.table.filter((m) => !m.applicable && m.Q).map((m) => `${m.nom} : ${fr(m.Q, 0)} m³/s`).join(", ") || "aucune ici"}
         — et rien, dans ce nombre, n'aurait signalé qu'il ne fallait pas s'en servir.</p></div>
    <div class="sanity-check"><h3>3 · La géométrie commande l'hydraulique, et non l'inverse</h3>
      <p>La pente de l'ouvrage, ${fr(100 * c.calage.J, 3)} %, n'a été choisie par personne :
         elle tombe de la largeur de la route, du biais, du fruit des talus et de deux cotes
         de terrain naturel. C'est elle qui rend l'écoulement
         ${c.ouvrage ? c.ouvrage.r.regime : "—"}, elle qui fixe la vitesse, elle qui commande
         l'enrochement. Le projeteur qui « choisit une pente de 1 % » choisit en réalité de
         ne pas regarder son levé.</p></div>
    <p class="final-result">Le franchissement de ${c.cas.projet.nom}, au terme de la chaîne :
      <strong>${c.ouvrage ? c.ouvrage.libelle : "aucune section admissible"}</strong>
      ${c.ouvrage ? `sous ${fr(c.cas.route.hauteurRemblai, 2)} m de remblai, calé à
      ${fr(100 * c.calage.J, 3)} % sur ${fr(c.calage.L, 2)} m, biais ${c.cas.route.biaisDeg}°,
      revanche ${fr(c.ouvrage.revanche, 2)} m, protégé sur ${fr(c.protection.longueur.L, 0)} m
      par des blocs de ${fr(100 * c.protection.d50, 0)} cm.` : ""}
      <small><br>Neuf chapitres, ${d.retenues.length + (7 - d.retenues.length)} méthodes examinées,
      ${c.ouvrage ? c.ouvrage.examines : 0} sections essayées — et un seul nombre saisi à la
      main dans tout ce qui précède : la période de retour, quand on force la valeur du
      sélecteur.</small></p>`;
}

// ── Câblage ────────────────────────────────────────────────────────────────

function maj() {
  const t = el("frT").value;
  const options = {
    T: t === "auto" ? null : Number(t),
    regle: el("frRegle").value,
    vitesseMax: parseFloat(el("frVmax").value),
  };
  el("frVmaxVal").textContent = `${fr(options.vitesseMax, 1)} m/s`;

  const c = chaine(CAS, TABLES, options);
  el("frTitre").textContent = `${c.cas.projet.nom} — ${c.cas.projet.route}`;
  el("frSous").textContent = `${c.cas.projet.situation} · PK ${c.cas.projet.pk} · `
    + `bassin de ${fr(c.morpho.S, 2)} km², crue de projet ${fr(c.debits.Q, 1)} m³/s à ${c.periode.T} ans`;
  el("frAvertissement").innerHTML = `<strong>Ce que ce cas est, et ce qu'il n'est pas.</strong>
    ${c.cas.avertissement.map((a) => `<br>· ${a}`).join("")}`;
  el("frAlerte").innerHTML = !c.ouvrage
    ? `<p class="feedback bad">Avec ces trois réglages, aucune section du catalogue ne passe.
       La chaîne s'arrête à l'étape 8 — et le dire est plus utile que de rendre un ouvrage
       qui ne tient pas.</p>`
    : c.debits.alerteCv
      ? `<p class="feedback">Dispersion de ${fr(c.debits.synthese.cv, 0)} % entre les méthodes
         applicables : au-delà du seuil de 50 %, la médiane ne suffit plus à elle seule.
         L'étape 10 éprouve donc l'ouvrage à ${fr(c.debits.Qexceptionnel, 1)} m³/s.</p>`
      : "";
  el("frSynoptique").innerHTML = synoptique(c);
  el("frProfil").innerHTML = profil(c);
  el("frEtapes").innerHTML = etapes(c).join("");
  el("frBilan").innerHTML = bilan(c);
}

for (const id of ["frT", "frRegle"]) el(id).addEventListener("change", maj);
el("frVmax").addEventListener("input", maj);
maj();
