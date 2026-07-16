#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..')
const workflowRoot = path.join(repoRoot, 'docs', 'architecture', 'workflow-orchestration')
const relative = (...parts) => path.join(repoRoot, ...parts)

const FILES = {
  contextPack: relative('docs/architecture/workflow-orchestration/context-packs/paravoxia-creative-triad.context.json'),
  frontendContextPack: relative('docs/architecture/workflow-orchestration/context-packs/frontend-design.context.json'),
  workflow: relative('docs/architecture/workflow-orchestration/examples/paravoxia-creative-triad.workflow.json'),
  storyWorkflow: relative('docs/architecture/workflow-orchestration/examples/paravoxia-story-council.workflow.json'),
  chapterAcceptanceWorkflow: relative('docs/architecture/workflow-orchestration/examples/paravoxia-chapter-acceptance.workflow.json'),
  chapterAcceptanceProfile: relative('docs/architecture/workflow-orchestration/run-profiles/paravoxia-chapter-acceptance.run-profile.json'),
  chapterAcceptanceBindings: relative('docs/architecture/workflow-orchestration/examples/paravoxia-chapter-acceptance.local.adapter-bindings.json'),
  storyCouncilBindings: relative('docs/architecture/workflow-orchestration/examples/paravoxia-story-council.local.adapter-bindings.json'),
  paravoxiaBindings: relative('.terra/context-source-bindings/paravoxia-creative-triad.local.json'),
  frontendBindings: relative('.terra/context-source-bindings/frontend-design.local.json'),
  rubric: relative('docs/architecture/workflow-orchestration/rubrics/paravoxia-creative-cohesion.rubric.json'),
  taxonomy: relative('docs/architecture/workflow-orchestration/defect-taxonomies/paravoxia-creative.defect-taxonomy.json'),
  sceneSchema: relative('docs/architecture/workflow-orchestration/schemas/paravoxia-scene-contract.schema.json'),
  sceneTemplate: relative('.codex/production-runs/_template/scene-contract.json'),
  uxBaselineTemplate: relative('.codex/production-runs/_template/shipped-ux-baseline.json'),
  uxLifecycleTemplate: relative('.codex/production-runs/_template/objective-lifecycle-evidence.json'),
  authority: relative('main/story-authority.json'),
  package: relative('main/package.json'),
}

const PROFILE_PATHS = ['delta', 'scene', 'chapter', 'flagship'].map((mode) =>
  path.join(workflowRoot, 'run-profiles', `paravoxia-creative-${mode}.run-profile.json`),
)
PROFILE_PATHS.push(FILES.chapterAcceptanceProfile)
const UX_RUNTIME_SOURCES = [
  'src/story/ux/objectiveDirector.ts',
  'src/story/ux/feedbackCues.ts',
  'src/story/ux/StoryGuidanceHud.tsx',
]
const UX_ARTIFACTS = ['shipped-ux-baseline', 'objective-lifecycle-evidence', 'ux-audit']
const CHAPTER_ACCEPTANCE_INPUTS = [
  'user-request',
  'target-repo',
  'target-chapter',
  'candidate-revision',
  'production-authority',
  'chapter-registry',
  'signed-council-authority',
  'signed-scene-authority',
  'previous-chapter-context',
  'next-chapter-context',
]
const CHAPTER_ACCEPTANCE_REVIEWS = [
  'story-audit',
  'score-audit',
  'cinematography-audit',
  'ux-audit',
  'naive-audience-report',
  'implementation-correctness-audit',
]

class Audit {
  checks = []

  assert(condition, code, message, details = undefined) {
    this.checks.push({ passed: Boolean(condition), code, message, ...(details === undefined ? {} : { details }) })
  }

  get failures() {
    return this.checks.filter((check) => !check.passed)
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function loadConfiguration() {
  return {
    contextPack: readJson(FILES.contextPack),
    frontendContextPack: readJson(FILES.frontendContextPack),
    workflow: readJson(FILES.workflow),
    storyWorkflow: readJson(FILES.storyWorkflow),
    chapterAcceptanceWorkflow: readJson(FILES.chapterAcceptanceWorkflow),
    chapterAcceptanceProfile: readJson(FILES.chapterAcceptanceProfile),
    chapterAcceptanceBindings: readJson(FILES.chapterAcceptanceBindings),
    storyCouncilBindings: readJson(FILES.storyCouncilBindings),
    paravoxiaBindings: readJson(FILES.paravoxiaBindings),
    frontendBindings: readJson(FILES.frontendBindings),
    rubric: readJson(FILES.rubric),
    taxonomy: readJson(FILES.taxonomy),
    sceneSchema: readJson(FILES.sceneSchema),
    sceneTemplate: readJson(FILES.sceneTemplate),
    uxBaselineTemplate: readJson(FILES.uxBaselineTemplate),
    uxLifecycleTemplate: readJson(FILES.uxLifecycleTemplate),
    authority: readJson(FILES.authority),
    packageJson: readJson(FILES.package),
    profiles: PROFILE_PATHS.map(readJson),
  }
}

function includesAll(values, required) {
  const set = new Set(values || [])
  return required.every((value) => set.has(value))
}

function findRole(workflow, slug) {
  return (workflow.roleContracts || []).find((role) => role.slug === slug)
}

function findArtifact(workflow, slug) {
  return (workflow.artifactRequirements || []).find((artifact) => artifact.slug === slug)
}

function findStep(workflow, predicate) {
  return (workflow.steps || []).find(predicate)
}

function findGate(workflow, id) {
  return (workflow.gates || []).find((gate) => gate.id === id)
}

// Keep this parser deliberately aligned with TerraForm/scripts/dev/workflow-run.mjs.
// The chapter lane further restricts the runtime grammar to explicit literal RHS
// values so cross-artifact comparisons and pseudo-functions cannot silently pass.
function parseTerraRuntimeComparison(expression) {
  const match = String(expression).match(/^(.+?)\s*(>=|<=|==|>|<)\s*(.+)$/)
  if (!match) return null
  return {
    path: match[1].trim(),
    operator: match[2],
    rawExpected: match[3].trim(),
  }
}

function isExplicitTerraLiteral(raw) {
  if (raw === 'true' || raw === 'false') return true
  if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(raw)) return true
  return /^"(?:[^"\\]|\\.)*"$/.test(raw)
}

function isTerraResolvablePath(value) {
  return /^[a-z0-9_-]+(?:\.[a-z0-9_-]+)+$/i.test(value)
}

