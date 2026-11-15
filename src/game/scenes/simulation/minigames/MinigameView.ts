import Phaser from 'phaser';
import type { EventBus } from '../../../../core/events/EventBus';
import type { SimulationEvents } from '../../../../core/habitat/events';
import { createMinigame } from '../../../../core/minigames/catalog';
import type { Minigame, MinigameInput } from '../../../../core/minigames/Minigame';
import { TutorialPrefs } from '../../../../core/minigames/tutorialPrefs';
import { t, type TranslationKey, type TranslationParams } from '../../../../i18n';
import { GAME_HEIGHT, TILE } from '../../../display';
import { createBrowserSaveStore } from '../../../storage/browserSaveStore';
import { Painter } from './Painter';
import { MINIGAME_ICON, renderMinigame, type Area } from './renderers';
import { renderTutorial } from './tutorials';
import { audio } from '../../../audio/audio';
import { MinigameSounds } from './sounds';
import { KEY_BUTTON, KEY_BUTTON_COLOR, panelIn } from '../../../ui/ui';

const tr = (key: string, params?: TranslationParams) => t(key as TranslationKey, params);
/** La vista del mapa (el tablero queda al lado, a la vista). */
const VIEW_W = 21 * TILE;
const BOX = { x: 94, y: 78, w: 820, h: 566 } as const;
const AREA: Area = { x: BOX.x + 30, y: BOX.y + 74, w: BOX.w - 60, h: 330 };
const MESSAGE_S = 2.2;
/** Después de ganar, cuánto esperar antes de aceptar E para seguir (ms): que no se saltee el cartel sin verlo. */
const RESULT_LOCK_MS = 700;
/** Debajo del tutorial: la casilla «No volver a mostrar» (a la izquierda) y el botón para empezar (a la derecha). */
const TUTORIAL_ROW = { y: AREA.y + AREA.h + 14, h: 34 } as const;
const CHECKBOX = { x: AREA.x, w: 330 } as const;
const START = { x: AREA.x + AREA.w - 200, w: 200 } as const;
/** Entre la casilla y el botón de empezar: cancelar y volver al mapa sin jugar (Q o clic). */
const CANCEL = { x: CHECKBOX.x + CHECKBOX.w + 24, w: 180 } as const;
/** Esquina de abajo a la derecha del cartel: el botón de salir (Q) mientras se juega y el de seguir (E) al ganar. */
const CORNER = { right: BOX.x + BOX.w - 24, bottom: BOX.y + BOX.h - 12 } as const;

type Request = SimulationEvents['sim:minigame'];
type KeyName = 'LEFT' | 'RIGHT' | 'UP' | 'DOWN' | 'W' | 'A' | 'S' | 'D' | 'E' | 'SPACE' | 'ONE' | 'TWO' | 'THREE' | 'Q' | 'ENTER' | 'X';

/**
 * Minijuego de una sala, abierto con E desde el mapa (vista del tablero, como el estado completo): el reloj queda en
 * pausa mientras se juega. Ganarlo termina la tarea de la sala; al final, las estrellas, lo que se logró y un dato
 * real. Q sale sin terminar (Esc ya abre la pausa del juego). Antes de jugar va un mini tutorial en una pantalla, con
 * una casilla (X o clic) para no volver a verlo.
 */
