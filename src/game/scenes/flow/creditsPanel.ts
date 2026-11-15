import Phaser from 'phaser';
import { CREDIT_SECTIONS, NASA_MEDIA_GUIDELINES, type Credit } from '../../../content/credits';
import { t } from '../../../i18n';
import { audio } from '../../audio/audio';
import { addKeyButton, addText, COLOR, KEY_BUTTON, onKeys, PANEL, popIn, reducedMotion } from '../../ui/ui';

/** Marco del panel, la ventana que se desplaza y su barra (px de pantalla). */
const BOX = { x: 100, y: 36, width: 1080, height: 648 } as const;
const VIEW = { x: 136, y: 132, width: 1000, height: 470 } as const;
const BAR = { x: 1150, width: 4 } as const;
/**
 * La lista se arma lejos del resto (fuera de la pantalla) y la muestra una cámara propia recortada a `VIEW`:
 * así lo que sale de la ventana queda cortado sin máscaras.
 */
const WORLD = { x: 6000, y: 0 } as const;
const SCROLL_STEP = 48;
const GAP = { line: 3, entry: 18, section: 14, header: 34 } as const;

/**
 * Créditos (menú principal → Créditos): equipo y desafío, datos de la NASA con su uso en el juego, imágenes de la
 * NASA, herramientas de IA y programas. Contenido en `content/credits.ts`; textos en `menu.credits.*`. ↑ ↓, la rueda
 * o RePág/AvPág desplazan; un clic en un enlace lo abre en otra pestaña; Q, Esc o el botón cierran.
 */
export function openCredits(scene: Phaser.Scene, onClose: () => void): void {
  const { width, height } = scene.scale;
  const layer = scene.add.container(0, 0).setDepth(1000);
  const shade = scene.add.rectangle(0, 0, width, height, PANEL.shade, 0.8).setOrigin(0, 0).setInteractive();
  const box = scene.add.container(0, 0);
  const frame = scene.add
    .graphics()
    .fillStyle(PANEL.fill, 0.97)
    .fillRoundedRect(BOX.x, BOX.y, BOX.width, BOX.height, 14)
    .lineStyle(2, PANEL.stroke)
    .strokeRoundedRect(BOX.x, BOX.y, BOX.width, BOX.height, 14)
    .lineStyle(2, 0x90cdf4, 0.25)
    .lineBetween(BOX.x + 18, BOX.y + 1, BOX.x + BOX.width - 18, BOX.y + 1);
  const title = addText(scene, width / 2, BOX.y + 26, 26, COLOR.title, { fontStyle: 'bold' }).setOrigin(0.5, 0).setText(t('menu.credits.title'));
  const subtitle = addText(scene, width / 2, BOX.y + 64, 14, COLOR.muted).setOrigin(0.5, 0).setText(t('menu.credits.subtitle'));
  const rule = (y: number) => scene.add.rectangle(VIEW.x, y, VIEW.width + 18, 1, PANEL.stroke, 0.8).setOrigin(0, 0.5);
  const hint = addText(scene, VIEW.x, BOX.y + BOX.height - 34, 13, COLOR.dim).setOrigin(0, 0.5).setText(t('menu.credits.hint'));
  const track = scene.add.rectangle(BAR.x, VIEW.y, BAR.width, VIEW.height, 0x1e293b).setOrigin(0, 0);
  const thumb = scene.add.rectangle(BAR.x, VIEW.y, BAR.width, 40, 0x90cdf4, 0.7).setOrigin(0, 0);
  const close = () => {
    if (closed) return;
    closed = true;
    audio.sfx('back');
    scene.input.off(Phaser.Input.Events.POINTER_WHEEL, onWheel);
    scene.tweens.killTweensOf(scroll);
    scene.cameras.remove(camera);
    content.destroy();
    layer.destroy();
    onClose();
  };
  const button = addKeyButton(scene, BOX.x + BOX.width - KEY_BUTTON.margin, BOX.y + BOX.height - 14, 'Q', t('menu.credits.close'), close, { sfx: null });
  box.add([frame, title, subtitle, rule(VIEW.y - 10), rule(VIEW.y + VIEW.height + 10), hint, track, thumb, button]);
  layer.add([shade, box]);
  popIn(scene, box, { from: 0.97 });

  const content = scene.add.container(WORLD.x, WORLD.y).setDepth(1001);
  const contentHeight = buildList(scene, content);
  const camera = scene.cameras.add(VIEW.x, VIEW.y, VIEW.width, VIEW.height).setScroll(WORLD.x, WORLD.y);
  const maxScroll = Math.max(0, contentHeight - VIEW.height);
  track.setVisible(maxScroll > 0);
  thumb.setVisible(maxScroll > 0);
  const thumbHeight = Math.max(30, (VIEW.height * VIEW.height) / Math.max(contentHeight, 1));
  thumb.setSize(BAR.width, thumbHeight);
  content.setAlpha(0);
  scene.tweens.add({ targets: content, alpha: 1, duration: 260, delay: 80 });

  let closed = false;
  let target = 0;
  const scroll = { value: 0 };
  const place = () => {
    camera.setScroll(WORLD.x, WORLD.y + Math.round(scroll.value));
    thumb.setY(VIEW.y + (maxScroll ? (scroll.value / maxScroll) * (VIEW.height - thumbHeight) : 0));
  };
  const scrollTo = (value: number) => {
    target = Phaser.Math.Clamp(value, 0, maxScroll);
    scene.tweens.killTweensOf(scroll);
    if (reducedMotion()) {
      scroll.value = target;
      place();
    } else scene.tweens.add({ targets: scroll, value: target, duration: 140, ease: 'Cubic.Out', onUpdate: place });
  };
  const onWheel = (_pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
    if (!closed) scrollTo(target + dy);
  };
  scene.input.on(Phaser.Input.Events.POINTER_WHEEL, onWheel);
  onKeys(scene, (code) => {
    if (closed) return;
    if (code === 'ArrowUp' || code === 'KeyW') scrollTo(target - SCROLL_STEP);
    else if (code === 'ArrowDown' || code === 'KeyS') scrollTo(target + SCROLL_STEP);
    else if (code === 'PageUp') scrollTo(target - VIEW.height * 0.9);
    else if (code === 'PageDown' || code === 'Space') scrollTo(target + VIEW.height * 0.9);
    else if (code === 'Home') scrollTo(0);
    else if (code === 'End') scrollTo(maxScroll);
    else if (code === 'Escape' || code === 'KeyQ' || code === 'Enter' || code === 'NumpadEnter') close();
  });
  place();
}

