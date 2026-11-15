// Arma el mapa inicial de la base en Gale en formato Tiled (src/content/maps/gale.json).
// Es el punto de partida: después se puede editar a mano en Tiled (https://www.mapeditor.org). OJO: volver a
// correr este script pisa esos cambios.
//
// La base tiene los mismos cuartos que la nave y una esclusa con dos puertas (al pasillo y al exterior). Afuera,
// un corte comprimido y NO a escala del camino real de Curiosity, de norte a sur (docs/plan-visual.md, Fase 4;
// fuentes en src/content/galeTerrain.ts): llanura de Aeolis (con la base), lecho de lago de Yellowknife Bay, dunas
// Bagnold, cerros Murray y el canal Gediz Vallis al pie del monte Sharp, donde está Curiosity.
// Uso: node scripts/maps/build-gale.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { formatTiledJson } from './tiled.mjs';

const T = 48;
const COLS = 72;
const ROWS = 72;

// --- Base (coordenadas locales, como en build-ship.mjs) ---
const ROOM_COLS = 9;
const ROOM_ROWS = 6;
const AIRLOCK_COLS = 6;
// Arriba, los cuartos con ventanal (como en build-ship.mjs); MOXIE queda junto a la esclusa y bajo el invernadero.
const TOP = ['command', 'exercise', 'shelter', 'greenhouse'];
const BOTTOM = ['infirmary', 'scrubber', 'radio', 'moxie'];
// Filas: techo, frente de pared, cuartos de arriba, pared, pasillo (3), pared, cuartos de abajo (y la esclusa), pared.
const TOP_ROW = 2;
const CORRIDOR_ROW = TOP_ROW + ROOM_ROWS + 1;
const BOTTOM_ROW = CORRIDOR_ROW + 4;
const BASE_ROWS = BOTTOM_ROW + ROOM_ROWS + 1;
const AIRLOCK_COL = 1 + BOTTOM.length * (ROOM_COLS + 1);
const BASE_COLS = AIRLOCK_COL + AIRLOCK_COLS + 1;
// Dónde queda la base en el mapa: en la llanura, al norte.
const BASE_X = 12;
const BASE_Y = 3;

// --- Franjas del exterior (filas del mapa, de norte a sur) ---
const STRIPS = [
  { id: 'plain', from: 1, to: 30 },
  { id: 'lakebed', from: 31, to: 38 },
  { id: 'dunes', from: 39, to: 46 },
  { id: 'buttes', from: 47, to: 56 },
  { id: 'gediz', from: 57, to: 70 },
];

// Índices del tileset (public/assets/mars/tiles.png, 4 columnas). 0–23: los de la nave (mismos índices que
// build-ship.mjs, en versión cálida); 24–45: el suelo de Gale (scripts/art/gale-tiles.py).
const SHIP = { FLOOR: [0, 0, 0, 0, 0, 1, 2, 0, 0, 3], CORRIDOR: 4, CORRIDOR_MARK: 5, HAZARD: 6, SHELTER_FLOOR: 7, FACE: 8, FACE_VENT: 9, FACE_PIPES: 10, FACE_LIGHT: 11, CAP: 12, CAP_PIPES_H: 13, CAP_PIPES_V: 14, PILLAR_RIGHT: 16, PILLAR_LEFT: 20 };
const G = {
  PLAIN: 24, PLAIN_GRAVEL: 25, PLAIN_PEBBLES: 26, PLAIN_DARK: 27,
  LAKE: 28, LAKE_VEINS: 29, LAKE_SPHERULES: 30,
  DUNE: 31, DUNE_BIG: 32, BEDROCK: 33, GRAVEL: 34, SULFUR: 35,
  CLIFF_CAP: 36, CLIFF_FACE: 37, /* 38: huellas de rover (sin usar todavía) */ DUNE_CAP: 39, DUNE_FACE: 40, MOUNT_CAP: 41, MOUNT_FACE: 42,
  GRAVEL_SLABS: 43, GRAVEL_STONES: 44, SULFUR_2: 45,
};
const TILE_COUNT = 48;

