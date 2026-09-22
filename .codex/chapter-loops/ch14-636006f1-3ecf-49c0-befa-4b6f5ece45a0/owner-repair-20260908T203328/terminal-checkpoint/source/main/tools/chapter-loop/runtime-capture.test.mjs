import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha } from './contract.mjs';
import { capture } from './legacy-capture.mjs';
import { runtimeConfig, deriveRuntimeRoute, describeRuntimeCapabilities, captureUrl, continuityProof, sinkOwnership, mediaProof, finalizeVideo, chapterWindowReady } from './runtime-capture.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'main/chapter-journey-contract.json')));
const route = deriveRuntimeRoute(manifest, 'ch13');
const config = runtimeConfig({ repo: root, config: { chapter: 'ch13' } });
const identity = { freshContext: true, storageInjected: false, url: captureUrl('http://127.0.0.1:1234/', config, route, 'continuity') };
function journey() {
  const beats = ['crawl', 'ch10-transit', 'done', ...route.beats, route.exitBeats[0]];
  return beats.map((beat, index) => ({ wallMs: 1000 + index * 1000,
    story: { runId: 1, beat, chapter: beat === 'crawl' ? 'prologue' : beat === 'done' ? 'complete' : beat.split('-')[0], active: beat !== 'done' },
    milestones: index === 0 ? ['story:started'] : index === beats.length - 1 ? [...route.entryMilestones, ...route.completionMilestones] : [...route.entryMilestones],
    preparation: null,
    autopilot: { beat, teleportNudgesTotal: 0, backstops: 0 },
  }));
}
const media = () => ({
  video: { decoded: true, frames: 100, durationSeconds: 4 }, audio: { decoded: true, durationSeconds: 4, rms: 0.02, peak: 0.2 },
  frames: Array.from({ length: 3 }, () => ({ meanLuma: 0.1, contrast: 0.1, nearBlack: 0.5 })),
  decodedFrames: Array.from({ length: 3 }, () => ({ meanLuma: 0.1, contrast: 0.1, nearBlack: 0.5 })),
  cleanup: { phase: 'post-finally', browserStopped: true, recorderStopped: true, moduleRemoved: true, defaultSinkUnchanged: true, previewIntact: true, sourceIntact: true, errors: [] },
  renderer: 'ANGLE (NVIDIA, NVIDIA RTX, OpenGL)', isolation: [{ ok: true }],
});

test('Chapter13 route derives predecessor, next chapter and earned receipts from the current contract', () => {
  assert.equal(route.priorChapter, 'ch10');
  assert.deepEqual(route.beats, ['ch13-home', 'ch13-return', 'ch13-survey', 'ch13-common']);
  assert.deepEqual(route.exitBeats, ['ch14-record']);
  assert.equal(route.terminal, false);
  assert.ok(route.completionMilestones.includes('story:ch13-complete'));
  assert.ok(route.entryMilestones.includes('story:ch12-bonded-cell-installed'));
});

test('capability derivation refuses unknown, unobservable and branching chapters', () => {
  assert.throws(() => deriveRuntimeRoute(manifest, 'ch999'), /absent/);
  const changed = structuredClone(manifest);
  changed.chapters.find(c => c.id === 'ch13').continuity.after = ['ch1', 'ch2'];
  assert.throws(() => deriveRuntimeRoute(changed, 'ch13'), /Branching/);
  changed.chapters.find(c => c.id === 'ch13').continuity.after = [];
  changed.chapters.find(c => c.id === 'ch13').objectives.at(-1).interaction.completionEvidenceRefs = ['state:unknown'];
  assert.throws(() => deriveRuntimeRoute(changed, 'ch13'), /observable completion/);
});

test('configuration and URL gates reject fixture injection before runtime launch', () => {
  for (const mutation of [{ storageState: {} }, { fixture: 'ch13' }, { route: 'direct-entry' }, { maxSessionSeconds: 1801 }, { sampleMs: 0 }, { profile: 'UNSAFE' }]) {
    assert.throws(() => runtimeConfig({ repo: root, config: { chapter: 'ch13', ...mutation } }));
  }
  for (const url of ['https://127.0.0.1/', 'http://example.com/', 'http://127.0.0.1/?debug=1', 'http://u:p@127.0.0.1/', 'http://127.0.0.1/#story']) {
    assert.throws(() => captureUrl(url, config, route, 'continuity'), /unadorned local/);
  }
  assert.equal(new URL(captureUrl('http://127.0.0.1/', config, route, 'av')).searchParams.get('story'), 'ch13-home');
  assert.equal(new URL(identity.url).searchParams.get('story'), '1');
});

test('legacy Chapter13 probe capabilities cannot be relabelled as a different chapter', t => {
  const legacy = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-chapter-')); t.after(() => fs.rmSync(legacy, { recursive: true, force: true }));
  fs.writeFileSync(path.join(legacy, 'scene-contract.json'), JSON.stringify({ scope: { beats: ['ch13-home', 'ch13-common'] } }));
  assert.throws(() => runtimeConfig({ repo: root, legacy, config: { chapter: 'ch14' } }), /does not match/);
  const result = describeRuntimeCapabilities({ repo: root, legacy, config: { chapter: 'ch10' }, checkTools: false });
  assert.equal(result.supported, false); assert.equal(result.bindings.manual, false); assert.equal(result.bindings.continuity, false);
});

