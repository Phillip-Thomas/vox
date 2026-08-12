// Final proof pass. Every module is read through the APP'S OWN (HMR-timestamped)
// specifier — bare '/src/...' imports return dead second instances after the
// repairs and have already produced one round of phantom readings.
//
// Modes:
//   --mode=ask               three cold ch10-ask return crossings, per-leg timings
//   --mode=transit-deeplink  ch10-transit from a deep link, with the standoff /
//                            2500 ms hold / K11 / hand-back tail measured at 300 ms
//   --mode=transit-flow      the same tail, entered from ch10-ask (flow path)
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
const { chromium } = await import(
  '/home/thomasphillip/Projects/vox/main/node_modules/playwright-core/index.mjs'
);

const RUN_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT_DIR = path.join(RUN_DIR, 'evidence', 'verification');
const BASE = process.env.VOX_BASE ?? 'http://localhost:5176';
const MODE = (process.argv.find(a => a.startsWith('--mode=')) ?? '--mode=ask').split('=')[1];
const RUNS = Number(process.env.VOX_RUNS ?? 3);
const CAP = Number(process.env.VOX_CAP ?? 900);
fs.mkdirSync(OUT_DIR, { recursive: true });
const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter(d => /^chromium-\d+$/.test(d)).sort().pop();

const ASK_TIMEOUT = 320, TRANSIT_TIMEOUT = 260, HOLD_DURATION_MS = 2500, STANDOFF = 1500;

const RESOLVE = async () => {
  const hosts = ['/src/App.tsx', '/src/story/StoryDirectorDriver.tsx',
    '/src/story/emergentStoryDirector.ts', '/src/components/ShipController.tsx',
    '/src/components/SystemCompanionBodies.tsx', '/src/story/autopilot.ts',
    '/src/story/storyDirector.ts'];
  const want = {
    autopilot: /\/autopilot\.ts/, signedAv: /signedSceneAvRuntime\.ts/,
    spaceFlight: /state\/spaceFlight\.ts/, systemFlight: /state\/systemFlight\.ts/,
    storyState: /story\/storyState\.ts/, progression: /progressionSystem\.ts/,
    score: /emergentScoreDirector\.ts/, relay: /world\/WreckRelay\.tsx/,
    director: /emergentStoryDirector\.ts/, cues: /ux\/feedbackCues\.ts/
  };
  const found = {};
  for (const h of hosts) {
    let src;
    try { src = await (await fetch(h)).text(); } catch { continue; }
    for (const [key, re] of Object.entries(want)) {
      if (found[key]) continue;
      for (const m of src.matchAll(/from\s*["']([^"']+)["']/g)) {
        if (re.test(m[1])) { found[key] = m[1]; break; }
      }
    }
  }
  window.__voxSpec = found;
  if (!window.__voxTap && found.cues) {
    const cues = await import(/* @vite-ignore */ found.cues);
    window.__voxFeedbackLog = [];
    window.__voxTap = cues.subscribeStoryUxFeedback(c => {
      window.__voxFeedbackLog.push({ at: Math.round(performance.now()), cue: c,
        beat: window.__storyBeat ?? null });
    });
  }
  return found;
};

