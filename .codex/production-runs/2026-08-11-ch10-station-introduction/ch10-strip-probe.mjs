// Stage 6 item 7: LOW frame strips (8 frames each, before/at/after the named
// anchors) plus the three HIGH hero stills. Budget-bound: LOW strips only, and
// exactly three HIGH stills at their named anchors. No webm, no movie render.
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
const { chromium } = await import(
  '/home/thomasphillip/Projects/vox/main/node_modules/playwright-core/index.mjs'
);

const RUN_DIR = path.dirname(new URL(import.meta.url).pathname);
const CAP_DIR = path.join(RUN_DIR, 'evidence', 'capture');
const BASE = process.env.VOX_BASE ?? 'http://localhost:5176';
fs.mkdirSync(CAP_DIR, { recursive: true });
const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter(d => /^chromium-\d+$/.test(d)).sort().pop();

const READ = async () => {
  const w = window;
  const hud = document.querySelector('[data-story-guidance-hud]');
  const caption = document.querySelector('[data-story-caption]');
  const lives = Array.from(document.querySelectorAll('div[aria-live="polite"]'));
  const band = lives.find(el => !el.hasAttribute('data-story-caption') && !el.hasAttribute('data-story-guidance-hud'));
  const out = { beat: w.__storyBeat ?? null,
    objectiveId: hud?.getAttribute('data-objective-id') ?? null,
    markerLabel: hud?.getAttribute('data-objective-marker-label') ?? null,
    hudText: hud ? hud.innerText.replace(/\s*\n\s*/g, ' | ').trim() : null,
    caption: caption ? caption.innerText.trim() : null,
    band: band ? band.innerText.replace(/\s*\n\s*/g, ' | ').trim() : null };
  try {
    const av = await import('/src/story/signedSceneAvRuntime.ts');
    const s = av.getSignedSceneAvDebugSnapshot();
    out.anchorId = s.anchorId; out.history = s.activationHistoryAnchorIds ?? [];
    out.authority = s.shot?.cameraAuthority ?? null; out.fov = s.shot?.lens?.appliedFovDeg ?? null;
  } catch { /* ignore */ }
  return out;
};

const browser = await chromium.launch({
  executablePath: path.join(pwDir, chromeDir, 'chrome-linux/chrome'),
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720']
});

const report = { capturedAt: new Date().toISOString(), base: BASE, strips: [], stills: [] };
const OUT = path.join(CAP_DIR, 'capture-manifest.json');
const flush = () => fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

