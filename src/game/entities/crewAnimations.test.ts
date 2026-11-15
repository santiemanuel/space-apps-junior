import { describe, expect, it } from 'vitest';
import { makeCrew } from '../../test-utils/factories';
import { CREW_SHEET } from '../assets';
import { nextCrewId } from '../input/crewSwitch';
import { animFrames, CREW_DIRECTIONS, crewAnimKey, directionFor, walkTimeScale, WALK_REFERENCE_SPEED } from './crewAnimations';

describe('animaciones de la tripulación', () => {
  it('cada dirección usa su fila: 3 cuadros de reposo y 6 de caminata', () => {
    expect(animFrames('idle', 'down')).toEqual([0, 1, 2]);
    expect(animFrames('walk', 'down')).toEqual([3, 4, 5, 6, 7, 8]);
    expect(animFrames('idle', 'up')).toEqual([9, 10, 11]);
    expect(animFrames('walk', 'right')).toEqual([30, 31, 32, 33, 34, 35]);
    const all = CREW_DIRECTIONS.flatMap((d) => [...animFrames('idle', d), ...animFrames('walk', d)]);
    expect(new Set(all).size).toBe(CREW_SHEET.columns * CREW_SHEET.rows);
  });

  it('mira hacia donde se mueve y quieto conserva la dirección', () => {
    expect(directionFor(-100, 20, 'down')).toBe('left');
    expect(directionFor(100, -20, 'down')).toBe('right');
    expect(directionFor(10, -100, 'down')).toBe('up');
    expect(directionFor(0, 100, 'up')).toBe('down');
    expect(directionFor(0, 0, 'left')).toBe('left');
  });

  it('camina más lento cuando la escena lo mueve más lento (eficiencia)', () => {
    expect(walkTimeScale(WALK_REFERENCE_SPEED)).toBe(1);
    expect(walkTimeScale(WALK_REFERENCE_SPEED / 2)).toBe(0.5);
    expect(walkTimeScale(1)).toBe(0.4);
    expect(walkTimeScale(1000)).toBe(1.6);
  });

  it('las claves de animación no se repiten entre tripulantes', () => {
    expect(crewAnimKey('vega', 'walk', 'left')).not.toBe(crewAnimKey('miga', 'walk', 'left'));
  });
});

describe('Tab: cambio de tripulante', () => {
  it('pasa al siguiente y vuelve al primero', () => {
    const crew = makeCrew();
    expect(nextCrewId(crew, 'vega')).toBe('miga');
    expect(nextCrewId(crew, 'senda')).toBe('vega');
  });

  it('saltea a los que están en reposo en la enfermería', () => {
    const crew = makeCrew().map((m) => ({ ...m, resting: m.id === 'miga' }));
    expect(nextCrewId(crew, 'vega')).toBe('brote');
  });

  it('si todos los demás descansan, sigue con el mismo', () => {
    const crew = makeCrew().map((m) => ({ ...m, resting: m.id !== 'vega' }));
    expect(nextCrewId(crew, 'vega')).toBe('vega');
  });
});
