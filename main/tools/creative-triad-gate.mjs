#!/usr/bin/env node

import fs from 'node:fs'
import { createHash } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'

const DIRECTORS = ['chapter', 'score', 'cinematography']
const DIRECTED_PAIRS = DIRECTORS.flatMap((from) =>
  DIRECTORS.filter((to) => to !== from).map((to) => `${from}->${to}`),
)
const VARIANTS = ['desktop', 'mobile', 'reducedMotion', 'lowestQuality']
const CAMERA_AUTHORITIES = new Set([
  'feed-camera',
  'lens-rig',
  'player-camera',
  'cinematic-look',
  'prologue-vector',
])
const CONTRACT_MARKDOWN = [
  'production-lock.md',
  'shipped-reference-map.md',
  'story-intent.md',
  'score-treatment.md',
  'cinematography-treatment.md',
  'dissent-register.md',
]
const FINAL_MARKDOWN = [
  'screenshot-report.md',
  'audio-report.md',
  'naive-audience-report.md',
  'story-audit.md',
  'score-audit.md',
  'cinematography-audit.md',
  'critic-report.md',
  'cohesion-judge.md',
  'run-summary.md',
  'lessons-learned.md',
]
const CONTRACT_JSON = [
  'production-lock.json',
  'scene-contract.json',
  'director-signoffs.json',
]
const FINAL_JSON = [
  'verification-report.json',
  'raw-audiovisual-evidence.json',
  'final-scorecard.json',
]
const PLACEHOLDER_PATTERN = /\b(?:TODO|TBD|PLACEHOLDER|FILL[ -]?ME|REPLACE[ -]?ME)\b|<[^>\n]+>/i
const MARKDOWN_SECTION_RULES = {
  'production-lock.md': ['authority', 'locked scope', 'protected paths', 'stop conditions', 'lock disposition'],
  'shipped-reference-map.md': ['shipped reference', 'adjacent-scene continuity', 'unverified assumptions'],
  'story-intent.md': ['grounding', 'dramatic contract', 'agency', 'constraints'],
  'score-treatment.md': ['grounding', 'harmonic', 'cue ledger', 'performance'],
  'cinematography-treatment.md': ['current-cut', 'color script', 'shot ledger', 'agency', 'performance'],
  'dissent-register.md': ['dissent', 'resolution'],
  'screenshot-report.md': ['anchor', 'desktop', 'mobile', 'reduced', 'quality'],
  'audio-report.md': ['authority', 'cue', 'evidence', 'performance'],
  'naive-audience-report.md': ['isolation', 'cold read', 'variant', 'verdict'],
  'story-audit.md': ['independence', 'findings', 'defects', 'verdict'],
  'score-audit.md': ['independence', 'findings', 'defects', 'verdict'],
  'cinematography-audit.md': ['independence', 'findings', 'defects', 'verdict'],
  'critic-report.md': ['review integrity', 'conflict', 'defects', 'disposition'],
  'cohesion-judge.md': ['evidence completeness', 'combined experience', 'dissent', 'scorecard', 'decision'],
  'run-summary.md': ['disposition', 'what changed', 'evidence', 'quality', 'resume point'],
  'lessons-learned.md': ['reusable lessons', 'workflow learning', 'craft learning', 'next-run guidance'],
}

function parseArgs(argv) {
  const options = { run: null, selfTest: false, checkOnly: false, phase: 'final' }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--self-test') options.selfTest = true
    else if (argument === '--check-only') options.checkOnly = true
    else if (argument === '--phase') options.phase = argv[++index]
    else if (argument.startsWith('--phase=')) options.phase = argument.slice('--phase='.length)
    else if (argument === '--run') options.run = argv[++index]
    else if (argument.startsWith('--run=')) options.run = argument.slice('--run='.length)
    else throw new Error(`Unknown argument: ${argument}`)
  }
  if (!['contract', 'final'].includes(options.phase)) throw new Error('--phase must be contract or final')
  return options
}

function resolveRepoRoot() {
  const scriptDirectory = path.dirname(new URL(import.meta.url).pathname)
  return path.resolve(scriptDirectory, '..', '..')
}

function resolveRunPath(rawPath) {
  if (!rawPath) throw new Error('Missing --run <production-run-directory>')
  if (path.isAbsolute(rawPath)) return rawPath
  const repoRoot = resolveRepoRoot()
  const candidates = [
    path.resolve(process.cwd(), rawPath),
    path.resolve(process.env.INIT_CWD || process.cwd(), rawPath),
    path.resolve(repoRoot, rawPath),
  ]
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates.at(-1)
}

function makeCollector() {
  const checks = []
  const push = (passed, code, message, details = undefined, level = 'error') => {
    checks.push({ passed: Boolean(passed), level, code, message, ...(details === undefined ? {} : { details }) })
  }
  return {
    checks,
    assert(condition, code, message, details) {
      push(condition, code, message, details)
    },
    warn(condition, code, message, details) {
      push(condition, code, message, details, 'warning')
    },
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function includesPlaceholder(value) {
  if (typeof value === 'string') return PLACEHOLDER_PATTERN.test(value)
  if (Array.isArray(value)) return value.some(includesPlaceholder)
  if (isObject(value)) return Object.values(value).some(includesPlaceholder)
  return false
}

function resolveLocalSchemaRef(rootSchema, ref) {
  if (!ref.startsWith('#/')) throw new Error(`Only local JSON Schema refs are supported: ${ref}`)
  return ref
    .slice(2)
    .split('/')
    .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'))
    .reduce((value, part) => value?.[part], rootSchema)
}

function jsonTypeMatches(value, type) {
  if (type === 'null') return value === null
  if (type === 'array') return Array.isArray(value)
  if (type === 'object') return isObject(value)
  if (type === 'integer') return Number.isInteger(value)
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value)
  return typeof value === type
}

function validateJsonSchema(value, schema, rootSchema, instancePath = '$', errors = []) {
  if (!schema) {
    errors.push(`${instancePath}: unresolved schema`)
    return errors
  }
  if (schema.$ref) return validateJsonSchema(value, resolveLocalSchemaRef(rootSchema, schema.$ref), rootSchema, instancePath, errors)
  if (schema.allOf) {
    for (const branch of schema.allOf) validateJsonSchema(value, branch, rootSchema, instancePath, errors)
  }
  if (schema.if) {
    const probe = []
    validateJsonSchema(value, schema.if, rootSchema, instancePath, probe)
    if (probe.length === 0 && schema.then) validateJsonSchema(value, schema.then, rootSchema, instancePath, errors)
  }
  if (schema.anyOf) {
    const branchErrors = schema.anyOf.map((branch) => {
      const result = []
      validateJsonSchema(value, branch, rootSchema, instancePath, result)
      return result
    })
    if (!branchErrors.some((result) => result.length === 0)) errors.push(`${instancePath}: must satisfy one allowed schema shape`)
    return errors
  }
  if (schema.const !== undefined && JSON.stringify(value) !== JSON.stringify(schema.const)) errors.push(`${instancePath}: must equal ${JSON.stringify(schema.const)}`)
  if (schema.enum && !schema.enum.some((item) => JSON.stringify(item) === JSON.stringify(value))) errors.push(`${instancePath}: must be one of ${schema.enum.map((item) => JSON.stringify(item)).join(', ')}`)
  if (schema.type && !jsonTypeMatches(value, schema.type)) {
    errors.push(`${instancePath}: must be ${schema.type}`)
    return errors
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${instancePath}: must have length >= ${schema.minLength}`)
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${instancePath}: must match ${schema.pattern}`)
    if (schema.format === 'date-time' && Number.isNaN(Date.parse(value))) errors.push(`${instancePath}: must be an ISO date-time`)
    if (schema.format === 'uri') {
      try { new URL(value) } catch { errors.push(`${instancePath}: must be a URI`) }
    }
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${instancePath}: must be >= ${schema.minimum}`)
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${instancePath}: must be <= ${schema.maximum}`)
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) errors.push(`${instancePath}: must be > ${schema.exclusiveMinimum}`)
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${instancePath}: must have at least ${schema.minItems} items`)
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${instancePath}: must have at most ${schema.maxItems} items`)
    if (schema.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) errors.push(`${instancePath}: items must be unique`)
    if (schema.items) value.forEach((item, index) => validateJsonSchema(item, schema.items, rootSchema, `${instancePath}[${index}]`, errors))
  }
  if (isObject(value)) {
    for (const required of schema.required || []) {
      if (!(required in value)) errors.push(`${instancePath}.${required}: required property is missing`)
    }
    for (const [key, child] of Object.entries(value)) {
      if (schema.properties?.[key]) validateJsonSchema(child, schema.properties[key], rootSchema, `${instancePath}.${key}`, errors)
      else if (schema.additionalProperties === false) errors.push(`${instancePath}.${key}: additional property is not allowed`)
      else if (isObject(schema.additionalProperties)) validateJsonSchema(child, schema.additionalProperties, rootSchema, `${instancePath}.${key}`, errors)
    }
  }
  return errors
}

