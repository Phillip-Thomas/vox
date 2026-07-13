// Pause-aware wall clock for Story DOM text.
//
// The R3F director advances on frame delta, while captions/audit lines used to
// age against raw performance.now(). Keeping the pause offset here makes both
// clocks agree: opening Pause freezes reveal/fade/TTL without changing the
// browser clock or the sandbox world clock.

let paused = false;
let pausedAtMs = 0;
let pausedDurationMs = 0;

function rawNow(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

export function isStoryPaused(): boolean {
  return paused;
}

export function setStoryPaused(next: boolean, nowMs = rawNow()): void {
  if (next === paused) return;
  if (next) {
    paused = true;
    pausedAtMs = nowMs;
    return;
  }
  pausedDurationMs += Math.max(0, nowMs - pausedAtMs);
  paused = false;
}

export function storyNow(nowMs = rawNow()): number {
  const effectiveNow = paused ? pausedAtMs : nowMs;
  return effectiveNow - pausedDurationMs;
}

/** Test/run reset. Production never rewinds this clock during a live page. */
export function resetStoryClock(): void {
  paused = false;
  pausedAtMs = 0;
  pausedDurationMs = 0;
}
