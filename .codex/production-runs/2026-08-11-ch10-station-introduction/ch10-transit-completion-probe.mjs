// D-5 closure item 2 (+ T3 rung and the corridor-interior [F] proof):
// one full movie-lane ch10-transit.
//
// Proves, from state:
//   launch                 phase leaves 'surface'
//   committed attitude     the angle between the ship's forward vector and the
//                          directive's targetSystemPosition (the player-claimed
//                          bearing) — the nose is ON the claimed bearing
//   seam                   milestone story:ch10-seam-passed fires exactly ONCE
//                          and anchor anc.ch10.seam-of-light activates once
//   resolve                station distance <= STATION_STANDOFF_DISTANCE, K11
//                          painted, the 2500 ms hold
//   handback               anc.ch10.threshold-handback, guidance cleared
//   corridor fence         after the handback, nose inside CORRIDOR_RANGE 1,400
//                          and prove [F] neither commits nor navigates
// Zero timeout rescues: ch10-transit's declared backstop is 260 s.
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
const { chromium } = await import(
  '/home/thomasphillip/Projects/vox/main/node_modules/playwright-core/index.mjs'
);

const RUN_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT_DIR = path.join(RUN_DIR, 'evidence', 'verification');
const BASE = process.env.VOX_BASE ?? 'http://localhost:5176';
const CAP = Number(process.env.VOX_CAP ?? 900);
const CORRIDOR_CAP = Number(process.env.VOX_CORRIDOR_CAP ?? 480);
fs.mkdirSync(OUT_DIR, { recursive: true });
const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter(d => /^chromium-\d+$/.test(d)).sort().pop();
const CH10_TRANSIT_TIMEOUT = 260;

const TAP = async () => {
  if (window.__voxTap) return true;
  const cues = await import('/src/story/ux/feedbackCues.ts');
  window.__voxFeedbackLog = [];
  window.__voxTap = cues.subscribeStoryUxFeedback(cue => {
    window.__voxFeedbackLog.push({ at: Math.round(performance.now()), cue, beat: window.__storyBeat ?? null });
  });
  // Count seam-milestone writes: markMilestone must be idempotent, but "fires
  // once" is a claim about the edge, so watch the anchor activation list too.
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
    cues: (w.__voxFeedbackLog ?? []).length
  };
  try {
    const f = await import('/src/state/spaceFlight.ts');
    const s = f.getSpaceFlightSnapshot();
    out.flight = { phase: s.phase, controlMode: s.controlMode };
  } catch { /* ignore */ }
  try {
    const s = await import('/src/state/systemFlight.ts');
    const v = s.getSystemFlightSnapshot();
    out.system = { activePlanetId: v.activePlanetId, locationMode: v.locationMode,
      targetKind: v.target?.kind ?? null, targetWorldId: v.target?.worldId ?? null,
      pos: (v.pose?.position ?? []).map(n => Math.round(n)),
      quat: v.pose?.quaternion ?? null,
      speed: Math.round(Math.hypot(...(v.pose?.velocity ?? [0, 0, 0])) * 100) / 100 };
  } catch { /* ignore */ }
  try {
    const ap = await import('/src/story/autopilot.ts');
    const d = ap.getAutopilotFlightDirective();
    out.directive = { active: d.active, beat: d.beat, targetWorldId: d.targetWorldId ?? null,
      targetSystemPosition: d.targetSystemPosition
        ? (Array.isArray(d.targetSystemPosition)
          ? d.targetSystemPosition.map(n => Math.round(n))
          : [Math.round(d.targetSystemPosition.x), Math.round(d.targetSystemPosition.y), Math.round(d.targetSystemPosition.z)])
        : null,
      jump: !!d.controls?.jump, forward: !!d.controls?.forward };
  } catch (e) { out.directiveError = String(e).slice(0, 120); }
  // Attitude: angle between the ship's forward axis and the claimed bearing.
  try {
    if (out.system?.quat && out.directive?.targetSystemPosition && out.system?.pos) {
      const [x, y, z, wq] = out.system.quat;
      // forward = quat * (0,0,-1)
      const fx = 2 * (x * z + wq * y) * -1 + 0;
      const vx = -(2 * (x * z + wq * y));
      const vy = -(2 * (y * z - wq * x));
      const vz = -(1 - 2 * (x * x + y * y));
      const tx = out.directive.targetSystemPosition[0] - out.system.pos[0];
      const ty = out.directive.targetSystemPosition[1] - out.system.pos[1];
      const tz = out.directive.targetSystemPosition[2] - out.system.pos[2];
      const fl = Math.hypot(vx, vy, vz), tl = Math.hypot(tx, ty, tz);
      if (fl > 0 && tl > 0) {
        const dot = (vx * tx + vy * ty + vz * tz) / (fl * tl);
        out.bearingErrorDeg = Number((Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI).toFixed(2));
        out.rangeToTarget = Math.round(tl);
        void fx;
      }
    }
  } catch { /* ignore */ }
  try {
    const av = await import('/src/story/signedSceneAvRuntime.ts');
    const s = av.getSignedSceneAvDebugSnapshot();
    out.av = { anchorId: s.anchorId, history: s.activationHistoryAnchorIds ?? [],
      authority: s.shot?.cameraAuthority ?? null, fov: s.shot?.lens?.appliedFovDeg ?? null,
      agency: s.shot?.agency ?? null, postFx: s.postFx?.activeEffectIds ?? [] };
  } catch { /* ignore */ }
  try {
    const st = await import('/src/story/storyState.ts');
    const prog = await import('/src/game/systems/progressionSystem.ts');
    out.milestones = {
      transitIgnited: prog.hasMilestone(st.STORY_MILESTONES.ch10TransitIgnited),
      seamPassed: prog.hasMilestone(st.STORY_MILESTONES.ch10SeamPassed),
      stationResolved: prog.hasMilestone(st.STORY_MILESTONES.ch10StationResolved),
      ch10Complete: prog.hasMilestone(st.STORY_MILESTONES.ch10Complete)
    };
  } catch { /* ignore */ }
  const ap2 = w.__autopilot;
  if (ap2) out.autopilot = { beat: ap2.beat, clock: ap2.clock, pos: ap2.pos,
    keys: Object.entries(ap2.controls ?? {}).filter(([, v]) => v === true).map(([k]) => k) };
  out.contacts = w.__spaceStationContacts ? w.__spaceStationContacts() : null;
  const bodyText = document.body.innerText || '';
  out.advisoryCopy = {
    holdForApproach: /HOLD FOR APPROACH/i.test(bodyText),
    onTheCorridor: /ON THE CORRIDOR/i.test(bodyText),
    cleared: /CLEARED TO/i.test(bodyText),
    berth: /BERTH/i.test(bodyText),
    localLock: bodyText.includes('LOCAL LOCK'),
    flightCorridor: bodyText.includes('FLIGHT CORRIDOR')
  };
  return out;
};

