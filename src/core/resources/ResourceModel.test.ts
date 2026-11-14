import { describe, expect, it } from 'vitest';
import { ResourceModel } from './ResourceModel';
import { BVAD_RATES_PER_CREW_DAY } from './rates';

const initial = { oxygen: 10, water: 30, food: 20, power: 50 };
const power = { batteryCapacityKwh: 100, solarGenerationKw: 10, baseLoadKw: 8 };

describe('ResourceModel', () => {
  it('consume según las tasas BVAD por tripulante y día', () => {
    const model = new ResourceModel({ crew: 4, initial, power });
    model.tick(24);
    expect(model.snapshot.oxygen).toBeCloseTo(10 - BVAD_RATES_PER_CREW_DAY.oxygen * 4);
    expect(model.snapshot.water).toBeCloseTo(30 - BVAD_RATES_PER_CREW_DAY.water * 4);
  });

  it('carga la batería con el balance neto y la satura en su capacidad', () => {
    const model = new ResourceModel({ crew: 1, initial, power });
    model.tick(10);
    expect(model.snapshot.power).toBeCloseTo(70);
    model.tick(100);
    expect(model.snapshot.power).toBe(100);
  });

  it('la degradación solar puede vaciar la batería', () => {
    const model = new ResourceModel({ crew: 1, initial, power });
    model.solarEfficiency = 0.5;
    model.tick(100);
    expect(model.depleted()).toContain('power');
  });

  it('informa de recursos agotados y días restantes', () => {
    const model = new ResourceModel({ crew: 2, initial, power });
    expect(model.daysRemaining('oxygen')).toBeCloseTo(10 / (BVAD_RATES_PER_CREW_DAY.oxygen * 2));
    expect(model.tick(24 * 30)).toEqual(expect.arrayContaining(['oxygen', 'water', 'food']));
  });
});
