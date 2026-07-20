#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '../..')
const terraRoot = path.resolve(repoRoot, '../TerraForm')
const specPath = path.join(repoRoot, 'docs/architecture/workflow-orchestration/examples/paravoxia-chapter-acceptance.workflow.json')
const bindingsPath = path.join(repoRoot, 'docs/architecture/workflow-orchestration/examples/paravoxia-chapter-acceptance.local.adapter-bindings.json')
const acceptanceArtifactRoot = path.join(repoRoot, '.terra/workflow-runs/paravoxia-chapter-acceptance')
const acceptanceWorkflowRef = 'paravoxia-chapter-acceptance@v1'
const canonicalDefectRegisterSchema = 'paravoxia.chapterDefectRegister.v1'
const defaultJourneyContract = 'main/chapter-journey-contract.json'

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    chapter: { type: 'string' },
    'candidate-revision': { type: 'string' },
    'production-authority': { type: 'string' },
    registry: { type: 'string', default: 'main/chapter-registry.json' },
    'journey-contract': { type: 'string', default: defaultJourneyContract },
    'council-authority': { type: 'string' },
    'scene-authority': { type: 'string' },
    'previous-context': { type: 'string' },
    'next-context': { type: 'string' },
    'user-request': { type: 'string', default: 'Run read-only implemented chapter acceptance.' },
    'out-dir': { type: 'string' },
    'run-id': { type: 'string' },
    run: { type: 'string' },
    force: { type: 'boolean', default: false },
    'run-mechanical': { type: 'boolean', default: false },
    'attach-mechanical-evidence': { type: 'boolean', default: false },
    'run-journey': { type: 'boolean', default: false },
    'journey-evidence': { type: 'string' },
    'journey-lane': { type: 'string', default: 'direct-entry' },
    'journey-mode': { type: 'string', default: 'manual' },
    'journey-scenario': { type: 'string' },
    continue: { type: 'boolean', default: false },
    'run-to-blocked-or-complete': { type: 'boolean', default: false },
    'max-steps': { type: 'string', default: '32' },
    runs: { type: 'string', default: '3' },
    headed: { type: 'boolean', default: false },
    'base-url': { type: 'string' },
    'manual-evidence': { type: 'string' },
    'audio-evidence': { type: 'string' },
    'self-test': { type: 'boolean', default: false },
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
  await validateLane()

  if (values['self-test']) {
    await runSelfTest()
    return
  }

  if (values.run) {
    const runPath = await requireCanonicalAcceptanceRunFile(values.run)
    await bindAdapters(runPath)
    if (values['run-mechanical']) await runMechanicalCommand(runPath)
    else if (values['attach-mechanical-evidence']) await attachMechanicalEvidence(runPath)
    if (values['run-journey']) await runJourneyCommand(runPath)
    else if (values['journey-evidence']) await attachJourneyEvidence(runPath, values['journey-evidence'])
    await synchronizeCanonicalDefectRegister(runPath)
    await checkRun(runPath)
    if (values.continue || values['run-to-blocked-or-complete']) await continueWorkflow(runPath)
    await printRunHandoff(runPath)
    return
  }

  const required = [
    ['--chapter', values.chapter],
    ['--candidate-revision', values['candidate-revision']],
    ['--production-authority', values['production-authority']],
    ['--council-authority', values['council-authority']],
    ['--scene-authority', values['scene-authority']],
    ['--previous-context', values['previous-context']],
    ['--next-context', values['next-context']],
  ]
  const missing = required.filter(([, value]) => !value).map(([flag]) => flag)
  if (missing.length) throw new Error(`Missing required production inputs: ${missing.join(', ')}`)
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(values.chapter)) throw new Error('--chapter must be a simple chapter id')

  const candidateRevision = resolveExactCandidateRevision(values['candidate-revision'])
  const productionAuthority = await requireRepoArtifact(values['production-authority'], '--production-authority')
  const registry = await requireRepoArtifact(values.registry, '--registry')
  const journeyContract = await requireRepoArtifact(values['journey-contract'], '--journey-contract')
  const councilAuthority = await requireRepoArtifact(values['council-authority'], '--council-authority')
  const sceneAuthority = await requireRepoArtifact(values['scene-authority'], '--scene-authority')
  const previousContext = await requireRepoArtifact(values['previous-context'], '--previous-context')
  const nextContext = await requireRepoArtifact(values['next-context'], '--next-context')
  const runId = values['run-id'] || `${timestamp()}-${safeSlug(values.chapter)}-acceptance`
  const requestedOutDir = values['out-dir']
    ? resolveRepoPath(values['out-dir'])
    : path.join(repoRoot, '.terra/workflow-runs/paravoxia-chapter-acceptance', runId)
  const outDir = await requireSafeNewAcceptanceRunDir(requestedOutDir)

  const initArgs = [
    path.join(terraRoot, 'scripts/dev/workflow-run.mjs'),
    'init',
    '--spec',
    specPath,
    '--out-dir',
    outDir,
    '--run-id',
    runId,
    '--input',
    `user-request=${values['user-request']}`,
    '--input',
    'target-repo=.',
    '--input',
    `target-chapter=${values.chapter}`,
    '--input',
    `candidate-revision=${candidateRevision}`,
    '--input',
    `production-authority=${productionAuthority}`,
    '--input',
    `chapter-registry=${registry}`,
    '--input',
    `chapter-journey-contract=${journeyContract}`,
    '--input',
    `signed-council-authority=${councilAuthority}`,
    '--input',
    `signed-scene-authority=${sceneAuthority}`,
    '--input',
    `previous-chapter-context=${previousContext}`,
    '--input',
    `next-chapter-context=${nextContext}`,
  ]
  if (values.force) initArgs.push('--force')
  await runNode(initArgs)

  const runPath = await requireCanonicalAcceptanceRunFile(path.join(outDir, 'run.json'))
  await bindAdapters(runPath)
  await runBoundCommand(runPath, 'chapter-journey-contract-check')
  await ensureCommandPassed(runPath, 'chapter-journey-contract-check')
  await runBoundCommand(runPath, 'chapter-registry-check')
  await ensureCommandPassed(runPath, 'chapter-registry-check')
  if (values['run-mechanical']) await runMechanicalCommand(runPath)
  if (values['run-journey']) await runJourneyCommand(runPath)
  else if (values['journey-evidence']) await attachJourneyEvidence(runPath, values['journey-evidence'])
  await synchronizeCanonicalDefectRegister(runPath)
  await checkRun(runPath)
  await continueWorkflow(runPath)
  await printRunHandoff(runPath)
}

async function validateLane() {
  await Promise.all([
    requireFile(specPath, 'chapter-acceptance workflow'),
    requireFile(bindingsPath, 'chapter-acceptance adapter bindings'),
    requireFile(path.join(terraRoot, 'scripts/dev/workflow-run.mjs'), 'Terra workflow runner'),
  ])
  await runNode([path.join(terraRoot, 'scripts/dev/workflow-run.mjs'), 'validate', '--spec', specPath])
  await runNode([
    path.join(terraRoot, 'scripts/dev/workflow-bindings-validation.mjs'),
    '--spec',
    specPath,
    '--bindings',
    bindingsPath,
  ])
}

