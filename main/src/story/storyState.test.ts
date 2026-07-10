import { describe, expect, it } from 'vitest';
import {
  chapterForBeat,
  STORY_BEAT_ORDER,
  type StoryBeat
} from './storyState.ts';

describe('storyState — beat order (drives debug jumps + seeding)', () => {
  it('orders beats monotonically through the chapters', () => {
    const chapterRank = { prologue: 0, ch1: 1, ch2: 2, ch3: 3, complete: 4, none: -1 } as const;
    let last = -1;
    for (const beat of STORY_BEAT_ORDER) {
      const rank = chapterRank[chapterForBeat(beat)];
      expect(rank).toBeGreaterThanOrEqual(last);
      last = rank;
    }
    expect(last).toBe(4); // ends at 'done'
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
});
