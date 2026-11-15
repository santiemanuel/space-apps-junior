import Phaser from 'phaser';
import { CREW_ROSTER } from '../../../content/crew';
import { INCIDENTS } from '../../../content/incidents';
import { METER_RULES } from '../../../content/meters';
import { efficiency } from '../../../core/crew/efficiency';
import type { CrewId, CrewMemberState } from '../../../core/crew/types';
import type { SimSnapshot } from '../../../core/habitat/events';
import { definitionOf } from '../../../core/incidents/planner';
import { careerFraction, chestXrays } from '../../../core/meters/dose';
import type { AlertLevel } from '../../../core/meters/types';
import { Rng } from '../../../core/rng/Rng';
import type { SystemStatus } from '../../../core/systems/types';
import { getLocale, t, type TranslationKey, type TranslationParams } from '../../../i18n';
import { GAME_HEIGHT, GAME_WIDTH, TILE } from '../../display';
import { SceneKeys } from '../../sceneKeys';
import { PanelColumn, type PanelRow } from './PanelColumn';
import type { SimulationSceneData } from './simulationData';

/** La vista del mapa ocupa 19 tiles; el resto de la pantalla es el tablero. */
export const VIEW_WIDTH = 19 * TILE;
const DAY_MS = 86_400_000;
const NAMES = Object.fromEntries(CREW_ROSTER.map((c) => [c.id, c.name])) as Record<CrewId, string>;
const LIGHT: Record<SystemStatus, string> = { green: '#68d391', yellow: '#f6e05e', red: '#fc8181' };
const LEVEL_COLOR: Record<AlertLevel, string> = { calm: '#68d391', alert: '#f6e05e', impact: '#fc8181' };
/** Tinte de la interfaz según el nivel del reloj (§3.1): amarillo en Alerta. */
const LEVEL_TINT: Record<AlertLevel, [number, number]> = { calm: [0, 0], alert: [0xecc94b, 0.1], impact: [0xe53e3e, 0.12] };
/** Los cuatro íconos de la salud (§3.2): forma física, descanso, comida y radiación. */
const HEALTH_GLYPHS = ['♥', '☾', '◆', '☢'] as const;

const tr = (key: string, params?: TranslationParams) => t(key as TranslationKey, params);
const bar = (fraction: number, width = 10) => {
  const full = Math.round(Math.min(1, Math.max(0, fraction)) * width);
  return '█'.repeat(full) + '░'.repeat(width - full);
};
/** Semáforo sin porcentajes (§3.6): verde, amarillo o rojo según dos umbrales. */
const lightFor = (value: number, yellowBelow: number, redBelow: number) =>
  value < redBelow ? LIGHT.red : value < yellowBelow ? LIGHT.yellow : LIGHT.green;
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(getLocale() === 'es' ? 'es-AR' : 'en-US', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });

/** Clics por segundo del monitor de partículas: suben con la dosis real y se aceleran en Alerta (§3.1) [regla]. */
export const particleClicksPerSecond = (uGyH: number, level: AlertLevel): number =>
  Math.min(25, 0.5 * Math.sqrt(Math.max(0, uGyH))) * (level === 'alert' ? 2 : level === 'impact' ? 3 : 1);

/**
 * Tablero de la simulación (§3.1, §3.6): reloj con semáforo, fecha y fuente del dato, los tres medidores (la salud
 * con cuatro íconos por tripulante), decisiones con su coste, emergencias y el monitor de partículas con clics.
 * Lee `sim:snapshot` y responde por el bus de la simulación.
 */
export class HudScene extends Phaser.Scene {
  private data_!: SimulationSceneData;
  private snapshot: SimSnapshot | null = null;
  private column!: PanelColumn;
  private tint!: Phaser.GameObjects.Rectangle;
  private monitorDot!: Phaser.GameObjects.Arc;
  private nextClickAt = 0;
  private lastClickAt = -1000;
  private muted = false;
  private readonly rng = new Rng(0x9e1);

  constructor() {
    super(SceneKeys.Hud);
  }

  init(data: SimulationSceneData): void {
    this.snapshot = null;
    this.data_ = data;
  }

