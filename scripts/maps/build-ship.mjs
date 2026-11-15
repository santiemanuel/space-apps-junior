// Arma el mapa inicial de la nave en formato Tiled (src/content/maps/ship.json).
// Es el punto de partida: después se puede editar a mano en Tiled (https://www.mapeditor.org). OJO: volver a
// correr este script pisa esos cambios.
// Uso: node scripts/maps/build-ship.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { formatTiledJson } from './tiled.mjs';

const T = 48;
const ROOM_COLS = 9;
const ROOM_ROWS = 6;
// Arriba van los cuartos con ventanal (la pared de arriba tiene techo y frente: entra uno de casi 2 tiles de alto).
const TOP = ['command', 'exercise', 'shelter', 'radio'];
const BOTTOM = ['infirmary', 'pantry', 'scrubber', 'recycler'];
const COLS = 1 + TOP.length * (ROOM_COLS + 1);
// Filas: 0 techo, 1 frente de pared, cuartos de arriba, pared, pasillo (3), pared, cuartos de abajo, techo.
const TOP_ROW = 2;
const CORRIDOR_ROW = TOP_ROW + ROOM_ROWS + 1;
const BOTTOM_ROW = CORRIDOR_ROW + 4;
const ROWS = BOTTOM_ROW + ROOM_ROWS + 1;

// Índices del tileset (public/assets/ship/tiles.png, 4 columnas).
const FLOOR = [0, 0, 0, 0, 0, 1, 2, 0, 0, 3];
const CORRIDOR = 4;
const CORRIDOR_MARK = 5;
const HAZARD = 6;
const SHELTER_FLOOR = 7;
const FACE = 8;
const FACE_VENT = 9;
const FACE_PIPES = 10;
const FACE_LIGHT = 11;
// Techos de pared: maquinaria, caños horizontales (tramos a lo largo) y caños verticales (tramos entre cuartos).
const CAP = 12;
const CAP_PIPES_H = 13;
const CAP_PIPES_V = 14;
// Marco de las puertas: pilar en el borde derecho (a la izquierda del vano) y en el izquierdo (a la derecha).
const PILLAR_RIGHT = 16;
const PILLAR_LEFT = 20;

// Azar con semilla, para que el mapa salga siempre igual.
let seed = 20240115;
const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;

const floor = new Array(COLS * ROWS).fill(0);
const walls = new Array(COLS * ROWS).fill(0);
const walkable = new Array(COLS * ROWS).fill(false);
const at = (col, row) => row * COLS + col;
const put = (layer, col, row, index) => {
  layer[at(col, row)] = index + 1;
};

const zones = [];
const rooms = (ids, row, doorRow) =>
  ids.forEach((id, i) => {
    const col = 1 + i * (ROOM_COLS + 1);
    const doorCol = col + Math.floor(ROOM_COLS / 2);
    for (let r = row; r < row + ROOM_ROWS; r++)
      for (let c = col; c < col + ROOM_COLS; c++) {
        walkable[at(c, r)] = true;
        put(floor, c, r, id === 'shelter' ? SHELTER_FLOOR : FLOOR[Math.floor(random() * FLOOR.length)]);
      }
    // Puerta de 2 tiles de ancho, con franja de peligro.
    for (const c of [doorCol - 1, doorCol]) {
      walkable[at(c, doorRow)] = true;
      put(floor, c, doorRow, HAZARD);
    }
    zones.push({ id, col, row, doorCol: doorCol - 1, doorRow, top: row < CORRIDOR_ROW });
  });
rooms(TOP, TOP_ROW, CORRIDOR_ROW - 1);
rooms(BOTTOM, BOTTOM_ROW, BOTTOM_ROW - 1);
for (let r = CORRIDOR_ROW; r < CORRIDOR_ROW + 3; r++)
  for (let c = 1; c < COLS - 1; c++) {
    walkable[at(c, r)] = true;
    put(floor, c, r, r === CORRIDOR_ROW + 1 ? CORRIDOR_MARK : CORRIDOR);
  }

// Paredes: si abajo hay piso se ve el frente de la pared; si no, el techo. Los techos junto a un cuarto llevan caños
// que siguen la pared (verticales a los costados, horizontales arriba y abajo), como en las referencias.
const open = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS && walkable[at(c, r)];
const isFace = (c, r) => r + 1 < ROWS && !open(c, r) && open(c, r + 1);
const capFor = (c, r) => {
  const side = open(c - 1, r) || open(c + 1, r) || isFace(c - 1, r) || isFace(c + 1, r);
  const along = open(c, r - 1) || open(c, r + 1) || isFace(c, r + 1) || isFace(c, r - 1) || r === 0;
  if (side && !along) return CAP_PIPES_V;
  if (along && !side) return random() < 0.15 ? CAP : CAP_PIPES_H;
  return CAP;
};
for (let r = 0; r < ROWS; r++)
  for (let c = 0; c < COLS; c++) {
    if (walkable[at(c, r)]) continue;
    if (!isFace(c, r)) put(walls, c, r, capFor(c, r));
    else put(walls, c, r, c % 4 === 2 ? FACE_LIGHT : random() < 0.14 ? FACE_VENT : random() < 0.1 ? FACE_PIPES : FACE);
  }
