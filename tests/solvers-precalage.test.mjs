// Le précalage : la chaîne « largeur de la voie → longueur → cotes → pente ».
// Les trois effets à contre-sens du cours sont recalculés ici : si un chiffre
// publié bouge, ce test tombe.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { empriseRoute, precaler, regimeDePente } from "../src/solvers-dimensionnement.js";
import { sectionRectangulaire, sectionCirculaire, penteCritique, froude,
         profondeurNormale, G } from "../src/solvers-ouvrages.js";

const proche = (obtenu, attendu, tol, msg) =>
  assert.ok(Math.abs(obtenu - attendu) <= tol,
    `${msg} : ${obtenu} attendu ${attendu} ± ${tol}`);

const BASE = {
  chaussee: 7, accotement: 1.5, hauteurRemblai: 2.5, fruitTalus: 1.5, biaisDeg: 75,
  zTnEntree: 124.85, zTnSortie: 124.71, decaissement: 0.2, hauteurOuvrage: 1.5,
};

test("emprise de la route — plate-forme et pieds de talus", () => {
  const e = empriseRoute({ chaussee: 7, accotement: 1.5, hauteurRemblai: 2.5, fruitTalus: 1.5 });
  proche(e.plateforme, 10, 1e-12, "plate-forme");
  proche(e.emprise, 17.5, 1e-12, "emprise de pied à pied");
});

test("l'ouvrage est plus court que l'emprise, et la boucle converge", () => {
  const r = precaler(BASE);
  // Les têtes se posent là où l'intrados perce le talus, pas au pied.
  proche(r.couvertureAmont, 1.13, 5e-3, "couverture amont");
  proche(r.couvertureAval, 1.27, 5e-3, "couverture aval");
  proche(r.L, 14.68, 0.01, "longueur entre nus des têtes");
  assert.ok(r.L < r.emprise, "l'ouvrage ne peut pas être plus long que l'emprise");
  proche(r.J * 100, 0.954, 2e-3, "pente précalée");
  proche(r.zRadierAmont, 124.65, 1e-9, "radier d'entrée");
  proche(r.zRadierAval, 124.51, 1e-9, "radier de sortie");
  // La chute est celle du levé : c'est L qui absorbe la boucle, pas la chute.
  proche(r.zRadierAmont - r.zRadierAval, 0.14, 1e-9, "chute conservée");
  // La « boucle » a une solution fermée : c_aval = c_amont + chute.
  proche(r.couvertureAval - r.couvertureAmont, r.chute, 1e-12, "les deux couvertures");
  assert.ok(r.valide);
});

test("un décaissement ALLONGE l'ouvrage et ADOUCIT la pente", () => {
  // Le raisonnement spontané — « les deux bouts descendent d'autant, la pente
  // ne bouge pas » — est juste sur la chute et faux sur la pente.
  const a = precaler({ ...BASE, decaissement: 0 });
  const b = precaler({ ...BASE, decaissement: 0.8 });
  proche(a.L, 14.06, 0.01, "L sans décaissement");
  proche(b.L, 16.54, 0.01, "L à 0,80 m de décaissement");
  proche(a.J * 100, 0.996, 2e-3, "J sans décaissement");
  proche(b.J * 100, 0.846, 2e-3, "J à 0,80 m");
  proche(a.chute, b.chute, 1e-12, "la chute, elle, ne bouge pas");
  assert.ok(b.L > a.L && b.J < a.J, "plus profond ⇒ plus long ⇒ moins pentu");
});

test("un ouvrage plus HAUT est plus COURT, donc plus raide", () => {
  const bas = precaler({ ...BASE, hauteurOuvrage: 1.0 });
  const haut = precaler({ ...BASE, hauteurOuvrage: 2.0 });
  proche(bas.L, 16.23, 0.01, "L à D = 1,00");
  proche(haut.L, 13.13, 0.01, "L à D = 2,00");
  proche(bas.J * 100, 0.862, 2e-3, "J à D = 1,00");
  proche(haut.J * 100, 1.067, 2e-3, "J à D = 2,00");
  assert.ok(haut.L < bas.L && haut.J > bas.J);
});

test("élargir l'accotement adoucit la pente", () => {
  const large = precaler({ ...BASE, accotement: 2.0 });
  proche(large.L, 15.72, 0.01, "L avec 2,00 m d'accotement");
  proche(large.J * 100, 0.891, 2e-3, "J avec 2,00 m d'accotement");
});

