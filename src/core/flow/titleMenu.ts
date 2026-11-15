import { isUnlocked, UNLOCK_AT } from '../progression/progression';
import type { MissionSetup } from './newGame';
import type { GameMode, MissionLength, UnlockLevel } from './types';

export type TitleRowId = 'continue' | 'newGame' | 'mode' | 'length' | 'helpMode' | 'language' | 'settings' | 'credits';
export type TitleAction = 'continue' | 'newGame' | 'settings' | 'credits';

export const GAME_MODES: readonly GameMode[] = ['campaign2024', 'free'];
export const MISSION_LENGTHS: readonly MissionLength[] = ['short', 'long'];

export interface TitleMenuOptions {
  hasSave: boolean;
  unlockLevel: UnlockLevel;
  /** Idiomas disponibles: `core/` no conoce i18n, sólo recibe los códigos. */
  locales: readonly string[];
  locale: string;
}

/** Opción todavía bloqueada de una fila, con el nivel que la desbloquea (§6). */
export interface LockedOption {
  option: GameMode | MissionLength;
  level: UnlockLevel;
}

const wrap = (index: number, length: number) => ((index % length) + length) % length;

function cycle<T>(options: readonly T[], current: T, delta: number): T {
  return options[wrap(options.indexOf(current) + delta, options.length)] ?? current;
}

/**
 * Estado del menú principal (§2.1, §3.3, §8): qué fila está elegida, la configuración de la misión y el idioma.
 * Las opciones bloqueadas se saltean; una misión guardada pide confirmación antes de empezar otra.
 */
export class TitleMenu {
  readonly rows: readonly TitleRowId[];
  cursor = 0;
  setup: MissionSetup = { mode: 'campaign2024', length: 'short', helpMode: false };
  locale: string;
  /** Hay una misión guardada y se pidió empezar otra: el siguiente "aceptar" la reemplaza. */
  confirmingNewGame = false;

  constructor(private readonly options: TitleMenuOptions) {
    this.rows = [...(options.hasSave ? ['continue' as const] : []), 'newGame', 'mode', 'length', 'helpMode', 'settings', 'credits'];
    this.locale = options.locale;
  }

  get current(): TitleRowId {
    return this.rows[this.cursor]!;
  }

  move(delta: number): void {
    this.select(wrap(this.cursor + delta, this.rows.length));
  }

  select(index: number): void {
    if (index === this.cursor || !this.rows[index]) return;
    this.cursor = index;
    this.confirmingNewGame = false;
  }

  /** Cambia el valor de la fila elegida (← →). No hace nada en los botones. */
  change(delta: number): void {
    const { unlockLevel, locales } = this.options;
    switch (this.current) {
      case 'mode':
        this.setup = { ...this.setup, mode: cycle(GAME_MODES.filter((m) => isUnlocked(unlockLevel, 'mode', m)), this.setup.mode, delta) };
        break;
      case 'length':
        this.setup = {
          ...this.setup,
          length: cycle(MISSION_LENGTHS.filter((l) => isUnlocked(unlockLevel, 'length', l)), this.setup.length, delta),
        };
        break;
      case 'helpMode':
        this.setup = { ...this.setup, helpMode: !this.setup.helpMode };
        break;
      case 'language':
        this.locale = cycle(locales, this.locale, delta);
        break;
    }
  }

  /** Enter o clic: los botones devuelven su acción; las opciones pasan al valor siguiente. */
  activate(): TitleAction | null {
    switch (this.current) {
      case 'continue':
        return 'continue';
      case 'newGame':
        if (this.options.hasSave && !this.confirmingNewGame) {
          this.confirmingNewGame = true;
          return null;
        }
        return 'newGame';
      case 'settings':
        // Ajustes: volumen de sonidos y música, e idioma.
        return 'settings';
      case 'credits':
        // Créditos: equipo, datos e imágenes de la NASA y herramientas.
        return 'credits';
      default:
        this.change(1);
        return null;
    }
  }

  /** Opciones de la fila que todavía no se pueden elegir. */
  lockedOptions(row: TitleRowId): LockedOption[] {
    const { unlockLevel } = this.options;
    if (row === 'mode') {
      return GAME_MODES.filter((m) => !isUnlocked(unlockLevel, 'mode', m)).map((m) => ({ option: m, level: UNLOCK_AT.mode[m] }));
    }
    if (row === 'length') {
      return MISSION_LENGTHS.filter((l) => !isUnlocked(unlockLevel, 'length', l)).map((l) => ({ option: l, level: UNLOCK_AT.length[l] }));
    }
    return [];
  }
}
