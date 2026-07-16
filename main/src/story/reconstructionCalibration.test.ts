import { beforeEach, describe, expect, it } from 'vitest';
import { resetProgression } from '../game/systems/progressionSystem.ts';
import {
  RECONSTRUCTION_CALIBRATION_SECONDS,
  beginReconstructionCalibration,
  getReconstructionCalibrationSnapshot,
  hasReconstructionCalibrationReceipt,
  resetReconstructionCalibrationRuntime,
  sampleReconstructionCalibrationFrame,
  tickReconstructionCalibration
} from './reconstructionCalibration.ts';

beforeEach(() => {
  resetProgression();
  resetReconstructionCalibrationRuntime();
});

describe('physical reconstruction calibration', () => {
  it('starts only after the origin flight-ready grounded-return transaction', () => {
    const base = {
      actorId: 'local',
      worldId: '-1,-1',
      storyBeat: 'ch7-reconstruct' as const,
      repairStage: 'flight_ready' as const,
      groundedReturnComplete: true
    };
    expect(beginReconstructionCalibration({ ...base, worldId: '-1,-1:p1' })).toBe(false);
    expect(beginReconstructionCalibration({ ...base, groundedReturnComplete: false })).toBe(false);
    expect(beginReconstructionCalibration(base)).toBe(true);
    expect(getReconstructionCalibrationSnapshot().phase).toBe('running');
  });

  it('is pause-safe and commits only after the full eight-second reveal', () => {
    expect(beginReconstructionCalibration({
      actorId: 'local',
      worldId: '-1,-1',
      storyBeat: 'ch7-reconstruct',
      repairStage: 'flight_ready',
      groundedReturnComplete: true
    })).toBe(true);
    tickReconstructionCalibration({ dt: 1, paused: true, focused: true });
    expect(getReconstructionCalibrationSnapshot().elapsed).toBe(0);
    for (let index = 0; index < RECONSTRUCTION_CALIBRATION_SECONDS * 10 - 1; index++) {
      tickReconstructionCalibration({ dt: 0.1, paused: false, focused: true });
    }
    expect(hasReconstructionCalibrationReceipt('local')).toBe(false);
    expect(tickReconstructionCalibration({ dt: 0.1, paused: false, focused: true })).toBe(true);
    expect(hasReconstructionCalibrationReceipt('local')).toBe(true);
    expect(getReconstructionCalibrationSnapshot().phase).toBe('complete');
  });

  it('uses a traveling spine reveal and a fixed reduced-motion equivalent', () => {
    const early = sampleReconstructionCalibrationFrame(1, false);
    const late = sampleReconstructionCalibrationFrame(6, false);
    expect(early.fov).toBe(52);
    expect(late.eyeLocal).not.toEqual(early.eyeLocal);
    const reducedEarly = sampleReconstructionCalibrationFrame(1, true);
    const reducedLate = sampleReconstructionCalibrationFrame(6, true);
    expect(reducedLate.eyeLocal).toEqual(reducedEarly.eyeLocal);
    expect(reducedLate.targetLocal).toEqual(reducedEarly.targetLocal);
  });
});
