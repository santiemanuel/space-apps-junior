import Phaser from 'phaser';
import { createGameConfig } from './game/config';

/** Raíz de composición: `BootScene` carga los recursos y arranca el flujo de misión (`FlowDirector`). */
new Phaser.Game(createGameConfig('game'));
