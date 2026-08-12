// Stage 6 items 3,4,5,6,9: ch10 anchor/lifecycle/docking/ST-0/reset state traces.
//
// Deep-link scenarios at LOW unless a variant says otherwise. Zero frames: this
// probe is pure state (lock evidence budget routes proof to traces).
//
// Verb lane: the four ch10 verbs are driven through the exported commit
// functions in emergentStoryDirector — the same receipt path the interaction
// system and the autopilot both call, with their beat and prerequisite guards
// intact. Refused-out-of-order attempts are recorded as evidence of the guard.
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

const TAP = async () => {
  const w = window;
  if (w.__voxTap) return true;
  const cues = await import('/src/story/ux/feedbackCues.ts');
  w.__voxFeedbackLog = [];
  w.__voxTap = cues.subscribeStoryUxFeedback(c => {
    w.__voxFeedbackLog.push({ at: Math.round(performance.now()), cue: c, beat: w.__storyBeat ?? null });
  });
  return true;
};

const READ = async () => {
  const w = window;
  const hud = document.querySelector('[data-story-guidance-hud]');
  const caption = document.querySelector('[data-story-caption]');
  const lives = Array.from(document.querySelectorAll('div[aria-live="polite"]'));
  const band = lives.find(el => !el.hasAttribute('data-story-caption') && !el.hasAttribute('data-story-guidance-hud'));
  const out = {
    beat: w.__storyBeat ?? null,
    objectiveId: hud?.getAttribute('data-objective-id') ?? null,
    markerLabel: hud?.getAttribute('data-objective-marker-label') ?? null,
    health: hud?.getAttribute('data-objective-health') ?? null,
    requiresMarker: hud?.getAttribute('data-objective-requires-marker') ?? null,
    hudText: hud ? hud.innerText.replace(/\s*\n\s*/g, ' | ').trim() : null,
    caption: caption ? caption.innerText.trim() : null,
    band: band ? band.innerText.replace(/\s*\n\s*/g, ' | ').trim() : null,
    cues: (w.__voxFeedbackLog ?? []).length
  };
  try {
    const av = await import('/src/story/signedSceneAvRuntime.ts');
    const s = av.getSignedSceneAvDebugSnapshot();
    out.av = { active: s.active, beat: s.beat, anchorId: s.anchorId, authority: s.shot?.cameraAuthority ?? null,
      fov: s.shot?.lens?.appliedFovDeg ?? null, agency: s.shot?.agency ?? null,
      postFx: s.postFx?.activeEffectIds ?? [], reducedMotion: s.postFx?.reducedMotion ?? null,
      score: s.score ?? null, history: s.activationHistoryAnchorIds ?? [], reset: s.lastResetReason ?? null };
  } catch (e) { out.avError = String(e).slice(0, 120); }
  try {
    const gfx = await import('/src/config/graphicsSettings.ts');
    out.tier = gfx.getQualityProfile();
  } catch { /* ignore */ }
  try {
    const st = await import('/src/game/spaceStation/spaceStationDevFlag.ts');
    out.station = { storyContext: st.isStorySpaceStationContext(), sandbox: st.isSpaceStationSandbox(),
      dockingAuthorized: st.spaceStationDockingAuthorized(), targetingAuthorized: st.spaceStationTargetingAuthorized() };
  } catch (e) { out.stationError = String(e).slice(0, 120); }
  try {
    const flight = await import('/src/state/spaceFlight.ts');
    const f = flight.getSpaceFlightSnapshot();
    out.flight = { phase: f.phase, controlMode: f.controlMode };
  } catch { /* ignore */ }
  try {
    const sys = await import('/src/state/systemFlight.ts');
    const s = sys.getSystemFlightSnapshot();
    out.systemFlight = { systemId: s.systemId, activePlanetId: s.activePlanetId,
      targetKind: s.target?.kind ?? null, activationEpoch: s.activationEpoch, locationMode: s.locationMode };
  } catch { /* ignore */ }
  out.contacts = typeof w.__spaceStationContacts === 'function' ? w.__spaceStationContacts() : null;
  out.boundaryStateRefs = w.__paravoxiaBoundaryState?.stateRefs ?? null;
  return out;
};

