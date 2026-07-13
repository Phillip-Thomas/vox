import { beforeEach, describe, expect, it } from 'vitest';
import { isStoryPaused, resetStoryClock, setStoryPaused, storyNow } from './storyClock.ts';

describe('storyClock', () => {
  beforeEach(resetStoryClock);

  it('freezes while paused and resumes without a wall-time jump', () => {
    expect(storyNow(1000)).toBe(1000);
    setStoryPaused(true, 1200);
    expect(isStoryPaused()).toBe(true);
    expect(storyNow(9000)).toBe(1200);
    setStoryPaused(false, 9200);
    expect(isStoryPaused()).toBe(false);
    expect(storyNow(9400)).toBe(1400);
  });

  it('ignores repeated pause-state assignments', () => {
    setStoryPaused(true, 100);
    setStoryPaused(true, 500);
    setStoryPaused(false, 600);
    expect(storyNow(700)).toBe(200);
  });
});
