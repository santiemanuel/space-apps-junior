import type { PhaseWindow, TimedPhase } from '../core/clock/schedule';
import { stormsBetween } from '../core/environment/storms';
import type { IncidentDefinition, IncidentId, IncidentRules } from '../core/incidents/definitions';
import {
  coldTimeline,
  conjunctionTimeline,
  dustTimeline,
  marsRadiationTimeline,
  stormTimeline,
  timelineBetween,
  withPeaks,
  type TimelineEntry,
} from '../core/incidents/timeline';
import { MARS_CONJUNCTIONS } from './curated';
import { doseDaysBetween, galeWeatherBetween, SERIES_URLS } from './series';
import { DEEP_SPACE_STORMS, RADIATION_PEAKS } from './storms';

const DAY_MS = 86_400_000;
const daysBefore = (isoDate: string, days: number): string => new Date(Date.parse(isoDate) - days * DAY_MS).toISOString();

export type Place = 'cruise' | 'mars';

/**
 * Eventos reales de un lugar en [from, to) (§3.4, fuente 1): tormentas de BioSentinel en los viajes; en Marte,
 * tormentas de RAD, polvo y frío de REMS y conjunciones solares. Se piden días previos para calcular el fondo
 * de cada serie, y donde hay serie a resolución completa se usa su pico.
 */
export function realTimeline(place: Place, window: PhaseWindow, rules: IncidentRules, lead: (id: IncidentId) => number): TimelineEntry[] {
  if (place === 'cruise')
    return withPeaks(stormTimeline(stormsBetween(DEEP_SPACE_STORMS, window.start, window.end), rules, SERIES_URLS.deepSpace), RADIATION_PEAKS);
  const dose = doseDaysBetween('marsSurface', daysBefore(window.start, rules.marsStorm.baselineDays + 1), window.end);
  const weather = galeWeatherBetween(daysBefore(window.start, rules.coldNight.windowSols * 2), window.end);
  return timelineBetween(
    [
      ...withPeaks(marsRadiationTimeline(dose, rules, lead('radiationStorm'), SERIES_URLS.marsSurface), RADIATION_PEAKS),
      ...dustTimeline(weather, lead('dustStorm'), SERIES_URLS.galeWeather),
      ...coldTimeline(weather, rules, lead('extremeNight'), SERIES_URLS.galeWeather),
      ...conjunctionTimeline(MARS_CONJUNCTIONS, lead('solarConjunction')),
    ],
    window.start,
    window.end,
  );
}

/** Línea de tiempo de una fase con la antelación de cada definición. Sin filtrar por nivel: eso lo hace `phaseTimeline`. */
export const incidentTimeline = (
  phase: TimedPhase,
  window: PhaseWindow,
  definitions: readonly IncidentDefinition[],
  rules: IncidentRules,
): TimelineEntry[] =>
  realTimeline(phase === 'mars' ? 'mars' : 'cruise', window, rules, (id) => definitions.find((d) => d.id === id)!.warningHours);
