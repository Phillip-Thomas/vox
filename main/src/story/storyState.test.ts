import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  beginStory,
  canContinueStory,
  chapterForBeat,
  completeStory,
  debugBeatNeedsCampfire,
  getStoryStateSnapshot,
  hasCompletedStory,
  initStoryFromSave,
  restartStory,
  STORY_BEAT_ORDER,
  STORY_MILESTONES,
  storyEntryPoint,
  type StoryBeat
} from './storyState.ts';
import { getItemCount, addItem, resetInventory } from '../game/systems/inventorySystem.ts';
import {
  advanceEraTo,
  getCurrentEra,
  getMilestones,
  hasMilestone,
  markMilestone,
  resetProgression
} from '../game/systems/progressionSystem.ts';
import {
  getShipRestorationSnapshot,
  getShipRepairStage,
  resetShipRestoration,
  setShipRestorationLocation
} from '../game/systems/shipRestoration.ts';
import {
  commitHabitatCorePlacement,
  getHabitatWorldState,
  resetHabitats
} from '../game/systems/habitatSystem.ts';
import { getSpaceFlightSnapshot, resetTravel } from '../state/spaceFlight.ts';
import {
  getSystemFlightSnapshot,
  resetSystemFlightForInterstellarArrival,
  resetSystemFlightStoreForTests
} from '../state/systemFlight.ts';
import { seedDebrisCollected, collectedDebrisCount } from './debrisSalvage.ts';
import { seedSupplyPodsCollected, collectedPodCount } from './supplyPods.ts';
import {
  createTidegardenLandfallBootstrap,
  TIDEGARDEN_DEBUG_APPROACH_CLEARANCE
} from './tidegardenLandfallBootstrap.ts';
import {
  isTidegardenRouteOnline,
  resolveStoryBootWorldId,
  resolveStoryResumeWorldId,
  TIDEGARDEN_ROUTE_MILESTONE,
  TIDEGARDEN_WORLD_ID
} from './tidegardenRoute.ts';

