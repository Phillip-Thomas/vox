// audio-10x D3: measures the two audio costs the scene contract names.
//
//   node tools/audio-thread-cost-probe.mjs offline [--root <mainDir>] [--quality full|lean]
//        [--excerpt bed-sandbox-day] [--repeat 1] [--out <json>]
//     Offline-render throughput on the score-soak harness: wall seconds to render
//     the excerpt (render + the harness's loudness/health analysis, so an UPPER
//     bound on DSP), real-time factor, and the equivalent audio-thread DSP cost
//     per 16.67 ms frame of audio. `--root` points at another checkout (e.g. a
//     git worktree of the pre-Stage-1 revision) so before/after use one method;
//     it falls back to `renderExcerpt` when that tree has no stage-evidence API.
//
//   node tools/audio-thread-cost-probe.mjs main [--throttle 4] [--tier full|lean]
//        [--samples 5] [--settle 10] [--out <json>]
//     Audio MAIN-THREAD cost under the score, on the SwiftShader gate (same
//     harness as fps-score-probe.mjs): every window.setInterval / setTimeout
//     callback is wrapped before any module loads, so the bed and score
//     lookahead schedulers (the only main-thread audio work — rAF only writes
//     intent) are timed per rAF frame. Reports timer ms/frame baseline vs with
//     the score leading, fps percentiles, and the contract budget verdict
//     (1.5 ms/frame full, 3 ms/frame lean at 4x CPU throttle). `--tier lean`
//     forces the lean bed tier through the same navigator signals the live
//     resolver reads (hardwareConcurrency, deviceMemory); `--throttle` uses the
//     CDP Emulation.setCPUThrottlingRate the DevTools "4x slowdown" uses.
//
// Owns a fresh HMR-off vite server on an ephemeral port. One heavy render at a time.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import net from 'node:net';

const args = process.argv.slice(2);
const mode = args[0];
if (mode !== 'offline' && mode !== 'main') {
  console.error('usage: audio-thread-cost-probe.mjs offline|main [options]');
  process.exit(2);
}
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : fallback;
};
const defaultRoot = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const root = path.resolve(flag('root', defaultRoot));
const outFile = flag('out', null);

// Contract terms (scene-contract draft-v2 performance.measurementPlan).
const BUDGET_MS_PER_FRAME = { full: 1.5, lean: 3 };
const FRAME_MS = 1000 / 60;
// fps-score-probe.mjs stress state, reproduced so the two probes measure one workload.
const STRESS_SCORE_BEAT = 'a3-dawn';
const STRESS_REALITY_STAGE = 'material';
const STRESS_INTENSITY = 1;
const STRESS_ERA_TARGET = 1;
const STRESS_WARMTH_TARGET = 0.65;
const STRESS_WONDER_TARGET = 0.8;
// Bed-led phase: the home-planet sandbox-day script (excerpts.ts) at era 1, so the
// bed scheduler plans real bars before the story mood takes the lead.
const BED_PLANET_SEED = 5;
const BED_ARCHETYPE = 'verdant';
const BED_SCRIPT_SECONDS = 210;
const BED_SCRIPT_SAMPLE_T = 30;
const SAMPLE_WINDOW_MS = 3000;
const BETWEEN_SAMPLE_PAUSE_MS = 250;
const VIEWPORT = { width: 640, height: 360 };
const LEAN_NAVIGATOR = { hardwareConcurrency: 2, deviceMemory: 2 };
const PAGE_READY_TIMEOUT_MS = 30000;
const RENDER_TIMEOUT_MS = 900000;

