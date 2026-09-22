#!/usr/bin/env node
/**
 * FINALE-WINDOW DISCRIMINATOR — run-local, owned by the finale-window lane of
 * 2026-09-05-after-the-hearth. PREPARED, NOT RUN by the preparing engineer.
 *
 * WHAT IT MEASURES
 *   The exact lifetime of the Common Ground final score texture across the
 *   normal ch13 completion/handback, with every field of a record read in ONE
 *   synchronous in-page turn (windowSampler.mjs) — the fix for E1 of
 *   finale-lifecycle-audit.json. It retains ~3 s before the completion edge and
 *   >= 11 s after it, at real performance timestamps.
 *
 * WHAT IT CANNOT MEASURE (and never claims)
 *   The cancellation reason/caller (discarded at commonGroundScore.ts:259) and
 *   the AudioContext/mute/pause state (no shipped read-only hook). Those stay
 *   MISSING in the output. Timing adjacency is circumstantial, not a cause.
 *   Nothing here is an audibility, taste or acceptance claim.
 *
 * IT NEVER MUTATES THE GAME: no key input, no store/pose/anchor/progress/audio
 * write, no global patch, no AudioContext creation, no source or debug-hook
 * addition, no preview of its own. Ordinary shipped autopilot in the movie lane.
 *
 * PREPARED COMMAND (root runs it; --heavy-lock-fd must be an INHERITED,
 * ALREADY-EXCLUSIVE flock descriptor):
 *
 *   flock -x /home/thomasphillip/Projects/vox/.codex/production-runs/2026-09-05-after-the-hearth/verifier/artifacts/heavy.lock -c '\
 *     exec 9</home/thomasphillip/Projects/vox/.codex/production-runs/2026-09-05-after-the-hearth/verifier/artifacts/heavy.lock; \
 *     node .../finale-window/finale-window-probe.mjs \
 *       --out finale-window/window-1 --heavy-lock <ABS> --heavy-lock-fd 9 --probe-lock-contention'
 */
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import process from 'node:process';

import { buildInstallerSource, DEFAULT_WINDOW, KNOWN_MISSING_SIGNALS, SAMPLER_SCHEMA,
         detectEdge, shouldTerminate, decideRetention } from './windowSampler.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..', '..', '..');
