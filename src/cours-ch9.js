// Chapitre 9 — hydraulique du lit naturel.
//
// Trois figures, et une seule idée qui les relie : le niveau d'eau dans l'oued
// n'est pas une donnée, c'est un calcul. Le chapitre 6 demandait TW sans dire
// d'où il vient ; il vient d'ici.
import { sectionNaturelle, debitA, tirantNormal, coteCritique, courbeTarage,
         remous, positionRessaut, STRICKLER, kDe, G } from "./solvers-riviere.js";

const el = (id) => document.getElementById(id);
const num = (id) => parseFloat((el(id).value || "").replace(",", "."));
const fr = (x, d) => Number.isFinite(x)
  ? x.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";

const OUED = await fetch("data/oued-demo.json").then((r) => r.json());

// Les deux rugosités sont réglables : c'est la seule donnée du calcul qui ne se
// mesure pas, et le chapitre montre ce qu'elle coûte.
function construireSection() {
  const choisi = (id, defaut) => (el(id)?.value || defaut);
  const kMineur = choisi("rvKMineur", OUED.sousSections[1].strickler);
  const kMajeur = choisi("rvKMajeur", OUED.sousSections[0].strickler);
  return sectionNaturelle(OUED.points, OUED.sousSections.map((s, i) =>
    ({ ...s, strickler: i === 1 ? kMineur : kMajeur })));
}
let SECTION = construireSection();

const C = {
  terrain: "#d6d3d1", terrainTrait: "#78716c", eau: "#7dd3fc", eauTrait: "#0369a1",
  mineur: "#0284c7", majeur: "#65a30d", cote: "#475569", muet: "#94a3b8",
  alerte: "#b91c1c", repere: "#b45309",
};
const TEINTE_LIT = ["#bae6fd", "#7dd3fc", "#bae6fd"];   // débordement plus clair que le lit mineur

// ── Figure 1 : la section, ses lits, et les deux façons de compter ─────────

