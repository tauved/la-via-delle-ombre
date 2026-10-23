#!/usr/bin/env python3
"""Prepara i sigilli della sezione «I miei social» per la versione in 3D.

Da ogni immagine (contenuti/social/<nome>.webp: segno lime su disco scuro) ricava:

- contenuti/social/3d/<nome>.webp la forma del segno come campo di distanza in grigio
  (128 = bordo, più chiaro dentro, più scuro fuori). Il sito la usa per disegnare la faccia
  del rilievo con i bordi netti a qualunque grandezza, e da lì ricava anche l'alone.
- contenuti/social/3d/<nome>.json i contorni del segno, da cui il sito alza le pareti del
  rilievo. Coordinate intere in millesimi del raggio del disco (-1000…1000, y verso l'alto),
  ogni contorno girato in modo che l'esterno del segno stia alla sua destra.

Uso:  python3 strumenti/sigilli_3d.py [nome.webp …]   (senza nomi: tutti quelli di sito.json → social)
Serve Python con Pillow, numpy, OpenCV (cv2) e SciPy. Va rifatto solo quando cambia un sigillo.
"""

import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage

RADICE = Path(__file__).resolve().parent.parent
SOCIAL = RADICE / "contenuti" / "social"
USCITA = SOCIAL / "3d"

SCALA = 3  # il segno si ricava a 3 volte la grandezza dell'immagine, per contorni morbidi
LATO_TEX = 512  # lato della texture col campo di distanza
CAMPO = 24.0  # texel di distanza codificati da una parte e dall'altra del bordo (serve anche per l'alone)


def maschera_segno(percorso: Path) -> np.ndarray:
    """Il segno lime, ingrandito: True dentro le linee."""
    rgb = np.asarray(Image.open(percorso).convert("RGB")).astype(np.float32)
    lato = rgb.shape[0]
    if rgb.shape[0] != rgb.shape[1]:
        raise SystemExit(f"{percorso.name}: il sigillo deve essere quadrato")
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    # quanto un pixel è «lime»: verde alto, più verde del blu (il disco e l'anello sono viola)
    lime = np.clip((g - 110.0) / 120.0, 0, 1) * np.clip((g - b - 30.0) / 60.0, 0, 1) * np.clip((r - 60.0) / 80.0, 0, 1)
    grande = cv2.resize(lime, (lato * SCALA, lato * SCALA), interpolation=cv2.INTER_CUBIC)
    grande = cv2.GaussianBlur(grande, (0, 0), SCALA * 0.6)
    m = grande > 0.55
    # via i puntini sparsi
    etichette, n = ndimage.label(m)
    if n:
        aree = ndimage.sum(m, etichette, range(1, n + 1))
        tieni = np.isin(etichette, 1 + np.flatnonzero(aree >= (SCALA * 6) ** 2))
        m &= tieni
    return m


def campo_distanza(m: np.ndarray) -> np.ndarray:
    dentro = ndimage.distance_transform_edt(m)
    fuori = ndimage.distance_transform_edt(~m)
    return dentro - fuori  # in pixel della maschera grande, positivo dentro


def texture(m: np.ndarray) -> Image.Image:
    lato = m.shape[0]
    d = campo_distanza(m).astype(np.float32) * (LATO_TEX / lato)
    d = cv2.resize(d, (LATO_TEX, LATO_TEX), interpolation=cv2.INTER_AREA)
    grigio = np.clip(128.0 + d * (127.0 / CAMPO), 0, 255).round().astype(np.uint8)
    return Image.fromarray(grigio, "L")


def contorni(m: np.ndarray) -> list[list[int]]:
    lato = m.shape[0]
    meta = lato / 2.0
    trovati, _ = cv2.findContours(m.astype(np.uint8), cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
    risultato = []
    for c in trovati:
        if cv2.contourArea(c) < (SCALA * 3) ** 2:
            continue
        c = cv2.approxPolyDP(c, SCALA * 0.35, True).reshape(-1, 2).astype(np.float64)
        if len(c) < 3:
            continue
        # i pixel di findContours stanno sul bordo interno: il contorno vero passa a mezzo pixel più fuori
        c = c + 0.5
        # verso: l'esterno del segno deve stare alla destra di chi percorre il contorno
        a, b = c[0], c[1]
        mezzo = (a + b) / 2
        dx, dy = b - a
        lung = max(np.hypot(dx, dy), 1e-9)
        destra = np.array([-dy, dx]) / lung  # destra in coordinate immagine (y verso il basso)
        prova = np.round(mezzo + destra * SCALA * 1.5).astype(int)
        x, y = np.clip(prova, 0, lato - 1)
        if m[y, x]:
            c = c[::-1]
        piatto = []
        for x, y in c:
            piatto += [int(round((x - meta) / meta * 1000)), int(round((meta - y) / meta * 1000))]
        risultato.append(piatto)
    return risultato


def prepara(nome: str) -> None:
    sorgente = SOCIAL / nome
    if not sorgente.exists():
        raise SystemExit(f"Manca {sorgente}")
    m = maschera_segno(sorgente)
    base = sorgente.stem
    USCITA.mkdir(exist_ok=True)
    texture(m).save(USCITA / f"{base}.webp", quality=92, method=6)
    linee = contorni(m)
    (USCITA / f"{base}.json").write_text(json.dumps({"versione": 1, "contorni": linee}, separators=(",", ":")) + "\n")
    punti = sum(len(c) // 2 for c in linee)
    print(f"{base}: {len(linee)} contorni, {punti} punti, segno sul {m.mean() * 100:.1f}% del disco")


def main() -> None:
    nomi = sys.argv[1:]
    if not nomi:
        sito = json.loads((RADICE / "contenuti" / "sito.json").read_text())
        nomi = [v["sigillo"] for v in sito.get("social", {}).get("voci", []) if v.get("sigillo")]
    for nome in nomi:
        prepara(Path(nome).name)


if __name__ == "__main__":
    main()
