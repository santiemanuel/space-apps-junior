import { describe, expect, it } from 'vitest';
import donkiFixture from '../fixtures/donki-flr.json';
import neowsFixture from '../fixtures/neows-feed.json';
import type { RawDonkiFlare, RawNeoWsFeed } from '../types';
import { toSolarFlares } from './donki';
import { toNearEarthObjects } from './neows';

describe('toSolarFlares (DONKI)', () => {
  it('mapea clases GOES a flujo y descarta registros inválidos', () => {
    const raw: RawDonkiFlare[] = [
      ...(donkiFixture as RawDonkiFlare[]),
      { flrID: 'sin-clase', beginTime: 't', peakTime: null, endTime: null, classType: null },
      { flrID: 'mala', beginTime: 't', peakTime: null, endTime: null, classType: '??' },
    ];
    const flares = toSolarFlares(raw);
    expect(flares).toHaveLength(donkiFixture.length);
    expect(flares.find((f) => f.classType === 'X1.3')?.peakFlux).toBeCloseTo(1.3e-4);
  });
});

describe('toNearEarthObjects (NeoWs)', () => {
  const neos = toNearEarthObjects(neowsFixture as RawNeoWsFeed);

  it('aplana el feed por fecha y convierte strings numéricos', () => {
    expect(neos).toHaveLength(neowsFixture.element_count);
    for (const neo of neos) {
      expect(Number.isFinite(neo.missDistanceLunar)).toBe(true);
      expect(neo.diameterMeters).toBeGreaterThan(0);
    }
  });

  it('usa la aproximación más cercana de cada objeto', () => {
    const feed: RawNeoWsFeed = {
      element_count: 1,
      near_earth_objects: {
        '2026-01-01': [{
          id: '1', name: 'test', is_potentially_hazardous_asteroid: true,
          estimated_diameter: { meters: { estimated_diameter_min: 100, estimated_diameter_max: 300 } },
          close_approach_data: [
            { close_approach_date: 'a', relative_velocity: { kilometers_per_second: '5' }, miss_distance: { lunar: '40', kilometers: '0' } },
            { close_approach_date: 'b', relative_velocity: { kilometers_per_second: '9' }, miss_distance: { lunar: '12', kilometers: '0' } },
          ],
        }],
      },
    };
    expect(toNearEarthObjects(feed)[0]).toMatchObject({ diameterMeters: 200, missDistanceLunar: 12, velocityKmS: 9, approachDate: 'b' });
  });
});
