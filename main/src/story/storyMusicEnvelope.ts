import {
  getMusicAudioTime,
  holdMusicSceneEnvelope,
  scheduleMusicSceneEnvelope,
  setMusicSceneEnvelopeImmediate,
  type MusicSceneEnvelopePoint
} from '../audio/audioCore.ts';

/** Signed pressure-seal treatment: 40 ms down, 100 ms absent, 120 ms up. */
export const PRESSURE_SEAL_FADE_DOWN_SECONDS = 0.04;
export const PRESSURE_SEAL_SILENCE_SECONDS = 0.1;
export const PRESSURE_SEAL_FADE_UP_SECONDS = 0.12;
export const PRESSURE_SEAL_TOTAL_SECONDS =
  PRESSURE_SEAL_FADE_DOWN_SECONDS
  + PRESSURE_SEAL_SILENCE_SECONDS
  + PRESSURE_SEAL_FADE_UP_SECONDS;

export type StoryMusicEnvelopeStatus =
  | 'idle'
  | 'pending'
  | 'running'
  | 'paused'
  | 'complete';

export interface StoryMusicEnvelopeSnapshot {
  ownerId: string | null;
  status: StoryMusicEnvelopeStatus;
  elapsedSeconds: number;
  gain: number;
  paused: boolean;
}

interface StoryMusicEnvelopeRuntime {
  ownerId: string | null;
  status: StoryMusicEnvelopeStatus;
  elapsedSeconds: number;
  gain: number;
  segmentStartedAt: number | null;
  segmentStartedElapsed: number;
}

const spentOwners = new Set<string>();
const ENVELOPE_TIME_EPSILON = 1e-9;
let paused = false;
let runtime = idleRuntime();

/**
 * Begin one transaction-owned seal envelope. An event reached before audio is
 * unlocked is considered spent and settles at unity; it is never deferred to
 * a later user gesture or replayed after hydration.
 */
export function startPressureSealMusicEnvelope(ownerId: string): boolean {
  const owner = ownerId.trim();
  if (!owner || spentOwners.has(owner)) return false;
  refreshRuntime();
  if (runtime.ownerId && runtime.status !== 'complete' && runtime.status !== 'idle') {
    return false;
  }

  spentOwners.add(owner);
  runtime = {
    ownerId: owner,
    status: paused ? 'pending' : 'running',
    elapsedSeconds: 0,
    gain: 1,
    segmentStartedAt: null,
    segmentStartedElapsed: 0
  };
  if (paused) return true;

  const now = getMusicAudioTime();
  if (now === null || !scheduleRemaining(now)) settleCompletedRuntime();
  return true;
}

/** Pause/resume without advancing the literal 100 ms silence off-clock. */
export function setStoryMusicEnvelopePaused(next: boolean): void {
  if (paused === next) return;
  refreshRuntime();
  paused = next;

  if (next) {
    if (runtime.status !== 'running') return;
    const now = getMusicAudioTime();
    if (now !== null) holdMusicSceneEnvelope(runtime.gain, now);
    runtime.status = 'paused';
    runtime.segmentStartedAt = null;
    runtime.segmentStartedElapsed = runtime.elapsedSeconds;
    return;
  }

  if (runtime.status !== 'paused' && runtime.status !== 'pending') return;
  const now = getMusicAudioTime();
  if (now === null || !scheduleRemaining(now)) settleCompletedRuntime();
}

/**
 * Cancel an in-flight scene rail and restore transparent gain. The transaction
 * remains spent, preventing cancellation/re-entry from manufacturing a second
 * pressure seal.
 */
export function releaseStoryMusicEnvelope(fadeSeconds = 0.12): void {
  refreshRuntime();
  const now = getMusicAudioTime();
  if (now === null || fadeSeconds <= 0) {
    setMusicSceneEnvelopeImmediate(1);
  } else {
    const scheduledAt = scheduleMusicSceneEnvelope(
      [{ offsetSeconds: fadeSeconds, value: 1 }],
      now,
      runtime.gain
    );
    if (scheduledAt === null) setMusicSceneEnvelopeImmediate(1);
  }
  runtime = idleRuntime();
}

/** Reload/hydration seam: represent a completed seal at steady gain, no replay. */
export function settleStoryMusicEnvelope(ownerId?: string): void {
  const owner = ownerId?.trim();
  if (owner) spentOwners.add(owner);
  setMusicSceneEnvelopeImmediate(1);
  runtime = {
    ownerId: owner || null,
    status: 'complete',
    elapsedSeconds: PRESSURE_SEAL_TOTAL_SECONDS,
    gain: 1,
    segmentStartedAt: null,
    segmentStartedElapsed: PRESSURE_SEAL_TOTAL_SECONDS
  };
}

