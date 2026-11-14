import type { CrewId, CrewRole } from '../core/crew/types';

export interface CrewProfile {
  id: CrewId;
  /** Nombre propio: no se traduce. El rol y su descripción están en i18n (`common.role.*`). */
  name: string;
  role: CrewRole;
}

/** Tripulación de 4 (game-design §3.3). El jugador empieza como la comandante. */
export const CREW_ROSTER: readonly CrewProfile[] = [
  { id: 'vega', name: 'Vega', role: 'commander' },
  { id: 'miga', name: 'Miga', role: 'engineer' },
  { id: 'brote', name: 'Brote', role: 'botanist' },
  { id: 'senda', name: 'Senda', role: 'geoMedic' },
];

export const STARTING_CREW_ID: CrewId = 'vega';
