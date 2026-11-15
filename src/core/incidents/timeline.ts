import type { DailyDose, DoseSite, MarsWeather } from '../environment/series';
import type { SpaceStorm } from '../environment/storms';
import type { RealEvent } from '../events/RealEvent';
import type { IncidentId, IncidentRules, TimelineKind } from './definitions';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** Moratoria de comandos de la NASA por conjunción solar de Marte (fechas inclusivas, `YYYY-MM-DD`). */
export interface SolarConjunction {
  id: string;
  start: string;
  end: string;
  sourceUrl: string;
}

/**
 * Evento de la línea de tiempo real (§3.4, fuente 1): fijo para una fecha dada. Siempre trae su `RealEvent`
 * para la tarjeta "Esto pasó de verdad" (§3.8).
 */
export interface TimelineEntry {
  id: string;
  definitionId: IncidentId;
  kind: TimelineKind;
  warnAt: string;
  impactAt: string;
  endAt: string;
  realEvent: RealEvent;
}

const iso = (ms: number): string => new Date(ms).toISOString();
const dayMs = (day: string): number => Date.parse(`${day.slice(0, 10)}T00:00:00Z`);
const round = (x: number, digits = 1): number => Math.round(x * 10 ** digits) / 10 ** digits;

function median(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Agrupa días seguidos (`YYYY-MM-DD` ordenados) en tramos. */
function runsOf(days: readonly string[]): string[][] {
  const runs: string[][] = [];
  for (const day of days) {
    const last = runs.at(-1);
    if (last && dayMs(day) - dayMs(last.at(-1)!) === DAY_MS) last.push(day);
    else runs.push([day]);
  }
  return runs;
}

/** Ventana de un tramo de días: impacto al empezar el primero, fin al terminar el último. */
function dayWindow(run: readonly string[], warningHours: number) {
  const impact = dayMs(run[0]!);
  return { warnAt: iso(impact - warningHours * HOUR_MS), impactAt: iso(impact), endAt: iso(dayMs(run.at(-1)!) + DAY_MS) };
}

/** "N veces lo normal" para la tarjeta; sin fondo conocido se muestra sólo el valor. */
function doseValue(value: number, baseline: number | undefined): Pick<RealEvent, 'kidValueKey' | 'kidValueParams'> {
  return baseline && baseline > 0
    ? { kidValueKey: 'incidents.realEvent.timesNormal', kidValueParams: { times: Math.round(value / baseline) } }
    : { kidValueKey: 'incidents.realEvent.doseRate', kidValueParams: { value } };
}

/** Tormentas de radiación en espacio profundo (BioSentinel + DONKI), con la antelación real (§3.1). */
export function stormTimeline(storms: readonly SpaceStorm[], rules: IncidentRules, radlabUrl: string): TimelineEntry[] {
  return storms.map((s) => {
    const value = Math.min(s.peakMeanUGyH, rules.stormCapUGyH);
    return {
      id: s.id,
      definitionId: 'radiationStorm',
      kind: 'deepSpaceStorm',
      warnAt: s.warnAt,
      impactAt: s.impactAt,
      endAt: s.endAt,
      realEvent: {
        id: s.id,
        date: s.impactAt,
        instrument: 'BPD',
        mission: 'BioSentinel',
        agency: 'NASA',
        value,
        unit: 'μGy/h',
        ...doseValue(value, s.baselineUGyH),
        explanationKey: 'incidents.radiationStorm.explanation.deepSpace',
        sourceUrl: s.sourceLinks[0] ?? radlabUrl,
        ...(s.capped ? { capped: true } : {}),
      },
    };
  });
}

/** Tormentas en la superficie de Marte: días de RAD por encima de `factor` × la mediana previa. */
export function marsRadiationTimeline(
  days: readonly DailyDose[],
  rules: IncidentRules,
  warningHours: number,
  sourceUrl: string,
): TimelineEntry[] {
  const { factor, baselineDays } = rules.marsStorm;
  const baselineOf = new Map<string, number>();
  for (let i = baselineDays; i < days.length; i++) {
    const baseline = median(days.slice(i - baselineDays, i).map((d) => d.uGyH));
    if (days[i]!.uGyH > factor * baseline) baselineOf.set(days[i]!.date, baseline);
  }
  const rate = new Map(days.map((d) => [d.date, d.uGyH]));
  return runsOf([...baselineOf.keys()]).map((run) => {
    const peak = run.reduce((best, day) => (rate.get(day)! > rate.get(best)! ? day : best));
    const value = round(rate.get(peak)!, 1);
    const window = dayWindow(run, warningHours);
    return {
      id: `mars-storm-${run[0]}`,
      definitionId: 'radiationStorm',
      kind: 'marsRadiation',
      ...window,
      realEvent: {
        id: `mars-storm-${run[0]}`,
        date: window.impactAt,
        instrument: 'RAD',
        mission: 'Curiosity',
        agency: 'NASA',
        value,
        unit: 'μGy/h',
        ...doseValue(value, baselineOf.get(run[0]!)),
        explanationKey: 'incidents.radiationStorm.explanation.mars',
        sourceUrl,
      },
    };
  });
}

/** Tormentas de polvo: soles seguidos con UV "Low" en REMS (§3.2). */
export function dustTimeline(weather: readonly MarsWeather[], warningHours: number, sourceUrl: string): TimelineEntry[] {
  const solOf = new Map(weather.map((w) => [w.date, w.sol]));
  return runsOf(weather.filter((w) => w.uv === 'Low').map((w) => w.date)).map((run) => {
    const window = dayWindow(run, warningHours);
    const sol = solOf.get(run[0]!)!;
    return {
      id: `dust-${run[0]}`,
      definitionId: 'dustStorm',
      kind: 'marsDust',
      ...window,
      realEvent: {
        id: `dust-${run[0]}`,
        date: window.impactAt,
        instrument: 'REMS',
        mission: 'Curiosity',
        agency: 'NASA',
        value: sol,
        unit: 'sol',
        kidValueKey: 'incidents.realEvent.uvLow',
        kidValueParams: { sol, sols: run.length },
        explanationKey: 'incidents.dustStorm.explanation',
        sourceUrl,
      },
    };
  });
}

/** Noches extremas: mínima real muy por debajo de la de los soles previos, o por debajo del umbral absoluto. */
export function coldTimeline(
  weather: readonly MarsWeather[],
  rules: IncidentRules,
  warningHours: number,
  sourceUrl: string,
): TimelineEntry[] {
  const { dropC, windowSols, belowC } = rules.coldNight;
  const entries: TimelineEntry[] = [];
  for (let i = windowSols; i < weather.length; i++) {
    const w = weather[i]!;
    const usual = median(weather.slice(i - windowSols, i).map((x) => x.minTempC));
    if (w.minTempC > usual - dropC && w.minTempC > belowC) continue;
    const window = dayWindow([w.date], warningHours);
    entries.push({
      id: `cold-${w.date}`,
      definitionId: 'extremeNight',
      kind: 'marsCold',
      ...window,
      realEvent: {
        id: `cold-${w.date}`,
        date: window.impactAt,
        instrument: 'REMS',
        mission: 'Curiosity',
        agency: 'NASA',
        value: w.minTempC,
        unit: '°C',
        kidValueKey: 'incidents.realEvent.coldNight',
        kidValueParams: { temp: w.minTempC, usual: Math.round(usual) },
        explanationKey: 'incidents.extremeNight.explanation',
        sourceUrl,
      },
    });
  }
  return entries;
}

/** Conjunciones solares: la moratoria real de comandos de la NASA (§3.7). */
export function conjunctionTimeline(conjunctions: readonly SolarConjunction[], warningHours: number): TimelineEntry[] {
  return conjunctions.map((c) => {
    const window = dayWindow([c.start, c.end], warningHours);
    const days = Math.round((dayMs(c.end) - dayMs(c.start)) / DAY_MS) + 1;
    return {
      id: c.id,
      definitionId: 'solarConjunction',
      kind: 'solarConjunction',
      ...window,
      realEvent: {
        id: c.id,
        date: window.impactAt,
        instrument: 'DSN',
        mission: 'Mars Relay Network',
        agency: 'NASA/JPL',
        value: days,
        unit: 'd',
        kidValueKey: 'incidents.realEvent.conjunctionDays',
        kidValueParams: { days },
        explanationKey: 'incidents.solarConjunction.explanation',
        sourceUrl: c.sourceUrl,
      },
    };
  });
}

/** Eventos que se solapan con [from, to), en orden de aviso. */
export const timelineBetween = (entries: readonly TimelineEntry[], from: string, to: string): TimelineEntry[] =>
  entries
    .filter((e) => Date.parse(e.warnAt) < Date.parse(to) && Date.parse(e.endAt) > Date.parse(from))
    .sort((a, b) => Date.parse(a.warnAt) - Date.parse(b.warnAt));

/** Pico de una tormenta a resolución completa (serie de evento de RadLab). */
export interface RadiationPeak {
  id: string;
  site: DoseSite;
  onsetAt: string;
  peakAt: string;
  peakUGyH: number;
  baselineUGyH: number;
}

const PEAK_KIND: Partial<Record<DoseSite, TimelineKind>> = { deepSpace: 'deepSpaceStorm', marsSurface: 'marsRadiation' };

/**
 * Donde hay serie a resolución completa, la tarjeta muestra el pico real y no la media diaria (el tope de
 * §3.2.1 es para las medias diarias). En Marte el impacto pasa al inicio real de la subida, con la misma antelación.
 */
export function withPeaks(entries: readonly TimelineEntry[], peaks: readonly RadiationPeak[]): TimelineEntry[] {
  return entries.map((entry) => {
    const peak = peaks.find(
      (p) =>
        PEAK_KIND[p.site] === entry.kind &&
        Date.parse(p.peakAt) >= dayMs(entry.impactAt) &&
        Date.parse(p.peakAt) < Date.parse(entry.endAt),
    );
    if (!peak) return entry;
    const { capped: _capped, ...realEvent } = entry.realEvent;
    const moved =
      entry.kind === 'marsRadiation'
        ? {
            warnAt: iso(Date.parse(peak.onsetAt) - (Date.parse(entry.impactAt) - Date.parse(entry.warnAt))),
            impactAt: peak.onsetAt,
          }
        : {};
    return {
      ...entry,
      ...moved,
      realEvent: {
        ...realEvent,
        date: peak.peakAt,
        value: peak.peakUGyH,
        kidValueKey: 'incidents.realEvent.timesNormal',
        kidValueParams: { times: Math.round(peak.peakUGyH / peak.baselineUGyH) },
      },
    };
  });
}
