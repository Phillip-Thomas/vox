#!/usr/bin/env node

import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const lane = process.argv[2]
const invocationPath = process.argv[3]
const resultPath = process.argv[4]

try {
  if (!['creative', 'review'].includes(lane) || !invocationPath || !resultPath) {
    throw new Error(
      'Usage: node main/tools/story-council-role-cli-runner.mjs <creative|review> <invocation-path> <result-path>',
    )
  }

  const envName = lane === 'creative'
    ? 'PARAVOXIA_STORY_CREATIVE_RUNNER_ARGV_JSON'
    : 'PARAVOXIA_STORY_REVIEW_RUNNER_ARGV_JSON'
  const runnerArgv = readArgvEnv(envName)
  const scriptDir = path.dirname(fileURLToPath(import.meta.url))
  const terraRunner = path.resolve(scriptDir, '../../../TerraForm/scripts/dev/workflow-role-cli-runner.mjs')
  const exitCode = await run([
    process.execPath,
    terraRunner,
    invocationPath,
    resultPath,
  ], {
    ...process.env,
    TERRA_ROLE_CLI_ARGV_JSON: JSON.stringify(runnerArgv),
  })

  if (exitCode !== 0) {
    throw new Error(`${lane} story role runner exited ${exitCode}`)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}

function readArgvEnv(name) {
  const raw = process.env[name]
  if (!raw) throw new Error(`${name} is required`)
  const argv = JSON.parse(raw)
  if (!Array.isArray(argv) || argv.length === 0 || argv.some((item) => typeof item !== 'string')) {
    throw new Error(`${name} must be a non-empty JSON string array`)
  }
  return argv
}

function run(argv, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(argv[0], argv.slice(1), {
      cwd: process.cwd(),
      env,
      shell: false,
      stdio: 'inherit',
    })
    child.on('error', reject)
    child.on('close', (code) => resolve(code ?? 1))
  })
}
