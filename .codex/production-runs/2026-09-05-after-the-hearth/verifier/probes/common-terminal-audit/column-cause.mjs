/** Why the three COMMON footprint columns fail. Same bundle/provenance as common-terminal-repro.mjs. */
import { planAgentSurfaceRoute, createLiveAgentSurfaceTerrain, VOXEL_SCALE,
  STORY_SEED, STORY_PRIMARY_WORLD_ID, surfaceFaceFromUp, THREE }
  from '../handoff-standby-repair/bundle/repro.mjs';
const PS = 50, UP = new THREE.Vector3(0,1,0), FACE = surfaceFaceFromUp(UP);
const terrain = createLiveAgentSurfaceTerrain(PS, STORY_SEED, STORY_PRIMARY_WORLD_ID);
const cell = c => Math.round(c / VOXEL_SCALE);
const cols = [[-46,52.85,16],[-50,52.85,18],[-48,52.85,10],[-44,52.85,16],[-42,52.85,18],[-48,52.85,18],[-46,52.85,18]];
const out = [];
for (const [x,y,z] of cols) {
  const p = new THREE.Vector3(x,y,z);
  const probe = planAgentSurfaceRoute(terrain, PS, p.clone(), p.clone(), {
    face: FACE, differentFaceFallback:'unreachable', allowJetpackCrossing:false, maxVisitedCells:1 });
  const wide = planAgentSurfaceRoute(terrain, PS, p.clone(), p.clone(), {
    face: FACE, differentFaceFallback:'unreachable', allowJetpackCrossing:false, maxVisitedCells:4096 });
  const cx=cell(x), cz=cell(z);
  const stack=[];
  for (let cy=cell(y)+2; cy>=cell(y)-4; cy--) stack.push({cy, wy:cy*VOXEL_SCALE,
    solid: terrain.isSolidVoxel(cx,cy,cz), water: terrain.isWaterVoxel(cx,cy,cz),
    hazard: terrain.isHazardousVoxel?.(cx,cy,cz) ?? null});
  out.push({ column:[x,y,z], cellXZ:[cx,cz], probeMode:probe.mode, probeReason:probe.reason,
    probeWet:probe.requestedGoalWasWet, probeResolved: probe.resolvedGoal ? [probe.resolvedGoal.x,probe.resolvedGoal.y,probe.resolvedGoal.z] : null,
    wideMode: wide.mode, wideReason: wide.reason,
    wideResolved: wide.resolvedGoal ? [+wide.resolvedGoal.x.toFixed(3),+wide.resolvedGoal.y.toFixed(3),+wide.resolvedGoal.z.toFixed(3)] : null,
    stack });
}
console.log(JSON.stringify(out,null,1));
