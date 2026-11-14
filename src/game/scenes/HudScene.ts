import Phaser from 'phaser';
import type { Decision } from '../../core/decisions/DecisionEngine';
import type { MissionState } from '../../core/missions/types';
import type { ResourceState } from '../../core/resources/ResourceModel';
import type { GameSession } from '../../core/session/GameSession';
import { CAREER_DOSE_LIMIT_MSV, CHEST_XRAY_MSV } from '../../data/curated';
import { createKeyboardControls, type PlayerControls } from '../input/PlayerControls';
import { SceneKeys } from '../sceneKeys';
import { getServices, type GameServices, type SessionSceneData } from '../services';

const TEXT = { fontFamily: 'monospace', fontSize: '13px', color: '#e2e8f0', lineSpacing: 4 } as const;
const STATUS_ICON = { available: '○', active: '◐', completed: '●', failed: '✕' } as const;
const RESOURCE_LABEL: Record<keyof ResourceState, string> = { oxygen: 'O2', water: 'agua', food: 'comida', power: 'kWh' };
const ATTRIBUTION = 'Datos reales: NASA CCMC DONKI · NASA OSDR · NASA BVAD · mediciones de radiación lunar';

/** Explicaciones en lenguaje sencillo (público 7–12 años) para cada amenaza. */
const EXPLAIN = {
  radiation: 'Radiación: energía invisible del Sol que puede dañar el cuerpo. El blindaje protege, pero gasta energía.',
  comms: 'Apagón de radio: las llamaradas solares pueden cortar las comunicaciones con la Tierra.',
} as const;

/** Interfaz superpuesta: lee el estado de la sesión y canaliza las decisiones del jugador. */
export class HudScene extends Phaser.Scene {
  private session!: GameSession;
  private services!: GameServices;
  private controls!: PlayerControls;
  private resourcesText!: Phaser.GameObjects.Text;
  private environmentText!: Phaser.GameObjects.Text;
  private missionsText!: Phaser.GameObjects.Text;
  private factText!: Phaser.GameObjects.Text;
  private toast!: Phaser.GameObjects.Text;
  private dialog!: Phaser.GameObjects.Container;
  private dialogText!: Phaser.GameObjects.Text;

  constructor() {
    super(SceneKeys.Hud);
  }

  init({ session }: SessionSceneData): void {
    this.session = session;
  }

  create(): void {
    const { width, height } = this.scale;
    this.services = getServices(this);
    this.controls = createKeyboardControls(this);
    this.resourcesText = this.add.text(44, 40, '', TEXT);
    this.environmentText = this.add.text(width - 44, 40, '', { ...TEXT, align: 'right' }).setOrigin(1, 0);
    this.missionsText = this.add.text(44, height - 44, '', TEXT).setOrigin(0, 1);
    this.factText = this.add
      .text(width - 44, height - 62, '', { ...TEXT, color: '#9ae6b4', align: 'right', wordWrap: { width: 380 } })
      .setOrigin(1, 1);
    this.add.text(width - 44, height - 40, ATTRIBUTION, { ...TEXT, fontSize: '10px', color: '#718096' }).setOrigin(1, 1);
    this.toast = this.add.text(width / 2, 44, '', { ...TEXT, color: '#fbd38d' }).setOrigin(0.5, 0);

    const panel = this.add.rectangle(0, 0, 640, 260, 0x0b1020, 0.95).setStrokeStyle(2, 0xed8936);
    this.dialogText = this.add.text(0, 0, '', { ...TEXT, fontSize: '14px', wordWrap: { width: 600 } }).setOrigin(0.5);
    this.dialog = this.add.container(width / 2, height / 2, [panel, this.dialogText]).setVisible(false).setDepth(100);

    const { bus } = this.session;
    const unsubscribe = [
      bus.on('decision:required', (decision) => this.showDecision(decision)),
      bus.on('decision:resolved', (outcome) => {
        this.dialog.setVisible(false);
        this.showToast(!outcome.attempted ? 'Misión pospuesta' : outcome.success ? 'Misión autorizada' : 'La misión ha fracasado');
      }),
      bus.on('mission:completed', (m) => {
        this.showToast(`Completada: ${m.definition.title}`);
        this.showFact(m);
      }),
      bus.on('mission:failed', (m) => this.showFact(m)),
      bus.on('session:over', ({ reason }) => this.showGameOver(reason)),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => unsubscribe.forEach((off) => off()));
  }

  update(): void {
    this.handleInput();
    this.renderPanels();
  }

