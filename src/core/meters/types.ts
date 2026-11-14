/**
 * Los medidores compartidos (game-design §3.2). La salud es por tripulante y vive en
 * `CrewMemberState`; aquí sólo están los dos medidores de la nave o la base.
 */
export interface EnergyMeter {
  batteryKwh: number;
  capacityKwh: number;
}

export interface LifeSupportMeter {
  oxygenKg: number;
  /** Agua potable (L). El agua del escudo del refugio va aparte, en `GameState.waterShield`. */
  waterL: number;
  /** CO2 en cabina (mmHg). Límite NASA-STD-3001: ≤ 3 mmHg. */
  co2MmHg: number;
}

export interface MeterState {
  energy: EnergyMeter;
  lifeSupport: LifeSupportMeter;
}

/** Nivel del avance rápido interactivo (§3.1). */
export type AlertLevel = 'calm' | 'alert' | 'impact';
