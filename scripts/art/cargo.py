"""Pixel art de la carga de vuelta (escena `Loadout`, bodega de casilleros): caja de comida, tanque de agua, bolsa
del escudo, caja de repuestos, rocas de tres tamaños y la muestra de plantas.

Reproducible y sin red: python scripts/art/cargo.py
Escribe en public/assets/ui/cargo/ (registro en docs/produccion/pixel-art.md). Cada casillero mide 16 px de arte (×3 en
pantalla = 48 px): una pieza de 2 × 2 casilleros mide 32 × 32 px.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public' / 'assets' / 'ui' / 'cargo'
CELL = 16

INK = (26, 32, 44, 255)
WHITE = (237, 242, 247, 255)
LIGHT = (203, 213, 224, 255)
GREY = (160, 174, 192, 255)
DARK = (74, 85, 104, 255)
WOOD = (183, 121, 31, 255)
WOOD_LIGHT = (214, 158, 46, 255)
WOOD_DARK = (116, 66, 16, 255)
RED = (229, 62, 62, 255)
GREEN = (72, 187, 120, 255)
GREEN_DARK = (39, 103, 73, 255)
BLUE = (66, 153, 225, 255)
BLUE_LIGHT = (144, 205, 244, 255)
BLUE_DARK = (43, 108, 176, 255)
CYAN = (190, 227, 248, 255)
ORANGE = (237, 137, 54, 255)
RUST = (192, 86, 33, 255)
RUST_LIGHT = (221, 107, 32, 255)
RUST_DARK = (123, 52, 30, 255)
GLASS = (190, 227, 248, 140)
CLEAR = (0, 0, 0, 0)


def outline(im: Image.Image, color=INK) -> Image.Image:
    a = np.array(im)
    opaque = a[..., 3] > 0
    ring = np.zeros_like(opaque)
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        shifted = np.zeros_like(opaque)
        src = opaque[max(0, -dy):opaque.shape[0] - max(0, dy), max(0, -dx):opaque.shape[1] - max(0, dx)]
        shifted[max(0, dy):max(0, dy) + src.shape[0], max(0, dx):max(0, dx) + src.shape[1]] = src
        ring |= shifted
    ring &= ~opaque
    a[ring] = color
    return Image.fromarray(a)


def canvas(cols: int, rows: int) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    im = Image.new('RGBA', (cols * CELL, rows * CELL), CLEAR)
    return im, ImageDraw.Draw(im)


def food() -> Image.Image:
    """Caja de comida (2 × 2): madera con flejes y una manzana pintada."""
    im, d = canvas(2, 2)
    d.rectangle([3, 4, 28, 28], fill=WOOD)
    d.rectangle([3, 4, 28, 7], fill=WOOD_LIGHT)
    for y in (12, 20):
        d.line([3, y, 28, y], fill=WOOD_DARK)
    d.rectangle([7, 4, 9, 28], fill=WOOD_DARK)
    d.rectangle([22, 4, 24, 28], fill=WOOD_DARK)
    d.ellipse([12, 13, 20, 22], fill=RED)
    d.point([(14, 15), (15, 15)], fill=WHITE)
    d.line([(16, 13), (17, 10)], fill=GREEN_DARK)
    d.rectangle([17, 10, 19, 11], fill=GREEN)
    return outline(im)


def water() -> Image.Image:
    """Tanque de agua de beber (1 × 2): bidón azul con tapa y una gota."""
    im, d = canvas(1, 2)
    d.rectangle([6, 2, 9, 4], fill=LIGHT)
    d.rounded_rectangle([3, 5, 12, 29], radius=2, fill=BLUE)
    d.rectangle([4, 6, 5, 28], fill=BLUE_LIGHT)
    d.rectangle([11, 6, 12, 28], fill=BLUE_DARK)
    d.rectangle([3, 11, 12, 12], fill=BLUE_DARK)
    d.polygon([(8, 15), (10, 19), (8, 22), (6, 19)], fill=CYAN)
    return outline(im)


def shield() -> Image.Image:
    """Bolsa de agua del escudo del refugio (1 × 3): larga, celeste, con la marca de radiación."""
    im, d = canvas(1, 3)
    d.rounded_rectangle([3, 3, 12, 44], radius=3, fill=BLUE_LIGHT)
    d.rectangle([4, 5, 5, 42], fill=CYAN)
    d.rectangle([11, 5, 12, 42], fill=BLUE)
    for y in (13, 34):
        d.rectangle([3, y, 12, y + 1], fill=DARK)
    d.ellipse([4, 19, 11, 26], fill=(236, 201, 75, 255))
    d.point([(7, 22), (8, 22)], fill=INK)
    d.polygon([(7, 20), (8, 20), (7, 21)], fill=INK)
    d.polygon([(5, 24), (6, 23), (6, 25)], fill=INK)
    d.polygon([(10, 24), (9, 23), (9, 25)], fill=INK)
    return outline(im)


def spare() -> Image.Image:
    """Caja de repuestos (2 × 1): caja de herramientas gris con manija y una llave."""
    im, d = canvas(2, 1)
    d.rectangle([13, 2, 18, 3], fill=DARK)
    d.rectangle([3, 4, 28, 13], fill=GREY)
    d.rectangle([3, 4, 28, 6], fill=LIGHT)
    d.rectangle([3, 8, 28, 8], fill=DARK)
    d.rectangle([14, 7, 17, 9], fill=ORANGE)
    d.line([(6, 11), (10, 11)], fill=DARK)
    d.line([(21, 11), (25, 11)], fill=DARK)
    return outline(im)


def rock(cols: int, rows: int, seed: int) -> Image.Image:
    """Roca de Marte en su caja de muestras: irregular, rojiza, con brillo arriba a la izquierda."""
    rng = np.random.default_rng(seed)
    w, h = cols * CELL, rows * CELL
    im = Image.new('RGBA', (w, h), CLEAR)
    cx, cy = (w - 1) / 2, (h - 1) / 2
    for y in range(h):
        for x in range(w):
            dx, dy = (x - cx) / (w / 2 - 2.5), (y - cy) / (h / 2 - 2.5)
            angle = np.arctan2(dy, dx)
            bump = 0.1 * np.sin(angle * 3 + seed) + 0.06 * np.cos(angle * 5 + seed * 2)
            if dx * dx + dy * dy <= (0.9 + bump) ** 2:
                light = -dx - dy
                im.putpixel((x, y), RUST_LIGHT if light > 0.5 else RUST if light > -0.4 else RUST_DARK)
    d = ImageDraw.Draw(im)
    for _ in range(cols * rows + 1):
        x, y = int(rng.integers(4, w - 5)), int(rng.integers(4, h - 5))
        if im.getpixel((x, y))[3]:
            d.point((x, y), fill=RUST_DARK)
            d.point((x + 1, y), fill=RUST_DARK)
    return outline(im)


def plant() -> Image.Image:
    """Muestra de plantas (1 × 1): un frasco con un brote verde."""
    im, d = canvas(1, 1)
    d.rectangle([5, 2, 10, 3], fill=GREY)
    d.rounded_rectangle([3, 4, 12, 13], radius=2, fill=GLASS)
    d.rectangle([4, 11, 11, 12], fill=WOOD_DARK)
    d.line([(8, 11), (8, 7)], fill=GREEN_DARK)
    d.rectangle([5, 6, 7, 7], fill=GREEN)
    d.rectangle([9, 5, 11, 6], fill=GREEN)
    return outline(im)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    food().save(OUT / 'food.png')
    water().save(OUT / 'water.png')
    shield().save(OUT / 'shield.png')
    spare().save(OUT / 'spare.png')
    rock(1, 1, 3).save(OUT / 'rock-1x1.png')
    rock(1, 2, 5).save(OUT / 'rock-1x2.png')
    rock(2, 2, 8).save(OUT / 'rock-2x2.png')
    plant().save(OUT / 'plant.png')
    for path in sorted(OUT.glob('*.png')):
        with Image.open(path) as im:
            print(f'{path.relative_to(ROOT).as_posix()}: {im.size[0]}x{im.size[1]}')


if __name__ == '__main__':
    main()
