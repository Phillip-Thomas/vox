import { isDeepStrictEqual } from 'node:util';

function missingMarkerBecameReady(before, after) {
  return before?.objective?.health === 'missing-marker'
    && after?.objective?.health === 'ready'
    && isDeepStrictEqual(
      { ...before, objective: { ...before.objective, health: 'ready' } },
      after
    );
}

/** Only the original marker-readiness exception; no copy, policy or action waiver. */
export function classifyLadderDifference(before, after, { allowHealth = false } = {}) {
  if (isDeepStrictEqual(before, after)) return { allowed: true, unchanged: true, dropped: 0, missing: [] };
  const oldIds = new Set(before.map(row => row.objective?.id).filter(Boolean));
  const newIds = new Set(after.map(row => row.objective?.id).filter(Boolean));
  const missing = [...oldIds].filter(id => !newIds.has(id));
  if (allowHealth && missing.length === 0) {
    const dropped = before.length - after.length;
    if (after.length > 0 && dropped >= 0 && dropped <= 2
      && before.slice(0, dropped).every(row => missingMarkerBecameReady(row, after[0]))
      && before.slice(dropped).every((row, i) =>
        isDeepStrictEqual(row, after[i]) || missingMarkerBecameReady(row, after[i]))) {
      return { allowed: true, unchanged: false, dropped, missing };
    }
  }
  return { allowed: false, unchanged: false, dropped: 0, missing };
}
