// One ch10-transit session that produces the three now-reachable deliverables:
//   1. still-seam-of-light  HIGH, at anc.ch10.seam-of-light + 0, airborne
//   2. still-station-resolved HIGH, at the cut line (K11 painted, order cleared)
//   3. the corridor-interior [F] proof: nose inside CORRIDOR_RANGE 1,400 and
//      show the fence holds and the instruments stay silent
// Flown at LOW; the quality profile is raised through the shipped
// setQualityProfile store only for the two stills. Modules resolved through the
// app's own specifiers.
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
const HIGH_SETTLE = Number(process.env.VOX_HIGH_SETTLE ?? 30000);
fs.mkdirSync(CAP_DIR, { recursive: true });
const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter(d => /^chromium-\d+$/.test(d)).sort().pop();

const RESOLVE = async () => {
  const hosts = ['/src/App.tsx', '/src/story/StoryDirectorDriver.tsx',
    '/src/story/emergentStoryDirector.ts', '/src/components/ShipController.tsx',
    '/src/components/SystemCompanionBodies.tsx'];
  const want = { signedAv: /signedSceneAvRuntime\.ts/, spaceFlight: /state\/spaceFlight\.ts/,
    systemFlight: /state\/systemFlight\.ts/, storyState: /story\/storyState\.ts/,
    progression: /progressionSystem\.ts/, graphics: /config\/graphicsSettings\.ts/,
    devFlag: /spaceStationDevFlag\.ts/, approach: /spaceStationApproach\.ts/ };
  const found = {};
  for (const h of hosts) {
    let src; try { src = await (await fetch(h)).text(); } catch { continue; }
    for (const [k, re] of Object.entries(want)) {
      if (found[k]) continue;
      for (const m of src.matchAll(/from\s*["']([^"']+)["']/g)) if (re.test(m[1])) { found[k] = m[1]; break; }
    }
  }
  // three.js, for the live scene (galaxy check in the aperture)
  const cs = await (await fetch('/src/components/SystemCompanionBodies.tsx')).text();
  found.three = cs.match(/from\s*["']([^"']*deps\/three\.js[^"']*)["']/)[1];
  window.__voxSpec = found;
  const THREE = await import(/* @vite-ignore */ found.three);
  window.__THREE = THREE;
  window.__voxLive = {};
  const base = THREE.Object3D.prototype.updateMatrixWorld;
  THREE.Scene.prototype.updateMatrixWorld = function (f) { window.__voxLive.scene = this; return base.call(this, f); };
  THREE.PerspectiveCamera.prototype.updateMatrixWorld = function (f) { window.__voxLive.camera = this; return base.call(this, f); };
  return found;
};

const READ = async () => {
  const w = window; const spec = w.__voxSpec ?? {};
  const imp = async (k) => (spec[k] ? import(/* @vite-ignore */ spec[k]) : null);
  const hud = document.querySelector('[data-story-guidance-hud]');
  const caption = document.querySelector('[data-story-caption]');
  const out = { beat: w.__storyBeat ?? null,
    objectiveId: hud?.getAttribute('data-objective-id') ?? null,
    hudText: hud ? hud.innerText.replace(/\s*\n\s*/g, ' | ').trim() : null,
    caption: caption ? caption.innerText.trim() : null };
  try { const av = await imp('signedAv');
    if (av) { const s = av.getSignedSceneAvDebugSnapshot();
      out.av = { anchorId: s.anchorId, history: s.activationHistoryAnchorIds ?? [],
        authority: s.shot?.cameraAuthority ?? null, fov: s.shot?.lens?.appliedFovDeg ?? null,
        agency: s.shot?.agency ?? null, postFx: s.postFx?.activeEffectIds ?? [] }; }
  } catch { /* ignore */ }
  try { const f = await imp('spaceFlight');
    if (f) { const s = f.getSpaceFlightSnapshot(); out.flight = { phase: s.phase, controlMode: s.controlMode }; }
  } catch { /* ignore */ }
  try { const s = await imp('systemFlight');
    if (s) { const v = s.getSystemFlightSnapshot();
      out.system = { activePlanetId: v.activePlanetId, locationMode: v.locationMode,
        targetWorldId: v.target?.worldId ?? null,
        speed: Math.round(Math.hypot(...(v.pose?.velocity ?? [0, 0, 0])) * 100) / 100 }; }
  } catch { /* ignore */ }
  try { const st = await imp('storyState'); const pr = await imp('progression');
    if (st && pr) out.milestones = {
      seamPassed: pr.hasMilestone(st.STORY_MILESTONES.ch10SeamPassed),
      stationResolved: pr.hasMilestone(st.STORY_MILESTONES.ch10StationResolved) };
  } catch { /* ignore */ }
  try { const g = await imp('graphics');
    if (g) { out.qualityProfile = g.getQualityProfile();
      const q = g.getGraphicsQuality(); out.postProcess = q.postProcess; }
  } catch { /* ignore */ }
  out.contacts = w.__spaceStationContacts ? w.__spaceStationContacts() : null;
  try {
    const live = w.__voxLive;
    if (live?.scene) {
      const galaxy = [];
      live.scene.traverse(o => { if (/galaxy/i.test(o.name)) galaxy.push({ name: o.name, visible: o.visible }); });
      out.galaxyObjects = galaxy.slice(0, 8);
      out.galaxyVisible = galaxy.some(g => g.visible);
      out.cameraFov = live.camera?.fov ?? null;
    }
  } catch { /* ignore */ }
  const bodyText = document.body.innerText || '';
  out.advisoryCopy = { holdForApproach: /HOLD FOR APPROACH/i.test(bodyText),
    onTheCorridor: /ON THE CORRIDOR/i.test(bodyText), cleared: /CLEARED TO/i.test(bodyText),
    berth: /BERTH/i.test(bodyText), localLock: bodyText.includes('LOCAL LOCK'),
    flightCorridor: bodyText.includes('FLIGHT CORRIDOR') };
  return out;
};

const SET_PROFILE = async (p) => {
  const spec = window.__voxSpec ?? {};
  const g = await import(/* @vite-ignore */ spec.graphics);
  g.setQualityProfile(p, { persist: false });
  return g.getQualityProfile();
};

const browser = await chromium.launch({
  executablePath: path.join(pwDir, chromeDir, 'chrome-linux/chrome'),
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720']
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e).slice(0, 180)));
const report = { capturedAt: new Date().toISOString(), base: BASE,
  url: `${BASE}/?story=ch10-transit&movie=1&profile=LOW`,
  method: 'flown at LOW; profile raised to HIGH through the shipped setQualityProfile store for the two stills only',
  stills: [], corridor: null, pageErrors };
