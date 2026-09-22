// Runtime evidence transport, not a chapter driver. Only the shipped movie
// controls advance play. Observation never prepares a scenario or writes state.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { requireThat, sha } from './contract.mjs';
import { inside, readJson, writeJson, reference } from './store.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const ROLES = {
  manual: 'verifier/probes/manual-credit-finale/grounded-recovery-candidate/common-entry-crossing-probe.mjs',
  recovery: 'verifier/probes/manual-credit-finale/finale-cancellation-candidate/finale-window-runtime.mjs',
  continue: 'verifier/probes/continue-spawn-candidate/earned-continue-3d-probe.mjs',
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function bounded(promise, ms, label) {
  let timer;
  // THE LOSER OF THE RACE STILL SETTLES. When the timeout wins, or when a
  // teardown step has already moved on, the wrapped Playwright promise can
  // reject later with nobody listening — an unhandled rejection, which Node
  // turns into an uncaught exception and kills the process. On 2026-09-21 a
  // complete earned ch14 continuity run reached its exit receipt and then died
  // with `TargetClosedError` during teardown, so no report was ever written.
  // Attaching an inert handler cannot change what this function returns: the
  // race still sees the real settlement.
  const raced = Promise.resolve(promise);
  raced.catch(() => { /* reported by whoever awaited the race */ });
  try { return await Promise.race([raced, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms); })]); }
  finally { clearTimeout(timer); }
}
const hardware = renderer => typeof renderer === 'string' && /NVIDIA|AMD|Intel|Apple/i.test(renderer) && !/swiftshader|software|llvmpipe/i.test(renderer);
const command = (name, args, options = {}) => execFileSync(name, args, { encoding: 'utf8', timeout: 15_000, maxBuffer: 8 * 1024 * 1024, ...options });
const pactl = args => command('pactl', args);

export function runtimeConfig({ repo, legacy, config = {} }) {
  if (typeof config === 'string') config = readJson(inside(repo, config));
  const known = ['chapter', 'maxSessionSeconds', 'sampleMs', 'avSeconds', 'profile', 'route', 'avStartBeat', 'sourceManifest', 'previewOwnership', 'manifest'];
  requireThat(config && typeof config === 'object' && Object.keys(config).every(k => known.includes(k)), 'Unknown runtime capture configuration field (fixtures and storage injection are unsupported)');
  let chapter = config.chapter;
  if (legacy) {
    const contract = readJson(path.join(legacy, 'scene-contract.json'));
    const legacyChapters = [...new Set((contract.scope?.beats ?? []).filter(b => /^ch\d+-/.test(b)).map(b => b.split('-')[0]))];
    requireThat(legacyChapters.length === 1 && (!chapter || chapter === legacyChapters[0]), 'Legacy probe chapter does not match the requested chapter');
    chapter ??= legacyChapters[0];
  }
  requireThat(typeof chapter === 'string', 'Runtime capture chapter required');
  const result = { chapter, maxSessionSeconds: 900, sampleMs: 250, avSeconds: 12, profile: 'HIGH', route: 'fresh-movie', ...config };
  for (const [key, min, max] of [['maxSessionSeconds', 10, 3600], ['sampleMs', 50, 1000], ['avSeconds', 3, 60]]) {
    requireThat(Number.isInteger(result[key]) && result[key] >= min && result[key] <= max, `${key} must be an integer in ${min}..${max}`);
  }
  requireThat(result.route === 'fresh-movie', 'Earned continuity requires a fresh movie route; injected saves and fixtures are unsupported');
  requireThat(['HIGH', 'MEDIUM', 'LOW', 'POTATO'].includes(result.profile), 'Unsupported capture profile');
  return result;
}

export function deriveRuntimeRoute(manifest, chapter) {
  const c = manifest.chapters?.find(c => c.id === chapter);
  requireThat(c, `Chapter ${chapter} is absent from the journey contract`);
  const beats = c.registryProjection?.requiredObjectiveBeats;
  requireThat(Array.isArray(beats) && beats.length > 0, `Chapter ${chapter} has no declared objective beats`);
  const previous = c.continuity?.before;
  requireThat(previous?.length === 1, 'Continuity requires one explicit predecessor');
  const prior = manifest.chapters.find(c => c.id === previous[0]);
  const priorBeats = prior?.registryProjection?.requiredObjectiveBeats;
  requireThat(priorBeats?.length > 0, 'Predecessor objective beats unavailable');
  const next = c.continuity.after;
  requireThat(Array.isArray(next) && next.length <= 1, 'Branching exits need an explicit runtime binding');
  const finalObjective = c.objectives?.find(o => o.beat === beats.at(-1));
  const milestones = (finalObjective?.interaction?.completionEvidenceRefs ?? []).filter(s => s.startsWith('milestone:')).map(s => s.slice('milestone:'.length));
  requireThat(milestones.length > 0, 'Final objective lacks observable completion milestones');
  const exitBeats = next.length ? manifest.chapters.find(c => c.id === next[0])?.registryProjection?.requiredObjectiveBeats?.slice(0, 1) : ['done'];
  requireThat(exitBeats?.length === 1, 'Exit beat is not declared');
  return { chapter, priorChapter: prior.id, priorBeats, beats, exitBeats, completionMilestones: milestones,
    // ch13 reactivates from free play after a physical station return and install.
    // These are durable public receipts, never a substitute for observing ch10.
    entryMilestones: chapter === 'ch13' ? ['story:ch10-complete', 'story:ch12-bonded-cell-installed'] : [],
    terminal: next.length === 0, manifestSha256: sha(manifest) };
}