const RUN_DIR = resolve(HERE, '..', '..', '..');
const CAPTURES = resolve(RUN_DIR, 'verifier', 'captures');

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] !== undefined && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const has = (n) => process.argv.includes(`--${n}`);
const sha = (b) => createHash('sha256').update(b).digest('hex');
const shaFile = (p) => { try { return sha(readFileSync(p)); } catch { return 'MISSING'; } };
const tag = (m) => console.log(`[finale-window] ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const EXPECTED = Object.freeze({
  manifestSha256: '6ef957c3dd4a1af04852773b3e5f608d2247e212eb27d05a95ba6f40c1fee5d6',
  contractSha256: '5ef85a324f579ba1f627980002aab680f6c9b990fae84275daccc3dcb17eec54',
  previewUrl: 'http://127.0.0.1:34413/',
  indexSha256: '6c8c378b282e3edef451a6957a5b5ad52591e206fc771390cdc33f9859cbb207',
  bundlePath: '/assets/index-BiDWGouH.js',
  bundleSha256: 'efc87feb0068671e6ac297f808fe61ea320b208a13fd9a8c40fa051077a9a068',
  activeRole: 'finale-window-runtime',
  storyFixture: 'ch13-survey',
  sourceFileCount: 99
});

// ------------------------------------------------------------------ guards ---
/** Rehash every manifest-listed game path. Non-binding auxiliary drift on the
 *  delta run-profile is recorded separately (producer-nonbinding-auxiliary-
 *  observation.json) and is tolerated ONLY for that one path. */
export function rehashSource({ manifestPath, repoRoot, tolerated = new Set() }) {
  const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const groups = { game: m.hashes ?? {}, aux: m.auxiliaryToolingHashes ?? {}, external: m.externalSourceChanges?.hashes ?? {} };
  const out = { manifestFileSha256: shaFile(manifestPath), counts: {}, mismatches: [], toleratedMismatches: [] };
  for (const [group, table] of Object.entries(groups)) {
    out.counts[group] = Object.keys(table).length;
    for (const [p, expected] of Object.entries(table)) {
      const actual = shaFile(resolve(repoRoot, p));
      if (actual !== expected) (tolerated.has(p) ? out.toleratedMismatches : out.mismatches).push({ group, path: p, expected, actual });
    }
  }
  out.gameFileCount = out.counts.game;
  out.clean = out.mismatches.length === 0;
  return out;
}

/** The inherited exclusive flock must be REAL: the fd must exist, point at the
 *  lock file, appear in /proc/locks as WRITE for this process, and an
 *  independent non-blocking flock attempt must FAIL (contention proof). */
export function verifyHeavyLock({ lockPath, fd, probeContention }) {
  const rec = { lockPath, fd, owned: false, problems: [], procLock: null, contentionProbe: null };
  if (!lockPath) { rec.problems.push('no --heavy-lock path'); return rec; }
  if (fd == null || Number.isNaN(fd)) { rec.problems.push('no --heavy-lock-fd (the lock must be INHERITED, not taken here)'); return rec; }
  let target = null;
  try { target = execFileSync('readlink', ['-f', `/proc/self/fd/${fd}`], { encoding: 'utf8' }).trim(); }
  catch (e) { rec.problems.push(`fd ${fd} not open: ${e.message}`); return rec; }
  rec.fdTarget = target;
  if (target !== resolve(lockPath)) rec.problems.push(`fd ${fd} points at ${target}, not ${resolve(lockPath)}`);
  try {
    const locks = readFileSync('/proc/locks', 'utf8').split('\n');
    const ino = execFileSync('stat', ['-c', '%i', lockPath], { encoding: 'utf8' }).trim();
    rec.procLock = locks.filter((l) => l.includes(`:${ino} `) || l.trim().endsWith(`:${ino} 0 EOF`)).slice(0, 4);
    if (!rec.procLock.length) rec.problems.push('no kernel lock recorded for the lock file inode');
    else if (!rec.procLock.some((l) => /FLOCK/.test(l) && /WRITE/.test(l))) rec.problems.push('kernel lock present but not an exclusive FLOCK WRITE');
  } catch (e) { rec.problems.push(`/proc/locks read failed: ${e.message}`); }
  if (probeContention) {
    try {
      execFileSync('flock', ['-n', '-x', lockPath, '-c', 'true'], { stdio: 'ignore' });
      rec.contentionProbe = { attempted: true, acquiredBySecondProcess: true };
      rec.problems.push('CONTENTION PROOF FAILED: a second process took the lock, so this run is NOT exclusive');
    } catch { rec.contentionProbe = { attempted: true, acquiredBySecondProcess: false, note: 'second flock -n was refused: the lock is genuinely held' }; }
  }
  rec.owned = rec.problems.length === 0;
  return rec;
}

/** Output dir must be new and empty; a re-used name silently overwrites evidence. */
export function assertFreshDir(dir) {
  const rec = { path: dir, exists: existsSync(dir), entries: [], fresh: false };
  if (rec.exists) rec.entries = readdirSync(dir);
  rec.fresh = !rec.exists || rec.entries.length === 0;
  if (!rec.fresh) throw new Error(`refusing to write into a non-empty output dir: ${dir} (${rec.entries.length} entries)`);
  mkdirSync(dir, { recursive: true });
  return rec;
}

/** Root control must have handed this lane the runtime role. */
export function verifyControl(controlPath, expectedRole) {
  const c = JSON.parse(readFileSync(controlPath, 'utf8'));
  return {
    activeRole: c.activeRole ?? null, action: c.action ?? null, updatedAt: c.updatedAt ?? null,
    currentPreviewUrl: c.currentPreviewUrl ?? null, currentIndexSha256: c.currentIndexSha256 ?? null,
    sourceManifestSha256: c.sourceManifestSha256 ?? null,
    roleGranted: c.activeRole === expectedRole,
    running: !['stop', 'halt', 'pause'].includes(String(c.action))
  };
}

// ------------------------------------------------------------- self-test ----
if (has('self-test')) {
  const fails = [];
  const ok = (name, cond, extra = '') => { if (!cond) fails.push(`${name} ${extra}`); };
  const S = (o) => ({ story: { available: true, ...o } });

  // 1. atomic sampler structure: the installer is ONE function body, and every
  //    documented signal is read inside it (no second evaluate can interleave).
  const src = buildInstallerSource();
  ok('installer-is-single-arrow', /^\(cfg\) => \{/.test(src.trim()));
  ok('installer-has-no-await', !/\bawait\b/.test(src));
  ok('installer-has-no-async', !/\basync\b/.test(src));
  for (const needed of ['__paravoxiaCommonGround', 'finalTextureSeconds', '__paravoxiaJourneyProbe',
                        'avFullHasComplete', 'avFullHasHandback', '__voxBundleDiag', 'heldChain',
                        '__voxAudioDiag', 'visibilityState', 'hasFocus', 'runId', '__autopilot'])
    ok(`installer-reads-${needed}`, src.includes(needed));
  ok('installer-never-writes-game-state', !/__paravoxiaJourneyProbe\.[a-zA-Z]+\s*=|localStorage\.setItem|new AudioContext|\.resume\(\)|dispatchEvent\(/.test(src));
  ok('sampler-exposes-one-sample-function', /sampleNow: \(\) => sample\(null\)/.test(src));

  // 2. completion edge requires a REAL complete+handback AV history
  ok('edge-needs-av-history', detectEdge(S({ beat: 'done', active: false, avFullHasComplete: false, avFullHasHandback: false })) === false);
  ok('edge-needs-handback', detectEdge(S({ beat: 'done', active: false, avFullHasComplete: true, avFullHasHandback: false })) === false);
  ok('edge-on-done-plus-history', detectEdge(S({ beat: 'done', active: false, avFullHasComplete: true, avFullHasHandback: true })) === true);
  ok('edge-not-on-live-beat', detectEdge(S({ beat: 'ch13-common', active: true, avFullHasComplete: true, avFullHasHandback: true })) === false);
  ok('edge-unavailable-story-is-not-an-edge', detectEdge({ story: { available: false, reason: 'x' } }) === false);

  // 3. event-window termination
  const st = { startedAtMs: 0, edgeAtMs: 1000 };
  ok('holds-through-11s', shouldTerminate(st, 1000 + 11000, DEFAULT_WINDOW) === null, '(must still be sampling at +11 s)');
  ok('seals-after-postEdgeMs', shouldTerminate(st, 1000 + DEFAULT_WINDOW.postEdgeMs, DEFAULT_WINDOW) === 'window-complete');
  ok('post-edge-window-covers-11s', DEFAULT_WINDOW.postEdgeMs >= 11000);
  ok('window-is-about-12s', DEFAULT_WINDOW.preEdgeMs + DEFAULT_WINDOW.postEdgeMs >= 12000);
  ok('no-edge-is-a-failure-not-a-pass', shouldTerminate({ startedAtMs: 0, edgeAtMs: null }, DEFAULT_WINDOW.maxRunMs, DEFAULT_WINDOW) === 'max-run-no-edge');
  ok('truncated-window-is-named', shouldTerminate({ startedAtMs: 0, edgeAtMs: DEFAULT_WINDOW.maxRunMs - 10 }, DEFAULT_WINDOW.maxRunMs, DEFAULT_WINDOW) === 'max-run-truncated-window');

  // 4. retention keeps the pre-edge tail and never discards post-edge samples
  const buf = Array.from({ length: 100 }, (_, i) => ({ tMs: i * 100 }));           // 0..9900 ms
  ok('pre-edge-trims-to-window', decideRetention(buf, 9900, null, DEFAULT_WINDOW).dropFromHead === 69);
  ok('post-edge-keeps-everything-after-edge', decideRetention(buf, 9900, 5000, DEFAULT_WINDOW).dropFromHead === 20);
  ok('cap-hit-is-reported', decideRetention(buf, 9900, 5000, { ...DEFAULT_WINDOW, maxSamples: 10 }).capHit === true);

  // 5. guards
  ok('missing-fd-is-refused', verifyHeavyLock({ lockPath: '/tmp/x.lock', fd: null, probeContention: false }).owned === false);
  ok('missing-lock-path-is-refused', verifyHeavyLock({ lockPath: null, fd: 9, probeContention: false }).owned === false);
  const ctl = verifyControl(resolve(RUN_DIR, 'verifier-control.json'), EXPECTED.activeRole);
  ok('control-role-gate-is-live', typeof ctl.activeRole === 'string');
  ok('control-role-gate-refuses-other-lane', verifyControl(resolve(RUN_DIR, 'verifier-control.json'), '__never__').roleGranted === false);
  let refused = false;
  try { assertFreshDir(resolve(RUN_DIR, 'verifier', 'probes', 'finale-window')); } catch { refused = true; }
  ok('non-empty-out-dir-is-refused', refused);
  const rh = rehashSource({ manifestPath: resolve(RUN_DIR, 'implementation-source-manifest.json'), repoRoot: REPO_ROOT,
    tolerated: new Set(['docs/architecture/workflow-orchestration/run-profiles/paravoxia-creative-delta.run-profile.json']) });
  ok('rehash-sees-99-game-paths', rh.gameFileCount === EXPECTED.sourceFileCount, `got ${rh.gameFileCount}`);
  ok('rehash-game-paths-exact', rh.clean, JSON.stringify(rh.mismatches).slice(0, 300));
  ok('manifest-hash-pinned', rh.manifestFileSha256 === EXPECTED.manifestSha256, rh.manifestFileSha256);
  ok('contract-hash-pinned', shaFile(resolve(RUN_DIR, 'scene-contract.json')) === EXPECTED.contractSha256);

  // 6. honesty: the missing signals stay declared
  ok('missing-signals-declared', KNOWN_MISSING_SIGNALS.length === 3 && KNOWN_MISSING_SIGNALS.every((s) => s.why && s.consequence));

  console.log(JSON.stringify({ schema: 'paravoxia.verifier.finaleWindowSelfTest.v1', checks: 33, failed: fails.length,
    failures: fails, rehash: { gameFiles: rh.gameFileCount, mismatches: rh.mismatches.length, tolerated: rh.toleratedMismatches.length },
    control: ctl, at: new Date().toISOString() }, null, 1));
  if (fails.length) { console.error(`[finale-window self-test] FAIL:\n - ${fails.join('\n - ')}`); process.exit(1); }
  console.log('[finale-window self-test] PASS — CPU only; no browser, no game state, nothing measured about the chapter.');
  process.exit(0);
}

// --------------------------------------------------------------- capture ----
// Everything below runs ONLY under the GPU lane, when root grants the role.
const outName = arg('out', 'finale-window/window-1');
const outDir = resolve(CAPTURES, outName);
const unmuted = has('unmuted');       // live-output run: shipped flags MINUS --mute-audio
const driver = arg('driver', 'raf');
const windowCfg = { ...DEFAULT_WINDOW, driver,
  preEdgeMs: Number(arg('pre-edge-ms', String(DEFAULT_WINDOW.preEdgeMs))),
  postEdgeMs: Number(arg('post-edge-ms', String(DEFAULT_WINDOW.postEdgeMs))),
  timerMs: Number(arg('timer-ms', '8')) };
const seconds = Number(arg('seconds', '360'));

const main = async () => {
  const started = new Date().toISOString();
  const guards = {};
  guards.control = verifyControl(resolve(RUN_DIR, 'verifier-control.json'), EXPECTED.activeRole);
  if (!guards.control.roleGranted || !guards.control.running)
    throw new Error(`role gate: control.activeRole=${guards.control.activeRole} action=${guards.control.action}; this lane needs ${EXPECTED.activeRole}`);
  guards.ready = JSON.parse(readFileSync(resolve(RUN_DIR, 'verification-ready.json'), 'utf8')).ready === true;
  if (!guards.ready) throw new Error('verification-ready.json is not ready');
  guards.rehash = rehashSource({ manifestPath: resolve(RUN_DIR, 'implementation-source-manifest.json'), repoRoot: REPO_ROOT,
    tolerated: new Set(['docs/architecture/workflow-orchestration/run-profiles/paravoxia-creative-delta.run-profile.json']) });
  if (!guards.rehash.clean) throw new Error(`source drift: ${JSON.stringify(guards.rehash.mismatches).slice(0, 400)}`);
  if (guards.rehash.manifestFileSha256 !== EXPECTED.manifestSha256) throw new Error('manifest hash is not the pinned one');
  guards.contractSha256 = shaFile(resolve(RUN_DIR, 'scene-contract.json'));
  if (guards.contractSha256 !== EXPECTED.contractSha256) throw new Error('scene-v3 contract hash mismatch');
  guards.heavyLock = verifyHeavyLock({ lockPath: arg('heavy-lock', process.env.PARAVOXIA_HEAVY_LOCK ?? null),
    fd: arg('heavy-lock-fd') == null ? null : Number(arg('heavy-lock-fd')), probeContention: has('probe-lock-contention') });
  if (!guards.heavyLock.owned) throw new Error(`heavy lock: ${guards.heavyLock.problems.join('; ')}`);

  // Root-owned preview identity over HTTP — liveness is not identity (CLAUDE.md).
  const ownership = JSON.parse(readFileSync(resolve(RUN_DIR, 'verifier', 'artifacts', 'preview-ownership.json'), 'utf8'));
  if (ownership.state !== 'running' || ownership.url !== EXPECTED.previewUrl) throw new Error('root preview ownership is not the pinned running 34413 preview');
  const indexHtml = await (await fetch(EXPECTED.previewUrl)).text();
  const bundleJs = await (await fetch(new URL(EXPECTED.bundlePath, EXPECTED.previewUrl))).text();
  guards.http = { indexSha256: sha(indexHtml), bundleSha256: sha(bundleJs), titleIsParavoxia: /<title>\s*Paravoxia\s*<\/title>/i.test(indexHtml) };
  if (guards.http.indexSha256 !== EXPECTED.indexSha256 || guards.http.bundleSha256 !== EXPECTED.bundleSha256 || !guards.http.titleIsParavoxia)
    throw new Error('served identity mismatch: this is not the pinned immutable build');

  guards.outDir = assertFreshDir(outDir);
  // Archive the probe's own dependency bytes BEFORE the run.
  const deps = ['finale-window-probe.mjs', 'windowSampler.mjs'].map((f) => ({ file: f, sha256: shaFile(resolve(HERE, f)) }));
  mkdirSync(resolve(outDir, 'probe-snapshot'), { recursive: true });
  for (const d of deps) writeFileSync(resolve(outDir, 'probe-snapshot', d.file), readFileSync(resolve(HERE, d.file)));
  writeFileSync(resolve(outDir, 'probe-snapshot', 'manifest.json'), JSON.stringify({ deps, archivedAt: new Date().toISOString() }, null, 1));

  const { openParavoxia, waitReady, SWIFTSHADER } = await import('../../../../../main/tools/lib/evidence.mjs');
  const { chromePath, CHROMIUM_ARGS, assertHardwareGl } = await import('../../../../../main/tools/lib/previewServer.mjs');
  if (SWIFTSHADER) throw new Error('PARAVOXIA_ALLOW_SWIFTSHADER is set: refusing — a SwiftShader measurement measures SwiftShader');
  const { createOwnedSessionGuard, failureRecord } = await import('../lib/ownedSession.mjs');
  const cleanup = createOwnedSessionGuard({ log: tag, label: 'finale-window owned session' });

  const url = `${EXPECTED.previewUrl}?story=${EXPECTED.storyFixture}&journeyprobe=1&debug=1&movie=1`;
  let session;
  if (!unmuted) {
    session = cleanup.adopt(await openParavoxia({ url, preview: { url: EXPECTED.previewUrl, stop() {} }, build: false, log: tag }));
  } else {
    // LIVE-OUTPUT variant: the SAME shipped headed route and flags, minus
    // --mute-audio (which would silence the very output we are recording).
    // Nothing else differs; no headless, no SwiftShader, no game change.
    const { chromium } = await import('playwright');
    const viewport = { width: 1280, height: 720 };
    const args = [...CHROMIUM_ARGS.filter((a) => a !== '--enable-unsafe-swiftshader' && a !== '--mute-audio'),
      '--enable-gpu', '--use-angle=gl', `--window-size=${viewport.width},${viewport.height}`];
    if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) process.env.DISPLAY = ':0';
    const browser = await chromium.launch({ executablePath: chromePath(), headless: false, args });
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const pageErrors = []; page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)));
    await page.goto(url, { waitUntil: 'load', timeout: 180_000 });
    const renderer = await assertHardwareGl(page, tag);
    session = cleanup.adopt({ browser, context, page, renderer, headed: true, url, pageErrors, launchArgs: args,
      stop: async () => { await browser.close().catch(() => {}); } });
  }
  const { page } = session;

  let result;
  try {
    result = await cleanup.runGuarded(async () => {
      await waitReady(page, { timeoutMs: 120_000 });
      // Arm the atomic sampler EARLY, well before completion. From here until
      // the window is sealed this probe issues NO screenshot, so no CDP call
      // can be the reason the completion edge is missed.
      const install = await page.evaluate(buildInstallerSource(), windowCfg);
      tag(`sampler armed: ${JSON.stringify(install.inventory)}`);
      const baseline = { role: 'pre-window-baseline', at: Date.now(),
        state: await page.evaluate(() => window.__finaleWindowProbe.sampleNow()) };
      await page.screenshot({ path: resolve(outDir, '0000-pre-window-baseline.png') });

      const deadline = Date.now() + seconds * 1000;
      let status = null;
      while (Date.now() < deadline) {
        status = await page.evaluate(() => window.__finaleWindowProbe.status());  // tiny; no buffer transfer
        if (status.sealed) break;
        await sleep(500);
      }
      if (!status?.sealed) throw new Error(`window never sealed within ${seconds}s: ${JSON.stringify(status)}`);

      // SERIALIZE AFTER the window is sealed — the buffer, not a live read, is
      // the evidence; nothing below can perturb the measured window.
      const drained = await page.evaluate(() => window.__finaleWindowProbe.drain());
      writeFileSync(resolve(outDir, 'window.ndjson'), drained.samples.map((s) => JSON.stringify(s)).join('\n') + '\n');

      // A SMALL set of post-seal frames, each with its own atomic before/after
      // sample and real offsets. These are honestly LATE frames: the completion
      // edge lives in window.ndjson, never in a screenshot.
      const frames = [];
      for (let i = 0; i < 3; i += 1) {
        const before = await page.evaluate(() => window.__finaleWindowProbe?.sampleNow?.() ?? null);
        const t0 = Date.now();
        const file = `00${i + 1}-post-seal-${i}.png`;
        await page.screenshot({ path: resolve(outDir, file) });
        const after = await page.evaluate(() => window.__finaleWindowProbe?.sampleNow?.() ?? null);
        frames.push({ file, role: 'post-seal', shotWallMs: t0, shotDurationMs: Date.now() - t0, before, after,
          note: 'Taken AFTER the sampled window was sealed. It is not the completion edge and is not simultaneous with either state read.' });
        await sleep(400);
      }
      await page.evaluate(() => window.__finaleWindowProbe?.teardown?.());
      return { drainState: drained.state, inventory: drained.inventory, sampleCount: drained.samples.length, baseline, frames, install };
    });
  } catch (error) {
    writeFileSync(resolve(outDir, 'failure.json'), JSON.stringify(failureRecord({ probe: 'finale-window-probe.mjs', error }), null, 1));
    writeFileSync(resolve(outDir, 'cleanup-receipt.json'), JSON.stringify(cleanup.cleanupReceipt({ probe: 'finale-window-probe.mjs' }), null, 1));
    throw error;
  }

  const summary = {
    schema: 'paravoxia.verifier.finaleWindow.v1',
    outcome: 'WINDOW-OBSERVED-NO-VERDICT',
    outcomeIsAcceptance: false,
    outcomeNote: 'A recorded window is an observation. This file makes no audible, causal, repair or acceptance claim; the cancellation reason and the AudioContext/mute/pause state are NOT observable through any shipped hook and are listed as missing.',
    runId: '2026-09-05-after-the-hearth', probe: 'finale-window-probe.mjs',
    probeSha256: shaFile(resolve(HERE, 'finale-window-probe.mjs')), dependencyBytes: deps,
    startedAt: started, endedAt: new Date().toISOString(),
    guards, request: { url, unmuted, windowCfg, seconds, outDir },
    renderer: session.renderer, headed: session.headed, launchArgs: session.launchArgs ?? 'shipped openParavoxia args (includes --mute-audio)',
    samplerSchema: SAMPLER_SCHEMA, hookInventory: result.inventory, window: result.drainState,
    sampleCount: result.sampleCount, baseline: result.baseline, frames: result.frames,
    missingSignals: KNOWN_MISSING_SIGNALS,
    atomicity: 'Every field of every window.ndjson record was read inside ONE synchronous function call in ONE rAF callback. No record is stitched from separate awaited reads.',
    pageErrors: session.pageErrors ?? []
  };
  writeFileSync(resolve(outDir, 'summary.json'), JSON.stringify(summary, null, 1));
  writeFileSync(resolve(outDir, 'cleanup-receipt.json'), JSON.stringify(cleanup.cleanupReceipt({ probe: 'finale-window-probe.mjs' }), null, 1));
  tag(`window sealed (${result.drainState.sealReason}) with ${result.sampleCount} atomic samples -> ${outDir}`);
};

main().catch((e) => { console.error(`[finale-window] FAILED: ${e.stack ?? e}`); process.exit(1); });
