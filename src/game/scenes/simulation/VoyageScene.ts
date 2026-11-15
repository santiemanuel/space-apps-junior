import Phaser from 'phaser';
import { CREW_ROSTER } from '../../../content/crew';
import { INCIDENTS } from '../../../content/incidents';
import { VOYAGE_CONTENT } from '../../../content/ship';
import type { SacrificeId } from '../../../core/cascade/sacrifices';
import { efficiency, moveSpeedFactor } from '../../../core/crew/efficiency';
import type { CrewId, CrewMemberState } from '../../../core/crew/types';
import { definitionOf } from '../../../core/incidents/planner';
import { chestXrays } from '../../../core/meters/dose';
import type { AlertLevel } from '../../../core/meters/types';
import type { SystemStatus } from '../../../core/systems/types';
import { isWalkable, zoneAt, zoneById, zoneSpot, type Point } from '../../../core/voyage/ship';
import { VoyageSession } from '../../../core/voyage/VoyageSession';
import { incidentTimeline } from '../../../data/incidentTimeline';
import { seriesFor } from '../../../data/realData';
import { getLocale, t, type TranslationKey, type TranslationParams } from '../../../i18n';
import { GAME_HEIGHT, GAME_WIDTH, TILE } from '../../display';
import { createCrewSprite, type CrewSprite } from '../../entities/CrewSprite';
import { createKeyboardControls, type PlayerControls } from '../../input/PlayerControls';
import { SceneKeys } from '../../sceneKeys';
import type { VoyageSceneData } from '../sceneData';
import { VoyagePanel, type PanelRow } from './VoyagePanel';

const SHIP = VOYAGE_CONTENT.ship;
const MAP_WIDTH = SHIP.cols * TILE;
const PLAYER_SPEED = 160;
const DAY_MS = 86_400_000;
const NAMES = Object.fromEntries(CREW_ROSTER.map((c) => [c.id, c.name])) as Record<CrewId, string>;

const ZONE_COLOR: Record<string, number> = {
  command: 0x2c5282,
  exercise: 0x276749,
  scrubber: 0x285e61,
  recycler: 0x2a4365,
  infirmary: 0x553c9a,
  pantry: 0x744210,
  shelter: 0x2b6cb0,
  radio: 0x702459,
};
const LIGHT: Record<SystemStatus, string> = { green: '#68d391', yellow: '#f6e05e', red: '#fc8181' };
const LEVEL_COLOR: Record<AlertLevel, string> = { calm: '#68d391', alert: '#f6e05e', impact: '#fc8181' };
const LEVEL_TINT: Record<AlertLevel, [number, number]> = { calm: [0, 0], alert: [0xecc94b, 0.08], impact: [0xe53e3e, 0.1] };

const tr = (key: string, params?: TranslationParams) => t(key as TranslationKey, params);
const bar = (fraction: number, width = 10) => {
  const full = Math.round(Math.min(1, Math.max(0, fraction)) * width);
  return '█'.repeat(full) + '░'.repeat(width - full);
};
const tenths = (x: number) => Math.round(Math.min(1, Math.max(0, x)) * 10);
const lightFor = (value: number, yellowBelow: number, redBelow: number) =>
  value < redBelow ? LIGHT.red : value < yellowBelow ? LIGHT.yellow : LIGHT.green;
const toPx = (p: Point) => ({ x: p.x * TILE, y: p.y * TILE });

/**
 * Viaje de ida y de vuelta (game-design §4.2, §4.6): mapa top-down de la nave con la tripulación. Sólo pinta y
 * lee la entrada; las reglas están en `VoyageSession` (src/core/voyage/).
 */
export class VoyageScene extends Phaser.Scene {
  private data_!: VoyageSceneData;
  private session!: VoyageSession;
  private controls!: PlayerControls;
  private sprites = new Map<CrewId, CrewSprite>();
  private colliders = new Map<CrewId, Phaser.Physics.Arcade.Collider>();
  private labels = new Map<CrewId, Phaser.GameObjects.Text>();
  private stationBars = new Map<string, Phaser.GameObjects.Rectangle>();
  private stationFrames = new Map<string, Phaser.GameObjects.Rectangle>();
  private markers!: Phaser.GameObjects.Graphics;
  private tint!: Phaser.GameObjects.Rectangle;
  private prompt!: Phaser.GameObjects.Text;
  private toast!: Phaser.GameObjects.Text;
  private toastUntil = 0;
  private panel!: VoyagePanel;
  private ended = false;

