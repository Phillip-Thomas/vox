import type { SfxEvent } from './sfxEngine.ts';

/**
 * Minimum milliseconds between two *audible* retriggers of the same SFX event.
 *
 * This gates trigger RATE only — it never touches a sound's synthesis recipe
 * (timbres are owned by the score/creative side). Two kinds of event are listed:
 * the dense confirmation cues that proximity/pickup loops can machine-gun, and a
 * conservative floor on every *per-frame-caller-reachable* event so the loop
 * detector below can see it (a suppression-based detector is blind to an event
 * with interval 0). Genuinely one-shot events (`jump`, `land`, `boardShip`, the
 * ship/splash cues, `storyAwaken`, …) stay unlisted (0 = ungated) and fire
 * exactly as before.
 *
 * Tuning is one line per event here:
 *   - `mine`           — the 1600->700 Hz bandpass chip. Its own body is ~90 ms,
 *                        so a 110 ms floor lets a chip finish before the next may
 *                        fire (~9/sec max) instead of stacking dozens per frame.
 *   - `blocked`        — the sibling "can't break this" buzz, fired per fresh
 *                        target and on failed mine/build actions. Per-frame
 *                        reachable through the mining capability gate; a 110 ms
 *                        floor (its harvest sibling's rate) is well above any
 *                        legitimate per-press/per-fresh-target cadence.
 *   - `terminalKey`    — the 880 Hz square keystroke fired per debris/pod/waypoint
 *                        pickup and per typewriter tick. 90 ms (~11/sec max) keeps
 *                        deliberate rapid input legible without a high-pitch swarm.
 *   - `terminalAdvance`— the page-feed chirp, also the objective-enter cue. A
 *                        modest 150 ms floor (no legitimate double-fire lands
 *                        inside it: leg boundaries are seconds apart, objective
 *                        transitions are gameplay-gated) brings it under the loop
 *                        detector without touching real cadence.
 */
export const SFX_MIN_RETRIGGER_MS: Partial<Record<SfxEvent, number>> = {
  mine: 110,
  blocked: 110,
  terminalKey: 90,
  terminalAdvance: 150
};

const WINDOW_MS = 3000;
const BUCKET_MS = 500;
const BUCKET_COUNT = Math.max(1, Math.round(WINDOW_MS / BUCKET_MS));

// --- Loop-guard tuning -------------------------------------------------------
//
// A LEVEL-TRIGGERED loop (a call site that fires an event every frame) presents
// as SUSTAINED suppression: at 60 fps a call clipped to its floor generates
// ~50+ suppressed attempts/second, spread continuously across many frames. The
// detector engages only on that signature and is deliberately deaf to the two
// legitimate shapes it must not touch:
//   • a dense same-frame burst (40 nodes mined in one frame) — many suppressions
//     at ONE instant; excluded by the minimum SPAN requirement.
//   • the VoyageLedger digit-drift (~70 ms attempts vs a 90 ms floor, ~3-7/s) —
//     low rate; never reaches the count threshold inside the rolling window.
const LOOP_GUARD_WINDOW_MS = 2000;      // tumbling window the suppression count lives in
const LOOP_GUARD_MIN_SUPPRESSED = 24;   // K: suppressions in-window before we suspect a loop
const LOOP_GUARD_MIN_SPAN_MS = 350;     // suppressions must SPREAD this long (excludes bursts)
const LOOP_GUARD_QUIET_RESET_MS = 800;  // no ATTEMPTS this long -> full reset (responsive again)
const LOOP_GUARD_STEP = 4;              // escalate the effective interval x4 per admitted blip
const LOOP_GUARD_MAX_INTERVAL_MS = 1600; // cap: the metronome collapses to ~one blip / 1.6 s

export interface SfxRateCount {
  triggered: number;
  suppressed: number;
}

/**
 * Fixed-memory rolling window: BUCKET_COUNT time-bucketed slots keyed by the
 * absolute bucket id (floor(now / BUCKET_MS)). A slot whose id no longer matches
 * the bucket it maps to is stale and reset on next touch, so counts naturally
 * expire out of the trailing window without unbounded growth.
 */
