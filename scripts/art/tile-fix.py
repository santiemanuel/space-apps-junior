"""Arregla los tiles generados que el pixel-snapper deja desparejos: pisos (art/snapped/t-piso2-*.png), pasillo
(t-pasillo2-*.png) y hojas de puerta (t-puerta2-2.png y t-puerta2-3.png).

El snapper deja cada tile con la junta en un lugar distinto (a veces arriba, a veces a la derecha) y alguna mancha
suelta en el borde; repetidos se notaba la grilla despareja. Con los colores del mismo tile (el más común es la
placa, el más oscuro la junta y el más claro de la fila de arriba el bisel): junta de un píxel de arte arriba y a la
izquierda, bisel claro adentro, y el resto del borde con el color de la placa. Además:
- la rejilla del piso (`t-piso2-3`) no se entendía a 24 píxeles: se redibuja con la junta (marco de 8 × 6, dos barras);
- la línea guía del pasillo (`t-pasillo2-1`) se perdía (medía menos de un píxel del snapper): se dibuja en la fila
  del medio, de borde a borde, para que siga de un tile al otro;
- las franjas de peligro (`t-pasillo2-2`) se redibujan a 45° con período de 8 píxeles (24 es múltiplo): siguen sin
  corte de un tile al vecino, con el amarillo y el gris oscuro que eligió el generador;
- las hojas de puerta salían con colores casi iguales salpicados y la ranura y el zócalo cortados: se juntan los
  colores parecidos y se redibujan de punta a punta la ranura del medio (con su brillo abajo) y el zócalo.

Uso: python scripts/art/tile-fix.py   (pisa los tiles de art/snapped con la versión arreglada; el original queda
como raw-<nombre> en la misma carpeta)
"""
from collections import Counter
from pathlib import Path
from PIL import Image

T = 24
BEVEL_FALLBACK = {'piso2': (210, 187, 247), 'pasillo2': (196, 196, 240)}
GUIDE = (102, 232, 249)
# La junta de cada familia es la del primer tile: el snapper a veces la oscurece de más en otro.
SEAMS = {}


def load(path):
    raw = path.with_name(f'raw-{path.name}')
    if not raw.exists():
        raw.write_bytes(path.read_bytes())
    im = Image.open(raw).convert('RGB')
    return im.resize((T, T), Image.NEAREST) if im.size != (T, T) else im


