// Reload-safety, driven at the level the repair actually claims: the chapter-10
// score state is a pure function of the DURABLE milestones, so a quit/reload
// must restore the same carrier and the same pulse as an uninterrupted run.
//
// The movie lane cannot be used for this (the ship never leaves the ground —
// see ch10-launch-stall.json), so the durable facts are marked through the
// shipped progression system and the score state is compared across a real
// browser reload. Both the pure resolver output and the live runtime snapshot
// are recorded on each side.
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

const READ_SCORE = async () => {
  const out = { beat: window.__storyBeat ?? null };
  const score = await import('/src/story/emergentScoreDirector.ts');
  const storyScore = await import('/src/story/storyScore.ts');
  const milestones = score.chapter10ScoreMilestones();
  out.milestones = milestones;
  out.live = score.getChapter10ScoreSnapshot();
  out.pure = score.resolveChapter10ScoreState(window.__storyBeat ?? null, milestones);
  out.mood = window.__storyBeat ? storyScore.getStoryScoreMood(window.__storyBeat) : null;
  out.moodForPure = out.pure.variant
    ? storyScore.getChapter10ScoreMood(out.pure.variant, out.pure.carrierAlive)
    : null;
  return out;
};

const MARK = async (keys) => {
  const st = await import('/src/story/storyState.ts');
  const prog = await import('/src/game/systems/progressionSystem.ts');
  for (const k of keys) prog.markMilestone(st.STORY_MILESTONES[k]);
  return keys.map(k => st.STORY_MILESTONES[k]);
};

const browser = await chromium.launch({
  executablePath: path.join(pwDir, chromeDir, 'chrome-linux/chrome'),
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720']
});

const report = { capturedAt: new Date().toISOString(), base: BASE,
  note: 'milestones are marked through the shipped progression system because the movie lane cannot fly the transit (see ch10-launch-stall.json)',
  checkpoints: [] };
const OUT = path.join(OUT_DIR, 'ch10-reload-purity.json');
const flush = () => fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
await page.goto(`${BASE}/?story=ch10-transit&profile=LOW`, { waitUntil: 'load', timeout: 120000 });
await new Promise(r => setTimeout(r, 15000));

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

for (const step of [
  { id: 'transit-hold-entry', mark: [] },
  { id: 'mid-transit-after-ignite', mark: ['ch10TransitIgnited'] },
  { id: 'mid-transit-after-seam', mark: ['ch10SeamPassed'] },
  { id: 'at-station-resolved', mark: ['ch10StationResolved'] }
]) {
  if (step.mark.length) {
    await page.evaluate(MARK, step.mark);
    await new Promise(r => setTimeout(r, 2500));
  }
  const uninterrupted = await page.evaluate(READ_SCORE);
  await page.reload({ waitUntil: 'load', timeout: 120000 });
  await new Promise(r => setTimeout(r, 15000));
  const afterReload = await page.evaluate(READ_SCORE);
  report.checkpoints.push({
    id: step.id, marked: step.mark, uninterrupted, afterReload,
    milestonesSurvived: same(uninterrupted.milestones, afterReload.milestones),
    variantIdentical: uninterrupted.pure.variant === afterReload.pure.variant,
    carrierIdentical: uninterrupted.pure.carrierAlive === afterReload.pure.carrierAlive,
    liveVariantIdentical: uninterrupted.live.variant === afterReload.live.variant,
    liveCarrierIdentical: uninterrupted.live.carrierAlive === afterReload.live.carrierAlive,
    liveIntensityIdentical: uninterrupted.live.intensity === afterReload.live.intensity,
    moodIdentical: same(uninterrupted.mood, afterReload.mood),
    liveAgreesWithPureBefore: uninterrupted.live.variant === uninterrupted.pure.variant
      && uninterrupted.live.carrierAlive === uninterrupted.pure.carrierAlive,
    liveAgreesWithPureAfter: afterReload.live.variant === afterReload.pure.variant
      && afterReload.live.carrierAlive === afterReload.pure.carrierAlive
  });
  flush();
  const c = report.checkpoints[report.checkpoints.length - 1];
  console.log(`[${step.id}] variant ${uninterrupted.live.variant}->${afterReload.live.variant}`
    + ` carrier ${uninterrupted.live.carrierAlive}->${afterReload.live.carrierAlive}`
    + ` intensity ${uninterrupted.live.intensity}->${afterReload.live.intensity}`
    + ` moodIdentical=${c.moodIdentical} pureAgrees=${c.liveAgreesWithPureBefore}/${c.liveAgreesWithPureAfter}`);
}
report.pageErrors = errs;
report.allIdentical = report.checkpoints.every(c => c.liveVariantIdentical && c.liveCarrierIdentical
  && c.liveIntensityIdentical && c.moodIdentical);
flush();
await page.close();
await browser.close();
console.log('wrote', OUT);
