import Phaser from 'phaser';
import { loadSettings, saveSettings, type Settings } from '../../../core/save/save';
import type { SaveStore } from '../../../core/save/SaveStore';
import { getLocale, LOCALES, setLocale, t } from '../../../i18n';
import { audio } from '../../audio/audio';
import { addButton, addText, COLOR, onKeys, popIn, type Button } from '../../ui/ui';

type Row = 'sound' | 'music' | 'language' | 'back';
const ROWS: readonly Row[] = ['sound', 'music', 'language', 'back'];
const STEP = 0.1;
const ROW_Y = (index: number) => -64 + index * 54;

/** Aplica el volumen guardado al sonido del juego. */
export function applyVolume(scene: Phaser.Scene, settings: Settings): void {
  scene.sound.volume = settings.sound ?? 0.8;
  audio.setVolumes(settings.sound ?? 0.8, settings.music ?? 0.6);
}

/**
 * Panel de opciones (menú principal y pausa): volumen de sonidos, volumen de música e idioma. Cada valor tiene sus
 * flechas ‹ (bajar) y › (subir) para el mouse; con el teclado, ↑ ↓ eligen y ← → cambian. Guarda cada cambio.
 * `onClose` vuelve a quien lo abrió (con `true` si cambió el idioma).
 */
export function openSettings(scene: Phaser.Scene, store: SaveStore, onClose: (changedLocale: boolean) => void): void {
  const settings: Settings = { sound: 0.8, music: 0.6, ...loadSettings(store) };
  const startLocale = getLocale();
  const { width, height } = scene.scale;
  const layer = scene.add.container(0, 0).setDepth(1000);
  const shade = scene.add.rectangle(0, 0, width, height, 0x05070d, 0.7).setOrigin(0, 0).setInteractive();
  const box = scene.add.container(width / 2, height / 2);
  const panel = scene.add.rectangle(0, 0, 500, 320, 0x111827, 0.96).setStrokeStyle(2, 0x4a5568);
  const title = addText(scene, 0, -124, 24, COLOR.title).setOrigin(0.5);
  const focusBar = scene.add.rectangle(0, ROW_Y(0), 460, 44, 0xfbd38d, 0.12);
  let cursor = 0;
  let closed = false;

  const rows = ROWS.map((row, index) => {
    const y = ROW_Y(index);
    if (row === 'back') {
      const back = addButton(scene, 0, y, () => close(), { size: 16, onHover: () => focus(index) });
      return { row, label: null, value: null, back, arrows: [] as Button[] };
    }
    const label = addText(scene, -210, y, 17).setOrigin(0, 0.5);
    const value = addText(scene, 120, y, 17).setOrigin(0.5);
    const arrows = ([-1, 1] as const).map((delta) =>
      addButton(scene, 120 + delta * 90, y, () => change(row, delta), { size: 18, onHover: () => focus(index) }).setLabel(delta < 0 ? '‹' : '›'),
    );
    // La fila entera responde al mouse: pasar por encima la elige.
    const hit = scene.add.rectangle(0, y, 460, 44, 0xffffff, 0.001).setInteractive();
    hit.on('pointerover', () => focus(index));
    return { row, label, value, back: null, arrows, hit };
  });
  box.add([panel, focusBar, title]);
  for (const r of rows) {
    if ('hit' in r && r.hit) box.add(r.hit);
    box.add([r.label, r.value, r.back?.text, ...r.arrows.map((a) => a.text)].filter((o): o is Phaser.GameObjects.Text => !!o));
  }
  layer.add([shade, box]);
  popIn(scene, box);

  const percent = (v: number | undefined) => `${Math.round((v ?? 0) * 100)} %`;
  const render = () => {
    title.setText(t('menu.settings.title'));
    const labels: Record<Exclude<Row, 'back'>, [string, string]> = {
      sound: [t('menu.settings.sound'), percent(settings.sound)],
      music: [t('menu.settings.music'), percent(settings.music)],
      language: [t('menu.title.language'), t(`common.language.${getLocale()}`)],
    };
    rows.forEach((r, i) => {
      const focused = i === cursor;
      if (r.back) r.back.setLabel(t('menu.settings.back')).setFocused(focused);
      else {
        const [label, value] = labels[r.row as Exclude<Row, 'back'>];
        r.label!.setText(label).setColor(focused ? COLOR.focus : COLOR.text);
        r.value!.setText(value).setColor(focused ? COLOR.focus : COLOR.text);
      }
    });
    focusBar.setY(ROW_Y(cursor));
  };
  const focus = (index: number) => {
    if (index === cursor) return;
    audio.sfx('hover');
    cursor = index;
    render();
  };
  const save = () => {
    saveSettings(store, { ...settings, locale: getLocale() });
    applyVolume(scene, settings);
  };
  /** ‹ baja y › sube (el idioma pasa al anterior o al siguiente). */
  const change = (row: Row, delta: -1 | 1) => {
    if (closed || row === 'back') return;
    if (row === 'language') setLocale(LOCALES[(LOCALES.indexOf(getLocale()) + delta + LOCALES.length) % LOCALES.length]!);
    else settings[row] = Math.round(Math.min(1, Math.max(0, (settings[row] ?? 0) + delta * STEP)) * 10) / 10;
    audio.sfx('toggle', delta < 0 ? 0.85 : 1.15);
    save();
    render();
  };
  const close = () => {
    if (closed) return;
    closed = true;
    audio.sfx('back');
    layer.destroy();
    onClose(getLocale() !== startLocale);
  };
  onKeys(scene, (code) => {
    if (closed) return;
    const row = ROWS[cursor]!;
    if (code === 'ArrowUp' || code === 'KeyW') focus((cursor - 1 + ROWS.length) % ROWS.length);
    else if (code === 'ArrowDown' || code === 'KeyS') focus((cursor + 1) % ROWS.length);
    else if (code === 'ArrowLeft' || code === 'KeyA') change(row, -1);
    else if (code === 'ArrowRight' || code === 'KeyD') change(row, 1);
    else if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') {
      if (row === 'back') close();
      else change(row, 1);
    } else if (code === 'Escape' || code === 'KeyQ') close();
  });
  render();
}