function sourceIdentity({ repo, legacy, config, provenance }) {
  const sourceFile = config.sourceManifest ? inside(repo, config.sourceManifest) : legacy ? path.join(legacy, 'implementation-source-manifest.json') : null;
  const source = sourceFile ? readJson(sourceFile) : provenance?.sourceManifest;
  requireThat(source && Object.keys(source.hashes ?? {}).length > 0, 'Exact source manifest with file hashes required');
  for (const [file, expected] of Object.entries(source.hashes)) {
    requireThat(sha(fs.readFileSync(inside(repo, file))) === expected, `Source changed: ${file}`);
  }
  const ownershipFile = config.previewOwnership ? inside(repo, config.previewOwnership) : legacy ? path.join(legacy, 'verifier/artifacts/preview-ownership.json') : null;
  const ownership = ownershipFile ? readJson(ownershipFile) : provenance?.previewOwnership;
  requireThat(ownership?.files?.['index.html'], 'Exact preview build ownership manifest required');
  const sourceManifestSha256 = sourceFile ? sha(fs.readFileSync(sourceFile)) : sha(source);
  requireThat(!ownership.sourceManifestSha256 || ownership.sourceManifestSha256 === sourceManifestSha256, 'Preview was built from a different source manifest');
  return { source, ownership, sourceManifestSha256, buildSha256: sha(ownership.files) };
}

/** Synchronous, no-browser preflight. Calling this never launches a model, GPU,
 * preview or recorder. A capability means the transport is available, not that
 * an unmeasured chapter has passed or can finish inside its allotted time. */
export function describeRuntimeCapabilities({ repo = ROOT, legacy, config = {}, provenance, checkTools = true } = {}) {
  const blockers = []; let normalized, route, identity;
  try {
    normalized = runtimeConfig({ repo, legacy, config });
    const manifest = readJson(inside(repo, normalized.manifest ?? 'main/chapter-journey-contract.json'));
    route = deriveRuntimeRoute(manifest, normalized.chapter);
    requireThat(!normalized.avStartBeat || route.beats.includes(normalized.avStartBeat), 'AV start beat is outside the declared chapter');
    identity = sourceIdentity({ repo, legacy, config: normalized, provenance });
    for (const file of ['main/tools/lib/evidence.mjs', 'main/tools/lib/previewServer.mjs', 'main/src/story/JourneyRuntimeProbeBridge.tsx', 'main/src/story/autopilot/primitives.ts']) {
      requireThat(fs.existsSync(path.join(repo, file)), `Runtime dependency missing: ${file}`);
    }
    require.resolve('playwright-core');
    if (checkTools) {
      for (const tool of ['ffmpeg', 'ffprobe']) command(tool, ['-version']);
      command('pactl', ['info']); command('parec', ['--version']);
      requireThat(fs.existsSync(process.env.CHROME_PATH ?? '/snap/bin/chromium'), 'Chromium executable unavailable');
      requireThat(process.env.PARAVOXIA_ALLOW_SWIFTSHADER !== '1', 'Software rendering cannot certify this capture');
    }
  } catch (error) { blockers.push(error.message); }
  const capabilities = {};
  for (const [kind, entry] of Object.entries(ROLES)) {
    const missing = legacy && fs.existsSync(path.join(legacy, entry)) ? [] : [`Legacy ${kind} probe binding unavailable`];
    capabilities[kind] = { supported: missing.length === 0 && blockers.length === 0, blockers: [...blockers, ...missing] };
  }
  for (const kind of ['av', 'continuity']) capabilities[kind] = { supported: blockers.length === 0, blockers: [...blockers] };
  return { schema: 'paravoxia.runtimeCaptureCapabilities.v1', chapter: normalized?.chapter ?? null, supported: Object.values(capabilities).every(c => c.supported),
    sourceIdentity: Boolean(identity), bindings: Object.fromEntries(Object.entries(capabilities).map(([k, c]) => [k, c.supported])),
    capabilities, config: normalized ?? null, route: route ?? null,
    sourceManifestSha256: identity?.sourceManifestSha256 ?? null, buildSha256: identity?.buildSha256 ?? null,
    media: [{ kind: 'video', path: 'video.webm' }, { kind: 'audio', path: 'audio.wav' }, { kind: 'frame', path: 'frame.png' }],
    note: 'Static availability only. Fresh continuity can time out before reaching the chapter; only observed earned edges satisfy it.' };
}

