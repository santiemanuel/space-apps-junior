import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LOOPS, MUSIC, noteFrequency, SFX, soundUrl } from './themes';

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

  it('cada efecto y cada ambiente tiene su archivo en public/', () => {
    for (const file of [...Object.values(SFX), ...Object.values(LOOPS)]) expect(existsSync(`public/${soundUrl(file)}`), file).toBe(true);
  });
});
