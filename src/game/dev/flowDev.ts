import type { ManeuverId } from '../../core/flow/types';
import { makeRealEvent } from '../../test-utils/factories';
import type { DataCardSceneData, LoadoutSceneData, ManeuverSceneData, ReportSceneData } from '../scenes/sceneData';
import type { DevDataBuilders } from './devLaunch';

/** Datos de prueba para abrir las escenas del flujo con `?scene=`. Dueño: Facundo. */
export const flowDevData: DevDataBuilders = {
  Maneuver: (base, params): ManeuverSceneData => ({ ...base, maneuverId: (params.get('id') ?? 'ascent') as ManeuverId }),
  Loadout: (base, params): LoadoutSceneData => ({ ...base, mode: params.get('mode') === 'return' ? 'return' : 'outbound' }),
  Report: (base, params): ReportSceneData => ({ ...base, outcome: params.get('outcome') === 'suspended' ? 'suspended' : 'completed' }),
  DataCard: (base): DataCardSceneData => ({ event: makeRealEvent(), bus: base.bus }),
};
