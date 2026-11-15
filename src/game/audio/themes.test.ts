import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LOOPS, MUSIC, MUSIC_TRACKS, musicUrl, SFX, soundUrl } from './themes';

describe('sonido', () => {
  it('cada pista de música tiene su archivo y su punto de loop dentro de la pista', () => {
    for (const [id, track] of Object.entries(MUSIC)) {
      expect(existsSync(`public/${musicUrl(track.file)}`), id).toBe(true);
      const { duration, loopAt, loopFade } = MUSIC_TRACKS[track.file];
      expect(loopAt + loopFade, id).toBeLessThanOrEqual(duration);
      expect(loopAt, id).toBeGreaterThan(duration / 2);
      expect(track.fadeIn, id).toBeGreaterThan(0);
      // Nada por encima del máster: la mezcla sólo baja pistas.
      expect(track.gainDb, id).toBeLessThanOrEqual(0);
    }
  });

  it('todas las pistas masterizadas suenan parejo (±1 LU)', () => {
    const levels = Object.values(MUSIC_TRACKS).map((track) => track.lufs);
    expect(Math.max(...levels) - Math.min(...levels)).toBeLessThanOrEqual(1);
  });

  it('cada efecto y cada ambiente tiene su archivo en public/', () => {
    for (const file of [...Object.values(SFX), ...Object.values(LOOPS)]) expect(existsSync(`public/${soundUrl(file)}`), file).toBe(true);
  });
});
