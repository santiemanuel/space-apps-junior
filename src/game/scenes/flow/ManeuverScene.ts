import Phaser from 'phaser';
import { CREW_ROSTER } from '../../../content/crew';
import { MANEUVER_RULES, MANEUVERS, maneuverConditions } from '../../../content/maneuvers';
import type { CrewId } from '../../../core/crew/types';
import type { UvIndex } from '../../../core/environment/series';
import type { EventBus } from '../../../core/events/EventBus';
import type { GameEvents } from '../../../core/events/GameEvents';
import { BoardGame, CountdownGame, createFlightGame, FuelGame, PressureGame, RadioGame, SteerGame, type Arrow, type FlightGame, type FlightInput } from '../../../core/maneuvers/flightGames';
import { ManeuverRun, precisionLevel } from '../../../core/maneuvers/ManeuverRun';
import type { ChecklistDecision, ChecklistItem, StageKind } from '../../../core/maneuvers/types';
import type { SystemStatus } from '../../../core/systems/types';
import { galeWeatherOn } from '../../../data/series';
import { VAN_ALLEN } from '../../../data/vanAllen';
import { t, type TranslationKey } from '../../../i18n';
import { SceneKeys } from '../../sceneKeys';
import { addButton, addText, COLOR, fadeIn, LIGHT_COLOR, LIGHT_CSS, listenUntilShutdown, onKeys, pulse, type Button } from '../../ui/ui';
import type { ManeuverSceneData } from '../sceneData';
import { ART_VIEW, FlightArt } from './flightArt';
import { audio } from '../../audio/audio';

/** Teclas de cada minijuego de vuelo ('space' se traduce). */
const HINT_KEYS: Record<StageKind, readonly string[]> = {
  timing: ['space'],
  fuel: ['space'],
  board: ['←', '↑', '↓', '→'],
  countdown: ['space'],
  steer: ['←', '→'],
  pressure: ['space'],
  radio: ['←', '↑', '↓', '→'],
};
import type { SfxId } from '../../audio/themes';

/** Panel translúcido a la derecha, encima de la ilustración: el minijuego de cada etapa y el resultado. */
const OVERLAY = { x: 830, y: 360, width: 430, height: 204 } as const;
const PANEL_TOP = OVERLAY.y;
/** Centro del panel: el cohete queda libre en el medio de la pantalla. */
const PX = OVERLAY.x + OVERLAY.width / 2;
/** Fila de la ayuda (teclas + frase) y sus teclas dibujadas. */
const HINT_Y = OVERLAY.y + 70;
const HINT_KEY_H = 28;
const HINT_PRESS_MS = 700;
/** Cuánto queda encendida la luz de radio que apretó el jugador. */
const RADIO_FLASH_MS = 260;
const BAR = { x: PX - 180, y: OVERLAY.y + 120, width: 360, height: 26 } as const;
/** Panel del checklist, a la derecha (el cohete queda a la vista). */
const CHECK = { x: 838, y: 90, width: 420 } as const;
const FUEL = { x: 1050, y: 30, width: 200, height: 12 } as const;
/** Pausa antes de que empiece cada minijuego y tiempo para leer su resultado (ms). */
const READY_MS = 700;
const FEEDBACK_MS = 1500;
/** Después de la ignición: el despegue se ve un rato antes de la etapa siguiente (ms). */
const LIFTOFF_MS = 6000;
const NAMES = Object.fromEntries(CREW_ROSTER.map((c) => [c.id, c.name])) as Record<CrewId, string>;
const PRECISION_LIGHT: Record<ReturnType<typeof precisionLevel>, SystemStatus> = { great: 'green', good: 'yellow', rough: 'red' };
const ARROW_GLYPH: Record<Arrow, string> = { up: '↑', down: '↓', left: '←', right: '→' };
/** Luces de la prueba de radio: cada flecha con su color. */
const RADIO_LIGHTS: Record<Arrow, number> = { up: 0x68d391, left: 0x63b3ed, down: 0xf6e05e, right: 0xfc8181 };
/** Tono de cada luz de la prueba de radio (abajo grave … arriba agudo). */
const RADIO_TONE = { up: 'radioUp', left: 'radioLeft', down: 'radioDown', right: 'radioRight' } as const satisfies Record<Arrow, SfxId>;
/** Canales de loop de la maniobra (se apagan al salir). */
const LOOP_CHANNELS = ['fuel', 'roar', 'pad', 'plasma'] as const;
/** Sonido de cada preparativo de la cuenta regresiva. */
const MILESTONE_SOUND: Partial<Record<string, SfxId>> = { armRetract: 'serviceArm', mastRetract: 'serviceArm', engineStart: 'engineStart' };
type KeyName = 'LEFT' | 'RIGHT' | 'UP' | 'DOWN' | 'A' | 'D' | 'W' | 'S' | 'SPACE';

/** Lo que se repinta en cada cuadro según el minijuego de la etapa. */
interface StageWidgets {
  feedback: Phaser.GameObjects.Text;
  marker?: Phaser.GameObjects.Rectangle;
  fuelFill?: Phaser.GameObjects.Rectangle;
  needle?: Phaser.GameObjects.Rectangle;
  steerTime?: Phaser.GameObjects.Rectangle;
  arrows?: { box: Phaser.GameObjects.Rectangle; glyph: Phaser.GameObjects.Text }[];
  countdown?: Phaser.GameObjects.Text;
  pressureFill?: Phaser.GameObjects.Rectangle;
  pressureTime?: Phaser.GameObjects.Rectangle;
  lights?: { arrow: Arrow; lamp: Phaser.GameObjects.Rectangle; glyph: Phaser.GameObjects.Text }[];
  radioDots?: Phaser.GameObjects.Arc[];
  radioState?: Phaser.GameObjects.Text;
}