/** Arma la lista dentro de `content` (coordenadas desde su esquina) y devuelve su alto. */
function buildList(scene: Phaser.Scene, content: Phaser.GameObjects.Container): number {
  const wrap = VIEW.width - 8;
  let y = 4;
  const add = <T extends Phaser.GameObjects.GameObject>(object: T) => {
    content.add(object);
    return object;
  };
  const paragraph: Paragraph = (text, size, color, top) =>
    add(addText(scene, 0, top, size, color).setText(text).setWordWrapWidth(wrap).setLineSpacing(GAP.line));

  y += paragraph(t('menu.credits.ownership'), 14, COLOR.text, y).height + GAP.entry + 6;
  for (const section of CREDIT_SECTIONS) {
    add(addText(scene, 0, y, 18, COLOR.focus, { fontStyle: 'bold' }).setText(t(`menu.credits.section.${section.id}`)));
    add(scene.add.rectangle(0, y + 26, wrap, 1, 0xfbd38d, 0.35).setOrigin(0, 0.5));
    y += GAP.header;
    for (const credit of section.credits) y = entry(scene, add, paragraph, credit, y, wrap) + GAP.entry;
    y += GAP.section;
  }
  y += paragraph(t('menu.credits.disclaimer'), 12, COLOR.muted, y).height + 4;
  y += link(scene, add, NASA_MEDIA_GUIDELINES, 0, y).height;
  return y + 8;
}

type Add = <T extends Phaser.GameObjects.GameObject>(object: T) => T;
type Paragraph = (text: string, size: number, color: string, top: number) => Phaser.GameObjects.Text;

/** Un crédito: nombre y licencia, autor, para qué se usa, archivos del repo y enlace. Devuelve dónde termina. */
function entry(scene: Phaser.Scene, add: Add, paragraph: Paragraph, credit: Credit, top: number, wrap: number): number {
  let y = top;
  const license = add(addText(scene, wrap, y + 2, 12, COLOR.ok).setOrigin(1, 0).setText(t(`menu.credits.license.${credit.license}`)));
  const name = add(
    addText(scene, 0, y, 15, COLOR.text, { fontStyle: 'bold' })
      .setText(credit.name)
      .setWordWrapWidth(wrap - license.width - 24)
      .setLineSpacing(GAP.line),
  );
  y += name.height + 2;
  y += add(addText(scene, 0, y, 12, COLOR.muted).setText(credit.by).setWordWrapWidth(wrap)).height + 4;
  y += paragraph(t(`menu.credits.${credit.id}.use`), 13, COLOR.text, y).height + 2;
  if (credit.files?.length) y += paragraph(t('menu.credits.files', { files: credit.files.join(' · ') }), 12, COLOR.dim, y).height + 2;
  if (credit.url) y += link(scene, add, credit.url, 0, y).height;
  return y;
}

/** Enlace: se resalta al pasar el mouse y se abre en otra pestaña con un clic. */
function link(scene: Phaser.Scene, add: Add, url: string, x: number, y: number): Phaser.GameObjects.Text {
  const text = add(addText(scene, x, y, 12, COLOR.link).setText(url));
  text.setInteractive({ useHandCursor: true });
  text.on('pointerover', () => text.setColor(COLOR.focus));
  text.on('pointerout', () => text.setColor(COLOR.link));
  text.on('pointerdown', () => {
    audio.sfx('select');
    window.open(url, '_blank', 'noopener');
  });
  return text;
}
