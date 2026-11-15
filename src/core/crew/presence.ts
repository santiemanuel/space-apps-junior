import type { CrewMemberState } from './types';

/**
 * Estado de cada tripulante, como los de Discord: en línea (trabaja bien), ausente (duerme o está muy cansado),
 * no molestar (en el refugio, reparando algo o enfermo) y desconectado (en reposo en la enfermería).
 */
export type CrewPresence = 'online' | 'away' | 'busy' | 'offline';

export const CREW_PRESENCES: readonly CrewPresence[] = ['online', 'away', 'busy', 'offline'];

export interface PresenceContext {
  /** Duerme ahora (su rutina o el jugador en la enfermería). */
  sleeping: boolean;
  /** Va o está en el refugio por una tormenta. */
  sheltering: boolean;
  /** Está reparando un incidente. */
  repairing: boolean;
}

/** Umbrales [regla]: muy cansado para estar "ausente" y salud baja para "no molestar". */
export const PRESENCE_RULES = { tiredFatigue: 0.75, sickCondition: 0.35 } as const;

export function crewPresence(member: CrewMemberState, ctx: PresenceContext): CrewPresence {
  if (member.resting) return 'offline';
  // Mismo criterio que el globo de "va lento": por salud baja, no molestar; por cansancio, ausente.
  const slow = member.slowReasonKey ?? '';
  if (ctx.sheltering || ctx.repairing || member.condition < PRESENCE_RULES.sickCondition || slow.endsWith('.condition')) return 'busy';
  if (ctx.sleeping || member.fatigue > PRESENCE_RULES.tiredFatigue || slow.endsWith('.fatigue')) return 'away';
  return 'online';
}
