// Captura una escena del servidor de desarrollo con Chrome sin ventana (protocolo DevTools, sin dependencias).
// Uso: [FRAMES=n INTERVAL=ms] node scripts/art/capture.mjs "<url>" <salida.png> [espera en ms] [teclas, p. ej. "d:1500,s:800"]
// Las teclas se mantienen apretadas el tiempo indicado, en orden, antes de capturar.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, out, wait = '5000', keys = ''] = process.argv.slice(2);
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9300 + Math.floor(process.pid % 500);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'captura-'))}`,
  '--enable-unsafe-swiftshader', '--hide-scrollbars', '--window-size=1280,720', 'about:blank',
], { stdio: 'ignore' });

try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    target = await fetch(`http://127.0.0.1:${PORT}/json`).then((r) => r.json()).then((l) => l.find((t) => t.type === 'page')).catch(() => undefined);
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id) pending.get(msg.id)?.(msg.result);
    else if (msg.method === 'Runtime.exceptionThrown') console.error('[excepción]', msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
    else if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) console.error(`[${msg.params.type}]`, msg.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 300));
  };
  const send = (method, params = {}) => new Promise((r) => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  await sleep(Number(wait));
  for (const step of keys.split(',').filter(Boolean)) {
    const [key, ms] = step.split(':');
    const special = { Tab: 9, Enter: 13, Escape: 27, Space: 32 }[key];
    const event = special ? { key, code: key, windowsVirtualKeyCode: special } : { key, code: `Key${key.toUpperCase()}`, windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0) };
    await send('Input.dispatchKeyEvent', { type: 'keyDown', ...event });
    await sleep(Number(ms));
    await send('Input.dispatchKeyEvent', { type: 'keyUp', ...event });
    await sleep(Number(process.env.AFTER_KEYS ?? 300));
  }
  // AFTER_KEYS=ms: espera después de soltar cada tecla (300 por defecto).
  // FRAMES=n INTERVAL=ms: varias capturas seguidas (salida-0.png, salida-1.png…), para ver movimiento.
  const frames = Number(process.env.FRAMES ?? 1);
  for (let i = 0; i < frames; i++) {
    if (i > 0) await sleep(Number(process.env.INTERVAL ?? 100));
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    const file = frames > 1 ? out.replace(/\.png$/, `-${i}.png`) : out;
    writeFileSync(file, Buffer.from(data, 'base64'));
    console.log(`${file}: ${Buffer.from(data, 'base64').length} bytes`);
  }
} finally {
  chrome.kill();
}
