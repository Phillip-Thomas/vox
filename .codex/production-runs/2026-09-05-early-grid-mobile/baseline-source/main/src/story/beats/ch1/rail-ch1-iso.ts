import type { RailRuntime } from '../../autopilot.ts';

/** ch1-iso: player inputs and registered world transactions only. */
export function tick(ctx: RailRuntime): void {
{
    // NAV VIEW has already opened the second ground axis: cross the revealed
    // terrain to the uncrowded mesa, then let step assist walk its staircase.
    if (ctx.signalMesaHandle.summit) {
        ctx.walkTowardLens(ctx.signalMesaHandle.summit, 1.6);
    }
    return;
}
}