async function strip(id, url, opts, plan) {
  const dir = path.join(CAP_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  const page = await browser.newPage({
    viewport: opts.viewport ?? { width: 1280, height: 720 },
    isMobile: !!opts.isMobile, hasTouch: !!opts.isMobile,
    reducedMotion: opts.reducedMotion ?? 'no-preference'
  });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(`${BASE}/${url}`, { waitUntil: 'load', timeout: 90000 });
  await new Promise(r => setTimeout(r, opts.settleMs ?? 10000));
  const frames = [];
  const t0 = Date.now();
  for (const [index, step] of plan.entries()) {
    if (step.waitMs) await new Promise(r => setTimeout(r, step.waitMs));
    if (step.action) await page.evaluate(step.action).catch(() => {});
    if (step.afterActionMs) await new Promise(r => setTimeout(r, step.afterActionMs));
    const st = await page.evaluate(READ);
    const t = ((Date.now() - t0) / 1000).toFixed(1);
    const file = `${String(index).padStart(2, '0')}_${step.label}_${st.beat ?? 'null'}.png`;
    await page.screenshot({ path: path.join(dir, file) });
    frames.push({ file: `evidence/capture/${id}/${file}`, label: step.label, tSeconds: Number(t), ...st });
  }
  await page.close();
  report.strips.push({ id, url, tier: opts.tier ?? 'LOW', viewport: opts.viewport ? `${opts.viewport.width}x${opts.viewport.height}` : '1280x720',
    reducedMotion: opts.reducedMotion === 'reduce', frameCount: frames.length, frames, pageErrors: errs });
  flush();
  console.log(`[${id}] ${frames.length} frames, errors=${errs.length}`);
}

const commit = fn => `async () => { const d = await import('/src/story/emergentStoryDirector.ts'); return d.${fn}(); }`;
const ev = src => new Function(`return (${src})()`);

// strip-cold-a: entry seam + cold-noticed + fault-read
await strip('strip-cold-a', '?story=ch10-cold&profile=LOW', {}, [
  { label: 'shelter-pre-activation' },
  { label: 'cold-noticed-before', waitMs: 1500 },
  { label: 'cold-noticed-at', waitMs: 1500 },
  { label: 'cold-noticed-after', waitMs: 2500 },
  { label: 'K1-painted', waitMs: 2500 },
  { label: 'fault-read-before', waitMs: 1500 },
  { label: 'fault-read-at', action: async () => {
    const d = await import('/src/story/emergentStoryDirector.ts'); return d.commitChapter10FaultRead();
  }, afterActionMs: 900 },
  { label: 'fault-read-after', waitMs: 3500 }
]);

// strip-cold-b: fabrication refusal + beat exit
await strip('strip-cold-b', '?story=ch10-cold&profile=LOW', {}, [
  { label: 'egress-face-pre' },
  { label: 'egress-face-post', waitMs: 2000 },
  { label: 'fabrication-refused-before', action: async () => {
    const d = await import('/src/story/emergentStoryDirector.ts'); return d.commitChapter10FaultRead();
  }, afterActionMs: 3000 },
  { label: 'fabrication-refused-at', action: async () => {
    const d = await import('/src/story/emergentStoryDirector.ts'); return d.commitChapter10FabricationAttempt();
  }, afterActionMs: 900 },
  { label: 'fabrication-refused-after', waitMs: 2500 },
  { label: 'refusal-band-dwell', waitMs: 2500 },
  { label: 'beat-exit-guidance', waitMs: 3000 },
  { label: 'ask-fresh-entry', waitMs: 4000 }
]);

// strip-ask-b: relay ask, answer (consecutive frames), bearing claim
await strip('strip-ask-b', '?story=ch10-ask&profile=LOW', {}, [
  { label: 'relay-ask-before' },
  { label: 'relay-ask-at', action: async () => {
    const d = await import('/src/story/emergentStoryDirector.ts'); return d.commitChapter10RelayRequest();
  }, afterActionMs: 600 },
  { label: 'relay-answer-at', waitMs: 1200 },
  { label: 'relay-answer-after', waitMs: 700 },
  { label: 'bearing-claimed-before', waitMs: 2500 },
  { label: 'bearing-claimed-at', action: async () => {
    const d = await import('/src/story/emergentStoryDirector.ts'); return d.commitChapter10BearingClaim();
  }, afterActionMs: 900 },
  { label: 'bearing-claimed-after', waitMs: 2500 },
  { label: 'marker-state-post-claim', waitMs: 3000 }
]);

// strip-transit-a / -b at LOW, and the reduced-motion transit strip
const transitPlan = [
  { label: 'transit-ignite-before' },
  { label: 'transit-ignite-at', waitMs: 3000 },
  { label: 'transit-ignite-after', waitMs: 4000 },
  { label: 'T2-hold-marker', waitMs: 6000 },
  { label: 'seam-before', waitMs: 8000 },
  { label: 'seam-at', waitMs: 8000 },
  { label: 'seam-after', waitMs: 6000 },
  { label: 'galaxy-absence-check', waitMs: 6000 }
];
await strip('strip-transit-a', '?story=ch10-transit&movie=1&profile=LOW', { settleMs: 12000 }, transitPlan);

const transitBPlan = [
  { label: 'station-resolved-before', waitMs: 20000 },
  { label: 'station-resolved-at', waitMs: 10000 },
  { label: 'hold-mid', waitMs: 1200 },
  { label: 'hold-release', waitMs: 1500 },
  { label: 'K11-painted', waitMs: 2000 },
  { label: 'work-order-cleared', waitMs: 3000 },
  { label: 'threshold-handback-at', waitMs: 4000 },
  { label: 'threshold-handback-after', waitMs: 5000 }
];
await strip('strip-transit-b', '?story=ch10-transit&movie=1&profile=LOW', { settleMs: 14000 }, transitBPlan);
await strip('strip-rm-transit', '?story=ch10-transit&movie=1&profile=LOW',
  { settleMs: 14000, reducedMotion: 'reduce' }, transitBPlan);

// --- three HIGH hero stills ------------------------------------------------
async function still(id, url, opts, plan, target) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(`${BASE}/${url}`, { waitUntil: 'load', timeout: 120000 });
  await new Promise(r => setTimeout(r, opts.settleMs ?? 25000));
  for (const step of plan) {
    if (step.action) await page.evaluate(step.action).catch(() => {});
    if (step.waitMs) await new Promise(r => setTimeout(r, step.waitMs));
  }
  const st = await page.evaluate(READ);
  const file = path.join(CAP_DIR, `${id}.png`);
  await page.screenshot({ path: file });
  report.stills.push({ id, file: `evidence/capture/${id}.png`, url, tier: 'HIGH',
    viewport: '1280x720', target, ...st, pageErrors: errs });
  flush();
  await page.close();
  console.log(`[still ${id}] beat=${st.beat} anchor=${st.anchorId}`);
}

await still('still-st0-sighting', '?story=ch10-cold&profile=HIGH', { settleMs: 40000 }, [
  { action: async () => {
    for (let i = 0; i < 14; i++) document.dispatchEvent(new MouseEvent('mousemove', { movementX: 0, movementY: -20, bubbles: true }));
  }, waitMs: 4000 }
], 'ST-0 near true-bearing crossing from the hearth at night');

await still('still-seam-of-light', '?story=ch10-transit&movie=1&profile=HIGH', { settleMs: 60000 }, [],
  'seam anchor + 0: canopy aperture, seam centered, no galaxy in aperture');

await still('still-station-resolved', '?story=ch10-transit&movie=1&profile=HIGH', { settleMs: 90000 }, [],
  'run cut line: standoff 1500, K11 painted, work order cleared');

await browser.close();
flush();
console.log('wrote', OUT);
