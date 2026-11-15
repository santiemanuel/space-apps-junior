import type { BikeGame, MoxieGame, PulseGame, RadioGame, ScrubberGame } from '../../../../core/minigames/arcade';
import type { Minigame, MinigameId } from '../../../../core/minigames/Minigame';
import type { PatchGame, StarsGame, WaterGame } from '../../../../core/minigames/puzzles';
import { DUST_LAYERS, type DustGame, type NightGame } from '../../../../core/minigames/outpost';
import { FUSE_TYPES, type FusesGame, type WireColor, type WiresGame } from '../../../../core/minigames/power';
import { SIDE } from '../../../../core/minigames/puzzles';
import { PLANT_TOOLS, type MealGame, type PlantsGame, type SealsGame, type ShieldGame, HarvestGame } from '../../../../core/minigames/rooms';
import { t, type TranslationKey, type TranslationParams } from '../../../../i18n';
import type { Painter } from './Painter';

/** Zona de juego dentro del cartel (px de pantalla). */
export interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Renderer<G extends Minigame> = (p: Painter, game: G, a: Area, now: number) => void;

const tr = (key: string, params?: TranslationParams) => t(key as TranslationKey, params);
const PANEL = 0x161b2e;
const EDGE = 0x05070d;
const METAL = 0x4a5070;
const METAL_LIGHT = 0x8a90b8;
const GREEN = 0x68d391;
const RED = 0xfc8181;
const AMBER = 0xf6ad55;
const BLUE = 0x63b3ed;

