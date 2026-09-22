#!/usr/bin/env node
/**
 * Chapter manual / recovery / Continue evidence transport.
 *
 * This transport proves *ordinary play*: every input it delivers is a real
 * keyboard or mouse event a player could produce, and every observation is a
 * passive read of `window.__paravoxiaJourneyProbe.snapshot()`. There is no
 * state injection, no debug setter, no teleport, and no config-supplied
 * script: the only page function this file ever evaluates is the fixed
 * read-only reader defined below. A chapter config may therefore describe
 * *what* to press and *what to wait for*, never *what to become*.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { requireThat, sha } from './contract.mjs';
import { inside, readJson, writeJson, reference } from './store.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const KINDS = new Set(['manual', 'recovery', 'continue']);
const MAX_STEPS = 64;
const MAX_WAIT_MS = 30_000;
const MAX_HOLD_MS = 5_000;
const MAX_SESSION_SECONDS = 900;
const POLL_MS = 100;

/** Config keys that would turn a declarative action list into a cheat console. */
const FORBIDDEN_KEYS = new Set(['evaluate', 'eval', 'script', 'scripts', 'addinitscript', 'initscript',
  'exposefunction', 'state', 'setstate', 'inject', 'injectstate', 'storage', 'localstorage', 'teleport',
  'setpose', 'debug', 'debugsetter', 'cheat', 'grantmilestone', 'setmilestone', 'route', 'function']);
const ACTION_TYPES = new Set(['key', 'press', 'text', 'click', 'move', 'wait', 'waitSelector', 'settle']);
/** Ordinary keys only: no OS/browser-level chords that would leave the game. */
const KEY_PATTERN = /^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Escape|Enter|Space|Tab|Shift(Left|Right)|Control(Left|Right)|Alt(Left|Right)|F[1-9]|F1[0-2]|Backspace|Minus|Equal|Comma|Period|Slash)$/;

export function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, sortDeep(value[key])]));
  }
  return value;
}
export const canonical = value => JSON.stringify(sortDeep(value));

/** RFC 6901 JSON pointer read. Read-only by construction: it only descends. */
export function pointer(document, jsonPointer) {
  requireThat(typeof jsonPointer === 'string' && (jsonPointer === '' || jsonPointer.startsWith('/')),
    `Invalid JSON pointer: ${String(jsonPointer)}`);
  if (jsonPointer === '') return document;
  let node = document;
  for (const raw of jsonPointer.slice(1).split('/')) {
    if (node == null || typeof node !== 'object') return undefined;
    node = node[raw.replace(/~1/g, '/').replace(/~0/g, '~')];
  }
  return node;
}

