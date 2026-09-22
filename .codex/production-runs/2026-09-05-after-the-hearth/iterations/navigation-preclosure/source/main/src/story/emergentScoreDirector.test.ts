import { beforeEach, describe, expect, it, vi } from 'vitest';

const score = vi.hoisted(() => ({
  clearStoryScoreMoodOverride: vi.fn(),
  getChapter7BoardingScoreMood: vi.fn((variant: string) => ({ variant })),
  getChapter7ReconstructionScoreMood: vi.fn((variant: string) => ({ variant })),
  setStoryScoreMoodOverride: vi.fn()
}));

const envelope = vi.hoisted(() => ({
  PRESSURE_SEAL_FADE_UP_SECONDS: 0.12,
  getStoryMusicEnvelopeSnapshot: vi.fn(() => ({
    ownerId: null,
    status: 'idle',
    elapsedSeconds: 0,
    gain: 1,
    paused: false
  })),
  releaseStoryMusicEnvelope: vi.fn(),
  resetStoryMusicEnvelopeForTests: vi.fn(),
  setStoryMusicEnvelopePaused: vi.fn(),
  settleStoryMusicEnvelope: vi.fn(),
  startPressureSealMusicEnvelope: vi.fn(() => true)
}));

vi.mock('./storyScore.ts', () => score);
vi.mock('./storyMusicEnvelope.ts', () => envelope);

import {
  completeChapter7Calibration,
  enterEmergentScoreBeat,
  getEmergentScoreMixSnapshot,
  getEmergentScoreSnapshot,
  hydrateChapter7BoardingScore,
  noteChapter7FirstHover,
  noteChapter7GroundedReturn,
  resetEmergentScoreDirectorForTests,
  resolveChapter7ReconstructionScoreVariant,
  setChapter7BoardingPhase,
  setChapter7RepairStage,
  setEmergentScorePaused,
  startChapter7Calibration,
  syncChapter7ReconstructionScore,
  type Chapter7ReconstructionScoreFacts
} from './emergentScoreDirector.ts';

const FLIGHT_READY: Chapter7ReconstructionScoreFacts = {
  repairStage: 'flight_ready',
  firstHoverComplete: true,
  groundedReturnComplete: true,
  calibrationState: 'none'
};

function lastScoreVariant(): string | undefined {
  const calls = score.setStoryScoreMoodOverride.mock.calls;
  const mood = calls[calls.length - 1]?.[1] as
    | { variant?: string }
    | undefined;
  return mood?.variant;
}