for (const zone of zones) {
  put(walls, zone.doorCol - 1, zone.doorRow, PILLAR_RIGHT);
  put(walls, zone.doorCol + 2, zone.doorRow, PILLAR_LEFT);
}

// Objetos: [sprite, columna del centro, fila del borde de abajo], en tiles desde la esquina del cuarto.
// Los cuartos de arriba tienen la puerta abajo al centro; los de abajo, arriba al centro: ese carril queda libre.
// Mando = sala común de las referencias (ventanal, consolas bajo la ventana, sillón con holomesa); radio = sala de
// comunicaciones (escritorio de dos pantallas con su silla y radar); refugio = sala de la alerta de radiación
// (ventanal al Sol, pantalla de aviso y tanques de agua de escudo). Los cuartos de arriba tienen la puerta abajo al
// centro y los de abajo arriba: ese carril queda libre.
const PROPS = {
  command: [
    ['lowconsole', 2.6, 1.45], ['helm', 6.6, 1.9], ['seat', 6.6, 3.1], ['plant', 8.35, 1.7],
    ['couch', 1.6, 5.9], ['holotable', 1.6, 5.95], ['console', 6.3, 5.9], ['crate', 8.2, 5.9],
  ],
  exercise: [['bike', 4.5, 2.1], ['treadmill', 1.6, 2.4], ['crate', 8.1, 1.8], ['plant', 8.3, 5.8], ['lamp', 0.5, 5.8]],
  shelter: [
    ['tank', 0.7, 2.6], ['tank', 1.8, 2.6], ['tank', 7.2, 2.6], ['tank', 8.3, 2.6],
    ['tank', 0.7, 5.9], ['tank', 1.8, 5.9], ['tank', 7.2, 5.9], ['tank', 8.3, 5.9], ['crate', 4.5, 1.5],
  ],
  radio: [
    ['commsdesk', 2.2, 2.0], ['chair', 2.2, 3.15], ['radar', 6.2, 2.1], ['radio', 7.95, 2.0],
    ['headset', 8.1, 4.3], ['plant', 0.75, 5.9], ['crate', 7.9, 5.9],
  ],
  infirmary: [['bed', 1.3, 2.4], ['bed', 1.3, 5.2], ['medcabinet', 8, 2.2], ['pod', 7.8, 5.8], ['plant', 2.9, 5.9]],
  // Cocina: la mesada con el horno al fondo (donde se trabaja) y el recetario en la esquina, a unos pasos.
  pantry: [['shelf', 1.3, 2.4], ['fridge', 8.0, 2.3], ['diningtable', 1.6, 5.9], ['galley', 4.5, 5.9], ['recipestand', 7.8, 5.9]],
  scrubber: [['scrubber', 4.5, 5.9], ['canisters', 1.5, 5.9], ['pump', 7.7, 5.9], ['crates', 1.4, 2.0], ['plant', 8.3, 1.8]],
  recycler: [['recycler', 4.5, 5.9], ['tank', 1, 5.9], ['tank', 2.1, 5.9], ['pump', 7.6, 5.9], ['crate', 8.1, 1.8]],
};
// Colgados de la pared de arriba del cuarto (sin colisión): [sprite, columna del centro]. En los cuartos de abajo la
// pared mide un tile (encima está el pasillo): sólo entra lo bajo (alarmas, luces).
// Las alarmas se encienden en las alertas (HabitatFx); por los ventanales se ve el espacio (SpaceWindows).
const WALL_DECOR = {
  command: [['bigwindow', 2.6], ['wallscreen', 6.6], ['alarm', 8.5]],
  exercise: [['window', 4.5], ['alarm', 7.5]],
  shelter: [['bigwindow', 2.6], ['warnscreen', 6.6], ['alarm', 8.5]],
  radio: [['bigwindow', 2.6], ['wallscreen', 6.6], ['alarm', 8.5]],
  infirmary: [['alarm', 7.5]],
  pantry: [['alarm', 7.5]],
  scrubber: [['alarm', 7.5], ['redlight', 1.5]],
  recycler: [['alarm', 1.5]],
};
// Puntos con nombre (`landmark`): [nombre, zona, columna, fila] en tiles desde la esquina del cuarto. `recipe`: donde
// se lee el recetario de la cocina.
const LANDMARKS = [['recipe', 'pantry', 7.8, 4.7]];
// Donde se para quien trabaja en el cuarto (tiles desde la esquina).
const SPOT = { top: [4.5, 3.4], bottom: [4.5, 3.6] };

