import { PHRASE_BARS } from './tuning.ts';

// --- The transport (§8.1: ONE clock) -----------------------------------------------------------
//
// Pure bar/beat/sixteenth grid over a monotonically-advancing time base (the
// runtime feeds ctx.currentTime; tests feed plain numbers). Laws encoded here:
//   - tempo and meter changes apply ONLY at bar lines (they are requested as
//     pending and take effect when the next bar line is crossed);
//   - energy never pushes bpm — it pushes subdivision (that lives in the
//     renderer, not here);
//   - sync points (hits/drops/blooms) are computed AHEAD on the grid, so
//     visuals can chase audio (`scheduleHit` returns the exact audio time).
// The scheduler rim (P3) advances the transport at bar lines inside the
// shipped 60 ms / 180 ms lookahead pattern; rAF never touches this.

export interface Meter {
  /** Felt beats per bar (4/4 → 4 quarters; 6/8 → 2 dotted quarters). */
  beatsPerBar: number;
  /** Sixteenth slots per felt beat (4/4 → 4; 6/8 → 6). */
  sixteenthsPerBeat: number;
}

export const METER_44: Meter = { beatsPerBar: 4, sixteenthsPerBeat: 4 };
export const METER_68: Meter = { beatsPerBar: 2, sixteenthsPerBeat: 6 };

export interface TransportState {
  /** Current tempo, bpm (felt beats per minute). */
  bpm: number;
  meter: Meter;
  /** Index of the current bar. */
  barIndex: number;
  /** Audio time the current bar started, seconds. */
  barStartTime: number;
  /** Tempo change waiting for the next bar line (§8.1 law). */
  pendingBpm: number | null;
  /** Meter change waiting for the next bar line. */
  pendingMeter: Meter | null;
}

export type HitQuantize = 'beat' | 'bar' | 'phrase';

export function barDurationSec(bpm: number, meter: Meter): number {
  return (meter.beatsPerBar * 60) / bpm;
}

export function createTransport(startTime: number, bpm: number, meter: Meter = METER_44): TransportState {
  return {
    bpm,
    meter,
    barIndex: 0,
    barStartTime: startTime,
    pendingBpm: null,
    pendingMeter: null
  };
}

/** Request a tempo change; it applies at the NEXT bar line, never mid-bar. */
export function requestTransportTempo(t: TransportState, bpm: number): void {
  t.pendingBpm = bpm;
}

/** Request a meter change; it applies at the NEXT bar line, never mid-bar. */
export function requestTransportMeter(t: TransportState, meter: Meter): void {
  t.pendingMeter = meter;
}

/**
 * Cross exactly one bar line: the finished bar keeps its tempo/meter; pending
 * changes take effect on the bar that STARTS at the new line.
 */
export function advanceTransportBar(t: TransportState): { barIndex: number; barStartTime: number } {
  t.barStartTime += barDurationSec(t.bpm, t.meter);
  t.barIndex += 1;
  if (t.pendingBpm != null) {
    t.bpm = t.pendingBpm;
    t.pendingBpm = null;
  }
  if (t.pendingMeter != null) {
    t.meter = t.pendingMeter;
    t.pendingMeter = null;
  }
  return { barIndex: t.barIndex, barStartTime: t.barStartTime };
}

/** Advance zero or more bars until `time` falls inside the current bar. Returns bars crossed. */
export function syncTransportTo(t: TransportState, time: number): number {
  let crossed = 0;
  while (time >= t.barStartTime + barDurationSec(t.bpm, t.meter)) {
    advanceTransportBar(t);
    crossed++;
  }
  return crossed;
}

export interface TransportPosition {
  barIndex: number;
  /** Felt beat within the bar, 0-based integer. */
  beat: number;
  /** Sixteenth slot within the bar, 0-based integer. */
  sixteenth: number;
  /** Continuous position within the bar, 0..1. */
  barPhase: number;
}

/**
 * Grid position at `time` (≥ the current bar start; earlier times clamp to
 * the bar start). Projects forward WITHOUT mutating: a pending tempo/meter is
 * applied once at the first projected bar line, exactly as advanceTransportBar
 * would.
 */
export function transportPositionAt(t: TransportState, time: number): TransportPosition {
  let bpm = t.bpm;
  let meter = t.meter;
  let barIndex = t.barIndex;
  let barStart = t.barStartTime;
  let pendingApplied = false;
  let dur = barDurationSec(bpm, meter);
  while (time >= barStart + dur) {
    barStart += dur;
    barIndex += 1;
    if (!pendingApplied) {
      bpm = t.pendingBpm ?? bpm;
      meter = t.pendingMeter ?? meter;
      pendingApplied = true;
    }
    dur = barDurationSec(bpm, meter);
  }
  const barPhase = Math.max(0, (time - barStart) / dur);
  const beat = Math.min(meter.beatsPerBar - 1, Math.floor(barPhase * meter.beatsPerBar));
  const slots = meter.beatsPerBar * meter.sixteenthsPerBeat;
  const sixteenth = Math.min(slots - 1, Math.floor(barPhase * slots));
  return { barIndex, beat, sixteenth, barPhase };
}

/**
 * The next grid boundary at or after `fromTime` (a scheduled-ahead sync point
 * for visual hits). Pure projection — pending tempo/meter honored at the
 * first bar line. Phrase boundaries are bar starts where
 * barIndex % barsPerPhrase === 0.
 */
export function nextQuantumTime(
  t: TransportState,
  fromTime: number,
  quantize: HitQuantize,
  barsPerPhrase: number = PHRASE_BARS
): number {
  let bpm = t.bpm;
  let meter = t.meter;
  let barIndex = t.barIndex;
  let barStart = t.barStartTime;
  let pendingApplied = false;
  for (;;) {
    const dur = barDurationSec(bpm, meter);
    if (barStart >= fromTime) {
      // A bar start is also a beat boundary; phrase starts additionally
      // require the bar index to sit on the phrase grid.
      if (quantize !== 'phrase' || barIndex % barsPerPhrase === 0) return barStart;
    } else if (quantize === 'beat' && fromTime < barStart + dur) {
      const beatDur = dur / meter.beatsPerBar;
      const k = Math.ceil((fromTime - barStart) / beatDur);
      if (k < meter.beatsPerBar) return barStart + k * beatDur;
      // k === beatsPerBar → the boundary is the next bar start; fall through.
    }
    barStart += dur;
    barIndex += 1;
    if (!pendingApplied) {
      bpm = t.pendingBpm ?? bpm;
      meter = t.pendingMeter ?? meter;
      pendingApplied = true;
    }
  }
}

/**
 * Legacy step-grid quantizer for the shipped scoreEngine scheduler (8th-note
 * steps, `patternStep` counting): the smallest step index ≥ currentStep that
 * is a multiple of stepsPerUnit AND lands at or after `notBefore`.
 * `stepTime` is the audio time of `currentStep`.
 */
export function nextGridStep(
  currentStep: number,
  stepTime: number,
  stepSeconds: number,
  stepsPerUnit: number,
  notBefore: number
): { step: number; time: number } {
  let step = Math.ceil(currentStep / stepsPerUnit) * stepsPerUnit;
  let time = stepTime + (step - currentStep) * stepSeconds;
  while (time < notBefore) {
    step += stepsPerUnit;
    time += stepsPerUnit * stepSeconds;
  }
  return { step, time };
}
