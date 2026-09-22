import { chromium } from '/home/thomasphillip/Projects/vox/main/node_modules/playwright-core/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = '/home/thomasphillip/Projects/vox/.codex/chapter-loops/ch14-636006f1-3ecf-49c0-befa-4b6f5ece45a0/camera-boundary-repair-20260909/verifier';
const URL = 'http://127.0.0.1:46451/?story=ch1-fixed&movie=1&journeyprobe=1&profile=HIGH';
mkdirSync(OUT + '/shots', { recursive: true });

const READ = () => {
  const w = window;
  const doc = document;
  const ids = ['feed-work-order','feed-camera-status','feed-ledger','story-caption','touch-dpad','touch-dpad-actions','story-journal-trigger','hud-corner-actions'];
  const debugTrigger = '[data-testid="story-debug-panel"] > button[aria-controls="story-debug-disclosure"]';
  const journalTrigger = '[data-story-journal-trigger], .pv-mobile-journal-trigger';
  const reservations = Array.from(doc.querySelectorAll(`[data-hud-surface], ${journalTrigger}, ${debugTrigger}`))
    .filter(n => (ids.includes(n.dataset.hudSurface ?? '') || n.matches(journalTrigger) || n.matches(debugTrigger))
      && getComputedStyle(n).display !== 'none' && getComputedStyle(n).visibility !== 'hidden')
    .map(n => { const r = n.getBoundingClientRect();
      return { id: n.matches(debugTrigger) ? 'story-debug-trigger' : n.matches(journalTrigger) ? 'story-journal-trigger' : n.dataset.hudSurface,
        left: +r.left.toFixed(1), top: +r.top.toFixed(1), right: +r.right.toFixed(1), bottom: +r.bottom.toFixed(1), width: +r.width.toFixed(1), height: +r.height.toFixed(1) }; })
    .filter(r => r.width > 0 && r.height > 0);
  let probe = null;
  try { probe = w.__paravoxiaJourneyProbe?.snapshot?.() ?? null; } catch (e) { probe = { error: String(e) }; }
  let game = null;
  try {
    const g = w.__game;
    if (g) {
      const cam = g.camera ?? g.getCamera?.();
      const p = g.player ?? g.getPlayer?.();
      game = { keys: Object.keys(g),
        camera: cam ? { fov: cam.fov, pos: cam.position?.toArray?.(), aspect: cam.aspect, viewEnabled: !!cam.view?.enabled, viewOffsetY: cam.view?.offsetY ?? null } : null,
        player: p?.position?.toArray?.() ?? p?.toArray?.() ?? null };
    }
  } catch (e) { game = { error: String(e) }; }
  const workOrderEl = doc.querySelector('[data-hud-surface="feed-work-order"]');
  return {
    t: Date.now(),
    beat: w.__storyBeat ?? null,
    objective: w.__storyObjective ?? null,
    autopilot: w.__autopilot ?? null,
    viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio },
    reservations,
    workOrderText: workOrderEl ? workOrderEl.innerText.replace(/\s+/g, ' ').trim().slice(0, 300) : null,
    captionText: (doc.querySelector('[data-hud-surface="story-caption"]')?.innerText ?? '').replace(/\s+/g,' ').trim().slice(0,200),
    ledgerText: (doc.querySelector('[data-hud-surface="feed-ledger"]')?.innerText ?? '').replace(/\s+/g,' ').trim().slice(0,200),
    camStatusText: (doc.querySelector('[data-hud-surface="feed-camera-status"]')?.innerText ?? '').replace(/\s+/g,' ').trim().slice(0,200),
    probeBeat: probe?.story?.beat ?? null,
    probeObjective: probe?.objective ?? null,
    game
  };
};

const browser = await chromium.launch({
  executablePath: '/snap/bin/chromium', headless: false,
  args: ['--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist','--enable-webgl','--use-gl=angle','--use-angle=gl','--mute-audio','--disable-background-timer-throttling','--disable-renderer-backgrounding'],
  env: { ...process.env, DISPLAY: ':0' }
});
const samples = [];
const consoleLines = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on('console', m => { if (consoleLines.length < 200) consoleLines.push(`${m.type()}: ${m.text()}`.slice(0, 300)); });
  page.on('pageerror', e => consoleLines.push('pageerror: ' + String(e).slice(0, 300)));
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  const start = Date.now();
  // click through any gate
  for (let i = 0; i < 3; i++) {
    await page.waitForTimeout(2000);
    const b = await page.$('button:visible');
    const beat = await page.evaluate(() => window.__storyBeat ?? null);
    if (beat) break;
    if (b) { try { await b.click({ timeout: 2000 }); } catch {} }
  }
  let n = 0;
  while (Date.now() - start < 90000) {
    const s = await page.evaluate(READ);
    s.elapsedMs = Date.now() - start;
    samples.push(s);
    if (n % 3 === 0) await page.screenshot({ path: `${OUT}/shots/t${String(Math.round(s.elapsedMs/1000)).padStart(3,'0')}s-${s.beat ?? 'nobeat'}.png` });
    n++;
    await page.waitForTimeout(5000);
  }
  await page.screenshot({ path: `${OUT}/shots/final.png` });
} finally {
  await browser.close();
}
writeFileSync(`${OUT}/raw-samples.json`, JSON.stringify({ url: URL, samples, consoleLines }, null, 2));
console.log('samples', samples.length, 'beats', [...new Set(samples.map(s => s.beat))].join(','));
console.log(JSON.stringify(samples[samples.length - 1], null, 2).slice(0, 4000));
