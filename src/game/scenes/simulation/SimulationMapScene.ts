import Phaser from 'phaser';
import { CREW_ROSTER } from '../../../content/crew';
import { INCIDENTS } from '../../../content/incidents';
import type { SacrificeId } from '../../../core/cascade/sacrifices';
import { efficiency, moveSpeedFactor } from '../../../core/crew/efficiency';
import type { CrewId, CrewMemberState } from '../../../core/crew/types';
import type { HabitatSession } from '../../../core/habitat/HabitatSession';
import { EXTERIOR, isWalkable, zoneAt, zoneById, zoneSpot, type Point, type ShipLayout } from '../../../core/habitat/layout';
import type { HabitatContent } from '../../../core/habitat/types';
import { definitionOf } from '../../../core/incidents/planner';
import { chestXrays } from '../../../core/meters/dose';
import type { AlertLevel } from '../../../core/meters/types';
import type { SystemStatus } from '../../../core/systems/types';
import { getLocale, t, type TranslationKey, type TranslationParams } from '../../../i18n';
import { GAME_HEIGHT, GAME_WIDTH, TILE } from '../../display';
import { createCrewSprite, type CrewSprite } from '../../entities/CrewSprite';
import { createKeyboardControls, type PlayerControls } from '../../input/PlayerControls';
import type { SceneKey } from '../../sceneKeys';
import type { PhaseSceneData } from '../sceneData';
import { VoyagePanel, type PanelRow } from './VoyagePanel';

/** Ancho de la vista del mapa: el resto de la pantalla es el tablero provisional. */
export const VIEW_WIDTH = 19 * TILE;
const PLAYER_SPEED = 160;
const DAY_MS = 86_400_000;
export const NAMES = Object.fromEntries(CREW_ROSTER.map((c) => [c.id, c.name])) as Record<CrewId, string>;

const ZONE_COLOR: Record<string, number> = {
  command: 0x2c5282,
  exercise: 0x276749,
  scrubber: 0x285e61,
  recycler: 0x2a4365,
  greenhouse: 0x2f855a,
  infirmary: 0x553c9a,
  pantry: 0x744210,
  moxie: 0x9c4221,
  shelter: 0x2b6cb0,
  radio: 0x702459,
  airlock: 0x718096,
  [EXTERIOR]: 0x9c4a2a,
};
export const LIGHT: Record<SystemStatus, string> = { green: '#68d391', yellow: '#f6e05e', red: '#fc8181' };
const LEVEL_COLOR: Record<AlertLevel, string> = { calm: '#68d391', alert: '#f6e05e', impact: '#fc8181' };
const LEVEL_TINT: Record<AlertLevel, [number, number]> = { calm: [0, 0], alert: [0xecc94b, 0.08], impact: [0xe53e3e, 0.1] };

export const tr = (key: string, params?: TranslationParams) => t(key as TranslationKey, params);
export const bar = (fraction: number, width = 10) => {
  const full = Math.round(Math.min(1, Math.max(0, fraction)) * width);
  return '█'.repeat(full) + '░'.repeat(width - full);
};
const tenths = (x: number) => Math.round(Math.min(1, Math.max(0, x)) * 10);
export const lightFor = (value: number, yellowBelow: number, redBelow: number) =>
  value < redBelow ? LIGHT.red : value < yellowBelow ? LIGHT.yellow : LIGHT.green;
export const toPx = (p: Point) => ({ x: p.x * TILE, y: p.y * TILE });

/**
 * Mapa top-down con la tripulación, común a `Voyage` y `Mars`. Sólo pinta y lee la entrada; las reglas están en
 * la sesión de `src/core/` que crea cada escena. Textos propios en `<namespace>.zone|station|task|outcome.*`.
 */
