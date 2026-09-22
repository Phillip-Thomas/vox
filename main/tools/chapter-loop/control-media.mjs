/**
 * Owned audio/video recording for the ordinary-control transport.
 *
 * This module only carries evidence. It never touches the game, never sets
 * state and never produces an input: it opens a private PulseAudio null sink
 * that ONLY the browser it launched may feed, records that sink's monitor with
 * `parec`, and describes what the decoder could actually read back afterwards.
 *
 * It deliberately reuses `runtime-capture.mjs`'s isolation predicate rather
 * than restating it, so "the audio in this file came from this browser" means
 * exactly the same thing in a control capture as it does in an AV capture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { requireThat } from './contract.mjs';
import { sinkOwnership } from './runtime-capture.mjs';

export { sinkOwnership };

/** Manual play may omit media; an interruption/resume case may not. */
export const MEDIA_CASES = new Set(['recovery', 'continue']);
export const mediaRequested = (kind, override) => override === undefined ? MEDIA_CASES.has(kind) : Boolean(override);

/** Minimum decodable audio: the retained final tail alone must survive decode. */
export const MIN_AUDIO_SECONDS = 8;
/** Held silence around the interruption so a reviewer can hear the pause itself. */
export const PAUSED_HOLD_MS = 3_000;
/** Retained tail after the post-recovery action, for handback and score decay. */
export const FINAL_TAIL_MS = 8_000;

export const CLOCK_NOTE =
  'Offsets are host wall-clock differences between the recorder/context start and the observed gesture. '
  + 'The Playwright video timeline is frame-driven and the parec stream begins only after process spawn plus '
  + 'PulseAudio scheduling latency (unmeasured here). Audio and video are two '
  + 'independent recordings and are NOT muxed or sample-aligned: treat every offset as approximate guidance for '
  + 'seeking (order is reliable, absolute position is not), never as a synchronization claim.';

const runDefault = (name, args, options = {}) =>
  execFileSync(name, args, { encoding: 'utf8', timeout: 30_000, maxBuffer: 8 * 1024 * 1024, ...options });

