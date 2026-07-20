#!/usr/bin/env node

import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '../..')
const terraRoot = path.resolve(repoRoot, '../TerraForm')
const specPath = path.join(
  repoRoot,
  'docs/architecture/workflow-orchestration/examples/paravoxia-chapter-acceptance.workflow.json',
)
const bindingsPath = path.join(
  repoRoot,
  'docs/architecture/workflow-orchestration/examples/paravoxia-chapter-acceptance.local.adapter-bindings.json',
)
const commandWrapperPath = path.join(repoRoot, 'main/tools/chapter-acceptance-workflow-command.mjs')
const operatorPath = path.join(repoRoot, 'main/tools/creative-chapter-acceptance-workflow.mjs')
const guardedRoleWrapperPath = path.join(repoRoot, 'main/tools/chapter-acceptance-role-cli-runner.mjs')
const acceptanceArtifactRoot = path.join(repoRoot, '.terra/workflow-runs/paravoxia-chapter-acceptance')
const smokeArtifactRoot = path.join(acceptanceArtifactRoot, '_lifecycle-smoke')
const fixtureChapter = 'ch5'
const reviewArtifacts = [
  'story-audit',
  'score-audit',
  'cinematography-audit',
  'ux-audit',
  'naive-audience-report',
  'implementation-correctness-audit',
]

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    'out-dir': {
      type: 'string',
      default: path.join(smokeArtifactRoot, `run-${process.pid}`),
    },
    help: { type: 'boolean', default: false },
  },
})

try {
  if (values.help) {
    printUsage()
    process.exit(0)
  }
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exit(1)
}

async function main() {
  await requireFile(specPath, 'chapter-acceptance workflow')
  await requireFile(bindingsPath, 'chapter-acceptance adapter bindings')
  await requireFile(commandWrapperPath, 'chapter-acceptance workflow command wrapper')
  await requireFile(operatorPath, 'chapter-acceptance workflow operator')
  await requireFile(guardedRoleWrapperPath, 'guarded chapter-acceptance role wrapper')
  await requireFile(path.join(terraRoot, 'scripts/dev/workflow-run.mjs'), 'Terra workflow runner')

  const outDir = path.resolve(values['out-dir'])
  assert(
    outDir !== smokeArtifactRoot && outDir.startsWith(`${smokeArtifactRoot}${path.sep}`),
    `--out-dir must resolve to a child directory under ${toRepoPath(smokeArtifactRoot)}`,
  )
  const runPath = path.join(outDir, 'run.json')
  await fs.rm(outDir, { recursive: true, force: true })

  await runNode([
    path.join(terraRoot, 'scripts/dev/workflow-run.mjs'),
    'validate',
    '--spec',
    specPath,
  ])
  await runNode([
    path.join(terraRoot, 'scripts/dev/workflow-bindings-validation.mjs'),
    '--spec',
    specPath,
    '--bindings',
    bindingsPath,
  ])
  await runNode([guardedRoleWrapperPath, '--self-test'])
  await runNode([operatorPath, '--self-test'])
  await runNode([
    path.join(terraRoot, 'scripts/dev/workflow-run.mjs'),
    'init',
    '--spec',
    specPath,
    '--out-dir',
    outDir,
    '--run-id',
    'paravoxia-chapter-acceptance-workflow-smoke',
    '--input',
    'user-request=Lifecycle wiring proof only; do not perform or claim chapter acceptance.',
    '--input',
    'target-repo=.',
    '--input',
    `target-chapter=${fixtureChapter}`,
    '--input',
    'candidate-revision=fixture-revision-without-real-evidence',
    '--input',
    'production-authority=PARAVOXIA_DEMO_FOUNDATION_PLAN.md',
    '--input',
    'chapter-registry=main/chapter-registry.json',
    '--input',
    'chapter-journey-contract=main/chapter-journey-contract.json',
    '--input',
    'signed-council-authority=fixture://missing-signed-council-authority',
    '--input',
    'signed-scene-authority=fixture://missing-signed-scene-authority',
    '--input',
    'previous-chapter-context=fixture://missing-previous-chapter-context',
    '--input',
    'next-chapter-context=fixture://missing-next-chapter-context',
  ])

  await recordResolvedBindings(runPath)
  await runNode([
    path.join(terraRoot, 'scripts/dev/workflow-role.mjs'),
    '--run',
    runPath,
    '--spec',
    specPath,
    '--bindings',
    bindingsPath,
    '--step',
    'lock-chapter-acceptance',
    '--adapter',
    'acceptance-analysis',
    '--dry-run',
  ])
  await runNode([
    path.join(terraRoot, 'scripts/dev/workflow-command.mjs'),
    '--run',
    runPath,
    '--bindings',
    bindingsPath,
    '--command',
    'chapter-journey-contract-check',
  ])
  await runNode([
    path.join(terraRoot, 'scripts/dev/workflow-command.mjs'),
    '--run',
    runPath,
    '--bindings',
    bindingsPath,
    '--command',
    'chapter-registry-check',
  ])
  await recordAcceptanceCommandDryRun(runPath, outDir)
  await runNode([
    path.join(terraRoot, 'scripts/dev/workflow-run.mjs'),
    'check',
    '--run',
    runPath,
    '--gate',
    'acceptance-scope-read-only',
  ])

  const operatorEnv = { ...process.env }
  delete operatorEnv.PARAVOXIA_STORY_CREATIVE_RUNNER_ARGV_JSON
  delete operatorEnv.PARAVOXIA_STORY_REVIEW_RUNNER_ARGV_JSON
  const operatorStop = await runCapture([
    process.execPath,
    operatorPath,
    '--run',
    runPath,
    '--continue',
  ], operatorEnv)
  assert(operatorStop.exitCode === 0, `operator continuation exited ${operatorStop.exitCode}: ${operatorStop.stderr}`)
  assert(/missing_role_runner_configuration/.test(operatorStop.stdout), 'operator continuation must expose the exact missing runner blocker')

  await recordExpectedBlock(runPath, outDir)
  await validateBlockedProof(runPath)
  await validateLaterGateSemantics(outDir)

  console.log('Paravoxia chapter-acceptance lifecycle proof passed.')
  console.log(`run: ${toRepoPath(runPath)}`)
  console.log('disposition: blocked (expected)')
  console.log('real acceptance or review artifacts generated: 0')
  console.log('later-gate regressions: all expressions passed the Terra evaluator; run-path escape, arbitrary-run, canonical-defect routing, material-medium, human bypass, red attachment, and wrong-run rejection cases passed')
  console.log('next action: provide exact signed authority and real chapter evidence before acceptance can proceed')
}

