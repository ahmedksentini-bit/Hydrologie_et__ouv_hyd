// Jeu FAO 54 : les méthodes d'Afrique de l'Ouest et centrale.
//
// Bulletin FAO d'irrigation et de drainage n° 54, « Crues et apports »,
// CIEH / ORSTOM / Cemagref, Rome 1996. Deux méthodes décennales indépendantes
// — des régressions (CIEH) et une chaîne analytique (ORSTOM) — que le manuel
// demande de confronter, jamais de moyenner avec autre chose.
//
// RÈGLE CENTRALE, à ne jamais relâcher : ce jeu et le jeu tunisien des
// chapitres 3 et 4 sont EXCLUSIFS. Grandeurs d'entrée différentes, domaines
// différents, régionalisations différentes. On ne met pas un débit de Ghorbel
// et un débit CIEH dans la même médiane, et on ne les affiche pas côte à côte
// comme comparables. Un test l'interdit.
//
// Les deux tables de référence (cieh-fao54.json, orstom-fao54.json) sont des
// RELEVÉS VISUELS des pages rendues du scan : la couche OCR du bulletin est
// fausse sur ces pages (colonnes décalées, Pan^-0,57 pour Pan^-0,67). Ne jamais
// les régénérer par OCR. Elles viennent de BVTrace, où 41 contrôles
// reproduisent les exemples chiffrés du manuel.

// ── Abattement, commun aux deux méthodes ───────────────────────────────────

/**
 * Équation 1.9 (Vuillaume), page 17 : A = 1 − [(161 − 0,042·Pan)/1000] · log₁₀(S).
 * C'est la MÊME que celle du chapitre 2 — elle est ici pour que le module se
 * suffise à lui-même, et un test vérifie que les deux ne divergent pas.
 */
export const abattement = (panMm, sKm2) =>
  sKm2 > 0 ? 1 - ((161 - 0.042 * panMm) / 1000) * Math.log10(sKm2) : 1;

/** Pluie journalière décennale moyennée sur le bassin : Pm10 = P10 · A. */
export const pm10De = (p10Mm, panMm, sKm2) =>
  p10Mm > 0 && sKm2 > 0 ? p10Mm * abattement(panMm, sKm2) : null;

// ── CIEH : des régressions, et le droit de s'en servir ─────────────────────

/** Les variables que telle régression exige, dans l'ordre de l'équation 4.1. */
export function variablesDe(reg) {
  const v = [];
  if (reg.s !== undefined) v.push("S");
  if (reg.ig !== undefined) v.push("Ig");
  if (reg.pm10 !== undefined) v.push("Pm10");
  if (reg.kr10 !== undefined) v.push("Kr10");
  if (reg.dd !== undefined) v.push("Dd");
  return v;
}

/**
 * Q10 = a · S^s · Ig^i · Pm10^pm · Kr10^k · Dd^d  (équation 4.1).
 *
 * Kr10 entre EN POURCENT (32 pour 32 %), conformément aux exemples du manuel.
 * Toute variable exigée mais absente annule le calcul avec son motif : jamais
 * de valeur par défaut, jamais d'extrapolation. Aucune régression ne porte
 * d'exposant sur Pan — la pluie annuelle ne sert qu'à choisir la zone.
 */
export function ciehQ10(reg, e) {
  const manque = [];
  if (reg.s !== undefined && !(e.S > 0)) manque.push("S");
  if (reg.ig !== undefined && !(e.Ig > 0)) manque.push("Ig");
  if (reg.pm10 !== undefined && !(e.Pm10 > 0)) manque.push("Pm10 (P10 et Pan requis)");
  if (reg.kr10 !== undefined && !(e.Kr10 > 0)) manque.push("Kr10");
  if (reg.dd !== undefined && !(e.Dd > 0)) manque.push("Dd");
  if (manque.length) return { Q10: null, motif: `donnée manquante : ${manque.join(", ")}` };

  let q = reg.a;
  if (reg.s !== undefined) q *= Math.pow(e.S, reg.s);
  if (reg.ig !== undefined) q *= Math.pow(e.Ig, reg.ig);
  if (reg.pm10 !== undefined) q *= Math.pow(e.Pm10, reg.pm10);
  if (reg.kr10 !== undefined) q *= Math.pow(e.Kr10, reg.kr10);
  if (reg.dd !== undefined) q *= Math.pow(e.Dd, reg.dd);
  if (!Number.isFinite(q) || q <= 0)
    return { Q10: null, motif: "résultat non représentable pour ces données" };
  return { Q10: q, motif: null };
}

/** Kr10 lu au tableau 9, par géologie et pluie annuelle. Corrélation faible : à dire. */
export function kr10Geologie(cieh, categorie, panMm) {
  const cat = cieh.kr10_geologie?.categories?.find((c) => c.categorie === categorie);
  if (!cat || !(panMm > 0)) return null;
  return { valeur: cat.a * Math.pow(panMm, cat.b), r: cat.r, n: cat.n,
           avertissement: cieh.kr10_geologie.avertissement };
}

