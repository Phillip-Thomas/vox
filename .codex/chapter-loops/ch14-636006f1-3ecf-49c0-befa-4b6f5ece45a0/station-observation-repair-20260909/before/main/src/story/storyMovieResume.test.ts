import { expect, it, vi } from 'vitest';
import { getStoryStateSnapshot, initStoryFromSave, STORY_MILESTONES } from './storyState.ts';
import { addItem, getItemCount } from '../game/systems/inventorySystem.ts';
import { markMilestone, getMilestones, hasMilestone } from '../game/systems/progressionSystem.ts';

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