  create(): void {
    const { sim } = this.data_;
    this.tint = this.add.rectangle(0, 0, VIEW_WIDTH, GAME_HEIGHT, 0, 0).setOrigin(0, 0);
    this.add.rectangle(VIEW_WIDTH, 0, GAME_WIDTH - VIEW_WIDTH, GAME_HEIGHT, 0x0b1020, 0.96).setOrigin(0, 0);
    this.add.rectangle(VIEW_WIDTH, 0, 2, GAME_HEIGHT, 0x2d3748).setOrigin(0, 0);
    this.column = new PanelColumn(this, VIEW_WIDTH + 18, 12, GAME_WIDTH - VIEW_WIDTH - 32);
    this.monitorDot = this.add.circle(GAME_WIDTH - 22, 0, 5, 0xfbd38d).setVisible(false).setDepth(52);
    this.add
      .text(VIEW_WIDTH + 18, GAME_HEIGHT - 8, t('hud.panel.controls'), { fontFamily: 'monospace', fontSize: '11px', color: '#718096', wordWrap: { width: GAME_WIDTH - VIEW_WIDTH - 32 } })
      .setOrigin(0, 1);
    const off = sim.on('sim:snapshot', (s) => (this.snapshot = s));
    this.input.keyboard?.addKey('M').on('down', () => (this.muted = !this.muted));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
  }

  update(time: number): void {
    const s = this.snapshot;
    if (!s) return;
    const [color, alpha] = LEVEL_TINT[s.level];
    this.tint.setFillStyle(color, alpha);
    this.column.render(this.rows(s));
    this.particleMonitor(s, time);
    // Alerta: el tablero titila un poco, como si la nave sintiera la tormenta que viene (§3.1).
    const camera = this.cameras.main;
    if (s.level === 'alert' && !s.paused) camera.setAlpha(0.9 + 0.1 * this.rng.next()).setScroll(this.rng.next() < 0.1 ? 1 : 0, 0);
    else camera.setAlpha(1).setScroll(0, 0);
  }

  /** Clics tipo contador Geiger con tiempos al azar (con semilla) según la dosis del día. */
  private particleMonitor(s: SimSnapshot, time: number): void {
    const rate = s.paused ? 0 : particleClicksPerSecond(s.dose.uGyH, s.level);
    this.monitorDot.setY(this.monitorY + 8).setVisible(time - this.lastClickAt < 70);
    if (rate <= 0 || time < this.nextClickAt) return;
    this.nextClickAt = time + (-Math.log(1 - this.rng.next()) / rate) * 1000;
    this.lastClickAt = time;
    if (!this.muted) this.click();
  }

