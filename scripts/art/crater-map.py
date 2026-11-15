"""Mapa del cráter Gale en pixel art (public/assets/mars/crater.png) a partir de una foto real de la NASA.

Fuente: PIA15687 "Destination Gale Crater in August 2012" (NASA/JPL-Caltech/ESA/DLR/FU Berlin/MSSS), vista desde
arriba con el norte hacia arriba. Trae dibujada la elipse de aterrizaje de 2012 (20 × 7 km): se mide para saber
cuántos píxeles mide un km y se borra antes de pixelar.

Pasos: recorte cuadrado centrado en el cráter, se borra la elipse (cada píxel negro toma el color de sus vecinos),
reducción por promedio a ART × ART píxeles de arte, paleta de COLORS colores sin tramado y exportación ×SCALE.
Imprime la georreferencia para `GALE_CRATER_VIEW` (src/content/galeTerrain.ts).

Uso: python scripts/art/crater-map.py [--check art/raw/crater-check.png]
"""
import argparse
from PIL import Image, ImageDraw, ImageFilter

SOURCE = 'art/raw/PIA15687.jpg'
OUT = 'public/assets/mars/crater.png'
ART = 200
SCALE = 3
COLORS = 28
# Elipse de aterrizaje en la foto completa (1564 × 1528): caja medida por los píxeles negros de su contorno.
ELLIPSE_BOX = (516, 367, 672, 423)
# Ancho de la elipse: 20 km (PIA15687); al ancho medido se le resta el grosor de la línea (2 px).
PX_PER_KM = (ELLIPSE_BOX[2] - ELLIPSE_BOX[0] - 2) / 20
# Centro de la elipse = blanco de aterrizaje de 2012: 4,5965° S, 137,4019° E (Way et al., IEEE Aerospace 2013).
ANCHOR = {'lat': -4.5965, 'lon': 137.4019, 'x': (ELLIPSE_BOX[0] + ELLIPSE_BOX[2]) / 2, 'y': (ELLIPSE_BOX[1] + ELLIPSE_BOX[3]) / 2}
# Recorte: cuadrado de CROP px centrado en el cráter (centro del USGS: 5,37° S, 137,81° E).
CROP = 1300
KM_PER_DEG_LAT = 59.16
KM_PER_DEG_LON = 58.96


def to_full(lat, lon):
    """Lat/lon → píxel de la foto completa."""
    return (ANCHOR['x'] + (lon - ANCHOR['lon']) * KM_PER_DEG_LON * PX_PER_KM,
            ANCHOR['y'] + (ANCHOR['lat'] - lat) * KM_PER_DEG_LAT * PX_PER_KM)


def erase_ellipse(im):
    px = im.load()
    x0, y0, x1, y1 = ELLIPSE_BOX
    dark = {(x, y) for y in range(y0 - 3, y1 + 4) for x in range(x0 - 3, x1 + 4) if sum(px[x, y]) < 360}
    while dark:
        done = []
        for x, y in dark:
            near = [px[x + dx, y + dy] for dx in (-1, 0, 1) for dy in (-1, 0, 1) if (x + dx, y + dy) not in dark]
            if len(near) >= 3:
                done.append(((x, y), tuple(sum(c[i] for c in near) // len(near) for i in range(3))))
        for p, color in done:
            px[p] = color
            dark.discard(p)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', help='imagen de control con el borde de 154 km y los lugares marcados')
    args = parser.parse_args()
    im = Image.open(SOURCE).convert('RGB')
    erase_ellipse(im)
    cx, cy = to_full(-5.37, 137.81)
    left, top = round(cx - CROP / 2), round(cy - CROP / 2)
    crop = im.crop((left, top, left + CROP, top + CROP))
    art = crop.resize((ART, ART), Image.BOX).filter(ImageFilter.UnsharpMask(radius=1, percent=60, threshold=2))
    art = art.quantize(colors=COLORS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    art.resize((ART * SCALE, ART * SCALE), Image.NEAREST).save(OUT)
    f = ART / CROP
    ax, ay = (ANCHOR['x'] - left) * f, (ANCHOR['y'] - top) * f
    print(f'{OUT}: {ART} x {ART} píxeles de arte, ×{SCALE}')
    print(f"GALE_CRATER_VIEW: anchor {{ lat: {ANCHOR['lat']}, lon: {ANCHOR['lon']}, x: {ax:.2f}, y: {ay:.2f} }}, pxPerKm: {PX_PER_KM * f:.4f}")
    if args.check:
        check = art.resize((ART * 4, ART * 4), Image.NEAREST)
        d = ImageDraw.Draw(check)
        to_art = lambda lat, lon: (((to_full(lat, lon)[0] - left) * f) * 4, ((to_full(lat, lon)[1] - top) * f) * 4)
        r = 154 / 2 * PX_PER_KM * f * 4
        x, y = to_art(-5.37, 137.81)
        d.ellipse((x - r, y - r, x + r, y + r), outline=(0, 255, 255), width=2)
        for lat, lon, color in [(-4.5895, 137.4417, (255, 255, 0)), (-4.775, 137.403, (255, 0, 255)), (-5.08, 137.85, (0, 255, 0))]:
            x, y = to_art(lat, lon)
            d.ellipse((x - 5, y - 5, x + 5, y + 5), fill=color)
        check.save(args.check)
