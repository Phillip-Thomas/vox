import { beforeEach, describe, expect, it } from 'vitest';
import { resetProgression } from '../game/systems/progressionSystem.ts';
import {
  commitTidegardenRouteOnline,
  isTidegardenRouteOnline,
  progressionHasTidegardenRoute,
  resolveStoryBootWorldId,
  resolveStoryResumeWorldId,
  resolveStoryRuntimeWorldId,
  STORY_PRIMARY_WORLD_ID,
  storySystemPopulationPolicy,
  TIDEGARDEN_ROUTE_MILESTONE,
  TIDEGARDEN_WORLD_ID,
  tidegardenIdentity
} from './tidegardenRoute.ts';

describe('Tidegarden route capability', () => {
  beforeEach(() => resetProgression());

  it('keeps the authored system at p0 until the one route event commits', () => {
    expect(isTidegardenRouteOnline()).toBe(false);
    expect(storySystemPopulationPolicy(false)).toEqual({
      forceSingleBody: true,
      bodyCount: 1,
      travelEnabled: false
    });

    commitTidegardenRouteOnline();

    expect(isTidegardenRouteOnline()).toBe(true);
    expect(storySystemPopulationPolicy(true)).toEqual({
      forceSingleBody: false,
      bodyCount: 2,
      travelEnabled: true
    });
  });

  it('resumes on p1 only after unlock and permanently rejects p2', () => {
    expect(resolveStoryResumeWorldId(TIDEGARDEN_WORLD_ID, false)).toBe(STORY_PRIMARY_WORLD_ID);
    expect(resolveStoryResumeWorldId(TIDEGARDEN_WORLD_ID, true)).toBe(TIDEGARDEN_WORLD_ID);
    expect(resolveStoryResumeWorldId(`${STORY_PRIMARY_WORLD_ID}:p2`, true)).toBe(STORY_PRIMARY_WORLD_ID);
    expect(resolveStoryResumeWorldId('7,9:p1', true)).toBe(STORY_PRIMARY_WORLD_ID);
  });

  it('returns a completed two-world Story to the earned Tidegarden site', () => {
    expect(resolveStoryBootWorldId(
      STORY_PRIMARY_WORLD_ID,
      true,
      { chapter: 'complete', beat: 'done' }
    )).toBe(TIDEGARDEN_WORLD_ID);
  });

  it.each([
    { chapter: 'ch7', beat: 'ch7-reconstruct' },
    { chapter: 'ch7', beat: 'ch7-board' },
    { chapter: 'ch8', beat: 'ch8-launch' },
    { chapter: 'ch8', beat: 'ch8-crossing' }
  ])('forces the unfinished $beat Story back to the origin after route unlock', point => {
    expect(resolveStoryBootWorldId(TIDEGARDEN_WORLD_ID, true, point))
      .toBe(STORY_PRIMARY_WORLD_ID);
  });

  it('hands world ownership to Tidegarden at landfall, not at route unlock', () => {
    expect(resolveStoryBootWorldId(
      STORY_PRIMARY_WORLD_ID,
      true,
      { chapter: 'ch8', beat: 'ch8-landfall' }
    )).toBe(TIDEGARDEN_WORLD_ID);
    expect(resolveStoryBootWorldId(
      TIDEGARDEN_WORLD_ID,
      false,
      { chapter: 'ch8', beat: 'ch8-landfall' }
    )).toBe(STORY_PRIMARY_WORLD_ID);
  });

  it('retains a physically committed Tidegarden crossing only in the live runtime', () => {
    const crossing = { chapter: 'ch8', beat: 'ch8-crossing' };

    expect(resolveStoryBootWorldId(TIDEGARDEN_WORLD_ID, true, crossing))
      .toBe(STORY_PRIMARY_WORLD_ID);
    expect(resolveStoryRuntimeWorldId(
      TIDEGARDEN_WORLD_ID,
      true,
      crossing,
      TIDEGARDEN_WORLD_ID
    )).toBe(TIDEGARDEN_WORLD_ID);
  });

  it('does not treat an uncommitted destination render as live ownership', () => {
    const crossing = { chapter: 'ch8', beat: 'ch8-crossing' };

    expect(resolveStoryRuntimeWorldId(
      TIDEGARDEN_WORLD_ID,
      true,
      crossing,
      STORY_PRIMARY_WORLD_ID
    )).toBe(STORY_PRIMARY_WORLD_ID);
    expect(resolveStoryRuntimeWorldId(
      STORY_PRIMARY_WORLD_ID,
      true,
      crossing,
      STORY_PRIMARY_WORLD_ID
    )).toBe(STORY_PRIMARY_WORLD_ID);
  });

  it('uses the canonical pinned sibling identity', () => {
    expect(tidegardenIdentity()).toMatchObject({
      worldId: '-1,-1:p1',
      seed: 1600321158,
      systemId: '-1,-1'
    });
  });

  it('reads persisted progression snapshots without another flag', () => {
    expect(progressionHasTidegardenRoute({ milestones: [] })).toBe(false);
    expect(progressionHasTidegardenRoute({ milestones: [TIDEGARDEN_ROUTE_MILESTONE] })).toBe(true);
  });
});
