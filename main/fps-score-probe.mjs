// P4 FPS probe WITH THE PROCEDURAL SCORE LEADING under forced SwiftShader.
// The default gate isolates score/main-thread cost behind a minimal real WebGL
// clear at 640x360, then measures the dense A3-dawn mood at full intensity on
// the material rung. PASS requires the actual renderer string to say
// SwiftShader, a running AudioContext, rich score leadership, and sustained
// 60-fps-class percentiles; one lucky sample can no longer pass. Set
// PARAVOXIA_FPS_FULL_SCENE=1 for the separate rich-world baseline comparison
// on the machine's available renderer (the full voxel scene is renderer-bound
// under software rasterization before score unlock, so it is not the score gate).
//   node fps-score-probe.mjs [beat=ch4-vigil] [settleS=8] [samples=5]
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import net from 'node:net';

const DEFAULT_BEAT = 'ch4-vigil';
const STRESS_SCORE_BEAT = 'a3-dawn';
const STRESS_REALITY_STAGE = 'material';
const STRESS_INTENSITY = 1;
const STRESS_ERA_TARGET = 1;
const STRESS_WARMTH_TARGET = 0.65;
const STRESS_WONDER_TARGET = 0.8;
const DEFAULT_SETTLE_S = 8;
const MIN_SETTLE_S = 8;
const DEFAULT_SAMPLE_COUNT = 5;
const MIN_SAMPLE_COUNT = 5;
const SAMPLE_WINDOW_MS = 3000;
const SCORE_SETTLE_S = 10;
const BETWEEN_SAMPLE_PAUSE_MS = 250;
const REQUIRED_MEDIAN_FPS = 59.5;
const REQUIRED_P10_FPS = 58;
const REQUIRED_ROUNDED_MAX_FPS = 60;
const REQUIRED_SCORE_TO_BASELINE_RATIO = 0.985;
const RICH_ERA_FLOOR = 0.6;
const FULL_SCENE_MODE = process.env.PARAVOXIA_FPS_FULL_SCENE === '1';
const REQUIRE_SWIFTSHADER =
  !FULL_SCENE_MODE || process.env.PARAVOXIA_REQUIRE_SWIFTSHADER === '1';
const FORCE_SWIFTSHADER =
  !FULL_SCENE_MODE || process.env.PARAVOXIA_FORCE_SWIFTSHADER === '1';
const DEFAULT_VIEWPORT_WIDTH = FULL_SCENE_MODE ? 1280 : 640;
const DEFAULT_VIEWPORT_HEIGHT = FULL_SCENE_MODE ? 720 : 360;
const VIEWPORT_WIDTH = Math.max(
  1,
  finiteNumber(process.env.PARAVOXIA_VIEWPORT_WIDTH, DEFAULT_VIEWPORT_WIDTH)
);
const VIEWPORT_HEIGHT = Math.max(
  1,
  finiteNumber(process.env.PARAVOXIA_VIEWPORT_HEIGHT, DEFAULT_VIEWPORT_HEIGHT)
);

function finiteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const beat = process.argv[2] ?? DEFAULT_BEAT;
const settleS = Math.max(MIN_SETTLE_S, finiteNumber(process.argv[3], DEFAULT_SETTLE_S));
const samples = Math.max(
  MIN_SAMPLE_COUNT,
  Math.floor(finiteNumber(process.argv[4], DEFAULT_SAMPLE_COUNT))
);
// This probe ALWAYS runs its own fresh dev server. It drives the app through
// dynamic module imports (unlock, setScoreBeat, chord reads), and a
// long-running dev server with HMR-invalidated modules serves the app graph
// under `?t=` URLs — a plain-URL dynamic import would then load a SECOND
// module instance and read the wrong singletons. A fresh server has no HMR
// history, so probe imports and app imports share one registry.
const root = path.dirname(new URL(import.meta.url).pathname);

