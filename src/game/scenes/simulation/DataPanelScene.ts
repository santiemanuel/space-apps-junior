import Phaser from 'phaser';
import { INCIDENT_RULES } from '../../../content/incidents';
import { noticesBetween } from '../../../core/environment/notices';
import type { DoseSite } from '../../../core/environment/series';
import type { SimSnapshot } from '../../../core/habitat/events';
import { DONKI_NOTICES } from '../../../data/notices';
import { cruiseSiteFor, eventsBetween } from '../../../data/realData';
import { doseDaysBetween, galeWeatherBetween, SERIES_URLS } from '../../../data/series';
import { getLocale, t, type TranslationKey } from '../../../i18n';
import { GAME_HEIGHT } from '../../display';
import { SceneKeys } from '../../sceneKeys';
import { VIEW_WIDTH } from './HudScene';
import type { SimulationSceneData } from './simulationData';

const DAY_MS = 86_400_000;
/** Días que se muestran antes y después de la fecha del jugador. */
const SPAN_DAYS = 20;
const LEFT = 64;
const RIGHT = VIEW_WIDTH - 32;
const UV_COLOR = { Very_High: 0x63b3ed, High: 0x63b3ed, Moderate: 0xd69e2e, Low: 0x9c4221 } as const;
const NOTICE_COLOR = { flare: 0xed8936, sep: 0xfc8181, cmeMars: 0xb794f4 } as const;
const tr = (key: string, params?: Record<string, string | number>) => t(key as TranslationKey, params);
const short = (iso: string) =>
  new Date(iso).toLocaleDateString(getLocale() === 'es' ? 'es-AR' : 'en-US', { timeZone: 'UTC', day: 'numeric', month: 'short' });

interface Chart {
  top: number;
  height: number;
  from: number;
  to: number;
  min: number;
  max: number;
}

/**
 * Panel de datos (§3.8.2): gráficas de los datos reales alrededor de la fecha simulada, con la posición del jugador
 * marcada en el tiempo. Dosis de la serie de la fase con sus eventos reales y, en Marte, el frío y el polvo de REMS;
 * en el viaje, los avisos de DONKI. Se abre con G y pausa el reloj mientras se mira.
 */
export class DataPanelScene extends Phaser.Scene {
  private data_!: SimulationSceneData;
  private drawnFor = '';

  constructor() {
    super(SceneKeys.DataPanel);
  }

  init(data: SimulationSceneData): void {
    this.data_ = data;
    this.drawnFor = '';
  }

