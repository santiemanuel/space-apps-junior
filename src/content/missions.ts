import type { MissionDefinition } from '../core/missions/types';

/** Contenido de misiones: datos puros, editables sin tocar sistemas. */
export const MISSIONS: readonly MissionDefinition[] = [
  {
    id: 'eva-solar-array',
    title: 'EVA: reparar panel solar',
    description: 'Sustituir una unidad de conmutación dañada en el ala solar de babor.',
    type: 'eva',
    stationId: 'airlock',
    workSeconds: 8,
    exposure: { radiation: 0.9, debris: 0.6 },
    reward: { power: 40 },
    failurePenalty: { oxygen: -6, power: -10 },
  },
  {
    id: 'repair-cdra',
    title: 'Reparar depurador de CO2 (CDRA)',
    description: 'Cambiar el lecho de zeolita del sistema de eliminación de CO2.',
    type: 'repair',
    stationId: 'life-support',
    workSeconds: 6,
    exposure: { radiation: 0.1, debris: 0 },
    reward: { oxygen: 8 },
    failurePenalty: { oxygen: -4 },
  },
  {
    id: 'science-plant-growth',
    title: 'Experimento: cultivo en microgravedad',
    description: 'Cosechar y registrar muestras del experimento de cultivo.',
    type: 'science',
    stationId: 'lab',
    workSeconds: 5,
    exposure: { radiation: 0.3, debris: 0 },
    reward: { food: 3 },
    failurePenalty: { food: -1 },
  },
  {
    id: 'logistics-water-recovery',
    title: 'Mantenimiento del reciclador de agua',
    description: 'Reemplazar filtros del sistema de recuperación de agua (WRS).',
    type: 'logistics',
    stationId: 'storage',
    workSeconds: 5,
    exposure: { radiation: 0, debris: 0.2 },
    reward: { water: 10 },
    failurePenalty: { water: -5 },
  },
];