export abstract class SimulationMapScene<S extends HabitatSession, D extends PhaseSceneData = PhaseSceneData> extends Phaser.Scene {
  protected sceneData!: D;
  protected session!: S;
  protected layout!: ShipLayout;
  protected content!: HabitatContent;
  private controls!: PlayerControls;
  private sprites = new Map<CrewId, CrewSprite>();
  private colliders = new Map<CrewId, Phaser.Physics.Arcade.Collider>();
  private labels = new Map<CrewId, Phaser.GameObjects.Text>();
  private stationBars = new Map<string, Phaser.GameObjects.Rectangle>();
  private stationFrames = new Map<string, Phaser.GameObjects.Rectangle>();
  protected markers!: Phaser.GameObjects.Graphics;
  private tint!: Phaser.GameObjects.Rectangle;
  private prompt!: Phaser.GameObjects.Text;
  private toast!: Phaser.GameObjects.Text;
  private toastUntil = 0;
  private panel!: VoyagePanel;
  private ended = false;

  protected constructor(key: SceneKey, private readonly namespace: 'voyage' | 'mars') {
    super(key);
  }

  init(data: D): void {
    this.sceneData = data;
    this.sprites = new Map();
    this.colliders = new Map();
    this.labels = new Map();
    this.stationBars = new Map();
    this.stationFrames = new Map();
    this.ended = false;
  }

  protected abstract createSession(data: D): { session: S; content: HabitatContent };
  /** Filas propias del lugar en el tablero (después del reloj). */
  protected placeRows(): PanelRow[] {
    return [];
  }
  /** Dibujo propio del lugar en cada cuadro (en `markers`, ya limpio). */
  protected renderPlace(): void {}
  /** Texto de ayuda propio del lugar para el tripulante del jugador, o null para el de las tareas. */
  protected placePrompt(_position: Point, _zone: string | null): string | null {
    return null;
  }
  /** La puerta exterior de la esclusa está cerrada (de noche o por una tormenta). */
  protected outerDoorClosed(): boolean {
    return false;
  }
  protected abstract outcomeKey(outcome: 'completed' | 'suspended'): string;

  create(): void {
    ({ session: this.session, content: this.content } = this.createSession(this.sceneData));
    this.layout = this.content.layout;
    this.controls = createKeyboardControls(this);
    const width = this.layout.cols * TILE;
    const height = this.layout.rows * TILE;
    this.physics.world.setBounds(0, 0, width, height);
    this.cameras.main.setBounds(0, 0, width + GAME_WIDTH - VIEW_WIDTH, height);

    const walls = this.drawMap();
    const doorBlock = this.outerDoorBlock();
    this.markers = this.add.graphics().setDepth(5);
    this.tint = this.add.rectangle(0, 0, VIEW_WIDTH, GAME_HEIGHT, 0, 0).setOrigin(0, 0).setDepth(40).setScrollFactor(0);
    for (const m of this.session.state.crew) {
      const p = toPx(this.session.positionOf(m.id));
      const sprite = createCrewSprite(this, m.id, p.x, p.y);
      this.sprites.set(m.id, sprite);
      this.colliders.set(m.id, this.physics.add.collider(sprite.sprite, doorBlock ? [...walls, doorBlock] : walls));
      this.labels.set(m.id, this.add.text(p.x, p.y + 18, NAMES[m.id], { fontFamily: 'monospace', fontSize: '11px', color: '#e2e8f0' }).setOrigin(0.5, 0).setDepth(11));
    }
    this.selectActive();
    this.prompt = this.add
      .text(0, 0, '', { fontFamily: 'monospace', fontSize: '12px', color: '#fbd38d', backgroundColor: '#1a202ccc', padding: { x: 4, y: 2 } })
      .setOrigin(0.5, 1)
      .setDepth(45);
    this.toast = this.add
      .text(VIEW_WIDTH / 2, 12, '', { fontFamily: 'monospace', fontSize: '14px', color: '#fbd38d', backgroundColor: '#1a202cee', padding: { x: 8, y: 4 }, align: 'center', wordWrap: { width: VIEW_WIDTH - 80 } })
      .setOrigin(0.5, 0)
      .setDepth(60)
      .setScrollFactor(0)
      .setVisible(false);
    this.panel = new VoyagePanel(this, VIEW_WIDTH + 20, 14, GAME_WIDTH - VIEW_WIDTH - 36, GAME_HEIGHT);
    this.add
      .text(VIEW_WIDTH + 20, GAME_HEIGHT - 10, t('hud.panel.controls'), { fontFamily: 'monospace', fontSize: '11px', color: '#718096', wordWrap: { width: GAME_WIDTH - VIEW_WIDTH - 36 } })
      .setOrigin(0, 1)
      .setDepth(51)
      .setScrollFactor(0);

    this.listen();
    const keyboard = this.input.keyboard!;
    keyboard.addKey('P').on('down', () => this.session.togglePause());
    // Provisional hasta F2: Tab y `crew:switched` son de Facundo (src/game/input/); quitar en la integración.
    keyboard.addCapture('TAB');
    keyboard.addKey('TAB').on('down', () => this.sceneData.bus.emit('crew:switched', { crewId: this.nextCrew() }));
  }