async function recordResolvedBindings(runPath) {
  const [run, bindingSet] = await Promise.all([readJson(runPath), readJson(bindingsPath)])
  const bindings = new Map(bindingSet.bindings.map((binding) => [binding.requirementId, binding]))

  run.adapterBindings = run.adapterBindings.map((requirement) => {
    const binding = bindings.get(requirement.requirementId)
    if (!binding) throw new Error(`Validated binding set omitted ${requirement.requirementId}`)
    return {
      ...requirement,
      status: 'bound',
      binding: {
        bindingSetRef: `${bindingSet.identity.slug}@${bindingSet.identity.version}`,
        adapterSlug: binding.adapter.slug,
        family: binding.family,
        surface: bindingSet.environment.surface,
        capabilities: binding.capabilities,
      },
    }
  })
  run.bindingValidation = {
    schema: 'terra.adapterBindingValidation.v1',
    status: 'passed',
    bindingSetRef: `${bindingSet.identity.slug}@${bindingSet.identity.version}`,
    checkedAt: new Date().toISOString(),
  }
  run.updatedAt = new Date().toISOString()
  await writeJson(runPath, run)
}

async function recordAcceptanceCommandDryRun(runPath, outDir) {
  const [run, bindingSet] = await Promise.all([readJson(runPath), readJson(bindingsPath)])
  const command = bindingSet.commandCatalog.find((candidate) => candidate.id === 'chapter-acceptance-check')
  assert(command, 'chapter-acceptance-check command binding is missing')
  assert(command.privileged === false, 'chapter-acceptance-check must be non-privileged')
  assert(command.timeoutMs === 600000, 'chapter-acceptance-check must use the maximum validated Terra command window')
  assert(command.argv.join(' ') === 'node main/tools/chapter-acceptance-workflow-command.mjs', 'chapter-acceptance-check must use the target-aware argv wrapper')

  const result = await runCapture([...command.argv, '--dry-run'], {
    ...process.env,
    PARAVOXIA_TARGET_CHAPTER: fixtureChapter,
    PARAVOXIA_CANDIDATE_REVISION: 'fixture-revision-without-real-evidence',
    PARAVOXIA_CHAPTER_ACCEPTANCE_RUN_DIR: outDir,
    PARAVOXIA_CHAPTER_ACCEPTANCE_EXTRA_ARGV_JSON: JSON.stringify([
      '--runs',
      '1',
      '--smoke',
      '--skip-preflight',
      '--screenshot-mode',
      'none',
    ]),
  })
  assert(result.exitCode === 0, `chapter acceptance command dry run exited ${result.exitCode}: ${result.stderr}`)
  const serialized = JSON.parse(result.stdout)
  assert(serialized.schema === 'paravoxia.chapterAcceptanceWorkflowCommand.v1', 'command dry run schema must be explicit')
  assert(serialized.targetChapter === fixtureChapter, 'command dry run must bind the fixture target chapter')
  assert(serialized.candidateRevision === 'fixture-revision-without-real-evidence', 'command dry run must bind the fixture candidate revision')
  assert(serialized.executionMode === 'argv_no_shell', 'command dry run must remain shell-free')
  assert(serialized.dryRun === true, 'command serialization must be a dry run')
  assert(serialized.operatorLongRun === false && serialized.executionPolicy === 'serialization_only', 'lifecycle smoke must not claim the operator-managed long-run path')
  assert(serialized.argv.includes('--chapter') && serialized.argv.includes(fixtureChapter), 'serialized argv must forward --chapter ch5')
  assert(serialized.argv.includes('--candidate-revision') && serialized.argv.includes('fixture-revision-without-real-evidence'), 'serialized argv must forward the exact candidate revision')
  assert(serialized.argv.includes('--max-seconds'), 'serialized argv must include a bounded per-run timeout')
  assert(serialized.outputDir.startsWith(`${acceptanceArtifactRoot}${path.sep}`), 'serialized output must remain under the acceptance artifact root')
  assert(serialized.reportPath.startsWith(`${acceptanceArtifactRoot}${path.sep}`), 'serialized report must remain under the acceptance artifact root')
  assert(serialized.reportPath.endsWith(`${path.sep}evidence${path.sep}mechanical-chapter-acceptance${path.sep}chapter-mechanical-evidence.json`), 'serialized report must target the declared chapter-mechanical-evidence artifact')

  const rejectedRedirect = await runCapture([...command.argv, '--dry-run'], {
    ...process.env,
    PARAVOXIA_TARGET_CHAPTER: fixtureChapter,
    PARAVOXIA_CANDIDATE_REVISION: 'fixture-revision-without-real-evidence',
    PARAVOXIA_CHAPTER_ACCEPTANCE_RUN_DIR: outDir,
    PARAVOXIA_CHAPTER_ACCEPTANCE_EXTRA_ARGV_JSON: JSON.stringify(['--report=main/package.json']),
  })
  assert(rejectedRedirect.exitCode !== 0, 'the workflow command wrapper must reject caller-controlled report paths')
  assert(/may not override.*--report/i.test(rejectedRedirect.stderr), 'redirect rejection must explain the forbidden report override')

  const rejectedRevisionOverride = await runCapture([...command.argv, '--dry-run'], {
    ...process.env,
    PARAVOXIA_TARGET_CHAPTER: fixtureChapter,
    PARAVOXIA_CANDIDATE_REVISION: 'fixture-revision-without-real-evidence',
    PARAVOXIA_CHAPTER_ACCEPTANCE_RUN_DIR: outDir,
    PARAVOXIA_CHAPTER_ACCEPTANCE_EXTRA_ARGV_JSON: JSON.stringify(['--candidate-revision=wrong-revision']),
  })
  assert(rejectedRevisionOverride.exitCode !== 0, 'the workflow command wrapper must reject caller-controlled candidate revision overrides')
  assert(/may not override.*--candidate-revision/i.test(rejectedRevisionOverride.stderr), 'revision rejection must explain the forbidden candidate override')

  const evidencePath = 'evidence/commands/chapter-acceptance-check-dry-run.json'
  await writeJson(path.join(outDir, evidencePath), {
    schema: 'terra.commandDryRun.v1',
    id: command.id,
    resultKey: command.resultKey,
    catalogArgv: command.argv,
    serializedCommand: serialized,
    executed: false,
    callerControlledArtifactRedirectRejected: true,
    callerControlledCandidateRevisionRejected: true,
    proofScope: 'binding_and_argv_serialization_only',
    recordedAt: new Date().toISOString(),
  })

  run.commandDryRuns = [
    ...(run.commandDryRuns || []),
    {
      schema: 'terra.commandDryRun.v1',
      id: command.id,
      resultKey: command.resultKey,
      status: 'dry_run',
      targetChapter: fixtureChapter,
      executed: false,
      callerControlledArtifactRedirectRejected: true,
      callerControlledCandidateRevisionRejected: true,
      evidencePath,
    },
  ]
  run.evidenceBundles = [
    ...(run.evidenceBundles || []),
    {
      schema: 'terra.evidenceBundle.v1',
      id: 'evidence.command.chapter-acceptance-check.dry-run',
      kind: 'command_serialization',
      createdByStep: 'lock-chapter-acceptance',
      artifactRefs: [],
      commandRefs: [evidencePath],
      summary: {
        commandId: command.id,
        targetChapter: fixtureChapter,
        executed: false,
        acceptanceEvidenceClaimed: false,
        callerControlledCandidateRevisionRejected: true,
      },
    },
  ]
  run.updatedAt = new Date().toISOString()
  await writeJson(runPath, run)
}

