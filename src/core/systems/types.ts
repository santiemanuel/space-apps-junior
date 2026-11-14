/** Sistemas de la nave y la base. La simulación cambia su estado; las maniobras lo leen (§4.0). */
export const SYSTEM_IDS = [
  'scrubber',
  'waterRecycler',
  'radio',
  'solarPanels',
  'engines',
  'heatShield',
  'parachutes',
  'moxie',
  'greenhouse',
  'airlock',
] as const;

export type SystemId = (typeof SYSTEM_IDS)[number];

/** Semáforo (§3.6): amarillo achica la zona de acierto en las maniobras. */
export type SystemStatus = 'green' | 'yellow' | 'red';
