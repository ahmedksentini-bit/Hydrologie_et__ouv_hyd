// Le précalage, vu en plan. Ce que la figure doit faire comprendre tient en
// une phrase : la pente d'un ouvrage n'est pas un réglage, c'est une
// conséquence. Elle tombe d'une chaîne de maillons —
//
//   largeur des éléments de la voie → longueur de l'ouvrage → cotes d'entrée
//   et de sortie levées par le topographe → pente,
//
// et le calcul hydraulique ne commence qu'au bout de cette chaîne. D'où le
// point que la figure met en évidence : rien ne garantit que cette pente-là
// tombe au-dessus de la pente critique.
import { precaler, regimeDePente, EPAISSEUR_TETE } from "./solvers-dimensionnement.js";
import { sectionRectangulaire, sectionCirculaire, penteCritique, froude,
         profondeurNormale } from "./solvers-ouvrages.js";

const el = (id) => document.getElementById(id);
const num = (id) => parseFloat((el(id).value || "").replace(",", "."));
const fr = (x, d) => Number.isFinite(x)
  ? x.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";

const T = {
  chaussee: "#64748b", accotement: "#cbd5e1", talus: "#e7e5e4", talusTrait: "#a8a29e",
  terrain: "#f8fafc", ouvrage: "#fff", trait: "#334155", mur: "#94a3b8",
  eau: "#0369a1", leve: "#b45309", cote: "#475569",
};

/** Tout ce que les deux figures et le panneau doivent savoir. */
function etat() {
  const forme = el("pcForme").value;
  const B = num("pcB"), D = num("pcD"), n = Math.max(1, Math.round(num("pcN")) || 1);
  const Q = num("pcQ"), K = parseFloat(el("pcK").value);
  const m = parseFloat(el("pcFruit").value);
  const pre = precaler({
    chaussee: num("pcChaussee"), accotement: num("pcAccotement"),
    hauteurRemblai: num("pcRemblai"), fruitTalus: m, biaisDeg: num("pcBiais"),
    zTnEntree: num("pcZam"), zTnSortie: num("pcZav"),
    decaissement: num("pcDecaissement") || 0, hauteurOuvrage: D,
  });
  const sec = forme === "buse" ? sectionCirculaire(D) : sectionRectangulaire(B, D);
  const q = Q / n;
  const Ic = penteCritique(sec, q, K);
  const yc = Math.min(sec.profondeurCritique(q), sec.hauteur);
  const yn = pre.J > 0 ? profondeurNormale(sec, q, K, pre.J) : NaN;
  const hc = num("pcChaussee") / 2, ha = hc + num("pcAccotement");
  return {
    forme, B, D, n, Q, q, K, m, pre, sec, Ic, yc, yn,
    Fr: Number.isFinite(yn) ? froude(sec, Math.min(yn, sec.hauteur), q) : NaN,
    reg: regimeDePente(pre.J, Ic),
    hc, ha,
    hTalus: ha + m * num("pcRemblai"),                     // pied de talus
    // Là où l'intrados perce le talus : c'est là que se pose la tête, et ce
    // n'est pas au pied — au droit de l'ouvrage, la face de talus est plus haute.
    vAmont: ha + m * Math.max(pre.couvertureAmont, 0),
    vAval: ha + m * Math.max(pre.couvertureAval, 0),
    largeurPlan: forme === "buse" ? n * D + (n - 1) * 0.5 : n * B + (n + 1) * 0.25,
  };
}

// ── Vue en plan ────────────────────────────────────────────────────────────

