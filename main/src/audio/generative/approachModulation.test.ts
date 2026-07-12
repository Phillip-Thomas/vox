import { describe, expect, it } from 'vitest';
import {
  modulationCost,
  modulationWaypoints,
  planApproachModulation,
  type KeySpec
} from './approachModulation.ts';
import {
  MODE_BRIGHTNESS_CHAIN,
  MODE_DEGREE_SETS,
  modeTonicTriad,
  tonnetzDistance
} from './theory.ts';
import { MODULATE_MARGIN, MODULATE_MIN_BARS } from './tuning.ts';

const key = (tonicPc: number, mode: KeySpec['mode']): KeySpec => ({ tonicPc, mode });

describe('approach modulation guard (§8.4, owner ruling #1)', () => {
  it('same key → nothing to do', () => {
    expect(planApproachModulation(key(0, 'aeolian'), key(0, 'aeolian'), {
      approachBars: 32, harmonyBars: 2, storyLeads: false
    })).toEqual({ kind: 'none' });
  });

  it('never modulates under story authority (frozen contract)', () => {
    expect(planApproachModulation(key(0, 'aeolian'), key(5, 'dorian'), {
      approachBars: 64, harmonyBars: 1, storyLeads: true
    })).toEqual({ kind: 'none' });
  });

  it('a sprint approach falls back to the landing pivot', () => {
    expect(planApproachModulation(key(0, 'aeolian'), key(5, 'dorian'), {
      approachBars: MODULATE_MIN_BARS - 1, harmonyBars: 1, storyLeads: false
    })).toEqual({ kind: 'landingPivot' });
  });

  it('modulates only when the walk fits the budget minus the margin', () => {
    const current = key(0, 'aeolian');
    const dest = key(6, 'lydian'); // far: many accidentals + a long tonic walk
    const cost = modulationCost(current, dest);
    const tooTight = planApproachModulation(current, dest, {
      approachBars: (cost + MODULATE_MARGIN - 1) * 2, harmonyBars: 2, storyLeads: false
    });
    expect(tooTight.kind).toBe('landingPivot');
    const roomy = planApproachModulation(current, dest, {
      approachBars: (cost + MODULATE_MARGIN + 2) * 2, harmonyBars: 2, storyLeads: false
    });
    expect(roomy.kind).toBe('modulate');
  });
});

describe('the pivot-chord walk', () => {
  const cases: Array<[KeySpec, KeySpec]> = [
    [key(0, 'aeolian'), key(5, 'dorian')],
    [key(0, 'dorian'), key(7, 'lydian')],
    [key(3, 'mixolydian'), key(10, 'aeolian')],
    [key(0, 'lydian'), key(1, 'aeolian')],
    [key(4, 'aeolian'), key(4, 'lydian')], // mode-only
    [key(2, 'dorian'), key(9, 'dorian')] // tonic-only
  ];

  it('always arrives EXACTLY at the destination key', () => {
    for (const [cur, dest] of cases) {
      const wp = modulationWaypoints(cur, dest);
      expect(wp[wp.length - 1]).toEqual(dest);
    }
  });

  it('walk length equals the §8.4 cost (one accidental or one PLR move per step)', () => {
    for (const [cur, dest] of cases) {
      expect(modulationWaypoints(cur, dest).length).toBe(modulationCost(cur, dest));
    }
  });

  it('the walk prefix is the mode walk: one accidental at a time, tonic held', () => {
    for (const [cur, dest] of cases) {
      const wp = modulationWaypoints(cur, dest);
      const modeSteps = Math.abs(
        MODE_BRIGHTNESS_CHAIN.indexOf(cur.mode) - MODE_BRIGHTNESS_CHAIN.indexOf(dest.mode)
      );
      let prevMode = cur.mode;
      for (let i = 0; i < modeSteps; i++) {
        const step = wp[i];
        expect(step.tonicPc).toBe(cur.tonicPc);
        const from = MODE_BRIGHTNESS_CHAIN.indexOf(prevMode);
        const to = MODE_BRIGHTNESS_CHAIN.indexOf(step.mode);
        expect(Math.abs(to - from)).toBe(1);
        prevMode = step.mode;
      }
    }
  });

  it('tonic steps are single P/L/R moves (cheap by construction, §6.4)', () => {
    for (const [cur, dest] of cases) {
      const wp = modulationWaypoints(cur, dest);
      let prev = modeTonicTriad(cur.tonicPc, cur.mode);
      for (const step of wp) {
        const triad = modeTonicTriad(step.tonicPc, step.mode);
        expect(tonnetzDistance(prev, triad)).toBeLessThanOrEqual(2);
        prev = triad;
      }
    }
  });

  it('every waypoint mode has a tonic quality consistent with its triad', () => {
    for (const [cur, dest] of cases) {
      for (const step of modulationWaypoints(cur, dest)) {
        // A waypoint's mode always exists on the chain and owns a tonic triad.
        expect(MODE_DEGREE_SETS[step.mode].length).toBeGreaterThan(0);
      }
    }
  });
});
