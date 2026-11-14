import flrDataset from '../../datasets/donki/flr.json';
import sepDataset from '../../datasets/donki/sep.json';
import { buildEnvironment } from '../core/environment/risk';
import type { EnvironmentSnapshot } from '../core/environment/types';
import { addDays, isoDate, parseDate } from './dates';
import { toSolarFlares, toSolarParticleEvents } from './donki/adapters';
import type { ArchivedDataset, ArchivedFlare, ArchivedSep } from './donki/types';

export interface DonkiArchive {
  flares: ArchivedDataset<ArchivedFlare>;
  particleEvents: ArchivedDataset<ArchivedSep>;
}

/** Datos reales de DONKI archivados en datasets/donki/ (ver datasets/README.md). */
export const DONKI_ARCHIVE: DonkiArchive = {
  flares: flrDataset as ArchivedDataset<ArchivedFlare>,
  particleEvents: sepDataset as ArchivedDataset<ArchivedSep>,
};

const inWindow = (time: string, start: string, end: string): boolean => {
  const day = time.slice(0, 10);
  return day >= start && day <= end;
};

/** Entorno a partir de una ventana real de `days` días del archivo, empezando en `start` (YYYY-MM-DD). */
export function environmentFromArchive(archive: DonkiArchive, start: string, days: number): EnvironmentSnapshot {
  const end = isoDate(addDays(parseDate(start), days - 1));
  const flares = archive.flares.events.filter((f) => inWindow(f.peakTime ?? f.beginTime, start, end));
  const seps = archive.particleEvents.events.filter((s) => inWindow(s.eventTime, start, end));
  return buildEnvironment(toSolarFlares(flares), toSolarParticleEvents(seps), 'archive', { start, end });
}

/** Elige un inicio de ventana dentro del rango archivado. `random` devuelve [0, 1). */
export function randomArchiveStart(archive: DonkiArchive, days: number, random: () => number): string {
  const first = parseDate(archive.flares.range.start).getTime();
  const lastStart = parseDate(archive.flares.range.end).getTime() - (days - 1) * 86_400_000;
  const span = Math.max(0, Math.floor((lastStart - first) / 86_400_000));
  return isoDate(addDays(new Date(first), Math.floor(random() * (span + 1))));
}
