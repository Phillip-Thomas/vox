// Closeout odds and ends, all state-only:
//   A. TELEMETRY PIN: state:space-station/targeted appears at the bearing claim
//      and the active-planet claim is undisturbed (the b9335b9 pin).
//   B. GALAXY FIREWALL constants: SEAM_OF_LIGHT_MIN_BLEND strictly above
//      GalaxyImpostors' IMPOSTOR_REVEAL_START_BLEND, read from the runtime.
//   C. SANDBOX NO-OP: the station sandbox path leaves the story rail inert.
//   D. RESET MATRIX: deep link, replay, completion and sandbox entry states.
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

const STATE = async () => {
  const out = { beat: window.__storyBeat ?? null };
  out.boundaryStateRefs = window.__paravoxiaBoundaryState?.stateRefs ?? null;
  try {
    const sys = await import('/src/state/systemFlight.ts');
    const s = sys.getSystemFlightSnapshot();
    out.system = { activePlanetId: s.activePlanetId, lastActivePlanetId: s.lastActivePlanetId,
      locationMode: s.locationMode, targetKind: s.target?.kind ?? null,
      targetWorldId: s.target?.worldId ?? null };
  } catch { /* ignore */ }
  try {
    const av = await import('/src/story/signedSceneAvRuntime.ts');
    const s = av.getSignedSceneAvDebugSnapshot();
    out.av = { active: s.active, beat: s.beat, anchorId: s.anchorId,
      authority: s.shot?.cameraAuthority ?? null, fov: s.shot?.lens?.appliedFovDeg ?? null,
      letterbox: s.shot?.letterbox ?? null, postFx: s.postFx?.activeEffectIds ?? [],
      reset: s.lastResetReason ?? null, history: s.activationHistoryAnchorIds ?? [] };
  } catch { /* ignore */ }
  try {
    const m = await import('/src/components/systemCompanionBodiesModel.ts');
    const st = await import('/src/game/spaceStation/spaceStationDevFlag.ts');
    const story = await import('/src/story/storyState.ts');
    const prog = await import('/src/game/systems/progressionSystem.ts');
    out.st0Predicate = m.st0RenderPredicate({
      storyWorld: true,
      storyComplete: prog.hasMilestone(story.STORY_MILESTONES.complete),
      twoWorldHandoff: prog.hasMilestone('story:tidegarden:two-world-handoff'),
      sandbox: st.isSpaceStationSandbox()
    });
    out.sandbox = st.isSpaceStationSandbox();
    out.dockingAuthorized = st.spaceStationDockingAuthorized();
    out.targetingAuthorized = st.spaceStationTargetingAuthorized();
    out.storyStationContext = st.isStorySpaceStationContext();
  } catch (e) { out.predicateError = String(e).slice(0, 140); }
  const hud = document.querySelector('[data-story-guidance-hud]');
  out.hudText = hud ? hud.innerText.replace(/\s*\n\s*/g, ' | ').trim() : null;
  return out;
};

const CONSTANTS = async () => {
  const dir = await import('/src/story/emergentStoryDirector.ts');
  const gal = await import('/src/components/GalaxyImpostors.tsx');
  const app = await import('/src/game/spaceStation/spaceStationApproach.ts');
  const model = await import('/src/components/systemCompanionBodiesModel.ts');
  return {
    SEAM_OF_LIGHT_MIN_BLEND: dir.SEAM_OF_LIGHT_MIN_BLEND ?? null,
    IMPOSTOR_REVEAL_START_BLEND: gal.IMPOSTOR_REVEAL_START_BLEND ?? 'not-exported',
    CORRIDOR_RANGE: app.CORRIDOR_RANGE,
    DOCK_SPEED_LIMIT: app.DOCK_SPEED_LIMIT,
    ST0_TRANSIT_PERIOD_SECONDS: model.ST0_TRANSIT_PERIOD_SECONDS,
    ST0_NIGHT_VISIBILITY_FLOOR: model.ST0_NIGHT_VISIBILITY_FLOOR
  };
};

const COMMIT = fn => new Function('return (async () => { const d = await import("/src/story/emergentStoryDirector.ts"); return d.' + fn + '(); })()');

const browser = await chromium.launch({
  executablePath: path.join(pwDir, chromeDir, 'chrome-linux/chrome'),
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720']
});
const report = { capturedAt: new Date().toISOString(), base: BASE };
const OUT = path.join(OUT_DIR, 'ch10-closeout-misc.json');
const flush = () => fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');

