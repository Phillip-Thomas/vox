import { getGuidedStoryObjectiveHealth } from './ux/objectiveDirector.ts';
import { presentRegulationObjective } from './feed/regulationVoice.ts';
import { getRegulationEchoLines } from './storyDirector.ts';
import { afterEach, describe, expect, it, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  beginA1,
  beginA2,
  beginA3,
  beginVigilSleep,
  CH1_COLLECTION_TIMING,
  getStoryBeatClock,
  storyFreeMarkerTarget,
  storyDirectorTick,
  vigilRestReady
} from './storyDirector.ts';
import { getConstellationReveal } from './skyMeaning.ts';
import { getStoryInputPolicy } from './storyInputPolicy.ts';
import { placeCampfire, resetCampfires } from '../game/systems/campfires.ts';
import { consumeMawCharge, getMawCharge, MAX_MAW_CHARGE } from '../game/systems/mawSystem.ts';
import { setMiningProgress } from '../game/systems/miningProgress.ts';
import { drink, feed, getVitals, setVitals } from '../game/systems/survivalVitals.ts';
import { getPlayerWorldPosition, setPlayerWorldPosition } from '../state/playerFrame.ts';
import { wreckRelayHandle } from './world/WreckRelay.tsx';
import { getStoryForcedDayPhase } from './storyDayPhase.ts';
import {
  getCinematicCameraPose,
  getCinematicLookTarget,
  getCinematicLookWeight
} from './cinematicLook.ts';
import { collectDebris, seedDebrisCollected, setDebrisScattered } from './debrisSalvage.ts';
import { seedSupplyPodsCollected } from './supplyPods.ts';
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
import { cameraFeedVisualState, getFeedRuntime } from './feedRuntime.ts';
import { getStoryText } from './storyText.ts';
import { markSpawnSettled, resetSpawnSettle } from '../game/spawnSettle.ts';
import { getActiveGuidedStoryObjective } from './ux/objectiveDirector.ts';
import { subscribeStoryUxFeedback } from './ux/feedbackCues.ts';
import { createSystemCompanionBodyTargetHandle } from '../state/systemCompanionBodyTargets.ts';
import { TIDEGARDEN_WORLD_ID } from './tidegardenRoute.ts';
import { ANOMALY_SURVEY, CH1_FIXED_TUTORIAL, CH1_QUOTA, A1_RAMP_SECONDS } from './storyScript.ts';
import { registerStoryMarkerWorld } from './beats/markerTargets.ts';
import { storyWorldHandles } from './storyWorldHandles.ts';
import { CH1_2D_TRAVEL_BAND, storyFreeMarkerTargetFor } from './storyDirector.ts';
import { resetStoryClock, setStoryPaused } from './storyClock.ts';
import { getLensRig, setSideLens, clearSideLens, setSideCoverageViewport, sampleFixedScreenCoverage, getFixedScreenCoverage, applyActiveRigTransform, noteFixedScreenCoveragePresented } from './sideLens.ts';
import { getAuditWorkerPath, storyAnchors, STORY_SEED } from './world/storyWorld.ts';
import { getStoryBundleTrace } from './storyScore.ts';

const STORY_PLANET_SIZE = 50;

function drainInventory(id: 'biofiber' | 'stone') {
  const n = getItemCount(id);
  if (n > 0) removeItem(id, n);
}

function tickSeconds(seconds: number, step = 1 / 60) {
  for (let t = 0; t < seconds; t += step) storyDirectorTick(step, null);
}

function tickCameraSeconds(seconds: number, camera: THREE.PerspectiveCamera, step = 1 / 60) {
  for (let t = 0; t < seconds; t += step) storyDirectorTick(step, camera);
}