function assertSchema(value, schema, collector, code, label) {
  if (!value || !schema) return
  const errors = validateJsonSchema(value, schema, schema)
  collector.assert(errors.length === 0, code, `${label} must satisfy its checked-in JSON Schema`, errors.slice(0, 25))
}

function readJson(filePath, collector, code) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    collector.assert(false, `${code}.parse`, `${path.basename(filePath)} must contain valid JSON`, error.message)
    return null
  }
}

function readJsonl(filePath, collector) {
  let source
  try {
    source = fs.readFileSync(filePath, 'utf8')
  } catch (error) {
    collector.assert(false, 'notes.read', 'director-notes.jsonl must be readable', error.message)
    return []
  }
  const notes = []
  source.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return
    try {
      notes.push(JSON.parse(line))
    } catch (error) {
      collector.assert(false, 'notes.parse', `director-notes.jsonl line ${index + 1} must be valid JSON`, error.message)
    }
  })
  return notes
}

function anchorId(anchor) {
  return typeof anchor === 'string' ? anchor : anchor?.id
}

function statusPassed(value) {
  if (value === true || value === 'pass' || value === 'passed' || value === 'not-applicable') return true
  if (isObject(value)) return statusPassed(value.status ?? value.passed ?? value.disposition)
  return false
}

function validateSceneContract(contract, collector) {
  if (!contract) return
  collector.assert(contract.schema === 'paravoxia.sceneContract.v1', 'contract.schema', 'Scene contract schema must be paravoxia.sceneContract.v1')
  collector.assert(nonEmptyString(contract.sceneId), 'contract.scene-id', 'Scene contract must declare a stable sceneId')
  collector.assert(nonEmptyString(contract.contractVersion), 'contract.version', 'Scene contract must declare contractVersion')
  collector.assert(contract.status === 'frozen', 'contract.status', 'A gateable scene contract must be frozen')
  collector.assert(isObject(contract.production), 'contract.production', 'Scene contract must include production authority')
  collector.assert(Array.isArray(contract.production?.authorityRefs) && contract.production.authorityRefs.length > 0, 'contract.authority', 'Production authorityRefs are required')
  collector.assert(nonEmptyString(contract.production?.productionLockRef), 'contract.production-lock', 'Production lock reference is required')
  collector.assert(['delta', 'scene', 'chapter', 'flagship'].includes(contract.production?.mode), 'contract.mode', 'Production mode must be delta, scene, chapter, or flagship')
  collector.assert(['planning-only', 'bounded-runtime', 'full-scene-runtime'].includes(contract.production?.mutationBoundary), 'contract.mutation-boundary', 'Mutation boundary must be explicit')
  collector.assert(Array.isArray(contract.production?.allowedPaths), 'contract.allowed-paths', 'Allowed paths must be explicit')
  collector.assert(Array.isArray(contract.production?.protectedPaths), 'contract.protected-paths', 'Protected paths must be explicit')
  collector.assert(Array.isArray(contract.scope?.beats) && contract.scope.beats.length > 0, 'contract.beats', 'At least one affected beat is required')
  collector.assert(Array.isArray(contract.scope?.shippedReferenceRefs) && contract.scope.shippedReferenceRefs.length > 0, 'contract.references', 'At least one shipped reference is required')
  collector.assert(Array.isArray(contract.story?.events) && contract.story.events.length > 0, 'contract.story-events', 'Story events are required')
  collector.assert(Array.isArray(contract.story?.agencyWindows) && contract.story.agencyWindows.length > 0, 'contract.agency', 'Player agency windows are required')

  const anchors = Array.isArray(contract.syncAnchors) ? contract.syncAnchors.map(anchorId).filter(nonEmptyString) : []
  const anchorSet = new Set(anchors)
  collector.assert(anchors.length > 0, 'contract.anchors', 'Named synchronization anchors are required')
  collector.assert(anchorSet.size === anchors.length, 'contract.anchor-unique', 'Synchronization anchor IDs must be unique')
  collector.assert((contract.syncAnchors || []).every((anchor) => anchor.story && anchor.score?.length > 0 && anchor.cinematography?.length > 0), 'contract.anchor-cross-domain', 'Every anchor must describe story, score, and cinematography relations')

  const shots = Array.isArray(contract.shots) ? contract.shots : []
  const shotIds = shots.map((shot) => shot?.id).filter(nonEmptyString)
  collector.assert(shots.length > 0, 'contract.shots', 'At least one stable shot is required')
  collector.assert(new Set(shotIds).size === shots.length, 'contract.shot-unique', 'Shot IDs must be present and unique')
  collector.assert(Array.isArray(contract.cinematography?.shotOrder) && contract.cinematography.shotOrder.length === shots.length && contract.cinematography.shotOrder.every((id) => shotIds.includes(id)), 'contract.shot-order', 'Cinematography shotOrder must cover every shot exactly once')
  const agencyIds = new Set((contract.story?.agencyWindows || []).map((window) => window.id))
  const variantIds = new Set([
    contract.variants?.desktop?.id,
    contract.variants?.mobile?.id,
    contract.variants?.reducedMotion?.id,
    ...(contract.variants?.qualityTiers || []).map((variant) => variant.id),
  ])
  const resetIds = new Set((contract.reset?.states || []).map((state) => state.id))
  for (const shot of shots) {
    const label = nonEmptyString(shot?.id) ? shot.id : '<unnamed-shot>'
    collector.assert(anchorSet.has(shot?.startAnchorRef), 'contract.shot-start', `${label} startAnchorRef must resolve`, shot?.startAnchorRef)
    collector.assert(anchorSet.has(shot?.endAnchorRef), 'contract.shot-end', `${label} endAnchorRef must resolve`, shot?.endAnchorRef)
    collector.assert(nonEmptyString(shot?.beat), 'contract.shot-beat', `${label} must reference a beat`)
    collector.assert(CAMERA_AUTHORITIES.has(shot?.cameraAuthority), 'contract.camera-authority', `${label} must use the established camera lineage`, shot?.cameraAuthority)
    collector.assert(nonEmptyString(shot?.focalHierarchy?.primary), 'contract.focal-subject', `${label} must declare one primary focal subject`)
    collector.assert(Number.isFinite(shot?.lens?.startFovDeg) && Number.isFinite(shot?.lens?.endFovDeg), 'contract.fov', `${label} must declare start and end FOV`)
    collector.assert(shot?.paletteRef === contract.palette?.id, 'contract.palette', `${label} must resolve to the scene semantic palette`, shot?.paletteRef)
    collector.assert(isObject(shot?.effects), 'contract.effects', `${label} must explicitly declare its effect and fallback plan`)
    collector.assert(isObject(shot?.agency), 'contract.shot-agency', `${label} must declare player-agency behavior`)
    collector.assert((shot?.agency?.agencyWindowRefs || []).every((id) => agencyIds.has(id)), 'contract.shot-agency-refs', `${label} agency references must resolve`)
    collector.assert(anchorSet.has(shot?.agency?.handBackAnchorRef), 'contract.handback-anchor', `${label} hand-back anchor must resolve`)
    collector.assert((shot?.variantRefs || []).length > 0 && shot.variantRefs.every((id) => variantIds.has(id)), 'contract.shot-variants', `${label} variant references must resolve`)
    collector.assert(resetIds.has(shot?.resetRef), 'contract.shot-reset', `${label} resetRef must resolve`)
  }

  const storyAnchorRefs = (contract.story?.events || []).map((event) => event?.anchorRef)
  collector.assert(storyAnchorRefs.every((anchor) => anchorSet.has(anchor)), 'contract.story-anchor-refs', 'Every story event anchor must resolve', storyAnchorRefs.filter((anchor) => !anchorSet.has(anchor)))
  const agencyAnchorRefs = (contract.story?.agencyWindows || []).flatMap((window) => [window?.startAnchorRef, window?.endAnchorRef])
  collector.assert(agencyAnchorRefs.every((anchor) => anchorSet.has(anchor)), 'contract.agency-anchor-refs', 'Every agency-window anchor must resolve', agencyAnchorRefs.filter((anchor) => !anchorSet.has(anchor)))
  const scoreCues = Array.isArray(contract.score?.cues) ? contract.score.cues : []
  collector.assert(scoreCues.length > 0, 'contract.score-cues', 'Score must explicitly declare at least one cue or silence event')
  collector.assert(scoreCues.every((cue) => anchorSet.has(cue?.anchorRef)), 'contract.score-anchor-refs', 'Every score cue anchor must resolve', scoreCues.filter((cue) => !anchorSet.has(cue?.anchorRef)).map((cue) => cue?.anchorRef))
  collector.assert(isObject(contract.variants?.desktop) && isObject(contract.variants?.mobile) && isObject(contract.variants?.reducedMotion), 'contract.variants', 'Desktop, mobile, and reduced-motion variants are required')
  collector.assert(new Set((contract.variants?.qualityTiers || []).map((variant) => variant.tier)).size === 4, 'contract.quality-variants', 'High, medium, low, and potato quality variants are required')
  collector.assert(Number.isFinite(contract.performance?.targetFps) && contract.performance.targetFps > 0, 'contract.performance', 'A positive targetFps is required')
  collector.assert(Number.isFinite(contract.performance?.maximumFrameTimeMs) && Number.isFinite(contract.performance?.maximumDrawCalls) && Number.isFinite(contract.performance?.maximumShaderPrograms), 'contract.performance-budgets', 'Measurable frame, draw-call, and shader budgets are required')
  collector.assert(Array.isArray(contract.evidence?.acceptanceCriteria) && contract.evidence.acceptanceCriteria.length > 0, 'contract.evidence', 'Acceptance evidence requirements are required')
  collector.assert(contract.reset?.sandboxNoOp?.required === true && resetIds.size > 0, 'contract.reset', 'Named state resets and sandbox no-op proof are required')
  collector.assert(!includesPlaceholder(contract), 'contract.placeholders', 'Scene contract cannot contain template placeholders')
}