  update(_time: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    const s = this.session;
    const activeId = s.state.activeCrewId;
    const active = this.sprites.get(activeId)!;
    const member = this.member(activeId);
    const co2 = s.state.meters.lifeSupport.co2MmHg;
    const { x, y } = this.ended || s.paused ? { x: 0, y: 0 } : this.controls.movement();
    const speed = PLAYER_SPEED * moveSpeedFactor(member, co2);
    active.sprite.setVelocity(x * speed, y * speed);
    const activePosition = { x: active.sprite.x / TILE, y: active.sprite.y / TILE };
    const activeZone = zoneAt(this.layout, activePosition);
    if (this.doorBody) this.doorBody.enable = this.outerDoorClosed() && activeZone !== EXTERIOR;

    s.update(dt, { activeZone, activePosition, interacting: this.controls.interactHeld() });

    const choice = this.controls.choiceJustPressed();
    const decision = s.pendingDecisions()[0];
    const option = choice && decision?.options[choice - 1];
    if (option && option.available) s.respond(decision.incident.id, option.response.id);

    this.moveAutoCrew(dt);
    for (const m of s.state.crew) {
      const sprite = this.sprites.get(m.id)!;
      sprite.sync(m);
      this.labels.get(m.id)!.setPosition(sprite.sprite.x, sprite.sprite.y + 16);
    }
    this.renderMap(activePosition, activeZone);
    this.panel.render(this.panelRows());
    if (this.toast.visible && this.time.now > this.toastUntil) this.toast.setVisible(false);
    if (s.outcome && !this.ended) this.showOutcome(s.outcome);
  }

  protected member(id: CrewId): CrewMemberState {
    return this.session.state.crew.find((m) => m.id === id)!;
  }

