// Chapitre 10 — le jeu FAO 54. Quatre calculateurs et une figure de domaines.
//
// Rien ici n'est recalculé : tout passe par solvers-fao54.js, qui porte les
// tables du bulletin. Les deux exemples chiffrés du manuel servent de valeurs
// par défaut — un étudiant qui ouvre la page voit d'abord un cas dont il peut
// vérifier la réponse dans le livre.
import { abattement, pm10De, ciehToutes, syntheseCieh, kr10Geologie, proposerRegressions,
         orstomKr10, orstomChaine, ordinalDe, rationnelleLocale,
         controlerDomaines, itemsBloquants,
         stationsIdf, paysIdf, intensiteIdf, periodesIdf, A_VERS_MM_PAR_HEURE }
  from "./solvers-fao54.js";
import { chargerFrontieres, projection, fondDeCarte, graticule,
         calqueSurvol, attacherSurvol } from "./carte-fond.js";

const el = (id) => document.getElementById(id);
const num = (id) => parseFloat((el(id)?.value || "").replace(",", "."));
const fr = (x, d = 2) => Number.isFinite(x)
  ? x.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";

const [CIEH, ORSTOM, CHECK, IDF] = await Promise.all(
  ["cieh-fao54", "orstom-fao54", "checklist-fao54", "montana-afrique"]
    .map((f) => fetch(`data/${f}.json`).then((r) => r.json())));
const FRONTIERES = await chargerFrontieres("data/frontieres-afrique.json");

const C = { cieh: "#b45309", orstom: "#0369a1", commun: "#15803d", muet: "#94a3b8",
            cote: "#475569", alerte: "#b91c1c", fond: "#f8fafc" };
const CLASSES = [["PI", "PI — très imperméable"], ["I", "I — imperméable"],
                 ["RI", "RI — relativement imperméable"], ["P", "P — perméable"],
                 ["TP", "TP — très perméable"]];

// ── La rationnelle, et ce qu'elle exige d'être local ───────────────────────

const FENETRE_IDF = { lon0: FRONTIERES.boite[0], lat0: FRONTIERES.boite[1],
                      lon1: FRONTIERES.boite[2], lat1: FRONTIERES.boite[3] };
let zoneIdf = null;

function stationChoisie() {
  return IDF.stations.find((x) => `${x.pays}|${x.station}` === el("faStation").value)
    ?? IDF.stations[0];
}