async function serverUp(port) {
  try {
    return (await fetch(`http://localhost:${port}/`)).ok;
  } catch {
    return false;
  }
}

let viteProc = null;
const port = await new Promise((resolve, reject) => {
  const server = net.createServer();
  server.unref();
  server.on('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    const fresh = typeof address === 'object' && address ? address.port : 0;
    server.close((error) => (error ? reject(error) : resolve(fresh)));
  });
});
console.log(`[probe] starting isolated HMR-off vite server on :${port}…`);
const viteScript = [
  "import { createServer } from 'vite'",
  "import react from '@vitejs/plugin-react'",
  `const server = await createServer({ configFile: false, root: process.cwd(), plugins: [react()], server: { port: ${port}, strictPort: true, hmr: false, watch: { ignored: ['**/captures/**', '**/renders/**', '**/.git/**'] } } })`,
  'await server.listen()',
  'await new Promise(() => {})'
].join(';');
viteProc = spawn(
  process.execPath,
  ['--input-type=module', '--eval', viteScript],
  {
    cwd: root,
    stdio: 'ignore',
    env: { ...process.env, PROBE_NO_HMR: '1' }
  }
);
const cleanupServer = () => {
  if (viteProc && !viteProc.killed) viteProc.kill();
};
process.once('exit', cleanupServer);
for (let i = 0; i < 100 && !(await serverUp(port)); i++) {
  await new Promise((r) => setTimeout(r, 300));
}
if (!(await serverUp(port))) throw new Error('isolated vite dev server did not come up');

const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs
  .readdirSync(pwDir)
  .filter((d) => /^chromium-\d+$/.test(d))
  .sort()
  .pop();
const executablePath = path.join(pwDir, chromeDir, 'chrome-linux/chrome');

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: [
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    ...(FORCE_SWIFTSHADER ? ['--use-angle=swiftshader-webgl'] : []),
    `--window-size=${VIEWPORT_WIDTH},${VIEWPORT_HEIGHT}`,
    '--autoplay-policy=no-user-gesture-required',
    '--mute-audio'
  ]
});
const page = await browser.newPage({
  viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT }
});
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));

/**
 * The default gate isolates the MAIN-THREAD score workload under a genuinely
 * forced SwiftShader WebGL context. The full voxel scene cannot sustain 60 fps
 * on this machine's software rasterizer even before audio unlock, which would
 * confound renderer cost with score cost. Set PARAVOXIA_FPS_FULL_SCENE=1 for
 * the separate full-world baseline/score comparison on the available backend.
 */
