import type { RailRuntime } from '../../autopilot.ts';

/** ch1-nav: player inputs and registered world transactions only. */
export function tick(ctx: RailRuntime): void {
{
    const wp = ctx.currentNavWaypointPosition();
    if (wp)
        ctx.walkTowardLens(wp, 1.4);
    return;
}
}
