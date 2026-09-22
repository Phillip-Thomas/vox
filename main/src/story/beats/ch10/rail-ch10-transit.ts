import type { RailRuntime } from '../../autopilot.ts';

/** ch10-transit: player inputs and registered world transactions only. */
export function tick(ctx: RailRuntime): void {
{
    // Same clean slate as the ask beat, and for the same reason: the transit
    // inherits whatever the ask left asserted, and a stale interact here
    // would ask to land on the way to a station that offers no berth.
    ctx.clearControls();
    const flight = ctx.getSpaceFlightSnapshot();
    // THE BEAT DOES NOT ALWAYS BEGIN IN THE COCKPIT. Played through, chapter
    // 10 enters the transit ON FOOT at the wreck relay — she has just claimed
    // the bearing standing beside it — so a rail that only knows how to fly
    // stands at the relay forever. The deep link seeds the pilot already in
    // flight, which is exactly why the deep-link tail passed while the flow
    // path never ignited. Same boarding grammar the ask beat uses.
    if (flight.controlMode !== 'flight') {
        const parked = ctx.getShipPosition();
        if (!parked)
            return;
        const hatch = ctx._goalScratch.set(parked[0], parked[1], parked[2]);
        ctx.walkToward(hatch, 2.4, 1.1);
        if (ctx.getPlayerWorldPosition().distanceTo(hatch) <= 3.5)
            ctx.enterShip();
        return;
    }
    // Ignite, then hold the claimed bearing. Nothing else: the seam, the
    // resolve and the hand-back are all facts of the flight, not acts.
    //
    // THE END OF THE LEG IS A STANDOFF, NOT A DOCK. arrivalStandoff(body,
    // 1,500) sits outside CORRIDOR_RANGE 1,400 precisely so no corridor is
    // published and no berth is offered, so the pilot cuts thrust there and
    // holds. Flying on would enter the corridor and stage a shot of an
    // invitation the chapter refuses to make.
    const contact = ctx.spaceStationApproachGeometry();
    const atStandoff = contact !== null
        && contact.readout.distance <= ctx.STATION_STANDOFF_DISTANCE;
    ctx.controls.jump = flight.controlMode === 'flight' && flight.phase === 'surface';
    ctx.controls.forward = flight.controlMode === 'flight'
        && flight.phase !== 'surface'
        && !atStandoff;
    // NO SPRINT, AND THIS IS A LENS DECISION, NOT A SPEED ONE.
    //
    // The ch8 legs above copy `sprint = forward`, and inheriting that here
    // staged an undeclared lens move through the chapter's own hero frames:
    // resolveShipBoost() is `forwardHeld && sprintHeld`, boost drives
    // shipFlightFeedback's fovTarget = 70 + 9 x boost, and ShipController
    // writes that straight onto the render camera. So the rail cruised at FOV
    // 79 and settled back to 70 only when `atStandoff` dropped forward —
    // which is exactly the 79-at-the-seam / 70.0002-at-the-cut-line split the
    // cinematography pass measured, and the contract declares FOV 70
    // throughout the transit. It was never the player's boost and never
    // shipped feel arriving on its own: this rail asked for it.
    //
    // Suppressing it also removes the cockpit-recede artifact at the root.
    // The shell's FOV compensation is exact and unclamped
    // (tan(39.5)/tan(35) = 1.17727 at 79, 1.03761 at 72, 1.00000 at 70), so
    // the silhouette was never wrong — but at scale >= 1.0708 (FOV 73.72) the
    // outer shell walls pass outside the cabin lamp's 6.5-unit reach and fall
    // to their emissive floor, which against black space reads as the seat
    // having pulled back. At FOV 70 the walls sit 6.09 units out and stay lit.
    //
    // The cost is honest and is travel time only: every trigger on this leg
    // is distance- or state-keyed, not clocked, so the seam range, the
    // standoff and the hand-back are unmoved. Terminal speed drops from the
    // clamped 320 u/s to 117.5 (accel 60 against the 0.6/s damping), which
    // lengthens the cruise rather than changing anything it arrives at.
    ctx.controls.sprint = false;
    return;
}
}
