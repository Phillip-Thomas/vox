import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { mediaRequested, openOwnedSink, closeOwnedSink, readOwnership, decodeControlMedia, controlMediaProof,
  mediaProblems, mediaTimeline, audibleLaunchArgs, audibleLaunchEnv, recordedSeconds, stopChild,
  MIN_AUDIO_SECONDS } from './control-media.mjs';

const sinkListing = (name, index) => JSON.stringify([{ name, index }]);
function fakePactl({ moduleId = '77', sinkName = null, defaultAfter = null, modulesAfter = [] } = {}) {
  const calls = [];
  let created = sinkName;
  const run = (bin, args) => {
    calls.push([bin, ...args].join(' '));
    if (args[0] === 'get-default-sink') return `${calls.filter(c => c.includes('get-default-sink')).length > 1 && defaultAfter ? defaultAfter : 'system.default'}\n`;
    if (args[0] === 'load-module') { created = args.find(a => a.startsWith('sink_name='))?.slice('sink_name='.length) ?? created; return `${moduleId}\n`; }
    if (args.includes('sinks')) return sinkListing(created ?? 'x', 5);
    if (args.includes('modules')) return JSON.stringify(modulesAfter);
    if (args.includes('sink-inputs')) return JSON.stringify([]);
    return '';
  };
  return { run, calls };
}

test('an owned sink is created privately and never becomes the system default', () => {
  const { run, calls } = fakePactl();
  const device = openOwnedSink({ run, id: 'abcd1234' });
  assert.match(device.sinkName, /^paravoxia_control_\d+_abcd1234$/);
  assert.equal(device.monitor, `${device.sinkName}.monitor`);
  assert.equal(device.defaultSinkBefore, 'system.default');
  assert.ok(!calls.some(c => c.includes('set-default-sink') || c.includes('move-sink-input')));
  // The named sink has to resolve to exactly one index, or ownership is unprovable.
  assert.throws(() => openOwnedSink({ run: (bin, args) => args.includes('sinks') ? '[]' : run(bin, args), id: 'x' }), /ambiguous/);
  assert.throws(() => openOwnedSink({ run: (bin, args) => args[0] === 'load-module' ? 'not-a-module\n' : run(bin, args), id: 'y' }), /module id/);
});

test('cleanup proves the module went away and the default output is untouched', () => {
  const clean = fakePactl();
  const device = openOwnedSink({ run: clean.run, id: 'a1' });
  assert.deepEqual(closeOwnedSink(device, { run: clean.run }),
    { moduleRemoved: true, defaultSinkAfter: 'system.default', defaultSinkUnchanged: true });
  const leaked = fakePactl({ modulesAfter: [{ index: 77 }], defaultAfter: 'someone.elses.sink' });
  const other = openOwnedSink({ run: leaked.run, id: 'a2' });
  const result = closeOwnedSink(other, { run: leaked.run });
  assert.equal(result.moduleRemoved, false);
  assert.equal(result.defaultSinkUnchanged, false);
});

test('ownership reads only descendants of the browser we launched', () => {
  const inputs = [
    { index: 1, sink: 5, properties: { 'application.process.id': '900' } },
    { index: 2, sink: 5, properties: { 'application.process.id': '4242' } },
  ];
  const run = () => JSON.stringify(inputs);
  const parent = pid => ({ 900: 800, 800: 100, 4242: 1 })[pid] ?? 1;
  const owned = readOwnership({ sinkIndex: 5 }, 100, { run, parent });
  assert.deepEqual(owned.foreign, [2]);
  assert.equal(owned.ok, false);
  const only = readOwnership({ sinkIndex: 5 }, 100, { run: () => JSON.stringify([inputs[0]]), parent });
  assert.equal(only.ok, true);
});

test('media is required for interruption cases and optional for manual play', () => {
  assert.equal(mediaRequested('recovery'), true);
  assert.equal(mediaRequested('continue'), true);
  assert.equal(mediaRequested('manual'), false);
  assert.equal(mediaRequested('recovery', false), false);
});

