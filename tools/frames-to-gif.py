#!/usr/bin/env python3
"""Assemble les images capturées en deux GIF. Appelé par tools/gifs-pluvio.mjs."""
import sys
from pathlib import Path
from PIL import Image

dossier = Path(sys.argv[1])
racine = Path(__file__).resolve().parent.parent

# Un appelant peut donner ses propres couples « préfixe:sortie.gif » ; sinon on
# assemble les deux planches du pluviomètre et du pluviographe.
couples = [tuple(a.split(":", 1)) for a in sys.argv[2:]] or \
          [("metre", "pluviometre.gif"), ("graphe", "pluviographe.gif")]

# Les images de l'orage sont tenues plus longtemps : c'est le moment à voir.
def duree(nom):
    k = int(nom.stem.split("-")[1])
    return 220 if 14 <= k <= 24 else 110

for prefixe, sortie in couples:
    fichiers = sorted(dossier.glob(f"{prefixe}-*.png"))
    if not fichiers:
        sys.exit(f"aucune image {prefixe}-*.png dans {dossier}")
    # Les captures n'ont pas toutes exactement la même hauteur — un texte qui
    # passe à la ligne suffit. L'encodeur GIF impose la taille de la PREMIÈRE
    # image et rogne les autres : on aligne donc tout sur la plus grande, en
    # complétant en blanc, plutôt que de perdre le bas du dernier dessin.
    brutes = []
    for f in fichiers:
        im = Image.open(f).convert("RGB")
        brutes.append(im.resize((im.width // 2, im.height // 2), Image.LANCZOS))
    W = max(im.width for im in brutes)
    H = max(im.height for im in brutes)
    images = []
    for im in brutes:
        if im.size != (W, H):
            fond = Image.new("RGB", (W, H), "white")
            fond.paste(im, (0, 0))
            im = fond
        images.append(im.convert("P", palette=Image.ADAPTIVE, colors=64))
    chemin = racine / "assets" / sortie
    # Les images identiques sont fusionnées par l'encodeur — le pluviomètre n'a
    # rien à montrer avant six heures — mais leurs DURÉES s'additionnent : les
    # deux GIF durent 6 270 ms l'un comme l'autre, et restent donc synchrones
    # quand on les projette côte à côte. Vérifié, pas supposé.
    images[0].save(chemin, save_all=True, append_images=images[1:],
                   duration=[duree(f) for f in fichiers], loop=0, optimize=True, disposal=2)
    ko = chemin.stat().st_size / 1024
    print(f"✓ {sortie} — {len(images)} images, {images[0].width}×{images[0].height}, {ko:.0f} Ko")
