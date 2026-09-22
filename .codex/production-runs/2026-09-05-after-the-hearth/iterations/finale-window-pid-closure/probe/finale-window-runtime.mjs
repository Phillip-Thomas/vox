#!/usr/bin/env node
/**
 * FINALE-WINDOW RUNTIME WRAPPER — run-local, owned by the finale-window lane of
 * 2026-09-05-after-the-hearth. PREPARED HERE, NOT RUN HERE (no sink, no browser
 * and no recorder is created during preparation; --selftest exercises only the
 * stubbed error branches).
 *
 * IT IS THE CONTROL ROLE for ONE combined unmuted capture: it owns the audio
 * sink and the recorder; the probe (finale-window-probe.mjs) owns the browser
 * and the atomic state window. One run produces BOTH the atomic-state evidence
 * and the actual output recording; there is no second state-only capture.
 *
 * ISOLATION (audio-isolation-plan.json, unchanged in principle)
 *   1. Create ONE probe-owned null sink (module id remembered exactly).
 *   2. Launch the probe's Chromium with PULSE_SINK=<owned sink> in THAT CHILD's
 *      environment only. The server default sink is never set, never moved and
 *      is re-read afterwards to prove it is unchanged.
 *   3. Before recording, verify every sink-input on the owned sink belongs to
 *      the probe's OWN browser process tree (application.process.id must be the
 *      browser pid or a descendant of it). Any foreign stream => ABORT.
 *   4. Record ONLY <sink>.monitor. Never the default monitor, never a
 *      microphone, never another application's stream.
 *   5. Unload the module by its EXACT id in a finally and verify it is gone.
 *
 * BOUNDS
 *   - whole session <= --max-session-s (default 360, hard cap 360)
 *   - the recorder is stopped in a finally on every path, including throws,
 *     and the partial recording is KEPT: a failed game criterion must not
 *     destroy the audio evidence.
 *   - the recorder starts BEFORE the browser child and stops only after the
 *     probe's window (observed ~62 s to completion + 11.5 s hold) is sealed,
 *     so a 60 s whole-run recording can no longer end before completion.
 *
 * IT MAKES NO AUDIBLE OR CAUSAL CLAIM. A recording is a recording.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import process from 'node:process';

const HERE = dirname(fileURLToPath(import.meta.url));
const RUN_DIR = resolve(HERE, '..', '..', '..');
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..', '..', '..');   // six parents: probes/verifier/run/production-runs/.codex/vox

export const RUNTIME_SCHEMA = 'paravoxia.verifier.finaleWindowRuntime.v1';
export const HARD_MAX_SESSION_S = 360;
/** observed completion (~62 s) + the 11.5 s post-edge hold + bring-up slack. */
export const MIN_RECORDER_S = 62 + 11.5;

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
 * mixed capture and must not be taken.
 */
export function verifySinkOwnership({ sinkName, sinkIndex, browserPid, sinkInputs, parentOf = realParentOf }) {
  const mine = sinkInputs.filter((s) => s.sink === sinkName || String(s.sink) === String(sinkIndex));
  if (mine.length === 0) {
    return { ok: false, reason: 'no-stream-on-owned-sink', streams: mine };
  }
  const foreign = mine.filter((s) => !isInProcessTree(s.pid, browserPid, parentOf));
  if (foreign.length > 0) {
    return { ok: false, reason: 'foreign-stream-on-owned-sink', streams: mine, foreign };
  }
  return { ok: true, reason: 'all-streams-in-probe-browser-process-tree', streams: mine };
}

