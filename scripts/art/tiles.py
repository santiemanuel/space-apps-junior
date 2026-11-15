"""Arma un tileset a partir de una hoja en grilla que ya pasó por el pixel-snapper.

Corta cada hoja en columnas × filas iguales, ajusta cada celda al tamaño de tile de arte quitando o duplicando
líneas repetidas (el snapper deja celdas de 24 ± 2 px) y exporta ampliado. Con 24 px de arte y escala 2 quedan tiles de 48 px.

Uso: python scripts/art/tiles.py <destino.png> <hoja.png>:2:2 [<otra.png>:1:1:m ...]  (`:m` = espejado) [--columns 4] [--tile 24] [--scale 2]
"""
import argparse
from pathlib import Path
from PIL import Image

SNAPPER_DIR = Path(r'C:\code-hello\mcp-snapper\assets')



def difference(im, a, b, vertical):
    """Diferencia entre dos columnas (o filas) vecinas."""
    px = im.load()
    n = im.height if vertical else im.width
    get = (lambda i, k: px[i, k]) if vertical else (lambda i, k: px[k, i])
    return sum(abs(x - y) for k in range(n) for x, y in zip(get(a, k), get(b, k)))


def fit_axis(im, target, vertical):
    """Lleva el ancho (o el alto) a `target` quitando o duplicando la línea más parecida a su vecina."""
    while (im.width if vertical else im.height) != target:
        size = im.width if vertical else im.height
        i = min(range(size - 1), key=lambda k: difference(im, k, k + 1, vertical))
        grow = size < target
        out = Image.new('RGBA', (im.width + (1 if grow else -1), im.height) if vertical else (im.width, im.height + (1 if grow else -1)))
        first = im.crop((0, 0, i + 1, im.height) if vertical else (0, 0, im.width, i + 1))
        rest = im.crop((i if grow else i + 2, 0, im.width, im.height) if vertical else (0, i if grow else i + 2, im.width, im.height))
        out.paste(first, (0, 0))
        out.paste(rest, (i + 1, 0) if vertical else (0, i + 1))
        im = out
    return im


def fit(im, t):
    """Ajusta una celda al tile exacto sin reescalar: el snapper a veces parte un píxel de arte en dos líneas."""
    return fit_axis(fit_axis(im, t, True), t, False)


parser = argparse.ArgumentParser()
parser.add_argument('dest')
parser.add_argument('sheets', nargs='+', help='hoja:columnas:filas, en el orden en que quedan en el tileset')
parser.add_argument('--columns', type=int, default=4, help='columnas del tileset final')
parser.add_argument('--tile', type=int, default=24)
parser.add_argument('--scale', type=int, default=2)
args = parser.parse_args()

t = args.tile
tiles = []
for spec in args.sheets:
    *path, cols, rows = spec.split(':')
    mirror = rows == 'm'
    if mirror:
        *path, cols, rows = path + [cols]
    name = ':'.join(path)
    cols, rows = int(cols), int(rows)
    source = Path(name)
    im = Image.open(source if source.exists() else SNAPPER_DIR / source).convert('RGBA')
    im.putalpha(255)
    for row in range(rows):
        for col in range(cols):
            box = (round(col * im.width / cols), round(row * im.height / rows),
                   round((col + 1) * im.width / cols), round((row + 1) * im.height / rows))
            tile = fit(im.crop(box), t)
            tiles.append(tile.transpose(Image.Transpose.FLIP_LEFT_RIGHT) if mirror else tile)
sheet = Image.new('RGBA', (args.columns * t, -(-len(tiles) // args.columns) * t), (0, 0, 0, 0))
for i, tile in enumerate(tiles):
    sheet.paste(tile, ((i % args.columns) * t, (i // args.columns) * t))
out = sheet.resize((sheet.width * args.scale, sheet.height * args.scale), Image.NEAREST)
Path(args.dest).parent.mkdir(parents=True, exist_ok=True)
out.save(args.dest)
print(f'{args.dest}: {len(tiles)} tiles de {t * args.scale} px ({out.width}x{out.height})')