describe('emergent chapter 7 score director', () => {
  beforeEach(() => {
    resetEmergentScoreDirectorForTests();
    vi.clearAllMocks();
  });

  it('derives the last legal cumulative state from durable gameplay facts', () => {
    expect(resolveChapter7ReconstructionScoreVariant({
      ...FLIGHT_READY,
      repairStage: 'wrecked'
    })).toBe('diagnosis');
    expect(resolveChapter7ReconstructionScoreVariant({
      ...FLIGHT_READY,
      repairStage: 'bench_online'
    })).toBe('bench');
    expect(resolveChapter7ReconstructionScoreVariant({
      ...FLIGHT_READY,
      repairStage: 'frame_restored'
    })).toBe('frame');
    expect(resolveChapter7ReconstructionScoreVariant({
      ...FLIGHT_READY,
      repairStage: 'hull_sealed'
    })).toBe('hull');
    expect(resolveChapter7ReconstructionScoreVariant({
      ...FLIGHT_READY,
      repairStage: 'lift_online',
      firstHoverComplete: false
    })).toBe('lift');
    expect(resolveChapter7ReconstructionScoreVariant({
      ...FLIGHT_READY,
      groundedReturnComplete: false
    })).toBe('route');
    expect(resolveChapter7ReconstructionScoreVariant({
      ...FLIGHT_READY,
      firstHoverComplete: false,
      groundedReturnComplete: false
    })).toBe('route');
    expect(resolveChapter7ReconstructionScoreVariant(FLIGHT_READY)).toBe('route');
    expect(resolveChapter7ReconstructionScoreVariant({
      ...FLIGHT_READY,
      calibrationState: 'complete'
    })).toBe('calibration');
  });

  it('retunes only when the derived reconstruction state changes', () => {
    expect(enterEmergentScoreBeat('ch7-reconstruct')).toBe(true);
    expect(lastScoreVariant()).toBe('diagnosis');

    expect(setChapter7RepairStage('bench_online')).toBe('bench');
    expect(lastScoreVariant()).toBe('bench');
    setChapter7RepairStage('bench_online');
    expect(score.setStoryScoreMoodOverride).toHaveBeenCalledTimes(2);

    setChapter7RepairStage('flight_ready');
    expect(lastScoreVariant()).toBe('route');
    noteChapter7FirstHover();
    expect(lastScoreVariant()).toBe('route');
    noteChapter7GroundedReturn();
    expect(lastScoreVariant()).toBe('route');
    startChapter7Calibration();
    expect(lastScoreVariant()).toBe('calibration');

    const callsBeforeCompletion = score.setStoryScoreMoodOverride.mock.calls.length;
    completeChapter7Calibration();
    expect(score.setStoryScoreMoodOverride).toHaveBeenCalledTimes(callsBeforeCompletion);
  });

  it('hydrates directly to a legal steady variant without replaying intermediate states', () => {
    enterEmergentScoreBeat('ch7-reconstruct', {
      ...FLIGHT_READY,
      calibrationState: 'complete'
    });

    expect(score.setStoryScoreMoodOverride).toHaveBeenCalledTimes(1);
    expect(lastScoreVariant()).toBe('calibration');
    expect(getEmergentScoreSnapshot().reconstructionFacts).toEqual({
      ...FLIGHT_READY,
      calibrationState: 'complete'
    });

    syncChapter7ReconstructionScore(FLIGHT_READY);
    expect(lastScoreVariant()).toBe('route');
  });

  it('maps boarding ownership phases, gates ship hum, and emits one live seal', () => {
    enterEmergentScoreBeat('ch7-board');
    expect(lastScoreVariant()).toBe('outside');
    expect(getEmergentScoreMixSnapshot()).toEqual({
      shipHumMultiplier: 0,
      shipHumSlewSeconds: 0.12
    });

    setChapter7BoardingPhase('hatch-entered');
    expect(lastScoreVariant()).toBe('hatch');
    setChapter7BoardingPhase('vehicle-owner');
    expect(lastScoreVariant()).toBe('vehicle-owner');

    setChapter7BoardingPhase('cockpit-sealed', {
      live: true,
      transactionId: 'tx-7'
    });
    setChapter7BoardingPhase('cockpit-sealed', {
      live: true,
      transactionId: 'tx-7'
    });
    expect(lastScoreVariant()).toBe('cockpit');
    expect(envelope.startPressureSealMusicEnvelope).toHaveBeenCalledExactlyOnceWith(
      'ch7-board:pressure-seal:tx-7'
    );
    expect(getEmergentScoreMixSnapshot().shipHumMultiplier).toBe(1);

    setChapter7BoardingPhase('cancelled');
    expect(envelope.releaseStoryMusicEnvelope).toHaveBeenCalledTimes(1);
    expect(lastScoreVariant()).toBe('outside');
    expect(getEmergentScoreMixSnapshot().shipHumMultiplier).toBe(0);
  });

  it('hydrates a sealed cockpit at unity and releases ownership on beat exit', () => {
    enterEmergentScoreBeat('ch7-board');
    hydrateChapter7BoardingScore({ sealed: true, transactionId: 'saved-8' });

    expect(envelope.settleStoryMusicEnvelope).toHaveBeenCalledExactlyOnceWith(
      'ch7-board:pressure-seal:saved-8'
    );
    expect(envelope.startPressureSealMusicEnvelope).not.toHaveBeenCalled();
    expect(lastScoreVariant()).toBe('cockpit');
    expect(getEmergentScoreMixSnapshot().shipHumMultiplier).toBe(1);

    expect(enterEmergentScoreBeat('ch8-launch')).toBe(false);
    expect(score.clearStoryScoreMoodOverride).toHaveBeenCalledWith('ch7-board');
    expect(envelope.releaseStoryMusicEnvelope).toHaveBeenCalledTimes(1);
    expect(getEmergentScoreMixSnapshot()).toEqual({
      shipHumMultiplier: 1,
      shipHumSlewSeconds: null
    });
  });

  it('forwards pause state to the independent scene envelope', () => {
    setEmergentScorePaused(true);
    setEmergentScorePaused(false);
    expect(envelope.setStoryMusicEnvelopePaused.mock.calls).toEqual([[true], [false]]);
  });
});
