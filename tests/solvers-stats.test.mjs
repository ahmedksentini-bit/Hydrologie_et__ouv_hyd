// Statistiques : noyau numérique contrôlé sur des valeurs de référence, lois
// contrôlées par des identités (une loi doit retrouver sa propre fréquence),
// tests d'hypothèses contrôlés sur des séries construites pour les déclencher.
import test from "node:test";
import assert from "node:assert/strict";
import * as n from "../src/stats-numerique.js";
import * as s from "../src/solvers-stats.js";

const proche = (a, b, tol, msg) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg} : ${a} vs ${b} (± ${tol})`);

const SERIE = [28, 62, 35, 19, 47, 88, 31, 24, 55, 41, 73, 22, 36, 110, 44, 29, 51, 38, 67, 26];

test("noyau numérique — valeurs de référence", () => {
  proche(n.erf(1), 0.8427007929497149, 1e-12, "erf(1)");
  proche(n.phi(0), 0.5, 1e-15, "Φ(0)");
  proche(n.phiInv(0.975), 1.959963984540054, 1e-9, "Φ⁻¹(0,975)");
  proche(n.phiInv(0.99), 2.3263478740408408, 1e-9, "Φ⁻¹(0,99)");
  proche(n.phiInv(0.95), 1.6448536269514722, 1e-9, "Φ⁻¹(0,95)");
  proche(n.lnGamma(5), Math.log(24), 1e-12, "ln Γ(5) = ln 4!");
  proche(n.gammaFn(0.5), Math.sqrt(Math.PI), 1e-12, "Γ(½) = √π");
  proche(n.gammaFn(6), 120, 1e-9, "Γ(6) = 5!");
  proche(n.studentInv(0.975, 10), 2.228138852, 1e-6, "t₀,₉₇₅(10)");
  proche(n.studentInv(0.975, 30), 2.042272456, 1e-6, "t₀,₉₇₅(30)");
  // aller-retour : Φ⁻¹ inverse bien Φ
  for (const z of [-3, -1.5, -0.2, 0.7, 2.4, 4]) proche(n.phiInv(n.phi(z)), z, 1e-8, `aller-retour z=${z}`);
  // la loi de Student tend vers la normale
  proche(n.studentInv(0.975, 100000), n.phiInv(0.975), 1e-3, "Student → normale");
});

test("moments et L-moments", () => {
  const m = n.moments([2, 4, 4, 4, 5, 5, 7, 9]);
  proche(m.moyenne, 5, 1e-12, "moyenne");
  proche(m.ecartType, Math.sqrt(32 / 7), 1e-12, "écart-type (n−1)");
  // une série symétrique a une asymétrie nulle
  proche(n.moments([1, 2, 3, 4, 5]).asymetrie, 0, 1e-12, "asymétrie d'une série symétrique");
  // λ₁ est la moyenne, et λ₂ d'un échantillon uniforme 1..n vaut (n+1)/6
  const L = n.lMoments([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  proche(L.l1, 5.5, 1e-12, "λ₁ = moyenne");
  proche(L.l2, 11 / 6, 1e-12, "λ₂ des entiers 1..10");
  proche(L.t3, 0, 1e-12, "t₃ d'une série symétrique");
});

test("chaque loi retrouve sa propre fréquence", () => {
  for (const loi of s.LOIS) {
    const a = s.ajuster(loi.id, SERIE);
    assert.ok(a, `${loi.nom} ajustée`);
    for (const T of [2, 10, 100]) {
      const x = a.quantile(T);
      const F = s.frequenceTheorique(a, x);
      proche(1 / (1 - F), T, T * 1e-4, `${loi.nom} : T retrouvé depuis x_${T}`);
    }
  }
});

test("Gumbel — forme fermée et cohérence avec la GEV", () => {
  const a = s.ajuster("gumbel", SERIE);
  const m = n.moments(SERIE);
  proche(a.params.a, (m.ecartType * Math.sqrt(6)) / Math.PI, 1e-12, "gradex");
  proche(a.params.u, m.moyenne - 0.5772156649 * a.params.a, 1e-12, "mode");
  proche(a.quantile(100), a.params.u + a.params.a * s.yGumbel(100), 1e-12, "x = u + a·y");
  // la médiane de Gumbel est u + a·ln(ln 2)⁻¹
  proche(a.quantile(2), a.params.u - a.params.a * Math.log(Math.log(2)), 1e-9, "médiane");
  // une GEV de forme nulle redonne exactement Gumbel
  const gev = { quantile: (T) => a.params.u - a.params.a * Math.log(-Math.log(1 - 1 / T)) };
  for (const T of [2, 50]) proche(gev.quantile(T), a.quantile(T), 1e-12, `GEV k=0 ≡ Gumbel à T=${T}`);
});

test("log-normale — identité exp(μ + σz)", () => {
  const a = s.ajuster("galton", SERIE);
  const m = n.moments(SERIE.map(Math.log));
  proche(a.params.mu, m.moyenne, 1e-12, "μ des logarithmes");
  for (const T of [5, 100])
    proche(a.quantile(T), Math.exp(m.moyenne + m.ecartType * n.phiInv(1 - 1 / T)), 1e-9,
      `quantile T=${T}`);
});

test("GEV par L-moments — retrouve les paramètres d'une GEV connue", () => {
  const hasard = n.alea(4321);
  for (const [XI, AL, K] of [[40, 15, -0.2], [40, 15, 0.15]]) {
    const inverse = (F) => XI + (AL * (1 - Math.pow(-Math.log(F), K))) / K;
    const ech = Array.from({ length: 4000 }, () => inverse(hasard() || 1e-12));
    const a = s.ajuster("gev", ech);
    proche(a.params.xi, XI, 0.6, `ξ (vrai ${XI})`);
    proche(a.params.alpha, AL, 0.6, `α (vrai ${AL})`);
    proche(a.params.k, K, 0.04, `k (vrai ${K})`);
  }
});

test("Pearson III — signale son propre hors-domaine", () => {
  assert.equal(s.ajuster("pearson3", SERIE).horsDomaine, false, "|Cs| < 2 sur la série d'école");
  // série très asymétrique : l'approximation de Wilson-Hilferty sort de son domaine
  const tordue = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 200];
  assert.equal(s.ajuster("pearson3", tordue).horsDomaine, true, "|Cs| > 2 signalé");
});

test("intervalle de Kite — propriétés attendues", () => {
  const ic = s.intervalleGumbel(SERIE, 100);
  assert.ok(ic.bas < ic.xT && ic.xT < ic.haut, "le quantile est dans son intervalle");
  proche(ic.xT - ic.bas, ic.haut - ic.xT, 1e-9, "intervalle symétrique");
  // K et delta recalculés indépendamment
  const K = ((s.yGumbel(100) - 0.5772156649) * Math.sqrt(6)) / Math.PI;
  proche(ic.K, K, 1e-12, "facteur de fréquence");
  proche(ic.delta, Math.sqrt(1 + 1.1396 * K + 1.1 * K * K), 1e-12, "δ de Kite");
  // l'intervalle s'élargit avec T et se resserre avec n
  const large = (T) => s.intervalleGumbel(SERIE, T).haut - s.intervalleGumbel(SERIE, T).bas;
  assert.ok(large(100) > large(10) && large(10) > large(2), "élargissement avec T");
  const double = SERIE.concat(SERIE);
  assert.ok(s.intervalleGumbel(double, 100).haut - s.intervalleGumbel(double, 100).bas < large(100),
    "resserrement quand la série s'allonge");
});

test("bootstrap — reproductible, et optimiste dans la queue haute", () => {
  const a = s.intervalleBootstrap(SERIE, "gumbel", 100);
  const b = s.intervalleBootstrap(SERIE, "gumbel", 100);
  assert.deepEqual(a, b, "même série, même graine, même intervalle");
  assert.ok(a.bas < a.xT && a.xT < a.haut, "le quantile est dans son intervalle");
  // Propriété structurelle : un rééchantillonnage ne peut pas produire une valeur
  // plus forte que la plus forte observée, donc il sous-estime la queue haute.
  const kite = s.intervalleGumbel(SERIE, 100);
  assert.ok(a.haut < kite.haut, "borne haute du bootstrap sous celle de Kite");
  // et la bande calculée en une passe redonne le même ordre de grandeur
  const bande = s.bandeBootstrap(SERIE, "gumbel", [100]);
  proche(bande[0].xT, a.xT, 1e-9, "même quantile central");
});

test("Mann-Kendall — cas extrêmes et pente de Sen", () => {
  const croissante = Array.from({ length: 20 }, (_, i) => 10 + 2 * i);
  const mk = s.mannKendall(croissante);
  assert.equal(mk.S, (20 * 19) / 2, "S maximal sur une série strictement croissante");
  proche(mk.sen, 2, 1e-12, "pente de Sen exacte");
  assert.ok(mk.p < 1e-6, "tendance détectée");
  assert.equal(mk.verdict, "hypothèse rejetée");
  // série miroir : S change de signe, p identique
  const decroissante = [...croissante].reverse();
  assert.equal(s.mannKendall(decroissante).S, -mk.S, "S antisymétrique");
  proche(s.mannKendall(decroissante).p, mk.p, 1e-12, "p identique");
  proche(s.mannKendall(decroissante).sen, -2, 1e-12, "pente opposée");
  // variance sans ex æquo
  proche(mk.variance, (20 * 19 * 45) / 18, 1e-9, "Var(S) sans ex æquo");
});

test("Wald-Wolfowitz — statistique recalculée à la main", () => {
  const ww = s.waldWolfowitz(SERIE);
  let R = SERIE[0] * SERIE[SERIE.length - 1];
  for (let i = 0; i < SERIE.length - 1; i++) R += SERIE[i] * SERIE[i + 1];
  proche(ww.R, R, 1e-9, "R");
  const s1 = SERIE.reduce((a, v) => a + v, 0), s2 = SERIE.reduce((a, v) => a + v * v, 0);
  proche(ww.esperance, (s1 * s1 - s2) / (SERIE.length - 1), 1e-9, "E(R)");
  assert.ok(ww.variance > 0, "variance positive");
  // l'ordre compte : une série triée est massivement autocorrélée
  const triee = [...SERIE].sort((a, b) => a - b);
  assert.ok(s.waldWolfowitz(triee).p < 0.01, "une série triée est rejetée");
});

test("Pettitt et Wilcoxon — rupture franche", () => {
  const rupture = [...Array(15).fill(30), ...Array(15).fill(70)]
    .map((v, i) => v + (i % 3) - 1);                 // légère variation, pas d'ex æquo massif
  const pt = s.pettitt(rupture);
  assert.equal(pt.tau, 15, "rupture localisée au bon rang");
  assert.ok(pt.p < 0.001, "rupture détectée");
  assert.match(pt.sens, /plus élevé après/, "sens de la rupture");
  assert.ok(s.wilcoxon(rupture).p < 0.001, "Wilcoxon aussi, la coupe étant au milieu");
  // série homogène : les deux conservent
  const plate = SERIE;
  assert.ok(s.pettitt(plate).p > 0.05 && s.wilcoxon(plate).p > 0.05, "série homogène conservée");
});

test("les séries d'école déclenchent bien ce qu'elles illustrent", () => {
  const lire = (t) => Object.fromEntries(
    s.controlerSerie(t).essais.map((e) => [e.test, e.p]));

  const tendance = "39 60 32 43 50 70 51 56 39 62 49 67 52 53 63 25 93 68 68 40 48 67 79 67 73 75 63 74 56 89"
    .split(" ").map(Number);
  let p = lire(tendance);
  assert.ok(p["Mann-Kendall"] < 0.01, "tendance : Mann-Kendall rejette");
  assert.ok(p["Wald-Wolfowitz"] > 0.05, "tendance : pas d'autocorrélation d'ordre 1");

  const rupture = "71 31 19 33 30 45 22 15 37 80 75 74 51 59 85 47 70 70 66 42 76 61 40 74 54 45 77 55 41 78"
    .split(" ").map(Number);
  p = lire(rupture);
  assert.ok(p["Pettitt"] < 0.05, "rupture précoce : Pettitt rejette");
  assert.ok(p["Wilcoxon-Mann-Whitney"] > 0.05,
    "rupture précoce : Wilcoxon, qui coupe au milieu, ne la voit pas");

  const persistante = "25 20 26 40 50 51 67 69 82 66 63 38 26 17 34 35 33 36 35 49 62 51 29 39 50 29 37 48 67 64"
    .split(" ").map(Number);
  p = lire(persistante);
  assert.ok(p["Wald-Wolfowitz"] < 0.01, "persistance : Wald-Wolfowitz rejette");
  assert.ok(p["Mann-Kendall"] > 0.1, "persistance : sans tendance");
  assert.ok(p["Pettitt"] > 0.1, "persistance : sans rupture");
});

test("Kolmogorov-Smirnov — classe les lois, et annonce sa limite", () => {
  const ks = s.ecartKs(SERIE, s.ajuster("gumbel", SERIE));
  assert.ok(ks.D > 0 && ks.D < 1, "écart dans [0,1]");
  proche(ks.critique5, 1.36 / Math.sqrt(SERIE.length), 1e-12, "valeur critique approchée");
  // une loi ajustée sur la série colle mieux qu'une loi décalée de force
  const decalee = { quantile: (T) => s.ajuster("gumbel", SERIE).quantile(T) + 40 };
  assert.ok(s.ecartKs(SERIE, decalee).D > ks.D, "une loi décalée s'écarte davantage");
});

test("niveau de confiance — chaque test dit à partir de quand il conserve", () => {
  // Un test rejette si p < α, donc conserve pour α ≤ p : le seuil est 1 − p.
  proche(s.niveauDeConfiance(0.05), 0.95, 1e-12, "p = 0,05");
  proche(s.niveauDeConfiance(0.6732), 1 - 0.6732, 1e-12, "un p élevé demande peu");
  // propriété : le niveau est décroissant en p, et un test défavorable EXIGE plus
  assert.ok(s.niveauDeConfiance(0.001) > s.niveauDeConfiance(0.5),
    "plus le test est défavorable, plus le niveau exigé est haut");

  const r = s.controlerSerie(SERIE);
  assert.equal(r.hypotheses.length, 3, "trois hypothèses, quatre tests");
  assert.deepEqual(r.hypotheses.map((h) => h.famille),
    ["stationnarité", "indépendance", "homogénéité"]);
  // l'homogénéité retient le plus défavorable de ses deux tests
  const homo = r.hypotheses.find((h) => h.famille === "homogénéité");
  assert.equal(homo.tests.length, 2, "Wilcoxon et Pettitt");
  proche(homo.p, Math.min(...homo.tests.map((t) => t.p)), 1e-12, "le pire des deux commande");
  // le niveau retenu est le maximum des trois
  proche(r.retenu.niveau, Math.max(...r.hypotheses.map((h) => h.niveau)), 1e-12,
    "niveau retenu = max des trois");
  proche(r.retenu.niveau, 1 - Math.min(...r.essais.map((e) => e.p)), 1e-12,
    "équivaut à 1 − min(p) sur tous les tests");
  // et il ne dépend PAS du seuil coché
  for (const seuil of [0.01, 0.05, 0.10])
    proche(s.controlerSerie(SERIE, seuil).retenu.niveau, r.retenu.niveau, 1e-12,
      `indépendant du seuil ${seuil}`);
});

test("niveau retenu — les séries d'école le commandent par le bon test", () => {
  const lire = (t) => s.controlerSerie(t).retenu;
  const tendance = "39 60 32 43 50 70 51 56 39 62 49 67 52 53 63 25 93 68 68 40 48 67 79 67 73 75 63 74 56 89"
    .split(" ").map(Number);
  let r = lire(tendance);
  assert.equal(r.famille, "stationnarité", "la tendance commande");
  assert.ok(r.niveau > 0.99, `niveau ${(r.niveau * 100).toFixed(2)} %`);

  const persistante = "25 20 26 40 50 51 67 69 82 66 63 38 26 17 34 35 33 36 35 49 62 51 29 39 50 29 37 48 67 64"
    .split(" ").map(Number);
  r = lire(persistante);
  assert.equal(r.famille, "indépendance", "la persistance commande");
  assert.equal(r.test, "Wald-Wolfowitz");

  const rupture = "71 31 19 33 30 45 22 15 37 80 75 74 51 59 85 47 70 70 66 42 76 61 40 74 54 45 77 55 41 78"
    .split(" ").map(Number);
  r = lire(rupture);
  assert.equal(r.famille, "homogénéité", "la rupture commande");
  assert.equal(r.test, "Pettitt", "et c'est Pettitt qui la trouve, pas Wilcoxon");

  // une série confortable demande un niveau modeste
  assert.ok(lire(SERIE).niveau < 0.8, "la série d'école tient sans effort");
});

test("niveau applicable — borné, et la borne se dit", () => {
  const brut = s.niveauApplicable(0.9998);
  proche(brut.niveau, 0.999, 1e-12, "abaissé au plafond");
  assert.equal(brut.borne, true);
  assert.equal(brut.sens, "abaissé");
  proche(brut.brut, 0.9998, 1e-12, "la valeur brute reste disponible");
  const bas = s.niveauApplicable(0.2);
  proche(bas.niveau, 0.50, 1e-12, "relevé au plancher");
  assert.equal(bas.sens, "relevé");
  const dedans = s.niveauApplicable(0.8787);
  assert.equal(dedans.borne, false);
  proche(dedans.niveau, 0.8787, 1e-12);
});

test("la propagation du doute élargit réellement l'intervalle", () => {
  const persistante = "25 20 26 40 50 51 67 69 82 66 63 38 26 17 34 35 33 36 35 49 62 51 29 39 50 29 37 48 67 64"
    .split(" ").map(Number);
  const large = (serie) => {
    const n = s.niveauApplicable(s.controlerSerie(serie).retenu.niveau).niveau;
    const ic = s.intervalleGumbel(serie, 100, n);
    return ic.haut - ic.bas;
  };
  const confortable = large(SERIE), suspecte = large(persistante);
  assert.ok(suspecte > 2 * confortable,
    `série suspecte ${suspecte.toFixed(1)} mm contre ${confortable.toFixed(1)} mm`);
  // à niveau conventionnel identique, la différence s'efface
  const a95 = s.intervalleGumbel(SERIE, 100, 0.95);
  const b95 = s.intervalleGumbel(persistante, 100, 0.95);
  assert.ok(b95.haut - b95.bas < a95.haut - a95.bas,
    "à 95 % pour les deux, la série suspecte paraît même plus sûre — c'est l'effacement qu'on évite");
});
