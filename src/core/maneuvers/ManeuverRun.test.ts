import { describe, expect, it } from 'vitest';
import { MANEUVER_RULES, MANEUVERS, maneuverConditions } from '../../content/maneuvers';
import { makeCrewMember, makeGameState } from '../../test-utils/factories';
import type { ManeuverId } from '../flow/types';
import { arrivalFor, ManeuverRun } from './ManeuverRun';

const run = (id: ManeuverId, over: Parameters<typeof makeGameState>[0] = {}) =>
  new ManeuverRun(MANEUVERS[id], makeGameState(over), MANEUVER_RULES);

/** Deja la marca en `target` (0..1) desde el inicio de la etapa, en la primera pasada. */
function aimAt(maneuver: ManeuverRun, target: number): void {
  maneuver.update(target / maneuver.stage!.speed);
}

function confirmAll(maneuver: ManeuverRun, decision: 'risk' | 'repair' = 'risk'): void {
  for (const item of maneuver.items) maneuver.decide(item.systemId, item.status === 'green' ? 'go' : decision);
}

/** Juega todas las etapas: `true` acierta en el centro, `false` falla en el borde contrario. */
function play(maneuver: ManeuverRun, hits: boolean[]): void {
  confirmAll(maneuver);
  maneuver.start();
  for (const hit of hits) {
    if ((maneuver.stage!.kind ?? 'timing') !== 'timing') maneuver.complete(hit ? 1 : 0);
    else {
      const zone = maneuver.zone!;
      aimAt(maneuver, hit ? zone.center : zone.center > 0.5 ? 0.01 : 0.99);
      maneuver.press();
    }
    maneuver.next();
  }
}