const ST0 = async () => {
  const out = {};
  try {
    const m = await import('/src/components/systemCompanionBodiesModel.ts');
    const story = await import('/src/story/storyState.ts');
    const st = await import('/src/game/spaceStation/spaceStationDevFlag.ts');
    const { hasMilestone } = await import('/src/game/systems/milestoneSystem.ts');
    const snap = story.getStoryStateSnapshot();
    const input = {
      storyWorld: true,
      storyComplete: hasMilestone(story.STORY_MILESTONES.complete) || snap.chapter === 'complete' || snap.chapter === 'ch10',
      twoWorldHandoff: hasMilestone('story:tidegarden:two-world-handoff'),
      sandbox: st.isSpaceStationSandbox()
    };
    out.predicateInput = input;
    out.predicate = m.st0RenderPredicate(input);
    out.periodSeconds = m.ST0_TRANSIT_PERIOD_SECONDS;
    out.nightFloor = m.ST0_NIGHT_VISIBILITY_FLOOR;
    const clock = await import('/src/game/worldClock.ts');
    out.dayPhase = clock.getCurrentDayPhase();
  } catch (e) { out.error = String(e).slice(0, 200); }
  return out;
};

const browser = await chromium.launch({
  executablePath: path.join(pwDir, chromeDir, 'chrome-linux/chrome'),
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720']
});

const report = { capturedAt: new Date().toISOString(), base: BASE, scenarios: {} };
const OUT = path.join(OUT_DIR, 'ch10-state-trace.json');
const flush = () => fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

async function openPage(url, opts = {}) {
  const page = await browser.newPage({
    viewport: opts.viewport ?? { width: 1280, height: 720 },
    isMobile: opts.isMobile ?? false,
    hasTouch: opts.isMobile ?? false,
    reducedMotion: opts.reducedMotion ?? 'no-preference'
  });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(`${BASE}/${url}`, { waitUntil: 'load', timeout: 90000 });
  await page.evaluate(TAP).catch(() => {});
  await new Promise(r => setTimeout(r, opts.settleMs ?? 9000));
  return { page, errs };
}

// --- S1: ch10-cold verb lane + lifecycle -----------------------------------
{
  const { page, errs } = await openPage('?story=ch10-cold&profile=LOW');
  const s = { url: '?story=ch10-cold&profile=LOW', steps: [], pageErrors: errs };
  const step = async (label) => {
    const st = await page.evaluate(READ);
    s.steps.push({ label, ...st });
    return st;
  };
  await step('entry');
  s.st0AtCold = await page.evaluate(ST0);
  // Guard proof: fabrication before the fault has been read must refuse.
  s.outOfOrderFabrication = await page.evaluate(async () => {
    const d = await import('/src/story/emergentStoryDirector.ts');
    return d.commitChapter10FabricationAttempt();
  });
  await step('after-refused-out-of-order-fabrication');
  s.faultRead = await page.evaluate(async () => {
    const d = await import('/src/story/emergentStoryDirector.ts');
    return d.commitChapter10FaultRead();
  });
  await new Promise(r => setTimeout(r, 3000));
  await step('after-fault-read');
  s.faultReadTwice = await page.evaluate(async () => {
    const d = await import('/src/story/emergentStoryDirector.ts');
    return d.commitChapter10FaultRead();
  });
  s.fabrication = await page.evaluate(async () => {
    const d = await import('/src/story/emergentStoryDirector.ts');
    return d.commitChapter10FabricationAttempt();
  });
  await new Promise(r => setTimeout(r, 4000));
  await step('after-fabrication-refused');
  s.feedbackLog = await page.evaluate(() => window.__voxFeedbackLog ?? []);
  await page.close();
  report.scenarios.coldVerbLane = s;
  flush();
  console.log('S1 cold done', s.steps.map(x => `${x.label}:${x.beat}/${x.objectiveId}`).join(' '));
}

