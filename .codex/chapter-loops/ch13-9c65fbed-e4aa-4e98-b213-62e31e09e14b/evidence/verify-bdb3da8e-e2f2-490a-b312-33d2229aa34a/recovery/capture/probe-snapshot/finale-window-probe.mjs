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
 *   bash -c 'exec 9>/home/thomasphillip/Projects/vox/.codex/production-runs/2026-09-05-after-the-hearth/verifier/artifacts/heavy.lock; \
 *     flock -w 60 -x 9 || exit 75; \
 *     node /home/thomasphillip/Projects/vox/.codex/production-runs/2026-09-05-after-the-hearth/verifier/probes/finale-window/finale-window-probe.mjs \
 *       --out finale-window/window-1 \
 *       --heavy-lock /home/thomasphillip/Projects/vox/.codex/production-runs/2026-09-05-after-the-hearth/verifier/artifacts/heavy.lock \
 *       --heavy-lock-fd 9 --probe-lock-contention'
 *
 * The shell opens fd 9 ONCE and flocks THAT descriptor; node inherits the same
 * open file description and therefore the same held lock. (The previous
 * illustrative form wrapped `flock -c` around a second `exec 9<...` open: that
 * reopened the file, so fd 9 inside node was an UNLOCKED description and the
 * probe's own --probe-lock-contention check was meaningless.)
 */
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync,
         readlinkSync, statSync, fstatSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import process from 'node:process';

import { buildInstallerSource, DEFAULT_WINDOW, KNOWN_MISSING_SIGNALS, SAMPLER_SCHEMA,
         detectEdge, shouldTerminate, decideRetention } from './windowSampler.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..', '..', '..', '..');