async function recordExpectedBlock(runPath, outDir) {
  const run = await readJson(runPath)
  const firstStep = run.steps.find((step) => step.id === 'lock-chapter-acceptance')
  if (!firstStep) throw new Error('Initialized run is missing the first chapter-acceptance step')

  const presentArtifacts = run.artifacts.filter((artifact) => artifact.status === 'present')
  if (presentArtifacts.length > 0) {
    throw new Error(`Lifecycle smoke unexpectedly generated acceptance artifacts: ${presentArtifacts.map((item) => item.slug).join(', ')}`)
  }

  const now = new Date().toISOString()
  const proof = {
    schema: 'terra.chapterAcceptanceLifecycleProof.v1',
    workflowSpecRef: run.workflowSpecRef,
    runId: run.id,
    synthetic: true,
    targetChapter: fixtureChapter,
    realAcceptanceEvidenceGenerated: false,
    acceptanceArtifactsGenerated: false,
    reviewArtifactsGenerated: false,
    registryCommandExecuted: true,
    acceptanceCommandExecuted: false,
    acceptanceCommandInvocationSerialized: true,
    callerControlledArtifactRedirectRejected: true,
    callerControlledCandidateRevisionRejected: true,
    bindingValidation: 'passed',
    roleInvocationMode: 'dry_run',
    stoppedAtStep: firstStep.id,
    blockingArtifact: 'chapter-acceptance-lock',
    blockingReason: 'Real exact-revision authority, signed council and scene records, neighboring context, and chapter evidence were intentionally not supplied.',
    checkedGate: 'acceptance-scope-read-only',
    checkedAt: now,
  }
  const proofPath = path.join(outDir, 'evidence/lifecycle-proof.json')
  await fs.mkdir(path.dirname(proofPath), { recursive: true })
  await writeJson(proofPath, proof)

  for (const step of run.steps) step.status = step.id === firstStep.id ? 'blocked' : 'pending'
  run.status = 'blocked'
  run.currentStep = firstStep.id
  run.evidenceBundles = [
    ...(run.evidenceBundles || []),
    {
      schema: 'terra.evidenceBundle.v1',
      id: 'evidence.chapter-acceptance-workflow-smoke',
      kind: 'runtime_trace',
      createdByStep: firstStep.id,
      artifactRefs: [],
      summary: {
        path: 'evidence/lifecycle-proof.json',
        synthetic: true,
        realAcceptanceEvidenceGenerated: false,
        expectedBlockedDisposition: true,
      },
    },
  ]
  run.finalDisposition = {
    schema: 'terra.finalDisposition.v1',
    decision: 'blocked',
    actor: 'paravoxia-chapter-acceptance-workflow-smoke',
    decidedAt: now,
    summary: 'Spec, bindings, safe registry execution, role dry-run serialization, target-aware acceptance-command serialization, persistence, and the first gate were exercised. No acceptance or review artifact was fabricated; the run remains blocked pending real signed authority and exact-revision evidence.',
  }
  run.lifecycleProof = {
    path: 'evidence/lifecycle-proof.json',
    synthetic: true,
    realAcceptanceEvidenceGenerated: false,
    reviewArtifactsGenerated: false,
  }
  run.updatedAt = now
  await writeJson(runPath, run)
}

