import { describe, expect, it, beforeEach } from 'vitest';
import * as THREE from 'three';
import { beginA1, beginA2, beginA3, storyDirectorTick } from './storyDirector.ts';
import { getStoryInputPolicy } from './storyInputPolicy.ts';
import { placeCampfire, resetCampfires } from '../game/systems/campfires.ts';
import { consumeMawCharge, getMawCharge, MAX_MAW_CHARGE } from '../game/systems/mawSystem.ts';
import { setMiningProgress } from '../game/systems/miningProgress.ts';
import { getStoryForcedDayPhase } from './storyDayPhase.ts';
import { getCinematicLookWeight } from './cinematicLook.ts';
import { DUSK } from './storyScript.ts';
import {
  advanceToBeat,
  beginStory,
  deactivateStory,
  getStoryStateSnapshot,
  STORY_MILESTONES
} from './storyState.ts';
import { hasMilestone, markMilestone, resetProgression } from '../game/systems/progressionSystem.ts';
import {
  getVoxelRealityEffects,
  getVoxelRealityStage,
  resetVoxelRealityRenderState,
  setVoxelRealityStage
} from '../game/systems/realityRenderSystem.ts';
import { addItem, removeItem, getItemCount } from '../game/systems/inventorySystem.ts';
import { getFeedRuntime } from './feedRuntime.ts';
import { getStoryText } from './storyText.ts';
import { CH1_QUOTA, A1_RAMP_SECONDS } from './storyScript.ts';

function drainInventory(id: 'biofiber' | 'stone') {
  const n = getItemCount(id);
  if (n > 0) removeItem(id, n);
}

function tickSeconds(seconds: number, step = 1 / 60) {
  for (let t = 0; t < seconds; t += step) storyDirectorTick(step, null);
}

