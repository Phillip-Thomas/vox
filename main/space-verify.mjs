import { chromium } from 'playwright-core';
const EXE = 'C:/Users/Phillip/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const BASE = process.env.BASE || 'http://localhost:4173';
const browser = await chromium.launch({
  executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
page.on('pageerror', e => errors.push('PAGEERR: ' + e.message.slice(0, 200)));
async function shot(url, name, waitMs = 4500) {
  errors.length = 0;
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(waitMs);
  await page.screenshot({ path: name });
  console.log(`== ${name}  errors: ${errors.length ? errors.slice(0,4) : 'NONE'}`);
}
await shot(BASE + '/?dayphase=0.25&profile=HIGH', 'sky_noon.png');
await shot(BASE + '/?dayphase=0.78&profile=HIGH', 'sky_night.png');
await browser.close();
console.log('DONE');