describe('storyDirector — chapter 1 and A1', () => {
  afterEach(() => registerStoryMarkerWorld(null));
  beforeEach(() => {
    // Director tests provide their mounted world explicitly. Production waits
    // for real targets; scene-less tests must not exercise a hidden exemption.
    const fixture = { position: new THREE.Vector3(4, 52, 8) };
    registerStoryMarkerWorld({
      target: name => storyWorldHandles.target(name) ?? fixture,
      gather: resource => storyWorldHandles.gather(resource) ?? fixture,
      audit: beat => storyWorldHandles.audit(beat) ?? fixture,
      settlement: id => storyWorldHandles.settlement(id) ?? fixture,
      commonGround: objectiveId => storyWorldHandles.commonGround(objectiveId) ?? fixture
    });
    deactivateStory();
    resetProgression();
    resetStoryClock();
    resetVoxelRealityRenderState();
    drainInventory('biofiber');
    drainInventory('stone');
    storyAnchors.planetSize = STORY_PLANET_SIZE;
    storyAnchors.terrainSeed = STORY_SEED;
    storyAnchors.auditPath = getAuditWorkerPath(STORY_PLANET_SIZE, STORY_SEED);
    // Enter ch1 the way the prologue handoff does.
    markMilestone(STORY_MILESTONES.prologueSeen);
    beginStory();
    setVoxelRealityStage('bare');
    advanceToBeat('ch1-raster');
  });

  it('the raster beat sets the survival work order (no auto-advance timer)', () => {
    expect(renderedWorkOrder().length).toBeGreaterThan(0);
    tickSeconds(20);
    expect(getStoryStateSnapshot().beat).toBe('ch1-raster'); // quota-gated only
  });

  it('keeps 2D recovery row-locked, then opens both ground axes at NAV VIEW', () => {
    advanceToBeat('ch1-depth');
    expect(getLensRig().depthBand).toBe(0);
    advanceToBeat('ch1-nav');
    expect(getLensRig().depthBand).toBe(Infinity);
    advanceToBeat('ch1-iso');
    expect(getLensRig().depthBand).toBe(Infinity);
  });

  it('walls the pure-2D eras against the cube edge but frees the top-down eras', () => {
    // The three side-scroller beats get a finite travel band (worker cannot walk
    // off the face / switch faces); every other rig stays free (Infinity).
    advanceToBeat('ch1-fixed');
    expect(getLensRig().travelBand).toBe(CH1_2D_TRAVEL_BAND.gather);
    advanceToBeat('ch1-raster');
    expect(getLensRig().travelBand).toBe(CH1_2D_TRAVEL_BAND.gather);
    advanceToBeat('ch1-depth');
    expect(getLensRig().travelBand).toBe(CH1_2D_TRAVEL_BAND.recovery);
    expect(Number.isFinite(getLensRig().travelBand)).toBe(true);
    // Nav/iso reveal the map — face traversal is legitimate, so travel is free.
    advanceToBeat('ch1-nav');
    expect(getLensRig().travelBand).toBe(Infinity);
    advanceToBeat('ch1-iso');
    expect(getLensRig().travelBand).toBe(Infinity);
  });

  it('meeting the on-row quota + salvage opens pod recovery and records the milestone', () => {
    setDebrisScattered(3); // minimum voyage outcome must still carry the quota
    seedDebrisCollected(); // hull debris + on-row impact stone recovered
    tickSeconds(8); // the recovery act has had time to establish itself
    expect(getItemCount('stone')).toBeGreaterThanOrEqual(CH1_QUOTA.stone);
    addItem('biofiber', CH1_QUOTA.biofiber);
    expect(getStoryStateSnapshot().beat).toBe('ch1-raster');
    tickSeconds(CH1_COLLECTION_TIMING.completionHoldSeconds - 0.1);
    expect(getStoryStateSnapshot().beat).toBe('ch1-raster'); // final pickup feedback remains readable
    tickSeconds(0.2);
    expect(getStoryStateSnapshot().beat).toBe('ch1-depth');
    expect(hasMilestone(STORY_MILESTONES.ch1Quota)).toBe(true);
  });

  it('backfills on-row impact stone once for legacy mid-raster saves', () => {
    deactivateStory();
    resetProgression();
    drainInventory('stone');
    // Legacy builds recorded these collection milestones without stone loot.
    markMilestone('story:debris-scattered:3');
    markMilestone('story:debris:0');
    markMilestone('story:debris:1');
    expect(getItemCount('stone')).toBe(0);

    beginStory();
    advanceToBeat('ch1-raster');
    expect(getItemCount('stone')).toBe(3);

    // The migration is idempotent even if the beat is re-entered.
    removeItem('stone', 3);
    advanceToBeat('crawl');
    advanceToBeat('ch1-raster');
    expect(getItemCount('stone')).toBe(0);
  });

  it('the 2D→3D lift hands the picture from the site camera to embodied first person', () => {
    advanceToBeat('ch1-lift');
    expect(getFeedRuntime().externalCameraMix).toBe(1);
    // Letterbox up mid-way, feet held…
    tickSeconds(2);
    expect(getFeedRuntime().cinematic).toBeGreaterThan(0.5);
    expect(getStoryInputPolicy().moveSpeedScale).toBe(0);
    expect(getStoryInputPolicy().sideBlend).toBeGreaterThan(0);
    expect(getFeedRuntime().externalCameraMix).toBeGreaterThan(0);
    expect(getFeedRuntime().externalCameraMix).toBeLessThan(1);
    // …then it hands over to the embodied pan-tilt survey. The Regulation
    // HUD can remain, but every CCTV-only visual and the raster DPR are gone.
    tickSeconds(5.5);
    expect(getStoryStateSnapshot().beat).toBe('ch1-anomaly');
    expect(getFeedRuntime().externalCameraMix).toBe(0);
    expect(cameraFeedVisualState().treatment).toBe(0);
    expect(cameraFeedVisualState().desat).toBe(0);
    expect(cameraFeedVisualState().glitch).toBe(0);
    expect(getStoryInputPolicy().targetDpr).toBeNull();
  });

  it('deep-link and same-page replay cannot leak CCTV treatment into first person', () => {
    advanceToBeat('ch1-anomaly');
    expect(getFeedRuntime().externalCameraMix).toBe(0);
    expect(cameraFeedVisualState().treatment).toBe(0);

    restartStory();
    expect(getStoryStateSnapshot().beat).toBe('crawl');
    advanceToBeat('ch1-lift');
    expect(getFeedRuntime().externalCameraMix).toBe(1);
    tickSeconds(7.5);
    expect(getStoryStateSnapshot().beat).toBe('ch1-anomaly');
    expect(getFeedRuntime().externalCameraMix).toBe(0);
    expect(cameraFeedVisualState().treatment).toBe(0);
  });

  it('resuming into raster with a completed quota still presents the collection act', () => {
    // Collect while the watcher is not looking (simulates a reload-with-items).
    advanceToBeat('crawl');
    seedDebrisCollected();
    addItem('biofiber', CH1_QUOTA.biofiber);
    addItem('stone', CH1_QUOTA.stone);
    advanceToBeat('ch1-raster');
    expect(getStoryStateSnapshot().beat).toBe('ch1-raster');
    tickSeconds(CH1_COLLECTION_TIMING.rasterMinimumSeconds - 0.1);
    expect(getStoryStateSnapshot().beat).toBe('ch1-raster');
    tickSeconds(0.2);
    expect(getStoryStateSnapshot().beat).toBe('ch1-depth');
    expect(hasMilestone(STORY_MILESTONES.ch1Quota)).toBe(true);
  });

  it('resuming with recovered pods still holds the widened-profile act before top-down', () => {
    advanceToBeat('crawl');
    seedSupplyPodsCollected();
    advanceToBeat('ch1-depth');

    tickSeconds(CH1_COLLECTION_TIMING.depthMinimumSeconds - 0.1);
    expect(getStoryStateSnapshot().beat).toBe('ch1-depth');
    tickSeconds(0.2);
    expect(getStoryStateSnapshot().beat).toBe('ch1-nav');
    expect(hasMilestone(STORY_MILESTONES.ch1Depth)).toBe(true);
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

  it('publishes immediate shared objectives from first-person handoff through the survival arc', () => {
    advanceToBeat('ch1-anomaly');
    expect(getActiveGuidedStoryObjective()).toMatchObject({
      id: 'ch1:anomaly:calibrate-pan-tilt',
      requiresMarker: false
    });

    tickSeconds(ANOMALY_SURVEY.fallbackSeconds + 0.1);
    expect(getActiveGuidedStoryObjective()).toMatchObject({
      id: 'ch1:anomaly:classify-mass',
      markerLabel: 'UNCHARTED MASS',
      requiresMarker: true
    });

    advanceToBeat('ch2-approach');
    expect(getActiveGuidedStoryObjective()).toMatchObject({
      id: 'ch2:approach:eat-fruit',
      markerLabel: 'REDACTED SUBJECT · FRUIT'
    });

    advanceToBeat('ch3-gather');
    expect(getActiveGuidedStoryObjective()?.id).toMatch(/^ch3:gather:/);
    advanceToBeat('ch3-thirst');
    expect(getActiveGuidedStoryObjective()).toMatchObject({
      id: 'ch3:thirst:drink-water',
      markerLabel: 'DRINKABLE WATER'
    });

    advanceToBeat('ch3-dusk');
    expect(getActiveGuidedStoryObjective()).toBeNull();
  });

  it('does not republish a stale objective when a tick advances the beat', () => {
    seedDebrisCollected();
    addItem('biofiber', CH1_QUOTA.biofiber);
    addItem('stone', CH1_QUOTA.stone);
    storyDirectorTick(CH1_COLLECTION_TIMING.rasterMinimumSeconds, null);
    // Signed quota edge clears before the unchanged hold; no seventh objective.
    const previousId = 'ch1:raster:extract-fiber-quota';
    expect(getActiveGuidedStoryObjective()).toBeNull();
    expect(getStoryText().workorder).toEqual([]);
    const entered: string[] = [];
    const unsubscribe = subscribeStoryUxFeedback(cue => entered.push(cue.objectiveId));

    // The completed-ledger hold advances synchronously inside this tick.
    storyDirectorTick(CH1_COLLECTION_TIMING.completionHoldSeconds + 0.1, null);
    unsubscribe();

    expect(getStoryStateSnapshot().beat).toBe('ch1-depth');
    expect(getActiveGuidedStoryObjective()?.id).toBe('ch1:depth:recover-supply-pods');
    expect(entered).not.toContain(previousId);
  });

  it('projects Chapter 8 pre-lock guidance from the mounted Tidegarden body', () => {
    const targetHandle = createSystemCompanionBodyTargetHandle(TIDEGARDEN_WORLD_ID);
    targetHandle.publish({ x: 140, y: -24, z: 680 });
    try {
      advanceToBeat('ch8-crossing');
      const target = storyFreeMarkerTarget();
      expect(target?.position.toArray()).toEqual([140, -24, 680]);
      expect(target?.label).toBe(getActiveGuidedStoryObjective()?.markerLabel);
      expect(target?.projectionSpace).toBe('spatial');
    } finally {
      targetHandle.remove();
    }
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
    expect(getStoryText().caption?.text).toBe(CH3_CAPTIONS.fireBuilt);
    // the dusk CUTSCENE: bars + camera pull + held feet, then control returns
    tickSeconds(2);
    expect(getStoryText().caption?.text).toBe(CH3_CAPTIONS.fireBuilt);
    expect(getFeedRuntime().cinematic).toBeGreaterThan(0.5);
    expect(getCinematicLookWeight()).toBeGreaterThan(0.5);
    expect(getStoryInputPolicy().moveSpeedScale).toBe(0);
    // The made warmth owns the opening image before the gaze travels skyward.
    expect(getCinematicCameraPose().weight).toBeGreaterThan(0.99);
    expect(getCinematicCameraPose().target.distanceTo(new THREE.Vector3(0, 25.65, 0))).toBeLessThan(0.01);
    expect(getCinematicLookTarget()).not.toBeNull();
    tickSeconds(4); // t = 6 — authored fire boom released, gaze now on live sun
    expect(getStoryText().caption?.text).toBe(CH3_CAPTIONS.duskStart);
    expect(getCinematicCameraPose().weight).toBe(0);
    expect(getCinematicLookTarget()).toBeNull();
    expect(getCinematicLookWeight()).toBeGreaterThan(0.5);
    tickSeconds(4); // t = 10 — cutscene over, sun still sliding
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
    const landing = [...getStoryBundleTrace()].reverse().find(row => row.anchorId === 'anc.a3.material-lands')!;
    expect(landing.schedulingArmAt.beatClock).toBe(0);
    expect(landing.authoredCommitAt).toBeNull();
    expect(hasMilestone(STORY_MILESTONES.a3)).toBe(false);
    expect(getVoxelRealityStage()).not.toBe('material');
    const storedLanding = landing.bundleAt;
    setStoryPaused(true);
    storyDirectorTick(20, null);
    expect(landing.bundleAt).toBe(storedLanding);
    expect(landing.authoredCommitAt).toBeNull();
    expect(getStoryStateSnapshot().beat).toBe('a3-dawn');
    setStoryPaused(false);
    tickSeconds(25); // fade up + material ramp + captions + handoff
    // The story no longer ends at the dawn: the first day alive begins, uncut.
    expect(getStoryStateSnapshot().active).toBe(true);
    expect(getStoryStateSnapshot().beat).toBe('ch3-thirst');
    expect(getVoxelRealityStage()).toBe('material');
    expect(hasMilestone(STORY_MILESTONES.a3)).toBe(true);
    expect(landing.bundleAt).toBe(storedLanding);
    expect(landing.authoredCommitAt!.beatClock).toBeGreaterThanOrEqual(storedLanding);
    expect(landing.authoredCommits[0].members).toEqual(expect.arrayContaining(['setVoxelRealityStage(material)', 'clearVoxelRealityOverrides', 'clearLifeReveal', 'markMilestone(a3)', 'advanceToBeat(ch3-thirst)']));
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

  it('the first day alive: thirst → forage → klaxon → vigil → arrival → audit', () => {
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
    // Arrival banks a checkpoint and hands directly into the playable audit.
    // The auditor is not hidden — he stays standing at the relay to begin it.
    tickSeconds(ARRIVAL.endAt + 1);
    expect(getStoryStateSnapshot().active).toBe(true);
    expect(getStoryStateSnapshot().chapter).toBe('ch4');
    expect(getStoryStateSnapshot().beat).toBe('ch4-audit');
    expect(getAuditWorkerPose().visible).toBe(true); // "he stays to look"
    expect(hasMilestone(STORY_MILESTONES.ch4Arrived)).toBe(true);
    expect(hasMilestone(STORY_MILESTONES.complete)).toBe(false);
    // Stamina remains earned by actually spending it; arrival no longer uses a
    // terminal backfill to manufacture an unproven sense receipt.
    expect(hasMilestone(STORY_MILESTONES.senseStamina)).toBe(false);
    expect(getStoryForcedDayPhase()).toBeNull(); // live dawn continues through the audit
    wreckRelayHandle.position = null;
  });

  it('the mandatory bridge acknowledge never stamps the no-record echo into a played run', () => {
    // A played prologue: one real choice on file, plus the bridge card's
    // forced [ACKNOWLEDGE] (which maps to the echo-neutral fallback line).
    recordStoryChoice('dispenser', 'hold');
    recordStoryChoice('anomaly', 'ack');
    advanceToBeat('ch1-fixed');
    const record = getRegulationEchoLines().join('\n');
    expect(record).toContain('THE SCHEDULE WAS KEPT');
    expect(record).not.toContain('TRANSIT RECORD INCOMPLETE');
    expect(renderedWorkOrder()).toEqual(['WALK OVER THE DEBRIS TO RECOVER IT.']);
  });

  it('arrival breathes, restores the physical lens, and hands directly into audit', () => {
    advanceToBeat('ch4-arrival');
    const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.05, 500);

    tickCameraSeconds(ARRIVAL.auditAt + 0.1, camera);
    expect(getStoryStateSnapshot().active).toBe(true);
    // The line's full TTL is inside the active arrival. Half of the following
    // silent breath is active too.
    tickCameraSeconds(ARRIVAL.auditLineSeconds - 0.2, camera);
    expect(getStoryStateSnapshot().beat).toBe('ch4-arrival');
    tickCameraSeconds(ARRIVAL.visualBreathSeconds / 2, camera);
    expect(getStoryStateSnapshot().beat).toBe('ch4-arrival');

    tickCameraSeconds(ARRIVAL.visualBreathSeconds, camera);
    expect(getStoryStateSnapshot()).toMatchObject({ active: true, chapter: 'ch4', beat: 'ch4-audit' });
    expect(getStoryText().audit?.text).toBe('AUDIT IN PROGRESS. THREE DEVIATIONS REQUIRE WITNESS.');
    expect(camera.fov).toBe(75);
    expect(getCinematicCameraPose().weight).toBe(0);
    expect(getCinematicLookWeight()).toBe(0);
  });

  it('holds before first contact when no safe auditor route exists', () => {
    storyAnchors.planetSize = null;
    storyAnchors.terrainSeed = null;
    storyAnchors.auditPath = null;
    advanceToBeat('ch4-arrival');

    tickSeconds(ARRIVAL.endAt + 5);
    expect(getStoryStateSnapshot()).toMatchObject({
      active: true,
      beat: 'ch4-arrival'
    });
    expect(getAuditWorkerPose().visible).toBe(false);
    expect(getStoryBeatClock()).toBeLessThan(ARRIVAL.someoneAt);
    expect(getStoryInputPolicy().moveSpeedScale).toBe(1);
  });

  it('the descent white-out gives up waiting for the world and plays anyway', () => {
    // Without a bound, a collider stream that never completes leaves the very
    // first screen of the story a featureless white frame, forever.
    resetSpawnSettle();
    advanceToBeat('descent');
    tickSeconds(4);
    expect(getFeedRuntime().descent).toBe(0); // still braced, world not ready
    expect(getFeedRuntime().flash).toBe(1);
    tickSeconds(10); // past the grace
    expect(getFeedRuntime().descent).toBeGreaterThan(0); // the crash plays
    markSpawnSettled(); // leave the module singleton as the other tests expect
  });

  it.each(['ch1-fixed', 'ch2-color'] as const)('expires descent-only white-out on direct entry to %s', beat => {
    resetSpawnSettle();
    advanceToBeat('descent');
    tickSeconds(1);
    expect(getFeedRuntime().flash).toBe(1);
    advanceToBeat(beat);
    expect(getFeedRuntime().flash).toBe(0);
    // Entry order may leave a final stale producer write after the subscriber
    // ran. The next playable tick must enforce the flash's owning beat too.
    getFeedRuntime().flash = 1;
    storyDirectorTick(1 / 60, null);
    expect(getFeedRuntime().flash).toBe(0);
    markSpawnSettled();
  });

  it('preserves the natural crash impact and its decay while descent owns the frame', () => {
    markSpawnSettled();
    advanceToBeat('descent');
    let impact = false;
    for (let i = 0; i < 900 && getStoryStateSnapshot().beat === 'descent'; i++) {
      storyDirectorTick(1 / 60, null);
      if (getFeedRuntime().flash > 0.8) impact = true;
    }
    expect(impact).toBe(true);
    expect(getStoryStateSnapshot().beat).toBe('ch1-fixed');
    expect(getFeedRuntime().flash).toBe(0);
  });

  it('ch1-raster names the fiber gate once the debris is clear', () => {
    // The reproduced stall: the first three debris pieces carry the ENTIRE
    // stone quota, so a player who follows the debris brackets finishes stone
    // and debris together and is left with only fiber. The beat used to keep
    // telling them to recover hull debris they had already recovered, with no
    // marker and — worse — with every bracket switched off.
    advanceToBeat('ch1-raster');
    expect(getActiveGuidedStoryObjective()?.id).toBe('ch1:raster:recover-quota');

    setDebrisScattered(3);
    seedDebrisCollected();
    tickSeconds(0.1);
    expect(getItemCount('stone')).toBeGreaterThanOrEqual(CH1_QUOTA.stone);
    expect(getItemCount('biofiber')).toBeLessThan(CH1_QUOTA.biofiber);

    // The rung, and the feed, now name what is actually outstanding — including
    // the movement the quota cannot be met without.
    expect(getActiveGuidedStoryObjective()?.id).toBe('ch1:raster:extract-fiber-quota');
    const order = renderedWorkOrder().join('\n');
    expect(order).toBe('HOLD [E] TO HARVEST BIOFIBER.');
    expect(getStoryStateSnapshot().beat).toBe('ch1-raster');
  });

  it('ch1-fixed switches rung the moment the fiber quota is met', () => {
    // The beat advances on a CONJUNCTION (fiber quota AND screen crossings).
    // Filling only the first half used to leave the player reading a completed
    // instruction against a `SCREENS 1/2` ledger, with no marker and no
    // fallback — a permanent stall on the first playable beat of the game.
    advanceToBeat('ch1-fixed');
    expect(getActiveGuidedStoryObjective()?.id).toBe('ch1:fixed:recover-first-debris');
    expect(renderedWorkOrder()).toEqual(['WALK OVER THE DEBRIS TO RECOVER IT.']);
    collectDebris(0);
    expect(getActiveGuidedStoryObjective()?.id).toBe('ch1:fixed:calibrate-extractor');
    expect(renderedWorkOrder().join('\n')).toContain('HARVEST BIOFIBER');

    addItem('biofiber', CH1_FIXED_TUTORIAL.biofiber);
    tickSeconds(0.1);

    // The remaining condition is now the only one, and it is stated outright.
    expect(getActiveGuidedStoryObjective()?.id).toBe('ch1:fixed:cross-camera-cell');
    const order = renderedWorkOrder().join('\n');
    expect(order).toBe('WALK [A]/[D] TO THE NEXT CAMERA.');
    // Echo lineage stays available without bloating the signed imperative.
    expect(getRegulationEchoLines().join('\n')).toContain('TRANSIT RECORD INCOMPLETE');
    // Still on the beat — the rung changed, progression did not.
    expect(getStoryStateSnapshot().beat).toBe('ch1-fixed');
  });

  it('requires a post-arm movement crossing and a destination paint before the exact track channels', () => {
    const lens = { origin: new THREE.Vector3(), travelAxis: new THREE.Vector3(1, 0, 0), depthAxis: new THREE.Vector3(0, 0, 1), up: new THREE.Vector3(0, 1, 0) };
    const viewport = (width: number) => ({ width, height: 844, fov: 75, aspect: width / 844, touch: true, safe: { left: 0, right: 0, top: 0, bottom: 0 }, reservations: [] });
    const oldPosition = getPlayerWorldPosition();
    setSideLens(lens); advanceToBeat('ch1-fixed'); setSideCoverageViewport(viewport(390));
    let frame = 0;
    const sample = (x: number) => { setPlayerWorldPosition(new THREE.Vector3(x, 0, 0)); sampleFixedScreenCoverage(getPlayerWorldPosition(), ++frame); storyDirectorTick(1 / 60, null); };
    sample(0); sample(0); sample(5); // A camera change before pickup/harvest cannot complete traversal.
    expect(getStoryStateSnapshot().beat).toBe('ch1-fixed');
    collectDebris(0); addItem('biofiber', 1); sample(5);
    expect(getActiveGuidedStoryObjective()?.id).toBe('ch1:fixed:cross-camera-cell');
    setSideCoverageViewport(viewport(400)); sample(5); sample(5);
    expect(getStoryStateSnapshot().beat).toBe('ch1-fixed');
    const boundary = getFixedScreenCoverage()!.intervalMax;
    sample(boundary + 0.1);
    expect(getStoryStateSnapshot().beat).toBe('ch1-fixed'); // Destination has not been painted.
    const camera = new THREE.PerspectiveCamera(75, 400 / 844); const parent = new THREE.Group(); parent.position.copy(getPlayerWorldPosition()); parent.add(camera); parent.updateMatrixWorld(true);
    applyActiveRigTransform(camera, lens, 1 / 60); noteFixedScreenCoveragePresented(); sample(boundary + 0.1);
    expect(getStoryStateSnapshot().beat).toBe('ch1-track');
    tickSeconds(0.1);
    expect(getStoryText().system).toMatchObject({ text: 'CAMERA HAND-OFF: SUSPENDED. ONE VIEW STAYS WITH YOU.', ttlMs: 2800 });
    tickSeconds(3.3);
    expect(getStoryText().caption).toMatchObject({ text: '(simpler to keep watching this one.)', ttlMs: 3200 });
    expect(getStoryText().system).toBeNull();
    tickSeconds(4);
    expect(getStoryStateSnapshot().beat).toBe('ch1-raster');
    expect(getStoryText().caption).toBeNull();
    clearSideLens(); setPlayerWorldPosition(oldPosition);
  });

  it('a genuinely choice-less record (skipped prologue) still assumes compliance', () => {
    advanceToBeat('ch1-fixed');
    expect(getRegulationEchoLines().join('\n')).toContain('TRANSIT RECORD INCOMPLETE');
    expect(renderedWorkOrder()).toEqual(['WALK OVER THE DEBRIS TO RECOVER IT.']);
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

describe('foundational marker publication gate', () => {
  afterEach(() => registerStoryMarkerWorld(null));

  it('withholds a marker-requiring rung until its target exists', () => {
    // The measured defect: ch1-depth entered at `missing-marker` health, naming
    // a SUPPLY POD marker that had not resolved yet. An absent objective is
    // honestly `idle`; a findable-looking rung pointing at nothing is a lie.
    let targetExists = false;
    registerStoryMarkerWorld({ ...storyWorldHandles, target: () => targetExists ? { position: new THREE.Vector3() } : null });
    advanceToBeat('ch1-depth');
    tickSeconds(0.1);
    expect(getActiveGuidedStoryObjective()).toBeNull();

    targetExists = true;
    tickSeconds(0.1);
    expect(getActiveGuidedStoryObjective()?.id).toBe('ch1:depth:recover-supply-pods');
    expect(getGuidedStoryObjectiveHealth()).toBe('ready');
  });

  it('never withholds a rung that declares no marker', () => {
    // ch1-fixed is markerless by design. Gating it on a marker would strand the
    // first playable beat of the game behind a target that never arrives.
    registerStoryMarkerWorld({ ...storyWorldHandles, target: () => null });
    advanceToBeat('ch1-fixed');
    tickSeconds(0.1);
    expect(getActiveGuidedStoryObjective()?.id).toBe('ch1:fixed:recover-first-debris');
  });

  it('withholds a mandatory marker until the real world is available on boot', () => {
    registerStoryMarkerWorld(null);
    advanceToBeat('ch1-depth');
    tickSeconds(0.1);
    expect(getActiveGuidedStoryObjective()).toBeNull();
    expect(getGuidedStoryObjectiveHealth()).toBe('idle');
  });
});

describe('foundational marker publication gate — every chapter', () => {
  afterEach(() => registerStoryMarkerWorld(null));

  it('withholds a post-feed rung until its candidate has a target', () => {
    // Previously only four ch1 beats could be gated, because the post-feed
    // resolver read the PUBLISHED objective. It now takes the candidate, so
    // ch3-thirst (whose marker is the pond anchor) is held until the pond
    // exists rather than telling the player to follow a marker that is not there.
    let pondKnown = false;
    registerStoryMarkerWorld({ ...storyWorldHandles, target: name => {
      expect(name).toBe('pond-surface');
      return pondKnown ? { position: new THREE.Vector3() } : null;
    } });
    advanceToBeat('ch3-thirst');
    tickSeconds(0.1);
    expect(getActiveGuidedStoryObjective()).toBeNull();
    pondKnown = true;
    tickSeconds(0.1);
    expect(getActiveGuidedStoryObjective()?.id).toBe('ch3:thirst:drink-water');
  });

  it('resolves the free marker for a candidate without consulting the published objective', () => {
    // The seam itself: given a candidate for ch3-thirst and a pond anchor, the
    // resolver answers from the CANDIDATE, whatever is or is not published.
    const candidate = {
      id: 'ch3:thirst:drink-water', kind: 'interact' as const,
      markerLabel: 'DRINKABLE WATER', workOrder: ['FOLLOW THE WATER MARKER.'], requiresMarker: true
    };
    storyAnchors.pond = {
      surface: new THREE.Vector3(1, 2, 3), shore: new THREE.Vector3(1, 1, 3)
    } as never;
    try {
      const target = storyFreeMarkerTargetFor('ch3-thirst', candidate);
      expect(target?.label).toBe('DRINKABLE WATER');
      expect(target?.position.toArray()).toEqual([1, 2, 3]);
      // A cleared objective owns no marker; there is no orphan fallback channel.
      expect(storyFreeMarkerTargetFor('ch3-thirst', null)).toBeNull();
    } finally {
      storyAnchors.pond = null;
    }
  });
});

function renderedWorkOrder(): readonly string[] {
  const objective = getActiveGuidedStoryObjective();
  return objective ? presentRegulationObjective(objective, getRegulationEchoLines()) : getStoryText().workorder;
}
