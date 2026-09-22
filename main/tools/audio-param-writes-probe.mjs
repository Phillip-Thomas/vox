// audio-10x Stage 2: steady-state AudioParam automation writes per second in the
// LIVE app (AudioDirector's rAF conductor + both lookahead schedulers), on the
// real app path rather than the soak harness.
//
//   node tools/audio-param-writes-probe.mjs [beat=ch4-vigil] [settleS=8] [samples=3] [--out <json>]
//
// Every AudioParam automation method is wrapped by an init script BEFORE any
// module loads, so every write from every engine is counted (setValueAtTime,
// linearRampToValueAtTime, exponentialRampToValueAtTime, setTargetAtTime,
// setValueCurveAtTime, cancelScheduledValues, cancelAndHoldAtTime, and the
// `.value` setter). The app boots `?story=<beat>&movie=1`, audio is unlocked by
// dynamic import exactly as fps-score-probe.mjs does, the mix settles, then
// counts are sampled over 5 s windows. Owns a fresh HMR-off vite server.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import net from 'node:net';

const args = process.argv.slice(2);
const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--out');
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : fallback;
};
const beat = positional[0] ?? 'ch4-vigil';
const settleS = Math.max(4, Number(positional[1] ?? 8));
const samples = Math.max(1, Math.floor(Number(positional[2] ?? 3)));
const outFile = flag('out', null);
// --trace: attribute writes to their first application stack frame (routing evidence).
const trace = args.includes('--trace');
const SAMPLE_WINDOW_MS = 5000;
const AUDIO_SETTLE_S = 6;
const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));

async function serverUp(port) {
  try {
    const response = await fetch(`http://localhost:${port}/`);
    return response.ok && /<title>\s*Paravoxia\s*<\/title>/i.test(await response.text());
  } catch {
    return false;
  }
}
const port = await new Promise((resolve, reject) => {
  const server = net.createServer();
  server.unref();
  server.on('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const p = server.address().port;
    server.close((e) => (e ? reject(e) : resolve(p)));
  });
});
const viteScript = [
  "import { createServer } from 'vite'",
  "import react from '@vitejs/plugin-react'",
  `const server = await createServer({ configFile: false, root: process.cwd(), plugins: [react()], server: { port: ${port}, strictPort: true, hmr: false, watch: null } })`,
  'await server.listen()',
  'await new Promise(() => {})'
].join(';');
const viteProc = spawn(process.execPath, ['--input-type=module', '--eval', viteScript], {
  cwd: root,
  stdio: 'ignore',
  env: { ...process.env, PROBE_NO_HMR: '1' }
});
process.once('exit', () => {
  if (viteProc && !viteProc.killed) viteProc.kill();
});
for (let i = 0; i < 100 && !(await serverUp(port)); i++) await new Promise((r) => setTimeout(r, 300));
if (!(await serverUp(port))) throw new Error('vite dev server did not come up');

const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
const executablePath = path.join(pwDir, chromeDir, 'chrome-linux/chrome');
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720', '--autoplay-policy=no-user-gesture-required', '--mute-audio']
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const pageErrors = [];
page.on('pageerror', (e) => { pageErrors.push(e.message); console.log(`[pageerror] ${e.message}`); });
await page.addInitScript((traceOn) => {
  const counts = {};
  const sites = {};
  const bump = (name) => {
    counts[name] = (counts[name] ?? 0) + 1;
    if (traceOn) {
      const lines = (new Error().stack || '').split('\n').slice(2);
      const site = lines.find((l) => /\/src\//.test(l) && !/rampParam|audioCore\.ts.*ramp|railTarget/.test(l)) || lines[0] || '?';
      const key = `${name} @ ${site.trim().replace(/^at /, '').replace(/\?t=\d+/, '').replace(/https?:\/\/[^/]+/, '')}`;
      sites[key] = (sites[key] ?? 0) + 1;
    }
  };
  const proto = window.AudioParam && window.AudioParam.prototype;
  if (proto) {
    for (const name of [
      'setValueAtTime',
      'linearRampToValueAtTime',
      'exponentialRampToValueAtTime',
      'setTargetAtTime',
      'setValueCurveAtTime',
      'cancelScheduledValues',
      'cancelAndHoldAtTime'
    ]) {
      const original = proto[name];
      if (typeof original !== 'function') continue;
      proto[name] = function wrapped(...a) {
        bump(name);
        return original.apply(this, a);
      };
    }
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) {
      Object.defineProperty(proto, 'value', {
        configurable: true,
        get: desc.get,
        set(v) {
          bump('value=');
          return desc.set.call(this, v);
        }
      });
    }
  }
  window.__voxParamWrites = {
    counts,
    sites,
    snapshot: () => ({ ...counts }),
    sitesSnapshot: () => ({ ...sites }),
    total: () => Object.values(counts).reduce((a, b) => a + b, 0)
  };
}, trace);

