import Phaser from 'phaser';
import { ACHIEVEMENTS, REPORT_RULES } from '../../../content/achievements';
import { CREW_ROSTER } from '../../../content/crew';
import type { ManeuverId } from '../../../core/flow/types';
import { precisionLevel } from '../../../core/maneuvers/ManeuverRun';
import { buildReport, type MissionReport } from '../../../core/report/report';
import type { MissionLogEntry } from '../../../core/state/types';
import type { SystemId } from '../../../core/systems/types';
import { hasKey, t, type TranslationKey } from '../../../i18n';
import { formatDate, formatNumber } from '../../../i18n/format';
import { GAME_WIDTH } from '../../display';
import { SceneKeys } from '../../sceneKeys';
import { addButton, addText, COLOR, listenUntilShutdown, onKeys, openSource, type Button } from '../../ui/ui';
import type { ReportSceneData } from '../sceneData';

/** `onExit` lo pone el director del flujo para volver al menú. */
export type ReportData = ReportSceneData & { onExit?: () => void };

type Page = 'summary' | 'mission' | 'data';
const PAGES: readonly Page[] = ['summary', 'mission', 'data'];
const STARS = ['healthyCrew', 'lowDose', 'samplesHome'] as const;
const CENTER = GAME_WIDTH / 2;
const GOLD = 0xf6e05e;
const TIMELINE = { x: 140, y: 225, width: 1000 } as const;
const NAMES = Object.fromEntries(CREW_ROSTER.map((c) => [c.id, c.name]));

/** Texto de una entrada del historial para el informe. */
function describe(entry: MissionLogEntry): string {
  const data = entry.data ?? {};
  switch (entry.kind) {
    case 'loadout':
      return entry.key === 'return'
        ? t('report.log.loadout.return', { samples: Number(data.samples ?? 0), mass: Number(data.massKg ?? 0) })
        : t('report.log.loadout.outbound', { profile: t(`menu.loadout.profile.${entry.key.replace('outbound.', '')}`) });
    case 'maneuver':
      return t('report.log.maneuver', {
        maneuver: t(`maneuvers.name.${entry.key as ManeuverId}`),
        quality: t(`maneuvers.result.precision.${precisionLevel(Number(data.precision ?? 0))}`),
      });
    case 'incident': {
      const key = `incidents.${entry.key}.title`;
      return t('report.log.incident', { name: hasKey(key) ? t(key as TranslationKey) : entry.key });
    }
    case 'cascade':
      return t('report.log.cascade', { name: entry.key });
    default:
      if (entry.key === 'maneuver.repair' || entry.key === 'maneuver.risk') {
        return t(`report.log.${entry.key}`, { system: t(`common.system.${String(data.system) as SystemId}`) });
      }
      return t('report.log.decision', { name: entry.key });
  }
}

/**
 * Informe final (§5): 3 estrellas, logros, tripulación, decisiones en el tiempo, tarjetas vividas y la explicación
 * de la ruta nuclear. En una misión suspendida muestra la cadena de decisiones, con la tripulación a salvo.
 */
export class ReportScene extends Phaser.Scene {
  private data_!: ReportData;
  private report!: MissionReport;
  private page: Page = 'summary';
  private view!: Phaser.GameObjects.Container;
  private tabs: Button[] = [];
  private header!: { title: Phaser.GameObjects.Text; outcome: Phaser.GameObjects.Text; controls: Phaser.GameObjects.Text };
  private back!: Button;
  private leaving = false;

  constructor() {
    super(SceneKeys.Report);
  }

  init(data: ReportData): void {
    this.data_ = data;
    this.report = buildReport(data.state, data.outcome, ACHIEVEMENTS, REPORT_RULES);
    this.page = 'summary';
    this.leaving = false;
  }

