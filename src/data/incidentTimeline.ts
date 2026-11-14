import type { PhaseWindow, TimedPhase } from '../core/clock/schedule';
import type { IncidentDefinition, IncidentId, IncidentRules } from '../core/incidents/definitions';
import {
  coldTimeline,
  conjunctionTimeline,
  dustTimeline,
  marsRadiationTimeline,
  stormTimeline,
  timelineBetween,
  type TimelineEntry,
} from '../core/incidents/timeline';
import { stormsBetween } from '../core/environment/storms';
import { MARS_CONJUNCTIONS } from './curated';
import { doseDaysBetween, galeWeatherBetween, SERIES_URLS } from './series';
import { DEEP_SPACE_STORMS } from './storms';

const DAY_MS = 86_400_000;
const daysBefore = (isoDate: string, days: number): string => new Date(Date.parse(isoDate) - days * DAY_MS).toISOString();

/**
 * Línea de tiempo real de una fase (§3.4, fuente 1): tormentas de BioSentinel en los viajes; en Marte,
 * tormentas de RAD, polvo y frío de REMS y conjunciones solares. Se piden días previos a la ventana para
 * calcular el fondo de cada serie. Sin filtrar por nivel: eso lo hace `phaseTimeline`.
 */
export function incidentTimeline(
  phase: TimedPhase,
  window: PhaseWindow,
  definitions: readonly IncidentDefinition[],
  rules: IncidentRules,
): TimelineEntry[] {
  const lead = (id: IncidentId) => definitions.find((d) => d.id === id)!.warningHours;
  if (phase !== 'mars') return stormTimeline(stormsBetween(DEEP_SPACE_STORMS, window.start, window.end), rules, SERIES_URLS.deepSpace);
  const dose = doseDaysBetween('marsSurface', daysBefore(window.start, rules.marsStorm.baselineDays + 1), window.end);
  const weather = galeWeatherBetween(daysBefore(window.start, rules.coldNight.windowSols * 2), window.end);
  return timelineBetween(
    [
      ...marsRadiationTimeline(dose, rules, lead('radiationStorm'), SERIES_URLS.marsSurface),
      ...dustTimeline(weather, lead('dustStorm'), SERIES_URLS.galeWeather),
      ...coldTimeline(weather, rules, lead('extremeNight'), SERIES_URLS.galeWeather),
      ...conjunctionTimeline(MARS_CONJUNCTIONS, lead('solarConjunction')),
    ],
    window.start,
    window.end,
  );
}