function panneauSection(z) {
  const W = 620, H = 300, MG = 52, MD = 16, MH = 24, MB = 40;
  const x0 = SECTION.xMin, x1 = SECTION.xMax;
  const zBas = SECTION.zMin - 0.35, zHaut = SECTION.zMax + 0.35;
  const kx = (W - MG - MD) / (x1 - x0), ky = (H - MH - MB) / (zHaut - zBas);
  const X = (x) => MG + (x - x0) * kx, Y = (v) => H - MB - (v - zBas) * ky;

  const sol = SECTION.points.map((p, i) =>
    `${i ? "L" : "M"}${X(p.x).toFixed(1)},${Y(p.z).toFixed(1)}`).join("");
  const terrain = `<path d="${sol}L${X(x1).toFixed(1)},${(H - MB).toFixed(1)}
    L${X(x0).toFixed(1)},${(H - MB).toFixed(1)}Z" fill="${C.terrain}" stroke="${C.terrainTrait}"
    stroke-width="1.3" stroke-linejoin="round"/>`;

  // L'eau : on remplit entre le plan d'eau et le fond, lit par lit.
  const eaux = OUED.sousSections.map((s, k) => {
    const pas = [];
    for (let x = s.x0; x <= s.x1 + 1e-9; x += (s.x1 - s.x0) / 120) pas.push(x);
    const dessus = pas.map((x, i) => `${i ? "L" : "M"}${X(x).toFixed(1)},${Y(z).toFixed(1)}`).join("");
    const dessous = [...pas].reverse().map((x) => {
      const zf = SECTION.points.reduce((a, p, i, t) => {
        if (i === 0) return a;
        if (x <= t[i].x && x >= t[i - 1].x) {
          const u = (x - t[i - 1].x) / (t[i].x - t[i - 1].x || 1);
          return t[i - 1].z + u * (t[i].z - t[i - 1].z);
        }
        return a;
      }, SECTION.points[0].z);
      return `L${X(x).toFixed(1)},${Y(Math.max(Math.min(zf, z), zf)).toFixed(1)}`;
    }).join("");
    return `<path d="${dessus}${dessous}Z" fill="${TEINTE_LIT[k]}" opacity=".75"
      clip-path="url(#rvHorsSol)"/>`;
  }).join("");

  const separations = OUED.sousSections.slice(1).map((s) =>
    `<line x1="${X(s.x0).toFixed(1)}" y1="${Y(zHaut).toFixed(1)}" x2="${X(s.x0).toFixed(1)}"
       y2="${(H - MB).toFixed(1)}" stroke="${C.cote}" stroke-width="0.9" stroke-dasharray="4 3"/>`).join("");

  const graduations = [];
  const pasX = 25 * Math.max(1, Math.round((x1 - x0) / 100));
  for (let x = Math.ceil(x0 / pasX) * pasX; x <= x1; x += pasX)
    graduations.push(`<text x="${X(x).toFixed(1)}" y="${H - MB + 14}" font-size="9" fill="${C.muet}"
      text-anchor="middle">${x} m</text>`);
  const niveaux = [];
  for (let v = Math.ceil(zBas); v <= zHaut; v += 1)
    niveaux.push(`<line x1="${MG}" y1="${Y(v).toFixed(1)}" x2="${W - MD}" y2="${Y(v).toFixed(1)}"
        stroke="#eef2f7" stroke-width="1"/>
      <text x="${MG - 5}" y="${(Y(v) + 3).toFixed(1)}" font-size="9" fill="${C.muet}"
        text-anchor="end">${v}</text>`);

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img"
      aria-label="Section en travers de l'oued, ses trois lits et le plan d'eau">
    <defs><clipPath id="rvHorsSol"><path d="${sol}L${X(x1).toFixed(1)},${Y(zHaut).toFixed(1)}
      L${X(x0).toFixed(1)},${Y(zHaut).toFixed(1)}Z"/></clipPath>
      <clipPath id="rvCadreSection"><rect x="${MG}" y="${MH}" width="${W - MG - MD}"
        height="${H - MH - MB}"/></clipPath></defs>
    ${niveaux.join("")}
    <g clip-path="url(#rvCadreSection)">
      ${terrain}
      ${eaux}
      ${separations}
      <line x1="${MG}" y1="${Y(z).toFixed(1)}" x2="${W - MD}" y2="${Y(z).toFixed(1)}"
        stroke="${C.eauTrait}" stroke-width="2"/>
    </g>
    ${graduations.join("")}
    <text x="${MG}" y="14" font-size="10.5" font-weight="800" fill="#075985">
      Section en travers — plan d'eau à ${fr(z, 2)} m</text>
    <text x="${X(-35).toFixed(1)}" y="${MH + 10}" font-size="9" fill="${C.cote}"
      text-anchor="middle">lit majeur</text>
    <text x="${X(0).toFixed(1)}" y="${MH + 10}" font-size="9" fill="${C.cote}"
      text-anchor="middle">lit mineur</text>
    <text x="${X(35).toFixed(1)}" y="${MH + 10}" font-size="9" fill="${C.cote}"
      text-anchor="middle">lit majeur</text>
  </svg>`;
}

// ── Figure 2 : la courbe de tarage, et le TW qu'elle produit ───────────────

const DEBITS = [5, 10, 20, 35, 50, 70, 90, 110, 130, 150, 160, 170];
let TARAGE = courbeTarage(SECTION, OUED.pente, DEBITS).filter((p) => p.z !== null);

function panneauTarage(z, Q) {
  const W = 620, H = 300, MG = 56, MD = 70, MH = 24, MB = 40;
  const qMax = Math.max(...TARAGE.map((p) => p.Q)) * 1.05;
  const zBas = SECTION.zMin - 0.15, zHaut = SECTION.zMax + 0.35;
  const X = (q) => MG + (q / qMax) * (W - MG - MD);
  const Y = (v) => H - MB - ((v - zBas) / (zHaut - zBas)) * (H - MH - MB);

  const trait = `<path d="${TARAGE.map((p, i) =>
    `${i ? "L" : "M"}${X(p.Q).toFixed(1)},${Y(p.z).toFixed(1)}`).join("")}"
    fill="none" stroke="${C.eauTrait}" stroke-width="2.2"/>`;
  const points = TARAGE.map((p) =>
    `<circle cx="${X(p.Q).toFixed(1)}" cy="${Y(p.z).toFixed(1)}" r="2.6" fill="${C.eauTrait}"/>`).join("");
  // La cote des berges : au-dessus, l'oued déborde et le lit majeur entre en jeu.
  const zBerge = Math.min(OUED.berges.gauche, OUED.berges.droite);
  const debordement = `<line x1="${MG}" y1="${Y(zBerge).toFixed(1)}" x2="${W - MD}"
      y2="${Y(zBerge).toFixed(1)}" stroke="${C.alerte}" stroke-width="1.2" stroke-dasharray="5 3"/>
    <text x="${W - MD - 4}" y="${(Y(zBerge) - 4).toFixed(1)}" font-size="9" fill="${C.alerte}"
      text-anchor="end">débordement — le lit majeur entre en jeu</text>`;

  const grQ = [];
  for (let q = 0; q <= qMax; q += 50)
    grQ.push(`<line x1="${X(q).toFixed(1)}" y1="${MH}" x2="${X(q).toFixed(1)}" y2="${H - MB}"
        stroke="#eef2f7" stroke-width="1"/>
      <text x="${X(q).toFixed(1)}" y="${H - MB + 14}" font-size="9" fill="${C.muet}"
        text-anchor="middle">${q}</text>`);
  const grZ = [];
  for (let v = Math.ceil(zBas); v <= zHaut; v += 1)
    grZ.push(`<line x1="${MG}" y1="${Y(v).toFixed(1)}" x2="${W - MD}" y2="${Y(v).toFixed(1)}"
        stroke="#eef2f7" stroke-width="1"/>
      <text x="${MG - 5}" y="${(Y(v) + 3).toFixed(1)}" font-size="9" fill="${C.muet}"
        text-anchor="end">${v}</text>`);

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img"
      aria-label="Courbe de tarage de l'oued : la cote du plan d'eau en fonction du débit">
    ${grZ.join("")}${grQ.join("")}${debordement}${trait}${points}
    <line x1="${X(Q).toFixed(1)}" y1="${MH}" x2="${X(Q).toFixed(1)}" y2="${Y(z).toFixed(1)}"
      stroke="${C.repere}" stroke-width="1.2" stroke-dasharray="3 2"/>
    <line x1="${MG}" y1="${Y(z).toFixed(1)}" x2="${X(Q).toFixed(1)}" y2="${Y(z).toFixed(1)}"
      stroke="${C.repere}" stroke-width="1.2" stroke-dasharray="3 2"/>
    <circle cx="${X(Q).toFixed(1)}" cy="${Y(z).toFixed(1)}" r="5" fill="${C.repere}"/>
    <text x="${(X(Q) + 8).toFixed(1)}" y="${(Y(z) - 7).toFixed(1)}" font-size="10"
      font-weight="800" fill="${C.repere}">${fr(Q, 0)} m³/s → ${fr(z, 2)} m</text>
    <line x1="${MG}" y1="${H - MB}" x2="${W - MD}" y2="${H - MB}" stroke="${C.muet}" stroke-width="1"/>
    <text x="${MG}" y="14" font-size="10.5" font-weight="800" fill="#075985">
      Courbe de tarage — cote du plan d'eau (m) contre débit (m³/s)</text>
    <text x="${((MG + W - MD) / 2).toFixed(0)}" y="${H - 6}" font-size="9" fill="${C.cote}"
      text-anchor="middle">débit (m³/s)</text>
  </svg>`;
}