function validateNotes(notes, contract, collector) {
  collector.assert(notes.length >= DIRECTED_PAIRS.length, 'notes.count', 'Director notes must cover all six directed peer exchanges')
  const ids = notes.map((note) => note?.id).filter(nonEmptyString)
  collector.assert(ids.length === notes.length && new Set(ids).size === notes.length, 'notes.ids', 'Every director note needs a unique ID')
  const pairs = new Set()
  for (const note of notes) {
    const label = note?.id || '<unnamed-note>'
    collector.assert(note?.schema === 'paravoxia.directorNote.v1', 'notes.schema', `${label} must use paravoxia.directorNote.v1`)
    collector.assert(note?.contractVersion === contract?.contractVersion, 'notes.contract-version', `${label} must target the frozen contract revision`)
    collector.assert(DIRECTORS.includes(note?.from) && DIRECTORS.includes(note?.to) && note.from !== note.to, 'notes.route', `${label} must route between distinct directors`)
    if (DIRECTORS.includes(note?.from) && DIRECTORS.includes(note?.to)) pairs.add(`${note.from}->${note.to}`)
    collector.assert(nonEmptyString(note?.beat) && nonEmptyString(note?.anchor), 'notes.location', `${label} must identify a beat and shared anchor`)
    collector.assert(['proposal', 'constraint', 'question', 'objection', 'acceptance', 'decision'].includes(note?.kind), 'notes.kind', `${label} has an invalid kind`)
    collector.assert(['info', 'low', 'medium', 'high', 'critical'].includes(note?.severity), 'notes.severity', `${label} has an invalid severity`)
    collector.assert(nonEmptyString(note?.statement) && nonEmptyString(note?.requestedAction), 'notes.substance', `${label} must include a statement and requested action`)
    collector.assert(Array.isArray(note?.evidenceRefs) && note.evidenceRefs.length > 0, 'notes.evidence', `${label} must cite evidence`)
    collector.assert(['resolved', 'accepted', 'rejected', 'closed', 'routed', 'superseded', 'withdrawn'].includes(note?.status), 'notes.acknowledged', `${label} must be fully dispositioned before contract freeze`)
    collector.assert(isObject(note?.response) && note.response.by === note?.to, 'notes.recipient-response', `${label} must contain a response authored by its recipient`)
    collector.assert(isObject(note?.disposition) && nonEmptyString(note.disposition?.outcome), 'notes.disposition', `${label} must have a structured disposition`)
    collector.assert(note?.disposition?.decidedBy !== note?.from, 'notes.self-close', `${label} cannot be closed by its author`)
    collector.assert(nonEmptyString(note?.createdAt) && !Number.isNaN(Date.parse(note.createdAt)), 'notes.created-at', `${label} must preserve its creation timestamp`)
    collector.assert(!(note?.kind === 'objection' && ['high', 'critical'].includes(note?.severity) && ['deferred', 'routed'].includes(note?.disposition?.outcome)), 'notes.blocking', `${label} cannot defer or route a high/critical objection past contract freeze`)
  }
  collector.assert(DIRECTED_PAIRS.every((pair) => pairs.has(pair)), 'notes.graph', 'Director-note graph must contain all six directed peer exchanges', DIRECTED_PAIRS.filter((pair) => !pairs.has(pair)))
  collector.assert(!includesPlaceholder(notes), 'notes.placeholders', 'Director notes cannot contain template placeholders')
}

function validateSignoffs(signoffs, contract, collector) {
  if (!signoffs) return
  collector.assert(signoffs.schema === 'paravoxia.directorSignoffs.v1', 'signoffs.schema', 'Signoffs must use paravoxia.directorSignoffs.v1')
  collector.assert(signoffs.contractRevision === contract?.contractVersion, 'signoffs.contract-revision', 'Signoffs must target the scene contract revision')
  collector.assert(signoffs.sameRevision === true, 'signoffs.same-revision', 'All directors must sign the same revision')
  for (const director of DIRECTORS) {
    const signoff = signoffs[director]
    collector.assert(isObject(signoff), 'signoffs.director', `${director} signoff is required`)
    collector.assert(['approve', 'approve-with-notes'].includes(signoff?.disposition), 'signoffs.disposition', `${director} must approve or approve with resolved notes`)
    collector.assert(signoff?.revision === contract?.contractVersion, 'signoffs.revision', `${director} must sign the current revision`)
    collector.assert(nonEmptyString(signoff?.signedBy) && nonEmptyString(signoff?.signedAt), 'signoffs.identity', `${director} signoff needs signer and timestamp`)
  }
  collector.assert(!includesPlaceholder(signoffs), 'signoffs.placeholders', 'Director signoffs cannot contain template placeholders')
}

