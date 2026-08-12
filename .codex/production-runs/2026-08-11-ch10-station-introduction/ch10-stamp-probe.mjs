// STAMP PASS probe (draft-v6). Re-proves the three closing fixes and re-stages
// the two HIGH stills whose composition terms moved with the contract.
//
// Every in-page module is resolved through the APP'S OWN (HMR-timestamped)
// specifier — a bare import('/src/...') hands back a second, pristine module
// instance after any source edit and describes a runtime nobody is playing.
// ONE browser, ONE page at a time.
//
// Modes:
//   --mode=marker    marker invariant at MUTATION resolution, four entry paths
//                    (deep links ch10-cold / -ask / -transit, plus the flow).
//                    Records both the guidance HUD (absent when deferred) and
//                    the feed aside (which reads `idle` when nothing is
//                    published), so a deferred rung is measured, not inferred.
//   --mode=strips    regenerates strip-transit-a / -b / -rm-transit from
//                    POST-FIX flights, event-triggered off anchor history and
//                    flight facts instead of the fixed waits that produced a
//                    grounded cockpit under airborne filenames.
//   --mode=cutline   still-station-resolved at the draft-v6 criterion: shutter
//                    on the FIRST FRAME AFTER threshold-handback with K11
//                    painted and the work order cleared. Pre-armed in-page on
//                    rAF, because at HIGH one poll round-trip is ~240 units of
//                    closure and settle-and-drift lands below the 1,000 floor.
//   --mode=st0       still-st0-sighting at the draft-v5 operational staging with
//                    the yaw LOCKED through the HIGH warm by an in-page rAF
//                    closed loop on the shipped look path (the planet turns
//                    under the camera; an open-loop aim drifts out of +-2 deg).
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
const MODE = (process.argv.find(a => a.startsWith('--mode=')) ?? '--mode=marker').split('=')[1];
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
      // COUNT the updates: "the last camera seen" is the post-processing pass's
      // own camera at HIGH, which once reported fov -90 and azimuth 0.
      THREE.Scene.prototype.updateMatrixWorld = function (f) {
        window.__voxScenes.set(this, (window.__voxScenes.get(this) ?? 0) + 1); return base.call(this, f); };
      THREE.PerspectiveCamera.prototype.updateMatrixWorld = function (f) {
        window.__voxCameras.set(this, (window.__voxCameras.get(this) ?? 0) + 1); return base.call(this, f); };
      window.__voxHooked = true;
    }
  } catch (e) { window.__voxThreeError = String(e).slice(0, 160); }
  // Shared world-camera / world-scene picker, installed once so the rAF loops
  // below can use exactly the same selection the reported readings use.
  window.__voxPick = () => {
    const w = window;
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
      let bestTicks = -1;
      for (const [c, ticks] of w.__voxCameras.entries()) {
        if (!c.isPerspectiveCamera) continue;
        if (!(c.fov > 20 && c.fov < 140) || !(c.far > 500)) continue;
        if (ticks > bestTicks) { bestTicks = ticks; camera = c; }
      }
    }
    return { scene, camera };
  };
  // Camera azimuth/altitude in the LOCAL horizon frame, referenced to a fixed
  // world axis so differences across samples are meaningful.
  window.__voxAim = () => {
    const THREE = window.__THREE;
    const { camera } = window.__voxPick();
    if (!camera || !THREE) return null;
    camera.updateMatrixWorld(true);
    const camPos = new THREE.Vector3(); camera.getWorldPosition(camPos);
    const up = camPos.clone().normalize();
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const east = new THREE.Vector3(0, 1, 0).cross(up);
    const eN = east.length() > 1e-6 ? east.normalize() : new THREE.Vector3(1, 0, 0);
    const nN = up.clone().cross(eN).normalize();
    const flat = fwd.clone().addScaledVector(up, -fwd.dot(up));
    return {
      az: Math.atan2(flat.dot(eN), flat.dot(nN)) * 180 / Math.PI,
      alt: 90 - Math.acos(Math.max(-1, Math.min(1, fwd.dot(up)))) * 180 / Math.PI,
      fov: camera.fov
    };
  };
  return found;
};

