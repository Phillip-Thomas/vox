import { chromium } from 'playwright-core';

const EXE = 'C:/Users/Phillip/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const BASE = process.env.BASE || 'http://localhost:5174';

const browser = await chromium.launch({
  executablePath: EXE,
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
page.on('pageerror', e => errors.push('PAGEERR: ' + e.message.slice(0, 300)));

async function shot(url, name, waitMs = 4000) {
  errors.length = 0;
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(waitMs);
  await page.screenshot({ path: name });
  console.log(`\n== ${name}  (${url})`);
  console.log('   errors:', errors.length ? errors.slice(0, 8) : 'NONE');
  return [...errors];
}

await shot(BASE + '/?profile=HIGH', 'space_surface.png');
await shot(BASE + '/?fly=1&profile=HIGH', 'space_deep.png', 5000);

// From deep space, trigger a travel warp via the Set Course button (X=1,Y=0).
errors.length = 0;
const btn = await page.$('button:has-text("Set Course")');
console.log('\n== travel: Set Course button found:', !!btn);
if (btn) await btn.click();
await page.waitForTimeout(650);                 // ~mid-warp white-out
await page.screenshot({ path: 'space_warp.png' });
await page.waitForTimeout(3000);                // after arrival
await page.screenshot({ path: 'space_arrived.png' });
console.log('   travel errors:', errors.length ? errors.slice(0, 8) : 'NONE');

// Report the live flight phase text from the HUD/overlay if present.
const phaseText = await page.evaluate(() => {
  const el = [...document.querySelectorAll('div')].find(d => /Flight:/.test(d.textContent || ''));
  return el ? el.textContent.replace(/\s+/g, ' ').trim().slice(0, 80) : 'n/a';
});
console.log('   overlay flight readout:', phaseText);

await browser.close();
console.log('\nDONE');
