import type { TimedPhase } from '../core/clock/schedule';
import type { DailyDose, DoseSite, MarsWeather } from '../core/environment/series';
import type { RealEvent } from '../core/events/RealEvent';
import type { IncidentRules } from '../core/incidents/definitions';
import { realTimeline } from './incidentTimeline';
import { doseRateOn, galeWeatherOn, SERIES_RANGES } from './series';
import { VAN_ALLEN } from './vanAllen';

/** Datos reales del día para una fase: la serie de dosis del lugar y, en Marte, el clima de Gale. */
export interface PhaseSeries {
  site: DoseSite;
  dose: DailyDose;
  weather: MarsWeather | null;
}

const covers = (range: { start: string; end: string }, day: string) => day >= range.start && day <= range.end;

/** En los viajes manda BioSentinel; fuera de su rango (modo libre de 2016) se usa TGO en crucero. */
export function cruiseSiteFor(date: string): DoseSite {
  const day = date.slice(0, 10);
  return !covers(SERIES_RANGES.deepSpace, day) && covers(SERIES_RANGES.marsCruise, day) ? 'marsCruise' : 'deepSpace';
}

export function seriesFor(phase: TimedPhase, date: string): PhaseSeries {
  const site: DoseSite = phase === 'mars' ? 'marsSurface' : cruiseSiteFor(date);
  return { site, dose: doseRateOn(site, date), weather: phase === 'mars' ? galeWeatherOn(date) : null };
}

/**
 * Todos los eventos reales con fecha en [from, to): tormentas en espacio profundo y en Marte, polvo, noches
 * extremas, conjunciones y el cruce de Van Allen de Artemis I. Para el panel de datos y el informe (§3.8, §5).
 */
export function eventsBetween(from: string, to: string, rules: IncidentRules): RealEvent[] {
  const window = { start: from, end: to };
  const inRange = (e: RealEvent) => Date.parse(e.date) >= Date.parse(from) && Date.parse(e.date) < Date.parse(to);
  return [...realTimeline('cruise', window, rules, () => 0), ...realTimeline('mars', window, rules, () => 0)]
    .map((e) => e.realEvent)
    .concat(VAN_ALLEN.realEvent)
    .filter(inRange)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}