/**
 * Maniobra (§4.0) como escena de vuelo de ~30 s a 1 min 30 s: arriba, la ilustración animada (abordaje, cuenta regresiva,
 * despegue, paracaídas…); abajo, el checklist Go / No-Go y un minijuego por etapa: cargar combustible, abordar,
 * presurizar, prueba de radio, cuenta regresiva, pilotar o apretar en el momento justo. Los despegues empiezan con
 * una escena de entrada (la tripulación llega a la plataforma) y terminan con el despegue a la vista. Lo bien que salen define el combustible que se gasta.
 * Las reglas viven en `ManeuverRun` y en `flightGames`; la escena sólo pinta y lee la entrada.
 */
export class ManeuverScene extends Phaser.Scene {
  private data_!: ManeuverSceneData;
  private run!: ManeuverRun;
  private art!: FlightArt;
  private view!: Phaser.GameObjects.Container;
  private fuelFill!: Phaser.GameObjects.Rectangle;
  private header!: { title: Phaser.GameObjects.Text; narrator: Phaser.GameObjects.Text; fuel: Phaser.GameObjects.Text };
  private widgets: StageWidgets | null = null;
  private flightGame: FlightGame | null = null;
  private hint: { g: Phaser.GameObjects.Graphics; caps: { text: Phaser.GameObjects.Text; x: number; width: number }[] } | null = null;
  private radioFlash: { arrow: Arrow; good: boolean; until: number } | null = null;
  private gameStage = -1;
  private keys!: Record<KeyName, Phaser.Input.Keyboard.Key>;
  private checklist = { row: 0, option: 0, rows: [] as { buttons: Button[]; status: Phaser.GameObjects.Text }[], start: null as Button | null };
  private result: Button | null = null;
  private readyAt = 0;
  private completed = false;
  /** Último paso pintado, para animar sólo los cambios de paso. */
  private lastView = '';
  private dustUv: UvIndex | null = null;
  /** Escena de entrada de los despegues en curso (el checklist espera). */
  private intro = false;
  /** Último número de la cuenta regresiva visto (para los preparativos y el tic). */
  private lastCount: number | null = null;
  /** Última luz de la prueba de radio que sonó, y si ya sonó la presurización de esta etapa. */
  private lastLight: Arrow | null = null;
  private pressurized = false;

  constructor() {
    super(SceneKeys.Maneuver);
  }

  init(data: ManeuverSceneData): void {
    this.lastView = '';
    this.data_ = data;
    // Polvo real del día en Gale (REMS) para el aterrizaje.
    this.dustUv = data.maneuverId === 'landing' ? galeWeatherOn(data.state.simDate).uv : null;
    this.run = new ManeuverRun(MANEUVERS[data.maneuverId], data.state, MANEUVER_RULES, maneuverConditions(data.maneuverId, data.state, this.dustUv));
    this.completed = false;
    this.widgets = null;
    this.flightGame = null;
    this.gameStage = -1;
    this.result = null;
    this.intro = false;
    this.lastCount = null;
  }