const OUT = path.join(OUT_DIR, 'ch10-transit-captures.json');
const flush = () => fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');

await page.goto(report.url, { waitUntil: 'load', timeout: 120000 });
await new Promise(r => setTimeout(r, 8000));
await page.evaluate(RESOLVE);

const waitFor = async (pred, cap) => {
  const t0 = Date.now();
  while ((Date.now() - t0) / 1000 < cap) {
    const s = await page.evaluate(READ).catch(() => null);
    if (s && pred(s)) return s;
    await new Promise(r => setTimeout(r, 300));
  }
  return null;
};

// ---- still one: the seam of light, at anchor + 0 --------------------------
const seam = await waitFor(s => (s.av?.history ?? []).includes('anc.ch10.seam-of-light'), 300);
if (seam) {
  await page.evaluate(SET_PROFILE, 'HIGH');
  await new Promise(r => setTimeout(r, HIGH_SETTLE));
  const at = await page.evaluate(READ);
  await page.screenshot({ path: path.join(CAP_DIR, 'still-seam-of-light.png') });
  report.stills.push({ id: 'still-seam-of-light', file: 'evidence/capture/still-seam-of-light.png',
    tier: 'HIGH', atAnchor: 'anc.ch10.seam-of-light', state: at,
    galaxyInAperture: at.galaxyVisible ?? null });
  flush();
  console.log(`[still-seam] profile=${at.qualityProfile} post=${at.postProcess} phase=${at.flight?.phase}`
    + ` fov=${at.av?.fov} galaxy=${at.galaxyVisible}`);
  await page.evaluate(SET_PROFILE, 'LOW');
  await new Promise(r => setTimeout(r, 1500));
}

