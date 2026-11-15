"""Arma un atlas de Phaser (PNG + JSON) con los objetos de las hojas listadas en art/manifest.json.

Cada hoja ya pasó por el pixel-snapper. Los sprites se separan solos (scripts/art/slice.py), se amplían ×2 con
vecino más cercano y se acomodan en filas. Un nombre `null` en el manifiesto descarta ese sprite.

`"punch": {"<nombre>": true}` vuelve transparente el vidrio de ese sprite (la mancha del color oscuro que ocupa su
centro) para ver lo que se dibuje detrás, y anota su rectángulo en el JSON (`glass`, en `frame.customData` de
Phaser). El rectángulo queda cubierto por vidrio o marco opaco: lo de atrás no se asoma por fuera.

Uso: python scripts/art/atlas.py <grupo del manifiesto> [--scale 2]
"""
import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from slice import sprites  # noqa: E402

parser = argparse.ArgumentParser()
parser.add_argument('group')
parser.add_argument('--scale', type=int, default=2)
parser.add_argument('--width', type=int, default=512)
args = parser.parse_args()

group = json.loads(Path('art/manifest.json').read_text(encoding='utf-8'))[args.group]
def punch(sprite):
    """Vidrio transparente: relleno desde el centro por el color oscuro más común del centro."""
    px = sprite.load()
    w, h = sprite.size
    center = [px[x, y][:3] for y in range(h // 4, h * 3 // 4) for x in range(w // 4, w * 3 // 4) if px[x, y][3]]
    glass = Counter(center).most_common(1)[0][0]
    near = lambda c: c[3] and sum(abs(c[i] - glass[i]) for i in range(3)) < 40
    seed = min(((x, y) for y in range(h) for x in range(w) if near(px[x, y])), key=lambda p: abs(p[0] - w / 2) + abs(p[1] - h / 2))
    todo, seen = [seed], {seed}
    while todo:
        x, y = todo.pop()
        for q in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= q[0] < w and 0 <= q[1] < h and q not in seen and near(px[q]):
                seen.add(q)
                todo.append(q)
    for q in seen:
        px[q] = (0, 0, 0, 0)
    x0, y0 = min(x for x, _ in seen), min(y for _, y in seen)
    x1, y1 = max(x for x, _ in seen), max(y for _, y in seen)
    holes = [(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1) if (x, y) not in seen and px[x, y][3] == 0]
    if holes:
        raise SystemExit(f'el vidrio no queda rodeado de marco: {len(holes)} píxeles transparentes en su rectángulo')
    return {'x': x0, 'y': y0, 'w': x1 - x0 + 1, 'h': y1 - y0 + 1}


items = []
glass = {}
for sheet in group['sheets']:
    im = Image.open(sheet['file']).convert('RGBA')
    im.putalpha(im.getchannel('A').point(lambda a: 255 if a >= 128 else 0))
    cols, rows = sheet['grid']
    found = [s for row in sprites(im, cols, rows) for s in row]
    if len(found) != len(sheet['names']):
        raise SystemExit(f"{sheet['file']}: se esperaban {len(sheet['names'])} sprites y hay {len(found)}")
    for name, sprite in zip(sheet['names'], found):
        if not name:
            continue
        if sheet.get('punch', {}).get(name):
            sprite = sprite.copy()
            glass[name] = {k: v * args.scale for k, v in punch(sprite).items()}
        items.append((name, sprite.resize((sprite.width * args.scale, sprite.height * args.scale), Image.NEAREST)))

PAD = 4
x = y = row_height = 0
frames, placed = {}, []
for name, sprite in sorted(items, key=lambda it: -it[1].height):
    if x + sprite.width > args.width:
        x, y, row_height = 0, y + row_height + PAD, 0
    placed.append((sprite, x, y))
    frames[name] = {'frame': {'x': x, 'y': y, 'w': sprite.width, 'h': sprite.height}, 'rotated': False, 'trimmed': False,
                    'spriteSourceSize': {'x': 0, 'y': 0, 'w': sprite.width, 'h': sprite.height},
                    'sourceSize': {'w': sprite.width, 'h': sprite.height}, **({'glass': glass[name]} if name in glass else {})}
    x += sprite.width + PAD
    row_height = max(row_height, sprite.height)
atlas = Image.new('RGBA', (args.width, y + row_height), (0, 0, 0, 0))
for sprite, px, py in placed:
    atlas.alpha_composite(sprite, (px, py))
base = Path(group['atlas'])
base.parent.mkdir(parents=True, exist_ok=True)
atlas.save(base.with_suffix('.png'))
meta = {'image': base.with_suffix('.png').name, 'size': {'w': atlas.width, 'h': atlas.height}, 'scale': '1'}
base.with_suffix('.json').write_text(json.dumps({'frames': dict(sorted(frames.items())), 'meta': meta}, indent=1) + '\n', encoding='utf-8')
print(f'{base}.png: {len(frames)} sprites, {atlas.width}x{atlas.height}')
for name, f in sorted(frames.items()):
    print(f"  {name}: {f['frame']['w']}x{f['frame']['h']} px ({f['frame']['w'] / 48:.1f} x {f['frame']['h'] / 48:.1f} tiles)")