// Objetos: atlas de Marte (incluye los de la nave).
const PROPS_ATLAS = 'public/assets/mars/props.json';
const atlas = JSON.parse(readFileSync(PROPS_ATLAS, 'utf8')).frames;
const sizeOf = (key) => {
  if (!atlas[key]) throw new Error(`No existe el sprite "${key}" en ${PROPS_ATLAS}`);
  return atlas[key].sourceSize;
};

// Azar con semilla, para que el mapa salga siempre igual.
let seed = 20240530;
const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const pick = (weights) => {
  let r = random() * weights.reduce((sum, [, w]) => sum + w, 0);
  for (const [value, w] of weights) if ((r -= w) < 0) return value;
  return weights[0][0];
};
/** Ruido suave por bloques de 4 × 4 tiles: manchas del suelo que no cambian tile a tile. */
const patch = (col, row) => {
  const h = Math.imul((col >> 2) * 73856093 ^ (row >> 2) * 19349663, 2654435761) >>> 0;
  return (h % 1000) / 1000;
};

const at = (col, row) => row * COLS + col;
const floor = new Array(COLS * ROWS).fill(0);
const walls = new Array(COLS * ROWS).fill(0);
/** Qué hay en cada tile: 'room' (cuartos, puertas y pasillo), 'base' (pared de la base), 'ground' o un tipo de pared del terreno. */
const kind = new Array(COLS * ROWS).fill('ground');
const put = (layer, col, row, index) => {
  layer[at(col, row)] = index + 1;
};
const inMap = (col, row) => col >= 0 && row >= 0 && col < COLS && row < ROWS;
const isBlocked = (col, row) => !inMap(col, row) || (kind[at(col, row)] !== 'ground' && kind[at(col, row)] !== 'room');
const stripAt = (row) => STRIPS.find((s) => row >= s.from && row <= s.to) ?? (row < 1 ? STRIPS[0] : STRIPS[STRIPS.length - 1]);

// --- Base ---
for (let r = 0; r < BASE_ROWS; r++) for (let c = 0; c < BASE_COLS; c++) kind[at(BASE_X + c, BASE_Y + r)] = 'base';
const zones = [];
const openRoom = (id, col, row, cols, doorRow) => {
  const doorCol = col + Math.floor(cols / 2);
  for (let r = row; r < row + ROOM_ROWS; r++)
    for (let c = col; c < col + cols; c++) {
      kind[at(BASE_X + c, BASE_Y + r)] = 'room';
      put(floor, BASE_X + c, BASE_Y + r, id === 'shelter' ? SHIP.SHELTER_FLOOR : SHIP.FLOOR[Math.floor(random() * SHIP.FLOOR.length)]);
    }
  for (const c of [doorCol - 1, doorCol]) {
    kind[at(BASE_X + c, BASE_Y + doorRow)] = 'room';
    put(floor, BASE_X + c, BASE_Y + doorRow, SHIP.HAZARD);
  }
  const zone = { id, col, row, cols, doorCol: doorCol - 1, doorRow, top: row < CORRIDOR_ROW };
  zones.push(zone);
  return zone;
};
TOP.forEach((id, i) => openRoom(id, 1 + i * (ROOM_COLS + 1), TOP_ROW, ROOM_COLS, CORRIDOR_ROW - 1));
BOTTOM.forEach((id, i) => openRoom(id, 1 + i * (ROOM_COLS + 1), BOTTOM_ROW, ROOM_COLS, BOTTOM_ROW - 1));
const airlock = openRoom('airlock', AIRLOCK_COL, BOTTOM_ROW, AIRLOCK_COLS, BOTTOM_ROW - 1);
for (let r = CORRIDOR_ROW; r < CORRIDOR_ROW + 3; r++)
  for (let c = 1; c < BASE_COLS - 1; c++) {
    kind[at(BASE_X + c, BASE_Y + r)] = 'room';
    put(floor, BASE_X + c, BASE_Y + r, r === CORRIDOR_ROW + 1 ? SHIP.CORRIDOR_MARK : SHIP.CORRIDOR);
  }
