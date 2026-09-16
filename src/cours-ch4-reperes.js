// Carte de repérage des noms cités par les zonages régionaux.
//
// CE QUE CETTE CARTE N'EST PAS : une carte des zones. Les manuels décrivent
// leurs zones par des NOMS — « rive droite Mejerda, Cap-Bon, Zeroud amont » —
// et non par des coordonnées. Tracer des limites à partir de ces phrases
// reviendrait à inventer une donnée que le lecteur prendrait ensuite pour
// acquise. On place donc les noms, pas les frontières.
//
// Elle sert à une chose, et elle la fait bien : un étudiant qui lit « nord
// Zeroud » doit pouvoir situer le Zeroud. C'est tout, et c'est déjà beaucoup.
import { chargerFrontieres, projection, fondDeCarte, graticule, FOND,
         calqueSurvol, attacherSurvol } from "./carte-fond.js";
import { chargerJson } from "./donnees.js";

const el = (id) => document.getElementById(id);

const JEU = await chargerJson("data/reperes-tunisie.json");
const FRONTIERES = await chargerFrontieres();
const PAR_ID = new Map(JEU.reperes.map((r) => [r.id, r]));

const C = {
  repere: "#0369a1", actif: "#b45309", ville: "#475569",
  texte: "#334155", muet: "#94a3b8", avertir: "#b91c1c",
};
const FORMES = { oued: "oued", region: "région", relief: "relief", lac: "lac" };

let zoneCarte = { x0: 0, y0: 0, x1: 0, y1: 0 };

function carte() {
  const FENETRE = { lon0: 7.6, lat0: 30.0, lon1: 11.8, lat1: 37.7 };
  const proj = projection(FENETRE, { largeurMax: 380, hauteurMax: 520,
                                     mg: 40, md: 14, mh: 14, mb: 30 });
  const { px, py, zone } = proj;
  zoneCarte = zone;
  const W = Math.round(proj.largeur), H = Math.round(proj.hauteur);
  const base = fondDeCarte(FRONTIERES, px, py, zone, FENETRE, "clipReperes");

  const methode = el("rpMethode").value;
  const zonage = JEU.zonages[methode];
  const choisie = el("rpZone").value;
  const zone0 = zonage.zones.find((z) => z.cle === choisie) || zonage.zones[0];
  const cites = new Set(zone0.reperes);

  const villes = JEU.villes.map((v) => `
    <circle cx="${px(v.lon).toFixed(1)}" cy="${py(v.lat).toFixed(1)}" r="1.8" fill="${C.muet}"/>
    <text x="${(px(v.lon) + 4).toFixed(1)}" y="${(py(v.lat) + 3).toFixed(1)}" font-size="8"
      fill="${C.muet}">${v.nom}</text>`).join("");

  const reperes = JEU.reperes.map((r) => {
    const actif = cites.has(r.id);
    const x = px(r.lon), y = py(r.lat);
    // Les étiquettes sont posées à la main dans le fichier de données : sur une
    // carte aussi dense, un placement automatique chevauche toujours une ville.
    const e = r.etiquette || { dx: 10, dy: 4, ancre: "start" };
    return `<g class="station" data-nom="${r.nom}"
        data-detail="${FORMES[r.type]} — ${r.note}" tabindex="0" role="button"
        aria-label="${r.nom}, ${FORMES[r.type]} : ${r.note}">
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="12" fill="transparent" class="cible"/>
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${actif ? 6 : 3.5}"
        fill="${actif ? C.actif : C.repere}" fill-opacity="${actif ? 1 : 0.45}"
        stroke="${FOND.principal}" stroke-width="2"/>
      <text x="${(x + e.dx).toFixed(1)}" y="${(y + e.dy).toFixed(1)}"
        text-anchor="${e.ancre}" font-size="${actif ? 11 : 9.5}"
        font-weight="${actif ? 800 : 600}" fill="${actif ? C.actif : C.texte}"
        paint-order="stroke" stroke="${FOND.principal}" stroke-width="3">${r.nom}</text>
    </g>`;
  }).join("");

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img"
      aria-label="Carte de repérage : où se trouvent les noms cités par les zonages régionaux tunisiens">
    <defs>${base.defs}</defs>${base.fond}
    ${graticule(px, py, zone, [8, 9, 10, 11], [31, 32, 33, 34, 35, 36, 37])}
    ${base.reperes}
    <g clip-path="url(#clipReperes)">${villes}${reperes}</g>
    <text x="${zone.x0}" y="${(H - 6).toFixed(0)}" font-size="8.5" fill="${C.avertir}">
      Repérage des noms — ceci n'est pas une carte des limites de zones.</text>
    ${calqueSurvol("survolReperes")}</svg>`;
}

function legende() {
  const methode = el("rpMethode").value;
  const zonage = JEU.zonages[methode];
  const choisie = el("rpZone").value;
  el("rpLegende").innerHTML = `
    <table class="resultats"><thead><tr><th>Zone de ${zonage.nom}</th>
      <th>Telle que le manuel la nomme</th></tr></thead>
      <tbody>${zonage.zones.map((z) => `
        <tr class="${z.cle === choisie ? "alerte" : ""}"><td>${z.cle}</td>
          <td class="motif">${z.libelle}<small>${z.reperes
            .map((id) => PAR_ID.get(id).nom).join(" · ")}</small></td></tr>`).join("")}
      </tbody></table>`;
}

function remplirZones() {
  const zonage = JEU.zonages[el("rpMethode").value];
  el("rpZone").innerHTML = zonage.zones
    .map((z, i) => `<option value="${z.cle}"${i ? "" : " selected"}>${z.cle} — ${z.libelle}</option>`)
    .join("");
}

function maj() {
  el("rpCarte").innerHTML = carte();
  attacherSurvol(el("rpCarte"), "survolReperes", zoneCarte);
  legende();
}

el("rpMethode").addEventListener("change", () => { remplirZones(); maj(); });
el("rpZone").addEventListener("change", maj);
el("rpMethode").innerHTML = Object.entries(JEU.zonages)
  .map(([id, z], i) => `<option value="${id}"${i ? "" : " selected"}>${z.nom}</option>`).join("");
remplirZones();
maj();
