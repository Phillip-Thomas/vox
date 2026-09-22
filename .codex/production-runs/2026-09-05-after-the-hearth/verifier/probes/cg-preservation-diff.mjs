#!/usr/bin/env node
/**
 * Preservation / drift check for this run — no source mutation, read only.
 *
 * Compares the live worktree against, in order:
 *   1. initial-source-hashes.json          (958 runtime hashes, 2026-09-06T03:00Z)
 *   2. integration-before-manifest.json    (the integrator's own before-bytes)
 *   3. iterations/implemented-scene-v1-before-v2/source-manifest.json (if present)
 * and against the signed contract's allowedPaths / protectedPaths boundary.
 *
 * Output classes, so blame is never assigned by feel:
 *   authorized-change   changed AND inside an allowedPaths boundary
 *   protected-drift     changed AND inside a protectedPaths boundary   (FINDING)
 *   unexpected-drift    changed AND outside both boundaries            (FINDING, may be another session's dirty work — mtime is recorded)
 *   added / removed     files that appeared or vanished
 *
 * mtimes are recorded for every changed file so concurrent unrelated refactors
 * can be told apart from this run's edits.
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { loadContract, RUN_DIR, REPO_ROOT, ART } from './lib/cgContract.mjs';

const hashOf = (abs) => createHash('sha256').update(readFileSync(abs)).digest('hex');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

function boundaryMatch(file, boundary) {
  if (!boundary) return false;
  const b = boundary.replace(/\/+$/, '');
  return file === b || file.startsWith(`${b}/`);
}

const { contract, sha256: contractSha } = loadContract();
const allowed = contract.production.allowedPaths || [];
const protectedPaths = contract.production.protectedPaths || [];

const sources = [
  ['initial-source-hashes', join(RUN_DIR, 'initial-source-hashes.json')],
  ['integration-before-manifest', join(RUN_DIR, 'integration-before-manifest.json')],
  ['scene-v1-before-v2', join(RUN_DIR, 'iterations', 'implemented-scene-v1-before-v2', 'source-manifest.json')]
];

const report = {
  schema: 'paravoxia.verifier.preservationDiff.v0',
  runId: '2026-09-05-after-the-hearth',
  contractSha256: contractSha,
  comparedAt: new Date().toISOString(),
  baselines: {}
};

for (const [name, path] of sources) {
  if (!existsSync(path)) { report.baselines[name] = { status: 'absent', path }; continue; }
  const manifest = readJson(path);
  const hashes = manifest.hashes ?? manifest.files ?? {};
  const rows = { unchanged: 0, authorizedChange: [], protectedDrift: [], unexpectedDrift: [], removed: [] };
  for (const [file, expected] of Object.entries(hashes)) {
    const abs = resolve(REPO_ROOT, file);
    if (!existsSync(abs)) { rows.removed.push(file); continue; }
    const actual = hashOf(abs);
    if (actual === expected) { rows.unchanged += 1; continue; }
    const entry = {
      file, expected, actual,
      mtime: new Date(statSync(abs).mtimeMs).toISOString(),
      allowed: allowed.some((b) => boundaryMatch(file, b)),
      protected: protectedPaths.some((b) => boundaryMatch(file, b))
    };
    if (entry.protected) rows.protectedDrift.push(entry);
    else if (entry.allowed) rows.authorizedChange.push(entry);
    else rows.unexpectedDrift.push(entry);
  }
  report.baselines[name] = {
    status: 'compared', path, capturedAt: manifest.capturedAt ?? null,
    fileCount: Object.keys(hashes).length,
    unchanged: rows.unchanged,
    authorizedChangeCount: rows.authorizedChange.length,
    protectedDriftCount: rows.protectedDrift.length,
    unexpectedDriftCount: rows.unexpectedDrift.length,
    removedCount: rows.removed.length,
    authorizedChange: rows.authorizedChange,
    protectedDrift: rows.protectedDrift,
    unexpectedDrift: rows.unexpectedDrift,
    removed: rows.removed
  };
}

const out = resolve(ART, 'preservation-diff.json');
writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
console.log(`[preservation] wrote ${out}`);
for (const [name, r] of Object.entries(report.baselines)) {
  if (r.status !== 'compared') { console.log(`  ${name}: ${r.status}`); continue; }
  console.log(`  ${name}: ${r.unchanged}/${r.fileCount} unchanged, authorized=${r.authorizedChangeCount}, protectedDrift=${r.protectedDriftCount}, unexpected=${r.unexpectedDriftCount}, removed=${r.removedCount}`);
}