const result = { beat, settleS, samples, samplesTaken: [], summary: null, generatedAt: new Date().toISOString() };
try {
  await page.goto(`http://localhost:${port}/?story=${beat}&movie=1`, { waitUntil: 'load' });
  const t0 = Date.now();
  let live = false;
  while ((Date.now() - t0) / 1000 < 90) {
    const b = await page.evaluate(() => window.__storyBeat ?? null).catch(() => null);
    if (b === beat) {
      live = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  console.log(`[probe] beat ${beat} live=${live} at ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  await new Promise((r) => setTimeout(r, settleS * 1000));
  const unlocked = await page.evaluate(async () => {
    const music = await import('/src/audio/musicEngine.ts');
    const sfx = await import('/src/audio/sfxEngine.ts');
    const story = await import('/src/story/storyScore.ts');
    await music.unlockMusicAudio();
    await sfx.unlockSfxAudio();
    story.unlockStoryScore();
    const core = await import('/src/audio/audioCore.ts');
    return core.peekAudioContext()?.state ?? 'none';
  });
  console.log(`[probe] audio context ${unlocked}; settling ${AUDIO_SETTLE_S}s`);
  await new Promise((r) => setTimeout(r, AUDIO_SETTLE_S * 1000));
  for (let i = 0; i < samples; i++) {
    const sample = await page.evaluate(
      (windowMs) =>
        new Promise((resolve) => {
          const before = window.__voxParamWrites.snapshot();
          const sitesBefore = window.__voxParamWrites.sitesSnapshot();
          const startBeat = window.__storyBeat ?? null;
          const t0 = performance.now();
          let frames = 0;
          const tick = () => {
            frames++;
            if (performance.now() - t0 < windowMs) requestAnimationFrame(tick);
            else {
              const after = window.__voxParamWrites.snapshot();
              const elapsedS = (performance.now() - t0) / 1000;
              const perMethod = {};
              let total = 0;
              for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
                const d = (after[k] ?? 0) - (before[k] ?? 0);
                perMethod[k] = Math.round((d / elapsedS) * 10) / 10;
                total += d;
              }
              const sitesAfter = window.__voxParamWrites.sitesSnapshot();
              const perSitePerS = Object.fromEntries(Object.entries(sitesAfter).map(([site, count]) => [site, (count - (sitesBefore[site] ?? 0)) / elapsedS]).filter(([, rate]) => rate > 0));
              resolve({ elapsedS, fps: frames / elapsedS, writesPerS: total / elapsedS, perMethodPerS: perMethod, perSitePerS, startBeat, endBeat: window.__storyBeat ?? null });
            }
          };
          requestAnimationFrame(tick);
        }),
      SAMPLE_WINDOW_MS
    );
    result.samplesTaken.push(sample);
    console.log(
      `[sample ${i + 1}/${samples}] writes/s=${sample.writesPerS.toFixed(1)} fps=${sample.fps.toFixed(1)} ` +
        Object.entries(sample.perMethodPerS)
          .map(([k, v]) => `${k}=${v}`)
          .join(' ')
    );
  }
  if (trace) {
    const sites = await page.evaluate(() => window.__voxParamWrites.sitesSnapshot());
    const top = Object.entries(sites).sort((a, b) => b[1] - a[1]).slice(0, 24);
    console.log('[trace] top write sites since page load:');
    for (const [k, v] of top) console.log(`  ${String(v).padStart(7)}  ${k}`);
    result.sites = Object.fromEntries(top);
    result.allSites = sites;
  }
  const rates = result.samplesTaken.map((s) => s.writesPerS).sort((a, b) => a - b);
  const median = rates[Math.floor(rates.length / 2)];
  result.pageErrors = pageErrors;
  result.summary = { medianWritesPerS: median, maxWritesPerS: rates[rates.length - 1], contextState: unlocked, beatLive: live,
    pass: live && unlocked === 'running' && pageErrors.length === 0 && result.samplesTaken.length === samples
      && result.samplesTaken.every(sample => sample.writesPerS < 60 && sample.startBeat === beat && sample.endBeat === beat) };
  console.log(`RESULT AudioParam writes/s: median=${median.toFixed(1)} max=${rates[rates.length - 1].toFixed(1)} (target < 60 steady state)`);
} finally {
  await browser.close();
  if (viteProc && !viteProc.killed) viteProc.kill();
}
if (outFile) fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
if (!result.summary?.pass) process.exitCode = 1;
