import { describe, expect, it } from 'vitest';
import { makeGameState, makeIncident } from '../../test-utils/factories';
import { emptyProgression } from '../progression/progression';
import { Rng } from '../rng/Rng';
import {
  clearGame, loadGame, loadProgression, loadSettings, SAVE_KEYS, saveGame, saveProgression, saveSettings,
} from './save';
import { MemorySaveStore } from './SaveStore';

describe('guardado', () => {
  it('sin nada guardado no hay partida, la progresión empieza de cero y no hay ajustes', () => {
    const store = new MemorySaveStore();
    expect(loadGame(store)).toBeNull();
    expect(loadProgression(store)).toEqual(emptyProgression());
    expect(loadSettings(store)).toEqual({});
  });

  it('guardar y cargar devuelve el mismo estado y la misma secuencia del Rng', () => {
    const store = new MemorySaveStore();
    const rng = new Rng(7);
    rng.next();
    rng.next();
    const state = makeGameState({ rngState: rng.state, activeIncidents: [makeIncident()], phase: 'mars' });
    saveGame(store, state);

    const loaded = loadGame(store);
    expect(loaded).toEqual(state);
    const resumed = new Rng(loaded!.rngState);
    expect([resumed.next(), resumed.next()]).toEqual([rng.next(), rng.next()]);
  });

  it('borrar la partida no toca la progresión', () => {
    const store = new MemorySaveStore();
    saveGame(store, makeGameState());
    saveProgression(store, { ...emptyProgression(), completedMissions: 2 });
    clearGame(store);
    expect(loadGame(store)).toBeNull();
    expect(loadProgression(store).completedMissions).toBe(2);
  });

  it('ignora una partida dañada o de otra versión del esquema', () => {
    const store = new MemorySaveStore();
    store.write(SAVE_KEYS.game, '{roto');
    expect(loadGame(store)).toBeNull();
    store.write(SAVE_KEYS.game, JSON.stringify({ ...makeGameState(), version: 99 }));
    expect(loadGame(store)).toBeNull();
    store.write(SAVE_KEYS.game, JSON.stringify({ ...makeGameState(), phase: 'luna' }));
    expect(loadGame(store)).toBeNull();
  });

  it('repara una progresión con datos raros en lugar de fallar', () => {
    const store = new MemorySaveStore();
    store.write(SAVE_KEYS.progression, JSON.stringify({ version: 1, completedMissions: -4, achievements: ['a', 3] }));
    expect(loadProgression(store)).toEqual({ version: 1, completedMissions: 0, achievements: ['a'] });
    store.write(SAVE_KEYS.progression, 'null');
    expect(loadProgression(store)).toEqual(emptyProgression());
  });

  it('recuerda el idioma elegido', () => {
    const store = new MemorySaveStore();
    saveSettings(store, { locale: 'en' });
    expect(loadSettings(store)).toEqual({ locale: 'en' });
  });
});