/* ------------------------------------------------------------- the session -- */
export async function runCombinedCapture(opts) {
  const {
    outDir, sinkName = 'paravoxia_finale_window',
    maxSessionS = HARD_MAX_SESSION_S, recorderMinS = MIN_RECORDER_S,
    pactl = realPactl, spawnFn = spawn, parentOf = realParentOf,
    probeArgs = [], log = tag, now = () => Date.now()
  } = opts;

  if (maxSessionS > HARD_MAX_SESSION_S) throw new Error(`session bound ${maxSessionS}s exceeds hard cap ${HARD_MAX_SESSION_S}s`);
  if (recorderMinS < MIN_RECORDER_S) throw new Error(`recorder lifetime ${recorderMinS}s is shorter than the observed completion+hold (${MIN_RECORDER_S}s)`);
  mkdirSync(outDir, { recursive: true });

  const record = {
    schema: RUNTIME_SCHEMA, startedAt: new Date().toISOString(),
    outcome: 'NOT-COMPLETED', outcomeIsAcceptance: false,
    audibleClaim: 'none — this wrapper records bytes; it makes no audible, causal or acceptance claim',
    sinkName, moduleId: null, browserPid: null, defaultSinkBefore: null, defaultSinkAfter: null,
    ownership: null, recorder: null, probe: null, phases: [], errors: []
  };
  const phase = (name, extra = {}) => { record.phases.push({ name, atMs: now(), ...extra }); log(name); };

  let moduleId = null;
  let recorder = null;
  let recorderStopped = false;
  const audioPath = resolve(outDir, 'owned-sink.wav');

  const stopRecorder = async (reason) => {
    if (!recorder || recorderStopped) return;
    recorderStopped = true;
    try { recorder.kill('SIGINT'); } catch { /* already gone */ }
    const deadline = now() + 5000;
    while (recorder.exitCode === null && now() < deadline) await sleep(100);
    if (recorder.exitCode === null) { try { recorder.kill('SIGKILL'); } catch { /* gone */ } }
    record.recorder = {
      ...(record.recorder || {}), stopReason: reason, stoppedAtMs: now(),
      exitCode: recorder.exitCode,
      bytes: existsSync(audioPath) ? statSync(audioPath).size : 0,
      file: audioPath,
      preserved: true,
      note: 'The recording is kept on EVERY path, including a failed game criterion, so failure audio is never destroyed.'
    };
    phase('recorder-stopped', { reason, bytes: record.recorder.bytes });
  };

  try {
    record.defaultSinkBefore = String(pactl(['get-default-sink'])).trim();
    phase('default-sink-read', { defaultSink: record.defaultSinkBefore });

    // 1. own sink
    moduleId = String(pactl(['load-module', 'module-null-sink', `sink_name=${sinkName}`,
      `sink_properties=device.description=${sinkName}`])).trim();
    record.moduleId = moduleId;
    phase('owned-sink-created', { moduleId });

    // 2. the probe's own browser, pointed at the owned sink through ITS env only
    const probe = spawnFn(process.execPath,
      [resolve(HERE, 'finale-window-probe.mjs'), '--pulse-sink', sinkName, ...probeArgs],
      { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
    const probeLog = [];
    probe.stdout?.on('data', (d) => probeLog.push(String(d)));
    probe.stderr?.on('data', (d) => probeLog.push(String(d)));
    phase('probe-launched', { probePid: probe.pid });

    // 3. the REAL browser pid, published by the probe. Never mocked.
    const pidFile = resolve(outDir, 'browser-pid.json');
    const pidDeadline = now() + 120_000;
    while (!existsSync(pidFile) && now() < pidDeadline && probe.exitCode === null) await sleep(250);
    if (!existsSync(pidFile)) throw new Error('probe never published browser-pid.json; refusing to record without a verified owner');
    record.browserPid = JSON.parse(readFileSync(pidFile, 'utf8')).browserPid;
    if (!record.browserPid) throw new Error('probe published a null browser pid; refusing to record without a verified owner');
    phase('browser-pid-observed', { browserPid: record.browserPid });

    // 4. ownership gate BEFORE any recording
    let ownership = { ok: false, reason: 'not-checked' };
    const ownDeadline = now() + 90_000;
    while (now() < ownDeadline) {
      ownership = verifySinkOwnership({
        sinkName, sinkIndex: null, browserPid: record.browserPid,
        sinkInputs: parseSinkInputs(pactl(['list', 'sink-inputs'])), parentOf
      });
      if (ownership.ok) break;
      if (ownership.reason === 'foreign-stream-on-owned-sink') break;   // never wait out a foreign stream
      await sleep(1000);
    }
    record.ownership = ownership;
    if (!ownership.ok) throw new Error(`sink ownership refused: ${ownership.reason}`);
    phase('ownership-verified', { streams: ownership.streams.length });

    // 5. record ONLY the owned sink's own monitor
    recorder = spawnFn('parec', ['-d', `${sinkName}.monitor`, '--file-format=wav', audioPath],
      { stdio: ['ignore', 'ignore', 'pipe'] });
    record.recorder = { pid: recorder.pid, device: `${sinkName}.monitor`, startedAtMs: now(),
      plannedMinSeconds: recorderMinS, isMicrophone: false, isDefaultMonitor: false };
    phase('recorder-started', { device: `${sinkName}.monitor`, pid: recorder.pid });

    // 6. wait for the probe, bounded by the whole-session cap AND never shorter
    //    than the completion+hold the recorder must cover.
    const sessionDeadline = now() + maxSessionS * 1000;
    while (probe.exitCode === null && now() < sessionDeadline) await sleep(500);
    const elapsedS = (now() - record.recorder.startedAtMs) / 1000;
    if (probe.exitCode === null) {
      record.probe = { exitCode: null, timedOut: true, elapsedS };
      throw new Error(`probe did not finish within the ${maxSessionS}s session bound`);
    }
    record.probe = { exitCode: probe.exitCode, timedOut: false, elapsedS,
      coveredCompletionPlusHold: elapsedS >= recorderMinS, log: probeLog.join('').slice(-4000) };
    writeFileSync(resolve(outDir, 'probe-console.log'), probeLog.join(''));
    record.outcome = probe.exitCode === 0 ? 'CAPTURED-NO-VERDICT' : 'PROBE-FAILED-AUDIO-PRESERVED';
    return record;
  } catch (error) {
    record.errors.push(String(error && error.stack ? error.stack : error).slice(0, 800));
    record.outcome = record.outcome === 'NOT-COMPLETED' ? 'FAILED-AUDIO-PRESERVED' : record.outcome;
    throw Object.assign(error, { runtimeRecord: record });
  } finally {
    // Recorder first, then the sink: stopping the reader before removing what
    // it reads keeps the wav finalized.
    await stopRecorder('finally');
    if (moduleId) {
      try {
        pactl(['unload-module', moduleId]);
        const gone = !moduleIdPresent(pactl(['list', 'short', 'modules']), moduleId);
        record.sinkTeardown = { moduleId, unloaded: true, verifiedGone: gone };
        if (!gone) record.errors.push(`owned sink module ${moduleId} still present after unload`);
      } catch (e) {
        record.sinkTeardown = { moduleId, unloaded: false, verifiedGone: false, error: String(e).slice(0, 300) };
        record.errors.push(`unload-module ${moduleId} failed: ${String(e).slice(0, 200)}`);
      }
    }
    try {
      record.defaultSinkAfter = String(pactl(['get-default-sink'])).trim();
      record.defaultSinkUnchanged = record.defaultSinkAfter === record.defaultSinkBefore;
      if (!record.defaultSinkUnchanged) record.errors.push('server default sink CHANGED across the session');
    } catch (e) { record.errors.push(`default-sink re-read failed: ${String(e).slice(0, 200)}`); }
    record.endedAt = new Date().toISOString();
    try { writeFileSync(resolve(outDir, 'runtime-record.json'), JSON.stringify(record, null, 1)); } catch { /* reported below */ }
  }
}

/* ------------------------------------------------------------------- main -- */
if (import.meta.url === `file://${process.argv[1]}`) {
  const outDir = arg('out', null);
  if (!outDir) { console.error('--out <abs dir> is required'); process.exit(2); }
  runCombinedCapture({
    outDir: resolve(outDir),
    sinkName: arg('sink', 'paravoxia_finale_window'),
    maxSessionS: Number(arg('max-session-s', String(HARD_MAX_SESSION_S))),
    probeArgs: process.argv.slice(process.argv.indexOf('--probe-args') + 1)
      .filter(() => process.argv.includes('--probe-args'))
  }).then((r) => { tag(`${r.outcome}; record -> ${resolve(outDir, 'runtime-record.json')}`); })
    .catch((e) => { console.error(`[finale-window-runtime] FAILED: ${e.stack ?? e}`); process.exit(1); });
}
