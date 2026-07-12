// Full-run probe: ?story=1&movie=1 -> done. Polls __storyBeat + __autopilot,
// records per-beat dwell and the max beatClock reached; flags a RESCUE whenever
// a beat's clock reaches/exceeds its BEAT_TIMEOUT (a forced advance). Also fps
// samples per beat. Usage: node full-run-probe.mjs [maxSeconds]
//
// HARDENED (2026-07-12) after a silent 410s ch3-gather stall (both the
// director's and the autopilot's clocks froze — the useFrame loop died with no
// pageerror, unrescuable from inside the page):
//  - ALWAYS runs its own fresh dev server (PROBE_PORT, default 5198) with HMR
//    fully disabled (PROBE_NO_HMR=1 -> vite.config.ts). A shared long-running
//    server is a live channel into the screening: a concurrent session's file
//    saves push HMR updates/reloads mid-run, and HMR-invalidated graphs split
//    the module registry (the fps-score-probe learned that lesson first).
//  - Stall watchdog: no beat change AND no clock movement for STALL_LIMIT_S
//    (240s — every legit quiet window is <= ~90s: cutscenes ~45-60s, boot
//    ~60s) fails FAST with diagnostics (rAF heartbeat, reload marker, WebGL
//    context-loss count, console tail, screenshot) instead of burning
//    silently to the wall cap. Verdicts: PASS | REACHED-DONE-WITH-RESCUES |
//    FAIL-NO-DONE | FAIL-STALL. This can only fail earlier, never pass more.
//  - Warm-up pass: the fresh server's transform cache is cold; one throwaway
//    load (isolated browser context — no storage leak) warms it so the real
//    run's boot and fps@crawl stay comparable to warm-server history.
//  - PROBE_AUDIO=1 (optional): adds the autoplay flag (+ --mute-audio) and
//    presses a key during the prologue (the terminal's documented unlock
//    gesture) so the screening runs WITH the live score. Default off: without
//    it the AudioContext stays locked for the whole run (movie mode never
//    clicks), so default fps numbers measure the world render alone.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const maxSeconds = Number(process.argv[2] ?? 900);
const BEAT_TIMEOUT = {
  'ch1-fixed': 55, 'ch1-raster': 95, 'ch1-depth': 60, 'ch1-nav': 75, 'ch1-iso': 75,
  'ch1-anomaly': 62, 'ch2-color': 45, 'ch2-approach': 45, 'ch3-gather': 34,
  'ch3-await-rest': 70, 'ch3-thirst': 75, 'ch3-forage': 60, 'ch3-signal': 60, 'ch4-vigil': 140
};

const PROBE_PORT = Number(process.env.PROBE_PORT ?? 5198);
const PROBE_AUDIO = process.env.PROBE_AUDIO === '1';
const STALL_LIMIT_S = 240;
const root = path.dirname(new URL(import.meta.url).pathname);

async function serverUp(port) {
  try { return (await fetch(`http://localhost:${port}/`)).ok; } catch { return false; }
}

let viteProc = null;
if (await serverUp(PROBE_PORT)) {
  console.log(`[probe] WARNING: reusing server already on :${PROBE_PORT} — HMR state unknown; kill it for a clean screening`);
} else {
  console.log(`[probe] starting isolated vite dev server on :${PROBE_PORT} (HMR off)…`);
  viteProc = spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', '--port', String(PROBE_PORT), '--strictPort'],
    { cwd: root, stdio: 'ignore', env: { ...process.env, PROBE_NO_HMR: '1' } }
  );
  let up = false;
  for (let i = 0; i < 100 && !(up = await serverUp(PROBE_PORT)); i++) {
    await new Promise(r => setTimeout(r, 300));
  }
  if (!up) {
    console.log(`[probe] FATAL: dev server never came up on :${PROBE_PORT}`);
    viteProc.kill();
    process.exit(1);
  }
}

const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter(d => /^chromium-\d+$/.test(d)).sort().pop();
const executablePath = path.join(pwDir, chromeDir, 'chrome-linux/chrome');

