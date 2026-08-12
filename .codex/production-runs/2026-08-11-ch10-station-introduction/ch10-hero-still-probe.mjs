// Stage 6 closeout: the three HIGH hero stills, RE-STAGED to their composition
// criteria. The predecessor's three all missed: the ST-0 sighting was shot in
// daylight (ST-0 below its visibility floor) and both transit stills were the
// grounded cockpit, because HIGH-tier headless rendering is far below realtime
// and the flight never reached the seam or the standoff inside its settle.
//
// Method: fly the beat at LOW (realtime), and at the exact anchor raise the
// quality profile through the shipped setter the pause menu itself calls
// (setQualityProfile -> subscribeGraphicsQuality -> useSyncExternalStore), let
// HIGH frames render, then shoot. The frame is a real HIGH-tier render of the
// named moment; the profile in force is recorded with each still.
//
// Budget: exactly three HIGH stills. No strips at HIGH, no movie render.
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
fs.mkdirSync(CAP_DIR, { recursive: true });
const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter(d => /^chromium-\d+$/.test(d)).sort().pop();

const INSTALL = async () => {
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
    hudText: hud ? hud.innerText.replace(/\s*\n\s*/g, ' | ').trim() : null,
    caption: caption ? caption.innerText.trim() : null
  };
  try {
    const av = await import('/src/story/signedSceneAvRuntime.ts');
    const s = av.getSignedSceneAvDebugSnapshot();
    out.av = { anchorId: s.anchorId, authority: s.shot?.cameraAuthority ?? null,
      fov: s.shot?.lens?.appliedFovDeg ?? null, agency: s.shot?.agency ?? null,
      postFx: s.postFx?.activeEffectIds ?? [], history: s.activationHistoryAnchorIds ?? [] };
  } catch { /* ignore */ }
  try {
    const g = await import('/src/config/graphicsSettings.ts');
    out.qualityProfile = g.getQualityProfile();
    const q = g.getGraphicsQuality();
    out.graphics = { postProcess: q.postProcess, bloom: q.bloom ?? null, shadows: q.shadows ?? null };
  } catch (e) { out.graphicsError = String(e).slice(0, 120); }
  try {
    const clock = await import('/src/game/worldClock.ts');
    const night = await import('/src/utils/nightState.ts');
    out.dayPhase = Number(clock.getCurrentDayPhase().toFixed(4));
    out.daylight = Number(night.daylightFromDayPhase(clock.getCurrentDayPhase()).toFixed(4));
    out.isNight = night.isDarkDaylight(out.daylight);
  } catch { /* ignore */ }
  try {
    const flight = await import('/src/state/spaceFlight.ts');
    out.flight = flight.getSpaceFlightSnapshot().phase;
    const f2 = await import('/src/state/spaceFlight.ts');
    out.controlMode = f2.getSpaceFlightSnapshot().controlMode;
  } catch { /* ignore */ }
  out.contacts = w.__spaceStationContacts ? w.__spaceStationContacts() : null;
  // Live sky geometry: ST-0, the companion bodies (the "moon"), and the galaxy.
  try {
    const live = w.__voxLive, THREE = w.__THREE;
    if (live?.scene && live?.camera) {
      const cam = live.camera;
      const camPos = new THREE.Vector3(); cam.getWorldPosition(camPos);
      const project = (obj) => {
        const wp = new THREE.Vector3(); obj.getWorldPosition(wp);
        const ndc = wp.clone().project(cam);
        const up = camPos.clone().normalize();
        const dir = wp.clone().sub(camPos).normalize();
        return { name: obj.name, visible: obj.visible,
          ndc: [Number(ndc.x.toFixed(3)), Number(ndc.y.toFixed(3))],
          inFrame: Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && ndc.z > -1 && ndc.z < 1,
          altitudeDeg: Number((90 - Math.acos(Math.max(-1, Math.min(1, dir.dot(up)))) * 180 / Math.PI).toFixed(2)) };
      };
      const sky = { st0: null, companions: [], galaxy: [] };
      live.scene.traverse(o => {
        if (o.name === 'system-st0-station-light') sky.st0 = { ...project(o), opacity: o.material?.opacity ?? null };
        else if (/^system-companion-body-/.test(o.name)) sky.companions.push(project(o));
        else if (/galaxy/i.test(o.name)) sky.galaxy.push({ name: o.name, visible: o.visible });
      });
      out.sky = sky;
      out.cameraFov = cam.fov;
    }
  } catch (e) { out.skyError = String(e).slice(0, 120); }
  return out;
};

