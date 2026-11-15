// Arma el mapa inicial de la base en Gale en formato Tiled (src/content/maps/gale.json).
// Es el punto de partida: después se puede editar a mano en Tiled (https://www.mapeditor.org). OJO: volver a
// correr este script pisa esos cambios.
//
// La base sigue el plano de docs/mision_a_marte_referencias_topdown/plano-base-marte.png: módulos con forma propia
// (invernadero en cúpula, escudo de radiación, energía con MOXIE, central con el depurador, reservas, comunicaciones,
// hospital y gimnasio, taller con la esclusa) unidos por tubos aislados con plástico que se pueden romper. Afuera,
// sueltos, el depósito, la batería y la nave estacionada abajo a la izquierda, a los que se llega con traje. Los
// cables (verdes en el plano) van por el suelo de los paneles a la base, a la batería y a la nave, con dos cajas de
// empalme. Más al sur, un corte comprimido y NO a escala del camino real de Curiosity (docs/plan-visual.md, Fase 4;
// fuentes en src/content/galeTerrain.ts): llanura de Aeolis (con la base), lecho de lago de Yellowknife Bay, dunas
// Bagnold, cerros Murray y el canal Gediz Vallis al pie del monte Sharp, donde está Curiosity.
// Uso: node scripts/maps/build-gale.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { formatTiledJson } from './tiled.mjs';

const T = 48;
const COLS = 72;
/** Filas que se agregaron arriba para la base nueva: el exterior es el de antes, corrido `OFF` filas al sur. */
const OFF = 26;
const ROWS = 72 + OFF;

