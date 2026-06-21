import { chromium } from 'playwright-core';
const EXE = 'C:/Users/Phillip/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:5173/?world=0,0', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e=>console.log('warn',e.message));
await new Promise(r=>setTimeout(r,5000));
const out = await page.evaluate(() => {
  const found = [];
  const all = document.querySelectorAll('*');
  for (const el of all) {
    if (el.__r3f) {
      const r = el.__r3f;
      const entry = { tag: el.tagName, keys: Object.keys(r) };
      // try to resolve a state
      const store = r.store || r.root || r.fiber;
      if (store && typeof store.getState === 'function') {
        const s = store.getState();
        entry.stateKeys = Object.keys(s).slice(0,30);
        entry.hasGl = !!s.gl; entry.hasScene = !!s.scene;
      }
      found.push(entry);
    }
  }
  return { count: found.length, found };
});
console.log(JSON.stringify(out,null,2));
await browser.close();
