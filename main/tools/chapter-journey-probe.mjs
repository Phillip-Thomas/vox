#!/usr/bin/env node

/**
 * Contract-driven player-journey probe for Paravoxia chapters.
 *
 * This runner complements chapter-acceptance.mjs. It focuses on browser input,
 * interaction arbitration, prompt ownership, and reload/Continue seams. It
 * deliberately does not claim human taste, audiovisual quality, or continuity
 * from a direct story-beat jump.
 *
 * Examples:
 *   node tools/chapter-journey-probe.mjs --self-test
 *   node tools/chapter-journey-probe.mjs --chapter ch7 --lane direct-entry --mode manual --headed
 *   node tools/chapter-journey-probe.mjs --chapter ch4 --lane resume --base-url http://127.0.0.1:5173/
 */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MAIN_ROOT = path.resolve(HERE, '..');
const REPO_ROOT = path.resolve(MAIN_ROOT, '..');
const DEFAULT_MANIFEST = path.join(MAIN_ROOT, 'chapter-journey-contract.json');
const REPORT_SCHEMA = 'paravoxia.chapterJourneyEvidence.v1';
const CONTRACT_SCHEMA = 'paravoxia.chapterJourneyContract.v1';
const RUNTIME_BRIDGE = '__paravoxiaJourneyProbe';
const DIRECT_PREPARATION_SCENARIOS = new Set([
  'input:voyage-worker-name',
  'interaction:persistent-scar-arbitration'
]);
const DEFAULT_BASE_URL = process.env.PARAVOXIA_URL ?? 'http://127.0.0.1:5173/';
const DEFAULT_BROWSER = process.env.CHROME_PATH ?? '/snap/bin/chromium';
const DEFAULT_TIMEOUT_MS = 45_000;
const SOFTWARE_RENDERER_PATTERN = /(?:swiftshader|llvmpipe|softpipe|software(?:\s+rasterizer|\s+renderer|\s+rendering)?|mesa offscreen|lavapipe|swrast|microsoft basic render)/i;
const DISABLED_RENDERER_PATTERN = /(?:^|\b)(?:disabled|0xffff)(?:\b|$)/i;
const GENERIC_RENDERER_PATTERN = /^(?:webgl|webkit webgl|angle)$/i;

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sourceRevision() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: MAIN_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return 'unavailable';
  }
}

const HELP = `Paravoxia chapter journey probe

Usage:
  node tools/chapter-journey-probe.mjs --chapter <id> [options]
  node tools/chapter-journey-probe.mjs --self-test

Contract and chapter:
  --chapter <id>           Chapter id in main/chapter-journey-contract.json
  --manifest <path>        Override the journey contract manifest
  --scenario <id>          Run one named scenario

Journey identity:
  --lane <lane>            continuous | direct-entry | resume (default: continuous)
  --mode <mode>            manual | movie (default: manual)
  --continuous             Alias for --lane continuous
  --direct-entry           Alias for --lane direct-entry
  --resume                 Alias for --lane resume
  --manual                 Alias for --mode manual
  --movie                  Alias for --mode movie

Browser and output:
  --base-url <url>         Reuse an existing game server (default: ${DEFAULT_BASE_URL})
  --browser <path>         Chromium executable (default: CHROME_PATH or ${DEFAULT_BROWSER})
  --headed                 Use a headed browser
  --hardware-only          Require hardware WebGL through ANGLE; disable software fallback
  --profile <tier>         Graphics profile query (default: POTATO)
  --viewport <WxH>         Browser viewport (default: 1280x720)
  --timeout-ms <n>         Per-step timeout (default: ${DEFAULT_TIMEOUT_MS})
  --output <dir>           Evidence directory
  --report <path>          Exact JSON report path
  --run-id <id>            Stable caller-supplied run id
  --self-test              Browser-free mutation proof for every assertion family
`;

function safeSlug(value) {
  const slug = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'journey';
}

