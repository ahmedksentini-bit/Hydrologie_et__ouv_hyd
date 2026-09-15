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
  // L'alignement : le talweg est donné par le terrain, le biais est choisi.
  const biais = num("pcBiais"), talweg = num("pcTalweg");
  const commun = {
    chaussee: num("pcChaussee"), accotement: num("pcAccotement"),
    hauteurRemblai: num("pcRemblai"), fruitTalus: m,
    zTnEntree: num("pcZam"), zTnSortie: num("pcZav"),
    decaissement: num("pcDecaissement") || 0, hauteurOuvrage: D,
  };
  return {
    forme, B, D, n, Q, q, K, m, pre, sec, Ic, yc, yn,
    biais, talweg, desalignement: Math.abs(biais - talweg),
    Laligne: precaler({ ...commun, biaisDeg: talweg }).L,
    Ldroit: precaler({ ...commun, biaisDeg: 90 }).L,
    // Rehausser la chaussée de 1 m ajoute 1 m de couverture à CHAQUE bout,
    // donc m mètres de talus de chaque côté, le tout allongé par le biais.
    dLdH: (2 * m) / Math.sin((Math.min(Math.max(biais, 20), 160) * Math.PI) / 180),
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

  const rad = (deg) => (Math.min(Math.max(deg, 35), 145) * Math.PI) / 180;
  const beta = rad(e.biais), theta = rad(e.talweg);
  const d = { u: Math.cos(beta), v: Math.sin(beta) };          // axe de l'ouvrage
  const dt = { u: Math.cos(theta), v: Math.sin(theta) };       // talweg, imposé par le terrain
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

  // Le talweg court dans SA direction, l'ouvrage dans la sienne. Quand les deux
  // coïncident, l'eau va tout droit ; sinon elle doit tourner deux fois, et
  // c'est tout l'objet de cette figure de le rendre visible.
  const portee = (dir) => (e.hTalus + 0.35 * marge) / Math.abs(dir.v);
  const Rt = portee(dt);
  const ptT = (r) => [X(dt.u * r), Y(dt.v * r)];
  const [axT, ayT] = ptT(-Rt), [bxT, byT] = ptT(Rt);
  const talweg = `<line x1="${axT.toFixed(1)}" y1="${ayT.toFixed(1)}" x2="${bxT.toFixed(1)}"
      y2="${byT.toFixed(1)}" stroke="#78716c" stroke-width="1.3" stroke-dasharray="8 4"
      opacity=".7"/>
    <text x="${(bxT + 6).toFixed(1)}" y="${(byT + 11).toFixed(1)}" font-size="9" fill="#64748b"
      paint-order="stroke" stroke="#fff" stroke-width="3">talweg</text>`;

  // Trace de l'écoulement : elle suit le talweg, se plie pour entrer dans
  // l'ouvrage, le traverse, se plie encore pour le rejoindre.
  const A = ptT(-Rt), Bp = ptT(Rt), Pam = pt(tAm), Pav = pt(tAv);
  const fleche = (p0, p1, frac = 0.55) => {
    const x = p0[0] + (p1[0] - p0[0]) * frac, y = p0[1] + (p1[1] - p0[1]) * frac;
    const a = (Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) * 180) / Math.PI;
    return `<path d="M-5,-3.4 L4.2,0 L-5,3.4 Z" fill="${T.eau}"
      transform="translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${a.toFixed(1)})"/>`;
  };
  const trace = `<polyline points="${[A, Pam, Pav, Bp].map((z) => z.map((n2) => n2.toFixed(1)).join(",")).join(" ")}"
      fill="none" stroke="${T.eau}" stroke-width="2.4" stroke-linejoin="round" opacity=".9"/>
    ${fleche(A, Pam)}${fleche(Pam, Pav)}${fleche(Pav, Bp, 0.5)}`;

  // Cotes TN : trois levés sur le talweg, et les deux cotes retenues aux têtes.
  // Désaligné, les têtes ne sont plus sur la ligne levée — la figure le montre.
  const croix = (x, y, z, cle) => {
    const aGauche = x > cx;
    return `<path d="M${(x - 3.4).toFixed(1)},${y.toFixed(1)} h6.8 M${x.toFixed(1)},${(y - 3.4).toFixed(1)} v6.8"
        stroke="${cle ? T.leve : T.cote}" stroke-width="${cle ? 1.7 : 1.1}"/>
      <text x="${(x + (aGauche ? -6 : 6)).toFixed(1)}" y="${(y + 3.2).toFixed(1)}"
        text-anchor="${aGauche ? "end" : "start"}" font-size="9.5"
        font-weight="${cle ? 800 : 600}" fill="${cle ? T.leve : T.cote}"
        paint-order="stroke" stroke="#fff" stroke-width="2.8">${fr(z, 2)}</text>`;
  };
  const zMilieu = (num("pcZam") + num("pcZav")) / 2;
  const leves = [-Rt, 0, Rt].map((r) => {
    const [x, y] = ptT(r);
    return croix(x, y, zMilieu - e.pre.J * r, false);
  }).join("")
    + croix(Pam[0], Pam[1], num("pcZam"), true)
    + croix(Pav[0], Pav[1], num("pcZav"), true);

  // L'angle que l'eau doit tourner à l'entrée, marqué là où elle le tourne.
  const coude = e.desalignement < 0.5 ? "" : (() => {
    const r0 = 22;
    const a1 = Math.atan2(Pam[1] - A[1], Pam[0] - A[0]);
    const a2 = Math.atan2(Pav[1] - Pam[1], Pav[0] - Pam[0]);
    const u1 = [Math.cos(a1 + Math.PI), Math.sin(a1 + Math.PI)];
    const u2 = [Math.cos(a2), Math.sin(a2)];
    const p1 = [Pam[0] + r0 * u1[0], Pam[1] + r0 * u1[1]];
    const p2 = [Pam[0] + r0 * u2[0], Pam[1] + r0 * u2[1]];
    // Bissectrice par les VECTEURS : moyenner deux angles se trompe de 180°
    // dès qu'ils encadrent la coupure de atan2, et l'étiquette part à l'opposé.
    const h = Math.hypot(u1[0] + u2[0], u1[1] + u2[1]) || 1;
    const bis = [(u1[0] + u2[0]) / h, (u1[1] + u2[1]) / h];
    const sens = ((a2 - (a1 + Math.PI) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI > 0 ? 1 : 0;
    return `<path d="M${p1[0].toFixed(1)},${p1[1].toFixed(1)} A${r0},${r0} 0 0 ${sens}
        ${p2[0].toFixed(1)},${p2[1].toFixed(1)}" fill="none" stroke="#b91c1c" stroke-width="1.4"/>
      <text x="${(Pam[0] + (r0 + 12) * bis[0]).toFixed(1)}"
        y="${(Pam[1] + (r0 + 12) * bis[1] + 3).toFixed(1)}" font-size="10"
        font-weight="800" fill="#b91c1c" text-anchor="middle" paint-order="stroke"
        stroke="#fff" stroke-width="3.2">${fr(e.desalignement, 0)}°</text>`;
  })();

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
      stroke="#fff" stroke-width="3">${fr(e.biais, 0)}°</text>`;

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
      ${trace}${coude}
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
    <text x="6" y="${H - 30}" font-size="9.5" fill="${e.desalignement < 0.5 ? T.cote : "#b91c1c"}">
      ${e.desalignement < 0.5
        ? "Ouvrage aligné sur le talweg : l'eau entre et sort sans tourner."
        : `L'eau doit tourner de ${fr(e.desalignement, 0)}° pour entrer, et d'autant pour ressortir.`}</text>
    <text x="6" y="${H - 16}" font-size="9.5" fill="${T.leve}">⊹ levés du talweg en gris ·
      en gras les deux cotes retenues aux têtes, qui donnent la pente</text>
  </svg>`;
}

// ── Profil en long, suivant l'axe de l'ouvrage ─────────────────────────────
// L'exagération verticale est AFFICHÉE. Une coupe étirée sans le dire fait
// paraître raide une pente de sept millièmes ; le lecteur doit savoir de
// combien on a triché.

function profilEnLong(e) {
  const W = 560, H = 215, MG = 96, MD = 100, MH = 24, MB = 42;
  const beta = (Math.min(Math.max(e.biais, 35), 145) * Math.PI) / 180;
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
      rehausser d'un mètre allonge de 2m/sin(biais) = ${fr(e.dLdH, 2)} m</text>
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

  const aligne = e.desalignement < 0.5;
  const surcout = e.Laligne - e.Ldroit;
  const alignement = etape(1, "Aligner l'ouvrage sur l'écoulement", `
    <p class="explanation">talweg à ${fr(e.talweg, 0)}° · ouvrage à ${fr(e.biais, 0)}° —
      ${aligne ? "<strong>alignés</strong> : l'eau entre et sort sans tourner"
        : `<strong>désalignés de ${fr(e.desalignement, 0)}°</strong> : l'eau tourne
           de ${fr(e.desalignement, 0)}° pour entrer et d'autant pour ressortir`}</p>
    ${aligne ? "" : `<div class="hint">Un coude à l'entrée décolle le filet d'eau de la
      paroi intérieure : la section utile diminue et la charge amont monte. À la sortie,
      le jet frappe la berge extérieure — c'est là que l'affouillement commence, et il
      n'est pas où la protection est posée si on l'a dimensionnée dans l'axe. Entre les
      deux, le dépôt s'installe du côté intérieur et réduit la section chaque saison.</div>`}
    <p class="explanation">Suivre le talweg coûte de la longueur :
      <strong>${fr(e.Laligne, 2)} m</strong> aligné contre <strong>${fr(e.Ldroit, 2)} m</strong>
      pour un ouvrage droit, soit ${fr(surcout, 2)} m — ${surcout < 0.05
        ? "ici rien, le talweg est perpendiculaire à la route"
        : `${fr((surcout / e.Ldroit) * 100, 0)} % de béton en plus pour éviter deux coudes de
           ${fr(Math.abs(90 - e.talweg), 0)}°`}. <strong>C'est l'arbitrage réel</strong>, et il
      se tranche en le chiffrant, pas par principe.</p>`);

  el("pcOut").innerHTML = alignement +
    etape(2, "La voie donne l'emprise", `
      <p class="explanation">plate-forme = ${fr(num("pcChaussee"), 2)} + 2 × ${fr(num("pcAccotement"), 2)}
        = <strong>${fr(pre.plateforme, 2)} m</strong><br>
        talus = 2 × ${fr(e.m, 1)} × ${fr(num("pcRemblai"), 2)} = ${fr(2 * e.m * num("pcRemblai"), 2)} m<br>
        emprise de pied à pied = <strong>${fr(pre.emprise, 2)} m</strong></p>`) +
    etape(3, "L'ouvrage s'arrête plus haut que le pied", `
      <p class="explanation">plate-forme à ${fr(pre.zPlateforme, 3)} · intrados à
        ${fr(pre.zRadierAmont + e.D, 3)} à l'entrée<br>
        couverture : ${fr(pre.couvertureAmont, 2)} m à l'entrée · ${fr(pre.couvertureAval, 2)} m à la sortie<br>
        largeur de talus à franchir = ${fr(e.m, 1)} × (${fr(pre.couvertureAmont, 2)} +
        ${fr(pre.couvertureAval, 2)}) = ${fr(e.m * (pre.couvertureAmont + pre.couvertureAval), 2)} m
        — et non ${fr(2 * e.m * num("pcRemblai"), 2)} m</p>
      ${bloque}`) +
    etape(4, "Le biais donne la longueur", `
      <p class="explanation">L = (${fr(pre.plateforme, 2)} +
        ${fr(e.m * (pre.couvertureAmont + pre.couvertureAval), 2)}) / sin ${fr(beta, 0)}°
        + 2 × ${fr(EPAISSEUR_TETE, 2)} = <strong>${fr(pre.L, 2)} m</strong>
        <br>allongement dû au biais : ${fr((pre.allongement - 1) * 100, 1)} %</p>`) +
    etape(5, "Le levé donne la pente", `
      <p class="explanation">J = (${fr(num("pcZam"), 3)} − ${fr(num("pcZav"), 3)}) / ${fr(pre.L, 2)}
        = ${fr(pre.chute, 3)} / ${fr(pre.L, 2)} = <strong>${fr(pre.J * 100, 3)} %</strong><br>
        radier : ${fr(pre.zRadierAmont, 3)} à l'entrée · ${fr(pre.zRadierAval, 3)} à la sortie</p>`) +
    etape(6, "La section donne la pente critique", `
      <p class="explanation">y<sub>c</sub> = ${fr(e.yc, 3)} m · A<sub>c</sub> = ${fr(Ac, 3)} m²
        · R<sub>c</sub> = ${fr(Rc, 3)} m<br>
        I<sub>c</sub> = [ ${fr(e.q, 2)} / (${fr(e.K, 0)} × ${fr(Ac, 3)} × ${fr(Rc, 3)}<sup>2/3</sup>) ]²
        = <strong>${fr(e.Ic * 100, 3)} %</strong></p>`) +
    verdict;
}

// ── La planche du projeteur : profil en long, puis coupe en travers ────────
// Deux dessins aux ÉCHELLES DE LA PROFESSION, l'un sous l'autre :
//
//   profil en long de la route  S 1/1000 · Z 1/100  (exagération ×10)
//   coupe transversale          S 1/100  · Z 1/100  (forme vraie)
//
// Les unités du viewBox sont des MILLIMÈTRES DE PAPIER : imprimée sur 210 mm
// de large, la planche est à l'échelle. C'est aussi ce qui rend les deux
// échelles vérifiables au lieu d'être une mention décorative.
//
// Ces échelles disent à quoi elles servent : au 1/1000, un ouvrage de 17 m
// occuperait 17 mm. Le profil en long qu'elles cadrent est celui de la ROUTE,
// sur deux cents mètres — c'est là qu'on lit la hauteur de remblai, et c'est
// elle qui commande ensuite la longueur de l'ouvrage.

const PENTE_VERSANT = 0.04;          // schématique, et dit comme tel

function planche(e) {
  const W = 210, MG = 26, MD = 6, utile = W - MG - MD;    // 180 mm utiles
  const m = e.m, Hr = num("pcRemblai");
  const zR = e.pre.zPlateforme, zTnAxe = e.pre.zTnAxe;

  // ── Profil en long de la route ─────────────────────────────────────────
  // 1/1000 : un mètre de terrain vaut un millimètre. 1/100 en Z : dix fois plus.
  const demi = utile / 2;                                  // 90 m de part et d'autre
  const tn = (x) => zTnAxe + Math.abs(x) * PENTE_VERSANT;
  const zHaut = Math.max(zR, tn(demi)) + 0.45, zBas = zTnAxe - 0.55;
  const hP = (zHaut - zBas) * 10;                          // mm
  const y0P = 16;
  const Xp = (x) => MG + demi + x;                         // 1 mm par mètre
  const Yp = (z) => y0P + hP - (z - zBas) * 10;            // 10 mm par mètre
  const xFin = Hr / PENTE_VERSANT;                         // là où le remblai meurt

  const pas = 2;
  const ligneTn = [];
  for (let x = -demi; x <= demi + 1e-9; x += pas)
    ligneTn.push(`${ligneTn.length ? "L" : "M"}${Xp(x).toFixed(2)},${Yp(tn(x)).toFixed(2)}`);

  const remblai = `<path d="M${Xp(-Math.min(xFin, demi)).toFixed(2)},${Yp(tn(-Math.min(xFin, demi))).toFixed(2)}
      L${Xp(0).toFixed(2)},${Yp(zTnAxe).toFixed(2)}
      L${Xp(Math.min(xFin, demi)).toFixed(2)},${Yp(tn(Math.min(xFin, demi))).toFixed(2)}
      L${Xp(Math.min(xFin, demi)).toFixed(2)},${Yp(zR).toFixed(2)}
      L${Xp(-Math.min(xFin, demi)).toFixed(2)},${Yp(zR).toFixed(2)} Z"
      fill="#f1f5f9" stroke="none"/>`;
  const deblai = demi > xFin ? `<path d="M${Xp(xFin).toFixed(2)},${Yp(zR).toFixed(2)}
      L${Xp(demi).toFixed(2)},${Yp(zR).toFixed(2)} L${Xp(demi).toFixed(2)},${Yp(tn(demi)).toFixed(2)} Z
      M${Xp(-xFin).toFixed(2)},${Yp(zR).toFixed(2)} L${Xp(-demi).toFixed(2)},${Yp(zR).toFixed(2)}
      L${Xp(-demi).toFixed(2)},${Yp(tn(demi)).toFixed(2)} Z"
      fill="#fef3c7" stroke="none" opacity=".75"/>` : "";

  const graduation = [];
  for (let x = -80; x <= 80; x += 40)
    graduation.push(`<line x1="${Xp(x).toFixed(2)}" y1="${(y0P + hP).toFixed(2)}"
        x2="${Xp(x).toFixed(2)}" y2="${(y0P + hP + 1.6).toFixed(2)}" stroke="#94a3b8" stroke-width="0.25"/>
      <text x="${Xp(x).toFixed(2)}" y="${(y0P + hP + 5.4).toFixed(2)}" font-size="3.1"
        fill="#64748b" text-anchor="middle">${x === 0 ? "ouvrage" : `${x > 0 ? "+" : ""}${x} m`}</text>`);
  const niveaux = [];
  for (let k = 0; k <= Math.ceil(zHaut - zBas); k++) {
    const z = Math.floor(zBas) + k;
    if (z < zBas || z > zHaut) continue;
    niveaux.push(`<line x1="${MG}" y1="${Yp(z).toFixed(2)}" x2="${(W - MD).toFixed(2)}"
        y2="${Yp(z).toFixed(2)}" stroke="#e2e8f0" stroke-width="0.25"/>
      <text x="${(MG - 1.6).toFixed(2)}" y="${(Yp(z) + 1.1).toFixed(2)}" font-size="3"
        fill="#94a3b8" text-anchor="end">${z}</text>`);
  }

  const profil = `${niveaux.join("")}${remblai}${deblai}
    <path d="${ligneTn.join("")}" fill="none" stroke="#a8a29e" stroke-width="0.45"
      stroke-dasharray="2 1.2"/>
    <line x1="${Xp(-demi).toFixed(2)}" y1="${Yp(zR).toFixed(2)}" x2="${Xp(demi).toFixed(2)}"
      y2="${Yp(zR).toFixed(2)}" stroke="#334155" stroke-width="0.6"/>
    <line x1="${Xp(0).toFixed(2)}" y1="${Yp(zTnAxe).toFixed(2)}" x2="${Xp(0).toFixed(2)}"
      y2="${Yp(zR).toFixed(2)}" stroke="${T.leve}" stroke-width="0.45"/>
    <path d="M${(Xp(0) - 1).toFixed(2)},${(Yp(zTnAxe) - 1.6).toFixed(2)} L${Xp(0).toFixed(2)},${Yp(zTnAxe).toFixed(2)}
      L${(Xp(0) + 1).toFixed(2)},${(Yp(zTnAxe) - 1.6).toFixed(2)}
      M${(Xp(0) - 1).toFixed(2)},${(Yp(zR) + 1.6).toFixed(2)} L${Xp(0).toFixed(2)},${Yp(zR).toFixed(2)}
      L${(Xp(0) + 1).toFixed(2)},${(Yp(zR) + 1.6).toFixed(2)}" fill="none" stroke="${T.leve}" stroke-width="0.4"/>
    <text x="${(Xp(0) + 2.4).toFixed(2)}" y="${Yp((zTnAxe + zR) / 2).toFixed(2)}" font-size="3.4"
      font-weight="700" fill="${T.leve}">H = ${fr(Hr, 2)} m</text>
    <rect x="${(Xp(0) - 0.9).toFixed(2)}" y="${(Yp(e.pre.zRadierAmont + e.D)).toFixed(2)}"
      width="1.8" height="${(e.D * 10).toFixed(2)}" fill="#fff" stroke="${T.trait}" stroke-width="0.4"/>
    <text x="${(Xp(-demi) + 1.5).toFixed(2)}" y="${(Yp(zR) - 1.8).toFixed(2)}" font-size="3.2"
      fill="#334155">rasante</text>
    <text x="${(Xp(demi) - 1.5).toFixed(2)}" y="${(Yp(tn(demi)) - 1.8).toFixed(2)}" font-size="3.2"
      fill="#78716c" text-anchor="end">terrain naturel</text>
    ${graduation.join("")}`;

  // ── Coupe transversale de la route ─────────────────────────────────────
  // 1/100 dans les deux sens : forme VRAIE, aucune exagération. Une coupe
  // étirée ferait croire à des talus raides et à un dévers de toit.
  const y0C = y0P + hP + 26;
  const hc = e.hc, ha = e.ha, hT = e.hTalus;
  const DEVERS_CH = 0.025, DEVERS_ACC = 0.04;             // 2,5 % et 4 %
  const Xc = (u) => MG + utile / 2 + u * 10;              // 1 m = 10 mm
  // La plate-forme est cotée à l'AXE ; elle descend de part et d'autre.
  const zBord = -hc * DEVERS_CH, zAcc = zBord - (ha - hc) * DEVERS_ACC;
  const hCoupe = (Hr + 0.9) * 10;
  const Yc = (z) => y0C + hCoupe - (z + Hr) * 10;         // z relatif à la plate-forme

  const talusBas = zAcc - Hr;                             // pied de talus (TN)
  const corps = `<polygon points="${Xc(-hT).toFixed(2)},${Yc(talusBas).toFixed(2)}
      ${Xc(-ha).toFixed(2)},${Yc(zAcc).toFixed(2)} ${Xc(-hc).toFixed(2)},${Yc(zBord).toFixed(2)}
      ${Xc(0).toFixed(2)},${Yc(0).toFixed(2)} ${Xc(hc).toFixed(2)},${Yc(zBord).toFixed(2)}
      ${Xc(ha).toFixed(2)},${Yc(zAcc).toFixed(2)} ${Xc(hT).toFixed(2)},${Yc(talusBas).toFixed(2)}"
      fill="#f1f5f9" stroke="#cbd5e1" stroke-width="0.4"/>`;
  const revetement = `<polyline points="${Xc(-hc).toFixed(2)},${Yc(zBord).toFixed(2)}
      ${Xc(0).toFixed(2)},${Yc(0).toFixed(2)} ${Xc(hc).toFixed(2)},${Yc(zBord).toFixed(2)}"
      fill="none" stroke="#57534e" stroke-width="1.1"/>`;
  const sol = `<line x1="${MG}" y1="${Yc(talusBas).toFixed(2)}" x2="${(W - MD).toFixed(2)}"
      y2="${Yc(talusBas).toFixed(2)}" stroke="#a8a29e" stroke-width="0.45" stroke-dasharray="2 1.2"/>`;

  // L'ouvrage, en section : c'est lui que la coupe traverse en travers.
  const larg = e.largeurPlan, nb = e.n;
  const ouvrage = `<rect x="${Xc(-larg / 2).toFixed(2)}" y="${Yc(talusBas + e.D).toFixed(2)}"
      width="${(larg * 10).toFixed(2)}" height="${(e.D * 10).toFixed(2)}" fill="#fff"
      stroke="${T.trait}" stroke-width="0.5"/>
    ${Array.from({ length: nb - 1 }, (_, k) => {
      const u = -larg / 2 + ((k + 1) * larg) / nb;
      return `<line x1="${Xc(u).toFixed(2)}" y1="${Yc(talusBas + e.D).toFixed(2)}"
        x2="${Xc(u).toFixed(2)}" y2="${Yc(talusBas).toFixed(2)}" stroke="${T.trait}" stroke-width="0.4"/>`;
    }).join("")}`;

  const coteH = (u0, u1, z, texte) => {
    const y = Yc(z) + 6;
    return `<line x1="${Xc(u0).toFixed(2)}" y1="${y.toFixed(2)}" x2="${Xc(u1).toFixed(2)}"
        y2="${y.toFixed(2)}" stroke="${T.cote}" stroke-width="0.3"/>
      <path d="M${(Xc(u0) + 1.4).toFixed(2)},${(y - 1).toFixed(2)} L${Xc(u0).toFixed(2)},${y.toFixed(2)}
        L${(Xc(u0) + 1.4).toFixed(2)},${(y + 1).toFixed(2)}
        M${(Xc(u1) - 1.4).toFixed(2)},${(y - 1).toFixed(2)} L${Xc(u1).toFixed(2)},${y.toFixed(2)}
        L${(Xc(u1) - 1.4).toFixed(2)},${(y + 1).toFixed(2)}" fill="none" stroke="${T.cote}" stroke-width="0.3"/>
      <text x="${Xc((u0 + u1) / 2).toFixed(2)}" y="${(y - 1.4).toFixed(2)}" font-size="3"
        fill="${T.cote}" text-anchor="middle" paint-order="stroke" stroke="#f8fafc"
        stroke-width="1.4">${texte}</text>`;
  };

  const coupe = `${sol}${corps}${revetement}${ouvrage}
    ${coteH(-hc, hc, talusBas, `chaussée ${fr(2 * hc, 2)} m`)}
    ${coteH(ha, hT, talusBas, `talus ${fr(m, 1)} H / 1 V`)}
    ${coteH(-hT, -ha, talusBas, `${fr(m * Hr, 2)} m`)}
    ${coteH(-hT, hT, talusBas - 1.1, `emprise ${fr(e.pre.emprise, 2)} m`)}
    <text x="${Xc(hc + (ha - hc) / 2).toFixed(2)}" y="${(Yc(zAcc) - 2).toFixed(2)}" font-size="2.9"
      fill="${T.cote}" text-anchor="middle">acc.</text>
    <text x="${Xc(0).toFixed(2)}" y="${(Yc(0) - 2.6).toFixed(2)}" font-size="3"
      fill="#57534e" text-anchor="middle">dévers 2,5 %</text>
    <line x1="${Xc(-ha - 0.2).toFixed(2)}" y1="${Yc(zAcc).toFixed(2)}" x2="${Xc(-ha - 0.2).toFixed(2)}"
      y2="${Yc(talusBas).toFixed(2)}" stroke="${T.leve}" stroke-width="0.4"/>
    <path d="M${(Xc(-ha - 0.2) - 1).toFixed(2)},${(Yc(zAcc) + 1.6).toFixed(2)} L${Xc(-ha - 0.2).toFixed(2)},${Yc(zAcc).toFixed(2)}
      L${(Xc(-ha - 0.2) + 1).toFixed(2)},${(Yc(zAcc) + 1.6).toFixed(2)}
      M${(Xc(-ha - 0.2) - 1).toFixed(2)},${(Yc(talusBas) - 1.6).toFixed(2)} L${Xc(-ha - 0.2).toFixed(2)},${Yc(talusBas).toFixed(2)}
      L${(Xc(-ha - 0.2) + 1).toFixed(2)},${(Yc(talusBas) - 1.6).toFixed(2)}" fill="none"
      stroke="${T.leve}" stroke-width="0.35"/>
    <text x="${Xc(-ha + 0.5).toFixed(2)}" y="${Yc(talusBas / 2).toFixed(2)}" font-size="3.2"
      font-weight="700" fill="${T.leve}" paint-order="stroke" stroke="#f1f5f9"
      stroke-width="1.6">H = ${fr(Hr, 2)} m</text>
    <text x="${Xc(0).toFixed(2)}" y="${(Yc(talusBas + e.D) - 2).toFixed(2)}" font-size="2.9"
      fill="${T.trait}" text-anchor="middle">ouvrage ${e.forme === "buse"
        ? `Ø ${fr(e.D, 2)}` : `${fr(e.B, 2)} × ${fr(e.D, 2)}`} m${e.n > 1 ? ` × ${e.n}` : ""}</text>`;

  const hTotal = y0C + hCoupe + 32;
  return `<svg viewBox="0 0 ${W} ${hTotal.toFixed(1)}" width="100%" class="planche-projeteur"
      role="img" aria-label="Planche : profil en long de la route au 1/1000 en abscisses et 1/100 en altitudes, et coupe transversale au 1/100">
    <rect x="0" y="0" width="${W}" height="${hTotal.toFixed(1)}" fill="#fff"/>
    <text x="${MG}" y="7" font-size="4" font-weight="800" fill="#075985">Profil en long de la route</text>
    <text x="${(W - MD).toFixed(2)}" y="7" font-size="3.2" fill="#64748b" text-anchor="end">
      S 1/1000 · Z 1/100 — exagération ×10</text>
    <text x="${MG}" y="11.6" font-size="3" fill="#94a3b8">versants à ${fr(PENTE_VERSANT * 100, 0)} %,
      schématiques — la rasante est prise horizontale au point bas</text>
    ${profil}
    <text x="${MG}" y="${(y0C - 9).toFixed(2)}" font-size="4" font-weight="800" fill="#075985">
      Coupe transversale au droit de l'ouvrage</text>
    <text x="${(W - MD).toFixed(2)}" y="${(y0C - 9).toFixed(2)}" font-size="3.2" fill="#64748b"
      text-anchor="end">S 1/100 · Z 1/100 — forme vraie</text>
    ${coupe}
    <text x="${MG}" y="${(hTotal - 4).toFixed(2)}" font-size="3" fill="#94a3b8">Unités du dessin :
      millimètres de papier. Imprimée sur 210 mm de large, la planche est à l'échelle.</text>
  </svg>`;
}

function maj() {
  const e = etat();
  el("pcRemblaiVal").textContent = `${fr(num("pcRemblai"), 2)} m`;
  el("pcBiaisVal").textContent = `${fr(e.biais, 0)}°`;
  el("pcTalwegVal").textContent = `${fr(e.talweg, 0)}°`;
  el("pcB").closest(".field").style.opacity = e.forme === "buse" ? 0.45 : 1;
  el("pcB").disabled = e.forme === "buse";
  el("pcPlan").innerHTML = vueEnPlan(e);
  el("pcProfil").innerHTML = profilEnLong(e);
  el("pcPlanche").innerHTML = planche(e);
  panneau(e);
}

for (const id of ["pcChaussee", "pcAccotement", "pcRemblai", "pcBiais", "pcTalweg",
                  "pcZam", "pcZav", "pcDecaissement", "pcB", "pcD", "pcN", "pcQ"])
  el(id).addEventListener("input", maj);
for (const id of ["pcFruit", "pcForme", "pcK"]) el(id).addEventListener("change", maj);
el("pcAligner").addEventListener("click", () => {
  el("pcBiais").value = el("pcTalweg").value;
  maj();
});
el("pcDroit").addEventListener("click", () => { el("pcBiais").value = "90"; maj(); });
maj();
