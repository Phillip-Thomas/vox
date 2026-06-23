import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..', 'captures');
const EXE = 'C:/Users/Phillip/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: EXE, headless: false, args: ['--ignore-gpu-blocklist','--enable-gpu','--use-angle=d3d11'] });
// iPhone-ish portrait; hasTouch so isTouchDevice() -> touch controls mount.
const page = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
page.on('pageerror', e => console.log('PE:', e.message));
const shot = async n => { try { await page.screenshot({ path: resolve(OUT, n), timeout: 60000 }); console.log('shot', n); } catch(e){ console.log('FAIL', n, e.message); } };
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(()=>{});
await page.bringToFront();
// wait for Play enabled
await page.waitForFunction(() => [...document.querySelectorAll('button')].some(x=>/play now/i.test(x.textContent||'')&&!x.disabled), null, { timeout: 60000 }).catch(()=>console.log('ready timeout'));
await page.evaluate(() => [...document.querySelectorAll('button')].find(x=>/play now/i.test(x.textContent||''))?.click());
await page.waitForTimeout(1500);
// seed inventory (same singleton module the app already loaded)
const seeded = await page.evaluate(async () => {
  try { const m = await import('/src/game/systems/inventorySystem.ts'); m.addResource('stone', 7); m.addResource('frost_crystal', 2); m.addResource('copper_ore', 4); return true; } catch(e){ return String(e); }
});
console.log('seeded inventory:', seeded);
await page.waitForTimeout(600);
await shot('mob_fps.png');
// measure overlap: joystick vs action grid
const boxes = await page.evaluate(() => {
  const joy = document.querySelector('[data-testid="touch-joystick"]')?.getBoundingClientRect();
  const btns = [...document.querySelectorAll('button')].filter(b=>/^(Q|E|F|THR|JMP|MINE)$/.test((b.textContent||'').trim()));
  const xs = btns.map(b=>b.getBoundingClientRect());
  const leftmost = xs.length ? Math.min(...xs.map(r=>r.left)) : null;
  return { joyRight: joy ? joy.right : null, actionLeft: leftmost };
});
console.log('FPS boxes:', JSON.stringify(boxes), '-> overlap:', boxes.joyRight!=null && boxes.actionLeft!=null && boxes.actionLeft < boxes.joyRight);
// board ship to enter flight
await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyF',bubbles:true})));
await page.waitForTimeout(300);
await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyF',bubbles:true})));
await page.waitForTimeout(1500);
await shot('mob_flight.png');
const fb = await page.evaluate(() => {
  const joy = document.querySelector('[data-testid="touch-joystick"]')?.getBoundingClientRect();
  const btns = [...document.querySelectorAll('button')].filter(b=>/^(Q|E|F|THR)$/.test((b.textContent||'').trim()));
  const leftmost = btns.length ? Math.min(...btns.map(b=>b.getBoundingClientRect().left)) : null;
  const cockpit = [...document.querySelectorAll('div')].find(d=>/COCKPIT/.test(d.textContent||''))?.getBoundingClientRect();
  return { joyRight: joy?joy.right:null, actionLeft: leftmost, cockpitTop: cockpit?cockpit.top:null, cockpitBottom: cockpit?cockpit.bottom:null };
});
console.log('FLIGHT boxes:', JSON.stringify(fb), '-> btn overlap joystick:', fb.joyRight!=null&&fb.actionLeft!=null&&fb.actionLeft<fb.joyRight);
await b.close();