function carteIdf() {
  const proj = projection(FENETRE_IDF, { largeurMax: 660, hauteurMax: 420,
                                         mg: 34, md: 14, mh: 14, mb: 30 });
  const { px, py, zone } = proj;
  zoneIdf = zone;
  const base = fondDeCarte(FRONTIERES, px, py, zone, FENETRE_IDF, "clipIdf",
                           "Océan Atlantique");
  const sel = stationChoisie();

  const points = IDF.stations.flatMap((st) => st.points
    .filter((pt) => pt.lon != null && pt.lat != null)
    .map((pt) => {
      const retenu = st === sel;
      const x = px(pt.lon).toFixed(1), y = py(pt.lat).toFixed(1);
      const titre = `${st.pays} — ${st.station}${st.est_zone ? ` (zone : ${st.villes_representatives})` : ""}`;
      const forme = st.est_zone
        ? `<rect x="${(x - (retenu ? 5 : 3.2)).toFixed(1)}" y="${(y - (retenu ? 5 : 3.2)).toFixed(1)}"
             width="${retenu ? 10 : 6.4}" height="${retenu ? 10 : 6.4}"`
        : `<circle cx="${x}" cy="${y}" r="${retenu ? 5.5 : 3.4}"`;
      return `${forme} fill="${retenu ? C.alerte : C.orstom}"
        fill-opacity="${retenu ? 1 : 0.78}" stroke="#fff" stroke-width="${retenu ? 1.6 : 0.9}"
        data-lon="${pt.lon}" data-lat="${pt.lat}" data-titre="${titre}"/>`;
    })).join("");

  // fondDeCarte n'étiquette que les voisins : sur la carte de Tunisie, le pays
  // principal est nommé ailleurs. Ici les treize pays du catalogue SONT le sujet
  // — les laisser anonymes pendant que le Soudan est nommé serait à l'envers.
  const dedans = ([lon, lat]) => lon >= FENETRE_IDF.lon0 && lon <= FENETRE_IDF.lon1
    && lat >= FENETRE_IDF.lat0 && lat <= FENETRE_IDF.lat1;
  const nomsPays = FRONTIERES.pays.filter((q) => q.principal).map((q) => {
    const pts = q.anneaux.flat().filter(dedans);
    if (pts.length < 8) return "";
    const lon = pts.reduce((a, r) => a + r[0], 0) / pts.length;
    const lat = pts.reduce((a, r) => a + r[1], 0) / pts.length;
    const x = px(lon), y = py(lat);
    if (x < zone.x0 + 20 || x > zone.x1 - 20 || y < zone.y0 + 12 || y > zone.y1 - 6) return "";
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="9" fill="#5b7688"
      text-anchor="middle" letter-spacing="1.2" stroke="#fff" stroke-width="2.6"
      paint-order="stroke" style="text-transform:uppercase">${q.nom}</text>`;
  }).join("");

  const nomSel = sel.points.find((p) => p.lon != null);
  return `<svg viewBox="0 0 ${proj.largeur.toFixed(0)} ${proj.hauteur.toFixed(0)}"
      width="100%" role="img"
      aria-label="Carte des 87 postes et zones IDF du CIEH en Afrique de l'Ouest et centrale">
    <defs>${base.defs}</defs>
    ${base.fond}
    ${graticule(px, py, zone, [-15, -10, -5, 0, 5, 10, 15, 20], [-5, 0, 5, 10, 15])}
    ${base.reperes}
    <g clip-path="url(#clipIdf)">${nomsPays}</g>
    <g clip-path="url(#clipIdf)">${points}</g>
    ${nomSel ? `<text x="${(px(nomSel.lon) + 9).toFixed(1)}" y="${(py(nomSel.lat) + 4).toFixed(1)}"
      font-size="10.5" font-weight="800" fill="${C.alerte}"
      stroke="#fff" stroke-width="3" paint-order="stroke">${sel.station}</text>` : ""}
    <text x="34" y="11" font-size="10.5" font-weight="800" fill="#075985">
      ${IDF.stations.length} postes et zones du CIEH — ${paysIdf(IDF).length} pays</text>
    ${calqueSurvol("survolIdf")}</svg>
    <p class="diagram-note">Cercle : un poste. Carré : une zone, dont les coefficients valent
       pour plusieurs villes. ${IDF.source_coordonnees}</p>`;
}

function majCarteIdf() {
  el("faCarte").innerHTML = carteIdf();
  attacherSurvol(el("faCarte"), "survolIdf", zoneIdf);
}

function majRationnelle() {
  const st = stationChoisie(), tc = num("faTc"), T = Number(el("faT").value);
  el("faTcVal").textContent = `${fr(tc, 0)} min`;
  const r = intensiteIdf(st, tc, T);

  el("faIdfOut").innerHTML = r.i === null
    ? `<p class="feedback bad">Pas d'intensité à ${fr(tc, 0)} minutes :
       ${r.motif}.</p>`
    : `<div class="data-summary">
        <span><small>Poste retenu</small><strong>${st.station}</strong>
          <small>${st.pays}${st.est_zone ? ` · zone : ${st.villes_representatives}` : ""}</small></span>
        <span><small>Plage de durée</small><strong>${r.plage.libelle}</strong>
          <small>exposant b = ${fr(r.plage.b, 2)}</small></span>
        <span><small>Coefficient a</small><strong>${fr(r.a, 0)}</strong>
          <small>60 × A<sub>T</sub> pour des mm/h</small></span>
        <span><small>Intensité à ${fr(tc, 0)} min</small><strong>${fr(r.i, 1)} mm/h</strong>
          <small>i = a · t<sup>−b</sup></small></span>
        <span class="${r.publie ? "" : "ecarte"}"><small>Statut de A<sub>T</sub></small>
          <strong style="color:${r.publie ? C.commun : C.alerte}">${r.publie ? "publié" : "indicatif"}</strong>
          <small>${r.statut}</small></span>
      </div>
      ${r.incoherence ? `<p class="feedback bad"><strong>Anomalie dans cette plage :</strong>
        ${r.incoherence}</p>` : ""}
      ${r.publie ? "" : `<p class="feedback bad">Cette valeur n'est pas publiée par le CIEH :
        ${r.statut.toLowerCase()}. Elle s'emploie, mais son statut doit suivre jusqu'au
        rapport — seul T = 10 ans est mesuré.</p>`}`;

  const rat = r.i === null ? { Q: null, motif: null }
    : rationnelleLocale({ C: num("faC"), S: num("faS"), i: r.i });
  el("faRatOut").innerHTML = rat.Q === null
    ? `<p class="feedback bad">${rat.motif
        ? `Pas de débit : ${rat.motif}.`
        : `Pas de débit : sans intensité, la rationnelle n'a rien à multiplier. Il faut une `
          + `durée qui tombe dans une plage calée, ou une mesure faite sur place.`}</p>`
    : `<p class="final-result"><strong>Q = ${fr(rat.Q, 1)} m³/s</strong> —
       0,278 × ${fr(num("faC"), 2)} × ${fr(r.i, 1)} × ${fr(num("faS"), 2)}.
       <small><br>Le coefficient C, lui, ne vient d'aucune table : il reste à établir sur le
       bassin et à justifier. Rappel du domaine de la méthode : S &lt; 4 km².</small></p>
       ${num("faS") > 4 ? `<p class="feedback bad">S = ${fr(num("faS"), 2)} km² dépasse
       les 4 km² de la méthode rationnelle : au-delà, l'hypothèse de pluie uniforme sur tout
       le bassin tombe, ici comme en Tunisie.</p>` : ""}`;
}

// ── CIEH : les régressions appliquées, et leur dispersion ──────────────────

function majCieh() {
  const S = num("faCS"), Ig = num("faCIg"), Pan = num("faCPan"), P10 = num("faCP10");
  const Kr10 = num("faCKr"), Dd = num("faCDd");
  const lon = num("faCLon"), pays = el("faCPays").value || null;
  const toutes = el("faCSelection").value === "toutes";
  const A = abattement(Pan, S);
  const Pm10 = pm10De(P10, Pan, S);
  const proposees = proposerRegressions(CIEH, { Pan, lonDeg: Number.isFinite(lon) ? lon : null, pays });
  const autorisees = proposees.filter((x) => x.retenue).map((x) => x.no);
  const motifDe = Object.fromEntries(proposees.map((x) => [x.no, x.motifs]));
  const tous = ciehToutes(CIEH, { S, Ig, Pm10, Kr10, Dd }, toutes ? null : autorisees)
    .map((r) => ({ ...r, horsSite: motifDe[r.reg.no] ?? [] }));
  const ok = tous.filter((r) => r.Q10 > 0);
  const syn = syntheseCieh(ok);
  // Ce que donnerait la négligence : la médiane sur les 48 lignes, sans regarder le site.
  const synTout = syntheseCieh(ciehToutes(CIEH, { S, Ig, Pm10, Kr10, Dd }).filter((r) => r.Q10 > 0));
  const geol = kr10Geologie(CIEH, "granite + gneiss", Pan);

  el("faCiehOut").innerHTML = `
    <div class="data-summary">
      <span><small>Abattement A</small><strong>${fr(A, 3)}</strong>
        <small>équation 1.9 — celle du chapitre 2</small></span>
      <span><small>P<sub>m10</sub> = P<sub>10</sub> · A</small><strong>${fr(Pm10, 1)} mm</strong>
        <small>la pluie ponctuelle ramenée au bassin</small></span>
      <span><small>Régressions retenues</small><strong>${syn.n} sur 48</strong>
        <small>${toutes ? "toutes celles dont les données sont disponibles"
          : `${autorisees.length} autorisées par le site, ${syn.n} calculables`}</small></span>
      <span><small>Médiane retenue</small><strong>${fr(syn.mediane, 1)} m³/s</strong>
        <small>de ${fr(syn.min, 1)} à ${fr(syn.max, 1)} — étendue ×${fr(syn.etendue, 1)}</small></span>
      <span><small>Débit spécifique</small><strong>${fr(syn.mediane / S, 2)} m³/s/km²</strong></span>
      <span><small>K<sub>r10</sub> du tableau 9</small><strong>${geol ? `${fr(geol.valeur, 0)} %` : "—"}</strong>
        <small>granite + gneiss, r = ${geol ? fr(geol.r, 2) : "—"} : corrélation faible</small></span>
    </div>
    <p class="method-note">L'étendue de ×${fr(syn.etendue, 1)} entre la plus faible et la plus
       forte des régressions retenues n'est pas une anomalie : c'est ce que vaut une
       régionalisation. Le manuel demande d'en appliquer plusieurs pour que cette dispersion
       soit visible, au lieu d'être masquée par le choix d'une seule.</p>
    ${toutes ? `<p class="feedback bad">Les 48 lignes sont appliquées, y compris celles calées
       sur d'autres bandes de pluie, d'autres longitudes et d'autres pays. C'est une
       démonstration, pas une méthode.</p>`
      : `<p class="method-note">Appliquer les 48 lignes sans regarder le site donnerait une
       médiane de ${fr(synTout.mediane, 1)} m³/s, soit
       ${fr(Math.abs(100 * (synTout.mediane / syn.mediane - 1)), 0)} % d'écart avec les
       ${syn.n} que ce bassin autorise.</p>`}`;

  const lignes = [...tous].sort((a, b) => (b.Q10 ?? -1) - (a.Q10 ?? -1)).slice(0, 14);
  el("faCiehTable").innerHTML = `<table class="resultats">
    <thead><tr><th>n°</th><th>Découpage</th><th>Variables</th><th>n · r²</th><th>Q₁₀</th></tr></thead>
    <tbody>${lignes.map((r) => `<tr class="${r.Q10 > 0 ? "" : "ecarte"}">
      <td>${r.reg.no}</td>
      <td class="motif">${r.reg.description ?? r.reg.groupe}</td>
      <td class="motif">${r.variables.join(" · ")}</td>
      <td class="q">${r.reg.n ?? "—"} · ${r.reg.r2 !== undefined ? fr(r.reg.r2, 2) : "—"}</td>
      <td class="q">${r.Q10 > 0 ? `<strong>${fr(r.Q10, 1)}</strong> m³/s`
        : `<span class="motif">${r.motif}</span>`}${r.horsSite.length
        ? `<br><small class="motif">${r.horsSite[0]}</small>` : ""}</td></tr>`).join("")}
    </tbody></table>
    <p class="method-note">Les quatorze premières, classées par débit décroissant. Chaque ligne
       porte le nombre de bassins de calage et le coefficient de détermination : une régression
       calée sur 30 bassins avec r² = 0,70 ne vaut pas celle qui en a 116 avec r² = 0,74.</p>`;
}

// ── ORSTOM : la chaîne, ou son refus ──────────────────────────────────────

function majOrstom() {
  const S = num("faOS"), Ig = num("faOIg"), ordinal = num("faOOrd");
  const zone = el("faOZone").value, Pan = num("faOPan"), P10 = num("faOP10");
  const alpha10 = num("faOAlpha"), krSaisi = num("faOKr");
  el("faOSVal").textContent = `${fr(S, 0)} km²`;
  el("faOIgVal").textContent = `${fr(Ig, 0)} m/km`;
  // Un ordinal fractionnaire n'est pas une classe : c'est un mélange, et le dire
  // évite de laisser croire qu'on a « arrondi » le bassin à une catégorie.
  const o = Math.min(4, Math.max(0, ordinal));
  const bas = Math.floor(o + 1e-9), haut = Math.ceil(o - 1e-9);
  el("faOOrdVal").textContent = bas === haut
    ? `${CLASSES[bas][1]}`
    : `ordinal ${fr(o, 1)} — ${fr(100 * (haut - o), 0)} % ${CLASSES[bas][0]} `
      + `+ ${fr(100 * (o - bas), 0)} % ${CLASSES[haut][0]}`;

  const base = { S, Ig, ordinal, zone, Pan, P10, alpha10: Number.isFinite(alpha10) ? alpha10 : undefined };
  const k = orstomKr10(ORSTOM, base);
  const r = orstomChaine(ORSTOM, { ...base, Kr10Saisi: Number.isFinite(krSaisi) ? krSaisi : 0 });

  if (r.motif) {
    el("faOrstomOut").innerHTML = `<p class="feedback bad">${r.motif}</p>
      ${r.refusKr ? `<p class="method-note">C'est le refus attendu, pas une panne. Sous
      10 km² ou pour I<sub>gcor</sub> au-delà de 15 m/km, les équations 3.2 et 3.3 ne sont pas
      valides : il faut lire K<sub>r10</sub> sur les figures 9 et 10 du bulletin et le saisir
      dans le dernier champ.</p>` : ""}`;
    el("faOrstomChaine").innerHTML = "";
    return;
  }

  const etapes = [
    ["Abattement A", fr(r.A, 3), "équation 1.9"],
    ["P<sub>m10</sub>", `${fr(r.Pm10, 1)} mm`, `${fr(P10, 0)} × ${fr(r.A, 3)}`],
    ["K<sub>r10</sub>", `${fr(r.Kr10, 1)} %`, r.sourceKr
      + (k.kr70 ? ` · K<sub>r70</sub> ${fr(k.kr70, 1)} — K<sub>r100</sub> ${fr(k.kr100, 1)}` : "")],
    ["Lame ruisselée L<sub>r10</sub>", `${fr(r.Lr10, 1)} mm`, "P<sub>m10</sub> × K<sub>r10</sub>"],
    ["Volume ruisselé V<sub>r10</sub>", `${fr(r.Vr10 / 1000, 0)} × 10³ m³`, "10³ · P<sub>m10</sub> · K<sub>r10</sub> · S"],
    ["Temps de base T<sub>b10</sub>", `${fr(r.Tb10, 0)} min`, "branches par classe d'I<sub>g</sub>, interpolées"],
    ["Temps de montée T<sub>m10</sub>", `${fr(r.Tm10, 0)} min`, "même famille, autre table"],
    ["Débit moyen Q<sub>m10</sub>", `${fr(r.Qm10, 1)} m³/s`, "16,7 · P<sub>m10</sub> · K<sub>r10</sub> · S / T<sub>b10</sub>"],
    ["Coefficient de pointe α<sub>10</sub>", fr(r.alpha10, 2), "2,6 par défaut · 1,9 pour un réseau en arête de poisson"],
    ["Débit ruisselé Q<sub>r10</sub>", `${fr(r.Qr10, 1)} m³/s`, "α<sub>10</sub> · Q<sub>m10</sub>"],
    ["Écoulement retardé", `${fr(100 * r.ratioRetarde, 1)} %`, "3 % en I, 6 % en P, interpolé sur l'ordinal"],
  ];

  el("faOrstomOut").innerHTML = `
    <p class="final-result"><strong>Q<sub>10</sub> = ${fr(r.Q10, 1)} m³/s</strong>
      — soit ${fr(r.Q10 / S, 2)} m³/s/km².
      <small><br>Volume de crue ${fr(r.Vc10 / 1000, 0)} × 10³ m³, dont
      ${fr(r.Vret10 / 1000, 0)} × 10³ m³ d'écoulement retardé.
      ${r.Q100 ? `Par le Gradex, C = ${fr(r.C100, 2)} et
      <strong>Q<sub>100</sub> = ${fr(r.Q100, 1)} m³/s</strong> — ${r.sourceRatio}.` : ""}</small></p>`;

  el("faOrstomChaine").innerHTML = `<table class="resultats">
    <thead><tr><th>Maillon</th><th>Valeur</th><th>D'où il vient</th></tr></thead>
    <tbody>${etapes.map(([n, v, o], i) => `<tr class="${i === etapes.length - 1 ? "alerte" : ""}">
      <td>${n}</td><td class="q"><strong>${v}</strong></td>
      <td class="motif">${o}</td></tr>`).join("")}</tbody></table>`;
}

// ── Les deux domaines, sur le plan (pluie annuelle, superficie) ────────────

function planDesDomaines(S, Pan) {
  const W = 640, H = 300, MG = 62, MD = 130, MH = 26, MB = 44;
  const dc = CIEH.domaine_application, doo = ORSTOM.domaine_application;
  const xMin = 100, xMax = 1400;                       // pluie annuelle, mm
  const yMin = Math.log10(0.5), yMax = Math.log10(2000);  // superficie, km², log
  const X = (p) => MG + ((p - xMin) / (xMax - xMin)) * (W - MG - MD);
  const Y = (s) => H - MB - ((Math.log10(Math.max(0.5, s)) - yMin) / (yMax - yMin)) * (H - MH - MB);

  const boite = (p0, p1, s0, s1, couleur, opac) =>
    `<rect x="${X(p0).toFixed(1)}" y="${Y(s1).toFixed(1)}"
       width="${(X(p1) - X(p0)).toFixed(1)}" height="${(Y(s0) - Y(s1)).toFixed(1)}"
       fill="${couleur}" opacity="${opac}" stroke="${couleur}" stroke-width="1.4"/>`;

  const grad = [];
  for (let p = 200; p <= 1400; p += 300)
    grad.push(`<text x="${X(p).toFixed(1)}" y="${H - MB + 14}" font-size="9" fill="${C.muet}"
      text-anchor="middle">${p}</text>`);
  const grads = [];
  for (const s of [1, 10, 100, 1000])
    grads.push(`<line x1="${MG}" y1="${Y(s).toFixed(1)}" x2="${W - MD}" y2="${Y(s).toFixed(1)}"
        stroke="#eef2f7"/><text x="${MG - 5}" y="${(Y(s) + 3).toFixed(1)}" font-size="9"
        fill="${C.muet}" text-anchor="end">${s}</text>`);

  const dansCieh = Pan >= dc.pan_min_mm && Pan <= dc.pan_max_mm && S <= dc.s_max_km2;
  const dansOrstom = Pan >= doo.pan_min_mm && Pan <= doo.pan_max_mm && S <= doo.s_max_km2;

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img"
      aria-label="Domaines d'application comparés des méthodes ORSTOM et CIEH">
    <rect x="${MG}" y="${MH}" width="${W - MG - MD}" height="${H - MH - MB}" fill="${C.fond}"/>
    ${grads.join("")}
    ${boite(doo.pan_min_mm, doo.pan_max_mm, 0.5, doo.s_max_km2, C.orstom, 0.14)}
    ${boite(dc.pan_min_mm, dc.pan_max_mm, 0.5, dc.s_max_km2, C.cieh, 0.16)}
    ${boite(dc.pan_min_mm, dc.pan_max_mm, dc.s_calage_min_km2, dc.s_calage_max_km2, C.cieh, 0.3)}
    <line x1="${X(850).toFixed(1)}" y1="${MH}" x2="${X(850).toFixed(1)}" y2="${H - MB}"
      stroke="${C.cote}" stroke-width="1.4" stroke-dasharray="5 3"/>
    <text x="${(X(850) + 4).toFixed(1)}" y="${MH + 10}" font-size="8.5" fill="${C.cote}">850 mm —
      sahélien / tropical</text>
    <circle cx="${X(Pan).toFixed(1)}" cy="${Y(S).toFixed(1)}" r="5.5" fill="${C.alerte}"/>
    <text x="${(X(Pan) + 9).toFixed(1)}" y="${(Y(S) + 4).toFixed(1)}" font-size="9.5"
      font-weight="800" fill="${C.alerte}">le bassin</text>
    <text x="${W - MD + 8}" y="${MH + 12}" font-size="9.5" font-weight="800" fill="${C.orstom}">ORSTOM</text>
    <text x="${W - MD + 8}" y="${MH + 25}" font-size="8.5" fill="${C.cote}">${doo.pan_min_mm}–${doo.pan_max_mm} mm</text>
    <text x="${W - MD + 8}" y="${MH + 36}" font-size="8.5" fill="${C.cote}">S ≤ ${doo.s_max_km2} km²</text>
    <text x="${W - MD + 8}" y="${MH + 47}" font-size="8.5" fill="${dansOrstom ? C.commun : C.alerte}"
      font-weight="700">${dansOrstom ? "bassin dedans" : "bassin dehors"}</text>
    <text x="${W - MD + 8}" y="${MH + 68}" font-size="9.5" font-weight="800" fill="${C.cieh}">CIEH</text>
    <text x="${W - MD + 8}" y="${MH + 81}" font-size="8.5" fill="${C.cote}">${dc.pan_min_mm}–${dc.pan_max_mm} mm</text>
    <text x="${W - MD + 8}" y="${MH + 92}" font-size="8.5" fill="${C.cote}">S ≤ ${dc.s_max_km2} km²</text>
    <text x="${W - MD + 8}" y="${MH + 103}" font-size="8.5" fill="${C.cote}">calage ${dc.s_calage_min_km2}–${dc.s_calage_max_km2}</text>
    <text x="${W - MD + 8}" y="${MH + 114}" font-size="8.5" fill="${dansCieh ? C.commun : C.alerte}"
      font-weight="700">${dansCieh ? "bassin dedans" : "bassin dehors"}</text>
    ${grad.join("")}
    <text x="${((MG + W - MD) / 2).toFixed(0)}" y="${H - 6}" font-size="9" fill="${C.cote}"
      text-anchor="middle">pluie annuelle moyenne (mm)</text>
    <text x="14" y="${((MH + H - MB) / 2).toFixed(0)}" font-size="9" fill="${C.cote}"
      text-anchor="middle" transform="rotate(-90 14 ${((MH + H - MB) / 2).toFixed(0)})">superficie (km², échelle log)</text>
    <text x="${MG}" y="14" font-size="10.5" font-weight="800" fill="#075985">
      Où chaque méthode a le droit de s'appliquer</text>
  </svg>`;
}

function majDomaines() {
  const S = num("faOS"), Pan = num("faOPan");
  const av = controlerDomaines({ cieh: CIEH, orstom: ORSTOM },
    { S, Pan, zone: el("faOZone").value });
  el("faDomaines").innerHTML = planDesDomaines(S, Pan)
    + (av.length
      ? `<table class="resultats"><thead><tr><th>Méthode</th><th>Avertissement</th></tr></thead>
         <tbody>${av.map((x) => `<tr><td>${x.methode}</td>
           <td class="motif">${x.texte}</td></tr>`).join("")}</tbody></table>`
      : `<p class="feedback good">Le bassin est dans le domaine des deux méthodes.</p>`);
}

// ── La check-list, telle qu'elle est : à lire, pas à appliquer ─────────────

function majChecklist() {
  const zone = el("faOZone").value;
  const z = CHECK.zones[zone === "tropical" ? 1 : 0];
  const bloquants = itemsBloquants(CHECK, zone);
  const avecCorrections = z.items.filter((it) => it.corrections?.length);
  el("faChecklist").innerHTML = `
    <div class="data-summary">
      <span><small>Questions en zone ${zone === "tropical" ? "tropicale" : "sahélienne"}</small>
        <strong>${z.items.length}</strong><small>annexe 1, pages 215 à 233</small></span>
      <span><small>Portant une correction chiffrée</small><strong>${avecCorrections.length}</strong>
        <small>les autres orientent vers une méthode</small></span>
      <span><small>Items bloquants</small><strong>${bloquants.length}</strong>
        <small>${bloquants.map((b) => b.code).join(", ")} — la frange littorale</small></span>
    </div>
    <table class="resultats"><thead><tr><th>Item</th><th>Ce que le bassin présente</th>
      <th>Ce que cela déplace</th></tr></thead>
      <tbody>${avecCorrections.slice(0, 6).map((it) => `<tr>
        <td>${it.code}</td><td class="motif">${it.titre}</td>
        <td class="motif">${it.corrections.map((c) => c.libelle ?? c.parametre).join(" · ")}</td>
      </tr>`).join("")}
      <tr class="alerte"><td>${bloquants[0]?.code ?? "1a"}</td>
        <td class="motif">${bloquants[0]?.titre ?? ""}</td>
        <td class="motif"><strong>les deux méthodes ne s'appliquent pas</strong></td></tr>
      </tbody></table>
    <p class="method-note">Six items sur ${avecCorrections.length}, à titre d'exemple. Aucun
       n'est coché ici, et c'est le comportement voulu : l'effet par défaut de la check-list
       est neutre, et chaque correction retenue doit être justifiée par une observation de
       terrain, puis tracée dans le rapport. Une réduction de 55 % qui disparaîtrait du
       dossier serait pire qu'une erreur de calcul.</p>`;
}

// ── Câblage ────────────────────────────────────────────────────────────────

function maj() {
  majCarteIdf();
  majRationnelle();
  majCieh();
  majOrstom();
  majDomaines();
  majChecklist();
}

function remplirStations() {
  const pays = el("faPays").value;
  const liste = stationsIdf(IDF, pays || null);
  el("faStation").innerHTML = liste.map((st) =>
    `<option value="${st.pays}|${st.station}">${st.station}${st.est_zone ? " (zone)" : ""}</option>`).join("");
}
function remplirPeriodes() {
  const avant = el("faT").value;
  const ts = periodesIdf(stationChoisie());
  el("faT").innerHTML = ts.map((t) =>
    `<option value="${t}"${String(t) === avant ? " selected" : ""}>${t} ans</option>`).join("");
  if (!ts.map(String).includes(avant)) el("faT").value = String(ts.includes(10) ? 10 : ts[0]);
}
el("faPays").innerHTML = `<option value="">tous les pays</option>`
  + paysIdf(IDF).map((p) => `<option value="${p}"${p === "Burkina Faso" ? " selected" : ""}>${p}</option>`).join("");
remplirStations();
remplirPeriodes();
el("faPays").addEventListener("change", () => {
  remplirStations(); remplirPeriodes(); majCarteIdf(); majRationnelle();
});
el("faStation").addEventListener("change", () => {
  remplirPeriodes(); majCarteIdf(); majRationnelle();
});
el("faT").addEventListener("change", majRationnelle);
for (const id of ["faS", "faC", "faTc"]) el(id).addEventListener("input", majRationnelle);
const PAYS = [...new Set(CIEH.criteres_selection.groupes.flatMap((g) => g.pays ?? []))].sort();
el("faCPays").innerHTML = `<option value="">aucun découpage par pays</option>`
  + PAYS.map((p) => `<option value="${p}">${p}</option>`).join("");
for (const id of ["faCS", "faCIg", "faCPan", "faCP10", "faCKr", "faCDd", "faCLon"])
  el(id).addEventListener("input", majCieh);
for (const id of ["faCPays", "faCSelection"]) el(id).addEventListener("change", majCieh);
for (const id of ["faOS", "faOIg", "faOOrd", "faOPan", "faOP10", "faOAlpha", "faOKr"])
  el(id).addEventListener("input", () => { majOrstom(); majDomaines(); });
el("faOZone").addEventListener("change", () => { majOrstom(); majDomaines(); majChecklist(); });
maj();
