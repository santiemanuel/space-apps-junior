"""Tileset de Gale (public/assets/mars/tiles.png): la base en versión cálida y polvorienta + el suelo de Gale.

- Tiles 0–23: los de la nave (public/assets/ship/tiles.png) con la paleta corrida del lavanda a un beige tostado y
  polvo rojizo en los pisos. Mismo dibujo e índices que la nave, así la base usa los mismos que `ship.json`.
- Tiles 24–43: el suelo de Gale generado con codex (prompts `gale-*`), ya armado por `tiles.py` en
  `art/snapped/gale-suelo.png` (24 px de arte por tile, ×2).

Uso: python scripts/art/tiles.py art/snapped/gale-suelo.png $(cat art/tiles-gale.args)
     python scripts/art/gale-tiles.py
"""
import colorsys
import random
from PIL import Image

SHIP = 'public/assets/ship/tiles.png'
GROUND = 'art/snapped/gale-suelo.png'
OUT = 'public/assets/mars/tiles.png'
T = 48
COLUMNS = 4
# Tiles de la nave que no se tiñen: el piso del refugio de agua (azul a propósito) y el espacio.
KEEP = {7, 15}
# Pisos que juntan polvo (pisos, pasillo, franja de peligro).
DUSTY = {0, 1, 2, 3, 4, 5, 6}
DUST = [(176, 112, 74), (158, 96, 62), (192, 132, 92)]
# Tiles del suelo con un borde que se ve como costura al repetirlos (restos del marco o de la celda vecina en la
# hoja generada): se reemplaza la línea de píxeles de arte del borde por la de adentro.
EDGE_FIX = {34: 'b', 43: 'lrtb'}


def warm(rgb):
    """Lavanda y violeta → beige tostado; los azules saturados (luces) y los naranjas/amarillos quedan igual."""
    r, g, b = (c / 255 for c in rgb)
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    deg = h * 360
    if not (200 <= deg <= 300) or (s > 0.6 and v > 0.4):
        return rgb
    if v < 0.2:
        h2, s2, v2 = 15 / 360, 0.55, v * 1.1
    else:
        h2, s2, v2 = (28 + (deg - 255) * 0.25) / 360, min(1, s * 1.3 + 0.08), v * 0.97
    return tuple(round(c * 255) for c in colorsys.hsv_to_rgb(h2, s2, v2))


def base_tiles() -> Image.Image:
    ship = Image.open(SHIP).convert('RGBA')
    out = ship.copy()
    px, opx = ship.load(), out.load()
    for y in range(ship.height):
        for x in range(ship.width):
            index = (y // T) * COLUMNS + x // T
            r, g, b, a = px[x, y]
            if a and index not in KEEP:
                opx[x, y] = (*warm((r, g, b)), a)
    # Polvo: motas de un píxel de arte (2 px), más hacia los bordes del tile, donde se junta.
    rnd = random.Random(2024)
    for index in DUSTY:
        ox, oy = (index % COLUMNS) * T, (index // COLUMNS) * T
        for _ in range(26):
            ax, ay = rnd.randrange(24), rnd.randrange(24)
            if min(ax, ay, 23 - ax, 23 - ay) > 5 and rnd.random() < 0.6:
                continue
            color = rnd.choice(DUST)
            for dx in (0, 1):
                for dy in (0, 1):
                    opx[ox + ax * 2 + dx, oy + ay * 2 + dy] = (*color, 255)
    return out


def fix_edges(sheet: Image.Image, first: int):
    """Copia sobre cada borde pedido la línea de arte (2 px) que tiene adentro."""
    for index, sides in EDGE_FIX.items():
        i = index - first
        x0, y0 = (i % COLUMNS) * T, (i // COLUMNS) * T
        tile = sheet.crop((x0, y0, x0 + T, y0 + T))
        boxes = {'l': ((2, 0, 4, T), (0, 0)), 'r': ((T - 4, 0, T - 2, T), (T - 2, 0)),
                 't': ((0, 2, T, 4), (0, 0)), 'b': ((0, T - 4, T, T - 2), (0, T - 2))}
        for side in sides:
            box, at = boxes[side]
            tile.paste(tile.crop(box), at)
        sheet.paste(tile, (x0, y0))


if __name__ == '__main__':
    base = base_tiles()
    ground = Image.open(GROUND).convert('RGBA')
    fix_edges(ground, (base.height // T) * COLUMNS)
    out = Image.new('RGBA', (COLUMNS * T, base.height + ground.height), (0, 0, 0, 0))
    out.paste(base, (0, 0))
    out.paste(ground, (0, base.height))
    out.save(OUT)
    print(f'{OUT}: {(out.height // T) * COLUMNS} tiles ({out.width} x {out.height})')
