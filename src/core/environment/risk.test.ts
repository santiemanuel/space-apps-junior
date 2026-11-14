import { describe, expect, it } from 'vitest';
import { debrisThreatFromNeos, flareClassToFlux, neoThreat, radiationRiskFromFlares } from './risk';
import type { NearEarthObject, SolarFlare } from './types';

const flare = (classType: string): SolarFlare => ({ id: classType, classType, peakTime: '', peakFlux: flareClassToFlux(classType) });
const neo = (over: Partial<NearEarthObject>): NearEarthObject => ({
  id: 'n', name: 'n', diameterMeters: 100, missDistanceLunar: 50, velocityKmS: 10, hazardous: false, approachDate: '', ...over,
});

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

describe('radiationRiskFromFlares', () => {
  it('crece de forma logarítmica con la clase de la llamarada más intensa', () => {
    expect(radiationRiskFromFlares([])).toBe(0);
    expect(radiationRiskFromFlares([flare('C1')])).toBeCloseTo(0.1, 1);
    expect(radiationRiskFromFlares([flare('C1'), flare('M1')])).toBeCloseTo(0.4, 1);
    expect(radiationRiskFromFlares([flare('X1')])).toBeCloseTo(0.7, 1);
    expect(radiationRiskFromFlares([flare('X20')])).toBe(1);
  });
});

describe('neoThreat', () => {
  it('es mayor para objetos más grandes, cercanos y potencialmente peligrosos', () => {
    const base = neoThreat(neo({}));
    expect(neoThreat(neo({ diameterMeters: 1000 }))).toBeGreaterThan(base);
    expect(neoThreat(neo({ missDistanceLunar: 5 }))).toBeGreaterThan(base);
    expect(neoThreat(neo({ hazardous: true }))).toBeGreaterThan(base);
    expect(neoThreat(neo({ missDistanceLunar: 500 }))).toBe(0);
  });

  it('la amenaza global es la del NEO más relevante', () => {
    const neos = [neo({ missDistanceLunar: 150 }), neo({ missDistanceLunar: 3 })];
    expect(debrisThreatFromNeos(neos)).toBe(neoThreat(neos[1]!));
  });
});
