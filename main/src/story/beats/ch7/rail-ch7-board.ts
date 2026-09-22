import type { RailRuntime } from '../../autopilot.ts';

/** ch7-board: player inputs and registered world transactions only. */
export function tick(ctx: RailRuntime): void {
{
    const ship = ctx.getShipPosition();
    if (!ship)
        return;
    const target = ctx._goalScratch.set(ship[0], ship[1], ship[2]);
    ctx.walkToward(target, 2.4, 1.1);
    if (ctx.isBoardable() && ctx.getPlayerWorldPosition().distanceTo(target) <= 3.5)
        ctx.enterShip();
    return;
}
}
