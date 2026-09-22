/**
 * commonPassageLogic.mjs — decision logic for the manual COMMON passage probe.
 *
 * No browser, no GPU, no game import. Everything here is statically self-testable
 * (`node selftest.mjs`) so the harness's lock-ownership, identity, guard, parser,
 * control, arrival, steering and progress rules are exercised without a GPU.
 *
 * TWO SECTIONS ONLY are not pure: `heavyLockOwnership` and `fetchServedIdentity`.
 * Both take every effect they perform as an injected dependency (`deps`), default
 * to the node builtins, and are exercised in the self-tests against a task-private
 * lock file, a task-private child process and a task-private local HTTP fixture.
 * They exist here rather than in the probe entry so the REAL boundary — an
 * externally acquired exclusive flock, and actual served bytes — is testable
 * without launching a browser. Nothing here writes game state.
 *
 * Geometry constants below are COPIES of frozen chapter source read read-only in
 * the immutable pre-repair snapshot
 * `iterations/handoff-standby-findings/source/main/src/story/commonGroundState.ts`
 * (CG_POSES, CG_ROUTE_COMMON, CG_COMMON_ROUTE_UNITS, BODY_BODY_CLEARANCE_UNITS).
 * They are route KNOWLEDGE used to steer ordinary keys, never a grant: the probe
 * writes no pose, no progress and no anchor. Because the waypoints were read from
 * source, this probe can never claim first-time naive usability.
 */
