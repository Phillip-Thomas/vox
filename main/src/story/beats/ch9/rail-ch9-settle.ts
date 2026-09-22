import { gatherConstructionWood } from '../../autopilot/resourceGathering.ts';
import type { RailRuntime } from '../../autopilot.ts';

/** ch9-settle: player inputs and registered world transactions only. */
export function tick(ctx: RailRuntime): void {
{
    const actorId = ctx.getLocalActorId();
    const binding = ctx.getEmergentMovieSettlementBinding();
    if (!binding)
        return;
    const habitat = ctx.getHabitatWorldState(ctx.TIDEGARDEN_WORLD_ID);
    if (!ctx.hasMilestone(ctx.TIDEGARDEN_SETTLEMENT_MILESTONES.relationshipAttended, actorId)) {
        const relationship = binding.relationship;
        if (!relationship)
            return;
        ctx.walkToward(relationship.position, 3.4, 0.5);
        if (ctx.getPlayerWorldPosition().distanceTo(relationship.position) <= 5) {
            ctx.performStoryInteraction('story-tidegarden-attend');
        }
        return;
    }
    if (!habitat) {
        const chosen = ctx.getTidegardenChosenHabitatSite(actorId);
        ctx.habitatGoal ??= ctx.resolveTidegardenSettlementTarget('choose-site')
            ?? ctx.findEmergentMovieHabitatGoal(ctx.getPlayerWorldPosition());
        if (!ctx.habitatGoal)
            return;
        if (!chosen) {
            const siteDistance = ctx.walkToward(ctx.habitatGoal, 0.45, 0.4);
            if (siteDistance <= 2)
                ctx.performStoryInteraction('story-tidegarden-choose-site');
            return;
        }
        // The immutable choice may be a different voxel from the original
        // recommendation. Both gathering's return route and installation now
        // use that chosen site's actual dry approach.
        ctx.habitatGoal = ctx.resolveTidegardenSettlementTarget('foundation')
            ?? ctx.findEmergentMovieHabitatGoal(ctx.getPlayerWorldPosition());
        if (!ctx.habitatGoal) return;
        // Once the site belongs to the player, the Kestrel's carried fabricator
        // is the truthful next destination. Do not fabricate the Core before
        // the relationship/site choices merely to simplify a screening.
        if (!ctx.prepareEmergentMovieHabitatCore(actorId)) {
            const ship = ctx.resolveTidegardenSettlementTarget('craft-core')
                ?? (() => {
                    const pose = ctx.getShipPosition();
                    return pose ? ctx._goalScratch.set(pose[0], pose[1], pose[2]) : null;
                })();
            if (ship) {
                ctx.walkToward(ship, 4.5, 1.1);
                if (ctx.getPlayerWorldPosition().distanceTo(ship) <= 7.5) {
                    ctx.prepareEmergentMovieHabitatCore(actorId);
                }
            }
            return;
        }
        if (!gatherConstructionWood(ctx, binding)) return;
        const chosenDistance = ctx.walkToward(ctx.habitatGoal, 0.45, 0.4);
        if (chosenDistance <= 0.55) {
            ctx.installEmergentMovieHabitatCore(ctx.getPlayerWorldPosition(), actorId);
        }
        return;
    }
    if (!gatherConstructionWood(ctx, binding)) return;
    const view = ctx.emergentMovieShelterView();
    const corePosition = habitat.shelterCertification && view
        ? view.position : ctx._goalScratch.set(...habitat.core.position);
    const coreDistance = ctx.walkToward(corePosition, 0.35, 0, view?.target, view ? 3 : 0);
    if (coreDistance <= 2) {
        if (ctx.buildAndCertifyEmergentMovieShelter(ctx.getPlayerWorldPosition(), actorId)) {
            if (view && ctx.getPlayerWorldPosition().distanceTo(view.position) > 0.55)
                ctx.walkToward(view.position, 0.35, 0, view.target, 3);
            else ctx.holdAt(view?.target ?? corePosition, 0, view ? 'interact' : undefined);
        }
    }
    return;
}
}
