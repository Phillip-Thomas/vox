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

function includesNormalized(source, phrase) {
  return source.replace(/\s+/g, ' ').includes(phrase.replace(/\s+/g, ' '))
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

  collector.assert(manifest.schema === 'paravoxia.storyAuthority.v1', 'manifest.schema', 'Story authority manifest schema must be paravoxia.storyAuthority.v1')
  collector.assert(manifest.status?.documentationLane === 'existing-story-reconciliation', 'manifest.docs-lane', 'Documentation lane must identify existing-story reconciliation')
  collector.assert(manifest.status?.runtimeLane === 'blocked-by-demo-lock', 'manifest.runtime-lane', 'Runtime lane must remain blocked by the demo lock')
  collector.assert(/^\d{4}-\d{2}-\d{2}$/.test(manifest.snapshotDate || ''), 'manifest.snapshot-date', 'Story authority snapshotDate must be an ISO calendar date')

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
  const manifestBeats = manifest.shippedBeatOrder || []
  collector.assert(JSON.stringify(runtimeBeats) === JSON.stringify(manifestBeats), 'runtime.beat-order', 'Machine authority must exactly match the shipped STORY_BEAT_ORDER', { runtimeBeats, manifestBeats })
  collector.assert(new Set(manifestBeats).size === manifestBeats.length, 'manifest.beat-duplicates', 'Shipped beat order cannot contain duplicate IDs')
  const ceilingIndex = manifestBeats.indexOf(manifest.status?.storyCeiling)
  collector.assert(ceilingIndex >= 0 && manifestBeats[ceilingIndex + 1] === manifest.status?.publicTerminalBeat, 'manifest.story-ceiling', 'The public terminal must immediately follow the current story ceiling')
  const contractedBeats = (manifest.contractedContinuation || []).map((entry) => entry.beat)
  const expectedContinuation = [
    { beat: 'ch4-audit', scene: 'S6', status: 'CONTRACTED' },
    { beat: 'ch4-comply', scene: 'S7', status: 'CONTRACTED' },
    { beat: 'ch4-defy', scene: 'S8', status: 'CONTRACTED' },
    { beat: 'a4-exhale', scene: 'S9', awakening: 'A4', status: 'CONTRACTED' },
    { beat: 'ch4-meat', scene: 'S10', status: 'CONTRACTED' },
    { beat: 'ch4-dive', scene: 'S11', status: 'CONTRACTED' },
    { beat: 'ch4-repair', scene: 'S12', status: 'CONTRACTED' },
    { beat: 'ch4-flight', scene: 'S13', status: 'CONTRACTED' }
  ]
  collector.assert(JSON.stringify(manifest.contractedContinuation) === JSON.stringify(expectedContinuation), 'manifest.contracted-continuation', 'S6-S13 continuation IDs, scene numbers, A4 marker, order, and CONTRACTED status are protected', {
    expected: expectedContinuation,
    actual: manifest.contractedContinuation
  })
  collector.assert(contractedBeats.length === 8 && new Set(contractedBeats).size === contractedBeats.length, 'manifest.contracted-beats', 'S6-S13 need eight unique contracted beat IDs')
  collector.assert(contractedBeats.every((beat) => !manifestBeats.includes(beat)), 'runtime.future-leak', 'Contracted continuation beats must not appear in shipped runtime', contractedBeats.filter((beat) => manifestBeats.includes(beat)))
  const expectedRuntimeGates = [
    'headed-primitive-journey',
    'fauna-triangle-budget',
    'full-client-verify',
    'batch-3-existing-story-screening',
    'owner-opens-post-arrival-lane'
  ]
  collector.assert(JSON.stringify(manifest.openRuntimeGates) === JSON.stringify(expectedRuntimeGates), 'manifest.runtime-gates', 'The exact runtime-opening gate sequence is protected', {
    expected: expectedRuntimeGates,
    actual: manifest.openRuntimeGates
  })
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
  for (const entry of manifest.contractedContinuation || []) {
    collector.assert(bible.includes(`\`${entry.beat}\``), 'bible.contracted-id', `Story Bible must name the contracted runtime ID ${entry.beat}`)
  }
  for (const phrase of ['Portable canon snapshot', 'Worker 9 remains conscious', 'third consciousness', 'W-7744 is recurring', 'Makers remain TBD', 'DEMO LOCK']) {
    collector.assert(includesNormalized(bible, phrase), 'bible.canon-lock', `Story Bible is missing canon/status marker: ${phrase}`)
  }
  for (const phrase of ['BLOCKED BY DEMO LOCK', 'existing-story reconciliation', 'owner explicitly opens post-arrival runtime work', 'PARAVOXIA_STORY_BIBLE.md']) {
    collector.assert(includesNormalized(executionPlan, phrase), 'plan.authority-marker', `Story Execution Plan is missing authority marker: ${phrase}`)
  }
  for (const phrase of ['Do not build `ch4-audit`, S6-S13, A4', 'Any copy change inside the existing story requires an explicit owner decision']) {
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
  drifted.shippedBeatOrder = drifted.shippedBeatOrder.slice(0, -1)
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
    ['manifest.contracted-continuation', (candidate) => { candidate.contractedContinuation[0].status = 'PROPOSED' }],
    ['manifest.runtime-gates', (candidate) => candidate.openRuntimeGates.shift()],
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
  process.stdout.write(`Story authority smoke passed: ${current.checks} live checks plus beat, precedence, dynamic-source, continuation, gate, question, role, review, graph, and cycle drift rejection\n`)
  return true
}

const args = new Set(process.argv.slice(2))
const passed = args.has('--self-test') ? selfTest() : report(validate(), args.has('--json'))
if (!passed) process.exitCode = 1
