// La chronique de vingt ans du chapitre 2. Elle doit être déterministe, avoir
// la saisonnalité qu'on lui prête, et surtout : ses maxima annuels doivent être
// EXACTEMENT la série que le calculateur ajuste. Sans cela, la figure
// raconterait l'histoire d'un autre poste que celui qu'on ajuste.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chronique, statistiques, moisDe, MOIS, JOURS_AN } from "../src/solvers-chronique.js";

const SERIE = [28, 62, 35, 19, 47, 88, 31, 24, 55, 41, 73, 22, 36, 110, 44, 29, 51, 38, 67, 26];

test("les maxima de la chronique SONT la série ajustée", () => {
  const c = chronique(SERIE);
  assert.equal(c.jours.length, SERIE.length * JOURS_AN);
  for (const [a, attendu] of SERIE.entries()) {
    const annee = c.jours.slice(a * JOURS_AN, (a + 1) * JOURS_AN);
    assert.equal(Math.max(...annee), attendu, `maximum de l'an ${a + 1}`);
    // Et il est unique : une seule journée porte cette valeur.
    assert.equal(annee.filter((v) => v === attendu).length, 1, `unicité, an ${a + 1}`);
    assert.equal(c.maxima[a].valeur, attendu);
    assert.equal(c.jours[c.maxima[a].jour], attendu, "le repère pointe le bon jour");
  }
});

test("déterminisme : deux appels donnent la même chronique", () => {
  const a = chronique(SERIE), b = chronique(SERIE);
  assert.deepEqual(a.jours, b.jours);
  // …et une graine différente donne autre chose, sinon le tirage ne sert à rien.
  assert.notDeepEqual(chronique(SERIE, 7).jours, a.jours);
});

test("la saisonnalité est celle d'un climat méditerranéen", () => {
  const st = statistiques(chronique(SERIE));
  // Une large majorité de jours secs : c'est ce que la figure doit montrer.
  assert.ok(st.partSecs > 0.8 && st.partSecs < 0.95, `part de jours secs ${st.partSecs}`);
  assert.ok(st.totalAnnuel > 250 && st.totalAnnuel < 500, `${st.totalAnnuel} mm/an`);
  // Des jours du calendrier n'ont JAMAIS vu la pluie en vingt ans, et ils sont
  // en été — c'est le point de la troisième figure.
  assert.ok(st.jamais > 30, `${st.jamais} jours jamais pluvieux`);
  const enEte = st.profil.map((v, j) => [v, moisDe(j)]).filter(([v]) => v === 0)
    .filter(([, m]) => m >= 4 && m <= 8).length;
  assert.ok(enEte / st.jamais > 0.8, "les jours jamais pluvieux sont en été");
  // Il pleut nettement plus en hiver qu'en été.
  const part = (mois) => st.profil.filter((_, j) => mois.includes(moisDe(j)))
    .reduce((a, v) => a + v, 0);
  assert.ok(part([11, 0, 1]) > 4 * part([5, 6, 7]), "hiver bien plus arrosé que l'été");
});

test("les maxima tombent en saison humide", () => {
  const c = chronique(SERIE);
  const hors = c.maxima.filter((m) => { const mo = moisDe(m.jourAn); return mo > 2 && mo < 8; });
  assert.equal(hors.length, 0, "aucun maximum annuel entre avril et août");
});

test("le cours et la chronique disent le même nombre de jours", () => {
  const st = statistiques(chronique(SERIE));
  assert.equal(st.jours, 7300);
  assert.equal(st.retenus, 20);
  assert.ok(st.partRetenue < 0.003, "moins de trois millièmes des jours");
  const html = readFileSync(new URL("../cours.html", import.meta.url), "utf-8");
  assert.match(html, /moins de trois\s*\n?\s*millièmes des jours observés/,
    "la phrase du cours doit rester vraie");
  assert.equal(MOIS.reduce((a, v) => a + v, 0), JOURS_AN, "les mois font bien une année");
});