async function validateBlockedProof(runPath) {
  const run = await readJson(runPath)
  assert(run.schema === 'terra.workflowRun.v1', 'run schema must be terra.workflowRun.v1')
  assert(run.status === 'blocked', 'run must end blocked')
  assert(run.currentStep === 'lock-chapter-acceptance', 'run must stop at the first acceptance step')
  assert(run.operatorExecution?.code === 'missing_role_runner_configuration', 'run must persist the exact missing role-runner blocker')
  assert(run.operatorExecution?.requiredAdapterFamily === 'model_adapter', 'first-step blocker must require the model adapter family')
  assert(run.finalDisposition?.decision === 'blocked', 'run must record a blocked final disposition')
  assert(run.lifecycleProof?.synthetic === true, 'run must identify the proof as synthetic')
  assert(run.lifecycleProof?.realAcceptanceEvidenceGenerated === false, 'run must state that no real acceptance evidence was generated')
  assert(run.lifecycleProof?.reviewArtifactsGenerated === false, 'run must state that no review artifacts were generated')
  assert(run.adapterBindings.every((item) => item.status === 'bound'), 'every required adapter must resolve')
  assert(
    (run.roleInvocations || []).some((item) => item.stepId === 'lock-chapter-acceptance' && item.status === 'dry_run'),
    'the first acceptance role invocation must be serialized as a dry run',
  )
  assert(
    (run.commandResults || []).some((item) => item.id === 'chapter-journey-contract-check' && item.status === 'passed'),
    'journey-contract command result must be persisted and passed',
  )
  assert(
    (run.commandResults || []).some((item) => item.id === 'chapter-registry-check' && item.status === 'passed'),
    'the safe chapter registry command binding must execute successfully',
  )
  assert(
    (run.commandDryRuns || []).some((item) => item.id === 'chapter-acceptance-check' && item.status === 'dry_run' && item.executed === false),
    'the target-aware chapter acceptance command must be serialized but not executed',
  )
  assert(
    (run.commandDryRuns || []).some((item) => item.id === 'chapter-acceptance-check' && item.callerControlledArtifactRedirectRejected === true),
    'the lifecycle proof must reject caller-controlled output or report paths',
  )
  assert(
    (run.commandDryRuns || []).some((item) => item.id === 'chapter-acceptance-check' && item.callerControlledCandidateRevisionRejected === true),
    'the lifecycle proof must reject caller-controlled candidate revision overrides',
  )
  assert(run.artifacts.every((artifact) => artifact.status !== 'present'), 'the lifecycle proof must not fabricate acceptance artifacts')
  assert(
    run.artifacts.filter((artifact) => reviewArtifacts.includes(artifact.slug)).every((artifact) => artifact.status !== 'present'),
    'the lifecycle proof must not fabricate independent review artifacts',
  )
  assert(
    run.gateResults.some((result) => result.gateId === 'acceptance-scope-read-only' && result.status !== 'passed'),
    'the missing chapter-acceptance-lock must block the first gate',
  )
}