class RollingCounter {
  private readonly triggered = new Array<number>(BUCKET_COUNT).fill(0);
  private readonly suppressed = new Array<number>(BUCKET_COUNT).fill(0);
  private readonly bucketId = new Array<number>(BUCKET_COUNT).fill(-1);

  private touch(nowMs: number): number {
    const abs = Math.floor(nowMs / BUCKET_MS);
    const idx = ((abs % BUCKET_COUNT) + BUCKET_COUNT) % BUCKET_COUNT;
    if (this.bucketId[idx] !== abs) {
      this.bucketId[idx] = abs;
      this.triggered[idx] = 0;
      this.suppressed[idx] = 0;
    }
    return idx;
  }

  addTriggered(nowMs: number): void {
    this.triggered[this.touch(nowMs)] += 1;
  }

  addSuppressed(nowMs: number): void {
    this.suppressed[this.touch(nowMs)] += 1;
  }

  read(nowMs: number): SfxRateCount {
    const abs = Math.floor(nowMs / BUCKET_MS);
    let triggered = 0;
    let suppressed = 0;
    for (let i = 0; i < BUCKET_COUNT; i++) {
      const id = this.bucketId[i];
      if (id >= 0 && abs - id < BUCKET_COUNT) {
        triggered += this.triggered[i];
        suppressed += this.suppressed[i];
      }
    }
    return { triggered, suppressed };
  }
}

/**
 * Per-event loop-guard bookkeeping. Separate from the diagnostic RollingCounter
 * so the escalation and quiet-gap reset are exact rather than bucket-quantized.
 */
interface LoopGuardState {
  winStart: number;       // start of the current tumbling suppression window
  firstSuppress: number;  // first suppression timestamp in-window (-1 = none)
  lastSuppress: number;   // last suppression timestamp in-window
  suppressedInWin: number;
  lastAttempt: number;    // last admit() call for this event (-1 = none) — for quiet-gap reset
  multiplier: number;     // effective-interval multiplier; 1 = idle, >=STEP = engaged
  engaged: boolean;
  engageCount: number;    // LIFETIME times this event's guard has engaged
  warned: boolean;        // console.warn fired once this session
}

function createLoopGuard(): LoopGuardState {
  return {
    winStart: 0,
    firstSuppress: -1,
    lastSuppress: -1,
    suppressedInWin: 0,
    lastAttempt: -1,
    multiplier: 1,
    engaged: false,
    engageCount: 0,
    warned: false
  };
}

function warnLoopGuard(event: SfxEvent): void {
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn(`sfx loop guard engaged: ${event} — a call site is retriggering every frame`);
  }
}

/**
 * Per-event minimum-retrigger gate with rolling diagnostics AND a loop guard.
 * Pure and time-injected: `admit(event, nowMs)` returns whether the trigger
 * should sound and records it. The engine calls this at its single `play()`
 * choke point; the decision logic is unit-tested here without an AudioContext.
 */
export class SfxRateLimiter {
  private readonly intervals: Partial<Record<SfxEvent, number>>;
  private readonly lastPlayMs = new Map<SfxEvent, number>();
  private readonly counters = new Map<SfxEvent, RollingCounter>();
  private readonly guards = new Map<SfxEvent, LoopGuardState>();

  constructor(intervals: Partial<Record<SfxEvent, number>> = SFX_MIN_RETRIGGER_MS) {
    this.intervals = intervals;
  }

