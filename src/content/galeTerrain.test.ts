import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { craterKm, craterPoint, GALE_CRATER_VIEW, GALE_FACTS, GALE_PLACES, GALE_ROCKS, GALE_STRIPS, ROCK_TYPES } from './galeTerrain';

describe('fuentes y rocas de Gale', () => {
  it('cada franja y cada cifra tiene su fuente de la NASA y fotos de docs/referencias/gale/', () => {
    const sources = [...Object.values(GALE_FACTS).map((f) => f.source), ...GALE_STRIPS.flatMap((s) => s.facts)];
    for (const source of sources) expect(source.url, source.says).toMatch(/^https:\/\/(science\.nasa\.gov|www\.nasa\.gov|www\.jpl\.nasa\.gov)\//);
    for (const strip of GALE_STRIPS) {
      expect(strip.photos.length, strip.id).toBeGreaterThanOrEqual(2);
      for (const photo of strip.photos) expect(() => readFileSync(`docs/referencias/gale/${photo.pia}.jpg`), photo.pia).not.toThrow();
    }
  });

  it('el mapa del cráter está georreferenciado: el cráter queda centrado y el borde de 154 km entra en la imagen', () => {
    const { artSize, pxPerKm } = GALE_CRATER_VIEW;
    const center = craterPoint(GALE_PLACES.craterCenter.lat, GALE_PLACES.craterCenter.lon);
    expect(Math.abs(center.x - artSize / 2)).toBeLessThan(2);
    expect(Math.abs(center.y - artSize / 2)).toBeLessThan(2);
    expect((GALE_FACTS.craterDiameterKm.value / 2) * pxPerKm).toBeLessThan(artSize / 2);
    // Curiosity aterrizó en la llanura del norte y hoy está unos 11 km al sur, en la ladera del monte Sharp.
    const landing = craterPoint(GALE_PLACES.bradbury.lat, GALE_PLACES.bradbury.lon);
    const gediz = craterPoint(GALE_PLACES.gediz.lat, GALE_PLACES.gediz.lon);
    expect(gediz.y).toBeGreaterThan(landing.y);
    expect(Math.round(craterKm(GALE_PLACES.bradbury, GALE_PLACES.gediz))).toBe(11);
    expect(GALE_CRATER_VIEW.url).toMatch(/^https:\/\/science\.nasa\.gov\//);
    expect(() => readFileSync(`public/${GALE_CRATER_VIEW.image}`)).not.toThrow();
  });

  it('un tipo de roca distinto por franja, cada uno con su sprite en el atlas de Marte', () => {
    expect(new Set(ROCK_TYPES).size).toBe(GALE_STRIPS.length);
    const frames = JSON.parse(readFileSync('public/assets/mars/props.json', 'utf8')).frames as Record<string, unknown>;
    for (const strip of GALE_STRIPS) expect(frames[`sample-${GALE_ROCKS[strip.id].rock}`], strip.id).toBeDefined();
  });
});
