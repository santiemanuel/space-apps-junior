import artemis from '../../datasets/series/van-allen-artemis.json';
import { vanAllenCrossing, type SensorDay } from '../core/environment/vanAllen';

const rows: SensorDay[] = (artemis.rows as [string, string, number, number, number][]).map(([date, instrument, n, meanUGyH, maxUGyH]) => ({
  date,
  instrument,
  n,
  meanUGyH,
  maxUGyH,
}));

/** Cruce de Van Allen de Artemis I (16/11/2022) para la maniobra de ascenso. */
export const VAN_ALLEN = vanAllenCrossing(rows, artemis.launchDate, artemis.url);
export const VAN_ALLEN_DAYS: readonly SensorDay[] = rows;