/**
 * Quelles régressions ont le droit de s'appliquer à CE bassin.
 *
 * Le tableau 11 découpe de trois façons — par bande de pluie annuelle, par
 * longitude, par pays — et une régression calée sur le Sénégal n'a rien à dire
 * d'un bassin tchadien. Appliquer les 48 lignes revient à moyenner des
 * régions : le manuel demande l'inverse, « procéder à une analyse critique ».
 *
 * Les découpages PAR PAYS ne sont jamais proposés d'office : ils demanderaient
 * des frontières, dont le cours ne dispose pas. Ils restent à cocher à la main.
 */
export function proposerRegressions(cieh, { Pan, lonDeg = null, pays = null }) {
  const cs = cieh.criteres_selection;
  const bandes = Object.fromEntries(cs.bandes_pan_par_ligne.map((b) => [b.no, b]));
  const groupes = Object.fromEntries(cs.groupes.map((g) => [g.groupe, g]));
  return cieh.regressions.lignes.map((reg) => {
    const g = groupes[reg.groupe] ?? {};
    const motifs = [];
    if (g.par_ligne) {
      const b = bandes[reg.no];
      if (b && Pan > 0 && !(Pan >= b.pan_min && Pan <= b.pan_max))
        motifs.push(`calée pour P<sub>an</sub> de ${b.pan_min} à ${b.pan_max} mm`);
    }
    if (g.pan_max != null && Pan > g.pan_max) motifs.push(`calée sous ${g.pan_max} mm`);
    if (g.pan_min != null && Pan < g.pan_min) motifs.push(`calée au-dessus de ${g.pan_min} mm`);
    if (g.lon_min != null || g.lon_max != null) {
      if (lonDeg === null) motifs.push("longitude non renseignée");
      else {
        if (g.lon_min != null && lonDeg < g.lon_min) motifs.push(`calée à l'est de ${g.lon_min}°`);
        if (g.lon_max != null && lonDeg > g.lon_max) motifs.push(`calée à l'ouest de ${g.lon_max}°`);
      }
    }
    if (g.pays) {
      if (!pays) motifs.push(`découpage par pays — à cocher à la main (${g.pays.join(", ")})`);
      else if (!g.pays.includes(pays)) motifs.push(`calée sur ${g.pays.join(", ")}`);
    }
    return { no: reg.no, reg, retenue: motifs.length === 0, motifs };
  });
}

/** Applique toutes les régressions retenues et les classe. */
export function ciehToutes(cieh, e, ids = null) {
  const lignes = cieh.regressions.lignes
    .filter((r) => ids === null || ids.includes(r.no));
  return lignes.map((reg) => ({ reg, ...ciehQ10(reg, e), variables: variablesDe(reg) }));
}

/**
 * Le manuel demande d'appliquer PLUSIEURS régressions et de les comparer. Le
 * débit retenu est la médiane, et la fourchette s'affiche : réduire à une
 * formule unique, c'est perdre ce que le manuel appelle l'analyse critique.
 */
export function syntheseCieh(resultats) {
  const v = resultats.map((r) => r.Q10).filter((q) => q > 0).sort((a, b) => a - b);
  if (!v.length) return { n: 0, min: null, mediane: null, max: null, etendue: null };
  const n = v.length;
  const mediane = n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
  return { n, min: v[0], max: v[n - 1], mediane, etendue: v[n - 1] / v[0], valeurs: v };
}

// ── ORSTOM : une chaîne analytique, et un refus assumé ─────────────────────

const ORD = { PI: 0, I: 1, RI: 2, P: 3, TP: 4 };

/** Ordinal d'infiltrabilité. Fractionnaire admis : 80 % I + 20 % RI ⇒ 1,2. */
export const ordinalDe = (classe) => (classe in ORD ? ORD[classe] : null);

const krRow = (r, S) => r.a / (S + r.b) + r.c;

/** Valeur d'une famille de lignes Kr pour une classe donnée, encadrée sur Ig. */
function krClasse(lignes, classe, ig, S, tpMedian) {
  const parClasse = lignes.filter((r) => r.classe === classe).sort((a, b) => a.ig - b.ig);
  if (!parClasse.length) return classe === "TP" && tpMedian != null ? tpMedian : null;
  const sous = [...parClasse].reverse().find((r) => r.ig <= ig);
  const sur = parClasse.find((r) => r.ig >= ig);
  if (!sous && !sur) return null;
  if (!sous) return krRow(sur, S);
  if (!sur) return krRow(sous, S);
  if (Math.abs(sur.ig - sous.ig) < 1e-9) return krRow(sous, S);
  const vb = krRow(sous, S), va = krRow(sur, S);
  return vb + ((va - vb) * (ig - sous.ig)) / (sur.ig - sous.ig);
}

