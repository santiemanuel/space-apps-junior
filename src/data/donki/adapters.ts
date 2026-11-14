import { flareClassToFlux } from '../../core/environment/risk';
import type { SolarFlare, SolarParticleEvent } from '../../core/environment/types';
import type { ArchivedFlare, ArchivedSep, RawFlare, RawSep } from './types';

/** API o archivo → SolarFlare. Descarta registros sin clase GOES válida. */
export function toSolarFlares(raw: readonly (RawFlare | ArchivedFlare)[]): SolarFlare[] {
  return raw.flatMap((flare) => {
    if (!flare.classType) return [];
    try {
      return [{
        id: 'flrID' in flare ? flare.flrID : flare.id,
        classType: flare.classType,
        peakTime: flare.peakTime ?? flare.beginTime,
        peakFlux: flareClassToFlux(flare.classType),
        link: flare.link,
      }];
    } catch {
      return [];
    }
  });
}

export function toSolarParticleEvents(raw: readonly (RawSep | ArchivedSep)[]): SolarParticleEvent[] {
  return raw.map((sep) =>
    'sepID' in sep
      ? { id: sep.sepID, eventTime: sep.eventTime, instruments: (sep.instruments ?? []).map((i) => i.displayName), link: sep.link }
      : { id: sep.id, eventTime: sep.eventTime, instruments: sep.instruments, link: sep.link },
  );
}