test('decoding reports missing or unreadable media instead of throwing', () => {
  const missing = decodeControlMedia({ videoFile: '/nonexistent/video.webm', audioFile: '/nonexistent/audio.wav' });
  assert.equal(missing.video.decoded, false);
  assert.equal(missing.audio.decoded, false);
  assert.match(missing.audio.error, /No audio recording/);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'control-media-'));
  const videoFile = path.join(dir, 'video.webm'), audioFile = path.join(dir, 'audio.wav');
  fs.writeFileSync(videoFile, 'x'); fs.writeFileSync(audioFile, 'x');
  const pcm = Buffer.alloc(4 * 16); for (let i = 0; i < 16; i++) pcm.writeFloatLE(0.5, i * 4);
  const run = (bin, args) => {
    if (bin === 'ffprobe' && args.includes('v:0')) return JSON.stringify({ streams: [{ nb_read_frames: '120' }], format: { duration: '12.5' } });
    if (bin === 'ffprobe') return JSON.stringify({ streams: [{ sample_rate: '48000' }], format: { duration: '12.0' } });
    if (bin === 'ffmpeg' && args.includes('f32le')) return pcm;
    return '';
  };
  const decoded = decodeControlMedia({ videoFile, audioFile, run });
  assert.equal(decoded.video.frames, 120);
  assert.equal(decoded.audio.decoded, true);
  assert.equal(decoded.audio.peak, 0.5);

  const broken = decodeControlMedia({ videoFile, audioFile, run: (bin, args) => { if (bin === 'ffmpeg') throw new Error('moov atom not found'); return run(bin, args); } });
  assert.equal(broken.video.decoded, false);
  assert.match(broken.video.error, /moov atom/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('silence, truncation, shared sinks and unproved cleanup never pass as audible evidence', () => {
  const good = {
    video: { decoded: true, frames: 100, durationSeconds: 20 },
    audio: { decoded: true, durationSeconds: 20, rms: 0.03, peak: 0.4 },
    isolation: [{ ok: false, foreign: [] }, { ok: true, foreign: [] }, { ok: true, foreign: [] }],
    mediaCleanup: { recorderStopped: true, moduleRemoved: true, defaultSinkUnchanged: true }
  };
  assert.equal(controlMediaProof(good).mediaCaptured, true);
  // A stream that only appears once the game starts playing is expected.
  assert.equal(controlMediaProof({ ...good, isolation: [{ ok: false, foreign: [] }] }).audioIsolated, false);
  // Reload can close the stream; the final tail must have owned output again.
  assert.equal(controlMediaProof({ ...good, isolation: [{ ok: true, foreign: [] }, { ok: false, foreign: [] }, { ok: true, foreign: [] }] }).audioIsolated, true);
  assert.equal(controlMediaProof({ ...good, isolation: [{ ok: true, foreign: [] }, { ok: false, foreign: [] }] }).audioIsolated, false);
  assert.equal(controlMediaProof({ ...good, isolation: [{ ok: true, foreign: [9] }] }).audioIsolated, false);
  const silent = controlMediaProof({ ...good, audio: { decoded: true, durationSeconds: 20, rms: 0, peak: 0 } });
  assert.equal(silent.audioDecodes, false);
  assert.equal(silent.mediaCaptured, false);
  const short = controlMediaProof({ ...good, audio: { ...good.audio, durationSeconds: MIN_AUDIO_SECONDS - 0.5 } });
  assert.equal(short.audioDecodes, false);
  assert.equal(controlMediaProof({ ...good, video: { decoded: true, frames: 0, durationSeconds: 20 } }).videoDecodes, false);
  assert.equal(controlMediaProof({ ...good, mediaCleanup: { recorderStopped: true, moduleRemoved: false, defaultSinkUnchanged: true } }).mediaCleanup, false);
  assert.equal(controlMediaProof().mediaCaptured, false);
  assert.equal(mediaProblems(silent, { ...silent, ...good }).length > 0, true);
});

test('the timeline orders gestures on both recordings and states its uncertainty', () => {
  const timeline = mediaTimeline({
    audioStartedAtWallMs: 1_000, audioStoppedAtWallMs: 40_000,
    videoStartedAtWallMs: 500, videoStoppedAtWallMs: 41_000,
    marks: [{ mark: 'new-action-start', wallMs: 20_000 }, { mark: 'interruption', wallMs: 5_000 }, { mark: 'early', wallMs: 700 }]
  });
  assert.deepEqual(timeline.marks.map(m => m.mark), ['early', 'interruption', 'new-action-start']);
  assert.equal(timeline.marks[1].audioOffsetSeconds, 4);
  assert.equal(timeline.marks[1].videoOffsetSeconds, 4.5);
  // A mark taken before a recording began has no position in it, and says so.
  assert.equal(timeline.marks[0].audioOffsetSeconds, null);
  assert.equal(timeline.marks[0].videoOffsetSeconds, 0.2);
  assert.match(timeline.uncertainty, /NOT muxed or sample-aligned/);
  assert.equal(mediaTimeline({ marks: [{ mark: 'x', wallMs: 1 }] }).marks[0].audioOffsetSeconds, null);
});

test('an audible launch unmutes only the owned sink and keeps the hardware GL proof', () => {
  const args = audibleLaunchArgs(['--mute-audio', '--enable-unsafe-swiftshader', '--no-sandbox', '--use-gl=angle']);
  assert.ok(!args.includes('--mute-audio') && !args.includes('--enable-unsafe-swiftshader'));
  assert.ok(args.includes('--enable-gpu') && args.includes('--use-angle=gl') && args.includes('--no-sandbox'));
  const env = audibleLaunchEnv({ PATH: '/bin' }, { sinkName: 'owned' });
  assert.equal(env.PULSE_SINK, 'owned');
  assert.equal(env.DISPLAY, ':0');
});

test('recorded seconds discount the container header and a missing file', () => {
  assert.equal(recordedSeconds('/nonexistent/audio.wav'), 0);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'control-media-'));
  const file = path.join(dir, 'a.wav');
  fs.writeFileSync(file, Buffer.alloc(4096 + 48_000 * 2 * 2));
  assert.equal(recordedSeconds(file), 1);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the recorder is stopped, and a stopped recorder stays stopped', async () => {
  const child = spawn('sleep', ['30']);
  await new Promise(resolve => child.once('spawn', resolve));
  assert.equal(await stopChild(child), true);
  assert.equal(await stopChild(child), true);
  assert.equal(await stopChild(null), true);
});

test('sink setup cleans up its loaded module if discovery fails before returning ownership', () => {
  const calls = [];
  const run = (_name, args) => {
    calls.push(args);
    if (args[0] === 'get-default-sink') return 'original';
    if (args[0] === 'load-module') return '42';
    if (args.includes('sinks')) throw new Error('discovery failed');
    if (args[0] === 'unload-module') return '';
    throw new Error('Unexpected command');
  };
  assert.throws(() => openOwnedSink({ run, id: 'fixture' }), /discovery failed/);
  assert.deepEqual(calls.at(-1), ['unload-module', '42']);
});