const READ = async () => {
  const w = window;
  const spec = w.__voxSpec ?? {};
  const imp = async (k) => (spec[k] ? import(/* @vite-ignore */ spec[k]) : null);
  const hud = document.querySelector('[data-story-guidance-hud]');
  const caption = document.querySelector('[data-story-caption]');
  const out = {
    wallMs: Math.round(performance.now()),
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
    const f = await imp('spaceFlight');
    if (f) { const s = f.getSpaceFlightSnapshot(); out.flight = { phase: s.phase, controlMode: s.controlMode }; }
  } catch { /* ignore */ }
  try {
    const s = await imp('systemFlight');
    if (s) {
      const v = s.getSystemFlightSnapshot();
      out.system = { activePlanetId: v.activePlanetId, locationMode: v.locationMode,
        targetKind: v.target?.kind ?? null, targetWorldId: v.target?.worldId ?? null,
        pos: (v.pose?.position ?? []).map(n => Math.round(n)),
        quat: (v.pose?.quaternion ?? []).map(n => Number(n.toFixed(4))),
        speed: Math.round(Math.hypot(...(v.pose?.velocity ?? [0, 0, 0])) * 100) / 100 };
    }
  } catch { /* ignore */ }
  try {
    const ap = await imp('autopilot');
    if (ap) {
      const d = ap.getAutopilotFlightDirective();
      const tsp = d.targetSystemPosition;
      out.directive = { active: d.active, beat: d.beat, targetWorldId: d.targetWorldId ?? null,
        targetSystemPosition: tsp
          ? (Array.isArray(tsp) ? tsp.map(n => Math.round(n))
            : [Math.round(tsp.x), Math.round(tsp.y), Math.round(tsp.z)]) : null,
        keys: Object.entries(d.controls ?? {}).filter(([, v]) => v === true).map(([k]) => k) };
    }
  } catch (e) { out.directiveError = String(e).slice(0, 120); }
  try {
    const av = await imp('signedAv');
    if (av) {
      const s = av.getSignedSceneAvDebugSnapshot();
      out.av = { active: s.active, beat: s.beat, anchorId: s.anchorId,
        history: s.activationHistoryAnchorIds ?? [],
        authority: s.shot?.cameraAuthority ?? null, fov: s.shot?.lens?.appliedFovDeg ?? null,
        agency: s.shot?.agency ?? null, postFx: s.postFx?.activeEffectIds ?? [],
        reset: s.lastResetReason ?? null };
    }
  } catch { /* ignore */ }
  try {
    const st = await imp('storyState'); const pr = await imp('progression');
    if (st && pr) out.milestones = {
      relayAsked: pr.hasMilestone(st.STORY_MILESTONES.ch10RelayAsked),
      relayAnswered: pr.hasMilestone(st.STORY_MILESTONES.ch10RelayAnswered),
      bearingClaimed: pr.hasMilestone(st.STORY_MILESTONES.ch10BearingClaimed),
      transitIgnited: pr.hasMilestone(st.STORY_MILESTONES.ch10TransitIgnited),
      seamPassed: pr.hasMilestone(st.STORY_MILESTONES.ch10SeamPassed),
      stationResolved: pr.hasMilestone(st.STORY_MILESTONES.ch10StationResolved),
      ch10Complete: pr.hasMilestone(st.STORY_MILESTONES.ch10Complete)
    };
  } catch { /* ignore */ }
  try {
    const sc = await imp('score');
    if (sc) out.score = sc.getChapter10ScoreSnapshot();
  } catch { /* ignore */ }
  try {
    const r = await imp('relay');
    const p = r?.wreckRelayHandle?.position;
    out.relayHandle = p ? [Math.round(p.x), Math.round(p.y), Math.round(p.z)] : null;
  } catch { /* ignore */ }
  out.contacts = w.__spaceStationContacts ? w.__spaceStationContacts() : null;
  const ap2 = w.__autopilot;
  if (ap2) out.autopilot = { beat: ap2.beat, clock: ap2.clock, pos: ap2.pos,
    keys: Object.entries(ap2.controls ?? {}).filter(([, v]) => v === true).map(([k]) => k),
    stillTime: ap2.stillTime, teleportNudgesTotal: ap2.teleportNudgesTotal };
  return out;
};

const browser = await chromium.launch({
  executablePath: path.join(pwDir, chromeDir, 'chrome-linux/chrome'),
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720']
});

const report = { capturedAt: new Date().toISOString(), base: BASE, mode: MODE,
  constants: { ASK_TIMEOUT, TRANSIT_TIMEOUT, HOLD_DURATION_MS, STANDOFF }, runs: [] };
const OUT = path.join(OUT_DIR, `ch10-final-${MODE}.json`);
const flush = () => fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');

