// --- Boot attribution ---------------------------------------------------------------
//
// CPU attribution of a cold boot, legacy synchronous world-gen vs the worker
// path, on the SAME build (via `?worldprep=sync`). Prints top self-time
// functions resolved through sourcemaps, plus the caller chains of the
// heaviest sampled nodes, so a long task can be named rather than guessed.
//
// This tool is how a 20-second cold-boot "stall" was identified as SwiftShader
// shader compilation rather than an application bug: the profile named
// `(program)` at 85% with no JS frame under it, and the renderer string said
// why. Run it before drawing conclusions from any boot-stall number.
//
//   npm run perf:boot:attrib
//   ATTRIB_WINDOW_MS=20000 PARAVOXIA_ATTRIB_BEAT=ch3-dusk npm run perf:boot:attrib
import { readdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { CHROMIUM_ARGS, assertHardwareGl, chromePath, run, startParavoxiaPreview } from './lib/previewServer.mjs';

const WINDOW_MS = Number(process.env.ATTRIB_WINDOW_MS ?? 32_000);
// Build WITH sourcemaps so minified frames (ENe, L, vI…) resolve to real names.
if (process.env.ATTRIB_BUILD !== '0') {
  const code = await run('npx', ['vite', 'build', '--sourcemap']);
  if (code !== 0) throw new Error('build failed');
}
const preview = await startParavoxiaPreview({ build: false });
const browser = await chromium.launch({ headless: true, executablePath: chromePath(), args: CHROMIUM_ARGS });

// Source-map resolver for dist/assets/*.js (graceful if the lib is missing).
let resolveFrame = frame => frame;
try {
  const { TraceMap, originalPositionFor } = await import('@jridgewell/trace-mapping');
  const maps = new Map();
  for (const file of readdirSync('dist/assets')) {
    if (!file.endsWith('.js.map')) continue;
    maps.set(file.replace(/\.map$/, ''), new TraceMap(JSON.parse(readFileSync(`dist/assets/${file}`, 'utf8'))));
  }
  resolveFrame = frame => {
    // Native frames ((program), (root), (idle), (garbage collector)) carry no
    // url and line -1; trace-mapping throws on line 0.
    if (!frame.url || frame.lineNumber < 0) return frame;
    const file = (frame.url || '').split('/').pop();
    const map = maps.get(file);
    if (!map) return frame;
    const pos = originalPositionFor(map, { line: frame.lineNumber + 1, column: frame.columnNumber });
    if (!pos.source) return frame;
    return { ...frame, functionName: pos.name || frame.functionName, url: pos.source, lineNumber: pos.line };
  };
  console.log(`[attrib] sourcemaps loaded: ${[...maps.keys()].join(', ')}`);
} catch (error) {
  console.log(`[attrib] no sourcemap resolution: ${error.message}`);
}

function flatten(profile) {
  const byId = new Map(profile.nodes.map(n => [n.id, n]));
  const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const self = new Map();
  const deltas = profile.timeDeltas ?? [];
  const samples = profile.samples ?? [];
  const perNode = new Map();
  for (let i = 0; i < samples.length; i++) {
    perNode.set(samples[i], (perNode.get(samples[i]) ?? 0) + (deltas[i] ?? 0));
  }
  let total = 0;
  for (const [id, us] of perNode) {
    const n = byId.get(id);
    const cf = resolveFrame(n.callFrame);
    const name = `${cf.functionName || '(anon)'} @${(cf.url || '').split('/').pop()}:${cf.lineNumber}`;
    self.set(name, (self.get(name) ?? 0) + us);
    total += us;
  }
  const chainOf = id => {
    const out = [];
    let cur = id;
    while (cur !== undefined && out.length < 14) {
      const n = byId.get(cur);
      const cf = resolveFrame(n.callFrame);
      out.push(`${cf.functionName || '(anon)'}${cf.url && !cf.url.includes('index-') ? `[${cf.url.split('/').pop()}]` : ''}`);
      cur = parent.get(cur);
    }
    return out.join(' <- ');
  };
  // Heaviest sampled nodes with their caller chain (names the 20s task's owner).
  const heavy = [...perNode.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([id, us]) => `${(us / 1000).toFixed(0)}ms  ${chainOf(id)}`);
  const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14)
    .map(([name, us]) => `${String((us / 1000).toFixed(0)).padStart(6)}ms ${(100 * us / total).toFixed(1).padStart(5)}%  ${name}`);
  return { totalMs: total / 1000, top, heavy };
}

try {
  for (const mode of ['sync', 'worker']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    await ctx.addInitScript(`window.__longTasks=[];new PerformanceObserver(l=>{for(const e of l.getEntries())window.__longTasks.push([Math.round(e.startTime),Math.round(e.duration)])}).observe({entryTypes:['longtask']});`);
    const page = await ctx.newPage();
    if (mode === 'sync') { await page.goto(preview.url, { waitUntil: 'domcontentloaded' }); await assertHardwareGl(page); }
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
    await cdp.send('Profiler.start');
    const q = mode === 'sync' ? '&worldprep=sync' : '';
    const t0 = Date.now();
    await page.goto(`${preview.url}?story=${process.env.PARAVOXIA_ATTRIB_BEAT ?? 'descent'}&movie=1&profile=LOW${q}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(WINDOW_MS);
    const { profile } = await cdp.send('Profiler.stop');
    const tasks = await page.evaluate(() => window.__longTasks);
    const { totalMs, top, heavy } = flatten(profile);
    console.log(`\n===== mode=${mode}  wall ${Date.now() - t0}ms  sampled ${totalMs.toFixed(0)}ms`);
    console.log('long tasks:', JSON.stringify(tasks));
    console.log('--- top self time ---'); for (const l of top) console.log(l);
    console.log('--- heaviest nodes with caller chain ---'); for (const l of heavy) console.log(l);
    await ctx.close();
  }
} finally {
  await browser.close();
  preview.stop();
}
