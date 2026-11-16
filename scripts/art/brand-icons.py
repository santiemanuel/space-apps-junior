"""Logos de la esquina del menú principal: code-hello en pixel art y el mark de GitHub original.

Uso: python scripts/art/brand-icons.py   (requiere ImageMagick, `magick`, para el SVG de GitHub)
Escribe en public/assets/ui/title/ (el menú los muestra ×1):
  - `code-hello.png`: de art/snapped/brand-code-hello.png, con alfa binario y recortado al dibujo. Se rehace como el
    logotipo del juego: `scripts/art/gen.sh brand-code-hello art/raw/brand/code-hello-logo.png` (logo oficial de
    https://www.code-hello.com, `/assets/logoCH-*.png`; prompt en art/prompts/brand-code-hello.txt) →
    `python scripts/art/pre.py art/raw/brand-code-hello.png` → `snap_pixels` automático con `color_count: 8` (píxel de
    23,5 → 73 × 45) → copiar a art/snapped/.
  - `github.png`: el mark de GitHub sin modificar (`art/raw/brand/github-mark.svg`, `mark-github-24.svg` de
    primer/octicons) en blanco, al mismo alto que el logo de code-hello (las pautas de marca de GitHub piden no
    redibujarlo).
Registro en docs/produccion/pixel-art.md.
"""
import subprocess
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SNAPPED = ROOT / 'art' / 'snapped'
OUT = ROOT / 'public' / 'assets' / 'ui' / 'title'

im = Image.open(SNAPPED / 'brand-code-hello.png').convert('RGBA')
im.putalpha(im.getchannel('A').point(lambda a: 255 if a >= 128 else 0))
code_hello = im.crop(im.getbbox())
code_hello.save(OUT / 'code-hello.png')
print('code-hello.png', code_hello.size)

size = code_hello.height
github = OUT / 'github.png'
subprocess.run(
    ['magick', '-background', 'none', '-density', '1200', str(ROOT / 'art' / 'raw' / 'brand' / 'github-mark.svg'),
     '-fill', 'white', '-colorize', '100', '-trim', '+repage', '-resize', f'{size}x{size}', str(github)],
    check=True,
)
print('github.png', Image.open(github).size)