export function hasSpentStoryMusicEnvelope(ownerId: string): boolean {
  return spentOwners.has(ownerId.trim());
}

export function getStoryMusicEnvelopeSnapshot(): StoryMusicEnvelopeSnapshot {
  refreshRuntime();
  return {
    ownerId: runtime.ownerId,
    status: runtime.status,
    elapsedSeconds: runtime.elapsedSeconds,
    gain: runtime.gain,
    paused
  };
}

/** Pure value resolver used to hold a sample-accurate point across pause. */
export function pressureSealMusicEnvelopeValueAt(elapsedSeconds: number): number {
  const elapsed = Math.min(PRESSURE_SEAL_TOTAL_SECONDS, Math.max(0, elapsedSeconds));
  if (elapsed < PRESSURE_SEAL_FADE_DOWN_SECONDS) {
    return 1 - elapsed / PRESSURE_SEAL_FADE_DOWN_SECONDS;
  }
  const silenceEnd = PRESSURE_SEAL_FADE_DOWN_SECONDS + PRESSURE_SEAL_SILENCE_SECONDS;
  if (elapsed < silenceEnd) return 0;
  if (elapsed < PRESSURE_SEAL_TOTAL_SECONDS) {
    return (elapsed - silenceEnd) / PRESSURE_SEAL_FADE_UP_SECONDS;
  }
  return 1;
}

export function resetStoryMusicEnvelopeForTests(): void {
  spentOwners.clear();
  paused = false;
  runtime = idleRuntime();
  setMusicSceneEnvelopeImmediate(1);
}

function scheduleRemaining(now: number): boolean {
  const elapsed = runtime.elapsedSeconds;
  if (elapsed >= PRESSURE_SEAL_TOTAL_SECONDS) return false;
  const points = remainingPressureSealPoints(elapsed);
  const startedAt = scheduleMusicSceneEnvelope(
    points,
    now,
    pressureSealMusicEnvelopeValueAt(elapsed)
  );
  if (startedAt === null) return false;
  runtime.status = 'running';
  runtime.segmentStartedAt = startedAt;
  runtime.segmentStartedElapsed = elapsed;
  runtime.gain = pressureSealMusicEnvelopeValueAt(elapsed);
  return true;
}

function remainingPressureSealPoints(elapsedSeconds: number): MusicSceneEnvelopePoint[] {
  const elapsed = Math.min(PRESSURE_SEAL_TOTAL_SECONDS, Math.max(0, elapsedSeconds));
  const silenceEnd = PRESSURE_SEAL_FADE_DOWN_SECONDS + PRESSURE_SEAL_SILENCE_SECONDS;
  const points: MusicSceneEnvelopePoint[] = [];
  if (elapsed < PRESSURE_SEAL_FADE_DOWN_SECONDS) {
    points.push({
      offsetSeconds: PRESSURE_SEAL_FADE_DOWN_SECONDS - elapsed,
      value: 0
    });
  }
  if (elapsed < silenceEnd) {
    points.push({ offsetSeconds: silenceEnd - elapsed, value: 0 });
  }
  if (elapsed < PRESSURE_SEAL_TOTAL_SECONDS) {
    points.push({
      offsetSeconds: PRESSURE_SEAL_TOTAL_SECONDS - elapsed,
      value: 1
    });
  }
  return points;
}

function refreshRuntime(): void {
  if (runtime.status !== 'running' || runtime.segmentStartedAt === null) return;
  const now = getMusicAudioTime();
  if (now === null) return;
  const elapsed = runtime.segmentStartedElapsed + Math.max(0, now - runtime.segmentStartedAt);
  runtime.elapsedSeconds = elapsed >= PRESSURE_SEAL_TOTAL_SECONDS - ENVELOPE_TIME_EPSILON
    ? PRESSURE_SEAL_TOTAL_SECONDS
    : Math.min(PRESSURE_SEAL_TOTAL_SECONDS, elapsed);
  runtime.gain = pressureSealMusicEnvelopeValueAt(runtime.elapsedSeconds);
  if (runtime.elapsedSeconds >= PRESSURE_SEAL_TOTAL_SECONDS) settleCompletedRuntime();
}

function settleCompletedRuntime(): void {
  setMusicSceneEnvelopeImmediate(1);
  runtime.status = 'complete';
  runtime.elapsedSeconds = PRESSURE_SEAL_TOTAL_SECONDS;
  runtime.gain = 1;
  runtime.segmentStartedAt = null;
  runtime.segmentStartedElapsed = PRESSURE_SEAL_TOTAL_SECONDS;
}

function idleRuntime(): StoryMusicEnvelopeRuntime {
  return {
    ownerId: null,
    status: 'idle',
    elapsedSeconds: 0,
    gain: 1,
    segmentStartedAt: null,
    segmentStartedElapsed: 0
  };
}
