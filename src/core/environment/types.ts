/** Modelos de dominio derivados de datasets NASA (independientes del formato crudo de la API). */
export interface SolarFlare {
  id: string;
  classType: string; // p. ej. "M1.2", "X2.0"
  peakTime: string;
  /** Flujo de rayos X pico en W/m² (escala GOES). */
  peakFlux: number;
  link?: string;
}

/** Evento de partículas energéticas solares (SEP): la principal fuente de dosis aguda para astronautas. */
export interface SolarParticleEvent {
  id: string;
  eventTime: string;
  instruments: string[];
  link?: string;
}

/** "live": consultado ahora a la API. "archive": ventana real tomada de datasets/ (nunca se presenta como en vivo). */
export type DataSource = 'live' | 'archive';

export interface EnvironmentSnapshot {
  source: DataSource;
  window: { start: string; end: string };
  flares: SolarFlare[];
  particleEvents: SolarParticleEvent[];
  /** 0..1, derivado de llamaradas y eventos SEP. */
  radiationRisk: number;
  /** Nivel de apagón de radio en la escala NOAA (R0..R5) de la llamarada más intensa. */
  radioBlackout: number;
}