  protected showToast(text: string): void {
    this.toast.setText(text).setVisible(true);
    this.toastUntil = this.time.now + 4500;
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(getLocale() === 'es' ? 'es-AR' : 'en-US', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
  }

  private nextCrew(): CrewId {
    const ids = this.session.state.crew.map((m) => m.id);
    return ids[(ids.indexOf(this.session.state.activeCrewId) + 1) % ids.length]!;
  }

  private listen(): void {
    const { bus } = this.sceneData;
    const textKey = (definitionId: string) => definitionOf(INCIDENTS, definitionId).textKey;
    const offs = [
      bus.on('crew:switched', ({ crewId }) => {
        const current = this.sprites.get(this.session.state.activeCrewId)!.sprite;
        this.session.switchCrew(crewId, { x: current.x / TILE, y: current.y / TILE });
        this.selectActive();
      }),
      bus.on('incident:warned', (i) => this.showToast(tr(`${textKey(i.definitionId)}.alert`))),
      bus.on('incident:started', (i) => this.showToast(tr(`${textKey(i.definitionId)}.impact`))),
      bus.on('incident:resolved', (i) => this.showToast(t('hud.toast.resolved', { title: tr(`${textKey(i.definitionId)}.title`) }))),
      bus.on('cascade:entered', (e) => this.showToast(tr(`incidents.cascade.${e.meter}.entered`, { name: e.crewId ? NAMES[e.crewId as CrewId] : '' }))),
      bus.on('realEvent:shown', (e) => this.showToast(t('hud.toast.realEvent', { mission: e.mission, instrument: e.instrument }))),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => offs.forEach((off) => off()));
  }

  private selectActive(): void {
    const activeId = this.session.state.activeCrewId;
    for (const [id, sprite] of this.sprites) {
      sprite.setSelected(id === activeId);
      if (id !== activeId) sprite.sprite.setVelocity(0, 0);
      this.colliders.get(id)!.active = id === activeId;
      if (id === activeId) this.cameras.main.startFollow(sprite.sprite, true, 0.15, 0.15, -(GAME_WIDTH - VIEW_WIDTH) / 2, 0);
    }
  }

  /** Los automáticos siguen la posición que calcula la sesión; se mueven por velocidad para que se animen. */
  private moveAutoCrew(dt: number): void {
    for (const [id, view] of this.sprites) {
      if (id === this.session.state.activeCrewId) continue;
      const target = toPx(this.session.positionOf(id));
      const { sprite } = view;
      const dx = target.x - sprite.x;
      const dy = target.y - sprite.y;
      if (Math.hypot(dx, dy) > TILE * 2 || dt <= 0) {
        sprite.setVelocity(0, 0).setPosition(target.x, target.y);
        sprite.body?.reset(target.x, target.y);
      } else sprite.setVelocity(dx / dt, dy / dt);
    }
  }

  private doorBody: Phaser.Physics.Arcade.StaticBody | null = null;

  /** Bloqueo de la puerta exterior de la esclusa, si el lugar tiene exterior. */
  private outerDoorBlock(): Phaser.GameObjects.Zone | null {
    const door = this.layout.exterior?.door;
    if (!door) return null;
    const zone = this.add.zone((door.col + 0.5) * TILE, (door.row + 0.5) * TILE, TILE, TILE);
    this.physics.add.existing(zone, true);
    this.doorBody = zone.body as Phaser.Physics.Arcade.StaticBody;
    return zone;
  }

  private drawMap(): Phaser.GameObjects.Zone[] {
    const g = this.add.graphics();
    const walls: Phaser.GameObjects.Zone[] = [];
    const ext = this.layout.exterior?.rect;
    for (let row = 0; row < this.layout.rows; row++) {
      for (let col = 0; col < this.layout.cols; col++) {
        const x = col * TILE;
        const y = row * TILE;
        if (isWalkable(this.layout, col, row)) {
          const zone = zoneAt(this.layout, { x: col + 0.5, y: row + 0.5 });
          g.fillStyle(zone && ZONE_COLOR[zone] !== undefined ? ZONE_COLOR[zone]! : 0x2d3748, zone === EXTERIOR ? 0.8 : 0.55).fillRect(x, y, TILE, TILE);
          if (zone !== EXTERIOR) g.lineStyle(1, 0x1a202c, 0.6).strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
          else if ((col * 7 + row * 13) % 5 === 0) g.fillStyle(0x7b341e, 0.9).fillCircle(x + 12 + ((col * 17) % 24), y + 12 + ((row * 11) % 24), 3);
          continue;
        }
        const outside = ext && col >= ext.col - 1;
        g.fillStyle(outside ? 0x5c2b1b : 0x4a5568).fillRect(x, y, TILE, TILE);
        if (!outside) g.fillStyle(0x718096).fillRect(x + 2, y + 2, TILE - 4, 5);
        const wall = this.add.zone(x + TILE / 2, y + TILE / 2, TILE, TILE);
        this.physics.add.existing(wall, true);
        walls.push(wall);
      }
    }
    for (const zone of this.layout.zones) {
      const { col, row, cols } = zone.rect;
      this.add
        .text((col + cols / 2) * TILE, row * TILE + 4, tr(`${this.namespace}.zone.${zone.id}`), { fontFamily: 'monospace', fontSize: '11px', color: '#e2e8f0', align: 'center', wordWrap: { width: cols * TILE - 4 } })
        .setOrigin(0.5, 0)
        .setDepth(2);
      const task = this.content.tasks.find((t) => t.zone === zone.id);
      if (!task) continue;
      const spot = toPx(zoneSpot(zone));
      this.stationFrames.set(zone.id, this.add.rectangle(spot.x, spot.y - 30, 44, 26, 0x1a202c, 0.9).setStrokeStyle(2, 0x68d391).setDepth(3));
      this.add.text(spot.x, spot.y - 30, tr(`${this.namespace}.station.${task.id}`), { fontFamily: 'monospace', fontSize: '10px', color: '#e2e8f0' }).setOrigin(0.5).setDepth(4);
      this.add.rectangle(spot.x - 22, spot.y - 12, 44, 4, 0x2d3748).setOrigin(0, 0.5).setDepth(3);
      this.stationBars.set(zone.id, this.add.rectangle(spot.x - 22, spot.y - 12, 0, 4, 0x63b3ed).setOrigin(0, 0.5).setDepth(4));
    }
    return walls;
  }

  private renderMap(activePosition: Point, activeZone: string | null): void {
    const s = this.session;
    const [color, alpha] = LEVEL_TINT[s.level];
    this.tint.setFillStyle(color, alpha);

    for (const [zone, frame] of this.stationFrames) {
      const task = this.content.tasks.find((t) => t.zone === zone)!;
      frame.setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(task.system ? LIGHT[s.state.systems[task.system]] : LIGHT.green).color);
      this.stationBars.get(zone)!.width = 44 * (s.taskAt(zone)?.progress ?? 0);
    }

    const pulse = 0.5 + 0.5 * Math.sin(this.time.now / 200);
    this.markers.clear();
    for (const incident of s.state.activeIncidents) {
      if (incident.definitionId !== 'micrometeoroid' || incident.status !== 'active') continue;
      const p = toPx(zoneSpot(zoneById(this.layout, s.leakZone(incident.id))));
      this.markers.lineStyle(3, 0xfc8181, pulse).strokeCircle(p.x + 40, p.y + 20, 10 + 4 * pulse);
    }
    if (s.level !== 'calm' && s.state.activeIncidents.some((i) => i.definitionId === 'radiationStorm')) {
      const { col, row, cols, rows } = zoneById(this.layout, this.content.shelterZone).rect;
      this.markers.lineStyle(3, 0xf6e05e, pulse).strokeRect(col * TILE + 2, row * TILE + 2, cols * TILE - 4, rows * TILE - 4);
    }
    const door = this.layout.exterior?.door;
    if (door && this.outerDoorClosed()) this.markers.fillStyle(0xe53e3e, 0.8).fillRect(door.col * TILE + 4, door.row * TILE + 4, TILE - 8, TILE - 8);
    this.renderPlace();

    const active = this.sprites.get(s.state.activeCrewId)!.sprite;
    this.prompt.setPosition(active.x, active.y - 18).setText(this.promptText(activePosition, activeZone));
    this.prompt.setVisible(this.prompt.text !== '');
  }