const browser = await chromium.launch({
  executablePath, headless: true,
  args: [
    '--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720',
    ...(PROBE_AUDIO ? ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] : [])
  ]
});
// Warm-up pass: a fresh isolated server has a COLD transform cache, which
// taxes the screening's boot (~80s crawl dwell, fps@crawl measured mid-compile).
// Load the app once in a THROWAWAY CONTEXT (isolated storage — its story
// milestones must not leak into the real run) so the real run starts warm.
{
  const warmCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const warmPage = await warmCtx.newPage();
  const w0 = Date.now();
  await warmPage.goto(`http://localhost:${PROBE_PORT}/?story=1&movie=1`, { waitUntil: 'load' }).catch(() => {});
  for (let i = 0; i < 400; i++) {
    const beat = await warmPage.evaluate(() => window.__storyBeat ?? null).catch(() => null);
    if (beat !== null) break;
    await new Promise(r => setTimeout(r, 300));
  }
  await warmCtx.close();
  console.log(`[probe] transform cache warmed in ${((Date.now() - w0) / 1000).toFixed(1)}s`);
}

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

// Diagnostics channel: console ring buffer + page events + in-page probes.
const consoleTail = [];
const note = line => { consoleTail.push(line); if (consoleTail.length > 80) consoleTail.shift(); };
page.on('console', m => {
  const line = `[console:${m.type()}] ${m.text()}`;
  note(line);
  if (m.text().includes('[vite]')) console.log(`[probe] ${line}`); // HMR/reload traffic = poisoned run
});
page.on('pageerror', e => { console.log(`[pageerror] ${e.message}`); note(`[pageerror] ${e.message}`); });
page.on('crash', () => { console.log('[probe] PAGE CRASHED'); note('[crash]'); });
await page.addInitScript(() => {
  // Re-runs on every navigation: a changed __probeBootAt = the page reloaded.
  window.__probeBootAt = Date.now();
  // rAF heartbeat independent of the app: distinguishes "frame loop dead"
  // (compositor/GPU stall) from "driver dead" (app-level freeze).
  window.__rafBeat = 0;
  const beat = () => { window.__rafBeat++; requestAnimationFrame(beat); };
  requestAnimationFrame(beat);
  window.__ctxLost = 0;
  window.addEventListener('webglcontextlost', () => { window.__ctxLost++; }, true);
});
await page.goto(`http://localhost:${PROBE_PORT}/?story=1&movie=1`, { waitUntil: 'load' });
if (PROBE_AUDIO) {
  // The terminal prologue treats any keydown as the audio-unlock gesture.
  await new Promise(r => setTimeout(r, 3000));
  await page.keyboard.press('Space');
  console.log('[probe] PROBE_AUDIO=1: unlock keypress sent — screening runs with the live score');
}

const t0 = Date.now();
let lastBeat = undefined;
let beatEnterWall = t0;
let maxClock = 0;
let ok = false;
let stalled = false;
const rows = [];
const fpsMeasured = new Set();
const rescues = [];
let lastProgressWall = Date.now();
let lastClockSeen = null;
let lastBootAt = null;

const flush = (prevBeat, wallNow) => {
  if (prevBeat === undefined || prevBeat === null) return;
  const dwell = (wallNow - beatEnterWall) / 1000;
  const to = BEAT_TIMEOUT[prevBeat];
  const rescued = to !== undefined && maxClock >= to - 0.15;
  rows.push({ beat: prevBeat, dwell: dwell.toFixed(1), maxClock: maxClock.toFixed(1), to: to ?? '-', rescued });
  if (rescued) rescues.push(`${prevBeat} (clock ${maxClock.toFixed(1)}s >= timeout ${to}s)`);
};

