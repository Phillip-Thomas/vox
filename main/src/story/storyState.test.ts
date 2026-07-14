import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canContinueStory,
  chapterForBeat,
  completeStory,
  getStoryStateSnapshot,
  hasCompletedStory,
  initStoryFromSave,
  restartStory,
  STORY_BEAT_ORDER,
  STORY_MILESTONES,
  type StoryBeat
} from './storyState.ts';
import { getItemCount, addItem, resetInventory } from '../game/systems/inventorySystem.ts';
import { getMilestones, hasMilestone, markMilestone, resetProgression } from '../game/systems/progressionSystem.ts';
import { seedDebrisCollected, collectedDebrisCount } from './debrisSalvage.ts';
import { seedSupplyPodsCollected, collectedPodCount } from './supplyPods.ts';

describe('storyState — beat order (drives debug jumps + seeding)', () => {
  beforeEach(() => {
    resetProgression();
    resetInventory();
  });
  afterEach(() => vi.unstubAllGlobals());
  it('orders beats monotonically through the chapters', () => {
    const chapterRank = { prologue: 0, ch1: 1, ch2: 2, ch3: 3, ch4: 4, complete: 5, none: -1 } as const;
    let last = -1;
    for (const beat of STORY_BEAT_ORDER) {
      const rank = chapterRank[chapterForBeat(beat)];
      expect(rank).toBeGreaterThanOrEqual(last);
      last = rank;
    }
    expect(last).toBe(5); // ends at 'done'
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
    // A3: before = ch3-await-rest, plays = a3-dawn, after = done
    expect(at('ch3-await-rest')).toBeLessThan(at('a3-dawn'));
    expect(at('a3-dawn')).toBeLessThan(at('done'));
  });

  it('restarts a completed Story cleanly while preserving non-Story milestones', () => {
    markMilestone('sandbox:kept');
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
    expect(getMilestones().filter(milestone => milestone.startsWith('story:'))).toEqual(['story:started']);
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
});
