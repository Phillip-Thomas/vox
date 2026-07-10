import { describe, expect, it, beforeEach } from 'vitest';
import { getStoryInputPolicy, SANDBOX_POLICY, setStoryFeedBlend, setStoryMoveScale } from './storyInputPolicy.ts';
import { advanceToBeat, beginStory, completeStory, deactivateStory, getStoryStateSnapshot } from './storyState.ts';
import { resetProgression } from '../game/systems/progressionSystem.ts';
import { resetVoxelRealityRenderState, getVoxelRealityStage } from '../game/systems/realityRenderSystem.ts';

describe('storyInputPolicy', () => {
  beforeEach(() => {
    deactivateStory();
    resetProgression();
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

  it('feed chapters lock look, slow movement, and gate build/craft/interactions', () => {
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
    expect(p.voxelPropsOnly).toBe(true);
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

  it('sandbox policy carries the neutral lens knobs', () => {
    const p = getStoryInputPolicy();
    expect(p.targetDpr).toBeNull();
    expect(p.voxelPropsOnly).toBe(false);
  });

  it('completing the story returns the sandbox policy at material stage', () => {
    beginStory();
    advanceToBeat('a3-dawn');
    completeStory();
    expect(getStoryStateSnapshot().active).toBe(false);
    expect(getStoryInputPolicy()).toBe(SANDBOX_POLICY);
    expect(getVoxelRealityStage()).toBe('material');
  });
});
