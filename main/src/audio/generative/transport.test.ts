import { describe, expect, it } from 'vitest';
import {
  advanceTransportBar,
  barDurationSec,
  createTransport,
  METER_44,
  METER_68,
  nextGridStep,
  nextQuantumTime,
  requestTransportMeter,
  requestTransportTempo,
  syncTransportTo,
  transportPositionAt
} from './transport.ts';
import { PHRASE_BARS } from './tuning.ts';

// 80 bpm, 4/4 → bar = 3.0 s, beat = 0.75 s. Anchored at t = 10.
const make = () => createTransport(10, 80, METER_44);

describe('bar/beat/sixteenth grid (§8.1)', () => {
  it('computes positions inside the current bar', () => {
    const t = make();
    expect(barDurationSec(t.bpm, t.meter)).toBeCloseTo(3.0);
    const p = transportPositionAt(t, 11.5); // halfway through bar 0
    expect(p.barIndex).toBe(0);
    expect(p.beat).toBe(2);
    expect(p.sixteenth).toBe(8);
    expect(p.barPhase).toBeCloseTo(0.5);
  });

  it('projects across bar lines without mutating', () => {
    const t = make();
    const p = transportPositionAt(t, 13.1);
    expect(p.barIndex).toBe(1);
    expect(p.beat).toBe(0);
    expect(t.barIndex).toBe(0);
    expect(t.barStartTime).toBe(10);
  });

  it('clamps times before the current bar start to the bar start', () => {
    const t = make();
    const p = transportPositionAt(t, 9);
    expect(p.barIndex).toBe(0);
    expect(p.barPhase).toBe(0);
  });

  it('handles 6/8 (two dotted-quarter beats, 12 sixteenth slots)', () => {
    const t = createTransport(0, 66, METER_68);
    expect(barDurationSec(t.bpm, t.meter)).toBeCloseTo(120 / 66);
    const p = transportPositionAt(t, (120 / 66) * 0.6);
    expect(p.beat).toBe(1);
    expect(p.sixteenth).toBe(7); // floor(0.6 × 12)
  });
});

describe('tempo/meter changes apply ONLY at bar lines (§8.1 law)', () => {
  it('keeps the current bar duration; the NEXT bar uses the pending tempo', () => {
    const t = make();
    requestTransportTempo(t, 120); // bar dur becomes 2.0 at the next line
    // Bar 0 still ends at 13; bar 1 runs 13 → 15.
    expect(transportPositionAt(t, 12.9).barIndex).toBe(0);
    expect(transportPositionAt(t, 13.1).barIndex).toBe(1);
    expect(transportPositionAt(t, 14.9).barIndex).toBe(1);
    expect(transportPositionAt(t, 15.1).barIndex).toBe(2);
  });

  it('advanceTransportBar applies the pending change exactly once', () => {
    const t = make();
    requestTransportTempo(t, 120);
    requestTransportMeter(t, METER_68);
    const crossed = advanceTransportBar(t);
    expect(crossed.barIndex).toBe(1);
    expect(crossed.barStartTime).toBeCloseTo(13);
    expect(t.bpm).toBe(120);
    expect(t.meter).toEqual(METER_68);
    expect(t.pendingBpm).toBeNull();
    expect(t.pendingMeter).toBeNull();
    // 6/8 at 120: bar = 2·60/120 = 1.0 s.
    expect(barDurationSec(t.bpm, t.meter)).toBeCloseTo(1.0);
  });

  it('syncTransportTo crosses whole bars and applies pending once', () => {
    const t = make();
    requestTransportTempo(t, 120);
    const crossed = syncTransportTo(t, 19.5); // bars: 10–13 (old), 13–15, 15–17, 17–19, 19–21
    expect(crossed).toBe(4);
    expect(t.barIndex).toBe(4);
    expect(t.barStartTime).toBeCloseTo(19);
    expect(t.bpm).toBe(120);
  });
});

describe('scheduled-ahead sync points (§8.1 grid-synced hits)', () => {
  it('quantizes to the next beat', () => {
    const t = make();
    expect(nextQuantumTime(t, 11.4, 'beat')).toBeCloseTo(11.5);
    expect(nextQuantumTime(t, 10.0, 'beat')).toBeCloseTo(10.0);
    expect(nextQuantumTime(t, 12.8, 'beat')).toBeCloseTo(13.0); // wraps to the bar line
  });

  it('quantizes to the next bar and phrase', () => {
    const t = make();
    expect(nextQuantumTime(t, 11.4, 'bar')).toBeCloseTo(13);
    // Phrase boundary: bar 0 start is behind us → the next is bar PHRASE_BARS.
    expect(nextQuantumTime(t, 10.1, 'phrase')).toBeCloseTo(10 + PHRASE_BARS * 3);
    expect(nextQuantumTime(t, 10.0, 'phrase')).toBeCloseTo(10.0); // exactly on it
  });

  it('honors a pending tempo when projecting boundaries', () => {
    const t = make();
    requestTransportTempo(t, 120);
    // Bars: 10, 13, then 2.0 s bars → bar 8 (phrase) at 13 + 7·2 = 27.
    expect(nextQuantumTime(t, 10.1, 'phrase')).toBeCloseTo(27);
    expect(nextQuantumTime(t, 13.1, 'bar')).toBeCloseTo(15);
    expect(nextQuantumTime(t, 13.1, 'beat')).toBeCloseTo(13.5); // 120 bpm beat = 0.5 s
  });
});

describe('legacy step-grid quantizer (scheduleHit rim)', () => {
  it('finds the next unit boundary at or after notBefore', () => {
    // Step 5 at t=100, 0.25 s steps, bar = 8 steps.
    expect(nextGridStep(5, 100, 0.25, 8, 100)).toEqual({ step: 8, time: 100.75 });
    // Too soon → the boundary after.
    expect(nextGridStep(5, 100, 0.25, 8, 101)).toEqual({ step: 16, time: 102.75 });
    // Already exactly on a boundary and in the future → keep it.
    expect(nextGridStep(8, 102, 0.25, 8, 101)).toEqual({ step: 8, time: 102 });
  });
});