// --- Franjas del exterior (filas del mapa, de norte a sur) ---
const STRIPS = [
  { id: 'plain', from: 1, to: 30 + OFF },
  { id: 'lakebed', from: 31 + OFF, to: 38 + OFF },
  { id: 'dunes', from: 39 + OFF, to: 46 + OFF },
  { id: 'buttes', from: 47 + OFF, to: 56 + OFF },
  { id: 'gediz', from: 57 + OFF, to: 70 + OFF },
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

// Azar con semilla, para que el mapa salga siempre igual. El terreno sigue la secuencia del mapa anterior (que
// gastaba 468 tiradas en el piso de la base antes de las dunas) y la base usa la suya.
const lcg = (seed) => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const random = lcg(20240530);
for (let i = 0; i < 468; i++) random();
const baseRandom = lcg(0xba5e);
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
/** Qué hay en cada tile: 'room' (cuartos, tubos y puertas), 'base' (pared de la base), 'ground' o un tipo de pared del terreno. */
const kind = new Array(COLS * ROWS).fill('ground');
const put = (layer, col, row, index) => {
  layer[at(col, row)] = index + 1;
};
const inMap = (col, row) => col >= 0 && row >= 0 && col < COLS && row < ROWS;
const isBlocked = (col, row) => !inMap(col, row) || (kind[at(col, row)] !== 'ground' && kind[at(col, row)] !== 'room');
const stripAt = (row) => STRIPS.find((s) => row >= s.from && row <= s.to) ?? (row < 1 ? STRIPS[0] : STRIPS[STRIPS.length - 1]);

// --- Base ---
// Coordenadas de la base en tiles, desde (BX, BY). Las formas son polígonos con vértices en esquinas de tile (o a
// medio tile en las diagonales, para que ningún centro de tile caiga justo en el borde): un tile es del cuarto si su
// centro cae adentro (la misma regla que usa src/content/tiledLayout.ts).
const BX = 2;
const BY = 2;
/** Cuartos: id, polígono y piso. Los que comparten borde sin pared son un mismo módulo (p. ej. energía y MOXIE). */
const ROOMS = [
  // Invernadero en cúpula y escudo de radiación debajo (con la puerta entre los dos).
  { id: 'greenhouse', poly: [[10, 5.5], [12.5, 3], [16.5, 3], [19, 5.5], [19, 9], [10, 9]] },
  { id: 'shelter', poly: [[10, 10], [19, 10], [19, 12.5], [16.5, 15], [12.5, 15], [10, 12.5]], floor: 'shelter' },
  // Energía (tableros de fusibles) con MOXIE al lado, abiertos entre sí.
  { id: 'energy', poly: [[27, 4], [32, 4], [32, 12], [31.5, 12], [27, 7.5]] },
  { id: 'moxie', poly: [[32, 4], [36, 4], [36, 12], [32, 12]] },
  // Central (mando) con el rincón del depurador a la izquierda (la llave del plano).
  { id: 'command', poly: [[24, 20], [34.5, 20], [37, 22.5], [37, 30], [24, 30]] },
  { id: 'scrubber', poly: [[21, 25], [24, 25], [24, 30], [21, 30]] },
  // Reservas (cocina) y comunicaciones, pegadas a la central.
  { id: 'pantry', poly: [[38, 22], [44, 22], [44, 26], [38, 26]] },
  { id: 'radio', poly: [[38, 27], [44, 27], [44, 32], [38, 32]] },
  // Hospital y gimnasio (un módulo), el taller debajo y la esclusa en su rincón, hacia la nave.
  { id: 'infirmary', poly: [[7, 24.5], [9.5, 22], [12, 22], [12, 27], [7, 27]] },
  { id: 'exercise', poly: [[12, 22], [18, 22], [18, 27], [12, 27]] },
  { id: 'workshop', poly: [[7, 28], [18, 28], [18, 34], [11, 34], [11, 30], [7, 30]] },
  { id: 'airlock', poly: [[7, 30], [11, 30], [11, 33], [7, 33]] },
  // Afuera, sueltos: depósito, batería y la nave estacionada.
  { id: 'storage', poly: [[29, 39], [38, 39], [38, 44], [29, 44]] },
  { id: 'battery', poly: [[42, 37], [48, 37], [48, 42], [42, 42]] },
  { id: 'ship', poly: [[2, 39], [10, 39], [10, 42], [2, 42]] },
];
/** Tubos (y sus puertas, que son suyas: si el tubo se rompe se cierran). Puerta: [columna, fila, ancho, alto]. */
const TUBES = [
  { id: 'tube-greenhouse-energy', poly: [[20, 6], [26, 6], [26, 8], [20, 8]], doors: [[19, 6, 1, 2], [26, 6, 1, 2]] },
  { id: 'tube-shelter-command', poly: [[20, 11], [21.5, 11], [29, 18.5], [29, 19], [26.5, 19], [20, 12.5]], doors: [[19, 11, 1, 2], [26, 19, 2, 1]] },
  { id: 'tube-shelter-gym', poly: [[12, 16], [14, 16], [14, 21], [12, 21]], doors: [[12, 15, 2, 1], [12, 21, 2, 1]] },
  { id: 'tube-energy-command', poly: [[33, 13], [35, 13], [35, 19], [33, 19]], doors: [[33, 12, 2, 1], [33, 19, 2, 1]] },
  { id: 'tube-gym-command', poly: [[19, 22], [23, 22], [23, 24], [19, 24]], doors: [[18, 22, 1, 2], [23, 22, 1, 2]] },
  { id: 'tube-workshop-command', poly: [[19, 32], [25, 32], [25, 31], [27, 31], [27, 34], [19, 34]], doors: [[18, 32, 1, 2], [25, 30, 2, 1]] },
];
/** Puertas de los cuartos (adentro de un módulo o hacia afuera). */
const ROOM_DOORS = [
  ['greenhouse', 14, 9, 2, 1],
  ['workshop', 14, 27, 2, 1],
  ['pantry', 37, 23, 1, 2],
  ['radio', 37, 28, 1, 2],
  ['storage', 32, 44, 2, 1],
  ['battery', 44, 42, 2, 1],
  ['ship', 10, 40, 1, 2],
];
/** Puerta exterior de la esclusa (abajo, hacia la nave). */
const OUTER_DOOR = [8, 33, 2, 1];

const inPoly = (poly, x, y) => {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[i];
    const [bx, by] = poly[j];
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) hit = !hit;
  }
  return hit;
};
/** Tiles (de la base) con el centro dentro del polígono. */
const polyCells = (poly) => {
  const cells = [];
  const xs = poly.map(([x]) => x);
  const ys = poly.map(([, y]) => y);
  for (let r = Math.floor(Math.min(...ys)); r < Math.ceil(Math.max(...ys)); r++)
    for (let c = Math.floor(Math.min(...xs)); c < Math.ceil(Math.max(...xs)); c++) if (inPoly(poly, c + 0.5, r + 0.5)) cells.push([c, r]);
  return cells;
};

