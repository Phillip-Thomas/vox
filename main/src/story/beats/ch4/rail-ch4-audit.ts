import * as THREE from 'three';
import type { RailRuntime } from '../../autopilot.ts';

/** ch4-audit: player inputs and registered world transactions only. */
export function tick(ctx: RailRuntime): void {
{
    const actorId = ctx.getLocalActorId();
    let target: THREE.Vector3 | null = null;
    let interactionId: string | undefined;
    if (!ctx.hasMilestone(ctx.EMERGENT_AUDIT_MILESTONES.fireMismatch, actorId)) {
        const fire = ctx.getCampfires()[0];
        target = fire ? new THREE.Vector3(...fire.pos) : null;
        interactionId = 'story-audit-fire';
    }
    else if (!ctx.hasMilestone(ctx.EMERGENT_AUDIT_MILESTONES.lifeMismatch, actorId)) {
        target = ctx.storyAnchors.pond?.shore ?? null;
        interactionId = 'story-audit-life';
    }
    else if (!ctx.hasMilestone(ctx.EMERGENT_AUDIT_MILESTONES.treeMismatch, actorId)) {
        target = ctx.heroTreeHandle.position;
        interactionId = 'story-audit-tree';
    }
    if (target) {
        ctx.walkToward(target, 3.25, interactionId === 'story-audit-tree' ? ctx.treeCrownLift() : 0.8);
        if (ctx.getPlayerWorldPosition().distanceTo(target) <= 4.8)
            ctx.performStoryInteraction(interactionId);
    }
    return;
}
}