/** Interpolation sur l'ordinal d'infiltrabilité, puis lecture à Ig. */
function krAu(lignes, S, ig, ordinal, tpMedian) {
  const ordonnes = Object.entries(ORD).sort((a, b) => a[1] - b[1]);
  const bas = [...ordonnes].reverse().find(([, o]) => o <= ordinal + 1e-9);
  const haut = ordonnes.find(([, o]) => o >= ordinal - 1e-9);
  const vBas = bas ? krClasse(lignes, bas[0], ig, S, tpMedian) : null;
  const vHaut = haut ? krClasse(lignes, haut[0], ig, S, tpMedian) : null;
  if (vBas === null && vHaut === null) return null;
  if (vBas === null) return vHaut;
  if (vHaut === null) return vBas;
  if (!bas || !haut || Math.abs(haut[1] - bas[1]) < 1e-9) return vBas;
  return vBas + ((vHaut - vBas) * (ordinal - bas[1])) / (haut[1] - bas[1]);
}

/**
 * Kr10 par les équations 3.2 et 3.3, puis interpolation linéaire sur P10 entre
 * les deux abaques Kr70 et Kr100.
 *
 * DOMAINE : en zone sahélienne, S > 10 km² ET Igcor ≤ 15 m/km. En deçà, le
 * manuel n'a que les figures 9 et 10, qui ne sont pas digitalisées. On REFUSE
 * plutôt que de prolonger les hyperboles là où elles ne sont pas valides — la
 * valeur doit alors être lue sur l'abaque et saisie.
 */
export function orstomKr10(orstom, e) {
  const zone = e.zone === "tropical" ? orstom.kr.tropical : orstom.kr.sahelien;
  const dom = zone.domaine;
  if (dom) {
    if (dom.s_min_km2 != null && e.S < dom.s_min_km2)
      return { Kr10: null, motif: dom.motif_hors_domaine };
    if (dom.s_max_km2 != null && e.S > dom.s_max_km2)
      return { Kr10: null, motif: dom.motif_hors_domaine };
    if (dom.ig_max_m_par_km != null && e.Ig > dom.ig_max_m_par_km)
      return { Kr10: null, motif: dom.motif_hors_domaine };
  }
  const ordinal = e.ordinal ?? ordinalDe(e.classe);
  if (ordinal === null || ordinal === undefined)
    return { Kr10: null, motif: "classe d'infiltrabilité non renseignée" };
  const kr70 = krAu(zone.kr70, e.S, e.Ig, ordinal, zone.kr70_tp_median);
  const kr100 = krAu(zone.kr100, e.S, e.Ig, ordinal, zone.kr100_tp_median);
  if (kr70 === null || kr100 === null)
    return { Kr10: null, motif: "aucune classe tabulée n'encadre cette combinaison Ig / infiltrabilité" };
  if (!(e.P10 > 0)) return { Kr10: null, motif: "P10 requis" };
  return { Kr10: kr70 + ((kr100 - kr70) * (e.P10 - 70)) / 30, kr70, kr100, motif: null };
}

const evaluerBranche = (b, S) => {
  if (b.type === "linear") return b.k * S + b.d;
  if (b.type === "power") return b.k * Math.pow(S, b.e) + b.d;
  if (b.type === "powerShift") return b.k * Math.pow(Math.max(0, S - b.shift), b.e) + b.d;
  return NaN;
};
const dansLaPlage = (b, S) =>
  (b.sMin == null || S >= b.sMin) && (b.sMax == null || S <= b.sMax);

/**
 * Réduction en pourcent appliquée à la branche « I » pour obtenir la valeur
 * « P » du temps de montée : le manuel ne donne pas de branche P, il tabule une
 * réduction en S. Interpolation linéaire, et PROLONGÉE au-delà du dernier point
 * — le manuel retient 4 % à S = 6 km² là où sa table s'arrête à 5 % pour S = 5.
 */
function reductionPct(points, S) {
  const pts = [...points].sort((a, b) => a.s - b.s);
  if (pts.length === 1) return Math.min(100, Math.max(0, pts[0].pct));
  let lo = pts[0], hi = pts[1];
  for (let i = 0; i < pts.length - 1; i++) if (S >= pts[i].s) { lo = pts[i]; hi = pts[i + 1]; }
  if (S < pts[0].s) { lo = pts[0]; hi = pts[1]; }
  const span = hi.s - lo.s;
  if (Math.abs(span) < 1e-9) return Math.min(100, Math.max(0, lo.pct));
  return Math.min(100, Math.max(0, lo.pct + ((hi.pct - lo.pct) * (S - lo.s)) / span));
}

