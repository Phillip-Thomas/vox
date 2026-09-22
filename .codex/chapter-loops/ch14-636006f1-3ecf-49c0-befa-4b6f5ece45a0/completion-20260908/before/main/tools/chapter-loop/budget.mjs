import fs from 'node:fs';
import path from 'node:path';
import { requireThat, adaptiveBudget } from './contract.mjs';
import { readJson, writeJson, acquireLock } from './store.mjs';

export const MAX_CHAPTER_MS = 8 * 60 * 60 * 1000;

export function commandDeadline(state, now = Date.now()) {
  // An expired planning target must not become a one-millisecond probe timeout.
  // Each probe/build retains its own bounded operational timeout.
  return adaptiveBudget(state) ? new Date(now + 2 * 60 * 60 * 1000).toISOString() : elapsedClock(state, now).deadlineAt;
}

export function budgetGuidance(state, { roleItems = 0, roleElapsedMs = 0, firstPlayable = false, now = Date.now() } = {}) {
  const clock = elapsedClock(state, now);
  const measures = { ...state.usage, roleTurns: roleItems, roleMs: roleElapsedMs, modelTurns: state.usage.modelTurns,
    roleLaunches: state.usage.roleLaunches, activeMs: state.activeMs + roleElapsedMs, endToEndMs: clock.elapsedMs,
    ...(!firstPlayable ? { firstPlayableMs: Math.max(0, state.limits.firstPlayableMs + now - firstPlayableDeadline(state)) } : {}) };
  const targets = Object.fromEntries(Object.entries(measures).map(([key, used]) => [key,
    { used, target: state.limits[key], remaining: Math.max(0, state.limits[key] - used), exceeded: used >= state.limits[key] }]));
  const near = Object.entries(targets).filter(([, v]) => v.used >= v.target * .8).map(([key]) => key);
  return { mode: adaptiveBudget(state) ? 'adaptive' : 'strict', targets, nearing: near,
    action: near.length ? 'finish-existing-work' : 'build-playable-first',
    instruction: near.length
      ? 'Save progress.md with changed paths, exact outstanding defects, evidence and the next action. Stop optional exploration and polish. Reuse passing checks; finish the current implementation and required proof. Scheduling overruns do not terminate generation.'
      : 'Prioritize a complete playable path. Batch bounded reads; avoid repeated broad inspection. Check this file every few tool calls and before starting optional work.',
    accountingGaps: state.accountingGaps ?? [] };
}

export function firstPlayableDeadline(state) {
  const explicit = state.finishRenewals?.at(-1)?.firstPlayableDeadlineAt ?? state.providerHandoffs?.at(-1)?.firstPlayableDeadlineAt;
  return Math.min(explicit ? Date.parse(explicit) : Date.parse(state.clock?.startedAt ?? state.createdAt) + state.limits.firstPlayableMs,
    Date.parse(elapsedClock(state).deadlineAt));
}

// Open this clock as the first action on the owner's chapter request, before
// brief preparation. It survives process exits, waits, repairs and restarts.
export function beginChapter(repo, chapter, { startedAt, now = Date.now() } = {}) {
  requireThat(/^ch[0-9]+[a-z0-9-]*$/.test(chapter), 'Chapter id required');
  const root = path.join(repo, '.codex/chapter-loops');
  const unlock = acquireLock(path.join(root, '.clock.lock'));
  try {
    const file = path.join(root, 'clocks', `${chapter}.json`);
    if (fs.existsSync(file)) return readJson(file);
    const indexFile = path.join(root, 'chapters.json');
    const index = fs.existsSync(indexFile) ? readJson(indexFile) : {};
    const existing = index[chapter] ? readJson(path.join(repo, index[chapter], 'state.json')) : null;
    const start = existing ? Date.parse(existing.clock?.startedAt ?? existing.createdAt)
      : startedAt ? Date.parse(startedAt) : now;
    requireThat(Number.isFinite(start) && start <= now, 'Chapter start must be a real, non-future timestamp');
    const clock = { schema: 'paravoxia.chapterClock.v1', chapter, startedAt: new Date(start).toISOString(),
      deadlineAt: new Date(start + MAX_CHAPTER_MS).toISOString(), maxElapsedMs: MAX_CHAPTER_MS,
      existingRun: index[chapter] ?? null };
    writeJson(file, clock); return clock;
  } finally { unlock(); }
}

export function elapsedClock(state, now = Date.now()) {
  const start = Date.parse(state.clock?.startedAt ?? state.createdAt);
  const limit = Math.min(MAX_CHAPTER_MS, state.limits?.endToEndMs ?? MAX_CHAPTER_MS);
  requireThat(Number.isFinite(start), 'Chapter clock is missing');
  return { startedAt: new Date(start).toISOString(), elapsedMs: Math.max(0, now - start),
    limitMs: limit, remainingMs: Math.max(0, start + limit - now), deadlineAt: new Date(start + limit).toISOString() };
}
