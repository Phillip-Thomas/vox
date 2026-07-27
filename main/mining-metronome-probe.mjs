// Probe A+B: idle-hold EXTRACT metronome + extraction-completes verification.
// The owner's exact symptom on the ch1 side-lens era (?story=<beat>, NO movie):
// a real trusted click unlocks audio + pointer lock, then a SUSTAINED synthetic
// KeyE keydown (mobileInput pattern) is held while the player stands still.
//
// A continuous still-hold self-buries (the underfoot probe digs down), so each
// STANCE is a FRESH context/spawn with a distinct small A/D pre-offset (~0.3-0.7 m)
// to sample different sub-voxel boundary phases (VOXEL_SCALE=2 -> boundaries at
// odd world coords). We measure the ACTIVE-mining portion of each hold.
//
// Live state via same-URL dynamic import of app module singletons (one Vite
// instance): getMiningProgress(), totalItems(). SFX from window.__voxSfxDiag()
// (trailing-3s ✓/✗ + loop-guard summary).
//
// PASS: mine admit rate bounded (NOT a ~9/s floor metronome), windowed suppressed
// bounded, loop-guard engages ZERO times, no console errors; AND inventory grows +
// completion cycles occur at each stance (extraction possible mid-boundary).
//
// Usage: node mining-metronome-probe.mjs <beat> [outDir]
import { chromium } from 'playwright-core';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const BASE = process.env.PARAVOXIA_URL ?? 'http://localhost:5173';
const BEAT = process.argv[2] ?? 'ch1-fixed';
const OUT = process.argv[3] ?? `/tmp/claude-1000/-home-thomasphillip-Projects-vox/c4fb5c0f-3061-4b59-a25d-e3a9ae66ab48/scratchpad/metronome-${BEAT}`;
fs.mkdirSync(OUT, { recursive: true });

const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter(d => /^chromium-\d+$/.test(d)).sort().pop();
const executablePath = path.join(pwDir, chromeDir, 'chrome-linux/chrome');

const READ = `async () => {
  const out = {};
  try { const m = await import('/src/game/systems/miningProgress.ts'); const p = m.getMiningProgress(); out.active=p.active; out.pct=p.pct; out.blocked=p.blocked; } catch(e){ out.err=String(e); }
  try { const m = await import('/src/game/systems/inventorySystem.ts'); out.totalItems=m.totalItems(); } catch(e){}
  out.beat = window.__storyBeat ?? null;
  out.pl = !!document.pointerLockElement;
  out.sfx = typeof window.__voxSfxDiag==='function' ? window.__voxSfxDiag() : null;
  const d = window.__voxelDebug?.player; out.x=d?.position?.[0]??null; out.y=d?.position?.[1]??null; out.z=d?.position?.[2]??null;
  return out;
}`;

function parseSfx(s) {
  if (!s) return { mineOk: 0, mineSup: 0, loopGuard: null, engaged: false };
  let mineOk = 0, mineSup = 0;
  const m = s.match(/mine (\d+)✓\/(\d+)✗/);
  if (m) { mineOk = +m[1]; mineSup = +m[2]; }
  return { mineOk, mineSup, loopGuard: s.includes('loop-guard:') ? s.slice(s.indexOf('loop-guard:')) : null, engaged: /ENGAGED/.test(s) };
}
const readInv = page => page.evaluate(async () => { const m = await import('/src/game/systems/inventorySystem.ts'); return m.totalItems(); }).catch(() => null);

const browser = await chromium.launch({
  executablePath, headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720']
});

