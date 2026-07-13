import { beforeEach, describe, expect, it } from 'vitest';
import {
  consumeSurvivalRecoveryRequest,
  requestSurvivalRecovery,
  resetSurvivalRecoveryRequest
} from './survivalRecovery.ts';

beforeEach(resetSurvivalRecoveryRequest);

describe('survival recovery request', () => {
  it('is consumed exactly once by the mounted player', () => {
    expect(consumeSurvivalRecoveryRequest()).toBe(false);
    requestSurvivalRecovery();
    expect(consumeSurvivalRecoveryRequest()).toBe(true);
    expect(consumeSurvivalRecoveryRequest()).toBe(false);
  });
});
