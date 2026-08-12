// Stage 6 closeout: three COLD movie-lane runs of ?story=base&movie=1&profile=LOW
// against the repaired tree, from ch9-settle to the ch10 threshold hand-back.
//
// State trace only (lock evidence budget: no webm, no movie render). Adds over
// the predecessor probe:
//   - a module-split self-check (the dynamically imported storyState must agree
//     with window.__storyBeat; a disagreement means the read describes a second
//     module instance nobody is playing),
//   - per-second autopilot sampling (pos/goal/keys/stillTime/nudges) so run
//     divergence can be located,
//   - timeout-rescue detection: beatClock at every beat transition compared to
//     the autopilot's own BEAT_TIMEOUT table,
//   - liveness detection (frozen autopilot clock / unmounted scene).
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
const { chromium } = await import(
  '/home/thomasphillip/Projects/vox/main/node_modules/playwright-core/index.mjs'
);

const RUN_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT_DIR = path.join(RUN_DIR, 'evidence', 'verification');
const BASE = process.env.VOX_BASE ?? 'http://localhost:5176';
const RUNS = Number(process.env.VOX_RUNS ?? 3);
const PARALLEL = process.env.VOX_PARALLEL === '1';
const CAP_SECONDS = Number(process.env.VOX_CAP ?? 3000);
const POLL_MS = 1000;
fs.mkdirSync(OUT_DIR, { recursive: true });
const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter(d => /^chromium-\d+$/.test(d)).sort().pop();

// The autopilot's own backstops (main/src/story/autopilot.ts BEAT_TIMEOUT).
const BEAT_TIMEOUT = {
  'ch1-fixed': 55, 'ch1-raster': 95, 'ch1-depth': 60, 'ch1-nav': 75, 'ch1-iso': 75,
  'ch1-anomaly': 62, 'ch2-color': 45, 'ch2-approach': 45, 'ch3-gather': 34,
  'ch3-await-rest': 70, 'ch3-thirst': 75, 'ch3-forage': 60, 'ch3-signal': 60,
  'ch4-vigil': 140, 'ch10-cold': 200, 'ch10-ask': 320, 'ch10-transit': 260
};

const TAP = async () => {
  const w = window;
  if (w.__voxTap) return true;
  const cues = await import('/src/story/ux/feedbackCues.ts');
  w.__voxFeedbackLog = [];
  w.__voxTap = cues.subscribeStoryUxFeedback(cue => {
    w.__voxFeedbackLog.push({ at: Math.round(performance.now()), cue, beat: w.__storyBeat ?? null });
  });
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
  const ap = w.__autopilot;
  if (ap) out.autopilot = {
    beat: ap.beat, clock: ap.clock, pos: ap.pos, goal: ap.goal,
    routeAction: ap.routeAction, routeOutcome: ap.routeOutcome,
    keys: Object.entries(ap.controls ?? {}).filter(([, v]) => v === true).map(([k]) => k),
    stillTime: ap.stillTime, nudges: ap.nudges, teleportNudgesTotal: ap.teleportNudgesTotal
  };
  try {
    const story = await import('/src/story/storyState.ts');
    const snap = story.getStoryStateSnapshot();
    // MODULE IDENTITY self-check: this import must be the instance the app plays.
    out.moduleSplit = !!(w.__storyBeat && snap.beat && snap.beat !== w.__storyBeat);
    out.storyChapter = snap.chapter;
  } catch (e) { out.storyError = String(e).slice(0, 120); }
  try {
    const av = await import('/src/story/signedSceneAvRuntime.ts');
    const s = av.getSignedSceneAvDebugSnapshot();
    out.av = {
      active: s.active, beat: s.beat, anchorId: s.anchorId,
      authority: s.shot?.cameraAuthority ?? null,
      fov: s.shot?.lens?.appliedFovDeg ?? null,
      agency: s.shot?.agency ?? null,
      postFx: s.postFx?.activeEffectIds ?? [],
      score: s.score ?? null,
      history: s.activationHistoryAnchorIds ?? [],
      reset: s.lastResetReason ?? null
    };
  } catch (e) { out.avError = String(e).slice(0, 120); }
  try {
    const dir = await import('/src/story/emergentStoryDirector.ts');
    out.freePlaySeconds = Math.round(dir.getChapter10FreePlaySeconds());
  } catch (e) { out.dirError = String(e).slice(0, 120); }
  try {
    const flight = await import('/src/state/spaceFlight.ts');
    const f = flight.getSpaceFlightSnapshot();
    out.flight = { phase: f.phase, controlMode: f.controlMode };
  } catch { /* pre-flight beats */ }
  return out;
};

const browser = await chromium.launch({
  executablePath: path.join(pwDir, chromeDir, 'chrome-linux/chrome'),
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720']
});

const report = {
  capturedAt: new Date().toISOString(), base: BASE,
  url: `${BASE}/?story=base&movie=1&profile=LOW`,
  viewport: '1280x720', qualityTier: 'LOW', parallel: PARALLEL,
  beatTimeoutTable: BEAT_TIMEOUT, runs: []
};
const OUT = path.join(OUT_DIR, 'ch10-flow2-trace.json');
const flush = () => fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

