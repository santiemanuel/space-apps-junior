import { describe, expect, it } from 'vitest';
import { Rng } from './Rng';

describe('Rng', () => {
  it('es determinista para una misma semilla', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    expect(Array.from({ length: 5 }, () => a.next())).toEqual(Array.from({ length: 5 }, () => b.next()));
  });

  it('genera valores en [0, 1) y respeta rangos', () => {
    const rng = new Rng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng.between(10, 20);
      expect(v).toBeGreaterThanOrEqual(10);
      expect(v).toBeLessThan(20);
    }
  });

  it('pick falla con listas vacías', () => {
    expect(() => new Rng(1).pick([])).toThrow();
  });
});