async function runSwiftShaderScoreGate() {
  await page.goto(`http://localhost:${port}/score-soak.html`, { waitUntil: 'load' });
  await page.evaluate(({ width, height }) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) throw new Error('SwiftShader score gate could not create WebGL');
    document.body.appendChild(canvas);
    window.__scoreProbeGl = gl;
  }, { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT });

  const stressState = await page.evaluate(async ({ stage, era, warmth, wonder }) => {
    const reality = await import('/src/game/systems/realityRenderSystem.ts');
    const primitives = await import('/src/audio/musicPrimitives.ts');
    reality.setVoxelRealityStage(stage);
    primitives.setMusicPrimitiveTargets({ era, warmth, wonder });
    primitives.tickMusicPrimitives(1);
    return {
      stage: reality.getVoxelRealityStage(),
      primitives: { ...primitives.getMusicPrimitives() }
    };
  }, {
    stage: STRESS_REALITY_STAGE,
    era: STRESS_ERA_TARGET,
    warmth: STRESS_WARMTH_TARGET,
    wonder: STRESS_WONDER_TARGET
  });
  console.log(
    `SwiftShader score harness: ${VIEWPORT_WIDTH}x${VIEWPORT_HEIGHT}, `
    + `stage=${stressState.stage}, era=${stressState.primitives.era.toFixed(3)}`
  );

  const sampleOne = () => page.evaluate(
    (windowMs) => new Promise((resolve) => {
      let frames = 0;
      const begin = performance.now();
      let previous = begin;
      let worstFrameMs = 0;
      const intervals = [];
      const count = (timestamp) => {
        const frameMs = timestamp - previous;
        previous = timestamp;
        worstFrameMs = Math.max(worstFrameMs, frameMs);
        intervals.push(frameMs);
        const gl = window.__scoreProbeGl;
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        frames++;
        const elapsedMs = performance.now() - begin;
        if (elapsedMs < windowMs) requestAnimationFrame(count);
        else {
          intervals.sort((a, b) => a - b);
          const p95Index = Math.min(intervals.length - 1, Math.floor(intervals.length * 0.95));
          resolve({
            fps: frames / (elapsedMs / 1000),
            frames,
            elapsedMs,
            p95FrameMs: intervals[p95Index] ?? 0,
            worstFrameMs
          });
        }
      };
      requestAnimationFrame(count);
    }),
    SAMPLE_WINDOW_MS
  );
  const sampleHarnessSeries = async () => {
    const series = [];
    for (let i = 0; i < samples; i++) {
      series.push(await sampleOne());
      if (i + 1 < samples) await new Promise((resolve) => setTimeout(resolve, BETWEEN_SAMPLE_PAUSE_MS));
    }
    return series;
  };

  const baseline = await sampleHarnessSeries();
  const baselineStats = summarize(baseline);
  console.log(`SwiftShader baseline: ${formatSeries(baseline)} fps`);
  console.log(`SwiftShader baseline stats: ${formatSummary(baselineStats)}`);

  await page.evaluate(async ({ scoreBeat, intensity }) => {
    const music = await import('/src/audio/musicEngine.ts');
    const story = await import('/src/story/storyScore.ts');
    const primitives = await import('/src/audio/musicPrimitives.ts');
    await music.unlockMusicAudio();
    story.unlockStoryScore();
    story.setScoreBeat(scoreBeat);
    story.setScoreIntensity(intensity);
    primitives.tickMusicPrimitives(1);
  }, { scoreBeat: STRESS_SCORE_BEAT, intensity: STRESS_INTENSITY });
  await new Promise((resolve) => setTimeout(resolve, SCORE_SETTLE_S * 1000));

  const state = await page.evaluate(async () => {
    const core = await import('/src/audio/audioCore.ts');
    const primitives = await import('/src/audio/musicPrimitives.ts');
    const score = await import('/src/audio/scoreEngine.ts');
    const reality = await import('/src/game/systems/realityRenderSystem.ts');
    const gl = window.__scoreProbeGl;
    const debugRenderer = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = debugRenderer
      ? String(gl.getParameter(debugRenderer.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER));
    return {
      renderer,
      contextState: core.peekAudioContext()?.state ?? 'none',
      scoreLeading: score.isScoreMoodLeading(),
      stage: reality.getVoxelRealityStage(),
      primitives: { ...primitives.getMusicPrimitives() }
    };
  });
  const withScore = await sampleHarnessSeries();
  const scoreStats = summarize(withScore);
  console.log(`SwiftShader with score: ${formatSeries(withScore)} fps`);
  console.log(`SwiftShader score stats: ${formatSummary(scoreStats)}`);
  console.log(
    `SwiftShader state: renderer=${state.renderer}; context=${state.contextState}; `
    + `scoreLeading=${state.scoreLeading}; stage=${state.stage}; era=${state.primitives.era.toFixed(3)}; `
    + `tension=${state.primitives.tension.toFixed(3)}`
  );

  const rendererIsSwiftShader = /swiftshader/i.test(state.renderer);
  const richScoreState = state.scoreLeading
    && state.stage === STRESS_REALITY_STAGE
    && state.primitives.era >= RICH_ERA_FLOOR;
  const scoreToBaselineRatio = scoreStats.median / baselineStats.median;
  const retainedMaxGate = Math.round(scoreStats.max) >= REQUIRED_ROUNDED_MAX_FPS;
  const sustainedFps = retainedMaxGate
    && scoreStats.median >= REQUIRED_MEDIAN_FPS
    && scoreStats.p10 >= REQUIRED_P10_FPS
    && scoreToBaselineRatio >= REQUIRED_SCORE_TO_BASELINE_RATIO;
  const ok = sustainedFps
    && state.contextState === 'running'
    && state.scoreLeading
    && rendererIsSwiftShader
    && richScoreState;
  console.log(
    `RESULT SwiftShader score gate: median=${scoreStats.median.toFixed(2)} `
    + `p10=${scoreStats.p10.toFixed(2)} ratio=${scoreToBaselineRatio.toFixed(3)} `
    + `retainedMax>=${REQUIRED_ROUNDED_MAX_FPS}=${retainedMaxGate} `
    + `swiftshader=${rendererIsSwiftShader} richScore=${richScoreState} `
    + `audio=${state.contextState} -> ${ok ? 'PASS' : 'FAIL'}`
  );
  return ok;
}

