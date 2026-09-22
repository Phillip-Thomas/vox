import type { RailRuntime } from '../../autopilot.ts';

/** ch9-hearth: player inputs and registered world transactions only. */
export function tick(ctx: RailRuntime): void {
{
    const actorId = ctx.getLocalActorId();
    const habitat = ctx.getHabitatWorldState(ctx.TIDEGARDEN_WORLD_ID);
    if (!habitat)
        return;
    const view = ctx.emergentMovieShelterView();
    const corePosition = view?.position ?? ctx._goalScratch.set(...habitat.core.position);
    const coreDistance = ctx.walkToward(corePosition, 0.35, 0, view?.target, view ? 3 : 0);
    if (coreDistance <= 0.6) {
        ctx.completeEmergentMovieSafeRest(ctx.getPlayerWorldPosition(), ctx.getCurrentDayPhase(), actorId);
        // Rest is allowed only at real night. Hold inside the proven enclosure
        // between attempts instead of feeding the goal to the stuck watchdog.
        ctx.holdAt(view?.target ?? corePosition, 0, view ? 'interact' : undefined);
    }
    return;
}
}
