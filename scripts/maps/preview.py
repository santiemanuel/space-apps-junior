"""Vista general de un mapa de Tiled sin abrir el juego: piso, paredes y objetos, reducida (por defecto a 1/4).

Uso: python scripts/maps/preview.py src/content/maps/gale.json art/capturas/gale-mapa.png [escala]
El tileset sale del propio mapa; los objetos, del atlas `<carpeta del tileset>/props.json` o del que se pase con
PROPS=<ruta del .json>.
"""
import json
import os
import sys
from pathlib import Path
from PIL import Image

src, out = Path(sys.argv[1]), sys.argv[2]
scale = float(sys.argv[3]) if len(sys.argv) > 3 else 0.25
m = json.loads(src.read_text(encoding='utf8'))
tileset = m['tilesets'][0]
T, W, H, columns = m['tilewidth'], m['width'], m['height'], tileset['columns']
tiles_png = (src.parent / tileset['image']).resolve()
tiles = Image.open(tiles_png).convert('RGBA')
image = Image.new('RGBA', (W * T, H * T))
for layer in m['layers']:
    if layer['type'] != 'tilelayer':
        continue
    for k, gid in enumerate(layer['data']):
        if gid:
            i = gid - tileset['firstgid']
            tile = tiles.crop(((i % columns) * T, (i // columns) * T, (i % columns + 1) * T, (i // columns + 1) * T))
            image.alpha_composite(tile, ((k % W) * T, (k // W) * T))
atlas_json = Path(os.environ.get('PROPS', tiles_png.with_name('props.json')))
if atlas_json.exists():
    frames = json.loads(atlas_json.read_text(encoding='utf8'))['frames']
    sheet = Image.open(atlas_json.with_suffix('.png')).convert('RGBA')
    objects = next(l for l in m['layers'] if l['name'] == 'objetos')['objects']
    for o in sorted(objects, key=lambda o: o['y'] + o['height']):
        f = frames[o['type']]['frame']
        sprite = sheet.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h']))
        image.alpha_composite(sprite, (int(o['x'] + o['width'] / 2 - f['w'] / 2), int(o['y'] + o['height'] - f['h'])))
image.resize((round(W * T * scale), round(H * T * scale)), Image.LANCZOS).save(out)
print(f'{out}: {W} x {H} tiles')