/** Dueño de cada tile de piso de la base (cuarto, tubo o puerta). */
const owner = new Map();
const claim = (c, r, id, tile) => {
  const [col, row] = [BX + c, BY + r];
  if (owner.has(at(col, row))) throw new Error(`El tile ${c},${r} de la base es de ${owner.get(at(col, row))} y de ${id}`);
  owner.set(at(col, row), id);
  kind[at(col, row)] = 'room';
  put(floor, col, row, tile);
};
for (const room of ROOMS)
  for (const [c, r] of polyCells(room.poly))
    claim(c, r, room.id, room.floor === 'shelter' ? SHIP.SHELTER_FLOOR : SHIP.FLOOR[Math.floor(baseRandom() * SHIP.FLOOR.length)]);
for (const tube of TUBES) for (const [c, r] of polyCells(tube.poly)) claim(c, r, tube.id, SHIP.CORRIDOR);
const doorTiles = ([c, r, w, h]) => Array.from({ length: w * h }, (_, i) => [c + (i % w), r + Math.floor(i / w)]);
for (const tube of TUBES) for (const door of tube.doors) for (const [c, r] of doorTiles(door)) claim(c, r, tube.id, SHIP.HAZARD);
for (const [id, ...door] of ROOM_DOORS) for (const [c, r] of doorTiles(door)) claim(c, r, id, SHIP.HAZARD);
for (const [c, r] of doorTiles(OUTER_DOOR)) claim(c, r, 'exterior', SHIP.HAZARD);
const outerDoor = { col: BX + OUTER_DOOR[0], row: BY + OUTER_DOOR[1] };

// Paredes: un tile alrededor de todo lo que se pisa y dos arriba (el techo y el frente de la pared, en vista 3/4).
const isFloor = (col, row) => inMap(col, row) && owner.has(at(col, row));
/** Tiles de puerta: ya están en una pared, no levantan otra. */
const doorKeys = new Set();
for (const door of [...TUBES.flatMap((t) => t.doors), ...ROOM_DOORS.map(([, ...d]) => d), OUTER_DOOR]) for (const [c, r] of doorTiles(door)) doorKeys.add(at(BX + c, BY + r));
for (const key of owner.keys()) {
  if (doorKeys.has(key)) continue;
  const [col, row] = [key % COLS, Math.floor(key / COLS)];
  for (let dr = -2; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      const [c, r] = [col + dc, row + dr];
      if (inMap(c, r) && !isFloor(c, r)) kind[at(c, r)] = 'base';
    }
}
const baseTiles = kind.flatMap((k, i) => (k === 'base' || k === 'room' ? [i] : []));
const BASE_BOX = {
  left: Math.min(...baseTiles.map((i) => i % COLS)),
  right: Math.max(...baseTiles.map((i) => i % COLS)),
  top: Math.min(...baseTiles.map((i) => Math.floor(i / COLS))),
  bottom: Math.max(...baseTiles.map((i) => Math.floor(i / COLS))),
};

// --- Terreno ---
/** Hay algo de la base a menos de `margin` tiles. */
const baseNear = (col, row, margin) => {
  for (let r = row - margin; r <= row + margin; r++)
    for (let c = col - margin; c <= col + margin; c++) if (inMap(c, r) && (kind[at(c, r)] === 'base' || kind[at(c, r)] === 'room')) return true;
  return false;
};
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
  kind[at(0, r)] = r >= 57 + OFF ? 'mount' : 'cliff';
  kind[at(COLS - 1, r)] = r >= 57 + OFF ? 'mount' : 'cliff';
}

// Gediz Vallis: el canal baja serpenteando por la ladera del monte Sharp; afuera del canal, la montaña.
const channel = (row) => {
  const k = (row - 57 - OFF) / 13;
  const center = 40 + Math.round(5 * Math.sin(k * Math.PI * 1.2));
  const half = Math.round(10 - 3 * k);
  return { from: center - half, to: center + half };
};
for (let r = 57 + OFF; r < ROWS; r++) {
  const { from, to } = channel(r);
  for (let c = 0; c < COLS; c++) if (r >= 68 + OFF || c < from || c > to) kind[at(c, r)] = 'mount';
}