async function bindAdapters(runPath) {
  const [run, bindingSet] = await Promise.all([readJson(runPath), readJson(bindingsPath)])
  const bindingByRequirement = new Map(bindingSet.bindings.map((binding) => [binding.requirementId, binding]))
  run.adapterBindings = run.adapterBindings.map((requirement) => {
    const binding = bindingByRequirement.get(requirement.requirementId)
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

async function runMechanicalCommand(runPath) {
  const run = await readJson(runPath)
  const chapter = run.inputs?.['target-chapter']
  const candidateRevision = run.inputs?.['candidate-revision']
  if (!chapter) throw new Error('Run is missing target-chapter input')
  if (!candidateRevision) throw new Error('Run is missing candidate-revision input')
  const runs = Number(values.runs)
  if (!Number.isInteger(runs) || runs <= 0) throw new Error('--runs must be a positive integer')
  const runDir = path.dirname(runPath)
  requireAcceptanceRunDir(runDir)
  const extraArgv = ['--runs', String(runs)]
  if (values.headed) extraArgv.push('--headed')
  if (values['base-url']) extraArgv.push('--base-url', values['base-url'])
  if (values['manual-evidence']) extraArgv.push('--manual-evidence', await requireRepoArtifactAbsolute(values['manual-evidence'], '--manual-evidence'))
  if (values['audio-evidence']) extraArgv.push('--audio-evidence', await requireRepoArtifactAbsolute(values['audio-evidence'], '--audio-evidence'))

  await runOperatorMechanicalCommand(runPath, {
    ...process.env,
    PARAVOXIA_TARGET_CHAPTER: chapter,
    PARAVOXIA_CANDIDATE_REVISION: candidateRevision,
    PARAVOXIA_CHAPTER_ACCEPTANCE_RUN_DIR: runDir,
    PARAVOXIA_CHAPTER_ACCEPTANCE_EXTRA_ARGV_JSON: JSON.stringify(extraArgv),
    PARAVOXIA_CHAPTER_ACCEPTANCE_OPERATOR_LONG_RUN: 'true',
  })
  await attachMechanicalEvidence(runPath)
  const result = await requireCommandResult(runPath, 'chapter-acceptance-check')
  console.log(`Mechanical chapter evidence command recorded with status: ${result.status}`)
  if (result.status !== 'passed') {
    console.log('The failed evidence remains attached to the run for blocked or repair routing; it is not an orchestrator infrastructure failure.')
  }
}

async function attachMechanicalEvidence(runPath) {
  const runDir = path.dirname(runPath)
  const relativeEvidencePath = 'evidence/mechanical-chapter-acceptance/chapter-mechanical-evidence.json'
  const evidencePath = path.join(runDir, relativeEvidencePath)
  const report = await readJson(evidencePath).catch(() => null)
  if (!report) {
    throw new Error(`The chapter runner produced no mechanical evidence report at ${toRepoPath(evidencePath)}`)
  }
  if (report.schema !== 'paravoxia.chapterMechanicalEvidence.v1') {
    throw new Error(`Mechanical evidence must use paravoxia.chapterMechanicalEvidence.v1; got ${report.schema || 'missing schema'}`)
  }

  const run = await readJson(runPath)
  const expectedChapter = run.inputs?.['target-chapter']
  const expectedRevision = run.inputs?.['candidate-revision']
  if (report.chapter?.id !== expectedChapter) {
    throw new Error(`Mechanical evidence chapter ${report.chapter?.id || 'missing'} does not match run target ${expectedChapter || 'missing'}`)
  }
  if (report.source?.revision !== expectedRevision) {
    throw new Error(`Mechanical evidence revision ${report.source?.revision || 'missing'} does not match run candidate ${expectedRevision || 'missing'}`)
  }
  const artifact = (run.artifacts || []).find((candidate) => candidate.slug === 'chapter-mechanical-evidence')
  if (!artifact) throw new Error('Workflow run does not declare chapter-mechanical-evidence')
  const now = new Date().toISOString()
  const gateBooleanFields = [
    'targetChapterMatchesInput',
    'candidateRevisionMatchesInput',
    'requiredObjectiveBeatsPassed',
    'requiredVariantProfilesPassed',
    'performanceBudgetsPassed',
    'boundaryProofComplete',
    'preflightAuthorityCertified',
    'machineReadyForCouncilReview',
  ]
  artifact.path = relativeEvidencePath
  artifact.status = 'present'
  artifact.updatedAt = now
  artifact.summary = {
    path: relativeEvidencePath,
    schema: report.schema,
    chapterId: report.chapter.id,
    candidateRevision: report.source.revision,
    disposition: report.disposition,
    openGates: Array.isArray(report.openGates) ? report.openGates : [],
    ...Object.fromEntries(gateBooleanFields.map((field) => [field, report[field] === true])),
  }
  run.checkResults = {
    ...(run.checkResults || {}),
    repairRequired: report.disposition === 'repair-required',
    blockedAuthorityOrEvidence: report.disposition === 'blocked',
  }
  run.evidenceBundles = [
    ...(run.evidenceBundles || []).filter((bundle) => bundle.id !== 'evidence.chapter-mechanical-evidence'),
    {
      schema: 'terra.evidenceBundle.v1',
      id: 'evidence.chapter-mechanical-evidence',
      kind: 'eval_report',
      createdByStep: 'run-chapter-functional-proof',
      artifactRefs: ['chapter-mechanical-evidence'],
      commandRefs: [],
      summary: {
        path: relativeEvidencePath,
        schema: report.schema,
        disposition: report.disposition,
        machineReadyForCouncilReview: report.machineReadyForCouncilReview === true,
      },
    },
  ]
  run.updatedAt = now
  await writeJson(runPath, run)
}

async function runJourneyCommand(runPath) {
  const run = await readJson(runPath)
  const chapter = run.inputs?.['target-chapter']
  const contractPath = run.inputs?.['chapter-journey-contract']
  if (!chapter || !contractPath) throw new Error('Run is missing target-chapter or chapter-journey-contract input')
  const lane = values['journey-lane']
  const mode = values['journey-mode']
  if (!['continuous', 'direct-entry', 'resume'].includes(lane)) {
    throw new Error('--journey-lane must be continuous, direct-entry, or resume')
  }
  if (!['manual', 'movie'].includes(mode)) throw new Error('--journey-mode must be manual or movie')

  const bindingSet = await readJson(bindingsPath)
  const command = (bindingSet.commandCatalog || []).find((candidate) => candidate.id === 'chapter-journey-probe')
  if (!command || command.privileged !== false || !Array.isArray(command.argv)) {
    throw new Error('Validated bindings are missing the non-privileged chapter-journey-probe command')
  }
  const runDir = path.dirname(runPath)
  requireAcceptanceRunDir(runDir)
  const evidenceDir = path.join(runDir, 'evidence/chapter-journey')
  const reportPath = path.join(evidenceDir, 'chapter-journey-evidence.json')
  await fs.mkdir(evidenceDir, { recursive: true })
  const argv = [
    ...command.argv,
    '--chapter', chapter,
    '--manifest', path.join(repoRoot, contractPath),
    '--lane', lane,
    '--mode', mode,
    '--output', evidenceDir,
    '--report', reportPath,
  ]
  if (values.headed) argv.push('--headed')
  if (values['base-url']) argv.push('--base-url', values['base-url'])
  if (values['journey-scenario']) argv.push('--scenario', values['journey-scenario'])

  const startedAt = new Date().toISOString()
  const execution = await spawnRecorded(argv, process.env)
  const finishedAt = new Date().toISOString()
  const resultPath = `evidence/commands/chapter-journey-probe-operator-${timestamp()}.json`
  const result = {
    schema: 'terra.commandResult.v1',
    id: command.id,
    title: command.title,
    resultKey: command.resultKey,
    argv,
    status: execution.exitCode === 0 ? 'passed' : 'failed',
    exitCode: execution.exitCode,
    timedOut: false,
    executionPolicy: 'operator_managed_browser_journey',
    stdout: execution.stdout,
    stderr: execution.stderr,
    evidencePath: resultPath,
    startedAt,
    finishedAt,
  }
  await fs.mkdir(path.dirname(path.join(runDir, resultPath)), { recursive: true })
  await writeJson(path.join(runDir, resultPath), result)
  const latestRun = await readJson(runPath)
  latestRun.commandResults = [...(latestRun.commandResults || []), result]
  latestRun.checkResults = {
    ...(latestRun.checkResults || {}),
    [result.resultKey]: result.status === 'passed',
  }
  latestRun.updatedAt = finishedAt
  await writeJson(runPath, latestRun)
  await attachJourneyEvidence(runPath, toRepoPath(reportPath))
  console.log(`Chapter journey evidence recorded with status: ${result.status}`)
}

async function attachJourneyEvidence(runPath, inputPath) {
  const sourcePath = await requireRepoArtifactAbsolute(inputPath, '--journey-evidence')
  const reportSource = await fs.readFile(sourcePath, 'utf8')
  const report = JSON.parse(reportSource)
  if (report.schema !== 'paravoxia.chapterJourneyEvidence.v1') {
    throw new Error(`Journey evidence must use paravoxia.chapterJourneyEvidence.v1; got ${report.schema || 'missing schema'}`)
  }

  const run = await readJson(runPath)
  const expectedChapter = run.inputs?.['target-chapter']
  const expectedRevision = run.inputs?.['candidate-revision']
  const contractRef = run.inputs?.['chapter-journey-contract']
  if (report.chapterId !== expectedChapter) {
    throw new Error(`Journey evidence chapter ${report.chapterId || 'missing'} does not match run target ${expectedChapter || 'missing'}`)
  }
  if (report.sourceRevision !== expectedRevision) {
    throw new Error(`Journey evidence revision ${report.sourceRevision || 'missing'} does not match run candidate ${expectedRevision || 'missing'}`)
  }
  if (!contractRef) throw new Error('Run is missing chapter-journey-contract input')
  const contractPath = path.join(repoRoot, contractRef)
  const contractSource = await fs.readFile(contractPath)
  const contract = JSON.parse(contractSource.toString('utf8'))
  const contractHashMatchesInput = report.contract?.sha256 === sha256(contractSource)
  if (!contractHashMatchesInput) throw new Error('Journey evidence contract hash does not match the run-bound chapter journey contract')

  const chapterContract = (contract.chapters || []).find((candidate) => candidate.id === expectedChapter)
  if (!chapterContract) throw new Error(`Run-bound journey contract does not contain ${expectedChapter}`)
  const laneId = report.lane?.id
  const manual = report.lane?.requestedControlMode === 'manual'
  const expectedScenarioIds = new Set([
    ...(manual ? chapterContract.inputContracts || [] : []).map((item) => item.id),
    ...(chapterContract.interactionContracts || []).map((item) => item.id),
    ...(chapterContract.lifecycleContracts || []).map((item) => item.id),
  ])
  const results = Array.isArray(report.scenarios) ? report.scenarios : []
  const actualScenarioIds = new Set(results.map((result) => result.id))
  const requiredScenarioCoverageComplete = expectedScenarioIds.size === actualScenarioIds.size
    && [...expectedScenarioIds].every((id) => actualScenarioIds.has(id))
  const allRequiredScenariosPassed = requiredScenarioCoverageComplete
    && results.filter((result) => result.required !== false).every((result) => result.status === 'passed')
    && report.status === 'passed'
  const laneClaimConsistent = report.machineJourneyCertified === (
    report.status === 'passed' && report.lane?.machineJourneyCertifying === true && results.length > 0
  )
  const nonCertifyingEvidenceNotUsedForContinuity = laneClaimConsistent
    && (laneId !== 'direct-entry-diagnostic' || report.machineJourneyCertified === false)
  const journeyPassed = contractHashMatchesInput
    && requiredScenarioCoverageComplete
    && allRequiredScenariosPassed
    && nonCertifyingEvidenceNotUsedForContinuity

  const artifact = (run.artifacts || []).find((candidate) => candidate.slug === 'chapter-journey-evidence')
  if (!artifact) throw new Error('Workflow run does not declare chapter-journey-evidence')
  const relativeEvidencePath = 'evidence/chapter-journey/chapter-journey-evidence.json'
  const destination = path.join(path.dirname(runPath), relativeEvidencePath)
  await fs.mkdir(path.dirname(destination), { recursive: true })
  if (await fs.realpath(sourcePath).catch(() => sourcePath) !== await fs.realpath(destination).catch(() => destination)) {
    await fs.copyFile(sourcePath, destination)
  }
  const now = new Date().toISOString()
  artifact.path = relativeEvidencePath
  artifact.status = 'present'
  artifact.updatedAt = now
  artifact.summary = {
    schema: report.schema,
    chapterId: report.chapterId,
    candidateRevision: report.sourceRevision,
    laneId,
    disposition: report.disposition,
    targetChapterMatchesInput: true,
    candidateRevisionMatchesInput: true,
    contractHashMatchesInput,
    requiredScenarioCoverageComplete,
    allRequiredScenariosPassed,
    nonCertifyingEvidenceNotUsedForContinuity,
    machineJourneyCertified: report.machineJourneyCertified === true,
    requiredScenarioCount: expectedScenarioIds.size,
    failedScenarioCount: results.filter((result) => result.status === 'failed').length,
    blockedScenarioCount: results.filter((result) => result.status === 'blocked').length,
  }
  run.checkResults = { ...(run.checkResults || {}), chapterJourneyProbe: journeyPassed }
  run.evidenceBundles = [
    ...(run.evidenceBundles || []).filter((bundle) => bundle.id !== 'evidence.chapter-journey-evidence'),
    {
      schema: 'terra.evidenceBundle.v1',
      id: 'evidence.chapter-journey-evidence',
      kind: 'runtime_trace',
      createdByStep: 'run-chapter-functional-proof',
      artifactRefs: ['chapter-journey-evidence'],
      commandRefs: [],
      summary: {
        path: relativeEvidencePath,
        schema: report.schema,
        laneId,
        disposition: report.disposition,
        journeyPassed,
        machineJourneyCertified: report.machineJourneyCertified === true,
      },
    },
  ]
  run.updatedAt = now
  await writeJson(runPath, run)
}

async function synchronizeCanonicalDefectRegister(runPath) {
  const run = await readJson(runPath)
  const artifact = (run.artifacts || []).find((candidate) => candidate.slug === 'defect-register')
  if (!artifact) throw new Error('Acceptance workflow run does not declare the canonical defect-register artifact')

  const artifactPath = await resolveCanonicalRunArtifact(runPath, artifact.path, 'defect-register', { optional: true })
  if (!artifactPath) {
    const hasStaleMirror = (run.defects || []).length > 0
      || run.checkResults?.canonicalDefectsSynchronized === true
      || run.checkResults?.canonicalRepairRequired === true
    if (hasStaleMirror) {
      throw new Error('Acceptance run contains defect routing state without a present canonical defect-register artifact')
    }
    return false
  }

  const registerSource = await fs.readFile(artifactPath, 'utf8')
  const register = JSON.parse(registerSource)
  const synchronization = validateCanonicalDefectRegister(register)
  const now = new Date().toISOString()
  const relativeArtifactPath = path.relative(path.dirname(runPath), artifactPath).split(path.sep).join('/')
  const evidencePath = 'evidence/canonical-defect-synchronization.json'
  const evidence = {
    schema: 'paravoxia.chapterDefectSynchronization.v1',
    workflowRef: acceptanceWorkflowRef,
    runId: run.id,
    targetChapter: run.inputs?.['target-chapter'],
    candidateRevision: run.inputs?.['candidate-revision'],
    defectRegisterPath: relativeArtifactPath,
    defectRegisterSha256: sha256(registerSource),
    findingCount: synchronization.findings.length,
    openTotal: synchronization.openTotal,
    unresolvedMaterialTotal: synchronization.unresolvedMaterialTotal,
    repairRequired: synchronization.repairRequired,
    operatorReviewCoverageVerified: false,
    claimedReviewCoverage: synchronization.claimedReviewCoverage,
    runDefectsMirrored: true,
    synchronizedAt: now,
  }
  await fs.mkdir(path.dirname(path.join(path.dirname(runPath), evidencePath)), { recursive: true })
  await writeJson(path.join(path.dirname(runPath), evidencePath), evidence)

  run.defects = synchronization.findings
  run.checkResults = {
    ...(run.checkResults || {}),
    canonicalDefectsSynchronized: true,
    canonicalRepairRequired: synchronization.repairRequired,
    canonicalOpenDefectCount: synchronization.openTotal,
    canonicalUnresolvedMaterialDefectCount: synchronization.unresolvedMaterialTotal,
    operatorReviewCoverageVerified: false,
  }
  artifact.path = relativeArtifactPath
  artifact.status = 'present'
  artifact.updatedAt = now
  artifact.summary = {
    ...register,
    findings: undefined,
    findingCount: synchronization.findings.length,
    openCritical: synchronization.openCritical,
    openHigh: synchronization.openHigh,
    openMediumUnaccepted: synchronization.openMediumUnaccepted,
    openTotal: synchronization.openTotal,
    countsMatchEntries: true,
    idsUnique: true,
    everyMaterialDefectHasSeverityOwnerEvidenceAndRecheck: true,
    sourceReportsComplete: false,
    sourceHashesCurrent: false,
    findingCoverageComplete: false,
    operatorReviewCoverageVerified: false,
    operatorSynchronizationPassed: true,
    runDefectsMirrorCurrent: true,
    repairRequired: synchronization.repairRequired,
    synchronizationEvidence: evidencePath,
  }
  run.evidenceBundles = [
    ...(run.evidenceBundles || []).filter((bundle) => bundle.id !== 'evidence.canonical-defect-synchronization'),
    {
      schema: 'terra.evidenceBundle.v1',
      id: 'evidence.canonical-defect-synchronization',
      kind: 'validation_report',
      createdByStep: 'moderate-independent-reviews',
      artifactRefs: ['defect-register'],
      commandRefs: [evidencePath],
      summary: {
        defectRegisterSha256: evidence.defectRegisterSha256,
        findingCount: evidence.findingCount,
        openTotal: evidence.openTotal,
        repairRequired: evidence.repairRequired,
        operatorReviewCoverageVerified: false,
        runDefectsMirrored: true,
      },
    },
  ]
  run.updatedAt = now
  await writeJson(runPath, run)
  return true
}

function validateCanonicalDefectRegister(register) {
  if (!register || typeof register !== 'object' || Array.isArray(register)) {
    throw new Error('defect-register must be a JSON object')
  }
  if (register.schema !== canonicalDefectRegisterSchema) {
    throw new Error(`defect-register.schema must equal ${canonicalDefectRegisterSchema}`)
  }
  if (!Array.isArray(register.findings)) throw new Error('defect-register.findings must be an array')

  const allowedSeverities = new Set(['critical', 'high', 'medium', 'low'])
  const allowedStatuses = new Set(['open', 'fixed', 'accepted_exception', 'deferred', 'duplicate'])
  const ids = new Set()
  const findings = register.findings.map((finding, index) => {
    const label = `defect-register.findings[${index}]`
    if (!finding || typeof finding !== 'object' || Array.isArray(finding)) throw new Error(`${label} must be an object`)
    if (finding.schema !== 'terra.defect.v1') throw new Error(`${label}.schema must equal terra.defect.v1`)
    for (const field of ['id', 'category', 'description']) {
      if (!nonEmptyString(finding[field])) throw new Error(`${label}.${field} must be a non-empty string`)
    }
    if (ids.has(finding.id)) throw new Error(`defect-register finding id must be unique: ${finding.id}`)
    ids.add(finding.id)
    if (!allowedSeverities.has(finding.severity)) throw new Error(`${label}.severity is unsupported: ${finding.severity || 'missing'}`)
    if (!allowedStatuses.has(finding.status)) throw new Error(`${label}.status is unsupported: ${finding.status || 'missing'}`)
    const material = ['critical', 'high', 'medium'].includes(finding.severity)
    if (material && finding.status === 'accepted_exception') {
      throw new Error(`${label} may not use accepted_exception for a material severity; resolve or keep the finding open for repair`)
    }
    const unresolvedMaterial = material && ['open', 'deferred'].includes(finding.status)
    if (unresolvedMaterial) {
      for (const field of ['ownerRole', 'evidenceRef', 'recheck']) {
        if (!nonEmptyString(finding[field])) throw new Error(`${label}.${field} is required for unresolved material findings`)
      }
    }
    if (material && finding.status === 'fixed') {
      if (!nonEmptyString(finding.fixEvidenceRef)) throw new Error(`${label}.fixEvidenceRef is required for fixed material findings`)
      if (finding.recheckResult?.status !== 'passed' || !nonEmptyString(finding.recheckResult?.evidenceRef)) {
        throw new Error(`${label}.recheckResult must record status passed and a non-empty evidenceRef for fixed material findings`)
      }
    }
    if (finding.status === 'duplicate' && !nonEmptyString(finding.duplicateOf)) {
      throw new Error(`${label}.duplicateOf is required for duplicate findings`)
    }
    return structuredClone(finding)
  })

  const severityRank = { low: 1, medium: 2, high: 3, critical: 4 }
  const findingsById = new Map(findings.map((finding) => [finding.id, finding]))
  for (const duplicate of findings.filter((finding) => finding.status === 'duplicate')) {
    const visited = new Set([duplicate.id])
    let cursor = duplicate
    while (cursor.status === 'duplicate') {
      const target = findingsById.get(cursor.duplicateOf)
      if (!target) throw new Error(`defect-register duplicate ${cursor.id} references missing retained finding ${cursor.duplicateOf}`)
      if (visited.has(target.id)) throw new Error(`defect-register duplicate cycle detected at ${target.id}`)
      visited.add(target.id)
      cursor = target
    }
    if (severityRank[cursor.severity] < severityRank[duplicate.severity]) {
      throw new Error(`defect-register duplicate ${duplicate.id} must resolve to a same-or-higher severity retained finding`)
    }
  }

  const unresolved = findings.filter((finding) => ['open', 'deferred'].includes(finding.status))
  const openCritical = unresolved.filter((finding) => finding.severity === 'critical').length
  const openHigh = unresolved.filter((finding) => finding.severity === 'high').length
  const openMediumUnaccepted = unresolved.filter((finding) => finding.severity === 'medium').length
  const openTotal = unresolved.length
  const unresolvedMaterialTotal = openCritical + openHigh + openMediumUnaccepted
  const advertisedCounts = { openCritical, openHigh, openMediumUnaccepted, openTotal }
  for (const [field, expected] of Object.entries(advertisedCounts)) {
    if (register[field] !== expected) {
      throw new Error(`defect-register.${field} must equal findings-derived count ${expected}; got ${String(register[field])}`)
    }
  }
  if (register.countsMatchEntries !== true) throw new Error('defect-register.countsMatchEntries must equal true')

  return {
    findings,
    openCritical,
    openHigh,
    openMediumUnaccepted,
    openTotal,
    unresolvedMaterialTotal,
    repairRequired: openTotal > 0,
    claimedReviewCoverage: {
      sourceReportsComplete: register.sourceReportsComplete === true,
      sourceHashesCurrent: register.sourceHashesCurrent === true,
      findingCoverageComplete: register.findingCoverageComplete === true,
    },
  }
}

async function runBoundCommand(runPath, commandId, env = process.env) {
  await runNode([
    path.join(terraRoot, 'scripts/dev/workflow-command.mjs'),
    '--run',
    runPath,
    '--bindings',
    bindingsPath,
    '--command',
    commandId,
  ], env)
}

async function runOperatorMechanicalCommand(runPath, env) {
  const [run, bindingSet] = await Promise.all([readJson(runPath), readJson(bindingsPath)])
  const command = (bindingSet.commandCatalog || []).find((candidate) => candidate.id === 'chapter-acceptance-check')
  if (!command || command.privileged !== false || !Array.isArray(command.argv) || command.argv.length === 0) {
    throw new Error('Validated bindings are missing the non-privileged chapter-acceptance-check command')
  }

  const startedAt = new Date().toISOString()
  const execution = await spawnRecorded(command.argv, env)
  const finishedAt = new Date().toISOString()
  const evidencePath = `evidence/commands/chapter-acceptance-check-operator-${timestamp()}.json`
  const record = {
    schema: 'terra.commandResult.v1',
    id: command.id,
    title: command.title,
    resultKey: command.resultKey,
    argv: command.argv,
    status: execution.exitCode === 0 ? 'passed' : 'failed',
    exitCode: execution.exitCode,
    timedOut: false,
    executionPolicy: 'operator_managed_long_run',
    stdout: execution.stdout,
    stderr: execution.stderr,
    evidencePath,
    startedAt,
    finishedAt,
  }
  await fs.mkdir(path.dirname(path.join(path.dirname(runPath), evidencePath)), { recursive: true })
  await writeJson(path.join(path.dirname(runPath), evidencePath), record)
  run.commandResults = [...(run.commandResults || []), record]
  run.checkResults = { ...(run.checkResults || {}), [record.resultKey]: record.status === 'passed' }
  run.evidenceBundles = [
    ...(run.evidenceBundles || []),
    {
      schema: 'terra.evidenceBundle.v1',
      id: `evidence.command.chapter-acceptance-check.operator.${timestamp()}`,
      kind: 'command_result',
      createdByStep: run.currentStep || 'run-chapter-functional-proof',
      artifactRefs: [],
      commandRefs: [evidencePath],
      summary: {
        commandId: record.id,
        status: record.status,
        exitCode: record.exitCode,
        executionPolicy: record.executionPolicy,
      },
    },
  ]
  run.updatedAt = finishedAt
  await writeJson(runPath, run)
}

function spawnRecorded(argv, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(argv[0], argv.slice(1), { cwd: repoRoot, env, shell: false })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString()
      stdout += text
      process.stdout.write(text)
    })
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString()
      stderr += text
      process.stderr.write(text)
    })
    child.on('error', reject)
    child.on('close', (exitCode) => resolve({ exitCode: exitCode ?? 1, stdout, stderr }))
  })
}

