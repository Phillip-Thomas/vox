// D-5 residual: the movie lane's ch10-ask return crossing flies but never
// settles — the trace alternates deep_space / descent / surface instead of
// landing at the wreck and walking to the relay.
//
// This probe samples the DECISION INPUTS at 1 Hz, not just the symptom: which
// world is the enclosing body, which flight phase and control mode the ship is
// in, which virtual controls the pilot is asserting, and which ladder rung is
// published. The branch that fires is then readable directly off the table.
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
const { chromium } = await import(
  '/home/thomasphillip/Projects/vox/main/node_modules/playwright-core/index.mjs'
);

const RUN_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT_DIR = path.join(RUN_DIR, 'evidence', 'verification');
const BASE = process.env.VOX_BASE ?? 'http://localhost:5176';
const WATCH = Number(process.env.VOX_WATCH ?? 200);
const RUNS = Number(process.env.VOX_RUNS ?? 1);
fs.mkdirSync(OUT_DIR, { recursive: true });
const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter(d => /^chromium-\d+$/.test(d)).sort().pop();

// MODULE IDENTITY, not module path: after a source edit the dev server serves
// the edited modules under HMR-timestamped URLs inside the app's own graph, and
// a bare dynamic import of the same path yields a second, pristine instance
// that describes a runtime nobody is playing.
// Specifiers are resolved ONCE per page and the module namespaces cached on
// window: re-reading App.tsx and re-importing four modules on every 1 Hz sample
// made the loop cost more than the interval and the probe never finished its
// own watch window.
const INSTALL = async () => {
  const appSource = await (await fetch('/src/App.tsx')).text();
  const spec = (needle) => {
    const m = appSource.match(new RegExp('from\\s*["\']([^"\']*' + needle + '[^"\']*)["\']'));
    if (!m) throw new Error('unresolved specifier ' + needle);
    return m[1];
  };
  window.__askProbe = {
    flight: await import(/* @vite-ignore */ spec('spaceFlight\\.ts')),
    system: await import(/* @vite-ignore */ spec('systemFlight\\.ts')),
    relay: await import('/src/story/world/WreckRelay.tsx'),
    world: await import('/src/story/world/storyWorld.ts'),
    story: await import(/* @vite-ignore */ spec('storyState\\.ts')),
    progression: await import(/* @vite-ignore */ spec('progressionSystem\\.ts'))
  };
  return true;
};

const SAMPLE = () => {
  const w = window;
  const mods = w.__askProbe;
  if (!mods) return { sampleError: 'probe modules not installed' };
  const f = mods.flight.getSpaceFlightSnapshot();
  const s = mods.system.getSystemFlightSnapshot();
  const snap = mods.story.getStoryStateSnapshot();
  const ap = w.__autopilot ?? null;
  const hud = document.querySelector('[data-story-guidance-hud]');
  const milestones = {};
  for (const [key, id] of Object.entries({
    asked: 'story:ch10-relay-asked',
    answered: 'story:ch10-relay-answered',
    claimed: 'story:ch10-bearing-claimed',
    ignited: 'story:ch10-transit-ignited',
    seam: 'story:ch10-seam-passed',
    resolved: 'story:ch10-station-resolved',
    complete: 'story:ch10-complete'
  })) milestones[key] = mods.progression.hasMilestone(id);
  // D-12 instrumentation: requestLanding() refuses SILENTLY unless the ship is
  // essentially over a valid egress site (findValidSpawnSite with
  // maxSearchRadius 0). Where the crossing enters the atmosphere is wherever
  // the planet-centre bearing pointed, so the landing leg's success is a
  // function of arrival POSITION, not of elapsed time. Sample that position
  // against the wreck site the contract tells the pilot to land near.
  let landing = null;
  try {
    const relayPos = mods.relay.wreckRelayHandle?.position ?? null;
    const shipVec = s.pose.position;
    const anchors = mods.world.storyAnchors;
    landing = {
      relayResolved: Boolean(relayPos),
      relay: relayPos ? [Math.round(relayPos.x), Math.round(relayPos.y), Math.round(relayPos.z)] : null,
      planetSize: anchors?.planetSize ?? null,
      terrainSeed: anchors?.terrainSeed ?? null,
      shipAltitude: Math.round(Math.hypot(shipVec[0], shipVec[1], shipVec[2])),
      shipToRelay: relayPos
        ? Math.round(Math.hypot(shipVec[0] - relayPos.x, shipVec[1] - relayPos.y, shipVec[2] - relayPos.z))
        : null
    };
  } catch (e) { landing = { error: String(e).slice(0, 120) }; }
  return {
    beat: snap.beat,
    landing,
    phase: f.phase,
    controlMode: f.controlMode,
    activePlanetId: s.activePlanetId,
    locationMode: s.locationMode,
    targetKind: s.target?.kind ?? null,
    shipPos: s.pose.position.map(v => Math.round(v)),
    controls: ap ? {
      jump: ap.controls?.jump ?? null,
      forward: ap.controls?.forward ?? null,
      interact: ap.controls?.interact ?? null
    } : null,
    playerPos: ap?.pos ?? null,
    objectiveId: hud?.getAttribute('data-objective-id') ?? null,
    objectiveHealth: hud?.getAttribute('data-objective-health') ?? null,
    milestones
  };
};