const RUN_DIR = resolve(HERE, '..', '..', '..', '..');
/** The installed browser driver, resolved by path (see the launch site). */
export const PLAYWRIGHT_CORE_URL =
  pathToFileURL(resolve(REPO_ROOT, 'main', 'node_modules', 'playwright-core', 'index.mjs')).href;
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
  manifestSha256: '2de3fa2aef0d577bdeca7fe9eaa4612751b2946115207fa9c18d2e8613bb9f63',
  contractSha256: '5ef85a324f579ba1f627980002aab680f6c9b990fae84275daccc3dcb17eec54',
  previewUrl: 'http://127.0.0.1:34825/',
  indexSha256: '74025800f5312519a92b480a15b493c3b27f971f0cbcbe1ec2b571342d4f4c82',
  bundlePath: '/assets/index-Ddqg7x9Y.js',
  bundleSha256: '4b41a7d50f2da85a010eb534540187404bc10a7c2cd474c6653e5030923c83e9',
  activeRole: 'finale-authority-seam-runtime',
  storyFixture: 'ch13-survey',
  sourceFileCount: 103
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
      if (group === 'aux' && p === 'main/package.json' && actual !== expected) {
        const pkg = JSON.parse(readFileSync(resolve(repoRoot, p), 'utf8'));
        if (pkg.scripts?.['chapter:loop'] === 'node tools/chapter-loop.mjs'
          && pkg.scripts?.['chapter:loop:test'] === 'node --test tools/chapter-loop/loop.test.mjs') {
          delete pkg.scripts['chapter:loop']; delete pkg.scripts['chapter:loop:test'];
          if (createHash('sha256').update(JSON.stringify(pkg, null, 2) + '\n').digest('hex') === expected) {
            out.toleratedMismatches.push({ group, path: p, expected, actual, reason: 'Exact addition of the two Chapter Loop commands; every pre-existing package field and dependency is byte-equivalent.' });
            continue;
          }
        }
      }
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
  const rec = { lockPath, fd, pid: process.pid, owned: false, problems: [], fdTarget: null,
                fdIdentity: null, inode: null, procLock: null, contentionProbe: null };
  if (!lockPath) { rec.problems.push('no --heavy-lock path'); return rec; }
  if (fd == null || Number.isNaN(fd)) { rec.problems.push('no --heavy-lock-fd (the lock must be INHERITED, not taken here)'); return rec; }
  const wanted = resolve(lockPath);

  // The descriptor belongs to THIS probe process. It must therefore be read
  // IN-PROCESS. The previous execFileSync('readlink', ['-f','/proc/self/fd/9'])
  // resolved /proc/self inside the *spawned readlink*, whose stdio never
  // carries fd 9 -- so it reported "not open" for a descriptor this process
  // genuinely holds. fs.readlinkSync resolves /proc/self as the owning Node.
  try { rec.fdTarget = readlinkSync(`/proc/self/fd/${fd}`); }
  catch (e) { rec.problems.push(`fd ${fd} not open in this process (pid ${process.pid}): ${e.code ?? e.message}`); return rec; }
  if (rec.fdTarget !== wanted) rec.problems.push(`fd ${fd} points at ${rec.fdTarget}, not ${wanted}`);

  // Independent identity: the open description and the named lock file must be
  // the SAME dev/inode. A matching path string alone can be stale or replaced.
  try {
    const viaFd = fstatSync(fd);
    const viaPath = statSync(wanted);
    rec.inode = String(viaPath.ino);
    rec.fdIdentity = { fdDev: String(viaFd.dev), fdIno: String(viaFd.ino),
                       pathDev: String(viaPath.dev), pathIno: String(viaPath.ino),
                       match: viaFd.dev === viaPath.dev && viaFd.ino === viaPath.ino };
    if (!rec.fdIdentity.match) {
      rec.problems.push(`fd ${fd} is dev/inode ${viaFd.dev}:${viaFd.ino}, but ${wanted} is ${viaPath.dev}:${viaPath.ino}`);
    }
  } catch (e) { rec.problems.push(`fd/inode identity check failed: ${e.code ?? e.message}`); return rec; }

  // Kernel must record an exclusive FLOCK WRITE against that inode.
  try {
    const locks = readFileSync('/proc/locks', 'utf8').split('\n');
    const ino = rec.inode;
    rec.procLock = locks.filter((l) => l.includes(`:${ino} `) || l.trim().endsWith(`:${ino} 0 EOF`)).slice(0, 4);
    if (!rec.procLock.length) rec.problems.push('no kernel lock recorded for the lock file inode');
    else if (!rec.procLock.some((l) => /FLOCK/.test(l) && /WRITE/.test(l))) rec.problems.push('kernel lock present but not an exclusive FLOCK WRITE');
  } catch (e) { rec.problems.push(`/proc/locks read failed: ${e.code ?? e.message}`); }

  // Independent contention refusal. ONLY flock's documented exit 1 (failed to
  // acquire a non-blocking lock) proves the lock is held by someone else.
  // A spawn error, a signal, or any other exit status is an INCONCLUSIVE
  // command failure and must NOT be laundered into contention proof.
  if (probeContention) {
    const r = spawnSync('flock', ['-n', '-x', wanted, '-c', 'true'], { stdio: 'ignore' });
    if (r.error) {
      rec.contentionProbe = { attempted: true, conclusive: false, status: null, signal: null,
                              reason: `flock could not be executed: ${r.error.code ?? r.error.message}` };
      rec.problems.push(`CONTENTION PROOF INCONCLUSIVE: flock could not be executed (${r.error.code ?? r.error.message})`);
    } else if (r.signal) {
      rec.contentionProbe = { attempted: true, conclusive: false, status: r.status, signal: r.signal,
                              reason: 'flock died on a signal; not a contention result' };
      rec.problems.push(`CONTENTION PROOF INCONCLUSIVE: flock killed by ${r.signal}`);
    } else if (r.status === 0) {
      rec.contentionProbe = { attempted: true, conclusive: true, status: 0, signal: null,
                              acquiredBySecondProcess: true };
      rec.problems.push('CONTENTION PROOF FAILED: a second process took the lock, so this run is NOT exclusive');
    } else if (r.status === 1) {
      rec.contentionProbe = { attempted: true, conclusive: true, status: 1, signal: null,
                              acquiredBySecondProcess: false,
                              note: 'second flock -n exited 1: refused, the lock is genuinely held' };
    } else {
      rec.contentionProbe = { attempted: true, conclusive: false, status: r.status, signal: null,
                              reason: `unexpected flock exit ${r.status}; only exit 1 proves contention` };
      rec.problems.push(`CONTENTION PROOF INCONCLUSIVE: flock exited ${r.status}, not 1`);
    }
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
  // Fixtures use the ACTUAL sampler shape: story.* carries avMemberPresent and the
  // exact-membership avHasCgComplete/avHasCgHandback flags derived from
  // state.signedSceneAv.activationHistoryAnchorIds, and the dual-18 committed COMMON
  // route arrives on the SAME atomic record under cg.common.
  const CG18 = (o = {}) => ({
    available: true,
    common: {
      available: true, value: 'common', committed: true, committedPresent: true,
      workerUnits: 18, workerUnitsPresent: true, terraUnits: 18, terraUnitsPresent: true,
      ...o
    }
  });
  const S = (o, cg = CG18()) => ({ story: { available: true, avMemberPresent: true, avHistoryPresent: true, ...o }, cg });

  // 1. atomic sampler structure: the installer is ONE function body, and every
  //    documented signal is read inside it (no second evaluate can interleave).
  const src = buildInstallerSource();
  ok('installer-is-single-arrow', /^\(cfg\) => \{/.test(src.trim()));
  ok('installer-has-no-await', !/\bawait\b/.test(src));
  ok('installer-has-no-async', !/\basync\b/.test(src));
  for (const needed of ['__paravoxiaCommonGround', 'finalTextureSeconds', '__paravoxiaJourneyProbe',
                        'avHasCgComplete', 'avHasCgHandback', 'signedSceneAv',
                        'activationHistoryAnchorIds', '__voxBundleDiag', 'heldChain',
                        '__voxAudioDiag', 'visibilityState', 'hasFocus', 'runId', '__autopilot'])
    ok(`installer-reads-${needed}`, src.includes(needed));
  ok('installer-never-writes-game-state', !/__paravoxiaJourneyProbe\.[a-zA-Z]+\s*=|localStorage\.setItem|new AudioContext|\.resume\(\)|dispatchEvent\(/.test(src));
  ok('sampler-exposes-one-sample-function', /sampleNow: \(\) => sample\(null\)/.test(src));

  // 2. completion edge requires a REAL complete+handback AV history
  ok('edge-needs-av-history', detectEdge(S({ beat: 'done', active: false, avHasCgComplete: false, avHasCgHandback: false })) === false);
  ok('edge-needs-handback', detectEdge(S({ beat: 'done', active: false, avHasCgComplete: true, avHasCgHandback: false })) === false);
  // POSITIVE edge needs BOTH AV anchors AND the dual-18 committed COMMON route
  // in the same atomic record.
  ok('edge-on-done-plus-history', detectEdge(S({ beat: 'done', active: false, avHasCgComplete: true, avHasCgHandback: true })) === true);
  ok('edge-not-on-live-beat', detectEdge(S({ beat: 'ch13-common', active: true, avHasCgComplete: true, avHasCgHandback: true })) === false);
  // preserved negatives on the dual-18 side: neither side alone, nor uncommitted, is an edge
  const AVOK = { beat: 'done', active: false, avHasCgComplete: true, avHasCgHandback: true };
  ok('edge-needs-terra-18', detectEdge(S(AVOK, CG18({ terraUnits: 17 }))) === false);
  ok('edge-needs-worker-18', detectEdge(S(AVOK, CG18({ workerUnits: 6 }))) === false);
  ok('edge-needs-committed', detectEdge(S(AVOK, CG18({ committed: false }))) === false);
  ok('edge-absent-units-are-not-false', detectEdge(S(AVOK, CG18({ terraUnits: null, terraUnitsPresent: false }))) === false);
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
  ok('rehash-sees-100-game-paths', rh.gameFileCount === EXPECTED.sourceFileCount, `got ${rh.gameFileCount}`);
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

/**
 * The REAL owned-browser pid, through a SUPPORTED Playwright API.
 *
 * VERIFIED against the installed driver, playwright-core 1.61.0
 * (main/node_modules/playwright-core/types/types.d.ts):
 *   - `export interface Browser` spans 9949-10693 and has NO `process()`
 *     member. `chromium.launch()` resolves to THAT Browser.
 *   - `process(): ChildProcess` exists ONLY on `ElectronApplication` (17092)
 *     and `BrowserServer` (18431) — neither of which we hold here.
 *   - `newBrowserCDPSession(): Promise<CDPSession>` IS on Browser (10128).
 * So the previous `browser.process()?.pid` was not merely null-safe-looking:
 * `browser.process` is `undefined`, and calling it threw a TypeError at the
 * adopt() argument — i.e. BEFORE the guard could take ownership — leaking the
 * launched headed browser. It is removed, not "made safe".
 *
 * We ask Chromium itself which of its processes is the browser process. No
 * pgrep, no global process scan, no foreign or guessed pid: the answer comes
 * from a CDP session bound to the browser THIS probe launched.
 */
export async function ownedBrowserPid(browser) {
  const cdp = await browser.newBrowserCDPSession();
  try {
    const info = await cdp.send('SystemInfo.getProcessInfo');
    const list = Array.isArray(info?.processInfo) ? info.processInfo : [];
    const entry = list.find((p) => p && p.type === 'browser');
    const pid = entry?.id;
    if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0) {
      throw new Error(`SystemInfo.getProcessInfo returned no usable browser-process entry (types seen: ${JSON.stringify(list.map((p) => p?.type)).slice(0, 200)})`);
    }
    return pid;
  } finally {
    if (typeof cdp?.detach === 'function') await cdp.detach().catch(() => {});
  }
}

/**
 * THE startup path for the live-output variant. main() calls exactly this, and
 * the CPU self-test calls exactly this too — there is no second happy-path copy
 * that could drift away from the real call site.
 *
 * Ordering rule (the leak fix): launch -> ADOPT -> everything fallible. The
 * pid lookup, newContext, newPage, goto and the hardware-GL assertion are ALL
 * after adoption, so any of them throwing closes the probe's own browser
 * through the same guard. A pid-lookup failure writes NO browser-pid.json, so
 * the audio wrapper refuses to record rather than claim ownership of an
 * unbound process.
 */
export async function startUnmutedOwnedSession({
  chromium, cleanup, failureRecord, assertHardwareGl, writeOut,
  url, viewport, args, pulseSink = null, launchOptions,
  tag = () => {}, pidOf = ownedBrowserPid, probePid = process.pid,
  probe = 'finale-window-probe.mjs'
}) {
  const browser = await chromium.launch(launchOptions);
  const pageErrors = [];
  // ADOPT IMMEDIATELY, before ANY other fallible call on the browser.
  const session = cleanup.adopt({
    browser, context: null, page: null, renderer: null, headed: true, url,
    pageErrors, launchArgs: args, browserPid: null,
    // NOT `.catch(() => {})`: a close() failure must surface as the guard's
    // stopError with stopped === false, never be reported as a clean stop.
    stop: async () => { await browser.close(); }
  });
  let phase = 'owned-browser-pid-lookup';
  try {
    session.browserPid = await pidOf(browser);
    writeOut('browser-pid.json', {
      browserPid: session.browserPid, probePid, pulseSink: pulseSink ?? null,
      source: 'browser.newBrowserCDPSession() + SystemInfo.getProcessInfo (type==="browser")',
      at: new Date().toISOString()
    });
    tag(`owned browser pid ${session.browserPid} (via owned CDP SystemInfo.getProcessInfo)`);
    phase = 'custom-browser-bringup';
    session.context = await browser.newContext({ viewport });
    session.page = await session.context.newPage();
    session.page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)));
    await session.page.goto(url, { waitUntil: 'load', timeout: 180_000 });
    session.renderer = await assertHardwareGl(session.page, tag);
  } catch (error) {
    // Close the adopted browser through the SAME guard used on the happy path,
    // then record the failing phase honestly and rethrow.
    await cleanup.stopOnce(`${phase}-failed`);
    writeOut('failure.json', failureRecord({ probe, error, phase }));
    writeOut('cleanup-receipt.json', cleanup.cleanupReceipt({ probe }));
    throw error;
  }
  return session;
}

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
  if (ownership.state !== 'running' || ownership.url !== EXPECTED.previewUrl) throw new Error('root preview ownership is not the pinned running 34825 preview');
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

  const { openParavoxia, waitReady, SWIFTSHADER } = await import('../../../../../../../main/tools/lib/evidence.mjs');
  const { chromePath, CHROMIUM_ARGS, assertHardwareGl } = await import('../../../../../../../main/tools/lib/previewServer.mjs');
  if (SWIFTSHADER) throw new Error('PARAVOXIA_ALLOW_SWIFTSHADER is set: refusing — a SwiftShader measurement measures SwiftShader');
  const { createOwnedSessionGuard, failureRecord } = await import('../../lib/ownedSession.mjs');
  const cleanup = createOwnedSessionGuard({ log: tag, label: 'finale-window owned session' });

  // BOUNDED COOPERATIVE TERMINATION. The control wrapper owns this child; when
  // it aborts (pid failure, ownership refusal, session timeout) it writes
  // stop-request.json and/or sends SIGTERM. Both paths close THIS probe's OWN
  // adopted browser through the same guard and leave a cleanup receipt the
  // wrapper waits for. Nothing here touches a foreign process, a global chrome
  // or root's 34413 preview — stopOnce() only stops the session this probe
  // itself adopted.
  const stopFile = resolve(outDir, 'stop-request.json');
  let terminating = false;
  const terminate = (why, code) => {
    if (terminating) return;
    terminating = true;
    const hardExit = setTimeout(() => process.exit(code), 20_000);
    hardExit.unref?.();
    (async () => {
      try { await cleanup.stopOnce(why); }
      catch (e) { tag(`teardown error on ${why}: ${String(e).slice(0, 200)}`); }
      try { writeFileSync(resolve(outDir, 'cleanup-receipt.json'),
        JSON.stringify(cleanup.cleanupReceipt({ probe: 'finale-window-probe.mjs', outcomeUnchanged: false }), null, 1)); }
      catch (e) { tag(`receipt write failed: ${String(e).slice(0, 200)}`); }
      try { writeFileSync(resolve(outDir, 'failure.json'),
        JSON.stringify(failureRecord({ probe: 'finale-window-probe.mjs', error: new Error(why), phase: 'cooperative-termination' }), null, 1)); }
      catch { /* receipt above is the binding artefact */ }
      process.exit(code);
    })();
  };
  for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(sig, () => terminate(`signal-${sig}`, 143));

  const url = `${EXPECTED.previewUrl}?story=${EXPECTED.storyFixture}&journeyprobe=1&debug=1&movie=1`;
  let session;
  if (!unmuted) {
    session = cleanup.adopt(await openParavoxia({ url, preview: { url: EXPECTED.previewUrl, stop() {} }, build: false, log: tag }));
  } else {
    // LIVE-OUTPUT variant: the SAME shipped headed route and flags, minus
    // --mute-audio (which would silence the very output we are recording).
    // Nothing else differs; no headless, no SwiftShader, no game change.
    // The run folder is OUTSIDE main/, so no node_modules lookup from here
    // reaches main/node_modules: a bare 'playwright' (which is not even the
    // installed package — evidence.mjs uses 'playwright-core') throws
    // ERR_MODULE_NOT_FOUND. Resolve the same installed package by path.
    const { chromium } = await import(PLAYWRIGHT_CORE_URL);
    const viewport = { width: 1280, height: 720 };
    const args = [...CHROMIUM_ARGS.filter((a) => a !== '--enable-unsafe-swiftshader' && a !== '--mute-audio'),
      '--enable-gpu', '--use-angle=gl', `--window-size=${viewport.width},${viewport.height}`];
    if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) process.env.DISPLAY = ':0';
    // --pulse-sink routes ONLY this child's own streams to the probe-owned
    // null sink (libpulse PULSE_SINK). It changes no server default and moves
    // no other client. Absent => the child uses whatever the shell already had.
    const pulseSink = arg('pulse-sink', null);
    const launchEnv = pulseSink ? { ...process.env, PULSE_SINK: pulseSink } : process.env;
    session = await startUnmutedOwnedSession({
      chromium, cleanup, failureRecord, assertHardwareGl, tag, url, viewport, args, pulseSink,
      launchOptions: { executablePath: chromePath(), headless: false, args, env: launchEnv ?? process.env },
      writeOut: (file, value) => writeFileSync(resolve(outDir, file), JSON.stringify(value, null, 1))
    });
  }
  const { page } = session;

  // ---- FINALE-AUTHORITY-SEAM attachment (added by finale-authority-seam-runtime) ----
  // Non-pausing CDP conditional breakpoints on the corrected authority pins, so
  // module locals (Ka/jZ/WI/na/XF/Gq/fMA/EI) can be read IN their own lexical
  // scope -- a generic page Runtime.evaluate cannot reach them. Read-only:
  // no game setter, no AudioParam wrap, no forced pause flag.
  const seamState = {
    attached: false, sinkInstalled: null, breakpoints: [], attachError: null,
    lastHarvest: null, harvests: 0, harvestErrors: [],
  };
  try {
    const { SINK_SOURCE, LOGPOINTS, EXTRA_PINS, BUNDLE_SHA256, BUNDLE_URL_SUFFIX, KNOWN_UNOBSERVABLE, PERTURBATION_LIMITS }
      = await import('./seamLogpoints.mjs');
    const pinDoc = JSON.parse(readFileSync(resolve(HERE, 'authority-pins-corrected.json'), 'utf8'));
    if (pinDoc.bundleSha256 !== BUNDLE_SHA256) throw new Error('pin/bundle sha mismatch');
    const cdp = await page.context().newCDPSession(page);

    // isolated probe-owned buffer, installed BEFORE the breakpoints exist.
    seamState.sinkInstalled = await page.evaluate(SINK_SOURCE);
    if (!seamState.sinkInstalled || seamState.sinkInstalled.installed !== true) {
      throw new Error(`seam sink not installed: ${JSON.stringify(seamState.sinkInstalled ?? null)}`);
    }
    await cdp.send('Debugger.enable');
    for (const lp of LOGPOINTS) {
      const p = lp.extra ? EXTRA_PINS[lp.pinRef] : pinDoc.pins[lp.pinRef];
      const rec = { id: lp.id, pinRef: lp.pinRef, requested: p ? { line0: p.line0, column0: p.column0 } : null };
      try {
        if (!p) throw new Error(`pin ${lp.pinRef} missing`);
        if (!lp.condition.endsWith(',!1')) throw new Error('condition is pausing');
        if (!lp.condition.includes('try{')) throw new Error('condition not guarded');
        const r = await cdp.send('Debugger.setBreakpointByUrl', {
          lineNumber: p.line0, columnNumber: p.column0,
          urlRegex: BUNDLE_URL_SUFFIX.split('/').pop().replace(/\./g, '\\.'), condition: lp.condition,
        });
        rec.breakpointId = r.breakpointId;
        rec.locations = (r.locations ?? []).map((l) => ({ line: l.lineNumber, column: l.columnNumber }));
        rec.resolved = rec.locations.length > 0;
        rec.exact = rec.resolved && rec.locations.some(
          (l) => l.line === p.line0 && l.column === p.column0);
      } catch (err) { rec.error = String(err).slice(0, 300); rec.resolved = false; }
      seamState.breakpoints.push(rec);
    }
    seamState.attached = seamState.breakpoints.some((b) => b.resolved);
    seamState.notes = { KNOWN_UNOBSERVABLE, PERTURBATION_LIMITS };
    tag(`seam attached: ${seamState.breakpoints.filter((b) => b.resolved).length}/${LOGPOINTS.length} resolved`);
  } catch (err) {
    seamState.attachError = String(err && err.stack ? err.stack : err).slice(0, 800);
    tag(`seam attach FAILED: ${seamState.attachError.slice(0, 200)}`);
  }
  // Harvest through a finally-equivalent: periodic drains plus a synchronous
  // exit hook, so an abort/timeout still yields the partial buffer + drop counts.
  const seamWrite = () => {
    try {
      writeFileSync(resolve(outDir, 'seam-events.json'), JSON.stringify({
        schema: 'paravoxia.verifier.finaleAuthoritySeam.v1',
        scenario: process.env.SEAM_SCENARIO ?? 'normal-expiry',
        attach: seamState, events: seamState.lastHarvest,
      }, null, 1));
    } catch (e) { seamState.harvestErrors.push(String(e).slice(0, 200)); }
  };
  const seamDrain = async () => {
    try {
      seamState.lastHarvest = await page.evaluate('globalThis.__seamProbe?globalThis.__seamProbe.drain():null');
      seamState.harvests += 1; seamWrite();
    } catch (e) { seamState.harvestErrors.push(String(e).slice(0, 200)); }
  };
  // Real-pause scenario: a genuine TRUSTED CLICK on the actual HUD pause
  // button at live token age ~1.2s (well inside the signed five seconds).
  // The prior Escape-only attempt did NOT pause (pointer lock was false), so a
  // keypress is never counted as paused state here. aria-label is "Pause"
  // while story.active and "Pause and open star map" once done; both route
  // through pauseAndOpenStarMap. No game setter, no forced pause flag.
  if ((process.env.SEAM_SCENARIO ?? '') === 'pause-button-cancel') {
    seamState.pause = { armed: true, mode: 'hud-pause-button', pressedAtMono: null,
      tokenStartedAtMs: null, ageAtPressMs: null, button: null, error: null,
      before: null, after: null, afterSettle: null, resumed: null, inconclusive: null };
    // read-only state read: paused UI + owning story/authority state. No writes.
    const READ = `(()=>{try{
      const btn=document.querySelector('[aria-label="Pause and open star map"]')||document.querySelector('[aria-label="Pause"]');
      const lbl=btn?btn.getAttribute('aria-label'):null;
      const txt=(document.body.innerText||'').slice(0,4000);
      const p=globalThis.__seamProbe;
      const ev=p?p.peek?p.peek():null:null;
      return{at:performance.now(),
        pauseButtonPresent:!!btn,pauseButtonLabel:lbl,
        storyBeat:globalThis.__storyBeat??null,
        storyActive:!!(globalThis.__voxelDebug&&globalThis.__voxelDebug.story&&globalThis.__voxelDebug.story.active),
        paused:(globalThis.__voxelDebug&&'paused'in globalThis.__voxelDebug)?!!globalThis.__voxelDebug.paused:null,
        pointerLock:!!document.pointerLockElement,
        starMapVisible:/star map|Star Map|STAR MAP/.test(txt),
        resumeVisible:/\\bResume\\b/.test(txt),
        audioState:(()=>{try{return globalThis.__voxelDebug?.audio?.contextState??null}catch(_){return null}})()
      }}catch(e){return{error:String(e).slice(0,200)}}})()`;
    const poll = setInterval(async () => {
      try {
        const t = await page.evaluate(
          "(()=>{try{const p=globalThis.__seamProbe;if(!p)return null;const e=p.drain().ev.find(x=>x.k==='begin');" +
          "return e?{s:e.mono,now:performance.now()}:null}catch(_){return null}})()");
        if (t && t.now - t.s >= 1200) {
          clearInterval(poll);
          seamState.pause.tokenStartedAtMs = t.s;
          seamState.pause.before = await page.evaluate(READ);
          // locate the ACTUAL HUD pause button and click its real box (trusted)
          const box = await page.evaluate(`(()=>{const b=document.querySelector('[aria-label="Pause and open star map"]')||document.querySelector('[aria-label="Pause"]');
            if(!b)return null;const r=b.getBoundingClientRect();
            return{x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height,label:b.getAttribute('aria-label')}})()`);
          if (!box) { seamState.pause.error = 'no HUD pause button found (aria-label Pause / Pause and open star map)'; seamWrite(); return; }
          seamState.pause.button = box;
          await page.mouse.click(box.x, box.y);      // trusted, not dispatchEvent
          const after = await page.evaluate('performance.now()');
          seamState.pause.pressedAtMono = after;
          seamState.pause.ageAtPressMs = after - t.s;
          seamState.pause.after = await page.evaluate(READ);
          await sleep(600);
          seamState.pause.afterSettle = await page.evaluate(READ);
          const st = seamState.pause.afterSettle || {};
          // Button activation alone is NOT paused state.
          seamState.pause.inconclusive = !(st.paused === true || st.starMapVisible === true || st.resumeVisible === true);
          if (!seamState.pause.inconclusive) {
            const resume = page.getByRole('button', { name: /Resume/ }).first();
            await resume.click({ timeout: 3000 });
            await sleep(600);
            seamState.pause.resumed = await page.evaluate(READ);
            seamState.pause.resumeClicked = true;
            await page.screenshot({ path: resolve(outDir, 'after-real-resume.png') });
          }
          tag(`seam: HUD pause button "${box.label}" clicked at token age ~${Math.round(after - t.s)}ms; ` +
              `paused=${st.paused} starMap=${st.starMapVisible} resume=${st.resumeVisible} inconclusive=${seamState.pause.inconclusive}`);
          seamWrite();
        }
      } catch (e) { seamState.pause.error = String(e).slice(0, 200); }
    }, 100);
    poll.unref?.();
  }
  const seamTimer = setInterval(() => { seamDrain().catch(() => {}); }, 2000);
  seamTimer.unref?.();
  process.on('exit', seamWrite);
  // ---- end finale-authority-seam attachment ----

  let result;
  try {
    result = await cleanup.runGuarded(async () => {
      await waitReady(page, { timeoutMs: 120_000 });
      // TRUSTED USER GESTURE (finale-authority-seam-live-audio): one real
      // Playwright mouse click on the canvas, after world-ready and BEFORE the
      // completion window. This is ordinary trusted input -- no AudioContext
      // monkeypatch, no forced state, no game write. Its only purpose is to
      // grant the user-activation that lets the game's own audio build/run.
      seamState.gesture = { attempted: true, error: null, before: null, after: null, clicked: null };
      try {
        const probeState = `(()=>{try{return{focus:document.hasFocus(),
          pointerLock:!!document.pointerLockElement,
          activationSticky:!!(navigator.userActivation&&navigator.userActivation.hasBeenActive),
          activationTransient:!!(navigator.userActivation&&navigator.userActivation.isActive),
          at:performance.now()}}catch(e){return{error:String(e).slice(0,120)}}})()`;
        seamState.gesture.before = await page.evaluate(probeState);
        await page.bringToFront().catch(() => {});
        const box = await page.evaluate(`(()=>{const c=document.querySelector('canvas');if(!c)return null;
          const r=c.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height}})()`);
        if (!box) throw new Error('no canvas element to click');
        await page.mouse.click(box.x, box.y);   // trusted, not dispatchEvent
        seamState.gesture.clicked = box;
        await sleep(250);
        seamState.gesture.after = await page.evaluate(probeState);
        tag(`seam gesture: click@${Math.round(box.x)},${Math.round(box.y)} focus=${seamState.gesture.after?.focus} lock=${seamState.gesture.after?.pointerLock} activation=${seamState.gesture.after?.activationSticky}`);
      } catch (e) {
        seamState.gesture.error = String(e).slice(0, 300);
        tag(`seam gesture FAILED: ${seamState.gesture.error.slice(0, 160)}`);
      }
      seamWrite();
      // Arm the atomic sampler EARLY, well before completion. From here until
      // the window is sealed this probe issues NO screenshot, so no CDP call
      // can be the reason the completion edge is missed.
      // playwright-core evaluates a STRING pageFunction as an EXPRESSION and
      // ignores the second argument: `(cfg) => {...}` therefore produced a
      // function value (serialised to undefined) and the installer NEVER RAN.
      // Proven in logs/finale-window-fd-runtime/evaluate-semantics-check.mjs.
      // Invoke the expression with the config inlined instead. The installer
      // source itself is unchanged, so its fixtures stay valid.
      const install = await page.evaluate(
        `(${buildInstallerSource()})(${JSON.stringify(windowCfg)})`);
      if (!install || install.installed !== true) {
        throw new Error(`sampler installer did not install: ${JSON.stringify(install ?? null)}`);
      }
      tag(`sampler armed: ${JSON.stringify(install.inventory)}`);
      const baseline = { role: 'pre-window-baseline', at: Date.now(),
        state: await page.evaluate(() => window.__finaleWindowProbe.sampleNow()) };
      await page.screenshot({ path: resolve(outDir, '0000-pre-window-baseline.png') });

      const deadline = Date.now() + seconds * 1000;
      let status = null;
      while (Date.now() < deadline) {
        status = await page.evaluate(() => window.__finaleWindowProbe.status());  // tiny; no buffer transfer
        if (status.sealed) break;
        // Cooperative abort from the owning wrapper: throw INSIDE runGuarded so
        // this probe's own browser is closed by the same guard and a receipt is
        // written. The cue is never replayed or extended to "recover".
        if (existsSync(stopFile)) throw new Error(`stop requested by the control wrapper: ${readFileSync(stopFile, 'utf8').slice(0, 200)}`);
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

// Run ONLY when executed directly. The CPU self-test imports this module to
// exercise startUnmutedOwnedSession() — the actual call site — and importing it
// must never launch a browser or start a measurement.
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((e) => { console.error(`[finale-window] FAILED: ${e.stack ?? e}`); process.exit(1); });
}