function validateContextBindings(config, audit, { checkPaths = true } = {}) {
  audit.assert(
    config.frontendContextPack.schema === 'terra.contextPack.v1'
      && config.frontendContextPack.identity?.slug === 'frontend-design'
      && config.frontendContextPack.identity?.version === 'v1',
    'context.frontend-catalog',
    'The portable frontend-design context pack must be available in the project-local Terra catalog.',
  )
  const sourceRef = (config.contextPack.sourceRefs || []).find((source) => source.slug === 'story-ux-runtime')
  audit.assert(
    sourceRef?.bindingKey === 'paravoxia.storyUxRuntime' && sourceRef?.required === true,
    'context.ux-source',
    'The portable creative context pack must require the bounded story UX runtime source.',
  )

  const bindings = config.paravoxiaBindings
  audit.assert(bindings.schema === 'terra.contextSourceBindingSet.v1', 'bindings.schema', 'Paravoxia context bindings must use terra.contextSourceBindingSet.v1.')
  audit.assert(bindings.contextPackRef === 'paravoxia-creative-triad@v1', 'bindings.context-ref', 'Paravoxia bindings must target the creative-triad context pack.')
  audit.assert(bindings.scope?.portable === true, 'bindings.portable', 'Committed project bindings must remain repo-relative and portable.')

  for (const requiredSource of (config.contextPack.sourceRefs || []).filter((source) => source.required)) {
    const binding = (bindings.sourceBindings || []).find((candidate) => candidate.sourceRef === requiredSource.slug)
    audit.assert(Boolean(binding), 'bindings.required-source', `Required context source ${requiredSource.slug} must be bound.`)
    if (!binding) continue
    audit.assert(binding.bindingKey === requiredSource.bindingKey && binding.required === true, 'bindings.source-contract', `Binding ${requiredSource.slug} must preserve its binding key and required status.`)
    audit.assert(!path.isAbsolute(binding.path || ''), 'bindings.relative-path', `Binding ${requiredSource.slug} must use a repo-relative path.`)
    if (!checkPaths || !binding.path) continue
    const resolved = path.resolve(repoRoot, binding.path)
    const exists = resolved.startsWith(`${repoRoot}${path.sep}`) && fs.existsSync(resolved)
    const kindMatches = exists && (binding.kind === 'directory' ? fs.statSync(resolved).isDirectory() : fs.statSync(resolved).isFile())
    audit.assert(kindMatches, 'bindings.path', `Binding ${requiredSource.slug} must resolve to the declared file or directory inside the repo.`, binding.path)
  }

  const frontend = config.frontendBindings
  audit.assert(frontend.schema === 'terra.contextSourceBindingSet.v1' && frontend.contextPackRef === 'frontend-design@v1', 'frontend-bindings.schema', 'Frontend design context must use a project-local Terra binding set.')
  const frontendDoc = (frontend.sourceBindings || []).find((binding) => binding.sourceRef === 'frontend-design-system-doc')
  const frontendRoot = (frontend.sourceBindings || []).find((binding) => binding.sourceRef === 'frontend-design-system-root')
  audit.assert(frontendDoc?.path === 'main/src/story/ux/README.md' && frontendDoc?.required === true, 'frontend-bindings.doc', 'The frontend context document must be the co-located story UX contract.')
  audit.assert(frontendRoot?.path === 'main/src/story/ux', 'frontend-bindings.root', 'The optional frontend context root must point at the executable story UX directory.')
}

function validateWorkflow(config, audit) {
  const workflow = config.workflow
  audit.assert(includesAll(workflow.scope?.contextPackRefs, ['paravoxia-creative-triad@v1', 'frontend-design@v1']), 'workflow.context-packs', 'The creative workflow must load both Paravoxia and portable frontend-design context.')
  for (const artifact of UX_ARTIFACTS) audit.assert(Boolean(findArtifact(workflow, artifact)), 'workflow.ux-artifact', `Workflow must declare ${artifact}.`)

  const directors = ['chapter-director', 'score-director', 'cinematography-director']
  const declaredDirectors = (workflow.roleContracts || []).map((role) => role.slug).filter((slug) => slug?.endsWith('-director'))
  audit.assert(declaredDirectors.length === directors.length && includesAll(declaredDirectors, directors), 'workflow.exactly-three-directors', 'UX review must preserve exactly the Chapter, Score, and Cinematography peer directors.')
  for (const slug of directors) {
    audit.assert((findRole(workflow, slug)?.allowedInputs || []).includes('shipped-ux-baseline'), 'workflow.director-grounding', `${slug} must receive shipped-ux-baseline.`)
  }

  const verifier = findRole(workflow, 'mechanical-verifier')
  audit.assert(includesAll(verifier?.requiredOutputs, ['shipped-ux-baseline', 'objective-lifecycle-evidence']), 'workflow.verifier-output', 'Mechanical verification must produce shipped UX grounding and lifecycle proof.')
  const uxAuditor = findRole(workflow, 'player-experience-auditor')
  audit.assert(Boolean(uxAuditor) && includesAll(uxAuditor.allowedInputs, ['shipped-ux-baseline', 'objective-lifecycle-evidence', 'raw-audiovisual-evidence']) && (uxAuditor.requiredOutputs || []).includes('ux-audit'), 'workflow.ux-auditor', 'A fresh read-only Player Experience Auditor must review source grounding and raw lifecycle evidence.')
  audit.assert(includesAll(uxAuditor?.forbiddenActions, ['patch:write', 'publish:write']), 'workflow.ux-auditor-boundary', 'The Player Experience Auditor must remain read-only and unable to publish.')

  const moderator = findRole(workflow, 'review-moderator')
  const judge = findRole(workflow, 'cohesion-judge')
  const quality = findRole(workflow, 'artifact-quality-auditor')
  audit.assert((moderator?.allowedInputs || []).includes('ux-audit'), 'workflow.moderator-input', 'The canonical defect moderator must consume the UX audit.')
  audit.assert(includesAll(judge?.allowedInputs, UX_ARTIFACTS), 'workflow.judge-input', 'The cohesion judge must see UX grounding, proof, and independent audit.')
  audit.assert(includesAll(quality?.allowedInputs, UX_ARTIFACTS), 'workflow.quality-input', 'The deterministic artifact-quality lane must inspect all UX artifacts.')

  const baselineStep = findStep(workflow, (step) => (step.outputs || []).includes('shipped-ux-baseline'))
  const proofStep = findStep(workflow, (step) => (step.outputs || []).includes('objective-lifecycle-evidence'))
  const auditStep = findStep(workflow, (step) => (step.outputs || []).includes('ux-audit'))
  audit.assert(baselineStep?.roleContractRef === 'mechanical-verifier', 'workflow.baseline-step', 'A mechanical verifier must capture shipped UX before treatment.')
  audit.assert(proofStep?.roleContractRef === 'mechanical-verifier', 'workflow.proof-step', 'A mechanical verifier must capture objective lifecycle evidence.')
  audit.assert(auditStep?.roleContractRef === 'player-experience-auditor' && auditStep?.executionGroup === 'independent-reviews', 'workflow.audit-step', 'UX audit must run as a fresh independent review.')

  const proofChecks = findGate(workflow, 'proof-matrix-complete')?.checks || []
  const reviewChecks = findGate(workflow, 'independent-reviews-complete')?.checks || []
  audit.assert(proofChecks.some((check) => check.includes('objective-lifecycle-evidence')), 'workflow.proof-gate', 'Proof gate must inspect the objective lifecycle evidence.')
  audit.assert(reviewChecks.some((check) => check.includes('ux-audit')), 'workflow.review-gate', 'Independent review gate must require the UX audit.')
  audit.assert((workflow.inspection?.qualityQuestions || []).some((question) => /objective|guidance|next action/i.test(question)), 'workflow.quality-question', 'Inspection must ask whether the player can find and perform the next action.')
}

