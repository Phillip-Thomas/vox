import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createOfflineCommandContext,
  mineVoxelCommand,
  type MineVoxelTerrain
} from '../game/gameplayCommands.ts';
import { createWorldIdentity } from '../game/worldIdentity.ts';
import { createSimulationRng } from '../game/rng.ts';
import type { BlockId } from '../game/data/blocks.ts';
import type { ItemId } from '../game/data/items.ts';
import { addItem, getItemCount, resetInventory } from '../game/systems/inventorySystem.ts';
import {
  getCurrentEra,
  hasMilestone,
  markMilestone,
  resetProgression
} from '../game/systems/progressionSystem.ts';
import { resetMaw } from '../game/systems/mawSystem.ts';
import { getAccomplishment, resetAccomplishments } from '../game/systems/accomplishmentLedger.ts';
import { getEmergentStoryEvents, resetEmergentStoryEvents } from './emergentStoryEvents.ts';
import {
  advanceEmergentMawRepairRitual,
  advanceMawPurposeGap,
  beginEmergentMawRepairRitual,
  commitEmergentMawRepair,
  commitMawFirstDirection,
  commitMawHarmlessTestFromAcceptedMine,
  commitMawPondResonance,
  EMERGENT_MAW_MILESTONES,
  getAuthoredMawGuidance,
  getMawFirstDirectionChoice,
  getMawRepairRitualSnapshot,
  isMawPondResponseAttendable,
  isMawPondResponseObserved,
  mawRepairAuthorityBeginCommandId,
  MAW_REPAIR_RITUAL_SECONDS,
  resetEmergentMawRepairRitual,
  tickEmergentMawRepairRitual,
  tickMawPurposeGap
} from './emergentMawRepair.ts';
import { resetStoryUiRequests, subscribeStoryUiRequests } from './storyUiRequests.ts';
import { resetStoryClock, setStoryPaused } from './storyClock.ts';

