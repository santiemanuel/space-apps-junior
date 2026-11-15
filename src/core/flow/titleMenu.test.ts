import { describe, expect, it } from 'vitest';
import { TitleMenu, type TitleMenuOptions } from './titleMenu';

const menu = (over: Partial<TitleMenuOptions> = {}) =>
  new TitleMenu({ hasSave: false, unlockLevel: 1, locales: ['es', 'en'], locale: 'es', ...over });

describe('menú principal', () => {
  it('sólo ofrece continuar si hay una misión guardada, y en ese caso va primero', () => {
    expect(menu().rows).toEqual(['newGame', 'mode', 'length', 'helpMode', 'settings']);
    expect(menu({ hasSave: true }).rows[0]).toBe('continue');
    expect(menu({ hasSave: true }).current).toBe('continue');
  });

  it('el cursor da la vuelta por arriba y por abajo', () => {
    const m = menu();
    m.move(-1);
    expect(m.current).toBe('settings');
    m.move(1);
    expect(m.current).toBe('newGame');
  });

  it('empieza con la campaña 2024 corta y sin modo ayuda', () => {
    expect(menu().setup).toEqual({ mode: 'campaign2024', length: 'short', helpMode: false });
  });

  it('en el nivel 1 no deja elegir el modo libre ni la misión larga', () => {
    const m = menu();
    m.select(m.rows.indexOf('mode'));
    m.change(1);
    m.select(m.rows.indexOf('length'));
    m.change(1);
    expect(m.setup).toMatchObject({ mode: 'campaign2024', length: 'short' });
    expect(m.lockedOptions('mode')).toEqual([{ option: 'free', level: 3 }]);
    expect(m.lockedOptions('length')).toEqual([{ option: 'long', level: 3 }]);
  });

  it('desde el nivel 3 se pueden elegir y ya no aparecen bloqueadas', () => {
    const m = menu({ unlockLevel: 3 });
    m.select(m.rows.indexOf('mode'));
    m.change(1);
    m.select(m.rows.indexOf('length'));
    m.change(-1);
    expect(m.setup).toMatchObject({ mode: 'free', length: 'long' });
    expect(m.lockedOptions('mode')).toEqual([]);
    expect(m.lockedOptions('length')).toEqual([]);
  });

  it('el modo ayuda se prende y se apaga, también con Enter o clic', () => {
    const m = menu();
    m.select(m.rows.indexOf('helpMode'));
    m.change(1);
    expect(m.setup.helpMode).toBe(true);
    expect(m.activate()).toBeNull();
    expect(m.setup.helpMode).toBe(false);
  });

  it('el idioma va dentro de Opciones (no tiene fila propia)', () => {
    expect(menu().rows).not.toContain('language');
  });

  it('sin misión guardada, "nueva misión" empieza enseguida', () => {
    expect(menu().activate()).toBe('newGame');
  });

  it('con misión guardada, "nueva misión" pide confirmar antes de reemplazarla', () => {
    const m = menu({ hasSave: true });
    expect(m.activate()).toBe('continue');
    m.move(1);
    expect(m.activate()).toBeNull();
    expect(m.confirmingNewGame).toBe(true);
    expect(m.activate()).toBe('newGame');
  });

  it('moverse a otra fila cancela la confirmación', () => {
    const m = menu({ hasSave: true });
    m.move(1);
    m.activate();
    m.move(1);
    m.move(-1);
    expect(m.confirmingNewGame).toBe(false);
    expect(m.activate()).toBeNull();
  });
});

describe('menú principal: ajustes', () => {
  it('la fila de ajustes abre el panel de sonido, música e idioma', () => {
    const m = new TitleMenu({ hasSave: false, unlockLevel: 1, locales: ['es', 'en'], locale: 'es' });
    m.select(m.rows.indexOf('settings'));
    expect(m.activate()).toBe('settings');
  });
});
