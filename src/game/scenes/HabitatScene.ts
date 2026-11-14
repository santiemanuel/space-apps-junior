import Phaser from 'phaser';
import { HABITAT_SIZE, PLAYER_SPAWN, STATIONS, TILE_SIZE } from '../../content/habitat';
import type { GameSession } from '../../core/session/GameSession';
import { Player } from '../entities/Player';
import { StationView } from '../entities/StationView';
import { createKeyboardControls } from '../input/PlayerControls';
import { SceneKeys } from '../sceneKeys';
import type { SessionSceneData } from '../services';
import { TextureKeys } from '../textures';

/** Mundo top-down: mapa del hábitat, jugador y estaciones. Delega las reglas en GameSession. */
export class HabitatScene extends Phaser.Scene {
  private session!: GameSession;
  private player!: Player;
  private stations: StationView[] = [];

  constructor() {
    super(SceneKeys.Habitat);
  }

  init({ session }: SessionSceneData): void {
    this.session = session;
    this.stations = [];
  }

  create(): void {
    const walls = this.physics.add.staticGroup();
    for (let row = 0; row < HABITAT_SIZE.rows; row++) {
      for (let col = 0; col < HABITAT_SIZE.cols; col++) {
        const x = (col + 0.5) * TILE_SIZE;
        const y = (row + 0.5) * TILE_SIZE;
        const isWall = row === 0 || col === 0 || row === HABITAT_SIZE.rows - 1 || col === HABITAT_SIZE.cols - 1;
        if (isWall) walls.create(x, y, TextureKeys.Wall);
        else this.add.image(x, y, TextureKeys.Floor);
      }
    }

    this.stations = STATIONS.map((layout) => new StationView(this, layout));
    this.player = new Player(
      this,
      (PLAYER_SPAWN.col + 0.5) * TILE_SIZE,
      (PLAYER_SPAWN.row + 0.5) * TILE_SIZE,
      createKeyboardControls(this),
    );
    this.physics.add.collider(this.player, walls);
  }

  update(_time: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    this.session.update(dt);
    this.player.move(this.session.paused);

    const nearby = this.stations.find((station) => this.physics.overlap(this.player, station.zone));
    if (nearby && this.player.interacting) this.session.interact(nearby.layout.id, dt);

    for (const station of this.stations) {
      const mission = this.session.missions.all.find((m) => m.definition.stationId === station.layout.id);
      station.render(mission, mission ? this.session.isPostponed(mission.definition.id) : false);
    }
  }
}
