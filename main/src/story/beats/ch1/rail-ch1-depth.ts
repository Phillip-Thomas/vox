import type { RailRuntime } from '../../autopilot.ts';

/** ch1-depth: player inputs and registered world transactions only. */
export function tick(ctx: RailRuntime): void {
{
    // Recovery run: nearest uncollected pod on the authoritative work row.
    const player = ctx.getPlayerWorldPosition();
    let nearest = -1;
    let nearestDist = Infinity;
    ctx.getSupplyPodPositions().forEach((pos, i) => {
        if (ctx.isPodCollected(i))
            return;
        const dist = player.distanceTo(pos);
        if (dist < nearestDist) {
            nearestDist = dist;
            nearest = i;
        }
    });
    if (nearest >= 0)
        ctx.walkTowardTaskRow(ctx.getSupplyPodPositions()[nearest], 0.8);
    return;
}
}
