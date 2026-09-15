// Contrôles structurels des pages. Deux pannes silencieuses sont visées :
//  · deux éléments portant le même id — getElementById ne renvoie que le
//    premier, et un chapitre écrit alors dans la figure d'un autre ;
//  · un script de figure qui appelle el("xxx") sans que cet id existe — la
//    page se charge, la figure reste vide, et rien ne le signale.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const lire = (f) => readFileSync(join(racine, f), "utf-8");
const PAGES = ["index.html", "cours.html", "exerciseur.html"];

const idsDe = (html) => [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);

for (const page of PAGES) {
  test(`${page} — aucun identifiant en double`, () => {
    const vus = new Set(), doubles = new Set();
    for (const id of idsDe(lire(page))) (vus.has(id) ? doubles : vus).add(id);
    assert.deepEqual([...doubles], [], `identifiants en double dans ${page}`);
  });
}

test("les figures du cours ne visent que des identifiants existants", () => {
  const ids = new Set(idsDe(lire("cours.html")));
  const scripts = readdirSync(join(racine, "src")).filter((f) => /^cours-ch\d+(-[a-z]+)?\.js$/.test(f));
  assert.ok(scripts.length >= 7, "un script de figure par chapitre rédigé");
  for (const f of scripts) {
    const src = lire(join("src", f));
    for (const [, id] of src.matchAll(/\bel\("([^"]+)"\)/g))
      assert.ok(ids.has(id), `${f} appelle el("${id}") — absent de cours.html`);
    // chaque script doit être chargé par la page
    assert.ok(lire("cours.html").includes(`src/${f}`), `${f} n'est pas chargé par cours.html`);
  }
});

test("le service worker précharge tout ce que les pages utilisent", () => {
  const sw = lire("sw.js");
  const attendus = [...new Set([
    ...PAGES,
    ...readdirSync(join(racine, "src")).map((f) => `src/${f}`),
  ])];
  for (const f of attendus)
    assert.ok(sw.includes(`"./${f}"`), `${f} absent de la coquille du service worker`);
});

test("chaque chapitre annoncé disponible a bien sa section et sa banque", () => {
  const { chapitres } = JSON.parse(lire("data/chapitres.json"));
  const html = lire("cours.html");
  const banques = new Set(readdirSync(join(racine, "data"))
    .map((f) => /^exercices-(ch\d+)\.json$/.exec(f)?.[1]).filter(Boolean));
  for (const c of chapitres) {
    if (c.cours) assert.ok(html.includes(`id="${c.id}"`), `${c.id} annoncé mais absent du cours`);
    if (c.exercices) {
      assert.ok(banques.has(c.id), `${c.id} annonce des exercices sans banque`);
      const b = JSON.parse(lire(`data/exercices-${c.id}.json`));
      assert.equal(b.exercices.length, c.exercices,
        `${c.id} : ${b.exercices.length} exercices en banque, ${c.exercices} annoncés`);
    }
  }
});

test("le bassin de démonstration est cohérent", () => {
  const bv = JSON.parse(lire("data/bassin-demo.json"));
  assert.ok(bv.aire > 0 && bv.perimetre > 0, "surface et périmètre");
  const { nx, ny } = bv.grille;
  // la surface annoncée doit correspondre à la grille
  assert.ok(bv.aire < nx * ny * bv.grille.pas ** 2, "surface inférieure à la grille");
  // le contour est fermé
  const [a, b] = [bv.limite[0], bv.limite[bv.limite.length - 1]];
  assert.deepEqual(a, b, "ligne de partage des eaux fermée");
  // l'hypsométrie décroît de Hmax à Hmin, et couvre bien [0,1]
  const h = bv.hypsometrie;
  assert.equal(h[0][1], 0); assert.equal(h[h.length - 1][1], 1);
  for (let i = 1; i < h.length; i++) {
    assert.ok(h[i][0] <= h[i - 1][0] + 1e-9, `hypsométrie non décroissante au rang ${i}`);
    assert.ok(h[i][1] > h[i - 1][1], `fractions non croissantes au rang ${i}`);
  }
  const A = bv.altitudes;
  assert.ok(A.Hmin <= A.H95 && A.H95 <= A.H50 && A.H50 <= A.H5 && A.H5 <= A.Hmax,
    "altitudes caractéristiques ordonnées");
  assert.ok(A.Hmoy > A.Hmin && A.Hmoy < A.Hmax, "altitude moyenne dans la plage");
  // le réseau et les contours restent dans la grille
  for (const [x1, y1, x2, y2] of bv.reseau)
    assert.ok(x1 >= 0 && x1 < nx && y1 >= 0 && y1 < ny && x2 >= 0 && x2 < nx && y2 >= 0 && y2 < ny,
      "segment de réseau hors grille");
  // l'exutoire est sur le tracé de la route
  assert.equal(bv.exutoire[1], bv.ligneRoute, "exutoire sur la route");
});

test("les stations SOGREAH sont cohérentes et dans l'emprise des planches", () => {
  const j = JSON.parse(lire("data/stations-sogreah.json"));
  assert.equal(j.stations.length, 19);
  for (const s of j.stations) {
    assert.ok(s.nom && Number.isFinite(s.lon) && Number.isFinite(s.lat), `${s.nom} : coordonnées`);
    // les planches couvrent le Centre et le Sud, rien au-dessus de 36,3° N
    assert.ok(s.lat > 32 && s.lat < 36.3, `${s.nom} : latitude hors des planches`);
    assert.ok(s.lon > 7.5 && s.lon < 11.6, `${s.nom} : longitude hors des planches`);
    // la seule règle universelle
    if (s.P10 !== null) assert.ok(s.P10 < s.P100, `${s.nom} : P10 < P100`);
    // et le drapeau doit correspondre à la donnée, pas la précéder
    const depasse = s.P10 !== null && s.P0 >= s.P10;
    assert.equal(!!s.seuilAuDessusDeP10, depasse, `${s.nom} : drapeau P0 ≥ P10`);
  }
  const marquees = j.stations.filter((s) => s.seuilAuDessusDeP10).map((s) => s.nom);
  assert.deepEqual(marquees, ["Tozeur", "Kébili", "Douz"], "le Sud saharien");
  assert.equal(j.stations.filter((s) => s.P10 === null).length, 1, "une lecture incomplète");
});

test("l'échelle séquentielle de la carte est monotone et d'une seule teinte", () => {
  const src = lire("src/echelle.js");
  const m = /const RAMPE_SEQUENTIELLE = \[([^\]]+)\]/.exec(src);
  assert.ok(m, "rampe déclarée");
  const rampe = m[1].match(/#[0-9a-f]{6}/gi);
  assert.equal(rampe.length, 5, "cinq pas contrôlés");

  // luminance relative WCAG : elle doit décroître strictement (clair → foncé)
  const lum = (hex) => {
    const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const L = rampe.map(lum);
  for (let i = 1; i < L.length; i++)
    assert.ok(L[i] < L[i - 1], `pas ${i} : clarté non décroissante`);
  // le pas le plus clair doit rester lisible sur le fond de carte #f8fafc
  const contraste = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  assert.ok(contraste(rampe[0], "#f8fafc") >= 2,
    `pas le plus clair à ${contraste(rampe[0], "#f8fafc").toFixed(2)}:1, plancher 2:1`);
  // une seule teinte : tous les pas dominés par le bleu
  for (const c of rampe) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    assert.ok(b > r && b >= g, `${c} n'est pas dans la teinte bleue`);
  }
});

test("stations de Montana — a(T) seul n'est jamais croissant, a(T)·T^c toujours", () => {
  const j = JSON.parse(lire("data/stations-montana.json"));
  assert.equal(j.stations.length, 45);
  let aSeulCroissant = 0, produitCroissant = 0;
  for (const s of j.stations) {
    assert.ok(Number.isFinite(s.b) && Number.isFinite(s.c), `${s.nom} : b et c`);
    const Ts = Object.keys(s.aT).map(Number).sort((a, b) => a - b);
    assert.deepEqual(Ts, j.periodes, `${s.nom} : toutes les périodes`);
    const croissant = (f) => Ts.every((T, i) => i === 0 || f(T) > f(Ts[i - 1]));
    if (croissant((T) => s.aT[T])) aSeulCroissant++;
    if (croissant((T) => s.aT[T] * T ** s.c)) produitCroissant++;
    // position : ou bien recoupée avec ses deux coordonnées, ou bien absente des deux
    if (s.position === "wgs84") {
      assert.ok(Number.isFinite(s.lat) && Number.isFinite(s.lon), `${s.nom} : coordonnées`);
      assert.ok(s.lat > 30 && s.lat < 38 && s.lon > 7 && s.lon < 12, `${s.nom} : hors de Tunisie`);
    } else {
      assert.equal(s.lat, undefined, `${s.nom} : ne doit porter aucune coordonnée`);
    }
  }
  // c'est l'affirmation du cours, mot pour mot
  assert.equal(aSeulCroissant, 0, "aucune station n'a un a(T) croissant de bout en bout");
  assert.equal(produitCroissant, 45, "toutes ont un a(T)·T^c croissant");
  assert.equal(j.stations.filter((s) => s.position === "wgs84").length, 30, "trente placées");
});

test("le tableau de Kasserine affiché dans le cours est celui du fichier", () => {
  const j = JSON.parse(lire("data/stations-montana.json"));
  const k = j.stations.find((s) => s.nom === "Kasserine");
  assert.deepEqual([k.b, k.c], [0.633, 0.178], "la station de référence du cours");
  assert.equal(k.aT["10"], 211, "le 211 du calculateur est le a du décennal");
  const html = lire("cours.html");
  // les deux lignes du tableau doivent correspondre au calcul
  for (const T of j.periodes) {
    assert.ok(html.includes(`>${k.aT[T]}</td>`), `a(${T}) = ${k.aT[T]} absent du cours`);
    const produit = Math.round(k.aT[T] * T ** k.c);
    assert.ok(html.includes(`>${produit}</td>`), `a(${T})·T^c = ${produit} absent du cours`);
  }
  // l'écart annoncé entre le a décennal et le a centennal
  const ecart = (k.aT["10"] - k.aT["100"]) / k.aT["100"] * 100;
  assert.ok(ecart > 5.5 && ecart < 6.5, `écart annoncé « 6 % » : ${ecart.toFixed(1)} %`);
});

test("frontières — géométrie découpée, fermée et correctement située", () => {
  const f = JSON.parse(lire("data/frontieres.json"));
  assert.deepEqual(f.pays.map((p) => p.nom), ["Tunisie", "Algérie", "Libye"]);
  assert.equal(f.pays.filter((p) => p.principal).length, 1, "un seul pays principal");
  const [lo, la, LO, LA] = f.boite;
  for (const p of f.pays) {
    assert.ok(p.anneaux.length >= 1, `${p.nom} : au moins un anneau`);
    for (const a of p.anneaux) {
      assert.ok(a.length >= 6, `${p.nom} : anneau trop court`);
      for (const [lon, lat] of a)
        assert.ok(lon >= lo - 1e-9 && lon <= LO + 1e-9 && lat >= la - 1e-9 && lat <= LA + 1e-9,
          `${p.nom} : sommet ${lon},${lat} hors de la boîte de découpe`);
    }
  }
  const tn = f.pays.find((p) => p.principal);
  const xs = tn.anneaux.flat().map((c) => c[0]), ys = tn.anneaux.flat().map((c) => c[1]);
  // la Tunisie continentale : du Cap Blanc au sud saharien, de Tabarka à Ben Gardane
  const nord = Math.max(...ys), ouest = Math.min(...xs), est = Math.max(...xs);
  assert.ok(nord > 37.2 && nord < 37.6, `extrême nord ${nord}`);
  assert.ok(ouest > 7.4 && ouest < 8.6, `extrême ouest ${ouest}`);
  assert.ok(est > 11.4 && est < 11.7, `extrême est ${est}`);
  assert.ok(tn.anneaux.length >= 3, "le continent, Djerba et les Kerkennah au moins");
});

test("le test terre/mer place correctement quelques points connus", () => {
  const f = JSON.parse(lire("data/frontieres.json"));
  const dans = (lon, lat, a) => {
    let d = false;
    for (let i = 0, j = a.length - 1; i < a.length; j = i++) {
      const [xi, yi] = a[i], [xj, yj] = a[j];
      if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) d = !d;
    }
    return d;
  };
  const terre = (lon, lat) => f.pays.some((p) => p.anneaux.some((a) => dans(lon, lat, a)));
  for (const [nom, lon, lat] of [["Tunis", 10.18, 36.80], ["Kairouan", 10.10, 35.68],
                                 ["Gafsa", 8.78, 34.42], ["Sfax", 10.76, 34.74]])
    assert.equal(terre(lon, lat), true, `${nom} doit être à terre`);
  for (const [nom, lon, lat] of [["golfe de Hammamet", 10.9, 36.2],
                                 ["large de Kélibia", 11.4, 36.9], ["nord de Bizerte", 10.0, 37.5]])
    assert.equal(terre(lon, lat), false, `${nom} doit être en mer`);
});

