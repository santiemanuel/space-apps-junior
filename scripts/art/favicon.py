"""Favicon del juego: Marte con el casco del astronauta del logo, simplificado para la pestaña del navegador.

Uso: python scripts/art/favicon.py   (lee art/snapped/favicon.png; prompt en art/prompts/favicon.txt)
Escribe en public/: favicon.ico (16, 32 y 48 px), favicon-32.png (pixel art 1:1) y apple-touch-icon.png (180 px,
×5 sobre el fondo del juego). Registro en docs/produccion/pixel-art.md.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'art' / 'snapped' / 'favicon.png'
OUT = ROOT / 'public'
SIZE = 32
BACKGROUND = (5, 7, 13, 255)

im = Image.open(SRC).convert('RGBA')
im.putalpha(im.getchannel('A').point(lambda a: 255 if a >= 128 else 0))
art = im.crop(im.getbbox())
if art.width > SIZE or art.height > SIZE:
    raise SystemExit(f'{SRC}: el dibujo mide {art.size} y no entra en {SIZE}×{SIZE}')
base = Image.new('RGBA', (SIZE, SIZE))
base.paste(art, ((SIZE - art.width) // 2, (SIZE - art.height) // 2))
base.save(OUT / 'favicon-32.png')

# 16 px se achica suave (a la mitad, cada píxel de arte queda en 2 × 2); 48 px sale de ampliar ×3 y achicar.
small = base.resize((16, 16), Image.LANCZOS)
large = base.resize((SIZE * 3, SIZE * 3), Image.NEAREST).resize((48, 48), Image.LANCZOS)
large.save(OUT / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)], append_images=[base, small])

touch = Image.new('RGBA', (180, 180), BACKGROUND)
big = base.resize((SIZE * 5, SIZE * 5), Image.NEAREST)
touch.alpha_composite(big, ((180 - big.width) // 2, (180 - big.height) // 2))
touch.convert('RGB').save(OUT / 'apple-touch-icon.png')
print('favicon.ico, favicon-32.png y apple-touch-icon.png en', OUT, '· dibujo', art.size)
