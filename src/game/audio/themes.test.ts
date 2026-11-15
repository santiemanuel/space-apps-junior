import { describe, expect, it } from 'vitest';
import { MUSIC, noteFrequency, SFX } from './themes';
import { ZZFX_SAMPLE_RATE, zzfxSamples } from './zzfx';

describe('sonido', () => {
  it('las notas tienen la frecuencia de la escala temperada (La 440)', () => {
    expect(noteFrequency('A4')).toBe(440);
    expect(noteFrequency('A5')).toBeCloseTo(880);
    expect(noteFrequency('C4')).toBeCloseTo(261.63, 1);
    expect(noteFrequency('-')).toBeNull();
  });

  it('cada tema tiene melodía y bajo del mismo largo, con notas válidas', () => {
    for (const [id, theme] of Object.entries(MUSIC)) {
      expect(theme.bass.length, id).toBe(theme.lead.length);
      for (const note of [...theme.lead, ...theme.bass]) expect(note === '-' || noteFrequency(note) !== null, `${id}: ${note}`).toBe(true);
      // Un tema que no se repite pasa a otro que sí: ninguna pantalla queda en silencio.
      if (!theme.loop) expect(theme.next && MUSIC[theme.next].loop, id).toBe(true);
    }
  });

  it('los efectos se generan sin azar (siempre igual), cortos y sin saturar', () => {
    for (const [id, params] of Object.entries(SFX)) {
      const a = zzfxSamples(params);
      expect(a.length, id).toBeGreaterThan(0);
      expect(a.length / ZZFX_SAMPLE_RATE, id).toBeLessThan(2.5);
      expect(Math.max(...a.map(Math.abs)), id).toBeLessThanOrEqual(1);
      expect(zzfxSamples(params)).toEqual(a);
    }
  });
});
