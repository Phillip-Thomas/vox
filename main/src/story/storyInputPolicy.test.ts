import { describe, expect, it, beforeEach } from 'vitest';
import {
  getStoryInputPolicy,
  isFabricatorRecipeAllowed,
  SANDBOX_POLICY,
  setStoryFeedBlend,
  setStoryMoveScale
} from './storyInputPolicy.ts';
import { advanceToBeat, beginStory, completeStory, deactivateStory, getStoryStateSnapshot } from './storyState.ts';
import { resetProgression } from '../game/systems/progressionSystem.ts';
import { resetVoxelRealityRenderState, getVoxelRealityStage } from '../game/systems/realityRenderSystem.ts';
import {
  applyShipRestorationSnapshot,
  resetShipRestoration
} from '../game/systems/shipRestoration.ts';

describe('storyInputPolicy', () => {
  beforeEach(() => {
    deactivateStory();
    resetProgression();
    resetShipRestoration();
    resetVoxelRealityRenderState();
  });

  it('returns the frozen allow-all sandbox policy when story is inactive', () => {
    const p = getStoryInputPolicy();
    expect(p).toBe(SANDBOX_POLICY);
    expect(p.moveSpeedScale).toBe(1);
    expect(p.allowJump).toBe(true);
    expect(p.allowBuild).toBe(true);
    expect(p.recipeAllowed('anything')).toBe(true);
    expect(p.allowBaseInteraction('board')).toBe(true);
    expect(p.lookMode).toBe('free');
  });

  it('director mutation hooks are no-ops against the sandbox policy', () => {
    setStoryMoveScale(0);
    setStoryFeedBlend(0);
    expect(getStoryInputPolicy().moveSpeedScale).toBe(1);
    expect(getStoryInputPolicy().feedBlend).toBe(1);
  });

  it('the raster beat is a side-scroller: side look, jump on, chunky dpr', () => {
    beginStory(); // fresh save -> prologue
    advanceToBeat('ch1-raster');
    const p = getStoryInputPolicy();
    expect(p.lookMode).toBe('side');
    expect(p.allowJump).toBe(true);
    expect(p.targetDpr).not.toBeNull();
    expect(p.targetDpr!).toBeLessThan(0.6);
    expect(p.voxelPropsOnly).toBe(true);
    expect(p.allowBuild).toBe(false);
    expect(p.allowCraft).toBe(false);
  });

  it('the embodied survey locks look and actions without retaining camera-feed resolution', () => {
    beginStory(); // fresh save -> prologue
    advanceToBeat('ch1-anomaly');
    const p = getStoryInputPolicy();
    expect(p.lookMode).toBe('feed');
    expect(p.moveSpeedScale).toBeLessThan(1);
    expect(p.allowJump).toBe(false);
    expect(p.allowBuild).toBe(false);
    expect(p.allowCraft).toBe(false);
    expect(p.allowBaseInteraction('drink')).toBe(false);
    expect(p.targetFov).toBeLessThan(SANDBOX_POLICY.targetFov);
    expect(p.targetDpr).toBeNull();
    expect(p.voxelPropsOnly).toBe(true);
    // The first playable first-person look drags on a smooth heading: the
    // feed-era 90° yaw snap is retired here (owner decision 2026-07-21) while
    // the pinned CCTV pitch band (feedBlend 0) stays.
    expect(p.smoothYaw).toBe(true);
    expect(p.feedBlend).toBe(0);
  });

  it('pod recovery (ch1-depth) forbids mining; its extract-era neighbours allow it', () => {
    beginStory();
    advanceToBeat('ch1-depth');
    // No extract verb on the pod row: a held/latched harvest key must not dig.
    expect(getStoryInputPolicy().allowMine).toBe(false);
    advanceToBeat('ch1-raster');
    expect(getStoryInputPolicy().allowMine).not.toBe(false);
    advanceToBeat('ch1-fixed');
    expect(getStoryInputPolicy().allowMine).not.toBe(false);
  });

  it('the a1 ramp keeps the embodied smooth-yaw look while it freezes the feet', () => {
    beginStory();
    advanceToBeat('a1-ramp');
    const p = getStoryInputPolicy();
    expect(p.lookMode).toBe('feed');
    expect(p.smoothYaw).toBe(true);
    expect(p.feedBlend).toBe(0);
    expect(p.moveSpeedScale).toBe(0);
  });

  it('ch3 frees movement, whitelists the campfire chain, and keeps the ship locked', () => {
    beginStory();
    advanceToBeat('ch3-gather');
    const p = getStoryInputPolicy();
    expect(p.lookMode).toBe('free');
    expect(p.moveSpeedScale).toBe(1);
    expect(p.allowCraft).toBe(true);
    expect(p.recipeAllowed('campfire')).toBe(true);
    expect(p.recipeAllowed('iron_maw')).toBe(false);
    expect(p.allowBaseInteraction('drink')).toBe(true);
    expect(p.allowBaseInteraction('board')).toBe(false);
  });

  it('director mutations apply to live story policies and reset on beat change', () => {
    beginStory();
    advanceToBeat('ch1-anomaly');
    setStoryMoveScale(0);
    expect(getStoryInputPolicy().moveSpeedScale).toBe(0);
    advanceToBeat('ch2-color');
    expect(getStoryInputPolicy().moveSpeedScale).toBeGreaterThan(0);
  });

  it('keeps chapter fabrication knowledge narrow and cumulative across the Kestrel arc', () => {
    beginStory();
    advanceToBeat('ch7-reconstruct');
    expect(getStoryInputPolicy().recipeAllowed('campfire')).toBe(true);
    expect(getStoryInputPolicy().recipeAllowed('lift_cell')).toBe(false);
    expect(getStoryInputPolicy().recipeAllowed('logic_wafer')).toBe(false);

    applyShipRestorationSnapshot({ repairStage: 'hull_sealed' });
    expect(getStoryInputPolicy().recipeAllowed('lift_cell')).toBe(true);
    expect(getStoryInputPolicy().recipeAllowed('logic_wafer')).toBe(false);

    applyShipRestorationSnapshot({ repairStage: 'lift_online' });
    expect(getStoryInputPolicy().recipeAllowed('logic_wafer')).toBe(true);
    expect(getStoryInputPolicy().recipeAllowed('range_coil')).toBe(false);

    applyShipRestorationSnapshot({ repairStage: 'flight_ready' });
    advanceToBeat('ch9-settle');
    expect(getStoryInputPolicy().allowBaseInteraction('board')).toBe(false);
    expect(getStoryInputPolicy().recipeAllowed('lift_cell')).toBe(true);
    expect(getStoryInputPolicy().recipeAllowed('logic_wafer')).toBe(true);
    expect(getStoryInputPolicy().recipeAllowed('habitat_core')).toBe(true);
    expect(getStoryInputPolicy().recipeAllowed('range_coil')).toBe(false);
    expect(getStoryInputPolicy().recipeAllowed('void_maw')).toBe(false);
  });

  it('closes fabrication during landfall and retains only earned patterns after handback', () => {
    beginStory();
    applyShipRestorationSnapshot({ repairStage: 'flight_ready' });
    advanceToBeat('ch8-landfall');
    expect(getStoryInputPolicy().allowCraft).toBe(false);
    expect(isFabricatorRecipeAllowed('range_coil')).toBe(false);

    advanceToBeat('ch9-hearth');
    expect(getStoryInputPolicy().allowBaseInteraction('board')).toBe(false);
    completeStory();
    expect(getStoryInputPolicy()).toBe(SANDBOX_POLICY);
    expect(getStoryInputPolicy().allowBaseInteraction('board')).toBe(true);
    expect(isFabricatorRecipeAllowed('campfire')).toBe(true);
    expect(isFabricatorRecipeAllowed('lift_cell')).toBe(true);
    expect(isFabricatorRecipeAllowed('logic_wafer')).toBe(true);
    expect(isFabricatorRecipeAllowed('habitat_core')).toBe(true);
    expect(isFabricatorRecipeAllowed('range_coil')).toBe(false);
    expect(isFabricatorRecipeAllowed('void_maw')).toBe(false);
  });

  it('sandbox policy carries the neutral lens knobs', () => {
    const p = getStoryInputPolicy();
    expect(p.targetDpr).toBeNull();
    expect(p.voxelPropsOnly).toBe(false);
  });

  it('completing the two-world story returns the sandbox policy at the earned alive stage', () => {
    beginStory();
    advanceToBeat('a3-dawn');
    completeStory();
    expect(getStoryStateSnapshot().active).toBe(false);
    expect(getStoryInputPolicy()).toBe(SANDBOX_POLICY);
    expect(getVoxelRealityStage()).toBe('alive');
  });
});
