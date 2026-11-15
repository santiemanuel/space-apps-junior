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
  playedDays: {
    short: { cruiseOut: 4, mars: 10, cruiseBack: 2 },
    long: { cruiseOut: 8, mars: 19, cruiseBack: 4 },
  },
  playHoursPerSecond: {
    // Jornada de 24 h ≈ 2 min; sol ≈ 90 s.
    cruiseOut: 24 / 120,
    mars: 24 / 90,
    cruiseBack: 24 / 120,
  },
};
