import Phaser from 'phaser';
import { CREW_ROSTER } from '../../../content/crew';
import type { Routine, RoutinePlan } from '../../../core/crew/routines';
import type { CrewId } from '../../../core/crew/types';
import type { SimSnapshot } from '../../../core/habitat/events';
import { t, type TranslationKey } from '../../../i18n';
import { GAME_HEIGHT } from '../../display';
import { SceneKeys } from '../../sceneKeys';
import { VIEW_WIDTH } from './HudScene';
import type { SimulationSceneData } from './simulationData';

const NAMES = Object.fromEntries(CREW_ROSTER.map((c) => [c.id, c.name])) as Record<CrewId, string>;
const FONT = { fontFamily: 'monospace', fontSize: '13px', color: '#e2e8f0' } as const;
const tr = (key: string, params?: Record<string, string | number>) => t(key as TranslationKey, params);

type Block = 'sleepHours' | 'exerciseHours' | 'workHours';
/** Colores de cada actividad en la barra del día (24 cuadritos, sin números). */
const BLOCKS: readonly { key: Block; color: number; min: number; max: number }[] = [
  { key: 'sleepHours', color: 0x4c51bf, min: 4, max: 12 },
  { key: 'exerciseHours', color: 0x38a169, min: 0, max: 4 },
  { key: 'workHours', color: 0xdd6b20, min: 0, max: 14 },
];
const FREE_COLOR = 0x4a5568;
const CELL = 11;
/** Llamadas a casa por día cuando la rutina las incluye (como la rutina por defecto). */
const CALLS_PER_DAY = 0.5;

/**
 * Planificación en pausa (§3.1): rutina de cada tripulante en una barra de 24 h y tablero de energía con fichas que
 * se arrastran entre "enchufados" y "desenchufados", sin números (§3.2). Se abre con P desde el mapa.
 */
export class PlanningScene extends Phaser.Scene {
  private data_!: SimulationSceneData;
  private snapshot: SimSnapshot | null = null;
  private routines: RoutinePlan | null = null;
  private off = new Set<string>();
  private layer!: Phaser.GameObjects.Container;
  private powerBars!: Phaser.GameObjects.Graphics;
  private plugged!: Phaser.Geom.Rectangle;

  constructor() {
    super(SceneKeys.Planning);
  }

  init(data: SimulationSceneData): void {
    this.data_ = data;
    this.snapshot = null;
    this.routines = null;
  }