/** Évalue une classe d'Ig à S fixé, en interpolant entre les branches I et P. */
function evaluerClasse(cls, S, ordinal) {
  const plaine = cls.branches.find((b) => b.infiltrabilite == null && dansLaPlage(b, S));
  if (plaine) return evaluerBranche(plaine, S);
  const bI = cls.branches.find((b) => b.infiltrabilite === "I" && dansLaPlage(b, S));
  const bP = cls.branches.find((b) => b.infiltrabilite === "P" && dansLaPlage(b, S));
  let vI = bI ? evaluerBranche(bI, S) : null;
  let vP = bP ? evaluerBranche(bP, S) : null;
  if (vP === null && vI !== null && cls.reductionP?.length)
    vP = vI * (1 - reductionPct(cls.reductionP, S) / 100);
  if (vI !== null && vP !== null) {
    const t = Math.min(1, Math.max(0, (ordinal - ORD.I) / (ORD.P - ORD.I)));
    return vI + (vP - vI) * t;
  }
  return vI ?? vP;
}

/**
 * Temps pour une classe d'Ig, avec interpolation LOGARITHMIQUE sur S dans la
 * plage que le manuel laisse vide entre deux relations. La borne haute est la
 * borne INFÉRIEURE de la plage imprimée (« 45-50 km² » ⇒ 45) : c'est ce que
 * font les exemples chiffrés.
 */
function tempsClasse(cls, S, ordinal) {
  const direct = evaluerClasse(cls, S, ordinal);
  if (direct !== null && Number.isFinite(direct)) return direct;
  if (!cls.interpLog) return null;
  const { sLow, sHigh } = cls.interpLog;
  if (!(S > sLow && S < sHigh)) return null;
  const vLow = evaluerClasse(cls, sLow, ordinal);
  const vHigh = evaluerClasse(cls, sHigh, ordinal);
  if (vLow === null || vHigh === null) return null;
  const f = (Math.log10(S) - Math.log10(sLow)) / (Math.log10(sHigh) - Math.log10(sLow));
  return vLow + (vHigh - vLow) * f;
}

/** Interpolation linéaire entre les deux classes d'Ig qui encadrent la pente. */
function tempsInterpole(classes, S, ig, ordinal) {
  if (!classes?.length) return null;
  const tri = [...classes].sort((a, b) => a.ig - b.ig);
  const sous = [...tri].reverse().find((c) => c.ig <= ig);
  const sur = tri.find((c) => c.ig >= ig);
  if (!sous && !sur) return null;
  if (!sous) return tempsClasse(sur, S, ordinal);
  if (!sur) return tempsClasse(sous, S, ordinal);
  if (Math.abs(sur.ig - sous.ig) < 1e-9) return tempsClasse(sous, S, ordinal);
  const vb = tempsClasse(sous, S, ordinal), va = tempsClasse(sur, S, ordinal);
  if (vb === null || va === null) return vb ?? va;
  return vb + ((va - vb) * (ig - sous.ig)) / (sur.ig - sous.ig);
}

export function orstomTb10(orstom, e) {
  const ordinal = e.ordinal ?? ordinalDe(e.classe) ?? ORD.I;
  if (e.zone === "tropical") {
    const t = orstom.temps.tb10_tropical;
    const tri = [...t.lignes].sort((a, b) => a.ig - b.ig);
    const sous = [...tri].reverse().find((r) => r.ig <= e.Ig);
    const sur = tri.find((r) => r.ig >= e.Ig);
    const val = (r) => r.a * Math.pow(e.S, t.exposant) + r.b;
    if (!sous && !sur) return null;
    if (!sous) return val(sur);
    if (!sur) return val(sous);
    if (Math.abs(sur.ig - sous.ig) < 1e-9) return val(sous);
    return val(sous) + ((val(sur) - val(sous)) * (e.Ig - sous.ig)) / (sur.ig - sous.ig);
  }
  return tempsInterpole(orstom.temps.tb10_sahelien, e.S, e.Ig, ordinal);
}

export function orstomTm10(orstom, e, tb10) {
  if (e.zone === "tropical")
    return tb10 != null ? tb10 * orstom.temps.tm10_tropical_ratio_tb : null;
  const ordinal = e.ordinal ?? ordinalDe(e.classe) ?? ORD.I;
  return tempsInterpole(orstom.temps.tm10_sahelien, e.S, e.Ig, ordinal);
}

/** Écoulement retardé : la valeur du manuel selon la classe, sauf choix explicite. */
function ratioRetarde(orstom, e) {
  if (e.ratioRetarde != null) return e.ratioRetarde;
  const ordinal = e.ordinal ?? ordinalDe(e.classe) ?? ORD.I;
  const liste = e.zone === "tropical"
    ? orstom.debits.ecoulement_retarde.tropical : orstom.debits.ecoulement_retarde.sahelien;
  const parCas = Object.fromEntries(liste.filter((x) => x.ratio != null)
    .map((x) => [x.cas.includes("P") && x.cas.includes("infiltrabilité") ? "P" : "I", x.ratio]));
  const rI = parCas.I ?? 0.03, rP = parCas.P ?? 0.06;
  const t = Math.min(1, Math.max(0, (ordinal - ORD.I) / (ORD.P - ORD.I)));
  return rI + (rP - rI) * t;
}

