"""Logos de code-hello y de GitHub en pixel art para la esquina del menú principal.

Uso: python scripts/art/brand-icons.py   (lee art/snapped/brand-code-hello.png y brand-github.png)
Escribe en public/assets/ui/title/ `code-hello.png` y `github.png`: alfa binario y recorte al dibujo, a resolución
de arte (el menú los muestra ×1).

Cómo se rehacen los originales (como el logotipo del juego):
  1. Referencias en art/raw/brand/: `code-hello-logo.png` (de https://www.code-hello.com, `/assets/logoCH-*.png`) y
     `github-mark.png` (`mark-github-24.svg` de primer/octicons, rasterizado con
     `magick -background none -density 1200 github-mark.svg -resize 1024x1024 github-mark.png`).
  2. `scripts/art/gen.sh brand-code-hello art/raw/brand/code-hello-logo.png` y
     `scripts/art/gen.sh brand-github art/raw/brand/github-mark.png` (prompts en art/prompts/brand-*.txt).
  3. `python scripts/art/pre.py art/raw/brand-*.png` → `snap_pixels` con detección automática y `color_count: 8`
     (code-hello: píxel de 23,5 → 73 × 45; GitHub: 37,5 → 34 × 34) → copiar a art/snapped/.
Registro en docs/produccion/pixel-art.md.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SNAPPED = ROOT / 'art' / 'snapped'
OUT = ROOT / 'public' / 'assets' / 'ui' / 'title'

for source, name in (('brand-code-hello.png', 'code-hello.png'), ('brand-github.png', 'github.png')):
    im = Image.open(SNAPPED / source).convert('RGBA')
    im.putalpha(im.getchannel('A').point(lambda a: 255 if a >= 128 else 0))
    art = im.crop(im.getbbox())
    art.save(OUT / name)
    print(name, art.size)
