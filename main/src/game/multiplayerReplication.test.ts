import { beforeEach, describe, expect, it } from 'vitest';
import { createPlayerPose } from './playerPose.ts';
import {
  applyPendingReplicatedTerrainDiff,
  applyPendingReplicatedWaterFlood,
  applyReplicatedPlayerStateSnapshot,
  applyReplicatedStoryStateSnapshot,
  applyReplicatedWaterFlooded,
  applyReplicatedWorldEvent,
  applyReplicatedWorldSnapshotEvents,
  applyReplicatedWorldSnapshotTerrain,
  applyReplicatedVoxelMined,
  applyRemotePoseSnapshot,
  applyRemotePoseUpdate,
  clearPendingReplicatedTerrainDiffs,
  clearPendingReplicatedWaterFloods,
  extractSnapshotVoxelMinedCoords,
  extractSnapshotPoseEntries,
  extractSnapshotWorldEvents,
  getPendingReplicatedTerrainDiffCount,
  getPendingReplicatedWaterFloodCount,
  parseReplicatedWorldEvent,
  readCoord,
  readVec3,
  setActiveReplicatedTerrainWorld,
  setActiveReplicatedWaterWorld,
  toPosePayload
} from './multiplayerReplication.ts';
import { getPlayerPose, resetPlayerPoses, setPlayerPose } from './systems/playerPoseSystem.ts';
import { isTreeHarvested, markTreeHarvested, resetTreeHarvest } from './systems/treeHarvest.ts';
import { isStoneCollected, markStoneCollected, resetStonePickup } from './systems/stonePickup.ts';
import { isForageCollected, markForageCollected, resetForagePickup } from './systems/foragePickup.ts';
import { isFloraHarvested, markFloraHarvested, resetFloraHarvest } from './systems/floraHarvest.ts';
import { getCampfires, resetCampfires } from './systems/campfires.ts';
import { getPieceAt, resetStructures, restorePieces } from './systems/structureSystem.ts';
import { getItemCount, resetAllInventories } from './systems/inventorySystem.ts';
import { getVitals, resetAllVitals } from './systems/survivalVitals.ts';
import { getMawCharge, resetAllMawState } from './systems/mawSystem.ts';
import { getWaterskinFill, resetAllWaterskins } from './systems/consumeSystem.ts';
import {
  getCurrentEra,
  hasMilestone,
  markMilestone,
  removeMilestone,
  resetProgression
} from './systems/progressionSystem.ts';
import { getWorldCollisionChangeSnapshot, resetWorldCollisionChangesForTests } from './worldCollisionReconciliation.ts';
import { getHabitatWorldState, resetHabitats } from './systems/habitatSystem.ts';
import { getShipRepairStage, resetShipRestoration } from './systems/shipRestoration.ts';
import { ProceduralWorldGenerator } from '../utils/proceduralWorldGenerator.ts';
import { createTerrainConfig } from '../utils/terrainConfig.ts';
import {
  getEmergentStoryEvents,
  resetEmergentStoryEvents
} from '../story/emergentStoryEvents.ts';
import { EMERGENT_MAW_MILESTONES } from '../story/emergentMawRepair.ts';
import {
  clearAuthoritativeStructureReceipts,
  hasAuthoritativeStructureReceipt
} from './authoritativeStructureReceipts.ts';
import { resetLocalActorId, setLocalActorId } from './playerActors.ts';
import {
  EMERGENT_CAPABILITY_MILESTONES,
  isStoryJetInstalled
} from '../story/emergentCapabilities.ts';
import {
  WRECK_SALVAGE,
  WRECK_SALVAGE_MILESTONE
} from './systems/shipRepairTransactions.ts';

const WATER_TEST_RADIUS = 25;
const WATER_NEIGHBORS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1]
];

function makeWaterTestGenerator(seed = 13579): ProceduralWorldGenerator {
  return new ProceduralWorldGenerator(
    { planetRadius: WATER_TEST_RADIUS, coreRadiusPercent: 0.15 },
    createTerrainConfig(seed, WATER_TEST_RADIUS)
  );
}

function findDryBelowSeaCellAdjacentToWater(gen: ProceduralWorldGenerator): [number, number, number] {
  const sea = gen.getSeaLevelRadius();
  for (const water of gen.getExposedWaterVoxels()) {
    for (const [dx, dy, dz] of WATER_NEIGHBORS) {
      const x = water.x + dx;
      const y = water.y + dy;
      const z = water.z + dz;
      const radius = Math.max(Math.abs(x), Math.abs(y), Math.abs(z));
      if (radius <= sea && !gen.isWaterVoxel(x, y, z)) return [x, y, z];
    }
  }
  throw new Error('Could not find a dry below-sea water-adjacent cell');
}

beforeEach(() => {
  resetLocalActorId();
  resetPlayerPoses();
  clearPendingReplicatedTerrainDiffs();
  clearPendingReplicatedWaterFloods();
  setActiveReplicatedTerrainWorld(null);
  setActiveReplicatedWaterWorld(null);
  resetTreeHarvest();
  resetStonePickup();
  resetForagePickup();
  resetFloraHarvest();
  resetCampfires();
  resetStructures();
  clearAuthoritativeStructureReceipts();
  resetAllInventories();
  resetAllVitals();
  resetAllMawState();
  resetAllWaterskins();
  resetProgression();
  resetHabitats();
  resetShipRestoration();
  resetWorldCollisionChangesForTests();
  resetEmergentStoryEvents();
});