function validateChapterAcceptance(config, audit) {
  const workflow = config.chapterAcceptanceWorkflow
  const profile = config.chapterAcceptanceProfile
  const bindings = config.chapterAcceptanceBindings
  const requiredArtifacts = [
    'chapter-registry-report',
    'council-authority-bundle',
    'scene-authority-bundle',
    'council-compliance-matrix',
    'chapter-implementation-map',
    'chapter-mechanical-evidence',
    'chapter-functional-evidence',
    'chapter-boundary-continuity-evidence',
    'raw-audiovisual-evidence',
    'objective-lifecycle-evidence',
    ...CHAPTER_ACCEPTANCE_REVIEWS,
    'independent-review-integrity-report',
    'critic-report',
    'defect-register',
    'final-scorecard',
    'repair-commission',
    'chapter-acceptance-report',
  ]
  const requiredRoles = [
    'story-inventory-verifier',
    'mechanical-verifier',
    'narrative-auditor',
    'score-continuity-auditor',
    'cinematography-continuity-auditor',
    'player-experience-auditor',
    'blind-scene-viewer',
    'implementation-correctness-auditor',
    'review-moderator',
    'cohesion-judge',
    'artifact-quality-auditor',
  ]
  const requiredGates = [
    'acceptance-scope-read-only',
    'registry-and-authority-bound',
    'council-compliance-passes',
    'implementation-correctness-proven',
    'chapter-functional-proof-complete',
    'chapter-boundary-proof-complete',
    'chapter-audiovisual-proof-complete',
    'independent-chapter-reviews-complete',
    'canonical-defects-complete',
    'no-blocking-defects',
    'cohesion-score-passes',
    'human-taste-disposition-valid',
    'chapter-acceptance-decision-valid',
  ]

  audit.assert(
    workflow.schema === 'terra.workflowSpec.v1'
      && workflow.identity?.slug === 'paravoxia-chapter-acceptance'
      && workflow.identity?.version === 'v1',
    'chapter-acceptance.identity',
    'Implemented chapter acceptance must remain a versioned Terra workflow.',
  )
  audit.assert(
    workflow.scope?.mutationPolicy === 'read_only_acceptance'
      && workflow.scope?.defaultRunProfileRef === 'paravoxia-chapter-acceptance@v1'
      && includesAll(workflow.scope?.contextPackRefs, ['paravoxia-creative-triad@v1', 'frontend-design@v1']),
    'chapter-acceptance.scope',
    'Chapter acceptance must be read-only and grounded in the creative-triad and shipped UX contexts.',
  )
  audit.assert(
    (workflow.inputs || []).length === CHAPTER_ACCEPTANCE_INPUTS.length
      && includesAll((workflow.inputs || []).map((input) => input.slug), CHAPTER_ACCEPTANCE_INPUTS),
    'chapter-acceptance.inputs',
    'Chapter acceptance must bind the exact revision, registry, signed council and scene authority, and neighboring chapter context.',
  )
  audit.assert(
    includesAll((workflow.artifactRequirements || []).map((artifact) => artifact.slug), requiredArtifacts),
    'chapter-acceptance.artifacts',
    'Chapter acceptance must declare authority, implementation, functional, boundary, audiovisual, review, repair, and final report artifacts.',
  )
  audit.assert(
    includesAll((workflow.roleContracts || []).map((role) => role.slug), requiredRoles),
    'chapter-acceptance.roles',
    'Chapter acceptance must retain verifier, independent review, moderator, judge, and artifact-quality roles.',
  )
  for (const role of workflow.roleContracts || []) {
    audit.assert(
      includesAll(role.forbiddenActions, ['patch:write', 'publish:write']),
      'chapter-acceptance.read-only-role',
      `${role.slug} must explicitly forbid patch and publish writes.`,
    )
  }
  audit.assert(
    !(workflow.adapterRequirements || []).some((requirement) => requirement.family === 'patch_adapter')
      && !(workflow.steps || []).some((step) =>
        /patch|publish/i.test(step.id || '')
          || (step.outputs || []).some((output) => /patch|publish/i.test(output))
          || /patch|publish/i.test(step.mutationPolicy || ''),
      ),
    'chapter-acceptance.read-only',
    'The acceptance graph must have no patch adapter and no patch or publish step.',
  )

  const reviewSteps = (workflow.steps || []).filter((step) => step.executionGroup === 'independent-chapter-reviews')
  audit.assert(
    reviewSteps.length === CHAPTER_ACCEPTANCE_REVIEWS.length
      && includesAll(reviewSteps.flatMap((step) => step.outputs || []), CHAPTER_ACCEPTANCE_REVIEWS)
      && new Set(reviewSteps.map((step) => step.roleContractRef)).size === CHAPTER_ACCEPTANCE_REVIEWS.length,
    'chapter-acceptance.independent-reviews',
    'Story, score, cinema, UX, blind-viewer, and implementation reviews must run as six independent lanes.',
  )
  for (const id of requiredGates) {
    const gate = findGate(workflow, id)
    audit.assert(Boolean(gate) && (gate.checks || []).length > 0, 'chapter-acceptance.gate', `Chapter acceptance must deterministically enforce ${id}.`)
  }

  const declaredArtifactRoots = new Set((workflow.artifactRequirements || []).map((artifact) => artifact.slug))
  const runtimeRoots = new Set([...declaredArtifactRoots, 'check-results', 'defects', 'final-scorecard'])
  const invalidGateExpressions = (workflow.gates || []).flatMap((gate) => (gate.checks || []).flatMap((check) => {
    const parsed = parseTerraRuntimeComparison(check)
    const root = parsed?.path.split('.')[0]
    return parsed
      && isTerraResolvablePath(parsed.path)
      && isExplicitTerraLiteral(parsed.rawExpected)
      && runtimeRoots.has(root)
      ? []
      : [{ gate: gate.id, check }]
  }))
  const invalidActivationExpressions = (workflow.steps || []).flatMap((step) => {
    if (!step.activationCondition) return []
    const parsed = parseTerraRuntimeComparison(step.activationCondition)
    const root = parsed?.path.split('.')[0]
    return parsed
      && isTerraResolvablePath(parsed.path)
      && isExplicitTerraLiteral(parsed.rawExpected)
      && runtimeRoots.has(root)
      ? []
      : [{ step: step.id, activationCondition: step.activationCondition }]
  })
  audit.assert(
    invalidGateExpressions.length === 0 && invalidActivationExpressions.length === 0,
    'chapter-acceptance.gate-runtime-grammar',
    'Every chapter gate and activation condition must parse under Terra runtime comparison grammar with a resolvable path and explicit literal RHS.',
    [...invalidGateExpressions, ...invalidActivationExpressions],
  )
  audit.assert(
    !(workflow.gates || []).some((gate) => ['human_approved', 'no_blocking_defects', 'score_threshold', 'artifact_exists'].includes(gate.type)),
    'chapter-acceptance.no-special-gate-bypass',
    'Chapter acceptance must use inspectable schema comparisons instead of human, score-exception, defect-summary, or mixed artifact-existence shortcuts.',
  )

  const mechanicalArtifact = findArtifact(workflow, 'chapter-mechanical-evidence')
  const mechanicalStep = findStep(workflow, (step) => step.id === 'run-chapter-functional-proof')
  const qualityStep = findStep(workflow, (step) => step.id === 'audit-chapter-acceptance-artifacts')
  const integrityStep = findStep(workflow, (step) => step.id === 'verify-independent-review-integrity')
  audit.assert(
    mechanicalArtifact?.schemaRef === 'paravoxia.chapterMechanicalEvidence.v1'
      && mechanicalArtifact?.producerStep === 'run-chapter-functional-proof'
      && (mechanicalStep?.outputs || []).includes('chapter-mechanical-evidence')
      && (findRole(workflow, 'mechanical-verifier')?.requiredOutputs || []).includes('chapter-mechanical-evidence')
      && (findRole(workflow, 'cohesion-judge')?.allowedInputs || []).includes('chapter-mechanical-evidence')
      && (findRole(workflow, 'artifact-quality-auditor')?.allowedInputs || []).includes('chapter-mechanical-evidence'),
    'chapter-acceptance.mechanical-evidence-binding',
    'The bound browser report must be a first-class chapter-mechanical-evidence artifact consumed by review and final quality audit.',
  )
  audit.assert(
    integrityStep?.roleContractRef === 'artifact-quality-auditor'
      && (integrityStep?.outputs || []).includes('independent-review-integrity-report')
      && findArtifact(workflow, 'independent-review-integrity-report')?.producerStep === integrityStep?.id,
    'chapter-acceptance.review-integrity-producer',
    'A deterministic producer must verify review sessions, isolation, and source hashes before moderation.',
  )

  const noBlockingGate = findGate(workflow, 'no-blocking-defects')
  const canonicalDefectsGate = findGate(workflow, 'canonical-defects-complete')
  const defectArtifact = findArtifact(workflow, 'defect-register')
  audit.assert(
    noBlockingGate?.type === 'schema_valid'
      && includesAll(noBlockingGate?.checks, [
        'defect-register.openCritical == 0',
        'defect-register.openHigh == 0',
        'defect-register.openMediumUnaccepted == 0',
        'defect-register.countsMatchEntries == true',
      ]),
    'chapter-acceptance.material-defect-policy',
    'Critical, high, and unaccepted material medium defects must all block through the canonical defect register.',
  )
  audit.assert(
    defectArtifact?.schemaRef === 'paravoxia.chapterDefectRegister.v1'
      && includesAll(canonicalDefectsGate?.checks, [
        'defect-register.schema == "paravoxia.chapterDefectRegister.v1"',
        'defect-register.operatorSynchronizationPassed == true',
        'defect-register.operatorReviewCoverageVerified == true',
        'defect-register.runDefectsMirrorCurrent == true',
        'check-results.canonicalDefectsSynchronized == true',
        'check-results.operatorReviewCoverageVerified == true',
      ]),
    'chapter-acceptance.canonical-defect-sync',
    'The canonical findings artifact must be schema-bound and deterministically synchronized before gates or routing may trust it.',
  )

  const mechanicalRepair = findStep(workflow, (step) => step.id === 'emit-mechanical-repair-commission')
  const repair = findStep(workflow, (step) => step.id === 'emit-bounded-repair-commission')
  audit.assert(
    mechanicalRepair?.roleContractRef === 'chapter-acceptance-orchestrator'
      && mechanicalRepair.activationCondition === 'check-results.repairRequired == true'
      && includesAll(mechanicalRepair.inputs, ['chapter-mechanical-evidence', 'check-results'])
      && (mechanicalRepair.outputs || []).includes('repair-commission')
      && repair?.roleContractRef === 'chapter-acceptance-orchestrator'
      && (repair.outputs || []).includes('repair-commission')
      && includesAll(repair.inputs, ['defect-register', 'check-results'])
      && repair.activationCondition === 'check-results.canonicalRepairRequired == true'
      && !(repair.outputs || []).some((output) => /patch|publish|implementation-diff/i.test(output)),
    'chapter-acceptance.repair-commission',
    'Failed acceptance must emit a conditional evidence-bound repair commission without self-patching.',
  )
  const finalize = findStep(workflow, (step) => step.id === 'finalize-chapter-acceptance')
  audit.assert((finalize?.outputs || []).includes('chapter-acceptance-report'), 'chapter-acceptance.final-report', 'The lane must finish with chapter-acceptance-report.')
  const humanRole = findRole(workflow, 'human-approver')
  const humanStep = findStep(workflow, (step) => step.id === 'record-headed-taste')
  const humanGate = findGate(workflow, 'human-taste-disposition-valid')
  const humanGateChecks = humanGate?.checks || []
  const finalDecisionChecks = findGate(workflow, 'chapter-acceptance-decision-valid')?.checks || []
  audit.assert(
    includesAll(humanRole?.forbiddenActions, ['model:infer', 'automated:approve'])
      && includesAll(humanStep?.adapterRequirementRefs, ['acceptance-human-decision-recorder'])
      && (humanStep?.allowedAdapterFamilies || []).length === 1
      && humanStep.allowedAdapterFamilies[0] === 'review_adapter'
      && humanStep.activationCondition === 'check-results.humanTasteRequested == true'
      && !(humanStep.gatesAfter || []).includes('human-taste-disposition-valid')
      && includesAll(qualityStep?.gatesAfter, ['human-taste-disposition-valid', 'acceptance-artifact-quality-passes'])
      && humanGate?.type === 'schema_valid'
      && includesAll(humanGateChecks, [
        'chapter-acceptance-quality-report.humanTasteDispositionValid == true',
        'chapter-acceptance-quality-report.acceptedHumanApprovalValid == true',
        'chapter-acceptance-quality-report.finalDispositionPolicyPassed == true',
      ])
      && finalDecisionChecks.includes('chapter-acceptance-report.humanTastePolicyPassed == true'),
    'chapter-acceptance.human-provenance',
    'Accepted taste approval must be validated after artifact audit, not bypassed by a generic approved decision record.',
  )
  audit.assert(
    includesAll((workflow.stopConditions || []).map((condition) => condition.id), ['accepted', 'machine-ready-for-human-taste', 'repair-commissioned', 'blocked-authority-or-evidence']),
    'chapter-acceptance.stop-conditions',
    'Acceptance must stop distinctly for accepted, human-taste pending, repair, and missing-evidence dispositions.',
  )

  audit.assert(
    profile.schema === 'terra.runProfile.v1'
      && profile.identity?.slug === 'paravoxia-chapter-acceptance'
      && profile.mode === 'read_only_implemented_chapter_acceptance'
      && profile.executionBudget?.maxPatchLoops === 0,
    'chapter-acceptance.profile',
    'The focused acceptance profile must remain deep, read-only, and patch-loop free.',
  )
  audit.assert(
    profile.autonomousLoopPolicy?.enabled === false
      && profile.autonomousLoopPolicy?.emitRepairCommissionInsteadOfPatch === true
      && profile.autonomousLoopPolicy?.repairWorkflowRef === 'paravoxia-creative-triad@v1',
    'chapter-acceptance.profile-repair',
    'The profile must route bounded repairs to a separate creative-triad run.',
  )
  audit.assert(
    profile.approval?.humanTasteApproval?.requiredForAcceptedDisposition === true
      && profile.approval?.humanTasteApproval?.requiresHeadedRealGpuEvidence === true
      && profile.approval?.humanTasteApproval?.requiresAudiblePlayback === true
      && profile.approval?.humanTasteApproval?.machineReadyDispositionAllowedWithoutHuman === true
      && !(profile.requiredEvidence || []).includes('human-decision')
      && (profile.conditionalEvidence?.accepted || []).includes('human-decision'),
    'chapter-acceptance.human-taste',
    'Accepted disposition must require headed real-GPU and audible taste while allowing an honest machine-ready stop.',
  )
  audit.assert(
    includesAll(profile.requiredEvidence, requiredArtifacts.filter((artifact) => artifact !== 'repair-commission')),
    'chapter-acceptance.profile-evidence',
    'The acceptance profile must require the complete authority, execution, review, cohesion, and report evidence set.',
  )
  audit.assert(
    includesAll(profile.stateCoverage?.requiredStates, ['every_registered_child_scene', 'manual_play', 'movie_mode', 'previous_chapter_boundary', 'next_chapter_boundary', 'objective_enter', 'objective_marker_ready', 'objective_completion_clear']),
    'chapter-acceptance.state-coverage',
    'Acceptance must cover every child scene, manual and movie modes, both boundaries, and objective guidance lifecycle.',
  )

  audit.assert(
    bindings.schema === 'terra.adapterBindingSet.v1'
      && bindings.workflowSpecRef === 'paravoxia-chapter-acceptance@v1'
      && bindings.operatorControls?.privilegedCommandsRequireApproval === true
      && bindings.operatorControls?.repoWritesRequireReview === true
      && bindings.operatorControls?.publishRequiresExplicitDecision === true,
    'chapter-acceptance.bindings',
    'Local bindings must target this acceptance graph and preserve operator controls.',
  )
  audit.assert(
    !(bindings.bindings || []).some((binding) => binding.family === 'patch_adapter')
      && (bindings.patchCatalog || []).length === 0
      && (bindings.bindings || []).every((binding) => binding.limits?.publishAllowed === false),
    'chapter-acceptance.binding-boundary',
    'Acceptance bindings must expose no patch adapter or publish-capable runner.',
  )
  const humanDecisionBinding = (bindings.bindings || []).find((binding) => binding.requirementId === 'acceptance-human-decision-recorder')
  const automatedReviewBinding = (bindings.bindings || []).find((binding) => binding.requirementId === 'acceptance-review-runner')
  audit.assert(
    humanDecisionBinding?.configuration?.identityClass === 'human_operator'
      && humanDecisionBinding?.configuration?.requiresInteractiveConfirmation === true
      && humanDecisionBinding?.configuration?.modelInferenceAllowed === false
      && humanDecisionBinding?.limits?.automatedApprovalAllowed === false,
    'chapter-acceptance.human-binding',
    'The taste-decision binding must require an interactive human identity and forbid automated approval.',
  )
  audit.assert(
    !(automatedReviewBinding?.capabilities || []).includes('human_operator_decision')
      && !(automatedReviewBinding?.capabilities || []).includes('record_taste_decision')
      && (automatedReviewBinding?.capabilities || []).includes('route_operator_taste_decision'),
    'chapter-acceptance.review-taste-boundary',
    'Automated independent review may route a taste decision but may never record the human operator decision.',
  )
  const commands = bindings.commandCatalog || []
  const commandIds = commands.map((command) => command.id)
  const commandResultKeys = Object.fromEntries(commands.map((command) => [command.id, command.resultKey]))
  const acceptanceCommand = commands.find((command) => command.id === 'chapter-acceptance-check')
  const implementationGateChecks = findGate(workflow, 'implementation-correctness-proven')?.checks || []
  const functionalGateChecks = findGate(workflow, 'chapter-functional-proof-complete')?.checks || []
  audit.assert(
    includesAll(commandIds, ['chapter-registry-check', 'chapter-acceptance-check', 'chapter-static-typecheck', 'chapter-static-tests', 'chapter-static-build'])
      && commands.every((command) => command.privileged === false && Array.isArray(command.argv) && ['npm', 'node'].includes(command.argv[0]))
      && acceptanceCommand?.argv?.join(' ') === 'node main/tools/chapter-acceptance-workflow-command.mjs'
      && acceptanceCommand?.timeoutMs === 600000
      && acceptanceCommand?.executionPolicy?.genericAdapterMode === 'bounded_smoke_only'
      && /chapter:accept:workflow/.test(acceptanceCommand?.executionPolicy?.productionEntrypoint || '')
      && acceptanceCommand?.executionPolicy?.productionResultPersistence === 'terra.commandResult.v1'
      && commands.every((command) => !/(^|\s)(sh|bash|patch|publish|deploy)(\s|$)/i.test(command.argv.join(' '))),
    'chapter-acceptance.safe-commands',
    'Bindings must expose only argv-based, non-privileged registry, acceptance, typecheck, test, and build commands.',
  )
  audit.assert(
    commandResultKeys['chapter-registry-check'] === 'chapterRegistryCheck'
      && commandResultKeys['chapter-acceptance-check'] === 'chapterAcceptanceCheck'
      && commandResultKeys['chapter-static-typecheck'] === 'chapterStaticTypecheck'
      && commandResultKeys['chapter-static-tests'] === 'chapterStaticTests'
      && commandResultKeys['chapter-static-build'] === 'chapterStaticBuild'
      && includesAll(implementationGateChecks, [
        'check-results.chapterRegistryCheck == true',
        'check-results.chapterStaticTypecheck == true',
        'check-results.chapterStaticTests == true',
        'check-results.chapterStaticBuild == true',
      ])
      && !implementationGateChecks.includes('check-results.chapterAcceptanceCheck == true')
      && functionalGateChecks.includes('check-results.chapterAcceptanceCheck == true'),
    'chapter-acceptance.command-result-keys',
    'Gate check paths must exactly match binding resultKeys, and browser acceptance may only gate the browser proof step.',
  )
  audit.assert(
    includesAll((bindings.roleCatalog || []).map((adapter) => adapter.id), ['acceptance-analysis', 'independent-review'])
      && (bindings.roleCatalog || []).every((adapter) => adapter.privileged === false)
      && (bindings.roleCatalog || []).every((adapter) => adapter.argv?.[1] === 'main/tools/chapter-acceptance-role-cli-runner.mjs'),
    'chapter-acceptance.role-bindings',
    'Local operation must provide separate non-privileged analysis and independent-review bindings through the guarded chapter-only runner.',
  )
  const expectedStepLane = (step) => {
    if (step.type === 'human_decision') return ['review_adapter', 'acceptance-human-decision-recorder']
    if (step.type === 'deterministic_check' || step.type === 'tool_task'
      || (step.type === 'artifact_collection' && step.roleContractRef === 'mechanical-verifier')) {
      return ['tool_adapter', 'acceptance-tool-runner']
    }
    if (step.type === 'review') return ['review_adapter', 'acceptance-review-runner']
    return ['model_adapter', 'acceptance-reasoning-runner']
  }
  audit.assert(
    (workflow.steps || []).every((step) => {
      const [family, requirementId] = expectedStepLane(step)
      return step.allowedAdapterFamilies?.length === 1
        && step.allowedAdapterFamilies[0] === family
        && step.adapterRequirementRefs?.length === 1
        && step.adapterRequirementRefs[0] === requirementId
    }),
    'chapter-acceptance.exact-execution-lanes',
    'Every chapter step must name one exact adapter family and one exact binding requirement so tool, model, review, and human lanes cannot impersonate each other.',
  )
  audit.assert(
    (config.storyCouncilBindings.roleCatalog || []).every((adapter) => adapter.argv?.[1] === 'main/tools/story-council-role-cli-runner.mjs')
      && !(config.storyCouncilBindings.roleCatalog || []).some((adapter) => adapter.argv?.includes('main/tools/chapter-acceptance-role-cli-runner.mjs')),
    'chapter-acceptance.shared-runner-isolation',
    'The existing story-council workflow must retain its original compatible runner; chapter guards must remain chapter-local.',
  )
  audit.assert(
    config.packageJson.scripts?.['chapter:accept:workflow'] === 'node tools/creative-chapter-acceptance-workflow.mjs'
      && config.packageJson.scripts?.['chapter:accept:workflow:smoke'] === 'node tools/creative-chapter-acceptance-workflow-smoke.mjs'
      && fs.existsSync(relative('main/tools/creative-chapter-acceptance-workflow.mjs'))
      && fs.existsSync(relative('main/tools/creative-chapter-acceptance-workflow-smoke.mjs'))
      && fs.existsSync(relative('main/tools/chapter-acceptance-workflow-command.mjs'))
      && fs.existsSync(relative('main/tools/chapter-acceptance-role-cli-runner.mjs')),
    'chapter-acceptance.operator-entrypoints',
    'Package scripts and target-aware command wrapper must expose both production operation and honest lifecycle smoke entrypoints.',
  )
  const operatorSource = fs.readFileSync(relative('main/tools/creative-chapter-acceptance-workflow.mjs'), 'utf8')
  const commandWrapperSource = fs.readFileSync(relative('main/tools/chapter-acceptance-workflow-command.mjs'), 'utf8')
  const roleWrapperSource = fs.readFileSync(relative('main/tools/chapter-acceptance-role-cli-runner.mjs'), 'utf8')
  audit.assert(
    roleWrapperSource.includes("canonicalSource: 'validated_artifact_content_plus_operator_provenance'")
      && roleWrapperSource.includes("const markdownMetadataSchema = 'paravoxia.chapterAcceptanceMarkdownMetadata.v1'")
      && roleWrapperSource.includes('semanticSummaryFromContent(output, artifactContract, spec)')
      && roleWrapperSource.includes('validateGateVisibleSummary(output.slug, semanticSummary, spec)')
      && roleWrapperSource.includes('validateClaimedSummary(output.summary, semanticSummary, provenance, output.slug)')
      && roleWrapperSource.includes('output.summary = { ...semanticSummary, ...provenance }'),
    'chapter-acceptance.content-derived-role-summaries',
    'Chapter role summaries must be derived from validated JSON content or fenced Markdown metadata plus operator provenance; model summaries may only be checked for contradictions.',
  )
  audit.assert(
    commandWrapperSource.includes("PARAVOXIA_CANDIDATE_REVISION")
      && commandWrapperSource.includes("chapter-mechanical-evidence.json")
      && operatorSource.includes("artifact.summary =")
      && operatorSource.includes("repairRequired: report.disposition === 'repair-required'")
      && operatorSource.includes("blockedAuthorityOrEvidence: report.disposition === 'blocked'")
      && operatorSource.includes("report.chapter?.id !== expectedChapter")
      && operatorSource.includes("report.source?.revision !== expectedRevision")
      && operatorSource.includes('requireCanonicalAcceptanceRunFile(values.run)')
      && operatorSource.includes('synchronizeCanonicalDefectRegister(runPath)')
      && operatorSource.includes('canonicalRepairRequired: synchronization.repairRequired')
      && operatorSource.includes('requireSafeNewAcceptanceRunDir(requestedOutDir)')
      && operatorSource.includes('await rejectSymlinkDescendants(canonicalRunDir)')
      && operatorSource.includes('fixEvidenceRef is required for fixed material findings')
      && operatorSource.includes('duplicate cycle detected')
      && operatorSource.includes('operatorReviewCoverageVerified: false')
      && operatorSource.includes('continueWorkflow(runPath)')
      && operatorSource.includes("code: 'missing_deterministic_adapter'")
      && operatorSource.includes("code: 'human_operator_required'")
      && operatorSource.includes("code: 'missing_role_runner_configuration'")
      && roleWrapperSource.includes('validateInvocation(lane, invocation, spec, bindingSet)')
      && roleWrapperSource.includes('validateRoleResult(result, guardedInvocation, executionContract, spec, priorSessions)')
      && roleWrapperSource.includes('executionIdentity.sessionId'),
    'chapter-acceptance.operator-mechanical-attachment',
    'The operator must bind candidate identity, attach red or green mechanical evidence, expose review summaries, set routing bits, and reject wrong-run reports.',
  )
}