def plate(family, i):
    path = Path(f'art/snapped/t-{family}-{i}.png')
    im = load(path)
    px = im.load()
    base = Counter(px[x, y] for y in range(3, T - 3) for x in range(3, T - 3)).most_common(1)[0][0]
    seam = SEAMS.setdefault(family, min({px[x, y] for y in range(T) for x in range(T)}, key=sum))
    bevel = max((px[x, y] for y in range(3) for x in range(T)), key=sum)
    # Si el snapper se comió el bisel (o la fila más clara es la línea guía), el de la familia.
    if sum(bevel) - sum(base) < 60 or (family == 'pasillo2' and i == 1):
        bevel = BEVEL_FALLBACK[family]
    out = Image.new('RGB', (T, T), base)
    o = out.load()
    for y in range(2, T - 2):
        for x in range(2, T - 2):
            o[x, y] = px[x, y]
    for k in range(T):
        o[k, 0] = o[0, k] = seam
        if k:
            o[k, 1] = o[1, k] = bevel
    if (family, i) == ('piso2', 3):
        for y in range(9, 15):
            for x in range(8, 16):
                o[x, y] = base
        for x in range(8, 16):
            o[x, 9] = o[x, 14] = seam
        for y in range(9, 15):
            o[8, y] = o[15, y] = seam
        for x in range(10, 14):
            o[x, 11] = o[x, 12] = seam
    if (family, i) == ('pasillo2', 1):
        # Placa lisa (sin lo que dejó la línea cortada) y la línea guía en la fila del medio, con su brillo debajo.
        for y in range(2, T):
            for x in range(2, T):
                o[x, y] = base
        for x in range(T):
            o[x, T // 2] = GUIDE
            o[x, T // 2 + 1] = tuple((b + g) // 2 for b, g in zip(base, GUIDE)) if x else seam
    out.save(path)
    print(path, 'placa', base, 'junta', seam, 'bisel', bevel)


def hazard(family, i):
    path = Path(f'art/snapped/t-{family}-{i}.png')
    im = load(path)
    colors = sorted(im.getcolors(T * T), reverse=True)[:6]
    colors = [(c, n) for n, c in colors]
    yellow = max((c for c, _ in colors), key=lambda c: c[0] + c[1] - 2 * c[2])
    dark = min((c for c, _ in colors), key=sum)
    out = Image.new('RGB', (T, T))
    o = out.load()
    for y in range(T):
        for x in range(T):
            # De abajo a la izquierda hacia arriba a la derecha: x + y constante a lo largo de cada franja.
            o[x, y] = yellow if (x + y) % 8 < 4 else dark
    out.save(path)
    print(path, 'amarillo', yellow, 'oscuro', dark)


def merge(im, threshold=24):
    """Junta cada color con el más usado de los que se le parecen (suma de diferencias por canal)."""
    counts = sorted(((n, c) for n, c in im.getcolors(T * T * 4)), reverse=True)
    keep = []
    for _, c in counts:
        if not any(sum(abs(a - b) for a, b in zip(c, k)) < threshold for k in keep):
            keep.append(c)
    near = {c: min(keep, key=lambda k: sum(abs(a - b) for a, b in zip(c, k))) for _, c in counts}
    out = im.copy()
    o = out.load()
    for y in range(im.height):
        for x in range(im.width):
            o[x, y] = near[o[x, y]]
    return out


def door(i):
    """Hoja de puerta: colores juntados, ranura del medio y zócalo de borde a borde (sin tocar la junta derecha)."""
    path = Path(f'art/snapped/t-puerta2-{i}.png')
    raw = path.with_name(f'raw-{path.name}')
    if not raw.exists():
        raw.write_bytes(path.read_bytes())
    im = merge(Image.open(raw).convert('RGB'))
    px = im.load()
    w, h = im.size
    inner = range(3, w - 3)
    panel = Counter(px[x, y] for y in range(6, h - 6) for x in inner).most_common(1)[0][0]
    # Ranura: la fila del medio con más píxeles oscuros; debajo, el brillo (la fila más clara de las dos siguientes).
    groove_row = min(range(h // 3, 2 * h // 3), key=lambda y: sum(sum(px[x, y]) for x in inner))
    groove = min((px[x, groove_row] for x in inner), key=sum)
    light_row = groove_row + 1
    light = max((px[x, light_row] for x in inner), key=sum)
    cyan = {px[x, y] for y in range(h) for x in range(w) if px[x, y][2] > 200 and px[x, y][0] < 80}
    for x in range(3, w - 2):
        if px[x, groove_row] not in cyan:
            px[x, groove_row] = groove
        if px[x, light_row] not in cyan:
            px[x, light_row] = light
    # Zócalo: las tres filas de abajo, cada una de su color más común, hasta la junta derecha.
    for y in range(h - 3, h):
        row = Counter(px[x, y] for x in range(w - 1)).most_common(1)[0][0]
        for x in range(w - 1):
            px[x, y] = row
    # Lo de adentro del panel que quedó salpicado entre la ranura y el borde de abajo: color del panel.
    for y in list(range(6, groove_row)) + list(range(light_row + 1, h - 6)):
        for x in range(4, w - 4):
            c = px[x, y]
            if c not in cyan and c != panel and abs(sum(c) - sum(panel)) < 40:
                px[x, y] = panel
    im.save(path)
    print(path, 'panel', panel, 'ranura', groove_row, groove, 'brillo', light)


for i in (2, 3):
    door(i)
for i in range(4):
    plate('piso2', i)
for i in (0, 1, 3):
    plate('pasillo2', i)
hazard('pasillo2', 2)
