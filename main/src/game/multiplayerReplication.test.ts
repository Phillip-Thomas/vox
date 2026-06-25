import { beforeEach, describe, expect, it } from 'vitest';
import { createPlayerPose } from './playerPose.ts';
import {
  applyPendingReplicatedTerrainDiff,
  applyPendingReplicatedWaterFlood,
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
import { isTreeHarvested, resetTreeHarvest } from './systems/treeHarvest.ts';
import { isStoneCollected, resetStonePickup } from './systems/stonePickup.ts';
import { isForageCollected, resetForagePickup } from './systems/foragePickup.ts';
import { getCampfires, resetCampfires } from './systems/campfires.ts';
import { getPieceAt, resetStructures, restorePieces } from './systems/structureSystem.ts';

beforeEach(() => {
  resetPlayerPoses();
  clearPendingReplicatedTerrainDiffs();
  clearPendingReplicatedWaterFloods();
  setActiveReplicatedTerrainWorld(null);
  setActiveReplicatedWaterWorld(null);
  resetTreeHarvest();
  resetStonePickup();
  resetForagePickup();
  resetCampfires();
  resetStructures();
});

describe('multiplayer replication', () => {
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

  it('validates replicated world events before applying them', () => {
    expect(parseReplicatedWorldEvent({
      seq: 1,
      type: 'voxel_mined',
      playerId: 'bob',
      payload: { coord: [0, 1, 0] },
      timeMs: 123
    })).toMatchObject({
      seq: 1,
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

    originalTerrainSize = 128;
    setActiveReplicatedTerrainWorld('other-world');
    expect(applyPendingReplicatedTerrainDiff('0,0', terrain)).toEqual({ applied: 0, queued: 2 });
    expect(applied).toEqual([]);

    setActiveReplicatedTerrainWorld('0,0');
    expect(applyPendingReplicatedTerrainDiff('0,0', terrain)).toEqual({ applied: 2, queued: 0 });
    expect(getPendingReplicatedTerrainDiffCount('0,0')).toBe(0);
    expect(applied).toEqual([[[0, 1, 0], [1, 1, 0]]]);
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
    })).toEqual({ applied: 5, queuedTerrain: 1, queuedWater: 1 });

    expect(getPendingReplicatedTerrainDiffCount('0,0')).toBe(1);
    expect(getPendingReplicatedWaterFloodCount('0,0')).toBe(1);
    expect(applied).toEqual([]);
    expect(isStoneCollected(2, 2, 3)).toBe(true);
    expect(getPieceAt(0, 0, 0, 3)).toMatchObject({ type: 'foundation', ownerId: 'bob' });
    expect(getCampfires()).toHaveLength(1);
    expect(getPieceAt(9, 9, 9, 0)).toBeUndefined();
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

    expect(applyReplicatedWorldEvent({
      seq: 2,
      type: 'structure_placed',
      playerId: 'bob',
      payload: { cell: [0, 0, 0], face: 0, type: 'door', material: 'wood' }
    })).toBe(true);
    expect(getPieceAt(0, 0, 0, 0)).toMatchObject({ leaf: true, open: false });

    expect(applyReplicatedWorldEvent({
      seq: 3,
      type: 'door_toggled',
      playerId: 'bob',
      payload: { cell: [0, 0, 0], face: 0, open: true }
    })).toBe(true);
    expect(getPieceAt(0, 0, 0, 0)).toMatchObject({ open: true });
    expect(getPieceAt(0, 1, 0, 0)).toMatchObject({ open: true });
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
