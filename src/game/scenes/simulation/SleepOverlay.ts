import Phaser from 'phaser';
import { GAME_HEIGHT } from '../../display';
import { reducedMotion } from '../../ui/ui';
import { VIEW_WIDTH } from './HudScene';

/**
 * Dormir de verdad (Z en la cama): la vista del mapa se oscurece hasta casi negro, con "Z z z", la hora que avanza y
 * la tecla para despertarse. Si lo despierta una alerta, el fundido es rápido y con un destello rojo; si se despierta
 * solo o a mano, la luz vuelve despacio. El reloj rápido sin tareas nunca se ve así.
 */
export class SleepOverlay {
  private readonly root: Phaser.GameObjects.Container;
  private readonly dark: Phaser.GameObjects.Rectangle;
  private readonly flash: Phaser.GameObjects.Rectangle;
  private readonly zs: Phaser.GameObjects.Text[];
  private readonly clock: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private asleep = false;

  constructor(private readonly scene: Phaser.Scene, hint: string) {
    this.dark = scene.add.rectangle(0, 0, VIEW_WIDTH, GAME_HEIGHT, 0x02030a, 1).setOrigin(0, 0);
    this.flash = scene.add.rectangle(0, 0, VIEW_WIDTH, GAME_HEIGHT, 0xf56565, 0).setOrigin(0, 0).setDepth(89).setVisible(false);
    const cx = VIEW_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    this.zs = [0, 1, 2].map((i) => scene.add.text(cx - 40 + i * 44, cy - 60 - i * 26, i === 0 ? 'Z' : 'z', { fontFamily: 'monospace', fontSize: `${64 - i * 14}px`, fontStyle: 'bold', color: '#90cdf4' }).setOrigin(0.5));
    this.clock = scene.add.text(cx, cy + 40, '', { fontFamily: 'monospace', fontSize: '30px', color: '#e2e8f0' }).setOrigin(0.5);
    this.hint = scene.add.text(cx, cy + 96, hint, { fontFamily: 'monospace', fontSize: '15px', color: '#fbd38d', backgroundColor: '#1a202c', padding: { x: 10, y: 6 }, align: 'center', wordWrap: { width: VIEW_WIDTH - 200 } }).setOrigin(0.5);
    this.root = scene.add.container(0, 0, [this.dark, ...this.zs, this.clock, this.hint]).setDepth(88).setVisible(false).setAlpha(0);
  }

  get visible(): boolean {
    return this.root.visible;
  }

  /** En cada cuadro: `clock` es la hora simulada ya escrita; `alarm`, si lo que lo despertó fue un aviso. */
  update(asleep: boolean, clock: string, alarm: boolean, time: number): void {
    const { scene } = this;
    if (asleep !== this.asleep) {
      this.asleep = asleep;
      scene.tweens.killTweensOf(this.root);
      if (asleep) {
        this.root.setVisible(true);
        scene.tweens.add({ targets: this.root, alpha: 0.94, duration: reducedMotion() ? 150 : 700, ease: 'Sine.InOut' });
      } else {
        scene.tweens.add({ targets: this.root, alpha: 0, duration: alarm ? 140 : 650, ease: 'Sine.Out', onComplete: () => this.root.setVisible(false) });
        if (alarm && !reducedMotion()) {
          this.flash.setVisible(true).setAlpha(0.4);
          scene.tweens.add({ targets: this.flash, alpha: 0, duration: 220, yoyo: true, repeat: 1, onComplete: () => this.flash.setVisible(false) });
        }
      }
    }
    if (!this.root.visible) return;
    this.clock.setText(clock);
    // Las Z suben y se apagan una detrás de otra.
    this.zs.forEach((z, i) => {
      const k = reducedMotion() ? 0.5 : (time / 1600 + i * 0.33) % 1;
      z.setAlpha(0.25 + 0.75 * Math.sin(Math.PI * k)).setY(GAME_HEIGHT / 2 - 60 - i * 26 - 10 * k);
    });
    this.hint.setAlpha(0.7 + 0.3 * Math.sin(time / 300));
  }
}