export function captureUrl(preview, config, route, kind) {
  const url = new URL(preview);
  requireThat(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && !url.username && !url.password && !url.search && !url.hash, 'Capture preview must be an unadorned local HTTP URL');
  url.searchParams.set('story', kind === 'continuity' ? '1' : config.avStartBeat ?? route.beats[0]);
  url.searchParams.set('movie', '1'); url.searchParams.set('journeyprobe', '1');
  url.searchParams.set('journeylane', kind === 'continuity' ? 'continuous' : 'direct-entry');
  url.searchParams.set('journeymode', 'movie'); url.searchParams.set('profile', config.profile);
  return url.href;
}

export function continuityProof(samples, route, { url, freshContext, storageInjected = false } = {}) {
  let allowedUrl = false;
  try {
    const params = new URL(url).searchParams;
    const allowed = new Set(['story', 'movie', 'journeyprobe', 'journeylane', 'journeymode', 'profile']);
    allowedUrl = params.get('story') === '1' && params.get('movie') === '1' && params.get('journeylane') === 'continuous' && [...params.keys()].every(k => allowed.has(k));
  } catch { /* invalid evidence */ }
  const validSamples = samples.length > 2 && samples.every(s => Number.isFinite(s.wallMs) && s.story && Number.isInteger(s.story.runId)
    && Array.isArray(s.milestones) && Object.hasOwn(s, 'preparation') && Object.hasOwn(s, 'autopilot'));
  const ordered = validSamples && samples.every((s, i) => i === 0 || s.wallMs > samples[i - 1].wallMs);
  const noFixtures = Boolean(freshContext && !storageInjected && allowedUrl && ordered
    // restartStory clears prior Story progress, then beginStory always emits
    // exactly this receipt before publishing crawl. It is fresh-start evidence,
    // not a hydrated checkpoint; every other initial milestone is refused.
    && samples[0].story.beat === 'crawl' && samples[0].milestones.length === 1 && samples[0].milestones[0] === 'story:started'
    && samples.every(s => s.preparation == null && s.story.runId === samples[0].story.runId
      && (!s.autopilot || s.autopilot.teleportNudgesTotal === 0 && s.autopilot.backstops === 0)));
  const prior = samples.findIndex(s => route.priorBeats.includes(s.story?.beat));
  const entry = samples.findIndex((s, i) => i > prior && s.story?.beat === route.beats[0]);
  const entryReceipt = entry >= 0 && route.entryMilestones.every(m => samples[entry].milestones?.includes(m));
  const earnedEntry = noFixtures && prior >= 0 && entry > prior && entryReceipt && Boolean(samples[prior].autopilot && samples[entry].autopilot);
  let cursor = entry;
  const beatIndices = route.beats.map(beat => {
    const index = samples.findIndex((s, i) => i >= cursor && s.story?.beat === beat);
    cursor = index < 0 ? samples.length : index + 1;
    return index;
  });
  const exit = samples.findIndex((s, i) => i > (beatIndices.at(-1) ?? samples.length) && route.exitBeats.includes(s.story?.beat)
    && route.completionMilestones.every(m => s.milestones?.includes(m))
    && (!route.terminal || s.story.active === false));
  const beforeCompletion = entry >= 0 && !route.completionMilestones.every(m => samples[entry].milestones?.includes(m));
  // Diagnostic AV may begin at a chapter checkpoint, but its ending still has
  // to be newly earned, in order, without a run reset or target-window nudge.
  const window = entry >= 0 && exit > entry ? samples.slice(entry, exit + 1) : [];
  const chapterWindowComplete = Boolean(ordered && beforeCompletion && beatIndices.every(i => i >= 0) && window.length
    && Number.isFinite(samples[entry].autopilot?.teleportNudgesTotal) && Number.isFinite(samples[entry].autopilot?.backstops)
    && window.every((s, i) => s.story.runId === samples[entry].story.runId && s.preparation == null
      && ((!s.autopilot && route.terminal && i === window.length - 1 && s.story.active === false)
        || s.autopilot && s.autopilot.teleportNudgesTotal === samples[entry].autopilot.teleportNudgesTotal
          && s.autopilot.backstops === samples[entry].autopilot.backstops)));
  return { earnedEntry: Boolean(earnedEntry), earnedExit: Boolean(earnedEntry && beforeCompletion && beatIndices.every(i => i >= 0) && exit > entry),
    chapterWindowComplete, noFixtures, priorIndex: prior, entryIndex: entry, beatIndices, exitIndex: exit, sampleCount: samples.length };
}

export function sinkOwnership(inputs, sinkIndex, browserPid, parentOf) {
  const own = inputs.filter(s => Number(s.sink) === sinkIndex);
  const descendant = pid => {
    for (let hops = 0; Number.isInteger(pid) && pid > 1 && hops < 40; hops++) {
      if (pid === browserPid) return true;
      const next = parentOf(pid); if (next === pid) return false; pid = next;
    }
    return false;
  };
  const foreign = own.filter(s => !descendant(Number(s.properties?.['application.process.id'])));
  return { ok: Number.isInteger(sinkIndex) && own.length > 0 && foreign.length === 0,
    foreign: foreign.map(s => s.index), streams: own.map(s => ({ index: s.index, sink: s.sink, pid: s.properties?.['application.process.id'] ?? null })) };
}