// Puerta exterior de la esclusa: en su pared de abajo, alineada con la de adentro.
const outerDoor = { col: BASE_X + airlock.doorCol, row: BASE_Y + BOTTOM_ROW + ROOM_ROWS };
for (const c of [outerDoor.col, outerDoor.col + 1]) {
  kind[at(c, outerDoor.row)] = 'room';
  put(floor, c, outerDoor.row, SHIP.HAZARD);
}

// --- Terreno ---
const baseNear = (col, row, margin) =>
  col >= BASE_X - margin && col < BASE_X + BASE_COLS + margin && row >= BASE_Y - margin && row < BASE_Y + BASE_ROWS + margin;
const doorNear = (col, row, margin) => Math.abs(col - outerDoor.col - 0.5) <= margin && row - outerDoor.row <= margin + 1 && row > outerDoor.row;
/** ¿Se puede poner algo que choca acá sin tocar otra cosa que choca? Deja `gap` tiles libres alrededor. */
const free = (col, row, w, h, gap) => {
  for (let r = row - gap; r < row + h + gap; r++) for (let c = col - gap; c < col + w + gap; c++) if (isBlocked(c, r) || kind[at(c, r)] === 'room') return false;
  return true;
};
const block = (col, row, w, h, what) => {
  for (let r = row; r < row + h; r++) for (let c = col; c < col + w; c++) kind[at(c, r)] = what;
};

// Bordes: el borde del cráter al norte (acantilado), laderas a los costados y el monte Sharp al sur.
for (let c = 0; c < COLS; c++) {
  kind[at(c, 0)] = 'cliff';
  kind[at(c, 1)] = 'cliff';
}
for (let r = 0; r < ROWS; r++) {
  kind[at(0, r)] = r >= 57 ? 'mount' : 'cliff';
  kind[at(COLS - 1, r)] = r >= 57 ? 'mount' : 'cliff';
}

// Gediz Vallis: el canal baja serpenteando por la ladera del monte Sharp; afuera del canal, la montaña.
const channel = (row) => {
  const k = (row - 57) / 13;
  const center = 40 + Math.round(5 * Math.sin(k * Math.PI * 1.2));
  const half = Math.round(10 - 3 * k);
  return { from: center - half, to: center + half };
};
for (let r = 57; r < ROWS; r++) {
  const { from, to } = channel(r);
  for (let c = 0; c < COLS; c++) if (r >= 68 || c < from || c > to) kind[at(c, r)] = 'mount';
}

// Dunas Bagnold: crestas de 2 filas (cresta y cara de avalancha) separadas, con pasos entre ellas.
for (let tries = 0, placed = 0; tries < 400 && placed < 9; tries++) {
  const w = 4 + Math.floor(random() * 6);
  const col = 2 + Math.floor(random() * (COLS - w - 4));
  const row = 40 + Math.floor(random() * 5);
  if (!free(col, row, w, 2, 2)) continue;
  block(col, row, w, 2, 'dune');
  placed++;
}
// Cerros Murray: mesetas de capas, de 4–7 × 3–4 tiles.
for (let tries = 0, placed = 0; tries < 600 && placed < 8; tries++) {
  const w = 4 + Math.floor(random() * 4);
  const h = 3 + Math.floor(random() * 2);
  const col = 3 + Math.floor(random() * (COLS - w - 6));
  const row = 48 + Math.floor(random() * (54 - h - 48 + 2));
  if (!free(col, row, w, h, 2)) continue;
  block(col, row, w, h, 'butte');
  placed++;
}
/** Objetos del exterior: [sprite, x del centro, borde de abajo, ancho y alto de la caja] en px. */
const outsideProps = [];
/** Adornos del suelo sin colisión (piedras chicas): [sprite, x del centro, borde de abajo] en px. */
const groundDecor = [];
const placeOutside = (key, cx, bottom, w, h) => {
  outsideProps.push([key, cx, bottom, w, h]);
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const [x, y] = [(c + 0.5) * T, (r + 0.5) * T];
      if (x >= cx - w / 2 && x < cx + w / 2 && y >= bottom - h && y < bottom) kind[at(c, r)] = 'prop';
    }
};
/** Roca grande que ocupa un tile: la caja tapa su centro. */
const rockOn = (key, col, row) => placeOutside(key, (col + 0.5) * T, row * T + 42, 40, 28);