describe('authored Maw repair transaction', () => {
  let now = 0;
  const context = () => createOfflineCommandContext(createWorldIdentity({ x: -1, y: -1 }), {
    rng: createSimulationRng('maw-repair-ritual'),
    now: () => now
  });

  beforeEach(() => {
    resetInventory();
    resetProgression();
    resetMaw();
    resetAccomplishments();
    resetEmergentStoryEvents();
    resetStoryUiRequests();
    resetEmergentMawRepairRitual();
    resetStoryClock();
    now = 0;
  });

  it('closes crafting, attends eight returned seconds, then commits inputs exactly once', () => {
    const close = vi.fn();
    const unsubscribe = subscribeStoryUiRequests(close);
    addItem('faulty_maw', 1);
    addItem('maw_repair_kit', 1);

    expect(commitEmergentMawRepair(context(), 'ch5:maw:repair')).toMatchObject({
      ok: false,
      reason: 'ritual-required'
    });
    expect(beginEmergentMawRepairRitual(context(), 'ch5:maw:repair')).toMatchObject({
      ok: true,
      idempotent: false
    });
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ type: 'close-crafting' }));
    expect(getItemCount('faulty_maw')).toBe(1);
    expect(getItemCount('maw_repair_kit')).toBe(1);
    for (let index = 0; index < 80; index++) {
      now += 100;
      tickEmergentMawRepairRitual(context(), true, now);
    }
    expect(getItemCount('faulty_maw')).toBe(0);
    expect(getItemCount('maw_repair_kit')).toBe(0);
    expect(getItemCount('iron_maw')).toBe(1);
    expect(getCurrentEra()).toBe('emergent');
    expect(getAccomplishment('maw_repaired')?.evidenceHistory).toHaveLength(1);
    expect(getEmergentStoryEvents().map(event => event.type)).toEqual([
      'maw_repair_begun',
      'maw_repaired',
      'accomplishment_recorded'
    ]);

    expect(commitEmergentMawRepair(context(), 'ch5:maw:repair')).toMatchObject({
      ok: true,
      idempotent: true
    });
    expect(getItemCount('iron_maw')).toBe(1);
    unsubscribe();
  });

  it('consumes nothing when the unique kit is absent', () => {
    addItem('faulty_maw', 1);
    expect(beginEmergentMawRepairRitual(context(), 'ch5:maw:repair')).toMatchObject({
      ok: false,
      reason: 'missing-inputs'
    });
    expect(getItemCount('faulty_maw')).toBe(1);
    expect(getCurrentEra()).toBe('primitive');
    expect(getEmergentStoryEvents()).toEqual([]);
  });

  it('derives a stable authority receipt and refuses to begin outside the canonical origin world', () => {
    expect(MAW_REPAIR_RITUAL_SECONDS).toBe(8);
    expect(mawRepairAuthorityBeginCommandId('ch5:maw:repair'))
      .toBe('ch5:maw:repair:ritual-begun');
    addItem('faulty_maw', 1);
    addItem('maw_repair_kit', 1);
    const wrongWorld = createOfflineCommandContext(createWorldIdentity({ x: 0, y: 0 }), {
      rng: createSimulationRng('maw-repair-wrong-world'),
      now: () => now
    });
    expect(beginEmergentMawRepairRitual(wrongWorld, 'ch5:maw:repair')).toMatchObject({
      ok: false,
      reason: 'out-of-order'
    });
    expect(getMawRepairRitualSnapshot().phase).toBe('idle');
  });

  it('cancels an interrupted ritual without spending and restarts from zero', () => {
    addItem('faulty_maw', 1);
    addItem('maw_repair_kit', 1);
    beginEmergentMawRepairRitual(context(), 'ch5:maw:repair');
    for (let index = 0; index < 25; index++) {
      now += 100;
      tickEmergentMawRepairRitual(context(), true, now);
    }
    expect(getMawRepairRitualSnapshot().progress).toBeGreaterThan(0.25);
    expect(tickEmergentMawRepairRitual(context(), false, now + 100)).toMatchObject({
      ok: false,
      reason: 'ritual-required'
    });
    expect(getItemCount('faulty_maw')).toBe(1);
    expect(getItemCount('maw_repair_kit')).toBe(1);
    expect(getMawRepairRitualSnapshot().progress).toBe(0);
    const events = getEmergentStoryEvents();
    expect(events[events.length - 1]?.type).toBe('maw_repair_cancelled');
  });

  it('cannot progress or spend while Story is paused', () => {
    addItem('faulty_maw', 1);
    addItem('maw_repair_kit', 1);
    beginEmergentMawRepairRitual(context(), 'ch5:maw:paused');
    setStoryPaused(true, now);
    for (let index = 0; index < 100; index++) {
      now += 100;
      tickEmergentMawRepairRitual(context(), true, now);
    }
    expect(getMawRepairRitualSnapshot()).toMatchObject({
      phase: 'repairing',
      progress: 0
    });
    expect(getItemCount('faulty_maw')).toBe(1);
    expect(getItemCount('maw_repair_kit')).toBe(1);

    setStoryPaused(false, now);
    now += 100;
    tickEmergentMawRepairRitual(context(), true, now);
    expect(getMawRepairRitualSnapshot().attendedSeconds).toBe(0);
    now += 100;
    tickEmergentMawRepairRitual(context(), true, now);
    expect(getMawRepairRitualSnapshot()).toMatchObject({
      attendedSeconds: 0.1,
      progress: 0.0125
    });
  });

  it('repays bounded active foreground time without shortening the eight-second repair or two-second purpose gap', () => {
    addItem('faulty_maw', 1);
    addItem('maw_repair_kit', 1);
    expect(getAuthoredMawGuidance()).toMatchObject({
      id: 'maw:recover-field-kit',
      markerLabel: 'W-7744 FIELD PACK · RECOVER KIT'
    });
    markMilestone('story:item:maw-repair-kit:acquired');
    expect(getAuthoredMawGuidance()).toMatchObject({
      id: 'maw:begin-repair',
      markerLabel: 'W-7744 FIELD PACK · REPAIR MAW'
    });
    beginEmergentMawRepairRitual(context(), 'ch5:maw:degraded-render');

    expect(getAuthoredMawGuidance()).toMatchObject({
      id: 'maw:attend-repair',
      markerLabel: 'W-7744 FIELD PACK · REPAIR MAW'
    });
    for (let index = 0; index < 15; index++) {
      advanceEmergentMawRepairRitual(context(), true, 2.4);
    }
    expect(getMawRepairRitualSnapshot()).toMatchObject({
      phase: 'repairing',
      progress: 0.9375
    });
    expect(hasMilestone('maw_repaired')).toBe(false);

    advanceEmergentMawRepairRitual(context(), true, 2.4);
    expect(hasMilestone('maw_repaired')).toBe(true);
    expect(getAuthoredMawGuidance()).toMatchObject({
      id: 'maw:purpose-gap',
      markerLabel: 'REPAIRED MAW · LISTEN'
    });

    for (let index = 0; index < 3; index++) advanceMawPurposeGap(context(), 2.4);
    expect(getMawRepairRitualSnapshot().postRepairSeconds).toBe(1.5);
    expect(getMawRepairRitualSnapshot().directionAvailable).toBe(false);
    advanceMawPurposeGap(context(), 2.4);
    expect(getMawRepairRitualSnapshot().postRepairSeconds).toBe(2);
    expect(getMawRepairRitualSnapshot().directionAvailable).toBe(true);
    expect(getAuthoredMawGuidance()).toMatchObject({
      id: 'maw:choose-first-direction',
      markerLabel: 'REPAIRED MAW · CHOOSE DIRECTION'
    });
  });

  it('discards a suspended hidden interval even when no hidden render callback ran', () => {
    const fakeDocument = new EventTarget() as EventTarget & { visibilityState: string };
    fakeDocument.visibilityState = 'visible';
    vi.stubGlobal('document', fakeDocument);
    try {
      addItem('faulty_maw', 1);
      addItem('maw_repair_kit', 1);
      beginEmergentMawRepairRitual(context(), 'ch5:maw:suspended');

      fakeDocument.visibilityState = 'hidden';
      fakeDocument.dispatchEvent(new Event('visibilitychange'));
      fakeDocument.visibilityState = 'visible';
      fakeDocument.dispatchEvent(new Event('visibilitychange'));
      now += 30_000;

      tickEmergentMawRepairRitual(context(), true, now);
      expect(getMawRepairRitualSnapshot().attendedSeconds).toBe(0);
      now += 100;
      tickEmergentMawRepairRitual(context(), true, now);
      expect(getMawRepairRitualSnapshot().attendedSeconds).toBeCloseTo(0.1, 8);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('neither advances nor cancels an attended ritual while the document is hidden', () => {
    addItem('faulty_maw', 1);
    addItem('maw_repair_kit', 1);
    beginEmergentMawRepairRitual(context(), 'ch5:maw:hidden');
    vi.stubGlobal('document', { visibilityState: 'hidden' });
    try {
      now += 30_000;
      expect(tickEmergentMawRepairRitual(context(), false, now)).toMatchObject({
        ok: true,
        pending: true
      });
      expect(getMawRepairRitualSnapshot()).toMatchObject({ phase: 'repairing', progress: 0 });
      expect(getItemCount('faulty_maw')).toBe(1);
      expect(getItemCount('maw_repair_kit')).toBe(1);
    } finally {
      vi.unstubAllGlobals();
    }
    now += 100;
    tickEmergentMawRepairRitual(context(), true, now);
    expect(getMawRepairRitualSnapshot().attendedSeconds).toBe(0);
    now += 100;
    tickEmergentMawRepairRitual(context(), true, now);
    expect(getMawRepairRitualSnapshot()).toMatchObject({
      attendedSeconds: 0.1,
      progress: 0.0125
    });
  });

  it('discards paused and hidden wall-clock gaps from the post-repair purpose interval', () => {
    addItem('faulty_maw', 1);
    addItem('maw_repair_kit', 1);
    beginEmergentMawRepairRitual(context(), 'ch5:maw:purpose-clock');
    for (let index = 0; index < 16; index++) {
      advanceEmergentMawRepairRitual(context(), true, 2.4);
    }

    setStoryPaused(true, now);
    now += 30_000;
    tickMawPurposeGap(context(), now);
    expect(getMawRepairRitualSnapshot().postRepairSeconds).toBe(0);
    setStoryPaused(false, now);
    now += 100;
    tickMawPurposeGap(context(), now);
    expect(getMawRepairRitualSnapshot().postRepairSeconds).toBe(0);
    now += 100;
    tickMawPurposeGap(context(), now);
    expect(getMawRepairRitualSnapshot().postRepairSeconds).toBeCloseTo(0.1, 8);

    vi.stubGlobal('document', { visibilityState: 'hidden' });
    try {
      now += 30_000;
      tickMawPurposeGap(context(), now);
      expect(getMawRepairRitualSnapshot().postRepairSeconds).toBeCloseTo(0.1, 8);
    } finally {
      vi.unstubAllGlobals();
    }
    now += 100;
    tickMawPurposeGap(context(), now);
    expect(getMawRepairRitualSnapshot().postRepairSeconds).toBeCloseTo(0.1, 8);
    now += 100;
    tickMawPurposeGap(context(), now);
    expect(getMawRepairRitualSnapshot().postRepairSeconds).toBeCloseTo(0.2, 8);
  });

  it('waits through the purpose gap, then records player withholding before visible pond response', () => {
    addItem('faulty_maw', 1);
    addItem('maw_repair_kit', 1);
    markMilestone('story:item:maw-repair-kit:acquired');
    beginEmergentMawRepairRitual(context(), 'ch5:maw:repair');
    for (let index = 0; index < 80; index++) {
      now += 100;
      tickEmergentMawRepairRitual(context(), true, now);
    }
    expect(commitMawFirstDirection(context(), 'lowered-and-listened', 'maw:direction').ok).toBe(false);
    for (let index = 0; index < 20; index++) {
      now += 100;
      tickMawPurposeGap(context(), now);
    }
    expect(commitMawFirstDirection(context(), 'lowered-and-listened', 'maw:direction').ok).toBe(true);
    expect(getMawFirstDirectionChoice()).toBe('lowered-and-listened');
    expect(hasMilestone(EMERGENT_MAW_MILESTONES.directionLowered)).toBe(true);
    expect(getAuthoredMawGuidance()).toMatchObject({
      id: 'maw:observe-pond-response',
      markerLabel: 'POND RESPONSE · ATTEND',
      kind: 'interact'
    });
    expect(commitMawPondResonance(context(), false, 'maw:pond')).toMatchObject({
      ok: false,
      reason: 'physical-response-required'
    });
    expect(commitMawPondResonance(context(), true, 'maw:pond').ok).toBe(true);
    expect(hasMilestone(EMERGENT_MAW_MILESTONES.pondResonance)).toBe(true);
    expect(getAuthoredMawGuidance()).toMatchObject({
      id: 'maw:resonance-settling',
      markerLabel: 'POND RESPONSE · RESOLVED'
    });
    expect(getEmergentStoryEvents().slice(-2).map(event => event.type)).toEqual([
      'maw_direction_resolved',
      'keel_resonance_detected'
    ]);
  });

  it('accepts a harmless first test only from a real post-gap Iron Maw mining receipt', () => {
    addItem('faulty_maw', 1);
    addItem('maw_repair_kit', 1);
    beginEmergentMawRepairRitual(context(), 'ch5:maw:harmless-test-repair');
    for (let index = 0; index < 16; index++) {
      advanceEmergentMawRepairRitual(context(), true, 2.4);
    }

    const acceptedMine = (blockId: BlockId, toolId: ItemId | null, commandId: string) => {
      let removed = false;
      const terrain: MineVoxelTerrain = {
        getVoxel: () => removed ? null : { blockId },
        removeVoxel: () => {
          if (removed) return false;
          removed = true;
          return true;
        },
        exposeNeighbors: () => 0,
        isDeleted: () => removed
      };
      return mineVoxelCommand(context(), {
        coord: { x: 2, y: 3, z: 4 },
        terrain,
        toolTier: 1,
        toolId,
        commandId
      });
    };

    const tooEarly = acceptedMine('stone', 'iron_maw', 'maw-test:too-early');
    expect(commitMawHarmlessTestFromAcceptedMine(context(), {
      result: tooEarly,
      toolId: 'iron_maw',
      blockId: 'stone'
    })).toMatchObject({ ok: false, reason: 'out-of-order' });

    for (let index = 0; index < 4; index++) advanceMawPurposeGap(context(), 2.4);

    const wrongTool = acceptedMine('stone', 'stone_pickaxe', 'maw-test:wrong-tool');
    expect(commitMawHarmlessTestFromAcceptedMine(context(), {
      result: wrongTool,
      toolId: 'stone_pickaxe',
      blockId: 'stone'
    })).toMatchObject({ ok: false, reason: 'accepted-maw-test-required' });

    const forgedToolClaim = commitMawHarmlessTestFromAcceptedMine(context(), {
      result: wrongTool,
      toolId: 'iron_maw',
      blockId: 'stone'
    });
    expect(forgedToolClaim).toMatchObject({
      ok: false,
      reason: 'accepted-maw-test-required'
    });

    const softGround = acceptedMine('dirt', 'iron_maw', 'maw-test:soft-ground');
    expect(commitMawHarmlessTestFromAcceptedMine(context(), {
      result: softGround,
      toolId: 'iron_maw',
      blockId: 'dirt'
    })).toMatchObject({ ok: false, reason: 'accepted-maw-test-required' });

    const acceptedMetal = acceptedMine('copper_block', 'iron_maw', 'maw-test:accepted-metal');
    expect(acceptedMetal.ok && acceptedMetal.events.find(event => event.type === 'voxel_mined')?.payload)
      .toMatchObject({ blockId: 'copper_block', toolId: 'iron_maw' });
    expect(commitMawHarmlessTestFromAcceptedMine(context(), {
      result: acceptedMetal,
      toolId: 'iron_maw',
      blockId: 'copper_block'
    })).toMatchObject({ ok: true, idempotent: false });
    expect(getMawFirstDirectionChoice()).toBe('harmless-test');
    expect(hasMilestone(EMERGENT_MAW_MILESTONES.directionTested)).toBe(true);
    expect(hasMilestone(EMERGENT_MAW_MILESTONES.directionResolved)).toBe(true);
    expect(getEmergentStoryEvents().find(event => event.type === 'maw_direction_resolved'))
      .toMatchObject({
        payload: { choice: 'harmless-test', targetKind: 'copper_block' }
      });
  });

  it('does not call a mounted but off-screen pond response observed', () => {
    expect(isMawPondResponseObserved({
      playerNearPond: true,
      responseMeshMounted: true,
      cameraAlignment: 0.2,
      visibleSeconds: 10
    })).toBe(false);
    expect(isMawPondResponseObserved({
      playerNearPond: true,
      responseMeshMounted: true,
      cameraAlignment: 0.97,
      visibleSeconds: 0.55
    })).toBe(true);
    expect(isMawPondResponseAttendable({
      playerNearPond: true,
      responseMeshMounted: true
    })).toBe(true);
    expect(isMawPondResponseAttendable({
      playerNearPond: false,
      responseMeshMounted: true
    })).toBe(false);
  });
});
