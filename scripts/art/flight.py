"""Pixel art de las escenas de vuelo (escena `Maneuver`): cohete con cápsula, propulsores laterales, torre de
lanzamiento, llama, humo, cápsula con escudo térmico, escudo suelto, paracaídas y nave de ascenso de Marte.

Reproducible y sin red: python scripts/art/flight.py
Escribe en public/assets/ui/flight/ (registro en docs/pixel-art.md). Todo se dibuja acá, píxel por píxel, con la
paleta de la interfaz (biblia-visual.md §2).
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public' / 'assets' / 'ui' / 'flight'

INK = (26, 32, 44, 255)
WHITE = (237, 242, 247, 255)
LIGHT = (203, 213, 224, 255)
GREY = (160, 174, 192, 255)
DARK = (74, 85, 104, 255)
ORANGE = (237, 137, 54, 255)
ORANGE_LIGHT = (246, 173, 85, 255)
RED = (229, 62, 62, 255)
RED_DARK = (155, 44, 44, 255)
YELLOW = (254, 252, 191, 255)
GOLD = (236, 201, 75, 255)
CYAN = (144, 205, 244, 255)
BROWN = (120, 72, 40, 255)
BROWN_DARK = (84, 52, 30, 255)
RUST = (192, 86, 33, 255)
CLEAR = (0, 0, 0, 0)


def outline(im: Image.Image, color=INK) -> Image.Image:
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


def rocket() -> Image.Image:
    """Etapa central con la cápsula arriba (mirando hacia arriba). Los propulsores van aparte."""
    im = Image.new('RGBA', (16, 56), CLEAR)
    d = ImageDraw.Draw(im)
    d.polygon([(8, 1), (12, 9), (4, 9)], fill=LIGHT)
    d.line([(8, 1), (5, 8)], fill=WHITE)
    d.rectangle([4, 10, 11, 14], fill=WHITE)
    d.point([(7, 11), (8, 11)], fill=CYAN)
    d.rectangle([3, 15, 12, 50], fill=WHITE)
    d.line([3, 15, 3, 50], fill=LIGHT)
    d.line([12, 15, 12, 50], fill=GREY)
    for y in (20, 34):
        d.rectangle([3, y, 12, y + 1], fill=ORANGE)
    d.rectangle([3, 44, 12, 46], fill=DARK)
    d.polygon([(4, 51), (11, 51), (12, 54), (3, 54)], fill=DARK)
    return outline(im)


def booster() -> Image.Image:
    """Propulsor lateral (el de la izquierda; el derecho es el mismo espejado)."""
    im = Image.new('RGBA', (8, 38), CLEAR)
    d = ImageDraw.Draw(im)
    d.polygon([(4, 1), (6, 5), (2, 5)], fill=LIGHT)
    d.rectangle([2, 6, 6, 33], fill=WHITE)
    d.line([6, 6, 6, 33], fill=GREY)
    d.rectangle([2, 26, 6, 27], fill=ORANGE)
    d.polygon([(2, 34), (6, 34), (7, 36), (1, 36)], fill=DARK)
    return outline(im)


def tower() -> Image.Image:
    """Torre de lanzamiento: reticulado rojo con un brazo de acceso para la tripulación."""
    im = Image.new('RGBA', (20, 74), CLEAR)
    d = ImageDraw.Draw(im)
    d.rectangle([2, 4, 3, 72], fill=RED)
    d.rectangle([9, 4, 10, 72], fill=RED)
    for y in range(6, 72, 6):
        d.line([(3, y), (9, y + 5)], fill=RED_DARK)
        d.line([(3, y + 5), (9, y)], fill=RED_DARK)
    d.rectangle([1, 2, 11, 4], fill=RED_DARK)
    d.rectangle([10, 16, 19, 18], fill=GREY)
    d.point((19, 15), fill=GOLD)
    return outline(im)


def flame() -> list[Image.Image]:
    """Llama del motor (hacia abajo), 3 cuadros que titilan."""
    frames = []
    for length in (14, 17, 15):
        im = Image.new('RGBA', (12, 20), CLEAR)
        d = ImageDraw.Draw(im)
        d.polygon([(1, 0), (10, 0), (6, length)], fill=RED)
        d.polygon([(2, 0), (9, 0), (6, length - 3)], fill=ORANGE)
        d.polygon([(3, 0), (8, 0), (6, length - 7)], fill=ORANGE_LIGHT)
        d.polygon([(4, 0), (7, 0), (5, length - 10)], fill=YELLOW)
        frames.append(im)
    return frames


def smoke() -> list[Image.Image]:
    """Bocanada de humo que crece y se aclara (4 cuadros)."""
    frames = []
    for i, (r, color) in enumerate(((3, LIGHT), (4, LIGHT), (5, GREY), (6, (160, 174, 192, 160)))):
        im = Image.new('RGBA', (14, 14), CLEAR)
        d = ImageDraw.Draw(im)
        d.ellipse([7 - r, 7 - r, 7 + r, 7 + r], fill=color)
        d.ellipse([7 - r + 1, 7 - r, 7 + r - 2, 7 + r - 3], fill=WHITE if i < 2 else LIGHT)
        frames.append(im)
    return frames


def capsule() -> Image.Image:
    """Cápsula de la tripulación con el escudo térmico abajo (Orion/Dragon, simplificada)."""
    im = Image.new('RGBA', (20, 16), CLEAR)
    d = ImageDraw.Draw(im)
    d.polygon([(7, 1), (12, 1), (17, 11), (2, 11)], fill=WHITE)
    d.line([(7, 1), (2, 11)], fill=LIGHT)
    d.line([(12, 1), (17, 11)], fill=GREY)
    d.rectangle([7, 0, 12, 1], fill=GREY)
    d.rectangle([8, 5, 9, 6], fill=CYAN)
    d.rectangle([11, 5, 12, 6], fill=CYAN)
    d.rectangle([1, 12, 18, 14], fill=BROWN)
    d.line([1, 14, 18, 14], fill=BROWN_DARK)
    return outline(im)


def shield() -> Image.Image:
    """El escudo térmico suelto, cuando se separa de la cápsula."""
    im = Image.new('RGBA', (20, 6), CLEAR)
    d = ImageDraw.Draw(im)
    d.rectangle([1, 1, 18, 3], fill=BROWN)
    d.line([1, 3, 18, 3], fill=BROWN_DARK)
    return outline(im)


def parachute() -> Image.Image:
    """Paracaídas a franjas naranjas y blancas con sus cuerdas (como los de Orion y Curiosity)."""
    im = Image.new('RGBA', (34, 26), CLEAR)
    d = ImageDraw.Draw(im)
    d.pieslice([1, 1, 32, 22], 180, 360, fill=WHITE)
    for i, x0 in enumerate(range(1, 33, 4)):
        if i % 2 == 0:
            d.pieslice([1, 1, 32, 22], 180 + i * 22.5, 180 + (i + 1) * 22.5, fill=ORANGE)
    for x in (2, 9, 16, 24, 31):
        d.line([(x, 11), (16, 25)], fill=GREY)
    return outline(im)


def lander() -> Image.Image:
    """Nave de ascenso de Marte sobre sus patas, con polvo rojizo en la base."""
    im = Image.new('RGBA', (20, 40), CLEAR)
    d = ImageDraw.Draw(im)
    d.polygon([(10, 1), (14, 9), (6, 9)], fill=LIGHT)
    d.rectangle([6, 10, 13, 13], fill=WHITE)
    d.point([(9, 11), (10, 11)], fill=CYAN)
    d.rectangle([5, 14, 14, 31], fill=WHITE)
    d.line([14, 14, 14, 31], fill=GREY)
    d.rectangle([5, 22, 14, 23], fill=ORANGE)
    d.rectangle([5, 28, 14, 31], fill=RUST)
    d.polygon([(6, 32), (13, 32), (14, 35), (5, 35)], fill=DARK)
    d.line([(5, 30), (1, 38)], fill=GREY)
    d.line([(14, 30), (18, 38)], fill=GREY)
    d.line([(0, 38), (3, 38)], fill=DARK)
    d.line([(16, 38), (19, 38)], fill=DARK)
    return outline(im)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    rocket().save(OUT / 'rocket.png')
    booster().save(OUT / 'booster.png')
    tower().save(OUT / 'tower.png')
    sheet(flame()).save(OUT / 'flame.png')
    sheet(smoke()).save(OUT / 'smoke.png')
    capsule().save(OUT / 'capsule.png')
    shield().save(OUT / 'shield.png')
    parachute().save(OUT / 'parachute.png')
    lander().save(OUT / 'lander.png')
    for path in sorted(OUT.glob('*.png')):
        with Image.open(path) as im:
            print(f'{path.relative_to(ROOT).as_posix()}: {im.size[0]}x{im.size[1]}')


if __name__ == '__main__':
    main()
