// Échelle de couleur séquentielle du site — une seule teinte, du clair au foncé.
//
// Cinq pas, contrôlés avant usage : clarté strictement décroissante, écart
// suffisant entre pas voisins, et pas le plus clair au-dessus du plancher de
// contraste 2:1 sur le fond de carte #f8fafc. Sept pas ne passaient pas — la
// teinte n'a pas assez d'amplitude — d'où cinq classes et la valeur exacte
// portée en étiquette plutôt qu'un dégradé illisible.
//
// Jamais d'arc-en-ciel : une magnitude se lit comme un ordre, et seul un
// gradient d'une teinte unique se lit comme un ordre.
export const RAMPE_SEQUENTIELLE = ["#4dbdf7", "#0d96d4", "#0575b4", "#075985", "#082f49"];

/** Gris des valeurs absentes : hors de la rampe, donc jamais confondu avec un rang. */
export const ABSENT = "#cbd5e1";

/**
 * Classe des valeurs en au plus `pas.length` groupes. Les valeurs distinctes
 * prennent un pas chacune ; au-delà, les deux groupes voisins les plus serrés
 * fusionnent — de sorte que la légende nomme toujours des valeurs réelles.
 */
export function classer(valeurs, pas = RAMPE_SEQUENTIELLE) {
  const distinctes = [...new Set(valeurs.filter((v) => Number.isFinite(v)))].sort((a, b) => a - b);
  if (!distinctes.length) return [];
  const groupes = distinctes.map((v) => [v]);
  while (groupes.length > pas.length) {
    let i = 1, ecart = Infinity;
    for (let k = 1; k < groupes.length; k++) {
      const d = groupes[k][0] - groupes[k - 1][groupes[k - 1].length - 1];
      if (d < ecart) { ecart = d; i = k; }
    }
    groupes[i - 1] = groupes[i - 1].concat(groupes[i]);
    groupes.splice(i, 1);
  }
  return groupes.map((g, i) => ({ valeurs: g, couleur: pas[i], min: g[0], max: g[g.length - 1] }));
}

/** Classes à bornes régulières, pour une grandeur continue. */
export function classerContinu(valeurs, pas = RAMPE_SEQUENTIELLE) {
  const v = valeurs.filter(Number.isFinite);
  if (!v.length) return [];
  const min = Math.min(...v), max = Math.max(...v);
  const large = (max - min) / pas.length || 1;
  return pas.map((couleur, i) => ({ couleur, min: min + i * large, max: min + (i + 1) * large }));
}

/** Couleur d'une valeur dans un jeu de classes, quel que soit le mode. */
export function couleurDe(v, classes) {
  if (!Number.isFinite(v) || !classes.length) return ABSENT;
  const exacte = classes.find((c) => c.valeurs && c.valeurs.includes(v));
  if (exacte) return exacte.couleur;
  for (const c of classes) if (v <= c.max + 1e-9) return c.couleur;
  return classes[classes.length - 1].couleur;
}
