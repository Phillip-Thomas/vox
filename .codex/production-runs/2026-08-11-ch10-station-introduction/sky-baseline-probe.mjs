// Shipped night-sky baseline above the second hearth (ST-0's future placement).
//
// The movie lane's own `done` seam is unusable for sky evidence: the autopilot's
// certified shelter (emergentMovieRuntime.buildAndCertifyEmergentMovieShelter)
// is a sealed 1x1x2 box — ceiling plus every wall face, no doorway — so rest,
// completion and free-play entry all happen with the zenith roofed. This probe
// therefore captures the shipped sky from the outdoor second-hearth state
// (`?story=ch9-hearth` deep link, night, player standing at the hearth site).
//
// Also records a movement receipt (player world position before/after a held W)
// to prove the sealed-box finding is an enclosure fact, not a dead input path.
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
const { chromium } = await import(
  '/home/thomasphillip/Projects/vox/main/node_modules/playwright-core/index.mjs'
);

const RUN_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT_DIR = path.join(RUN_DIR, 'evidence', 'baseline');
const BASE = process.env.VOX_BASE ?? 'http://localhost:5176';
fs.mkdirSync(OUT_DIR, { recursive: true });

const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter(d => /^chromium-\d+$/.test(d)).sort().pop();

const READ = async () => {
  const w = window;
  const hud = document.querySelector('[data-story-guidance-hud]');
  const out = {
    beat: w.__storyBeat ?? null,
    objectiveId: hud?.getAttribute('data-objective-id') ?? null,
    markerLabel: hud?.getAttribute('data-objective-marker-label') ?? null,
    health: hud?.getAttribute('data-objective-health') ?? null,
    hudText: hud ? hud.innerText.replace(/\s*\n\s*/g, ' | ').trim() : null,
    playerPosition: w.__voxelDebug?.player?.position ?? null,
    thermalStatus: (document.body.innerText.match(/[◆●▲○—]\s*[A-Z ]+/) ?? [null])[0]
  };
  try {
    const clock = await import('/src/game/worldClock.ts');
    out.dayPhase = clock.getCurrentDayPhase();
  } catch (e) { out.dayPhaseError = String(e).slice(0, 160); }
  try {
    const gfx = await import('/src/config/graphicsSettings.ts');
    out.qualityProfile = gfx.getQualityProfile();
  } catch (e) { out.qualityProfileError = String(e).slice(0, 160); }
  try {
    const reality = await import('/src/game/systems/realityRenderSystem.ts');
    out.realityStage = reality.getVoxelRealityStage();
  } catch (e) { out.realityError = String(e).slice(0, 160); }
  try {
    const policy = await import('/src/story/storyInputPolicy.ts');
    const p = policy.getStoryInputPolicy();
    out.inputPolicy = { lookMode: p.lookMode, targetFov: p.targetFov, targetDpr: p.targetDpr };
  } catch (e) { out.policyError = String(e).slice(0, 160); }
  return out;
};

const browser = await chromium.launch({
  executablePath: path.join(pwDir, chromeDir, 'chrome-linux/chrome'),
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720']
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e).slice(0, 300)));

const url = `${BASE}/?story=ch9-hearth&profile=LOW`;
const report = { capturedAt: new Date().toISOString(), url, viewport: '1280x720',
  qualityTierRequested: 'LOW', shots: [], pageErrors };
const t0 = Date.now();
await page.goto(url, { waitUntil: 'load', timeout: 90000 });
await new Promise(r => setTimeout(r, 20000));
report.stateAtEntry = await page.evaluate(READ);

// Hold until deep night. Night opens at ~phase 0.505 (utils/nightState.ts); the
// hearth's own rest window is night, so the ST-0-relevant sky is the dark one.
const NIGHT_TARGET = 0.62;
const waitStart = Date.now();
let phase = report.stateAtEntry.dayPhase ?? 0;
while (phase < NIGHT_TARGET && Date.now() - waitStart < 400000) {
  await new Promise(r => setTimeout(r, 5000));
  phase = await page.evaluate(async () => (await import('/src/game/worldClock.ts')).getCurrentDayPhase())
    .catch(() => phase);
}
report.nightWait = { seconds: Math.round((Date.now() - waitStart) / 1000), dayPhase: phase };

await page.mouse.click(640, 400);
await new Promise(r => setTimeout(r, 800));
report.pointerLock = await page.evaluate(() => (document.pointerLockElement
  ? document.pointerLockElement.tagName : null));

// Movement receipt.
const before = await page.evaluate(() => window.__voxelDebug?.player?.position ?? null);
await page.keyboard.down('w');
await new Promise(r => setTimeout(r, 2500));
await page.keyboard.up('w');
await new Promise(r => setTimeout(r, 600));
const after = await page.evaluate(() => window.__voxelDebug?.player?.position ?? null);
report.movementReceipt = { before, after, moved: !!(before && after
  && Math.hypot(after[0] - before[0], after[1] - before[1], after[2] - before[2]) > 0.5) };

const look = async (steps) => {
  for (let i = 0; i < steps; i++) {
    await page.evaluate(() => document.dispatchEvent(
      new MouseEvent('mousemove', { movementX: 0, movementY: -20, bubbles: true })));
    await new Promise(r => setTimeout(r, 60));
  }
  await new Promise(r => setTimeout(r, 900));
};

const shoot = async (label) => {
  const s = await page.evaluate(READ);
  const at = Math.round((Date.now() - t0) / 1000);
  const name = `sky_${String(at).padStart(3, '0')}s_${s.beat ?? 'null'}_${label}.png`;
  await page.screenshot({ path: path.join(OUT_DIR, name) });
  report.shots.push({ file: `evidence/baseline/${name}`, label, t: at, state: s });
};

await look(10);
await shoot('outdoor-sky-mid');
await look(10);
await shoot('outdoor-sky-zenith');

report.durationSeconds = Math.round((Date.now() - t0) / 1000);
const OUT = path.join(OUT_DIR, 'sky-baseline-trace.json');
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
await browser.close();
console.log('moved =', report.movementReceipt.moved, 'shots =', report.shots.length,
  'pageErrors =', pageErrors.length);
console.log('wrote', OUT);
