import { describe, expect, it, vi } from 'vitest';
import { SfxRateLimiter, SFX_MIN_RETRIGGER_MS } from './sfxRateLimiter.ts';

describe('SfxRateLimiter', () => {
  it('collapses many same-frame triggers into one audible voice', () => {
    const limiter = new SfxRateLimiter();
    const t = 1000;
    // 40 nodes collected in one frame -> one clock reading.
    let admitted = 0;
    for (let i = 0; i < 40; i++) {
      if (limiter.admit('mine', t)) admitted += 1;
    }
    expect(admitted).toBe(1);

    const snap = limiter.snapshot(t);
    expect(snap.mine).toEqual({ triggered: 1, suppressed: 39 });
  });

  it('bounds a brief burst to the retrigger floor (below the loop guard)', () => {
    const limiter = new SfxRateLimiter({ mine: 100 });
    let admitted = 0;
    // Spam every 10 ms for 200 ms — enough to prove the floor, short of the
    // sustained-suppression signature the loop guard needs (18 suppressions,
    // ~180 ms span: under both the count and span thresholds).
    for (let t = 0; t <= 200; t += 10) {
      if (limiter.admit('mine', t)) admitted += 1;
    }
    // With a 100 ms floor, at most one per 100 ms window: t=0,100,200 -> 3.
    expect(admitted).toBe(3);
    expect(limiter.describe(200)).not.toContain('loop-guard');
  });

  it('lets a trigger through once the interval has elapsed', () => {
    const limiter = new SfxRateLimiter({ mine: 110 });
    expect(limiter.admit('mine', 0)).toBe(true);
    expect(limiter.admit('mine', 109)).toBe(false); // still inside window
    expect(limiter.admit('mine', 110)).toBe(true); // boundary clears
    expect(limiter.admit('mine', 150)).toBe(false);
    expect(limiter.admit('mine', 220)).toBe(true);
  });

  it('gates each event independently', () => {
    const limiter = new SfxRateLimiter({ mine: 100, terminalKey: 100 });
    expect(limiter.admit('mine', 0)).toBe(true);
    // A different event at the same instant is unaffected by mine's window.
    expect(limiter.admit('terminalKey', 0)).toBe(true);
    expect(limiter.admit('mine', 10)).toBe(false);
    expect(limiter.admit('terminalKey', 10)).toBe(false);
    expect(limiter.admit('terminalKey', 100)).toBe(true);
  });

  it('leaves unlisted (interval 0) events completely ungated', () => {
    const limiter = new SfxRateLimiter({ mine: 100 });
    // `jump` is not in this table (and stays unlisted in production) -> never
    // suppressed, so the suppression-based loop guard never even sees it.
    let admitted = 0;
    for (let i = 0; i < 5; i++) {
      if (limiter.admit('jump', 500)) admitted += 1;
    }
    expect(admitted).toBe(5);
    expect(limiter.snapshot(500).jump).toEqual({ triggered: 5, suppressed: 0 });
  });

  it('respects the per-event interval table it is constructed with', () => {
    const fast = new SfxRateLimiter({ mine: 20 });
    const slow = new SfxRateLimiter({ mine: 500 });
    // Same call pattern, different tables -> different admit counts.
    const pattern = [0, 30, 60, 90, 120];
    const count = (l: SfxRateLimiter) =>
      pattern.reduce((n, t) => n + (l.admit('mine', t) ? 1 : 0), 0);
    expect(count(fast)).toBe(5); // every call clears the 20 ms floor
    expect(count(slow)).toBe(1); // only the first clears the 500 ms floor
  });

  it('expires counts out of the trailing rolling window', () => {
    const limiter = new SfxRateLimiter({ mine: 0 });
    limiter.admit('mine', 0);
    limiter.admit('mine', 0);
    expect(limiter.snapshot(0).mine).toEqual({ triggered: 2, suppressed: 0 });
    // Read far beyond the 3 s window -> the old bucket has aged out.
    expect(limiter.snapshot(10_000).mine).toBeUndefined();
  });

  it('ships floors for the machine-gun and per-frame-reachable cues, not one-shots', () => {
    // Dense proximity/pickup cues.
    expect(SFX_MIN_RETRIGGER_MS.mine).toBeGreaterThan(0);
    expect(SFX_MIN_RETRIGGER_MS.terminalKey).toBeGreaterThan(0);
    // Per-frame-reachable cues now carry a conservative floor so the loop
    // detector (which is blind to interval-0 events) covers them uniformly.
    expect(SFX_MIN_RETRIGGER_MS.blocked).toBeGreaterThan(0);
    expect(SFX_MIN_RETRIGGER_MS.terminalAdvance).toBeGreaterThan(0);
    // Genuinely one-shot events stay ungated.
    expect(SFX_MIN_RETRIGGER_MS.jump).toBeUndefined();
    expect(SFX_MIN_RETRIGGER_MS.storyAwaken).toBeUndefined();
  });

  it('describe() summarizes activity and reports quiet when idle', () => {
    const limiter = new SfxRateLimiter({ mine: 100 });
    expect(limiter.describe(0)).toContain('quiet');
    limiter.admit('mine', 0);
    limiter.admit('mine', 10);
    const line = limiter.describe(10);
    expect(line).toContain('mine');
    expect(line).toContain('1'); // 1 triggered
  });
});