/** Ruido determinista (sin `Math.random`): para el chisporroteo de la radio y el aire de la fuga. */
const noise = (x: number, y = 0) => {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/** Recuadro de pantalla hundida, con borde de un píxel de arte. */
function screen(p: Painter, x: number, y: number, w: number, h: number, fill = 0x0b1020): void {
  p.g.fillStyle(EDGE).fillRect(x - 3, y - 3, w + 6, h + 6);
  p.g.fillStyle(METAL).fillRect(x - 1, y - 1, w + 2, h + 2);
  p.g.fillStyle(fill).fillRect(x, y, w, h);
}

function cursor(p: Painter, x: number, y: number, w: number, h: number, now: number): void {
  const pulse = 0.6 + 0.4 * Math.sin(now / 130);
  p.top.lineStyle(4, EDGE, 0.8).strokeRect(x - 2, y - 2, w + 4, h + 4);
  p.top.lineStyle(3, 0xf6e05e, pulse).strokeRect(x, y, w, h);
  p.focus(x + w / 2, y + h / 2);
}

/** Tiembla un rato después de `at` (error). */
const shake = (game: Minigame, at: number | null) => (at !== null && game.elapsed - at < 0.4 ? Math.sin((game.elapsed - at) * 60) * 5 : 0);

const bike: Renderer<BikeGame> = (p, game, a) => {
  const bx = a.x + 200;
  const by = a.y + a.h / 2 + 10;
  // Líneas de velocidad detrás de la bici (al terminar se va el viento: la bici quedó quieta).
  for (let i = 0; i < (game.done ? 0 : 6); i++) {
    const len = 30 + 120 * game.speed;
    const y = by - 60 + i * 24;
    const x = bx - 120 - ((game.distance * 140 + i * 47) % 80);
    const left = Math.max(a.x, x - len);
    if (x > left) p.g.fillStyle(BLUE, 0.25 + 0.5 * game.speed).fillRect(left, y, x - left, 4);
  }
  p.image('bike', bx, by + Math.sin(game.distance * 9) * 3 * game.speed, { scale: 3 });
  // Velocímetro: medio círculo con la franja verde.
  const cx = a.x + a.w - 210;
  const cy = a.y + a.h - 70;
  const r = 130;
  const arc = (from: number, to: number, color: number, width: number) =>
    p.g.lineStyle(width, color).beginPath().arc(cx, cy, r, Math.PI + from * Math.PI, Math.PI + to * Math.PI).strokePath();
  arc(0, 1, EDGE, 30);
  arc(0, game.band.min, 0x4a5568, 22);
  arc(game.band.min, game.band.max, GREEN, 22);
  arc(game.band.max, 1, RED, 22);
  const angle = Math.PI + game.speed * Math.PI;
  p.top.lineStyle(8, EDGE).lineBetween(cx, cy, cx + Math.cos(angle) * (r - 4), cy + Math.sin(angle) * (r - 4));
  p.top.lineStyle(4, 0xf7fafc).lineBetween(cx, cy, cx + Math.cos(angle) * (r - 6), cy + Math.sin(angle) * (r - 6));
  p.top.fillStyle(EDGE).fillCircle(cx, cy, 12).fillStyle(AMBER).fillCircle(cx, cy, 8);
  // La tecla que toca ahora se enciende.
  const next = game.last === 'left' ? 'right' : game.last === 'right' ? 'left' : null;
  p.key('←', cx - 40, cy + 40, next !== 'right');
  p.key('→', cx + 40, cy + 40, next !== 'left');
  p.focus(bx, by);
};

const scrubber: Renderer<ScrubberGame> = (p, game, a) => {
  const f = { x: a.x + 60, y: a.y + 6, w: a.w - 120, h: a.h - 12 };
  screen(p, f.x, f.y, f.w, f.h, 0x0e1428);
  // Abajo, la cabina: lo que pasa el filtro lo respira la tripulación.
  p.g.fillStyle(0x1f3a5a).fillRect(f.x, f.y + f.h - 22, f.w, 22);
  for (const m of game.molecules) {
    const caught = m.caughtS !== null;
    const k = caught ? 1 - m.caughtS! / 0.35 : 1;
    p.image(m.kind, f.x + m.x * f.w, f.y + m.y * f.h, { scale: 1.2 * k, alpha: caught ? k : 1 });
  }
  const fx = f.x + game.filterX * f.w;
  const fy = f.y + 0.86 * f.h + 18;
  p.image('cartridge', fx, fy, { scale: 1.5 });
  p.focus(fx, fy);
  p.text(`CO2 ${game.caught} / ${game.goal}`, f.x + 12, f.y + 10, { size: 16, color: '#fbd38d' });
};

const water: Renderer<WaterGame> = (p, game, a, now) => {
  const cell = Math.min(78, Math.floor((a.w - 300) / game.cols), Math.floor((a.h - 10) / game.rows));
  const gx = a.x + (a.w - cell * game.cols) / 2;
  const gy = a.y + (a.h - cell * game.rows) / 2;
  const flowing = new Set(game.flow.cells);
  const pipe = (cx: number, cy: number, dx: number, dy: number, wet: boolean) => {
    const half = cell / 2;
    const [x1, y1] = [cx + dx * half, cy + dy * half];
    p.g.lineStyle(22, EDGE).lineBetween(cx, cy, x1, y1);
    p.g.lineStyle(16, METAL_LIGHT).lineBetween(cx, cy, x1, y1);
    p.g.lineStyle(8, wet ? BLUE : 0x2d3748).lineBetween(cx, cy, x1, y1);
  };
  for (let row = 0; row < game.rows; row++) {
    for (let col = 0; col < game.cols; col++) {
      const i = row * game.cols + col;
      const x = gx + col * cell;
      const y = gy + row * cell;
      p.g.fillStyle(EDGE).fillRect(x, y, cell, cell);
      p.g.fillStyle(PANEL).fillRect(x + 2, y + 2, cell - 4, cell - 4);
      p.g.fillStyle(METAL).fillRect(x + 6, y + 6, 4, 4).fillRect(x + cell - 10, y + 6, 4, 4).fillRect(x + 6, y + cell - 10, 4, 4).fillRect(x + cell - 10, y + cell - 10, 4, 4);
      const sides = game.sides(i);
      const [cx, cy] = [x + cell / 2, y + cell / 2];
      const wet = flowing.has(i);
      for (const [side, dx, dy] of [[SIDE.N, 0, -1], [SIDE.E, 1, 0], [SIDE.S, 0, 1], [SIDE.W, -1, 0]] as const) if (sides & side) pipe(cx, cy, dx, dy, wet);
      p.g.fillStyle(EDGE).fillCircle(cx, cy, 12).fillStyle(METAL_LIGHT).fillCircle(cx, cy, 9).fillStyle(wet ? BLUE : 0x2d3748).fillCircle(cx, cy, 5);
      if (game.cells[i]!.filter) p.image('filter', cx, cy, { scale: 0.5 });
      // Burbujas que avanzan por el agua.
      if (wet) p.top.fillStyle(0xbee3f8, 0.8).fillCircle(cx + Math.sin(now / 200 + i) * 6, cy + Math.cos(now / 240 + i) * 6, 3);
    }
  }
  const inY = gy + (game.entryRow + 0.5) * cell;
  const outY = gy + (game.exitRow + 0.5) * cell;
  pipe(gx - cell / 2, inY, 1, 0, true);
  pipe(gx + game.cols * cell + cell / 2, outY, -1, 0, game.flow.solved);
  p.image('dirtybag', gx - cell / 2 - 50, inY, { scale: 1 });
  p.image('cleantank', gx + game.cols * cell + cell / 2 + 50, outY, { scale: 1, tint: game.flow.solved ? 0xffffff : 0x9aa0b8 });
  cursor(p, gx + game.cursor.col * cell + 3, gy + game.cursor.row * cell + 3, cell - 6, cell - 6, now);
};

const radio: Renderer<RadioGame> = (p, game, a, now) => {
  p.image('dish', a.x + 90, a.y + a.h / 2 - 20, { scale: 2.5 });
  p.focus(a.x + 90, a.y + a.h / 2);
  const s = { x: a.x + 200, y: a.y + 10, w: a.w - 220, h: 190 };
  screen(p, s.x, s.y, s.w, s.h, 0x08140f);
  const q = game.quality;
  const mid = s.y + s.h / 2;
  p.g.lineStyle(1, 0x1c4532).lineBetween(s.x, mid, s.x + s.w, mid);
  p.g.lineStyle(3, q > 0.75 ? GREEN : 0x9ae6b4, 0.9).beginPath();
  for (let x = 0; x <= s.w; x += 4) {
    const clean = Math.sin(x / 22 - now / 120) * 50;
    const hiss = (noise(x, Math.floor(now / 60)) - 0.5) * 140;
    const y = mid + clean * (0.3 + 0.7 * q) + hiss * (1 - q);
    if (x === 0) p.g.moveTo(s.x + x, y);
    else p.g.lineTo(s.x + x, y);
  }
  p.g.strokePath();
  // Barras de señal.
  for (let i = 0; i < 5; i++) {
    const on = q > i / 5 + 0.05;
    p.g.fillStyle(on ? GREEN : 0x2d3748).fillRect(s.x + s.w - 80 + i * 14, s.y + s.h - 14 - (i + 1) * 9, 10, (i + 1) * 9);
  }
  // Dial.
  const d = { x: s.x, y: s.y + s.h + 46, w: s.w - 70 };
  p.g.fillStyle(EDGE).fillRect(d.x - 2, d.y - 10, d.w + 4, 20);
  p.g.fillStyle(0x2d3748).fillRect(d.x, d.y - 8, d.w, 16);
  for (let i = 0; i <= 20; i++) p.g.fillStyle(0x718096).fillRect(d.x + (i / 20) * d.w - 1, d.y - (i % 5 ? 4 : 8), 2, i % 5 ? 8 : 16);
  const kx = d.x + game.dial * d.w;
  p.top.fillStyle(EDGE).fillRect(kx - 10, d.y - 22, 20, 44);
  p.top.fillStyle(AMBER).fillRect(kx - 7, d.y - 19, 14, 38);
  p.key('←', d.x - 44, d.y);
  p.key('→', d.x + d.w + 44, d.y);
  // La señal se corrió: una flecha que titila señala hacia dónde girar el dial para volver a encontrarla.
  const hint = game.hint;
  if (hint && Math.floor(now / 250) % 2 === 0) {
    const dir = hint === 'right' ? 1 : -1;
    const ax = kx + dir * 34;
    p.top.fillStyle(GREEN).fillTriangle(ax + dir * 16, d.y, ax, d.y - 12, ax, d.y + 12);
    p.top.fillStyle(GREEN).fillRect(dir > 0 ? ax - 14 : ax, d.y - 4, 14, 8);
  }
};

const stars: Renderer<StarsGame> = (p, game, a) => {
  const drawSky = (cx: number, cy: number, r: number, angle: number, lines: number, others: boolean, scale: number) => {
    p.g.fillStyle(EDGE).fillCircle(cx, cy, r + 6).fillStyle(METAL).fillCircle(cx, cy, r + 3).fillStyle(0x070a18).fillCircle(cx, cy, r);
    const rad = (angle * Math.PI) / 180;
    const at = (pt: { x: number; y: number }) => ({ x: cx + (pt.x * Math.cos(rad) - pt.y * Math.sin(rad)) * r * 2, y: cy + (pt.x * Math.sin(rad) + pt.y * Math.cos(rad)) * r * 2 });
    if (others) for (const o of game.others) p.g.fillStyle(0xcbd5e0, 0.8).fillRect(at(o).x - 2, at(o).y - 2, 4, 4);
    const pts = game.pattern.map(at);
    if (lines) {
      p.g.lineStyle(2, 0x90cdf4, lines).beginPath().moveTo(pts[0]!.x, pts[0]!.y);
      for (const pt of [...pts.slice(1), pts[0]!]) p.g.lineTo(pt.x, pt.y);
      p.g.strokePath();
    }
    for (const pt of pts) p.image('star', pt.x, pt.y, { scale });
  };
  const ref = { x: a.x + 130, y: a.y + a.h / 2 + 10 };
  drawSky(ref.x, ref.y, 100, 0, 0.6, false, 0.35);
  p.text(tr('hud.minigame.stars.reference'), ref.x, a.y + 6, { size: 13, color: '#90cdf4', originX: 0.5 });
  const cam = { x: a.x + a.w - 230, y: a.y + a.h / 2 + 10 };
  const near = Math.abs(game.offset) <= game.tolerance;
  // En la cámara las líneas apenas se ven: ayudan a reconocer la forma sin regalar la respuesta.
  drawSky(cam.x, cam.y, 150, game.angle, near ? 0.6 : 0.18, true, 0.45);
  p.top.lineStyle(4, near ? GREEN : 0x4a5568).strokeCircle(cam.x, cam.y, 156);
  p.top.lineStyle(2, near ? GREEN : 0x718096, 0.7).lineBetween(cam.x - 20, cam.y, cam.x + 20, cam.y).lineBetween(cam.x, cam.y - 20, cam.x, cam.y + 20);
  p.text(tr('hud.minigame.stars.camera'), cam.x, a.y + 6 - 12, { size: 13, color: '#90cdf4', originX: 0.5 });
  for (let i = 0; i < game.rounds; i++) p.image('star', a.x + 330 + i * 40, a.y + a.h - 10, { scale: 0.3, tint: i < game.round ? 0xffffff : 0x3a4060 });
  p.focus(cam.x, cam.y);
};

const pulse: Renderer<PulseGame> = (p, game, a) => {
  const next = game.beats.find((b) => b.result === null);
  const beatK = next ? Math.max(0, 1 - Math.abs(next.t - game.elapsed) * 4) : 0;
  p.image('heart', a.x + 80, a.y + a.h / 2, { scale: 1.6 + beatK * 0.35 });
  p.image('stethoscope', a.x + 80, a.y + a.h - 30, { scale: 1 });
  const s = { x: a.x + 170, y: a.y + 20, w: a.w - 190, h: a.h - 60 };
  screen(p, s.x, s.y, s.w, s.h, 0x061410);
  for (let x = 0; x < s.w; x += 30) p.g.fillStyle(0x0f2a20).fillRect(s.x + x, s.y, 1, s.h);
  const lineX = s.x + 120;
  const speed = 170;
  const base = s.y + s.h * 0.62;
  p.g.fillStyle(game.window > 0.2 ? 0x22543d : 0x1c4532).fillRect(lineX - game.window * speed, s.y, game.window * speed * 2, s.h);
  p.g.lineStyle(3, 0x48bb78).beginPath().moveTo(s.x, base);
  const spike = (dx: number) => (dx < -10 || dx > 14 ? 0 : dx < -4 ? (dx + 10) * 2 : dx < 2 ? 12 - (dx + 4) * 18 : dx < 8 ? -96 + (dx - 2) * 24 : 48 - (dx - 8) * 8);
  for (let x = 0; x <= s.w; x += 2) {
    const t = game.elapsed + (s.x + x - lineX) / speed;
    const b = game.beats.find((beat) => Math.abs(beat.t - t) * speed < 16);
    const y = b ? base + spike((t - b.t) * speed) : base;
    p.g.lineTo(s.x + x, y);
  }
  p.g.strokePath();
  for (const b of game.beats) {
    const x = lineX + (b.t - game.elapsed) * speed;
    if (x < s.x || x > s.x + s.w || !b.result) continue;
    p.top.fillStyle(b.result === 'hit' ? GREEN : RED).fillCircle(x, s.y + 16, 6);
  }
  p.top.lineStyle(3, 0xf6e05e).lineBetween(lineX, s.y, lineX, s.y + s.h);
  p.text(tr('hud.minigame.pulse.bpm', { bpm: game.bpm }), s.x + s.w - 10, s.y + 10, { size: 14, color: '#9ae6b4', originX: 1 });
  p.text(`${game.hits} / ${game.goal}`, s.x + 10, s.y + s.h - 26, { size: 16, color: '#fbd38d' });
  p.focus(lineX, base);
};

/** Nombre traducido de un ingrediente o de una comida. */
const ingredientName = (id: string) => tr(`hud.minigame.meal.ingredient.${id}`);
const dishName = (id: string) => tr(`hud.minigame.meal.dish.${id}`);

/** Hoja de papel (el recetario y el menú). */
function paper(p: Painter, x: number, y: number, w: number, h: number): void {
  p.g.fillStyle(EDGE).fillRect(x - 3, y - 3, w + 6, h + 6);
  p.g.fillStyle(0xf3e7c9).fillRect(x, y, w, h);
  p.g.fillStyle(0xd9c79f).fillRect(x, y + h - 6, w, 6);
}

/** Menú del día: la comida, en la mesada; la receta está en el recetario. */
function mealMenu(p: Painter, game: MealGame, a: Area, now: number): void {
  const cx = a.x + 200;
  const cy = a.y + a.h / 2;
  p.g.fillStyle(0xf6ad55, 0.12 + 0.05 * Math.sin(now / 300)).fillCircle(cx, cy, 130);
  p.image(`dish-${game.dish}`, cx, cy, { scale: 1.6 });
  const tx = a.x + 380;
  p.text(tr('hud.minigame.meal.menu.today'), tx, a.y + 40, { size: 16, color: '#a0aec0' });
  p.text(dishName(game.dish), tx, a.y + 66, { size: 30, color: '#fbd38d', wrap: a.w - 400 });
  p.text(tr('hud.minigame.meal.menu.next'), tx, a.y + 140, { size: 16, color: '#e2e8f0', wrap: a.w - 400 });
  p.key('E', tx + 90, a.y + 260, Math.sin(now / 250) > 0);
  p.text(tr('hud.minigame.meal.ok'), tx + 120, a.y + 250, { size: 15, color: '#fbd38d' });
  p.focus(cx, cy);
}

/** Recetario abierto: la comida a la izquierda y los pasos en orden a la derecha. */
function mealRecipe(p: Painter, game: MealGame, a: Area, now: number): void {
  const page = { y: a.y + 4, h: a.h - 8, w: (a.w - 40) / 2 };
  const left = a.x + 16;
  const right = left + page.w + 8;
  paper(p, left, page.y, page.w + 8 + page.w, page.h);
  p.g.fillStyle(0xb8a37a).fillRect(right - 6, page.y, 4, page.h);
  p.text(tr('hud.minigame.meal.recipe.title'), left + page.w / 2, page.y + 14, { size: 14, color: '#7b5e3b', originX: 0.5 });
  p.text(dishName(game.dish), left + page.w / 2, page.y + 36, { size: 24, color: '#2d3748', originX: 0.5, wrap: page.w - 20, align: 'center' });
  p.image(`dish-${game.dish}`, left + page.w / 2, page.y + 190, { scale: 1.2 });
  const row = Math.min(56, (page.h - 30) / game.recipe.length);
  game.recipe.forEach((id, i) => {
    const y = page.y + 22 + i * row + row / 2;
    p.g.fillStyle(0x2d3748).fillCircle(right + 30, y, 14);
    p.text(String(i + 1), right + 30, y, { size: 16, color: '#fbd38d', originX: 0.5, originY: 0.5 });
    p.image(`ing-${id}`, right + 88, y, { scale: 0.65 });
    p.text(ingredientName(id), right + 130, y, { size: 18, color: '#2d3748', originY: 0.5 });
  });
  p.focus(right + 120, page.y + 120 + Math.sin(now / 900) * 40);
}

/** Mesada: los doce ingredientes y, al lado, la olla con los pasos de la receta (de memoria). */
function mealCook(p: Painter, game: MealGame, a: Area, now: number): void {
  const cw = 100;
  const ch = 104;
  const gx = a.x + 4;
  const gy = a.y + (a.h - ch * game.rows) / 2;
  screen(p, gx, gy, cw * game.cols, ch * game.rows, 0x1d2238);
  const hint = game.hintIndex;
  game.shelf.forEach((id, i) => {
    const col = i % game.cols;
    const row = Math.floor(i / game.cols);
    const x = gx + col * cw;
    const y = gy + row * ch;
    const wrong = game.wrong?.index === i && game.elapsed - game.wrong.at < 0.4;
    p.g.fillStyle(0x2a3050).fillRect(x + 6, y + 6, cw - 12, ch - 12);
    if (hint === i) p.g.lineStyle(3, GREEN, 0.5 + 0.5 * Math.sin(now / 120)).strokeRect(x + 8, y + 8, cw - 16, ch - 16);
    p.image(`ing-${id}`, x + cw / 2 + (wrong ? shake(game, game.wrong!.at) : 0), y + ch / 2 - 10, { scale: 0.9, tint: wrong ? 0xff8080 : undefined });
    p.text(ingredientName(id), x + cw / 2, y + ch - 24, { size: 11, color: '#cbd5e0', originX: 0.5 });
  });
  cursor(p, gx + game.cursor.col * cw + 4, gy + game.cursor.row * ch + 4, cw - 8, ch - 8, now);
  // Olla con los pasos: los hechos con su ingrediente, el que sigue con un signo de pregunta.
  const px = gx + cw * game.cols + 30;
  const pw = a.x + a.w - px;
  p.image(`dish-${game.dish}`, px + 34, a.y + 30, { scale: 0.45 });
  p.text(dishName(game.dish), px + 74, a.y + 18, { size: 20, color: '#fbd38d', wrap: pw - 80 });
  const row = Math.min(54, (a.h - 70) / game.recipe.length);
  game.recipe.forEach((id, i) => {
    const y = a.y + 70 + i * row;
    const done = i < game.placed;
    const current = i === game.placed;
    p.g.fillStyle(EDGE).fillRect(px - 2, y - 2, pw + 4, row - 4);
    p.g.fillStyle(done ? 0x22543d : current ? 0x2c3a66 : PANEL).fillRect(px, y, pw, row - 8);
    p.text(`${i + 1}.`, px + 10, y + (row - 8) / 2, { size: 15, color: '#a0aec0', originY: 0.5 });
    if (done || game.recipeShown) {
      p.image(`ing-${id}`, px + 62, y + (row - 8) / 2, { scale: 0.55, alpha: done ? 1 : 0.4 });
      p.text(ingredientName(id), px + 92, y + (row - 8) / 2, { size: 14, color: done ? '#9ae6b4' : '#718096', originY: 0.5 });
    } else p.text('?', px + 62, y + (row - 8) / 2, { size: 20, color: current ? '#fbd38d' : '#4a5568', originX: 0.5, originY: 0.5 });
  });
}

const meal: Renderer<MealGame> = (p, game, a, now) => {
  if (game.stage === 'menu') mealMenu(p, game, a, now);
  else if (game.stage === 'recipe') mealRecipe(p, game, a, now);
  else mealCook(p, game, a, now);
};

const shield: Renderer<ShieldGame> = (p, game, a, now) => {
  const cell = 62;
  const wx = a.x + 70;
  const wy = a.y + (a.h - cell * game.rows) / 2;
  const sun = { x: a.x + a.w - 70, y: a.y + 50 };
  p.g.fillStyle(0xf6e05e, 0.2).fillCircle(sun.x, sun.y, 46).fillStyle(0xf6e05e).fillCircle(sun.x, sun.y, 30).fillStyle(0xfffaf0).fillCircle(sun.x - 8, sun.y - 8, 10);
  p.g.fillStyle(EDGE).fillRect(wx - 6, wy - 6, cell * game.cols + 12, cell * game.rows + 12);
  for (let i = 0; i < game.cols * game.rows; i++) {
    const x = wx + (i % game.cols) * cell;
    const y = wy + Math.floor(i / game.cols) * cell;
    const gap = game.gaps.get(i);
    if (gap === false) {
      p.g.fillStyle(0x05060f).fillRect(x + 2, y + 2, cell - 4, cell - 4);
      p.g.fillStyle(0xffffff, 0.7).fillRect(x + 12 + (i * 7) % 30, y + 14 + (i * 11) % 30, 2, 2);
    } else p.image('waterbag', x + cell / 2, y + cell / 2, { scale: 0.58 });
  }
  for (const pt of game.particles) {
    const x = wx + (pt.cell % game.cols) * cell + cell / 2;
    const y = wy + Math.floor(pt.cell / game.cols) * cell + cell / 2;
    const t = Math.min(1, pt.t);
    const px = sun.x + (x - sun.x) * t;
    const py = sun.y + (y - sun.y) * t;
    if (!pt.end) {
      p.top.lineStyle(3, 0xf6e05e, 0.35).lineBetween(sun.x + (x - sun.x) * Math.max(0, t - 0.15), sun.y + (y - sun.y) * Math.max(0, t - 0.15), px, py);
      p.top.fillStyle(0xfffaf0).fillCircle(px, py, 4 + 6 * t).fillStyle(0xf6e05e).fillCircle(px, py, 2 + 4 * t);
    } else {
      const k = (game.elapsed - pt.end.atS) / 0.5;
      p.top.lineStyle(4, pt.end.kind === 'blocked' ? BLUE : RED, 1 - k).strokeCircle(x, y, 10 + 30 * k);
    }
  }
  cursor(p, wx + game.cursor.col * cell + 3, wy + game.cursor.row * cell + 3, cell - 6, cell - 6, now);
  p.text(tr('hud.minigame.shield.counter', { blocked: game.blocked, passed: game.passed }), a.x + a.w - 20, a.y + a.h - 20, { size: 14, color: '#fbd38d', originX: 1 });
};

const PLANT_FRAME = { dry: 'plant-dry', pale: 'plant-pale', bugs: 'plant-bugs' } as const;
const TOOL_FRAME = { water: 'wateringcan', lamp: 'growlamp', ladybug: 'ladybug' } as const;

const plants: Renderer<PlantsGame> = (p, game, a, now) => {
  const cw = 150;
  const ch = 120;
  const gx = a.x + 40;
  const gy = a.y + 4;
  p.g.fillStyle(0x6b46c1, 0.18).fillRect(gx - 10, gy - 4, cw * game.cols + 20, ch * game.rows + 8);
  game.plants.forEach((plant, i) => {
    const x = gx + (i % game.cols) * cw + cw / 2 + shake(game, plant.wrongAt);
    const y = gy + Math.floor(i / game.cols) * ch + ch - 6;
    p.image(plant.need ? PLANT_FRAME[plant.need] : 'plant-ok', x, y, { scale: 1.3, originY: 1 });
    if (plant.fixedAt !== null && game.elapsed - plant.fixedAt < 0.8) {
      const k = (game.elapsed - plant.fixedAt) / 0.8;
      for (let n = 0; n < 5; n++) p.top.fillStyle(0xfefcbf, 1 - k).fillRect(x - 40 + n * 20, y - 60 - k * 40 - (n % 2) * 12, 4, 4);
    }
  });
  cursor(p, gx + game.cursor.col * cw + 6, gy + game.cursor.row * ch + 2, cw - 12, ch - 4, now);
  const tx = a.x + a.w - 170;
  PLANT_TOOLS.forEach((tool, i) => {
    const y = a.y + 40 + i * 92;
    const lit = game.tool === i;
    p.g.fillStyle(EDGE).fillRect(tx - 10, y - 38, 170, 80);
    p.g.fillStyle(lit ? 0x553c9a : PANEL).fillRect(tx - 7, y - 35, 164, 74);
    p.image(TOOL_FRAME[tool.tool], tx + 40, y, { scale: 1 });
    p.key(String(i + 1), tx + 110, y - 10, lit);
    p.text(tr(`hud.minigame.plants.tool.${tool.tool}`), tx + 110, y + 18, { size: 12, color: '#e2e8f0', originX: 0.5 });
  });
};

const harvest: Renderer<HarvestGame> = (p, game, a, now) => {
  const cw = 150;
  const gx = a.x + (a.w - cw * game.cols) / 2;
  const base = a.y + 240;
  const { min, max, wilt } = HarvestGame.RIPE;
  p.g.fillStyle(0x6b46c1, 0.18).fillRect(gx - 10, a.y + 40, cw * game.cols + 20, 216);
  game.plants.forEach((plant, i) => {
    const stage = game.stageOf(plant);
    const x = gx + i * cw + cw / 2 + shake(game, plant.wrongAt);
    // La planta crece: chica y pálida, a punto bien verde, pasada seca.
    const frame = stage === 'growing' ? 'plant-pale' : stage === 'ripe' ? 'plant-ok' : 'plant-dry';
    p.image(frame, x - 16, base, { scale: 0.55 + 0.85 * Math.min(1, plant.growth / max), originY: 1 });
    // Medidor de crecimiento con la franja verde de "a punto".
    const m = { x: x + 48, y: a.y + 60, w: 14, h: 170 };
    const at = (g: number) => m.y + m.h - (Math.min(g, wilt) / wilt) * m.h;
    p.g.fillStyle(EDGE).fillRect(m.x - 2, m.y - 2, m.w + 4, m.h + 4);
    p.g.fillStyle(0x2d3748).fillRect(m.x, m.y, m.w, m.h);
    p.g.fillStyle(GREEN, 0.75).fillRect(m.x, at(max), m.w, at(min) - at(max));
    p.g.fillStyle(stage === 'ripe' ? 0xf0fff4 : stage === 'overripe' ? 0xfc8181 : AMBER).fillRect(m.x - 4, at(plant.growth) - 2, m.w + 8, 4);
    if (stage === 'ripe' && Math.floor(now / 200) % 2 === 0) p.top.fillStyle(0xf0fff4).fillRect(x - 30, base - 150, 4, 4).fillRect(x + 4, base - 162, 4, 4);
    if (plant.cutAt !== null && game.elapsed - plant.cutAt < 0.8) {
      const k = (game.elapsed - plant.cutAt) / 0.8;
      for (let n = 0; n < 5; n++) p.top.fillStyle(0x9ae6b4, 1 - k).fillRect(x - 40 + n * 16, base - 70 - k * 60 - (n % 2) * 12, 5, 5);
    }
  });
  cursor(p, gx + game.cursor.col * cw + 6, a.y + 46, cw - 12, 204, now);
  // El frasco de la muestra: un brote por cada corte a punto.
  for (let i = 0; i < game.need; i++) {
    const x = a.x + a.w / 2 + (i - (game.need - 1) / 2) * 44;
    p.g.fillStyle(EDGE).fillRect(x - 18, a.y + 276, 36, 36);
    p.g.fillStyle(i < game.collected ? 0x276749 : PANEL).fillRect(x - 15, a.y + 279, 30, 30);
    if (i < game.collected) p.image('plant-ok', x, a.y + 306, { scale: 0.3, originY: 1 });
  }
  p.key('←', a.x + 30, a.y + 294);
  p.key('→', a.x + 70, a.y + 294);
  p.key('E', a.x + a.w - 40, a.y + 294, game.stageOf(game.plants[game.cursor.index]!) === 'ripe');
};

const moxie: Renderer<MoxieGame> = (p, game, a, now) => {
  const hx = a.x + a.w / 2 - 60;
  const hy = a.y + a.h / 2 + 20;
  const heat = Math.min(1, game.tempC / 900);
  p.g.fillStyle(0xf6ad55, 0.12 + 0.3 * heat).fillCircle(hx, hy - 10, 60 + 50 * heat);
  p.image('heater', hx, hy, { scale: 3, tint: game.overheated ? 0xff9090 : undefined });
  const working = !game.overheated && game.tempC >= game.band.min && game.tempC <= game.band.max;
  // El CO2 entra por la izquierda y, si está a la temperatura justa, sale oxígeno por la derecha.
  for (let i = 0; i < 3; i++) {
    const k = ((now / 1600 + i / 3) % 1);
    p.image('co2', a.x + 40 + k * (hx - 110 - a.x - 40), hy - 40 + i * 30, { scale: 0.8, alpha: 1 - k * 0.5 });
    if (working) p.image('o2', hx + 110 + k * 180, hy - 40 + i * 30, { scale: 0.9, alpha: 1 - k * 0.6 });
  }
  // Termómetro.
  const tx = a.x + a.w - 70;
  const top = a.y + 10;
  const height = a.h - 40;
  const yOf = (c: number) => top + height * (1 - c / 1100);
  p.g.fillStyle(EDGE).fillRect(tx - 18, top - 4, 36, height + 8);
  p.g.fillStyle(0x2d3748).fillRect(tx - 14, top, 28, height);
  p.g.fillStyle(GREEN, 0.5).fillRect(tx - 14, yOf(game.band.max), 28, yOf(game.band.min) - yOf(game.band.max));
  p.g.fillStyle(RED, 0.4).fillRect(tx - 14, top, 28, yOf(950) - top);
  const color = game.tempC > 950 ? RED : working ? GREEN : game.tempC > 400 ? AMBER : BLUE;
  p.g.fillStyle(color).fillRect(tx - 8, yOf(game.tempC), 16, top + height - yOf(game.tempC));
  p.text(`${Math.round(game.tempC)} °C`, tx - 28, yOf(game.tempC), { size: 16, color: '#fbd38d', originX: 1, originY: 0.5 });
  p.key('E', hx, a.y + a.h - 6, game.tempC > 20 && !game.overheated);
  p.focus(hx, hy);
};

const seals: Renderer<SealsGame> = (p, game, a) => {
  const cx = a.x + a.w / 2;
  const cy = a.y + a.h / 2 + 4;
  const r = 128;
  p.g.fillStyle(EDGE).fillCircle(cx, cy, r + 26).fillStyle(METAL).fillCircle(cx, cy, r + 22).fillStyle(0x2a2f48).fillCircle(cx, cy, r - 18);
  p.g.fillStyle(0x3a4060).fillRect(cx - 6, cy - r + 18, 12, 2 * r - 36).fillRect(cx - r + 18, cy - 6, 2 * r - 36, 12);
  p.g.fillStyle(0xf6e05e).fillCircle(cx, cy, 16).fillStyle(EDGE).fillCircle(cx, cy, 8);
  const angleOf = (seg: number) => ((-90 + seg * (360 / game.segments)) * Math.PI) / 180;
  for (let i = 0; i < game.segments; i++) {
    const a0 = angleOf(i - 0.45);
    const a1 = angleOf(i + 0.45);
    p.g.lineStyle(16, game.dust[i]! > 0 ? 0x7b5a3c : 0x1a202c).beginPath().arc(cx, cy, r, a0, a1).strokePath();
    if (game.dust[i]! > 0) {
      const ang = angleOf(i);
      p.image('dust', cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, { scale: 0.5 + 0.5 * game.dust[i]!, alpha: 0.4 + 0.6 * game.dust[i]! });
    }
  }
  const ang = angleOf(game.brush);
  const bx = cx + Math.cos(ang) * (r + 34);
  const by = cy + Math.sin(ang) * (r + 34);
  p.image('brush', bx, by, { scale: 1.1, angle: (ang * 180) / Math.PI + 90 });
  p.focus(bx, by);
  p.key('←', a.x + 60, a.y + a.h - 30);
  p.key('→', a.x + 104, a.y + a.h - 30);
  p.key('E', a.x + a.w - 60, a.y + a.h - 30);
};

const patch: Renderer<PatchGame> = (p, game, a, now) => {
  const cw = 66;
  const ch = 58;
  const gx = a.x + 30;
  const gy = a.y + (a.h - ch * game.rows) / 2;
  for (let row = 0; row < game.rows; row++) {
    for (let col = 0; col < game.cols; col++) {
      const x = gx + col * cw;
      const y = gy + row * ch;
      p.g.fillStyle(EDGE).fillRect(x, y, cw, ch);
      p.g.fillStyle((row + col) % 2 ? 0x8a90b8 : 0x7a80a8).fillRect(x + 2, y + 2, cw - 4, ch - 4);
      p.g.fillStyle(0x5a6088).fillRect(x + 5, y + 5, 3, 3).fillRect(x + cw - 8, y + 5, 3, 3).fillRect(x + 5, y + ch - 8, 3, 3).fillRect(x + cw - 8, y + ch - 8, 3, 3);
    }
  }
  for (const h of game.holes) {
    const x = gx + h.col * cw + cw / 2;
    const y = gy + h.row * ch + ch / 2;
    if (h.patched) p.image('patch', x, y, { scale: 0.8 });
    else {
      p.g.fillStyle(0x1a1d2e).fillCircle(x, y, 3);
      // Aire que se escapa: copitos que salen y se borran.
      for (let n = 0; n < 4; n++) {
        const k = (now / 900 + n / 4) % 1;
        p.top.fillStyle(0xe2e8f0, 0.35 * (1 - k)).fillCircle(x + (noise(n, 1) - 0.5) * 50 * k, y - 30 * k, 2 + 4 * k);
      }
    }
  }
  for (const m of game.misses) p.image('patch', gx + m.col * cw + cw / 2, gy + m.row * ch + ch / 2, { scale: 0.6, tint: 0x8090a0 });
  cursor(p, gx + game.cursor.col * cw + 4, gy + game.cursor.row * ch + 4, cw - 8, ch - 8, now);
  // Detector: barras y una luz que titila más rápido cerca de la fuga.
  const dx = a.x + a.w - 120;
  const s = game.signal;
  screen(p, dx - 50, a.y + 20, 120, a.h - 40, 0x0b1020);
  p.text(tr('hud.minigame.patch.signal'), dx + 10, a.y + 30, { size: 13, color: '#90cdf4', originX: 0.5 });
  for (let i = 0; i < 8; i++) {
    const on = s > i / 8;
    p.g.fillStyle(on ? (i > 5 ? RED : i > 2 ? AMBER : GREEN) : 0x2d3748).fillRect(dx - 20, a.y + a.h - 50 - i * 26, 60, 18);
  }
  const blink = Math.sin(now / (40 + 400 * (1 - s))) > 0;
  p.top.fillStyle(blink ? RED : 0x4a1c1c).fillCircle(dx + 10, a.y + 64, 10);
};

/** Colores de los fusibles (por tipo, en `FUSE_TYPES`) y de los cables. */
const FUSE_COLOR = { green: GREEN, amber: AMBER, red: RED } as const;
const WIRE_COLOR: Record<WireColor, number> = { red: 0xe53e3e, blue: 0x3182ce, yellow: 0xecc94b, green: 0x38a169, white: 0xedf2f7 };

const fuses: Renderer<FusesGame> = (p, game, a, now) => {
  // Tablero: cada lugar con el número que va ahí y su fusible (de color si está sano, negro si se quemó).
  const cw = 110;
  const ch = 130;
  const gx = a.x + 40;
  const gy = a.y + (a.h - ch * game.rows) / 2;
  screen(p, gx - 16, gy - 16, cw * game.cols + 32, ch * game.rows + 32, 0x2a2f45);
  game.slots.forEach((slot, i) => {
    const x = gx + (i % game.cols) * cw;
    const y = gy + Math.floor(i / game.cols) * ch;
    const type = FUSE_TYPES[slot.type]!;
    p.g.fillStyle(EDGE).fillRect(x + 8, y + 8, cw - 16, ch - 16);
    p.g.fillStyle(METAL).fillRect(x + 10, y + 10, cw - 20, ch - 20);
    p.text(`${type.amps} A`, x + cw / 2, y + 16, { size: 16, color: '#f7fafc', originX: 0.5 });
    // Fusible: cápsula con dos tapas de metal; quemado, negro con una mancha.
    const fx = x + cw / 2 - 16;
    const fy = y + 44;
    p.g.fillStyle(EDGE).fillRect(fx - 2, fy - 2, 36, 64);
    p.g.fillStyle(METAL_LIGHT).fillRect(fx, fy, 32, 10).fillRect(fx, fy + 50, 32, 10);
    p.g.fillStyle(slot.burnt ? 0x1a1a1a : FUSE_COLOR[type.color]).fillRect(fx, fy + 10, 32, 40);
    if (slot.burnt) {
      p.g.fillStyle(0x4a4a4a).fillRect(fx + 8, fy + 22, 16, 4).fillRect(fx + 12, fy + 26, 8, 8);
      // Humito que sube.
      const k = (now / 1200 + i * 0.3) % 1;
      p.top.fillStyle(0xa0aec0, 0.4 * (1 - k)).fillCircle(fx + 16 + (noise(i, 2) - 0.5) * 20 * k, fy - 10 - 30 * k, 4 + 6 * k);
    } else p.g.fillStyle(0xffffff, 0.35).fillRect(fx + 4, fy + 12, 6, 34);
  });
  cursor(p, gx + game.cursor.col * cw + 6, gy + game.cursor.row * ch + 6, cw - 12, ch - 12, now);
  // Repuestos: uno de cada amperaje, con su tecla.
  const rx = a.x + a.w - 170;
  screen(p, rx, a.y + 20, 140, a.h - 40, 0x0b1020);
  p.text(tr('hud.minigame.fuses.spares'), rx + 70, a.y + 30, { size: 13, color: '#90cdf4', originX: 0.5 });
  FUSE_TYPES.forEach((type, i) => {
    const y = a.y + 70 + i * 92;
    p.g.fillStyle(EDGE).fillRect(rx + 22, y - 2, 28, 52);
    p.g.fillStyle(METAL_LIGHT).fillRect(rx + 24, y, 24, 8).fillRect(rx + 24, y + 40, 24, 8);
    p.g.fillStyle(FUSE_COLOR[type.color]).fillRect(rx + 24, y + 8, 24, 32);
    p.text(`${type.amps} A`, rx + 60, y + 6, { size: 15, color: '#f7fafc' });
    p.key(String(i + 1), rx + 76, y + 36, false, 30);
  });
};

const wires: Renderer<WiresGame> = (p, game, a, now) => {
  // Dos regletas: a la izquierda las puntas de un lado del corte, a la derecha las del otro.
  const rows = game.left.length;
  const gap = Math.min(70, (a.h - 40) / rows);
  const top = a.y + (a.h - gap * (rows - 1)) / 2;
  const lx = a.x + 160;
  const rx = a.x + a.w - 260;
  screen(p, lx - 70, top - 40, 90, gap * (rows - 1) + 80, 0x2a2f45);
  screen(p, rx - 20, top - 40, 90, gap * (rows - 1) + 80, 0x2a2f45);
  const end = (x: number, y: number, color: WireColor, glow: boolean) => {
    p.g.fillStyle(EDGE).fillRect(x - 14, y - 10, 28, 20);
    p.g.fillStyle(WIRE_COLOR[color]).fillRect(x - 12, y - 8, 24, 16);
    p.g.fillStyle(0xd69e2e).fillRect(x + 12, y - 3, 10, 6);
    if (glow) p.top.lineStyle(3, 0xf6e05e, 0.6 + 0.4 * Math.sin(now / 130)).strokeRect(x - 18, y - 14, 36, 28);
  };
  game.left.forEach((color, i) => {
    const y = top + i * gap;
    p.g.fillStyle(WIRE_COLOR[color]).fillRect(lx - 70, y - 4, 56, 8);
    end(lx - 10, y, color, i === game.current);
  });
  game.right.forEach((color, i) => {
    const y = top + i * gap;
    p.g.fillStyle(WIRE_COLOR[color]).fillRect(rx + 20, y - 4, 50, 8);
    end(rx, y, color, false);
  });
  // Empalmes hechos: una línea del color que une las dos puntas.
  game.joined.forEach((j, i) => {
    if (j === null) return;
    const color = WIRE_COLOR[game.left[i]!];
    const [y1, y2] = [top + i * gap, top + j * gap];
    p.g.lineStyle(10, EDGE).lineBetween(lx + 12, y1, rx - 22, y2);
    p.g.lineStyle(6, color).lineBetween(lx + 12, y1, rx - 22, y2);
  });
  cursor(p, rx - 30, top + game.cursor.row * gap - 20, 60, 40, now);
  // La que toca unir, del lado izquierdo, con una flecha hacia la elegida.
  if (game.current >= 0) {
    const y1 = top + game.current * gap;
    const y2 = top + game.cursor.row * gap;
    for (let k = 0.15; k < 0.9; k += 0.12) p.top.fillStyle(0xf6e05e, 0.5).fillCircle(lx + 12 + (rx - lx - 34) * k, y1 + (y2 - y1) * k, 3);
  }
};

const dust: Renderer<DustGame> = (p, game, a, now) => {
  // Los paneles solares vistos de frente, sobre el suelo de Gale: cuanto más polvo, más apagados.
  const cw = Math.min(150, (a.w - 220) / game.cols);
  const ch = Math.min(130, (a.h - 60) / game.rows);
  const gx = a.x + 30;
  const gy = a.y + (a.h - ch * game.rows) / 2;
  p.g.fillStyle(0x8a4a2a).fillRect(a.x, gy + ch * game.rows + 4, a.w - 190, 10);
  game.panels.forEach((layers, i) => {
    const x = gx + (i % game.cols) * cw + 8;
    const y = gy + Math.floor(i / game.cols) * ch + 8;
    const [w, h] = [cw - 16, ch - 16];
    p.g.fillStyle(EDGE).fillRect(x - 3, y - 3, w + 6, h + 6);
    p.g.fillStyle(METAL_LIGHT).fillRect(x - 1, y - 1, w + 2, h + 2);
    p.g.fillStyle(0x1e3a8a).fillRect(x, y, w, h);
    p.g.fillStyle(0x3b82f6);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 3; r++) p.g.fillRect(x + 4 + (c * (w - 4)) / 4, y + 4 + (r * (h - 4)) / 3, (w - 4) / 4 - 4, (h - 4) / 3 - 4);
    p.g.fillStyle(0xffffff, 0.25).fillRect(x + 4, y + 4, w - 8, 4);
    if (layers > 0) {
      // Polvo: una capa de color arena por cada pasada que falta, con motas.
      p.g.fillStyle(0xc98a55, 0.28 * layers).fillRect(x, y, w, h);
      for (let k = 0; k < layers * 9; k++) p.g.fillStyle(0xe2b07a, 0.8).fillRect(x + 4 + noise(i, k) * (w - 12), y + 4 + noise(k, i + 3) * (h - 12), 4, 4);
      for (let k = 0; k < DUST_LAYERS; k++) p.g.fillStyle(k < layers ? 0xf6ad55 : 0x2d3748).fillRect(x + w / 2 - 20 + k * 14, y + h + 4, 10, 4);
    }
    // Brillo de un panel recién cepillado.
    if (game.wiped?.index === i && game.elapsed - game.wiped.at < 0.35) {
      const k = (game.elapsed - game.wiped.at) / 0.35;
      p.top.fillStyle(0xffffff, 0.5 * (1 - k)).fillRect(x + w * k - 10, y, 20, h);
    }
  });
  const cx = gx + game.cursor.col * cw + 4;
  const cy = gy + game.cursor.row * ch + 4;
  cursor(p, cx, cy, cw - 8, ch - 8, now);
  p.image('brush', cx + cw - 30, cy + ch - 34 + Math.sin(now / 160) * 3, { scale: 1.5 });
  // A la derecha, lo que dan los paneles: sube al limpiar.
  const rx = a.x + a.w - 170;
  screen(p, rx, a.y + 20, 140, a.h - 40, 0x0b1020);
  p.text(tr('hud.minigame.dust.power'), rx + 70, a.y + 30, { size: 13, color: '#90cdf4', originX: 0.5 });
  const bh = a.h - 130;
  const fill = 0.55 + 0.45 * game.progress;
  p.g.fillStyle(0x2d3748).fillRect(rx + 50, a.y + 60, 40, bh);
  p.g.fillStyle(game.progress >= 1 ? GREEN : AMBER).fillRect(rx + 50, a.y + 60 + bh * (1 - fill), 40, bh * fill);
  p.text(`${Math.round(fill * 100)} %`, rx + 70, a.y + a.h - 58, { size: 16, color: '#f7fafc', originX: 0.5 });
};

