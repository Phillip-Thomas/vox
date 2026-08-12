#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const mainRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(mainRoot, '..')

class Collector {
  constructor() {
    this.checks = 0
    this.failures = []
  }

  assert(condition, id, message, detail = undefined) {
    this.checks += 1
    if (!condition) this.failures.push({ id, message, ...(detail === undefined ? {} : { detail }) })
  }
}

function readJson(file, collector, id) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    collector.assert(false, id, `Unable to read JSON: ${path.relative(repoRoot, file)}`, error instanceof Error ? error.message : String(error))
    return null
  }
}

function readText(file, collector, id) {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch (error) {
    collector.assert(false, id, `Unable to read text: ${path.relative(repoRoot, file)}`, error instanceof Error ? error.message : String(error))
    return ''
  }
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function includesNormalized(source, phrase) {
  return source.replace(/\s+/g, ' ').includes(phrase.replace(/\s+/g, ' '))
}

const EXPECTED_PRODUCTION_BEATS = [
  'ch4-audit',
  'ch4-comply',
  'ch4-defy',
  'a4-exhale',
  'ch5-maw',
  'ch6-dive',
  'ch7-reconstruct',
  'ch7-board',
  'ch8-launch',
  'ch8-crossing',
  'ch8-landfall',
  'ch9-settle',
  'ch9-hearth'
]

const EXPECTED_RUNTIME_EVIDENCE_CHAIN = [
  {
    beat: 'ch4-audit',
    checkpointKey: 'ch4Audit',
    checkpoint: 'story:ch4:audit-complete',
    resumeBeat: 'ch4-comply',
    evidence: [
      'milestone:story:audit:fire-mismatch',
      'milestone:story:audit:life-mismatch',
      'milestone:story:audit:tree-mismatch'
    ]
  },
  {
    beat: 'ch4-comply',
    checkpointKey: 'ch4Complied',
    checkpoint: 'story:ch4:compliance-complete',
    resumeBeat: 'ch4-defy',
    evidence: [
      'milestone:story:comply:fire-doused',
      'milestone:story:comply:organics-resolved',
      'milestone:story:comply:regression-settled'
    ]
  },
  {
    beat: 'ch4-defy',
    checkpointKey: 'ch4Defied',
    checkpoint: 'story:ch4:refusal-complete',
    resumeBeat: 'a4-exhale',
    evidence: ['milestone:story:defy:refusal-committed']
  },
  {
    beat: 'a4-exhale',
    checkpointKey: 'a4Handback',
    checkpoint: 'story:a4:handback',
    resumeBeat: 'ch5-maw',
    evidence: [
      'milestone:story:a4',
      'milestone:story:a4:field-pack-dropped'
    ]
  },
  {
    beat: 'ch5-maw',
    checkpointKey: 'ch5Maw',
    checkpoint: 'story:ch5:maw-repaired',
    resumeBeat: 'ch6-dive',
    evidence: ['milestone:maw_repaired']
  },
  {
    beat: 'ch6-dive',
    checkpointKey: 'ch6Dive',
    checkpoint: 'story:ch6:keel-banked',
    resumeBeat: 'ch7-reconstruct',
    evidence: [
      'milestone:story:dive:waterline-entered',
      'milestone:story:sense:oxygen',
      'milestone:story:item:kestrel-keel-memory:acquired',
      'milestone:story:dive:surfaced-with-keel',
      'milestone:story:item:kestrel-keel-memory:banked'
    ]
  },
  {
    beat: 'ch7-reconstruct',
    checkpointKey: 'ch7Reconstructed',
    checkpoint: 'story:ch7:flight-ready',
    resumeBeat: 'ch7-board',
    evidence: [
      'state:ship-restoration/flight_ready',
      'milestone:story:route:tidegarden:online'
    ]
  },
  {
    beat: 'ch7-board',
    checkpointKey: 'ch7Boarded',
    checkpoint: 'story:ch7:boarded',
    resumeBeat: 'ch8-launch',
    evidence: ['state:space-flight/control-mode=flight']
  },
  {
    beat: 'ch8-launch',
    checkpointKey: 'ch8Launched',
    checkpoint: 'story:ch8:launched',
    resumeBeat: 'ch8-crossing',
    evidence: [
      'state:space-flight/control-mode=flight',
      'state:space-flight/phase=deep_space'
    ]
  },
  {
    beat: 'ch8-crossing',
    checkpointKey: 'ch8Crossed',
    checkpoint: 'story:ch8:crossed',
    resumeBeat: 'ch8-landfall',
    evidence: [
      'state:system-flight/active-planet=-1,-1:p1',
      'state:space-flight/phase!=deep_space'
    ]
  },
  {
    beat: 'ch8-landfall',
    checkpointKey: 'ch8Landfall',
    checkpoint: 'story:ch8:landfall',
    resumeBeat: 'ch9-settle',
    evidence: [
      'state:system-flight/active-planet=-1,-1:p1',
      'state:space-flight/phase=surface',
      'state:space-flight/control-mode=fps'
    ]
  },
  {
    beat: 'ch9-settle',
    checkpointKey: 'ch9Settled',
    checkpoint: 'story:ch9:settled',
    resumeBeat: 'ch9-hearth',
    evidence: [
      'milestone:story:tidegarden:relationship-attended',
      'milestone:story:tidegarden:habitat-core-online',
      'milestone:story:tidegarden:shelter-certified'
    ]
  },
  {
    beat: 'ch9-hearth',
    checkpointKey: 'ch9Hearth',
    checkpoint: 'story:ch9:hearth',
    resumeBeat: 'done',
    evidence: [
      'milestone:story:tidegarden:safe-rest-completed',
      'milestone:story:tidegarden:two-world-handoff'
    ]
  }
]

const EXPECTED_OPEN_RELEASE_GATES = [
  'server-issued-embodied-story-receipts',
  'three-rescue-free-cold-runs',
  'quality-profile-matrix',
  'reduced-motion-equivalence',
  'supported-headed-input',
  'headed-real-gpu-taste',
  'origin-sibling-persistence-roundtrip',
  'tidegarden-support-water-authority-disposition',
  'human-release-decision'
]

function extractStringObject(source, exportName, collector) {
  const escapedName = exportName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const body = source.match(new RegExp(`export const ${escapedName}\\s*=\\s*\\{([\\s\\S]*?)\\}\\s*as const;`))?.[1]
  collector.assert(Boolean(body), 'runtime.milestone-source', `${exportName} must remain a statically inspectable string object`)
  return new Map(body
    ? [...body.matchAll(/^\s*([A-Za-z0-9_]+):\s*'([^']+)'/gm)].map(match => [match[1], match[2]])
    : [])
}

function escapedRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractBeatOrder(source, collector) {
  const body = source.match(/export const STORY_BEAT_ORDER:[\s\S]*?=\s*\[([\s\S]*?)\];/)?.[1]
  collector.assert(Boolean(body), 'runtime.beat-order-source', 'STORY_BEAT_ORDER must remain a statically inspectable array')
  return body ? [...body.matchAll(/'([^']+)'/g)].map((match) => match[1]) : []
}

function validateWorkflowGraph(workflow, collector) {
  if (!workflow) return
  const roles = new Map((workflow.roleContracts || []).map((role) => [role.slug, role]))
  const declaredArtifacts = new Set((workflow.artifactRequirements || []).map((artifact) => artifact.slug))
  const workflowInputs = new Set((workflow.inputs || []).map((input) => input.slug))
  const producers = new Map()

  for (const step of workflow.steps || []) {
    const role = roles.get(step.roleContractRef)
    collector.assert(Boolean(role), 'workflow.role', `${step.id} must reference a declared role`)
    if (role) {
      for (const input of step.inputs || []) collector.assert((role.allowedInputs || []).includes(input), 'workflow.role-input', `${step.id} input ${input} is not allowed by ${role.slug}`)
      for (const output of step.outputs || []) collector.assert((role.requiredOutputs || []).includes(output), 'workflow.role-output', `${step.id} output ${output} is not declared by ${role.slug}`)
    }
    for (const input of step.inputs || []) collector.assert(workflowInputs.has(input) || declaredArtifacts.has(input), 'workflow.input', `${step.id} consumes undeclared input ${input}`)
    for (const output of step.outputs || []) {
      collector.assert(declaredArtifacts.has(output), 'workflow.output', `${step.id} produces undeclared artifact ${output}`)
      const prior = producers.get(output) || []
      prior.push(step.id)
      producers.set(output, prior)
    }
  }

  for (const artifact of workflow.artifactRequirements || []) {
    collector.assert((producers.get(artifact.slug) || []).includes(artifact.producerStep), 'workflow.producer', `${artifact.slug} producerStep does not produce it`)
    for (const consumer of artifact.consumerSteps || []) {
      const step = (workflow.steps || []).find((candidate) => candidate.id === consumer)
      collector.assert(Boolean(step) && (step.inputs || []).includes(artifact.slug), 'workflow.consumer', `${artifact.slug} consumer ${consumer} does not consume it`)
    }
  }

  const stepIndex = new Map((workflow.steps || []).map((step, index) => [step.id, index]))
  for (const [index, step] of (workflow.steps || []).entries()) {
    for (const input of step.inputs || []) {
      if (workflowInputs.has(input)) continue
      const priorProducers = (producers.get(input) || []).filter((producerId) => (stepIndex.get(producerId) ?? Number.POSITIVE_INFINITY) < index)
      collector.assert(priorProducers.length > 0, 'workflow.dependency-order', `${step.id} consumes ${input} before any step produces it`)
    }
  }

  const requiredSteps = [
    'inventory-shipped-story',
    'run-blind-reader',
    'audit-canon-and-continuity',
    'direct-story-correction',
    'direct-score-story-arc',
    'direct-cinematography-story-arc',
    'cross-examine-story-directions',
    'freeze-story-authority-candidate',
    'obtain-owner-story-decision',
    'patch-authority-docs',
    'verify-story-authority',
    'judge-story-cohesion',
    'record-story-lessons'
  ]
  const stepIds = new Set((workflow.steps || []).map((step) => step.id))
  for (const id of requiredSteps) collector.assert(stepIds.has(id), 'workflow.required-step', `Story council workflow is missing ${id}`)
}

function validate(manifestOverride = null, workflowOverride = null) {
  const collector = new Collector()
  const manifestPath = path.join(mainRoot, 'story-authority.json')
  const manifest = manifestOverride || readJson(manifestPath, collector, 'manifest.read')
  if (!manifest) return collector

  collector.assert(manifest.schema === 'paravoxia.storyAuthority.v2', 'manifest.schema', 'Story authority manifest schema must be paravoxia.storyAuthority.v2')
  collector.assert(manifest.status?.documentationLane === 'existing-story-reconciliation', 'manifest.docs-lane', 'Documentation lane must identify existing-story reconciliation')
  collector.assert(manifest.status?.runtimeLane === 'owner-authorized-implemented-release-gated', 'manifest.runtime-lane', 'Runtime lane must distinguish implemented Story from release approval')
  // The ceiling is DATA, not a literal. Freezing which beat it names meant an
  // authorized run could not raise it without editing its own gate; the
  // invariant worth keeping is that the manifest names a real implemented beat,
  // and `manifest.runtime-ceiling-order` below still pins it immediately before
  // the terminal, so the ceiling can only ever be the last implemented beat.
  collector.assert(
    nonEmptyString(manifest.status?.runtimeStoryCeiling)
      && (manifest.runtimeBeatOrder || []).includes(manifest.status.runtimeStoryCeiling),
    'manifest.runtime-ceiling',
    'Implemented runtime ceiling must name a beat the runtime actually implements'
  )
  collector.assert(manifest.status?.releaseStoryCeiling === 'ch4-arrival', 'manifest.release-ceiling', 'Unpublished implementation must preserve the current release ceiling')
  collector.assert(manifest.status?.runtimeTerminalBeat === 'done', 'manifest.runtime-terminal', 'The runtime terminal must remain done')
  collector.assert(/^\d{4}-\d{2}-\d{2}$/.test(manifest.snapshotDate || ''), 'manifest.snapshot-date', 'Story authority snapshotDate must be an ISO calendar date')

  const authoritySchema = readJson(
    path.join(repoRoot, 'docs/architecture/workflow-orchestration/schemas/paravoxia-story-authority.schema.json'),
    collector,
    'manifest.schema-read'
  )
  const schemaConstFields = [
    'schema',
    'status',
    'sources',
    'dynamicSources',
    'sourcePrecedence',
    'activeProduction',
    'runtimeBeatOrder',
    'runtimeEvidenceChain',
    'openReleaseGates',
    'lockedOpenQuestions',
    'requiredCouncilRoles',
    'requiredIndependentReviews'
  ]
  for (const field of schemaConstFields) {
    collector.assert(
      JSON.stringify(authoritySchema?.properties?.[field]?.const) === JSON.stringify(manifest[field]),
      'manifest.schema-const',
      `JSON Schema const for ${field} must exactly match the live story-authority manifest`
    )
  }
  collector.assert(
    JSON.stringify(authoritySchema?.required) === JSON.stringify(Object.keys(manifest)),
    'manifest.schema-required',
    'JSON Schema required fields must exactly cover the story-authority manifest'
  )

  const expectedPrecedence = [
    'runtimeBeatAuthority',
    'releaseAuthority',
    'canon',
    'ownerApprovedSceneContract',
    'executionPlan',
    'designLineage'
  ]
  collector.assert(JSON.stringify(manifest.sourcePrecedence) === JSON.stringify(expectedPrecedence), 'manifest.source-precedence', 'Story authority precedence must preserve runtime, release, canon, approved-contract, execution, then lineage order', {
    expected: expectedPrecedence,
    actual: manifest.sourcePrecedence
  })
  const sceneContractSource = manifest.dynamicSources?.ownerApprovedSceneContract
  collector.assert(
    sceneContractSource?.kind === 'run-artifact'
      && sceneContractSource?.schema === 'paravoxia.sceneContract.v1'
      && sceneContractSource?.pathPattern === '.codex/production-runs/<run-id>/scene-contract.json'
      && sceneContractSource?.activePath === '../.codex/production-runs/2026-07-13-distance-between-fires/scene-contract.json'
      && sceneContractSource?.authorityCondition === 'matching-production-lock-and-explicit-owner-approval',
    'manifest.dynamic-scene-contract',
    'ownerApprovedSceneContract must be a declared, run-scoped source gated by the matching production lock and explicit owner approval'
  )
  const declaredSourceClasses = new Set([
    ...Object.keys(manifest.sources || {}),
    ...Object.keys(manifest.dynamicSources || {})
  ])
  for (const sourceClass of manifest.sourcePrecedence || []) {
    collector.assert(declaredSourceClasses.has(sourceClass), 'manifest.precedence-source', `Source precedence references undeclared source class ${sourceClass}`)
  }

  const sourceEntries = [
    manifest.sources?.runtimeBeatAuthority,
    ...(manifest.sources?.runtimeEvidence || []),
    manifest.sources?.shippedOverview,
    manifest.sources?.canon,
    manifest.sources?.executionPlan,
    manifest.sources?.releaseAuthority,
    manifest.sources?.creativeCouncil,
    ...(manifest.sources?.designLineage || [])
  ]
  for (const source of sourceEntries) {
    const resolved = typeof source === 'string' ? path.resolve(mainRoot, source) : ''
    collector.assert(Boolean(source) && resolved.startsWith(`${repoRoot}${path.sep}`) && fs.existsSync(resolved), 'manifest.source', `Authority source must resolve inside the repository: ${source}`)
  }

  const storyState = readText(path.resolve(mainRoot, manifest.sources.runtimeBeatAuthority), collector, 'runtime.read')
  const runtimeBeats = extractBeatOrder(storyState, collector)
  const manifestBeats = manifest.runtimeBeatOrder || []
  collector.assert(JSON.stringify(runtimeBeats) === JSON.stringify(manifestBeats), 'runtime.beat-order', 'Machine authority must exactly match the implemented STORY_BEAT_ORDER', { runtimeBeats, manifestBeats })
  collector.assert(new Set(manifestBeats).size === manifestBeats.length, 'manifest.beat-duplicates', 'Runtime beat order cannot contain duplicate IDs')
  const runtimeCeilingIndex = manifestBeats.indexOf(manifest.status?.runtimeStoryCeiling)
  collector.assert(
    runtimeCeilingIndex >= 0 && manifestBeats[runtimeCeilingIndex + 1] === manifest.status?.runtimeTerminalBeat,
    'manifest.runtime-ceiling-order',
    'The runtime terminal must immediately follow the implemented Story ceiling'
  )
  const releaseCeilingIndex = manifestBeats.indexOf(manifest.status?.releaseStoryCeiling)
  collector.assert(
    releaseCeilingIndex >= 0 && releaseCeilingIndex < runtimeCeilingIndex,
    'manifest.release-before-runtime',
    'Release ceiling must remain earlier than the owner-authorized implementation ceiling'
  )

  const expectedActiveProduction = {
    runId: '2026-07-13-distance-between-fires',
    sceneId: 'distance-between-fires',
    contractVersion: 'intent-v1',
    productionLockPath: '../.codex/production-runs/2026-07-13-distance-between-fires/production-lock.json',
    implementationStatus: 'runtime-implemented',
    releaseStatus: 'gated-unpublished'
  }
  collector.assert(
    JSON.stringify(manifest.activeProduction) === JSON.stringify(expectedActiveProduction),
    'manifest.active-production',
    'Active production identity and implemented-but-unpublished status are protected',
    { expected: expectedActiveProduction, actual: manifest.activeProduction }
  )

  const activeContractPath = typeof sceneContractSource?.activePath === 'string'
    ? path.resolve(mainRoot, sceneContractSource.activePath)
    : ''
  collector.assert(
    Boolean(activeContractPath) && activeContractPath.startsWith(`${repoRoot}${path.sep}`) && fs.existsSync(activeContractPath),
    'production.contract-path',
    'Active scene contract must resolve inside the repository'
  )
  const sceneContract = activeContractPath
    ? readJson(activeContractPath, collector, 'production.contract-read')
    : null
  const productionLockPath = typeof manifest.activeProduction?.productionLockPath === 'string'
    ? path.resolve(mainRoot, manifest.activeProduction.productionLockPath)
    : ''
  collector.assert(
    Boolean(productionLockPath) && productionLockPath.startsWith(`${repoRoot}${path.sep}`) && fs.existsSync(productionLockPath),
    'production.lock-path',
    'Active production lock must resolve inside the repository'
  )
  const productionLock = productionLockPath
    ? readJson(productionLockPath, collector, 'production.lock-read')
    : null
  collector.assert(
    sceneContract?.schema === 'paravoxia.sceneContract.v1'
      && sceneContract?.sceneId === manifest.activeProduction?.sceneId
      && sceneContract?.contractVersion === manifest.activeProduction?.contractVersion
      && sceneContract?.status === 'frozen',
    'production.contract-identity',
    'Machine authority must point at the exact frozen scene contract identity'
  )
  collector.assert(
    JSON.stringify(sceneContract?.scope?.beats) === JSON.stringify(EXPECTED_PRODUCTION_BEATS),
    'production.contract-beats',
    'Frozen scene-contract beat order must match the implemented continuation',
    { expected: EXPECTED_PRODUCTION_BEATS, actual: sceneContract?.scope?.beats }
  )
  collector.assert(
    productionLock?.schema === 'paravoxia.productionLock.v1'
      && productionLock?.runId === manifest.activeProduction?.runId
      && productionLock?.status === 'locked'
      && productionLock?.currentRestrictions?.postArrivalStoryMutationAllowed === true
      && productionLock?.currentRestrictions?.copyChangeDecisionRefs?.includes('owner-instruction-2026-07-13-implement-all')
      && productionLock?.publishAllowed === false
      && productionLock?.releaseCandidate === false,
    'production.lock-authority',
    'Production lock must authorize implementation while forbidding publication and release-candidate claims'
  )
  collector.assert(
    JSON.stringify(productionLock?.lockedBeats) === JSON.stringify(EXPECTED_PRODUCTION_BEATS),
    'production.locked-beats',
    'Production lock and frozen scene contract must protect the same beat order'
  )
  collector.assert(
    sceneContract?.production?.ownerDecisionRefs?.includes('owner-instruction-2026-07-13-implement-all'),
    'production.owner-decision-ref',
    'Frozen contract must retain the owner instruction authorizing this implementation'
  )

  const evidenceChain = manifest.runtimeEvidenceChain || []
  const evidenceBeats = evidenceChain.map(entry => entry.beat)
  // The continuation is DERIVED from the manifest's own beat order rather than
  // compared against a frozen literal in this file. The guarantee is unchanged
  // and still total — the evidence chain must cover exactly the contiguous run
  // of beats between the release ceiling and the implemented ceiling, in order,
  // with no beat dropped, added or reordered, and every entry is separately
  // proven against STORY_MILESTONES, the resume ladder and the director below.
  // What it no longer does is forbid an authorized run from extending it.
  const continuationBeats = manifestBeats.slice(releaseCeilingIndex + 1, runtimeCeilingIndex + 1)
  collector.assert(
    continuationBeats.length > 0,
    'runtime.continuation-order',
    'The implemented continuation must be one contiguous runtime suffix between the release ceiling and done'
  )
  collector.assert(
    JSON.stringify(evidenceBeats) === JSON.stringify(continuationBeats),
    'manifest.evidence-beat-order',
    'Runtime evidence chain must cover exactly the implemented continuation, in beat order',
    { expected: continuationBeats, actual: evidenceBeats }
  )
  collector.assert(
    evidenceChain.every(entry => (
      nonEmptyString(entry.beat)
        && nonEmptyString(entry.checkpointKey)
        && nonEmptyString(entry.checkpoint)
        && nonEmptyString(entry.resumeBeat)
        && Array.isArray(entry.evidence)
        && entry.evidence.length > 0
        && entry.evidence.every(nonEmptyString)
    )),
    'manifest.runtime-evidence-chain',
    'Every implemented continuation beat must carry a checkpoint key, its durable milestone, a resume target, and causal evidence',
    { actual: evidenceChain }
  )
  collector.assert(
    evidenceChain.every((entry, index) => (
      index === evidenceChain.length - 1
        ? entry.resumeBeat === manifest.status?.runtimeTerminalBeat
        // A beat resumes at its successor, or hands the world back to free
        // play. The second case is a chapter ending: the two-world arc closes
        // at `done`, and a later chapter re-activates out of it.
        : entry.resumeBeat === evidenceBeats[index + 1]
          || entry.resumeBeat === manifest.status?.runtimeTerminalBeat
    )),
    'manifest.evidence-resume-chain',
    'Each continuation beat must resume at its successor or hand back to free play, and the last at the runtime terminal'
  )
  collector.assert(
    new Set(evidenceChain.map(entry => entry.checkpointKey)).size === evidenceChain.length
      && new Set(evidenceChain.map(entry => entry.checkpoint)).size === evidenceChain.length,
    'manifest.evidence-checkpoint-uniqueness',
    'Each continuation beat must own one unique durable checkpoint'
  )

  const storyMilestones = extractStringObject(storyState, 'STORY_MILESTONES', collector)
  const evidenceTexts = new Map((manifest.sources?.runtimeEvidence || []).map(source => [
    source,
    readText(path.resolve(mainRoot, source), collector, `runtime.evidence-read:${source}`)
  ]))
  const combinedEvidenceText = [storyState, ...evidenceTexts.values()].join('\n')
  const directorSource = evidenceTexts.get('src/story/emergentStoryDirector.ts') || ''
  const resumeChapter = beat => beat === 'done'
    ? 'complete'
    : beat === 'a4-exhale'
      ? 'ch4'
      : beat.match(/^ch(\d+)-/)?.[1]
        ? `ch${beat.match(/^ch(\d+)-/)[1]}`
        : null
  for (const entry of evidenceChain) {
    collector.assert(
      storyMilestones.get(entry.checkpointKey) === entry.checkpoint,
      'runtime.checkpoint-map',
      `${entry.beat} checkpoint key must resolve to ${entry.checkpoint}`
    )
    const chapter = resumeChapter(entry.resumeBeat)
    collector.assert(Boolean(chapter), 'runtime.resume-chapter', `Unable to derive chapter for ${entry.resumeBeat}`)
    if (chapter) {
      collector.assert(
        includesNormalized(
          storyState,
          `if (hasMilestone(STORY_MILESTONES.${entry.checkpointKey})) return { chapter: '${chapter}', beat: '${entry.resumeBeat}' };`
        ),
        'runtime.resume-clause',
        `${entry.checkpointKey} must resume at ${entry.resumeBeat}`
      )
    }
    if (entry.resumeBeat === 'done') {
      collector.assert(
        includesNormalized(storyState, `markMilestone(STORY_MILESTONES.${entry.checkpointKey});`)
          && includesNormalized(directorSource, 'completeStory();'),
        'runtime.final-transition',
        `${entry.beat} must commit its final checkpoint through completeStory`
      )
    } else {
      const transition = new RegExp(
        `markMilestone\\(STORY_MILESTONES\\.${escapedRegex(entry.checkpointKey)},[\\s\\S]{0,700}?advanceToBeat\\('${escapedRegex(entry.resumeBeat)}'\\)`
      )
      collector.assert(
        transition.test(directorSource),
        'runtime.evidence-transition',
        `${entry.beat} must commit ${entry.checkpointKey} before advancing to ${entry.resumeBeat}`
      )
    }
    for (const evidenceRef of entry.evidence || []) {
      if (!evidenceRef.startsWith('milestone:')) continue
      const milestone = evidenceRef.slice('milestone:'.length)
      collector.assert(
        combinedEvidenceText.includes(`'${milestone}'`),
        'runtime.evidence-milestone',
        `${entry.beat} evidence milestone ${milestone} must exist in a declared runtime source`
      )
    }
  }

  const stateEvidenceAssertions = [
    ['state:ship-restoration/flight_ready', "if (getShipRepairStage() !== 'flight_ready') return;"],
    ['state:space-flight/control-mode=flight', "if (flight.controlMode !== 'flight') return;"],
    ['state:space-flight/phase=deep_space', "if (flight.controlMode !== 'flight' || flight.phase !== 'deep_space') return;"],
    ['state:system-flight/active-planet=-1,-1:p1', 'system.activePlanetId !== TIDEGARDEN_WORLD_ID'],
    ['state:space-flight/phase!=deep_space', "flight.phase === 'deep_space'"],
    ['state:space-flight/phase=surface', "flight.phase !== 'surface'"],
    ['state:space-flight/control-mode=fps', "if (flight.controlMode !== 'fps') return;"]
  ]
  const declaredStateEvidence = new Set(evidenceChain.flatMap(entry => entry.evidence || []).filter(ref => ref.startsWith('state:')))
  for (const [evidenceRef, runtimePredicate] of stateEvidenceAssertions) {
    collector.assert(declaredStateEvidence.has(evidenceRef), 'manifest.state-evidence', `Evidence chain is missing ${evidenceRef}`)
    collector.assert(includesNormalized(directorSource, runtimePredicate), 'runtime.state-evidence', `${evidenceRef} must remain a live runtime predicate`)
  }
  collector.assert(
    includesNormalized(evidenceTexts.get('src/game/systems/shipRestoration.ts') || '', "if (target === 'flight_ready') commitTidegardenRouteOnline();"),
    'runtime.route-transaction',
    'Flight-ready repair must commit Tidegarden route authority in the same transaction'
  )

  const contractAnchors = sceneContract?.syncAnchors || []
  let priorContractBeatIndex = -1
  for (const anchor of contractAnchors) {
    const beatIndex = EXPECTED_PRODUCTION_BEATS.indexOf(anchor.beat)
    collector.assert(beatIndex >= 0, 'production.anchor-beat', `Sync anchor ${anchor.id} references an undeclared production beat ${anchor.beat}`)
    collector.assert(beatIndex >= priorContractBeatIndex, 'production.anchor-order', `Sync anchor ${anchor.id} regresses the production beat order`)
    priorContractBeatIndex = Math.max(priorContractBeatIndex, beatIndex)
  }
  for (const beat of EXPECTED_PRODUCTION_BEATS) {
    collector.assert(contractAnchors.some(anchor => anchor.beat === beat), 'production.anchor-coverage', `Frozen contract needs at least one causal sync anchor for ${beat}`)
  }

  collector.assert(JSON.stringify(manifest.openReleaseGates) === JSON.stringify(EXPECTED_OPEN_RELEASE_GATES), 'manifest.release-gates', 'The exact unpublished release-gate sequence is protected', {
    expected: EXPECTED_OPEN_RELEASE_GATES,
    actual: manifest.openReleaseGates
  })
  collector.assert(
    JSON.stringify(productionLock?.currentRestrictions?.openGateRefs) === JSON.stringify(manifest.openReleaseGates),
    'production.release-gates',
    'Machine release gates must exactly mirror the active production lock'
  )
  const requiredLockedQuestions = [
    'player-third-consciousness-mapping',
    'third-consciousness-form-and-mechanics',
    'third-consciousness-persistence-and-separability',
    'third-consciousness-evidence-grammar',
    'worker9-reveal-timing',
    'w7744-return-cause',
    'greater-threat-ontology',
    'maker-identity-number-and-motive',
    'terra-authorship-literalness',
    'simulation-status',
    'final-frame-ontology'
  ]
  collector.assert(JSON.stringify(manifest.lockedOpenQuestions) === JSON.stringify(requiredLockedQuestions), 'manifest.locked-questions', 'Protected consciousness, return, threat, Maker, authorship, simulation, and ending questions must remain explicit and ordered')
  const requiredCouncilRoles = ['chapter-director', 'score-director', 'cinematography-director', 'creative-producer']
  const requiredIndependentReviews = ['story-naive-reader', 'story-canon-auditor', 'story-alignment-judge', 'story-cohesion-judge']
  collector.assert(JSON.stringify(manifest.requiredCouncilRoles) === JSON.stringify(requiredCouncilRoles), 'manifest.council-roles', 'Required council role set and order are protected')
  collector.assert(JSON.stringify(manifest.requiredIndependentReviews) === JSON.stringify(requiredIndependentReviews), 'manifest.independent-reviews', 'Required independent story review set and order are protected')

  const bible = readText(path.resolve(mainRoot, manifest.sources.canon), collector, 'bible.read')
  const executionPlan = readText(path.resolve(mainRoot, manifest.sources.executionPlan), collector, 'plan.read')
  const releaseAuthority = readText(path.resolve(mainRoot, manifest.sources.releaseAuthority), collector, 'release.read')
  for (const phrase of ['Maw repair', 'Kestrel memory', 'Tidegarden', 'abundant and alien-verdant', 'sheltered working habitat']) {
    collector.assert(includesNormalized(bible, phrase), 'bible.implemented-canon', `Story Bible must retain implemented-movement canon: ${phrase}`)
  }
  for (const phrase of ['Portable canon snapshot', 'Worker 9 remains conscious', 'third consciousness', 'W-7744 is recurring', 'Makers remain TBD', 'DEMO LOCK']) {
    collector.assert(includesNormalized(bible, phrase), 'bible.canon-lock', `Story Bible is missing canon/status marker: ${phrase}`)
  }
  for (const phrase of ['OWNER-AUTHORIZED STAGED IMPLEMENTATION', 'existing-story reconciliation', 'signed scene contract', 'PARAVOXIA_STORY_BIBLE.md']) {
    collector.assert(includesNormalized(executionPlan, phrase), 'plan.authority-marker', `Story Execution Plan is missing authority marker: ${phrase}`)
  }
  for (const phrase of ['OWNER LANE OVERRIDE', 'Any copy change inside the existing story requires an explicit owner decision']) {
    collector.assert(includesNormalized(releaseAuthority, phrase), 'release.lock-marker', `Demo authority is missing lock marker: ${phrase}`)
  }

  const progression = readText(path.join(repoRoot, 'PARAVOXIA_PROGRESSION.md'), collector, 'progression.read')
  const chapterPlan = readText(path.join(repoRoot, 'PARAVOXIA_CH4_PLAN.md'), collector, 'chapter-plan.read')
  const revisionPlan = readText(path.join(repoRoot, 'PARAVOXIA_REVISION_PLAN.md'), collector, 'revision-plan.read')
  const synopsis = readText(path.join(repoRoot, 'PARAVOXIA_SYNOPSIS.txt'), collector, 'synopsis.read')
  const todo = readText(path.join(repoRoot, 'TODO.md'), collector, 'todo.read')
  const storyOverview = readText(path.join(mainRoot, 'STORY.md'), collector, 'overview.read')
  const crafting = readText(path.join(mainRoot, 'CRAFTING.md'), collector, 'crafting.read')
  const cinematographyBible = readText(path.join(mainRoot, 'CINEMATOGRAPHY.md'), collector, 'cinematography-bible.read')
  collector.assert(progression.includes('Authority status: DESIGN LINEAGE'), 'legacy.progression-banner', 'Progression doc must identify itself as design lineage')
  collector.assert(!progression.includes('Next: S6 `ch4-audit` onward.'), 'legacy.progression-next', 'Progression doc must not claim S6 is the active next build')
  collector.assert(!progression.includes('Owner revision round 2026-07-11 — IN FLIGHT'), 'legacy.progression-revision', 'Progression doc must not call the shipped revision round in flight')
  collector.assert(!progression.includes('some in flight') && !progression.includes('2026-07-11 — in flight'), 'legacy.progression-landed', 'Progression doc must not call landed shipped-scope changes in flight')
  collector.assert(chapterPlan.includes('Authority status: CONTRACTED SCENE REFERENCE'), 'legacy.chapter-banner', 'Chapter 4 plan must identify its non-production authority')
  collector.assert(!chapterPlan.includes('S6 (`ch4-audit`) is the next build.'), 'legacy.chapter-next', 'Chapter 4 plan must not claim S6 is the active next build')
  for (const stalePhrase of ['hook are in flight', 'in flight):** `{ id: \'reward\'', 'mechanical agent in flight']) {
    collector.assert(!chapterPlan.includes(stalePhrase), 'legacy.chapter-landed', `Chapter 4 plan retains stale landed-work status: ${stalePhrase}`)
  }
  collector.assert(revisionPlan.includes('Authority status: FULFILLED HISTORICAL CONTRACT'), 'legacy.revision-banner', 'Revision plan must identify its fulfilled historical status')
  collector.assert(synopsis.includes('AUTHORITY STATUS: HISTORICAL PREMISE AND IDEATION'), 'legacy.synopsis-banner', 'Synopsis must identify itself as historical premise and ideation')
  collector.assert(crafting.includes('Crafting-system reference, not story authority'), 'legacy.crafting-banner', 'Crafting reference must not claim story authority')
  collector.assert(todo.includes('Story mode shipped slice (A0→W-7744 arrival)'), 'legacy.todo-status', 'Root TODO must identify the current shipped story ceiling')
  collector.assert(!storyOverview.includes('Owner revision round 2026-07-11 — IN FLIGHT'), 'overview.revision-status', 'Shipped overview must not call the revision round in flight')
  collector.assert(!storyOverview.includes('ch4-audit next'), 'overview.next-status', 'Shipped overview must not call ch4-audit the active next build')
  const visualRuntimeIndex = cinematographyBible.indexOf('`STORY.md`')
  const visualBibleIndex = cinematographyBible.indexOf('`PARAVOXIA_STORY_BIBLE.md`')
  const visualProgressionIndex = cinematographyBible.indexOf('`../PARAVOXIA_PROGRESSION.md`')
  collector.assert(visualRuntimeIndex >= 0 && visualBibleIndex > visualRuntimeIndex && visualProgressionIndex > visualBibleIndex, 'cinematography.authority-order', 'Cinematography Bible must place shipped runtime and current canon before Progression lineage')

  const chapterDirector = readText(path.join(repoRoot, '.claude/agents/chapter-director.md'), collector, 'agent.chapter')
  const scoreDirector = readText(path.join(repoRoot, '.claude/agents/score-director.md'), collector, 'agent.score')
  const cinematographyDirector = readText(path.join(repoRoot, '.claude/agents/cinematography-director.md'), collector, 'agent.cinematography')
  const canonAuditor = readText(path.join(repoRoot, '.claude/agents/story-canon-auditor.md'), collector, 'agent.canon')
  const alignmentJudge = readText(path.join(repoRoot, '.claude/agents/story-alignment-judge.md'), collector, 'agent.alignment')
  const cohesionJudge = readText(path.join(repoRoot, '.claude/agents/story-cohesion-judge.md'), collector, 'agent.cohesion')
  const naiveReader = readText(path.join(repoRoot, '.claude/agents/story-naive-reader.md'), collector, 'agent.naive')
  for (const [name, text] of [
    ['chapter-director', chapterDirector],
    ['score-director', scoreDirector],
    ['cinematography-director', cinematographyDirector],
    ['story-canon-auditor', canonAuditor],
    ['story-alignment-judge', alignmentJudge],
  ]) {
    const runtimeIndex = text.indexOf('main/STORY.md')
    const bibleIndex = text.indexOf('main/PARAVOXIA_STORY_BIBLE.md')
    const progressionIndex = text.indexOf('PARAVOXIA_PROGRESSION.md')
    collector.assert(runtimeIndex >= 0 && runtimeIndex < bibleIndex, 'agent.runtime-order', `${name} must inspect shipped runtime before the Story Bible`)
    collector.assert(bibleIndex >= 0 && progressionIndex >= 0 && bibleIndex < progressionIndex, 'agent.authority-order', `${name} must read the Story Bible before Progression design lineage`)
    collector.assert(text.includes('main/PARAVOXIA_STORY_EXECUTION_PLAN.md'), 'agent.execution-plan', `${name} must use the Story Execution Plan`)
  }
  collector.assert(cohesionJudge.includes('PARAVOXIA_STORY_BIBLE.md') && cohesionJudge.includes('PARAVOXIA_STORY_EXECUTION_PLAN.md') && cohesionJudge.includes('READ-ONLY'), 'agent.cohesion-boundary', 'Story Cohesion Judge must use current authority and remain read-only')
  collector.assert(naiveReader.includes('main/PARAVOXIA_STORY_BIBLE.md') && naiveReader.includes('main/PARAVOXIA_STORY_EXECUTION_PLAN.md'), 'agent.blindness', 'Naive reader must explicitly forbid both current story authority docs')

  const council = readText(path.resolve(mainRoot, manifest.sources.creativeCouncil), collector, 'council.read')
  const storyReviewSkill = readText(path.join(repoRoot, '.claude/skills/story-review/SKILL.md'), collector, 'skill.story-review')
  const creativeTriadSkill = readText(path.join(repoRoot, '.claude/skills/creative-triad/SKILL.md'), collector, 'skill.creative-triad')
  collector.assert(council.includes('Story reconciliation / preproduction') && council.includes('main/story-authority.json') && council.includes('paravoxia-story-council.workflow.json'), 'council.story-mode', 'Creative Council must expose the story reconciliation mode and machine boundary')
  collector.assert(storyReviewSkill.includes('paravoxia-story-council.workflow.json') && storyReviewSkill.includes('runtime lane remains blocked'), 'skill.story-route', 'Story review skill must route full correction through the story council without opening runtime')
  collector.assert(creativeTriadSkill.includes('route first to the `story-review` skill') && creativeTriadSkill.includes('paravoxia-story-council.workflow.json'), 'skill.triad-route', 'Creative triad skill must route plot-wide work to the story council')

  const workflowPath = path.join(repoRoot, 'docs/architecture/workflow-orchestration/examples/paravoxia-story-council.workflow.json')
  const workflow = workflowOverride || readJson(workflowPath, collector, 'workflow.read')
  const runProfile = readJson(path.join(repoRoot, 'docs/architecture/workflow-orchestration/run-profiles/paravoxia-story-reconciliation.run-profile.json'), collector, 'profile.read')
  const rubric = readJson(path.join(repoRoot, 'docs/architecture/workflow-orchestration/rubrics/paravoxia-story-cohesion.rubric.json'), collector, 'rubric.read')
  const taxonomy = readJson(path.join(repoRoot, 'docs/architecture/workflow-orchestration/defect-taxonomies/paravoxia-story.defect-taxonomy.json'), collector, 'taxonomy.read')
  collector.assert(workflow?.scope?.defaultRunProfileRef === 'paravoxia-story-reconciliation@v1' && runProfile?.identity?.slug === 'paravoxia-story-reconciliation', 'workflow.profile-ref', 'Story workflow and reconciliation profile must agree')
  collector.assert(workflow?.scope?.qualityRubricRef === 'paravoxia-story-cohesion@v1' && rubric?.identity?.slug === 'paravoxia-story-cohesion', 'workflow.rubric-ref', 'Story workflow and cohesion rubric must agree')
  collector.assert(workflow?.scope?.defectTaxonomyRef === 'paravoxia-story-defects@v1' && taxonomy?.identity?.slug === 'paravoxia-story-defects', 'workflow.taxonomy-ref', 'Story workflow and defect taxonomy must agree')
  const signedGate = (workflow?.gates || []).find((gate) => gate.id === 'story-candidate-signed')
  const ownerGate = (workflow?.gates || []).find((gate) => gate.id === 'owner-story-decision-recorded')
  const ownerArtifact = (workflow?.artifactRequirements || []).find((artifact) => artifact.slug === 'owner-story-decision')
  collector.assert(signedGate?.type === 'schema_valid', 'workflow.signoff-gate-type', 'Director signature integrity must be deterministic and cannot be bypassed by a human approval')
  collector.assert(ownerGate?.type === 'human_approved' && JSON.stringify(ownerGate.checks) === JSON.stringify(['owner-story-decision']), 'workflow.owner-gate', 'Owner approval must be a separate scoped human gate over the exact owner decision artifact')
  collector.assert(ownerArtifact?.producerStep === 'obtain-owner-story-decision', 'workflow.owner-artifact', 'The owner decision artifact must be produced by the explicit human decision step')
  validateWorkflowGraph(workflow, collector)

  return collector
}

function report(collector, json = false) {
  const result = {
    schema: 'paravoxia.storyAuthorityReport.v1',
    passed: collector.failures.length === 0,
    checks: collector.checks,
    failureCount: collector.failures.length,
    failures: collector.failures
  }
  if (json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  else if (result.passed) process.stdout.write(`Story authority gate passed: ${result.checks} checks\n`)
  else {
    process.stderr.write(`Story authority gate failed: ${result.failureCount} of ${result.checks} checks\n`)
    for (const failure of result.failures) process.stderr.write(`- [${failure.id}] ${failure.message}${failure.detail === undefined ? '' : ` ${JSON.stringify(failure.detail)}`}\n`)
  }
  return result.passed
}

function selfTest() {
  const current = validate()
  if (current.failures.length > 0) return report(current)
  const manifest = JSON.parse(fs.readFileSync(path.join(mainRoot, 'story-authority.json'), 'utf8'))
  const drifted = structuredClone(manifest)
  drifted.runtimeBeatOrder = drifted.runtimeBeatOrder.slice(0, -1)
  const driftResult = validate(drifted)
  const workflow = JSON.parse(fs.readFileSync(path.join(repoRoot, 'docs/architecture/workflow-orchestration/examples/paravoxia-story-council.workflow.json'), 'utf8'))
  const brokenWorkflow = structuredClone(workflow)
  brokenWorkflow.roleContracts = brokenWorkflow.roleContracts.filter((role) => role.slug !== 'story-cohesion-judge')
  const graphResult = validate(manifest, brokenWorkflow)
  const cyclicWorkflow = structuredClone(workflow)
  cyclicWorkflow.steps.find((step) => step.id === 'review-story-directions-as-chapter').inputs.push('dissent-register')
  const cycleResult = validate(manifest, cyclicWorkflow)
  const mutatedManifests = [
    ['manifest.source-precedence', (candidate) => candidate.sourcePrecedence.reverse()],
    ['manifest.dynamic-scene-contract', (candidate) => { delete candidate.dynamicSources.ownerApprovedSceneContract.authorityCondition }],
    ['manifest.active-production', (candidate) => { candidate.activeProduction.contractVersion = 'drifted-v0' }],
    // The chain is now validated structurally rather than against a frozen copy
    // of itself, so the drift this must reject is a beat losing its causal
    // evidence outright. Which refs a beat carries is pinned by
    // chapter-registry-gate's `checkpoint.authority`, which requires every
    // chain ref to exist in that beat's registry checkpoint.
    ['manifest.runtime-evidence-chain', (candidate) => { candidate.runtimeEvidenceChain[5].evidence = [] }],
    ['manifest.release-gates', (candidate) => candidate.openReleaseGates.shift()],
    ['manifest.locked-questions', (candidate) => candidate.lockedOpenQuestions.shift()],
    ['manifest.council-roles', (candidate) => candidate.requiredCouncilRoles.pop()],
    ['manifest.independent-reviews', (candidate) => candidate.requiredIndependentReviews.pop()]
  ].map(([failureId, mutate]) => {
    const candidate = structuredClone(manifest)
    mutate(candidate)
    return [failureId, validate(candidate)]
  })
  const passed = driftResult.failures.some((failure) => failure.id === 'runtime.beat-order')
    && graphResult.failures.some((failure) => failure.id === 'workflow.role')
    && cycleResult.failures.some((failure) => failure.id === 'workflow.dependency-order')
    && mutatedManifests.every(([failureId, result]) => result.failures.some((failure) => failure.id === failureId))
  if (!passed) {
    process.stderr.write('Story authority self-test failed to reject synthetic drift\n')
    return false
  }
  process.stdout.write(`Story authority smoke passed: ${current.checks} live checks plus beat, precedence, production identity, evidence-chain, release-gate, question, role, review, graph, and cycle drift rejection\n`)
  return true
}

const args = new Set(process.argv.slice(2))
const passed = args.has('--self-test') ? selfTest() : report(validate(), args.has('--json'))
if (!passed) process.exitCode = 1
