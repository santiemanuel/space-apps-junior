"""Banderas del idioma (panel de opciones): Argentina (español) y Estados Unidos (inglés), recortadas de la hoja del pixel-snapper.

Uso: python scripts/art/flags.py   (lee art/snapped/ui-banderas.png; prompt en art/prompts/ui-banderas.txt)
La hoja trae cada bandera dos veces (2 × 2): se usa la fila de arriba. Escribe en public/assets/ui/flags/ a
resolución de arte (1 píxel = 1 píxel de arte); el juego las muestra ×2. Registro en docs/produccion/pixel-art.md.
"""
import sys
from pathlib import Path
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from slice import sprites  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'art' / 'snapped' / 'ui-banderas.png'
OUT = ROOT / 'public' / 'assets' / 'ui' / 'flags'

im = Image.open(SRC).convert('RGBA')
im.putalpha(im.getchannel('A').point(lambda a: 255 if a >= 128 else 0))
top = sprites(im, 2, 2)[0]
OUT.mkdir(parents=True, exist_ok=True)
for locale, flag in zip(['es', 'en'], top):
    flag = flag.crop(flag.getbbox())
    flag.save(OUT / f'{locale}.png')
    print(f'{OUT / locale}.png', flag.size)
