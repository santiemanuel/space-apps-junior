"""Arma la hoja de un tripulante (9 × 4 cuadros) con sus tres hojas de 3 × 3 ya pasadas por el pixel-snapper.

Filas: frente, espalda, perfil izquierdo y perfil derecho (el izquierdo espejado). Cada cuadro se apoya en la
base de su celda y se corre lo que mejor lo superpone con el primero de su fila. El casco del primer cuadro
se repite en toda la fila (los cuadros generados difieren en detalles y el casco "hervía"), y el reposo usa ese
mismo cuadro; para parpadear toma sólo el casco del cuadro con los ojos cerrados.

Uso: python scripts/art/crew.py <id> [--cell 32x40] [--scale 2]
  lee art/snapped/crew-<id>-{frente,espalda,izquierda}.png (ya pasadas por regrid.py y el snapper) y escribe public/assets/crew/<id>.png
"""
import argparse
import sys
from collections import Counter
from pathlib import Path
from PIL import Image, ImageOps

sys.path.insert(0, str(Path(__file__).parent))
from slice import sprites  # noqa: E402

parser = argparse.ArgumentParser()
parser.add_argument('crew')
parser.add_argument('--cell', default='40x48')
parser.add_argument('--scale', type=int, default=2)
parser.add_argument('--dest')
args = parser.parse_args()
cw, ch = map(int, args.cell.split('x'))


def frames(direction):
    im = Image.open(f'art/snapped/crew-{args.crew}-{direction}.png').convert('RGBA')
    im.putalpha(im.getchannel('A').point(lambda a: 255 if a >= 128 else 0))
    found = [s for row in sprites(im, 3, 3) for s in row]
    if len(found) != 9:
        raise SystemExit(f'{args.crew}-{direction}: se esperaban 9 cuadros y hay {len(found)}')
    return found


def mismatch(a, b, dx):
    """Píxeles distintos entre dos cuadros apoyados en la misma base, con b corrido dx."""
    w, h = max(a.width, b.width + abs(dx)) + 4, max(a.height, b.height)
    ca, cb = Image.new('RGBA', (w, h)), Image.new('RGBA', (w, h))
    ca.alpha_composite(a, (2 + max(0, -dx), h - a.height))
    cb.alpha_composite(b, (2 + max(0, dx), h - b.height))
    pa, pb = ca.load(), cb.load()
    return sum(1 for y in range(h) for x in range(w) if pa[x, y] != pb[x, y])


def place(frame, dx=0, dy=0):
    """El cuadro en una celda, apoyado en la base y centrado (más el corrimiento)."""
    canvas = Image.new('RGBA', (cw, ch))
    canvas.alpha_composite(frame, ((cw - frame.width) // 2 + dx, ch - 1 - frame.height + dy))
    return canvas


def diff(a, b, rows=None):
    pa, pb = a.load(), b.load()
    ys = rows if rows is not None else range(ch)
    return sum(1 for y in ys for x in range(cw) if pa[x, y] != pb[x, y])


def shifted(im, dx, dy):
    out = Image.new('RGBA', im.size)
    out.alpha_composite(im, (dx, dy))
    return out


def tidy(row, blinks):
    """Cuadros de una dirección listos para animar: el casco del primero en todos y el reposo quieto con parpadeo."""
    first = place(row[0])
    top = first.getchannel('A').getbbox()[1]
    neck = top + round((ch - 1 - top) * 0.5)
    head_rows = range(top, neck)

    def with_head(body, head_from):
        """`body` con el casco de `head_from` donde mejor encaja (sigue el rebote de la caminata)."""
        hx, hy = min(((x, y) for x in range(-2, 3) for y in range(-2, 3)),
                     key=lambda o: diff(shifted(head_from, *o), body, [r for r in head_rows if 0 <= r + o[1] < ch]))
        out = body.copy()
        out.paste((0, 0, 0, 0), (0, 0, cw, max(0, neck + hy)))
        layer = Image.new('RGBA', (cw, ch))
        layer.paste(head_from.crop((0, 0, cw, neck)), (hx, hy))
        out.alpha_composite(layer)
        return out

    def aligned(frame):
        dx = min(range(-3, 4), key=lambda d: diff(first, place(frame, d)))
        return place(frame, dx)

    cells = [first] + [with_head(aligned(frame), first) for frame in row[1:]]
    # Reposo: el mismo cuadro dos veces y, para parpadear, el casco del cuadro con los ojos cerrados.
    cells[1] = first
    cells[2] = with_head(first, aligned(row[2])) if blinks else first
    return cells


left = frames('izquierda')
rows = [frames('frente'), frames('espalda'), left]
sheet = Image.new('RGBA', (cw * 9, ch * 4), (0, 0, 0, 0))
done = []
for r, row in enumerate(rows):
    sizes = [s.size for s in row]
    print(f"{args.crew} fila {r}: ancho {min(w for w, _ in sizes)}-{max(w for w, _ in sizes)}, alto {min(h for _, h in sizes)}-{max(h for _, h in sizes)}")
    for c, s in enumerate(row):
        if s.width > cw - 6 or s.height > ch - 3:
            raise SystemExit(f'{args.crew} fila {r} cuadro {c}: {s.size} no entra en la celda {cw}x{ch}')
    done.append(tidy(row, blinks=r != 1))
done.append([ImageOps.mirror(c) for c in done[2]])
for r, cells in enumerate(done):
    for c, cell in enumerate(cells):
        sheet.alpha_composite(cell, (c * cw, r * ch))
out = sheet.resize((sheet.width * args.scale, sheet.height * args.scale), Image.NEAREST)
dest = Path(args.dest or f'public/assets/crew/{args.crew}.png')
out.save(dest)
print(f'{dest}: {out.width}x{out.height} (cuadros de {cw * args.scale}x{ch * args.scale})')
