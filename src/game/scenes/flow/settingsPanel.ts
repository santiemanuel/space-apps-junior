import Phaser from 'phaser';
import { loadSettings, saveSettings, type Settings } from '../../../core/save/save';
import type { SaveStore } from '../../../core/save/SaveStore';
import { getLocale, LOCALES, setLocale, t } from '../../../i18n';
import { flagTextureKey } from '../../assets';
import { audio } from '../../audio/audio';
import { addButton, addText, COLOR, onKeys, popIn } from '../../ui/ui';

type Row = 'sound' | 'music' | 'language' | 'back';
const ROWS: readonly Row[] = ['sound', 'music', 'language', 'back'];
const STEP = 0.1;
/** Alto de cada fila (entra la bandera del idioma ×2) y su posición. */
const ROW_H = 56;
const ROW_Y = (index: number) => -72 + index * 62;
/** Centro de los valores (con sus flechas a los lados) y escala de la bandera del idioma (pixel art ×2). */
const VALUE_X = 90;
const ARROW_DX = 120;
const FLAG_SCALE = 2;
const FLAG_GAP = 10;

/** Aplica el volumen guardado al sonido del juego. */
export function applyVolume(scene: Phaser.Scene, settings: Settings): void {
  scene.sound.volume = settings.sound ?? 0.8;
  audio.setVolumes(settings.sound ?? 0.8, settings.music ?? 0.6);
}

/**
 * Panel de opciones (menú principal y pausa): volumen de sonidos, volumen de música e idioma. Cada valor tiene sus
 * flechas ‹ (bajar) y › (subir) para el mouse (el idioma, con su bandera); con el teclado, ↑ ↓ eligen y ← → cambian. Guarda cada cambio.
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
  const bar = scene.add.rectangle(0, 0, 460, ROW_H, 0xfbd38d, 0.12);
  const accent = scene.add.rectangle(-230, 0, 3, 38, 0xfbd38d).setOrigin(0, 0.5);
  const focusBar = scene.add.container(0, ROW_Y(0), [bar, accent]);
  focusBar.once(Phaser.GameObjects.Events.DESTROY, () => scene.tweens.killTweensOf(focusBar));
  let cursor = 0;
  let closed = false;

  const rows = ROWS.map((row, index) => {
    const y = ROW_Y(index);
    // Toda la fila toma el foco, incluido el espacio a los lados de «Volver».
    const hit = scene.add.rectangle(0, y, 460, ROW_H, 0xffffff, 0.001).setInteractive();
    hit.on('pointerover', () => focus(index));
    if (row === 'back') {
      hit.input!.cursor = 'pointer';
      hit.on('pointerdown', () => close());
      const label = addText(scene, 0, y, 16).setOrigin(0.5);
      return { row, label, value: null, arrows: [], hit, flag: null };
    }
    const label = addText(scene, -210, y, 17).setOrigin(0, 0.5);
    const value = addText(scene, VALUE_X, y, 17).setOrigin(row === 'language' ? 0 : 0.5, 0.5);
    const flag = row === 'language' ? scene.add.image(0, y, flagTextureKey(getLocale())).setOrigin(0, 0.5).setScale(FLAG_SCALE) : null;
    flag?.once(Phaser.GameObjects.Events.DESTROY, () => scene.tweens.killTweensOf(flag));
    const arrows = ([-1, 1] as const).map((delta) =>
      addButton(scene, VALUE_X + delta * ARROW_DX, y, () => change(row, delta), { size: 18, onHover: () => focus(index, false) }).setLabel(delta < 0 ? '‹' : '›'),
    );
    return { row, label, value, arrows, hit, flag };
  });
  box.add([panel, focusBar, title]);
  for (const r of rows) {
    box.add(r.hit);
    box.add([r.label, r.value, ...r.arrows.map((a) => a.text)].filter((o): o is Phaser.GameObjects.Text => !!o));
    if (r.flag) box.add(r.flag);
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
      if (r.row === 'back') r.label.setText(t('menu.settings.back')).setColor(focused ? COLOR.focus : COLOR.text);
      else {
        const [label, value] = labels[r.row as Exclude<Row, 'back'>];
        r.label!.setText(label).setColor(focused ? COLOR.focus : COLOR.text);
        r.value!.setText(value).setColor(focused ? COLOR.focus : COLOR.text);
        if (r.flag) placeFlag(r.flag, r.value!);
      }
    });
  };
  /** Bandera del idioma elegido y su nombre, juntos y centrados entre las flechas. */
  const placeFlag = (flag: Phaser.GameObjects.Image, value: Phaser.GameObjects.Text) => {
    const key = flagTextureKey(getLocale());
    flag.setVisible(scene.textures.exists(key));
    if (flag.visible) flag.setTexture(key);
    const flagWidth = flag.visible ? flag.displayWidth + FLAG_GAP : 0;
    const left = Math.round(VALUE_X - (flagWidth + value.width) / 2);
    flag.setX(left);
    value.setX(left + flagWidth);
  };
  /** Al cambiar de idioma, la bandera nueva da un saltito. */
  const hopFlag = () => {
    const flag = rows.find((r) => r.flag)?.flag;
    if (!flag || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const y = ROW_Y(ROWS.indexOf('language'));
    scene.tweens.killTweensOf(flag);
    flag.setY(y - 8);
    scene.tweens.add({ targets: flag, y, duration: 260, ease: 'Bounce.Out' });
  };
  const focus = (index: number, sound = true) => {
    if (closed || index === cursor) return;
    // Las flechas ya reproducen su propio hover: no duplicarlo al cambiar de fila.
    if (sound) audio.sfx('hover');
    cursor = index;
    scene.tweens.killTweensOf(focusBar);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) focusBar.setY(ROW_Y(index));
    else scene.tweens.add({ targets: focusBar, y: ROW_Y(index), duration: 140, ease: 'Cubic.Out' });
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
    if (row === 'language') hopFlag();
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