async function ensureCommandPassed(runPath, commandId) {
  const result = await requireCommandResult(runPath, commandId)
  if (result.status !== 'passed') {
    throw new Error(`${commandId} did not pass; inspect the command evidence recorded in ${toRepoPath(runPath)}`)
  }
}

async function requireCommandResult(runPath, commandId) {
  const run = await readJson(runPath)
  const result = [...(run.commandResults || [])].reverse().find((candidate) => candidate.id === commandId)
  if (!result) throw new Error(`${commandId} produced no persisted command result in ${toRepoPath(runPath)}`)
  return result
}

async function continueWorkflow(runPath) {
  await requireCanonicalAcceptanceRunFile(runPath)
  const maxSteps = Number(values['max-steps'])
  if (!Number.isInteger(maxSteps) || maxSteps <= 0 || maxSteps > 128) {
    throw new Error('--max-steps must be an integer from 1 through 128')
  }
  const [spec, bindingSet] = await Promise.all([readJson(specPath), readJson(bindingsPath)])

  for (let executionCount = 0; executionCount < maxSteps; executionCount += 1) {
    await checkRun(runPath)
    const run = await readJson(runPath)
    if (run.status === 'completed') {
      await recordOperatorCompletion(runPath, executionCount)
      return { status: 'completed', executionCount }
    }

    const current = run.steps.find((step) => step.id === run.currentStep)
      || run.steps.find((step) => step.status === 'ready')
      || run.steps.find((step) => step.status === 'blocked')
    if (!current) {
      await persistExecutionBlocker(runPath, {
        code: 'no_executable_step',
        message: 'Terra reported an incomplete run without a ready or blocked step.',
      })
      return { status: 'blocked', code: 'no_executable_step', executionCount }
    }
    if (current.status !== 'ready') {
      const gateReasons = (run.gateResults || [])
        .filter((gate) => (current.gatesBefore || []).includes(gate.gateId) && gate.status !== 'passed')
        .flatMap((gate) => gate.blockingReasons || [])
      await persistExecutionBlocker(runPath, {
        code: 'gate_blocked',
        step: current,
        message: gateReasons[0] || `Step ${current.id} is blocked by unmet evidence gates.`,
        details: { gateReasons },
      })
      return { status: 'blocked', code: 'gate_blocked', executionCount }
    }

    const specStep = spec.steps.find((step) => step.id === current.id)
    if (!specStep) throw new Error(`Canonical workflow omitted current step ${current.id}`)
    const lane = resolveExecutableLane(specStep)
    if (lane.kind === 'human') {
      await persistExecutionBlocker(runPath, {
        code: 'human_operator_required',
        step: current,
        lane,
        message: 'This human_decision step requires an authenticated operator artifact; automated role runners are forbidden.',
      })
      return { status: 'blocked', code: 'human_operator_required', executionCount }
    }
    if (lane.kind === 'deterministic') {
      await persistExecutionBlocker(runPath, {
        code: 'missing_deterministic_adapter',
        step: current,
        lane,
        message: `No evidence-backed exact-output executor is bound for ${specStep.type} step ${specStep.id}; command bindings alone do not produce its declared artifacts.`,
      })
      return { status: 'blocked', code: 'missing_deterministic_adapter', executionCount }
    }

    let execution
    try {
      execution = preflightRoleExecution(run, specStep, spec, bindingSet, lane)
    } catch (error) {
      await persistExecutionBlocker(runPath, {
        code: 'role_execution_contract_invalid',
        step: current,
        lane,
        message: error instanceof Error ? error.message : String(error),
      })
      return { status: 'blocked', code: 'role_execution_contract_invalid', executionCount }
    }
    const configuredArgv = parseRunnerArgvEnvironment(execution.runnerEnv)
    if (!configuredArgv.ok) {
      await persistExecutionBlocker(runPath, {
        code: 'missing_role_runner_configuration',
        step: current,
        lane,
        message: configuredArgv.message,
        details: {
          runnerEnv: execution.runnerEnv,
          configurationExample: `export ${execution.runnerEnv}='["<read-only-runner>","$PROMPT_PATH","$RESULT_PATH"]'`,
        },
      })
      return { status: 'blocked', code: 'missing_role_runner_configuration', executionCount }
    }

    await clearExecutionBlocker(runPath)
    const result = await spawnRecorded([
      process.execPath,
      path.join(terraRoot, 'scripts/dev/workflow-role.mjs'),
      '--run',
      runPath,
      '--spec',
      specPath,
      '--bindings',
      bindingsPath,
      '--step',
      specStep.id,
      '--adapter',
      execution.adapter.id,
    ], process.env)
    if (result.exitCode !== 0) {
      await persistExecutionBlocker(runPath, {
        code: 'role_execution_rejected',
        step: current,
        lane,
        message: (result.stderr || result.stdout || `Role adapter exited ${result.exitCode}`).trim().slice(0, 2000),
        details: { adapterId: execution.adapter.id, exitCode: result.exitCode },
      })
      return { status: 'blocked', code: 'role_execution_rejected', executionCount }
    }
    await clearExecutionBlocker(runPath)
    if (specStep.pausePolicy) {
      await persistExecutionBlocker(runPath, {
        code: 'authorized_repair_handoff',
        step: current,
        lane,
        message: specStep.pausePolicy,
      })
      return { status: 'blocked', code: 'authorized_repair_handoff', executionCount: executionCount + 1 }
    }
  }

  const run = await readJson(runPath)
  await persistExecutionBlocker(runPath, {
    code: 'operator_step_limit_reached',
    step: run.steps.find((step) => step.id === run.currentStep),
    message: `Stopped after --max-steps ${maxSteps}; resume explicitly to continue.`,
  })
  return { status: 'blocked', code: 'operator_step_limit_reached', executionCount: maxSteps }
}

