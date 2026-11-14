import stormsDataset from '../../datasets/storms/biosentinel-storms.json';
import type { SpaceStorm } from '../core/environment/storms';

interface ArchivedStorm {
  id: string;
  warnAt: string;
  impactAt: string;
  endAt: string;
  leadHours: number;
  warning: { kind: 'flare'; classType: string; link: string } | { kind: 'rule48h' };
  impact: { kind: 'sep'; link: string } | { kind: 'radlabDay' };
  peakMeanUGyH: number;
  capped: boolean;
  baselineUGyH: number;
}

const toStorm = (s: ArchivedStorm): SpaceStorm => ({
  id: s.id,
  warnAt: s.warnAt,
  impactAt: s.impactAt,
  endAt: s.endAt,
  leadHours: s.leadHours,
  warning: s.warning.kind === 'flare' ? { kind: 'donkiFlare', classType: s.warning.classType, link: s.warning.link } : { kind: 'rule48h' },
  peakMeanUGyH: s.peakMeanUGyH,
  capped: s.capped,
  baselineUGyH: s.baselineUGyH,
  sourceLinks: [s.warning, s.impact].flatMap((x) => ('link' in x ? [x.link] : [])),
});

/** Tormentas en espacio profundo (BioSentinel + DONKI), generadas por scripts/build-storms.mjs. */
export const DEEP_SPACE_STORMS: readonly SpaceStorm[] = (stormsDataset.storms as ArchivedStorm[]).map(toStorm);