async function open(url, settle = 14000) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  await page.goto(`${BASE}/${url}`, { waitUntil: 'load', timeout: 120000 });
  await new Promise(r => setTimeout(r, settle));
  return { page, errs };
}

// A + B: the claim's telemetry, and the two blend constants from the runtime.
{
  const { page, errs } = await open('?story=ch10-ask&profile=LOW');
  const before = await page.evaluate(STATE);
  const constants = await page.evaluate(CONSTANTS).catch(e => ({ err: String(e).slice(0, 160) }));
  await page.evaluate(COMMIT('commitChapter10RelayRequest')).catch(() => {});
  await new Promise(r => setTimeout(r, 3500));
  const afterAsk = await page.evaluate(STATE);
  await page.evaluate(COMMIT('commitChapter10BearingClaim')).catch(() => {});
  await new Promise(r => setTimeout(r, 4000));
  const afterClaim = await page.evaluate(STATE);
  const refs = (s) => (s.boundaryStateRefs ?? []).map(r => (typeof r === 'string' ? r : r?.ref ?? JSON.stringify(r)));
  report.telemetryPin = {
    url: '?story=ch10-ask&profile=LOW',
    before: { stateRefs: refs(before), activePlanetId: before.system?.activePlanetId },
    afterAsk: { stateRefs: refs(afterAsk), activePlanetId: afterAsk.system?.activePlanetId },
    afterClaim: { stateRefs: refs(afterClaim), activePlanetId: afterClaim.system?.activePlanetId,
      targetKind: afterClaim.system?.targetKind, targetWorldId: afterClaim.system?.targetWorldId },
    targetedRefPresentAtClaim: refs(afterClaim).some(r => /space-station\/targeted/.test(r)),
    activePlanetUndisturbed: before.system?.activePlanetId === afterClaim.system?.activePlanetId,
    pageErrors: errs
  };
  report.constants = constants;
  report.galaxyFirewall = constants && typeof constants.SEAM_OF_LIGHT_MIN_BLEND === 'number'
    && typeof constants.IMPOSTOR_REVEAL_START_BLEND === 'number'
    ? { seamMinBlend: constants.SEAM_OF_LIGHT_MIN_BLEND,
        galaxyRevealStartBlend: constants.IMPOSTOR_REVEAL_START_BLEND,
        seamStrictlyAboveGalaxy: constants.SEAM_OF_LIGHT_MIN_BLEND > constants.IMPOSTOR_REVEAL_START_BLEND }
    : { note: 'constants unreadable', constants };
  flush();
  console.log('[telemetry] targeted=' + report.telemetryPin.targetedRefPresentAtClaim
    + ' planetUndisturbed=' + report.telemetryPin.activePlanetUndisturbed
    + ' firewall=' + JSON.stringify(report.galaxyFirewall));
  await page.close();
}

// C + D: the reset matrix rows reachable without the transit flight.
{
  const rows = [];
  for (const row of [
    { case: 'deep_link', url: '?story=ch10-cold&profile=LOW' },
    { case: 'deep_link_ask', url: '?story=ch10-ask&profile=LOW' },
    { case: 'deep_link_transit', url: '?story=ch10-transit&profile=LOW' },
    { case: 'replay_from_base', url: '?story=base&profile=LOW' },
    { case: 'completion_done', url: '?story=done&profile=LOW' },
    { case: 'sandbox_noop', url: '?profile=LOW' },
    { case: 'station_sandbox_noop', url: '?spacestation=1&profile=LOW' }
  ]) {
    const { page, errs } = await open(row.url, 15000);
    const s = await page.evaluate(STATE);
    rows.push({ ...row, beat: s.beat, avActive: s.av?.active ?? null, anchorId: s.av?.anchorId ?? null,
      authority: s.av?.authority ?? null, fov: s.av?.fov ?? null, letterbox: s.av?.letterbox ?? null,
      postFx: s.av?.postFx ?? null, reset: s.av?.reset ?? null, st0Predicate: s.st0Predicate,
      sandbox: s.sandbox, dockingAuthorized: s.dockingAuthorized,
      targetingAuthorized: s.targetingAuthorized, storyStationContext: s.storyStationContext,
      activePlanetId: s.system?.activePlanetId ?? null, hudText: s.hudText, pageErrors: errs });
    flush();
    console.log(`[reset ${row.case}] beat=${s.beat} avActive=${s.av?.active} st0=${s.st0Predicate} sandbox=${s.sandbox} dockAuth=${s.dockingAuthorized}`);
    await page.close();
  }
  report.resetMatrix = rows;
  flush();
}

await browser.close();
flush();
console.log('wrote', OUT);