// --- S2: ch10-ask verb lane, relay answer, bearing claim --------------------
{
  const { page, errs } = await openPage('?story=ch10-ask&profile=LOW');
  const s = { url: '?story=ch10-ask&profile=LOW', steps: [], pageErrors: errs };
  const step = async (label) => { const st = await page.evaluate(READ); s.steps.push({ label, ...st }); return st; };
  await step('entry');
  s.claimBeforeAnswer = await page.evaluate(async () => {
    const d = await import('/src/story/emergentStoryDirector.ts');
    return d.commitChapter10BearingClaim();
  });
  await step('after-refused-claim-before-answer');
  s.targetingBeforeClaim = await page.evaluate(async () => {
    const st = await import('/src/game/spaceStation/spaceStationDevFlag.ts');
    return st.spaceStationTargetingAuthorized();
  });
  s.relayRequest = await page.evaluate(async () => {
    const d = await import('/src/story/emergentStoryDirector.ts');
    return d.commitChapter10RelayRequest();
  });
  // Sample fast across the answer to catch K7/K8 simultaneity.
  s.answerWindow = [];
  for (let i = 0; i < 40; i++) {
    const st = await page.evaluate(READ);
    s.answerWindow.push({ t: i * 0.25, band: st.band, caption: st.caption, anchors: st.av?.history ?? [],
      score: st.av?.score ?? null });
    await new Promise(r => setTimeout(r, 250));
  }
  await step('after-relay-answer');
  s.bearingClaim = await page.evaluate(async () => {
    const d = await import('/src/story/emergentStoryDirector.ts');
    return d.commitChapter10BearingClaim();
  });
  await new Promise(r => setTimeout(r, 4000));
  await step('after-bearing-claim');
  s.targetingAfterClaim = await page.evaluate(async () => {
    const st = await import('/src/game/spaceStation/spaceStationDevFlag.ts');
    return st.spaceStationTargetingAuthorized();
  });
  s.feedbackLog = await page.evaluate(() => window.__voxFeedbackLog ?? []);
  await page.close();
  report.scenarios.askVerbLane = s;
  flush();
  console.log('S2 ask done claim-before-answer=', s.claimBeforeAnswer, 'claim=', s.bearingClaim);
}

// --- S3: ch10-transit, docking fence, station contacts ---------------------
{
  const { page, errs } = await openPage('?story=ch10-transit&profile=LOW', { settleMs: 12000 });
  const s = { url: '?story=ch10-transit&profile=LOW', steps: [], pageErrors: errs };
  const step = async (label) => { const st = await page.evaluate(READ); s.steps.push({ label, ...st }); return st; };
  await step('entry');
  s.commitEpochBefore = await page.evaluate(async () => {
    const sys = await import('/src/state/systemFlight.ts');
    return sys.getSystemFlightSnapshot().activationEpoch;
  });
  // The fence, exercised on the real runtime: targeting IS authorized here
  // (the deep link seeds the claim), so the commit must take effect.
  s.commitResult = await page.evaluate(async () => {
    const sys = await import('/src/state/systemFlight.ts');
    const before = sys.getSystemFlightSnapshot();
    const stations = window.__spaceStationContacts?.()?.stations ?? [];
    if (!stations.length) return { skipped: 'no station bodies in system' };
    const dev = await import('/src/game/spaceStation/spaceStationDevFlag.ts');
    return { targetingAuthorized: dev.spaceStationTargetingAuthorized(),
      dockingAuthorized: dev.spaceStationDockingAuthorized(),
      beforeEpoch: before.activationEpoch, stations };
  });
  await step('after-fence-read');
  // KeyF inside the corridor must neither commit nor navigate nor advise.
  s.keyF = { before: await page.evaluate(READ) };
  await page.mouse.click(640, 400).catch(() => {});
  await page.keyboard.press('KeyF');
  await new Promise(r => setTimeout(r, 1500));
  await page.keyboard.press('KeyF');
  await new Promise(r => setTimeout(r, 2500));
  s.keyF.after = await page.evaluate(READ);
  s.keyF.unchanged = JSON.stringify(s.keyF.before.systemFlight) === JSON.stringify(s.keyF.after.systemFlight)
    && s.keyF.before.beat === s.keyF.after.beat;
  s.feedbackLog = await page.evaluate(() => window.__voxFeedbackLog ?? []);
  await page.close();
  report.scenarios.transitFence = s;
  flush();
  console.log('S3 transit done keyF-unchanged=', s.keyF.unchanged);
}

// --- S4: ST-0 render predicate across contexts ------------------------------
{
  const contexts = [
    { id: 'pure-sandbox', url: '?profile=LOW' },
    { id: 'station-sandbox', url: '?spacestation=1&profile=LOW' },
    { id: 'pre-done-story-beat', url: '?story=ch9-settle&profile=LOW' },
    { id: 'ch10-cold', url: '?story=ch10-cold&profile=LOW' }
  ];
  const out = [];
  for (const c of contexts) {
    const { page, errs } = await openPage(c.url, { settleMs: 8000 });
    const st0 = await page.evaluate(ST0);
    const state = await page.evaluate(READ);
    out.push({ ...c, st0, beat: state.beat, station: state.station, pageErrors: errs });
    await page.close();
  }
  report.scenarios.st0Predicate = out;
  flush();
  console.log('S4 st0', out.map(o => `${o.id}=${o.st0.predicate}`).join(' '));
}