/**
 * La chaîne complète du chapitre 3 du bulletin :
 *   Pm10 = P10·A → Kr10 → Vr10 → Tb10 → Qm10 = 16,7·Pm10·Kr10·S/Tb10
 *   → Qr10 = α10·Qm10 → Q10 = (1+r)·Qr10 → Vc10, Tm10
 * puis, si P100 est connue, le passage à la centennale par le Gradex.
 */
export function orstomChaine(orstom, e) {
  const avertissements = [];
  if (!(e.S > 0)) return { motif: "superficie requise" };
  if (!(e.P10 > 0)) return { motif: "P10 requis" };
  if (!(e.Pan > 0)) return { motif: "Pan requis (abattement)" };

  const A = abattement(e.Pan, e.S);
  const Pm10 = e.P10 * A;

  let Kr10, kr70 = null, kr100 = null, sourceKr;
  if (e.Kr10Saisi > 0) {
    Kr10 = e.Kr10Saisi;
    sourceKr = "saisi (lecture graphique, figures 9 et 10)";
  } else {
    const k = orstomKr10(orstom, e);
    if (k.Kr10 === null) return { motif: `Kr10 : ${k.motif}`, refusKr: true };
    ({ Kr10, kr70, kr100 } = k);
    sourceKr = "équations 3.2 et 3.3 (tableaux 1 à 4)";
  }
  const krFrac = Kr10 / 100;

  const Tb10 = orstomTb10(orstom, e);
  if (!(Tb10 > 0)) return { motif: "temps de base non calculable pour cette combinaison S / Ig" };
  const Tm10 = orstomTm10(orstom, e, Tb10);

  const Lr10 = Pm10 * krFrac;
  const Vr10 = 1000 * Pm10 * krFrac * e.S;
  const Qm10 = (16.7 * Pm10 * krFrac * e.S) / Tb10;
  const alpha10 = e.alpha10 ?? orstom.debits.alpha10_defaut;
  const Qr10 = alpha10 * Qm10;
  const r = ratioRetarde(orstom, e);
  const Q10 = (1 + r) * Qr10;
  const Vret10 = Qr10 * r * Tb10 * 60;
  const Vc10 = Vr10 + Vret10;

  // Passage au centennal — méthode du Gradex, page 29. Tb en HEURES, Kr en FRACTION.
  let C100 = null, Q100 = null, sourceRatio = null, ratioP = null;
  const cfg = orstom.crue_de_projet;
  if (cfg) {
    if (e.P100 > 0 && e.P100 > e.P10) {
      ratioP = (e.P100 - e.P10) / e.P10;
      sourceRatio = "calculé sur P100 et P10";
    } else if (cfg.rapport_p100_p10_defaut) {
      ratioP = e.zone === "tropical"
        ? cfg.rapport_p100_p10_defaut.tropical : cfg.rapport_p100_p10_defaut.sahelien;
      const enFr = ratioP.toLocaleString("fr-FR", { minimumFractionDigits: 2 });
      sourceRatio = `approximation du manuel — ${enFr} en zone `
        + (e.zone === "tropical" ? "tropicale" : "sahélienne");
    }
    if (ratioP > 0) {
      C100 = 1 + (ratioP * Math.pow(Tb10 / 60 / 24, cfg.exposant_tb)) / krFrac;
      Q100 = C100 * Q10;
    }
  }

  return { A, Pm10, Kr10, kr70, kr100, sourceKr, Lr10, Vr10, Tb10, Tm10,
           Qm10, alpha10, Qr10, ratioRetarde: r, Q10, Vret10, Vc10,
           C100, Q100, ratioP, sourceRatio, avertissements, motif: null };
}

// ── La rationnelle en Afrique : la formule voyage, ses paramètres non ──────

/**
 * Q = 0,278 · C · i · S. La formule est universelle ; ce qui ne l'est pas, ce
 * sont ses deux entrées :
 *
 *  · l'INTENSITÉ. La table de Montana du chapitre 3 est un catalogue de stations
 *    TUNISIENNES. Le bulletin FAO 54 ne fournit aucune relation intensité-durée-
 *    fréquence. Il faut donc une IDF locale, établie sur la station du projet.
 *  · le COEFFICIENT C. L'abaque pente × couverture végétale du chapitre 3 est
 *    tunisien. Le transposer au Sahel serait emprunter une régionalisation à une
 *    région qui n'est pas la sienne.
 *
 * On refuse donc de calculer plutôt que de fournir des paramètres empruntés —
 * et le refus nomme ce qui manque.
 */
