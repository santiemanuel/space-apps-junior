import deepSpace from '../../datasets/series/deep-space-dose.json';
import galeWeather from '../../datasets/series/gale-weather.json';
import marsCruise from '../../datasets/series/mars-cruise-dose.json';
import marsSurface from '../../datasets/series/mars-surface-dose.json';
import type { DailyDose, DoseSite, MarsWeather, UvIndex } from '../core/environment/series';

type Row = readonly (string | number | null)[];

/** Índice de la última fila con fecha ≤ `day` (o la primera si `day` es anterior a la serie). */
function nearestIndex(rows: readonly Row[], day: string): number {
  let lo = 0;
  let hi = rows.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((rows[mid]![0] as string) <= day) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

const DOSE_ROWS: Record<DoseSite, readonly Row[]> = {
  deepSpace: deepSpace.rows,
  marsCruise: marsCruise.rows,
  marsSurface: marsSurface.rows,
};

/** Tasa de dosis real del día (o del último día con dato) para un lugar. Fechas ISO. */
export function doseRateOn(site: DoseSite, date: string): DailyDose {
  const rows = DOSE_ROWS[site];
  const row = rows[nearestIndex(rows, date.slice(0, 10))]!;
  return { date: row[0] as string, uGyH: row[1] as number, capped: row[2] === 1 };
}

/** Clima real de Gale del día (o del último sol con dato). */
export function galeWeatherOn(date: string): MarsWeather {
  const rows = galeWeather.rows as readonly Row[];
  const [day, sol, minTempC, maxTempC, uv, rawMinTempC] = rows[nearestIndex(rows, date.slice(0, 10))]!;
  return {
    date: day as string,
    sol: sol as number,
    minTempC: minTempC as number,
    maxTempC: maxTempC as number | null,
    uv: uv as UvIndex | null,
    adjusted: rawMinTempC !== null,
  };
}

/** Rango cubierto por cada serie (para elegir ventanas del modo libre). */
export const SERIES_RANGES = {
  deepSpace: { start: deepSpace.rows[0]![0] as string, end: deepSpace.rows.at(-1)![0] as string },
  marsCruise: { start: marsCruise.rows[0]![0] as string, end: marsCruise.rows.at(-1)![0] as string },
  marsSurface: { start: marsSurface.rows[0]![0] as string, end: marsSurface.rows.at(-1)![0] as string },
  galeWeather: { start: galeWeather.rows[0]![0] as string, end: galeWeather.rows.at(-1)![0] as string },
} as const;

export const SERIES_SOURCES = {
  deepSpace: deepSpace.source,
  marsCruise: marsCruise.source,
  marsSurface: marsSurface.source,
  galeWeather: galeWeather.source,
} as const;

const inRange = (rows: readonly Row[], from: string, to: string): readonly Row[] =>
  rows.filter((r) => (r[0] as string) >= from.slice(0, 10) && (r[0] as string) < to.slice(0, 10));

/** Días con dato real en [from, to) para un lugar (sin rellenar huecos). */
export const doseDaysBetween = (site: DoseSite, from: string, to: string): DailyDose[] =>
  inRange(DOSE_ROWS[site], from, to).map((row) => ({ date: row[0] as string, uGyH: row[1] as number, capped: row[2] === 1 }));

/** Soles con dato real de REMS en [from, to). */
export const galeWeatherBetween = (from: string, to: string): MarsWeather[] =>
  inRange(galeWeather.rows as readonly Row[], from, to).map((row) => galeWeatherOn(row[0] as string));

export const SERIES_URLS = {
  deepSpace: deepSpace.url,
  marsCruise: marsCruise.url,
  marsSurface: marsSurface.url,
  galeWeather: galeWeather.url,
} as const;
