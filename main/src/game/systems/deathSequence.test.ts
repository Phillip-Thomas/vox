import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEATH_TIMINGS, DEATH_TYPE_CPS,
  beginDeathSequence, notifyDeathRecovery, resetDeathSequence, getDeathView,
  deathLogLines, rewakeLogLines, deathCauseSummary, visibleLog, typedSlice,
  inferDeathCause,
  type DeathCause
} from './deathSequence.ts';

const { collapseMs, substrateMs, rewakeMs } = DEATH_TIMINGS;
const CAUSES: DeathCause[] = ['cold', 'drowning', 'lava', 'unknown'];

beforeEach(() => resetDeathSequence());

describe('phase progression', () => {
  it('starts idle with zero intensity', () => {
    const v = getDeathView(1000);
    expect(v.phase).toBe('idle');
    expect(v.intensity).toBe(0);
    expect(v.panelOpen).toBe(false);
  });

  it('walks collapse -> substrate -> panel on the authored clock', () => {
    beginDeathSequence('cold', {}, 1000);
    expect(getDeathView(1000).phase).toBe('collapse');
    expect(getDeathView(1000 + collapseMs - 1).phase).toBe('collapse');
    expect(getDeathView(1000 + collapseMs).phase).toBe('substrate');
    expect(getDeathView(1000 + collapseMs + substrateMs - 1).phase).toBe('substrate');
    expect(getDeathView(1000 + collapseMs + substrateMs).phase).toBe('panel');
  });

  it('holds the panel open indefinitely (no auto-dismiss)', () => {
    beginDeathSequence('lava', {}, 0);
    const v = getDeathView(collapseMs + substrateMs + 10 * 60 * 1000);
    expect(v.phase).toBe('panel');
    expect(v.panelOpen).toBe(true);
    expect(v.intensity).toBe(1);
  });

  it('intensity ramps monotonically 0 -> 1 through collapse', () => {
    beginDeathSequence('cold', {}, 0);
    let previous = -1;
    for (let t = 0; t <= collapseMs; t += collapseMs / 20) {
      const { intensity } = getDeathView(t);
      expect(intensity).toBeGreaterThanOrEqual(previous);
      expect(intensity).toBeGreaterThanOrEqual(0);
      expect(intensity).toBeLessThanOrEqual(1);
      previous = intensity;
    }
    expect(getDeathView(0).intensity).toBe(0);
    expect(getDeathView(collapseMs).intensity).toBe(1);
  });

  it('is idempotent while already dying (no clock restart)', () => {
    beginDeathSequence('cold', {}, 0);
    beginDeathSequence('lava', {}, collapseMs); // second hit mid-sequence: ignored
    const v = getDeathView(collapseMs);
    expect(v.cause).toBe('cold');
    expect(v.phase).toBe('substrate');
  });

  it('skipIntro (already downed at mount) lands directly on the panel', () => {
    beginDeathSequence('unknown', { skipIntro: true }, 500);
    const v = getDeathView(500);
    expect(v.phase).toBe('panel');
    expect(v.intensity).toBe(1);
    expect(v.panelOpen).toBe(true);
  });
});

