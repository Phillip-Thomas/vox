import { beforeEach, describe, expect, it } from 'vitest';
import { markMilestone, resetProgression } from './progressionSystem.ts';
import {
  applyShipRestorationSnapshot,
  commitShipRepairStage,
  getShipRestorationSnapshot,
  hydrateShipRestorationState,
  resetShipRestoration,
  setShipRestorationLocation
} from './shipRestoration.ts';
import { isTidegardenRouteOnline } from '../../story/tidegardenRoute.ts';
import { getEmergentStoryEvents, resetEmergentStoryEvents } from '../../story/emergentStoryEvents.ts';
import { isStoryJetInstalled } from '../../story/emergentCapabilities.ts';

describe('ship restoration state', () => {
  beforeEach(() => {
    resetProgression();
    resetShipRestoration();
    resetEmergentStoryEvents();
  });

  it('rejects skipped stages and deduplicates transaction replay', () => {
    expect(commitShipRepairStage('skip', 'frame_restored')).toMatchObject({
      ok: false,
      reason: 'out-of-order'
    });
    expect(commitShipRepairStage('repair:bench', 'bench_online')).toMatchObject({
      ok: true,
      idempotent: false
    });
    expect(commitShipRepairStage('repair:bench', 'bench_online')).toMatchObject({
      ok: true,
      idempotent: true
    });
    expect(getShipRestorationSnapshot().repairHistory).toHaveLength(1);
  });

  it('commits flight readiness and the sole route milestone together', () => {
    for (const [eventId, stage] of [
      ['repair:bench', 'bench_online'],
      ['repair:frame', 'frame_restored'],
      ['repair:hull', 'hull_sealed'],
      ['repair:lift', 'lift_online'],
      ['repair:route', 'flight_ready']
    ] as const) {
      expect(commitShipRepairStage(eventId, stage).ok).toBe(true);
    }
    expect(isTidegardenRouteOnline()).toBe(true);
    const events = getEmergentStoryEvents();
    expect(events[events.length - 1]).toMatchObject({
      id: 'repair:route',
      type: 'ship_repair_stage',
      payload: { from: 'lift_online', to: 'flight_ready' }
    });
  });

  it('cannot unlock Story hover before lift-online and reconstructs its receipt on replay', () => {
    markMilestone('story:started');
    expect(isStoryJetInstalled()).toBe(false);
    for (const [eventId, stage] of [
      ['repair:bench', 'bench_online'],
      ['repair:frame', 'frame_restored'],
      ['repair:hull', 'hull_sealed']
    ] as const) {
      expect(commitShipRepairStage(eventId, stage).ok).toBe(true);
      expect(isStoryJetInstalled()).toBe(false);
    }
    expect(commitShipRepairStage('repair:lift', 'lift_online').ok).toBe(true);
    expect(isStoryJetInstalled()).toBe(true);

    resetProgression();
    markMilestone('story:started');
    expect(isStoryJetInstalled()).toBe(false);
    expect(commitShipRepairStage('repair:lift', 'lift_online')).toMatchObject({
      ok: true,
      idempotent: true
    });
    expect(isStoryJetInstalled()).toBe(true);
  });

  it('round-trips surface and local-space pose without sharing mutable arrays', () => {
    setShipRestorationLocation({
      currentSystemId: '-1,-1',
      currentWorldId: '-1,-1:p1',
      parkedPose: { position: [1, 2, 3], quaternion: [0, 0, 0, 1] },
      systemPose: { position: [20, 30, 40], quaternion: [0, 0, 0, 1], velocity: [1, 0, -2] },
      locationMode: 'local_space'
    });
    const snapshot = getShipRestorationSnapshot();
    snapshot.systemPose!.position[0] = 999;
    expect(getShipRestorationSnapshot()).toMatchObject({
      currentWorldId: '-1,-1:p1',
      locationMode: 'local_space',
      systemPose: { position: [20, 30, 40] }
    });
  });

  it('migrates malformed and early flight-ready snapshots safely', () => {
    const hydrated = hydrateShipRestorationState({
      version: 0,
      repairStage: 'not-real',
      repairHistory: [{ eventId: 'bad', from: 'wrecked', to: 'flight_ready' }],
      parkedPose: { position: [0, 'bad', 0], quaternion: [0, 0, 0, 1] }
    });
    expect(hydrated).toMatchObject({ repairStage: 'wrecked', repairHistory: [], parkedPose: null });

    applyShipRestorationSnapshot({ repairStage: 'flight_ready' });
    expect(getShipRestorationSnapshot().repairStage).toBe('flight_ready');
    expect(isTidegardenRouteOnline()).toBe(true);
  });
});