// ---- still two: the cut line (K11 painted, work order cleared) ------------
const resolved = await waitFor(s => (s.av?.history ?? []).includes('anc.ch10.station-resolved'), 420);
let cleared = null;
if (resolved) {
  cleared = await waitFor(s => !s.objectiveId, 60);
  await page.evaluate(SET_PROFILE, 'HIGH');
  await new Promise(r => setTimeout(r, HIGH_SETTLE));
  const at = await page.evaluate(READ);
  await page.screenshot({ path: path.join(CAP_DIR, 'still-station-resolved.png') });
  report.stills.push({ id: 'still-station-resolved', file: 'evidence/capture/still-station-resolved.png',
    tier: 'HIGH', atAnchor: 'anc.ch10.station-resolved', workOrderCleared: !!cleared,
    captionAtCapture: at.caption, stationDistance: at.contacts?.stations?.[0]?.distance ?? null,
    state: at, galaxyInFrame: at.galaxyVisible ?? null });
  flush();
  console.log(`[still-resolved] profile=${at.qualityProfile} hud=${JSON.stringify(at.hudText)}`
    + ` distance=${at.contacts?.stations?.[0]?.distance} caption=${JSON.stringify((at.caption ?? '').slice(0, 40))}`);
  await page.evaluate(SET_PROFILE, 'LOW');
  await new Promise(r => setTimeout(r, 1500));
}

// ---- corridor-interior [F] -------------------------------------------------
const handback = await waitFor(s => (s.av?.history ?? []).includes('anc.ch10.threshold-handback'), 120);
if (handback) {
  const samples = [];
  await page.keyboard.down('KeyW');
  const t1 = Date.now();
  let inside = false;
  while ((Date.now() - t1) / 1000 < 420) {
    const s = await page.evaluate(READ).catch(() => null);
    const st = s?.contacts?.stations?.[0] ?? null;
    samples.push({ t: Math.round((Date.now() - t1) / 1000), distance: st?.distance ?? null,
      canDock: st?.canDock ?? null, phase: st?.phase ?? null, speed: s?.system?.speed ?? null });
    if (st && st.distance <= 1150) { inside = true; break; }
    await new Promise(r => setTimeout(r, 1200));
  }
  await page.keyboard.up('KeyW');
  await new Promise(r => setTimeout(r, 9000)); // let the speed gate settle
  const before = await page.evaluate(READ);
  const urlBefore = page.url();
  await page.keyboard.press('KeyF');
  await new Promise(r => setTimeout(r, 2500));
  await page.keyboard.press('KeyF');
  await new Promise(r => setTimeout(r, 4000));
  const after = await page.evaluate(READ);
  const fence = await page.evaluate(async () => {
    const spec = window.__voxSpec ?? {};
    const dev = await import(/* @vite-ignore */ spec.devFlag);
    const app = await import(/* @vite-ignore */ spec.approach);
    const sys = await import(/* @vite-ignore */ spec.systemFlight);
    return { dockingAuthorized: dev.spaceStationDockingAuthorized(),
      targetingAuthorized: dev.spaceStationTargetingAuthorized(),
      storyContext: dev.isStorySpaceStationContext(), sandbox: dev.isSpaceStationSandbox(),
      CORRIDOR_RANGE: app.CORRIDOR_RANGE, DOCK_SPEED_LIMIT: app.DOCK_SPEED_LIMIT,
      systemTarget: sys.getSystemFlightSnapshot().target ?? null };
  }).catch(e => ({ err: String(e).slice(0, 160) }));
  report.corridor = { reachedInside1400: inside, samples,
    distanceBefore: before.contacts?.stations?.[0]?.distance ?? null,
    distanceAfter: after.contacts?.stations?.[0]?.distance ?? null,
    canDockBefore: before.contacts?.stations?.[0]?.canDock ?? null,
    canDockAfter: after.contacts?.stations?.[0]?.canDock ?? null,
    approachPhase: after.contacts?.stations?.[0]?.phase ?? null,
    speedBefore: before.system?.speed ?? null, speedAfter: after.system?.speed ?? null,
    keyFPresses: 2, navigated: urlBefore !== page.url(),
    systemTargetAfter: after.system?.targetWorldId ?? null,
    advisoryBefore: before.advisoryCopy, advisoryAfter: after.advisoryCopy,
    hudAfter: after.hudText, captionAfter: after.caption, fence };
  flush();
  console.log(`[corridor] inside=${inside} dist=${report.corridor.distanceAfter}`
    + ` canDock=${report.corridor.canDockAfter} authorized=${fence.dockingAuthorized}`
    + ` navigated=${report.corridor.navigated} advisory=${JSON.stringify(after.advisoryCopy)}`);
}

await page.close();
await browser.close();
flush();
console.log('wrote', OUT);