test("la projection des cartes respecte le vrai rapport des degrés", async () => {
  const { projection } = await import("../src/carte-fond.js");
  for (const fenetre of [{ lon0: 7.6, lat0: 30.0, lon1: 11.8, lat1: 37.7 },
                         { lon0: 7.7, lat0: 32.4, lon1: 11.7, lat1: 36.1 }]) {
    const p = projection(fenetre, { largeurMax: 400, hauteurMax: 400, mg: 40, md: 12, mh: 12, mb: 28 });
    const latMid = (fenetre.lat0 + fenetre.lat1) / 2;
    const dLat = Math.abs(p.py(latMid) - p.py(latMid + 1));
    const dLon = Math.abs(p.px(9) - p.px(10));
    const attendu = Math.cos((latMid * Math.PI) / 180);
    assert.ok(Math.abs(dLon / dLat - attendu) < 0.01 * attendu,
      `rapport ${(dLon / dLat).toFixed(4)} contre cos φ = ${attendu.toFixed(4)}`);
    // la carte tient dans la boîte, et y est centrée
    assert.ok(p.zone.x0 >= 40 - 1e-9 && p.zone.x1 <= 400 - 12 + 1e-9, "débordement horizontal");
    assert.ok(p.zone.y0 >= 12 - 1e-9 && p.zone.y1 <= 400 - 28 + 1e-9, "débordement vertical");
  }
});

