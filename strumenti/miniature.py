#!/usr/bin/env python3
"""Prepara le versioni più leggere delle immagini che il sito mostra piccole.

    python3 strumenti/miniature.py

- copertine dei brani (contenuti/musica/<nome>.webp e src/img/copertina-riserva-512.webp):
  una versione da 160 px, <nome>-160.webp, per l'elenco dei brani e il lettore (si vedono a 44-52 px);
  la copertina grande resta per la schermata di blocco del telefono;
- tavole delle pillole (contenuti/caroselli/<slug>/NN.webp, 1080x1350): una versione da 810 px,
  NN-810.webp, che i telefoni con schermo meno denso e i computer scaricano al posto di quella grande.

Rifà solo i file che mancano o che sono più vecchi dell'originale. Serve Pillow (c'è già nello spazio
di lavoro di Claude; sul PC: pip install pillow). build.mjs usa le versioni piccole se ci sono,
altrimenti va avanti con quelle grandi.
"""
from pathlib import Path
import re
import sys

from PIL import Image

RADICE = Path(__file__).resolve().parent.parent


def da_rifare(origine: Path, destinazione: Path) -> bool:
    return not destinazione.exists() or destinazione.stat().st_mtime < origine.stat().st_mtime


def riduci(origine: Path, destinazione: Path, larghezza: int, qualita: int) -> bool:
    if not da_rifare(origine, destinazione):
        return False
    with Image.open(origine) as im:
        im = im.convert("RGB")
        if im.width <= larghezza:
            return False
        altezza = round(im.height * larghezza / im.width)
        im.resize((larghezza, altezza), Image.LANCZOS).save(destinazione, "WEBP", quality=qualita, method=6)
    return True


def principale() -> int:
    fatti = 0
    copertine = [p for p in (RADICE / "contenuti" / "musica").glob("*.webp") if not p.stem.endswith("-160")]
    copertine.append(RADICE / "src" / "img" / "copertina-riserva-512.webp")
    for p in copertine:
        nome = re.sub(r"-512$", "", p.stem) + "-160.webp"
        if riduci(p, p.with_name(nome), 160, 82):
            fatti += 1
    for p in sorted((RADICE / "contenuti" / "caroselli").glob("*/[0-9][0-9].webp")):
        if riduci(p, p.with_name(f"{p.stem}-810.webp"), 810, 80):
            fatti += 1
    print(f"Miniature fatte: {fatti}")
    return 0


if __name__ == "__main__":
    sys.exit(principale())