const RAISE = async (profile) => {
  const g = await import('/src/config/graphicsSettings.ts');
  g.setQualityProfile(profile, { persist: false });
  return g.getQualityProfile();
};

const browser = await chromium.launch({
  executablePath: path.join(pwDir, chromeDir, 'chrome-linux/chrome'),
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720']
});

const report = { capturedAt: new Date().toISOString(), base: BASE,
  method: 'fly at LOW, raise to HIGH through the shipped setQualityProfile store at the named anchor, let HIGH frames render, then shoot',
  stills: [] };
const OUT = path.join(OUT_DIR, 'ch10-hero-stills.json');
const flush = () => fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');

const HIGH_SETTLE_MS = Number(process.env.VOX_HIGH_SETTLE ?? 45000);

async function open(url, settleMs) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
  await page.goto(`${BASE}/${url}`, { waitUntil: 'load', timeout: 180000 });
  await new Promise(r => setTimeout(r, settleMs));
  await page.evaluate(INSTALL).catch(e => errs.push('hook ' + String(e).slice(0, 120)));
  return { page, errs };
}

// -------------------------------------------------- still one: the ST-0 sighting
{
  const id = 'still-st0-sighting';
  const { page, errs } = await open('?story=ch10-cold&profile=LOW', 14000);
  // Night, from its start, so the whole ~119s window is ahead of the pass.
  await page.evaluate(async () => {
    const clock = await import('/src/game/worldClock.ts');
    clock.setDayPhaseOffset(0.55 - clock.getCurrentDayPhase());
  }).catch(() => {});
  // Look up into the upper third, where the composition wants ST-0.
  await page.evaluate(() => {
    for (let i = 0; i < 14; i++) {
      document.dispatchEvent(new MouseEvent('mousemove', { movementX: 0, movementY: -16, bubbles: true }));
    }
  }).catch(() => {});
  await new Promise(r => setTimeout(r, 2500));
  // Wait for ST-0 to rise and climb; raise to HIGH on the way up so the HIGH
  // frames land near the pass maximum (the true-bearing crossing).
  const t0 = Date.now();
  let risenAt = null, raised = false, last = null;
  while ((Date.now() - t0) / 1000 < 300) {
    const s = await page.evaluate(READ).catch(() => null);
    if (s) {
      last = s;
      const st0 = s.sky?.st0;
      if (!risenAt && st0?.visible && (st0.altitudeDeg ?? -90) > 3) risenAt = (Date.now() - t0) / 1000;
      if (risenAt && !raised && (Date.now() - t0) / 1000 > risenAt + 4) {
        await page.evaluate(RAISE, 'HIGH');
        raised = true;
        break;
      }
    }
    await new Promise(r => setTimeout(r, 500));
  }
  await new Promise(r => setTimeout(r, HIGH_SETTLE_MS));
  const at = await page.evaluate(READ);
  await page.screenshot({ path: path.join(CAP_DIR, `${id}.png`) });
  report.stills.push({ id, file: `evidence/capture/${id}.png`, tier: 'HIGH',
    url: '?story=ch10-cold&profile=LOW + runtime raise to HIGH', risenAt, raised,
    state: at, preRaiseState: last, pageErrors: errs });
  flush();
  console.log(`[${id}] profile=${at.qualityProfile} night=${at.isNight} st0=${JSON.stringify(at.sky?.st0)}`);
  await page.close();
}

