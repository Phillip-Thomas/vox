import type { RailRuntime } from '../../autopilot.ts';

/** ch10-cold: player inputs and registered world transactions only. */
export function tick(ctx: RailRuntime): void {
{
    const actorId = ctx.getLocalActorId();
    const habitat = ctx.getHabitatWorldState(ctx.TIDEGARDEN_WORLD_ID);
    if (!habitat)
        return;
    // The fitted door opens through the normal transaction, with no panel deletion.
    const view = ctx.emergentMovieShelterView();
    if (ctx.beatClock < ctx.CH10_EGRESS_HOLD_SECONDS) {
        ctx.openEmergentMovieShelterEgress(true, actorId);
        ctx.holdAt(view?.target ?? ctx._goalScratch.set(...habitat.core.position), 0);
        return;
    }
    const corePosition = ctx._goalScratch.set(...habitat.core.position);
    if (!ctx.hasMilestone(ctx.STORY_MILESTONES.ch10FaultRead, actorId)) {
        const coreDistance = ctx.walkToward(corePosition, 1.8, 0, view?.target);
        // G-1: the walk to the core is a walk under the same open sky, so the
        // glance lives here too. The contract nominates the fabricator walk as
        // the evidence window and that is still the shot it is about — but
        // confining the bias to the SECOND walk meant a crossing that happened
        // during the first was structurally unwatchable, and the ruling's own
        // words are "walk phases", plural. Arrival is goal-critical here for
        // the same reason it is there: the eyes come down for the act.
        ctx.tickSt0GazeBias(ctx.getPlayerWorldPosition(), coreDistance <= ctx.CH10_CORE_COMMIT_DISTANCE);
        if (coreDistance <= 2)
            ctx.performStoryInteraction('story-ch10-fault-read');
        return;
    }
    const egress = ctx.emergentMovieShelterEgressGoal();
    if (egress) {
        ctx.openEmergentMovieShelterEgress(true, actorId);
        ctx.walkToward(egress, 0.35, 0);
        return;
    }
    // The fabricator is the Kestrel's own: the night walk from the hearth to
    // the ship IS the ST-0 evidence window, under open sky.
    const ship = ctx.getShipPosition();
    if (!ship)
        return;
    const fabricator = ctx._goalScratch.set(ship[0], ship[1], ship[2]);
    const shipDistance = ctx.walkToward(fabricator, 3.4, 1.1);
    // THE ST-0 EVIDENCE WINDOW. This walk is the one the contract nominates,
    // so it is where the glance lives. Arrival is goal-critical — the eyes
    // come back down for the act itself — and the bias never touches the
    // route, only where the camera happens to be pointed on the way.
    ctx.tickSt0GazeBias(ctx.getPlayerWorldPosition(), shipDistance <= ctx.CH10_FABRICATOR_COMMIT_DISTANCE);
    if (shipDistance <= 6)
        ctx.performStoryInteraction('story-ch10-fabrication-attempt');
    return;
}
}
