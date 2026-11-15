"""Separa los sprites de una hoja generada (antes del pixel-snapper) en archivos sueltos para pasarlos de a uno.

El snapper calcula una sola grilla para toda la imagen; si cada personaje quedó dibujado con un desfasaje distinto,
algunos cuadros pierden o ganan columnas (el casco "respira" en la animación). De a uno, cada cuadro tiene su grilla.

Uso: python scripts/art/cells.py art/raw/<hoja>.png --cols 3 --rows 3 [--margin 12]
  escribe <carpeta del snapper>/cell-<hoja>-<n>.png (n en orden de lectura)
"""
import argparse
import sys
from pathlib import Path
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from slice import bands  # noqa: E402

SNAPPER_DIR = Path(r'C:\code-hello\mcp-snapper\assets')

parser = argparse.ArgumentParser()
parser.add_argument('source')
parser.add_argument('--cols', type=int, required=True)
parser.add_argument('--rows', type=int, required=True)
parser.add_argument('--margin', type=int, default=12)
args = parser.parse_args()

src = Path(args.source)
im = Image.open(src).convert('RGBA')
im.putalpha(im.getchannel('A').point(lambda a: 255 if a >= 128 else 0))
px = im.getchannel('A').load()
n = 0
for top, bottom in bands([any(px[x, y] for x in range(im.width)) for y in range(im.height)], args.rows):
    for left, right in bands([any(px[x, y] for y in range(top, bottom)) for x in range(im.width)], args.cols):
        cell = im.crop((left, top, right, bottom))
        l, t, r, b = cell.getchannel('A').getbbox()
        m = args.margin
        box = (max(0, left + l - m), max(0, top + t - m), min(im.width, left + r + m), min(im.height, top + b + m))
        im.crop(box).save(SNAPPER_DIR / f'cell-{src.stem}-{n}.png')
        n += 1
print(f'{src.stem}: {n} cuadros en {SNAPPER_DIR}')
