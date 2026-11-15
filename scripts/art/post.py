"""Deja lista para el juego una imagen que ya pasó por el pixel-snapper.

Alfa binario, recorte al contenido, relleno hasta múltiplos de la grilla de arte (anclado abajo y al centro) y
exportación ampliada con vecino más cercano. Con 24 px de arte por tile y escala 2, el archivo final mide
múltiplos de 48 px (docs/historial/plan-visual.md §3).

Uso: python scripts/art/post.py <snapped.png> <destino.png> [--grid 24] [--scale 2] [--cell x,y,w,h]
  --cell recorta antes una celda de una hoja (en píxeles de la imagen ya pasada por el snapper).
"""
import argparse
from pathlib import Path
from PIL import Image

SNAPPER_DIR = Path(r'C:\code-hello\mcp-snapper\assets')

parser = argparse.ArgumentParser()
parser.add_argument('source')
parser.add_argument('dest')
parser.add_argument('--grid', type=int, default=24)
parser.add_argument('--scale', type=int, default=2)
parser.add_argument('--cell')
args = parser.parse_args()

source = Path(args.source)
im = Image.open(source if source.exists() else SNAPPER_DIR / source).convert('RGBA')
if args.cell:
    x, y, w, h = map(int, args.cell.split(','))
    im = im.crop((x, y, x + w, y + h))
im.putalpha(im.getchannel('A').point(lambda a: 255 if a >= 128 else 0))
im = im.crop(im.getchannel('A').getbbox())
ceil = lambda v: -(-v // args.grid) * args.grid
canvas = Image.new('RGBA', (ceil(im.width), ceil(im.height)), (0, 0, 0, 0))
canvas.alpha_composite(im, ((canvas.width - im.width) // 2, canvas.height - im.height))
out = canvas.resize((canvas.width * args.scale, canvas.height * args.scale), Image.NEAREST)
Path(args.dest).parent.mkdir(parents=True, exist_ok=True)
out.save(args.dest)
print(f'{args.dest}: contenido {im.width}x{im.height} px de arte -> {out.width}x{out.height} px '
      f'({out.width / 48:g} x {out.height / 48:g} tiles)')