  create(): void {
    this.art = new FlightArt(this, this.data_.maneuverId);
    // Vuelta a la Tierra: quién sale caminando y quién en camilla del barco de rescate.
    this.art.setArrival(this.run.crewArrival);
    this.header = {
      title: addText(this, 24, 22, 22, COLOR.title).setOrigin(0, 0.5),
      narrator: addText(this, 24, 40, 13, COLOR.text, { wordWrap: { width: 980 } }),
      fuel: addText(this, FUEL.x, FUEL.y - 18, 12, COLOR.muted),
    };
    const fuelBack = this.add.rectangle(FUEL.x, FUEL.y, FUEL.width, FUEL.height, 0x2d3748).setOrigin(0, 0);
    this.fuelFill = this.add.rectangle(FUEL.x, FUEL.y, FUEL.width, FUEL.height, 0xf6ad55).setOrigin(0, 0);
    const frame = this.add.rectangle(0, 0, ART_VIEW.width, 72, 0x05070d, 0.55).setOrigin(0, 0);
    this.view = this.add.container(0, 0);
    this.art.ignoreUi([this.header.title, this.header.narrator, this.header.fuel, fuelBack, this.fuelFill, frame, this.view]);
    this.keys = this.input.keyboard!.addKeys('LEFT,RIGHT,UP,DOWN,A,D,W,S,SPACE') as Record<KeyName, Phaser.Input.Keyboard.Key>;

    onKeys(this, (code) => this.onKey(code));
    listenUntilShutdown(this, this.input, 'pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (this.intro) return this.art.skipIntro();
      if (this.run.step !== 'stage' || over.length) return;
      if (this.kind === 'timing') this.press();
      else this.pointerPressed = true;
    });
    listenUntilShutdown(this, this.events, Phaser.Scenes.Events.RESUME, () => this.rebuild());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => LOOP_CHANNELS.forEach((channel) => audio.loop(channel, null)));
    this.intro = this.art.playIntro(() => {
      this.intro = false;
      this.rebuild();
    });
    this.devJump();
    this.rebuild();
  }

  /**
   * Sólo en `npm run dev`: `&stage=N` salta la entrada y el checklist y deja la maniobra en la etapa N (desde 0; con
   * un número grande, en el resultado), y `&score=0` hace que las etapas salteadas salgan mal. Para capturar cada
   * prueba en su peor caso sin jugarla.
   */
  private devJump(): void {
    const params = import.meta.env.DEV ? new URLSearchParams(window.location.search) : null;
    const target = Number(params?.get('stage') ?? NaN);
    if (!params || !Number.isFinite(target)) return;
    const score = Number(params.get('score') ?? 0.9);
    const { run } = this;
    if (this.intro) this.art.skipIntro();
    this.intro = false;
    for (const item of run.items) run.decide(item.systemId, item.status === 'green' ? 'go' : 'risk');
    run.start();
    while (run.step === 'stage' && run.stageIndex < target) {
      this.art.setStage(run.stage!.id);
      if ((run.stage!.kind ?? 'timing') === 'timing') run.press();
      else run.complete(score);
      this.art.outcome(run.stage!.id);
      run.next();
    }
  }

  update(time: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    const ready = this.run.step === 'stage' && time >= this.readyAt;
    if (ready && this.kind === 'timing') this.run.update(dt);
    if (ready && this.flightGame && !this.flightGame.done) {
      const input = this.readInput();
      const game = this.flightGame;
      if (game instanceof CountdownGame && !game.final && input.pressed.action && this.widgets) this.widgets.feedback.setText(t('maneuvers.game.countdown.wait')).setColor(COLOR.muted);
      const answering = game instanceof RadioGame && game.phase === 'input';
      game.update(dt, input);
      if (answering && game instanceof RadioGame && input.pressed.arrow && game.message) this.radioFlash = { arrow: input.pressed.arrow, good: game.message.good, until: time + RADIO_FLASH_MS };
      if (game instanceof PressureGame && input.held.action && !this.pressurized) {
        this.pressurized = true;
        audio.sfx('cabinPressurize', 1, 0.8);
      }
      audio.loop('fuel', game instanceof FuelGame && !game.done && input.held.action ? 'fuelFlow' : null);
      if (game.done) this.completeGame();
    }
    this.paintWidgets();
    this.paintHint(time);
    this.art.update(dt, this.artFrame());
    this.fuelFill.setScale(this.run.step === 'done' ? this.run.finalFuel : this.run.fuel, 1);
  }

  private get bus(): EventBus<GameEvents> {
    return this.data_.bus;
  }

  private get kind() {
    return this.run.stage?.kind ?? 'timing';
  }

  /** Clic sobre la escena (fuera de los botones) desde el último cuadro: cuenta como apretar Espacio. */
  private pointerPressed = false;

  private takePointerPress(): boolean {
    const pressed = this.pointerPressed;
    this.pointerPressed = false;
    return pressed;
  }

  private readInput(): FlightInput {
    const k = this.keys;
    const pointer = this.input.activePointer;
    const just = (key: Phaser.Input.Keyboard.Key) => Phaser.Input.Keyboard.JustDown(key);
    const arrow: Arrow | null = just(k.UP) || just(k.W) ? 'up' : just(k.DOWN) || just(k.S) ? 'down' : just(k.LEFT) || just(k.A) ? 'left' : just(k.RIGHT) || just(k.D) ? 'right' : null;
    return {
      held: { left: k.LEFT.isDown || k.A.isDown, right: k.RIGHT.isDown || k.D.isDown, action: k.SPACE.isDown || pointer.isDown },
      pressed: { action: just(k.SPACE) || this.takePointerPress(), arrow },
    };
  }

  /** Vuelve a pintar el paso actual (también al volver de la pausa, por si cambió el idioma). */
  private rebuild(): void {
    const id = this.data_.maneuverId;
    this.header.title.setText(t(`maneuvers.name.${id}`));
    this.header.fuel.setText(t('maneuvers.fuel'));
    this.view.removeAll(true);
    if (this.intro && (id === 'ascent' || id === 'marsAscent')) {
      this.widgets = null;
      this.header.narrator.setText(`${t(`maneuvers.cinematic.${id}`)}  ·  ${t('maneuvers.cinematic.skip')}`);
      return;
    }
    const dust = this.dustUv === 'Low' || this.dustUv === 'Moderate' ? ` ${t(`maneuvers.dust.${this.dustUv}`)}` : '';
    const current = this.run.step === 'stage' || this.run.step === 'feedback' ? this.run.stage : undefined;
    this.header.narrator.setText(
      current ? t(`maneuvers.stage.${id}.${current.id}.fact` as TranslationKey) : `${t('maneuvers.narrator')}: ${t(`maneuvers.intro.${id}`)}${dust}`,
    );
    this.widgets = null;
    this.result = null;
    this.checklist.rows = [];
    this.checklist.start = null;
    const glass = this.add.graphics().fillStyle(0x0b1220, 0.78);
    if (this.run.step === 'checklist') glass.fillRoundedRect(CHECK.x, CHECK.y, CHECK.width, 110 + this.run.items.length * 48 + 74, 14);
    else glass.fillRoundedRect(OVERLAY.x, OVERLAY.y, OVERLAY.width, OVERLAY.height, 14);
    this.view.add(glass);
    if (this.run.step === 'checklist') this.showChecklist();
    else if (this.run.step === 'done') this.showResult();
    else this.showStage();
    // Transición sólo al pasar del checklist a una etapa, de una etapa a otra o al resultado.
    const view = this.run.step === 'feedback' ? `stage:${this.run.stageIndex}` : `${this.run.step}:${this.run.stageIndex}`;
    if (view !== this.lastView) fadeIn(this, this.view, { duration: 260, rise: 12 });
    this.lastView = view;
  }

  // --- Checklist Go / No-Go ---

  private options(item: ChecklistItem): ChecklistDecision[] {
    if (item.decision) return [];
    return item.status === 'green' ? ['go'] : ['repair', 'risk'];
  }

  private showChecklist(): void {
    const { run, view } = this;
    const left = CHECK.x + 18;
    const right = CHECK.x + CHECK.width - 18;
    view.add([
      addText(this, left, CHECK.y + 22, 18, COLOR.text).setOrigin(0, 0.5).setText(t('maneuvers.checklist.title')),
      addText(this, right, CHECK.y + 22, 12, COLOR.muted).setOrigin(1, 0.5).setText(t('maneuvers.checklist.spares', { count: run.spares })),
      addText(this, left, CHECK.y + 40, 12, COLOR.muted, { wordWrap: { width: CHECK.width - 36 } }).setText(t('maneuvers.checklist.hint')),
    ]);
    const top = CHECK.y + 110;
    run.items.forEach((item, index) => {
      const y = top + index * 48;
      view.add(this.add.circle(left + 8, y - 8, 7, LIGHT_COLOR[item.status]));
      view.add(addText(this, left + 22, y - 8, 14).setOrigin(0, 0.5).setText(t(`common.system.${item.systemId}`)));
      // El resultado de cada decisión va en el renglón de abajo (donde estaban los botones): al lado del nombre se encimaba.
      const status = addText(this, right, y + 12, 12, COLOR.muted).setOrigin(1, 0.5);
      view.add(status);
      const buttons = this.options(item).map((decision, option, all) => {
        const x = right - (all.length - 1 - option) * 170 - 76;
        const button = addButton(this, x, y + 12, () => this.decide(index, decision), { size: 12, onHover: () => this.focusChecklist(index, option) }).setLabel(
          this.decisionLabel(item, decision),
        );
        if (decision === 'repair' && !run.canRepair(item.systemId)) button.setEnabled(false).setLabel(t('maneuvers.checklist.noSpares'));
        view.add(button.text);
        return button;
      });
      if (item.decision) status.setText(t(`maneuvers.checklist.done.${item.decision}`)).setColor(item.decision === 'risk' ? COLOR.warn : COLOR.ok);
      this.checklist.rows.push({ buttons, status });
    });
    const startY = top + run.items.length * 48 + 14;
    const start = addButton(this, CHECK.x + CHECK.width / 2, startY, () => this.startStages(), { size: 15, onHover: () => this.focusChecklist(run.items.length, 0) })
      .setLabel(t(run.checklistReady ? 'maneuvers.checklist.start' : 'maneuvers.checklist.pending'))
      .setEnabled(run.checklistReady);
    this.checklist.start = start;
    view.add([start.text, addText(this, CHECK.x + CHECK.width / 2, startY + 22, 11, COLOR.dim, { align: 'center', wordWrap: { width: CHECK.width - 30 } }).setOrigin(0.5, 0).setText(t('maneuvers.checklist.controls'))]);
    const firstPending = run.items.findIndex((item) => !item.decision);
    this.focusChecklist(firstPending === -1 ? run.items.length : firstPending, 0);
  }

  private decisionLabel(item: ChecklistItem, decision: ChecklistDecision): string {
    if (decision !== 'repair') return t(`maneuvers.checklist.${decision}`);
    const cost = this.run.repairCost(item.systemId);
    return cost === 1 ? t('maneuvers.checklist.repair.one') : t('maneuvers.checklist.repair.many', { cost });
  }

  private focusChecklist(row: number, option: number): void {
    const { rows, start } = this.checklist;
    this.checklist.row = row;
    this.checklist.option = option;
    rows.forEach((r, i) => r.buttons.forEach((b, j) => b.setFocused(i === row && j === option)));
    start?.setFocused(row === rows.length);
  }

  private decide(index: number, decision: ChecklistDecision): void {
    const item = this.run.items[index];
    if (!item || !this.run.decide(item.systemId, decision)) return;
    if (decision === 'repair') audio.sfx('checklistRepair');
    this.rebuild();
  }

  private moveChecklist(delta: number): void {
    const { rows } = this.checklist;
    let row = this.checklist.row;
    for (let i = 0; i <= rows.length; i++) {
      row = (row + delta + rows.length + 1) % (rows.length + 1);
      if (row === rows.length || rows[row]!.buttons.length > 0) break;
    }
    this.focusChecklist(row, 0);
  }

  private activateChecklist(): void {
    const { row, option, rows } = this.checklist;
    if (row === rows.length) return this.startStages();
    const button = rows[row]?.buttons[option];
    if (button?.enabled) button.text.emit('pointerdown');
  }

  private startStages(): void {
    if (this.run.start()) {
      this.readyAt = this.time.now + READY_MS;
      this.rebuild();
    }
  }

  // --- Etapas: un minijuego por etapa ---

  private showStage(): void {
    const { run, view } = this;
    const stage = run.stage!;
    const id = run.definition.id;
    const total = run.definition.stages.length;
    const kind = this.kind;
    if (run.step === 'stage' && this.gameStage !== run.stageIndex) {
      this.gameStage = run.stageIndex;
      this.flightGame = kind === 'timing' ? null : createFlightGame(kind, run.stageSeed, run.stageFactor, { from: stage.from });
      this.lastCount = null;
      this.lastLight = null;
      this.pressurized = false;
      if (stage.id === 'entry' || stage.id === 'orientShield' || stage.id === 'reentry') audio.loop('plasma', 'reentryRumble', 0.6);
      this.art.setStage(stage.id);
    }
    view.add([
      addText(this, OVERLAY.x + OVERLAY.width - 16, PANEL_TOP + 18, 12, COLOR.muted).setOrigin(1, 0.5).setText(t('maneuvers.stage.counter', { current: run.stageIndex + 1, total })),
      addText(this, PX, PANEL_TOP + 40, 18, COLOR.text).setOrigin(0.5).setText(t(`maneuvers.stage.${id}.${stage.id}` as TranslationKey)),
    ]);
    this.addControlHint(kind);
    run.definition.stages.forEach((_s, i) => {
      const done = run.outcomes[i];
      const color = done ? LIGHT_COLOR[PRECISION_LIGHT[precisionLevel(done.precision)]] : i === run.stageIndex ? 0xffffff : 0x4a5568;
      view.add(this.add.circle(OVERLAY.x + 20 + i * 18, PANEL_TOP + 18, 6, color));
    });
    // El resultado va abajo de todo, con lugar para dos renglones (en inglés algunas frases son más largas).
    const feedback = addText(this, PX, PANEL_TOP + 160, 13, COLOR.ok, { align: 'center', wordWrap: { width: OVERLAY.width - 36 } }).setOrigin(0.5, 0);
    view.add(feedback);
    this.widgets = { feedback, ...this.buildGameWidgets(kind) };
  }

  /** Ayuda corta: las teclas dibujadas como en las salas de la nave y una frase mínima al lado. */
  private addControlHint(kind: StageKind): void {
    this.hint = null;
    // En la prueba de memoria, las teclas animadas distraen de la secuencia de luces.
    if (kind === 'radio') return;
    const labels = HINT_KEYS[kind].map((k) => (k === 'space' ? t('maneuvers.game.key.space') : k));
    const caps = labels.map((label) => {
      const text = addText(this, 0, 0, 14, '#1a202c').setOrigin(0.5).setText(label);
      return { text, x: 0, width: Math.max(32, Math.ceil(text.width) + 24) };
    });
    const help = addText(this, 0, 0, 15, COLOR.focus).setOrigin(0, 0.5).setText(t(`maneuvers.game.${kind}.help`));
    const keysWidth = caps.reduce((sum, c) => sum + c.width + 8, -8);
    let x = Math.round(PX - (keysWidth + 14 + help.width) / 2);
    for (const cap of caps) {
      cap.x = x;
      x += cap.width + 8;
    }
    help.setPosition(x + 6, HINT_Y);
    const g = this.add.graphics();
    this.view.add([g, ...caps.map((c) => c.text), help]);
    this.hint = { g, caps };
    this.paintHint(this.time.now);
  }

  /** Las teclas de la ayuda se aprietan solas, una por vez, para que se vea qué hay que hacer. */
  private paintHint(now: number): void {
    const hint = this.hint;
    if (!hint?.g.active) return;
    const { g, caps } = hint;
    const turn = Math.floor(now / HINT_PRESS_MS);
    const pressed = now % HINT_PRESS_MS < HINT_PRESS_MS * 0.35 ? turn % caps.length : -1;
    g.clear();
    caps.forEach(({ text, x, width }, i) => {
      const down = i === pressed ? 3 : 0;
      const top = HINT_Y - HINT_KEY_H / 2;
      g.fillStyle(0x05070d).fillRect(x - 2, top - 2, width + 4, HINT_KEY_H + 4);
      g.fillStyle(0x9c4221).fillRect(x, top + HINT_KEY_H - 4, width, 4);
      g.fillStyle(down ? 0xed8936 : 0xf6ad55).fillRect(x, top + down, width, HINT_KEY_H - 4);
      if (!down) g.fillStyle(0xfbd38d).fillRect(x, top, width, 3);
      text.setPosition(x + width / 2, HINT_Y - 1 + down);
    });
  }

  private buildGameWidgets(kind: StageKind): Omit<StageWidgets, 'feedback'> {
    const { view, run } = this;
    const track = (width: number) => this.add.rectangle(PX - width / 2, BAR.y, width, BAR.height, 0x1a202c).setOrigin(0, 0.5).setStrokeStyle(2, 0x4a5568);
    if (kind === 'timing') {
      const zone = run.zone!;
      view.add([track(BAR.width), this.add.rectangle(BAR.x + zone.center * BAR.width, BAR.y, zone.width * BAR.width, BAR.height - 6, 0x48bb78, 0.85)]);
      const marker = this.add.rectangle(BAR.x, BAR.y, 6, BAR.height + 20, 0xffffff);
      view.add(marker);
      return { marker };
    }
    const game = this.flightGame!;
    /**
     * Barra con su rótulo a la izquierda (tanque, presión): el rótulo queda dentro del panel y la barra ocupa lo que
     * sobra, así no se corta en ningún idioma.
     */
    const labeled = (key: 'maneuvers.game.fuel.tank' | 'maneuvers.game.pressure.gauge') => {
      const label = addText(this, OVERLAY.x + 16, BAR.y, 13, COLOR.muted).setOrigin(0, 0.5).setText(t(key));
      const x = Math.ceil(OVERLAY.x + 16 + label.width + 10);
      const width = OVERLAY.x + OVERLAY.width - 18 - x;
      const back = this.add.rectangle(x, BAR.y, width, BAR.height, 0x1a202c).setOrigin(0, 0.5).setStrokeStyle(2, 0x4a5568);
      return { label, back, x, width };
    };
    if (game instanceof FuelGame) {
      const { center, width } = game.target;
      const bar = labeled('maneuvers.game.fuel.tank');
      const fuelFill = this.add.rectangle(bar.x, BAR.y, bar.width, BAR.height - 8, 0xf6ad55).setOrigin(0, 0.5).setScale(0, 1);
      view.add([
        bar.back,
        this.add.rectangle(bar.x + center * bar.width, BAR.y, width * bar.width, BAR.height + 6, 0x48bb78, 0.45).setStrokeStyle(2, 0x68d391),
        fuelFill,
        bar.label,
      ]);
      return { fuelFill };
    }
    if (game instanceof BoardGame) {
      const size = 40;
      const left = PX - (game.sequence.length * (size + 10) - 10) / 2;
      const arrows = game.sequence.map((a, i) => {
        const box = this.add.rectangle(left + i * (size + 10), BAR.y, size, size, 0x1e293b).setOrigin(0, 0.5).setStrokeStyle(2, 0x475569);
        const glyph = addText(this, left + i * (size + 10) + size / 2, BAR.y, 24).setOrigin(0.5).setText(ARROW_GLYPH[a]);
        view.add([box, glyph]);
        return { box, glyph };
      });
      return { arrows };
    }
    if (game instanceof CountdownGame) {
      const countdown = addText(this, PX, BAR.y, 32, COLOR.focus).setOrigin(0.5);
      view.add(countdown);
      return { countdown };
    }
    if (game instanceof PressureGame) {
      const { center, width } = game.target;
      const bar = labeled('maneuvers.game.pressure.gauge');
      const pressureFill = this.add.rectangle(bar.x, BAR.y, bar.width, BAR.height - 8, 0x63b3ed).setOrigin(0, 0.5).setScale(0, 1);
      const pressureTime = this.add.rectangle(bar.x, BAR.y + 24, bar.width, 4, 0x63b3ed).setOrigin(0, 0.5).setScale(0, 1);
      view.add([
        bar.back,
        this.add.rectangle(bar.x + center * bar.width, BAR.y, width * bar.width, BAR.height + 6, 0x48bb78, 0.45).setStrokeStyle(2, 0x68d391),
        pressureFill,
        pressureTime,
        bar.label,
      ]);
      return { pressureFill, pressureTime };
    }
    if (game instanceof RadioGame) {
      const size = 40;
      // La misma T invertida del teclado al escuchar y al repetir la secuencia.
      const positions: { arrow: Arrow; column: number; row: number }[] = [
        { arrow: 'left', column: 0, row: 1 },
        { arrow: 'down', column: 1, row: 1 },
        { arrow: 'right', column: 2, row: 1 },
        { arrow: 'up', column: 1, row: 0 },
      ];
      const left = PX - 150;
      const lights = positions.map(({ arrow, column, row }) => {
        const x = left + column * (size + 10);
        const y = BAR.y - 36 + row * (size + 10);
        const lamp = this.add.rectangle(x, y, size, size, RADIO_LIGHTS[arrow], 0.25).setOrigin(0, 0.5).setStrokeStyle(2, 0x475569);
        const glyph = addText(this, x + size / 2, y, 22).setOrigin(0.5).setText(ARROW_GLYPH[arrow]);
        view.add([lamp, glyph]);
        return { arrow, lamp, glyph };
      });
      const statusX = PX + 102;
      const radioDots = game.sequence.map((_a, i) => this.add.circle(statusX + (i - (game.sequence.length - 1) / 2) * 16, BAR.y - 24, 5, 0x4a5568));
      // Consigna al costado de las flechas: con su ancho máximo, entra en dos renglones en los dos idiomas.
      const radioState = addText(this, statusX, BAR.y + 8, 12, COLOR.muted, { align: 'center', wordWrap: { width: 2 * (OVERLAY.x + OVERLAY.width - 14 - statusX) } }).setOrigin(0.5);
      view.add([...radioDots, radioState]);
      return { lights, radioDots, radioState };
    }
    const steer = game as SteerGame;
    const width = 360;
    const needle = this.add.rectangle(PX, BAR.y, 6, BAR.height + 16, 0xffffff);
    const steerTime = this.add.rectangle(PX - width / 2, BAR.y + 24, width, 4, 0x63b3ed).setOrigin(0, 0.5).setScale(0, 1);
    view.add([track(width), this.add.rectangle(PX, BAR.y, steer.zone * width, BAR.height - 6, 0x48bb78, 0.85), needle, steerTime]);
    return { needle, steerTime };
  }

  /** Repinta lo que se mueve del minijuego en curso. */
  private paintWidgets(): void {
    const w = this.widgets;
    if (!w) return;
    if (w.marker) w.marker.setX(BAR.x + this.run.marker * BAR.width);
    const game = this.flightGame;
    if (!game) return;
    if (w.fuelFill && game instanceof FuelGame) w.fuelFill.setScale(game.level, 1);
    if (w.needle && game instanceof SteerGame) {
      w.needle.setX(PX + game.position * 180);
      w.steerTime?.setScale(game.progress, 1);
    }
    if (w.arrows && game instanceof BoardGame) {
      w.arrows.forEach(({ box, glyph }, i) => {
        const done = i < game.index;
        const current = i === game.index && !game.done;
        box.setFillStyle(done ? 0x276749 : current ? 0x2d3748 : 0x1e293b).setStrokeStyle(current ? 3 : 2, done ? 0x68d391 : current ? 0xfbd38d : 0x475569);
        glyph.setColor(done ? COLOR.ok : current ? COLOR.focus : COLOR.dim);
      });
    }
    if (w.pressureFill && game instanceof PressureGame) {
      w.pressureFill.setScale(game.pressure, 1).setFillStyle(game.inTarget ? 0x68d391 : 0x63b3ed);
      w.pressureTime?.setScale(game.progress, 1);
    }
    if (w.lights && game instanceof RadioGame) {
      const lit = game.showing;
      if (lit && lit !== this.lastLight) audio.sfx(RADIO_TONE[lit]);
      this.lastLight = lit;
      const flash = this.radioFlash && this.time.now < this.radioFlash.until ? this.radioFlash : null;
      w.lights.forEach(({ arrow, lamp, glyph }) => {
        const pressed = flash?.arrow === arrow;
        const on = arrow === lit || pressed;
        const edge = pressed ? (flash.good ? 0x68d391 : 0xf56565) : on ? 0xffffff : 0x475569;
        lamp.setFillStyle(pressed && !flash.good ? 0xe53e3e : RADIO_LIGHTS[arrow], on ? 1 : game.phase === 'input' ? 0.45 : 0.2).setStrokeStyle(on ? 4 : 2, edge);
        glyph.setColor(on ? '#1a202c' : COLOR.text);
      });
      w.radioDots?.forEach((dot, i) => dot.setFillStyle(i < game.index ? 0x68d391 : 0x4a5568));
      w.radioState?.setText(t(game.phase === 'show' ? 'maneuvers.game.radio.listen' : 'maneuvers.game.radio.answer'));
    }
    if (w.countdown && game instanceof CountdownGame) {
      if (game.count !== this.lastCount) {
        this.lastCount = game.count;
        if (!game.done && game.final) audio.sfx('tick', game.count === 0 ? 1.5 : 1);
        const milestone = this.run.stage?.milestones?.find((m) => m.at === game.count);
        if (milestone && !game.done) {
          this.art.milestone(milestone.id);
          const sound = MILESTONE_SOUND[milestone.id];
          if (sound) audio.sfx(sound);
          if (milestone.id === 'water') audio.loop('pad', 'padWater', 0.6);
          if (milestone.id === 'dust') audio.loop('pad', 'dustStorm', 0.45);
        }
      }
      w.countdown.setText(game.done || game.count === 0 ? t('maneuvers.game.countdown.ignition') : t('maneuvers.game.countdown.number', { n: game.count }));
    }
    if (game.message && !game.done && w.feedback.getData('message') !== game.message) {
      w.feedback.setData('message', game.message);
      // La respuesta correcta en la prueba de radio suena con el tono de su luz.
      if (game instanceof RadioGame && game.message.key === 'right') audio.sfx(RADIO_TONE[game.sequence[game.index - 1]!]);
      // Abordaje: cada flecha bien es un cinturón que se abrocha.
      if (game instanceof BoardGame && game.message.key === 'right') audio.sfx(game.index % 2 ? 'seatbeltClick01' : 'seatbeltClick02');
      if ((game instanceof BoardGame || game instanceof RadioGame) && game.message.key === 'wrong') audio.sfx('flightMiss', 1, 0.6);
      w.feedback.setText(t(`maneuvers.game.${game.kind}.${game.message.key}` as TranslationKey)).setColor(game.message.good ? COLOR.ok : COLOR.warn);
      pulse(this, w.feedback, { scale: 1.12, duration: 160 });
    }
  }

  private artFrame() {
    const game = this.run.step === 'stage' ? this.flightGame : null;
    return {
      boarding: game instanceof BoardGame ? game.index / game.sequence.length : this.run.stageIndex > this.boardIndex() ? 1 : undefined,
      countdown: game instanceof CountdownGame && !game.done ? game.count : null,
      ...(game instanceof SteerGame ? { steer: game.position } : {}),
      radio: game instanceof RadioGame && game.showing !== null,
      pressureOk: game instanceof PressureGame && game.inTarget,
    };
  }

  private boardIndex(): number {
    const index = this.run.definition.stages.findIndex((s) => s.kind === 'board');
    return index === -1 ? Infinity : index;
  }

  /** Terminó un minijuego: su puntaje pasa a la maniobra (combustible) y la ilustración reacciona. */
  private completeGame(): void {
    const game = this.flightGame!;
    audio.loop('fuel', null);
    const outcome = this.run.complete(game.score);
    if (!outcome || !this.widgets) return;
    this.bus.emit('maneuver:stage', { maneuverId: this.data_.maneuverId, stage: outcome.stageId, hit: outcome.hit });
    const message = game.message!;
    audio.sfx(!message.good ? 'flightMiss' : game instanceof BoardGame ? 'suitConnect' : 'flightConfirm');
    this.widgets.feedback.setText(t(`maneuvers.game.${game.kind}.${message.key}` as TranslationKey)).setColor(message.good ? COLOR.ok : COLOR.warn);
    pulse(this, this.widgets.feedback, { scale: message.good ? 1.25 : 1.1, duration: 220 });
    this.afterOutcome(outcome.stageId);
  }

  private press(): void {
    if (this.time.now < this.readyAt) return;
    const outcome = this.run.press();
    if (!outcome || !this.widgets) return;
    this.bus.emit('maneuver:stage', { maneuverId: this.data_.maneuverId, stage: outcome.stageId, hit: outcome.hit });
    const key = !outcome.hit ? 'maneuvers.stage.miss' : outcome.precision >= 0.9 ? 'maneuvers.stage.perfect' : 'maneuvers.stage.hit';
    audio.sfx(outcome.hit ? 'flightConfirm' : 'flightMiss');
    this.widgets.feedback.setText(t(key)).setColor(outcome.hit ? COLOR.ok : COLOR.warn);
    pulse(this, this.widgets.feedback, { scale: outcome.hit ? 1.25 : 1.1, duration: 220 });
    this.afterOutcome(outcome.stageId);
  }

  private afterOutcome(stageId: string): void {
    this.art.outcome(stageId);
    if (stageId === 'countdown') {
      audio.sfx('ignition');
      audio.loop('roar', 'launchRoar');
      audio.loop('pad', null);
      if (this.data_.maneuverId === 'ascent') audio.sfx('crowdCheer', 1, 0.7);
    }
    if (stageId === 'entry' || stageId === 'orientShield' || stageId === 'reentry') audio.loop('plasma', null);
    if (stageId === 'descentEngines') this.time.delayedCall(700, () => audio.sfx('marsTouchdown'));
    if (stageId === 'orbitInsertion') this.time.delayedCall(2200, () => audio.sfx('marsDocking'));
    // Llega a la órbita: se apaga el rugido de los motores.
    if (stageId === 'stageSeparation' || stageId === 'orbitInsertion') audio.loop('roar', null);
    if (stageId === 'parachute') audio.sfx('parachute');
    if (stageId === 'splashdown') audio.sfx('splashdown');
    if (stageId === 'stageSeparation') audio.sfx('stageSeparation');
    if (stageId === 'boosterSeparation') audio.sfx('boosterSeparation');
    if (stageId === 'heatShieldSeparation') audio.sfx('heatShieldRelease');
    const liftoff = stageId === 'countdown';
    if (liftoff) this.header.narrator.setText(t('maneuvers.cinematic.liftoff'));
    this.time.delayedCall(liftoff ? LIFTOFF_MS : FEEDBACK_MS, () => {
      this.run.next();
      this.readyAt = this.time.now + READY_MS;
      this.rebuild();
    });
  }

  // --- Resultado ---

  private showResult(): void {
    const { run, view } = this;
    const level = precisionLevel(run.precision);
    const lines: string[] = [];
    const effect = run.definition.effect;
    if (effect === 'landingDistance') lines.push(t('maneuvers.result.landing', { km: run.landingDistanceKm ?? 0 }), t('maneuvers.result.landingFar'), t('maneuvers.result.signal'));
    else if (effect === 'returnFuel') lines.push(t('maneuvers.result.returnFuel'));
    else if (effect === 'crewArrival') {
      lines.push(Object.entries(run.crewArrival).map(([id, arrival]) => t(`maneuvers.result.arrival.${arrival}`, { name: NAMES[id as CrewId] })).join(' · '));
    } else lines.push(t('maneuvers.result.vanAllen'));
    view.add([
      addText(this, PX, PANEL_TOP + 22, 18, COLOR.text).setOrigin(0.5).setText(t('maneuvers.result.title')),
      this.add.circle(OVERLAY.x + 26, PANEL_TOP + 52, 9, LIGHT_COLOR[PRECISION_LIGHT[level]]),
      addText(this, OVERLAY.x + 44, PANEL_TOP + 52, 15, LIGHT_CSS[PRECISION_LIGHT[level]]).setOrigin(0, 0.5).setText(t(`maneuvers.result.precision.${level}`)),
      addText(this, OVERLAY.x + 18, PANEL_TOP + 76, 12, COLOR.muted).setOrigin(0, 0.5).setText(t('maneuvers.result.fuel')),
      this.add.rectangle(OVERLAY.x + 186, PANEL_TOP + 76, 226, 10, 0x2d3748).setOrigin(0, 0.5),
      this.add.rectangle(OVERLAY.x + 186, PANEL_TOP + 76, 226 * run.finalFuel, 10, 0xf6ad55).setOrigin(0, 0.5),
      addText(this, PX, PANEL_TOP + 92, 11, COLOR.text, { align: 'center', wordWrap: { width: OVERLAY.width - 36 }, lineSpacing: 1 }).setOrigin(0.5, 0).setText(lines.join('\n')),
    ]);
    this.result = addButton(this, PX, PANEL_TOP + OVERLAY.height + 14, () => this.finish(), { size: 16 }).setLabel(t('maneuvers.result.continue')).setFocused(true);
    view.add(this.result.text);
  }

  private finish(): void {
    if (this.completed || this.run.step !== 'done') return;
    this.completed = true;
    if (this.run.definition.effect === 'vanAllen') this.bus.emit('realEvent:shown', VAN_ALLEN.realEvent);
    this.bus.emit('phase:completed', this.run.toPhaseResult());
  }

  private onKey(code: string): void {
    if (this.intro) {
      if (code === 'Space' || code === 'Enter' || code === 'NumpadEnter') this.art.skipIntro();
      return;
    }
    const step = this.run.step;
    if (step === 'stage' && code === 'Space' && this.kind === 'timing') return this.press();
    if (step === 'done' && (code === 'Enter' || code === 'Space' || code === 'NumpadEnter')) return this.finish();
    if (step !== 'checklist') return;
    if (code === 'ArrowUp' || code === 'KeyW') this.moveChecklist(-1);
    else if (code === 'ArrowDown' || code === 'KeyS') this.moveChecklist(1);
    else if (code === 'ArrowLeft' || code === 'KeyA' || code === 'ArrowRight' || code === 'KeyD') {
      const count = this.checklist.rows[this.checklist.row]?.buttons.length ?? 0;
      if (count > 1) this.focusChecklist(this.checklist.row, (this.checklist.option + 1) % count);
    } else if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') this.activateChecklist();
  }
}