  constructor() {
    super(SceneKeys.Voyage);
  }

  init(data: VoyageSceneData): void {
    this.data_ = data;
    this.sprites = new Map();
    this.colliders = new Map();
    this.labels = new Map();
    this.stationBars = new Map();
    this.stationFrames = new Map();
    this.ended = false;
  }

  create(): void {
    const { state, bus, leg } = this.data_;
    const phase = leg === 'out' ? 'cruiseOut' : 'cruiseBack';
    const window = VOYAGE_CONTENT.calendar.windows[phase];
    this.session = new VoyageSession({
      leg,
      state,
      bus,
      content: VOYAGE_CONTENT,
      timeline: incidentTimeline(phase, window, INCIDENTS, VOYAGE_CONTENT.incidentRules),
      doseRate: (date) => seriesFor(phase, date).dose,
    });
    this.controls = createKeyboardControls(this);

    const walls = this.drawShip();
    this.markers = this.add.graphics().setDepth(5);
    this.tint = this.add.rectangle(0, 0, MAP_WIDTH, GAME_HEIGHT, 0, 0).setOrigin(0, 0).setDepth(40);
    for (const m of this.session.state.crew) {
      const p = toPx(this.session.positionOf(m.id));
      const sprite = createCrewSprite(this, m.id, p.x, p.y);
      this.sprites.set(m.id, sprite);
      this.colliders.set(m.id, this.physics.add.collider(sprite.sprite, walls));
      this.labels.set(m.id, this.add.text(p.x, p.y + 18, NAMES[m.id], { fontFamily: 'monospace', fontSize: '11px', color: '#e2e8f0' }).setOrigin(0.5, 0).setDepth(11));
    }
    this.selectActive();
    this.prompt = this.add
      .text(0, 0, '', { fontFamily: 'monospace', fontSize: '12px', color: '#fbd38d', backgroundColor: '#1a202ccc', padding: { x: 4, y: 2 } })
      .setOrigin(0.5, 1)
      .setDepth(45);
    this.toast = this.add
      .text(MAP_WIDTH / 2, 12, '', { fontFamily: 'monospace', fontSize: '14px', color: '#fbd38d', backgroundColor: '#1a202cee', padding: { x: 8, y: 4 }, align: 'center', wordWrap: { width: MAP_WIDTH - 80 } })
      .setOrigin(0.5, 0)
      .setDepth(60)
      .setVisible(false);
    this.panel = new VoyagePanel(this, MAP_WIDTH + 20, 14, GAME_WIDTH - MAP_WIDTH - 36, GAME_HEIGHT);
    this.add
      .text(MAP_WIDTH + 20, GAME_HEIGHT - 10, t('voyage.panel.controls'), { fontFamily: 'monospace', fontSize: '11px', color: '#718096', wordWrap: { width: GAME_WIDTH - MAP_WIDTH - 36 } })
      .setOrigin(0, 1)
      .setDepth(51);

    this.listen();
    const keyboard = this.input.keyboard!;
    keyboard.addKey('P').on('down', () => this.session.togglePause());
    // Provisional hasta F2: Tab y `crew:switched` son de Facundo (src/game/input/); quitar en la integración.
    keyboard.addCapture('TAB');
    keyboard.addKey('TAB').on('down', () => bus.emit('crew:switched', { crewId: this.nextCrew() }));
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
    const activeZone = zoneAt(SHIP, { x: active.sprite.x / TILE, y: active.sprite.y / TILE });

    s.update(dt, { activeZone, interacting: this.controls.interactHeld() });

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
    this.renderMap(activeZone);
    this.panel.render(this.panelRows());
    if (this.toast.visible && this.time.now > this.toastUntil) this.toast.setVisible(false);
    if (s.outcome && !this.ended) this.showOutcome(s.outcome);
  }

  private member(id: CrewId): CrewMemberState {
    return this.session.state.crew.find((m) => m.id === id)!;
  }

  private nextCrew(): CrewId {
    const ids = this.session.state.crew.map((m) => m.id);
    return ids[(ids.indexOf(this.session.state.activeCrewId) + 1) % ids.length]!;
  }

