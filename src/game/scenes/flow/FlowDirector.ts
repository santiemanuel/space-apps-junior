import Phaser from 'phaser';
import { ACHIEVEMENTS, REPORT_RULES } from '../../../content/achievements';
import { EventBus } from '../../../core/events/EventBus';
import type { GameEvents } from '../../../core/events/GameEvents';
import type { RealEvent } from '../../../core/events/RealEvent';
import { MissionFlow, type FlowStep } from '../../../core/flow/MissionFlow';
import type { PhaseResult } from '../../../core/flow/types';
import { recordMissionEnd } from '../../../core/progression/progression';
import { buildReport, earnedAchievements, type MissionOutcome } from '../../../core/report/report';
import { clearGame, loadProgression, saveGame, saveProgression } from '../../../core/save/save';
import type { SaveStore } from '../../../core/save/SaveStore';
import type { GameState } from '../../../core/state/types';
import { SceneKeys, type SceneKey } from '../../sceneKeys';
import type { DataCardData } from './DataCardScene';
import type { PauseSceneData } from './PauseScene';
import { sceneForStep } from './phaseScenes';
import type { ReportData } from './ReportScene';
import type { TitleSceneData } from './TitleScene';
import { audio } from '../../audio/audio';
import type { MusicId } from '../../audio/themes';

/** Fundidos entre pantallas (ms) y su color: el fondo general del juego (#05070d). */
const FADE = { out: 260, in: 380, color: [5, 7, 13] as [number, number, number] } as const;

/** Música de cada paso del flujo (menú, despegues y aterrizajes, viaje, Marte y el final). */
function musicFor(step: FlowStep): MusicId {
  if (step.kind === 'report') return step.outcome === 'completed' ? 'victory' : 'failure';
  if (step.kind === 'maneuver') return 'launch';
  if (step.kind === 'voyage') return 'voyage';
  if (step.kind === 'mars') return 'mars';
  return 'menu';
}

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
  /** Cuándo se cerró la última superpuesta (ms de `performance.now`). */
  private overlayClosedAt = 0;
  /** Hay un fundido entre pantallas en curso. */
  private switching = false;

  constructor(
    private readonly game: Phaser.Game,
    private readonly store: SaveStore,
  ) {
    window.addEventListener('keydown', (event) => {
      // La misma tecla que cierra la pausa (o una tarjeta) no la vuelve a abrir en ese momento.
      if (event.code === 'Escape' && performance.now() - this.overlayClosedAt > 300) this.openPause();
    });
  }

  private get scenes(): Phaser.Scenes.SceneManager {
    return this.game.scene;
  }

  showTitle(): void {
    this.endMission();
    this.transition(() => {
      this.stopAll();
      audio.music('menu');
      const data: TitleSceneData = { store: this.store, onNewGame: (state) => this.play(state), onContinue: (state) => this.play(state) };
      this.startScene(SceneKeys.Title, data);
    });
  }

  /**
   * Fundido a negro de lo que se ve y, al terminar, el cambio de pantalla; la escena nueva aparece con otro fundido
   * (`startScene`). Mientras dura no se abre la pausa.
   */
  private transition(change: () => void): void {
    const visible = this.scenes.getScenes(true).filter((scene) => scene.cameras?.main);
    if (!visible.length || this.switching) {
      change();
      return;
    }
    this.switching = true;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      // El fundido avisa a mitad del cuadro de la escena: detenerla ahí congela el juego. El cambio va al terminar.
      queueMicrotask(() => {
        this.switching = false;
        change();
      });
    };
    // Todas las cámaras de la escena (la de la maniobra tiene una aparte para la ilustración).
    for (const scene of visible) for (const camera of scene.cameras.cameras) camera.fadeOut(FADE.out, ...FADE.color);
    visible[0]!.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, finish);
    // Por si la escena se pausa o se apaga en medio del fundido.
    window.setTimeout(finish, FADE.out + 200);
  }

  /** Arranca una escena con fundido de entrada. */
  private startScene(key: SceneKey, data: object): void {
    this.scenes.start(key, data);
    const scene = this.scenes.getScene(key);
    scene?.events.once(Phaser.Scenes.Events.CREATE, () => scene.cameras.cameras.forEach((camera) => camera.fadeIn(FADE.in, ...FADE.color)));
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
    this.transition(() => {
      if (this.flow !== flow) return;
      const state = flow.state;
      this.stopAll();
      audio.music(musicFor(step));
      if (step.kind === 'report') {
        this.finishMission(state, step.outcome);
        const report: ReportData = { state, bus, outcome: step.outcome, onExit: () => this.showTitle() };
        this.startScene(SceneKeys.Report, report);
        return;
      }
      const { key, data } = sceneForStep(step, state, bus);
      this.startScene(key, data);
      // `phase:started` cuando la escena ya está creada, para que pueda escucharlo.
      this.scenes.getScene(key)?.events.once('create', () => bus.emit('phase:started', { phase: state.phase }));
    });
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
    if (!flow || !bus || this.overlay || this.switching || flow.step.kind === 'report') return;
    const data: PauseSceneData = {
      state: flow.state,
      bus,
      onResume: () => this.closeOverlay(),
      onExit: () => this.showTitle(),
      store: this.store,
      onLocaleChange: () => undefined,
    };
    this.openOverlay(SceneKeys.Pause, data);
  }

  private openOverlay(key: SceneKey, data: object): void {
    audio.sfx(key === SceneKeys.Pause ? 'open' : 'card');
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
    this.overlayClosedAt = performance.now();
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
