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

const HERE = dirname(fileURLToPath(import.meta.url));
const ART = resolve(HERE, '..', 'artifacts');
const OWNERSHIP = resolve(ART, 'preview-ownership.json');
const STOPFILE = resolve(ART, 'preview-stop');
const MAIN = resolve(HERE, '..', '..', '..', '..', '..', 'main');

const build = !process.argv.includes('--no-build');
const log = (m) => console.log(`[cg-preview] ${m}`);

function writeOwnership(patch) {
  const prev = existsSync(OWNERSHIP) ? JSON.parse(readFileSync(OWNERSHIP, 'utf8')) : {};
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
