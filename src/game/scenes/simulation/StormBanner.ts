import Phaser from 'phaser';
import { GAME_HEIGHT } from '../../display';
import { reducedMotion } from '../../ui/ui';
import { VIEW_WIDTH } from './HudScene';

/** Lo que dura el cartel en pantalla (ms): entra con fuerza, se queda y se va. No tapa el juego después. */
const BANNER = { inMs: 320, holdMs: 2100, outMs: 380, height: 176, stripe: 22 } as const;

/**
 * Cartel grande de "se acerca una tormenta solar", como la presentación de un jefe: una banda oscura con franjas de
 * peligro que corren, el texto enorme que entra de costado y, debajo, la cuenta regresiva hasta el impacto. Con la
 * preferencia de movimiento reducido no desliza ni destella: aparece y se va con un fundido.
 */
export class StormBanner {
  private readonly root: Phaser.GameObjects.Container;
  private readonly stripes: Phaser.GameObjects.Graphics;
  private readonly flash: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly sub: Phaser.GameObjects.Text;
  private countdown: (() => string) | null = null;
  private shownAt = 0;

  constructor(private readonly scene: Phaser.Scene) {
    const cy = GAME_HEIGHT / 2 - 40;
    this.flash = scene.add.rectangle(0, 0, VIEW_WIDTH, GAME_HEIGHT, 0xf56565, 0).setOrigin(0, 0).setDepth(94).setVisible(false);
    this.root = scene.add.container(0, cy).setDepth(95).setVisible(false);
    const band = scene.add.rectangle(0, -BANNER.height / 2, VIEW_WIDTH, BANNER.height, 0x12060a, 0.92).setOrigin(0, 0);
    this.stripes = scene.add.graphics();
    this.title = scene.add
      .text(VIEW_WIDTH / 2, -22, '', { fontFamily: 'monospace', fontSize: '46px', fontStyle: 'bold', color: '#fefcbf', stroke: '#9b2c2c', strokeThickness: 8, align: 'center', wordWrap: { width: VIEW_WIDTH - 80 } })
      .setOrigin(0.5);
    this.sub = scene.add.text(VIEW_WIDTH / 2, 44, '', { fontFamily: 'monospace', fontSize: '20px', color: '#fbd38d', align: 'center' }).setOrigin(0.5);
    this.root.add([band, this.stripes, this.title, this.sub]);
  }

  get visible(): boolean {
    return this.root.visible;
  }

  /** `countdown` devuelve en cada cuadro el texto de abajo (lo que falta para el impacto). */
  show(title: string, countdown: () => string): void {
    const { scene } = this;
    this.countdown = countdown;
    this.shownAt = scene.time.now;
    this.title.setText(title);
    // Que el título entre en la banda aunque el idioma lo alargue.
    this.title.setFontSize(46);
    if (this.title.height > 110) this.title.setFontSize(36);
    scene.tweens.killTweensOf([this.root, this.title, this.flash]);
    this.root.setVisible(true).setAlpha(1);
    const calm = reducedMotion();
    if (calm) {
      this.root.setAlpha(0);
      this.title.setX(VIEW_WIDTH / 2).setScale(1);
      scene.tweens.add({ targets: this.root, alpha: 1, duration: 200 });
    } else {
      this.title.setX(-VIEW_WIDTH / 2).setScale(1.5);
      scene.tweens.add({ targets: this.title, x: VIEW_WIDTH / 2, scale: 1, duration: BANNER.inMs, ease: 'Back.Out' });
      this.flash.setVisible(true).setAlpha(0.35);
      scene.tweens.add({ targets: this.flash, alpha: 0, duration: 260, yoyo: true, repeat: 2, onComplete: () => this.flash.setVisible(false) });
    }
    scene.time.delayedCall(BANNER.inMs + BANNER.holdMs, () => {
      if (scene.time.now - this.shownAt < BANNER.inMs + BANNER.holdMs - 50) return;
      scene.tweens.add({
        targets: calm ? this.root : this.title,
        ...(calm ? { alpha: 0 } : { x: VIEW_WIDTH * 1.6 }),
        duration: BANNER.outMs,
        ease: 'Cubic.In',
        onComplete: () => this.hide(),
      });
    });
  }

  hide(): void {
    this.root.setVisible(false);
    this.flash.setVisible(false);
    this.countdown = null;
  }

  update(time: number): void {
    if (!this.root.visible) return;
    if (this.countdown) this.sub.setText(this.countdown());
    // Franjas de peligro arriba y abajo de la banda, que corren (quietas con movimiento reducido).
    const g = this.stripes.clear();
    const shift = reducedMotion() ? 0 : (time / 14) % (BANNER.stripe * 2);
    for (const y of [-BANNER.height / 2, BANNER.height / 2 - 12]) {
      g.fillStyle(0x1a120a).fillRect(0, y, VIEW_WIDTH, 12);
      g.fillStyle(0xf6e05e);
      for (let x = -BANNER.stripe * 2 + shift; x < VIEW_WIDTH; x += BANNER.stripe * 2) {
        const from = Math.max(0, x);
        const to = Math.min(VIEW_WIDTH, x + BANNER.stripe);
        if (to > from) g.fillRect(from, y, to - from, 12);
      }
    }
  }
}
