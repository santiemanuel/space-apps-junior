/**
 * Efectos de sonido del juego: cada uno es un MP3 de `public/assets/audio/sfx/` (ElevenLabs Sound Effects; prompts y
 * criterios en `public/assets/audio/README.md`). Menús, puertas, avisos, minijuegos, maniobras y el mundo.
 */
export const SFX = {
  hover: 'foco-boton',
  select: 'confirmar',
  back: 'volver',
  toggle: 'cambiar-interruptor',
  open: 'abrir-panel',
  door: 'abrir-puerta',
  doorClose: 'cerrar-puerta',
  // Incidente resuelto (más importante que un acierto de minijuego).
  success: 'incidente-resuelto',
  alarm: 'alarma',
  siren: 'sirena',
  warning: 'advertencia',
  card: 'revelar-tarjeta',
  tick: 'cuenta-regresiva',
  ignition: 'ignicion',
  // Transición genérica (cambio de pantalla).
  whoosh: 'transicion',
  // Minijuegos: acierto, error y minijuego ganado.
  good: 'paso-correcto',
  bad: 'paso-incorrecto',
  win: 'minijuego-completo',
  // Pulso del contador de partículas del tablero.
  particleClick: 'detector-particulas',
  // Maniobras.
  parachute: 'paracaidas',
  splashdown: 'amerizaje',
  stageSeparation: 'separar-etapas',
  // Mundo: dormir, pasos, agua y escaneo.
  sleep: 'descanso',
  footstepCabin: 'paso-cabina',
  footstepMars: 'paso-marte',
  water: 'flujo-agua',
  scan: 'escaneo-completo',
  // Final de la misión.
  missionVictory: 'mision-completa',
  missionSuspended: 'mision-suspendida',
  // Despegue y vuelo: presurizar, prueba de radio (un tono por flecha), motores en T-6, brazo y torre de servicio,
  // público, acople con la nave nodriza y contacto con el suelo de Marte.
  cabinPressurize: 'cabin-pressurize',
  radioDown: 'radio-test-01',
  radioLeft: 'radio-test-02',
  radioRight: 'radio-test-03',
  radioUp: 'radio-test-04',
  engineStart: 'engine-start-t6',
  serviceArm: 'service-arm-retract',
  crowdCheer: 'crowd-cheer',
  marsDocking: 'mars-docking',
  marsTouchdown: 'mars-touchdown',
  // Base y nave: esclusa (salir y entrar), micrometeorito, apagón y vuelta de la energía, cambio de tripulante.
  airlockOut: 'airlock-cycle-01',
  airlockIn: 'airlock-cycle-02',
  micrometeorite: 'micrometeorite-hit',
  powerDown: 'power-change-01',
  powerUp: 'power-change-02',
  crewSwitch: 'crew-switch',
  // Cocina: cocinar y servir.
  mealCook: 'meal-action-01',
  mealServe: 'meal-action-02',
  // Tercera tanda (docs/sonidos-variedad.md): un sonido propio por minijuego, maniobra, incidente y pantalla.
  achievementUnlock: 'achievement-unlock',
  bikeOffPace01: 'bike-off-pace-01',
  bikeOffPace02: 'bike-off-pace-02',
  boosterSeparation: 'booster-separation',
  cableSnap: 'cable-snap',
  cargoStow01: 'cargo-stow-01',
  cargoStow02: 'cargo-stow-02',
  checklistRepair: 'checklist-repair',
  commsPanelOpen: 'comms-panel-open',
  crateBlocked: 'crate-blocked',
  crateLift: 'crate-lift',
  cratePlace: 'crate-place',
  crateRotate: 'crate-rotate',
  dataScreenOpen: 'data-screen-open',
  departureScheduled: 'departure-scheduled',
  dustGust: 'dust-gust',
  electricSpark01: 'electric-spark-01',
  electricSpark02: 'electric-spark-02',
  flightConfirm: 'flight-confirm',
  flightMiss: 'flight-miss',
  fuseInsert: 'fuse-insert',
  fusePop: 'fuse-pop',
  growLightOn: 'grow-light-on',
  habitatMorning: 'habitat-morning',
  harvestMiss: 'harvest-miss',
  harvestSnip01: 'harvest-snip-01',
  harvestSnip02: 'harvest-snip-02',
  heartbeat: 'heartbeat',
  heatShieldRelease: 'heat-shield-release',
  holdSealed: 'hold-sealed',
  hullCreakCold: 'hull-creak-cold',
  ingredientAdd01: 'ingredient-add-01',
  ingredientAdd02: 'ingredient-add-02',
  ingredientReturn: 'ingredient-return',
  isolationHush: 'isolation-hush',
  ladybugsRelease: 'ladybugs-release',
  leakDetectorBeep: 'leak-detector-beep',
  machineWindDown: 'machine-wind-down',
  missionStart: 'mission-start',
  moxieOverheat: 'moxie-overheat',
  moxieOxygen: 'moxie-oxygen',
  outerDoorLock: 'outer-door-lock',
  particleAbsorbed: 'particle-absorbed',
  particleThrough: 'particle-through',
  patchApply: 'patch-apply',
  patchMiss: 'patch-miss',
  pestBuzz: 'pest-buzz',
  pipeRotate01: 'pipe-rotate-01',
  pipeRotate02: 'pipe-rotate-02',
  powerRelay01: 'power-relay-01',
  powerRelay02: 'power-relay-02',
  pulseMonitorBeep: 'pulse-monitor-beep',
  radioFadeStatic: 'radio-fade-static',
  radioLock: 'radio-lock',
  reportStar: 'report-star',
  scrubberCatch: 'scrubber-catch',
  scrubberOxygenLost: 'scrubber-oxygen-lost',
  seatbeltClick01: 'seatbelt-click-01',
  seatbeltClick02: 'seatbelt-click-02',
  shelterSeal: 'shelter-seal',
  starLock: 'star-lock',
  starTrackerStep: 'star-tracker-step',
  suitConnect: 'suit-connect',
  telemetryReceived: 'telemetry-received',
  waterBagPlace: 'water-bag-place',
  wireSelect: 'wire-select',
  wireSplice: 'wire-splice',
} as const satisfies Record<string, string>;

