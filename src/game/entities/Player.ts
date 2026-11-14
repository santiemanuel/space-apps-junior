import Phaser from 'phaser';
import type { PlayerControls } from '../input/PlayerControls';
import { TextureKeys } from '../textures';

export class Player extends Phaser.Physics.Arcade.Sprite {
  static readonly SPEED = 160;

  constructor(scene: Phaser.Scene, x: number, y: number, private readonly controls: PlayerControls) {
    super(scene, x, y, TextureKeys.Player);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true).setCircle(10, 2, 2).setDepth(10);
  }

  /** `frozen` detiene al jugador (p. ej. durante una decisión). */
  move(frozen: boolean): void {
    const { x, y } = frozen ? { x: 0, y: 0 } : this.controls.movement();
    this.setVelocity(x * Player.SPEED, y * Player.SPEED);
    if (x !== 0 || y !== 0) this.setRotation(Math.atan2(y, x));
  }

  get interacting(): boolean {
    return this.controls.interactHeld();
  }
}