  /**
   * @returns true if the event may sound now (records a trigger); false if it is
   * still inside its (possibly loop-escalated) minimum retrigger window (records
   * a suppression, drop it).
   */
  admit(event: SfxEvent, nowMs: number): boolean {
    const base = this.intervals[event] ?? 0;
    const guard = this.guard(event);

    // Quiet-gap reset FIRST: a long gap in ATTEMPTS means the loop (or the burst)
    // has stopped, so the event returns to a clean, responsive floor.
    if (guard.lastAttempt >= 0 && nowMs - guard.lastAttempt >= LOOP_GUARD_QUIET_RESET_MS) {
      guard.winStart = nowMs;
      guard.firstSuppress = -1;
      guard.lastSuppress = -1;
      guard.suppressedInWin = 0;
      guard.multiplier = 1;
      guard.engaged = false;
    } else if (!guard.engaged && nowMs - guard.winStart >= LOOP_GUARD_WINDOW_MS) {
      // Tumble the (idle) counting window so slow, legitimate suppression (e.g.
      // the ledger digit-drift) can never accumulate to K over a long span.
      guard.winStart = nowMs;
      guard.firstSuppress = -1;
      guard.lastSuppress = -1;
      guard.suppressedInWin = 0;
    }
    guard.lastAttempt = nowMs;

    const effInterval = base > 0 ? Math.min(LOOP_GUARD_MAX_INTERVAL_MS, base * guard.multiplier) : 0;
    const last = this.lastPlayMs.get(event);

    if (effInterval > 0 && last !== undefined && nowMs - last < effInterval) {
      this.counter(event).addSuppressed(nowMs);
      guard.suppressedInWin += 1;
      if (guard.firstSuppress < 0) guard.firstSuppress = nowMs;
      guard.lastSuppress = nowMs;
      // A loop is SUSTAINED suppression: K attempts clipped, spread over time.
      if (
        !guard.engaged
        && guard.suppressedInWin >= LOOP_GUARD_MIN_SUPPRESSED
        && guard.lastSuppress - guard.firstSuppress >= LOOP_GUARD_MIN_SPAN_MS
      ) {
        guard.engaged = true;
        guard.multiplier = LOOP_GUARD_STEP;
        guard.engageCount += 1;
        if (!guard.warned) {
          guard.warned = true;
          warnLoopGuard(event);
        }
      }
      return false;
    }

    this.lastPlayMs.set(event, nowMs);
    this.counter(event).addTriggered(nowMs);
    // Each blip that slips through a still-running loop escalates the interval
    // further (x STEP, up to the cap) so the metronome collapses to a rare blip.
    if (guard.engaged && base > 0 && base * guard.multiplier < LOOP_GUARD_MAX_INTERVAL_MS) {
      guard.multiplier *= LOOP_GUARD_STEP;
    }
    return true;
  }

  /** Per-event triggered/suppressed counts over the trailing rolling window. */
  snapshot(nowMs: number): Partial<Record<SfxEvent, SfxRateCount>> {
    const out: Partial<Record<SfxEvent, SfxRateCount>> = {};
    for (const [event, counter] of this.counters) {
      const count = counter.read(nowMs);
      if (count.triggered > 0 || count.suppressed > 0) out[event] = count;
    }
    return out;
  }

  /** One-line human-readable diagnostic for the on-device console accessor. */
  describe(nowMs: number): string {
    const snap = this.snapshot(nowMs);
    const rows = Object.entries(snap);
    const rate = rows.length === 0
      ? `sfx-rate: quiet (last ${WINDOW_MS / 1000}s)`
      : `sfx-rate (last ${WINDOW_MS / 1000}s): ${rows
        .map(([event, c]) => `${event} ${c?.triggered}✓/${c?.suppressed}✗`)
        .join(' | ')}`;
    const guard = this.loopGuardSummary(nowMs);
    return guard ? `${rate} || ${guard}` : rate;
  }

  private loopGuardSummary(nowMs: number): string {
    const parts: string[] = [];
    for (const [event, guard] of this.guards) {
      if (guard.engageCount === 0) continue;
      const active = guard.engaged
        && guard.lastAttempt >= 0
        && nowMs - guard.lastAttempt < LOOP_GUARD_QUIET_RESET_MS;
      parts.push(`${event}${active ? ' ENGAGED' : ''}×${guard.engageCount}`);
    }
    return parts.length === 0 ? '' : `loop-guard: ${parts.join(', ')}`;
  }

  private counter(event: SfxEvent): RollingCounter {
    let counter = this.counters.get(event);
    if (!counter) {
      counter = new RollingCounter();
      this.counters.set(event, counter);
    }
    return counter;
  }

  private guard(event: SfxEvent): LoopGuardState {
    let guard = this.guards.get(event);
    if (!guard) {
      guard = createLoopGuard();
      this.guards.set(event, guard);
    }
    return guard;
  }
}
