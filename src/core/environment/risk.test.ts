import { describe, expect, it } from 'vitest';
import { flareClassToFlux, radiationRisk, radioBlackoutLevel, SEP_RISK_FLOOR } from './risk';
import type { SolarFlare, SolarParticleEvent } from './types';

const flare = (classType: string): SolarFlare => ({ id: classType, classType, peakTime: '', peakFlux: flareClassToFlux(classType) });
const sep = (eventTime: string): SolarParticleEvent => ({ id: eventTime, eventTime, instruments: [] });

describe('flareClassToFlux', () => {
  it('convierte clases GOES a W/m²', () => {
    expect(flareClassToFlux('C1')).toBeCloseTo(1e-6);
    expect(flareClassToFlux('M2.5')).toBeCloseTo(2.5e-5);
    expect(flareClassToFlux('X1.0')).toBeCloseTo(1e-4);
  });

  it('rechaza clases inválidas', () => {
    expect(() => flareClassToFlux('Z9')).toThrow();
  });
});

describe('radioBlackoutLevel (escala NOAA R)', () => {
  it.each([
    [[], 0],
    [['C9.9'], 0],
    [['M1.0'], 1],
    [['M5.0'], 2],
    [['C2', 'X1.0'], 3],
    [['X10'], 4],
    [['X28'], 5],
  ])('%j → R%i', (classes, level) => {
    expect(radioBlackoutLevel(classes.map(flare))).toBe(level);
  });
});

describe('radiationRisk', () => {
  it('crece de forma logarítmica con la llamarada más intensa', () => {
    expect(radiationRisk([], [])).toBe(0);
    expect(radiationRisk([flare('C1')], [])).toBeCloseTo(0.1, 1);
    expect(radiationRisk([flare('C1'), flare('M1')], [])).toBeCloseTo(0.4, 1);
    expect(radiationRisk([flare('X1')], [])).toBeCloseTo(0.7, 1);
    expect(radiationRisk([flare('X20')], [])).toBe(1);
  });

  it('los eventos SEP elevan el riesgo aunque las llamaradas sean débiles', () => {
    expect(radiationRisk([flare('C1')], [sep('2026-01-18T22:33Z')])).toBe(SEP_RISK_FLOOR);
    const twoDays = radiationRisk([], [sep('2026-01-18T22:33Z'), sep('2026-01-18T23:00Z'), sep('2026-01-19T02:00Z')]);
    expect(twoDays).toBeCloseTo(SEP_RISK_FLOOR + 0.05);
  });
});
