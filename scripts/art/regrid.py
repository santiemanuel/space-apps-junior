"""Remuestrea cada cuadro de una hoja de animación generada con una grilla uniforme, antes del pixel-snapper.

Los "píxeles" que dibuja el generador no miden todos lo mismo. El snapper ajusta su grilla a esas irregularidades
y cada cuadro sale con 2 o 3 columnas de más o de menos: en la animación el personaje se estira y se encoge. Acá
cada cuadro se muestrea con el mismo tamaño de píxel, anclado a su contorno (el borde del contorno siempre cae en
un borde de píxel), así que todos los cuadros quedan con las mismas medidas. Después el snapper sólo limpia la
paleta y confirma la grilla.

Uso: python scripts/art/regrid.py art/raw/<hoja>.png --height 37 [--cols 3 --rows 3] [--zoom 8]
  --height: alto del personaje en píxeles de arte (el mismo para todas las direcciones de un tripulante).
  Escribe <carpeta del snapper>/grid-<hoja>.png: los cuadros en la misma grilla, ampliados ×zoom.
"""
import argparse
import statistics
import sys
from collections import Counter
from pathlib import Path
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from slice import bands  # noqa: E402

SNAPPER_DIR = Path(r'C:\code-hello\mcp-snapper\assets')


def frames_of(im, cols, rows):
    px = im.getchannel('A').load()
    out = []
    for top, bottom in bands([any(px[x, y] for x in range(im.width)) for y in range(im.height)], rows):
        for left, right in bands([any(px[x, y] for y in range(top, bottom)) for x in range(im.width)], cols):
            cell = im.crop((left, top, right, bottom))
            out.append(cell.crop(cell.getchannel('A').getbbox()))
    return out


def resample(frame, p):
    """Un píxel de arte por celda de p × p, anclado abajo a la izquierda: color más común del centro de la celda."""
    w = max(1, round(frame.width / p))
    h = max(1, round(frame.height / p))
    data = frame.load()
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for j in range(h):
        y1 = frame.height - (h - j) * p
        for i in range(w):
            x1 = i * p
            xs = range(max(0, int(x1)), min(frame.width, int(x1 + p)))
            ys = range(max(0, int(y1)), min(frame.height, int(y1 + p)))
            pixels = [data[x, y] for y in ys for x in xs]
            opaque = [c for c in pixels if c[3] >= 128]
            if not pixels or len(opaque) * 2 < len(pixels):
                continue
            # Centro de la celda (sin el 25 % de cada borde), con colores agrupados para tolerar el ruido.
            m = p * 0.25
            inner = [data[x, y] for y in ys if y1 + m <= y < y1 + p - m for x in xs if x1 + m <= x < x1 + p - m]
            inner = [c for c in inner if c[3] >= 128] or opaque
            buckets = Counter((c[0] // 24, c[1] // 24, c[2] // 24) for c in inner)
            key = buckets.most_common(1)[0][0]
            chosen = [c for c in inner if (c[0] // 24, c[1] // 24, c[2] // 24) == key]
            out.putpixel((i, j), tuple(round(sum(c[k] for c in chosen) / len(chosen)) for k in range(3)) + (255,))
    return out


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source')
    parser.add_argument('--height', type=int, required=True)
    parser.add_argument('--cols', type=int, default=3)
    parser.add_argument('--rows', type=int, default=3)
    parser.add_argument('--zoom', type=int, default=8)
    args = parser.parse_args()
    src = Path(args.source)
    im = Image.open(src).convert('RGBA')
    im.putalpha(im.getchannel('A').point(lambda a: 255 if a >= 128 else 0))
    frames = frames_of(im, args.cols, args.rows)
    p = statistics.median(f.height for f in frames) / args.height
    small = [resample(f, p) for f in frames]
    cw = max(s.width for s in small) + 4
    ch = max(s.height for s in small) + 4
    sheet = Image.new('RGBA', (cw * args.cols, ch * args.rows), (0, 0, 0, 0))
    for n, s in enumerate(small):
        c, r = n % args.cols, n // args.cols
        sheet.alpha_composite(s, (c * cw + (cw - s.width) // 2, (r + 1) * ch - 2 - s.height))
    out = sheet.resize((sheet.width * args.zoom, sheet.height * args.zoom), Image.NEAREST)
    out.save(SNAPPER_DIR / f'grid-{src.stem}.png')
    print(f'{src.stem}: píxel {p:.2f} px, cuadros {[s.size for s in small]}')