function tableauLits(d) {
  const zBerge = Math.min(OUED.berges.gauche, OUED.berges.droite);
  el("rvLits").innerHTML = `<table class="resultats">
    <thead><tr><th>Lit</th><th>K</th><th>A (m²)</th><th>P (m)</th><th>R (m)</th><th>Q (m³/s)</th></tr></thead>
    <tbody>${d.lits.map((l) => `<tr class="${l.aire > 0.01 ? "" : "ecarte"}">
      <td>${l.nom}</td><td class="q">${l.K}</td>
      <td class="q">${l.aire > 0.01 ? fr(l.aire, 1) : "—"}</td>
      <td class="q">${l.aire > 0.01 ? fr(l.perimetre, 1) : "—"}</td>
      <td class="q">${l.aire > 0.01 ? fr(l.R, 2) : "—"}</td>
      <td class="q">${l.aire > 0.01 ? fr(l.Q, 1) : "sec"}</td></tr>`).join("")}
      <tr class="alerte"><td><strong>Total, lits séparés</strong></td><td></td>
        <td class="q">${fr(d.aire, 1)}</td><td class="q">${fr(d.perimetre, 1)}</td>
        <td class="q">—</td>
        <td class="q"><strong>${fr(d.Q, 1)}</strong></td></tr>
      <tr><td class="motif">Le même calcul d'un seul bloc</td><td colspan="4" class="motif">
        Strickler pondéré ${fr(d.lits.reduce((a, l) => a + l.K * l.perimetre, 0) / d.perimetre, 1)},
        rayon hydraulique d'ensemble ${fr(d.aire / d.perimetre, 2)} m — contre
        ${fr(d.lits.find((l) => l.nom.includes("mineur")).R, 2)} m pour le seul lit mineur</td>
        <td class="q" style="color:${Math.abs(d.ecartBloc) > 0.02 ? "#b91c1c" : "inherit"}">
          ${fr(d.Qbloc, 1)}</td></tr>
    </tbody></table>
    ${Math.abs(d.ecartBloc) > 0.02 ? `<p class="feedback bad">Le bloc unique se trompe de
      ${fr(Math.abs(d.ecartBloc) * 100, 0)} % ${d.ecartBloc < 0 ? "par défaut" : "par excès"} —
      le lit majeur ajoute beaucoup de périmètre mouillé et très peu de section.</p>`
      : `<p class="feedback good">Sous la cote des berges, seul le lit mineur coule : les deux
      calculs coïncident. Le désaccord commence au débordement.</p>`}`;
}

