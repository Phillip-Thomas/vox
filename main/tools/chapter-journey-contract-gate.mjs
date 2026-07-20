#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..', '..');

export const DEFAULT_MANIFEST = path.join(REPO_ROOT, 'main', 'chapter-journey-contract.json');
export const DEFAULT_REGISTRY = path.join(REPO_ROOT, 'main', 'chapter-registry.json');
export const DEFAULT_SCHEMA = path.join(
  REPO_ROOT,
  'docs',
  'architecture',
  'workflow-orchestration',
  'schemas',
  'paravoxia-chapter-journey-contract.schema.json'
);

export const REQUIRED_LANE_IDS = Object.freeze([
  'continuous-manual',
  'movie',
  'reload-continue',
  'direct-entry-diagnostic',
  'recovery-detour',
  'variants'
]);

const REQUIRED_REVIEW_OWNERS = Object.freeze(['story', 'score', 'cinematography', 'ux']);
const REQUIRED_ESCAPED_DEFECT_IDS = Object.freeze([
  'w7744-departure-reload',
  'persistent-scar-prompt-arbitration',
  'voyage-name-keyboard-focus',
  'ch7-hover-relocation',
  'ch1-nav-water-strand'
]);

const LANE_SEMANTICS = Object.freeze({
  'continuous-manual': {
    certificationRole: 'blocking',
    execution: 'headed-trusted-input',
    assertions: ['predecessor-entry', 'trusted-manual-input', 'successor-handoff', 'no-rescue']
  },
  movie: {
    certificationRole: 'blocking',
    execution: 'automated-movie',
    assertions: ['objective-parity', 'interaction-parity', 'successor-handoff', 'no-rescue']
  },
  'reload-continue': {
    certificationRole: 'blocking',
    execution: 'planned-reload',
    assertions: ['every-registered-checkpoint', 'declared-transition-seams', 'first-frame-postconditions', 'no-rescue']
  },
  'direct-entry-diagnostic': {
    certificationRole: 'diagnostic',
    execution: 'direct-entry',
    assertions: ['entry-state-initialized', 'objective-visible', 'diagnostic-only']
  },
  'recovery-detour': {
    certificationRole: 'blocking',
    execution: 'scripted-adversarial',
    assertions: ['minimum-one-detour', 'no-false-receipt', 'no-teleport-rescue', 'eventual-recovery']
  },
  variants: {
    certificationRole: 'blocking',
    execution: 'variant-matrix',
    assertions: ['exact-profile-projection', 'guidance-readable', 'interaction-reachable', 'no-layout-occlusion']
  }
});

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function orderedUnique(values) {
  return [...new Set(values)];
}

function asStringArray(value) {
  return Array.isArray(value) && value.every(item => typeof item === 'string') ? value : [];
}

