// Owner-reported defect (lock revision R6): chapter 10 booted on the ORIGIN
// world, so the sibling planet's own shell was drawn full-size around the
// player's head, the ground under her feet resolved as a lockable system body,
// and both surface beats ran on the wrong terrain seed.
//
// This probe is the causal proof, before and after: for every ch10 beat plus a
// ch9 regression it records the boot-world decision, the resident world the
// runtime actually mounted, the terrain seed, every companion body's render
// placement through the shipped celestial probe, and the on-screen lock chip.
// Pure state and DOM text — no frames, per the run's evidence budget.
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

const TIDEGARDEN = { worldId: '-1,-1:p1', seed: 1600321158 };
const ORIGIN_SEED_OBSERVED_IN_DEFECT = 3215739679;

const READ = async () => {
  const out = {};
  const w = window;
  // MODULE IDENTITY, not module path. After a source edit the dev server serves
  // the edited modules under HMR-timestamped URLs inside the app's own graph; a
  // bare dynamic import of the same path yields a SECOND, pristine instance and
  // every reading below would describe a runtime nobody is playing. Resolve the
  // exact specifiers App.tsx was rewritten to use.
  const appSource = await (await fetch('/src/App.tsx')).text();
  const spec = (needle) => {
    const match = appSource.match(new RegExp('from\\s*["\']([^"\']*' + needle + '[^"\']*)["\']'));
    if (!match) throw new Error('could not resolve app specifier for ' + needle);
    return match[1];
  };
  out.resolvedSpecifiers = {
    storyState: spec('storyState\\.ts'),
    tidegardenRoute: spec('tidegardenRoute\\.ts'),
    systemFlight: spec('systemFlight\\.ts'),
    starSystem: spec('starSystem\\.ts')
  };
  try {
    const story = await import(/* @vite-ignore */ out.resolvedSpecifiers.storyState);
    const route = await import(/* @vite-ignore */ out.resolvedSpecifiers.tidegardenRoute);
    const snap = story.getStoryStateSnapshot();
    out.story = { chapter: snap.chapter, beat: snap.beat, active: snap.active };
    out.routeOnline = route.isTidegardenRouteOnline();
    out.bootWorldDecision = route.resolveStoryBootWorldId(
      null, route.isTidegardenRouteOnline(), snap
    );
    out.tidegardenIdentity = route.tidegardenIdentity();
  } catch (e) { out.storyError = String(e).slice(0, 200); }
  try {
    const sys = await import(/* @vite-ignore */ out.resolvedSpecifiers.systemFlight);
    const s = sys.getSystemFlightSnapshot();
    out.systemFlight = {
      systemId: s.systemId,
      activePlanetId: s.activePlanetId,
      lastActivePlanetId: s.lastActivePlanetId,
      locationMode: s.locationMode,
      renderOrigin: s.renderOrigin,
      targetKind: s.target?.kind ?? null,
      targetWorldId: s.target?.worldId ?? null
    };
  } catch (e) { out.systemFlightError = String(e).slice(0, 200); }
  try {
    const starSystem = await import(/* @vite-ignore */ out.resolvedSpecifiers.starSystem);
    const id = out.systemFlight?.activePlanetId;
    const slot = id && id.endsWith(':p1') ? 1 : 0;
    const identity = starSystem.createPlanetIdentity({ system: { x: -1, y: -1 }, slot });
    out.residentWorld = { worldId: identity.worldId, seed: identity.seed };
  } catch (e) { out.residentWorldError = String(e).slice(0, 200); }
  // The shipped celestial probe: every companion body's ACTUAL render placement
  // this frame, in the same units the defect was reported in.
  out.celestial = w.__paravoxiaCelestialProbe ?? null;
  out.boundaryStateRefs = w.__paravoxiaBoundaryState?.stateRefs ?? null;
  // The chip. `LOCAL LOCK` / `FLIGHT CORRIDOR ACQUIRED` may not appear anywhere
  // on foot: the ground is not a body you can lock on to.
  const bodyText = document.body.innerText || '';
  out.lockChip = {
    localLock: bodyText.includes('LOCAL LOCK'),
    flightCorridor: bodyText.includes('FLIGHT CORRIDOR'),
    matchedLines: bodyText.split('\n').map(l => l.trim())
      .filter(l => /LOCAL LOCK|FLIGHT CORRIDOR/.test(l))
  };
  return out;
};

