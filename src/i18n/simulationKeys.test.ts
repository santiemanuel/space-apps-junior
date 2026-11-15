import { describe, expect, it } from 'vitest';
import { CAMPAIGN_2024 } from '../content/campaign';
import { INCIDENT_RULES, INCIDENTS } from '../content/incidents';
import { CLOCK_RULES } from '../core/clock/MissionClock';
import { stormAlert } from '../core/clock/schedule';
import { SHIP_LAYOUT, VOYAGE_TASKS } from '../content/ship';
import { SACRIFICES } from '../core/cascade/sacrifices';
import { CORRIDOR } from '../core/voyage/ship';
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
    ...[...SHIP_LAYOUT.zones.map((z) => z.id), CORRIDOR].map((z) => `voyage.zone.${z}`),
    ...VOYAGE_TASKS.flatMap((task) => [`voyage.task.${task.id}`, `voyage.station.${task.id}`]),
    ...VOYAGE_TASKS.flatMap((task) => (task.system ? [`voyage.system.${task.system}`] : [])),
    ...['green', 'yellow', 'red'].map((s) => `voyage.status.${s}`),
    ...METERS.map((m) => `voyage.meterName.${m}`),
    ...['out', 'back', 'suspended'].map((o) => `voyage.outcome.${o}`),
    'voyage.log.allInShelter',
  ];

  it.each(LOCALES)('existen en %s', (locale) => {
    for (const key of keys) expect(hasKey(key, locale), key).toBe(true);
  });
});
