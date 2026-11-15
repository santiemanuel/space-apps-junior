import type Phaser from 'phaser';
import { ACHIEVEMENTS, REPORT_RULES } from '../../../content/achievements';
import { EventBus } from '../../../core/events/EventBus';
import type { GameEvents } from '../../../core/events/GameEvents';
import type { RealEvent } from '../../../core/events/RealEvent';
import { MissionFlow, type FlowStep } from '../../../core/flow/MissionFlow';
import type { PhaseResult } from '../../../core/flow/types';
import { recordMissionEnd } from '../../../core/progression/progression';
import { buildReport, earnedAchievements, type MissionOutcome } from '../../../core/report/report';
import { clearGame, loadProgression, saveGame, saveProgression, saveSettings } from '../../../core/save/save';
import type { SaveStore } from '../../../core/save/SaveStore';
import type { GameState } from '../../../core/state/types';
import { SceneKeys, type SceneKey } from '../../sceneKeys';
import type { DataCardData } from './DataCardScene';
import type { PauseSceneData } from './PauseScene';
import { sceneForStep } from './phaseScenes';
import type { ReportData } from './ReportScene';
import type { TitleSceneData } from './TitleScene';

interface Overlay {
  key: SceneKey;
  /** Escenas que se pausaron al abrirla y se reanudan al cerrarla. */
  paused: string[];
}

/**
 * Conecta las escenas con `MissionFlow` por el bus (plan §10): arranca cada fase, autoguarda en cada
 * `phase:completed`, abre la pausa con Esc y las tarjetas con `realEvent:shown`, y al final actualiza la progresión.
 * Las escenas no se llaman entre sí: sólo emiten eventos o llaman a los callbacks que reciben.
 */
export class FlowDirector {
  private flow: MissionFlow | null = null;
  private bus: EventBus<GameEvents> | null = null;
  private offs: (() => void)[] = [];
  private overlay: Overlay | null = null;
  private pendingStep: FlowStep | null = null;
  private cards: RealEvent[] = [];

  constructor(
    private readonly game: Phaser.Game,
    private readonly store: SaveStore,
  ) {
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Escape') this.openPause();
    });
  }

  private get scenes(): Phaser.Scenes.SceneManager {
    return this.game.scene;
  }

  showTitle(): void {
    this.endMission();
    this.stopAll();
    const data: TitleSceneData = { store: this.store, onNewGame: (state) => this.play(state), onContinue: (state) => this.play(state) };
    this.scenes.start(SceneKeys.Title, data);
  }

  /** Empieza (o retoma) una partida: la guarda enseguida para que "Continuar" ya esté disponible. */
  play(state: GameState): void {
    this.endMission();
    const flow = new MissionFlow(state);
    const bus = new EventBus<GameEvents>();
    this.flow = flow;
    this.bus = bus;
    this.offs = [
      bus.on('phase:completed', (result) => this.onPhaseCompleted(result)),
      bus.on('phase:progress', (state) => flow.progress(state)),
      bus.on('realEvent:shown', (event) => this.onRealEvent(event)),
      bus.on('save:requested', () => this.save()),
    ];
    this.save();
    this.startStep(flow.step);
  }

  private onPhaseCompleted(result: PhaseResult): void {
    const step = this.flow?.complete(result);
    if (!step) return;
    if (step.kind !== 'report') this.save();
    // La fase avisa a mitad de su cuadro: si se la detiene ahí, el resto del cuadro usa objetos ya destruidos y el
    // juego se congela. La escena siguiente arranca cuando termina ese cuadro.
    const flow = this.flow;
    queueMicrotask(() => {
      if (this.flow !== flow) return;
      if (this.overlay) this.pendingStep = step;
      else this.startStep(step);
    });
  }

  private startStep(step: FlowStep): void {
    const { flow, bus } = this;
    if (!flow || !bus) return;
    const state = flow.state;
    this.stopAll();
    if (step.kind === 'report') {
      this.finishMission(state, step.outcome);
      const report: ReportData = { state, bus, outcome: step.outcome, onExit: () => this.showTitle() };
      this.scenes.start(SceneKeys.Report, report);
      return;
    }
    const { key, data } = sceneForStep(step, state, bus);
    this.scenes.start(key, data);
    // `phase:started` cuando la escena ya está creada, para que pueda escucharlo.
    this.scenes.getScene(key)?.events.once('create', () => bus.emit('phase:started', { phase: state.phase }));
  }

  /** Fin de la misión: suma a la progresión, guarda los logros y borra la partida guardada. */
  private finishMission(state: GameState, outcome: MissionOutcome): void {
    const achievements = earnedAchievements(buildReport(state, outcome, ACHIEVEMENTS, REPORT_RULES));
    saveProgression(this.store, recordMissionEnd(loadProgression(this.store), outcome, achievements));
    clearGame(this.store);
  }

  private save(): void {
    if (!this.flow || !this.bus) return;
    saveGame(this.store, this.flow.state);
    this.bus.emit('save:completed', { savedAt: new Date().toISOString() });
  }

  // --- Pantallas superpuestas: tarjetas y pausa ---

  private onRealEvent(event: RealEvent): void {
    this.flow?.recordRealEvent(event);
    this.cards.push(event);
    if (!this.overlay) this.openNextCard();
  }

  private openNextCard(): void {
    const event = this.cards.shift();
    if (!event || !this.bus) return;
    this.openOverlay(SceneKeys.DataCard, { event, bus: this.bus, onClose: () => this.closeOverlay() } satisfies DataCardData);
  }

  private openPause(): void {
    const { flow, bus } = this;
    if (!flow || !bus || this.overlay || flow.step.kind === 'report') return;
    const data: PauseSceneData = {
      state: flow.state,
      bus,
      onResume: () => this.closeOverlay(),
      onExit: () => this.showTitle(),
      onLocaleChange: (locale) => saveSettings(this.store, { locale }),
    };
    this.openOverlay(SceneKeys.Pause, data);
  }

  private openOverlay(key: SceneKey, data: object): void {
    const paused = this.runningScenes().filter((k) => k !== key);
    paused.forEach((k) => this.scenes.pause(k));
    this.overlay = { key, paused };
    this.scenes.start(key, data);
    this.scenes.bringToTop(key);
  }

  /** Reanuda lo que estaba pausado; después muestra la próxima tarjeta o el paso que esperaba. */
  private closeOverlay(): void {
    const overlay = this.overlay;
    if (!overlay) return;
    this.overlay = null;
    overlay.paused.forEach((k) => this.scenes.resume(k));
    if (this.cards.length) return this.openNextCard();
    const step = this.pendingStep;
    this.pendingStep = null;
    if (step) this.startStep(step);
  }

  private runningScenes(): string[] {
    return this.scenes.getScenes(true).map((scene) => scene.scene.key);
  }

  private stopAll(): void {
    for (const scene of this.scenes.getScenes(false)) {
      const { sys } = scene;
      if (sys.isActive() || sys.isPaused() || sys.isSleeping()) this.scenes.stop(scene.scene.key);
    }
    this.overlay = null;
  }

  private endMission(): void {
    this.offs.forEach((off) => off());
    this.offs = [];
    this.bus?.clear();
    this.flow = null;
    this.bus = null;
    this.overlay = null;
    this.pendingStep = null;
    this.cards = [];
  }
}
