import Phaser from 'phaser';
import { CARGO_GRID, RETURN_RULES } from '../../../content/loadouts';
import { METER_RULES } from '../../../content/meters';
import {
  autoPack, cargoItems, cargoTotals, footprint, gridReturnResult, itemAt, placeError, removeItem, totalsAsCargo,
  type CargoItem, type CargoKind, type PlaceError, type Placement,
} from '../../../core/loadout/cargoGrid';
import { availableForReturn, supplyLight, type CargoField } from '../../../core/loadout/loadout';
import { t, type TranslationKey } from '../../../i18n';
import { formatNumber } from '../../../i18n/format';
import { CargoTextures } from '../../assets';
import { audio } from '../../audio/audio';
import { addButton, addText, COLOR, LIGHT_COLOR, PANEL, pulse } from '../../ui/ui';
import type { LoadoutSceneData } from '../sceneData';

/** Bodega de la nave (derecha) y lo que queda en la base (izquierda). */
const GRID = { x: 720, y: 150, cell: 48 } as const;
const BASE = { x: 40, y: 150, w: 620, h: 290 } as const;
const STACK = { w: 118, h: 112, y: BASE.y + 30 } as const;
const ROCK = { w: 74, h: 108, y: BASE.y + 160 } as const;
/** Píxeles de pantalla por píxel de arte: en la bodega (un casillero = 16 px de arte) y en la base (más chico). */
const ART = { hold: 3, base: 2 } as const;
const STACK_KINDS: readonly Exclude<CargoKind, 'rock'>[] = ['food', 'water', 'shield', 'spare', 'plant'];
const SUPPLIES: readonly Exclude<CargoField, 'samples'>[] = ['foodKg', 'waterL', 'shield', 'spares'];
/** Pieza de la bodega de cada suministro (su dibujo es el ícono del contador). */
const SUPPLY_KIND: Record<Exclude<CargoField, 'samples'>, Exclude<CargoKind, 'rock' | 'plant'>> = { foodKg: 'food', waterL: 'water', shield: 'shield', spares: 'spare' };
/** Contadores debajo de la bodega: una fila por recurso, con sus piezas como cuadraditos. */
const COUNTER = { row: 25, pip: 12, gap: 3, pipsX: 30 } as const;
const LIGHT_CSS = { green: '#68d391', yellow: '#f6e05e', red: '#fc8181' } as const;
const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

/** Una entrada de la base: una pila de piezas iguales (cajas, tanques…) o una roca suelta. */
interface Entry {
  items: CargoItem[];
  x: number;
  y: number;
  w: number;
  h: number;
}

const textureOf = (item: CargoItem): string => (item.kind === 'rock' ? CargoTextures.rock(item.w, item.h) : CargoTextures[item.kind]);

/**
 * Carga de vuelta como un maletín de casilleros (al estilo Resident Evil 4): se toma una pieza de la base, se gira si
 * hace falta y se acomoda en la bodega. Lo que no entra se queda en Marte. Sólo pinta y lee la entrada; las reglas
 * están en `core/loadout/cargoGrid.ts`.
 */
