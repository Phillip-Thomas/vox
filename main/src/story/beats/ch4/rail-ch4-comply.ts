import * as THREE from 'three';
import type { RailRuntime } from '../../autopilot.ts';

/** ch4-comply: player inputs and registered world transactions only. */
export function tick(ctx: RailRuntime): void {
{
    const actorId = ctx.getLocalActorId();
    let target: THREE.Vector3 | null = null;
    let interactionId: string | undefined;
    if (!ctx.hasMilestone(ctx.EMERGENT_AUDIT_MILESTONES.fireComplied, actorId)) {
        const fire = ctx.getCampfires()[0];
        target = fire ? new THREE.Vector3(...fire.pos) : null;
        interactionId = 'story-comply-fire';
    }
    else if (!ctx.hasMilestone(ctx.EMERGENT_AUDIT_MILESTONES.organicsComplied, actorId)) {
        target = ctx.wreckRelayHandle.position;
        interactionId = 'story-comply-organics';
    }
    if (target) {
        ctx.walkToward(target, 3.1, 0.8);
        if (ctx.getPlayerWorldPosition().distanceTo(target) <= 4)
            ctx.performStoryInteraction(interactionId);
    }
    return;
}
}