// Lugar de Curiosity: en el canal, junto al campo de piedras de azufre.
const curiosityRow = 63;
const curiosityCol = Math.round((channel(curiosityRow).from + channel(curiosityRow).to) / 2) + 3;
const sulfur = { col: curiosityCol - 6, row: curiosityRow - 2, cols: 5, rows: 3 };

// Montículos de bloques en el centro del canal (los dejaron las crecidas y las avalanchas).
for (let tries = 0, placed = 0; tries < 400 && placed < 6; tries++) {
  const w = 1 + Math.floor(random() * 2);
  const h = 1 + Math.floor(random() * 2);
  const row = 58 + Math.floor(random() * 8);
  const { from, to } = channel(row);
  const col = from + 3 + Math.floor(random() * Math.max(1, to - from - 5));
  const nearCuriosity = col + w > sulfur.col - 1 && col <= curiosityCol + 2 && row + h > sulfur.row - 1 && row <= curiosityRow + 2;
  if (nearCuriosity || !free(col, row, w, h, 2)) continue;
  for (let r = row; r < row + h; r++) for (let c = col; c < col + w; c++) rockOn('block', c, r);
  placed++;
}
// Afuera de la base: paneles solares (los más usados, con polvo), la antena y dos balizas junto a la puerta.
for (let i = 0; i < 5; i++) placeOutside(i % 3 === 1 ? 'solar' : 'solar-dusty', (BASE_X + 3 + i * 2) * T, 26 * T - 4, 64, 24);
placeOutside('antenna', 6.5 * T, 9 * T - 4, 40, 24);
for (const dc of [-1.5, 3.5]) placeOutside('beacon', (outerDoor.col + dc) * T, outerDoor.row * T + 2 * T - 8, 20, 14);
// Rocas sueltas en la llanura y en el lecho de lago, lejos de la base y de la puerta.
for (let tries = 0, placed = 0; tries < 800 && placed < 26; tries++) {
  const col = 2 + Math.floor(random() * (COLS - 4));
  const row = 3 + Math.floor(random() * 35);
  if (baseNear(col, row, 2) || doorNear(col, row, 4) || !free(col, row, 1, 1, 2)) continue;
  rockOn('rock-l', col, row);
  placed++;
}
// Curiosity, estacionado en el canal (sólo el sprite y su caja; el punto `curiosity` es para la escena).
placeOutside('curiosity-dusty', (curiosityCol + 0.5) * T, (curiosityRow + 0.9) * T, 120, 40);
// Piedras chicas y medianas, sin colisión: se pisan.
for (let tries = 0, placed = 0; tries < 900 && placed < 60; tries++) {
  const col = 2 + Math.floor(random() * (COLS - 4));
  const row = 2 + Math.floor(random() * (ROWS - 4));
  if (kind[at(col, row)] !== 'ground' || baseNear(col, row, 1) || doorNear(col, row, 2)) continue;
  groundDecor.push([random() < 0.6 ? 'rock-s' : 'rock-m', Math.round((col + 0.2 + random() * 0.6) * T), Math.round((row + 0.5 + random() * 0.4) * T)]);
  placed++;
}