async function validateLaterGateSemantics(parentOutDir) {
  const semanticsDir = path.join(parentOutDir, 'gate-semantics')
  const runPath = path.join(semanticsDir, 'run.json')
  await runNode([
    path.join(terraRoot, 'scripts/dev/workflow-run.mjs'),
    'init',
    '--spec',
    specPath,
    '--out-dir',
    semanticsDir,
    '--run-id',
    'paravoxia-chapter-acceptance-gate-semantics',
    '--input',
    'target-chapter=ch5',
    '--input',
    'candidate-revision=fixture-revision-without-real-evidence',
  ])

  for (const slug of reviewArtifacts) {
    await attachSyntheticArtifact(runPath, slug, {
      reviewComplete: true,
      ...(slug === 'naive-audience-report' ? { intentExposure: false } : {}),
    })
  }
  await attachSyntheticArtifact(runPath, 'independent-review-integrity-report', {
    sixReviewArtifactsPresent: true,
    sixUniqueReviewerSessions: true,
    firstWaveIsolationPreserved: true,
    sourceHashesCurrent: true,
  })
  await checkSelectedGates(runPath, ['independent-chapter-reviews-complete'])
  await expectGateStatus(runPath, 'independent-chapter-reviews-complete', 'passed')

  await attachSyntheticArtifact(runPath, 'defect-register', {
    schema: 'paravoxia.chapterDefectRegister.v1',
    sourceReportsComplete: true,
    sourceHashesCurrent: true,
    findingCoverageComplete: true,
    idsUnique: true,
    everyMaterialDefectHasSeverityOwnerEvidenceAndRecheck: true,
    operatorSynchronizationPassed: true,
    operatorReviewCoverageVerified: true,
    runDefectsMirrorCurrent: true,
    openCritical: 0,
    openHigh: 0,
    openMediumUnaccepted: 1,
    countsMatchEntries: true,
  })
  const mediumRun = await readJson(runPath)
  mediumRun.checkResults = {
    ...(mediumRun.checkResults || {}),
    canonicalDefectsSynchronized: true,
    operatorReviewCoverageVerified: true,
  }
  mediumRun.humanDecisions = [{
    schema: 'terra.humanDecision.v1',
    id: 'synthetic-approved-medium-bypass-attempt',
    gateId: 'no-blocking-defects',
    decision: 'approved',
    status: 'approved',
    actor: 'synthetic-human',
    decidedAt: new Date().toISOString(),
  }]
  await writeJson(runPath, mediumRun)
  await checkSelectedGates(runPath, ['canonical-defects-complete', 'no-blocking-defects'])
  await expectGateStatus(runPath, 'canonical-defects-complete', 'passed')
  await expectGateStatus(runPath, 'no-blocking-defects', 'failed')

  await attachSyntheticArtifact(runPath, 'defect-register', {
    schema: 'paravoxia.chapterDefectRegister.v1',
    sourceReportsComplete: true,
    sourceHashesCurrent: true,
    findingCoverageComplete: true,
    idsUnique: true,
    everyMaterialDefectHasSeverityOwnerEvidenceAndRecheck: true,
    operatorSynchronizationPassed: true,
    operatorReviewCoverageVerified: true,
    runDefectsMirrorCurrent: true,
    openCritical: 0,
    openHigh: 0,
    openMediumUnaccepted: 0,
    countsMatchEntries: true,
  })
  await checkSelectedGates(runPath, ['no-blocking-defects'])
  await expectGateStatus(runPath, 'no-blocking-defects', 'passed')

  await attachSyntheticArtifact(runPath, 'chapter-acceptance-quality-report', {
    humanTasteDispositionValid: false,
    acceptedHumanApprovalValid: false,
    finalDispositionPolicyPassed: false,
  })
  const humanRun = await readJson(runPath)
  humanRun.humanDecisions.push({
    schema: 'terra.humanDecision.v1',
    id: 'synthetic-approved-human-bypass-attempt',
    gateId: 'human-taste-disposition-valid',
    decision: 'approved',
    status: 'approved',
    actor: 'synthetic-human',
    decidedAt: new Date().toISOString(),
  })
  await writeJson(runPath, humanRun)
  await checkSelectedGates(runPath, ['human-taste-disposition-valid'])
  await expectGateStatus(runPath, 'human-taste-disposition-valid', 'failed')

  await attachSyntheticArtifact(runPath, 'chapter-acceptance-quality-report', {
    humanTasteDispositionValid: true,
    acceptedHumanApprovalValid: true,
    finalDispositionPolicyPassed: true,
  })
  await checkSelectedGates(runPath, ['human-taste-disposition-valid'])
  await expectGateStatus(runPath, 'human-taste-disposition-valid', 'passed')

  await attachSyntheticArtifact(runPath, 'chapter-acceptance-report', {
    schema: 'paravoxia.chapterAcceptanceReport.v1',
    candidateRevisionMatchesInput: true,
    targetChapterMatchesInput: true,
    councilAuthorityHashMatches: true,
    sceneAuthorityHashMatches: true,
    mechanicalEvidenceHashMatches: true,
    dispositionAllowed: true,
    defectPolicyPassed: true,
    scorePolicyPassed: true,
    humanTastePolicyPassed: true,
    repairCommissionPolicyPassed: true,
  })
  await checkSelectedGates(runPath, ['chapter-acceptance-decision-valid'])
  await expectGateStatus(runPath, 'chapter-acceptance-decision-valid', 'passed')

  await populatePassingGateFixture(runPath)
  const spec = await readJson(specPath)
  await checkSelectedGates(runPath, spec.gates.map((gate) => gate.id))
  for (const gate of spec.gates) await expectGateStatus(runPath, gate.id, 'passed')

  await validateCanonicalDefectRepairRouting(runPath)
  await validateMechanicalArtifactAttachment(runPath)

  await writeJson(path.join(semanticsDir, 'evidence/gate-semantics-proof.json'), {
    schema: 'terra.chapterAcceptanceGateSemanticsProof.v1',
    synthetic: true,
    assertions: {
      independentReviewIntegrityPasses: true,
      approvedDecisionCannotBypassOpenMaterialMedium: true,
      approvedDecisionCannotBypassInvalidHumanProvenance: true,
      correctedMaterialDefectRegisterPasses: true,
      precomputedFinalDecisionChecksPass: true,
      allGateExpressionsPassActualTerraEvaluator: true,
      canonicalDefectFindingRoutesBoundedRepair: true,
      resolvedCanonicalDefectClearsRepairRoute: true,
      materialAcceptedExceptionRejected: true,
      redMechanicalReportAttachedAndRouted: true,
      wrongRunMechanicalReportRejected: true,
    },
    checkedAt: new Date().toISOString(),
  })
}