function resolveExecutableLane(step) {
  if (step.type === 'human_decision') {
    return { kind: 'human', family: 'review_adapter', requirementId: 'acceptance-human-decision-recorder' }
  }
  if (step.type === 'deterministic_check' || step.type === 'tool_task'
    || (step.type === 'artifact_collection' && step.allowedAdapterFamilies?.[0] === 'tool_adapter')) {
    return { kind: 'deterministic', family: 'tool_adapter', requirementId: 'acceptance-tool-runner' }
  }
  if (step.type === 'review') {
    return { kind: 'role', family: 'review_adapter', requirementId: 'acceptance-review-runner', adapterId: 'independent-review' }
  }
  if (step.type === 'model_task' || step.type === 'artifact_collection') {
    return { kind: 'role', family: 'model_adapter', requirementId: 'acceptance-reasoning-runner', adapterId: 'acceptance-analysis' }
  }
  return { kind: 'deterministic', family: 'tool_adapter', requirementId: 'acceptance-tool-runner' }
}

function preflightRoleExecution(run, step, spec, bindingSet, lane) {
  assertExactStrings(step.allowedAdapterFamilies, [lane.family], `${step.id}.allowedAdapterFamilies`)
  assertExactStrings(step.adapterRequirementRefs, [lane.requirementId], `${step.id}.adapterRequirementRefs`)
  const role = (spec.roleContracts || []).find((candidate) => candidate.slug === step.roleContractRef)
  if (!role?.outputContract) throw new Error(`${step.id} role ${step.roleContractRef} has no enforceable outputContract`)
  assertExactStrings(step.outputs, step.outputs.filter((slug) => (spec.artifactRequirements || []).some((artifact) => artifact.slug === slug)), `${step.id}.outputs`)
  const binding = (bindingSet.bindings || []).find((candidate) => candidate.requirementId === lane.requirementId)
  if (!binding) throw new Error(`Missing adapter binding ${lane.requirementId}`)
  if (binding.family !== lane.family) throw new Error(`${lane.requirementId} family must equal ${lane.family}`)
  const resolved = (run.adapterBindings || []).find((candidate) => candidate.requirementId === lane.requirementId)
  if (resolved?.status !== 'bound' || resolved.binding?.family !== lane.family
    || resolved.binding?.adapterSlug !== binding.adapter?.slug) {
    throw new Error(`Run binding ${lane.requirementId} is not bound to the validated ${lane.family} adapter`)
  }
  const adapter = (bindingSet.roleCatalog || []).find((candidate) => candidate.id === lane.adapterId)
  if (!adapter || adapter.bindingRequirementId !== lane.requirementId || adapter.privileged !== false) {
    throw new Error(`Role adapter ${lane.adapterId} is missing, privileged, or bound to the wrong requirement`)
  }
  const runnerRef = binding.configuration?.runnerArgvRef
  if (typeof runnerRef !== 'string' || !runnerRef.startsWith('env:') || runnerRef.length === 4) {
    throw new Error(`${lane.requirementId}.runnerArgvRef must be an explicit env:NAME reference`)
  }
  return { role, binding, adapter, runnerEnv: runnerRef.slice(4) }
}

