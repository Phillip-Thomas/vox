/**
 * PRE-CAPTURE SOURCE SNAPSHOT — run-local to 2026-09-05-after-the-hearth.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every probe summary records `probeSha256` as the hash of the probe file AS IT
 * WAS WHEN THE CAPTURE RAN. Once the harness is edited again that hash can no
 * longer be resolved back to any bytes on disk: the number survives, the source
 * it names does not. Older captures in `verifier/captures/` are in exactly that
 * state, and nothing here changes them or claims otherwise — this module only
 * makes FUTURE captures reconstructable.
 *
 * Before a capture starts, the probe writes into THAT capture's own output
 * folder:
 *
 *   <outDir>/source-snapshot/manifest.json      hashes + path metadata
 *   <outDir>/source-snapshot/files/<repoRel>    byte-exact copies
 *
 * What is copied: the run-local primary probe, the local modules it actually
 * imports (transitively, by reading the real import statements — not a guessed
 * list), and the read-only repo probe helpers it imports (e.g.
 * `main/tools/lib/evidence.mjs` and what that pulls in). Bare specifiers
 * (`node:fs`, `playwright-core`) are recorded as EXTERNAL and never copied.
 *
 * What is NOT copied, ever: credentials, dotfiles, `.env`, config secrets,
 * `node_modules`, game sources, captures, or a whole workspace. Only executable
 * source reachable from the probe's own import graph.
 *
 * Paths are stored twice on purpose: the snapshot's own RELATIVE layout (repo
 * relative, so the graph's shape survives) and the ORIGINAL absolute path as
 * metadata, so a reader can tell where the bytes came from on this machine.
 *
 * Refusal rules (both are hard errors, never a silent overwrite):
 *   - an existing snapshot manifest in the same output folder is never replaced;
 *   - a file that cannot be read is recorded as an error, not skipped quietly.
 *
 * The module is deterministic: `manifestSha256` covers ONLY the ordered
 * path/hash/size list, so re-snapshotting identical bytes yields an identical
 * hash, while one changed byte in any listed file changes it.
 *
 * It touches no browser, no network and no game state.
 */
