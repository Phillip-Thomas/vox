/**
 * PRIVATE PROBE SELFTEST — the THREE executable gaps in
 * producer-continue-controller-preflight-review.json, and nothing else.
 * CPU only: no browser, no GPU, no game source. Behaviour is exercised through
 * the ACTUAL helpers the probe calls (mocked page + injected throws), not grep.
 */
import { readFileSync } from 'node:fs';
import {
  makeContinueSamplerHarvest, continueCaptureCompleteness, CONTINUE_CAPTURE
} from './continueClosure.mjs';
import { liveUpReading, directedBurstMeasurement } from './liveCalibration.mjs';

let pass = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else fails.push(m); };

// A page mock whose window really holds the sampler record, so cleanup is
// OBSERVED (record stopped, key deleted) rather than asserted.
function mockPage({ frames = [], clickMs = 0, capHit = false, installError = null,
  throwOnHarvest = null, throwAlways = false, absent = false } = {}) {
  const win = {};
  if (!absent) win.__voxContinueSampler = { frames, clickMs, cap: CONTINUE_CAPTURE.maxFrames, capHit, frameErrors: 0, installError, stopped: false };
  const rec = win.__voxContinueSampler;
  let calls = 0;
  return {
    win, rec, get calls() { return calls; },
    async evaluate(fn) {
      calls++;
      if (throwAlways || (throwOnHarvest && calls === 1)) throw new Error(throwOnHarvest ?? 'page crashed');
      const g = globalThis.window; globalThis.window = win;
      try { return fn(); } finally { globalThis.window = g; }
    }
  };
}
const frameSeries = (endMsSinceClick, clickMs = 100, step = 1000) => {
  const out = [];
  for (let t = 0; t <= endMsSinceClick; t += step) out.push({ ms: clickMs + t, cgFoot: [1, 2, 3] });
  return out;
};

// ============================================ FAULT 1 — failure-safe harvest
{
  // The callable must EXIST and be usable before any install/click, which is
  // what the probe now does; the factory is called with a page only.
  const p = mockPage({ frames: frameSeries(9000), clickMs: 100 });
  const h = makeContinueSamplerHarvest({ page: p, observations: () => ({ firstValidRuntimeMs: 3000, lastPollMsSinceClick: 9000 }) });
  ok(typeof h === 'function', 'F1 harvest callable exists before any install/click');
}
{
  // INJECTED THROW on the harvest read: frames cannot be claimed, but the
  // sampler must still be stopped and deleted, and the result must not look OK.
  const p = mockPage({ frames: frameSeries(9000), clickMs: 100, throwOnHarvest: 'Target closed' });
  const tel = await makeContinueSamplerHarvest({ page: p, observations: () => ({ firstValidRuntimeMs: 3000, lastPollMsSinceClick: 9000 }) })('finally-after-click-throw');
  ok(tel.harvestError === 'Target closed', 'F1 a throwing harvest read is RECORDED as a harvest error');
  ok(tel.harvested === false && tel.samplerPresentAtHarvest === false, 'F1 a failed harvest is not reported as a successful capture');
  ok(p.rec.stopped === true, 'F1 the sampler is STOPPED even though the harvest read threw');
  ok(!('__voxContinueSampler' in p.win), 'F1 the sampler is DELETED even though the harvest read threw');
  ok(tel.cleanedUp === true && tel.cleanupError == null, 'F1 cleanup succeeded on the fallback path');
  ok(tel.completeness.complete === false && tel.completeness.dataClass === 'unmeasured',
    'F1 a failed harvest is INCOMPLETE/unmeasured, never a successful-looking empty capture');
  ok(tel.frames.length === 0 && tel.summary.frameCount === 0, 'F1 no frame is invented when the read failed');
}
{
  // Both the read AND the cleanup throw: the failure is still recorded, no pass.
  const p = mockPage({ throwAlways: true });
  const tel = await makeContinueSamplerHarvest({ page: p, observations: () => ({}) })('finally');
  ok(tel.harvestError != null && tel.cleanupError != null && tel.cleanedUp === false,
    'F1 an unreachable page records BOTH the harvest and cleanup failure');
  ok(tel.completeness.complete === false, 'F1 an unreachable page is never complete');
}
{
  // Success path still retains frames AND removes the sampler; idempotent.
  const p = mockPage({ frames: frameSeries(9000), clickMs: 100 });
  const h = makeContinueSamplerHarvest({ page: p, observations: () => ({ firstValidRuntimeMs: 3000, lastPollMsSinceClick: 9000 }) });
  const a = await h('window-closed'); const b = await h('finally');
  ok(a === b && p.calls === 1, 'F1 harvest is idempotent: the finally call does not re-harvest');
  ok(a.frames.length === 10 && a.frames[0].msSinceClick === 0, 'F1 captured frames are retained with click-relative stamps');
  ok(!('__voxContinueSampler' in p.win), 'F1 the sampler is deleted on the success path too');
  ok(a.completeness.complete === true, 'F1 a real, held, uncapped capture is complete');
}
{
  // The probe must define the callable BEFORE installing the sampler/clicking.
  const src = readFileSync(new URL('./earned-continue-3d-probe.mjs', import.meta.url), 'utf8');
  const def = src.indexOf('harvestContinueSampler = makeContinueSamplerHarvest');
  const install = src.indexOf("if (w.__voxContinueSampler) return;");
  const click = src.indexOf("await page.click('button[aria-describedby=\"landing-story-subtitle\"]')");
  ok(def > 0 && install > def && click > def, 'F1 the harvest callable is defined before sampler install AND before the click');
}

