#!/usr/bin/env node
/**
 * FINALE-WINDOW RUNTIME WRAPPER — run-local, owned by the finale-window lane of
 * 2026-09-05-after-the-hearth. PREPARED HERE, NOT RUN HERE (no sink, no browser
 * and no recorder is created during preparation; the closure checks exercise
 * these branches with stubs and with one REAL cpu-only node child).
 *
 * IT IS THE CONTROL ROLE for ONE combined unmuted capture: it owns the audio
 * sink and the recorder; the probe (finale-window-probe.mjs) owns the browser
 * and the atomic state window. One run produces BOTH the atomic-state evidence
 * and the actual output recording; there is no second state-only capture.
 *
 * ACTUAL ORDER (this is what the code below does, in this order):
 *   1. validate the INHERITED exclusive heavy-lock fd (never acquire one here)
 *   2. read the server default sink (never set it)
 *   3. load ONE run-owned null sink and resolve its EXACT NUMERIC index from
 *      `pactl list short sinks` (sink-input rows carry the numeric index, so a
 *      name-only comparison can never match a real stream)
 *   4. spawn the probe child, passing the owned lock fd through at the SAME fd
 *      number the child is told to verify (--heavy-lock-fd)
 *   5. wait for the probe's REAL browser pid
 *   6. VERIFY OWNERSHIP OF THE OWNED SINK — every sink-input on it must belong
 *      to the probe's own browser process tree — BEFORE any recording
 *   7. only THEN start the recorder on <owned sink>.monitor
 *   8. wait for the probe, re-checking ownership while recording
 *   9. finally: stop+reap the recorder, stop+WAIT for the probe's own browser
 *      teardown receipt, unload the exact sink module, re-read the default sink
 *
 * The recorder therefore starts AFTER the browser child, not before it. The
 * earlier header claimed the opposite; the isolated own-stream verification is
 * deliberately kept BEFORE recording, because recording first would mean
 * recording an unverified sink.
 *
 * BOUNDS
 *   - ONE absolute whole-session deadline taken at session start bounds every
 *     wait (pid, ownership, probe, teardown). No wait is "360 s after" another.
 *   - the recorder is stopped and reaped in a finally on every path and the
 *     partial recording is KEPT: a failed criterion must not destroy evidence.
 *   - the probe child is owned from the instant spawn returns, through the
 *     finally, on every path (pid failure, ownership refusal, timeout, spawn
 *     'error'), and its exit + cleanup receipt are waited for BEFORE the sink
 *     is unloaded and before this process exits (which is when root's heavy
 *     lock is released).
 *
 * MEASUREMENT BINDING
 *   Coverage is computed from the ACTUAL recorder wallclock interval against
 *   the ACTUAL completion edge wallclock in the probe's window.ndjson: the
 *   recording must span edge-3000 ms .. edge+11500 ms. No guessed 73.5 s
 *   duration is accepted as proof. Short/absent coverage is labelled
 *   INCOMPLETE and the evidence is retained; the cue is never replayed.
 *
 * IT MAKES NO AUDIBLE OR CAUSAL CLAIM. A recording is a recording.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync, readlinkSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import process from 'node:process';

const HERE = dirname(fileURLToPath(import.meta.url));
const RUN_DIR = resolve(HERE, '..', '..', '..');
const CAPTURES = resolve(RUN_DIR, 'verifier', 'captures');
const PROBE_PATH = resolve(HERE, 'finale-window-probe.mjs');

export const RUNTIME_SCHEMA = 'paravoxia.verifier.finaleWindowRuntime.v2';
export const HARD_MAX_SESSION_S = 360;
/** Window contract the recording must cover, from windowSampler DEFAULT_WINDOW. */
export const PRE_EDGE_MS = 3000;
export const POST_EDGE_MS = 11500;
/** Bounded teardown budget for the probe's own browser, inside the session. */
export const PROBE_STOP_GRACE_MS = 25_000;
export const PROBE_STOP_KILL_MS = 8_000;

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] !== undefined && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const tag = (m) => console.log(`[finale-window-runtime] ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ pactl -- */
/** Injectable so every branch below is testable with stubs and no audio server. */
export const realPactl = (args) =>
  execFileSync('pactl', args, { encoding: 'utf8', timeout: 15_000 });

/** Parse `pactl list sink-inputs` into [{id, sink, pid, binary, appName}]. */
export function parseSinkInputs(text) {
  const out = [];
  for (const block of String(text).split(/\n(?=Sink Input #)/)) {
    const id = /Sink Input #(\d+)/.exec(block);
    if (!id) continue;
    const pid = /application\.process\.id = "(\d+)"/.exec(block);
    out.push({
      id: Number(id[1]),
      sink: (/\n\s*Sink: (\S+)/.exec(block) || [, null])[1],
      pid: pid ? Number(pid[1]) : null,
      binary: (/application\.process\.binary = "([^"]*)"/.exec(block) || [, null])[1],
      appName: (/application\.name = "([^"]*)"/.exec(block) || [, null])[1]
    });
  }
  return out;
}

/**
 * Resolve the EXACT numeric index of our newly created sink from
 * `pactl list short sinks` (real rows: `<index>\t<name>\t<module>\t<spec>...`).
 * A real sink-input's `Sink:` field is that NUMERIC index, so without this the
 * ownership gate compares a name against a number and can never match.
 * Missing, non-numeric or ambiguous (duplicate name) => REFUSAL, never a guess.
 */
export function resolveSinkIndex(text, sinkName) {
  const rows = [];
  for (const line of String(text).split('\n')) {
    if (!line.trim()) continue;
    const f = line.split('\t').length > 1 ? line.split('\t') : line.trim().split(/\s+/);
    rows.push({ index: f[0]?.trim(), name: f[1]?.trim() });
  }
  const hits = rows.filter((r) => r.name === sinkName);
  if (hits.length === 0) return { ok: false, index: null, reason: 'owned-sink-not-listed', rows: rows.length };
  if (hits.length > 1) return { ok: false, index: null, reason: 'ambiguous-sink-name', matches: hits };
  const raw = hits[0].index;
  if (raw == null || !/^\d+$/.test(raw)) return { ok: false, index: null, reason: 'non-numeric-sink-index', raw };
  return { ok: true, index: Number(raw), reason: 'resolved-exact-numeric-index', name: sinkName };
}

/** Parse `pactl list short modules` for our exact module id. */
export function moduleIdPresent(text, moduleId) {
  return String(text).split('\n').some((l) => l.trim().split(/\s+/)[0] === String(moduleId));
}

/** Real process tree: is `pid` the browser pid or a descendant of it? */
export function isInProcessTree(pid, rootPid, parentOf) {
  if (pid == null || rootPid == null) return false;
  let cur = Number(pid);
  for (let hops = 0; hops < 24 && cur > 1; hops += 1) {
    if (cur === Number(rootPid)) return true;
    const next = parentOf(cur);
    if (next == null || next === cur) return false;
    cur = next;
  }
  return false;
}

export const realParentOf = (pid) => {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
    const after = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    return Number(after[1]);
  } catch { return null; }
};

/**
 * OWNERSHIP GATE. Returns {ok, reason, streams}. It is a REFUSAL, not a
 * warning: a foreign stream on the owned sink means the recording would be a
 * mixed capture and must not be taken. `sinkIndex` MUST be the resolved
 * numeric index; a null index alone can no longer be passed off as a match.
 */
export function verifySinkOwnership({ sinkName, sinkIndex, browserPid, sinkInputs, parentOf = realParentOf }) {
  if (sinkIndex == null || !Number.isInteger(Number(sinkIndex))) {
    return { ok: false, reason: 'unresolved-sink-index', streams: [] };
  }
  const mine = sinkInputs.filter((s) => String(s.sink) === String(sinkIndex) || s.sink === sinkName);
  if (mine.length === 0) return { ok: false, reason: 'no-stream-on-owned-sink', streams: mine };
  const foreign = mine.filter((s) => !isInProcessTree(s.pid, browserPid, parentOf));
  if (foreign.length > 0) return { ok: false, reason: 'foreign-stream-on-owned-sink', streams: mine, foreign };
  return { ok: true, reason: 'all-streams-in-probe-browser-process-tree', streams: mine };
}

/* --------------------------------------------------- inherited heavy lock -- */
/**
 * The heavy lock is ROOT's. This wrapper only proves the descriptor it was
 * handed is real and points at the lock file, then passes THAT SAME descriptor
 * to the child at the SAME fd number. It never opens or flocks anything.
 */
export function validateInheritedLockFd({ fd, lockPath, readLink = (p) => readlinkSync(p) }) {
  const rec = { fd, lockPath, ok: false, problems: [], fdTarget: null };
  if (fd == null || !Number.isInteger(Number(fd)) || Number(fd) < 3) {
    rec.problems.push('--heavy-lock-fd must be an inherited descriptor >= 3'); return rec;
  }
  if (!lockPath) { rec.problems.push('--heavy-lock <path> is required to prove the fd identity'); return rec; }
  try { rec.fdTarget = String(readLink(`/proc/self/fd/${fd}`)); }
  catch (e) { rec.problems.push(`fd ${fd} is not open in this process: ${String(e.message).slice(0, 120)}`); return rec; }
  if (rec.fdTarget !== resolve(lockPath)) {
    rec.problems.push(`fd ${fd} points at ${rec.fdTarget}, not ${resolve(lockPath)}`); return rec;
  }
  rec.ok = true;
  return rec;
}

/** stdio array that keeps 0/1/2 and places the owned lock fd at childFd. */
export function buildStdio({ parentFd, childFd }) {
  const stdio = ['ignore', 'pipe', 'pipe'];
  for (let i = 3; i < childFd; i += 1) stdio.push('ignore');
  stdio[childFd] = parentFd;
  return stdio;
}

/* ------------------------------------------------ measurement binding ------ */
/**
 * Bind the recording to the ACTUAL atomic window: read the probe's window.ndjson
 * and require the recorder's wallclock interval to cover edge-3000 .. edge+11500.
 */
export function assessCoverage({ ndjsonText, recorderStartWallMs, recorderStopWallMs }) {
  const samples = String(ndjsonText).split('\n').filter((l) => l.trim()).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const edge = samples.find((s) => s?.edgeVerdict?.edge === true);
  const rec = {
    sampleCount: samples.length, edgeWallMs: edge?.wallMs ?? null,
    recorderStartWallMs: recorderStartWallMs ?? null, recorderStopWallMs: recorderStopWallMs ?? null,
    requiredFromWallMs: null, requiredToWallMs: null, preEdgeCoveredMs: null, postEdgeCoveredMs: null,
    complete: false, reason: null
  };
  if (!edge || typeof edge.wallMs !== 'number') { rec.reason = 'no-completion-edge-in-window'; return rec; }
  if (recorderStartWallMs == null || recorderStopWallMs == null) { rec.reason = 'no-recorder-interval'; return rec; }
  rec.requiredFromWallMs = edge.wallMs - PRE_EDGE_MS;
  rec.requiredToWallMs = edge.wallMs + POST_EDGE_MS;
  rec.preEdgeCoveredMs = edge.wallMs - recorderStartWallMs;
  rec.postEdgeCoveredMs = recorderStopWallMs - edge.wallMs;
  if (recorderStartWallMs > rec.requiredFromWallMs) { rec.reason = 'recorder-started-after-required-pre-edge-span'; return rec; }
  if (recorderStopWallMs < rec.requiredToWallMs) { rec.reason = 'recorder-stopped-before-required-post-edge-span'; return rec; }
  rec.complete = true;
  rec.reason = 'recorder-interval-covers-3000ms-pre-edge-through-11500ms-post-edge';
  return rec;
}

/* ------------------------------------------------------------- the session -- */
export async function runCombinedCapture(opts) {
  const {
    outDir, sinkName = 'paravoxia_finale_window',
    maxSessionS = HARD_MAX_SESSION_S,
    heavyLockFd = null, heavyLockPath = null, childLockFd = 9,
    pactl = realPactl, spawnFn = spawn, parentOf = realParentOf,
    probePath = PROBE_PATH, probeOutName = null, probeArgs = [],
    validateFd = validateInheritedLockFd,
    log = tag, now = () => Date.now()
  } = opts;

  if (maxSessionS > HARD_MAX_SESSION_S) throw new Error(`session bound ${maxSessionS}s exceeds hard cap ${HARD_MAX_SESSION_S}s`);
  mkdirSync(outDir, { recursive: true });

  // ONE absolute deadline for the WHOLE session, taken here and used by every
  // wait below. Nothing restarts it.
  const sessionStartMs = now();
  const sessionDeadline = sessionStartMs + maxSessionS * 1000;
  const remaining = () => sessionDeadline - now();

  const record = {
    schema: RUNTIME_SCHEMA, startedAt: new Date().toISOString(),
    outcome: 'NOT-COMPLETED', outcomeIsAcceptance: false,
    audibleClaim: 'none — this wrapper records bytes; it makes no audible, causal or acceptance claim',
    actualOrder: 'lock-fd validated -> sink created -> sink index resolved -> browser child -> ownership verified -> recorder started -> probe waited -> probe stopped+reaped -> sink unloaded',
    sessionStartMs, sessionDeadlineMs: sessionDeadline, maxSessionS,
    sinkName, sinkIndex: null, moduleId: null, browserPid: null,
    defaultSinkBefore: null, defaultSinkAfter: null,
    heavyLock: null, ownership: null, ownershipRecheck: null,
    recorder: null, probe: null, probeTeardown: null, coverage: null,
    phases: [], spawnErrors: [], teardownErrors: [], incompleteCleanup: [], errors: []
  };
  const phase = (name, extra = {}) => { record.phases.push({ name, atMs: now(), sinceStartMs: now() - sessionStartMs, ...extra }); log(name); };

  let moduleId = null;
  let recorder = null;
  let recorderStopped = false;
  let probe = null;
  let probeStopped = false;
  const audioPath = resolve(outDir, 'owned-sink.wav');
  const stopFile = resolve(outDir, 'stop-request.json');

  const stopRecorder = async (reason) => {
    if (!recorder || recorderStopped) return;
    recorderStopped = true;
    try { recorder.kill('SIGINT'); } catch { /* already gone */ }
    const deadline = Math.min(now() + 5000, Math.max(now() + 1000, sessionDeadline + 5000));
    while (recorder.exitCode === null && now() < deadline) await sleep(100);
    if (recorder.exitCode === null) { try { recorder.kill('SIGKILL'); } catch { /* gone */ } await sleep(300); }
    if (recorder.exitCode === null) record.incompleteCleanup.push('recorder did not exit after SIGINT+SIGKILL');
    record.recorder = {
      ...(record.recorder || {}), stopReason: reason, stoppedAtWallMs: Date.now(), stoppedAtMs: now(),
      exitCode: recorder.exitCode,
      bytes: existsSync(audioPath) ? statSync(audioPath).size : 0,
      file: audioPath, preserved: true,
      note: 'The recording is kept on EVERY path, including a failed game criterion, so failure audio is never destroyed.'
    };
    phase('recorder-stopped', { reason, bytes: record.recorder.bytes });
  };

  /**
   * OWN THE CHILD. This stops ONLY the child this wrapper spawned; it never
   * touches a foreign process, a global chrome, or root's 34413 preview. The
   * cooperative stop-file and SIGTERM both reach the probe's own guard, which
   * closes the probe's OWN browser and writes cleanup-receipt.json. We WAIT for
   * the child's real exit and for that receipt before returning, so the sink is
   * still alive during teardown and root's heavy lock is only released (on our
   * exit) after the browser is actually gone.
   */
  const stopProbe = async (reason) => {
    if (!probe || probeStopped) return;
    probeStopped = true;
    const t0 = now();
    const teardown = { reason, requestedAtMs: t0, stopFileWritten: false, signals: [], exitCode: null, signalCode: null, waitedMs: null, receipt: null, forced: false };
    try { writeFileSync(stopFile, JSON.stringify({ reason, at: new Date().toISOString(), from: 'finale-window-runtime' }, null, 1)); teardown.stopFileWritten = true; }
    catch (e) { record.teardownErrors.push(`stop-file write failed: ${String(e).slice(0, 200)}`); }
    if (probe.exitCode === null && probe.signalCode == null) {
      try { probe.kill('SIGTERM'); teardown.signals.push('SIGTERM'); }
      catch (e) { record.teardownErrors.push(`SIGTERM to own probe failed: ${String(e).slice(0, 200)}`); }
    }
    const graceEnd = now() + PROBE_STOP_GRACE_MS;
    while (probe.exitCode === null && probe.signalCode == null && now() < graceEnd) await sleep(200);
    if (probe.exitCode === null && probe.signalCode == null) {
      teardown.forced = true;
      try { probe.kill('SIGKILL'); teardown.signals.push('SIGKILL'); }
      catch (e) { record.teardownErrors.push(`SIGKILL to own probe failed: ${String(e).slice(0, 200)}`); }
      const killEnd = now() + PROBE_STOP_KILL_MS;
      while (probe.exitCode === null && probe.signalCode == null && now() < killEnd) await sleep(200);
    }
    teardown.exitCode = probe.exitCode;
    teardown.signalCode = probe.signalCode ?? null;
    teardown.waitedMs = now() - t0;
    if (probe.exitCode === null && probe.signalCode == null) {
      record.incompleteCleanup.push('probe child never reported exit; its browser may still be alive');
    }
    const receiptPath = resolve(outDir, 'cleanup-receipt.json');
    if (existsSync(receiptPath)) {
      try { teardown.receipt = JSON.parse(readFileSync(receiptPath, 'utf8')); }
      catch (e) { record.teardownErrors.push(`cleanup receipt unreadable: ${String(e).slice(0, 200)}`); }
    }
    if (!teardown.receipt) record.incompleteCleanup.push('no probe cleanup-receipt.json: the probe-owned browser teardown is UNPROVEN');
    else if (teardown.receipt.stopped === false) record.incompleteCleanup.push(`probe reported stopped=false: ${String(teardown.receipt.stopError ?? '').slice(0, 200)}`);
    teardown.browserTeardownProven = Boolean(teardown.receipt && teardown.receipt.stopped !== false)
      && (probe.exitCode !== null || probe.signalCode != null);
    record.probeTeardown = teardown;
    phase('probe-stopped', { reason, exitCode: teardown.exitCode, signalCode: teardown.signalCode, forced: teardown.forced, browserTeardownProven: teardown.browserTeardownProven });
  };

  try {
    // 0. the INHERITED lock descriptor, proven before anything is created.
    record.heavyLock = validateFd({ fd: heavyLockFd, lockPath: heavyLockPath });
    if (!record.heavyLock.ok) throw new Error(`inherited heavy-lock fd refused: ${record.heavyLock.problems.join('; ')}`);
    if (!existsSync(probePath)) throw new Error(`probe not found at ${probePath}`);
    if (!probeOutName || String(probeOutName).startsWith('-')) throw new Error('probeOutName (the child --out) is required and must not look like a flag');
    if (resolve(CAPTURES, probeOutName) !== resolve(outDir)) {
      throw new Error(`wrapper --out ${resolve(outDir)} does not resolve to the child --out ${resolve(CAPTURES, probeOutName)}`);
    }
    for (const a of probeArgs) if (typeof a !== 'string') throw new Error('probeArgs must be strings');
    phase('heavy-lock-fd-validated', { fd: heavyLockFd, childFd: childLockFd, target: record.heavyLock.fdTarget });

    record.defaultSinkBefore = String(pactl(['get-default-sink'])).trim();
    phase('default-sink-read', { defaultSink: record.defaultSinkBefore });

    // 1. own sink
    moduleId = String(pactl(['load-module', 'module-null-sink', `sink_name=${sinkName}`,
      `sink_properties=device.description=${sinkName}`])).trim();
    record.moduleId = moduleId;
    phase('owned-sink-created', { moduleId });

    // 1b. its EXACT numeric index — the only thing a real sink-input row shows.
    const resolved = resolveSinkIndex(pactl(['list', 'short', 'sinks']), sinkName);
    record.sinkIndexResolution = resolved;
    if (!resolved.ok) throw new Error(`cannot resolve the owned sink's numeric index: ${resolved.reason}`);
    record.sinkIndex = resolved.index;
    phase('owned-sink-index-resolved', { sinkIndex: resolved.index });

    // 2. the probe's own browser child. The owned lock fd is passed THROUGH at
    //    the same fd number the child is told to verify; 0/1/2 are unchanged.
    const childArgs = [probePath, '--out', String(probeOutName), '--unmuted',
      '--pulse-sink', sinkName, '--heavy-lock', resolve(heavyLockPath),
      '--heavy-lock-fd', String(childLockFd), ...probeArgs];
    record.childCommand = { execPath: process.execPath, args: childArgs, childLockFd, parentLockFd: heavyLockFd };
    probe = spawnFn(process.execPath, childArgs, {
      stdio: buildStdio({ parentFd: heavyLockFd, childFd: childLockFd }),
      env: process.env
    });
    const probeLog = [];
    probe.on?.('error', (e) => { record.spawnErrors.push(`probe spawn error: ${String(e && e.message ? e.message : e).slice(0, 300)}`); });
    probe.stdout?.on('data', (d) => probeLog.push(String(d)));
    probe.stderr?.on('data', (d) => probeLog.push(String(d)));
    phase('probe-launched', { probePid: probe.pid, childLockFd });

    // 3. the REAL browser pid, published by the probe. Never mocked.
    const pidFile = resolve(outDir, 'browser-pid.json');
    while (!existsSync(pidFile) && remaining() > 0 && probe.exitCode === null && record.spawnErrors.length === 0) await sleep(250);
    if (record.spawnErrors.length) throw new Error(`probe child failed to spawn: ${record.spawnErrors[0]}`);
    if (!existsSync(pidFile)) throw new Error('probe never published browser-pid.json; refusing to record without a verified owner');
    record.browserPid = JSON.parse(readFileSync(pidFile, 'utf8')).browserPid;
    if (!record.browserPid) throw new Error('probe published a null browser pid; refusing to record without a verified owner');
    phase('browser-pid-observed', { browserPid: record.browserPid });

    // 4. ownership gate BEFORE any recording, against the NUMERIC index.
    let ownership = { ok: false, reason: 'not-checked' };
    const ownDeadline = Math.min(now() + 90_000, sessionDeadline);
    while (now() < ownDeadline) {
      ownership = verifySinkOwnership({
        sinkName, sinkIndex: record.sinkIndex, browserPid: record.browserPid,
        sinkInputs: parseSinkInputs(pactl(['list', 'sink-inputs'])), parentOf
      });
      if (ownership.ok) break;
      if (ownership.reason === 'foreign-stream-on-owned-sink') break;   // never wait out a foreign stream
      await sleep(1000);
    }
    record.ownership = ownership;
    if (!ownership.ok) throw new Error(`sink ownership refused: ${ownership.reason}`);
    phase('ownership-verified', { streams: ownership.streams.length, sinkIndex: record.sinkIndex });

    // 5. record ONLY the owned sink's own monitor
    recorder = spawnFn('parec', ['-d', `${sinkName}.monitor`, '--file-format=wav', audioPath],
      { stdio: ['ignore', 'ignore', 'pipe'] });
    recorder.on?.('error', (e) => { record.spawnErrors.push(`recorder spawn error: ${String(e && e.message ? e.message : e).slice(0, 300)}`); });
    record.recorder = { pid: recorder.pid, device: `${sinkName}.monitor`,
      startedAtWallMs: Date.now(), startedAtMs: now(), isMicrophone: false, isDefaultMonitor: false };
    phase('recorder-started', { device: `${sinkName}.monitor`, pid: recorder.pid });

    // 6. wait for the probe under the ONE absolute session deadline, re-checking
    //    ownership while recording; a foreign stream mid-recording is a refusal.
    let lastRecheck = now();
    while (probe.exitCode === null && remaining() > 0 && record.spawnErrors.length === 0) {
      await sleep(500);
      if (now() - lastRecheck >= 15_000) {
        lastRecheck = now();
        try {
          const re = verifySinkOwnership({ sinkName, sinkIndex: record.sinkIndex, browserPid: record.browserPid,
            sinkInputs: parseSinkInputs(pactl(['list', 'sink-inputs'])), parentOf });
          record.ownershipRecheck = { ...re, atMs: lastRecheck };
          if (re.reason === 'foreign-stream-on-owned-sink') throw new Error('foreign stream appeared on the owned sink DURING recording');
        } catch (e) {
          if (String(e.message).includes('foreign stream')) throw e;
          record.errors.push(`ownership re-check failed: ${String(e).slice(0, 200)}`);
        }
      }
    }
    if (record.spawnErrors.length) throw new Error(`child spawn error during session: ${record.spawnErrors[0]}`);
    const elapsedS = (now() - record.recorder.startedAtMs) / 1000;
    if (probe.exitCode === null) {
      record.probe = { exitCode: null, timedOut: true, elapsedS };
      throw new Error(`probe did not finish within the ${maxSessionS}s absolute session bound`);
    }
    record.probe = { exitCode: probe.exitCode, timedOut: false, elapsedS, log: probeLog.join('').slice(-4000) };
    writeFileSync(resolve(outDir, 'probe-console.log'), probeLog.join(''));
    record.outcome = probe.exitCode === 0 ? 'CAPTURED-NO-VERDICT' : 'PROBE-FAILED-AUDIO-PRESERVED';
    return record;
  } catch (error) {
    record.errors.push(String(error && error.stack ? error.stack : error).slice(0, 800));
    record.outcome = record.outcome === 'NOT-COMPLETED' ? 'FAILED-AUDIO-PRESERVED' : record.outcome;
    throw Object.assign(error, { runtimeRecord: record });
  } finally {
    // Order matters: stop the reader, then stop AND WAIT FOR the probe's own
    // browser (its streams must be gone before the sink they feed disappears),
    // then unload the exact module. Nothing here touches a foreign process.
    await stopRecorder('finally');
    await stopProbe('finally');
    if (moduleId) {
      try {
        pactl(['unload-module', moduleId]);
        const gone = !moduleIdPresent(pactl(['list', 'short', 'modules']), moduleId);
        record.sinkTeardown = { moduleId, unloaded: true, verifiedGone: gone, afterProbeExit: true };
        if (!gone) { record.errors.push(`owned sink module ${moduleId} still present after unload`); record.incompleteCleanup.push(`sink module ${moduleId} not gone`); }
      } catch (e) {
        record.sinkTeardown = { moduleId, unloaded: false, verifiedGone: false, error: String(e).slice(0, 300) };
        record.teardownErrors.push(`unload-module ${moduleId} failed: ${String(e).slice(0, 200)}`);
        record.incompleteCleanup.push(`sink module ${moduleId} may be leaked`);
      }
    }
    try {
      record.defaultSinkAfter = String(pactl(['get-default-sink'])).trim();
      record.defaultSinkUnchanged = record.defaultSinkAfter === record.defaultSinkBefore;
      if (!record.defaultSinkUnchanged) record.errors.push('server default sink CHANGED across the session');
    } catch (e) { record.teardownErrors.push(`default-sink re-read failed: ${String(e).slice(0, 200)}`); }

    // Bind the recording to the ACTUAL measured window, or say INCOMPLETE.
    try {
      const nd = resolve(outDir, 'window.ndjson');
      record.coverage = assessCoverage({
        ndjsonText: existsSync(nd) ? readFileSync(nd, 'utf8') : '',
        recorderStartWallMs: record.recorder?.startedAtWallMs ?? null,
        recorderStopWallMs: record.recorder?.stoppedAtWallMs ?? null
      });
      if (!record.coverage.complete) {
        record.outcome = 'INCOMPLETE-EVIDENCE-RETAINED';
        record.errors.push(`recording does not provably cover the window: ${record.coverage.reason}`);
      }
    } catch (e) { record.errors.push(`coverage assessment failed: ${String(e).slice(0, 200)}`); }
    record.cleanupComplete = record.incompleteCleanup.length === 0;
    record.endedAt = new Date().toISOString();
    record.wholeSessionS = (now() - sessionStartMs) / 1000;
    try { writeFileSync(resolve(outDir, 'runtime-record.json'), JSON.stringify(record, null, 1)); } catch { /* reported below */ }
  }
}

/* ------------------------------------------------------------------- main -- */
if (import.meta.url === `file://${process.argv[1]}`) {
  const outDir = arg('out', null);
  if (!outDir) { console.error('--out <abs dir under verifier/captures> is required'); process.exit(2); }
  const abs = resolve(outDir);
  runCombinedCapture({
    outDir: abs,
    probeOutName: relative(CAPTURES, abs),
    sinkName: arg('sink', 'paravoxia_finale_window'),
    maxSessionS: Number(arg('max-session-s', String(HARD_MAX_SESSION_S))),
    heavyLockFd: arg('heavy-lock-fd') == null ? null : Number(arg('heavy-lock-fd')),
    heavyLockPath: arg('heavy-lock', process.env.PARAVOXIA_HEAVY_LOCK ?? null),
    childLockFd: Number(arg('child-lock-fd', arg('heavy-lock-fd', '9'))),
    probeArgs: process.argv.includes('--probe-args') ? process.argv.slice(process.argv.indexOf('--probe-args') + 1) : []
  }).then((r) => { tag(`${r.outcome}; record -> ${resolve(abs, 'runtime-record.json')}`); })
    .catch((e) => { console.error(`[finale-window-runtime] FAILED: ${e.stack ?? e}`); process.exit(1); });
}
