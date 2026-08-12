// Stage-1 shipped-baseline probe for the 2026-08-11 ch10 station-introduction run.
//
// Budget: LOW tier only, <=8 frames, state traces preferred over pixels
// (production-lock.md "Execution and evidence budget"). No webm, no movie render.
//
// One headless session drives the shipped movie lane from `ch9-settle`
// (`?story=base`) through `ch9-hearth` into `done` free play, stamping:
//   - a change-detected state trace (story beat, objective id/marker/health,
//     work-order copy, caption, signed-AV camera authority + applied FOV,
//     reality stage, input policy, live ColorGrade uniforms, boundary telemetry),
//   - a short LOW frame strip across the hearth close and the free-play seam,
//   - two night-sky frames at the second hearth (where a future ST-0 sky point
//     would appear), captured by real pointer-lock look input,
//   - a one-shot UX feedback-cue log via subscribeStoryUxFeedback.
//
// Read-only against game source. The only runtime inputs are a canvas click to
// acquire pointer lock and synthetic look deltas — the same path a player uses.
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
const { chromium } = await import(
  '/home/thomasphillip/Projects/vox/main/node_modules/playwright-core/index.mjs'
);

const RUN_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT_DIR = path.join(RUN_DIR, 'evidence', 'baseline');
const BASE = process.env.VOX_BASE ?? 'http://localhost:5176';
const CAP_SECONDS = Number(process.env.VOX_CAP ?? 900);
const POLL_MS = 500;
const HEARTH_SHOT_MS = 2600;
const MAX_HEARTH_SHOTS = 2;
const MAX_DONE_SHOTS = 2;

fs.mkdirSync(OUT_DIR, { recursive: true });

const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter(d => /^chromium-\d+$/.test(d)).sort().pop();

const INSTALL_FEEDBACK_TAP = async () => {
  const w = window;
  if (w.__voxFeedbackTap) return true;
  try {
    const cues = await import('/src/story/ux/feedbackCues.ts');
    w.__voxFeedbackLog = [];
    w.__voxFeedbackTap = cues.subscribeStoryUxFeedback(cue => {
      w.__voxFeedbackLog.push({ at: Math.round(performance.now()), cue, beat: w.__storyBeat ?? null });
    });
    return true;
  } catch (e) {
    w.__voxFeedbackTapError = String(e).slice(0, 200);
    return false;
  }
};

const READ_STATE = async () => {
  const w = window;
  const hud = document.querySelector('[data-story-guidance-hud]');
  const caption = document.querySelector('[data-story-caption]');
  const lives = Array.from(document.querySelectorAll('div[aria-live="polite"]'));
  const audit = lives.find(el => !el.hasAttribute('data-story-caption')
    && !el.hasAttribute('data-story-guidance-hud'));
  const ap = w.__autopilot ?? null;
  const out = {
    beat: w.__storyBeat ?? null,
    objectiveId: hud?.getAttribute('data-objective-id') ?? null,
    markerLabel: hud?.getAttribute('data-objective-marker-label') ?? null,
    health: hud?.getAttribute('data-objective-health') ?? null,
    requiresMarker: hud?.getAttribute('data-objective-requires-marker') ?? null,
    hudText: hud ? hud.innerText.replace(/\s*\n\s*/g, ' | ').trim() : null,
    captionText: caption ? caption.innerText.trim() : null,
    auditText: audit ? audit.innerText.replace(/\s*\n\s*/g, ' | ').trim() : null,
    markerChipText: (() => {
      const chips = Array.from(document.querySelectorAll('div'))
        .filter(el => /·\s*\d+m$/.test((el.textContent ?? '').trim()) && el.children.length === 0)
        .map(el => el.textContent.trim());
      return chips.length ? chips.slice(0, 3) : null;
    })(),
    autopilot: ap ? { goal: ap.goal ?? null, pos: ap.pos ?? null, clock: ap.clock ?? null,
      routeAction: ap.routeAction ?? null, routeOutcome: ap.routeOutcome ?? null } : null,
    feedbackCount: Array.isArray(w.__voxFeedbackLog) ? w.__voxFeedbackLog.length : null
  };
  try {
    const av = await import('/src/story/signedSceneAvRuntime.ts');
    const s = av.getSignedSceneAvDebugSnapshot();
    out.av = {
      active: s.active, suspended: s.suspended, beat: s.beat, anchorId: s.anchorId,
      cameraAuthority: s.shot?.cameraAuthority ?? null,
      appliedFovDeg: s.shot?.lens?.appliedFovDeg ?? null,
      startFovDeg: s.shot?.lens?.startFovDeg ?? null,
      endFovDeg: s.shot?.lens?.endFovDeg ?? null,
      postFx: s.postFx?.activeEffectIds ?? [],
      score: s.score ?? null,
      lastResetReason: s.lastResetReason ?? null
    };
  } catch (e) { out.avError = String(e).slice(0, 160); }
  try {
    const reality = await import('/src/game/systems/realityRenderSystem.ts');
    out.realityStage = reality.getVoxelRealityStage();
  } catch (e) { out.realityError = String(e).slice(0, 160); }
  try {
    const policy = await import('/src/story/storyInputPolicy.ts');
    const p = policy.getStoryInputPolicy();
    out.inputPolicy = { lookMode: p.lookMode, targetFov: p.targetFov, targetDpr: p.targetDpr,
      moveSpeedScale: p.moveSpeedScale, allowBuild: p.allowBuild, allowCraft: p.allowCraft,
      feedBlend: p.feedBlend, sideBlend: p.sideBlend };
  } catch (e) { out.policyError = String(e).slice(0, 160); }
  try {
    const obj = await import('/src/story/ux/objectiveDirector.ts');
    const active = obj.getActiveGuidedStoryObjective();
    out.objective = active ? { id: active.id, kind: active.kind, markerLabel: active.markerLabel,
      workOrder: active.workOrder, requiresMarker: active.requiresMarker ?? true } : null;
    out.objectiveHealth = obj.getGuidedStoryObjectiveHealth();
    out.objectiveVersion = obj.getGuidedStoryObjectiveVersion();
  } catch (e) { out.objectiveError = String(e).slice(0, 160); }
  return out;
};