// ── Figure 3 : le remous à l'amont de l'ouvrage ────────────────────────────

function panneauRemous(Q, exhaussement) {
  const W = 620, H = 260, MG = 62, MD = 74, MH = 24, MB = 38;
  const hn = (tirantNormal(SECTION, Q, OUED.pente) ?? SECTION.zMin) - SECTION.zMin;
  const m = remous(SECTION, { Q, J: OUED.pente, hAval: hn + exhaussement,
                              pas: 20, longueur: 6000 });
  if (!m) return `<p class="feedback bad">Pas de ligne d'eau calculable avec ces valeurs.</p>`;
  const xMax = Math.max(m.portee * 1.15, 400);
  const zBas = -0.4, zHaut = m.points[0].z + 0.6;
  const X = (x) => MG + (x / xMax) * (W - MG - MD);
  const Y = (v) => H - MB - ((v - zBas) / (zHaut - zBas)) * (H - MH - MB);

  const fond = `<path d="M${X(0).toFixed(1)},${Y(0).toFixed(1)}
    L${X(xMax).toFixed(1)},${Y(OUED.pente * xMax).toFixed(1)}
    L${X(xMax).toFixed(1)},${(H - MB).toFixed(1)} L${X(0).toFixed(1)},${(H - MB).toFixed(1)}Z"
    fill="${C.terrain}" stroke="${C.terrainTrait}" stroke-width="1.2"/>`;
  const normale = `<path d="M${X(0).toFixed(1)},${Y(hn).toFixed(1)}
    L${X(xMax).toFixed(1)},${Y(OUED.pente * xMax + hn).toFixed(1)}"
    fill="none" stroke="${C.muet}" stroke-width="1.4" stroke-dasharray="6 3"/>`;
  // Au-delà de la portée calculée, la ligne d'eau EST le tirant normal : on la
  // prolonge jusqu'au bord, sinon la figure donne à croire que l'oued s'arrête.
  const surface = m.points.map((p) => [p.x, p.z]);
  if (m.portee < xMax) surface.push([xMax, OUED.pente * xMax + hn]);
  const trace = surface.map(([x, z], i) =>
    `${i ? "L" : "M"}${X(x).toFixed(1)},${Y(z).toFixed(1)}`).join("");
  const ligne = `<path d="${trace}" fill="none" stroke="${C.eauTrait}" stroke-width="2.2"/>`;
  const remplissage = `<path d="${trace}
    L${X(xMax).toFixed(1)},${Y(OUED.pente * xMax).toFixed(1)}
    L${X(0).toFixed(1)},${Y(0).toFixed(1)}Z" fill="${C.eau}" opacity=".45"/>`;

  const grad = [];
  for (let x = 0; x <= xMax; x += Math.max(250, Math.round(xMax / 6 / 250) * 250))
    grad.push(`<line x1="${X(x).toFixed(1)}" y1="${H - MB}" x2="${X(x).toFixed(1)}"
        y2="${H - MB + 4}" stroke="${C.muet}"/>
      <text x="${X(x).toFixed(1)}" y="${H - MB + 14}" font-size="9" fill="${C.muet}"
        text-anchor="middle">${x} m</text>`);

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img"
      aria-label="Ligne d'eau à l'amont de l'ouvrage : l'exhaussement décroît et rejoint le tirant normal">
    <defs><marker id="rvFleche" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="5"
      markerHeight="5" orient="auto"><path d="M0,0L8,4L0,8Z" fill="${C.eauTrait}"/></marker></defs>
    ${fond}${remplissage}${normale}${ligne}
    <line x1="${X(0).toFixed(1)}" y1="${Y(0).toFixed(1)}" x2="${X(0).toFixed(1)}"
      y2="${Y(zHaut).toFixed(1)}" stroke="${C.repere}" stroke-width="2.4"/>
    <text x="${(X(0) + 5).toFixed(1)}" y="${(Y(zHaut) + 10).toFixed(1)}" font-size="9.5"
      font-weight="800" fill="${C.repere}">l'ouvrage</text>
    <line x1="${X(m.portee).toFixed(1)}" y1="${MH}" x2="${X(m.portee).toFixed(1)}"
      y2="${H - MB}" stroke="${C.alerte}" stroke-width="1.2" stroke-dasharray="4 3"/>
    <text x="${(X(m.portee) + 5).toFixed(1)}" y="${MH + 11}" font-size="9.5" font-weight="800"
      fill="${C.alerte}">${m.rejointNormal ? `le remous s'éteint à ${fr(m.portee, 0)} m`
        : `au-delà de ${fr(m.portee, 0)} m, encore relevé`}</text>
    <line x1="${(X(0) + 16).toFixed(1)}" y1="${Y(hn).toFixed(1)}" x2="${(X(0) + 16).toFixed(1)}"
      y2="${Y(m.points[0].z).toFixed(1)}" stroke="${C.eauTrait}" stroke-width="1.2"
      marker-start="url(#rvFleche)" marker-end="url(#rvFleche)"/>
    <text x="${(X(0) + 21).toFixed(1)}" y="${((Y(hn) + Y(m.points[0].z)) / 2 + 3.5).toFixed(1)}"
      font-size="9.5" font-weight="700" fill="${C.eauTrait}">+ ${fr(m.exhaussement, 2)} m</text>
    <text x="${X(xMax * 0.42).toFixed(1)}" y="${(Y(OUED.pente * xMax * 0.42 + hn) + 13).toFixed(1)}"
      font-size="9" fill="${C.muet}">tirant normal — sans l'ouvrage</text>
    <text x="${MG}" y="14" font-size="10.5" font-weight="800" fill="#075985">
      Ligne d'eau à l'amont — ${fr(Q, 0)} m³/s, pente ${fr(OUED.pente * 100, 2)} %</text>
    <text x="${W - MD}" y="14" font-size="8.5" fill="${C.muet}" text-anchor="end">hauteurs
      exagérées ${fr(((W - MG - MD) / xMax) === 0 ? 0
        : ((H - MH - MB) / (zHaut - zBas)) / ((W - MG - MD) / xMax), 0)} fois</text>
    <line x1="${(MG - 8).toFixed(1)}" y1="${Y(0).toFixed(1)}" x2="${(MG - 8).toFixed(1)}"
      y2="${Y(1).toFixed(1)}" stroke="${C.cote}" stroke-width="1.6"/>
    <text x="${(MG - 11).toFixed(1)}" y="${((Y(0) + Y(1)) / 2 + 3).toFixed(1)}" font-size="9"
      fill="${C.cote}" text-anchor="end">1 m</text>
    ${grad.join("")}
    <text x="${((MG + W - MD) / 2).toFixed(0)}" y="${H - 6}" font-size="9" fill="${C.cote}"
      text-anchor="middle">distance à l'amont de l'ouvrage</text>
  </svg>`;
}

// ── Figure 4 : le ressaut à la sortie ──────────────────────────────────────

function panneauRessaut(y1, Fr1, hAval) {
  const W = 620, H = 230, MG = 46, MD = 82, MH = 30, MB = 42;
  const r = positionRessaut(y1, Fr1, hAval);
  if (!r?.possible)
    return `<p class="feedback good">${r?.motif || "Pas de ressaut : l'écoulement sort déjà fluvial."}</p>`;
  const L = r.longueur;
  const V1 = Fr1 * Math.sqrt(G * y1);          // ce que le curseur demande vraiment

  // La protection est dimensionnée pour un ressaut qui se forme au droit de la
  // sortie : elle couvre sa longueur, à partir de la sortie. Si le ressaut est
  // rejeté, il finit au-delà — c'est tout l'intérêt de la figure.
  const xProtection = L;
  // Décalage vers l'aval, schématique : on n'a pas calculé la courbe M3.
  const decalage = r.position === "rejeté"
    ? L * 1.15 * Math.min(1, (r.y2 - hAval) / r.y2 * 3) : 0;
  const xDebut = r.position === "noyé" ? 0 : decalage;
  const xMax = Math.max(xDebut + L * 1.6, xProtection * 1.8, 6);
  const yMax = Math.max(r.y2, hAval) * 1.55;
  const X = (x) => MG + (x / xMax) * (W - MG - MD);
  const Y = (y) => H - MB - (y / yMax) * (H - MH - MB);

  const hauteur = (x) => {
    if (x <= xDebut) return y1;
    if (x >= xDebut + L) return r.y2;
    const u = (x - xDebut) / L;
    return y1 + (r.y2 - y1) * (0.5 - 0.5 * Math.cos(Math.PI * u));
  };
  const surface = [];
  for (let k = 0; k <= 72; k++) {
    const x = (k / 72) * xMax;
    surface.push(`${k ? "L" : "M"}${X(x).toFixed(1)},${Y(hauteur(x)).toFixed(1)}`);
  }
  const eau = `<path d="${surface.join("")}L${X(xMax).toFixed(1)},${Y(0).toFixed(1)}
    L${X(0).toFixed(1)},${Y(0).toFixed(1)}Z" fill="${C.eau}" opacity=".6"/>
    <path d="${surface.join("")}" fill="none" stroke="${C.eauTrait}" stroke-width="2"/>`;

  const hachures = [];
  for (let x = 0; x <= xProtection; x += xProtection / 22)
    hachures.push(`<line x1="${X(x).toFixed(1)}" y1="${Y(0).toFixed(1)}"
      x2="${(X(x) - 4).toFixed(1)}" y2="${(Y(0) + 7).toFixed(1)}" stroke="${C.repere}"
      stroke-width="1"/>`);

  const debordeLaProtection = xDebut + L > xProtection * 1.02;
  const cote = { "en place": "#15803d", "noyé": "#0369a1", "rejeté": C.alerte }[r.position];

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img"
      aria-label="Ressaut hydraulique à la sortie de l'ouvrage et position par rapport à la protection">
    <line x1="${MG}" y1="${Y(0).toFixed(1)}" x2="${W - MD}" y2="${Y(0).toFixed(1)}"
      stroke="${C.terrainTrait}" stroke-width="1.6"/>
    ${hachures.join("")}
    <line x1="${X(xProtection).toFixed(1)}" y1="${(Y(0) + 9).toFixed(1)}"
      x2="${X(0).toFixed(1)}" y2="${(Y(0) + 9).toFixed(1)}" stroke="${C.repere}" stroke-width="1.1"/>
    <text x="${X(xProtection / 2).toFixed(1)}" y="${(Y(0) + 20).toFixed(1)}" font-size="9"
      fill="${C.repere}" text-anchor="middle">protection posée à la sortie (chapitre 8)</text>
    ${eau}
    <line x1="${MG}" y1="${Y(hAval).toFixed(1)}" x2="${W - MD}" y2="${Y(hAval).toFixed(1)}"
      stroke="${C.cote}" stroke-width="1.1" stroke-dasharray="5 3"/>
    <text x="${(X(0) + 6).toFixed(1)}" y="${(Y(hAval) - 4).toFixed(1)}" font-size="9"
      fill="${C.cote}">niveau aval ${fr(hAval, 2)} m</text>
    <line x1="${X(0).toFixed(1)}" y1="${Y(0).toFixed(1)}" x2="${X(0).toFixed(1)}"
      y2="${Y(yMax).toFixed(1)}" stroke="${C.repere}" stroke-width="2.4"/>
    <text x="${(X(0) + 4).toFixed(1)}" y="${(Y(yMax) + 9).toFixed(1)}" font-size="9"
      font-weight="800" fill="${C.repere}">sortie de l'ouvrage</text>
    <line x1="${X(xDebut).toFixed(1)}" y1="${Y(0).toFixed(1)}" x2="${X(xDebut).toFixed(1)}"
      y2="${Y(yMax * 0.86).toFixed(1)}" stroke="${cote}" stroke-width="1" stroke-dasharray="3 2"/>
    <line x1="${X(xDebut + L).toFixed(1)}" y1="${Y(0).toFixed(1)}"
      x2="${X(xDebut + L).toFixed(1)}" y2="${Y(yMax * 0.86).toFixed(1)}" stroke="${cote}"
      stroke-width="1" stroke-dasharray="3 2"/>
    <line x1="${X(xDebut).toFixed(1)}" y1="${Y(yMax * 0.86).toFixed(1)}"
      x2="${X(xDebut + L).toFixed(1)}" y2="${Y(yMax * 0.86).toFixed(1)}"
      stroke="${cote}" stroke-width="1"/>
    <text x="${X(xDebut + L / 2).toFixed(1)}" y="${(Y(yMax * 0.86) - 4).toFixed(1)}"
      font-size="9.5" font-weight="800" fill="${cote}" text-anchor="middle">
      L ≈ ${fr(L, 2)} m</text>
    <text x="${(X(0) + 6).toFixed(1)}" y="${(Y(y1) - 6).toFixed(1)}"
      font-size="9.5" fill="${C.eauTrait}">y₁ = ${fr(y1, 2)} m</text>
    <text x="${(W - MD - 3).toFixed(1)}" y="${(Y(r.y2) - 6).toFixed(1)}" font-size="9.5"
      fill="${C.eauTrait}" text-anchor="end">y₂ = ${fr(r.y2, 2)} m</text>
    <text x="${W - MD + 4}" y="${MH + 2}" font-size="9.5" font-weight="800" fill="${cote}">
      ${r.position}</text>
    <text x="${W - MD + 4}" y="${MH + 16}" font-size="9" fill="${C.cote}">ressaut ${r.type}</text>
    <text x="${W - MD + 4}" y="${MH + 29}" font-size="9" fill="${C.cote}">Fr₁ = ${fr(Fr1, 2)}</text>
    <text x="${W - MD + 4}" y="${MH + 42}" font-size="9" fill="${C.cote}">ΔE = ${fr(r.perte, 2)} m</text>
    <text x="${W - MD + 4}" y="${MH + 55}" font-size="9"
      fill="${V1 > 12 ? C.alerte : C.cote}">V₁ = ${fr(V1, 1)} m/s</text>
    ${debordeLaProtection ? `<text x="${W - MD + 4}" y="${MH + 73}" font-size="9"
      font-weight="700" fill="${C.alerte}">il finit<tspan x="${W - MD + 4}" dy="11">au-delà de</tspan>
      <tspan x="${W - MD + 4}" dy="11">la protection</tspan></text>` : ""}
    <text x="${MG}" y="14" font-size="10.5" font-weight="800" fill="#075985">
      Ressaut à la sortie — ${r.note}</text>
    ${decalage > 0 ? `<text x="${MG}" y="${H - 6}" font-size="8.5" fill="${C.muet}">Position du
      ressaut rejeté figurée schématiquement : sa distance exacte demande la courbe d'eau
      torrentielle à l'aval, qui n'est pas calculée ici.</text>` : ""}
  </svg>`;
}