export function rationnelleLocale({ C, S, idf, tcMin, dureeMinimaleMin = 5, i = null }) {
  const manque = [];
  if (!(C > 0)) manque.push("le coefficient de ruissellement C, à établir localement");
  if (!(S > 0)) manque.push("la superficie S");
  let intensite = i, source = "intensité saisie";
  if (!(intensite > 0)) {
    if (!idf || !(idf.a > 0) || !(idf.b < 0)) {
      manque.push("une IDF locale (a et b, avec b négatif) ou une intensité mesurée — "
        + "le bulletin FAO 54 n'en fournit aucune, et la table de Montana du chapitre 3 "
        + "ne couvre que des stations tunisiennes");
    } else if (!(tcMin > 0)) {
      manque.push("le temps de concentration");
    } else {
      const t = Math.max(tcMin, dureeMinimaleMin);
      const duree = idf.unite === "h" ? t / 60 : t;
      intensite = idf.a * Math.pow(duree, idf.b);
      source = `IDF locale i = ${idf.a}·t^(${idf.b})${idf.unite === "h" ? ", t en heures" : ""}`
        + (t > tcMin + 1e-9 ? ` — durée plafonnée au minimum de ${dureeMinimaleMin} min` : "");
    }
  }
  if (manque.length) return { Q: null, motif: `il manque ${manque.join(" ; ")}` };
  return { Q: 0.278 * C * intensite * S, intensite, source, motif: null };
}

// ── Les stations IDF du CIEH : l'intensité que le bulletin ne donne pas ───

/**
 * Le bulletin FAO 54 ne contient aucune relation intensité-durée-fréquence.
 * Le CIEH, lui, en publie une : 87 postes et zones d'Afrique de l'Ouest et
 * centrale, sous la forme i = A_T · t^(−b), avec i en MILLIMÈTRES PAR MINUTE
 * et t en minutes.
 *
 * Trois choses voyagent avec chaque valeur, et doivent rester visibles :
 *
 *  · le STATUT. Seul T = 10 ans est publié. T = 2 et 5 sont interpolés entre
 *    A1 et A10, T = 20 est extrapolé au-delà. Une extrapolation qui perd son
 *    étiquette devient une mesure.
 *  · la PLAGE DE DURÉE. Deux plages par poste, 5 à 60 min et 120 à 1440 min,
 *    avec leur propre exposant b. Entre 60 et 120 minutes, il n'y a RIEN — et
 *    c'est exactement là que tombent beaucoup de temps de concentration.
 *  · l'UNITÉ. mm/min à la source. Pour des mm/h, a = 60 · A_T.
 */
export const A_VERS_MM_PAR_HEURE = 60;

/** Les postes d'un pays, ou tous. Les « zones » couvrent plusieurs villes. */
export function stationsIdf(catalogue, pays = null) {
  return catalogue.stations.filter((s) => !pays || s.pays === pays);
}

export const paysIdf = (catalogue) =>
  [...new Set(catalogue.stations.map((s) => s.pays))].sort((a, b) => a.localeCompare(b, "fr"));

/**
 * La plage qui couvre cette durée, ou rien. AUCUNE extrapolation : une durée
 * de 90 minutes tombe dans le trou du catalogue, et le dire est la seule
 * réponse honnête.
 */
export function plagePour(station, tMin) {
  const p = station.plages.find((x) => tMin >= x.t_min_min && tMin <= x.t_max_min);
  if (p) return { plage: p, motif: null };
  const bornes = station.plages.map((x) => x.libelle).join(" et ");
  const sous = station.plages.every((x) => tMin < x.t_min_min);
  const au = station.plages.every((x) => tMin > x.t_max_min);
  return { plage: null, motif: sous
    ? `durée sous la plus petite plage calée (${bornes})`
    : au ? `durée au-delà de la plus grande plage calée (${bornes})`
    : `durée entre les deux plages calées (${bornes}) : le CIEH n'y publie rien, `
      + "et on ne comble pas un trou de catalogue par une interpolation" };
}

/**
 * Intensité en mm/h à la station, pour la durée et la période demandées.
 * Rend aussi le statut de la valeur employée — il doit suivre jusqu'au rapport.
 */
export function intensiteIdf(station, tMin, T) {
  const { plage, motif } = plagePour(station, tMin);
  if (!plage) return { i: null, motif };
  const v = plage.A_par_T.find((x) => x.T === T);
  if (!v) {
    const dispo = plage.A_par_T.map((x) => `${x.T}`).join(", ");
    return { i: null, motif: `période de retour non calée à cette station (disponibles : ${dispo} ans)` };
  }
  const a = A_VERS_MM_PAR_HEURE * v.A_T;
  return {
    i: a * Math.pow(tMin, -plage.b),
    a, b: plage.b, plage, statut: v.statut,
    publie: /publié/i.test(v.statut),
    incoherence: incoherenceT(plage),
    motif: null,
  };
}

