#!/usr/bin/env node

import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { isDeepStrictEqual } from 'node:util'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '../..')
const terraRunner = path.resolve(scriptDir, '../../../TerraForm/scripts/dev/workflow-role-cli-runner.mjs')
const specPath = path.join(repoRoot, 'docs/architecture/workflow-orchestration/examples/paravoxia-chapter-acceptance.workflow.json')
const bindingsPath = path.join(repoRoot, 'docs/architecture/workflow-orchestration/examples/paravoxia-chapter-acceptance.local.adapter-bindings.json')
const markdownMetadataFence = 'paravoxia-artifact-metadata'
const markdownMetadataSchema = 'paravoxia.chapterAcceptanceMarkdownMetadata.v1'
const minimumMarkdownBodyCharacters = 200
const minimumMarkdownBodyWords = 30
const lanePolicies = {
  creative: {
    stepTypes: new Set(['model_task', 'artifact_collection']),
    family: 'model_adapter',
    requirementId: 'acceptance-reasoning-runner',
    adapterId: 'acceptance-analysis',
    identityClass: 'acceptance_verifier',
    envName: 'PARAVOXIA_STORY_CREATIVE_RUNNER_ARGV_JSON',
  },
  review: {
    stepTypes: new Set(['review']),
    family: 'review_adapter',
    requirementId: 'acceptance-review-runner',
    adapterId: 'independent-review',
    identityClass: 'independent_acceptance_reviewer',
    envName: 'PARAVOXIA_STORY_REVIEW_RUNNER_ARGV_JSON',
  },
}

