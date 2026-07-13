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
  'docs/architecture/workflow-orchestration/examples/paravoxia-story-council.workflow.json',
)
const bindingsPath = path.join(
  repoRoot,
  'docs/architecture/workflow-orchestration/examples/paravoxia-story-council.local.adapter-bindings.json',
)

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    'out-dir': {
      type: 'string',
      default: path.join(repoRoot, 'tmp/paravoxia-story-council-lifecycle-smoke'),
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
  await requireFile(specPath, 'story-council workflow')
  await requireFile(bindingsPath, 'story-council adapter bindings')
  await requireFile(
    path.join(terraRoot, 'scripts/dev/workflow-run.mjs'),
    'Terra workflow runner',
  )

  const outDir = path.resolve(values['out-dir'])
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
  await runNode([
    path.join(terraRoot, 'scripts/dev/workflow-run.mjs'),
    'init',
    '--spec',
    specPath,
    '--out-dir',
    outDir,
    '--run-id',
    'paravoxia-story-council-lifecycle-smoke',
    '--input',
    'user-request=Lifecycle proof only; do not generate creative content.',
    '--input',
    'target-repo=.',
    '--input',
    'production-authority=PARAVOXIA_DEMO_FOUNDATION_PLAN.md',
    '--input',
    'current-authority-manifest=main/story-authority.json',
    '--input',
    'target-story-range=shipped-through-ch4-arrival',
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
    'lock-story-correction-scope',
    '--adapter',
    'creative',
    '--dry-run',
  ])
  await runNode([
    path.join(terraRoot, 'scripts/dev/workflow-run.mjs'),
    'check',
    '--run',
    runPath,
    '--gate',
    'story-scope-locked',
  ])

  await recordExpectedBlock(runPath, outDir)
  await validateBlockedProof(runPath)

  console.log('Paravoxia story-council lifecycle proof passed.')
  console.log(`run: ${toRepoPath(runPath)}`)
  console.log('disposition: blocked (expected)')
  console.log('creative outputs generated: 0')
  console.log('next action: bind an approved creative author, then produce and review production-lock')
}

async function recordResolvedBindings(runPath) {
  const [run, bindingSet] = await Promise.all([
    readJson(runPath),
    readJson(bindingsPath),
  ])
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

async function recordExpectedBlock(runPath, outDir) {
  const run = await readJson(runPath)
  const firstStep = run.steps.find((step) => step.id === 'lock-story-correction-scope')
  if (!firstStep) throw new Error('Initialized run is missing the first story-council step')

  const presentArtifacts = run.artifacts.filter((artifact) => artifact.status === 'present')
  if (presentArtifacts.length > 0) {
    throw new Error(`Lifecycle smoke unexpectedly generated artifacts: ${presentArtifacts.map((item) => item.slug).join(', ')}`)
  }

  const now = new Date().toISOString()
  const proof = {
    schema: 'terra.storyCouncilLifecycleProof.v1',
    workflowSpecRef: run.workflowSpecRef,
    runId: run.id,
    synthetic: true,
    creativeOutputsGenerated: false,
    bindingValidation: 'passed',
    invocationMode: 'dry_run',
    stoppedAtStep: firstStep.id,
    blockingArtifact: 'production-lock',
    blockingReason: 'A real approved creative author or human operator must produce the first production-lock artifact.',
    checkedGate: 'story-scope-locked',
    checkedAt: now,
  }
  const proofPath = path.join(outDir, 'evidence/lifecycle-proof.json')
  await fs.mkdir(path.dirname(proofPath), { recursive: true })
  await writeJson(proofPath, proof)

  for (const step of run.steps) {
    step.status = step.id === firstStep.id ? 'blocked' : 'pending'
  }
  run.status = 'blocked'
  run.currentStep = firstStep.id
  run.evidenceBundles = [
    ...(run.evidenceBundles || []),
    {
      schema: 'terra.evidenceBundle.v1',
      id: 'evidence.story-council-lifecycle-smoke',
      kind: 'runtime_trace',
      createdByStep: firstStep.id,
      artifactRefs: [],
      summary: {
        path: 'evidence/lifecycle-proof.json',
        synthetic: true,
        creativeOutputsGenerated: false,
        expectedBlockedDisposition: true,
      },
    },
  ]
  run.finalDisposition = {
    schema: 'terra.finalDisposition.v1',
    decision: 'blocked',
    actor: 'paravoxia-story-council-lifecycle-smoke',
    decidedAt: now,
    summary: 'Bindings, persistence, role access, invocation serialization, and gate evaluation are proven. No creative artifact was fabricated; execution is blocked at production-lock pending a real approved creative author or human operator.',
  }
  run.lifecycleProof = {
    path: 'evidence/lifecycle-proof.json',
    synthetic: true,
    creativeOutputsGenerated: false,
  }
  run.updatedAt = now
  await writeJson(runPath, run)
}

async function validateBlockedProof(runPath) {
  const run = await readJson(runPath)
  assert(run.schema === 'terra.workflowRun.v1', 'run schema must be terra.workflowRun.v1')
  assert(run.status === 'blocked', 'run must end blocked')
  assert(run.currentStep === 'lock-story-correction-scope', 'run must stop at the first model step')
  assert(run.finalDisposition?.decision === 'blocked', 'run must record a blocked final disposition')
  assert(run.lifecycleProof?.synthetic === true, 'run must identify the proof as synthetic')
  assert(run.lifecycleProof?.creativeOutputsGenerated === false, 'run must state that no creative outputs were generated')
  assert(run.adapterBindings.every((item) => item.status === 'bound'), 'every required adapter must resolve')
  assert(
    (run.roleInvocations || []).some((item) => (
      item.stepId === 'lock-story-correction-scope' && item.status === 'dry_run'
    )),
    'the first role invocation must be serialized as a dry run',
  )
  assert(
    run.artifacts.every((artifact) => artifact.status !== 'present'),
    'the lifecycle proof must not fabricate story artifacts',
  )
  assert(
    run.gateResults.some((result) => (
      result.gateId === 'story-scope-locked' && result.status !== 'passed'
    )),
    'the first post-artifact gate must prove that the missing production lock blocks progress',
  )
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
    '  node main/tools/story-council-lifecycle-smoke.mjs [--out-dir <path>]',
    '',
    'The proof intentionally stops with a blocked final disposition before any',
    'creative artifact is generated. The run record persists at <path>/run.json.',
  ].join('\n'))
}
