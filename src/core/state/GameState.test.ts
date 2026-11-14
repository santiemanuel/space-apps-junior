import { describe, expect, it } from 'vitest';
import { CREW_ROSTER } from '../../content/crew';
import { makeGameState, makeIncident, makePhaseResult } from '../../test-utils/factories';
import { PHASE_ORDER } from '../flow/types';
import { SYSTEM_IDS } from '../systems/types';

describe('contrato GameState', () => {
  it('es JSON puro: se guarda y se carga sin perder nada', () => {
    const state = makeGameState({
      activeIncidents: [makeIncident()],
      inventory: { foodKg: 10, spares: 2, samples: [{ id: 's1', siteId: 'gale-1', massKg: 0.4, value: 3 }] },
      history: [{ simDate: '2024-05-20T00:00:00Z', phase: 'mars', kind: 'incident', key: 'radiationStorm' }],
    });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('el resultado de una fase también es serializable', () => {
    const result = makePhaseResult();
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it('la tripulación de prueba coincide con el plantel y cubre los 4 roles', () => {
    const state = makeGameState();
    expect(state.crew.map((m) => m.id)).toEqual(CREW_ROSTER.map((p) => p.id));
    expect(new Set(state.crew.map((m) => m.role)).size).toBe(4);
    expect(state.crew.some((m) => m.id === state.activeCrewId)).toBe(true);
  });

  it('tiene un estado para cada sistema', () => {
    expect(Object.keys(makeGameState().systems).sort()).toEqual([...SYSTEM_IDS].sort());
  });

  it('las fases están en el orden del arco de la misión', () => {
    expect(PHASE_ORDER).toEqual(['prep', 'ascent', 'cruiseOut', 'landing', 'mars', 'marsAscent', 'cruiseBack', 'reentry']);
  });
});