// ------------------------------------- stills two and three: seam and standoff
{
  const { page, errs } = await open('?story=ch10-transit&movie=1&profile=LOW', 14000);
  const waitForAnchor = async (anchor, cap) => {
    const t0 = Date.now();
    while ((Date.now() - t0) / 1000 < cap) {
      const s = await page.evaluate(READ).catch(() => null);
      if (s?.av?.history?.includes(anchor)) return s;
      await new Promise(r => setTimeout(r, 400));
    }
    return null;
  };
  // --- still two: the seam of light
  const seam = await waitForAnchor('anc.ch10.seam-of-light', 300);
  if (!seam) {
    const blocked = await page.evaluate(READ);
    report.stills.push({ id: 'still-seam-of-light', status: 'BLOCKED',
      reason: 'anc.ch10.seam-of-light never fired: the ship never leaves the ground in the movie lane',
      state: blocked, pageErrors: errs });
    flush();
  }
  if (seam) {
    await page.evaluate(RAISE, 'HIGH');
    await new Promise(r => setTimeout(r, HIGH_SETTLE_MS));
    const at = await page.evaluate(READ);
    await page.screenshot({ path: path.join(CAP_DIR, 'still-seam-of-light.png') });
    report.stills.push({ id: 'still-seam-of-light', file: 'evidence/capture/still-seam-of-light.png',
      tier: 'HIGH', url: '?story=ch10-transit&movie=1&profile=LOW + runtime raise to HIGH',
      atAnchor: seam.av?.anchorId ?? null, state: at, pageErrors: errs });
    flush();
    console.log(`[still-seam-of-light] profile=${at.qualityProfile} anchor=${at.av?.anchorId} flight=${at.flight} galaxy=${JSON.stringify(at.sky?.galaxy)}`);
    // Back to LOW so the flight runs at realtime to the standoff.
    await page.evaluate(RAISE, 'LOW');
    await new Promise(r => setTimeout(r, 3000));
  }
  // --- still three: the closing station shot (the run's cut line)
  const resolved = await waitForAnchor('anc.ch10.station-resolved', seam ? 300 : 5);
  if (!resolved) {
    const blocked = await page.evaluate(READ);
    report.stills.push({ id: 'still-station-resolved', status: 'BLOCKED',
      reason: 'anc.ch10.station-resolved never fired: the ship never leaves the ground in the movie lane',
      state: blocked, pageErrors: errs });
    flush();
  }
  if (resolved) {
    // The cut line is the frame where the station exists with the work order
    // cleared, so wait for the T3 card to clear before raising.
    const t0 = Date.now();
    let cleared = null;
    while ((Date.now() - t0) / 1000 < 60) {
      const s = await page.evaluate(READ).catch(() => null);
      if (s && (!s.objectiveId || !s.hudText)) { cleared = s; break; }
      await new Promise(r => setTimeout(r, 400));
    }
    await page.evaluate(RAISE, 'HIGH');
    await new Promise(r => setTimeout(r, HIGH_SETTLE_MS));
    const at = await page.evaluate(READ);
    await page.screenshot({ path: path.join(CAP_DIR, 'still-station-resolved.png') });
    report.stills.push({ id: 'still-station-resolved', file: 'evidence/capture/still-station-resolved.png',
      tier: 'HIGH', url: '?story=ch10-transit&movie=1&profile=LOW + runtime raise to HIGH',
      atAnchor: resolved.av?.anchorId ?? null, workOrderClearedBeforeRaise: !!cleared,
      state: at, pageErrors: errs });
    flush();
    console.log(`[still-station-resolved] profile=${at.qualityProfile} fov=${at.av?.fov} contacts=${JSON.stringify(at.contacts?.stations ?? null)} hud=${JSON.stringify(at.hudText)}`);
  }
  await page.close();
}

await browser.close();
flush();
console.log('wrote', OUT);
