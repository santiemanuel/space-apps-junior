import type { PhaseCalendar } from '../core/clock/schedule';

/** Ritmo de la estancia en Gale [regla]: 20 soles (480 h) en 11 minutos reales. */
const MARS_SOL_HOURS_PER_SECOND = (20 * 24) / (11 * 60);

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
  // En Gale se juegan los 20 soles, siempre al mismo ritmo: la estancia dura 10–12 minutos reales (medido en
  // `MarsSession.test.ts`).
  playedDays: {
    short: { cruiseOut: 2, mars: 20, cruiseBack: 2 },
    long: { cruiseOut: 6, mars: 20, cruiseBack: 4 },
  },
  playHoursPerSecond: {
    // Jornada de 24 h ≈ 1 min; sol ≈ 33 s (20 soles ≈ 11 min).
    cruiseOut: 24 / 60,
    mars: MARS_SOL_HOURS_PER_SECOND,
    cruiseBack: 24 / 60,
  },
  // En Marte el reloj no se apura cuando no hay nada que hacer: siempre hay algo para explorar afuera.
  idleHoursPerSecond: { mars: MARS_SOL_HOURS_PER_SECOND },
  // Dormir en Gale apenas adelanta la noche (12 h en ~12 s): aunque se duerman todas las noches, la estancia no baja
  // de unos 9 minutos y medio.
  sleepHoursPerSecond: { mars: 1 },
};
