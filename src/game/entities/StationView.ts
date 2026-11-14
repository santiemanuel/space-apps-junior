import Phaser from 'phaser';
import type { MissionState } from '../../core/missions/types';
import { TILE_SIZE, type StationLayout } from '../../content/habitat';

const SIZE = TILE_SIZE * 2;
const STATUS_COLOR: Record<MissionState['status'] | 'idle', number> = {
  available: 0xffffff,
  active: 0x63b3ed,
  completed: 0x48bb78,
  failed: 0xf56565,
  idle: 0x4a5568,
};

/** Representación visual de una estación. Sólo pinta estado: no contiene reglas. */
export class StationView extends Phaser.GameObjects.Container {
  readonly zone: Phaser.GameObjects.Zone;
  private readonly frame: Phaser.GameObjects.Rectangle;
  private readonly bar: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, readonly layout: StationLayout) {
    super(scene, (layout.col + 0.5) * TILE_SIZE, (layout.row + 0.5) * TILE_SIZE);
    const body = scene.add.rectangle(0, 0, SIZE, SIZE, layout.color, 0.85);
    this.frame = scene.add.rectangle(0, 0, SIZE + 6, SIZE + 6).setStrokeStyle(2, STATUS_COLOR.available);
    const label = scene.add.text(0, SIZE / 2 + 10, layout.label, { fontFamily: 'monospace', fontSize: '12px', color: '#e2e8f0' }).setOrigin(0.5, 0);
    scene.add.rectangle(this.x - SIZE / 2, this.y - SIZE / 2 - 10, SIZE, 5, 0x2d3748).setOrigin(0, 0.5);
    this.bar = scene.add.rectangle(this.x - SIZE / 2, this.y - SIZE / 2 - 10, 0, 5, 0x63b3ed).setOrigin(0, 0.5).setDepth(1);
    this.add([this.frame, body, label]);
    scene.add.existing(this);

    this.zone = scene.add.zone(this.x, this.y, SIZE + TILE_SIZE, SIZE + TILE_SIZE);
    scene.physics.add.existing(this.zone, true);
  }

  render(mission: MissionState | undefined, postponed: boolean): void {
    const status = mission?.status ?? 'idle';
    this.frame.setStrokeStyle(2, postponed ? 0xed8936 : STATUS_COLOR[status]);
    this.bar.width = SIZE * (mission?.progress ?? 0);
  }
}
