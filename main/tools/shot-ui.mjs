// One-off headed screenshot of the new UI: landing menu (loading + ready) and
// the in-game HUD after Play. Real GPU (not headless SwiftShader).
//   node tools/shot-ui.mjs
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..', 'captures');
const EXE = 'C:/Users/Phillip/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const BASE = process.env.GAME_URL || 'http://localhost:5173/';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: EXE,
  headless: false,
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11']
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', m => { if (m.type() === 'error') console.log('PAGE ERR:', m.text()); });

const shot = async (name) => {
  try {
    await page.screenshot({ path: resolve(OUT, name), timeout: 60000, animations: 'disabled' });
    console.log('shot', name);
  } catch (e) { console.log('shot FAILED', name, e.message); }
};

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(e => console.log('goto warn', e.message));

// Frame 1: early (loading cover should hide the cold render).
await page.waitForTimeout(700);
await shot('ui_loading.png');

// Wait for the world to warm up + the Play button to enable. (Unfocused
// Playwright windows throttle rAF to ~1fps, so allow generous time for the
// 8-frame ready gate — a real focused tab hits it in ~130ms.)
await page.waitForFunction(
  () => [...document.querySelectorAll('button')].some(b => /play now/i.test(b.textContent || '') && !b.disabled),
  null, { timeout: 30000 }
).catch(() => console.log('ready timeout'));
await page.waitForTimeout(1200);
await shot('ui_landing.png');

// Try to click Play Now (enabled once sceneReady).
const clicked = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => /play now/i.test(b.textContent || ''));
  if (btn && !btn.disabled) { btn.click(); return true; }
  return false;
});
console.log('Play clicked:', clicked);
await page.waitForTimeout(2000);
await shot('ui_ingame.png');

await browser.close();
console.log('Wrote captures/ui_loading.png, ui_landing.png, ui_ingame.png');
