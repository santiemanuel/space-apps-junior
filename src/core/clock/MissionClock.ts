import type { AlertLevel } from '../meters/types';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Aviso que frena el avance rápido (game-design §3.1). Lo produce el planificador de incidentes (§3.4)
 * o una tormenta real del dataset. Fechas ISO 8601.
 */
export interface ClockAlert {
  id: string;
  /** Desde aquí el reloj pasa a Alerta. */
  warnAt: string;
  /** Desde aquí el reloj pasa a Impacto (tiempo normal). */
  impactAt: string;
  /** Fin del impacto si el jugador no lo resuelve antes. */
  endAt: string;
  /** Clave base de traducción: el nivel se agrega al final (`<clave>.alert`, `<clave>.impact`). */
  reasonKey: string;
}

/** Jornada (o sol) que se juega a tiempo normal; entre ventanas el calendario corre en avance rápido. */
export interface PlayWindow {
  start: string;
  end: string;
}

export type ClockPace = 'play' | 'fast';

export type ClockEvent =
  | { type: 'day'; simDate: string }
  | { type: 'level'; level: AlertLevel; reasonKey: string; alertId: string | null; at: string }
  | { type: 'pace'; pace: ClockPace }
  | { type: 'end' };

/** Velocidades del reloj en horas simuladas por segundo real [regla, §3.1]. */
export const CLOCK_RULES = {
  /** Calma: ~1 día cada 2 s. */
  calmHoursPerSecond: 12,
  /** Tiempo normal del viaje: una jornada ≈ 2 min. */
  playHoursPerSecond: 0.2,
  /** La Alerta dura al menos estos segundos reales, aunque la antelación real sea de minutos. */
  alertMinSeconds: 10,
  calmReasonKey: 'hud.alert.calm',
} as const;

export interface MissionClockOptions {
  start: string;
  end: string;
  alerts?: readonly ClockAlert[];
  playWindows?: readonly PlayWindow[];
  playHoursPerSecond?: number;
}

interface TimedAlert extends ClockAlert {
  warnMs: number;
  impactMs: number;
  endMs: number;
}

const timed = (a: ClockAlert): TimedAlert => ({
  ...a,
  warnMs: Date.parse(a.warnAt),
  impactMs: Date.parse(a.impactAt),
  endMs: Date.parse(a.endAt),
});

const SEVERITY: Record<AlertLevel, number> = { calm: 0, alert: 1, impact: 2 };
const isoDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/**
 * Reloj de misión: avanza en horas reales sobre fechas reales. Nunca salta un aviso ni un cambio de día:
 * cada `advance` se corta en esos bordes y devuelve los eventos en orden. Puro y sin Phaser.
 */
export class MissionClock {
  private nowMs: number;
  private readonly endMs: number;
  private alerts: TimedAlert[];
  private readonly windows: { startMs: number; endMs: number }[];
  private readonly playHoursPerSecond: number;
  private readonly resolved = new Set<string>();
  private paused = false;
  private ended = false;
  private lastDay: string;
  private lastLevel: { level: AlertLevel; alertId: string | null };
  private lastPace: ClockPace;

  constructor(options: MissionClockOptions) {
    this.nowMs = Date.parse(options.start);
    this.endMs = Date.parse(options.end);
    if (!(this.endMs > this.nowMs)) throw new Error('MissionClock: el fin debe ser posterior al inicio');
    this.alerts = (options.alerts ?? []).map(timed);
    this.windows = (options.playWindows ?? []).map((w) => ({ startMs: Date.parse(w.start), endMs: Date.parse(w.end) }));
    this.playHoursPerSecond = options.playHoursPerSecond ?? CLOCK_RULES.playHoursPerSecond;
    this.lastDay = isoDay(this.nowMs);
    this.lastLevel = this.currentAlert();
    this.lastPace = this.pace;
  }

  /** Fecha simulada actual (ISO 8601). */
  get simDate(): string {
    return new Date(this.nowMs).toISOString();
  }

  get level(): AlertLevel {
    return this.currentAlert().level;
  }

  /** Clave de traducción del motivo del nivel actual. */
  get reasonKey(): string {
    return this.reasonFor(this.currentAlert());
  }

  get pace(): ClockPace {
    return this.windows.some((w) => this.nowMs >= w.startMs && this.nowMs < w.endMs) ? 'play' : 'fast';
  }

