// Masteriza la banda sonora para el juego y mide sus puntos de loop.
// Uso: node scripts/audio/master-music.mjs <carpeta con los MP3 originales>   (requiere ffmpeg en el PATH)
//
// Cada pista:
//  1. Se mide su sonoridad integrada (EBU R128) y se lleva a TARGET_LUFS con una ganancia lineal (no comprime).
//  2. Pasa-altos suave a 22 Hz (saca el subgrave que no se oye y come margen) y limitador a LIMIT_DB por si la
//     ganancia hace pasar algún pico.
//  3. Se recortan los silencios del principio y del final, con fundidos de 10/50 ms contra clics.
//  4. MP3 160 kbps, 48 kHz, sin metadatos → public/assets/audio/music/<nombre>.mp3.
// Después se mide la pista ya masterizada (RMS cada 0,5 s) para el loop: `loopAt` es donde empieza el final que se
// apaga solo (o, si corta de golpe, un poco antes del corte) y `loopFade` cuánto dura el fundido cruzado con la
// vuelta a empezar. Todo va a src/game/audio/musicTracks.json, que lee `themes.ts`. La mezcla (cuánto suena cada
// pista en el juego, sus fundidos de entrada) se decide a mano en `MUSIC` de themes.ts.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TARGET_LUFS = -16;
const LIMIT_DB = -2;
const WINDOW_S = 0.5;
/** Por debajo de esto (dBFS RMS) la pista ya no se oye. */
const AUDIBLE_DB = -45;
/** El final empieza donde el RMS cae más de esto bajo la mediana (o bajo −40 dBFS). */
const TAIL_DROP_DB = 15;
const MIN_FADE_S = 1.5;
const MAX_FADE_S = 6;

const source = process.argv[2];
if (!source) {
  console.error('Uso: node scripts/audio/master-music.mjs <carpeta con los MP3 originales>');
  process.exit(1);
}
const outDir = new URL('../../public/assets/audio/music/', import.meta.url);
const jsonOut = new URL('../../src/game/audio/musicTracks.json', import.meta.url);
mkdirSync(outDir, { recursive: true });

const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

function ffmpeg(args) {
  const run = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (run.status !== 0) throw new Error(run.stderr);
  return run.stderr;
}

function loudness(file) {
  const out = ffmpeg(['-i', file, '-af', 'loudnorm=print_format=json', '-f', 'null', '-']);
  const json = JSON.parse(out.slice(out.lastIndexOf('{')));
  return { lufs: Number(json.input_i), truePeak: Number(json.input_tp), lra: Number(json.input_lra) };
}

/** RMS (dBFS) por ventana de WINDOW_S. */
function rmsWindows(file) {
  const out = ffmpeg([
    '-i', file, '-af',
    `aresample=48000,asetnsamples=${48000 * WINDOW_S},astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level`,
    '-f', 'null', '-',
  ]);
  return [...out.matchAll(/RMS_level=(-?[\d.]+|-inf)/g)].map((m) => (m[1] === '-inf' ? -120 : Number(m[1])));
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const tracks = {};
for (const name of readdirSync(source).filter((f) => f.endsWith('.mp3')).sort()) {
  const id = basename(name, '.mp3');
  const input = join(source, name);
  const file = fileURLToPath(new URL(`${id}.mp3`, outDir));
  const before = loudness(input);
  const gain = TARGET_LUFS - before.lufs;
  const trim = 'silenceremove=start_periods=1:start_threshold=-60dB';
  const filter = [
    'highpass=f=22:poles=2',
    `volume=${gain.toFixed(2)}dB`,
    `alimiter=limit=${(10 ** (LIMIT_DB / 20)).toFixed(4)}:attack=3:release=60:level=disabled`,
    trim,
    'areverse',
    trim,
    'afade=t=in:d=0.05',
    'areverse',
    'afade=t=in:d=0.01',
  ].join(',');
  ffmpeg(['-y', '-i', input, '-vn', '-af', filter, '-ar', '48000', '-c:a', 'libmp3lame', '-b:a', '160k', '-map_metadata', '-1', file]);

  const after = loudness(file);
  const rms = rmsWindows(file);
  const duration = rms.length * WINDOW_S;
  const floor = Math.max(median(rms) - TAIL_DROP_DB, -40);
  let end = rms.length - 1;
  while (end > 0 && rms[end] < AUDIBLE_DB) end--;
  let tail = end;
  while (tail > 0 && rms[tail] < floor) tail--;
  const endS = (end + 1) * WINDOW_S;
  const tailS = (tail + 1) * WINDOW_S;
  const loopFade = Math.min(MAX_FADE_S, Math.max(MIN_FADE_S, endS - tailS));
  const loopAt = Math.min(tailS, endS - loopFade);
  tracks[id] = { duration: round(duration, 1), loopAt: round(loopAt, 1), loopFade: round(loopFade, 1), lufs: after.lufs };
  console.log(
    `${id.padEnd(26)} ${before.lufs.toFixed(1)} → ${after.lufs.toFixed(1)} LUFS · TP ${after.truePeak.toFixed(1)} dB · ` +
      `${duration.toFixed(1)} s · loop en ${loopAt.toFixed(1)} s (fundido ${loopFade.toFixed(1)} s)`,
  );
}
writeFileSync(jsonOut, `${JSON.stringify(tracks, null, 2)}\n`);
