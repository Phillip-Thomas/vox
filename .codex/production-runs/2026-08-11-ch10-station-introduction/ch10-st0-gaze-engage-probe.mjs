// G-1. Does the ST-0 gaze bias ENGAGE on the live path?
//
// The solver repair is proven correct in isolation (ch10-st0-gaze-solver.json:
// worst pitch error 25.000 degrees -> 0.000) and the crossing strip did not move
// at all. That is the run's recurring failure shape — a state machine that is
// right in a unit test and never reached in the live path — so this probe
// refuses to reason about the predicate and measures it instead.
//
// It samples getSt0GazeDiag() every ~120ms in BOTH lanes at the same ch10-cold
// entry, and reports each conjunct separately: movie, autopilot driving, ST-0
// above the analytic horizon with a direction, and the absence of a goal-critical
// look demand — plus engagement counts, the blocking reason, and ST-0's live
// in-frustum state read straight off the scene graph.
//
// Usage (dev server must already be on 5176):
//   node ch10-st0-gaze-engage-probe.mjs
// Env: VOX_BASE (default http://localhost:5176), VOX_SECONDS (default 75).

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const { chromium } = await import(
  '/home/thomasphillip/Projects/vox/main/node_modules/playwright-core/index.mjs'
);

const BASE = process.env.VOX_BASE ?? 'http://localhost:5176';
const SECONDS = Number(process.env.VOX_SECONDS ?? 75);
const OUT_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), 'evidence');
const pwDir = path.join(os.homedir(), '.cache', 'ms-playwright');
const chromeDir = fs.readdirSync(pwDir).find(d => d.startsWith('chromium-'));

const READ = async () => {
  const w = window;
  const out = { t: Math.round(performance.now()), beat: w.__storyBeat ?? null };
  // THE APP'S OWN OBJECT, not a copy reached through a second module instance.
  // A probe that dynamic-imports autopilot.ts cannot prove it is reading the
  // same instance the game writes, so "all counters zero" would have two
  // explanations. This global is written from inside the tick and has one.
  out.gaze = w.__st0Gaze ? { ...w.__st0Gaze } : null;
  out.autopilotTicking = !!w.__autopilot;
  try {
    const live = w.__voxLive, THREE = w.__THREE;
    if (live?.scene && live?.camera) {
      let st0 = null;
      live.scene.traverse(o => { if (o.name === 'system-st0-station-light') st0 = o; });
      if (st0) {
        const wp = new THREE.Vector3();
        st0.getWorldPosition(wp);
        const ndc = wp.clone().project(live.camera);
        out.st0 = {
          visible: st0.visible,
          ndcX: Math.round(ndc.x * 1000) / 1000,
          ndcY: Math.round(ndc.y * 1000) / 1000,
          inFrustum: Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && ndc.z > -1 && ndc.z < 1
        };
      } else out.st0 = null;
    }
  } catch (e) { out.st0Error = String(e).slice(0, 140); }
  // S-1 / the undeclared lens move, measured on the same timeline: the render
  // camera's own fov, the flight feedback's fov target, and the cockpit shell's
  // compensation scale, so "FOV 79 at the seam, 70.0002 at the cut line" can be
  // confirmed or refuted per frame rather than inferred from two stills.
  try {
    const live = w.__voxLive;
    const fb = await import(/* @vite-ignore */ '/src/state/shipFlightFeedback.ts');
    const f = fb.getShipFlightFeedback();
    let shellScale = null;
    if (live?.scene) {
      live.scene.traverse(o => {
        if (o.name === 'ship-cockpit-pressure-shell') shellScale = Math.round(o.scale.y * 100000) / 100000;
      });
    }
    out.lens = {
      cameraFov: live?.camera?.fov != null ? Math.round(live.camera.fov * 10000) / 10000 : null,
      feedbackFov: Math.round(f.fov * 10000) / 10000,
      boost: Math.round(f.boost * 1000) / 1000,
      speed: Math.round((f.speed ?? 0) * 10) / 10,
      shellScale
    };
  } catch (e) { out.lensError = String(e).slice(0, 140); }
  return out;
};

