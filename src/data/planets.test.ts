import { describe, expect, it } from 'vitest';
import { cruiseDelaySeconds, distanceAu, earthMarsDelaySeconds, heliocentric } from '../core/environment/orbits';
import { EARTH_ORBIT, MARS_ORBIT } from './planets';

const earthMarsAu = (date: string) => distanceAu(heliocentric(EARTH_ORBIT, date), heliocentric(MARS_ORBIT, date));

describe('órbitas aproximadas de JPL', () => {
  it('el acercamiento del 06/10/2020 fue de 62,07 millones de km (0,415 UA)', () => {
    expect(earthMarsAu('2020-10-06T00:00:00Z')).toBeCloseTo(0.415, 2);
  });

  it('cerca de la conjunción de noviembre de 2023 Marte queda del otro lado del Sol (~2,5 UA)', () => {
    expect(earthMarsAu('2023-11-18T00:00:00Z')).toBeGreaterThan(2.4);
  });

  it('en la estancia de 2024 la señal tarda entre 15 y 22 minutos (§3.7)', () => {
    const minutes = earthMarsDelaySeconds(EARTH_ORBIT, MARS_ORBIT, '2024-05-20T00:00:00Z') / 60;
    expect(minutes).toBeGreaterThan(15);
    expect(minutes).toBeLessThan(22);
  });

  it('al salir la nave está a segundos de luz y al llegar, a la demora de Marte', () => {
    const window = { start: '2024-01-15T00:00:00Z', end: '2024-05-15T00:00:00Z' };
    expect(cruiseDelaySeconds(EARTH_ORBIT, MARS_ORBIT, window, 'out', window.start)).toBeLessThan(1);
    expect(cruiseDelaySeconds(EARTH_ORBIT, MARS_ORBIT, window, 'out', window.end)).toBeCloseTo(earthMarsDelaySeconds(EARTH_ORBIT, MARS_ORBIT, window.end), 0);
  });
});