// Dunas Bagnold: crestas de 2 filas (cresta y cara de avalancha) separadas, con pasos entre ellas.
for (let tries = 0, placed = 0; tries < 400 && placed < 9; tries++) {
  const w = 4 + Math.floor(random() * 6);
  const col = 2 + Math.floor(random() * (COLS - w - 4));
  const row = 40 + OFF + Math.floor(random() * 5);
  if (!free(col, row, w, 2, 2)) continue;
  block(col, row, w, 2, 'dune');
  placed++;
}
// Cerros Murray: mesetas de capas, de 4–7 × 3–4 tiles.
for (let tries = 0, placed = 0; tries < 600 && placed < 8; tries++) {
  const w = 4 + Math.floor(random() * 4);
  const h = 3 + Math.floor(random() * 2);
  const col = 3 + Math.floor(random() * (COLS - w - 6));
  const row = 48 + OFF + Math.floor(random() * (54 - h - 48 + 2));
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
const curiosityRow = 63 + OFF;
const curiosityCol = Math.round((channel(curiosityRow).from + channel(curiosityRow).to) / 2) + 3;
const sulfur = { col: curiosityCol - 6, row: curiosityRow - 2, cols: 5, rows: 3 };

// Montículos de bloques en el centro del canal (los dejaron las crecidas y las avalanchas).
for (let tries = 0, placed = 0; tries < 400 && placed < 6; tries++) {
  const w = 1 + Math.floor(random() * 2);
  const h = 1 + Math.floor(random() * 2);
  const row = 58 + OFF + Math.floor(random() * 8);
  const { from, to } = channel(row);
  const col = from + 3 + Math.floor(random() * Math.max(1, to - from - 5));
  const nearCuriosity = col + w > sulfur.col - 1 && col <= curiosityCol + 2 && row + h > sulfur.row - 1 && row <= curiosityRow + 2;
  if (nearCuriosity || !free(col, row, w, h, 2)) continue;
  for (let r = row; r < row + h; r++) for (let c = col; c < col + w; c++) rockOn('block', c, r);
  placed++;
}
// Afuera de la base: dos filas de paneles solares (los más usados, con polvo) a la derecha de Energía, la antena junto
// a comunicaciones y dos balizas junto a la puerta de la esclusa.
for (let row = 0; row < 2; row++)
  for (let i = 0; i < 6; i++) placeOutside((i + row) % 3 === 1 ? 'solar' : 'solar-dusty', (BX + 39 + i * 2) * T, (BY + 4 + row * 3) * T - 4, 64, 24);
placeOutside('antenna', (BX + 47.5) * T, (BY + 31) * T - 4, 40, 24);
for (const dc of [-1.5, 3.5]) placeOutside('beacon', (outerDoor.col + dc) * T, outerDoor.row * T + 2 * T + 30, 20, 14);
// Rocas sueltas en la llanura y en el lecho de lago, lejos de la base y de la puerta.
for (let tries = 0, placed = 0; tries < 800 && placed < 26; tries++) {
  const col = 2 + Math.floor(random() * (COLS - 4));
  const row = 3 + Math.floor(random() * (35 + OFF));
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

// Piso de todo el mapa (también debajo de las paredes).
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
    put(floor, c, r, groundTile(c, Math.min(ROWS - 1, r + (r > 3 + OFF && r < 57 + OFF ? shift : 0))));
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
  const along = roomAt(c, r - 1) || roomAt(c, r + 1) || baseFace(c, r + 1) || baseFace(c, r - 1);
  if (side && !along) return SHIP.CAP_PIPES_V;
  if (along && !side) return baseRandom() < 0.15 ? SHIP.CAP : SHIP.CAP_PIPES_H;
  return SHIP.CAP;
};
const tubeIds = new Set(TUBES.map((t) => t.id));
for (let r = 0; r < ROWS; r++)
  for (let c = 0; c < COLS; c++) {
    const what = kind[at(c, r)];
    if (what === 'ground' || what === 'room' || what === 'prop') continue;
    const faces = r + 1 < ROWS && !isBlocked(c, r + 1);
    if (what === 'base') {
      const inside = roomAt(c, r + 1);
      // Frente de un tubo: liso, con caños; el de los cuartos lleva luces y rejillas.
      const tube = inside && tubeIds.has(owner.get(at(c, r + 1)));
      if (!faces) put(walls, c, r, baseCap(c, r));
      else if (!inside || tube) put(walls, c, r, baseRandom() < 0.25 ? SHIP.FACE_PIPES : SHIP.FACE);
      else put(walls, c, r, (c - BX) % 4 === 2 ? SHIP.FACE_LIGHT : baseRandom() < 0.14 ? SHIP.FACE_VENT : baseRandom() < 0.1 ? SHIP.FACE_PIPES : SHIP.FACE);
    } else put(walls, c, r, FAMILY[what][faces ? 1 : 0]);
  }
// Marcos de las puertas horizontales (de dos tiles, en una pared de un tile de alto con piso arriba y abajo).
const horizontalDoors = [
  ...TUBES.flatMap((t) => t.doors),
  ...ROOM_DOORS.map(([, ...d]) => d),
  OUTER_DOOR,
].filter(([, , w, h]) => w === 2 && h === 1);
for (const [c, r] of horizontalDoors) {
  const [col, row] = [BX + c, BY + r];
  if (kind[at(col - 1, row)] === 'base') put(walls, col - 1, row, SHIP.PILLAR_RIGHT);
  if (kind[at(col + 2, row)] === 'base') put(walls, col + 2, row, SHIP.PILLAR_LEFT);
}

// Todo el exterior transitable tiene que poder alcanzarse desde la puerta de la esclusa, salvo los patios que dejan
// los tubos entre los módulos (encerrados por la base: se ven pero no se pisan).
const courtyards = [];
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
  const inBox = (i) => {
    const [c, r] = [i % COLS, Math.floor(i / COLS)];
    return c >= BASE_BOX.left && c <= BASE_BOX.right && r >= BASE_BOX.top && r <= BASE_BOX.bottom;
  };
  const lost = kind.flatMap((k, i) => (k === 'ground' && !seen.has(i) ? [i] : []));
  const outside = lost.filter((i) => !inBox(i));
  if (outside.length) throw new Error(`Hay ${outside.length} tiles del exterior a los que no se llega desde la esclusa: ${outside.slice(0, 8).map((i) => `${i % COLS},${Math.floor(i / COLS)}`).join(' ')}`);
  courtyards.push(...lost);
}

