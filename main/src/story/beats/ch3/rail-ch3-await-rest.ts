import type { RailRuntime } from '../../autopilot.ts';

/** ch3-await-rest: player inputs and registered world transactions only. */
export function tick(ctx: RailRuntime): void {
{
    const fire = ctx.getCampfires()[0];
    if (fire) {
        const firePos = ctx._target.set(fire.pos[0], fire.pos[1], fire.pos[2]);
        const distance = ctx.walkToward(firePos, 2.4);
        if (distance <= 2.4) {
            ctx.controls.forward = false;
            ctx.setCinematicLookWeight(0);
            ctx.pulseInteract(); // fires once night makes the rest resolver live
        }
    }
    return;
}
}
