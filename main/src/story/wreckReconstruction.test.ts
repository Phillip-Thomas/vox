import { beforeEach, describe, expect, it } from 'vitest';
import { getItemCount, resetInventory } from '../game/systems/inventorySystem.ts';
import { hasMilestone, markMilestone, resetProgression } from '../game/systems/progressionSystem.ts';
import {
  WRECK_BENCH_STATIONS,
  WRECK_SALVAGE,
  ensureWreckBenchStationEvents
} from '../game/systems/shipRepairTransactions.ts';
import {
  applyShipRestorationSnapshot,
  getShipRepairStage,
  resetShipRestoration
} from '../game/systems/shipRestoration.ts';
import { resetAccomplishments } from '../game/systems/accomplishmentLedger.ts';
import {
  getEmergentStoryEvents,
  resetEmergentStoryEvents
} from './emergentStoryEvents.ts';
import {
  acquireEmergentUniqueItem,
  bankKestrelKeelMemory
} from './emergentUniqueItems.ts';
import { isStoryJetInstalled } from './emergentCapabilities.ts';
import { RECONSTRUCTION_EMBODIMENT_MILESTONES } from './reconstructionEmbodiment.ts';
import { RECONSTRUCTION_CALIBRATION_MILESTONE } from './reconstructionCalibration.ts';
import { craft } from '../game/systems/craftingSystem.ts';
import { RECIPES } from '../game/data/recipes.ts';
import {
  WRECK_BENCH_ACCESS_REACH,
  getWreckReconstructionGuidance,
  getWreckReconstructionAction,
  isWreckBenchStationAccessActive,
  performWreckReconstructionAction,
  wreckTiltForStage,
  type WreckReconstructionAction
} from './wreckReconstruction.ts';