const browser = await chromium.launch({
  executablePath: path.join(pwDir, chromeDir, 'chrome-linux/chrome'),
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720']
});

const report = {
  capturedAt: new Date().toISOString(),
  base: BASE,
  defect: {
    id: 'OD-boot-world',
    reportedBy: 'owner',
    lockRevision: 'R6',
    rootCause: "resolveStoryBootWorldId computed tidegardenOwned from an enumeration (beat 'ch8-landfall' or chapter 'ch9' or 'complete') that stopped at ch9, so every ch10 beat booted on the origin world",
    repair: "the ownership test is now a chapter-ORDER comparison via storyChapterAtLeast(chapter, 'ch9'); ch1-ch9 decisions are regression-proven byte-identical by a table over STORY_BEAT_ORDER",
    expected: TIDEGARDEN,
    defectSeedObserved: ORIGIN_SEED_OBSERVED_IN_DEFECT
  },
  scenarios: {}
};
const OUT = path.join(OUT_DIR, 'ch10-boot-world-trace.json');
const flush = () => fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');

for (const beat of ['ch10-cold', 'ch10-ask', 'ch10-transit', 'ch9-hearth', 'ch8-crossing']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(`${BASE}/?story=${beat}&profile=LOW&systemprobe=1`, { waitUntil: 'load', timeout: 90000 });
  await new Promise(r => setTimeout(r, 9000));
  const state = await page.evaluate(READ);
  await page.close();

  const camera = state.celestial?.camera ?? null;
  const bodies = state.celestial?.bodies ?? [];
  const collapsed = bodies.filter(b => b.visible && b.centerDistance <= 1);
  // ch10-transit is deliberately NOT Tidegarden-owned: chapter 10 crosses back
  // to the origin during the ask (the relay is there and nowhere else) and the
  // transit lifts off from the wreck, so the origin owns the ship in flight.
  const expectTidegarden = beat === 'ch10-cold' || beat === 'ch10-ask' || beat === 'ch9-hearth';
  report.scenarios[beat] = {
    url: `?story=${beat}&profile=LOW&systemprobe=1`,
    pageErrors: errs,
    ...state,
    camera,
    assertions: {
      bootWorldMatchesExpectation:
        state.bootWorldDecision === (expectTidegarden ? TIDEGARDEN.worldId : '-1,-1'),
      residentWorldMatchesExpectation:
        state.systemFlight?.activePlanetId === (expectTidegarden ? TIDEGARDEN.worldId : '-1,-1'),
      terrainSeedMatchesExpectation: state.residentWorld?.seed
        === (expectTidegarden ? TIDEGARDEN.seed : ORIGIN_SEED_OBSERVED_IN_DEFECT),
      renderOriginAgreesWithResidentWorld: expectTidegarden
        ? (state.systemFlight?.renderOrigin ?? []).some(v => v !== 0)
        : (state.systemFlight?.renderOrigin ?? [1]).every(v => v === 0),
      noCompanionCollapsedOntoCamera: collapsed.length === 0,
      collapsedBodies: collapsed,
      companionPlacements: bodies.map(b => ({
        worldId: b.worldId, visible: b.visible, centerDistance: b.centerDistance, scale: b.scale
      })),
      noLockChipOnFoot: !state.lockChip.localLock && !state.lockChip.flightCorridor,
      expectation: expectTidegarden
        ? 'Tidegarden owns this beat'
        : 'the origin owns this beat and must be unchanged by the repair'
    }
  };
  flush();
  const a = report.scenarios[beat].assertions;
  console.log(
    `[${beat}] boot=${state.bootWorldDecision} resident=${state.systemFlight?.activePlanetId}`
    + ` seed=${state.residentWorld?.seed} collapsed=${collapsed.length} chip=${!a.noLockChipOnFoot}`
  );
}

await browser.close();
console.log('wrote', OUT);