export const alive = pid => {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; }
};
export function parentOf(pid) {
  try {
    const text = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    return Number(text.slice(text.lastIndexOf(')') + 2).split(' ')[1]);
  } catch { return null; }
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** SIGINT first so `parec` flushes its WAV header/length, SIGKILL only as a backstop. */
export async function stopChild(child, { wait = sleep } = {}) {
  if (!child) return true;
  if (child.exitCode !== null || child.signalCode !== null) return true;
  child.kill('SIGINT');
  for (let i = 0; i < 50 && child.exitCode === null && child.signalCode === null; i++) await wait(100);
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  for (let i = 0; i < 20 && alive(child.pid); i++) await wait(100);
  return !alive(child.pid);
}

/**
 * A null sink owned by this process alone. The system default sink is read for
 * comparison and never written: nothing here changes what the machine plays to.
 */
export function openOwnedSink({ run = runDefault, id = randomUUID().slice(0, 8) } = {}) {
  const sinkName = `paravoxia_control_${process.pid}_${id}`;
  const defaultSinkBefore = run('pactl', ['get-default-sink']).trim();
  const moduleId = run('pactl', ['load-module', 'module-null-sink',
    `sink_name=${sinkName}`, `sink_properties=device.description=${sinkName}`]).trim();
  requireThat(/^\d+$/.test(moduleId), 'Invalid owned audio module id');
  try {
    const sinks = JSON.parse(run('pactl', ['--format=json', 'list', 'sinks'])).filter(s => s.name === sinkName);
    requireThat(sinks.length === 1 && Number.isInteger(sinks[0].index), 'Owned audio sink index is ambiguous');
    return { sinkName, sinkIndex: sinks[0].index, moduleId, monitor: `${sinkName}.monitor`, defaultSinkBefore, defaultChanged: false };
  } catch (error) {
    // The caller cannot clean up an object that setup never returned.
    try { run('pactl', ['unload-module', moduleId]); }
    catch (cleanup) { throw new Error(`${error.message}; owned sink cleanup failed: ${cleanup.message}`); }
    throw error;
  }
}

export function closeOwnedSink(device, { run = runDefault } = {}) {
  if (!device) return { moduleRemoved: true, defaultSinkUnchanged: true, defaultSinkAfter: null };
  run('pactl', ['unload-module', device.moduleId]);
  const moduleRemoved = !JSON.parse(run('pactl', ['--format=json', 'list', 'modules']))
    .some(m => String(m.index) === String(device.moduleId));
  const defaultSinkAfter = run('pactl', ['get-default-sink']).trim();
  return { moduleRemoved, defaultSinkAfter, defaultSinkUnchanged: defaultSinkAfter === device.defaultSinkBefore };
}

/** Read live ownership of the owned sink. Any stream that is not a descendant
 * of the browser we launched is a foreign voice in this recording. */
export function readOwnership(device, browserPid, { run = runDefault, parent = parentOf } = {}) {
  const inputs = JSON.parse(run('pactl', ['--format=json', 'list', 'sink-inputs']));
  return sinkOwnership(inputs, device.sinkIndex, browserPid, parent);
}

export function startAudioRecorder({ device, file, logFile, spawnFn = spawn, onError = () => {} }) {
  const child = spawnFn('parec', ['-d', device.monitor, '--rate=48000', '--channels=2', '--format=s16le',
    '--file-format=wav', file], { stdio: ['ignore', 'ignore', 'pipe'] });
  child.on('error', error => onError(`Recorder: ${error.message}`));
  if (logFile && child.stderr) child.stderr.on('data', chunk => { try { fs.appendFileSync(logFile, chunk); } catch { /* best effort */ } });
  return child;
}

/** Bytes flushed so far, minus a conservative container allowance. Wall time
 * alone overstates captured audio; the decoder below is the real answer. */
export function recordedSeconds(file) {
  if (!fs.existsSync(file)) return 0;
  return Math.max(0, fs.statSync(file).size - 4096) / (48_000 * 2 * 2);
}

/** Decode what was written. A file that exists is not evidence; a file the
 * decoder can read end to end, with measurable level, is. */
export function decodeControlMedia({ videoFile, audioFile, run = runDefault } = {}) {
  const video = { decoded: false, path: videoFile ? path.basename(videoFile) : null };
  const audio = { decoded: false, path: audioFile ? path.basename(audioFile) : null };
  if (videoFile && fs.existsSync(videoFile)) {
    try {
      const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0',
        '-show_entries', 'stream=codec_name,nb_read_frames:format=duration', '-of', 'json', videoFile], { timeout: 120_000 }));
      run('ffmpeg', ['-v', 'error', '-xerror', '-i', videoFile, '-map', '0:v:0', '-f', 'null', '-'], { timeout: 120_000 });
      Object.assign(video, { decoded: true, frames: Number(probe.streams?.[0]?.nb_read_frames),
        durationSeconds: Number(probe.format?.duration), probe });
    } catch (error) { video.error = error.message; }
  } else video.error = 'No video recording was written';
  if (audioFile && fs.existsSync(audioFile)) {
    try {
      const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-show_entries',
        'stream=codec_name,sample_rate,channels:format=duration', '-of', 'json', audioFile], { timeout: 60_000 }));
      const pcm = run('ffmpeg', ['-v', 'error', '-xerror', '-i', audioFile, '-map', '0:a:0', '-ac', '1', '-ar', '8000', '-f', 'f32le', '-'],
        { encoding: 'buffer', maxBuffer: 80 * 1024 * 1024, timeout: 120_000 });
      let sum = 0, peak = 0;
      const count = Math.floor(pcm.length / 4);
      for (let i = 0; i < count; i++) {
        const value = pcm.readFloatLE(i * 4);
        requireThat(Number.isFinite(value), 'Invalid decoded audio sample');
        sum += value * value; peak = Math.max(peak, Math.abs(value));
      }
      Object.assign(audio, { decoded: count > 0, durationSeconds: Number(probe.format?.duration),
        rms: count ? Math.sqrt(sum / count) : 0, peak, probe });
    } catch (error) { audio.error = error.message; }
  } else audio.error = 'No audio recording was written';
  return { video, audio };
}