try {
  if (process.argv[2] === '--self-test') {
    await selfTest()
  } else {
    await main()
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}

async function main() {
  const lane = process.argv[2]
  const invocationPath = process.argv[3]
  const resultPath = process.argv[4]
  if (!lanePolicies[lane] || !invocationPath || !resultPath) {
    throw new Error(
      'Usage: node main/tools/chapter-acceptance-role-cli-runner.mjs <creative|review> <invocation-path> <result-path>',
    )
  }

  const [invocation, spec, bindingSet] = await Promise.all([
    readJson(invocationPath),
    readJson(specPath),
    readJson(bindingsPath),
  ])
  const executionContract = validateInvocation(lane, invocation, spec, bindingSet)
  const runnerArgv = readArgvEnv(executionContract.runnerEnv)
  const guardedInvocation = {
    ...invocation,
    executionContract: publicExecutionContract(executionContract),
    outputRequirements: buildOutputRequirements(executionContract, spec),
  }
  await writeJson(invocationPath, guardedInvocation)

  const exitCode = await run([
    process.execPath,
    terraRunner,
    invocationPath,
    resultPath,
  ], {
    ...process.env,
    TERRA_ROLE_CLI_ARGV_JSON: JSON.stringify(runnerArgv),
  })
  if (exitCode !== 0) throw new Error(`${lane} story role runner exited ${exitCode}`)

  const result = await readJson(resultPath)
  const priorSessions = lane === 'review' ? await readPriorReviewSessions(invocationPath) : new Set()
  const normalizedResult = validateRoleResult(result, guardedInvocation, executionContract, spec, priorSessions)
  await writeJson(resultPath, normalizedResult)
}

function validateInvocation(lane, invocation, spec, bindingSet) {
  const policy = lanePolicies[lane]
  requireEqual(invocation.schema, 'terra.roleInvocation.v1', 'invocation.schema')
  requireEqual(invocation.workflowSpecRef, `${spec.identity.slug}@${spec.identity.version}`, 'invocation.workflowSpecRef')
  const step = (spec.steps || []).find((candidate) => candidate.id === invocation.step?.id)
  if (!step) throw new Error(`Execution boundary rejected unknown step ${invocation.step?.id || 'missing'}`)
  const role = (spec.roleContracts || []).find((candidate) => candidate.slug === step.roleContractRef)
  if (!role) throw new Error(`Execution boundary rejected unknown role ${step.roleContractRef || 'missing'}`)
  requireEqual(invocation.step?.type, step.type, 'invocation.step.type')
  requireEqual(invocation.step?.roleContractRef, step.roleContractRef, 'invocation.step.roleContractRef')
  requireExactSet(invocation.step?.allowedAdapterFamilies, step.allowedAdapterFamilies || [], 'invocation.step.allowedAdapterFamilies')
  requireExactSet(invocation.step?.adapterRequirementRefs, step.adapterRequirementRefs || [], 'invocation.step.adapterRequirementRefs')
  requireEqual(invocation.role?.slug, role.slug, 'invocation.role.slug')
  requireEqual(invocation.role?.outputContract, role.outputContract, 'invocation.role.outputContract')

  if (!policy.stepTypes.has(step.type)) {
    throw new Error(`Execution boundary rejected ${step.id}: ${lane} runner cannot execute ${step.type} steps`)
  }
  requireExactSet(step.allowedAdapterFamilies, [policy.family], `${step.id}.allowedAdapterFamilies`)
  requireExactSet(step.adapterRequirementRefs, [policy.requirementId], `${step.id}.adapterRequirementRefs`)
  requireExactSet(invocation.allowedOutputs, step.outputs || [], `${step.id}.allowedOutputs`)

  const binding = (bindingSet.bindings || []).find((candidate) => candidate.requirementId === policy.requirementId)
  if (!binding) throw new Error(`Execution boundary rejected ${step.id}: missing binding ${policy.requirementId}`)
  requireEqual(binding.family, policy.family, `${policy.requirementId}.family`)
  requireEqual(binding.configuration?.identityClass, policy.identityClass, `${policy.requirementId}.identityClass`)
  if (binding.limits?.repoWritesAllowed !== false || binding.limits?.publishAllowed !== false) {
    throw new Error(`Execution boundary rejected ${step.id}: ${policy.requirementId} must be read-only and unable to publish`)
  }
  const runnerEnv = parseEnvRef(binding.configuration?.runnerArgvRef, `${policy.requirementId}.runnerArgvRef`)
  requireEqual(runnerEnv, policy.envName, `${policy.requirementId}.runnerArgvRef`)
  const adapter = (bindingSet.roleCatalog || []).find((candidate) => candidate.id === policy.adapterId)
  if (!adapter) throw new Error(`Execution boundary rejected ${step.id}: missing role adapter ${policy.adapterId}`)
  requireEqual(adapter.bindingRequirementId, policy.requirementId, `${policy.adapterId}.bindingRequirementId`)
  if (adapter.privileged !== false) throw new Error(`Execution boundary rejected privileged role adapter ${policy.adapterId}`)
  const adapterBinding = (bindingSet.bindings || []).find((candidate) => candidate.requirementId === adapter.bindingRequirementId)
  requireEqual(adapterBinding?.family, policy.family, `${policy.adapterId}.family`)

  return {
    schema: 'paravoxia.chapterAcceptanceRoleExecutionContract.v1',
    invocationId: invocation.id,
    stepId: step.id,
    stepType: step.type,
    roleContractRef: role.slug,
    outputContract: role.outputContract,
    bindingRequirementId: policy.requirementId,
    adapterFamily: policy.family,
    adapterId: policy.adapterId,
    adapterSlug: binding.adapter?.slug,
    identityClass: policy.identityClass,
    exactOutputs: [...(step.outputs || [])],
    runnerEnv,
    requireFreshSession: lane === 'review',
    mutationBoundary: 'read_only',
  }
}

function publicExecutionContract(contract) {
  const { runnerEnv: _runnerEnv, ...publicContract } = contract
  return publicContract
}

function buildOutputRequirements(contract, spec) {
  const identityValues = Object.fromEntries([
    'invocationId', 'stepId', 'roleContractRef', 'outputContract', 'bindingRequirementId',
    'adapterFamily', 'adapterId', 'adapterSlug', 'identityClass', 'mutationBoundary',
  ].map((field) => [field, contract[field]]))
  const artifactsBySlug = new Map((spec.artifactRequirements || []).map((artifact) => [artifact.slug, artifact]))
  return {
    schema: 'paravoxia.chapterAcceptanceRoleOutputRequirements.v1',
    resultSchema: 'terra.roleResult.v1',
    resultStepId: contract.stepId,
    exactArtifactSlugs: [...contract.exactOutputs],
    executionIdentity: {
      schema: 'paravoxia.chapterAcceptanceRoleExecutionIdentity.v1',
      exactValues: identityValues,
      requiredAdditionalFields: ['sessionId'],
      sessionPolicy: contract.requireFreshSession ? 'fresh_unique_review_session' : 'non_empty_role_session',
    },
    artifactContracts: contract.exactOutputs.map((slug) => {
      const artifact = artifactsBySlug.get(slug)
      return {
        slug,
        format: artifact?.format,
        schemaRef: artifact?.schemaRef || null,
        requiredGateSummaryPaths: gateChecksForArtifact(spec, slug).map((check) => check.path),
        semanticSummarySource: artifact?.format === 'markdown'
          ? `${markdownMetadataFence} JSON fence gateSummary`
          : 'parsed JSON artifact body',
        markdownMetadata: artifact?.format === 'markdown' ? {
          fence: markdownMetadataFence,
          schema: markdownMetadataSchema,
          requiredFields: ['schema', 'artifactSlug', 'gateSummary'],
          minimumBodyCharacters: minimumMarkdownBodyCharacters,
          minimumBodyWords: minimumMarkdownBodyWords,
        } : null,
      }
    }),
    artifactSummaryPolicy: {
      canonicalSource: 'validated_artifact_content_plus_operator_provenance',
      modelSuppliedSummary: 'optional_consistency_claim_only',
      contradictoryOrUnbackedClaims: 'reject',
      operatorDerivedFields: [
        'artifactSlug', 'roleContractRef', 'outputContract', 'adapterIdentityClass',
        'sessionId', 'invocationId', 'contentFormat', 'contentSha256', 'summaryDerivedFrom',
      ],
    },
    contentPolicy: 'JSON must expose every gate-visible field with a compatible type; Markdown must contain one valid metadata fence and substantive prose',
  }
}

function validateRoleResult(result, invocation, contract, spec, priorSessions = new Set()) {
  requireEqual(result.schema, 'terra.roleResult.v1', 'role result schema')
  requireEqual(result.stepId, contract.stepId, 'role result stepId')
  if (!Array.isArray(result.artifacts)) throw new Error('Role result artifacts must be an array')
  requireExactSet(result.artifacts.map((artifact) => artifact.slug), contract.exactOutputs, 'role result artifacts')

  const identity = result.executionIdentity
  if (!identity || typeof identity !== 'object' || Array.isArray(identity)) {
    throw new Error('Role result requires executionIdentity; anonymous role output is rejected')
  }
  requireEqual(identity.schema, 'paravoxia.chapterAcceptanceRoleExecutionIdentity.v1', 'executionIdentity.schema')
  for (const field of [
    'invocationId',
    'stepId',
    'roleContractRef',
    'outputContract',
    'bindingRequirementId',
    'adapterFamily',
    'adapterId',
    'adapterSlug',
    'identityClass',
    'mutationBoundary',
  ]) requireEqual(identity[field], contract[field], `executionIdentity.${field}`)
  if (typeof identity.sessionId !== 'string' || !identity.sessionId.trim()) {
    throw new Error('executionIdentity.sessionId must be a non-empty fresh role-session id')
  }
  if (contract.requireFreshSession && priorSessions.has(identity.sessionId)) {
    throw new Error(`Independent review session ${identity.sessionId} was already used; each review seat requires a fresh session`)
  }

  const artifactsBySlug = new Map((spec.artifactRequirements || []).map((artifact) => [artifact.slug, artifact]))
  for (const output of result.artifacts) {
    if (typeof output.content !== 'string' || !output.content.trim()) {
      throw new Error(`Role result artifact ${output.slug} requires non-empty string content`)
    }
    const artifactContract = artifactsBySlug.get(output.slug)
    if (!artifactContract) throw new Error(`Role result artifact ${output.slug} is not declared by the workflow`)
    const semanticSummary = semanticSummaryFromContent(output, artifactContract, spec)
    const normalizedContent = output.content.endsWith('\n') ? output.content : `${output.content}\n`
    const provenance = operatorProvenance(output.slug, artifactContract.format, normalizedContent, contract, identity)
    rejectOperatorFieldCollisions(semanticSummary, provenance, output.slug)
    validateClaimedSummary(output.summary, semanticSummary, provenance, output.slug)
    output.content = normalizedContent
    output.summary = { ...semanticSummary, ...provenance }
  }
  requireEqual(invocation.executionContract?.outputContract, contract.outputContract, 'invocation.executionContract.outputContract')
  return result
}

function semanticSummaryFromContent(output, artifactContract, spec) {
  let semanticSummary
  if (artifactContract.format === 'json') {
    try {
      semanticSummary = JSON.parse(output.content)
    } catch {
      throw new Error(`Role result artifact ${output.slug} must contain valid JSON`)
    }
    if (!isPlainObject(semanticSummary)) {
      throw new Error(`Role result artifact ${output.slug} JSON must be an object`)
    }
    if (artifactContract.schemaRef) requireEqual(semanticSummary.schema, artifactContract.schemaRef, `${output.slug}.schema`)
  } else if (artifactContract.format === 'markdown') {
    semanticSummary = parseMarkdownArtifact(output.slug, output.content)
  } else {
    throw new Error(`Role result artifact ${output.slug} format ${artifactContract.format || 'missing'} is not supported by the guarded role runner`)
  }
  validateGateVisibleSummary(output.slug, semanticSummary, spec)
  return semanticSummary
}

function parseMarkdownArtifact(slug, content) {
  const fencePattern = new RegExp('```' + markdownMetadataFence + '\\s*\\r?\\n([\\s\\S]*?)\\r?\\n```', 'g')
  const matches = [...content.matchAll(fencePattern)]
  if (matches.length !== 1) {
    throw new Error(`Role result artifact ${slug} must contain exactly one ${markdownMetadataFence} JSON fence`)
  }
  let metadata
  try {
    metadata = JSON.parse(matches[0][1])
  } catch {
    throw new Error(`Role result artifact ${slug} ${markdownMetadataFence} fence must contain valid JSON`)
  }
  if (!isPlainObject(metadata)) throw new Error(`Role result artifact ${slug} metadata must be a JSON object`)
  requireExactKeys(metadata, ['schema', 'artifactSlug', 'gateSummary'], `${slug} metadata`)
  requireEqual(metadata.schema, markdownMetadataSchema, `${slug} metadata.schema`)
  requireEqual(metadata.artifactSlug, slug, `${slug} metadata.artifactSlug`)
  if (!isPlainObject(metadata.gateSummary) || Object.keys(metadata.gateSummary).length === 0) {
    throw new Error(`Role result artifact ${slug} metadata.gateSummary must be a non-empty JSON object`)
  }

  const body = content.replace(matches[0][0], '').trim()
  const bodyWords = body.split(/\s+/u).filter(Boolean)
  if (body.length < minimumMarkdownBodyCharacters || bodyWords.length < minimumMarkdownBodyWords) {
    throw new Error(
      `Role result artifact ${slug} Markdown body is too thin; require at least ${minimumMarkdownBodyCharacters} characters and ${minimumMarkdownBodyWords} words outside metadata`,
    )
  }
  if (!/^#{1,6}\s+\S/m.test(body)) {
    throw new Error(`Role result artifact ${slug} Markdown body requires a descriptive heading`)
  }
  return metadata.gateSummary
}

function validateGateVisibleSummary(slug, semanticSummary, spec) {
  const checks = gateChecksForArtifact(spec, slug)
  if (checks.length === 0 && Object.keys(semanticSummary).filter((field) => field !== 'schema').length === 0) {
    throw new Error(`Role result artifact ${slug} content is too thin to derive a semantic summary`)
  }
  for (const check of checks) {
    const resolved = valueAtPath(semanticSummary, check.path)
    if (!resolved.found) throw new Error(`Role result artifact ${slug} content is missing gate-visible field ${check.path}`)
    if (!gateValueHasCompatibleType(resolved.value, check.expected, check.operator)) {
      throw new Error(`Role result artifact ${slug} gate-visible field ${check.path} has an incompatible type`)
    }
  }
}

function gateChecksForArtifact(spec, slug) {
  const prefix = `${slug}.`
  const checks = []
  for (const gate of spec.gates || []) {
    for (const expression of gate.checks || []) {
      if (typeof expression !== 'string' || !expression.startsWith(prefix)) continue
      const parsed = expression.slice(prefix.length).match(/^([A-Za-z0-9_.-]+)\s*(==|!=|>=|<=|>|<)\s*(.+)$/)
      if (!parsed) continue
      checks.push({ path: parsed[1], operator: parsed[2], expected: parseGateLiteral(parsed[3]) })
    }
  }
  return checks
}

function parseGateLiteral(raw) {
  const value = raw.trim()
  if (value === 'true') return true
  if (value === 'false') return false
  if (value === 'null') return null
  if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(value)) return Number(value)
  if (value.startsWith('"') && value.endsWith('"')) {
    try { return JSON.parse(value) } catch { return value.slice(1, -1) }
  }
  return value
}

