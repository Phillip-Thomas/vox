import { harvestTreeCommand } from '../game/gameplayCommands.ts';
import { resetTreeHarvest } from '../game/systems/treeHarvest.ts';
import { claimWreckSalvage } from '../game/systems/shipRepairTransactions.ts';
import { claimKestrelFoundingReserve } from './kestrelFoundingReserve.ts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import * as commandDispatchAdapter from '../game/commandDispatchAdapter.ts';
import * as multiplayerSession from '../game/multiplayerSession.ts';
import type { BlockId } from '../game/data/blocks.ts';
import { RECIPES } from '../game/data/recipes.ts';
import { setStationAccessSource, resetStationAccessSources } from '../game/data/stations.ts';
import { createOfflineCommandContext } from '../game/gameplayCommands.ts';
import { createPlanetIdentity } from '../game/starSystem.ts';
import { resetAccomplishments } from '../game/systems/accomplishmentLedger.ts';
import { resetHabitats, getHabitatWorldState } from '../game/systems/habitatSystem.ts';
import { addItem, getItemCount, removeItem, resetInventory } from '../game/systems/inventorySystem.ts';
import { hasMilestone, resetProgression } from '../game/systems/progressionSystem.ts';
import {
  applyShipRestorationSnapshot,
  getShipRepairStage,
  resetShipRestoration
} from '../game/systems/shipRestoration.ts';
import { getPieces, resetStructures, setFreeBuild } from '../game/systems/structureSystem.ts';
import type { SpawnTerrainQuery } from '../utils/spawnValidation.ts';
import {
  buildAndCertifyEmergentMovieShelter,
  completeEmergentMovieSafeRest,
  emergentMovieConstructionWoodNeeded,
  emergentMovieShelterView,
  findEmergentMovieHabitatGoal,
  installEmergentMovieHabitatCore,
  prepareEmergentMovieHabitatCore,
  prepareEmergentMovieWreckCraft,
  registerEmergentMovieSettlementBinding,
  registerEmergentMovieWreckBinding,
  resetEmergentMovieRuntimeForTests
} from './emergentMovieRuntime.ts';
import { resetEmergentStoryEvents } from './emergentStoryEvents.ts';
import {
  attendTidegardenRelationship,
  commitTidegardenScannerOverload,
  chooseTidegardenHabitatSite,
  TIDEGARDEN_RELATIONSHIP_ID,
  TIDEGARDEN_SETTLEMENT_MILESTONES,
  type TidegardenRelationshipProof
} from './tidegardenSettlement.ts';
import { STORY_PRIMARY_WORLD_ID, TIDEGARDEN_WORLD_ID } from './tidegardenRoute.ts';
import { STORY_COORDINATE } from './world/storyWorld.ts';

const ACTOR = 'local';
const TERRAIN: SpawnTerrainQuery = {
  shouldVoxelExist: (x, y, z) => Math.abs(x) <= 5 && Math.abs(z) <= 5 && y <= 4,
  isWaterVoxel: () => false,
  generateBlockForPosition: () => 'stone' as BlockId
};
const PLAYER = new THREE.Vector3(0, 10.2, 0);
const RELATIONSHIP: TidegardenRelationshipProof = {
  worldId: TIDEGARDEN_WORLD_ID,
  relationshipId: TIDEGARDEN_RELATIONSHIP_ID,
  position: new THREE.Vector3(8, 10, 0),
  waterDepth: 3,
  sourceKey: 'deterministic-waterline'
};

function attendRelationshipForTest(event: string): void {
  expect(commitTidegardenScannerOverload({ worldId: TIDEGARDEN_WORLD_ID, renderedFrames: 1,
    visibleSignalIds: ['a', 'b', 'c', 'd', 'e', 'f'],
    relationshipKinds: ['water-root', 'canopy-shelter', 'pollen-route'] }, `${event}:scanner`, ACTOR).ok).toBe(true);
  expect(attendTidegardenRelationship(RELATIONSHIP, event, ACTOR).ok).toBe(true);
}