function normalizeRepoPath(value) {
  return String(value || '').replace(/^\.\//, '').replaceAll('\\', '/').replace(/\/+$/, '')
}

function pathMatchesBoundary(filePath, boundary) {
  const file = normalizeRepoPath(filePath)
  const allowed = normalizeRepoPath(boundary)
  return file === allowed || file.startsWith(`${allowed}/`)
}

function validateProductionLock(lock, lockSchema, contract, runPath, collector) {
  if (!lock) return
  assertSchema(lock, lockSchema, collector, 'lock.json-schema', 'Production lock')
  collector.assert(lock.status === 'locked', 'lock.status', 'Production lock must be locked before director work')
  collector.assert(lock.publishAllowed === false, 'lock.publish', 'Creative production lock cannot grant publish authority')
  collector.assert(contract?.production?.productionLockRef === 'production-lock.json', 'lock.contract-ref', 'Scene contract must point to the machine-readable production lock')
  collector.assert(lock.mode === contract?.production?.mode, 'lock.mode', 'Production lock and scene contract modes must match')
  collector.assert(lock.mutationBoundary === contract?.production?.mutationBoundary, 'lock.mutation', 'Production lock and scene contract mutation boundaries must match')
  collector.assert((contract?.production?.allowedPaths || []).every((candidate) => (lock.allowedPaths || []).some((allowed) => pathMatchesBoundary(candidate, allowed))), 'lock.allowed-paths', 'Every contract allowed path must fit the production lock')
  collector.assert((lock.protectedPaths || []).every((protectedPath) => (contract?.production?.protectedPaths || []).some((candidate) => pathMatchesBoundary(protectedPath, candidate) || pathMatchesBoundary(candidate, protectedPath))), 'lock.protected-paths', 'Scene contract must preserve every locked protected path')
  collector.assert((contract?.scope?.beats || []).every((beat) => lock.lockedBeats?.includes(beat)), 'lock.beats', 'Every contracted beat must be named by the production lock')

  for (const authority of lock.authority || []) {
    const authorityPath = path.resolve(resolveRepoRoot(), authority.path)
    collector.assert(authorityPath.startsWith(`${resolveRepoRoot()}${path.sep}`) && fs.existsSync(authorityPath), 'lock.authority-path', `Authority file must resolve inside the repository: ${authority.path}`)
    if (authorityPath.startsWith(`${resolveRepoRoot()}${path.sep}`) && fs.existsSync(authorityPath)) {
      const actual = createHash('sha256').update(fs.readFileSync(authorityPath)).digest('hex')
      collector.assert(actual === authority.sha256, 'lock.authority-hash', `Authority hash must match current file: ${authority.path}`, { expected: authority.sha256, actual })
    }
  }

  const activePlan = (lock.authority || []).find((authority) => normalizeRepoPath(authority.path) === 'PARAVOXIA_DEMO_FOUNDATION_PLAN.md')
  if (activePlan) {
    const planText = fs.readFileSync(path.join(resolveRepoRoot(), 'PARAVOXIA_DEMO_FOUNDATION_PLAN.md'), 'utf8')
    if (planText.includes('Do not add later story or change protected audio while this plan is active.')) {
      const protectedAudio = ['main/src/audio', 'main/src/components/audio', 'main/public/audio']
      collector.assert(lock.currentRestrictions?.storyCeiling === 'ch4-arrival' && lock.currentRestrictions?.postArrivalStoryMutationAllowed === false, 'lock.active-story-ceiling', 'Active demo authority must freeze story after ch4-arrival')
      collector.assert(protectedAudio.every((protectedPath) => lock.currentRestrictions?.protectedAudioPaths?.some((candidate) => pathMatchesBoundary(protectedPath, candidate))), 'lock.active-audio', 'Active demo authority must preserve all three protected audio paths')
      collector.assert(['headed-primitive-journey', 'fauna-triangle-budget', 'full-client-verify', 'batch-3-existing-story-screening'].every((gate) => lock.currentRestrictions?.openGateRefs?.includes(gate)), 'lock.active-gates', 'Active demo authority must preserve its four open resume gates')
    }
  }
  collector.assert(!includesPlaceholder(lock), 'lock.placeholders', 'Production lock cannot contain template placeholders')
}

function changedPathsFromDiff(source) {
  const paths = new Set()
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^diff --git a\/(.+) b\/(.+)$/)
    if (match) paths.add(match[2])
  }
  return [...paths]
}

function validateImplementationDiff(runPath, lock, collector) {
  const diffPath = path.join(runPath, 'implementation.diff')
  collector.assert(fs.existsSync(diffPath), 'implementation.diff', 'Final phase requires implementation.diff, including an explicit empty-change disposition')
  if (!fs.existsSync(diffPath)) return
  const source = fs.readFileSync(diffPath, 'utf8')
  collector.assert(!PLACEHOLDER_PATTERN.test(source), 'implementation.placeholders', 'Implementation diff cannot contain template placeholders')
  const changedPaths = changedPathsFromDiff(source)
  collector.assert(changedPaths.every((file) => (lock?.allowedPaths || []).some((allowed) => pathMatchesBoundary(file, allowed))), 'implementation.allowed-paths', 'Every changed file must fit the locked allowed paths', changedPaths.filter((file) => !(lock?.allowedPaths || []).some((allowed) => pathMatchesBoundary(file, allowed))))
  collector.assert(changedPaths.every((file) => !(lock?.protectedPaths || []).some((protectedPath) => pathMatchesBoundary(file, protectedPath))), 'implementation.protected-paths', 'Implementation diff cannot touch protected paths', changedPaths.filter((file) => (lock?.protectedPaths || []).some((protectedPath) => pathMatchesBoundary(file, protectedPath))))
  if (lock?.mutationBoundary !== 'planning-only') collector.assert(changedPaths.length > 0, 'implementation.nonempty', 'Runtime-authorized final runs must record at least one changed path')
}

function validateVerification(report, contract, collector) {
  if (!report) return
  collector.assert(report.schema === 'paravoxia.sceneVerificationReport.v1', 'verification.schema', 'Verification report must use paravoxia.sceneVerificationReport.v1')
  collector.assert(
    Number.isInteger(report.flow?.coldRunsRequired) &&
      report.flow.coldRunsRequired >= 3 &&
      report.flow.coldRunsPassed >= report.flow.coldRunsRequired &&
      report.flow.movieCompletedWithoutRescue === true &&
      report.flow.timeoutRescues === 0 &&
      report.flow.evidenceRefs?.length > 0,
    'verification.flow',
    'Affected flow needs three passing cold runs and a rescue-free movie completion',
  )
  const exactAnchors = Array.isArray(report.exactAnchors) ? report.exactAnchors : []
  const requiredAnchors = new Set((contract?.syncAnchors || []).map(anchorId))
  const passedAnchors = new Set(exactAnchors
    .filter((entry) => ['story', 'camera', 'effect', 'score', 'control'].every((domain) => statusPassed(entry?.[domain])) && entry?.evidenceRefs?.length > 0)
    .map((entry) => entry?.anchor ?? entry?.id))
  collector.assert(requiredAnchors.size > 0 && [...requiredAnchors].every((anchor) => passedAnchors.has(anchor)), 'verification.anchors', 'Every contract anchor needs passing exact-anchor proof', [...requiredAnchors].filter((anchor) => !passedAnchors.has(anchor)))
  collector.assert(VARIANTS.every((variant) => statusPassed(report.variants?.[variant]) && report.variants[variant].focalParity === true && report.variants[variant].evidenceRefs?.length > 0), 'verification.variants', 'Desktop, mobile, reduced-motion, and lowest-quality focal-parity proofs must pass with evidence')
  const resetMatrix = Array.isArray(report.resetMatrix) ? report.resetMatrix : []
  const resetCases = ['replay', 'deep_link', 'pause_focus', 'quit', 'completion', 'sandbox_noop']
  collector.assert(resetCases.every((name) => resetMatrix.some((entry) => entry.case === name && statusPassed(entry.status) && entry.stateLeak === false && entry.evidenceRefs?.length > 0)), 'verification.reset', 'Every reset case must pass without state leakage and cite evidence')
  collector.assert(statusPassed(report.performance) && report.performance?.evidenceRefs?.length > 0, 'verification.performance', 'Performance budgets must pass with evidence')
  collector.assert(statusPassed(report.audio), 'verification.audio', 'Audio evidence must pass or be explicitly not applicable')
  collector.assert(statusPassed(report.overallStatus), 'verification.overall', 'Verification overallStatus must pass')
  if (contract?.evidence?.headedTaste?.required) {
    collector.assert((report.headedGates || []).some((gate) => gate.required === true && statusPassed(gate.status) && gate.evidenceRefs?.length > 0), 'verification.headed', 'Required headed gate must pass with real evidence')
  }
  collector.assert(!includesPlaceholder(report), 'verification.placeholders', 'Verification report cannot contain template placeholders')
}