export class MinigameView {
  private readonly root: Phaser.GameObjects.Container;
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly painter: Painter;
  /** Capa del cartel final, encima de todo lo del juego (usa la misma luz). */
  private readonly over: Painter;
  private readonly keys: Record<KeyName, Phaser.Input.Keyboard.Key>;
  private game: Minigame | null = null;
  private request: Request | null = null;
  private readonly sounds = new MinigameSounds();
  private wonAt: number | null = null;
  /** Tutorial a la vista, con la casilla «No volver a mostrar» marcada o no. */
  private tutorial: { checked: boolean } | null = null;
  /** Último aviso del minijuego que ya sonó. */
  private readonly prefs = new TutorialPrefs(createBrowserSaveStore());
  /** Botón de la esquina dibujado en este cuadro (para el clic). */
  private corner: { x: number; y: number; w: number; h: number; action: 'exit' | 'continue' } | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly sim: EventBus<SimulationEvents>,
  ) {
    this.root = scene.add.container(0, 0).setDepth(110).setVisible(false);
    this.frame = scene.add.graphics();
    this.root.add(this.frame);
    scene.lights.enable().setAmbientColor(0x8a8aa0);
    this.painter = new Painter(scene, this.root);
    this.over = new Painter(scene, this.root, false);
    this.painter.setVisible(false);
    this.keys = scene.input.keyboard!.addKeys('LEFT,RIGHT,UP,DOWN,W,A,S,D,E,SPACE,ONE,TWO,THREE,Q,ENTER,X', false) as Record<KeyName, Phaser.Input.Keyboard.Key>;
    this.drawFrame();
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => this.click(pointer.x, pointer.y));
  }

  get visible(): boolean {
    return this.root.visible;
  }

  open(request: Request): void {
    this.request = request;
    this.game = createMinigame(request.id, request.setup);
    this.wonAt = null;
    this.tutorial = this.game.tutorial && !this.prefs.hidden(request.id) ? { checked: false } : null;
    // Que la E que abrió el juego no cuente como la primera jugada.
    for (const key of Object.values(this.keys)) Phaser.Input.Keyboard.JustDown(key);
    this.sounds.reset(this.game);
    if (request.id === 'meal' && !this.game.card) audio.sfx('mealCook', 1, 0.7);
    panelIn(this.root, 220);
    this.root.setVisible(true);
    this.painter.setVisible(true);
    this.sim.emit('sim:pause', { paused: true });
  }

  close(): void {
    this.endTutorial();
    this.sounds.stop();
    const zone = this.request?.zone;
    this.game = null;
    this.request = null;
    this.root.setVisible(false);
    this.painter.setVisible(false);
    this.sim.emit('sim:pause', { paused: false });
    if (zone) this.sim.emit('sim:minigameClosed', { zone });
  }

  update(now: number, deltaMs: number): void {
    const game = this.game;
    if (!game || !this.request) return;
    const input = this.input();
    if (Phaser.Input.Keyboard.JustDown(this.keys.Q)) {
      audio.sfx('back');
      return this.close();
    }
    const enter = Phaser.Input.Keyboard.JustDown(this.keys.ENTER);
    if (this.tutorial) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.X)) {
        this.tutorial.checked = !this.tutorial.checked;
        audio.sfx('toggle');
      }
      if (input.pressed.action || enter) {
        audio.sfx('select');
        this.endTutorial();
      }
    } else if (this.wonAt === null) {
      game.update(Math.min(deltaMs / 1000, 0.1), input);
      if (game.closed) return this.close();
      // Cada minijuego suena a lo que se hace en él (filtro, dial, latido, fusible, tierra…).
      this.sounds.frame(game, input);
      if (game.done) {
        this.sounds.stop();
        audio.sfx(this.request.id === 'meal' && !game.card ? 'mealServe' : 'win');
        this.wonAt = now;
        this.sim.emit('sim:minigameWon', { zone: this.request.zone });
      }
    } else if ((input.pressed.action || enter) && now - this.wonAt > RESULT_LOCK_MS) {
      audio.sfx('select');
      return this.close();
    }
    this.draw(game, this.request, now);
  }

  /** Se termina de ver el tutorial (para jugar o para salir): si se marcó la casilla, no vuelve a aparecer. */
  private endTutorial(): void {
    if (!this.tutorial || !this.request) return;
    if (this.tutorial.checked) this.prefs.setHidden(this.request.id, true);
    this.tutorial = null;
  }

  /** Clic en el botón de la esquina, o en la casilla o el botón de empezar del tutorial. */
  private click(x: number, y: number): void {
    if (!this.root.visible) return;
    const c = this.corner;
    if (!this.tutorial && c && x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) {
      audio.sfx(c.action === 'exit' ? 'back' : 'select');
      return this.close();
    }
    if (!this.tutorial || y < TUTORIAL_ROW.y || y > TUTORIAL_ROW.y + TUTORIAL_ROW.h) return;
    if (x >= CHECKBOX.x && x <= CHECKBOX.x + CHECKBOX.w) {
      this.tutorial.checked = !this.tutorial.checked;
      audio.sfx('toggle');
    } else if (x >= START.x && x <= START.x + START.w) {
      audio.sfx('select');
      this.endTutorial();
    } else if (x >= CANCEL.x && x <= CANCEL.x + CANCEL.w) {
      audio.sfx('back');
      this.close();
    }
  }

  private input(): MinigameInput {
    const k = this.keys;
    const just = (...keys: Phaser.Input.Keyboard.Key[]) => keys.map((key) => Phaser.Input.Keyboard.JustDown(key)).some(Boolean);
    const one = just(k.ONE);
    const two = just(k.TWO);
    const three = just(k.THREE);
    return {
      held: {
        left: k.LEFT.isDown || k.A.isDown,
        right: k.RIGHT.isDown || k.D.isDown,
        up: k.UP.isDown || k.W.isDown,
        down: k.DOWN.isDown || k.S.isDown,
        action: k.E.isDown || k.SPACE.isDown,
      },
      pressed: {
        left: just(k.LEFT, k.A),
        right: just(k.RIGHT, k.D),
        up: just(k.UP, k.W),
        down: just(k.DOWN, k.S),
        action: just(k.E, k.SPACE),
        choice: one ? 1 : two ? 2 : three ? 3 : null,
      },
    };
  }

  /** Fondo oscuro sobre el mapa y el marco del cartel (fijos). */
  private drawFrame(): void {
    const g = this.frame;
    g.fillStyle(0x05070d, 0.72).fillRect(0, 0, VIEW_W, GAME_HEIGHT);
    const { x, y, w, h } = BOX;
    const octagon = (inset: number, cut: number, color: number) => {
      const [ix, iy, iw, ih] = [x + inset, y + inset, w - 2 * inset, h - 2 * inset];
      g.fillStyle(color).fillRect(ix + cut, iy, iw - 2 * cut, ih).fillRect(ix, iy + cut, iw, ih - 2 * cut).fillRect(ix + cut / 2, iy + cut / 2, iw - cut, ih - cut);
    };
    octagon(0, 12, 0x05070d);
    octagon(3, 9, 0x5a5f86);
    g.fillStyle(0xa3a8d0).fillRect(x + 12, y + 3, w - 24, 3);
    octagon(6, 6, 0x1c2136);
    g.fillStyle(0x10142a).fillRect(AREA.x - 8, AREA.y - 8, AREA.w + 16, AREA.h + 16);
    for (const [rx, ry] of [[x + 14, y + 14], [x + w - 18, y + 14], [x + 14, y + h - 18], [x + w - 18, y + h - 18]] as const)
      g.fillStyle(0x05070d).fillRect(rx - 1, ry - 1, 6, 6).fillStyle(0x8a90b8).fillRect(rx, ry, 4, 4);
  }

  private draw(game: Minigame, request: Request, now: number): void {
    const p = this.painter;
    p.begin();
    const ns = `hud.minigame.${game.id}`;
    p.image(MINIGAME_ICON[game.id], BOX.x + 52, BOX.y + 38, { scale: 0.6 });
    p.text(tr(`${ns}.title`), BOX.x + 84, BOX.y + 24, { size: 22, color: '#fbd38d' });
    this.corner = null;
    if (request.badge) p.text(request.badge, BOX.x + BOX.w - 30, BOX.y + 30, { size: 13, color: request.setup.hard ? '#fc8181' : '#9ae6b4', originX: 1 });
    if (this.tutorial) {
      renderTutorial(p, game.id, AREA, now);
      this.tutorialRow(this.tutorial.checked, now);
      this.over.begin();
      this.over.end();
      p.focus(AREA.x + AREA.w / 2, AREA.y + 80);
      return p.end();
    }
    renderMinigame(p, game, AREA, now);
    const below = AREA.y + AREA.h + 16;
    p.text(tr(`${ns}.${game.helpKey}`), AREA.x, below, { size: 14, color: '#cbd5e0', wrap: AREA.w });
    const msg = game.message;
    if (msg && game.elapsed - msg.at < MESSAGE_S && this.wonAt === null) {
      const alpha = Math.min(1, (MESSAGE_S - (game.elapsed - msg.at)) / 0.4);
      p.text(tr(`${ns}.${msg.key}`), BOX.x + BOX.w / 2, below + 42, { size: 16, color: msg.good ? '#9ae6b4' : '#fbd38d', originX: 0.5, wrap: AREA.w, align: 'center' }).setAlpha(alpha);
    }
    if (!game.card) this.progressBar(game.progress, BOX.y + BOX.h - 62);
    if (this.wonAt === null) this.cornerButton('Q', tr('hud.minigame.exit'), 'exit');
    else if (now - this.wonAt > RESULT_LOCK_MS) this.cornerButton('E', tr('hud.minigame.continue'), 'continue', Math.sin(now / 200) > 0);
    this.over.begin();
    if (this.wonAt !== null) this.result(game, request, now);
    this.over.end();
    p.end();
  }

  /** Casilla «No volver a mostrar» (X), cancelar (Q) y botón para empezar (E). */
  private tutorialRow(checked: boolean, now: number): void {
    const p = this.painter;
    const cy = TUTORIAL_ROW.y + TUTORIAL_ROW.h / 2;
    const box = { x: CHECKBOX.x + 2, y: cy - 12, size: 24 };
    p.g.fillStyle(0x05070d).fillRect(box.x - 2, box.y - 2, box.size + 4, box.size + 4);
    p.g.fillStyle(checked ? 0x2f855a : 0x2d3748).fillRect(box.x, box.y, box.size, box.size);
    if (checked) p.text('✓', box.x + box.size / 2, cy + 1, { size: 20, color: '#f0fff4', originX: 0.5, originY: 0.5 });
    p.text(tr('hud.minigame.tutorial.dontShow'), box.x + box.size + 12, cy, { size: 14, color: checked ? '#c6f6d5' : '#cbd5e0', originY: 0.5 });
    p.key('X', CHECKBOX.x + CHECKBOX.w - 20, cy, checked);
    const lit = Math.sin(now / 250) > 0;
    p.key('Q', CANCEL.x + 18, cy);
    p.text(tr('hud.minigame.tutorial.cancel'), CANCEL.x + 44, cy, { size: 14, color: '#cbd5e0', originY: 0.5 });
    p.key('E', START.x + 22, cy, lit);
    p.text(tr('hud.minigame.tutorial.start'), START.x + 50, cy, { size: 18, color: '#fbd38d', originY: 0.5 });
  }

  /** Botón de la esquina con su tecla, como los de las otras pantallas (`addKeyButton`); `lit` lo hace latir. */
  private cornerButton(key: string, label: string, action: 'exit' | 'continue', lit = false): void {
    const p = this.painter;
    const { height, pad, gap, cap, size } = KEY_BUTTON;
    const c = KEY_BUTTON_COLOR;
    const text = p.text(label, 0, 0, { size, color: c.text, originY: 0.5 });
    const w = pad + cap + gap + text.width + pad;
    const x = CORNER.right - w;
    const y = CORNER.bottom - height;
    const pointer = this.scene.input.activePointer;
    const hover = pointer.x >= x && pointer.x <= x + w && pointer.y >= y && pointer.y <= y + height;
    p.g.fillStyle(c.outline).fillRect(x - 3, y - 3, w + 6, height + 6);
    p.g.fillStyle(hover || lit ? c.hover : c.fill).fillRect(x, y, w, height);
    p.g.fillStyle(c.shine).fillRect(x, y, w, 3);
    p.g.fillStyle(c.cap).fillRect(x + pad, y + (height - cap) / 2, cap, cap);
    p.text(key, x + pad + cap / 2, y + height / 2, { size: 13, color: c.capText, originX: 0.5, originY: 0.5 });
    text.setPosition(x + pad + cap + gap, Math.round(y + height / 2 + 1));
    this.corner = { x, y, w, h: height, action };
  }

  private progressBar(fraction: number, y: number): void {
    const g = this.painter.g;
    const segments = 30;
    const seg = Math.floor(AREA.w / segments);
    const full = Math.round(fraction * segments);
    g.fillStyle(0x05070d).fillRect(AREA.x - 3, y - 3, seg * segments + 4, 16);
    for (let i = 0; i < segments; i++) {
      g.fillStyle(i < full ? 0x63b3ed : 0x2d3748).fillRect(AREA.x + i * seg, y, seg - 2, 10);
      if (i < full) g.fillStyle(0xffffff, 0.35).fillRect(AREA.x + i * seg, y, seg - 2, 3);
    }
  }

  /** Cartel del final: estrellas, lo que se logró y el dato real. */
  private result(game: Minigame, request: Request, now: number): void {
    const p = this.over;
    const k = Math.min(1, (now - this.wonAt!) / 300);
    p.g.fillStyle(0x0b1020, 0.92 * k).fillRect(AREA.x - 8, AREA.y - 8, AREA.w + 16, AREA.h + 16);
    const cx = AREA.x + AREA.w / 2;
    p.text(tr('hud.minigame.done'), cx, AREA.y + 6, { size: 30, color: '#fbd38d', originX: 0.5 }).setAlpha(k);
    const stars = game.stars();
    for (let i = 0; i < 3; i++) {
      const pop = Math.min(1, Math.max(0, (now - this.wonAt! - 250 - i * 180) / 200));
      p.image('star', cx + (i - 1) * 70, AREA.y + 82, { scale: (i < stars ? 0.9 : 0.7) * (0.6 + 0.4 * pop), tint: i < stars ? undefined : 0x3a4060, alpha: pop });
    }
    p.text(request.reward, cx, AREA.y + 132, { size: 17, color: '#9ae6b4', originX: 0.5, wrap: AREA.w - 40, align: 'center' }).setAlpha(k);
    p.text(tr('hud.minigame.fact'), AREA.x + 30, AREA.y + 182, { size: 14, color: '#90cdf4' }).setAlpha(k);
    p.text(tr(`hud.minigame.${game.id}.fact`, { delay: this.delayText(request.setup.delaySeconds ?? 0) }), AREA.x + 30, AREA.y + 204, { size: 15, color: '#e2e8f0', wrap: AREA.w - 60 }).setAlpha(k);
    this.painter.focus(cx, AREA.y + 82);
  }

  private delayText(seconds: number): string {
    if (seconds < 1.5) return tr('hud.minigame.radio.delayOneSecond');
    return seconds < 90 ? tr('hud.minigame.radio.delaySeconds', { n: Math.round(seconds) }) : tr('hud.minigame.radio.delayMinutes', { n: Math.round(seconds / 60) });
  }
}
