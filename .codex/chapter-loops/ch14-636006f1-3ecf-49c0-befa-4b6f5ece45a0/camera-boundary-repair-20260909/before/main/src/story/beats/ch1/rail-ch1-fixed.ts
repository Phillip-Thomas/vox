import type { RailRuntime } from '../../autopilot.ts';
import { getDebrisPositions, isDebrisCollected } from '../../debrisSalvage.ts';

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
    const lens = ctx.getSideLens();
    if (lens) ctx.walkTowardTaskRow(ctx._goalScratch.copy(ctx.getPlayerWorldPosition()).addScaledVector(lens.travelAxis, 30), 1);
  }
}
