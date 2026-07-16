import { beforeEach, describe, expect, it } from 'vitest';
import {
  commitStoryJetInstalled,
  commitStoryOxygenOnline,
  isStoryJetInstalled,
  isStoryOxygenOnline,
  nextShipRepairStage,
  resolveEmergentCapability,
  type EmergentCapabilityFacts
} from './emergentCapabilities.ts';
import { markMilestone, resetProgression } from '../game/systems/progressionSystem.ts';

const facts = (overrides: Partial<EmergentCapabilityFacts> = {}): EmergentCapabilityFacts => ({
  oxygenSystemOnline: false,
  mawRepaired: false,
  jetInstalled: false,
  shipRepairStage: 'wrecked',
  tidegardenRouteOnline: false,
  activeStationIds: [],
  habitatCoreOnline: false,
  shelterCertified: false,
  ...overrides
});

describe('emergent capability gates', () => {
  beforeEach(() => resetProgression());

  it('requires both flight readiness and the one route event for local travel', () => {
    expect(resolveEmergentCapability('local_travel', facts()).missing).toEqual([
      'ship-not-flight-ready',
      'tidegarden-route-offline'
    ]);
    expect(resolveEmergentCapability('local_travel', facts({
      shipRepairStage: 'flight_ready',
      tidegardenRouteOnline: true
    })).enabled).toBe(true);
  });

  it('keeps station knowledge separate from station proximity/activation', () => {
    expect(resolveEmergentCapability('station:assembler', facts({
      activeStationIds: ['smelter']
    }))).toEqual({ enabled: false, missing: ['station-offline:assembler'] });
  });

  it('requires the core and a certified shelter for habitat completion', () => {
    expect(resolveEmergentCapability('habitat_certification', facts({
      habitatCoreOnline: true
    })).missing).toEqual(['shelter-not-certified']);
  });

  it('defines one non-skippable repair sequence', () => {
    expect(nextShipRepairStage('wrecked')).toBe('bench_online');
    expect(nextShipRepairStage('lift_online')).toBe('flight_ready');
    expect(nextShipRepairStage('flight_ready')).toBeNull();
  });

  it('keeps sandbox oxygen and jet systemic but requires authored receipts in Story', () => {
    expect(isStoryOxygenOnline()).toBe(true);
    expect(isStoryJetInstalled()).toBe(true);

    markMilestone('story:started');
    expect(isStoryOxygenOnline()).toBe(false);
    expect(isStoryJetInstalled()).toBe(false);

    expect(commitStoryOxygenOnline()).toBe(true);
    expect(commitStoryOxygenOnline()).toBe(false);
    expect(commitStoryJetInstalled()).toBe(true);
    expect(commitStoryJetInstalled()).toBe(false);
    expect(isStoryOxygenOnline()).toBe(true);
    expect(isStoryJetInstalled()).toBe(true);
  });
});
