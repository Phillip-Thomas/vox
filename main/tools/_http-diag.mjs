import { chromium } from 'playwright-core';
import { CHROMIUM_ARGS, chromePath, startParavoxiaPreview } from './lib/previewServer.mjs';
const preview = await startParavoxiaPreview({ build: false });
const probe = async (label) => {
  for (const q of ['', '?story=ch3-dusk&movie=1&profile=LOW', '?story=descent&movie=1&profile=LOW']) {
    const res = await fetch(preview.url + q);
    console.log(label, 'GET', q || '/', '->', res.status, res.headers.get('content-type'));
  }
};
await probe('before');
const browser = await chromium.launch({ headless: true, executablePath: chromePath(), args: CHROMIUM_ARGS });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
page.on('response', r => { if (r.status() >= 400) console.log('page saw', r.status(), r.url().slice(-80)); });
await page.goto(preview.url + '?story=descent&movie=1&profile=LOW', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
await probe('after-descent-page');
const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page2 = await ctx2.newPage();
page2.on('response', r => { if (r.status() >= 400) console.log('page2 saw', r.status(), r.url().slice(-80)); });
try {
  await page2.goto(preview.url + '?story=ch3-dusk&movie=1&profile=LOW', { waitUntil: 'domcontentloaded' });
  console.log('page2 goto ok');
} catch (e) { console.log('page2 goto FAILED', e.message.slice(0, 120)); }
await browser.close(); preview.stop();
