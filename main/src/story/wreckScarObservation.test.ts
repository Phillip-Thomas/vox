import { beforeEach, describe, expect, it } from 'vitest';
import { getAccomplishment, resetAccomplishments } from '../game/systems/accomplishmentLedger.ts';
import { getObservation, resetObservations } from '../game/systems/observationLedger.ts';
import {
  WRECK_SCAR_ACCOMPLISHMENT_ID,
  WRECK_SCAR_OBSERVATION_ID,
  attendWreckScar,
  canAttendWreckScar
} from './wreckScarObservation.ts';

beforeEach(() => {
  resetObservations();
  resetAccomplishments();
});

describe('optional persistent wreck-scar observation', () => {
  it('records distinct persisted stages without gating and awards only the third', () => {
    expect(canAttendWreckScar('wrecked', 'local')).toBe(true);
    expect(attendWreckScar('wrecked', 'local')).toMatchObject({
      observed: true,
      distinctStages: 1,
      accomplished: false
    });
    expect(canAttendWreckScar('wrecked', 'local')).toBe(false);
    expect(canAttendWreckScar('frame_restored', 'local')).toBe(true);
    expect(attendWreckScar('wrecked', 'local')).toMatchObject({
      observed: false,
      distinctStages: 1,
      accomplished: false
    });
    expect(attendWreckScar('frame_restored', 'local').distinctStages).toBe(2);
    expect(attendWreckScar('flight_ready', 'local')).toMatchObject({
      distinctStages: 3,
      accomplished: true
    });
    expect(getObservation(WRECK_SCAR_OBSERVATION_ID, 'local')?.evidenceHistory).toHaveLength(3);
    expect(getAccomplishment(WRECK_SCAR_ACCOMPLISHMENT_ID, 'local')).toBeDefined();
    expect(canAttendWreckScar('hull_sealed', 'local')).toBe(false);
  });

  it('refuses the authored origin observation on another world', () => {
    expect(canAttendWreckScar('wrecked', 'local', { worldId: '-1,-1:p1' })).toBe(false);
    expect(attendWreckScar('wrecked', 'local', '-1,-1:p1').observed).toBe(false);
    expect(getObservation(WRECK_SCAR_OBSERVATION_ID, 'local')).toBeUndefined();
  });

  it('yields the shared interaction prompt to a required reconstruction action', () => {
    expect(canAttendWreckScar('bench_online', 'local', {
      requiredInteractionActive: true
    })).toBe(false);
    expect(canAttendWreckScar('bench_online', 'local', {
      requiredInteractionActive: false
    })).toBe(true);
  });
});
