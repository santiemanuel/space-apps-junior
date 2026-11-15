import type { IncidentDefinition, IncidentRules } from '../core/incidents/definitions';
import { HUMAN_STANDARDS } from '../data/curated';

/** Parámetros del planificador (§3.4). Todo es [regla] salvo el tope de BioSentinel (§3.2.1). */
export const INCIDENT_RULES: IncidentRules = {
  wearMultiplierBack: 2,
  retriggerCooldownHours: 24,
  brakeHours: 24,
  stormCapUGyH: 650,
  // Misma regla que las tormentas de BioSentinel (datasets/README.md).
  marsStorm: { factor: 5, baselineDays: 27 },
  // Con 4 °C bajo la mediana de 7 soles se marca ~5 % de los soles de Gale (2015 → 2024).
  coldNight: { dropC: 4, windowSols: 7, belowC: -85 },
};

const CRUISE = ['cruiseOut', 'cruiseBack'] as const;
const ALL = ['cruiseOut', 'mars', 'cruiseBack'] as const;

/**
 * Los 10 incidentes del diseño (§4.2, §4.4), más las averías de la base nueva de Gale (tubos, cables y fusibles,
 * docs/mision_a_marte_referencias_topdown/plano-base-marte.png), en el formato único de §3.4. Textos en `src/i18n/*\/incidents.json`
 * bajo `textKey` (`.title`, `.alert`, `.impact`, `.explanation`) y `textKey.response.<id>.title/.cost`.
 */
