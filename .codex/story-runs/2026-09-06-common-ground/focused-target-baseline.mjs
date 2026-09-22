// Targeted CURRENT-scene grounding, software SwiftShader only.
// Two declared fixture targets, one browser, player camera, 960x540, DPR 1, LOW.
// No hardware/GPU. No natural-journey claim: every target is a debug deep-link
// rehearsal (`?story=<beat>` -> seedForBeat), recorded as a fixture.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const run = dirname(fileURLToPath(import.meta.url));
const root = resolve(run, '../../..');
const main = join(root, 'main');
const out = join(run, 'evidence', 'targeted-baseline');
mkdirSync(out, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const writeJson = (name, value) => writeFileSync(join(out, name), JSON.stringify(value, null, 2) + '\n');

function sourceManifest() {
  const files = {};
  const visit = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(directory, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) files[relative(root, full)] = sha(readFileSync(full));
    }
  };
  visit(join(main, 'src'));
  visit(join(main, 'tools'));
  for (const name of ['package.json', 'package-lock.json', 'index.html', 'vite.config.ts',
    'chapter-registry.json', 'chapter-journey-contract.json', 'story-authority.json']) {
    const full = join(main, name);
    if (existsSync(full)) files[relative(root, full)] = sha(readFileSync(full));
  }
  return {
    capturedAt: new Date().toISOString(),
    revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    statusSha256: sha(execFileSync('git', ['status', '--porcelain=v1'], { cwd: root, encoding: 'utf8', maxBuffer: 8 << 20 })),
    fileCount: Object.keys(files).length,
    sha256: sha(JSON.stringify(files)),
    files
  };
}

const TARGETS = [
  {
    id: 'origin-a4-worker-w7744',
    query: 'story=ch4-audit&movie=1&profile=LOW&journeyprobe=1',
    fixture: 'debug deep-link ?story=ch4-audit (seedForBeat: ch4Arrived) + movie autopilot; NOT a natural journey',
    intent: 'ACTUAL W-7744 silhouette from player perspective with the Origin A4 work area / pond / shore',
    samplesS: [6, 14, 22, 30, 40, 52, 66]
  },
  {
    id: 'tidegarden-home-core',
    query: 'story=ch10-cold&profile=LOW&journeyprobe=1',
    fixture: 'debug deep-link ?story=ch10-cold (seedForBeat: ch9Hearth + tidegarden habitat-core-online / shelter-certified / two-world-handoff receipts); NOT a natural journey; post-station ch12 bonded-cell install has NO fixture',
    intent: 'ACTUAL repaired home core with install-state metadata',
    samplesS: [6, 18, 32, 46]
  }
];

const report = {
  schema: 'paravoxia.targetedBaseline.v1',
  status: 'running',
  startedAt: new Date().toISOString(),
  scope: 'Targeted software-only (SwiftShader) CURRENT grounding for two declared fixture targets. No hardware, colour, timing, performance, audio, pace, feel or taste approval.',
  rendererPolicy: 'SwiftShader required; no hardware fallback; no GPU/hardware lock interaction',
  viewport: { width: 960, height: 540, deviceScaleFactor: 1 },
  profile: 'LOW',
  cameraPolicy: 'player camera only; expected FOV 75; no agent camera, no render change',
  targets: []
};

