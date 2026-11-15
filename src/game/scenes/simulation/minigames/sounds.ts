import type { SealsGame, ShieldGame } from '../../../../core/minigames/rooms';
import type { MoxieGame, PulseGame, RadioGame } from '../../../../core/minigames/arcade';
import type { PatchGame, StarsGame } from '../../../../core/minigames/puzzles';
import type { WiresGame } from '../../../../core/minigames/power';
import type { Minigame, MinigameId, MinigameInput, MinigameMessage } from '../../../../core/minigames/Minigame';
import { audio } from '../../../audio/audio';
import type { SfxId } from '../../../audio/themes';

/** Sonido de cada aviso de un minijuego (`<id>.<clave>`); los que no están usan el acierto o el error genéricos. */
const MESSAGE_SOUND: Record<string, SfxId | SfxId[] | null> = {
  'bike.tooFast': ['bikeOffPace01', 'bikeOffPace02'],
  'bike.faster': ['bikeOffPace01', 'bikeOffPace02'],
  'bike.good': null,
  'scrubber.caught': 'scrubberCatch',
  'scrubber.oxygen': 'scrubberOxygenLost',
  'radio.locked': 'radioLock',
  'radio.lost': null,
  'moxie.working': 'moxieOxygen',
  'moxie.hot': 'moxieOverheat',
  'pulse.hit': 'pulseMonitorBeep',
  'fuses.fixed': 'fuseInsert',
  'fuses.notBurnt': ['electricSpark01', 'electricSpark02'],
  'fuses.tooStrong': ['electricSpark01', 'electricSpark02'],
  'fuses.tooWeak': ['electricSpark01', 'electricSpark02'],
  'wires.joined': 'wireSplice',
  'wires.wrongColor': ['electricSpark01', 'electricSpark02'],
  'water.flowing': 'water',
  'water.solved': 'water',
  'stars.locked': 'starLock',
  'patch.patched': 'patchApply',
  'patch.noLeak': 'patchMiss',
  'meal.good': ['ingredientAdd01', 'ingredientAdd02'],
  'meal.notYet': 'ingredientReturn',
  'meal.notInRecipe': 'ingredientReturn',
  'shield.filled': 'waterBagPlace',
  // Las partículas frenadas suenan una por una (ver `frame`).
  'shield.blocked': null,
  'plants.fixed.pale': 'growLightOn',
  'plants.fixed.bugs': 'ladybugsRelease',
  'plants.fixed.dry': null,
  'seals.clean': null,
  'seals.gust': 'dustGust',
  'harvest.cut': ['harvestSnip01', 'harvestSnip02'],
  'harvest.unripe': 'harvestMiss',
  'harvest.overripe': 'harvestMiss',
};

/** Grados que gira el cielo del rastreador de estrellas entre un paso del servo y el siguiente. */
const STAR_STEP_DEG = 6;
/** Bip del detector de fugas: cada cuánto suena lejos y encima de la fuga (s). */
const DETECTOR_SLOW_S = 1;
const DETECTOR_FAST_S = 0.12;
/** Cuánto sigue el loop del pedaleo o el riego después de cada acierto (s). */
const LOOP_HOLD_S = 1.6;

/**
 * Sonidos de los minijuegos de las salas: cada uno suena al material de lo que se hace (filtro, dial, calentador,
 * latido, fusible, caño, tierra…). Lee el estado del minijuego en cada cuadro (sólo dibuja: no cambia reglas).
 */
export class MinigameSounds {
  private message: MinigameMessage | null = null;
  private variant = 0;
  private loopUntil = 0;
  private beat = 0;
  private starAngle = 0;
  private detectorAt = 0;
  private cursor = -1;
  private readonly particles = new Set<number>();

  /** Empieza un minijuego nuevo. */
  reset(game: Minigame): void {
    this.stop();
    this.message = null;
    this.beat = 0;
    this.starAngle = (game as StarsGame).angle ?? 0;
    this.detectorAt = 0;
    this.cursor = -1;
    this.particles.clear();
  }