// Heavier reads: only sampled at the named anchors (grade uniforms, telemetry,
// quality profile, DPR) so the 2 Hz trace stays cheap.
const READ_DEEP = async () => {
  const out = {};
  try {
    const grade = await import('/src/components/effects/ColorGradeEffect.ts');
    const g = grade.getColorGrade();
    if (g) {
      const u = k => g.uniforms.get(k)?.value;
      const tint = u('uTint');
      out.colorGrade = {
        tint: tint ? [Number(tint.r.toFixed(4)), Number(tint.g.toFixed(4)), Number(tint.b.toFixed(4))] : null,
        tintAmount: u('uTintAmt') ?? null, saturation: u('uSat') ?? null, warm: u('uWarm') ?? null,
        contrast: u('uContrast') ?? null, lift: u('uLift') ?? null, shoulder: u('uShoulder') ?? null
      };
    } else out.colorGrade = null;
  } catch (e) { out.colorGradeError = String(e).slice(0, 160); }
  try {
    const tel = await import('/src/story/storyBoundaryTelemetry.ts');
    out.boundaryTelemetry = window.__paravoxiaBoundaryState
      ?? tel.deriveStoryBoundaryState(tel.readStoryBoundaryRuntime(null));
  } catch (e) { out.boundaryTelemetryError = String(e).slice(0, 160); }
  try {
    const gfx = await import('/src/config/graphicsSettings.ts');
    out.qualityProfile = gfx.getQualityProfile();
    const q = gfx.getGraphicsQuality();
    out.qualityFlags = { colorGrade: q.colorGrade, postProcess: q.postProcess, outline: q.outline,
      painterly: q.painterly, contactAO: q.contactAO, skyClouds: q.skyClouds,
      waterReflections: q.waterReflections };
  } catch (e) { out.qualityProfileError = String(e).slice(0, 160); }
  try {
    const clock = await import('/src/game/worldClock.ts');
    out.dayPhase = clock.getCurrentDayPhase();
  } catch (e) { out.dayPhaseError = String(e).slice(0, 160); }
  try {
    const story = await import('/src/story/storyState.ts');
    out.storySnapshot = story.getStoryStateSnapshot();
  } catch (e) { out.storySnapshotError = String(e).slice(0, 160); }
  out.viewport = { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio };
  out.hudPresent = {
    guidanceHud: !!document.querySelector('[data-story-guidance-hud]'),
    suitHud: /SUIT HUD/.test(document.body.innerText),
    inventoryChip: /INV\s*·/.test(document.body.innerText),
    caption: !!document.querySelector('[data-story-caption]')
  };
  out.feedbackLog = Array.isArray(window.__voxFeedbackLog) ? window.__voxFeedbackLog : null;
  return out;
};