describe('multiplayer replication', () => {
  it('projects a remote wreck claim as shared consumption without copying its outputs', () => {
    setLocalActorId('alice');
    const outputs = WRECK_SALVAGE.map(stack => ({ ...stack }));

    expect(applyReplicatedWorldEvent({
      seq: 1,
      commandId: 'story:wreck:claimed-by-bob',
      type: 'wreck_salvage_claimed',
      playerId: 'bob',
      payload: { cacheId: 'kestrel-wreck', outputs }
    }, { worldId: '-1,-1' })).toBe(true);

    expect(hasMilestone(WRECK_SALVAGE_MILESTONE, 'bob')).toBe(true);
    expect(hasMilestone(WRECK_SALVAGE_MILESTONE, 'alice')).toBe(true);
    for (const stack of WRECK_SALVAGE) {
      expect(getItemCount(stack.id, 'bob')).toBe(stack.qty);
      expect(getItemCount(stack.id, 'alice')).toBe(0);
    }

    expect(applyReplicatedPlayerStateSnapshot({
      players: {
        progression: {
          alice: { era: 'emergent', milestones: ['story:started'] }
        }
      }
    })).toBe(true);
    expect(hasMilestone(WRECK_SALVAGE_MILESTONE, 'alice')).toBe(true);
    for (const stack of WRECK_SALVAGE) expect(getItemCount(stack.id, 'alice')).toBe(0);
  });

  it('projects shared lift capability to the local peer on lift and flight-ready events', () => {
    setLocalActorId('alice');
    markMilestone('story:started', 'alice');
    expect(isStoryJetInstalled('alice')).toBe(false);

    const stages = ['bench_online', 'frame_restored', 'hull_sealed', 'lift_online'] as const;
    stages.forEach((stage, index) => {
      expect(applyReplicatedWorldEvent({
        seq: index + 1,
        commandId: `story:repair:${stage}:bob`,
        type: 'ship_repair_stage',
        playerId: 'bob',
        payload: { to: stage }
      }, { worldId: '-1,-1' })).toBe(true);
    });
    expect(isStoryJetInstalled('alice')).toBe(true);
    expect(isStoryJetInstalled('bob')).toBe(true);

    removeMilestone(EMERGENT_CAPABILITY_MILESTONES.jetInstalled, 'alice');
    expect(isStoryJetInstalled('alice')).toBe(false);
    expect(applyReplicatedWorldEvent({
      seq: 5,
      commandId: 'story:repair:flight-ready:bob',
      type: 'ship_repair_stage',
      playerId: 'bob',
      payload: { to: 'flight_ready' }
    }, { worldId: '-1,-1' })).toBe(true);
    expect(isStoryJetInstalled('alice')).toBe(true);
  });

  it('projects the two-phase authoritative Maw ritual without trusting client elapsed fields', () => {
    expect(applyReplicatedWorldEvent({
      seq: 1,
      commandId: 'maw:ritual-begun',
      type: 'maw_repair_begun',
      playerId: 'alice',
      payload: {
        ritualBeginCommandId: 'maw:ritual-begun',
        ritualSeconds: 8,
        elapsedMs: 999_999
      }
    }, { worldId: '-1,-1' })).toBe(true);
    expect(hasMilestone('maw_repaired', 'alice')).toBe(false);

    expect(applyReplicatedWorldEvent({
      seq: 2,
      commandId: 'maw:repair',
      type: 'maw_repaired',
      playerId: 'alice',
      payload: {
        ritualBeginCommandId: 'maw:ritual-begun',
        minimumAttendanceMs: 8_000
      }
    }, { worldId: '-1,-1' })).toBe(true);
    expect(hasMilestone('maw_repaired', 'alice')).toBe(true);
  });

  it('projects only canonical server Maw direction and pond receipts', () => {
    expect(applyReplicatedWorldEvent({
      seq: 1,
      commandId: 'maw:direction',
      type: 'maw_first_direction_resolved',
      playerId: 'alice',
      payload: {
        choice: 'harmless-test',
        repairCommandId: 'maw:repair',
        proofCommandId: 'maw:test-mine',
        targetKind: 'stone',
        minimumPurposeGapMs: 2_000
      }
    }, { worldId: '-1,-1' })).toBe(true);
    expect(hasMilestone(EMERGENT_MAW_MILESTONES.directionResolved, 'alice')).toBe(true);
    expect(hasMilestone('story:maw:first-direction:harmless-test', 'alice')).toBe(true);

    expect(applyReplicatedWorldEvent({
      seq: 2,
      commandId: 'maw:forged-direction',
      type: 'maw_first_direction_resolved',
      playerId: 'bob',
      payload: {
        choice: 'harmless-test',
        repairCommandId: 'maw:repair',
        proofCommandId: 'maw:test-mine',
        targetKind: 'lava',
        minimumPurposeGapMs: 2_000
      }
    }, { worldId: '-1,-1' })).toBe(false);
    expect(hasMilestone(EMERGENT_MAW_MILESTONES.directionResolved, 'bob')).toBe(false);

    expect(applyReplicatedWorldEvent({
      seq: 3,
      commandId: 'maw:pond-begin',
      type: 'maw_pond_observation_begun',
      playerId: 'alice',
      payload: {
        observationBeginCommandId: 'maw:pond-begin',
        directionCommandId: 'maw:direction',
        poseSeq: 12,
        maximumPoseAgeMs: 5_000,
        minimumObservationMs: 550,
        physicalProximityCertified: false
      }
    }, { worldId: '-1,-1' })).toBe(true);
    expect(hasMilestone(EMERGENT_MAW_MILESTONES.pondResonance, 'alice')).toBe(false);

    expect(applyReplicatedWorldEvent({
      seq: 4,
      commandId: 'maw:pond-complete',
      type: 'maw_pond_resonance_observed',
      playerId: 'alice',
      payload: {
        observationBeginCommandId: 'maw:pond-begin',
        directionCommandId: 'maw:direction',
        beginPoseSeq: 12,
        completionPoseSeq: 15,
        minimumObservationMs: 550,
        physicalProximityCertified: false
      }
    }, { worldId: '-1,-1' })).toBe(true);
    expect(hasMilestone(EMERGENT_MAW_MILESTONES.pondResonance, 'alice')).toBe(true);
  });

  it('applies the canonical Kestrel founding reserve once for a resumed Ch9 actor', () => {
    const event = {
      seq: 1,
      commandId: 'founding-reserve',
      type: 'kestrel_founding_reserve_claimed',
      playerId: 'alice',
      payload: {
        reserveId: 'tidegarden-founding-loadout',
        outputs: [
          { id: 'strut_frame', qty: 1 },
          { id: 'refined_alloy', qty: 1 },
          { id: 'logic_wafer', qty: 1 }
        ]
      }
    };
    expect(applyReplicatedWorldEvent({
      ...event,
      seq: 0,
      payload: { ...event.payload, outputs: [{ id: 'habitat_core', qty: 99 }] }
    }, { worldId: '-1,-1:p1' })).toBe(false);
    expect(getItemCount('habitat_core', 'alice')).toBe(0);
    expect(hasMilestone('story:kestrel:founding-reserve-claimed', 'alice')).toBe(false);
    expect(applyReplicatedWorldEvent(event, { worldId: '-1,-1:p1' })).toBe(true);
    expect(getItemCount('strut_frame', 'alice')).toBe(1);
    expect(getItemCount('refined_alloy', 'alice')).toBe(1);
    expect(getItemCount('logic_wafer', 'alice')).toBe(1);
    expect(hasMilestone('story:kestrel:founding-reserve-claimed', 'alice')).toBe(true);
    expect(applyReplicatedWorldEvent({ ...event, seq: 2 }, { worldId: '-1,-1:p1' })).toBe(true);
    expect(getItemCount('strut_frame', 'alice')).toBe(1);
  });

  it('turns server-accepted Tidegarden site, foundation, and Core facts into physical story receipts', () => {
    const worldId = '-1,-1:p1';
    const cell: [number, number, number] = [4, 25, -4];
    const supportCell: [number, number, number] = [4, 24, -4];
    expect(applyReplicatedWorldEvent({
      seq: 1,
      commandId: 'relationship',
      type: 'tidegarden_relationship_attended',
      playerId: 'alice',
      payload: { relationshipId: 'tideline-root-water-exchange' }
    }, { worldId })).toBe(true);
    expect(applyReplicatedWorldEvent({
      seq: 2,
      commandId: 'site',
      type: 'tidegarden_site_chosen',
      playerId: 'alice',
      payload: { worldId, cell, supportCell, up: [0, 1, 0] }
    }, { worldId })).toBe(true);

    // Online placement is already predicted locally. Its ignored local echo
    // must still become the authoritative first-foundation story receipt.
    restorePieces([{
      cell,
      face: 3,
      type: 'foundation',
      material: 'wood',
      ownerId: 'alice',
      placedBy: 'alice'
    }]);
    expect(applyReplicatedWorldEvent({
      seq: 3,
      commandId: 'foundation',
      type: 'structure_placed',
      playerId: 'alice',
      timeMs: 1234,
      payload: { cell, face: 3, type: 'foundation', material: 'wood', up: 2 }
    }, { worldId, localPlayerId: 'alice', ignoreLocalPlayer: true })).toBe(true);
    expect(applyReplicatedWorldEvent({
      seq: 4,
      commandId: 'core',
      type: 'habitat_core_placed',
      playerId: 'alice',
      payload: {
        shelterId: `habitat:${worldId}:${cell.join(',')}`,
        cell,
        supportCell,
        position: [8, 50.24, -8],
        up: [0, 1, 0]
      }
    }, { worldId })).toBe(true);

    expect(getEmergentStoryEvents().map(event => event.type)).toEqual([
      'ecology_relationship_observed',
      'settlement_site_chosen',
      'settlement_foundation_placed',
      'station_activated'
    ]);
    expect(hasMilestone(
      'story:tidegarden:site-chosen:v1:4,25,-4|4,24,-4|0,1,0',
      'alice'
    )).toBe(true);
    expect(getHabitatWorldState(worldId)?.core.cell).toEqual(cell);
  });

  it('replaces structure ACKs from snapshots and clears them on local removal echoes', () => {
    const worldId = '-1,-1:p1';
    const staleCell: [number, number, number] = [1, 20, 1];
    const liveCell: [number, number, number] = [2, 20, 2];
    expect(applyReplicatedWorldEvent({
      seq: 1,
      commandId: 'stale-foundation',
      type: 'structure_placed',
      playerId: 'alice',
      payload: { cell: staleCell, face: 3, type: 'foundation', material: 'wood', up: 2 }
    }, { worldId, localPlayerId: 'alice', ignoreLocalPlayer: true })).toBe(false);
    expect(hasAuthoritativeStructureReceipt({
      worldId,
      cell: staleCell,
      face: 3,
      type: 'foundation',
      playerId: 'alice'
    })).toBe(true);

    applyReplicatedWorldSnapshotEvents({
      world: {
        events: [{
          seq: 2,
          commandId: 'live-foundation',
          type: 'structure_placed',
          playerId: 'alice',
          payload: { cell: liveCell, face: 3, type: 'foundation', material: 'wood', up: 2 }
        }]
      }
    }, worldId, { localPlayerId: 'alice' });

    expect(hasAuthoritativeStructureReceipt({ worldId, cell: staleCell, face: 3 })).toBe(false);
    expect(hasAuthoritativeStructureReceipt({
      worldId,
      cell: liveCell,
      face: 3,
      type: 'foundation',
      playerId: 'alice'
    })).toBe(true);

    expect(applyReplicatedWorldEvent({
      seq: 3,
      commandId: 'remove-live-foundation',
      type: 'structure_removed',
      playerId: 'alice',
      payload: { cell: liveCell, face: 3 }
    }, { worldId, localPlayerId: 'alice', ignoreLocalPlayer: true })).toBe(false);
    expect(hasAuthoritativeStructureReceipt({ worldId, cell: liveCell, face: 3 })).toBe(false);
  });

  it('serializes local poses as plain network payloads', () => {
    const pose = createPlayerPose({
      playerId: 'alice',
      worldId: '0,0',
      seq: 7,
      position: [1, 2, 3],
      action: 'walk'
    });

    expect(toPosePayload(pose)).toMatchObject({
      playerId: 'alice',
      worldId: '0,0',
      seq: 7,
      position: [1, 2, 3],
      action: 'walk'
    });
  });

  it('applies remote pose updates without overwriting the local actor', () => {
    setPlayerPose({ playerId: 'alice', worldId: '0,0', seq: 1, position: [0, 0, 0] });

    expect(applyRemotePoseUpdate({
      playerId: 'alice',
      worldId: '0,0',
      seq: 2,
      pose: { position: [9, 9, 9] }
    }, 'alice')).toBeNull();
    expect(getPlayerPose('alice')?.seq).toBe(1);

    const remote = applyRemotePoseUpdate({
      playerId: 'bob',
      worldId: '0,0',
      seq: 3,
      pose: { position: [1, 2, 3], action: 'jetpack', jetpackActive: true }
    }, 'alice');

    expect(remote?.playerId).toBe('bob');
    expect(getPlayerPose('bob')?.position).toEqual([1, 2, 3]);
    expect(getPlayerPose('bob')?.jetpackActive).toBe(true);

    expect(applyRemotePoseUpdate({
      playerId: 'bob',
      worldId: '0,0',
      seq: 2,
      pose: { position: [9, 9, 9], action: 'walk' }
    }, 'alice')).toBeNull();
    expect(getPlayerPose('bob')?.position).toEqual([1, 2, 3]);
  });

  it('extracts and applies server snapshot poses for remote players only', () => {
    const snapshot = {
      players: {
        poses: {
          alice: { seq: 4, position: [0, 0, 0] },
          bob: { seq: 5, position: [2, 0, 0], action: 'swim', submergence: 1 }
        }
      }
    };

    expect(extractSnapshotPoseEntries(snapshot).map(([id]) => id)).toEqual(['alice', 'bob']);

    const applied = applyRemotePoseSnapshot(snapshot, '0,0', 'alice');

    expect(applied.map(pose => pose.playerId)).toEqual(['bob']);
    expect(getPlayerPose('alice')).toBeNull();
    expect(getPlayerPose('bob')).toMatchObject({
      playerId: 'bob',
      worldId: '0,0',
      seq: 5,
      action: 'swim',
      submergence: 1
    });
  });

  it('applies authoritative player state snapshots into actor-keyed stores', () => {
    // Optimistic tree wood is deliberately present first; even merge mode must
    // replace the included actor with the exact authoritative inventory.
    const optimisticInventory = { players: { inventory: { alice: { wood: 9 } } } };
    expect(applyReplicatedPlayerStateSnapshot(optimisticInventory)).toBe(true);
    expect(getItemCount('wood', 'alice')).toBe(9);
    markMilestone('story:dive:oxygen-75', 'alice');
    markMilestone('story:item:habitat-core:crafted', 'alice');
    markMilestone(EMERGENT_MAW_MILESTONES.directionResolved, 'alice');
    const snapshot = {
      players: {
        inventory: {
          alice: { iron_maw: 1, waterskin: 1, wood: 3 },
          bob: { biofuel: 2 }
        },
        vitals: {
          alice: {
            vitals: {
              health: 88,
              hunger: 62,
              thirst: 46,
              warmth: 100,
              stamina: 73,
              oxygen: 91
            },
            exhausted: true
          }
        },
        maw: { alice: 0, bob: 50 },
        waterskin: { alice: 15 },
        progression: {
          alice: {
            era: 'emergent',
            milestones: ['maw_repaired']
          }
        }
      }
    };

    expect(applyReplicatedPlayerStateSnapshot(snapshot)).toBe(true);

    expect(getItemCount('iron_maw', 'alice')).toBe(1);
    expect(getItemCount('wood', 'alice')).toBe(3);
    expect(getItemCount('biofuel', 'bob')).toBe(2);
    expect(getVitals('alice')).toMatchObject({ hunger: 62, thirst: 46, oxygen: 91 });
    expect(getMawCharge('bob')).toBe(50);
    expect(getWaterskinFill('alice')).toBe(15);
    expect(getCurrentEra('alice')).toBe('emergent');
    expect(hasMilestone('maw_repaired', 'alice')).toBe(true);
    expect(hasMilestone('story:dive:oxygen-75', 'alice')).toBe(true);
    // Server-owned receipts are replaced, never broadly unioned from optimism.
    expect(hasMilestone('story:item:habitat-core:crafted', 'alice')).toBe(false);
    expect(hasMilestone(EMERGENT_MAW_MILESTONES.directionResolved, 'alice')).toBe(false);
  });

  it('converges ship route and Tidegarden settlement from a reconnect snapshot', () => {
    setLocalActorId('alice');
    markMilestone('story:started', 'alice');
    const worldId = '-1,-1:p1';
    const snapshot = {
      story: {
        ship: {
          repairStage: 'flight_ready',
          repairHistory: [
            { eventId: 's1', from: 'wrecked', to: 'bench_online' },
            { eventId: 's2', from: 'bench_online', to: 'frame_restored' },
            { eventId: 's3', from: 'frame_restored', to: 'hull_sealed' },
            { eventId: 's4', from: 'hull_sealed', to: 'lift_online' },
            { eventId: 's5', from: 'lift_online', to: 'flight_ready' }
          ],
          currentSystemId: '-1,-1',
          currentWorldId: worldId,
          locationMode: 'surface'
        },
        relationshipAttendedBy: ['alice', 'bob'],
        habitat: {
          schemaVersion: 1,
          worldId,
          core: {
            actorId: 'alice',
            worldId,
            shelterId: `habitat:${worldId}:4,25,-4`,
            cell: [4, 25, -4],
            supportCell: [4, 24, -4],
            position: [8, 50.24, -8],
            up: [0, 1, 0],
            eventId: 'core'
          },
          shelterCertification: {
            shelterId: `habitat:${worldId}:4,25,-4`,
            cell: [4, 25, -4],
            insulation: 2.4,
            interiorCellCount: 2,
            eventId: 'shelter'
          },
          safeRest: {
            shelterId: `habitat:${worldId}:4,25,-4`,
            dayPhase: 0.72,
            eventId: 'rest'
          }
        }
      }
    };

    expect(applyReplicatedStoryStateSnapshot(snapshot, worldId)).toBe(true);
    expect(getShipRepairStage()).toBe('flight_ready');
    expect(isStoryJetInstalled('alice')).toBe(true);
    expect(hasMilestone(WRECK_SALVAGE_MILESTONE, 'alice')).toBe(true);
    for (const stack of WRECK_SALVAGE) expect(getItemCount(stack.id, 'alice')).toBe(0);
    expect(hasMilestone('story:tidegarden:relationship-attended', 'alice')).toBe(true);
    expect(hasMilestone('story:tidegarden:relationship-attended', 'bob')).toBe(true);
    expect(getHabitatWorldState(worldId)).toMatchObject({
      worldId,
      core: { actorId: 'alice', cell: [4, 25, -4] },
      shelterCertification: { interiorCellCount: 2 },
      safeRest: { dayPhase: 0.72 }
    });
  });

  it('validates replicated world events before applying them', () => {
    expect(parseReplicatedWorldEvent({
      seq: 1,
      commandId: 'tree-command-1',
      type: 'voxel_mined',
      playerId: 'bob',
      payload: { coord: [0, 1, 0] },
      timeMs: 123
    })).toMatchObject({
      seq: 1,
      commandId: 'tree-command-1',
      type: 'voxel_mined',
      playerId: 'bob',
      payload: { coord: [0, 1, 0] },
      timeMs: 123
    });

    expect(parseReplicatedWorldEvent({ type: 'voxel_mined', playerId: 'bob', payload: { coord: [0, 1, 0] } })).toBeNull();
    expect(parseReplicatedWorldEvent({ seq: 1, type: 'voxel_mined', playerId: 'bob', payload: [] })).toBeNull();
  });

  it('applies replicated voxel_mined events as terrain diffs and ignores local echoes', () => {
    const applied: Array<ReadonlyArray<[number, number, number]>> = [];
    const terrain = { applyTerrainDiff: (coords: ReadonlyArray<[number, number, number]>) => applied.push(coords) };
    const event = {
      seq: 1,
      type: 'voxel_mined',
      playerId: 'bob',
      payload: { coord: [0, 1, 0] }
    };

    expect(applyReplicatedWorldEvent(event, { localPlayerId: 'alice', ignoreLocalPlayer: true, terrain })).toBe(true);
    expect(applied).toEqual([[[0, 1, 0]]]);
    expect(getWorldCollisionChangeSnapshot()).toMatchObject({
      kind: 'terrain_diff',
      cells: [[0, 1, 0]]
    });

    expect(applyReplicatedWorldEvent({ ...event, playerId: 'alice' }, { localPlayerId: 'alice', ignoreLocalPlayer: true, terrain })).toBe(false);
    expect(applied).toEqual([[[0, 1, 0]]]);
  });

  it('extracts and queues snapshot mining terrain until the terrain baseline exists', () => {
    const snapshot = {
      world: {
        events: [
          {
            seq: 1,
            type: 'voxel_mined',
            playerId: 'alice',
            payload: { coord: [0, 1, 0] }
          },
          {
            seq: 2,
            type: 'pose_only',
            playerId: 'alice',
            payload: { ignored: true }
          },
          {
            seq: 3,
            type: 'voxel_mined',
            playerId: 'bob',
            payload: { coord: [1, 1, 0] }
          },
          {
            seq: 4,
            type: 'voxel_mined',
            playerId: 'bob',
            payload: { coord: [1, 1, 0] }
          },
          { malformed: true }
        ]
      }
    };
    let originalTerrainSize = 0;
    const applied: Array<ReadonlyArray<[number, number, number]>> = [];
    const terrain = {
      getOriginalTerrainSize: () => originalTerrainSize,
      applyTerrainDiff: (coords: ReadonlyArray<[number, number, number]>) => applied.push(coords)
    };

    expect(extractSnapshotWorldEvents(snapshot).map(event => event.seq)).toEqual([1, 2, 3, 4]);
    expect(extractSnapshotVoxelMinedCoords(snapshot)).toEqual([[0, 1, 0], [1, 1, 0], [1, 1, 0]]);

    expect(applyReplicatedWorldSnapshotTerrain(snapshot, '0,0', { terrain })).toEqual({ applied: 0, queued: 2 });
    expect(getPendingReplicatedTerrainDiffCount('0,0')).toBe(2);
    expect(applied).toEqual([]);
    expect(getWorldCollisionChangeSnapshot()).toBeNull();

    originalTerrainSize = 128;
    setActiveReplicatedTerrainWorld('other-world');
    expect(applyPendingReplicatedTerrainDiff('0,0', terrain)).toEqual({ applied: 0, queued: 2 });
    expect(applied).toEqual([]);

    setActiveReplicatedTerrainWorld('0,0');
    expect(applyPendingReplicatedTerrainDiff('0,0', terrain)).toEqual({ applied: 2, queued: 0 });
    expect(getPendingReplicatedTerrainDiffCount('0,0')).toBe(0);
    expect(applied).toEqual([[[0, 1, 0], [1, 1, 0]]]);
    expect(getWorldCollisionChangeSnapshot()).toMatchObject({
      kind: 'terrain_diff',
      worldId: '0,0',
      cells: [[0, 1, 0], [1, 1, 0]]
    });
  });

  it('rejects malformed mining coords', () => {
    const terrain = { applyTerrainDiff: () => { throw new Error('should not apply invalid coords'); } };

    expect(readCoord([1, 2, 3])).toEqual([1, 2, 3]);
    expect(readCoord([1, 2, 3.5])).toBeNull();
    expect(readVec3([1, 2, 3.5])).toEqual([1, 2, 3.5]);
    expect(applyReplicatedVoxelMined({ coord: [1, 2] }, terrain)).toBe(false);
  });

  it('queues replicated water floods until the active water world exists', () => {
    const applied: Array<ReadonlyArray<[number, number, number]>> = [];
    const water = {
      applyWaterFlood: (cells: ReadonlyArray<[number, number, number]>) => {
        applied.push(cells);
        return cells.length;
      }
    };
    const event = {
      seq: 1,
      type: 'water_flooded',
      playerId: 'bob',
      payload: { cells: [[0, 1, 0], [1, 1, 0], [1, 1, 0]] }
    };

    expect(applyReplicatedWorldEvent(event, { worldId: '0,0', water })).toBe(true);
    expect(getPendingReplicatedWaterFloodCount('0,0')).toBe(2);
    expect(applied).toEqual([]);

    setActiveReplicatedWaterWorld('other-world', water);
    expect(applyPendingReplicatedWaterFlood('0,0', water)).toEqual({ applied: 0, queued: 2 });
    expect(applied).toEqual([]);

    setActiveReplicatedWaterWorld('0,0', water);
    expect(applyPendingReplicatedWaterFlood('0,0', water)).toEqual({ applied: 2, queued: 0 });
    expect(getPendingReplicatedWaterFloodCount('0,0')).toBe(0);
    expect(applied).toEqual([[[0, 1, 0], [1, 1, 0]]]);

    expect(applyReplicatedWaterFlooded({ cells: [[2, 1, 0]] }, water, '0,0')).toBe(true);
    expect(applied).toEqual([[[0, 1, 0], [1, 1, 0]], [[2, 1, 0]]]);
  });

  it('applies replicated water floods to the generator queried by swim and oxygen state', () => {
    const gen = makeWaterTestGenerator();
    const target = findDryBelowSeaCellAdjacentToWater(gen);
    const water = {
      applyWaterFlood: (cells: ReadonlyArray<[number, number, number]>) =>
        gen.applyDynamicWaterCells(cells.map(([x, y, z]) => ({ x, y, z })))
    };

    expect(gen.isWaterVoxel(target[0], target[1], target[2])).toBe(false);
    const beforeVersion = gen.getWaterEditVersion();

    setActiveReplicatedWaterWorld('0,0', water);
    expect(applyReplicatedWaterFlooded({ cells: [target] }, water, '0,0')).toBe(true);

    expect(gen.isWaterVoxel(target[0], target[1], target[2])).toBe(true);
    expect(gen.getDynamicWaterCells()).toContainEqual({ x: target[0], y: target[1], z: target[2] });
    expect(gen.getWaterEditVersion()).toBeGreaterThan(beforeVersion);
  });

  it('applies replicated shared resource, structure, and campfire events', () => {
    expect(applyReplicatedWorldEvent({
      seq: 1,
      type: 'resource_taken',
      playerId: 'bob',
      payload: { source: 'tree', coord: [1, 2, 3], id: 'wood', qty: 2 }
    })).toBe(true);
    expect(isTreeHarvested(1, 2, 3)).toBe(true);

    expect(applyReplicatedWorldEvent({
      seq: 2,
      type: 'resource_taken',
      playerId: 'bob',
      payload: { source: 'loose_stone', coord: [2, 2, 3], id: 'stone', qty: 1 }
    })).toBe(true);
    expect(isStoneCollected(2, 2, 3)).toBe(true);

    expect(applyReplicatedWorldEvent({
      seq: 3,
      type: 'resource_taken',
      playerId: 'bob',
      payload: { source: 'forage', coord: [3, 2, 3], kind: 'berry', id: 'berry', qty: 1 }
    })).toBe(true);
    expect(isForageCollected(3, 2, 3)).toBe(true);

    expect(applyReplicatedWorldEvent({
      seq: 4,
      type: 'resource_taken',
      playerId: 'bob',
      payload: { source: 'flora', coord: [4, 2, 3], kind: 'flower', id: 'wild_bloom', qty: 1 }
    })).toBe(true);
    expect(isFloraHarvested(4, 2, 3)).toBe(true);

    expect(applyReplicatedWorldEvent({
      seq: 4,
      type: 'structure_placed',
      playerId: 'bob',
      payload: { cell: [0, 0, 0], face: 3, type: 'foundation', material: 'wood', up: 2 }
    })).toBe(true);
    expect(getPieceAt(0, 0, 0, 3)).toMatchObject({ type: 'foundation', ownerId: 'bob' });

    expect(applyReplicatedWorldEvent({
      seq: 5,
      type: 'structure_removed',
      playerId: 'bob',
      payload: { cell: [0, 0, 0], face: 3 }
    })).toBe(true);
    expect(getPieceAt(0, 0, 0, 3)).toBeUndefined();
    expect(getWorldCollisionChangeSnapshot()).toMatchObject({
      kind: 'structure_removed',
      cells: [[0, 0, 0]],
      solidAfter: false
    });

    expect(applyReplicatedWorldEvent({
      seq: 6,
      type: 'campfire_placed',
      playerId: 'bob',
      payload: { pos: [1.25, 1.5, -2.75], up: [0, 0.707, 0.707] }
    })).toBe(true);
    expect(getCampfires()).toHaveLength(1);
    expect(getCampfires()[0]).toMatchObject({ pos: [1.25, 1.5, -2.75], placedBy: 'bob' });
    expect(applyReplicatedWorldEvent({
      seq: 7,
      type: 'campfire_placed',
      playerId: 'bob',
      payload: { pos: [1.25, 1.5, -2.75], up: [0, 0.707, 0.707] }
    })).toBe(true);
    expect(getCampfires()).toHaveLength(1);
  });

  it('records the local authoritative structure echo even when optimistic geometry is ignored', () => {
    restorePieces([{
      cell: [4, 25, -4],
      face: 3,
      type: 'foundation',
      material: 'wood',
      ownerId: 'alice',
      placedBy: 'alice'
    }]);
    expect(applyReplicatedWorldEvent({
      seq: 12,
      commandId: 'story:movie:alice:habitat-foundation',
      type: 'structure_placed',
      playerId: 'alice',
      payload: { cell: [4, 25, -4], face: 3, type: 'foundation', material: 'wood' }
    }, {
      localPlayerId: 'alice',
      ignoreLocalPlayer: true,
      worldId: '-1,-1:p1'
    })).toBe(false);
    expect(hasAuthoritativeStructureReceipt({
      worldId: '-1,-1:p1',
      cell: [4, 25, -4],
      face: 3,
      type: 'foundation',
      playerId: 'alice'
    })).toBe(true);

    expect(applyReplicatedWorldEvent({
      seq: 13,
      type: 'structure_removed',
      playerId: 'alice',
      payload: { cell: [4, 25, -4], face: 3 }
    }, {
      localPlayerId: 'alice',
      ignoreLocalPlayer: true,
      worldId: '-1,-1:p1'
    })).toBe(false);
    expect(hasAuthoritativeStructureReceipt({
      worldId: '-1,-1:p1',
      cell: [4, 25, -4],
      face: 3
    })).toBe(false);
  });

  it('applies replicated respawns as teleport poses and ignores stale pre-respawn poses', () => {
    setPlayerPose({
      playerId: 'bob',
      worldId: '0,0',
      seq: 12,
      position: [1, 2, 3],
      velocity: [4, 0, 0],
      forward: [0, 0, 1],
      up: [0, 1, 0],
      pitch: 0.25,
      action: 'jetpack',
      jetpackActive: true,
      submergence: 0.5,
      miningProgress: 0.4
    });

    expect(applyReplicatedWorldEvent({
      seq: 8,
      type: 'player_respawned',
      playerId: 'bob',
      payload: { position: [9, 10.5, -2], up: [0, 1, 0] },
      timeMs: 456
    }, { worldId: '0,0' })).toBe(true);

    expect(getPlayerPose('bob')).toMatchObject({
      playerId: 'bob',
      worldId: '0,0',
      seq: 13,
      timeMs: 456,
      position: [9, 10.5, -2],
      velocity: [0, 0, 0],
      action: 'idle',
      teleport: true,
      submergence: 0,
      miningProgress: 0,
      jetpackActive: false,
      shipPhase: 'surface'
    });

    expect(applyRemotePoseUpdate({
      playerId: 'bob',
      worldId: '0,0',
      seq: 12,
      pose: { position: [1, 2, 3], action: 'jetpack', jetpackActive: true }
    }, 'alice')).toBeNull();
    expect(getPlayerPose('bob')?.position).toEqual([9, 10.5, -2]);
  });

  it('replays shared world events from snapshots for late joiners', () => {
    const snapshot = {
      world: {
        events: [
          {
            seq: 1,
            type: 'voxel_mined',
            playerId: 'bob',
            payload: { coord: [0, 1, 0] }
          },
          {
            seq: 2,
            type: 'resource_taken',
            playerId: 'bob',
            payload: { source: 'loose_stone', coord: [2, 2, 3], id: 'stone', qty: 1 }
          },
          {
            seq: 3,
            type: 'structure_placed',
            playerId: 'bob',
            payload: { cell: [0, 0, 0], face: 3, type: 'foundation', material: 'wood', up: 2 }
          },
          {
            seq: 4,
            type: 'door_toggled',
            playerId: 'alice',
            payload: { cell: [9, 9, 9], face: 0, open: true }
          },
          {
            seq: 5,
            type: 'campfire_placed',
            playerId: 'bob',
            payload: { pos: [1, 1, 1], up: [0, 1, 0] }
          },
          {
            seq: 6,
            type: 'water_flooded',
            playerId: 'bob',
            payload: { cells: [[0, 1, 0]] }
          },
          {
            seq: 7,
            type: 'player_respawned',
            playerId: 'bob',
            payload: { position: [5, 6, 7], up: [0, 1, 0] },
            timeMs: 789
          }
        ]
      }
    };
    const applied: Array<ReadonlyArray<[number, number, number]>> = [];
    const terrain = {
      getOriginalTerrainSize: () => 0,
      applyTerrainDiff: (coords: ReadonlyArray<[number, number, number]>) => applied.push(coords)
    };

    expect(applyReplicatedWorldSnapshotEvents(snapshot, '0,0', {
      localPlayerId: 'alice',
      ignoreLocalPlayer: true,
      terrain
    })).toEqual({ applied: 6, queuedTerrain: 1, queuedWater: 1 });

    expect(getPendingReplicatedTerrainDiffCount('0,0')).toBe(1);
    expect(getPendingReplicatedWaterFloodCount('0,0')).toBe(1);
    expect(applied).toEqual([]);
    expect(isStoneCollected(2, 2, 3)).toBe(true);
    expect(getPieceAt(0, 0, 0, 3)).toMatchObject({ type: 'foundation', ownerId: 'bob' });
    expect(getCampfires()).toHaveLength(1);
    expect(getPlayerPose('bob')).toMatchObject({
      worldId: '0,0',
      seq: 7,
      timeMs: 789,
      position: [5, 6, 7],
      teleport: true,
      action: 'idle'
    });
    expect(getPieceAt(9, 9, 9, 0)).toBeUndefined();
  });

  it('replaces stale offline resource markers with full server snapshot truth', () => {
    markTreeHarvested(90, 90, 90);
    markStoneCollected(91, 91, 91);
    markForageCollected(92, 92, 92);
    markFloraHarvested(93, 93, 93);
    const serverSnapshot = {
      world: {
        events: [
          {
            seq: 1,
            type: 'resource_taken',
            playerId: 'alice',
            payload: { source: 'tree', coord: [1, 2, 3], id: 'wood', qty: 3 }
          },
          {
            seq: 2,
            type: 'resource_taken',
            playerId: 'bob',
            payload: { source: 'loose_stone', coord: [4, 5, 6], id: 'stone', qty: 1 }
          },
          {
            seq: 3,
            type: 'resource_taken',
            playerId: 'bob',
            payload: { source: 'forage', coord: [7, 8, 9], kind: 'root', id: 'root', qty: 1 }
          },
          {
            seq: 4,
            type: 'resource_taken',
            playerId: 'bob',
            payload: { source: 'flora', coord: [10, 11, 12], kind: 'seedhead', id: 'seedpod', qty: 2 }
          }
        ]
      }
    };

    const result = applyReplicatedWorldSnapshotEvents(serverSnapshot, '0,0', {
      localPlayerId: 'alice',
      replaceResourceMarkers: true
    });

    expect(result.applied).toBe(4);
    expect(isTreeHarvested(90, 90, 90)).toBe(false);
    expect(isStoneCollected(91, 91, 91)).toBe(false);
    expect(isForageCollected(92, 92, 92)).toBe(false);
    expect(isFloraHarvested(93, 93, 93)).toBe(false);
    expect(isTreeHarvested(1, 2, 3)).toBe(true);
    expect(isStoneCollected(4, 5, 6)).toBe(true);
    expect(isForageCollected(7, 8, 9)).toBe(true);
    expect(isFloraHarvested(10, 11, 12)).toBe(true);
  });

  it('applies replicated doorway, door leaf, and door toggle events', () => {
    expect(applyReplicatedWorldEvent({
      seq: 1,
      type: 'structure_placed',
      playerId: 'bob',
      payload: { cell: [0, 0, 0], face: 0, type: 'doorway', material: 'wood', up: 2 }
    })).toBe(true);
    expect(getPieceAt(0, 0, 0, 0)).toMatchObject({ type: 'doorway', tall: 'lower' });
    expect(getPieceAt(0, 1, 0, 0)).toMatchObject({ type: 'doorway', tall: 'upper' });
    expect(getWorldCollisionChangeSnapshot()).toMatchObject({
      kind: 'structure_placed',
      cells: [[0, 0, 0], [0, 1, 0]],
      solidAfter: false
    });

    expect(applyReplicatedWorldEvent({
      seq: 2,
      type: 'structure_placed',
      playerId: 'bob',
      payload: { cell: [0, 0, 0], face: 0, type: 'door', material: 'wood' }
    })).toBe(true);
    expect(getPieceAt(0, 0, 0, 0)).toMatchObject({ leaf: true, open: false });
    expect(getWorldCollisionChangeSnapshot()).toMatchObject({
      kind: 'structure_placed',
      cells: [[0, 0, 0], [0, 1, 0]],
      solidAfter: true
    });

    expect(applyReplicatedWorldEvent({
      seq: 3,
      type: 'door_toggled',
      playerId: 'bob',
      payload: { cell: [0, 0, 0], face: 0, open: true }
    })).toBe(true);
    expect(getPieceAt(0, 0, 0, 0)).toMatchObject({ open: true });
    expect(getPieceAt(0, 1, 0, 0)).toMatchObject({ open: true });
    expect(getWorldCollisionChangeSnapshot()).toMatchObject({
      kind: 'door_toggled',
      cells: [[0, 0, 0], [0, 1, 0]],
      solidAfter: false
    });

    expect(applyReplicatedWorldEvent({
      seq: 4,
      type: 'door_toggled',
      playerId: 'bob',
      payload: { cell: [0, 0, 0], face: 0, open: false }
    })).toBe(true);
    expect(getWorldCollisionChangeSnapshot()).toMatchObject({
      kind: 'door_toggled',
      cells: [[0, 0, 0], [0, 1, 0]],
      solidAfter: true
    });
  });

  it('does not apply local echoed world events', () => {
    restorePieces([{ cell: [0, 0, 0], face: 1, type: 'foundation', material: 'wood', ownerId: 'alice', placedBy: 'alice' }]);

    expect(applyReplicatedWorldEvent({
      seq: 1,
      type: 'structure_removed',
      playerId: 'alice',
      payload: { cell: [0, 0, 0], face: 1 }
    }, { localPlayerId: 'alice', ignoreLocalPlayer: true })).toBe(false);

    expect(getPieceAt(0, 0, 0, 1)).toBeDefined();
  });
});
