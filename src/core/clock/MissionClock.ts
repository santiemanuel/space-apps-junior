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
  /** Calma entre jornadas: 1,75 días por segundo (una partida corta dura unos 15 min). */
  calmHoursPerSecond: 42,
  /** Tiempo normal del viaje: una jornada ≈ 1 min. */
  playHoursPerSecond: 0.4,
  /** Jornada sin nada que hacer (tareas al día, sin incidentes): el resto del día pasa en unos segundos. */
  idleHoursPerSecond: 2.5,
  /**
   * Durmiendo en la enfermería: la noche pasa en unos segundos (las alertas despiertan), lo justo para que se vea la
   * pantalla a oscuras con la hora que avanza y el jugador pueda despertarse a mano.
   */
  sleepHoursPerSecond: 3,
  /**
   * El Impacto va a tiempo normal sólo sus primeras horas simuladas (lo que tarda en llegar al refugio): las
   * tormentas reales duran días y, si no, el viaje se hacía eterno. Después sigue a la velocidad de una jornada sin
   * nada que hacer.
   */
  impactSlowHours: 8,
  /** La Alerta dura al menos estos segundos reales, aunque la antelación real sea de minutos. */
  alertMinSeconds: 10,
  /**
   * Segundos reales mínimos entre el fin de un aviso y el comienzo del siguiente: las tormentas reales a veces llegan
   * con pocos días de diferencia y, con el avance rápido, se encadenaban. El reloj se frena lo justo para respetarlo
   * (las fechas reales no cambian). Las tareas que aparecen al azar llenan esa espera, por eso es corta.
   */
  alertGapSeconds: 75,
  calmReasonKey: 'hud.alert.calm',
} as const;

export interface MissionClockOptions {
  start: string;
  end: string;
  alerts?: readonly ClockAlert[];
  playWindows?: readonly PlayWindow[];
  playHoursPerSecond?: number;
  /** Velocidad de una jornada sin nada que hacer (por defecto `CLOCK_RULES.idleHoursPerSecond`). */
  idleHoursPerSecond?: number;
  /** Velocidad mientras se duerme (por defecto `CLOCK_RULES.sleepHoursPerSecond`). */
  sleepHoursPerSecond?: number;
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
  private readonly idleHoursPerSecond: number;
  private readonly sleepHoursPerSecond: number;
  private readonly resolved = new Set<string>();
  private paused = false;
  private idle = false;
  private sleep = false;
  private ended = false;
  private lastDay: string;
  private lastLevel: { level: AlertLevel; alertId: string | null };
  private lastPace: ClockPace;
  /** Segundos reales que faltan para que pueda empezar otro aviso (desde que terminó el último). */
  private quietSeconds = 0;

  constructor(options: MissionClockOptions) {
    this.nowMs = Date.parse(options.start);
    this.endMs = Date.parse(options.end);
    if (!(this.endMs > this.nowMs)) throw new Error('MissionClock: el fin debe ser posterior al inicio');
    this.alerts = (options.alerts ?? []).map(timed);
    this.windows = (options.playWindows ?? []).map((w) => ({ startMs: Date.parse(w.start), endMs: Date.parse(w.end) }));
    this.playHoursPerSecond = options.playHoursPerSecond ?? CLOCK_RULES.playHoursPerSecond;
    this.idleHoursPerSecond = options.idleHoursPerSecond ?? CLOCK_RULES.idleHoursPerSecond;
    this.sleepHoursPerSecond = options.sleepHoursPerSecond ?? CLOCK_RULES.sleepHoursPerSecond;
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

  /** Horas simuladas por segundo real en este momento (con el avance de las jornadas sin nada que hacer). */
  get hoursPerSecond(): number {
    const base = this.baseHoursPerSecond;
    const calm = this.currentAlert().level === 'calm';
    const rate = this.sleep && calm ? Math.max(base, this.sleepHoursPerSecond) : this.idleBoost ? Math.max(base, this.idleHoursPerSecond) : base;
    // Recién terminó un aviso: el próximo no llega antes de `alertGapSeconds` reales.
    const next = calm && this.quietSeconds > 0 ? this.nextWarnMs() : null;
    return next === null ? rate : Math.min(rate, (next - this.nowMs) / HOUR_MS / this.quietSeconds);
  }

  /** Cuándo empieza el próximo aviso pendiente (null si no queda ninguno). */
  private nextWarnMs(): number | null {
    let next: number | null = null;
    for (const a of this.alerts) if (!this.resolved.has(a.id) && a.warnMs > this.nowMs && (next === null || a.warnMs < next)) next = a.warnMs;
    return next;
  }

  /** La jornada corre rápido porque el jugador no tiene nada que hacer (sólo en calma y dentro de una jornada). */
  get idleBoost(): boolean {
    return this.idle && this.pace === 'play' && this.currentAlert().level === 'calm' && this.idleHoursPerSecond > this.playHoursPerSecond;
  }

  /** Velocidad sin el avance de las jornadas sin nada que hacer: calma, jornada, alerta o impacto. */
  get baseHoursPerSecond(): number {
    const { level, alertId } = this.currentAlert();
    if (level === 'impact') {
      const alert = this.alerts.find((a) => a.id === alertId)!;
      const late = (this.nowMs - alert.impactMs) / HOUR_MS >= CLOCK_RULES.impactSlowHours;
      return late ? Math.max(this.playHoursPerSecond, this.idleHoursPerSecond) : this.playHoursPerSecond;
    }
    const base = this.pace === 'play' ? this.playHoursPerSecond : CLOCK_RULES.calmHoursPerSecond;
    if (level === 'calm') return base;
    const alert = this.alerts.find((a) => a.id === alertId)!;
    const leadHours = (alert.impactMs - alert.warnMs) / HOUR_MS;
    return Math.min(base, leadHours / CLOCK_RULES.alertMinSeconds);
  }

  /**
   * Si el jugador no tiene nada que hacer (lo decide la sesión: tareas al día, sin incidentes ni decisiones), la
   * jornada avanza rápido; apenas aparece algo por hacer vuelve al tiempo normal. Las alertas frenan igual.
   */
  setIdle(idle: boolean): void {
    this.idle = idle;
  }

  /** La tripulación duerme hasta mañana (enfermería): el reloj corre muy rápido mientras haya calma. */
  setSleep(sleep: boolean): void {
    this.sleep = sleep;
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
      let used: number;
      if (target < boundary) {
        used = remaining;
        this.nowMs = target;
        remaining = 0;
      } else {
        used = (boundary - this.nowMs) / msPerSecond;
        remaining -= used;
        this.nowMs = boundary;
      }
      this.quietSeconds = Math.max(0, this.quietSeconds - used);
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
      if (current.level === 'calm' && this.lastLevel.level !== 'calm') this.quietSeconds = CLOCK_RULES.alertGapSeconds;
      this.lastLevel = current;
      events.push({ type: 'level', level: current.level, reasonKey: this.reasonFor(current), alertId: current.alertId, at: this.simDate });
    }
  }
}
