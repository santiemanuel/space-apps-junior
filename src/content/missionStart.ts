import type { MissionStart } from '../core/flow/newGame';
import { CAMPAIGN_2024 } from './campaign';
import { CREW_ROSTER, STARTING_CREW_ID } from './crew';
import { METER_RULES, SHIP_POWER } from './meters';

const { cruiseOut, cruiseBack } = CAMPAIGN_2024.windows;
/** Días de la campaña, del despegue al amerizaje (§2.2). */
const MISSION_DAYS = (Date.parse(cruiseBack.end) - Date.parse(cruiseOut.start)) / 86_400_000;
/**
 * La nave no fabrica O2: lleva el de toda la misión con un 10 % de margen [regla] (BVAD: 0,82 kg por tripulante y
 * día). En Marte, MOXIE suma más; las fugas y el racionamiento son lo que lo pone en riesgo (§3.2, §3.5).
 */
const OXYGEN_KG = Math.ceil(METER_RULES.lifeSupport.oxygenKgPerCrewDay * CREW_ROSTER.length * MISSION_DAYS * 1.1);

/**
 * Arranque de una partida nueva [regla]. La nave sale vacía de comida, agua y repuestos: los pone el perfil
 * de carga que se elige en `Loadout` (§4.1). El aire y la batería son los de la nave (`content/meters.ts`).
 */
export const MISSION_START: MissionStart = {
  simDate: {
    // Campaña "Historia real 2024": despegue el 15/01/2024 (§2.2).
    campaign2024: '2024-01-15T00:00:00Z',
    // Modo libre: las ventanas aleatorias quedan preparadas pero bloqueadas (plan §12); arranca igual que la campaña.
    free: '2024-01-15T00:00:00Z',
  },
  meters: {
    energy: { batteryKwh: SHIP_POWER.capacityKwh, capacityKwh: SHIP_POWER.capacityKwh },
    lifeSupport: { oxygenKg: OXYGEN_KG, waterL: 0, co2MmHg: METER_RULES.lifeSupport.co2NominalMmHg },
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
