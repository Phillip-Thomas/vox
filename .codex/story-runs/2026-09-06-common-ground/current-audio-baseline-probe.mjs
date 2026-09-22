// CURRENT AUDIO BASELINE probe — 2026-09-06 common-ground run.
//
// Renders short OfflineAudioContext excerpts of the CURRENT authored score
// moods through the SHIPPED offline mirror (main/src/audio/soak/offlineRender.ts)
// so the Score lane has a fresh, dated grounding artifact instead of the
// 2026-08-12 ch10-run renders.
//
// OFFLINE RENDER, NOT a listening / live combined-AV / performance acceptance.
//
// Design constraints honoured:
//   * zero mutation of main/ (source, dist, renders) — bundle + page live in tmp/
//   * no vite dev server (ENOSPC file-watcher trap); esbuild static bundle instead
//   * own ephemeral-port http server with an explicit harness title identity
//   * headless Chromium with GPU disabled / SwiftShader forced (shared GPU is
//     reserved by Paraform); audio render is CPU-only anyway
//   * ONE browser, bounded excerpt set, no 30-min soak, no full mood battery
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const REPO = '/home/thomasphillip/Projects/vox';
const MAIN = path.join(REPO, 'main');
const RUN_DIR = path.join(REPO, '.codex/story-runs/2026-09-06-common-ground');
const OUT = path.join(RUN_DIR, 'evidence', 'current-audio-baseline');
const TMP = path.join(REPO, 'tmp', 'current-audio-baseline');
const require_ = createRequire(path.join(MAIN, '/'));
const { chromium } = require_('playwright-core');

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

// ---------------------------------------------------------------- excerpt set
// intensity = each mood's authored `baseline` rail (storyScore.ts MOODS), the
// same convention the 2026-08-12 ch10 renders used, so the two are comparable.
const EXCERPTS = [
  {
    name: 'ch4-audit_current',
    beat: 'ch4-audit',
    intensity: 0.42,
    seconds: 10,
    era: 1,
    legacyScene: 'deepSpace'
  },
  {
    name: 'ch9-hearth_current',
    beat: 'ch9-hearth',
    intensity: 0.28,
    seconds: 10,
    era: 1,
    legacyScene: 'deepSpace'
  },
  {
    name: 'ch10-station-resolved_current',
    beat: 'ch10-transit',
    intensity: 0.24,
    seconds: 10,
    era: 1,
    legacyScene: 'deepSpace',
    ch10Variant: 'station-resolved',
    carrierAlive: true
  }
];

// ------------------------------------------------------------ source manifest
const SOURCE_FILES = [
  'src/audio/soak/offlineRender.ts',
  'src/audio/soak/audioAnalysis.ts',
  'src/audio/soak/excerpts.ts',
  'src/audio/scoreEngine.ts',
  'src/audio/audioCore.ts',
  'src/audio/musicPrimitives.ts',
  'src/audio/musicDirector.ts',
  'src/audio/musicEngine.ts',
  'src/audio/bedEngine.ts',
  'src/audio/mix/mixSnapshot.ts',
  'src/audio/mix/mixTuning.ts',
  'src/audio/generative/motif.ts',
  'src/audio/generative/tuning.ts',
  'src/story/storyScore.ts'
];
const sourceHashes = {};
for (const rel of SOURCE_FILES) {
  const abs = path.join(MAIN, rel);
  const buf = fs.readFileSync(abs);
  sourceHashes[rel] = {
    sha256: crypto.createHash('sha256').update(buf).digest('hex'),
    bytes: buf.length,
    mtime: fs.statSync(abs).mtime.toISOString()
  };
}
const gitHead = spawnSync('git', ['-C', REPO, 'rev-parse', 'HEAD'], { encoding: 'utf8' })
  .stdout.trim();