function validateRawAudiovisualEvidence(manifest, contract, runPath, collector) {
  if (!manifest) return
  collector.assert(manifest.schema === 'paravoxia.rawAudiovisualEvidence.v1', 'raw-evidence.schema', 'Raw audiovisual manifest must use paravoxia.rawAudiovisualEvidence.v1')
  collector.assert(manifest.contractVersion === contract?.contractVersion, 'raw-evidence.contract', 'Raw audiovisual evidence must target the frozen contract revision')
  collector.assert(manifest.containsCreativeIntent === false, 'raw-evidence.blindness', 'Blind evidence manifest must contain no creative intent or reviewer conclusions')
  collector.assert(nonEmptyString(manifest.intentFreeInstructions), 'raw-evidence.instructions', 'Blind playback instructions are required')
  collector.assert(isObject(manifest.playbackMetadata) && nonEmptyString(manifest.playbackMetadata.instructions), 'raw-evidence.playback', 'Playback metadata and minimal instructions are required')
  const media = [manifest.continuousVideo, ...(manifest.frameStrips || []), ...(manifest.audio || [])]
  collector.assert(isObject(manifest.continuousVideo) && manifest.continuousVideo.durationSeconds > 0, 'raw-evidence.video', 'A nonempty continuous scene video is required')
  collector.assert(Array.isArray(manifest.frameStrips) && manifest.frameStrips.length > 0, 'raw-evidence.frames', 'At least one raw frame strip is required')
  collector.assert(Array.isArray(manifest.audio) && manifest.audio.length > 0, 'raw-evidence.audio', 'At least one raw audio or protected-audio regression capture is required')
  for (const item of media) {
    if (!item) continue
    const mediaPath = nonEmptyString(item.path) ? path.resolve(runPath, item.path) : null
    collector.assert(mediaPath && fs.existsSync(mediaPath) && fs.statSync(mediaPath).isFile(), 'raw-evidence.path', `Raw evidence file must resolve: ${item.path}`)
    collector.assert(/^[a-f0-9]{64}$/i.test(item.sha256 || ''), 'raw-evidence.hash-format', `Raw evidence needs a SHA-256 hash: ${item.path}`)
    if (mediaPath && fs.existsSync(mediaPath) && fs.statSync(mediaPath).isFile() && /^[a-f0-9]{64}$/i.test(item.sha256 || '')) {
      const actual = createHash('sha256').update(fs.readFileSync(mediaPath)).digest('hex')
      collector.assert(actual === item.sha256.toLowerCase(), 'raw-evidence.hash', `Raw evidence hash must match: ${item.path}`, { expected: item.sha256, actual })
    }
  }
  collector.assert(!includesPlaceholder(manifest), 'raw-evidence.placeholders', 'Raw audiovisual evidence cannot contain template placeholders')
}

function validateScorecard(scorecard, rubric, contract, collector) {
  if (!scorecard || !rubric) return
  collector.assert(scorecard.schema === 'paravoxia.creativeScorecard.v1', 'scorecard.schema', 'Final scorecard must use paravoxia.creativeScorecard.v1')
  collector.assert(scorecard.rubricRef === 'paravoxia-creative-cohesion@v1', 'scorecard.rubric', 'Final scorecard must reference the creative cohesion rubric by stable identity')
  const categories = Array.isArray(scorecard.categories) ? scorecard.categories : []
  const categoryMap = new Map(categories.map((entry) => [entry?.slug, entry]))
  collector.assert(categories.length === rubric.categories.length && rubric.categories.every((category) => categoryMap.has(category.slug)), 'scorecard.coverage', 'Every rubric category must be scored exactly once')
  collector.assert(new Set(categories.map((entry) => entry?.slug)).size === categories.length, 'scorecard.unique', 'Scorecard category slugs must be unique')
  let weightedTotal = 0
  let floor = Number.POSITIVE_INFINITY
  let usable = true
  for (const category of rubric.categories) {
    const entry = categoryMap.get(category.slug)
    const validScore = Number.isFinite(entry?.score) && entry.score >= rubric.scale.min && entry.score <= rubric.scale.max
    collector.assert(validScore, 'scorecard.category-score', `${category.slug} must be scored from ${rubric.scale.min} to ${rubric.scale.max}`, entry?.score)
    collector.assert(Array.isArray(entry?.evidenceRefs) && entry.evidenceRefs.length > 0, 'scorecard.category-evidence', `${category.slug} must cite evidence`)
    if (!validScore) usable = false
    else {
      weightedTotal += entry.score * category.weight
      floor = Math.min(floor, entry.score)
    }
  }
  const computedWeighted = usable ? weightedTotal / 100 : Number.NaN
  collector.assert(usable && Math.abs(scorecard.weightedScore - computedWeighted) <= 0.005, 'scorecard.weighted-score', 'Weighted score must match rubric weights', { reported: scorecard.weightedScore, computed: computedWeighted })
  collector.assert(usable && Math.abs(scorecard.categoryFloor - floor) <= 0.005, 'scorecard.floor', 'Category floor must match the lowest category', { reported: scorecard.categoryFloor, computed: floor })
  const flagship = contract?.production?.mode === 'flagship'
  const threshold = flagship ? 4.8 : 4.75
  const categoryFloor = flagship ? 4.5 : 4.3
  collector.assert(scorecard.weightedScore >= threshold, 'scorecard.threshold', `Weighted score must be at least ${threshold}`)
  collector.assert(scorecard.categoryFloor >= categoryFloor, 'scorecard.floor-threshold', `Every category must be at least ${categoryFloor}`)
  collector.assert(scorecard.fullCategoryCoverage === true, 'scorecard.full-coverage', 'Scorecard must attest full category coverage')
  collector.assert(['approved', 'ready-for-human-taste'].includes(scorecard.decision), 'scorecard.decision', 'Scorecard decision must be approved or ready-for-human-taste')
  collector.assert((scorecard.openDefects?.critical ?? 0) === 0 && (scorecard.openDefects?.high ?? 0) === 0, 'scorecard.blocking-defects', 'No critical or high defects may remain')
  collector.assert((scorecard.openDefects?.mediumUnaccepted ?? 0) === 0, 'scorecard.medium-defects', 'No material medium defect may remain unaccepted')
  collector.assert(!includesPlaceholder(scorecard), 'scorecard.placeholders', 'Scorecard cannot contain template placeholders')
}

function validateHumanDecision(decision, contract, collector) {
  if (!decision) return
  collector.assert(decision.schema === 'paravoxia.humanDecision.v1', 'human.schema', 'Human decision must use paravoxia.humanDecision.v1')
  collector.assert(decision.decision === 'approved', 'human.approval', 'Human taste/scope decision must be approved')
  collector.assert(decision.scopeMatchesProductionLock === true, 'human.scope', 'Human decision must attest production-lock scope')
  collector.assert(nonEmptyString(decision.reviewer) && nonEmptyString(decision.reviewedAt), 'human.identity', 'Human decision needs reviewer and timestamp')
  if (contract?.production?.mode === 'flagship' || contract?.evidence?.headedTaste?.required) {
    collector.assert(decision.headedRealGpuEvidence === true, 'human.headed', 'Flagship work requires headed real-GPU evidence')
  }
  collector.assert(!includesPlaceholder(decision), 'human.placeholders', 'Human decision cannot contain template placeholders')
}