describe('recovery / rewake', () => {
  it('decays from full intensity back to idle after the panel', () => {
    beginDeathSequence('drowning', {}, 0);
    const t0 = collapseMs + substrateMs + 2000;
    notifyDeathRecovery(t0);
    expect(getDeathView(t0).phase).toBe('rewake');
    expect(getDeathView(t0).intensity).toBe(1);
    const mid = getDeathView(t0 + rewakeMs / 2);
    expect(mid.intensity).toBeGreaterThan(0);
    expect(mid.intensity).toBeLessThan(1);
    const done = getDeathView(t0 + rewakeMs);
    expect(done.phase).toBe('idle');
    expect(done.intensity).toBe(0);
  });

  it('recovery mid-collapse decays from the current (partial) intensity', () => {
    beginDeathSequence('cold', {}, 0);
    const partial = getDeathView(collapseMs / 2).intensity;
    expect(partial).toBeGreaterThan(0);
    expect(partial).toBeLessThan(1);
    notifyDeathRecovery(collapseMs / 2);
    const v = getDeathView(collapseMs / 2);
    expect(v.phase).toBe('rewake');
    expect(v.intensity).toBeCloseTo(partial, 6);
  });

  it('a new death can begin during rewake', () => {
    beginDeathSequence('cold', {}, 0);
    notifyDeathRecovery(collapseMs);
    beginDeathSequence('lava', {}, collapseMs + 200);
    const v = getDeathView(collapseMs + 200);
    expect(v.phase).toBe('collapse');
    expect(v.cause).toBe('lava');
  });

  it('recovery while idle is a no-op', () => {
    notifyDeathRecovery(1234);
    expect(getDeathView(1234).phase).toBe('idle');
  });

  it('reset hard-clears any phase', () => {
    beginDeathSequence('cold', {}, 0);
    resetDeathSequence();
    expect(getDeathView(10).phase).toBe('idle');
  });
});

describe('cause inference (acute beats ambient)', () => {
  it('lava wins over everything', () => {
    expect(inferDeathCause({ feetInLava: true, submerged: true, oxygen: 0, warmth: 0 })).toBe('lava');
  });
  it('drowning needs water AND an empty breath', () => {
    expect(inferDeathCause({ feetInLava: false, submerged: true, oxygen: 0, warmth: 50 })).toBe('drowning');
    expect(inferDeathCause({ feetInLava: false, submerged: true, oxygen: 40, warmth: 50 })).toBe('unknown');
  });
  it('cold is the slow default; healthy state is unknown', () => {
    expect(inferDeathCause({ feetInLava: false, submerged: false, oxygen: 100, warmth: 0 })).toBe('cold');
    expect(inferDeathCause({ feetInLava: false, submerged: false, oxygen: 100, warmth: 80 })).toBe('unknown');
  });
});

describe('biomonitor log', () => {
  it('every cause has a distinct cause line and a full five-line schedule', () => {
    const causeLines = CAUSES.map(cause => deathLogLines(cause)[2].text);
    expect(new Set(causeLines).size).toBe(CAUSES.length);
    for (const cause of CAUSES) {
      const lines = deathLogLines(cause);
      expect(lines).toHaveLength(5);
      for (const line of lines) expect(line.text.length).toBeGreaterThan(0);
      // The whole log finishes typing before the panel arrives.
      const last = lines[lines.length - 1];
      const doneAt = last.atMs + (last.text.length / DEATH_TYPE_CPS) * 1000;
      expect(doneAt).toBeLessThan(collapseMs + substrateMs);
    }
  });

  it('lines appear on schedule and type out progressively', () => {
    const lines = deathLogLines('cold');
    expect(visibleLog(lines, 0)).toHaveLength(0);
    const partway = visibleLog(lines, lines[1].atMs + 100);
    expect(partway).toHaveLength(2);
    expect(lines[1].text.startsWith(partway[1].text)).toBe(true);
    expect(partway[1].text.length).toBeLessThan(lines[1].text.length);
    const all = visibleLog(lines, 60_000);
    expect(all.map(l => l.text)).toEqual(lines.map(l => l.text));
  });

  it('typedSlice clamps to the full line and to empty', () => {
    expect(typedSlice('abc', -50)).toBe('');
    expect(typedSlice('abc', 0)).toBe('');
    expect(typedSlice('abc', 60_000)).toBe('abc');
  });

  it('rewake log ends with the stamped resume line inside the rewake window', () => {
    const lines = rewakeLogLines();
    const last = lines[lines.length - 1];
    expect(last.stamp).toBe(true);
    expect(last.atMs).toBeLessThan(rewakeMs);
  });

  it('cause summaries are distinct and end-stopped', () => {
    const summaries = CAUSES.map(deathCauseSummary);
    expect(new Set(summaries).size).toBe(CAUSES.length);
    for (const s of summaries) expect(s.endsWith('.')).toBe(true);
  });
});
