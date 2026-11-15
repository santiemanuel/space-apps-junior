import Phaser from 'phaser';
import { CREW_ROSTER } from '../../../content/crew';
import { MANEUVER_RULES, MANEUVERS, maneuverConditions, VAN_ALLEN_EVENT } from '../../../content/maneuvers';
import type { EventBus } from '../../../core/events/EventBus';
import type { GameEvents } from '../../../core/events/GameEvents';
import { ManeuverRun, precisionLevel } from '../../../core/maneuvers/ManeuverRun';
import type { ChecklistDecision, ChecklistItem } from '../../../core/maneuvers/types';
import type { CrewId } from '../../../core/crew/types';
import type { SystemStatus } from '../../../core/systems/types';
import { t } from '../../../i18n';
import { GAME_WIDTH } from '../../display';
import { SceneKeys } from '../../sceneKeys';
import { addButton, addPanel, addText, COLOR, LIGHT_COLOR, LIGHT_CSS, listenUntilShutdown, onKeys, type Button } from '../../ui/ui';
import type { ManeuverSceneData } from '../sceneData';

const CENTER = GAME_WIDTH / 2;
const BAR = { x: 240, y: 380, width: 800, height: 40 } as const;
const FUEL = { x: 1050, y: 28, width: 200, height: 12 } as const;
/** Pausa antes de que empiece a moverse la marca y tiempo para leer el resultado de cada etapa (ms). */
const READY_MS = 700;
const FEEDBACK_MS = 1300;
const NAMES = Object.fromEntries(CREW_ROSTER.map((c) => [c.id, c.name])) as Record<CrewId, string>;
const PRECISION_LIGHT: Record<ReturnType<typeof precisionLevel>, SystemStatus> = { great: 'green', good: 'yellow', rough: 'red' };

/**
 * Maniobra genérica (§4.0) configurada por `ManeuverDefinition`: checklist Go / No-Go y una barra por etapa
 * (Espacio en la zona). Las reglas viven en `ManeuverRun`; la escena sólo pinta y lee la entrada.
 */
export class ManeuverScene extends Phaser.Scene {
  private data_!: ManeuverSceneData;
  private run!: ManeuverRun;
  private view!: Phaser.GameObjects.Container;
  private fuelFill!: Phaser.GameObjects.Rectangle;
  private header!: { title: Phaser.GameObjects.Text; narrator: Phaser.GameObjects.Text; fuel: Phaser.GameObjects.Text };
  private stageView: { zone: Phaser.GameObjects.Rectangle; marker: Phaser.GameObjects.Rectangle; feedback: Phaser.GameObjects.Text } | null = null;
  private checklist = { row: 0, option: 0, rows: [] as { buttons: Button[]; status: Phaser.GameObjects.Text }[], start: null as Button | null };
  private result: Button | null = null;
  private readyAt = 0;
  private completed = false;

  constructor() {
    super(SceneKeys.Maneuver);
  }

  init(data: ManeuverSceneData): void {
    this.data_ = data;
    this.run = new ManeuverRun(MANEUVERS[data.maneuverId], data.state, MANEUVER_RULES, maneuverConditions(data.maneuverId, data.state));
    this.completed = false;
    this.stageView = null;
    this.result = null;
  }

