import type { RailRuntime } from '../../autopilot.ts';

/** ch4-defy: player inputs and registered world transactions only. */
export function tick(ctx: RailRuntime): void {
{
    const target = ctx.heroTreeHandle.position;
    if (target) {
        ctx.walkToward(target, 3.1, ctx.treeCrownLift());
        if (ctx.getPlayerWorldPosition().distanceTo(target) <= 4) {
            ctx.performStoryInteraction('story-refuse-tree');
        }
    }
    return;
}
}