/**
 * Une plage dont A DÉCROÎT avec la période de retour décrit une pluie qui
 * faiblirait en devenant plus rare. C'est impossible, et cela se rencontre :
 * deux entrées du catalogue le font sur leur plage longue, sans doute parce que
 * A1 et A10 y ont été relevés dans le mauvais ordre. On ne corrige pas — la
 * transcription est la source — mais on le signale à chaque lecture.
 */
export function incoherenceT(plage) {
  const v = [...plage.A_par_T].sort((a, b) => a.T - b.T);
  for (let i = 1; i < v.length; i++)
    if (v[i].A_T <= v[i - 1].A_T)
      return `A décroît de T = ${v[i - 1].T} à T = ${v[i].T} ans : l'intensité `
        + "diminuerait en devenant plus rare. Coefficients à vérifier sur la source "
        + "avant emploi.";
  return null;
}

/** Les périodes de retour calées, toutes plages confondues. */
export const periodesIdf = (station) =>
  [...new Set(station.plages.flatMap((p) => p.A_par_T.map((v) => v.T)))].sort((a, b) => a - b);

/** Distance approchée, en kilomètres, entre un point et les repères d'un poste. */
export function distanceIdf(station, lon, lat) {
  let d = Infinity;
  for (const p of station.points) {
    if (p.lon == null || p.lat == null) continue;
    const k = Math.cos(((lat + p.lat) / 2 * Math.PI) / 180);
    d = Math.min(d, 111.32 * Math.hypot((p.lon - lon) * k, p.lat - lat));
  }
  return d;
}

// ── Les isohyètes annuelles, et la limite des régimes ─────────────────────

/** Point le plus proche d'une polyligne, en degrés. Sans projection : à cette
 *  échelle et pour un simple encadrement, la déformation ne change rien. */
function plusProcheSur(points, lon, lat) {
  let d2 = Infinity, cx = points[0][0], cy = points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1], [x1, y1] = points[i];
    const dx = x1 - x0, dy = y1 - y0;
    const L = dx * dx + dy * dy;
    const t = L > 1e-18 ? Math.max(0, Math.min(1, ((lon - x0) * dx + (lat - y0) * dy) / L)) : 0;
    const px = x0 + t * dx, py = y0 + t * dy;
    const e = (px - lon) ** 2 + (py - lat) ** 2;
    if (e < d2) { d2 = e; cx = px; cy = py; }
  }
  return { d: Math.sqrt(d2), lon: cx, lat: cy };
}

/**
 * Pluie annuelle lue sur la figure 3 du bulletin, par interpolation entre les
 * DEUX ISOHYÈTES ENCADRANTES les plus proches, pondérée par la distance.
 *
 * Le test d'encadrement est tout l'intérêt : le point doit être ENTRE les deux
 * courbes, pas seulement près d'elles. Si P est encadré, d1 + d2 vaut à peu
 * près l'écart entre les deux points de contact ; au large ou en plein Sahara,
 * cette somme explose. Sans ce test, le champ « interpolait » partout.
 *
 * Hors du faisceau on REFUSE, avec le motif. Jamais de valeur par défaut,
 * jamais d'extrapolation : le bulletin ne dit rien au-delà de ses tracés.
 */
export function panEn(champ, lon, lat) {
  const parValeur = new Map();
  for (const iso of champ.isohyetes) {
    const c = plusProcheSur(iso.points, lon, lat);
    const vu = parValeur.get(iso.mm);
    if (!vu || c.d < vu.d) parValeur.set(iso.mm, c);
  }
  if (parValeur.size < 2)
    return { mm: null, motif: "une seule valeur d'isohyète à portée — pas d'encadrement" };

  const tri = [...parValeur.entries()].sort((a, b) => a[1].d - b[1].d);
  const [v1, c1] = tri[0];
  const second = tri.slice(1).find(([v]) => Math.abs(v - v1) > 1e-9);
  if (!second) return { mm: null, motif: "pas de seconde isohyète de valeur distincte" };
  const [v2, c2] = second;

  const somme = c1.d + c2.d;
  const ecart = Math.hypot(c2.lon - c1.lon, c2.lat - c1.lat);
  if (ecart > 1e-9 && somme > ecart * 1.25)
    return { mm: null, bas: Math.min(v1, v2), haut: Math.max(v1, v2),
      motif: "point hors du faisceau d'isohyètes : il n'est encadré par aucune paire de "
        + "courbes, et le bulletin ne dit rien au-delà de ses tracés" };

  const mm = somme <= 1e-12 ? v1 : v1 + ((v2 - v1) * c1.d) / somme;
  return { mm, bas: Math.min(v1, v2), haut: Math.max(v1, v2),
           d1: c1.d, d2: c2.d, motif: null };
}