  create(): void {
    const { sim } = this.data_;
    this.add.rectangle(0, 0, VIEW_WIDTH, GAME_HEIGHT, 0x05070d, 0.93).setOrigin(0, 0).setInteractive();
    this.layer = this.add.container(0, 0);
    this.powerBars = this.add.graphics();
    const offSnapshot = sim.on('sim:snapshot', (s) => {
      const first = !this.snapshot;
      this.snapshot = s;
      if (first) {
        this.routines = s.routines;
        this.off = new Set(s.power.loads.filter((l) => !l.on).map((l) => l.id));
        this.build();
      }
    });
    sim.emit('sim:pause', { paused: true });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offSnapshot();
      sim.emit('sim:pause', { paused: false });
    });
    this.input.on('dragstart', (_p: unknown, chip: Phaser.GameObjects.Text) => chip.setDepth(10));
    this.input.on('drag', (_p: unknown, chip: Phaser.GameObjects.Text, x: number, y: number) => chip.setPosition(x, y));
    this.input.on('dragend', (pointer: Phaser.Input.Pointer, chip: Phaser.GameObjects.Text) => {
      const id = chip.getData('load') as string;
      if (this.plugged.contains(pointer.x, pointer.y)) this.off.delete(id);
      else this.off.add(id);
      sim.emit('sim:loads', { off: [...this.off] });
      this.build();
    });
  }

  update(): void {
    const s = this.snapshot;
    if (!s) return;
    // Paneles contra consumo como barras, sin números (§3.2).
    const max = Math.max(s.power.generationKw, s.power.loadKw, 1);
    const g = this.powerBars.clear();
    g.fillStyle(0x2d3748).fillRect(600, 118, 260, 10).fillRect(600, 146, 260, 10);
    g.fillStyle(0xf6e05e).fillRect(600, 118, (260 * s.power.generationKw) / max, 10);
    g.fillStyle(s.power.loadKw > s.power.generationKw ? 0xfc8181 : 0x68d391).fillRect(600, 146, (260 * s.power.loadKw) / max, 10);
  }

  private setRoutine(id: CrewId, next: Routine): void {
    this.routines = { ...this.routines!, [id]: next };
    this.data_.sim.emit('sim:routines', this.routines);
    this.build();
  }

  /** Redibuja todo el contenido (cambia sólo cuando el jugador toca algo). */
  private build(): void {
    const s = this.snapshot!;
    const ns = this.data_.namespace;
    this.layer.removeAll(true);
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.layer.add(o);
      return o;
    };
    const text = (x: number, y: number, value: string, style: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {}) =>
      add(this.add.text(x, y, value, { ...FONT, ...style }));
    const button = (x: number, y: number, label: string, enabled: boolean, onClick: () => void) => {
      const b = text(x, y, label, { backgroundColor: enabled ? '#2d3748' : '#1a202c', color: enabled ? '#e2e8f0' : '#4a5568', padding: { x: 5, y: 1 } });
      if (enabled) b.setInteractive({ useHandCursor: true }).on('pointerdown', onClick);
      return b;
    };

    text(24, 16, t('hud.planning.sceneTitle'), { fontSize: '20px', color: '#90cdf4' });
    text(24, 44, t('hud.planning.paused'), { color: '#a0aec0', fontSize: '12px' });
    button(VIEW_WIDTH - 140, 16, t('hud.planning.close'), true, () => this.scene.stop());
    if (s.mars) {
      const f = s.mars.forecast;
      text(24, 64, t('hud.planning.forecast', { min: Math.round(f.minTempC), sky: tr(`mars.uv.${f.uv ?? 'none'}`) }), { color: '#fbd38d', fontSize: '12px', wordWrap: { width: 540 } });
    }

    // Rutinas.
    text(24, 96, t('hud.planning.routines'), { color: '#90cdf4' });
    text(24, 114, t('hud.planning.legend'), { color: '#718096', fontSize: '11px' });
    const tasks = [null, ...s.tasks.filter((task) => task.kind === 'maintenance').map((task) => task.id)];
    s.state.crew.forEach((m, i) => {
      const y = 140 + i * 92;
      const r = this.routines![m.id];
      text(24, y, NAMES[m.id], { fontSize: '15px', color: m.id === s.state.activeCrewId ? '#fbd38d' : '#e2e8f0' });
      // Barra de 24 h: sueño, ejercicio, trabajo y tiempo libre.
      let cell = 0;
      for (const block of BLOCKS)
        for (let h = 0; h < r[block.key]; h++) add(this.add.rectangle(110 + (cell++ * (CELL + 1)), y + 2, CELL, 14, block.color).setOrigin(0, 0));
      while (cell < 24) add(this.add.rectangle(110 + (cell++ * (CELL + 1)), y + 2, CELL, 14, FREE_COLOR).setOrigin(0, 0));
      const free = 24 - r.sleepHours - r.exerciseHours - r.workHours;
      BLOCKS.forEach((block, b) => {
        const x = 24 + b * 180;
        const label = t(`hud.planning.block.${block.key}`);
        button(x, y + 26, '−', r[block.key] > block.min, () => this.setRoutine(m.id, { ...r, [block.key]: r[block.key] - 1 }));
        text(x + 24, y + 27, label, { color: `#${block.color.toString(16).padStart(6, '0')}`, fontSize: '12px' });
        button(x + 30 + label.length * 7.5, y + 26, '+', r[block.key] < block.max && free > 0, () => this.setRoutine(m.id, { ...r, [block.key]: r[block.key] + 1 }));
      });
      const task = tasks.indexOf(r.taskId);
      const taskName = r.taskId ? tr(`${ns}.zone.${s.tasks.find((x) => x.id === r.taskId)!.zone}`) : t('hud.planning.noTask');
      button(24, y + 52, t('hud.planning.task', { task: taskName }), true, () =>
        this.setRoutine(m.id, { ...r, taskId: tasks[(task + 1) % tasks.length] ?? null }),
      );
      button(300, y + 52, t(r.callsHomePerDay > 0 ? 'hud.planning.callsOn' : 'hud.planning.callsOff'), true, () =>
        this.setRoutine(m.id, { ...r, callsHomePerDay: r.callsHomePerDay > 0 ? 0 : CALLS_PER_DAY }),
      );
    });

    // Tablero de energía.
    text(600, 96, t('hud.planning.power'), { color: '#90cdf4' });
    text(600, 128, t('hud.planning.generation'), { color: '#f6e05e', fontSize: '11px' });
    text(600, 156, t('hud.planning.consumption'), { color: '#a0aec0', fontSize: '11px' });
    this.plugged = new Phaser.Geom.Rectangle(600, 200, 270, 170);
    const unplugged = new Phaser.Geom.Rectangle(600, 410, 270, 170);
    for (const [area, key] of [[this.plugged, 'hud.planning.plugged'], [unplugged, 'hud.planning.unplugged']] as const) {
      add(this.add.rectangle(area.x, area.y, area.width, area.height, 0x1a202c).setOrigin(0, 0).setStrokeStyle(2, key === 'hud.planning.plugged' ? 0x68d391 : 0x718096));
      text(area.x + 8, area.y - 18, t(key), { fontSize: '12px', color: '#a0aec0' });
    }
    // Lo esencial va siempre; abajo, los enchufes que alcanza a dar el sol de hoy (con polvo, menos).
    const essentials = s.power.loads.filter((l) => l.essential);
    const firstSocket = this.plugged.y + 12 + essentials.length * 36;
    for (let i = 0; i < s.power.sockets; i++)
      add(this.add.rectangle(this.plugged.x + 8, firstSocket + i * 36 - 4, this.plugged.width - 16, 32, 0x22543d, 0.6).setOrigin(0, 0).setStrokeStyle(1, 0x68d391));
    const slots = { on: 0, off: 0 };
    let overload = false;
    for (const load of [...essentials, ...s.power.loads.filter((l) => !l.essential)]) {
      const on = !this.off.has(load.id) || load.essential;
      const area = on ? this.plugged : unplugged;
      const n = on ? slots.on++ : slots.off++;
      const extra = on && !load.essential && n - essentials.length >= s.power.sockets;
      overload ||= extra;
      const chip = text(area.x + 12, area.y + 12 + n * 36, `${load.essential ? '■ ' : '● '}${tr(`hud.load.${load.id}`)}`, {
        backgroundColor: extra ? '#9b2c2c' : on ? '#276749' : '#4a5568',
        padding: { x: 8, y: 6 },
      });
      // En Marte el tablero está en la sala de energía: lejos de ahí, las fichas no se mueven.
      if (load.essential || s.power.panelBlocked) continue;
      chip.setData('load', load.id).setInteractive({ draggable: true, useHandCursor: true });
    }
    text(600, 590, t(overload ? 'hud.planning.overload' : s.power.panelBlocked ? 'hud.planning.panelAway' : 'hud.planning.powerHint'), {
      fontSize: '11px',
      color: overload ? '#fc8181' : s.power.panelBlocked ? '#f6e05e' : '#718096',
      wordWrap: { width: 280 },
    });
  }
}