// --- Objetos de la base ---
// [sprite, columna del centro, fila del borde de abajo], en tiles de la base (desde BX, BY).
const PROPS = [
  // Invernadero: gabinetes de cultivo con luz violeta, el monitor de plantas y dos canteros.
  ['growcabinet', 11.3, 7.2], ['growcabinet', 17.4, 5.4], ['plantmonitor', 14.5, 4.6], ['greenhouse', 12, 8.9], ['greenhouse', 17, 8.9],
  // Escudo de radiación: tanques de agua a los costados.
  ['tank', 10.7, 12.4], ['tank', 11.7, 12.4], ['tank', 17.3, 12.4], ['tank', 18.3, 12.4],
  // Energía: tableros (monitores y cables) y MOXIE con su bomba.
  ['monitors', 28.7, 5.8], ['cables', 30.9, 5.6], ['console', 31, 10.3],
  ['moxie', 34, 6.4], ['tank', 35.5, 9.6], ['canisters', 33.4, 10.9],
  // Central: timón y asiento, mesa holográfica, sillón y consolas.
  ['helm', 30.5, 21.9], ['seat', 30.5, 23.1], ['plant', 24.6, 21.6], ['console', 35.9, 26.6], ['holotable', 30.5, 27.8], ['couch', 33, 29.9], ['crate', 24.9, 29.9],
  // Depurador de CO2 en su rincón.
  ['scrubber', 22.5, 26.4],
  // Reservas: estante y cajas (la receta está en la pantalla de la pared).
  ['shelf', 39.3, 23.4], ['crates', 42.7, 25.9],
  // Comunicaciones.
  ['commsdesk', 39.5, 31.9], ['radio', 42.2, 31.9], ['radar', 43.2, 28.9],
  // Hospital y gimnasio.
  ['bed', 8.4, 25], ['bed', 8.4, 26.9], ['medcabinet', 11.2, 23.2], ['bike', 15.8, 24], ['treadmill', 12.8, 26.9], ['plant', 17.4, 23.4],
  // Taller (herramientas y repuestos) y la esclusa con los trajes.
  ['crates', 16.5, 29.6], ['dustcrate', 12.9, 29.5], ['seedcart', 15.5, 33.9], ['suitrack', 7.9, 31.8],
  // Depósito: estantes con suministros y muestras.
  ['shelf', 30.3, 40.5], ['shelf', 32.5, 40.5], ['crates', 36.4, 40.6], ['sampletube', 35, 43.4], ['crate', 30.2, 43.8],
  // Batería: celdas en fila.
  ['tank', 42.6, 39], ['tank', 43.6, 39], ['tank', 46.4, 39], ['tank', 47.4, 39],
  // Nave: asientos de la cabina.
  ['helm', 2.9, 40.9], ['seat', 4.8, 40.6], ['seat', 6.6, 40.6],
];
// Colgados del frente de la pared de arriba (sin colisión): [sprite, columna del centro, fila del piso de abajo].
const WALL_DECOR = [
  ['bigwindow', 14.5, 3], ['warnscreen', 17, 10], ['alarm', 11.5, 10], ['wallscreen', 29.5, 4], ['alarm', 31, 4], ['redlight', 34, 4],
  ['bigwindow', 30.5, 20], ['alarm', 25.5, 20], ['wallscreen', 41.5, 22], ['alarm', 40.5, 27], ['alarm', 10, 22], ['window', 15.5, 22],
  ['alarm', 9, 28], ['redlight', 22.5, 25], ['alarm', 33, 39], ['redlight', 45, 37], ['window', 6, 39],
];
// Donde se para quien trabaja en cada cuarto.
const SPOTS = {
  greenhouse: [14.5, 6.8], shelter: [14.5, 12.8], energy: [29.4, 7.2], moxie: [34, 8.2], command: [28.3, 24.6], scrubber: [22.5, 28.2],
  pantry: [40.5, 24.8], radio: [41, 29.8], infirmary: [10.4, 25.4], exercise: [14.7, 25.2], workshop: [14.5, 31.4], airlock: [9.6, 31.6],
  storage: [33, 42.3], battery: [45, 40.4], ship: [6.5, 41.4],
};
/** Puntos con nombre: la receta de la cocina (pantalla de la pared de reservas) y las cajas de empalme de los cables. */
const LANDMARKS = [['recipe', 41.5, 23], ['j1', 52.5, 20], ['j2', 14.5, 46.5]];
/** Cables (verdes en el plano), con los nodos que unen: paneles, base, batería, nave y las dos cajas de empalme. */
const CABLES = [
  { id: 'cable-solar-base', from: 'solar', to: 'base', points: [[38, 5.4], [38, 0.6], [20.4, 0.6], [19.4, 2.6]] },
  { id: 'cable-solar-j1', from: 'solar', to: 'j1', points: [[51.6, 5.4], [52.5, 5.4], [52.5, 20]] },
  { id: 'cable-j1-battery', from: 'j1', to: 'battery', points: [[52.5, 20], [52.5, 38.5], [48.6, 38.5]] },
  { id: 'cable-battery-base', from: 'battery', to: 'base', points: [[42.4, 36.4], [42.4, 34], [43, 32.6]] },
  { id: 'cable-battery-j2', from: 'battery', to: 'j2', points: [[45, 42.6], [45, 46.5], [14.5, 46.5]] },
  { id: 'cable-j2-base', from: 'j2', to: 'base', points: [[14.5, 46.5], [14.5, 34.6]] },
  { id: 'cable-j2-ship', from: 'j2', to: 'ship', points: [[14.5, 46.5], [5, 46.5], [5, 42.6]] },
  { id: 'cable-ship-base', from: 'ship', to: 'base', points: [[3, 38.4], [3, 24.5], [6.4, 24.5]] },
];

