import { beforeEach, describe, expect, it, vi } from 'vitest';

const audio = vi.hoisted(() => {
  const clock = { now: 10 as number | null };
  return {
    clock,
    getMusicAudioTime: vi.fn(() => clock.now),
    holdMusicSceneEnvelope: vi.fn((_value: number, atTime?: number) => (
      atTime ?? clock.now
    )),
    scheduleMusicSceneEnvelope: vi.fn((
      _points: unknown,
      atTime?: number,
      _startValue?: number
    ) => atTime ?? clock.now),
    setMusicSceneEnvelopeImmediate: vi.fn()
  };
});

vi.mock('../audio/audioCore.ts', () => audio);

import {
  PRESSURE_SEAL_TOTAL_SECONDS,
  getStoryMusicEnvelopeSnapshot,
  hasSpentStoryMusicEnvelope,
  pressureSealMusicEnvelopeValueAt,
  releaseStoryMusicEnvelope,
  resetStoryMusicEnvelopeForTests,
  setStoryMusicEnvelopePaused,
  settleStoryMusicEnvelope,
  startPressureSealMusicEnvelope
} from './storyMusicEnvelope.ts';

describe('story pressure-seal music envelope', () => {
  beforeEach(() => {
    audio.clock.now = 10;
    resetStoryMusicEnvelopeForTests();
    vi.clearAllMocks();
  });

  it('schedules 40 ms down, exactly 100 ms absent, and 120 ms up', () => {
    expect(startPressureSealMusicEnvelope('boarding:1')).toBe(true);

    expect(audio.scheduleMusicSceneEnvelope).toHaveBeenCalledExactlyOnceWith(
      [
        { offsetSeconds: 0.04, value: 0 },
        { offsetSeconds: 0.14, value: 0 },
        { offsetSeconds: 0.26, value: 1 }
      ],
      10,
      1
    );
    expect(pressureSealMusicEnvelopeValueAt(0.04)).toBe(0);
    expect(pressureSealMusicEnvelopeValueAt(0.14)).toBe(0);
    expect(pressureSealMusicEnvelopeValueAt(0.26)).toBe(1);

    audio.clock.now = 10 + PRESSURE_SEAL_TOTAL_SECONDS;
    expect(getStoryMusicEnvelopeSnapshot()).toMatchObject({
      status: 'complete',
      elapsedSeconds: PRESSURE_SEAL_TOTAL_SECONDS,
      gain: 1
    });
  });

  it('spends each transaction once, including when audio was not unlocked', () => {
    audio.clock.now = null;
    expect(startPressureSealMusicEnvelope('boarding:2')).toBe(true);
    expect(getStoryMusicEnvelopeSnapshot().status).toBe('complete');
    expect(audio.scheduleMusicSceneEnvelope).not.toHaveBeenCalled();

    audio.clock.now = 20;
    expect(startPressureSealMusicEnvelope('boarding:2')).toBe(false);
    expect(hasSpentStoryMusicEnvelope('boarding:2')).toBe(true);
    expect(audio.scheduleMusicSceneEnvelope).not.toHaveBeenCalled();
  });

  it('holds its analytic gain and resumes from the remaining pause-safe points', () => {
    startPressureSealMusicEnvelope('boarding:3');
    audio.clock.now = 10.02;

    setStoryMusicEnvelopePaused(true);

    const holdCall = audio.holdMusicSceneEnvelope.mock.calls[0];
    expect(holdCall?.[0]).toBeCloseTo(0.5);
    expect(holdCall?.[1]).toBe(10.02);
    const pausedSnapshot = getStoryMusicEnvelopeSnapshot();
    expect(pausedSnapshot).toMatchObject({
      status: 'paused',
      paused: true
    });
    expect(pausedSnapshot.elapsedSeconds).toBeCloseTo(0.02);
    expect(pausedSnapshot.gain).toBeCloseTo(0.5);

    audio.clock.now = 20;
    setStoryMusicEnvelopePaused(false);

    const resumeCall = audio.scheduleMusicSceneEnvelope.mock.calls[1];
    expect(resumeCall?.[1]).toBe(20);
    expect(resumeCall?.[2]).toBeCloseTo(0.5);
    const remaining = resumeCall?.[0] as Array<{ offsetSeconds: number; value: number }>;
    expect(remaining.map(point => point.value)).toEqual([0, 0, 1]);
    expect(remaining[0].offsetSeconds).toBeCloseTo(0.02);
    expect(remaining[1].offsetSeconds).toBeCloseTo(0.12);
    expect(remaining[2].offsetSeconds).toBeCloseTo(0.24);
  });

  it('waits while globally paused before beginning the envelope clock', () => {
    setStoryMusicEnvelopePaused(true);
    expect(startPressureSealMusicEnvelope('boarding:4')).toBe(true);
    expect(getStoryMusicEnvelopeSnapshot().status).toBe('pending');
    expect(audio.scheduleMusicSceneEnvelope).not.toHaveBeenCalled();

    setStoryMusicEnvelopePaused(false);
    expect(audio.scheduleMusicSceneEnvelope).toHaveBeenCalledTimes(1);
    expect(getStoryMusicEnvelopeSnapshot().status).toBe('running');
  });

  it('settles hydration without replay and keeps cancellation ownership spent', () => {
    startPressureSealMusicEnvelope('boarding:5');
    releaseStoryMusicEnvelope(0);
    expect(getStoryMusicEnvelopeSnapshot().status).toBe('idle');
    expect(startPressureSealMusicEnvelope('boarding:5')).toBe(false);

    settleStoryMusicEnvelope('boarding:saved');
    expect(getStoryMusicEnvelopeSnapshot()).toMatchObject({
      ownerId: 'boarding:saved',
      status: 'complete',
      gain: 1
    });
    expect(startPressureSealMusicEnvelope('boarding:saved')).toBe(false);
  });
});