function exactArray(actual, expected) {
  return Array.isArray(actual)
    && Array.isArray(expected)
    && actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

function includesAll(actual, expected) {
  return Array.isArray(actual) && expected.every(value => actual.includes(value));
}

function meaningfulText(value) {
  if (typeof value !== 'string') return false;
  const normalized = value.trim();
  if (normalized.length < 20 || normalized.split(/\s+/).length < 4) return false;
  return !/^(?:todo|tbd|placeholder|unknown|n\/?a)[.! ]*$/i.test(normalized);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function issue(issues, code, location, message) {
  issues.push({ code, path: location, message });
}

function exactProjection(issues, code, location, actual, expected) {
  if (exactArray(actual, expected)) return;
  issue(
    issues,
    code,
    location,
    `Must equal the registry projection exactly and in order. Expected ${JSON.stringify(expected)}; received ${JSON.stringify(actual)}.`
  );
}

function signedAnchorIdsFromRefs(refs) {
  return asStringArray(refs).flatMap(ref => {
    const match = ref.match(/^scene:[^#]+#anchor:(.+)$/);
    return match?.[1] ? [match[1]] : [];
  });
}

/**
 * Produce the only projection a journey contract may duplicate from a chapter
 * registry row. Ordered equality is intentional: a superset is drift, not
 * extra safety, because it can mask that the executable registry changed.
 */
export function buildRegistryProjection(chapter) {
  return {
    requiredObjectiveBeats: asStringArray(chapter?.acceptance?.requiredObjectiveBeats),
    checkpointReceipts: orderedUnique(
      (Array.isArray(chapter?.checkpoints) ? chapter.checkpoints : [])
        .flatMap(checkpoint => asStringArray(checkpoint?.evidenceRefs))
    ),
    requiredSignedAnchorIds: orderedUnique([
      ...signedAnchorIdsFromRefs(chapter?.avBoundary?.entry?.anchorRefs),
      ...signedAnchorIdsFromRefs(chapter?.avBoundary?.exit?.anchorRefs)
    ]),
    variantProfileIds: (Array.isArray(chapter?.acceptance?.requiredVariantProfiles)
      ? chapter.acceptance.requiredVariantProfiles
      : [])
      .map(profile => profile?.id)
      .filter(id => typeof id === 'string' && id.length > 0)
  };
}

function validateSchemaAuthority(schemaDocument, issues) {
  if (!isObject(schemaDocument)) {
    issue(issues, 'schema.document', '$schemaDocument', 'The JSON Schema document must be an object.');
    return;
  }
  if (schemaDocument.$schema !== 'https://json-schema.org/draft/2020-12/schema') {
    issue(issues, 'schema.draft', '$schemaDocument.$schema', 'The journey schema must use JSON Schema draft 2020-12.');
  }
  if (schemaDocument?.properties?.schema?.const !== 'paravoxia.chapterJourneyContract.v1') {
    issue(issues, 'schema.manifest-identity', '$schemaDocument.properties.schema.const', 'The schema must bind the v1 manifest identity.');
  }
  if (schemaDocument?.properties?.registryRef?.const !== 'main/chapter-registry.json') {
    issue(issues, 'schema.registry-authority', '$schemaDocument.properties.registryRef.const', 'The schema must bind the canonical chapter registry.');
  }
  for (const definition of [
    'chapter',
    'objective',
    'placementFitness',
    'lifecycleContract',
    'interactionContract',
    'inputContract',
    'placementException'
  ]) {
    if (!isObject(schemaDocument?.$defs?.[definition])) {
      issue(issues, 'schema.required-definition', `$schemaDocument.$defs.${definition}`, `Missing required schema definition ${definition}.`);
    }
  }
}

function validatePlacementFitness(placement, location, blocking, issues) {
  if (!isObject(placement)) {
    issue(issues, 'objective.placement.required', location, 'Every objective or capability needs an explicit placement-fitness record.');
    return;
  }
  for (const field of ['whyNow', 'capability', 'storyFunction', 'spatialTolerance', 'recovery']) {
    if (!meaningfulText(placement[field])) {
      issue(issues, `objective.placement.${field}`, `${location}.${field}`, `${field} must be substantive and cannot be a placeholder.`);
    }
  }
  const timing = placement.expectedPlayerSeconds;
  if (!isObject(timing)
    || !Number.isFinite(timing.min)
    || !Number.isFinite(timing.max)
    || timing.min < 0
    || timing.max <= timing.min) {
    issue(issues, 'objective.placement.expected-time', `${location}.expectedPlayerSeconds`, 'Expected player time must have finite min >= 0 and max > min.');
  }
  if (placement.blocking !== blocking) {
    issue(
      issues,
      blocking ? 'objective.placement.mandatory-blocking' : 'objective.placement.optional-nonblocking',
      `${location}.blocking`,
      blocking ? 'A mandatory objective must be blocking.' : 'An optional capability must never block progression.'
    );
  }
  if (!exactArray(placement.reviewOwners, REQUIRED_REVIEW_OWNERS)) {
    issue(
      issues,
      'objective.placement.review-owners',
      `${location}.reviewOwners`,
      `Placement requires the exact Story, Score, Cinematography, and UX review projection ${JSON.stringify(REQUIRED_REVIEW_OWNERS)}.`
    );
  }
}

function validateObjective(objective, chapter, objectiveIndex, issues) {
  const base = `chapters[${chapter.id}].objectives[${objectiveIndex}]`;
  if (!isObject(objective)) {
    issue(issues, 'objective.object', base, 'Objective contract must be an object.');
    return;
  }
  const expectedId = `objective:${chapter.id}:${objective.beat}`;
  if (objective.id !== expectedId) {
    issue(issues, 'objective.id', `${base}.id`, `Objective id must be ${expectedId}.`);
  }
  if (objective.criticality !== 'mandatory') {
    issue(issues, 'objective.criticality', `${base}.criticality`, 'Every registry-required objective beat is mandatory.');
  }
  if (!asStringArray(chapter.beats).includes(objective.beat)) {
    issue(issues, 'objective.beat.registered', `${base}.beat`, `Beat ${String(objective.beat)} is not registered in chapter ${chapter.id}.`);
  }
  const interaction = objective.interaction;
  if (!isObject(interaction)) {
    issue(issues, 'objective.interaction.required', `${base}.interaction`, 'Mandatory objectives require an interaction contract.');
  } else {
    if (!meaningfulText(interaction.intent)) {
      issue(issues, 'objective.interaction.intent', `${base}.interaction.intent`, 'Interaction intent must be substantive.');
    }
    if (!Array.isArray(interaction.completionEvidenceRefs)
      || interaction.completionEvidenceRefs.length === 0
      || !interaction.completionEvidenceRefs.every(ref => typeof ref === 'string' && /^(beat|milestone|state|anchor|entity|observation):.+$/.test(ref))
      || orderedUnique(interaction.completionEvidenceRefs).length !== interaction.completionEvidenceRefs.length) {
      issue(issues, 'objective.interaction.completion-evidence', `${base}.interaction.completionEvidenceRefs`, 'At least one unique executable completion evidence ref is required.');
    }
    if (!Array.isArray(interaction.forbiddenInteractionIds)
      || orderedUnique(interaction.forbiddenInteractionIds).length !== interaction.forbiddenInteractionIds.length) {
      issue(issues, 'objective.interaction.forbidden', `${base}.interaction.forbiddenInteractionIds`, 'Forbidden interaction ids must be an explicit unique array, even when empty.');
    }
    if (!Number.isInteger(interaction.feedbackWithinMs)
      || interaction.feedbackWithinMs < 1
      || interaction.feedbackWithinMs > 5000) {
      issue(issues, 'objective.interaction.feedback', `${base}.interaction.feedbackWithinMs`, 'Feedback deadline must be an integer from 1 through 5000 ms.');
    }
  }
  const postconditions = objective.postconditions;
  if (!isObject(postconditions)
    || !Number.isInteger(postconditions.clearPromptWithinFrames)
    || postconditions.clearPromptWithinFrames < 1
    || postconditions.clearPromptWithinFrames > 5
    || !Number.isInteger(postconditions.clearMarkerWithinFrames)
    || postconditions.clearMarkerWithinFrames < 1
    || postconditions.clearMarkerWithinFrames > 5
    || postconditions.mustNotReappearWithoutStateChange !== true) {
    issue(issues, 'objective.postconditions', `${base}.postconditions`, 'Prompt and marker cleanup must be bounded to 1-5 frames and stale objectives must not reappear.');
  }
  validatePlacementFitness(objective.placementFitness, `${base}.placementFitness`, true, issues);
}

function validateLifecycleContract(contract, chapter, index, issues) {
  const base = `chapters[${chapter.id}].lifecycleContracts[${index}]`;
  if (!isObject(contract)) {
    issue(issues, 'lifecycle.object', base, 'Lifecycle contract must be an object.');
    return;
  }
  if (contract.type !== 'entity-lifecycle') {
    issue(issues, 'lifecycle.type', `${base}.type`, 'Lifecycle contract type must be entity-lifecycle.');
  }
  if (!chapter.beats.includes(contract.beat)) {
    issue(issues, 'lifecycle.beat', `${base}.beat`, 'Lifecycle beat must belong to its chapter.');
  }
  if (typeof contract.triggerRef !== 'string' || !/^(beat|milestone|state|anchor|entity|observation):.+$/.test(contract.triggerRef)) {
    issue(issues, 'lifecycle.trigger', `${base}.triggerRef`, 'Lifecycle trigger must be an executable evidence ref.');
  }
  if (!isObject(contract.eventually)
    || !Number.isInteger(contract.eventually.withinMs)
    || contract.eventually.withinMs < 1
    || contract.eventually.withinMs > 30000
    || !Array.isArray(contract.eventually.assertions)
    || contract.eventually.assertions.length === 0) {
    issue(issues, 'lifecycle.eventually', `${base}.eventually`, 'Lifecycle must declare bounded eventual assertions.');
  }
  for (const field of ['alwaysAfter', 'neverAfter']) {
    if (!Array.isArray(contract[field]) || contract[field].length === 0) {
      issue(issues, `lifecycle.${field}`, `${base}.${field}`, `${field} must declare at least one temporal assertion.`);
    }
  }
  if (!isObject(contract.resume)
    || contract.resume.required !== true
    || !Array.isArray(contract.resume.assertOnFirstFrame)
    || contract.resume.assertOnFirstFrame.length === 0
    || typeof contract.resume.continueToBeat !== 'string'
    || contract.resume.forbidRescue !== true) {
    issue(issues, 'lifecycle.resume', `${base}.resume`, 'Lifecycle seams require a planned reload, first-frame assertions, continuation beat, and no-rescue rule.');
  }
}

function validateInteractionContract(contract, chapter, index, issues) {
  const base = `chapters[${chapter.id}].interactionContracts[${index}]`;
  if (!isObject(contract)) {
    issue(issues, 'interaction.object', base, 'Interaction contract must be an object.');
    return;
  }
  if (contract.type !== 'prompt-arbitration') {
    issue(issues, 'interaction.type', `${base}.type`, 'Interaction contract type must be prompt-arbitration.');
  }
  if (!chapter.beats.includes(contract.beat)) {
    issue(issues, 'interaction.beat', `${base}.beat`, 'Interaction beat must belong to its chapter.');
  }
  if (!Array.isArray(contract.requiredInteractionIds) || contract.requiredInteractionIds.length === 0) {
    issue(issues, 'interaction.required-ids', `${base}.requiredInteractionIds`, 'Prompt arbitration needs at least one required interaction owner.');
  }
  if (typeof contract.optionalInteractionId !== 'string' || contract.optionalInteractionId.length === 0) {
    issue(issues, 'interaction.optional-id', `${base}.optionalInteractionId`, 'Prompt arbitration needs the optional interaction id.');
  }
  if (!Array.isArray(contract.successEvidenceRefs) || contract.successEvidenceRefs.length === 0) {
    issue(issues, 'interaction.effect', `${base}.successEvidenceRefs`, 'A visible interaction must declare an observable effect.');
  }
  const rules = contract.rules;
  if (!isObject(rules)
    || rules.requiredWins !== true
    || rules.suppressWhenAlreadyRecorded !== true
    || rules.maxVisiblePrompts !== 1
    || rules.noOpForbidden !== true
    || !Number.isInteger(rules.feedbackWithinMs)
    || rules.feedbackWithinMs < 1
    || rules.feedbackWithinMs > 5000) {
    issue(issues, 'interaction.prompt-rules', `${base}.rules`, 'Required work must own the sole prompt; recorded or no-op optional prompts are forbidden.');
  }
}

function validateInputContract(contract, chapter, index, issues) {
  const base = `chapters[${chapter.id}].inputContracts[${index}]`;
  if (!isObject(contract)) {
    issue(issues, 'input.object', base, 'Input contract must be an object.');
    return;
  }
  if (!chapter.beats.includes(contract.beat)) {
    issue(issues, 'input.beat', `${base}.beat`, 'Input beat must belong to its chapter.');
  }
  if (typeof contract.selector !== 'string' || contract.selector.length < 3) {
    issue(issues, 'input.selector', `${base}.selector`, 'Input contract needs a stable visible selector.');
  }
  if (contract.controlKind !== 'native-text-input') {
    issue(issues, 'input.native-editable', `${base}.controlKind`, 'Visible naming controls must be native editable inputs.');
  }
  if (typeof contract.testValue !== 'string' || contract.testValue.length === 0) {
    issue(issues, 'input.test-value', `${base}.testValue`, 'Input contract needs a non-empty typed test value.');
  }
  if (contract.submitKey !== 'Enter') {
    issue(issues, 'input.submit-key', `${base}.submitKey`, 'Voyage naming submits with Enter.');
  }
  if (typeof contract.completionEvidenceRef !== 'string' || !contract.completionEvidenceRef.includes(contract.testValue ?? '')) {
    issue(issues, 'input.completion-evidence', `${base}.completionEvidenceRef`, 'Completion evidence must preserve the typed value.');
  }
  const assertions = contract.assertions;
  if (!isObject(assertions)
    || ['focusable', 'keyboardChangesValue', 'globalShortcutsSuppressed', 'submitExactlyOnce', 'valuePersistsAfterSubmit']
      .some(key => assertions[key] !== true)) {
    issue(issues, 'input.assertions', `${base}.assertions`, 'Input must prove focus, typing, shortcut isolation, exactly-once submit, and persistence.');
  }
}

function validateOptionalCapability(capability, chapter, index, issues) {
  const base = `chapters[${chapter.id}].optionalCapabilities[${index}]`;
  if (!isObject(capability)) {
    issue(issues, 'capability.object', base, 'Optional capability must be an object.');
    return;
  }
  if (capability.criticality !== 'optional') {
    issue(issues, 'capability.criticality', `${base}.criticality`, 'Optional capability criticality must remain optional.');
  }
  if (!chapter.beats.includes(capability.beat)) {
    issue(issues, 'capability.beat', `${base}.beat`, 'Optional capability beat must belong to its chapter.');
  }
  if (!Array.isArray(capability.completionEvidenceRefs) || capability.completionEvidenceRefs.length === 0) {
    issue(issues, 'capability.evidence', `${base}.completionEvidenceRefs`, 'Optional capability needs observable evidence without becoming progression authority.');
  }
  validatePlacementFitness(capability.placementFitness, `${base}.placementFitness`, false, issues);
}

function allContractEntries(manifest) {
  if (!Array.isArray(manifest?.chapters)) return [];
  return manifest.chapters.flatMap(chapter => [
    ...asArray(chapter?.lifecycleContracts),
    ...asArray(chapter?.interactionContracts),
    ...asArray(chapter?.inputContracts),
    ...asArray(chapter?.optionalCapabilities),
    ...asArray(chapter?.placementExceptions)
  ]);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function validateEscapedDefects(manifest, issues) {
  const chapters = new Map(asArray(manifest?.chapters).map(chapter => [chapter.id, chapter]));
  const entries = allContractEntries(manifest);
  const entryById = new Map();
  for (const entry of entries) {
    if (!isObject(entry) || typeof entry.id !== 'string') continue;
    if (entryById.has(entry.id)) {
      issue(issues, 'contract.id.unique', `contracts.${entry.id}`, `Contract id ${entry.id} is duplicated.`);
    }
    entryById.set(entry.id, entry);
  }

  const coverage = asArray(manifest?.escapedDefectCoverage);
  const coverageIds = coverage.map(entry => entry?.id);
  for (const requiredId of REQUIRED_ESCAPED_DEFECT_IDS) {
    if (!coverageIds.includes(requiredId)) {
      issue(issues, 'escaped.coverage.required', 'escapedDefectCoverage', `Missing escaped-defect coverage ${requiredId}.`);
    }
  }
  if (orderedUnique(coverageIds).length !== coverageIds.length) {
    issue(issues, 'escaped.coverage.unique', 'escapedDefectCoverage', 'Escaped-defect coverage ids must be unique.');
  }
  for (const [index, entry] of coverage.entries()) {
    const base = `escapedDefectCoverage[${index}]`;
    if (!isObject(entry)) {
      issue(issues, 'escaped.coverage.object', base, 'Coverage entry must be an object.');
      continue;
    }
    if (!Array.isArray(entry.contractRefs) || entry.contractRefs.length === 0) {
      issue(issues, 'escaped.coverage.contract-refs', `${base}.contractRefs`, 'Coverage needs at least one executable contract reference.');
    } else {
      for (const ref of entry.contractRefs) {
        if (!entryById.has(ref)) {
          issue(issues, 'escaped.coverage.unresolved-ref', `${base}.contractRefs`, `Contract ref ${ref} does not resolve.`);
        }
      }
    }
    if (!Array.isArray(entry.requiredLaneIds)
      || entry.requiredLaneIds.length === 0
      || entry.requiredLaneIds.some(id => !REQUIRED_LANE_IDS.includes(id))) {
      issue(issues, 'escaped.coverage.lanes', `${base}.requiredLaneIds`, 'Coverage lane refs must resolve to required journey lanes.');
    }
    if (!Array.isArray(entry.failureModes)
      || entry.failureModes.length === 0
      || entry.failureModes.some(mode => !meaningfulText(mode))) {
      issue(issues, 'escaped.coverage.failure-modes', `${base}.failureModes`, 'Coverage must state the player-visible failures it prevents.');
    }
  }

  const worker = entryById.get('lifecycle:w7744-departure-reload');
  const workerEventually = [
    'entity:actor:w7744/mounted=false',
    'entity:actor:w7744/visible=false',
    'entity:prop:field-pack/mounted=true',
    'entity:prop:field-pack/visible=true'
  ];
  if (!worker
    || worker.triggerRef !== 'milestone:story:a4:field-pack-dropped'
    || !includesAll(worker.eventually?.assertions, workerEventually)
    || !includesAll(worker.alwaysAfter, ['entity:actor:w7744/mounted=false', 'entity:actor:w7744/visible=false', 'entity:prop:field-pack/mounted=true'])
    || !includesAll(worker.neverAfter, ['entity:actor:w7744/mounted=true', 'entity:actor:w7744/visible=true'])) {
    issue(issues, 'escaped.w7744.temporal', 'contracts.lifecycle:w7744-departure-reload', 'W-7744 must eventually leave, remain absent, never remount, and leave the field pack rendered.');
  }
  if (!worker?.resume?.required
    || !includesAll(worker.resume.assertOnFirstFrame, workerEventually)
    || worker.resume.continueToBeat !== 'ch5-maw'
    || worker.resume.forbidRescue !== true) {
    issue(issues, 'escaped.w7744.reload', 'contracts.lifecycle:w7744-departure-reload.resume', 'The field-pack transition needs a first-frame reload assertion and rescue-free continuation to ch5-maw.');
  }

  const scar = entryById.get('interaction:persistent-scar-arbitration');
  if (!scar
    || scar.beat !== 'ch7-reconstruct'
    || !scar.requiredInteractionIds?.includes('story-ship-repair')
    || scar.optionalInteractionId !== 'story-wreck-scar-attend'
    || !Array.isArray(scar.successEvidenceRefs)
    || scar.successEvidenceRefs.length === 0
    || scar.rules?.requiredWins !== true
    || scar.rules?.suppressWhenAlreadyRecorded !== true
    || scar.rules?.maxVisiblePrompts !== 1
    || scar.rules?.noOpForbidden !== true) {
    issue(issues, 'escaped.scar.arbitration', 'contracts.interaction:persistent-scar-arbitration', 'Required repair must defeat the optional scar prompt, and the scar prompt must record an effect once then disappear.');
  }

  const voyageInput = entryById.get('input:voyage-worker-name');
  if (!voyageInput
    || voyageInput.beat !== 'voyage'
    || voyageInput.selector !== '[data-voyage-worker-name-input="true"]'
    || voyageInput.controlKind !== 'native-text-input'
    || voyageInput.testValue !== 'sdgsdg'
    || voyageInput.submitKey !== 'Enter'
    || Object.values(voyageInput.assertions ?? {}).some(value => value !== true)) {
    issue(issues, 'escaped.voyage.input', 'contracts.input:voyage-worker-name', 'Voyage naming must prove native focus, exact typing, shortcut isolation, exactly-once Enter, and persisted value.');
  }

  const hoverPlacement = entryById.get('placement:ch7-hover-relocation');
  const hoverCapability = entryById.get('capability:tidegarden-aerial-site-survey');
  const forbiddenHoverRefs = [
    'milestone:story:reconstruct:first-legal-hover-physical',
    'milestone:story:reconstruct:first-hover-grounded-return',
    'anchor:anc.reconstruct.first-hover'
  ];
  if (!hoverPlacement
    || hoverPlacement.formerBeat !== 'ch7-reconstruct'
    || hoverPlacement.disposition !== 'relocated-optional'
    || hoverPlacement.capabilityId !== 'capability:tidegarden-aerial-site-survey'
    || !includesAll(hoverPlacement.forbiddenMandatoryEvidenceRefs, forbiddenHoverRefs)
    || hoverPlacement.destination?.chapterId !== 'ch9'
    || hoverPlacement.destination?.beat !== 'ch9-settle'
    || hoverPlacement.destination?.blocking !== false) {
    issue(issues, 'escaped.hover.placement', 'contracts.placement:ch7-hover-relocation', 'Ch7 hover must be explicitly relocated to an optional, nonblocking Tidegarden settlement capability.');
  }
  if (!hoverCapability
    || hoverCapability.beat !== 'ch9-settle'
    || hoverCapability.criticality !== 'optional'
    || hoverCapability.placementFitness?.blocking !== false
    || !hoverCapability.completionEvidenceRefs?.includes('milestone:story:tidegarden:aerial-site-survey')) {
    issue(issues, 'escaped.hover.destination', 'contracts.capability:tidegarden-aerial-site-survey', 'Tidegarden aerial survey must exist as optional, nonblocking accomplishment evidence.');
  }
  const ch7 = chapters.get('ch7');
  const ch7MandatoryEvidence = asArray(ch7?.objectives)
    .flatMap(objective => asArray(objective?.interaction?.completionEvidenceRefs));
  if (forbiddenHoverRefs.some(ref => ch7MandatoryEvidence.includes(ref))
    || ch7?.registryProjection?.requiredSignedAnchorIds?.includes('anc.reconstruct.first-hover')) {
    issue(issues, 'escaped.hover.ch7-forbidden', 'chapters[ch7]', 'No first-hover or grounded-return evidence may re-enter Ch7 mandatory objectives or signed-anchor projection.');
  }
}

/** Validate the manifest, its exact registry projection, and semantic contracts. */
export function validateJourneyContract(manifest, registry, schemaDocument = null) {
  const issues = [];
  if (schemaDocument !== null) validateSchemaAuthority(schemaDocument, issues);

  if (!isObject(registry) || registry.schema !== 'paravoxia.chapterRegistry.v1' || !Array.isArray(registry.chapters)) {
    issue(issues, 'registry.authority', '$registry', 'Registry must be a paravoxia.chapterRegistry.v1 document with chapters.');
  }
  if (!isObject(manifest)) {
    issue(issues, 'manifest.object', '$manifest', 'Journey contract manifest must be an object.');
    return { ok: false, issues, summary: { chapters: 0, objectives: 0, contracts: 0 } };
  }
  if (manifest.schema !== 'paravoxia.chapterJourneyContract.v1') {
    issue(issues, 'manifest.schema', 'schema', 'Manifest schema must be paravoxia.chapterJourneyContract.v1.');
  }
  if (manifest.registryRef !== 'main/chapter-registry.json') {
    issue(issues, 'manifest.registry-ref', 'registryRef', 'Manifest must project the canonical main/chapter-registry.json authority.');
  }
  if (manifest.schemaRef !== 'docs/architecture/workflow-orchestration/schemas/paravoxia-chapter-journey-contract.schema.json') {
    issue(issues, 'manifest.schema-ref', 'schemaRef', 'Manifest must cite the canonical journey contract schema.');
  }

  exactProjection(issues, 'lanes.required.exact', 'requiredLaneIds', manifest.requiredLaneIds, REQUIRED_LANE_IDS);
  const laneDefinitions = asArray(manifest.laneDefinitions);
  exactProjection(
    issues,
    'lanes.definitions.exact',
    'laneDefinitions[].id',
    laneDefinitions.map(lane => lane?.id),
    REQUIRED_LANE_IDS
  );
  for (const lane of laneDefinitions) {
    if (!isObject(lane) || !LANE_SEMANTICS[lane.id]) continue;
    const expected = LANE_SEMANTICS[lane.id];
    if (lane.certificationRole !== expected.certificationRole || lane.execution !== expected.execution) {
      issue(issues, 'lanes.semantic-role', `laneDefinitions[${lane.id}]`, `${lane.id} must use ${expected.certificationRole}/${expected.execution}.`);
    }
    if (!meaningfulText(lane.policy)) {
      issue(issues, 'lanes.policy', `laneDefinitions[${lane.id}].policy`, 'Lane policy must be substantive.');
    }
    if (!exactArray(lane.assertions, expected.assertions)) {
      issue(issues, 'lanes.assertions.exact', `laneDefinitions[${lane.id}].assertions`, `${lane.id} assertions must remain exact and ordered.`);
    }
  }

  const registryChapters = asArray(registry?.chapters);
  const manifestChapters = asArray(manifest.chapters);
  exactProjection(
    issues,
    'manifest.chapter-order.exact',
    'chapters[].id',
    manifestChapters.map(chapter => chapter?.id),
    registryChapters.map(chapter => chapter?.id)
  );
  const manifestIds = manifestChapters.map(chapter => chapter?.id);
  if (orderedUnique(manifestIds).length !== manifestIds.length) {
    issue(issues, 'manifest.chapter-id.unique', 'chapters[].id', 'Chapter contract ids must be unique.');
  }

  for (const [index, registryChapter] of registryChapters.entries()) {
    const chapter = manifestChapters[index];
    if (!isObject(chapter) || chapter.id !== registryChapter.id) continue;
    const base = `chapters[${chapter.id}]`;
    exactProjection(issues, 'continuity.before.exact', `${base}.continuity.before`, chapter.continuity?.before, asStringArray(registryChapter.before));
    exactProjection(issues, 'continuity.after.exact', `${base}.continuity.after`, chapter.continuity?.after, asStringArray(registryChapter.after));
    exactProjection(issues, 'lanes.chapter.exact', `${base}.requiredLaneIds`, chapter.requiredLaneIds, REQUIRED_LANE_IDS);

    const projection = buildRegistryProjection(registryChapter);
    exactProjection(
      issues,
      'projection.objectives.exact',
      `${base}.registryProjection.requiredObjectiveBeats`,
      chapter.registryProjection?.requiredObjectiveBeats,
      projection.requiredObjectiveBeats
    );
    exactProjection(
      issues,
      'projection.checkpoint-receipts.exact',
      `${base}.registryProjection.checkpointReceipts`,
      chapter.registryProjection?.checkpointReceipts,
      projection.checkpointReceipts
    );
    exactProjection(
      issues,
      'projection.signed-anchors.exact',
      `${base}.registryProjection.requiredSignedAnchorIds`,
      chapter.registryProjection?.requiredSignedAnchorIds,
      projection.requiredSignedAnchorIds
    );
    exactProjection(
      issues,
      'projection.variants.exact',
      `${base}.registryProjection.variantProfileIds`,
      chapter.registryProjection?.variantProfileIds,
      projection.variantProfileIds
    );

    const chapterForValidation = { ...registryChapter, id: chapter.id };
    const objectives = asArray(chapter.objectives);
    exactProjection(
      issues,
      'objective.coverage.exact',
      `${base}.objectives[].beat`,
      objectives.map(objective => objective?.beat),
      projection.requiredObjectiveBeats
    );
    objectives.forEach((objective, objectiveIndex) => validateObjective(objective, chapterForValidation, objectiveIndex, issues));

    for (const field of ['lifecycleContracts', 'interactionContracts', 'inputContracts', 'optionalCapabilities', 'placementExceptions']) {
      if (!Array.isArray(chapter[field])) {
        issue(issues, 'chapter.contract-array', `${base}.${field}`, `${field} must be explicitly declared, even when empty.`);
      }
    }
    asArray(chapter.lifecycleContracts).forEach((contract, contractIndex) => validateLifecycleContract(contract, chapterForValidation, contractIndex, issues));
    asArray(chapter.interactionContracts).forEach((contract, contractIndex) => validateInteractionContract(contract, chapterForValidation, contractIndex, issues));
    asArray(chapter.inputContracts).forEach((contract, contractIndex) => validateInputContract(contract, chapterForValidation, contractIndex, issues));
    asArray(chapter.optionalCapabilities).forEach((capability, capabilityIndex) => validateOptionalCapability(capability, chapterForValidation, capabilityIndex, issues));
  }

  validateEscapedDefects(manifest, issues);

  return {
    ok: issues.length === 0,
    issues,
    summary: {
      chapters: manifestChapters.length,
      objectives: manifestChapters.reduce((sum, chapter) => sum + asArray(chapter?.objectives).length, 0),
      lifecycleContracts: manifestChapters.reduce((sum, chapter) => sum + asArray(chapter?.lifecycleContracts).length, 0),
      interactionContracts: manifestChapters.reduce((sum, chapter) => sum + asArray(chapter?.interactionContracts).length, 0),
      inputContracts: manifestChapters.reduce((sum, chapter) => sum + asArray(chapter?.inputContracts).length, 0),
      optionalCapabilities: manifestChapters.reduce((sum, chapter) => sum + asArray(chapter?.optionalCapabilities).length, 0),
      escapedDefects: asArray(manifest.escapedDefectCoverage).length,
      lanes: laneDefinitions.length
    }
  };
}

export function readJson(jsonPath) {
  return JSON.parse(readFileSync(jsonPath, 'utf8'));
}

function parseArgs(argv) {
  const options = {
    manifest: DEFAULT_MANIFEST,
    registry: DEFAULT_REGISTRY,
    schema: DEFAULT_SCHEMA,
    selfTest: false,
    help: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--self-test') options.selfTest = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--manifest') options.manifest = path.resolve(argv[++index] ?? '');
    else if (arg === '--registry') options.registry = path.resolve(argv[++index] ?? '');
    else if (arg === '--schema') options.schema = path.resolve(argv[++index] ?? '');
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function expectMutation({ name, manifest, registry, schema, mutate, expectedCode }) {
  const mutatedManifest = clone(manifest);
  const mutatedRegistry = clone(registry);
  const mutatedSchema = clone(schema);
  mutate(mutatedManifest, mutatedRegistry, mutatedSchema);
  const result = validateJourneyContract(mutatedManifest, mutatedRegistry, mutatedSchema);
  assert.equal(result.ok, false, `${name} mutation unexpectedly passed.`);
  assert.ok(
    result.issues.some(candidate => candidate.code === expectedCode),
    `${name} did not emit ${expectedCode}; emitted ${result.issues.map(candidate => candidate.code).join(', ')}.`
  );
  return name;
}

/** Mutation-based proof that every material gate can turn red. */
export function runSelfTest(manifest, registry, schema) {
  const live = validateJourneyContract(manifest, registry, schema);
  assert.equal(live.ok, true, `Live journey contract failed:\n${live.issues.map(item => `${item.code}: ${item.message}`).join('\n')}`);

  const checks = [];
  const mutation = (name, mutate, expectedCode) => checks.push(expectMutation({
    name,
    manifest,
    registry,
    schema,
    mutate,
    expectedCode
  }));

  mutation('missing registered chapter', candidate => {
    candidate.chapters.splice(2, 1);
  }, 'manifest.chapter-order.exact');
  mutation('objective projection superset drift', candidate => {
    candidate.chapters.find(chapter => chapter.id === 'ch3').registryProjection.requiredObjectiveBeats.push('ch3-invented');
  }, 'projection.objectives.exact');
  mutation('checkpoint receipt superset drift', candidate => {
    candidate.chapters.find(chapter => chapter.id === 'ch6').registryProjection.checkpointReceipts.push('milestone:story:invented');
  }, 'projection.checkpoint-receipts.exact');
  mutation('signed anchor superset drift', candidate => {
    candidate.chapters.find(chapter => chapter.id === 'ch7').registryProjection.requiredSignedAnchorIds.push('anc.invented');
  }, 'projection.signed-anchors.exact');
  mutation('variant profile drift', candidate => {
    candidate.chapters.find(chapter => chapter.id === 'ch8').registryProjection.variantProfileIds.pop();
  }, 'projection.variants.exact');
  mutation('missing mandatory objective contract', candidate => {
    candidate.chapters.find(chapter => chapter.id === 'ch1').objectives.pop();
  }, 'objective.coverage.exact');
  mutation('missing chapter certification lane', candidate => {
    candidate.chapters.find(chapter => chapter.id === 'ch5').requiredLaneIds.splice(2, 1);
  }, 'lanes.chapter.exact');
  mutation('manual lane loses trusted input', candidate => {
    candidate.laneDefinitions.find(lane => lane.id === 'continuous-manual').execution = 'automated-movie';
  }, 'lanes.semantic-role');
  mutation('mandatory placement has placeholder rationale', candidate => {
    candidate.chapters.find(chapter => chapter.id === 'ch2').objectives[0].placementFitness.whyNow = 'TODO';
  }, 'objective.placement.whyNow');
  mutation('mandatory placement becomes nonblocking', candidate => {
    candidate.chapters.find(chapter => chapter.id === 'ch5').objectives[0].placementFitness.blocking = false;
  }, 'objective.placement.mandatory-blocking');
  mutation('W-7744 no longer becomes absent', candidate => {
    const contract = candidate.chapters.find(chapter => chapter.id === 'ch4').lifecycleContracts[0];
    contract.eventually.assertions = contract.eventually.assertions.filter(value => value !== 'entity:actor:w7744/mounted=false');
  }, 'escaped.w7744.temporal');
  mutation('W-7744 reload loses first-frame absence', candidate => {
    const contract = candidate.chapters.find(chapter => chapter.id === 'ch4').lifecycleContracts[0];
    contract.resume.assertOnFirstFrame = contract.resume.assertOnFirstFrame.filter(value => value !== 'entity:actor:w7744/visible=false');
  }, 'escaped.w7744.reload');
  mutation('persistent scar may defeat repair', candidate => {
    candidate.chapters.find(chapter => chapter.id === 'ch7').interactionContracts[0].rules.requiredWins = false;
  }, 'interaction.prompt-rules');
  mutation('persistent scar becomes a no-op', candidate => {
    candidate.chapters.find(chapter => chapter.id === 'ch7').interactionContracts[0].successEvidenceRefs = [];
  }, 'interaction.effect');
  mutation('Voyage field loses keyboard value assertion', candidate => {
    candidate.chapters.find(chapter => chapter.id === 'prologue').inputContracts[0].assertions.keyboardChangesValue = false;
  }, 'input.assertions');
  mutation('Voyage field selector drifts', candidate => {
    candidate.chapters.find(chapter => chapter.id === 'prologue').inputContracts[0].selector = '[data-fake-input="true"]';
  }, 'escaped.voyage.input');
  mutation('hover returns to Ch7 mandatory evidence', candidate => {
    candidate.chapters.find(chapter => chapter.id === 'ch7').objectives[0].interaction.completionEvidenceRefs.push('milestone:story:reconstruct:first-legal-hover-physical');
  }, 'escaped.hover.ch7-forbidden');
  mutation('Tidegarden hover becomes blocking', candidate => {
    candidate.chapters.find(chapter => chapter.id === 'ch9').optionalCapabilities[0].placementFitness.blocking = true;
  }, 'objective.placement.optional-nonblocking');
  mutation('escaped defect points to missing contract', candidate => {
    candidate.escapedDefectCoverage[0].contractRefs[0] = 'lifecycle:missing';
  }, 'escaped.coverage.unresolved-ref');
  mutation('registry gains an uncontracted objective beat', (_candidate, registryCandidate) => {
    registryCandidate.chapters.find(chapter => chapter.id === 'ch9').acceptance.requiredObjectiveBeats.push('ch9-new-work');
  }, 'projection.objectives.exact');
  mutation('registry gains an uncontracted checkpoint receipt', (_candidate, registryCandidate) => {
    registryCandidate.chapters.find(chapter => chapter.id === 'ch8').checkpoints[0].evidenceRefs.push('milestone:story:new-receipt');
  }, 'projection.checkpoint-receipts.exact');
  mutation('registry gains an uncontracted signed anchor', (_candidate, registryCandidate) => {
    registryCandidate.chapters.find(chapter => chapter.id === 'ch7').avBoundary.exit.anchorRefs.push('scene:fixture@v1#anchor:anc.new-handback');
  }, 'projection.signed-anchors.exact');
  mutation('schema loses lifecycle authority', (_candidate, _registryCandidate, schemaCandidate) => {
    delete schemaCandidate.$defs.lifecycleContract;
  }, 'schema.required-definition');

  return {
    schema: 'paravoxia.chapterJourneyContractGateSelfTest.v1',
    status: 'passed',
    liveSummary: live.summary,
    mutationChecks: checks.length,
    checks
  };
}

function usage() {
  return [
    'Usage: node main/tools/chapter-journey-contract-gate.mjs [options]',
    '',
    'Options:',
    '  --manifest <path>  Journey contract manifest (default: main/chapter-journey-contract.json)',
    '  --registry <path>  Chapter registry authority (default: main/chapter-registry.json)',
    '  --schema <path>    Journey JSON Schema authority',
    '  --self-test        Run mutation-based gate self-tests against the live files',
    '  --help, -h         Show this help'
  ].join('\n');
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n${usage()}\n`);
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  try {
    const manifest = readJson(options.manifest);
    const registry = readJson(options.registry);
    const schema = readJson(options.schema);
    if (options.selfTest) {
      process.stdout.write(`${JSON.stringify(runSelfTest(manifest, registry, schema), null, 2)}\n`);
      return;
    }
    const validation = validateJourneyContract(manifest, registry, schema);
    const report = {
      schema: 'paravoxia.chapterJourneyContractGateReport.v1',
      status: validation.ok ? 'passed' : 'failed',
      manifest: path.relative(REPO_ROOT, options.manifest),
      registry: path.relative(REPO_ROOT, options.registry),
      schemaAuthority: path.relative(REPO_ROOT, options.schema),
      summary: validation.summary,
      issues: validation.issues
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (!validation.ok) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  await main();
}