function scanForbidden(node, trail = '') {
  if (Array.isArray(node)) { node.forEach((item, index) => scanForbidden(item, `${trail}/${index}`)); return; }
  if (!node || typeof node !== 'object') {
    requireThat(typeof node !== 'function', `Config may not carry executable values (${trail})`);
    if (typeof node === 'string') {
      requireThat(!/^\s*(javascript|data):/i.test(node), `Config may not carry executable URLs (${trail})`);
      requireThat(!/^\s*(\(|function\b|async\b|=>)/.test(node) && !node.includes('=>'),
        `Config may not carry page scripts (${trail})`);
    }
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    requireThat(!FORBIDDEN_KEYS.has(key.toLowerCase()) || (key === 'route' && trail === ''),
      `Config key "${key}" would bypass ordinary controls (${trail || '/'})`);
    scanForbidden(value, `${trail}/${key}`);
  }
}

function validateWait(action, trail) {
  requireThat(Number.isInteger(action.timeoutMs) && action.timeoutMs > 0 && action.timeoutMs <= MAX_WAIT_MS,
    `${trail}: wait timeoutMs must be a bounded integer <= ${MAX_WAIT_MS}`);
}

export function validateAction(action, trail) {
  requireThat(action && typeof action === 'object' && !Array.isArray(action), `${trail}: action must be an object`);
  requireThat(ACTION_TYPES.has(action.type), `${trail}: unsupported action type ${JSON.stringify(action.type)}`);
  if (action.type === 'key' || action.type === 'press') {
    requireThat(KEY_PATTERN.test(action.code ?? ''), `${trail}: ${action.code} is not an ordinary gameplay key`);
    if (action.holdMs !== undefined) {
      requireThat(Number.isInteger(action.holdMs) && action.holdMs > 0 && action.holdMs <= MAX_HOLD_MS,
        `${trail}: holdMs must be a bounded integer <= ${MAX_HOLD_MS}`);
    }
  } else if (action.type === 'text') {
    requireThat(typeof action.value === 'string' && action.value.length > 0 && action.value.length <= 120,
      `${trail}: text value must be a short string`);
  } else if (action.type === 'click' || action.type === 'move') {
    const hasPoint = Number.isFinite(action.x) && Number.isFinite(action.y);
    const hasSelector = typeof action.selector === 'string' && action.selector.length > 0;
    requireThat(hasPoint || (hasSelector && action.type === 'click'),
      `${trail}: ${action.type} needs numeric x/y${action.type === 'click' ? ' or a selector' : ''}`);
    if (action.button !== undefined) {
      requireThat(['left', 'right', 'middle'].includes(action.button), `${trail}: unsupported mouse button`);
    }
  } else if (action.type === 'wait') {
    requireThat(typeof action.pointer === 'string' && action.pointer.startsWith('/'),
      `${trail}: wait needs a snapshot JSON pointer`);
    const modes = ['equals', 'exists', 'changes', 'atLeast', 'includes'].filter(mode => action[mode] !== undefined);
    requireThat(modes.length === 1, `${trail}: wait needs exactly one of equals/exists/changes/atLeast/includes`);
    validateWait(action, trail);
  } else if (action.type === 'waitSelector') {
    requireThat(typeof action.selector === 'string' && action.selector.length > 0, `${trail}: waitSelector needs a selector`);
    requireThat(['visible', 'hidden', 'attached'].includes(action.state ?? 'visible'), `${trail}: unsupported selector state`);
    validateWait(action, trail);
  } else if (action.type === 'settle') {
    requireThat(Number.isInteger(action.ms) && action.ms > 0 && action.ms <= MAX_WAIT_MS,
      `${trail}: settle ms must be a bounded integer <= ${MAX_WAIT_MS}`);
  }
  return action;
}

function validateSteps(steps, trail) {
  requireThat(Array.isArray(steps) && steps.length > 0, `${trail} must be a non-empty array of actions`);
  requireThat(steps.length <= MAX_STEPS, `${trail} exceeds ${MAX_STEPS} actions`);
  steps.forEach((action, index) => validateAction(action, `${trail}[${index}]`));
  return steps;
}

const stringList = (value, trail, { min = 1 } = {}) => {
  requireThat(Array.isArray(value) && value.length >= min && value.every(item => typeof item === 'string' && item),
    `${trail} must be an array of ${min} or more names`);
  return [...value];
};

/**
 * Strict, whitelist-first config validation. Anything not understood is
 * refused: an unknown key in a control config is a claim this transport cannot
 * honestly make.
 */
export function validateControlConfig(config, kind) {
  requireThat(config && typeof config === 'object' && !Array.isArray(config), 'Control config must be an object');
  requireThat(KINDS.has(kind), `Unsupported case ${JSON.stringify(kind)}`);
  scanForbidden(config);
  const known = new Set(['chapter', 'sourceManifest', 'previewOwnership', 'route', 'viewport', 'maxSessionSeconds',
    'beats', 'acceptedMilestones', 'deltaPointers', 'durablePointers', 'steps', 'newActionSteps', 'pause',
    'continue', 'readySelector', 'readyPointer', 'completionMilestones', 'notes']);
  for (const key of Object.keys(config)) requireThat(known.has(key), `Unknown control config key "${key}"`);
  requireThat(typeof config.chapter === 'string' && config.chapter, 'Control config needs a chapter id');
  const route = config.route ?? '/?journeyprobe=1';
  requireThat(typeof route === 'string' && route.startsWith('/') && !route.includes('..'),
    'route must be a same-origin absolute path');
  requireThat(route.includes('journeyprobe=1') || route.includes('chapterjourney=1'),
    'route must enable the read-only journey probe');
  const entry = new URL(route, 'http://localhost');
  requireThat(entry.origin === 'http://localhost' && !entry.searchParams.has('movie')
    && !entry.searchParams.has('swgpu'), 'Manual controls cannot use an automatic or software route');
  const maxSessionSeconds = config.maxSessionSeconds ?? 300;
  requireThat(Number.isInteger(maxSessionSeconds) && maxSessionSeconds > 0 && maxSessionSeconds <= MAX_SESSION_SECONDS,
    `maxSessionSeconds must be a bounded integer <= ${MAX_SESSION_SECONDS}`);
  const normalized = {
    chapter: config.chapter,
    sourceManifest: config.sourceManifest ?? null,
    previewOwnership: config.previewOwnership ?? null,
    route,
    viewport: config.viewport ?? { width: 1280, height: 720 },
    maxSessionSeconds,
    beats: stringList(config.beats ?? [], 'beats', { min: kind === 'manual' ? 1 : 0 }),
    acceptedMilestones: stringList(config.acceptedMilestones, 'acceptedMilestones'),
    completionMilestones: stringList(config.completionMilestones ?? [config.acceptedMilestones?.at(-1)], 'completionMilestones'),
    deltaPointers: stringList(config.deltaPointers ?? ['/state/systemFlight/pose/position'], 'deltaPointers'),
    durablePointers: stringList(config.durablePointers
      ?? ['/story/chapter', '/story/beat', '/state/localActor/milestones', '/receipts'], 'durablePointers'),
    steps: validateSteps(config.steps, 'steps'),
    newActionSteps: config.newActionSteps ? validateSteps(config.newActionSteps, 'newActionSteps') : null,
    readySelector: config.readySelector ?? null,
    readyPointer: config.readyPointer ?? '/story/active',
    pause: null,
    continue: null
  };
  for (const jsonPointer of [...normalized.deltaPointers, ...normalized.durablePointers, normalized.readyPointer]) {
    requireThat(typeof jsonPointer === 'string' && jsonPointer.startsWith('/'), `Invalid snapshot pointer ${jsonPointer}`);
  }
  requireThat(Number.isInteger(normalized.viewport.width) && Number.isInteger(normalized.viewport.height),
    'viewport must be integer width/height');
  if (kind === 'recovery') {
    const pause = config.pause;
    requireThat(pause && typeof pause === 'object', 'recovery config needs a pause block');
    requireThat((pause.key ?? 'Escape') === 'Escape', 'recovery must interrupt with the ordinary Escape key');
    requireThat(typeof pause.pausedPointer === 'string' && pause.pausedPointer.startsWith('/'),
      'pause.pausedPointer must be a snapshot JSON pointer');
    requireThat(typeof pause.resumeSelector === 'string' && pause.resumeSelector,
      'pause.resumeSelector must name the visible resume control');
    normalized.pause = {
      key: 'Escape',
      pausedPointer: pause.pausedPointer,
      pausedValue: pause.pausedValue ?? true,
      resumeSelector: pause.resumeSelector,
      timeoutMs: pause.timeoutMs ?? 10_000
    };
    validateWait(normalized.pause, 'pause');
    requireThat(normalized.newActionSteps, 'recovery config needs newActionSteps for the post-resume action');
  }
  if (kind === 'continue') {
    const resume = config.continue;
    requireThat(resume && typeof resume === 'object', 'continue config needs a continue block');
    requireThat(typeof resume.ctaSelector === 'string' && resume.ctaSelector,
      'continue.ctaSelector must name the visible landing Continue control');
    requireThat(typeof resume.checkpointPointer === 'string' && resume.checkpointPointer.startsWith('/'),
      'continue.checkpointPointer must be a snapshot JSON pointer');
    normalized.continue = {
      ctaSelector: resume.ctaSelector,
      checkpointPointer: resume.checkpointPointer,
      timeoutMs: resume.timeoutMs ?? 20_000
    };
    validateWait(normalized.continue, 'continue');
    requireThat(normalized.newActionSteps, 'continue config needs newActionSteps for the post-Continue action');
  }
  return normalized;
}

/**
 * A milestone the run did not earn cannot be an accepted action. Only names in
 * `accepted` that are absent from the baseline and present afterwards count.
 */
export function acceptedActionCount({ baselineMilestones = [], milestones = [], accepted = [] }) {
  const before = new Set(baselineMilestones);
  const acceptable = new Set(accepted);
  return [...new Set(milestones)].filter(name => acceptable.has(name) && !before.has(name)).length;
}
export function acceptedActionNames({ baselineMilestones = [], milestones = [], accepted = [] }) {
  const before = new Set(baselineMilestones);
  const acceptable = new Set(accepted);
  return [...new Set(milestones)].filter(name => acceptable.has(name) && !before.has(name)).sort();
}

/** An unchanged pose is not evidence of an action: identical readings prove nothing. */
export function deltaProof(before, after, pointers) {
  const changed = pointers.filter(jsonPointer =>
    pointer(before, jsonPointer) !== undefined && pointer(after, jsonPointer) !== undefined &&
    canonical(pointer(before, jsonPointer)) !== canonical(pointer(after, jsonPointer)));
  return { changed, moved: changed.length > 0 };
}

export function inputReceipts(snapshot) {
  const input = snapshot?.input ?? {};
  return {
    revision: input.revision ?? null,
    hotkeyActivations: input.hotkeyActivations ?? null,
    submitCount: input.submitCount ?? null,
    events: Array.isArray(input.events) ? input.events.length : null
  };
}
export function receiptsAdvanced(before, after) {
  const a = inputReceipts(before), b = inputReceipts(after);
  return ['revision', 'hotkeyActivations', 'submitCount', 'events']
    .some(key => Number.isFinite(a[key]) && Number.isFinite(b[key]) && b[key] > a[key]);
}

export function canonicalDurableState(snapshot, pointers) {
  return sortDeep(Object.fromEntries(pointers.map(jsonPointer => {
    const value = pointer(snapshot, jsonPointer);
    requireThat(value !== undefined, `Missing durable state: ${jsonPointer}`);
    return [jsonPointer, jsonPointer === '/state/localActor/milestones' && Array.isArray(value)
      ? [...value].sort() : sortDeep(value)];
  })));
}

const OBLIGATIONS = {
  manual: ['ordinaryControls', 'acceptedAction', 'completePath', 'hardware', 'cleanup'],
  recovery: ['ordinaryControls', 'acceptedAction', 'interrupted', 'recovered', 'newAcceptedAction', 'hardware', 'cleanup'],
  continue: ['ordinaryControls', 'acceptedAction', 'freshCheckpoint', 'clickedContinue',
    'stateEqual', 'newAcceptedAction', 'hardware', 'cleanup']
};
export function obligationsFor(kind) { return [...(OBLIGATIONS[kind] ?? [])]; }

/** A numeric obligation passes only when it counted something real. */
export function verdict(kind, proof) {
  const missing = obligationsFor(kind).filter(key => {
    const value = proof?.[key];
    return typeof value === 'number' ? !(value > 0) : value !== true;
  });
  return { passed: missing.length === 0 && obligationsFor(kind).length > 0, missing };
}

/** The only page function this transport ever evaluates. Passive read. */
const READ_SNAPSHOT = () => {
  const bridge = window.__paravoxiaJourneyProbe;
  const reader = bridge && (bridge.snapshot ?? bridge.getSnapshot);
  if (typeof reader !== 'function') return null;
  try { const value = reader.call(bridge); return value && typeof value === 'object' ? value : null; }
  catch { return null; }
};

function sourceIdentity({ repo, config, provenance }) {
  const sourceFile = config.sourceManifest ? inside(repo, config.sourceManifest) : null;
  const source = sourceFile ? readJson(sourceFile) : provenance?.sourceManifest;
  requireThat(source && Object.keys(source.hashes ?? {}).length > 0, 'Exact source manifest with file hashes required');
  const verify = () => {
    for (const [file, expected] of Object.entries(source.hashes)) {
      requireThat(sha(fs.readFileSync(inside(repo, file))) === expected, `Source changed: ${file}`);
    }
  };
  verify();
  const ownershipFile = config.previewOwnership ? inside(repo, config.previewOwnership) : null;
  const ownership = ownershipFile ? readJson(ownershipFile) : provenance?.previewOwnership;
  requireThat(ownership?.files?.['index.html'], 'Exact preview build ownership manifest required');
  const sourceManifestSha256 = sourceFile ? sha(fs.readFileSync(sourceFile)) : sha(source);
  requireThat(!ownership.sourceManifestSha256 || ownership.sourceManifestSha256 === sourceManifestSha256,
    'Preview was built from a different source manifest');
  return { source, ownership, sourceManifestSha256, buildSha256: sha(ownership.files), verify };
}

async function verifyPreview(url, ownership) {
  for (const [name, expected] of Object.entries(ownership.files)) {
    requireThat(!name.startsWith('/') && !name.split('/').includes('..'), 'Invalid owned build path');
    const response = await fetch(new URL(name, url), { signal: AbortSignal.timeout(10_000) });
    const body = Buffer.from(await response.arrayBuffer());
    requireThat(response.ok && sha(body) === (typeof expected === 'string' ? expected : expected?.sha256), `Served build differs: ${name}`);
    if (name === 'index.html') requireThat(body.toString().includes('<title>Paravoxia</title>'), 'Wrong preview application');
  }
  const response = await fetch(new URL('/index.html', url), { signal: AbortSignal.timeout(10_000) });
  const body = Buffer.from(await response.arrayBuffer());
  const expected = ownership.files['index.html'];
  const actual = sha(body);
  const matches = actual === (typeof expected === 'string' ? expected : expected?.sha256);
  requireThat(matches, 'Preview is not serving the exact owned build');
  return { url, indexSha256: actual, checkedAtWallMs: Date.now() };
}

const hardwareRenderer = renderer => /NVIDIA|AMD|Intel|Apple/i.test(renderer ?? '') && !/swiftshader|software|llvmpipe/i.test(renderer);

export function describeControlCapabilities({ repo = ROOT, kind = null, config = null } = {}) {
  const require_ = createRequire(import.meta.url);
  const checks = {};
  const record = (name, supported, detail) => { checks[name] = { supported, detail }; };
  try { require_.resolve('playwright-core'); record('playwright', true, 'playwright-core resolvable'); }
  catch { record('playwright', false, 'playwright-core is not installed'); }
  let chrome = null;
  try { ({ chromePath: chrome } = { chromePath: process.env.CHROME_PATH ?? '/snap/bin/chromium' }); } catch { /* ignore */ }
  record('chromium', Boolean(chrome && fs.existsSync(chrome)), chrome ?? 'no chromium path');
  record('display', Boolean(process.env.DISPLAY), process.env.DISPLAY ?? 'no DISPLAY for a headed hardware run');
  record('case', KINDS.has(kind), kind ? `case=${kind}` : 'no --case given');
  let normalized = null, pending = null;
  if (!config) {
    pending = 'chapter-config-missing';
    record('chapterConfig', false, 'no chapter control config supplied; this chapter is PENDING, not supported');
  } else {
    try {
      const raw = typeof config === 'string' ? readJson(inside(repo, config)) : config;
      normalized = validateControlConfig(raw, kind);
      record('chapterConfig', true, `${normalized.steps.length} declared ordinary actions`);
    } catch (error) {
      record('chapterConfig', false, `invalid chapter control config: ${error.message}`);
    }
  }
  const supported = Object.values(checks).every(check => check.supported);
  return {
    schema: 'paravoxia.controlCaptureCapabilities.v1',
    chapter: normalized?.chapter ?? null,
    case: kind,
    supported,
    status: supported ? 'supported' : pending ? 'pending' : 'unsupported',
    pending,
    obligations: obligationsFor(kind),
    actionSchema: { types: [...ACTION_TYPES], maxSteps: MAX_STEPS, maxWaitMs: MAX_WAIT_MS, keyPattern: KEY_PATTERN.source },
    forbidden: [...FORBIDDEN_KEYS].sort(),
    checks
  };
}

export async function captureControls(options) {
  const kind = options.kind;
  requireThat(KINDS.has(kind), `Unsupported case ${JSON.stringify(kind)}`);
  const repo = path.resolve(options.repo ?? ROOT);
  requireThat(options.config, 'A chapter control config is required (--config)');
  const configFile = typeof options.config === 'string' ? inside(repo, options.config) : null;
  const config = validateControlConfig(configFile ? readJson(configFile) : options.config, kind);
  if (options.chapter) requireThat(config.chapter === options.chapter, 'Config chapter does not match --chapter');
  const out = path.resolve(options.out ?? path.join(repo, 'artifacts', `control-${kind}`));
  const artifactRoot = out.startsWith(`${repo}${path.sep}`) ? repo : out;
  const raw = path.join(out, 'raw');
  requireThat(!fs.existsSync(raw), 'Control capture output must be fresh');
  fs.mkdirSync(raw, { recursive: true });
  const identity = sourceIdentity({ repo, config, provenance: options.provenance });

  const { chromium } = await import('playwright-core');
  const { CHROMIUM_ARGS, chromePath, assertHardwareGl, startParavoxiaPreview } = await import('../lib/previewServer.mjs');

  const trace = [], gestures = [], errors = [], pageErrors = [];
  const cleanup = { phase: 'running', errors: [], closed: {} };
  const startedAtWallMs = Date.now();
  const deadline = startedAtWallMs + config.maxSessionSeconds * 1000;
  const proof = {
    ordinaryControls: false, acceptedAction: 0, completePath: false, interrupted: false, recovered: false,
    freshCheckpoint: false, clickedContinue: false, ctaBeforeRuntimeReady: false, stateEqual: false,
    newAcceptedAction: 0, hardware: false, cleanup: false
  };
  const run = {
    schema: 'paravoxia.controlCapture.v1', kind, chapter: config.chapter, config,
    sourceManifestSha256: identity.sourceManifestSha256, sourceFiles: identity.source.hashes,
    buildSha256: identity.buildSha256, headed: true, tier: 'hardware-high',
    startedAtWallMs, deadlineWallMs: deadline,
    transportSha256: sha(fs.readFileSync(fileURLToPath(import.meta.url))),
    candidateSha256: process.env.CHAPTER_LOOP_CANDIDATE ?? null,
    ownedPreview: false, media: 'none required; audio/video evidence uses the separate runtime capture',
    beatsSeen: [], clickCount: 0, injections: 'none: no state injection, debug setter, teleport or config script'
  };

  let preview = null, server = null, browser = null, context = null, page = null, aborted = null;
  const abort = signal => { aborted = `Control capture interrupted by ${signal}`; void browser?.close().catch(() => {}); };
  const handlers = new Map(['SIGINT', 'SIGTERM', 'SIGHUP'].map(signal => [signal, () => abort(signal)]));
  for (const [signal, handler] of handlers) process.on(signal, handler);
  const watchdog = setTimeout(() => abort('session deadline'), config.maxSessionSeconds * 1000);

  const remaining = () => deadline - Date.now();
  const guard = () => { requireThat(!aborted, aborted ?? 'aborted'); requireThat(remaining() > 0, 'Session deadline reached'); };
  const snapshot = async () => { guard(); return page.evaluate(READ_SNAPSHOT); };
  const observe = async (phase, note = null) => {
    const value = await snapshot();
    const record = {
      t: Date.now(), phase, note,
      runtimeReady: Boolean(value),
      story: value?.story ?? null,
      milestones: pointer(value, '/state/localActor/milestones') ?? null,
      pointers: Object.fromEntries([...config.deltaPointers, ...config.durablePointers,
        ...(config.continue ? [config.continue.checkpointPointer] : []),
        ...(config.pause ? [config.pause.pausedPointer] : [])]
        .map(jsonPointer => [jsonPointer, pointer(value, jsonPointer) ?? null])),
      receipts: inputReceipts(value),
      inputEvents: (value?.input?.events ?? []).slice(-6),
      visiblePromptCount: pointer(value, '/interaction/visiblePromptCount') ?? null
    };
    trace.push(record);
    fs.appendFileSync(path.join(raw, 'trace.ndjson'), `${JSON.stringify(record)}\n`);
    const beat = value?.story?.beat;
    if (beat && run.beatsSeen[run.beatsSeen.length - 1] !== beat) run.beatsSeen.push(beat);
    return value;
  };
  const waitForRuntime = async (timeoutMs, note) => {
    const until = Date.now() + Math.min(timeoutMs, Math.max(1, remaining()));
    let value = null;
    while (Date.now() < until) {
      value = await observe('await-runtime', note);
      if (value) return value;
      await new Promise(resolve => setTimeout(resolve, POLL_MS));
    }
    return value;
  };
  const matches = (action, value, initial) => {
    if (action.equals !== undefined) return canonical(value) === canonical(action.equals);
    if (action.exists !== undefined) return action.exists ? value !== undefined && value !== null : value == null;
    if (action.changes !== undefined) return canonical(value) !== canonical(initial);
    if (action.atLeast !== undefined) return Number.isFinite(value) && value >= action.atLeast;
    if (action.includes !== undefined) return Array.isArray(value) && value.includes(action.includes);
    return false;
  };
  const perform = async (action, label) => {
    guard();
    const startedAt = Date.now();
    const gesture = { label, type: action.type, startedAt, detail: null, ok: false };
    if (action.type === 'key') {
      await page.keyboard.down(action.code);
      await new Promise(resolve => setTimeout(resolve, Math.min(action.holdMs ?? 120, MAX_HOLD_MS)));
      await page.keyboard.up(action.code);
      gesture.detail = { code: action.code, holdMs: action.holdMs ?? 120 };
    } else if (action.type === 'press') {
      await page.keyboard.press(action.code);
      gesture.detail = { code: action.code };
    } else if (action.type === 'text') {
      await page.keyboard.type(action.value, { delay: 30 });
      gesture.detail = { length: action.value.length };
    } else if (action.type === 'move') {
      await page.mouse.move(action.x, action.y, { steps: 12 });
      gesture.detail = { x: action.x, y: action.y };
    } else if (action.type === 'click') {
      if (action.selector) {
        const locator = page.locator(action.selector).first();
        await locator.waitFor({ state: 'visible', timeout: Math.min(action.timeoutMs ?? 10_000, Math.max(1, remaining())) });
        const box = await locator.boundingBox();
        requireThat(box, `Control ${action.selector} has no visible box to click`);
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
        await page.mouse.down({ button: action.button ?? 'left' });
        await page.mouse.up({ button: action.button ?? 'left' });
        gesture.detail = { selector: action.selector, box };
      } else {
        await page.mouse.move(action.x, action.y, { steps: 8 });
        await page.mouse.down({ button: action.button ?? 'left' });
        await page.mouse.up({ button: action.button ?? 'left' });
        gesture.detail = { x: action.x, y: action.y };
      }
      run.clickCount += 1;
    } else if (action.type === 'wait') {
      const initial = pointer(await snapshot(), action.pointer);
      const until = Date.now() + Math.min(action.timeoutMs, Math.max(1, remaining()));
      let satisfied = false;
      while (Date.now() < until && !satisfied) {
        const value = pointer(await observe('wait', action.pointer), action.pointer);
        satisfied = matches(action, value, initial);
        if (!satisfied) await new Promise(resolve => setTimeout(resolve, POLL_MS));
      }
      requireThat(satisfied, `${label}: bounded wait on ${action.pointer} was not satisfied`);
      gesture.detail = { pointer: action.pointer };
    } else if (action.type === 'waitSelector') {
      await page.locator(action.selector).first().waitFor({
        state: action.state ?? 'visible', timeout: Math.min(action.timeoutMs, Math.max(1, remaining()))
      });
      gesture.detail = { selector: action.selector, state: action.state ?? 'visible' };
    } else if (action.type === 'settle') {
      await new Promise(resolve => setTimeout(resolve, Math.min(action.ms, Math.max(1, remaining()))));
      gesture.detail = { ms: action.ms };
    }
    gesture.ok = true;
    gesture.endedAt = Date.now();
    gestures.push(gesture);
    await observe('after-action', label);
    return gesture;
  };
  const runSteps = async (steps, label) => {
    for (const [index, action] of steps.entries()) await perform(action, `${label}[${index}]`);
  };

  let passed = false;
  try {
    let url = options.preview ?? process.env.PARAVOXIA_URL ?? null;
    if (!url) {
      preview = await startParavoxiaPreview({ build: false, log: () => {} });
      url = preview.url;
      run.ownedPreview = true;
    }
    run.previewUrl = url;
    run.previewBefore = await verifyPreview(url, identity.ownership);
    const target = new URL(config.route, url).toString();
    run.url = target;

    const args = [...CHROMIUM_ARGS.filter(arg => arg !== '--enable-unsafe-swiftshader'), '--enable-gpu', '--use-angle=gl'];
    server = await chromium.launchServer({
      executablePath: chromePath(), headless: false, args,
      env: { ...process.env, DISPLAY: process.env.DISPLAY ?? ':0' },
      timeout: Math.min(60_000, Math.max(1, remaining()))
    });
    run.browserPid = server.process().pid;
    run.launchArgs = args;
    browser = await chromium.connect(server.wsEndpoint());
    context = await browser.newContext({ viewport: config.viewport });
    page = await context.newPage();
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: Math.min(90_000, Math.max(1, remaining())) });
    const renderer = await assertHardwareGl(page, () => {});
    run.renderer = renderer;
    proof.hardware = hardwareRenderer(renderer);
    requireThat(proof.hardware, 'Headed hardware GPU proof unavailable');

    if (config.readySelector) {
      await page.locator(config.readySelector).first()
        .waitFor({ state: 'visible', timeout: Math.min(MAX_WAIT_MS, Math.max(1, remaining())) });
    }
    const baseline = await waitForRuntime(MAX_WAIT_MS, 'baseline');
    requireThat(baseline, 'Read-only journey probe never became available');
    const baselineMilestones = pointer(baseline, '/state/localActor/milestones') ?? [];
    run.baselineMilestones = [...baselineMilestones];
    run.baselineCheckpoint = config.continue ? pointer(baseline, config.continue.checkpointPointer) ?? null : null;

    await runSteps(config.steps, 'steps');
    const afterSteps = await observe('after-steps');
    requireThat(afterSteps, 'Runtime snapshot unavailable after the declared actions');
    const firstMilestones = pointer(afterSteps, '/state/localActor/milestones') ?? [];
    const firstDelta = deltaProof(baseline, afterSteps, config.deltaPointers);
    run.firstDelta = firstDelta;
    run.acceptedActionNames = acceptedActionNames({
      baselineMilestones, milestones: firstMilestones, accepted: config.acceptedMilestones
    });
    // An accepted action must be *earned*: a milestone already present at
    // baseline is not proof, and a milestone with no observable runtime delta
    // is not an action.
    proof.acceptedAction = firstDelta.moved
      ? acceptedActionCount({ baselineMilestones, milestones: firstMilestones, accepted: config.acceptedMilestones })
      : 0;
    const receiptsMoved = receiptsAdvanced(baseline, afterSteps);
    run.receiptsAdvanced = receiptsMoved;
    proof.ordinaryControls = gestures.length > 0 && gestures.every(gesture => gesture.ok)
      && (receiptsMoved || firstDelta.moved);

    if (kind === 'manual') {
      const seen = run.beatsSeen;
      let cursor = 0;
      for (const beat of config.beats) {
        const found = seen.indexOf(beat, cursor);
        if (found < 0) { cursor = -1; break; }
        cursor = found + 1;
      }
      proof.completePath = config.beats.length > 0 && cursor >= 0 && config.completionMilestones.every(m =>
        firstMilestones.includes(m) && !baselineMilestones.includes(m));
      run.declaredBeats = config.beats;
    }

    if (kind === 'recovery') {
      await perform({ type: 'press', code: 'Escape' }, 'recovery.escape');
      const until = Date.now() + config.pause.timeoutMs;
      let pausedSnapshot = null;
      while (Date.now() < until && !pausedSnapshot) {
        const value = await observe('paused-check');
        if (value && canonical(pointer(value, config.pause.pausedPointer)) === canonical(config.pause.pausedValue)) {
          pausedSnapshot = value;
        } else await new Promise(resolve => setTimeout(resolve, POLL_MS));
      }
      const resume = page.locator(config.pause.resumeSelector).first();
      const resumeVisible = Boolean(pausedSnapshot) && await resume.isVisible().catch(() => false);
      proof.interrupted = Boolean(pausedSnapshot) && resumeVisible;
      run.pausedValue = pointer(pausedSnapshot, config.pause.pausedPointer) ?? null;
      requireThat(proof.interrupted, 'Escape did not produce a verified paused state with a visible resume control');
      await perform({ type: 'click', selector: config.pause.resumeSelector, timeoutMs: config.pause.timeoutMs }, 'recovery.resume');
      const untilResumed = Date.now() + config.pause.timeoutMs;
      let resumed = false;
      while (Date.now() < untilResumed && !resumed) {
        const value = await observe('resume-check');
        resumed = Boolean(value) && canonical(pointer(value, config.pause.pausedPointer)) !== canonical(config.pause.pausedValue);
        if (!resumed) await new Promise(resolve => setTimeout(resolve, POLL_MS));
      }
      proof.recovered = resumed;
      requireThat(resumed, 'Game did not resume after the visible resume control was clicked');
    }

    let beforeReload = afterSteps;
    let beforeMilestones = firstMilestones;
    if (kind === 'continue') {
      const checkpointBefore = pointer(afterSteps, config.continue.checkpointPointer) ?? null;
      // The checkpoint must be *earned in this session* by ordinary controls:
      // a checkpoint that already existed at baseline proves nothing.
      proof.freshCheckpoint = checkpointBefore != null
        && canonical(checkpointBefore) !== canonical(run.baselineCheckpoint);
      run.checkpointBefore = checkpointBefore;
      requireThat(proof.freshCheckpoint, 'No fresh checkpoint was earned with ordinary controls before reload');

      const durableBefore = canonicalDurableState(afterSteps, config.durablePointers);
      run.durableBefore = durableBefore;
      beforeMilestones = firstMilestones;

      // Same origin, same browser context: an ordinary page reload.
      await page.reload({ waitUntil: 'domcontentloaded', timeout: Math.min(90_000, Math.max(1, remaining())) });
      run.reloaded = { url: page.url(), sameOrigin: new URL(page.url()).origin === new URL(target).origin, sameContext: true };
      requireThat(run.reloaded.sameOrigin, 'Reload left the original origin');
      await observe('after-reload');

      // The landing Continue CTA must be VISIBLE before the story runtime is
      // ready; a CTA that only appears after the game has already booted is
      // not a landing resume affordance.
      const cta = page.locator(config.continue.ctaSelector).first();
      const untilCta = Date.now() + config.continue.timeoutMs;
      let ctaVisible = false, runtimeReadyAtCta = null;
      while (Date.now() < untilCta && !ctaVisible) {
        ctaVisible = await cta.isVisible().catch(() => false);
        if (ctaVisible) {
          const atCta = await observe('cta-visible');
          runtimeReadyAtCta = Boolean(atCta) && pointer(atCta, config.readyPointer) === true;
        } else {
          await observe('await-cta');
          await new Promise(resolve => setTimeout(resolve, POLL_MS));
        }
      }
      requireThat(ctaVisible, 'Landing Continue CTA never became visible after reload');
      proof.ctaBeforeRuntimeReady = runtimeReadyAtCta === false;
      run.runtimeReadyAtCta = runtimeReadyAtCta;

      const clicksBefore = run.clickCount;
      await perform({ type: 'click', selector: config.continue.ctaSelector, timeoutMs: config.continue.timeoutMs }, 'continue.click');
      proof.clickedContinue = run.clickCount === clicksBefore + 1;
      run.continueClicks = run.clickCount - clicksBefore;

      const afterClick = await waitForRuntime(config.continue.timeoutMs, 'first-runtime-after-continue');
      requireThat(afterClick, 'No runtime snapshot after clicking Continue');
      const durableAfter = canonicalDurableState(afterClick, config.durablePointers);
      run.durableAfter = durableAfter;
      proof.stateEqual = canonical(durableBefore) === canonical(durableAfter);
      requireThat(proof.stateEqual, 'Durable gameplay state did not survive the Continue reload');
      beforeReload = afterClick;
    }

    if (config.newActionSteps) {
      const preNew = await observe('before-new-action');
      requireThat(preNew, 'Runtime snapshot unavailable before the new action');
      const preMilestones = pointer(preNew, '/state/localActor/milestones') ?? [];
      await runSteps(config.newActionSteps, 'newActionSteps');
      const postNew = await observe('after-new-action');
      requireThat(postNew, 'Runtime snapshot unavailable after the new action');
      const postMilestones = pointer(postNew, '/state/localActor/milestones') ?? [];
      const newDelta = deltaProof(preNew, postNew, config.deltaPointers);
      run.newDelta = newDelta;
      // NEW: measured against everything held before the interruption/reload,
      // so a milestone that was already earned cannot be replayed as proof.
      const earned = new Set([...beforeMilestones, ...preMilestones]);
      run.newAcceptedActionNames = acceptedActionNames({
        baselineMilestones: [...earned], milestones: postMilestones, accepted: config.acceptedMilestones
      });
      proof.newAcceptedAction = newDelta.moved
        ? acceptedActionCount({ baselineMilestones: [...earned], milestones: postMilestones, accepted: config.acceptedMilestones })
        : 0;
      proof.ordinaryControls = proof.ordinaryControls && gestures.every(gesture => gesture.ok)
        && (receiptsAdvanced(preNew, postNew) || newDelta.moved);
    }

    run.previewAfter = await verifyPreview(url, identity.ownership);
    identity.verify();
    run.identityStable = true;
  } catch (error) {
    errors.push(error.message);
  } finally {
    clearTimeout(watchdog);
    for (const [signal, handler] of handlers) process.removeListener(signal, handler);
    const close = async (name, thing, method = 'close') => {
      if (!thing) { cleanup.closed[name] = 'absent'; return; }
      try { await thing[method](); cleanup.closed[name] = 'closed'; }
      catch (error) { cleanup.closed[name] = `failed: ${error.message}`; cleanup.errors.push(`${name}: ${error.message}`); }
    };
    await close('page', page);
    await close('context', context);
    await close('browser', browser);
    await close('browserServer', server);
    if (preview) { try { preview.stop(); cleanup.closed.preview = 'stopped'; } catch (error) { cleanup.errors.push(`preview: ${error.message}`); } }
    cleanup.phase = 'done';
    proof.cleanup = cleanup.errors.length === 0
      && ['page', 'context', 'browser'].every(name => ['closed', 'absent'].includes(cleanup.closed[name]));
  }

  run.gestures = gestures;
  run.proof = proof;
  const decision = verdict(kind, proof);
  passed = decision.passed && errors.length === 0;
  writeJson(path.join(raw, 'provenance.json'), run);
  writeJson(path.join(raw, 'cleanup.json'), cleanup);
  writeJson(path.join(raw, 'observations.json'), { trace: trace.slice(-400), pageErrors, errors });
  const rawRefs = fs.readdirSync(raw).filter(file => fs.statSync(path.join(raw, file)).isFile())
    .map(file => reference(artifactRoot, path.join(raw, file)));
  const report = {
    schema: 'paravoxia.chapterLoopProbe.v1',
    candidateSha256: process.env.CHAPTER_LOOP_CANDIDATE ?? null,
    kind, chapter: config.chapter, proof, missing: decision.missing,
    raw: rawRefs, media: [], artifactRoot,
    exitCode: passed ? 0 : 2, reused: false, status: passed ? 'passed' : 'inconclusive', errors,
    provenance: {
      sourceManifestSha256: identity.sourceManifestSha256,
      buildSha256: identity.buildSha256,
      transportSha256: run.transportSha256
    }
  };
  writeJson(path.join(out, 'report.json'), report);
  requireThat(passed, `PROBE-ERROR-INCONCLUSIVE: ${errors.join('; ') || decision.missing.join(', ')}`);
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const value = name => { const index = process.argv.indexOf(`--${name}`); return index < 0 ? undefined : process.argv[index + 1]; };
  const options = {
    repo: path.resolve(value('repo') ?? ROOT), chapter: value('chapter'), kind: value('case'),
    config: value('config'), preview: value('preview'), out: value('out')
  };
  try {
    if (process.argv.includes('--describe')) {
      const result = describeControlCapabilities(options);
      if (options.out) writeJson(path.join(options.out, 'capabilities.json'), result);
      console.log(JSON.stringify(result));
      if (!result.supported) process.exitCode = 2;
    } else {
      const report = await captureControls(options);
      console.log(JSON.stringify({ status: report.status, kind: report.kind, proof: report.proof }));
    }
  } catch (error) {
    console.error(`PROBE-ERROR-INCONCLUSIVE: ${error.message}`);
    process.exitCode = 2;
  }
}