// ------------------------------------------------------------- esbuild bundle
// The bundle is a THIN re-export of current source. No fixture music, no
// substitute engine: every sample below comes from the shipped code path.
const ENTRY = path.join(TMP, 'entry.ts');
fs.writeFileSync(
  ENTRY,
  [
    "import * as offlineRender from '/home/thomasphillip/Projects/vox/main/src/audio/soak/offlineRender.ts';",
    "import * as audioAnalysis from '/home/thomasphillip/Projects/vox/main/src/audio/soak/audioAnalysis.ts';",
    "import * as storyScore from '/home/thomasphillip/Projects/vox/main/src/story/storyScore.ts';",
    '(window as any).__baseline = { offlineRender, audioAnalysis, storyScore };',
    "(window as any).__baselineReady = true;"
  ].join('\n')
);
const BUNDLE = path.join(TMP, 'bundle.js');
const build = spawnSync(
  path.join(MAIN, 'node_modules/.bin/esbuild'),
  [
    ENTRY,
    '--bundle',
    '--format=esm',
    '--platform=browser',
    '--target=es2022',
    '--loader:.ts=ts',
    '--define:process.env.NODE_ENV="production"',
    `--outfile=${BUNDLE}`,
    `--tsconfig=${path.join(MAIN, 'tsconfig.json')}`
  ],
  { cwd: MAIN, encoding: 'utf8' }
);
if (build.status !== 0) {
  console.error(build.stdout, build.stderr);
  throw new Error('esbuild bundle failed');
}
const bundleBytes = fs.statSync(BUNDLE).size;
console.log(`[bundle] ${bundleBytes} bytes`);

const HARNESS_TITLE = 'Paravoxia current-audio-baseline harness';
fs.writeFileSync(
  path.join(TMP, 'index.html'),
  `<!doctype html><html><head><meta charset="utf-8"><title>${HARNESS_TITLE}</title></head>` +
    `<body><div id="status">loading…</div><script type="module" src="./bundle.js"></script></body></html>`
);