// Piso de todo el mapa (también debajo de las paredes: la capa de piso va en GPU y tiene que llenar el mapa).
const groundTile = (col, row) => {
  const strip = stripAt(row).id;
  const p = patch(col, row);
  if (strip === 'plain') return p < 0.18 ? G.PLAIN_DARK : pick([[G.PLAIN, 6], [G.PLAIN_GRAVEL, 2], [G.PLAIN_PEBBLES, p > 0.7 ? 3 : 0.6]]);
  if (strip === 'lakebed') return pick([[G.LAKE, 6], [G.LAKE_VEINS, 2], [G.LAKE_SPHERULES, 2]]);
  if (strip === 'dunes') return p < 0.5 ? G.DUNE : G.DUNE_BIG;
  if (strip === 'buttes') return p < 0.3 ? G.DUNE : G.BEDROCK;
  const { from, to } = channel(row);
  if (col >= sulfur.col && col < sulfur.col + sulfur.cols && row >= sulfur.row && row < sulfur.row + sulfur.rows) return random() < 0.5 ? G.SULFUR : G.SULFUR_2;
  if (col - from < 2 || to - col < 2) return G.DUNE;
  return pick([[G.GRAVEL, 6], [G.GRAVEL_STONES, 2], [G.GRAVEL_SLABS, p > 0.6 ? 2 : 0.3]]);
};
// Bordes irregulares entre franjas: la de abajo entra unos tiles en la de arriba.
const edgeShift = (col) => Math.round(1.5 * Math.sin(col / 3.1) + random() * 0.8);
for (let c = 0; c < COLS; c++) {
  const shift = edgeShift(c);
  for (let r = 0; r < ROWS; r++) {
    if (kind[at(c, r)] === 'room') continue;
    put(floor, c, r, groundTile(c, Math.min(ROWS - 1, r + (r > 3 && r < 57 ? shift : 0))));
  }
}

// Paredes: si abajo se puede caminar se ve la ladera (o el frente de la pared de la base); si no, el techo.
const FAMILY = {
  cliff: [G.CLIFF_CAP, G.CLIFF_FACE],
  butte: [G.CLIFF_CAP, G.CLIFF_FACE],
  mount: [G.MOUNT_CAP, G.MOUNT_FACE],
  dune: [G.DUNE_CAP, G.DUNE_FACE],
};
// Techos de la base: caños que siguen la pared, como en la nave (verticales a los costados, horizontales a lo largo).
const roomAt = (c, r) => inMap(c, r) && kind[at(c, r)] === 'room';
const baseFace = (c, r) => inMap(c, r) && kind[at(c, r)] === 'base' && roomAt(c, r + 1);
const baseCap = (c, r) => {
  const side = roomAt(c - 1, r) || roomAt(c + 1, r) || baseFace(c - 1, r) || baseFace(c + 1, r);
  const along = roomAt(c, r - 1) || roomAt(c, r + 1) || baseFace(c, r + 1) || baseFace(c, r - 1) || r === BASE_Y;
  if (side && !along) return SHIP.CAP_PIPES_V;
  if (along && !side) return random() < 0.15 ? SHIP.CAP : SHIP.CAP_PIPES_H;
  return SHIP.CAP;
};
for (let r = 0; r < ROWS; r++)
  for (let c = 0; c < COLS; c++) {
    const what = kind[at(c, r)];
    if (what === 'ground' || what === 'room' || what === 'prop') continue;
    const faces = r + 1 < ROWS && !isBlocked(c, r + 1);
    if (what === 'base') {
      const inside = r + 1 < ROWS && kind[at(c, r + 1)] === 'room' && baseNear(c, r + 1, 0);
      if (!faces) put(walls, c, r, baseCap(c, r));
      else if (!inside) put(walls, c, r, random() < 0.2 ? SHIP.FACE_PIPES : SHIP.FACE);
      else put(walls, c, r, (c - BASE_X) % 4 === 2 ? SHIP.FACE_LIGHT : random() < 0.14 ? SHIP.FACE_VENT : random() < 0.1 ? SHIP.FACE_PIPES : SHIP.FACE);
    } else put(walls, c, r, FAMILY[what][faces ? 1 : 0]);
  }
for (const zone of zones) {
  put(walls, BASE_X + zone.doorCol - 1, BASE_Y + zone.doorRow, SHIP.PILLAR_RIGHT);
  put(walls, BASE_X + zone.doorCol + 2, BASE_Y + zone.doorRow, SHIP.PILLAR_LEFT);
}
put(walls, outerDoor.col - 1, outerDoor.row, SHIP.PILLAR_RIGHT);
put(walls, outerDoor.col + 2, outerDoor.row, SHIP.PILLAR_LEFT);