async function coldRun(run) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push({ at: Date.now(), text: String(e).slice(0, 200) }));
  const rec = {
    run, startedAt: new Date().toISOString(), beatFirstSeen: {}, beatLastSeen: {},
    beatClockAtExit: {}, anchorFirstSeen: {}, objectiveEvents: [], trace: [], apTrace: [],
    pageErrors, moduleSplitSeen: false, reachedResolved: false, reachedHandback: false,
    timeoutRescues: [], timedOut: false, frozenAutopilot: false
  };
  await page.goto(report.url, { waitUntil: 'load', timeout: 120000 });
  await page.evaluate(TAP).catch(() => {});
  const t0 = Date.now();
  let prevKey = null, prevObjective = null, prevBeat = null, lastClock = null, lastClockChangeT = 0;
  while (true) {
    const elapsed = (Date.now() - t0) / 1000;
    if (elapsed > CAP_SECONDS) { rec.timedOut = true; break; }
    let s;
    try { s = await page.evaluate(READ); } catch (e) { s = { readError: String(e).slice(0, 150) }; }
    const t = Number(elapsed.toFixed(2));
    if (s.moduleSplit) rec.moduleSplitSeen = true;
    if (s.beat) {
      if (!(s.beat in rec.beatFirstSeen)) rec.beatFirstSeen[s.beat] = t;
      rec.beatLastSeen[s.beat] = t;
      // Rescue detection: a beat transition whose outgoing beatClock exceeded
      // that beat's BEAT_TIMEOUT is a timeout rescue, not an honest completion.
      if (prevBeat && s.beat !== prevBeat) {
        const outClock = lastClock ?? null;
        rec.beatClockAtExit[prevBeat] = outClock;
        const to = BEAT_TIMEOUT[prevBeat];
        if (to != null && outClock != null && outClock >= to - 1) {
          rec.timeoutRescues.push({ beat: prevBeat, beatClockAtExit: outClock, timeout: to, t });
        }
      }
      prevBeat = s.beat;
    }
    if (s.autopilot) {
      rec.apTrace.push({ t, beat: s.autopilot.beat, clock: s.autopilot.clock, pos: s.autopilot.pos,
        goal: s.autopilot.goal, keys: s.autopilot.keys, stillTime: s.autopilot.stillTime,
        nudges: s.autopilot.nudges, routeAction: s.autopilot.routeAction,
        routeOutcome: s.autopilot.routeOutcome });
      if (s.autopilot.clock !== lastClock) { lastClockChangeT = elapsed; }
      else if (elapsed - lastClockChangeT > 90) { rec.frozenAutopilot = true; }
      lastClock = s.autopilot.clock;
    }
    for (const a of s.av?.history ?? []) {
      if (!(a in rec.anchorFirstSeen)) rec.anchorFirstSeen[a] = t;
    }
    if (s.objectiveId !== prevObjective) {
      rec.objectiveEvents.push({ t, beat: s.beat, from: prevObjective, to: s.objectiveId,
        markerLabel: s.markerLabel, health: s.health, requiresMarker: s.requiresMarker,
        hudText: s.hudText, cues: s.cues });
      prevObjective = s.objectiveId;
    }
    const key = JSON.stringify([s.beat, s.objectiveId, s.health, s.caption, s.av?.anchorId,
      s.av?.authority, s.av?.fov, s.av?.postFx, s.av?.score, s.flight]);
    if (key !== prevKey) { rec.trace.push({ t, ...s }); prevKey = key; }
    if (s.av?.history?.includes('anc.ch10.station-resolved')) rec.reachedResolved = true;
    if (s.av?.history?.includes('anc.ch10.threshold-handback')) {
      rec.reachedHandback = true;
      rec.handbackAt ??= elapsed;
      if (elapsed > rec.handbackAt + 15) break;
    }
    if (Math.round(elapsed) % 30 === 0) {
      report.runs = [...report.runs.filter(r => r.run !== run), rec];
      flush();
    }
    await new Promise(r => setTimeout(r, POLL_MS));
  }
  rec.durationSeconds = Math.round((Date.now() - t0) / 1000);
  rec.feedbackLog = await page.evaluate(() => window.__voxFeedbackLog ?? []).catch(() => []);
  rec.anchorOrder = Object.entries(rec.anchorFirstSeen)
    .filter(([a]) => a.startsWith('anc.ch10.'))
    .sort((a, b) => a[1] - b[1]).map(([a, t]) => ({ anchor: a, t }));
  rec.seamBeforeResolve = (rec.anchorFirstSeen['anc.ch10.seam-of-light'] ?? Infinity)
    < (rec.anchorFirstSeen['anc.ch10.station-resolved'] ?? Infinity);
  // Keep the file bounded: the per-second autopilot trace is decimated to 5s
  // outside ch10 and kept dense inside it.
  rec.apTrace = rec.apTrace.filter((a, i) => String(a.beat ?? '').startsWith('ch10') || i % 5 === 0);
  await page.close();
  report.runs = report.runs.filter(r => r.run !== run);
  report.runs.push(rec);
  report.runs.sort((a, b) => a.run - b.run);
  flush();
  console.log(`[run ${run}] ${rec.durationSeconds}s beats=${JSON.stringify(rec.beatFirstSeen)}`
    + ` resolved=${rec.reachedResolved} handback=${rec.reachedHandback} rescues=${rec.timeoutRescues.length}`
    + ` timedOut=${rec.timedOut} frozen=${rec.frozenAutopilot} split=${rec.moduleSplitSeen} errs=${pageErrors.length}`);
  return rec;
}

if (PARALLEL) {
  await Promise.all(Array.from({ length: RUNS }, (_, i) => coldRun(i + 1)));
} else {
  for (let run = 1; run <= RUNS; run++) await coldRun(run);
}
await browser.close();
flush();
console.log('wrote', OUT);