describe('SfxRateLimiter loop guard', () => {
  it('engages on a per-frame loop <1 s, collapses output, warns once, resets on a quiet gap', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const limiter = new SfxRateLimiter({ mine: 110 });
      let admitted = 0;
      let engagedAt = -1;
      // Attempt every 16 ms (a 60 fps level-triggered loop) for 1000 ms.
      for (let t = 0; t <= 1000; t += 16) {
        if (limiter.admit('mine', t)) admitted += 1;
        if (engagedAt < 0 && limiter.describe(t).includes('loop-guard')) engagedAt = t;
      }
      expect(engagedAt).toBeGreaterThan(0);
      expect(engagedAt).toBeLessThan(1000); // engages well under a second
      // Un-guarded, a 110 ms floor would pass ~9; the guard collapses it far below.
      expect(admitted).toBeLessThan(8);
      expect(warn).toHaveBeenCalledTimes(1); // one warn per event per session
      expect(String(warn.mock.calls[0][0])).toContain('mine');
      expect(limiter.describe(1000)).toContain('loop-guard');

      // A quiet gap (> reset) drops the guard: the event is responsive again.
      expect(limiter.admit('mine', 1900)).toBe(true);
      expect(limiter.admit('mine', 2100)).toBe(true); // 200 ms >= the 110 ms floor
    } finally {
      warn.mockRestore();
    }
  });

  it('does NOT engage on a dense same-frame burst (many suppressions, zero span)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const limiter = new SfxRateLimiter({ mine: 110 });
      let admitted = 0;
      for (let i = 0; i < 40; i++) {
        if (limiter.admit('mine', 1000)) admitted += 1;
      }
      expect(admitted).toBe(1); // 39 suppressed, but all at one instant
      expect(warn).not.toHaveBeenCalled();
      expect(limiter.describe(1000)).not.toContain('loop-guard');
    } finally {
      warn.mockRestore();
    }
  });

  it('does NOT engage on the ledger digit-drift cadence (70 ms attempts, 90 ms floor, 3 s)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const limiter = new SfxRateLimiter({ terminalKey: 90 });
      for (let t = 0; t <= 3000; t += 70) limiter.admit('terminalKey', t);
      expect(warn).not.toHaveBeenCalled();
      expect(limiter.describe(3000)).not.toContain('loop-guard');
    } finally {
      warn.mockRestore();
    }
  });

  it('keeps the guard independent across events', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const limiter = new SfxRateLimiter({ mine: 110, terminalKey: 90 });
      // mine loops every 16 ms; terminalKey fires only twice.
      for (let t = 0; t <= 1000; t += 16) {
        limiter.admit('mine', t);
        if (t === 0 || t === 512) limiter.admit('terminalKey', t);
      }
      const line = limiter.describe(1000);
      expect(line).toContain('loop-guard');
      expect(line).toContain('mine ENGAGED'); // the looping event is guarded
      // terminalKey never looped -> it is never guard-escalated; still responsive.
      expect(limiter.admit('terminalKey', 1000)).toBe(true);
    } finally {
      warn.mockRestore();
    }
  });

  it('surfaces engaged state and lifetime engage count in describe()', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const limiter = new SfxRateLimiter({ mine: 110 });
      for (let t = 0; t <= 700; t += 16) limiter.admit('mine', t);
      const engaged = limiter.describe(700);
      expect(engaged).toContain('loop-guard: mine ENGAGED×1');

      // After a quiet gap the guard is no longer ENGAGED, but its lifetime count
      // persists (still visible in the field diagnostic).
      limiter.admit('mine', 2000);
      const afterReset = limiter.describe(2000);
      expect(afterReset).toContain('mine×1');
      expect(afterReset).not.toContain('mine ENGAGED');
    } finally {
      warn.mockRestore();
    }
  });
});
