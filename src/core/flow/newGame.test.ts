import { describe, expect, it } from 'vitest';
import { CREW_ROSTER, STARTING_CREW_ID } from '../../content/crew';
import { MISSION_START } from '../../content/missionStart';
import { Rng } from '../rng/Rng';
import { SYSTEM_IDS } from '../systems/types';
import { createNewGame, type MissionSetup } from './newGame';

const SETUP: MissionSetup = { mode: 'campaign2024', length: 'short', helpMode: false };
const options = { seed: 42, unlockLevel: 1 as const, start: MISSION_START };

describe('partida nueva', () => {
  it('empieza en la preparación del 15/01/2024 con la comandante al mando', () => {
    const state = createNewGame(SETUP, options);
    expect(state.phase).toBe('prep');
    expect(state.simDate).toBe('2024-01-15T00:00:00Z');
    expect(state.activeCrewId).toBe(STARTING_CREW_ID);
    expect(state.crew.map((m) => m.id)).toEqual(CREW_ROSTER.map((p) => p.id));
    expect(state.loadout).toBeNull();
    expect(state.history).toEqual([]);
  });

  it('todos los sistemas arrancan en verde', () => {
    const { systems } = createNewGame(SETUP, options);
    expect(Object.keys(systems).sort()).toEqual([...SYSTEM_IDS].sort());
    expect(Object.values(systems).every((status) => status === 'green')).toBe(true);
  });

  it('guarda la elección del jugador y el nivel de desbloqueo', () => {
    const state = createNewGame({ mode: 'free', length: 'long', helpMode: true }, { ...options, unlockLevel: 3 });
    expect(state).toMatchObject({ mode: 'free', length: 'long', helpMode: true, unlockLevel: 3 });
  });

  it('no deja arrancar con opciones bloqueadas', () => {
    const state = createNewGame({ mode: 'free', length: 'long', helpMode: true }, options);
    expect(state).toMatchObject({ mode: 'campaign2024', length: 'short', helpMode: true });
  });

  it('el generador aleatorio arranca desde la semilla', () => {
    const state = createNewGame(SETUP, options);
    expect(state.seed).toBe(42);
    expect(new Rng(state.rngState).next()).toBe(new Rng(42).next());
  });

  it('es JSON puro y no comparte objetos con los valores de arranque', () => {
    const state = createNewGame(SETUP, options);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    state.crew[0]!.fatigue = 1;
    state.meters.energy.batteryKwh = 0;
    state.inventory.samples.push({ id: 's', siteId: 'x', massKg: 1, value: 1 });
    expect(MISSION_START.crew[0]!.fatigue).toBe(0);
    expect(MISSION_START.meters.energy.batteryKwh).toBe(120);
    expect(MISSION_START.inventory.samples).toEqual([]);
  });
});