/**
 * Sonidos en loop: ambientes (interior de la nave, sala de máquinas, Marte desde el casco) y los que duran mientras
 * pasa algo (cargar combustible, rugido del despegue, agua de la plataforma, plasma, fuga de aire, tormenta, bici,
 * riego, taladro o pala de las muestras).
 */
export const LOOPS = {
  cabin: 'ambiente-cabina',
  equipment: 'sala-equipos',
  marsSuit: 'casco-marte',
  fuelFlow: 'fuel-flow-loop',
  launchRoar: 'launch-roar-loop',
  padWater: 'pad-water-loop',
  reentryRumble: 'reentry-rumble-loop',
  airLeak: 'air-leak-loop',
  dustStorm: 'dust-storm-loop',
  bike: 'exercise-bike-loop',
  plantWater: 'plant-water-loop',
  drill: 'sample-drill-loop-01',
  shovel: 'sample-drill-loop-02',
  radioTuning: 'radio-tuning-loop',
  moxieHeat: 'moxie-heat-loop',
  sealBrush: 'seal-brush-loop',
  geiger: 'geiger-loop',
  rover: 'rover-motor-loop',
} as const satisfies Record<string, string>;

export type LoopId = keyof typeof LOOPS;
export type AmbienceId = Extract<LoopId, 'cabin' | 'equipment' | 'marsSuit'>;

/** URL de un sonido (relativa a la página, como los demás recursos). */
export const soundUrl = (file: string): string => `assets/audio/sfx/${file}.mp3`;

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
