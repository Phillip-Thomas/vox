// The creation contract is deliberately independent of model vendors and CLIs.
import { createHash } from 'node:crypto';

export const VERSION = 'paravoxia.chapterLoop.v1';
export const TERMINAL = new Set(['READY_FOR_REVIEW', 'NEEDS_REVISION', 'BLOCKED_INFRASTRUCTURE', 'BLOCKED_CONTRACT', 'BUDGET_EXHAUSTED', 'STOPPED']);
export const DEFAULT_LIMITS = Object.freeze({
  activeMs: 8 * 60 * 60 * 1000, endToEndMs: 8 * 60 * 60 * 1000, firstPlayableMs: 90 * 60 * 1000,
  roleLaunches: 14, modelTurns: 400, inputTokens: 1_000_000,
  cacheReadTokens: 20_000_000, outputTokens: 250_000,
  roleMs: 45 * 60 * 1000, roleTurns: 60, contextTokens: 32_000,
  promptBytes: 48_000, transcriptBytes: 16_000_000,
  lookCycles: 3, listenCycles: 2, infrastructureRetries: 1,
});
export const ROLES = Object.freeze({
  plan: { commission: 'chapter', inputs: ['brief', 'canon'], lane: 'creative' },
  cinema: { commission: 'cinema', inputs: ['brief', 'canon', 'plan'], lane: 'creative' },
  'score-plan': { commission: 'score', inputs: ['brief', 'canon', 'plan'], lane: 'creative' },
  council: { commission: 'council', inputs: ['brief', 'canon', 'plan', 'cinema', 'score-plan'], lane: 'creative' },
  build: { commission: 'builder', inputs: ['brief', 'recipe'], lane: 'creative', writes: true, observe: 'look' },
  compose: { commission: 'composer', inputs: ['brief', 'recipe', 'build'], lane: 'creative', writes: true, observe: 'listen' },
  player: { commission: 'player', inputs: ['playerEvidence'], lane: 'mechanical', blind: true },
  av: { commission: 'av', inputs: ['avEvidence'], lane: 'creative', blind: true },
  canon: { commission: 'continuity', inputs: ['canon', 'recipe', 'evidence'], lane: 'mechanical' },
  refine: { commission: 'refiner', inputs: ['brief', 'recipe', 'findings', 'evidence'], lane: 'creative', writes: true },
});
export const INITIAL = ['plan', 'cinema', 'score-plan', 'council', 'build', 'compose', 'verify', 'player', 'av', 'canon', 'decide'];
export const FINAL = ['refine', 'verify-final', 'player-final', 'av-final', 'canon-final', 'finish'];
export const roleFor = stage => ROLES[stage.replace(/-final$/, '')];
export const sha = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
export function requireThat(ok, message) { if (!ok) throw new Error(message); }
export const emptyUsage = () => ({ roleLaunches: 0, modelTurns: 0, inputTokens: 0, cacheReadTokens: 0, outputTokens: 0 });
export const adaptiveBudget = state => state.budgetPolicy?.mode === 'adaptive';
export const advisoryTokens = state => adaptiveBudget(state) && state.budgetPolicy?.tokens === 'advisory';
export const SCHEDULING_TARGETS = new Set(['activeMs', 'endToEndMs', 'firstPlayableMs', 'roleMs', 'roleTurns', 'roleLaunches', 'modelTurns', 'lookCycles', 'listenCycles']);

