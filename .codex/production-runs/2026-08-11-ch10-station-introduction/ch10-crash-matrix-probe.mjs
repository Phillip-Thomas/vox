// Renderer-death characterization for the ch10-ask Tidegarden -> origin
// crossing. The engineer's ask-leg trace dies ~16 s into the crossing with an
// EMPTY pageError list and phase going undefined: a renderer process death, not
// a JS throw.
//
// One variable at a time, same route, one browser at a time, sequential:
//   low-baseline        LOW 1280x720                 (reproduce)
//   low-half-viewport   LOW 640x360                  (viewport only)
//   potato-full         POTATO 1280x720              (profile only)
//   potato-half         POTATO 640x360               (both)
//   ch8-crossing-control LOW 1280x720, ch8-crossing  (reverse control: same
//                       world pair, opposite direction, shipped and known good)
//   low-no-companions   LOW 1280x720, the
//                       system-companion-bodies group forced invisible every
//                       frame (ST-0 lives in that group and is the newest
//                       renderer-side addition on this path)
//
// Telemetry every 2 s: performance.memory (via --enable-precise-memory-info),
// the summed RSS of every chromium process, story/flight state, and the last
// three diagnostic frames before death. Hard abort at 12 GB of browser RSS so
// the kernel never gets to choose (this box has been OOM-killed before).
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
const { chromium } = await import(
  '/home/thomasphillip/Projects/vox/main/node_modules/playwright-core/index.mjs'
);

const RUN_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT_DIR = path.join(RUN_DIR, 'evidence', 'verification');
const FRAME_DIR = path.join(OUT_DIR, 'crash-frames');
const BASE = process.env.VOX_BASE ?? 'http://localhost:5176';
const WATCH = Number(process.env.VOX_WATCH ?? 200);
const RSS_ABORT_MB = Number(process.env.VOX_RSS_ABORT_MB ?? 12000);
fs.mkdirSync(FRAME_DIR, { recursive: true });
const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter(d => /^chromium-\d+$/.test(d)).sort().pop();
const CHROME = path.join(pwDir, chromeDir, 'chrome-linux/chrome');

function browserRssMb() {
  try {
    const out = execSync(
      "ps -eo rss,cmd --no-headers | grep 'chromium-121[0-9]*/chrome-linux' | grep -v grep | awk '{s+=$1} END {print s+0}'",
      { encoding: 'utf8', shell: '/bin/bash' });
    return Math.round(Number(out.trim()) / 1024);
  } catch { return null; }
}