async function validateCanonicalDefectRepairRouting(runPath) {
  const run = await readJson(runPath)
  const artifact = run.artifacts.find((candidate) => candidate.slug === 'defect-register')
  assert(artifact?.path, 'canonical repair-route fixture requires a defect-register path')
  const registerPath = path.join(path.dirname(runPath), artifact.path)
  const materialFinding = {
    schema: 'terra.defect.v1',
    id: 'synthetic-canonical-medium-route',
    severity: 'medium',
    category: 'objective_guidance_failure',
    description: 'Synthetic material finding proving canonical repair routing.',
    status: 'open',
    ownerRole: 'player-experience-auditor',
    evidenceRef: 'fixture://canonical-medium-route',
    recheck: 'Re-run the exact objective lifecycle proof.',
  }
  const baseRegister = {
    schema: 'paravoxia.chapterDefectRegister.v1',
    sourceReportsComplete: true,
    sourceHashesCurrent: true,
    findingCoverageComplete: true,
    findings: [materialFinding],
    openCritical: 0,
    openHigh: 0,
    openMediumUnaccepted: 1,
    openTotal: 1,
    countsMatchEntries: true,
  }
  await writeJson(registerPath, baseRegister)
  const routed = await runCapture([process.execPath, operatorPath, '--run', runPath], process.env)
  assert(routed.exitCode === 0, `canonical defect synchronization failed: ${routed.stderr}`)
  const routedRun = await readJson(runPath)
  assert(routedRun.checkResults?.canonicalRepairRequired === true, 'open canonical finding must set canonicalRepairRequired')
  assert(routedRun.defects?.[0]?.id === materialFinding.id, 'canonical finding must mirror into run.defects')
  assert(routedRun.checkResults?.operatorReviewCoverageVerified === false, 'model-claimed review coverage must fail closed until deterministic comparison exists')
  const routedRegister = routedRun.artifacts.find((candidate) => candidate.slug === 'defect-register')?.summary
  assert(routedRegister?.sourceReportsComplete === false
    && routedRegister?.sourceHashesCurrent === false
    && routedRegister?.findingCoverageComplete === false
    && routedRegister?.operatorReviewCoverageVerified === false,
  'gate-visible review coverage fields must be operator-derived false')
  assert(routedRun.gateResults.find((result) => result.gateId === 'canonical-defects-complete')?.status === 'failed', 'unverified review coverage must block canonical-defects-complete')
  assert(routedRun.currentStep === 'emit-bounded-repair-commission', `canonical finding must route bounded repair, got ${routedRun.currentStep || 'none'}`)

  const materialException = {
    ...baseRegister,
    findings: [{ ...materialFinding, status: 'accepted_exception' }],
    openMediumUnaccepted: 0,
    openTotal: 0,
  }
  await writeJson(registerPath, materialException)
  const rejectedException = await runCapture([process.execPath, operatorPath, '--run', runPath], process.env)
  assert(rejectedException.exitCode !== 0, 'material accepted_exception must not bypass the canonical repair route')
  assert(/may not use accepted_exception for a material severity/i.test(rejectedException.stderr), 'material accepted_exception rejection must explain the authority boundary')

  await writeJson(registerPath, {
    ...baseRegister,
    findings: [{
      ...materialFinding,
      status: 'fixed',
      fixEvidenceRef: 'fixture://canonical-medium-route-fix',
      recheckResult: { status: 'passed', evidenceRef: 'fixture://canonical-medium-route-recheck' },
    }],
    openMediumUnaccepted: 0,
    openTotal: 0,
  })
  const resolved = await runCapture([process.execPath, operatorPath, '--run', runPath], process.env)
  assert(resolved.exitCode === 0, `resolved canonical defect synchronization failed: ${resolved.stderr}`)
  const resolvedRun = await readJson(runPath)
  assert(resolvedRun.checkResults?.canonicalRepairRequired === false, 'fixed canonical finding must clear canonicalRepairRequired')
  assert(resolvedRun.currentStep !== 'emit-bounded-repair-commission', 'fixed canonical finding must clear the bounded repair route')
}