function parseRunnerArgvEnvironment(name) {
  const raw = process.env[name]
  if (!raw) return { ok: false, message: `${name} is unset; no read-only structured role runner is configured.` }
  try {
    const argv = JSON.parse(raw)
    if (!Array.isArray(argv) || argv.length === 0 || argv.some((value) => !nonEmptyString(value))) {
      return { ok: false, message: `${name} must be a non-empty JSON string array.` }
    }
    return { ok: true, argv }
  } catch {
    return { ok: false, message: `${name} must contain a valid JSON argv array.` }
  }
}

function assertExactStrings(actual, expected, label) {
  if (!Array.isArray(actual) || actual.length !== expected.length
    || actual.some((value, index) => value !== expected[index])) {
    throw new Error(`${label} must equal [${expected.join(', ')}]`)
  }
}

async function persistExecutionBlocker(runPath, blocker) {
  const run = await readJson(runPath)
  const now = new Date().toISOString()
  const step = blocker.step || run.steps.find((candidate) => candidate.id === run.currentStep)
  const record = {
    schema: 'paravoxia.chapterAcceptanceExecutionBlocker.v1',
    status: 'blocked',
    code: blocker.code,
    stepId: step?.id || run.currentStep || null,
    stepType: step?.type || null,
    requiredAdapterFamily: blocker.lane?.family || null,
    requiredAdapterRequirementId: blocker.lane?.requirementId || null,
    message: blocker.message,
    details: blocker.details || {},
    recoverable: true,
    continueCommand: `node main/tools/creative-chapter-acceptance-workflow.mjs --run ${toRepoPath(runPath)} --continue`,
    recordedAt: now,
  }
  run.operatorExecution = record
  run.operatorExecutionHistory = [...(run.operatorExecutionHistory || []), record].slice(-64)
  run.status = 'blocked'
  run.currentStep = record.stepId
  const runStep = run.steps.find((candidate) => candidate.id === record.stepId)
  if (runStep) runStep.status = 'blocked'
  const evidencePath = 'evidence/operator-execution-blocker.json'
  await writeJson(path.join(path.dirname(runPath), evidencePath), record)
  run.evidenceBundles = [
    ...(run.evidenceBundles || []).filter((bundle) => bundle.id !== 'evidence.chapter-acceptance-operator-blocker'),
    {
      schema: 'terra.evidenceBundle.v1',
      id: 'evidence.chapter-acceptance-operator-blocker',
      kind: 'runtime_trace',
      createdByStep: record.stepId,
      artifactRefs: [],
      commandRefs: [evidencePath],
      summary: { code: record.code, requiredAdapterFamily: record.requiredAdapterFamily, recoverable: true },
    },
  ]
  run.updatedAt = now
  await writeJson(runPath, run)
  console.log(`Chapter acceptance execution blocked: ${record.code} at ${record.stepId || 'unknown step'}`)
  console.log(record.message)
}

async function clearExecutionBlocker(runPath) {
  const run = await readJson(runPath)
  if (!run.operatorExecution) return
  delete run.operatorExecution
  run.evidenceBundles = (run.evidenceBundles || []).filter((bundle) => bundle.id !== 'evidence.chapter-acceptance-operator-blocker')
  run.updatedAt = new Date().toISOString()
  await writeJson(runPath, run)
}

async function recordOperatorCompletion(runPath, executionCount) {
  const run = await readJson(runPath)
  run.operatorExecution = {
    schema: 'paravoxia.chapterAcceptanceExecutionStatus.v1',
    status: 'completed',
    executionCount,
    recordedAt: new Date().toISOString(),
  }
  run.updatedAt = run.operatorExecution.recordedAt
  await writeJson(runPath, run)
}

async function checkRun(runPath) {
  await synchronizeCanonicalDefectRegister(runPath)
  await runNode([
    path.join(terraRoot, 'scripts/dev/workflow-run.mjs'),
    'check',
    '--run',
    runPath,
  ])
}

async function printRunHandoff(runPath) {
  const run = await readJson(runPath)
  const nextStep = run.steps.find((step) => ['ready', 'blocked'].includes(step.status)) || run.steps.find((step) => step.status === 'pending')
  console.log('Paravoxia chapter-acceptance operator run is initialized and persisted.')
  console.log(`run: ${toRepoPath(runPath)}`)
  console.log(`target: ${run.inputs?.['target-chapter']} @ ${run.inputs?.['candidate-revision']}`)
  console.log(`status: ${run.status}`)
  console.log(`next step: ${nextStep?.id || 'inspect final disposition'}`)
  if (run.operatorExecution?.status === 'blocked') {
    console.log(`operator blocker: ${run.operatorExecution.code}`)
    console.log(`  ${run.operatorExecution.message}`)
  }
  console.log('run to the next real blocker or completion:')
  console.log(`  node main/tools/creative-chapter-acceptance-workflow.mjs --run ${quote(toRepoPath(runPath))} --continue`)
  if (!(run.commandResults || []).some((result) => result.id === 'chapter-acceptance-check' && result.status === 'passed')) {
    console.log('run the full mechanical chapter evidence command:')
    console.log(`  node main/tools/creative-chapter-acceptance-workflow.mjs --run ${quote(toRepoPath(runPath))} --run-mechanical`)
  }
  console.log('The run may not reach accepted until real artifacts pass every gate and an authenticated human_operator decision is recorded.')
}

function resolveExactCandidateRevision(revision) {
  const resolved = git(['rev-parse', '--verify', `${revision}^{commit}`]).trim()
  const head = git(['rev-parse', '--verify', 'HEAD^{commit}']).trim()
  if (resolved !== head) throw new Error(`Candidate revision ${resolved} is not the checked-out HEAD ${head}; acceptance evidence must run against the exact checked-out revision`)
  const dirty = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: false,
  })
  if (dirty.status !== 0) throw new Error(dirty.stderr || 'Unable to inspect worktree state')
  const generatedRunPrefix = '.terra/workflow-runs/paravoxia-chapter-acceptance/'
  const candidateChanges = dirty.stdout.split(/\r?\n/).filter(Boolean).filter((line) => (
    !(line.startsWith('?? ') && line.slice(3).startsWith(generatedRunPrefix))
  ))
  if (candidateChanges.length) throw new Error('Tracked or untracked candidate worktree changes are present; commit or otherwise establish an exact clean candidate revision before acceptance')
  return resolved
}

function git(argv) {
  const result = spawnSync('git', argv, { cwd: repoRoot, encoding: 'utf8', shell: false })
  if (result.status !== 0) throw new Error(result.stderr || `git ${argv.join(' ')} failed`)
  return result.stdout
}

async function requireRepoArtifact(inputPath, flag) {
  const resolved = resolveRepoPath(inputPath)
  if (!resolved.startsWith(`${repoRoot}${path.sep}`)) throw new Error(`${flag} must resolve inside the repository`)
  const stat = await fs.stat(resolved).catch(() => null)
  if (!stat?.isFile()) throw new Error(`${flag} must resolve to an existing file: ${inputPath}`)
  const canonical = await fs.realpath(resolved)
  if (!canonical.startsWith(`${repoRoot}${path.sep}`)) throw new Error(`${flag} may not escape the repository through a symlink`)
  return toRepoPath(canonical)
}

