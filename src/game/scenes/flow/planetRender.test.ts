import { describe, expect, it } from 'vitest';
import { buildPlanetLookup, renderPlanet, type PlanetOptions } from './planetRender';

const OPTIONS: PlanetOptions = {
  radius: 10,
  glow: 3,
  mapWidth: 16,
  mapHeight: 8,
  tiltDeg: 0,
  light: [1, 0, 0.4],
  atmosphere: [144, 205, 244],
};

/** Mapa de un solo color, con una columna roja opcional. */
function map(redColumn = -1, width = OPTIONS.mapWidth, height = OPTIONS.mapHeight): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const red = i % width === redColumn;
    data.set(red ? [255, 0, 0, 255] : [40, 120, 200, 255], i * 4);
  }
  return data;
}

const pixel = (out: Uint8ClampedArray, size: number, x: number, y: number) => Array.from(out.slice((y * size + x) * 4, (y * size + x) * 4 + 4));

describe('planetas del menú', () => {
  const lookup = buildPlanetLookup(OPTIONS);
  const { size } = lookup;

  it('el lienzo tiene lugar para el disco y su halo', () => {
    expect(size).toBe(26);
    expect(lookup.row[(size / 2) * size + size / 2]).toBeGreaterThanOrEqual(0);
    expect(lookup.row[0]).toBe(-1);
  });

  it('el disco es opaco, el halo semitransparente y las esquinas vacías', () => {
    const out = new Uint8ClampedArray(size * size * 4);
    renderPlanet(out, lookup, map(), 0);
    expect(pixel(out, size, size / 2, size / 2)[3]).toBe(255);
    const halo = pixel(out, size, size / 2 + 10, size / 2)[3]!;
    expect(halo).toBeGreaterThan(0);
    expect(halo).toBeLessThan(255);
    expect(pixel(out, size, 0, 0)[3]).toBe(0);
  });

  it('el lado del Sol se ve más claro que el lado de noche', () => {
    const out = new Uint8ClampedArray(size * size * 4);
    renderPlanet(out, lookup, map(), 0);
    const day = pixel(out, size, size / 2 + 5, size / 2);
    const night = pixel(out, size, size / 2 - 8, size / 2);
    expect(day[2]!).toBeGreaterThan(night[2]! * 2);
  });

  it('girar mueve la superficie hacia la derecha y una vuelta entera la deja igual', () => {
    const redAt = (rotation: number) => {
      const out = new Uint8ClampedArray(size * size * 4);
      renderPlanet(out, lookup, map(8), rotation);
      const y = size / 2;
      const xs = Array.from({ length: size }, (_, x) => x).filter((x) => {
        const [r, , b] = pixel(out, size, x, y);
        return r! > b! && pixel(out, size, x, y)[3] === 255;
      });
      return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
    };
    expect(redAt(1)).toBeGreaterThan(redAt(0));
    const out0 = new Uint8ClampedArray(size * size * 4);
    const outTurn = new Uint8ClampedArray(size * size * 4);
    renderPlanet(out0, lookup, map(8), 3);
    renderPlanet(outTurn, lookup, map(8), 3 + OPTIONS.mapWidth);
    expect(outTurn).toEqual(out0);
  });

  it('las nubes tapan la superficie según su opacidad', () => {
    const clouds = new Uint8ClampedArray(OPTIONS.mapWidth * OPTIONS.mapHeight * 4).fill(255);
    const clear = new Uint8ClampedArray(size * size * 4);
    const cloudy = new Uint8ClampedArray(size * size * 4);
    renderPlanet(clear, lookup, map(), 0);
    renderPlanet(cloudy, lookup, map(), 0, clouds, 0);
    const c = size / 2;
    expect(pixel(cloudy, size, c + 5, c)[0]!).toBeGreaterThan(pixel(clear, size, c + 5, c)[0]!);
  });

  it('inclinar el eje cambia qué latitud queda en cada píxel', () => {
    const tilted = buildPlanetLookup({ ...OPTIONS, tiltDeg: 25 });
    const p = (size / 2) * size + size / 2 + 7;
    expect(tilted.row[p]).not.toBe(lookup.row[p]);
  });
});