const LIVE = () => {
  const w = window, THREE = w.__THREE;
  const { scene, camera } = w.__voxPick ? w.__voxPick() : { scene: null, camera: null };
  if (!scene || !camera || !THREE) return { liveError: 'no scene/camera' };
  camera.updateMatrixWorld(true);
  const camPos = new THREE.Vector3(); camera.getWorldPosition(camPos);
  const up = camPos.clone().normalize();
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const east0 = new THREE.Vector3(0, 1, 0).cross(up);
  const eN = east0.length() > 1e-6 ? east0.normalize() : new THREE.Vector3(1, 0, 0);
  const nN = up.clone().cross(eN).normalize();
  const project = (obj) => {
    const wp = new THREE.Vector3(); obj.getWorldPosition(wp);
    const ndc = wp.clone().project(camera);
    const dir = wp.clone().sub(camPos).normalize();
    const alt = 90 - Math.acos(Math.max(-1, Math.min(1, dir.dot(up)))) * 180 / Math.PI;
    const flat = dir.clone().addScaledVector(up, -dir.dot(up));
    const az = Math.atan2(flat.dot(eN), flat.dot(nN)) * 180 / Math.PI;
    return { name: obj.name, visible: obj.visible,
      opacity: obj.material?.opacity ?? null,
      ndc: [Number(ndc.x.toFixed(4)), Number(ndc.y.toFixed(4))],
      inFrame: Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && ndc.z > -1 && ndc.z < 1,
      altitudeDeg: Number(alt.toFixed(3)), azimuthDeg: Number(az.toFixed(3)) };
  };
  const fflat = fwd.clone().addScaledVector(up, -fwd.dot(up));
  const out = { st0: null, companions: [], galaxy: [], fov: camera.fov,
    cameraAltDeg: Number((90 - Math.acos(Math.max(-1, Math.min(1, fwd.dot(up)))) * 180 / Math.PI).toFixed(3)),
    cameraAzDeg: Number((Math.atan2(fflat.dot(eN), fflat.dot(nN)) * 180 / Math.PI).toFixed(3)) };
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
  const feed = document.querySelector('aside[aria-label="Current story objective"]');
  const caption = document.querySelector('[data-story-caption]');
  const out = { wallMs: Math.round(performance.now()), beat: w.__storyBeat ?? null,
    objectiveId: hud?.getAttribute('data-objective-id') ?? null,
    markerLabel: hud?.getAttribute('data-objective-marker-label') ?? null,
    health: hud?.getAttribute('data-objective-health') ?? null,
    requiresMarker: hud?.getAttribute('data-objective-requires-marker') ?? null,
    hudText: hud ? hud.innerText.replace(/\s*\n\s*/g, ' | ').trim() : null,
    feedObjectiveId: feed?.getAttribute('data-objective-id') ?? null,
    feedHealth: feed?.getAttribute('data-objective-health') ?? null,
    caption: caption ? caption.innerText.trim() : null };
  try { const f = await imp('spaceFlight');
    if (f) { const s = f.getSpaceFlightSnapshot(); out.flight = { phase: s.phase, controlMode: s.controlMode }; } } catch { /* ignore */ }
  try { const s = await imp('systemFlight');
    if (s) { const v = s.getSystemFlightSnapshot();
      out.system = { activePlanetId: v.activePlanetId, locationMode: v.locationMode,
        targetWorldId: v.target?.worldId ?? null,
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
    if (g) { out.qualityProfile = g.getQualityProfile(); } } catch { /* ignore */ }
  try { const c = await imp('worldClock'); const n = await imp('nightState');
    if (c && n) { out.dayPhase = Number(c.getCurrentDayPhase().toFixed(4));
      out.daylight = Number(n.daylightFromDayPhase(c.getCurrentDayPhase()).toFixed(4));
      out.isNight = n.isDarkDaylight(out.daylight); } } catch { /* ignore */ }
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
const report = { capturedAt: new Date().toISOString(), base: BASE, mode: MODE,
  contractVersion: 'draft-v6' };
const STRIP_FILTER = (process.argv.find(a => a.startsWith('--strip=')) ?? '').split('=')[1] ?? null;
const OUT = path.join(OUT_DIR,
  `ch10-stamp-${MODE}${MODE === 'strips' && STRIP_FILTER ? `-${STRIP_FILTER}` : ''}.json`);
const flush = () => fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');

async function open(url, opts = {}) {
  const page = await browser.newPage({ viewport: opts.viewport ?? { width: 1280, height: 720 },
    isMobile: !!opts.isMobile, hasTouch: !!opts.isMobile,
    reducedMotion: opts.reducedMotion ?? 'no-preference' });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
  if (opts.initScript) await page.addInitScript(opts.initScript);
  await page.goto(`${BASE}/${url}`, { waitUntil: 'load', timeout: 180000 });
  // The transit deep link ignites ~5 s after load, so any generous settle eats
  // the pre-ignite frame: resolve FIRST, then settle, when the caller says so.
  if (opts.resolveBeforeSettle) {
    await page.evaluate(RESOLVE).catch(e => errs.push('resolve ' + String(e).slice(0, 140)));
    await new Promise(r => setTimeout(r, opts.settle ?? 0));
  } else {
    await new Promise(r => setTimeout(r, opts.settle ?? 8000));
    await page.evaluate(RESOLVE).catch(e => errs.push('resolve ' + String(e).slice(0, 140)));
  }
  return { page, errs };
}

// ================================================================== marker
if (MODE === 'marker') {
  // A 250-700 ms poll cannot tell a one-frame publication from a half-second
  // one. A MutationObserver installed BEFORE the HUD mounts sees every
  // attribute write, so the publication instant itself is measured. Both
  // surfaces are watched: the guidance HUD returns null when nothing is
  // published (a deferred rung has no element at all), and the feed aside
  // carries `idle` in exactly that case.
  const OBSERVE = () => {
    window.__voxMut = [];
    window.__voxMutErrors = [];
    const ATTRS = ['data-objective-id', 'data-objective-health',
      'data-objective-requires-marker', 'data-objective-marker-label'];
    const key = a => a.replace('data-objective-', '');
    const push = (rec) => {
      const last = window.__voxMut[window.__voxMut.length - 1];
      const same = last && last.surface === rec.surface
        && ATTRS.every(a => last[key(a)] === rec[key(a)]) && last.beat === rec.beat;
      if (!same) window.__voxMut.push(rec);
    };
    const snap = (el, why, surface) => {
      const rec = { at: Number(performance.now().toFixed(1)), why, surface,
        beat: window.__storyBeat ?? null };
      for (const a of ATTRS) rec[key(a)] = el ? el.getAttribute(a) : null;
      push(rec);
    };
    const seen = new WeakSet();
    const SURFACES = [
      ['hud', '[data-story-guidance-hud]'],
      ['feed', 'aside[aria-label="Current story objective"]']
    ];
    const scan = () => {
      for (const [surface, sel] of SURFACES) {
        const el = document.querySelector(sel);
        if (el && !seen.has(el)) {
          seen.add(el);
          snap(el, 'mounted', surface);
          new MutationObserver(() => snap(el, 'attr', surface))
            .observe(el, { attributes: true, attributeFilter: ATTRS });
        } else if (el) snap(el, 'poll', surface);
        else push({ at: Number(performance.now().toFixed(1)), why: 'absent', surface,
          beat: window.__storyBeat ?? null, id: null, health: null,
          'requires-marker': null, 'marker-label': null });
      }
    };
    const start = () => {
      try {
        new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
      } catch (e) { window.__voxMutErrors.push('observer ' + String(e).slice(0, 120)); }
      scan();
    };
    if (document.documentElement) start();
    else document.addEventListener('DOMContentLoaded', start);
    // Per-frame backstop: an observer that failed to attach must not be able to
    // masquerade as "no violations observed".
    const tick = () => { try { scan(); } catch (e) { window.__voxMutErrors.push(String(e).slice(0, 120)); }
      requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    return true;
  };
  const PATHS = [
    { id: 'deep-link-ch10-cold', url: '?story=ch10-cold&movie=1&profile=LOW', cap: 150,
      until: s => s.beat === 'ch10-ask' },
    { id: 'deep-link-ch10-ask', url: '?story=ch10-ask&movie=1&profile=LOW', cap: 200,
      until: s => s.beat === 'ch10-transit' },
    { id: 'deep-link-ch10-transit', url: '?story=ch10-transit&movie=1&profile=LOW', cap: 200,
      until: s => (s.av?.history ?? []).includes('anc.ch10.threshold-handback') },
    { id: 'flow-ch10-cold-through-transit', url: '?story=ch10-cold&movie=1&profile=LOW', cap: 420,
      until: s => (s.av?.history ?? []).includes('anc.ch10.threshold-handback') }
  ];
  report.paths = {};
  for (const p of PATHS) {
    const { page, errs } = await open(p.url, { settle: 6000, initScript: OBSERVE });
    const t0 = Date.now();
    let reached = false;
    const beatsSeen = new Set();
    while ((Date.now() - t0) / 1000 < p.cap) {
      const s = await page.evaluate(READ).catch(() => null);
      if (s) { if (s.beat) beatsSeen.add(s.beat); if (p.until(s)) { reached = true; break; } }
      await new Promise(r => setTimeout(r, 500));
    }
    await new Promise(r => setTimeout(r, 2000));
    const mut = await page.evaluate(() => window.__voxMut ?? []);
    const mutErrors = await page.evaluate(() => window.__voxMutErrors ?? ['no trap installed']).catch(() => ['unreadable']);
    // Dwell is measured per surface: consecutive records interleave surfaces.
    const bySurface = {};
    for (const m of mut) (bySurface[m.surface] ??= []).push(m);
    const events = [];
    for (const [surface, list] of Object.entries(bySurface)) {
      list.forEach((m, i) => events.push({ ...m,
        dwellMs: i + 1 < list.length ? Number((list[i + 1].at - m.at).toFixed(1)) : null }));
    }
    events.sort((a, b) => a.at - b.at);
    const violations = events.filter(e => e.id && e['requires-marker'] === 'true'
      && e.health === 'missing-marker');
    const deferredIdle = events.filter(e => e.surface === 'feed' && e.health === 'idle'
      && (e.beat ?? '').startsWith('ch10'));
    report.paths[p.id] = { url: p.url, reachedTerminal: reached, beatsSeen: [...beatsSeen],
      pageErrors: errs, observerErrors: mutErrors, eventCount: events.length,
      mandatoryRungs: [...new Set(events.filter(e => e['requires-marker'] === 'true' && e.id).map(e => e.id))],
      healthStatesObserved: [...new Set(events.filter(e => e.health).map(e => e.health))],
      missingMarkerViolations: violations, violationCount: violations.length,
      worstViolationDwellMs: violations.length ? Math.max(...violations.map(v => v.dwellMs ?? 0)) : 0,
      deferredIdleInstants: deferredIdle.length,
      deferredIdleTotalMs: Number(deferredIdle.reduce((a, e) => a + (e.dwellMs ?? 0), 0).toFixed(1)),
      events };
    flush();
    console.log(`[${p.id}] events=${events.length} violations=${violations.length}`
      + ` worstDwell=${report.paths[p.id].worstViolationDwellMs}ms`
      + ` idleInstants=${deferredIdle.length} reached=${reached} errs=${errs.length}`);
    await page.close();
  }
  report.summary = {
    totalViolations: Object.values(report.paths).reduce((a, p) => a + p.violationCount, 0),
    pathsClean: Object.values(report.paths).filter(p => p.violationCount === 0).length,
    pathCount: Object.keys(report.paths).length
  };
  flush();
}

// ================================================================== strips
if (MODE === 'strips') {
  // Event-triggered, with a rolling "previous" frame so every -before is the
  // last frame that existed BEFORE the predicate flipped rather than a guessed
  // lead time. Every frame records the flight facts, so a grounded frame can
  // never again be filed under an airborne label.
  const STRIPS = [
    { id: 'strip-transit-a', reducedMotion: 'no-preference', settle: 0, resolveBeforeSettle: true,
      triggers: [
        { key: 'transit-ignite', pred: s => (s.av?.history ?? []).includes('anc.ch10.transit-ignite'),
          before: true, after: 2500 },
        { key: 'T2-hold-marker', pred: s => s.objectiveId === 'station:transit:hold',
          before: false, after: null },
        { key: 'seam', pred: s => (s.av?.history ?? []).includes('anc.ch10.seam-of-light'),
          before: true, after: 3000 },
        { key: 'galaxy-absence-check', pred: s => s.milestones?.seamPassed === true,
          before: false, after: 4000, onlyAfter: true }
      ] },
    { id: 'strip-transit-b', reducedMotion: 'no-preference',
      triggers: [
        { key: 'station-resolved', pred: s => (s.av?.history ?? []).includes('anc.ch10.station-resolved'),
          before: true, after: null },
        { key: 'hold-mid', pred: s => true, delay: 1200 },
        { key: 'hold-release', pred: s => true, delay: 1400 },
        { key: 'K11-painted', pred: s => (s.caption ?? '').includes('both fires behind you') },
        { key: 'work-order-cleared', pred: s => !s.objectiveId },
        { key: 'threshold-handback', pred: s => (s.av?.history ?? []).includes('anc.ch10.threshold-handback'),
          before: false, after: 4000 }
      ] },
    { id: 'strip-rm-transit', reducedMotion: 'reduce',
      triggers: [
        { key: 'seam', pred: s => (s.av?.history ?? []).includes('anc.ch10.seam-of-light'),
          before: true, after: 3000 },
        { key: 'station-resolved', pred: s => (s.av?.history ?? []).includes('anc.ch10.station-resolved'),
          before: false, after: null },
        { key: 'hold-mid', pred: s => true, delay: 1200 },
        { key: 'hold-release', pred: s => true, delay: 1400 },
        { key: 'threshold-handback', pred: s => (s.av?.history ?? []).includes('anc.ch10.threshold-handback'),
          before: false, after: 4000 }
      ] }
  ];
  const ONLY = (process.argv.find(a => a.startsWith('--strip=')) ?? '').split('=')[1] ?? null;
  report.strips = [];
  for (const spec of STRIPS.filter(s => !ONLY || s.id === ONLY)) {
    const dir = path.join(CAP_DIR, spec.id);
    fs.mkdirSync(dir, { recursive: true });
    for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
    const { page, errs } = await open('?story=ch10-transit&movie=1&profile=LOW',
      { settle: spec.settle ?? 6000, resolveBeforeSettle: !!spec.resolveBeforeSettle,
        reducedMotion: spec.reducedMotion });
    const frames = [];
    let idx = 0;
    const rec = { id: spec.id, url: '?story=ch10-transit&movie=1&profile=LOW', tier: 'LOW',
      viewport: '1280x720', reducedMotion: spec.reducedMotion === 'reduce',
      pageErrors: errs, frames };
    report.strips.push(rec);
    const note = (file, label, s) => {
      frames.push({ file: `evidence/capture/${spec.id}/${file}`, label, t: s.t ?? null,
        beat: s.beat, objectiveId: s.objectiveId, markerLabel: s.markerLabel,
        health: s.health, hudText: s.hudText, caption: s.caption,
        controlMode: s.flight?.controlMode ?? null, phase: s.flight?.phase ?? null,
        speed: s.system?.speed ?? null,
        stationDistance: s.contacts?.stations?.[0]?.distance ?? null,
        anchorId: s.av?.anchorId ?? null, fov: s.av?.fov ?? null,
        qualityProfile: s.qualityProfile ?? null });
      flush();
      console.log(`  [${spec.id}/${file}] dist=${frames[frames.length - 1].stationDistance}`
        + ` phase=${frames[frames.length - 1].phase}`);
    };
    const shoot = async (label, s) => {
      const file = `${String(idx).padStart(2, '0')}_${label}_${s.beat ?? 'unknown'}.png`;
      idx++;
      await page.screenshot({ path: path.join(dir, file) });
      note(file, label, s);
    };
    const t0 = Date.now();
    let ti = 0, prevShot = null, prevState = null;
    while (ti < spec.triggers.length && (Date.now() - t0) / 1000 < 300) {
      const trig = spec.triggers[ti];
      if (trig.delay) {
        await new Promise(r => setTimeout(r, trig.delay));
        const s = await page.evaluate(READ);
        s.t = Number(((Date.now() - t0) / 1000).toFixed(2));
        await shoot(trig.key, s);
        ti++; prevShot = null; prevState = null;
        continue;
      }
      const s = await page.evaluate(READ).catch(() => null);
      if (!s) { await new Promise(r => setTimeout(r, 150)); continue; }
      s.t = Number(((Date.now() - t0) / 1000).toFixed(2));
      if (trig.pred(s)) {
        if (trig.before && prevShot) {
          const file = `${String(idx).padStart(2, '0')}_${trig.key}-before_${prevState.beat ?? 'unknown'}.png`;
          idx++;
          fs.writeFileSync(path.join(dir, file), prevShot);
          note(file, `${trig.key}-before`, prevState);
        }
        if (!trig.onlyAfter) await shoot(trig.before ? `${trig.key}-at` : trig.key, s);
        if (trig.after) {
          await new Promise(r => setTimeout(r, trig.after));
          const s2 = await page.evaluate(READ);
          s2.t = Number(((Date.now() - t0) / 1000).toFixed(2));
          await shoot(trig.onlyAfter ? trig.key : `${trig.key}-after`, s2);
        }
        ti++; prevShot = null; prevState = null;
        continue;
      }
      prevShot = await page.screenshot();
      prevState = s;
      await new Promise(r => setTimeout(r, 200));
    }
    rec.frameCount = frames.length;
    rec.completedTriggers = ti;
    rec.allTriggersHit = ti === spec.triggers.length;
    flush();
    console.log(`[${spec.id}] frames=${frames.length} triggers=${ti}/${spec.triggers.length} errs=${errs.length}`);
    await page.close();
  }
}

// ================================================================= cutline
if (MODE === 'cutline') {
  // draft-v6: the shutter is the FIRST FRAME AFTER threshold-handback with K11
  // painted and the work order cleared, range 1,000-1,300. At HIGH one poll
  // round-trip through page.evaluate is several hundred units of closure, so the
  // trigger is armed IN PAGE on rAF and the screenshot is the very next thing
  // that happens — no READ, no LIVE, no settle before the shutter.
  const { page, errs } = await open('?story=ch10-transit&movie=1&profile=LOW', { settle: 7000 });
  report.pageErrors = errs;
  report.method = 'flown at LOW; HIGH raised at anc.ch10.seam-of-light so the pipeline is warm; '
    + 'shutter armed in-page on rAF at the first frame after threshold-handback with K11 painted '
    + 'and the work order cleared; screenshot taken before any other evaluate';
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
  if (!seam) { flush(); await page.close(); await browser.close(); process.exit(1); }
  const raisedAt = Date.now();
  await page.evaluate(SET_PROFILE, 'HIGH');
  report.raisedToHighAtStationDistance = seam.contacts?.stations?.[0]?.distance ?? null;

  // Arm in page. The watcher records one row per frame so the distance AT the
  // shutter is a measurement, not a reconstruction.
  const ARM = async () => {
    const spec = window.__voxSpec ?? {};
    const av = await import(/* @vite-ignore */ spec.signedAv);
    window.__voxCut = { armed: false, armedAt: null, log: [] };
    const tick = () => {
      try {
        const snap = av.getSignedSceneAvDebugSnapshot();
        const history = snap.activationHistoryAnchorIds ?? [];
        const caption = document.querySelector('[data-story-caption]');
        const hud = document.querySelector('[data-story-guidance-hud]');
        const contacts = window.__spaceStationContacts ? window.__spaceStationContacts() : null;
        const row = { at: Number(performance.now().toFixed(1)),
          handback: history.includes('anc.ch10.threshold-handback'),
          k11: (caption?.innerText ?? '').includes('both fires behind you'),
          cleared: !hud,
          distance: contacts?.stations?.[0]?.distance ?? null,
          fov: snap.shot?.lens?.appliedFovDeg ?? null,
          authority: snap.shot?.cameraAuthority ?? null };
        window.__voxCut.log.push(row);
        if (window.__voxCut.log.length > 400) window.__voxCut.log.shift();
        if (!window.__voxCut.armed && row.handback && row.k11 && row.cleared) {
          window.__voxCut.armed = true;
          window.__voxCut.armedAt = row;
        }
      } catch (e) { window.__voxCut.error = String(e).slice(0, 140); }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return true;
  };
  await page.evaluate(ARM);
  await page.waitForFunction(() => window.__voxCut?.armed === true,
    null, { polling: 'raf', timeout: 300000 });
  await page.screenshot({ path: path.join(CAP_DIR, 'still-station-resolved.png') });
  const shutterWall = await page.evaluate(() => performance.now());
  const cut = await page.evaluate(() => window.__voxCut);
  const at = await page.evaluate(READ);
  const live = await page.evaluate(LIVE).catch(e => ({ liveError: String(e).slice(0, 140) }));
  // The frame the shutter actually caught: the last watcher row at or before the
  // screenshot's own timestamp.
  const rows = (cut.log ?? []).filter(r => r.at <= shutterWall);
  const shutterRow = rows.length ? rows[rows.length - 1] : null;
  report.still = { id: 'still-station-resolved', file: 'evidence/capture/still-station-resolved.png',
    tier: at.qualityProfile, criterion: 'draft-v6 cut line',
    secondsHighWarmBeforeShutter: Number(((Date.now() - raisedAt) / 1000).toFixed(1)),
    armedAt: cut.armedAt, shutterRow, watcherError: cut.error ?? null,
    framesBetweenArmAndShutter: cut.armedAt && shutterRow
      ? (cut.log ?? []).filter(r => r.at > cut.armedAt.at && r.at <= shutterWall).length : null,
    rangeSpec: [1000, 1300], rangeAtShutter: shutterRow?.distance ?? null,
    rangeInSpec: shutterRow?.distance != null
      && shutterRow.distance >= 1000 && shutterRow.distance <= 1300,
    fovSpec: 70, fovAtShutter: shutterRow?.fov ?? null, cameraFov: live.fov ?? null,
    standoffTriggerConstant: 1500,
    k11Painted: shutterRow?.k11 ?? null, workOrderCleared: shutterRow?.cleared ?? null,
    handbackReached: shutterRow?.handback ?? null,
    caption: at.caption, hudText: at.hudText, objectiveId: at.objectiveId,
    authority: at.av?.authority ?? null, postFx: at.av?.postFx ?? null,
    galaxyInFrame: (live.galaxy ?? []).some(g => g.visible && g.inFrame),
    galaxyObjects: live.galaxy ?? null,
    planetsInFrame: (live.companions ?? []).filter(c => c.visible && c.inFrame),
    companionCount: (live.companions ?? []).length,
    st0InFrame: live.st0 ? (live.st0.visible && live.st0.inFrame) : false,
    state: at };
  flush();
  console.log(`[cutline] profile=${at.qualityProfile} range=${report.still.rangeAtShutter}`
    + ` inSpec=${report.still.rangeInSpec} fov=${report.still.fovAtShutter}`
    + ` k11=${report.still.k11Painted} cleared=${report.still.workOrderCleared}`
    + ` planets=${report.still.planetsInFrame.length} galaxy=${report.still.galaxyInFrame}`);
  await page.close();
}

// ===================================================================== st0
if (MODE === 'st0') {
  // The previous staging aimed open-loop, then let a HIGH warm and a peak chase
  // run on top of it: the planet turns under the camera, so the yaw walked out
  // to 4.6 deg by the shutter. Here the aim is a CLOSED LOOP running in page on
  // rAF, through the shipped look handler, and it is still running at the
  // instant the shutter fires. +-2 deg is judged at that instant.
  const TRACE_SECONDS = Number(process.env.VOX_ST0_TRACE ?? 420);
  const { page, errs } = await open('?story=ch10-cold&profile=LOW', { settle: 12000 });
  report.pageErrors = errs;
  const HOLD_NIGHT = async () => {
    const c = await import(/* @vite-ignore */ (window.__voxSpec ?? {}).worldClock);
    const n = await import(/* @vite-ignore */ (window.__voxSpec ?? {}).nightState);
    const TARGET = 0.62;
    c.setDayPhaseOffset(c.getDayPhaseOffset() + (TARGET - c.getCurrentDayPhase()));
    return { phase: c.getCurrentDayPhase(), offset: c.getDayPhaseOffset(),
      daylight: n.daylightFromDayPhase(c.getCurrentDayPhase()) };
  };
  report.dayPhaseHeld = await page.evaluate(HOLD_NIGHT).catch(e => String(e).slice(0, 120));
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

  // --- phase telemetry trace (visibility-independent) ------------------------
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
        moonAlt: (live.companions ?? []).map(c => c.altitudeDeg) });
    }
    await new Promise(r => setTimeout(r, 500));
  }
  report.traceSamples = samples.length;
  report.trace = samples;
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
  console.log(`[st0] samples=${samples.length} peaks=${peaks.length}`
    + ` intervals=${report.peakIntervalsSeconds} peakAlt=${peakAlt} bearingAz=${report.bearingAzimuthDeg}`);
  if (!peaks.length) { flush(); await page.close(); await browser.close(); process.exit(1); }

  // --- in-page closed-loop yaw/pitch lock -----------------------------------
  const INSTALL_LOCK = async ({ az, alt }) => {
    const m = await import(/* @vite-ignore */ (window.__voxSpec ?? {}).mobileInput);
    window.__voxLock = { az, alt, on: true, err: null, last: null, steps: 0,
      // Signed gain, MEASURED from the achieved rotation. Storing |gain| and
      // hard-coding the sign is what made an earlier staging oscillate between
      // +150 and -100 degrees.
      gainAz: -0.002 * (180 / Math.PI), gainAlt: -0.002 * (180 / Math.PI) };
    let prev = null;
    let nextStepAt = 0;
    const tick = () => {
      const L = window.__voxLock;
      if (!L?.on) { requestAnimationFrame(tick); return; }
      // THROTTLED. A per-frame proportional step diverges: the true look gain is
      // ~3x the nominal 0.002 rad/unit, so a 0.45 per-frame factor puts the loop
      // gain above 1 and the camera oscillates (measured: dAz swinging 103 deg
      // to 72 deg over 4,690 steps). One damped step per 100 ms lets the camera
      // settle between corrections, which is the spacing that converged before.
      const now = performance.now();
      if (now < nextStepAt) { requestAnimationFrame(tick); return; }
      nextStepAt = now + 100;
      try {
        const aim = window.__voxAim();
        if (aim) {
          if (prev) {
            let gotAz = aim.az - prev.az;
            while (gotAz > 180) gotAz -= 360;
            while (gotAz < -180) gotAz += 360;
            const gotAlt = aim.alt - prev.alt;
            if (Math.abs(prev.mx) > 3 && Math.abs(gotAz) > 0.02) {
              const g = gotAz / prev.mx;
              if (Math.abs(g) > 1e-4 && Math.abs(g) < 1) L.gainAz = 0.6 * L.gainAz + 0.4 * g;
            }
            if (Math.abs(prev.my) > 3 && Math.abs(gotAlt) > 0.02) {
              const g = gotAlt / prev.my;
              if (Math.abs(g) > 1e-4 && Math.abs(g) < 1) L.gainAlt = 0.6 * L.gainAlt + 0.4 * g;
            }
          }
          let dAz = L.az - aim.az;
          while (dAz > 180) dAz -= 360;
          while (dAz < -180) dAz += 360;
          const dAlt = L.alt - aim.alt;
          L.last = { az: aim.az, alt: aim.alt, dAz: Number(dAz.toFixed(3)),
            dAlt: Number(dAlt.toFixed(3)), fov: aim.fov,
            at: Number(performance.now().toFixed(1)) };
          L.converged = Math.abs(dAz) <= 1 && Math.abs(dAlt) <= 1;
          if (Math.abs(dAz) > 0.15 || Math.abs(dAlt) > 0.15) {
            const mx = Math.max(-400, Math.min(400, (dAz * 0.35) / L.gainAz));
            const my = Math.max(-400, Math.min(400, (dAlt * 0.35) / L.gainAlt));
            m.dispatchLook(mx, my);
            prev = { az: aim.az, alt: aim.alt, mx, my };
            L.steps++;
          } else prev = null;
        }
      } catch (e) { L.err = String(e).slice(0, 140); }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return true;
  };
  const RETARGET = ({ az, alt }) => { if (window.__voxLock) { window.__voxLock.az = az; window.__voxLock.alt = alt; } return window.__voxLock?.last ?? null; };

  const wantPitch = Number((peakAlt - 15).toFixed(3));
  await page.evaluate(INSTALL_LOCK, { az: report.bearingAzimuthDeg, alt: wantPitch });
  report.staging = { wantYawDeg: report.bearingAzimuthDeg, wantPitchDeg: wantPitch,
    lock: 'in-page rAF closed loop through the shipped mouse-look handler, still running at the shutter' };
  // Let the lock converge at LOW, then choose the minimal moon-exclusion offset.
  const settleLock = async (cap = 60) => {
    const t = Date.now();
    while ((Date.now() - t) / 1000 < cap) {
      const ok = await page.evaluate(() => window.__voxLock?.converged === true).catch(() => false);
      if (ok) return true;
      await new Promise(r => setTimeout(r, 500));
    }
    return false;
  };
  report.lockConvergedBeforeOffset = await settleLock(60);
  let live = await page.evaluate(LIVE);
  const moonInFrame = l => (l.companions ?? []).some(c => c.visible && c.inFrame);
  report.moonInFrameBeforeOffset = moonInFrame(live);
  let yawOffset = 0;
  for (const off of [0, -5, 5, -10, 10]) {
    yawOffset = off;
    await page.evaluate(RETARGET, { az: report.bearingAzimuthDeg + off, alt: wantPitch });
    if (off !== 0) await settleLock(30);
    else await new Promise(r => setTimeout(r, 500));
    live = await page.evaluate(LIVE);
    if (!moonInFrame(live)) break;
  }
  report.lockConvergedAfterOffset = await settleLock(30);
  report.yawOffsetAppliedDeg = yawOffset;
  report.moonInFrameAfterOffset = moonInFrame(live);
  report.lockTargetAzDeg = report.bearingAzimuthDeg + yawOffset;

  // --- warm HIGH with the lock still running, shoot at the next maximum ------
  await page.evaluate(HOLD_NIGHT).catch(() => {});
  await page.evaluate(SET_PROFILE, 'HIGH');
  const raisedAt = Date.now();
  const period = report.peakIntervalsSeconds.length
    ? report.peakIntervalsSeconds.reduce((a, b) => a + b, 0) / report.peakIntervalsSeconds.length : 90;
  let best = -999, shot = false;
  const chaseStart = Date.now();
  let heldChase = Date.now();
  while ((Date.now() - chaseStart) / 1000 < period * 1.8) {
    if (Date.now() - heldChase > 4000) { await page.evaluate(HOLD_NIGHT).catch(() => {}); heldChase = Date.now(); }
    const l = await page.evaluate(LIVE).catch(() => null);
    if (l && l.st0 && l.st0.visible) {
      if (l.st0.altitudeDeg > best) best = l.st0.altitudeDeg;
      else if (best > 0 && l.st0.altitudeDeg < best - 0.2 && (Date.now() - raisedAt) / 1000 > 12) {
        shot = true; break;
      }
    }
    await new Promise(r => setTimeout(r, 700));
  }
  report.bestAltitudeDuringChase = best;
  await page.evaluate(HOLD_NIGHT).catch(() => {});
  // The lock is deliberately NOT switched off: +-2 deg is judged at the shutter.
  const lockAtShutter = await page.evaluate(() => window.__voxLock?.last ?? null);
  await page.screenshot({ path: path.join(CAP_DIR, 'still-st0-sighting.png') });
  const at = await page.evaluate(READ);
  live = await page.evaluate(LIVE);
  const lockState = await page.evaluate(() => ({ steps: window.__voxLock?.steps ?? null,
    err: window.__voxLock?.err ?? null, target: { az: window.__voxLock?.az, alt: window.__voxLock?.alt },
    last: window.__voxLock?.last ?? null }));
  const yawErr = (() => { let d = live.cameraAzDeg - report.lockTargetAzDeg;
    while (d > 180) d -= 360; while (d < -180) d += 360; return Number(d.toFixed(3)); })();
  report.still = { id: 'still-st0-sighting', file: 'evidence/capture/still-st0-sighting.png',
    tier: at.qualityProfile, shutterOnMaximum: shot,
    secondsHighWarmBeforeShutter: Number(((Date.now() - raisedAt) / 1000).toFixed(1)),
    peakAltitudeTracked: best, altitudeAtShutter: live.st0?.altitudeDeg ?? null,
    azimuthAtShutter: live.st0?.azimuthDeg ?? null,
    cameraAzDeg: live.cameraAzDeg, cameraAltDeg: live.cameraAltDeg,
    cameraFov: live.fov, avFov: at.av?.fov ?? null,
    bearingAzimuthDeg: report.bearingAzimuthDeg,
    yawOffsetAppliedDeg: yawOffset, lockTargetAzDeg: report.lockTargetAzDeg,
    yawErrorVsLockTargetDeg: yawErr, yawErrorWithinTwoDeg: Math.abs(yawErr) <= 2,
    yawErrorVsBearingDeg: Number((yawErr + yawOffset).toFixed(3)),
    pitchTargetDeg: wantPitch,
    pitchErrorDeg: Number((live.cameraAltDeg - wantPitch).toFixed(3)),
    lockAtShutter, lockState,
    st0Ndc: live.st0?.ndc ?? null, st0NdcYUpperThirdTarget: 0.3333,
    st0NdcYErrorFrameHeightPct: live.st0?.ndc
      ? Number((Math.abs(live.st0.ndc[1] - 0.3333) / 2 * 100).toFixed(2)) : null,
    st0Visible: live.st0?.visible ?? false, st0Opacity: live.st0?.opacity ?? null,
    st0InFrame: live.st0?.inFrame ?? false,
    moonInFrame: (live.companions ?? []).filter(c => c.visible && c.inFrame),
    isNight: at.isNight, dayPhase: at.dayPhase, daylight: at.daylight,
    beat: at.beat, objectiveId: at.objectiveId, state: at };
  flush();
  console.log(`[st0-still] profile=${at.qualityProfile} alt=${report.still.altitudeAtShutter}`
    + ` ndc=${JSON.stringify(report.still.st0Ndc)} yawErr=${yawErr}`
    + ` within2=${report.still.yawErrorWithinTwoDeg} moon=${report.still.moonInFrame.length}`
    + ` night=${at.isNight}`);
  await page.close();
}

await browser.close();
flush();
console.log('wrote', OUT);
