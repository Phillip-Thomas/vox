import * as THREE from 'three';
import type { RailRuntime } from '../../autopilot.ts';

/** ch4-vigil: player inputs and registered world transactions only. */
export function tick(ctx: RailRuntime): void {
{
    // The scheduled sleep: hold by the NEAREST fire, rest when dark is
    // issued. Stale saves can carry a distant fire from an older session —
    // if the walk hasn't closed by mid-beat, light a fresh one here (the
    // screening's campfire-placement precedent) so the rest stays honest.
    const player = ctx.getPlayerWorldPosition();
    let firePos: THREE.Vector3 | null = null;
    let fireDist = Infinity;
    for (const fire of ctx.getCampfires()) {
        const dist = player.distanceTo(ctx._goalScratch.set(fire.pos[0], fire.pos[1], fire.pos[2]));
        if (dist < fireDist) {
            fireDist = dist;
            firePos = ctx._target.set(fire.pos[0], fire.pos[1], fire.pos[2]);
        }
    }
    if (!firePos || (ctx.beatClock > 50 && fireDist > 4)) {
        if (ctx.screeningActionReady() && ctx.autopilotWorldAccess.craft('campfire'))
            ctx.noteScreeningAction();
    }
    else if (fireDist > 2.4) {
        ctx.walkToward(firePos, 2.4); // reach the fire first, before the dark falls
    }
    else if (!ctx.vigilRestReady()) {
        // SWEEP the sky through the stargaze + constellation reveal, rather
        // than holding one bearing.
        //
        // The constellations are generated in the sky SHADER — roughly ten
        // figures scattered over a cube-face grid — and no CPU-side position
        // for any of them exists, so the camera cannot be aimed at one. The
        // previous framing locked a single direction off the fire and held it,
        // which made "does the audience watch a constellation form" a coin
        // flip decided by where the player happened to be standing. Owner
        // report: we don't always see the constellations forming.
        //
        // A slow pan fixes it without needing to know where the figures are:
        // over the reveal the frame crosses most of the upper sky, so some
        // figure resolves on camera. It also plays better than a locked stare,
        // which is the note the owner gave about the movie's framing generally.
        ctx.controls.forward = false;
        ctx.controls.backward = false;
        ctx.controls.left = false;
        ctx.controls.right = false;
        const up = ctx.getPlayerUp();
        ctx.setCinematicLookTarget(ctx.vigilSkyLookTarget(player, up, firePos, ctx.beatClock, ctx._goalScratch));
        ctx.setCinematicGazeIntent(null);
        ctx.setCinematicLookWeight(1);
    }
    else {
        ctx.controls.forward = false;
        ctx.setCinematicLookWeight(0);
        ctx.pulseInteract(); // rests once the sky has finished and the prompt lands
    }
    return;
}
}
