import { describe, expect, it } from 'vitest';
import { MINIGAME_IDS } from '../../../../core/minigames/catalog';
import { hasKey, LOCALES } from '../../../../i18n';
import { TUTORIALS } from './tutorials';

describe('mini tutoriales de los minijuegos', () => {
  it('cada minijuego tiene de 2 a 4 pasos con algo para mirar (ícono, signo, medidor o teclas)', () => {
    for (const id of MINIGAME_IDS) {
      const steps = TUTORIALS[id];
      expect(steps.length, id).toBeGreaterThanOrEqual(2);
      expect(steps.length, id).toBeLessThanOrEqual(4);
      for (const step of steps) expect(step.icons?.length || step.glyph || step.gauge || step.keys?.length, id).toBeTruthy();
    }
  });

  it('cada paso y cada objetivo tienen su frase en todos los idiomas', () => {
    const keys = MINIGAME_IDS.flatMap((id) => [...TUTORIALS[id].map((_, i) => `hud.minigame.${id}.tutorial.${i + 1}`), `hud.minigame.${id}.tutorial.goal`]);
    for (const locale of LOCALES) expect(keys.filter((key) => !hasKey(key, locale)), locale).toEqual([]);
  });
});
