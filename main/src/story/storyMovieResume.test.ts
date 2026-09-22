import { afterEach, expect, it, vi } from 'vitest';
import { getStoryStateSnapshot, initStoryFromSave, STORY_MILESTONES } from './storyState.ts';
import { addItem, getItemCount } from '../game/systems/inventorySystem.ts';
import { markMilestone, getMilestones, hasMilestone } from '../game/systems/progressionSystem.ts';

afterEach(() => vi.unstubAllGlobals());

it('keeps the same run identity through a same-tab page navigation', async () => {
  const values = new Map<string, string>();
  vi.stubGlobal('window', { location: { search: '?story=ch10-transit' },
    sessionStorage: { getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value) } });
  vi.resetModules();
  const departing = await import('./storyState.ts');
  departing.initStoryFromSave();
  const runId = departing.getStoryStateSnapshot().runId;
  expect(runId).toBeGreaterThan(0);
  window.location.search = '?movie=1&undock=-1,-1,0&fly=1';
  vi.resetModules();
  const arriving = await import('./storyState.ts');
  expect(arriving.getStoryStateSnapshot().runId).toBe(runId);
});

  it('resumes the earned free-play checkpoint when a movie returns from the station', () => {
    expect(getStoryStateSnapshot()).toMatchObject({ active: false, chapter: 'none', beat: null });
    markMilestone(STORY_MILESTONES.started);
    markMilestone(STORY_MILESTONES.ch10Complete);
    markMilestone(STORY_MILESTONES.stationDockingAuthorized);
    markMilestone('story:ch11-station-departed');
    addItem('bonded_cell', 1);
    const earned = [...getMilestones()];
    vi.stubGlobal('window', { location: { search: '?movie=1&undock=-1,-1,0&fly=1' } });

    initStoryFromSave();

    expect(getStoryStateSnapshot()).toMatchObject({ active: false, chapter: 'complete', beat: 'done' });
    expect(getMilestones()).toEqual(earned);
    expect(getItemCount('bonded_cell')).toBe(1);
    expect(hasMilestone('story:ch12-bonded-cell-installed')).toBe(false);
  });