  private promptText(position: Point, zone: string | null): string {
    const s = this.session;
    const member = this.member(s.state.activeCrewId);
    if (member.resting) return t('hud.crew.resting', { name: NAMES[member.id] });
    const place = this.placePrompt(position, zone);
    if (place !== null) return place;
    const task = s.taskAt(zone);
    if (!task) return '';
    if (!s.manual) return t('hud.task.fastForward');
    return task.kind === 'incident' ? t('hud.task.incident', { title: tr(`${task.textKey}.title`) }) : tr(`${this.namespace}.task.${task.task.id}`);
  }

  private panelRows(): PanelRow[] {
    const s = this.session;
    const st = s.state;
    const rules = this.content.meterRules;
    const crewCount = st.crew.length || 1;
    const start = Date.parse(s.window.start);
    const total = Math.round((Date.parse(s.window.end) - start) / DAY_MS);
    const day = Math.min(total, Math.floor((Date.parse(s.simDate) - start) / DAY_MS) + 1);
    const { energy, lifeSupport } = st.meters;
    const meter = (label: string, amount: number, perCrewDay: number): PanelRow => {
      const left = Math.floor(amount / (perCrewDay * crewCount));
      const text = left > 99 ? t('hud.meter.manyDays') : t('hud.meter.days', { days: left });
      return { text: `${label.padEnd(8)} ${bar(left / 60)} ${text}`, color: lightFor(left, 14, 4) };
    };
    // El agua se recicla: lo que se pierde por día depende del estado del reciclador (§3.2).
    const waterLossPerCrewDay = rules.lifeSupport.waterLPerCrewDay * (1 - rules.lifeSupport.recyclingByStatus[st.systems.waterRecycler]);
    const systems = [...new Set(this.content.tasks.flatMap((task) => (task.system ? [task.system] : [])))];

    const rows: PanelRow[] = [
      { text: tr(`common.phase.${s.phase}`), size: 18, color: '#90cdf4' },
      { text: `${this.formatDate(s.simDate)} · ${t(this.namespace === 'mars' ? 'hud.panel.sol' : 'hud.panel.day', { day, total })}`, color: '#a0aec0', size: 12 },
      { text: bar(s.progress, 30), color: '#4a5568', size: 10 },
      { gap: 4, text: `● ${tr(s.reasonKey)}`, color: LEVEL_COLOR[s.level] },
      {
        text: s.paused ? t('hud.panel.paused') : s.manual ? t('hud.panel.pacePlay', { name: NAMES[st.activeCrewId] }) : t('hud.panel.paceFast'),
        color: '#a0aec0',
        size: 12,
      },
      ...this.placeRows(),
      { gap: 6, text: t('hud.panel.meters'), color: '#90cdf4' },
      {
        text: `${t('hud.meter.energy').padEnd(8)} ${bar(energy.batteryKwh / energy.capacityKwh)}`,
        color: lightFor(energy.batteryKwh / energy.capacityKwh, 0.3, 0.1),
      },
      meter(t('hud.meter.air'), lifeSupport.oxygenKg, rules.lifeSupport.oxygenKgPerCrewDay),
      meter(t('hud.meter.water'), lifeSupport.waterL, waterLossPerCrewDay),
      meter(t('hud.meter.food'), st.inventory.foodKg, rules.food.foodKgPerCrewDay),
      {
        text: `${'CO2'.padEnd(8)} ${lifeSupport.co2MmHg > rules.lifeSupport.co2LimitMmHg ? t('hud.meter.co2High') : t('hud.meter.co2Ok')}`,
        color: lifeSupport.co2MmHg > rules.lifeSupport.co2LimitMmHg ? LIGHT.red : lifeSupport.co2MmHg > rules.lifeSupport.co2LimitMmHg - 0.5 ? LIGHT.yellow : LIGHT.green,
      },
      ...systems.map((id) => ({
        text: `${tr(`hud.system.${id}`).padEnd(12)} ● ${tr(`hud.status.${st.systems[id]}`)}`,
        color: LIGHT[st.systems[id]],
        size: 12,
      })),
      { text: `${t('hud.panel.spares', { count: st.inventory.spares })}`, color: '#a0aec0', size: 12 },
      {
        text: `${t('hud.panel.dose', { value: Math.round(s.dose.uGyH) })} · ${t('common.dataDate', { date: this.formatDate(s.dose.date) })}${s.dose.capped ? ` ${t('hud.panel.doseCapped')}` : ''}`,
        color: '#a0aec0',
        size: 11,
      },
      { gap: 6, text: t('hud.panel.crew'), color: '#90cdf4' },
    ];

    for (const m of st.crew) {
      const eff = efficiency(m, lifeSupport.co2MmHg);
      const marker = m.id === st.activeCrewId ? '▶' : ' ';
      const where = m.location === 'corridor' || m.location === EXTERIOR ? `hud.zone.${m.location}` : `${this.namespace}.zone.${m.location}`;
      rows.push({
        text: `${marker} ${NAMES[m.id]} · ${tr(where)}`,
        color: m.resting ? '#a0aec0' : lightFor(eff, 0.8, 0.6),
        onClick: m.id === st.activeCrewId ? undefined : () => this.sceneData.bus.emit('crew:switched', { crewId: m.id }),
      });
      rows.push({
        text: `  ${t('hud.crew.stats', { condition: tenths(m.condition), rest: tenths(1 - m.fatigue), food: tenths(m.nutrition), xrays: Math.round(chestXrays(rules, m.doseMSv)) })}`,
        color: '#a0aec0',
        size: 11,
      });
      if (m.slowReasonKey) rows.push({ text: `  ${tr(m.slowReasonKey, { name: NAMES[m.id] })}`, color: '#fbd38d', size: 11 });
    }

    const decisions = s.pendingDecisions();
    const decided = st.activeIncidents.filter((i) => i.responseId);
    if (decisions.length || decided.length) rows.push({ gap: 6, text: t('hud.panel.incidents'), color: '#90cdf4' });
    decisions.forEach((d, n) => {
      rows.push({ text: `⚠ ${tr(`${d.textKey}.title`)}`, color: d.incident.status === 'active' ? LIGHT.red : LIGHT.yellow });
      if (n === 0) rows.push({ text: t('hud.panel.choose'), color: '#a0aec0', size: 11 });
      d.options.forEach(({ response, available }, i) => {
        const key = n === 0 ? `[${i + 1}] ` : '';
        rows.push({
          text: `${key}● ${tr(`${d.textKey}.response.${response.id}.title`)}`,
          color: available ? LIGHT[response.risk] : '#4a5568',
          onClick: available ? () => s.respond(d.incident.id, response.id) : undefined,
        });
        rows.push({ text: `    ${tr(`${d.textKey}.response.${response.id}.cost`)}`, color: '#718096', size: 11 });
      });
    });
    for (const incident of decided) {
      const def = definitionOf(INCIDENTS, incident.definitionId);
      const response = def.responses.find((r) => r.id === incident.responseId)!;
      const status = response.work
        ? t('hud.panel.working', { progress: bar(incident.progress ?? 0, 8) })
        : tr(`${def.textKey}.response.${response.id}.title`);
      rows.push({ text: `• ${tr(`${def.textKey}.title`)}: ${status}`, color: '#e2e8f0', size: 12 });
    }

    if (s.emergencies.length) rows.push({ gap: 6, text: t('hud.panel.emergency'), color: LIGHT.red });
    const marginKey = this.namespace === 'mars' ? 'incidents.cascade.marginSols' : 'incidents.cascade.margin';
    for (const e of s.emergencies) {
      const name = e.crewId ? NAMES[e.crewId as CrewId] : '';
      const margin = e.overdue ? tr('incidents.cascade.overdue') : tr(marginKey, { days: Math.ceil(e.marginHours / 24) });
      rows.push({ text: `${tr(`hud.meterName.${e.meter}`, { name })}: ${margin}`, color: LIGHT.yellow, size: 12 });
    }
    const sacrifices = s.emergencies.length ? s.sacrifices() : [];
    if (sacrifices.length) rows.push({ text: t('hud.panel.sacrifices'), color: '#a0aec0', size: 11 });
    for (const sacrifice of sacrifices) {
      rows.push({
        text: `● ${tr(`incidents.sacrifice.${sacrifice.id}.title`)}`,
        color: LIGHT.yellow,
        size: 12,
        onClick: () => s.sacrifice(sacrifice.id as SacrificeId),
      });
      rows.push({ text: `    ${tr(`incidents.sacrifice.${sacrifice.id}.cost`)}`, color: '#718096', size: 11 });
    }
    return rows;
  }

  private showOutcome(outcome: 'completed' | 'suspended'): void {
    this.ended = true;
    this.add
      .text(VIEW_WIDTH / 2, GAME_HEIGHT / 2, tr(this.outcomeKey(outcome)), {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#e2e8f0',
        backgroundColor: '#1a202cee',
        padding: { x: 16, y: 12 },
        align: 'center',
        wordWrap: { width: VIEW_WIDTH - 120 },
      })
      .setOrigin(0.5)
      .setDepth(70)
      .setScrollFactor(0);
  }
}
