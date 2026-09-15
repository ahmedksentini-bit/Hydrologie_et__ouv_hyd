// L'averse du chapitre 3 : 48 mm en 24 h dont 30 en une demi-heure. Les deux
// instruments du cours en tirent des chiffres opposés, et ces chiffres sont
// AFFICHÉS — ils doivent donc se recalculer.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AVERSE, DUREE, intensite, cumul, intensiteMax } from "../src/solvers-averse.js";

const proche = (a, b, tol, msg) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg} : ${a} attendu ${b} ± ${tol}`);

test("l'averse est continue et totalise 48 mm", () => {
  // Les segments doivent se toucher : un trou laisserait une intensité
  // indéfinie, et un recouvrement compterait la pluie deux fois.
  for (let k = 1; k < AVERSE.length; k++)
    assert.equal(AVERSE[k][0], AVERSE[k - 1][1], `raccord au segment ${k}`);
  assert.equal(AVERSE[0][0], 0);
  assert.equal(AVERSE[AVERSE.length - 1][1], DUREE);
  proche(cumul(DUREE), 48, 1e-9, "hauteur totale");
  proche(cumul(0), 0, 0, "rien avant le début");
  // Le cumul est croissant, et il ne bouge que quand il pleut.
  for (let t = 0; t < DUREE; t += 0.05)
    assert.ok(cumul(t + 0.05) >= cumul(t) - 1e-12, `cumul décroissant en t=${t}`);
});

test("le facteur 30 entre les deux instruments", () => {
  const moyenne = cumul(DUREE) / DUREE;
  proche(moyenne, 2.0, 1e-9, "intensité moyenne — ce que donne un pluviomètre");
  proche(intensiteMax(0.5), 60, 1e-6, "pointe sur 30 min — ce que donne un pluviographe");
  proche(intensiteMax(0.5) / moyenne, 30, 1e-6, "facteur entre les deux");
  // Le maximum décroît quand la fenêtre s'élargit : c'est la propriété qui
  // fait exister les courbes IDF.
  const durees = [5 / 60, 15 / 60, 0.5, 1, 2, 6, 24];
  for (let k = 1; k < durees.length; k++)
    assert.ok(intensiteMax(durees[k]) <= intensiteMax(durees[k - 1]) + 1e-9,
      `i max doit décroître de ${durees[k - 1]} h à ${durees[k]} h`);
  proche(intensiteMax(1), 31.5, 1e-6, "pointe horaire");
  proche(intensiteMax(DUREE), moyenne, 1e-9, "sur 24 h, le maximum EST la moyenne");
});

test("les chiffres publiés dans le cours viennent de cette averse", () => {
  const html = readFileSync(new URL("../cours.html", import.meta.url), "utf-8");
  const bloc = html.slice(html.indexOf("La même averse, vue par les deux"),
                          html.indexOf("La courbe intensité–durée–fréquence"));
  const moyenne = cumul(DUREE) / DUREE;
  assert.ok(bloc.includes(`${cumul(DUREE).toFixed(1).replace(".", ",")} mm`), "48,0 mm");
  assert.ok(bloc.includes(`${intensiteMax(0.5).toFixed(1).replace(".", ",")} mm/h`), "60,0 mm/h");
  assert.ok(bloc.includes(`${moyenne.toFixed(1).replace(".", ",")} mm/h`), "2,0 mm/h");
  assert.ok(bloc.includes(`facteur ${Math.round(intensiteMax(0.5) / moyenne)}`), "facteur 30");
});