function validateProfilesAndJudgement(config, audit) {
  for (const profile of config.profiles) {
    const evidence = profile.requiredEvidence || []
    const baseline = evidence.includes('shipped-ux-baseline') || evidence.includes('shipped-ux-baselines')
    audit.assert(baseline && includesAll(evidence, ['objective-lifecycle-evidence', 'ux-audit']), 'profile.ux-evidence', `${profile.identity?.slug} must require baseline, lifecycle, and audit UX evidence.`)
    const states = profile.stateCoverage?.requiredStates || []
    audit.assert(states.some((state) => /objective|guidance/i.test(state)), 'profile.ux-state', `${profile.identity?.slug} must cover objective lifecycle or guidance state.`)
  }

  const interaction = (config.rubric.categories || []).find((category) => category.slug === 'interaction_accessibility_and_variants')
  const interactionSignals = (interaction?.signals || []).join(' ')
  const allSignals = (config.rubric.categories || []).flatMap((category) => category.signals || []).join(' ')
  audit.assert(/objective/i.test(interactionSignals) && /marker/i.test(interactionSignals) && /feedback/i.test(allSignals), 'rubric.ux-signals', 'Judgement must cover objective clarity, marker parity, and feedback ownership.')
  audit.assert((config.taxonomy.categories || []).some((category) => category.slug === 'objective_guidance_failure'), 'taxonomy.ux-defect', 'Defect routing must include objective_guidance_failure.')
}