test('chapter media starts only after scene-ready and the live movie beat agree', () => {
  const sample = { story: { beat: 'ch13-home' }, app: { phase: 'playing', sceneReady: true }, autopilot: { beat: 'ch13-home' } };
  assert.equal(chapterWindowReady(sample, route), true);
  for (const change of [s => { s.app.sceneReady = false; }, s => { s.app.phase = 'menu'; }, s => { s.autopilot = null; }, s => { s.autopilot.beat = 'crawl'; }]) {
    const changed = structuredClone(sample); change(changed); assert.equal(chapterWindowReady(changed, route), false);
  }
  // Actual failed trial handoff: playing+sceneReady became true at descent
  // while the movie mirror was still absent. That is not the Chapter13 audio
  // window and must not trigger a capture gesture during the canvas swap.
  const descent = { story: { active: true, chapter: 'ch1', beat: 'descent', runId: 1 },
    app: { phase: 'playing', sceneReady: true }, autopilot: null };
  assert.equal(chapterWindowReady(descent, route), false);
  descent.autopilot = { beat: 'descent' };
  assert.equal(chapterWindowReady(descent, route), false);
});

test('remote video artifact is saved after context flush while browser transport is alive', async () => {
  const events = []; let flushed = false, serverAlive = true;
  const context = { close: async () => { flushed = true; events.push('context-close'); } };
  const video = { saveAs: async file => { assert.equal(flushed, true); assert.equal(serverAlive, true); assert.equal(file, 'session.webm'); events.push('video-save'); } };
  await finalizeVideo(context, video, 'session.webm'); serverAlive = false; events.push('browser-close');
  assert.deepEqual(events, ['context-close', 'video-save', 'browser-close']);
  await assert.rejects(finalizeVideo({ close: async () => { throw new Error('flush failed'); } }, video, 'session.webm'), /flush failed/);
});

test('actual ordered predecessor, chapter and terminal receipt edges satisfy earned continuity', () => {
  const proof = continuityProof(journey(), route, identity);
  assert.equal(proof.earnedEntry, true); assert.equal(proof.earnedExit, true); assert.equal(proof.noFixtures, true);
});

test('the observed fresh crawl receipt is accepted while initial checkpoint hydration is refused', () => {
  const samples = journey();
  // Matches the real first sample: beginStory emits its receipt before the
  // renderer and movie mirror exist. No missing renderer is invented here.
  samples[0] = { ...samples[0], story: { active: true, chapter: 'prologue', beat: 'crawl', runId: 1 },
    app: null, milestones: ['story:started'], preparation: null, autopilot: null };
  const proof = continuityProof(samples, route, identity);
  assert.equal(proof.noFixtures, true); assert.equal(proof.earnedEntry, true); assert.equal(proof.earnedExit, true);
  for (const initial of [[], ['story:started', 'story:prologue-seen'], ['story:started', 'story:ch10-complete'],
    ['story:started', 'story:ch12-bonded-cell-installed'], ['story:started', 'story:started'], ['unknown']]) {
    const changed = structuredClone(samples); changed[0].milestones = initial;
    const rejected = continuityProof(changed, route, identity);
    assert.equal(rejected.noFixtures, false, JSON.stringify(initial)); assert.equal(rejected.earnedExit, false);
  }
});

test('fixture, hydration, prepared scenario, run reset, teleport and backstop traces cannot certify', () => {
  for (const change of [
    s => { s[0].story.beat = 'ch13-home'; },
    s => { s[0].milestones = ['story:ch10-complete']; },
    s => { s[2].preparation = { status: 'prepared' }; },
    s => { s[3].story.runId = 2; },
    s => { s[3].autopilot.teleportNudgesTotal = 1; },
    s => { s[3].autopilot.backstops = 1; },
    s => { delete s[3].autopilot.backstops; },
    s => { s[3].wallMs = s[2].wallMs; },
  ]) {
    const samples = journey(); change(samples); const proof = continuityProof(samples, route, identity);
    assert.equal(proof.noFixtures, false); assert.equal(proof.earnedExit, false);
  }
  for (const change of [{ freshContext: false }, { storageInjected: true }, { url: identity.url.replace('story=1', 'story=ch13-home') }, { url: `${identity.url}&debug=1` }]) {
    assert.equal(continuityProof(journey(), route, { ...identity, ...change }).earnedEntry, false);
  }
});

test('missing predecessor, entry install, intermediate beat or completion receipt fail earned proof', () => {
  const checks = [
    [s => { s[1].story.beat = 'other'; }, 'earnedEntry'],
    [s => { s[3].milestones = []; }, 'earnedEntry'],
    [s => { s[4].story.beat = 'skipped'; }, 'earnedExit'],
    [s => { s.at(-1).milestones = []; }, 'earnedExit'],
    [s => { s[3].milestones.push(...route.completionMilestones); }, 'earnedExit'],
  ];
  for (const [change, key] of checks) { const samples = journey(); change(samples); assert.equal(continuityProof(samples, route, identity)[key], false); }
});