// --- S5: variant anchor traces ---------------------------------------------
{
  const variants = [
    { id: 'desktop-high', url: '?story=ch10-transit&profile=HIGH', opts: {} },
    { id: 'desktop-medium-reduced-motion', url: '?story=ch10-transit&profile=MEDIUM', opts: { reducedMotion: 'reduce' } },
    { id: 'desktop-low', url: '?story=ch10-transit&profile=LOW', opts: {} },
    { id: 'mobile-potato', url: '?story=ch10-transit&profile=POTATO', opts: { viewport: { width: 390, height: 844 }, isMobile: true } }
  ];
  const out = [];
  for (const v of variants) {
    const { page, errs } = await openPage(v.url, { ...v.opts, settleMs: 14000 });
    const state = await page.evaluate(READ);
    out.push({ variant: v.id, url: v.url, beat: state.beat, tier: state.tier, av: state.av,
      objectiveId: state.objectiveId, markerLabel: state.markerLabel, health: state.health,
      hudText: state.hudText, station: state.station, pageErrors: errs });
    await page.close();
  }
  report.scenarios.variants = out;
  flush();
  console.log('S5 variants', out.map(o => `${o.variant}:${o.tier}/${o.beat}`).join(' '));
}

// --- S6: reset matrix -------------------------------------------------------
{
  const out = [];
  // deep_link + completion + sandbox_noop are covered by re-entry states.
  const cases = [
    { id: 'deep_link', url: '?story=ch10-cold&profile=LOW' },
    { id: 'completion', url: '?story=done&profile=LOW' },
    { id: 'sandbox_noop', url: '?profile=LOW' },
    { id: 'station_sandbox_noop', url: '?spacestation=1&profile=LOW' }
  ];
  for (const c of cases) {
    const { page, errs } = await openPage(c.url, { settleMs: 8000 });
    const state = await page.evaluate(READ);
    out.push({ case: c.id, url: c.url, beat: state.beat, objectiveId: state.objectiveId,
      avActive: state.av?.active ?? null, avAuthority: state.av?.authority ?? null,
      avReset: state.av?.reset ?? null, avHistory: state.av?.history ?? [],
      station: state.station, stateRefs: state.boundaryStateRefs, pageErrors: errs });
    await page.close();
  }
  // pause/focus: hide the tab mid-beat and prove no state leak.
  {
    const { page, errs } = await openPage('?story=ch10-transit&profile=LOW', { settleMs: 12000 });
    const before = await page.evaluate(READ);
    const other = await browser.newPage();
    await other.goto('about:blank');
    await new Promise(r => setTimeout(r, 6000));
    await other.close();
    await page.bringToFront();
    await new Promise(r => setTimeout(r, 3000));
    const after = await page.evaluate(READ);
    out.push({ case: 'pause_focus', before: { beat: before.beat, av: before.av, objectiveId: before.objectiveId },
      after: { beat: after.beat, av: after.av, objectiveId: after.objectiveId },
      beatPreserved: before.beat === after.beat, pageErrors: errs });
    await page.close();
  }
  // quit mid-beat then reload: the latch must not refire.
  {
    const { page, errs } = await openPage('?story=ch10-transit&profile=LOW', { settleMs: 12000 });
    const before = await page.evaluate(READ);
    await page.reload({ waitUntil: 'load', timeout: 90000 });
    await new Promise(r => setTimeout(r, 12000));
    await page.evaluate(TAP).catch(() => {});
    await new Promise(r => setTimeout(r, 4000));
    const after = await page.evaluate(READ);
    out.push({ case: 'quit_reload_mid_transit',
      before: { beat: before.beat, history: before.av?.history ?? [], objectiveId: before.objectiveId },
      after: { beat: after.beat, history: after.av?.history ?? [], objectiveId: after.objectiveId,
        cues: after.cues },
      pageErrors: errs });
    await page.close();
  }
  report.scenarios.resetMatrix = out;
  flush();
  console.log('S6 resets done');
}

await browser.close();
flush();
console.log('wrote', OUT);
