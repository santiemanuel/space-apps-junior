import Phaser from 'phaser';
import { Rng } from '../../../core/rng/Rng';
import { FlightTextures, TitleTextures } from '../../assets';

const W = 1280;
const H = 720;
const ART = 4;
const CONFETTI = [0xfc8181, 0xf6e05e, 0x68d391, 0x63b3ed, 0xb794f4, 0xf6ad55];

/**
 * Fondo animado del informe final (pixel art de vuelo y del menú). Misión cumplida: cielo, mar, la cápsula flotando
 * con su paracaídas y papel picado. Misión suspendida: espacio, Marte y una nave de rescate que se acerca (la
 * tripulación está a salvo esperando). Va detrás de todo y no se puede tocar.
 */
export function drawReportBackdrop(scene: Phaser.Scene, completed: boolean): void {
  const rng = new Rng(completed ? 11 : 13);
  const g = scene.add.graphics().setDepth(-20);
  if (completed) {
    g.fillGradientStyle(0x2b6cb0, 0x2b6cb0, 0x9fd3f5, 0x9fd3f5, 1).fillRect(0, 0, W, H);
    g.fillStyle(0x2c5282).fillRect(0, 560, W, H - 560);
    for (let x = 0; x < W; x += 28) g.fillStyle(0x90cdf4, 0.6).fillRect(x + (x % 56 ? 0 : 10), 574 + (x % 84 ? 0 : 18), 14, 3);
    if (scene.textures.exists(FlightTextures.capsule)) {
      const boat = scene.add.container(1080, 560).setDepth(-19);
      boat.add([
        scene.add.image(0, -40, FlightTextures.parachute).setScale(ART).setOrigin(0.5, 1).setAlpha(0.9),
        scene.add.image(0, -8, FlightTextures.capsule).setScale(ART),
      ]);
      scene.tweens.add({ targets: boat, y: 566, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
    // Papel picado que cae despacio, una y otra vez.
    for (let i = 0; i < 60; i++) {
      const piece = scene.add
        .rectangle(rng.between(0, W), rng.between(-H, 0), 6, 10, rng.pick(CONFETTI))
        .setDepth(-5)
        .setAngle(rng.between(0, 180));
      scene.tweens.add({
        targets: piece,
        y: H + 20,
        angle: piece.angle + 360,
        x: piece.x + rng.between(-60, 60),
        duration: rng.between(4500, 8000),
        delay: rng.between(0, 3000),
        repeat: -1,
      });
    }
    return;
  }
  g.fillStyle(0x05070d).fillRect(0, 0, W, H);
  for (let i = 0; i < 160; i++) g.fillStyle(0xffffff, rng.between(0.3, 1)).fillRect(Math.floor(rng.between(0, W)), Math.floor(rng.between(0, H)), 2, 2);
  g.fillStyle(0xc56b3a).fillCircle(1150, 600, 210);
  g.fillStyle(0x9c4a24, 0.6).fillCircle(1100, 560, 60).fillCircle(1210, 650, 40);
  if (scene.textures.exists(TitleTextures.ship)) {
    // La nave de la tripulación espera quieta; la de rescate se acerca y vuelve a empezar.
    scene.add.sprite(860, 360, TitleTextures.ship, 0).setScale(3).setDepth(-19).setAlpha(0.9);
    const rescue = scene.add.sprite(-80, 300, TitleTextures.ship, 1).setScale(2).setDepth(-19).setTint(0x9ae6b4);
    scene.tweens.add({ targets: rescue, x: 760, duration: 9000, repeat: -1, ease: 'Sine.Out' });
  }
}
