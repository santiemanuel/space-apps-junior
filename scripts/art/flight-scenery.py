"""Escenografía generada de los despegues (escena `Maneuver`): fondos lejano y cercano de cada sitio y las naves y
estructuras sueltas. Parte de las imágenes ya pasadas por el pixel-snapper (`art/snapped/vuelo-*.png`).

Uso: python scripts/art/flight-scenery.py
Escribe en public/assets/ui/flight/ a tamaño de arte (el juego las agranda ×4; registro en docs/pixel-art.md).
- Fondos: 320 × 180, alfa binario, lo de arriba transparente.
- Hojas en fila (`vuelo-naves`, `vuelo-objetos`): cada objeto separado por columnas vacías, recortado a su contenido.
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SNAPPED = ROOT / 'art' / 'snapped'
OUT = ROOT / 'public' / 'assets' / 'ui' / 'flight'

BACKDROPS = {
    'vuelo-tierra-lejos': 'earth-far',
    'vuelo-tierra-cerca': 'earth-near',
    'vuelo-marte-lejos': 'mars-far',
    'vuelo-marte-cerca': 'mars-near',
}
SHEETS = {
    'vuelo-naves': ['core', 'side-booster', 'launch-tower', 'ascent-vehicle'],
    'vuelo-objetos': ['service-mast', 'fuel-tanks', 'mothership', 'van'],
}


def binary(im: Image.Image) -> Image.Image:
    im = im.convert('RGBA')
    im.putalpha(im.getchannel('A').point(lambda a: 255 if a >= 128 else 0))
    return im


def drop_sky(im: Image.Image) -> Image.Image:
    """Quita los restos claros del cielo (halos blancos pegados a lo transparente) con un relleno desde arriba."""
    px = im.load()
    w, h = im.size
    pale = lambda p: p[3] and min(p[:3]) > 200 and max(p[:3]) - min(p[:3]) < 40
    stack = [(x, y) for x in range(w) for y in range(h) if not px[x, y][3]]
    seen = set(stack)
    while stack:
        x, y = stack.pop()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in seen and pale(px[nx, ny]):
                seen.add((nx, ny))
                px[nx, ny] = (0, 0, 0, 0)
                stack.append((nx, ny))
    return im


def objects(im: Image.Image, count: int) -> list[Image.Image]:
    """Corta por columnas vacías y une los tramos más cercanos hasta que queden `count` objetos."""
    alpha = im.getchannel('A')
    w, h = im.size
    filled = [alpha.crop((x, 0, x + 1, h)).getbbox() is not None for x in range(w)]
    runs, start = [], None
    for x, on in enumerate(filled + [False]):
        if on and start is None:
            start = x
        elif not on and start is not None:
            runs.append([start, x])
            start = None
    while len(runs) > count:
        _, i = min((runs[i + 1][0] - runs[i][1], i) for i in range(len(runs) - 1))
        runs[i][1] = runs[i + 1][1]
        del runs[i + 1]
    pieces = []
    for a, b in runs:
        piece = im.crop((a, 0, b, h))
        pieces.append(piece.crop(piece.getbbox()))
    return pieces


for source, name in BACKDROPS.items():
    im = drop_sky(binary(Image.open(SNAPPED / f'{source}.png')).resize((320, 180), Image.NEAREST))
    im.save(OUT / f'{name}.png')
    print(name, im.size)

for source, names in SHEETS.items():
    for name, piece in zip(names, objects(binary(Image.open(SNAPPED / f'{source}.png')), len(names)), strict=True):
        piece.save(OUT / f'{name}.png')
        print(name, piece.size)
