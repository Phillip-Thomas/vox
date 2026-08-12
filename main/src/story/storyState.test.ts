import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
  STORY_CHAPTER_ORDER,
  STORY_MILESTONES,
  storyChapterAtLeast,
  storyFirstDayOrLater,
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
  applyShipRestorationSnapshot,
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
  resolveStoryRuntimeWorldId,
  STORY_PRIMARY_WORLD_ID,
  TIDEGARDEN_ROUTE_MILESTONE,
  TIDEGARDEN_WORLD_ID
} from './tidegardenRoute.ts';
import {
  PHYSICAL_BOARDING_MILESTONE,
  PHYSICAL_BOARDING_SEALED_MILESTONE
} from './physicalBoardingReceipts.ts';
import { STORY_COORDINATE } from './world/storyWorld.ts';

const SRC_ROOT = fileURLToPath(new URL('..', import.meta.url));

function walkClientSources(directory: string, found: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      walkClientSources(path, found);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) found.push(path);
  }
  return found;
}

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
      ch10: 10,
      complete: 11,
      none: -1
    } as const;
    let last = -1;
    for (const beat of STORY_BEAT_ORDER) {
      const rank = chapterRank[chapterForBeat(beat)];
      expect(rank).toBeGreaterThanOrEqual(last);
      last = rank;
    }
    expect(last).toBe(11); // ends at 'done'
  });

  it('reads the station chapter as ch10 and never as the monochrome ladder', () => {
    // `'ch10-cold'.startsWith('ch1')` is true; the chapter resolver must not be
    // fooled by the prefix it shares with chapter one.
    expect(chapterForBeat('ch10-cold')).toBe('ch10');
    expect(chapterForBeat('ch10-ask')).toBe('ch10');
    expect(chapterForBeat('ch10-transit')).toBe('ch10');
    expect(chapterForBeat('ch1-fixed')).toBe('ch1');
  });

  it('keeps `done` as the runtime terminal with chapter 10 ordered before it', () => {
    const at = (beat: StoryBeat) => STORY_BEAT_ORDER.indexOf(beat);
    expect(STORY_BEAT_ORDER[STORY_BEAT_ORDER.length - 1]).toBe('done');
    expect(at('ch9-hearth')).toBeLessThan(at('ch10-cold'));
    expect(at('ch10-cold')).toBeLessThan(at('ch10-ask'));
    expect(at('ch10-ask')).toBeLessThan(at('ch10-transit'));
    expect(at('ch10-transit')).toBeLessThan(at('done'));
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

  it('resumes chapter 10 out of done free play and hands it back at the threshold', () => {
    const ladder: Array<[string, { chapter: string; beat: StoryBeat }]> = [
      [STORY_MILESTONES.ch10ColdNoticed, { chapter: 'ch10', beat: 'ch10-cold' }],
      [STORY_MILESTONES.ch10FabricationRefused, { chapter: 'ch10', beat: 'ch10-ask' }],
      [STORY_MILESTONES.ch10BearingClaimed, { chapter: 'ch10', beat: 'ch10-transit' }]
    ];
    for (const [milestone, entry] of ladder) {
      resetProgression();
      markMilestone(STORY_MILESTONES.started);
      // The two-world arc stays finished throughout chapter 10.
      markMilestone(STORY_MILESTONES.ch9Hearth);
      markMilestone(milestone);
      expect(storyEntryPoint(), milestone).toEqual(entry);
      expect(hasCompletedStory(), milestone).toBe(true);
      expect(canContinueStory(), milestone).toBe(true);
    }

    markMilestone(STORY_MILESTONES.ch10Complete);
    expect(storyEntryPoint()).toEqual({ chapter: 'complete', beat: 'done' });
    expect(canContinueStory()).toBe(false);
  });

  it('keeps every ch5 through ch9 world-prop decision byte-identical to the retired regex', () => {
    // The predicate this replaced was /^ch[5-9]$/ plus ch4, done and three ch3
    // tail beats. Table-driven against that exact shipped truth, chapter by
    // chapter and beat by beat, so the repair cannot have moved anything but
    // the case it was for.
    const shippedFirstDayOrLater = (chapter: string, beat: StoryBeat | null): boolean =>
      chapter === 'ch4'
        || chapter === 'complete'
        || /^ch[5-9]$/.test(chapter)
        || beat === 'ch3-thirst' || beat === 'ch3-forage' || beat === 'ch3-signal';

    for (const beat of STORY_BEAT_ORDER) {
      const chapter = chapterForBeat(beat);
      const snapshot = { active: true, chapter, beat, runId: 0 } as const;
      // ch10 is the ONE intended difference: it is chapter five or later and
      // the retired regex said otherwise.
      const expected = chapter === 'ch10' ? true : shippedFirstDayOrLater(chapter, beat);
      expect(storyFirstDayOrLater(snapshot), beat).toBe(expected);
    }

    // And the field-pack source's own gate moves with it, for the same reason.
    for (const chapter of ['ch1', 'ch2', 'ch3', 'ch4'] as const) {
      expect(storyChapterAtLeast(chapter, 'ch5'), chapter).toBe(false);
    }
    for (const chapter of ['ch5', 'ch6', 'ch7', 'ch8', 'ch9', 'ch10', 'complete'] as const) {
      expect(storyChapterAtLeast(chapter, 'ch5'), chapter).toBe(true);
    }
    expect(storyChapterAtLeast('none', 'ch5')).toBe(false);
    expect(storyChapterAtLeast('prologue', 'ch5')).toBe(false);
  });

  it('renders the wreck relay through the whole ask beat', () => {
    // The relay is the channel chapter 10 exists to ask down. Its scenery and
    // its live lamp must be present for every ch10 beat, not merely its marker.
    for (const beat of ['ch10-cold', 'ch10-ask', 'ch10-transit'] as const) {
      expect(storyFirstDayOrLater({
        active: true, chapter: chapterForBeat(beat), beat, runId: 0
      }), beat).toBe(true);
    }
  });

  it('keeps every ch1 through ch9 boot-world decision byte-identical, and gives ch10 to Tidegarden', () => {
    // The owner-reported ch10 defects (a full-size sibling shell drawn at the
    // camera, the ground itself becoming a lockable system body, and both
    // surface beats running on the origin's terrain seed) all reduce to ONE
    // cause: the boot-world predicate enumerated ch9 and complete and stopped.
    // Table-driven against the retired enumeration's exact shipped truth, beat
    // by beat, so the repair cannot have moved anything but the case it is for.
    const retiredTidegardenOwned = (chapter: string, beat: StoryBeat | null): boolean =>
      beat === 'ch8-landfall' || chapter === 'ch9' || chapter === 'complete';

    for (const beat of STORY_BEAT_ORDER) {
      const chapter = chapterForBeat(beat);
      // The two surface beats are the intended difference: the station chapter
      // opens at the second hearth, which is on Tidegarden. `ch10-transit` is
      // NOT, and must keep the retired answer — chapter 10 flies back to the
      // origin during the ask (the relay is there) and lifts off from the
      // wreck, so a reload restarts the transit where the ship actually is.
      const owned = beat === 'ch10-cold' || beat === 'ch10-ask'
        ? true
        : retiredTidegardenOwned(chapter, beat);
      expect(resolveStoryBootWorldId(STORY_PRIMARY_WORLD_ID, true, { chapter, beat }), beat)
        .toBe(owned ? TIDEGARDEN_WORLD_ID : STORY_PRIMARY_WORLD_ID);
      // The route capability still gates everything: with it closed, the
      // authored system is one body and every beat boots on the origin.
      expect(resolveStoryBootWorldId(TIDEGARDEN_WORLD_ID, false, { chapter, beat }), beat)
        .toBe(STORY_PRIMARY_WORLD_ID);
    }

    // Named restatement, because these three beats are the defect.
    for (const beat of ['ch10-cold', 'ch10-ask'] as const) {
      expect(resolveStoryBootWorldId(STORY_PRIMARY_WORLD_ID, true, {
        chapter: chapterForBeat(beat), beat
      }), beat).toBe(TIDEGARDEN_WORLD_ID);
    }
    // The transit is a crossing in progress and belongs to the world it left,
    // exactly as ch8-launch and ch8-crossing do. A saved Tidegarden surface
    // does not reclaim a ship that is already in space.
    expect(resolveStoryBootWorldId(TIDEGARDEN_WORLD_ID, true, {
      chapter: 'ch10', beat: 'ch10-transit'
    })).toBe(STORY_PRIMARY_WORLD_ID);
    // A chapter the ordering does not know is nowhere in the story and owns
    // nothing — the predicate fails closed rather than to the sibling.
    expect(resolveStoryBootWorldId(TIDEGARDEN_WORLD_ID, true, { chapter: 'none', beat: null }))
      .toBe(STORY_PRIMARY_WORLD_ID);
  });

  it('protects a committed crossing in BOTH directions so the world cannot reclaim the ship', () => {
    // The movie lane's ch10 return crossing looped forever on this: the runtime
    // resolver knew only ch8's outbound seam, so once the system flight had
    // committed the origin world the boot answer (Tidegarden, correct for a
    // RELOAD) kept winning, the app swapped the scene back, and the player was
    // re-seated at the Tidegarden launch pose every time — eighteen identical
    // launch/reclaim cycles with activePlanetId never leaving the sibling.
    const outbound = { chapter: 'ch8', beat: 'ch8-crossing' };
    const inbound = { chapter: 'ch10', beat: 'ch10-ask' };

    // Outbound, unchanged: committed Tidegarden survives the readiness gap.
    expect(resolveStoryRuntimeWorldId(TIDEGARDEN_WORLD_ID, true, outbound, TIDEGARDEN_WORLD_ID))
      .toBe(TIDEGARDEN_WORLD_ID);
    // Inbound: a committed origin must survive it too.
    expect(resolveStoryRuntimeWorldId(STORY_PRIMARY_WORLD_ID, true, inbound, STORY_PRIMARY_WORLD_ID))
      .toBe(STORY_PRIMARY_WORLD_ID);

    // Neither direction may promote a crossing the system flight has NOT
    // committed — an uncommitted destination render is not ownership.
    expect(resolveStoryRuntimeWorldId(STORY_PRIMARY_WORLD_ID, true, inbound, TIDEGARDEN_WORLD_ID))
      .toBe(TIDEGARDEN_WORLD_ID);
    expect(resolveStoryRuntimeWorldId(TIDEGARDEN_WORLD_ID, true, inbound, TIDEGARDEN_WORLD_ID))
      .toBe(TIDEGARDEN_WORLD_ID);
    // And a reload still restarts the leg from the world it launched from.
    expect(resolveStoryBootWorldId(STORY_PRIMARY_WORLD_ID, true, inbound))
      .toBe(TIDEGARDEN_WORLD_ID);
    // Route closed: one body, origin only, in every direction.
    expect(resolveStoryRuntimeWorldId(STORY_PRIMARY_WORLD_ID, false, inbound, STORY_PRIMARY_WORLD_ID))
      .toBe(STORY_PRIMARY_WORLD_ID);
    // A beat with no crossing of its own is untouched by the table.
    expect(resolveStoryRuntimeWorldId(STORY_PRIMARY_WORLD_ID, true,
      { chapter: 'ch10', beat: 'ch10-transit' }, STORY_PRIMARY_WORLD_ID))
      .toBe(STORY_PRIMARY_WORLD_ID);
  });

  it('orders chapters from the beat order rather than from a second list', () => {
    expect(STORY_CHAPTER_ORDER.indexOf('ch9')).toBeLessThan(STORY_CHAPTER_ORDER.indexOf('ch10'));
    expect(STORY_CHAPTER_ORDER.indexOf('ch10')).toBeLessThan(STORY_CHAPTER_ORDER.indexOf('complete'));
    expect(STORY_CHAPTER_ORDER[0]).toBe('prologue');
  });

  it('seeds a done rehearsal with the receipts a real arrival carries', () => {
    // ?story=done must be the free play a real player reaches, not a lookalike:
    // the two-world handoff is half of ST-0's render predicate, so a rehearsal
    // without it has a sky no real save has.
    vi.stubGlobal('window', { location: { search: '?story=done' } });
    initStoryFromSave();

    expect(getStoryStateSnapshot()).toMatchObject({
      active: false,
      chapter: 'complete',
      beat: 'done'
    });
    expect(hasMilestone(STORY_MILESTONES.complete)).toBe(true);
    expect(hasMilestone(STORY_MILESTONES.ch9Hearth)).toBe(true);
    expect(hasMilestone('story:tidegarden:two-world-handoff')).toBe(true);
    expect(hasMilestone('story:tidegarden:safe-rest-completed')).toBe(true);
    expect(hasMilestone('story:tidegarden:shelter-certified')).toBe(true);
    // And it is still free play, not chapter 10: nothing has been noticed yet.
    expect(hasMilestone(STORY_MILESTONES.ch10ColdNoticed)).toBe(false);
    expect(storyEntryPoint()).toEqual({ chapter: 'complete', beat: 'done' });
  });

  it('defines the docking authorization milestone and grants it nowhere', () => {
    // Run one DEFINES the predicate and sets it for no one: run two's owner
    // docking packet owns when it becomes true. Proven by scanning the shipped
    // client for any producer that would mark it.
    expect(STORY_MILESTONES.stationDockingAuthorized).toBe('story:station-docking-authorized');
    const offenders: string[] = [];
    for (const path of walkClientSources(SRC_ROOT)) {
      const source = readFileSync(path, 'utf8');
      if (
        /markMilestone\(\s*STORY_MILESTONES\.stationDockingAuthorized/.test(source)
        || /markMilestone\(\s*'story:station-docking-authorized'/.test(source)
      ) offenders.push(path);
    }
    expect(offenders).toEqual([]);
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

    vi.stubGlobal('window', { location: { search: '?story=ch8-launch' } });
    initStoryFromSave();
    expect(getStoryStateSnapshot()).toMatchObject({ chapter: 'ch8', beat: 'ch8-launch' });
    expect(getShipRepairStage()).toBe('flight_ready');
    expect(hasMilestone(STORY_MILESTONES.ch7Boarded)).toBe(true);
    expect(hasMilestone(STORY_MILESTONES.ch8Launched)).toBe(false);
    expect(hasMilestone(PHYSICAL_BOARDING_SEALED_MILESTONE)).toBe(true);
    expect(hasMilestone(PHYSICAL_BOARDING_MILESTONE)).toBe(true);
    expect(getSpaceFlightSnapshot()).toMatchObject({ phase: 'surface', controlMode: 'flight' });
    expect(getSystemFlightSnapshot()).toMatchObject({
      systemId: `${STORY_COORDINATE.x},${STORY_COORDINATE.y}`,
      activePlanetId: STORY_PRIMARY_WORLD_ID,
      locationMode: 'surface',
      target: null
    });

    vi.stubGlobal('window', { location: { search: '?story=ch8-crossing' } });
    initStoryFromSave();
    expect(getSpaceFlightSnapshot()).toMatchObject({ phase: 'deep_space', controlMode: 'flight' });

    vi.stubGlobal('window', { location: { search: '?story=ch8-landfall' } });
    initStoryFromSave();
    expect(getSpaceFlightSnapshot()).toMatchObject({ phase: 'descent', controlMode: 'flight' });
  });

  it('repairs legacy boarding receipts without overriding on-foot surface occupancy on Continue', () => {
    markMilestone(STORY_MILESTONES.started);
    markMilestone(STORY_MILESTONES.ch7Boarded);
    applyShipRestorationSnapshot({ repairStage: 'flight_ready' });
    resetTravel();

    beginStory();

    expect(getStoryStateSnapshot()).toMatchObject({
      active: true,
      chapter: 'ch8',
      beat: 'ch8-launch'
    });
    expect(getSpaceFlightSnapshot()).toMatchObject({ phase: 'surface', controlMode: 'fps' });
    expect(hasMilestone(PHYSICAL_BOARDING_SEALED_MILESTONE)).toBe(true);
    expect(hasMilestone(PHYSICAL_BOARDING_MILESTONE)).toBe(true);
    expect(hasMilestone(STORY_MILESTONES.ch8Launched)).toBe(false);
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