// ── Câblage ────────────────────────────────────────────────────────────────

function maj() {
  SECTION = construireSection();
  TARAGE = courbeTarage(SECTION, OUED.pente, DEBITS).filter((p) => p.z !== null);
  const Q = num("rvQ");
  const z = tirantNormal(SECTION, Q, OUED.pente);
  if (z === null) {
    el("rvSection").innerHTML = panneauSection(SECTION.zMax);
    el("rvTarage").innerHTML = "";
    el("rvLits").innerHTML = `<p class="feedback bad">À ${fr(Q, 0)} m³/s, le plan d'eau sort
      de la section levée. Ce n'est pas un défaut de calcul : c'est le levé qui s'arrête.
      On ne prolonge pas les berges au jugé — on retourne sur le terrain.</p>`;
    el("rvOut").innerHTML = "";
    el("rvSensibilite").innerHTML = "";
    return;
  }
  const d = debitA(SECTION, z, OUED.pente);
  const zc = coteCritique(SECTION, Q);
  el("rvSection").innerHTML = panneauSection(z);
  el("rvTarage").innerHTML = panneauTarage(z, Q);
  tableauLits(d);

  const zRadier = num("rvRadier");
  const TW = Math.max(0, z - zRadier);
  const zBerge = Math.min(OUED.berges.gauche, OUED.berges.droite);
  el("rvOut").innerHTML = `
    <p class="final-result"><strong>Cote du plan d'eau ${fr(z, 3)} m</strong> — vitesse
      ${fr(d.vitesse, 2)} m/s, Froude ${fr(d.froude, 3)} (${d.froude < 1 ? "fluvial" : "torrentiel"}),
      ${z > zBerge ? "l'oued déborde dans le lit majeur" : "l'écoulement tient dans le lit mineur"}.
      <small><br>Radier de sortie de l'ouvrage à ${fr(zRadier, 3)} m →
      <strong>TW = ${fr(TW, 3)} m</strong>. C'est cette valeur que demande le chapitre 6, et
      elle ne se devine pas : elle sort de la courbe de tarage ci-dessus.</small></p>
    ${zc !== null ? `<p class="method-note">Cote critique ${fr(zc, 3)} m : le plan d'eau
      calculé est ${z > zc ? "au-dessus" : "en dessous"}, ce qui confirme le régime
      ${z > zc ? "fluvial" : "torrentiel"}. Un tirant normal proche du critique annonce un
      écoulement instable, où la moindre irrégularité du lit déplace la ligne d'eau.</p>` : ""}`;

  const reference = sectionNaturelle(OUED.points, OUED.sousSections);
  const zRef = tirantNormal(reference, Q, OUED.pente);
  const partMajeur = 100 * (d.lits[0].Q + d.lits[2].Q) / d.Q;
  el("rvSensibilite").innerHTML = `<p class="method-note">Avec les rugosités du levé
    (${STRICKLER.find((r) => r.id === OUED.sousSections[1].strickler).nom.toLowerCase()} en lit
    mineur), le plan d'eau serait à ${zRef === null ? "une cote hors du levé" : `${fr(zRef, 3)} m`} :
    le choix actuel le déplace de <strong>${zRef === null ? "—"
      : `${z > zRef ? "+" : ""}${fr((z - zRef) * 100, 0)} cm</strong>`}.
    À ce niveau, le lit majeur ne porte que <strong>${fr(partMajeur, 1)} %</strong> du débit —
    et pourtant il suffit à ruiner le calcul d'un seul bloc.</p>`;

  el("rvRemous").innerHTML = panneauRemous(Q, num("rvExhaussement"));
  el("rvRessaut").innerHTML = panneauRessaut(num("rvY1"), num("rvFr1"), num("rvHaval"));
}

