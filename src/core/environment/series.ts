/** Índice UV de REMS: el juego lo usa como indicador de polvo (game-design §3.2). */
export type UvIndex = 'Very_High' | 'High' | 'Moderate' | 'Low';

/** Tasa de dosis absorbida de un día real (μGy/h). `date` es el día del dato usado (el más cercano). */
export interface DailyDose {
  date: string;
  uGyH: number;
  /** Recortado por el tope de BioSentinel (§3.2.1). */
  capped: boolean;
}

/** Clima real de Gale para un día terrestre. */
export interface MarsWeather {
  date: string;
  sol: number;
  minTempC: number;
  maxTempC: number | null;
  uv: UvIndex | null;
  /** La mínima cruda era un artefacto (< −90 °C aislado) y se reemplazó por la de los soles vecinos. */
  adjusted: boolean;
}

/** Dónde se mide la dosis: cada lugar tiene su serie real. */
export type DoseSite = 'deepSpace' | 'marsCruise' | 'marsSurface';
