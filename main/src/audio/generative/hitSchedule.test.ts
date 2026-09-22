import { describe, expect, it } from 'vitest';
import {
  quantumFitsCapAtTempo,
  resolveHitQuantum,
  resolveRungQuantum,
  type StepGrid
} from './hitSchedule.ts';

// Stage 3 composed sync: cap-bounded quantum resolution on the mood's 8th grid.
const grid = (tempo: number, currentStep = 0, stepTime = 10): StepGrid => ({
  currentStep,
  stepTime,
  stepSeconds: 60 / tempo / 2,
  stepsPerBeat: 2,
  stepsPerBar: 8,
  barsPerPhrase: 8
});

describe('hitSchedule quantum resolution', () => {
  it('lands the written quantum when it fits the cap', () => {
    // 132 BPM: beat = 454.5 ms; cap one beat → the next beat always fits.
    const g = grid(132, 3, 10);
    const r = resolveHitQuantum(g, { quantize: 'beat', desired: 10, notBefore: 10, capMs: 60000 / 132 });
    expect(r.quantumLanded).toBe('beat');
    expect(r.fitsCap).toBe(true);
    expect(r.rungsDegraded).toBe(0);
    expect(r.step % 2).toBe(0);
    expect(r.time).toBeGreaterThanOrEqual(10);
    expect(r.slackMs).toBeLessThanOrEqual(60000 / 132 + 1e-6);
  });

  it('degrades beat → step when the beat period exceeds the cap (72 BPM, +450 ms)', () => {
    // 72 BPM beat = 833 ms > 450; step = 417 ms fits. Grid phase: the beat at
    // step 0 has just passed (desired 10 ms after it), so the next beat is 823 ms out.
    const g = grid(72, 0, 10);
    const r = resolveHitQuantum(g, { quantize: 'beat', desired: 10.01, notBefore: 10.01, capMs: 450 });
    expect(r.quantumLanded).toBe('step');
    expect(r.fitsCap).toBe(true);
    expect(r.rungsDegraded).toBe(1);
    expect(r.slackMs).toBeLessThanOrEqual(450);
  });

  it('degrades bar → beat → step in order', () => {
    // 88 BPM bar = 2727 ms; cap 700 → bar fails, beat (682) fits.
    const g = grid(88, 1, 0);
    const r = resolveHitQuantum(g, { quantize: 'bar', desired: 0, notBefore: 0, capMs: 700 });
    expect(r.quantumLanded).toBe('beat');
    expect(r.rungsDegraded).toBe(1);
  });

  it('never returns a quantum before notBefore', () => {
    const g = grid(132, 0, 10);
    const r = resolveHitQuantum(g, { quantize: 'beat', desired: 10.2, notBefore: 12.5, capMs: 60000 / 132 * 20 });
    expect(r.time).toBeGreaterThanOrEqual(12.5);
  });

  it('later-only by default: the onset is never earlier than desired', () => {
    const g = grid(84, 0, 10);
    for (let k = 0; k < 20; k++) {
      const desired = 10 + k * 0.137;
      const r = resolveHitQuantum(g, { quantize: 'beat', desired, notBefore: desired, capMs: 400 });
      expect(r.time).toBeGreaterThanOrEqual(desired - 1e-9);
    }
  });

  it('mayLead admits the nearer earlier quantum inside ±cap (the lift ruling at 84 BPM)', () => {
    // 84 BPM beat = 714 ms; desired sits 100 ms after a beat boundary → lead by 100 ms.
    const g = grid(84, 0, 10);
    const beat = 60 / 84;
    const desired = 10 + 2 * beat + 0.1;
    const r = resolveHitQuantum(g, { quantize: 'beat', desired, notBefore: 10, capMs: 400, mayLead: true });
    expect(r.quantumLanded).toBe('beat');
    expect(r.slackMs).toBeCloseTo(-100, 3);
    expect(r.fitsCap).toBe(true);
  });

  it('mayLead never leads past notBefore or the current step', () => {
    const g = grid(84, 4, 10);
    const beat = 60 / 84;
    const desired = 10 + 0.1; // the earlier beat (step 4 at t=10) is exactly the current step: allowed
    const a = resolveHitQuantum(g, { quantize: 'beat', desired, notBefore: 10, capMs: 400, mayLead: true });
    expect(a.time).toBeCloseTo(10, 9);
    // With the floor past the current beat, the earlier candidate is refused; the
    // cap is widened here so the beat rung (not the step) answers.
    const b = resolveHitQuantum(g, { quantize: 'beat', desired, notBefore: 10.05, capMs: 1000, mayLead: true });
    expect(b.time).toBeCloseTo(10 + beat, 9);
  });

  it('holds the floor rung: a "beat" floor never degrades to the step and reports fitsCap honestly', () => {
    const g = grid(42, 1, 0); // 42 BPM beat = 1429 ms
    const r = resolveHitQuantum(g, { quantize: 'beat', desired: 0, notBefore: 0, capMs: 450, floorRung: 'beat' });
    expect(r.quantumLanded).toBe('beat');
    expect(r.fitsCap).toBe(false);
  });

  it('phrase quantum tries the phrase multiple first, then the plain bar', () => {
    const g = grid(120, 8, 0); // step 8 = bar 1; next phrase boundary is step 64
    const phrase = resolveRungQuantum(g, 'bar', { quantize: 'phrase', desired: 0, notBefore: 0, capMs: 1e9 }, true);
    expect(phrase.step).toBe(64);
    const r = resolveHitQuantum(g, { quantize: 'phrase', desired: 0, notBefore: 0, capMs: 3000 });
    expect(r.quantumLanded).toBe('bar');
    expect(r.step).toBe(8);
    expect(r.rungsDegraded).toBe(1);
  });

  it('is deterministic: identical grid and request give identical results', () => {
    const g = grid(96, 5, 33.3);
    const req = { quantize: 'beat' as const, desired: 41.07, notBefore: 40, capMs: 400 };
    expect(resolveHitQuantum(g, req)).toEqual(resolveHitQuantum({ ...g }, { ...req }));
  });
});

describe('quantumFitsCapAtTempo (design-time fit)', () => {
  it('a later-only rung fits iff its period is within the cap', () => {
    expect(quantumFitsCapAtTempo(72, 'beat', 450)).toEqual({ fits: true, rung: 'step', periodMs: expect.closeTo(416.67, 1) });
    expect(quantumFitsCapAtTempo(132, 'beat', 60000 / 132)).toEqual({ fits: true, rung: 'beat', periodMs: expect.closeTo(454.55, 1) });
    expect(quantumFitsCapAtTempo(88, 'bar', 2750)).toEqual({ fits: true, rung: 'bar', periodMs: expect.closeTo(2727.27, 1) });
  });
  it('lead permitted halves the worst case', () => {
    expect(quantumFitsCapAtTempo(84, 'beat', 400, { mayLead: true }).rung).toBe('beat');
    expect(quantumFitsCapAtTempo(84, 'beat', 400).rung).toBe('step');
  });
  it('reports a design error when even the floor rung cannot fit', () => {
    expect(quantumFitsCapAtTempo(42, 'beat', 450, { floorRung: 'beat' }).fits).toBe(false);
    expect(quantumFitsCapAtTempo(42, 'beat', 700).fits).toBe(false); // 8th at 42 BPM = 714 ms
  });
});
