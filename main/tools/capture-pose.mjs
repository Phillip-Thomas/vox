// One-off: capture at an EXACT camera pose (pos + quaternion) via window.__game.
// Computes the look target from the quaternion and uses lookFrom (which publishes a
// surface point so foliage/stones stream around the subject).
//   node tools/capture-pose.mjs --label=X --world=93,-9 --day=0.0568 --pos=54.139,26.072,23.78 --quat=0.693,0.5777,0.4077,0.1407
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..', 'captures');
const EXE = 'C:/Users/Phillip/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const arg = (n, d) => { const h = process.argv.find(a => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : d; };

const label = arg('label', 'pose');
const world = arg('world', '0,0');
const day = arg('day', '0.3');
const pos = arg('pos', '0,0,0').split(',').map(Number);
const q = arg('quat', '0,0,0,1').split(',').map(Number); // x,y,z,w

// forward = q * (0,0,-1) ; target = pos + forward*dist
const [qx, qy, qz, qw] = q;
const vx = 0, vy = 0, vz = -1;
const tx = 2 * (qy * vz - qz * vy), ty = 2 * (qz * vx - qx * vz), tz = 2 * (qx * vy - qy * vx);
const fx = vx + qw * tx + (qy * tz - qz * ty);
const fy = vy + qw * ty + (qz * tx - qx * tz);
const fz = vz + qw * tz + (qx * ty - qy * tx);
const D = 7;
const targetArg = arg('target', '');
const target = targetArg
  ? targetArg.split(',').map(Number)
  : [pos[0] + fx * D, pos[1] + fy * D, pos[2] + fz * D];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: EXE, headless: false, args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERR', e.message.slice(0, 200)));
const url = `http://localhost:5173/?agent=1&world=${encodeURIComponent(world)}&dayphase=${day}&profile=HIGH`;
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForFunction(() => !!window.__game, null, { timeout: 30000 });
await page.evaluate(() => window.__game.ready());
await page.evaluate(([p, t]) => window.__game.lookFrom(p[0], p[1], p[2], t[0], t[1], t[2]), [pos, target]);
await page.waitForTimeout(1500);
await page.screenshot({ path: resolve(OUT, `${label}.png`) });
console.log('wrote', `captures/${label}.png`, 'target', target.map(n => n.toFixed(2)).join(','));
await browser.close();
