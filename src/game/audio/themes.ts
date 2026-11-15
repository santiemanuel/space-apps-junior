import type { ZzfxParams } from './zzfx';

/** Efectos de sonido del juego (parámetros de ZzFX): menús, puertas, acciones, avisos y maniobras. */
export const SFX = {
  hover: [0.3, , 620, , 0.01, 0.03, 1],
  select: [0.5, , 660, , 0.02, 0.09, 1, 2, , , 330, 0.05],
  back: [0.4, , 520, , 0.02, 0.1, 1, , , , -180, 0.05],
  toggle: [0.4, , 760, , 0.01, 0.05, 2],
  open: [0.45, , 400, , 0.03, 0.1, 1, , , , 200, 0.04],
  door: [0.5, , 260, 0.02, 0.06, 0.16, 4, , 2, , , , , 0.3],
  doorClose: [0.5, , 150, 0.01, 0.04, 0.12, 4, , -3, , , , , 0.3],
  success: [0.55, , 523, , 0.05, 0.25, 1, 1.5, , , 523, 0.08],
  error: [0.5, , 180, , 0.05, 0.2, 2, 1, -8],
  alarm: [0.55, , 880, , 0.18, 0.12, 5, , , , -300, 0.1, 0.3],
  siren: [0.6, , 600, 0.05, 0.45, 0.3, 5, , , , 300, 0.2, 0.2, , , , , 0.7],
  warning: [0.6, , 220, , 0.2, 0.3, 5, , , , -110, 0.15, 0.3],
  card: [0.5, , 660, , 0.04, 0.2, 1, , , , 330, 0.06],
  tick: [0.4, , 1200, , 0.005, 0.03, 1],
  ignition: [0.9, , 60, 0.05, 0.7, 1, 4, 0.5, , , , , , , , 0.2, , 0.8],
  whoosh: [0.5, , 300, 0.05, 0.2, 0.3, 4, , -3],
  // Minijuegos de las salas: acierto, error y minijuego ganado.
  good: [0.4, , 880, , 0.02, 0.08, 1, , , , 440, 0.04],
  bad: [0.4, , 200, , 0.03, 0.12, 2, , -4],
  win: [0.6, , 523, 0.02, 0.12, 0.3, 1, 1.2, , , 262, 0.07, 0.1],
} as const satisfies Record<string, ZzfxParams>;

export type SfxId = keyof typeof SFX;

/** Momentos con música propia. */
export type MusicId = 'menu' | 'launch' | 'voyage' | 'mars' | 'victory' | 'failure';

/**
 * Tema chiptune: pasos de corchea a `bpm`, con una melodía (onda cuadrada), un bajo (triangular) y, si va, un platillo
 * de ruido en cada tiempo. Notas como `C5`, `F#4`; `-` deja sonar o calla. `loop: false` para los finales (jingles).
 */
export interface MusicTheme {
  bpm: number;
  lead: readonly string[];
  bass: readonly string[];
  hat?: boolean;
  loop: boolean;
  /** Tema que sigue cuando termina uno que no se repite (los finales no quedan en silencio). */
  next?: MusicId;
}

export const MUSIC: Record<MusicId, MusicTheme> = {
  // Menú: arpegios tranquilos, de asombro.
  menu: {
    bpm: 96,
    lead: ['C5', 'E5', 'G5', 'C6', 'B4', 'D5', 'G5', 'B5', 'A4', 'C5', 'E5', 'A5', 'F4', 'A4', 'C5', 'F5'],
    bass: ['C3', '-', '-', '-', 'G2', '-', '-', '-', 'A2', '-', '-', '-', 'F2', '-', '-', '-'],
    loop: true,
  },
  // Despegue: rápido y con pulso, para la tensión de la cuenta regresiva.
  launch: {
    bpm: 132,
    lead: ['A4', 'A4', 'C5', 'A4', 'D5', 'A4', 'E5', 'D5', 'A4', 'A4', 'C5', 'A4', 'G5', 'E5', 'D5', 'C5'],
    bass: ['A2', 'A3', 'A2', 'A3', 'F2', 'F3', 'F2', 'F3', 'G2', 'G3', 'G2', 'G3', 'E2', 'E3', 'E2', 'E3'],
    hat: true,
    loop: true,
  },
  // Viaje: lento y espacial, notas largas.
  voyage: {
    bpm: 76,
    lead: ['E5', '-', 'G5', '-', 'B5', '-', 'A5', '-', 'G5', '-', 'E5', '-', 'D5', '-', '-', '-'],
    bass: ['E3', '-', '-', '-', 'C3', '-', '-', '-', 'G2', '-', '-', '-', 'D3', '-', '-', '-'],
    loop: true,
  },
  // Marte: misterioso, en re menor.
  mars: {
    bpm: 88,
    lead: ['D5', 'F5', 'A5', 'G5', 'F5', 'E5', 'D5', '-', 'C5', 'E5', 'G5', 'F5', 'E5', 'D5', 'C5', '-'],
    bass: ['D3', '-', 'A2', '-', 'D3', '-', 'A2', '-', 'C3', '-', 'G2', '-', 'C3', '-', 'A2', '-'],
    hat: true,
    loop: true,
  },
  // Final feliz: fanfarria corta.
  victory: {
    bpm: 120,
    lead: ['C5', 'E5', 'G5', 'C6', 'G5', 'C6', 'E6', '-', 'D6', '-', 'C6', '-', 'C6', '-', '-', '-'],
    bass: ['C3', '-', 'G2', '-', 'C3', '-', 'E3', '-', 'G2', '-', 'C3', '-', 'C3', '-', '-', '-'],
    loop: false,
    next: 'menu',
  },
  // Misión suspendida: bajada tranquila (la tripulación está a salvo esperando rescate).
  failure: {
    bpm: 70,
    lead: ['A4', '-', 'G4', '-', 'F4', '-', 'E4', '-', 'D4', '-', '-', '-', '-', '-', '-', '-'],
    bass: ['D3', '-', '-', '-', 'C3', '-', '-', '-', 'A2', '-', '-', '-', '-', '-', '-', '-'],
    loop: false,
    next: 'voyage',
  },
};

const NOTE_INDEX: Record<string, number> = { C: -9, 'C#': -8, D: -7, 'D#': -6, E: -5, F: -4, 'F#': -3, G: -2, 'G#': -1, A: 0, 'A#': 1, B: 2 };

/** Frecuencia (Hz) de una nota como `A4` (440 Hz) o `F#3`; null para un silencio (`-`). */
export function noteFrequency(note: string): number | null {
  const match = /^([A-G]#?)(\d)$/.exec(note);
  if (!match) return null;
  return 440 * 2 ** ((NOTE_INDEX[match[1]!]! + (Number(match[2]) - 4) * 12) / 12);
}
