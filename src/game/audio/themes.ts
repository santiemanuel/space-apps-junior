import MUSIC_TRACKS from './musicTracks.json';

/** Medidas de cada pista masterizada (s): duración, dónde empieza el fundido del loop y cuánto dura. */
export { MUSIC_TRACKS };

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
  // Tercera tanda (docs/produccion/sonidos-variedad.md): un sonido propio por minijuego, maniobra, incidente y pantalla.
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
 * riego, taladro o pala de las muestras, la alarma de la tormenta solar).
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
  // Tormenta solar: suena desde el aviso hasta que termina.
  stormAlarm: 'alarma-tormenta',
} as const satisfies Record<string, string>;

export type LoopId = keyof typeof LOOPS;
export type AmbienceId = Extract<LoopId, 'cabin' | 'equipment' | 'marsSuit'>;

/** URL de un sonido (relativa a la página, como los demás recursos). */
export const soundUrl = (file: string): string => `assets/audio/sfx/${file}.mp3`;

export type SfxId = keyof typeof SFX;

/** Momentos con música propia: menú, las dos bodegas, las cuatro maniobras, los dos viajes, la base y los finales. */
export type MusicId =
  | 'menu'
  | 'loadout'
  | 'marsLoadout'
  | 'ascent'
  | 'landing'
  | 'marsAscent'
  | 'reentry'
  | 'voyageOut'
  | 'voyageBack'
  | 'mars'
  | 'victory'
  | 'failure';

/**
 * Pista de la banda sonora: un MP3 de `public/assets/audio/music/` (masterizado con `scripts/audio/master-music.mjs`,
 * todas a −16,5 LUFS) y cómo entra en la mezcla. Duración y punto de loop salen de `musicTracks.json`.
 */
export interface MusicTrack {
  file: keyof typeof MUSIC_TRACKS;
  /** Nivel en la mezcla (dB, sobre el volumen de música de los ajustes): las de juego largo van más bajas. */
  gainDb: number;
  /** Fundido de entrada (s). */
  fadeIn: number;
  /** Espera antes de entrar (s): los finales dejan sonar primero el sello de la misión. */
  delay?: number;
}

export const MUSIC: Record<MusicId, MusicTrack> = {
  // Menú: la pista entera al frente, con una entrada lenta.
  menu: { file: 'main-menu', gainDb: 0, fadeIn: 2.5 },
  // Bodegas: fondo para pensar, debajo de los golpes de las cajas.
  loadout: { file: 'loadout', gainDb: -4, fadeIn: 2 },
  marsLoadout: { file: 'mars-loadout', gainDb: -4, fadeIn: 2 },
  // Maniobras: presentes pero dejando lugar al rugido de los motores y a la radio.
  ascent: { file: 'maneuver-ascent-earth', gainDb: -3, fadeIn: 1.2 },
  landing: { file: 'maneuver-landing-mars', gainDb: -3, fadeIn: 1.2 },
  marsAscent: { file: 'maneuver-ascent-mars', gainDb: -3, fadeIn: 1.2 },
  reentry: { file: 'maneuver-landing-earth', gainDb: -3, fadeIn: 1.2 },
  // Viajes y base: horas de juego con avisos, alarmas y minijuegos encima; más bajas para no cansar.
  voyageOut: { file: 'voyage-mars', gainDb: -6, fadeIn: 4 },
  voyageBack: { file: 'voyage-earth', gainDb: -5, fadeIn: 4 },
  mars: { file: 'mars-base', gainDb: -6, fadeIn: 4 },
  // Finales: entran cuando termina el sello (`missionVictory` / `missionSuspended`).
  victory: { file: 'mission-complete', gainDb: 0, fadeIn: 1.5, delay: 1.6 },
  failure: { file: 'mission-suspended', gainDb: -1, fadeIn: 2.5, delay: 1.2 },
};

/** URL de una pista de música. */
export const musicUrl = (file: string): string => `assets/audio/music/${file}.mp3`;

/**
 * Efectos que bajan la música mientras suenan (dB): sellos de fin de misión, alarmas y logros se oyen claros. La
 * música vuelve sola al terminar el efecto.
 */
export const MUSIC_DUCK: Partial<Record<SfxId, number>> = {
  missionVictory: -10,
  missionSuspended: -10,
  alarm: -5,
  siren: -6,
  ignition: -4,
  engineStart: -3,
  achievementUnlock: -5,
  micrometeorite: -4,
  powerDown: -4,
};