function collectEvidenceRefs(value, refs = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectEvidenceRefs(item, refs)
    return refs
  }
  if (!isObject(value)) return refs
  for (const [key, child] of Object.entries(value)) {
    if (['evidenceRefs', 'priorEvidenceRefs'].includes(key) && Array.isArray(child)) refs.push(...child)
    collectEvidenceRefs(child, refs)
  }
  return refs
}

function validateEvidenceReferences(values, runPath, collector) {
  const repoRoot = resolveRepoRoot()
  for (const ref of collectEvidenceRefs(values)) {
    const validString = nonEmptyString(ref)
    collector.assert(validString, 'evidence.ref', 'Evidence references must be nonempty strings', ref)
    if (!validString) continue
    const typedNamespace = ref.match(/^([a-z][a-z0-9_-]*):/i)?.[1]
    if (typedNamespace && !['file', 'path'].includes(typedNamespace.toLowerCase())) continue
    const withoutPrefix = ref.replace(/^(?:file|path):/, '')
    const filePart = withoutPrefix.split('#')[0].replace(/:\d+(?::\d+)?$/, '')
    const looksLikeFile = withoutPrefix.startsWith('.') || filePart.includes('/') || /\.[a-z0-9]{1,8}$/i.test(filePart)
    if (looksLikeFile) {
      const candidates = [path.resolve(runPath, filePart), path.resolve(repoRoot, filePart)]
      collector.assert(candidates.some((candidate) => fs.existsSync(candidate)), 'evidence.path', `Evidence path must resolve: ${ref}`)
    } else collector.assert(false, 'evidence.namespace', `Non-file evidence must use a typed namespace: ${ref}`)
  }
}

function validateMarkdownArtifacts(runPath, names, collector) {
  const reviewFingerprints = new Map()
  for (const name of names) {
    const filePath = path.join(runPath, name)
    const exists = fs.existsSync(filePath)
    collector.assert(exists, 'artifact.exists', `${name} is required`)
    if (!exists) continue
    const content = fs.readFileSync(filePath, 'utf8')
    collector.assert(content.trim().length >= 120 && /^#\s+\S/m.test(content), 'artifact.substantive', `${name} must be a substantive headed report`)
    collector.assert(!PLACEHOLDER_PATTERN.test(content), 'artifact.placeholders', `${name} cannot contain template placeholders`)
    for (const section of MARKDOWN_SECTION_RULES[name] || []) {
      collector.assert(content.toLowerCase().includes(section), 'artifact.section', `${name} must contain its ${section} section`)
    }
    if (['story-audit.md', 'score-audit.md', 'cinematography-audit.md', 'naive-audience-report.md'].includes(name)) {
      collector.assert(/^Reviewer:\s*\S.+$/mi.test(content), 'review.identity', `${name} must identify its fresh reviewer`)
      collector.assert(/independen|isolation/i.test(content), 'review.independence', `${name} must attest independent or blind first-pass isolation`)
      const fingerprint = createHash('sha256').update(content.replace(/^#.*$/gm, '').replace(/\s+/g, ' ').trim()).digest('hex')
      collector.assert(!reviewFingerprints.has(fingerprint), 'review.distinct', `${name} must not duplicate another independent report`, reviewFingerprints.get(fingerprint))
      reviewFingerprints.set(fingerprint, name)
    }
  }
}

function validateRun(runPath, { writeReport = true, phase = 'final' } = {}) {
  const collector = makeCollector()
  collector.assert(fs.existsSync(runPath) && fs.statSync(runPath).isDirectory(), 'run.directory', 'Production run directory must exist', runPath)
  if (!fs.existsSync(runPath) || !fs.statSync(runPath).isDirectory()) return buildReport(runPath, collector.checks)
  const markdownNames = phase === 'final' ? [...CONTRACT_MARKDOWN, ...FINAL_MARKDOWN] : CONTRACT_MARKDOWN
  const jsonNames = phase === 'final' ? [...CONTRACT_JSON, ...FINAL_JSON] : CONTRACT_JSON
  validateMarkdownArtifacts(runPath, markdownNames, collector)
  for (const name of jsonNames) collector.assert(fs.existsSync(path.join(runPath, name)), 'artifact.exists', `${name} is required`)
  collector.assert(fs.existsSync(path.join(runPath, 'director-notes.jsonl')), 'artifact.exists', 'director-notes.jsonl is required')

  const productionLock = readJson(path.join(runPath, 'production-lock.json'), collector, 'lock')
  const contract = readJson(path.join(runPath, 'scene-contract.json'), collector, 'contract')
  const signoffs = readJson(path.join(runPath, 'director-signoffs.json'), collector, 'signoffs')
  const notes = readJsonl(path.join(runPath, 'director-notes.jsonl'), collector)
  const sceneSchema = readJson(path.join(resolveRepoRoot(), 'docs/architecture/workflow-orchestration/schemas/paravoxia-scene-contract.schema.json'), collector, 'scene-schema')
  const lockSchema = readJson(path.join(resolveRepoRoot(), 'docs/architecture/workflow-orchestration/schemas/paravoxia-production-lock.schema.json'), collector, 'lock-schema')
  const noteSchema = readJson(path.join(resolveRepoRoot(), 'docs/architecture/workflow-orchestration/schemas/paravoxia-director-note.schema.json'), collector, 'note-schema')
  const rubric = readJson(path.join(resolveRepoRoot(), 'docs/architecture/workflow-orchestration/rubrics/paravoxia-creative-cohesion.rubric.json'), collector, 'rubric')

  assertSchema(contract, sceneSchema, collector, 'contract.json-schema', 'Scene contract')
  notes.forEach((note, index) => assertSchema(note, noteSchema, collector, 'notes.json-schema', `Director note line ${index + 1}`))
  validateSceneContract(contract, collector)
  validateProductionLock(productionLock, lockSchema, contract, runPath, collector)
  validateNotes(notes, contract, collector)
  validateSignoffs(signoffs, contract, collector)
  validateEvidenceReferences([contract, notes], runPath, collector)

  if (phase === 'final') {
    validateImplementationDiff(runPath, productionLock, collector)
    const verification = readJson(path.join(runPath, 'verification-report.json'), collector, 'verification')
    const rawEvidence = readJson(path.join(runPath, 'raw-audiovisual-evidence.json'), collector, 'raw-evidence')
    const scorecard = readJson(path.join(runPath, 'final-scorecard.json'), collector, 'scorecard')
    const humanRequired = contract?.production?.mode === 'flagship' || contract?.evidence?.headedTaste?.required === true
    const humanPath = path.join(runPath, 'human-decision.json')
    collector.assert(!humanRequired || fs.existsSync(humanPath), 'artifact.exists', 'human-decision.json is required for flagship or headed-taste work')
    const humanDecision = humanRequired && fs.existsSync(humanPath) ? readJson(humanPath, collector, 'human') : null
    for (const [label, artifact] of [['verification', verification], ['raw-audiovisual-evidence', rawEvidence], ['final-scorecard', scorecard], ['human-decision', humanDecision]]) {
      if (!artifact) continue
      collector.assert(artifact.contractVersion === contract?.contractVersion, 'artifact.contract-version', `${label} must target the frozen contract version`)
      collector.assert(artifact.runId === productionLock?.runId, 'artifact.run-id', `${label} must target the production-lock run ID`)
    }
    collector.assert(scorecard?.mode === contract?.production?.mode, 'scorecard.mode', 'Scorecard mode must match the scene contract mode')
    collector.assert(verification?.sourceRevision === productionLock?.sourceRevision, 'verification.source-revision', 'Verification source revision must match the production lock')
    collector.assert(rawEvidence?.sourceRevision === productionLock?.sourceRevision, 'raw-evidence.source-revision', 'Raw audiovisual evidence source revision must match the production lock')
    validateVerification(verification, contract, collector)
    validateRawAudiovisualEvidence(rawEvidence, contract, runPath, collector)
    validateScorecard(scorecard, rubric, contract, collector)
    if (humanRequired) validateHumanDecision(humanDecision, contract, collector)
    validateEvidenceReferences([verification, rawEvidence, scorecard, humanDecision], runPath, collector)
  }
  const report = buildReport(runPath, collector.checks, phase)
  if (writeReport) {
    fs.writeFileSync(path.join(runPath, 'creative-run-quality-report.json'), `${JSON.stringify(report, null, 2)}\n`)
  }
  return report
}

function buildReport(runPath, checks, phase = 'final') {
  const failed = checks.filter((check) => !check.passed && check.level === 'error')
  const warnings = checks.filter((check) => !check.passed && check.level === 'warning')
  return {
    schema: 'paravoxia.creativeRunQualityReport.v1',
    runPath,
    phase,
    checkedAt: new Date().toISOString(),
    passed: failed.length === 0,
    checkCount: checks.length,
    failureCount: failed.length,
    warningCount: warnings.length,
    checks,
  }
}

function hydrateFixtureValue(value, pathParts = []) {
  if (typeof value === 'string' && (value.includes('{{') || PLACEHOLDER_PATTERN.test(value))) {
    const label = pathParts.join('-').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase()
    return `fixture:${label || 'value'}`
  }
  if (Array.isArray(value)) return value.map((item, index) => hydrateFixtureValue(item, [...pathParts, String(index)]))
  if (isObject(value)) return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, hydrateFixtureValue(child, [...pathParts, key])]))
  return value
}

