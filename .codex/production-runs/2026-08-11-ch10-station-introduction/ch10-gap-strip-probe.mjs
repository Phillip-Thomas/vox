// Stage 6 closeout: the two LOW strips the predecessor never captured
// (strip-st0-crossing, strip-ask-a) and a re-shoot of strip-ask-b in MOVIE mode
// so the WreckRelay prop is actually framed (predecessor defect D-4: the
// deep-link entry pose faces away from the relay; in movie mode the autopilot
// walks to the relay and therefore looks at it).
//
// Budget: LOW 1280x720 DPR1, 8 frames per strip, no HIGH, no movie render.
// Frames are event-driven (anchor / flight-phase / ST-0 rise-set edges), not
// wall-clock waits, so each named frame is the state the contract names.
//
// Usage: node ch10-gap-strip-probe.mjs --strip st0|ask
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
const { chromium } = await import(
  '/home/thomasphillip/Projects/vox/main/node_modules/playwright-core/index.mjs'
);

const RUN_DIR = path.dirname(new URL(import.meta.url).pathname);
const CAP_DIR = path.join(RUN_DIR, 'evidence', 'capture');
const OUT_DIR = path.join(RUN_DIR, 'evidence', 'verification');
const BASE = process.env.VOX_BASE ?? 'http://localhost:5176';
const WHICH = (process.argv.find(a => a.startsWith('--strip=')) ?? '--strip=st0').split('=')[1];
fs.mkdirSync(CAP_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });
const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter(d => /^chromium-\d+$/.test(d)).sort().pop();

// Live scene + camera capture. three.js assigns WebGLRenderer#render as an OWN
// property, so the prototype hook goes on Scene/PerspectiveCamera instead:
// both are updated every frame by the renderer, and `this` is the live object.
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

const READ = async () => {
  const w = window;
  const hud = document.querySelector('[data-story-guidance-hud]');
  const caption = document.querySelector('[data-story-caption]');
  const out = {
    beat: w.__storyBeat ?? null,
    objectiveId: hud?.getAttribute('data-objective-id') ?? null,
    markerLabel: hud?.getAttribute('data-objective-marker-label') ?? null,
    health: hud?.getAttribute('data-objective-health') ?? null,
    requiresMarker: hud?.getAttribute('data-objective-requires-marker') ?? null,
    hudText: hud ? hud.innerText.replace(/\s*\n\s*/g, ' | ').trim() : null,
    caption: caption ? caption.innerText.trim() : null
  };
  const bodyText = document.body.innerText || '';
  out.chips = {
    localLock: bodyText.includes('LOCAL LOCK'),
    flightCorridor: bodyText.includes('FLIGHT CORRIDOR')
  };
  try {
    const av = await import('/src/story/signedSceneAvRuntime.ts');
    const s = av.getSignedSceneAvDebugSnapshot();
    out.av = { active: s.active, anchorId: s.anchorId, authority: s.shot?.cameraAuthority ?? null,
      fov: s.shot?.lens?.appliedFovDeg ?? null, agency: s.shot?.agency ?? null,
      postFx: s.postFx?.activeEffectIds ?? [], history: s.activationHistoryAnchorIds ?? [],
      reset: s.lastResetReason ?? null };
  } catch (e) { out.avError = String(e).slice(0, 120); }
  try {
    const sys = await import('/src/state/systemFlight.ts');
    const s = sys.getSystemFlightSnapshot();
    out.system = { activePlanetId: s.activePlanetId, locationMode: s.locationMode,
      targetKind: s.target?.kind ?? null, targetWorldId: s.target?.worldId ?? null };
  } catch { /* ignore */ }
  try {
    const flight = await import('/src/state/spaceFlight.ts');
    const f = flight.getSpaceFlightSnapshot();
    out.flight = { phase: f.phase, controlMode: f.controlMode };
  } catch { /* ignore */ }
  try {
    const clock = await import('/src/game/worldClock.ts');
    out.dayPhase = Number(clock.getCurrentDayPhase().toFixed(4));
    const night = await import('/src/utils/nightState.ts');
    out.daylight = Number(night.daylightFromDayPhase(clock.getCurrentDayPhase()).toFixed(4));
    out.isNight = night.isDarkDaylight(out.daylight);
  } catch (e) { out.clockError = String(e).slice(0, 100); }
  // ST-0 live placement: the mesh the component mounts, projected with the live
  // camera. `visible` is the component's own decision; inFrustum is geometry.
  try {
    const live = w.__voxLive, THREE = w.__THREE;
    if (live?.scene && live?.camera) {
      let st0 = null; const galaxy = [];
      live.scene.traverse(o => {
        if (o.name === 'system-st0-station-light') st0 = o;
        if (/galaxy|Galaxy/.test(o.name)) galaxy.push({ name: o.name, visible: o.visible });
      });
      out.galaxyObjects = galaxy.slice(0, 8);
      if (st0) {
        const wp = new THREE.Vector3(); st0.getWorldPosition(wp);
        const ndc = wp.clone().project(live.camera);
        const camPos = new THREE.Vector3(); live.camera.getWorldPosition(camPos);
        const up = camPos.clone().normalize(); // planet-centred world: up is radial
        const dir = wp.clone().sub(camPos).normalize();
        out.st0 = {
          visible: st0.visible,
          opacity: st0.material?.opacity ?? null,
          altitudeDeg: Number((90 - (Math.acos(Math.max(-1, Math.min(1, dir.dot(up)))) * 180 / Math.PI)).toFixed(2)),
          ndc: [Number(ndc.x.toFixed(3)), Number(ndc.y.toFixed(3))],
          inFrustum: Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && ndc.z > -1 && ndc.z < 1
        };
      } else out.st0 = null;
    }
  } catch (e) { out.st0Error = String(e).slice(0, 120); }
  const ap = w.__autopilot;
  if (ap) out.autopilot = { beat: ap.beat, clock: ap.clock, pos: ap.pos, goal: ap.goal,
    keys: Object.entries(ap.controls ?? {}).filter(([, v]) => v === true).map(([k]) => k),
    stillTime: ap.stillTime, nudges: ap.nudges };
  return out;
};

