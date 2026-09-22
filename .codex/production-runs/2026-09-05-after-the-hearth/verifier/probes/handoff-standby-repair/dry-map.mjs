import {
  getWorldGen, planAgentSurfaceRoute, createLiveAgentSurfaceTerrain, VOXEL_SCALE,
  STORY_SEED, STORY_PRIMARY_WORLD_ID, surfaceFaceFromUp, THREE
} from './bundle/repro.mjs';
const PLANET_SIZE = 50; const UP = new THREE.Vector3(0,1,0); const FACE = surfaceFaceFromUp(UP);
const terrain = createLiveAgentSurfaceTerrain(PLANET_SIZE, STORY_SEED, STORY_PRIMARY_WORLD_ID);
const cell = c => Math.round(c / VOXEL_SCALE);
const GROUND_CLEARANCE = 1.05, CONTACT_TOLERANCE = 0.35, RENDERED = 25;
const rendered = (x,y,z) => Math.max(Math.abs(x),Math.abs(y),Math.abs(z)) <= RENDERED;
const solid = (x,y,z) => rendered(x,y,z) && terrain.isSolidVoxel(x,y,z);
const supportedColumn = (x,y,z) => {
  const cx=cell(x), cz=cell(z), cy=cell(y-GROUND_CLEARANCE);
  if(!solid(cx,cy,cz)) return false;
  if(solid(cx,cy+1,cz)) return false;
  if(terrain.isWaterVoxel(cx,cy,cz)||terrain.isWaterVoxel(cx,cy+1,cz)) return false;
  if(terrain.isHazardousVoxel?.(cx,cy,cz)) return false;
  return Math.abs(y - (cy*VOXEL_SCALE+VOXEL_SCALE/2)) <= CONTACT_TOLERANCE;
};
const isSupported = p => supportedColumn(p.x,p.y,p.z) && supportedColumn(p.x+0.5,p.y,p.z)
  && supportedColumn(p.x-0.5,p.y,p.z) && supportedColumn(p.x,p.y,p.z+0.5) && supportedColumn(p.x,p.y,p.z-0.5);
const certify = p => {
  const probe = planAgentSurfaceRoute(terrain, PLANET_SIZE, new THREE.Vector3(p.x,p.y,p.z), new THREE.Vector3(p.x,p.y,p.z),
    { face: FACE, differentFaceFallback:'unreachable', allowJetpackCrossing:false, maxVisitedCells:1 });
  return !(probe.mode === 'unreachable' || probe.requestedGoalWasWet);
};
let header = '        ';
for (let z = 2; z <= 28; z += 2) header += String(z).padStart(4);
console.log('rows x, cols z; D=dry+certified+footed, c=certified only, .=no');
console.log(header);
for (let x = -22; x >= -54; x -= 2) {
  let line = String(x).padStart(6) + '  ';
  for (let z = 2; z <= 28; z += 2) {
    const p = { x, y: 51.05, z };
    const f = isSupported(p), c = certify(p);
    line += (f && c ? '   D' : c ? '   c' : '   .');
  }
  console.log(line);
}
