// Stage 6 item 2: ch10 movie-lane cold runs at LOW.
//
// Three cold runs of `?story=base&movie=1&profile=LOW` from ch9-settle through
// `done` free play, the CH10_FREEPLAY_GRACE_SECONDS watch, and all three ch10
// beats to the closing station shot. State trace only: per-beat timings, signed
// AV anchor activation order, objective lifecycle, feedback cues, autopilot
// telemetry and timeout rescues. NO webm, NO movie render (lock evidence
// budget). Frames are captured by the separate strip probe.
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
const CAP_SECONDS = Number(process.env.VOX_CAP ?? 2700);
const POLL_MS = 500;
fs.mkdirSync(OUT_DIR, { recursive: true });

const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter(d => /^chromium-\d+$/.test(d)).sort().pop();

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
  if (ap) out.autopilot = { beat: ap.beat, clock: ap.clock, pos: ap.pos, goal: ap.goal,
    routeAction: ap.routeAction, routeOutcome: ap.routeOutcome };
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
    if (typeof dir.readChapter10ColdEntryFacts === 'function') {
      out.coldFacts = dir.readChapter10ColdEntryFacts();
    }
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

const report = { capturedAt: new Date().toISOString(), base: BASE, url: `${BASE}/?story=base&movie=1&profile=LOW`,
  viewport: '1280x720', qualityTier: 'LOW', runs: [] };
const OUT = path.join(OUT_DIR, 'ch10-flow-trace.json');
const flush = () => fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

for (let run = 1; run <= RUNS; run++) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e).slice(0, 200)));
  const rec = { run, startedAt: new Date().toISOString(), beatFirstSeen: {}, beatLastSeen: {},
    anchorFirstSeen: {}, objectiveEvents: [], trace: [], pageErrors, reachedResolved: false,
    reachedHandback: false, timedOut: false };
  await page.goto(report.url, { waitUntil: 'load', timeout: 90000 });
  await page.evaluate(TAP).catch(() => {});
  const t0 = Date.now();
  let prevKey = null;
  let prevObjective = null;
  while (true) {
    const elapsed = (Date.now() - t0) / 1000;
    if (elapsed > CAP_SECONDS) { rec.timedOut = true; break; }
    let s;
    try { s = await page.evaluate(READ); } catch (e) { s = { readError: String(e).slice(0, 150) }; }
    const t = Number(elapsed.toFixed(2));
    if (s.beat) {
      if (!(s.beat in rec.beatFirstSeen)) rec.beatFirstSeen[s.beat] = t;
      rec.beatLastSeen[s.beat] = t;
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
    else if (Math.round(elapsed) % 30 === 0 && elapsed % 1 < 0.5) {
      rec.trace.push({ t, beat: s.beat, freePlaySeconds: s.freePlaySeconds, autopilot: s.autopilot, sample: 'heartbeat' });
    }
    if (s.av?.history?.includes('anc.ch10.station-resolved')) rec.reachedResolved = true;
    if (s.av?.history?.includes('anc.ch10.threshold-handback')) {
      rec.reachedHandback = true;
      if (elapsed > (rec.handbackAt ?? 0) + 12) break;
      rec.handbackAt ??= elapsed;
    }
    if (Math.round(elapsed) % 20 === 0 && elapsed % 1 < 0.5) {
      report.runs = [...report.runs.filter(r => r.run !== run), rec];
      flush();
    }
    await new Promise(r => setTimeout(r, POLL_MS));
  }
  report.runs = report.runs.filter(r => r.run !== run);
  rec.durationSeconds = Math.round((Date.now() - t0) / 1000);
  rec.feedbackLog = await page.evaluate(() => window.__voxFeedbackLog ?? []).catch(() => []);
  rec.anchorOrder = Object.entries(rec.anchorFirstSeen)
    .filter(([a]) => a.startsWith('anc.ch10.'))
    .sort((a, b) => a[1] - b[1]).map(([a, t]) => ({ anchor: a, t }));
  rec.seamBeforeResolve = (rec.anchorFirstSeen['anc.ch10.seam-of-light'] ?? Infinity)
    < (rec.anchorFirstSeen['anc.ch10.station-resolved'] ?? Infinity);
  await page.close();
  report.runs.push(rec);
  flush();
  console.log(`[run ${run}] ${rec.durationSeconds}s beats=${JSON.stringify(rec.beatFirstSeen)} resolved=${rec.reachedResolved} handback=${rec.reachedHandback} timedOut=${rec.timedOut} errs=${pageErrors.length}`);
}
await browser.close();
flush();
console.log('wrote', OUT);
