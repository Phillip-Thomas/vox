import type { RailRuntime } from '../../autopilot.ts';

/** ch8-landfall: player inputs and registered world transactions only. */
export function tick(ctx: RailRuntime): void {
{
    const flight = ctx.getSpaceFlightSnapshot();
    if (flight.controlMode !== 'flight')
        return;
    if (flight.phase === 'descent') {
        ctx.controls.forward = true;
        ctx.controls.interact = true;
    }
    else if (flight.phase === 'surface') {
        ctx.exitShip();
    }
    else {
        // STILL IN DEEP SPACE. This case did not exist, and its absence was a
        // silent, unbounded stall: `enterAtmosphere()` is altitude-driven, so a
        // crossing that hands off outside the envelope leaves the beat with
        // nothing to do — no descent to fly, no surface to disembark onto — and
        // the rail simply floated. A performance run measured the screening
        // holding this beat for 589 seconds and still holding at the 1500s cap.
        //
        // The beat has no BEAT_TIMEOUT either, so nothing anywhere would have
        // ended it. Keep closing on the planet exactly as the crossing does
        // until the atmosphere takes the ship.
        ctx.controls.forward = true;
        ctx.controls.sprint = true;
    }
    return;
}
}