function validateStoryAndRuntimeSetup(config, audit, { checkPaths = true } = {}) {
  const runtimeEvidence = config.authority.sources?.runtimeEvidence || []
  audit.assert(includesAll(runtimeEvidence, UX_RUNTIME_SOURCES), 'authority.ux-sources', 'Machine story authority must include every executable story UX source.')
  const storyWorkflow = config.storyWorkflow
  audit.assert((storyWorkflow.scope?.contextPackRefs || []).includes('frontend-design@v1'), 'story-workflow.context', 'The story council must load portable frontend-design context.')
  audit.assert(Boolean(findArtifact(storyWorkflow, 'shipped-ux-baseline')), 'story-workflow.baseline', 'The story council inventory must emit shipped-ux-baseline.')

  const vite = fs.readFileSync(relative('main/vite.config.ts'), 'utf8')
  const tsconfig = readJson(relative('main/tsconfig.json'))
  const feedbackSource = fs.readFileSync(relative('main/src/story/ux/feedbackCues.ts'), 'utf8')
  const markerBridge = fs.readFileSync(relative('main/src/story/StoryDirectorDriver.tsx'), 'utf8')
  const overlayMount = fs.readFileSync(relative('main/src/story/StoryOverlays.tsx'), 'utf8')
  audit.assert(/test\.\{ts,tsx\}/.test(vite), 'tests.vitest-tsx', 'Vitest must collect story UX TSX tests.')
  audit.assert((tsconfig.include || []).includes('src/**/*.test.tsx'), 'tests.typescript-tsx', 'TypeScript must include TSX tests.')
  audit.assert(!/markMilestone|advanceToBeat|completeStory|dispatchGameplayCommand/.test(feedbackSource), 'runtime.feedback-boundary', 'Semantic UX feedback must remain unable to advance gameplay or story progression.')
  audit.assert(markerBridge.includes('observeGuidedStoryMarker'), 'runtime.marker-bridge', 'The existing story marker driver must report exact marker resolution to objective health.')
  audit.assert(overlayMount.includes('StoryGuidanceHud'), 'runtime.hud-mount', 'The persistent story guidance HUD must remain mounted in the existing overlay stack.')
  audit.assert(config.packageJson.scripts?.['story:ux:check'] && config.packageJson.scripts?.['creative:workflow:check'], 'scripts.workflow-checks', 'Package scripts must expose targeted UX and workflow checks.')
  audit.assert(config.packageJson.scripts?.verify?.includes('creative:workflow:check'), 'scripts.verify-chain', 'The standard verification chain must enforce the creative workflow configuration gate.')

  const guidance = config.sceneTemplate.guidance
  const templateObjective = guidance?.objectives?.[0]
  audit.assert(config.sceneSchema.properties?.guidance?.$ref === '#/$defs/guidance' && config.sceneSchema.$defs?.guidanceObjective, 'production.guidance-schema', 'The signed scene contract schema must support the player-guidance lifecycle.')
  audit.assert(
    guidance?.baselineArtifact === 'shipped-ux-baseline.json'
      && guidance?.lifecycleEvidenceArtifact === 'objective-lifecycle-evidence.json'
      && guidance?.auditArtifact === 'ux-audit.md'
      && templateObjective?.feedback?.presentationOnly === true
      && templateObjective?.feedback?.advancesProgression === false,
    'production.guidance-template',
    'New production runs must contract all three UX artifacts and presentation-only feedback.',
  )
  audit.assert(Array.isArray(config.uxBaselineTemplate.sourceFiles) && config.uxBaselineTemplate.objectiveContract?.markerMatching === 'exact' && Array.isArray(config.uxBaselineTemplate.markerAndWorkOrderMap), 'production.baseline-template', 'The shipped UX template must capture hashed sources and exact objective/marker grounding.')
  audit.assert(Array.isArray(config.uxLifecycleTemplate.objectives) && config.uxLifecycleTemplate.objectives[0]?.variants?.lowestQuality && Array.isArray(config.uxLifecycleTemplate.objectives[0]?.resetResults), 'production.lifecycle-template', 'The lifecycle template must carry objective, variant, and reset proof.')

  if (checkPaths) {
    for (const file of [
      'main/src/story/ux/README.md',
      '.codex/production-runs/_template/shipped-ux-baseline.json',
      '.codex/production-runs/_template/objective-lifecycle-evidence.json',
      '.codex/production-runs/_template/ux-audit.md',
      '.claude/agents/player-experience-auditor.md',
    ]) audit.assert(fs.existsSync(relative(file)), 'setup.file', `Required UX workflow file must exist: ${file}`)

    const agentFiles = [
      'CLAUDE.md',
      '.claude/skills/creative-triad/SKILL.md',
      '.claude/agents/chapter-director.md',
      '.claude/agents/score-director.md',
      '.claude/agents/cinematography-director.md',
      '.claude/agents/story-verifier.md',
      '.claude/agents/scene-cohesion-judge.md',
      '.claude/agents/player-experience-auditor.md',
    ]
    for (const file of agentFiles) {
      const source = fs.readFileSync(relative(file), 'utf8')
      audit.assert(source.includes('main/src/story/ux/README.md'), 'setup.agent-grounding', `${file} must load the executable story UX contract.`)
    }
  }
}