  create(): void {
    const completed = this.report.outcome === 'completed';
    this.header = {
      title: addText(this, CENTER, 40, 30, COLOR.title).setOrigin(0.5),
      outcome: addText(this, CENTER, 80, 18, completed ? COLOR.ok : COLOR.warn).setOrigin(0.5),
      controls: addText(this, CENTER, 702, 13, COLOR.dim).setOrigin(0.5),
    };
    this.tabs = PAGES.map((page, index) => addButton(this, CENTER + (index - 1) * 200, 124, () => this.show(page), { size: 16 }));
    this.back = addButton(this, CENTER, 662, () => this.exit(), { size: 18 });
    this.view = this.add.container(0, 0);
    onKeys(this, (code) => {
      const index = PAGES.indexOf(this.page);
      if (code === 'ArrowLeft' || code === 'KeyA') this.show(PAGES[(index - 1 + PAGES.length) % PAGES.length]!);
      else if (code === 'ArrowRight' || code === 'KeyD') this.show(PAGES[(index + 1) % PAGES.length]!);
      else if (code === 'Enter' || code === 'NumpadEnter') this.exit();
    });
    listenUntilShutdown(this, this.events, Phaser.Scenes.Events.RESUME, () => this.show(this.page));
    this.show('summary');
  }

  private show(page: Page): void {
    this.page = page;
    this.header.title.setText(t('report.sceneTitle'));
    this.header.outcome.setText(t(`report.outcome.${this.report.outcome}`));
    this.header.controls.setText(t('report.controls'));
    this.back.setLabel(t('report.backToMenu')).setFocused(true).setEnabled(Boolean(this.data_.onExit));
    this.tabs.forEach((tab, i) => tab.setLabel(t(`report.page.${PAGES[i]!}`)).setFocused(PAGES[i] === page));
    this.view.removeAll(true);
    if (page === 'summary') this.showSummary();
    else if (page === 'mission') this.showMission();
    else this.showData();
  }

  private showSummary(): void {
    const { report, view } = this;
    STARS.forEach((star, i) => {
      const x = CENTER + (i - 1) * 240;
      const earned = report.stars[star];
      const shape = this.add.star(x, 205, 5, 16, 36, earned ? GOLD : 0x2d3748).setStrokeStyle(2, earned ? GOLD : 0x718096);
      view.add([shape, addText(this, x, 256, 15, earned ? COLOR.focus : COLOR.dim).setOrigin(0.5).setText(t(`report.star.${star}`))]);
    });

    view.add(addText(this, 120, 300, 20, COLOR.text).setText(t('report.achievements.title')));
    report.achievements.forEach(({ id, earned }, i) => {
      const y = 345 + i * 54;
      view.add([
        this.add.circle(132, y + 10, 10, earned ? GOLD : 0x2d3748).setStrokeStyle(2, earned ? GOLD : 0x718096),
        addText(this, 154, y, 16, earned ? COLOR.text : COLOR.dim).setText(t(`report.achievement.${id}`)),
        addText(this, 154, y + 22, 13, COLOR.dim, { wordWrap: { width: 440 } }).setText(t(`report.achievement.${id}.description`)),
      ]);
    });

    view.add(addText(this, 680, 300, 20, COLOR.text).setText(t('report.crew.title')));
    report.crew.forEach((member, i) => {
      const y = 345 + i * 54;
      const arrival = member.arrival ?? 'waiting';
      view.add([
        addText(this, 680, y, 16, arrival === 'walk' ? COLOR.ok : arrival === 'stretcher' ? COLOR.warn : COLOR.muted).setText(
          `${NAMES[member.id]} · ${t(`report.crew.arrival.${arrival}`)}`,
        ),
        addText(this, 680, y + 22, 13, COLOR.dim).setText(
          t('report.crew.dose', { dose: formatNumber(member.doseMSv, undefined, 0), xrays: formatNumber(member.xrays, undefined, 0), percent: member.careerPercent }),
        ),
      ]);
    });

    const samples = report.samples.count
      ? t('report.samples', { count: report.samples.count, value: formatNumber(report.samples.value), mass: formatNumber(report.samples.massKg) })
      : t('report.samples.none');
    const landing = report.landingDistanceKm !== null ? t('report.landing', { km: report.landingDistanceKm }) : '';
    view.add(addText(this, CENTER, 588, 15, COLOR.muted, { align: 'center' }).setOrigin(0.5).setText([samples, landing].filter(Boolean).join('\n')));
  }