async function populatePassingGateFixture(runPath) {
  const [run, spec] = await Promise.all([readJson(runPath), readJson(specPath)])
  const artifactSummaries = new Map()
  run.scorecards = []

  for (const gate of spec.gates) {
    for (const expression of gate.checks || []) {
      const parsed = parseRuntimeComparison(expression)
      assert(parsed, `Synthetic all-gate fixture cannot parse ${gate.id}: ${expression}`)
      const segments = parsed.path.split('.')
      const root = segments.shift()
      const value = passingValue(parsed.operator, parsed.expected)
      if (root === 'check-results') {
        run.checkResults = run.checkResults || {}
        setNestedValue(run.checkResults, segments, value)
        continue
      }
      const artifact = run.artifacts.find((candidate) => candidate.slug === root)
      assert(artifact, `Synthetic all-gate fixture cannot resolve root ${root}`)
      const summary = artifactSummaries.get(root) || {}
      setNestedValue(summary, segments, value)
      artifactSummaries.set(root, summary)
    }
  }

  for (const [slug, summary] of artifactSummaries) {
    if (slug === 'defect-register') {
      Object.assign(summary, {
        schema: 'paravoxia.chapterDefectRegister.v1',
        findings: [],
        openCritical: 0,
        openHigh: 0,
        openMediumUnaccepted: 0,
        openTotal: 0,
        countsMatchEntries: true,
      })
    }
    const artifact = run.artifacts.find((candidate) => candidate.slug === slug)
    const relativePath = `artifacts/${slug}.json`
    await writeJson(path.join(path.dirname(runPath), relativePath), summary)
    artifact.path = relativePath
    artifact.status = 'present'
    artifact.summary = summary
    artifact.updatedAt = new Date().toISOString()
  }
  for (const artifact of run.artifacts.filter((candidate) => candidate.required && candidate.status !== 'present')) {
    const relativePath = `artifacts/${artifact.slug}.json`
    const summary = { syntheticFixturePresent: true }
    await writeJson(path.join(path.dirname(runPath), relativePath), summary)
    artifact.path = relativePath
    artifact.status = 'present'
    artifact.summary = summary
    artifact.updatedAt = new Date().toISOString()
  }
  run.updatedAt = new Date().toISOString()
  await writeJson(runPath, run)
}

function parseRuntimeComparison(expression) {
  const match = String(expression).match(/^(.+?)\s*(>=|<=|==|>|<)\s*(.+)$/)
  if (!match) return null
  const raw = match[3].trim()
  const expected = raw === 'true'
    ? true
    : raw === 'false'
      ? false
      : Number.isFinite(Number(raw))
        ? Number(raw)
        : raw.replace(/^"|"$/g, '')
  return { path: match[1].trim(), operator: match[2], expected }
}

function passingValue(operator, expected) {
  if (operator === '>' && typeof expected === 'number') return expected + 1
  if (operator === '<' && typeof expected === 'number') return expected - 1
  return expected
}

function setNestedValue(target, segments, value) {
  assert(segments.length > 0, 'Synthetic gate fixture paths must include a field below the artifact root')
  let cursor = target
  for (const segment of segments.slice(0, -1)) {
    cursor[segment] = cursor[segment] && typeof cursor[segment] === 'object' ? cursor[segment] : {}
    cursor = cursor[segment]
  }
  cursor[segments.at(-1)] = value
}