// three.js assigns WebGLRenderer#render as an OWN property, so the prototype
// hook goes on Scene/PerspectiveCamera instead. Lifted verbatim from
// ch10-gap-strip-probe.mjs so this probe sees exactly the scene that one sees.
const INSTALL_HOOK = async () => {
  if (window.__voxHooked) return true;
  const src = await (await fetch('/src/components/SystemCompanionBodies.tsx')).text();
  const threeUrl = src.match(/from\s*["']([^"']*deps\/three\.js[^"']*)["']/)[1];
  const THREE = await import(/* @vite-ignore */ threeUrl);
  window.__THREE = THREE;
  window.__voxLive = {};
  const base = THREE.Object3D.prototype.updateMatrixWorld;
  THREE.Scene.prototype.updateMatrixWorld = function (f) { window.__voxLive.scene = this; return base.call(this, f); };
  THREE.PerspectiveCamera.prototype.updateMatrixWorld = function (f) { window.__voxLive.camera = this; return base.call(this, f); };
  window.__voxHooked = true;
  return true;
};

const browser = await chromium.launch({
  executablePath: path.join(pwDir, chromeDir, 'chrome-linux/chrome'),
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720']
});

const report = { probe: 'ch10-st0-gaze-engage', capturedAt: new Date().toISOString(), base: BASE, lanes: {} };

for (const lane of [
  { id: 'manual', url: '?story=ch10-cold&profile=LOW' },
  { id: 'movie', url: '?story=ch10-cold&movie=1&profile=LOW' }
]) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  await page.goto(`${BASE}/${lane.url}`, { waitUntil: 'load', timeout: 180000 });
  await page.evaluate(INSTALL_HOOK).catch(e => errs.push('hook ' + String(e).slice(0, 120)));
  await new Promise(r => setTimeout(r, 12000));
  await page.evaluate(INSTALL_HOOK).catch(() => {});

  const samples = [];
  const t0 = Date.now();
  while ((Date.now() - t0) / 1000 < SECONDS) {
    const s = await page.evaluate(READ).catch(() => null);
    if (s) samples.push(s);
    await new Promise(r => setTimeout(r, 120));
  }
  await page.close();

  const withGaze = samples.filter(s => s.gaze);
  const last = withGaze.length ? withGaze[withGaze.length - 1].gaze : null;
  const blockers = {};
  for (const s of withGaze) {
    const key = s.gaze.blockedBy ?? (s.gaze.engaged ? 'engaged' : 'unknown');
    blockers[key] = (blockers[key] ?? 0) + 1;
  }
  report.lanes[lane.id] = {
    url: lane.url,
    samples: samples.length,
    samplesWithGazeDiag: withGaze.length,
    samplesWithAutopilotTicking: samples.filter(s => s.autopilotTicking).length,
    beats: [...new Set(samples.map(s => s.beat))],
    // The counters below are per TICKED WALK FRAME, not per sample: the bias is
    // only ticked while a walk phase is running, so `frames` is itself evidence
    // of whether the sampled window contained any walking at all.
    counters: last && {
      frames: last.frames,
      framesMovie: last.framesMovie,
      framesDriving: last.framesDriving,
      framesAvailable: last.framesAvailable,
      framesGoalCritical: last.framesGoalCritical,
      framesAllConjunctsTrue: last.framesAllConjunctsTrue,
      framesEngaged: last.framesEngaged,
      engagements: last.engagements
    },
    blockedByHistogram: blockers,
    st0VisibleSamples: samples.filter(s => s.st0?.visible).length,
    st0InFrustumSamples: samples.filter(s => s.st0?.inFrustum).length,
    st0Samples: samples.filter(s => s.st0).length,
    pageErrors: errs.slice(0, 6),
    finalDiag: last,
    lens: (() => {
      const rows = samples.filter(s => s.lens && s.lens.feedbackFov != null);
      if (!rows.length) return null;
      const fovs = rows.map(r => r.lens.feedbackFov);
      const cams = rows.filter(r => r.lens.cameraFov != null).map(r => r.lens.cameraFov);
      const scales = rows.filter(r => r.lens.shellScale != null).map(r => r.lens.shellScale);
      return {
        samples: rows.length,
        feedbackFovMin: Math.min(...fovs),
        feedbackFovMax: Math.max(...fovs),
        cameraFovMin: cams.length ? Math.min(...cams) : null,
        cameraFovMax: cams.length ? Math.max(...cams) : null,
        boostMax: Math.max(...rows.map(r => r.lens.boost)),
        speedMax: Math.max(...rows.map(r => r.lens.speed)),
        shellScaleMin: scales.length ? Math.min(...scales) : null,
        shellScaleMax: scales.length ? Math.max(...scales) : null,
        framesAboveFov73_72: fovs.filter(v => v > 73.72).length,
        // PER BEAT, because the lanes share a timeline: ch10-ask's return
        // crossing deliberately reuses ch8's boosted grammar, while
        // ch10-transit is the leg whose own shot ladder declares FOV 70.
        // A whole-run maximum cannot tell those apart.
        byBeat: Object.fromEntries([...new Set(rows.map(r => r.beat))].map(beat => {
          const b = rows.filter(r => r.beat === beat);
          const bf = b.map(r => r.lens.feedbackFov);
          const bc = b.filter(r => r.lens.cameraFov != null).map(r => r.lens.cameraFov);
          const bs = b.filter(r => r.lens.shellScale != null).map(r => r.lens.shellScale);
          return [String(beat), {
            samples: b.length,
            feedbackFovMin: Math.min(...bf),
            feedbackFovMax: Math.max(...bf),
            cameraFovMin: bc.length ? Math.min(...bc) : null,
            cameraFovMax: bc.length ? Math.max(...bc) : null,
            boostMax: Math.max(...b.map(r => r.lens.boost)),
            speedMax: Math.max(...b.map(r => r.lens.speed)),
            shellScaleMax: bs.length ? Math.max(...bs) : null,
            framesAboveFov73_72: bf.filter(v => v > 73.72).length
          }];
        }))
      };
    })()
  };
  fs.writeFileSync(path.join(OUT_DIR, 'ch10-st0-gaze-engage.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`[${lane.id}] ticking=${report.lanes[lane.id].samplesWithAutopilotTicking}/${samples.length} beats=${report.lanes[lane.id].beats} ${JSON.stringify(report.lanes[lane.id].counters)} blocked=${JSON.stringify(blockers)} inFrustum=${report.lanes[lane.id].st0InFrustumSamples}/${report.lanes[lane.id].st0Samples} lensByBeat=${JSON.stringify(report.lanes[lane.id].lens?.byBeat)}`);
}

await browser.close();
console.log('wrote evidence/ch10-st0-gaze-engage.json');
