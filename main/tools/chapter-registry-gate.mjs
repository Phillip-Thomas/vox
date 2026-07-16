#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { certifyChapterSceneAuthority } from './chapter-scene-authority.mjs';

const toolDir = dirname(fileURLToPath(import.meta.url));
const mainRoot = resolve(toolDir, '..');
const repoRoot = resolve(mainRoot, '..');
const registryPath = resolve(mainRoot, 'chapter-registry.json');
const schemaPath = resolve(
  repoRoot,
  'docs/architecture/workflow-orchestration/schemas/paravoxia-chapter-registry.schema.json'
);
const storyStatePath = resolve(mainRoot, 'src/story/storyState.ts');

const REGISTRY_SCHEMA = 'paravoxia.chapterRegistry.v1';
const REPORT_SCHEMA = 'paravoxia.chapterRegistryReport.v1';
const SCENE_CONTRACT_SCHEMA = 'paravoxia.sceneContract.v1';

// This is the observable vocabulary published by storyBoundaryTelemetry plus
// the chapter-readiness refs derived by the acceptance runner from the exact
// live beat. A new state claim must first gain a runtime producer before the
// registry is allowed to rely on it.
const SUPPORTED_STATE_REF_PATTERNS = Object.freeze([
  /^state:chapter\/[a-z0-9][a-z0-9._-]*-ready$/,
  /^state:world\/(?:origin|tidegarden)$/,
  /^state:story\/(?:active|active-menu|complete)$/,
  /^state:reality\/(?:bare|color|material|alive|paradox)$/,
  /^state:control\/(?:on-foot|flight)$/,
  /^state:space-flight\/control-mode=(?:fps|flight)$/,
  /^state:space-flight\/phase=(?:surface|launch|deep_space|approach|descent)$/,
  /^state:space-flight\/phase!=deep_space$/,
  /^state:system-flight\/active-planet=\S+$/,
  /^state:ship-restoration\/(?:wrecked|bench_online|frame_restored|hull_sealed|lift_online|flight_ready)$/,
  /^state:camera\/(?:embodied|free-look)$/,
  /^state:maw\/repaired$/,
  /^state:item\/kestrel-keel-memory-banked$/,
  /^state:free-play\/two-world-handoff$/
]);

class Audit {
  constructor() {
    this.checks = 0;
    this.failures = [];
  }

  assert(condition, code, message, details = undefined) {
    this.checks += 1;
    if (!condition) {
      this.failures.push({ code, message, ...(details === undefined ? {} : { details }) });
    }
    return Boolean(condition);
  }

  report() {
    return {
      schema: REPORT_SCHEMA,
      ok: this.failures.length === 0,
      checks: this.checks,
      failures: this.failures
    };
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sameSet(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value) => right.includes(value))
  );
}

function unique(values) {
  return Array.isArray(values) && new Set(values).size === values.length;
}

function staysWithin(root, candidate) {
  const rel = relative(root, candidate);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}