test("le biais allonge exactement de 1/sin", () => {
  const droit = precaler({ ...BASE, biaisDeg: 90 });
  const biais = precaler({ ...BASE, biaisDeg: 75 });
  proche(droit.allongement, 1, 1e-12, "un ouvrage droit ne s'allonge pas");
  proche(biais.allongement, 1 / Math.sin((75 * Math.PI) / 180), 1e-12, "allongement");
  // Hors épaisseurs de tête, le rapport des longueurs EST 1/sin — les
  // couvertures ne dépendent pas du biais.
  proche((biais.L - 0.6) / (droit.L - 0.6), biais.allongement, 1e-9, "rapport des longueurs");
});

test("un remblai trop bas est refusé, et dit pourquoi", () => {
  const r = precaler({ ...BASE, hauteurRemblai: 1.2 });
  assert.equal(r.valide, false);
  assert.match(r.motif, /ne passe pas sous ce remblai/);
  assert.match(r.motif, /0,17 m/, "le message est en français, virgule comprise");
});

test("pente critique — la formule à la main, sur une section rectangulaire", () => {
  const b = 2, q = 6, K = 70;
  const yc = Math.cbrt((q * q) / (G * b * b));
  const A = b * yc, P = b + 2 * yc;
  const attendu = Math.pow(q / (K * A * Math.pow(A / P, 2 / 3)), 2);
  proche(penteCritique(sectionRectangulaire(b, 1.5), q, K), attendu, 1e-12, "I_c");
  proche(attendu * 100, 0.500, 1e-3, "I_c en % — chiffre publié");
});

test("la rugosité choisie déplace la bascule d'un facteur trois", () => {
  const sec = sectionRectangulaire(2, 1.5);
  proche(penteCritique(sec, 6, 90) * 100, 0.302, 1e-3, "K = 90");
  proche(penteCritique(sec, 6, 50) * 100, 0.979, 1e-3, "K = 50");
  proche(penteCritique(sec, 6, 50) / penteCritique(sec, 6, 90), Math.pow(90 / 50, 2), 1e-9,
    "I_c varie en 1/K²");
});

test("une buse trop petite pour son débit est presque toujours fluviale", () => {
  proche(penteCritique(sectionCirculaire(0.8), 2, 70) * 100, 2.414, 2e-3, "Ø0,80 à 2 m³/s");
  proche(penteCritique(sectionCirculaire(0.8), 3, 70) * 100, 5.784, 2e-3, "Ø0,80 à 3 m³/s");
});

test("pente, tirant et Froude basculent ensemble", () => {
  // C'est le même fait dit trois fois. Si les trois ne s'accordaient pas, l'un
  // des trois calculs serait faux.
  const cas = [
    ["dalot 2,00×1,50", sectionRectangulaire(2, 1.5), 6],
    ["dalot 3,00×2,00", sectionRectangulaire(3, 2), 4],
    ["buse Ø1,50", sectionCirculaire(1.5), 2],
  ];
  for (const [nom, sec, q] of cas) {
    const K = 70, Ic = penteCritique(sec, q, K), yc = sec.profondeurCritique(q);
    for (const f of [0.4, 0.8, 0.95, 1.05, 1.3, 2.5]) {
      const J = Ic * f;
      const yn = profondeurNormale(sec, q, K, J);
      const Fr = froude(sec, Math.min(yn, sec.hauteur), q);
      const parLaPente = regimeDePente(J, Ic).regime;
      assert.equal(parLaPente, f > 1 ? "torrentiel" : "fluvial", `${nom} à J/Ic=${f}`);
      assert.equal(yn > yc ? "fluvial" : "torrentiel", parLaPente,
        `${nom} à J/Ic=${f} : le tirant contredit la pente`);
      assert.equal(Fr < 1 ? "fluvial" : "torrentiel", parLaPente,
        `${nom} à J/Ic=${f} : Froude contredit la pente`);
    }
  }
});