test('terminal handback requires inactivity while a next-chapter exit remains active', () => {
  assert.equal(continuityProof(journey(), route, identity).earnedExit, true);
  const terminal={...route,terminal:true,exitBeats:['done']},samples=journey();
  samples.at(-1).story={...samples.at(-1).story,beat:'done',chapter:'complete',active:false};
  assert.equal(continuityProof(samples,terminal,identity).earnedExit,true);
  samples.at(-1).story.active=true;
  assert.equal(continuityProof(samples,terminal,identity).earnedExit,false);
});

test('audio isolation admits only streams descending from the exact browser PID', () => {
  const inputs = [{ index: 8, sink: 42, properties: { 'application.process.id': '102' } }];
  const parent = pid => ({ 102: 101, 101: 100 }[pid] ?? null);
  assert.equal(sinkOwnership(inputs, 42, 100, parent).ok, true);
  assert.equal(sinkOwnership(inputs, 41, 100, parent).ok, false);
  assert.equal(sinkOwnership(inputs, null, 100, parent).ok, false);
  assert.equal(sinkOwnership([...inputs, { index: 9, sink: 42, properties: { 'application.process.id': '900' } }], 42, 100, parent).ok, false);
  assert.equal(sinkOwnership([{ index: 9, sink: 42, properties: {} }], 42, 100, parent).ok, false);
});

test('decoded nonblank video and audible isolated score require all measured media facts', () => {
  assert.deepEqual(mediaProof(media()), { hardware: true, cleanup: true, videoDecodes: true, audioDecodes: true, framesNonblank: true });
  const checks = [
    [m => { m.video.decoded = false; }, 'videoDecodes'], [m => { m.video.frames = 0; }, 'videoDecodes'],
    [m => { m.audio.decoded = false; }, 'audioDecodes'], [m => { m.audio.rms = 0; }, 'audioDecodes'],
    [m => { m.audio.peak = 0; }, 'audioDecodes'], [m => { m.audio.durationSeconds = 0.5; }, 'audioDecodes'],
    [m => { m.minAudioSeconds = 12; }, 'audioDecodes'],
    [m => { m.isolation = []; }, 'audioDecodes'], [m => { m.isolation.push({ ok: false }); }, 'audioDecodes'],
    [m => { m.frames[0].meanLuma = 0; }, 'framesNonblank'], [m => { m.decodedFrames[0].contrast = 0; }, 'framesNonblank'],
    [m => { m.decodedFrames = []; }, 'framesNonblank'], [m => { m.renderer = 'ANGLE SwiftShader'; }, 'hardware'],
  ];
  for (const [change, key] of checks) { const data = media(); change(data); assert.equal(mediaProof(data)[key], false); }
});

test('every cleanup defect is inconclusive including source and preview replacement', () => {
  for (const key of ['browserStopped', 'recorderStopped', 'moduleRemoved', 'defaultSinkUnchanged', 'previewIntact', 'sourceIntact']) {
    const data = media(); data.cleanup[key] = false; assert.equal(mediaProof(data).cleanup, false, key);
  }
  const beforeFinally = media(); beforeFinally.cleanup.phase = 'running'; assert.equal(mediaProof(beforeFinally).cleanup, false);
  const errored = media(); errored.cleanup.errors.push('failed shutdown'); assert.equal(mediaProof(errored).cleanup, false);
});

test('static capability preflight retains exact blockers without creating a browser or output', async t => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-capabilities-')); t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  fs.mkdirSync(path.join(repo, 'main'), { recursive: true }); fs.writeFileSync(path.join(repo, 'main/chapter-journey-contract.json'), JSON.stringify(manifest));
  const result = describeRuntimeCapabilities({ repo, config: { chapter: 'ch13' }, checkTools: false });
  assert.equal(result.sourceIdentity, false); assert.equal(result.bindings.av, false); assert.equal(result.bindings.continuity, false);
  assert.match(result.capabilities.av.blockers.join(' '), /Exact source manifest/);
  assert.equal(fs.existsSync(path.join(repo, 'raw')), false);
  const out = path.join(repo, 'preflight');
  await assert.rejects(capture({ repo, out, kind: 'capabilities', config: { chapter: 'ch13' } }), /source manifest/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(out, 'capabilities.json'))).supported, false);
});

test('preflight checks source identity before allowing any capability', t => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-source-')); t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  fs.mkdirSync(path.join(repo, 'main'), { recursive: true }); fs.writeFileSync(path.join(repo, 'main/chapter-journey-contract.json'), JSON.stringify(manifest));
  fs.writeFileSync(path.join(repo, 'main/runtime.ts'), 'different');
  const result = describeRuntimeCapabilities({ repo, config: { chapter: 'ch13' }, checkTools: false,
    provenance: { sourceManifest: { hashes: { 'main/runtime.ts': sha('expected') } }, previewOwnership: { files: { 'index.html': sha('index') } } } });
  assert.equal(result.sourceIdentity, false); assert.match(result.capabilities.continuity.blockers.join(' '), /Source changed/);
});
