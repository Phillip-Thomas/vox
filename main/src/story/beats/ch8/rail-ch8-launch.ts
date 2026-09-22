import type { RailRuntime } from '../../autopilot.ts';

/** ch8-launch: player inputs and registered world transactions only. */
export function tick(ctx: RailRuntime): void {
{
    const flight = ctx.getSpaceFlightSnapshot();
    ctx.controls.jump = flight.controlMode === 'flight' && flight.phase === 'surface';
    ctx.controls.forward = flight.controlMode === 'flight' && flight.phase !== 'surface';
    ctx.controls.sprint = ctx.controls.forward;
    return;
}
}
