import type { PowerSystem, ResourceState } from '../core/resources/ResourceModel';
import { DOSE_RATES, type SurfaceSite } from '../data/curated';

export const CREW_SIZE = 4;

/** Lugar de la base: determina la dosis de radiación de fondo (medida real, ver datasets/curated). */
export const MISSION_SITE: SurfaceSite = 'moonSurface';
export const SITE_DOSE = DOSE_RATES[MISSION_SITE];

/** Reservas iniciales (kg / kWh): unos pocos días de autonomía para forzar decisiones. */
export const INITIAL_RESOURCES: ResourceState = {
  oxygen: 14,
  water: 45,
  food: 30,
  power: 80,
};

/** Sistema eléctrico de la base (valores de diseño del juego, no medidos). */
export const OUTPOST_POWER: PowerSystem = {
  batteryCapacityKwh: 120,
  solarGenerationKw: 12,
  baseLoadKw: 9,
};
