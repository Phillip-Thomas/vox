import { describe, expect, it } from 'vitest';
import {
  chordPitchClasses,
  deriveMoodConstraint,
  literalVoicing,
  maxVoiceDisplacementOverCycle,
  resolveMoodVoicingAt,
  resolveMoodVoicingSequence,
  tightIntervals,
  voiceDisplacement,
  voiceMoodChord
} from './moodConstraint.ts';
import type { ScoreMood } from '../scoreEngine.ts';

const mood = (chord: number[], progression?: number[][]): ScoreMood => ({
  chord, progression, pattern: [0, null, 7, null], tempo: 88, wave: 'sawtooth',
  pad: 0.1, sub: 0.1, ost: 0.05, riser: 0.1, baseline: 0.5, octave: 12
});

describe('moodConstraint derivation', () => {
  it('collects the pitch-class set of every authored chord, transposed by the chain tonic', () => {
    const c = deriveMoodConstraint(mood([0, 3, 7], [[0, 3, 7], [8, 12, 15]]), 2, 'brain');
    expect(c.pitchClassSet).toEqual([2, 5, 9, 10]);
    expect(c.chordSequence).toEqual([[0, 3, 7], [8, 12, 15]]);
    expect(c.bassPolicy).toBe('root');
    expect(c.registerBand.lo).toBe(3 + 2);
    expect(c.registerBand.hi).toBeGreaterThanOrEqual(c.registerBand.lo + 11);
    expect(c.tensionCurve).toHaveLength(2);
  });

  it('a static chord is a one-chord sequence', () => {
    const c = deriveMoodConstraint(mood([0, 7]), 0, 'brain');
    expect(c.chordSequence).toEqual([[0, 7]]);
    expect(resolveMoodVoicingSequence(c)).toEqual([[0, 7]]);
  });
});

describe('literal / subtractive / ordered are the identity', () => {
  const prog = [[0, 6], [0, 1]];
  for (const policy of ['literal', 'subtractive', 'ordered'] as const) {
    it(`${policy}: every chord renders its authored stack (plus the chain tonic only)`, () => {
      const c = deriveMoodConstraint(mood([0, 1, 6], prog), 0, policy);
      expect(resolveMoodVoicingSequence(c)).toEqual(prog);
      const t = deriveMoodConstraint(mood([0, 1, 6], prog), 5, policy);
      expect(resolveMoodVoicingSequence(t)).toEqual(prog.map((ch) => literalVoicing(ch, 5)));
    });
  }
  it('ordered keeps a4-exhale opening one member at a time in order', () => {
    const prog = [[0, 7], [0, 4, 7], [0, 4, 7, 9], [0, 4, 7, 9, 14]];
    const c = deriveMoodConstraint(mood([0, 4, 7, 9, 14], prog), 0, 'ordered');
    const seq = resolveMoodVoicingSequence(c);
    expect(seq.map((v) => v.length)).toEqual([2, 3, 4, 5]); // the full stack is published; the pad voices four
    expect(seq[3]).toEqual([0, 4, 7, 9, 14]);
  });
});

describe('brain voicing', () => {
  it('opens on the literal, keeps bass = root and every pitch class at each change', () => {
    const prog = [[0, 3, 7], [8, 12, 15], [3, 7, 10], [10, 14, 17]];
    const c = deriveMoodConstraint(mood([0, 3, 7, 10], prog), 0, 'brain');
    const seq = resolveMoodVoicingSequence(c);
    expect(seq[0]).toEqual([0, 3, 7]);
    seq.forEach((voicing, i) => {
      expect(voicing[0]).toBe(prog[i][0]);
      expect(chordPitchClasses(voicing)).toEqual(chordPitchClasses(prog[i]));
    });
  });

  it('never moves an inner voice further than the literal jump, and moves less where the literal jumps in parallel (voyage)', () => {
    const prog = [[0, 3, 7], [8, 12, 15]];
    const c = deriveMoodConstraint(mood([0, 3, 7], prog), 0, 'brain');
    const brain = resolveMoodVoicingSequence(c);
    const literal = prog;
    expect(maxVoiceDisplacementOverCycle(brain)).toBeLessThanOrEqual(maxVoiceDisplacementOverCycle(literal));
    let brainTotal = 0;
    let literalTotal = 0;
    for (let i = 1; i < prog.length; i++) {
      brainTotal += voiceDisplacement(brain[i - 1].slice(1), brain[i].slice(1)).total;
      literalTotal += voiceDisplacement(literal[i - 1].slice(1), literal[i].slice(1)).total;
    }
    expect(brainTotal).toBeLessThan(literalTotal);
  });

  it('preserves a written semitone as a semitone (the dread interval), never as a minor ninth', () => {
    // ch1-anomaly / descent family: the [0,1] rub must survive re-voicing.
    const prog = [[0, 3, 7], [1, 5, 8]];
    const c = deriveMoodConstraint(mood([0, 1, 7], prog), 0, 'brain');
    resolveMoodVoicingSequence(c).forEach((voicing, i) => {
      expect(tightIntervals(voicing)).toEqual(tightIntervals(prog[i]));
    });
    const audit = deriveMoodConstraint(mood([0, 6, 7], [[0, 6, 7], [0, 1, 7]]), 0, 'brain');
    const seq = resolveMoodVoicingSequence(audit);
    expect(tightIntervals(seq[0])).toEqual([1]);
    expect(tightIntervals(seq[1])).toEqual([1]);
  });

  it('keeps the ch10 whole-step floor a whole step, not a semitone', () => {
    const prog = [[-2, 4, 7, 10], [-2, 7, 12]];
    const c = deriveMoodConstraint(mood([-2, 4, 7, 10, 14], prog), 0, 'brain');
    for (const voicing of resolveMoodVoicingSequence(c)) {
      expect(voicing[0]).toBe(-2);
      expect(tightIntervals(voicing).includes(1)).toBe(false);
    }
  });

  it('keeps every inner voice inside the mood\'s own register band (no new register colour)', () => {
    const prog = [[0, 3, 7], [8, 12, 15], [5, 8, 12], [3, 7, 10]];
    const c = deriveMoodConstraint(mood([0, 3, 7], prog), 0, 'brain');
    for (const voicing of resolveMoodVoicingSequence(c)) {
      for (const upper of voicing.slice(1)) {
        expect(upper).toBeGreaterThanOrEqual(c.registerBand.lo);
        expect(upper).toBeLessThanOrEqual(Math.max(c.registerBand.hi, c.registerBand.lo + 11));
      }
    }
  });

  it('is deterministic and index-addressable (a hit forecast at chord k equals the walk to k)', () => {
    const prog = [[0, 7, 12, 16], [5, 9, 12], [7, 11, 14], [0, 4, 7, 12]];
    const c = deriveMoodConstraint(mood([0, 7, 12, 16], prog), 3, 'brain');
    const seq = resolveMoodVoicingSequence(c);
    seq.forEach((v, i) => expect(resolveMoodVoicingAt(c, i)).toEqual(v));
    expect(resolveMoodVoicingAt(c, 5)).toEqual(seq[1]);
  });

  it('a single-voice change from a previous voicing falls back to the literal when no candidate keeps the tight intervals', () => {
    const c = deriveMoodConstraint(mood([0, 1], [[0, 1], [0, 2]]), 0, 'brain');
    expect(voiceMoodChord(c, 1, [0, 1])).toEqual([0, 2]);
  });
});

