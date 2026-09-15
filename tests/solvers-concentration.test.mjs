// Le temps de concentration calculé par cheminement, sur le bassin du cours.
// Il ne remplace pas les formules empiriques : il montre d'où elles viennent,
// et jusqu'où elles s'accordent.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tempsDeParcours, surfaceTemps, hydrogramme, semisGouttes, positionGoutte, VITESSES }
  from "../src/solvers-concentration.js";
import * as h from "../src/solvers-hydro.js";

const BASSIN = JSON.parse(readFileSync(new URL("../data/bassin-demo.json", import.meta.url)));
const carte = tempsDeParcours(BASSIN);

const proche = (a, b, tol, msg) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg} : ${a} attendu ${b} ± ${tol}`);

test("le cheminement couvre exactement le bassin", () => {
  // Chaque maille intérieure reçoit un temps : une maille sans temps serait
  // une maille qui ne s'écoule nulle part, donc une erreur de réseau.
  proche(carte.mailles * carte.aireMaille, BASSIN.aire, 0.02, "aire reconstituée");
  for (let i = 0; i < carte.temps.length; i++)
    if (carte.dedans[i]) assert.ok(Number.isFinite(carte.temps[i]), `maille ${i} sans temps`);
  // Le temps est nul à l'exutoire et maximal au point le plus éloigné.
  const [xe, ye] = BASSIN.exutoire;
  proche(carte.temps[ye * carte.nx + xe], 0, 1e-9, "temps à l'exutoire");
  const [xl, yl] = carte.pointLePlusLoin;
  proche(carte.temps[yl * carte.nx + xl], carte.tc, 1e-9, "le tc est bien au point le plus loin");
});

test("tc croît quand les vitesses baissent, et dans le bon rapport", () => {
  const lent = tempsDeParcours(BASSIN, { versant: 0.2, reseau: 1.0 });
  const rapide = tempsDeParcours(BASSIN, { versant: 0.5, reseau: 2.0 });
  assert.ok(lent.tc > carte.tc && carte.tc > rapide.tc, "monotonie");
  proche(carte.tc, 166, 1, "tc du cas courant");
  proche(lent.tc, 217, 1, "tc versants rugueux");
  proche(rapide.tc, 100, 1, "tc bassin raide");
});

test("cheminement et formules empiriques se recoupent", () => {
  // C'est l'argument du cours : deux routes, même ordre de grandeur, même aveu.
  const { L } = h.rectangleEquivalent(BASSIN.aire, BASSIN.perimetre);
  const { Hmax, Hmin, Hmoy } = BASSIN.altitudes;
  const iPct = ((Hmax - Hmin) / (L * 1000)) * 100;
  const empiriques = [
    h.kirpich(L * 1000, Hmax - Hmin),
    h.ventura(BASSIN.aire, iPct),
    h.passini(BASSIN.aire, L, iPct) * 60,
    h.giandotti(BASSIN.aire, L, Hmoy - Hmin) * 60,
  ];
  const min = Math.min(...empiriques), max = Math.max(...empiriques);
  proche(min, 92, 1, "la plus courte des quatre");
  proche(max, 221, 1, "la plus longue des quatre");
  // Le tc cinématique du cas courant tombe dans l'éventail des formules.
  assert.ok(carte.tc > min && carte.tc < max,
    `tc cinématique ${carte.tc} hors de [${min}, ${max}]`);
  // Et l'éventail des quatre formules est du même ordre que celui des vitesses.
  const parVitesse = [[0.2, 1.0], [0.5, 2.0]].map(([v, r]) =>
    tempsDeParcours(BASSIN, { versant: v, reseau: r }).tc);
  assert.ok(Math.abs(max / min - Math.max(...parVitesse) / Math.min(...parVitesse)) < 0.6,
    "les deux dispersions sont comparables");
});

test("la surface contributive croît jusqu'à tout le bassin", () => {
  const c = surfaceTemps(carte, 40);
  // À t = 0 une seule maille contribue : celle de l'exutoire, dont le temps de
  // parcours est nul. Ce n'est pas un défaut, c'est la définition.
  proche(c[0].part * carte.mailles, 1, 1e-9, "une seule maille à t = 0");
  proche(c[c.length - 1].part, 1, 1e-9, "tout à tc");
  for (let k = 1; k < c.length; k++)
    assert.ok(c[k].part >= c[k - 1].part - 1e-12, `décroissance en ${c[k].t}`);
});

test("une averse plus longue que tc n'augmente pas la pointe", () => {
  const c = surfaceTemps(carte, 80);
  const pointe = (duree) => {
    const Q = hydrogramme(carte, c, { duree });
    let m = 0;
    for (let t = 0; t <= duree + carte.tc; t += carte.tc / 200) m = Math.max(m, Q(t));
    return m;
  };
  const court = pointe(carte.tc * 0.4);
  const juste = pointe(carte.tc);
  const long = pointe(carte.tc * 2);
  assert.ok(court < juste * 0.95, "une averse trop courte ne mobilise pas tout le bassin");
  proche(long, juste, juste * 1e-6, "au-delà de tc, la pointe ne bouge plus");
});

test("les gouttes arrivent, et la dernière arrive à tc", () => {
  const g = semisGouttes(carte, 40);
  const derniere = g[g.length - 1];
  proche(derniere[0].t, carte.tc, 1e-9, "la dernière goutte part de tc");
  assert.equal(positionGoutte(derniere, carte.tc + 1), null, "elle est arrivée après tc");
  assert.ok(positionGoutte(derniere, carte.tc - 1), "elle est encore en route avant tc");
  for (const chemin of g) {
    for (let k = 1; k < chemin.length; k++)
      assert.ok(chemin[k].t < chemin[k - 1].t, "le temps restant décroît le long du chemin");
    proche(chemin[chemin.length - 1].t, 0, 1e-6, "toute goutte finit à l'exutoire");
  }
});

test("les chiffres publiés dans le cours viennent du calcul", () => {
  const html = readFileSync(new URL("../cours.html", import.meta.url), "utf-8");
  const bloc = html.slice(html.indexOf("Le cheminement, sur le bassin du chapitre 1"),
                          html.indexOf("Les quatre temps de concentration"));
  const lent = tempsDeParcours(BASSIN, { versant: 0.2, reseau: 1.0 }).tc;
  const rapide = tempsDeParcours(BASSIN, { versant: 0.5, reseau: 2.0 }).tc;
  assert.ok(bloc.includes(`de ${Math.round(rapide)} à ${Math.round(lent)} min`),
    `l'éventail ${Math.round(rapide)}–${Math.round(lent)} min doit être celui du cours`);
  assert.equal(VITESSES.versant, 0.3);
  assert.equal(VITESSES.reseau, 1.2);
});