async function requireRepoArtifactAbsolute(inputPath, flag) {
  const repoPath = await requireRepoArtifact(inputPath, flag)
  return path.join(repoRoot, repoPath)
}

async function requireSafeNewAcceptanceRunDir(inputPath) {
  const resolved = resolveRepoPath(inputPath)
  requireAcceptanceRunDir(resolved)

  const rootStat = await fs.lstat(acceptanceArtifactRoot).catch(() => null)
  if (!rootStat?.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error(`Acceptance artifact root must be an existing non-symlink directory: ${toRepoPath(acceptanceArtifactRoot)}`)
  }
  const canonicalRoot = await fs.realpath(acceptanceArtifactRoot)
  if (canonicalRoot !== acceptanceArtifactRoot) {
    throw new Error(`Acceptance artifact root must not resolve through a symlink: ${toRepoPath(acceptanceArtifactRoot)}`)
  }

  const relativeSegments = path.relative(acceptanceArtifactRoot, resolved).split(path.sep).filter(Boolean)
  let cursor = acceptanceArtifactRoot
  for (const segment of relativeSegments) {
    cursor = path.join(cursor, segment)
    const stat = await fs.lstat(cursor).catch(() => null)
    if (!stat) break
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error(`New acceptance run path contains a symlink or non-directory ancestor: ${toRepoPath(cursor)}`)
    }
    const canonicalCursor = await fs.realpath(cursor)
    if (!canonicalCursor.startsWith(`${canonicalRoot}${path.sep}`)) {
      throw new Error(`New acceptance run path escapes the canonical artifact root: ${toRepoPath(cursor)}`)
    }
  }

  const existingStat = await fs.lstat(resolved).catch(() => null)
  if (!existingStat) return resolved
  const canonicalRunDir = await fs.realpath(resolved)
  if (!existingStat.isDirectory() || existingStat.isSymbolicLink()
    || !canonicalRunDir.startsWith(`${canonicalRoot}${path.sep}`)) {
    throw new Error(`New acceptance run directory must be a canonical non-symlink child of ${toRepoPath(acceptanceArtifactRoot)}`)
  }
  await rejectSymlinkDescendants(canonicalRunDir)
  return canonicalRunDir
}

async function rejectSymlinkDescendants(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const child = path.join(directory, entry.name)
    if (entry.isSymbolicLink()) {
      throw new Error(`New acceptance run directory contains a pre-existing symlink: ${toRepoPath(child)}`)
    }
    if (entry.isDirectory()) await rejectSymlinkDescendants(child)
  }
}

async function requireCanonicalAcceptanceRunFile(inputPath) {
  const resolved = resolveRepoPath(inputPath)
  if (path.basename(resolved) !== 'run.json') throw new Error('--run must name an exact run.json file')
  if (!resolved.startsWith(`${acceptanceArtifactRoot}${path.sep}`)) {
    throw new Error(`--run must resolve lexically under ${toRepoPath(acceptanceArtifactRoot)}`)
  }

  const stat = await fs.lstat(resolved).catch(() => null)
  if (!stat?.isFile() || stat.isSymbolicLink()) throw new Error('--run must be an existing non-symlink regular run.json file')
  const [canonicalRoot, canonicalRunPath] = await Promise.all([
    fs.realpath(acceptanceArtifactRoot),
    fs.realpath(resolved),
  ])
  if (canonicalRoot !== acceptanceArtifactRoot) {
    throw new Error(`Acceptance artifact root must not resolve through a symlink: ${toRepoPath(acceptanceArtifactRoot)}`)
  }
  if (!canonicalRunPath.startsWith(`${canonicalRoot}${path.sep}`) || path.basename(canonicalRunPath) !== 'run.json') {
    throw new Error(`--run canonical path must be a child run.json under ${toRepoPath(acceptanceArtifactRoot)}`)
  }

  const [run, spec] = await Promise.all([readJson(canonicalRunPath), readJson(specPath)])
  if (run.schema !== 'terra.workflowRun.v1') throw new Error('--run schema must equal terra.workflowRun.v1')
  const expectedWorkflowRef = `${spec.identity?.slug}@${spec.identity?.version}`
  if (expectedWorkflowRef !== acceptanceWorkflowRef || run.workflowSpecRef !== expectedWorkflowRef) {
    throw new Error(`--run workflowSpecRef must equal ${acceptanceWorkflowRef}`)
  }
  if (!nonEmptyString(run.sourceSpec)) throw new Error('--run must record the canonical sourceSpec')
  const runSourceSpec = path.isAbsolute(run.sourceSpec) ? path.resolve(run.sourceSpec) : path.resolve(repoRoot, run.sourceSpec)
  const canonicalSourceSpec = await fs.realpath(runSourceSpec).catch(() => null)
  const canonicalExpectedSpec = await fs.realpath(specPath)
  if (canonicalSourceSpec !== canonicalExpectedSpec) {
    throw new Error(`--run sourceSpec must resolve to ${toRepoPath(specPath)}`)
  }
  if (!nonEmptyString(run.id)) throw new Error('--run id must be a non-empty string')
  if (!nonEmptyString(run.inputs?.['target-chapter']) || !nonEmptyString(run.inputs?.['candidate-revision'])) {
    throw new Error('--run must bind non-empty target-chapter and candidate-revision inputs')
  }
  assertExactIdentitySet(run.steps, spec.steps, 'id', '--run steps')
  assertExactIdentitySet(run.artifacts, spec.artifactRequirements, 'slug', '--run artifacts')
  if (!Array.isArray(run.adapterBindings)) throw new Error('--run adapterBindings must be an array')
  return canonicalRunPath
}

async function resolveCanonicalRunArtifact(runPath, artifactPath, label, { optional = false } = {}) {
  if (!artifactPath) {
    if (optional) return null
    throw new Error(`${label} artifact path is missing`)
  }
  if (path.isAbsolute(artifactPath)) throw new Error(`${label} artifact path must be run-relative`)
  const runDir = path.dirname(runPath)
  const resolved = path.resolve(runDir, artifactPath)
  if (!resolved.startsWith(`${runDir}${path.sep}`)) throw new Error(`${label} artifact path may not escape its acceptance run directory`)
  const stat = await fs.lstat(resolved).catch(() => null)
  if (!stat) {
    if (optional) return null
    throw new Error(`${label} artifact does not exist`)
  }
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${label} artifact must be a non-symlink regular file`)
  const [canonicalRunDir, canonicalArtifact] = await Promise.all([fs.realpath(runDir), fs.realpath(resolved)])
  if (!canonicalArtifact.startsWith(`${canonicalRunDir}${path.sep}`)) {
    throw new Error(`${label} artifact may not escape its acceptance run directory through a symlink`)
  }
  return canonicalArtifact
}

function assertExactIdentitySet(actualItems, expectedItems, key, label) {
  if (!Array.isArray(actualItems)) throw new Error(`${label} must be an array`)
  const actual = actualItems.map((item) => item?.[key])
  const expected = expectedItems.map((item) => item?.[key])
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new Error(`${label} do not match the canonical ${acceptanceWorkflowRef} graph`)
  }
}

function requireAcceptanceRunDir(runDir) {
  const artifactRoot = path.join(repoRoot, '.terra/workflow-runs/paravoxia-chapter-acceptance')
  if (runDir === artifactRoot || !runDir.startsWith(`${artifactRoot}${path.sep}`)) {
    throw new Error(`Acceptance run directories must resolve to a child directory under ${toRepoPath(artifactRoot)}`)
  }
}

function resolveRepoPath(inputPath) {
  return path.isAbsolute(inputPath) ? path.resolve(inputPath) : path.resolve(repoRoot, inputPath)
}

function runNode(args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: repoRoot, env, shell: false, stdio: 'inherit' })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Command failed (${code}): node ${args.map(quote).join(' ')}`))
    })
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
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

