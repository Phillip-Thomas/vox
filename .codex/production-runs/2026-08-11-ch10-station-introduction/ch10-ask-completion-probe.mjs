// D-5 closure item 1: three COLD movie-lane runs of the ch10-ask return
// crossing, from the Tidegarden launch to the bearing claim on the origin
// world, with per-leg timings.
//
// Legs, each detected from state (never from a wall clock):
//   boarded            controlMode 'flight' while still on the surface
//   launched           phase leaves 'surface'
//   left-atmosphere    phase 'deep_space'
//   target-acquired    systemFlight.target published
//   descent            phase 'descent' with the origin enclosing the ship
//   landfall           phase 'surface' AND activePlanetId '-1,-1'
//   relay-query-ready  the relay rung standing with a resolved marker
//   relay-ask/answer   the signed anchors
//   bearing-claimed    the anchor, and the beat handing off to ch10-transit
//
// State only, no frames (the strip probe captures those). One browser, one page
// per run, fresh context per run.
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
const CAP = Number(process.env.VOX_CAP ?? 900);
fs.mkdirSync(OUT_DIR, { recursive: true });
const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter(d => /^chromium-\d+$/.test(d)).sort().pop();

const CH10_ASK_TIMEOUT = 320; // main/src/story/autopilot.ts BEAT_TIMEOUT

const TAP = async () => {
  if (window.__voxTap) return true;
  const cues = await import('/src/story/ux/feedbackCues.ts');
  window.__voxFeedbackLog = [];
  window.__voxTap = cues.subscribeStoryUxFeedback(cue => {
    window.__voxFeedbackLog.push({ at: Math.round(performance.now()), cue, beat: window.__storyBeat ?? null });
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
  if (ap) out.autopilot = { beat: ap.beat, clock: ap.clock, pos: ap.pos,
    keys: Object.entries(ap.controls ?? {}).filter(([, v]) => v === true).map(([k]) => k),
    stillTime: ap.stillTime, nudges: ap.nudges, teleportNudgesTotal: ap.teleportNudgesTotal };
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
      pos: (v.pose?.position ?? []).map(n => Math.round(n)) };
  } catch { /* ignore */ }
  try {
    const av = await import('/src/story/signedSceneAvRuntime.ts');
    const s = av.getSignedSceneAvDebugSnapshot();
    out.av = { anchorId: s.anchorId, history: s.activationHistoryAnchorIds ?? [],
      authority: s.shot?.cameraAuthority ?? null, fov: s.shot?.lens?.appliedFovDeg ?? null };
  } catch { /* ignore */ }
  try {
    const st = await import('/src/story/storyState.ts');
    const prog = await import('/src/game/systems/progressionSystem.ts');
    out.milestones = {
      relayAsked: prog.hasMilestone(st.STORY_MILESTONES.ch10RelayAsked),
      relayAnswered: prog.hasMilestone(st.STORY_MILESTONES.ch10RelayAnswered),
      bearingClaimed: prog.hasMilestone(st.STORY_MILESTONES.ch10BearingClaimed)
    };
    const snap = st.getStoryStateSnapshot();
    out.moduleSplit = !!(w.__storyBeat && snap.beat && snap.beat !== w.__storyBeat);
  } catch { /* ignore */ }
  try {
    const relay = await import('/src/story/world/WreckRelay.tsx');
    const p = relay.wreckRelayHandle?.position;
    out.relayHandle = p ? [Math.round(p.x), Math.round(p.y), Math.round(p.z)] : null;
  } catch { /* ignore */ }
  return out;
};

const browser = await chromium.launch({
  executablePath: path.join(pwDir, chromeDir, 'chrome-linux/chrome'),
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720']
});

const report = { capturedAt: new Date().toISOString(), base: BASE,
  url: `${BASE}/?story=ch10-ask&movie=1&profile=LOW`, beatTimeoutSeconds: CH10_ASK_TIMEOUT, runs: [] };
const OUT = path.join(OUT_DIR, 'ch10-ask-completion.json');
const flush = () => fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');

