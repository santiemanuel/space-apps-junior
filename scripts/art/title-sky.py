"""Pixel art del menú principal (escena `Title`): mapas de la Tierra y de Marte para los planetas que giran, nubes,
la ISS, el CubeSat OPSIS, meteoritos con su estela, asteroides, la nave de la misión y estrellas.

Reproducible y sin red: python scripts/art/title-sky.py
Escribe en public/assets/ui/title/ (registro en docs/pixel-art.md).

Fuentes de los mapas (dominio público, copias en art/raw/title/):
- blue-marble.jpg: NASA Blue Marble 2002, "land_shallow_topo_2048" (Reto Stöckli, NASA GSFC), copia de Wikimedia Commons.
- mars-viking-mdim21.jpg: Mars Viking MDIM 2.1 Colorized Global Mosaic (USGS Astrogeology / NASA Ames), copia de
  Wikimedia Commons.
Todo lo demás se dibuja acá a mano, píxel por píxel, con una paleta fija.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / 'art' / 'raw' / 'title'
OUT = ROOT / 'public' / 'assets' / 'ui' / 'title'

# Paleta común (biblia-visual.md §2): contornos oscuros y acentos ámbar/naranja.
INK = (26, 32, 44, 255)
WHITE = (237, 242, 247, 255)
LIGHT = (203, 213, 224, 255)
GREY = (160, 174, 192, 255)
DARK = (74, 85, 104, 255)
GOLD = (214, 158, 46, 255)
GOLD_DARK = (151, 90, 22, 255)
GOLD_LIGHT = (250, 240, 137, 255)
CYAN = (144, 205, 244, 255)
ORANGE = (246, 173, 85, 255)
RED = (229, 62, 62, 255)
YELLOW = (254, 252, 191, 255)
CLEAR = (0, 0, 0, 0)


def pixel_map(
    source: Path, size: tuple[int, int], colors: int, saturation: float, brightness: float, tint=(1.0, 1.0, 1.0)
) -> Image.Image:
    """Mapa equirectangular reducido a pocos colores y sin ruido: se ve como pixel art al proyectarlo en la esfera."""
    im = Image.open(source).convert('RGB').resize(size, Image.Resampling.BOX)
    if tint != (1.0, 1.0, 1.0):
        im = Image.fromarray(np.clip(np.array(im, float) * tint, 0, 255).astype(np.uint8))
    im = ImageEnhance.Color(im).enhance(saturation)
    im = ImageEnhance.Brightness(im).enhance(brightness)
    quantized = im.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    palette = quantized.getpalette()[: colors * 3]
    cleaned = quantized.convert('RGB').filter(ImageFilter.ModeFilter(3))
    reference = Image.new('P', (1, 1))
    reference.putpalette(palette + [0, 0, 0] * (256 - colors))
    return cleaned.quantize(palette=reference, dither=Image.Dither.NONE).convert('RGB')


def periodic_noise(width: int, height: int, cells_x: int, cells_y: int, rng: np.random.Generator) -> np.ndarray:
    """Ruido de valores suave que empalma en los bordes izquierdo y derecho (el mapa da la vuelta al planeta)."""
    grid = rng.random((cells_y + 1, cells_x))
    xs = np.arange(width) / width * cells_x
    ys = np.arange(height) / height * cells_y
    x0 = np.floor(xs).astype(int)
    y0 = np.minimum(np.floor(ys).astype(int), cells_y - 1)
    fx = xs - x0
    fy = ys - y0
    sx = fx * fx * (3 - 2 * fx)
    sy = fy * fy * (3 - 2 * fy)
    x1 = (x0 + 1) % cells_x
    x0 %= cells_x
    top = grid[y0][:, x0] * (1 - sx) + grid[y0][:, x1] * sx
    bottom = grid[y0 + 1][:, x0] * (1 - sx) + grid[y0 + 1][:, x1] * sx
    return top * (1 - sy)[:, None] + bottom * sy[:, None]


def clouds(width: int, height: int) -> Image.Image:
    """Nubes de la Tierra: ruido fractal estirado de este a oeste (franjas como las del cielo real), con más nubes en
    el ecuador y en las latitudes medias y casi nada en los desiertos subtropicales, en dos opacidades."""
    rng = np.random.default_rng(2024)
    octaves = 6
    field = sum(periodic_noise(width, height, 5 * 2**o, 9 * 2**o, rng) * 0.62**o for o in range(octaves))
    field /= sum(0.62**o for o in range(octaves))
    lat = np.degrees((0.5 - (np.arange(height) + 0.5) / height) * np.pi)
    bands = (
        0.62
        + 0.16 * np.exp(-((lat / 9) ** 2))
        + 0.2 * np.exp(-(((np.abs(lat) - 55) / 14) ** 2))
        - 0.1 * np.exp(-(((np.abs(lat) - 25) / 8) ** 2))
    )
    value = field * bands[:, None] / 0.78
    # Un 30 % del mapa con nubes (la mitad, densas): la Tierra real ronda el 67 %, pero así se ven los continentes.
    thin, thick = np.quantile(value, [0.7, 0.85])
    alpha = np.where(value > thick, 235, np.where(value > thin, 150, 0)).astype(np.uint8)
    rgba = np.zeros((height, width, 4), np.uint8)
    rgba[..., :3] = (247, 250, 252)
    rgba[..., 3] = alpha
    return Image.fromarray(rgba)


def outline(im: Image.Image, color=INK) -> Image.Image:
    """Contorno oscuro de 1 px alrededor de todo lo opaco (estilo de ref-nave.png)."""
    a = np.array(im)
    opaque = a[..., 3] > 0
    ring = np.zeros_like(opaque)
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        ring |= np.roll(np.roll(opaque, dy, 0), dx, 1)
    ring &= ~opaque
    a[ring] = color
    return Image.fromarray(a)


def sheet(frames: list[Image.Image]) -> Image.Image:
    w, h = frames[0].size
    out = Image.new('RGBA', (w * len(frames), h), CLEAR)
    for i, frame in enumerate(frames):
        out.paste(frame, (i * w, 0))
    return out


def iss() -> Image.Image:
    """ISS vista desde arriba: armazón horizontal, 4 pares de paneles solares dorados, módulos y radiadores. 2 cuadros
    (el segundo con un destello del Sol en los paneles)."""
    frames = []
    for glint in (False, True):
        im = Image.new('RGBA', (42, 21), CLEAR)
        d = ImageDraw.Draw(im)
        d.rectangle([1, 9, 40, 11], fill=GREY)
        d.line([1, 9, 40, 9], fill=LIGHT)
        for x0 in (2, 9, 27, 34):
            for y0, y1 in ((1, 7), (13, 19)):
                d.rectangle([x0, y0, x0 + 5, y1], fill=GOLD)
                for y in range(y0 + 1, y1, 2):
                    d.line([x0, y, x0 + 5, y], fill=GOLD_DARK)
                d.line([x0 + 2, y0, x0 + 2, y1], fill=GOLD_DARK)
            d.line([x0 + 2, 7, x0 + 2, 13], fill=DARK)
        d.rectangle([17, 4, 24, 16], fill=WHITE)
        d.rectangle([15, 8, 26, 12], fill=WHITE)
        d.line([17, 16, 24, 16], fill=GREY)
        d.line([15, 12, 26, 12], fill=GREY)
        d.rectangle([19, 2, 22, 4], fill=LIGHT)
        d.rectangle([20, 6, 21, 7], fill=CYAN)
        d.rectangle([22, 13, 23, 14], fill=CYAN)
        if glint:
            for x0 in (9, 27):
                d.line([x0 + 1, 2, x0 + 4, 5], fill=GOLD_LIGHT)
            d.point([(19, 9), (20, 9)], fill=YELLOW)
        frames.append(outline(im))
    return sheet(frames)


def rock_frames(radius: float, count: int, seed: int, hot: bool) -> list[Image.Image]:
    """Roca irregular que gira (un cuadro por paso). La luz llega fija desde arriba a la derecha; los meteoritos
    tienen además el borde delantero (abajo a la izquierda) al rojo vivo."""
    rng = np.random.default_rng(seed)
    angles = np.linspace(0, 2 * np.pi, 11, endpoint=False)
    radii = radius * rng.uniform(0.72, 1.0, angles.size)
    craters = [(rng.uniform(0, 2 * np.pi), rng.uniform(0, radius * 0.55), rng.uniform(0.9, 1.7)) for _ in range(3)]
    size = int(np.ceil(radius * 2 + 4))
    c = size / 2
    frames = []
    base = [(158, 140, 120), (120, 104, 88), (84, 72, 62)] if not hot else [(150, 120, 100), (110, 86, 70), (78, 60, 50)]
    for f in range(count):
        turn = 2 * np.pi * f / count
        poly = [(c + r * np.cos(a + turn), c + r * np.sin(a + turn)) for a, r in zip(angles, radii)]
        mask = Image.new('L', (size, size), 0)
        ImageDraw.Draw(mask).polygon(poly, fill=255)
        m = np.array(mask) > 0
        a = np.zeros((size, size, 4), np.uint8)
        ys, xs = np.nonzero(m)
        for y, x in zip(ys, xs):
            nx, ny = (x + 0.5 - c) / radius, (y + 0.5 - c) / radius
            light = 0.55 * nx - 0.55 * ny + 0.6 * np.sqrt(max(0.0, 1 - nx * nx - ny * ny))
            tone = 0 if light > 0.5 else 1 if light > 0.1 else 2
            for ang, dist, cr in craters:
                cx, cy = c + dist * np.cos(ang + turn), c + dist * np.sin(ang + turn)
                if (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= cr * cr:
                    tone = min(2, tone + 1)
            color = base[tone]
            if hot and (nx < -0.25 or ny > 0.25) and (nx - ny) < -0.55:
                color = (246, 173, 85) if (nx - ny) > -1.0 else (254, 215, 120)
            a[y, x] = (*color, 255)
        frames.append(outline(Image.fromarray(a)))
    return frames


def meteor_trail() -> Image.Image:
    """Estela del meteorito: brillante junto a la roca (x = 0) y apagándose hacia la derecha con tramado de píxeles."""
    w, h = 44, 7
    a = np.zeros((h, w, 4), np.uint8)
    for x in range(w):
        t = x / (w - 1)
        half = max(0.5, 3.0 * (1 - t))
        color = YELLOW if t < 0.15 else ORANGE if t < 0.5 else RED
        for y in range(h):
            if abs(y - 3) > half:
                continue
            if t > 0.55 and (x + y) % 2:
                continue
            if t > 0.8 and (x // 2 + y) % 2:
                continue
            a[y, x] = color[:3] + (255 if t < 0.7 else 200,)
    return Image.fromarray(a)


def ship() -> list[Image.Image]:
    """Nave de la misión (propulsión nuclear térmica, game-design §2.1) mirando a la derecha: tobera con llama,
    armazón largo, radiadores y el módulo habitable con ventana. 2 cuadros para que la llama titile."""
    frames = []
    for flame in (0, 1):
        im = Image.new('RGBA', (34, 11), CLEAR)
        d = ImageDraw.Draw(im)
        d.rectangle([7, 5, 24, 5], fill=GREY)
        d.rectangle([5, 3, 8, 7], fill=DARK)
        d.rectangle([9, 4, 11, 6], fill=GOLD)
        for x in (13, 17):
            d.rectangle([x, 1, x + 2, 4], fill=LIGHT)
            d.rectangle([x, 6, x + 2, 9], fill=LIGHT)
        d.rectangle([22, 3, 31, 7], fill=WHITE)
        d.line([22, 7, 31, 7], fill=GREY)
        d.rectangle([28, 4, 29, 5], fill=CYAN)
        d.point((32, 5), fill=LIGHT)
        length = 3 + flame
        d.line([5 - length, 5, 4, 5], fill=ORANGE)
        d.point((4, 5), fill=YELLOW)
        d.point((5 - length - 1, 5), fill=RED)
        frames.append(outline(im))
    return frames


def cubesat() -> Image.Image:
    """CubeSat OPSIS (proyecto de Facundo, referencia en el menú): cuerpo 3U con dos paneles solares desplegados y una
    antena. Muy chico a propósito. 2 cuadros: el LED pasa de verde a rojo."""
    frames = []
    for led in ((104, 211, 145, 255), (252, 129, 129, 255)):
        im = Image.new('RGBA', (13, 9), CLEAR)
        d = ImageDraw.Draw(im)
        d.rectangle([1, 3, 3, 5], fill=(43, 108, 176, 255))
        d.rectangle([9, 3, 11, 5], fill=(43, 108, 176, 255))
        d.point([(2, 4), (10, 4)], fill=CYAN)
        d.rectangle([5, 2, 7, 6], fill=LIGHT)
        d.line([5, 2, 7, 2], fill=GOLD)
        d.line([5, 6, 7, 6], fill=GOLD)
        d.point((4, 4), fill=GREY)
        d.point((8, 4), fill=GREY)
        d.point((6, 1), fill=GREY)
        d.point((6, 4), fill=led)
        frames.append(outline(im))
    return sheet(frames)


def stars() -> Image.Image:
    """Cuatro formas de estrella, de la más chica a un destello en cruz (para titilar cambiando de cuadro)."""
    frames = []
    for level in range(4):
        im = Image.new('RGBA', (7, 7), CLEAR)
        d = ImageDraw.Draw(im)
        d.point((3, 3), fill=WHITE)
        if level >= 1:
            d.point([(2, 3), (4, 3), (3, 2), (3, 4)], fill=CYAN[:3] + (200,))
        if level >= 2:
            d.point([(1, 3), (5, 3), (3, 1), (3, 5)], fill=CYAN[:3] + (130,))
        if level >= 3:
            d.point([(0, 3), (6, 3), (3, 0), (3, 6)], fill=CYAN[:3] + (70,))
        frames.append(im)
    return sheet(frames)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    pixel_map(RAW / 'blue-marble.jpg', (512, 256), colors=20, saturation=1.25, brightness=1.12).save(OUT / 'earth-map.png')
    clouds(512, 256).save(OUT / 'earth-clouds.png')
    pixel_map(RAW / 'mars-viking-mdim21.jpg', (128, 64), colors=12, saturation=1.45, brightness=1.3, tint=(1.12, 0.98, 0.78)).save(OUT / 'mars-map.png')
    iss().save(OUT / 'iss.png')
    sheet(rock_frames(4.2, 4, seed=7, hot=True)).save(OUT / 'meteor.png')
    meteor_trail().save(OUT / 'meteor-trail.png')
    sheet(rock_frames(8.0, 8, seed=11, hot=False)).save(OUT / 'asteroid.png')
    sheet(ship()).save(OUT / 'ship.png')
    stars().save(OUT / 'stars.png')
    cubesat().save(OUT / 'opsis.png')
    for path in sorted(OUT.glob('*.png')):
        with Image.open(path) as im:
            print(f'{path.relative_to(ROOT).as_posix()}: {im.size[0]}x{im.size[1]}')


if __name__ == '__main__':
    main()
