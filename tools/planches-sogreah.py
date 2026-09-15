#!/usr/bin/env python3
"""
Redessine les trois planches SOGREAH (P0, P10, P100) sur le fond de carte du
cours : mer, pays voisins, contour de la Tunisie — puis les zones par-dessus.

Sans ce fond, les zones flottaient dans le vide : on ne voyait ni la côte, ni
la frontière algérienne, ni où s'arrête la couverture de la méthode. Le fond
répond à ces trois questions d'un coup, et il est LE MÊME que celui des cartes
interactives (data/frontieres.json, Natural Earth, domaine public) — une carte
du cours ne doit pas ressembler à une autre carte du cours par hasard.

    python3 tools/planches-sogreah.py

écrit assets/carte_sogreah_{p0,p10,p100}.png.
"""
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon as MplPoly
from matplotlib.lines import Line2D

RACINE = Path(__file__).resolve().parent.parent
ZONES = json.load(open(RACINE / "tools" / "sogreah_zones.geojson"))
FRONTIERES = json.load(open(RACINE / "data" / "frontieres.json"))

# Palette du fond, reprise telle quelle de src/carte-fond.js.
FOND = {"mer": "#eaf4fb", "voisin": "#f1f5f9", "voisinTrait": "#dde5ec",
        "principal": "#f8fafc", "principalTrait": "#94a3b8", "etiquette": "#94a3b8"}

FENETRE = (7.25, 11.8, 31.95, 36.55)          # lon0, lon1, lat0, lat1

VILLES = [('Thala', 8.67, 35.57), ('Kairouan', 10.10, 35.68), ('Kasserine', 8.83, 35.17),
          ('Sbeitla', 9.12, 35.24), ('Sidi Bouzid', 9.48, 35.04), ('El Jem', 10.71, 35.30),
          ('Mahdia', 11.06, 35.50), ('Sfax', 10.76, 34.74), ('Maknassy', 9.61, 34.63),
          ('Gafsa', 8.78, 34.42), ('Métlaoui', 8.40, 34.32), ('Tozeur', 8.13, 33.92),
          ('Kébili', 8.97, 33.70), ('Douz', 9.02, 33.46), ('Gabès', 10.10, 33.88),
          ('Zarzis', 11.11, 33.50), ('Médenine', 10.50, 33.35),
          ('Ben Gardane', 11.22, 33.14), ('Tataouine', 10.45, 32.93)]

TITRES = {'P0': "Seuil de ruissellement  $P_0$  (mm)",
          'P10': "Pluie journalière décennale  $P_{10}$  (mm)",
          'P100': "Pluie journalière centennale  $P_{100}$  (mm)"}

VOISINS = ("Algérie", "Libye")


def polys(g):
    return [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]


def in_ring(pt, ring):
    """
    Lancer de rayon, avec RETOUR AU PREMIER POINT. Les anneaux des zones sont
    fermés, mais celui de l'Algérie ne l'est pas : découpé sur la fenêtre, il
    commence et finit sur le bord gauche. Sauter ce segment de fermeture faisait
    répondre « dehors » partout en Algérie, et l'étiquette du pays disparaissait.
    """
    x, y = pt
    c = False
    n = len(ring)
    for i in range(n):
        x1, y1 = ring[i - 1][:2]
        x2, y2 = ring[i][:2]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c


def in_poly(pt, poly):
    return in_ring(pt, poly[0]) and not any(in_ring(pt, h) for h in poly[1:])


def centroid(ring):
    a = cx = cy = 0.0
    for i in range(len(ring) - 1):
        x1, y1 = ring[i][:2]
        x2, y2 = ring[i + 1][:2]
        cr = x1 * y2 - x2 * y1
        a += cr
        cx += (x1 + x2) * cr
        cy += (y1 + y2) * cr
    if abs(a) < 1e-12:
        return None
    a *= 0.5
    return (cx / (6 * a), cy / (6 * a))


def pole(poly):
    """Point intérieur « au large » : milieu du plus long segment horizontal inscrit."""
    ys = [c[1] for c in poly[0]]
    y0, y1 = min(ys), max(ys)
    best = (0, None)
    for k in range(1, 40):
        y = y0 + (y1 - y0) * k / 40
        xs = []
        for ring in poly:
            for i in range(len(ring) - 1):
                xa, ya = ring[i][:2]
                xb, yb = ring[i + 1][:2]
                if (ya > y) != (yb > y):
                    xs.append((xb - xa) * (y - ya) / (yb - ya) + xa)
        xs.sort()
        for i in range(0, len(xs) - 1, 2):
            if xs[i + 1] - xs[i] > best[0]:
                best = (xs[i + 1] - xs[i], ((xs[i] + xs[i + 1]) / 2, y))
    return best[1]


def au_large(anneaux):
    """
    Pose une étiquette de pays au point le plus éloigné de toute frontière, à
    l'intérieur du pays et de la fenêtre. Un ancrage choisi à la main finit
    toujours par tomber sur un trait — c'est ce qui était arrivé à « LIBYE »,
    posée en travers de la frontière.
    """
    lon0, lon1, lat0, lat1 = FENETRE
    bas = lat0 + 0.20 * (lat1 - lat0)   # au-dessus de la légende et de la mention
    sommets = [c for a in anneaux for c in a]
    meilleur, choix = -1.0, None
    for i in range(1, 80):
        for j in range(1, 80):
            lon = lon0 + (i / 80) * (lon1 - lon0)
            lat = lat0 + (j / 80) * (lat1 - lat0)
            if lat < bas or not any(in_ring((lon, lat), a) for a in anneaux):
                continue
            # On s'éloigne à la fois des frontières ET du cadre : sans le second
            # terme le point optimal fuit dans un coin de la fenêtre, où le
            # texte se fait couper.
            d = min(min(((c[0] - lon) ** 2 + (c[1] - lat) ** 2) ** 0.5 for c in sommets),
                    lon - lon0, lon1 - lon, lat - lat0, lat1 - lat)
            if d > meilleur:
                meilleur, choix = d, (lon, lat)
    return choix


