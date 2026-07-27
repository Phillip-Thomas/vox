import { describe, expect, it } from 'vitest';
import {
  advanceMiningTrigger,
  createMiningTriggerState,
  resetMiningTriggerState,
  RETARGET_DEBOUNCE_FRAMES,
  type MiningCandidate
} from './miningTrigger.model.ts';

const A = 'voxel:1,2,3';
const B = 'voxel:1,2,4';
const BLOCKED_A = '!voxel:1,2,3';

/** Run a candidate sequence and collect each frame's decision. */
function run(seq: MiningCandidate[], frames = RETARGET_DEBOUNCE_FRAMES) {
  const state = createMiningTriggerState();
  return {
    state,
    decisions: seq.map(c => advanceMiningTrigger(state, c, frames))
  };
}

describe('advanceMiningTrigger', () => {
  it('chips and commits immediately when acquiring a harvestable target from rest', () => {
    const { decisions } = run([A]);
    expect(decisions[0]).toEqual({ committedKey: A, chip: 'acquire', commit: true });
  });

  it('chips "blocked" (not "acquire") when the acquired target is un-harvestable', () => {
    const { decisions } = run([BLOCKED_A]);
    expect(decisions[0]).toEqual({ committedKey: BLOCKED_A, chip: 'blocked', commit: true });
  });

  it('holds the charge silently while the same target persists', () => {
    const { decisions } = run([A, A, A, A]);
    expect(decisions[0].chip).toBe('acquire');
    for (const d of decisions.slice(1)) {
      expect(d).toEqual({ committedKey: A, chip: null, commit: false });
    }
  });

  it('never chips or resets the charge under per-frame boundary jitter (A<->B)', () => {
    // Acquire A, then flip A/B/A/B/... for many frames (physics micro-jitter).
    const seq: MiningCandidate[] = [A];
    for (let i = 0; i < 20; i++) seq.push(i % 2 === 0 ? B : A);
    const { decisions } = run(seq);

    expect(decisions[0].chip).toBe('acquire'); // the one real acquisition
    // No frame after the acquisition chips, and the committed key never leaves A.
    for (const d of decisions.slice(1)) {
      expect(d.chip).toBeNull();
      expect(d.commit).toBe(false);
      expect(d.committedKey).toBe(A);
    }
  });

  it('silences the harvestable<->blocked flicker on the same cell', () => {
    const seq: MiningCandidate[] = [A];
    for (let i = 0; i < 12; i++) seq.push(i % 2 === 0 ? BLOCKED_A : A);
    const { decisions } = run(seq);
    expect(decisions[0].chip).toBe('acquire');
    for (const d of decisions.slice(1)) {
      expect(d.chip).toBeNull();
      expect(d.committedKey).toBe(A);
    }
  });

  it('commits a SUSTAINED retarget after the debounce, silently, resetting the charge', () => {
    // Acquire A, then hold B for exactly RETARGET_DEBOUNCE_FRAMES frames.
    const seq: MiningCandidate[] = [A];
    for (let i = 0; i < RETARGET_DEBOUNCE_FRAMES; i++) seq.push(B);
    const { decisions } = run(seq);

    // The first RETARGET_DEBOUNCE_FRAMES-1 B frames hold A (in the window).
    for (let i = 1; i < RETARGET_DEBOUNCE_FRAMES; i++) {
      expect(decisions[i]).toEqual({ committedKey: A, chip: null, commit: false });
    }
    // The RETARGET_DEBOUNCE_FRAMES-th B frame commits — no chip, charge reset.
    const commitFrame = decisions[RETARGET_DEBOUNCE_FRAMES];
    expect(commitFrame).toEqual({ committedKey: B, chip: null, commit: true });
  });

  it('cancels a pending retarget when the candidate flickers back to the incumbent', () => {
    // A, then B for a few frames (< debounce), then back to A: no commit ever.
    const seq: MiningCandidate[] = [A, B, B, A, A];
    const { decisions } = run(seq);
    expect(decisions.every((d, i) => i === 0 ? d.commit : !d.commit)).toBe(true);
    expect(decisions.every(d => d.committedKey === A)).toBe(true);
    // And a later sustained B still commits (pending was truly cleared).
    const { state } = run(seq);
    let committed = A;
    for (let i = 0; i < RETARGET_DEBOUNCE_FRAMES; i++) {
      committed = advanceMiningTrigger(state, B).committedKey ?? committed;
    }
    expect(committed).toBe(B);
  });

  it('restarts the persistence count when the candidate changes mid-window', () => {
    // A committed; B for (debounce-1) frames, then C: neither should commit yet.
    const seq: MiningCandidate[] = [A];
    for (let i = 0; i < RETARGET_DEBOUNCE_FRAMES - 1; i++) seq.push(B);
    seq.push('voxel:9,9,9'); // C — resets the counter
    const { decisions } = run(seq);
    expect(decisions.some((d, i) => i > 0 && d.commit)).toBe(false);
    expect(decisions[decisions.length - 1].committedKey).toBe(A);
  });

  it('treats a brief null (target loss) flicker as a candidate change — keeps the incumbent', () => {
    // A, then null for < debounce frames, then A again: no reset, no re-chip.
    const seq: MiningCandidate[] = [A, null, null, A, A];
    const { decisions } = run(seq);
    expect(decisions[0].chip).toBe('acquire');
    for (const d of decisions.slice(1)) {
      expect(d.chip).toBeNull();
      expect(d.committedKey).toBe(A);
    }
  });

  it('resets to rest after a SUSTAINED null, so the next target is a fresh acquisition edge', () => {
    const state = createMiningTriggerState();
    expect(advanceMiningTrigger(state, A).chip).toBe('acquire');
    // Sustained loss.
    for (let i = 0; i < RETARGET_DEBOUNCE_FRAMES; i++) advanceMiningTrigger(state, null);
    expect(state.committedKey).toBeNull();
    // The next real target chips again (a genuine re-acquisition).
    expect(advanceMiningTrigger(state, A)).toEqual({ committedKey: A, chip: 'acquire', commit: true });
  });

  it('does NOT chip on a blocked->harvestable retarget (retarget commits are silent)', () => {
    const state = createMiningTriggerState();
    expect(advanceMiningTrigger(state, BLOCKED_A).chip).toBe('blocked');
    let last = advanceMiningTrigger(state, A);
    for (let i = 1; i < RETARGET_DEBOUNCE_FRAMES; i++) last = advanceMiningTrigger(state, A);
    expect(last).toEqual({ committedKey: A, chip: null, commit: true });
  });

  it('resetMiningTriggerState makes the next candidate a fresh acquisition', () => {
    const state = createMiningTriggerState();
    advanceMiningTrigger(state, A);
    resetMiningTriggerState(state);
    expect(state).toEqual({ committedKey: null, pendingKey: null, pendingFrames: 0 });
    expect(advanceMiningTrigger(state, B).chip).toBe('acquire');
  });

  it('ships a per-frame debounce in the jitter-rejecting 4-6 frame band', () => {
    expect(RETARGET_DEBOUNCE_FRAMES).toBeGreaterThanOrEqual(4);
    expect(RETARGET_DEBOUNCE_FRAMES).toBeLessThanOrEqual(6);
  });
});
