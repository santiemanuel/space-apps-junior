"""Corta una hoja de sprites sueltos (ya pasada por el pixel-snapper) y la rearma en una grilla exacta.

Detecta las filas y, dentro de cada fila, los sprites separados por columnas vacías. Cada sprite se apoya abajo y
se centra en su celda (con --anchor head, por el centro de la parte de arriba: evita el temblor al caminar).

Uso: python scripts/art/slice.py <snapped.png> <destino.png> --cols 9 --rows 4 [--cell 44x54] [--scale 2]
     [--anchor head|box] [--pad-bottom 2] [--info]
"""
import argparse
from pathlib import Path
from PIL import Image

SNAPPER_DIR = Path(r'C:\code-hello\mcp-snapper\assets')


def bands(flags, count, min_gap=1):
    """Tramos ocupados de una proyección; une los más cercanos hasta que queden `count`."""
    runs, start = [], None
    for i, on in enumerate(list(flags) + [False]):
        if on and start is None: start = i
        elif not on and start is not None: runs.append([start, i]); start = None
    while len(runs) > count:
        gaps = [(runs[i + 1][0] - runs[i][1], i) for i in range(len(runs) - 1)]
        _, i = min(gaps)
        runs[i][1] = runs[i + 1][1]; del runs[i + 1]
    return runs


def sprites(im, cols, rows):
    alpha = im.getchannel('A')
    px = alpha.load()
    row_runs = bands([any(px[x, y] for x in range(im.width)) for y in range(im.height)], rows)
    out = []
    for top, bottom in row_runs:
        col_runs = bands([any(px[x, y] for y in range(top, bottom)) for x in range(im.width)], cols)
        out.append([im.crop((l, top, r, bottom)) for l, r in col_runs])
        out[-1] = [s.crop(s.getchannel('A').getbbox()) for s in out[-1]]
    return out


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source'); parser.add_argument('dest')
    parser.add_argument('--cols', type=int, required=True); parser.add_argument('--rows', type=int, required=True)
    parser.add_argument('--cell'); parser.add_argument('--scale', type=int, default=2)
    parser.add_argument('--anchor', default='box'); parser.add_argument('--pad-bottom', type=int, default=0)
    args = parser.parse_args()
    source = Path(args.source)
    im = Image.open(source if source.exists() else SNAPPER_DIR / source).convert('RGBA')
    im.putalpha(im.getchannel('A').point(lambda a: 255 if a >= 128 else 0))
    grid = sprites(im, args.cols, args.rows)
    sizes = [s.size for row in grid for s in row]
    print('sprites por fila:', [len(r) for r in grid], '| ancho', min(w for w, _ in sizes), '-', max(w for w, _ in sizes),
          '| alto', min(h for _, h in sizes), '-', max(h for _, h in sizes))
    cw, ch = map(int, args.cell.split('x')) if args.cell else (max(w for w, _ in sizes) + 2, max(h for _, h in sizes) + 2)
    sheet = Image.new('RGBA', (cw * args.cols, ch * args.rows), (0, 0, 0, 0))
    for r, row in enumerate(grid):
        for c, s in enumerate(row):
            if args.anchor == 'head':
                head = s.crop((0, 0, s.width, max(1, s.height * 2 // 5))).getchannel('A').getbbox()
                center = (head[0] + head[2]) / 2
            else:
                center = s.width / 2
            x = c * cw + round(cw / 2 - center)
            x = min(max(x, c * cw), (c + 1) * cw - s.width)
            sheet.alpha_composite(s, (x, (r + 1) * ch - args.pad_bottom - s.height))
    out = sheet.resize((sheet.width * args.scale, sheet.height * args.scale), Image.NEAREST)
    Path(args.dest).parent.mkdir(parents=True, exist_ok=True)
    out.save(args.dest)
    print(f'{args.dest}: celda {cw}x{ch} px de arte -> hoja {out.width}x{out.height} (cuadros de {cw * args.scale}x{ch * args.scale})')