test("survol des cartes — calque dédié, et pas de <title> concurrent", () => {
  for (const f of ["src/cours-ch3-montana.js", "src/cours-ch4-stations.js"]) {
    const src = lire(f);
    // chaque station porte de quoi remplir l'étiquette
    assert.match(src, /data-nom="\$\{s\.nom\}"/, `${f} : data-nom`);
    assert.match(src, /data-detail="\$\{detail\}"/, `${f} : data-detail`);
    // une cible de survol plus large que la pastille
    assert.match(src, /r="12" fill="transparent" class="cible"/, `${f} : cible de survol`);
    // le calque est posé et câblé
    assert.match(src, /calqueSurvol\("survol\w+"\)/, `${f} : calque`);
    assert.match(src, /attacherSurvol\(/, `${f} : câblage`);
    // le <title> natif ferait doublon avec l'étiquette dessinée
    assert.ok(!/<title>/.test(src), `${f} : un <title> subsiste et doublerait l'étiquette`);
    // le calque vient en DERNIER : en SVG l'ordre du document fait l'empilement
    const iPoints = src.indexOf("clip-path=\"url(#clip");
    const iCalque = src.indexOf("calqueSurvol(");
    assert.ok(iCalque > iPoints, `${f} : le calque doit suivre les points`);
  }
});

test("le style de survol n'atteint pas la cible invisible", () => {
  const css = lire("site.css");
  assert.match(css, /\.station:hover circle:not\(\.cible\)/, "la pastille grossit, pas la cible");
  assert.ok(!/\.station:hover circle\{/.test(css), "règle non qualifiée : elle rétrécirait la cible");
  assert.match(css, /\.survol-carte\{pointer-events:none\}/, "le calque n'intercepte rien");
});

test("le tableau d'ajustement porte un encadrement PAR LOI", () => {
  const src = lire("src/cours-ch2.js");
  // une bande par loi, sans quoi seule la loi encadrée réagirait au niveau
  assert.match(src, /const bandes = new Map\(ajustements\.map/, "une bande par loi");
  assert.match(src, /borneHaute/, "mode borne haute");
  // le sélecteur existe dans la page, et la borne haute est le défaut
  const html = lire("cours.html");
  assert.match(html, /id="gValeur"/, "sélecteur de valeur affichée");
  assert.match(html, /value="haute" selected/, "la borne haute est le défaut");
  // l'ancienne ligne d'intervalle unique ne doit pas réapparaître
  assert.ok(!/intervalle \$\{fr\(niveau \* 100, 0\)\} %<\/td>/.test(src),
    "la ligne d'intervalle unique a été remplacée par un encadrement par loi");
});

test("le sélecteur de base du logarithme démontre sans piéger", () => {
  const src = lire("src/exerciseur.js");
  const entree = src.match(/\["ghorbelLog",[\s\S]*?\],\n/);
  assert.ok(entree, "le sélecteur de base est présent — il sert la démonstration en séance");
  // La question est tranchée : ln par défaut, et l'option fautive est nommée comme telle.
  assert.match(entree[0], /\], "ln"\],/, "le défaut du sélecteur est ln");
  assert.match(entree[0], /\[\["ln",/, "ln est la première option");
  assert.match(entree[0], /log₁₀ — lecture fautive/, "log₁₀ est étiquetée comme fautive");
  // Choisir log₁₀ doit dire à l'écran que le résultat n'est pas un calcul de projet.
  assert.match(src, /base === "log10"[\s\S]{0,400}?Démonstration, pas un calcul de projet/,
    "l'avertissement accompagne le choix de log₁₀");
  // …et seulement dans les zones où la formule logarithmique s'applique.
  assert.match(src, /grande && base === "log10"/, "l'avertissement est limité aux zones IV et V");
});

test("carte de Montana — zoom géographique et emprise qui couvre le semis", () => {
  const html = lire("cours.html"), src = lire("src/cours-ch3-montana.js");
  for (const id of ["mZoomPlus", "mZoomMoins", "mZoomReset", "mZoomEtat"])
    assert.ok(html.includes(`id="${id}"`), `${id} manque dans cours.html`);
  // Le zoom rétrécit la FENÊTRE puis reprojette. Un scale() sur le SVG grossirait
  // aussi les traits et décalerait les cibles de survol, qui sont en pixels.
  assert.ok(!/transform\s*=\s*["'`]\s*scale/.test(src),
    "le zoom ne passe pas par une transformation du SVG");
  assert.match(src, /graduations\(FENETRE\.lon0, FENETRE\.lon1\)/,
    "le graticule suit la fenêtre au lieu d'une liste figée");

  // L'emprise pleine doit contenir toutes les stations placées, sinon une
  // station existe dans la liste sans jamais paraître sur la carte.
  const f = src.match(/FENETRE_PLEINE = \{ lon0: ([\d.]+), lat0: ([\d.]+), lon1: ([\d.]+), lat1: ([\d.]+) \}/);
  assert.ok(f, "FENETRE_PLEINE lisible");
  const [lon0, lat0, lon1, lat1] = f.slice(1).map(Number);
  const jeu = JSON.parse(lire("data/stations-montana.json"));
  const placees = jeu.stations.filter((s) => s.position === "wgs84");
  assert.equal(placees.length, 30, "trente stations placées");
  for (const s of placees) {
    assert.ok(s.lon > lon0 && s.lon < lon1, `${s.nom} hors de l'emprise en longitude`);
    assert.ok(s.lat > lat0 && s.lat < lat1, `${s.nom} hors de l'emprise en latitude`);
  }
});

test("déplacement de la carte — le clic reste possible", () => {
  const src = lire("src/cours-ch3-montana.js");
  // Capturer le pointeur dès l'appui ferait porter le `click` final par
  // l'enveloppe : ni station cliquable, ni bouton de zoom utilisable.
  const bloc = (nom) => {
    const debut = src.indexOf(`addEventListener("${nom}"`);
    assert.ok(debut > 0, `gestionnaire ${nom} présent`);
    return src.slice(debut, src.indexOf("});", debut));
  };
  assert.ok(!bloc("pointerdown").includes("setPointerCapture"),
    "l'appui ne capture pas le pointeur — sinon le clic final change de cible");
  assert.ok(bloc("pointermove").includes("setPointerCapture"),
    "la capture a lieu une fois le seuil de glissement franchi");
  assert.match(src, /e\.target\.closest\(["'`]\.zoom-carte/,
    "un appui sur les boutons de zoom n'ouvre pas un glissement");
  assert.match(src, /e\.pointerType === "touch"/,
    "le tactile est écarté : il confisquerait le défilement de la page");
  // Le garde-fou de second rideau, si la capture n'a pas eu lieu.
  assert.match(src, /if \(!consommerGlissement\(\)\) choisir/,
    "un glissement qui finit sur une station ne la sélectionne pas");
  // Le centre est borné, pas la fenêtre : sinon on pousse dans le vide.
  assert.match(src, /function bornerCentre/, "le centre est borné");
  assert.match(src, /bornerCentre\(\{[\s\S]{0,200}?\}\);/, "le glissement passe par bornerCentre");
});
