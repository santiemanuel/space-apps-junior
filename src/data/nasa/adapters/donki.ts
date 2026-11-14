import { flareClassToFlux } from '../../../core/environment/risk';
import type { SolarFlare } from '../../../core/environment/types';
import type { RawDonkiFlare } from '../types';

/** DONKI FLR → SolarFlare. Descarta registros sin clase GOES válida. */
export function toSolarFlares(raw: readonly RawDonkiFlare[]): SolarFlare[] {
  return raw.flatMap((flare) => {
    if (!flare.classType) return [];
    try {
      return [{
        id: flare.flrID,
        classType: flare.classType,
        peakTime: flare.peakTime ?? flare.beginTime,
        peakFlux: flareClassToFlux(flare.classType),
      }];
    } catch {
      return [];
    }
  });
}