function gateValueHasCompatibleType(actual, expected, operator) {
  if (['>', '<', '>=', '<='].includes(operator)) return typeof actual === 'number' && Number.isFinite(actual)
  if (expected === null) return actual === null
  if (typeof expected === 'number') return typeof actual === 'number' && Number.isFinite(actual)
  return typeof actual === typeof expected
}

function valueAtPath(value, fieldPath) {
  let current = value
  for (const segment of fieldPath.split('.')) {
    if (!isPlainObject(current) || !Object.prototype.hasOwnProperty.call(current, segment)) return { found: false }
    current = current[segment]
  }
  return { found: true, value: current }
}

function operatorProvenance(slug, format, content, contract, identity) {
  return {
    artifactSlug: slug,
    roleContractRef: contract.roleContractRef,
    outputContract: contract.outputContract,
    adapterIdentityClass: contract.identityClass,
    sessionId: identity.sessionId,
    invocationId: contract.invocationId,
    contentFormat: format,
    contentSha256: createHash('sha256').update(content).digest('hex'),
    summaryDerivedFrom: format === 'markdown' ? 'markdown_metadata_fence' : 'json_artifact_content',
  }
}

function rejectOperatorFieldCollisions(semanticSummary, provenance, slug) {
  for (const [field, expected] of Object.entries(provenance)) {
    if (Object.prototype.hasOwnProperty.call(semanticSummary, field) && !isDeepStrictEqual(semanticSummary[field], expected)) {
      throw new Error(`Role result artifact ${slug} content contradicts operator-derived field ${field}`)
    }
  }
}

