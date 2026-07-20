#!/usr/bin/env node

/**
 * Manifest-driven Paravoxia chapter acceptance runner.
 *
 * Browser runs are deliberately movie-mode mechanical evidence. They never claim
 * manual input, live-audio capture, human taste, or final council acceptance.
 * The strongest disposition this runner can issue is
 * `machine-ready-for-council-review`.
 *
 * Examples:
 *   node tools/chapter-acceptance.mjs --chapter ch3
 *   node tools/chapter-acceptance.mjs --chapter ch3 --runs 1 --smoke --skip-preflight
 *   node tools/chapter-acceptance.mjs --chapter ch3 --base-url http://127.0.0.1:5201/
 *   node tools/chapter-acceptance.mjs --self-test
 */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MAIN_ROOT = path.resolve(HERE, '..');
const REPO_ROOT = path.resolve(MAIN_ROOT, '..');
const DEFAULT_REGISTRY = path.join(MAIN_ROOT, 'chapter-registry.json');
const REPORT_SCHEMA = 'paravoxia.chapterMechanicalEvidence.v1';
const DEFAULT_RUNS = 3;
const DEFAULT_MAX_SECONDS = 600;
const DEFAULT_STALL_SECONDS = 180;
const DEFAULT_SAMPLE_MS = 1000;
const BOUNDARY_EVIDENCE_SETTLE_MAX_MS = 10_000;

// Mirrors the legacy presentation ladder used by the existing full-run probe.
// A clock reaching one of these thresholds is reported as a suspected timeout
// rescue. Emergent chapters intentionally have no entries here.
const LEGACY_RESCUE_TIMEOUT_SECONDS = Object.freeze({
  'ch1-fixed': 55,
  'ch1-raster': 95,
  'ch1-depth': 60,
  'ch1-nav': 75,
  'ch1-iso': 75,
  'ch1-anomaly': 62,
  'ch2-color': 45,
  'ch2-approach': 45,
  'ch3-gather': 34,
  'ch3-await-rest': 70,
  'ch3-thirst': 75,
  'ch3-forage': 60,
  'ch3-signal': 60,
  'ch4-vigil': 140
});

const HELP = `Paravoxia per-chapter acceptance

Usage:
  node tools/chapter-acceptance.mjs --chapter <id> [options]
  node tools/chapter-acceptance.mjs --list
  node tools/chapter-acceptance.mjs --self-test

Core options:
  --chapter <id>               Chapter id from main/chapter-registry.json
  --registry <path>            Override the registry path
  --runs <n>                   Isolated cold browser runs (default: ${DEFAULT_RUNS})
  --max-seconds <n>            Per-run wall cap (manifest or ${DEFAULT_MAX_SECONDS})
  --stall-seconds <n>          No-meaningful-progress cap (manifest or ${DEFAULT_STALL_SECONDS})
  --profile <tier>             One graphics profile (smoke/debug only)
  --profiles <a,b,c,d>         Explicit profile matrix (must include every registry requirement)
  --viewport <WxH>             Browser viewport (default: 1280x720)
  --screenshot-mode <mode>     boundary | beats | none (default: boundary)

Server/browser options:
  --base-url <url>             Reuse an existing server
  --port <n>                   Port for the owned HMR-off Vite server
  --browser <path>             Explicit Chromium executable
  --headed                     Run the mechanical journey in a headed browser

Evidence/output options:
  --headed-taste <path>        Human headed-taste artifact
  --headed-taste-verdict <v>   accepted | repair-required (otherwise parsed)
  --manual-evidence <path>     External manual-play evidence; never inferred
  --audio-evidence <path>      External live-audio evidence; never inferred
  --output <dir>               Artifact directory
  --report <path>              Final report path
  --run-id <id>                Stable caller-supplied run id
  --candidate-revision <sha>   Exact candidate commit (required outside smoke/debug)

Preflight/debug options:
  --skip-preflight             Allowed only with --smoke or --debug
  --skip-predecessor           Debug-only cold chapter run; never certifies continuity
  --smoke                      Debug-sized run defaults (one cold run)
  --debug                      Permit debug-only shortcuts such as skipped preflight
  --self-test                  Browser-free parser/boundary/disposition checks
`;

function sha256Buffer(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sha256File(filePath) {
  return sha256Buffer(readFileSync(filePath));
}

function safeSlug(value) {
  const slug = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'chapter';
}

function asRepoRelative(filePath) {
  if (!filePath) return null;
  const relative = path.relative(REPO_ROOT, filePath);
  return relative.startsWith('..') ? path.resolve(filePath) : relative.split(path.sep).join('/');
}

function parsePositiveNumber(raw, label, { integer = false } = {}) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0 || (integer && !Number.isInteger(value))) {
    throw new Error(`${label} must be a positive${integer ? ' integer' : ''}; received ${raw}`);
  }
  return value;
}

function parseViewport(raw) {
  const match = String(raw).match(/^(\d+)[xX](\d+)$/);
  if (!match) throw new Error(`--viewport must use WxH syntax; received ${raw}`);
  return {
    width: parsePositiveNumber(match[1], 'viewport width', { integer: true }),
    height: parsePositiveNumber(match[2], 'viewport height', { integer: true })
  };
}

function parseArgs(argv) {
  const options = {
    chapter: null,
    registry: DEFAULT_REGISTRY,
    runs: DEFAULT_RUNS,
    runsExplicit: false,
    maxSeconds: null,
    stallSeconds: null,
    sampleMs: DEFAULT_SAMPLE_MS,
    profile: null,
    profiles: null,
    viewport: { width: 1280, height: 720 },
    screenshotMode: 'boundary',
    baseUrl: null,
    port: null,
    browser: null,
    headed: false,
    headedTaste: null,
    headedTasteVerdict: null,
    manualEvidence: null,
    audioEvidence: null,
    output: null,
    report: null,
    runId: null,
    candidateRevision: null,
    skipPreflight: false,
    skipPredecessor: false,
    smoke: false,
    debug: false,
    list: false,
    selfTest: false,
    help: false
  };

  const valueOptions = new Set([
    'chapter', 'registry', 'runs', 'max-seconds', 'stall-seconds', 'sample-ms',
    'profile', 'profiles', 'viewport', 'screenshot-mode', 'base-url', 'url', 'port', 'browser',
    'headed-taste', 'headed-taste-verdict', 'manual-evidence', 'audio-evidence',
    'output', 'report', 'run-id', 'candidate-revision'
  ]);
  const booleanOptions = new Set([
    'headed', 'skip-preflight', 'skip-predecessor',
    'smoke', 'debug', 'list', 'self-test', 'help'
  ]);

  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`Unexpected positional argument: ${token}`);
    const equals = token.indexOf('=');
    const key = token.slice(2, equals >= 0 ? equals : undefined);
    if (!valueOptions.has(key) && !booleanOptions.has(key)) throw new Error(`Unknown option --${key}`);
    if (booleanOptions.has(key)) {
      if (equals >= 0) throw new Error(`--${key} does not take a value`);
      const property = key.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
      options[property] = true;
      continue;
    }
    const value = equals >= 0 ? token.slice(equals + 1) : argv[++index];
    if (value == null || value.startsWith('--')) throw new Error(`--${key} requires a value`);
    switch (key) {
      case 'chapter': options.chapter = value; break;
      case 'registry': options.registry = path.resolve(value); break;
      case 'runs':
        options.runs = parsePositiveNumber(value, '--runs', { integer: true });
        options.runsExplicit = true;
        break;
      case 'max-seconds': options.maxSeconds = parsePositiveNumber(value, '--max-seconds'); break;
      case 'stall-seconds': options.stallSeconds = parsePositiveNumber(value, '--stall-seconds'); break;
      case 'sample-ms': options.sampleMs = parsePositiveNumber(value, '--sample-ms', { integer: true }); break;
      case 'profile': options.profile = value.toUpperCase(); break;
      case 'profiles': {
        const profiles = value.split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
        if (profiles.length === 0 || new Set(profiles).size !== profiles.length) {
          throw new Error('--profiles must be a comma-separated list of unique profile names');
        }
        options.profiles = profiles;
        break;
      }
      case 'viewport': options.viewport = parseViewport(value); break;
      case 'screenshot-mode': options.screenshotMode = value; break;
      case 'base-url':
      case 'url': options.baseUrl = value; break;
      case 'port': options.port = parsePositiveNumber(value, '--port', { integer: true }); break;
      case 'browser': options.browser = path.resolve(value); break;
      case 'headed-taste': options.headedTaste = path.resolve(value); break;
      case 'headed-taste-verdict': options.headedTasteVerdict = value; break;
      case 'manual-evidence': options.manualEvidence = path.resolve(value); break;
      case 'audio-evidence': options.audioEvidence = path.resolve(value); break;
      case 'output': options.output = path.resolve(value); break;
      case 'report': options.report = path.resolve(value); break;
      case 'run-id': options.runId = value; break;
      case 'candidate-revision': options.candidateRevision = value.trim(); break;
      default: throw new Error(`Unhandled option --${key}`);
    }
  }

  if (!['boundary', 'beats', 'none'].includes(options.screenshotMode)) {
    throw new Error('--screenshot-mode must be boundary, beats, or none');
  }
  if (options.port != null && options.port > 65535) throw new Error('--port must be <= 65535');
  if (options.smoke && !options.runsExplicit) options.runs = 1;
  if (options.profile && options.profiles) {
    throw new Error('--profile and --profiles are mutually exclusive');
  }
  if (options.profile && !options.smoke && !options.debug) {
    throw new Error('--profile is a single-profile shortcut permitted only with --smoke or --debug');
  }
  if (options.candidateRevision != null && !options.candidateRevision) {
    throw new Error('--candidate-revision must be non-empty');
  }
  if (options.skipPreflight && !options.smoke && !options.debug) {
    throw new Error('--skip-preflight is permitted only with --smoke or --debug');
  }
  if (options.skipPredecessor && !options.smoke && !options.debug) {
    throw new Error('--skip-predecessor is permitted only with --smoke or --debug');
  }
  if (!options.help && !options.selfTest && !options.list && !options.chapter) {
    throw new Error('--chapter is required unless --list or --self-test is used');
  }
  return options;
}

function nested(object, dottedPath) {
  return dottedPath.split('.').reduce((value, key) => value?.[key], object);
}

