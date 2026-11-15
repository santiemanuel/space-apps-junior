import { MARS_CONTENT } from '../../../content/gale';
import { INCIDENTS } from '../../../content/incidents';
import { EXTERIOR, type Point } from '../../../core/habitat/layout';
import { MarsSession } from '../../../core/mars/MarsSession';
import { incidentTimeline } from '../../../data/incidentTimeline';
import { seriesFor } from '../../../data/realData';
import { galeWeatherOn } from '../../../data/series';
import { t } from '../../../i18n';
import { TILE } from '../../display';
import { SceneKeys } from '../../sceneKeys';
import type { PhaseSceneData } from '../sceneData';
import type { PanelRow } from './VoyagePanel';
import { LIGHT, SimulationMapScene, toPx, tr } from './SimulationMapScene';

/**
 * Estancia en el cráter Gale (game-design §4.4): la base, la esclusa y el exterior con los puntos de muestreo.
 * Curiosity, el vecino robot, reporta el clima real del día. Reglas en `MarsSession`.
 */
export class MarsScene extends SimulationMapScene<MarsSession> {
  constructor() {
    super(SceneKeys.Mars, 'mars');
  }

  protected createSession({ state, bus }: PhaseSceneData) {
    const window = MARS_CONTENT.calendar.windows.mars;
    const session = new MarsSession({
      state,
      bus,
      content: MARS_CONTENT,
      timeline: incidentTimeline('mars', window, INCIDENTS, MARS_CONTENT.incidentRules),
      doseRate: (date) => seriesFor('mars', date).dose,
      weather: galeWeatherOn,
    });
    return { session, content: MARS_CONTENT };
  }

  protected outcomeKey(outcome: 'completed' | 'suspended'): string {
    return outcome === 'completed' ? 'mars.outcome.completed' : 'mars.outcome.suspended';
  }

  protected outerDoorClosed(): boolean {
    return !this.session.evaOpen;
  }

  protected placeRows(): PanelRow[] {
    const s = this.session;
    const w = s.weather;
    const samples = s.state.inventory.samples;
    const kg = Math.round(samples.reduce((sum, x) => sum + x.massKg, 0) * 10) / 10;
    const value = samples.reduce((sum, x) => sum + x.value, 0);
    return [
      { gap: 6, text: t('mars.panel.curiosity', { sol: w.sol, min: Math.round(w.minTempC), max: w.maxTempC === null ? '?' : Math.round(w.maxTempC) }), color: '#fbd38d', size: 12 },
      { text: `${tr(`mars.uv.${w.uv ?? 'none'}`)} · ${t('common.dataDate', { date: this.formatDate(w.date) })}`, color: w.uv === 'Low' ? LIGHT.red : w.uv === 'Moderate' ? LIGHT.yellow : '#a0aec0', size: 11 },
      {
        text: `${t(s.daylight ? 'mars.panel.day' : 'mars.panel.night')} · ${t(s.evaOpen ? 'mars.panel.evaOpen' : s.daylight ? 'mars.panel.evaBlocked' : 'mars.panel.evaNight')}`,
        color: s.evaOpen ? LIGHT.green : LIGHT.yellow,
        size: 12,
      },
      { text: t('mars.panel.samples', { count: samples.length, total: s.sites.length, kg, value }), color: '#e2e8f0', size: 12 },
    ];
  }

  protected renderPlace(): void {
    const s = this.session;
    const ext = this.layout.exterior?.rect;
    if (ext && !s.daylight) this.markers.fillStyle(0x0b1020, 0.45).fillRect(ext.col * TILE, ext.row * TILE, ext.cols * TILE, ext.rows * TILE);
    for (const { site, progress } of s.remainingSites()) {
      const p = toPx(site);
      const r = 6 + site.massKg * 3;
      this.markers.fillStyle(0xd69e2e, 0.95).fillCircle(p.x, p.y, r);
      this.markers.lineStyle(2, 0xfefcbf, 0.9).strokeCircle(p.x, p.y, r + 3);
      if (progress > 0) this.markers.lineStyle(3, 0x63b3ed, 1).beginPath().arc(p.x, p.y, r + 7, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2).strokePath();
    }
  }

  protected placePrompt(position: Point, zone: string | null): string | null {
    const s = this.session;
    if (zone === 'airlock' && !s.evaOpen) return t(s.daylight ? 'mars.task.doorStorm' : 'mars.task.doorNight');
    if (zone !== EXTERIOR) return null;
    const site = s.siteAt(position);
    if (!site) return '';
    return s.manual ? t('mars.task.sample', { kg: site.massKg, value: site.value }) : t('hud.task.fastForward');
  }
}