/**
 * The media obligation. Silence is never waived here: an all-zero WAV proves
 * the transport ran, not that the game made a sound a reviewer could judge.
 */
export function controlMediaProof({ video, audio, isolation = [], mediaCleanup = {}, minAudioSeconds = MIN_AUDIO_SECONDS } = {}) {
  // A page reload can close the old audio stream before Continue creates a new
  // one. The private monitor keeps recording that gap. Require owned output
  // to return by the final tail, and reject foreign audio at every sample.
  const firstOwned = isolation.findIndex(s => s.ok === true);
  const owned = firstOwned >= 0
    && isolation.every(s => (s.foreign?.length ?? 0) === 0)
    && isolation.at(-1).ok === true;
  const videoDecodes = video?.decoded === true && video.frames > 0 && video.durationSeconds > 0;
  const audioDecodes = audio?.decoded === true && audio.durationSeconds >= minAudioSeconds
    && audio.rms > 0.00001 && audio.peak > 0.0001;
  const mediaCleanup_ = mediaCleanup.recorderStopped === true && mediaCleanup.moduleRemoved === true
    && mediaCleanup.defaultSinkUnchanged === true;
  return { videoDecodes, audioDecodes, audioIsolated: owned, mediaCleanup: mediaCleanup_,
    mediaCaptured: Boolean(videoDecodes && audioDecodes && owned && mediaCleanup_) };
}

/** Why a media obligation failed, in the reviewer's words. */
export function mediaProblems(proof, { video, audio, isolation = [] } = {}) {
  const problems = [];
  if (!proof.videoDecodes) problems.push(`Control video did not decode: ${video?.error ?? 'no readable frames'}`);
  if (!proof.audioDecodes) problems.push(`Control audio did not decode as audible: ${audio?.error
    ?? `duration=${audio?.durationSeconds ?? 0}s rms=${audio?.rms ?? 0} peak=${audio?.peak ?? 0}`}`);
  if (!proof.audioIsolated) problems.push(isolation.some(s => s.ok === true)
    ? 'Audio was foreign or the browser output did not return by the final tail'
    : 'No owned audio stream was ever observed on the capture sink');
  if (!proof.mediaCleanup) problems.push('Owned recorder/sink cleanup was not proved');
  return problems;
}

/**
 * Map gestures onto both recordings. Order is trustworthy; absolute position
 * is approximate, and CLOCK_NOTE says so in the artifact itself.
 */
export function mediaTimeline({ marks = [], audioStartedAtWallMs = null, audioStoppedAtWallMs = null,
  videoStartedAtWallMs = null, videoStoppedAtWallMs = null } = {}) {
  const offset = (start, at) => Number.isFinite(start) && Number.isFinite(at) && at >= start
    ? Number(((at - start) / 1000).toFixed(3)) : null;
  return {
    clock: 'host wall clock (Date.now)',
    alignment: 'approximate; audio and video are separate unsynchronized recordings',
    uncertainty: CLOCK_NOTE,
    audio: { startedAtWallMs: audioStartedAtWallMs, stoppedAtWallMs: audioStoppedAtWallMs },
    video: { startedAtWallMs: videoStartedAtWallMs, stoppedAtWallMs: videoStoppedAtWallMs },
    marks: [...marks].sort((a, b) => a.wallMs - b.wallMs).map(mark => ({
      ...mark,
      audioOffsetSeconds: offset(audioStartedAtWallMs, mark.wallMs),
      videoOffsetSeconds: offset(videoStartedAtWallMs, mark.wallMs)
    }))
  };
}

/** Chromium must be able to make a sound and must send it to the owned sink only. */
export function audibleLaunchArgs(args) {
  return [...args.filter(arg => !['--mute-audio', '--enable-unsafe-swiftshader'].includes(arg)), '--enable-gpu', '--use-angle=gl'];
}
export function audibleLaunchEnv(env, device) {
  return { ...env, DISPLAY: env.DISPLAY ?? ':0', PULSE_SINK: device.sinkName };
}