const browser = await chromium.launch({
  executablePath: path.join(pwDir, chromeDir, 'chrome-linux/chrome'),
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720']
});

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const pageErrors = [];
const consoleErrors = [];
page.on('pageerror', e => pageErrors.push(String(e).slice(0, 300)));
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });

const url = `${BASE}/?story=base&movie=1&profile=LOW`;
const report = {
  capturedAt: new Date().toISOString(),
  base: BASE,
  url,
  viewport: '1280x720',
  qualityTierRequested: 'LOW',
  trace: [],
  shots: [],
  anchors: {},
  pageErrors,
  consoleErrors
};
const REPORT_PATH = path.join(OUT_DIR, 'baseline-trace.json');
const flush = () => fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

const t0 = Date.now();
await page.goto(url, { waitUntil: 'load', timeout: 90000 }).catch(e => {
  report.gotoError = String(e).slice(0, 300);
});
await page.evaluate(INSTALL_FEEDBACK_TAP).catch(() => {});

let prevKey = null;
let hearthShots = 0;
let doneShots = 0;
let closingAt = null;
let lastHearthShot = -HEARTH_SHOT_MS;
let doneAt = null;
let hearthAt = null;
let shotIndex = 0;

const shoot = async (label, state) => {
  const at = Math.round((Date.now() - t0) / 1000);
  const name = `${String(shotIndex).padStart(2, '0')}_${String(at).padStart(3, '0')}s_${state.beat ?? 'null'}_${label}.png`;
  await page.screenshot({ path: path.join(OUT_DIR, name) });
  report.shots.push({
    file: `evidence/baseline/${name}`, t: at, beat: state.beat ?? null, label,
    objectiveId: state.objectiveId ?? null, markerLabel: state.markerLabel ?? null,
    caption: state.captionText ?? null
  });
  shotIndex++;
  return name;
};

while (true) {
  const elapsed = Date.now() - t0;
  if (elapsed / 1000 > CAP_SECONDS) { report.capReached = true; break; }
  let state;
  try { state = await page.evaluate(READ_STATE); }
  catch (e) { state = { readError: String(e).slice(0, 200) }; }
  const key = JSON.stringify([state.beat, state.objectiveId, state.markerLabel, state.health,
    state.hudText, state.captionText, state.objectiveVersion, state.av?.cameraAuthority,
    state.av?.appliedFovDeg, state.realityStage, state.feedbackCount]);
  if (key !== prevKey) {
    report.trace.push({ t: Number((elapsed / 1000).toFixed(2)), changed: true, ...state });
    prevKey = key;
  } else if (Math.round(elapsed / 1000) % 15 === 0 && elapsed % 1000 < POLL_MS) {
    report.trace.push({ t: Number((elapsed / 1000).toFixed(2)), changed: false, beat: state.beat,
      objectiveId: state.objectiveId, autopilot: state.autopilot });
  }

  if (state.beat === 'ch9-hearth') {
    if (hearthAt === null) {
      hearthAt = elapsed;
      report.anchors.ch9HearthEnter = { tSeconds: Number((elapsed / 1000).toFixed(2)),
        deep: await page.evaluate(READ_DEEP).catch(e => ({ err: String(e).slice(0, 160) })), state };
      await shoot('hearth-enter', state);
    }
    // The closing state is the only ch9-hearth window worth pixels: the
    // authored ~5.5s settle before completeStory(). Everything before it is the
    // wait-for-night hold, already proven by the trace.
    if (state.objectiveId === 'settle:second-hearth-settling') {
      if (closingAt === null) {
        closingAt = elapsed;
        report.anchors.ch9HearthClosing = { tSeconds: Number((elapsed / 1000).toFixed(2)),
          deep: await page.evaluate(READ_DEEP).catch(e => ({ err: String(e).slice(0, 160) })), state };
        await shoot('hearth-closing', state);
        hearthShots++;
        lastHearthShot = elapsed;
      } else if (hearthShots < MAX_HEARTH_SHOTS && elapsed - lastHearthShot >= HEARTH_SHOT_MS) {
        await shoot('hearth-closing-late', state);
        hearthShots++;
        lastHearthShot = elapsed;
      }
    }
  }

  if (state.beat === 'done') {
    if (doneAt === null) {
      doneAt = elapsed;
      report.anchors.doneEnter = { tSeconds: Number((elapsed / 1000).toFixed(2)),
        deep: await page.evaluate(READ_DEEP).catch(e => ({ err: String(e).slice(0, 160) })), state };
      await shoot('freeplay-seam', state);
      doneShots++;
    } else if (doneShots < MAX_DONE_SHOTS && elapsed - doneAt > 8000) {
      await shoot('freeplay-settled', state);
      doneShots++;
    }
    if (doneShots >= MAX_DONE_SHOTS && elapsed - doneAt > 10000) break;
  }
  await new Promise(r => setTimeout(r, POLL_MS));
  flush();
}

