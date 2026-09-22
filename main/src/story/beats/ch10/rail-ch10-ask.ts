import type { RailRuntime } from '../../autopilot.ts';

// --- LANDFALL PROXIMITY GATE ---------------------------------------------------
//
// The objective is "LAND NEAR THE RELAY", and the descent directive already
// supplies the wreck site as a system-space bearing. The leg below used to
// assert `interact` (request landing) on the FIRST in-atmosphere frame, so the
// ship set down wherever it happened to enter the envelope. On 2026-09-09 that
// put the pilot on a different cube face from the relay, where the surface
// planner answers `no-safe-route`, and the beat stood still until the session
// deadline. Holding the landing request until the ship is actually over the
// site is the player-equivalent act; nothing is granted or teleported, and the
// old unconditional behaviour survives as a time backstop so a bearing that
// never converges still puts the ship down rather than orbiting forever.
const LANDING_SITE_RANGE = 120;
const LANDING_REQUEST_BACKSTOP_MS = 45_000;

let atmosphereEnteredAt = -1;

function landingRequestAllowed(ctx: RailRuntime, pose: readonly number[]): boolean {
    const now = Date.now();
    if (atmosphereEnteredAt < 0)
        atmosphereEnteredAt = now;
    const target = ctx.chapter10AskDescentSystemTarget();
    if (!target || pose.length < 3)
        return true;
    const dx = pose[0] - target[0];
    const dy = pose[1] - target[1];
    const dz = pose[2] - target[2];
    if (Math.sqrt(dx * dx + dy * dy + dz * dz) <= LANDING_SITE_RANGE)
        return true;
    return now - atmosphereEnteredAt >= LANDING_REQUEST_BACKSTOP_MS;
}

/** ch10-ask: player inputs and registered world transactions only. */
export function tick(ctx: RailRuntime): void {
{
    // THE VIRTUAL CONTROLS ARE STICKY. `controls` is a module-global cleared
    // only on a beat change, so whatever a leg asserts survives into the next
    // one — and a chapter that walks, boards, launches, crosses, lands and
    // walks again inside ONE beat crosses six legs with no clear between
    // them. An `interact` left over from the on-foot approach to the hatch is
    // read by ShipController as requestLanding() on every subsequent frame,
    // which is why the ship launched and immediately set back down, forever,
    // with jump, forward and interact all asserted at once. Each leg below
    // states its whole intent against a clean slate.
    ctx.clearControls();
    const actorId = ctx.getLocalActorId();
    const flight = ctx.getSpaceFlightSnapshot();
    const system = ctx.getSystemFlightSnapshot();
    // The atmosphere clock belongs to one continuous airborne leg.
    if (flight.controlMode !== 'flight' || flight.phase === 'surface')
        atmosphereEnteredAt = -1;
    if (ctx.hasMilestone(ctx.STORY_MILESTONES.ch10RelayAnswered, actorId)) {
        // The rite. The pilot performs the claim exactly as a player would —
        // it is never claimed on anyone's behalf by a timeout or a nudge.
        const relay = ctx.wreckRelayHandle.position;
        if (!relay)
            return;
        if (ctx.walkToward(relay, 2.2, 0.8) <= 4)
            ctx.performStoryInteraction('story-ch10-bearing-claim');
        return;
    }
    if (system.activePlanetId === ctx.STORY_PRIMARY_WORLD_ID && flight.phase === 'surface') {
        if (flight.controlMode === 'flight') {
            ctx.exitShip();
            return;
        }
        const relay = ctx.wreckRelayHandle.position;
        if (!relay)
            return;
        if (ctx.walkToward(relay, 2.2, 0.8) <= 4)
            ctx.performStoryInteraction('story-ch10-relay-query');
        return;
    }
    if (flight.controlMode !== 'flight') {
        const ship = ctx.getShipPosition();
        if (!ship)
            return;
        const hatch = ctx._goalScratch.set(ship[0], ship[1], ship[2]);
        ctx.walkToward(hatch, 2.4, 1.1);
        if (ctx.getPlayerWorldPosition().distanceTo(hatch) <= 3.5)
            ctx.enterShip();
        return;
    }
    // ch8 flight grammar, reversed. The two legs are told apart by the
    // ENCLOSING WORLD, never by the phase name: 'descent' is simply the
    // in-atmosphere phase, so it is as true of a climb-out as of an arrival.
    // Requesting a landing on that name alone made the pilot ask to land in
    // the same frame it had just launched, and the ship sat at the Tidegarden
    // hearth toggling surface/descent for the whole beat.
    if (flight.phase === 'surface') {
        ctx.controls.jump = true;
        return;
    }
    const homeward = system.activePlanetId === ctx.STORY_PRIMARY_WORLD_ID;
    if (homeward && (flight.phase === 'descent' || flight.phase === 'approach')) {
        ctx.controls.forward = true;
        ctx.controls.interact = landingRequestAllowed(ctx, system.pose.position);
        return;
    }
    ctx.controls.forward = true;
    ctx.controls.sprint = true;
    return;
}
}
