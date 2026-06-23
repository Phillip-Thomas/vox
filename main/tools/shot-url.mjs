// Generic headed-GPU screenshot of any dev URL (for the test harnesses).
//   node tools/shot-url.mjs --url=http://localhost:5173/rock-test.html --label=rocks --wait=3000
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..', 'captures');
const EXE = 'C:/Users/Phillip/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const arg = (n, d) => { const h = process.argv.find(a => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : d; };

const url = arg('url', 'http://localhost:5173/rock-test.html');
const label = arg('label', 'shot');
const wait = Number(arg('wait', '3000'));

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: EXE, headless: false, args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERR', e.message.slice(0, 200)));
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(wait);
await page.screenshot({ path: resolve(OUT, `${label}.png`) });
console.log('wrote', `captures/${label}.png`);
await browser.close();
