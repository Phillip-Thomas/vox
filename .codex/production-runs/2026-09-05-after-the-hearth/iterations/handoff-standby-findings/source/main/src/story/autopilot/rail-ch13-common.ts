import type { RailRuntime } from '../autopilot.ts';

/**
 * ch13-common: player inputs and registered world transactions only.
 *
 * The body is reached through the rail runtime rather than imported: the beat
 * contracts import their rails, and a value import back into the director would
 * close the `definitions.ts` cycle.
 */
export function tick(ctx: RailRuntime): void {
  ctx.applyCommonGroundRail(ctx);
}
