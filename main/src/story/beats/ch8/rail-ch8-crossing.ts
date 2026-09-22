import type { RailRuntime } from '../../autopilot.ts';

/** ch8-crossing: player inputs and registered world transactions only. */
export function tick(ctx: RailRuntime): void {
{
    ctx.controls.forward = ctx.getSpaceFlightSnapshot().controlMode === 'flight';
    ctx.controls.sprint = ctx.controls.forward;
    return;
}
}
