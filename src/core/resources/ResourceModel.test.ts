import { describe, expect, it } from 'vitest';
import { TEST_POWER as power, TEST_RATES as rates } from '../../test-utils/factories';
import { ResourceModel } from './ResourceModel';

const initial = { oxygen: 10, water: 30, food: 20, power: 50 };

describe('ResourceModel', () => {
  it('consume según las tasas por tripulante y día', () => {
    const model = new ResourceModel({ crew: 4, initial, rates, power });
    model.tick(24);
    expect(model.snapshot.oxygen).toBeCloseTo(10 - rates.oxygen * 4);
    expect(model.snapshot.water).toBeCloseTo(30 - rates.water * 4);
  });

  it('carga la batería con el balance neto y la satura en su capacidad', () => {
    const model = new ResourceModel({ crew: 1, initial, rates, power });
    model.tick(10);
    expect(model.snapshot.power).toBeCloseTo(70);
    model.tick(100);
    expect(model.snapshot.power).toBe(100);
  });

  it('una carga mayor que la generación vacía la batería', () => {
    const model = new ResourceModel({ crew: 1, initial, rates, power: { ...power, baseLoadKw: 15 } });
    model.tick(10);
    expect(model.depleted()).toContain('power');
  });

  it('informa de recursos agotados y días restantes', () => {
    const model = new ResourceModel({ crew: 2, initial, rates, power });
    expect(model.daysRemaining('oxygen')).toBeCloseTo(10 / (rates.oxygen * 2));
    expect(model.tick(24 * 30)).toEqual(expect.arrayContaining(['oxygen', 'water', 'food']));
  });
});
