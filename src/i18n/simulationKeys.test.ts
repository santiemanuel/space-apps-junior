import { describe, expect, it } from 'vitest';
import { CAMPAIGN_2024 } from '../content/campaign';
import { INCIDENT_RULES, INCIDENTS } from '../content/incidents';
import { CLOCK_RULES } from '../core/clock/MissionClock';
import { stormAlert } from '../core/clock/schedule';
import { GALE_LAYOUT, GALE_TASKS, GALE_TERRAIN, MARS_CONTENT, SULFUR_EVENT } from '../content/gale';
import { ROCK_TYPES } from '../content/galeTerrain';
import { SHIP_LAYOUT, VOYAGE_CONTENT, VOYAGE_TASKS } from '../content/ship';
import { SACRIFICES } from '../core/cascade/sacrifices';
import { CORRIDOR, EXTERIOR } from '../core/habitat/layout';
import { incidentTimeline } from '../data/incidentTimeline';
import { hasKey, LOCALES } from './index';

const LEVELS = ['alert', 'impact'] as const;
const METERS = ['energy', 'lifeSupport', 'food', 'health'] as const;

describe('claves de texto de la simulación', () => {
  const keys = [
    CLOCK_RULES.calmReasonKey,
    ...LEVELS.map((l) => `${stormAlert({ id: 'x' } as never).reasonKey}.${l}`),
    ...METERS.map((m) => `incidents.cascade.${m}.entered`),
    ...['fatigue', 'condition', 'co2', 'morale', 'resting'].map((r) => `hud.crewSlow.${r}`),
    'incidents.cascade.margin',
    'incidents.cascade.marginSols',
    'incidents.cascade.overdue',
    'incidents.cascade.noReturn.allResting',
    'incidents.cascade.noReturn.twoMeters',
    ...INCIDENTS.flatMap((d) => [
      ...['title', 'alert', 'impact', 'explanation'].map((k) => `${d.textKey}.${k}`),
      ...d.responses.flatMap((r) => [`${d.textKey}.response.${r.id}.title`, `${d.textKey}.response.${r.id}.cost`]),
    ]),
    ...(['cruiseOut', 'mars', 'cruiseBack'] as const)
      .flatMap((phase) => incidentTimeline(phase, CAMPAIGN_2024.windows[phase], INCIDENTS, INCIDENT_RULES))
      .flatMap((e) => [e.realEvent.kidValueKey, e.realEvent.explanationKey]),
    'incidents.realEvent.doseRate',
    'incidents.realEvent.conjunctionDays',
    'incidents.solarConjunction.explanation',
    'incidents.vanAllen.explanation',
    ...['flare', 'sep', 'cmeMars', 'cmeMarsGlancing'].map((k) => `hud.missionControl.notice.${k}`),
    ...SACRIFICES.flatMap((s) => [`incidents.sacrifice.${s.id}.title`, `incidents.sacrifice.${s.id}.cost`]),
    ...[CORRIDOR, EXTERIOR].map((z) => `hud.zone.${z}`),
    ...(
      [
        ['voyage', SHIP_LAYOUT, VOYAGE_TASKS],
        ['mars', GALE_LAYOUT, GALE_TASKS],
      ] as const
    ).flatMap(([ns, layout, tasks]) => [
      ...layout.zones.map((z) => `${ns}.zone.${z.id}`),
      ...tasks.flatMap((task) => [`${ns}.task.${task.id}`, `${ns}.station.${task.id}`]),
      ...tasks.flatMap((task) => (task.system ? [`hud.system.${task.system}`] : [])),
    ]),
    ...['Very_High', 'High', 'Moderate', 'Low', 'none'].map((uv) => `mars.uv.${uv}`),
    ...['completed', 'suspended'].map((o) => `mars.outcome.${o}`),
    'mars.log.sample',
    ...GALE_TERRAIN.flatMap((strip) => [`mars.terrain.${strip.id}.name`, `mars.terrain.${strip.id}.fact`]),
    ...ROCK_TYPES.flatMap((rock) => [`mars.rock.${rock}.name`, `mars.rock.${rock}.fact`]),
    'mars.rock.collected',
    ...['title', 'subtitle', 'rim', 'sharp', 'landing', 'curiosity', 'scale', 'credit', 'inset', 'compressed', 'close', 'hint'].map((k) => `mars.crater.${k}`),
    SULFUR_EVENT.kidValueKey,
    SULFUR_EVENT.explanationKey,
    ...['cruise', 'mars'].map((place) => `hud.source.${place}`),
    ...[...new Set([...Object.keys(VOYAGE_CONTENT.power.loadsKw), ...Object.keys(MARS_CONTENT.power.loadsKw)])].map((id) => `hud.load.${id}`),
    ...['deepSpace', 'marsCruise', 'marsSurface'].map((site) => `hud.dataPanel.site.${site}`),
    ...['flare', 'sep', 'cmeMars'].map((kind) => `hud.dataPanel.notice.${kind}`),
    ...['offline', 'notCommander', 'notAtConsole'].map((k) => `hud.missionControl.blocked.${k}`),
    ...Array.from({ length: 6 }, (_, i) => `hud.missionControl.home.${i}`),
    ...['green', 'yellow', 'red'].map((s) => `hud.status.${s}`),
    ...METERS.map((m) => `hud.meterName.${m}`),
    ...['out', 'back', 'suspended'].map((o) => `voyage.outcome.${o}`),
    'hud.log.allInShelter',
    ...['cruise', 'mars'].map((place) => `hud.info.title.${place}`),
    ...['move', 'use', 'switch', 'decide', 'sound', 'status', 'plan', 'missionControl', 'charts', 'crater'].map((k) => `hud.info.key.${k}`),
    ...['condition', 'fatigue', 'food', 'radiation'].map((k) => `hud.health.${k}`),
  ];

  it.each(LOCALES)('existen en %s', (locale) => {
    for (const key of keys) expect(hasKey(key, locale), key).toBe(true);
  });
});