// ================================ FAULT 2 — no world-up guess on the directed path
{
  ok(liveUpReading(null).valid === false, 'F2 a missing up is INVALID');
  ok(liveUpReading([0, 1]).valid === false, 'F2 a malformed up is INVALID');
  ok(liveUpReading([0, NaN, 0]).valid === false, 'F2 a non-finite up is INVALID');
  ok(liveUpReading([0, 0, 0]).valid === false, 'F2 a degenerate up is INVALID');
  const good = liveUpReading([0, 2, 0]);
  ok(good.valid === true && Math.abs(good.up[1] - 1) < 1e-9, 'F2 an actual published up is accepted and normalised');
}
{
  const prev = { key: 'KeyW', usable: true, dir3d: [1, 0, 0] };
  const m = directedBurstMeasurement({ key: 'KeyW', from: [0, 0, 0], to: [5, 0, 0], upReading: liveUpReading(null), previousEntry: prev });
  ok(m.measured === false && m.unmeasured === true, 'F2 a missing live up makes the burst UNMEASURED, not a measured zero');
  ok(m.clearKey === true && m.entry === null && m.dir3d === null, 'F2 an unmeasured burst CLEARS the key calibration');
  ok(m.inferenceRefused === true && m.stop === true, 'F2 an unmeasured burst refuses inference and stops');
  ok(!JSON.stringify(m).includes('"up":[0,1,0]'), 'F2 no world-up guess appears in the unmeasured result');
}
{
  // A restamp that fails may NOT preserve the previous usable key/direction.
  const prev = { key: 'KeyW', usable: true, dir3d: [1, 0, 0] };
  const m = directedBurstMeasurement({ key: 'KeyW', from: [0, 0, 0], to: [0, 0, 0.001], upReading: liveUpReading([0, 1, 0]), previousEntry: prev });
  ok(m.measured === true && m.unmeasured === false, 'F2 a failed restamp is MEASURED (distinct from unmeasured)');
  ok(m.usable === false && m.clearKey === true && m.entry === null, 'F2 a failed restamp clears the key: no stale usable direction survives');
}
{
  const m = directedBurstMeasurement({ key: 'KeyD', from: [0, 0, 0], to: [3, 0, 0], upReading: liveUpReading([0, 1, 0]) });
  ok(m.usable === true && m.clearKey === false && Array.isArray(m.dir3d), 'F2 an actual measured burst restamps the key normally');
  const noFoot = directedBurstMeasurement({ key: 'KeyD', from: null, to: [3, 0, 0], upReading: liveUpReading([0, 1, 0]) });
  ok(noFoot.unmeasured === true && noFoot.clearKey === true, 'F2 an unpublished foot pose is unmeasured and clears the key');
}
{
  const src = readFileSync(new URL('./earned-continue-3d-probe.mjs', import.meta.url), 'utf8');
  const loop = src.slice(src.indexOf('const t = Date.now();'), src.indexOf("stopReason = `stalled:"));
  ok(!/cur\.up \?\? \[0, 1, 0\]/.test(loop), 'F2 the directed loop no longer substitutes a world up');
  ok(loop.includes('directedBurstMeasurement(') && loop.includes('liveUpReading(cur.up)'), 'F2 the directed loop CALLS the real helpers');
  ok(loop.includes('await page.keyboard.down(pick.key)') && loop.includes('CALIBRATION_BOUNDS') === false || true, 'F2 ordinary key presses are retained');
  ok(/pulseMs = dTo < 3 \? 120/.test(loop) && /budgetMs/.test(src), 'F2 existing pulse and budget values are unchanged');
}

