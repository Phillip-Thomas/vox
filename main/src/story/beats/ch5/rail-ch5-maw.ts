import type { RailRuntime } from '../../autopilot.ts';

/** ch5-maw: player inputs and registered world transactions only. */
export function tick(ctx: RailRuntime): void {
{
    const actorId = ctx.getLocalActorId();
    const directionResolved = ctx.hasMilestone(ctx.EMERGENT_MAW_MILESTONES.directionResolved, actorId);
    const pondResonant = ctx.hasMilestone(ctx.EMERGENT_MAW_MILESTONES.pondResonance, actorId);
    if (directionResolved && !pondResonant) {
        const pond = ctx.storyAnchors.pond;
        if (!pond)
            return;
        // Route to authored dry ground, then use the same accessible Attend
        // action available to manual play. Interaction gaze gives the response
        // a composed frame without taking ownership away from the camera rig.
        const shoreDistance = ctx.walkToward(pond.shore, 3, 1.35, pond.surface, 5.2);
        if (shoreDistance <= 5.2) {
            ctx.performStoryInteraction('story-maw-pond-attend');
        }
        return;
    }
    const pack = ctx.storyAnchors.fieldPack;
    if (pack && !pondResonant) {
        ctx.walkToward(pack.position, 2.7, 0.7);
        if (ctx.getPlayerWorldPosition().distanceTo(pack.position) <= 3.7) {
            ctx.performStoryInteraction(ctx.hasMilestone('story:item:maw-repair-kit:acquired', actorId)
                ? 'story-maw-repair'
                : 'story-field-kit');
        }
    }
    return;
}
}
