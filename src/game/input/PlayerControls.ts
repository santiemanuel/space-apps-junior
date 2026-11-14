import Phaser from 'phaser';

/** Abstracción de entrada: el Player depende de esta interfaz, no del teclado. */
export interface PlayerControls {
  /** Vector de movimiento normalizado (-1..1 por eje). */
  movement(): { x: number; y: number };
  interactHeld(): boolean;
  choiceJustPressed(): 1 | 2 | 3 | null;
  restartJustPressed(): boolean;
}

export function createKeyboardControls(scene: Phaser.Scene): PlayerControls {
  const keyboard = scene.input.keyboard;
  if (!keyboard) throw new Error('Teclado no disponible');
  const cursors = keyboard.createCursorKeys();
  const keys = keyboard.addKeys('W,A,S,D,E,R,ONE,TWO,THREE') as Record<string, Phaser.Input.Keyboard.Key>;
  const down = (...k: (Phaser.Input.Keyboard.Key | undefined)[]) => k.some((key) => key?.isDown);
  const just = (key: Phaser.Input.Keyboard.Key | undefined) => !!key && Phaser.Input.Keyboard.JustDown(key);

  return {
    movement() {
      const x = Number(down(cursors.right, keys.D)) - Number(down(cursors.left, keys.A));
      const y = Number(down(cursors.down, keys.S)) - Number(down(cursors.up, keys.W));
      const length = Math.hypot(x, y) || 1;
      return { x: x / length, y: y / length };
    },
    interactHeld: () => down(keys.E, cursors.space),
    choiceJustPressed: () => (just(keys.ONE) ? 1 : just(keys.TWO) ? 2 : just(keys.THREE) ? 3 : null),
    restartJustPressed: () => just(keys.R),
  };
}
