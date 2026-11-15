import { describe, expect, it } from 'vitest';
import { makeCrew } from '../../test-utils/factories';
import { crewPresence } from './presence';

const calm = { sleeping: false, sheltering: false, repairing: false };
const vega = () => makeCrew()[0]!;

describe('estado de cada tripulante (como en Discord)', () => {
  it('trabajando y bien: en línea', () => {
    expect(crewPresence(vega(), calm)).toBe('online');
  });

  it('durmiendo o muy cansado: ausente', () => {
    expect(crewPresence(vega(), { ...calm, sleeping: true })).toBe('away');
    expect(crewPresence({ ...vega(), fatigue: 0.9 }, calm)).toBe('away');
    expect(crewPresence({ ...vega(), slowReasonKey: 'hud.crewSlow.fatigue' }, calm)).toBe('away');
  });

  it('en el refugio, reparando o enfermo: no molestar', () => {
    expect(crewPresence(vega(), { ...calm, sheltering: true })).toBe('busy');
    expect(crewPresence(vega(), { ...calm, repairing: true })).toBe('busy');
    expect(crewPresence({ ...vega(), condition: 0.2 }, { ...calm, sleeping: true })).toBe('busy');
  });

  it('en reposo en la enfermería: desconectado (manda sobre todo lo demás)', () => {
    expect(crewPresence({ ...vega(), resting: true }, { ...calm, sheltering: true })).toBe('offline');
  });
});
