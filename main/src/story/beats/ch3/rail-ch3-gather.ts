import type { RailRuntime } from '../../autopilot.ts';

/** ch3-gather: player inputs and registered world transactions only. */
export function tick(ctx: RailRuntime): void {
{
    // The body/chill captions precede the same Fabricator transaction the
    // player presses. Salvage/pods pay its inputs; no inventory is granted.
    if (ctx.beatClock > 21 && ctx.getCampfires().length === 0 && ctx.screeningActionReady()) {
        if (ctx.autopilotWorldAccess.craft('campfire')) {
            ctx.noteScreeningAction();
            return;
        }
        const stage = ctx.currentGatherObjectiveStage();
        const recipe = stage === 'hatchet' ? 'stone_hatchet'
            : stage === 'pickaxe' ? 'stone_pickaxe' : stage === 'biofuel' ? 'biofuel' : null;
        if (recipe && ctx.autopilotWorldAccess.craft(recipe)) {
            ctx.noteScreeningAction();
            return;
        }
        const target = ctx.nearestGatherResourceTarget(ctx.currentGatherMarkerResource());
        if (target) {
            const distance = ctx.walkToward(target, 2.3, 0, target, 8);
            ctx.controls.delete = distance < 7;
        }
    }
    return;
}
}