const night: Renderer<NightGame> = (p, game, a, now) => {
  // Tablero de llaves: cada sistema con su palanca; los de soporte vital llevan un corazón (no se apagan).
  const rows = game.switches.length;
  const rh = Math.min(54, (a.h - 30) / rows);
  const top = a.y + (a.h - rh * rows) / 2;
  const lx = a.x + 40;
  const w = a.w - 280;
  screen(p, lx - 12, top - 10, w + 24, rh * rows + 20, 0x1a2036);
  game.switches.forEach((sw, i) => {
    const y = top + i * rh;
    const cy = y + rh / 2;
    p.g.fillStyle(i % 2 ? 0x1f2740 : 0x232c48).fillRect(lx, y + 2, w, rh - 4);
    p.text(sw.essential ? '♥' : '·', lx + 12, cy, { size: 20, color: sw.essential ? '#fc8181' : '#718096', originY: 0.5 });
    p.text(tr(`hud.minigame.night.load.${sw.id}`), lx + 40, cy, { size: 15, color: sw.on ? '#f7fafc' : '#718096', originY: 0.5 });
    if (sw.essential) p.text(tr('hud.minigame.night.keep'), lx + w - 150, cy, { size: 11, color: '#fc8181', originX: 1, originY: 0.5 });
    // Palanca: arriba y con luz verde si está encendido; abajo y apagada si no.
    const sx = lx + w - 90;
    p.g.fillStyle(EDGE).fillRect(sx - 2, cy - 16, 64, 32);
    p.g.fillStyle(0x0b1020).fillRect(sx, cy - 14, 60, 28);
    p.g.fillStyle(sw.on ? GREEN : 0x4a5568).fillRect(sw.on ? sx + 32 : sx + 2, cy - 12, 26, 24);
    p.g.fillStyle(0xffffff, 0.3).fillRect(sw.on ? sx + 32 : sx + 2, cy - 12, 26, 4);
    p.g.fillStyle(sw.on ? 0xf6e05e : 0x2d3748).fillCircle(sx + 82, cy, 7);
  });
  cursor(p, lx - 4, top + game.cursor.row * rh, w + 8, rh, now);
  // A la derecha: la batería de la noche; cuanto más se apaga, más dura.
  const rx = a.x + a.w - 190;
  screen(p, rx, a.y + 20, 160, a.h - 40, 0x0b1020);
  p.text('☾', rx + 80, a.y + 30, { size: 30, color: '#cbd5e0', originX: 0.5 });
  p.text(tr('hud.minigame.night.battery'), rx + 80, a.y + 72, { size: 13, color: '#90cdf4', originX: 0.5, wrap: 150, align: 'center' });
  const bx = rx + 50;
  const by = a.y + 118;
  const bh = a.h - 190;
  p.g.fillStyle(METAL_LIGHT).fillRect(bx + 18, by - 8, 24, 8).fillRect(bx - 3, by - 3, 66, bh + 6);
  p.g.fillStyle(0x0b1020).fillRect(bx, by, 60, bh);
  const fill = 0.4 + 0.6 * game.progress;
  p.g.fillStyle(game.progress >= 1 ? GREEN : AMBER).fillRect(bx + 4, by + 4 + (bh - 8) * (1 - fill), 52, (bh - 8) * fill);
};

const RENDERERS: Record<MinigameId, Renderer<never>> = {
  bike,
  scrubber,
  water,
  radio,
  stars,
  pulse,
  meal,
  shield,
  plants,
  harvest,
  moxie,
  seals,
  patch,
  fuses,
  wires,
  dust,
  night,
} as Record<MinigameId, Renderer<never>>;

/** Dibuja el minijuego en su zona. */
export function renderMinigame(p: Painter, game: Minigame, area: Area, now: number): void {
  (RENDERERS[game.id] as Renderer<Minigame>)(p, game, area, now);
}

/** Ícono del atlas para el título de cada minijuego. */
export const MINIGAME_ICON: Record<MinigameId, string> = {
  bike: 'heart',
  scrubber: 'co2',
  water: 'drop',
  radio: 'dish',
  stars: 'star',
  pulse: 'stethoscope',
  meal: 'ing-tortilla',
  shield: 'waterbag',
  plants: 'plant-ok',
  harvest: 'plant-ok',
  moxie: 'o2',
  seals: 'brush',
  patch: 'patch',
  fuses: 'heater',
  wires: 'filter',
  dust: 'brush',
  night: 'heater',
};
