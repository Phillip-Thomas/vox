// Stage 6 closeout, state-only (no frames):
//   A. the corridor-interior [F] proof the predecessor could only sample at
//      6,630 units — fly inside CORRIDOR_RANGE 1,400 and show the fence holds;
//   B. the reload-safety trace: quit/reload mid-transit must restore the same
//      carrier and the same pulse as an uninterrupted run;
//   C. the T3 rung (station:transit:resolve) lifecycle observation;
//   D. the galaxy firewall: no GalaxyImpostors composed in the transit reveals.
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

const INSTALL = async () => {
  if (!window.__voxHooked) {
    const src = await (await fetch('/src/components/SystemCompanionBodies.tsx')).text();
    const threeUrl = src.match(/from\s*["']([^"']*deps\/three\.js[^"']*)["']/)[1];
    const THREE = await import(/* @vite-ignore */ threeUrl);
    window.__THREE = THREE;
    window.__voxLive = {};
    const base = THREE.Object3D.prototype.updateMatrixWorld;
    THREE.Scene.prototype.updateMatrixWorld = function (f) { window.__voxLive.scene = this; return base.call(this, f); };
    THREE.PerspectiveCamera.prototype.updateMatrixWorld = function (f) { window.__voxLive.camera = this; return base.call(this, f); };
    window.__voxHooked = true;
  }
  if (!window.__voxTap) {
    const cues = await import('/src/story/ux/feedbackCues.ts');
    window.__voxFeedbackLog = [];
    window.__voxTap = cues.subscribeStoryUxFeedback(cue => {
      window.__voxFeedbackLog.push({ at: Math.round(performance.now()), cue, beat: window.__storyBeat ?? null });
    });
  }
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
    caption: caption ? caption.innerText.trim() : null,
    cues: (w.__voxFeedbackLog ?? []).slice()
  };
  try {
    const av = await import('/src/story/signedSceneAvRuntime.ts');
    const s = av.getSignedSceneAvDebugSnapshot();
    out.av = { active: s.active, anchorId: s.anchorId, authority: s.shot?.cameraAuthority ?? null,
      fov: s.shot?.lens?.appliedFovDeg ?? null, agency: s.shot?.agency ?? null,
      postFx: s.postFx?.activeEffectIds ?? [], history: s.activationHistoryAnchorIds ?? [],
      reset: s.lastResetReason ?? null };
  } catch { /* ignore */ }
  try {
    const score = await import('/src/story/emergentScoreDirector.ts');
    const storyScore = await import('/src/story/storyScore.ts');
    const snap = score.getChapter10ScoreSnapshot();
    out.score = { ...snap, milestones: score.chapter10ScoreMilestones() };
    if (w.__storyBeat) out.mood = storyScore.getStoryScoreMood(w.__storyBeat);
  } catch (e) { out.scoreError = String(e).slice(0, 140); }
  try {
    const flight = await import('/src/state/spaceFlight.ts');
    const f = flight.getSpaceFlightSnapshot();
    out.flight = { phase: f.phase, controlMode: f.controlMode };
  } catch { /* ignore */ }
  try {
    const sys = await import('/src/state/systemFlight.ts');
    const s = sys.getSystemFlightSnapshot();
    out.system = { activePlanetId: s.activePlanetId, locationMode: s.locationMode,
      targetKind: s.target?.kind ?? null, targetWorldId: s.target?.worldId ?? null,
      speed: Math.round(Math.hypot(...(s.pose?.velocity ?? [0, 0, 0])) * 100) / 100 };
  } catch { /* ignore */ }
  out.contacts = w.__spaceStationContacts ? w.__spaceStationContacts() : null;
  // Galaxy firewall: is any GalaxyImpostors node composed in this frame?
  try {
    const live = w.__voxLive;
    if (live?.scene) {
      const g = [];
      live.scene.traverse(o => { if (/galaxy/i.test(o.name)) g.push({ name: o.name, visible: o.visible }); });
      out.galaxyObjects = g.slice(0, 10);
      out.galaxyVisible = g.some(x => x.visible);
    }
  } catch { /* ignore */ }
  const bodyText = document.body.innerText || '';
  out.advisoryCopy = {
    holdForApproach: /HOLD FOR APPROACH/i.test(bodyText),
    onTheCorridor: /ON THE CORRIDOR/i.test(bodyText),
    cleared: /CLEARED TO/i.test(bodyText),
    berth: /BERTH/i.test(bodyText),
    dock: /\bDOCK\b/i.test(bodyText),
    localLock: bodyText.includes('LOCAL LOCK'),
    flightCorridor: bodyText.includes('FLIGHT CORRIDOR')
  };
  return out;
};

const browser = await chromium.launch({
  executablePath: path.join(pwDir, chromeDir, 'chrome-linux/chrome'),
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720']
});