  private click(): void {
    const sound = this.sound as Phaser.Sound.WebAudioSoundManager;
    const ctx = sound.context as AudioContext | undefined;
    if (!ctx || ctx.state !== 'running') return;
    const length = Math.floor(ctx.sampleRate * 0.004);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (this.rng.next() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = 0.25;
    source.buffer = buffer;
    source.connect(gain).connect(ctx.destination);
    source.start();
  }

  private monitorY = 0;

  private rows(s: SimSnapshot): PanelRow[] {
    const { sim, bus, namespace } = this.data_!;
    const st = s.state;
    const rules = METER_RULES;
    const crewCount = st.crew.length || 1;
    const start = Date.parse(s.window.start);
    const total = Math.round((Date.parse(s.window.end) - start) / DAY_MS);
    const day = Math.min(total, Math.floor((Date.parse(s.simDate) - start) / DAY_MS) + 1);
    const { energy, lifeSupport } = st.meters;
    const daysOf = (amount: number, perCrewDay: number) => Math.floor(amount / Math.max(1e-9, perCrewDay * crewCount));
    const days = (n: number) => (n > 99 ? t('hud.meter.manyDays') : t('hud.meter.days', { days: n }));
    const recycling = rules.lifeSupport.recyclingByStatus[st.systems.waterRecycler];
    const air = daysOf(lifeSupport.oxygenKg, rules.lifeSupport.oxygenKgPerCrewDay);
    const water = daysOf(lifeSupport.waterL, rules.lifeSupport.waterLPerCrewDay * (1 - recycling));
    const food = daysOf(st.inventory.foodKg, rules.food.foodKgPerCrewDay);
    const co2High = lifeSupport.co2MmHg > rules.lifeSupport.co2LimitMmHg;
    const battery = energy.batteryKwh / energy.capacityKwh;

    const rows: PanelRow[] = [
      { text: tr(`common.phase.${s.phase}`), size: 18, color: '#90cdf4' },
      { text: `${formatDate(s.simDate)} · ${t(s.place === 'mars' ? 'hud.panel.sol' : 'hud.panel.day', { day, total })}`, color: '#a0aec0', size: 12 },
      { text: bar(s.progress, 30), color: '#4a5568', size: 10 },
      { gap: 4, text: `● ${tr(s.reasonKey)}`, color: LEVEL_COLOR[s.level] },
      {
        text: s.paused ? t('hud.panel.paused') : s.manual ? t('hud.panel.pacePlay', { name: NAMES[st.activeCrewId] }) : t('hud.panel.paceFast'),
        color: '#a0aec0',
        size: 12,
      },
      {
        text: `${t('hud.panel.dose', { value: Math.round(s.dose.uGyH) })}${s.dose.capped ? ` ${t('hud.panel.doseCapped')}` : ''}`,
        color: '#a0aec0',
        size: 11,
      },
      // Nunca presentar datos archivados como en vivo: siempre "dato real archivado" con su fecha y su fuente.
      { text: t('hud.panel.source', { date: formatDate(s.dose.date), source: t(`hud.source.${s.place}`) }), color: '#718096', size: 11 },
      { text: t('hud.panel.monitor'), color: '#fbd38d', size: 12 },
    ];
    const monitorRow = rows.length - 1;

    if (s.mars) {
      const w = s.mars.weather;
      rows.push(
        { gap: 4, text: t('mars.panel.curiosity', { sol: w.sol, min: Math.round(w.minTempC), max: w.maxTempC === null ? '?' : Math.round(w.maxTempC) }), color: '#fbd38d', size: 12 },
        { text: tr(`mars.uv.${w.uv ?? 'none'}`), color: w.uv === 'Low' ? LIGHT.red : w.uv === 'Moderate' ? LIGHT.yellow : '#a0aec0', size: 11 },
        {
          text: `${t(s.mars.daylight ? 'mars.panel.day' : 'mars.panel.night')} · ${t(s.mars.evaOpen ? 'mars.panel.evaOpen' : s.mars.daylight ? 'mars.panel.evaBlocked' : 'mars.panel.evaNight')}`,
          color: s.mars.evaOpen ? LIGHT.green : LIGHT.yellow,
          size: 12,
        },
        { text: t('mars.panel.samples', s.mars.samples), color: '#e2e8f0', size: 12 },
      );
    }

    rows.push(
      { gap: 6, text: t('hud.panel.meters'), color: '#90cdf4' },
      { text: `${t('hud.meter.energy').padEnd(13)} ${bar(battery)}`, color: lightFor(battery, 0.3, 0.1) },
      {
        text: `${t('hud.meter.lifeSupport').padEnd(13)} ${bar(Math.min(air, water) / 60)}`,
        color: co2High ? LIGHT.red : lightFor(Math.min(air, water), 14, 4),
      },
      {
        text: `  ${t('hud.meter.air')} ${days(air)} · ${t('hud.meter.water')} ${days(water)} · CO2 ${co2High ? t('hud.meter.co2High') : t('hud.meter.co2Ok')}`,
        color: '#a0aec0',
        size: 11,
      },
      { text: `  ${t('hud.meter.food')} ${days(food)} · ${t('hud.panel.spares', { count: st.inventory.spares })}`, color: lightFor(food, 14, 4), size: 11 },
      { text: `${t('hud.meter.health')}  ${t('hud.panel.healthLegend')}`, color: '#e2e8f0', gap: 2 },
    );

    for (const m of st.crew) {
      const where = m.location === 'corridor' || m.location === 'exterior' ? `hud.zone.${m.location}` : `${namespace}.zone.${m.location}`;
      rows.push({
        text: `${m.id === st.activeCrewId ? '▶' : ' '} ${NAMES[m.id]} · ${tr(where)}`,
        color: m.resting ? '#a0aec0' : lightFor(efficiency(m, lifeSupport.co2MmHg), 0.8, 0.6),
        icons: this.healthIcons(m),
        onClick: m.id === st.activeCrewId ? undefined : () => bus.emit('crew:switched', { crewId: m.id }),
      });
      if (m.slowReasonKey) rows.push({ text: `  ${tr(m.slowReasonKey, { name: NAMES[m.id] })}`, color: '#fbd38d', size: 11 });
    }
    const worst = Math.max(...st.crew.map((m) => m.doseMSv));
    rows.push({ text: `  ${t('hud.panel.xrays', { xrays: Math.round(chestXrays(rules, worst)) })}`, color: '#718096', size: 11 });

    const decided = st.activeIncidents.filter((i) => i.responseId);
    if (s.decisions.length || decided.length) rows.push({ gap: 6, text: t('hud.panel.incidents'), color: '#90cdf4' });
    s.decisions.forEach((d, n) => {
      const hint = s.hints.find((h) => h.incidentId === d.incident.id)?.responseId;
      rows.push({ text: `⚠ ${tr(`${d.textKey}.title`)}`, color: d.incident.status === 'active' ? LIGHT.red : LIGHT.yellow });
      if (n === 0) rows.push({ text: t('hud.panel.choose'), color: '#a0aec0', size: 11 });
      d.options.forEach(({ response, available }, i) => {
        rows.push({
          text: `${n === 0 ? `[${i + 1}] ` : ''}● ${tr(`${d.textKey}.response.${response.id}.title`)}${hint === response.id ? ` ${t('hud.panel.hint')}` : ''}`,
          color: available ? LIGHT[response.risk] : '#4a5568',
          onClick: available ? () => sim.emit('sim:respond', { incidentId: d.incident.id, responseId: response.id }) : undefined,
        });
        rows.push({ text: `    ${tr(`${d.textKey}.response.${response.id}.cost`)}`, color: '#718096', size: 11 });
      });
    });
    for (const incident of decided) {
      const def = definitionOf(INCIDENTS, incident.definitionId);
      const response = def.responses.find((r) => r.id === incident.responseId)!;
      const status = response.work ? t('hud.panel.working', { progress: bar(incident.progress ?? 0, 8) }) : tr(`${def.textKey}.response.${response.id}.title`);
      rows.push({ text: `• ${tr(`${def.textKey}.title`)}: ${status}`, color: '#e2e8f0', size: 12 });
    }

    if (s.emergencies.length) rows.push({ gap: 6, text: t('hud.panel.emergency'), color: LIGHT.red });
    const marginKey = s.place === 'mars' ? 'incidents.cascade.marginSols' : 'incidents.cascade.margin';
    for (const e of s.emergencies) {
      const margin = e.overdue ? tr('incidents.cascade.overdue') : tr(marginKey, { days: Math.ceil(e.marginHours / 24) });
      rows.push({ text: `${tr(`hud.meterName.${e.meter}`, { name: e.crewId ? NAMES[e.crewId as CrewId] : '' })}: ${margin}`, color: LIGHT.yellow, size: 12 });
    }
    if (s.sacrifices.length) rows.push({ text: t('hud.panel.sacrifices'), color: '#a0aec0', size: 11 });
    for (const id of s.sacrifices) {
      rows.push({ text: `● ${tr(`incidents.sacrifice.${id}.title`)}`, color: LIGHT.yellow, size: 12, onClick: () => sim.emit('sim:sacrifice', { id }) });
      rows.push({ text: `    ${tr(`incidents.sacrifice.${id}.cost`)}`, color: '#718096', size: 11 });
    }
    this.monitorY = this.column.rowY(monitorRow);
    return rows;
  }

  private healthIcons(m: CrewMemberState): { glyph: string; color: string }[] {
    const dose = careerFraction(METER_RULES, m.doseMSv);
    const colors = [
      lightFor(m.condition, 0.7, 0.4),
      lightFor(1 - m.fatigue, 0.6, 0.3),
      lightFor(m.nutrition, 0.8, 0.5),
      dose >= 0.8 ? LIGHT.red : dose >= 0.5 ? LIGHT.yellow : LIGHT.green,
    ];
    return HEALTH_GLYPHS.map((glyph, i) => ({ glyph, color: m.resting ? '#718096' : colors[i]! }));
  }
}