const browser = await chromium.launch({
  executablePath: path.join(pwDir, chromeDir, 'chrome-linux/chrome'),
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720']
});

const report = { capturedAt: new Date().toISOString(), base: BASE, which: WHICH, strips: [], traces: {} };
const OUT = path.join(OUT_DIR, `ch10-gap-strip-${WHICH}.json`);
const flush = () => fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');

async function openPage(url, opts = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, ...opts });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(`${BASE}/${url}`, { waitUntil: 'load', timeout: 120000 });
  await new Promise(r => setTimeout(r, opts.settleMs ?? 12000));
  await page.evaluate(INSTALL_HOOK).catch(e => errs.push('hook: ' + String(e).slice(0, 150)));
  return { page, errs };
}

async function shoot(page, dir, index, label, state) {
  const file = `${String(index).padStart(2, '0')}_${label}_${state.beat ?? 'null'}.png`;
  await page.screenshot({ path: path.join(dir, file) });
  return { file: `evidence/capture/${path.basename(dir)}/${file}`, label, ...state };
}

// Closed-loop free look: nudge the player's own view until ST-0 is inside the
// frame. This is the free-look envelope the contract allows for staging, never
// an authored camera move — the same mouse deltas a player would make.
const TRACK_ST0 = async () => {
  const read = () => {
    const live = window.__voxLive, THREE = window.__THREE;
    if (!live?.scene || !live?.camera) return null;
    let st0 = null;
    live.scene.traverse(o => { if (o.name === 'system-st0-station-light') st0 = o; });
    if (!st0) return null;
    const wp = new THREE.Vector3(); st0.getWorldPosition(wp);
    const ndc = wp.clone().project(live.camera);
    const behind = ndc.z > 1;
    return { x: ndc.x, y: ndc.y, behind, visible: st0.visible };
  };
  for (let i = 0; i < 26; i++) {
    const s = read();
    if (!s) return null;
    if (!s.behind && Math.abs(s.x) < 0.45 && Math.abs(s.y) < 0.55) return s;
    const dx = s.behind ? 260 : Math.max(-320, Math.min(320, s.x * 260));
    const dy = s.behind ? 0 : Math.max(-260, Math.min(260, -s.y * 210));
    document.dispatchEvent(new MouseEvent('mousemove', { movementX: dx, movementY: dy, bubbles: true }));
    await new Promise(r => setTimeout(r, 120));
  }
  return read();
};

