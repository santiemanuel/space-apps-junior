import Phaser from 'phaser';
import { INCIDENTS } from '../../../content/incidents';
import { noticesBetween, noticeText } from '../../../core/environment/notices';
import type { SimSnapshot } from '../../../core/habitat/events';
import { definitionOf } from '../../../core/incidents/planner';
import { DONKI_NOTICES } from '../../../data/notices';
import { getLocale, t, type TranslationKey } from '../../../i18n';
import { SceneKeys } from '../../sceneKeys';
import { PanelColumn, type PanelRow } from './PanelColumn';
import type { SimulationSceneData } from './simulationData';

const DAY_MS = 86_400_000;
/** Mensajes de ánimo y noticias de casa (§3.7): uno cada tres días, en orden [regla]. */
const HOME_MESSAGES = 6;
const HOME_EVERY_DAYS = 3;
const BOX = { x: 16, y: 56, width: 600, height: 520 };
const tr = (key: string, params?: Record<string, string | number>) => t(key as TranslationKey, params);

/** "12 segundos" o "18 minutos": la demora real de la señal para niños. */
export const formatDelay = (seconds: number): string =>
  seconds < 90 ? t('hud.missionControl.seconds', { n: Math.max(1, Math.round(seconds)) }) : t('hud.missionControl.minutes', { n: Math.round(seconds / 60) });

/**
 * Control de Misión (§3.7): mensajes reales de DONKI, consejos y diagnóstico remoto, todo con la demora real de la
 * señal por la distancia del día y una cuenta regresiva. Sin Control de Misión en la conjunción solar o sin radio.
 * Se abre con C; el reloj sigue corriendo para que llegue la respuesta.
 */
export class MissionControlScene extends Phaser.Scene {
  private data_!: SimulationSceneData;
  private snapshot: SimSnapshot | null = null;
  private column!: PanelColumn;

  constructor() {
    super(SceneKeys.MissionControl);
  }

  init(data: SimulationSceneData): void {
    this.data_ = data;
    this.snapshot = null;
  }

  create(): void {
    this.add.rectangle(BOX.x, BOX.y, BOX.width, BOX.height, 0x0b1020, 0.95).setOrigin(0, 0).setStrokeStyle(2, 0x63b3ed);
    this.column = new PanelColumn(this, BOX.x + 16, BOX.y + 12, BOX.width - 32);
    const off = this.data_.sim.on('sim:snapshot', (s) => (this.snapshot = s));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
  }

  update(): void {
    if (this.snapshot) this.column.render(this.rows(this.snapshot));
  }

  private rows(s: SimSnapshot): PanelRow[] {
    const { sim } = this.data_;
    const mc = s.missionControl;
    const title = (incidentId: string, fallback: string) => {
      const incident = s.state.activeIncidents.find((i) => i.id === incidentId);
      return tr(`${incident ? definitionOf(INCIDENTS, incident.definitionId).textKey : fallback}.title`);
    };
    const rows: PanelRow[] = [
      { text: t('hud.missionControl.sceneTitle'), size: 18, color: '#90cdf4' },
      { text: t('hud.missionControl.delay', { time: formatDelay(mc.delaySeconds) }), color: '#a0aec0', size: 12 },
    ];
    if (mc.offline) rows.push({ text: t('hud.missionControl.offline'), color: '#fc8181' });
    else if (mc.blockedKey) rows.push({ text: tr(mc.blockedKey), color: '#f6e05e', size: 12 });

    rows.push({ gap: 8, text: t('hud.missionControl.ask'), color: '#90cdf4' });
    const askable = !mc.blockedKey;
    const asked = (kind: string, id: string) => mc.requests.some((r) => r.kind === kind && r.incidentId === id && !r.arrived);
    for (const d of s.decisions) {
      const can = askable && !asked('advice', d.incident.id);
      rows.push({
        text: `● ${t('hud.missionControl.askAdvice', { title: tr(`${d.textKey}.title`) })}`,
        color: can ? '#e2e8f0' : '#4a5568',
        onClick: can ? () => sim.emit('sim:ask', { kind: 'advice', incidentId: d.incident.id }) : undefined,
      });
    }
    for (const incident of s.state.activeIncidents) {
      const def = definitionOf(INCIDENTS, incident.definitionId);
      if (!def.responses.find((r) => r.id === incident.responseId)?.work || mc.requests.some((r) => r.kind === 'diagnosis' && r.incidentId === incident.id)) continue;
      rows.push({
        text: `● ${t('hud.missionControl.askDiagnosis', { title: tr(`${def.textKey}.title`) })}`,
        color: askable ? '#e2e8f0' : '#4a5568',
        onClick: askable ? () => sim.emit('sim:ask', { kind: 'diagnosis', incidentId: incident.id }) : undefined,
      });
    }
    if (rows.at(-1)!.text === t('hud.missionControl.ask')) rows.push({ text: t('hud.missionControl.nothingToAsk'), color: '#718096', size: 12 });

    const requests = mc.requests.slice(-4).reverse();
    if (requests.length) rows.push({ gap: 8, text: t('hud.missionControl.answers'), color: '#90cdf4' });
    for (const r of requests) {
      const name = title(r.incidentId, r.textKey);
      if (!r.arrived) {
        const left = (Date.parse(r.arrivesAt) - Date.parse(s.simDate)) / 1000;
        rows.push({ text: t('hud.missionControl.waiting', { title: name, time: formatDelay(left) }), color: '#f6e05e', size: 12 });
      } else if (r.kind === 'advice') {
        const response = tr(`${r.textKey}.response.${r.responseId}.title`);
        rows.push({ text: t('hud.missionControl.advice', { title: name, response }), color: '#68d391', size: 12 });
      } else rows.push({ text: t('hud.missionControl.diagnosisArrived', { title: name }), color: '#68d391', size: 12 });
    }

    // Mensajes que llegan solos, con la misma demora de la señal: los avisos reales de DONKI y noticias de casa.
    const heard = Date.parse(s.simDate) - mc.delaySeconds * 1000;
    const start = Date.parse(s.window.start);
    const messages: { at: number; text: string; summary?: string }[] = noticesBetween(
      DONKI_NOTICES,
      new Date(start - 3 * DAY_MS).toISOString(),
      new Date(heard).toISOString(),
    ).map((n) => {
      const { key, params } = noticeText(n);
      return { at: Date.parse(n.issuedAt), text: tr(key, params), summary: n.summary };
    });
    for (let day = 1, i = 0; start + day * DAY_MS <= heard; day += HOME_EVERY_DAYS, i++)
      messages.push({ at: start + day * DAY_MS, text: tr(`hud.missionControl.home.${i % HOME_MESSAGES}`) });
    const latest = messages.sort((a, b) => b.at - a.at).slice(0, 4);
    rows.push({ gap: 8, text: t('hud.missionControl.messages'), color: '#90cdf4' });
    if (!latest.length) rows.push({ text: t('hud.missionControl.noMessages'), color: '#718096', size: 12 });
    for (const m of latest) {
      const date = new Date(m.at).toLocaleDateString(getLocale() === 'es' ? 'es-AR' : 'en-US', { timeZone: 'UTC', day: 'numeric', month: 'short' });
      rows.push({ text: `${date} · ${m.text}`, color: m.summary ? '#e2e8f0' : '#9ae6b4', size: 12 });
      if (m.summary && getLocale() === 'en') rows.push({ text: `  "${m.summary.slice(0, 140)}"`, color: '#718096', size: 11 });
    }
    rows.push({ gap: 8, text: t('hud.missionControl.close'), color: '#718096', size: 11 });
    return rows;
  }
}
