export const DEFAULT_AUTHORED_FRAME_DELTA_CAP_SECONDS = 0.5;

export interface AuthoredFrameTimeOptions {
  paused?: boolean;
  hidden?: boolean;
  maxSeconds?: number;
}

/**
 * Per-sequence foreground clock. The stateless clamp below remains useful for
 * pure calculations, but a live authored sequence must also remember that the
 * page became inactive between two render callbacks. Browsers commonly suspend
 * requestAnimationFrame while hidden, so sampling only the visibility of the
 * returning frame would otherwise repay part of the hidden gap.
 */
export interface AuthoredForegroundClock {
  elapsedSeconds: number;
  interruptionRevision: number;
  resumePending: boolean;
}

let interruptionRevision = 0;
let trackedDocument: Document | null = null;
let trackedWindow: Window | null = null;

function recordForegroundInterruption(): void {
  interruptionRevision += 1;
}

function ensureForegroundInterruptionTracking(): void {
  if (typeof document !== 'undefined'
    && typeof document.addEventListener === 'function'
    && trackedDocument !== document) {
    trackedDocument = document;
    document.addEventListener('visibilitychange', recordForegroundInterruption);
    // Page Lifecycle events cover browser freeze/resume paths where no hidden
    // animation callback is delivered to the scene.
    document.addEventListener('freeze', recordForegroundInterruption);
    document.addEventListener('resume', recordForegroundInterruption);
  }
  if (typeof window !== 'undefined'
    && typeof window.addEventListener === 'function'
    && trackedWindow !== window) {
    trackedWindow = window;
    window.addEventListener('pagehide', recordForegroundInterruption);
    window.addEventListener('pageshow', recordForegroundInterruption);
  }
}

function currentInterruptionRevision(): number {
  ensureForegroundInterruptionTracking();
  return interruptionRevision;
}

export function createAuthoredForegroundClock(
  elapsedSeconds = 0
): AuthoredForegroundClock {
  return {
    elapsedSeconds: Math.max(0, Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0),
    interruptionRevision: currentInterruptionRevision(),
    resumePending: false
  };
}

export function resetAuthoredForegroundClock(
  clock: AuthoredForegroundClock,
  elapsedSeconds = 0
): void {
  clock.elapsedSeconds = Math.max(0, Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0);
  clock.interruptionRevision = currentInterruptionRevision();
  clock.resumePending = false;
}

/**
 * Advances a live sequence only with returned foreground time.
 *
 * A continuously visible 2.4-second degraded frame still contributes the
 * normal bounded 0.5 seconds. A frame after pause, page hide/freeze or BFCache
 * handback contributes zero once, establishing a fresh foreground baseline.
 */
export function advanceAuthoredForegroundClock(
  clock: AuthoredForegroundClock,
  rawSeconds: number,
  options: AuthoredFrameTimeOptions = {}
): number {
  const revision = currentInterruptionRevision();
  const interruptedBetweenFrames = revision !== clock.interruptionRevision;
  clock.interruptionRevision = revision;
  const hidden = options.hidden ?? documentIsHidden();

  if (options.paused || hidden) {
    clock.resumePending = true;
    return 0;
  }
  if (interruptedBetweenFrames || clock.resumePending) {
    clock.resumePending = false;
    return 0;
  }

  const delta = authoredFrameDelta(rawSeconds, { ...options, hidden: false });
  clock.elapsedSeconds += delta;
  return delta;
}

/**
 * Returns foreground render time for authored physical/cinematic sequences.
 *
 * Ordinary frames are unchanged. Severely delayed foreground frames may repay
 * at most a small bounded slice so story progress remains tied to elapsed play
 * rather than rendered-frame count. Pause/visibility loss never advances the
 * sequence, and a long resume gap cannot complete a scene in one frame.
 */
export function authoredFrameDelta(
  rawSeconds: number,
  options: AuthoredFrameTimeOptions = {}
): number {
  if (options.paused || options.hidden || !Number.isFinite(rawSeconds) || rawSeconds <= 0) {
    return 0;
  }
  const configuredMax = options.maxSeconds ?? DEFAULT_AUTHORED_FRAME_DELTA_CAP_SECONDS;
  const maxSeconds = Number.isFinite(configuredMax)
    ? Math.max(0, configuredMax)
    : DEFAULT_AUTHORED_FRAME_DELTA_CAP_SECONDS;
  return Math.min(rawSeconds, maxSeconds);
}

export function documentIsHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState !== 'visible';
}