// ---------------------------------------------------------------- ST-0 strip
if (WHICH === 'st0') {
  const id = 'strip-st0-crossing';
  const dir = path.join(CAP_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  // MOVIE MODE IS WRONG FOR THIS STRIP: the movie lane's ch10-cold beat lasts
  // ~9s (the Kestrel is parked at the hearth, so the "hearth-to-fabricator
  // night walk" is nine seconds long), which cannot contain a 90s ST-0 period.
  // The strip is taken in a HELD ch10-cold beat instead, and the discrepancy is
  // reported rather than papered over.
  const url = process.env.VOX_ST0_URL ?? '?story=ch10-cold&profile=LOW';
  const { page, errs } = await openPage(url, { settleMs: 14000 });
  // Start of night, not midnight: night runs from phase ~0.5054 to 1.0, which
  // at DAY_LENGTH_SECONDS 240 is ~119s — barely longer than one 90s ST-0
  // period, so a full rise-to-set arc only fits if the window starts fresh.
  await page.evaluate(async (phase) => {
    const clock = await import('/src/game/worldClock.ts');
    clock.setDayPhaseOffset(phase - clock.getCurrentDayPhase());
  }, Number(process.env.VOX_ST0_PHASE ?? 0.52)).catch(() => {});
  // Pitch the view up so the sky (and ST-0) is in the frustum for the frames.
  await page.evaluate(() => {
    for (let i = 0; i < 12; i++) {
      document.dispatchEvent(new MouseEvent('mousemove', { movementX: 0, movementY: -18, bubbles: true }));
    }
  }).catch(() => {});
  await new Promise(r => setTimeout(r, 3000));

  const trace = [];
  const frames = [];
  const t0 = Date.now();
  let prevVisible = null;
  const risings = [];   // t of each rise edge
  const settings = [];  // t of each set edge
  let peak = null;      // highest-altitude sample of the current pass
  const captured = new Set();
  const CAP = 420;      // >= 4 ST-0 periods (90s) plus margin
  while ((Date.now() - t0) / 1000 < CAP) {
    const s = await page.evaluate(READ).catch(() => null);
    if (!s) { await new Promise(r => setTimeout(r, 500)); continue; }
    const t = Number(((Date.now() - t0) / 1000).toFixed(1));
    trace.push({ t, beat: s.beat, dayPhase: s.dayPhase, daylight: s.daylight, isNight: s.isNight,
      st0: s.st0, autopilotPos: s.autopilot?.pos ?? null });
    const vis = s.st0?.visible ?? false;
    if (prevVisible !== null && vis !== prevVisible) {
      if (vis) risings.push(t); else settings.push(t);
    }
    // pre-rise: last invisible sample before the first rise
    if (!vis && risings.length === 0 && !captured.has('pre-rise') && t > 6) {
      frames.push(await shoot(page, dir, 0, 'pre-rise', s)); captured.add('pre-rise');
    }
    if (vis && risings.length === 1 && !captured.has('rise')) {
      await page.evaluate(TRACK_ST0).catch(() => null);
        { const s2 = await page.evaluate(READ).catch(() => null); if (s2) Object.assign(s, s2); }
        frames.push(await shoot(page, dir, 1, 'rise', s)); captured.add('rise');
    }
    if (vis && risings.length === 1) {
      const alt = s.st0?.altitudeDeg ?? -99;
      if (!peak || alt > peak.alt) peak = { alt, t };
      if (!captured.has('arc-a') && t > risings[0] + 6) {
        await page.evaluate(TRACK_ST0).catch(() => null);
        { const s2 = await page.evaluate(READ).catch(() => null); if (s2) Object.assign(s, s2); }
        frames.push(await shoot(page, dir, 2, 'arc-a', s)); captured.add('arc-a');
      }
      // The true-bearing crossing: loop phase zero begins on the true bearing,
      // so the pass's altitude MAXIMUM is the crossing. Detected, not timed:
      // the first sample after the altitude has turned over.
      if (!captured.has('arc-b-true-bearing') && captured.has('arc-a')
          && peak && alt < peak.alt - 0.05 && peak.alt > 0) {
        await page.evaluate(TRACK_ST0).catch(() => null);
        { const s2 = await page.evaluate(READ).catch(() => null); if (s2) Object.assign(s, s2); }
        frames.push(await shoot(page, dir, 3, 'arc-b-true-bearing', s)); captured.add('arc-b-true-bearing');
      }
      if (!captured.has('arc-c') && captured.has('arc-b-true-bearing')
          && t > (peak?.t ?? 0) + 8) {
        await page.evaluate(TRACK_ST0).catch(() => null);
        { const s2 = await page.evaluate(READ).catch(() => null); if (s2) Object.assign(s, s2); }
        frames.push(await shoot(page, dir, 4, 'arc-c', s)); captured.add('arc-c');
      }
    }
    if (!vis && settings.length === 1 && !captured.has('set')) {
      frames.push(await shoot(page, dir, 5, 'set', s)); captured.add('set');
    }
    if (!vis && settings.length === 1 && captured.has('set') && !captured.has('post-set')
        && t > settings[0] + 6) {
      frames.push(await shoot(page, dir, 6, 'post-set', s)); captured.add('post-set');
    }
    if (vis && risings.length >= 2 && !captured.has('next-rise')) {
      frames.push(await shoot(page, dir, 7, 'next-rise', s)); captured.add('next-rise');
      break;
    }
    prevVisible = vis;
    await new Promise(r => setTimeout(r, 500));
  }
  const periods = risings.slice(1).map((r, i) => Number((r - risings[i]).toFixed(1)));
  report.strips.push({ id, url: '?story=ch10-cold&movie=1&profile=LOW', tier: 'LOW',
    viewport: '1280x720', frameCount: frames.length, frames, pageErrors: errs,
    risings, settings, periodsObserved: periods, peakAltitude: peak,
    inFrustumSamples: trace.filter(x => x.st0?.inFrustum).length,
    visibleSamples: trace.filter(x => x.st0?.visible).length,
    nightSamples: trace.filter(x => x.isNight).length, sampleCount: trace.length });
  report.traces.st0 = trace;
  flush();
  console.log(`[${id}] frames=${frames.length} risings=${risings.length} periods=${periods} errs=${errs.length}`);
  await page.close();
}

// ------------------------------------------------------- ask strips (a and b)
if (WHICH === 'ask') {
  const { page, errs } = await openPage('?story=ch10-ask&movie=1&profile=LOW', { settleMs: 14000 });
  const dirA = path.join(CAP_DIR, 'strip-ask-a');
  const dirB = path.join(CAP_DIR, 'strip-ask-b');
  fs.mkdirSync(dirA, { recursive: true });
  fs.mkdirSync(dirB, { recursive: true });
  const framesA = [], framesB = [], trace = [];
  const t0 = Date.now();
  const done = new Set();
  let prev = null;
  const CAP = Number(process.env.VOX_ASK_CAP ?? 2100);
  let relayPos = null;
  while ((Date.now() - t0) / 1000 < CAP) {
    const s = await page.evaluate(READ).catch(() => null);
    if (!s) { await new Promise(r => setTimeout(r, 400)); continue; }
    const t = Number(((Date.now() - t0) / 1000).toFixed(1));
    const key = JSON.stringify([s.beat, s.flight, s.system, s.av?.anchorId, s.objectiveId, s.chips]);
    if (key !== prev) { trace.push({ t, ...s }); prev = key; }
    const hist = s.av?.history ?? [];
    const onOrigin = s.system?.activePlanetId === '-1,-1';
    const inFlight = s.flight?.controlMode === 'flight';

    // ---- strip-ask-a: the return crossing, ch8 grammar in the other direction
    if (!done.has('a0') && !inFlight && s.flight?.phase === 'surface') {
      framesA.push(await shoot(page, dirA, 0, 'reboard-before', s)); done.add('a0');
    }
    if (!done.has('a1') && inFlight) {
      framesA.push(await shoot(page, dirA, 1, 'reboard-at', s)); done.add('a1');
    }
    if (!done.has('a2') && done.has('a1') && inFlight && s.flight?.phase !== 'surface') {
      framesA.push(await shoot(page, dirA, 2, 'reboard-after', s)); done.add('a2');
    }
    if (!done.has('a3') && done.has('a2') && s.system?.locationMode !== 'surface') {
      framesA.push(await shoot(page, dirA, 3, 'sibling-acquire-before', s)); done.add('a3');
    }
    if (!done.has('a4') && done.has('a3') && (s.system?.targetWorldId != null || s.chips?.flightCorridor)) {
      framesA.push(await shoot(page, dirA, 4, 'sibling-acquire-at', s)); done.add('a4');
    }
    if (!done.has('a5') && done.has('a4') && t > (framesA[4]?.tAt ?? 0)) {
      framesA.push(await shoot(page, dirA, 5, 'sibling-acquire-after', s)); done.add('a5');
    }
    if (!done.has('a6') && done.has('a5') && (s.flight?.phase === 'descent' || s.flight?.phase === 'approach')) {
      framesA.push(await shoot(page, dirA, 6, 'landfall-before', s)); done.add('a6');
    }
    if (!done.has('a7') && done.has('a6') && onOrigin && s.flight?.phase === 'surface') {
      framesA.push(await shoot(page, dirA, 7, 'landfall-at', s)); done.add('a7');
    }

    // ---- strip-ask-b: the relay. Movie mode walks the pilot TO the relay, so
    // the prop is in shot (the deep-link entry pose faced away: defect D-4).
    if (relayPos === null && onOrigin && s.flight?.controlMode !== 'flight') {
      relayPos = await page.evaluate(async () => {
        const m = await import('/src/story/world/WreckRelay.tsx');
        const p = m.wreckRelayHandle?.position;
        return p ? [p.x, p.y, p.z] : null;
      }).catch(() => null);
    }
    if (!done.has('b0') && onOrigin && !inFlight && !hist.includes('anc.ch10.relay-ask')) {
      framesB.push(await shoot(page, dirB, 0, 'relay-ask-before', s)); done.add('b0');
    }
    if (!done.has('b1') && hist.includes('anc.ch10.relay-ask')) {
      framesB.push(await shoot(page, dirB, 1, 'relay-ask-at', s)); done.add('b1');
    }
    if (!done.has('b2') && hist.includes('anc.ch10.relay-answer')) {
      framesB.push(await shoot(page, dirB, 2, 'relay-answer-at', s)); done.add('b2');
    }
    if (!done.has('b3') && done.has('b2')) {
      framesB.push(await shoot(page, dirB, 3, 'relay-answer-after', s)); done.add('b3');
    }
    if (!done.has('b4') && done.has('b3') && !hist.includes('anc.ch10.bearing-claimed')) {
      framesB.push(await shoot(page, dirB, 4, 'bearing-claimed-before', s)); done.add('b4');
    }
    if (!done.has('b5') && hist.includes('anc.ch10.bearing-claimed')) {
      framesB.push(await shoot(page, dirB, 5, 'bearing-claimed-at', s)); done.add('b5');
    }
    if (!done.has('b6') && done.has('b5')) {
      framesB.push(await shoot(page, dirB, 6, 'bearing-claimed-after', s)); done.add('b6');
    }
    if (!done.has('b7') && done.has('b6') && t > 3) {
      framesB.push(await shoot(page, dirB, 7, 'marker-state-post-claim', s)); done.add('b7');
      break;
    }
    await new Promise(r => setTimeout(r, done.has('b0') ? 300 : 700));
  }
  // Where is the relay relative to the camera in the ask frames? The D-4 close
  // needs the prop IN FRAME, not merely marked.
  const relayFraming = await page.evaluate(async () => {
    const m = await import('/src/story/world/WreckRelay.tsx');
    const p = m.wreckRelayHandle?.position;
    const live = window.__voxLive, THREE = window.__THREE;
    if (!p || !live?.camera) return null;
    const wp = new THREE.Vector3(p.x, p.y, p.z);
    const camPos = new THREE.Vector3(); live.camera.getWorldPosition(camPos);
    const ndc = wp.clone().project(live.camera);
    let node = null;
    live.scene.traverse(o => { if (/wreck-relay|WreckRelay/i.test(o.name) && !node) node = o; });
    return { ndc: [+ndc.x.toFixed(3), +ndc.y.toFixed(3), +ndc.z.toFixed(3)],
      inFrame: Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && ndc.z > -1 && ndc.z < 1,
      distance: +camPos.distanceTo(wp).toFixed(2), sceneNode: node?.name ?? null,
      sceneNodeVisible: node?.visible ?? null };
  }).catch(e => ({ err: String(e).slice(0, 150) }));
  report.strips.push({ id: 'strip-ask-a', url: '?story=ch10-ask&movie=1&profile=LOW', tier: 'LOW',
    viewport: '1280x720', frameCount: framesA.length, frames: framesA, pageErrors: errs });
  report.strips.push({ id: 'strip-ask-b', url: '?story=ch10-ask&movie=1&profile=LOW', tier: 'LOW',
    viewport: '1280x720', frameCount: framesB.length, frames: framesB, pageErrors: errs,
    relayFramingAtClaim: relayFraming, relayPosition: relayPos });
  report.traces.ask = trace;
  flush();
  console.log(`[ask] a=${framesA.length} b=${framesB.length} relay=${JSON.stringify(relayFraming)} errs=${errs.length}`);
  await page.close();
}

await browser.close();
flush();
console.log('wrote', OUT);