def fond(ax):
    """Mer, voisins, Tunisie — dans cet ordre, sous les zones."""
    lon0, lon1, lat0, lat1 = FENETRE
    ax.add_patch(MplPoly([(lon0, lat0), (lon1, lat0), (lon1, lat1), (lon0, lat1)],
                         closed=True, facecolor=FOND["mer"], edgecolor="none", zorder=0))
    for pays in sorted(FRONTIERES["pays"], key=lambda p: bool(p.get("principal"))):
        principal = bool(pays.get("principal"))
        for anneau in pays["anneaux"]:
            ax.add_patch(MplPoly([(c[0], c[1]) for c in anneau], closed=True,
                                 facecolor=FOND["principal"] if principal else FOND["voisin"],
                                 edgecolor=FOND["principalTrait"] if principal else FOND["voisinTrait"],
                                 linewidth=0.9 if principal else 0.6,
                                 zorder=0.5 if principal else 0.4))
    for pays in FRONTIERES["pays"]:
        if pays["nom"] not in VOISINS:
            continue
        pos = au_large(pays["anneaux"])
        if pos:
            ax.text(pos[0], pos[1], pays["nom"].upper(), fontsize=5.4,
                    color=FOND["etiquette"], ha="center", va="center", zorder=1.5)


def planche(param, fts):
    fig, ax = plt.subplots(figsize=(4.9, 5.9))
    fond(ax)
    for ft in sorted(fts, key=lambda f: f["properties"]["value"]):
        p = ft["properties"]
        for poly in polys(ft["geometry"]):
            ax.add_patch(MplPoly([(c[0], c[1]) for c in poly[0]], closed=True,
                                 facecolor=p["fill"], edgecolor="#3E4A63",
                                 linewidth=0.6, zorder=2))
            ct = centroid(poly[0])
            if not (ct and in_poly(ct, poly)):
                ct = pole(poly)                 # centroïde hors du polygone (forme concave)
            if ct:
                ax.text(ct[0], ct[1], str(p["value"]), fontsize=6.4, weight="bold",
                        ha="center", va="center", color="#16233A", zorder=7,
                        bbox=dict(boxstyle="round,pad=0.15", fc="white", ec="none", alpha=0.62))
    for nom, lon, lat in VILLES:
        ax.plot(lon, lat, "o", ms=2.2, color="#14181F", zorder=5)
        ax.annotate(nom, (lon, lat), xytext=(2.5, 1.8), textcoords="offset points",
                    fontsize=5.4, color="#14181F", zorder=6)

    lon0, lon1, lat0, lat1 = FENETRE
    ax.set_xlim(lon0, lon1)
    ax.set_ylim(lat0, lat1)
    ax.set_aspect(1 / 0.81)
    ax.set_xlabel("longitude (° E)", fontsize=6.5)
    ax.set_ylabel("latitude (° N)", fontsize=6.5)
    ax.tick_params(labelsize=6)
    ax.grid(True, color="#DCE1EA", lw=0.35, zorder=1)
    for s in ax.spines.values():
        s.set_edgecolor("#8C97AC")
    ax.set_title(TITRES[param], fontsize=9.5, color="#1F3864", pad=6)

    vals = sorted({f["properties"]["value"] for f in fts})
    cols = {f["properties"]["value"]: f["properties"]["fill"] for f in fts}
    ax.legend(handles=[Line2D([0], [0], marker="s", ls="", ms=7, mec="#3E4A63",
                              mfc=cols[v], label=f"{v} mm") for v in vals],
              loc="lower left", fontsize=6, framealpha=0.95, handletextpad=0.5,
              borderpad=0.5, labelspacing=0.32)
    ax.text(0.985, 0.012, "planche redessinée — couverture : Centre et Sud",
            transform=ax.transAxes, fontsize=5.2, color="#5A6478", ha="right", va="bottom")
    fig.tight_layout()
    sortie = RACINE / "assets" / f"carte_sogreah_{param.lower()}.png"
    fig.savefig(sortie, dpi=200)
    plt.close(fig)
    print("✓", sortie.name, vals)


def controles():
    """
    Deux vérifications avant de dessiner, l'une et l'autre nées d'une erreur.
    """
    lon0, lon1, lat0, lat1 = FENETRE
    bx = FRONTIERES["boite"]
    assert bx[0] <= lon0 and bx[2] >= lon1 and bx[1] <= lat0 and bx[3] >= lat1, \
        "le fond de carte ne couvre pas la fenêtre des planches"
    # L'anneau algérien est OUVERT (découpé sur le bord gauche) : un lancer de
    # rayon qui saute le segment de fermeture répond « dehors » partout.
    algerie = next(p for p in FRONTIERES["pays"] if p["nom"] == "Algérie")["anneaux"][0]
    assert in_ring((7.40, 34.60), algerie), "point algérien vu hors d'Algérie"
    assert not in_ring((9.50, 34.60), algerie), "point tunisien vu en Algérie"


if __name__ == "__main__":
    controles()
    par_param = {}
    for ft in ZONES["features"]:
        par_param.setdefault(ft["properties"]["param"], []).append(ft)
    for param, fts in par_param.items():
        planche(param, fts)
