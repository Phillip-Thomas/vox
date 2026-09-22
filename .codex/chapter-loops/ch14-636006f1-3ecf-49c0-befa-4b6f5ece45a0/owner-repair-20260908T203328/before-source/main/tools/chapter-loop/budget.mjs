import fs from 'node:fs';
import path from 'node:path';
import { requireThat } from './contract.mjs';
import { readJson, writeJson, acquireLock } from './store.mjs';

export const MAX_CHAPTER_MS = 8 * 60 * 60 * 1000;

export function firstPlayableDeadline(state) {
  const explicit = state.providerHandoffs?.at(-1)?.firstPlayableDeadlineAt;
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