  create(): void {
    this.header = {
      title: addText(this, CENTER, 46, 32, COLOR.title).setOrigin(0.5),
      narrator: addText(this, CENTER, 96, 16, COLOR.muted, { align: 'center', wordWrap: { width: 980 } }).setOrigin(0.5, 0),
      fuel: addText(this, FUEL.x, FUEL.y - 20, 13, COLOR.muted),
    };
    this.add.rectangle(FUEL.x, FUEL.y, FUEL.width, FUEL.height, 0x2d3748).setOrigin(0, 0);
    this.fuelFill = this.add.rectangle(FUEL.x, FUEL.y, FUEL.width, FUEL.height, 0xf6ad55).setOrigin(0, 0);
    this.view = this.add.container(0, 0);

    onKeys(this, (code) => this.onKey(code));
    listenUntilShutdown(this, this.input, 'pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (this.run.step === 'stage' && over.length === 0) this.press();
    });
    listenUntilShutdown(this, this.events, Phaser.Scenes.Events.RESUME, () => this.rebuild());
    this.rebuild();
  }

  update(time: number, deltaMs: number): void {
    if (this.run.step === 'stage' && time >= this.readyAt) this.run.update(deltaMs / 1000);
    if (this.stageView) this.stageView.marker.setX(BAR.x + this.run.marker * BAR.width);
    this.fuelFill.setScale(this.run.step === 'done' ? this.run.finalFuel : this.run.fuel, 1);
  }

  private get bus(): EventBus<GameEvents> {
    return this.data_.bus;
  }

  /** Vuelve a pintar el paso actual (también al volver de la pausa, por si cambió el idioma). */
  private rebuild(): void {
    const id = this.data_.maneuverId;
    this.header.title.setText(t(`maneuvers.name.${id}`));
    this.header.narrator.setText(`${t('maneuvers.narrator')}: ${t(`maneuvers.intro.${id}`)}`);
    this.header.fuel.setText(t('maneuvers.fuel'));
    this.view.removeAll(true);
    this.stageView = null;
    this.result = null;
    this.checklist.rows = [];
    this.checklist.start = null;
    if (this.run.step === 'checklist') this.showChecklist();
    else if (this.run.step === 'done') this.showResult();
    else this.showStage();
  }

  // --- Checklist Go / No-Go ---

  private options(item: ChecklistItem): ChecklistDecision[] {
    if (item.decision) return [];
    return item.status === 'green' ? ['go'] : ['repair', 'risk'];
  }

  private showChecklist(): void {
    const { run, view } = this;
    view.add([
      addText(this, CENTER, 160, 24, COLOR.text).setOrigin(0.5).setText(t('maneuvers.checklist.title')),
      addText(this, CENTER, 192, 15, COLOR.muted, { align: 'center', wordWrap: { width: 900 } }).setOrigin(0.5, 0).setText(t('maneuvers.checklist.hint')),
      addText(this, 1040, 236, 15, COLOR.muted).setOrigin(1, 0.5).setText(t('maneuvers.checklist.spares', { count: run.spares })),
    ]);
    run.items.forEach((item, index) => {
      const y = 280 + index * 58;
      view.add(addPanel(this, 240, y - 24, 800, 48));
      view.add(this.add.circle(268, y, 10, LIGHT_COLOR[item.status]));
      view.add(addText(this, 292, y, 18).setOrigin(0, 0.5).setText(t(`common.system.${item.systemId}`)));
      const status = addText(this, 1024, y, 15, COLOR.muted).setOrigin(1, 0.5);
      view.add(status);
      const buttons = this.options(item).map((decision, option, all) => {
        const x = 1024 - (all.length - 1 - option) * 210 - 95;
        const button = addButton(this, x, y, () => this.decide(index, decision), {
          size: 15,
          onHover: () => this.focusChecklist(index, option),
        }).setLabel(this.decisionLabel(item, decision));
        if (decision === 'repair' && !run.canRepair(item.systemId)) button.setEnabled(false).setLabel(t('maneuvers.checklist.noSpares'));
        view.add(button.text);
        return button;
      });
      if (item.decision) {
        status.setText(t(`maneuvers.checklist.done.${item.decision}`)).setColor(item.decision === 'risk' ? COLOR.warn : COLOR.ok);
      }
      this.checklist.rows.push({ buttons, status });
    });
    const startY = 280 + run.items.length * 58 + 30;
    const start = addButton(this, CENTER, startY, () => this.startStages(), {
      size: 20,
      onHover: () => this.focusChecklist(run.items.length, 0),
    })
      .setLabel(t(run.checklistReady ? 'maneuvers.checklist.start' : 'maneuvers.checklist.pending'))
      .setEnabled(run.checklistReady);
    this.checklist.start = start;
    view.add([start.text, addText(this, CENTER, 690, 14, COLOR.dim).setOrigin(0.5).setText(t('maneuvers.checklist.controls'))]);
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
    if (item && this.run.decide(item.systemId, decision)) this.rebuild();
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

  // --- Etapas ---

  private showStage(): void {
    const { run, view } = this;
    const stage = run.stage!;
    const zone = run.zone!;
    const id = run.definition.id;
    const total = run.definition.stages.length;
    view.add([
      addText(this, CENTER, 175, 15, COLOR.muted).setOrigin(0.5).setText(t('maneuvers.stage.counter', { current: run.stageIndex + 1, total })),
      addText(this, CENTER, 215, 30, COLOR.text).setOrigin(0.5).setText(t(`maneuvers.stage.${id}.${stage.id}`)),
      addText(this, CENTER, 252, 17, COLOR.muted, { align: 'center', wordWrap: { width: 900 } }).setOrigin(0.5, 0).setText(t(`maneuvers.stage.${id}.${stage.id}.fact`)),
      this.add.rectangle(BAR.x, BAR.y, BAR.width, BAR.height, 0x1a202c).setOrigin(0, 0.5).setStrokeStyle(2, 0x4a5568),
    ]);
    const zoneRect = this.add.rectangle(BAR.x + zone.center * BAR.width, BAR.y, zone.width * BAR.width, BAR.height - 6, 0x48bb78, 0.85);
    const marker = this.add.rectangle(BAR.x, BAR.y, 6, BAR.height + 24, 0xffffff);
    const feedback = addText(this, CENTER, 500, 22, COLOR.ok, { align: 'center', wordWrap: { width: 900 } }).setOrigin(0.5);
    run.definition.stages.forEach((_s, i) => {
      const done = run.outcomes[i];
      const color = done ? (done.hit ? LIGHT_COLOR.green : LIGHT_COLOR.yellow) : i === run.stageIndex ? 0xffffff : 0x4a5568;
      view.add(this.add.circle(CENTER - ((total - 1) * 28) / 2 + i * 28, 590, 8, color));
    });
    view.add([zoneRect, marker, feedback, addText(this, CENTER, 450, 17, COLOR.focus).setOrigin(0.5).setText(t('maneuvers.stage.hint'))]);
    this.stageView = { zone: zoneRect, marker, feedback };
  }

  private press(): void {
    if (this.time.now < this.readyAt) return;
    const outcome = this.run.press();
    if (!outcome || !this.stageView) return;
    this.bus.emit('maneuver:stage', { maneuverId: this.data_.maneuverId, stage: outcome.stageId, hit: outcome.hit });
    const key = !outcome.hit ? 'maneuvers.stage.miss' : outcome.precision >= 0.9 ? 'maneuvers.stage.perfect' : 'maneuvers.stage.hit';
    this.stageView.feedback.setText(t(key)).setColor(outcome.hit ? COLOR.ok : COLOR.warn);
    this.time.delayedCall(FEEDBACK_MS, () => {
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
    if (effect === 'landingDistance') {
      lines.push(t('maneuvers.result.landing', { km: run.landingDistanceKm ?? 0 }), t('maneuvers.result.landingFar'), '', t('maneuvers.result.signal'));
    } else if (effect === 'returnFuel') {
      lines.push(t('maneuvers.result.returnFuel'));
    } else if (effect === 'crewArrival') {
      for (const [id, arrival] of Object.entries(run.crewArrival)) {
        lines.push(t(`maneuvers.result.arrival.${arrival}`, { name: NAMES[id as CrewId] }));
      }
    } else {
      lines.push(t('maneuvers.result.vanAllen'));
    }
    view.add([
      addText(this, CENTER, 190, 28, COLOR.text).setOrigin(0.5).setText(t('maneuvers.result.title')),
      this.add.circle(CENTER - 170, 250, 12, LIGHT_COLOR[PRECISION_LIGHT[level]]),
      addText(this, CENTER - 145, 250, 22, LIGHT_CSS[PRECISION_LIGHT[level]]).setOrigin(0, 0.5).setText(t(`maneuvers.result.precision.${level}`)),
      addText(this, CENTER, 296, 16, COLOR.muted).setOrigin(0.5).setText(t('maneuvers.result.fuel')),
      this.add.rectangle(CENTER - 150, 322, 300, 14, 0x2d3748).setOrigin(0, 0.5),
      this.add.rectangle(CENTER - 150, 322, 300 * run.finalFuel, 14, 0xf6ad55).setOrigin(0, 0.5),
      addText(this, CENTER, 360, 18, COLOR.text, { align: 'center', wordWrap: { width: 900 }, lineSpacing: 6 }).setOrigin(0.5, 0).setText(lines.join('\n')),
    ]);
    this.result = addButton(this, CENTER, 620, () => this.finish(), { size: 22 }).setLabel(t('maneuvers.result.continue')).setFocused(true);
    view.add(this.result.text);
  }

  private finish(): void {
    if (this.completed || this.run.step !== 'done') return;
    this.completed = true;
    if (this.run.definition.effect === 'vanAllen') this.bus.emit('realEvent:shown', VAN_ALLEN_EVENT);
    this.bus.emit('phase:completed', this.run.toPhaseResult());
  }

  private onKey(code: string): void {
    const step = this.run.step;
    if (step === 'stage' && code === 'Space') return this.press();
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
