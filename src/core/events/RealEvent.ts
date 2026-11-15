/**
 * Un evento real de un dataset de la NASA, listo para mostrarse en una tarjeta "Esto pasó de verdad"
 * (game-design §3.8). La simulación lo produce; DataCard y el informe lo muestran.
 */
export interface RealEvent {
  id: string;
  /** Fecha del dato (ISO 8601). */
  date: string;
  /** Instrumento, p. ej. "RAD". */
  instrument: string;
  /** Misión, p. ej. "Curiosity". */
  mission: string;
  /** Agencia o fuente, p. ej. "NASA". */
  agency: string;
  value: number;
  unit: string;
  /** Clave de traducción con el valor explicado para niños ("64 veces lo normal"). */
  kidValueKey: string;
  /** Parámetros de `kidValueKey` (p. ej. `{ times: 64 }`). */
  kidValueParams?: Record<string, string | number>;
  /** Clave de traducción con la frase de explicación. */
  explanationKey: string;
  /** Enlace a la fuente original (p. ej. el `link` del evento en DONKI). */
  sourceUrl: string;
  /** El valor se recortó con un tope del juego (p. ej. BioSentinel a 650 μGy/h, §3.2.1). */
  capped?: boolean;
}