async function validateMechanicalArtifactAttachment(runPath) {
  const runDir = path.dirname(runPath)
  const reportPath = path.join(runDir, 'evidence/mechanical-chapter-acceptance/chapter-mechanical-evidence.json')
  const fixture = {
    schema: 'paravoxia.chapterMechanicalEvidence.v1',
    reportVersion: 1,
    chapter: { id: fixtureChapter },
    source: { revision: 'fixture-revision-without-real-evidence' },
    disposition: 'repair-required',
    openGates: ['synthetic-repair'],
    targetChapterMatchesInput: true,
    candidateRevisionMatchesInput: true,
    requiredObjectiveBeatsPassed: false,
    requiredVariantProfilesPassed: false,
    performanceBudgetsPassed: false,
    boundaryProofComplete: false,
    preflightAuthorityCertified: false,
    machineReadyForCouncilReview: false,
  }
  await writeJson(reportPath, fixture)
  const attachResult = await runCapture([
    process.execPath,
    path.join(repoRoot, 'main/tools/creative-chapter-acceptance-workflow.mjs'),
    '--run',
    runPath,
    '--attach-mechanical-evidence',
  ], process.env)
  assert(attachResult.exitCode === 0, `red mechanical evidence attachment failed: ${attachResult.stderr}`)

  const attachedRun = await readJson(runPath)
  const artifact = attachedRun.artifacts.find((candidate) => candidate.slug === 'chapter-mechanical-evidence')
  assert(artifact?.status === 'present', 'red mechanical evidence must be attached as a present artifact')
  assert(artifact.path === 'evidence/mechanical-chapter-acceptance/chapter-mechanical-evidence.json', 'mechanical evidence must use the declared run-relative path')
  assert(artifact.summary?.schema === 'paravoxia.chapterMechanicalEvidence.v1', 'mechanical artifact summary must expose its schema to review roles')
  assert(artifact.summary?.chapterId === fixtureChapter, 'mechanical artifact summary must bind the target chapter')
  assert(artifact.summary?.candidateRevision === 'fixture-revision-without-real-evidence', 'mechanical artifact summary must bind the candidate revision')
  assert(artifact.summary?.requiredObjectiveBeatsPassed === false, 'mechanical artifact summary must expose red gate booleans')
  assert(attachedRun.checkResults?.repairRequired === true, 'repair-required mechanical evidence must set the repair routing bit')
  assert(attachedRun.checkResults?.blockedAuthorityOrEvidence === false, 'repair-required evidence must not be mislabeled as an authority block')
  assert(attachedRun.currentStep === 'emit-mechanical-repair-commission', 'repair-required mechanical evidence must route to the bounded mechanical repair commission')

  await writeJson(reportPath, { ...fixture, chapter: { id: 'ch6' } })
  const wrongRunResult = await runCapture([
    process.execPath,
    path.join(repoRoot, 'main/tools/creative-chapter-acceptance-workflow.mjs'),
    '--run',
    runPath,
    '--attach-mechanical-evidence',
  ], process.env)
  assert(wrongRunResult.exitCode !== 0, 'mechanical evidence from a different target chapter must be rejected')
  assert(/does not match run target/.test(wrongRunResult.stderr), 'wrong-run rejection must name the target mismatch')
  await writeJson(reportPath, fixture)
}

async function attachSyntheticArtifact(runPath, slug, summary) {
  const run = await readJson(runPath)
  const artifact = run.artifacts.find((candidate) => candidate.slug === slug)
  assert(artifact, `Synthetic gate proof cannot find declared artifact ${slug}`)
  const relativePath = `artifacts/${slug}.json`
  await writeJson(path.join(path.dirname(runPath), relativePath), summary)
  artifact.path = relativePath
  artifact.status = 'present'
  artifact.summary = summary
  artifact.updatedAt = new Date().toISOString()
  run.updatedAt = artifact.updatedAt
  await writeJson(runPath, run)
}

async function checkSelectedGates(runPath, gateIds) {
  const argv = [
    path.join(terraRoot, 'scripts/dev/workflow-run.mjs'),
    'check',
    '--run',
    runPath,
  ]
  for (const gateId of gateIds) argv.push('--gate', gateId)
  await runNode(argv)
}

async function expectGateStatus(runPath, gateId, expectedStatus) {
  const run = await readJson(runPath)
  const result = run.gateResults.find((candidate) => candidate.gateId === gateId)
  assert(result?.status === expectedStatus, `${gateId} expected ${expectedStatus}, got ${result?.status || 'missing'}`)
}

function runNode(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: repoRoot,
      shell: false,
      stdio: 'inherit',
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Command failed (${code}): node ${args.map(quote).join(' ')}`))
    })
  })
}

function runCapture(argv, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(argv[0], argv.slice(1), {
      cwd: repoRoot,
      env,
      shell: false,
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.on('error', reject)
    child.on('close', (exitCode) => resolve({ exitCode: exitCode ?? 1, stdout, stderr }))
  })
}

async function requireFile(filePath, label) {
  try {
    await fs.access(filePath)
  } catch {
    throw new Error(`${label} not found at ${filePath}`)
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'))
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function quote(value) {
  return /\s/.test(value) ? JSON.stringify(value) : value
}

function toRepoPath(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/')
}

function printUsage() {
  console.log([
    'Usage:',
    '  node main/tools/creative-chapter-acceptance-workflow-smoke.mjs [--out-dir <path>]',
    '',
    'The proof validates and serializes the read-only acceptance lane, executes',
    'only the safe registry check, and intentionally stops blocked before any',
    'acceptance or independent-review artifact is generated.',
  ].join('\n'))
}
