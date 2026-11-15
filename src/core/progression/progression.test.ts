import { describe, expect, it } from 'vitest';
import { emptyProgression, isUnlocked, recordMissionEnd, sanitizeSetup, unlockLevelFor } from './progression';

describe('progresión entre partidas', () => {
  it('la primera partida es nivel 1 y cada misión terminada suma un nivel hasta el 4', () => {
    expect([0, 1, 2, 3, 4, 10].map(unlockLevelFor)).toEqual([1, 2, 3, 4, 4, 4]);
  });

  it('valores raros (negativos o con decimales) no rompen el nivel', () => {
    expect(unlockLevelFor(-3)).toBe(1);
    expect(unlockLevelFor(1.9)).toBe(2);
  });

  it('empieza sin misiones ni logros', () => {
    expect(emptyProgression()).toEqual({ version: 1, completedMissions: 0, achievements: [] });
  });

  it('sigue la tabla de desbloqueos de §6', () => {
    expect(isUnlocked(1, 'mode', 'campaign2024')).toBe(true);
    expect(isUnlocked(1, 'length', 'short')).toBe(true);
    expect(isUnlocked(2, 'mode', 'free')).toBe(false);
    expect(isUnlocked(3, 'mode', 'free')).toBe(true);
    expect(isUnlocked(2, 'length', 'long')).toBe(false);
    expect(isUnlocked(3, 'length', 'long')).toBe(true);
    expect(isUnlocked(1, 'loadout', 'workshop')).toBe(false);
    expect(isUnlocked(2, 'loadout', 'workshop')).toBe(true);
    expect(isUnlocked(3, 'loadout', 'waterShield')).toBe(false);
    expect(isUnlocked(4, 'loadout', 'waterShield')).toBe(true);
  });

  it('cambia lo bloqueado por la opción básica y respeta el modo ayuda', () => {
    const setup = { mode: 'free', length: 'long', helpMode: true } as const;
    expect(sanitizeSetup(setup, 1)).toEqual({ mode: 'campaign2024', length: 'short', helpMode: true });
    expect(sanitizeSetup(setup, 3)).toEqual(setup);
  });
});

describe('fin de misión', () => {
  it('una misión completada suma una misión y junta los logros sin repetir', () => {
    const before = { ...emptyProgression(), completedMissions: 1, achievements: ['survivedX9'] };
    expect(recordMissionEnd(before, 'completed', ['survivedX9', 'shelterInTime'])).toEqual({
      version: 1,
      completedMissions: 2,
      achievements: ['survivedX9', 'shelterInTime'],
    });
  });

  it('una misión suspendida no sube de nivel pero guarda los logros', () => {
    expect(recordMissionEnd(emptyProgression(), 'suspended', ['likeOpportunity'])).toMatchObject({
      completedMissions: 0,
      achievements: ['likeOpportunity'],
    });
  });
});
