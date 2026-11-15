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
    ...['timing', 'fuel', 'board', 'countdown', 'steer'].map((kind) => `maneuvers.game.${kind}.help`),
    ...['perfect', 'good', 'short', 'over', 'overflow'].map((m) => `maneuvers.game.fuel.${m}`),
    ...['right', 'wrong', 'perfect', 'good'].map((m) => `maneuvers.game.board.${m}`),
    ...['early', 'late', 'perfect', 'good', 'ignition', 'number'].map((m) => `maneuvers.game.countdown.${m}`),
    ...['perfect', 'good', 'shaky'].map((m) => `maneuvers.game.steer.${m}`),
    ...['Low', 'Moderate'].map((uv) => `maneuvers.dust.${uv}`),
    ...OUTBOUND_ORDER.flatMap((p) => [`menu.loadout.profile.${p}`, `menu.loadout.profile.${p}.description`]),
    ...CARGO_FIELDS.map((field) => `menu.loadout.return.${field}`),
    ...['rock', 'plant', 'food', 'water', 'shield', 'spare'].map((kind) => `menu.loadout.grid.item.${kind}`),
    ...['outside', 'overlap', 'water'].map((error) => `menu.loadout.grid.error.${error}`),
    ...['base', 'hold', 'pick', 'inHand', 'allLoaded', 'space', 'value', 'auto', 'clear', 'autoDone', 'confirmRed'].map((key) => `menu.loadout.grid.${key}`),
    ...ACHIEVEMENTS.flatMap((a) => [`report.achievement.${a.id}`, `report.achievement.${a.id}.description`]),
    ...['healthyCrew', 'lowDose', 'samplesHome'].map((star) => `report.star.${star}`),
    ...['walk', 'stretcher', 'waiting'].map((arrival) => `report.crew.arrival.${arrival}`),
  ];

  it.each(LOCALES)('existen en %s', (locale) => {
    for (const key of keys) expect(hasKey(key, locale), key).toBe(true);
  });
});
