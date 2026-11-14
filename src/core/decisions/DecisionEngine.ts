import type { EnvironmentSnapshot } from '../environment/types';
import { clamp } from '../math';
import type { MissionDefinition } from '../missions/types';
import type { ResourceState } from '../resources/ResourceModel';
import type { Rng } from '../rng/Rng';

export type DecisionChoice = 'proceed' | 'shield' | 'postpone';

export interface DecisionOption {
  choice: DecisionChoice;
  label: string;
  successChance: number;
  /** Coste fijo aplicado al elegir la opción, con independencia del resultado. */
  cost: Partial<ResourceState>;
}

export interface Decision {
  missionId: string;
  prompt: string;
  risk: number;
  options: DecisionOption[];
}

export interface DecisionOutcome {
  missionId: string;
  choice: DecisionChoice;
  /** false si se pospone: la misión sigue disponible para otro intento. */
  attempted: boolean;
  success: boolean;
  effects: Partial<ResourceState>;
}

/** Riesgo a partir del cual el jugador debe decidir antes de iniciar una misión. */
export const DECISION_RISK_THRESHOLD = 0.25;

/** Riesgo combinado (amenazas independientes) de una misión en el entorno actual. */
export function missionRisk(mission: MissionDefinition, env: EnvironmentSnapshot): number {
  const radiation = env.radiationRisk * mission.exposure.radiation;
  const comms = (env.radioBlackout / 5) * mission.exposure.comms;
  return clamp(1 - (1 - radiation) * (1 - comms));
}

export function buildDecision(mission: MissionDefinition, env: EnvironmentSnapshot): Decision | null {
  const risk = missionRisk(mission, env);
  if (risk < DECISION_RISK_THRESHOLD) return null;
  const drivers = [
    env.radiationRisk * mission.exposure.radiation >= 0.15 ? 'actividad solar elevada' : null,
    (env.radioBlackout / 5) * mission.exposure.comms >= 0.15 ? `apagón de radio R${env.radioBlackout}` : null,
  ].filter((d): d is string => d !== null);
  return {
    missionId: mission.id,
    risk,
    prompt: `${mission.title}: riesgo ${Math.round(risk * 100)}% por ${drivers.join(' y ') || 'condiciones adversas'}.`,
    options: [
      { choice: 'proceed', label: 'Proceder', successChance: clamp(1 - risk), cost: {} },
      { choice: 'shield', label: 'Proceder con blindaje extra', successChance: clamp(1 - risk * 0.4), cost: { power: -25 } },
      { choice: 'postpone', label: 'Posponer', successChance: 1, cost: { oxygen: -0.5, food: -0.5 } },
    ],
  };
}

export function resolveDecision(
  decision: Decision,
  choice: DecisionChoice,
  mission: MissionDefinition,
  rng: Rng,
): DecisionOutcome {
  const option = decision.options.find((o) => o.choice === choice);
  if (!option) throw new Error(`Opción inválida "${choice}" para ${decision.missionId}`);
  const attempted = choice !== 'postpone';
  const success = attempted && rng.chance(option.successChance);
  const effects: Partial<ResourceState> = { ...option.cost };
  if (attempted && !success) {
    for (const [key, value] of Object.entries(mission.failurePenalty) as [keyof ResourceState, number][]) {
      effects[key] = (effects[key] ?? 0) + value;
    }
  }
  return { missionId: decision.missionId, choice, attempted, success, effects };
}