function validateClaimedSummary(claimedSummary, semanticSummary, provenance, slug) {
  if (claimedSummary == null) return
  if (!isPlainObject(claimedSummary)) throw new Error(`Role result artifact ${slug} summary must be a JSON object when supplied`)
  for (const [field, claimed] of Object.entries(claimedSummary)) {
    const source = Object.prototype.hasOwnProperty.call(provenance, field)
      ? provenance
      : Object.prototype.hasOwnProperty.call(semanticSummary, field) ? semanticSummary : null
    if (!source) throw new Error(`Role result artifact ${slug} summary field ${field} is not backed by validated content or operator provenance`)
    if (!isDeepStrictEqual(claimed, source[field])) {
      throw new Error(`Role result artifact ${slug} summary field ${field} contradicts validated artifact content`)
    }
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function requireExactKeys(value, expected, label) {
  requireExactSet(Object.keys(value), expected, label)
}

async function readPriorReviewSessions(invocationPath) {
  const runDir = path.resolve(path.dirname(invocationPath), '../..')
  const run = await readJson(path.join(runDir, 'run.json')).catch(() => null)
  const sessions = new Set()
  for (const artifact of run?.artifacts || []) {
    if (artifact.status === 'present' && typeof artifact.summary?.sessionId === 'string') {
      sessions.add(artifact.summary.sessionId)
    }
  }
  return sessions
}

function readArgvEnv(name) {
  const raw = process.env[name]
  if (!raw) {
    throw new Error(`${name} is required; set it to a JSON argv array for a read-only runner that returns the guarded terra.roleResult.v1 contract`)
  }
  let argv
  try {
    argv = JSON.parse(raw)
  } catch {
    throw new Error(`${name} must contain valid JSON`)
  }
  if (!Array.isArray(argv) || argv.length === 0 || argv.some((item) => typeof item !== 'string' || item.length === 0)) {
    throw new Error(`${name} must be a non-empty JSON string array`)
  }
  return argv
}

function parseEnvRef(value, label) {
  if (typeof value !== 'string' || !value.startsWith('env:') || value.length === 4) {
    throw new Error(`${label} must be an explicit env:NAME reference`)
  }
  return value.slice(4)
}

function requireEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label} must equal ${expected}; got ${actual ?? 'missing'}`)
}

function requireExactSet(actual, expected, label) {
  if (!Array.isArray(actual)) throw new Error(`${label} must be an array`)
  const actualSet = new Set(actual)
  const expectedSet = new Set(expected)
  if (actualSet.size !== actual.length || expectedSet.size !== expected.length
    || actualSet.size !== expectedSet.size || [...actualSet].some((value) => !expectedSet.has(value))) {
    throw new Error(`${label} must equal [${expected.join(', ')}]; got [${actual.join(', ')}]`)
  }
}

function run(argv, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(argv[0], argv.slice(1), {
      cwd: repoRoot,
      env,
      shell: false,
      stdio: 'inherit',
    })
    child.on('error', reject)
    child.on('close', (code) => resolve(code ?? 1))
  })
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'))
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

async function selfTest() {
  const [spec, bindingSet] = await Promise.all([readJson(specPath), readJson(bindingsPath)])
  const buildInvocation = (stepId) => {
    const step = spec.steps.find((candidate) => candidate.id === stepId)
    const role = spec.roleContracts.find((candidate) => candidate.slug === step.roleContractRef)
    return {
      schema: 'terra.roleInvocation.v1',
      id: `self-test-${stepId}`,
      workflowSpecRef: `${spec.identity.slug}@${spec.identity.version}`,
      runId: 'self-test',
      step,
      role,
      allowedOutputs: step.outputs,
    }
  }
  const buildGateSummary = (slug) => {
    const summary = {}
    for (const check of gateChecksForArtifact(spec, slug)) setValueAtPath(summary, check.path, check.expected)
    if (Object.keys(summary).length === 0) summary.recorded = true
    return summary
  }
  const buildMarkdownContent = (slug, gateSummary = buildGateSummary(slug), body = null) => [
    `# ${slug} evidence review`,
    '',
    body || [
      'This independent report evaluates the bound chapter evidence, records concrete observations, and traces its disposition to the supplied runtime artifacts.',
      'It names material risks, explains the evidence behind each conclusion, and preserves actionable repair guidance for the downstream moderator and judge.',
      'The prose is intentionally substantive so a metadata-only or placeholder response cannot satisfy the guarded chapter acceptance boundary.',
    ].join(' '),
    '',
    `\`\`\`${markdownMetadataFence}`,
    JSON.stringify({ schema: markdownMetadataSchema, artifactSlug: slug, gateSummary }, null, 2),
    '\`\`\`',
    '',
  ].join('\n')
  const buildContent = (artifact) => {
    const semanticSummary = buildGateSummary(artifact.slug)
    if (artifact.format === 'markdown') return buildMarkdownContent(artifact.slug, semanticSummary)
    if (artifact.schemaRef) semanticSummary.schema = artifact.schemaRef
    return JSON.stringify(semanticSummary, null, 2)
  }
  const buildResult = (invocation, contract, sessionId = `session-${contract.stepId}`) => ({
    schema: 'terra.roleResult.v1',
    stepId: contract.stepId,
    executionIdentity: {
      schema: 'paravoxia.chapterAcceptanceRoleExecutionIdentity.v1',
      ...Object.fromEntries([
        'invocationId', 'stepId', 'roleContractRef', 'outputContract', 'bindingRequirementId',
        'adapterFamily', 'adapterId', 'adapterSlug', 'identityClass', 'mutationBoundary',
      ].map((field) => [field, contract[field]])),
      sessionId,
    },
    artifacts: contract.exactOutputs.map((slug) => {
      const artifact = spec.artifactRequirements.find((candidate) => candidate.slug === slug)
      return {
        slug,
        content: buildContent(artifact),
        summary: {
          roleContractRef: contract.roleContractRef,
          outputContract: contract.outputContract,
          adapterIdentityClass: contract.identityClass,
          sessionId,
          invocationId: contract.invocationId,
        },
      }
    }),
  })

  const creativeInvocation = buildInvocation('lock-chapter-acceptance')
  const creativeContract = validateInvocation('creative', creativeInvocation, spec, bindingSet)
  creativeInvocation.executionContract = publicExecutionContract(creativeContract)
  creativeInvocation.outputRequirements = buildOutputRequirements(creativeContract, spec)
  const creativeResult = validateRoleResult(
    buildResult(creativeInvocation, creativeContract), creativeInvocation, creativeContract, spec,
  )
  assert.equal(creativeResult.artifacts[0].summary.targetChapterMatchesInput, true)
  assert.equal(creativeResult.artifacts[0].summary.summaryDerivedFrom, 'json_artifact_content')
  assert.match(creativeResult.artifacts[0].summary.contentSha256, /^[a-f0-9]{64}$/)

  const reviewInvocation = buildInvocation('audit-narrative')
  const reviewContract = validateInvocation('review', reviewInvocation, spec, bindingSet)
  reviewInvocation.executionContract = publicExecutionContract(reviewContract)
  reviewInvocation.outputRequirements = buildOutputRequirements(reviewContract, spec)
  const reviewResult = validateRoleResult(
    buildResult(reviewInvocation, reviewContract), reviewInvocation, reviewContract, spec,
  )
  assert.equal(reviewResult.artifacts[0].summary.reviewComplete, true)
  assert.equal(reviewResult.artifacts[0].summary.summaryDerivedFrom, 'markdown_metadata_fence')

  expectReject(() => validateInvocation('creative', buildInvocation('inventory-chapter-authority'), spec, bindingSet), /cannot execute deterministic_check/)
  const wrongFamily = structuredClone(buildInvocation('lock-chapter-acceptance'))
  wrongFamily.step.allowedAdapterFamilies = ['review_adapter']
  expectReject(() => validateInvocation('creative', wrongFamily, spec, bindingSet), /allowedAdapterFamilies/)
  const wrongIdentity = buildResult(reviewInvocation, reviewContract)
  wrongIdentity.executionIdentity.identityClass = 'acceptance_verifier'
  expectReject(() => validateRoleResult(wrongIdentity, reviewInvocation, reviewContract, spec), /identityClass/)
  const wrongContract = buildResult(reviewInvocation, reviewContract)
  wrongContract.executionIdentity.outputContract = 'wrong.contract.v1'
  expectReject(() => validateRoleResult(wrongContract, reviewInvocation, reviewContract, spec), /outputContract/)
  const partial = buildResult(reviewInvocation, reviewContract)
  partial.artifacts = []
  expectReject(() => validateRoleResult(partial, reviewInvocation, reviewContract, spec), /role result artifacts/)
  const reusedSession = buildResult(reviewInvocation, reviewContract, 'reused-review-session')
  expectReject(() => validateRoleResult(reusedSession, reviewInvocation, reviewContract, spec, new Set(['reused-review-session'])), /already used/)

  const redMarkdown = buildResult(reviewInvocation, reviewContract, 'red-markdown-session')
  redMarkdown.artifacts[0].content = buildMarkdownContent('story-audit', { reviewComplete: false })
  const normalizedRed = validateRoleResult(redMarkdown, reviewInvocation, reviewContract, spec)
  assert.equal(normalizedRed.artifacts[0].summary.reviewComplete, false)
  const contradictoryMarkdown = buildResult(reviewInvocation, reviewContract, 'contradictory-markdown-session')
  contradictoryMarkdown.artifacts[0].content = buildMarkdownContent('story-audit', { reviewComplete: false })
  contradictoryMarkdown.artifacts[0].summary.reviewComplete = true
  expectReject(
    () => validateRoleResult(contradictoryMarkdown, reviewInvocation, reviewContract, spec),
    /contradicts validated artifact content/,
  )
  const missingMetadata = buildResult(reviewInvocation, reviewContract, 'missing-metadata-session')
  missingMetadata.artifacts[0].content = '# Review\n\nThis report has enough prose to look plausible but deliberately omits canonical machine-readable metadata. '.repeat(4)
  expectReject(() => validateRoleResult(missingMetadata, reviewInvocation, reviewContract, spec), /exactly one paravoxia-artifact-metadata/)
  const thinMarkdown = buildResult(reviewInvocation, reviewContract, 'thin-markdown-session')
  thinMarkdown.artifacts[0].content = buildMarkdownContent('story-audit', { reviewComplete: true }, 'Too thin.')
  expectReject(() => validateRoleResult(thinMarkdown, reviewInvocation, reviewContract, spec), /Markdown body is too thin/)

  const contradictoryJson = buildResult(creativeInvocation, creativeContract, 'contradictory-json-session')
  const contradictoryJsonBody = JSON.parse(contradictoryJson.artifacts[0].content)
  contradictoryJsonBody.targetChapterMatchesInput = false
  contradictoryJson.artifacts[0].content = JSON.stringify(contradictoryJsonBody)
  contradictoryJson.artifacts[0].summary.targetChapterMatchesInput = true
  expectReject(
    () => validateRoleResult(contradictoryJson, creativeInvocation, creativeContract, spec),
    /contradicts validated artifact content/,
  )
  const thinJson = buildResult(creativeInvocation, creativeContract, 'thin-json-session')
  thinJson.artifacts[0].content = '{}'
  expectReject(() => validateRoleResult(thinJson, creativeInvocation, creativeContract, spec), /missing gate-visible field/)
  const unbackedSummary = buildResult(reviewInvocation, reviewContract, 'unbacked-summary-session')
  unbackedSummary.artifacts[0].summary.unbackedGreen = true
  expectReject(() => validateRoleResult(unbackedSummary, reviewInvocation, reviewContract, spec), /not backed by validated content/)

  assert.equal(reviewInvocation.outputRequirements.artifactSummaryPolicy.canonicalSource, 'validated_artifact_content_plus_operator_provenance')
  assert.equal(reviewInvocation.outputRequirements.artifactContracts[0].markdownMetadata.schema, markdownMetadataSchema)
  console.log('Chapter acceptance guarded role runner self-test passed (17 checks).')
}

function setValueAtPath(target, fieldPath, value) {
  const segments = fieldPath.split('.')
  let current = target
  for (const segment of segments.slice(0, -1)) {
    if (!isPlainObject(current[segment])) current[segment] = {}
    current = current[segment]
  }
  current[segments.at(-1)] = value
}

function expectReject(callback, pattern) {
  try {
    callback()
  } catch (error) {
    if (pattern.test(error instanceof Error ? error.message : String(error))) return
    throw error
  }
  throw new Error(`Self-test expected rejection matching ${pattern}`)
}