/**
 * Le régime, d'après la pluie annuelle. La limite n'est pas une ligne : le
 * manuel écrit « aux alentours de 800-850 mm ». Entre les deux, on ne tranche
 * pas — on dit que le bassin est dans la bande de transition, et c'est au
 * projeteur de choisir en connaissance de cause.
 */
export function regimeDe(champ, panMm) {
  const [bas, haut] = champ.limite_regimes_mm;
  if (!(panMm > 0)) return { regime: null, libelle: "pluie annuelle inconnue" };
  if (panMm < bas) return { regime: "sahelien", libelle: "sahélien", certain: true };
  if (panMm > haut) return { regime: "tropical", libelle: "tropical sec", certain: true };
  return { regime: "sahelien", certain: false,
    libelle: `dans la bande de transition ${bas}–${haut} mm` };
}

// ── Les domaines : ORSTOM ≠ CIEH, et ce sont des avertissements ────────────

/**
 * Hors bornes, le calcul ABOUTIT mais dit pourquoi il est fragile. Ne pas
 * transformer ces avertissements en refus : le manuel ne l'a pas fait, et un
 * bassin à 1100 mm de pluie annuelle n'est pas un bassin qu'on ne sait pas
 * calculer, c'est un bassin dont le résultat se discute.
 */
export function controlerDomaines({ cieh, orstom }, { S, Pan, lonDeg = null, zone = null }) {
  const av = [];
  const dc = cieh.domaine_application, doo = orstom.domaine_application;

  if (Pan > 0 && Pan < dc.pan_min_mm)
    av.push({ methode: "CIEH", texte: `pluie annuelle ${Pan} mm sous la borne de ${dc.pan_min_mm} mm du manuel` });
  if (Pan > dc.pan_max_mm)
    av.push({ methode: "CIEH", texte: `pluie annuelle ${Pan} mm au-delà de ${dc.pan_max_mm} mm : le manuel n'a retenu que les équations sous cette limite (la méthode va jusqu'à ${dc.pan_max_methode_mm} mm)` });
  if (S > 0 && (S < dc.s_calage_min_km2 || S > dc.s_calage_max_km2))
    av.push({ methode: "CIEH", texte: `superficie ${S} km² hors de la plage de calage ${dc.s_calage_min_km2}–${dc.s_calage_max_km2} km²` });
  if (S > dc.s_max_km2)
    av.push({ methode: "CIEH", texte: `superficie ${S} km² au-delà du maximum de ${dc.s_max_km2} km²` });

  if (Pan > 0 && (Pan < doo.pan_min_mm || Pan > doo.pan_max_mm))
    av.push({ methode: "ORSTOM", texte: `pluie annuelle ${Pan} mm hors des bornes ${doo.pan_min_mm}–${doo.pan_max_mm} mm` });
  if (S > doo.s_max_km2)
    av.push({ methode: "ORSTOM", texte: `superficie ${S} km² au-delà de ${doo.s_max_km2} km²` });
  if (lonDeg != null && lonDeg > doo.lon_max_deg)
    av.push({ methode: "ORSTOM", texte: `longitude ${lonDeg}° E au-delà de ${doo.lon_max_deg}° : hors de la zone étudiée` });

  // La limite des régimes : une zone déclarée qui contredit la pluie annuelle
  // fait lire les mauvais tableaux. On le signale plutôt que de corriger.
  const limite = doo.pan_limite_sahelien_tropical_mm;
  if (zone && Pan > 0) {
    if (zone === "sahelien" && Pan > limite)
      av.push({ methode: "ORSTOM", texte: `zone déclarée sahélienne avec ${Pan} mm : au-delà de ${limite} mm on est en régime tropical, et ce ne sont pas les mêmes tableaux` });
    if (zone === "tropical" && Pan < limite)
      av.push({ methode: "ORSTOM", texte: `zone déclarée tropicale avec ${Pan} mm : sous ${limite} mm on est en régime sahélien` });
  }
  return av;
}

/**
 * Ce que la check-list de l'annexe 1 pèse, et pourquoi elle ne s'applique pas
 * d'office : le manuel qualifie ses valeurs d'« à titre indicatif » et elles
 * reposent sur des observations de terrain et de photographies aériennes dont
 * aucun logiciel ne dispose. L'item 1a est BLOQUANT : dans la bande de 10 à
 * 20 km bordant l'océan, ni ORSTOM ni CIEH ne s'appliquent.
 *
 * Le cumul de deux corrections de même nature est MULTIPLICATIF : deux
 * réductions de 30 % donnent 0,49, et non 0,40.
 */
export const cumulerCorrections = (facteurs) =>
  facteurs.reduce((a, f) => a * f, 1);

export function itemsBloquants(checklist, zone) {
  const z = checklist.zones[zone === "tropical" ? 1 : 0];
  return z.items.filter((it) => it.bloquant);
}