const HOOK = async (hideCompanions) => {
  const src = await (await fetch('/src/components/SystemCompanionBodies.tsx')).text();
  const threeUrl = src.match(/from\s*["']([^"']*deps\/three\.js[^"']*)["']/)[1];
  const THREE = await import(/* @vite-ignore */ threeUrl);
  window.__THREE = THREE;
  window.__voxLive = {};
  const base = THREE.Object3D.prototype.updateMatrixWorld;
  THREE.Scene.prototype.updateMatrixWorld = function (f) { window.__voxLive.scene = this; return base.call(this, f); };
  if (hideCompanions) {
    window.__voxHideCompanions = true;
    const tick = () => {
      const s = window.__voxLive.scene;
      if (s) {
        s.traverse(o => {
          if (o.name === 'system-companion-bodies' || o.name === 'system-st0-station-light') {
            o.visible = false;
          }
        });
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  return true;
};

const READ = async () => {
  const w = window;
  const out = { beat: w.__storyBeat ?? null };
  const m = performance.memory;
  out.jsHeapMb = m ? {
    used: Math.round(m.usedJSHeapSize / 1048576),
    total: Math.round(m.totalJSHeapSize / 1048576),
    limit: Math.round(m.jsHeapSizeLimit / 1048576)
  } : null;
  try {
    const f = await import('/src/state/spaceFlight.ts');
    const s = f.getSpaceFlightSnapshot();
    out.flight = { phase: s.phase, controlMode: s.controlMode };
  } catch { /* ignore */ }
  try {
    const s = await import('/src/state/systemFlight.ts');
    const v = s.getSystemFlightSnapshot();
    out.system = { activePlanetId: v.activePlanetId, locationMode: v.locationMode,
      targetWorldId: v.target?.worldId ?? null,
      pos: (v.pose?.position ?? []).map(n => Math.round(n)) };
  } catch { /* ignore */ }
  const ap = w.__autopilot;
  if (ap) out.autopilot = { beat: ap.beat, clock: ap.clock, pos: ap.pos };
  try {
    const live = w.__voxLive;
    if (live?.scene) {
      let n = 0, visible = 0;
      live.scene.traverse(o => { n++; if (o.visible) visible++; });
      out.sceneObjects = n; out.sceneVisible = visible;
      let comp = null;
      live.scene.traverse(o => { if (o.name === 'system-companion-bodies') comp = o.visible; });
      out.companionGroupVisible = comp;
    }
  } catch { /* ignore */ }
  return out;
};

const SCENARIOS = [
  { id: 'low-baseline', url: '?story=ch10-ask&movie=1&profile=LOW', vp: { width: 1280, height: 720 } },
  { id: 'low-half-viewport', url: '?story=ch10-ask&movie=1&profile=LOW', vp: { width: 640, height: 360 } },
  { id: 'potato-full', url: '?story=ch10-ask&movie=1&profile=POTATO', vp: { width: 1280, height: 720 } },
  { id: 'potato-half', url: '?story=ch10-ask&movie=1&profile=POTATO', vp: { width: 640, height: 360 } },
  { id: 'ch8-crossing-control', url: '?story=ch8-crossing&movie=1&profile=LOW', vp: { width: 1280, height: 720 } },
  { id: 'low-no-companions', url: '?story=ch10-ask&movie=1&profile=LOW', vp: { width: 1280, height: 720 }, hideCompanions: true }
];

const report = { capturedAt: new Date().toISOString(), base: BASE, watchSeconds: WATCH,
  rssAbortMb: RSS_ABORT_MB, scenarios: [] };
const OUT = path.join(OUT_DIR, 'ch10-crash-matrix.json');
const flush = () => fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');

for (const sc of SCENARIOS) {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--enable-precise-memory-info',
      `--window-size=${sc.vp.width},${sc.vp.height}`]
  });
  const context = await browser.newContext({ viewport: sc.vp });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  let crashed = false, crashAt = null;
  page.on('pageerror', e => pageErrors.push({ at: Date.now(), text: String(e).slice(0, 200) }));
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)); });
  page.on('crash', () => { crashed = true; });
  const rec = { id: sc.id, url: sc.url, viewport: `${sc.vp.width}x${sc.vp.height}`,
    hideCompanions: !!sc.hideCompanions, samples: [], pageErrors, consoleErrors,
    crashed: false, crashAtSeconds: null, deathMode: null, lastFrames: [] };
  const ring = [];
  try {
    await page.goto(`${BASE}/${sc.url}`, { waitUntil: 'load', timeout: 120000 });
    await new Promise(r => setTimeout(r, 12000));
    await page.evaluate(HOOK, !!sc.hideCompanions).catch(e => rec.hookError = String(e).slice(0, 140));
    const t0 = Date.now();
    while ((Date.now() - t0) / 1000 < WATCH) {
      const t = Number(((Date.now() - t0) / 1000).toFixed(1));
      const rss = browserRssMb();
      if (rss && rss > RSS_ABORT_MB) {
        rec.deathMode = 'aborted-by-probe-rss-ceiling';
        rec.crashAtSeconds = t;
        break;
      }
      let s = null, readError = null;
      try { s = await page.evaluate(READ); }
      catch (e) { readError = String(e).slice(0, 160); }
      rec.samples.push({ t, rssMb: rss, ...(s ?? {}), readError });
      if (readError || crashed) {
        rec.crashed = true;
        rec.crashAtSeconds = t;
        rec.deathMode = crashed ? 'playwright-crash-event' : 'evaluate-failed';
        rec.lastFrames = ring.slice(-3);
        break;
      }
      // Keep a rolling 3-frame ring so the moment before death is on disk.
      if (t > 4) {
        const file = path.join(FRAME_DIR, `${sc.id}_t${String(Math.round(t)).padStart(3, '0')}.png`);
        try {
          await page.screenshot({ path: file, timeout: 8000 });
          ring.push({ file: path.relative(RUN_DIR, file), t, phase: s?.flight?.phase ?? null,
            activePlanetId: s?.system?.activePlanetId ?? null });
          while (ring.length > 3) {
            const drop = ring.shift();
            try { fs.unlinkSync(path.join(RUN_DIR, drop.file)); } catch { /* ignore */ }
          }
        } catch { /* a dying renderer cannot be photographed */ }
      }
      await new Promise(r => setTimeout(r, 2000));
    }
    if (!rec.crashed && !rec.deathMode) { rec.deathMode = 'survived-watch'; rec.lastFrames = ring.slice(-3); }
  } catch (e) {
    rec.crashed = true;
    rec.deathMode = 'exception: ' + String(e).slice(0, 160);
    rec.lastFrames = ring.slice(-3);
  }
  const alive = rec.samples.filter(s => !s.readError);
  rec.peakRssMb = Math.max(0, ...rec.samples.map(s => s.rssMb ?? 0));
  rec.firstRssMb = rec.samples[0]?.rssMb ?? null;
  rec.peakJsHeapMb = Math.max(0, ...alive.map(s => s.jsHeapMb?.used ?? 0));
  rec.lastLiveState = alive[alive.length - 1] ?? null;
  rec.phaseTimeline = alive.map(s => [s.t, s.flight?.phase ?? null, s.system?.activePlanetId ?? null]);
  try { await context.close(); } catch { /* ignore */ }
  try { await browser.close(); } catch { /* ignore */ }
  report.scenarios.push(rec);
  flush();
  console.log(`[${sc.id}] death=${rec.deathMode} at=${rec.crashAtSeconds}s`
    + ` peakRss=${rec.peakRssMb}MB (start ${rec.firstRssMb}MB) peakHeap=${rec.peakJsHeapMb}MB`
    + ` lastPhase=${rec.lastLiveState?.flight?.phase} planet=${rec.lastLiveState?.system?.activePlanetId}`
    + ` pageErrors=${pageErrors.length}`);
  await new Promise(r => setTimeout(r, 3000));
}

flush();
console.log('wrote', OUT);