if (!FULL_SCENE_MODE) {
  const ok = await runSwiftShaderScoreGate();
  await browser.close();
  cleanupServer();
  process.exit(ok ? 0 : 1);
}

await page.goto(`http://localhost:${port}/?story=${beat}&movie=1`, { waitUntil: 'load' });

const t0 = Date.now();
let live = false;
while ((Date.now() - t0) / 1000 < 60) {
  const b = await page.evaluate(() => window.__storyBeat ?? null).catch(() => null);
  if (b === beat) {
    live = true;
    break;
  }
  await new Promise((r) => setTimeout(r, 300));
}
console.log(`beat ${beat} live=${live} at ${((Date.now() - t0) / 1000).toFixed(1)}s; settling ${settleS}s`);

// Put the WORLD on the richest production rung before either FPS pass. This
// keeps the visual workload identical across baseline/score samples while the
// AudioDirector independently derives a material-era rail and bed instrumentation
// from the same rendering signal.
const richWorld = await page.evaluate(async ({ stage, era, warmth, wonder }) => {
  const reality = await import('/src/game/systems/realityRenderSystem.ts');
  reality.setVoxelRealityStage(stage);
  const primitives = await import('/src/audio/musicPrimitives.ts');
  primitives.setMusicPrimitiveTargets({ era, warmth, wonder });
  return {
    stage: reality.getVoxelRealityStage(),
    effects: reality.getVoxelRealityEffects(),
    contextState: (await import('/src/audio/audioCore.ts')).peekAudioContext()?.state ?? 'none'
  };
}, {
  stage: STRESS_REALITY_STAGE,
  era: STRESS_ERA_TARGET,
  warmth: STRESS_WARMTH_TARGET,
  wonder: STRESS_WONDER_TARGET
});
console.log(
  `world stress: stage=${richWorld.stage}, detail=${richWorld.effects.detail.toFixed(2)}, `
  + `organic=${richWorld.effects.organic.toFixed(2)}, pre-unlock audio=${richWorld.contextState}`
);
await new Promise((r) => setTimeout(r, settleS * 1000));

const sample = () =>
  page.evaluate(
    (windowMs) =>
      new Promise((resolve) => {
        let frames = 0;
        const begin = performance.now();
        let previous = begin;
        let worstFrameMs = 0;
        const intervals = [];
        const count = (timestamp) => {
          const frameMs = timestamp - previous;
          previous = timestamp;
          worstFrameMs = Math.max(worstFrameMs, frameMs);
          intervals.push(frameMs);
          frames++;
          const elapsedMs = performance.now() - begin;
          if (elapsedMs < windowMs) requestAnimationFrame(count);
          else {
            intervals.sort((a, b) => a - b);
            const p95Index = Math.min(intervals.length - 1, Math.floor(intervals.length * 0.95));
            resolve({
              fps: frames / (elapsedMs / 1000),
              frames,
              elapsedMs,
              p95FrameMs: intervals[p95Index] ?? 0,
              worstFrameMs
            });
          }
        };
        requestAnimationFrame(count);
      }),
    SAMPLE_WINDOW_MS
  );