function hydrateFixtureMarkdown(content, name) {
  return content
    .replace(/\{\{[^}\n]+\}\}/g, `fixture evidence for ${name}`)
    .replace(/template incomplete/gi, 'complete')
    .replace(/template_incomplete/g, 'passed')
    .replace(/\|\s*open\s*\|/g, '| resolved |')
}

function makeValidFixture(runPath) {
  const templateRoot = path.join(resolveRepoRoot(), '.codex/production-runs/_template')
  for (const name of [...CONTRACT_MARKDOWN, ...FINAL_MARKDOWN]) {
    const content = fs.readFileSync(path.join(templateRoot, name), 'utf8')
    fs.writeFileSync(path.join(runPath, name), hydrateFixtureMarkdown(content, name))
  }
  const contract = hydrateFixtureValue(JSON.parse(fs.readFileSync(path.join(templateRoot, 'scene-contract.json'), 'utf8')))
  contract.sceneId = 'fixture-a3-dawn'
  contract.contractVersion = 'v1'
  contract.status = 'frozen'
  contract.production.mode = 'scene'
  contract.production.authorityRefs = ['PARAVOXIA_DEMO_FOUNDATION_PLAN.md']
  contract.production.mutationBoundary = 'bounded-runtime'
  contract.production.allowedPaths = ['main/tools/creative-triad-gate.mjs']
  contract.production.protectedPaths = ['main/src/audio', 'main/src/components/audio', 'main/public/audio']
  contract.production.frozenAt = '2026-07-13T12:00:00.000Z'
  contract.performance.maximumDrawCalls = 120
  contract.performance.maximumShaderPrograms = 30
  contract.evidence.captures.forEach((capture) => { capture.status = 'passed' })
  contract.evidence.mechanicalChecks.forEach((check) => {
    check.status = 'passed'
    check.resultRef = 'verification-report.json'
  })
  contract.evidence.headedTaste = { required: false, realGpuRequired: false, status: 'not-required', decisionRef: null }
  fs.writeFileSync(path.join(runPath, 'scene-contract.json'), `${JSON.stringify(contract, null, 2)}\n`)
  const authorityPath = path.join(resolveRepoRoot(), 'PARAVOXIA_DEMO_FOUNDATION_PLAN.md')
  const productionLock = {
    schema: 'paravoxia.productionLock.v1', runId: 'fixture-run', mode: 'scene', status: 'locked', sourceRevision: 'fixture-working-tree',
    authority: [{ path: 'PARAVOXIA_DEMO_FOUNDATION_PLAN.md', section: '2. Locked Owner Decisions and 9. Resume Here', sha256: createHash('sha256').update(fs.readFileSync(authorityPath)).digest('hex') }],
    mutationBoundary: 'bounded-runtime', allowedPaths: ['main/tools/creative-triad-gate.mjs'], protectedPaths: ['main/src/audio/', 'main/src/components/audio/', 'main/public/audio/'],
    lockedBeats: [...contract.scope.beats],
    currentRestrictions: {
      storyCeiling: 'ch4-arrival', postArrivalStoryMutationAllowed: false, copyChangeDecisionRefs: [],
      protectedAudioPaths: ['main/src/audio/', 'main/src/components/audio/', 'main/public/audio/'],
      openGateRefs: ['headed-primitive-journey', 'fauna-triangle-budget', 'full-client-verify', 'batch-3-existing-story-screening'],
    },
    canonicalPreviewUrl: 'http://127.0.0.1:5201/', publishAllowed: false, frozenAt: '2026-07-13T12:00:00.000Z',
  }
  fs.writeFileSync(path.join(runPath, 'production-lock.json'), `${JSON.stringify(productionLock, null, 2)}\n`)
  const notes = DIRECTED_PAIRS.map((pair, index) => {
    const [from, to] = pair.split('->')
    return {
      schema: 'paravoxia.directorNote.v1', id: `note-${index + 1}`, contractVersion: 'v1', from, to, beat: 'a3-dawn', anchor: 'replace-anchor-start',
      kind: 'acceptance', severity: 'low', statement: `${from} confirms the shared anchor treatment.`,
      evidenceRefs: ['contract:anchor:a3.dawn'], requestedAction: 'Preserve the signed treatment.', status: 'accepted',
      owner: to,
      response: { by: to, statement: 'The recipient independently reviewed and accepts the requested treatment.', evidenceRefs: ['contract:anchor:a3.dawn'], respondedAt: '2026-07-13T12:01:00.000Z' },
      disposition: { outcome: 'accepted', decidedBy: to, reason: 'The treatment preserves the signed lane contract.', evidenceRefs: ['contract:anchor:a3.dawn'], actionRef: null, decidedAt: '2026-07-13T12:02:00.000Z' },
      createdAt: '2026-07-13T12:00:00.000Z', updatedAt: '2026-07-13T12:02:00.000Z',
    }
  })
  fs.writeFileSync(path.join(runPath, 'director-notes.jsonl'), `${notes.map((note) => JSON.stringify(note)).join('\n')}\n`)
  const directorSignoff = (director) => ({ disposition: 'approve', revision: 'v1', signedBy: `${director}-director`, signedAt: '2026-07-13T12:00:00.000Z' })
  fs.writeFileSync(path.join(runPath, 'director-signoffs.json'), `${JSON.stringify({ schema: 'paravoxia.directorSignoffs.v1', contractRevision: 'v1', sameRevision: true, chapter: directorSignoff('chapter'), score: directorSignoff('score'), cinematography: directorSignoff('cinematography') }, null, 2)}\n`)
  fs.writeFileSync(path.join(runPath, 'verification-report.json'), `${JSON.stringify({
    schema: 'paravoxia.sceneVerificationReport.v1', runId: 'fixture-run', contractVersion: 'v1', generatedAt: '2026-07-13T12:30:00.000Z', sourceRevision: 'fixture-working-tree', canonicalUrl: 'http://127.0.0.1:5201/',
    commands: [{ command: 'fixture verify', status: 'pass', exitCode: 0, evidenceRef: 'log:verify' }],
    flow: { coldRunsRequired: 3, coldRunsPassed: 3, movieCompletedWithoutRescue: true, timeoutRescues: 0, evidenceRefs: ['trace:movie'] },
    exactAnchors: contract.syncAnchors.map(({ id }) => ({ anchor: id, story: 'pass', camera: 'pass', effect: 'pass', score: 'pass', control: 'pass', evidenceRefs: [`trace:${id}`] })),
    variants: Object.fromEntries(VARIANTS.map((variant) => [variant, { status: 'pass', focalParity: true, evidenceRefs: [`frame:${variant}`] }])),
    resetMatrix: ['replay', 'deep_link', 'pause_focus', 'quit', 'completion', 'sandbox_noop'].map((name) => ({ case: name, status: 'pass', stateLeak: false, evidenceRefs: [`reset:${name}`] })),
    performance: { status: 'pass', targetFps: 60, measuredFps: 60, p95FrameTimeMs: 16.2, drawCalls: 80, shaderOrGpuNotes: 'Within contract budget.', memoryNotes: 'Stable during the proof window.', evidenceRefs: ['perf:trace'] },
    audio: { authorizedToChange: false, changed: false, status: 'not-applicable', evidenceRefs: ['audio:protected-no-change'] },
    headedGates: [{ gate: 'headed-taste', required: false, status: 'not-applicable', evidenceRefs: [] }],
    blockingDefects: [], overallStatus: 'pass',
  }, null, 2)}\n`)
  const evidenceDirectory = path.join(runPath, 'evidence')
  fs.mkdirSync(evidenceDirectory)
  const fixtureMedia = [
    ['scene.webm', 'fixture continuous audiovisual scene'],
    ['frames.png', 'fixture dense frame strip'],
    ['audio.wav', 'fixture audio evidence'],
  ]
  for (const [name, content] of fixtureMedia) fs.writeFileSync(path.join(evidenceDirectory, name), content)
  const mediaEntry = (name) => ({
    path: `evidence/${name}`,
    sha256: createHash('sha256').update(fs.readFileSync(path.join(evidenceDirectory, name))).digest('hex'),
  })
  fs.writeFileSync(path.join(runPath, 'raw-audiovisual-evidence.json'), `${JSON.stringify({
    schema: 'paravoxia.rawAudiovisualEvidence.v1', runId: 'fixture-run', contractVersion: 'v1', sourceRevision: 'fixture-working-tree', capturedAt: '2026-07-13T12:35:00.000Z', containsCreativeIntent: false,
    continuousVideo: { ...mediaEntry('scene.webm'), durationSeconds: 12, startAnchor: 'replace-anchor-start', endAnchor: 'replace-anchor-end' },
    frameStrips: [{ ...mediaEntry('frames.png'), anchors: ['replace-anchor-start', 'replace-anchor-end'], variant: 'desktop' }],
    audio: [{ ...mediaEntry('audio.wav'), startAnchor: 'replace-anchor-start', endAnchor: 'replace-anchor-end', disposition: 'protected-regression-capture' }],
    playbackMetadata: { canonicalUrl: 'http://127.0.0.1:5201/', viewport: '1440x900', qualityTier: 'high', reducedMotion: false, audioRoute: 'headphones', instructions: 'Play once continuously before frame inspection.' },
    intentFreeInstructions: 'Do not read creative intent, source, contracts, notes, bibles, or other reviews before the blind first pass.',
  }, null, 2)}\n`)
  const rubric = JSON.parse(fs.readFileSync(path.join(resolveRepoRoot(), 'docs/architecture/workflow-orchestration/rubrics/paravoxia-creative-cohesion.rubric.json'), 'utf8'))
  const categories = rubric.categories.map((category) => ({ slug: category.slug, weight: category.weight, score: 4.8, rationale: 'Independent evidence supports the score.', evidenceRefs: [`evidence:${category.slug}`], defectRefs: [] }))
  fs.writeFileSync(path.join(runPath, 'final-scorecard.json'), `${JSON.stringify({ schema: 'paravoxia.creativeScorecard.v1', runId: 'fixture-run', contractVersion: 'v1', mode: 'scene', rubricRef: 'paravoxia-creative-cohesion@v1', categories, weightedScore: 4.8, categoryFloor: 4.8, fullCategoryCoverage: true, thresholds: { sceneWeighted: 4.75, sceneFloor: 4.3, flagshipWeighted: 4.8, flagshipFloor: 4.5 }, openDefects: { critical: 0, high: 0, mediumUnaccepted: 0, low: 0 }, decision: 'approved', judge: 'fixture-cohesion-judge', judgedAt: '2026-07-13T12:40:00.000Z' }, null, 2)}\n`)
  fs.writeFileSync(path.join(runPath, 'implementation.diff'), 'diff --git a/main/tools/creative-triad-gate.mjs b/main/tools/creative-triad-gate.mjs\n--- a/main/tools/creative-triad-gate.mjs\n+++ b/main/tools/creative-triad-gate.mjs\n@@ -1 +1 @@\n-fixture-before\n+fixture-after\n')
}