test("le tableau des trois effets publié dans le cours vient bien du solveur", () => {
  const html = readFileSync(new URL("../cours.html", import.meta.url), "utf-8");
  const bloc = html.slice(html.indexOf("Trois effets à contre-sens"),
                          html.indexOf("Fluvial ou torrentiel"));
  const lignes = [
    [precaler({ ...BASE, decaissement: 0 }), precaler({ ...BASE, decaissement: 0.8 })],
    [precaler({ ...BASE, hauteurOuvrage: 1.0 }), precaler({ ...BASE, hauteurOuvrage: 2.0 })],
    [precaler(BASE), precaler({ ...BASE, accotement: 2.0 })],
  ];
  const fr2 = (x) => x.toFixed(2).replace(".", ",");
  const fr3 = (x) => x.toFixed(3).replace(".", ",");
  for (const [a, b] of lignes) {
    assert.ok(bloc.includes(`${fr2(a.L)} → ${fr2(b.L)} m`),
      `longueurs ${fr2(a.L)} → ${fr2(b.L)} absentes du cours`);
    assert.ok(bloc.includes(`${fr3(a.J * 100)} → ${fr3(b.J * 100)} %`),
      `pentes ${fr3(a.J * 100)} → ${fr3(b.J * 100)} absentes du cours`);
  }
});

test("aligner l'ouvrage sur le talweg coûte exactement 1/sin de longueur", () => {
  // Le tableau d'arbitrage publié dans le cours, recalculé.
  const droit = precaler({ ...BASE, biaisDeg: 90 });
  proche(droit.L, 14.20, 0.01, "ouvrage droit");
  const attendus = [[80, 14.41], [70, 15.07], [60, 16.30], [50, 18.35], [40, 21.76]];
  const html = readFileSync(new URL("../cours.html", import.meta.url), "utf-8");
  const bloc = html.slice(html.indexOf("Aligner l'ouvrage sur l'écoulement"),
                          html.indexOf("Le second maillon est le levé"));
  for (const [angle, L] of attendus) {
    const r = precaler({ ...BASE, biaisDeg: angle });
    proche(r.L, L, 0.01, `aligné sur un talweg à ${angle}°`);
    assert.ok(bloc.includes(`${L.toFixed(2).replace(".", ",")} m`),
      `la longueur ${L} m à ${angle}° manque au tableau du cours`);
    assert.ok(bloc.includes(`+${(L - droit.L).toFixed(2).replace(".", ",")} m`),
      `le surcoût à ${angle}° manque au tableau du cours`);
  }
});

test("rehausser la chaussée allonge l'ouvrage de 2m/sin(biais) par mètre", () => {
  // Le fruit des talus est constant : un mètre de remblai en plus donne un
  // mètre de couverture en plus à CHAQUE bout.
  for (const [m, biais] of [[1.5, 70], [1.5, 90], [2, 60], [1, 110]]) {
    const pente = (2 * m) / Math.sin((biais * Math.PI) / 180);
    const a = precaler({ ...BASE, fruitTalus: m, biaisDeg: biais, hauteurRemblai: 2.5 });
    const b = precaler({ ...BASE, fruitTalus: m, biaisDeg: biais, hauteurRemblai: 3.5 });
    proche(b.L - a.L, pente, 1e-9, `dL/dH à m=${m}, biais=${biais}°`);
    assert.ok(b.J < a.J, "rehausser adoucit la pente, puisque la chute ne change pas");
  }
  // Le chiffre cité dans le cours.
  proche((2 * 1.5) / Math.sin((70 * Math.PI) / 180), 3.19, 5e-3, "3,19 m par mètre");
});

test("le désalignement ne change ni la pente critique ni le régime", () => {
  // Il coûte de la charge et de l'affouillement, pas un changement de régime :
  // I_c ne dépend que de la section, du débit et de la rugosité.
  const sec = sectionRectangulaire(2, 1.5);
  const Ic = penteCritique(sec, 6, 70);
  for (const biais of [50, 70, 90, 110]) {
    proche(penteCritique(sec, 6, 70), Ic, 0, `I_c indépendante du biais (${biais}°)`);
  }
  // En revanche le biais change J, donc il PEUT faire basculer le régime.
  const raide = precaler({ ...BASE, biaisDeg: 90 });
  const long = precaler({ ...BASE, biaisDeg: 40 });
  assert.ok(long.J < raide.J, "un ouvrage plus biais est plus long, donc moins pentu");
  proche(raide.J * 100, 0.986, 2e-3, "J d'un ouvrage droit");
  proche(long.J * 100, 0.643, 2e-3, "J à 40° de biais");
});
