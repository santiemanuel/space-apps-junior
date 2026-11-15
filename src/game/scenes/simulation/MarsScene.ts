import { MARS_CONTENT } from '../../../content/gale';
import { INCIDENTS } from '../../../content/incidents';
import { earthMarsDelaySeconds } from '../../../core/environment/orbits';
import { EXTERIOR, type Point } from '../../../core/habitat/layout';
import { MarsSession } from '../../../core/mars/MarsSession';
import { incidentTimeline } from '../../../data/incidentTimeline';
import { EARTH_ORBIT, MARS_ORBIT } from '../../../data/planets';
import { seriesFor } from '../../../data/realData';
import { galeWeatherOn } from '../../../data/series';
import { t } from '../../../i18n';
import { TILE } from '../../display';
import { SceneKeys } from '../../sceneKeys';
import type Phaser from 'phaser';
import type { PhaseSceneData } from '../sceneData';
import { SimulationMapScene, toPx, tr } from './SimulationMapScene';

/** Donde está estacionado Curiosity en el exterior (tiles). */
const CURIOSITY_SPOT = { x: 43.5, y: 11.5 };

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
      signalDelaySeconds: (date) => earthMarsDelaySeconds(EARTH_ORBIT, MARS_ORBIT, date),
    });
    return { session, content: MARS_CONTENT };
  }

  private curiosityBubble!: Phaser.GameObjects.Text;
  private bubbleDay = '';

  create(): void {
    super.create();
    // Curiosity, el vecino robot (§4.4, §5.3): decorado en el exterior que reporta el dato real del día.
    const { x, y } = toPx(CURIOSITY_SPOT);
    const g = this.add.graphics().setDepth(6);
    g.fillStyle(0xe2e8f0).fillRect(x - 18, y - 8, 36, 14);
    g.fillStyle(0x2d3748);
    for (const dx of [-14, 0, 14]) g.fillCircle(x + dx, y + 9, 5);
    g.lineStyle(3, 0xe2e8f0).lineBetween(x + 10, y - 8, x + 10, y - 26);
    g.fillStyle(0xe2e8f0).fillRect(x + 4, y - 32, 14, 7);
    this.add.text(x, y + 18, 'Curiosity', { fontFamily: 'monospace', fontSize: '11px', color: '#fbd38d' }).setOrigin(0.5, 0).setDepth(6);
    this.curiosityBubble = this.add
      .text(x - 24, y - 40, '', { fontFamily: 'monospace', fontSize: '11px', color: '#1a202c', backgroundColor: '#fefcbf', padding: { x: 4, y: 2 }, wordWrap: { width: 220 } })
      .setOrigin(1, 1)
      .setDepth(6);
  }

  protected outcomeKey(outcome: 'completed' | 'suspended'): string {
    return outcome === 'completed' ? 'mars.outcome.completed' : 'mars.outcome.suspended';
  }

  protected outerDoorClosed(): boolean {
    return !this.session.evaOpen;
  }

  protected renderPlace(): void {
    const s = this.session;
    if (this.bubbleDay !== s.simDate.slice(0, 10)) {
      this.bubbleDay = s.simDate.slice(0, 10);
      const w = s.weather;
      this.curiosityBubble.setText(t('mars.curiosity.bubble', { min: Math.round(w.minTempC), sky: tr(`mars.uv.${w.uv ?? 'none'}`) }));
    }
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