function vueEnPlan(e) {
  const W = 560, H = 370, MG = 84, MD = 18, MH = 22, MB = 52;
  const marge = 2.2;
  const ech = (H - MH - MB) / (2 * (e.hTalus + marge));    // px/m, imposé par le travers
  const cx = MG + (W - MG - MD) / 2, cy = MH + (H - MH - MB) / 2;
  const X = (u) => cx + u * ech, Y = (v) => cy - v * ech;
  const gauche = MG, droite = W - MD, haut = MH, bas = H - MB;
  const bande = (v0, v1, fill) =>
    `<rect x="${gauche}" y="${Y(v1).toFixed(1)}" width="${(droite - gauche).toFixed(1)}"
       height="${((v1 - v0) * ech).toFixed(1)}" fill="${fill}"/>`;

  const beta = (Math.min(Math.max(num("pcBiais"), 35), 145) * Math.PI) / 180;
  const d = { u: Math.cos(beta), v: Math.sin(beta) };
  const perp = { u: -d.v, v: d.u };
  const tAm = -e.vAmont / d.v, tAv = e.vAval / d.v;        // abscisses des deux têtes
  const w = e.largeurPlan / 2;
  const pt = (t, s = 0) => [X(d.u * t + perp.u * s), Y(d.v * t + perp.v * s)];
  const xy = (t, s) => pt(t, s).map((z) => z.toFixed(1)).join(",");

  const ouvrage = `<polygon points="${xy(tAm, -w)} ${xy(tAv, -w)} ${xy(tAv, w)} ${xy(tAm, w)}"
      fill="${T.ouvrage}" stroke="${T.trait}" stroke-width="1.6"/>`;
  const voiles = Array.from({ length: e.n - 1 }, (_, k) => {
    const s = -w + ((k + 1) * 2 * w) / e.n;
    return `<line x1="${pt(tAm, s)[0].toFixed(1)}" y1="${pt(tAm, s)[1].toFixed(1)}"
      x2="${pt(tAv, s)[0].toFixed(1)}" y2="${pt(tAv, s)[1].toFixed(1)}"
      stroke="${T.trait}" stroke-width="1.1"/>`;
  }).join("");
  const tete = (t, sens) => {
    const ep = EPAISSEUR_TETE, aile = w + 1.2;
    return `<polygon points="${xy(t, -aile)} ${xy(t, aile)} ${xy(t + sens * ep, aile)}
      ${xy(t + sens * ep, -aile)}" fill="${T.mur}" stroke="#64748b" stroke-width="0.8"/>`;
  };

  const tLoin = (e.hTalus + 0.35 * marge) / d.v;
  const talweg = `<line x1="${pt(-tLoin)[0].toFixed(1)}" y1="${pt(-tLoin)[1].toFixed(1)}"
      x2="${pt(tLoin)[0].toFixed(1)}" y2="${pt(tLoin)[1].toFixed(1)}"
      stroke="${T.eau}" stroke-width="1.4" stroke-dasharray="7 4" opacity=".75"/>`;

  // Cotes TN : le talweg est supposé de pente constante entre les deux points
  // levés aux têtes — c'est écrit sous la figure, parce que ce n'est pas donné.
  const zDe = (t) => num("pcZam") - e.pre.J * ((t - tAm) / (tAv - tAm)) * e.pre.L;
  const leves = [-tLoin, tAm, (tAm + tAv) / 2, tAv, tLoin].map((t, i) => {
    const [x, y] = pt(t);
    const cle = i === 1 || i === 3;
    const aGauche = d.u * t > 0;
    return `<path d="M${(x - 3.4).toFixed(1)},${y.toFixed(1)} h6.8 M${x.toFixed(1)},${(y - 3.4).toFixed(1)} v6.8"
        stroke="${cle ? T.leve : T.cote}" stroke-width="${cle ? 1.7 : 1.1}"/>
      <text x="${(x + (aGauche ? -6 : 6)).toFixed(1)}" y="${(y + 3.2).toFixed(1)}"
        text-anchor="${aGauche ? "end" : "start"}" font-size="9.5"
        font-weight="${cle ? 800 : 600}" fill="${cle ? T.leve : T.cote}"
        paint-order="stroke" stroke="#fff" stroke-width="2.8">${fr(zDe(t), 2)}</text>`;
  }).join("");

  /** Cotation portée parallèlement à l'axe de l'ouvrage, décalée de `s`. */
  const coteLongue = (t0, t1, s, texte, couleur) => {
    const [ax, ay] = pt(t0, s), [bx, by] = pt(t1, s);
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    let a = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
    if (a > 90 || a < -90) a += 180;
    return `<line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${bx.toFixed(1)}"
        y2="${by.toFixed(1)}" stroke="${couleur}" stroke-width="1"/>
      <circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="2" fill="${couleur}"/>
      <circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="2" fill="${couleur}"/>
      <text x="${mx.toFixed(1)}" y="${(my + 3.4).toFixed(1)}" font-size="9.5" font-weight="800"
        fill="${couleur}" text-anchor="middle"
        transform="rotate(${a.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)})"
        paint-order="stroke" stroke="#fff" stroke-width="3.2">${texte}</text>`;
  };

  const coteV = (v0, v1, texte, recul = 12) => {
    const x = gauche - recul, y0 = Y(v0), y1 = Y(v1);
    return `<line x1="${x}" y1="${y0.toFixed(1)}" x2="${x}" y2="${y1.toFixed(1)}"
        stroke="${T.cote}" stroke-width="0.9"/>
      <path d="M${x - 3},${(y0 - 3).toFixed(1)} L${x},${y0.toFixed(1)} L${x + 3},${(y0 - 3).toFixed(1)}
               M${x - 3},${(y1 + 3).toFixed(1)} L${x},${y1.toFixed(1)} L${x + 3},${(y1 + 3).toFixed(1)}"
        fill="none" stroke="${T.cote}" stroke-width="0.9"/>
      <text x="${x - 6}" y="${((y0 + y1) / 2 + 3).toFixed(1)}" font-size="9" fill="${T.cote}"
        text-anchor="middle" transform="rotate(-90 ${x - 6} ${((y0 + y1) / 2 + 3).toFixed(1)})">${texte}</text>`;
  };

  const r = 46;
  const arc = `<path d="M${(cx + r).toFixed(1)},${cy.toFixed(1)} A${r},${r} 0 0 0
      ${(cx + r * Math.cos(-beta)).toFixed(1)},${(cy + r * Math.sin(-beta)).toFixed(1)}"
      fill="none" stroke="${T.leve}" stroke-width="1"/>
    <text x="${(cx + (r + 9) * Math.cos(-beta / 2)).toFixed(1)}"
      y="${(cy + (r + 9) * Math.sin(-beta / 2) + 3).toFixed(1)}" font-size="9.5"
      font-weight="800" fill="${T.leve}" text-anchor="middle" paint-order="stroke"
      stroke="#fff" stroke-width="3">${fr(num("pcBiais"), 0)}°</text>`;

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img"
      aria-label="Vue en plan : la route, ses talus, l'ouvrage en biais entre ses deux têtes, et les cotes de terrain naturel levées le long du talweg">
    <defs><pattern id="pcTalus" width="7" height="7" patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="7" stroke="${T.talusTrait}" stroke-width="0.7" opacity=".55"/>
    </pattern>
    <clipPath id="pcCadre"><rect x="${gauche}" y="${haut}" width="${droite - gauche}"
      height="${bas - haut}"/></clipPath></defs>
    <rect x="${gauche}" y="${haut}" width="${droite - gauche}" height="${bas - haut}"
      fill="${T.terrain}" stroke="#e2e8f0"/>
    <g clip-path="url(#pcCadre)">
      ${bande(e.ha, e.hTalus, T.talus)}${bande(e.ha, e.hTalus, "url(#pcTalus)")}
      ${bande(-e.hTalus, -e.ha, T.talus)}${bande(-e.hTalus, -e.ha, "url(#pcTalus)")}
      ${bande(e.hc, e.ha, T.accotement)}${bande(-e.ha, -e.hc, T.accotement)}
      ${bande(-e.hc, e.hc, T.chaussee)}
      <line x1="${gauche}" y1="${Y(e.hTalus).toFixed(1)}" x2="${droite}" y2="${Y(e.hTalus).toFixed(1)}"
        stroke="${T.talusTrait}" stroke-width="1.2"/>
      <line x1="${gauche}" y1="${Y(-e.hTalus).toFixed(1)}" x2="${droite}" y2="${Y(-e.hTalus).toFixed(1)}"
        stroke="${T.talusTrait}" stroke-width="1.2"/>
      <line x1="${gauche}" y1="${cy}" x2="${droite}" y2="${cy}" stroke="#fff" stroke-width="1"
        stroke-dasharray="12 4 2 4" opacity=".85"/>
      ${talweg}${ouvrage}${voiles}${tete(tAm, -1)}${tete(tAv, 1)}${arc}
      ${coteLongue(tAm, tAv, w + 2.7, `L = ${fr(e.pre.L, 2)} m`, T.leve)}
      ${leves}
    </g>
    ${coteV(-e.hc, e.hc, "chaussée")}${coteV(e.hc, e.ha, "acc.")}${coteV(e.ha, e.hTalus, "talus")}
    ${coteV(-e.hTalus, e.hTalus, `emprise ${fr(e.pre.emprise, 2)} m`, 36)}
    <text x="${(pt(tAm)[0] + 13).toFixed(1)}" y="${(pt(tAm)[1] + 16).toFixed(1)}" font-size="9.5"
      font-weight="800" fill="${T.eau}" paint-order="stroke" stroke="#fff" stroke-width="3">entrée</text>
    <text x="${(pt(tAv)[0] + 13).toFixed(1)}" y="${(pt(tAv)[1] - 10).toFixed(1)}" font-size="9.5"
      font-weight="800" fill="${T.eau}" paint-order="stroke" stroke="#fff" stroke-width="3">sortie</text>
    <text x="${gauche + 6}" y="${(cy - 5).toFixed(1)}" font-size="9" fill="#fff" opacity=".9">axe de la route</text>
    <text x="6" y="${H - 30}" font-size="9.5" fill="${T.cote}">L'ouvrage est plus court que
      l'emprise : ses têtes percent le talus au-dessus du pied, là où l'intrados sort.</text>
    <text x="6" y="${H - 16}" font-size="9.5" fill="${T.leve}">⊹ cotes TN levées le long du
      talweg — en gras les deux qui donnent la pente, les autres interpolées</text>
  </svg>`;
}

// ── Profil en long, suivant l'axe de l'ouvrage ─────────────────────────────
// L'exagération verticale est AFFICHÉE. Une coupe étirée sans le dire fait
// paraître raide une pente de sept millièmes ; le lecteur doit savoir de
// combien on a triché.

function profilEnLong(e) {
  const W = 560, H = 215, MG = 96, MD = 100, MH = 24, MB = 42;
  const beta = (Math.min(Math.max(num("pcBiais"), 35), 145) * Math.PI) / 180;
  const sin = Math.sin(beta);
  const L = e.pre.Lentre;                         // de tête à tête
  // Le long de l'axe de l'ouvrage, tout s'allonge de 1/sin(biais) : c'est la
  // même raison qui allonge L.
  const aAm = (e.m * Math.max(e.pre.couvertureAmont, 0)) / sin;   // tête → bord de plate-forme
  const p = e.pre.plateforme / sin;

  const zAm = num("pcZam"), zAv = num("pcZav");
  const zTn = (x) => zAm - ((zAm - zAv) * x) / L;
  const zP = e.pre.zPlateforme;
  const rAm = e.pre.zRadierAmont, rAv = e.pre.zRadierAval;
  const bas = Math.min(rAm, rAv) - 0.5, haut = zP + 0.4;
  const kx = (W - MG - MD) / L, ky = (H - MH - MB) / (haut - bas);
  const X = (x) => MG + x * kx, Y = (z) => H - MB - (z - bas) * ky;

  const repere = (x, z, texte, couleur, ancre, dy) =>
    `<circle cx="${X(x).toFixed(1)}" cy="${Y(z).toFixed(1)}" r="2.6" fill="${couleur}"/>
     <text x="${(X(x) + (ancre === "end" ? -6 : 6)).toFixed(1)}" y="${(Y(z) + dy).toFixed(1)}"
       font-size="9.5" font-weight="800" fill="${couleur}" text-anchor="${ancre}"
       paint-order="stroke" stroke="#fff" stroke-width="3">${texte}</text>`;

  // Le remblai est COUPÉ à chaque tête : sans cette coupe, le talus
  // redescendrait jusqu'au pied devant l'entrée et la boucherait.
  const remblai = `<polygon points="${X(0).toFixed(1)},${Y(zTn(0)).toFixed(1)}
      ${X(0).toFixed(1)},${Y(rAm + e.D).toFixed(1)} ${X(aAm).toFixed(1)},${Y(zP).toFixed(1)}
      ${X(aAm + p).toFixed(1)},${Y(zP).toFixed(1)} ${X(L).toFixed(1)},${Y(rAv + e.D).toFixed(1)}
      ${X(L).toFixed(1)},${Y(zTn(L)).toFixed(1)}" fill="#f1f5f9" stroke="#cbd5e1"/>`;

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img"
      aria-label="Profil en long suivant l'axe de l'ouvrage : terrain naturel levé, remblai coupé aux têtes, radier d'entrée et de sortie">
    ${remblai}
    <rect x="${X(aAm).toFixed(1)}" y="${(Y(zP) - 5).toFixed(1)}" width="${(p * kx).toFixed(1)}"
      height="5" fill="#78716c"/>
    <polygon points="${X(0).toFixed(1)},${Y(rAm).toFixed(1)} ${X(L).toFixed(1)},${Y(rAv).toFixed(1)}
      ${X(L).toFixed(1)},${Y(rAv + e.D).toFixed(1)} ${X(0).toFixed(1)},${Y(rAm + e.D).toFixed(1)}"
      fill="${T.ouvrage}" stroke="${T.trait}" stroke-width="1.5"/>
    <rect x="${(X(0) - 4).toFixed(1)}" y="${Y(rAm + e.D).toFixed(1)}" width="4"
      height="${((e.D + 0.35) * ky).toFixed(1)}" fill="${T.mur}"/>
    <rect x="${X(L).toFixed(1)}" y="${Y(rAv + e.D).toFixed(1)}" width="4"
      height="${((e.D + 0.35) * ky).toFixed(1)}" fill="${T.mur}"/>
    <line x1="${X(0).toFixed(1)}" y1="${Y(zTn(0)).toFixed(1)}" x2="${X(L).toFixed(1)}"
      y2="${Y(zTn(L)).toFixed(1)}" stroke="#a8a29e" stroke-width="1.4" stroke-dasharray="6 3"/>
    <text x="${X(L * 0.66).toFixed(1)}" y="${(Y(zTn(L * 0.66)) - 6).toFixed(1)}" font-size="9"
      fill="#78716c" paint-order="stroke" stroke="#fff" stroke-width="3">terrain naturel</text>
    <line x1="${X(aAm).toFixed(1)}" y1="${Y(zP).toFixed(1)}" x2="${X(aAm).toFixed(1)}"
      y2="${Y(rAm + e.D).toFixed(1)}" stroke="#94a3b8" stroke-width="0.8" stroke-dasharray="3 3"/>
    <text x="${(X(aAm) + 5).toFixed(1)}" y="${(Y((zP + rAm + e.D) / 2) + 3).toFixed(1)}"
      font-size="9" fill="#64748b">couverture ${fr(e.pre.couvertureAmont, 2)} m</text>
    ${repere(0, zTn(0), `TN ${fr(zAm, 3)}`, T.leve, "end", -6)}
    ${repere(L, zTn(L), `TN ${fr(zAv, 3)}`, T.leve, "start", -6)}
    ${repere(0, rAm, `radier ${fr(rAm, 3)}`, T.eau, "end", 13)}
    ${repere(L, rAv, `radier ${fr(rAv, 3)}`, T.eau, "start", 13)}
    <text x="${X(L / 2).toFixed(1)}" y="${(Y((rAm + rAv) / 2) + 15).toFixed(1)}" font-size="10"
      font-weight="800" fill="${T.eau}" text-anchor="middle" paint-order="stroke" stroke="#fff"
      stroke-width="3">J = ${fr(e.pre.J * 100, 3)} %</text>
    <text x="6" y="${H - 12}" font-size="9" fill="#64748b">profil suivant l'axe de l'ouvrage —
      tout s'y allonge de 1/sin(biais) = ${fr(1 / sin, 3)}</text>
    <text x="${W - 6}" y="${H - 12}" font-size="9" fill="#94a3b8" text-anchor="end">
      exagération verticale ×${fr(ky / kx, 1)}</text>
  </svg>`;
}

// ── La chaîne, en toutes lettres ───────────────────────────────────────────

function panneau(e) {
  const { pre, reg } = e;
  const beta = num("pcBiais");
  const Ac = e.sec.aire(e.yc), Pc = e.sec.perimetre(e.yc), Rc = Ac / Pc;
  const etape = (k, titre, corps) =>
    `<div class="solution-step" data-step="${k}"><h3>${titre}</h3>${corps}</div>`;

  const bloque = !pre.valide
    ? `<p class="feedback bad">${pre.motif[0].toUpperCase()}${pre.motif.slice(1)}.</p>` : "";

  const verdict = !pre.valide ? "" : `
    <p class="final-result"><strong>J = ${fr(pre.J * 100, 3)} %
      ${pre.J > e.Ic ? "&gt;" : "&lt;"} I<sub>c</sub> = ${fr(e.Ic * 100, 3)} % —
      écoulement ${reg.regime}</strong>
      <small><br>y<sub>n</sub> = ${fr(e.yn, 3)} m ${e.yn > e.yc ? "&gt;" : "&lt;"}
      y<sub>c</sub> = ${fr(e.yc, 3)} m · Fr = ${fr(e.Fr, 3)} ${e.Fr < 1 ? "&lt; 1" : "&gt; 1"}
      — les trois critères disent la même chose.</small></p>
    ${reg.limite ? `<div class="hint"><strong>À moins de 5 % de la bascule</strong>
      (J/I<sub>c</sub> = ${fr(reg.ecart, 3)}). À cette distance, le régime tient au coefficient
      de rugosité qu'on a choisi, pas au terrain : sur ce même ouvrage, passer de K = 90 à
      K = 50 multiplie I<sub>c</sub> par trois. Annoncer « torrentiel » ou « fluvial » ici,
      c'est annoncer une hypothèse, pas un résultat.</div>` : ""}`;

  el("pcOut").innerHTML =
    etape(1, "La voie donne l'emprise", `
      <p class="explanation">plate-forme = ${fr(num("pcChaussee"), 2)} + 2 × ${fr(num("pcAccotement"), 2)}
        = <strong>${fr(pre.plateforme, 2)} m</strong><br>
        talus = 2 × ${fr(e.m, 1)} × ${fr(num("pcRemblai"), 2)} = ${fr(2 * e.m * num("pcRemblai"), 2)} m<br>
        emprise de pied à pied = <strong>${fr(pre.emprise, 2)} m</strong></p>`) +
    etape(2, "L'ouvrage s'arrête plus haut que le pied", `
      <p class="explanation">plate-forme à ${fr(pre.zPlateforme, 3)} · intrados à
        ${fr(pre.zRadierAmont + e.D, 3)} à l'entrée<br>
        couverture : ${fr(pre.couvertureAmont, 2)} m à l'entrée · ${fr(pre.couvertureAval, 2)} m à la sortie<br>
        largeur de talus à franchir = ${fr(e.m, 1)} × (${fr(pre.couvertureAmont, 2)} +
        ${fr(pre.couvertureAval, 2)}) = ${fr(e.m * (pre.couvertureAmont + pre.couvertureAval), 2)} m
        — et non ${fr(2 * e.m * num("pcRemblai"), 2)} m</p>
      ${bloque}`) +
    etape(3, "Le biais donne la longueur", `
      <p class="explanation">L = (${fr(pre.plateforme, 2)} +
        ${fr(e.m * (pre.couvertureAmont + pre.couvertureAval), 2)}) / sin ${fr(beta, 0)}°
        + 2 × ${fr(EPAISSEUR_TETE, 2)} = <strong>${fr(pre.L, 2)} m</strong>
        <br>allongement dû au biais : ${fr((pre.allongement - 1) * 100, 1)} %</p>`) +
    etape(4, "Le levé donne la pente", `
      <p class="explanation">J = (${fr(num("pcZam"), 3)} − ${fr(num("pcZav"), 3)}) / ${fr(pre.L, 2)}
        = ${fr(pre.chute, 3)} / ${fr(pre.L, 2)} = <strong>${fr(pre.J * 100, 3)} %</strong><br>
        radier : ${fr(pre.zRadierAmont, 3)} à l'entrée · ${fr(pre.zRadierAval, 3)} à la sortie</p>`) +
    etape(5, "La section donne la pente critique", `
      <p class="explanation">y<sub>c</sub> = ${fr(e.yc, 3)} m · A<sub>c</sub> = ${fr(Ac, 3)} m²
        · R<sub>c</sub> = ${fr(Rc, 3)} m<br>
        I<sub>c</sub> = [ ${fr(e.q, 2)} / (${fr(e.K, 0)} × ${fr(Ac, 3)} × ${fr(Rc, 3)}<sup>2/3</sup>) ]²
        = <strong>${fr(e.Ic * 100, 3)} %</strong></p>`) +
    verdict;
}

function maj() {
  const e = etat();
  el("pcB").closest(".field").style.opacity = e.forme === "buse" ? 0.45 : 1;
  el("pcB").disabled = e.forme === "buse";
  el("pcPlan").innerHTML = vueEnPlan(e);
  el("pcProfil").innerHTML = profilEnLong(e);
  panneau(e);
}

for (const id of ["pcChaussee", "pcAccotement", "pcRemblai", "pcBiais", "pcZam", "pcZav",
                  "pcDecaissement", "pcB", "pcD", "pcN", "pcQ"])
  el(id).addEventListener("input", maj);
for (const id of ["pcFruit", "pcForme", "pcK"]) el(id).addEventListener("change", maj);
maj();
