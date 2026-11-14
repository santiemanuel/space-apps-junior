import { buildEnvironment } from '../../core/environment/risk';
import type { EnvironmentSnapshot } from '../../core/environment/types';
import { toSolarFlares } from './adapters/donki';
import { toNearEarthObjects } from './adapters/neows';
import donkiFixture from './fixtures/donki-flr.json';
import neowsFixture from './fixtures/neows-feed.json';
import type { NasaClient } from './NasaClient';
import type { RawDonkiFlare, RawNeoWsFeed } from './types';

export type NasaDataMode = 'live' | 'fixtures';

export interface LoadEnvironmentOptions {
  mode: NasaDataMode;
  client?: NasaClient;
  now?: Date;
  /** Días hacia atrás para el histórico de llamaradas. */
  flareWindowDays?: number;
  onError?: (error: unknown) => void;
}

const isoDate = (date: Date): string => date.toISOString().slice(0, 10);
const daysFrom = (date: Date, days: number): Date => new Date(date.getTime() + days * 86_400_000);

export function environmentFromFixtures(): EnvironmentSnapshot {
  return buildEnvironment(
    toSolarFlares(donkiFixture as RawDonkiFlare[]),
    toNearEarthObjects(neowsFixture as RawNeoWsFeed),
    'fixture',
  );
}

/**
 * Carga el entorno espacial. En modo "live" consulta DONKI y NeoWs; si cualquiera falla
 * usa los fixtures correspondientes, de modo que el juego siempre arranca.
 */
export async function loadEnvironment({
  mode,
  client,
  now = new Date(),
  flareWindowDays = 30,
  onError,
}: LoadEnvironmentOptions): Promise<EnvironmentSnapshot> {
  if (mode === 'fixtures' || !client) return environmentFromFixtures();

  const [flares, neos] = await Promise.allSettled([
    client.getSolarFlares(isoDate(daysFrom(now, -flareWindowDays)), isoDate(now)),
    client.getNeoFeed(isoDate(now), isoDate(daysFrom(now, 6))),
  ]);
  for (const result of [flares, neos]) if (result.status === 'rejected') onError?.(result.reason);

  const allLive = flares.status === 'fulfilled' && neos.status === 'fulfilled';
  return buildEnvironment(
    toSolarFlares(flares.status === 'fulfilled' ? flares.value : (donkiFixture as RawDonkiFlare[])),
    toNearEarthObjects(neos.status === 'fulfilled' ? neos.value : (neowsFixture as RawNeoWsFeed)),
    allLive ? 'live' : 'fixture',
  );
}