export const INCIDENTS: readonly IncidentDefinition[] = [
  {
    id: 'radiationStorm',
    phases: ALL,
    unlockLevel: 1,
    triggers: [
      { kind: 'timeline', timeline: 'deepSpaceStorm' },
      { kind: 'timeline', timeline: 'marsRadiation' },
    ],
    // Sin detección previa en DONKI se avisa con 48 h simuladas (§3.1).
    warningHours: 48,
    end: 'time',
    effect: {},
    responses: [
      { id: 'goToShelter', risk: 'green', cost: {}, resolves: false, while: { shelter: true, evaBlocked: true, sciencePaused: true } },
      { id: 'keepWorking', risk: 'red', cost: {}, resolves: false },
    ],
    source: { kind: 'dataset', ref: 'RadLab BioSentinel + DONKI (espacio profundo); RadLab Curiosity RAD (Marte)' },
    textKey: 'incidents.radiationStorm',
  },
  {
    id: 'dustStorm',
    phases: ['mars'],
    unlockLevel: 1,
    triggers: [{ kind: 'timeline', timeline: 'marsDust' }],
    warningHours: 24,
    end: 'time',
    effect: { energySplit: true },
    responses: [
      { id: 'heatFirst', risk: 'yellow', cost: {}, resolves: false, while: { energyPriority: 'heat', sciencePaused: true } },
      { id: 'airFirst', risk: 'yellow', cost: {}, resolves: false, while: { energyPriority: 'air', sciencePaused: true, heatingFactor: 0.7 } },
      { id: 'scienceFirst', risk: 'red', cost: {}, resolves: false, while: { energyPriority: 'science' } },
    ],
    source: { kind: 'dataset', ref: 'REMS de Curiosity: índice UV "Low"' },
    textKey: 'incidents.dustStorm',
  },
  {
    id: 'scrubberFailure',
    phases: ALL,
    unlockLevel: 2,
    triggers: [{ kind: 'random', chancePerDay: 0.04, wear: true }],
    warningHours: 6,
    end: 'response',
    effect: { systems: { scrubber: 'red' } },
    responses: [
      { id: 'repair', risk: 'green', cost: { spares: 1 }, work: { task: 'scrubber', hours: 3 }, repairs: ['scrubber'], resolves: true },
      { id: 'improvise', risk: 'yellow', cost: { fatigue: 0.1 }, work: { task: 'scrubber', hours: 8 }, repairs: ['scrubber'], resolves: true },
    ],
    source: { kind: 'standard', ref: `NASA-STD-3001: CO2 ≤ ${HUMAN_STANDARDS.co2LimitMmHg} mmHg; falla aleatoria [regla]` },
    textKey: 'incidents.scrubberFailure',
  },
  {
    id: 'micrometeoroid',
    phases: CRUISE,
    unlockLevel: 3,
    triggers: [{ kind: 'random', chancePerDay: 0.02 }],
    warningHours: 0,
    end: 'response',
    // ~1,2 kg de O2 por día: un tercio de lo que respira la tripulación [regla].
    effect: { oxygenLeakKgPerHour: 0.05 },
    responses: [
      { id: 'patchLeak', risk: 'green', cost: { spares: 1 }, work: { task: 'leak', hours: 2 }, resolves: true },
      { id: 'sealModule', risk: 'yellow', cost: { oxygenKg: 2, morale: 0.05 }, resolves: true },
    ],
    source: { kind: 'rule', ref: 'Falla aleatoria con semilla' },
    textKey: 'incidents.micrometeoroid',
  },
  {
    id: 'isolation',
    phases: CRUISE,
    unlockLevel: 2,
    // 10 días sin hablar con la Tierra [regla].
    triggers: [{ kind: 'safeRange', variable: 'hoursSinceCallHome', max: 240 }],
    warningHours: 0,
    end: 'response',
    effect: { moraleLossPerDay: 0.03 },
    responses: [{ id: 'callHome', risk: 'green', cost: { energyKwh: 1 }, resets: 'hoursSinceCallHome', resolves: true }],
    source: { kind: 'dataset', ref: 'Mars-500 (aislamiento de 520 días), OSDR' },
    textKey: 'incidents.isolation',
  },
  {
    id: 'extremeNight',
    phases: ['mars'],
    unlockLevel: 3,
    triggers: [{ kind: 'timeline', timeline: 'marsCold' }],
    warningHours: 12,
    end: 'time',
    effect: {},
    responses: [
      { id: 'heatMore', risk: 'green', cost: {}, resolves: false, while: { heatingFactor: 1.3 } },
      { id: 'closeZone', risk: 'yellow', cost: {}, resolves: false, while: { heatingFactor: 0.6, greenhouseOff: true } },
    ],
    source: { kind: 'dataset', ref: 'REMS de Curiosity: temperatura mínima' },
    textKey: 'incidents.extremeNight',
  },
  {
    id: 'highCo2',
    phases: ALL,
    unlockLevel: 3,
    triggers: [{ kind: 'safeRange', variable: 'co2MmHg', max: HUMAN_STANDARDS.co2LimitMmHg }],
    warningHours: 0,
    end: 'inRange',
    effect: {},
    responses: [
      { id: 'repairScrubber', risk: 'green', cost: { spares: 1 }, work: { task: 'scrubber', hours: 2 }, repairs: ['scrubber'], resolves: false },
      { id: 'reassignEnergy', risk: 'yellow', cost: { energyKwh: 6 }, repairs: ['scrubber'], resolves: false },
    ],
    source: { kind: 'standard', ref: 'NASA-STD-3001 V2 6004' },
    textKey: 'incidents.highCo2',
  },
  {
    id: 'greenhousePest',
    phases: ['mars'],
    unlockLevel: 2,
    // 3 soles sin que nadie cuide el invernadero [regla].
    triggers: [{ kind: 'safeRange', variable: 'hoursSinceGreenhouseCare', max: 72 }],
    warningHours: 12,
    end: 'response',
    effect: { systems: { greenhouse: 'yellow' }, foodLossKgPerDay: 1 },
    responses: [
      { id: 'botanistCare', risk: 'green', cost: {}, work: { task: 'pests', hours: 3 }, repairs: ['greenhouse'], resets: 'hoursSinceGreenhouseCare', resolves: true },
      { id: 'pullPlants', risk: 'yellow', cost: { foodKg: 10 }, repairs: ['greenhouse'], resets: 'hoursSinceGreenhouseCare', resolves: true },
    ],
    source: { kind: 'dataset', ref: 'OSD-177 (plantas en vuelo), OSDR' },
    textKey: 'incidents.greenhousePest',
  },
  {
    id: 'sealDust',
    phases: ['mars'],
    unlockLevel: 4,
    // 12 h de EVA sin mantenimiento de la esclusa [regla].
    triggers: [{ kind: 'safeRange', variable: 'evaHoursSinceMaintenance', max: 12 }],
    warningHours: 6,
    end: 'response',
    effect: { systems: { airlock: 'yellow' }, oxygenLeakKgPerHour: 0.02 },
    responses: [
      { id: 'airlockMaintenance', risk: 'green', cost: {}, work: { task: 'leak', hours: 2 }, repairs: ['airlock'], resets: 'evaHoursSinceMaintenance', resolves: true },
      { id: 'pauseEva', risk: 'yellow', cost: {}, resolves: false, while: { evaBlocked: true } },
    ],
    source: { kind: 'rule', ref: 'Desgaste por polvo en la esclusa' },
    textKey: 'incidents.sealDust',
  },
  {
    id: 'solarConjunction',
    phases: ['mars'],
    unlockLevel: 4,
    triggers: [{ kind: 'timeline', timeline: 'solarConjunction' }],
    warningHours: 72,
    end: 'time',
    effect: { missionControlOff: true },
    responses: [{ id: 'decideAlone', risk: 'yellow', cost: {}, resolves: false }],
    source: { kind: 'dataset', ref: 'Moratorias de comandos de la NASA (datasets/curated/mars-conjunctions.json)' },
    textKey: 'incidents.solarConjunction',
  },
  {
    // Un tubo de plástico aislado entre dos módulos se raja (frío, polvo o un golpe): sus puertas se sellan solas y
    // hay que dar la vuelta por otro tubo hasta repararlo (src/core/mars/MarsSession.ts, `brokenTubes`).
    id: 'tubeBreach',
    phases: ['mars'],
    unlockLevel: 2,
    triggers: [{ kind: 'random', chancePerDay: 0.03 }],
    warningHours: 0,
    end: 'response',
    effect: {},
    responses: [
      { id: 'patchTube', risk: 'green', cost: { spares: 1 }, work: { task: 'leak', hours: 2 }, resolves: true },
      { id: 'tapeTube', risk: 'yellow', cost: { fatigue: 0.1 }, work: { task: 'leak', hours: 5 }, resolves: true },
    ],
    source: { kind: 'rule', ref: 'Falla aleatoria con semilla en los tubos de la base' },
    textKey: 'incidents.tubeBreach',
  },
  {
    // Un tramo de cable (verde en el plano) se corta: la energía busca otro camino por la red y se pierde una parte;
    // si no queda camino, los paneles no cargan o la batería no llega a la base. Se empalma afuera, de día.
    id: 'cableCut',
    phases: ['mars'],
    unlockLevel: 3,
    triggers: [{ kind: 'random', chancePerDay: 0.025 }],
    warningHours: 0,
    end: 'response',
    effect: {},
    responses: [
      { id: 'spliceCable', risk: 'green', cost: { spares: 1 }, work: { task: 'energy', hours: 2 }, resolves: true },
      { id: 'bypassCable', risk: 'yellow', cost: { fatigue: 0.1 }, work: { task: 'energy', hours: 5 }, resolves: true },
    ],
    source: { kind: 'rule', ref: 'Falla aleatoria con semilla en la red de cables' },
    textKey: 'incidents.cableCut',
  },
  {
    // Se quema el fusible de la entrada de los paneles en la sala de energía: la base pasa a la batería, que dura poco.
    id: 'fuseBlown',
    phases: ['mars'],
    unlockLevel: 2,
    triggers: [{ kind: 'random', chancePerDay: 0.03 }],
    warningHours: 0,
    end: 'response',
    effect: {},
    responses: [
      { id: 'replaceFuse', risk: 'green', cost: { spares: 1 }, work: { task: 'energy', hours: 1 }, resolves: true },
      { id: 'rewireFuse', risk: 'yellow', cost: { fatigue: 0.05 }, work: { task: 'energy', hours: 3 }, resolves: true },
    ],
    source: { kind: 'rule', ref: 'Falla aleatoria con semilla en los tableros de energía' },
    textKey: 'incidents.fuseBlown',
  },
];
