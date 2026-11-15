import { LOOPS, MUSIC, MUSIC_DUCK, MUSIC_TRACKS, musicUrl, SFX, soundUrl, type AmbienceId, type LoopId, type MusicId, type SfxId } from './themes';

/** Volumen del ambiente respecto de los efectos, y el fundido de los loops (s). */
const AMBIENCE_GAIN = 0.35;
const LOOP_FADE_S = 0.6;
/** Cambio de pista: cuánto tarda en irse la que suena y cuánto espera la nueva (se cruzan un poco). */
const MUSIC_FADE_OUT_S = 1.8;
const MUSIC_ENTRY_DELAY_S = 0.4;
/** Cada cuánto se revisa si una pista llegó a su punto de loop (ms). */
const LOOP_TICK_MS = 100;
/** Pausa y tarjetas: la música y los ambientes se oyen apagados, como detrás de un vidrio. */
const MUFFLE = { frequency: 900, gainDb: -7, open: 20000, timeConstant: 0.12 } as const;
/** Bajada de la música bajo un efecto importante: ataque y vuelta (constantes de tiempo, s). */
const DUCK = { attack: 0.03, release: 0.25 } as const;
/** Rampa de los volúmenes de los ajustes y del silencio (constante de tiempo, s): sin chasquidos. */
const VOLUME_TIME_CONSTANT = 0.02;

const dbToGain = (db: number) => 10 ** (db / 20);

/** Una pista que suena (o está por sonar): un `<audio>` que se transmite de a poco, con su propio volumen. */
interface MusicVoice {
  id: MusicId;
  el: HTMLAudioElement;
  source: MediaElementAudioSourceNode;
  gain: GainNode;
  /** Ya arrancó y entró con su fundido. */
  started: boolean;
  /** Ya lanzó la vuelta a empezar. */
  looped: boolean;
  /** Se está yendo (cambio de pista o loop). */
  ending: boolean;
  startTimer: number;
}

/**
 * Audio del juego sobre Web Audio. Efectos y ambientes en MP3 (se bajan y decodifican al habilitarse el audio);
 * la banda sonora en MP3 masterizados que se transmiten con `<audio>` (no se decodifican enteros: son pistas de
 * varios minutos). Cadena:
 *
 *   pistas → bajada (duck) → filtro de pausa → volumen de música ┐
 *   loops  → filtro de pausa → volumen de sonidos ────────────────┼→ limitador → salida
 *   efectos → volumen de sonidos ─────────────────────────────────┘
 *
 * Las pistas entran y salen con fundidos de igual potencia, se repiten cruzándose con su propio comienzo (punto
 * de loop medido en `musicTracks.json`), se apagan bajo los efectos importantes (`MUSIC_DUCK`) y se oyen
 * filtradas mientras está abierta la pausa. Si la pestaña queda oculta, todo se detiene y sigue al volver.
 * El navegador no deja sonar nada hasta el primer clic o tecla: el contexto se crea y se reanuda entonces.
 */
class GameAudio {
  private context: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private duckGain: GainNode | null = null;
  private musicFilter: BiquadFilterNode | null = null;
  private musicFocus: GainNode | null = null;
  private loopFilter: BiquadFilterNode | null = null;
  /** Sonidos ya decodificados, por archivo. */
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly loading = new Set<string>();
  /** Loops por canal (ambiente, vuelo, clima…): el pedido y lo que suena. */
  private readonly loops = new Map<string, { id: LoopId | null; volume: number; node: { source: AudioBufferSourceNode; gain: GainNode } | null }>();
  private volumes = { sound: 0.8, music: 0.6 };
  private muted = false;
  private muffled = false;
  private theme: MusicId | null = null;
  private voices: MusicVoice[] = [];
  private loopTimer = 0;
  private duck = { level: 1, until: 0 };

