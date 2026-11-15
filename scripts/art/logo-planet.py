"""Marte del menú (mars-map.png proyectado en una esfera, luz en bandas) como referencia para el logo.

Uso: python scripts/art/logo-planet.py [salida.png] [radio] [escala]
"""
import math, sys
from PIL import Image

out = sys.argv[1] if len(sys.argv) > 1 else 'art/raw/logo/planet-ref.png'
radius = int(sys.argv[2]) if len(sys.argv) > 2 else 40
scale = int(sys.argv[3]) if len(sys.argv) > 3 else 8
src = Image.open('public/assets/ui/title/mars-map.png').convert('RGB')
mw, mh = src.size
px_map = src.load()
SHADES = [1, 0.8, 0.58, 0.22]
NIGHT = (10, 18, 40)
lx, ly, lz = -0.55, -0.45, 0.7
n = math.sqrt(lx * lx + ly * ly + lz * lz); lx, ly, lz = lx / n, ly / n, lz / n
tilt = math.radians(25.2); c, s = math.cos(tilt), math.sin(tilt)
size = radius * 2
im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
p = im.load()
for y in range(size):
    for x in range(size):
        dx, dy = (x + 0.5 - radius) / radius, (y + 0.5 - radius) / radius
        d2 = dx * dx + dy * dy
        if d2 > 1: continue
        dz = math.sqrt(1 - d2)
        rx, ry = dx * c + dy * s, -dx * s + dy * c
        lat = math.asin(max(-1, min(1, -ry)))
        lon = math.atan2(rx, dz) + 0.9
        u = int(((lon / (2 * math.pi)) % 1) * mw) % mw
        v = min(mh - 1, int((0.5 - lat / math.pi) * mh))
        lit = dx * lx + dy * ly + dz * lz
        band = 0 if lit > 0.55 else 1 if lit > 0.3 else 2 if lit > 0.05 else 3
        k = SHADES[band]
        r, g, b = px_map[u, v]
        col = tuple(int(a * k + nn * (1 - k) * (band == 3)) for a, nn in zip((r, g, b), NIGHT))
        p[x, y] = col + (255,)
im.resize((size * scale, size * scale), Image.NEAREST).save(out)
print(out, size * scale)