import { createHash } from 'node:crypto';
import {
  existsSync as fsExists, mkdirSync as fsMkdir, readFileSync as fsRead, readdirSync as fsReaddir,
  writeFileSync as fsWrite
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

export const SOURCE_SNAPSHOT_SCHEMA = 'paravoxia.verifier.sourceSnapshot.v1';
export const SNAPSHOT_DIRNAME = 'source-snapshot';
export const SNAPSHOT_FILES_DIRNAME = 'files';
export const MANIFEST_FILENAME = 'manifest.json';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Default injectable IO. Tests pass their own in-memory implementation. */
export const nodeIo = Object.freeze({
  read: (p) => fsRead(p),
  exists: (p) => fsExists(p),
  mkdir: (p) => fsMkdir(p, { recursive: true }),
  write: (p, bytes) => fsWrite(p, bytes),
  readdir: (p) => fsReaddir(p)
});

/**
 * CAPTURE-FOLDER FRESHNESS GUARD (root review correction, 2026-09-06).
 *
 * `writeSourceSnapshot` refuses an existing SNAPSHOT MANIFEST, which is not the
 * same thing as refusing an existing CAPTURE. Every capture folder written
 * before the snapshot feature existed — all of `verifier/captures/**` up to and
 * including `final/survey-movie` — has no manifest at all, so the older refusal
 * would have let a re-used `--out` name truncate `trace.ndjson` and overwrite
 * `summary.json` and the PNGs of a retained failure.
 *
 * This guard is deliberately blunt: a capture writes into a folder that is
 * either absent or completely empty, and nothing else. It is checked BEFORE any
 * mkdir/snapshot/trace write, and it never deletes, moves or edits anything —
 * the only remedy it offers the operator is a new `--out` name.
 *
 * It touches no browser and is not evidence about any capture's content.
 */
export const FRESH_OUTPUT_DIR_SCHEMA = 'paravoxia.verifier.freshOutputDirGuard.v1';

/**
 * Inspect (without modifying) whether `outDir` may be used for a new capture.
 * PURE apart from the injected reads.
 */
export function inspectOutputDir(outDir, { io = nodeIo } = {}) {
  if (!io.exists(outDir)) {
    return { path: outDir, exists: false, empty: true, entries: [], fresh: true };
  }
  let entries = [];
  let readError = null;
  try {
    entries = io.readdir(outDir).map(String);
  } catch (e) {
    readError = String(e && e.message ? e.message : e).slice(0, 200);
  }
  if (readError != null) {
    // Unreadable is NOT treated as empty. Refusing is the safe direction.
    return { path: outDir, exists: true, empty: false, entries: [], readError, fresh: false };
  }
  return {
    path: outDir,
    exists: true,
    empty: entries.length === 0,
    entries: entries.slice(0, 40).sort(),
    entryCount: entries.length,
    fresh: entries.length === 0
  };
}

/**
 * Hard-refuse a non-fresh capture folder. Throws before any write happens.
 * @returns {object} the inspection record, for the capture's provenance.
 */
export function assertFreshOutputDir(outDir, { io = nodeIo, what = 'capture' } = {}) {
  const info = inspectOutputDir(outDir, { io });
  if (info.fresh) return { schema: FRESH_OUTPUT_DIR_SCHEMA, ...info, refused: false };
  const detail = info.readError
    ? `it exists but could not be listed (${info.readError})`
    : `it already contains ${info.entryCount} entr${info.entryCount === 1 ? 'y' : 'ies'}: ${info.entries.join(', ')}`;
  throw new Error(
    `refusing to write this ${what} into ${outDir} — ${detail}. ` +
    'Existing capture evidence is never overwritten, including legacy folders that predate source snapshots and therefore have no manifest. Choose a new --out name.'
  );
}

/**
 * Extract the module specifiers this source actually imports.
 * Pure string work: static `import ... from 'x'`, `export ... from 'x'`, and
 * dynamic `import('x')` with a literal argument. A computed dynamic import
 * cannot be resolved statically and is reported so the caller can record the
 * gap rather than pretend the graph is complete.
 */
export function parseImportSpecifiers(source) {
  const text = String(source);
  const specifiers = [];
  const push = (s) => { if (s && !specifiers.includes(s)) specifiers.push(s); };
  const re = /(?:^|[\s;}])(?:import|export)\s[^;]*?from\s*['"]([^'"]+)['"]/g;
  for (const m of text.matchAll(re)) push(m[1]);
  for (const m of text.matchAll(/(?:^|[\s;=(])import\s*['"]([^'"]+)['"]/g)) push(m[1]);
  for (const m of text.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) push(m[1]);
  const dynamicComputed = /import\s*\(\s*[^'")\s]/.test(text);
  return { specifiers, dynamicComputed };
}

/** A specifier that names a file on disk relative to the importer. */
export function isLocalSpecifier(spec) {
  return typeof spec === 'string' && (spec.startsWith('./') || spec.startsWith('../') || isAbsolute(spec));
}

const toPosix = (p) => p.split(sep).join('/');

/**
 * Repo-relative path used as the snapshot's own relative layout. Anything that
 * would escape the repo root (it should not happen for this harness) is stored
 * under `_outside/` with its absolute path preserved in metadata.
 */
export function repoRelativePath(absPath, repoRoot) {
  const rel = relative(repoRoot, absPath);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
    return `_outside/${toPosix(absPath).replace(/^\/+/, '')}`;
  }
  return toPosix(rel);
}

/**
 * Walk the real import graph starting at `entryAbs`.
 * Returns the ordered file list (entry first, then discovery order) plus the
 * external (bare) specifiers seen and any unreadable/unresolved edges.
 */
export function collectSourceGraph({ entryAbs, repoRoot, io = nodeIo, maxFiles = 200 }) {
  const files = [];
  const seen = new Set();
  const external = [];
  const unresolved = [];
  let dynamicComputed = false;
  const queue = [{ abs: resolve(entryAbs), importedBy: null }];

  while (queue.length) {
    const { abs, importedBy } = queue.shift();
    if (seen.has(abs)) continue;
    seen.add(abs);
    if (files.length >= maxFiles) {
      unresolved.push({ specifier: abs, importedBy, reason: `snapshot file budget ${maxFiles} exhausted` });
      continue;
    }
    let bytes = null;
    let readError = null;
    try {
      bytes = io.read(abs);
    } catch (e) {
      readError = String(e && e.message ? e.message : e).slice(0, 200);
    }
    if (bytes == null) {
      unresolved.push({ specifier: abs, importedBy, reason: `unreadable: ${readError}` });
      continue;
    }
    files.push({
      absPath: abs,
      repoRelPath: repoRelativePath(abs, repoRoot),
      bytes,
      size: bytes.length,
      sha256: sha256(bytes),
      importedBy: importedBy ? repoRelativePath(importedBy, repoRoot) : null,
      role: importedBy ? 'imported-module' : 'entry'
    });
    const parsed = parseImportSpecifiers(bytes.toString('utf8'));
    if (parsed.dynamicComputed) dynamicComputed = true;
    for (const spec of parsed.specifiers) {
      if (!isLocalSpecifier(spec)) {
        if (!external.includes(spec)) external.push(spec);
        continue;
      }
      const target = isAbsolute(spec) ? spec : resolve(dirname(abs), spec);
      if (!io.exists(target)) {
        unresolved.push({ specifier: spec, importedBy: repoRelativePath(abs, repoRoot), reason: 'not found on disk' });
        continue;
      }
      queue.push({ abs: target, importedBy: abs });
    }
  }
  return { files, external, unresolved, dynamicComputed };
}

/**
 * PURE. Build the canonical, order-stable manifest body from collected files.
 * No clock, no fs. `manifestSha256` deliberately excludes timestamps and
 * absolute paths so it is a function of the SOURCE BYTES only.
 */
export function planSnapshot({ files, entryAbs, repoRoot }) {
  const ordered = [...files].sort((a, b) => (a.repoRelPath < b.repoRelPath ? -1 : a.repoRelPath > b.repoRelPath ? 1 : 0));
  const canonical = ordered.map((f) => ({ path: f.repoRelPath, sha256: f.sha256, bytes: f.size }));
  const manifestSha256 = sha256(JSON.stringify({ schema: SOURCE_SNAPSHOT_SCHEMA, files: canonical }));
  const entryRel = repoRelativePath(resolve(entryAbs), repoRoot);
  const entry = ordered.find((f) => f.repoRelPath === entryRel) ?? null;
  return {
    entryRelPath: entryRel,
    entrySha256: entry ? entry.sha256 : null,
    canonical,
    ordered,
    manifestSha256
  };
}

/**
 * Write the snapshot into `outDir`. Refuses to touch an existing snapshot.
 * Returns the manifest object (also written to disk).
 */
export function writeSourceSnapshot({
  entryAbs, outDir, repoRoot, io = nodeIo, now = () => new Date().toISOString(), note = null
}) {
  const snapshotDir = join(outDir, SNAPSHOT_DIRNAME);
  const manifestPath = join(snapshotDir, MANIFEST_FILENAME);
  if (io.exists(manifestPath)) {
    throw new Error(
      `refusing to overwrite an existing source snapshot at ${manifestPath} — a capture's snapshot is written once and never replaced`
    );
  }
  const graph = collectSourceGraph({ entryAbs, repoRoot, io });
  const plan = planSnapshot({ files: graph.files, entryAbs, repoRoot });

  io.mkdir(snapshotDir);
  for (const f of plan.ordered) {
    const dest = join(snapshotDir, SNAPSHOT_FILES_DIRNAME, ...f.repoRelPath.split('/'));
    io.mkdir(dirname(dest));
    io.write(dest, f.bytes);
  }

  const manifest = {
    schema: SOURCE_SNAPSHOT_SCHEMA,
    runId: '2026-09-05-after-the-hearth',
    createdAt: now(),
    purpose: 'Retain the exact probe/library bytes this capture ran, so its probeSha256 stays reconstructable after later harness edits.',
    appliesTo: 'THIS capture only. It says nothing about, and changes nothing in, earlier captures — those were taken before this feature existed.',
    repoRoot,
    entry: {
      relPath: plan.entryRelPath,
      absPath: resolve(entryAbs),
      sha256: plan.entrySha256
    },
    manifestSha256: plan.manifestSha256,
    manifestSha256Covers: 'sha256 of {schema, files:[{path,sha256,bytes}]} ordered by path — source bytes only, no timestamps, no absolute paths',
    fileCount: plan.ordered.length,
    files: plan.ordered.map((f) => ({
      relPath: f.repoRelPath,
      snapshotPath: `${SNAPSHOT_FILES_DIRNAME}/${f.repoRelPath}`,
      originalAbsPath: f.absPath,
      bytes: f.size,
      sha256: f.sha256,
      importedBy: f.importedBy,
      role: f.role
    })),
    externalSpecifiers: graph.external,
    unresolved: graph.unresolved,
    dynamicComputedImportSeen: graph.dynamicComputed,
    excluded: [
      'bare/package specifiers and node_modules (recorded in externalSpecifiers, not copied)',
      'credentials, .env files, config secrets — none are in the probe import graph and none are read',
      'game sources, build output, captures, and any whole-workspace copy'
    ],
    limits: [
      'Only statically resolvable relative/absolute imports are followed; a computed dynamic import cannot be resolved and is flagged by dynamicComputedImportSeen.',
      'Specifiers are matched textually and comments/strings are NOT stripped, so an import-shaped phrase inside a comment can add a phantom entry to externalSpecifiers, or a commented-out local import to files/unresolved. The bias is deliberately toward over-recording: a snapshot may contain a module that was not executed, but it never omits one that was.',
      'This is source provenance only. It proves nothing about the browser, the renderer, the game, or the outcome of the capture.'
    ],
    note
  };
  io.write(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

/**
 * The compact reference bound into summary.json and trace.ndjson so a reader can
 * get from a summary to the exact bytes without trusting a later harness state.
 */
export function snapshotRef(manifest, { outDirRelative = SNAPSHOT_DIRNAME } = {}) {
  if (!manifest) {
    return {
      available: false,
      reason: 'no source snapshot was written for this capture',
      note: 'Without it, probeSha256 is only reconstructable while the harness is unchanged.'
    };
  }
  return {
    available: true,
    schema: manifest.schema,
    dir: outDirRelative,
    manifest: `${outDirRelative}/${MANIFEST_FILENAME}`,
    manifestSha256: manifest.manifestSha256,
    entryRelPath: manifest.entry?.relPath ?? null,
    entrySha256: manifest.entry?.sha256 ?? null,
    fileCount: manifest.fileCount,
    createdAt: manifest.createdAt,
    note: 'Byte-exact copies of this probe and the modules it imports, taken BEFORE the capture ran. probeSha256 above must equal entrySha256.'
  };
}

/**
 * Re-hash the live sources against a manifest and report drift.
 * `changed` means the file still exists but its bytes differ — the case that
 * makes a bare probeSha256 unresolvable later.
 */
export function compareToLive(manifest, { io = nodeIo } = {}) {
  const changed = [];
  const missing = [];
  const identical = [];
  for (const f of manifest?.files ?? []) {
    let bytes = null;
    try { bytes = io.read(f.originalAbsPath); } catch { bytes = null; }
    if (bytes == null) { missing.push(f.relPath); continue; }
    const h = sha256(bytes);
    if (h === f.sha256) identical.push(f.relPath);
    else changed.push({ relPath: f.relPath, snapshotSha256: f.sha256, liveSha256: h });
  }
  return {
    identical, changed, missing,
    drift: changed.length > 0 || missing.length > 0,
    note: 'Drift is information, not a failure verdict: the snapshot is the authority for what the capture actually ran.'
  };
}