async function runSelfTest() {
  const selfTestRoot = path.join(acceptanceArtifactRoot, `_operator-safety-self-test-${process.pid}`)
  const outsideRoot = path.join(repoRoot, '.terra/workflow-runs', `_chapter-acceptance-escape-self-test-${process.pid}`)
  const validDir = path.join(selfTestRoot, 'valid')
  const validRunPath = path.join(validDir, 'run.json')
  await fs.rm(selfTestRoot, { recursive: true, force: true })
  await fs.rm(outsideRoot, { recursive: true, force: true })
  try {
    const canonicalNewDir = await requireSafeNewAcceptanceRunDir(validDir)
    if (canonicalNewDir !== validDir) throw new Error('Self-test did not preserve a safe contained new --out-dir')

    await fs.mkdir(selfTestRoot, { recursive: true })
    await fs.mkdir(outsideRoot, { recursive: true })
    const outsideMarker = path.join(outsideRoot, 'must-not-be-written.txt')
    await fs.writeFile(outsideMarker, 'unchanged\n')
    const symlinkedEvidenceDir = path.join(selfTestRoot, 'preexisting-evidence-symlink')
    await fs.mkdir(symlinkedEvidenceDir, { recursive: true })
    await fs.symlink(outsideRoot, path.join(symlinkedEvidenceDir, 'evidence'), 'dir')
    await expectRejection(
      () => requireSafeNewAcceptanceRunDir(symlinkedEvidenceDir),
      /pre-existing symlink.*evidence/i,
      'new --out-dir with an existing evidence symlink',
    )
    if (await fs.readFile(outsideMarker, 'utf8') !== 'unchanged\n') throw new Error('Rejected evidence symlink allowed an outside write')

    await runNode([
      path.join(terraRoot, 'scripts/dev/workflow-run.mjs'),
      'init',
      '--spec',
      specPath,
      '--out-dir',
      validDir,
      '--run-id',
      'paravoxia-chapter-acceptance-operator-self-test',
      '--input',
      'user-request=Operator safety self-test only.',
      '--input',
      'target-repo=.',
      '--input',
      'target-chapter=ch5',
      '--input',
      'candidate-revision=operator-self-test-revision',
      '--input',
      'production-authority=fixture://operator-self-test',
      '--input',
      'chapter-registry=main/chapter-registry.json',
      '--input',
      'chapter-journey-contract=main/chapter-journey-contract.json',
      '--input',
      'signed-council-authority=fixture://operator-self-test',
      '--input',
      'signed-scene-authority=fixture://operator-self-test',
      '--input',
      'previous-chapter-context=fixture://operator-self-test',
      '--input',
      'next-chapter-context=fixture://operator-self-test',
    ])
    const canonical = await requireCanonicalAcceptanceRunFile(validRunPath)
    if (canonical !== await fs.realpath(validRunPath)) throw new Error('Self-test did not return the canonical valid run path')
    await bindAdapters(validRunPath)
    const journeyContractSource = await fs.readFile(path.join(repoRoot, defaultJourneyContract))
    const journeyFixturePath = path.join(validDir, 'journey-fixture.json')
    const journeyFixture = {
      schema: 'paravoxia.chapterJourneyEvidence.v1',
      runId: 'operator-self-test-journey',
      chapterId: 'ch5',
      sourceRevision: 'operator-self-test-revision',
      status: 'passed',
      disposition: 'passed-no-focused-scenarios',
      machineJourneyCertified: false,
      lane: {
        id: 'direct-entry-diagnostic',
        entryPath: 'direct-entry',
        requestedControlMode: 'manual',
        machineJourneyCertifying: false,
      },
      contract: { sha256: sha256(journeyContractSource), scenarioIds: [] },
      scenarios: [],
      summary: { passed: 0, failed: 0, blocked: 0, total: 0 },
      failures: [],
      unavailable: [],
    }
    await writeJson(journeyFixturePath, journeyFixture)
    await attachJourneyEvidence(validRunPath, toRepoPath(journeyFixturePath))
    const journeyAttachedRun = await readJson(validRunPath)
    const journeyArtifact = journeyAttachedRun.artifacts.find((artifact) => artifact.slug === 'chapter-journey-evidence')
    if (journeyAttachedRun.checkResults?.chapterJourneyProbe !== true
      || journeyArtifact?.summary?.contractHashMatchesInput !== true
      || journeyArtifact?.summary?.nonCertifyingEvidenceNotUsedForContinuity !== true) {
      throw new Error('Operator self-test did not bind an exact no-focused-scenario journey report honestly')
    }
    await writeJson(journeyFixturePath, {
      ...journeyFixture,
      contract: { ...journeyFixture.contract, sha256: '0'.repeat(64) },
    })
    await expectRejection(
      () => attachJourneyEvidence(validRunPath, toRepoPath(journeyFixturePath)),
      /contract hash does not match/i,
      'stale journey contract hash',
    )
    const creativeRunner = process.env.PARAVOXIA_STORY_CREATIVE_RUNNER_ARGV_JSON
    const reviewRunner = process.env.PARAVOXIA_STORY_REVIEW_RUNNER_ARGV_JSON
    delete process.env.PARAVOXIA_STORY_CREATIVE_RUNNER_ARGV_JSON
    delete process.env.PARAVOXIA_STORY_REVIEW_RUNNER_ARGV_JSON
    try {
      const stop = await continueWorkflow(validRunPath)
      if (stop.code !== 'missing_role_runner_configuration') {
        throw new Error(`Operator self-test expected missing_role_runner_configuration; got ${stop.code || stop.status}`)
      }
    } finally {
      if (creativeRunner === undefined) delete process.env.PARAVOXIA_STORY_CREATIVE_RUNNER_ARGV_JSON
      else process.env.PARAVOXIA_STORY_CREATIVE_RUNNER_ARGV_JSON = creativeRunner
      if (reviewRunner === undefined) delete process.env.PARAVOXIA_STORY_REVIEW_RUNNER_ARGV_JSON
      else process.env.PARAVOXIA_STORY_REVIEW_RUNNER_ARGV_JSON = reviewRunner
    }
    const blockedRun = await readJson(validRunPath)
    if (blockedRun.operatorExecution?.code !== 'missing_role_runner_configuration'
      || blockedRun.operatorExecution?.requiredAdapterFamily !== 'model_adapter') {
      throw new Error('Operator self-test did not persist the exact missing model-runner blocker')
    }
    const [selfTestSpec] = await Promise.all([readJson(specPath)])
    if (resolveExecutableLane(selfTestSpec.steps.find((step) => step.id === 'inventory-chapter-authority')).kind !== 'deterministic') {
      throw new Error('Operator self-test allowed a deterministic step to enter a model/review lane')
    }
    if (resolveExecutableLane(selfTestSpec.steps.find((step) => step.id === 'record-headed-taste')).kind !== 'human') {
      throw new Error('Operator self-test allowed the human decision step to enter an automated lane')
    }

    const arbitraryDir = path.join(selfTestRoot, 'arbitrary')
    const arbitraryRunPath = path.join(arbitraryDir, 'run.json')
    await fs.mkdir(arbitraryDir, { recursive: true })
    await writeJson(arbitraryRunPath, { schema: 'terra.workflowRun.v1', workflowSpecRef: acceptanceWorkflowRef })
    const arbitraryBefore = await fs.readFile(arbitraryRunPath, 'utf8')
    await expectRejection(() => requireCanonicalAcceptanceRunFile(arbitraryRunPath), /sourceSpec|target-chapter|steps/i, 'arbitrary JSON')
    const rejectedCli = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--run', arbitraryRunPath], {
      cwd: repoRoot,
      encoding: 'utf8',
      shell: false,
    })
    if (rejectedCli.status === 0 || !/sourceSpec|target-chapter|steps/i.test(rejectedCli.stderr || '')) {
      throw new Error(`Self-test --run CLI did not reject arbitrary JSON before mutation: ${rejectedCli.stderr || rejectedCli.stdout}`)
    }
    if (await fs.readFile(arbitraryRunPath, 'utf8') !== arbitraryBefore) throw new Error('Rejected arbitrary JSON was modified')

    const wrongIdentityDir = path.join(selfTestRoot, 'wrong-identity')
    const wrongIdentityRunPath = path.join(wrongIdentityDir, 'run.json')
    await fs.mkdir(wrongIdentityDir, { recursive: true })
    const wrongIdentity = await readJson(validRunPath)
    wrongIdentity.workflowSpecRef = 'paravoxia-creative-triad@v1'
    await writeJson(wrongIdentityRunPath, wrongIdentity)
    const wrongIdentityBefore = await fs.readFile(wrongIdentityRunPath, 'utf8')
    await expectRejection(() => requireCanonicalAcceptanceRunFile(wrongIdentityRunPath), /workflowSpecRef/, 'wrong workflow identity')
    if (await fs.readFile(wrongIdentityRunPath, 'utf8') !== wrongIdentityBefore) throw new Error('Rejected wrong-workflow run was modified')

    await fs.mkdir(outsideRoot, { recursive: true })
    await fs.copyFile(validRunPath, path.join(outsideRoot, 'run.json'))
    const escapedParent = path.join(selfTestRoot, 'escaped-parent')
    await fs.symlink(outsideRoot, escapedParent, 'dir')
    const outsideBefore = await fs.readFile(path.join(outsideRoot, 'run.json'), 'utf8')
    await expectRejection(
      () => requireCanonicalAcceptanceRunFile(path.join(escapedParent, 'run.json')),
      /canonical path|non-symlink|child run\.json/i,
      'symlink escape',
    )
    if (await fs.readFile(path.join(outsideRoot, 'run.json'), 'utf8') !== outsideBefore) throw new Error('Rejected symlink-escaped run was modified')

    const run = await readJson(validRunPath)
    const defectArtifact = run.artifacts.find((artifact) => artifact.slug === 'defect-register')
    if (!defectArtifact) throw new Error('Self-test fixture omitted defect-register')
    defectArtifact.path = 'artifacts/defect-register.json'
    defectArtifact.status = 'present'
    await writeJson(validRunPath, run)
    await fs.mkdir(path.join(validDir, 'artifacts'), { recursive: true })
    const registerPath = path.join(validDir, defectArtifact.path)
    const defectRegister = {
      schema: canonicalDefectRegisterSchema,
      sourceReportsComplete: true,
      sourceHashesCurrent: true,
      findingCoverageComplete: true,
      findings: [
        {
          schema: 'terra.defect.v1',
          id: 'operator-self-test-medium',
          severity: 'medium',
          category: 'objective_guidance_failure',
          description: 'Synthetic unresolved material finding for routing proof.',
          status: 'deferred',
          ownerRole: 'player-experience-auditor',
          evidenceRef: 'fixture://operator-self-test-evidence',
          recheck: 'Re-run the exact chapter objective proof.',
        },
      ],
      openCritical: 0,
      openHigh: 0,
      openMediumUnaccepted: 1,
      openTotal: 1,
      countsMatchEntries: true,
    }
    await writeJson(registerPath, defectRegister)
    await synchronizeCanonicalDefectRegister(validRunPath)
    const synchronizedRun = await readJson(validRunPath)
    if (synchronizedRun.checkResults?.canonicalRepairRequired !== true) throw new Error('Canonical unresolved finding did not set the repair route bit')
    if (synchronizedRun.checkResults?.canonicalDefectsSynchronized !== true) throw new Error('Canonical defect synchronization proof bit is missing')
    if (synchronizedRun.defects?.[0]?.id !== 'operator-self-test-medium') throw new Error('Canonical finding did not mirror into run.defects')
    const synchronizedSummary = synchronizedRun.artifacts.find((artifact) => artifact.slug === 'defect-register')?.summary
    if (synchronizedSummary?.operatorSynchronizationPassed !== true) {
      throw new Error('Canonical defect artifact summary did not record operator synchronization')
    }
    if (synchronizedSummary.sourceReportsComplete !== false
      || synchronizedSummary.sourceHashesCurrent !== false
      || synchronizedSummary.findingCoverageComplete !== false
      || synchronizedSummary.operatorReviewCoverageVerified !== false
      || synchronizedRun.checkResults?.operatorReviewCoverageVerified !== false) {
      throw new Error('Model-claimed review coverage was not deterministically overridden to fail closed')
    }
    await runNode([
      path.join(terraRoot, 'scripts/dev/workflow-run.mjs'),
      'check',
      '--run',
      validRunPath,
      '--gate',
      'canonical-defects-complete',
    ])
    const coverageCheckedRun = await readJson(validRunPath)
    const coverageGate = coverageCheckedRun.gateResults.find((result) => result.gateId === 'canonical-defects-complete')
    if (coverageGate?.status !== 'failed'
      || !(coverageGate.blockingReasons || []).some((reason) => /operatorReviewCoverageVerified/.test(reason))) {
      throw new Error('Canonical defect gate did not expose the unverified review-coverage blocker')
    }

    const runBeforeUnprovenFix = await fs.readFile(validRunPath, 'utf8')
    await writeJson(registerPath, {
      ...defectRegister,
      findings: defectRegister.findings.map((finding) => ({ ...finding, status: 'fixed' })),
      openMediumUnaccepted: 0,
      openTotal: 0,
    })
    await expectRejection(
      () => synchronizeCanonicalDefectRegister(validRunPath),
      /fixEvidenceRef is required for fixed material findings/i,
      'material fixed finding without fix evidence',
    )
    if (await fs.readFile(validRunPath, 'utf8') !== runBeforeUnprovenFix) throw new Error('Rejected unproven material fix modified run.json')

    await writeJson(registerPath, {
      ...defectRegister,
      findings: defectRegister.findings.map((finding) => ({
        ...finding,
        status: 'fixed',
        fixEvidenceRef: 'fixture://operator-self-test-fix',
        recheckResult: { status: 'passed', evidenceRef: 'fixture://operator-self-test-recheck' },
      })),
      openMediumUnaccepted: 0,
      openTotal: 0,
    })
    await synchronizeCanonicalDefectRegister(validRunPath)
    const fixedRun = await readJson(validRunPath)
    if (fixedRun.checkResults?.canonicalRepairRequired !== false) throw new Error('Proven fixed material finding did not clear the canonical repair route')

    const runBeforeMaterialException = await fs.readFile(validRunPath, 'utf8')
    await writeJson(registerPath, {
      ...defectRegister,
      findings: defectRegister.findings.map((finding) => ({ ...finding, status: 'accepted_exception' })),
      openMediumUnaccepted: 0,
      openTotal: 0,
    })
    await expectRejection(
      () => synchronizeCanonicalDefectRegister(validRunPath),
      /may not use accepted_exception for a material severity/i,
      'model-controlled material accepted exception',
    )
    if (await fs.readFile(validRunPath, 'utf8') !== runBeforeMaterialException) throw new Error('Rejected material accepted_exception modified run.json')

    const retainedHigh = {
      schema: 'terra.defect.v1',
      id: 'operator-self-test-retained-high',
      severity: 'high',
      category: 'objective_guidance_failure',
      description: 'Retained high-severity finding for duplicate resolution proof.',
      status: 'open',
      ownerRole: 'player-experience-auditor',
      evidenceRef: 'fixture://operator-self-test-retained',
      recheck: 'Re-run the retained finding proof.',
    }
    const validDuplicateRegister = {
      ...defectRegister,
      findings: [
        retainedHigh,
        {
          schema: 'terra.defect.v1',
          id: 'operator-self-test-duplicate-medium',
          severity: 'medium',
          category: 'objective_guidance_failure',
          description: 'Duplicate that resolves to the retained high finding.',
          status: 'duplicate',
          duplicateOf: retainedHigh.id,
        },
      ],
      openHigh: 1,
      openMediumUnaccepted: 0,
      openTotal: 1,
    }
    await writeJson(registerPath, validDuplicateRegister)
    await synchronizeCanonicalDefectRegister(validRunPath)
    const duplicateRun = await readJson(validRunPath)
    if (duplicateRun.defects?.find((finding) => finding.id === 'operator-self-test-duplicate-medium')?.duplicateOf !== retainedHigh.id) {
      throw new Error('Valid duplicate relationship was not retained in the canonical mirror')
    }

    const runBeforeMissingDuplicate = await fs.readFile(validRunPath, 'utf8')
    await writeJson(registerPath, {
      ...defectRegister,
      findings: [{
        schema: 'terra.defect.v1',
        id: 'operator-self-test-missing-duplicate',
        severity: 'low',
        category: 'objective_guidance_failure',
        description: 'Invalid duplicate with a missing retained target.',
        status: 'duplicate',
        duplicateOf: 'missing-retained-finding',
      }],
      openMediumUnaccepted: 0,
      openTotal: 0,
    })
    await expectRejection(
      () => synchronizeCanonicalDefectRegister(validRunPath),
      /references missing retained finding/i,
      'duplicate with missing retained target',
    )
    if (await fs.readFile(validRunPath, 'utf8') !== runBeforeMissingDuplicate) throw new Error('Rejected missing duplicate target modified run.json')

    await writeJson(registerPath, {
      ...validDuplicateRegister,
      findings: [
        { ...retainedHigh, severity: 'medium', id: 'operator-self-test-retained-medium' },
        {
          schema: 'terra.defect.v1',
          id: 'operator-self-test-duplicate-critical',
          severity: 'critical',
          category: 'objective_guidance_failure',
          description: 'Invalid critical duplicate resolving to a lower severity.',
          status: 'duplicate',
          duplicateOf: 'operator-self-test-retained-medium',
        },
      ],
      openHigh: 0,
      openMediumUnaccepted: 1,
    })
    await expectRejection(
      () => synchronizeCanonicalDefectRegister(validRunPath),
      /same-or-higher severity retained finding/i,
      'duplicate resolving to lower severity',
    )

    await writeJson(registerPath, {
      ...defectRegister,
      findings: [
        {
          schema: 'terra.defect.v1', id: 'duplicate-cycle-a', severity: 'low', category: 'objective_guidance_failure',
          description: 'First invalid cycle node.', status: 'duplicate', duplicateOf: 'duplicate-cycle-b',
        },
        {
          schema: 'terra.defect.v1', id: 'duplicate-cycle-b', severity: 'low', category: 'objective_guidance_failure',
          description: 'Second invalid cycle node.', status: 'duplicate', duplicateOf: 'duplicate-cycle-a',
        },
      ],
      openMediumUnaccepted: 0,
      openTotal: 0,
    })
    await expectRejection(
      () => synchronizeCanonicalDefectRegister(validRunPath),
      /duplicate cycle detected/i,
      'duplicate cycle',
    )

    const runBeforeMismatchedCount = await fs.readFile(validRunPath, 'utf8')
    await writeJson(registerPath, { ...defectRegister, openMediumUnaccepted: 0 })
    await expectRejection(
      () => synchronizeCanonicalDefectRegister(validRunPath),
      /openMediumUnaccepted.*findings-derived count 1/i,
      'mismatched defect count',
    )
    if (await fs.readFile(validRunPath, 'utf8') !== runBeforeMismatchedCount) throw new Error('Rejected defect-count mismatch modified run.json')

    console.log('Paravoxia chapter-acceptance operator self-test passed: canonical new/resumed paths and exact journey evidence accepted; stale journey hashes, evidence symlink escape, arbitrary JSON, wrong identity, unproven material fixes, material accepted_exception, invalid duplicate targets/cycles, and mismatched counts rejected; review coverage failed closed; canonical findings mirrored and routed repair.')
  } finally {
    await fs.rm(selfTestRoot, { recursive: true, force: true })
    await fs.rm(outsideRoot, { recursive: true, force: true })
  }
}

