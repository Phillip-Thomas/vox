// Run under the shared heavy-work lease. This owns its preview/browser and
// keeps unprofiled acceptance timings separate from CPU/GL attribution overhead.
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { CHROMIUM_ARGS, chromePath, startParavoxiaPreview } from './lib/previewServer.mjs';
import { assertPreviewBuild } from './lib/previewBuildProof.mjs';

const output = path.resolve(process.env.WORLDGEN_OUTPUT ?? 'captures/worldgen-recovery');
const beat = process.env.WORLDGEN_BEAT ?? 'ch4-arrival';
const target = process.env.WORLDGEN_TARGET ?? (beat === 'ch4-arrival' ? 'ch4-audit' : '');
const capMs = Number(process.env.WORLDGEN_CAP_SECONDS ?? 100) * 1000;
const runs = Number(process.env.WORLDGEN_RUNS ?? 1);
const attribution = process.env.WORLDGEN_ATTRIBUTION === '1';
const query = process.env.WORLDGEN_QUERY ?? '';
const profile = process.env.WORLDGEN_PROFILE ?? 'LOW';
await mkdir(output, { recursive: true });
await mkdir(path.join(output, 'build-maps'), { recursive: true });
const buildAssets = {};
for (const file of (await readdir('dist/assets')).sort()) {
  if (!/\.(js|css|map)$/.test(file)) continue;
  buildAssets[file] = createHash('sha256').update(await readFile(`dist/assets/${file}`)).digest('hex');
  if (file.endsWith('.map')) await copyFile(`dist/assets/${file}`, path.join(output, 'build-maps', file));
}
const preview = await startParavoxiaPreview({ build: false });
let browser;
const results = [];
try {
  browser = await chromium.launch({
    headless: false,
    executablePath: chromePath(),
    args: CHROMIUM_ARGS.filter(arg => !arg.includes('swiftshader'))
  });
  for (let run = 0; run < runs; run++) {
    const previewBuildProof = await assertPreviewBuild(preview.url, buildAssets);
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const errors = [];
    try {
      await context.addInitScript(({ attribution }) => {
        const data = window.__worldgenRecovery = { frames: [], beats: [], tasks: [], gl: [], contexts: [], errors: [] };
        // The live system metric buffer retains only its latest 240 spans. Keep
        // the cold-window receipt before a long chapter probe can evict the
        // initial species builds and ecology-complete marker.
        setTimeout(() => {
          data.coldSnapshotAt = performance.now();
          data.coldSystemMeasuredSpans = (window.__paravoxiaSystemMeasuredSpans ?? []).slice();
        }, 8000);
        new PerformanceObserver(list => {
          for (const e of list.getEntries()) data.tasks.push({ t: e.startTime, duration: e.duration });
        }).observe({ type: 'longtask', buffered: true });
        const tick = t => {
          data.frames.push(t);
          const beat = window.__storyBeat ?? null;
          if (data.beats.at(-1)?.beat !== beat) data.beats.push({ beat, t });
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        const originalContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(...args) {
          const gl = originalContext.apply(this, args);
          if (gl && /^(webgl2?|experimental-webgl)$/.test(args[0]) && !data.contexts.includes(gl)) data.contexts.push(gl);
          return gl;
        };
        if (attribution) {
          for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
            for (const name of ['compileShader', 'linkProgram', 'getProgramInfoLog', 'getShaderInfoLog', 'getProgramParameter', 'getExtension', 'bufferData']) {
              const original = prototype[name];
              if (!original) continue;
              prototype[name] = function(...args) {
                const t = performance.now();
                try { return original.apply(this, args); }
                finally {
                  const duration = performance.now() - t;
                  if (duration >= 0.2) data.gl.push({ name, t, duration, beat: window.__storyBeat ?? null, ...(name === 'getExtension' ? { extension: args[0] } : {}) });
                }
              };
            }
          }
        }
      }, { attribution });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(String(error)));
      page.on('console', message => {
        if (message.type() === 'error' || /^\[(shader-warmup|renderer-bootstrap)\]/.test(message.text())) errors.push(message.text());
      });
      const cdp = await context.newCDPSession(page);
      if (attribution) {
        await cdp.send('Profiler.enable');
        await cdp.send('Profiler.setSamplingInterval', { interval: 20 });
        await cdp.send('Profiler.start');
      }
      const url = `${preview.url}?story=${beat}&movie=1&profile=${profile}&systemprobe=1${query ? `&${query}` : ''}`;
      const startedAt = Date.now();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      if (await page.title() !== 'Paravoxia') throw new Error('Target page identity changed');
      let targetAt = null;
      while (Date.now() - startedAt < capMs) {
        await page.waitForTimeout(1000);
        const current = await page.evaluate(() => window.__storyBeat ?? null);
        if (current === target && targetAt === null) targetAt = Date.now();
        if (targetAt !== null && Date.now() - targetAt > 4000) break;
        if (!target && Date.now() - startedAt > 12_000) break;
      }
      const cpu = attribution ? (await cdp.send('Profiler.stop')).profile : null;
      const data = await page.evaluate(() => {
        const { contexts, ...data } = window.__worldgenRecovery;
        const renderers = contexts.map(gl => {
          const info = gl.getExtension('WEBGL_debug_renderer_info');
          return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        });
        return { ...data, renderers, visibilityState: document.visibilityState, backstops: window.__railBackstops ?? [], stuck: window.__railStuck ?? [], warpMetrics: window.__warpMetrics ?? null, systemMeasuredSpans: window.__paravoxiaSystemMeasuredSpans ?? [] };
      });
      if (!data.renderers.length || data.renderers.some(renderer => !/NVIDIA/i.test(renderer) || /swiftshader|llvmpipe|software/i.test(renderer))) {
        throw new Error(`Expected actual NVIDIA render contexts: ${JSON.stringify(data.renderers)}`);
      }
      const coldTasks = data.tasks.filter(task => task.t < 8000);
      const seams = data.beats.slice(1).map((entry, index) => {
        let maxGapMs = 0;
        for (let f = 1; f < data.frames.length; f++) {
          if (data.frames[f] > entry.t - 2000 && data.frames[f] < entry.t + 2000) maxGapMs = Math.max(maxGapMs, data.frames[f] - data.frames[f - 1]);
        }
        return { from: data.beats[index].beat, to: entry.beat, t: entry.t, maxGapMs };
      });
      const receipt = {
        generatedAt: new Date().toISOString(), url, beat, target, targetReached: target ? targetAt !== null : null,
        profile, viewport: { width: 1280, height: 720 }, attribution, samplingIntervalUs: attribution ? 20 : null,
        buildAssets, previewBuildProof, cold: { totalMs: coldTasks.reduce((sum, task) => sum + task.duration, 0), largestMs: Math.max(0, ...coldTasks.map(task => task.duration)) },
        seams, ...data, errors
      };
      await writeFile(path.join(output, `${beat}-${attribution ? 'attribution' : 'timing'}-${run + 1}.json`), JSON.stringify(receipt, null, 2));
      if (cpu) await writeFile(path.join(output, `${beat}-${run + 1}.cpuprofile`), JSON.stringify(cpu));
      console.log(JSON.stringify({ run: run + 1, cold: receipt.cold, seams, targetReached: receipt.targetReached, errors, renderers: receipt.renderers }));
      results.push(receipt);
    } finally { await context.close(); }
  }
} finally {
  await browser?.close();
  preview.stop();
}
if (results.some(result => result.errors.length || result.targetReached === false || result.visibilityState !== 'visible')) process.exitCode = 1;
