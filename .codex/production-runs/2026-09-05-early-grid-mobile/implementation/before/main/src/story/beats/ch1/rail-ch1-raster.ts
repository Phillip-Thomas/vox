import type { RailRuntime } from '../../autopilot.ts';

/** ch1-raster: player inputs and registered world transactions only. */
export function tick(ctx: RailRuntime): void {
{
    // Fiber unmet: stand-and-extract, with travel legs steering at the
    // COMMITTED salvage piece (walk-over collects it; loose stones come by
    // proximity en route). Fiber met: pure salvage runs until the strip is
    // clear. Deferral keeps one snagged piece from stalling the act.
    const fiberDone = ctx.getItemCount('biofiber') >= ctx.CH1_QUOTA.biofiber;
    const debrisIdx = ctx.committedDebrisTarget();
    const debrisGoal = debrisIdx >= 0 ? ctx.getDebrisPositions()[debrisIdx] : null;
    if (!fiberDone) {
        ctx.extractRhythm(debrisGoal ?? ctx.sweepGoal());
    }
    else if (debrisGoal) {
        ctx.controls.delete = false;
        ctx.walkTowardTaskRow(debrisGoal, 0.9);
    }
    else {
        // Stone stragglers: keep drifting — proximity pickup needs motion.
        ctx.extractRhythm(ctx.sweepGoal());
    }
    return;
}
}
