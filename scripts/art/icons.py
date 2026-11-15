"""Arma el atlas de íconos del tablero (PNG + JSON de Phaser) con un grupo de art/manifest.json.

A diferencia de `atlas.py`, cada ícono se centra en una celda fija (la del ícono más grande, en píxeles de arte) para
que todos se alineen igual en el tablero y en el mapa. Se exporta a resolución de arte (1 píxel = 1 píxel de arte):
el tablero los muestra ×1 y el mapa ×2.

Uso: python scripts/art/icons.py [grupo]   (por defecto, hud-icons)
"""
import json
import sys
from pathlib import Path
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from slice import sprites  # noqa: E402

group_name = sys.argv[1] if len(sys.argv) > 1 else 'hud-icons'
group = json.loads(Path('art/manifest.json').read_text(encoding='utf-8'))[group_name]
items = []
for sheet in group['sheets']:
    im = Image.open(sheet['file']).convert('RGBA')
    im.putalpha(im.getchannel('A').point(lambda a: 255 if a >= 128 else 0))
    cols, rows = sheet['grid']
    found = [s for row in sprites(im, cols, rows) for s in row]
    if len(found) != len(sheet['names']):
        raise SystemExit(f"{sheet['file']}: se esperaban {len(sheet['names'])} íconos y hay {len(found)}")
    items += [(name, s.crop(s.getbbox())) for name, s in zip(sheet['names'], found) if name]

cell = max(max(s.width, s.height) for _, s in items)
cell += cell % 2
per_row = 8
sheet = Image.new('RGBA', (per_row * cell, -(-len(items) // per_row) * cell))
frames = {}
for i, (name, s) in enumerate(items):
    x, y = (i % per_row) * cell, (i // per_row) * cell
    sheet.paste(s, (x + (cell - s.width) // 2, y + (cell - s.height) // 2))
    frames[name] = {'frame': {'x': x, 'y': y, 'w': cell, 'h': cell}, 'rotated': False, 'trimmed': False,
                    'spriteSourceSize': {'x': 0, 'y': 0, 'w': cell, 'h': cell}, 'sourceSize': {'w': cell, 'h': cell}}
out = Path(group['atlas'])
out.parent.mkdir(parents=True, exist_ok=True)
sheet.save(out.with_suffix('.png'))
meta = {'image': out.with_suffix('.png').name, 'size': {'w': sheet.width, 'h': sheet.height}, 'scale': '1'}
out.with_suffix('.json').write_text(json.dumps({'frames': frames, 'meta': meta}, indent=1) + '\n', encoding='utf-8')
print(f'{out}.png: {len(items)} íconos en celdas de {cell}×{cell}')