  /** Apaga los loops del minijuego (al cerrarlo o ganarlo). */
  stop(): void {
    audio.loop('minigame', null);
  }

  /** Después de `game.update`: suena lo que pasó en este cuadro. */
  frame(game: Minigame, input: MinigameInput): void {
    const t = game.elapsed;
    if (game.message && game.message !== this.message) {
      this.message = game.message;
      if (!game.done) this.onMessage(game.id, game.message);
    }
    if (game.done) return;
    let loop: Parameters<typeof audio.loop>[1] = null;
    let volume = 0.6;
    switch (game.id) {
      case 'bike':
        // Pedalea bien: el loop sigue mientras la velocidad quede en la franja.
        if (game.message?.key === 'good') this.loopUntil = t + LOOP_HOLD_S;
        if (t < this.loopUntil) loop = 'bike';
        break;
      case 'plants':
        if (t < this.loopUntil) loop = 'plantWater';
        break;
      case 'radio': {
        const radio = game as RadioGame;
        loop = 'radioTuning';
        volume = 0.15 + 0.55 * (1 - radio.quality);
        break;
      }
      case 'moxie':
        if (input.held.action && !(game as MoxieGame).overheated) loop = 'moxieHeat';
        break;
      case 'seals': {
        const seals = game as SealsGame;
        if (input.held.action && (seals.dust[seals.segment] ?? 0) > 0) loop = 'sealBrush';
        break;
      }
      case 'pulse': {
        const beats = (game as PulseGame).beats;
        while (this.beat < beats.length && beats[this.beat]!.t <= t) {
          audio.sfx('heartbeat', 1, 0.7);
          this.beat++;
        }
        break;
      }
      case 'stars': {
        const angle = (game as StarsGame).angle;
        if (Math.abs(angle - this.starAngle) >= STAR_STEP_DEG) {
          this.starAngle = angle;
          audio.sfx('starTrackerStep', 1, 0.5);
        }
        break;
      }
      case 'patch': {
        const signal = (game as PatchGame).signal;
        if (signal > 0 && t >= this.detectorAt) {
          audio.sfx('leakDetectorBeep', 1, 0.5 + 0.4 * signal);
          this.detectorAt = t + DETECTOR_SLOW_S + (DETECTOR_FAST_S - DETECTOR_SLOW_S) * signal;
        }
        break;
      }
      case 'water':
        if (input.pressed.action) audio.sfx(this.pick(['pipeRotate01', 'pipeRotate02']));
        break;
      case 'wires': {
        const current = (game as WiresGame).cursor.index;
        if (this.cursor !== -1 && current !== this.cursor) audio.sfx('wireSelect', 1, 0.5);
        this.cursor = current;
        break;
      }
      case 'shield':
        for (const p of (game as ShieldGame).particles) {
          if (!p.end || this.particles.has(p.id)) continue;
          this.particles.add(p.id);
          audio.sfx(p.end.kind === 'blocked' ? 'particleAbsorbed' : 'particleThrough', 1, p.end.kind === 'blocked' ? 0.8 : 0.5);
        }
        break;
      default:
        break;
    }
    audio.loop('minigame', loop, volume);
  }

  private onMessage(id: MinigameId, message: MinigameMessage): void {
    const key = `${id}.${message.key}`;
    if (key === 'plants.fixed.dry') this.loopUntil = message.at + LOOP_HOLD_S;
    const sound = key in MESSAGE_SOUND ? MESSAGE_SOUND[key] : message.good ? 'good' : 'bad';
    if (!sound) return;
    audio.sfx(Array.isArray(sound) ? this.pick(sound) : sound, id === 'scrubber' ? 0.92 + (this.variant % 3) * 0.06 : 1);
    this.variant++;
  }

  /** Alterna las variantes de un sonido para que no canse. */
  private pick(options: SfxId[]): SfxId {
    return options[this.variant++ % options.length]!;
  }
}