let nextId = 1;
const object = (name, type, x, y, width = 0, height = 0, extra = {}) => ({
  id: nextId++,
  name,
  type,
  x,
  y,
  width,
  height,
  rotation: 0,
  visible: true,
  ...(width === 0 && height === 0 && !extra.polygon && !extra.polyline ? { point: true } : {}),
  ...extra,
});
const px = (c) => (BX + c) * T;
const py = (r) => (BY + r) * T;
const polygonObject = (name, type, poly) => {
  const [x0, y0] = [px(poly[0][0]), py(poly[0][1])];
  return object(name, type, x0, y0, 0, 0, { polygon: poly.map(([c, r]) => ({ x: px(c) - x0, y: py(r) - y0 })) });
};
const doorObject = (name, [c, r, w, h]) => object(name, 'door', px(c), py(r), w * T, h * T);
const zoneObjects = [
  ...TUBES.map((t) => polygonObject(t.id, 'tube', t.poly)),
  ...TUBES.flatMap((t) => t.doors.map((d) => doorObject(t.id, d))),
  ...ROOMS.map((room) => polygonObject(room.id, 'zone', room.poly)),
  ...ROOM_DOORS.map(([id, ...d]) => doorObject(id, d)),
  ...Object.entries(SPOTS).map(([id, [c, r]]) => object(id, 'spot', px(c), py(r))),
  object('', 'spawn', px(SPOTS.command[0]), py(SPOTS.command[1])),
  // El exterior es todo el mapa menos el borde: la base, las paredes y el terreno que no se pisa quedan fuera por la
  // máscara (capa `paredes`, src/content/tiledLayout.ts).
  object('', 'exterior', T, T, (COLS - 2) * T, (ROWS - 2) * T),
  doorObject('exterior', OUTER_DOOR),
  ...STRIPS.map((s) => object(s.id, 'terrain', 0, s.from * T, COLS * T, (s.to - s.from + 1) * T)),
  object('curiosity', 'landmark', (curiosityCol + 0.5) * T, (curiosityRow + 0.5) * T),
  ...LANDMARKS.map(([name, c, r]) => object(name, 'landmark', px(c), py(r))),
  ...CABLES.map((cable) => {
    const [x0, y0] = [px(cable.points[0][0]), py(cable.points[0][1])];
    return object(cable.id, 'cable', x0, y0, 0, 0, {
      polyline: cable.points.map(([c, r]) => ({ x: px(c) - x0, y: py(r) - y0 })),
      properties: [{ name: 'from', type: 'string', value: cable.from }, { name: 'to', type: 'string', value: cable.to }],
    });
  }),
];
const propObjects = [];
const decorObjects = [];
for (const [key, col, row] of PROPS) {
  const { w, h } = sizeOf(key);
  // Lo que choca es la base del objeto: casi todo el ancho y menos de la mitad del alto.
  const width = Math.round(w * 0.86);
  const height = Math.round(Math.min(h * 0.42, 40));
  propObjects.push(object('', key, Math.round(px(col) - width / 2), Math.round(py(row) - height), width, height));
}
for (const [key, col, row] of WALL_DECOR) decorObjects.push(object('', key, Math.round(px(col)), py(row) - 6));
for (const [key, cx, bottom, w, h] of outsideProps) propObjects.push(object('', key, Math.round(cx - w / 2), Math.round(bottom - h), w, h));
for (const [key, x, y] of groundDecor) decorObjects.push(object('', key, x, y));

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
console.log(
  `src/content/maps/gale.json: ${COLS} x ${ROWS} tiles, ${ROOMS.length} cuartos, ${TUBES.length} tubos, ${CABLES.length} cables, ${propObjects.length} objetos, ${decorObjects.length} adornos, ${terrainWalls} tiles de terreno que no se pisa, ${courtyards.length} de patios entre tubos`,
);
// Vista rápida de la base en texto (con `--ascii`): letra de cada cuarto, números de los tubos, # pared, . suelo.
if (process.argv.includes('--ascii')) {
  const letters = new Map([...ROOMS.map((r, i) => [r.id, 'ABCDEFGHIJKLMNOPQRS'[i]]), ...TUBES.map((t, i) => [t.id, String(i + 1)]), ['exterior', 'X']]);
  for (let r = BASE_BOX.top - 1; r <= BASE_BOX.bottom + 1; r++) {
    let line = '';
    for (let c = BASE_BOX.left - 1; c <= BASE_BOX.right + 1; c++) {
      const id = owner.get(at(c, r));
      line += id ? letters.get(id) : kind[at(c, r)] === 'base' ? '#' : kind[at(c, r)] === 'prop' ? 'o' : courtyards.includes(at(c, r)) ? ',' : '.';
    }
    console.log(line);
  }
}
