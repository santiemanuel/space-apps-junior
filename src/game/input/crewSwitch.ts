import type Phaser from 'phaser';
import type { CrewId } from '../../core/crew/types';
import type { EventBus } from '../../core/events/EventBus';
import type { GameEvents } from '../../core/events/GameEvents';

/** Siguiente tripulante en orden (Tab), salteando a los que están en reposo; vuelve al primero al final. */
export function nextCrewId(crew: readonly { id: CrewId; resting?: boolean }[], active: CrewId): CrewId {
  const start = crew.findIndex((m) => m.id === active);
  for (let step = 1; step <= crew.length; step++) {
    const candidate = crew[(start + step + crew.length) % crew.length]!;
    if (!candidate.resting) return candidate.id;
  }
  return active;
}

/**
 * Tab cambia de tripulante (§8): emite `crew:switched` y la escena de simulación mueve la cámara y el control.
 * `current` devuelve la tripulación y el activo en el momento de apretar.
 */
export function bindCrewSwitch(
  scene: Phaser.Scene,
  bus: EventBus<GameEvents>,
  current: () => { crew: readonly { id: CrewId; resting?: boolean }[]; activeCrewId: CrewId },
): void {
  const keyboard = scene.input.keyboard;
  if (!keyboard) return;
  keyboard.addCapture('TAB');
  const onTab = () => {
    const { crew, activeCrewId } = current();
    const crewId = nextCrewId(crew, activeCrewId);
    if (crewId !== activeCrewId) bus.emit('crew:switched', { crewId });
  };
  keyboard.on('keydown-TAB', onTab);
  scene.events.once('shutdown', () => keyboard.off('keydown-TAB', onTab));
}
