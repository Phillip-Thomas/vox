import type { RailRuntime } from '../../autopilot.ts';

/** ch7-reconstruct: player inputs and registered world transactions only. */
export function tick(ctx: RailRuntime): void {
{
    const binding = ctx.getEmergentMovieWreckBinding();
    const target = binding?.workstationPosition ?? ctx.hifiWreckHandle.position;
    if (!target)
        return;
    const submergence = ctx.getPlayerSubmersion(ctx.getLocalActorId()).submergence;
    if (ctx.shouldExitWaterBeforeMovieWreck(submergence)) {
        ctx.moveThroughWaterToward(target, 2.8, 'surface');
        return;
    }
    const distance = ctx.getPlayerWorldPosition().distanceTo(target);
    const interactionMotion = ctx.movieWreckInteractionMotion(distance);
    if (ctx.shouldApproachMovieWreck(distance)) {
        ctx.walkToward(target, 2.8, 0.8);
        if (ctx.navigationAction === 'unreachable'
            && ctx.shouldRecoverMovieWreckWetStart(ctx.navigationReason)) {
            // An unreachable route is cached. Clear it on every wet-column
            // recovery step so the dry planner can take over immediately after
            // the capsule reaches traversable shore.
            ctx.resetNavigationRoute();
            ctx.moveThroughWaterToward(target, 2.8, 'surface');
        }
        return;
    }
    if (interactionMotion === 'retreat') {
        const player = ctx.getPlayerWorldPosition();
        const wreck = ctx.hifiWreckHandle.position;
        const up = ctx.getPlayerUp();
        const annulusGoal = wreck && ctx.resolveMovieWreckInteractionAnnulusGoal({
            player: [player.x, player.y, player.z],
            workstation: [target.x, target.y, target.z],
            wreck: [wreck.x, wreck.y, wreck.z],
            surfaceUp: [up.x, up.y, up.z]
        });
        if (annulusGoal) {
            ctx._wreckInteractionScratch.set(...annulusGoal);
            // Ordinary surface navigation validates every retreat step. Keeping
            // gaze on the bench naturally produces a short backward/side step;
            // no recovery teleport or synthetic interaction is involved.
            ctx.walkToward(ctx._wreckInteractionScratch, 0.3, 0.2, target, 4.4);
        }
        else {
            ctx.holdAt(target, 0.8);
        }
        return;
    }
    // The live resolver has already proven physical reach. Stand and look at
    // the bench instead of pushing into its tighter route waypoint.
    ctx.holdAt(target, 0.8);
    // Recipe fabrication is allowed only while the live wreck bench has
    // published assembler access. The next frame's registered F action then
    // consumes the crafted part in the ordered repair transaction.
    ctx.prepareEmergentMovieWreckCraft(ctx.getLocalActorId());
    ctx.performStoryInteraction();
    return;
}
}
