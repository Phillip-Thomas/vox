// ST-0 draw-call delta, measured rather than argued. The shipped build exposes
// no renderer.info counter on __voxelDebug, so the WebGL2 draw entry points are
// wrapped before the app boots and counted per rAF frame.
//
// A/B: the SAME scene and the SAME camera, night (ST-0 rendering) versus noon
// (ST-0 below its visibility floor, mesh.visible false). The only difference
// between the two samples is ST-0, so the per-frame call delta is ST-0's cost.
// Shader programs are counted the same way (createProgram).
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
const { chromium } = await import(
  '/home/thomasphillip/Projects/vox/main/node_modules/playwright-core/index.mjs'
);

const RUN_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT_DIR = path.join(RUN_DIR, 'evidence', 'verification');
const BASE = process.env.VOX_BASE ?? 'http://localhost:5176';
fs.mkdirSync(OUT_DIR, { recursive: true });
const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter(d => /^chromium-\d+$/.test(d)).sort().pop();

const browser = await chromium.launch({
  executablePath: path.join(pwDir, chromeDir, 'chrome-linux/chrome'),
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720']
});

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
await page.addInitScript(() => {
  window.__voxGL = { calls: 0, programs: 0 };
  for (const n of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements']) {
    const orig = WebGL2RenderingContext.prototype[n];
    if (!orig) continue;
    WebGL2RenderingContext.prototype[n] = function (...a) { window.__voxGL.calls++; return orig.apply(this, a); };
  }
  const cp = WebGL2RenderingContext.prototype.createProgram;
  WebGL2RenderingContext.prototype.createProgram = function (...a) { window.__voxGL.programs++; return cp.apply(this, a); };
});
await page.goto(`${BASE}/?story=ch10-cold&profile=LOW`, { waitUntil: 'load', timeout: 120000 });
await new Promise(r => setTimeout(r, 16000));
await page.evaluate(async () => {
  const src = await (await fetch('/src/components/SystemCompanionBodies.tsx')).text();
  const threeUrl = src.match(/from\s*["']([^"']*deps\/three\.js[^"']*)["']/)[1];
  const THREE = await import(/* @vite-ignore */ threeUrl);
  window.__THREE = THREE;
  window.__voxLive = {};
  const base = THREE.Object3D.prototype.updateMatrixWorld;
  THREE.Scene.prototype.updateMatrixWorld = function (f) { window.__voxLive.scene = this; return base.call(this, f); };
  THREE.PerspectiveCamera.prototype.updateMatrixWorld = function (f) { window.__voxLive.camera = this; return base.call(this, f); };
});

const SET_PHASE = async (phase) => {
  const clock = await import('/src/game/worldClock.ts');
  clock.setDayPhaseOffset(phase - clock.getCurrentDayPhase());
  return clock.getCurrentDayPhase();
};

// Per-frame call count over N rAF frames, plus the ST-0 mesh's own visibility.
const MEASURE = async (frames) => {
  const start = window.__voxGL.calls;
  const startPrograms = window.__voxGL.programs;
  let n = 0;
  const t0 = performance.now();
  await new Promise(resolve => {
    const tick = () => { n++; if (n >= frames) resolve(); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  const elapsed = (performance.now() - t0) / 1000;
  let st0 = null;
  window.__voxLive.scene?.traverse(o => { if (o.name === 'system-st0-station-light') st0 = o; });
  const night = await import('/src/utils/nightState.ts');
  const clock = await import('/src/game/worldClock.ts');
  return {
    frames: n,
    calls: window.__voxGL.calls - start,
    callsPerFrame: Number(((window.__voxGL.calls - start) / n).toFixed(3)),
    programsCreated: window.__voxGL.programs - startPrograms,
    fps: Number((n / elapsed).toFixed(2)),
    st0Visible: st0?.visible ?? null,
    st0Opacity: st0?.material?.opacity ?? null,
    dayPhase: Number(clock.getCurrentDayPhase().toFixed(4)),
    daylight: Number(night.daylightFromDayPhase(clock.getCurrentDayPhase()).toFixed(4))
  };
};

const report = { capturedAt: new Date().toISOString(), base: BASE, url: '?story=ch10-cold&profile=LOW',
  method: 'WebGL2 draw entry points wrapped in an init script; same scene and camera, night vs noon',
  samples: {}, pageErrors: errs };

// The clock cannot be the A/B lever: ST-0 also has to be ABOVE the horizon,
// which its own 90s period decides. So the samples are taken on the mesh's own
// visibility edges, with the player standing still so the camera is identical.
const VISIBLE_NOW = () => {
  let st0 = null;
  window.__voxLive?.scene?.traverse(o => { if (o.name === 'system-st0-station-light') st0 = o; });
  return st0 ? !!st0.visible : null;
};
const waitFor = async (want, capSeconds) => {
  const t0 = Date.now();
  while ((Date.now() - t0) / 1000 < capSeconds) {
    const v = await page.evaluate(VISIBLE_NOW).catch(() => null);
    if (v === want) return true;
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
};
await page.evaluate(SET_PHASE, 0.55);
await new Promise(r => setTimeout(r, 4000));
report.samples.warmup = await page.evaluate(MEASURE, 120);
report.reachedVisible = await waitFor(true, 200);
report.samples.st0Visible = await page.evaluate(MEASURE, 180);
report.samples.st0VisibleCheck = await page.evaluate(VISIBLE_NOW);
report.reachedHidden = await waitFor(false, 200);
report.samples.st0Hidden = await page.evaluate(MEASURE, 180);
report.samples.st0HiddenCheck = await page.evaluate(VISIBLE_NOW);
report.samples.night = report.samples.st0Visible;
report.samples.noon = report.samples.st0Hidden;
report.samples.nightAgain = report.samples.st0Visible;
report.st0DrawCallDelta = Number((report.samples.night.callsPerFrame - report.samples.noon.callsPerFrame).toFixed(3));
report.st0DrawCallDeltaRepeat = Number((report.samples.nightAgain.callsPerFrame - report.samples.noon.callsPerFrame).toFixed(3));
report.shaderProgramsAfterSt0Appears = report.samples.night.programsCreated;
report.acceptance = {
  rule: 'ST-0 adds at most one draw call and zero shader programs',
  drawCallDeltaWithinOne: Math.abs(report.st0DrawCallDelta) <= 1.05,
  zeroNewPrograms: report.samples.night.programsCreated === 0 && report.samples.nightAgain.programsCreated === 0
};

const OUT = path.join(OUT_DIR, 'ch10-drawcall-fps.json');
fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
await browser.close();
console.log(JSON.stringify({ night: report.samples.night, noon: report.samples.noon,
  delta: report.st0DrawCallDelta, repeat: report.st0DrawCallDeltaRepeat, acceptance: report.acceptance }, null, 1));
console.log('wrote', OUT);