const browser = await chromium.launch({
  executablePath: path.join(pwDir, chromeDir, 'chrome-linux/chrome'),
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720']
});

const report = { capturedAt: new Date().toISOString(), base: BASE, watchSeconds: WATCH, runs: [] };
const OUT = path.join(OUT_DIR, 'ch10-ask-leg-trace.json');
const flush = () => fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');

for (let run = 1; run <= RUNS; run++) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
  await page.goto(`${BASE}/?story=ch10-ask&movie=1&profile=LOW`, { waitUntil: 'load', timeout: 120000 });
  await new Promise(r => setTimeout(r, 12000));
  await page.evaluate(INSTALL);
  const samples = [];
  const t0 = Date.now();
  let landedOnOrigin = false;
  let onFootOnOrigin = false;
  let relayAsked = false;
  let claimed = false;
  while ((Date.now() - t0) / 1000 < WATCH) {
    const d = await page.evaluate(SAMPLE).catch(err => ({ sampleError: String(err).slice(0, 200) }));
    d.t = Number(((Date.now() - t0) / 1000).toFixed(1));
    samples.push(d);
    if (d.activePlanetId === '-1,-1' && d.phase === 'surface') landedOnOrigin = true;
    if (landedOnOrigin && d.controlMode === 'fps') onFootOnOrigin = true;
    if (d.milestones?.asked) relayAsked = true;
    if (d.milestones?.claimed) claimed = true;
    // D-13: the FLOW enters ch10-transit on foot at the relay, where the deep
    // link seeds the pilot already in flight. Keep watching past the claim so
    // the on-foot reboard, the ignite and the seam are all in one trace.
    if (d.milestones?.seam || d.milestones?.resolved) break;
    await new Promise(r => setTimeout(r, 1000));
  }
  const phases = samples.map(s => s.phase);
  const transitions = [];
  for (let i = 1; i < phases.length; i++) {
    if (phases[i] !== phases[i - 1]) transitions.push(`${samples[i].t}s ${phases[i - 1]}->${phases[i]}`);
  }
  report.runs.push({
    run,
    url: '?story=ch10-ask&movie=1&profile=LOW',
    completed: claimed,
    milestones: { landedOnOrigin, onFootOnOrigin, relayAsked, claimed },
    transit: {
      ignited: samples.some(s => s.milestones?.ignited),
      seamPassed: samples.some(s => s.milestones?.seam),
      stationResolved: samples.some(s => s.milestones?.resolved),
      enteredTransitOnFoot: samples.some(s => s.beat === 'ch10-transit' && s.controlMode === 'fps'),
      boardedInTransit: samples.some(s => s.beat === 'ch10-transit' && s.controlMode === 'flight')
    },
    phaseTransitions: transitions,
    distinctPhases: [...new Set(phases.filter(Boolean))],
    objectiveIds: [...new Set(samples.map(s => s.objectiveId).filter(Boolean))],
    worstObjectiveHealth: samples.some(s => s.objectiveHealth === 'missing-marker')
      ? 'missing-marker'
      : 'ready',
    samples,
    pageErrors: errs
  });
  flush();
  const last = samples.at(-1);
  console.log(`[run ${run}] claimed=${claimed} landedOnOrigin=${landedOnOrigin} onFoot=${onFootOnOrigin}`
    + ` asked=${relayAsked} transitions=${transitions.length} lastPhase=${last?.phase}`
    + ` lastWorld=${last?.activePlanetId} lastRung=${last?.objectiveId}`);
  await page.close();
}

await browser.close();
flush();
console.log('wrote', OUT);
