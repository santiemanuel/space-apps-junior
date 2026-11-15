import type { PhaseCalendar } from '../core/clock/schedule';

/**
 * Campaña "Historia real 2024" (game-design §2.2). RAD de Curiosity llega hasta el 03/06/2024, por eso la
 * estancia dura 19 soles. Simplificación: un sol se aproxima a un día del calendario para consultar los datos.
 */
export const CAMPAIGN_2024: PhaseCalendar = {
  windows: {
    cruiseOut: { start: '2024-01-15T00:00:00Z', end: '2024-05-15T00:00:00Z' },
    mars: { start: '2024-05-15T00:00:00Z', end: '2024-06-04T00:00:00Z' },
    cruiseBack: { start: '2024-06-04T00:00:00Z', end: '2024-10-10T00:00:00Z' },
  },
  // Partida corta de ~15 min (medida: ~10 de viaje y Marte más ~5 de maniobras y cargas) y larga de ~30 [regla]:
  // pocas jornadas jugadas y cortas; si no hay nada que hacer, la
  // jornada corre en avance rápido (`CLOCK_RULES.idleHoursPerSecond`) y la partida dura todavía menos.
  playedDays: {
    short: { cruiseOut: 2, mars: 5, cruiseBack: 2 },
    long: { cruiseOut: 6, mars: 12, cruiseBack: 4 },
  },
  playHoursPerSecond: {
    // Jornada de 24 h ≈ 1 min; sol ≈ 50 s.
    cruiseOut: 24 / 60,
    mars: 24 / 50,
    cruiseBack: 24 / 60,
  },
};
