// LOW-tier headless frame-rate baseline for the ch7/ch8 copy-repair run.
// Deep links without `movie=1` so each beat holds still while rAF is counted.
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
const { chromium } = await import(
  '/home/thomasphillip/Projects/vox/main/node_modules/playwright-core/index.mjs'
);

const RUN_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(RUN_DIR, 'evidence-hires', 'fps-baseline.json');
const BASE = process.env.VOX_BASE ?? 'http://localhost:5176';
const BEATS = ['ch7-reconstruct', 'ch7-board', 'ch8-launch'];
const SETTLE_MS = 12000;
const SAMPLE_MS = 3000;
const SAMPLES = 3;

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

const results = { capturedAt: new Date().toISOString(), viewport: '1280x720', qualityTier: 'LOW', beats: [] };
for (const beat of BEATS) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`${BASE}/?story=${beat}&profile=LOW`, { waitUntil: 'load', timeout: 90000 })
    .catch(() => {});
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
  results.beats.push({ beat, liveBeat, renderer, fps, median: fps.slice().sort((a, b) => a - b)[Math.floor(SAMPLES / 2)] });
  console.log(beat, 'live=' + liveBeat, 'fps=' + fps.join(','), 'renderer=' + renderer);
  await page.close();
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
await browser.close();
console.log('wrote', OUT);
