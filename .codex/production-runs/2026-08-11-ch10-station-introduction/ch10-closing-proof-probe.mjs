// Final proof round, closing captures. Every in-page module is resolved through
// the APP'S OWN (HMR-timestamped) specifier: a bare import('/src/...') returns a
// second, pristine module instance after any source edit and describes a runtime
// nobody is playing. One browser, one page at a time.
//
// Modes:
//   --mode=strip-ask-a       8 LOW frames, capture-strip-ask-a criterion
//   --mode=cutline           HIGH still re-staged AT the named moment (pre-positioned)
//   --mode=st0               ST-0 v5 OPERATIONAL still + >=3 consecutive-period trace
//   --mode=variant-transit   the 4 remaining transit anchors, all 4 registry variants
//   --mode=marker-invariant  mutation-level marker invariant, both entry paths
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
const MODE = (process.argv.find(a => a.startsWith('--mode=')) ?? '--mode=strip-ask-a').split('=')[1];
fs.mkdirSync(CAP_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });
const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter(d => /^chromium-\d+$/.test(d)).sort().pop();

// ---------------------------------------------------------------- in-page code
const RESOLVE = async () => {
  const hosts = ['/src/App.tsx', '/src/story/StoryDirectorDriver.tsx',
    '/src/story/emergentStoryDirector.ts', '/src/components/ShipController.tsx',
    '/src/components/SystemCompanionBodies.tsx', '/src/story/autopilot.ts',
    '/src/components/CameraControls.tsx', '/src/story/storyDirector.ts'];
  const want = {
    signedAv: /signedSceneAvRuntime\.ts/, spaceFlight: /state\/spaceFlight\.ts/,
    systemFlight: /state\/systemFlight\.ts/, storyState: /story\/storyState\.ts/,
    progression: /progressionSystem\.ts/, graphics: /config\/graphicsSettings\.ts/,
    score: /emergentScoreDirector\.ts/, relay: /world\/WreckRelay\.tsx/,
    worldClock: /game\/worldClock\.ts/, nightState: /utils\/nightState\.ts/,
    mobileInput: /utils\/mobileInput\.ts/, autopilot: /\/autopilot\.ts/,
    devFlag: /spaceStationDevFlag\.ts/
  };
  const found = {};
  for (const h of hosts) {
    let src; try { src = await (await fetch(h)).text(); } catch { continue; }
    for (const [k, re] of Object.entries(want)) {
      if (found[k]) continue;
      for (const m of src.matchAll(/from\s*["']([^"']+)["']/g)) if (re.test(m[1])) { found[k] = m[1]; break; }
    }
  }
  window.__voxSpec = found;
  // Live three.js objects. Prefer the r3f root store (exact, single source);
  // fall back to a prototype hook that COLLECTS every scene/camera, because the
  // post-processing pass owns its own Scene and a last-write-wins hook captures
  // the composer's quad scene at HIGH instead of the world.
  try {
    const canvas = document.querySelector('canvas');
    const store = canvas?.__r3f?.root;
    if (store?.getState) window.__voxRoot = store;
  } catch { /* ignore */ }
  try {
    const cs = await (await fetch('/src/components/SystemCompanionBodies.tsx')).text();
    const threeUrl = cs.match(/from\s*["']([^"']*deps\/three\.js[^"']*)["']/)[1];
    const THREE = await import(/* @vite-ignore */ threeUrl);
    window.__THREE = THREE;
    if (!window.__voxHooked) {
      window.__voxScenes = new Map();
      window.__voxCameras = new Map();
      const base = THREE.Object3D.prototype.updateMatrixWorld;
      // COUNT the updates. Picking "the last one seen" hands back the
      // post-processing pass's own camera/scene at HIGH, which is how a still
      // came back reporting fov -90 and azimuth 0.
      THREE.Scene.prototype.updateMatrixWorld = function (f) {
        window.__voxScenes.set(this, (window.__voxScenes.get(this) ?? 0) + 1); return base.call(this, f); };
      THREE.PerspectiveCamera.prototype.updateMatrixWorld = function (f) {
        window.__voxCameras.set(this, (window.__voxCameras.get(this) ?? 0) + 1); return base.call(this, f); };
      window.__voxHooked = true;
    }
  } catch (e) { window.__voxThreeError = String(e).slice(0, 160); }
  return found;
};

const LIVE = () => {
  const w = window, THREE = w.__THREE;
  const st = w.__voxRoot?.getState?.() ?? null;
  let scene = st?.scene ?? null, camera = st?.camera ?? null;
  if (!scene && w.__voxScenes) {
    for (const s of w.__voxScenes.keys()) {
      let hit = false;
      s.traverse(o => { if (o.name === 'system-companion-bodies' || o.name === 'system-st0-station-light') hit = true; });
      if (hit) { scene = s; break; }
    }
  }
  if (!camera && w.__voxCameras) {
    // The world camera is the perspective camera that is actually driving the
    // render: sane lens, real depth range, and the highest update count.
    let bestTicks = -1;
    for (const [c, ticks] of w.__voxCameras.entries()) {
      if (!c.isPerspectiveCamera) continue;
      if (!(c.fov > 20 && c.fov < 140) || !(c.far > 500)) continue;
      if (ticks > bestTicks) { bestTicks = ticks; camera = c; }
    }
    if (camera) { camera.updateMatrixWorld(true); }
  }
  if (!scene || !camera || !THREE) return { liveError: 'no scene/camera' };
  const camPos = new THREE.Vector3(); camera.getWorldPosition(camPos);
  const up = camPos.clone().normalize();
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const project = (obj) => {
    const wp = new THREE.Vector3(); obj.getWorldPosition(wp);
    const ndc = wp.clone().project(camera);
    const dir = wp.clone().sub(camPos).normalize();
    const alt = 90 - Math.acos(Math.max(-1, Math.min(1, dir.dot(up)))) * 180 / Math.PI;
    // Azimuth in the local horizon plane, referenced to an arbitrary but FIXED
    // world axis, so azimuth differences across samples are meaningful.
    const east = new THREE.Vector3(0, 1, 0).cross(up);
    const eLen = east.length();
    const eastN = eLen > 1e-6 ? east.multiplyScalar(1 / eLen) : new THREE.Vector3(1, 0, 0);
    const north = up.clone().cross(eastN).normalize();
    const flat = dir.clone().addScaledVector(up, -dir.dot(up));
    const az = Math.atan2(flat.dot(eastN), flat.dot(north)) * 180 / Math.PI;
    return { name: obj.name, visible: obj.visible,
      opacity: obj.material?.opacity ?? null,
      ndc: [Number(ndc.x.toFixed(4)), Number(ndc.y.toFixed(4))],
      inFrame: Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && ndc.z > -1 && ndc.z < 1,
      altitudeDeg: Number(alt.toFixed(3)), azimuthDeg: Number(az.toFixed(3)) };
  };
  const out = { st0: null, companions: [], galaxy: [], fov: camera.fov,
    cameraAltDeg: Number((90 - Math.acos(Math.max(-1, Math.min(1, fwd.dot(up)))) * 180 / Math.PI).toFixed(3)) };
  const east0 = new THREE.Vector3(0, 1, 0).cross(up);
  const eN = east0.length() > 1e-6 ? east0.normalize() : new THREE.Vector3(1, 0, 0);
  const nN = up.clone().cross(eN).normalize();
  const fflat = fwd.clone().addScaledVector(up, -fwd.dot(up));
  out.cameraAzDeg = Number((Math.atan2(fflat.dot(eN), fflat.dot(nN)) * 180 / Math.PI).toFixed(3));
  scene.traverse(o => {
    if (o.name === 'system-st0-station-light') out.st0 = project(o);
    else if (/^system-companion-body-/.test(o.name)) out.companions.push(project(o));
    else if (/galaxy/i.test(o.name)) out.galaxy.push({ name: o.name, visible: o.visible, ...project(o) });
  });
  return out;
};

const READ = async () => {
  const w = window; const spec = w.__voxSpec ?? {};
  const imp = async (k) => (spec[k] ? import(/* @vite-ignore */ spec[k]) : null);
  const hud = document.querySelector('[data-story-guidance-hud]');
  const caption = document.querySelector('[data-story-caption]');
  const out = { wallMs: Math.round(performance.now()), beat: w.__storyBeat ?? null,
    objectiveId: hud?.getAttribute('data-objective-id') ?? null,
    markerLabel: hud?.getAttribute('data-objective-marker-label') ?? null,
    health: hud?.getAttribute('data-objective-health') ?? null,
    requiresMarker: hud?.getAttribute('data-objective-requires-marker') ?? null,
    hudText: hud ? hud.innerText.replace(/\s*\n\s*/g, ' | ').trim() : null,
    caption: caption ? caption.innerText.trim() : null };
  try { const f = await imp('spaceFlight');
    if (f) { const s = f.getSpaceFlightSnapshot(); out.flight = { phase: s.phase, controlMode: s.controlMode }; } } catch { /* ignore */ }
  try { const s = await imp('systemFlight');
    if (s) { const v = s.getSystemFlightSnapshot();
      out.system = { activePlanetId: v.activePlanetId, locationMode: v.locationMode,
        targetWorldId: v.target?.worldId ?? null, targetKind: v.target?.kind ?? null,
        pos: (v.pose?.position ?? []).map(n => Math.round(n)),
        speed: Math.round(Math.hypot(...(v.pose?.velocity ?? [0, 0, 0])) * 100) / 100 }; } } catch { /* ignore */ }
  try { const av = await imp('signedAv');
    if (av) { const s = av.getSignedSceneAvDebugSnapshot();
      out.av = { active: s.active, beat: s.beat, anchorId: s.anchorId,
        history: s.activationHistoryAnchorIds ?? [], authority: s.shot?.cameraAuthority ?? null,
        fov: s.shot?.lens?.appliedFovDeg ?? null, agency: s.shot?.agency ?? null,
        letterbox: s.shot?.letterbox ?? null, postFx: s.postFx?.activeEffectIds ?? [],
        reset: s.lastResetReason ?? null }; } } catch { /* ignore */ }
  try { const st = await imp('storyState'); const pr = await imp('progression');
    if (st && pr) out.milestones = {
      relayAsked: pr.hasMilestone(st.STORY_MILESTONES.ch10RelayAsked),
      bearingClaimed: pr.hasMilestone(st.STORY_MILESTONES.ch10BearingClaimed),
      transitIgnited: pr.hasMilestone(st.STORY_MILESTONES.ch10TransitIgnited),
      seamPassed: pr.hasMilestone(st.STORY_MILESTONES.ch10SeamPassed),
      stationResolved: pr.hasMilestone(st.STORY_MILESTONES.ch10StationResolved),
      ch10Complete: pr.hasMilestone(st.STORY_MILESTONES.ch10Complete) }; } catch { /* ignore */ }
  try { const sc = await imp('score'); if (sc) out.score = sc.getChapter10ScoreSnapshot(); } catch { /* ignore */ }
  try { const g = await imp('graphics');
    if (g) { out.qualityProfile = g.getQualityProfile(); out.postProcess = g.getGraphicsQuality().postProcess; } } catch { /* ignore */ }
  try { const c = await imp('worldClock'); const n = await imp('nightState');
    if (c && n) { out.dayPhase = Number(c.getCurrentDayPhase().toFixed(4));
      out.daylight = Number(n.daylightFromDayPhase(c.getCurrentDayPhase()).toFixed(4));
      out.isNight = n.isDarkDaylight(out.daylight); } } catch { /* ignore */ }
  try { const r = await imp('relay'); const p = r?.wreckRelayHandle?.position;
    out.relayHandle = p ? [Math.round(p.x), Math.round(p.y), Math.round(p.z)] : null; } catch { /* ignore */ }
  out.contacts = w.__spaceStationContacts ? w.__spaceStationContacts() : null;
  const ap = w.__autopilot;
  if (ap) out.autopilot = { beat: ap.beat, clock: ap.clock, pos: ap.pos, stillTime: ap.stillTime,
    teleportNudgesTotal: ap.teleportNudgesTotal,
    keys: Object.entries(ap.controls ?? {}).filter(([, v]) => v === true).map(([k]) => k) };
  return out;
};

const SET_PROFILE = async (p) => {
  const g = await import(/* @vite-ignore */ (window.__voxSpec ?? {}).graphics);
  g.setQualityProfile(p, { persist: false });
  return g.getQualityProfile();
};

// ------------------------------------------------------------------- harness
const browser = await chromium.launch({
  executablePath: path.join(pwDir, chromeDir, 'chrome-linux/chrome'),
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720']
});
const report = { capturedAt: new Date().toISOString(), base: BASE, mode: MODE };
const OUT = path.join(OUT_DIR, `ch10-closing-${MODE}.json`);
const flush = () => fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');

async function open(url, opts = {}) {
  const page = await browser.newPage({ viewport: opts.viewport ?? { width: 1280, height: 720 },
    isMobile: !!opts.isMobile, hasTouch: !!opts.isMobile,
    reducedMotion: opts.reducedMotion ?? 'no-preference' });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
  await page.goto(`${BASE}/${url}`, { waitUntil: 'load', timeout: 180000 });
  if (opts.preResolveScript) await page.evaluate(opts.preResolveScript).catch(() => {});
  if (opts.resolveBeforeSettle) {
    await page.evaluate(RESOLVE).catch(e => errs.push('resolve ' + String(e).slice(0, 140)));
    await new Promise(r => setTimeout(r, opts.settle ?? 0));
  } else {
    await new Promise(r => setTimeout(r, opts.settle ?? 8000));
    await page.evaluate(RESOLVE).catch(e => errs.push('resolve ' + String(e).slice(0, 140)));
  }
  return { page, errs };
}

// =============================================================== strip-ask-a
if (MODE === 'strip-ask-a') {
  const dir = path.join(CAP_DIR, 'strip-ask-a');
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
  // The reboard verb fires 0.3-4.5 s into the beat, so any generous settle eats
  // the "before" frame. Open with a shrinking settle until the first sample is
  // genuinely PRE-board (on foot, or standing on the reboard rung).
  let page = null, errs = null;
  report.settleAttempts = [];
  for (const settle of [0, 0, 0]) {
    const o = await open('?story=ch10-ask&movie=1&profile=LOW', { settle, resolveBeforeSettle: true });
    const first = await o.page.evaluate(READ).catch(() => null);
    const preBoard = first && (first.flight?.controlMode === 'fps'
      || first.objectiveId === 'station:return:reboard');
    // Shoot the pre-board frame HERE: the movie lane boards within ~0.2 s of
    // beat entry, so a screenshot taken after a second READ is already too late.
    if (preBoard) { report.__primeShot = await o.page.screenshot(); report.__primeState = first; }
    report.settleAttempts.push({ settleMs: settle, objectiveId: first?.objectiveId ?? null,
      controlMode: first?.flight?.controlMode ?? null, preBoard: !!preBoard });
    if (preBoard) { page = o.page; errs = o.errs; break; }
    await o.page.close();
  }
  if (!page) { report.error = 'no settle short enough to catch the pre-board state'; flush(); await browser.close(); process.exit(1); }
  const frames = [];
  let idx = 0;
  const shoot = async (label, state) => {
    const file = `${String(idx).padStart(2, '0')}_${label}_${state.beat ?? 'unknown'}.png`;
    idx++;
    await page.screenshot({ path: path.join(dir, file) });
    frames.push({ file, label, beat: state.beat, t: state.t, objectiveId: state.objectiveId,
      markerLabel: state.markerLabel, health: state.health, hudText: state.hudText,
      flight: state.flight, system: state.system, relayHandle: state.relayHandle,
      shipToRelay: state.shipToRelay ?? null, av: state.av?.anchorId ?? null });
    flush();
    console.log(`  [${file}]`);
  };
  // Rolling "previous" frame so every -before is the last frame that existed
  // BEFORE the predicate flipped, rather than a guessed lead time.
  const TRIGGERS = [
    { key: 'reboard', pred: s => s.flight?.controlMode === 'flight', after: 1200, tail: true },
    { key: 'sibling-acquire', pred: s => !!s.system?.targetWorldId, after: 1500, tail: true },
    { key: 'landfall', pred: s => s.flight?.phase === 'surface' && s.system?.activePlanetId === '-1,-1', after: 0, tail: false }
  ];
  const t0 = Date.now();
  let ti = 0;
  let prevShot = null, prevState = null;
  report.frames = frames;
  report.pageErrors = errs;
  // The pre-board frame was already shot at the gate check, at the only instant
  // it exists in this lane.
  prevShot = report.__primeShot;
  prevState = report.__primeState;
  prevState.t = 0;
  delete report.__primeShot; delete report.__primeState;
  while (ti < TRIGGERS.length && (Date.now() - t0) / 1000 < 240) {
    const s = await page.evaluate(READ).catch(() => null);
    if (!s) { await new Promise(r => setTimeout(r, 200)); continue; }
    s.t = Number(((Date.now() - t0) / 1000).toFixed(2));
    if (s.relayHandle && s.system?.pos) {
      s.shipToRelay = Math.round(Math.hypot(s.system.pos[0] - s.relayHandle[0],
        s.system.pos[1] - s.relayHandle[1], s.system.pos[2] - s.relayHandle[2]));
    }
    const trig = TRIGGERS[ti];
    if (trig.pred(s)) {
      if (prevShot) {
        const file = `${String(idx).padStart(2, '0')}_${trig.key}-before_${prevState.beat ?? 'unknown'}.png`;
        idx++;
        fs.writeFileSync(path.join(dir, file), prevShot);
        frames.push({ file, label: `${trig.key}-before`, beat: prevState.beat, t: prevState.t,
          objectiveId: prevState.objectiveId, markerLabel: prevState.markerLabel,
          health: prevState.health, hudText: prevState.hudText, flight: prevState.flight,
          system: prevState.system, relayHandle: prevState.relayHandle,
          shipToRelay: prevState.shipToRelay ?? null, av: prevState.av?.anchorId ?? null });
        console.log(`  [${file}] (rolling)`);
      }
      await shoot(`${trig.key}-at`, s);
      if (trig.tail) {
        await new Promise(r => setTimeout(r, trig.after));
        const s2 = await page.evaluate(READ);
        s2.t = Number(((Date.now() - t0) / 1000).toFixed(2));
        await shoot(`${trig.key}-after`, s2);
      }
      ti++;
      prevShot = null; prevState = null;
      continue;
    }
    prevShot = await page.screenshot();
    prevState = s;
    await new Promise(r => setTimeout(r, 250));
  }
  report.frameCount = frames.length;
  report.completedTriggers = ti;
  flush();
  await page.close();
}

// =================================================================== cutline
if (MODE === 'cutline') {
  // The last attempt let a 30 s HIGH settle run past the named moment (range
  // 955, K11 expired, a planet in frame). Here HIGH is raised EARLY — at the
  // seam anchor — and the shutter is triggered ON the cut-line state itself.
  const { page, errs } = await open('?story=ch10-transit&movie=1&profile=LOW', { settle: 7000 });
  report.pageErrors = errs;
  report.method = 'flown at LOW; profile raised to HIGH at anc.ch10.seam-of-light so the HIGH pipeline is already warm; shutter triggered on the cut-line predicate (K11 painted AND work order cleared), not on a fixed settle';
  const waitFor = async (pred, cap, interval = 200) => {
    const t0 = Date.now();
    while ((Date.now() - t0) / 1000 < cap) {
      const s = await page.evaluate(READ).catch(() => null);
      if (s && pred(s)) return s;
      await new Promise(r => setTimeout(r, interval));
    }
    return null;
  };
  const seam = await waitFor(s => (s.av?.history ?? []).includes('anc.ch10.seam-of-light'), 300, 300);
  report.seamSeen = !!seam;
  if (seam) {
    const raisedAt = Date.now();
    await page.evaluate(SET_PROFILE, 'HIGH');
    report.raisedToHighAtStationDistance = seam.contacts?.stations?.[0]?.distance ?? null;
    const resolved = await waitFor(s => (s.av?.history ?? []).includes('anc.ch10.station-resolved'), 240, 200);
    report.resolvedSeen = !!resolved;
    if (resolved) {
      report.atResolve = { distance: resolved.contacts?.stations?.[0]?.distance ?? null,
        fov: resolved.av?.fov ?? null, authority: resolved.av?.authority ?? null,
        caption: resolved.caption, objectiveId: resolved.objectiveId,
        qualityProfile: resolved.qualityProfile, score: resolved.score };
      const cut = await waitFor(s => (s.caption ?? '').includes('both fires behind you') && !s.objectiveId, 60, 150);
      const at = await page.evaluate(READ);
      const live = await page.evaluate(LIVE).catch(e => ({ liveError: String(e).slice(0, 140) }));
      await page.screenshot({ path: path.join(CAP_DIR, 'still-station-resolved.png') });
      const after = await page.evaluate(READ);
      report.cutLineReached = !!cut;
      report.still = { id: 'still-station-resolved', file: 'evidence/capture/still-station-resolved.png',
        tier: at.qualityProfile, secondsHighWarmBeforeShutter: Number(((Date.now() - raisedAt) / 1000).toFixed(1)),
        k11Painted: (at.caption ?? '').includes('both fires behind you'),
        workOrderCleared: !at.objectiveId, hudText: at.hudText, caption: at.caption,
        stationDistance: at.contacts?.stations?.[0]?.distance ?? null,
        standoffSpec: 1500, fov: at.av?.fov ?? null, cameraFov: live.fov ?? null,
        authority: at.av?.authority ?? null, postFx: at.av?.postFx ?? null,
        galaxyInFrame: (live.galaxy ?? []).some(g => g.visible && g.inFrame),
        galaxyObjects: live.galaxy ?? null,
        planetsInFrame: (live.companions ?? []).filter(c => c.visible && c.inFrame),
        companionCount: (live.companions ?? []).length,
        st0InFrame: live.st0 ? (live.st0.visible && live.st0.inFrame) : false,
        state: at, stateAfterShutter: after };
      flush();
      console.log(`[cutline] profile=${at.qualityProfile} dist=${report.still.stationDistance}`
        + ` k11=${report.still.k11Painted} cleared=${report.still.workOrderCleared}`
        + ` planetsInFrame=${report.still.planetsInFrame.length} galaxy=${report.still.galaxyInFrame}`);
    }
  }
  flush();
  await page.close();
}

// ======================================================================= st0
if (MODE === 'st0') {
  // >=3 CONSECUTIVE periods means 4 peaks, so the window must clear 3x90 s with
  // margin; 300 s only ever yielded 3 peaks (2 intervals).
  const TRACE_SECONDS = Number(process.env.VOX_ST0_TRACE ?? 420);
  const { page, errs } = await open('?story=ch10-cold&profile=LOW', { settle: 12000 });
  report.pageErrors = errs;
  // Hold the night open so the ellipse can be traced across >=3 consecutive
  // periods on the LIVE object rather than reconstructed off-runtime.
  // setDayPhaseOffset REPLACES the offset; the live phase is derived from it.
  // "offset = target - phase" only works while the offset is still zero, which
  // is why an earlier hold drifted back into daylight mid-capture.
  const HOLD_NIGHT = async () => {
    const c = await import(/* @vite-ignore */ (window.__voxSpec ?? {}).worldClock);
    const n = await import(/* @vite-ignore */ (window.__voxSpec ?? {}).nightState);
    const TARGET = 0.62;
    c.setDayPhaseOffset(c.getDayPhaseOffset() + (TARGET - c.getCurrentDayPhase()));
    return { phase: c.getCurrentDayPhase(), offset: c.getDayPhaseOffset(),
      daylight: n.daylightFromDayPhase(c.getCurrentDayPhase()) };
  };
  report.dayPhaseHeld = await page.evaluate(HOLD_NIGHT).catch(e => String(e).slice(0, 120));
  // Enable look. Pointer lock first (the shipped desktop path); the shipped
  // touch flag is the documented fallback and drives the SAME handler.
  await page.mouse.click(640, 360).catch(() => {});
  await new Promise(r => setTimeout(r, 800));
  let locked = await page.evaluate(() => !!document.pointerLockElement).catch(() => false);
  if (!locked) {
    await page.evaluate(async () => {
      const m = await import(/* @vite-ignore */ (window.__voxSpec ?? {}).mobileInput);
      m.setTouchActive(true);
      return true;
    }).catch(() => {});
  }
  report.lookPath = locked ? 'pointer-lock' : 'shipped touch-active flag (same mousemove handler)';
  const LOOK = async ({ dx, dy }) => {
    const m = await import(/* @vite-ignore */ (window.__voxSpec ?? {}).mobileInput);
    m.dispatchLook(dx, dy);
    return true;
  };
  // --- phase telemetry trace -------------------------------------------------
  const samples = [];
  const t0 = Date.now();
  let held = Date.now();
  while ((Date.now() - t0) / 1000 < TRACE_SECONDS) {
    if (Date.now() - held > 6000) { await page.evaluate(HOLD_NIGHT).catch(() => {}); held = Date.now(); }
    const live = await page.evaluate(LIVE).catch(() => null);
    if (live && !live.liveError) {
      samples.push({ t: Number(((Date.now() - t0) / 1000).toFixed(2)),
        visible: live.st0?.visible ?? false, alt: live.st0?.altitudeDeg ?? null,
        az: live.st0?.azimuthDeg ?? null, ndc: live.st0?.ndc ?? null,
        opacity: live.st0?.opacity ?? null,
        moonAlt: (live.companions ?? []).map(c => c.altitudeDeg),
        moonAz: (live.companions ?? []).map(c => c.azimuthDeg) });
    }
    await new Promise(r => setTimeout(r, 500));
  }
  report.traceSamples = samples.length;
  report.trace = samples;
  // Peaks of the altitude track = the latitude maxima.
  const vis = samples.filter(s => s.alt != null);
  const peaks = [];
  for (let i = 2; i < vis.length - 2; i++) {
    const a = vis[i].alt;
    if (a > vis[i - 1].alt && a > vis[i - 2].alt && a >= vis[i + 1].alt && a >= vis[i + 2].alt && a > 0) {
      if (!peaks.length || vis[i].t - peaks[peaks.length - 1].t > 40) peaks.push(vis[i]);
    }
  }
  report.peaks = peaks;
  report.peakIntervalsSeconds = peaks.slice(1).map((p, i) => Number((p.t - peaks[i].t).toFixed(2)));
  report.periodSpecSeconds = 90;
  report.consecutivePeriodsProven = Math.max(0, peaks.length - 1);
  const azs = vis.filter(s => s.alt > 0).map(s => s.az);
  report.bearingAzimuthDeg = azs.length
    ? Number(((Math.min(...azs) + Math.max(...azs)) / 2).toFixed(3)) : null;
  report.azimuthSwingDeg = azs.length
    ? [Number(Math.min(...azs).toFixed(3)), Number(Math.max(...azs).toFixed(3))] : null;
  const peakAlt = peaks.length ? Math.max(...peaks.map(p => p.alt)) : null;
  report.peakAltitudeDeg = peakAlt;
  flush();
  console.log(`[st0] samples=${samples.length} peaks=${peaks.length} intervals=${report.peakIntervalsSeconds}`
    + ` peakAlt=${peakAlt} bearingAz=${report.bearingAzimuthDeg}`);

  // --- stage the v5 operational still ---------------------------------------
  if (peaks.length) {
    const lastPeak = peaks[peaks.length - 1];
    const period = report.peakIntervalsSeconds.length
      ? report.peakIntervalsSeconds.reduce((a, b) => a + b, 0) / report.peakIntervalsSeconds.length : 90;
    const wantYaw = report.bearingAzimuthDeg;
    const wantPitch = peakAlt - 15;
    report.staging = { wantYawDeg: wantYaw, wantPitchDeg: Number(wantPitch.toFixed(3)),
      periodUsedSeconds: Number(period.toFixed(2)) };
    // Closed-loop aim through the shipped mouse-look path (0.002 rad per unit).
    // The nominal 0.002 rad/unit overshot by ~3.3x in practice, so the gain is
    // MEASURED from the achieved rotation each step rather than assumed.
    const aim = async (targetAz, targetAlt) => {
      const log = [];
      // deg per unit, signed: the shipped handler applies -movementX * 0.002 rad.
      let gainAz = -0.002 * (180 / Math.PI), gainAlt = -0.002 * (180 / Math.PI);
      let prev = null;
      for (let i = 0; i < 60; i++) {
        const live = await page.evaluate(LIVE).catch(() => null);
        if (!live || live.liveError) break;
        if (prev) {
          let gotAz = live.cameraAzDeg - prev.az;
          while (gotAz > 180) gotAz -= 360;
          while (gotAz < -180) gotAz += 360;
          const gotAlt = live.cameraAltDeg - prev.alt;
          // SIGNED gain. Storing |gain| and hard-coding the sign in the step is
          // what made the first staging attempt oscillate between +150 and -100
          // degrees: when the true response sign is the opposite of the assumed
          // one, every damped step drives away from the target.
          if (Math.abs(prev.mx) > 5 && Math.abs(gotAz) > 0.05) {
            const g = gotAz / prev.mx;
            if (Math.abs(g) > 1e-4 && Math.abs(g) < 1) gainAz = 0.5 * gainAz + 0.5 * g;
          }
          if (Math.abs(prev.my) > 5 && Math.abs(gotAlt) > 0.05) {
            const g = gotAlt / prev.my;
            if (Math.abs(g) > 1e-4 && Math.abs(g) < 1) gainAlt = 0.5 * gainAlt + 0.5 * g;
          }
        }
        let dAz = targetAz - live.cameraAzDeg;
        while (dAz > 180) dAz -= 360;
        while (dAz < -180) dAz += 360;
        const dAlt = targetAlt - live.cameraAltDeg;
        log.push({ az: live.cameraAzDeg, alt: live.cameraAltDeg, dAz: Number(dAz.toFixed(3)),
          dAlt: Number(dAlt.toFixed(3)), gainAz: Number(gainAz.toFixed(5)), gainAlt: Number(gainAlt.toFixed(5)) });
        if (Math.abs(dAz) < 0.4 && Math.abs(dAlt) < 0.4) break;
        // Damped step against the SIGNED gain.
        const mx = Math.max(-900, Math.min(900, (dAz * 0.6) / gainAz));
        const my = Math.max(-900, Math.min(900, (dAlt * 0.6) / gainAlt));
        await page.evaluate(LOOK, { dx: mx, dy: my });
        prev = { az: live.cameraAzDeg, alt: live.cameraAltDeg, mx, my };
        await new Promise(r => setTimeout(r, 200));
      }
      return log;
    };
    report.aimLog = await aim(wantYaw, wantPitch);
    let aimed = await page.evaluate(LIVE);
    // Moon exclusion: up to +-10 deg of yaw inside the free-look envelope.
    const moonInFrame = () => (aimed.companions ?? []).some(c => c.visible && c.inFrame);
    report.moonInFrameBeforeOffset = moonInFrame();
    let yawOffset = 0;
    for (const off of [0, -5, 5, -10, 10]) {
      if (!moonInFrame()) { yawOffset = off; break; }
      await aim(wantYaw + off, wantPitch);
      aimed = await page.evaluate(LIVE);
      yawOffset = off;
    }
    report.yawOffsetAppliedDeg = yawOffset;
    report.moonInFrameAfterOffset = moonInFrame();
    // Warm HIGH, then shoot at the next latitude maximum.
    const nowLive = await page.evaluate(LIVE);
    await page.evaluate(SET_PROFILE, 'HIGH');
    const raisedAt = Date.now();
    report.highWarmStartAlt = nowLive.st0?.altitudeDeg ?? null;
    // Track to the maximum: shoot when altitude stops rising.
    let best = -999, bestLive = null, shot = false;
    const chaseStart = Date.now();
    let heldChase = Date.now();
    while ((Date.now() - chaseStart) / 1000 < period * 1.6) {
      // The night must be held through the chase too: the previous attempt lost
      // it here and shot the dot at daylight, opacity 0.057.
      if (Date.now() - heldChase > 4000) { await page.evaluate(HOLD_NIGHT).catch(() => {}); heldChase = Date.now(); }
      const live = await page.evaluate(LIVE).catch(() => null);
      if (live && live.st0 && live.st0.visible) {
        if (live.st0.altitudeDeg > best) { best = live.st0.altitudeDeg; bestLive = live; }
        else if (best > 0 && live.st0.altitudeDeg < best - 0.2
          && (Date.now() - raisedAt) / 1000 > 12) {
          // Past the maximum by a measurable margin: this is the crossing peak.
          shot = true;
          break;
        }
      }
      await new Promise(r => setTimeout(r, 700));
    }
    report.bestAltitudeDuringChase = best;
    report.chaseLastLive = bestLive ? { alt: bestLive.st0?.altitudeDeg, az: bestLive.st0?.azimuthDeg } : null;
    await page.evaluate(HOLD_NIGHT).catch(() => {});
    const at = await page.evaluate(READ);
    const live = await page.evaluate(LIVE);
    await page.screenshot({ path: path.join(CAP_DIR, 'still-st0-sighting.png') });
    report.still = { id: 'still-st0-sighting', file: 'evidence/capture/still-st0-sighting.png',
      tier: at.qualityProfile, shutterOnMaximum: shot,
      secondsHighWarmBeforeShutter: Number(((Date.now() - raisedAt) / 1000).toFixed(1)),
      peakAltitudeTracked: best, altitudeAtShutter: live.st0?.altitudeDeg ?? null,
      azimuthAtShutter: live.st0?.azimuthDeg ?? null,
      cameraAzDeg: live.cameraAzDeg, cameraAltDeg: live.cameraAltDeg,
      cameraFov: live.fov, avFov: at.av?.fov ?? null,
      bearingAzimuthDeg: report.bearingAzimuthDeg,
      yawErrorVsBearingDeg: report.bearingAzimuthDeg != null
        ? Number((live.cameraAzDeg - report.bearingAzimuthDeg).toFixed(3)) : null,
      pitchTargetDeg: Number(wantPitch.toFixed(3)),
      pitchErrorDeg: Number((live.cameraAltDeg - wantPitch).toFixed(3)),
      st0Ndc: live.st0?.ndc ?? null,
      st0NdcYUpperThirdTarget: 0.3333,
      st0NdcYErrorFrameHeightPct: live.st0?.ndc
        ? Number((Math.abs(live.st0.ndc[1] - 0.3333) / 2 * 100).toFixed(2)) : null,
      st0Visible: live.st0?.visible ?? false, st0Opacity: live.st0?.opacity ?? null,
      st0InFrame: live.st0?.inFrame ?? false,
      moonInFrame: (live.companions ?? []).filter(c => c.visible && c.inFrame),
      isNight: at.isNight, dayPhase: at.dayPhase, daylight: at.daylight,
      beat: at.beat, objectiveId: at.objectiveId, state: at };
    flush();
    console.log(`[st0-still] profile=${at.qualityProfile} alt=${report.still.altitudeAtShutter}`
      + ` ndc=${JSON.stringify(report.still.st0Ndc)} yawErr=${report.still.yawErrorVsBearingDeg}`
      + ` moonInFrame=${report.still.moonInFrame.length} night=${at.isNight}`);
  }
  flush();
  await page.close();
}

// ========================================================== variant-transit
if (MODE === 'variant-transit') {
  const ANCHORS = ['anc.ch10.transit-ignite', 'anc.ch10.seam-of-light',
    'anc.ch10.station-resolved', 'anc.ch10.threshold-handback'];
  const VARIANTS = [
    { id: 'desktop-high', profile: 'HIGH', viewport: { width: 1280, height: 720 }, reducedMotion: 'no-preference', settle: 25000, cap: 600, iv: 500 },
    { id: 'desktop-medium-reduced-motion', profile: 'MEDIUM', viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce', settle: 14000, cap: 300, iv: 300 },
    { id: 'desktop-low', profile: 'LOW', viewport: { width: 1280, height: 720 }, reducedMotion: 'no-preference', settle: 10000, cap: 240, iv: 250 },
    { id: 'mobile-potato', profile: 'POTATO', viewport: { width: 390, height: 844 }, isMobile: true, reducedMotion: 'no-preference', settle: 10000, cap: 300, iv: 250 }
  ];
  report.anchors = ANCHORS;
  report.variants = {};
  for (const v of VARIANTS) {
    const rec = { id: v.id, profile: v.profile, viewport: `${v.viewport.width}x${v.viewport.height}`,
      reducedMotion: v.reducedMotion === 'reduce', isMobile: !!v.isMobile, byAnchor: {}, order: [] };
    report.variants[v.id] = rec;
    const { page, errs } = await open(`?story=ch10-transit&movie=1&profile=${v.profile}`,
      { settle: v.settle, viewport: v.viewport, isMobile: v.isMobile, reducedMotion: v.reducedMotion });
    rec.pageErrors = errs;
    const t0 = Date.now();
    while ((Date.now() - t0) / 1000 < v.cap) {
      const s = await page.evaluate(READ).catch(() => null);
      if (s) {
        for (const a of s.av?.history ?? []) {
          if (ANCHORS.includes(a) && !rec.byAnchor[a]) {
            rec.order.push(a);
            rec.byAnchor[a] = { t: Number(((Date.now() - t0) / 1000).toFixed(2)), beat: s.beat,
              anchorIdLive: s.av?.anchorId ?? null, authority: s.av?.authority ?? null,
              fov: s.av?.fov ?? null, agency: s.av?.agency ?? null, letterbox: s.av?.letterbox ?? null,
              postFx: s.av?.postFx ?? null, reset: s.av?.reset ?? null,
              objectiveId: s.objectiveId, markerLabel: s.markerLabel, health: s.health,
              requiresMarker: s.requiresMarker, hudText: s.hudText, caption: s.caption,
              score: s.score, stationDistance: s.contacts?.stations?.[0]?.distance ?? null };
            flush();
          }
        }
        if (ANCHORS.every(a => rec.byAnchor[a])) break;
      }
      await new Promise(r => setTimeout(r, v.iv));
    }
    rec.anchorsCaptured = Object.keys(rec.byAnchor).length;
    rec.missingAnchors = ANCHORS.filter(a => !rec.byAnchor[a]);
    rec.seamStrictlyBeforeResolved = (rec.byAnchor['anc.ch10.seam-of-light']?.t ?? Infinity)
      < (rec.byAnchor['anc.ch10.station-resolved']?.t ?? -Infinity);
    flush();
    console.log(`[${v.id}] anchors=${rec.anchorsCaptured}/4 missing=${rec.missingAnchors.join(',')}`
      + ` seamBeforeResolve=${rec.seamStrictlyBeforeResolved} errs=${errs.length}`);
    await page.close();
  }
}

// ======================================================== marker-invariant
if (MODE === 'marker-invariant') {
  // Sampling at 250-700 ms cannot tell a one-frame publication from a
  // half-second one. A MutationObserver installed BEFORE the HUD mounts sees
  // every attribute write, so the publication instant itself is measured.
  const OBSERVE = () => {
    window.__voxMut = [];
    const ATTRS = ['data-objective-id', 'data-objective-health',
      'data-objective-requires-marker', 'data-objective-marker-label'];
    const snap = (el, why) => {
      const rec = { at: Number(performance.now().toFixed(1)), why, beat: window.__storyBeat ?? null };
      for (const a of ATTRS) rec[a.replace('data-objective-', '')] = el.getAttribute(a);
      const last = window.__voxMut[window.__voxMut.length - 1];
      const same = last && ATTRS.every(a => last[a.replace('data-objective-', '')] === rec[a.replace('data-objective-', '')]);
      if (!same) window.__voxMut.push(rec);
    };
    const attach = (el) => {
      snap(el, 'mounted');
      new MutationObserver(() => snap(el, 'attr')).observe(el, { attributes: true, attributeFilter: ATTRS });
    };
    const seen = new WeakSet();
    const scan = () => {
      const el = document.querySelector('[data-story-guidance-hud]');
      if (el && !seen.has(el)) { seen.add(el); attach(el); }
      else if (el) snap(el, 'poll');
      if (!el && window.__voxMut.length) {
        const last = window.__voxMut[window.__voxMut.length - 1];
        if (last.id !== null) window.__voxMut.push({ at: Number(performance.now().toFixed(1)),
          why: 'unmounted', beat: window.__storyBeat ?? null, id: null, health: null,
          'requires-marker': null, 'marker-label': null });
      }
    };
    window.__voxMutErrors = [];
    const startObserver = () => {
      try {
        new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
      } catch (e) { window.__voxMutErrors.push('observer ' + String(e).slice(0, 120)); }
      scan();
    };
    // documentElement may not exist yet when the init script runs, and a throw
    // here would silently leave the whole trace empty.
    if (document.documentElement) startObserver();
    else document.addEventListener('DOMContentLoaded', startObserver);
    // Per-frame backstop: a MutationObserver that fails to attach must not be
    // able to masquerade as "no violations observed".
    const tick = () => { try { scan(); } catch (e) { window.__voxMutErrors.push(String(e).slice(0, 120)); } requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    return true;
  };
  report.paths = {};
  const PATHS = [
    { id: 'deep-link-ch10-ask', url: '?story=ch10-ask&movie=1&profile=LOW', cap: 120 },
    { id: 'flow-ch10-cold-to-ask', url: '?story=ch10-cold&movie=1&profile=LOW', cap: 180 }
  ];
  for (const p of PATHS) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
    await page.addInitScript(OBSERVE);
    await page.goto(`${BASE}/${p.url}`, { waitUntil: 'load', timeout: 180000 });
    await new Promise(r => setTimeout(r, 6000));
    await page.evaluate(RESOLVE).catch(() => {});
    const t0 = Date.now();
    let claimed = false;
    while ((Date.now() - t0) / 1000 < p.cap) {
      const s = await page.evaluate(READ).catch(() => null);
      if (s?.milestones?.bearingClaimed) { claimed = true; break; }
      await new Promise(r => setTimeout(r, 500));
    }
    await new Promise(r => setTimeout(r, 2000));
    const mut = await page.evaluate(() => window.__voxMut ?? []);
    const mutErrors = await page.evaluate(() => window.__voxMutErrors ?? ['no trap installed']).catch(() => ['unreadable']);
    // Dwell of every state, and the invariant question: was a rung that
    // REQUIRES a marker ever observable without a resolved one?
    const events = mut.map((m, i) => ({ ...m,
      dwellMs: i + 1 < mut.length ? Number((mut[i + 1].at - m.at).toFixed(1)) : null }));
    const violations = events.filter(e => e.id && e['requires-marker'] === 'true'
      && e.health === 'missing-marker');
    report.paths[p.id] = { url: p.url, reachedBearingClaim: claimed, pageErrors: errs,
      observerErrors: mutErrors, eventCount: events.length, events,
      mandatoryRungs: [...new Set(events.filter(e => e['requires-marker'] === 'true' && e.id).map(e => e.id))],
      missingMarkerViolations: violations,
      violationCount: violations.length,
      worstViolationDwellMs: violations.length ? Math.max(...violations.map(v => v.dwellMs ?? 0)) : 0 };
    flush();
    console.log(`[${p.id}] events=${events.length} violations=${violations.length}`
      + ` worstDwell=${report.paths[p.id].worstViolationDwellMs}ms claimed=${claimed}`);
    await page.close();
  }
}

await browser.close();
flush();
console.log('wrote', OUT);
