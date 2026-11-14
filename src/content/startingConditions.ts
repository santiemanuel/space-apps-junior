import type { ResourceState } from '../core/resources/ResourceModel';

export const CREW_SIZE = 4;

/** Reservas iniciales (kg / kWh): unos pocos días de autonomía para forzar decisiones. */
export const INITIAL_RESOURCES: ResourceState = {
  oxygen: 14,
  water: 45,
  food: 30,
  power: 80,
};
