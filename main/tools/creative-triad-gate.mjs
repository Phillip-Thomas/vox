#!/usr/bin/env node

import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'

const DIRECTORS = ['chapter', 'score', 'cinematography']
const DIRECTED_PAIRS = DIRECTORS.flatMap((from) =>
  DIRECTORS.filter((to) => to !== from).map((to) => `${from}->${to}`),
)
const VARIANTS = ['desktop', 'mobile', 'reducedMotion', 'lowestQuality']
const PEER_NOTE_FILES = {
  chapter: 'chapter-peer-notes.jsonl',
  score: 'score-peer-notes.jsonl',
  cinematography: 'cinematography-peer-notes.jsonl',
}
const RECONCILIATION_FILES = {
  chapter: 'chapter-reconciliation.jsonl',
  score: 'score-reconciliation.jsonl',
  cinematography: 'cinematography-reconciliation.jsonl',
}
const SIGNOFF_FILES = {
  chapter: 'chapter-contract-signoff.json',
  score: 'score-contract-signoff.json',
  cinematography: 'cinematography-contract-signoff.json',
}
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
  'shipped-visual-baseline.json',
  'scene-contract.json',
  'director-signoffs.json',
]
const IMPLEMENTATION_JSON = ['check-results.json']
const FINAL_JSON = [
  'verification-report.json',
  'raw-audiovisual-evidence.json',
  'evidence-registry.json',
  'defects.json',
  'repair-contract-disposition.json',
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
  if (!['contract', 'implementation', 'final'].includes(options.phase)) throw new Error('--phase must be contract, implementation, or final')
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

function sha256File(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

function probeMedia(filePath, collector, label) {
  const result = spawnSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=format_name,duration:stream=codec_type,codec_name,width,height,sample_rate,channels',
    '-of', 'json',
    filePath,
  ], { encoding: 'utf8' })
  collector.assert(result.status === 0, 'media.probe-command', `${label} must be readable by ffprobe`, result.stderr?.trim())
  if (result.status !== 0) return null
  let parsed
  try { parsed = JSON.parse(result.stdout) } catch (error) {
    collector.assert(false, 'media.probe-json', `${label} ffprobe output must be valid JSON`, error.message)
    return null
  }
  const video = (parsed.streams || []).find((stream) => stream.codec_type === 'video')
  const audio = (parsed.streams || []).find((stream) => stream.codec_type === 'audio')
  const duration = Number(parsed.format?.duration)
  return {
    formatName: parsed.format?.format_name || 'unknown',
    durationSeconds: Number.isFinite(duration) ? Number(duration.toFixed(3)) : 0,
    video: video ? { codec: video.codec_name, width: video.width, height: video.height } : null,
    audio: audio ? { codec: audio.codec_name, sampleRate: Number(audio.sample_rate), channels: audio.channels } : null,
  }
}

