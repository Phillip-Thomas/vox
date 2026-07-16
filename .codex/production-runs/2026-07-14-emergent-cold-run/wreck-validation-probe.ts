import { getPodImpactPose, STORY_SEED } from '../../../main/src/story/world/storyWorld.ts';
import { getWorldGen } from '../../../main/src/utils/worldGenCache.ts';
import { SHIP_REST_CLEARANCE } from '../../../main/src/utils/shipDesign.ts';
import {
  findValidSpawnSite,
  isDryClearResumePosition,
  resolveSafeShipBoardingPosition
} from '../../../main/src/utils/spawnValidation.ts';

const impact = getPodImpactPose(50, STORY_SEED);
const position = impact.position.clone().addScaledVector(impact.up, SHIP_REST_CLEARANCE);
const generator = getWorldGen(50, STORY_SEED, '-1,-1').generator;
const terrain = {
  shouldVoxelExist: (x: number, y: number, z: number) => generator.shouldVoxelExist(x, y, z),
  isWaterVoxel: (x: number, y: number, z: number) => generator.isWaterVoxel(x, y, z),
  generateBlockForPosition: (x: number, y: number, z: number) =>
    generator.generateBlockForPosition(x, y, z)
};

console.log(JSON.stringify({
  impact: impact.position.toArray(),
  position: position.toArray(),
  resume: isDryClearResumePosition(terrain, 50, position, 'ship'),
  site0: findValidSpawnSite(terrain, 50, position, {
    kind: 'ship',
    maxSearchRadius: 0,
    requirePlayerEgress: true
  }),
  siteWithoutEgress: findValidSpawnSite(terrain, 50, position, {
    kind: 'ship',
    maxSearchRadius: 0,
    requirePlayerEgress: false
  }),
  safe: resolveSafeShipBoardingPosition(terrain, 50, position, 0),
  site4: findValidSpawnSite(terrain, 50, position, {
    kind: 'ship',
    maxSearchRadius: 4,
    requirePlayerEgress: true
  })
}, (_key, value) => value?.isVector3 ? value.toArray() : value, 2));
