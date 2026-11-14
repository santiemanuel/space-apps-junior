import { buildEnvironment } from '../core/environment/risk';
import type { EnvironmentSnapshot } from '../core/environment/types';
import { DONKI_ARCHIVE, environmentFromArchive, randomArchiveStart, type DonkiArchive } from './archive';
import { addDays, isoDate } from './dates';
import { toSolarFlares, toSolarParticleEvents } from './donki/adapters';
import type { DonkiClient } from './donki/DonkiClient';

export type DataMode = 'live' | 'archive';

export interface LoadEnvironmentOptions {
  mode: DataMode;
  /** Generador [0, 1) para elegir la ventana del archivo (inyectar el Rng con semilla). */
  random: () => number;
  client?: DonkiClient;
  archive?: DonkiArchive;
  now?: Date;
  windowDays?: number;
  onError?: (error: unknown) => void;
}

/**
 * Clima espacial de la partida. En modo "live" pide los últimos `windowDays` días a DONKI;
 * si falla (o en modo "archive") usa una ventana real del archivo, marcada siempre como "archive".
 */
export async function loadEnvironment({
  mode,
  random,
  client,
  archive = DONKI_ARCHIVE,
  now = new Date(),
  windowDays = 30,
  onError,
}: LoadEnvironmentOptions): Promise<EnvironmentSnapshot> {
  if (mode === 'live' && client) {
    const window = { start: isoDate(addDays(now, -windowDays)), end: isoDate(now) };
    try {
      const [flares, seps] = await Promise.all([
        client.getFlares(window.start, window.end),
        client.getSolarParticleEvents(window.start, window.end),
      ]);
      return buildEnvironment(toSolarFlares(flares), toSolarParticleEvents(seps), 'live', window);
    } catch (error) {
      onError?.(error);
    }
  }
  return environmentFromArchive(archive, randomArchiveStart(archive, windowDays, random), windowDays);
}