describe('maniobras', () => {
  it('las cuatro maniobras tienen las etapas del diseño', () => {
    expect(Object.values(MANEUVERS).map((m) => m.stages.length)).toEqual([8, 4, 5, 3]);
    for (const m of Object.values(MANEUVERS)) {
      for (const stage of m.stages) for (const system of stage.systems) expect(m.checklist).toContain(system);
    }
  });

  describe('checklist Go / No-Go', () => {
    it('no deja empezar sin confirmar todas las estaciones', () => {
      const maneuver = run('landing');
      expect(maneuver.start()).toBe(false);
      confirmAll(maneuver);
      expect(maneuver.start()).toBe(true);
      expect(maneuver.step).toBe('stage');
    });

    it('un sistema en verde sólo se confirma con "go"', () => {
      const maneuver = run('landing');
      expect(maneuver.decide('heatShield', 'risk')).toBe(false);
      expect(maneuver.decide('heatShield', 'go')).toBe(true);
      expect(maneuver.decide('heatShield', 'go')).toBe(false);
    });

    it('reparar un sistema en amarillo gasta un repuesto y lo deja en verde', () => {
      const maneuver = run('landing', { systems: { ...makeGameState().systems, parachutes: 'yellow' } });
      expect(maneuver.decide('parachutes', 'go')).toBe(false);
      expect(maneuver.decide('parachutes', 'repair')).toBe(true);
      expect(maneuver.spares).toBe(5);
      expect(maneuver.items.find((i) => i.systemId === 'parachutes')!.status).toBe('green');
    });

    it('sin repuestos suficientes no se puede reparar, pero sí arriesgarse', () => {
      const maneuver = run('landing', {
        systems: { ...makeGameState().systems, heatShield: 'red' },
        inventory: { foodKg: 10, spares: 1, samples: [] },
      });
      expect(maneuver.canRepair('heatShield')).toBe(false);
      expect(maneuver.decide('heatShield', 'repair')).toBe(false);
      expect(maneuver.decide('heatShield', 'risk')).toBe(true);
    });

    it('arriesgarse con un sistema en amarillo achica la zona de sus etapas', () => {
      const green = run('landing');
      confirmAll(green);
      green.start();
      const yellow = run('landing', { systems: { ...makeGameState().systems, heatShield: 'yellow' } });
      confirmAll(yellow);
      yellow.start();
      expect(yellow.zone!.width).toBeCloseTo(green.zone!.width * MANEUVER_RULES.zoneFactor.yellow);
    });
  });

  describe('etapas', () => {
    it('la marca va y vuelve por la barra', () => {
      const maneuver = run('landing');
      confirmAll(maneuver);
      maneuver.start();
      maneuver.complete(1);
      maneuver.next();
      const speed = maneuver.stage!.speed;
      maneuver.update(0.25 / speed);
      expect(maneuver.marker).toBeCloseTo(0.25);
      maneuver.update(1 / speed);
      expect(maneuver.marker).toBeCloseTo(0.75);
    });

    it('acertar en el centro da precisión 1 y no gasta combustible', () => {
      const maneuver = run('ascent');
      play(maneuver, [true, true, true, true, true, true, true, true]);
      expect(maneuver.step).toBe('done');
      expect(maneuver.precision).toBeCloseTo(1);
      expect(maneuver.fuel).toBe(1);
    });

    it('un error cuesta combustible pero la maniobra sigue hasta el final', () => {
      const maneuver = run('ascent');
      play(maneuver, [false, true, false, true, true, true, true, true]);
      expect(maneuver.step).toBe('done');
      expect(maneuver.misses).toBe(2);
      expect(maneuver.fuel).toBeCloseTo(1 - 2 * MANEUVER_RULES.fuelPerMiss);
      expect(maneuver.precision).toBeCloseTo(6 / 8);
    });

    it('los minijuegos gastan combustible según el puntaje y no se pueden terminar con la barra', () => {
      const maneuver = run('ascent');
      confirmAll(maneuver);
      maneuver.start();
      expect(maneuver.stage!.kind).toBe('fuel');
      expect(maneuver.press()).toBeNull();
      expect(maneuver.complete(0.5)).toMatchObject({ stageId: 'fuel', hit: true, precision: 0.5 });
      expect(maneuver.fuel).toBeCloseTo(1 - 0.5 * MANEUVER_RULES.fuelPerMiss);
      maneuver.next();
      maneuver.complete(1);
      expect(maneuver.fuel).toBeCloseTo(1 - 0.5 * MANEUVER_RULES.fuelPerMiss);
    });

    it('no se puede apretar fuera de una etapa', () => {
      const maneuver = run('ascent');
      expect(maneuver.press()).toBeNull();
    });

    it('las zonas salen de la semilla de la partida: misma semilla, mismas zonas', () => {
      const zones = (seed: number) => {
        const maneuver = run('landing', { rngState: seed });
        confirmAll(maneuver);
        maneuver.start();
        return maneuver.zone!.center;
      };
      expect(zones(5)).toBe(zones(5));
      expect(zones(5)).not.toBe(zones(6));
    });
  });

  describe('resultado', () => {
    it('el aterrizaje perfecto queda cerca de la base y uno malo, lejos', () => {
      const good = run('landing');
      play(good, [true, true, true, true]);
      const bad = run('landing');
      play(bad, [false, false, false, false]);
      expect(good.toPhaseResult().state.landingDistanceKm).toBe(MANEUVER_RULES.landingDistanceKm.best);
      expect(bad.toPhaseResult().state.landingDistanceKm).toBe(MANEUVER_RULES.landingDistanceKm.worst);
    });

    it('la precisión del despegue de Marte define el combustible para la vuelta', () => {
      const good = run('marsAscent');
      play(good, [true, true, true, true, true]);
      const bad = run('marsAscent');
      play(bad, [false, false, false, false, false]);
      expect(good.toPhaseResult().state.fuel).toBe(1);
      expect(bad.toPhaseResult().state.fuel).toBe(MANEUVER_RULES.returnFuel.worst);
    });

    it('en la reentrada cada tripulante sale caminando o en camilla según su condición física', () => {
      const crew = makeGameState().crew.map((m, i) => ({ ...m, condition: i === 0 ? 0.4 : 0.9 }));
      const maneuver = run('reentry', { crew });
      play(maneuver, [true, true, true]);
      expect(maneuver.crewArrival).toEqual({ vega: 'stretcher', miga: 'walk', brote: 'walk', senda: 'walk' });
      expect(arrivalFor(makeCrewMember({ condition: 0.6 }).condition, MANEUVER_RULES)).toBe('walk');
    });

    it('devuelve el resultado de su fase con el historial, el Rng avanzado y sin tocar el estado original', () => {
      const state = makeGameState({ phase: 'landing', systems: { ...makeGameState().systems, parachutes: 'yellow' } });
      const maneuver = new ManeuverRun(MANEUVERS.landing, state, MANEUVER_RULES);
      maneuver.decide('parachutes', 'repair');
      play(maneuver, [true, false, true, true]);
      const result = maneuver.toPhaseResult();

      expect(result).toMatchObject({ phase: 'landing', outcome: 'completed' });
      expect(result.state.systems.parachutes).toBe('green');
      expect(result.state.rngState).not.toBe(state.rngState);
      expect(result.state.history.map((e) => e.key)).toEqual([
        'maneuver.repair',
        'landing.entry',
        'landing.parachute',
        'landing.heatShieldSeparation',
        'landing.descentEngines',
        'landing',
      ]);
      expect(state.systems.parachutes).toBe('yellow');
      expect(state.history).toEqual([]);
      expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    });

    it('no entrega resultado antes de terminar', () => {
      expect(() => run('ascent').toPhaseResult()).toThrow();
    });
  });

  it('el aterrizaje es más difícil con poco combustible o con la carga más pesada', () => {
    expect(maneuverConditions('ascent', makeGameState({ fuel: 0 })).speedFactor).toBe(1);
    expect(maneuverConditions('landing', makeGameState({ fuel: 1, loadout: 'balanced' })).speedFactor).toBe(1);
    expect(maneuverConditions('landing', makeGameState({ fuel: 0.5, loadout: 'waterShield' })).speedFactor).toBeCloseTo(1.2);
    // Con polvo en Gale (UV real de REMS) la marca va más rápido; con cielo limpio, igual.
    const calm = makeGameState({ fuel: 1, loadout: 'balanced' });
    expect(maneuverConditions('landing', calm, 'High').speedFactor).toBe(1);
    expect(maneuverConditions('landing', calm, 'Low').speedFactor).toBeGreaterThan(maneuverConditions('landing', calm, 'Moderate').speedFactor);
    expect(maneuverConditions('ascent', calm, 'Low').speedFactor).toBe(1);
  });
});
