import type Phaser from 'phaser';

/**
 * Atlas de íconos del tablero y del mapa (`public/assets/hud/icons`, de `scripts/art/icons.py`): medidores, salud,
 * cuartos y avisos. Viene a resolución de arte: en el tablero se muestra ×1 y en el mapa ×2 (como el resto del mapa).
 */
export const HUD_ICONS = 'hud-icons';
/** Lado de la celda de cada ícono (px de arte). */
export const ICON_CELL = 24;

export function preloadHudIcons(scene: Phaser.Scene): void {
  if (!scene.textures.exists(HUD_ICONS)) scene.load.atlas(HUD_ICONS, 'assets/hud/icons.png', 'assets/hud/icons.json');
}

/** Ícono del motivo de lentitud de un tripulante (`hud.crewSlow.<motivo>`), para su globo sobre el mapa. */
export const SLOW_REASON_ICON: Record<string, string> = {
  'hud.crewSlow.fatigue': 'fatigue',
  'hud.crewSlow.resting': 'fatigue',
  'hud.crewSlow.condition': 'condition',
  'hud.crewSlow.co2': 'co2',
  'hud.crewSlow.morale': 'morale',
};
