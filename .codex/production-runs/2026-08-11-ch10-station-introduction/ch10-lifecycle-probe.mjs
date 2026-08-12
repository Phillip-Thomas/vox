// Objective lifecycle rehearsal against the amended runtime: every ch10
// objective's enter -> ready -> progress -> complete/replace/clear transition,
// with the feedback-cue count per activation, the marker label and health, and
// the standing work order exactly as the HUD paints it.
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
  if (window.__voxTap) return true;
  const cues = await import('/src/story/ux/feedbackCues.ts');
  window.__voxFeedbackLog = [];
  window.__voxTap = cues.subscribeStoryUxFeedback(cue => {
    window.__voxFeedbackLog.push({ at: Math.round(performance.now()), cue, beat: window.__storyBeat ?? null });
  });
  return true;
};

const READ = async () => {
  const hud = document.querySelector('[data-story-guidance-hud]');
  const caption = document.querySelector('[data-story-caption]');
  const out = {
    beat: window.__storyBeat ?? null,
    objectiveId: hud?.getAttribute('data-objective-id') ?? null,
    markerLabel: hud?.getAttribute('data-objective-marker-label') ?? null,
    health: hud?.getAttribute('data-objective-health') ?? null,
    requiresMarker: hud?.getAttribute('data-objective-requires-marker') ?? null,
    workOrder: hud ? hud.innerText.replace(/\s*\n\s*/g, ' | ').trim() : null,
    caption: caption ? caption.innerText.trim() : null,
    cues: (window.__voxFeedbackLog ?? []).slice()
  };
  // The on-world marker chip the shared marker resolves, verbatim.
  const chip = Array.from(document.querySelectorAll('div'))
    .map(el => (el.innerText || '').trim())
    .find(t => /·\s*\d+m$/.test(t) && t.length < 90);
  out.markerChip = chip ?? null;
  try {
    const av = await import('/src/story/signedSceneAvRuntime.ts');
    const s = av.getSignedSceneAvDebugSnapshot();
    out.anchorId = s.anchorId; out.anchorHistory = s.activationHistoryAnchorIds ?? [];
  } catch { /* ignore */ }
  return out;
};

const COMMIT = fn => new Function('return (async () => { const d = await import("/src/story/emergentStoryDirector.ts"); return d.' + fn + '(); })()');

const browser = await chromium.launch({
  executablePath: path.join(pwDir, chromeDir, 'chrome-linux/chrome'),
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720']
});

const report = { capturedAt: new Date().toISOString(), base: BASE, scenarios: [] };
const OUT = path.join(OUT_DIR, 'ch10-lifecycle-trace.json');
const flush = () => fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');

async function scenario(id, url, steps, settleMs = 14000) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
  await page.goto(`${BASE}/${url}`, { waitUntil: 'load', timeout: 120000 });
  await page.evaluate(TAP).catch(() => {});
  await new Promise(r => setTimeout(r, settleMs));
  const transitions = [];
  for (const step of steps) {
    if (step.commit) await page.evaluate(COMMIT(step.commit)).catch(e => { step.commitError = String(e).slice(0, 120); });
    if (step.waitMs) await new Promise(r => setTimeout(r, step.waitMs));
    const s = await page.evaluate(READ);
    transitions.push({ scenario: id, step: step.label, beat: s.beat, objectiveId: s.objectiveId,
      markerLabel: s.markerLabel, markerChip: s.markerChip, health: s.health,
      requiresMarker: s.requiresMarker, workOrder: s.workOrder, caption: s.caption,
      anchorId: s.anchorId, cueCount: s.cues.length,
      cueTypes: s.cues.map(c => (typeof c.cue === 'object' ? (c.cue.type ?? c.cue.kind ?? JSON.stringify(c.cue).slice(0, 60)) : String(c.cue))),
      commitError: step.commitError ?? null });
    flush();
  }
  const feedbackLog = await page.evaluate(() => window.__voxFeedbackLog ?? []).catch(() => []);
  report.scenarios.push({ id, url, transitions, feedbackLog, pageErrors: errs });
  flush();
  console.log(`[${id}] ${transitions.length} steps, cues=${feedbackLog.length}, errs=${errs.length}`);
  await page.close();
}

await scenario('ch10-cold deep link', '?story=ch10-cold&profile=LOW', [
  { label: 'entry' },
  { label: 'after-refused-out-of-order-fabrication', commit: 'commitChapter10FabricationAttempt', waitMs: 2500 },
  { label: 'after-fault-read', commit: 'commitChapter10FaultRead', waitMs: 3000 },
  { label: 'after-fabrication-refused', commit: 'commitChapter10FabricationAttempt', waitMs: 3500 },
  { label: 'beat-exit', waitMs: 6000 }
]);

await scenario('ch10-ask deep link', '?story=ch10-ask&profile=LOW', [
  { label: 'entry' },
  { label: 'after-relay-request', commit: 'commitChapter10RelayRequest', waitMs: 3000 },
  { label: 'after-relay-answer', waitMs: 3500 },
  { label: 'after-bearing-claim', commit: 'commitChapter10BearingClaim', waitMs: 3500 },
  { label: 'post-claim-marker-state', waitMs: 4000 }
]);

await scenario('ch10-transit deep link', '?story=ch10-transit&profile=LOW', [
  { label: 'entry-T1-ignite' },
  { label: 'after-30s-standing', waitMs: 30000 },
  { label: 'after-60s-standing', waitMs: 30000 }
]);

await scenario('ch10-transit movie lane', '?story=ch10-transit&movie=1&profile=LOW', [
  { label: 'entry-T1-ignite' },
  { label: 'after-60s-movie', waitMs: 60000 },
  { label: 'after-120s-movie', waitMs: 60000 }
]);

await browser.close();
flush();
console.log('wrote', OUT);