function runSelfTest() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'paravoxia-creative-gate-'))
  try {
    makeValidFixture(tempRoot)
    const validContract = validateRun(tempRoot, { writeReport: false, phase: 'contract' })
    if (!validContract.passed) throw new Error(`Completed template failed contract phase:\n${validContract.checks.filter((check) => !check.passed).map((check) => `${check.code}: ${check.message}`).join('\n')}`)
    const valid = validateRun(tempRoot, { writeReport: false, phase: 'final' })
    if (!valid.passed) throw new Error(`Valid fixture failed:\n${valid.checks.filter((check) => !check.passed).map((check) => `${check.code}: ${check.message}`).join('\n')}`)
    const contractPath = path.join(tempRoot, 'scene-contract.json')
    const originalContractSource = fs.readFileSync(contractPath, 'utf8')
    const invalidContract = JSON.parse(fs.readFileSync(contractPath, 'utf8'))
    invalidContract.shots[0].startAnchorRef = 'missing.anchor'
    fs.writeFileSync(contractPath, JSON.stringify(invalidContract))
    const invalid = validateRun(tempRoot, { writeReport: false, phase: 'contract' })
    if (invalid.passed || !invalid.checks.some((check) => check.code === 'contract.shot-start' && !check.passed)) {
      throw new Error('Invalid fixture did not fail the unresolved shot-anchor check')
    }
    const notesPath = path.join(tempRoot, 'director-notes.jsonl')
    const selfClosedNotes = fs.readFileSync(notesPath, 'utf8').trim().split(/\r?\n/).map(JSON.parse)
    selfClosedNotes[0].disposition.decidedBy = selfClosedNotes[0].from
    fs.writeFileSync(notesPath, `${selfClosedNotes.map((note) => JSON.stringify(note)).join('\n')}\n`)
    fs.writeFileSync(contractPath, originalContractSource)
    const selfClosed = validateRun(tempRoot, { writeReport: false, phase: 'contract' })
    if (selfClosed.passed || !selfClosed.checks.some((check) => check.code === 'notes.self-close' && !check.passed)) {
      throw new Error('Invalid fixture did not reject a director closing its own note')
    }
    process.stdout.write(`Creative triad gate self-test passed (${valid.checkCount} final checks; completed-template schema, staged contract, invalid-anchor, and self-close checks confirmed).\n`)
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true })
  }
}

function printReport(report) {
  if (report.passed) {
    process.stdout.write(`Creative triad gate passed: ${report.checkCount} checks\nrun: ${report.runPath}\n`)
    return
  }
  process.stderr.write(`Creative triad gate failed: ${report.failureCount} failure(s)\nrun: ${report.runPath}\n`)
  for (const check of report.checks.filter((entry) => !entry.passed && entry.level === 'error')) {
    process.stderr.write(`- [${check.code}] ${check.message}${check.details === undefined ? '' : `: ${JSON.stringify(check.details)}`}\n`)
  }
}

try {
  const options = parseArgs(process.argv.slice(2))
  if (options.selfTest) runSelfTest()
  else {
    const runPath = resolveRunPath(options.run)
    const report = validateRun(runPath, { writeReport: !options.checkOnly, phase: options.phase })
    printReport(report)
    if (!report.passed) process.exitCode = 1
  }
} catch (error) {
  process.stderr.write(`Creative triad gate error: ${error.message}\n`)
  process.exitCode = 2
}