function validateConfiguration(config, options = {}) {
  const audit = new Audit()
  validateContextBindings(config, audit, options)
  validateWorkflow(config, audit)
  validateChapterAcceptance(config, audit)
  validateProfilesAndJudgement(config, audit)
  validateStoryAndRuntimeSetup(config, audit, options)
  return audit
}

function printAudit(audit, label) {
  if (audit.failures.length === 0) {
    process.stdout.write(`${label} passed: ${audit.checks.length} checks\n`)
    return
  }
  process.stderr.write(`${label} failed: ${audit.failures.length} of ${audit.checks.length} checks\n`)
  for (const failure of audit.failures) process.stderr.write(`- [${failure.code}] ${failure.message}${failure.details === undefined ? '' : `: ${JSON.stringify(failure.details)}`}\n`)
  process.exitCode = 1
}

function runSelfTest(config) {
  const live = validateConfiguration(config)
  if (live.failures.length) {
    printAudit(live, 'Creative workflow UX configuration smoke')
    return
  }

  const missingSource = structuredClone(config)
  missingSource.contextPack.sourceRefs = missingSource.contextPack.sourceRefs.filter((source) => source.slug !== 'story-ux-runtime')
  const sourceAudit = validateConfiguration(missingSource, { checkPaths: false })
  if (!sourceAudit.failures.some((failure) => failure.code === 'context.ux-source')) throw new Error('Self-test did not reject a missing UX context source.')

  const missingAuditor = structuredClone(config)
  missingAuditor.workflow.roleContracts = missingAuditor.workflow.roleContracts.filter((role) => role.slug !== 'player-experience-auditor')
  const auditorAudit = validateConfiguration(missingAuditor, { checkPaths: false })
  if (!auditorAudit.failures.some((failure) => failure.code === 'workflow.ux-auditor')) throw new Error('Self-test did not reject a missing Player Experience Auditor.')

  const missingAuthority = structuredClone(config)
  missingAuthority.authority.sources.runtimeEvidence = missingAuthority.authority.sources.runtimeEvidence.filter((source) => source !== UX_RUNTIME_SOURCES[0])
  const authorityAudit = validateConfiguration(missingAuthority, { checkPaths: false })
  if (!authorityAudit.failures.some((failure) => failure.code === 'authority.ux-sources')) throw new Error('Self-test did not reject missing UX runtime authority.')

  const fourthDirector = structuredClone(config)
  fourthDirector.workflow.roleContracts.push({ schema: 'terra.roleContract.v1', slug: 'ux-director' })
  const directorAudit = validateConfiguration(fourthDirector, { checkPaths: false })
  if (!directorAudit.failures.some((failure) => failure.code === 'workflow.exactly-three-directors')) throw new Error('Self-test did not reject a fourth creative director.')

  const bypassedVerify = structuredClone(config)
  bypassedVerify.packageJson.scripts.verify = bypassedVerify.packageJson.scripts.verify.replace('npm run creative:workflow:check && ', '')
  const verifyAudit = validateConfiguration(bypassedVerify, { checkPaths: false })
  if (!verifyAudit.failures.some((failure) => failure.code === 'scripts.verify-chain')) throw new Error('Self-test did not reject a standard verification chain that bypasses workflow configuration.')

  const missingGuidance = structuredClone(config)
  delete missingGuidance.sceneTemplate.guidance
  const guidanceAudit = validateConfiguration(missingGuidance, { checkPaths: false })
  if (!guidanceAudit.failures.some((failure) => failure.code === 'production.guidance-template')) throw new Error('Self-test did not reject a production template without signed UX guidance.')

  const patchCapableAcceptance = structuredClone(config)
  patchCapableAcceptance.chapterAcceptanceWorkflow.adapterRequirements.push({
    schema: 'terra.adapterRequirement.v1',
    id: 'forbidden-acceptance-patch-runner',
    family: 'patch_adapter',
  })
  const patchCapableAudit = validateConfiguration(patchCapableAcceptance, { checkPaths: false })
  if (!patchCapableAudit.failures.some((failure) => failure.code === 'chapter-acceptance.read-only')) throw new Error('Self-test did not reject a patch-capable chapter acceptance graph.')

  const missingAcceptanceEvidence = structuredClone(config)
  missingAcceptanceEvidence.chapterAcceptanceWorkflow.artifactRequirements = missingAcceptanceEvidence.chapterAcceptanceWorkflow.artifactRequirements.filter(
    (artifact) => artifact.slug !== 'chapter-boundary-continuity-evidence',
  )
  const missingAcceptanceEvidenceAudit = validateConfiguration(missingAcceptanceEvidence, { checkPaths: false })
  if (!missingAcceptanceEvidenceAudit.failures.some((failure) => failure.code === 'chapter-acceptance.artifacts')) throw new Error('Self-test did not reject chapter acceptance without boundary evidence.')

  const unsupportedRuntimeGrammar = structuredClone(config)
  findGate(unsupportedRuntimeGrammar.chapterAcceptanceWorkflow, 'chapter-boundary-proof-complete').checks[0] = 'chapter-boundary-continuity-evidence.targetToNext.status in [pass, contract-validated]'
  const unsupportedRuntimeGrammarAudit = validateConfiguration(unsupportedRuntimeGrammar, { checkPaths: false })
  if (!unsupportedRuntimeGrammarAudit.failures.some((failure) => failure.code === 'chapter-acceptance.gate-runtime-grammar')) throw new Error('Self-test did not reject a gate expression unsupported by the Terra runtime parser.')

  const humanApprovalBypass = structuredClone(config)
  findGate(humanApprovalBypass.chapterAcceptanceWorkflow, 'human-taste-disposition-valid').type = 'human_approved'
  const humanApprovalBypassAudit = validateConfiguration(humanApprovalBypass, { checkPaths: false })
  if (!humanApprovalBypassAudit.failures.some((failure) => failure.code === 'chapter-acceptance.no-special-gate-bypass')) throw new Error('Self-test did not reject the generic human_approved bypass.')

  const mediumDefectBypass = structuredClone(config)
  const mediumGate = findGate(mediumDefectBypass.chapterAcceptanceWorkflow, 'no-blocking-defects')
  mediumGate.checks = mediumGate.checks.filter((check) => check !== 'defect-register.openMediumUnaccepted == 0')
  const mediumDefectBypassAudit = validateConfiguration(mediumDefectBypass, { checkPaths: false })
  if (!mediumDefectBypassAudit.failures.some((failure) => failure.code === 'chapter-acceptance.material-defect-policy')) throw new Error('Self-test did not reject an unaccepted material-medium defect bypass.')

  const unsynchronizedDefectRoute = structuredClone(config)
  findStep(unsynchronizedDefectRoute.chapterAcceptanceWorkflow, (step) => step.id === 'emit-bounded-repair-commission').activationCondition = 'defects.open.total > 0'
  const unsynchronizedDefectRouteAudit = validateConfiguration(unsynchronizedDefectRoute, { checkPaths: false })
  if (!unsynchronizedDefectRouteAudit.failures.some((failure) => failure.code === 'chapter-acceptance.repair-commission')) throw new Error('Self-test did not reject repair routing disconnected from canonical synchronized findings.')

  const commandKeyDrift = structuredClone(config)
  commandKeyDrift.chapterAcceptanceBindings.commandCatalog.find((command) => command.id === 'chapter-static-tests').resultKey = 'tests'
  const commandKeyDriftAudit = validateConfiguration(commandKeyDrift, { checkPaths: false })
  if (!commandKeyDriftAudit.failures.some((failure) => failure.code === 'chapter-acceptance.command-result-keys')) throw new Error('Self-test did not reject a command resultKey that drifted from its gate path.')

  const orphanMechanicalEvidence = structuredClone(config)
  findStep(orphanMechanicalEvidence.chapterAcceptanceWorkflow, (step) => step.id === 'run-chapter-functional-proof').outputs = ['chapter-functional-evidence', 'verification-report', 'objective-lifecycle-evidence', 'check-results']
  const orphanMechanicalEvidenceAudit = validateConfiguration(orphanMechanicalEvidence, { checkPaths: false })
  if (!orphanMechanicalEvidenceAudit.failures.some((failure) => failure.code === 'chapter-acceptance.mechanical-evidence-binding')) throw new Error('Self-test did not reject an orphan mechanical browser report.')

  const impersonatedToolLane = structuredClone(config)
  findStep(impersonatedToolLane.chapterAcceptanceWorkflow, (step) => step.id === 'inventory-chapter-authority').allowedAdapterFamilies = ['model_adapter']
  const impersonatedToolLaneAudit = validateConfiguration(impersonatedToolLane, { checkPaths: false })
  if (!impersonatedToolLaneAudit.failures.some((failure) => failure.code === 'chapter-acceptance.exact-execution-lanes')) throw new Error('Self-test did not reject model impersonation of a deterministic tool step.')

  const sharedRunnerRegression = structuredClone(config)
  sharedRunnerRegression.storyCouncilBindings.roleCatalog[0].argv[1] = 'main/tools/chapter-acceptance-role-cli-runner.mjs'
  const sharedRunnerRegressionAudit = validateConfiguration(sharedRunnerRegression, { checkPaths: false })
  if (!sharedRunnerRegressionAudit.failures.some((failure) => failure.code === 'chapter-acceptance.shared-runner-isolation')) throw new Error('Self-test did not reject applying chapter-only guards to the shared story-council runner.')

  process.stdout.write(`Creative workflow UX configuration smoke passed: ${live.checks.length} live checks plus runtime-grammar, human-bypass, medium-defect, defect-routing, result-key, mechanical-artifact, lane-impersonation, and shared-runner rejection cases\n`)
}

try {
  const config = loadConfiguration()
  if (process.argv.includes('--self-test')) runSelfTest(config)
  else printAudit(validateConfiguration(config), 'Creative workflow UX configuration gate')
} catch (error) {
  process.stderr.write(`Creative workflow UX configuration error: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 2
}