export function limitsFor(overrides = {}) {
  requireThat(Object.keys(overrides).every(k => k in DEFAULT_LIMITS), 'Unknown budget key');
  const limits = { ...DEFAULT_LIMITS, ...overrides };
  for (const [key, value] of Object.entries(limits)) {
    requireThat(Number.isSafeInteger(value) && value > 0, `Budget ${key} must be a positive integer`);
    requireThat(value <= DEFAULT_LIMITS[key], `Budget ${key} cannot exceed the chapter profile`);
  }
  return limits;
}
export function budgetReason(state, elapsedMs = 0) {
  if (!adaptiveBudget(state) && state.activeMs + elapsedMs >= state.limits.activeMs) return 'activeMs';
  return Object.keys(emptyUsage()).find(k => !(adaptiveBudget(state) && SCHEDULING_TARGETS.has(k))
    && !(advisoryTokens(state) && ['inputTokens', 'cacheReadTokens', 'outputTokens'].includes(k))
    && !(k === 'roleLaunches' && state.activeRole) && state.usage[k] >= state.limits[k]) ?? null;
}
export function addUsage(state, delta) {
  for (const key of Object.keys(emptyUsage())) {
    const value = delta[key] ?? 0;
    requireThat(Number.isFinite(value) && value >= 0, `Invalid measured usage: ${key}`);
    state.usage[key] += value;
  }
}
export function nextStage(state) {
  return TERMINAL.has(state.status) ? null : state.queue[state.cursor] ?? null;
}
export function beginRole(state, stage) {
  requireThat(nextStage(state) === stage && roleFor(stage), 'Out-of-order or non-role dispatch');
  requireThat(!state.activeRole, 'A role is already active');
  requireThat(!budgetReason(state), 'Budget exhausted');
  addUsage(state, { roleLaunches: 1 });
  state.activeRole = stage;
}
export function advance(state, stage) {
  requireThat(nextStage(state) === stage, 'Out-of-order completion');
  state.activeRole = null;
  state.cursor++;
}
export function validRef(ref) {
  return ref && typeof ref.path === 'string' && /^[a-f0-9]{64}$/.test(ref.sha256);
}
function text(value, label, min = 12) {
  requireThat(typeof value === 'string' && value.trim().length >= min, `${label} needs substantive text`);
}
export function validateResult(stage, result, { candidate, sessions = [] } = {}) {
  requireThat(result?.schema === 'paravoxia.chapterLoopRole.v1', 'Missing role result schema');
  text(result.summary, 'summary');
  requireThat(['PASS', 'REVISE', 'BLOCKED'].includes(result.verdict), 'Invalid role verdict');
  requireThat(Array.isArray(result.evidence) && result.evidence.every(validRef), 'Evidence needs paths and hashes');
  requireThat(Array.isArray(result.findings) && Array.isArray(result.keep), 'findings and keep must be arrays');
  for (const finding of result.findings) {
    requireThat(['blocking', 'major', 'minor'].includes(finding.severity), 'Invalid finding severity');
    text(finding.description, 'finding');
    requireThat(Array.isArray(finding.evidence) && finding.evidence.length > 0 && finding.evidence.every(validRef), 'Finding needs actual evidence');
  }
  if (['plan', 'cinema', 'score-plan'].includes(stage)) {
    requireThat(result.direction && typeof result.direction === 'object', 'Creative direction is required');
    requireThat(Array.isArray(result.anchors) && result.anchors.length > 0 && result.anchors.every(x => typeof x === 'string'), 'Named event anchors required');
  }
  if (stage === 'plan') {
    for (const key of ['dramaticQuestion', 'playerActions', 'entryState', 'exitState', 'signatureMoment']) {
      requireThat(result.direction[key] != null && JSON.stringify(result.direction[key]).length >= 8, `Plan missing ${key}`);
    }
  }
  if (stage === 'council') requireThat(result.acceptedRecipeSha256 === candidate, 'Council must bind the exact three-lane recipe');
  if (['player', 'av', 'canon'].includes(stage.replace(/-final$/, ''))) {
    requireThat(result.candidateSha256 === candidate, 'Review belongs to another candidate');
    requireThat(result.evidence.length > 0, 'Review has no evidence');
    const keys = stage.startsWith('player') ? ['discoverability', 'agency', 'recovery']
      : stage.startsWith('av') ? ['composition', 'motion', 'music', 'cohesion'] : ['causality', 'characterKnowledge', 'continuity'];
    for (const key of keys) requireThat(Number.isFinite(result.scores?.[key]) && result.scores[key] >= 1 && result.scores[key] <= 5, `Missing score ${key}`);
    requireThat(result.session && !sessions.includes(result.session), 'Review must use a fresh independent session');
    if (result.verdict === 'PASS') {
      requireThat(!result.findings.some(x => x.severity !== 'minor'), 'A PASS cannot contain blocking or major findings');
      requireThat(keys.every(k => result.scores[k] >= 4), 'PASS requires every experience category >=4/5');
    }
  }
  return result;
}
export function collectFindings(reviews) {
  return {
    findings: reviews.flatMap(r => r.findings).sort((a, b) => ['blocking', 'major', 'minor'].indexOf(a.severity) - ['blocking', 'major', 'minor'].indexOf(b.severity)),
    keep: [...new Set(reviews.flatMap(r => r.keep))],
    needsRefinement: reviews.some(r => r.verdict !== 'PASS'),
  };
}
export function decision(state, reviews, final = false) {
  const findings = collectFindings(reviews);
  if (final || !findings.needsRefinement) {
    state.status = findings.needsRefinement ? 'NEEDS_REVISION' : 'READY_FOR_REVIEW';
  } else {
    requireThat(!state.refinementUsed, 'Refinement cannot reopen');
    state.refinementUsed = true;
    state.queue.push(...FINAL);
  }
  return findings;
}
