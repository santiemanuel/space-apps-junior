import Phaser from 'phaser';
import type { ResourceState } from '../../core/resources/ResourceModel';
import type { GameSession } from '../../core/session/GameSession';
import { createKeyboardControls, type PlayerControls } from '../input/PlayerControls';
import { SceneKeys } from '../sceneKeys';
import type { SessionSceneData } from '../services';

const TEXT = { fontFamily: 'monospace', fontSize: '13px', color: '#e2e8f0', lineSpacing: 4 } as const;
const STATUS_ICON = { available: '○', active: '◐', completed: '●', failed: '✕' } as const;
const RESOURCE_LABEL: Record<keyof ResourceState, string> = { oxygen: 'O2', water: 'H2O', food: 'comida', power: 'kWh' };

/** Interfaz superpuesta: lee el estado de la sesión y canaliza las decisiones del jugador. */
export class HudScene extends Phaser.Scene {
  private session!: GameSession;
  private controls!: PlayerControls;
  private resourcesText!: Phaser.GameObjects.Text;
  private environmentText!: Phaser.GameObjects.Text;
  private missionsText!: Phaser.GameObjects.Text;
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
    this.controls = createKeyboardControls(this);
    this.resourcesText = this.add.text(44, 40, '', TEXT);
    this.environmentText = this.add.text(width - 44, 40, '', { ...TEXT, align: 'right' }).setOrigin(1, 0);
    this.missionsText = this.add.text(44, height - 44, '', TEXT).setOrigin(0, 1);
    this.toast = this.add.text(width / 2, 44, '', { ...TEXT, color: '#fbd38d' }).setOrigin(0.5, 0);

    const panel = this.add.rectangle(0, 0, 600, 200, 0x0b1020, 0.95).setStrokeStyle(2, 0xed8936);
    this.dialogText = this.add.text(0, 0, '', { ...TEXT, fontSize: '15px', wordWrap: { width: 560 } }).setOrigin(0.5);
    this.dialog = this.add.container(width / 2, height / 2, [panel, this.dialogText]).setVisible(false).setDepth(100);

    const { bus } = this.session;
    const unsubscribe = [
      bus.on('decision:required', (decision) => {
        const options = decision.options
          .map((o, i) => `[${i + 1}] ${o.label} — éxito ${Math.round(o.successChance * 100)}%${costLabel(o.cost)}`)
          .join('\n');
        this.dialogText.setText(`DECISIÓN DE MISIÓN\n\n${decision.prompt}\n\n${options}`);
        this.dialog.setVisible(true);
      }),
      bus.on('decision:resolved', (outcome) => {
        this.dialog.setVisible(false);
        this.showToast(!outcome.attempted ? 'Misión pospuesta' : outcome.success ? 'Misión autorizada' : 'La misión ha fracasado');
      }),
      bus.on('mission:completed', (m) => this.showToast(`Completada: ${m.definition.title}`)),
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
    const { resources, environment, missions } = this.session;
    const r = resources.snapshot;
    const days = (key: 'oxygen' | 'water' | 'food') => `${resources.daysRemaining(key).toFixed(1)} d`;
    this.resourcesText.setText([
      `Día ${(this.session.gameHours / 24 + 1).toFixed(1)}`,
      `O2      ${r.oxygen.toFixed(1)} kg  (${days('oxygen')})`,
      `Agua    ${r.water.toFixed(1)} kg  (${days('water')})`,
      `Comida  ${r.food.toFixed(1)} kg  (${days('food')})`,
      `Energía ${r.power.toFixed(0)} kWh  (solar ${Math.round(resources.solarEfficiency * 100)}%)`,
    ]);

    const strongest = [...environment.flares].sort((a, b) => b.peakFlux - a.peakFlux)[0];
    const closest = [...environment.neos].sort((a, b) => a.missDistanceLunar - b.missDistanceLunar)[0];
    this.environmentText.setText([
      `Datos NASA: ${environment.source === 'live' ? 'en vivo' : 'archivo'}`,
      `Radiación ${Math.round(environment.radiationRisk * 100)}%  (máx. ${strongest?.classType ?? '—'})`,
      `Objetos cercanos ${Math.round(environment.debrisThreat * 100)}%`,
      closest ? `${closest.name} a ${closest.missDistanceLunar.toFixed(1)} DL` : '',
    ]);

    this.missionsText.setText([
      'Misiones — mantén [E] junto a una estación',
      ...missions.all.map((m) => {
        const postponed = this.session.isPostponed(m.definition.id) ? ' (pospuesta)' : '';
        return `${STATUS_ICON[m.status]} ${m.definition.title} ${Math.round(m.progress * 100)}%${postponed}`;
      }),
    ]);
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