describe('storyState — beat order (drives debug jumps + seeding)', () => {
  beforeEach(() => {
    resetProgression();
    resetInventory();
    resetShipRestoration();
    resetHabitats();
    resetSystemFlightStoreForTests();
    resetTravel();
  });

  it('reconstructs the carried campfire for every isolated beat that consumes it', () => {
    expect([
      'ch3-dusk',
      'ch3-await-rest',
      'a3-dawn',
      'ch4-vigil',
      'ch4-arrival',
      'ch4-audit',
      'ch4-comply'
    ].filter(beat => debugBeatNeedsCampfire(beat as StoryBeat))).toEqual([
      'ch3-dusk',
      'ch3-await-rest',
      'a3-dawn',
      'ch4-vigil',
      'ch4-arrival',
      'ch4-audit',
      'ch4-comply'
    ]);
    expect(debugBeatNeedsCampfire('ch4-defy')).toBe(false);
    expect(debugBeatNeedsCampfire('ch5-maw')).toBe(false);
    expect(debugBeatNeedsCampfire(null)).toBe(false);
  });
  afterEach(() => vi.unstubAllGlobals());
  it('orders beats monotonically through the chapters', () => {
    const chapterRank = {
      prologue: 0,
      ch1: 1,
      ch2: 2,
      ch3: 3,
      ch4: 4,
      ch5: 5,
      ch6: 6,
      ch7: 7,
      ch8: 8,
      ch9: 9,
      complete: 10,
      none: -1
    } as const;
    let last = -1;
    for (const beat of STORY_BEAT_ORDER) {
      const rank = chapterRank[chapterForBeat(beat)];
      expect(rank).toBeGreaterThanOrEqual(last);
      last = rank;
    }
    expect(last).toBe(10); // ends at 'done'
  });

  it('the monochrome ladder climbs the history of perspectives in order', () => {
    const at = (beat: StoryBeat) => STORY_BEAT_ORDER.indexOf(beat);
    const ladder: StoryBeat[] = [
      'descent', 'ch1-fixed', 'ch1-track', 'ch1-raster',
      'ch1-depth', 'ch1-nav', 'ch1-iso', 'ch1-lift', 'ch1-anomaly'
    ];
    for (let i = 1; i < ladder.length; i++) {
      expect(at(ladder[i - 1])).toBeGreaterThanOrEqual(0);
      expect(at(ladder[i - 1])).toBeLessThan(at(ladder[i]));
      expect(chapterForBeat(ladder[i])).toBe('ch1');
    }
  });

  it('every awakening has a before and an after jump target', () => {
    const at = (beat: StoryBeat) => STORY_BEAT_ORDER.indexOf(beat);
    // A1: before = ch1-anomaly, plays = a1-ramp, after = ch2-color
    expect(at('ch1-anomaly')).toBeLessThan(at('a1-ramp'));
    expect(at('a1-ramp')).toBeLessThan(at('ch2-color'));
    // A2: before = ch2-approach, plays = a2-awakening, after = ch3-gather
    expect(at('ch2-approach')).toBeLessThan(at('a2-awakening'));
    expect(at('a2-awakening')).toBeLessThan(at('ch3-gather'));
    // A3: before = ch3-await-rest, plays = a3-dawn, after = embodied survival
    expect(at('ch3-await-rest')).toBeLessThan(at('a3-dawn'));
    expect(at('a3-dawn')).toBeLessThan(at('ch3-thirst'));
    // A4: refusal causes Breath; the repaired-tool chapters follow it.
    expect(at('ch4-defy')).toBeLessThan(at('a4-exhale'));
    expect(at('a4-exhale')).toBeLessThan(at('ch5-maw'));
  });

  it('restarts a completed Story cleanly while preserving non-Story milestones', () => {
    markMilestone('sandbox:kept');
    markMilestone('maw_repaired');
    advanceEraTo('emergent');
    completeStory();
    addItem('wood', 9);
    const previousRun = getStoryStateSnapshot().runId;
    expect(hasCompletedStory()).toBe(true);

    restartStory();

    expect(getStoryStateSnapshot()).toMatchObject({
      active: true,
      chapter: 'prologue',
      beat: 'crawl',
      runId: previousRun + 1
    });
    expect(hasCompletedStory()).toBe(false);
    expect(canContinueStory()).toBe(true);
    expect(getItemCount('wood')).toBe(0);
    expect(hasMilestone('sandbox:kept')).toBe(true);
    expect(hasMilestone('maw_repaired')).toBe(false);
    expect(getCurrentEra()).toBe('primitive');
    expect(getMilestones().filter(milestone => milestone.startsWith('story:'))).toEqual(['story:started']);
  });

  it('reconstructs a legal Chapter 5 exit for an isolated Chapter 6 rehearsal', () => {
    vi.stubGlobal('window', { location: { search: '?story=ch6-dive' } });

    initStoryFromSave();

    expect(getStoryStateSnapshot()).toMatchObject({ active: true, chapter: 'ch6', beat: 'ch6-dive' });
    expect(getItemCount('faulty_maw')).toBe(0);
    expect(getItemCount('maw_repair_kit')).toBe(0);
    expect(getItemCount('iron_maw')).toBe(1);
    expect(getCurrentEra()).toBe('emergent');
    expect(hasMilestone('maw_repaired')).toBe(true);
    expect(hasMilestone(STORY_MILESTONES.senseMaw)).toBe(true);
  });

  it('clears the completed Tidegarden habitat so replay cannot deadlock on stale world receipts', () => {
    expect(commitHabitatCorePlacement({
      actorId: 'local',
      worldId: TIDEGARDEN_WORLD_ID,
      shelterId: 'habitat:-1,-1:p1:4,25,-4',
      cell: [4, 25, -4],
      supportCell: [4, 24, -4],
      position: [4, 25.24, -4],
      up: [0, 1, 0],
      eventId: 'test:completed-tidegarden-core'
    })).toBe(true);
    completeStory();
    expect(getHabitatWorldState(TIDEGARDEN_WORLD_ID)).not.toBeNull();

    restartStory();

    expect(getHabitatWorldState(TIDEGARDEN_WORLD_ID)).toBeNull();
    expect(getMilestones().filter(milestone => milestone.startsWith('story:')))
      .toEqual([STORY_MILESTONES.started]);
  });

  it('makes an explicit crash replay pristine instead of inheriting later collection state', () => {
    markMilestone('sandbox:kept');
    markMilestone(STORY_MILESTONES.ch1Depth);
    seedDebrisCollected();
    seedSupplyPodsCollected();
    addItem('biofiber', 20);
    addItem('stone', 20);
    vi.stubGlobal('window', { location: { search: '?story=crash&movie=1' } });

    initStoryFromSave();

    expect(getStoryStateSnapshot()).toMatchObject({ active: true, chapter: 'prologue', beat: 'crash' });
    expect(collectedDebrisCount()).toBe(0);
    expect(collectedPodCount()).toBe(0);
    expect(getItemCount('biofiber')).toBe(0);
    expect(getItemCount('stone')).toBe(0);
    expect(hasMilestone(STORY_MILESTONES.ch1Depth)).toBe(false);
    expect(hasMilestone('sandbox:kept')).toBe(true);
  });

  it('starts a full movie rehearsal from a clean crawl instead of resuming', () => {
    completeStory();
    seedDebrisCollected();
    seedSupplyPodsCollected();
    addItem('stone', 20);
    vi.stubGlobal('window', { location: { search: '?story=1&movie=1' } });

    initStoryFromSave();

    expect(getStoryStateSnapshot()).toMatchObject({ active: true, chapter: 'prologue', beat: 'crawl' });
    expect(getMilestones().filter(milestone => milestone.startsWith('story:'))).toEqual(['story:started']);
    expect(collectedDebrisCount()).toBe(0);
    expect(collectedPodCount()).toBe(0);
    expect(getItemCount('stone')).toBe(0);
  });

  it('treats the old demo terminal plus arrival as an audit resume, not completion', () => {
    markMilestone(STORY_MILESTONES.started);
    markMilestone(STORY_MILESTONES.complete);
    markMilestone(STORY_MILESTONES.ch4Arrived);

    expect(storyEntryPoint()).toEqual({ chapter: 'ch4', beat: 'ch4-audit' });
    expect(hasCompletedStory()).toBe(false);
    expect(canContinueStory()).toBe(true);

    beginStory();
    expect(getStoryStateSnapshot()).toMatchObject({
      active: true,
      chapter: 'ch4',
      beat: 'ch4-audit'
    });
  });

  it('derives every post-arrival resume from the last committed gameplay receipt', () => {
    const cases: Array<[string, { chapter: string; beat: StoryBeat }]> = [
      [STORY_MILESTONES.ch4Audit, { chapter: 'ch4', beat: 'ch4-comply' }],
      [STORY_MILESTONES.ch4Complied, { chapter: 'ch4', beat: 'ch4-defy' }],
      [STORY_MILESTONES.ch4Defied, { chapter: 'ch4', beat: 'a4-exhale' }],
      [STORY_MILESTONES.a4, { chapter: 'ch4', beat: 'a4-exhale' }],
      [STORY_MILESTONES.a4Handback, { chapter: 'ch5', beat: 'ch5-maw' }],
      [STORY_MILESTONES.ch5Maw, { chapter: 'ch6', beat: 'ch6-dive' }],
      [STORY_MILESTONES.ch6Dive, { chapter: 'ch7', beat: 'ch7-reconstruct' }],
      [STORY_MILESTONES.ch7Reconstructed, { chapter: 'ch7', beat: 'ch7-board' }],
      [STORY_MILESTONES.ch7Boarded, { chapter: 'ch8', beat: 'ch8-launch' }],
      [STORY_MILESTONES.ch8Launched, { chapter: 'ch8', beat: 'ch8-crossing' }],
      [STORY_MILESTONES.ch8Crossed, { chapter: 'ch8', beat: 'ch8-landfall' }],
      [STORY_MILESTONES.ch8Landfall, { chapter: 'ch9', beat: 'ch9-settle' }],
      [STORY_MILESTONES.ch9Settled, { chapter: 'ch9', beat: 'ch9-hearth' }]
    ];

    for (const [milestone, entry] of cases) {
      resetProgression();
      markMilestone(STORY_MILESTONES.started);
      markMilestone(milestone);
      expect(storyEntryPoint(), milestone).toEqual(entry);
      expect(hasCompletedStory(), milestone).toBe(false);
    }

    markMilestone(STORY_MILESTONES.ch9Hearth);
    expect(storyEntryPoint()).toEqual({ chapter: 'complete', beat: 'done' });
    expect(hasCompletedStory()).toBe(true);
    expect(canContinueStory()).toBe(false);
  });

  it('reconstructs the Keel and flight-ready prerequisites for late debug rehearsals', () => {
    vi.stubGlobal('window', { location: { search: '?story=ch7-reconstruct' } });
    initStoryFromSave();

    expect(getStoryStateSnapshot()).toMatchObject({
      active: true,
      chapter: 'ch7',
      beat: 'ch7-reconstruct'
    });
    expect(hasMilestone('story:item:kestrel-keel-memory:banked')).toBe(true);
    expect(hasMilestone('story:capability:oxygen-online')).toBe(true);
    expect(hasMilestone(STORY_MILESTONES.senseOxygen)).toBe(true);
    expect(hasMilestone('story:dive:waterline-entered')).toBe(true);
    expect(hasMilestone('story:dive:keel-sonar-revealed')).toBe(true);
    expect(hasMilestone('story:dive:surfaced-with-keel')).toBe(true);
    expect(getItemCount('kestrel_keel_memory')).toBe(1);
    expect(getShipRepairStage()).toBe('wrecked');

    vi.stubGlobal('window', { location: { search: '?story=ch7-board' } });
    initStoryFromSave();
    expect(getStoryStateSnapshot()).toMatchObject({ chapter: 'ch7', beat: 'ch7-board' });
    expect(getShipRepairStage()).toBe('flight_ready');

    vi.stubGlobal('window', { location: { search: '?story=ch8-crossing' } });
    initStoryFromSave();
    expect(getSpaceFlightSnapshot()).toMatchObject({ phase: 'deep_space', controlMode: 'flight' });

    vi.stubGlobal('window', { location: { search: '?story=ch8-landfall' } });
    initStoryFromSave();
    expect(getSpaceFlightSnapshot()).toMatchObject({ phase: 'descent', controlMode: 'flight' });
  });

  it('places a landfall debug rehearsal on Tidegarden with matching system-flight active-body ownership', () => {
    // Reproduce the dangerous case: the previous runtime owns another system
    // and carries a pose that would be invalid if interpreted around Tidegarden.
    resetSystemFlightForInterstellarArrival({
      system: { x: 99, y: -37 },
      locationMode: 'local_space',
      activePlanetId: '99,-37',
      pose: { position: [0, 0, 0], velocity: [12, 0, -8], quaternion: [0, 0, 0, 1] }
    });
    vi.stubGlobal('window', { location: { search: '?story=ch8-landfall' } });

    initStoryFromSave();

    const expected = createTidegardenLandfallBootstrap();
    const system = getSystemFlightSnapshot();
    const distanceFromPlanet = Math.hypot(
      system.pose.position[0] - expected.world.systemPosition[0],
      system.pose.position[1] - expected.world.systemPosition[1],
      system.pose.position[2] - expected.world.systemPosition[2]
    );
    expect(getStoryStateSnapshot()).toMatchObject({ chapter: 'ch8', beat: 'ch8-landfall' });
    expect(getSpaceFlightSnapshot()).toMatchObject({ phase: 'descent', controlMode: 'flight' });
    expect(isTidegardenRouteOnline()).toBe(true);
    expect(resolveStoryBootWorldId(
      '99,-37',
      isTidegardenRouteOnline(),
      getStoryStateSnapshot()
    )).toBe(TIDEGARDEN_WORLD_ID);
    expect(resolveStoryResumeWorldId(TIDEGARDEN_WORLD_ID, isTidegardenRouteOnline()))
      .toBe(TIDEGARDEN_WORLD_ID);
    expect(system).toMatchObject({
      systemId: expected.world.systemId,
      activePlanetId: TIDEGARDEN_WORLD_ID,
      lastActivePlanetId: TIDEGARDEN_WORLD_ID,
      locationMode: 'atmosphere',
      renderOrigin: expected.world.systemPosition,
      target: null
    });
    expect(distanceFromPlanet).toBe(
      expected.world.surfaceBoundRadius + TIDEGARDEN_DEBUG_APPROACH_CLEARANCE
    );
    expect(distanceFromPlanet).toBeGreaterThan(expected.world.surfaceBoundRadius);
  });

  it.each(['ch9-settle', 'ch9-hearth'] as const)(
    'starts %s on foot with Tidegarden owning the mounted system body',
    beat => {
      resetSystemFlightForInterstellarArrival({
        system: { x: 99, y: -37 },
        locationMode: 'local_space',
        activePlanetId: '99,-37',
        pose: { position: [8, 9, 10], velocity: [1, 2, 3], quaternion: [0, 0, 0, 1] }
      });
      vi.stubGlobal('window', { location: { search: `?story=${beat}` } });

      initStoryFromSave();

      const expected = createTidegardenLandfallBootstrap();
      expect(getStoryStateSnapshot()).toMatchObject({ chapter: 'ch9', beat });
      expect(getSpaceFlightSnapshot()).toMatchObject({ phase: 'surface', controlMode: 'fps' });
      expect(getSystemFlightSnapshot()).toMatchObject({
        systemId: expected.world.systemId,
        activePlanetId: TIDEGARDEN_WORLD_ID,
        lastActivePlanetId: TIDEGARDEN_WORLD_ID,
        locationMode: 'surface',
        renderOrigin: expected.world.systemPosition,
        target: null
      });
      expect(getShipRestorationSnapshot()).toMatchObject({
        repairStage: 'flight_ready',
        currentWorldId: TIDEGARDEN_WORLD_ID,
        locationMode: 'surface'
      });
      expect(resolveStoryBootWorldId(
        '99,-37',
        isTidegardenRouteOnline(),
        getStoryStateSnapshot()
      )).toBe(TIDEGARDEN_WORLD_ID);
    }
  );

  it('resumes a crossed save in Tidegarden descent at its persisted pose without granting landing evidence', () => {
    const expected = createTidegardenLandfallBootstrap();
    const savedPose = {
      position: [
        expected.world.systemPosition[0] + 17,
        expected.world.systemPosition[1] + 108,
        expected.world.systemPosition[2] - 6
      ] as [number, number, number],
      velocity: [2, -9, 1] as [number, number, number],
      quaternion: [0, 0, 0, 1] as [number, number, number, number]
    };
    markMilestone(STORY_MILESTONES.started);
    markMilestone(TIDEGARDEN_ROUTE_MILESTONE);
    markMilestone(STORY_MILESTONES.ch8Crossed);
    setShipRestorationLocation({
      currentSystemId: expected.world.systemId,
      currentWorldId: TIDEGARDEN_WORLD_ID,
      parkedPose: null,
      systemPose: savedPose,
      locationMode: 'atmosphere'
    });

    beginStory();

    expect(getStoryStateSnapshot()).toMatchObject({
      active: true,
      chapter: 'ch8',
      beat: 'ch8-landfall'
    });
    expect(getSystemFlightSnapshot()).toMatchObject({
      systemId: expected.world.systemId,
      activePlanetId: TIDEGARDEN_WORLD_ID,
      locationMode: 'atmosphere',
      pose: savedPose
    });
    expect(getSpaceFlightSnapshot()).toMatchObject({ phase: 'descent', controlMode: 'flight' });
    expect(hasMilestone(STORY_MILESTONES.ch8Landfall)).toBe(false);
  });

  it('falls back to a real atmospheric approach when crossed-save pose data is missing', () => {
    markMilestone(STORY_MILESTONES.started);
    markMilestone(TIDEGARDEN_ROUTE_MILESTONE);
    markMilestone(STORY_MILESTONES.ch8Crossed);

    beginStory();

    const expected = createTidegardenLandfallBootstrap();
    expect(getStoryStateSnapshot()).toMatchObject({ chapter: 'ch8', beat: 'ch8-landfall' });
    expect(getSystemFlightSnapshot()).toMatchObject({
      activePlanetId: TIDEGARDEN_WORLD_ID,
      locationMode: 'atmosphere',
      pose: expected.systemReset.pose
    });
    expect(getSpaceFlightSnapshot()).toMatchObject({ phase: 'descent', controlMode: 'flight' });
    expect(hasMilestone(STORY_MILESTONES.ch8Landfall)).toBe(false);
  });
});
