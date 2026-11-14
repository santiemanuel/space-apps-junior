import type { RealEvent } from '../events/RealEvent';

/** Estadística diaria de un sensor de Artemis I (μGy/h). */
export interface SensorDay {
  date: string;
  instrument: string;
  n: number;
  meanUGyH: number;
  maxUGyH: number;
}

/** Cruce de los cinturones de Van Allen medido por Artemis I (§4.1): lo usa la maniobra de ascenso. */
export interface VanAllenCrossing {
  launchDate: string;
  /** Lo que marcó cada sensor el día del lanzamiento (dependen de dónde estaban en la cápsula). */
  sensors: { instrument: string; meanUGyH: number; maxUGyH: number }[];
  /** Mediana de la media diaria del sensor elegido después del cruce (μGy/h). */
  usualUGyH: number;
  realEvent: RealEvent;
}

const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};

/** `instrument` es el sensor de la tarjeta: HERA es el monitor de radiación que usa la tripulación de Orion. */
export function vanAllenCrossing(
  rows: readonly SensorDay[],
  launchDate: string,
  sourceUrl: string,
  instrument = 'HERA-HSU1',
): VanAllenCrossing {
  const launch = rows.filter((r) => r.date === launchDate);
  const chosen = launch.find((r) => r.instrument === instrument);
  if (!chosen) throw new Error(`vanAllenCrossing: no hay datos de ${instrument} el ${launchDate}`);
  const usualUGyH = median(rows.filter((r) => r.instrument === instrument && r.date > launchDate).map((r) => r.meanUGyH));
  return {
    launchDate,
    sensors: launch.map(({ instrument: id, meanUGyH, maxUGyH }) => ({ instrument: id, meanUGyH, maxUGyH })),
    usualUGyH,
    realEvent: {
      id: 'van-allen-artemis-i',
      date: `${launchDate}T00:00:00Z`,
      instrument: instrument.split('-')[0]!,
      mission: 'Artemis I',
      agency: 'NASA',
      value: chosen.maxUGyH,
      unit: 'μGy/h',
      kidValueKey: 'incidents.realEvent.timesNormal',
      kidValueParams: { times: Math.round(chosen.maxUGyH / usualUGyH) },
      explanationKey: 'incidents.vanAllen.explanation',
      sourceUrl,
    },
  };
}