describe('storyDirector — chapter 1 and A1', () => {
  beforeEach(() => {
    deactivateStory();
    resetProgression();
    resetVoxelRealityRenderState();
    drainInventory('biofiber');
    drainInventory('stone');
    // Enter ch1 the way the prologue handoff does.
    markMilestone(STORY_MILESTONES.prologueSeen);
    beginStory();
    setVoxelRealityStage('bare');
    advanceToBeat('ch1-raster');
  });

  it('the raster beat sets the survival work order (no auto-advance timer)', () => {
    expect(getStoryText().workorder.length).toBeGreaterThan(0);
    tickSeconds(20);
    expect(getStoryStateSnapshot().beat).toBe('ch1-raster'); // quota-gated only
  });

  it('meeting the quota restores pan-tilt (anomaly beat) and records the milestone', () => {
    addItem('biofiber', CH1_QUOTA.biofiber);
    expect(getStoryStateSnapshot().beat).toBe('ch1-raster'); // fiber alone is not enough
    addItem('stone', CH1_QUOTA.stone);
    expect(getStoryStateSnapshot().beat).toBe('ch1-anomaly');
    expect(hasMilestone(STORY_MILESTONES.ch1Quota)).toBe(true);
  });

  it('resuming into the raster beat with the quota already met advances on the next tick', () => {
    // Collect while the watcher is not looking (simulates a reload-with-items).
    advanceToBeat('crawl');
    addItem('biofiber', CH1_QUOTA.biofiber);
    addItem('stone', CH1_QUOTA.stone);
    advanceToBeat('ch1-raster');
    expect(getStoryStateSnapshot().beat).toBe('ch1-raster');
    tickSeconds(0.1);
    expect(getStoryStateSnapshot().beat).toBe('ch1-anomaly');
    expect(hasMilestone(STORY_MILESTONES.ch1Quota)).toBe(true);
  });

  it('beginA1 only fires from the anomaly beat', () => {
    beginA1();
    expect(getStoryStateSnapshot().beat).toBe('ch1-raster');
    advanceToBeat('ch1-anomaly');
    beginA1();
    expect(getStoryStateSnapshot().beat).toBe('a1-ramp');
  });

  it('the A1 ramp climbs chroma and lands exactly on the color stage', () => {
    advanceToBeat('ch1-anomaly');
    beginA1();
    tickSeconds(A1_RAMP_SECONDS / 2);
    const mid = getVoxelRealityEffects().chroma;
    expect(mid).toBeGreaterThan(0);
    expect(getVoxelRealityStage()).toBe('bare'); // still ramping via overrides
    tickSeconds(A1_RAMP_SECONDS / 2 + 0.5);
    expect(getVoxelRealityStage()).toBe('color');
    expect(getVoxelRealityEffects().chroma).toBe(1);
    expect(hasMilestone(STORY_MILESTONES.a1)).toBe(true);
    expect(getStoryStateSnapshot().beat).toBe('ch2-color');
    expect(getFeedRuntime().desat).toBe(0); // the DOM grayscale released with it
  });

  it('A2 runs flood → death → liberation → handoff into chapter 3', () => {
    advanceToBeat('ch2-approach');
    beginA2();
    expect(getStoryStateSnapshot().beat).toBe('a2-awakening');
    // flood: violations accumulate; movement frozen by the beat policy
    tickSeconds(1.5);
    expect(getStoryText().violation.length).toBeGreaterThan(0);
    expect(getStoryInputPolicy().moveSpeedScale).toBe(0);
    // liberation: blend + fov open, treatment dissolves
    tickSeconds(5.5); // t = 7.0 (mid-liberation)
    expect(getStoryInputPolicy().feedBlend).toBeGreaterThan(0.2);
    expect(getStoryInputPolicy().targetFov).toBeGreaterThan(55);
    expect(getFeedRuntime().treatment).toBeLessThan(0.9);
    // handoff
    tickSeconds(6);
    expect(getStoryStateSnapshot().beat).toBe('ch3-gather');
    expect(hasMilestone(STORY_MILESTONES.a2)).toBe(true);
    expect(getStoryInputPolicy().lookMode).toBe('free');
    expect(getStoryInputPolicy().recipeAllowed('campfire')).toBe(true);
    expect(getFeedRuntime().treatment).toBe(0);
  });

  it('chapter 3: campfire brings dusk, night enables rest, A3 completes the slice', () => {
    resetCampfires();
    advanceToBeat('ch3-gather');
    expect(getStoryForcedDayPhase()).toBeCloseTo(0.25, 5); // regulation noon holds
    placeCampfire(new THREE.Vector3(0, 25, 0), new THREE.Vector3(0, 1, 0));
    expect(getStoryStateSnapshot().beat).toBe('ch3-dusk');
    // the dusk CUTSCENE: bars + camera pull + held feet, then control returns
    tickSeconds(2);
    expect(getFeedRuntime().cinematic).toBeGreaterThan(0.5);
    expect(getCinematicLookWeight()).toBeGreaterThan(0.5);
    expect(getStoryInputPolicy().moveSpeedScale).toBe(0);
    tickSeconds(8); // t = 10 — cutscene over, sun still sliding
    expect(getFeedRuntime().cinematic).toBe(0);
    expect(getCinematicLookWeight()).toBe(0);
    expect(getStoryInputPolicy().moveSpeedScale).toBe(1);
    // the first dusk: the sun slides to the target phase, then rolls on its own
    tickSeconds(DUSK.lerpSeconds + 1);
    expect(getStoryStateSnapshot().beat).toBe('ch3-await-rest');
    expect(getStoryForcedDayPhase()!).toBeGreaterThanOrEqual(DUSK.targetPhase - 0.01);
    // resting is refused before nightfall
    beginA3();
    expect(getStoryStateSnapshot().beat).toBe('a3-dawn'); // beginA3 gates only on beat…
    // …the NIGHT gate lives in the [F] resolver; drive on through the dawn:
    tickSeconds(5); // sleep fade + hold black -> wake just before sunrise
    expect(getStoryForcedDayPhase()!).toBeGreaterThan(0.9);
    tickSeconds(25); // fade up + material ramp + captions + handoff
    expect(getStoryStateSnapshot().active).toBe(false);
    expect(getStoryStateSnapshot().chapter).toBe('complete');
    expect(getVoxelRealityStage()).toBe('material');
    expect(hasMilestone(STORY_MILESTONES.a3)).toBe(true);
    expect(hasMilestone(STORY_MILESTONES.complete)).toBe(true);
    expect(getStoryForcedDayPhase()).toBeNull(); // the sun belongs to the player now
    expect(getStoryInputPolicy().allowBuild).toBe(true); // sandbox restored
  });

  it('the harvester arrives charged and trickle-recharges while idle (not while mining)', () => {
    expect(getMawCharge()).toBe(MAX_MAW_CHARGE); // ch1-raster entry charges it
    consumeMawCharge(40);
    tickSeconds(2);
    const afterIdle = getMawCharge();
    expect(afterIdle).toBeGreaterThan(MAX_MAW_CHARGE - 40); // trickled up
    // No recharge while actively extracting.
    setMiningProgress(true, 0.4, false);
    const beforeMining = getMawCharge();
    tickSeconds(2);
    expect(getMawCharge()).toBe(beforeMining);
    setMiningProgress(false, 0, false);
    // Ch3 (post-A2): the damage bites — no trickle until repaired.
    advanceToBeat('ch3-gather');
    consumeMawCharge(30);
    const ch3Charge = getMawCharge();
    tickSeconds(3);
    expect(getMawCharge()).toBe(ch3Charge);
  });

  it('glitch flashes drop desat for exactly two frames and restore', () => {
    addItem('biofiber', 3); // afterQuotaCount: 3 flash trigger
    storyDirectorTick(1 / 60, null);
    expect(getFeedRuntime().desat).toBe(0);
    expect(getVoxelRealityEffects().chroma).toBe(1);
    storyDirectorTick(1 / 60, null);
    expect(getFeedRuntime().desat).toBe(1);
    expect(getVoxelRealityEffects().chroma).toBe(0);
  });
});