  constructor() {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      const ctx = this.ensure();
      if (!ctx || document.hidden) return;
      if (ctx.state === 'suspended') void ctx.resume().then(() => this.wake());
      else this.wake();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', () => {
      const ctx = this.context;
      if (!ctx) return;
      if (document.hidden) {
        for (const voice of this.voices) voice.el.pause();
        void ctx.suspend();
      } else void ctx.resume().then(() => this.wake());
    });
  }

  /** Arranca lo pedido antes de que hubiera audio (o mientras la pestaña estaba oculta). */
  private wake(): void {
    if (this.context?.state !== 'running') return;
    if (this.theme && !this.currentVoice()) this.startVoice(this.theme, MUSIC[this.theme].delay ?? 0, MUSIC[this.theme].fadeIn);
    for (const voice of this.voices) if (!voice.ending && voice.el.paused && !voice.startTimer) this.playVoice(voice);
    for (const [channel, loop] of this.loops) if (loop.id && !loop.node) this.startLoop(channel, loop.id, loop.volume);
  }

  private ensure(): AudioContext | null {
    if (this.context) return this.context;
    const Ctor = typeof window !== 'undefined' ? window.AudioContext : undefined;
    if (!Ctor) return null;
    const ctx = new Ctor();
    this.context = ctx;
    // Limitador de seguridad: sólo actúa si la suma de música, ambientes y efectos pasa de −3 dBFS.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    limiter.connect(ctx.destination);
    this.sfxGain = ctx.createGain();
    this.sfxGain.connect(limiter);
    this.musicGain = ctx.createGain();
    this.musicGain.connect(limiter);
    this.musicFocus = ctx.createGain();
    this.musicFocus.connect(this.musicGain);
    this.musicFilter = this.lowpass(ctx);
    this.musicFilter.connect(this.musicFocus);
    this.duckGain = ctx.createGain();
    this.duckGain.connect(this.musicFilter);
    this.loopFilter = this.lowpass(ctx);
    this.loopFilter.connect(this.sfxGain);
    this.applyVolumes();
    this.applyMuffle();
    for (const file of [...Object.values(SFX), ...Object.values(LOOPS)]) this.load(file);
    return ctx;
  }

  private lowpass(ctx: AudioContext): BiquadFilterNode {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = MUFFLE.open;
    filter.Q.value = 0.5;
    return filter;
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
    const ctx = this.context;
    if (!ctx) return;
    const factor = this.muted ? 0 : 1;
    this.sfxGain?.gain.setTargetAtTime(this.volumes.sound * factor, ctx.currentTime, VOLUME_TIME_CONSTANT);
    this.musicGain?.gain.setTargetAtTime(this.volumes.music * factor, ctx.currentTime, VOLUME_TIME_CONSTANT);
  }

  private applyMuffle(): void {
    const ctx = this.context;
    if (!ctx) return;
    const frequency = this.muffled ? MUFFLE.frequency : MUFFLE.open;
    for (const filter of [this.musicFilter, this.loopFilter]) filter?.frequency.setTargetAtTime(frequency, ctx.currentTime, MUFFLE.timeConstant);
    this.musicFocus?.gain.setTargetAtTime(this.muffled ? dbToGain(MUFFLE.gainDb) : 1, ctx.currentTime, MUFFLE.timeConstant);
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

  /** Pausa y tarjetas: la música y los ambientes se oyen apagados (los efectos de la interfaz siguen claros). */
  muffle(on: boolean): void {
    this.muffled = on;
    this.applyMuffle();
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
    const duck = MUSIC_DUCK[id];
    if (duck !== undefined) this.duckMusic(duck, buffer.duration / rate);
  }

  /** Baja la música `db` durante `seconds` y la devuelve de a poco; si se superponen, manda la más profunda. */
  private duckMusic(db: number, seconds: number): void {
    const ctx = this.context;
    const param = this.duckGain?.gain;
    if (!ctx || !param) return;
    const now = ctx.currentTime;
    const active = now < this.duck.until;
    this.duck = { level: Math.min(dbToGain(db), active ? this.duck.level : 1), until: Math.max(active ? this.duck.until : 0, now + seconds) };
    const current = param.value;
    param.cancelScheduledValues(now);
    param.setValueAtTime(current, now);
    param.setTargetAtTime(this.duck.level, now, DUCK.attack);
    param.setTargetAtTime(1, this.duck.until, DUCK.release);
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
      if (!wanted || wanted.id !== id || wanted.node || !this.loopFilter) return;
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = buffer;
      source.loop = true;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + LOOP_FADE_S);
      source.connect(gain).connect(this.loopFilter);
      source.start();
      wanted.node = { source, gain };
    });
  }

  /**
   * Cambia la música: la que suena se va con un fundido y la nueva entra con el suyo (se cruzan un poco); null la
   * apaga. La misma pista no vuelve a empezar.
   */
  music(id: MusicId | null): void {
    if (id === this.theme && (this.currentVoice() || this.context?.state !== 'running')) return;
    this.theme = id;
    const replacing = this.voices.some((voice) => !voice.ending && voice.started);
    for (const voice of [...this.voices]) this.fadeOutVoice(voice, MUSIC_FADE_OUT_S);
    if (!id || this.context?.state !== 'running') return;
    const track = MUSIC[id];
    this.startVoice(id, track.delay ?? (replacing ? MUSIC_ENTRY_DELAY_S : 0), track.fadeIn);
  }

  private currentVoice(): MusicVoice | undefined {
    return this.voices.find((voice) => !voice.ending);
  }

  private startVoice(id: MusicId, delay: number, fadeIn: number): void {
    const ctx = this.context;
    if (!ctx || !this.duckGain) return;
    const track = MUSIC[id];
    const el = new Audio(musicUrl(track.file));
    el.preload = 'auto';
    const source = ctx.createMediaElementSource(el);
    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(gain).connect(this.duckGain);
    const voice: MusicVoice = { id, el, source, gain, started: false, looped: false, ending: false, startTimer: 0 };
    // El fundido empieza cuando de verdad suena (la pista se transmite: puede tardar en llegar).
    el.addEventListener('playing', () => {
      if (voice.started || voice.ending) return;
      voice.started = true;
      this.fade(gain.gain, 0, dbToGain(track.gainDb), fadeIn);
    });
    // Por si se llegó al final sin pasar por el punto de loop (pestaña frenada, por ejemplo).
    el.addEventListener('ended', () => {
      if (!voice.ending && !voice.looped && this.theme === id) this.startVoice(id, 0, 0.05);
      this.disposeVoice(voice);
    });
    this.voices.push(voice);
    if (delay > 0) voice.startTimer = window.setTimeout(() => this.playVoice(voice), delay * 1000);
    else this.playVoice(voice);
    if (!this.loopTimer) this.loopTimer = window.setInterval(() => this.checkLoops(), LOOP_TICK_MS);
  }

  private playVoice(voice: MusicVoice): void {
    voice.startTimer = 0;
    if (voice.ending || document.hidden) return;
    // Si el navegador todavía no deja (iOS), sigue en el próximo clic o tecla (`wake`).
    voice.el.play().catch(() => undefined);
  }

  /** Al llegar al punto de loop, la pista vuelve a empezar cruzándose con su propio final. */
  private checkLoops(): void {
    for (const voice of [...this.voices]) {
      if (voice.ending || voice.looped || !voice.started) continue;
      const { loopAt, loopFade } = MUSIC_TRACKS[MUSIC[voice.id].file];
      if (voice.el.currentTime < loopAt) continue;
      voice.looped = true;
      this.startVoice(voice.id, 0, loopFade);
      this.fadeOutVoice(voice, loopFade);
    }
    if (!this.voices.length) {
      window.clearInterval(this.loopTimer);
      this.loopTimer = 0;
    }
  }

  private fadeOutVoice(voice: MusicVoice, seconds: number): void {
    if (voice.ending) return;
    voice.ending = true;
    window.clearTimeout(voice.startTimer);
    const ctx = this.context;
    if (!ctx || !voice.started) return this.disposeVoice(voice);
    this.fade(voice.gain.gain, voice.gain.gain.value, 0, seconds);
    window.setTimeout(() => this.disposeVoice(voice), (seconds + 0.15) * 1000);
  }

  private disposeVoice(voice: MusicVoice): void {
    const index = this.voices.indexOf(voice);
    if (index < 0) return;
    this.voices.splice(index, 1);
    voice.ending = true;
    window.clearTimeout(voice.startTimer);
    voice.el.pause();
    voice.source.disconnect();
    voice.gain.disconnect();
    voice.el.removeAttribute('src');
    voice.el.load();
  }

  /** Fundido de igual potencia (seno al entrar, coseno al salir): el volumen percibido no se hunde en el cruce. */
  private fade(param: AudioParam, from: number, to: number, seconds: number): void {
    const ctx = this.context!;
    const now = ctx.currentTime;
    const steps = 64;
    const curve = new Float32Array(steps);
    for (let i = 0; i < steps; i++) {
      const x = (i / (steps - 1)) * (Math.PI / 2);
      curve[i] = to > from ? from + (to - from) * Math.sin(x) : to + (from - to) * Math.cos(x);
    }
    // Se descarta todo lo programado antes (también un fundido a medias): la curva nueva parte del valor de ahora.
    param.cancelScheduledValues(0);
    try {
      param.setValueCurveAtTime(curve, now, Math.max(0.02, seconds));
    } catch {
      param.setValueAtTime(from, now);
      param.linearRampToValueAtTime(to, now + seconds);
    }
  }
}

/** Audio del juego (uno solo para toda la partida). */
export const audio = new GameAudio();