export function mediaProof({ video, audio, frames, decodedFrames, cleanup, renderer, isolation, minAudioSeconds = 2 }) {
  const nonblank = list => list?.length >= 3 && list.every(f => f.meanLuma > 0.002 && f.contrast > 0.002 && f.nearBlack < 0.999);
  return { hardware: hardware(renderer),
    cleanup: cleanup?.phase === 'post-finally' && cleanup.browserStopped === true && cleanup.recorderStopped === true
      && cleanup.moduleRemoved === true && cleanup.defaultSinkUnchanged === true && cleanup.previewIntact === true && cleanup.sourceIntact === true
      && cleanup.errors?.length === 0,
    videoDecodes: video?.decoded === true && video.frames > 0 && video.durationSeconds > 0,
    audioDecodes: audio?.decoded === true && audio.durationSeconds >= minAudioSeconds && audio.rms > 0.00001 && audio.peak > 0.0001
      && isolation?.length > 0 && isolation.every(s => s.ok === true),
    framesNonblank: Boolean(nonblank(frames) && nonblank(decodedFrames)),
  };
}

function parentOf(pid) {
  try { const text = fs.readFileSync(`/proc/${pid}/stat`, 'utf8'); return Number(text.slice(text.lastIndexOf(')') + 2).split(' ')[1]); }
  catch { return null; }
}
const alive = pid => { if (!Number.isInteger(pid)) return false; try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; } };

async function stopChild(child) {
  if (!child) return true;
  if (child.exitCode !== null || child.signalCode !== null) return true;
  child.kill('SIGINT');
  for (let i = 0; i < 50 && child.exitCode === null && child.signalCode === null; i++) await sleep(100);
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  for (let i = 0; i < 20 && alive(child.pid); i++) await sleep(100);
  return !alive(child.pid);
}

async function verifyPreview(url, ownership) {
  const checked = [];
  for (const [file, hash] of Object.entries(ownership.files)) {
    requireThat(!file.startsWith('/') && !file.split('/').includes('..'), 'Invalid preview asset path');
    const response = await fetch(new URL(file, url), { signal: AbortSignal.timeout(10_000) });
    const bytes = Buffer.from(await response.arrayBuffer());
    requireThat(response.ok && sha(bytes) === hash, `Preview bytes differ: ${file}`);
    if (file === 'index.html') requireThat(bytes.toString().includes('<title>Paravoxia</title>'), 'Wrong preview identity');
    checked.push(file);
  }
  return { checkedAt: new Date().toISOString(), files: checked, buildSha256: sha(ownership.files) };
}

// This callback executes in the page. It only reads production observation
// bridges; there is no init script, fixture loader, setter or hidden input seam.
export function pageSample() {
  const snap = window.__paravoxiaJourneyProbe?.snapshot?.();
  if (!snap) return null;
  const ap = window.__autopilot;
  return { wallMs: Date.now(), pageMs: performance.now(), story: snap.story,
    unfinishedMap: snap.unfinishedMap ?? null,
    app: window.__paravoxiaBoundaryState?.runtime?.app ?? null,
    milestones: snap.state?.localActor?.milestones, preparation: snap.preparation,
    objective: snap.objective, av: snap.state?.signedSceneAv,
    input: snap.input, interaction: snap.interaction,
    view: snap.view, body: snap.commonGround?.bodyCentre,
    flight: snap.state?.spaceFlight, systemFlight: snap.state?.systemFlight,
    autopilot: ap ? { beat: ap.beat, clock: ap.clock, backstops: ap.backstops,
      teleportNudgesTotal: ap.teleportNudgesTotal, pos: ap.pos, controls: ap.controls,
      goal: ap.goal, routeAction: ap.routeAction, routeOutcome: ap.routeOutcome,
      construction: ap.construction } : null };
}

// Docking replaces the document. A sample interrupted by that navigation has
// no observation to record; application errors and closed browsers still fail.
export async function readPageSample(page) {
  try { return await page.evaluate(pageSample); }
  catch (error) {
    if (error.message?.includes('Execution context was destroyed, most likely because of a navigation')) return null;
    throw error;
  }
}

// These are replay inputs for diagnosis only. They never replace fresh-context
// continuity proof or any of its predicates.
export function diagnosticCheckpointKey(sample) {
  return JSON.stringify([sample.story?.beat, sample.objective?.id,
    sample.autopilot?.construction?.tree, sample.autopilot?.construction?.wood]);
}

export function chapterWindowReady(sample, route) {
  return route.beats.includes(sample?.story?.beat) && sample.app?.phase === 'playing' && sample.app?.sceneReady === true
    && sample.autopilot?.beat === sample.story.beat;
}

export async function finalizeVideo(context, video, file) {
  await bounded(context?.close(), 10_000, 'Context close');
  // A remote Playwright artifact lives on BrowserServer. Save it after the
  // context flushes frames but BEFORE closing that server/connection.
  if (video) await bounded(video.saveAs(file), 10_000, 'Video save');
}

