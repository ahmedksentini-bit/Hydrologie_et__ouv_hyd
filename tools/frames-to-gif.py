#!/usr/bin/env python3
"""Assemble les images capturées en deux GIF. Appelé par tools/gifs-pluvio.mjs."""
import sys
from pathlib import Path
from PIL import Image

dossier = Path(sys.argv[1])
racine = Path(__file__).resolve().parent.parent

# Les images de l'orage sont tenues plus longtemps : c'est le moment à voir.
def duree(nom):
    k = int(nom.stem.split("-")[1])
    return 220 if 14 <= k <= 24 else 110

for prefixe, sortie in (("metre", "pluviometre.gif"), ("graphe", "pluviographe.gif")):
    fichiers = sorted(dossier.glob(f"{prefixe}-*.png"))
    if not fichiers:
        sys.exit(f"aucune image {prefixe}-*.png dans {dossier}")
    images = []
    for f in fichiers:
        im = Image.open(f).convert("RGB")
        im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)   # retour à 1×
        images.append(im.convert("P", palette=Image.ADAPTIVE, colors=96))
    chemin = racine / "assets" / sortie
    # Les images identiques sont fusionnées par l'encodeur — le pluviomètre n'a
    # rien à montrer avant six heures — mais leurs DURÉES s'additionnent : les
    # deux GIF durent 6 270 ms l'un comme l'autre, et restent donc synchrones
    # quand on les projette côte à côte. Vérifié, pas supposé.
    images[0].save(chemin, save_all=True, append_images=images[1:],
                   duration=[duree(f) for f in fichiers], loop=0, optimize=True, disposal=2)
    ko = chemin.stat().st_size / 1024
    print(f"✓ {sortie} — {len(images)} images, {images[0].width}×{images[0].height}, {ko:.0f} Ko")