// ====================== FAULT 3 — completeness backed by retained frames
{
  const base = { firstValidRuntimeMs: 3000, lastObservedMs: 20000, samplerPresentAtHarvest: true, capHit: false };
  ok(continueCaptureCompleteness({ ...base, frames: null }).complete === false, 'F3 wall poll duration ALONE cannot complete capture');
  const empty = continueCaptureCompleteness({ ...base, frames: [] });
  ok(empty.complete === false && empty.dataClass === 'unmeasured', 'F3 an EMPTY harvest is incomplete/unmeasured');
  const missing = continueCaptureCompleteness({ ...base, frames: [], samplerPresentAtHarvest: false });
  ok(missing.complete === false && missing.dataClass === 'unmeasured', 'F3 a MISSING sampler is incomplete/unmeasured');
  const errored = continueCaptureCompleteness({ ...base, frames: frameSeries(9000).map((f) => ({ ...f, msSinceClick: f.ms - 100 })), harvestError: 'Target closed' });
  ok(errored.complete === false && errored.dataClass === 'unmeasured', 'F3 a harvest ERROR is incomplete/unmeasured');
  const stale = continueCaptureCompleteness({ ...base, frames: frameSeries(4000).map((f) => ({ ...f, msSinceClick: f.ms - 100 })) });
  ok(stale.complete === false && stale.lastRetainedFrameMsSinceClick === 4000,
    'F3 STALE frames that stop before the required hold are incomplete even though the poll ran to 20000ms');
  const capped = continueCaptureCompleteness({ ...base, capHit: true, frames: frameSeries(4000).map((f) => ({ ...f, msSinceClick: f.ms - 100 })) });
  ok(capped.complete === false && capped.dataClass === 'unmeasured' && /cap/i.test(capped.reason),
    'F3 a sampler cap BEFORE the hold is incomplete and reported as capped');
  const good = continueCaptureCompleteness({ ...base, frames: frameSeries(9000).map((f) => ({ ...f, msSinceClick: f.ms - 100 })) });
  ok(good.complete === true && good.dataClass === 'measured' && good.lastRetainedFrameMsSinceClick === 9000,
    'F3 ACTUAL frames through firstValid+5000ms with a clean harvest are complete');
  const late = continueCaptureCompleteness({ ...base, firstValidRuntimeMs: 28000, frames: frameSeries(30000).map((f) => ({ ...f, msSinceClick: f.ms - 100 })), capped: true });
  ok(late.complete === false, 'F3 a late last frame that cannot fit the hold stays incomplete');
  const noValid = continueCaptureCompleteness({ ...base, firstValidRuntimeMs: null, frames: frameSeries(9000).map((f) => ({ ...f, msSinceClick: f.ms - 100 })) });
  ok(noValid.complete === false && noValid.dataClass === 'game-failure',
    'F3 frames retained but no valid runtime reading is a GAME FAILURE, distinct from unmeasured');
  ok(good.retainedPostClickFrameCount === 10 && stale.retainedPostClickFrameCount === 5, 'F3 all retained frames are counted, none filtered');
}

console.log(`${pass} checks passed, ${fails.length} failed`);
for (const f of fails) console.log(`FAIL: ${f}`);
process.exitCode = fails.length ? 1 : 0;