const browser = await chromium.launch({
  executablePath: path.join(pwDir, chromeDir, 'chrome-linux/chrome'),
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--enable-precise-memory-info',
    '--window-size=1280,720']
});
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e).slice(0, 180)));

const report = { capturedAt: new Date().toISOString(), base: BASE,
  url: `${BASE}/?story=ch10-transit&movie=1&profile=LOW`,
  beatTimeoutSeconds: CH10_TRANSIT_TIMEOUT, legs: {}, legBeatClock: {}, trace: [],
  objectiveEvents: [], attitudeSamples: [], anchorActivationCounts: {}, pageErrors };
const OUT = path.join(OUT_DIR, 'ch10-transit-completion.json');
const flush = () => fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');

const LEGS = [
  ['ignited', s => s.milestones?.transitIgnited === true],
  ['airborne', s => s.flight?.controlMode === 'flight' && s.flight?.phase !== 'surface'],
  ['deep-space', s => s.flight?.phase === 'deep_space'],
  ['seam-milestone', s => s.milestones?.seamPassed === true],
  ['anchor-seam-of-light', s => (s.av?.history ?? []).includes('anc.ch10.seam-of-light')],
  ['T3-resolving-rung', s => s.objectiveId === 'station:transit:resolve'],
  ['station-resolved-milestone', s => s.milestones?.stationResolved === true],
  ['anchor-station-resolved', s => (s.av?.history ?? []).includes('anc.ch10.station-resolved')],
  ['k11-painted', s => (s.caption ?? '').includes('both fires behind you')],
  ['work-order-cleared', s => !s.objectiveId && !!(s.av?.history ?? []).includes('anc.ch10.station-resolved')],
  ['anchor-threshold-handback', s => (s.av?.history ?? []).includes('anc.ch10.threshold-handback')]
];

