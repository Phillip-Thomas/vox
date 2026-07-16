#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { realpathSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const toolRoot = path.dirname(fileURLToPath(import.meta.url))
const mainRoot = path.resolve(toolRoot, '..')
const repoRoot = path.resolve(mainRoot, '..')
const artifactRoot = path.join(repoRoot, '.terra/workflow-runs/paravoxia-chapter-acceptance')
const runnerPath = path.join(toolRoot, 'chapter-acceptance.mjs')
const targetChapter = process.env.PARAVOXIA_TARGET_CHAPTER?.trim()
const candidateRevision = process.env.PARAVOXIA_CANDIDATE_REVISION?.trim()
const runDir = resolveRunDir(process.env.PARAVOXIA_CHAPTER_ACCEPTANCE_RUN_DIR)
const dryRun = process.argv.slice(2).includes('--dry-run')
const operatorLongRun = process.env.PARAVOXIA_CHAPTER_ACCEPTANCE_OPERATOR_LONG_RUN === 'true'

try {
  if (!targetChapter || !/^[a-z0-9][a-z0-9._-]*$/i.test(targetChapter)) {
    throw new Error('PARAVOXIA_TARGET_CHAPTER must be a non-empty chapter id containing only letters, numbers, dot, underscore, or hyphen')
  }
  if (!candidateRevision || !/^[a-z0-9][a-z0-9._-]*$/i.test(candidateRevision)) {
    throw new Error('PARAVOXIA_CANDIDATE_REVISION must be a non-empty revision id containing only letters, numbers, dot, underscore, or hyphen')
  }

  const extraArgv = readExtraArgv()
  const outputDir = path.join(runDir, 'evidence/mechanical-chapter-acceptance')
  const reportPath = path.join(outputDir, 'chapter-mechanical-evidence.json')
  const runnerArgv = [
    process.execPath,
    runnerPath,
    '--chapter',
    targetChapter,
    '--candidate-revision',
    candidateRevision,
    ...extraArgv,
    '--output',
    outputDir,
    '--report',
    reportPath,
  ]
  const command = {
    schema: 'paravoxia.chapterAcceptanceWorkflowCommand.v1',
    targetChapter,
    candidateRevision,
    executionMode: 'argv_no_shell',
    cwd: mainRoot,
    artifactRoot,
    runDir,
    outputDir,
    reportPath,
    argv: runnerArgv,
    dryRun,
    operatorLongRun,
    executionPolicy: operatorLongRun ? 'operator_managed_long_run' : dryRun ? 'serialization_only' : 'bounded_smoke_only',
  }

  if (dryRun) {
    process.stdout.write(`${JSON.stringify(command, null, 2)}\n`)
    process.exit(0)
  }

  const result = spawnSync(runnerArgv[0], runnerArgv.slice(1), {
    cwd: mainRoot,
    env: process.env,
    shell: false,
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  process.exit(result.status ?? 1)
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(2)
}

function readExtraArgv() {
  const raw = process.env.PARAVOXIA_CHAPTER_ACCEPTANCE_EXTRA_ARGV_JSON
  const argv = raw ? JSON.parse(raw) : []
  if (!Array.isArray(argv) || argv.some((value) => typeof value !== 'string')) {
    throw new Error('PARAVOXIA_CHAPTER_ACCEPTANCE_EXTRA_ARGV_JSON must be a JSON string array')
  }
  const forbidden = ['chapter', 'candidate-revision', 'registry', 'output', 'report', 'self-test', 'list']
  if (argv.some((value) => forbidden.some((key) => value === `--${key}` || value.startsWith(`--${key}=`)))) {
    throw new Error(`PARAVOXIA_CHAPTER_ACCEPTANCE_EXTRA_ARGV_JSON may not override ${forbidden.map((key) => `--${key}`).join(', ')}`)
  }
  const allowed = new Set([
    'runs',
    'max-seconds',
    'stall-seconds',
    'sample-ms',
    'profile',
    'viewport',
    'screenshot-mode',
    'base-url',
    'url',
    'port',
    'headed',
    'headed-taste-verdict',
    'manual-evidence',
    'audio-evidence',
    'run-id',
    'skip-preflight',
    'smoke',
    'debug',
  ])
  for (const value of argv.filter((item) => item.startsWith('--'))) {
    const key = value.slice(2).split('=', 1)[0]
    if (!allowed.has(key)) throw new Error(`Unsafe or unsupported chapter acceptance workflow option: --${key}`)
  }
  normalizeRepoFileOption(argv, 'manual-evidence')
  normalizeRepoFileOption(argv, 'audio-evidence')

  const configuredRuns = readNumericOption(argv, 'runs')
  const runs = configuredRuns ?? (argv.includes('--smoke') ? 1 : 3)
  if (!Number.isInteger(runs) || runs <= 0) throw new Error('--runs must be a positive integer')
  const configuredMaxSeconds = readNumericOption(argv, 'max-seconds')
  const smokeMode = argv.includes('--smoke')
  const skippedPreflight = argv.includes('--skip-preflight')
  if (operatorLongRun && argv.some((value) => ['--smoke', '--debug', '--skip-preflight'].includes(value))) {
    throw new Error('The production operator long run may not use smoke, debug, or skipped-preflight shortcuts')
  }
  if (!operatorLongRun && !dryRun && !(smokeMode && skippedPreflight)) {
    throw new Error('Full chapter acceptance must run through creative-chapter-acceptance-workflow.mjs --run-mechanical; the generic 600s adapter permits only bounded smoke execution')
  }
  if (!operatorLongRun && smokeMode) {
    const boundedSmokeMaxSeconds = 240
    if (runs !== 1) throw new Error('Bounded adapter smoke execution requires exactly one cold run')
    if (configuredMaxSeconds != null && configuredMaxSeconds > boundedSmokeMaxSeconds) {
      throw new Error(`Bounded adapter smoke --max-seconds must not exceed ${boundedSmokeMaxSeconds}s`)
    }
    if (configuredMaxSeconds == null) argv.push('--max-seconds', String(boundedSmokeMaxSeconds))
  }
  return argv
}

function normalizeRepoFileOption(argv, key) {
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index]
    let inputPath = null
    let equalsForm = false
    if (value === `--${key}`) {
      inputPath = argv[index + 1]
      if (!inputPath || inputPath.startsWith('--')) throw new Error(`--${key} requires a file path`)
    } else if (value.startsWith(`--${key}=`)) {
      inputPath = value.slice(value.indexOf('=') + 1)
      equalsForm = true
    }
    if (inputPath == null) continue
    const resolved = path.isAbsolute(inputPath) ? path.resolve(inputPath) : path.resolve(repoRoot, inputPath)
    if (!resolved.startsWith(`${repoRoot}${path.sep}`)) throw new Error(`--${key} must resolve inside the repository`)
    let stat
    let canonical
    try {
      stat = statSync(resolved)
      canonical = realpathSync(resolved)
    } catch {
      throw new Error(`--${key} must resolve to an existing repository file`)
    }
    if (!canonical.startsWith(`${repoRoot}${path.sep}`)) throw new Error(`--${key} may not escape the repository through a symlink`)
    if (!stat.isFile()) throw new Error(`--${key} must resolve to a repository file`)
    if (equalsForm) argv[index] = `--${key}=${canonical}`
    else argv[index + 1] = canonical
  }
}

function readNumericOption(argv, key) {
  let raw = null
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === `--${key}`) raw = argv[index + 1]
    else if (argv[index].startsWith(`--${key}=`)) raw = argv[index].slice(argv[index].indexOf('=') + 1)
  }
  if (raw == null) return null
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`--${key} must be a positive number`)
  return parsed
}

function resolveRunDir(inputPath) {
  if (!inputPath) throw new Error('PARAVOXIA_CHAPTER_ACCEPTANCE_RUN_DIR is required')
  const resolved = path.resolve(repoRoot, inputPath)
  if (resolved === artifactRoot || !resolved.startsWith(`${artifactRoot}${path.sep}`)) {
    throw new Error(`PARAVOXIA_CHAPTER_ACCEPTANCE_RUN_DIR must resolve to a child directory under ${artifactRoot}`)
  }
  return resolved
}
