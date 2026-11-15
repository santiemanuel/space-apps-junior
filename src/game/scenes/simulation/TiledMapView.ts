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
  /** Las puertas de los costados también tienen hoja (en la base de Marte, que si no parecían abiertas). */
  sideDoors?: boolean;
  /** Índices del tileset que son frentes de pared con una franja de luz. */
  lightTiles: readonly number[];
  /** Índices del tileset de los techos de pared que llevan borde (contorno y luz); sin la lista, todos. */
  rimTiles?: readonly number[];
  /** Colores del borde de los techos de pared; por defecto, los de la paleta de la nave. */
  rimColors?: { outline: number; light: number };
  /**
   * Borde grueso y biselado alrededor de los cuartos, con chaflán en las esquinas (como en las referencias): índices
   * de los techos y de los frentes de pared que lo llevan, y sus colores. Los techos de la lista no usan `rimTiles`.
   */
  bevel?: { caps: readonly number[]; faces: readonly number[]; colors: BevelColors };
  /** Tileset y atlas tienen normal map (`<nombre>_n.png`, de `scripts/art/normals.py`): el mapa recibe luz dinámica. */
  normals: boolean;
}

/** Colores del borde biselado: contorno, brillo, metal y sombra. */
export interface BevelColors {
  outline: number;
  light: number;
  base: number;
  shadow: number;
}

/** Borde biselado de la nave: lavanda con brillo arriba y a la izquierda. */
export const SHIP_BEVEL: BevelColors = { outline: 0x1e162d, light: 0xd6cdef, base: 0x9d93c7, shadow: 0x625887 };

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
  /**
   * Abre las puertas a las que se acerca alguien (`feet`: pies de la tripulación, px). Las de `locked` (por el nombre
   * de su dueño, p. ej. un tubo roto) quedan cerradas.
   */
  /** `onDoor`: una puerta empieza a abrirse o a cerrarse (para su sonido), con su centro en píxeles. */
  update(feet: readonly Point[], dt: number, locked?: ReadonlySet<string>, onDoor?: (state: 'open' | 'close', x: number, y: number) => void): void;
}

/** Alto (px) de la franja de luz dentro del tile de frente de pared. */
const LIGHT_STRIP_Y = 25;
/** Distancia (px) desde el centro de una puerta a la que se abre, y lo que tarda en abrirse (s). */
const DOOR_REACH = { x: 72, y: 84 } as const;
const DOOR_OPEN_S = 0.22;
/** Colores del borde de los techos de pared: contorno oscuro y luz (de la paleta del tileset). */
const RIM = { outline: 0x1e162d, light: 0x63537f } as const;
/** Ancho del borde biselado (px; 6 píxeles de arte) y lado del chaflán de las esquinas de los cuartos (px). */
const BEVEL = 12;
const CHAMFER = 20;

/**
 * Dibuja el borde biselado: bandas de 6 píxeles de arte (contorno, brillo, metal, sombra, contorno) a lo largo de los
 * bordes de los cuartos y chaflanes a 45° en sus esquinas, que se meten en el piso.
 */
function bevelPainter(g: Phaser.GameObjects.Graphics, c: BevelColors) {
  const stripes = [c.outline, c.light, c.base, c.base, c.shadow, c.outline];
  return {
    horizontal(x: number, y: number, w: number) {
      stripes.forEach((color, i) => g.fillStyle(color).fillRect(x, y + i * 2, w, 2));
    },
    vertical(x: number, y: number, h: number) {
      stripes.forEach((color, i) => g.fillStyle(color).fillRect(x + i * 2, y, 2, h));
    },
    /** Chaflán en la esquina (`x`, `y`) de un piso; `dx` y `dy` apuntan hacia adentro del cuarto. */
    corner(x: number, y: number, dx: 1 | -1, dy: 1 | -1) {
      const n = CHAMFER / 2;
      for (let k = 0; k < n; k++) {
        const length = (n - k) * 2;
        const ry = dy > 0 ? y + k * 2 : y - (k + 1) * 2;
        const rx = dx > 0 ? x : x - length;
        g.fillStyle(c.base).fillRect(rx, ry, length, 2);
        // El borde diagonal: contorno hacia el piso y, del lado de adentro, brillo o sombra según de dónde viene la luz.
        const edge = dx > 0 ? rx + length - 2 : rx;
        const inner = dx > 0 ? edge - 2 : edge + 2;
        g.fillStyle(c.outline).fillRect(edge, ry, 2, 2);
        if (length > 4) g.fillStyle(dy > 0 ? c.shadow : c.light).fillRect(inner, ry, 2, 2);
      }
    },
  };
}

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
  /** Dueño de la puerta (cuarto o tubo). */
  name: string;
  cx: number;
  cy: number;
  x: number;
  left: Phaser.GameObjects.Image | null;
  right: Phaser.GameObjects.Image | null;
  /** Hoja de una puerta de costado (vista 3/4): una franja que sube al abrirse. */
  side: Phaser.GameObjects.Rectangle | null;
  open: number;
  /** Alguien está cerca (se está abriendo o ya abrió). */
  near: boolean;
}