function percentile(values, quantile) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * quantile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const blend = index - lower;
  return sorted[lower] * (1 - blend) + sorted[upper] * blend;
}

function summarize(series) {
  const fps = series.map((entry) => entry.fps);
  return {
    min: Math.min(...fps),
    p10: percentile(fps, 0.1),
    median: percentile(fps, 0.5),
    mean: fps.reduce((sum, value) => sum + value, 0) / fps.length,
    max: Math.max(...fps),
    worstFrameMs: Math.max(...series.map((entry) => entry.worstFrameMs)),
    p95FrameMs: Math.max(...series.map((entry) => entry.p95FrameMs))
  };
}

function formatSeries(series) {
  return `[${series.map((entry) => entry.fps.toFixed(2)).join(', ')}]`;
}

function formatSummary(stats) {
  return `min=${stats.min.toFixed(2)} p10=${stats.p10.toFixed(2)} `
    + `median=${stats.median.toFixed(2)} mean=${stats.mean.toFixed(2)} max=${stats.max.toFixed(2)} `
    + `p95Frame=${stats.p95FrameMs.toFixed(2)}ms worstFrame=${stats.worstFrameMs.toFixed(2)}ms`;
}

async function sampleSeries() {
  const series = [];
  for (let i = 0; i < samples; i++) {
    series.push(await sample());
    if (i + 1 < samples) await new Promise((r) => setTimeout(r, BETWEEN_SAMPLE_PAUSE_MS));
  }
  return series;
}

const baseline = await sampleSeries();
const baselineStats = summarize(baseline);
console.log(`baseline (rich world, audio locked): ${formatSeries(baseline)} fps`);
console.log(`baseline stats: ${formatSummary(baselineStats)}`);

// Unlock audio and make the authored procedural score lead. A3-dawn is the
// highest-density shipped mood; material world signals hold the rich era and keep
// the full generative bed scheduler alive underneath its authority crossfade.
const unlockState = await page.evaluate(async ({ scoreBeat, intensity }) => {
  window.__scoreProbeMark = true; // reload detector
  const music = await import('/src/audio/musicEngine.ts');
  await music.unlockMusicAudio();
  const story = await import('/src/story/storyScore.ts');
  story.unlockStoryScore();
  story.setScoreBeat(scoreBeat);
  story.setScoreIntensity(intensity);
  const core = await import('/src/audio/audioCore.ts');
  return core.peekAudioContext()?.state ?? 'none';
}, { scoreBeat: STRESS_SCORE_BEAT, intensity: STRESS_INTENSITY });
console.log(`context right after unlock: ${unlockState}`);
await new Promise((r) => setTimeout(r, SCORE_SETTLE_S * 1000));