const report = { capturedAt: new Date().toISOString(), base: BASE,
  corridorFence: null, reloadSafety: null, t3Rung: null, galaxyFirewall: null };
const OUT = path.join(OUT_DIR, 'ch10-fence-reload-trace.json');
const flush = () => fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');

async function open(url, settleMs = 12000) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(`${BASE}/${url}`, { waitUntil: 'load', timeout: 120000 });
  await new Promise(r => setTimeout(r, settleMs));
  await page.evaluate(INSTALL).catch(e => errs.push('hook ' + String(e).slice(0, 120)));
  return { page, errs };
}

// ---------------------------------------------------------------- session one
{
  const { page, errs } = await open('?story=ch10-transit&movie=1&profile=LOW', 14000);
  const trace = [];
  const t0 = Date.now();
  let prev = null, handbackAt = null;
  const objectiveEvents = [];
  let prevObjective = null;
  // Phase 1: ride the transit to the hand-back, watching T3 and the galaxy.
  while ((Date.now() - t0) / 1000 < 600) {
    const s = await page.evaluate(READ).catch(() => null);
    if (!s) { await new Promise(r => setTimeout(r, 500)); continue; }
    const t = Number(((Date.now() - t0) / 1000).toFixed(1));
    if (s.objectiveId !== prevObjective) {
      objectiveEvents.push({ t, beat: s.beat, from: prevObjective, to: s.objectiveId,
        markerLabel: s.markerLabel, health: s.health, requiresMarker: s.requiresMarker,
        hudText: s.hudText, caption: s.caption, cueCount: s.cues.length });
      prevObjective = s.objectiveId;
    }
    const key = JSON.stringify([s.beat, s.objectiveId, s.av?.anchorId, s.caption, s.flight, s.galaxyVisible]);
    if (key !== prev) { trace.push({ t, ...s, cues: s.cues.length }); prev = key; }
    if (s.av?.history?.includes('anc.ch10.threshold-handback')) { handbackAt = t; break; }
    await new Promise(r => setTimeout(r, 500));
  }
  // Phase 2: the corridor. After the hand-back the pilot has free flight; nose
  // in past CORRIDOR_RANGE 1,400 and try the dock key for real.
  const approach = { handbackAt, samples: [] };
  const closeIn = async () => {
    const t1 = Date.now();
    await page.keyboard.down('KeyW');
    let inside = false;
    while ((Date.now() - t1) / 1000 < 420) {
      const c = await page.evaluate(() => (window.__spaceStationContacts ? window.__spaceStationContacts() : null)).catch(() => null);
      const st = c?.stations?.[0] ?? null;
      approach.samples.push({ t: Math.round((Date.now() - t1) / 1000), station: st, phase: c?.phase ?? null });
      if (st && st.distance <= 1200) { inside = true; break; }
      await new Promise(r => setTimeout(r, 1000));
    }
    await page.keyboard.up('KeyW');
    return inside;
  };
  approach.reachedCorridor = await closeIn();
  // Let the speed gate settle (DOCK_SPEED_LIMIT 34) before trying the key.
  await new Promise(r => setTimeout(r, 6000));
  const before = await page.evaluate(READ);
  const beforeUrl = page.url();
  await page.keyboard.press('KeyF');
  await new Promise(r => setTimeout(r, 2500));
  await page.keyboard.press('KeyF');
  await new Promise(r => setTimeout(r, 4000));
  const after = await page.evaluate(READ);
  const afterUrl = page.url();
  // The fence itself, and a synthetic in-corridor readout that removes any
  // doubt that [F] was merely blocked by alignment rather than by the fence.
  const fence = await page.evaluate(async () => {
    const dev = await import('/src/game/spaceStation/spaceStationDevFlag.ts');
    const app = await import('/src/game/spaceStation/spaceStationApproach.ts');
    const sys = await import('/src/state/systemFlight.ts');
    const out = {
      dockingAuthorized: dev.spaceStationDockingAuthorized(),
      targetingAuthorized: dev.spaceStationTargetingAuthorized(),
      storyContext: dev.isStorySpaceStationContext(),
      sandbox: dev.isSpaceStationSandbox(),
      dockEnabled: dev.spaceStationDockEnabled(),
      CORRIDOR_RANGE: app.CORRIDOR_RANGE,
      DOCK_SPEED_LIMIT: app.DOCK_SPEED_LIMIT,
      systemTarget: sys.getSystemFlightSnapshot().target ?? null
    };
    return out;
  }).catch(e => ({ err: String(e).slice(0, 200) }));
  report.corridorFence = {
    url: '?story=ch10-transit&movie=1&profile=LOW',
    approach,
    contactsBefore: before.contacts, contactsAfter: after.contacts,
    speedBefore: before.system?.speed ?? null,
    systemTargetBefore: before.system?.targetWorldId ?? null,
    systemTargetAfter: after.system?.targetWorldId ?? null,
    urlBefore: beforeUrl, urlAfter: afterUrl, navigated: beforeUrl !== afterUrl,
    advisoryBefore: before.advisoryCopy, advisoryAfter: after.advisoryCopy,
    hudAfter: after.hudText, captionAfter: after.caption,
    fence, pageErrors: errs
  };
  report.t3Rung = { objectiveEvents, handbackAt,
    feedbackLog: after.cues ?? [], trace: trace.map(x => ({ t: x.t, beat: x.beat,
      objectiveId: x.objectiveId, markerLabel: x.markerLabel, requiresMarker: x.requiresMarker,
      health: x.health, hudText: x.hudText, caption: x.caption, anchor: x.av?.anchorId ?? null })) };
  report.galaxyFirewall = {
    samples: trace.map(x => ({ t: x.t, anchor: x.av?.anchorId ?? null,
      galaxyVisible: x.galaxyVisible ?? null, galaxyObjects: x.galaxyObjects ?? null })),
    anyGalaxyVisibleDuringTransit: trace.some(x => x.galaxyVisible === true)
  };
  flush();
  console.log(`[fence] corridor=${approach.reachedCorridor} dist=${JSON.stringify(after.contacts?.stations ?? null)}`
    + ` authorized=${fence.dockingAuthorized} navigated=${beforeUrl !== afterUrl}`);
  await page.close();
}

