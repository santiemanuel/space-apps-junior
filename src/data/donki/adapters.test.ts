import { describe, expect, it } from 'vitest';
import { toSolarFlares, toSolarParticleEvents } from './adapters';

describe('toSolarFlares', () => {
  it('acepta el formato de la API y el del archivo, y descarta clases inválidas', () => {
    const flares = toSolarFlares([
      { flrID: 'api', beginTime: '2026-11-05T18:21Z', peakTime: '2026-11-05T18:33Z', classType: 'M3.5' },
      { id: 'archivo', beginTime: '2026-11-06T09:31Z', peakTime: null, classType: 'X1.3' },
      { flrID: 'sin-clase', beginTime: 't', peakTime: null, classType: null },
      { flrID: 'mala', beginTime: 't', peakTime: null, classType: '??' },
    ]);
    expect(flares.map((f) => f.id)).toEqual(['api', 'archivo']);
    expect(flares[1]).toMatchObject({ peakTime: '2026-11-06T09:31Z' });
    expect(flares[1]!.peakFlux).toBeCloseTo(1.3e-4);
  });
});

describe('toSolarParticleEvents', () => {
  it('normaliza instrumentos de la API y del archivo', () => {
    const events = toSolarParticleEvents([
      { sepID: 'api', eventTime: '2026-01-18T22:55Z', instruments: [{ displayName: 'GOES-P: SEISS >10 MeV' }] },
      { id: 'archivo', eventTime: '2026-01-19T02:00Z', instruments: ['SOHO: COSTEP 15.8-39.8 MeV'] },
    ]);
    expect(events.map((e) => e.instruments[0])).toEqual(['GOES-P: SEISS >10 MeV', 'SOHO: COSTEP 15.8-39.8 MeV']);
  });
});