// Todo el exterior transitable tiene que poder alcanzarse desde la puerta de la esclusa.
{
  const seen = new Set([at(outerDoor.col, outerDoor.row)]);
  const queue = [[outerDoor.col, outerDoor.row]];
  while (queue.length) {
    const [c, r] = queue.pop();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const [nc, nr] = [c + dc, r + dr];
      if (!inMap(nc, nr) || seen.has(at(nc, nr)) || kind[at(nc, nr)] !== 'ground') continue;
      seen.add(at(nc, nr));
      queue.push([nc, nr]);
    }
  }
  const lost = kind.flatMap((k, i) => (k === 'ground' && !seen.has(i) ? [`${i % COLS},${Math.floor(i / COLS)}`] : []));
  if (lost.length) throw new Error(`Hay ${lost.length} tiles del exterior a los que no se llega desde la esclusa: ${lost.slice(0, 8).join(' ')}`);
}

// --- Objetos de la base ---
// [sprite, columna del centro, fila del borde de abajo], en tiles desde la esquina del cuarto.
// Invernadero como en la referencia: gabinetes de cultivo con luz violeta contra la pared, el ventanal a Marte entre
// ellos y dos canteros abajo. Los cuartos de arriba tienen la puerta abajo al centro y los de abajo arriba.
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
  greenhouse: [
    ['growcabinet', 1.3, 2.1], ['growcabinet', 7.7, 2.1], ['plantmonitor', 4.5, 1.6],
    ['greenhouse', 1.5, 5.8], ['greenhouse', 7.5, 5.8], ['hydrotank', 8.45, 4.1],
  ],
  infirmary: [['bed', 1.3, 2.4], ['bed', 1.3, 5.2], ['medcabinet', 8, 2.2], ['pod', 7.8, 5.8], ['plant', 2.9, 5.9]],
  scrubber: [['scrubber', 4.5, 5.9], ['canisters', 1.5, 5.9], ['pump', 7.7, 5.9], ['crates', 1.4, 2.0], ['plant', 8.3, 1.8]],
  radio: [['commsdesk', 1.6, 5.9], ['radio', 4.5, 5.9], ['radar', 7.4, 5.95], ['headset', 8.2, 2.0], ['plant', 0.8, 1.9]],
  moxie: [['moxie', 4.5, 5.9], ['tank', 1, 5.9], ['tank', 2.1, 5.9], ['pump', 7.6, 5.9], ['canisters', 7.5, 1.9], ['seedcart', 1.5, 1.9]],
  airlock: [['suitrack', 0.9, 2.8], ['dustcrate', 4.8, 2.4]],
};
// Colgados de la pared de arriba del cuarto (sin colisión): [sprite, columna del centro]. En los cuartos de abajo la
// pared mide un tile: sólo entra lo bajo. Por los ventanales se ve Gale (MarsWindows).
const WALL_DECOR = {
  command: [['bigwindow', 2.6], ['wallscreen', 6.6], ['alarm', 8.5]],
  exercise: [['window', 4.5], ['alarm', 7.5]],
  shelter: [['bigwindow', 2.6], ['warnscreen', 6.6], ['alarm', 8.5]],
  greenhouse: [['bigwindow', 4.5]],
  infirmary: [['alarm', 7.5]],
  scrubber: [['alarm', 7.5], ['redlight', 1.5]],
  radio: [['alarm', 7.5]],
  moxie: [['alarm', 7.5]],
  airlock: [['alarm', 4.8]],
};
// Donde se para quien trabaja en el cuarto (tiles desde la esquina).
const SPOT = { top: [4.5, 3.4], bottom: [4.5, 3.6] };


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
const zoneObjects = [
  object('', 'corridor', (BASE_X + 1) * T, (BASE_Y + CORRIDOR_ROW) * T, (BASE_COLS - 2) * T, 3 * T),
  // El exterior es todo el mapa menos el borde: la base, las paredes y el terreno que no se pisa quedan fuera por la
  // máscara (capa `paredes`, src/content/tiledLayout.ts).
  object('', 'exterior', T, T, (COLS - 2) * T, (ROWS - 2) * T),
  object('exterior', 'door', outerDoor.col * T, outerDoor.row * T, 2 * T, T),
  ...STRIPS.map((s) => object(s.id, 'terrain', 0, s.from * T, COLS * T, (s.to - s.from + 1) * T)),
  object('curiosity', 'landmark', (curiosityCol + 0.5) * T, (curiosityRow + 0.5) * T),
];
const propObjects = [];
const decorObjects = [];
for (const zone of zones) {
  const x = (BASE_X + zone.col) * T;
  const y = (BASE_Y + zone.row) * T;
  zoneObjects.push(object(zone.id, 'zone', x, y, zone.cols * T, ROOM_ROWS * T));
  zoneObjects.push(object(zone.id, 'door', (BASE_X + zone.doorCol) * T, (BASE_Y + zone.doorRow) * T, 2 * T, T));
  const [sx, sy] = zone.id === 'airlock' ? [zone.cols / 2, 3] : zone.top ? SPOT.top : SPOT.bottom;
  zoneObjects.push(object(zone.id, 'spot', x + sx * T, y + sy * T));
  if (zone.id === TOP[0]) zoneObjects.push(object('', 'spawn', x + sx * T, y + sy * T));
  for (const [key, col, row] of PROPS[zone.id] ?? []) {
    const { w, h } = sizeOf(key);
    // Lo que choca es la base del objeto: casi todo el ancho y menos de la mitad del alto.
    const width = Math.round(w * 0.86);
    const height = Math.round(Math.min(h * 0.42, 40));
    propObjects.push(object('', key, Math.round(x + col * T - width / 2), Math.round(y + row * T - height), width, height));
  }
  for (const [key, col] of WALL_DECOR[zone.id] ?? []) decorObjects.push(object('', key, Math.round(x + col * T), y - 6));
}
// Pasillo: alarmas en la pared de arriba y luces entre las puertas.
for (const i of [0, 2]) decorObjects.push(object('', 'alarm', Math.round((BASE_X + 1 + i * (ROOM_COLS + 1) + 1.5) * T), (BASE_Y + CORRIDOR_ROW) * T - 6));
for (const [key, cx, bottom, w, h] of outsideProps) propObjects.push(object('', key, Math.round(cx - w / 2), Math.round(bottom - h), w, h));
for (const [key, x, y] of groundDecor) decorObjects.push(object('', key, x, y));
for (let i = 1; i < TOP.length; i++) {
  const { w, h } = sizeOf('lamp');
  const height = Math.round(h * 0.3);
  propObjects.push(object('', 'lamp', Math.round((BASE_X + i * (ROOM_COLS + 1)) * T + T / 2 - w / 2), (BASE_Y + CORRIDOR_ROW) * T + 34 - height, w, height));
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
      name: 'gale-tiles',
      image: '../../../public/assets/mars/tiles.png',
      imagewidth: 192,
      imageheight: (TILE_COUNT / 4) * T,
      tilewidth: T,
      tileheight: T,
      columns: 4,
      tilecount: TILE_COUNT,
      margin: 0,
      spacing: 0,
    },
  ],
  layers: [tileLayer('piso', floor), tileLayer('paredes', walls), objectLayer('zonas', zoneObjects), objectLayer('objetos', propObjects), objectLayer('decorado', decorObjects)],
};
map.nextlayerid = layerId;
map.nextobjectid = nextId;
writeFileSync('src/content/maps/gale.json', formatTiledJson(map, COLS));
const terrainWalls = kind.filter((k) => !['ground', 'room', 'base'].includes(k)).length;
for (const [key] of [...outsideProps, ...groundDecor]) sizeOf(key);
console.log(`src/content/maps/gale.json: ${COLS} x ${ROWS} tiles, ${zones.length} zonas, ${propObjects.length} objetos, ${decorObjects.length} adornos, ${terrainWalls} tiles de terreno que no se pisa`);
