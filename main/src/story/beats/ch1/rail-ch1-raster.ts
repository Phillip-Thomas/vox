import type { RailRuntime } from '../../autopilot.ts';
import { getDebrisPositions, isDebrisCollected } from '../../debrisSalvage.ts';

let requiredTarget = -1;
/** One committed required salvage piece, then ordinary yielding extraction. */
export function tick(ctx: RailRuntime): void {
  const positions = getDebrisPositions();
  if (requiredTarget < 0 || isDebrisCollected(requiredTarget)) {
    requiredTarget = [0, 1, 2].filter(index => !isDebrisCollected(index) && positions[index])
      .sort((a, b) => positions[a].distanceTo(ctx.getPlayerWorldPosition()) - positions[b].distanceTo(ctx.getPlayerWorldPosition()))[0] ?? -1;
  }
  if (requiredTarget >= 0) {
    ctx.controls.delete = false;
    ctx.walkTowardTaskRow(positions[requiredTarget], 0.9);
  } else if (ctx.getItemCount('biofiber') < ctx.CH1_QUOTA.biofiber) {
    ctx.extractRhythm(ctx.sweepGoal());
  } else {
    ctx.controls.delete = false;
  }
}