  private listen(): void {
    const { bus } = this.data_;
    const textKey = (definitionId: string) => definitionOf(INCIDENTS, definitionId).textKey;
    const offs = [
      bus.on('crew:switched', ({ crewId }) => {
        const current = this.sprites.get(this.session.state.activeCrewId)!.sprite;
        this.session.switchCrew(crewId, { x: current.x / TILE, y: current.y / TILE });
        this.selectActive();
      }),
      bus.on('incident:warned', (i) => this.showToast(tr(`${textKey(i.definitionId)}.alert`))),
      bus.on('incident:started', (i) => this.showToast(tr(`${textKey(i.definitionId)}.impact`))),
      bus.on('incident:resolved', (i) => this.showToast(t('voyage.toast.resolved', { title: tr(`${textKey(i.definitionId)}.title`) }))),
      bus.on('cascade:entered', (e) => this.showToast(tr(`incidents.cascade.${e.meter}.entered`, { name: e.crewId ? NAMES[e.crewId as CrewId] : '' }))),
      bus.on('realEvent:shown', (e) => this.showToast(t('voyage.toast.realEvent', { mission: e.mission, instrument: e.instrument }))),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => offs.forEach((off) => off()));
  }

  private selectActive(): void {
    const activeId = this.session.state.activeCrewId;
    for (const [id, sprite] of this.sprites) {
      sprite.setSelected(id === activeId);
      if (id !== activeId) sprite.sprite.setVelocity(0, 0);
      this.colliders.get(id)!.active = id === activeId;
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

  private drawShip(): Phaser.GameObjects.Zone[] {
    const g = this.add.graphics();
    const walls: Phaser.GameObjects.Zone[] = [];
    for (let row = 0; row < SHIP.rows; row++) {
      for (let col = 0; col < SHIP.cols; col++) {
        const x = col * TILE;
        const y = row * TILE;
        if (isWalkable(SHIP, col, row)) {
          const zone = zoneAt(SHIP, { x: col + 0.5, y: row + 0.5 });
          g.fillStyle(zone && ZONE_COLOR[zone] !== undefined ? ZONE_COLOR[zone]! : 0x2d3748, 0.55).fillRect(x, y, TILE, TILE);
          g.lineStyle(1, 0x1a202c, 0.6).strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
          continue;
        }
        g.fillStyle(0x4a5568).fillRect(x, y, TILE, TILE);
        g.fillStyle(0x718096).fillRect(x + 2, y + 2, TILE - 4, 5);
        const wall = this.add.zone(x + TILE / 2, y + TILE / 2, TILE, TILE);
        this.physics.add.existing(wall, true);
        walls.push(wall);
      }
    }
    for (const zone of SHIP.zones) {
      const { col, row, cols } = zone.rect;
      this.add
        .text((col + cols / 2) * TILE, row * TILE + 4, tr(`voyage.zone.${zone.id}`), { fontFamily: 'monospace', fontSize: '11px', color: '#e2e8f0' })
        .setOrigin(0.5, 0)
        .setDepth(2);
      const task = VOYAGE_CONTENT.tasks.find((t) => t.zone === zone.id);
      if (!task) continue;
      const spot = toPx(zoneSpot(zone));
      this.stationFrames.set(zone.id, this.add.rectangle(spot.x, spot.y - 30, 40, 26, 0x1a202c, 0.9).setStrokeStyle(2, 0x68d391).setDepth(3));
      this.add.text(spot.x, spot.y - 30, tr(`voyage.station.${task.id}`), { fontFamily: 'monospace', fontSize: '10px', color: '#e2e8f0' }).setOrigin(0.5).setDepth(4);
      this.add.rectangle(spot.x - 20, spot.y - 12, 40, 4, 0x2d3748).setOrigin(0, 0.5).setDepth(3);
      this.stationBars.set(zone.id, this.add.rectangle(spot.x - 20, spot.y - 12, 0, 4, 0x63b3ed).setOrigin(0, 0.5).setDepth(4));
    }
    return walls;
  }

  private renderMap(activeZone: string | null): void {
    const s = this.session;
    const [color, alpha] = LEVEL_TINT[s.level];
    this.tint.setFillStyle(color, alpha);

    for (const [zone, frame] of this.stationFrames) {
      const task = VOYAGE_CONTENT.tasks.find((t) => t.zone === zone)!;
      frame.setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(task.system ? LIGHT[s.state.systems[task.system]] : LIGHT.green).color);
      this.stationBars.get(zone)!.width = 40 * (s.taskAt(zone)?.progress ?? 0);
    }

    const pulse = 0.5 + 0.5 * Math.sin(this.time.now / 200);
    this.markers.clear();
    for (const incident of s.state.activeIncidents) {
      if (incident.definitionId !== 'micrometeoroid' || incident.status !== 'active') continue;
      const p = toPx(zoneSpot(zoneById(SHIP, s.leakZone(incident.id))));
      this.markers.lineStyle(3, 0xfc8181, pulse).strokeCircle(p.x + 40, p.y + 20, 10 + 4 * pulse);
    }
    if (s.level !== 'calm' && s.state.activeIncidents.some((i) => i.definitionId === 'radiationStorm')) {
      const { col, row, cols, rows } = zoneById(SHIP, VOYAGE_CONTENT.shelterZone).rect;
      this.markers.lineStyle(3, 0xf6e05e, pulse).strokeRect(col * TILE + 2, row * TILE + 2, cols * TILE - 4, rows * TILE - 4);
    }

    const active = this.sprites.get(s.state.activeCrewId)!.sprite;
    this.prompt.setPosition(active.x, active.y - 18).setText(this.promptText(activeZone));
    this.prompt.setVisible(this.prompt.text !== '');
  }

  private promptText(zone: string | null): string {
    const s = this.session;
    const member = this.member(s.state.activeCrewId);
    if (member.resting) return t('voyage.crew.resting', { name: NAMES[member.id] });
    const task = s.taskAt(zone);
    if (!task) return '';
    if (!s.manual) return t('voyage.task.fastForward');
    return task.kind === 'incident' ? t('voyage.task.incident', { title: tr(`${task.textKey}.title`) }) : tr(`voyage.task.${task.task.id}`);
  }

  private panelRows(): PanelRow[] {
    const s = this.session;
    const st = s.state;
    const rules = VOYAGE_CONTENT.meterRules;
    const crewCount = st.crew.length || 1;
    const start = Date.parse(s.window.start);
    const total = Math.round((Date.parse(s.window.end) - start) / DAY_MS);
    const day = Math.min(total, Math.floor((Date.parse(s.simDate) - start) / DAY_MS) + 1);
    const { energy, lifeSupport } = st.meters;
    const meter = (label: string, amount: number, perCrewDay: number): PanelRow => {
      const left = Math.floor(amount / (perCrewDay * crewCount));
      const text = left > 99 ? t('voyage.meter.manyDays') : t('voyage.meter.days', { days: left });
      return { text: `${label.padEnd(8)} ${bar(left / 60)} ${text}`, color: lightFor(left, 14, 4) };
    };
    // El agua se recicla: lo que se pierde por día depende del estado del reciclador (§3.2).
    const waterLossPerCrewDay = rules.lifeSupport.waterLPerCrewDay * (1 - rules.lifeSupport.recyclingByStatus[st.systems.waterRecycler]);

    const rows: PanelRow[] = [
      { text: tr(`common.phase.${s.phase}`), size: 18, color: '#90cdf4' },
      { text: `${this.formatDate(s.simDate)} · ${t('voyage.panel.day', { day, total })}`, color: '#a0aec0', size: 12 },
      { text: bar(s.progress, 30), color: '#4a5568', size: 10 },
      { gap: 4, text: `● ${tr(s.reasonKey)}`, color: LEVEL_COLOR[s.level] },
      {
        text: s.paused ? t('voyage.panel.paused') : s.manual ? t('voyage.panel.pacePlay', { name: NAMES[st.activeCrewId] }) : t('voyage.panel.paceFast'),
        color: '#a0aec0',
        size: 12,
      },
      { gap: 6, text: t('voyage.panel.meters'), color: '#90cdf4' },
      {
        text: `${t('voyage.meter.energy').padEnd(8)} ${bar(energy.batteryKwh / energy.capacityKwh)}`,
        color: lightFor(energy.batteryKwh / energy.capacityKwh, 0.3, 0.1),
      },
      meter(t('voyage.meter.air'), lifeSupport.oxygenKg, rules.lifeSupport.oxygenKgPerCrewDay),
      meter(t('voyage.meter.water'), lifeSupport.waterL, waterLossPerCrewDay),
      meter(t('voyage.meter.food'), st.inventory.foodKg, rules.food.foodKgPerCrewDay),
      {
        text: `${'CO2'.padEnd(8)} ${lifeSupport.co2MmHg > rules.lifeSupport.co2LimitMmHg ? t('voyage.meter.co2High') : t('voyage.meter.co2Ok')}`,
        color: lifeSupport.co2MmHg > rules.lifeSupport.co2LimitMmHg ? LIGHT.red : lifeSupport.co2MmHg > rules.lifeSupport.co2LimitMmHg - 0.5 ? LIGHT.yellow : LIGHT.green,
      },
      ...(['scrubber', 'waterRecycler'] as const).map((id) => ({
        text: `${tr(`voyage.system.${id}`).padEnd(12)} ● ${tr(`voyage.status.${st.systems[id]}`)}`,
        color: LIGHT[st.systems[id]],
        size: 12,
      })),
      { text: `${t('voyage.panel.spares', { count: st.inventory.spares })}`, color: '#a0aec0', size: 12 },
      {
        text: `${t('voyage.panel.dose', { value: Math.round(s.dose.uGyH) })} · ${t('common.dataDate', { date: this.formatDate(s.dose.date) })}${s.dose.capped ? ` ${t('voyage.panel.doseCapped')}` : ''}`,
        color: '#a0aec0',
        size: 11,
      },
      { gap: 6, text: t('voyage.panel.crew'), color: '#90cdf4' },
    ];

    for (const m of st.crew) {
      const eff = efficiency(m, lifeSupport.co2MmHg);
      const marker = m.id === st.activeCrewId ? '▶' : ' ';
      rows.push({
        text: `${marker} ${NAMES[m.id]} · ${tr(`voyage.zone.${m.location}`)}`,
        color: m.resting ? '#a0aec0' : lightFor(eff, 0.8, 0.6),
        onClick: m.id === st.activeCrewId ? undefined : () => this.data_.bus.emit('crew:switched', { crewId: m.id }),
      });
      rows.push({
        text: `  ${t('voyage.crew.stats', { condition: tenths(m.condition), rest: tenths(1 - m.fatigue), food: tenths(m.nutrition), xrays: Math.round(chestXrays(rules, m.doseMSv)) })}`,
        color: '#a0aec0',
        size: 11,
      });
      if (m.slowReasonKey) rows.push({ text: `  ${tr(m.slowReasonKey, { name: NAMES[m.id] })}`, color: '#fbd38d', size: 11 });
    }

    const decisions = s.pendingDecisions();
    const decided = st.activeIncidents.filter((i) => i.responseId);
    if (decisions.length || decided.length) rows.push({ gap: 6, text: t('voyage.panel.incidents'), color: '#90cdf4' });
    decisions.forEach((d, n) => {
      rows.push({ text: `⚠ ${tr(`${d.textKey}.title`)}`, color: d.incident.status === 'active' ? LIGHT.red : LIGHT.yellow });
      if (n === 0) rows.push({ text: t('voyage.panel.choose'), color: '#a0aec0', size: 11 });
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
        ? t('voyage.panel.working', { progress: bar(incident.progress ?? 0, 8) })
        : tr(`${def.textKey}.response.${response.id}.title`);
      rows.push({ text: `• ${tr(`${def.textKey}.title`)}: ${status}`, color: '#e2e8f0', size: 12 });
    }

    if (s.emergencies.length) rows.push({ gap: 6, text: t('voyage.panel.emergency'), color: LIGHT.red });
    for (const e of s.emergencies) {
      const name = e.crewId ? NAMES[e.crewId as CrewId] : '';
      const margin = e.overdue ? tr('incidents.cascade.overdue') : tr('incidents.cascade.margin', { days: Math.ceil(e.marginHours / 24) });
      rows.push({ text: `${tr(`voyage.meterName.${e.meter}`, { name })}: ${margin}`, color: LIGHT.yellow, size: 12 });
    }
    const sacrifices = s.emergencies.length ? s.sacrifices() : [];
    if (sacrifices.length) rows.push({ text: t('voyage.panel.sacrifices'), color: '#a0aec0', size: 11 });
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

  private formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(getLocale() === 'es' ? 'es-AR' : 'en-US', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
  }

  private showToast(text: string): void {
    this.toast.setText(text).setVisible(true);
    this.toastUntil = this.time.now + 4500;
  }

  private showOutcome(outcome: 'completed' | 'suspended'): void {
    this.ended = true;
    this.add
      .text(MAP_WIDTH / 2, GAME_HEIGHT / 2, t(outcome === 'completed' ? `voyage.outcome.${this.session.leg}` : 'voyage.outcome.suspended'), {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#e2e8f0',
        backgroundColor: '#1a202cee',
        padding: { x: 16, y: 12 },
        align: 'center',
        wordWrap: { width: MAP_WIDTH - 120 },
      })
      .setOrigin(0.5)
      .setDepth(70);
  }
}