const dumpStallDiagnostics = async () => {
  console.log(`\n=== STALL: no beat/clock progress for ${STALL_LIMIT_S}s ===`);
  const d1 = await page.evaluate(() => ({
    raf: window.__rafBeat,
    beat: window.__storyBeat ?? null,
    autopilot: window.__autopilot ?? null,
    ctxLost: window.__ctxLost,
    visibility: document.visibilityState,
    bootAt: window.__probeBootAt
  })).catch(() => null);
  await new Promise(r => setTimeout(r, 2000));
  const raf2 = await page.evaluate(() => window.__rafBeat).catch(() => null);
  if (d1 && raf2 !== null) {
    const delta = raf2 - d1.raf;
    console.log(`rAF heartbeat: ${delta > 0 ? `ALIVE (+${delta} frames / 2s) — app-level freeze` : 'DEAD — compositor/GPU frame loop stalled'}`);
  } else {
    console.log('rAF heartbeat: unreadable (page unresponsive?)');
  }
  console.log(`page state: ${JSON.stringify(d1)}`);
  console.log('--- console tail ---');
  consoleTail.forEach(l => console.log(l));
  try {
    const shot = path.join(root, 'captures', `full-run-stall-${Date.now()}.png`);
    fs.mkdirSync(path.dirname(shot), { recursive: true });
    await page.screenshot({ path: shot });
    console.log(`screenshot: ${shot}`);
  } catch { /* page may be gone */ }
};

while ((Date.now() - t0) / 1000 < maxSeconds) {
  const s = await page.evaluate(() => ({
    beat: window.__storyBeat ?? null,
    clock: (window.__autopilot && window.__autopilot.clock) ?? null,
    nudges: (window.__autopilot && window.__autopilot.nudges) ?? null,
    bootAt: window.__probeBootAt ?? null,
  })).catch(() => null);
  if (s) {
    if (lastBootAt !== null && s.bootAt !== null && s.bootAt !== lastBootAt) {
      console.log(`[probe] PAGE RELOADED mid-run (bootAt ${lastBootAt} -> ${s.bootAt}) — poisoned screening`);
      note('[probe] page reloaded mid-run');
    }
    if (s.bootAt !== null) lastBootAt = s.bootAt;
    if (s.clock !== null && typeof s.clock === 'number') {
      maxClock = Math.max(maxClock, s.clock);
      if (s.clock !== lastClockSeen) { lastClockSeen = s.clock; lastProgressWall = Date.now(); }
    }
    if (s.beat !== lastBeat) {
      const wallNow = Date.now();
      flush(lastBeat, wallNow);
      const at = ((wallNow - t0) / 1000).toFixed(1);
      console.log(`[${at}s] ${lastBeat ?? '(boot)'} -> ${s.beat}`);
      lastBeat = s.beat;
      beatEnterWall = wallNow;
      maxClock = 0;
      lastProgressWall = wallNow;
      if (s.beat && !fpsMeasured.has(s.beat)) {
        fpsMeasured.add(s.beat);
        const fps = await page.evaluate(() => new Promise(resolve => {
          let f = 0; const b = performance.now();
          const c = () => { f++; if (performance.now() - b < 1500) requestAnimationFrame(c);
            else resolve(Math.round(f / ((performance.now() - b) / 1000))); };
          requestAnimationFrame(c);
        })).catch(() => -1);
        console.log(`    fps@${s.beat}: ${fps}`);
      }
      if (s.beat === 'done') { ok = true; break; }
    }
  }
  if ((Date.now() - lastProgressWall) / 1000 > STALL_LIMIT_S) {
    stalled = true;
    await dumpStallDiagnostics();
    break;
  }
  await new Promise(r => setTimeout(r, 500));
}
flush(lastBeat, Date.now());

console.log('\n=== PER-BEAT DWELL vs TIMEOUT ===');
console.log('beat'.padEnd(18), 'dwell'.padStart(7), 'maxClock'.padStart(9), 'timeout'.padStart(8), '  rescued');
for (const r of rows) console.log(String(r.beat).padEnd(18), String(r.dwell).padStart(7), String(r.maxClock).padStart(9), String(r.to).padStart(8), '  ', r.rescued ? 'YES <<<' : 'no');
console.log(`\nTOTAL: ${((Date.now() - t0)/1000).toFixed(1)}s  reachedDone=${ok}  rescues=${rescues.length}${stalled ? '  STALLED' : ''}`);
if (rescues.length) rescues.forEach(r => console.log('  RESCUE: ' + r));
console.log(ok && rescues.length === 0 ? 'PASS' : (ok ? 'REACHED-DONE-WITH-RESCUES' : (stalled ? 'FAIL-STALL' : 'FAIL-NO-DONE')));
await browser.close();
if (viteProc) viteProc.kill();
process.exit(ok && rescues.length === 0 ? 0 : 1);
