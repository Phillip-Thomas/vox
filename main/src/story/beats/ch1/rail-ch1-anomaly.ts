import type { RailRuntime } from '../../autopilot.ts';

/** ch1-anomaly: player inputs and registered world transactions only. */
export function tick(ctx: RailRuntime): void {
{
    // STAGE 1 — the calibration sweep: the era's verb is LOOKING. The pilot
    // pans the gaze around the horizon (eye height — never the ground) until
    // the survey returns the deviation.
    if (!ctx.anomalyMassDesignated()) {
        ctx.setCinematicGazeIntent(null);
        const a = ctx.beatClock * 0.6;
        ctx._goalScratch.copy(ctx.getPlayerWorldPosition());
        ctx._goalScratch.x += Math.cos(a) * 14;
        ctx._goalScratch.z += Math.sin(a) * 14;
        ctx._goalScratch.addScaledVector(ctx.getPlayerUp(), 1.6);
        ctx.setCinematicLookTarget(ctx._goalScratch);
        ctx.setCinematicLookWeight(1);
        return;
    }
    // STAGE 2 — the mass: walk in with the gaze ON the stone (lift 1.1), so
    // the touch and the A1 ramp play framed on the subject.
    if (ctx.anomalyStoneHandle.position) {
        const distance = ctx.walkToward(ctx.anomalyStoneHandle.position, 2.6, 1.1);
        if (distance <= 4.2)
            ctx.pulseInteract();
    }
    return;
}
}
