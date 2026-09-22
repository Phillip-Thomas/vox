import type { RailRuntime } from '../../autopilot.ts';
import { getDebrisPositions, isDebrisCollected } from '../../debrisSalvage.ts';
import { getFixedScreenCoverage, getLensRig } from '../../sideLens.ts';

/** Native pickup, positive extraction, then a real movement transfer. */
export function tick(ctx: RailRuntime): void {
  if (!isDebrisCollected(0)) {
    ctx.controls.delete = false;
    const target = getDebrisPositions()[0];
    if (target) ctx.walkTowardTaskRow(target, 0.9);
  } else if (ctx.getItemCount('biofiber') < ctx.CH1_FIXED_TUTORIAL.biofiber) {
    ctx.extractRhythm(ctx.sweepGoal(20, 8));
  } else {
    ctx.controls.delete = false;
    ctx.controls.left = false; ctx.controls.right = false;
    const lens = ctx.getSideLens(), coverage = getFixedScreenCoverage();
    if (!lens || !coverage?.valid || coverage.transferSequence > coverage.presentedTransferSequence) return;
    const player = ctx.getPlayerWorldPosition();
    const along = ctx._goalScratch.copy(player).sub(lens.origin).dot(lens.travelAxis);
    // Cross a real, reachable edge of this camera cell. A target that keeps
    // moving ahead eventually pins the worker against the task-row wall.
    const edges = [coverage.intervalMax + 0.5, coverage.intervalMin - 0.5]
      .filter(edge => Math.abs(edge) < getLensRig().travelBand)
      .sort((a, b) => Math.abs(a - along) - Math.abs(b - along));
    if (edges.length) ctx.walkTowardTaskRow(ctx._goalScratch.copy(player).addScaledVector(lens.travelAxis, edges[0] - along), 0.1);
  }
}