function retainChapterVideo(out, runtime) {
  const offset = (runtime.chapterReadyAtWallMs - runtime.videoStartedAtWallMs) / 1000;
  requireThat(Number.isFinite(offset) && offset >= 0, 'Chapter-ready video window was not observed');
  runtime.videoWindow = { offsetSeconds: offset, source: 'raw/session.webm', clock: 'observed wall-clock offset from page creation; no sample-accurate AV sync claim' };
  command('ffmpeg', ['-v', 'error', '-xerror', '-ss', String(offset), '-i', path.join(out, 'raw/session.webm'),
    '-map', '0:v:0', '-an', '-c:v', 'libvpx', '-deadline', 'realtime', '-cpu-used', '8', '-b:v', '1500k', '-y', path.join(out, 'video.webm')], { timeout: 60_000 });
}

function decodeMedia(out, frameStats) {
  const videoPath = path.join(out, 'video.webm'), audioPath = path.join(out, 'audio.wav');
  const video = { decoded: false }, audio = { decoded: false }; const decodedFrames = [];
  try {
    const probe = JSON.parse(command('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,nb_read_frames:format=duration', '-of', 'json', videoPath], { timeout: 60_000 }));
    command('ffmpeg', ['-v', 'error', '-xerror', '-i', videoPath, '-map', '0:v:0', '-f', 'null', '-'], { timeout: 60_000 });
    Object.assign(video, { decoded: true, frames: Number(probe.streams?.[0]?.nb_read_frames), durationSeconds: Number(probe.format?.duration), probe });
    for (const [index, fraction] of [0.25, 0.6, 0.9].entries()) {
      const file = path.join(out, 'raw', `decoded-${index}.png`);
      command('ffmpeg', ['-v', 'error', '-ss', String(video.durationSeconds * fraction), '-i', videoPath, '-frames:v', '1', '-y', file]);
      decodedFrames.push({ path: path.relative(out, file), ...frameStats(fs.readFileSync(file)) });
    }
  } catch (error) { video.error = error.message; }
  try {
    const probe = JSON.parse(command('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,sample_rate,channels:format=duration', '-of', 'json', audioPath]));
    const pcm = command('ffmpeg', ['-v', 'error', '-xerror', '-i', audioPath, '-map', '0:a:0', '-ac', '1', '-ar', '8000', '-f', 'f32le', '-'], { encoding: 'buffer', maxBuffer: 80 * 1024 * 1024, timeout: 60_000 });
    let sum = 0, peak = 0; const count = Math.floor(pcm.length / 4);
    for (let i = 0; i < count; i++) { const value = pcm.readFloatLE(i * 4); requireThat(Number.isFinite(value), 'Invalid decoded audio sample'); sum += value * value; peak = Math.max(peak, Math.abs(value)); }
    Object.assign(audio, { decoded: count > 0, durationSeconds: Number(probe.format?.duration), rms: Math.sqrt(sum / count), peak, probe });
  } catch (error) { audio.error = error.message; }
  return { video, audio, decodedFrames };
}

