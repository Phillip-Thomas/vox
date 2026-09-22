import type { RailRuntime } from '../../autopilot.ts';

/** ch2-approach: player inputs and registered world transactions only. */
export function tick(ctx: RailRuntime): void {
{
    if (ctx.heroTreeHandle.position) {
        if (!ctx.treeApproach && ctx.storyAnchors.planetSize && ctx.storyAnchors.terrainSeed != null) {
            ctx.treeApproach = ctx.interactionApproachGoal(ctx.getPlayerWorldPosition(), ctx.heroTreeHandle.position, ctx.heroTreeHandle.up ?? ctx.getPlayerUp(), 5.5, ctx.getWorldGen(ctx.storyAnchors.planetSize, ctx.storyAnchors.terrainSeed, ctx.STORY_PRIMARY_WORLD_ID).generator, ctx.storyAnchors.planetSize);
        }
        ctx.walkToward(ctx.treeApproach ?? ctx.heroTreeHandle.position, 0.6, ctx.treeCrownLift(), ctx.heroTreeHandle.position);
        if (ctx.getPlayerWorldPosition().distanceTo(ctx.heroTreeHandle.position) <= 5.2)
            ctx.pulseInteract();
    }
    return;
}
}
