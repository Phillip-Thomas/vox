import type { RailRuntime } from '../../autopilot.ts';

/** ch3-forage: player inputs and registered world transactions only. */
export function tick(ctx: RailRuntime): void {
{
    // Walk to the nearest berry bush (walk-over collects) once the sight cue
    // has landed; eat directly (UI crafting precedent) after the eat window
    // opens. The director advances ~18s after the meal.
    if (ctx.movieAte) {
        ctx.clearControls();
        ctx.setCinematicLookWeight(0);
        return;
    }
    if (ctx.getItemCount('berry') + ctx.getItemCount('root') > 0) {
        // The hunger was named at 12s and the rounds sighted at 18s — eat then.
        if (ctx.beatClock > 20)
            ctx.movieAte = ctx.movieEatForage();
        return;
    }
    if (ctx.beatClock > 6) {
        if (ctx.beatClock - ctx.forageGoalAt > 0.5 && ctx.storyAnchors.terrainSeed != null) {
            ctx.forageGoal = ctx.nearestForageNodeWorld(ctx.getPlayerWorldPosition(), ctx.storyAnchors.terrainSeed, 60);
            ctx.forageGoalAt = ctx.beatClock;
        }
        if (ctx.forageGoal)
            ctx.walkToward(ctx.forageGoal, 0.8);
    }
    return;
}
}
