"""Estima el tamaño del píxel falso de una imagen generada, por los saltos de color más frecuentes.

Uso: python scripts/art/pixelsize.py <imagen.png> [...]
"""
import sys
from collections import Counter
from PIL import Image


def edges(im, horizontal):
    px = im.load(); w, h = im.size; hits = Counter()
    for a in range(0, (h if horizontal else w), 3):
        prev = None
        for b in range(w if horizontal else h):
            p = px[b, a] if horizontal else px[a, b]
            if prev is not None and sum(abs(p[i] - prev[i]) for i in range(4)) > 90: hits[b] += 1
            prev = p
    return hits


def estimate(im):
    best = []
    for horizontal in (True, False):
        hits = edges(im, horizontal)
        strong = sorted(k for k, v in hits.items() if v >= max(hits.values()) * 0.25)
        gaps = Counter(b - a for a, b in zip(strong, strong[1:]) if 2 < b - a < 40)
        # el paso que mejor explica las posiciones de los bordes
        scores = {}
        for step10 in range(30, 200):
            step = step10 / 10
            for phase10 in range(0, int(step * 10), 5):
                phase = phase10 / 10
                err = sum(min((k - phase) % step, step - (k - phase) % step) for k in strong) / len(strong) / step
                if step not in scores or err < scores[step]: scores[step] = err
        ranked = sorted(scores.items(), key=lambda kv: kv[1])[:4]
        best.append((gaps.most_common(4), ranked))
    return best


for path in sys.argv[1:]:
    im = Image.open(path).convert('RGBA')
    for name, (gaps, ranked) in zip(('horizontal', 'vertical'), estimate(im)):
        print(path, name, 'saltos:', gaps, '| pasos (error):', [(s, round(e, 3)) for s, e in ranked])