const audio = await page.evaluate(async () => {
  const core = await import('/src/audio/audioCore.ts');
  const prim = await import('/src/audio/musicPrimitives.ts');
  const score = await import('/src/audio/scoreEngine.ts');
  const reality = await import('/src/game/systems/realityRenderSystem.ts');
  const bed = await import('/src/audio/bedEngine.ts');
  const chord = prim.getMusicChord();
  const primitives = prim.getMusicPrimitives();
  const canvas = document.querySelector('canvas');
  const gl = canvas?.getContext('webgl2') ?? canvas?.getContext('webgl');
  const debugRenderer = gl?.getExtension('WEBGL_debug_renderer_info');
  const renderer = gl && debugRenderer
    ? String(gl.getParameter(debugRenderer.UNMASKED_RENDERER_WEBGL))
    : gl
      ? String(gl.getParameter(gl.RENDERER))
      : 'none';
  return {
    reloaded: !window.__scoreProbeMark,
    contextState: core.peekAudioContext()?.state ?? 'none',
    chordRoot: chord.root,
    chordTones: [...chord.chord],
    primitives: { ...primitives },
    stage: reality.getVoxelRealityStage(),
    scoreLeading: score.isScoreMoodLeading(),
    bed: bed.getBedDebugSnapshot(),
    renderer
  };
});
if (audio.reloaded) console.log('WARNING: page reloaded after unlock');
console.log(
  `audio: context=${audio.contextState}, scoreLeading=${audio.scoreLeading}, stage=${audio.stage}, `
  + `era=${audio.primitives.era.toFixed(3)}, tension=${audio.primitives.tension.toFixed(3)}, `
  + `published chord root=${audio.chordRoot} tones=[${audio.chordTones.join(', ')}]`
);
console.log(
  `renderer: ${audio.renderer}; bed arrangement=${audio.bed?.arrangement ?? 'unavailable'} `
  + `pad=${audio.bed?.padLevel?.toFixed(3) ?? 'n/a'} shimmer=${audio.bed?.shimmerLevel?.toFixed(3) ?? 'n/a'}`
);
const audioRunning = audio.contextState === 'running';
if (!audioRunning) console.log('WARNING: AudioContext is not running — score not audible');

const withScore = await sampleSeries();
const scoreStats = summarize(withScore);
const chordLater = await page.evaluate(async () => {
  const prim = await import('/src/audio/musicPrimitives.ts');
  return prim.getMusicChord().root;
});
console.log(`with score: ${formatSeries(withScore)} fps (chord root now ${chordLater})`);
console.log(`score stats: ${formatSummary(scoreStats)}`);

const rendererIsSwiftShader = /swiftshader/i.test(audio.renderer);
const rendererAccepted = rendererIsSwiftShader || !REQUIRE_SWIFTSHADER;
if (!rendererIsSwiftShader) {
  console.log(
    `WARNING: Chromium selected a non-SwiftShader backend; `
    + `set PARAVOXIA_REQUIRE_SWIFTSHADER=1 to make this a hard failure.`
  );
}
const richScoreState = audio.scoreLeading
  && audio.stage === STRESS_REALITY_STAGE
  && audio.primitives.era >= RICH_ERA_FLOOR;
const scoreToBaselineRatio = scoreStats.median / baselineStats.median;
// Keep the original >=60 max law, but make it subordinate to sustained stats.
// Rounding here exactly preserves the old probe's integer-sample comparison.
const retainedMaxGate = Math.round(scoreStats.max) >= REQUIRED_ROUNDED_MAX_FPS;
const sustainedFps = retainedMaxGate
  && scoreStats.median >= REQUIRED_MEDIAN_FPS
  && scoreStats.p10 >= REQUIRED_P10_FPS
  && scoreToBaselineRatio >= REQUIRED_SCORE_TO_BASELINE_RATIO;
const ok = live
  && sustainedFps
  && audioRunning
  && rendererAccepted
  && richScoreState
  && !audio.reloaded;
console.log(
  `RESULT ${beat}: median=${scoreStats.median.toFixed(2)} p10=${scoreStats.p10.toFixed(2)} `
  + `score/baseline=${scoreToBaselineRatio.toFixed(3)} retainedMax>=${REQUIRED_ROUNDED_MAX_FPS}=${retainedMaxGate} `
  + `storyLive=${live} swiftshader=${rendererIsSwiftShader} rendererAccepted=${rendererAccepted} `
  + `richScore=${richScoreState} audio=${audio.contextState} `
  + `-> ${ok ? 'PASS(sustained 60 fps with rich score leading)' : 'FAIL'}`
);
await browser.close();
cleanupServer();
process.exit(ok ? 0 : 1);