async function expectRejection(operation, pattern, label) {
  try {
    await operation()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!pattern.test(message)) throw new Error(`Self-test ${label} rejected for the wrong reason: ${message}`)
    return
  }
  throw new Error(`Self-test did not reject ${label}`)
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function safeSlug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'chapter'
}

function timestamp() {
  return new Date().toISOString().replace(/[-:.]/g, '')
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
    '  node main/tools/creative-chapter-acceptance-workflow.mjs \\',
    '    --chapter <id> --candidate-revision <git-sha> \\',
    '    --production-authority <file> --council-authority <file> \\',
    '    --scene-authority <file> --previous-context <file> --next-context <file>',
    '',
    'Inspect an initialized run:',
    '  node main/tools/creative-chapter-acceptance-workflow.mjs --run <run.json>',
    'Run compatible roles until a real blocker or completion:',
    '  node main/tools/creative-chapter-acceptance-workflow.mjs --run <run.json> --continue',
    '',
    'Add --run-mechanical to execute and record the target-aware chapter runner.',
    'Use --attach-mechanical-evidence to bind an already-written exact-run report without rerunning the browser.',
    'Add --run-journey to execute the contract-driven browser regression lane; select --journey-lane continuous, direct-entry, or resume.',
    'Use --journey-evidence <repo-file> to bind an existing exact-revision journey report.',
    'Use --manual-evidence <repo-file> and --audio-evidence <repo-file> to bind external player and live-audio proof.',
    'Use --self-test to prove run-path containment, workflow identity, and canonical defect routing.',
    'New runs execute immediately; --continue resumes an existing run. Missing model/review runner env is persisted as a recoverable blocker.',
    'Model roles require PARAVOXIA_STORY_CREATIVE_RUNNER_ARGV_JSON; review roles require PARAVOXIA_STORY_REVIEW_RUNNER_ARGV_JSON.',
    'Each value must be a JSON argv array for a read-only runner that returns the guarded terra.roleResult.v1 contract.',
    'Deterministic/tool steps stop with missing_deterministic_adapter until an evidence-backed exact-output executor is implemented.',
    'Initialization requires a clean checked-out candidate revision and real repo-local authority files.',
  ].join('\n'))
}
