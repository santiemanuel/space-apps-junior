import Phaser from 'phaser';
import type { Point } from '../../../core/habitat/layout';
import { propsFromTiled, wallTilesFromTiled, type TiledMap } from '../../../content/tiledLayout';

/** Recursos de un mapa de Tiled: el JSON (el mismo del que salen las reglas), su tileset y el atlas de objetos. */
export interface MapAssets {
  /** Prefijo de las claves de textura (`<key>-tiles`, `<key>-props`). */
  key: string;
  map: TiledMap;
  /** Nombre del tileset dentro del mapa de Tiled. */
  tilesetName: string;
  tilesUrl: string;
  propsUrl: string;
  propsAtlasUrl: string;
  /** Índices del tileset: hojas izquierda y derecha de las puertas corredizas. */
  doorPanels: { left: number; right: number };
  /** Índices del tileset que son frentes de pared con una franja de luz. */
  lightTiles: readonly number[];
  /** Tileset y atlas tienen normal map (`<nombre>_n.png`, de `scripts/art/normals.py`): el mapa recibe luz dinámica. */
  normals: boolean;
}

/** URL del normal map de un recurso: `tiles.png` → `tiles_n.png`. */
export const normalUrl = (url: string): string => url.replace(/\.png$/, '_n.png');

/** Lo que choca: paredes y objetos. */
export type Solid = Phaser.Types.Physics.Arcade.ArcadeColliderType;

/**
 * Profundidades del mapa: piso, paredes, bordes, puertas, lo que se ve por las ventanas, adornos de pared, lo que
 * se ordena por su pie (objetos y tripulación), la oscuridad de un corte de energía y las luces.
 */
export const MapDepth = { floor: 0, floorDecal: 0.5, walls: 1, rims: 1.1, doors: 1.2, behindDecor: 1.9, decor: 2, sorted: 10, darkness: 29, lights: 30 } as const;
/** Profundidad de algo apoyado en `y` (px): lo de más abajo tapa a lo de más arriba. */
export const depthAt = (y: number): number => MapDepth.sorted + y / 10000;