const LEGS = [
  ['boarded', s => s.flight?.controlMode === 'flight'],
  ['launched', s => s.flight?.controlMode === 'flight' && s.flight?.phase !== 'surface'],
  ['left-atmosphere', s => s.flight?.phase === 'deep_space'],
  ['target-acquired', s => !!s.system?.targetWorldId],
  ['descent-to-origin', s => s.flight?.phase === 'descent' && s.system?.activePlanetId === '-1,-1'],
  ['landfall-origin', s => s.flight?.phase === 'surface' && s.system?.activePlanetId === '-1,-1'],
  ['relay-handle-resolved', s => !!s.relayHandle],
  ['relay-query-rung', s => s.objectiveId === 'station:relay-query'],
  ['anchor-relay-ask', s => (s.av?.history ?? []).includes('anc.ch10.relay-ask')],
  ['anchor-relay-answer', s => (s.av?.history ?? []).includes('anc.ch10.relay-answer')],
  ['bearing-claim-rung', s => s.objectiveId === 'station:bearing-claim'],
  ['anchor-bearing-claimed', s => (s.av?.history ?? []).includes('anc.ch10.bearing-claimed')],
  ['beat-ch10-transit', s => s.beat === 'ch10-transit']
];

for (let run = 1; run <= RUNS; run++) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const pageErrors = [];
  let rendererLost = false;
  page.on('pageerror', e => pageErrors.push(String(e).slice(0, 180)));
  page.on('crash', () => { rendererLost = true; });
  const rec = { run, startedAt: new Date().toISOString(), legs: {}, legBeatClock: {},
    objectiveEvents: [], trace: [], pageErrors, rendererLost: false, moduleSplitSeen: false,
    completed: false, timeoutRescue: false };
  await page.goto(report.url, { waitUntil: 'load', timeout: 120000 });
  await page.evaluate(TAP).catch(() => {});
  const t0 = Date.now();
  let prevObjective = null, prevKey = null, lastBeatClock = null;
  while ((Date.now() - t0) / 1000 < CAP) {
    let s;
    try { s = await page.evaluate(READ); }
    catch (e) {
      if (/crash|Target closed|detached/i.test(String(e))) { rec.rendererLost = true; break; }
      await new Promise(r => setTimeout(r, 500));
      continue;
    }
    const t = Number(((Date.now() - t0) / 1000).toFixed(2));
    if (s.moduleSplit) rec.moduleSplitSeen = true;
    if (s.autopilot?.beat === 'ch10-ask') lastBeatClock = s.autopilot.clock;
    for (const [name, pred] of LEGS) {
      if (!(name in rec.legs) && pred(s)) {
        rec.legs[name] = t;
        rec.legBeatClock[name] = s.autopilot?.clock ?? null;
      }
    }
    if (s.objectiveId !== prevObjective) {
      rec.objectiveEvents.push({ t, beatClock: s.autopilot?.clock ?? null, beat: s.beat,
        from: prevObjective, to: s.objectiveId, markerLabel: s.markerLabel, health: s.health,
        requiresMarker: s.requiresMarker, hudText: s.hudText, cues: s.cues });
      prevObjective = s.objectiveId;
    }
    const key = JSON.stringify([s.beat, s.objectiveId, s.health, s.flight, s.system?.locationMode,
      s.system?.activePlanetId, s.system?.targetWorldId, s.av?.anchorId, s.caption]);
    if (key !== prevKey) { rec.trace.push({ t, ...s }); prevKey = key; }
    if ('beat-ch10-transit' in rec.legs && 'anchor-bearing-claimed' in rec.legs) {
      rec.completed = true;
      if (t > rec.legs['beat-ch10-transit'] + 8) break;
    }
    await new Promise(r => setTimeout(r, 700));
  }
  rec.durationSeconds = Math.round((Date.now() - t0) / 1000);
  rec.askBeatClockAtClaim = rec.legBeatClock['anchor-bearing-claimed'] ?? lastBeatClock;
  rec.timeoutRescue = (rec.askBeatClockAtClaim ?? 0) >= CH10_ASK_TIMEOUT - 1;
  rec.feedbackLog = await page.evaluate(() => window.__voxFeedbackLog ?? []).catch(() => []);
  rec.legDurations = (() => {
    const names = LEGS.map(l => l[0]).filter(n => n in rec.legs);
    const out = {};
    names.forEach((n, i) => {
      const prev = i === 0 ? 0 : rec.legs[names[i - 1]];
      out[n] = Number((rec.legs[n] - prev).toFixed(2));
    });
    return out;
  })();
  await page.close();
  await context.close();
  report.runs.push(rec);
  flush();
  console.log(`[ask run ${run}] ${rec.durationSeconds}s completed=${rec.completed}`
    + ` claimBeatClock=${rec.askBeatClockAtClaim} rescue=${rec.timeoutRescue}`
    + ` legs=${Object.keys(rec.legs).length}/${LEGS.length} errs=${pageErrors.length}`
    + ` rendererLost=${rec.rendererLost}`);
}

await browser.close();
report.allCompleted = report.runs.every(r => r.completed);
report.anyRescue = report.runs.some(r => r.timeoutRescue);
flush();
console.log('wrote', OUT);