let preview;
let browser;
try {
  process.chdir(main);
  const before = sourceManifest();
  writeJson('source-before.json', before);
  const { startParavoxiaPreview } = await import(join(main, 'tools/lib/previewServer.mjs'));
  const { previewBuildManifest } = await import(join(main, 'tools/lib/previewSnapshot.mjs'));
  preview = await startParavoxiaPreview({ build: true, log: text => console.log(`[targeted] ${text}`) });
  const after = sourceManifest();
  writeJson('source-after-build.json', after);
  report.sourceSha256 = after.sha256;
  report.sourceChangedDuringBuild = before.sha256 !== after.sha256;
  report.preview = { url: preview.url, buildHash: preview.buildHash, snapshotDir: preview.snapshotDir };
  const manifest = previewBuildManifest(preview.snapshotDir);
  writeJson('build-manifest.json', manifest);
  if (report.sourceChangedDuringBuild) throw new Error('source changed during build');

  const playwright = await import(join(main, 'node_modules/playwright-core/index.js'));
  const chromium = playwright.chromium ?? playwright.default?.chromium;
  const chromePath = '/home/thomasphillip/.cache/ms-playwright/chromium-1217/chrome-linux/chrome';
  browser = await chromium.launch({
    executablePath: chromePath,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage']
  });
  const context = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));

  const rendererIdentity = { queriedAt: null, unmaskedRenderer: null, vendor: null };

  for (const target of TARGETS) {
    const dir = join(out, target.id);
    mkdirSync(dir, { recursive: true });
    const record = { ...target, frames: [], pageErrors: [] };
    const url = `${preview.url}?${target.query}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    record.documentTitle = await page.title();
    record.identityConfirmed = record.documentTitle === 'Paravoxia';
    if (!record.identityConfirmed) throw new Error(`identity check failed: ${record.documentTitle}`);
    if (!rendererIdentity.unmaskedRenderer) {
      Object.assign(rendererIdentity, await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
        if (!gl) return { unmaskedRenderer: null, vendor: null };
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        return {
          unmaskedRenderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null,
          vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : null
        };
      }));
      rendererIdentity.queriedAt = new Date().toISOString();
      report.rendererIdentity = rendererIdentity;
      if (!/swiftshader/i.test(rendererIdentity.unmaskedRenderer ?? '')) throw new Error(`renderer is not SwiftShader: ${rendererIdentity.unmaskedRenderer}`);
    }
    const t0 = Date.now();
    for (const at of target.samplesS) {
      const waitMs = t0 + at * 1000 - Date.now();
      if (waitMs > 0) await page.waitForTimeout(waitMs);
      const state = await page.evaluate(() => {
        const w = window;
        const probe = w.__paravoxiaJourneyProbe?.getSnapshot?.() ?? null;
        return {
          storyBeat: w.__storyBeat ?? null,
          heroTree: w.__storyTree ?? null,
          appState: w.__paravoxiaAppState ?? null,
          boundary: w.__paravoxiaBoundaryState ?? null,
          story: probe?.story ?? null,
          objective: probe ? {
            id: probe.objective?.id ?? null,
            markerLabel: probe.objective?.markerLabel ?? null,
            workOrder: probe.objective?.workOrder ?? null,
            health: probe.objective?.health ?? null
          } : null,
          workerName: probe?.workerName ?? null,
          entities: probe?.entities ?? null,
          milestones: probe?.state?.localActor?.milestones ?? null,
          era: probe?.state?.localActor?.era ?? null,
          promptCount: probe?.interaction?.visiblePromptCount ?? null,
          prompts: probe?.interaction?.prompts ?? null
        };
      }).catch(error => ({ evaluateError: String(error) }));
      const name = `${target.id}_t${String(at).padStart(3, '0')}s.png`;
      const file = join(dir, name);
      await page.screenshot({ path: file });
      const bytes = readFileSync(file);
      let ffprobe = null;
      try {
        ffprobe = execFileSync('ffprobe', ['-v', 'error', '-show_entries',
          'stream=codec_name,width,height,pix_fmt', '-of', 'json', file], { encoding: 'utf8' });
      } catch (error) { ffprobe = `ffprobe-unavailable: ${String(error).slice(0, 120)}`; }
      record.frames.push({
        file: relative(run, file), atS: at, sha256: sha(bytes), bytes: bytes.length,
        ffprobe: ffprobe && ffprobe.startsWith('{') ? JSON.parse(ffprobe).streams?.[0] ?? null : ffprobe,
        state
      });
      console.log(`[targeted] ${name} beat=${state.storyBeat} fov=${state.boundary?.camera?.fov}`);
    }
    record.pageErrors = [...errors];
    errors.length = 0;
    report.targets.push(record);
  }
  report.status = 'captured';
} catch (error) {
  report.status = 'failed';
  report.error = String(error);
  console.error(`[targeted] ${report.error}`);
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  preview?.stop();
  report.finishedAt = new Date().toISOString();
  report.sourceAfter = sourceManifest();
  writeJson('targeted-baseline.json', report);
  console.log(`[targeted] status=${report.status}`);
}