const atlas = JSON.parse(readFileSync('public/assets/ship/props.json', 'utf8')).frames;
const sizeOf = (key) => {
  if (!atlas[key]) throw new Error(`No existe el sprite "${key}" en public/assets/ship/props.json`);
  return atlas[key].sourceSize;
};

let nextId = 1;
const object = (name, type, x, y, width = 0, height = 0) => ({
  id: nextId++,
  name,
  type,
  x,
  y,
  width,
  height,
  rotation: 0,
  visible: true,
  ...(width === 0 && height === 0 ? { point: true } : {}),
});
const zoneObjects = [object('', 'corridor', T, CORRIDOR_ROW * T, (COLS - 2) * T, 3 * T)];
const propObjects = [];
const decorObjects = [];
for (const zone of zones) {
  const x = zone.col * T;
  const y = zone.row * T;
  zoneObjects.push(object(zone.id, 'zone', x, y, ROOM_COLS * T, ROOM_ROWS * T));
  zoneObjects.push(object(zone.id, 'door', zone.doorCol * T, zone.doorRow * T, 2 * T, T));
  const [sx, sy] = zone.top ? SPOT.top : SPOT.bottom;
  zoneObjects.push(object(zone.id, 'spot', x + sx * T, y + sy * T));
  if (zone.id === TOP[0]) zoneObjects.push(object('', 'spawn', x + sx * T, y + sy * T));
  for (const [name, , col, row] of LANDMARKS.filter(([, id]) => id === zone.id)) zoneObjects.push(object(name, 'landmark', Math.round(x + col * T), Math.round(y + row * T)));
  for (const [key, col, row] of PROPS[zone.id] ?? []) {
    const { w, h } = sizeOf(key);
    // Lo que choca es la base del objeto: casi todo el ancho y menos de la mitad del alto.
    const width = Math.round(w * 0.86);
    const height = Math.round(Math.min(h * 0.42, 40));
    propObjects.push(object('', key, Math.round(x + col * T - width / 2), Math.round(y + row * T - height), width, height));
  }
  for (const [key, col] of WALL_DECOR[zone.id] ?? []) decorObjects.push(object('', key, Math.round(x + col * T), y - 6));
}
// Pasillo: dos alarmas en la pared de arriba y una luz roja al lado de la puerta del refugio (se prende en las alertas).
for (const i of [0, 2]) decorObjects.push(object('', 'alarm', Math.round((1 + i * (ROOM_COLS + 1) + 1.5) * T), CORRIDOR_ROW * T - 6));
const shelterZone = zones.find((z) => z.id === 'shelter');
decorObjects.push(object('', 'redlight', Math.round((shelterZone.doorCol + 4) * T), CORRIDOR_ROW * T - 6));
// Pasillo: luces contra la pared de arriba, entre las puertas.
for (let i = 1; i < TOP.length; i++) {
  const { w, h } = sizeOf('lamp');
  const height = Math.round(h * 0.3);
  propObjects.push(object('', 'lamp', Math.round(i * (ROOM_COLS + 1) * T + T / 2 - w / 2), CORRIDOR_ROW * T + 34 - height, w, height));
}

let layerId = 1;
const tileLayer = (name, data) => ({ id: layerId++, name, type: 'tilelayer', x: 0, y: 0, width: COLS, height: ROWS, opacity: 1, visible: true, data });
const objectLayer = (name, objects) => ({ id: layerId++, name, type: 'objectgroup', draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true, objects });
const map = {
  type: 'map',
  version: '1.10',
  tiledversion: '1.10.2',
  orientation: 'orthogonal',
  renderorder: 'right-down',
  infinite: false,
  compressionlevel: -1,
  width: COLS,
  height: ROWS,
  tilewidth: T,
  tileheight: T,
  tilesets: [
    {
      firstgid: 1,
      name: 'ship-tiles',
      image: '../../../public/assets/ship/tiles.png',
      imagewidth: 192,
      imageheight: 288,
      tilewidth: T,
      tileheight: T,
      columns: 4,
      tilecount: 24,
      margin: 0,
      spacing: 0,
    },
  ],
  layers: [tileLayer('piso', floor), tileLayer('paredes', walls), objectLayer('zonas', zoneObjects), objectLayer('objetos', propObjects), objectLayer('decorado', decorObjects)],
};
map.nextlayerid = layerId;
map.nextobjectid = nextId;
writeFileSync('src/content/maps/ship.json', formatTiledJson(map, COLS));
console.log(`src/content/maps/ship.json: ${COLS} x ${ROWS} tiles, ${zones.length} zonas, ${propObjects.length} objetos, ${decorObjects.length} adornos de pared`);
