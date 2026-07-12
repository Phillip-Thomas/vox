import { describe, expect, it } from 'vitest';
import {
  advanceArrangementPhrase,
  arrangementLevels,
  createArrangement,
  type ArrangementInputs,
  type ArrangementState
} from './arrangement.ts';
import { ARRANGEMENT_LEVELS, DWELL_MAX, type ArrangementStateName } from './tuning.ts';

const inputs = (patch: Partial<ArrangementInputs> = {}): ArrangementInputs => ({
  energy: 0.5,
  tension: 0.3,
  wonder: 0.4,
  era: 1,
  bare: false,
  restBoost: 0,
  forceBuild: false,
  forceEbb: false,
  ...patch
});

function run(
  seed: number,
  phrases: number,
  inputsFor: (phrase: number, state: ArrangementState) => ArrangementInputs
): ArrangementStateName[] {
  const state = createArrangement();
  const log: ArrangementStateName[] = [];
  for (let p = 0; p < phrases; p++) {
    advanceArrangementPhrase(state, seed, p, inputsFor(p, state));
    log.push(state.name);
  }
  return log;
}

describe('arrangement state machine (§8.3)', () => {
  it('is deterministic for a given seed and input schedule', () => {
    const a = run(42, 200, (p) => inputs({ energy: 0.5 + 0.4 * Math.sin(p) }));
    const b = run(42, 200, (p) => inputs({ energy: 0.5 + 0.4 * Math.sin(p) }));
    expect(a).toEqual(b);
  });

  it('BUILD lasts exactly one phrase and ALWAYS lands in BLOOM', () => {
    const state = createArrangement();
    advanceArrangementPhrase(state, 7, 0, inputs({ forceBuild: true }));
    expect(state.name).toBe('BUILD');
    advanceArrangementPhrase(state, 7, 1, inputs());
    expect(state.name).toBe('BLOOM');
  });

  it('never sits anywhere longer than its dwell bound', () => {
    for (const seed of [1, 99, 4242]) {
      const state = createArrangement();
      for (let p = 0; p < 400; p++) {
        advanceArrangementPhrase(state, seed, p, inputs({ energy: (p % 10) / 10 }));
        expect(state.dwell).toBeLessThanOrEqual(DWELL_MAX[state.name] + 1);
      }
    }
  });

  it('bare era can only REST or BED (§8.5)', () => {
    const log = run(1337, 300, () => inputs({ bare: true, era: 0, forceBuild: true }));
    for (const name of log) expect(['REST', 'BED']).toContain(name);
  });

  it('bare demotes an in-flight bloom to the bed', () => {
    const state = createArrangement();
    advanceArrangementPhrase(state, 5, 0, inputs({ forceBuild: true }));
    advanceArrangementPhrase(state, 5, 1, inputs());
    expect(state.name).toBe('BLOOM');
    advanceArrangementPhrase(state, 5, 2, inputs({ bare: true, era: 0 }));
    expect(state.name).toBe('BED');
  });

  it('warp exit forces the bloom to EBB', () => {
    const state = createArrangement();
    advanceArrangementPhrase(state, 5, 0, inputs({ forceBuild: true }));
    advanceArrangementPhrase(state, 5, 1, inputs());
    expect(state.name).toBe('BLOOM');
    advanceArrangementPhrase(state, 5, 2, inputs({ forceEbb: true }));
    expect(state.name).toBe('EBB');
  });

  it('the full arc REST→BED→BUILD→BLOOM→EBB is reachable', () => {
    const seen = new Set<ArrangementStateName>();
    const state = createArrangement();
    for (let p = 0; p < 600; p++) {
      advanceArrangementPhrase(state, 2024, p, inputs({ energy: 0.8, wonder: 0.7 }));
      seen.add(state.name);
    }
    for (const name of ['REST', 'BED', 'BUILD', 'BLOOM', 'EBB'] as const) {
      expect(seen.has(name)).toBe(true);
    }
  });

  it('a heavy restBoost pulls the machine to the floor', () => {
    const log = run(9, 200, () => inputs({ restBoost: 1, energy: 0.1, wonder: 0 }));
    const restShare = log.filter((n) => n === 'REST').length / log.length;
    expect(restShare).toBeGreaterThan(0.5);
  });

  it('REST is a floor, never silence: the sub never drops out of any state', () => {
    for (const name of Object.keys(ARRANGEMENT_LEVELS) as ArrangementStateName[]) {
      expect(arrangementLevels(name).sub).toBeGreaterThan(0);
      expect(arrangementLevels(name).pad + arrangementLevels(name).sub).toBeGreaterThan(0.2);
    }
  });
});
