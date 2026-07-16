import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getPublicFabricatorSections } from '../components/ui/Fabricator.model.ts';
import { RECIPES } from '../game/data/recipes.ts';
import {
  clearStationAccessSource,
  getAccessibleStations,
  resetStationAccessSources,
  setStationAccessSource
} from '../game/data/stations.ts';
import { craft } from '../game/systems/craftingSystem.ts';
import { getItemCount, resetInventory } from '../game/systems/inventorySystem.ts';
import { resetProgression } from '../game/systems/progressionSystem.ts';
import {
  applyShipRestorationSnapshot,
  resetShipRestoration
} from '../game/systems/shipRestoration.ts';
import {
  advanceToBeat,
  beginStory,
  completeStory,
  deactivateStory
} from './storyState.ts';
import { installKestrelFabricatorAccess } from './kestrelFabricator.ts';
import { claimKestrelFoundingReserve } from './kestrelFoundingReserve.ts';
import { isFabricatorRecipeAllowed } from './storyInputPolicy.ts';
import { STORY_PRIMARY_WORLD_ID, TIDEGARDEN_WORLD_ID } from './tidegardenRoute.ts';

const PRIMITIVE_RECIPES = [
  'biofuel',
  'stone_hatchet',
  'stone_pickaxe',
  'torch',
  'campfire',
  'waterskin'
] as const;

describe('Kestrel fabrication continuity from reconstruction through settlement', () => {
  beforeEach(() => {
    deactivateStory();
    resetProgression();
    resetInventory();
    resetShipRestoration();
    resetStationAccessSources();
  });

  afterEach(() => {
    deactivateStory();
    resetProgression();
    resetInventory();
    resetShipRestoration();
    resetStationAccessSources();
  });

  it('keeps stage-earned recipes narrow, survives the Ch7 source unmount, and crafts the Ch9 Core', () => {
    let activeWorldId = STORY_PRIMARY_WORLD_ID;
    const uninstall = installKestrelFabricatorAccess(() => activeWorldId);
    setStationAccessSource('test:wreck-bench', ['smelter', 'assembler']);
    beginStory();
    advanceToBeat('ch7-reconstruct');

    applyShipRestorationSnapshot({
      repairStage: 'hull_sealed',
      currentWorldId: STORY_PRIMARY_WORLD_ID
    });
    expect(visibleRecipeIds()).toEqual([...PRIMITIVE_RECIPES, 'lift_cell']);

    applyShipRestorationSnapshot({
      repairStage: 'lift_online',
      currentWorldId: STORY_PRIMARY_WORLD_ID
    });
    expect(visibleRecipeIds()).toEqual([...PRIMITIVE_RECIPES, 'logic_wafer', 'lift_cell']);

    applyShipRestorationSnapshot({
      repairStage: 'flight_ready',
      currentWorldId: STORY_PRIMARY_WORLD_ID
    });
    clearStationAccessSource('test:wreck-bench');
    expect(getAccessibleStations()).toEqual(['hand', 'smelter', 'assembler']);
    expect(visibleRecipeIds()).toEqual([...PRIMITIVE_RECIPES, 'logic_wafer', 'lift_cell']);

    advanceToBeat('ch8-landfall');
    expect(visibleRecipeIds()).toEqual([]);

    activeWorldId = TIDEGARDEN_WORLD_ID;
    applyShipRestorationSnapshot({
      repairStage: 'flight_ready',
      currentWorldId: TIDEGARDEN_WORLD_ID
    });
    advanceToBeat('ch9-settle');
    expect(claimKestrelFoundingReserve('test:founding-reserve')).toMatchObject({ ok: true });
    expect(visibleRecipeIds()).toEqual([
      ...PRIMITIVE_RECIPES,
      'logic_wafer',
      'lift_cell',
      'habitat_core'
    ]);
    expect(craft(RECIPES.habitat_core, { stations: getAccessibleStations() })).toMatchObject({ ok: true });
    expect(getItemCount('habitat_core')).toBe(1);

    completeStory();
    expect(visibleRecipeIds()).toEqual([
      ...PRIMITIVE_RECIPES,
      'logic_wafer',
      'lift_cell',
      'habitat_core'
    ]);
    uninstall();
  });
});

function visibleRecipeIds(): string[] {
  return getPublicFabricatorSections(isFabricatorRecipeAllowed)
    .flatMap(section => section.recipes.map(recipe => recipe.id));
}