function validateMediaProbe(declared, actual, requirements, collector, label) {
  if (!actual) return
  collector.assert(JSON.stringify(declared) === JSON.stringify(actual), 'media.probe-binding', `${label} declared probe must match the hashed media bytes`, { declared, actual })
  if (requirements.video) collector.assert(actual.video && actual.video.width > 0 && actual.video.height > 0 && nonEmptyString(actual.video.codec), 'media.video-stream', `${label} must contain a decodable video/image stream`)
  if (requirements.audio) collector.assert(actual.audio && actual.audio.sampleRate > 0 && actual.audio.channels > 0 && nonEmptyString(actual.audio.codec), 'media.audio-stream', `${label} must contain a decodable audio stream`)
  if (requirements.duration) collector.assert(actual.durationSeconds > 0, 'media.duration', `${label} must have positive probed duration`)
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

function readJsonl(filePath, collector, label = path.basename(filePath)) {
  let source
  try {
    source = fs.readFileSync(filePath, 'utf8')
  } catch (error) {
    collector.assert(false, 'jsonl.read', `${label} must be readable`, error.message)
    return []
  }
  const notes = []
  source.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return
    try {
      notes.push(JSON.parse(line))
    } catch (error) {
      collector.assert(false, 'jsonl.parse', `${label} line ${index + 1} must be valid JSON`, error.message)
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

  const revealLedger = Array.isArray(contract.story?.revealLedger) ? contract.story.revealLedger : []
  const revealIds = revealLedger.map((entry) => entry?.id).filter(nonEmptyString)
  const revealSet = new Set(revealIds)
  collector.assert(revealLedger.length > 0, 'contract.reveal-ledger', 'A reveal/withhold ledger is required')
  collector.assert(revealIds.length === revealLedger.length && revealSet.size === revealIds.length, 'contract.reveal-unique', 'Reveal ledger IDs must be present and unique')
  for (const reveal of revealLedger) {
    const label = nonEmptyString(reveal?.id) ? reveal.id : '<unnamed-reveal>'
    collector.assert(nonEmptyString(reveal?.subject) && nonEmptyString(reveal?.playerEvidence), 'contract.reveal-substance', `${label} must identify its subject and exact player evidence or withholding`)
    collector.assert(!(reveal?.protectedQuestion === true && reveal?.levelAfter === 'resolved'), 'contract.protected-reveal', `${label} cannot resolve a question while marking it protected`)
  }

  const characterDynamics = Array.isArray(contract.story?.characterDynamics) ? contract.story.characterDynamics : []
  const characterDynamicIds = characterDynamics.map((entry) => entry?.id).filter(nonEmptyString)
  collector.assert(characterDynamics.length > 0, 'contract.character-dynamics', 'Character desire, opposition, tactic, and belief change are required')
  collector.assert(characterDynamicIds.length === characterDynamics.length && new Set(characterDynamicIds).size === characterDynamicIds.length, 'contract.character-dynamic-unique', 'Character-dynamic IDs must be present and unique')
  for (const dynamic of characterDynamics) {
    const label = nonEmptyString(dynamic?.id) ? dynamic.id : '<unnamed-character-dynamic>'
    collector.assert([dynamic?.desire, dynamic?.opposition, dynamic?.tactic, dynamic?.beliefBefore, dynamic?.beliefAfter].every(nonEmptyString), 'contract.character-dynamic-substance', `${label} must declare desire, opposition, tactic, and belief before/after`)
    collector.assert(Array.isArray(dynamic?.playerVisibleEvidenceRefs) && dynamic.playerVisibleEvidenceRefs.length > 0, 'contract.character-player-evidence', `${label} must cite player-visible evidence or an explicit withholding reference`)
    collector.assert(Array.isArray(dynamic?.revealRefs) && dynamic.revealRefs.length > 0 && dynamic.revealRefs.every((id) => revealSet.has(id)), 'contract.character-reveal-refs', `${label} reveal references must resolve`, (dynamic?.revealRefs || []).filter((id) => !revealSet.has(id)))
  }

  for (const event of contract.story?.events || []) {
    const label = nonEmptyString(event?.id) ? event.id : '<unnamed-story-event>'
    collector.assert(Array.isArray(event?.causeRefs) && Array.isArray(event?.payoffRefs), 'contract.story-causality', `${label} must explicitly declare cause and payoff references, including empty arrays when intentionally open`)
    collector.assert(Array.isArray(event?.revealRefs) && event.revealRefs.length > 0 && event.revealRefs.every((id) => revealSet.has(id)), 'contract.story-reveal-refs', `${label} reveal references must resolve`, (event?.revealRefs || []).filter((id) => !revealSet.has(id)))
  }

  const allowedAgencyTypes = new Set(['choice', 'authored-rite', 'mandatory-action', 'observation'])
  for (const window of contract.story?.agencyWindows || []) {
    const label = nonEmptyString(window?.id) ? window.id : '<unnamed-agency-window>'
    collector.assert(allowedAgencyTypes.has(window?.agencyType), 'contract.agency-type', `${label} must classify choice, authored rite, mandatory action, or observation`, window?.agencyType)
    collector.assert(nonEmptyString(window?.mandatoryPath), 'contract.agency-path', `${label} must declare the mandatory player path or observation`)
    collector.assert(typeof window?.fallbackAllowed === 'boolean' && nonEmptyString(window?.fallbackSemantics), 'contract.fallback-semantics', `${label} must declare fallback permission and semantics`)
    collector.assert(typeof window?.rescueAllowed === 'boolean' && nonEmptyString(window?.rescueSemantics), 'contract.rescue-semantics', `${label} must declare rescue permission and semantics`)
    collector.assert(window?.fallbackCountsAsNarrativeAcceptance === false, 'contract.fallback-acceptance', `${label} automated fallback cannot count as narrative acceptance`)
    collector.assert(window?.rescueCountsAsNarrativeAcceptance === false, 'contract.rescue-acceptance', `${label} automated rescue cannot count as narrative acceptance`)
  }

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

function validateDirectorAuthorship(peerNotesByDirector, reconciliationsByDirector, compiledNotes, contract, noteSchema, collector) {
  const compiledById = new Map(compiledNotes.map((note) => [note.id, note]))
  const firstWaveById = new Map()
  for (const director of DIRECTORS) {
    const peerNotes = peerNotesByDirector[director] || []
    collector.assert(peerNotes.length === 2, 'authorship.peer-count', `${director} must author exactly one first-wave note to each peer`)
    collector.assert(new Set(peerNotes.map((note) => note.to)).size === 2 && peerNotes.every((note) => note.from === director && note.to !== director), 'authorship.peer-routes', `${director} first-wave notes must address both peers`)
    for (const note of peerNotes) {
      assertSchema(note, noteSchema, collector, 'authorship.peer-schema', `${director} first-wave note ${note.id}`)
      collector.assert(note.contractVersion === contract?.contractVersion, 'authorship.peer-version', `${note.id} must target the frozen contract version`)
      collector.assert(note.status === 'open' && note.response === null && note.disposition === null, 'authorship.first-wave', `${note.id} must preserve the director's unmoderated first-wave note`)
      collector.assert(!firstWaveById.has(note.id), 'authorship.peer-id', `${note.id} must be unique across director fragments`)
      firstWaveById.set(note.id, note)
    }
  }
  collector.assert(firstWaveById.size === compiledById.size && [...firstWaveById.keys()].every((id) => compiledById.has(id)), 'authorship.compiled-coverage', 'Compiled director notes must contain exactly the director-authored first-wave IDs')

  const reconciliationByNote = new Map()
  for (const director of DIRECTORS) {
    const reconciliations = reconciliationsByDirector[director] || []
    collector.assert(reconciliations.length === 2, 'authorship.reconciliation-count', `${director} must respond to both incoming peer notes`)
    for (const reconciliation of reconciliations) {
      const original = firstWaveById.get(reconciliation.noteId)
      collector.assert(reconciliation.schema === 'paravoxia.directorReconciliation.v1', 'authorship.reconciliation-schema', `${director} reconciliation must use paravoxia.directorReconciliation.v1`)
      collector.assert(reconciliation.contractVersion === contract?.contractVersion && reconciliation.director === director, 'authorship.reconciliation-version', `${director} reconciliation must identify its director and contract version`)
      collector.assert(original?.to === director, 'authorship.reconciliation-route', `${director} may reconcile only notes addressed to that lane`, reconciliation.noteId)
      collector.assert(['resolved', 'accepted', 'rejected', 'closed', 'routed', 'superseded', 'withdrawn'].includes(reconciliation.status), 'authorship.reconciliation-status', `${reconciliation.noteId} reconciliation must be terminal`)
      collector.assert(reconciliation.response?.by === director && isObject(reconciliation.disposition), 'authorship.reconciliation-response', `${reconciliation.noteId} must preserve the recipient's structured response and disposition`)
      collector.assert(reconciliation.disposition?.decidedBy !== original?.from, 'authorship.reconciliation-self-close', `${reconciliation.noteId} cannot be closed by its author`)
      collector.assert(nonEmptyString(reconciliation.respondedAt) && !Number.isNaN(Date.parse(reconciliation.respondedAt)), 'authorship.reconciliation-time', `${reconciliation.noteId} reconciliation needs a timestamp`)
      collector.assert(!reconciliationByNote.has(reconciliation.noteId), 'authorship.reconciliation-id', `${reconciliation.noteId} may be reconciled once`)
      reconciliationByNote.set(reconciliation.noteId, reconciliation)
    }
  }
  collector.assert(reconciliationByNote.size === firstWaveById.size, 'authorship.reconciliation-coverage', 'Every director-authored note must have one recipient-authored reconciliation')

  const immutableFields = ['schema', 'id', 'contractVersion', 'from', 'to', 'beat', 'anchor', 'kind', 'severity', 'statement', 'evidenceRefs', 'requestedAction', 'owner', 'createdAt']
  for (const [id, original] of firstWaveById) {
    const compiled = compiledById.get(id)
    const reconciliation = reconciliationByNote.get(id)
    for (const field of immutableFields) {
      collector.assert(JSON.stringify(compiled?.[field]) === JSON.stringify(original?.[field]), 'authorship.compiled-mutation', `Compiler cannot rewrite ${id}.${field}`)
    }
    collector.assert(compiled?.status === reconciliation?.status && JSON.stringify(compiled?.response) === JSON.stringify(reconciliation?.response) && JSON.stringify(compiled?.disposition) === JSON.stringify(reconciliation?.disposition), 'authorship.compiled-response', `Compiled ${id} must reproduce the recipient-authored reconciliation exactly`)
  }
  collector.assert(!includesPlaceholder(peerNotesByDirector) && !includesPlaceholder(reconciliationsByDirector), 'authorship.placeholders', 'Director-authored fragments cannot contain template placeholders')
}

function validateSignoffs(signoffs, individualSignoffs, contract, contractSha256, collector) {
  if (!signoffs) return
  collector.assert(signoffs.schema === 'paravoxia.directorSignoffs.v1', 'signoffs.schema', 'Signoffs must use paravoxia.directorSignoffs.v1')
  collector.assert(signoffs.contractRevision === contract?.contractVersion, 'signoffs.contract-revision', 'Signoffs must target the scene contract revision')
  collector.assert(signoffs.contractSha256 === contractSha256, 'signoffs.contract-hash', 'Compiled signoffs must bind the exact scene-contract bytes')
  collector.assert(signoffs.sameRevision === true, 'signoffs.same-revision', 'All directors must sign the same revision')
  for (const director of DIRECTORS) {
    const signoff = signoffs[director]
    const individual = individualSignoffs?.[director]
    collector.assert(individual?.schema === 'paravoxia.directorSignoff.v1' && individual?.director === director, 'signoffs.individual-schema', `${director} must author its own signoff artifact`)
    collector.assert(individual?.contractVersion === contract?.contractVersion, 'signoffs.individual-revision', `${director} individual signoff must target the frozen revision`)
    collector.assert(individual?.contractSha256 === contractSha256, 'signoffs.individual-hash', `${director} individual signoff must bind the exact frozen contract bytes`)
    collector.assert(['approve', 'approve-with-notes'].includes(individual?.disposition), 'signoffs.individual-disposition', `${director} individual signoff must approve or approve with resolved notes`)
    collector.assert(nonEmptyString(individual?.signedBy) && nonEmptyString(individual?.signedAt), 'signoffs.individual-identity', `${director} individual signoff needs signer and timestamp`)
    collector.assert(isObject(signoff), 'signoffs.director', `${director} signoff is required`)
    collector.assert(['approve', 'approve-with-notes'].includes(signoff?.disposition), 'signoffs.disposition', `${director} must approve or approve with resolved notes`)
    collector.assert(signoff?.revision === contract?.contractVersion, 'signoffs.revision', `${director} must sign the current revision`)
    collector.assert(signoff?.contractSha256 === contractSha256, 'signoffs.hash', `${director} compiled signoff must bind the exact frozen contract bytes`)
    collector.assert(nonEmptyString(signoff?.signedBy) && nonEmptyString(signoff?.signedAt), 'signoffs.identity', `${director} signoff needs signer and timestamp`)
    collector.assert(JSON.stringify(signoff) === JSON.stringify({ disposition: individual?.disposition, revision: individual?.contractVersion, contractSha256: individual?.contractSha256, signedBy: individual?.signedBy, signedAt: individual?.signedAt }), 'signoffs.lossless-assembly', `${director} compiled signoff must reproduce the director-authored artifact exactly`)
  }
  collector.assert(!includesPlaceholder(signoffs) && !includesPlaceholder(individualSignoffs), 'signoffs.placeholders', 'Director signoffs cannot contain template placeholders')
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
  const expectedProfile = `paravoxia-creative-${lock.mode}@v1`
  collector.assert(lock.runProfileRef === expectedProfile, 'lock.run-profile', `Production lock profile must match mode: ${expectedProfile}`)
  collector.assert(typeof lock.releaseCandidate === 'boolean', 'lock.release-candidate', 'Production lock must explicitly state release-candidate status')
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
  const humanLock = fs.readFileSync(path.join(runPath, 'production-lock.md'), 'utf8')
  const mirroredValues = [
    lock.runId,
    lock.mode,
    lock.sourceRevision,
    lock.runProfileRef,
    String(lock.releaseCandidate),
    lock.mutationBoundary,
    ...(lock.authority || []).map((entry) => entry.path),
    ...(lock.allowedPaths || []),
    ...(lock.protectedPaths || []),
  ]
  collector.assert(mirroredValues.filter(nonEmptyString).every((value) => humanLock.includes(value)), 'lock.human-machine-mirror', 'production-lock.md must mirror every material machine-lock value', mirroredValues.filter((value) => nonEmptyString(value) && !humanLock.includes(value)))
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

function validateCheckResults(results, contract, contractSha256, lock, collector) {
  if (!results) return
  collector.assert(results.schema === 'paravoxia.checkResults.v1', 'checks.schema', 'Check results must use paravoxia.checkResults.v1')
  collector.assert(results.runId === lock?.runId && results.contractVersion === contract?.contractVersion && results.sourceRevision === lock?.sourceRevision, 'checks.identity', 'Check results must target the locked run, contract, and source revision')
  collector.assert(results.contractSha256 === contractSha256, 'checks.contract-hash', 'Check results must bind the exact signed scene contract')
  for (const name of ['productionScope', 'creativeContract', 'typecheck', 'tests', 'build']) {
    collector.assert(statusPassed(results[name]) && results[name]?.evidenceRefs?.length > 0, 'checks.required', `${name} must pass with evidence`)
  }
  collector.assert(Array.isArray(results.commands) && results.commands.length > 0 && results.commands.every((command) => statusPassed(command.status) && command.exitCode === 0 && nonEmptyString(command.evidenceRef)), 'checks.commands', 'Every recorded implementation command must pass and cite its log')
  collector.assert(!includesPlaceholder(results), 'checks.placeholders', 'Check results cannot contain template placeholders')
}

function validateVerification(report, contract, contractSha256, collector) {
  if (!report) return
  collector.assert(report.schema === 'paravoxia.sceneVerificationReport.v1', 'verification.schema', 'Verification report must use paravoxia.sceneVerificationReport.v1')
  collector.assert(report.contractSha256 === contractSha256, 'verification.contract-hash', 'Verification must bind the exact signed scene contract')
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

function validateShippedVisualBaseline(baseline, contract, lock, runPath, collector) {
  if (!baseline) return
  collector.assert(baseline.schema === 'paravoxia.shippedVisualBaseline.v1', 'baseline.schema', 'Shipped visual baseline must use paravoxia.shippedVisualBaseline.v1')
  collector.assert(baseline.runId === lock?.runId && baseline.sourceRevision === lock?.sourceRevision, 'baseline.source', 'Baseline must target the production lock run and source revision')
  collector.assert(baseline.sceneId === contract?.sceneId, 'baseline.scene', 'Baseline scene ID must match the scene contract')
  const anchors = new Set((contract?.syncAnchors || []).map(anchorId))
  collector.assert(Array.isArray(baseline.captures) && baseline.captures.length > 0, 'baseline.captures', 'At least one pre-change current-cut capture is required')
  for (const capture of baseline.captures || []) {
    const capturePath = nonEmptyString(capture.path) ? path.resolve(runPath, capture.path) : null
    collector.assert(capturePath && fs.existsSync(capturePath) && fs.statSync(capturePath).isFile(), 'baseline.path', `Baseline capture must resolve: ${capture.path}`)
    collector.assert(/^[a-f0-9]{64}$/i.test(capture.sha256 || ''), 'baseline.hash-format', `Baseline capture needs a SHA-256 hash: ${capture.path}`)
    collector.assert(anchors.has(capture.anchor), 'baseline.anchor', `Baseline capture anchor must resolve: ${capture.anchor}`)
    if (capturePath && fs.existsSync(capturePath) && fs.statSync(capturePath).isFile() && /^[a-f0-9]{64}$/i.test(capture.sha256 || '')) {
      const actual = createHash('sha256').update(fs.readFileSync(capturePath)).digest('hex')
      collector.assert(actual === capture.sha256.toLowerCase(), 'baseline.hash', `Baseline capture hash must match: ${capture.path}`, { expected: capture.sha256, actual })
      validateMediaProbe(capture.probe, probeMedia(capturePath, collector, `Baseline capture ${capture.path}`), { video: true, audio: false, duration: capture.kind === 'continuous-video' }, collector, `Baseline capture ${capture.path}`)
    }
  }
  collector.assert((baseline.cameraStates || []).length > 0 && baseline.cameraStates.every((state) => anchors.has(state.anchor) && CAMERA_AUTHORITIES.has(state.authority) && Number.isFinite(state.fovDeg)), 'baseline.camera', 'Baseline must record resolvable camera authority and FOV state')
  collector.assert((baseline.paletteStates || []).length > 0 && baseline.paletteStates.every((state) => anchors.has(state.anchor) && nonEmptyString(state.family) && state.sourceRefs?.length > 0), 'baseline.palette', 'Baseline must record semantic palette state and source references')
  collector.assert(['pending', 'captured'].includes(baseline.headedStatus), 'baseline.headed-status', 'Baseline must state whether headed capture is pending or captured')
  collector.assert(!includesPlaceholder(baseline), 'baseline.placeholders', 'Shipped visual baseline cannot contain template placeholders')
}

function validateRawAudiovisualEvidence(manifest, contract, contractSha256, runPath, collector) {
  if (!manifest) return
  collector.assert(manifest.schema === 'paravoxia.rawAudiovisualEvidence.v1', 'raw-evidence.schema', 'Raw audiovisual manifest must use paravoxia.rawAudiovisualEvidence.v1')
  collector.assert(manifest.contractVersion === contract?.contractVersion, 'raw-evidence.contract', 'Raw audiovisual evidence must target the frozen contract revision')
  collector.assert(manifest.contractSha256 === contractSha256, 'raw-evidence.contract-hash', 'Raw audiovisual evidence must bind the exact signed scene contract')
  collector.assert(manifest.containsCreativeIntent === false, 'raw-evidence.blindness', 'Blind evidence manifest must contain no creative intent or reviewer conclusions')
  collector.assert(nonEmptyString(manifest.intentFreeInstructions), 'raw-evidence.instructions', 'Blind playback instructions are required')
  collector.assert(isObject(manifest.playbackMetadata) && nonEmptyString(manifest.playbackMetadata.instructions), 'raw-evidence.playback', 'Playback metadata and minimal instructions are required')
  const media = [
    { item: manifest.continuousVideo, kind: 'continuous audiovisual video' },
    ...(manifest.frameStrips || []).map((item) => ({ item, kind: 'frame strip' })),
    ...(manifest.audio || []).map((item) => ({ item, kind: 'audio evidence' })),
  ]
  collector.assert(isObject(manifest.continuousVideo) && manifest.continuousVideo.durationSeconds > 0, 'raw-evidence.video', 'A nonempty continuous scene video is required')
  collector.assert(Array.isArray(manifest.frameStrips) && manifest.frameStrips.length > 0, 'raw-evidence.frames', 'At least one raw frame strip is required')
  collector.assert(Array.isArray(manifest.audio) && manifest.audio.length > 0, 'raw-evidence.audio', 'At least one raw audio or protected-audio regression capture is required')
  for (const { item, kind } of media) {
    if (!item) continue
    const mediaPath = nonEmptyString(item.path) ? path.resolve(runPath, item.path) : null
    collector.assert(mediaPath && fs.existsSync(mediaPath) && fs.statSync(mediaPath).isFile(), 'raw-evidence.path', `Raw evidence file must resolve: ${item.path}`)
    collector.assert(/^[a-f0-9]{64}$/i.test(item.sha256 || ''), 'raw-evidence.hash-format', `Raw evidence needs a SHA-256 hash: ${item.path}`)
    if (mediaPath && fs.existsSync(mediaPath) && fs.statSync(mediaPath).isFile() && /^[a-f0-9]{64}$/i.test(item.sha256 || '')) {
      const actual = createHash('sha256').update(fs.readFileSync(mediaPath)).digest('hex')
      collector.assert(actual === item.sha256.toLowerCase(), 'raw-evidence.hash', `Raw evidence hash must match: ${item.path}`, { expected: item.sha256, actual })
      const requirements = kind === 'continuous audiovisual video'
        ? { video: true, audio: true, duration: true }
        : kind === 'frame strip'
          ? { video: true, audio: false, duration: false }
          : { video: false, audio: true, duration: true }
      validateMediaProbe(item.probe, probeMedia(mediaPath, collector, `${kind} ${item.path}`), requirements, collector, `${kind} ${item.path}`)
    }
  }
  collector.assert(!includesPlaceholder(manifest), 'raw-evidence.placeholders', 'Raw audiovisual evidence cannot contain template placeholders')
}

function validateScorecard(scorecard, rubric, contract, contractSha256, collector) {
  if (!scorecard || !rubric) return
  collector.assert(scorecard.schema === 'paravoxia.creativeScorecard.v1', 'scorecard.schema', 'Final scorecard must use paravoxia.creativeScorecard.v1')
  collector.assert(scorecard.contractSha256 === contractSha256, 'scorecard.contract-hash', 'Final scorecard must bind the exact signed scene contract')
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
    collector.assert(entry?.weight === category.weight, 'scorecard.category-weight', `${category.slug} weight must match the rubric`, { reported: entry?.weight, expected: category.weight })
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

function validateHumanDecision(decision, contract, contractSha256, collector) {
  if (!decision) return
  collector.assert(decision.schema === 'paravoxia.humanDecision.v1', 'human.schema', 'Human decision must use paravoxia.humanDecision.v1')
  collector.assert(decision.contractSha256 === contractSha256, 'human.contract-hash', 'Human decision must bind the exact signed scene contract')
  collector.assert(decision.decision === 'approved', 'human.approval', 'Human taste/scope decision must be approved')
  collector.assert(decision.scopeMatchesProductionLock === true, 'human.scope', 'Human decision must attest production-lock scope')
  collector.assert(nonEmptyString(decision.reviewer) && nonEmptyString(decision.reviewedAt), 'human.identity', 'Human decision needs reviewer and timestamp')
  if (contract?.production?.mode === 'flagship' || contract?.evidence?.headedTaste?.required) {
    collector.assert(decision.headedRealGpuEvidence === true, 'human.headed', 'Flagship work requires headed real-GPU evidence')
  }
  collector.assert(!includesPlaceholder(decision), 'human.placeholders', 'Human decision cannot contain template placeholders')
}

function defectCounts(register) {
  const counts = { critical: 0, high: 0, mediumUnaccepted: 0, low: 0 }
  for (const defect of register?.defects || []) {
    if (defect?.status !== 'open') continue
    if (defect.severity === 'critical') counts.critical += 1
    else if (defect.severity === 'high') counts.high += 1
    else if (defect.severity === 'medium') counts.mediumUnaccepted += 1
    else if (defect.severity === 'low') counts.low += 1
  }
  return counts
}

function validateDefectRegister(register, scorecard, contract, contractSha256, lock, humanDecision, runPath, collector) {
  if (!register) return
  collector.assert(register.schema === 'paravoxia.creativeDefectRegister.v1', 'defects.schema', 'Defect register must use paravoxia.creativeDefectRegister.v1')
  collector.assert(register.runId === lock?.runId && register.contractVersion === contract?.contractVersion, 'defects.identity', 'Defect register must target the locked run and active contract revision')
  collector.assert(register.contractSha256 === contractSha256, 'defects.contract-hash', 'Defect register must bind the exact signed scene contract')
  collector.assert(nonEmptyString(register.compiledBy) && nonEmptyString(register.compiledAt) && !Number.isNaN(Date.parse(register.compiledAt)), 'defects.compiler', 'Defect register needs an identified review moderator and timestamp')
  collector.assert(typeof register.requiresHumanTaste === 'boolean', 'defects.human-trigger', 'Defect register must explicitly state whether human taste is required')

  const requiredReports = ['story-audit.md', 'score-audit.md', 'cinematography-audit.md', 'naive-audience-report.md', 'critic-report.md']
  const sources = Array.isArray(register.sourceReports) ? register.sourceReports : []
  const sourceMap = new Map(sources.map((source) => [source?.path, source]))
  collector.assert(sources.length === requiredReports.length && new Set(sources.map((source) => source?.path)).size === sources.length && requiredReports.every((name) => sourceMap.has(name)), 'defects.sources', 'Canonical defects must cite exactly the four independent reports and critic synthesis')
  for (const name of requiredReports) {
    const source = sourceMap.get(name)
    const sourcePath = path.resolve(runPath, source?.path || '')
    collector.assert(sourcePath.startsWith(`${runPath}${path.sep}`) && fs.existsSync(sourcePath) && fs.statSync(sourcePath).isFile(), 'defects.source-path', `Defect source report must resolve inside the run: ${name}`)
    collector.assert(/^[a-f0-9]{64}$/i.test(source?.sha256 || ''), 'defects.source-hash-format', `Defect source needs a SHA-256 hash: ${name}`)
    if (sourcePath.startsWith(`${runPath}${path.sep}`) && fs.existsSync(sourcePath) && /^[a-f0-9]{64}$/i.test(source?.sha256 || '')) {
      collector.assert(sha256File(sourcePath) === source.sha256.toLowerCase(), 'defects.source-hash', `Defect source hash must match: ${name}`)
    }
  }

  const defects = Array.isArray(register.defects) ? register.defects : []
  collector.assert(new Set(defects.map((defect) => defect?.id)).size === defects.length, 'defects.unique', 'Defect IDs must be unique')
  const anchors = new Set((contract?.syncAnchors || []).map(anchorId))
  const validSources = new Set(requiredReports)
  const acceptedByHuman = new Set(humanDecision?.acceptedExceptions || [])
  for (const defect of defects) {
    collector.assert(nonEmptyString(defect?.id) && ['critical', 'high', 'medium', 'low'].includes(defect?.severity), 'defects.shape', 'Every defect needs an ID and valid severity', defect?.id)
    collector.assert(['open', 'resolved', 'accepted-exception'].includes(defect?.status), 'defects.status', `Defect ${defect?.id} needs a valid status`)
    collector.assert(['chapter', 'score', 'cinematography', 'integration', 'human'].includes(defect?.owner), 'defects.owner', `Defect ${defect?.id} needs a valid owner`)
    collector.assert(anchors.has(defect?.anchor), 'defects.anchor', `Defect ${defect?.id} must resolve to a contract anchor`)
    collector.assert(nonEmptyString(defect?.statement) && nonEmptyString(defect?.requestedRepair) && nonEmptyString(defect?.verificationRoute), 'defects.substantive', `Defect ${defect?.id} needs a statement, repair, and verification route`)
    collector.assert(Array.isArray(defect?.evidenceRefs) && defect.evidenceRefs.length > 0, 'defects.evidence', `Defect ${defect?.id} needs evidence`)
    collector.assert(Array.isArray(defect?.sourceReportRefs) && defect.sourceReportRefs.length > 0 && defect.sourceReportRefs.every((ref) => validSources.has(ref)), 'defects.source-refs', `Defect ${defect?.id} must cite its source report(s)`)
    for (const sourceRef of defect?.sourceReportRefs || []) {
      const sourcePath = path.join(runPath, sourceRef)
      if (fs.existsSync(sourcePath)) collector.assert(fs.readFileSync(sourcePath, 'utf8').includes(defect.id), 'defects.lossless-source', `Source report ${sourceRef} must contain defect ID ${defect.id}`)
    }
    collector.assert(Number.isInteger(defect?.iterationIntroduced) && defect.iterationIntroduced >= 0, 'defects.iteration-introduced', `Defect ${defect?.id} needs an introduction iteration`)
    if (defect?.status === 'resolved') collector.assert(Number.isInteger(defect?.iterationResolved) && defect.iterationResolved >= defect.iterationIntroduced, 'defects.iteration-resolved', `Resolved defect ${defect?.id} needs a valid resolution iteration`)
    if (defect?.status === 'accepted-exception') {
      collector.assert(nonEmptyString(defect?.acceptedExceptionRef) && acceptedByHuman.has(defect.id), 'defects.exception', `Accepted exception ${defect?.id} must resolve to the scoped human decision`)
    } else collector.assert(defect?.acceptedExceptionRef === null, 'defects.exception-null', `Non-exception defect ${defect?.id} cannot carry an exception reference`)
  }
  const computed = defectCounts(register)
  collector.assert(JSON.stringify(scorecard?.openDefects) === JSON.stringify(computed), 'defects.scorecard-counts', 'Scorecard open-defect counts must be recomputed exactly from defects.json', { reported: scorecard?.openDefects, computed })
  collector.assert(computed.critical === 0 && computed.high === 0 && computed.mediumUnaccepted === 0, 'defects.blocking', 'No critical, high, or unaccepted medium defect may remain open', computed)
  collector.assert(!includesPlaceholder(register), 'defects.placeholders', 'Defect register cannot contain template placeholders')
}

function validateRepairDisposition(disposition, register, contract, contractSha256, signoffs, lock, runPath, collector) {
  if (!disposition) return []
  collector.assert(disposition.schema === 'paravoxia.repairContractDisposition.v1', 'repair.schema', 'Repair disposition must use paravoxia.repairContractDisposition.v1')
  collector.assert(disposition.runId === lock?.runId && disposition.activeContractVersion === contract?.contractVersion, 'repair.identity', 'Repair disposition must target the locked run and active contract revision')
  collector.assert(disposition.activeContractSha256 === contractSha256, 'repair.contract-hash', 'Repair disposition must bind the exact active scene contract')
  const defectsPath = path.join(runPath, 'defects.json')
  collector.assert(fs.existsSync(defectsPath) && disposition.defectRegisterSha256 === sha256File(defectsPath), 'repair.defect-hash', 'Repair disposition must bind the canonical defect register')
  collector.assert(nonEmptyString(disposition.decidedBy) && nonEmptyString(disposition.decidedAt) && !Number.isNaN(Date.parse(disposition.decidedAt)), 'repair.decision', 'Repair disposition needs a producer identity and timestamp')
  const totalDefects = register?.defects?.length || 0
  const validRoute = ['no-repair', 'implement-within-signed-contract', 'revised-and-resigned', 'recontract-required', 'blocked-for-human'].includes(disposition.route)
  collector.assert(validRoute, 'repair.route', 'Repair disposition must use a governed route')
  collector.assert(Array.isArray(disposition.directionRefs), 'repair.direction-refs', 'Repair direction references must be an array')
  const directions = []
  const coveredDefects = new Map()
  const referencedDirectors = new Set()
  for (const ref of disposition.directionRefs || []) {
    const directionPath = path.resolve(runPath, ref)
    collector.assert(directionPath.startsWith(`${runPath}${path.sep}`) && fs.existsSync(directionPath) && fs.statSync(directionPath).isFile(), 'repair.direction-path', `Repair direction must resolve inside the run: ${ref}`)
    if (!(directionPath.startsWith(`${runPath}${path.sep}`) && fs.existsSync(directionPath) && fs.statSync(directionPath).isFile())) continue
    const direction = readJson(directionPath, collector, 'repair-direction')
    if (!direction) continue
    directions.push(direction)
    collector.assert(direction.schema === 'paravoxia.directorRepairDirection.v1' && DIRECTORS.includes(direction.director), 'repair.direction-schema', `${ref} must be a named director repair direction`)
    collector.assert(ref === `${direction.director}-repair-direction.json`, 'repair.direction-name', `${ref} must match its authoring director`)
    collector.assert(!referencedDirectors.has(direction.director), 'repair.direction-unique', `Only one final repair direction may exist for ${direction.director}`)
    referencedDirectors.add(direction.director)
    collector.assert(direction.runId === lock?.runId && direction.contractVersion === contract?.contractVersion && direction.contractSha256 === contractSha256, 'repair.direction-identity', `${ref} must bind the locked run and exact active contract`)
    collector.assert(typeof direction.contractChangeRequired === 'boolean', 'repair.direction-contract-change', `${ref} must explicitly classify contract change`)
    collector.assert(Array.isArray(direction.defectIds) && direction.defectIds.length > 0 && new Set(direction.defectIds).size === direction.defectIds.length, 'repair.direction-defects', `${ref} must name unique defect IDs`)
    collector.assert(Array.isArray(direction.boundedActions) && direction.boundedActions.length > 0 && direction.boundedActions.every(nonEmptyString), 'repair.direction-actions', `${ref} must contain bounded repair actions`)
    collector.assert(Array.isArray(direction.evidenceRefs) && direction.evidenceRefs.length > 0 && nonEmptyString(direction.verificationRoute), 'repair.direction-evidence', `${ref} must contain evidence and a verification route`)
    collector.assert(nonEmptyString(direction.authoredBy) && direction.authoredBy === signoffs?.[direction.director]?.signedBy && nonEmptyString(direction.authoredAt) && !Number.isNaN(Date.parse(direction.authoredAt)), 'repair.direction-author', `${ref} must be authored by the signing director with a timestamp`)
    for (const defectId of direction.defectIds || []) {
      const defect = (register?.defects || []).find((candidate) => candidate.id === defectId)
      collector.assert(defect?.owner === direction.director, 'repair.direction-owner', `${ref} may only direct ${direction.director}-owned defects: ${defectId}`)
      collector.assert(!coveredDefects.has(defectId), 'repair.direction-duplicate-defect', `Defect ${defectId} may have one owning director direction`)
      coveredDefects.set(defectId, direction.director)
    }
    collector.assert(!includesPlaceholder(direction), 'repair.direction-placeholders', `${ref} cannot contain template placeholders`)
  }
  const directorOwnedDefects = (register?.defects || []).filter((defect) => DIRECTORS.includes(defect.owner))
  collector.assert(directorOwnedDefects.every((defect) => coveredDefects.get(defect.id) === defect.owner), 'repair.direction-coverage', 'Every director-owned defect in the canonical history needs its owning director direction', directorOwnedDefects.filter((defect) => coveredDefects.get(defect.id) !== defect.owner).map((defect) => defect.id))
  collector.assert(disposition.contractChangeRequired === directions.some((direction) => direction.contractChangeRequired === true), 'repair.derived-contract-change', 'Producer cannot override director contract-change classifications')
  if (totalDefects === 0) {
    collector.assert(disposition.route === 'no-repair' && disposition.contractChangeRequired === false && disposition.baseContractVersion === disposition.activeContractVersion && disposition.directionRefs.length === 0, 'repair.no-repair', 'An empty defect register must close with an exact no-repair disposition')
  } else {
    collector.assert(disposition.route !== 'no-repair', 'repair.material-route', 'A nonempty defect history cannot use the no-repair route')
  }
  if (disposition.contractChangeRequired === true) {
    collector.assert(disposition.route === 'revised-and-resigned', 'repair.recontract-route', 'Final approval of a contract-changing repair requires revised-and-resigned')
    collector.assert(disposition.triadResignRequired === true && disposition.triadResignComplete === true, 'repair.resign', 'Contract-changing repairs require three fresh completed signatures')
    collector.assert(disposition.baseContractVersion !== disposition.activeContractVersion && contract?.supersedesVersion === disposition.baseContractVersion, 'repair.lineage', 'Revised contracts must increment lineage from the recorded base revision')
    collector.assert(signoffs?.sameRevision === true && signoffs?.contractRevision === disposition.activeContractVersion && signoffs?.contractSha256 === disposition.activeContractSha256, 'repair.signoffs', 'All three signatures must bind the revised contract')
  } else {
    collector.assert(['no-repair', 'implement-within-signed-contract'].includes(disposition.route), 'repair.stable-route', 'Contract-stable closure must be no-repair or implement-within-signed-contract')
    collector.assert(disposition.baseContractVersion === disposition.activeContractVersion && disposition.triadResignRequired === false && disposition.triadResignComplete === false, 'repair.stable-lineage', 'Contract-stable repairs cannot claim a re-sign cycle')
  }
  collector.assert(!includesPlaceholder(disposition), 'repair.placeholders', 'Repair contract disposition cannot contain template placeholders')
  return directions
}

function validateIterationLedger(entries, register, defectRegisterSha256, scorecard, contract, contractSha256, lock, repairDisposition, runPath, collector) {
  collector.assert(entries.length > 0, 'iterations.required', 'Iteration ledger must contain at least one durable entry')
  entries.forEach((entry, index) => {
    collector.assert(entry?.schema === 'paravoxia.creativeIteration.v1' && entry?.runId === lock?.runId, 'iterations.identity', `Iteration ${index} must target the locked run`)
    collector.assert(entry?.iteration === index, 'iterations.sequence', `Iteration ledger must be contiguous from zero; expected ${index}`)
    collector.assert(nonEmptyString(entry?.contractVersion) && /^[a-f0-9]{64}$/i.test(entry?.contractSha256 || '') && /^[a-f0-9]{64}$/i.test(entry?.defectRegisterSha256 || ''), 'iterations.hash-shape', `Iteration ${index} must bind contract and defect-register hashes`)
    const contractSnapshotPath = nonEmptyString(entry?.contractRef) ? path.resolve(runPath, entry.contractRef) : null
    const defectSnapshotPath = nonEmptyString(entry?.defectRegisterRef) ? path.resolve(runPath, entry.defectRegisterRef) : null
    collector.assert(contractSnapshotPath && contractSnapshotPath.startsWith(`${runPath}${path.sep}`) && fs.existsSync(contractSnapshotPath), 'iterations.contract-snapshot', `Iteration ${index} contract snapshot must resolve inside the run`)
    collector.assert(defectSnapshotPath && defectSnapshotPath.startsWith(`${runPath}${path.sep}`) && fs.existsSync(defectSnapshotPath), 'iterations.defect-snapshot', `Iteration ${index} defect snapshot must resolve inside the run`)
    if (contractSnapshotPath && fs.existsSync(contractSnapshotPath)) {
      collector.assert(sha256File(contractSnapshotPath) === entry.contractSha256, 'iterations.contract-snapshot-hash', `Iteration ${index} contract snapshot hash must match`)
      const snapshot = readJson(contractSnapshotPath, collector, `iteration-${index}-contract`)
      collector.assert(snapshot?.contractVersion === entry.contractVersion, 'iterations.contract-snapshot-version', `Iteration ${index} contract snapshot version must match`)
    }
    if (defectSnapshotPath && fs.existsSync(defectSnapshotPath)) {
      collector.assert(sha256File(defectSnapshotPath) === entry.defectRegisterSha256, 'iterations.defect-snapshot-hash', `Iteration ${index} defect snapshot hash must match`)
      const snapshot = readJson(defectSnapshotPath, collector, `iteration-${index}-defects`)
      collector.assert(snapshot?.contractVersion === entry.contractVersion && JSON.stringify(defectCounts(snapshot)) === JSON.stringify(entry.openDefects), 'iterations.defect-snapshot-counts', `Iteration ${index} defect snapshot must match its contract and counts`)
    }
    collector.assert(nonEmptyString(entry?.recordedAt) && !Number.isNaN(Date.parse(entry.recordedAt)), 'iterations.time', `Iteration ${index} needs a timestamp`)
  })
  const finalEntry = entries.at(-1)
  collector.assert(finalEntry?.contractVersion === contract?.contractVersion && finalEntry?.contractSha256 === contractSha256, 'iterations.final-contract', 'Final iteration must bind the active signed contract')
  collector.assert(finalEntry?.defectRegisterSha256 === defectRegisterSha256, 'iterations.final-defects', 'Final iteration must bind the canonical defect register bytes')
  collector.assert(JSON.stringify(finalEntry?.openDefects) === JSON.stringify(defectCounts(register)), 'iterations.final-counts', 'Final iteration defect counts must match defects.json exactly')
  collector.assert(finalEntry?.weightedScore === scorecard?.weightedScore && finalEntry?.categoryFloor === scorecard?.categoryFloor, 'iterations.final-score', 'Final iteration must record the approved score and floor')
  collector.assert(['passed', 'closed'].includes(finalEntry?.gateStatus), 'iterations.final-status', 'Final iteration must be passed or closed')
  collector.assert(Array.isArray(finalEntry?.evidenceRefs) && finalEntry.evidenceRefs.length > 0, 'iterations.final-evidence', 'Final iteration must cite evidence')
  if (repairDisposition?.contractChangeRequired) {
    collector.assert(entries.some((entry) => entry.contractVersion === repairDisposition.baseContractVersion) && entries.some((entry) => entry.contractVersion === repairDisposition.activeContractVersion), 'iterations.recontract-lineage', 'Iteration ledger must show both the base and revised contract versions')
  }
  const highestDefectIteration = Math.max(0, ...(register?.defects || []).flatMap((defect) => [defect.iterationIntroduced, defect.iterationResolved].filter(Number.isInteger)))
  collector.assert(finalEntry?.iteration >= highestDefectIteration, 'iterations.defect-history', 'Iteration ledger cannot omit a defect introduction or resolution iteration')
  collector.assert(!includesPlaceholder(entries), 'iterations.placeholders', 'Iteration ledger cannot contain template placeholders')
}

function validateWorkflowRoleContracts(workflow, collector) {
  if (!workflow) return
  const roles = new Map((workflow.roleContracts || []).map((role) => [role.slug, role]))
  for (const step of workflow.steps || []) {
    const role = roles.get(step.roleContractRef)
    collector.assert(Boolean(role), 'workflow.role', `Workflow step ${step.id} must reference a declared role`)
    if (!role) continue
    for (const input of step.inputs || []) collector.assert((role.allowedInputs || []).includes(input), 'workflow.role-input', `${step.id} input ${input} must be allowed by ${role.slug}`)
    for (const output of step.outputs || []) collector.assert((role.requiredOutputs || []).includes(output), 'workflow.role-output', `${step.id} output ${output} must be declared by ${role.slug}`)
  }
  const implementationGate = (workflow.gates || []).find((gate) => gate.id === 'implementation-checks-pass')
  const checks = implementationGate?.checks || []
  collector.assert(checks.some((check) => check.includes('creativeContract.status')) && checks.some((check) => check.includes('commands.every')) && checks.every((check) => !check.includes('creativeGate') && !check.includes('allExitZero')), 'workflow.implementation-gate', 'Workflow implementation gate must use structured creativeContract and per-command results')
  const defectProducers = (workflow.steps || []).filter((step) => (step.outputs || []).includes('defects')).map((step) => step.id)
  collector.assert(JSON.stringify(defectProducers) === JSON.stringify(['critique-independent-reviews']), 'workflow.defect-producer', 'Only the independent review moderator may compile canonical defects.json', defectProducers)
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

function validateEvidenceRegistry(registry, contract, contractSha256, lock, runPath, collector) {
  if (!registry) return new Map()
  collector.assert(registry.schema === 'paravoxia.evidenceRegistry.v1', 'registry.schema', 'Evidence registry must use paravoxia.evidenceRegistry.v1')
  collector.assert(registry.runId === lock?.runId && registry.contractVersion === contract?.contractVersion && registry.sourceRevision === lock?.sourceRevision, 'registry.identity', 'Evidence registry must target the locked run, contract, and source revision')
  collector.assert(registry.contractSha256 === contractSha256, 'registry.contract-hash', 'Evidence registry must bind the exact signed scene contract')
  collector.assert(nonEmptyString(registry.compiledAt) && !Number.isNaN(Date.parse(registry.compiledAt)), 'registry.time', 'Evidence registry needs a compilation timestamp')
  const entries = Array.isArray(registry.entries) ? registry.entries : []
  collector.assert(entries.length > 0 && new Set(entries.map((entry) => entry?.ref)).size === entries.length, 'registry.entries', 'Evidence registry needs unique typed references')
  const entryMap = new Map()
  for (const entry of entries) {
    collector.assert(/^[a-z][a-z0-9_-]*:.+/i.test(entry?.ref || '') && !/^(?:file|path|contract):/i.test(entry?.ref || ''), 'registry.ref', 'Registry references must use a non-file typed namespace', entry?.ref)
    const evidencePath = nonEmptyString(entry?.path) ? path.resolve(runPath, entry.path) : null
    collector.assert(evidencePath && evidencePath.startsWith(`${runPath}${path.sep}`) && fs.existsSync(evidencePath) && fs.statSync(evidencePath).isFile(), 'registry.path', `Registered evidence must resolve inside the run: ${entry?.ref}`)
    collector.assert(/^[a-f0-9]{64}$/i.test(entry?.sha256 || ''), 'registry.hash-format', `Registered evidence needs a SHA-256 hash: ${entry?.ref}`)
    if (evidencePath && evidencePath.startsWith(`${runPath}${path.sep}`) && fs.existsSync(evidencePath) && /^[a-f0-9]{64}$/i.test(entry?.sha256 || '')) {
      collector.assert(sha256File(evidencePath) === entry.sha256.toLowerCase(), 'registry.hash', `Registered evidence hash must match: ${entry.ref}`)
    }
    collector.assert(nonEmptyString(entry?.kind) && nonEmptyString(entry?.description), 'registry.metadata', `Registered evidence needs kind and description: ${entry?.ref}`)
    entryMap.set(entry?.ref, entry)
  }
  collector.assert(!includesPlaceholder(registry), 'registry.placeholders', 'Evidence registry cannot contain template placeholders')
  return entryMap
}

function validateEvidenceReferences(values, runPath, collector, evidenceRegistry = null) {
  const repoRoot = resolveRepoRoot()
  const registryMap = evidenceRegistry instanceof Map ? evidenceRegistry : null
  for (const ref of collectEvidenceRefs(values)) {
    const validString = nonEmptyString(ref)
    collector.assert(validString, 'evidence.ref', 'Evidence references must be nonempty strings', ref)
    if (!validString) continue
    const typedNamespace = ref.match(/^([a-z][a-z0-9_-]*):/i)?.[1]
    if (typedNamespace && !['file', 'path'].includes(typedNamespace.toLowerCase())) {
      if (typedNamespace.toLowerCase() === 'contract') continue
      if (registryMap) collector.assert(registryMap.has(ref), 'evidence.registry-ref', `Typed evidence must resolve through evidence-registry.json: ${ref}`)
      continue
    }
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

function validateReviewMetadata(runPath, contract, individualSignoffs, collector) {
  const directorIdentities = new Set(Object.values(individualSignoffs || {}).map((signoff) => signoff?.signedBy).filter(nonEmptyString))
  for (const name of ['story-audit.md', 'score-audit.md', 'cinematography-audit.md']) {
    const content = fs.readFileSync(path.join(runPath, name), 'utf8')
    const reviewer = content.match(/^Reviewer:\s*`?([^`\n]+)`?\s*$/mi)?.[1]?.trim()
    collector.assert(nonEmptyString(reviewer) && !directorIdentities.has(reviewer), 'review.separation', `${name} reviewer must be identified and independent from all directors`, reviewer)
    collector.assert(content.includes(`Contract revision: \`${contract?.contractVersion}\``), 'review.contract-version', `${name} must target the frozen contract version`)
    collector.assert(/First report completed before reading peer conclusions:\s*`?yes`?/i.test(content), 'review.first-wave', `${name} must attest that its first report preceded peer conclusions`)
  }
  const blind = fs.readFileSync(path.join(runPath, 'naive-audience-report.md'), 'utf8')
  collector.assert(/I did not receive[\s\S]{0,500}:\s*`?yes`?/i.test(blind), 'review.blind-isolation', 'Naive audience reviewer must attest it received no intent or peer conclusions')
  const critic = fs.readFileSync(path.join(runPath, 'critic-report.md'), 'utf8')
  collector.assert(/First-wave reviews were produced independently:\s*`?yes`?/i.test(critic) && /Blind reviewer isolation was preserved:\s*`?yes`?/i.test(critic), 'review.moderation-integrity', 'Critic must attest independent first waves and blind isolation')
  const judge = fs.readFileSync(path.join(runPath, 'cohesion-judge.md'), 'utf8')
  collector.assert(judge.includes(`Contract revision: \`${contract?.contractVersion}\``), 'review.judge-version', 'Cohesion Judge must target the frozen contract version')
}

function validateRun(runPath, { writeReport = true, phase = 'final' } = {}) {
  const collector = makeCollector()
  collector.assert(fs.existsSync(runPath) && fs.statSync(runPath).isDirectory(), 'run.directory', 'Production run directory must exist', runPath)
  if (!fs.existsSync(runPath) || !fs.statSync(runPath).isDirectory()) return buildReport(runPath, collector.checks)
  const markdownNames = phase === 'final' ? [...CONTRACT_MARKDOWN, ...FINAL_MARKDOWN] : CONTRACT_MARKDOWN
  const jsonNames = [
    ...CONTRACT_JSON,
    ...(phase === 'implementation' || phase === 'final' ? IMPLEMENTATION_JSON : []),
    ...(phase === 'final' ? FINAL_JSON : []),
  ]
  validateMarkdownArtifacts(runPath, markdownNames, collector)
  for (const name of jsonNames) collector.assert(fs.existsSync(path.join(runPath, name)), 'artifact.exists', `${name} is required`)
  collector.assert(fs.existsSync(path.join(runPath, 'director-notes.jsonl')), 'artifact.exists', 'director-notes.jsonl is required')
  for (const name of [...Object.values(PEER_NOTE_FILES), ...Object.values(RECONCILIATION_FILES)]) {
    collector.assert(fs.existsSync(path.join(runPath, name)), 'artifact.exists', `${name} is required to prove director authorship`)
  }
  for (const name of Object.values(SIGNOFF_FILES)) collector.assert(fs.existsSync(path.join(runPath, name)), 'artifact.exists', `${name} is required to prove director signoff authorship`)
  if (phase === 'final') collector.assert(fs.existsSync(path.join(runPath, 'iteration-ledger.jsonl')), 'artifact.exists', 'iteration-ledger.jsonl is required to prove repair and score lineage')

  const productionLock = readJson(path.join(runPath, 'production-lock.json'), collector, 'lock')
  const shippedVisualBaseline = readJson(path.join(runPath, 'shipped-visual-baseline.json'), collector, 'baseline')
  const contractPath = path.join(runPath, 'scene-contract.json')
  const contract = readJson(contractPath, collector, 'contract')
  const contractSha256 = fs.existsSync(contractPath) ? sha256File(contractPath) : null
  const signoffs = readJson(path.join(runPath, 'director-signoffs.json'), collector, 'signoffs')
  const individualSignoffs = Object.fromEntries(DIRECTORS.map((director) => [director, readJson(path.join(runPath, SIGNOFF_FILES[director]), collector, `${director}-signoff`)]))
  const notes = readJsonl(path.join(runPath, 'director-notes.jsonl'), collector)
  const peerNotesByDirector = Object.fromEntries(DIRECTORS.map((director) => [director, readJsonl(path.join(runPath, PEER_NOTE_FILES[director]), collector)]))
  const reconciliationsByDirector = Object.fromEntries(DIRECTORS.map((director) => [director, readJsonl(path.join(runPath, RECONCILIATION_FILES[director]), collector)]))
  const sceneSchema = readJson(path.join(resolveRepoRoot(), 'docs/architecture/workflow-orchestration/schemas/paravoxia-scene-contract.schema.json'), collector, 'scene-schema')
  const lockSchema = readJson(path.join(resolveRepoRoot(), 'docs/architecture/workflow-orchestration/schemas/paravoxia-production-lock.schema.json'), collector, 'lock-schema')
  const noteSchema = readJson(path.join(resolveRepoRoot(), 'docs/architecture/workflow-orchestration/schemas/paravoxia-director-note.schema.json'), collector, 'note-schema')
  const rubric = readJson(path.join(resolveRepoRoot(), 'docs/architecture/workflow-orchestration/rubrics/paravoxia-creative-cohesion.rubric.json'), collector, 'rubric')
  const workflow = readJson(path.join(resolveRepoRoot(), 'docs/architecture/workflow-orchestration/examples/paravoxia-creative-triad.workflow.json'), collector, 'workflow')

  validateWorkflowRoleContracts(workflow, collector)
  assertSchema(contract, sceneSchema, collector, 'contract.json-schema', 'Scene contract')
  notes.forEach((note, index) => assertSchema(note, noteSchema, collector, 'notes.json-schema', `Director note line ${index + 1}`))
  validateSceneContract(contract, collector)
  validateProductionLock(productionLock, lockSchema, contract, runPath, collector)
  validateShippedVisualBaseline(shippedVisualBaseline, contract, productionLock, runPath, collector)
  validateNotes(notes, contract, collector)
  validateDirectorAuthorship(peerNotesByDirector, reconciliationsByDirector, notes, contract, noteSchema, collector)
  validateSignoffs(signoffs, individualSignoffs, contract, contractSha256, collector)
  validateEvidenceReferences([contract, notes, shippedVisualBaseline], runPath, collector)

  if (phase === 'implementation' || phase === 'final') {
    validateImplementationDiff(runPath, productionLock, collector)
    const checkResults = readJson(path.join(runPath, 'check-results.json'), collector, 'check-results')
    validateCheckResults(checkResults, contract, contractSha256, productionLock, collector)
    validateEvidenceReferences([checkResults], runPath, collector)
  }

  if (phase === 'final') {
    const verification = readJson(path.join(runPath, 'verification-report.json'), collector, 'verification')
    const rawEvidence = readJson(path.join(runPath, 'raw-audiovisual-evidence.json'), collector, 'raw-evidence')
    const evidenceRegistry = readJson(path.join(runPath, 'evidence-registry.json'), collector, 'evidence-registry')
    const defects = readJson(path.join(runPath, 'defects.json'), collector, 'defects')
    const repairDisposition = readJson(path.join(runPath, 'repair-contract-disposition.json'), collector, 'repair-disposition')
    const iterations = readJsonl(path.join(runPath, 'iteration-ledger.jsonl'), collector, 'iteration-ledger.jsonl')
    const scorecard = readJson(path.join(runPath, 'final-scorecard.json'), collector, 'scorecard')
    const humanRequired = contract?.production?.mode === 'flagship' || productionLock?.releaseCandidate === true || defects?.requiresHumanTaste === true || contract?.evidence?.headedTaste?.required === true || (defects?.defects || []).some((defect) => defect.status === 'accepted-exception')
    const humanPath = path.join(runPath, 'human-decision.json')
    collector.assert(!humanRequired || fs.existsSync(humanPath), 'artifact.exists', 'human-decision.json is required for flagship or headed-taste work')
    const humanDecision = fs.existsSync(humanPath) ? readJson(humanPath, collector, 'human') : null
    for (const [label, artifact] of [['verification', verification], ['raw-audiovisual-evidence', rawEvidence], ['evidence-registry', evidenceRegistry], ['defects', defects], ['final-scorecard', scorecard], ['human-decision', humanDecision]]) {
      if (!artifact) continue
      collector.assert(artifact.contractVersion === contract?.contractVersion, 'artifact.contract-version', `${label} must target the frozen contract version`)
      collector.assert(artifact.runId === productionLock?.runId, 'artifact.run-id', `${label} must target the production-lock run ID`)
    }
    collector.assert(scorecard?.mode === contract?.production?.mode, 'scorecard.mode', 'Scorecard mode must match the scene contract mode')
    collector.assert(verification?.sourceRevision === productionLock?.sourceRevision, 'verification.source-revision', 'Verification source revision must match the production lock')
    collector.assert(rawEvidence?.sourceRevision === productionLock?.sourceRevision, 'raw-evidence.source-revision', 'Raw audiovisual evidence source revision must match the production lock')
    validateVerification(verification, contract, contractSha256, collector)
    validateRawAudiovisualEvidence(rawEvidence, contract, contractSha256, runPath, collector)
    const registryMap = validateEvidenceRegistry(evidenceRegistry, contract, contractSha256, productionLock, runPath, collector)
    validateScorecard(scorecard, rubric, contract, contractSha256, collector)
    validateReviewMetadata(runPath, contract, individualSignoffs, collector)
    if (humanDecision) validateHumanDecision(humanDecision, contract, contractSha256, collector)
    validateDefectRegister(defects, scorecard, contract, contractSha256, productionLock, humanDecision, runPath, collector)
    const repairDirections = validateRepairDisposition(repairDisposition, defects, contract, contractSha256, signoffs, productionLock, runPath, collector)
    const defectsPath = path.join(runPath, 'defects.json')
    validateIterationLedger(iterations, defects, fs.existsSync(defectsPath) ? sha256File(defectsPath) : null, scorecard, contract, contractSha256, productionLock, repairDisposition, runPath, collector)
    const checkResults = readJson(path.join(runPath, 'check-results.json'), collector, 'check-results-final-evidence')
    validateEvidenceReferences([contract, notes, shippedVisualBaseline, checkResults, verification, rawEvidence, defects, repairDisposition, repairDirections, iterations, scorecard, humanDecision], runPath, collector, registryMap)
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
    .replace(/\{\{([^}\n]+)\}\}/g, (_match, token) => {
      if (token.includes('CONTRACT_REVISION') || token === 'REVISION') return 'v1'
      if (token.includes('YES_OR_NO')) return 'yes'
      if (token.includes('FRESH_')) return `fixture-${name.replace('.md', '')}-reviewer`
      return `fixture evidence for ${name}`
    })
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
  const contractSha256 = sha256File(path.join(runPath, 'scene-contract.json'))
  const authorityPath = path.join(resolveRepoRoot(), 'PARAVOXIA_DEMO_FOUNDATION_PLAN.md')
  const productionLock = {
    schema: 'paravoxia.productionLock.v1', runId: 'fixture-run', mode: 'scene', status: 'locked', sourceRevision: 'fixture-working-tree', runProfileRef: 'paravoxia-creative-scene@v1', releaseCandidate: false,
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
  fs.appendFileSync(path.join(runPath, 'production-lock.md'), `\n## Fixture machine-lock mirror\n\n${[
    productionLock.runId,
    productionLock.mode,
    productionLock.sourceRevision,
    productionLock.runProfileRef,
    String(productionLock.releaseCandidate),
    productionLock.mutationBoundary,
    ...productionLock.authority.map((entry) => entry.path),
    ...productionLock.allowedPaths,
    ...productionLock.protectedPaths,
  ].join('\n')}\n`)
  const evidenceDirectory = path.join(runPath, 'evidence')
  fs.mkdirSync(evidenceDirectory)
  const runFfmpeg = (args, label) => {
    const result = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', ...args], { encoding: 'utf8' })
    if (result.status !== 0) throw new Error(`Could not create ${label}: ${result.stderr}`)
  }
  runFfmpeg(['-f', 'lavfi', '-i', 'color=c=0x102018:s=64x64:r=10:d=1', '-an', '-c:v', 'libvpx-vp9', path.join(evidenceDirectory, 'baseline.webm')], 'baseline video')
  runFfmpeg(['-f', 'lavfi', '-i', 'color=c=0x193326:s=64x64:r=10:d=1', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=1', '-shortest', '-c:v', 'libvpx-vp9', '-c:a', 'libopus', path.join(evidenceDirectory, 'scene.webm')], 'scene video')
  runFfmpeg(['-f', 'lavfi', '-i', 'color=c=0x7dfca5:s=64x32', '-frames:v', '1', path.join(evidenceDirectory, 'frames.png')], 'frame strip')
  runFfmpeg(['-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=1', '-c:a', 'pcm_s16le', path.join(evidenceDirectory, 'audio.wav')], 'audio evidence')
  const fixtureProbe = (name) => {
    const probeCollector = makeCollector()
    const summary = probeMedia(path.join(evidenceDirectory, name), probeCollector, name)
    const failure = probeCollector.checks.find((check) => !check.passed)
    if (!summary || failure) throw new Error(`Could not probe ${name}: ${failure?.message || 'unknown failure'}`)
    return summary
  }
  const baselineProbe = fixtureProbe('baseline.webm')
  const sceneProbe = fixtureProbe('scene.webm')
  const frameProbe = fixtureProbe('frames.png')
  const audioProbe = fixtureProbe('audio.wav')
  fs.writeFileSync(path.join(runPath, 'shipped-visual-baseline.json'), `${JSON.stringify({
    schema: 'paravoxia.shippedVisualBaseline.v1', runId: 'fixture-run', sourceRevision: 'fixture-working-tree', sceneId: 'fixture-a3-dawn', capturedAt: '2026-07-13T11:50:00.000Z', captureAuthority: 'current shipped runtime before implementation',
    captures: [{ path: 'evidence/baseline.webm', sha256: sha256File(path.join(evidenceDirectory, 'baseline.webm')), probe: baselineProbe, beat: contract.scope.beats[0], anchor: 'replace-anchor-start', kind: 'continuous-video', viewport: '1440x900', qualityTier: 'high' }],
    cameraStates: [{ beat: contract.scope.beats[0], anchor: 'replace-anchor-start', authority: 'lens-rig', fovDeg: 50, sourceRef: 'main/src/story/sideLens.ts' }],
    paletteStates: [{ beat: contract.scope.beats[0], anchor: 'replace-anchor-start', family: 'material-dawn', sourceRefs: ['main/src/utils/planetArtDirection.ts', 'main/src/utils/planetVisualProfile.ts'] }],
    realityStage: 'alive', adjacentEntryRefs: ['frame:previous'], adjacentExitRefs: ['frame:next'], headedStatus: 'pending',
  }, null, 2)}\n`)
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
  for (const director of DIRECTORS) {
    const firstWave = notes.filter((note) => note.from === director).map((note) => ({ ...note, status: 'open', response: null, disposition: null, updatedAt: note.createdAt }))
    fs.writeFileSync(path.join(runPath, PEER_NOTE_FILES[director]), `${firstWave.map((note) => JSON.stringify(note)).join('\n')}\n`)
    const reconciliations = notes.filter((note) => note.to === director).map((note) => ({
      schema: 'paravoxia.directorReconciliation.v1', contractVersion: 'v1', director, noteId: note.id, status: note.status,
      response: note.response, disposition: note.disposition, respondedAt: note.response.respondedAt,
    }))
    fs.writeFileSync(path.join(runPath, RECONCILIATION_FILES[director]), `${reconciliations.map((entry) => JSON.stringify(entry)).join('\n')}\n`)
  }
  const individualSignoff = (director) => ({ schema: 'paravoxia.directorSignoff.v1', director, contractVersion: 'v1', contractSha256, disposition: 'approve', signedBy: `${director}-director`, signedAt: '2026-07-13T12:00:00.000Z' })
  const compiledSignoff = (entry) => ({ disposition: entry.disposition, revision: entry.contractVersion, contractSha256: entry.contractSha256, signedBy: entry.signedBy, signedAt: entry.signedAt })
  const fixtureSignoffs = Object.fromEntries(DIRECTORS.map((director) => [director, individualSignoff(director)]))
  for (const director of DIRECTORS) fs.writeFileSync(path.join(runPath, SIGNOFF_FILES[director]), `${JSON.stringify(fixtureSignoffs[director], null, 2)}\n`)
  fs.writeFileSync(path.join(runPath, 'director-signoffs.json'), `${JSON.stringify({ schema: 'paravoxia.directorSignoffs.v1', contractRevision: 'v1', contractSha256, sameRevision: true, chapter: compiledSignoff(fixtureSignoffs.chapter), score: compiledSignoff(fixtureSignoffs.score), cinematography: compiledSignoff(fixtureSignoffs.cinematography) }, null, 2)}\n`)
  fs.writeFileSync(path.join(runPath, 'verification-report.json'), `${JSON.stringify({
    schema: 'paravoxia.sceneVerificationReport.v1', runId: 'fixture-run', contractVersion: 'v1', contractSha256, generatedAt: '2026-07-13T12:30:00.000Z', sourceRevision: 'fixture-working-tree', canonicalUrl: 'http://127.0.0.1:5201/',
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
  const mediaEntry = (name) => ({
    path: `evidence/${name}`,
    sha256: sha256File(path.join(evidenceDirectory, name)),
  })
  fs.writeFileSync(path.join(runPath, 'raw-audiovisual-evidence.json'), `${JSON.stringify({
    schema: 'paravoxia.rawAudiovisualEvidence.v1', runId: 'fixture-run', contractVersion: 'v1', contractSha256, sourceRevision: 'fixture-working-tree', capturedAt: '2026-07-13T12:35:00.000Z', containsCreativeIntent: false,
    continuousVideo: { ...mediaEntry('scene.webm'), durationSeconds: sceneProbe.durationSeconds, probe: sceneProbe, startAnchor: 'replace-anchor-start', endAnchor: 'replace-anchor-end' },
    frameStrips: [{ ...mediaEntry('frames.png'), probe: frameProbe, anchors: ['replace-anchor-start', 'replace-anchor-end'], variant: 'desktop' }],
    audio: [{ ...mediaEntry('audio.wav'), probe: audioProbe, startAnchor: 'replace-anchor-start', endAnchor: 'replace-anchor-end', disposition: 'protected-regression-capture' }],
    playbackMetadata: { canonicalUrl: 'http://127.0.0.1:5201/', viewport: '1440x900', qualityTier: 'high', reducedMotion: false, audioRoute: 'headphones', instructions: 'Play once continuously before frame inspection.' },
    intentFreeInstructions: 'Do not read creative intent, source, contracts, notes, bibles, or other reviews before the blind first pass.',
  }, null, 2)}\n`)
  const rubric = JSON.parse(fs.readFileSync(path.join(resolveRepoRoot(), 'docs/architecture/workflow-orchestration/rubrics/paravoxia-creative-cohesion.rubric.json'), 'utf8'))
  const categories = rubric.categories.map((category) => ({ slug: category.slug, weight: category.weight, score: 4.8, rationale: 'Independent evidence supports the score.', evidenceRefs: [`evidence:${category.slug}`], defectRefs: [] }))
  fs.writeFileSync(path.join(runPath, 'final-scorecard.json'), `${JSON.stringify({ schema: 'paravoxia.creativeScorecard.v1', runId: 'fixture-run', contractVersion: 'v1', contractSha256, mode: 'scene', rubricRef: 'paravoxia-creative-cohesion@v1', categories, weightedScore: 4.8, categoryFloor: 4.8, fullCategoryCoverage: true, thresholds: { sceneWeighted: 4.75, sceneFloor: 4.3, flagshipWeighted: 4.8, flagshipFloor: 4.5 }, openDefects: { critical: 0, high: 0, mediumUnaccepted: 0, low: 0 }, decision: 'approved', judge: 'fixture-cohesion-judge', judgedAt: '2026-07-13T12:40:00.000Z' }, null, 2)}\n`)
  const defectSourceNames = ['story-audit.md', 'score-audit.md', 'cinematography-audit.md', 'naive-audience-report.md', 'critic-report.md']
  const defectRegister = {
    schema: 'paravoxia.creativeDefectRegister.v1', runId: 'fixture-run', contractVersion: 'v1', contractSha256,
    compiledAt: '2026-07-13T12:39:00.000Z', compiledBy: 'fixture-review-moderator',
    sourceReports: defectSourceNames.map((name) => ({ path: name, sha256: sha256File(path.join(runPath, name)) })),
    requiresHumanTaste: false, defects: [],
  }
  fs.writeFileSync(path.join(runPath, 'defects.json'), `${JSON.stringify(defectRegister, null, 2)}\n`)
  const defectRegisterSha256 = sha256File(path.join(runPath, 'defects.json'))
  fs.writeFileSync(path.join(runPath, 'repair-contract-disposition.json'), `${JSON.stringify({
    schema: 'paravoxia.repairContractDisposition.v1', runId: 'fixture-run', baseContractVersion: 'v1', activeContractVersion: 'v1', activeContractSha256: contractSha256,
    defectRegisterSha256, contractChangeRequired: false, route: 'no-repair', directionRefs: [], triadResignRequired: false, triadResignComplete: false,
    decidedBy: 'fixture-creative-producer', decidedAt: '2026-07-13T12:41:00.000Z',
  }, null, 2)}\n`)
  fs.writeFileSync(path.join(runPath, 'iteration-ledger.jsonl'), `${JSON.stringify({
    schema: 'paravoxia.creativeIteration.v1', runId: 'fixture-run', iteration: 0, contractVersion: 'v1', contractRef: 'scene-contract.json', contractSha256, defectRegisterRef: 'defects.json', defectRegisterSha256,
    route: 'initial-pass', budget: 'fixture', changes: ['fixture implementation'], weightedScore: 4.8, categoryFloor: 4.8, gateStatus: 'passed',
    openDefects: { critical: 0, high: 0, mediumUnaccepted: 0, low: 0 }, evidenceRefs: ['evidence:fixture-final'], canonicalUrl: 'http://127.0.0.1:5201/', nextAction: 'close', recordedAt: '2026-07-13T12:42:00.000Z',
  })}\n`)
  fs.writeFileSync(path.join(runPath, 'implementation.diff'), 'diff --git a/main/tools/creative-triad-gate.mjs b/main/tools/creative-triad-gate.mjs\n--- a/main/tools/creative-triad-gate.mjs\n+++ b/main/tools/creative-triad-gate.mjs\n@@ -1 +1 @@\n-fixture-before\n+fixture-after\n')
  const passedCheck = (ref) => ({ status: 'pass', evidenceRefs: [ref] })
  fs.writeFileSync(path.join(runPath, 'check-results.json'), `${JSON.stringify({
    schema: 'paravoxia.checkResults.v1', runId: 'fixture-run', contractVersion: 'v1', contractSha256, sourceRevision: 'fixture-working-tree',
    productionScope: passedCheck('scope:diff-audit'), creativeContract: passedCheck('gate:contract'), typecheck: passedCheck('log:typecheck'), tests: passedCheck('log:tests'), build: passedCheck('log:build'),
    commands: [{ command: 'npm run verify', status: 'pass', exitCode: 0, evidenceRef: 'log:verify' }],
  }, null, 2)}\n`)
  const registryProofPath = path.join(evidenceDirectory, 'registry-proof.txt')
  fs.writeFileSync(registryProofPath, 'Fixture evidence registry backing file. Real runs point each reference to its actual trace, frame, audio, log, or performance artifact.\n')
  const evidenceValues = [
    contract,
    notes,
    JSON.parse(fs.readFileSync(path.join(runPath, 'shipped-visual-baseline.json'), 'utf8')),
    JSON.parse(fs.readFileSync(path.join(runPath, 'check-results.json'), 'utf8')),
    JSON.parse(fs.readFileSync(path.join(runPath, 'verification-report.json'), 'utf8')),
    JSON.parse(fs.readFileSync(path.join(runPath, 'raw-audiovisual-evidence.json'), 'utf8')),
    defectRegister,
    JSON.parse(fs.readFileSync(path.join(runPath, 'repair-contract-disposition.json'), 'utf8')),
    readJsonl(path.join(runPath, 'iteration-ledger.jsonl'), makeCollector()),
    JSON.parse(fs.readFileSync(path.join(runPath, 'final-scorecard.json'), 'utf8')),
  ]
  const registryRefs = [...new Set(collectEvidenceRefs(evidenceValues))]
    .filter((ref) => /^[a-z][a-z0-9_-]*:.+/i.test(ref) && !/^(?:file|path|contract):/i.test(ref))
    .sort()
  fs.writeFileSync(path.join(runPath, 'evidence-registry.json'), `${JSON.stringify({
    schema: 'paravoxia.evidenceRegistry.v1', runId: 'fixture-run', contractVersion: 'v1', contractSha256, sourceRevision: 'fixture-working-tree', compiledAt: '2026-07-13T12:43:00.000Z',
    entries: registryRefs.map((ref) => ({ ref, path: 'evidence/registry-proof.txt', sha256: sha256File(registryProofPath), kind: ref.split(':')[0], description: `Fixture backing evidence for ${ref}.` })),
  }, null, 2)}\n`)
}

function runSelfTest() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'paravoxia-creative-gate-'))
  try {
    makeValidFixture(tempRoot)
    const validContract = validateRun(tempRoot, { writeReport: false, phase: 'contract' })
    if (!validContract.passed) throw new Error(`Completed template failed contract phase:\n${validContract.checks.filter((check) => !check.passed).map((check) => `${check.code}: ${check.message}`).join('\n')}`)
    const validImplementation = validateRun(tempRoot, { writeReport: false, phase: 'implementation' })
    if (!validImplementation.passed) throw new Error(`Completed template failed implementation phase:\n${validImplementation.checks.filter((check) => !check.passed).map((check) => `${check.code}: ${check.message}`).join('\n')}`)
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
    const misrepresentedAgency = JSON.parse(originalContractSource)
    misrepresentedAgency.story.agencyWindows[0].fallbackAllowed = true
    misrepresentedAgency.story.agencyWindows[0].fallbackCountsAsNarrativeAcceptance = true
    fs.writeFileSync(contractPath, JSON.stringify(misrepresentedAgency))
    const invalidAgency = validateRun(tempRoot, { writeReport: false, phase: 'contract' })
    if (invalidAgency.passed || !invalidAgency.checks.some((check) => check.code === 'contract.fallback-acceptance' && !check.passed)) {
      throw new Error('Invalid fixture did not reject an automated fallback counted as narrative acceptance')
    }
    fs.writeFileSync(contractPath, originalContractSource)
    const notesPath = path.join(tempRoot, 'director-notes.jsonl')
    const originalNotesSource = fs.readFileSync(notesPath, 'utf8')
    const selfClosedNotes = originalNotesSource.trim().split(/\r?\n/).map(JSON.parse)
    selfClosedNotes[0].disposition.decidedBy = selfClosedNotes[0].from
    fs.writeFileSync(notesPath, `${selfClosedNotes.map((note) => JSON.stringify(note)).join('\n')}\n`)
    const selfClosed = validateRun(tempRoot, { writeReport: false, phase: 'contract' })
    if (selfClosed.passed || !selfClosed.checks.some((check) => check.code === 'notes.self-close' && !check.passed)) {
      throw new Error('Invalid fixture did not reject a director closing its own note')
    }
    fs.writeFileSync(notesPath, originalNotesSource)

    const defectsPath = path.join(tempRoot, 'defects.json')
    const originalDefectsSource = fs.readFileSync(defectsPath, 'utf8')
    const hiddenDefectRegister = JSON.parse(originalDefectsSource)
    hiddenDefectRegister.defects.push({
      id: 'defect-hidden-critical', severity: 'critical', category: 'implementation_fidelity', status: 'open', owner: 'integration', anchor: 'replace-anchor-start',
      statement: 'A critical defect is present despite the scorecard claiming zero.', evidenceRefs: ['trace:hidden-critical'], requestedRepair: 'Repair and reverify the defect.', verificationRoute: 'trace and independent review',
      sourceReportRefs: ['critic-report.md'], iterationIntroduced: 0, iterationResolved: null, acceptedExceptionRef: null,
    })
    fs.writeFileSync(defectsPath, `${JSON.stringify(hiddenDefectRegister, null, 2)}\n`)
    const hiddenDefect = validateRun(tempRoot, { writeReport: false, phase: 'final' })
    if (hiddenDefect.passed || !hiddenDefect.checks.some((check) => check.code === 'defects.scorecard-counts' && !check.passed)) {
      throw new Error('Invalid fixture did not reject a hidden critical defect omitted from the scorecard')
    }
    fs.writeFileSync(defectsPath, originalDefectsSource)

    const repairPath = path.join(tempRoot, 'repair-contract-disposition.json')
    const originalRepairSource = fs.readFileSync(repairPath, 'utf8')
    const bypassedRepair = JSON.parse(originalRepairSource)
    bypassedRepair.contractChangeRequired = true
    bypassedRepair.route = 'revised-and-resigned'
    bypassedRepair.baseContractVersion = 'v0'
    bypassedRepair.triadResignRequired = true
    bypassedRepair.triadResignComplete = true
    fs.writeFileSync(repairPath, `${JSON.stringify(bypassedRepair, null, 2)}\n`)
    const unsignedRepair = validateRun(tempRoot, { writeReport: false, phase: 'final' })
    if (unsignedRepair.passed || !unsignedRepair.checks.some((check) => check.code === 'repair.lineage' && !check.passed)) {
      throw new Error('Invalid fixture did not reject a contract-changing repair without valid revision lineage')
    }
    fs.writeFileSync(repairPath, originalRepairSource)

    const directorOverride = JSON.parse(originalRepairSource)
    directorOverride.directionRefs = ['chapter-repair-direction.json']
    fs.writeFileSync(path.join(tempRoot, 'chapter-repair-direction.json'), `${JSON.stringify({
      schema: 'paravoxia.directorRepairDirection.v1', director: 'chapter', runId: 'fixture-run', contractVersion: 'v1', contractSha256: sha256File(contractPath),
      defectIds: ['defect-producer-tried-to-hide'], contractChangeRequired: true, boundedActions: ['Re-contract the narrative intent.'], evidenceRefs: ['log:tests'], verificationRoute: 'full triad re-contract and independent review',
      authoredBy: 'chapter-director', authoredAt: '2026-07-13T12:44:00.000Z',
    }, null, 2)}\n`)
    fs.writeFileSync(repairPath, `${JSON.stringify(directorOverride, null, 2)}\n`)
    const producerOverride = validateRun(tempRoot, { writeReport: false, phase: 'final' })
    if (producerOverride.passed || !producerOverride.checks.some((check) => check.code === 'repair.derived-contract-change' && !check.passed)) {
      throw new Error('Invalid fixture did not reject a producer overriding a director contract-change classification')
    }
    fs.rmSync(path.join(tempRoot, 'chapter-repair-direction.json'))
    fs.writeFileSync(repairPath, originalRepairSource)

    const registryPath = path.join(tempRoot, 'evidence-registry.json')
    const originalRegistrySource = fs.readFileSync(registryPath, 'utf8')
    const incompleteRegistry = JSON.parse(originalRegistrySource)
    incompleteRegistry.entries.shift()
    fs.writeFileSync(registryPath, `${JSON.stringify(incompleteRegistry, null, 2)}\n`)
    const missingRegistryRef = validateRun(tempRoot, { writeReport: false, phase: 'final' })
    if (missingRegistryRef.passed || !missingRegistryRef.checks.some((check) => check.code === 'evidence.registry-ref' && !check.passed)) {
      throw new Error('Invalid fixture did not reject an unresolved typed evidence reference')
    }
    fs.writeFileSync(registryPath, originalRegistrySource)

    const rawPath = path.join(tempRoot, 'raw-audiovisual-evidence.json')
    const spoofedRaw = JSON.parse(fs.readFileSync(rawPath, 'utf8'))
    const spoofedFramePath = path.join(tempRoot, spoofedRaw.frameStrips[0].path)
    fs.writeFileSync(spoofedFramePath, Buffer.alloc(0))
    spoofedRaw.frameStrips[0].sha256 = sha256File(spoofedFramePath)
    fs.writeFileSync(rawPath, `${JSON.stringify(spoofedRaw, null, 2)}\n`)
    const spoofedMedia = validateRun(tempRoot, { writeReport: false, phase: 'final' })
    if (spoofedMedia.passed || !spoofedMedia.checks.some((check) => check.code === 'media.probe-command' && !check.passed)) {
      throw new Error('Invalid fixture did not reject non-media bytes with a matching file hash')
    }
    process.stdout.write(`Creative triad gate self-test passed (${valid.checkCount} final checks; staged gates plus anchor, agency-fallback, authorship, hidden-defect, repair-lineage, director-override, evidence-registry, and media-authenticity rejection confirmed).\n`)
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