report.closingStateAtSeconds = closingAt === null ? null : Number((closingAt / 1000).toFixed(2));
report.reachedDone = doneAt !== null;
report.reachedHearth = hearthAt !== null;
report.secondsToHearth = hearthAt === null ? null : Number((hearthAt / 1000).toFixed(1));
report.secondsToDone = doneAt === null ? null : Number((doneAt / 1000).toFixed(1));
report.hearthToDoneSeconds = (hearthAt !== null && doneAt !== null)
  ? Number(((doneAt - hearthAt) / 1000).toFixed(1)) : null;

// --- night-sky frames at the second hearth (shipped sky where ST-0 would land).
// Rest completes INSIDE the certified shelter, so the zenith is roofed at the
// seam. Step outside first: the SUIT HUD's SHELTERED flag is the exit test.
const look = async (dy, steps = 10) => {
  for (let i = 0; i < steps; i++) {
    await page.evaluate(d => document.dispatchEvent(
      new MouseEvent('mousemove', { movementX: 0, movementY: d, bubbles: true })), dy);
    await new Promise(r => setTimeout(r, 60));
  }
};
const sheltered = () => page.evaluate(() => /SHELTERED/.test(document.body.innerText))
  .catch(() => null);

if (doneAt !== null) {
  await page.mouse.click(640, 400);
  await new Promise(r => setTimeout(r, 800));
  report.pointerLock = await page.evaluate(() => (document.pointerLockElement
    ? document.pointerLockElement.tagName : null));
  report.skyWalk = { shelteredAtSeam: await sheltered(), legs: [] };
  // Bounded search for the doorway: try each cardinal heading, walk, re-check.
  const headings = [0, 90, 180, 270, 45, 135];
  let clear = !(await sheltered());
  let yaw = 0;
  for (const h of headings) {
    if (clear) break;
    const turn = h - yaw;
    yaw = h;
    for (let i = 0; i < Math.abs(turn) / 10; i++) {
      await page.evaluate(d => document.dispatchEvent(
        new MouseEvent('mousemove', { movementX: d, movementY: 0, bubbles: true })), turn > 0 ? 10 : -10);
      await new Promise(r => setTimeout(r, 40));
    }
    await page.keyboard.down('w');
    let walked = 0;
    while (walked < 6000) {
      await new Promise(r => setTimeout(r, 500));
      walked += 500;
      if (!(await sheltered())) { clear = true; break; }
    }
    await page.keyboard.up('w');
    report.skyWalk.legs.push({ heading: h, walkedMs: walked, clear });
    await new Promise(r => setTimeout(r, 400));
  }
  report.skyWalk.clearedShelter = clear;
  await look(-20, 10);
  await new Promise(r => setTimeout(r, 900));
  let s = await page.evaluate(READ_STATE).catch(() => ({ beat: 'done' }));
  await shoot('sky-mid', s);
  await look(-20, 10);
  await new Promise(r => setTimeout(r, 900));
  s = await page.evaluate(READ_STATE).catch(() => ({ beat: 'done' }));
  await shoot('sky-zenith', s);
  report.anchors.doneSky = { deep: await page.evaluate(READ_DEEP).catch(e => ({ err: String(e).slice(0, 160) })), state: s };
}

report.durationSeconds = Math.round((Date.now() - t0) / 1000);
report.feedbackLog = await page.evaluate(() => window.__voxFeedbackLog ?? null).catch(() => null);
flush();
await page.close();
await browser.close();
console.log(`done=${report.reachedDone} hearth@${report.secondsToHearth}s done@${report.secondsToDone}s shots=${report.shots.length} pageErrors=${pageErrors.length}`);
console.log('wrote', REPORT_PATH);