/** Rectángulo (px, relativo al sprite) del vidrio de una ventana: lo anota `scripts/art/atlas.py`. */
export interface Glass {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Objeto apoyado en el piso: `x` es su centro y `bottom` el borde de abajo de su caja de colisión. */
export interface PlacedProp {
  key: string;
  x: number;
  bottom: number;
  image: Phaser.GameObjects.Image;
}

/** Fuente de luz del mapa: franja de luz en un frente de pared o lámpara de pie. */
export interface MapLight {
  x: number;
  y: number;
  kind: 'strip' | 'lamp';
}

/** Adorno colgado de la pared (ventana, alarma, monitores): `x` es su centro y `bottom` su borde de abajo. */
export interface WallItem {
  key: string;
  x: number;
  bottom: number;
  image: Phaser.GameObjects.Image;
  glass?: Glass;
}

export interface MapView {
  /** El mapa recibe luz dinámica (tiene normal maps). */
  lit: boolean;
  /** Tamaño del mapa (px) y clave del atlas de objetos. */
  width: number;
  height: number;
  propsKey: string;
  solids: Solid[];
  props: PlacedProp[];
  decor: WallItem[];
  /** Centro de cada franja de luz de pared y de cada lámpara (px). */
  lights: MapLight[];
  /** Tiles de frente de pared y de piso transitable (col, fila), para repartir adornos. */
  faceTiles: Point[];
  floorTiles: Point[];
  /** Abre las puertas a las que se acerca alguien (`feet`: pies de la tripulación, px). */
  update(feet: readonly Point[], dt: number): void;
}

/** Alto (px) de la franja de luz dentro del tile de frente de pared. */
const LIGHT_STRIP_Y = 25;
/** Distancia (px) desde el centro de una puerta a la que se abre, y lo que tarda en abrirse (s). */
const DOOR_REACH = { x: 72, y: 84 } as const;
const DOOR_OPEN_S = 0.22;
/** Colores del borde de los techos de pared: contorno oscuro y luz (de la paleta del tileset). */
const RIM = { outline: 0x1e162d, light: 0x63537f } as const;

export function preloadMap(scene: Phaser.Scene, assets: MapAssets): void {
  if (!assets.normals) {
    scene.load.image(`${assets.key}-tiles`, assets.tilesUrl);
    scene.load.atlas(`${assets.key}-props`, assets.propsUrl, assets.propsAtlasUrl);
    return;
  }
  scene.load.image(`${assets.key}-tiles`, [assets.tilesUrl, normalUrl(assets.tilesUrl)]);
  scene.load.atlas({ key: `${assets.key}-props`, textureURL: assets.propsUrl, atlasURL: assets.propsAtlasUrl, normalMap: normalUrl(assets.propsUrl) });
}

/** Puerta corrediza de dos hojas: cada hoja se esconde en su marco recortando lo que entra en la pared. */
interface Door {
  cx: number;
  cy: number;
  x: number;
  left: Phaser.GameObjects.Image;
  right: Phaser.GameObjects.Image;
  open: number;
}

/**
 * Pinta el mapa: el piso, que llena todo el mapa, va en GPU (`TilemapGPULayer`: una sola pasada, sin costo por
 * tile); las paredes, en una capa común, porque en Phaser 4.2 la capa GPU tiñe los tiles vacíos y además es la
 * que choca. Los objetos son imágenes de un atlas ordenadas por su pie. Todo redondea sus vértices a píxeles de
 * pantalla: con el zoom de 1,5 cada píxel de arte mide siempre 3 px.
 */
export function createMap(scene: Phaser.Scene, assets: MapAssets): MapView {
  const cacheKey = `${assets.key}-map`;
  const tilesKey = `${assets.key}-tiles`;
  const propsKey = `${assets.key}-props`;
  // El parser de Phaser modifica los datos: se le da una copia para no tocar el mapa que usan las reglas.
  if (!scene.cache.tilemap.exists(cacheKey)) {
    scene.cache.tilemap.add(cacheKey, { format: Phaser.Tilemaps.Formats.TILED_JSON, data: JSON.parse(JSON.stringify(assets.map)) });
  }
  const map = scene.make.tilemap({ key: cacheKey });
  const tileset = map.addTilesetImage(assets.tilesetName, tilesKey);
  if (!tileset) throw new Error(`El mapa ${assets.key} no tiene el tileset ${assets.tilesetName}`);
  const T = map.tileWidth;
  map.createLayer('piso', tileset, 0, 0, true)!.setDepth(MapDepth.floor).setVertexRoundMode('full');
  const walls = map.createLayer('paredes', tileset, 0, 0, false)!.setDepth(MapDepth.walls).setVertexRoundMode('full');
  walls.setCollisionByExclusion([-1]);

  const blocks = scene.physics.add.staticGroup();
  const props: PlacedProp[] = propsFromTiled(assets.map).map((prop) => {
    const x = prop.x + prop.width / 2;
    const bottom = prop.y + prop.height;
    const image = scene.add.image(x, bottom, propsKey, prop.key).setOrigin(0.5, 1).setDepth(depthAt(bottom)).setVertexRoundMode('full');
    const block = scene.add.zone(x, prop.y + prop.height / 2, prop.width, prop.height);
    scene.physics.add.existing(block, true);
    blocks.add(block);
    return { key: prop.key, x, bottom, image };
  });
  const atlas = scene.textures.get(propsKey);
  const decor: WallItem[] = (assets.map.layers.find((l) => l.name === 'decorado')?.objects ?? []).map((o) => {
    const image = scene.add.image(o.x, o.y, propsKey, o.type).setOrigin(0.5, 1).setDepth(MapDepth.decor).setVertexRoundMode('full');
    const glass = (atlas.get(o.type).customData as { glass?: Glass }).glass;
    return { key: o.type, x: o.x, bottom: o.y, image, ...(glass ? { glass } : {}) };
  });

  const wall = wallTilesFromTiled(assets.map);
  const isWall = (col: number, row: number) => wall[row]?.[col] ?? true;
  const faceTiles: Point[] = [];
  const floorTiles: Point[] = [];
  const lights: MapLight[] = [];
  const wallData = assets.map.layers.find((l) => l.name === 'paredes')?.data ?? [];
  const rims = scene.add.graphics().setDepth(MapDepth.rims);
  for (let row = 0; row < map.height; row++) {
    for (let col = 0; col < map.width; col++) {
      if (!isWall(col, row)) {
        floorTiles.push({ x: col, y: row });
        continue;
      }
      if (!isWall(col, row + 1)) {
        faceTiles.push({ x: col, y: row });
        if (assets.lightTiles.includes((wallData[row * map.width + col] ?? 0) - 1)) lights.push({ x: col * T + T / 2, y: row * T + LIGHT_STRIP_Y, kind: 'strip' });
        continue;
      }
      // Techo de pared junto al piso: contorno oscuro y una línea de luz, de un píxel de arte (2 px) cada uno.
      const x = col * T;
      const y = row * T;
      if (!isWall(col - 1, row)) rims.fillStyle(RIM.outline).fillRect(x, y, 2, T).fillStyle(RIM.light).fillRect(x + 2, y, 2, T);
      if (!isWall(col + 1, row)) rims.fillStyle(RIM.outline).fillRect(x + T - 2, y, 2, T).fillStyle(RIM.light).fillRect(x + T - 4, y, 2, T);
    }
  }
  for (const p of props) if (p.key === 'lamp') lights.push({ x: p.x, y: p.bottom - p.image.height + 14, kind: 'lamp' });

  // Puertas: las hojas son tiles del tileset, que se agregan como cuadros de su textura.
  const texture = scene.textures.get(tilesKey);
  const columns = Math.floor(texture.getSourceImage().width / T);
  const frameOf = (index: number) => {
    const name = `tile-${index}`;
    if (!texture.has(name)) texture.add(name, 0, (index % columns) * T, Math.floor(index / columns) * T, T, T);
    return name;
  };
  const doors: Door[] = (assets.map.layers.find((l) => l.name === 'zonas')?.objects ?? [])
    .filter((o) => o.type === 'door' && o.name !== 'exterior')
    .map((o) => ({
      cx: o.x + o.width / 2,
      cy: o.y + o.height / 2,
      x: o.x,
      left: scene.add.image(o.x, o.y, tilesKey, frameOf(assets.doorPanels.left)).setOrigin(0, 0).setDepth(MapDepth.doors).setVertexRoundMode('full'),
      right: scene.add.image(o.x + T, o.y, tilesKey, frameOf(assets.doorPanels.right)).setOrigin(0, 0).setDepth(MapDepth.doors).setVertexRoundMode('full'),
      open: 0,
    }));

  // Luz dinámica: todo lo del mapa la recibe (los normal maps le dan relieve); los brillos y textos no.
  if (assets.normals) {
    const lit = [...map.layers.map((l) => l.tilemapLayer), rims, ...props.map((p) => p.image), ...decor.map((d) => d.image), ...doors.flatMap((d) => [d.left, d.right])];
    for (const object of lit) object?.setLighting(true);
  }

  return {
    lit: assets.normals,
    width: map.widthInPixels,
    height: map.heightInPixels,
    propsKey,
    solids: [walls, blocks],
    props,
    decor,
    lights,
    faceTiles,
    floorTiles,
    update(feet, dt) {
      for (const door of doors) {
        const near = feet.some((f) => Math.abs(f.x - door.cx) < DOOR_REACH.x && Math.abs(f.y - door.cy) < DOOR_REACH.y);
        const step = (dt / DOOR_OPEN_S) * T;
        const open = Phaser.Math.Clamp(door.open + (near ? step : -step), 0, T);
        if (open === door.open) continue;
        door.open = open;
        // En pasos de un píxel de arte, para que el borde de la hoja no se vea borroso.
        const s = Math.round(open / 2) * 2;
        door.left.setVisible(s < T).setCrop(s, 0, T - s, T).setX(door.x - s);
        door.right.setVisible(s < T).setCrop(0, 0, T - s, T).setX(door.x + T + s);
      }
    },
  };
}
