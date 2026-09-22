// Software-only diagnostic adaptation. Original hardware plan remains unchanged.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawn } from 'node:child_process';

const run = dirname(fileURLToPath(import.meta.url));
const root = resolve(run, '../../..');
const main = join(root, 'main');
const evidence = join(run, 'evidence', 'software-baseline');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
mkdirSync(evidence, { recursive: true });
const writeJson = (name, value) => writeFileSync(join(evidence, name), JSON.stringify(value, null, 2) + '\n');

function sourceManifest() {
  const files = {};
  const visit = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(directory, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) files[relative(root, full)] = {
        sha256: hash(readFileSync(full)), mtimeMs: statSync(full).mtimeMs
      };
    }
  };
  visit(join(main, 'src'));
  visit(join(main, 'tools'));
  for (const name of ['package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.node.json',
    'vite.config.ts', 'index.html', 'chapter-registry.json', 'chapter-journey-contract.json', 'story-authority.json']) {
    const full = join(main, name);
    if (existsSync(full)) files[relative(root, full)] = { sha256: hash(readFileSync(full)), mtimeMs: statSync(full).mtimeMs };
  }
  const contentHashes = Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, value.sha256]));
  return {
    capturedAt: new Date().toISOString(),
    revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    status: execFileSync('git', ['status', '--porcelain=v1'], { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }),
    sha256: hash(JSON.stringify(contentHashes)), files
  };
}

async function capture(chapter, beat, preview) {
  const target = join(evidence, chapter);
  mkdirSync(target, { recursive: true });
  const args = [join(run, 'chapter-evidence-software-diagnostic.mjs'), '--chapter', chapter, '--run', target,
    '--lane', 'manual', '--beats', beat, '--cap-s', '18', '--strip-s', '4', '--settle-s', '8', '--profile', 'HIGH', '--no-build'];
  const logPath = join(target, 'capture.log');
  const fd = openSync(logPath, 'w');
  console.log(`[baseline] ${chapter} ${beat}; log ${logPath}`);
  try {
    return await new Promise((accept, reject) => {
      const child = spawn(process.execPath, args, {
        cwd: main, detached: true, stdio: ['ignore', fd, fd],
        env: { ...process.env, PARAVOXIA_URL: preview.url, PARAVOXIA_ALLOW_SWIFTSHADER: '1', CHROME_PATH: join(run, 'chromium-software-only.sh') }
      });
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        try { process.kill(-child.pid, 'SIGTERM'); } catch {}
      }, 360_000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', (code, signal) => {
        clearTimeout(timer);
        accept({ chapter, beat, code, signal, timedOut, log: relative(run, logPath), args });
      });
    });
  } finally {
    closeSync(fd);
  }
}

process.chdir(main);
delete process.env.PARAVOXIA_URL;
process.env.PARAVOXIA_ALLOW_SWIFTSHADER = '1';
process.env.CHROME_PATH = join(run, 'chromium-software-only.sh');
const { startParavoxiaPreview } = await import(join(main, 'tools/lib/previewServer.mjs'));
const { previewBuildManifest } = await import(join(main, 'tools/lib/previewSnapshot.mjs'));
const report = {
  schema: 'paravoxia.diagnosticBaseline.v1', status: 'running', startedAt: new Date().toISOString(),
  scope: 'Explicit software-only diagnostic grounding for silhouette, occlusion and projection. No hardware color, light, authored timing, feel, performance, audio, continuous play or production acceptance claim.',
  rendererPolicy: 'SwiftShader required; no hardware fallback',
  productionDisposition: 'fail-software; headed hardware evidence remains pending',
  sourceDriverSha256: hash(readFileSync(join(main, 'tools/chapter-evidence.mjs'))),
  diagnosticDriverSha256: hash(readFileSync(join(run, 'chapter-evidence-software-diagnostic.mjs'))),
  captures: []
};
let preview;
try {
  const before = sourceManifest();
  writeJson('source-before-build.json', before);
  preview = await startParavoxiaPreview({ build: true, log: text => console.log(`[baseline] ${text}`) });
  const after = sourceManifest();
  writeJson('source-after-build.json', after);
  report.sourceSha256 = after.sha256;
  report.sourceChangedDuringBuild = before.sha256 !== after.sha256;
  report.preview = { url: preview.url, buildHash: preview.buildHash, snapshotDir: preview.snapshotDir };
  writeJson('build-manifest.json', previewBuildManifest(preview.snapshotDir));
  if (report.sourceChangedDuringBuild) throw new Error('Sources changed during the build; no GPU capture started. Preserve and re-baseline after concurrent edits settle.');
  // One browser/GPU session at a time, both served from this exact immutable snapshot.
  for (const [chapter, beat] of [['ch9', 'ch9-hearth'], ['ch4', 'ch4-audit']]) {
    const result = await capture(chapter, beat, preview);
    report.captures.push(result);
    const bundlePath = join(evidence, chapter, 'evidence/bundle/bundle.json');
    result.originalEvidenceExitCode = result.code;
    result.productionDisposition = 'fail-software';
    result.bundleWritten = existsSync(bundlePath);
    if (!result.bundleWritten || result.timedOut || result.code !== 1) throw new Error(`${chapter} did not produce the expected retained software-fail bundle; inspect log.`);
    const bundle = JSON.parse(readFileSync(bundlePath, 'utf8'));
    result.capture = bundle.capture;
    result.frameCount = bundle.frames?.length ?? 0;
    result.blankFrameCount = (bundle.frames ?? []).filter(frame => frame.stats?.blank).length;
    if (bundle.capture?.tier !== 'swiftshader-low' || !/swiftshader/i.test(bundle.capture?.adapter ?? '')) throw new Error(`${chapter} renderer proof failed`);
  }
  const end = sourceManifest();
  writeJson('source-after-captures.json', end);
  report.sourceChangedAfterBuild = end.sha256 !== after.sha256;
  report.status = 'software-diagnostic-captured-awaiting-frame-inspection';
} catch (error) {
  report.status = 'failed';
  report.error = String(error);
  console.error(`[baseline] ${report.error}`);
  process.exitCode = 1;
} finally {
  preview?.stop();
  report.finishedAt = new Date().toISOString();
  writeJson('baseline-report.json', report);
}
