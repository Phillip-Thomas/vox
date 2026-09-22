import type { RailRuntime } from '../../autopilot.ts';

/** ch2-color: player inputs and registered world transactions only. */
export function tick(ctx: RailRuntime): void {
{
    // Post-A1 breath: stand in the color for a moment (the shot holds the
    // stone the ramp ended on), then seek the tree — gaze on the CROWN, the
    // one saturated thing in a flat world (crossing the radius flips the beat).
    if (ctx.beatClock > 6 && ctx.heroTreeHandle.position) {
        if (!ctx.treeApproach && ctx.storyAnchors.planetSize && ctx.storyAnchors.terrainSeed != null) {
            ctx.treeApproach = ctx.interactionApproachGoal(ctx.getPlayerWorldPosition(), ctx.heroTreeHandle.position, ctx.heroTreeHandle.up ?? ctx.getPlayerUp(), 26, ctx.getWorldGen(ctx.storyAnchors.planetSize, ctx.storyAnchors.terrainSeed, ctx.STORY_PRIMARY_WORLD_ID).generator, ctx.storyAnchors.planetSize);
        }
        ctx.walkToward(ctx.treeApproach ?? ctx.heroTreeHandle.position, 1, ctx.treeCrownLift(), ctx.heroTreeHandle.position);
    }
    return;
}
}
