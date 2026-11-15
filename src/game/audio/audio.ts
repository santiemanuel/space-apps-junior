import { LOOPS, MUSIC, noteFrequency, SFX, soundUrl, type AmbienceId, type LoopId, type MusicId, type SfxId } from './themes';
import { ZZFX_SAMPLE_RATE, zzfxSamples } from './zzfx';

/** Cuánto se programa por adelantado la música (s) y cada cuánto se revisa (ms). */
const LOOKAHEAD_S = 0.25;
const TICK_MS = 60;
const LEAD_GAIN = 0.07;
const BASS_GAIN = 0.11;
const HAT_GAIN = 0.03;
/** Volumen del ambiente respecto de los efectos, y el fundido de los loops (s). */
const AMBIENCE_GAIN = 0.35;
const LOOP_FADE_S = 0.6;

/**
 * Audio del juego sobre Web Audio: efectos y ambientes en MP3 (se bajan y decodifican al habilitarse el audio) y
 * música chiptune con un secuenciador propio. Sonidos y música tienen cada uno su volumen (los ajustes). El navegador no deja sonar nada hasta el primer
 * clic o tecla: el contexto se crea y se reanuda entonces.
 */
class GameAudio {
  private context: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  /** Sonidos ya decodificados, por archivo. */
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly loading = new Set<string>();
  private hatBuffer: AudioBuffer | null = null;
  /** Loops por canal (ambiente, vuelo, clima…): el pedido y lo que suena. */
  private readonly loops = new Map<string, { id: LoopId | null; volume: number; node: { source: AudioBufferSourceNode; gain: GainNode } | null }>();
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
      for (const [channel, loop] of this.loops) if (loop.id && !loop.node) this.startLoop(channel, loop.id, loop.volume);
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
    for (const file of [...Object.values(SFX), ...Object.values(LOOPS)]) this.load(file);
    return ctx;
  }

  /** Baja y decodifica un sonido (una sola vez); `then` corre cuando está listo. */
  private load(file: string, then?: (buffer: AudioBuffer) => void): void {
    const ctx = this.context;
    const ready = this.buffers.get(file);
    if (ready) return then?.(ready);
    if (!ctx || this.loading.has(file)) return;
    this.loading.add(file);
    void fetch(soundUrl(file))
      .then((response) => response.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        this.buffers.set(file, buffer);
        then?.(buffer);
      })
      .catch(() => undefined)
      .finally(() => this.loading.delete(file));
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

  /** Efecto de sonido. Si el audio todavía no se habilitó (sin clic ni tecla) o el archivo no llegó, no suena. */
  sfx(id: SfxId, rate = 1, volume = 1): void {
    const ctx = this.context;
    const buffer = this.buffers.get(SFX[id]);
    if (!ctx || ctx.state !== 'running' || !this.sfxGain || !buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    if (volume === 1) source.connect(this.sfxGain);
    else {
      const gain = ctx.createGain();
      gain.gain.value = volume;
      source.connect(gain).connect(this.sfxGain);
    }
    source.start();
  }

  /** Ambiente del lugar (loop de fondo, bajo); null lo apaga. */
  ambience(id: AmbienceId | null): void {
    this.loop('ambience', id, AMBIENCE_GAIN);
  }

  /**
   * Loop en un canal (con fundido): cambiarlo reemplaza el anterior del mismo canal, null lo apaga y el mismo no
   * vuelve a empezar. Los canales suenan a la vez (ambiente, vuelo, clima…).
   */
  loop(channel: string, id: LoopId | null, volume = 0.7): void {
    const current = this.loops.get(channel);
    const ctx = this.context;
    if (current && current.id === id && (current.node || !id)) {
      // El mismo loop con otro volumen (p. ej. la tormenta al entrar a la base): se ajusta de a poco.
      if (current.node && ctx && current.volume !== volume) current.node.gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + LOOP_FADE_S);
      current.volume = volume;
      return;
    }
    const old = current?.node;
    if (old && ctx) {
      old.gain.gain.cancelScheduledValues(ctx.currentTime);
      old.gain.gain.setValueAtTime(old.gain.gain.value, ctx.currentTime);
      old.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + LOOP_FADE_S);
      old.source.stop(ctx.currentTime + LOOP_FADE_S + 0.05);
    }
    this.loops.set(channel, { id, volume, node: null });
    if (id) this.startLoop(channel, id, volume);
  }

  private startLoop(channel: string, id: LoopId, volume: number): void {
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running') return;
    this.load(LOOPS[id], (buffer) => {
      const wanted = this.loops.get(channel);
      if (!wanted || wanted.id !== id || wanted.node || !this.sfxGain) return;
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = buffer;
      source.loop = true;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + LOOP_FADE_S);
      source.connect(gain).connect(this.sfxGain);
      source.start();
      wanted.node = { source, gain };
    });
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
    if (!this.hatBuffer) {
      const samples = zzfxSamples([1, , 6000, , 0.005, 0.03, 4]);
      this.hatBuffer = ctx.createBuffer(1, samples.length, ZZFX_SAMPLE_RATE);
      this.hatBuffer.getChannelData(0).set(samples);
    }
    const buffer = this.hatBuffer;
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
