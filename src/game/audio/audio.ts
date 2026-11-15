import { MUSIC, noteFrequency, SFX, type MusicId, type SfxId } from './themes';
import { ZZFX_SAMPLE_RATE, zzfxSamples } from './zzfx';

/** Cuánto se programa por adelantado la música (s) y cada cuánto se revisa (ms). */
const LOOKAHEAD_S = 0.25;
const TICK_MS = 60;
const LEAD_GAIN = 0.07;
const BASS_GAIN = 0.11;
const HAT_GAIN = 0.03;

/**
 * Audio del juego sobre Web Audio: efectos de ZzFX (guardados ya generados) y música chiptune con un secuenciador
 * propio. Sonidos y música tienen cada uno su volumen (los ajustes). El navegador no deja sonar nada hasta el primer
 * clic o tecla: el contexto se crea y se reanuda entonces.
 */
class GameAudio {
  private context: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private readonly buffers = new Map<SfxId, AudioBuffer>();
  private volumes = { sound: 0.8, music: 0.6 };
  private muted = false;
  private theme: MusicId | null = null;
  private song: { id: MusicId; step: number; nextAt: number; gain: GainNode; timer: number } | null = null;

  constructor() {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      const ctx = this.ensure();
      if (ctx?.state === 'suspended') void ctx.resume();
      if (this.theme && !this.song) this.music(this.theme);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  private ensure(): AudioContext | null {
    if (this.context) return this.context;
    const Ctor = typeof window !== 'undefined' ? window.AudioContext : undefined;
    if (!Ctor) return null;
    const ctx = new Ctor();
    this.context = ctx;
    this.sfxGain = ctx.createGain();
    this.musicGain = ctx.createGain();
    this.sfxGain.connect(ctx.destination);
    this.musicGain.connect(ctx.destination);
    this.applyVolumes();
    return ctx;
  }

  private applyVolumes(): void {
    const factor = this.muted ? 0 : 1;
    this.sfxGain?.gain.setValueAtTime(this.volumes.sound * factor, this.context?.currentTime ?? 0);
    this.musicGain?.gain.setValueAtTime(this.volumes.music * factor, this.context?.currentTime ?? 0);
  }

  /** Volúmenes de los ajustes (0..1). */
  setVolumes(sound: number, music: number): void {
    this.volumes = { sound, music };
    this.applyVolumes();
  }

  /** Volumen de los sonidos ahora (0 si está silenciado): para lo que suena por fuera de `sfx`. */
  get soundVolume(): number {
    return this.muted ? 0 : this.volumes.sound;
  }

  /** M en el mapa: silencia o vuelve a encender todo. */
  toggleMute(): boolean {
    this.muted = !this.muted;
    this.applyVolumes();
    return this.muted;
  }

  /** Efecto de sonido. Si el audio todavía no se habilitó (sin clic ni tecla), no suena. */
  sfx(id: SfxId, rate = 1): void {
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running' || !this.sfxGain) return;
    let buffer = this.buffers.get(id);
    if (!buffer) {
      const samples = zzfxSamples(SFX[id]);
      buffer = ctx.createBuffer(1, Math.max(1, samples.length), ZZFX_SAMPLE_RATE);
      buffer.getChannelData(0).set(samples);
      this.buffers.set(id, buffer);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    source.connect(this.sfxGain);
    source.start();
  }

  /** Cambia la música (con un fundido corto); null la apaga. El mismo tema no vuelve a empezar. */
  music(id: MusicId | null): void {
    if (id === this.theme && this.song) return;
    this.theme = id;
    this.stopSong();
    const ctx = this.context;
    if (!id || !ctx || ctx.state !== 'running' || !this.musicGain) return;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.6);
    gain.connect(this.musicGain);
    const song = { id, step: 0, nextAt: ctx.currentTime + 0.1, gain, timer: 0 };
    song.timer = window.setInterval(() => this.schedule(), TICK_MS);
    this.song = song;
    this.schedule();
  }

  private stopSong(): void {
    const song = this.song;
    const ctx = this.context;
    if (!song || !ctx) return;
    window.clearInterval(song.timer);
    song.gain.gain.cancelScheduledValues(ctx.currentTime);
    song.gain.gain.setValueAtTime(song.gain.gain.value, ctx.currentTime);
    song.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
    window.setTimeout(() => song.gain.disconnect(), 600);
    this.song = null;
  }

  /** Programa las notas que caen dentro de la ventana de adelanto. */
  private schedule(): void {
    const song = this.song;
    const ctx = this.context;
    if (!song || !ctx) return;
    const theme = MUSIC[song.id];
    const stepS = 60 / theme.bpm / 2;
    const steps = theme.lead.length;
    while (song.nextAt < ctx.currentTime + LOOKAHEAD_S) {
      if (song.step >= steps && !theme.loop) {
        window.clearInterval(song.timer);
        // Terminó el tema corto: sigue el que le toca, para que la pantalla no quede en silencio.
        const { next } = theme;
        if (next) window.setTimeout(() => this.song === song && this.music(next), Math.max(0, song.nextAt - ctx.currentTime) * 1000);
        return;
      }
      const i = song.step % steps;
      const length = (track: readonly string[]) => {
        let n = 1;
        while (track[(i + n) % steps] === '-' && i + n < steps) n++;
        return n * stepS;
      };
      this.note(song.gain, 'square', theme.lead[i]!, song.nextAt, length(theme.lead) * 0.9, LEAD_GAIN);
      this.note(song.gain, 'triangle', theme.bass[i] ?? '-', song.nextAt, length(theme.bass) * 0.95, BASS_GAIN);
      if (theme.hat && i % 2 === 0) this.hat(song.gain, song.nextAt);
      song.nextAt += stepS;
      song.step++;
    }
  }

  private note(out: GainNode, type: OscillatorType, note: string, at: number, length: number, volume: number): void {
    const frequency = noteFrequency(note);
    const ctx = this.context!;
    if (frequency === null) return;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, at);
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(volume, at + 0.01);
    env.gain.setValueAtTime(volume, at + Math.max(0.02, length - 0.05));
    env.gain.linearRampToValueAtTime(0, at + length);
    osc.connect(env).connect(out);
    osc.start(at);
    osc.stop(at + length + 0.02);
  }

  private hat(out: GainNode, at: number): void {
    const ctx = this.context!;
    let buffer = this.buffers.get('tick');
    if (!buffer) {
      const samples = zzfxSamples([1, , 6000, , 0.005, 0.03, 4]);
      buffer = ctx.createBuffer(1, samples.length, ZZFX_SAMPLE_RATE);
      buffer.getChannelData(0).set(samples);
    }
    const source = ctx.createBufferSource();
    const env = ctx.createGain();
    env.gain.value = HAT_GAIN;
    source.buffer = buffer;
    source.connect(env).connect(out);
    source.start(at);
  }
}

/** Audio del juego (uno solo para toda la partida). */
export const audio = new GameAudio();
