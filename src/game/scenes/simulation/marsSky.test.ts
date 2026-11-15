import { describe, expect, it } from 'vitest';
import { skyLight } from './marsSky';

const rgb = (c: number) => ({ r: c >> 16, g: (c >> 8) & 0xff, b: c & 0xff });

describe('luz del cielo de Gale', () => {
  it('de noche está oscuro, amanece de a poco y al mediodía hay luz plena', () => {
    const at = (sun: number) => skyLight({ sun, dust: 1, storm: false }).brightness;
    expect(at(0)).toBeLessThan(0.3);
    expect(at(0)).toBeLessThan(at(0.15));
    expect(at(0.15)).toBeLessThan(at(0.5));
    expect(at(1)).toBeCloseTo(1);
  });

  it('el atardecer es azul y el mediodía, caramelo', () => {
    const dusk = rgb(skyLight({ sun: 0.25, dust: 1, storm: false }).ambient);
    const noon = rgb(skyLight({ sun: 1, dust: 1, storm: false }).ambient);
    expect(dusk.b).toBeGreaterThan(dusk.r);
    expect(noon.r).toBeGreaterThan(noon.b);
  });

  it('el polvo apaga la luz del día y la tormenta todavía más', () => {
    const noon = (dust: number, storm: boolean) => skyLight({ sun: 1, dust, storm }).brightness;
    expect(noon(0.45, false)).toBeLessThan(noon(1, false));
    expect(noon(0.45, true)).toBeLessThan(noon(0.45, false));
    expect(noon(0.45, true)).toBeGreaterThan(skyLight({ sun: 0, dust: 1, storm: false }).brightness);
  });
});
