#!/usr/bin/env node
/**
 * Run-local OWNED preview for the 2026-09-05-after-the-hearth verification.
 *
 * One canonical URL for every probe in this run. It builds once, serves that
 * immutable dist through main/tools/lib/previewServer.mjs (which refuses to
 * hand back a URL until the page carries <title>Paravoxia</title>), records
 * ownership + build identity, and owns the child's lifetime.
 *
 * Never reuse port 5174 (Paraform). Never claim a stopped server is running.
 *
 *   node cg-preview-daemon.mjs [--no-build]
 *   touch <run>/verifier/artifacts/preview-stop   # or SIGTERM to stop
 */
import { writeFileSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import process from 'node:process';
import { startParavoxiaPreview } from '../../../../../main/tools/lib/previewServer.mjs';
import { previewBuildManifest } from '../../../../../main/tools/lib/previewSnapshot.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ART = resolve(HERE, '..', 'artifacts');
const OWNERSHIP = resolve(ART, 'preview-ownership.json');
const STOPFILE = resolve(ART, 'preview-stop');
const MAIN = resolve(HERE, '..', '..', '..', '..', '..', 'main');

if (!process.argv.includes('--no-build')) throw new Error('Root preview uses the independently verified existing build only');
const build = false;
if (process.env.PARAVOXIA_URL) throw new Error('External preview override is not an owned build');
const RUN = resolve(HERE, '..', '..');
const manifestBytes = readFileSync(resolve(RUN, 'implementation-source-manifest.json'));
const manifest = JSON.parse(manifestBytes);
const manifestSha = createHash('sha256').update(manifestBytes).digest('hex');
const readiness = JSON.parse(readFileSync(resolve(RUN, 'verification-ready.json')));
if (!readiness.ready || readiness.contractVersion !== 'scene-v3' || readiness.sourceManifestSha256 !== manifestSha) throw new Error('Root has not cleared exact v3 source');
for (const [name, expected] of Object.entries(manifest.hashes)) {
  if (createHash('sha256').update(readFileSync(resolve(MAIN, '..', name))).digest('hex') !== expected) throw new Error(`Source drift: ${name}`);
}
if (existsSync(OWNERSHIP) && JSON.parse(readFileSync(OWNERSHIP)).state === 'running') throw new Error('Stop and archive previous root-owned preview first');
const log = (m) => console.log(`[cg-preview] ${m}`);

let ownershipInitialized = false;
function writeOwnership(patch) {
  const prev = ownershipInitialized && existsSync(OWNERSHIP) ? JSON.parse(readFileSync(OWNERSHIP, 'utf8')) : {};
  ownershipInitialized = true;
  writeFileSync(OWNERSHIP, `${JSON.stringify({ ...prev, ...patch }, null, 2)}\n`);
}

process.chdir(MAIN);
if (existsSync(STOPFILE)) rmSync(STOPFILE);

const startedAt = new Date().toISOString();
const preview = await startParavoxiaPreview({ build, log, distDir: resolve(MAIN, 'dist') });

const indexBytes = await fetch(preview.url).then((r) => r.text());
const indexSha256 = createHash('sha256').update(indexBytes).digest('hex');
if (!indexBytes.includes('<title>Paravoxia</title>')) {
  preview.stop();
  throw new Error('served page is not Paravoxia');
}

const buildManifest = previewBuildManifest(preview.snapshotDir);
if (buildManifest.sha256 !== preview.buildHash || previewBuildManifest(resolve(MAIN, 'dist')).sha256 !== preview.buildHash) { preview.stop(); throw new Error('Snapshot/dist build mismatch'); }
for (const [name, expected] of Object.entries(buildManifest.files)) {
  const response = await fetch(new URL(name, preview.url));
  const actual = createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');
  if (!response.ok || actual !== expected) { preview.stop(); throw new Error(`HTTP build mismatch: ${name}`); }
}
const bundlePath = indexBytes.match(/<script[^>]+src="([^"]+\.js)"/)?.[1];
if (!bundlePath || !buildManifest.files[bundlePath.replace(/^\//, '')]) { preview.stop(); throw new Error('No bound script bundle'); }
if (createHash('sha256').update(readFileSync(resolve(RUN, 'implementation-source-manifest.json'))).digest('hex') !== manifestSha) { preview.stop(); throw new Error('Source manifest changed during preview start'); }

writeOwnership({
  schema: 'paravoxia.verifier.previewOwnership.v0',
  runId: '2026-09-05-after-the-hearth',
  owner: 'root-production-preview',
  sourceManifestSha256: createHash('sha256').update(readFileSync(resolve(HERE, '..', '..', 'implementation-source-manifest.json'))).digest('hex'),
  state: 'running',
  url: preview.url,
  port: preview.port,
  daemonPid: process.pid,
  built: build,
  buildHash: preview.buildHash ?? null,
  buildHashAlgorithm: 'sha256(JSON.stringify(files))',
  files: buildManifest.files,
  allBuildFilesMatched: Object.keys(buildManifest.files).length,
  bundlePath,
  bundleSha256: buildManifest.files[bundlePath.replace(/^\//, '')],
  identityRecheckedAt: new Date().toISOString(),
  contractVersion: 'scene-v3',
  contractSha256: readiness.contractSha256,
  snapshotDir: preview.snapshotDir ?? null,
  indexSha256,
  startedAt,
  stoppedAt: null,
  stopReason: null,
  note: 'Root owns this immutable preview independently of reviewer CLI lifetime. Single canonical URL for probes and owner review; port is chosen free.'
});
log(`owned preview ready at ${preview.url} (index sha256 ${indexSha256.slice(0, 16)}…)`);

let stopping = false;
const shutdown = (why) => {
  if (stopping) return;
  stopping = true;
  log(`stopping (${why})`);
  try { preview.stop(); } catch { /* already gone */ }
  writeOwnership({ state: 'stopped', stoppedAt: new Date().toISOString(), stopReason: why });
  process.exit(0);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
setInterval(() => { if (existsSync(STOPFILE)) shutdown('stop-file'); }, 1000);