// Chaque curseur affiche sa valeur : sans elle, on déplace un bouton à l'aveugle.
const AFFICHAGES = {
  rvQ: (v) => `${fr(v, 0)} m³/s`,
  rvExhaussement: (v) => `${fr(v, 2)} m`,
  rvY1: (v) => `${fr(v, 2)} m`,
  rvFr1: (v) => fr(v, 1),
  rvHaval: (v) => `${fr(v, 2)} m`,
};
function afficherValeurs() {
  for (const [id, format] of Object.entries(AFFICHAGES)) {
    const cible = el(`${id}Val`);
    if (cible) cible.textContent = format(num(id));
  }
}
for (const [id, defaut] of [["rvKMineur", OUED.sousSections[1].strickler],
                            ["rvKMajeur", OUED.sousSections[0].strickler]]) {
  el(id).innerHTML = STRICKLER.map((r) =>
    `<option value="${r.id}"${r.id === defaut ? " selected" : ""}>${r.nom} — K = ${r.K}</option>`).join("");
  el(id).addEventListener("change", maj);
}

for (const id of ["rvQ", "rvRadier", "rvExhaussement", "rvY1", "rvFr1", "rvHaval"])
  el(id).addEventListener("input", () => { afficherValeurs(); maj(); });
afficherValeurs();
maj();