async function serverUp(port) {
  try {
    return (await fetch(`http://localhost:${port}/score-soak.html`)).ok;
  } catch {
    return false;
  }
}
let viteProc = null;
process.once('exit', () => {
  if (viteProc && !viteProc.killed) viteProc.kill();
});
async function freshPort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}
async function startServer(port) {
  const viteScript = [
    "import { createServer } from 'vite'",
    "import react from '@vitejs/plugin-react'",
    `const server = await createServer({ configFile: false, root: process.cwd(), plugins: [react()], server: { port: ${port}, strictPort: true, hmr: false, watch: null } })`,
    'await server.listen()',
    'await new Promise(() => {})'
  ].join(';');
  viteProc = spawn(process.execPath, ['--input-type=module', '--eval', viteScript], {
    cwd: root,
    stdio: 'ignore',
    env: { ...process.env, PROBE_NO_HMR: '1' }
  });
  for (let i = 0; i < 150; i++) {
    if (await serverUp(port)) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`vite dev server did not come up for root ${root}`);
}

const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs
  .readdirSync(pwDir)
  .filter((d) => /^chromium-\d+$/.test(d))
  .sort()
  .pop();
const executablePath = path.join(pwDir, chromeDir, 'chrome-linux/chrome');

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
};
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;

function writeOut(result) {
  if (!outFile) return;
  fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
  console.log(`[out] ${outFile}`);
}

const port = await freshPort();
await startServer(port);
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: [
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    ...(mode === 'main' ? ['--use-angle=swiftshader-webgl', `--window-size=${VIEWPORT.width},${VIEWPORT.height}`] : []),
    '--autoplay-policy=no-user-gesture-required',
    '--mute-audio'
  ]
});
let ok = true;
try {
  if (mode === 'offline') ok = await runOffline();
  else ok = await runMain();
} finally {
  await browser.close();
  if (viteProc && !viteProc.killed) viteProc.kill();
}
process.exit(ok ? 0 : 1);

async function runOffline() {
  const quality = flag('quality', 'full') === 'lean' ? 'lean' : 'full';
  const excerpt = flag('excerpt', 'bed-sandbox-day');
  const repeat = Math.max(1, Number(flag('repeat', '1')) || 1);
  const page = await browser.newPage();
  page.setDefaultTimeout(RENDER_TIMEOUT_MS);
  page.on('pageerror', (e) => {
    ok = false;
    console.log(`[pageerror] ${e.message}`);
  });
  await page.goto(`http://localhost:${port}/score-soak.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__scoreSoak), null, { timeout: PAGE_READY_TIMEOUT_MS });
  const api = await page.evaluate(() => ({
    stageEvidence: typeof window.__scoreSoak.renderStageEvidence === 'function',
    excerpt: typeof window.__scoreSoak.renderExcerpt === 'function'
  }));
  const method = api.stageEvidence ? 'renderStageEvidence' : 'renderExcerpt';
  if (!api.stageEvidence && quality === 'lean') {
    console.log('[offline] this tree has no stage-evidence API: no lean tier exists here (pre-Stage-1 single tier)');
  }
  const runs = [];
  for (let i = 0; i < repeat; i++) {
    const r = await page.evaluate(
      async ({ name, quality, useStage }) => {
        const t0 = performance.now();
        const result = useStage
          ? await window.__scoreSoak.renderStageEvidence({ name, quality })
          : await window.__scoreSoak.renderExcerpt(name);
        const wallMs = performance.now() - t0;
        return { wallMs, seconds: result.seconds, bars: result.bars ?? null, sampleRate: result.sampleRate ?? null };
      },
      { name: excerpt, quality, useStage: api.stageEvidence }
    );
    const realtimeFactor = r.wallMs / 1000 / r.seconds;
    const dspMsPerFrame = realtimeFactor * FRAME_MS;
    runs.push({ wallS: r3(r.wallMs / 1000), audioS: r.seconds, realtimeFactor: r3(realtimeFactor), dspMsPerFrameEquivalent: r3(dspMsPerFrame) });
    console.log(
      `[offline ${quality} ${excerpt} #${i + 1}] wall ${(r.wallMs / 1000).toFixed(2)} s for ${r.seconds} s of audio — ` +
        `real-time factor ${realtimeFactor.toFixed(4)} (${(1 / realtimeFactor).toFixed(1)}× faster than real time), ` +
        `≈ ${dspMsPerFrame.toFixed(3)} ms of audio-thread DSP per 16.67 ms frame (upper bound: includes harness analysis)`
    );
  }
  const best = runs.reduce((a, b) => (b.wallS < a.wallS ? b : a));
  const result = {
    schema: 'paravoxia.audioThreadCost.offline.v1',
    generatedAt: new Date().toISOString(),
    root,
    method,
    quality: api.stageEvidence ? quality : 'single-tier',
    excerpt,
    runs,
    best,
    note: 'Wall time covers OfflineAudioContext rendering plus the harness loudness/health analysis of the rendered buffer; the DSP-per-frame figure is therefore an upper bound on the audio thread\'s cost.'
  };
  console.log(
    `RESULT offline ${result.quality}: best real-time factor ${best.realtimeFactor} → ≤ ${best.dspMsPerFrameEquivalent} ms audio-thread DSP per frame (${excerpt}, ${method})`
  );
  writeOut(result);
  return ok;
}

