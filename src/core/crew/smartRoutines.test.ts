import { describe, expect, it } from 'vitest';
import { makeCrew } from '../../test-utils/factories';
import { ROLE_SPECIALTIES } from './efficiency';
import { isValidRoutine, smartRoutines } from './routines';

const TASKS = [
  { id: 'scrubber', category: 'scrubber' },
  { id: 'recycler', category: 'water' },
];

describe('rutinas automáticas según el perfil', () => {
  it('cada especialista cuida su sistema y la comandante cubre lo urgente', () => {
    const plan = smartRoutines(makeCrew(), TASKS, ROLE_SPECIALTIES);
    expect(plan.miga.taskId).toBe('scrubber');
    expect(plan.brote.taskId).toBe('recycler');
    expect(plan.vega.taskId).toBeNull();
    const urgent = smartRoutines(makeCrew(), [...TASKS, { id: 'airlock', category: 'leak2', urgent: true }], ROLE_SPECIALTIES);
    expect(urgent.vega.taskId).toBe('airlock');
  });

  it('el cansado duerme más, el débil hace más ejercicio y el desanimado llama más a casa', () => {
    const crew = makeCrew().map((m) => (m.id === 'senda' ? { ...m, fatigue: 0.8, condition: 0.5, morale: 0.4 } : m));
    const { senda, vega } = smartRoutines(crew, TASKS, ROLE_SPECIALTIES);
    expect(senda.sleepHours).toBeGreaterThan(vega.sleepHours);
    expect(senda.exerciseHours).toBeGreaterThan(vega.exerciseHours);
    expect(senda.callsHomePerDay).toBeGreaterThan(vega.callsHomePerDay);
  });

  it('en reposo sólo duerme, y todas las rutinas son posibles', () => {
    const crew = makeCrew().map((m) => (m.id === 'miga' ? { ...m, resting: true } : m));
    const plan = smartRoutines(crew, TASKS, ROLE_SPECIALTIES);
    expect(plan.miga).toMatchObject({ workHours: 0, taskId: null });
    for (const routine of Object.values(plan)) expect(isValidRoutine(routine)).toBe(true);
  });
});