// One stance = fresh context/spawn, distinct pre-offset, sustained E hold.
async function runStance(stance) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const pageErrors = [], consoleErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  const url = `${BASE}/?story=${BEAT}&debug=1&profile=LOW`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    if (window.__paravoxiaAppState?.phase === 'playing') return true;
    return [...document.querySelectorAll('button')].some(b => b.textContent?.includes('Play Now') && !b.disabled);
  }, undefined, { timeout: 60000 }).catch(() => {});
  if (!(await page.evaluate(() => window.__paravoxiaAppState?.phase === 'playing').catch(() => false)))
    await page.getByRole('button', { name: /Play Now/i }).click({ force: true }).catch(() => {});
  await page.waitForFunction(() => window.__paravoxiaAppState?.phase === 'playing', undefined, { timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 3500));

  await page.mouse.click(640, 360);          // trusted unlock + pointer lock
  await new Promise(r => setTimeout(r, 700));
  const spawn = await page.evaluate(`(${READ})()`);

  // pre-offset: brief movement taps to shift sub-voxel phase (E not yet held)
  if (stance.key) {
    for (let i = 0; i < stance.taps; i++) {
      await page.evaluate(k => document.dispatchEvent(new KeyboardEvent('keydown', { code: k, bubbles: true })), stance.key);
      await new Promise(r => setTimeout(r, 150));
      await page.evaluate(k => document.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true })), stance.key);
      await new Promise(r => setTimeout(r, 220));
    }
  }
  await new Promise(r => setTimeout(r, 300));
  const preHold = await page.evaluate(`(${READ})()`);
  const invStart = await readInv(page);

  // SUSTAINED synthetic KeyE keydown, held for the whole window.
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', bubbles: true })));

  const t0 = Date.now();
  let lastPct = 0, cycles = 0, peakOk = 0, peakSup = 0, loopGuard = null, engaged = false;
  let firstMineT = null, lastMineT = null, lastOk = 0;
  const ys = [], trace = []; let nextSlow = 0;
  while ((Date.now() - t0) / 1000 < stance.secs) {
    const s = await page.evaluate(`(${READ})()`).catch(() => null);
    const el = (Date.now() - t0) / 1000;
    if (s) {
      if (typeof s.pct === 'number') { if (lastPct > 0.45 && s.pct < 0.12) cycles++; lastPct = s.pct; }
      if (typeof s.y === 'number') ys.push(s.y);
      const p = parseSfx(s.sfx);
      peakOk = Math.max(peakOk, p.mineOk); peakSup = Math.max(peakSup, p.mineSup);
      if (p.loopGuard) loopGuard = p.loopGuard;
      if (p.engaged) engaged = true;
      if (p.mineOk > lastOk || s.active) { if (firstMineT === null) firstMineT = el; lastMineT = el; }
      lastOk = p.mineOk;
      if (el >= nextSlow) { trace.push({ t: +el.toFixed(1), beat: s.beat, y: s.y == null ? null : +s.y.toFixed(2), ok3s: p.mineOk, sup3s: p.mineSup, active: s.active, pct: s.pct == null ? null : +s.pct.toFixed(2), lg: p.loopGuard }); nextSlow += 5; }
    }
    await new Promise(r => setTimeout(r, 120));
  }
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', key: 'e', bubbles: true })));
  const invEnd = await readInv(page);
  const endSfx = await page.evaluate(() => window.__voxSfxDiag?.()).catch(() => null);
  const endAudio = await page.evaluate(() => window.__voxAudioDiag?.()).catch(() => null);
  await page.screenshot({ path: path.join(OUT, `${BEAT}_${stance.name}.png`) }).catch(() => {});
  await context.close();

  return {
    name: stance.name,
    spawnPos: spawn.pl ? [spawn.x, spawn.y, spawn.z].map(v => v == null ? null : +v.toFixed(2)) : 'NO_PL',
    preHoldPos: [preHold.x, preHold.y, preHold.z].map(v => v == null ? null : +v.toFixed(2)),
    offsetXZ: (spawn.x != null && preHold.x != null) ? +Math.hypot(preHold.x - spawn.x, preHold.z - spawn.z).toFixed(2) : null,
    pointerLock: spawn.pl,
    activeMiningSecs: (firstMineT != null && lastMineT != null) ? +(lastMineT - firstMineT).toFixed(1) : 0,
    invDelta: (invEnd != null && invStart != null) ? invEnd - invStart : null,
    completionCycles: cycles,
    peakMineOkPer3s: peakOk, peakMineSupPer3s: peakSup, peakAdmitRatePerSec: +(peakOk / 3).toFixed(2),
    loopGuardText: loopGuard, loopGuardEngaged: engaged,
    yRange: ys.length ? [Math.min(...ys), Math.max(...ys)].map(v => +v.toFixed(2)) : null,
    endSfx, endAudio, pageErrors, consoleErrors, trace
  };
}

const stances = [
  { name: 'spawn', secs: 40 },
  { name: 'offA1', key: 'KeyA', taps: 1, secs: 30 },
  { name: 'offD2', key: 'KeyD', taps: 2, secs: 30 },
  { name: 'offA3', key: 'KeyA', taps: 3, secs: 30 }
];
const results = [];
for (const st of stances) {
  const r = await runStance(st);
  results.push(r);
  console.log(`[${BEAT}/${r.name}] pl=${r.pointerLock} off=${r.offsetXZ}m activeMine=${r.activeMiningSecs}s invΔ=${r.invDelta} cycles=${r.completionCycles} peakOk/3s=${r.peakMineOkPer3s}(${r.peakAdmitRatePerSec}/s) peakSup/3s=${r.peakMineSupPer3s} loopGuard=${r.loopGuardEngaged} y=${JSON.stringify(r.yRange)} errs=${r.pageErrors.length}/${r.consoleErrors.length}`);
}

const summary = {
  beat: BEAT,
  anyLoopGuardEngaged: results.some(r => r.loopGuardEngaged || /ENGAGED/.test(r.endSfx || '')),
  anyLoopGuardTextEver: results.some(r => r.loopGuardText || /loop-guard:/.test(r.endSfx || '')),
  maxAdmitRatePerSec: Math.max(...results.map(r => r.peakAdmitRatePerSec)),
  maxSuppressedPer3s: Math.max(...results.map(r => r.peakMineSupPer3s)),
  totalPageErrors: results.reduce((a, r) => a + r.pageErrors.length, 0),
  totalConsoleErrors: results.reduce((a, r) => a + r.consoleErrors.length, 0),
  stances: results
};
console.log('\n===SUMMARY_JSON===');
console.log(JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
await browser.close();
process.exit(0);