describe('emergent movie runtime — legal transaction bridge', () => {
  beforeEach(() => {
    resetEmergentMovieRuntimeForTests();
    resetStationAccessSources();
    resetShipRestoration();
    resetHabitats();
    resetStructures();
    resetInventory();
    resetTreeHarvest();
    resetProgression();
    resetAccomplishments();
    resetEmergentStoryEvents();
    setFreeBuild(false);
  });

  afterEach(() => vi.restoreAllMocks());

  it('crafts only the two repair components at the Origin wreck bench', () => {
    const context = createOfflineCommandContext(
      createPlanetIdentity({ system: STORY_COORDINATE, slot: 0 }),
      { actorId: ACTOR, now: () => 7744 }
    );
    expect(context.world.worldId).toBe(STORY_PRIMARY_WORLD_ID);
    registerEmergentMovieWreckBinding({
      commandContext: context,
      workstationPosition: new THREE.Vector3(0, 10, 0)
    });
    setStationAccessSource('test:wreck-bench', ['smelter', 'assembler']);

    applyShipRestorationSnapshot({ repairStage: 'hull_sealed' });
    // Empty inventory must never become a crafted component.
    expect(prepareEmergentMovieWreckCraft(ACTOR)).toBe(false);
    expect(getItemCount('lift_cell', ACTOR)).toBe(0);
    expect(claimWreckSalvage('test:finite-cache', ACTOR)).toBe(true);
    // The first three already completed repair acts spent these cache inputs.
    removeItem('strut_frame', 1, ACTOR);
    removeItem('refined_alloy', 1, ACTOR);
    removeItem('silica_pane', 1, ACTOR);
    removeItem('biocomposite', 1, ACTOR);
    expect(prepareEmergentMovieWreckCraft(ACTOR)).toBe(true);
    expect(getItemCount('lift_cell', ACTOR)).toBe(1);
    expect(getShipRepairStage()).toBe('hull_sealed');

    removeItem('lift_cell', 1, ACTOR);
    applyShipRestorationSnapshot({ repairStage: 'lift_online' });
    expect(prepareEmergentMovieWreckCraft(ACTOR)).toBe(true);
    expect(getItemCount('logic_wafer', ACTOR)).toBe(1);
    expect(getShipRepairStage()).toBe('lift_online');

    removeItem('logic_wafer', 1, ACTOR);
    applyShipRestorationSnapshot({ repairStage: 'flight_ready' });
    expect(prepareEmergentMovieWreckCraft(ACTOR)).toBe(true);
    expect(getItemCount('habitat_core', ACTOR)).toBe(0);
    expect(getShipRepairStage()).toBe('flight_ready');
  });

  it('holds an online movie craft until its authoritative command settles', () => {
    const context = createOfflineCommandContext(
      createPlanetIdentity({ system: STORY_COORDINATE, slot: 1 }),
      { actorId: ACTOR, now: () => 7744 }
    );
    registerEmergentMovieSettlementBinding({
      commandContext: context,
      planetSize: 12,
      terrain: TERRAIN,
      relationship: RELATIONSHIP
    });
    setStationAccessSource('test:carried-assembler', ['smelter', 'assembler']);
    for (const input of RECIPES.habitat_core.inputs) addItem(input.id, input.qty, ACTOR);

    let unsettled = false;
    vi.spyOn(commandDispatchAdapter, 'resolveMultiplayerCommandLane').mockReturnValue('online');
    vi.spyOn(multiplayerSession, 'isMultiplayerAuthoritativeCommandUnsettled')
      .mockImplementation(() => unsettled);
    const dispatch = vi.spyOn(commandDispatchAdapter, 'dispatchGameplayCommand')
      .mockImplementation((runLocalCommand) => {
        const result = runLocalCommand();
        if (result.ok) unsettled = true;
        return result;
      });

    expect(prepareEmergentMovieHabitatCore(ACTOR)).toBe(false);
    expect(getItemCount('habitat_core', ACTOR)).toBe(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]?.[1]).toMatchObject({
      multiplayer: {
        commandType: 'recipe_crafted',
        payload: { recipeId: 'habitat_core' }
      }
    });

    // Optimistic output alone cannot advance the movie or resend the command.
    expect(prepareEmergentMovieHabitatCore(ACTOR)).toBe(false);
    expect(dispatch).toHaveBeenCalledTimes(1);
    unsettled = false;
    expect(prepareEmergentMovieHabitatCore(ACTOR)).toBe(true);
  });

  it('builds, certifies, and rests in a live physical enclosure without acceptance injection', () => {
    const context = createOfflineCommandContext(
      createPlanetIdentity({ system: STORY_COORDINATE, slot: 1 }),
      { actorId: ACTOR, now: () => 7744 }
    );
    registerEmergentMovieSettlementBinding({
      commandContext: context,
      planetSize: 12,
      terrain: TERRAIN,
      relationship: RELATIONSHIP
    });
    setStationAccessSource('test:carried-assembler', ['smelter', 'assembler']);
    expect(commitTidegardenScannerOverload({
      worldId: TIDEGARDEN_WORLD_ID,
      renderedFrames: 1,
      visibleSignalIds: ['a', 'b', 'c', 'd', 'e', 'f'],
      relationshipKinds: ['water-root', 'canopy-shelter', 'pollen-route']
    }, 'story:test:movie-scanner', ACTOR).ok).toBe(true);
    expect(attendTidegardenRelationship(
      RELATIONSHIP,
      'story:test:movie-relationship',
      ACTOR
    ).ok).toBe(true);
    expect(prepareEmergentMovieHabitatCore(ACTOR)).toBe(false);
    expect(getItemCount('habitat_core', ACTOR)).toBe(0);
    applyShipRestorationSnapshot({ repairStage: 'flight_ready' });
    expect(claimKestrelFoundingReserve('test:finite-reserve', ACTOR).ok).toBe(true);
    expect(prepareEmergentMovieHabitatCore(ACTOR)).toBe(true);
    expect(getItemCount('habitat_core', ACTOR)).toBe(1);
    const goal = findEmergentMovieHabitatGoal(PLAYER);
    expect(goal).not.toBeNull();
    if (!goal) throw new Error('Expected a live dry habitat goal.');
    expect(emergentMovieConstructionWoodNeeded()).toBe(38);
    expect(installEmergentMovieHabitatCore(goal, ACTOR)).toBe(false);
    expect(getHabitatWorldState(TIDEGARDEN_WORLD_ID)).toBeNull();
    // Seven real trees pay construction; placement cannot provision its own cost.
    for (let x = 0; x < 7; x++) expect(harvestTreeCommand(context, { x, y: 4, z: 0 }).ok).toBe(true);
    const woodBefore = getItemCount('wood', ACTOR);
    expect(installEmergentMovieHabitatCore(goal, ACTOR)).toBe(true);
    const habitat = getHabitatWorldState(TIDEGARDEN_WORLD_ID);
    expect(habitat).not.toBeNull();
    if (!habitat) throw new Error('Expected the Core transaction to persist.');

    const corePosition = new THREE.Vector3(...habitat.core.position);
    expect(emergentMovieConstructionWoodNeeded()).toBe(34);
    expect(buildAndCertifyEmergentMovieShelter(corePosition, ACTOR)).toBe(true);
    expect(getItemCount('wood', ACTOR)).toBe(woodBefore - 38);
    expect(emergentMovieConstructionWoodNeeded()).toBe(0);
    const view = emergentMovieShelterView()!;
    expect(view.position.distanceTo(corePosition)).toBe(2);
    expect(view.position.distanceTo(view.target)).toBeGreaterThan(2);
    expect(hasMilestone(TIDEGARDEN_SETTLEMENT_MILESTONES.shelterCertified, ACTOR)).toBe(true);
    expect(completeEmergentMovieSafeRest(corePosition, 0.75, ACTOR)).toBe(true);
    expect(hasMilestone(TIDEGARDEN_SETTLEMENT_MILESTONES.safeRestCompleted, ACTOR)).toBe(true);
    expect(hasMilestone(TIDEGARDEN_SETTLEMENT_MILESTONES.twoWorldHandoff, ACTOR)).toBe(true);
    expect(getHabitatWorldState(TIDEGARDEN_WORLD_ID)).toMatchObject({
      shelterCertification: { interiorCellCount: 4 },
      safeRest: { dayPhase: 0.75 }
    });
  });

  it('does not spend a foundation in the neighbouring cell while still approaching the chosen site', () => {
    const context = createOfflineCommandContext(
      createPlanetIdentity({ system: STORY_COORDINATE, slot: 1 }), { actorId: ACTOR, now: () => 7744 }
    );
    registerEmergentMovieSettlementBinding({ commandContext: context, planetSize: 12, terrain: TERRAIN, relationship: RELATIONSHIP });
    attendRelationshipForTest('test:nearby-site-relationship');
    expect(chooseTidegardenHabitatSite({ worldId: TIDEGARDEN_WORLD_ID, planetSize: 12,
      playerPosition: PLAYER, terrain: TERRAIN, actorId: ACTOR, commandContext: context,
      eventId: 'test:nearby-site-choice' }).ok).toBe(true);
    for (let x = 0; x < 7; x++) expect(harvestTreeCommand(context, { x, y: 4, z: 0 }).ok).toBe(true);
    const before = getItemCount('wood', ACTOR);
    // Candidate2 entered this neighbouring voxel at 1.90 m from the target and
    // spent four wood before the site validator rejected different-site-chosen.
    expect(installEmergentMovieHabitatCore(PLAYER.clone().add(new THREE.Vector3(-1.9, 0, 0)), ACTOR)).toBe(false);
    expect(getPieces()).toEqual([]);
    expect(getItemCount('wood', ACTOR)).toBe(before);
    expect(getHabitatWorldState(TIDEGARDEN_WORLD_ID)).toBeNull();
    expect(findEmergentMovieHabitatGoal(PLAYER.clone().add(new THREE.Vector3(-1.9, 0, 0)))?.x).toBe(0);
  });

  it('counts an already paid chosen foundation before the carried Core can be installed', () => {
    const context = createOfflineCommandContext(
      createPlanetIdentity({ system: STORY_COORDINATE, slot: 1 }), { actorId: ACTOR, now: () => 7744 }
    );
    registerEmergentMovieSettlementBinding({ commandContext: context, planetSize: 12, terrain: TERRAIN, relationship: RELATIONSHIP });
    attendRelationshipForTest('test:partial-foundation-relationship');
    expect(chooseTidegardenHabitatSite({ worldId: TIDEGARDEN_WORLD_ID, planetSize: 12,
      playerPosition: PLAYER, terrain: TERRAIN, actorId: ACTOR, commandContext: context,
      eventId: 'test:partial-foundation-choice' }).ok).toBe(true);
    for (let x = 0; x < 7; x++) expect(harvestTreeCommand(context, { x, y: 4, z: 0 }).ok).toBe(true);
    const before = getItemCount('wood', ACTOR);
    expect(emergentMovieConstructionWoodNeeded()).toBe(38);
    expect(installEmergentMovieHabitatCore(PLAYER, ACTOR)).toBe(false); // Core not carried yet
    expect(getHabitatWorldState(TIDEGARDEN_WORLD_ID)).toBeNull();
    expect(getPieces()).toHaveLength(1);
    expect(getItemCount('wood', ACTOR)).toBe(before - 4);
    expect(emergentMovieConstructionWoodNeeded()).toBe(34);
    expect(installEmergentMovieHabitatCore(PLAYER, ACTOR)).toBe(false);
    expect(getItemCount('wood', ACTOR)).toBe(before - 4);
  });
});
