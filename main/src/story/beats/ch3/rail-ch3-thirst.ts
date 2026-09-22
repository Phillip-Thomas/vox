import type { RailRuntime } from '../../autopilot.ts';

/** ch3-thirst: player inputs and registered world transactions only. */
export function tick(ctx: RailRuntime): void {
{
    // FLOW, not just completion: the pilot waits for the seek cue ("water
    // finds the low places") before walking — the thirst must be felt and
    // named before it is answered, exactly as real play paces it.
    const pond = ctx.storyAnchors.pond;
    if (pond && ctx.beatClock > 36) {
        // Stay on the validated dry shore and look into the water. Interaction's
        // ray reaches the surface from here; entering the pond is never required.
        const distance = ctx.walkToward(pond.shore, 1.15, 0, pond.surface, 2.6);
        if (distance <= 1.8)
            ctx.pulseInteract();
    }
    return;
}
}
