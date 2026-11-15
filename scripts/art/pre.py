"""Prepara una imagen generada para el pixel-snapper: alfa binario y copia a la carpeta que ve el MCP.

Uso: python scripts/art/pre.py art/raw/fase0/console.png [más archivos...]
"""
import sys
from pathlib import Path
from PIL import Image

SNAPPER_DIR = Path(r'C:\code-hello\mcp-snapper\assets')
ALPHA_THRESHOLD = 128

for arg in sys.argv[1:]:
    src = Path(arg)
    im = Image.open(src).convert('RGBA')
    alpha = im.getchannel('A').point(lambda a: 255 if a >= ALPHA_THRESHOLD else 0)
    im.putalpha(alpha)
    out = SNAPPER_DIR / f'{src.parent.name}-{src.name}'
    im.save(out)
    print(out.name, im.size, 'bbox', alpha.getbbox())