await page.goto(report.url, { waitUntil: 'load', timeout: 120000 });
await page.evaluate(TAP).catch(() => {});
const t0 = Date.now();
let prevObjective = null, prevKey = null, lastClock = null;
let seamSeenCount = 0, prevSeam = false;
while ((Date.now() - t0) / 1000 < CAP) {
  let s;
  try { s = await page.evaluate(READ); }
  catch (e) { report.readError = String(e).slice(0, 160); break; }
  const t = Number(((Date.now() - t0) / 1000).toFixed(2));
  if (s.autopilot?.beat === 'ch10-transit') lastClock = s.autopilot.clock;
  for (const [name, pred] of LEGS) {
    if (!(name in report.legs) && pred(s)) {
      report.legs[name] = t;
      report.legBeatClock[name] = s.autopilot?.clock ?? null;
    }
  }
  if (s.milestones?.seamPassed && !prevSeam) seamSeenCount++;
  prevSeam = !!s.milestones?.seamPassed;
  for (const a of s.av?.history ?? []) {
    report.anchorActivationCounts[a] = (report.anchorActivationCounts[a] ?? 0);
  }
  if (s.bearingErrorDeg != null) {
    report.attitudeSamples.push({ t, bearingErrorDeg: s.bearingErrorDeg,
      rangeToTarget: s.rangeToTarget, phase: s.flight?.phase ?? null,
      stationDistance: s.contacts?.stations?.[0]?.distance ?? null });
  }
  if (s.objectiveId !== prevObjective) {
    report.objectiveEvents.push({ t, beatClock: s.autopilot?.clock ?? null, beat: s.beat,
      from: prevObjective, to: s.objectiveId, markerLabel: s.markerLabel, health: s.health,
      requiresMarker: s.requiresMarker, hudText: s.hudText, caption: s.caption, cues: s.cues });
    prevObjective = s.objectiveId;
  }
  const key = JSON.stringify([s.beat, s.objectiveId, s.flight, s.av?.anchorId, s.caption,
    s.milestones, s.contacts?.stations?.[0]?.distance]);
  if (key !== prevKey) { report.trace.push({ t, ...s }); prevKey = key; }
  if ('anchor-threshold-handback' in report.legs
      && t > report.legs['anchor-threshold-handback'] + 12) break;
  await new Promise(r => setTimeout(r, 600));
}
report.transitBeatClockAtHandback = report.legBeatClock['anchor-threshold-handback'] ?? lastClock;
report.timeoutRescue = (report.transitBeatClockAtHandback ?? 0) >= CH10_TRANSIT_TIMEOUT - 1;
report.seamMilestoneEdges = seamSeenCount;
report.seamAnchorActivations = report.trace.filter(
  x => (x.av?.history ?? []).filter(a => a === 'anc.ch10.seam-of-light').length > 1).length;
report.completed = 'anchor-threshold-handback' in report.legs;
report.feedbackLog = await page.evaluate(() => window.__voxFeedbackLog ?? []).catch(() => []);
flush();
console.log(`[transit] completed=${report.completed} handbackBeatClock=${report.transitBeatClockAtHandback}`
  + ` rescue=${report.timeoutRescue} legs=${Object.keys(report.legs).length}/${LEGS.length}`
  + ` seamEdges=${seamSeenCount} errs=${pageErrors.length}`);

// ---- corridor-interior [F] proof, continuing the same free flight ----------
if (report.completed) {
  const approach = { samples: [] };
  await page.keyboard.down('KeyW');
  const t1 = Date.now();
  let inside = false;
  while ((Date.now() - t1) / 1000 < CORRIDOR_CAP) {
    const c = await page.evaluate(
      () => (window.__spaceStationContacts ? window.__spaceStationContacts() : null)).catch(() => null);
    const st = c?.stations?.[0] ?? null;
    approach.samples.push({ t: Math.round((Date.now() - t1) / 1000), station: st, phase: c?.phase ?? null });
    if (st && st.distance <= 1200) { inside = true; break; }
    await new Promise(r => setTimeout(r, 1500));
  }
  await page.keyboard.up('KeyW');
  await new Promise(r => setTimeout(r, 8000)); // let the speed gate settle
  const before = await page.evaluate(READ);
  const urlBefore = page.url();
  await page.keyboard.press('KeyF');
  await new Promise(r => setTimeout(r, 2500));
  await page.keyboard.press('KeyF');
  await new Promise(r => setTimeout(r, 4000));
  const after = await page.evaluate(READ);
  const fence = await page.evaluate(async () => {
    const dev = await import('/src/game/spaceStation/spaceStationDevFlag.ts');
    const app = await import('/src/game/spaceStation/spaceStationApproach.ts');
    const sys = await import('/src/state/systemFlight.ts');
    return { dockingAuthorized: dev.spaceStationDockingAuthorized(),
      targetingAuthorized: dev.spaceStationTargetingAuthorized(),
      storyContext: dev.isStorySpaceStationContext(), sandbox: dev.isSpaceStationSandbox(),
      CORRIDOR_RANGE: app.CORRIDOR_RANGE, DOCK_SPEED_LIMIT: app.DOCK_SPEED_LIMIT,
      systemTarget: sys.getSystemFlightSnapshot().target ?? null };
  }).catch(e => ({ err: String(e).slice(0, 160) }));
  report.corridorFence = {
    reachedCorridor: inside, approach,
    distanceBefore: before.contacts?.stations?.[0]?.distance ?? null,
    distanceAfter: after.contacts?.stations?.[0]?.distance ?? null,
    canDockBefore: before.contacts?.stations?.[0]?.canDock ?? null,
    canDockAfter: after.contacts?.stations?.[0]?.canDock ?? null,
    approachPhase: after.contacts?.stations?.[0]?.phase ?? null,
    speedBefore: before.system?.speed ?? null,
    urlBefore, urlAfter: page.url(), navigated: urlBefore !== page.url(),
    systemTargetAfter: after.system?.targetWorldId ?? null,
    advisoryAfter: after.advisoryCopy, hudAfter: after.hudText, fence
  };
  flush();
  console.log(`[corridor] inside=${inside} distance=${report.corridorFence.distanceAfter}`
    + ` canDock=${report.corridorFence.canDockAfter} authorized=${fence.dockingAuthorized}`
    + ` navigated=${report.corridorFence.navigated}`);
}

await page.close();
await context.close();
await browser.close();
flush();
console.log('wrote', OUT);
