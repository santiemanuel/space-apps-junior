import { describe, expect, it } from 'vitest';
import { cruiseDistanceAu } from '../../../core/meters/energy';
import { planetRadius, sunRadius } from './spaceView';

describe('lo que se ve por las ventanas', () => {
  it('el Sol se ve más chico al alejarse de la Tierra y más grande al volver', () => {
    expect(sunRadius(cruiseDistanceAu(0, 'out'))).toBe(6);
    expect(sunRadius(cruiseDistanceAu(1, 'out'))).toBe(4);
    const along = [0, 0.25, 0.5, 0.75, 1].map((p) => sunRadius(cruiseDistanceAu(p, 'out')));
    expect(along).toEqual([...along].sort((a, b) => b - a));
    expect(sunRadius(cruiseDistanceAu(1, 'back'))).toBe(6);
  });

  it('el planeta de destino crece de un punto a un disco al llegar', () => {
    expect(planetRadius(0)).toBe(1);
    expect(planetRadius(1)).toBe(14);
    expect(planetRadius(0.5)).toBeLessThan(planetRadius(0.9));
    expect(planetRadius(-1)).toBe(1);
    expect(planetRadius(2)).toBe(14);
  });
});