const ASK_LEGS = [
  ['boarded', s => s.flight?.controlMode === 'flight'],
  ['launched', s => s.flight?.controlMode === 'flight' && s.flight?.phase !== 'surface'],
  ['left-atmosphere', s => s.flight?.phase === 'deep_space'],
  ['target-acquired', s => !!s.system?.targetWorldId],
  ['world-handoff-to-origin', s => s.system?.activePlanetId === '-1,-1'],
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

const TRANSIT_LEGS = [
  // D-13 stamp: the flow enters ch10-transit ON FOOT at the wreck relay. These
  // two legs are the boarding proof; on the deep link the pilot is seeded in
  // flight so 'transit-entered-on-foot' never fires and 'transit-boarded' fires
  // at once. Neither gates completion (the final leg is 'guidance-cleared').
  ['transit-entered-on-foot', s => s.beat === 'ch10-transit' && s.flight?.controlMode === 'fps'],
  ['transit-boarded', s => s.beat === 'ch10-transit' && s.flight?.controlMode === 'flight'],
  ['ignited', s => s.milestones?.transitIgnited === true],
  ['anchor-transit-ignite', s => (s.av?.history ?? []).includes('anc.ch10.transit-ignite')],
  ['bearing-attitude-published', s => !!s.directive?.targetSystemPosition],
  ['seam-milestone', s => s.milestones?.seamPassed === true],
  ['anchor-seam-of-light', s => (s.av?.history ?? []).includes('anc.ch10.seam-of-light')],
  ['T3-resolving-rung', s => s.objectiveId === 'station:transit:resolve'],
  ['standoff-reached', s => (s.contacts?.stations?.[0]?.distance ?? 1e9) <= STANDOFF],
  ['station-resolved-milestone', s => s.milestones?.stationResolved === true],
  ['anchor-station-resolved', s => (s.av?.history ?? []).includes('anc.ch10.station-resolved')],
  ['k11-painted', s => (s.caption ?? '').includes('both fires behind you')],
  ['anchor-threshold-handback', s => (s.av?.history ?? []).includes('anc.ch10.threshold-handback')],
  ['guidance-cleared', s => !s.objectiveId && (s.av?.history ?? []).includes('anc.ch10.threshold-handback')]
];

async function drive(id, url, legs, opts = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e).slice(0, 180)));
  const rec = { id, url, startedAt: new Date().toISOString(), legs: {}, legBeatClock: {},
    legWallMs: {}, objectiveEvents: [], trace: [], pageErrors, completed: false };
  await page.goto(`${BASE}/${url}`, { waitUntil: 'load', timeout: 120000 });
  await page.evaluate(RESOLVE).catch(e => rec.resolveError = String(e).slice(0, 140));
  rec.specifiers = await page.evaluate(() => window.__voxSpec ?? null).catch(() => null);
  const t0 = Date.now();
  let prevObjective = null, prevKey = null, lastClock = null;
  const finalLeg = legs[legs.length - 1][0];
  // Fast sampling once the resolve is near, so the 2500 ms hold is measured.
  while ((Date.now() - t0) / 1000 < CAP) {
    let s;
    try { s = await page.evaluate(READ); } catch (e) { rec.readError = String(e).slice(0, 160); break; }
    const t = Number(((Date.now() - t0) / 1000).toFixed(3));
    if (s.autopilot?.clock != null) lastClock = s.autopilot.clock;
    for (const [name, pred] of legs) {
      if (!(name in rec.legs) && pred(s)) {
        rec.legs[name] = t;
        rec.legBeatClock[name] = s.autopilot?.clock ?? null;
        rec.legWallMs[name] = s.wallMs;
        rec.trace.push({ t, marker: `LEG:${name}`, ...s });
      }
    }
    if (s.objectiveId !== prevObjective) {
      rec.objectiveEvents.push({ t, beatClock: s.autopilot?.clock ?? null, beat: s.beat,
        from: prevObjective, to: s.objectiveId, markerLabel: s.markerLabel, health: s.health,
        requiresMarker: s.requiresMarker, hudText: s.hudText, caption: s.caption, cues: s.cues });
      prevObjective = s.objectiveId;
    }
    const key = JSON.stringify([s.beat, s.objectiveId, s.health, s.flight, s.system?.activePlanetId,
      s.system?.targetWorldId, s.av?.anchorId, s.caption, s.milestones, s.score?.variant]);
    if (key !== prevKey) { rec.trace.push({ t, ...s }); prevKey = key; }
    if (finalLeg in rec.legs) { rec.completed = true; if (t > rec.legs[finalLeg] + (opts.tailSeconds ?? 10)) break; }
    const nearResolve = ('anchor-station-resolved' in rec.legs) || ('standoff-reached' in rec.legs)
      || ('bearing-claim-rung' in rec.legs);
    await new Promise(r => setTimeout(r, nearResolve ? 250 : 700));
  }
  rec.durationSeconds = Number(((Date.now() - t0) / 1000).toFixed(1));
  rec.lastBeatClock = lastClock;
  rec.feedbackLog = await page.evaluate(() => window.__voxFeedbackLog ?? []).catch(() => []);
  rec.legDurations = (() => {
    const names = legs.map(l => l[0]).filter(n => n in rec.legs);
    const out = {}; let prev = 0;
    for (const n of names) { out[n] = Number((rec.legs[n] - prev).toFixed(2)); prev = rec.legs[n]; }
    return out;
  })();
  // The contract's tail terms, measured.
  if ('anchor-station-resolved' in rec.legs && 'anchor-threshold-handback' in rec.legs) {
    rec.holdMeasuredMs = rec.legWallMs['anchor-threshold-handback'] - rec.legWallMs['anchor-station-resolved'];
    rec.holdSpecMs = HOLD_DURATION_MS;
    rec.holdWithinSamplingTolerance = Math.abs(rec.holdMeasuredMs - HOLD_DURATION_MS) <= 600;
  }
  const resolvedSample = rec.trace.find(x => x.marker === 'LEG:anchor-station-resolved');
  if (resolvedSample) {
    rec.standoffAtResolve = resolvedSample.contacts?.stations?.[0]?.distance ?? null;
    rec.standoffSpec = STANDOFF;
    rec.fovAtResolve = resolvedSample.av?.fov ?? null;
    rec.authorityAtResolve = resolvedSample.av?.authority ?? null;
    rec.scoreVariantAtResolve = resolvedSample.score?.variant ?? null;
    rec.scoreIntensityAtResolve = resolvedSample.score?.intensity ?? null;
  }
  // Resolve quantize: anchor -> score variant change.
  const vIdx = rec.trace.findIndex(x => x.score?.variant === 'station-resolved');
  if (resolvedSample && vIdx >= 0) {
    rec.resolveQuantizeMs = rec.trace[vIdx].wallMs - resolvedSample.wallMs;
  }
  const k11 = rec.trace.find(x => (x.caption ?? '').includes('both fires behind you'));
  if (resolvedSample && k11) rec.k11DelayMs = k11.wallMs - resolvedSample.wallMs;
  await page.close();
  await context.close();
  report.runs.push(rec);
  flush();
  console.log(`[${id}] ${rec.durationSeconds}s completed=${rec.completed}`
    + ` legs=${Object.keys(rec.legs).length}/${legs.length}`
    + ` hold=${rec.holdMeasuredMs ?? '-'}ms standoff=${rec.standoffAtResolve ?? '-'}`
    + ` quantize=${rec.resolveQuantizeMs ?? '-'}ms errs=${pageErrors.length}`);
  return rec;
}