function firstString(object, paths) {
  for (const candidate of paths) {
    const value = nested(object, candidate);
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function firstFinite(object, paths) {
  for (const candidate of paths) {
    const value = Number(nested(object, candidate));
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function stringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => typeof item === 'string' ? item : item?.id ?? item?.beat ?? null)
    .filter(item => typeof item === 'string' && item.trim())
    .map(item => item.trim());
}

function signedAnchorIdsFromRefs(refs) {
  return stringArray(refs).flatMap(ref => {
    const match = ref.match(/^scene:[^#]+#anchor:(.+)$/);
    return match?.[1] ? [match[1]] : [];
  });
}

const QUALITY_PROFILE_NAMES = new Set(['ULTRA', 'HIGH', 'MEDIUM', 'LOW', 'POTATO']);

function normalizeVariantProfiles(value) {
  if (!Array.isArray(value)) return [];
  return value.map((variant, index) => {
    if (!variant || typeof variant !== 'object' || Array.isArray(variant)) {
      throw new Error(`requiredVariantProfiles[${index}] must be a named variant object.`);
    }
    const id = typeof variant.id === 'string' ? variant.id.trim() : '';
    const qualityProfile = typeof variant.qualityProfile === 'string'
      ? variant.qualityProfile.trim().toUpperCase()
      : '';
    const deviceClass = variant.deviceClass;
    const viewport = variant.viewport;
    if (!id) throw new Error(`requiredVariantProfiles[${index}].id must be non-empty.`);
    if (!QUALITY_PROFILE_NAMES.has(qualityProfile)) {
      throw new Error(`requiredVariantProfiles[${index}].qualityProfile is unsupported: ${qualityProfile || 'missing'}.`);
    }
    if (!['desktop', 'mobile'].includes(deviceClass)) {
      throw new Error(`requiredVariantProfiles[${index}].deviceClass must be desktop or mobile.`);
    }
    if (
      !viewport
      || !Number.isInteger(viewport.width)
      || !Number.isInteger(viewport.height)
      || viewport.width < 320
      || viewport.height < 480
    ) {
      throw new Error(`requiredVariantProfiles[${index}].viewport must be an integer viewport of at least 320x480.`);
    }
    if (typeof variant.reducedMotion !== 'boolean') {
      throw new Error(`requiredVariantProfiles[${index}].reducedMotion must be boolean.`);
    }
    return {
      id,
      qualityProfile,
      deviceClass,
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: variant.reducedMotion
    };
  });
}

function registryRows(registry) {
  const container = Array.isArray(registry)
    ? registry
    : registry?.chapters ?? registry?.chapterRegistry ?? registry?.story?.chapters;
  if (Array.isArray(container)) return container.map((value, index) => ({ key: String(index), value }));
  if (container && typeof container === 'object') {
    return Object.entries(container).map(([key, value]) => ({ key, value }));
  }
  throw new Error('Chapter registry must be an array or contain a chapters object/array.');
}

function normalizeBudgets(raw) {
  const source = raw?.performanceBudget
    ?? raw?.performance?.budget
    ?? raw?.acceptance?.performanceBudgets
    ?? raw?.acceptance?.performance
    ?? raw?.budgets
    ?? {};
  const aliases = {
    maxEntryLoadMs: ['maxEntryLoadMs', 'entryLoadMs', 'loadMs'],
    maxSceneReadyMs: ['maxSceneReadyMs', 'sceneReadyMs'],
    maxBoundaryMs: ['maxBoundaryMs', 'chapterDurationMs'],
    minFps: ['minFps', 'targetFps'],
    maxP95FrameTimeMs: ['maxP95FrameTimeMs', 'p95FrameTimeMs'],
    maxFrameGapMs: ['maxFrameGapMs'],
    maxLongTasks: ['maxLongTasks', 'longTaskCount'],
    maxHeapGrowthBytes: ['maxHeapGrowthBytes'],
    maxHeapBytes: ['maxHeapBytes'],
    maxDrawCalls: ['maxDrawCalls', 'drawCalls'],
    maxTriangles: ['maxTriangles', 'triangles']
  };
  const budgets = {};
  for (const [canonical, keys] of Object.entries(aliases)) {
    const value = firstFinite(source, keys);
    if (value != null) budgets[canonical] = value;
  }
  return budgets;
}

function normalizeChapterRegistry(registry) {
  const rows = registryRows(registry);
  const terminalBeat = typeof registry?.terminalBeat === 'string' && registry.terminalBeat.trim()
    ? registry.terminalBeat.trim()
    : null;
  const chapters = rows.map(({ key, value: raw }, index) => {
    if (!raw || typeof raw !== 'object') throw new Error(`Chapter entry ${key} must be an object.`);
    const id = firstString(raw, ['id', 'chapterId', 'slug']) ?? key;
    const beats = stringArray(raw.beats ?? raw.scope?.beats ?? raw.storyBeats ?? raw.runtime?.beats);
    const entryBeat = firstString(raw, [
      'entryBeat', 'startBeat', 'entry.beat', 'entry', 'start', 'runtime.entryBeat',
      'acceptance.entryBeat', 'boundary.entryBeat', 'boundary.startBeat'
    ]) ?? beats[0] ?? null;
    const nextEntryBeat = firstString(raw, [
      'nextEntryBeat', 'nextChapterEntryBeat', 'targetBeat', 'completionBeat',
      'acceptance.targetBeat', 'acceptance.nextEntryBeat', 'boundary.targetBeat',
      'boundary.nextEntryBeat'
    ]);
    const exitBeat = firstString(raw, [
      'exitBeat', 'endBeat', 'lastBeat', 'exit.beat', 'acceptance.exitBeat', 'boundary.exitBeat'
    ]) ?? beats.at(-1) ?? null;
    const explicitTargetBeats = stringArray(
      raw.targetBeats ?? raw.acceptance?.targetBeats ?? raw.boundary?.targetBeats
    );
    const completionMode = firstString(raw, [
      'completionMode', 'completeOn', 'acceptance.completionMode', 'boundary.mode'
    ]) ?? (raw.completeOnExit === true ? 'leave-exit' : 'reach-target');
    const entryAnchorIds = signedAnchorIdsFromRefs(raw.avBoundary?.entry?.anchorRefs);
    const exitAnchorIds = signedAnchorIdsFromRefs(raw.avBoundary?.exit?.anchorRefs);
    const requiredAnchorIds = [...new Set([
      ...entryAnchorIds,
      ...exitAnchorIds,
      ...stringArray(
        raw.requiredAnchorIds ?? raw.acceptance?.requiredAnchorIds ?? raw.signedAv?.requiredAnchorIds
      )
    ])];
    const explicitPreflightTests = stringArray(
      raw.preflightTests ?? raw.staticTests ?? raw.acceptance?.preflightTests
    );
    const requiredObjectiveBeats = stringArray(
      raw.requiredObjectiveBeats ?? raw.acceptance?.requiredObjectiveBeats
    );
    const requiredVariantProfiles = normalizeVariantProfiles(
      raw.requiredVariantProfiles ?? raw.acceptance?.requiredVariantProfiles
    );
    const requiredEvidence = stringArray(
      raw.requiredEvidence ?? raw.acceptance?.requiredEvidence
    );
    const objectiveRefs = stringArray(raw.objectiveRefs);
    const acceptanceEvidenceRefs = stringArray(raw.acceptance?.evidenceRefs);
    const checkpointEvidence = (Array.isArray(raw.checkpoints) ? raw.checkpoints : [])
      .map((checkpoint, checkpointIndex) => ({
        key: firstString(checkpoint, ['key']) ?? `checkpoint-${checkpointIndex + 1}`,
        beat: firstString(checkpoint, ['beat']),
        milestone: firstString(checkpoint, ['milestone']),
        evidenceRefs: stringArray(checkpoint?.evidenceRefs)
      }));
    const checkpointEvidenceRefs = [...new Set(
      checkpointEvidence.flatMap(checkpoint => checkpoint.evidenceRefs)
    )];
    const referencedTests = acceptanceEvidenceRefs.flatMap(ref => {
      const match = ref.match(/^runtime:(.+\.test\.[cm]?[jt]sx?)#/);
      return match?.[1] ? [match[1]] : [];
    });
    const preflightTests = [...new Set([...explicitPreflightTests, ...referencedTests])];
    return {
      id,
      title: firstString(raw, ['title', 'name', 'label']) ?? id,
      order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : index,
      entryBeat,
      exitBeat,
      targetBeats: explicitTargetBeats.length > 0
        ? explicitTargetBeats
        : nextEntryBeat ? [nextEntryBeat] : [],
      completionMode,
      beats,
      budgets: normalizeBudgets(raw),
      minimumColdRuns: Math.max(1, Math.floor(firstFinite(raw, [
        'acceptance.budgets.minimumColdRuns',
        'acceptance.minimumColdRuns',
        'minimumColdRuns'
      ]) ?? DEFAULT_RUNS)),
      minimumVariantProfiles: Math.max(1, Math.floor(firstFinite(raw, [
        'acceptance.budgets.minimumVariantProfiles',
        'acceptance.minimumVariantProfiles',
        'minimumVariantProfiles'
      ]) ?? requiredVariantProfiles.length ?? 1)),
      maxSeconds: firstFinite(raw, ['maxSeconds', 'acceptance.maxSeconds', 'timeouts.maxSeconds']),
      stallSeconds: firstFinite(raw, ['stallSeconds', 'acceptance.stallSeconds', 'timeouts.stallSeconds']),
      objectiveRequired: raw.objectiveRequired === true
        || raw.acceptance?.objectiveRequired === true
        || (
          raw.objectiveRequired !== false
          && raw.acceptance?.objectiveRequired !== false
          && id !== 'prologue'
          && objectiveRefs.length > 0
        ),
      requiredObjectiveBeats,
      requiredVariantProfiles,
      requiredAnchorIds,
      entryAnchorIds,
      exitAnchorIds,
      screenshotsRequired: raw.screenshotsRequired !== false && raw.acceptance?.screenshotsRequired !== false,
      allowedConsolePatterns: stringArray(raw.allowedConsolePatterns ?? raw.acceptance?.allowedConsolePatterns),
      allowedNetworkPatterns: stringArray(raw.allowedNetworkPatterns ?? raw.acceptance?.allowedNetworkPatterns),
      preflightTests,
      requiredEvidence,
      evidenceRequirements: {
        entryRequirements: stringArray(raw.entry?.requirements),
        exitGuarantees: stringArray(raw.exit?.guarantees),
        entryStateRefs: stringArray(raw.entry?.stateRefs),
        exitStateRefs: stringArray(raw.exit?.stateRefs),
        objectiveRefs,
        revealRefs: stringArray(raw.revealRefs),
        acceptanceEvidenceRefs,
        checkpointEvidence,
        checkpointEvidenceRefs,
        stateRefs: [...new Set([
          ...stringArray(raw.entry?.stateRefs),
          ...stringArray(raw.exit?.stateRefs)
        ])]
      },
      requiresSafeSpawn: stringArray(raw.entry?.stateRefs).includes('state:control/on-foot'),
      raw
    };
  }).sort((a, b) => a.order - b.order);

  const ids = new Set();
  for (const [index, chapter] of chapters.entries()) {
    if (!chapter.id) throw new Error(`Chapter at index ${index} has no id.`);
    if (ids.has(chapter.id)) throw new Error(`Duplicate chapter id: ${chapter.id}`);
    ids.add(chapter.id);
    if (!chapter.entryBeat) throw new Error(`Chapter ${chapter.id} has no entryBeat or beats[0].`);
    if (chapter.targetBeats.length === 0 && chapter.completionMode !== 'leave-exit') {
      const nextChapter = chapters[index + 1];
      if (nextChapter?.entryBeat) chapter.targetBeats = [nextChapter.entryBeat];
      else if (terminalBeat && terminalBeat !== chapter.entryBeat) chapter.targetBeats = [terminalBeat];
      else if (chapter.exitBeat) chapter.targetBeats = [chapter.exitBeat];
    }
    if (chapter.completionMode === 'leave-exit' && !chapter.exitBeat) {
      throw new Error(`Chapter ${chapter.id} uses leave-exit without exitBeat.`);
    }
    if (chapter.completionMode !== 'leave-exit' && chapter.targetBeats.length === 0) {
      throw new Error(`Chapter ${chapter.id} has no target boundary.`);
    }
    if (chapter.requiredVariantProfiles.length < chapter.minimumVariantProfiles) {
      throw new Error(
        `Chapter ${chapter.id} declares ${chapter.requiredVariantProfiles.length} required variant profiles, `
        + `below its minimum of ${chapter.minimumVariantProfiles}.`
      );
    }
    if (new Set(chapter.requiredVariantProfiles.map(variant => variant.id)).size !== chapter.requiredVariantProfiles.length) {
      throw new Error(`Chapter ${chapter.id} requiredVariantProfiles must be unique.`);
    }
    const unknownObjectiveBeats = chapter.requiredObjectiveBeats.filter(beat => !chapter.beats.includes(beat));
    if (unknownObjectiveBeats.length > 0) {
      throw new Error(`Chapter ${chapter.id} requires objectives on unowned beats: ${unknownObjectiveBeats.join(', ')}.`);
    }
    if (Object.keys(chapter.budgets).length === 0) {
      throw new Error(`Chapter ${chapter.id} must declare measurable performanceBudgets.`);
    }
  }
  return chapters;
}

function chapterReadinessEntryBeats(chapters) {
  return new Map(chapters.map(chapter => [
    `state:chapter/${chapter.id}-ready`,
    chapter.entryBeat
  ]));
}

function evaluateRegisteredEvidenceRefs(refs, sample, readinessEntryBeats) {
  const uniqueRefs = [...new Set(stringArray(refs))];
  const milestoneEvidence = sample?.milestoneEvidence ?? null;
  const milestoneSnapshotAvailable = milestoneEvidence?.available === true
    && Array.isArray(milestoneEvidence.milestones);
  const observedMilestones = milestoneSnapshotAvailable
    ? new Set(milestoneEvidence.milestones.filter(value => typeof value === 'string'))
    : new Set();
  const boundaryStateAvailable = sample?.boundaryState?.verified === true
    && Array.isArray(sample.boundaryState.stateRefs);
  const observedBoundaryStateRefs = boundaryStateAvailable
    ? new Set(sample.boundaryState.stateRefs.filter(value => typeof value === 'string'))
    : new Set();

  const checks = uniqueRefs.map(ref => {
    if (ref.startsWith('milestone:')) {
      const milestone = ref.slice('milestone:'.length);
      if (!milestone) {
        return {
          ref,
          kind: 'milestone',
          status: 'unsupported',
          source: null,
          reason: 'milestone-ref-has-no-id'
        };
      }
      if (!milestoneSnapshotAvailable) {
        return {
          ref,
          kind: 'milestone',
          status: 'unavailable',
          source: milestoneEvidence?.source ?? null,
          reason: milestoneEvidence?.reason ?? 'runtime-milestone-snapshot-unavailable'
        };
      }
      const observed = observedMilestones.has(milestone);
      return {
        ref,
        kind: 'milestone',
        status: observed ? 'passed' : 'missing',
        source: milestoneEvidence.source ?? 'runtime-progression-module',
        reason: observed ? null : 'runtime-milestone-not-observed'
      };
    }

    if (ref.startsWith('state:chapter/')) {
      const entryBeat = readinessEntryBeats?.get(ref) ?? null;
      if (!entryBeat) {
        return {
          ref,
          kind: 'state',
          status: 'unavailable',
          source: 'runtime-story-beat+registry-entry',
          reason: 'chapter-readiness-ref-is-not-registered'
        };
      }
      if (typeof sample?.beat !== 'string') {
        return {
          ref,
          kind: 'state',
          status: 'unavailable',
          source: 'runtime-story-beat+registry-entry',
          reason: 'runtime-story-beat-unavailable'
        };
      }
      const observed = sample.beat === entryBeat;
      return {
        ref,
        kind: 'state',
        status: observed ? 'passed' : 'missing',
        source: 'runtime-story-beat+registry-entry',
        reason: observed ? null : `runtime-beat-${sample.beat}-does-not-match-${entryBeat}`
      };
    }

    if (ref.startsWith('state:')) {
      if (!boundaryStateAvailable) {
        return {
          ref,
          kind: 'state',
          status: 'unavailable',
          source: sample?.boundaryState?.schema ?? null,
          reason: 'verified-boundary-state-snapshot-unavailable'
        };
      }
      const observed = observedBoundaryStateRefs.has(ref);
      return {
        ref,
        kind: 'state',
        status: observed ? 'passed' : 'missing',
        source: sample.boundaryState.schema ?? 'runtime-boundary-state',
        reason: observed ? null : 'runtime-boundary-state-ref-not-observed'
      };
    }

    return {
      ref,
      kind: 'unsupported',
      status: 'unsupported',
      source: null,
      reason: 'registered-evidence-ref-kind-is-not-observable'
    };
  });

  const missingRefs = checks.filter(check => check.status === 'missing').map(check => check.ref);
  const unavailableRefs = checks.filter(check => check.status === 'unavailable').map(check => check.ref);
  const unsupportedRefs = checks.filter(check => check.status === 'unsupported').map(check => check.ref);
  const complete = checks.every(check => check.status === 'passed');
  return {
    requiredRefs: uniqueRefs,
    checks,
    observed: {
      beat: sample?.beat ?? null,
      boundaryStateVerified: boundaryStateAvailable,
      boundaryStateRefs: [...observedBoundaryStateRefs].sort(),
      milestoneSnapshotAvailable,
      milestones: [...observedMilestones].sort()
    },
    missingRefs,
    unavailableRefs,
    unsupportedRefs,
    complete,
    status: complete
      ? 'passed'
      : unavailableRefs.length > 0 || unsupportedRefs.length > 0
        ? 'blocked'
        : 'failed'
  };
}

function evaluateChapterRegisteredEvidence(chapter, entrySample, finalSample, readinessEntryBeats) {
  const entryRequirements = evaluateRegisteredEvidenceRefs(
    chapter.evidenceRequirements.entryRequirements,
    entrySample,
    readinessEntryBeats
  );
  const exitGuarantees = evaluateRegisteredEvidenceRefs(
    chapter.evidenceRequirements.exitGuarantees,
    finalSample,
    readinessEntryBeats
  );
  const checkpointEvidenceRefs = evaluateRegisteredEvidenceRefs(
    chapter.evidenceRequirements.checkpointEvidenceRefs,
    finalSample,
    readinessEntryBeats
  );
  const groups = [entryRequirements, exitGuarantees, checkpointEvidenceRefs];
  const complete = groups.every(group => group.complete);
  return {
    entryRequirements,
    exitGuarantees,
    checkpoints: chapter.evidenceRequirements.checkpointEvidence ?? [],
    checkpointEvidenceRefs,
    complete,
    status: complete
      ? 'passed'
      : groups.some(group => group.status === 'blocked') ? 'blocked' : 'failed'
  };
}

function registeredEvidenceFailureReasons(evidence) {
  const groups = [
    ['entry requirements', evidence.entryRequirements],
    ['exit guarantees', evidence.exitGuarantees],
    ['checkpoint evidence refs', evidence.checkpointEvidenceRefs]
  ];
  const reasons = [];
  for (const [label, group] of groups) {
    if (group.missingRefs.length > 0) {
      reasons.push(`Registered ${label} were not observed: ${group.missingRefs.join(', ')}.`);
    }
    if (group.unavailableRefs.length > 0) {
      reasons.push(`Registered ${label} could not be evaluated by the runtime probe: ${group.unavailableRefs.join(', ')}.`);
    }
    if (group.unsupportedRefs.length > 0) {
      reasons.push(`Registered ${label} use unsupported evidence ref kinds: ${group.unsupportedRefs.join(', ')}.`);
    }
  }
  return reasons;
}

function evaluateChapterBoundary(chapter, previousBeat, currentBeat) {
  if (!currentBeat) return { reached: false, reason: null };
  if (chapter.completionMode === 'leave-exit') {
    const reached = previousBeat === chapter.exitBeat && currentBeat !== chapter.exitBeat;
    return { reached, reason: reached ? `left-exit:${chapter.exitBeat}->${currentBeat}` : null };
  }
  if (chapter.completionMode === 'leave-chapter' && chapter.beats.length > 0) {
    const reached = chapter.beats.includes(previousBeat) && !chapter.beats.includes(currentBeat);
    return { reached, reason: reached ? `left-chapter:${previousBeat}->${currentBeat}` : null };
  }
  const reached = chapter.targetBeats.includes(currentBeat);
  return { reached, reason: reached ? `reached-target:${currentBeat}` : null };
}

function signedAvAnchorIds(sample) {
  return [
    sample?.sceneAv?.anchorId,
    ...(sample?.sceneAv?.activatedAnchorIds ?? []),
    ...(sample?.sceneAv?.activationHistoryAnchorIds ?? [])
  ].filter(Boolean);
}

function recordSignedAvAnchors(sample, seen) {
  for (const anchorId of signedAvAnchorIds(sample)) seen.add(anchorId);
}

function requiredSignedAvAnchorsSeen(chapter, seen) {
  return chapter.requiredAnchorIds.every(anchorId => seen.has(anchorId));
}

function orderedBeatCoverage(expectedBeats, observedBeats) {
  let cursor = 0;
  for (const beat of observedBeats) {
    if (beat === expectedBeats[cursor]) cursor += 1;
    if (cursor >= expectedBeats.length) break;
  }
  return {
    complete: cursor === expectedBeats.length,
    coveredCount: cursor,
    expectedCount: expectedBeats.length,
    missingFrom: expectedBeats.slice(cursor),
    expected: [...expectedBeats],
    observed: [...observedBeats]
  };
}

function normalizeObjectiveEvidenceText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function actionableObjectiveEvidenceText(value) {
  return normalizeObjectiveEvidenceText(value)
    .replace(/^(?:WORK ORDER|CURRENT OBJECTIVE)\b[\s\u00b7:|\-]*/i, '')
    .replace(/\bROUTE RECALIBRATING\s*[\u00b7:|\-]*\s*OBJECTIVE REMAINS ACTIVE\b/gi, '')
    .trim();
}

/**
 * Return a stable identity only for objective evidence a player could actually
 * act on. Presence or readable copy alone is deliberately insufficient: the
 * objective must publish its progression-derived id, exact marker label, and a
 * healthy marker route (or explicitly declare that it is markerless).
 */
function objectiveEvidenceIdentity(observation) {
  if (!observation || typeof observation !== 'object') return null;
  const objectiveId = normalizeObjectiveEvidenceText(observation.id);
  const markerLabel = normalizeObjectiveEvidenceText(observation.markerLabel);
  const markerRequirementDeclared = typeof observation.requiresMarker === 'boolean';
  const healthDeclared = ['idle', 'ready', 'missing-marker'].includes(observation.health);
  const markerless = observation.requiresMarker === false;
  const routeReady = observation.health === 'ready' || markerless;
  const objectiveText = observation.rendered === true && observation.visible === true
    ? actionableObjectiveEvidenceText(observation.text)
    : '';
  if (
    !objectiveId
    || !markerLabel
    || !markerRequirementDeclared
    || !healthDeclared
    || !routeReady
    || !objectiveText
  ) return null;
  // The id, not mutable progress copy, owns beat evidence. Reusing an id across
  // a beat boundary is stale evidence even if its text or marker changes.
  return JSON.stringify({ objectiveId });
}

/**
 * One progression-derived objective id can certify only the beat on which it
 * first became valid. This prevents stale guidance that survives a beat
 * boundary (or merely changes progress copy) from being re-labelled as
 * evidence for the next beat.
 */
function objectiveEvidenceBeats(trace) {
  const observedBeats = new Set();
  const claimedEvidence = new Set();
  for (const entry of trace) {
    const identity = objectiveEvidenceIdentity(entry);
    if (!identity || claimedEvidence.has(identity)) continue;
    claimedEvidence.add(identity);
    if (typeof entry.beat === 'string' && entry.beat) observedBeats.add(entry.beat);
  }
  return observedBeats;
}

function computeDisposition({
  runs,
  requiredRuns,
  preflightPassed,
  predecessorBoundaryStatus = 'passed',
  machineReadyForCouncilReview = null
}) {
  if (!preflightPassed) return 'repair-required';
  if (predecessorBoundaryStatus === 'blocked') return 'blocked';
  if (predecessorBoundaryStatus === 'failed') return 'repair-required';
  if (!Array.isArray(runs) || runs.length === 0 || runs.every(run => run.status === 'blocked')) return 'blocked';
  if (runs.some(run => run.status === 'failed')) return 'repair-required';
  if (runs.length < requiredRuns || runs.some(run => run.status === 'blocked')) return 'blocked';
  if (!runs.every(run => run.status === 'passed')) return 'repair-required';
  return machineReadyForCouncilReview === false ? 'blocked' : 'machine-ready-for-council-review';
}

function positiveEvidenceVerdict(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['accepted', 'accept', 'approved', 'approve', 'pass', 'passed'].includes(normalized)) return 'accepted';
  if (['repair-required', 'rejected', 'reject', 'fail', 'failed', 'changes-requested'].includes(normalized)) return 'rejected';
  return null;
}

function evidenceArtifact(filePath, explicitVerdict = null, kind = 'external') {
  if (!filePath) {
    return {
      kind,
      status: 'not-provided',
      provided: false,
      path: null,
      sha256: null,
      bytes: null,
      verdict: null
    };
  }
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    return {
      kind,
      status: 'missing',
      provided: false,
      path: asRepoRelative(filePath),
      sha256: null,
      bytes: null,
      verdict: null
    };
  }
  const bytes = readFileSync(filePath);
  let candidate = explicitVerdict;
  if (!candidate) {
    try {
      const parsed = JSON.parse(bytes.toString('utf8'));
      candidate = parsed.verdict ?? parsed.status ?? parsed.disposition ?? parsed.overallStatus ?? null;
    } catch {
      const text = bytes.toString('utf8');
      const match = text.match(/(?:verdict|status|disposition)\s*[:=-]\s*(accepted|approved|pass(?:ed)?|repair-required|rejected|fail(?:ed)?)/i);
      candidate = match?.[1] ?? null;
    }
  }
  const verdict = positiveEvidenceVerdict(candidate);
  return {
    kind,
    status: verdict ?? 'supplied-unscored',
    provided: true,
    path: asRepoRelative(filePath),
    sha256: sha256Buffer(bytes),
    bytes: bytes.length,
    verdict
  };
}

/**
 * Human acceptance is intentionally strict. It must be structured JSON tied to
 * this exact candidate; prose containing the word "accepted" is not evidence.
 */
function headedTasteArtifact(filePath, explicitVerdict, chapterId, source) {
  const base = evidenceArtifact(filePath, null, 'headed-taste');
  if (!base.provided) return { ...base, bindingErrors: [] };
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    return {
      ...base,
      status: 'unverified',
      verdict: null,
      bindingErrors: [`Headed taste must be structured JSON: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
  const candidate = parsed?.candidate ?? {};
  const declaredVerdict = parsed?.verdict ?? parsed?.status ?? parsed?.disposition ?? null;
  const normalizedVerdict = positiveEvidenceVerdict(declaredVerdict);
  const bindingErrors = [];
  if (parsed?.schema !== 'paravoxia.headedTasteEvidence.v1') {
    bindingErrors.push('schema must equal paravoxia.headedTasteEvidence.v1');
  }
  if (parsed?.chapterId !== chapterId) {
    bindingErrors.push(`chapterId must equal ${chapterId}`);
  }
  if (candidate?.revision !== source.revision) {
    bindingErrors.push('candidate.revision does not match the report source revision');
  }
  if (!source.candidateTreeSha256 || candidate?.candidateTreeSha256 !== source.candidateTreeSha256) {
    bindingErrors.push('candidate.candidateTreeSha256 does not match the exact candidate tree identity');
  }
  if (parsed?.headedRealGpuEvidence !== true) {
    bindingErrors.push('headedRealGpuEvidence must be true');
  }
  if (parsed?.audiblePlaybackReviewed !== true) {
    bindingErrors.push('audiblePlaybackReviewed must be true');
  }
  if (parsed?.decisionSource !== 'human_operator') {
    bindingErrors.push('decisionSource must equal human_operator');
  }
  if (parsed?.manualPlayReviewed !== true) {
    bindingErrors.push('manualPlayReviewed must be true');
  }
  if (parsed?.resetResumeReviewed !== true) {
    bindingErrors.push('resetResumeReviewed must be true');
  }
  if (explicitVerdict && positiveEvidenceVerdict(explicitVerdict) !== normalizedVerdict) {
    bindingErrors.push('--headed-taste-verdict does not match the structured artifact verdict');
  }
  const status = bindingErrors.length > 0
    ? 'unverified'
    : normalizedVerdict ?? 'unverified';
  return {
    ...base,
    status,
    verdict: status === 'accepted' || status === 'rejected' ? status : null,
    schema: parsed?.schema ?? null,
    chapterId: parsed?.chapterId ?? null,
    candidate: {
      revision: candidate?.revision ?? null,
      worktreeStatusSha256: candidate?.worktreeStatusSha256 ?? null,
      candidateTreeSha256: candidate?.candidateTreeSha256 ?? null
    },
    headedRealGpuEvidence: parsed?.headedRealGpuEvidence === true,
    audiblePlaybackReviewed: parsed?.audiblePlaybackReviewed === true,
    decisionSource: parsed?.decisionSource ?? null,
    manualPlayReviewed: parsed?.manualPlayReviewed === true,
    resetResumeReviewed: parsed?.resetResumeReviewed === true,
    bindingErrors
  };
}

const GENERATED_EVIDENCE_ROOTS = Object.freeze([
  'captures',
  '.terra/workflow-runs'
]);

function normalizedCandidateExclusions(repoRoot, excludedPaths = []) {
  const exclusions = new Set(GENERATED_EVIDENCE_ROOTS);
  for (const filePath of excludedPaths) {
    if (!filePath) continue;
    const absolutePath = path.isAbsolute(filePath)
      ? path.resolve(filePath)
      : path.resolve(repoRoot, filePath);
    const relativePath = path.relative(repoRoot, absolutePath);
    if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) continue;
    exclusions.add(relativePath.split(path.sep).join('/').replace(/^\.\//, '').replace(/\/$/, ''));
  }
  return [...exclusions].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function candidateEvidencePaths(options = {}) {
  return [
    options.headedTaste,
    options.manualEvidence,
    options.audioEvidence,
    options.output,
    options.report
  ].filter(Boolean);
}

function sourceIdentity({ repoRoot = REPO_ROOT, excludedPaths = [] } = {}) {
  const run = (args) => {
    try {
      return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
      return '';
    }
  };
  const runBuffer = (args) => {
    try {
      return execFileSync('git', args, {
        cwd: repoRoot,
        encoding: null,
        stdio: ['ignore', 'pipe', 'ignore'],
        maxBuffer: 128 * 1024 * 1024
      });
    } catch {
      return null;
    }
  };
  const excludedRepoPaths = normalizedCandidateExclusions(repoRoot, excludedPaths);
  const excludedPathspecs = excludedRepoPaths.map(relativePath => (
    `:(top,literal,exclude)${relativePath}`
  ));
  const isExcluded = (relativePath) => {
    const normalized = relativePath.split(path.sep).join('/').replace(/^\.\//, '');
    return excludedRepoPaths.some(excluded => (
      normalized === excluded || normalized.startsWith(`${excluded}/`)
    ));
  };
  const revision = run(['rev-parse', 'HEAD']) || null;
  const trackedDiff = runBuffer(['diff', '--binary', 'HEAD', '--', '.', ...excludedPathspecs]);
  const untrackedOutput = runBuffer(['ls-files', '--others', '--exclude-standard', '-z']);
  let candidateTreeSha256 = null;
  let worktreeStatusSha256 = null;
  let untrackedFileCount = null;
  let dirty = null;
  if (revision && trackedDiff && untrackedOutput) {
    const untrackedPaths = untrackedOutput
      .toString('utf8')
      .split('\0')
      .filter(Boolean)
      .filter(relativePath => !isExcluded(relativePath))
      .sort((a, b) => a.localeCompare(b));
    const hash = createHash('sha256');
    const statusHash = createHash('sha256');
    hash.update('HEAD\0');
    hash.update(revision);
    hash.update('\0DIFF_BINARY_HEAD\0');
    hash.update(trackedDiff);
    statusHash.update('FILTERED_DIFF_BINARY_HEAD\0');
    statusHash.update(trackedDiff);
    for (const relativePath of untrackedPaths) {
      const absolutePath = path.join(repoRoot, relativePath);
      const contentIdentity = existsSync(absolutePath) && statSync(absolutePath).isFile()
        ? sha256File(absolutePath)
        : 'non-file';
      hash.update('\0UNTRACKED\0');
      hash.update(relativePath);
      hash.update('\0');
      hash.update(contentIdentity);
      statusHash.update('\0UNTRACKED\0');
      statusHash.update(relativePath);
      statusHash.update('\0');
      statusHash.update(contentIdentity);
    }
    candidateTreeSha256 = hash.digest('hex');
    worktreeStatusSha256 = statusHash.digest('hex');
    untrackedFileCount = untrackedPaths.length;
    dirty = trackedDiff.length > 0 || untrackedPaths.length > 0;
  }
  return {
    revision,
    dirty,
    worktreeStatusSha256,
    worktreeIdentityAlgorithm: 'diagnostic only: sha256(filtered git diff --binary HEAD + sorted untracked path/content identities)',
    candidateTreeSha256,
    candidateTreeIdentityAlgorithm: 'sha256(HEAD\\0<revision>\\0DIFF_BINARY_HEAD\\0<filtered git diff --binary HEAD -->[\\0UNTRACKED\\0<sorted filtered path>\\0<sha256 file bytes>]*)',
    untrackedFileCount,
    excludedGeneratedRoots: GENERATED_EVIDENCE_ROOTS,
    excludedExplicitPaths: excludedRepoPaths.filter(relativePath => !GENERATED_EVIDENCE_ROOTS.includes(relativePath))
  };
}

function commandResult(label, command, args, options = {}) {
  const startedAt = Date.now();
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? MAIN_ROOT,
    env: { ...process.env, PROBE_NO_HMR: '1' },
    encoding: 'utf8',
    timeout: options.timeoutMs ?? 120_000,
    maxBuffer: 8 * 1024 * 1024
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  return {
    label,
    command: [command, ...args].join(' '),
    status: result.status === 0 ? 'passed' : 'failed',
    exitCode: result.status,
    signal: result.signal ?? null,
    durationMs: Date.now() - startedAt,
    outputTail: output.slice(-20_000),
    error: result.error?.message ?? null
  };
}

function runPreflight(chapter, registryPath, skipped) {
  const registrySelection = {
    label: 'chapter-registry-selection',
    command: `validate ${asRepoRelative(registryPath)}#${chapter.id}`,
    status: 'passed',
    exitCode: 0,
    signal: null,
    durationMs: 0,
    outputTail: `entry=${chapter.entryBeat} targets=${chapter.targetBeats.join(',') || chapter.exitBeat}`,
    error: null
  };
  if (skipped) {
    return {
      skipped: true,
      reason: 'Explicit smoke/debug skip requested.',
      passed: false,
      commands: [{ ...registrySelection, status: 'skipped', exitCode: null }]
    };
  }

  const commands = [registrySelection];
  commands.push(commandResult(
    'chapter-registry-certification-authority',
    process.execPath,
    ['tools/chapter-registry-gate.mjs', '--certify', '--chapter', chapter.id],
    { timeoutMs: 120_000 }
  ));
  commands.push(commandResult(
    'chapter-journey-contract-authority',
    process.execPath,
    ['tools/chapter-journey-contract-gate.mjs'],
    { timeoutMs: 120_000 }
  ));
  commands.push(commandResult(
    'story-authority-gate',
    process.execPath,
    ['tools/story-authority-gate.mjs'],
    { timeoutMs: 120_000 }
  ));
  const tests = [...new Set(['src/story/storyState.test.ts', ...chapter.preflightTests])];
  commands.push(commandResult(
    'chapter-static-tests',
    process.execPath,
    ['node_modules/vitest/vitest.mjs', 'run', ...tests],
    { timeoutMs: 180_000 }
  ));
  return {
    skipped: false,
    reason: null,
    passed: commands.every(command => command.status === 'passed'),
    commands
  };
}

async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

async function serverResponds(baseUrl) {
  try {
    const response = await fetch(baseUrl, { redirect: 'manual' });
    return response.ok || (response.status >= 300 && response.status < 400);
  } catch {
    return false;
  }
}

async function startOwnedServer(port, serverLogPath) {
  const baseUrl = `http://127.0.0.1:${port}/`;
  if (await serverResponds(baseUrl)) {
    throw new Error(`Refusing to reuse occupied port ${port}; pass --base-url explicitly to reuse a server.`);
  }
  const stream = createWriteStream(serverLogPath, { flags: 'w' });
  const vite = spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    {
      cwd: MAIN_ROOT,
      env: { ...process.env, PROBE_NO_HMR: '1' },
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );
  vite.stdout.pipe(stream);
  vite.stderr.pipe(stream);
  for (let attempt = 0; attempt < 160; attempt++) {
    if (await serverResponds(baseUrl)) return { process: vite, stream, baseUrl };
    if (vite.exitCode != null) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  vite.kill('SIGTERM');
  stream.end();
  throw new Error(`Owned HMR-off Vite server did not start on ${baseUrl}`);
}

function systemCommandPath(command) {
  try {
    return execFileSync('sh', ['-lc', `command -v ${command}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim() || null;
  } catch {
    return null;
  }
}

function discoverChromium(explicitPath = null) {
  const direct = [
    explicitPath,
    process.env.CHAPTER_ACCEPTANCE_CHROMIUM,
    process.env.CHROME_PATH,
    process.env.CHROMIUM_PATH,
    process.env.PLAYWRIGHT_CHROMIUM_EXE
  ].filter(Boolean);
  for (const candidate of direct) {
    if (existsSync(candidate)) return { executablePath: candidate, source: 'explicit-or-env' };
  }

  const cache = path.join(os.homedir(), '.cache', 'ms-playwright');
  if (existsSync(cache)) {
    const versions = readdirSync(cache)
      .filter(name => /^(?:chromium|chromium_headless_shell)-\d+$/.test(name))
      .sort((a, b) => Number(b.split('-').at(-1)) - Number(a.split('-').at(-1)));
    for (const version of versions) {
      for (const relative of [
        'chrome-linux/chrome',
        'chrome-linux64/chrome',
        'chrome-headless-shell-linux64/chrome-headless-shell',
        'chrome-headless-shell-linux/headless_shell'
      ]) {
        const candidate = path.join(cache, version, relative);
        if (existsSync(candidate)) return { executablePath: candidate, source: 'playwright-cache' };
      }
    }
  }

  for (const command of ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable']) {
    const candidate = systemCommandPath(command);
    if (candidate && existsSync(candidate)) return { executablePath: candidate, source: 'system-path' };
  }
  for (const candidate of ['/snap/bin/chromium', '/usr/bin/chromium', '/usr/bin/google-chrome']) {
    if (existsSync(candidate)) return { executablePath: candidate, source: 'system-known-path' };
  }
  throw new Error('No Chromium executable found. Set CHAPTER_ACCEPTANCE_CHROMIUM or pass --browser.');
}

function matchesAllowed(value, patterns) {
  return patterns.some(pattern => {
    if (pattern.startsWith('/') && pattern.lastIndexOf('/') > 0) {
      const end = pattern.lastIndexOf('/');
      try {
        return new RegExp(pattern.slice(1, end), pattern.slice(end + 1)).test(value);
      } catch {
        return value.includes(pattern);
      }
    }
    return value.includes(pattern);
  });
}

const GRAPHICS_DIAGNOSTIC_PATTERN = /(?:THREE\.WebGLRenderer|THREE\.WebGLProgram|WebGL[^\n]*(?:INVALID_|context|uninitiali[sz]ed|shader|error)|GL_INVALID)/i;

function isUnexpectedGraphicsDiagnostic(event, allowedPatterns = []) {
  return (event?.type === 'warning' || event?.type === 'error')
    && GRAPHICS_DIAGNOSTIC_PATTERN.test(String(event?.text ?? ''))
    && !matchesAllowed(String(event?.text ?? ''), allowedPatterns);
}

function quantizedTuple(value, step = 0.5) {
  if (!Array.isArray(value)) return null;
  return value.map(component => Number.isFinite(component)
    ? Math.round(component / step) * step
    : null);
}

function summarizeSystemProbe(snapshot) {
  if (!snapshot) return null;
  const windows = Array.isArray(snapshot.windows) ? snapshot.windows : [];
  const max = field => windows.reduce((value, window) => Math.max(value, Number(window?.[field] ?? 0)), 0);
  return {
    available: true,
    context: snapshot.context ?? null,
    windowCount: windows.length,
    maxP95Ms: max('p95Ms'),
    maxP99Ms: max('p99Ms'),
    maxFrameGapMs: max('maxFrameGapMs'),
    maxLongFrameCount: max('longFrameCount'),
    maxDrawCalls: max('drawCalls'),
    maxTriangles: max('triangles'),
    maxPrograms: max('programs'),
    maxGeometries: max('geometries'),
    maxTextures: max('textures'),
    maxUsedJsHeapBytes: max('usedJsHeapBytes'),
    observedLongTasks: Number(snapshot.observedLongTasks ?? 0),
    maxObservedLongTaskMs: Number(snapshot.maxObservedLongTaskMs ?? 0)
  };
}

function summarizeRunnerFrameProbe(frameProbe) {
  return {
    fps: Number.isFinite(frameProbe?.fps) ? Number(frameProbe.fps.toFixed(3)) : null,
    p95FrameTimeMs: Number.isFinite(frameProbe?.p95FrameTimeMs) ? frameProbe.p95FrameTimeMs : null,
    maxFrameGapMs: Number.isFinite(frameProbe?.maxFrameGapMs) ? frameProbe.maxFrameGapMs : null,
    longTaskCount: Number.isFinite(frameProbe?.longTaskCount) ? frameProbe.longTaskCount : null,
    maxLongTaskMs: Number.isFinite(frameProbe?.maxLongTaskMs) ? frameProbe.maxLongTaskMs : null,
    frameMeasurement: {
      source: frameProbe ? 'chapter-acceptance-probe' : 'unavailable',
      screenshotIntervalsExcluded: true,
      wallDurationMs: frameProbe?.wallDurationMs ?? null,
      gameplayDurationMs: frameProbe?.durationMs ?? null,
      excludedDurationMs: frameProbe?.excludedDurationMs ?? null,
      exclusionCount: frameProbe?.exclusionCount ?? 0,
      frames: frameProbe?.frames ?? null
    }
  };
}

const HARDWARE_ONLY_PERFORMANCE_BUDGETS = new Set([
  'minFps',
  'maxP95FrameTimeMs',
  'maxFrameGapMs',
  // Chromium's Long Tasks observer includes synchronous software-WebGL draw
  // work on the renderer main thread. SwiftShader therefore makes this count a
  // renderer diagnostic too; it remains a hard budget on proven hardware.
  'maxLongTasks'
]);

const SOFTWARE_RENDERER_PATTERN = /(?:swiftshader|llvmpipe|softpipe|software(?:\s+rasterizer|\s+renderer|\s+rendering)?|mesa offscreen|lavapipe|swrast|microsoft basic render)/i;
const GENERIC_RENDERER_PATTERN = /^(?:webgl|webkit webgl|angle)$/i;

function classifyWebGlRenderer(rawEvidence) {
  const evidence = rawEvidence && typeof rawEvidence === 'object' ? rawEvidence : {};
  const strings = [
    evidence.unmaskedRenderer,
    evidence.renderer,
    evidence.unmaskedVendor,
    evidence.vendor
  ].filter(value => typeof value === 'string' && value.trim().length > 0);
  const joined = strings.join(' | ');
  let classification = 'unknown';
  let reason = 'WebGL renderer identity was not specific enough to prove hardware acceleration.';

  if (evidence.contextAvailable !== true) {
    classification = 'unavailable';
    reason = 'No WebGL context renderer evidence was captured.';
  } else if (SOFTWARE_RENDERER_PATTERN.test(joined)) {
    classification = 'software';
    reason = 'Renderer identity matches a software rasterizer.';
  } else {
    const specificRenderer = [evidence.unmaskedRenderer, evidence.renderer]
      .find(value => typeof value === 'string'
        && value.trim().length > 0
        && !GENERIC_RENDERER_PATTERN.test(value.trim()));
    if (specificRenderer) {
      classification = 'hardware';
      reason = 'A specific non-software WebGL renderer identity was captured.';
    }
  }

  return {
    classification,
    hardwarePerformanceAvailable: classification === 'hardware',
    reason,
    contextAvailable: evidence.contextAvailable === true,
    contextType: typeof evidence.contextType === 'string' ? evidence.contextType : null,
    renderer: typeof evidence.renderer === 'string' ? evidence.renderer : null,
    vendor: typeof evidence.vendor === 'string' ? evidence.vendor : null,
    unmaskedRenderer: typeof evidence.unmaskedRenderer === 'string' ? evidence.unmaskedRenderer : null,
    unmaskedVendor: typeof evidence.unmaskedVendor === 'string' ? evidence.unmaskedVendor : null,
    debugRendererInfoAvailable: evidence.debugRendererInfoAvailable === true,
    captureError: typeof evidence.captureError === 'string' ? evidence.captureError : null
  };
}

function evaluatePerformanceBudgets(metrics, budgets, renderer = null) {
  const definitions = {
    maxEntryLoadMs: ['entryObservedMs', '<='],
    maxSceneReadyMs: ['sceneReadyMs', '<='],
    maxBoundaryMs: ['boundaryObservedMs', '<='],
    minFps: ['fps', '>='],
    maxP95FrameTimeMs: ['p95FrameTimeMs', '<='],
    maxFrameGapMs: ['maxFrameGapMs', '<='],
    maxLongTasks: ['longTaskCount', '<='],
    maxHeapGrowthBytes: ['heapGrowthBytes', '<='],
    maxHeapBytes: ['maxHeapBytes', '<='],
    maxDrawCalls: ['maxDrawCalls', '<='],
    maxTriangles: ['maxTriangles', '<=']
  };
  const checks = [];
  for (const [budgetName, limit] of Object.entries(budgets)) {
    const definition = definitions[budgetName];
    if (!definition) continue;
    const [metricName, operator] = definition;
    const measured = metrics[metricName];
    if (
      HARDWARE_ONLY_PERFORMANCE_BUDGETS.has(budgetName)
      && renderer?.classification !== 'hardware'
    ) {
      checks.push({
        budget: budgetName,
        metric: metricName,
        limit,
        measured: null,
        diagnosticMeasured: Number.isFinite(measured) ? measured : null,
        status: 'unavailable',
        availabilityReason: `hardware-renderer-required:${renderer?.classification ?? 'unavailable'}`
      });
      continue;
    }
    if (!Number.isFinite(measured)) {
      checks.push({ budget: budgetName, metric: metricName, limit, measured: null, status: 'unavailable' });
      continue;
    }
    const passed = operator === '>=' ? measured >= limit : measured <= limit;
    checks.push({ budget: budgetName, metric: metricName, limit, measured, status: passed ? 'passed' : 'failed' });
  }
  return checks;
}

function hardwareFrameEvidenceIsBlocked(performanceFailures) {
  return performanceFailures.length > 0
    && performanceFailures.every(check => (
      check.status === 'unavailable'
      && String(check.availabilityReason ?? '').startsWith('hardware-renderer-required:')
    ));
}

async function readRuntimeSample(page) {
  return await page.evaluate(async () => {
    const bodyText = document.body?.innerText ?? '';
    const normalizeText = value => typeof value === 'string'
      ? value.replace(/\s+/g, ' ').trim()
      : '';
    const actionableText = value => normalizeText(value)
      .replace(/^(?:WORK ORDER|CURRENT OBJECTIVE)\b[\s\u00b7:|\-]*/i, '')
      .replace(/\bROUTE RECALIBRATING\s*[\u00b7:|\-]*\s*OBJECTIVE REMAINS ACTIVE\b/gi, '')
      .trim();
    const isRenderedForPlayer = element => {
      if (!(element instanceof HTMLElement) || !element.isConnected) return false;
      for (let current = element; current instanceof HTMLElement; current = current.parentElement) {
        const style = window.getComputedStyle(current);
        if (
          current.hidden
          || current.getAttribute('aria-hidden') === 'true'
          || style.display === 'none'
          || style.visibility === 'hidden'
          || style.visibility === 'collapse'
          || Number.parseFloat(style.opacity || '1') <= 0.01
        ) return false;
      }
      const rect = element.getBoundingClientRect();
      return rect.width > 0
        && rect.height > 0
        && rect.right > 0
        && rect.bottom > 0
        && rect.left < window.innerWidth
        && rect.top < window.innerHeight
        && element.getClientRects().length > 0;
    };
    const workOrderExcerpts = [];
    if (/\b(?:WORK ORDER|CURRENT OBJECTIVE)\b/i.test(bodyText) && document.body) {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!/^(?:WORK ORDER|CURRENT OBJECTIVE)$/i.test(normalizeText(node.nodeValue))) continue;
        const heading = node.parentElement;
        if (!isRenderedForPlayer(heading)) continue;
        let container = heading.closest(
          '[aria-label="Current story objective"], [aria-label*="work order" i], [data-work-order]'
        ) ?? heading;
        for (let depth = 0; depth < 3 && container && container !== document.body; depth += 1) {
          if (isRenderedForPlayer(container)) {
            const excerpt = normalizeText(container.innerText);
            if (actionableText(excerpt)) {
              workOrderExcerpts.push(excerpt.slice(0, 700));
              break;
            }
          }
          container = container.parentElement;
        }
      }
    }
    const objectiveNode = document.querySelector('[aria-label="Current story objective"]');
    const objectiveRendered = isRenderedForPlayer(objectiveNode);
    const objectiveText = objectiveRendered ? normalizeText(objectiveNode.innerText) : '';
    const objectiveContentPresent = Boolean(actionableText(objectiveText));
    const objectiveId = objectiveNode instanceof HTMLElement
      ? normalizeText(objectiveNode.dataset.objectiveId)
      : '';
    const objectiveMarkerLabel = objectiveNode instanceof HTMLElement
      ? normalizeText(objectiveNode.dataset.objectiveMarkerLabel)
      : '';
    const objectiveHealth = objectiveNode instanceof HTMLElement
      ? normalizeText(objectiveNode.dataset.objectiveHealth)
      : '';
    const markerRequirement = objectiveNode instanceof HTMLElement
      ? objectiveNode.dataset.objectiveRequiresMarker
      : undefined;
    const objectiveRequiresMarker = markerRequirement === 'true'
      ? true
      : markerRequirement === 'false' ? false : null;
    const uniqueWorkOrderExcerpts = [...new Set(workOrderExcerpts)].slice(0, 5);
    const canvas = document.querySelector('canvas');
    const sceneAv = window.__paravoxiaSceneAv ?? null;
    const systemProbe = window.__paravoxiaSystemProbe?.getSnapshot?.() ?? null;
    const voxel = window.__voxelDebug ?? null;
    const memory = performance.memory;
    const navigation = performance.getEntriesByType('navigation')[0];
    const milestoneEvidence = await (async () => {
      const sampledAt = Date.now();
      try {
        // The owned acceptance server is Vite, so this resolves to the exact
        // live progression module already used by the application. An external
        // production server may not expose source modules; that is reported as
        // unavailable evidence instead of falling back to persisted or inferred
        // receipts.
        const progression = await import('/src/game/systems/progressionSystem.ts');
        if (typeof progression.getMilestones !== 'function') {
          return {
            schema: 'paravoxia.runtimeMilestoneEvidence.v1',
            available: false,
            source: 'runtime-progression-module',
            reason: 'getMilestones-export-unavailable',
            sampledAt,
            milestones: []
          };
        }
        const milestones = progression.getMilestones();
        if (!Array.isArray(milestones) || milestones.some(value => typeof value !== 'string')) {
          return {
            schema: 'paravoxia.runtimeMilestoneEvidence.v1',
            available: false,
            source: 'runtime-progression-module',
            reason: 'runtime-milestone-snapshot-malformed',
            sampledAt,
            milestones: []
          };
        }
        return {
          schema: 'paravoxia.runtimeMilestoneEvidence.v1',
          available: true,
          source: 'runtime-progression-module',
          reason: null,
          sampledAt,
          milestones: [...new Set(milestones)].sort()
        };
      } catch (error) {
        return {
          schema: 'paravoxia.runtimeMilestoneEvidence.v1',
          available: false,
          source: 'runtime-progression-module',
          reason: error instanceof Error ? error.message : String(error),
          sampledAt,
          milestones: []
        };
      }
    })();
    return {
      sampledAt: Date.now(),
      beat: window.__storyBeat ?? null,
      environment: {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        coarsePointer: window.matchMedia('(pointer: coarse)').matches,
        qualityProfileQuery: new URL(window.location.href).searchParams.get('profile')
      },
      boundaryState: window.__paravoxiaBoundaryState ?? null,
      milestoneEvidence,
      app: window.__paravoxiaAppState ?? null,
      autopilot: window.__autopilot ?? null,
      objective: {
        id: objectiveId || null,
        markerLabel: objectiveMarkerLabel || null,
        health: objectiveHealth || null,
        requiresMarker: objectiveRequiresMarker,
        present: objectiveNode instanceof HTMLElement && objectiveNode.isConnected,
        rendered: objectiveRendered,
        visible: objectiveRendered && objectiveContentPresent,
        text: objectiveText ? objectiveText.slice(0, 1000) : null,
        workOrderRendered: uniqueWorkOrderExcerpts.length > 0,
        workOrderVisible: uniqueWorkOrderExcerpts.length > 0,
        workOrderExcerpts: uniqueWorkOrderExcerpts,
        recalibrating: bodyText.includes('ROUTE RECALIBRATING')
      },
      sceneAv: sceneAv ? {
        beat: sceneAv.beat ?? null,
        anchorId: sceneAv.anchorId ?? null,
        activatedAnchorIds: [...(sceneAv.activatedAnchorIds ?? [])],
        activationHistoryAnchorIds: [...(sceneAv.activationHistoryAnchorIds ?? [])]
      } : null,
      player: voxel?.player ? {
        position: voxel.player.position ?? null,
        velocity: voxel.player.velocity ?? null,
        grounded: voxel.player.grounded ?? null
      } : null,
      spawn: voxel?.spawn ? {
        safe: voxel.spawn.safe ?? null,
        supportVoxel: voxel.spawn.supportVoxel ?? null,
        playerExpectedSettled: voxel.spawn.playerExpectedSettled ?? null
      } : null,
      canvas: canvas instanceof HTMLCanvasElement ? {
        width: canvas.width,
        height: canvas.height,
        clientWidth: canvas.clientWidth,
        clientHeight: canvas.clientHeight
      } : null,
      webglRenderer: window.__chapterAcceptanceWebGlRenderer
        ? { ...window.__chapterAcceptanceWebGlRenderer }
        : null,
      frameProbe: window.__chapterAcceptanceProbe?.snapshot?.() ?? null,
      systemProbe,
      memory: typeof memory?.usedJSHeapSize === 'number' ? {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit
      } : null,
      navigation: navigation ? {
        responseEnd: navigation.responseEnd,
        domContentLoadedEventEnd: navigation.domContentLoadedEventEnd,
        loadEventEnd: navigation.loadEventEnd,
        duration: navigation.duration,
        transferSize: navigation.transferSize,
        decodedBodySize: navigation.decodedBodySize
      } : null,
      bootAt: window.__chapterAcceptanceBootAt ?? null,
      contextLosses: window.__chapterAcceptanceContextLosses ?? 0,
      contextCreationErrors: [...(window.__chapterAcceptanceContextCreationErrors ?? [])],
      beatHistory: [...(window.__chapterAcceptanceBeatHistory ?? [])]
    };
  });
}

async function installPageProbe(page) {
  await page.addInitScript(() => {
    window.__chapterAcceptanceBootAt = Date.now();
    window.__chapterAcceptanceContextLosses = 0;
    window.__chapterAcceptanceContextCreationErrors = [];
    window.__chapterAcceptanceBeatHistory = [];
    window.__chapterAcceptanceWebGlRenderer = {
      contextAvailable: false,
      contextType: null,
      renderer: null,
      vendor: null,
      unmaskedRenderer: null,
      unmaskedVendor: null,
      debugRendererInfoAvailable: false,
      captureError: null
    };
    try {
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      const captureRenderer = (context, contextType) => {
        const evidence = {
          contextAvailable: true,
          contextType,
          renderer: null,
          vendor: null,
          unmaskedRenderer: null,
          unmaskedVendor: null,
          debugRendererInfoAvailable: false,
          captureError: null
        };
        try {
          evidence.renderer = String(context.getParameter(context.RENDERER) ?? '') || null;
          evidence.vendor = String(context.getParameter(context.VENDOR) ?? '') || null;
          const debugInfo = context.getExtension('WEBGL_debug_renderer_info');
          evidence.debugRendererInfoAvailable = Boolean(debugInfo);
          if (debugInfo) {
            evidence.unmaskedRenderer = String(
              context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) ?? ''
            ) || null;
            evidence.unmaskedVendor = String(
              context.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) ?? ''
            ) || null;
          }
        } catch (error) {
          evidence.captureError = error instanceof Error ? error.message : String(error);
        }
        window.__chapterAcceptanceWebGlRenderer = evidence;
      };
      const patchedGetContext = function patchedGetContext(contextType, ...args) {
        const context = Reflect.apply(originalGetContext, this, [contextType, ...args]);
        const normalizedType = String(contextType ?? '').toLowerCase();
        if (context && ['webgl', 'webgl2', 'experimental-webgl'].includes(normalizedType)) {
          captureRenderer(context, normalizedType);
        }
        return context;
      };
      Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
        configurable: true,
        writable: true,
        value: patchedGetContext
      });
    } catch (error) {
      window.__chapterAcceptanceWebGlRenderer.captureError = error instanceof Error
        ? error.message
        : String(error);
    }
    let storyBeatValue;
    Object.defineProperty(window, '__storyBeat', {
      configurable: true,
      enumerable: true,
      get: () => storyBeatValue,
      set: value => {
        storyBeatValue = value;
        const history = window.__chapterAcceptanceBeatHistory;
        if (history.at(-1)?.beat !== value) history.push({ at: Date.now(), beat: value ?? null });
      }
    });
    window.addEventListener('webglcontextlost', () => {
      window.__chapterAcceptanceContextLosses += 1;
    }, true);
    window.addEventListener('webglcontextcreationerror', event => {
      window.__chapterAcceptanceContextCreationErrors.push({
        at: Date.now(),
        statusMessage: typeof event.statusMessage === 'string' ? event.statusMessage : null
      });
    }, true);

    let startedAt = performance.now();
    let previousAt = 0;
    let frameGaps = [];
    let longTaskCount = 0;
    let maxLongTaskMs = 0;
    let exclusionDepth = 0;
    let exclusionStartedAt = null;
    let excludedDurationMs = 0;
    let excludedIntervals = [];
    const reset = () => {
      startedAt = performance.now();
      previousAt = 0;
      frameGaps = [];
      longTaskCount = 0;
      maxLongTaskMs = 0;
      exclusionDepth = 0;
      exclusionStartedAt = null;
      excludedDurationMs = 0;
      excludedIntervals = [];
    };
    const beginExclusion = (reason = 'external-capture') => {
      if (exclusionDepth === 0) {
        exclusionStartedAt = performance.now();
        previousAt = 0;
        excludedIntervals.push({ start: exclusionStartedAt, end: null, reason: String(reason) });
      }
      exclusionDepth += 1;
    };
    const endExclusion = () => {
      if (exclusionDepth === 0) return;
      exclusionDepth -= 1;
      if (exclusionDepth > 0) return;
      const endedAt = performance.now();
      if (exclusionStartedAt != null) {
        excludedDurationMs += Math.max(0, endedAt - exclusionStartedAt);
        const activeInterval = excludedIntervals.at(-1);
        if (activeInterval?.end == null) activeInterval.end = endedAt;
      }
      exclusionStartedAt = null;
      previousAt = 0;
    };
    const overlapsExclusion = (start, end) => {
      return excludedIntervals.some(interval => {
        const intervalEnd = interval.end ?? performance.now();
        return start <= intervalEnd && end >= interval.start;
      });
    };
    const percentile = (values, ratio) => {
      if (values.length === 0) return null;
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
    };
    const snapshot = () => {
      const now = performance.now();
      const activeExclusionMs = exclusionStartedAt == null ? 0 : Math.max(0, now - exclusionStartedAt);
      const wallDurationMs = Math.max(1, now - startedAt);
      const durationMs = Math.max(1, wallDurationMs - excludedDurationMs - activeExclusionMs);
      const maxFrameGapMs = frameGaps.length > 0 ? Math.max(...frameGaps) : null;
      return {
        durationMs,
        wallDurationMs,
        excludedDurationMs: excludedDurationMs + activeExclusionMs,
        exclusionCount: excludedIntervals.length,
        frames: frameGaps.length,
        fps: frameGaps.length * 1000 / durationMs,
        p50FrameTimeMs: percentile(frameGaps, 0.5),
        p95FrameTimeMs: percentile(frameGaps, 0.95),
        p99FrameTimeMs: percentile(frameGaps, 0.99),
        maxFrameGapMs,
        longFrameCount: frameGaps.filter(gap => gap >= 50).length,
        longTaskCount,
        maxLongTaskMs
      };
    };
    window.__chapterAcceptanceProbe = { reset, snapshot, beginExclusion, endExclusion };
    const tick = now => {
      if (exclusionDepth > 0) {
        previousAt = 0;
        requestAnimationFrame(tick);
        return;
      }
      if (previousAt > 0) {
        frameGaps.push(now - previousAt);
        if (frameGaps.length > 60_000) frameGaps.splice(0, 10_000);
      }
      previousAt = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        const observer = new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            if (overlapsExclusion(entry.startTime, entry.startTime + entry.duration)) continue;
            longTaskCount += 1;
            maxLongTaskMs = Math.max(maxLongTaskMs, entry.duration);
          }
        });
        observer.observe({ entryTypes: ['longtask'] });
      } catch { /* Long Task API is optional. */ }
    }
  });
}

async function captureScreenshot(page, runDir, label, screenshots, captureFailures) {
  const filePath = path.join(runDir, `${safeSlug(label)}.png`);
  const captureStartedAt = Date.now();
  const probeExclusionStarted = await page.evaluate(captureLabel => {
    const probe = window.__chapterAcceptanceProbe;
    if (typeof probe?.beginExclusion !== 'function') return false;
    probe.beginExclusion(`screenshot:${captureLabel}`);
    return true;
  }, label).catch(() => false);
  let captureError = null;
  try {
    await page.screenshot({ path: filePath, timeout: 30_000, animations: 'disabled' });
  } catch (error) {
    captureError = error instanceof Error ? error.message : String(error);
  } finally {
    if (probeExclusionStarted) {
      await page.evaluate(() => {
        window.__chapterAcceptanceProbe?.endExclusion?.();
      }).catch(() => undefined);
    }
  }
  const captureDurationMs = Date.now() - captureStartedAt;
  if (captureError) {
    captureFailures.push({
      label,
      error: captureError,
      captureDurationMs,
      probeMetricsExcluded: probeExclusionStarted
    });
    return null;
  }
  const entry = {
    label,
    path: asRepoRelative(filePath),
    sha256: sha256File(filePath),
    bytes: statSync(filePath).size,
    captureDurationMs,
    probeMetricsExcluded: probeExclusionStarted
  };
  screenshots.push(entry);
  return entry;
}

function runtimeUrl(baseUrl, chapter, options, variant = null) {
  const url = new URL(baseUrl);
  url.searchParams.set('story', chapter.entryBeat);
  url.searchParams.set('movie', '1');
  url.searchParams.set('systemprobe', '1');
  url.searchParams.set('bench', '1');
  if (variant?.qualityProfile ?? options.profile) {
    url.searchParams.set('profile', variant?.qualityProfile ?? options.profile);
  }
  return url.toString();
}

function createPredecessorBoundaryChapter(predecessor, chapter) {
  return {
    id: `${predecessor.id}->${chapter.id}`,
    title: `${predecessor.title} to ${chapter.title} continuity`,
    entryBeat: predecessor.exitBeat,
    exitBeat: predecessor.exitBeat,
    targetBeats: [chapter.entryBeat],
    completionMode: 'reach-target',
    beats: [predecessor.exitBeat],
    budgets: {},
    minimumColdRuns: 1,
    maxSeconds: Math.max(predecessor.maxSeconds ?? 0, chapter.maxSeconds ?? 0) || null,
    stallSeconds: Math.max(predecessor.stallSeconds ?? 0, chapter.stallSeconds ?? 0) || null,
    objectiveRequired: false,
    requiredObjectiveBeats: [],
    // The probe stops on the first sample of the target entry beat. Require
    // the predecessor's handoff receipts here, but leave the target chapter's
    // entry anchors to that chapter's own cold run: those anchors may describe
    // physical work performed after entry and cannot exist at the boundary.
    requiredAnchorIds: [...new Set(predecessor.exitAnchorIds)],
    entryAnchorIds: predecessor.exitAnchorIds,
    exitAnchorIds: [],
    screenshotsRequired: predecessor.screenshotsRequired || chapter.screenshotsRequired,
    allowedConsolePatterns: [...new Set([
      ...predecessor.allowedConsolePatterns,
      ...chapter.allowedConsolePatterns
    ])],
    allowedNetworkPatterns: [...new Set([
      ...predecessor.allowedNetworkPatterns,
      ...chapter.allowedNetworkPatterns
    ])],
    preflightTests: [],
    requiredEvidence: [],
    evidenceRequirements: {
      entryRequirements: [],
      // Re-observe the target chapter's declared prerequisites at the actual
      // predecessor handoff. Registry adjacency alone is a static promise; the
      // live boundary still has to carry the corresponding receipts/state.
      exitGuarantees: chapter.evidenceRequirements.entryRequirements ?? [],
      entryStateRefs: predecessor.evidenceRequirements.exitStateRefs ?? [],
      exitStateRefs: chapter.evidenceRequirements.entryStateRefs ?? [],
      checkpointEvidence: [],
      checkpointEvidenceRefs: []
    },
    requiresSafeSpawn: predecessor.requiresSafeSpawn || chapter.requiresSafeSpawn,
    raw: {}
  };
}

async function runColdBrowserCase({
  chromium,
  executablePath,
  baseUrl,
  chapter,
  options,
  index,
  outputDir,
  runLabel = null,
  runKind = 'chapter-cold-run',
  variant = null,
  readinessEntryBeats = new Map()
}) {
  const effectiveRunLabel = runLabel ?? `cold-run-${String(index).padStart(2, '0')}`;
  const runDir = path.join(outputDir, effectiveRunLabel);
  mkdirSync(runDir, { recursive: true });
  const startedWall = Date.now();
  const beatTrace = [];
  const objectiveTrace = [];
  const consoleEvents = [];
  const pageErrors = [];
  const networkFailures = [];
  const screenshots = [];
  const captureFailures = [];
  const requiredAnchorIdsSeen = new Set();
  const maxClockByBeat = new Map();
  let browser = null;
  let context = null;
  let page = null;
  let sampleCount = 0;
  let entryObserved = false;
  let boundaryReached = false;
  let boundaryReason = null;
  let entryObservedMs = null;
  let sceneReadyMs = null;
  let boundaryObservedMs = null;
  let previousBeat = null;
  let lastObjectiveSignature = null;
  let lastProgressSignature = null;
  let lastProgressWall = Date.now();
  let firstBootAt = null;
  let reloaded = false;
  let crashed = false;
  let stalled = false;
  let timedOut = false;
  let maxTeleportNudges = 0;
  let maxDryWaterFrames = 0;
  let autopilotTelemetryObserved = false;
  let spawnSafetyAvailable = false;
  let safeSpawnObserved = false;
  let unsafeSpawnObserved = false;
  let startHeapBytes = null;
  let maxHeapBytes = null;
  let finalSample = null;
  let entrySample = null;
  let fatalError = null;

  const maxSeconds = options.maxSeconds ?? chapter.maxSeconds ?? DEFAULT_MAX_SECONDS;
  const stallSeconds = options.stallSeconds ?? chapter.stallSeconds ?? DEFAULT_STALL_SECONDS;
  const url = runtimeUrl(baseUrl, chapter, options, variant);

  try {
    browser = await chromium.launch({
      executablePath,
      headless: !options.headed,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--ignore-gpu-blocklist',
        '--enable-webgl',
        '--touch-events=enabled',
        '--enable-precise-memory-info',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        ...(!options.headed ? ['--enable-unsafe-swiftshader', '--use-gl=angle'] : [])
      ]
    });
    const viewport = variant?.viewport ?? options.viewport;
    context = await browser.newContext({
      viewport,
      reducedMotion: variant?.reducedMotion ? 'reduce' : 'no-preference',
      isMobile: variant?.deviceClass === 'mobile',
      hasTouch: variant?.deviceClass === 'mobile'
    });
    page = await context.newPage();
    page.on('console', message => {
      consoleEvents.push({
        atMs: Date.now() - startedWall,
        type: message.type(),
        text: message.text(),
        location: message.location()
      });
    });
    page.on('pageerror', error => {
      pageErrors.push({ atMs: Date.now() - startedWall, message: error.message, stack: error.stack ?? null });
    });
    page.on('crash', () => { crashed = true; });
    page.on('requestfailed', request => {
      networkFailures.push({
        atMs: Date.now() - startedWall,
        kind: 'requestfailed',
        method: request.method(),
        url: request.url(),
        detail: request.failure()?.errorText ?? null
      });
    });
    page.on('response', response => {
      if (response.status() >= 400) {
        networkFailures.push({
          atMs: Date.now() - startedWall,
          kind: 'http',
          method: response.request().method(),
          url: response.url(),
          status: response.status()
        });
      }
    });
    await installPageProbe(page);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    while ((Date.now() - startedWall) / 1000 < maxSeconds) {
      if (crashed) break;
      let sample;
      try {
        sample = await readRuntimeSample(page);
      } catch (error) {
        fatalError = `Runtime sample failed: ${error instanceof Error ? error.message : String(error)}`;
        break;
      }
      sampleCount += 1;
      finalSample = sample;
      const elapsedMs = Date.now() - startedWall;
      if (firstBootAt == null) firstBootAt = sample.bootAt;
      else if (sample.bootAt !== firstBootAt) reloaded = true;

      if (sample.memory?.usedJSHeapSize != null) {
        if (startHeapBytes == null && entryObserved) startHeapBytes = sample.memory.usedJSHeapSize;
        maxHeapBytes = Math.max(maxHeapBytes ?? 0, sample.memory.usedJSHeapSize);
      }
      const autopilot = sample.autopilot ?? {};
      if (sample.autopilot) autopilotTelemetryObserved = true;
      if (typeof sample.spawn?.safe === 'boolean') {
        spawnSafetyAvailable = true;
        if (sample.spawn.safe) safeSpawnObserved = true;
        else unsafeSpawnObserved = true;
      }
      maxTeleportNudges = Math.max(maxTeleportNudges, Number(autopilot.teleportNudgesTotal ?? 0));
      maxDryWaterFrames = Math.max(
        maxDryWaterFrames,
        Number(autopilot.dryCrossFaceWaterContactFramesTotal ?? 0)
      );
      if (sample.beat && Number.isFinite(Number(autopilot.clock))) {
        maxClockByBeat.set(sample.beat, Math.max(maxClockByBeat.get(sample.beat) ?? 0, Number(autopilot.clock)));
      }
      recordSignedAvAnchors(sample, requiredAnchorIdsSeen);

      if (sample.beat !== previousBeat) {
        beatTrace.push({
          atMs: elapsedMs,
          from: previousBeat,
          to: sample.beat,
          objective: sample.objective,
          anchorId: sample.sceneAv?.anchorId ?? null,
          autopilot: {
            clock: autopilot.clock ?? null,
            pos: autopilot.pos ?? null,
            goal: autopilot.goal ?? null,
            routeAction: autopilot.routeAction ?? null,
            routeOutcome: autopilot.routeOutcome ?? null,
            teleportNudgesTotal: autopilot.teleportNudgesTotal ?? 0,
            dryCrossFaceWaterContactFramesTotal: autopilot.dryCrossFaceWaterContactFramesTotal ?? 0
          }
        });
        if (entryObserved && options.screenshotMode === 'beats') {
          await captureScreenshot(
            page,
            runDir,
            `beat-${String(beatTrace.length).padStart(2, '0')}-${sample.beat ?? 'null'}`,
            screenshots,
            captureFailures
          );
        }
      }

      // Deliberately omit the beat from the signature. An unchanged objective
      // id that survives a beat transition is stale evidence, not a newly
      // observed objective owned by the destination beat.
      const objectiveSignature = JSON.stringify(sample.objective);
      if (objectiveSignature !== lastObjectiveSignature) {
        objectiveTrace.push({ atMs: elapsedMs, beat: sample.beat, ...sample.objective });
        lastObjectiveSignature = objectiveSignature;
      }

      if (!entryObserved && sample.beat === chapter.entryBeat) {
        entryObserved = true;
        entrySample = {
          ...sample,
          entryEvidenceTiming: {
            firstEntrySampledAt: sample.sampledAt,
            milestoneSampledAt: sample.milestoneEvidence?.sampledAt ?? sample.sampledAt,
            boundaryStateSampledAt: sample.boundaryState?.verified === true
              ? sample.boundaryState.sampledAt ?? sample.sampledAt
              : null
          }
        };
        entryObservedMs = elapsedMs;
        startHeapBytes = sample.memory?.usedJSHeapSize ?? null;
        await page.evaluate(() => window.__chapterAcceptanceProbe?.reset?.()).catch(() => undefined);
      }
      if (
        entryObserved
        && sample.beat === chapter.entryBeat
        && entrySample
        && entrySample.boundaryState?.verified !== true
        && sample.boundaryState?.verified === true
      ) {
        // Entry milestones are frozen from the first observed entry sample so
        // chapter work cannot retroactively satisfy a prerequisite. Boundary
        // state may publish a frame later, so merge only that later verified
        // state snapshot into the entry evidence.
        entrySample = {
          ...entrySample,
          boundaryState: sample.boundaryState,
          entryEvidenceTiming: {
            ...entrySample.entryEvidenceTiming,
            boundaryStateSampledAt: sample.boundaryState.sampledAt ?? sample.sampledAt
          }
        };
      }
      if (sceneReadyMs == null && sample.app?.sceneReady === true) sceneReadyMs = elapsedMs;
      if (
        entryObserved
        && sample.beat === chapter.entryBeat
        && sample.app?.sceneReady === true
        && options.screenshotMode !== 'none'
        && !screenshots.some(entry => entry.label === 'entry')
      ) {
        await captureScreenshot(page, runDir, 'entry', screenshots, captureFailures);
      }

      const boundary = evaluateChapterBoundary(chapter, previousBeat, sample.beat);
      if (entryObserved && boundary.reached) {
        boundaryReached = true;
        boundaryReason = boundary.reason;
        boundaryObservedMs = elapsedMs;
        if (options.screenshotMode !== 'none') {
          await captureScreenshot(page, runDir, 'boundary', screenshots, captureFailures);
        }
        // The story transition, signed handback, React debug bridge, and the
        // runner's sample do not share one scheduler. In particular, a target
        // beat can become visible on the same frame that the outgoing signed
        // handback publishes, while a slow screenshot preserves the stale
        // pre-handback sample. Re-read boundedly after the first boundary and
        // stop as soon as every required anchor has reached activation history.
        // This never drives input, rescues progress, or changes the boundary;
        // it only lets already-committed evidence cross the debug bridge.
        const settleMs = Math.min(
          BOUNDARY_EVIDENCE_SETTLE_MAX_MS,
          Math.max(2_000, options.sampleMs * 6)
        );
        const settleDeadline = Date.now() + settleMs;
        do {
          try {
            const settledSample = await readRuntimeSample(page);
            sampleCount += 1;
            finalSample = settledSample;
            recordSignedAvAnchors(settledSample, requiredAnchorIdsSeen);
          } catch (error) {
            fatalError = `Boundary evidence settle failed: ${error instanceof Error ? error.message : String(error)}`;
            break;
          }
          if (requiredSignedAvAnchorsSeen(chapter, requiredAnchorIdsSeen)) break;
          const remainingMs = settleDeadline - Date.now();
          if (remainingMs <= 0) break;
          await new Promise(resolve => setTimeout(
            resolve,
            Math.min(options.sampleMs, remainingMs)
          ));
        } while (Date.now() < settleDeadline);
        break;
      }

      const progressSignature = JSON.stringify({
        beat: sample.beat,
        player: quantizedTuple(autopilot.pos ?? sample.player?.position, 0.5),
        goal: quantizedTuple(autopilot.goal, 0.5),
        route: autopilot.routeOutcome ?? null,
        objective: sample.objective ? {
          id: sample.objective.id ?? null,
          health: sample.objective.health ?? null,
          text: sample.objective.text ?? sample.objective.workOrderExcerpts ?? null
        } : null,
        anchor: sample.sceneAv?.anchorId ?? null,
        sceneReady: sample.app?.sceneReady ?? null
      });
      if (progressSignature !== lastProgressSignature) {
        lastProgressSignature = progressSignature;
        lastProgressWall = Date.now();
      } else if ((Date.now() - lastProgressWall) / 1000 >= stallSeconds) {
        stalled = true;
        break;
      }
      previousBeat = sample.beat;
      await new Promise(resolve => setTimeout(resolve, options.sampleMs));
    }
    timedOut = !boundaryReached && !stalled && !crashed && !fatalError
      && (Date.now() - startedWall) / 1000 >= maxSeconds;
    if (!boundaryReached && options.screenshotMode !== 'none' && page && !page.isClosed()) {
      await captureScreenshot(page, runDir, 'failure', screenshots, captureFailures);
    }
  } catch (error) {
    fatalError = error instanceof Error ? error.stack ?? error.message : String(error);
  } finally {
    if (context) await context.close().catch(() => undefined);
    if (browser) await browser.close().catch(() => undefined);
  }

  const elapsedMs = Date.now() - startedWall;
  const unexpectedConsoleErrors = consoleEvents.filter(event => (
    event.type === 'error'
    && !matchesAllowed(event.text, chapter.allowedConsolePatterns)
  ));
  const unexpectedGraphicsDiagnostics = consoleEvents.filter(event => (
    isUnexpectedGraphicsDiagnostic(event, chapter.allowedConsolePatterns)
  ));
  const unexpectedNetworkFailures = networkFailures.filter(event => (
    !matchesAllowed(`${event.url} ${event.detail ?? ''} ${event.status ?? ''}`, chapter.allowedNetworkPatterns)
  ));
  const timeoutRescues = [...maxClockByBeat.entries()]
    .map(([beat, maxClock]) => ({
      beat,
      maxClock,
      timeoutSeconds: Number(chapter.raw?.beatTimeouts?.[beat] ?? LEGACY_RESCUE_TIMEOUT_SECONDS[beat])
    }))
    .filter(entry => Number.isFinite(entry.timeoutSeconds) && entry.maxClock >= entry.timeoutSeconds - 0.15);
  const observedBeatSequence = (finalSample?.beatHistory ?? [])
    .map(entry => entry?.beat)
    .filter(beat => typeof beat === 'string');
  const beatCoverage = orderedBeatCoverage(chapter.beats, observedBeatSequence);
  const missingAnchorIds = chapter.requiredAnchorIds.filter(id => !requiredAnchorIdsSeen.has(id));
  const objectiveBeatsObserved = objectiveEvidenceBeats(objectiveTrace);
  const missingObjectiveBeats = chapter.requiredObjectiveBeats.filter(beat => !objectiveBeatsObserved.has(beat));
  const objectiveObserved = objectiveTrace.some(entry => objectiveEvidenceIdentity(entry) !== null);
  const frameProbe = finalSample?.frameProbe ?? null;
  const systemProbe = summarizeSystemProbe(finalSample?.systemProbe);
  const graphicsRenderer = classifyWebGlRenderer(finalSample?.webglRenderer);
  const frameMetrics = summarizeRunnerFrameProbe(frameProbe);
  const endHeapBytes = finalSample?.memory?.usedJSHeapSize ?? null;
  const metrics = {
    entryObservedMs,
    sceneReadyMs,
    boundaryObservedMs,
    elapsedMs,
    ...frameMetrics,
    startHeapBytes,
    endHeapBytes,
    maxHeapBytes: Math.max(maxHeapBytes ?? 0, systemProbe?.maxUsedJsHeapBytes ?? 0) || null,
    heapGrowthBytes: startHeapBytes != null && endHeapBytes != null ? endHeapBytes - startHeapBytes : null,
    maxDrawCalls: systemProbe?.maxDrawCalls ?? null,
    maxTriangles: systemProbe?.maxTriangles ?? null,
    navigation: finalSample?.navigation ?? null,
    systemProbe
  };
  const budgetChecks = evaluatePerformanceBudgets(metrics, chapter.budgets, graphicsRenderer);
  const performanceFailures = budgetChecks.filter(check => check.status !== 'passed');
  const hardwareFrameEvidenceBlocked = hardwareFrameEvidenceIsBlocked(performanceFailures);
  const evidenceFailures = [];
  const registeredEvidence = evaluateChapterRegisteredEvidence(
    chapter,
    entrySample,
    finalSample,
    readinessEntryBeats
  );
  const registeredEvidenceIssues = registeredEvidenceFailureReasons(registeredEvidence);
  const registeredEvidenceFormalRequired = !options.smoke && !options.debug;
  if (registeredEvidenceFormalRequired) evidenceFailures.push(...registeredEvidenceIssues);
  const expectedViewport = variant?.viewport ?? options.viewport;
  const variantEnvironmentPassed = Boolean(
    finalSample?.environment
    && finalSample.environment.viewport?.width === expectedViewport.width
    && finalSample.environment.viewport?.height === expectedViewport.height
    && finalSample.environment.reducedMotion === Boolean(variant?.reducedMotion)
    && finalSample.environment.qualityProfileQuery === (variant?.qualityProfile ?? options.profile ?? null)
    && finalSample.environment.coarsePointer === (variant?.deviceClass === 'mobile')
  );
  const expectedBoundaryStateRefs = chapter.evidenceRequirements.exitStateRefs ?? [];
  const observedBoundaryStateRefs = Array.isArray(finalSample?.boundaryState?.stateRefs)
    ? finalSample.boundaryState.stateRefs.filter(ref => typeof ref === 'string')
    : [];
  const missingBoundaryStateRefs = expectedBoundaryStateRefs.filter(ref => !observedBoundaryStateRefs.includes(ref));
  const boundaryStateComplete = expectedBoundaryStateRefs.length > 0
    && finalSample?.boundaryState?.verified === true
    && missingBoundaryStateRefs.length === 0;
  if (!entryObserved) evidenceFailures.push(`Entry beat ${chapter.entryBeat} was not observed.`);
  if (!variantEnvironmentPassed) {
    evidenceFailures.push('Browser viewport, reduced-motion preference, or quality profile did not match the selected variant.');
  }
  if (!boundaryStateComplete) {
    evidenceFailures.push(
      `Boundary state telemetry did not verify exit state refs: ${missingBoundaryStateRefs.join(', ') || 'verified snapshot unavailable'}.`
    );
  }
  if (!boundaryReached) evidenceFailures.push(`Chapter boundary was not reached (${chapter.targetBeats.join(', ') || chapter.exitBeat}).`);
  if (!beatCoverage.complete) {
    evidenceFailures.push(`Registered beat sequence was incomplete or out of order from ${beatCoverage.missingFrom[0] ?? 'unknown'}.`);
  }
  if (finalSample?.app?.sceneReady !== true) evidenceFailures.push('Boundary did not finish with sceneReady=true.');
  if (!finalSample?.canvas || finalSample.canvas.width <= 0 || finalSample.canvas.height <= 0) {
    evidenceFailures.push('Boundary did not expose a nonzero game canvas.');
  }
  if (chapter.id !== 'prologue' && !autopilotTelemetryObserved) {
    evidenceFailures.push('Movie-mode autopilot telemetry was never observed.');
  }
  if (unsafeSpawnObserved) evidenceFailures.push('Spawn safety telemetry reported an unsafe spawn.');
  if (chapter.requiresSafeSpawn && !spawnSafetyAvailable) {
    evidenceFailures.push('Required on-foot spawn safety telemetry was unavailable.');
  }
  if (reloaded) evidenceFailures.push('Page boot marker changed during the run.');
  if (crashed) evidenceFailures.push('Browser page crashed.');
  if ((finalSample?.contextLosses ?? 0) > 0) evidenceFailures.push('WebGL context loss was observed.');
  if ((finalSample?.contextCreationErrors?.length ?? 0) > 0) {
    evidenceFailures.push('WebGL context creation error was observed.');
  }
  if (maxTeleportNudges > 0) evidenceFailures.push(`Movie teleport rescue count was ${maxTeleportNudges}.`);
  if (maxDryWaterFrames > 0) evidenceFailures.push(`Dry-route water contact was observed for ${maxDryWaterFrames} frames.`);
  if (timeoutRescues.length > 0) evidenceFailures.push(`Suspected timeout rescues: ${timeoutRescues.map(item => item.beat).join(', ')}.`);
  if (unexpectedConsoleErrors.length > 0) evidenceFailures.push(`${unexpectedConsoleErrors.length} unexpected console error(s).`);
  if (unexpectedGraphicsDiagnostics.length > 0) {
    evidenceFailures.push(`${unexpectedGraphicsDiagnostics.length} unexpected WebGL/graphics diagnostic(s).`);
  }
  if (pageErrors.length > 0) evidenceFailures.push(`${pageErrors.length} page error(s).`);
  if (unexpectedNetworkFailures.length > 0) evidenceFailures.push(`${unexpectedNetworkFailures.length} network failure(s).`);
  if (chapter.objectiveRequired && !objectiveObserved) evidenceFailures.push('Required objective/work-order UI was never observed.');
  if (missingObjectiveBeats.length > 0) evidenceFailures.push(`Objective/work-order missing on: ${missingObjectiveBeats.join(', ')}.`);
  if (missingAnchorIds.length > 0) evidenceFailures.push(`Required signed AV anchors missing: ${missingAnchorIds.join(', ')}.`);
  if (chapter.screenshotsRequired && options.screenshotMode !== 'none') {
    if (!screenshots.some(entry => entry.label === 'entry')) evidenceFailures.push('Entry screenshot is missing.');
    if (!screenshots.some(entry => entry.label === 'boundary')) evidenceFailures.push('Boundary screenshot is missing.');
  }
  if (performanceFailures.length > 0) {
    evidenceFailures.push(
      `Performance budgets failed or were unavailable: ${performanceFailures.map(item => `${item.budget}:${item.status}`).join(', ')}.`
    );
  }
  if (fatalError) evidenceFailures.push(fatalError);
  if (stalled) evidenceFailures.push(`No meaningful progress for ${stallSeconds}s.`);
  if (timedOut) evidenceFailures.push(`Run exceeded ${maxSeconds}s.`);

  const status = sampleCount === 0 && fatalError
    ? 'blocked'
    : registeredEvidenceFormalRequired && registeredEvidence.status === 'blocked'
      ? 'blocked'
      : hardwareFrameEvidenceBlocked && evidenceFailures.length === 1
        ? 'blocked'
        : evidenceFailures.length === 0 ? 'passed' : 'failed';
  const runReport = {
    run: index,
    kind: runKind,
    variant: variant ? {
      id: variant.id,
      qualityProfile: variant.qualityProfile,
      deviceClass: variant.deviceClass,
      viewport: variant.viewport,
      reducedMotion: variant.reducedMotion
    } : {
      id: `debug-${String(options.profile ?? 'default').toLowerCase()}`,
      qualityProfile: options.profile,
      deviceClass: 'desktop',
      viewport: options.viewport,
      reducedMotion: false
    },
    variantEnvironment: {
      expected: {
        viewport: expectedViewport,
        reducedMotion: Boolean(variant?.reducedMotion),
        qualityProfileQuery: variant?.qualityProfile ?? options.profile ?? null,
        deviceClass: variant?.deviceClass ?? 'desktop'
      },
      observed: finalSample?.environment ?? null,
      passed: variantEnvironmentPassed
    },
    status,
    url,
    coldIsolation: {
      freshBrowserProcess: true,
      freshBrowserContext: true,
      freshStorage: true,
      transformWarmup: false
    },
    limits: { maxSeconds, stallSeconds, sampleMs: options.sampleMs },
    boundary: {
      entryBeat: chapter.entryBeat,
      targetBeats: chapter.targetBeats,
      exitBeat: chapter.exitBeat,
      completionMode: chapter.completionMode,
      entryObserved,
      reached: boundaryReached,
      reason: boundaryReason,
      finalBeat: finalSample?.beat ?? null
    },
    timings: metrics,
    flow: {
      beatTrace,
      observedBeatSequence,
      beatCoverage,
      timeoutRescues,
      teleportNudges: maxTeleportNudges,
      dryCrossFaceWaterContactFrames: maxDryWaterFrames,
      reloaded,
      contextLosses: finalSample?.contextLosses ?? 0,
      contextCreationErrors: finalSample?.contextCreationErrors ?? [],
      stalled,
      timedOut
    },
    spawnSafety: {
      required: chapter.requiresSafeSpawn,
      available: spawnSafetyAvailable,
      safeObserved: safeSpawnObserved,
      unsafeObserved: unsafeSpawnObserved
    },
    telemetry: {
      autopilotObserved: autopilotTelemetryObserved,
      graphicsRenderer,
      sceneReadyAtBoundary: finalSample?.app?.sceneReady === true,
      nonzeroCanvasAtBoundary: Boolean(
        finalSample?.canvas
        && finalSample.canvas.width > 0
        && finalSample.canvas.height > 0
      )
    },
    boundaryStateEvidence: {
      schema: finalSample?.boundaryState?.schema ?? null,
      sampledAt: finalSample?.boundaryState?.sampledAt ?? null,
      expectedExitStateRefs: expectedBoundaryStateRefs,
      observedStateRefs: observedBoundaryStateRefs,
      missingStateRefs: missingBoundaryStateRefs,
      verifiedByRuntime: finalSample?.boundaryState?.verified === true,
      complete: boundaryStateComplete,
      runtime: finalSample?.boundaryState?.runtime ?? null
    },
    registeredEvidence: {
      ...registeredEvidence,
      mode: registeredEvidenceFormalRequired
        ? 'formal-required'
        : 'diagnostic-noncertifying',
      wouldBlockFormalAcceptance: !registeredEvidence.complete,
      issueReasons: registeredEvidenceIssues
    },
    objectiveEvidence: {
      observed: objectiveObserved,
      trace: objectiveTrace,
      observedBeats: [...objectiveBeatsObserved],
      requiredBeats: chapter.requiredObjectiveBeats,
      missingRequiredBeats: missingObjectiveBeats,
      ownershipRule: 'a rendered actionable ready-or-markerless objective id certifies only the beat where that id first became valid'
    },
    signedAvEvidence: {
      requiredAnchorIds: chapter.requiredAnchorIds,
      observedAnchorIds: [...requiredAnchorIdsSeen].sort(),
      missingRequiredAnchorIds: missingAnchorIds
    },
    diagnostics: {
      consoleEvents,
      unexpectedConsoleErrors,
      unexpectedGraphicsDiagnostics,
      pageErrors,
      networkFailures,
      unexpectedNetworkFailures,
      crashed,
      fatalError
    },
    performanceEnvironment: {
      renderer: graphicsRenderer,
      hardwareFrameEvidenceBlocked,
      frameMetricsSource: metrics.frameMeasurement.source,
      screenshotIntervalsExcluded: metrics.frameMeasurement.screenshotIntervalsExcluded
    },
    performanceBudgetChecks: budgetChecks,
    screenshots,
    captureFailures,
    boundaryObservations: {
      entry: entrySample ? {
        beat: entrySample.beat,
        boundaryState: entrySample.boundaryState,
        milestoneEvidence: entrySample.milestoneEvidence,
        app: entrySample.app,
        objective: entrySample.objective,
        sceneAv: entrySample.sceneAv,
        player: entrySample.player,
        spawn: entrySample.spawn,
        canvas: entrySample.canvas
      } : null,
      final: finalSample ? {
        beat: finalSample.beat,
        boundaryState: finalSample.boundaryState,
        milestoneEvidence: finalSample.milestoneEvidence,
        app: finalSample.app,
        objective: finalSample.objective,
        sceneAv: finalSample.sceneAv,
        player: finalSample.player,
        spawn: finalSample.spawn,
        canvas: finalSample.canvas
      } : null
    },
    failureReasons: evidenceFailures
  };
  const tracePath = path.join(runDir, 'beat-trace.json');
  const eventsPath = path.join(runDir, 'browser-events.json');
  const runReportPath = path.join(runDir, 'run-report.json');
  writeFileSync(tracePath, `${JSON.stringify({ beatTrace, objectiveTrace }, null, 2)}\n`);
  writeFileSync(eventsPath, `${JSON.stringify({ consoleEvents, pageErrors, networkFailures }, null, 2)}\n`);
  runReport.artifacts = {
    beatTrace: asRepoRelative(tracePath),
    browserEvents: asRepoRelative(eventsPath),
    runReport: asRepoRelative(runReportPath)
  };
  writeFileSync(runReportPath, `${JSON.stringify(runReport, null, 2)}\n`);
  return runReport;
}

function runSelfTest() {
  const liveSource = sourceIdentity();
  assert.match(liveSource.candidateTreeSha256 ?? '', /^[a-f0-9]{64}$/);

  const identityRepo = mkdtempSync(path.join(os.tmpdir(), 'chapter-acceptance-identity-self-test-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: identityRepo, stdio: 'ignore' });
    mkdirSync(path.join(identityRepo, 'captures'), { recursive: true });
    mkdirSync(path.join(identityRepo, '.terra', 'workflow-runs'), { recursive: true });
    writeFileSync(path.join(identityRepo, 'source.js'), 'export const fixture = 1;\n');
    writeFileSync(path.join(identityRepo, 'captures', 'tracked-evidence.json'), '{"run":1}\n');
    writeFileSync(path.join(identityRepo, '.terra', 'workflow-runs', 'tracked-report.json'), '{"run":1}\n');
    execFileSync('git', ['add', '.'], { cwd: identityRepo, stdio: 'ignore' });
    execFileSync('git', [
      '-c', 'user.name=Chapter Acceptance Self Test',
      '-c', 'user.email=chapter-acceptance@example.invalid',
      'commit', '-qm', 'identity fixture'
    ], { cwd: identityRepo, stdio: 'ignore' });

    const explicitEvidencePath = path.join(identityRepo, 'headed-evidence.json');
    const explicitOutputPath = path.join(identityRepo, 'custom-output');
    const identityOptions = {
      repoRoot: identityRepo,
      excludedPaths: [explicitEvidencePath, explicitOutputPath]
    };
    const identityBeforeEvidence = sourceIdentity(identityOptions);
    writeFileSync(path.join(identityRepo, 'captures', 'tracked-evidence.json'), '{"run":2}\n');
    writeFileSync(path.join(identityRepo, 'captures', 'untracked-screenshot.txt'), 'pixels changed\n');
    writeFileSync(path.join(identityRepo, '.terra', 'workflow-runs', 'tracked-report.json'), '{"run":2}\n');
    writeFileSync(explicitEvidencePath, '{"verdict":"accepted"}\n');
    mkdirSync(explicitOutputPath, { recursive: true });
    writeFileSync(path.join(explicitOutputPath, 'chapter-mechanical-evidence.json'), '{"status":"complete"}\n');
    const identityAfterEvidence = sourceIdentity(identityOptions);
    assert.equal(identityAfterEvidence.candidateTreeSha256, identityBeforeEvidence.candidateTreeSha256);
    assert.equal(identityAfterEvidence.worktreeStatusSha256, identityBeforeEvidence.worktreeStatusSha256);

    writeFileSync(path.join(identityRepo, 'source.js'), 'export const fixture = 2;\n');
    const identityAfterSource = sourceIdentity(identityOptions);
    assert.notEqual(identityAfterSource.candidateTreeSha256, identityBeforeEvidence.candidateTreeSha256);
  } finally {
    rmSync(identityRepo, { recursive: true, force: true });
  }

  const parsed = parseArgs([
    '--chapter', 'ch3', '--runs=2', '--viewport', '960x540', '--base-url', 'http://localhost:7777/',
    '--profiles', 'desktop-high,mobile-potato', '--candidate-revision', 'abc123'
  ]);
  assert.equal(parsed.chapter, 'ch3');
  assert.equal(parsed.runs, 2);
  assert.deepEqual(parsed.viewport, { width: 960, height: 540 });
  assert.equal(parsed.baseUrl, 'http://localhost:7777/');
  assert.deepEqual(parsed.profiles, ['desktop-high', 'mobile-potato']);
  assert.equal(parsed.candidateRevision, 'abc123');
  assert.throws(() => parseArgs(['--chapter', 'ch3', '--skip-preflight']), /smoke or --debug/);
  assert.throws(() => parseArgs(['--chapter', 'ch3', '--skip-predecessor']), /smoke or --debug/);
  assert.throws(() => parseArgs(['--chapter', 'ch3', '--profile', 'HIGH']), /smoke or --debug/);
  assert.equal(parseArgs([
    '--chapter', 'ch3', '--smoke', '--skip-predecessor'
  ]).skipPredecessor, true);
  assert.equal(isUnexpectedGraphicsDiagnostic({
    type: 'warning',
    text: 'WebGL: INVALID_OPERATION: program used with uninitialized parameters'
  }), true);
  assert.equal(isUnexpectedGraphicsDiagnostic({
    type: 'warning',
    text: 'using deprecated parameters for the initialization function; pass a single object instead'
  }), false);
  assert.equal(isUnexpectedGraphicsDiagnostic({
    type: 'warning',
    text: 'THREE.WebGLRenderer: Error creating WebGL context.'
  }, ['Error creating WebGL context']), false);

  const settledAnchorFixture = { requiredAnchorIds: ['anc.fixture.pressure', 'anc.fixture.handback'] };
  const settledAnchorIds = new Set();
  recordSignedAvAnchors({
    sceneAv: {
      anchorId: 'anc.fixture.pressure',
      activatedAnchorIds: ['anc.fixture.pressure'],
      activationHistoryAnchorIds: ['anc.fixture.pressure']
    }
  }, settledAnchorIds);
  assert.equal(requiredSignedAvAnchorsSeen(settledAnchorFixture, settledAnchorIds), false);
  recordSignedAvAnchors({
    sceneAv: {
      anchorId: null,
      activatedAnchorIds: [],
      activationHistoryAnchorIds: ['anc.fixture.pressure', 'anc.fixture.handback']
    }
  }, settledAnchorIds);
  assert.equal(requiredSignedAvAnchorsSeen(settledAnchorFixture, settledAnchorIds), true);

  const fixtureVariants = [
    { id: 'desktop-high', qualityProfile: 'HIGH', deviceClass: 'desktop', viewport: { width: 1440, height: 900 }, reducedMotion: false },
    { id: 'desktop-medium-reduced-motion', qualityProfile: 'MEDIUM', deviceClass: 'desktop', viewport: { width: 1280, height: 720 }, reducedMotion: true },
    { id: 'desktop-low', qualityProfile: 'LOW', deviceClass: 'desktop', viewport: { width: 1024, height: 768 }, reducedMotion: false },
    { id: 'mobile-potato', qualityProfile: 'POTATO', deviceClass: 'mobile', viewport: { width: 390, height: 844 }, reducedMotion: true }
  ];
  const fixturePerformance = {
    maxEntryLoadMs: 45000,
    maxSceneReadyMs: 60000,
    maxBoundaryMs: 120000,
    minFps: 20,
    maxP95FrameTimeMs: 50,
    maxFrameGapMs: 1000,
    maxLongTasks: 50,
    maxHeapBytes: 1342177280
  };
  const fixtureAcceptance = (requiredObjectiveBeats = []) => ({
    requiredObjectiveBeats,
    requiredVariantProfiles: fixtureVariants,
    performanceBudgets: fixturePerformance,
    budgets: { minimumColdRuns: 3, minimumVariantProfiles: 4 }
  });

  const chapters = normalizeChapterRegistry({
    schema: 'fixture',
    terminalBeat: 'done',
    chapters: [
      {
        id: 'ch3',
        beats: ['ch3-gather', 'ch3-dusk'],
        targetBeat: 'ch4-vigil',
        objectiveRefs: ['runtime:src/story/storyDirector.ts#objective'],
        avBoundary: {
          entry: { anchorRefs: ['scene:fixture@v1#anchor:anc.ch3.entry'] },
          exit: { anchorRefs: ['scene:fixture@v1#anchor:anc.ch3.exit'] }
        },
        acceptance: fixtureAcceptance(['ch3-gather'])
      },
      {
        id: 'ch4',
        entryBeat: 'ch4-vigil',
        exitBeat: 'a4-exhale',
        beats: ['ch4-vigil', 'a4-exhale'],
        completionMode: 'leave-exit',
        acceptance: fixtureAcceptance(['ch4-vigil'])
      }
    ]
  });
  assert.deepEqual(chapters[0].targetBeats, ['ch4-vigil']);
  assert.equal(chapters[0].minimumColdRuns, 3);
  assert.equal(chapters[0].objectiveRequired, true);
  assert.equal(chapters[0].requiredVariantProfiles.length, 4);
  assert.equal(chapters[0].requiredVariantProfiles[3].deviceClass, 'mobile');
  assert.equal(chapters[0].requiredVariantProfiles[1].reducedMotion, true);
  assert.equal(chapters[0].budgets.minFps, 20);
  assert.deepEqual(
    selectedVariantsForRun(chapters[0], { profile: null, profiles: null, smoke: false }).map(variant => variant.id),
    ['desktop-high', 'desktop-medium-reduced-motion', 'desktop-low', 'mobile-potato']
  );
  assert.deepEqual(
    selectedVariantsForRun(chapters[0], { profile: null, profiles: null, smoke: true }).map(variant => variant.id),
    ['desktop-high']
  );
  assert.deepEqual(
    selectedVariantsForRun(chapters[0], { profile: null, profiles: ['mobile-potato'], smoke: true }).map(variant => variant.id),
    ['mobile-potato']
  );
  assert.equal(
    evaluatePerformanceBudgets({ fps: null }, { minFps: 20 })[0].status,
    'unavailable'
  );
  const softwareRenderer = classifyWebGlRenderer({
    contextAvailable: true,
    contextType: 'webgl2',
    renderer: 'WebKit WebGL',
    vendor: 'WebKit',
    unmaskedRenderer: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))',
    unmaskedVendor: 'Google Inc. (Google)'
  });
  assert.equal(softwareRenderer.classification, 'software');
  assert.equal(softwareRenderer.hardwarePerformanceAvailable, false);
  const hardwareRenderer = classifyWebGlRenderer({
    contextAvailable: true,
    contextType: 'webgl2',
    renderer: 'WebKit WebGL',
    vendor: 'WebKit',
    unmaskedRenderer: 'ANGLE (NVIDIA, NVIDIA RTX 4090 Direct3D11)',
    unmaskedVendor: 'Google Inc. (NVIDIA)'
  });
  assert.equal(hardwareRenderer.classification, 'hardware');
  assert.equal(hardwareRenderer.hardwarePerformanceAvailable, true);
  assert.equal(classifyWebGlRenderer({
    contextAvailable: true,
    renderer: 'WebKit WebGL',
    vendor: 'WebKit'
  }).classification, 'unknown');
  const softwareBudgetChecks = evaluatePerformanceBudgets(
    { fps: 3, p95FrameTimeMs: 330, longTaskCount: 80, maxHeapBytes: 512 },
    { minFps: 20, maxP95FrameTimeMs: 50, maxLongTasks: 50, maxHeapBytes: 1024 },
    softwareRenderer
  );
  assert.equal(softwareBudgetChecks[0].status, 'unavailable');
  assert.equal(softwareBudgetChecks[0].measured, null);
  assert.equal(softwareBudgetChecks[0].diagnosticMeasured, 3);
  assert.equal(softwareBudgetChecks[1].status, 'unavailable');
  assert.equal(softwareBudgetChecks[2].status, 'unavailable');
  assert.equal(softwareBudgetChecks[2].diagnosticMeasured, 80);
  assert.equal(softwareBudgetChecks[3].status, 'passed');
  assert.equal(hardwareFrameEvidenceIsBlocked(
    softwareBudgetChecks.filter(check => check.status !== 'passed')
  ), true);
  const failedHardwareBudgetChecks = evaluatePerformanceBudgets(
    { fps: 19 },
    { minFps: 20 },
    hardwareRenderer
  );
  assert.equal(failedHardwareBudgetChecks[0].status, 'failed');
  assert.equal(hardwareFrameEvidenceIsBlocked(failedHardwareBudgetChecks), false);
  const captureIsolatedFrameMetrics = summarizeRunnerFrameProbe({
    fps: 59.98765,
    p95FrameTimeMs: 18,
    maxFrameGapMs: 25,
    longTaskCount: 0,
    maxLongTaskMs: 0,
    wallDurationMs: 25_000,
    durationMs: 20_000,
    excludedDurationMs: 5_000,
    exclusionCount: 2,
    frames: 1_200
  });
  assert.equal(captureIsolatedFrameMetrics.fps, 59.988);
  assert.equal(captureIsolatedFrameMetrics.frameMeasurement.screenshotIntervalsExcluded, true);
  assert.equal(captureIsolatedFrameMetrics.frameMeasurement.excludedDurationMs, 5_000);
  assert.equal(captureIsolatedFrameMetrics.frameMeasurement.exclusionCount, 2);
  assert.equal(summarizeRunnerFrameProbe(null).p95FrameTimeMs, null);
  assert.deepEqual(chapters[0].requiredAnchorIds, ['anc.ch3.entry', 'anc.ch3.exit']);
  const predecessorFixture = createPredecessorBoundaryChapter(chapters[0], chapters[1]);
  assert.deepEqual(predecessorFixture.requiredAnchorIds, ['anc.ch3.exit']);
  assert.deepEqual(predecessorFixture.exitAnchorIds, []);
  assert.equal(evaluateChapterBoundary(chapters[0], 'ch3-dusk', 'ch4-vigil').reached, true);
  assert.equal(evaluateChapterBoundary(chapters[0], 'ch3-gather', 'ch3-dusk').reached, false);
  assert.equal(evaluateChapterBoundary(chapters[1], 'a4-exhale', 'ch5-maw').reached, true);
  assert.equal(evaluateChapterBoundary(chapters[1], 'ch4-vigil', 'a4-exhale').reached, false);
  assert.equal(orderedBeatCoverage(
    ['ch3-gather', 'ch3-dusk'],
    ['ch3-gather', 'ch3-dusk', 'ch4-vigil']
  ).complete, true);
  assert.equal(orderedBeatCoverage(
    ['ch3-gather', 'ch3-dusk'],
    ['ch3-dusk', 'ch4-vigil']
  ).complete, false);

  const readableObjective = {
    id: 'maw:recover-field-kit',
    markerLabel: 'W-7744 FIELD PACK · RECOVER KIT',
    health: 'ready',
    requiresMarker: true,
    present: true,
    rendered: true,
    visible: true,
    text: '  CURRENT OBJECTIVE\n  FIND WHAT W-7744 LOST.  ',
    workOrderRendered: false,
    workOrderVisible: false,
    workOrderExcerpts: []
  };
  const readableWorkOrder = {
    id: null,
    markerLabel: null,
    health: null,
    requiresMarker: null,
    present: false,
    rendered: false,
    visible: false,
    text: null,
    workOrderRendered: true,
    workOrderVisible: true,
    workOrderExcerpts: ['WORK ORDER · REPAIR THE INSTRUMENT.']
  };
  assert.ok(objectiveEvidenceIdentity(readableObjective));
  assert.equal(objectiveEvidenceIdentity(readableWorkOrder), null);
  assert.ok(objectiveEvidenceIdentity({
    ...readableObjective,
    id: 'maw:purpose-gap',
    health: 'missing-marker',
    requiresMarker: false
  }));
  for (const invalidObjective of [
    { ...readableObjective, rendered: false }, // hidden, transparent, zero-size, or offscreen
    { ...readableObjective, visible: false },
    { ...readableObjective, id: null },
    { ...readableObjective, markerLabel: null },
    { ...readableObjective, requiresMarker: null },
    { ...readableObjective, health: 'missing-marker' },
    { ...readableObjective, health: null },
    { ...readableObjective, text: '   ' },
    { ...readableObjective, text: 'CURRENT OBJECTIVE' },
    {
      ...readableObjective,
      text: 'CURRENT OBJECTIVE · ROUTE RECALIBRATING · OBJECTIVE REMAINS ACTIVE'
    },
    { ...readableWorkOrder, workOrderRendered: false },
    { ...readableWorkOrder, workOrderExcerpts: ['WORK ORDER'] }
  ]) assert.equal(objectiveEvidenceIdentity(invalidObjective), null);
  assert.deepEqual(
    [...objectiveEvidenceBeats([
      { atMs: 100, beat: 'ch5-maw', ...readableObjective },
      // A beat-labelled duplicate is still the same stale UI and cannot certify ch6.
      { atMs: 200, beat: 'ch6-dive', ...readableObjective },
      { atMs: 300, beat: 'ch6-dive', ...readableObjective, rendered: false, visible: false },
      // Hiding/showing the same copy does not refresh its beat ownership.
      { atMs: 400, beat: 'ch6-dive', ...readableObjective },
      {
        atMs: 500,
        beat: 'ch6-dive',
        ...readableObjective,
        id: 'dive:recover-keel-memory',
        markerLabel: 'KESTREL KEEL MEMORY · RECOVER',
        text: 'CURRENT OBJECTIVE · RECOVER THE KEEL MEMORY.'
      }
    ])],
    ['ch5-maw', 'ch6-dive']
  );
  assert.deepEqual(
    [...objectiveEvidenceBeats([
      { atMs: 100, beat: null, ...readableObjective },
      { atMs: 200, beat: 'ch5-maw', ...readableObjective }
    ])],
    []
  );
  assert.deepEqual(
    [...objectiveEvidenceBeats([
      // Readable copy with a missing required marker is diagnostic only.
      { atMs: 100, beat: 'ch5-maw', ...readableObjective, health: 'missing-marker' },
      { atMs: 200, beat: 'ch5-maw', ...readableObjective }
    ])],
    ['ch5-maw']
  );

  const passingRuns = [{ status: 'passed' }, { status: 'passed' }];
  assert.equal(computeDisposition({
    runs: passingRuns,
    requiredRuns: 2,
    preflightPassed: true
  }), 'machine-ready-for-council-review');
  assert.equal(computeDisposition({
    runs: [{ status: 'passed' }, { status: 'failed' }],
    requiredRuns: 2,
    preflightPassed: true
  }), 'repair-required');
  assert.equal(computeDisposition({
    runs: [{ status: 'blocked' }],
    requiredRuns: 1,
    preflightPassed: true
  }), 'blocked');
  assert.equal(computeDisposition({
    runs: [{ status: 'passed' }],
    requiredRuns: 3,
    preflightPassed: true
  }), 'blocked');
  assert.equal(computeDisposition({
    runs: passingRuns,
    requiredRuns: 2,
    preflightPassed: true,
    predecessorBoundaryStatus: 'failed'
  }), 'repair-required');
  assert.equal(computeDisposition({
    runs: passingRuns,
    requiredRuns: 2,
    preflightPassed: false,
    machineReadyForCouncilReview: true
  }), 'repair-required');
  assert.equal(computeDisposition({
    runs: passingRuns,
    requiredRuns: 2,
    preflightPassed: true,
    machineReadyForCouncilReview: false
  }), 'blocked');
  const standaloneDispositions = new Set([
    computeDisposition({ runs: passingRuns, requiredRuns: 2, preflightPassed: true }),
    computeDisposition({ runs: [{ status: 'failed' }], requiredRuns: 1, preflightPassed: true }),
    computeDisposition({ runs: [{ status: 'blocked' }], requiredRuns: 1, preflightPassed: true })
  ]);
  assert.deepEqual(
    [...standaloneDispositions].sort(),
    ['blocked', 'machine-ready-for-council-review', 'repair-required']
  );
  assert.equal(computeDisposition({
    runs: [{ status: 'failed' }, { status: 'passed' }],
    requiredRuns: 2,
    preflightPassed: true,
    machineReadyForCouncilReview: true
  }), 'repair-required');
  assert.equal(computeDisposition({
    runs: passingRuns,
    requiredRuns: 2,
    preflightPassed: true,
    predecessorBoundaryStatus: 'failed',
    machineReadyForCouncilReview: true
  }), 'repair-required');

  const terminalFixture = normalizeChapterRegistry({
    terminalBeat: 'done',
    chapters: [{
      id: 'ch9',
      entry: { beat: 'ch9-settle' },
      exit: { beat: 'ch9-hearth' },
      beats: ['ch9-settle', 'ch9-hearth'],
      acceptance: fixtureAcceptance(['ch9-settle', 'ch9-hearth'])
    }]
  });
  assert.deepEqual(terminalFixture[0].targetBeats, ['done']);

  const liveChapters = normalizeChapterRegistry(JSON.parse(readFileSync(DEFAULT_REGISTRY, 'utf8')));
  const liveCh6 = liveChapters.find(chapter => chapter.id === 'ch6');
  assert.ok(liveCh6, 'Live registry must contain ch6 for acceptance evidence self-tests.');
  assert.deepEqual(liveCh6.evidenceRequirements.checkpointEvidenceRefs, [
    'milestone:story:dive:waterline-entered',
    'milestone:story:sense:oxygen',
    'milestone:story:item:kestrel-keel-memory:acquired',
    'milestone:story:dive:surfaced-with-keel',
    'milestone:story:item:kestrel-keel-memory:banked'
  ]);
  const liveReadinessByRef = chapterReadinessEntryBeats(liveChapters);
  const ch6EntrySample = {
    beat: 'ch6-dive',
    boundaryState: {
      schema: 'paravoxia.storyBoundaryState.v1',
      verified: true,
      stateRefs: [...liveCh6.evidenceRequirements.entryStateRefs]
    },
    milestoneEvidence: {
      schema: 'paravoxia.runtimeMilestoneEvidence.v1',
      available: true,
      source: 'runtime-progression-module',
      milestones: ['story:ch5:maw-repaired']
    }
  };
  const ch6RequiredMilestones = [
    'story:ch5:maw-repaired',
    'story:ch6:keel-banked',
    'story:dive:waterline-entered',
    'story:sense:oxygen',
    'story:item:kestrel-keel-memory:acquired',
    'story:dive:surfaced-with-keel',
    'story:item:kestrel-keel-memory:banked'
  ];
  const ch6FinalSample = {
    beat: 'ch7-reconstruct',
    boundaryState: {
      schema: 'paravoxia.storyBoundaryState.v1',
      verified: true,
      stateRefs: [...liveCh6.evidenceRequirements.exitStateRefs]
    },
    milestoneEvidence: {
      schema: 'paravoxia.runtimeMilestoneEvidence.v1',
      available: true,
      source: 'runtime-progression-module',
      milestones: ch6RequiredMilestones
    }
  };
  const completeCh6Evidence = evaluateChapterRegisteredEvidence(
    liveCh6,
    ch6EntrySample,
    ch6FinalSample,
    liveReadinessByRef
  );
  assert.equal(completeCh6Evidence.status, 'passed');
  assert.equal(completeCh6Evidence.complete, true);
  assert.equal(completeCh6Evidence.entryRequirements.complete, true);
  assert.equal(completeCh6Evidence.exitGuarantees.complete, true);
  assert.equal(completeCh6Evidence.checkpointEvidenceRefs.complete, true);

  for (const receiptRef of liveCh6.evidenceRequirements.checkpointEvidenceRefs) {
    const receipt = receiptRef.slice('milestone:'.length);
    const withoutReceipt = evaluateChapterRegisteredEvidence(
      liveCh6,
      ch6EntrySample,
      {
        ...ch6FinalSample,
        milestoneEvidence: {
          ...ch6FinalSample.milestoneEvidence,
          milestones: ch6RequiredMilestones.filter(value => value !== receipt)
        }
      },
      liveReadinessByRef
    );
    assert.equal(withoutReceipt.status, 'failed', `${receiptRef} must be acceptance-critical.`);
    assert.equal(withoutReceipt.complete, false);
    assert.ok(withoutReceipt.checkpointEvidenceRefs.missingRefs.includes(receiptRef));
  }

  const withoutBankReceipt = evaluateChapterRegisteredEvidence(
    liveCh6,
    ch6EntrySample,
    {
      ...ch6FinalSample,
      milestoneEvidence: {
        ...ch6FinalSample.milestoneEvidence,
        milestones: ch6RequiredMilestones.filter(value => value !== 'story:item:kestrel-keel-memory:banked')
      }
    },
    liveReadinessByRef
  );
  assert.equal(withoutBankReceipt.status, 'failed');
  assert.ok(withoutBankReceipt.exitGuarantees.missingRefs.includes(
    'milestone:story:item:kestrel-keel-memory:banked'
  ));
  assert.ok(withoutBankReceipt.checkpointEvidenceRefs.missingRefs.includes(
    'milestone:story:item:kestrel-keel-memory:banked'
  ));

  const unavailableCh6Milestones = evaluateChapterRegisteredEvidence(
    liveCh6,
    ch6EntrySample,
    {
      ...ch6FinalSample,
      milestoneEvidence: {
        schema: 'paravoxia.runtimeMilestoneEvidence.v1',
        available: false,
        source: 'runtime-progression-module',
        reason: 'fixture-runtime-module-unavailable',
        milestones: []
      }
    },
    liveReadinessByRef
  );
  assert.equal(unavailableCh6Milestones.status, 'blocked');
  assert.equal(unavailableCh6Milestones.complete, false);
  assert.ok(unavailableCh6Milestones.exitGuarantees.unavailableRefs.includes(
    'milestone:story:ch6:keel-banked'
  ));
  assert.ok(registeredEvidenceFailureReasons(unavailableCh6Milestones).some(reason => (
    reason.includes('could not be evaluated by the runtime probe')
  )));

  const wrongReadinessBeat = evaluateRegisteredEvidenceRefs(
    ['state:chapter/ch7-ready'],
    { ...ch6FinalSample, beat: 'ch6-dive' },
    liveReadinessByRef
  );
  assert.equal(wrongReadinessBeat.status, 'failed');
  assert.deepEqual(wrongReadinessBeat.missingRefs, ['state:chapter/ch7-ready']);

  const unsupportedEvidence = evaluateRegisteredEvidenceRefs(
    ['external:human-assertion'],
    ch6FinalSample,
    liveReadinessByRef
  );
  assert.equal(unsupportedEvidence.status, 'blocked');
  assert.deepEqual(unsupportedEvidence.unsupportedRefs, ['external:human-assertion']);

  const liveCh7 = liveChapters.find(chapter => chapter.id === 'ch7');
  assert.ok(liveCh7, 'Live registry must contain ch7 for acceptance evidence self-tests.');
  const ch7CheckpointEvidenceRefs = [
    'milestone:story:reconstruct:relationships-diagnosed-physical',
    'milestone:story:reconstruct:calibration-completed-physical',
    'state:ship-restoration/flight_ready',
    'milestone:story:route:tidegarden:online',
    'milestone:story:board:physical-transaction-complete',
    'state:space-flight/control-mode=flight'
  ];
  assert.deepEqual(liveCh7.evidenceRequirements.checkpointEvidenceRefs, ch7CheckpointEvidenceRefs);
  assert.deepEqual(liveCh7.evidenceRequirements.objectiveRefs, [
    'runtime:src/story/wreckReconstruction.ts#getWreckReconstructionGuidance',
    'runtime:src/story/physicalBoarding.ts#getPhysicalBoardingGuidance'
  ]);
  assert.deepEqual(liveCh7.requiredAnchorIds, [
    'anc.reconstruct.diagnosis',
    'anc.reconstruct.bench-online',
    'anc.reconstruct.frame-restored',
    'anc.reconstruct.hull-sealed',
    'anc.reconstruct.lift-online',
    'anc.reconstruct.route-online',
    'anc.reconstruct.calibration',
    'anc.board.hatch-enter',
    'anc.board.camera-transfer',
    'anc.board.pressure-seal',
    'anc.board.cockpit-handback'
  ]);
  assert.deepEqual(liveCh7.preflightTests, [
    'src/story/emergentStoryDirector.test.ts',
    'src/story/reconstructionEmbodiment.test.ts',
    'src/story/reconstructionCalibration.test.ts',
    'src/story/physicalBoarding.test.ts'
  ]);

  const ch7EntrySample = {
    beat: 'ch7-reconstruct',
    boundaryState: {
      schema: 'paravoxia.storyBoundaryState.v1',
      verified: true,
      stateRefs: [...liveCh7.evidenceRequirements.entryStateRefs]
    },
    milestoneEvidence: {
      schema: 'paravoxia.runtimeMilestoneEvidence.v1',
      available: true,
      source: 'runtime-progression-module',
      milestones: ['story:ch6:keel-banked']
    }
  };
  const ch7RequiredMilestones = [
    'story:ch7:flight-ready',
    'story:ch7:boarded',
    'story:reconstruct:relationships-diagnosed-physical',
    'story:reconstruct:calibration-completed-physical',
    'story:route:tidegarden:online',
    'story:board:physical-transaction-complete'
  ];
  const ch7FinalSample = {
    beat: 'ch8-launch',
    boundaryState: {
      schema: 'paravoxia.storyBoundaryState.v1',
      verified: true,
      stateRefs: [...new Set([
        ...liveCh7.evidenceRequirements.exitStateRefs,
        'state:ship-restoration/flight_ready',
        'state:space-flight/control-mode=flight'
      ])]
    },
    milestoneEvidence: {
      schema: 'paravoxia.runtimeMilestoneEvidence.v1',
      available: true,
      source: 'runtime-progression-module',
      milestones: ch7RequiredMilestones
    }
  };
  const completeCh7Evidence = evaluateChapterRegisteredEvidence(
    liveCh7,
    ch7EntrySample,
    ch7FinalSample,
    liveReadinessByRef
  );
  assert.equal(completeCh7Evidence.status, 'passed');
  assert.equal(completeCh7Evidence.complete, true);
  assert.equal(completeCh7Evidence.checkpointEvidenceRefs.complete, true);

  for (const evidenceRef of ch7CheckpointEvidenceRefs) {
    const milestone = evidenceRef.startsWith('milestone:')
      ? evidenceRef.slice('milestone:'.length)
      : null;
    const withoutEvidence = evaluateChapterRegisteredEvidence(
      liveCh7,
      ch7EntrySample,
      {
        ...ch7FinalSample,
        boundaryState: {
          ...ch7FinalSample.boundaryState,
          stateRefs: ch7FinalSample.boundaryState.stateRefs.filter(value => value !== evidenceRef)
        },
        milestoneEvidence: {
          ...ch7FinalSample.milestoneEvidence,
          milestones: milestone
            ? ch7RequiredMilestones.filter(value => value !== milestone)
            : ch7RequiredMilestones
        }
      },
      liveReadinessByRef
    );
    assert.equal(withoutEvidence.status, 'failed', `${evidenceRef} must be acceptance-critical.`);
    assert.ok(withoutEvidence.checkpointEvidenceRefs.missingRefs.includes(evidenceRef));
  }

  for (const anchorId of liveCh7.requiredAnchorIds) {
    const observed = new Set(liveCh7.requiredAnchorIds.filter(value => value !== anchorId));
    assert.deepEqual(
      liveCh7.requiredAnchorIds.filter(value => !observed.has(value)),
      [anchorId],
      `${anchorId} must remain independently required.`
    );
  }

  const evidenceDir = mkdtempSync(path.join(os.tmpdir(), 'chapter-acceptance-self-test-'));
  try {
    const source = {
      revision: 'abc123',
      worktreeStatusSha256: 'status456',
      candidateTreeSha256: 'tree789'
    };
    const loosePath = path.join(evidenceDir, 'loose.txt');
    writeFileSync(loosePath, 'verdict: accepted\n');
    assert.equal(headedTasteArtifact(loosePath, null, 'ch3', source).status, 'unverified');
    const boundPath = path.join(evidenceDir, 'bound.json');
    writeFileSync(boundPath, JSON.stringify({
      schema: 'paravoxia.headedTasteEvidence.v1',
      chapterId: 'ch3',
      candidate: {
        revision: 'abc123',
        worktreeStatusSha256: 'diagnostic-mismatch-is-not-an-authority-binding',
        candidateTreeSha256: 'tree789'
      },
      headedRealGpuEvidence: true,
      audiblePlaybackReviewed: true,
      decisionSource: 'human_operator',
      manualPlayReviewed: true,
      resetResumeReviewed: true,
      verdict: 'accepted'
    }));
    assert.equal(headedTasteArtifact(boundPath, null, 'ch3', source).status, 'accepted');
    const wrongChapter = JSON.parse(readFileSync(boundPath, 'utf8'));
    wrongChapter.chapterId = 'ch4';
    writeFileSync(boundPath, JSON.stringify(wrongChapter));
    assert.equal(headedTasteArtifact(boundPath, null, 'ch3', source).status, 'unverified');
    const modelAuthored = {
      ...wrongChapter,
      chapterId: 'ch3',
      decisionSource: 'model'
    };
    writeFileSync(boundPath, JSON.stringify(modelAuthored));
    assert.equal(headedTasteArtifact(boundPath, null, 'ch3', source).status, 'unverified');
  } finally {
    rmSync(evidenceDir, { recursive: true, force: true });
  }

  return {
    schema: 'paravoxia.chapterAcceptanceSelfTest.v1',
    status: 'passed',
    checks: [
      'argument parsing and guarded preflight skip',
      'reach-target chapter boundary',
      'leave-exit chapter boundary',
      'last chapter reaches registry terminalBeat',
      'registry minimum cold runs remain authoritative',
      'four named desktop/mobile/reduced-motion/quality variants remain authoritative',
      'performance budgets are normalized and enforceable',
      'software WebGL renderers cannot pass hardware-only frame budgets',
      'renderer evidence distinguishes hardware software unknown and unavailable classifications',
      'WebGL warning diagnostics and context-creation failures fail closed without flagging unrelated warnings',
      'screenshot intervals are excluded from the authoritative runner frame probe',
      'boundary evidence settles until outgoing signed handback history is visible',
      'signed AV anchors derive from registry boundary refs',
      'predecessor probes require only receipts available at the exact boundary',
      'gameplay objective refs require rendered actionable ready-or-markerless guidance',
      'hidden empty offscreen missing-marker and stale cross-beat objective evidence is rejected',
      'registered beats must be observed in order',
      'predecessor boundary failure blocks acceptance',
      'machine-ready signal cannot bypass failed runs, preflight, or predecessor boundary',
      'headed taste requires structured exact-candidate binding',
      'headed taste binds to revision and candidate tree while status hash remains diagnostic',
      'candidate identity ignores generated and explicit evidence/output churn',
      'candidate identity changes when source content changes',
      'registered entry requirements are checked against the captured entry snapshot',
      'registered exit guarantees are checked against the captured boundary snapshot',
      'chapter-ready state refs derive only from the observed beat and registry entry mapping',
      'ch6 checkpoint proof requires waterline oxygen acquire surface and bank receipts',
      'each missing ch6 waterline oxygen acquire surface or bank receipt fails formal registered evidence',
      'ch7 checkpoint proof requires diagnosis restoration route calibration boarding and flight-control evidence',
      'each missing ch7 physical receipt or exact state ref fails formal registered evidence',
      'all eleven required ch7 reconstruction and boarding anchors remain independently required',
      'ch7 reconstruction and boarding objective sources feed the focused preflight test set',
      'unavailable or unsupported registered evidence blocks instead of being inferred',
      'supplemental headed taste cannot issue a runner disposition',
      'standalone runner emits only machine-ready-for-council-review, repair-required, or blocked'
    ]
  };
}

function blockedReport(options, error) {
  const source = sourceIdentity({ excludedPaths: candidateEvidencePaths(options) });
  return {
    schema: REPORT_SCHEMA,
    reportVersion: 1,
    generatedAt: new Date().toISOString(),
    runId: options.runId ?? `${safeSlug(options.chapter ?? 'unknown')}-blocked`,
    evidenceScope: 'automated-movie-mode-mechanical-evidence-only',
    targetChapterMatchesInput: false,
    candidateRevisionMatchesInput: false,
    requiredObjectiveBeatsPassed: false,
    requiredVariantProfilesPassed: false,
    performanceBudgetsPassed: false,
    registeredEvidenceProofComplete: false,
    boundaryProofComplete: false,
    preflightAuthorityCertified: false,
    machineReadyForCouncilReview: false,
    chapter: options.chapter ? { id: options.chapter } : null,
    source,
    preflight: { skipped: false, passed: false, commands: [] },
    execution: { requestedColdRuns: options.runs, completedColdRuns: 0, mode: 'movie' },
    runs: [],
    supplementalExternalEvidence: {
      claim: 'External evidence is preserved for council review but cannot change this mechanical disposition.',
      headedTaste: headedTasteArtifact(options.headedTaste, options.headedTasteVerdict, options.chapter, source),
      manualPlay: evidenceArtifact(options.manualEvidence, null, 'manual-play'),
      liveAudio: evidenceArtifact(options.audioEvidence, null, 'live-audio')
    },
    aggregate: { passed: 0, failed: 0, blocked: 0 },
    disposition: 'blocked',
    dispositionReasons: [error instanceof Error ? error.message : String(error)],
    openGates: ['configuration-or-infrastructure'],
    claims: { finalCouncilAcceptance: false }
  };
}

function writeFinalReport(report, options) {
  const fallbackDir = options.output ?? path.join(REPO_ROOT, 'captures', 'chapter-acceptance', safeSlug(options.chapter ?? 'unknown'));
  mkdirSync(fallbackDir, { recursive: true });
  const reportPath = options.report ?? path.join(fallbackDir, 'chapter-mechanical-evidence.json');
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return reportPath;
}

function selectedVariantsForRun(chapter, options) {
  if (options.profile) {
    return [{
      id: `debug-${options.profile.toLowerCase()}`,
      qualityProfile: options.profile,
      deviceClass: 'desktop',
      viewport: options.viewport,
      reducedMotion: false
    }];
  }
  if (options.profiles) {
    const byId = new Map(chapter.requiredVariantProfiles.map(variant => [variant.id, variant]));
    const unknown = options.profiles.filter(id => !byId.has(id));
    if (unknown.length > 0) {
      throw new Error(`Unknown --profiles variant id(s) for ${chapter.id}: ${unknown.join(', ')}.`);
    }
    return options.profiles.map(id => byId.get(id));
  }
  if (options.smoke) return chapter.requiredVariantProfiles.slice(0, 1);
  return [...chapter.requiredVariantProfiles];
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${HELP}`);
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    process.stdout.write(HELP);
    return;
  }
  if (options.selfTest) {
    const result = runSelfTest();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  try {
    if (!existsSync(options.registry)) throw new Error(`Chapter registry not found: ${options.registry}`);
    const registryBytes = readFileSync(options.registry);
    const registry = JSON.parse(registryBytes.toString('utf8'));
    const chapters = normalizeChapterRegistry(registry);
    const readinessByRef = chapterReadinessEntryBeats(chapters);
    if (options.list) {
      process.stdout.write(`${JSON.stringify(chapters.map(chapter => ({
        id: chapter.id,
        title: chapter.title,
        entryBeat: chapter.entryBeat,
        targetBeats: chapter.targetBeats,
        exitBeat: chapter.exitBeat,
        completionMode: chapter.completionMode,
        minimumColdRuns: chapter.minimumColdRuns,
        minimumVariantProfiles: chapter.minimumVariantProfiles,
        requiredObjectiveBeats: chapter.requiredObjectiveBeats,
        requiredVariantProfiles: chapter.requiredVariantProfiles,
        performanceBudgets: chapter.budgets,
        evidenceRequirements: chapter.evidenceRequirements
      })), null, 2)}\n`);
      return;
    }
    const chapter = chapters.find(candidate => candidate.id === options.chapter);
    if (!chapter) throw new Error(`Unknown chapter '${options.chapter}'. Available: ${chapters.map(item => item.id).join(', ')}`);
    if (!options.smoke && !options.debug && !options.candidateRevision) {
      throw new Error('--candidate-revision is required for a certifying mechanical run.');
    }
    const chapterIndex = chapters.indexOf(chapter);
    const predecessor = chapterIndex > 0 ? chapters[chapterIndex - 1] : null;
    const selectedVariants = selectedVariantsForRun(chapter, options);
    if (selectedVariants.length === 0) {
      throw new Error(`Chapter ${chapter.id} has no executable acceptance variants.`);
    }
    if (!options.smoke && !options.debug) {
      options.runs = Math.max(
        options.runs,
        chapter.minimumColdRuns,
        chapter.minimumVariantProfiles,
        chapter.requiredVariantProfiles.length
      );
    } else if (!options.runsExplicit && !options.smoke) {
      options.runs = Math.max(options.runs, chapter.minimumColdRuns);
    }

    const source = sourceIdentity({ excludedPaths: candidateEvidencePaths(options) });
    const runId = options.runId ?? `${safeSlug(chapter.id)}-${source.candidateTreeSha256?.slice(0, 12) ?? source.revision?.slice(0, 12) ?? 'working-tree'}`;
    const outputDir = options.output ?? path.join(REPO_ROOT, 'captures', 'chapter-acceptance', runId);
    options.output = outputDir;
    mkdirSync(outputDir, { recursive: true });
    const preflight = runPreflight(chapter, options.registry, options.skipPreflight);
    const headedTaste = headedTasteArtifact(
      options.headedTaste,
      options.headedTasteVerdict,
      chapter.id,
      source
    );
    const manualEvidence = evidenceArtifact(options.manualEvidence, null, 'manual-play');
    const audioEvidence = evidenceArtifact(options.audioEvidence, null, 'live-audio');
    const browser = discoverChromium(options.browser);
    const serverLogPath = path.join(outputDir, 'vite-no-hmr.log');
    const registryAuthorityBound = path.resolve(options.registry) === path.resolve(DEFAULT_REGISTRY);
    const externalServerReused = Boolean(options.baseUrl);
    let ownedServer = null;
    let baseUrl = options.baseUrl;
    if (baseUrl) {
      if (!(await serverResponds(baseUrl))) throw new Error(`--base-url is not responding: ${baseUrl}`);
      writeFileSync(serverLogPath, 'External server reused by explicit --base-url; server output is not owned.\n');
    } else {
      const port = options.port ?? await freePort();
      ownedServer = await startOwnedServer(port, serverLogPath);
      baseUrl = ownedServer.baseUrl;
    }

    let runs = [];
    let predecessorBoundary = {
      status: 'not-applicable',
      reason: 'The prologue has no predecessor chapter.',
      predecessorChapterId: null,
      fromBeat: null,
      targetEntryBeat: chapter.entryBeat,
      result: null
    };
    try {
      const { chromium } = await import('playwright-core');
      if (predecessor && options.skipPredecessor) {
        predecessorBoundary = {
          status: 'blocked',
          reason: 'Skipped by explicit debug-only --skip-predecessor; continuity remains unverified by this report.',
          predecessorChapterId: predecessor.id,
          fromBeat: predecessor.exitBeat,
          targetEntryBeat: chapter.entryBeat,
          result: null
        };
        process.stdout.write(
          `[chapter-acceptance] predecessor boundary skipped (debug-only): ${predecessor.id}:${predecessor.exitBeat} -> ${chapter.id}:${chapter.entryBeat}\n`
        );
      } else if (predecessor) {
        const boundaryChapter = createPredecessorBoundaryChapter(predecessor, chapter);
        process.stdout.write(
          `[chapter-acceptance] predecessor boundary: ${predecessor.id}:${predecessor.exitBeat} -> ${chapter.id}:${chapter.entryBeat}\n`
        );
        const result = await runColdBrowserCase({
          chromium,
          executablePath: browser.executablePath,
          baseUrl,
          chapter: boundaryChapter,
          options,
          index: 0,
          outputDir,
          runLabel: 'predecessor-boundary',
          runKind: 'predecessor-boundary',
          variant: selectedVariants[0],
          readinessEntryBeats: readinessByRef
        });
        predecessorBoundary = {
          status: result.status,
          reason: result.boundary.reason,
          predecessorChapterId: predecessor.id,
          fromBeat: predecessor.exitBeat,
          targetEntryBeat: chapter.entryBeat,
          result
        };
      }
      for (let index = 1; index <= options.runs; index++) {
        const variant = selectedVariants[(index - 1) % selectedVariants.length];
        process.stdout.write(
          `[chapter-acceptance] cold run ${index}/${options.runs}: ${chapter.id} (${variant.id})\n`
        );
        runs.push(await runColdBrowserCase({
          chromium,
          executablePath: browser.executablePath,
          baseUrl,
          chapter,
          options,
          index,
          outputDir,
          variant,
          readinessEntryBeats: readinessByRef
        }));
      }
    } finally {
      if (ownedServer) {
        ownedServer.process.kill('SIGTERM');
        ownedServer.stream.end();
      }
    }

    const sourceAtEnd = sourceIdentity({ excludedPaths: candidateEvidencePaths(options) });
    const sourceIdentityAvailable = Boolean(
      source.revision
      && source.candidateTreeSha256
      && sourceAtEnd.revision
      && sourceAtEnd.candidateTreeSha256
    );
    const candidateStable = sourceIdentityAvailable
      && source.revision === sourceAtEnd.revision
      && source.candidateTreeSha256 === sourceAtEnd.candidateTreeSha256;
    const sourceVerification = {
      status: !sourceIdentityAvailable
        ? 'candidate-identity-unavailable'
        : candidateStable ? 'matched' : 'candidate-mutated-during-run',
      start: {
        revision: source.revision,
        candidateTreeSha256: source.candidateTreeSha256,
        worktreeStatusSha256: source.worktreeStatusSha256
      },
      end: {
        revision: sourceAtEnd.revision,
        candidateTreeSha256: sourceAtEnd.candidateTreeSha256,
        worktreeStatusSha256: sourceAtEnd.worktreeStatusSha256
      },
      binding: 'revision + candidateTreeSha256; worktreeStatusSha256 is diagnostic only'
    };
    const aggregate = {
      passed: runs.filter(run => run.status === 'passed').length,
      failed: runs.filter(run => run.status === 'failed').length,
      blocked: runs.filter(run => run.status === 'blocked').length
    };
    const effectivePreflightPassed = preflight.skipped ? false : preflight.passed;
    const authorityCommand = preflight.commands.find(command => (
      command.label === 'chapter-registry-certification-authority'
    ));
    let authorityCertification = null;
    try {
      authorityCertification = authorityCommand?.outputTail
        ? JSON.parse(authorityCommand.outputTail.trim())
        : null;
    } catch {
      authorityCertification = null;
    }
    const targetChapterMatchesInput = chapter.id === options.chapter;
    const candidateRevisionMatchesInput = Boolean(
      options.candidateRevision
      && source.dirty === false
      && sourceAtEnd.dirty === false
      && source.revision === options.candidateRevision
      && sourceAtEnd.revision === options.candidateRevision
      && candidateStable
    );
    const requiredRunCount = Math.max(
      chapter.minimumColdRuns,
      chapter.minimumVariantProfiles,
      chapter.requiredVariantProfiles.length
    );
    const requiredObjectiveBeatsPassed = runs.length >= requiredRunCount && runs.every(run => (
      run.objectiveEvidence.requiredBeats.length === chapter.requiredObjectiveBeats.length
      && run.objectiveEvidence.missingRequiredBeats.length === 0
    ));
    const requiredVariantProfiles = chapter.requiredVariantProfiles.map(required => {
      const matchingRuns = runs.filter(run => run.variant?.id === required.id);
      return {
        ...required,
        executedRuns: matchingRuns.length,
        passedRuns: matchingRuns.filter(run => run.status === 'passed').length,
        passed: matchingRuns.length > 0 && matchingRuns.every(run => run.status === 'passed')
      };
    });
    const requiredVariantProfilesPassed = requiredVariantProfiles.length >= chapter.minimumVariantProfiles
      && requiredVariantProfiles.every(variant => variant.passed);
    const performanceBudgetCount = Object.keys(chapter.budgets).length;
    const performanceBudgetsPassed = performanceBudgetCount > 0
      && runs.length >= requiredRunCount
      && runs.every(run => (
        run.performanceBudgetChecks.length === performanceBudgetCount
        && run.performanceBudgetChecks.every(check => check.status === 'passed')
      ));
    const hardwareRendererPerformanceBlocked = runs.some(run => (
      run.performanceEnvironment?.hardwareFrameEvidenceBlocked === true
    ));
    const registeredEvidenceProbeBlocked = Boolean(
      runs.some(run => run.registeredEvidence?.status === 'blocked')
      || predecessorBoundary.result?.registeredEvidence?.status === 'blocked'
    );
    const boundaryStateRefsObserved = runs.length >= requiredRunCount && runs.every(run => (
      run.boundaryStateEvidence?.complete === true
    ));
    const registeredEvidenceProofComplete = runs.length >= requiredRunCount && runs.every(run => (
      run.registeredEvidence?.complete === true
    ));
    const boundaryProofComplete = boundaryStateRefsObserved
      && registeredEvidenceProofComplete
      && ['passed', 'not-applicable'].includes(predecessorBoundary.status)
      && runs.every(run => (
        run.boundary.entryObserved
        && run.boundary.reached
        && run.flow.beatCoverage.complete
        && run.signedAvEvidence.missingRequiredAnchorIds.length === 0
        && run.telemetry.sceneReadyAtBoundary
        && run.telemetry.nonzeroCanvasAtBoundary
        && (!run.spawnSafety.required || (run.spawnSafety.available && run.spawnSafety.safeObserved && !run.spawnSafety.unsafeObserved))
      ));
    const preflightAuthorityCertified = Boolean(
      !preflight.skipped
      && authorityCommand?.status === 'passed'
      && authorityCertification?.schema === 'paravoxia.chapterSceneAuthorityCertificationReport.v1'
      && authorityCertification?.chapterId === chapter.id
      && authorityCertification?.certified === true
    );
    const noncertifyingShortcutUsed = Boolean(
      options.skipPreflight
      || options.smoke
      || options.debug
      || externalServerReused
      || !registryAuthorityBound
    );
    const machineReadyForCouncilReview = Boolean(
      !noncertifyingShortcutUsed
      && targetChapterMatchesInput
      && candidateRevisionMatchesInput
      && preflightAuthorityCertified
      && effectivePreflightPassed
      && requiredObjectiveBeatsPassed
      && requiredVariantProfilesPassed
      && performanceBudgetsPassed
      && registeredEvidenceProofComplete
      && boundaryProofComplete
      && runs.length >= requiredRunCount
      && runs.every(run => run.status === 'passed')
      && candidateStable
    );
    const disposition = !candidateStable
      || !candidateRevisionMatchesInput
      || noncertifyingShortcutUsed
      ? 'blocked'
      : computeDisposition({
        runs,
        requiredRuns: requiredRunCount,
        preflightPassed: effectivePreflightPassed,
        predecessorBoundaryStatus: predecessorBoundary.status === 'not-applicable'
          ? 'passed'
          : predecessorBoundary.status,
        machineReadyForCouncilReview
      });
    const openGates = [];
    if (!preflight.passed) openGates.push(preflight.skipped ? 'preflight-skipped-debug-only' : 'preflight-repair');
    if (options.smoke || options.debug) openGates.push('debug-or-smoke-run-noncertifying');
    if (externalServerReused) openGates.push('external-server-unbound-to-candidate');
    if (!registryAuthorityBound) openGates.push('noncanonical-registry-not-validated-by-authority-gate');
    if (!sourceIdentityAvailable) openGates.push('candidate-identity-unavailable');
    else if (!candidateStable) openGates.push('candidate-mutated-during-run');
    if (!candidateRevisionMatchesInput) openGates.push('candidate-revision-not-exact-clean-input');
    if (aggregate.passed < options.runs) openGates.push('cold-run-repair-or-infrastructure');
    if (runs.length < requiredRunCount) openGates.push('minimum-cold-or-variant-runs-not-met');
    if (!requiredObjectiveBeatsPassed) openGates.push('required-objective-beats');
    if (!requiredVariantProfilesPassed) openGates.push('required-variant-profiles');
    if (!performanceBudgetsPassed) openGates.push('performance-budgets');
    if (hardwareRendererPerformanceBlocked) openGates.push('hardware-renderer-performance-evidence');
    if (!registeredEvidenceProofComplete) openGates.push('registered-entry-exit-checkpoint-evidence');
    if (!boundaryProofComplete) openGates.push('boundary-proof');
    if (!preflightAuthorityCertified) openGates.push('preflight-authority-certification');
    if (!['passed', 'not-applicable'].includes(predecessorBoundary.status)) {
      openGates.push('predecessor-entry-continuity');
    }
    const dispositionReasons = !sourceIdentityAvailable
      ? ['Candidate identity could not be established at both the start and end of the run.']
      : !candidateStable
        ? ['Source or authority content changed during the run; the captured evidence is revision-ambiguous.']
        : disposition === 'machine-ready-for-council-review'
      ? ['Every required mechanical gate passed for the exact clean candidate; final creative acceptance remains council-owned.']
        : disposition === 'repair-required'
          ? [
            ...(!preflight.passed ? ['Static preflight did not pass.'] : []),
            ...(!['passed', 'not-applicable'].includes(predecessorBoundary.status)
              ? [`Predecessor boundary probe was ${predecessorBoundary.status}.`]
              : []),
            ...runs.flatMap(run => run.failureReasons.map(reason => `run ${run.run}: ${reason}`))
          ]
          : registeredEvidenceProbeBlocked
            ? [
              'Registered entry, exit, or checkpoint evidence was unavailable to the runtime probe.',
              ...[
                ...(predecessorBoundary.result?.registeredEvidence?.issueReasons ?? []).map(reason => (
                  `predecessor boundary: ${reason}`
                )),
                ...runs.flatMap(run => (
                  run.registeredEvidence?.issueReasons ?? []
                ).map(reason => `run ${run.run}: ${reason}`))
              ]
            ]
          : hardwareRendererPerformanceBlocked
            ? ['Hardware WebGL renderer evidence was unavailable; software-rendered frame measurements are diagnostic only.']
            : ['Required certification work was skipped or meaningful browser execution was blocked.'];

    const report = {
      schema: REPORT_SCHEMA,
      reportVersion: 1,
      generatedAt: new Date().toISOString(),
      runId,
      evidenceScope: 'automated-movie-mode-mechanical-evidence-only',
      targetChapterMatchesInput,
      candidateRevisionMatchesInput,
      requiredObjectiveBeatsPassed,
      requiredVariantProfilesPassed,
      performanceBudgetsPassed,
      registeredEvidenceProofComplete,
      boundaryProofComplete,
      preflightAuthorityCertified,
      machineReadyForCouncilReview,
      registry: {
        path: asRepoRelative(options.registry),
        schema: registry.schema ?? null,
        sha256: sha256Buffer(registryBytes),
        authorityGateBoundToSameRegistry: registryAuthorityBound
      },
      source,
      sourceVerification,
      chapter: {
        id: chapter.id,
        title: chapter.title,
        entryBeat: chapter.entryBeat,
        exitBeat: chapter.exitBeat,
        targetBeats: chapter.targetBeats,
        completionMode: chapter.completionMode,
        beats: chapter.beats,
        minimumColdRuns: chapter.minimumColdRuns,
        objectiveRequired: chapter.objectiveRequired,
        requiredAnchorIds: chapter.requiredAnchorIds,
        entryAnchorIds: chapter.entryAnchorIds,
        exitAnchorIds: chapter.exitAnchorIds,
        requiredObjectiveBeats: chapter.requiredObjectiveBeats,
        requiredVariantProfiles: chapter.requiredVariantProfiles,
        minimumVariantProfiles: chapter.minimumVariantProfiles,
        performanceBudgets: chapter.budgets,
        evidenceRequirements: {
          ...chapter.evidenceRequirements,
          externalEvidenceKinds: chapter.requiredEvidence
        }
      },
      preflight: {
        ...preflight,
        authorityCertification
      },
      execution: {
        mode: 'movie',
        baseUrl,
        ownedHmrOffServer: Boolean(ownedServer),
        externalServerReused,
        certifyingMode: !options.smoke && !options.debug && !options.skipPreflight
          && !externalServerReused && registryAuthorityBound && candidateStable
          && candidateRevisionMatchesInput,
        browser: { source: browser.source, headed: options.headed },
        debugViewportOverride: options.viewport,
        debugQualityProfileOverride: options.profile,
        selectedVariants,
        requiredVariantCoverage: requiredVariantProfiles,
        requestedColdRuns: options.runs,
        minimumColdRuns: chapter.minimumColdRuns,
        completedColdRuns: runs.length,
        predecessorBoundaryRequired: Boolean(predecessor),
        screenshotMode: options.screenshotMode,
        artifactsRoot: asRepoRelative(outputDir),
        serverLog: asRepoRelative(serverLogPath)
      },
      predecessorBoundary,
      runs,
      supplementalExternalEvidence: {
        claim: 'External manual, audio, and taste evidence is preserved for council review but cannot change this mechanical disposition.',
        headedTaste,
        manualPlay: {
          ...manualEvidence,
          claim: manualEvidence.provided
            ? 'External evidence was supplied; this movie runner did not generate or validate manual input semantics.'
            : 'No manual-play evidence was supplied or inferred.'
        },
        liveAudio: {
          ...audioEvidence,
          claim: audioEvidence.provided
            ? 'External evidence was supplied; this runner did not capture or infer audible chapter output.'
            : 'No live-audio evidence was supplied, captured, or inferred.'
        }
      },
      aggregate,
      disposition,
      dispositionReasons,
      openGates: [...new Set(openGates)],
      claims: {
        movieFlowMechanicallyProven: machineReadyForCouncilReview,
        rescueFree: runs.length === options.runs && runs.every(run => (
          run.flow.teleportNudges === 0
          && run.flow.timeoutRescues.length === 0
          && run.flow.dryCrossFaceWaterContactFrames === 0
        )),
        finalCouncilAcceptance: false,
        manualPlayProvenByRunner: false,
        liveAudioProvenByRunner: false,
        humanTasteProvenByRunner: false
      }
    };
    const reportPath = writeFinalReport(report, options);
    process.stdout.write(`${JSON.stringify({ reportPath: asRepoRelative(reportPath), disposition, aggregate }, null, 2)}\n`);
    process.exitCode = disposition === 'machine-ready-for-council-review' ? 0
      : disposition === 'repair-required' ? 1 : 2;
  } catch (error) {
    const report = blockedReport(options, error);
    const reportPath = writeFinalReport(report, options);
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.stdout.write(`${JSON.stringify({ reportPath: asRepoRelative(reportPath), disposition: 'blocked' }, null, 2)}\n`);
    process.exitCode = 2;
  }
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  await main();
}

export {
  computeDisposition,
  evaluateChapterBoundary,
  normalizeChapterRegistry,
  orderedBeatCoverage,
  parseArgs,
  runSelfTest
};
