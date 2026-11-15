import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../content/achievements';
import { MANEUVERS } from '../content/maneuvers';
import { OUTBOUND_ORDER } from '../content/loadouts';
import { GAME_MODES, MISSION_LENGTHS, TitleMenu } from '../core/flow/titleMenu';
import { CARGO_FIELDS } from '../core/loadout/loadout';
import { PRECISION_LEVELS } from '../core/maneuvers/ManeuverRun';
import { SYSTEM_IDS } from '../core/systems/types';
import { hasKey, LOCALES } from './index';

describe('claves de texto del flujo', () => {
  const rows = new TitleMenu({ hasSave: true, unlockLevel: 1, locales: LOCALES, locale: 'es' }).rows;
  const keys = [
    ...rows.filter((row) => row !== 'mode').map((row) => `menu.title.${row}.description`),
    ...GAME_MODES.flatMap((mode) => [`menu.title.mode.${mode}`, `menu.title.mode.${mode}.description`]),
    ...MISSION_LENGTHS.map((length) => `menu.title.length.${length}`),
    ...LOCALES.map((locale) => `common.language.${locale}`),
    ...SYSTEM_IDS.map((id) => `common.system.${id}`),
    ...['green', 'yellow', 'red'].map((light) => `common.light.${light}`),
    ...Object.values(MANEUVERS).flatMap((m) => [
      `maneuvers.name.${m.id}`,
      `maneuvers.intro.${m.id}`,
      ...m.stages.flatMap((s) => [`maneuvers.stage.${m.id}.${s.id}`, `maneuvers.stage.${m.id}.${s.id}.fact`]),
    ]),
    ...PRECISION_LEVELS.map((level) => `maneuvers.result.precision.${level}`),
    ...['Low', 'Moderate'].map((uv) => `maneuvers.dust.${uv}`),
    ...OUTBOUND_ORDER.flatMap((p) => [`menu.loadout.profile.${p}`, `menu.loadout.profile.${p}.description`]),
    ...CARGO_FIELDS.map((field) => `menu.loadout.return.${field}`),
    ...ACHIEVEMENTS.flatMap((a) => [`report.achievement.${a.id}`, `report.achievement.${a.id}.description`]),
    ...['healthyCrew', 'lowDose', 'samplesHome'].map((star) => `report.star.${star}`),
    ...['walk', 'stretcher', 'waiting'].map((arrival) => `report.crew.arrival.${arrival}`),
  ];

  it.each(LOCALES)('existen en %s', (locale) => {
    for (const key of keys) expect(hasKey(key, locale), key).toBe(true);
  });
});