function exactObject(audit, value, keys, code, label) {
  if (!audit.assert(isRecord(value), code, `${label} must be an object`)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return audit.assert(
    sameJson(actual, expected),
    code,
    `${label} must contain exactly the declared schema properties`,
    { expected, actual }
  );
}

function stringList(audit, value, code, label, { min = 0, pattern = null } = {}) {
  if (!audit.assert(Array.isArray(value), code, `${label} must be an array`)) return false;
  let valid = true;
  valid = audit.assert(value.length >= min, code, `${label} must contain at least ${min} item(s)`) && valid;
  valid = audit.assert(unique(value), code, `${label} must not contain duplicates`) && valid;
  valid =
    audit.assert(
      value.every((item) => typeof item === 'string' && item.length > 0),
      code,
      `${label} must contain only non-empty strings`
    ) && valid;
  if (pattern) {
    valid =
      audit.assert(
        value.every((item) => typeof item === 'string' && pattern.test(item)),
        code,
        `${label} contains a value outside its schema pattern`
      ) && valid;
  }
  return valid;
}

function supportedStateRef(ref) {
  return typeof ref === 'string' && SUPPORTED_STATE_REF_PATTERNS.some((pattern) => pattern.test(ref));
}

function validateStateRef(audit, ref, label) {
  audit.assert(
    supportedStateRef(ref),
    'ref.state-unsupported',
    `${label} is not published by boundary telemetry or chapter-readiness authority`,
    { ref }
  );
}

function validateSchemaDocument(audit, schema) {
  audit.assert(isRecord(schema), 'schema.document', 'Chapter registry schema must be a JSON object');
  if (!isRecord(schema)) return;
  audit.assert(
    schema.$schema === 'https://json-schema.org/draft/2020-12/schema',
    'schema.document',
    'Chapter registry schema must use JSON Schema draft 2020-12'
  );
  audit.assert(
    schema?.properties?.schema?.const === REGISTRY_SCHEMA,
    'schema.document',
    `Schema must bind manifests to ${REGISTRY_SCHEMA}`
  );
  audit.assert(
    schema?.properties?.terminalBeat?.const === 'done',
    'schema.document',
    'Schema must keep done as the terminal-only beat'
  );
  audit.assert(
    schema?.$defs?.acceptanceBudgets?.properties?.minimumColdRuns?.minimum >= 3,
    'schema.cold-run-budget',
    'Schema must require at least three cold runs per chapter'
  );
  audit.assert(
    schema?.$defs?.acceptanceBudgets?.properties?.minimumVariantProfiles?.minimum >= 4,
    'schema.variant-budget',
    'Schema must require at least four acceptance variants per chapter'
  );
  audit.assert(
    (schema?.$defs?.performanceBudgets?.required ?? []).length >= 8,
    'schema.performance-budget',
    'Schema must require a measurable performance budget contract'
  );
  audit.assert(
    schema?.$defs?.acceptanceBudgets?.properties?.maxOpenCriticalDefects?.const === 0 &&
      schema?.$defs?.acceptanceBudgets?.properties?.maxOpenHighDefects?.const === 0,
    'schema.defect-budget',
    'Schema must allow zero open critical and high defects'
  );
}

function validateRegistryShape(audit, registry) {
  if (
    !exactObject(
      audit,
      registry,
      ['schema', 'runtimeAuthorityRef', 'terminalBeat', 'sceneContracts', 'chapters'],
      'schema.registry',
      'registry'
    )
  ) {
    return false;
  }

  audit.assert(registry.schema === REGISTRY_SCHEMA, 'schema.registry', `registry.schema must be ${REGISTRY_SCHEMA}`);
  audit.assert(
    typeof registry.runtimeAuthorityRef === 'string' && registry.runtimeAuthorityRef.length > 0,
    'schema.registry',
    'runtimeAuthorityRef must be a non-empty relative path'
  );
  audit.assert(registry.terminalBeat === 'done', 'schema.registry', 'terminalBeat must be done');
  if (!audit.assert(Array.isArray(registry.sceneContracts), 'schema.scene-contracts', 'sceneContracts must be an array')) {
    return false;
  }
  if (!audit.assert(Array.isArray(registry.chapters), 'schema.chapters', 'chapters must be an array')) return false;
  audit.assert(registry.chapters.length > 0, 'schema.chapters', 'chapters must not be empty');

  for (const [index, link] of registry.sceneContracts.entries()) {
    const label = `sceneContracts[${index}]`;
    if (
      !exactObject(
        audit,
        link,
        ['id', 'sceneId', 'contractVersion', 'path', 'sha256', 'coversBeats'],
        'schema.scene-contract',
        label
      )
    ) {
      continue;
    }
    for (const key of ['id', 'sceneId', 'contractVersion', 'path']) {
      audit.assert(typeof link[key] === 'string' && link[key].length > 0, 'schema.scene-contract', `${label}.${key} must be a non-empty string`);
    }
    audit.assert(
      typeof link.path === 'string' && !isAbsolute(link.path) && !link.path.split('/').includes('..'),
      'schema.scene-contract',
      `${label}.path must be repository-relative and may not traverse upward`
    );
    audit.assert(/^[a-f0-9]{64}$/.test(link.sha256), 'schema.scene-contract', `${label}.sha256 must be lowercase SHA-256`);
    stringList(audit, link.coversBeats, 'schema.scene-contract', `${label}.coversBeats`, {
      min: 1,
      pattern: /^[a-z0-9][a-z0-9-]*$/
    });
  }

  const chapterKeys = [
    'id',
    'order',
    'beats',
    'before',
    'after',
    'entry',
    'exit',
    'checkpoints',
    'objectiveRefs',
    'revealRefs',
    'avBoundary',
    'acceptance'
  ];

  for (const [index, chapter] of registry.chapters.entries()) {
    const label = `chapters[${index}]`;
    if (!exactObject(audit, chapter, chapterKeys, 'schema.chapter', label)) continue;
    audit.assert(/^[a-z0-9][a-z0-9._-]*$/.test(chapter.id), 'schema.chapter.id', `${label}.id must be a stable lowercase slug`);
    audit.assert(Number.isInteger(chapter.order) && chapter.order >= 0, 'schema.chapter.order', `${label}.order must be a non-negative integer`);
    stringList(audit, chapter.beats, 'schema.chapter.beats', `${label}.beats`, {
      min: 1,
      pattern: /^[a-z0-9][a-z0-9-]*$/
    });
    stringList(audit, chapter.before, 'schema.chapter.adjacency', `${label}.before`, {
      pattern: /^[a-z0-9][a-z0-9._-]*$/
    });
    stringList(audit, chapter.after, 'schema.chapter.adjacency', `${label}.after`, {
      pattern: /^[a-z0-9][a-z0-9._-]*$/
    });
    audit.assert(chapter.before.length <= 1 && chapter.after.length <= 1, 'schema.chapter.adjacency', `${label} supports one linear predecessor and successor`);

    if (exactObject(audit, chapter.entry, ['beat', 'requirements', 'stateRefs'], 'schema.chapter.entry', `${label}.entry`)) {
      audit.assert(typeof chapter.entry.beat === 'string', 'schema.chapter.entry', `${label}.entry.beat must be a string`);
      stringList(audit, chapter.entry.requirements, 'schema.chapter.entry', `${label}.entry.requirements`, {
        pattern: /^(milestone|state):.+$/
      });
      stringList(audit, chapter.entry.stateRefs, 'schema.chapter.entry', `${label}.entry.stateRefs`, {
        min: 1,
        pattern: /^state:.+$/
      });
    }

    if (exactObject(audit, chapter.exit, ['beat', 'guarantees', 'stateRefs'], 'schema.chapter.exit', `${label}.exit`)) {
      audit.assert(typeof chapter.exit.beat === 'string', 'schema.chapter.exit', `${label}.exit.beat must be a string`);
      stringList(audit, chapter.exit.guarantees, 'schema.chapter.exit', `${label}.exit.guarantees`, {
        pattern: /^(milestone|state):.+$/
      });
      stringList(audit, chapter.exit.stateRefs, 'schema.chapter.exit', `${label}.exit.stateRefs`, {
        min: 1,
        pattern: /^state:.+$/
      });
    }

    if (audit.assert(Array.isArray(chapter.checkpoints), 'schema.chapter.checkpoints', `${label}.checkpoints must be an array`)) {
      for (const [checkpointIndex, checkpoint] of chapter.checkpoints.entries()) {
        const checkpointLabel = `${label}.checkpoints[${checkpointIndex}]`;
        if (
          !exactObject(
            audit,
            checkpoint,
            ['beat', 'key', 'milestone', 'resumeBeat', 'evidenceRefs'],
            'schema.chapter.checkpoint',
            checkpointLabel
          )
        ) {
          continue;
        }
        for (const key of ['beat', 'key', 'milestone', 'resumeBeat']) {
          audit.assert(typeof checkpoint[key] === 'string' && checkpoint[key].length > 0, 'schema.chapter.checkpoint', `${checkpointLabel}.${key} must be a non-empty string`);
        }
        stringList(audit, checkpoint.evidenceRefs, 'schema.chapter.checkpoint', `${checkpointLabel}.evidenceRefs`, {
          min: 1,
          pattern: /^(runtime|scene|milestone|state):.+$/
        });
      }
    }

    stringList(audit, chapter.objectiveRefs, 'schema.chapter.objective-refs', `${label}.objectiveRefs`, {
      min: 1,
      pattern: /^(runtime|scene):.+$/
    });
    stringList(audit, chapter.revealRefs, 'schema.chapter.reveal-refs', `${label}.revealRefs`, {
      min: 1,
      pattern: /^(runtime|scene):.+$/
    });

    if (
      exactObject(
        audit,
        chapter.avBoundary,
        ['sceneContractRefs', 'entry', 'exit'],
        'schema.chapter.av-boundary',
        `${label}.avBoundary`
      )
    ) {
      stringList(audit, chapter.avBoundary.sceneContractRefs, 'schema.chapter.av-boundary', `${label}.avBoundary.sceneContractRefs`);
      for (const side of ['entry', 'exit']) {
        const boundary = chapter.avBoundary[side];
        const boundaryLabel = `${label}.avBoundary.${side}`;
        if (
          !exactObject(
            audit,
            boundary,
            ['anchorRefs', 'scoreRefs', 'cameraRefs', 'paletteRefs'],
            'schema.chapter.av-boundary',
            boundaryLabel
          )
        ) {
          continue;
        }
        for (const key of ['anchorRefs', 'scoreRefs', 'cameraRefs', 'paletteRefs']) {
          stringList(audit, boundary[key], 'schema.chapter.av-boundary', `${boundaryLabel}.${key}`, {
            min: 1,
            pattern: /^(runtime|scene):.+$/
          });
        }
      }
    }

    if (
      exactObject(
        audit,
        chapter.acceptance,
        ['evidenceRefs', 'requiredObjectiveBeats', 'requiredVariantProfiles', 'performanceBudgets', 'budgets'],
        'schema.chapter.acceptance',
        `${label}.acceptance`
      )
    ) {
      stringList(audit, chapter.acceptance.evidenceRefs, 'schema.chapter.acceptance', `${label}.acceptance.evidenceRefs`, {
        min: 1,
        pattern: /^(runtime|scene):.+$/
      });
      stringList(
        audit,
        chapter.acceptance.requiredObjectiveBeats,
        'schema.chapter.required-objectives',
        `${label}.acceptance.requiredObjectiveBeats`,
        { pattern: /^[a-z0-9][a-z0-9-]*$/ }
      );
      if (Array.isArray(chapter.acceptance.requiredObjectiveBeats)) {
        const unowned = chapter.acceptance.requiredObjectiveBeats.filter((beat) => !chapter.beats.includes(beat));
        audit.assert(
          unowned.length === 0,
          'schema.chapter.required-objectives',
          `${label}.acceptance.requiredObjectiveBeats must belong to the chapter`,
          { unowned }
        );
      }
      const variants = chapter.acceptance.requiredVariantProfiles;
      if (audit.assert(Array.isArray(variants), 'schema.chapter.variants', `${label}.acceptance.requiredVariantProfiles must be an array`)) {
        audit.assert(variants.length >= 4, 'schema.chapter.variants', `${label} must declare at least four variants`);
        audit.assert(unique(variants.map((variant) => variant?.id)), 'schema.chapter.variants', `${label} variant ids must be unique`);
        for (const [variantIndex, variant] of variants.entries()) {
          const variantLabel = `${label}.acceptance.requiredVariantProfiles[${variantIndex}]`;
          if (
            !exactObject(
              audit,
              variant,
              ['id', 'qualityProfile', 'deviceClass', 'viewport', 'reducedMotion'],
              'schema.chapter.variant',
              variantLabel
            )
          ) continue;
          audit.assert(/^[a-z0-9][a-z0-9._-]*$/.test(variant.id), 'schema.chapter.variant', `${variantLabel}.id must be a stable lowercase slug`);
          audit.assert(['ULTRA', 'HIGH', 'MEDIUM', 'LOW', 'POTATO'].includes(variant.qualityProfile), 'schema.chapter.variant', `${variantLabel}.qualityProfile is unsupported`);
          audit.assert(['desktop', 'mobile'].includes(variant.deviceClass), 'schema.chapter.variant', `${variantLabel}.deviceClass is unsupported`);
          audit.assert(typeof variant.reducedMotion === 'boolean', 'schema.chapter.variant', `${variantLabel}.reducedMotion must be boolean`);
          if (exactObject(audit, variant.viewport, ['width', 'height'], 'schema.chapter.variant', `${variantLabel}.viewport`)) {
            audit.assert(Number.isInteger(variant.viewport.width) && variant.viewport.width >= 320, 'schema.chapter.variant', `${variantLabel}.viewport.width is invalid`);
            audit.assert(Number.isInteger(variant.viewport.height) && variant.viewport.height >= 480, 'schema.chapter.variant', `${variantLabel}.viewport.height is invalid`);
          }
        }
      }
      const performance = chapter.acceptance.performanceBudgets;
      const performanceKeys = [
        'maxEntryLoadMs', 'maxSceneReadyMs', 'maxBoundaryMs', 'minFps',
        'maxP95FrameTimeMs', 'maxFrameGapMs', 'maxLongTasks', 'maxHeapBytes'
      ];
      if (exactObject(audit, performance, performanceKeys, 'schema.chapter.performance', `${label}.acceptance.performanceBudgets`)) {
        for (const key of performanceKeys) {
          audit.assert(Number.isFinite(performance[key]) && performance[key] > 0, 'schema.chapter.performance', `${label}.acceptance.performanceBudgets.${key} must be positive`);
        }
      }
      const budgets = chapter.acceptance.budgets;
      if (
        exactObject(
          audit,
          budgets,
          ['minimumColdRuns', 'minimumVariantProfiles', 'maxOpenCriticalDefects', 'maxOpenHighDefects', 'maxRepairLoops'],
          'schema.chapter.acceptance',
          `${label}.acceptance.budgets`
        )
      ) {
        for (const key of Object.keys(budgets)) {
          audit.assert(Number.isInteger(budgets[key]), 'schema.chapter.acceptance', `${label}.acceptance.budgets.${key} must be an integer`);
        }
      }
    }
  }

  return true;
}

function validateAuthority(audit, registry, authority) {
  const authorityRef = registry.runtimeAuthorityRef;
  const authorityPath = typeof authorityRef === 'string' ? resolve(repoRoot, authorityRef) : repoRoot;
  audit.assert(
    typeof authorityRef === 'string' && !isAbsolute(authorityRef) && !authorityRef.split('/').includes('..'),
    'runtime.authority-path',
    'runtimeAuthorityRef must be a repository-relative path without upward traversal'
  );
  audit.assert(staysWithin(repoRoot, authorityPath), 'runtime.authority-path', 'runtimeAuthorityRef must stay inside the repository');
  audit.assert(existsSync(authorityPath), 'runtime.authority-path', `Runtime authority does not exist: ${authorityRef}`);
  if (existsSync(authorityPath)) {
    audit.assert(sameJson(readJson(authorityPath), authority), 'runtime.authority-drift', 'Loaded runtime authority must match runtimeAuthorityRef');
  }
  if (!audit.assert(Array.isArray(authority.runtimeBeatOrder), 'runtime.authority', 'runtimeBeatOrder must be an array')) return;
  audit.assert(unique(authority.runtimeBeatOrder), 'runtime.authority', 'runtimeBeatOrder must not contain duplicates');
  audit.assert(
    authority.runtimeBeatOrder.at(-1) === registry.terminalBeat,
    'runtime.terminal',
    'terminalBeat must be the final runtime authority beat'
  );
  audit.assert(
    authority.runtimeBeatOrder.filter((beat) => beat === registry.terminalBeat).length === 1,
    'runtime.terminal',
    'terminalBeat must appear exactly once in runtimeBeatOrder'
  );
}

function validateBeatCoverage(audit, registry, authority) {
  if (!Array.isArray(registry.chapters) || !Array.isArray(authority.runtimeBeatOrder)) return;
  const chapters = registry.chapters;
  const flatBeats = chapters.flatMap((chapter) => (Array.isArray(chapter.beats) ? chapter.beats : []));
  const runtimeBeats = authority.runtimeBeatOrder.filter((beat) => beat !== registry.terminalBeat);

  audit.assert(unique(flatBeats), 'runtime.beat-uniqueness', 'Every non-terminal runtime beat must be owned by exactly one chapter');
  audit.assert(
    sameJson(flatBeats, runtimeBeats),
    'runtime.beat-order',
    'Flattened chapter beats must exactly match runtimeBeatOrder without the terminal beat',
    { expected: runtimeBeats, actual: flatBeats }
  );
  audit.assert(chapters[0]?.id === 'prologue', 'chapter.prologue', 'The first chapter must retain the stable prologue id');
  audit.assert(
    chapters.filter((chapter) => chapter.id === 'prologue').length === 1,
    'chapter.prologue',
    'The registry must contain exactly one prologue'
  );

  for (const [index, chapter] of chapters.entries()) {
    audit.assert(chapter.order === index, 'chapter.order', `${chapter.id}.order must equal its registry position`, {
      expected: index,
      actual: chapter.order
    });
    if (!Array.isArray(chapter.beats) || chapter.beats.length === 0) continue;
    audit.assert(chapter.entry?.beat === chapter.beats[0], 'chapter.entry-beat', `${chapter.id}.entry.beat must be its first runtime beat`);
    audit.assert(chapter.exit?.beat === chapter.beats.at(-1), 'chapter.exit-beat', `${chapter.id}.exit.beat must be its final runtime beat`);
  }
}

function validateAdjacency(audit, registry) {
  if (!Array.isArray(registry.chapters)) return;
  const chapters = registry.chapters;
  const byId = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  audit.assert(byId.size === chapters.length, 'adjacency.unique-ids', 'Chapter ids must be unique');

  for (const [index, chapter] of chapters.entries()) {
    const expectedBefore = index === 0 ? [] : [chapters[index - 1].id];
    const expectedAfter = index === chapters.length - 1 ? [] : [chapters[index + 1].id];
    audit.assert(sameJson(chapter.before, expectedBefore), 'adjacency.previous', `${chapter.id}.before must name its ordered predecessor`, {
      expected: expectedBefore,
      actual: chapter.before
    });
    audit.assert(sameJson(chapter.after, expectedAfter), 'adjacency.next', `${chapter.id}.after must name its ordered successor`, {
      expected: expectedAfter,
      actual: chapter.after
    });

    for (const previousId of Array.isArray(chapter.before) ? chapter.before : []) {
      const previous = byId.get(previousId);
      audit.assert(Boolean(previous), 'adjacency.reference', `${chapter.id}.before references unknown chapter ${previousId}`);
      if (previous) {
        audit.assert(previous.after?.includes(chapter.id), 'adjacency.reciprocal', `${previousId}.after must reciprocate ${chapter.id}.before`);
      }
    }
    for (const nextId of Array.isArray(chapter.after) ? chapter.after : []) {
      const next = byId.get(nextId);
      audit.assert(Boolean(next), 'adjacency.reference', `${chapter.id}.after references unknown chapter ${nextId}`);
      if (next) {
        audit.assert(next.before?.includes(chapter.id), 'adjacency.reciprocal', `${nextId}.before must reciprocate ${chapter.id}.after`);
      }
    }

    if (index > 0) {
      const previous = chapters[index - 1];
      audit.assert(
        sameSet(previous.exit?.stateRefs, chapter.entry?.stateRefs),
        'adjacency.state-boundary',
        `${previous.id} exit state must exactly match ${chapter.id} entry state`,
        { exit: previous.exit?.stateRefs, entry: chapter.entry?.stateRefs }
      );
      const guarantees = new Set(previous.exit?.guarantees ?? []);
      const missingRequirements = (chapter.entry?.requirements ?? []).filter((requirement) => !guarantees.has(requirement));
      audit.assert(
        missingRequirements.length === 0,
        'adjacency.requirements',
        `${chapter.id} entry requirements must be guaranteed by ${previous.id}`,
        { missingRequirements }
      );
    }
  }

  const colors = new Map();
  let cycle = null;
  function visit(id, stack) {
    colors.set(id, 'gray');
    const chapter = byId.get(id);
    for (const nextId of chapter?.after ?? []) {
      if (!byId.has(nextId)) continue;
      if (colors.get(nextId) === 'gray') {
        cycle = [...stack, id, nextId];
        return;
      }
      if (!colors.has(nextId)) visit(nextId, [...stack, id]);
      if (cycle) return;
    }
    colors.set(id, 'black');
  }
  for (const chapter of chapters) {
    if (!colors.has(chapter.id)) visit(chapter.id, []);
  }
  audit.assert(cycle === null, 'adjacency.acyclic', 'Chapter adjacency graph must be acyclic', cycle ?? undefined);
}

function loadSceneContracts(audit, registry) {
  const catalogs = new Map();
  const ids = (registry.sceneContracts ?? []).map((link) => link.id);
  audit.assert(unique(ids), 'scene.catalog-ids', 'Scene contract catalog ids must be unique');

  for (const link of registry.sceneContracts ?? []) {
    if (!isRecord(link) || typeof link.path !== 'string') continue;
    const contractPath = resolve(repoRoot, link.path);
    audit.assert(staysWithin(repoRoot, contractPath), 'scene.contract-path', `${link.id} must stay inside the repository`);
    if (!audit.assert(existsSync(contractPath), 'scene.contract-path', `Scene contract does not exist: ${link.path}`)) continue;
    const bytes = readFileSync(contractPath);
    const digest = createHash('sha256').update(bytes).digest('hex');
    audit.assert(digest === link.sha256, 'scene.contract-hash', `${link.id} SHA-256 does not match its structural catalog link`, {
      expected: link.sha256,
      actual: digest
    });
    let contract;
    try {
      contract = JSON.parse(bytes.toString('utf8'));
    } catch (error) {
      audit.assert(false, 'scene.contract-json', `${link.id} is not valid JSON`, { error: error.message });
      continue;
    }
    audit.assert(contract.schema === SCENE_CONTRACT_SCHEMA, 'scene.contract-schema', `${link.id} must use ${SCENE_CONTRACT_SCHEMA}`);
    audit.assert(contract.sceneId === link.sceneId, 'scene.contract-identity', `${link.id} sceneId does not match its catalog link`);
    audit.assert(contract.contractVersion === link.contractVersion, 'scene.contract-identity', `${link.id} contractVersion does not match its catalog link`);
    audit.assert(
      sameJson(contract.scope?.beats, link.coversBeats),
      'scene.contract-scope',
      `${link.id} coversBeats must exactly mirror contract.scope.beats`
    );
    catalogs.set(link.id, { link, contract });
  }
  return catalogs;
}

function validateRuntimeRef(audit, ref, label) {
  const match = /^runtime:([^#]+)#(.+)$/.exec(ref);
  if (!audit.assert(Boolean(match), 'ref.runtime-format', `${label} must use runtime:<main-relative-path>#<fragment>`, { ref })) return;
  const [, relativePath] = match;
  const target = resolve(mainRoot, relativePath);
  audit.assert(!isAbsolute(relativePath) && !relativePath.split('/').includes('..'), 'ref.runtime-path', `${label} must be main-relative`, { ref });
  audit.assert(staysWithin(mainRoot, target), 'ref.runtime-path', `${label} must stay inside main`, { ref });
  audit.assert(existsSync(target), 'ref.runtime-target', `${label} points to a missing runtime source`, { ref });
}

function validateSceneRef(audit, ref, catalogs, label) {
  const evidenceMatch = /^scene:([^#]+)#evidence$/.exec(ref);
  const targetMatch = /^scene:([^#]+)#(anchor|score|camera|palette|reveal):(.+)$/.exec(ref);
  if (!audit.assert(Boolean(evidenceMatch || targetMatch), 'ref.scene-format', `${label} has an invalid scene reference`, { ref })) return;
  const contractId = (evidenceMatch ?? targetMatch)[1];
  const catalog = catalogs.get(contractId);
  if (!audit.assert(Boolean(catalog), 'ref.scene-contract', `${label} references an undeclared scene contract`, { ref })) return;
  if (evidenceMatch) {
    audit.assert(isRecord(catalog.contract.evidence), 'ref.scene-target', `${label} references missing scene evidence`, { ref });
    return;
  }
  const type = targetMatch[2];
  const targetId = targetMatch[3];
  const contract = catalog.contract;
  const idsByType = {
    anchor: (contract.syncAnchors ?? []).map((item) => item.id),
    score: (contract.score?.cues ?? []).map((item) => item.id),
    camera: (contract.shots ?? []).map((item) => item.id),
    palette: contract.palette?.id ? [contract.palette.id] : [],
    reveal: (contract.story?.revealLedger ?? []).map((item) => item.id)
  };
  audit.assert(idsByType[type].includes(targetId), 'ref.scene-target', `${label} references a missing ${type} target`, { ref });
}

function validateRef(audit, ref, catalogs, label) {
  if (typeof ref !== 'string') {
    audit.assert(false, 'ref.format', `${label} must be a string`);
  } else if (ref.startsWith('runtime:')) {
    validateRuntimeRef(audit, ref, label);
  } else if (ref.startsWith('scene:')) {
    validateSceneRef(audit, ref, catalogs, label);
  } else if (ref.startsWith('state:')) {
    validateStateRef(audit, ref, label);
  } else if (!/^milestone:.+$/.test(ref)) {
    audit.assert(false, 'ref.format', `${label} is not a supported evidence reference`, { ref });
  }
}

function sceneIdsFromRefs(refs) {
  return refs
    .filter((ref) => typeof ref === 'string' && ref.startsWith('scene:'))
    .map((ref) => /^scene:([^#]+)#/.exec(ref)?.[1])
    .filter(Boolean);
}

function validateReferences(audit, registry, catalogs) {
  for (const chapter of registry.chapters ?? []) {
    const refGroups = [
      ['entry.requirements', chapter.entry?.requirements ?? []],
      ['entry.stateRefs', chapter.entry?.stateRefs ?? []],
      ['exit.guarantees', chapter.exit?.guarantees ?? []],
      ['exit.stateRefs', chapter.exit?.stateRefs ?? []],
      ['objectiveRefs', chapter.objectiveRefs ?? []],
      ['revealRefs', chapter.revealRefs ?? []],
      ['acceptance.evidenceRefs', chapter.acceptance?.evidenceRefs ?? []],
      ...(['entry', 'exit'].flatMap((side) =>
        ['anchorRefs', 'scoreRefs', 'cameraRefs', 'paletteRefs'].map((kind) => [
          `avBoundary.${side}.${kind}`,
          chapter.avBoundary?.[side]?.[kind] ?? []
        ])
      )),
      ...((chapter.checkpoints ?? []).map((checkpoint) => [
        `checkpoints.${checkpoint.key}.evidenceRefs`,
        checkpoint.evidenceRefs ?? []
      ]))
    ];
    const allRefs = [];
    for (const [groupLabel, refs] of refGroups) {
      for (const [index, ref] of refs.entries()) {
        validateRef(audit, ref, catalogs, `${chapter.id}.${groupLabel}[${index}]`);
        allRefs.push(ref);
      }
    }

    const declaredContracts = chapter.avBoundary?.sceneContractRefs ?? [];
    for (const contractId of declaredContracts) {
      audit.assert(catalogs.has(contractId), 'scene.chapter-contract', `${chapter.id} declares unknown scene contract ${contractId}`);
      const coverage = catalogs.get(contractId)?.link?.coversBeats ?? [];
      audit.assert(
        chapter.beats.some((beat) => coverage.includes(beat)),
        'scene.chapter-scope',
        `${chapter.id} declares ${contractId}, but none of its beats are in that contract scope`
      );
    }
    for (const contractId of sceneIdsFromRefs(allRefs)) {
      audit.assert(
        declaredContracts.includes(contractId),
        'scene.chapter-declaration',
        `${chapter.id} must declare scene contract ${contractId} in avBoundary.sceneContractRefs`
      );
    }
    for (const [contractId, catalog] of catalogs) {
      if (chapter.beats.some((beat) => catalog.link.coversBeats.includes(beat))) {
        audit.assert(
          declaredContracts.includes(contractId),
          'scene.chapter-coverage',
          `${chapter.id} owns beats covered by ${contractId} and must link it at the AV boundary`
        );
      }
    }
  }
}

function parseMilestones(source) {
  const body = /export const STORY_MILESTONES\s*=\s*\{([\s\S]*?)\}\s*as const;/.exec(source)?.[1] ?? '';
  return new Map([...body.matchAll(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*:\s*'([^']+)'/gm)].map((match) => [match[1], match[2]]));
}

function parseResumeClauses(source) {
  const clauses = new Map();
  const pattern = /if\s*\(\s*hasMilestone\(STORY_MILESTONES\.([A-Za-z][A-Za-z0-9_]*)\)\s*\)\s*return\s*\{\s*chapter:\s*'([^']+)'\s*,\s*beat:\s*'([^']+)'\s*\}\s*;/g;
  for (const match of source.matchAll(pattern)) clauses.set(match[1], { chapter: match[2], beat: match[3] });
  return clauses;
}

function validateCheckpoints(audit, registry, authority) {
  const source = readFileSync(storyStatePath, 'utf8');
  const milestones = parseMilestones(source);
  const resumeClauses = parseResumeClauses(source);
  const runtimeOrder = authority.runtimeBeatOrder ?? [];
  const beatOwner = new Map();
  for (const chapter of registry.chapters ?? []) {
    for (const beat of chapter.beats ?? []) beatOwner.set(beat, chapter.id);
  }

  const checkpoints = [];
  for (const chapter of registry.chapters ?? []) {
    for (const checkpoint of chapter.checkpoints ?? []) checkpoints.push({ ...checkpoint, chapterId: chapter.id });
  }
  audit.assert(unique(checkpoints.map((checkpoint) => checkpoint.key)), 'checkpoint.unique-key', 'Checkpoint keys must be globally unique');
  audit.assert(unique(checkpoints.map((checkpoint) => checkpoint.milestone)), 'checkpoint.unique-milestone', 'Checkpoint milestones must be globally unique');

  for (const checkpoint of checkpoints) {
    audit.assert(beatOwner.get(checkpoint.beat) === checkpoint.chapterId, 'checkpoint.owner', `${checkpoint.key} beat must belong to ${checkpoint.chapterId}`);
    const beatIndex = runtimeOrder.indexOf(checkpoint.beat);
    const resumeIndex = runtimeOrder.indexOf(checkpoint.resumeBeat);
    audit.assert(beatIndex >= 0, 'checkpoint.beat', `${checkpoint.key} checkpoint beat must exist in runtimeBeatOrder`);
    audit.assert(resumeIndex >= 0, 'checkpoint.resume-beat', `${checkpoint.key} resumeBeat must exist in runtimeBeatOrder`);
    audit.assert(resumeIndex > beatIndex, 'checkpoint.resume-order', `${checkpoint.key} resumeBeat must advance beyond its checkpoint beat`);
    audit.assert(
      milestones.get(checkpoint.key) === checkpoint.milestone,
      'checkpoint.milestone-source',
      `${checkpoint.key} must exactly match STORY_MILESTONES`,
      { expected: milestones.get(checkpoint.key), actual: checkpoint.milestone }
    );
    const expectedResume = {
      chapter: checkpoint.resumeBeat === registry.terminalBeat ? 'complete' : beatOwner.get(checkpoint.resumeBeat),
      beat: checkpoint.resumeBeat
    };
    audit.assert(
      sameJson(resumeClauses.get(checkpoint.key), expectedResume),
      'checkpoint.resume-source',
      `${checkpoint.key} must exactly match storyEntryPoint()`,
      { expected: expectedResume, actual: resumeClauses.get(checkpoint.key) }
    );
  }

  const byBeat = new Map(checkpoints.map((checkpoint) => [checkpoint.beat, checkpoint]));
  audit.assert(
    Array.isArray(authority.runtimeEvidenceChain),
    'checkpoint.authority',
    'runtimeEvidenceChain must be an array'
  );
  for (const evidence of authority.runtimeEvidenceChain ?? []) {
    const checkpoint = byBeat.get(evidence.beat);
    audit.assert(Boolean(checkpoint), 'checkpoint.authority', `Runtime evidence beat ${evidence.beat} must have a registry checkpoint`);
    if (!checkpoint) continue;
    const expectedIdentity = {
      beat: evidence.beat,
      key: evidence.checkpointKey,
      milestone: evidence.checkpoint,
      resumeBeat: evidence.resumeBeat
    };
    const actualIdentity = {
      beat: checkpoint.beat,
      key: checkpoint.key,
      milestone: checkpoint.milestone,
      resumeBeat: checkpoint.resumeBeat
    };
    audit.assert(
      sameJson(actualIdentity, expectedIdentity),
      'checkpoint.authority',
      `${evidence.beat} checkpoint identity must exactly mirror runtimeEvidenceChain`,
      { expected: expectedIdentity, actual: actualIdentity }
    );
    const missingAuthorityEvidence = (evidence.evidence ?? []).filter(
      (ref) => !checkpoint.evidenceRefs.includes(ref)
    );
    audit.assert(
      missingAuthorityEvidence.length === 0,
      'checkpoint.authority',
      `${evidence.beat} checkpoint must retain every frozen runtimeEvidenceChain ref`,
      {
        required: evidence.evidence ?? [],
        actual: checkpoint.evidenceRefs,
        missingAuthorityEvidence
      }
    );
  }
}

function validateAcceptance(audit, registry) {
  for (const chapter of registry.chapters ?? []) {
    const acceptance = chapter.acceptance ?? {};
    const budgets = chapter.acceptance?.budgets ?? {};
    audit.assert(
      Number.isInteger(budgets.minimumColdRuns) && budgets.minimumColdRuns >= 3,
      'acceptance.cold-run-budget',
      `${chapter.id} must require at least three cold runs`,
      { actual: budgets.minimumColdRuns }
    );
    audit.assert(
      Number.isInteger(budgets.minimumVariantProfiles) && budgets.minimumVariantProfiles >= 4,
      'acceptance.variant-budget',
      `${chapter.id} must exercise at least four variant profiles`,
      { actual: budgets.minimumVariantProfiles }
    );
    audit.assert(
      budgets.maxOpenCriticalDefects === 0 && budgets.maxOpenHighDefects === 0,
      'acceptance.defect-budget',
      `${chapter.id} must allow zero open critical and high defects`
    );
    audit.assert(
      Number.isInteger(budgets.maxRepairLoops) && budgets.maxRepairLoops >= 1,
      'acceptance.repair-budget',
      `${chapter.id} must define at least one repair loop`
    );
    const objectiveBeats = acceptance.requiredObjectiveBeats ?? [];
    audit.assert(
      chapter.id === 'prologue' || objectiveBeats.length > 0,
      'acceptance.objective-beats',
      `${chapter.id} must name every task-bearing beat that requires visible guidance`
    );
    const variants = acceptance.requiredVariantProfiles ?? [];
    const qualityProfiles = new Set(variants.map((variant) => variant?.qualityProfile));
    audit.assert(
      ['HIGH', 'MEDIUM', 'LOW', 'POTATO'].every((profile) => qualityProfiles.has(profile)),
      'acceptance.variant-coverage',
      `${chapter.id} variants must cover HIGH, MEDIUM, LOW, and POTATO quality paths`
    );
    audit.assert(
      variants.some((variant) => variant?.deviceClass === 'desktop')
        && variants.some((variant) => variant?.deviceClass === 'mobile'),
      'acceptance.variant-coverage',
      `${chapter.id} variants must cover desktop and mobile device classes`
    );
    audit.assert(
      variants.some((variant) => variant?.reducedMotion === true)
        && variants.some((variant) => variant?.reducedMotion === false),
      'acceptance.variant-coverage',
      `${chapter.id} variants must cover reduced-motion and standard-motion preferences`
    );
    audit.assert(
      variants.some((variant) => variant?.deviceClass === 'mobile' && variant?.qualityProfile === 'POTATO'),
      'acceptance.variant-coverage',
      `${chapter.id} must exercise its lowest-quality path on a mobile viewport`
    );
    const performance = acceptance.performanceBudgets ?? {};
    audit.assert(
      Number(performance.maxEntryLoadMs) <= 60000
        && Number(performance.maxSceneReadyMs) <= 60000
        && Number(performance.maxBoundaryMs) <= 600000,
      'acceptance.performance-budget',
      `${chapter.id} loading, readiness, and boundary budgets must remain bounded by the runner wall caps`
    );
    audit.assert(
      Number(performance.minFps) >= 20
        && Number(performance.maxP95FrameTimeMs) <= 50
        && Number(performance.maxFrameGapMs) <= 1000,
      'acceptance.performance-budget',
      `${chapter.id} must enforce an interactive frame-time floor`
    );
  }
}

function validateRegistry(registry, schema, authority) {
  const audit = new Audit();
  validateSchemaDocument(audit, schema);
  if (!validateRegistryShape(audit, registry)) return audit.report();
  validateAuthority(audit, registry, authority);
  validateBeatCoverage(audit, registry, authority);
  validateAdjacency(audit, registry);
  const catalogs = loadSceneContracts(audit, registry);
  validateReferences(audit, registry, catalogs);
  validateCheckpoints(audit, registry, authority);
  validateAcceptance(audit, registry);
  return audit.report();
}

function summarizeFailures(report) {
  return report.failures.map((failure) => `${failure.code}: ${failure.message}`).join('\n');
}

function runSelfTest(registry, schema, authority) {
  const live = validateRegistry(registry, schema, authority);
  if (!live.ok) throw new Error(`Live registry must pass before self-test cases run:\n${summarizeFailures(live)}`);

  // Stable ids, not chN numbering, are the insertion contract. This focused
  // structural fixture adds an interlude and updates runtime order explicitly;
  // full story-authority evidence for a real inserted beat remains a separate gate.
  const insertionRegistry = clone(registry);
  const insertionAuthority = clone(authority);
  const insertionIndex = 3;
  const previous = insertionRegistry.chapters[insertionIndex - 1];
  const next = insertionRegistry.chapters[insertionIndex];
  const interlude = clone(next);
  interlude.id = 'interlude-echo';
  interlude.order = insertionIndex;
  interlude.beats = ['interlude-echo'];
  interlude.before = [previous.id];
  interlude.after = [next.id];
  interlude.entry = { beat: 'interlude-echo', requirements: [], stateRefs: [...previous.exit.stateRefs] };
  interlude.exit = {
    beat: 'interlude-echo',
    guarantees: [...next.entry.requirements],
    stateRefs: [...next.entry.stateRefs]
  };
  interlude.checkpoints = [];
  interlude.acceptance.requiredObjectiveBeats = ['interlude-echo'];
  previous.after = [interlude.id];
  next.before = [interlude.id];
  insertionRegistry.chapters.splice(insertionIndex, 0, interlude);
  for (const [index, chapter] of insertionRegistry.chapters.entries()) chapter.order = index;
  const authorityInsertionIndex = insertionAuthority.runtimeBeatOrder.indexOf(next.beats[0]);
  insertionAuthority.runtimeBeatOrder.splice(authorityInsertionIndex, 0, 'interlude-echo');
  const insertionAudit = new Audit();
  validateRegistryShape(insertionAudit, insertionRegistry);
  validateBeatCoverage(insertionAudit, insertionRegistry, insertionAuthority);
  validateAdjacency(insertionAudit, insertionRegistry);
  const insertionReport = insertionAudit.report();
  if (!insertionReport.ok) {
    throw new Error(`Stable interlude insertion fixture failed:\n${summarizeFailures(insertionReport)}`);
  }

  const cases = [
    {
      name: 'runtime beat drift',
      code: 'runtime.beat-order',
      mutate(value) {
        value.chapters[1].beats[1] = value.chapters[1].beats[0];
      }
    },
    {
      name: 'entry beat drift',
      code: 'chapter.entry-beat',
      mutate(value) {
        value.chapters[1].entry.beat = value.chapters[1].beats[1];
      }
    },
    {
      name: 'broken reciprocal adjacency',
      code: 'adjacency.next',
      mutate(value) {
        value.chapters[2].after = [];
      }
    },
    {
      name: 'adjacency cycle',
      code: 'adjacency.acyclic',
      mutate(value) {
        value.chapters.at(-1).after = ['prologue'];
        value.chapters[0].before = [value.chapters.at(-1).id];
      }
    },
    {
      name: 'unmet entry requirement',
      code: 'adjacency.requirements',
      mutate(value) {
        value.chapters[2].entry.requirements.push('state:contract/not-guaranteed');
      }
    },
    {
      name: 'state evidence without a runtime producer',
      code: 'ref.state-unsupported',
      mutate(value) {
        value.chapters[7].checkpoints[0].evidenceRefs[0] =
          'state:ship-restoration/warp_ready';
      }
    },
    {
      name: 'supplemental evidence drops a frozen authority ref',
      code: 'checkpoint.authority',
      mutate(value) {
        value.chapters[7].checkpoints[0].evidenceRefs =
          value.chapters[7].checkpoints[0].evidenceRefs
            .filter((ref) => ref !== 'milestone:story:route:tidegarden:online');
      }
    },
    {
      name: 'checkpoint authority drift',
      code: 'checkpoint.authority',
      mutate(value) {
        value.chapters[6].checkpoints[0].resumeBeat = 'ch7-board';
      }
    },
    {
      name: 'missing structural scene target',
      code: 'ref.scene-target',
      mutate(value) {
        value.chapters[5].avBoundary.entry.anchorRefs[0] =
          'scene:distance-between-fires@intent-v1#anchor:anc.missing';
      }
    },
    {
      name: 'cold-run budget regression',
      code: 'acceptance.cold-run-budget',
      mutate(value) {
        value.chapters[0].acceptance.budgets.minimumColdRuns = 2;
      }
    },
    {
      name: 'missing objective contract',
      code: 'schema.chapter.objective-refs',
      mutate(value) {
        value.chapters[0].objectiveRefs = [];
      }
    },
    {
      name: 'objective beat outside chapter',
      code: 'schema.chapter.required-objectives',
      mutate(value) {
        value.chapters[3].acceptance.requiredObjectiveBeats.push('ch4-vigil');
      }
    },
    {
      name: 'variant matrix regression',
      code: 'acceptance.variant-coverage',
      mutate(value) {
        value.chapters[3].acceptance.requiredVariantProfiles = value.chapters[3].acceptance.requiredVariantProfiles
          .filter((variant) => variant.qualityProfile !== 'POTATO');
      }
    },
    {
      name: 'performance floor regression',
      code: 'acceptance.performance-budget',
      mutate(value) {
        value.chapters[3].acceptance.performanceBudgets.minFps = 1;
      }
    }
  ];

  const results = [];
  for (const testCase of cases) {
    const candidate = clone(registry);
    testCase.mutate(candidate);
    const report = validateRegistry(candidate, schema, authority);
    const observedCodes = [...new Set(report.failures.map((failure) => failure.code))];
    if (report.ok || !observedCodes.includes(testCase.code)) {
      throw new Error(
        `Self-test "${testCase.name}" expected ${testCase.code}; observed ${observedCodes.join(', ') || 'no failures'}`
      );
    }
    results.push({ name: testCase.name, expectedCode: testCase.code, observedCodes });
  }
  const certification = certifyChapterSceneAuthority({
    registry,
    structuralReport: live,
    chapterId: 'ch5',
    repoRoot
  });
  const certificationCodes = [...new Set(certification.failures.map((failure) => failure.code))];
  const requiredCertificationCodes = [
    'scene.certification.human-approval',
    'scene.certification.quality-report',
    'scene.certification.actual-spawn',
    'scene.certification.actual-water-traversal'
  ];
  if (certification.certified || !requiredCertificationCodes.every((code) => certificationCodes.includes(code))) {
    throw new Error(
      `Live stale/template authority rejection regressed; required ${requiredCertificationCodes.join(', ')}, observed ${certificationCodes.join(', ') || 'no failures'}`
    );
  }
  return {
    live,
    results: [
      ...results,
      {
        name: 'stable interlude insertion',
        expectedCode: null,
        observedCodes: [],
        insertedId: interlude.id,
        checks: insertionReport.checks
      }
    ],
    certification: {
      chapterId: certification.chapterId,
      certified: certification.certified,
      requiredFailureCodes: requiredCertificationCodes,
      observedFailureCodes: certificationCodes
    }
  };
}

function printReport(report) {
  if (report.ok) {
    console.log(`Chapter registry gate passed: ${report.checks} checks`);
  } else {
    console.error(`Chapter registry gate failed: ${report.failures.length} failure(s) across ${report.checks} checks`);
    console.error(summarizeFailures(report));
  }
}

function parseCliArgs(argv) {
  const options = { json: false, selfTest: false, certify: false, chapter: null };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--json') options.json = true;
    else if (token === '--self-test') options.selfTest = true;
    else if (token === '--certify') options.certify = true;
    else if (token === '--chapter') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--chapter requires a chapter id');
      options.chapter = value;
      index += 1;
    } else if (token.startsWith('--chapter=')) {
      options.chapter = token.slice('--chapter='.length);
      if (!options.chapter) throw new Error('--chapter requires a chapter id');
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
  if (options.certify && options.selfTest) throw new Error('--certify and --self-test cannot be combined');
  if (options.certify && !options.chapter) throw new Error('--chapter is required with --certify');
  if (!options.certify && options.chapter) throw new Error('--chapter is only valid with --certify');
  return options;
}

function main() {
  let options;
  try {
    options = parseCliArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
    return;
  }

  const registry = readJson(registryPath);
  const schema = readJson(schemaPath);
  const authority = readJson(resolve(repoRoot, registry.runtimeAuthorityRef));

  if (options.selfTest) {
    const selfTest = runSelfTest(registry, schema, authority);
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            schema: 'paravoxia.chapterRegistrySelfTestReport.v1',
            ok: true,
            live: selfTest.live,
            cases: selfTest.results,
            certification: selfTest.certification
          },
          null,
          2
        )
      );
    } else {
      console.log(
        `Chapter registry self-test passed: live ${selfTest.live.checks} checks; ${selfTest.results.length} invalid cases rejected; stale ch5 certification authority rejected`
      );
    }
    return;
  }

  const report = validateRegistry(registry, schema, authority);
  if (options.certify) {
    const certification = certifyChapterSceneAuthority({
      registry,
      structuralReport: report,
      chapterId: options.chapter,
      repoRoot
    });
    // Certification mode is deliberately machine-readable even without --json;
    // the chapter runner records this exact authority decision as preflight evidence.
    console.log(JSON.stringify(certification, null, 2));
    if (!certification.certified) process.exitCode = 1;
    return;
  }
  if (options.json) console.log(JSON.stringify(report, null, 2));
  else printReport(report);
  if (!report.ok) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(`Chapter registry gate crashed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 2;
}

export { validateRegistry };
