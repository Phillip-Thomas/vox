// Post-implementation LOW-tier frame-rate probe.
// Part A mirrors fps-baseline-probe.mjs exactly (same beats, deep links without
// movie, same settle/sample shape) so the medians are comparable.
// Part B counts rAF INSIDE the implemented ch8 exit-hold window.
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
const { chromium } = await import(
  '/home/thomasphillip/Projects/vox/main/node_modules/playwright-core/index.mjs'
);

const RUN_DIR = path.dirname(new URL(import.meta.url).pathname);
const outIdx = process.argv.indexOf('--out');
const OUT = outIdx >= 0
  ? path.join(RUN_DIR, 'evidence', process.argv[outIdx + 1], 'fps-verification.json')
  : path.join(RUN_DIR, 'evidence', 'verification', 'fps-verification.json');
const BASE = process.env.VOX_BASE ?? 'http://localhost:5176';
const BEATS = ['ch7-reconstruct', 'ch7-board', 'ch8-launch'];
const SETTLE_MS = 12000;
const SAMPLE_MS = 3000;
const SAMPLES = 3;
const BASELINE = { 'ch7-reconstruct': 60.12, 'ch7-board': 60.11, 'ch8-launch': 60.08 };

const COUNT = (ms) => new Promise(resolve => {
  let frames = 0;
  const start = performance.now();
  const step = () => {
    frames++;
    if (performance.now() - start >= ms) resolve({ frames, elapsedMs: performance.now() - start });
    else requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
});

const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter(d => /^chromium-\d+$/.test(d)).sort().pop();
const browser = await chromium.launch({
  executablePath: path.join(pwDir, chromeDir, 'chrome-linux/chrome'),
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720']
});

const results = {
  capturedAt: new Date().toISOString(), viewport: '1280x720', qualityTier: 'LOW',
  baselineMedians: BASELINE, floorFps: 55, ceilingFrameTimeMs: 18.2, beats: [], holdWindow: null
};

for (const beat of BEATS) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`${BASE}/?story=${beat}&profile=LOW`, { waitUntil: 'load', timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(SETTLE_MS);
  const liveBeat = await page.evaluate(() => window.__storyBeat ?? null);
  const renderer = await page.evaluate(() => {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') ?? c.getContext('webgl');
    if (!gl) return null;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  });
  const fps = [];
  for (let i = 0; i < SAMPLES; i++) {
    const sample = await page.evaluate(COUNT, SAMPLE_MS);
    fps.push(Number((sample.frames / (sample.elapsedMs / 1000)).toFixed(2)));
    await page.waitForTimeout(400);
  }
  const median = fps.slice().sort((a, b) => a - b)[Math.floor(SAMPLES / 2)];
  results.beats.push({
    beat, liveBeat, renderer, fps, median,
    baselineMedian: BASELINE[beat],
    deltaVsBaseline: Number((median - BASELINE[beat]).toFixed(2)),
    frameTimeMs: Number((1000 / median).toFixed(2)),
    passFloor: median >= 55, passCeiling: 1000 / median <= 18.2
  });
  console.log(beat, 'live=' + liveBeat, 'median=' + median, 'baseline=' + BASELINE[beat]);
  await page.close();
}

// Part B: fps inside the implemented ch8 hold window.
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`${BASE}/?story=ch8-launch&movie=1&profile=LOW`, { waitUntil: 'load', timeout: 90000 }).catch(() => {});
  await page.evaluate(async () => {
    const st = await import('/src/story/storyText.ts');
    window.__l4 = null;
    st.subscribeStoryText(() => {
      const s = st.getStoryText();
      if (s.caption && s.caption.text.startsWith('i came down this line') && window.__l4 === null) {
        window.__l4 = performance.now();
      }
    });
  });
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    const hit = await page.evaluate(() => window.__l4);
    if (hit !== null) break;
    await new Promise(r => setTimeout(r, 40));
  }
  const fps = [];
  for (let i = 0; i < 5; i++) {
    const sample = await page.evaluate(COUNT, SAMPLE_MS);
    fps.push(Number((sample.frames / (sample.elapsedMs / 1000)).toFixed(2)));
  }
  const median = fps.slice().sort((a, b) => a - b)[Math.floor(fps.length / 2)];
  const beat = await page.evaluate(() => window.__storyBeat ?? null);
  results.holdWindow = {
    label: 'ch8-launch exit hold (+0.0 to ~+15 s off the L4 caption)',
    beatAtEnd: beat, fps, median,
    frameTimeMs: Number((1000 / median).toFixed(2)),
    passFloor: median >= 55
  };
  console.log('hold window median=', median, 'beatAtEnd=', beat);
  await page.close();
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
await browser.close();
console.log('wrote', OUT);
