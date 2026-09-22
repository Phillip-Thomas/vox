#!/usr/bin/env node
/**
 * OFFLINE behavioural self-test for the two harness-final-prep changes.
 *
 *   node verifier/probes/cg-harness-prep-selftest.mjs [--json <path>]
 *
 * NO browser, NO preview, NO GPU, NO game build, NO game test runner, NO
 * network. Sessions are STUBS; the filesystem for the snapshot tests is an
 * in-memory map, except for one read-only walk of the real probe import graph.
 *
 * WHAT THESE TESTS DO AND DO NOT PROVE
 * ------------------------------------
 * They prove the harness's own control flow: that the owned session's `stop()`
 * runs exactly once even when capture, frameStats or summary writing throws,
 * that the ORIGINAL error still propagates, that a snapshot is deterministic,
 * path-faithful, never overwritten, and sensitive to one changed byte.
 *
 * They prove NOTHING about a real Chromium, a real preview, the renderer, the
 * game, or whether any chapter passes. No browser is ever started here, so
 * "cleanup works" means "the cleanup path is invoked exactly once by the
 * harness's control flow", not "a real browser process was observed to exit".
 */
import { writeFileSync, readFileSync, appendFileSync, mkdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { createOwnedSessionGuard, failureRecord } from './lib/ownedSession.mjs';
import {
  parseImportSpecifiers, isLocalSpecifier, collectSourceGraph, planSnapshot,
  writeSourceSnapshot, snapshotRef, compareToLive, MANIFEST_FILENAME, SNAPSHOT_DIRNAME
} from './lib/sourceSnapshot.mjs';

const results = [];
let failures = 0;
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (e) {
    failures += 1;
    results.push({ name, ok: false, error: String(e && e.message ? e.message : e) });
    console.error(`  FAIL  ${name}\n        ${e && e.message ? e.message : e}`);
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const sha256 = (b) => createHash('sha256').update(b).digest('hex');

// ---------------------------------------------------------------- stubs -----
/**
 * A stub of the shape `openParavoxia()` returns. It counts calls to its OWN
 * stop, and separately counts any touch of the preview stub, so a test can show
 * the guard never reaches past the session it owns.
 */
function stubSession({ stopThrows = false } = {}) {
  const calls = { stop: 0, previewStop: 0, close: 0 };
  return {
    calls,
    renderer: 'stub-renderer (no GPU, no browser)',
    headed: false,
    pageErrors: [],
    preview: { url: 'http://127.0.0.1:0/', stop() { calls.previewStop += 1; } },
    browser: { close() { calls.close += 1; } },
    async stop() {
      calls.stop += 1;
      if (stopThrows) throw new Error('stub cleanup failure');
    }
  };
}

/** In-memory IO with the same surface `sourceSnapshot.mjs` injects. */
function memIo(seed = {}) {
  const files = new Map(Object.entries(seed).map(([k, v]) => [k, Buffer.from(v)]));
  const dirs = new Set();
  return {
    files, dirs,
    read: (p) => { if (!files.has(p)) throw new Error(`ENOENT ${p}`); return files.get(p); },
    exists: (p) => files.has(p) || dirs.has(p),
    mkdir: (p) => { dirs.add(p); },
    write: (p, bytes) => { files.set(p, Buffer.isBuffer(bytes) ? Buffer.from(bytes) : Buffer.from(String(bytes))); }
  };
}

const ROOT = '/repo';
const PROBE = `${ROOT}/run/probes/p.mjs`;
const LIB_A = `${ROOT}/run/probes/lib/a.mjs`;
const LIB_B = `${ROOT}/main/tools/lib/b.mjs`;
const SECRET = `${ROOT}/run/probes/.env`;
const OUT = `${ROOT}/run/captures/cap-1`;

const seedFiles = () => ({
  [PROBE]: "import { a } from './lib/a.mjs';\nimport { chromium } from 'playwright-core';\nimport process from 'node:process';\nexport const run = () => a();\n",
  [LIB_A]: "import { b } from '../../../main/tools/lib/b.mjs';\nexport const a = () => b();\n",
  [LIB_B]: "export const b = () => 1;\n",
  [SECRET]: 'API_TOKEN=do-not-copy-me\n'
});

// ===========================================================================
// A. OWNED SESSION CLEANUP  (stub sessions, deliberate thrown errors)
// ===========================================================================

await check('A1 a clean run stops the owned session exactly once', async () => {
  const s = stubSession();
  const guard = createOwnedSessionGuard();
  guard.adopt(s);
  const out = await guard.runGuarded(async () => 'captured');
  assert(out === 'captured', 'the body result must be returned unchanged');
  assert(s.calls.stop === 1, `session.stop must run once, ran ${s.calls.stop}`);
  assert(guard.stopInvocations === 1, 'guard must report exactly one stop invocation');
});

await check('A2 a throw during capture still stops the session and re-throws the ORIGINAL error', async () => {
  const s = stubSession();
  const guard = createOwnedSessionGuard();
  guard.adopt(s);
  const boom = new TypeError('frameStats(...).catch is not a function');
  let caught = null;
  try {
    await guard.runGuarded(async () => { throw boom; });
  } catch (e) { caught = e; }
  assert(caught === boom, 'the original error object must propagate, not a cleanup error');
  assert(caught.message.includes('.catch is not a function'), 'the original message must survive');
  assert(s.calls.stop === 1, `session.stop must run once after a capture throw, ran ${s.calls.stop}`);
});

await check('A3 a throw while WRITING THE SUMMARY still stops the session once', async () => {
  const s = stubSession();
  const guard = createOwnedSessionGuard();
  guard.adopt(s);
  const boom = new Error('EACCES writing summary.json');
  let caught = null;
  try {
    await guard.runGuarded(async () => {
      // capture "succeeded"; the failure is in finalization
      await new Promise((r) => setTimeout(r, 1));
      throw boom;
    });
  } catch (e) { caught = e; }
  assert(caught === boom, 'summary-writing failure must propagate unchanged');
  assert(s.calls.stop === 1, 'summary failure must not skip or duplicate cleanup');
});

await check('A4 a throw on the checkpoint path stops the session once', async () => {
  const s = stubSession();
  const guard = createOwnedSessionGuard();
  guard.adopt(s);
  const boom = new SyntaxError('Unexpected end of JSON input (verifier-control.json)');
  let caught = null;
  try { await guard.runGuarded(async () => { throw boom; }); } catch (e) { caught = e; }
  assert(caught === boom, 'checkpoint failure must propagate unchanged');
  assert(s.calls.stop === 1, 'checkpoint failure must still clean up exactly once');
});

await check('A5 explicit stop plus the finally still calls session.stop exactly once', async () => {
  const s = stubSession();
  const guard = createOwnedSessionGuard();
  guard.adopt(s);
  await guard.runGuarded(async () => { await guard.stopOnce('explicit-end-of-probe'); });
  assert(s.calls.stop === 1, `double cleanup must collapse to one stop, ran ${s.calls.stop}`);
  assert(guard.stopRequests === 2, 'both cleanup requests must still be recorded honestly');
  assert(guard.stopInvocations === 1, 'only one underlying invocation');
});

await check('A6 concurrent cleanup requests still call session.stop exactly once', async () => {
  const s = stubSession();
  const guard = createOwnedSessionGuard();
  guard.adopt(s);
  await Promise.all([guard.stopOnce('a'), guard.stopOnce('b'), guard.stopOnce('c')]);
  assert(s.calls.stop === 1, `racing cleanup must collapse to one stop, ran ${s.calls.stop}`);
});

await check('A7 a FAILING cleanup never hides or replaces the real failure', async () => {
  const s = stubSession({ stopThrows: true });
  const guard = createOwnedSessionGuard();
  guard.adopt(s);
  const boom = new Error('capture failed at frame 12');
  let caught = null;
  try { await guard.runGuarded(async () => { throw boom; }); } catch (e) { caught = e; }
  assert(caught === boom, 'the cleanup error must NOT replace the capture error');
  assert(s.calls.stop === 1, 'the failing stop still ran once');
  assert(typeof guard.stopError === 'string' && guard.stopError.length > 0, 'the cleanup failure must be recorded, not silently dropped');
  assert(guard.describe().sessionStopped === false, 'a failed stop must not be reported as stopped');
});

await check('A8 the guard touches ONLY the session it owns — never the preview or the browser', async () => {
  const s = stubSession();
  const guard = createOwnedSessionGuard();
  guard.adopt(s);
  try { await guard.runGuarded(async () => { throw new Error('x'); }); } catch { /* expected */ }
  assert(s.calls.previewStop === 0, 'the root-owned preview must never be stopped by the guard');
  assert(s.calls.close === 0, 'the guard must not reach into browser.close() itself');
});

await check('A9 cleanup with no adopted session is a no-op, not an error', async () => {
  const guard = createOwnedSessionGuard();
  const r = await guard.stopOnce('nothing-was-opened');
  assert(r.stopped === false && r.invoked === false, 'no session means nothing is stopped');
  assert(r.reason === 'no-owned-session', 'the no-op must say so');
});

await check('A10 the guard refuses to adopt a non-session or a second session', async () => {
  const guard = createOwnedSessionGuard();
  let threw = false;
  try { guard.adopt({ notASession: true }); } catch { threw = true; }
  assert(threw, 'a value without stop() must be refused');
  guard.adopt(stubSession());
  let threw2 = false;
  try { guard.adopt(stubSession()); } catch { threw2 = true; }
  assert(threw2, 'a guard owns exactly one session');
});

await check('A11 the failure record is inconclusive, keeps partial evidence and claims no acceptance', () => {
  const rec = failureRecord({ probe: 'cg-journey-probe.mjs', error: new Error('capture died'), phase: 'capture-or-summary', extra: { framesWritten: 4 } });
  assert(rec.outcome === 'PROBE-ERROR-INCONCLUSIVE', 'a crashed capture is inconclusive');
  assert(rec.outcomeIsAcceptance === false, 'never acceptance');
  assert(rec.failed === true, 'the failure must be reported as a failure');
  assert(rec.partialEvidenceRetained === true, 'partial trace/media are kept');
  assert(rec.error.message.includes('capture died'), 'the real error text is preserved');
  assert(rec.framesWritten === 4, 'caller context is preserved');
});

// ===========================================================================
// B. PRE-CAPTURE SOURCE SNAPSHOT  (in-memory filesystem)
// ===========================================================================

await check('B1 import parsing finds real local edges and separates external ones', () => {
  const src = [
    "import { a } from './lib/a.mjs';",
    "import def from '../up.mjs';",
    "import 'node:process';",
    "export { z } from './z.mjs';",
    "const m = await import('./dyn.mjs');",
    "import { chromium } from 'playwright-core';"
  ].join('\n');
  const { specifiers, dynamicComputed } = parseImportSpecifiers(src);
  for (const s of ['./lib/a.mjs', '../up.mjs', './z.mjs', './dyn.mjs', 'node:process', 'playwright-core']) {
    assert(specifiers.includes(s), `missed specifier ${s}`);
  }
  assert(dynamicComputed === false, 'no computed dynamic import in this source');
  assert(isLocalSpecifier('./lib/a.mjs') && isLocalSpecifier('../up.mjs'), 'relative specifiers are local');
  assert(!isLocalSpecifier('node:fs') && !isLocalSpecifier('playwright-core'), 'bare specifiers are external');
  const flagged = parseImportSpecifiers("const m = await import(pathVar);");
  assert(flagged.dynamicComputed === true, 'a computed dynamic import must be flagged as an unresolvable edge');
});

await check('B2 the snapshot follows the real transitive graph and copies bytes exactly', () => {
  const io = memIo(seedFiles());
  const m = writeSourceSnapshot({ entryAbs: PROBE, outDir: OUT, repoRoot: ROOT, io, now: () => 'FIXED' });
  const paths = m.files.map((f) => f.relPath).sort();
  assert(paths.includes('run/probes/p.mjs'), 'entry must be captured');
  assert(paths.includes('run/probes/lib/a.mjs'), 'direct local import must be captured');
  assert(paths.includes('main/tools/lib/b.mjs'), 'transitive read-only repo helper must be captured');
  assert(m.fileCount === 3, `only the 3 graph files, got ${m.fileCount}`);
  for (const f of m.files) {
    const copied = io.read(join(OUT, SNAPSHOT_DIRNAME, 'files', ...f.relPath.split('/')));
    assert(sha256(copied) === f.sha256, `copied bytes for ${f.relPath} must hash to the manifest value`);
    assert(copied.equals(io.read(f.originalAbsPath)), `copy of ${f.relPath} must be byte-identical to the original`);
  }
});

await check('B3 secrets and package specifiers are recorded or ignored, never copied', () => {
  const io = memIo(seedFiles());
  const m = writeSourceSnapshot({ entryAbs: PROBE, outDir: OUT, repoRoot: ROOT, io, now: () => 'FIXED' });
  const all = JSON.stringify(m);
  assert(!m.files.some((f) => f.relPath.endsWith('.env')), 'a .env sibling must never be snapshotted');
  assert(!all.includes('do-not-copy-me'), 'no credential bytes may appear in the manifest');
  for (const [p] of io.files) assert(!p.includes('.env') || p === SECRET, 'no copy of the secret may be written');
  assert(m.externalSpecifiers.includes('playwright-core') && m.externalSpecifiers.includes('node:process'),
    'external specifiers are recorded as metadata');
});

await check('B4 relative layout and original absolute paths are BOTH preserved', () => {
  const io = memIo(seedFiles());
  const m = writeSourceSnapshot({ entryAbs: PROBE, outDir: OUT, repoRoot: ROOT, io, now: () => 'FIXED' });
  const entry = m.files.find((f) => f.role === 'entry');
  assert(entry.relPath === 'run/probes/p.mjs', 'relative path keeps the repo-relative shape');
  assert(entry.originalAbsPath === PROBE, 'the original absolute path is kept as metadata');
  assert(m.repoRoot === ROOT, 'the repo root the paths are relative to is recorded');
  const dep = m.files.find((f) => f.relPath === 'main/tools/lib/b.mjs');
  assert(dep.importedBy === 'run/probes/lib/a.mjs', 'the real importer edge is recorded');
});

await check('B5 the manifest hash is deterministic for identical bytes', () => {
  const io1 = memIo(seedFiles());
  const io2 = memIo(seedFiles());
  const a = writeSourceSnapshot({ entryAbs: PROBE, outDir: OUT, repoRoot: ROOT, io: io1, now: () => 'T1' });
  const b = writeSourceSnapshot({ entryAbs: PROBE, outDir: `${ROOT}/run/captures/cap-2`, repoRoot: ROOT, io: io2, now: () => 'T2-different-clock' });
  assert(a.manifestSha256 === b.manifestSha256, 'same source bytes must give the same manifest hash');
  assert(a.createdAt !== b.createdAt, 'timestamps differ, and must not affect the hash');
});

await check('B6 ONE changed source byte changes the manifest hash', () => {
  const seed = seedFiles();
  const io1 = memIo(seed);
  const base = writeSourceSnapshot({ entryAbs: PROBE, outDir: OUT, repoRoot: ROOT, io: io1, now: () => 'T' });
  const mutated = { ...seed, [LIB_B]: 'export const b = () => 2;\n' };  // one byte
  const io2 = memIo(mutated);
  const after = writeSourceSnapshot({ entryAbs: PROBE, outDir: OUT, repoRoot: ROOT, io: io2, now: () => 'T' });
  assert(base.manifestSha256 !== after.manifestSha256, 'a changed dependency byte must change the manifest hash');
  assert(base.entry.sha256 === after.entry.sha256, 'the entry itself was not changed, so its own hash must be stable');
});

await check('B7 an existing snapshot is never overwritten', () => {
  const io = memIo(seedFiles());
  const first = writeSourceSnapshot({ entryAbs: PROBE, outDir: OUT, repoRoot: ROOT, io, now: () => 'FIRST' });
  const manifestPath = join(OUT, SNAPSHOT_DIRNAME, MANIFEST_FILENAME);
  const before = Buffer.from(io.read(manifestPath));
  let threw = null;
  try { writeSourceSnapshot({ entryAbs: PROBE, outDir: OUT, repoRoot: ROOT, io, now: () => 'SECOND' }); } catch (e) { threw = e; }
  assert(threw, 'a second snapshot into the same capture folder must be refused');
  assert(/refusing to overwrite/i.test(threw.message), `the refusal must say why: ${threw && threw.message}`);
  assert(io.read(manifestPath).equals(before), 'the original manifest bytes must be untouched');
  assert(JSON.parse(before.toString()).createdAt === first.createdAt, 'the first snapshot still stands');
});

await check('B8 drift detection reports changed and missing sources against live bytes', () => {
  const seed = seedFiles();
  const io = memIo(seed);
  const m = writeSourceSnapshot({ entryAbs: PROBE, outDir: OUT, repoRoot: ROOT, io, now: () => 'T' });
  assert(compareToLive(m, { io }).drift === false, 'an unchanged tree must show no drift');
  io.write(LIB_B, 'export const b = () => 99;\n');
  const drifted = compareToLive(m, { io });
  assert(drifted.drift === true, 'a changed source must be detected');
  assert(drifted.changed.length === 1 && drifted.changed[0].relPath === 'main/tools/lib/b.mjs', 'the changed file must be named');
  assert(drifted.changed[0].snapshotSha256 !== drifted.changed[0].liveSha256, 'both hashes are reported');
  const io2 = memIo(seedFiles());
  io2.files.delete(LIB_A);
  const gone = compareToLive(m, { io: io2 });
  assert(gone.missing.includes('run/probes/lib/a.mjs'), 'a deleted source must be reported missing, not silently ignored');
});

await check('B9 the summary reference resolves probeSha256 back to retained bytes', () => {
  const io = memIo(seedFiles());
  const m = writeSourceSnapshot({ entryAbs: PROBE, outDir: OUT, repoRoot: ROOT, io, now: () => 'T' });
  const ref = snapshotRef(m);
  assert(ref.available === true, 'a written snapshot is available');
  assert(ref.manifestSha256 === m.manifestSha256 && ref.entrySha256 === m.entry.sha256, 'the ref carries both hashes');
  // The value a probe would put in `probeSha256` is the hash of its own bytes.
  const probeSha256 = sha256(io.read(PROBE));
  assert(probeSha256 === ref.entrySha256, 'probeSha256 must equal the snapshot entry hash');
  const retained = io.read(join(OUT, SNAPSHOT_DIRNAME, 'files', ...ref.entryRelPath.split('/')));
  assert(sha256(retained) === probeSha256, 'the retained copy must reproduce probeSha256 after later harness edits');
  const absent = snapshotRef(null);
  assert(absent.available === false, 'a capture without a snapshot must say so rather than imply one');
});

await check('B10 an unreadable import is recorded as a gap, not silently dropped', () => {
  const seed = seedFiles();
  seed[PROBE] = "import { a } from './lib/a.mjs';\nimport { missing } from './lib/missing.mjs';\n";
  const io = memIo(seed);
  const m = writeSourceSnapshot({ entryAbs: PROBE, outDir: OUT, repoRoot: ROOT, io, now: () => 'T' });
  assert(m.unresolved.some((u) => String(u.specifier).includes('missing.mjs')), 'the unresolved edge must be recorded');
  assert(m.unresolved[0].importedBy === 'run/probes/p.mjs', 'the importer of the gap is named');
});

await check('B11 planSnapshot is pure and order-independent', () => {
  const files = [
    { repoRelPath: 'b.mjs', absPath: '/x/b.mjs', sha256: 'bb', size: 2 },
    { repoRelPath: 'a.mjs', absPath: '/x/a.mjs', sha256: 'aa', size: 1 }
  ];
  const p1 = planSnapshot({ files, entryAbs: '/x/a.mjs', repoRoot: '/x' });
  const p2 = planSnapshot({ files: [...files].reverse(), entryAbs: '/x/a.mjs', repoRoot: '/x' });
  assert(p1.manifestSha256 === p2.manifestSha256, 'discovery order must not change the manifest hash');
  assert(p1.canonical[0].path === 'a.mjs', 'files are ordered by path');
  assert(p1.entrySha256 === 'aa', 'the entry is identified by path, not by position');
});

await check('B12 comment-borne phantom specifiers over-record rather than omit, and are declared', () => {
  const seed = seedFiles();
  // A doc comment that merely TALKS about an import. The parser does not strip
  // comments, so this is recorded as an external specifier. That is the
  // documented, conservative behaviour: never omit a module that really ran.
  seed[PROBE] = `/** talks about import 'phantom-pkg' in prose */\nimport { a } from './lib/a.mjs';\n`;
  const io = memIo(seed);
  const m = writeSourceSnapshot({ entryAbs: PROBE, outDir: OUT, repoRoot: ROOT, io, now: () => 'T' });
  assert(m.externalSpecifiers.includes('phantom-pkg'), 'the phantom is recorded, not hidden');
  assert(m.files.some((f) => f.relPath === 'run/probes/lib/a.mjs'), 'the real import is still captured');
  assert(m.limits.some((l) => /comments\/strings are NOT stripped/i.test(l)), 'the limitation must be stated in the manifest itself');
});

// ===========================================================================
// C. THE REAL PROBES — read-only, still offline
// ===========================================================================

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..', '..', '..');

await check('C1 the real journey probe graph reaches its libs and the repo evidence helper', () => {
  const g = collectSourceGraph({ entryAbs: join(HERE, 'cg-journey-probe.mjs'), repoRoot: REPO });
  const rel = g.files.map((f) => f.repoRelPath);
  const want = ['lib/cgContract.mjs', 'lib/captureProvenance.mjs', 'lib/physicalPose.mjs', 'lib/stallWatch.mjs', 'lib/sourceSnapshot.mjs', 'lib/ownedSession.mjs'];
  for (const w of want) assert(rel.some((r) => r.endsWith(w)), `graph missing ${w}`);
  assert(rel.some((r) => r === 'main/tools/lib/evidence.mjs'), 'the read-only repo probe helper must be included');
  assert(rel.some((r) => r === 'main/tools/lib/previewServer.mjs'), 'helpers that evidence.mjs itself imports must be included');
  assert(!rel.some((r) => r.includes('node_modules')), 'node_modules must never be walked');
  assert(!rel.some((r) => r.includes('/src/') || r.endsWith('.tsx')), 'no game source may be pulled into a probe snapshot');
});

await check('C2 the real footing diagnostic graph is complete and game-source free', () => {
  const g = collectSourceGraph({ entryAbs: join(HERE, 'cg-footing-diag.mjs'), repoRoot: REPO });
  const rel = g.files.map((f) => f.repoRelPath);
  assert(rel.some((r) => r.endsWith('cg-footing-diag.mjs')), 'entry present');
  assert(rel.some((r) => r === 'main/tools/lib/evidence.mjs'), 'the repo evidence helper is included');
  assert(!rel.some((r) => r.includes('node_modules') || r.endsWith('.tsx')), 'no packages or game sources');
  assert(g.unresolved.length === 0, `every import of the live probe must resolve: ${JSON.stringify(g.unresolved)}`);
});

await check('C3 both probes clean up in a finally and kill nothing', () => {
  for (const f of ['cg-journey-probe.mjs', 'cg-footing-diag.mjs']) {
    const src = readFileSync(join(HERE, f), 'utf8');
    assert(/\}\s*finally\s*\{[\s\S]{0,400}guard\.stopOnce\(/.test(src), `${f} must stop the owned session in a finally`);
    assert(/guard\.adopt\(await openParavoxia\(/.test(src), `${f} must adopt the session it opens`);
    for (const forbidden of ['process.kill', 'pkill', 'killall', 'SIGKILL', 'execSync(']) {
      assert(!src.includes(forbidden), `${f} must not use ${forbidden} for cleanup`);
    }
    assert(!/frameStats\([^)]*\)\s*\.catch/.test(src), `${f} must not call .catch on synchronous frameStats`);
  }
});

await check('C4 the new modules make no acceptance or visual claim', () => {
  for (const f of ['lib/ownedSession.mjs', 'lib/sourceSnapshot.mjs']) {
    const src = readFileSync(join(HERE, f), 'utf8');
    assert(!/visualAcceptance:\s*true/.test(src), `${f} must never set visualAcceptance true`);
    assert(!/outcomeIsAcceptance:\s*true/.test(src), `${f} must never claim acceptance`);
    assert(!/isSuccess:\s*true/.test(src), `${f} must never claim success`);
  }
});

// ===========================================================================
// D. THE TWO CHANGES COMPOSED, on a real temporary filesystem
//
// This wires the SAME helper modules the probes use into the same shape
// (snapshot -> trace -> capture throws -> failure record -> finally cleanup)
// against a real scratch directory. It is NOT the probe and it opens no
// browser: it shows the composition behaves, not that a capture ever ran.
// ===========================================================================

await check('D1 a thrown capture keeps the snapshot and partial trace, records the failure, cleans up once, and re-throws', async () => {
  const scratchBase = join(HERE, '..', 'artifacts', 'harness-final-prep-archive');
  mkdirSync(scratchBase, { recursive: true });
  const outDir = mkdtempSync(join(scratchBase, 'selftest-scratch-'));
  try {
    const manifest = writeSourceSnapshot({ entryAbs: join(HERE, 'cg-footing-diag.mjs'), outDir, repoRoot: REPO, note: 'offline self-test scratch' });
    const ref = snapshotRef(manifest);
    const tracePath = join(outDir, 'trace.ndjson');
    writeFileSync(tracePath, `${JSON.stringify({ kind: 'source-snapshot', sourceSnapshot: ref })}\n`);
    appendFileSync(tracePath, `${JSON.stringify({ kind: 'sample', elapsedMs: 120 })}\n`);

    const s = stubSession();
    const guard = createOwnedSessionGuard();
    guard.adopt(s);
    const boom = new TypeError('frameStats(...).catch is not a function');
    let caught = null;
    try {
      try {
        await Promise.resolve();          // a capture does some async work
        throw boom;                       // ...then the capture/summary failure
      } catch (err) {
        const rec = failureRecord({ probe: 'stub', error: err, phase: 'capture-or-summary', extra: { outDir, sourceSnapshot: ref } });
        appendFileSync(tracePath, `${JSON.stringify({ kind: 'probe-failure', failure: rec })}\n`);
        writeFileSync(join(outDir, 'failure.json'), `${JSON.stringify(rec, null, 2)}\n`);
        throw err;
      } finally {
        await guard.stopOnce('probe-finally');
      }
    } catch (e) { caught = e; }

    assert(caught === boom, 'the original capture error must reach the caller');
    assert(s.calls.stop === 1, `cleanup must run exactly once, ran ${s.calls.stop}`);
    const lines = readFileSync(tracePath, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    assert(lines[0].kind === 'source-snapshot' && lines[0].sourceSnapshot.manifestSha256 === manifest.manifestSha256,
      'the trace must carry the snapshot reference');
    assert(lines.some((l) => l.kind === 'sample'), 'partial samples written before the failure must survive');
    assert(lines.at(-1).kind === 'probe-failure', 'the failure must be recorded in the trace');
    const failed = JSON.parse(readFileSync(join(outDir, 'failure.json'), 'utf8'));
    assert(failed.outcome === 'PROBE-ERROR-INCONCLUSIVE' && failed.outcomeIsAcceptance === false, 'a failed capture is inconclusive');
    assert(!existsSync(join(outDir, 'summary.json')), 'no summary may be fabricated for a capture that failed');
    assert(existsSync(join(outDir, SNAPSHOT_DIRNAME, MANIFEST_FILENAME)), 'the snapshot survives the failure');
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});

// ===========================================================================
const summary = {
  schema: 'paravoxia.verifier.harnessPrepSelfTest.v1',
  runId: '2026-09-05-after-the-hearth',
  covers: ['pre-capture source snapshot (sourceSnapshot.mjs)', 'owned browser session cleanup (ownedSession.mjs)'],
  ranAt: new Date().toISOString(),
  offline: true,
  usedBrowser: false, usedPreview: false, usedGpu: false, usedGameBuildOrTests: false, usedNetwork: false,
  provesBrowserBehaviour: false,
  provesNote: 'Sessions are stubs. These checks prove the harness control flow invokes cleanup exactly once and propagates the original failure; they do not observe a real browser process, a preview, a renderer or any game behaviour.',
  total: results.length, passed: results.filter((r) => r.ok).length, failed: failures,
  results
};
const jsonPath = (() => { const i = process.argv.indexOf('--json'); return i >= 0 ? process.argv[i + 1] : null; })();
if (jsonPath) writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
console.log(`[cg-harness-prep-selftest] ${summary.passed}/${summary.total} passed, ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