  private handleInput(): void {
    const decision = this.session.pendingDecision;
    const index = this.controls.choiceJustPressed();
    const option = index ? decision?.options[index - 1] : undefined;
    if (option) this.session.choose(option.choice);
    if (this.session.overReason && this.controls.restartJustPressed()) {
      this.scene.stop(SceneKeys.Habitat);
      this.scene.start(SceneKeys.Boot);
    }
  }

  private renderPanels(): void {
    const { resources, environment: env, missions, crewDoseMSv } = this.session;
    const r = resources.snapshot;
    const days = (key: 'oxygen' | 'water' | 'food') => `${resources.daysRemaining(key).toFixed(1)} d`;
    this.resourcesText.setText([
      `Día ${(this.session.gameHours / 24 + 1).toFixed(1)} en la base lunar`,
      `O2      ${r.oxygen.toFixed(1)} kg  (${days('oxygen')})`,
      `Agua    ${r.water.toFixed(1)} kg  (${days('water')})`,
      `Comida  ${r.food.toFixed(1)} kg  (${days('food')})`,
      `Energía ${r.power.toFixed(0)} kWh`,
      `Dosis   ${crewDoseMSv.toFixed(2)} mSv ≈ ${Math.round(crewDoseMSv / CHEST_XRAY_MSV)} radiografías`,
      `        (${((crewDoseMSv / CAREER_DOSE_LIMIT_MSV) * 100).toFixed(2)}% del límite de carrera NASA)`,
    ]);

    const strongest = [...env.flares].sort((a, b) => b.peakFlux - a.peakFlux)[0];
    this.environmentText.setText([
      `Clima espacial ${env.source === 'live' ? 'EN VIVO' : 'REAL ARCHIVADO'}`,
      `${env.window.start} → ${env.window.end}`,
      `Llamaradas solares: ${env.flares.length} (máx. ${strongest?.classType ?? '—'})`,
      `Tormentas de partículas (SEP): ${env.particleEvents.length}`,
      `Riesgo de radiación ${Math.round(env.radiationRisk * 100)}%`,
      `Apagón de radio: ${env.radioBlackout > 0 ? `R${env.radioBlackout}` : 'ninguno'}`,
    ]);

    this.missionsText.setText([
      'Misiones — mantén [E] junto a una estación',
      ...missions.all.map((m) => {
        const postponed = this.session.isPostponed(m.definition.id) ? ' (pospuesta)' : '';
        return `${STATUS_ICON[m.status]} ${m.definition.title} ${Math.round(m.progress * 100)}%${postponed}`;
      }),
    ]);
  }

  private showDecision(decision: Decision): void {
    const mission = this.session.missions.get(decision.missionId).definition;
    const explanations: string[] = [];
    if (mission.exposure.radiation > 0 && this.session.environment.radiationRisk > 0) explanations.push(EXPLAIN.radiation);
    if (mission.exposure.comms > 0 && this.session.environment.radioBlackout > 0) explanations.push(EXPLAIN.comms);
    const options = decision.options
      .map((o, i) => `[${i + 1}] ${o.label} — éxito ${Math.round(o.successChance * 100)}%${costLabel(o.cost)}`)
      .join('\n');
    this.dialogText.setText(`DECISIÓN DE MISIÓN\n\n${decision.prompt}\n\n${explanations.join('\n')}\n\n${options}`);
    this.dialog.setVisible(true);
  }

  private showFact({ definition }: MissionState): void {
    const fact = definition.learnTopic ? this.services.scienceFact(definition.learnTopic) : undefined;
    if (!fact) return;
    this.tweens.killTweensOf(this.factText);
    this.factText.setText(`¿Sabías que…? ${fact.text}\n— Estudio NASA OSDR ${fact.accession}`).setAlpha(1);
    this.tweens.add({ targets: this.factText, alpha: 0, delay: 9000, duration: 800 });
  }

  private showToast(message: string): void {
    this.tweens.killTweensOf(this.toast);
    this.toast.setText(message).setAlpha(1);
    this.tweens.add({ targets: this.toast, alpha: 0, delay: 1800, duration: 600 });
  }

  private showGameOver(reason: string): void {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7).setDepth(200);
    this.add
      .text(width / 2, height / 2, `FIN DE LA EXPEDICIÓN\n\n${reason}\n\n[R] reiniciar`, { ...TEXT, fontSize: '20px', align: 'center' })
      .setOrigin(0.5)
      .setDepth(201);
  }
}

function costLabel(cost: Partial<ResourceState>): string {
  const parts = (Object.entries(cost) as [keyof ResourceState, number][]).map(([key, value]) => `${value} ${RESOURCE_LABEL[key]}`);
  return parts.length ? `  (coste: ${parts.join(', ')})` : '';
}
