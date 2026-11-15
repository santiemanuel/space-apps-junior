import type { MissionStart } from '../core/flow/newGame';
import { CREW_ROSTER, STARTING_CREW_ID } from './crew';

/**
 * Arranque de una partida nueva [regla]. La nave sale vacía de comida, agua y repuestos: los pone el perfil
 * de carga que se elige en `Loadout` (§4.1). Los medidores definitivos los ajusta la simulación (S2).
 */
export const MISSION_START: MissionStart = {
  simDate: {
    // Campaña "Historia real 2024": despegue el 15/01/2024 (§2.2).
    campaign2024: '2024-01-15T00:00:00Z',
    // Modo libre: las ventanas aleatorias quedan preparadas pero bloqueadas (plan §12); arranca igual que la campaña.
    free: '2024-01-15T00:00:00Z',
  },
  meters: {
    energy: { batteryKwh: 120, capacityKwh: 120 },
    lifeSupport: { oxygenKg: 40, waterL: 0, co2MmHg: 2 },
  },
  crew: CREW_ROSTER.map(({ id, role }) => ({
    id,
    role,
    fatigue: 0,
    condition: 1,
    morale: 1,
    nutrition: 1,
    doseMSv: 0,
    location: 'command',
    taskId: null,
    resting: false,
  })),
  activeCrewId: STARTING_CREW_ID,
  inventory: { foodKg: 0, spares: 0, samples: [] },
  waterShield: 0,
  fuel: 1,
};