async function runMain() {
  const throttle = Math.max(1, Number(flag('throttle', '1')) || 1);
  const tier = flag('tier', 'full') === 'lean' ? 'lean' : 'full';
  const samples = Math.max(3, Number(flag('samples', '5')) || 5);
  const settleS = Math.max(4, Number(flag('settle', '10')) || 10);
  const budget = BUDGET_MS_PER_FRAME[tier];
  const context = await browser.newContext({ viewport: VIEWPORT });
  // Timer-cost accumulator: wraps the two timer primitives BEFORE any module
  // loads. The bed and score schedulers are setInterval callbacks (one clock,
  // lookahead scheduling); rAF only writes intent. Whatever else the harness
  // schedules is counted too, so the figure is an upper bound.
  await context.addInitScript(() => {
    const acc = { calls: 0, totalMs: 0, maxMs: 0 };
    window.__voxTimerCost = acc;
    window.__voxTimerCostReset = () => {
      acc.calls = 0;
      acc.totalMs = 0;
      acc.maxMs = 0;
    };
    const wrap = (fn) =>
      typeof fn === 'function'
        ? function wrapped(...a) {
            const t0 = performance.now();
            try {
              return fn.apply(this, a);
            } finally {
              const d = performance.now() - t0;
              acc.calls++;
              acc.totalMs += d;
              if (d > acc.maxMs) acc.maxMs = d;
            }
          }
        : fn;
    const si = window.setInterval.bind(window);
    const st = window.setTimeout.bind(window);
    window.setInterval = (fn, ms, ...rest) => si(wrap(fn), ms, ...rest);
    window.setTimeout = (fn, ms, ...rest) => st(wrap(fn), ms, ...rest);
  });
  if (tier === 'lean') {
    await context.addInitScript((lean) => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => lean.hardwareConcurrency, configurable: true });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => lean.deviceMemory, configurable: true });
    }, LEAN_NAVIGATOR);
  }
  const page = await context.newPage();
  page.on('pageerror', (e) => {
    ok = false;
    console.log(`[pageerror] ${e.message}`);
  });
  const cdp = await context.newCDPSession(page);
  if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  await page.goto(`http://localhost:${port}/score-soak.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__scoreSoak), null, { timeout: PAGE_READY_TIMEOUT_MS });
  const renderer = await page.evaluate(({ width, height }) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) throw new Error('could not create WebGL');
    document.body.appendChild(canvas);
    window.__scoreProbeGl = gl;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    return dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
  }, VIEWPORT);
  await page.evaluate(
    async ({ stage, era, warmth, wonder }) => {
      const reality = await import('/src/game/systems/realityRenderSystem.ts');
      const primitives = await import('/src/audio/musicPrimitives.ts');
      reality.setVoxelRealityStage(stage);
      primitives.setMusicPrimitiveTargets({ era, warmth, wonder });
      primitives.tickMusicPrimitives(1);
    },
    { stage: STRESS_REALITY_STAGE, era: STRESS_ERA_TARGET, warmth: STRESS_WARMTH_TARGET, wonder: STRESS_WONDER_TARGET }
  );
  console.log(`[main] renderer=${renderer} throttle=${throttle}x tier=${tier} samples=${samples}`);

  const sampleOne = () =>
    page.evaluate(
      (windowMs) =>
        new Promise((resolve) => {
          window.__voxTimerCostReset();
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
              const p95 = intervals[Math.min(intervals.length - 1, Math.floor(intervals.length * 0.95))] ?? 0;
              const c = window.__voxTimerCost;
              resolve({
                fps: frames / (elapsedMs / 1000),
                frames,
                elapsedMs,
                p95FrameMs: p95,
                worstFrameMs,
                timerMs: c.totalMs,
                timerCalls: c.calls,
                timerMaxMs: c.maxMs,
                timerMsPerFrame: frames > 0 ? c.totalMs / frames : 0
              });
            }
          };
          requestAnimationFrame(count);
        }),
      SAMPLE_WINDOW_MS
    );
  const series = async () => {
    const out = [];
    for (let i = 0; i < samples; i++) {
      out.push(await sampleOne());
      if (i + 1 < samples) await new Promise((r) => setTimeout(r, BETWEEN_SAMPLE_PAUSE_MS));
    }
    return out;
  };
  const summarize = (s) => ({
    fpsMedian: r2(percentile(s.map((e) => e.fps), 0.5)),
    fpsP10: r2(percentile(s.map((e) => e.fps), 0.1)),
    p95FrameMs: r2(Math.max(...s.map((e) => e.p95FrameMs))),
    worstFrameMs: r2(Math.max(...s.map((e) => e.worstFrameMs))),
    timerMsPerFrameMedian: r3(percentile(s.map((e) => e.timerMsPerFrame), 0.5)),
    timerMsPerFrameMax: r3(Math.max(...s.map((e) => e.timerMsPerFrame))),
    timerMaxCallbackMs: r3(Math.max(...s.map((e) => e.timerMaxMs))),
    timerCallsPerS: r2(s.reduce((a, e) => a + e.timerCalls, 0) / (s.reduce((a, e) => a + e.elapsedMs, 0) / 1000))
  });
  const fmt = (x) =>
    `fps median ${x.fpsMedian} p10 ${x.fpsP10}; p95 frame ${x.p95FrameMs} ms worst ${x.worstFrameMs} ms; ` +
    `timer ms/frame median ${x.timerMsPerFrameMedian} max ${x.timerMsPerFrameMax}; longest callback ${x.timerMaxCallbackMs} ms; ${x.timerCallsPerS} timer calls/s`;

  const baseline = summarize(await series());
  console.log(`[main] baseline (no score): ${fmt(baseline)}`);

  // Phase A — the generative bed leads (sandbox floor): unlock, build the bed on
  // the live context and let its lookahead scheduler plan bars.
  await page.evaluate(
    async ({ seed, archetype, seconds, sampleT }) => {
      const music = await import('/src/audio/musicEngine.ts');
      const story = await import('/src/story/storyScore.ts');
      const bed = await import('/src/audio/bedEngine.ts');
      const soak = await import('/src/audio/generative/soak.ts');
      const primitives = await import('/src/audio/musicPrimitives.ts');
      await music.unlockMusicAudio();
      story.unlockStoryScore();
      bed.configureBedPlanet(seed, archetype);
      const script = soak.makeSoakScript('sandboxDay', seed, seconds);
      bed.updateBedSignals(script(sampleT));
      primitives.tickMusicPrimitives(1);
    },
    { seed: BED_PLANET_SEED, archetype: BED_ARCHETYPE, seconds: BED_SCRIPT_SECONDS, sampleT: BED_SCRIPT_SAMPLE_T }
  );
  await new Promise((r) => setTimeout(r, settleS * 1000));
  const bedState = await page.evaluate(async () => {
    const bed = await import('/src/audio/bedEngine.ts');
    const snap = bed.getBedDebugSnapshot?.() ?? null;
    return { bedQuality: snap?.quality ?? null, bedBarIndex: snap?.barIndex ?? null, era: snap?.era ?? null };
  });
  const bedLed = summarize(await series());
  console.log(`[main] bed-led (sandbox, era ${bedState.era}): ${fmt(bedLed)}`);
  console.log(`[main] bed state: tier=${bedState.bedQuality} bar=${bedState.bedBarIndex}`);

  // Phase B — the story mood leads (a3-dawn stress, as fps-score-probe.mjs): the
  // bed yields but its scheduler stays alive; the score scheduler joins.
  await page.evaluate(
    async ({ scoreBeat, intensity }) => {
      const story = await import('/src/story/storyScore.ts');
      const primitives = await import('/src/audio/musicPrimitives.ts');
      story.setScoreBeat(scoreBeat);
      story.setScoreIntensity(intensity);
      primitives.tickMusicPrimitives(1);
    },
    { scoreBeat: STRESS_SCORE_BEAT, intensity: STRESS_INTENSITY }
  );
  await new Promise((r) => setTimeout(r, settleS * 1000));
  const state = await page.evaluate(async () => {
    const core = await import('/src/audio/audioCore.ts');
    const score = await import('/src/audio/scoreEngine.ts');
    const bed = await import('/src/audio/bedEngine.ts');
    const primitives = await import('/src/audio/musicPrimitives.ts');
    const snap = bed.getBedDebugSnapshot?.() ?? null;
    return {
      contextState: core.peekAudioContext()?.state ?? 'none',
      scoreLeading: score.isScoreMoodLeading(),
      bedQuality: snap?.quality ?? null,
      bedBarIndex: snap?.barIndex ?? null,
      era: primitives.getMusicPrimitives().era
    };
  });
  const withScore = summarize(await series());
  console.log(`[main] story-led (a3-dawn over the bed): ${fmt(withScore)}`);
  console.log(
    `[main] state: audio=${state.contextState} scoreLeading=${state.scoreLeading} bedTier=${state.bedQuality} bedBar=${state.bedBarIndex} era=${state.era.toFixed(3)}`
  );
  const worstPhase = bedLed.timerMsPerFrameMedian >= withScore.timerMsPerFrameMedian ? 'bed-led' : 'story-led';
  const audioMsPerFrame = Math.max(bedLed.timerMsPerFrameMedian, withScore.timerMsPerFrameMedian); // upper bound (all timers)
  const deltaMsPerFrame = r3(audioMsPerFrame - baseline.timerMsPerFrameMedian);
  const tierOk = state.bedQuality === tier && bedState.bedBarIndex != null && bedState.bedBarIndex > 0;
  const pass =
    ok &&
    state.contextState === 'running' &&
    state.scoreLeading &&
    tierOk &&
    audioMsPerFrame <= budget;
  const result = {
    schema: 'paravoxia.audioThreadCost.main.v1',
    generatedAt: new Date().toISOString(),
    renderer,
    swiftshader: /swiftshader/i.test(renderer),
    throttle,
    tier,
    budgetMsPerFrame: budget,
    baseline,
    bedLed,
    bedState,
    withScore,
    worstPhase,
    deltaTimerMsPerFrame: deltaMsPerFrame,
    audioMainThreadMsPerFrame: audioMsPerFrame,
    state,
    pass,
    note: 'timer ms/frame = summed duration of every setInterval/setTimeout callback (the bed and score lookahead schedulers; rAF writes intent only) divided by rAF frames in the window; an upper bound on the audio main-thread cost. Verdict uses the worse of the bed-led and story-led phases.'
  };
  console.log(
    `RESULT audio main-thread ${tier} @${throttle}x: ${audioMsPerFrame} ms/frame (worst phase ${worstPhase}; bed-led ${bedLed.timerMsPerFrameMedian}, story-led ${withScore.timerMsPerFrameMedian}; Δ vs baseline ${deltaMsPerFrame}) ` +
      `budget ${budget} ms/frame; fps median bed-led ${bedLed.fpsMedian} / story-led ${withScore.fpsMedian} (baseline ${baseline.fpsMedian}); ` +
      `swiftshader=${result.swiftshader} bedTier=${state.bedQuality} -> ${pass ? 'PASS' : 'FAIL'}`
  );
  writeOut(result);
  return pass;
}
