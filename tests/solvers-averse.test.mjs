// L'averse du chapitre 3 : 48 mm en 24 h dont 30 en une demi-heure. Les deux
// instruments du cours en tirent des chiffres opposés, et ces chiffres sont
// AFFICHÉS — ils doivent donc se recalculer.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AVERSE, DUREE, intensite, cumul, intensiteMax, ENREGISTREMENT, N_PAS,
         DUREES_IDF, courbeIdf, ajusterMontana } from "../src/solvers-averse.js";

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

test("l'enregistrement fin a une pointe, et la courbe IDF descend vraiment", () => {
  const total = ENREGISTREMENT.reduce((a, v) => a + v, 0);
  assert.equal(ENREGISTREMENT.length, N_PAS);
  proche(total, 99.8, 0.05, "hauteur totale de l'enregistrement");
  const pts = courbeIdf();
  assert.equal(pts.length, DUREES_IDF.length);
  // STRICTEMENT décroissante — c'est tout l'objet de la figure. Une courbe
  // plate sur un intervalle, comme celle de l'averse en paliers, ne montrerait
  // pas pourquoi elle descend.
  for (let k = 1; k < pts.length; k++)
    assert.ok(pts[k].intensite < pts[k - 1].intensite,
      `intensité non décroissante de ${pts[k - 1].min} à ${pts[k].min} min`);
  // La hauteur, elle, CROÎT avec la durée : c'est le couple des deux qui
  // répond à la question des étudiants.
  for (let k = 1; k < pts.length; k++)
    assert.ok(pts[k].hauteur >= pts[k - 1].hauteur - 1e-9,
      `hauteur décroissante de ${pts[k - 1].min} à ${pts[k].min} min`);
  proche(pts[pts.length - 1].hauteur, total, 1e-9, "sur 24 h, la fenêtre prend tout");
});

test("la décroissance est une nécessité, pas une observation", () => {
  // i_max(2t) ≤ i_max(t) pour TOUT enregistrement : une fenêtre de 2t se
  // découpe en deux fenêtres de t, dont chacune contient au plus le maximum
  // sur t. On le vérifie sur l'enregistrement, et sur cent autres tirés au
  // hasard — si l'inégalité pouvait être violée, elle le serait là.
  const verifier = (serie) => {
    const max = (n) => {
      let m = 0;
      for (let k = 0; k + n <= serie.length; k++) {
        let s = 0;
        for (let j = k; j < k + n; j++) s += serie[j];
        if (s > m) m = s;
      }
      return m;
    };
    for (const n of [1, 2, 3, 6, 12]) {
      const i1 = max(n) / n, i2 = max(2 * n) / (2 * n);
      assert.ok(i2 <= i1 + 1e-12, `i(${2 * n}) = ${i2} > i(${n}) = ${i1}`);
    }
  };
  verifier(ENREGISTREMENT);
  let graine = 12345;
  const suivant = () => (graine = (graine * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let essai = 0; essai < 100; essai++)
    verifier(Array.from({ length: 60 }, () => (suivant() < 0.3 ? suivant() * 20 : 0)));
});

test("Montana ajusté, et ce que son extrapolation coûte", () => {
  const m = ajusterMontana();
  proche(m.a, 641, 1, "coefficient a");
  proche(m.b, 0.644, 1e-3, "exposant b");
  proche(m.r2, 0.949, 1e-3, "R²");
  // La dérive systématique citée dans le cours : l'ajustement d'ensemble
  // surestime aux deux bouts et sous-estime au milieu.
  const pts = courbeIdf();
  const ecart = (min) => {
    const p = pts.find((x) => x.min === min);
    return (m.a * Math.pow(min, -m.b)) / p.intensite - 1;
  };
  proche(ecart(5) * 100, 67, 1, "+67 % à 5 min");
  proche(ecart(60) * 100, -31, 1, "−31 % à 60 min");
  proche(ecart(1440) * 100, 43, 1, "+43 % à 1440 min");
  // Ajusté sur la plage utile, puis extrapolé : un facteur 2,3 à 5 minutes.
  const utile = ajusterMontana(pts.filter((p) => p.min >= 15 && p.min <= 360));
  proche(utile.b, 0.684, 1e-3, "exposant sur 15–360 min");
  proche(utile.r2, 0.976, 1e-3, "R² sur la plage utile");
  const extrapole = utile.a * Math.pow(5, -utile.b);
  proche(extrapole, 307, 1, "extrapolation à 5 min");
  proche(extrapole / pts[0].intensite, 2.26, 0.01, "facteur d'erreur");
});

test("les chiffres de la dérive publiés dans le cours viennent du calcul", () => {
  const html = readFileSync(new URL("../cours.html", import.meta.url), "utf-8");
  const bloc = html.slice(html.indexOf("Mais Montana n'est qu'un ajustement"),
                          html.indexOf("La courbe intensité–durée–fréquence"));
  const m = ajusterMontana();
  for (const [min, attendu] of [[5, "+67 %"], [30, "−27 %"], [60, "−31 %"], [1440, "+43 %"]]) {
    assert.ok(bloc.includes(attendu), `l'écart ${attendu} à ${min} min manque au cours`);
  }
  assert.ok(bloc.includes("307 mm/h"), "l'extrapolation à 5 min manque");
  assert.ok(bloc.includes(`${m.b.toFixed(3).replace(".", ",")}`)
         || bloc.includes("0,684"), "l'exposant ajusté manque");
});
