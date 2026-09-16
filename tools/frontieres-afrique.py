#!/usr/bin/env python3
"""Fond de carte de l'Afrique de l'Ouest et centrale, pour les stations IDF du CIEH.

Même forme et même esprit que data/frontieres.json : Natural Earth admin_0, découpé
sur la fenêtre des stations et simplifié. Sert à SITUER les stations, pas à mesurer.

Source : nvkelso/natural-earth-vector, ne_50m_admin_0_countries.geojson, domaine
public (CC0). Le 1:50 m suffit largement à cette échelle continentale ; le 1:10 m
pèserait dix fois plus pour un trait que personne ne distinguerait.

Usage : python3 tools/frontieres-afrique.py chemin/vers/ne_50m_admin_0_countries.geojson
"""
import json, math, sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent

# Les treize pays du catalogue de stations, tels que Natural Earth les nomme.
PRINCIPAUX = {
    "Benin": "Bénin", "Burkina Faso": "Burkina Faso", "Cameroon": "Cameroun",
    "Côte d'Ivoire": "Côte d'Ivoire", "Ivory Coast": "Côte d'Ivoire",
    "Gabon": "Gabon", "Mali": "Mali", "Mauritania": "Mauritanie", "Niger": "Niger",
    "Nigeria": "Nigeria", "Congo": "République du Congo",
    "Senegal": "Sénégal", "Chad": "Tchad", "Togo": "Togo",
}
# Les voisins : sans eux la carte est trouée, et un trou se lit comme une mer.
# Ils ne portent pas de station, mais leur nom doit être en français comme le reste.
VOISINS = {
    "Algeria": "Algérie", "Angola": "Angola", "Central African Rep.": "Centrafrique",
    "Dem. Rep. Congo": "Rép. dém. du Congo", "Eq. Guinea": "Guinée équatoriale",
    "Gambia": "Gambie", "Ghana": "Ghana", "Guinea": "Guinée",
    "Guinea-Bissau": "Guinée-Bissau", "Liberia": "Liberia", "Libya": "Libye",
    "Sierra Leone": "Sierra Leone", "Sudan": "Soudan",
    "São Tomé and Principe": "Sao Tomé-et-Principe", "W. Sahara": "Sahara occidental",
    "Morocco": "Maroc", "Egypt": "Égypte", "S. Sudan": "Soudan du Sud",
}
MARGE = 1.5
TOLERANCE = 0.03          # ≈ 3 km : le trait de côte reste lisible, le fichier léger


def douglas_peucker(points, tol):
    if len(points) < 3:
        return points
    x0, y0 = points[0]
    x1, y1 = points[-1]
    dx, dy = x1 - x0, y1 - y0
    norme = math.hypot(dx, dy)
    imax, dmax = 0, 0.0
    for i in range(1, len(points) - 1):
        x, y = points[i]
        d = (abs(dy * x - dx * y + x1 * y0 - y1 * x0) / norme) if norme > 1e-12 \
            else math.hypot(x - x0, y - y0)
        if d > dmax:
            imax, dmax = i, d
    if dmax <= tol:
        return [points[0], points[-1]]
    return douglas_peucker(points[:imax + 1], tol)[:-1] + douglas_peucker(points[imax:], tol)


def anneaux_de(geom):
    t, c = geom["type"], geom["coordinates"]
    if t == "Polygon":
        return [c[0]]
    if t == "MultiPolygon":
        return [poly[0] for poly in c]
    return []


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    ne = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    stations = json.loads((RACINE / "data/montana-afrique.json").read_text(encoding="utf-8"))

    pts = [(p["lon"], p["lat"]) for s in stations["stations"] for p in s["points"]
           if p.get("lon") is not None and p.get("lat") is not None]
    # Le fond sert à DEUX figures : les postes IDF et les isohyètes annuelles,
    # qui montent plus au nord et plus à l'est. Un seul fichier pour les deux,
    # chaque figure choisissant ensuite sa propre fenêtre.
    iso = json.loads((RACINE / "data/isohyetes-pan-fao54.json").read_text(encoding="utf-8"))
    pts += [(x, y) for i in iso["isohyetes"] for x, y in i["points"]]
    lon0 = min(x for x, _ in pts) - MARGE
    lon1 = max(x for x, _ in pts) + MARGE
    lat0 = min(y for _, y in pts) - MARGE
    lat1 = max(y for _, y in pts) + MARGE
    print(f"{len(pts)} repères et sommets · fenêtre "
          f"{lon0:.1f}..{lon1:.1f} × {lat0:.1f}..{lat1:.1f}")

    sortie, vus = [], set()
    for f in ne["features"]:
        props = f["properties"]
        nom_ne = props.get("NAME") or props.get("name") or ""
        anneaux = []
        for anneau in anneaux_de(f["geometry"]):
            # On ne garde que les anneaux qui touchent la fenêtre.
            xs = [p[0] for p in anneau]; ys = [p[1] for p in anneau]
            if max(xs) < lon0 or min(xs) > lon1 or max(ys) < lat0 or min(ys) > lat1:
                continue
            simple = douglas_peucker([[round(x, 3), round(y, 3)] for x, y in anneau], TOLERANCE)
            if len(simple) >= 4:
                anneaux.append(simple)
        if not anneaux:
            continue
        nom = PRINCIPAUX.get(nom_ne) or VOISINS.get(nom_ne, nom_ne)
        if nom in vus:
            continue
        vus.add(nom)
        sortie.append({"nom": nom, "principal": nom_ne in PRINCIPAUX, "anneaux": anneaux})

    sortie.sort(key=lambda p: (not p["principal"], p["nom"]))
    manquants = set(PRINCIPAUX.values()) - {p["nom"] for p in sortie if p["principal"]}
    if manquants:
        sys.exit(f"pays du catalogue absents du fond : {sorted(manquants)}")

    doc = {
        "source": "Natural Earth, admin_0 countries, résolution 1:50 000 000 — domaine public.",
        "note": (f"Découpé sur la fenêtre des stations IDF du CIEH et simplifié "
                 f"(Douglas-Peucker, tolérance {TOLERANCE}° ≈ 3 km). "
                 "Sert à situer les stations, pas à mesurer."),
        "boite": [round(lon0, 1), round(lat0, 1), round(lon1, 1), round(lat1, 1)],
        "pays": sortie,
    }
    dest = RACINE / "data/frontieres-afrique.json"
    dest.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    principaux = sum(1 for p in sortie if p["principal"])
    sommets = sum(len(a) for p in sortie for a in p["anneaux"])
    print(f"{len(sortie)} pays ({principaux} du catalogue), {sommets} sommets, "
          f"{dest.stat().st_size // 1024} Ko")


if __name__ == "__main__":
    main()
