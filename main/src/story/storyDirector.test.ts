import { describe, expect, it, beforeEach } from 'vitest';
import * as THREE from 'three';
import { beginA1, beginA2, beginA3, beginVigilSleep, storyDirectorTick, vigilRestReady } from './storyDirector.ts';
import { getConstellationReveal } from './skyMeaning.ts';
import { getStoryInputPolicy } from './storyInputPolicy.ts';
import { placeCampfire, resetCampfires } from '../game/systems/campfires.ts';
import { consumeMawCharge, getMawCharge, MAX_MAW_CHARGE } from '../game/systems/mawSystem.ts';
import { setMiningProgress } from '../game/systems/miningProgress.ts';
import { drink, feed, getVitals, setVitals } from '../game/systems/survivalVitals.ts';
import { getPlayerWorldPosition } from '../state/playerFrame.ts';
import { wreckRelayHandle } from './world/WreckRelay.tsx';
import { getStoryForcedDayPhase } from './storyDayPhase.ts';
import { getCinematicLookWeight } from './cinematicLook.ts';
import { seedDebrisCollected } from './debrisSalvage.ts';
import { ARRIVAL, CH3_CAPTIONS, DUSK, FIRST_DAY, SIGNAL, VIGIL } from './storyScript.ts';
import {
  advanceToBeat,
  beginStory,
  deactivateStory,
  getStoryStateSnapshot,
  recordStoryChoice,
  restartStory,
  STORY_MILESTONES
} from './storyState.ts';
import { getAuditWorkerPose } from './world/AuditWorker.tsx';
import { getMilestones, hasMilestone, markMilestone, resetProgression } from '../game/systems/progressionSystem.ts';
import {
  getVoxelRealityEffects,
  getVoxelRealityStage,
  resetVoxelRealityRenderState,
  setVoxelRealityStage
} from '../game/systems/realityRenderSystem.ts';
import { addItem, removeItem, getItemCount } from '../game/systems/inventorySystem.ts';
import { getFeedRuntime } from './feedRuntime.ts';
import { getStoryText } from './storyText.ts';
import { ANOMALY_SURVEY, CH1_QUOTA, A1_RAMP_SECONDS } from './storyScript.ts';
import { resetStoryClock, setStoryPaused } from './storyClock.ts';

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
    resetStoryClock();
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

  it('meeting the quota + salvage opens the belt-scroll era and records the milestone', () => {
    seedDebrisCollected(); // hull debris recovered
    addItem('biofiber', CH1_QUOTA.biofiber);
    expect(getStoryStateSnapshot().beat).toBe('ch1-raster'); // fiber alone is not enough
    addItem('stone', CH1_QUOTA.stone);
    expect(getStoryStateSnapshot().beat).toBe('ch1-depth');
    expect(hasMilestone(STORY_MILESTONES.ch1Quota)).toBe(true);
  });

  it('the 2D→3D lift plays as a real ~7s cutscene and hands over to the feed', () => {
    advanceToBeat('ch1-lift');
    // Letterbox up mid-way, feet held…
    tickSeconds(2);
    expect(getFeedRuntime().cinematic).toBeGreaterThan(0.5);
    expect(getStoryInputPolicy().moveSpeedScale).toBe(0);
    expect(getStoryInputPolicy().sideBlend).toBeGreaterThan(0);
    // …then it hands over to the pan-tilt feed.
    tickSeconds(5.5);
    expect(getStoryStateSnapshot().beat).toBe('ch1-anomaly');
  });

  it('resuming into the raster beat with the quota already met advances on the next tick', () => {
    // Collect while the watcher is not looking (simulates a reload-with-items).
    advanceToBeat('crawl');
    seedDebrisCollected();
    addItem('biofiber', CH1_QUOTA.biofiber);
    addItem('stone', CH1_QUOTA.stone);
    advanceToBeat('ch1-raster');
    expect(getStoryStateSnapshot().beat).toBe('ch1-raster');
    tickSeconds(0.1);
    expect(getStoryStateSnapshot().beat).toBe('ch1-depth'); // the belt-scroll era opens
    expect(hasMilestone(STORY_MILESTONES.ch1Quota)).toBe(true);
  });

  it('beginA1 only fires from the anomaly beat, and only once the mass is designated', () => {
    beginA1();
    expect(getStoryStateSnapshot().beat).toBe('ch1-raster');
    advanceToBeat('ch1-anomaly');
    // Stage 1 (the calibration sweep): the stone will not answer yet.
    beginA1();
    expect(getStoryStateSnapshot().beat).toBe('ch1-anomaly');
    // The sweep's time fallback designates the mass (no live camera in tests);
    // the touch arms one stage later, so the order can LAND before the answer.
    tickSeconds(ANOMALY_SURVEY.fallbackSeconds + 0.5);
    beginA1();
    expect(getStoryStateSnapshot().beat).toBe('ch1-anomaly'); // designated, not yet armed
    tickSeconds(ANOMALY_SURVEY.armSeconds + 0.5);
    beginA1();
    expect(getStoryStateSnapshot().beat).toBe('a1-ramp');
  });

  it('the A1 ramp climbs chroma and lands exactly on the color stage', () => {
    advanceToBeat('ch1-anomaly');
    tickSeconds(ANOMALY_SURVEY.fallbackSeconds + ANOMALY_SURVEY.armSeconds + 0.5); // sweep fallback designates + arms
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

  it('a same-page replay resets director caption and one-shot runtime', () => {
    advanceToBeat('ch3-gather');
    tickSeconds(15.1);
    expect(getStoryText().caption?.text).toBe(CH3_CAPTIONS.gather);

    restartStory();
    expect(getStoryStateSnapshot().beat).toBe('crawl');
    advanceToBeat('ch3-gather');
    tickSeconds(15.1);
    expect(getStoryText().caption?.text).toBe(CH3_CAPTIONS.gather);
  });

  it('freezes A1 narrative time and effects while paused', () => {
    advanceToBeat('ch1-anomaly');
    tickSeconds(ANOMALY_SURVEY.fallbackSeconds + ANOMALY_SURVEY.armSeconds + 0.5);
    beginA1();
    tickSeconds(2);
    const chromaBeforePause = getVoxelRealityEffects().chroma;
    const beatBeforePause = getStoryStateSnapshot().beat;

    setStoryPaused(true, 2000);
    tickSeconds(A1_RAMP_SECONDS + 2);
    expect(getStoryStateSnapshot().beat).toBe(beatBeforePause);
    expect(getVoxelRealityEffects().chroma).toBeCloseTo(chromaBeforePause, 6);

    setStoryPaused(false, 12000);
    tickSeconds(A1_RAMP_SECONDS);
    expect(getStoryStateSnapshot().beat).toBe('ch2-color');
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

  it('chapter 3: campfire brings dusk, night enables rest, A3 opens the first day', () => {
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
    // The story no longer ends at the dawn: the first day alive begins, uncut.
    expect(getStoryStateSnapshot().active).toBe(true);
    expect(getStoryStateSnapshot().beat).toBe('ch3-thirst');
    expect(getVoxelRealityStage()).toBe('material');
    expect(hasMilestone(STORY_MILESTONES.a3)).toBe(true);
    expect(hasMilestone(STORY_MILESTONES.complete)).toBe(false);
    expect(getStoryForcedDayPhase()).not.toBeNull(); // the sun stays the director's
    expect(getStoryInputPolicy().recipeAllowed('waterskin')).toBe(true);
  });

  it('ambient musings fire during genuine lulls, one-shot per save', () => {
    markMilestone(STORY_MILESTONES.a2);
    markMilestone(STORY_MILESTONES.a3);
    advanceToBeat('ch3-thirst');
    // The scene's own cues land first (8/25/29/35/70s); a musing needs 45–75s
    // of caption silence after them, so a dawdler hears one — a player being
    // led by cues never does.
    tickSeconds(40);
    expect(getMilestones().some(m => m.startsWith('story:musing:'))).toBe(false);
    tickSeconds(120);
    const fired = getMilestones().filter(m => m.startsWith('story:musing:'));
    expect(fired.length).toBeGreaterThanOrEqual(1);
    expect(fired.length).toBeLessThanOrEqual(2); // spaced, never a feed of epiphanies
  });

  it('the first day alive: thirst → forage → klaxon → vigil → arrival (temporary terminal)', () => {
    resetCampfires();
    placeCampfire(new THREE.Vector3(0, 25, 0), new THREE.Vector3(0, 1, 0));
    markMilestone(STORY_MILESTONES.a2);
    markMilestone(STORY_MILESTONES.a3);
    setVoxelRealityStage('material');
    advanceToBeat('ch3-thirst');
    // The scene owns the sensation: THIRST is named on cue, already falling.
    expect(getVitals().thirst).toBeLessThanOrEqual(FIRST_DAY.thirstSeed);
    tickSeconds(FIRST_DAY.thirstNameAt + 1);
    expect(hasMilestone(STORY_MILESTONES.senseWater)).toBe(true);
    expect(getStoryStateSnapshot().beat).toBe('ch3-thirst'); // the task still open
    // The drink: a discrete rise advances the day.
    drink(60);
    tickSeconds(0.5);
    expect(hasMilestone(STORY_MILESTONES.ch3Drank)).toBe(true);
    expect(getStoryStateSnapshot().beat).toBe('ch3-forage');
    // HUNGER named on cue; the first meal advances after the pillar settles.
    tickSeconds(FIRST_DAY.hungerCueAt + 1);
    expect(hasMilestone(STORY_MILESTONES.senseFood)).toBe(true);
    feed(12, 6);
    tickSeconds(FIRST_DAY.pillarAfterEat + FIRST_DAY.advanceAfterPillar + 1);
    expect(hasMilestone(STORY_MILESTONES.ch3Ate)).toBe(true);
    expect(getStoryStateSnapshot().beat).toBe('ch3-signal');
    // The klaxon: the summons must fully land, THEN the relay resolves.
    wreckRelayHandle.position = getPlayerWorldPosition().clone();
    tickSeconds(SIGNAL.runCueAt);
    expect(getStoryStateSnapshot().beat).toBe('ch3-signal'); // lines still landing
    tickSeconds(3);
    expect(hasMilestone(STORY_MILESTONES.ch3Signal)).toBe(true);
    expect(getStoryStateSnapshot().beat).toBe('ch4-vigil');
    // The scheduled dark: dusk lerps, night opens the ordered rest.
    tickSeconds(VIGIL.duskLerpSeconds + 15);
    expect(getStoryForcedDayPhase()!).toBeGreaterThanOrEqual(DUSK.nightStart - 0.01);
    // The ordered rest refills what a night can refill: stamina + warmth only.
    setVitals({ stamina: 34, warmth: 41 });
    beginVigilSleep();
    expect(getVitals().stamina).toBe(100);
    expect(getVitals().warmth).toBe(100);
    expect(getStoryStateSnapshot().beat).toBe('ch4-arrival');
    expect(hasMilestone(STORY_MILESTONES.ch4Vigil)).toBe(true);
    // The arrival plays out and TEMPORARILY completes the story (ch4-audit
    // continues from here — see PARAVOXIA_CH4_PLAN.md §2 S6). The auditor is
    // NOT hidden — he stays standing at the relay into the done world.
    tickSeconds(ARRIVAL.endAt + 1);
    expect(getStoryStateSnapshot().active).toBe(false);
    expect(getStoryStateSnapshot().chapter).toBe('complete');
    expect(getAuditWorkerPose().visible).toBe(true); // "he stays to look"
    expect(hasMilestone(STORY_MILESTONES.ch4Arrived)).toBe(true);
    expect(hasMilestone(STORY_MILESTONES.complete)).toBe(true);
    expect(hasMilestone(STORY_MILESTONES.senseStamina)).toBe(true); // never strand a HUD gate
    expect(getStoryForcedDayPhase()).toBeNull(); // the sun belongs to the player now
    wreckRelayHandle.position = null;
  });

  it('the mandatory bridge acknowledge never stamps the no-record echo into a played run', () => {
    // A played prologue: one real choice on file, plus the bridge card's
    // forced [ACKNOWLEDGE] (which maps to the echo-neutral fallback line).
    recordStoryChoice('dispenser', 'hold');
    recordStoryChoice('anomaly', 'ack');
    advanceToBeat('ch1-fixed');
    const order = getStoryText().workorder.join('\n');
    expect(order).toContain('THE SCHEDULE WAS KEPT');
    expect(order).not.toContain('TRANSIT RECORD INCOMPLETE');
  });

  it('a genuinely choice-less record (skipped prologue) still assumes compliance', () => {
    advanceToBeat('ch1-fixed');
    expect(getStoryText().workorder.join('\n')).toContain('TRANSIT RECORD INCOMPLETE');
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
    tickSeconds(4.2); // flashes defer past the beat's opening (hand-offs land clean)
    addItem('biofiber', 3); // afterQuotaCount: 3 flash trigger
    storyDirectorTick(1 / 60, null);
    expect(getFeedRuntime().desat).toBe(0);
    expect(getVoxelRealityEffects().chroma).toBe(1);
    storyDirectorTick(1 / 60, null);
    expect(getFeedRuntime().desat).toBe(1);
    expect(getVoxelRealityEffects().chroma).toBe(0);
  });

  it('ch3-gather campfire teaching chain fires on the clock with no crafting', () => {
    resetCampfires();
    drainInventory('biofiber');
    drainInventory('stone');
    advanceToBeat('ch3-gather'); // no fire built → the chain plays out
    // fire-thought lands ~4s after the gather caption settles…
    tickSeconds(22.5);
    expect(getStoryText().caption?.text).toBe(CH3_CAPTIONS.fireThought);
    // …then the gather prompt 4s later.
    tickSeconds(4);
    expect(getStoryText().caption?.text).toBe(CH3_CAPTIONS.gatherPrompt);
    expect(getStoryStateSnapshot().beat).toBe('ch3-gather'); // still open, no fire
  });

  it('the vigil stargaze resolves the sky (null camera → fallback) and still reaches rest', () => {
    resetCampfires();
    placeCampfire(new THREE.Vector3(0, 25, 0), new THREE.Vector3(0, 1, 0));
    markMilestone(STORY_MILESTONES.a2);
    markMilestone(STORY_MILESTONES.a3);
    markMilestone(STORY_MILESTONES.ch3Signal);
    setVoxelRealityStage('material');
    advanceToBeat('ch4-vigil');
    // Night falls; with a null camera the look-up gate falls back to its timer,
    // so the eight-line sequence + the 18s reveal ramp play out unattended.
    tickSeconds(VIGIL.duskLerpSeconds + 80); // ~110s: sky resolved, rest prompt out
    expect(hasMilestone('story:ch4:constellations')).toBe(true);
    expect(getConstellationReveal()).toBeGreaterThan(0.99); // ramp reached full
    expect(vigilRestReady()).toBe(true); // the ordered rest is finally offered
    // The ordered rest still advances the beat into the arrival.
    setVitals({ stamina: 30, warmth: 30 });
    beginVigilSleep();
    expect(getStoryStateSnapshot().beat).toBe('ch4-arrival');
  });
});
