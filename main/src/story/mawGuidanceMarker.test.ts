import { beforeEach, describe, expect, it } from 'vitest';
import { createOfflineCommandContext } from '../game/gameplayCommands.ts';
import { createSimulationRng } from '../game/rng.ts';
import { createWorldIdentity } from '../game/worldIdentity.ts';
import { addItem, resetInventory } from '../game/systems/inventorySystem.ts';
import { markMilestone, resetProgression } from '../game/systems/progressionSystem.ts';
import { resetMaw } from '../game/systems/mawSystem.ts';
import { resetAccomplishments } from '../game/systems/accomplishmentLedger.ts';
import {
  advanceEmergentMawRepairRitual,
  advanceMawPurposeGap,
  beginEmergentMawRepairRitual,
  commitMawFirstDirection,
  commitMawPondResonance,
  resetEmergentMawRepairRitual
} from './emergentMawRepair.ts';
import { emergentStoryDirectorTick } from './emergentStoryDirector.ts';
import { resetEmergentStoryEvents } from './emergentStoryEvents.ts';
import { storyFreeMarkerTarget } from './storyDirector.ts';
import {
  advanceToBeat,
  beginStory,
  deactivateStory,
  getStoryStateSnapshot
} from './storyState.ts';
import { resetStoryClock } from './storyClock.ts';
import {
  clearGuidedStoryObjective,
  getActiveGuidedStoryObjective
} from './ux/objectiveDirector.ts';
import {
  establishFieldPackDropPose,
  getPondPose,
  resetFieldPackDropPoseAuthority,
  STORY_SEED,
  storyAnchors
} from './world/storyWorld.ts';
import { getWorldGen } from '../utils/worldGenCache.ts';
import { STORY_PRIMARY_WORLD_ID } from './tidegardenRoute.ts';

const PLANET_SIZE = 50;
const context = createOfflineCommandContext(createWorldIdentity({ x: -1, y: -1 }), {
  rng: createSimulationRng('maw-guidance-marker-parity'),
  now: () => 0
});

function expectObjectiveMarkerParity(id: string): void {
  emergentStoryDirectorTick(0);
  const objective = getActiveGuidedStoryObjective();
  const marker = storyFreeMarkerTarget();
  expect(objective?.id).toBe(id);
  expect(marker).not.toBeNull();
  expect(marker?.label).toBe(objective?.markerLabel);
}

describe('Chapter 5 objective and marker contract', () => {
  beforeEach(() => {
    deactivateStory();
    clearGuidedStoryObjective();
    resetProgression();
    resetInventory();
    resetMaw();
    resetAccomplishments();
    resetEmergentStoryEvents();
    resetEmergentMawRepairRitual();
    resetStoryClock();
    resetFieldPackDropPoseAuthority();
    storyAnchors.planetSize = PLANET_SIZE;
    storyAnchors.terrainSeed = STORY_SEED;
    storyAnchors.pond = getPondPose(PLANET_SIZE, STORY_SEED);
    beginStory();
    advanceToBeat('ch5-maw');
    const generator = getWorldGen(
      PLANET_SIZE,
      STORY_SEED,
      STORY_PRIMARY_WORLD_ID
    ).generator;
    establishFieldPackDropPose({
      planetSize: PLANET_SIZE,
      terrainSeed: STORY_SEED,
      terrain: {
        isSolidVoxel: (x, y, z) => generator.shouldVoxelExist(x, y, z),
        isWaterVoxel: (x, y, z) => generator.isWaterVoxel(x, y, z),
        isHazardousVoxel: (x, y, z) => generator.generateBlockForPosition(x, y, z) === 'lava'
      },
      worldId: STORY_PRIMARY_WORLD_ID,
      terrainRevision: `${STORY_PRIMARY_WORLD_ID}:test:0`,
      storyRunId: getStoryStateSnapshot().runId,
      source: 'direct-ch5-fallback'
    });
    addItem('faulty_maw', 1);
  });

  it('keeps every repair state visible and bound to the exact same directional label', () => {
    expectObjectiveMarkerParity('maw:recover-field-kit');

    addItem('maw_repair_kit', 1);
    markMilestone('story:item:maw-repair-kit:acquired');
    expectObjectiveMarkerParity('maw:begin-repair');

    beginEmergentMawRepairRitual(context, 'story:test:maw-guidance-repair');
    expectObjectiveMarkerParity('maw:attend-repair');

    for (let index = 0; index < 16; index++) {
      advanceEmergentMawRepairRitual(context, true, 2.4);
    }
    expectObjectiveMarkerParity('maw:purpose-gap');

    for (let index = 0; index < 4; index++) advanceMawPurposeGap(context, 2.4);
    expectObjectiveMarkerParity('maw:choose-first-direction');

    expect(commitMawFirstDirection(
      context,
      'lowered-and-listened',
      'story:test:maw-guidance-direction'
    ).ok).toBe(true);
    expectObjectiveMarkerParity('maw:observe-pond-response');
    expect(storyFreeMarkerTarget()?.position.distanceTo(storyAnchors.pond!.shore)).toBeLessThan(1e-6);

    expect(commitMawPondResonance(
      context,
      true,
      'story:test:maw-guidance-resonance'
    ).ok).toBe(true);
    expectObjectiveMarkerParity('maw:resonance-settling');
  });
});