describe('published stack law', () => {
  it('brain keeps every literal tone past the pad budget (a 5-tone chord still publishes five tones)', () => {
    const prog = [[0, 4, 7, 10, 14], [5, 9, 12, 15], [0, 4, 7, 10, 14]];
    const c = deriveMoodConstraint(mood([0, 4, 7, 10, 14], prog), 0, 'brain');
    const seq = resolveMoodVoicingSequence(c);
    expect(seq[0]).toEqual([0, 4, 7, 10, 14]);
    expect(seq[2]).toHaveLength(5);
    expect(seq[2][4]).toBe(14);
    expect(chordPitchClasses(seq[2])).toEqual(chordPitchClasses(prog[2]));
  });
});

describe('cycle law', () => {
  it('the forecast at absolute chord k equals the live walk on any cycle, and the wrap never jumps further than the written wrap', () => {
    const prog = [[0, 4, 7, 11], [5, 9, 12, 16], [7, 11, 14], [0, 4, 7, 12]];
    const c = deriveMoodConstraint(mood([0, 4, 7, 11], prog), 0, 'brain');
    const two = resolveMoodVoicingSequence(c, 2);
    two.forEach((v, k) => expect(resolveMoodVoicingAt(c, k)).toEqual(v));
    const writtenWrap = voiceDisplacement(prog[3].slice(1), prog[0].slice(1)).max;
    expect(voiceDisplacement(two[3].slice(1), two[4].slice(1)).max).toBeLessThanOrEqual(writtenWrap);
    for (let k = 1; k < two.length; k++) {
      const i = (k - 1) % prog.length;
      const j = k % prog.length;
      const written = voiceDisplacement(prog[i].slice(1, 4), prog[j].slice(1, 4)).max;
      expect(voiceDisplacement(two[k - 1].slice(1, 4), two[k].slice(1, 4)).max).toBeLessThanOrEqual(written);
      expect(tightIntervals(two[k].slice(0, 4))).toEqual(tightIntervals(prog[j].slice(0, 4)));
    }
  });
});

describe('gain guard', () => {
  it('leaves a mood literal when the brain walk would move a voice further than the composer wrote at any change (ch3-gather)', () => {
    const prog = [[0, 7, 12, 15], [3, 7, 12], [10, 14, 17], [7, 10, 14]];
    const c = deriveMoodConstraint(mood([0, 7, 12, 15], prog), 0, 'brain');
    expect(c.requestedPolicy).toBe('brain');
    expect(c.voicingPolicy).toBe('literal');
    expect(c.brainGuard).toBe('exceeds-written-jump');
    expect(resolveMoodVoicingSequence(c, 2)).toEqual([...prog, ...prog]);
  });
  it('applies the brain where it is strictly better at every change (voyage)', () => {
    const c = deriveMoodConstraint(mood([0, 3, 7], [[0, 3, 7], [8, 12, 15]]), 0, 'brain');
    expect(c.voicingPolicy).toBe('brain');
    expect(c.brainGuard).toBe('applied');
  });
  it('a static chord is never demoted or re-voiced', () => {
    const c = deriveMoodConstraint(mood([0, 7]), 0, 'brain');
    expect(c.voicingPolicy).toBe('brain');
    expect(c.brainGuard).toBe('not-requested');
    expect(resolveMoodVoicingSequence(c)).toEqual([[0, 7]]);
  });
});