function failureScreenshotEvidence(screenshotPath, captured) {
  if (!captured) return {};
  return {
    failureScreenshot: path.relative(REPO_ROOT, screenshotPath).split(path.sep).join('/')
  };
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function uniqueStrings(value) {
  return [...new Set(asArray(value)
    .filter(item => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean))];
}

function deepGet(object, dottedPath) {
  if (!dottedPath) return object;
  return String(dottedPath)
    .split('.')
    .filter(Boolean)
    .reduce((value, key) => value?.[key], object);
}

function firstDefined(object, paths) {
  for (const candidate of paths) {
    const value = deepGet(object, candidate);
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function numberLike(value) {
  if (Array.isArray(value)) return value.length;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parsePositiveInteger(raw, label) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer; received ${raw}`);
  }
  return value;
}

function parseViewport(raw) {
  const match = String(raw).match(/^(\d+)[xX](\d+)$/);
  if (!match) throw new Error(`--viewport must use WxH syntax; received ${raw}`);
  return {
    width: parsePositiveInteger(match[1], 'viewport width'),
    height: parsePositiveInteger(match[2], 'viewport height')
  };
}

function parseArgs(argv) {
  const options = {
    chapter: null,
    manifest: DEFAULT_MANIFEST,
    scenario: null,
    lane: 'continuous',
    mode: 'manual',
    laneExplicit: false,
    modeExplicit: false,
    baseUrl: DEFAULT_BASE_URL,
    browser: DEFAULT_BROWSER,
    headed: false,
    hardwareOnly: false,
    profile: 'POTATO',
    viewport: { width: 1280, height: 720 },
    timeoutMs: DEFAULT_TIMEOUT_MS,
    output: null,
    report: null,
    runId: null,
    selfTest: false,
    help: false
  };
  const values = new Set([
    'chapter', 'manifest', 'scenario', 'lane', 'mode', 'base-url', 'url',
    'browser', 'profile', 'viewport', 'timeout-ms', 'output', 'report', 'run-id'
  ]);
  const booleans = new Set([
    'headed', 'continuous', 'direct-entry', 'resume', 'manual', 'movie',
    'hardware-only', 'self-test', 'help'
  ]);

  const setLane = (lane, source) => {
    if (options.laneExplicit && options.lane !== lane) {
      throw new Error(`Conflicting journey lanes: ${options.lane} and ${source}`);
    }
    options.lane = lane;
    options.laneExplicit = true;
  };
  const setMode = (mode, source) => {
    if (options.modeExplicit && options.mode !== mode) {
      throw new Error(`Conflicting control modes: ${options.mode} and ${source}`);
    }
    options.mode = mode;
    options.modeExplicit = true;
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`Unexpected positional argument: ${token}`);
    const equals = token.indexOf('=');
    const key = token.slice(2, equals >= 0 ? equals : undefined);
    if (!values.has(key) && !booleans.has(key)) throw new Error(`Unknown option --${key}`);
    if (booleans.has(key)) {
      if (equals >= 0) throw new Error(`--${key} does not take a value`);
      if (key === 'continuous') setLane('continuous', '--continuous');
      else if (key === 'direct-entry') setLane('direct-entry', '--direct-entry');
      else if (key === 'resume') setLane('resume', '--resume');
      else if (key === 'manual') setMode('manual', '--manual');
      else if (key === 'movie') setMode('movie', '--movie');
      else options[key.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())] = true;
      continue;
    }
    const value = equals >= 0 ? token.slice(equals + 1) : argv[++index];
    if (value == null || value.startsWith('--')) throw new Error(`--${key} requires a value`);
    switch (key) {
      case 'chapter': options.chapter = value; break;
      case 'manifest': options.manifest = path.resolve(value); break;
      case 'scenario': options.scenario = value; break;
      case 'lane': setLane(value, '--lane'); break;
      case 'mode': setMode(value, '--mode'); break;
      case 'base-url':
      case 'url': options.baseUrl = value; break;
      case 'browser': options.browser = path.resolve(value); break;
      case 'profile': options.profile = value.toUpperCase(); break;
      case 'viewport': options.viewport = parseViewport(value); break;
      case 'timeout-ms': options.timeoutMs = parsePositiveInteger(value, '--timeout-ms'); break;
      case 'output': options.output = path.resolve(value); break;
      case 'report': options.report = path.resolve(value); break;
      case 'run-id': options.runId = value; break;
      default: throw new Error(`Unhandled option --${key}`);
    }
  }

  if (!['continuous', 'direct-entry', 'resume'].includes(options.lane)) {
    throw new Error('--lane must be continuous, direct-entry, or resume');
  }
  if (!['manual', 'movie'].includes(options.mode)) {
    throw new Error('--mode must be manual or movie');
  }
  if (!options.help && !options.selfTest && !options.chapter) {
    throw new Error('--chapter is required unless --self-test is used');
  }
  return options;
}

function classifyLane({ lane, mode, headed }) {
  const reasons = [];
  if (lane === 'direct-entry') reasons.push('direct-entry-reconstructs-prerequisites-and-does-not-prove-continuity');
  if (mode === 'manual' && !headed) reasons.push('headless-scripted-input-does-not-prove-headed-pointer-lock');
  return {
    entryPath: lane,
    requestedControlMode: mode,
    observedInputDriver: mode === 'manual' ? 'playwright-trusted-browser-events' : 'game-movie-autopilot',
    humanOperated: false,
    headed: Boolean(headed),
    machineJourneyCertifying: reasons.length === 0,
    nonCertificationReasons: reasons,
    doesNotCertify: [
      'human-usability',
      'creative-taste',
      'audiovisual-quality',
      ...(headed ? [] : ['headed-pointer-lock'])
    ]
  };
}

function evaluateLaneClaim(lane) {
  const checks = [];
  checks.push(check('lane.human-claim', lane.humanOperated === false,
    'A Playwright journey must never be represented as human-operated'));
  if (lane.entryPath === 'direct-entry') {
    checks.push(check('lane.direct-entry-diagnostic', lane.machineJourneyCertifying === false,
      'Direct-entry reconstruction is diagnostic and cannot certify predecessor continuity'));
    checks.push(check('lane.direct-entry-reason', lane.nonCertificationReasons
      ?.includes('direct-entry-reconstructs-prerequisites-and-does-not-prove-continuity'),
    'Direct-entry evidence must state why it is noncertifying'));
  }
  if (lane.requestedControlMode === 'manual') {
    checks.push(check('lane.manual-driver', lane.observedInputDriver === 'playwright-trusted-browser-events',
      'Scripted manual lane must identify Playwright as its input driver'));
  }
  if (!lane.headed) {
    checks.push(check('lane.headless-pointer-lock-limit', lane.doesNotCertify?.includes('headed-pointer-lock'),
      'Headless evidence must not imply headed pointer-lock proof'));
  }
  return resultFromChecks(checks);
}

function browserLaunchArgs(options) {
  return [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--ignore-gpu-blocklist',
    '--enable-webgl',
    ...(options.hardwareOnly
      ? [
        '--enable-gpu',
        '--use-gl=angle',
        '--use-angle=gl-egl',
        '--disable-software-rasterizer'
      ]
      : options.headed ? ['--use-angle=gl'] : ['--enable-unsafe-swiftshader'])
  ];
}

function classifyWebGlRenderer(evidence) {
  if (evidence?.contextAvailable !== true) return 'unavailable';
  const identity = [
    evidence.unmaskedRenderer,
    evidence.renderer,
    evidence.unmaskedVendor,
    evidence.vendor
  ].filter(value => typeof value === 'string' && value.trim()).join(' | ');
  if (DISABLED_RENDERER_PATTERN.test(identity)) return 'unavailable';
  if (SOFTWARE_RENDERER_PATTERN.test(identity)) return 'software';
  const specificRenderer = [evidence.unmaskedRenderer, evidence.renderer]
    .find(value => typeof value === 'string'
      && value.trim().length > 0
      && !GENERIC_RENDERER_PATTERN.test(value.trim()));
  return specificRenderer ? 'hardware' : 'unknown';
}

function evaluateHardwareAttestation(evidence, required) {
  const classification = classifyWebGlRenderer(evidence);
  if (!required) {
    return {
      required: false,
      status: 'diagnostic',
      passed: null,
      classification,
      checks: [],
      failures: [],
      unavailable: []
    };
  }
  let evaluation;
  if (classification === 'unavailable') {
    evaluation = resultFromChecks([unavailable(
      'hardware.webgl-context',
      'Hardware-only journey could not create a WebGL context',
      evidence
    )]);
  } else if (classification === 'software') {
    evaluation = resultFromChecks([check(
      'hardware.renderer',
      false,
      'Hardware-only journey resolved to a software WebGL renderer',
      evidence
    )]);
  } else if (classification === 'unknown') {
    evaluation = resultFromChecks([unavailable(
      'hardware.renderer-identity',
      'Hardware-only journey could not prove a specific non-software renderer identity',
      evidence
    )]);
  } else {
    evaluation = resultFromChecks([check(
      'hardware.renderer',
      true,
      'A specific non-software WebGL renderer identity was captured',
      evidence
    )]);
  }
  return { required: true, classification, ...evaluation };
}

const TYPE_ALIASES = new Map([
  ['editable-field', 'editable-field'],
  ['editablefield', 'editable-field'],
  ['input', 'editable-field'],
  ['prompt-ownership', 'prompt-ownership'],
  ['interaction-prompt', 'prompt-ownership'],
  ['prompt', 'prompt-ownership'],
  ['prompt-arbitration', 'interaction-effect'],
  ['interaction-effect', 'interaction-effect'],
  ['interaction', 'interaction-effect'],
  ['entry-state', 'entry-state'],
  ['entrystate', 'entry-state'],
  ['entry', 'entry-state'],
  ['entity-lifecycle', 'reload-continue'],
  ['reload-continue', 'reload-continue'],
  ['resume', 'reload-continue'],
  ['reload', 'reload-continue']
]);

function normalizeScenario(raw, index, inherited = {}) {
  if (!isRecord(raw)) throw new Error(`scenario[${index}] must be an object`);
  const typeKey = String(inherited.type ?? raw.type ?? raw.kind ?? '').toLowerCase().replace(/_/g, '-');
  const type = TYPE_ALIASES.get(typeKey);
  if (!type) throw new Error(`scenario[${index}] has unsupported type ${typeKey || '(missing)'}`);
  const id = String(raw.id ?? `${type}-${index + 1}`).trim();
  if (!id) throw new Error(`scenario[${index}].id must be non-empty`);
  return {
    ...inherited,
    ...raw,
    id,
    type,
    required: raw.required !== false,
    lanes: uniqueStrings(raw.lanes ?? raw.entryPaths ?? inherited.lanes),
    modes: uniqueStrings(raw.modes ?? raw.controlModes ?? inherited.modes),
    entryBeat: raw.entryBeat ?? raw.beat ?? raw.entry?.beat ?? inherited.entryBeat ?? null,
    timeoutMs: raw.timeoutMs == null
      ? inherited.timeoutMs ?? DEFAULT_TIMEOUT_MS
      : parsePositiveInteger(raw.timeoutMs, `${id}.timeoutMs`)
  };
}

function normalizeManifest(raw, chapterId, defaultTimeoutMs = DEFAULT_TIMEOUT_MS) {
  if (!isRecord(raw)) throw new Error('Journey manifest must be a JSON object');
  if (raw.schema !== CONTRACT_SCHEMA) {
    throw new Error(`Journey manifest schema must equal ${CONTRACT_SCHEMA}; received ${raw.schema ?? 'missing'}`);
  }
  let chapters = raw.chapters;
  if (isRecord(chapters)) {
    chapters = Object.entries(chapters).map(([id, chapter]) => ({ id, ...chapter }));
  }
  if (!Array.isArray(chapters)) throw new Error('Journey manifest chapters must be an array or id-keyed object');
  const chapter = chapters.find(candidate => candidate?.id === chapterId || candidate?.chapterId === chapterId);
  if (!chapter) throw new Error(`Chapter ${chapterId} is not registered in the journey manifest`);

  const inherited = {
    entryBeat: chapter.entryBeat ?? chapter.entry?.beat ?? null,
    runtimeBridge: chapter.runtimeBridge ?? raw.runtimeBridge ?? RUNTIME_BRIDGE,
    timeoutMs: chapter.timeoutMs ?? raw.timeoutMs ?? defaultTimeoutMs,
    query: { ...(raw.query ?? {}), ...(chapter.query ?? {}) }
  };
  const scenarios = [];
  const add = (values, type, project = value => value) => {
    for (const value of asArray(values)) {
      scenarios.push(normalizeScenario(project(value), scenarios.length, { ...inherited, type }));
    }
  };
  add(chapter.scenarios ?? chapter.journeys, null);
  add(chapter.editableFields ?? chapter.inputContracts, 'editable-field', contract => ({
    ...contract,
    expectedValue: contract.expectedValue ?? contract.testValue,
    typedValue: contract.typedValue ?? contract.testValue,
    afterSubmit: contract.afterSubmit
      ?? (contract.completionEvidenceRef
        ? [parseContractEvidenceAssertion(contract.completionEvidenceRef)]
        : undefined),
    requireHotkeyIsolation: contract.requireHotkeyIsolation
      ?? contract.assertions?.globalShortcutsSuppressed,
    requireSubmitCount: contract.requireSubmitCount
      ?? contract.assertions?.submitExactlyOnce,
    requirePersistedValue: contract.requirePersistedValue
      ?? contract.assertions?.valuePersistsAfterSubmit,
    requireTrustedInput: contract.requireTrustedInput ?? true,
    modes: contract.modes ?? ['manual']
  }));
  add(chapter.promptContracts ?? chapter.promptOwnership, 'prompt-ownership');
  add(chapter.entryStateContracts ?? chapter.entryStates, 'entry-state', contract => {
    if (asArray(contract.assertions).length === 0) {
      throw new Error(`${contract.id ?? 'entry-state'} must declare at least one runtime assertion`);
    }
    return {
      ...contract,
      assertions: asArray(contract.assertions),
      lanes: contract.lanes ?? ['direct-entry']
    };
  });
  add(chapter.interactionContracts ?? chapter.interactions, 'interaction-effect', contract => ({
    ...contract,
    requiredWinnerIds: contract.requiredWinnerIds ?? contract.requiredInteractionIds,
    forbiddenWinnerIds: contract.forbiddenWinnerIds
      ?? (contract.optionalInteractionId ? [contract.optionalInteractionId] : []),
    requireEffect: contract.requireEffect ?? contract.rules?.noOpForbidden ?? true,
    staleClear: contract.staleClear ?? contract.rules?.suppressWhenAlreadyRecorded ?? false,
    maxCount: contract.maxCount ?? contract.rules?.maxVisiblePrompts ?? 1,
    feedbackWithinMs: contract.feedbackWithinMs ?? contract.rules?.feedbackWithinMs,
    promptSelector: contract.promptSelector ?? '[data-interaction-prompt], [data-interaction-id]'
  }));
  add(chapter.resumeScenarios ?? chapter.reloadScenarios, 'reload-continue');
  add(asArray(chapter.lifecycleContracts).filter(contract => contract?.resume?.required), 'reload-continue', contract => ({
    ...contract,
    playAfterContinue: contract.resume?.playAfterContinue ?? true,
    continue: {
      required: true,
      expectedBeat: contract.resume?.continueToBeat ?? null
    },
    triggerRef: contract.triggerRef,
    firstPostReloadAssertions: asArray(contract.resume?.assertOnFirstFrame)
      .map(parseContractEvidenceAssertion),
    afterContinueAssertions: contract.resume?.continueToBeat
      ? [{ path: 'beat', equals: contract.resume.continueToBeat }]
      : []
  }));
  const duplicate = scenarios.find((scenario, index) => scenarios.findIndex(item => item.id === scenario.id) !== index);
  if (duplicate) throw new Error(`Chapter ${chapterId} repeats scenario id ${duplicate.id}`);
  return {
    schema: raw.schema,
    version: raw.version ?? 1,
    chapter: { ...chapter, id: chapterId },
    scenarios
  };
}

function parseContractEvidenceAssertion(reference) {
  if (isRecord(reference)) return reference;
  const raw = String(reference ?? '').trim();
  const entity = raw.match(/^entity:([^/]+)\/(mounted|visible|phase|position)=(.+)$/);
  if (entity) {
    const [, id, field, encoded] = entity;
    const value = encoded === 'true' ? true : encoded === 'false' ? false : encoded;
    return { id: raw, path: `runtime.entities.${id}.${field}`, equals: value };
  }
  const state = raw.match(/^state:([^=]+)=(.+)$/);
  if (state) return { id: raw, path: `runtime.state.${state[1].replaceAll('/', '.')}`, equals: state[2] };
  const milestone = raw.match(/^(?:milestone:)?(.+)$/);
  return { id: raw, receipt: milestone?.[1] ?? raw };
}

function scenarioApplies(scenario, lane) {
  const composite = `${lane.entryPath}:${lane.requestedControlMode}`;
  const laneMatch = scenario.lanes.length === 0
    || scenario.lanes.includes(lane.entryPath)
    || scenario.lanes.includes(composite);
  const modeMatch = scenario.modes.length === 0
    || scenario.modes.includes(lane.requestedControlMode)
    || scenario.modes.includes(composite);
  return laneMatch && modeMatch;
}

function resultFromChecks(checks) {
  const failures = checks.filter(check => check.status === 'failed');
  const unavailable = checks.filter(check => check.status === 'unavailable');
  return {
    status: failures.length > 0 ? 'failed' : unavailable.length > 0 ? 'blocked' : 'passed',
    passed: failures.length === 0 && unavailable.length === 0,
    checks,
    failures: failures.map(check => `${check.id}: ${check.message}`),
    unavailable: unavailable.map(check => `${check.id}: ${check.message}`)
  };
}

function check(id, pass, message, evidence = undefined) {
  return { id, status: pass ? 'passed' : 'failed', message, ...(evidence === undefined ? {} : { evidence }) };
}

function unavailable(id, message, evidence = undefined) {
  return { id, status: 'unavailable', message, ...(evidence === undefined ? {} : { evidence }) };
}

function evaluateEditableEvidence(contract, evidence) {
  const checks = [];
  const expectedValue = contract.expectedValue ?? evidence.typedValue;
  checks.push(check('editable.exists', evidence.field?.exists === true, 'Editable field must exist', evidence.field));
  checks.push(check('editable.visible', evidence.field?.visible === true, 'Editable field must be visibly rendered'));
  checks.push(check('editable.real-control', evidence.field?.realEditableControl === true,
    'Visible naming surface must be an input, textarea, or contenteditable control'));
  checks.push(check('editable.focus-before-type', evidence.field?.focusedBeforeTyping === true,
    'Trusted click must focus the actual editable control'));
  checks.push(check('editable.focus-after-type', evidence.field?.focusedAfterTyping === true,
    'Typing must not lose editable focus'));
  checks.push(check('editable.value', evidence.field?.valueAfterTyping === expectedValue,
    `Typed value must equal ${JSON.stringify(expectedValue)}`, evidence.field?.valueAfterTyping));

  if (contract.requireTrustedInput !== false) {
    checks.push(check('editable.trusted-typing', evidence.inputEvents?.typedKeyCount > 0
      && evidence.inputEvents?.typedKeysTrusted === true,
    'Typing evidence must contain trusted browser key events', evidence.inputEvents));
    checks.push(check('editable.one-trusted-enter', evidence.inputEvents?.enterKeyCount === 1
      && evidence.inputEvents?.enterTrusted === true,
    'Exactly one trusted Enter key event must be issued', evidence.inputEvents));
  }

  if (contract.requireHotkeyIsolation !== false) {
    if (evidence.hotkeys?.before == null || evidence.hotkeys?.after == null) {
      checks.push(unavailable('editable.hotkey-isolation',
        'Runtime bridge did not publish input.hotkeyActivations evidence'));
    } else {
      checks.push(check('editable.hotkey-isolation', evidence.hotkeys.after === evidence.hotkeys.before,
        'Gameplay hotkeys must not activate while the editable field owns keyboard input', evidence.hotkeys));
    }
  }

  if (contract.requireSubmitCount !== false) {
    if (evidence.submit?.before == null || evidence.submit?.after == null) {
      checks.push(unavailable('editable.submit-count',
        'Runtime bridge did not publish input.submitCount evidence'));
    } else {
      checks.push(check('editable.submit-count', evidence.submit.after - evidence.submit.before === 1,
        'One Enter keypress must produce exactly one application submission', evidence.submit));
    }
  }
  if (contract.requirePersistedValue !== false) {
    if (evidence.persistedValue == null) {
      checks.push(unavailable('editable.persisted-value',
        'Runtime bridge did not publish the application-persisted input value'));
    } else {
      checks.push(check('editable.persisted-value', evidence.persistedValue === expectedValue,
        `Application-persisted value must equal ${JSON.stringify(expectedValue)}`, evidence.persistedValue));
    }
  }
  return resultFromChecks(checks);
}

function evaluatePromptEvidence(contract, evidence) {
  const checks = [];
  const prompts = asArray(evidence.prompts).filter(prompt => prompt.visible);
  const minimum = contract.expectedCount != null
    ? Number(contract.expectedCount)
    : contract.requiredVisible === true ? 1 : 0;
  const maximum = contract.expectedCount != null ? Number(contract.expectedCount) : Number(contract.maxCount ?? 1);
  checks.push(check('prompt.minimum-count', prompts.length >= minimum,
    `Expected at least ${minimum} visible interaction prompt(s)`, { count: prompts.length }));
  checks.push(check('prompt.single-owner', prompts.length <= maximum,
    `Expected no more than ${maximum} visible interaction prompt(s)`, { count: prompts.length }));
  for (const [index, prompt] of prompts.entries()) {
    if (contract.requireOwner !== false) {
      checks.push(check(`prompt.${index}.owner`, Boolean(prompt.ownerId),
        'Every visible interaction prompt must publish one owner id', prompt));
    }
    if (contract.expectedOwnerId) {
      checks.push(check(`prompt.${index}.expected-owner`, prompt.ownerId === contract.expectedOwnerId,
        `Visible prompt owner must be ${contract.expectedOwnerId}`, prompt.ownerId));
    }
    if (contract.requireInsideViewport !== false) {
      checks.push(check(`prompt.${index}.inside-viewport`, prompt.insideViewport === true,
        'Visible prompt geometry must remain inside the viewport', prompt.rect));
    }
    checks.push(check(`prompt.${index}.no-overlap`, asArray(prompt.overlaps).length === 0,
      'Interaction prompt must not overlap protected HUD or another prompt', prompt.overlaps));
    for (const forbidden of uniqueStrings(contract.forbiddenOwnerIds)) {
      checks.push(check(`prompt.${index}.forbidden-owner.${safeSlug(forbidden)}`, prompt.ownerId !== forbidden,
        `Forbidden stale prompt owner ${forbidden} must not be visible`, prompt.ownerId));
    }
  }
  return resultFromChecks(checks);
}

function interactionView(snapshot) {
  const interaction = snapshot?.interaction;
  if (!isRecord(interaction)) return null;
  const candidates = asArray(interaction.candidates);
  const winner = interaction.winner ?? interaction.selected ?? null;
  const traceSource = interaction.trace ?? interaction.effects ?? snapshot?.effects;
  const trace = Array.isArray(traceSource)
    ? traceSource
    : Array.isArray(traceSource?.entries) ? traceSource.entries : asArray(interaction.effects);
  return { candidates, winner, trace };
}

function itemId(item) {
  if (typeof item === 'string') return item;
  if (!isRecord(item)) return null;
  return item.id ?? item.interactionId ?? item.candidateId ?? item.effectId ?? item.receipt ?? item.type ?? null;
}

function receiptIds(snapshot) {
  const source = snapshot?.receipts ?? snapshot?.milestones ?? snapshot?.progression?.receipts;
  if (Array.isArray(source)) return uniqueStrings(source);
  if (isRecord(source)) {
    return [...new Set(Object.values(source).flatMap(value => {
      if (Array.isArray(value)) return uniqueStrings(value);
      if (isRecord(value)) return uniqueStrings(value.milestones ?? value.receipts);
      return [];
    }))];
  }
  return [];
}

function traceDelta(before, after) {
  const prior = asArray(before);
  const next = asArray(after);
  let prefix = prior.length <= next.length;
  for (let index = 0; prefix && index < prior.length; index += 1) {
    if (JSON.stringify(prior[index]) !== JSON.stringify(next[index])) prefix = false;
  }
  if (prefix) return next.slice(prior.length);
  const remaining = new Map();
  for (const entry of prior) {
    const key = JSON.stringify(entry);
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }
  return next.filter(entry => {
    const key = JSON.stringify(entry);
    const count = remaining.get(key) ?? 0;
    if (count <= 0) return true;
    remaining.set(key, count - 1);
    return false;
  });
}

function matchesEvidenceId(item, expected) {
  if (!expected) return true;
  if (itemId(item) === expected) return true;
  if (!isRecord(item)) return false;
  return [item.id, item.effectId, item.interactionId, item.receipt, item.type, item.kind]
    .some(value => value === expected);
}

function isNoOpEffect(item) {
  if (!isRecord(item)) return /no[-_ ]?op/i.test(String(item));
  return item.noop === true
    || item.changed === false
    || /no[-_ ]?op|ignored|stale|failed|threw/i.test(String(
      item.performOutcome ?? item.outcome ?? item.status ?? item.kind ?? ''
    ));
}

function isPositiveEffect(item) {
  if (!isRecord(item)) return !isNoOpEffect(item);
  if (isNoOpEffect(item)) return false;
  if (item.changed === true || item.succeeded === true) return true;
  const outcome = String(item.performOutcome ?? item.outcome ?? item.status ?? item.kind ?? '');
  if (/^(?:succeeded|changed|committed|completed|applied|cleared|replaced)$/i.test(outcome)) return true;
  // A resolver returning without throwing proves only that its handler ran. It
  // is intentionally not accepted as an observable gameplay effect.
  return false;
}

function evaluateInteractionEvidence(contract, evidence) {
  if (!evidence.runtime?.available) {
    return resultFromChecks([unavailable('interaction.runtime-bridge',
      `Required runtime bridge ${contract.runtimeBridge ?? RUNTIME_BRIDGE} is unavailable`, evidence.runtime)]);
  }
  const checks = [];
  const before = interactionView(evidence.before);
  const after = interactionView(evidence.after);
  if (!before || !after) {
    return resultFromChecks([unavailable('interaction.snapshot',
      'Runtime bridge did not publish interaction candidates, winner, and trace/effects')]);
  }
  const candidateIds = before.candidates.map(itemId).filter(Boolean);
  const winnerId = itemId(before.winner);
  checks.push(check('interaction.candidate-list', Array.isArray(before.candidates),
    'Runtime interaction snapshot must publish its candidate list'));
  if (contract.expectedCandidateId) {
    checks.push(check('interaction.expected-candidate', candidateIds.includes(contract.expectedCandidateId),
      `Expected interaction candidate ${contract.expectedCandidateId} must be eligible`, candidateIds));
  }
  for (const forbidden of uniqueStrings(contract.forbiddenCandidateIds)) {
    checks.push(check(`interaction.forbidden-candidate.${safeSlug(forbidden)}`, !candidateIds.includes(forbidden),
      `Forbidden interaction candidate ${forbidden} must not be eligible`, candidateIds));
  }
  if (contract.allowNoWinner !== true) {
    checks.push(check('interaction.winner-present', Boolean(winnerId),
      'Runtime interaction arbitration must choose one winner', before.winner));
  }
  if (winnerId) {
    checks.push(check('interaction.winner-is-candidate', candidateIds.includes(winnerId),
      'Interaction winner must be drawn from the published candidate set', { winnerId, candidateIds }));
  }
  if (contract.expectedWinnerId) {
    checks.push(check('interaction.expected-winner', winnerId === contract.expectedWinnerId,
      `Interaction winner must be ${contract.expectedWinnerId}`, winnerId));
  }
  const requiredWinnerIds = uniqueStrings(contract.requiredWinnerIds);
  const eligibleRequiredIds = requiredWinnerIds.filter(id => candidateIds.includes(id));
  if (eligibleRequiredIds.length > 0) {
    checks.push(check('interaction.required-wins', eligibleRequiredIds.includes(winnerId),
      'An eligible mandatory interaction must outrank optional interactions', {
        winnerId,
        eligibleRequiredIds
      }));
  }
  for (const forbidden of uniqueStrings(contract.forbiddenWinnerIds)) {
    const requiredCandidateExists = eligibleRequiredIds.length > 0;
    if (requiredCandidateExists || contract.forbidWinnerAlways === true) {
      checks.push(check(`interaction.forbidden-winner.${safeSlug(forbidden)}`, winnerId !== forbidden,
        `Optional or forbidden interaction ${forbidden} must not win while required work is eligible`, winnerId));
    }
  }

  const newTrace = evidence.newTrace ?? traceDelta(before.trace, after.trace);
  const beforeReceipts = receiptIds(evidence.before);
  const newReceipts = receiptIds(evidence.after).filter(receipt => !beforeReceipts.includes(receipt));
  const expectedEffect = contract.expectedEffectId ?? contract.expectedReceipt ?? null;
  if (contract.requireEffect !== false) {
    const matchingTrace = newTrace.some(item => matchesEvidenceId(item, expectedEffect) && isPositiveEffect(item));
    const matchingReceipt = expectedEffect ? newReceipts.includes(expectedEffect) : newReceipts.length > 0;
    checks.push(check('interaction.effect', matchingTrace || matchingReceipt,
      expectedEffect
        ? `Interaction must produce effect or receipt ${expectedEffect}`
        : 'Interaction must produce a runtime effect or new receipt',
    { newTrace, newReceipts }));
    checks.push(check('interaction.not-no-op', !newTrace.some(isNoOpEffect),
      'Chosen interaction must not resolve as a no-op, ignored action, or stale action', newTrace));
  }

  if (contract.feedbackWithinMs != null) {
    const feedbackLimit = Number(contract.feedbackWithinMs);
    const matchingEntry = newTrace.find(item => matchesEvidenceId(item, expectedEffect))
      ?? newTrace[0];
    const feedbackLatency = numberLike(matchingEntry?.clearingLatencyMs);
    checks.push(check('interaction.feedback-latency', feedbackLatency !== null
      && feedbackLatency <= feedbackLimit,
    `The performed prompt must visibly clear or replace within ${feedbackLimit}ms`, {
      feedbackLatencyMs: feedbackLatency,
      limitMs: feedbackLimit
    }));
  }

  if (contract.staleClear === true || isRecord(contract.staleClear)) {
    const staleId = contract.staleInteractionId
      ?? contract.staleClear?.interactionId
      ?? contract.expectedWinnerId
      ?? winnerId;
    const cleared = interactionView(evidence.cleared);
    if (!cleared) {
      checks.push(unavailable('interaction.stale-clear',
        'No post-effect runtime snapshot was available for stale prompt clearance'));
    } else {
      const clearedIds = cleared.candidates.map(itemId).filter(Boolean);
      checks.push(check('interaction.stale-winner-cleared', itemId(cleared.winner) !== staleId,
        `Completed interaction ${staleId} must stop winning arbitration`, itemId(cleared.winner)));
      checks.push(check('interaction.stale-candidate-cleared', !clearedIds.includes(staleId),
        `Completed interaction ${staleId} must leave the candidate set`, clearedIds));
      if (evidence.stalePromptOwnerId !== undefined) {
        checks.push(check('interaction.stale-prompt-cleared', evidence.stalePromptOwnerId !== staleId,
          `Completed interaction ${staleId} must clear its visible prompt`, evidence.stalePromptOwnerId));
      }
    }
  }
  return resultFromChecks(checks);
}

function assertionLabel(assertion, index) {
  return assertion.id ?? `${assertion.path ?? assertion.selector ?? 'assertion'}-${index + 1}`;
}

function evaluateObjectAssertions(snapshot, assertions, prefix) {
  const checks = [];
  if (asArray(assertions).length > 0 && snapshot == null) {
    return [unavailable(`${prefix}.runtime-snapshot`, 'Required runtime snapshot is unavailable')];
  }
  for (const [index, raw] of asArray(assertions).entries()) {
    const assertion = typeof raw === 'string' ? { path: raw, truthy: true } : raw;
    if (!isRecord(assertion) || !assertion.path) {
      checks.push(check(`${prefix}.assertion-${index + 1}`, false, 'Runtime assertion must declare a dotted path'));
      continue;
    }
    const value = deepGet(snapshot, assertion.path);
    let pass;
    let expected;
    if (Object.hasOwn(assertion, 'equals')) {
      pass = Object.is(value, assertion.equals);
      expected = { equals: assertion.equals };
    } else if (Object.hasOwn(assertion, 'notEquals')) {
      pass = !Object.is(value, assertion.notEquals);
      expected = { notEquals: assertion.notEquals };
    } else if (Object.hasOwn(assertion, 'includes')) {
      pass = Array.isArray(value)
        ? value.includes(assertion.includes)
        : typeof value === 'string' && value.includes(assertion.includes);
      expected = { includes: assertion.includes };
    } else if (Object.hasOwn(assertion, 'excludes')) {
      pass = Array.isArray(value)
        ? !value.includes(assertion.excludes)
        : typeof value === 'string' ? !value.includes(assertion.excludes) : true;
      expected = { excludes: assertion.excludes };
    } else if (Object.hasOwn(assertion, 'exists')) {
      pass = assertion.exists ? value !== undefined && value !== null : value === undefined || value === null;
      expected = { exists: assertion.exists };
    } else {
      const truthy = assertion.truthy !== false;
      pass = truthy ? Boolean(value) : !value;
      expected = { truthy };
    }
    const id = assertionLabel(assertion, index);
    checks.push(check(`${prefix}.${safeSlug(id)}`, pass,
      `Expected ${assertion.path} to satisfy ${JSON.stringify(expected)}`, { actual: value }));
  }
  return checks;
}

function evaluateEntryStateEvidence(contract, evidence) {
  const checks = [];
  checks.push(check('entry-state.runtime-available', evidence.runtime?.available === true,
    'Entry-state verification requires the live journey runtime bridge', evidence.runtime));
  checks.push(check('entry-state.assertions-declared', asArray(contract.assertions).length > 0,
    'Entry-state verification must declare at least one runtime assertion'));
  if (evidence.runtime?.available === true) {
    checks.push(...evaluateObjectAssertions(evidence.snapshot, contract.assertions, 'entry-state'));
  }
  if (contract.actionKey) {
    checks.push(check('entry-state.action-rendered-frames', (evidence.actionInput?.renderedFrames ?? 0) >= 1,
      'Entry-state action must be held across at least one rendered frame', evidence.actionInput));
    checks.push(...evaluateObjectAssertions(
      evidence.afterAction?.snapshot,
      contract.afterActionAssertions,
      'entry-state.after-action'
    ));
  }
  return resultFromChecks(checks);
}

function evaluateReloadEvidence(contract, evidence) {
  const checks = [];
  checks.push(check('reload.planned', evidence.planned === true,
    'Reload must be explicitly armed by the journey runner'));
  checks.push(check('reload.exactly-once', evidence.reloadCount === 1,
    'Resume scenario must perform exactly one deliberate reload', evidence.reloadCount));
  checks.push(check('reload.new-document', Boolean(evidence.bootBefore)
    && Boolean(evidence.bootAfter) && evidence.bootBefore !== evidence.bootAfter,
  'Reload must create a new browser document', { before: evidence.bootBefore, after: evidence.bootAfter }));

  const continueRequired = contract.continue?.required ?? contract.continueRequired ?? true;
  if (continueRequired) {
    checks.push(check('reload.continue-visible', evidence.continue?.visible === true,
      'A visible Continue control must own resume entry', evidence.continue));
    checks.push(check('reload.continue-exactly-once', evidence.continue?.clicks === 1,
      'Resume scenario must activate Continue exactly once', evidence.continue));
  } else {
    checks.push(check('reload.no-implicit-continue-click', (evidence.continue?.clicks ?? 0) === 0,
      'Auto-resume contract must not fabricate a Continue click', evidence.continue));
  }

  if (contract.requireRuntimeEvidence !== false) {
    if (!evidence.firstPostReload) {
      checks.push(unavailable('reload.first-runtime-sample',
        'Runtime bridge did not publish a first post-reload sample'));
    } else {
      checks.push(check('reload.first-runtime-sample', true,
        'First post-reload runtime sample was captured'));
    }
    if (!evidence.afterContinue) {
      checks.push(unavailable('reload.after-continue-sample',
        'Runtime bridge did not publish a post-Continue sample'));
    }
  }
  checks.push(...evaluateObjectAssertions(
    evidence.firstPostReload,
    contract.firstPostReloadAssertions ?? contract.assertFirstFrame,
    'reload.first'
  ));
  checks.push(...evaluateObjectAssertions(
    evidence.afterContinue,
    contract.afterContinueAssertions ?? contract.assertAfterContinue,
    'reload.after-continue'
  ));
  return resultFromChecks(checks);
}

async function installBrowserHarness(page, runtimeBridge) {
  await page.addInitScript(({ runtimeBridge: configuredBridge }) => {
    const bootId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const events = [];
    const describeTarget = target => {
      if (!(target instanceof HTMLElement)) return { tag: null, name: null, testId: null };
      return {
        tag: target.tagName.toLowerCase(),
        name: target.getAttribute('name'),
        testId: target.getAttribute('data-testid'),
        journeyInput: target.getAttribute('data-voyage-worker-name-input')
      };
    };
    const push = entry => {
      events.push({ at: performance.now(), ...entry });
      if (events.length > 500) events.splice(0, events.length - 500);
    };
    window.__chapterJourneyHarness = {
      schema: 'paravoxia.chapterJourneyBrowserHarness.v1',
      bootId,
      events,
      reloadCapture: null
    };
    document.addEventListener('keydown', event => push({
      type: 'keydown', key: event.key, code: event.code, trusted: event.isTrusted,
      repeat: event.repeat, target: describeTarget(event.target)
    }), true);
    document.addEventListener('input', event => push({
      type: 'input', trusted: event.isTrusted, target: describeTarget(event.target),
      value: event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement
        ? event.target.value : null
    }), true);
    document.addEventListener('submit', event => push({
      type: 'submit', trusted: event.isTrusted, target: describeTarget(event.target)
    }), true);

    const resolveBridge = () => {
      const candidates = [
        configuredBridge,
        '__paravoxiaJourneyProbe',
        '__paravoxiaInteractionProbe'
      ];
      for (const name of candidates) {
        if (!name) continue;
        const parts = String(name).replace(/^window\./, '').split('.').filter(Boolean);
        let value = window;
        for (const part of parts) value = value?.[part];
        if (value && (typeof value.snapshot === 'function' || typeof value.getSnapshot === 'function')) {
          return value;
        }
      }
      return null;
    };
    const clone = value => {
      try { return JSON.parse(JSON.stringify(value)); } catch { return null; }
    };
    const armed = sessionStorage.getItem('paravoxia.chapterJourney.reloadArmed.v1') === '1';
    if (armed) {
      sessionStorage.removeItem('paravoxia.chapterJourney.reloadArmed.v1');
      const capture = {
        schema: 'paravoxia.chapterJourneyReloadCapture.v1',
        armed: true,
        frames: 0,
        firstRuntime: null,
        firstPlaying: null,
        samples: []
      };
      window.__chapterJourneyHarness.reloadCapture = capture;
      const sample = () => {
        capture.frames += 1;
        const bridge = resolveBridge();
        let runtime = null;
        try {
          runtime = bridge
            ? (bridge.snapshot?.() ?? bridge.getSnapshot?.() ?? null)
            : null;
        } catch { runtime = null; }
        const entry = runtime ? {
          capturedAt: Date.now(),
          beat: window.__storyBeat ?? null,
          app: clone(window.__paravoxiaAppState ?? null),
          runtime: clone(runtime)
        } : null;
        if (entry && !capture.firstRuntime) capture.firstRuntime = entry;
        if (entry && entry.app?.phase === 'playing' && !capture.firstPlaying) capture.firstPlaying = entry;
        if (entry && capture.samples.length < 20) capture.samples.push(entry);
        if (capture.frames < 600 && (!capture.firstPlaying || capture.frames < 5)) {
          requestAnimationFrame(sample);
        }
      };
      requestAnimationFrame(sample);
    }
  }, { runtimeBridge });
}

async function readHarness(page) {
  return page.evaluate(() => {
    const harness = window.__chapterJourneyHarness;
    if (!harness) return null;
    return {
      schema: harness.schema,
      bootId: harness.bootId,
      events: [...harness.events],
      reloadCapture: harness.reloadCapture ? JSON.parse(JSON.stringify(harness.reloadCapture)) : null
    };
  });
}

async function readRuntimeBridge(page, runtimeBridge) {
  return page.evaluate(configuredBridge => {
    const names = [configuredBridge, '__paravoxiaJourneyProbe', '__paravoxiaInteractionProbe'];
    for (const name of names) {
      if (!name) continue;
      const parts = String(name).replace(/^window\./, '').split('.').filter(Boolean);
      let bridge = window;
      for (const part of parts) bridge = bridge?.[part];
      if (!bridge) continue;
      const reader = typeof bridge.snapshot === 'function'
        ? bridge.snapshot.bind(bridge)
        : typeof bridge.getSnapshot === 'function' ? bridge.getSnapshot.bind(bridge) : null;
      if (!reader) continue;
      try {
        const snapshot = reader();
        if (!snapshot || typeof snapshot !== 'object') {
          return { available: false, bridge: name, reason: 'snapshot-was-not-an-object', snapshot: null };
        }
        return { available: true, bridge: name, reason: null, snapshot };
      } catch (error) {
        return {
          available: false,
          bridge: name,
          reason: error instanceof Error ? error.message : String(error),
          snapshot: null
        };
      }
    }
    return {
      available: false,
      bridge: configuredBridge,
      reason: 'runtime-bridge-unavailable',
      snapshot: null
    };
  }, runtimeBridge);
}

function runtimeCounter(snapshot, explicitPath, fallbackPaths) {
  const value = explicitPath
    ? deepGet(snapshot, explicitPath)
    : firstDefined(snapshot, fallbackPaths);
  return numberLike(value);
}

function runtimeInputCounters(snapshot, contract) {
  return {
    hotkeys: runtimeCounter(snapshot, contract.hotkeyCounterPath, [
      'input.hotkeyActivations',
      'input.gameplayHotkeyActivations',
      'input.hotkeys',
      'hotkeyActivations'
    ]),
    submits: runtimeCounter(snapshot, contract.submitCounterPath, [
      'input.submitCount',
      'input.submissions',
      'input.namingSubmitCount',
      'submitCount'
    ])
  };
}

function normalizeReadyCondition(condition) {
  if (condition == null) return [];
  return asArray(condition).map(item => typeof item === 'string'
    ? item.startsWith('beat:') ? { beat: item.slice(5) }
      : item.startsWith('milestone:') ? { receipt: item.slice('milestone:'.length) }
        : { selector: item, visible: true }
    : item);
}

function conditionMatchesValue(value, condition) {
  if (Object.hasOwn(condition, 'equals')) return Object.is(value, condition.equals);
  if (Object.hasOwn(condition, 'notEquals')) return !Object.is(value, condition.notEquals);
  if (Array.isArray(condition.oneOf)) return condition.oneOf.includes(value);
  if (Object.hasOwn(condition, 'includes')) {
    return Array.isArray(value)
      ? value.includes(condition.includes)
      : typeof value === 'string' && value.includes(condition.includes);
  }
  if (Object.hasOwn(condition, 'exists')) {
    return condition.exists ? value !== undefined && value !== null : value === undefined || value === null;
  }
  return Boolean(value);
}

async function conditionStatus(page, condition, runtimeBridge) {
  if (!isRecord(condition)) return { matched: false, detail: 'condition-is-not-an-object' };
  if (condition.selector) {
    const state = await page.evaluate(({ selector, visible, count }) => {
      let nodes;
      try { nodes = [...document.querySelectorAll(selector)]; } catch { return { invalidSelector: true }; }
      const rendered = nodes.filter(node => {
        if (!(node instanceof HTMLElement)) return false;
        const style = getComputedStyle(node);
        const box = node.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden'
          && Number(style.opacity || 1) > 0 && box.width > 0 && box.height > 0;
      });
      return { count: nodes.length, visibleCount: rendered.length,
        matched: count != null ? rendered.length === count : visible === false ? rendered.length === 0 : rendered.length > 0 };
    }, { selector: condition.selector, visible: condition.visible, count: condition.count });
    return { matched: state.matched === true, detail: state };
  }
  if (condition.beat) {
    const beat = await page.evaluate(() => window.__storyBeat ?? null);
    return { matched: beat === condition.beat, detail: { expected: condition.beat, actual: beat } };
  }
  const runtime = await readRuntimeBridge(page, runtimeBridge);
  if (!runtime.available) return { matched: false, unavailable: true, detail: runtime.reason };
  if (condition.receipt) {
    const receipts = receiptIds(runtime.snapshot);
    return { matched: receipts.includes(condition.receipt), detail: { receipt: condition.receipt, receipts } };
  }
  if (condition.path) {
    const value = deepGet(runtime.snapshot, condition.path.replace(/^runtime\./, ''));
    return { matched: conditionMatchesValue(value, condition), detail: { path: condition.path, value } };
  }
  return { matched: false, detail: 'condition-has-no-supported-selector' };
}

async function waitForConditions(page, conditions, runtimeBridge, timeoutMs, label) {
  const normalized = normalizeReadyCondition(conditions);
  if (normalized.length === 0) return [];
  const started = Date.now();
  let last = [];
  while (Date.now() - started < timeoutMs) {
    last = [];
    for (const condition of normalized) last.push(await conditionStatus(page, condition, runtimeBridge));
    if (last.every(item => item.matched)) return last;
    await page.waitForTimeout(100);
  }
  throw new Error(`${label} timed out after ${timeoutMs}ms: ${JSON.stringify(last)}`);
}

function scenarioUrl(baseUrl, chapter, scenario, lane, profile) {
  const url = new URL(scenario.url ?? chapter.url ?? baseUrl, baseUrl);
  const query = { ...(scenario.query ?? {}) };
  url.searchParams.set('journeyprobe', '1');
  url.searchParams.set('journeylane', lane.entryPath);
  url.searchParams.set('journeymode', lane.requestedControlMode);
  url.searchParams.set('journeyscenario', scenario.id);
  if (profile) url.searchParams.set('profile', profile);
  if (lane.requestedControlMode === 'movie') url.searchParams.set('movie', '1');
  else url.searchParams.delete('movie');
  if (lane.entryPath === 'direct-entry') {
    const beat = scenario.entryBeat ?? chapter.entryBeat ?? chapter.entry?.beat;
    if (!beat) throw new Error(`${scenario.id} needs entryBeat for the direct-entry lane`);
    url.searchParams.set('story', beat);
    url.searchParams.set('debug', '1');
  } else if (scenario.storyParam) {
    url.searchParams.set('story', scenario.storyParam);
  } else if (!url.searchParams.has('story')) {
    url.searchParams.set('story', '1');
  }
  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === false) url.searchParams.delete(key);
    else url.searchParams.set(key, String(value));
  }
  return url;
}

async function captureHardwareAttestation(page, required, gameCanvas = false) {
  const evidence = await page.evaluate(useGameCanvas => {
    const canvases = [...document.querySelectorAll('canvas')]
      .sort((left, right) => {
        const a = left.getBoundingClientRect();
        const b = right.getBoundingClientRect();
        return b.width * b.height - a.width * a.height;
      });
    const canvas = useGameCanvas ? canvases[0] : document.createElement('canvas');
    if (!canvas) {
      return {
        source: 'game-canvas',
        gameCanvasFound: false,
        contextAvailable: false,
        contextType: null,
        support: { webgl: false, webgl2: false },
        version: null,
        shadingLanguageVersion: null,
        renderer: null,
        vendor: null,
        unmaskedRenderer: null,
        unmaskedVendor: null,
        debugRendererInfoAvailable: false,
        captureError: 'game-canvas-not-found'
      };
    }
    if (!useGameCanvas) {
      canvas.width = 16;
      canvas.height = 16;
    }
    let context = null;
    let contextType = null;
    let captureError = null;
    try {
      context = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
      contextType = context ? 'webgl2' : null;
      if (!context) {
        context = canvas.getContext('webgl', { failIfMajorPerformanceCaveat: true });
        contextType = context ? 'webgl' : null;
      }
      if (!context) {
        return {
          source: useGameCanvas ? 'game-canvas' : 'synthetic-preflight',
          gameCanvasFound: useGameCanvas ? true : null,
          contextAvailable: false,
          contextType: null,
          support: { webgl: false, webgl2: false },
          version: null,
          shadingLanguageVersion: null,
          renderer: null,
          vendor: null,
          unmaskedRenderer: null,
          unmaskedVendor: null,
          debugRendererInfoAvailable: false,
          captureError: null
        };
      }
      const debugInfo = context.getExtension('WEBGL_debug_renderer_info');
      const value = parameter => {
        const raw = context.getParameter(parameter);
        return raw == null ? null : String(raw);
      };
      const result = {
        source: useGameCanvas ? 'game-canvas' : 'synthetic-preflight',
        gameCanvasFound: useGameCanvas ? true : null,
        contextAvailable: true,
        contextType,
        support: { webgl: true, webgl2: contextType === 'webgl2' },
        version: value(context.VERSION),
        shadingLanguageVersion: value(context.SHADING_LANGUAGE_VERSION),
        renderer: value(context.RENDERER),
        vendor: value(context.VENDOR),
        unmaskedRenderer: debugInfo ? value(debugInfo.UNMASKED_RENDERER_WEBGL) : null,
        unmaskedVendor: debugInfo ? value(debugInfo.UNMASKED_VENDOR_WEBGL) : null,
        debugRendererInfoAvailable: Boolean(debugInfo),
        captureError: null
      };
      if (!useGameCanvas) context.getExtension('WEBGL_lose_context')?.loseContext();
      return result;
    } catch (error) {
      captureError = error instanceof Error ? error.message : String(error);
      return {
        source: useGameCanvas ? 'game-canvas' : 'synthetic-preflight',
        gameCanvasFound: useGameCanvas ? true : null,
        contextAvailable: false,
        contextType,
        support: { webgl: false, webgl2: false },
        version: null,
        shadingLanguageVersion: null,
        renderer: null,
        vendor: null,
        unmaskedRenderer: null,
        unmaskedVendor: null,
        debugRendererInfoAvailable: false,
        captureError
      };
    }
  }, gameCanvas);
  return { ...evidence, evaluation: evaluateHardwareAttestation(evidence, required) };
}

async function prepareDirectEntryScenario(page, scenario, lane) {
  if (lane.entryPath !== 'direct-entry' || !DIRECT_PREPARATION_SCENARIOS.has(scenario.id)) return null;
  const started = Date.now();
  let last = null;
  while (Date.now() - started < scenario.timeoutMs) {
    last = await page.evaluate(({ configuredBridge, scenarioId }) => {
      const names = [configuredBridge, '__paravoxiaJourneyProbe'];
      for (const name of names) {
        if (!name) continue;
        const parts = String(name).replace(/^window\./, '').split('.').filter(Boolean);
        let bridge = window;
        for (const part of parts) bridge = bridge?.[part];
        if (!bridge || typeof bridge.prepareScenario !== 'function') continue;
        try {
          return bridge.prepareScenario(scenarioId);
        } catch (error) {
          return {
            scenarioId,
            status: 'denied',
            reason: error instanceof Error ? error.message : String(error)
          };
        }
      }
      return { scenarioId, status: 'waiting', reason: 'preparation-bridge-not-ready' };
    }, { configuredBridge: scenario.runtimeBridge, scenarioId: scenario.id });
    if (last?.status === 'prepared') return last;
    if (last?.status === 'denied') {
      throw new Error(`${scenario.id} direct-entry preparation denied: ${last.reason ?? 'unknown reason'}`);
    }
    await page.waitForTimeout(100);
  }
  throw new Error(
    `${scenario.id} direct-entry preparation timed out after ${scenario.timeoutMs}ms: ${JSON.stringify(last)}`
  );
}

async function releaseDirectEntryScenario(page, scenario, lane) {
  if (lane.entryPath !== 'direct-entry') return;
  await page.evaluate(({ configuredBridge, scenarioId }) => {
    const names = [configuredBridge, '__paravoxiaJourneyProbe'];
    for (const name of names) {
      if (!name) continue;
      const parts = String(name).replace(/^window\./, '').split('.').filter(Boolean);
      let bridge = window;
      for (const part of parts) bridge = bridge?.[part];
      if (!bridge || typeof bridge.releaseScenario !== 'function') continue;
      bridge.releaseScenario(scenarioId);
      return;
    }
  }, { configuredBridge: scenario.runtimeBridge, scenarioId: scenario.id });
}

async function acquireManualScenarioInput(page, scenario, lane) {
  if (lane.requestedControlMode !== 'manual' || scenario.type !== 'interaction-effect') return null;
  const canvas = page.locator('canvas').first();
  await canvas.waitFor({ state: 'visible', timeout: scenario.timeoutMs });
  await clickTrusted(page, canvas);
  const deadline = Date.now() + Math.min(scenario.timeoutMs, 5_000);
  let state = null;
  while (Date.now() < deadline) {
    state = await page.evaluate(() => ({
      pointerLocked: document.pointerLockElement instanceof HTMLCanvasElement,
      pointerLockTag: document.pointerLockElement instanceof HTMLElement
        ? document.pointerLockElement.tagName.toLowerCase()
        : null,
      activeTag: document.activeElement instanceof HTMLElement
        ? document.activeElement.tagName.toLowerCase()
        : null
    }));
    if (state.pointerLocked) {
      return {
        ...state,
        acquisition: 'trusted-canvas-click',
        doesNotCertifyHeadedPointerLock: !lane.headed
      };
    }
    await page.waitForTimeout(50);
  }
  throw new Error(
    `${scenario.id} could not acquire gameplay input ownership through a trusted canvas click: ${JSON.stringify(state)}`
  );
}

async function clickTrusted(page, locator) {
  const box = await locator.boundingBox();
  if (!box || box.width <= 0 || box.height <= 0) throw new Error('Trusted click target has no rendered geometry');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function enterPlayablePage(page, scenario, timeoutMs) {
  if (scenario.autoPlay === false) return;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const app = await page.evaluate(() => window.__paravoxiaAppState ?? null).catch(() => null);
    // Deep links enter the `playing` shell immediately, before terrain and the
    // selected controller have painted. Do not send gameplay input into that
    // boot gap: scene readiness is the first boundary at which a frame-sampled
    // action can honestly exercise the mounted player/ship controller.
    if (app?.phase === 'playing' && app?.sceneReady === true) return;
    const play = page.getByRole('button', { name: /Play Now/i }).first();
    if (await play.isVisible().catch(() => false) && await play.isEnabled().catch(() => false)) {
      await clickTrusted(page, play);
      await page.waitForTimeout(100);
      continue;
    }
    const readySelector = scenario.selector ?? scenario.ready?.selector;
    if (readySelector && await page.locator(readySelector).first().isVisible().catch(() => false)) return;
    await page.waitForTimeout(100);
  }
  throw new Error(`Playable page did not become ready within ${timeoutMs}ms`);
}

async function executeActions(page, actions, runtimeBridge, timeoutMs) {
  for (const [index, action] of asArray(actions).entries()) {
    if (!isRecord(action)) throw new Error(`action[${index}] must be an object`);
    if (action.waitFor) {
      await waitForConditions(page, action.waitFor, runtimeBridge, action.timeoutMs ?? timeoutMs, `action[${index}] waitFor`);
    } else if (action.press) {
      await page.keyboard.press(action.press);
    } else if (action.click) {
      const locator = page.locator(action.click).first();
      await locator.waitFor({ state: 'visible', timeout: action.timeoutMs ?? timeoutMs });
      await clickTrusted(page, locator);
    } else if (action.type && action.selector) {
      const locator = page.locator(action.selector).first();
      await locator.click();
      await page.keyboard.type(String(action.type));
    } else if (action.waitMs != null) {
      await page.waitForTimeout(parsePositiveInteger(action.waitMs, `action[${index}].waitMs`));
    } else {
      throw new Error(`action[${index}] has no supported operation`);
    }
  }
}

async function openScenarioPage(page, options, manifest, scenario, lane) {
  const openedAt = Date.now();
  const url = scenarioUrl(options.baseUrl, manifest.chapter, scenario, lane, options.profile);
  await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: scenario.timeoutMs });
  const timings = {
    domContentLoadedMs: Date.now() - openedAt,
    navigation: await page.evaluate(() => {
      const entry = performance.getEntriesByType('navigation')[0];
      if (!entry) return null;
      return {
        responseStartMs: Math.round(entry.responseStart),
        responseEndMs: Math.round(entry.responseEnd),
        domInteractiveMs: Math.round(entry.domInteractive),
        domContentLoadedMs: Math.round(entry.domContentLoadedEventEnd),
        loadEventMs: entry.loadEventEnd > 0 ? Math.round(entry.loadEventEnd) : null
      };
    })
  };
  const preflightAttestation = await captureHardwareAttestation(page, options.hardwareOnly);
  timings.hardwareAttestationMs = Date.now() - openedAt;
  if (options.hardwareOnly && preflightAttestation.evaluation.status !== 'passed') {
    return {
      url: url.toString(), preparation: null, inputOwnership: null,
      hardwareAttestation: { ...preflightAttestation, preflight: preflightAttestation }, timings
    };
  }
  const preparation = await prepareDirectEntryScenario(page, scenario, lane);
  timings.preparationReadyMs = Date.now() - openedAt;
  await enterPlayablePage(page, scenario, scenario.timeoutMs);
  timings.playableReadyMs = Date.now() - openedAt;
  await executeActions(page, scenario.setupActions, scenario.runtimeBridge, scenario.timeoutMs);
  const defaultReady = scenario.type === 'editable-field'
    ? { selector: scenario.selector, visible: true }
    : scenario.type === 'interaction-effect'
      ? {
        path: 'interaction.winner.id',
        oneOf: [
          ...uniqueStrings(scenario.requiredWinnerIds),
          ...uniqueStrings(scenario.optionalInteractionId),
          ...uniqueStrings(scenario.expectedWinnerId)
        ]
      }
      : scenario.type === 'prompt-ownership'
        ? { selector: scenario.selector ?? scenario.promptSelector ?? '[data-interaction-prompt]', visible: true }
        : scenario.type === 'entry-state'
          ? { path: 'schema', equals: 'paravoxia.journeyRuntimeSnapshot.v1' }
          : null;
  await waitForConditions(
    page,
    scenario.ready ?? scenario.waitFor ?? defaultReady,
    scenario.runtimeBridge,
    scenario.timeoutMs,
    `${scenario.id} ready`
  );
  timings.scenarioReadyMs = Date.now() - openedAt;
  const gameCanvasAttestation = await captureHardwareAttestation(page, options.hardwareOnly, true);
  const hardwareAttestation = { ...gameCanvasAttestation, preflight: preflightAttestation };
  timings.gameCanvasAttestationMs = Date.now() - openedAt;
  if (options.hardwareOnly && gameCanvasAttestation.evaluation.status !== 'passed') {
    return { url: url.toString(), preparation, inputOwnership: null, hardwareAttestation, timings };
  }
  const inputOwnership = await acquireManualScenarioInput(page, scenario, lane);
  timings.inputOwnershipReadyMs = Date.now() - openedAt;
  await releaseDirectEntryScenario(page, scenario, lane);
  return { url: url.toString(), preparation, inputOwnership, hardwareAttestation, timings };
}

async function capturePromptEvidence(page, contract, runtimeSnapshot = null) {
  const selectors = uniqueStrings(contract.selectors ?? contract.selector ?? contract.promptSelector
    ?? '[data-interaction-prompt]');
  const protectedSelectors = uniqueStrings(contract.avoidSelectors ?? [
    '[aria-label="Current story objective"]',
    '[data-story-caption="true"]',
    '[data-testid="touch-action-cluster"]'
  ]);
  const runtimeWinnerId = itemId(interactionView(runtimeSnapshot)?.winner);
  return page.evaluate(({ selectors: requestedSelectors, protectedSelectors: avoided, runtimeWinnerId: winner }) => {
    const visibleRect = node => {
      if (!(node instanceof HTMLElement) || !node.isConnected) return null;
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse'
        || Number(style.opacity || 1) <= 0.01 || box.width <= 0 || box.height <= 0) return null;
      return {
        x: box.x, y: box.y, width: box.width, height: box.height,
        right: box.right, bottom: box.bottom
      };
    };
    const intersects = (a, b) => Boolean(a && b
      && a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y);
    const nodes = [];
    for (const selector of requestedSelectors) {
      try {
        for (const node of document.querySelectorAll(selector)) if (!nodes.includes(node)) nodes.push(node);
      } catch { /* invalid selectors are exposed by an empty capture */ }
    }
    const protectedNodes = [];
    for (const selector of avoided) {
      try {
        for (const node of document.querySelectorAll(selector)) {
          if (!nodes.includes(node)) protectedNodes.push({ selector, node });
        }
      } catch { /* ignore invalid optional geometry selectors */ }
    }
    const prompts = nodes.map((node, index) => {
      const rect = visibleRect(node);
      const overlaps = [];
      if (rect) {
        for (const target of protectedNodes) {
          if (intersects(rect, visibleRect(target.node))) overlaps.push(target.selector);
        }
        for (const [otherIndex, other] of nodes.entries()) {
          if (otherIndex !== index && intersects(rect, visibleRect(other))) overlaps.push(`prompt:${otherIndex}`);
        }
      }
      return {
        selectorIndex: index,
        visible: Boolean(rect),
        ownerId: node instanceof HTMLElement
          ? node.dataset.interactionId ?? node.dataset.promptOwner ?? node.dataset.ownerId ?? winner ?? null
          : winner ?? null,
        presentationOwner: node instanceof HTMLElement ? node.dataset.interactionOwner ?? null : null,
        text: node instanceof HTMLElement ? node.innerText.trim().slice(0, 500) : '',
        rect,
        insideViewport: Boolean(rect && rect.x >= 0 && rect.y >= 0
          && rect.right <= innerWidth && rect.bottom <= innerHeight),
        overlaps: [...new Set(overlaps)]
      };
    });
    return { selectors: requestedSelectors, protectedSelectors: avoided, prompts };
  }, { selectors, protectedSelectors, runtimeWinnerId });
}

async function runEditableScenario(page, scenario) {
  if (!scenario.selector) throw new Error(`${scenario.id} must declare selector`);
  const locator = page.locator(scenario.selector).first();
  await locator.waitFor({ state: 'visible', timeout: scenario.timeoutMs });
  const beforeHarness = await readHarness(page);
  await clickTrusted(page, locator);
  const controlBefore = await locator.evaluate(element => ({
    exists: element.isConnected,
    visible: (() => {
      if (!(element instanceof HTMLElement)) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden'
        && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
    })(),
    realEditableControl: element instanceof HTMLInputElement
      || element instanceof HTMLTextAreaElement
      || element instanceof HTMLElement && element.isContentEditable,
    focusedBeforeTyping: document.activeElement === element,
    tag: element.tagName.toLowerCase()
  }));
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Backspace');
  const runtimeBefore = await readRuntimeBridge(page, scenario.runtimeBridge);
  const typedValue = String(scenario.typedValue ?? scenario.testValue ?? 'wasd');
  const eventStart = (await readHarness(page))?.events.length ?? beforeHarness?.events.length ?? 0;
  await page.keyboard.type(typedValue, { delay: Number(scenario.keyDelayMs ?? 15) });
  const valueAfterTyping = await locator.evaluate(element => (
    element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
      ? element.value : element.textContent ?? ''
  ));
  const focusedAfterTyping = await locator.evaluate(element => document.activeElement === element);
  const runtimeAfterTyping = await readRuntimeBridge(page, scenario.runtimeBridge);
  await page.keyboard.press(scenario.submitKey ?? 'Enter');
  await waitForConditions(
    page,
    scenario.afterSubmit ?? scenario.completionCondition,
    scenario.runtimeBridge,
    scenario.feedbackWithinMs ?? Math.min(scenario.timeoutMs, 5_000),
    `${scenario.id} submission`
  );
  await page.waitForTimeout(Number(scenario.settleMs ?? 100));
  const runtimeAfterSubmit = await readRuntimeBridge(page, scenario.runtimeBridge);
  const afterHarness = await readHarness(page);
  const keyEvents = asArray(afterHarness?.events).slice(eventStart).filter(event => event.type === 'keydown');
  const typedKeys = keyEvents.filter(event => event.key !== 'Enter');
  const enters = keyEvents.filter(event => event.key === (scenario.submitKey ?? 'Enter'));
  const beforeCounters = runtimeInputCounters(runtimeBefore.snapshot, scenario);
  const afterTypeCounters = runtimeInputCounters(runtimeAfterTyping.snapshot, scenario);
  const afterSubmitCounters = runtimeInputCounters(runtimeAfterSubmit.snapshot, scenario);
  const evidence = {
    field: {
      ...controlBefore,
      focusedAfterTyping,
      valueAfterTyping
    },
    typedValue: scenario.expectedValue ?? typedValue,
    inputEvents: {
      typedKeyCount: typedKeys.length,
      typedKeysTrusted: typedKeys.length > 0 && typedKeys.every(event => event.trusted === true),
      enterKeyCount: enters.length,
      enterTrusted: enters.length === 1 && enters[0].trusted === true,
      events: keyEvents
    },
    hotkeys: { before: beforeCounters.hotkeys, after: afterTypeCounters.hotkeys },
    submit: { before: afterTypeCounters.submits, after: afterSubmitCounters.submits },
    persistedValue: firstDefined(runtimeAfterSubmit.snapshot, [
      'input.lastSubmittedValue',
      'input.workerName',
      'state.voyage.worker-name'
    ]),
    runtime: {
      before: runtimeBefore,
      afterTyping: runtimeAfterTyping,
      afterSubmit: runtimeAfterSubmit
    }
  };
  return { evaluation: evaluateEditableEvidence(scenario, evidence), evidence };
}

async function runPromptScenario(page, scenario) {
  const runtime = await readRuntimeBridge(page, scenario.runtimeBridge);
  const evidence = await capturePromptEvidence(page, scenario, runtime.snapshot);
  return { evaluation: evaluatePromptEvidence(scenario, evidence), evidence };
}

async function pressFrameSampledAction(page, key, minimumHoldMs = 80) {
  const holdMs = Math.max(1, Number(minimumHoldMs) || 80);
  const started = Date.now();
  await page.keyboard.down(key);
  let renderedFrames = 0;
  try {
    renderedFrames = await page.evaluate(() => new Promise(resolve => {
      let frames = 0;
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve(frames);
      };
      const onFrame = () => {
        frames += 1;
        if (frames >= 2) finish();
        else requestAnimationFrame(onFrame);
      };
      requestAnimationFrame(onFrame);
      setTimeout(finish, 250);
    }));
    const remaining = holdMs - (Date.now() - started);
    if (remaining > 0) await page.waitForTimeout(remaining);
  } finally {
    await page.keyboard.up(key);
  }
  return {
    key,
    holdMs: Date.now() - started,
    renderedFrames
  };
}

function traceHasNewEvidence(beforeSnapshot, afterSnapshot, contract) {
  const before = interactionView(beforeSnapshot);
  const after = interactionView(afterSnapshot);
  if (!before || !after) return false;
  const newEvents = traceDelta(before.trace, after.trace);
  const expected = contract.expectedEffectId ?? contract.expectedReceipt ?? null;
  if (newEvents.some(event => matchesEvidenceId(event, expected) && isPositiveEffect(event))) return true;
  const beforeReceipts = receiptIds(beforeSnapshot);
  return receiptIds(afterSnapshot).some(receipt => !beforeReceipts.includes(receipt)
    && (!expected || receipt === expected));
}

async function runInteractionScenario(page, scenario) {
  const beforeRuntime = await readRuntimeBridge(page, scenario.runtimeBridge);
  if (beforeRuntime.available) {
    const view = interactionView(beforeRuntime.snapshot);
    if (!view) {
      const evidence = { runtime: beforeRuntime, before: beforeRuntime.snapshot, after: beforeRuntime.snapshot };
      return { evaluation: evaluateInteractionEvidence(scenario, evidence), evidence };
    }
  }
  const promptBefore = await capturePromptEvidence(page, scenario, beforeRuntime.snapshot);
  // Drei's KeyboardControls state is sampled inside useFrame. A zero-duration
  // Playwright press can complete between two healthy GPU frames and never be
  // observed by gameplay, so keep the trusted key down across rendered frames.
  const actionInput = await pressFrameSampledAction(
    page,
    scenario.actionKey ?? 'f',
    scenario.actionHoldMs ?? 80
  );
  const deadline = Date.now() + Number(scenario.feedbackWithinMs ?? 1_000);
  let afterRuntime = await readRuntimeBridge(page, scenario.runtimeBridge);
  while (beforeRuntime.available && afterRuntime.available && Date.now() < deadline
    && !traceHasNewEvidence(beforeRuntime.snapshot, afterRuntime.snapshot, scenario)) {
    await page.waitForTimeout(25);
    afterRuntime = await readRuntimeBridge(page, scenario.runtimeBridge);
  }
  await waitForConditions(
    page,
    scenario.afterAction,
    scenario.runtimeBridge,
    scenario.feedbackWithinMs ?? 1_000,
    `${scenario.id} effect`
  );

  let clearedRuntime = afterRuntime;
  let promptAfter = await capturePromptEvidence(page, scenario, afterRuntime.snapshot);
  const staleRequested = scenario.staleClear === true || isRecord(scenario.staleClear);
  if (staleRequested) {
    const beforeView = interactionView(beforeRuntime.snapshot);
    const staleId = scenario.staleInteractionId
      ?? scenario.staleClear?.interactionId
      ?? scenario.expectedWinnerId
      ?? itemId(beforeView?.winner);
    const staleDeadline = Date.now() + Number(scenario.staleClear?.withinMs ?? scenario.staleClearMs ?? 1_000);
    while (Date.now() < staleDeadline) {
      clearedRuntime = await readRuntimeBridge(page, scenario.runtimeBridge);
      promptAfter = await capturePromptEvidence(page, scenario, clearedRuntime.snapshot);
      const view = interactionView(clearedRuntime.snapshot);
      const candidateIds = view?.candidates.map(itemId).filter(Boolean) ?? [];
      const visibleOwners = promptAfter.prompts.filter(prompt => prompt.visible).map(prompt => prompt.ownerId);
      if (view && itemId(view.winner) !== staleId && !candidateIds.includes(staleId)
        && !visibleOwners.includes(staleId)) break;
      await page.waitForTimeout(25);
    }
  }
  const beforeView = interactionView(beforeRuntime.snapshot);
  const afterView = interactionView(afterRuntime.snapshot);
  const evidence = {
    runtime: beforeRuntime,
    before: beforeRuntime.snapshot,
    actionInput,
    after: afterRuntime.snapshot,
    cleared: clearedRuntime.snapshot,
    newTrace: beforeView && afterView ? traceDelta(beforeView.trace, afterView.trace) : [],
    stalePromptOwnerId: promptAfter.prompts.find(prompt => prompt.visible)?.ownerId ?? null,
    promptBefore,
    promptAfter
  };
  const interactionEvaluation = evaluateInteractionEvidence(scenario, evidence);
  const promptContract = {
    ...scenario,
    selector: scenario.promptSelector,
    requiredVisible: scenario.promptRequired !== false,
    expectedOwnerId: itemId(beforeView?.winner) ?? undefined
  };
  const promptEvaluation = evaluatePromptEvidence(promptContract, promptBefore);
  const evaluation = resultFromChecks([...interactionEvaluation.checks, ...promptEvaluation.checks]);
  return { evaluation, evidence };
}

async function findContinueControl(page, contract, timeoutMs) {
  const selector = contract.continue?.selector;
  const locator = selector
    ? page.locator(selector).first()
    : page.getByRole('button', {
      name: new RegExp(contract.continue?.namePattern ?? 'Continue Story|Continue', 'i')
    }).first();
  await locator.waitFor({ state: 'visible', timeout: timeoutMs });
  return locator;
}

async function runReloadScenario(page, scenario) {
  const triggerCondition = scenario.beforeReload
    ?? (scenario.triggerRef ? parseContractEvidenceAssertion(scenario.triggerRef) : null);
  const runtimeTrigger = triggerCondition?.path?.startsWith('runtime.')
    ? { ...triggerCondition, path: triggerCondition.path.slice('runtime.'.length) }
    : triggerCondition;
  await waitForConditions(
    page,
    runtimeTrigger,
    scenario.runtimeBridge,
    scenario.timeoutMs,
    `${scenario.id} reload window`
  );
  await executeActions(page, scenario.beforeReloadActions, scenario.runtimeBridge, scenario.timeoutMs);
  const beforeHarness = await readHarness(page);
  const beforeRuntime = await readRuntimeBridge(page, scenario.runtimeBridge);
  const beatBeforeReload = await page.evaluate(() => window.__storyBeat ?? null);
  if (scenario.preserveDebugQueryOnReload !== true) {
    await page.evaluate(() => {
      const url = new URL(window.location.href);
      for (const key of ['story', 'debug', 'movie']) url.searchParams.delete(key);
      history.replaceState(history.state, '', url.toString());
    });
  }
  await page.evaluate(() => sessionStorage.setItem('paravoxia.chapterJourney.reloadArmed.v1', '1'));
  await page.reload({ waitUntil: 'domcontentloaded', timeout: scenario.timeoutMs });
  const afterHarness = await readHarness(page);
  const continueRequired = scenario.continue?.required ?? scenario.continueRequired ?? true;
  let continueVisible = false;
  let continueClicks = 0;
  if (continueRequired) {
    const control = await findContinueControl(page, scenario, scenario.timeoutMs);
    continueVisible = await control.isVisible();
    await clickTrusted(page, control);
    continueClicks += 1;
  }
  if (scenario.playAfterContinue === true) await enterPlayablePage(page, scenario, scenario.timeoutMs);
  const expectedBeat = scenario.continue?.expectedBeat;
  const afterCondition = scenario.afterContinue
    ?? (expectedBeat ? { beat: expectedBeat } : null);
  await waitForConditions(
    page,
    afterCondition,
    scenario.runtimeBridge,
    scenario.timeoutMs,
    `${scenario.id} after Continue`
  );
  await page.waitForTimeout(Number(scenario.settleMs ?? 100));
  const finalHarness = await readHarness(page);
  const afterRuntime = await readRuntimeBridge(page, scenario.runtimeBridge);
  const reloadCapture = finalHarness?.reloadCapture ?? afterHarness?.reloadCapture ?? null;
  const firstPostReload = reloadCapture?.firstPlaying ?? reloadCapture?.firstRuntime ?? null;
  const currentBeat = await page.evaluate(() => window.__storyBeat ?? null);
  const evidence = {
    planned: true,
    reloadCount: 1,
    bootBefore: beforeHarness?.bootId ?? null,
    bootAfter: afterHarness?.bootId ?? finalHarness?.bootId ?? null,
    continue: { required: continueRequired, visible: continueVisible, clicks: continueClicks },
    beforeReload: { beat: beatBeforeReload, runtime: beforeRuntime.snapshot },
    firstPostReload,
    afterContinue: afterRuntime.available
      ? { beat: currentBeat, runtime: afterRuntime.snapshot }
      : null,
    reloadCapture,
    runtime: { before: beforeRuntime, after: afterRuntime }
  };
  return { evaluation: evaluateReloadEvidence(scenario, evidence), evidence };
}

async function runEntryStateScenario(page, scenario) {
  await page.waitForTimeout(Number(scenario.settleMs ?? 100));
  const runtime = await readRuntimeBridge(page, scenario.runtimeBridge);
  let actionInput = null;
  let afterAction = null;
  if (scenario.actionKey) {
    actionInput = await pressFrameSampledAction(
      page,
      scenario.actionKey,
      scenario.actionHoldMs ?? 80
    );
    await waitForConditions(
      page,
      scenario.afterActionAssertions,
      scenario.runtimeBridge,
      scenario.feedbackWithinMs ?? scenario.timeoutMs,
      `${scenario.id} post-action state`
    );
    afterAction = await readRuntimeBridge(page, scenario.runtimeBridge);
  }
  const evidence = {
    runtime,
    snapshot: runtime.available ? runtime.snapshot : null,
    actionInput,
    afterAction
  };
  return { evaluation: evaluateEntryStateEvidence(scenario, evidence), evidence };
}

async function executeScenario(page, scenario) {
  if (scenario.type === 'editable-field') return runEditableScenario(page, scenario);
  if (scenario.type === 'prompt-ownership') return runPromptScenario(page, scenario);
  if (scenario.type === 'interaction-effect') return runInteractionScenario(page, scenario);
  if (scenario.type === 'reload-continue') return runReloadScenario(page, scenario);
  if (scenario.type === 'entry-state') return runEntryStateScenario(page, scenario);
  throw new Error(`Unsupported scenario type ${scenario.type}`);
}

function runSelfTest() {
  const mutations = [];
  const proveMutation = (id, evaluate) => {
    const result = evaluate();
    assert.notEqual(result.status, 'passed', `${id} mutation unexpectedly passed`);
    assert.equal(result.passed, false, `${id} mutation must fail closed`);
    mutations.push({ id, caught: true, status: result.status });
  };

  const aliases = parseArgs(['--chapter', 'ch7', '--direct-entry', '--manual', '--headed', '--hardware-only']);
  assert.equal(aliases.lane, 'direct-entry');
  assert.equal(aliases.mode, 'manual');
  assert.equal(aliases.headed, true);
  assert.equal(aliases.hardwareOnly, true);
  assert.throws(() => parseArgs(['--chapter', 'ch7', '--continuous', '--resume']), /Conflicting journey lanes/);
  assert.throws(() => parseArgs(['--chapter', 'ch7', '--manual', '--movie']), /Conflicting control modes/);

  const hardwareArgs = browserLaunchArgs(aliases);
  assert.ok(hardwareArgs.includes('--use-gl=angle'));
  assert.ok(hardwareArgs.includes('--use-angle=gl-egl'));
  assert.ok(hardwareArgs.includes('--disable-software-rasterizer'));
  assert.ok(!hardwareArgs.includes('--enable-unsafe-swiftshader'));
  const hardwareFixture = {
    contextAvailable: true,
    contextType: 'webgl2',
    version: 'WebGL 2.0',
    renderer: 'WebKit WebGL',
    vendor: 'WebKit',
    unmaskedRenderer: 'ANGLE (NVIDIA Corporation, NVIDIA GB10/PCIe)',
    unmaskedVendor: 'Google Inc. (NVIDIA Corporation)'
  };
  assert.equal(evaluateHardwareAttestation(hardwareFixture, true).status, 'passed');
  proveMutation('hardware.context-unavailable', () => evaluateHardwareAttestation({
    ...hardwareFixture, contextAvailable: false, unmaskedRenderer: null
  }, true));
  proveMutation('hardware.software-renderer', () => evaluateHardwareAttestation({
    ...hardwareFixture, unmaskedRenderer: 'ANGLE (Google, Vulkan SwiftShader Device (Subzero))'
  }, true));
  proveMutation('hardware.disabled-renderer', () => evaluateHardwareAttestation({
    ...hardwareFixture, unmaskedRenderer: 'Disabled', vendor: '0xffff'
  }, true));
  proveMutation('hardware.renderer-identity-unknown', () => evaluateHardwareAttestation({
    ...hardwareFixture, unmaskedRenderer: null, renderer: 'WebKit WebGL'
  }, true));

  const directLane = classifyLane({ lane: 'direct-entry', mode: 'manual', headed: true });
  assert.equal(evaluateLaneClaim(directLane).status, 'passed');
  proveMutation('lane.direct-entry-cannot-certify', () => evaluateLaneClaim({
    ...directLane,
    machineJourneyCertifying: true
  }));
  proveMutation('lane.playwright-cannot-claim-human', () => evaluateLaneClaim({
    ...directLane,
    humanOperated: true
  }));
  const headlessLane = classifyLane({ lane: 'continuous', mode: 'manual', headed: false });
  assert.equal(evaluateLaneClaim(headlessLane).status, 'passed');
  proveMutation('lane.headless-cannot-claim-pointer-lock', () => evaluateLaneClaim({
    ...headlessLane,
    doesNotCertify: headlessLane.doesNotCertify.filter(value => value !== 'headed-pointer-lock')
  }));

  const editableContract = {
    expectedValue: 'sdgsdg',
    requireTrustedInput: true,
    requireHotkeyIsolation: true,
    requireSubmitCount: true,
    requirePersistedValue: true
  };
  const editableFixture = {
    typedValue: 'sdgsdg',
    field: {
      exists: true,
      visible: true,
      realEditableControl: true,
      focusedBeforeTyping: true,
      focusedAfterTyping: true,
      valueAfterTyping: 'sdgsdg'
    },
    inputEvents: {
      typedKeyCount: 6,
      typedKeysTrusted: true,
      enterKeyCount: 1,
      enterTrusted: true
    },
    hotkeys: { before: 3, after: 3 },
    submit: { before: 0, after: 1 },
    persistedValue: 'sdgsdg'
  };
  assert.equal(evaluateEditableEvidence(editableContract, editableFixture).status, 'passed');
  proveMutation('editable.fake-control', () => evaluateEditableEvidence(editableContract, {
    ...editableFixture, field: { ...editableFixture.field, realEditableControl: false }
  }));
  proveMutation('editable.focus-not-owned', () => evaluateEditableEvidence(editableContract, {
    ...editableFixture, field: { ...editableFixture.field, focusedBeforeTyping: false }
  }));
  proveMutation('editable.value-unchanged', () => evaluateEditableEvidence(editableContract, {
    ...editableFixture, field: { ...editableFixture.field, valueAfterTyping: '' }
  }));
  proveMutation('editable.untrusted-keyboard', () => evaluateEditableEvidence(editableContract, {
    ...editableFixture, inputEvents: { ...editableFixture.inputEvents, typedKeysTrusted: false }
  }));
  proveMutation('editable.hotkey-leak', () => evaluateEditableEvidence(editableContract, {
    ...editableFixture, hotkeys: { before: 3, after: 4 }
  }));
  proveMutation('editable.hotkey-evidence-unavailable', () => evaluateEditableEvidence(editableContract, {
    ...editableFixture, hotkeys: { before: null, after: null }
  }));
  proveMutation('editable.double-submit', () => evaluateEditableEvidence(editableContract, {
    ...editableFixture, submit: { before: 0, after: 2 }
  }));
  proveMutation('editable.submit-evidence-unavailable', () => evaluateEditableEvidence(editableContract, {
    ...editableFixture, submit: { before: null, after: null }
  }));
  proveMutation('editable.persisted-value-drift', () => evaluateEditableEvidence(editableContract, {
    ...editableFixture, persistedValue: 'moss'
  }));
  proveMutation('editable.persisted-value-unavailable', () => evaluateEditableEvidence(editableContract, {
    ...editableFixture, persistedValue: null
  }));

  const promptContract = { requiredVisible: true, maxCount: 1, requireOwner: true };
  const goodPrompt = {
    visible: true,
    ownerId: 'story-ship-repair',
    insideViewport: true,
    rect: { x: 500, y: 400, right: 700, bottom: 440 },
    overlaps: []
  };
  assert.equal(evaluatePromptEvidence(promptContract, { prompts: [goodPrompt] }).status, 'passed');
  proveMutation('prompt.duplicate-visible-owner', () => evaluatePromptEvidence(promptContract, {
    prompts: [goodPrompt, { ...goodPrompt, ownerId: 'story-wreck-scar-attend' }]
  }));
  proveMutation('prompt.owner-unavailable', () => evaluatePromptEvidence(promptContract, {
    prompts: [{ ...goodPrompt, ownerId: null }]
  }));
  proveMutation('prompt.offscreen', () => evaluatePromptEvidence(promptContract, {
    prompts: [{ ...goodPrompt, insideViewport: false }]
  }));
  proveMutation('prompt.hud-overlap', () => evaluatePromptEvidence(promptContract, {
    prompts: [{ ...goodPrompt, overlaps: ['[aria-label="Current story objective"]'] }]
  }));

  const beforeInteraction = {
    interaction: {
      candidates: [
        { id: 'story-ship-repair' },
        { id: 'story-wreck-scar-attend' }
      ],
      winner: { id: 'story-ship-repair' },
      effects: []
    },
    receipts: []
  };
  const afterInteraction = {
    interaction: {
      candidates: [],
      winner: null,
      effects: [{ id: 'repair-committed', outcome: 'changed', clearingLatencyMs: 120 }]
    },
    receipts: ['repair-committed']
  };
  const interactionContract = {
    runtimeBridge: RUNTIME_BRIDGE,
    requiredWinnerIds: ['story-ship-repair'],
    forbiddenWinnerIds: ['story-wreck-scar-attend'],
    expectedEffectId: 'repair-committed',
    requireEffect: true,
    feedbackWithinMs: 500,
    staleClear: true,
    staleInteractionId: 'story-ship-repair'
  };
  const interactionFixture = {
    runtime: { available: true },
    before: beforeInteraction,
    after: afterInteraction,
    cleared: afterInteraction,
    stalePromptOwnerId: null
  };
  assert.equal(evaluateInteractionEvidence(interactionContract, interactionFixture).status, 'passed');
  assert.deepEqual(interactionView(beforeInteraction).trace, [], 'effects must remain a supported trace alias');
  proveMutation('interaction.runtime-unavailable', () => evaluateInteractionEvidence(interactionContract, {
    ...interactionFixture, runtime: { available: false, reason: 'missing' }
  }));
  proveMutation('interaction.optional-defeats-required', () => evaluateInteractionEvidence(interactionContract, {
    ...interactionFixture,
    before: {
      ...beforeInteraction,
      interaction: { ...beforeInteraction.interaction, winner: { id: 'story-wreck-scar-attend' } }
    }
  }));
  proveMutation('interaction.winner-not-candidate', () => evaluateInteractionEvidence(interactionContract, {
    ...interactionFixture,
    before: {
      ...beforeInteraction,
      interaction: { ...beforeInteraction.interaction, winner: { id: 'unknown-action' } }
    }
  }));
  proveMutation('interaction.no-effect', () => evaluateInteractionEvidence(interactionContract, {
    ...interactionFixture,
    after: { interaction: { candidates: [], winner: null, trace: [] }, receipts: [] }
  }));
  proveMutation('interaction.no-op-effect', () => evaluateInteractionEvidence(interactionContract, {
    ...interactionFixture,
    after: {
      interaction: { candidates: [], winner: null, trace: [{ id: 'repair-committed', outcome: 'no-op' }] },
      receipts: []
    }
  }));
  proveMutation('interaction.slow-feedback', () => evaluateInteractionEvidence(interactionContract, {
    ...interactionFixture,
    after: {
      ...afterInteraction,
      interaction: {
        ...afterInteraction.interaction,
        effects: [{ id: 'repair-committed', outcome: 'changed', clearingLatencyMs: 501 }]
      }
    }
  }));
  proveMutation('interaction.stale-winner', () => evaluateInteractionEvidence(interactionContract, {
    ...interactionFixture,
    cleared: beforeInteraction,
    stalePromptOwnerId: 'story-ship-repair'
  }));

  const entryStateContract = {
    actionKey: 'Space',
    assertions: [
      { id: 'story-beat', path: 'story.beat', equals: 'ch8-launch' },
      { id: 'objective-health', path: 'objective.health', equals: 'ready' },
      { id: 'space-control', path: 'state.spaceFlight.controlMode', equals: 'flight' },
      { id: 'origin-active', path: 'state.systemFlight.activePlanetId', equals: '-1,-1' },
      { id: 'ship-ready', path: 'state.shipRestoration.repairStage', equals: 'flight_ready' },
      {
        id: 'pressure-sealed',
        path: 'state.localActor.milestones',
        includes: 'story:board:pressure-boundary-sealed'
      }
    ],
    afterActionAssertions: [
      {
        id: 'launch-ignition',
        path: 'state.signedSceneAv.activationHistoryAnchorIds',
        includes: 'anc.launch.ignition'
      },
      {
        id: 'launch-liftoff',
        path: 'state.signedSceneAv.activationHistoryAnchorIds',
        includes: 'anc.launch.liftoff'
      }
    ]
  };
  const entryStateSnapshot = {
    schema: 'paravoxia.journeyRuntimeSnapshot.v1',
    story: { active: true, chapter: 'ch8', beat: 'ch8-launch' },
    objective: { id: 'ch8:launch:ignite', health: 'ready' },
    state: {
      localActor: {
        id: 'local',
        milestones: [
          'story:board:physical-transaction-complete',
          'story:board:pressure-boundary-sealed'
        ]
      },
      spaceFlight: { phase: 'surface', controlMode: 'flight' },
      systemFlight: { systemId: '-1,-1', activePlanetId: '-1,-1', locationMode: 'surface' },
      shipRestoration: { repairStage: 'flight_ready' }
    }
  };
  const entryStateFixture = {
    runtime: { available: true, snapshot: entryStateSnapshot },
    snapshot: entryStateSnapshot,
    actionInput: { key: 'Space', holdMs: 80, renderedFrames: 2 },
    afterAction: {
      available: true,
      snapshot: {
        ...entryStateSnapshot,
        objective: { ...entryStateSnapshot.objective, id: 'ch8:launch:climb' },
        state: {
          ...entryStateSnapshot.state,
          signedSceneAv: {
            activationHistoryAnchorIds: ['anc.launch.ignition', 'anc.launch.liftoff']
          }
        }
      }
    }
  };
  assert.equal(evaluateEntryStateEvidence(entryStateContract, entryStateFixture).status, 'passed');
  proveMutation('entry-state.runtime-unavailable', () => evaluateEntryStateEvidence(entryStateContract, {
    runtime: { available: false, reason: 'bridge-missing' },
    snapshot: null
  }));
  proveMutation('entry-state.objective-unhealthy', () => evaluateEntryStateEvidence(entryStateContract, {
    ...entryStateFixture,
    snapshot: { ...entryStateSnapshot, objective: { ...entryStateSnapshot.objective, health: 'idle' } }
  }));
  proveMutation('entry-state.control-not-restored', () => evaluateEntryStateEvidence(entryStateContract, {
    ...entryStateFixture,
    snapshot: {
      ...entryStateSnapshot,
      state: {
        ...entryStateSnapshot.state,
        spaceFlight: { ...entryStateSnapshot.state.spaceFlight, controlMode: 'fps' }
      }
    }
  }));
  proveMutation('entry-state.receipt-missing', () => evaluateEntryStateEvidence(entryStateContract, {
    ...entryStateFixture,
    snapshot: {
      ...entryStateSnapshot,
      state: {
        ...entryStateSnapshot.state,
        localActor: {
          ...entryStateSnapshot.state.localActor,
          milestones: ['story:board:physical-transaction-complete']
        }
      }
    }
  }));
  proveMutation('entry-state.action-not-frame-sampled', () => evaluateEntryStateEvidence(entryStateContract, {
    ...entryStateFixture,
    actionInput: { key: 'Space', holdMs: 0, renderedFrames: 0 }
  }));
  proveMutation('entry-state.launch-liftoff-missing', () => evaluateEntryStateEvidence(entryStateContract, {
    ...entryStateFixture,
    afterAction: { available: true, snapshot: entryStateSnapshot }
  }));

  const reloadContract = {
    continue: { required: true },
    requireRuntimeEvidence: true,
    firstPostReloadAssertions: [
      { path: 'runtime.entities.w7744.mounted', equals: false },
      { path: 'runtime.entities.field-pack.mounted', equals: true }
    ],
    afterContinueAssertions: [{ path: 'beat', equals: 'ch5-maw' }]
  };
  const reloadFixture = {
    planned: true,
    reloadCount: 1,
    bootBefore: 'boot-a',
    bootAfter: 'boot-b',
    continue: { visible: true, clicks: 1 },
    firstPostReload: {
      beat: 'a4-exhale',
      runtime: {
        entities: {
          w7744: { mounted: false, visible: false },
          'field-pack': { mounted: true, visible: true }
        }
      }
    },
    afterContinue: { beat: 'ch5-maw', runtime: { receipts: ['story:a4:field-pack-dropped'] } }
  };
  assert.equal(evaluateReloadEvidence(reloadContract, reloadFixture).status, 'passed');
  proveMutation('reload.unplanned', () => evaluateReloadEvidence(reloadContract, {
    ...reloadFixture, planned: false
  }));
  proveMutation('reload.boot-did-not-change', () => evaluateReloadEvidence(reloadContract, {
    ...reloadFixture, bootAfter: 'boot-a'
  }));
  proveMutation('reload.happened-twice', () => evaluateReloadEvidence(reloadContract, {
    ...reloadFixture, reloadCount: 2
  }));
  proveMutation('reload.continue-not-clicked', () => evaluateReloadEvidence(reloadContract, {
    ...reloadFixture, continue: { visible: true, clicks: 0 }
  }));
  proveMutation('reload.first-sample-unavailable', () => evaluateReloadEvidence(reloadContract, {
    ...reloadFixture, firstPostReload: null
  }));
  proveMutation('reload.actor-resurrected', () => evaluateReloadEvidence(reloadContract, {
    ...reloadFixture,
    firstPostReload: {
      ...reloadFixture.firstPostReload,
      runtime: {
        ...reloadFixture.firstPostReload.runtime,
        entities: {
          ...reloadFixture.firstPostReload.runtime.entities,
          w7744: { mounted: true, visible: true }
        }
      }
    }
  }));
  proveMutation('reload.wrong-successor', () => evaluateReloadEvidence(reloadContract, {
    ...reloadFixture, afterContinue: { ...reloadFixture.afterContinue, beat: 'a4-exhale' }
  }));

  assert.ok(existsSync(DEFAULT_MANIFEST), 'Canonical journey manifest must exist');
  const liveManifest = JSON.parse(readFileSync(DEFAULT_MANIFEST, 'utf8'));
  const prologue = normalizeManifest(liveManifest, 'prologue');
  const ch4 = normalizeManifest(liveManifest, 'ch4');
  const ch5 = normalizeManifest(liveManifest, 'ch5');
  const ch7 = normalizeManifest(liveManifest, 'ch7');
  const ch8 = normalizeManifest(liveManifest, 'ch8');
  assert.equal(prologue.scenarios.find(item => item.id === 'input:voyage-worker-name')?.type, 'editable-field');
  assert.equal(ch4.scenarios.find(item => item.id === 'lifecycle:w7744-departure-reload')?.type, 'reload-continue');
  assert.equal(ch7.scenarios.find(item => item.id === 'interaction:persistent-scar-arbitration')?.type, 'interaction-effect');
  const ch8Entry = ch8.scenarios.find(item => item.id === 'entry:ch8-launch:restoration');
  assert.equal(ch8Entry?.type, 'entry-state');
  assert.equal(ch8Entry?.entryBeat, 'ch8-launch');
  assert.deepEqual(ch8Entry?.lanes, ['direct-entry']);
  assert.equal(scenarioApplies(ch8Entry, directLane), true);
  assert.equal(scenarioApplies(ch8Entry, { ...directLane, entryPath: 'continuous' }), false);
  assert.equal(ch5.scenarios.length, 0, 'Chapters without focused escaped-defect contracts remain valid and explicit');
  assert.equal(ch4.scenarios.find(item => item.id === 'lifecycle:w7744-departure-reload')
    ?.firstPostReloadAssertions[0].path, 'runtime.entities.actor:w7744.mounted');
  assert.equal(ch4.scenarios.find(item => item.id === 'lifecycle:w7744-departure-reload')
    ?.playAfterContinue, true);
  assert.deepEqual(parseContractEvidenceAssertion('milestone:story:a4:field-pack-dropped'), {
    id: 'milestone:story:a4:field-pack-dropped',
    receipt: 'story:a4:field-pack-dropped'
  });
  const screenshotFixture = path.join(MAIN_ROOT, 'artifacts', 'journey', 'failure.png');
  assert.deepEqual(failureScreenshotEvidence(screenshotFixture, false), {},
    'A failed screenshot capture must not claim an artifact path');
  assert.deepEqual(failureScreenshotEvidence(screenshotFixture, true), {
    failureScreenshot: 'main/artifacts/journey/failure.png'
  }, 'A successful screenshot capture must report its artifact path');

  return {
    schema: 'paravoxia.chapterJourneyProbeSelfTest.v1',
    status: 'passed',
    browserLaunched: false,
    contractSchema: CONTRACT_SCHEMA,
    reportSchema: REPORT_SCHEMA,
    checks: [
      'CLI lane and mode aliases reject contradictory identity',
      'hardware-only launch disables software fallback and renderer attestation fails closed',
      'direct entry remains explicitly diagnostic and noncertifying',
      'headless scripted input cannot claim headed pointer lock',
      'editable focus value trusted typing hotkey isolation and exactly-once submit',
      'prompt zero-or-one ownership viewport geometry and protected-surface overlap',
      'runtime candidates winner required priority trace-or-effects effect no-op and stale clear',
      'generic direct-entry runtime state and trusted action transitions fail closed on unhealthy objectives missing receipts unrestored control and inert input',
      'planned reload new document Continue exactly once first-frame postconditions and successor',
      'canonical input lifecycle interaction and entry-state contracts project into runnable scenario types',
      'chapters without focused scenarios remain explicit rather than fabricating browser certification'
    ],
    mutationProof: mutations
  };
}

function laneIdFor(lane) {
  if (lane.entryPath === 'direct-entry') return 'direct-entry-diagnostic';
  if (lane.entryPath === 'resume') return 'reload-continue';
  return lane.requestedControlMode === 'movie' ? 'movie' : 'continuous-manual';
}

function reportStatus(results) {
  if (results.some(result => result.status === 'failed')) return 'failed';
  if (results.some(result => result.status === 'blocked')) return 'blocked';
  if (results.length === 0) return 'blocked';
  return 'passed';
}

async function runBrowser(options) {
  if (!existsSync(options.manifest)) throw new Error(`Journey manifest not found: ${options.manifest}`);
  const manifestBytes = readFileSync(options.manifest);
  const rawManifest = JSON.parse(manifestBytes.toString('utf8'));
  const contractSha256 = sha256(manifestBytes);
  const revision = sourceRevision();
  const manifest = normalizeManifest(rawManifest, options.chapter, options.timeoutMs);
  const lane = classifyLane(options);
  const laneEvaluation = evaluateLaneClaim(lane);
  let scenarios = manifest.scenarios.filter(scenario => scenarioApplies(scenario, lane));
  if (options.scenario) scenarios = scenarios.filter(scenario => scenario.id === options.scenario);
  if (options.scenario && scenarios.length === 0) {
    throw new Error(`Scenario ${options.scenario} is absent or does not apply to ${laneIdFor(lane)}`);
  }

  const runId = safeSlug(options.runId ?? `${options.chapter}-${laneIdFor(lane)}-${Date.now()}`);
  const outputDir = options.output ?? path.join(MAIN_ROOT, 'captures', 'chapter-journey', runId);
  const reportPath = options.report ?? path.join(outputDir, 'chapter-journey-report.json');
  mkdirSync(outputDir, { recursive: true });
  mkdirSync(path.dirname(reportPath), { recursive: true });

  const runStarted = Date.now();
  const startedAt = new Date(runStarted).toISOString();
  const scenarioResults = [];
  if (scenarios.length === 0) {
    const report = {
      schema: REPORT_SCHEMA,
      runId,
      generatedAt: new Date().toISOString(),
      startedAt,
      chapterId: options.chapter,
      sourceRevision: revision,
      status: 'passed',
      disposition: 'passed-no-focused-scenarios',
      machineJourneyCertified: false,
      lane: { ...lane, id: laneIdFor(lane), evaluation: laneEvaluation },
      contract: {
        schema: manifest.schema,
        version: manifest.version,
        path: path.relative(REPO_ROOT, options.manifest).split(path.sep).join('/'),
        sha256: contractSha256,
        requiredLaneIds: manifest.chapter.requiredLaneIds ?? rawManifest.requiredLaneIds ?? [],
        scenarioIds: []
      },
      browser: {
        launched: false,
        headed: options.headed,
        hardwareOnly: options.hardwareOnly,
        softwareFallbackAllowed: !options.hardwareOnly,
        executablePath: options.browser,
        viewport: options.viewport,
        profile: options.profile,
        baseUrl: options.baseUrl
      },
      hardwareAttestation: {
        required: options.hardwareOnly,
        status: 'not-run-no-focused-scenarios',
        scenarios: []
      },
      timings: { totalMs: Date.now() - runStarted, scenarios: [] },
      scenarios: [],
      summary: { passed: 0, failed: 0, blocked: 0, total: 0 },
      failures: [],
      unavailable: [],
      notes: [`No focused journey regression scenario applies to ${laneIdFor(lane)}; full chapter continuity remains owned by chapter-functional-evidence.`]
    };
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    return { report, reportPath };
  }

  const { chromium } = await import('playwright-core');
  const launchOptions = {
    headless: !options.headed,
    args: browserLaunchArgs(options)
  };
  if (options.browser) launchOptions.executablePath = options.browser;
  const browser = await chromium.launch(launchOptions);
  try {
    for (const scenario of scenarios) {
      const context = await browser.newContext({ viewport: options.viewport });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(error.message));
      const scenarioStarted = Date.now();
      let url = null;
      let preparation = null;
      let inputOwnership = null;
      let hardwareAttestation = null;
      let timings = null;
      let result;
      try {
        await installBrowserHarness(page, scenario.runtimeBridge);
        const opened = await openScenarioPage(page, options, manifest, scenario, lane);
        url = opened.url;
        preparation = opened.preparation;
        inputOwnership = opened.inputOwnership;
        hardwareAttestation = opened.hardwareAttestation;
        timings = opened.timings;
        if (options.hardwareOnly && hardwareAttestation?.evaluation?.status !== 'passed') {
          const evaluation = hardwareAttestation?.evaluation
            ?? evaluateHardwareAttestation({ contextAvailable: false }, true);
          result = {
            id: scenario.id,
            type: scenario.type,
            required: scenario.required,
            status: evaluation.status,
            durationMs: Date.now() - scenarioStarted,
            timings: { ...timings, totalMs: Date.now() - scenarioStarted },
            url,
            checks: evaluation.checks,
            failures: evaluation.failures,
            unavailable: evaluation.unavailable,
            preparation,
            inputOwnership,
            hardwareAttestation
          };
        } else {
          const executionStarted = Date.now();
          const execution = await executeScenario(page, scenario);
          const checks = [...execution.evaluation.checks];
          if (lane.entryPath === 'direct-entry' && DIRECT_PREPARATION_SCENARIOS.has(scenario.id)) {
            checks.push(check('lane.direct-entry-preparation-recorded', preparation?.status === 'prepared',
              'Direct-entry assistance must publish an explicit preparation receipt', preparation));
          }
          if (lane.requestedControlMode === 'manual' && scenario.type === 'interaction-effect') {
            checks.push(check('input.gameplay-ownership', inputOwnership?.pointerLocked === true,
              'Trusted manual interaction must acquire the game canvas input boundary', inputOwnership));
          }
          if (pageErrors.length > 0) {
            checks.push(check('browser.page-errors', false,
              'Journey produced uncaught browser errors', pageErrors));
          } else {
            checks.push(check('browser.page-errors', true, 'Journey produced no uncaught browser errors'));
          }
          const evaluation = resultFromChecks(checks);
          result = {
            id: scenario.id,
            type: scenario.type,
            required: scenario.required,
            status: evaluation.status,
            durationMs: Date.now() - scenarioStarted,
            timings: {
              ...timings,
              scenarioExecutionMs: Date.now() - executionStarted,
              totalMs: Date.now() - scenarioStarted
            },
            url,
            checks: evaluation.checks,
            failures: evaluation.failures,
            unavailable: evaluation.unavailable,
            preparation,
            inputOwnership,
            hardwareAttestation,
            evidence: execution.evidence
          };
        }
      } catch (error) {
        const failureRuntime = await readRuntimeBridge(page, scenario.runtimeBridge)
          .catch(runtimeError => ({
            available: false,
            bridge: scenario.runtimeBridge,
            reason: runtimeError instanceof Error ? runtimeError.message : String(runtimeError),
            snapshot: null
          }));
        preparation ??= failureRuntime.snapshot?.preparation ?? null;
        const screenshot = path.join(outputDir, `${safeSlug(scenario.id)}-failure.png`);
        let screenshotCaptured = false;
        try {
          await page.screenshot({ path: screenshot, timeout: 15_000 });
          screenshotCaptured = true;
        } catch {
          // The report must not advertise an artifact that was never written.
        }
        result = {
          id: scenario.id,
          type: scenario.type,
          required: scenario.required,
          status: 'failed',
          durationMs: Date.now() - scenarioStarted,
          url,
          checks: [],
          failures: [error instanceof Error ? error.message : String(error)],
          unavailable: [],
          pageErrors,
          preparation,
          inputOwnership,
          hardwareAttestation,
          timings: { ...timings, totalMs: Date.now() - scenarioStarted },
          failureRuntime,
          ...failureScreenshotEvidence(screenshot, screenshotCaptured)
        };
      } finally {
        await context.close().catch(() => undefined);
      }
      scenarioResults.push(result);
      process.stderr.write(`[chapter-journey] ${result.status.toUpperCase()} ${scenario.id}\n`);
    }
  } finally {
    await browser.close().catch(() => undefined);
  }

  const requiredResults = scenarioResults.filter(result => result.required);
  const status = laneEvaluation.status === 'passed' ? reportStatus(requiredResults) : laneEvaluation.status;
  const machineJourneyCertified = status === 'passed' && lane.machineJourneyCertifying;
  const disposition = !lane.machineJourneyCertifying
    ? status === 'passed' ? 'diagnostic-passed-noncertifying'
      : status === 'blocked' ? 'diagnostic-blocked-noncertifying'
        : 'diagnostic-failed-noncertifying'
    : status !== 'passed'
      ? status === 'blocked' ? 'blocked' : 'repair-required'
      : 'machine-journey-passed';
  const report = {
    schema: REPORT_SCHEMA,
    runId,
    generatedAt: new Date().toISOString(),
    startedAt,
    chapterId: options.chapter,
    sourceRevision: revision,
    status,
    disposition,
    machineJourneyCertified,
    lane: { ...lane, id: laneIdFor(lane), evaluation: laneEvaluation },
    contract: {
      schema: manifest.schema,
      version: manifest.version,
      path: path.relative(REPO_ROOT, options.manifest).split(path.sep).join('/'),
      sha256: contractSha256,
      requiredLaneIds: manifest.chapter.requiredLaneIds ?? rawManifest.requiredLaneIds ?? [],
      scenarioIds: scenarios.map(scenario => scenario.id)
    },
    browser: {
      headed: options.headed,
      hardwareOnly: options.hardwareOnly,
      softwareFallbackAllowed: !options.hardwareOnly,
      requestedGpuBackend: options.hardwareOnly ? 'ANGLE OpenGL' : 'default-or-software-diagnostic',
      launchArgs: launchOptions.args,
      executablePath: options.browser,
      viewport: options.viewport,
      profile: options.profile,
      baseUrl: options.baseUrl
    },
    hardwareAttestation: {
      required: options.hardwareOnly,
      status: options.hardwareOnly
        ? reportStatus(scenarioResults.map(result => result.hardwareAttestation?.evaluation
          ?? { status: 'blocked' }))
        : 'diagnostic',
      scenarios: scenarioResults.map(result => ({
        scenarioId: result.id,
        ...(result.hardwareAttestation ?? { evaluation: { status: 'unavailable' } })
      }))
    },
    timings: {
      totalMs: Date.now() - runStarted,
      scenarios: scenarioResults.map(result => ({ scenarioId: result.id, ...result.timings }))
    },
    scenarios: scenarioResults,
    summary: {
      passed: scenarioResults.filter(result => result.status === 'passed').length,
      failed: scenarioResults.filter(result => result.status === 'failed').length,
      blocked: scenarioResults.filter(result => result.status === 'blocked').length,
      total: scenarioResults.length
    },
    failures: scenarioResults.flatMap(result => result.failures.map(message => `${result.id}: ${message}`)),
    unavailable: scenarioResults.flatMap(result => result.unavailable.map(message => `${result.id}: ${message}`))
  };
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return { report, reportPath };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(HELP);
    return;
  }
  if (options.selfTest) {
    process.stdout.write(`${JSON.stringify(runSelfTest(), null, 2)}\n`);
    return;
  }
  const { report, reportPath } = await runBrowser(options);
  process.stdout.write(`${JSON.stringify({
    schema: report.schema,
    runId: report.runId,
    chapterId: report.chapterId,
    status: report.status,
    disposition: report.disposition,
    lane: report.lane.id,
    report: reportPath
  }, null, 2)}\n`);
  if (report.status !== 'passed') process.exitCode = 1;
}

main().catch(error => {
  process.stderr.write(`[chapter-journey] ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