export async function captureRuntime({ repo = ROOT, legacy, out, kind, preview, config = {}, provenance } = {}) {
  requireThat(['av', 'continuity'].includes(kind), `Unsupported runtime capture kind: ${kind}`);
  const capability = describeRuntimeCapabilities({ repo, legacy, config, provenance });
  requireThat(capability.capabilities[kind].supported, capability.capabilities[kind].blockers.join('; '));
  config = capability.config; const route = capability.route;
  const identity = sourceIdentity({ repo, legacy, config, provenance });
  const base = typeof preview === 'string' ? preview : preview?.url ?? identity.ownership.url;
  const url = captureUrl(base, config, route, kind);
  out = path.resolve(out);
  fs.mkdirSync(out, { recursive: true });
  // The checked runner writes inside repo. Standalone hardware validation may
  // keep the game checkout read-only and put its self-contained package in /tmp.
  // Explicit artifactRoot keeps those relative references unambiguous.
  const artifactRoot = out.startsWith(`${path.resolve(repo)}${path.sep}`) ? path.resolve(repo) : out;
  if (artifactRoot === repo) inside(repo, path.relative(repo, out));
  const raw = path.join(out, 'raw'); requireThat(!fs.existsSync(raw), 'Runtime capture output must be fresh'); fs.mkdirSync(raw);
  const before = await verifyPreview(base, identity.ownership);
  const { chromium } = await import('playwright-core');
  const { CHROMIUM_ARGS, chromePath, assertHardwareGl } = await import('../lib/previewServer.mjs');
  const { frameStats, hideUi, showUi } = await import('../lib/evidence.mjs');
  const samples = [], frames = [], isolation = [], pageErrors = [], errors = [];
  const cleanup = { phase: 'running', errors: [], notes: [] };
  const startedAtWallMs = Date.now(), deadline = startedAtWallMs + config.maxSessionSeconds * 1000;
  const runtime = { schema: 'paravoxia.runtimeCapture.v1', kind, config, route, url, freshContext: true, storageInjected: false,
    sourceManifestSha256: identity.sourceManifestSha256, sourceFiles: identity.source.hashes,
    buildSha256: identity.buildSha256, previewBefore: before, previewOwner: identity.ownership.owner ?? null,
    headed: true, tier: 'hardware-high', startedAtWallMs, deadlineWallMs: deadline, candidateSha256: process.env.CHAPTER_LOOP_CANDIDATE ?? null,
    transportSha256: sha(fs.readFileSync(fileURLToPath(import.meta.url))), gestures: [],
    mediaClock: 'separate live video/audio recordings; start/stop wall clocks retained; no claimed sample-accurate mux' };
  let server, browser, context, page, recorder, videoHandle, renderer, moduleId, sinkIndex, browserPid, targetAt = null, aborted = null;
  const sinkName = `paravoxia_capture_${process.pid}_${randomUUID().slice(0, 8)}`;
  const abort = signal => { aborted = `Capture interrupted by ${signal}`; void browser?.close().catch(() => {}); };
  const handlers = new Map(['SIGINT', 'SIGTERM', 'SIGHUP'].map(signal => [signal, () => abort(signal)]));
  for (const [signal, handler] of handlers) process.on(signal, handler);
  // TEARDOWN MUST NOT KILL THE RECEIPT. Closing the browser rejects whatever
  // Playwright still had in flight, and some of those promises have no waiter
  // left — Node escalates that to an uncaught exception and the process dies
  // BEFORE `report.json` is written. Two complete earned ch14 continuity runs
  // were lost that way on 2026-09-21: the chapter was proved, the evidence was
  // on disk, and the run still reported as inconclusive infrastructure.
  //
  // A target-closed rejection raised while the capture is deliberately shutting
  // down is expected and is recorded as a note. Anything else — including any
  // rejection while the session is still running — remains a hard error and
  // still fails the probe.
  const teardownClosure = /Target (page, context or browser has been closed|closed)|Browser has been closed|has been closed/i;
  const onUnhandledRejection = reason => {
    const message = reason instanceof Error ? reason.message : String(reason);
    if (cleanup.phase !== 'running' && teardownClosure.test(message)) {
      cleanup.notes.push(message);
      return;
    }
    errors.push(`Unhandled rejection: ${message}`);
  };
  process.on('unhandledRejection', onUnhandledRejection);
  const watchdog = setTimeout(() => abort('session deadline'), config.maxSessionSeconds * 1000);
  try {
    runtime.defaultSinkBefore = pactl(['get-default-sink']).trim();
    moduleId = pactl(['load-module', 'module-null-sink', `sink_name=${sinkName}`, `sink_properties=device.description=${sinkName}`]).trim();
    requireThat(/^\d+$/.test(moduleId), 'Invalid owned audio module id');
    const sinks = JSON.parse(pactl(['--format=json', 'list', 'sinks'])).filter(s => s.name === sinkName);
    requireThat(sinks.length === 1 && Number.isInteger(sinks[0].index), 'Owned audio sink index is ambiguous'); sinkIndex = sinks[0].index;
    runtime.audioDevice = { sinkName, sinkIndex, moduleId, monitor: `${sinkName}.monitor`, defaultChanged: false };
    const args = [...CHROMIUM_ARGS.filter(a => !['--mute-audio', '--enable-unsafe-swiftshader'].includes(a)), '--enable-gpu', '--use-angle=gl'];
    server = await chromium.launchServer({ executablePath: chromePath(), headless: false, args,
      env: { ...process.env, DISPLAY: process.env.DISPLAY ?? ':0', PULSE_SINK: sinkName }, timeout: Math.min(60_000, deadline - Date.now()) });
    browserPid = server.process().pid; runtime.browserPid = browserPid; runtime.launchArgs = args;
    browser = await chromium.connect(server.wsEndpoint());
    context = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: path.join(raw, 'video'), size: { width: 1280, height: 720 } } });
    runtime.videoStartedAtWallMs = Date.now(); page = await context.newPage(); videoHandle = page.video();
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: Math.min(90_000, deadline - Date.now()) });
    renderer = await assertHardwareGl(page, () => {}); runtime.renderer = renderer;
    requireThat(hardware(renderer), 'Headed hardware GPU proof unavailable');
    let nextFrameAt = 0, nextIsolationAt = 0, ownership = { ok: false, foreign: [], streams: [] };
    let lastCheckpointKey = null;
    const checkpoints = [];
    while (Date.now() < deadline) {
      if (aborted) throw new Error(aborted);
      const sample = await readPageSample(page);
      if (sample) {
        samples.push(sample); fs.appendFileSync(path.join(raw, 'trace.ndjson'), `${JSON.stringify(sample)}\n`);
        const checkpointKey = diagnosticCheckpointKey(sample);
        if (checkpointKey !== lastCheckpointKey) {
          const checkpointDir = path.join(raw, 'diagnostic-checkpoints');
          fs.mkdirSync(checkpointDir, { recursive: true });
          const file = path.join(checkpointDir, `${checkpoints.length}.json`);
          try {
            const storageState = await bounded(context.storageState(), 5000, 'Diagnostic save read');
            writeJson(file, { schema: 'paravoxia.diagnosticCheckpoint.v1', noncertifying: true,
              wallMs: sample.wallMs, url: page.url(), story: sample.story,
              objective: sample.objective, storageState });
            checkpoints.push({ ...reference(artifactRoot, file), wallMs: sample.wallMs,
              beat: sample.story?.beat, objectiveId: sample.objective?.id });
            writeJson(path.join(raw, 'diagnostic-checkpoints.json'), checkpoints);
          } catch (error) {
            (runtime.diagnosticErrors ??= []).push(error.message);
          }
          lastCheckpointKey = checkpointKey;
        }
        // gameAudio deliberately installs its engines only after a trusted
        // user gesture. The browser autoplay flag alone does not run that
        // application listener. Use the same ordinary canvas click as the
        // existing live-audio probe; never call an audio/state bridge.
        if (!runtime.gestures.length && chapterWindowReady(sample, route)) {
          const box = await page.locator('canvas').first().boundingBox();
          if (box?.width > 0 && box?.height > 0) {
            const x = box.x + box.width / 2, y = box.y + box.height / 2;
            await page.mouse.click(x, y);
            runtime.gestures.push({ kind: 'trusted-canvas-click', purpose: 'application audio activation', x, y, wallMs: Date.now(), beat: sample.story.beat });
          }
        }
        if (chapterWindowReady(sample, route) && targetAt === null) { targetAt = Date.now(); runtime.chapterReadyAtWallMs = targetAt; }
        if (targetAt !== null && Date.now() >= nextFrameAt) {
          const file = path.join(raw, `frame-${frames.length}.png`);
          await hideUi(page);
          try { const bytes = await page.screenshot({ path: file }); frames.push({ wallMs: Date.now(), beat: sample.story.beat, path: path.relative(out, file), ...frameStats(bytes) }); }
          finally { await showUi(page); }
          nextFrameAt = Date.now() + Math.max(1000, config.avSeconds * 1000 / 4);
        }
      }
      if (Date.now() >= nextIsolationAt) {
        ownership = sinkOwnership(JSON.parse(pactl(['--format=json', 'list', 'sink-inputs'])), sinkIndex, browserPid, parentOf);
        nextIsolationAt = Date.now() + 1000;
      }
      if (ownership.foreign.length) throw new Error('Foreign stream reached the owned audio sink');
      // Begin the judge recording at the target chapter. Earlier route audio is
      // irrelevant to chapter AV and must not conceal a silent target score.
      if (targetAt !== null && (ownership.ok || recorder)) {
        isolation.push({ wallMs: Date.now(), ...ownership });
        requireThat(ownership.ok, 'Owned target audio stream disappeared during recording');
        if (!recorder) {
          recorder = spawn('parec', ['-d', `${sinkName}.monitor`, '--rate=48000', '--channels=2', '--format=s16le', '--file-format=wav', path.join(out, 'audio.wav')], { stdio: ['ignore', 'ignore', 'pipe'] });
          recorder.on('error', error => errors.push(`Recorder: ${error.message}`));
          recorder.stderr.on('data', chunk => fs.appendFileSync(path.join(raw, 'recorder.log'), chunk));
          runtime.audioStartedAtWallMs = Date.now(); runtime.recorderPid = recorder.pid;
        }
      }
      if (recorder && (recorder.exitCode !== null || recorder.signalCode !== null)) throw new Error('Audio recorder exited before capture completed');
      // Recorder process creation precedes actual captured PCM. Count flushed
      // bytes with a conservative container allowance, then verify the exact
      // duration using the decoder after close. Wall time alone lost 1.8 s.
      const audioFile = path.join(out, 'audio.wav');
      const recordedSeconds = fs.existsSync(audioFile) ? Math.max(0, fs.statSync(audioFile).size - 4096) / (48000 * 2 * 2) : 0;
      const enough = recorder && frames.length >= 3 && recordedSeconds >= config.avSeconds;
      const routeProof = continuityProof(samples, route, runtime);
      const complete = kind === 'av' ? routeProof.chapterWindowComplete : routeProof.earnedExit;
      // Retain the handback and musical tail, not just the first twelve seconds.
      if (enough && complete && Date.now() - samples[routeProof.exitIndex].wallMs >= 8000) break;
      if (pageErrors.length) throw new Error(`Runtime page error: ${pageErrors[0]}`);
      await sleep(config.sampleMs);
    }
    if (Date.now() >= deadline || aborted) throw new Error(aborted ?? 'Session deadline reached before required live evidence');
  } catch (error) { errors.push(error.message); }
  finally {
    // Everything below is deliberate shutdown; see `onUnhandledRejection`.
    cleanup.phase = 'teardown';
    clearTimeout(watchdog);
    try { cleanup.recorderStopped = await stopChild(recorder); runtime.audioStoppedAtWallMs = Date.now(); } catch (error) { cleanup.errors.push(error.message); }
    try { await finalizeVideo(context, videoHandle, path.join(raw, 'session.webm')); } catch (error) { cleanup.errors.push(`Video: ${error.message}`); }
    try { await bounded(browser?.close(), 10_000, 'Browser close'); await bounded(server?.close(), 10_000, 'Browser server close'); }
    catch (error) { cleanup.errors.push(`Browser: ${error.message}`); try { await bounded(server?.kill(), 5000, 'Browser kill'); } catch { /* proved below */ } }
    for (let i = 0; browserPid && alive(browserPid) && i < 30; i++) await sleep(100);
    cleanup.browserStopped = !alive(browserPid); runtime.videoStoppedAtWallMs = Date.now();
    try {
      if (moduleId) pactl(['unload-module', moduleId]);
      cleanup.moduleRemoved = !JSON.parse(pactl(['--format=json', 'list', 'modules'])).some(m => String(m.index) === moduleId);
      runtime.defaultSinkAfter = pactl(['get-default-sink']).trim();
      cleanup.defaultSinkUnchanged = runtime.defaultSinkBefore === runtime.defaultSinkAfter;
    } catch (error) { cleanup.errors.push(`Audio cleanup: ${error.message}`); }
    try { runtime.previewAfter = await verifyPreview(base, identity.ownership); cleanup.previewIntact = true; } catch (error) { cleanup.errors.push(error.message); }
    try {
      const after = sourceIdentity({ repo, legacy, config, provenance });
      requireThat(after.sourceManifestSha256 === identity.sourceManifestSha256 && after.buildSha256 === identity.buildSha256,
        'Source or build manifest replaced during capture');
      cleanup.sourceIntact = true;
    } catch (error) { cleanup.errors.push(error.message); }
    cleanup.phase = 'post-finally';
    for (const [signal, handler] of handlers) process.removeListener(signal, handler);
    process.removeListener('unhandledRejection', onUnhandledRejection);
  }
  if (frames.length) fs.copyFileSync(path.join(out, frames[Math.floor(frames.length / 2)].path), path.join(out, 'frame.png'));
  try { retainChapterVideo(out, runtime); } catch (error) { errors.push(`Chapter video: ${error.message}`); }
  const decoded = decodeMedia(out, frameStats);
  const proof = { ...continuityProof(samples, route, runtime), ...mediaProof({ ...decoded, frames, cleanup, renderer, isolation, minAudioSeconds: config.avSeconds }) };
  const obligations = kind === 'av' ? ['hardware', 'cleanup', 'videoDecodes', 'audioDecodes', 'framesNonblank', 'chapterWindowComplete'] : ['hardware', 'cleanup', 'earnedEntry', 'earnedExit', 'noFixtures'];
  const passed = errors.length === 0 && obligations.every(k => proof[k] === true);
  writeJson(path.join(raw, 'provenance.json'), runtime); writeJson(path.join(raw, 'cleanup.json'), cleanup);
  writeJson(path.join(raw, 'media-proof.json'), { ...decoded, frames, isolation, pageErrors, errors });
  const media = capability.media.filter(m => fs.existsSync(path.join(out, m.path))).map(m => ({ kind: m.kind, ...reference(artifactRoot, path.join(out, m.path)) }));
  const rawRefs = fs.readdirSync(raw).filter(file => fs.statSync(path.join(raw, file)).isFile()).map(file => reference(artifactRoot, path.join(raw, file)));
  const report = { schema: 'paravoxia.chapterLoopProbe.v1', candidateSha256: process.env.CHAPTER_LOOP_CANDIDATE ?? null,
    kind, chapter: config.chapter, proof, raw: rawRefs, media, artifactRoot, exitCode: passed ? 0 : 2, reused: false, status: passed ? 'passed' : 'inconclusive', errors,
    provenance: { sourceManifestSha256: identity.sourceManifestSha256, buildSha256: identity.buildSha256, transportSha256: runtime.transportSha256 } };
  writeJson(path.join(out, 'report.json'), report);
  requireThat(passed, `PROBE-ERROR-INCONCLUSIVE: ${errors.join('; ') || obligations.filter(k => proof[k] !== true).join(', ')}`);
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const value = name => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? undefined : process.argv[i + 1]; };
  const options = { repo: path.resolve(value('repo') ?? ROOT), legacy: value('legacy'), out: value('out'), kind: value('case'), preview: value('preview'), config: value('config') ?? {} };
  try {
    if (value('seconds')) options.config = { ...(typeof options.config === 'string' ? readJson(inside(options.repo, options.config)) : options.config), maxSessionSeconds: Number(value('seconds')) };
    if (process.argv.includes('--describe')) {
      const result = describeRuntimeCapabilities(options);
      if (options.out) writeJson(path.join(options.out, 'capabilities.json'), result);
      console.log(JSON.stringify(result)); if (!result.supported) process.exitCode = 2;
    }
    else await captureRuntime(options);
  } catch (error) { console.error(`PROBE-ERROR-INCONCLUSIVE: ${error.message}`); process.exitCode = 2; }
}