// ---------------------------------------------------------------- session two
{
  const { page, errs } = await open('?story=ch10-transit&movie=1&profile=LOW', 14000);
  const checkpoints = [];
  const waitFor = async (pred, capSeconds) => {
    const t1 = Date.now();
    while ((Date.now() - t1) / 1000 < capSeconds) {
      const s = await page.evaluate(READ).catch(() => null);
      if (s && pred(s)) return s;
      await new Promise(r => setTimeout(r, 500));
    }
    return null;
  };
  // Checkpoint one: mid-transit, after the seam has ebbed.
  const seam = await waitFor(s => s.score?.milestones?.seamPassed === true, 420);
  if (seam) {
    const uninterrupted = { variant: seam.score.variant, carrierAlive: seam.score.carrierAlive,
      intensity: seam.score.intensity, mood: seam.mood, milestones: seam.score.milestones,
      beat: seam.beat };
    await page.reload({ waitUntil: 'load', timeout: 120000 });
    await new Promise(r => setTimeout(r, 15000));
    await page.evaluate(INSTALL).catch(() => {});
    const afterReload = await page.evaluate(READ);
    checkpoints.push({ checkpoint: 'mid-transit-after-seam', uninterrupted,
      afterReload: { variant: afterReload.score?.variant, carrierAlive: afterReload.score?.carrierAlive,
        intensity: afterReload.score?.intensity, mood: afterReload.mood,
        milestones: afterReload.score?.milestones, beat: afterReload.beat },
      identical: JSON.stringify([uninterrupted.variant, uninterrupted.carrierAlive, uninterrupted.intensity, uninterrupted.mood])
        === JSON.stringify([afterReload.score?.variant, afterReload.score?.carrierAlive,
          afterReload.score?.intensity, afterReload.mood]) });
  }
  // Checkpoint two: at the resolve, where the carrier's octave double lives.
  const resolved = await waitFor(s => s.score?.milestones?.stationResolved === true, 420);
  if (resolved) {
    const uninterrupted = { variant: resolved.score.variant, carrierAlive: resolved.score.carrierAlive,
      intensity: resolved.score.intensity, mood: resolved.mood, milestones: resolved.score.milestones,
      beat: resolved.beat };
    await page.reload({ waitUntil: 'load', timeout: 120000 });
    await new Promise(r => setTimeout(r, 15000));
    await page.evaluate(INSTALL).catch(() => {});
    const afterReload = await page.evaluate(READ);
    checkpoints.push({ checkpoint: 'at-station-resolved', uninterrupted,
      afterReload: { variant: afterReload.score?.variant, carrierAlive: afterReload.score?.carrierAlive,
        intensity: afterReload.score?.intensity, mood: afterReload.mood,
        milestones: afterReload.score?.milestones, beat: afterReload.beat },
      identical: JSON.stringify([uninterrupted.variant, uninterrupted.carrierAlive, uninterrupted.intensity, uninterrupted.mood])
        === JSON.stringify([afterReload.score?.variant, afterReload.score?.carrierAlive,
          afterReload.score?.intensity, afterReload.mood]) });
  }
  report.reloadSafety = { checkpoints, pageErrors: errs,
    allIdentical: checkpoints.length > 0 && checkpoints.every(c => c.identical) };
  flush();
  console.log(`[reload] checkpoints=${checkpoints.length} identical=${checkpoints.map(c => c.identical).join(',')}`);
  await page.close();
}

await browser.close();
flush();
console.log('wrote', OUT);