  private showMission(): void {
    const { report, view } = this;
    const entries = report.decisions;
    const dated = this.data_.state.history.map((e) => e.simDate).filter(Boolean).sort();
    const start = Date.parse(dated[0] ?? this.data_.state.simDate);
    const end = Math.max(Date.parse(this.data_.state.simDate), Date.parse(dated.at(-1) ?? this.data_.state.simDate), start + 1);
    const xOf = (iso: string) => TIMELINE.x + ((Date.parse(iso) - start) / (end - start)) * TIMELINE.width;

    view.add([
      addText(this, CENTER, 172, 18, COLOR.text).setOrigin(0.5).setText(t(report.outcome === 'suspended' ? 'report.mission.chain' : 'report.mission.timeline')),
      this.add.rectangle(TIMELINE.x, TIMELINE.y, TIMELINE.width, 4, 0x4a5568).setOrigin(0, 0.5),
      addText(this, TIMELINE.x, TIMELINE.y + 14, 12, COLOR.dim).setText(formatDate(new Date(start).toISOString())),
      addText(this, TIMELINE.x + TIMELINE.width, TIMELINE.y + 14, 12, COLOR.dim).setOrigin(1, 0).setText(formatDate(new Date(end).toISOString())),
    ]);
    for (const entry of this.data_.state.history) {
      if (!entry.simDate) continue;
      const isReal = entry.kind === 'realEvent';
      const color = isReal ? 0x63b3ed : entry.kind === 'incident' || entry.kind === 'cascade' ? 0xf6ad55 : 0xfbd38d;
      view.add(isReal ? this.add.triangle(xOf(entry.simDate), TIMELINE.y - 14, 0, 10, 6, 0, 12, 10, color) : this.add.circle(xOf(entry.simDate), TIMELINE.y, 6, color));
    }

    if (!entries.length) {
      view.add(addText(this, CENTER, 330, 16, COLOR.dim).setOrigin(0.5).setText(t('report.mission.empty')));
      return;
    }
    const shown = report.outcome === 'suspended' ? entries.slice(-11) : entries.slice(0, 11);
    shown.forEach((entry, i) => {
      view.add(addText(this, 160, 272 + i * 31, 15, COLOR.text).setText(`${formatDate(entry.simDate)}  ·  ${describe(entry)}`));
    });
  }

  private showData(): void {
    const { report, view } = this;
    view.add(addText(this, 120, 165, 20, COLOR.text).setText(t('report.data.title')));
    if (!report.realEvents.length) view.add(addText(this, 120, 200, 15, COLOR.dim).setText(t('report.data.empty')));
    report.realEvents.slice(0, 6).forEach((event, i) => {
      const y = 202 + i * 36;
      const line = addText(this, 120, y, 15).setText(
        t('report.data.event', {
          date: formatDate(event.date),
          mission: event.mission,
          instrument: event.instrument,
          value: formatNumber(event.value),
          unit: event.unit,
        }),
      );
      const link = addText(this, 130 + line.width, y, 15, COLOR.link)
        .setText(`${t('report.data.source')} ↗`)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => openSource(event.sourceUrl));
      view.add([line, link]);
    });
    view.add([
      addText(this, 120, 440, 20, COLOR.text).setText(t('report.route.title')),
      addText(this, 120, 474, 15, COLOR.muted, { wordWrap: { width: 1040 }, lineSpacing: 4 }).setText(t('report.route.text')),
      addText(this, 120, 580, 13, COLOR.dim, { wordWrap: { width: 1040 } }).setText(t('report.dates.note')),
    ]);
  }

  private exit(): void {
    if (this.leaving || !this.data_.onExit) return;
    this.leaving = true;
    this.data_.onExit();
  }
}
