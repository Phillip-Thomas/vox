import { AUTOMATION_CADENCE_S, AUTOMATION_EPSILON } from './mixTuning.ts';

/** The last write of one automation lane (the legacy engine's layer or procedural targets). */
export interface AutomationWrite {
  /** Seconds (performance clock) when the lane was last written. */
  at: number;
  fade: number;
  shipSlew?: number | undefined;
  values: Record<string, number>;
}

/**
 * Stage 2 dirty check for the legacy engine's per-frame target writes. The
 * engine's start-anchored target curves are idempotent — re-issuing the same
 * target restarts the same exponential — so skipping an unchanged write is
 * audibly identical to the old per-frame write. Dirty when: no write exists;
 * the fade or the ship slew changed; any target moved by more than
 * AUTOMATION_EPSILON; or AUTOMATION_CADENCE_S has elapsed since the last write
 * (a keep-alive so a missed write can never stick).
 */
export function automationDirty(
  last: AutomationWrite | null,
  values: Record<string, number>,
  fade: number,
  shipSlew: number | undefined,
  nowS: number,
  epsilon = AUTOMATION_EPSILON,
  cadenceS = AUTOMATION_CADENCE_S
): boolean {
  if (!last) return true;
  if (nowS - last.at >= cadenceS) return true;
  if (last.fade !== fade || last.shipSlew !== shipSlew) return true;
  for (const key of Object.keys(values)) {
    const v = values[key];
    if (typeof v !== 'number') continue;
    const prev = last.values[key];
    if (prev === undefined || Math.abs(prev - v) > epsilon) return true;
  }
  return false;
}
