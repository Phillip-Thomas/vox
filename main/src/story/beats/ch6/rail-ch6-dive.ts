import type { RailRuntime } from '../../autopilot.ts';

/** ch6-dive: player inputs and registered world transactions only. */
export function tick(ctx: RailRuntime): void {
{
    const actorId = ctx.getLocalActorId();
    const size = ctx.storyAnchors.planetSize;
    const seed = ctx.storyAnchors.terrainSeed;
    if (size === null || seed === null)
        return;
    const acquired = ctx.hasMilestone(ctx.EMERGENT_UNIQUE_ITEM_MILESTONES.keelMemory, actorId);
    const submergence = ctx.getPlayerSubmersion(actorId).submergence;
    const surfacedWithKeel = ctx.hasMilestone(ctx.AUTHORED_DIVE_MILESTONES.surfacedWithKeel, actorId);
    ctx.diveRecoveryActive = surfacedWithKeel
        ? false
        : acquired && submergence >= ctx.AUTHORED_DIVE_ENTER_SUBMERGENCE
            ? true
            : ctx.nextDiveRecoveryState({
                active: ctx.diveRecoveryActive,
                oxygen: ctx.getVitals(actorId).oxygen,
                submergence
            });
    const returning = surfacedWithKeel || ctx.diveRecoveryActive;
    const pond = ctx.storyAnchors.pond;
    const keelTarget = ctx.getKeelMemoryPose(size, seed)?.position ?? null;
    if (!returning && !ctx.diveAimReady && pond && keelTarget) {
        const shoreDistance = ctx.moveThroughWaterToward(pond.shore, 2.7, 'dive', keelTarget);
        ctx.diveAimReady = ctx.nextDiveAimReady({
            active: ctx.diveAimReady,
            pitch: ctx.getPlayerLook().pitch,
            shoreDistance,
            submergence
        });
        return;
    }
    const target = returning
        ? pond?.shore ?? null
        : keelTarget;
    if (!target)
        return;
    if (!returning && keelTarget) {
        ctx.diveColumnLocked = ctx.nextDiveColumnLock({
            active: ctx.diveColumnLocked,
            player: ctx.getPlayerWorldPosition(),
            target: keelTarget,
            up: ctx.getPlayerUp(),
            submergence,
            stopDistance: 2.4
        });
    }
    const distance = ctx.moveThroughWaterToward(target, returning ? 2.7 : 2.4, returning ? 'surface' : 'dive', undefined, !returning && ctx.diveColumnLocked);
    if (surfacedWithKeel && submergence <= 0.2 && distance <= 4.1) {
        ctx.performStoryInteraction('story-keel-bank');
    }
    else if (!ctx.diveRecoveryActive && keelTarget
        && ctx.getPlayerWorldPosition().distanceTo(keelTarget) <= 3.2) {
        ctx.performStoryInteraction('story-keel-free');
    }
    return;
}
}
