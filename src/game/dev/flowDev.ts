import type { ManeuverId, UnlockLevel } from '../../core/flow/types';
import { emptyProgression } from '../../core/progression/progression';
import { realEventLogEntry } from '../../core/report/report';
import { saveGame, saveProgression } from '../../core/save/save';
import { MemorySaveStore } from '../../core/save/SaveStore';
import type { GameState } from '../../core/state/types';
import { SYSTEM_IDS, type SystemId } from '../../core/systems/types';
import { makeRealEvent, makeSample } from '../../test-utils/factories';
import type { DataCardData } from '../scenes/flow/DataCardScene';
import type { PauseSceneData } from '../scenes/flow/PauseScene';
import type { ReportData } from '../scenes/flow/ReportScene';
import type { TitleSceneData } from '../scenes/flow/TitleScene';
import type { LoadoutSceneData, ManeuverSceneData, PhaseSceneData } from '../scenes/sceneData';
import type { DevDataBuilders } from './devLaunch';

const levelOf = (params: URLSearchParams): UnlockLevel => Math.min(4, Math.max(1, Number(params.get('level') ?? 1))) as UnlockLevel;

/** `&yellow=heatShield,radio&red=engines` pone esos sistemas en amarillo o rojo. */
function withSystems(state: GameState, params: URLSearchParams): GameState {
  const systems = { ...state.systems };
  for (const status of ['yellow', 'red'] as const) {
    for (const id of params.get(status)?.split(',') ?? []) if (SYSTEM_IDS.includes(id as SystemId)) systems[id as SystemId] = status;
  }
  return { ...state, systems };
}

/** Muestras de prueba para la carga de vuelta: más lejos, más valor y más masa. */
const SAMPLES = Array.from({ length: 8 }, (_, i) => makeSample({ id: `dev-${i}`, siteId: `gale-${i}`, massKg: 6 + (i % 4) * 4, value: 1 + (i % 5) }));

/** Final de misión de prueba para el informe: carga, maniobras, una tarjeta vivida y dosis variadas. */
function reportState(base: GameState): GameState {
  const history: GameState['history'] = [
    { simDate: '2024-01-15T00:00:00Z', phase: 'prep', kind: 'loadout', key: 'outbound.balanced', data: { profile: 'balanced' } },
    { simDate: '2024-01-15T00:00:00Z', phase: 'ascent', kind: 'maneuver', key: 'ascent', data: { precision: 0.92 } },
    realEventLogEntry(makeRealEvent({ date: '2024-05-20T00:00:00Z' }), { simDate: '2024-05-20T00:00:00Z', phase: 'mars' }),
    { simDate: '2024-05-15T00:00:00Z', phase: 'landing', kind: 'decision', key: 'maneuver.risk', data: { system: 'parachutes' } },
    { simDate: '2024-05-15T00:00:00Z', phase: 'landing', kind: 'maneuver', key: 'landing', data: { precision: 0.64 } },
    { simDate: '2024-05-25T00:00:00Z', phase: 'mars', kind: 'incident', key: 'incidents.dustStorm.title', data: { incidentId: 'dust-2024-05-25', status: 'active' } },
    { simDate: '2024-06-04T00:00:00Z', phase: 'marsAscent', kind: 'loadout', key: 'return', data: { samples: 3, massKg: 1612 } },
    { simDate: '2024-10-10T00:00:00Z', phase: 'reentry', kind: 'maneuver', key: 'reentry', data: { precision: 0.4 } },
  ];
  return {
    ...base,
    phase: 'reentry',
    simDate: '2024-10-10T00:00:00Z',
    landingDistanceKm: 12,
    crew: base.crew.map((m, i) => ({ ...m, doseMSv: 380 + i * 45, condition: i === 2 ? 0.45 : 0.85 })),
    inventory: { ...base.inventory, samples: SAMPLES.slice(0, 3) },
    achievements: ['shelterInTime'],
    history,
  };
}

/**
 * Datos de prueba para abrir las escenas del flujo con `?scene=`. Dueño: Facundo.
 * - `?scene=Title&level=3&save=1` · `?scene=Loadout&mode=return` · `?scene=Loadout&level=4`
 * - `?scene=Maneuver&id=landing&yellow=heatShield&red=parachutes` · `?scene=DataCard&capped=1`
 * - `?scene=Report&outcome=suspended` · `?scene=Pause`
 */
export const flowDevData: DevDataBuilders = {
  Title: (base, params): TitleSceneData => {
    const store = new MemorySaveStore();
    saveProgression(store, { ...emptyProgression(), completedMissions: levelOf(params) - 1 });
    if (params.get('save') === '1') saveGame(store, base.state);
    return {
      store,
      onNewGame: (state) => console.info('[dev] nueva misión', state),
      onContinue: (state) => console.info('[dev] continuar misión', state),
    };
  },
  Maneuver: (base, params): ManeuverSceneData => {
    const maneuverId = (params.get('id') ?? 'ascent') as ManeuverId;
    return { ...base, state: withSystems({ ...base.state, phase: maneuverId }, params), maneuverId };
  },
  Loadout: (base, params): LoadoutSceneData => {
    const mode = params.get('mode') === 'return' ? 'return' : 'outbound';
    const state: GameState =
      mode === 'return'
        ? { ...base.state, phase: 'marsAscent', inventory: { ...base.state.inventory, foodKg: 1000, spares: 4, samples: SAMPLES } }
        : { ...base.state, phase: 'prep', loadout: null, unlockLevel: levelOf(params) };
    return { ...base, state, mode };
  },
  Report: (base, params): ReportData => ({
    ...base,
    state: reportState(base.state),
    outcome: params.get('outcome') === 'suspended' ? 'suspended' : 'completed',
    onExit: () => console.info('[dev] volver al menú'),
  }),
  DataCard: (base, params): DataCardData => ({
    event: makeRealEvent({ capped: params.get('capped') === '1' }),
    bus: base.bus,
    onClose: () => console.info('[dev] tarjeta cerrada'),
  }),
  Pause: (base: PhaseSceneData): PauseSceneData => {
    // Sin director: el guardado de prueba responde enseguida.
    base.bus.on('save:requested', () => base.bus.emit('save:completed', { savedAt: new Date().toISOString() }));
    return { ...base, onResume: () => console.info('[dev] continuar'), onExit: () => console.info('[dev] salir al menú') };
  },
};