describe('nearby wreck reconstruction', () => {
  beforeEach(() => {
    resetInventory();
    resetProgression();
    resetShipRestoration();
    resetAccomplishments();
    resetEmergentStoryEvents();
    markMilestone('story:started');
    markMilestone(RECONSTRUCTION_EMBODIMENT_MILESTONES.diagnosis);
  });

  it('requires embodied diagnosis, claims finite salvage, and requires the banked Keel', () => {
    resetProgression();
    markMilestone('story:started');
    expect(getWreckReconstructionAction()).toBeNull();
    expect(performWreckReconstructionAction({
      kind: 'salvage',
      interactionId: 'story-wreck-salvage',
      verb: 'Recover Wreck Salvage'
    })).toMatchObject({ ok: false, repairStage: 'wrecked' });
    markMilestone(RECONSTRUCTION_EMBODIMENT_MILESTONES.diagnosis);
    const salvage = getWreckReconstructionAction();
    expect(salvage).toMatchObject({
      kind: 'salvage',
      interactionId: 'story-wreck-salvage',
      verb: 'Recover Wreck Salvage'
    });
    if (!salvage) throw new Error('Expected salvage action.');
    expect(performWreckReconstructionAction(salvage)).toMatchObject({
      ok: true,
      idempotent: false,
      repairStage: 'wrecked'
    });
    expect(performWreckReconstructionAction(salvage).idempotent).toBe(true);
    for (const stack of WRECK_SALVAGE) expect(getItemCount(stack.id)).toBe(stack.qty);
    expect(WRECK_SALVAGE).toEqual(expect.arrayContaining([
      { id: 'strut_frame', qty: 2 },
      { id: 'refined_alloy', qty: 3 },
      { id: 'silica_pane', qty: 2 }
    ]));

    acquireEmergentUniqueItem('kestrel_keel_memory', 'story:dive:keel-freed');
    expect(getWreckReconstructionAction()).toBeNull();
    bankKestrelKeelMemory('story:dive:keel-banked', 70);
    expect(getWreckReconstructionAction()).toMatchObject({
      kind: 'repair',
      target: 'bench_online',
      verb: 'Install Keel Workbench'
    });
  });

  it('enforces exact order, deduplicates bench facts, and unlocks jet only at lift-online', () => {
    const salvage = getWreckReconstructionAction();
    if (!salvage) throw new Error('Expected salvage action.');
    performWreckReconstructionAction(salvage);
    acquireEmergentUniqueItem('kestrel_keel_memory', 'story:dive:keel-freed');
    bankKestrelKeelMemory('story:dive:keel-banked', 70);

    const bench = getWreckReconstructionAction();
    if (!bench || bench.kind !== 'repair') throw new Error('Expected bench action.');
    expect(performWreckReconstructionAction(bench)).toMatchObject({
      ok: true,
      idempotent: false,
      repairStage: 'bench_online'
    });
    expect(performWreckReconstructionAction(bench)).toMatchObject({ ok: true, idempotent: true });
    expect(ensureWreckBenchStationEvents('story:reconstruct:bench_online')).toBe(0);
    expect(getEmergentStoryEvents().filter(event => event.type === 'station_activated')).toEqual(
      WRECK_BENCH_STATIONS.map(stationId => expect.objectContaining({
        type: 'station_activated',
        payload: { stationId }
      }))
    );

    const forgedSkip: WreckReconstructionAction = {
      kind: 'repair',
      interactionId: 'story-ship-repair',
      target: 'hull_sealed',
      verb: 'Seal Scarred Hull'
    };
    expect(performWreckReconstructionAction(forgedSkip)).toMatchObject({
      ok: false,
      repairStage: 'bench_online'
    });

    const frame = getWreckReconstructionAction();
    if (!frame) throw new Error('Expected frame action from finite salvage.');
    expect(performWreckReconstructionAction(frame).repairStage).toBe('frame_restored');
    const hull = getWreckReconstructionAction();
    if (!hull) throw new Error('Expected hull action from finite salvage.');
    expect(performWreckReconstructionAction(hull).repairStage).toBe('hull_sealed');

    expect(isStoryJetInstalled()).toBe(false);
    expect(getWreckReconstructionAction()).toBeNull();
    expect(getWreckReconstructionGuidance()).toMatchObject({
      id: 'craft:lift_online',
      markerLabel: 'WRECK BENCH · CRAFT LIFT CELL'
    });
    expect(craft(RECIPES.lift_cell, { stations: [...WRECK_BENCH_STATIONS] })).toMatchObject({ ok: true });
    const lift = getWreckReconstructionAction();
    if (!lift) throw new Error('Expected lift action.');
    expect(performWreckReconstructionAction(lift).repairStage).toBe('lift_online');
    expect(isStoryJetInstalled()).toBe(true);
    // Lift is immediately useful, but rehearsal is optional exploration later
    // on Tidegarden rather than a repair/calibration prerequisite here.
    expect(getWreckReconstructionAction()).toBeNull();
    expect(getWreckReconstructionGuidance()).toMatchObject({
      id: 'craft:flight_ready',
      markerLabel: 'WRECK BENCH · CRAFT LOGIC WAFER'
    });
    expect(performWreckReconstructionAction({
      kind: 'repair',
      interactionId: 'story-ship-repair',
      target: 'flight_ready',
      verb: 'Calibrate Flight Controls'
    })).toMatchObject({ ok: false, repairStage: 'lift_online' });
    expect(craft(RECIPES.logic_wafer, { stations: [...WRECK_BENCH_STATIONS] })).toMatchObject({ ok: true });
    expect(getWreckReconstructionGuidance()).toMatchObject({
      id: 'repair:flight_ready',
      markerLabel: 'WRECK BENCH · CALIBRATE FLIGHT CONTROLS'
    });
    const flight = getWreckReconstructionAction();
    if (!flight) throw new Error('Expected flight calibration action.');
    expect(performWreckReconstructionAction(flight).repairStage).toBe('flight_ready');
    expect(getShipRepairStage()).toBe('flight_ready');
    expect(hasMilestone(RECONSTRUCTION_EMBODIMENT_MILESTONES.firstHover)).toBe(false);
    expect(hasMilestone(RECONSTRUCTION_EMBODIMENT_MILESTONES.firstHoverRecovered)).toBe(false);
    expect(getWreckReconstructionAction()).toBeNull();
  });

  it('scopes wreck station access to bench-online and nearby distance', () => {
    const near = (WRECK_BENCH_ACCESS_REACH - 0.01) ** 2;
    const far = (WRECK_BENCH_ACCESS_REACH + 0.01) ** 2;
    expect(isWreckBenchStationAccessActive('wrecked', near)).toBe(false);
    expect(isWreckBenchStationAccessActive('bench_online', near)).toBe(true);
    expect(isWreckBenchStationAccessActive('flight_ready', near)).toBe(true);
    expect(isWreckBenchStationAccessActive('bench_online', far)).toBe(false);
  });

  it('hydrates a restored flight-ready hull directly into calibration guidance', () => {
    applyShipRestorationSnapshot({ repairStage: 'flight_ready' });

    expect(getWreckReconstructionGuidance()).toMatchObject({
      id: 'calibrating',
      requiresMarker: false
    });
    markMilestone(RECONSTRUCTION_CALIBRATION_MILESTONE);
    expect(getWreckReconstructionGuidance()).toMatchObject({
      id: 'ready',
      requiresMarker: false
    });
  });

  it('does not offer an already-consumed shared salvage cache after the bench is online', () => {
    applyShipRestorationSnapshot({ repairStage: 'bench_online' });

    expect(getWreckReconstructionAction()?.kind).not.toBe('salvage');
  });

  it('rights the same scarred exterior monotonically through flight readiness', () => {
    const tilts = [
      'wrecked',
      'bench_online',
      'frame_restored',
      'hull_sealed',
      'lift_online',
      'flight_ready'
    ].map(stage => wreckTiltForStage(stage as Parameters<typeof wreckTiltForStage>[0]));
    expect(tilts).toEqual([0.28, 0.245, 0.19, 0.125, 0.055, 0]);
    expect(tilts.every((tilt, index) => index === 0 || tilt < tilts[index - 1]!)).toBe(true);
  });
});
