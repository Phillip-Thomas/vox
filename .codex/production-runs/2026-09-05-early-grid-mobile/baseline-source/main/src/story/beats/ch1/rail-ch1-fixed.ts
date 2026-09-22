import type { RailRuntime } from '../../autopilot.ts';

/** ch1-fixed: player inputs and registered world transactions only. */
export function tick(ctx: RailRuntime): void {
{
    // Tutorial order: chew fiber first (stand-and-extract with drift legs),
    // then MARCH down the strip until the bolted frame flips a screen edge.
    const fiberDone = ctx.getItemCount('biofiber') >= ctx.CH1_FIXED_TUTORIAL.biofiber;
    if (!fiberDone) {
        ctx.extractRhythm(ctx.sweepGoal(20, 8));
    }
    else {
        ctx.controls.delete = false;
        const lens = ctx.getSideLens();
        if (lens) {
            ctx.walkTowardTaskRow(ctx._goalScratch.copy(ctx.getPlayerWorldPosition()).addScaledVector(lens.travelAxis, 30), 1);
        }
    }
    return;
}
}
