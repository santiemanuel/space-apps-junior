/**
 * Tormenta de radiación en espacio profundo: subida real de dosis en BioSentinel, con la detección en DONKI
 * que la precede (game-design §3.1). Fechas ISO 8601 en UTC.
 */
export interface SpaceStorm {
  id: string;
  /** Detección en DONKI que precede al pico (o 48 h antes del impacto si no hubo detección previa). */
  warnAt: string;
  /** Inicio real del pico de dosis. */
  impactAt: string;
  /** Fin de los días con dosis alta. */
  endAt: string;
  leadHours: number;
  warning: { kind: 'donkiFlare'; classType: string; link: string } | { kind: 'rule48h' };
  /** Media diaria más alta (μGy/h), antes del tope de §3.2.1. */
  peakMeanUGyH: number;
  /** Mediana de los 27 días previos (μGy/h): "cuántas veces lo normal". */
  baselineUGyH?: number;
  /** La media diaria superó el tope de 650 μGy/h (§3.2.1). */
  capped: boolean;
  sourceLinks: string[];
}

/** Tormentas que se solapan con [from, to) (fechas ISO). */
export const stormsBetween = (storms: readonly SpaceStorm[], from: string, to: string): SpaceStorm[] =>
  storms.filter((s) => Date.parse(s.warnAt) < Date.parse(to) && Date.parse(s.endAt) > Date.parse(from));
