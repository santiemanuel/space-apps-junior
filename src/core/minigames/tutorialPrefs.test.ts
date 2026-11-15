import { describe, expect, it } from 'vitest';
import { MemorySaveStore } from '../save/SaveStore';
import { TutorialPrefs } from './tutorialPrefs';

describe('tutoriales de los minijuegos', () => {
  it('se muestran hasta que se marca «No volver a mostrar», y eso queda guardado', () => {
    const store = new MemorySaveStore();
    const prefs = new TutorialPrefs(store);
    expect(prefs.hidden('bike')).toBe(false);
    prefs.setHidden('bike', true);
    expect(prefs.hidden('bike')).toBe(true);
    expect(prefs.hidden('meal')).toBe(false);
    expect(new TutorialPrefs(store).hidden('bike')).toBe(true);
    prefs.setHidden('bike', false);
    expect(new TutorialPrefs(store).hidden('bike')).toBe(false);
  });

  it('un guardado roto no rompe nada: se vuelven a mostrar todos', () => {
    const store = new MemorySaveStore();
    store.write('misionMarte.tutorialesOcultos', '{roto');
    expect(new TutorialPrefs(store).hidden('bike')).toBe(false);
  });
});