if (MODE === 'ask') {
  for (let i = 1; i <= RUNS; i++) {
    await drive(`ask-cold-${i}`, '?story=ch10-ask&movie=1&profile=LOW', ASK_LEGS, { tailSeconds: 8 });
  }
  const done = report.runs.filter(r => r.completed);
  report.summary = {
    coldRuns: report.runs.length, completed: done.length,
    claimBeatClock: report.runs.map(r => r.legBeatClock['anchor-bearing-claimed'] ?? null),
    askTimeout: ASK_TIMEOUT,
    rescues: report.runs.filter(r => (r.legBeatClock['anchor-bearing-claimed'] ?? 0) >= ASK_TIMEOUT - 1).length,
    perLegWallSeconds: report.runs.map(r => r.legDurations),
    totalWallSeconds: report.runs.map(r => r.durationSeconds)
  };
} else if (MODE === 'transit-deeplink') {
  await drive('transit-deeplink', '?story=ch10-transit&movie=1&profile=LOW', TRANSIT_LEGS, { tailSeconds: 20 });
} else if (MODE === 'full') {
  // The whole-game movie lane: ch9-settle -> done -> ch10 -> hand-back.
  const FULL_LEGS = [
    ['beat-ch9-hearth', s => s.beat === 'ch9-hearth'],
    ['beat-done', s => s.beat === 'done'],
    ['beat-ch10-cold', s => s.beat === 'ch10-cold'],
    ['beat-ch10-ask', s => s.beat === 'ch10-ask'],
    ...ASK_LEGS.filter(l => !['boarded', 'launched'].includes(l[0])),
    ...TRANSIT_LEGS
  ];
  await drive('full-cold-run', '?story=base&movie=1&profile=LOW', FULL_LEGS, { tailSeconds: 20 });
} else if (MODE === 'transit-flow') {
  // Enter through ch10-ask so the transit is reached the way the flow reaches it.
  await drive('transit-from-flow', '?story=ch10-ask&movie=1&profile=LOW',
    [...ASK_LEGS, ...TRANSIT_LEGS], { tailSeconds: 20 });
}
flush();
await browser.close();
console.log('wrote', OUT);