  get isPaused(): boolean {
    return this.paused;
  }

  get finished(): boolean {
    return this.nowMs >= this.endMs;
  }

  /** Horas simuladas por segundo real en este momento. */
  get hoursPerSecond(): number {
    const { level, alertId } = this.currentAlert();
    if (level === 'impact') return this.playHoursPerSecond;
    const base = this.pace === 'play' ? this.playHoursPerSecond : CLOCK_RULES.calmHoursPerSecond;
    if (level === 'calm') return base;
    const alert = this.alerts.find((a) => a.id === alertId)!;
    const leadHours = (alert.impactMs - alert.warnMs) / HOUR_MS;
    return Math.min(base, leadHours / CLOCK_RULES.alertMinSeconds);
  }

  /** El jugador detiene el avance (se abre la planificación) o lo retoma. */
  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  /** Aviso que aparece durante la fase (falla con semilla o salida del rango seguro, §3.4). */
  addAlert(alert: ClockAlert): ClockEvent[] {
    this.alerts = [...this.alerts.filter((a) => a.id !== alert.id), timed(alert)];
    const events: ClockEvent[] = [];
    this.collectTransitions(events);
    return events;
  }

  /** El aviso quedó atendido (p. ej. todos en el refugio): deja de frenar el reloj. */
  resolve(alertId: string): ClockEvent[] {
    this.resolved.add(alertId);
    const events: ClockEvent[] = [];
    this.collectTransitions(events);
    return events;
  }

  advance(realSeconds: number): ClockEvent[] {
    const events: ClockEvent[] = [];
    if (this.paused || this.ended) return events;
    let remaining = realSeconds;
    while (remaining > 1e-9 && this.nowMs < this.endMs) {
      const msPerSecond = this.hoursPerSecond * HOUR_MS;
      const target = this.nowMs + remaining * msPerSecond;
      const boundary = this.nextBoundary();
      if (target < boundary) {
        this.nowMs = target;
        remaining = 0;
      } else {
        remaining -= (boundary - this.nowMs) / msPerSecond;
        this.nowMs = boundary;
      }
      this.collectTransitions(events);
    }
    if (this.nowMs >= this.endMs && !this.ended) {
      this.ended = true;
      events.push({ type: 'end' });
    }
    return events;
  }

  private currentAlert(): { level: AlertLevel; alertId: string | null } {
    let best: { level: AlertLevel; alertId: string | null } = { level: 'calm', alertId: null };
    for (const a of this.alerts) {
      if (this.resolved.has(a.id) || this.nowMs < a.warnMs || this.nowMs >= a.endMs) continue;
      const level: AlertLevel = this.nowMs >= a.impactMs ? 'impact' : 'alert';
      if (SEVERITY[level] > SEVERITY[best.level]) best = { level, alertId: a.id };
    }
    return best;
  }

  private reasonFor({ level, alertId }: { level: AlertLevel; alertId: string | null }): string {
    const alert = this.alerts.find((a) => a.id === alertId);
    return alert ? `${alert.reasonKey}.${level}` : CLOCK_RULES.calmReasonKey;
  }

  private nextBoundary(): number {
    let next = Math.min(this.endMs, Math.floor(this.nowMs / DAY_MS) * DAY_MS + DAY_MS);
    const consider = (t: number) => {
      if (t > this.nowMs && t < next) next = t;
    };
    for (const a of this.alerts) {
      if (this.resolved.has(a.id)) continue;
      consider(a.warnMs);
      consider(a.impactMs);
      consider(a.endMs);
    }
    for (const w of this.windows) {
      consider(w.startMs);
      consider(w.endMs);
    }
    return next;
  }

  private collectTransitions(events: ClockEvent[]): void {
    const day = isoDay(this.nowMs);
    if (day !== this.lastDay) {
      this.lastDay = day;
      events.push({ type: 'day', simDate: day });
    }
    const pace = this.pace;
    if (pace !== this.lastPace) {
      this.lastPace = pace;
      events.push({ type: 'pace', pace });
    }
    const current = this.currentAlert();
    if (current.level !== this.lastLevel.level || current.alertId !== this.lastLevel.alertId) {
      this.lastLevel = current;
      events.push({ type: 'level', level: current.level, reasonKey: this.reasonFor(current), alertId: current.alertId, at: this.simDate });
    }
  }
}
