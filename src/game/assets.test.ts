import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { CREW_ROSTER } from '../content/crew';
import { BOOT_ASSETS, CREW_ASSETS, CREW_SHEET, crewTextureKey, queueAssets, type AssetEntry } from './assets';

const PUBLIC_DIR = join(import.meta.dirname, '..', '..', 'public');
const urlsOf = (entry: AssetEntry): string[] => (entry.kind === 'audio' ? entry.urls : [entry.url]);

/** Ancho y alto de un PNG leídos de su cabecera IHDR. */
function pngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe('recursos de Boot', () => {
  it('cada tripulante tiene su hoja de sprites', () => {
    expect(CREW_ASSETS.map((entry) => entry.key)).toEqual(CREW_ROSTER.map(({ id }) => crewTextureKey(id)));
  });

  it('no repite claves', () => {
    const keys = BOOT_ASSETS.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each(BOOT_ASSETS.flatMap(urlsOf))('el archivo %s existe en public/ y la ruta es relativa', (url) => {
    expect(url.startsWith('/')).toBe(false);
    expect(existsSync(join(PUBLIC_DIR, url)), url).toBe(true);
  });

  it.each(CREW_ASSETS.map((entry) => [entry.key, entry] as const))(
    'la hoja %s mide exactamente 9 × 4 cuadros de 176×216',
    (_key, entry) => {
      if (entry.kind !== 'spritesheet') throw new Error(`${entry.key} debería ser spritesheet`);
      expect(pngSize(join(PUBLIC_DIR, entry.url))).toEqual({
        width: CREW_SHEET.columns * entry.frame.frameWidth,
        height: CREW_SHEET.rows * entry.frame.frameHeight,
      });
    },
  );

  it('encola cada recurso con el método del loader que corresponde a su tipo', () => {
    const load = { spritesheet: vi.fn(), image: vi.fn(), audio: vi.fn() };
    const frame = { frameWidth: 48, frameHeight: 48 };
    queueAssets(load as never, [
      { kind: 'spritesheet', key: 'hoja', url: 'assets/hoja.png', frame },
      { kind: 'image', key: 'piso', url: 'assets/piso.png' },
      { kind: 'audio', key: 'alarma', urls: ['assets/alarma.ogg', 'assets/alarma.mp3'] },
    ]);
    expect(load.spritesheet).toHaveBeenCalledWith('hoja', 'assets/hoja.png', frame);
    expect(load.image).toHaveBeenCalledWith('piso', 'assets/piso.png');
    expect(load.audio).toHaveBeenCalledWith('alarma', ['assets/alarma.ogg', 'assets/alarma.mp3']);
  });
});
