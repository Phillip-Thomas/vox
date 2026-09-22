// Run-private CPU reproduction entry. Re-exports SHIPPED symbols only; no game
// source is modified. Bundled out-of-tree with the repo's own esbuild.
export { getWorldGen } from '../../../../../../main/src/utils/worldGenCache.ts';
export { voxelSystem } from '../../../../../../main/src/utils/efficientVoxelSystem.ts';
export { planAgentSurfaceRoute } from '../../../../../../main/src/utils/agentSurfaceNavigation.ts';
export { createLiveAgentSurfaceTerrain } from '../../../../../../main/src/utils/agentSurfaceNavigationRuntime.ts';
export { VOXEL_SCALE } from '../../../../../../main/src/utils/cubeGravityConstants.ts';
export { STORY_SEED, STORY_PRIMARY_WORLD_ID } from '../../../../../../main/src/story/world/storyWorldIdentity.ts';
export {
  CG_POSES, CG_ROUTE_SHORT, CG_ROUTE_LONG, CG_ROUTE_COMMON, BODY_BODY_CLEARANCE_UNITS
} from '../../../../../../main/src/story/commonGroundState.ts';
export { surfaceFaceFromUp } from '../../../../../../main/src/story/autopilotSteering.ts';
export * as THREE from 'three';
