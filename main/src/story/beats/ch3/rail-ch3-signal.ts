import type { RailRuntime } from '../../autopilot.ts';

/** ch3-signal: player inputs and registered world transactions only. */
export function tick(ctx: RailRuntime): void {
{
    // The klaxon run: hold for the summons (the network's lines must land),
    // then SPRINT at the wreck — stamina spends on the way, which is the
    // scene's whole point. The director resolves at the relay.
    if (ctx.wreckRelayHandle.position && ctx.beatClock > 12) {
        ctx.walkToward(ctx.wreckRelayHandle.position, 3.0);
        ctx.controls.sprint = ctx.controls.forward;
    }
    return;
}
}