// ------------------------------------------------------------ ephemeral server
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.map': 'application/json' };
const server = http.createServer((req, res) => {
  const rel = (req.url ?? '/').split('?')[0];
  const file = path.join(TMP, rel === '/' ? 'index.html' : rel);
  if (!file.startsWith(TMP) || !fs.existsSync(file)) {
    res.writeHead(404).end('nope');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const BASE = `http://127.0.0.1:${port}`;
const shutdown = () => {
  try {
    server.close();
  } catch {}
};
process.once('exit', shutdown);
process.once('SIGINT', () => {
  shutdown();
  process.exit(130);
});
console.log(`[server] ${BASE} (ephemeral, owned by this probe)`);

// ------------------------------------------------------------------- browser
const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs
  .readdirSync(pwDir)
  .filter((d) => /^chromium-\d+$/.test(d))
  .sort()
  .pop();
const browser = await chromium.launch({
  executablePath: path.join(pwDir, chromeDir, 'chrome-linux/chrome'),
  headless: true,
  args: [
    '--disable-gpu',
    '--use-gl=swiftshader',
    '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required',
    '--mute-audio'
  ]
});
const report = {
  kind: 'OFFLINE RENDER — NOT a listening / live combined-AV / performance acceptance',
  capturedAt: new Date().toISOString(),
  gitHead,
  chromium: chromeDir,
  harnessTitle: HARNESS_TITLE,
  renderPath: 'main/src/audio/soak/offlineRender.ts :: renderStoryBeatOffline (shipped offline mirror)',
  bundleBytes,
  bundleSha256: crypto.createHash('sha256').update(fs.readFileSync(BUNDLE)).digest('hex'),
  sourceHashes,
  excerpts: [],
  failures: []
};

try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => report.failures.push({ where: 'pageerror', message: e.message }));
  await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });

  // IDENTITY, not liveness (CLAUDE.md port-takeover incident).
  const title = await page.title();
  if (title !== HARNESS_TITLE) throw new Error(`wrong page identity: '${title}'`);
  await page.waitForFunction(() => window.__baselineReady === true, null, { timeout: 60000 });

  for (const spec of EXCERPTS) {
    const t0 = Date.now();
    const meta = await page.evaluate(async (s) => {
      const { offlineRender: r, audioAnalysis: a, storyScore: score } = window.__baseline;
      if (s.ch10Variant) {
        score.setStoryScoreMoodOverride(
          s.beat,
          score.getChapter10ScoreMood(s.ch10Variant, s.carrierAlive ?? false)
        );
      } else {
        score.clearStoryScoreMoodOverride();
      }
      const result = await r.renderStoryBeatOffline({
        beat: s.beat,
        seconds: s.seconds,
        era: s.era,
        legacyScene: s.legacyScene,
        intensityAt: () => s.intensity
      });
      if (s.ch10Variant) score.clearStoryScoreMoodOverride();
      const buf = result.buffer;
      const channels = [];
      for (let c = 0; c < buf.numberOfChannels; c++) channels.push(buf.getChannelData(c));
      const sr = buf.sampleRate;

      // Per-second RMS in dBFS.
      const windows = [];
      for (let w = 0; w < Math.floor(s.seconds); w++) {
        let sum = 0;
        let n = 0;
        for (const d of channels) {
          const s0 = w * sr;
          const s1 = Math.min(d.length, s0 + sr);
          for (let i = s0; i < s1; i++) {
            sum += d[i] * d[i];
            n++;
          }
        }
        const rms = Math.sqrt(sum / Math.max(1, n));
        windows.push(rms > 0 ? 20 * Math.log10(rms) : -Infinity);
      }
      // Click detector + non-finite sweep across ALL channels.
      let maxStep = 0;
      let nonFinite = 0;
      let over1 = 0;
      for (const d of channels) {
        for (let i = 0; i < d.length; i++) {
          if (!Number.isFinite(d[i])) nonFinite++;
          if (Math.abs(d[i]) >= 1) over1++;
          if (i > 0) maxStep = Math.max(maxStep, Math.abs(d[i] - d[i - 1]));
        }
      }
      const loudness = a.analyzeLoudness(channels, sr);
      const wav = a.encodeWavPcm16(channels, sr);
      window.__probeWav = new Uint8Array(wav);
      const mood = score.getStoryScoreMood(s.beat);
      return {
        analysis: { ...result.analysis },
        loudness: {
          integratedLufs: loudness.integratedLufs,
          shortTermMaxLufs: loudness.shortTermMaxLufs,
          momentaryMaxLufs: loudness.momentaryMaxLufs,
          loudnessRangeLu: loudness.loudnessRangeLu,
          truePeakDbtp: loudness.truePeakDbtp,
          samplePeakDbfs: loudness.samplePeakDbfs,
          correlation: loudness.correlation
        },
        windowedRmsDb: windows,
        overallRmsDb: 20 * Math.log10(result.analysis.rms),
        maxInterSampleStep: maxStep,
        nonFiniteSamples: nonFinite,
        samplesAtOrOverFullScale: over1,
        renderedChannels: buf.numberOfChannels,
        renderedSampleRate: sr,
        renderedFrames: buf.length,
        renderedDurationS: buf.length / sr,
        wavBytes: window.__probeWav.length,
        moodResolved: mood
          ? {
              tempo: mood.tempo,
              wave: mood.wave,
              chord: mood.chord,
              baseline: mood.baseline,
              pad: mood.pad,
              sub: mood.sub,
              ost: mood.ost,
              octave: mood.octave
            }
          : null
      };
    }, spec);

    // Stream the WAV out in 1 MiB base64 chunks.
    const parts = [];
    let off = 0;
    for (;;) {
      const chunk = await page.evaluate((o) => {
        const b = window.__probeWav;
        if (!b || o >= b.length) return null;
        const s = b.subarray(o, Math.min(o + (1 << 20), b.length));
        let bin = '';
        for (let i = 0; i < s.length; i++) bin += String.fromCharCode(s[i]);
        return btoa(bin);
      }, off);
      if (chunk == null) break;
      const b = Buffer.from(chunk, 'base64');
      parts.push(b);
      off += b.length;
    }
    const wav = Buffer.concat(parts);
    const file = path.join(OUT, `${spec.name}.wav`);
    fs.writeFileSync(file, wav);
    const onDiskBytes = fs.statSync(file).size;
    if (onDiskBytes !== meta.wavBytes) {
      report.failures.push({
        excerpt: spec.name,
        message: `wav byte mismatch: page ${meta.wavBytes} vs disk ${onDiskBytes}`
      });
    }
    report.excerpts.push({
      name: spec.name,
      file: `evidence/current-audio-baseline/${spec.name}.wav`,
      spec,
      sha256: crypto.createHash('sha256').update(wav).digest('hex'),
      onDiskBytes,
      renderWallMs: Date.now() - t0,
      ...meta
    });
    console.log(
      `[${spec.name}] rms=${meta.overallRmsDb.toFixed(2)}dB peak=${meta.analysis.peak.toFixed(4)} ` +
        `LUFS=${meta.loudness.integratedLufs.toFixed(2)} clip=${meta.analysis.clipCount} ` +
        `nan=${meta.analysis.nanCount} silence=${meta.analysis.longestSilenceS}s`
    );
  }
} finally {
  await browser.close();
  shutdown();
}

fs.writeFileSync(
  path.join(OUT, 'current-audio-baseline-report.json'),
  JSON.stringify(report, null, 2)
);
console.log(`[done] ${report.excerpts.length} excerpts, ${report.failures.length} failures`);
if (report.failures.length > 0) process.exitCode = 1;