export class CargoGridView {
  private readonly items: CargoItem[];
  private readonly waterPoolL: number;
  private placements: Placement[] = [];
  private hand: { item: CargoItem; rotated: boolean } | null = null;
  private cursor = { col: 0, row: 0 };
  private selected = 0;
  private entries: Entry[] = [];
  private message: { text: string; good: boolean } | null = null;
  /** Ya se avisó que falta algo importante: el próximo Enter despega igual. */
  private warned = false;
  private done = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly data: LoadoutSceneData,
    private readonly view: Phaser.GameObjects.Container,
    private readonly header: () => void,
  ) {
    this.items = cargoItems(data.state, RETURN_RULES, CARGO_GRID);
    this.waterPoolL = availableForReturn(data.state, RETURN_RULES).waterPoolL;
    scene.input.mouse?.disableContextMenu();
    scene.input.on('pointermove', this.onPointerMove, this);
    scene.input.on('pointerdown', this.onPointerDown, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.off('pointermove', this.onPointerMove, this);
      scene.input.off('pointerdown', this.onPointerDown, this);
    });
  }

  // --- Estado ---

  private placed(item: CargoItem): boolean {
    return this.placements.some((p) => p.itemId === item.id);
  }

  /** Piezas que siguen en la base (ni en la bodega ni en la mano). */
  private inBase(): CargoItem[] {
    return this.items.filter((i) => !this.placed(i) && i !== this.hand?.item);
  }

  private buildEntries(): Entry[] {
    const base = this.inBase();
    const entries: Entry[] = [];
    STACK_KINDS.forEach((kind, i) => {
      const items = base.filter((item) => item.kind === kind);
      if (items.length) entries.push({ items, x: BASE.x + 14 + i * STACK.w, y: STACK.y, w: STACK.w - 8, h: STACK.h });
    });
    this.items
      .filter((item) => item.kind === 'rock')
      .forEach((item, i) => {
        if (base.includes(item)) entries.push({ items: [item], x: BASE.x + 14 + i * ROCK.w, y: ROCK.y, w: ROCK.w - 6, h: ROCK.h });
      });
    return entries;
  }

  private cellAt(x: number, y: number): { col: number; row: number } | null {
    const col = Math.floor((x - GRID.x) / GRID.cell);
    const row = Math.floor((y - GRID.y) / GRID.cell);
    return col >= 0 && row >= 0 && col < CARGO_GRID.cols && row < CARGO_GRID.rows ? { col, row } : null;
  }

  private handPlacement(): Placement | null {
    return this.hand ? { itemId: this.hand.item.id, col: this.cursor.col, row: this.cursor.row, rotated: this.hand.rotated } : null;
  }

  private errorOf(placement: Placement): PlaceError | null {
    return placeError(this.items, this.placements, placement, CARGO_GRID, RETURN_RULES, this.waterPoolL);
  }

  /** Mantiene la pieza de la mano dentro de la bodega. */
  private clampCursor(): void {
    const size = this.hand ? footprint(this.hand.item, this.hand.rotated) : { w: 1, h: 1 };
    this.cursor.col = Phaser.Math.Clamp(this.cursor.col, 0, CARGO_GRID.cols - size.w);
    this.cursor.row = Phaser.Math.Clamp(this.cursor.row, 0, CARGO_GRID.rows - size.h);
  }

  private say(key: string, good = false): void {
    this.message = { text: t(`menu.loadout.grid.${key}` as TranslationKey), good };
    if (!good) audio.sfx('crateBlocked');
  }

  // --- Acciones ---

  private take(item: CargoItem, rotated = false): void {
    this.hand = { item, rotated };
    this.message = null;
    this.warned = false;
    this.clampCursor();
    audio.sfx('crateLift');
  }

  /** Toma una pieza de la base, la pieza de la bodega bajo el cursor o suelta la que está en la mano. */
  private act(): void {
    if (this.hand) return this.drop();
    const under = itemAt(this.items, this.placements, this.cursor.col, this.cursor.row);
    if (under) {
      const item = this.items.find((i) => i.id === under.itemId)!;
      this.placements = removeItem(this.placements, item.id);
      this.cursor = { col: under.col, row: under.row };
      return this.take(item, under.rotated);
    }
    const entry = this.entries[this.selected];
    if (entry) this.take(entry.items[0]!);
    else this.say('allLoaded', true);
  }

  private drop(): void {
    const placement = this.handPlacement();
    if (!placement) return;
    const error = this.errorOf(placement);
    if (error) return this.say(`error.${error}`);
    this.placements = [...this.placements, placement];
    this.hand = null;
    this.message = null;
    audio.sfx('cratePlace');
  }

  private rotate(): void {
    if (!this.hand) return;
    this.hand.rotated = !this.hand.rotated;
    this.clampCursor();
    audio.sfx('crateRotate');
  }

  /** Devuelve a la base la pieza de la mano (o la de la bodega bajo el cursor). */
  private putBack(): void {
    if (this.hand) this.hand = null;
    else {
      const under = itemAt(this.items, this.placements, this.cursor.col, this.cursor.row);
      if (!under) return;
      this.placements = removeItem(this.placements, under.itemId);
    }
    this.warned = false;
    audio.sfx('crateLift');
  }

  private auto(): void {
    this.hand = null;
    this.placements = autoPack(this.items, CARGO_GRID, RETURN_RULES, this.waterPoolL);
    this.warned = false;
    this.say('autoDone', true);
    audio.sfx('cratePlace');
  }

  private clear(): void {
    this.hand = null;
    this.placements = [];
    this.warned = false;
    this.message = null;
    audio.sfx('back');
  }

  private launch(): void {
    if (this.done || this.hand) return;
    const cargo = totalsAsCargo(cargoTotals(this.items, this.placements));
    const missing = SUPPLIES.some((field) => supplyLight(cargo, field, RETURN_RULES) === 'red');
    if (missing && !this.warned) {
      this.warned = true;
      return this.say('confirmRed');
    }
    this.done = true;
    audio.sfx('holdSealed');
    this.data.bus.emit('phase:completed', gridReturnResult(this.data.state, this.items, this.placements));
  }

  // --- Entrada ---

  onKey(code: string, event: KeyboardEvent): void {
    if (this.done) return;
    const arrow = ARROWS[code];
    if (arrow) {
      this.cursor.col += arrow[0];
      this.cursor.row += arrow[1];
      this.clampCursor();
    } else if (code === 'Tab') {
      event.preventDefault();
      if (this.entries.length) this.selected = (this.selected + (event.shiftKey ? -1 : 1) + this.entries.length) % this.entries.length;
      audio.sfx('hover');
    } else if (code === 'Space' || code === 'KeyE') this.act();
    else if (code === 'KeyR') this.rotate();
    else if (code === 'KeyX' || code === 'Backspace' || code === 'Delete') this.putBack();
    else if (code === 'Digit1' || code === 'Numpad1') this.auto();
    else if (code === 'Digit2' || code === 'Numpad2') this.clear();
    else if (code === 'Enter' || code === 'NumpadEnter') this.launch();
    else return;
    this.render();
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    const cell = this.cellAt(pointer.x, pointer.y);
    if (!cell || this.done) return;
    const size = this.hand ? footprint(this.hand.item, this.hand.rotated) : { w: 1, h: 1 };
    // Con una pieza en la mano, el puntero queda en su centro.
    const next = { col: cell.col - Math.floor((size.w - 1) / 2), row: cell.row - Math.floor((size.h - 1) / 2) };
    const before = `${this.cursor.col},${this.cursor.row}`;
    this.cursor = next;
    this.clampCursor();
    if (before !== `${this.cursor.col},${this.cursor.row}`) this.render();
  }

  private onPointerDown(pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    if (this.done || over.length) return;
    if (pointer.rightButtonDown()) {
      this.rotate();
      return this.render();
    }
    if (this.cellAt(pointer.x, pointer.y)) {
      this.onPointerMove(pointer);
      this.act();
      return this.render();
    }
    const index = this.entries.findIndex((e) => pointer.x >= e.x && pointer.x <= e.x + e.w && pointer.y >= e.y && pointer.y <= e.y + e.h);
    if (index !== -1 && !this.hand) {
      this.selected = index;
      this.take(this.entries[index]!.items[0]!);
    } else if (this.hand && pointer.x >= BASE.x && pointer.x <= BASE.x + BASE.w && pointer.y >= BASE.y && pointer.y <= BASE.y + BASE.h) this.putBack();
    else return;
    this.render();
  }

  // --- Dibujo ---

  render(): void {
    const { scene, view } = this;
    view.removeAll(true);
    this.header();
    this.entries = this.buildEntries();
    this.selected = Math.min(this.selected, Math.max(0, this.entries.length - 1));
    const add = <T extends Phaser.GameObjects.GameObject>(object: T): T => {
      view.add(object);
      return object;
    };
    const label = (x: number, y: number, size: number, color: string, text: string) => add(addText(scene, x, y, size, color).setText(text));

    // La base: pilas de suministros y rocas sueltas.
    add(scene.add.rectangle(BASE.x, BASE.y, BASE.w, BASE.h, PANEL.fill, 0.95).setOrigin(0, 0).setStrokeStyle(2, PANEL.stroke));
    label(BASE.x + 14, BASE.y + 6, 15, COLOR.title, t('menu.loadout.grid.base'));
    if (!this.entries.length) label(BASE.x + 14, BASE.y + 60, 14, COLOR.dim, t('menu.loadout.grid.allLoaded'));
    this.entries.forEach((entry, index) => {
      const item = entry.items[0]!;
      const focused = index === this.selected && !this.hand;
      add(scene.add.rectangle(entry.x, entry.y, entry.w, entry.h, focused ? 0x2a3550 : 0x1a202c).setOrigin(0, 0).setStrokeStyle(focused ? 3 : 1, focused ? PANEL.focus : PANEL.stroke));
      add(scene.add.image(entry.x + entry.w / 2, entry.y + (entry.h - 26) / 2 + 2, textureOf(item)).setScale(ART.base));
      const caption = item.kind === 'rock' ? `★ ${item.sample!.value}` : `× ${entry.items.length}`;
      add(addText(scene, entry.x + entry.w / 2, entry.y + entry.h - 20, 13, focused ? COLOR.focus : COLOR.text).setOrigin(0.5, 0).setText(caption));
    });

    // La bodega: casilleros, piezas puestas y la pieza de la mano con su sombra verde o roja.
    label(GRID.x, GRID.y - 24, 15, COLOR.title, t('menu.loadout.grid.hold'));
    const g = add(scene.add.graphics());
    g.fillStyle(0x0b1220, 0.95).fillRect(GRID.x, GRID.y, CARGO_GRID.cols * GRID.cell, CARGO_GRID.rows * GRID.cell);
    g.lineStyle(1, 0x2d3748, 1);
    for (let c = 0; c <= CARGO_GRID.cols; c++) g.lineBetween(GRID.x + c * GRID.cell, GRID.y, GRID.x + c * GRID.cell, GRID.y + CARGO_GRID.rows * GRID.cell);
    for (let r = 0; r <= CARGO_GRID.rows; r++) g.lineBetween(GRID.x, GRID.y + r * GRID.cell, GRID.x + CARGO_GRID.cols * GRID.cell, GRID.y + r * GRID.cell);
    g.lineStyle(2, PANEL.stroke, 1).strokeRect(GRID.x, GRID.y, CARGO_GRID.cols * GRID.cell, CARGO_GRID.rows * GRID.cell);
    const draw = (item: CargoItem, p: Placement, alpha: number, tint?: number) => {
      const { w, h } = footprint(item, p.rotated);
      const x = GRID.x + p.col * GRID.cell;
      const y = GRID.y + p.row * GRID.cell;
      g.fillStyle(tint ?? 0x1e293b, tint ? 0.45 : 0.9).fillRect(x + 2, y + 2, w * GRID.cell - 4, h * GRID.cell - 4);
      g.lineStyle(2, tint ?? 0x4a5568, 1).strokeRect(x + 2, y + 2, w * GRID.cell - 4, h * GRID.cell - 4);
      add(scene.add.image(x + (w * GRID.cell) / 2, y + (h * GRID.cell) / 2, textureOf(item)).setScale(ART.hold).setAngle(p.rotated ? 90 : 0).setAlpha(alpha));
    };
    for (const p of this.placements) draw(this.items.find((i) => i.id === p.itemId)!, p, 1);
    const hand = this.handPlacement();
    if (hand && this.hand) draw(this.hand.item, hand, 0.9, this.errorOf(hand) ? 0xf56565 : 0x48bb78);
    else g.lineStyle(3, PANEL.focus, 1).strokeRect(GRID.x + this.cursor.col * GRID.cell + 1, GRID.y + this.cursor.row * GRID.cell + 1, GRID.cell - 2, GRID.cell - 2);

    // Qué hay en la mano (o bajo el cursor) y el aviso del último intento.
    const under = this.hand?.item ?? this.items.find((i) => i.id === itemAt(this.items, this.placements, this.cursor.col, this.cursor.row)?.itemId) ?? this.entries[this.selected]?.items[0];
    const infoY = BASE.y + BASE.h + 14;
    label(BASE.x, infoY, 14, COLOR.muted, t(this.hand ? 'menu.loadout.grid.inHand' : 'menu.loadout.grid.pick'));
    if (under) label(BASE.x, infoY + 22, 16, COLOR.text, this.describe(under));
    if (this.message) {
      const text = add(addText(scene, BASE.x, infoY + 52, 15, this.message.good ? COLOR.ok : COLOR.warn, { wordWrap: { width: BASE.w } }).setText(this.message.text));
      pulse(scene, text, { scale: 1.04, duration: 140 });
    }

    // Contadores: de cada recurso, cuántas piezas hay guardadas de las disponibles ("3 de 4"), con su ícono; la raya
    // marca lo que conviene llevar. Sin leer párrafos se ve cuánto falta de cada cosa.
    const totals = cargoTotals(this.items, this.placements);
    const cargo = totalsAsCargo(totals);
    const right = GRID.x + CARGO_GRID.cols * GRID.cell;
    add(addText(scene, right, GRID.y - 22, 13, COLOR.muted).setOrigin(1, 0).setText(t('menu.loadout.grid.space', { used: totals.cells, total: CARGO_GRID.cols * CARGO_GRID.rows })));
    const listY = GRID.y + CARGO_GRID.rows * GRID.cell + 10;
    const counter = (row: number, texture: string, loaded: number, total: number, recommended: number | null, color: number, css: string, detail: string) => {
      const y = listY + row * COUNTER.row;
      const icon = add(scene.add.image(GRID.x + 11, y + 10, texture));
      icon.setScale(Math.min(20 / icon.width, 20 / icon.height));
      for (let n = 0; n < total; n++) {
        const x = GRID.x + COUNTER.pipsX + n * (COUNTER.pip + COUNTER.gap);
        g.fillStyle(0x05070d).fillRect(x - 1, y + 3, COUNTER.pip + 2, COUNTER.pip + 2);
        g.fillStyle(n < loaded ? color : 0x2d3748).fillRect(x, y + 4, COUNTER.pip, COUNTER.pip);
        if (n < loaded) g.fillStyle(0xffffff, 0.35).fillRect(x, y + 4, COUNTER.pip, 3);
      }
      // Raya de "conviene llevar hasta acá".
      if (recommended !== null && recommended > 0 && recommended <= total) {
        const x = GRID.x + COUNTER.pipsX + recommended * (COUNTER.pip + COUNTER.gap) - 2;
        g.fillStyle(0xfbd38d).fillRect(x, y + 1, 2, COUNTER.pip + 6);
      }
      const after = GRID.x + COUNTER.pipsX + Math.max(total, 1) * (COUNTER.pip + COUNTER.gap) + 6;
      label(after, y + 2, 13, css, t('menu.loadout.grid.count', { loaded, total }));
      add(addText(scene, right, y + 3, 12, css).setOrigin(1, 0).setText(detail));
    };
    const crewCount = this.data.state.crew.length || 1;
    const waterPerDay = METER_RULES.lifeSupport.waterLPerCrewDay * crewCount * (1 - METER_RULES.lifeSupport.recyclingByStatus.green);
    const foodPerDay = METER_RULES.food.foodKgPerCrewDay * crewCount;
    // Con el reciclador sano el agua rinde muchísimo: pasado el viaje de vuelta, alcanza con decir "más de 150".
    const days = (value: number) => (value > 150 ? '+150' : String(Math.floor(value)));
    // Para qué sirve cada cosa: la comida y el agua de beber, en días; el escudo, en protección contra la radiación.
    const purpose: Record<Exclude<CargoField, 'samples'>, string> = {
      foodKg: t('menu.loadout.grid.foodDays', { days: days(cargo.foodKg / foodPerDay) }),
      waterL: t('menu.loadout.grid.drinkDays', { days: days(cargo.waterL / waterPerDay) }),
      shield: t('menu.loadout.grid.protection', { percent: formatNumber(cargo.shield * 100, undefined, 0) }),
      spares: t('menu.loadout.grid.repairs', { count: cargo.spares }),
    };
    SUPPLIES.forEach((field, i) => {
      const kind = SUPPLY_KIND[field];
      const pieces = this.items.filter((item) => item.kind === kind);
      const loaded = pieces.filter((item) => this.placed(item)).length;
      const light = supplyLight(cargo, field, RETURN_RULES);
      const recommended = kind === 'spare' ? RETURN_RULES.recommended.spares : CARGO_GRID.pieces[kind];
      counter(i, CargoTextures[kind], loaded, pieces.length, recommended, LIGHT_COLOR[light], LIGHT_CSS[light], purpose[field]);
    });
    const rocks = this.items.filter((item) => item.sample);
    if (rocks.length) counter(4, CargoTextures.rock(1, 1), totals.samples.length, rocks.length, null, 0xf6ad55, COLOR.focus, t('menu.loadout.grid.value', { value: formatNumber(totals.value) }));
    else label(GRID.x, listY + 4 * COUNTER.row + 2, 13, COLOR.dim, t('menu.loadout.return.noSamples'));

    // El agua de la base es una sola: la barra muestra cuánta va a beber (gota), cuánta al escudo y cuánta queda.
    const poolY = listY + 5 * COUNTER.row + 4;
    const shieldL = cargo.shield * RETURN_RULES.shieldFullL;
    const pool = Math.max(this.waterPoolL, cargo.waterL + shieldL, 1);
    const barX = GRID.x + 122;
    const barW = right - barX;
    label(GRID.x, poolY, 12, COLOR.muted, t('menu.loadout.grid.pool'));
    g.fillStyle(0x05070d).fillRect(barX - 2, poolY - 1, barW + 4, 16);
    g.fillStyle(0x2d3748).fillRect(barX, poolY + 1, barW, 12);
    const drinkW = Math.round((barW * cargo.waterL) / pool);
    const shieldW = Math.round((barW * shieldL) / pool);
    g.fillStyle(0x4299e1).fillRect(barX, poolY + 1, drinkW, 12);
    g.fillStyle(0xecc94b).fillRect(barX + drinkW, poolY + 1, shieldW, 12);
    const legend = (x: number, color: string, text: string) => add(addText(scene, x, poolY + 16, 11, color).setText(text));
    legend(barX, '#63b3ed', `■ ${t('menu.loadout.grid.poolDrink')}`);
    legend(barX + 84, '#f6e05e', `■ ${t('menu.loadout.grid.poolShield')}`);
    legend(barX + 168, COLOR.dim, `■ ${t('menu.loadout.grid.poolLeft', { amount: this.amount('waterL', Math.max(0, pool - cargo.waterL - shieldL)) })}`);

    const button = (x: number, key: 'auto' | 'clear', action: () => void) =>
      add(addButton(scene, x, 640, () => { action(); this.render(); }, { size: 15 }).setLabel(t(`menu.loadout.grid.${key}`)).text);
    button(BASE.x + 130, 'auto', () => this.auto());
    button(BASE.x + 380, 'clear', () => this.clear());
    // El botón avisa el riesgo: si falta algo, pasa a "Aceptar riesgos" (amarillo si falta poco, rojo si falta mucho)
    // con la lista corta de lo que falta; con todo en verde, vuelve al texto y al color de siempre.
    const short = SUPPLIES.filter((field) => supplyLight(cargo, field, RETURN_RULES) !== 'green');
    const grave = short.some((field) => supplyLight(cargo, field, RETURN_RULES) === 'red');
    const confirm = addButton(scene, GRID.x + (CARGO_GRID.cols * GRID.cell) / 2, 654, () => { this.launch(); if (!this.done) this.render(); }, { size: 19 })
      .setLabel(t(short.length ? 'menu.loadout.return.acceptRisks' : 'menu.loadout.return.confirm'))
      .setEnabled(!this.hand)
      .setFocused(!this.hand);
    if (short.length && !this.hand) confirm.text.setBackgroundColor(grave ? '#e53e3e' : '#ecc94b').setColor(grave ? '#fff5f5' : '#1a202c');
    add(confirm.text);
    if (short.length)
      add(addText(scene, GRID.x + (CARGO_GRID.cols * GRID.cell) / 2, 616, 12, grave ? LIGHT_CSS.red : LIGHT_CSS.yellow, { align: 'center', wordWrap: { width: CARGO_GRID.cols * GRID.cell } })
        .setOrigin(0.5, 0)
        .setText(t('menu.loadout.return.missing', { list: short.map((field) => t(`menu.loadout.return.${field}`)).join(', ') })));
  }

  private amount(field: Exclude<CargoField, 'samples'>, value: number): string {
    if (field === 'foodKg') return t('menu.loadout.return.amountKg', { amount: formatNumber(value) });
    if (field === 'waterL') return t('menu.loadout.return.amountL', { amount: formatNumber(value) });
    if (field === 'shield') return t('menu.loadout.return.amountPercent', { amount: formatNumber(value * 100, undefined, 0) });
    return t('menu.loadout.return.amountUnits', { amount: value });
  }

  private describe(item: CargoItem): string {
    const name = t(`menu.loadout.grid.item.${item.kind}`);
    if (item.sample) return `${name} · ${t('menu.loadout.grid.value', { value: item.sample.value })}`;
    if (item.foodKg) return `${name} · ${this.amount('foodKg', item.foodKg)}`;
    if (item.waterL) return `${name} · ${this.amount('waterL', item.waterL)}`;
    if (item.shield) return `${name} · ${this.amount('shield', item.shield)}`;
    return name;
  }
}