/**
 * Pinta el mapa: piso y paredes en capas comunes (sólo se dibujan los tiles que entran en la cámara). El piso no va
 * en `TilemapGPULayer`: en Phaser 4.2.1 esa capa lee el normal map del tileset cabeza abajo (cada tile toma el
 * relieve de otro, espejado), y con una luz rasante se marcaba la grilla de tiles; además tiñe los tiles vacíos.
 * Los objetos son imágenes de un atlas ordenadas por su pie. Todo redondea sus vértices a píxeles de
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
  map.createLayer('piso', tileset, 0, 0, false)!.setDepth(MapDepth.floor).setVertexRoundMode('full');
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
  const rim = assets.rimColors ?? RIM;
  const tileAt = (col: number, row: number) => (wallData[row * map.width + col] ?? 0) - 1;
  const isFace = (col: number, row: number) => isWall(col, row) && !isWall(col, row + 1);
  const bevel = assets.bevel;
  const paint = bevel ? bevelPainter(rims, bevel.colors) : null;
  for (let row = 0; row < map.height; row++) {
    for (let col = 0; col < map.width; col++) {
      const x = col * T;
      const y = row * T;
      if (!isWall(col, row)) {
        floorTiles.push({ x: col, y: row });
        // Chaflán en las esquinas de los cuartos y del pasillo (sólo las que forman dos paredes de la base).
        if (paint) {
          const based = (c: number, r: number) => bevel!.caps.includes(tileAt(c, r)) || bevel!.faces.includes(tileAt(c, r));
          const left = isWall(col - 1, row) && based(col - 1, row);
          const right = isWall(col + 1, row) && based(col + 1, row);
          const up = isWall(col, row - 1) && based(col, row - 1);
          const down = isWall(col, row + 1) && based(col, row + 1);
          if (left && up) paint.corner(x, y, 1, 1);
          if (right && up) paint.corner(x + T, y, -1, 1);
          if (left && down) paint.corner(x, y + T, 1, -1);
          if (right && down) paint.corner(x + T, y + T, -1, -1);
        }
        continue;
      }
      if (!isWall(col, row + 1)) {
        faceTiles.push({ x: col, y: row });
        if (assets.lightTiles.includes(tileAt(col, row))) lights.push({ x: x + T / 2, y: y + LIGHT_STRIP_Y, kind: 'strip' });
        // Pared de un tile entre dos pisos (cuarto y pasillo): el borde va arriba del frente.
        if (paint && bevel!.faces.includes(tileAt(col, row)) && !isWall(col, row - 1)) paint.horizontal(x, y, T);
        continue;
      }
      if (paint && bevel!.caps.includes(tileAt(col, row))) {
        // Costados: junto a un piso o a un frente (en ese caso arranca un borde más arriba, donde dobla el de arriba).
        for (const side of [-1, 1] as const) {
          const n = col + side;
          if (isWall(n, row) && !isFace(n, row)) continue;
          const top = isFace(n, row) ? y - BEVEL : y;
          paint.vertical(side < 0 ? x : x + T - BEVEL, top, y + T - top);
        }
        // Arriba de un frente (la pared de atrás del cuarto) o abajo de un piso (el casco).
        if (isFace(col, row + 1)) paint.horizontal(x, y + T - BEVEL, T);
        if (!isWall(col, row - 1)) {
          const sideCap = (c: number) => isWall(c, row) && isWall(c, row - 1);
          const from = x - (sideCap(col - 1) ? BEVEL : 0);
          paint.horizontal(from, y, x + T - from + (sideCap(col + 1) ? BEVEL : 0));
        }
        continue;
      }
      // Techo de pared junto al piso: contorno oscuro y una línea de luz, de un píxel de arte (2 px) cada uno.
      if (assets.rimTiles && !assets.rimTiles.includes(tileAt(col, row))) continue;
      if (!isWall(col - 1, row)) rims.fillStyle(rim.outline).fillRect(x, y, 2, T).fillStyle(rim.light).fillRect(x + 2, y, 2, T);
      if (!isWall(col + 1, row)) rims.fillStyle(rim.outline).fillRect(x + T - 2, y, 2, T).fillStyle(rim.light).fillRect(x + T - 4, y, 2, T);
    }
  }
  for (const p of props) if (p.key === 'lamp') lights.push({ x: p.x, y: p.bottom - p.image.height + 14, kind: 'lamp' });

  // Puertas: las hojas son tiles del tileset, que se agregan como cuadros de su textura. Sólo las de las paredes de
  // arriba o de abajo (más anchas que altas) tienen hojas: las de los costados, en la vista 3/4, son un hueco.

  const texture = scene.textures.get(tilesKey);
  const columns = Math.floor(texture.getSourceImage().width / T);
  const frameOf = (index: number) => {
    const name = `tile-${index}`;
    if (!texture.has(name)) texture.add(name, 0, (index % columns) * T, Math.floor(index / columns) * T, T, T);
    return name;
  };
  const doors: Door[] = (assets.map.layers.find((l) => l.name === 'zonas')?.objects ?? [])
    .filter((o) => o.type === 'door' && o.name !== 'exterior' && (o.width > o.height || assets.sideDoors))
    .map((o) => {
      const wide = o.width > o.height;
      return {
        name: o.name,
        cx: o.x + o.width / 2,
        cy: o.y + o.height / 2,
        x: o.x,
        left: wide ? scene.add.image(o.x, o.y, tilesKey, frameOf(assets.doorPanels.left)).setOrigin(0, 0).setDepth(MapDepth.doors).setVertexRoundMode('full') : null,
        right: wide ? scene.add.image(o.x + T, o.y, tilesKey, frameOf(assets.doorPanels.right)).setOrigin(0, 0).setDepth(MapDepth.doors).setVertexRoundMode('full') : null,
        side: wide
          ? null
          : scene.add.rectangle(o.x + o.width / 2, o.y, 10, o.height, 0x8a94a6).setOrigin(0.5, 0).setStrokeStyle(2, 0x2d3748).setDepth(MapDepth.doors),
        open: 0,
        near: false,
      };
    });

  // Luz dinámica: todo lo del mapa la recibe (los normal maps le dan relieve); los brillos y textos no.
  if (assets.normals) {
    const lit = [...map.layers.map((l) => l.tilemapLayer), rims, ...props.map((p) => p.image), ...decor.map((d) => d.image), ...doors.flatMap((d) => [d.left, d.right].filter((x): x is Phaser.GameObjects.Image => x !== null))];
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
    update(feet, dt, locked, onDoor) {
      for (const door of doors) {
        const near = !locked?.has(door.name) && feet.some((f) => Math.abs(f.x - door.cx) < DOOR_REACH.x && Math.abs(f.y - door.cy) < DOOR_REACH.y);
        if (near !== door.near) onDoor?.(near ? 'open' : 'close', door.cx, door.cy);
        door.near = near;
        const step = (dt / DOOR_OPEN_S) * T;
        const open = Phaser.Math.Clamp(door.open + (near ? step : -step), 0, T);
        if (open === door.open) continue;
        door.open = open;
        // En pasos de un píxel de arte, para que el borde de la hoja no se vea borroso.
        const s = Math.round(open / 2) * 2;
        door.left?.setVisible(s < T).setCrop(s, 0, T - s, T).setX(door.x - s);
        door.right?.setVisible(s < T).setCrop(0, 0, T - s, T).setX(door.x + T + s);
        door.side?.setVisible(s < T).setScale(1, 1 - s / T);
      }
    },
  };
}