import { statSync, fstatSync, readFileSync as nodeReadFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

// --- frozen chapter geometry (read-only copies) ---------------------------------------
export const CG_POSES = Object.freeze({
  R: Object.freeze({ x: -34, y: 51.05, z: 20 }),
  S: Object.freeze({ x: -26, y: 51.05, z: 12 }),
  E: Object.freeze({ x: -42, y: 51.05, z: 12 }),
  C: Object.freeze({ x: -48, y: 51.05, z: 12 }),
  H: Object.freeze({ x: -40, y: 51.05, z: 12 }),
  W: Object.freeze({ x: -34, y: 51.05, z: 10 }),
  T: Object.freeze({ x: -44, y: 51.05, z: 12 })
});

/** The signed common passage: 18 walked units, E -> C, in this order. */
export const CG_ROUTE_COMMON = Object.freeze([
  [-42, 51.05, 12], [-42, 51.05, 14], [-42, 51.05, 16],
  [-44, 51.05, 16], [-44, 51.05, 18], [-46, 51.05, 18],
  [-48, 51.05, 18], [-48, 51.05, 16], [-48, 51.05, 14],
  [-48, 51.05, 12]
].map((p) => Object.freeze(p)));

/** The authored long survey route (S -> E), used only to earn the survey/common transition. */
export const CG_ROUTE_LONG = Object.freeze([
  [-26, 51.05, 14], [-28, 51.05, 14], [-28, 51.05, 16], [-30, 51.05, 16],
  [-30, 51.05, 18], [-32, 51.05, 18], [-32, 51.05, 20], [-32, 51.05, 22],
  [-34, 51.05, 22], [-36, 51.05, 22], [-38, 51.05, 22], [-40, 51.05, 22],
  [-42, 51.05, 22], [-42, 51.05, 20], [-42, 51.05, 18], [-42, 51.05, 16],
  [-42, 51.05, 14], [-42, 51.05, 12]
].map((p) => Object.freeze(p)));

export const CG_COMMON_ROUTE_UNITS = 18;
/** `bodiesClear` in commonGroundRoute.ts: XZ separation >= 1 unit. */
export const BODY_BODY_CLEARANCE_UNITS = 1;
export const OCCUPANCY_RADIUS_UNITS = 1.25;
/** `routeProgressUnits` corridorRadius — a body outside it earns nothing. */
export const CG_CORRIDOR_RADIUS_UNITS = 2.5;
/** `CG_POINT_REACH` in commonGroundDirector.ts: the authored [F] reach at a point. */
export const CG_POINT_REACH_UNITS = 2;

/**
 * The exact authored objective id and prompt verb for every [F] this probe may
 * press, quoted from the immutable snapshot
 * `.../source/main/src/story/beats/objectivePrimitives.ts` (objective work orders)
 * and `.../commonGroundDirector.ts` (interaction verbs). A press whose live
 * objective id or live primary prompt does not match STOPS the probe.
 */
export const CG_F_CONTRACT = Object.freeze({
  'W-offer-route': Object.freeze({ objectiveId: 'ch13:survey:offer', verb: /Offer to demonstrate a route/i }),
  'S-begin-recording': Object.freeze({ objectiveId: 'ch13:survey:start', verb: /Begin recording your route/i }),
  'E-offer-span': Object.freeze({ objectiveId: 'ch13:survey:offer-span', verb: /Offer the walked span/i }),
  'witness-hold-this-end': Object.freeze({ objectiveId: 'ch13:survey:witness', verb: /Offer this end/i }),
  'T-offer-final-reference': Object.freeze({ objectiveId: 'ch13:common:offer-final-reference', verb: /Offer this end/i })
});

/**
 * The recorded early-turn deviation: turn 0.18 units BEFORE the z=16 corner, i.e.
 * at z 15.82 on the second segment (producer-manual-corner-risk.json /
 * commonGroundRoute.ts frontier-rule comment). This is the COMMON corner case and
 * is strictly distinct from the earlier free survey drawing loop.
 */
export const EARLY_TURN_POINT = Object.freeze([-42, 51.05, 15.82]);
export const EARLY_TURN_SEGMENT_INDEX = 2; // route vertex it turns short of

// --- small vector helpers --------------------------------------------------------------
export const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
export const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const unit2 = (v) => { const m = Math.hypot(v[0], v[1]); return m < 1e-9 ? null : [v[0] / m, v[1] / m]; };

export function splitByUp(from, to, up) {
  const m0 = Math.hypot(up[0], up[1], up[2]);
  const u = m0 < 1e-9 ? [0, 1, 0] : [up[0] / m0, up[1] / m0, up[2] / m0];
  const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  const v = dot3(d, u);
  const h = [d[0] - v * u[0], d[1] - v * u[1], d[2] - v * u[2]];
  const hMag = Math.hypot(h[0], h[1], h[2]);
  return { vertical: v, horizontal: hMag, hUnit: hMag < 1e-9 ? null : [h[0] / hMag, h[1] / hMag, h[2] / hMag] };
}

/** A body vector must be finite, three-component and NOT the uninitialised origin. */
export function bodyUsable(p) {
  if (!Array.isArray(p) || p.length !== 3) return { ok: false, why: 'not-a-3-vector' };
  if (!p.every((n) => Number.isFinite(n))) return { ok: false, why: 'non-finite' };
  if (Math.hypot(p[0], p[1], p[2]) < 1e-6) return { ok: false, why: 'uninitialised-origin-000' };
  return { ok: true, why: null };
}

/** Settled = a finite tail of samples whose mutual spread is under eps. */
export function settled(samples, { n = 8, eps = 0.02 } = {}) {
  if (samples.length < n) return { ok: false, why: `only ${samples.length} samples`, spread: null };
  const tail = samples.slice(-n);
  let spread = 0;
  for (let i = 0; i < tail.length; i += 1) {
    for (let j = i + 1; j < tail.length; j += 1) spread = Math.max(spread, dist3(tail[i], tail[j]));
  }
  return { ok: spread <= eps, why: spread <= eps ? null : `spread ${spread.toFixed(4)} > ${eps}`, spread };
}

export function directionsDistinct(aUnit, bUnit, minDeg = 25) {
  if (!aUnit || !bUnit) return { ok: false, deg: null, why: 'a held key produced no horizontal direction' };
  const c = Math.max(-1, Math.min(1, dot3(aUnit, bUnit)));
  const deg = (Math.acos(c) * 180) / Math.PI;
  return { ok: deg >= minDeg, deg, why: deg >= minDeg ? null : `only ${deg.toFixed(1)}deg apart` };
}

/** Pick the calibrated key whose MEASURED world direction best matches `want`. */
export function chooseKey(dirs, want) {
  let best = null; let bestDot = -Infinity;
  for (const [k, d] of Object.entries(dirs)) {
    if (!d) continue;
    const s = d[0] * want[0] + d[1] * want[1];
    if (s > bestDot) { bestDot = s; best = k; }
  }
  return { key: best, score: bestDot };
}

/**
 * A key hold is a real INPUT RECEIPT only when the body moved horizontally with a
 * direction. Spawn settling (vertical-only drift) is not motion.
 */
export function keyReceipt({ from, to, up = [0, 1, 0], minHorizontal = 0.4 }) {
  const ub = bodyUsable(from); const ua = bodyUsable(to);
  if (!ub.ok || !ua.ok) return { ok: false, why: `unusable body (${ub.why ?? ua.why})`, horizontal: null, dir2: null };
  const sp = splitByUp(from, to, up);
  const dir2 = unit2([to[0] - from[0], to[2] - from[2]]);
  if (!(sp.horizontal >= minHorizontal)) {
    return { ok: false, why: `horizontal ${sp.horizontal.toFixed(3)} < ${minHorizontal} (vertical ${sp.vertical.toFixed(3)}) — settling, not motion`, horizontal: sp.horizontal, vertical: sp.vertical, dir2 };
  }
  if (!dir2) return { ok: false, why: 'no horizontal direction', horizontal: sp.horizontal, vertical: sp.vertical, dir2 };
  return { ok: true, why: null, horizontal: sp.horizontal, vertical: sp.vertical, dir2 };
}

// --- REAL exclusive-lock ownership -------------------------------------------------------
//
// A FILE IS NOT A LOCK. `existsSync(path)` proves only that somebody once created a
// path; an environment boolean proves nothing at all; and `flock -n` FAILING proves
// only that SOMEBODY ELSE holds the lock, which is the opposite of ownership.
//
// The receipt required here is:
//   1. an inherited file descriptor number (`--heavy-lock-fd`), which only a parent
//      that opened the lock file can hand down;
//   2. `fstat(fd)` and `stat(lockPath)` agreeing on device+inode, so the descriptor
//      really is that lock file;
//   3. an FLOCK ADVISORY WRITE entry for that inode in /proc/locks — a live kernel
//      exclusive lock, not a file and not a claim;
//   4. that entry's holder pid being this process or one of its ANCESTORS, so the
//      lock is held by us or by the shell that spawned us and still holds it open;
//   5. corroboration that a fresh independent `flock -n -x` on the same path is
//      REFUSED, i.e. the lock is live right now.
// Check 5 alone is deliberately insufficient (it is the "somebody else holds it"
// signal); checks 3+4 are what make it ownership. Check 5 is skipped by default on
// the shared lock during preparation and is only run when `probeContention` is set.
const LOCK_DEFAULT_DEPS = Object.freeze({
  statSync,
  fstatSync,
  readFileSync: nodeReadFileSync,
  execFileSync,
  pid: () => process.pid
});

/** Linux dev_t split, so a /proc/locks MAJOR:MINOR can be compared with fstat().dev. */
export function devMajorMinor(dev) {
  const major = Math.floor(dev / 256) & 0xfff;
  const minor = (dev % 256) | (Math.floor(dev / 4096) & ~0xff);
  return { major, minor };
}

/** Parse /proc/locks into records. Unparseable lines are dropped, never guessed. */
export function parseProcLocks(text) {
  const out = [];
  for (const raw of String(text ?? '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.replace(/^\d+:\s*/, '').split(/\s+/);
    if (parts.length < 5) continue;
    const [kind, scope, mode, pidStr, where] = parts;
    const m = /^([0-9a-f]+):([0-9a-f]+):(\d+)$/i.exec(where ?? '');
    if (!m) continue;
    out.push({
      kind, scope, mode, pid: Number(pidStr),
      major: parseInt(m[1], 16), minor: parseInt(m[2], 16), inode: Number(m[3])
    });
  }
  return out;
}

/** The pid chain from `pid` up to init, read from /proc/<pid>/status PPid. */
export function ancestorPids(pid, readFileSync = nodeReadFileSync, limit = 64) {
  const chain = [];
  let cur = pid;
  for (let i = 0; i < limit && Number.isInteger(cur) && cur > 0; i += 1) {
    chain.push(cur);
    let ppid = null;
    try {
      const status = String(readFileSync(`/proc/${cur}/status`, 'utf8'));
      const m = /^PPid:\s*(\d+)$/m.exec(status);
      ppid = m ? Number(m[1]) : null;
    } catch { ppid = null; }
    if (ppid === null || ppid === cur || ppid === 0) break;
    cur = ppid;
  }
  return chain;
}

/**
 * Verify that an EXCLUSIVE flock on `lockPath` is held through an inherited
 * descriptor. Returns a receipt; `owned` is true only when every check passed.
 */
export function heavyLockOwnership({
  lockPath = null, fd = null, probeContention = false, deps = {}
} = {}) {
  const d = { ...LOCK_DEFAULT_DEPS, ...deps };
  const problems = [];
  const receipt = {
    lockPath, fd, owned: false, problems,
    fdDevIno: null, pathDevIno: null, procLock: null, ancestors: null,
    contentionProbe: probeContention ? null : 'not-run (shared lock is never contended during preparation)'
  };
  if (!lockPath) { problems.push('--heavy-lock <path> is required'); return receipt; }
  if (!Number.isInteger(fd) || fd < 0) {
    problems.push('--heavy-lock-fd <n> is required: an inherited descriptor for an ALREADY-acquired exclusive flock');
    return receipt;
  }
  let fst = null; let pst = null;
  try { fst = d.fstatSync(fd); } catch (e) { problems.push(`fstat(${fd}) failed: ${String(e).slice(0, 120)} — no descriptor was inherited`); }
  try { pst = d.statSync(lockPath); } catch (e) { problems.push(`stat(${lockPath}) failed: ${String(e).slice(0, 120)}`); }
  if (!fst || !pst) return receipt;
  receipt.fdDevIno = { dev: fst.dev, ino: fst.ino };
  receipt.pathDevIno = { dev: pst.dev, ino: pst.ino };
  if (fst.dev !== pst.dev || fst.ino !== pst.ino) {
    problems.push(`inherited fd ${fd} is dev ${fst.dev} ino ${fst.ino}, not ${lockPath} (dev ${pst.dev} ino ${pst.ino})`);
    return receipt;
  }
  let locks = [];
  try { locks = parseProcLocks(d.readFileSync('/proc/locks', 'utf8')); }
  catch (e) { problems.push(`/proc/locks unreadable: ${String(e).slice(0, 120)} — lock ownership is UNMEASURABLE here`); return receipt; }
  const { major, minor } = devMajorMinor(pst.dev);
  const mine = locks.filter((l) => l.inode === pst.ino && l.major === major && l.minor === minor);
  const exclusive = mine.filter((l) => /FLOCK/i.test(l.kind) && /WRITE/i.test(l.mode));
  if (exclusive.length === 0) {
    problems.push(`no FLOCK WRITE entry in /proc/locks for ${lockPath} (inode ${pst.ino}): the file exists but NO exclusive lock is held`);
    return receipt;
  }
  const chain = ancestorPids(d.pid(), d.readFileSync);
  receipt.ancestors = chain;
  const held = exclusive.find((l) => chain.includes(l.pid)) ?? null;
  receipt.procLock = held ?? exclusive[0];
  if (!held) {
    problems.push(`the exclusive flock on ${lockPath} is held by pid ${exclusive.map((l) => l.pid).join(',')}, which is NOT this process or any ancestor — somebody else's lock is not our ownership`);
    return receipt;
  }
  if (probeContention) {
    let refused = null;
    try { d.execFileSync('flock', ['-n', '-x', lockPath, '-c', 'true'], { stdio: 'ignore' }); refused = false; }
    catch { refused = true; }
    receipt.contentionProbe = refused ? 'refused (lock is live)' : 'acquired (lock was NOT live)';
    if (!refused) { problems.push('an independent flock -n -x acquired the lock, so no live exclusive lock was held'); return receipt; }
  }
  receipt.owned = true;
  return receipt;
}

// --- served-build identity ----------------------------------------------------------------
export const sha256Hex = (bytes) => createHash('sha256').update(bytes).digest('hex');

/**
 * Fetch the ACTUAL served index and the ACTUAL served bundle and hash the bytes.
 * `fetchImpl` is injected so the self-tests can point it at a task-private HTTP
 * fixture. A failed fetch is recorded as an error, never as a match.
 */
export async function fetchServedIdentity({ url, bundlePath = null, fetchImpl = fetch, timeoutMs = 20000 } = {}) {
  const out = { url, bundlePath, indexSha256: null, bundleSha256: null, errors: [], status: {} };
  const get = async (target, key) => {
    try {
      const res = await fetchImpl(target, { signal: AbortSignal.timeout(timeoutMs) });
      out.status[key] = res.status;
      if (!res.ok) { out.errors.push(`${key} ${target} -> HTTP ${res.status}`); return null; }
      const buf = Buffer.from(await res.arrayBuffer());
      return sha256Hex(buf);
    } catch (e) { out.errors.push(`${key} ${target} -> ${String(e).slice(0, 160)}`); return null; }
  };
  out.indexSha256 = await get(url, 'index');
  if (bundlePath) out.bundleSha256 = await get(new URL(bundlePath, url).toString(), 'bundle');
  return out;
}

/**
 * Bind the served bytes to root's published preview ownership BEFORE any browser
 * exists. Title and ANGLE are checked later and are NOT current-build identity: a
 * previous build of the same app serves the same title on the same GPU.
 */
export function previewBindingDecision({
  ownership = null, url = null, expectSourceManifestSha = null,
  served = null, requireBundle = true
} = {}) {
  const problems = [];
  if (!ownership) problems.push('verifier/artifacts/preview-ownership.json is missing: no root preview-ownership source binding');
  if (!url) problems.push('--url is required');
  if (ownership) {
    if (ownership.state !== 'running') problems.push(`preview ownership state=${JSON.stringify(ownership.state ?? null)}, not "running"`);
    if (!ownership.indexSha256) problems.push('preview ownership publishes no indexSha256: the expected index hash is UNAVAILABLE, so identity cannot be required');
    if (requireBundle && !ownership.bundleSha256) problems.push('preview ownership publishes no bundleSha256');
    if (requireBundle && !ownership.bundlePath) problems.push('preview ownership publishes no bundlePath');
    if (url && ownership.url && String(ownership.url).replace(/\/$/, '') !== String(url).replace(/\/$/, '')) {
      problems.push(`--url ${url} is not the root-owned preview url ${ownership.url}`);
    }
    if (!expectSourceManifestSha) problems.push('--expect-source-manifest is required to bind the preview to root-published source');
    else if (ownership.sourceManifestSha256 !== expectSourceManifestSha) {
      problems.push(`preview ownership sourceManifestSha256 ${ownership.sourceManifestSha256} != expected ${expectSourceManifestSha}`);
    }
  }
  if (!served) problems.push('served bytes were never fetched: liveness/title is not current-build identity');
  else {
    if (served.errors?.length) problems.push(...served.errors.map((e) => `served fetch error: ${e}`));
    if (!served.indexSha256) problems.push('served index sha is null: an expected hash is required, so this MUST fail');
    else if (ownership?.indexSha256 && served.indexSha256 !== ownership.indexSha256) {
      problems.push(`served index sha ${served.indexSha256} != owned ${ownership.indexSha256}`);
    }
    if (requireBundle) {
      if (!served.bundleSha256) problems.push('served bundle sha is null: the relevant bundle bytes were not measured');
      else if (ownership?.bundleSha256 && served.bundleSha256 !== ownership.bundleSha256) {
        problems.push(`served bundle sha ${served.bundleSha256} != owned ${ownership.bundleSha256}`);
      }
    }
  }
  return {
    ok: problems.length === 0,
    problems,
    expectedIndexSha256: ownership?.indexSha256 ?? null,
    expectedBundleSha256: ownership?.bundleSha256 ?? null,
    servedIndexSha256: served?.indexSha256 ?? null,
    servedBundleSha256: served?.bundleSha256 ?? null,
    ownedFileMapCount: ownership?.allBuildFilesMatched ?? null,
    note: 'preview-ownership.json publishes index+bundle byte hashes and a matched-file COUNT; the remaining build files are unmeasured here.'
  };
}

// --- preflight guard --------------------------------------------------------------------
/**
 * Decide whether a browser may be launched AT ALL. Refuses on unreadiness, on a
 * verifier control hold, on a missing/foreign URL, on anything short of a proven
 * externally acquired exclusive lock, on an unbound source manifest and on an
 * unbound served build. Pure: callers pass the loaded files and the receipts.
 */
export function preflightDecision({
  ready = null, control = null, url = null, out = null,
  heavyLock = null, expectSourceManifestSha = null, liveSourceManifestSha = null,
  previewBinding = null, role = 'common-manual-focused'
} = {}) {
  const refusals = [];
  if (!ready || ready.ready !== true) refusals.push(`verification-ready.json ready=${ready ? String(ready.ready) : 'missing'}`);
  if (!control) refusals.push('verifier-control.json missing');
  else {
    if (control.action === 'hold') refusals.push(`verifier control action=hold (${String(control.instruction ?? '').slice(0, 120)})`);
    if (control.activeRole && control.activeRole !== role) refusals.push(`verifier control activeRole=${control.activeRole}, not ${role}`);
  }
  if (!url) refusals.push('--url is required (root-published canonical URL); no hardcoded port default exists');
  else if (!/^https?:\/\//.test(url)) refusals.push(`--url ${url} is not an http(s) URL`);
  if (!out) refusals.push('--out is required (unique run-local capture folder)');
  if (!heavyLock || heavyLock.owned !== true) {
    const why = (heavyLock?.problems ?? ['no lock receipt was produced']).join('; ');
    refusals.push(`exclusive shared heavy lock is not PROVABLY held by this process tree: ${why}`);
  }
  if (!expectSourceManifestSha) refusals.push('--expect-source-manifest is required and must be the NEW root-published manifest sha256');
  else if (liveSourceManifestSha && liveSourceManifestSha !== expectSourceManifestSha) {
    refusals.push(`source manifest sha mismatch: expected ${expectSourceManifestSha}, live ${liveSourceManifestSha}`);
  }
  if (!previewBinding || previewBinding.ok !== true) {
    const why = (previewBinding?.problems ?? ['served bytes were never bound to root preview ownership']).join('; ');
    refusals.push(`served build is not bound to root preview ownership: ${why}`);
  }
  return { launch: refusals.length === 0, refusals };
}

/**
 * Browser identity: liveness is not identity (CLAUDE.md, port-takeover incident),
 * and title+ANGLE is not CURRENT-BUILD identity either. When an expected index
 * hash is required, a null measured hash MUST fail.
 */
export function identityVerdict({
  title = null, renderer = null, headed = null,
  indexSha = null, expectIndexSha = null, requireIndexSha = true
}) {
  const problems = [];
  if (title !== 'Paravoxia') problems.push(`document.title=${JSON.stringify(title)} is not "Paravoxia"`);
  if (!renderer || !/ANGLE/i.test(renderer)) problems.push(`renderer ${JSON.stringify(renderer)} is not hardware ANGLE`);
  if (/SwiftShader|llvmpipe/i.test(String(renderer))) problems.push('software renderer');
  if (headed !== true) problems.push('session is not headed');
  if (requireIndexSha) {
    if (!expectIndexSha) problems.push('no expected index sha was supplied, so current-build identity is unmeasured');
    if (!indexSha) problems.push('measured index sha is null while an expected hash is required');
  }
  if (expectIndexSha && indexSha && indexSha !== expectIndexSha) problems.push(`index sha ${indexSha} != expected ${expectIndexSha}`);
  return { ok: problems.length === 0, problems };
}

// --- prompt / objective gates ------------------------------------------------------------
/** True only when a shipped primary prompt literally offers [F] with the wanted verb. */
export function promptOffersF(prompts, verbPattern = null) {
  const list = Array.isArray(prompts) ? prompts.filter((p) => typeof p === 'string') : [];
  const withF = list.filter((p) => /\[?\bF\b\]?/.test(p));
  if (withF.length === 0) return { ok: false, why: 'no primary prompt mentions F', matched: null, prompts: list };
  if (!verbPattern) return { ok: true, why: null, matched: withF[0], prompts: list };
  const hit = withF.find((p) => verbPattern.test(p)) ?? null;
  return { ok: !!hit, why: hit ? null : `no F prompt matched ${verbPattern}`, matched: hit, prompts: list };
}

/**
 * F is permitted only when the CURRENT objective is EXACTLY the expected authored
 * one AND the live prompt offers F with the authored verb. An absent expectation
 * is itself a refusal: "any prompt" is not an authored offer.
 */
export function mayPressF({ objectiveId = null, expectedObjectiveId = null, prompts = null, verbPattern = null }) {
  if (!expectedObjectiveId) return { ok: false, why: 'no expected objective id supplied — an any-prompt press is not an authored offer', prompt: null };
  if (!verbPattern) return { ok: false, why: 'no expected prompt verb supplied — an any-prompt press is not an authored offer', prompt: null };
  const p = promptOffersF(prompts, verbPattern);
  if (objectiveId !== expectedObjectiveId) {
    return { ok: false, why: `objective is ${JSON.stringify(objectiveId)}, expected ${expectedObjectiveId}`, prompt: p.matched };
  }
  if (!p.ok) return { ok: false, why: p.why, prompt: null };
  return { ok: true, why: null, prompt: p.matched };
}

// --- fine steering -------------------------------------------------------------------------
//
// MEASURED, from `manual-focused-report.md`: KeyW held 1.5 s moved 7.722 units
// (~5.15 u/s) and coasted 0.053 units after key-up. A fixed 120 ms minimum tap is
// therefore ~0.62 units — coarser than the arrival radii this route needs, so the
// old loop could ping-pong across a 0.6 unit radius while `stallMs` reset on every
// oversized step and burn the whole 90 s leg budget doing it.
/**
 * Plan the next key pulse from ACTUAL measured motion. `unitsPerMs` and
 * `deadTimeMs` come from a live calibration; `coastUnits` is the measured
 * post-release drift that must be subtracted from the commanded distance.
 */
export function planPulseMs({
  distance, arrive = 0.6, unitsPerMs = null, coastUnits = 0,
  minMs = 45, maxMs = 400, deadTimeMs = 0
} = {}) {
  if (!Number.isFinite(distance) || !Number.isFinite(unitsPerMs) || !(unitsPerMs > 0)) {
    return { ms: null, why: 'unavailable calibration — no pulse may be planned' };
  }
  // Aim at the centre of the arrival radius, never past the target, minus coast.
  const want = Math.max(0, distance - Math.max(0, arrive) * 0.5 - Math.max(0, coastUnits));
  const raw = deadTimeMs + want / unitsPerMs;
  const ms = Math.max(minMs, Math.min(maxMs, Math.round(raw)));
  return { ms, why: null, commandedUnits: want, clamped: raw < minMs ? 'min' : raw > maxMs ? 'max' : null };
}

/**
 * Detect an oscillation: repeated pulses that stop closing the distance, or an
 * approach direction that keeps flipping inside a narrow band. Returns a verdict
 * so the caller STOPS honestly instead of spending the whole leg budget in it.
 */
export function detectOscillation(distances, { window = 6, improveEps = 0.05, flips = 4 } = {}) {
  const d = distances.filter((n) => Number.isFinite(n));
  if (d.length < window) return { oscillating: false, why: `only ${d.length} samples`, flips: null, improvement: null };
  const tail = d.slice(-window);
  const improvement = tail[0] - Math.min(...tail);
  let flipCount = 0;
  for (let i = 2; i < tail.length; i += 1) {
    const a = Math.sign(tail[i - 1] - tail[i - 2]);
    const b = Math.sign(tail[i] - tail[i - 1]);
    if (a !== 0 && b !== 0 && a !== b) flipCount += 1;
  }
  const oscillating = improvement <= improveEps && flipCount >= flips;
  return {
    oscillating, flips: flipCount, improvement,
    why: oscillating ? `distance improved ${improvement.toFixed(3)} over ${window} pulses with ${flipCount} direction flips` : null
  };
}

// --- arrival / walk verdicts ---------------------------------------------------------------
/**
 * A leg NEVER reports arrival on a timeout, a stall or an oscillation. `reached` is
 * true only when a measured distance is inside `arrive` while the budget still ran.
 *
 * The scripted arrival radius is a STEERING tolerance for this harness only. It is
 * not, and can never become, the chapter's proof: the signed ordered eighteen-unit
 * passage is asserted from the game's own credited `terraUnits`.
 */
export function legVerdict({
  label, target, arrive, distance, elapsedMs, budgetMs, stalledMs,
  stallLimitMs = 7000, travelled = 0, oscillating = false
}) {
  const timedOut = elapsedMs >= budgetMs;
  const stalled = stalledMs >= stallLimitMs;
  const reached = Number.isFinite(distance) && distance <= arrive && !timedOut && !stalled && oscillating !== true;
  return {
    label, target, arrive, distance, elapsedMs, travelled,
    reached,
    status: reached ? 'reached' : oscillating === true ? 'oscillating' : stalled ? 'stalled' : timedOut ? 'timeout' : 'not-reached',
    // Explicitly never the word "arrived" unless reached is true.
    fatal: !reached
  };
}

/** Monotone credited-progress tracker: detects loss of earned prefix and stalls. */
export function makeProgressTracker({ name = 'terraUnits', epsilon = 1e-6 } = {}) {
  const samples = [];
  let max = 0; let minAfterMax = Infinity; let dropped = null;
  return {
    push(units, meta = {}) {
      const u = Number.isFinite(units) ? units : null;
      samples.push({ units: u, ...meta });
      if (u === null) return { units: null, max, dropped };
      if (u + epsilon < max) { minAfterMax = Math.min(minAfterMax, u); dropped = dropped ?? { from: max, to: u, at: samples.length - 1 }; }
      if (u > max) max = u;
      return { units: u, max, dropped };
    },
    get name() { return name; },
    get samples() { return samples; },
    get max() { return max; },
    get last() { return samples.length ? samples[samples.length - 1].units : null; },
    get prefixRetained() { return dropped === null; },
    get drop() { return dropped; },
    stalledOver(nSamples, tol = epsilon) {
      if (samples.length < nSamples) return false;
      const tail = samples.slice(-nSamples).map((s) => s.units).filter((u) => u !== null);
      if (tail.length < 2) return false;
      return Math.max(...tail) - Math.min(...tail) <= tol;
    }
  };
}

/**
 * The full physical assertion for the eighteen-unit passage. Body at the endpoint is
 * NOT sufficient: credited units, physical arrival, live support and a live reference
 * (evidenced by credit actually accruing while walking) must all hold.
 */
export function passageVerdict({
  creditedUnits = null, requiredUnits = CG_COMMON_ROUTE_UNITS, arrivalDistance = null, arriveRadius = 1.0,
  supported = null, referenceObserved = null, orderedLegsAllReached = null, clearanceUnits = null,
  extraFPresses = 0, resetsObserved = 0, epsilon = 1e-6
} = {}) {
  const checks = {
    fullEighteenCredited: Number.isFinite(creditedUnits) && creditedUnits + epsilon >= requiredUnits,
    physicalArrivalAtC: Number.isFinite(arrivalDistance) && arrivalDistance <= arriveRadius,
    liveSupportAtArrival: supported === true,
    referenceHeldDuringPassage: referenceObserved === true,
    orderedRouteLegsAllReached: orderedLegsAllReached === true,
    bodyClearanceMaintained: Number.isFinite(clearanceUnits) && clearanceUnits >= BODY_BODY_CLEARANCE_UNITS,
    noExtraFOrReset: extraFPresses === 0 && resetsObserved === 0
  };
  const failed = Object.entries(checks).filter(([, v]) => v !== true).map(([k]) => k);
  const unknown = [creditedUnits, arrivalDistance, supported, referenceObserved, orderedLegsAllReached, clearanceUnits]
    .some((v) => v === null || v === undefined);
  return {
    checks,
    failed,
    ok: failed.length === 0,
    verdict: failed.length === 0 ? 'FULL-EIGHTEEN-UNIT-PASSAGE-OBSERVED'
      : unknown ? 'INCONCLUSIVE-UNAVAILABLE-FIELD' : 'PASSAGE-NOT-PROVED'
  };
}

/**
 * Classify the early-corner recovery attempt. Recovery counts ONLY when the body
 * physically returned to the unfinished frontier and re-traversed the omitted
 * ground; endpoint pumping and far-end looping must not close it.
 */
export function recoveryVerdict({
  creditedAtDeviation = null, creditedAfterFarExcursion = null, creditedFinal = null,
  returnedToFrontier = null, omittedGroundTraversed = null, prefixRetained = null,
  extraFPresses = 0, resetsObserved = 0, requiredUnits = CG_COMMON_ROUTE_UNITS, epsilon = 1e-6
} = {}) {
  if ([creditedAtDeviation, creditedAfterFarExcursion, creditedFinal, returnedToFrontier, omittedGroundTraversed, prefixRetained]
    .some((v) => v === null || v === undefined)) {
    return { verdict: 'INCONCLUSIVE-UNAVAILABLE-FIELD', checks: null, failed: ['unavailable-field'] };
  }
  const checks = {
    earlyTurnActuallyStalledCredit: creditedAfterFarExcursion + epsilon < requiredUnits,
    farExcursionBoughtNothing: creditedAfterFarExcursion <= creditedAtDeviation + 0.6 + epsilon,
    returnedToFrontierByOrdinaryMovement: returnedToFrontier === true,
    omittedGroundActuallyTraversed: omittedGroundTraversed === true,
    earnedPrefixRetained: prefixRetained === true,
    fullEighteenAfterRecovery: creditedFinal + epsilon >= requiredUnits,
    noExtraFNoReset: extraFPresses === 0 && resetsObserved === 0
  };
  const failed = Object.entries(checks).filter(([, v]) => v !== true).map(([k]) => k);
  return {
    checks, failed,
    verdict: failed.length === 0 ? 'EARLY-CORNER-RECOVERY-EARNED-THROUGH-OMITTED-GROUND'
      : checks.earlyTurnActuallyStalledCredit === false ? 'NO-STALL-OBSERVED-CASE-NOT-EXERCISED'
        : failed.includes('fullEighteenAfterRecovery') ? 'RECOVERY-FAILED-CREDIT-NOT-RESTORED'
          : 'RECOVERY-CLAIM-UNSOUND'
  };
}

// --- clearance and standing-clear choice ---------------------------------------------------
/**
 * Body-to-body clearance actually measured between two live positions.
 *
 * The game's own predicate (`bodiesClear`, commonGroundRoute.ts) is an XZ
 * separation, so `ok` follows XZ. The 3D distance is reported alongside because
 * the two differ on a curved surface and conflating them would overstate clearance.
 */
export function clearanceBetween(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return null;
  const xz = distXZ(a, b);
  return { units: xz, unitsXZ: xz, units3d: dist3(a, b), ok: xz >= BODY_BODY_CLEARANCE_UNITS };
}

/** Smallest XZ distance from a point to any recorded sample, and where it occurred. */
export function minClearanceToSpan(point, samples) {
  if (!Array.isArray(point) || !Array.isArray(samples) || samples.length === 0) {
    return { units: null, index: null, ok: null, why: 'no recorded span samples — clearance is UNMEASURED' };
  }
  let best = Infinity; let idx = null;
  samples.forEach((s, i) => {
    if (!Array.isArray(s) || s.length !== 3) return;
    const d = distXZ(point, s);
    if (d < best) { best = d; idx = i; }
  });
  if (!Number.isFinite(best)) return { units: null, index: null, ok: null, why: 'no usable samples' };
  return { units: best, index: idx, ok: best >= BODY_BODY_CLEARANCE_UNITS, why: null };
}

/**
 * Choose where to stand while W-7744 tests the offered span.
 *
 * Standing at E after offering can BLOCK him: `standingOnHisTest` in the director
 * holds his leg on any offered sample ahead of his tested prefix that is within
 * one XZ unit of her body, and a clean long route may raise no witness hold at all,
 * so waiting there can deadlock the run against itself.
 *
 * A candidate is admissible only when it is (a) an AUTHORED pose, (b) OBSERVED
 * reachable by ordinary movement on this build, and (c) actually clear of the
 * whole recorded span by the game's own clearance rule with a margin. An
 * arithmetic label like "E.z - 3" is refused on provenance, not on arithmetic:
 * it was rejected as an unobserved water goal, and a point on the long route is
 * refused because standing on his test is the deadlock itself.
 */
export function standClearChoice({
  candidates = [], recordedSpan = [], observedReachable = [], margin = 0.5
} = {}) {
  const considered = [];
  for (const c of candidates) {
    const name = c.name ?? 'unnamed';
    const point = c.point ?? null;
    if (!Array.isArray(point) || point.length !== 3) { considered.push({ name, admissible: false, why: 'not-a-3-vector' }); continue; }
    if (c.authored !== true) { considered.push({ name, admissible: false, why: 'not-an-authored-pose' }); continue; }
    if (!observedReachable.includes(name)) {
      considered.push({ name, admissible: false, why: 'not-observed-reachable-on-this-build (an arithmetic target is not an observation)' });
      continue;
    }
    const clear = minClearanceToSpan(point, recordedSpan);
    if (clear.units === null) { considered.push({ name, admissible: false, why: clear.why, clearance: null }); continue; }
    if (clear.units < BODY_BODY_CLEARANCE_UNITS + margin) {
      considered.push({ name, admissible: false, why: `on-or-beside-the-recorded-span (${clear.units.toFixed(2)}u < ${BODY_BODY_CLEARANCE_UNITS + margin}u)`, clearance: clear.units });
      continue;
    }
    considered.push({ name, admissible: true, why: null, clearance: clear.units, point });
  }
  const chosen = considered.find((c) => c.admissible) ?? null;
  return { chosen, considered };
}

/** Split a probe snapshot into the two distinct coordinate spaces. */
export function poseReading(snap) {
  if (!snap) return { bodyCentre: null, bodyPose: null, groundOffsetUnits: null, supported: null, available: false };
  return {
    bodyCentre: snap.bodyCentre ?? null,
    bodyPose: snap.bodyPose ?? null,
    groundOffsetUnits: snap.groundOffsetUnits ?? null,
    supported: typeof snap.supported === 'boolean' ? snap.supported : null,
    available: Array.isArray(snap.bodyPose)
  };
}

/** Any unknown runtime field becomes "unavailable", never a fabricated value. */
export const orUnavailable = (v) => (v === undefined || v === null ? 'unavailable' : v);