  create(): void {
    const { sim } = this.data_;
    this.add.rectangle(0, 0, VIEW_WIDTH, GAME_HEIGHT, 0x05070d, 0.95).setOrigin(0, 0).setInteractive();
    const layer = this.add.container(0, 0);
    const off = sim.on('sim:snapshot', (s) => {
      if (this.drawnFor === s.simDate.slice(0, 10)) return;
      this.drawnFor = s.simDate.slice(0, 10);
      layer.removeAll(true);
      this.draw(s, layer);
    });
    sim.emit('sim:pause', { paused: true });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      off();
      sim.emit('sim:pause', { paused: false });
    });
  }

  private draw(s: SimSnapshot, layer: Phaser.GameObjects.Container): void {
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      layer.add(o);
      return o;
    };
    const text = (x: number, y: number, value: string, color = '#e2e8f0', size = 12) =>
      add(this.add.text(x, y, value, { fontFamily: 'monospace', fontSize: `${size}px`, color, wordWrap: { width: RIGHT - x } }));
    const now = Date.parse(s.simDate);
    const from = now - SPAN_DAYS * DAY_MS;
    const to = now + SPAN_DAYS * DAY_MS;
    const iso = (ms: number) => new Date(ms).toISOString();
    const site: DoseSite = s.place === 'mars' ? 'marsSurface' : cruiseSiteFor(s.simDate);
    const g = add(this.add.graphics());

    text(24, 14, t('hud.dataPanel.sceneTitle'), '#90cdf4', 20);
    text(24, 42, t('hud.dataPanel.subtitle', { date: short(s.simDate) }), '#a0aec0');
    text(RIGHT - 200, 18, t('hud.dataPanel.close'), '#718096', 11);

    // Dosis real de la fase.
    const dose = doseDaysBetween(site, iso(from), iso(to));
    const doseChart: Chart = { top: 96, height: 200, from, to, min: 0, max: Math.max(10, ...dose.map((d) => d.uGyH)) * 1.1 };
    text(LEFT, 72, t('hud.dataPanel.dose', { site: t(`hud.dataPanel.site.${site}`) }), '#fbd38d');
    this.axes(g, doseChart, text, 'μGy/h');
    g.lineStyle(2, 0xfbd38d);
    g.beginPath();
    dose.forEach((d, i) => {
      const p = this.point(doseChart, Date.parse(d.date), d.uGyH);
      if (i === 0) g.moveTo(p.x, p.y);
      else g.lineTo(p.x, p.y);
    });
    g.strokePath();
    for (const d of dose.filter((x) => x.capped)) {
      const p = this.point(doseChart, Date.parse(d.date), d.uGyH);
      g.fillStyle(0xfc8181).fillCircle(p.x, p.y, 4);
    }
    // Sólo los eventos del lugar: Curiosity en Marte; BioSentinel/TGO en el viaje.
    const here = (mission: string) => (s.place === 'mars') === (mission === 'Curiosity');
    for (const e of eventsBetween(iso(from), iso(to), INCIDENT_RULES).filter((x) => here(x.mission))) {
      const x = this.point(doseChart, Date.parse(e.date), 0).x;
      g.fillStyle(0xfc8181).fillTriangle(x, doseChart.top + 4, x - 5, doseChart.top - 6, x + 5, doseChart.top - 6);
      text(x + 6, doseChart.top - 12, `${e.mission}`, '#fc8181', 10);
    }
    this.youAreHere(g, doseChart, now, text);
    text(LEFT, doseChart.top + doseChart.height + 22, t('hud.dataPanel.source', { url: SERIES_URLS[site] }), '#718096', 10);

    // Segunda gráfica: frío y polvo en Marte; avisos de DONKI en el viaje.
    const second: Chart = { top: 400, height: 170, from, to, min: -100, max: -40 };
    if (s.place === 'mars') {
      const weather = galeWeatherBetween(iso(from), iso(to));
      text(LEFT, 376, t('hud.dataPanel.weather'), '#90cdf4');
      this.axes(g, second, text, '°C');
      for (const w of weather) {
        const x = this.point(second, Date.parse(w.date), 0).x;
        if (w.uv) g.fillStyle(UV_COLOR[w.uv], 0.5).fillRect(x - 3, second.top + second.height - 10, 6, 10);
      }
      g.lineStyle(2, 0x63b3ed);
      g.beginPath();
      weather.forEach((w, i) => {
        const p = this.point(second, Date.parse(w.date), w.minTempC);
        if (i === 0) g.moveTo(p.x, p.y);
        else g.lineTo(p.x, p.y);
      });
      g.strokePath();
      text(LEFT, second.top + second.height + 22, t('hud.dataPanel.weatherLegend', { url: SERIES_URLS.galeWeather }), '#718096', 10);
    } else {
      const notices = noticesBetween(DONKI_NOTICES, iso(from), iso(to));
      text(LEFT, 376, t('hud.dataPanel.notices'), '#90cdf4');
      const lanes = ['flare', 'sep', 'cmeMars'] as const;
      lanes.forEach((kind, lane) => {
        const y = second.top + 20 + lane * 48;
        text(LEFT, y - 18, t(`hud.dataPanel.notice.${kind}`), `#${NOTICE_COLOR[kind].toString(16)}`, 11);
        g.lineStyle(1, 0x2d3748).lineBetween(LEFT, y + 8, RIGHT, y + 8);
        for (const n of notices.filter((x) => x.kind === kind)) {
          const x = this.point(second, Date.parse(n.issuedAt), 0).x;
          g.fillStyle(NOTICE_COLOR[kind]).fillRect(x - 2, y, 4, 16);
        }
      });
      this.dateTicks(g, second, text);
      this.youAreHere(g, second, now, text);
      text(LEFT, second.top + second.height + 22, t('hud.dataPanel.noticesSource'), '#718096', 10);
      return;
    }
    this.youAreHere(g, second, now, text);
  }

  private point(c: Chart, ms: number, value: number) {
    return {
      x: LEFT + ((ms - c.from) / (c.to - c.from)) * (RIGHT - LEFT),
      y: c.top + c.height - ((value - c.min) / (c.max - c.min)) * c.height,
    };
  }

  private axes(g: Phaser.GameObjects.Graphics, c: Chart, text: (x: number, y: number, v: string, color?: string, size?: number) => unknown, unit: string): void {
    g.lineStyle(1, 0x4a5568).strokeRect(LEFT, c.top, RIGHT - LEFT, c.height);
    for (const v of [c.min, (c.min + c.max) / 2, c.max]) {
      const y = this.point(c, c.from, v).y;
      text(8, y - 7, `${Math.round(v)}`, '#718096', 10);
    }
    text(8, c.top - 18, unit, '#718096', 10);
    this.dateTicks(g, c, text);
  }

  private dateTicks(g: Phaser.GameObjects.Graphics, c: Chart, text: (x: number, y: number, v: string, color?: string, size?: number) => unknown): void {
    for (let ms = c.from; ms <= c.to; ms += 10 * DAY_MS) {
      const x = this.point(c, ms, 0).x;
      g.lineStyle(1, 0x2d3748).lineBetween(x, c.top, x, c.top + c.height);
      text(x - 18, c.top + c.height + 4, short(new Date(ms).toISOString()), '#718096', 10);
    }
  }

  /** La posición del jugador en el tiempo (§3.8.2). */
  private youAreHere(g: Phaser.GameObjects.Graphics, c: Chart, now: number, text: (x: number, y: number, v: string, color?: string, size?: number) => unknown): void {
    const x = this.point(c, now, 0).x;
    g.lineStyle(2, 0x68d391).lineBetween(x, c.top - 4, x, c.top + c.height + 4);
    text(x + 4, c.top + 2, tr('hud.dataPanel.youAreHere'), '#68d391', 11);
  }
}
