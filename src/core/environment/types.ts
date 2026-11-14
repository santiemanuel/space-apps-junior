/** Modelos de dominio derivados de datasets NASA (independientes del formato crudo de la API). */
export interface SolarFlare {
  id: string;
  classType: string; // p. ej. "M1.2", "X2.0"
  peakTime: string;
  /** Flujo de rayos X pico en W/m² (escala GOES). */
  peakFlux: number;
}

export interface NearEarthObject {
  id: string;
  name: string;
  diameterMeters: number;
  missDistanceLunar: number;
  velocityKmS: number;
  hazardous: boolean;
  approachDate: string;
}

export type DataSource = 'live' | 'fixture';

export interface EnvironmentSnapshot {
  flares: SolarFlare[];
  neos: NearEarthObject[];
  source: DataSource;
  /** 0..1, derivado de la llamarada más intensa. */
  radiationRisk: number;
  /** 0..1, derivado del NEO más relevante (tamaño × proximidad). */
  debrisThreat: number;
}
