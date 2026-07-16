import { beforeEach, describe, expect, it } from 'vitest';
import { addItem, getItemCount, resetInventory } from '../game/systems/inventorySystem.ts';
import { hasMilestone, markMilestone, resetProgression } from '../game/systems/progressionSystem.ts';
import { listAccomplishments, resetAccomplishments } from '../game/systems/accomplishmentLedger.ts';
import { getObservation, resetObservations } from '../game/systems/observationLedger.ts';
import { isStoryOxygenOnline } from './emergentCapabilities.ts';
import { getEmergentStoryEvents, resetEmergentStoryEvents } from './emergentStoryEvents.ts';
import {
  acquireKestrelKeelFromDive,
  advanceKestrelKeelAuthorityWait,
  advanceKestrelKeelFreeing,
  AUTHORED_DIVE_MILESTONES,
  AUTHORED_DIVE_TWO_CLOCKS_OBSERVATION_ID,
  bankSurfacedKestrelKeel,
  beginKestrelKeelFreeing,
  commitKeelSonarReveal,
  getAuthoredDiveGuidance,
  invalidateAuthoredDiveMotionContinuity,
  isSupportedDryDiveBankEvidence,
  resetAuthoredDiveRuntime,
  tickAuthoredDive
} from './emergentDive.ts';

describe('authored dive boundary', () => {
  beforeEach(() => {
    resetInventory();
    resetProgression();
    resetAccomplishments();
    resetObservations();
    resetEmergentStoryEvents();
    resetAuthoredDiveRuntime();
    markMilestone('story:started');
    markMilestone('maw_repaired');
    addItem('iron_maw', 1);
  });

  it('does not leak oxygen knowledge from water outside the authored dive', () => {
    tickAuthoredDive({ authored: false, submergence: 1, oxygen: 82 });
    expect(isStoryOxygenOnline()).toBe(false);
    expect(hasMilestone('story:sense:oxygen')).toBe(false);
    expect(getEmergentStoryEvents()).toEqual([]);
  });

  it('keeps objective and marker copy on one progression-derived contract', () => {
    expect(getAuthoredDiveGuidance()).toMatchObject({
      id: 'dive:recover-keel-memory',
      markerLabel: 'KEEL MEMORY'
    });
    markMilestone('story:item:kestrel-keel-memory:acquired');
    expect(getAuthoredDiveGuidance()).toMatchObject({
      id: 'dive:surface-with-keel',
      markerLabel: 'WATERLINE · SURFACE WITH KEEL'
    });
    markMilestone(AUTHORED_DIVE_MILESTONES.surfacedWithKeel);
    expect(getAuthoredDiveGuidance()).toMatchObject({
      id: 'dive:return-to-shore',
      markerLabel: 'DRY SHORE · SECURE KEEL MEMORY'
    });
    markMilestone('story:item:kestrel-keel-memory:banked');
    expect(getAuthoredDiveGuidance()).toMatchObject({
      id: 'dive:shore-handoff',
      kind: 'wait',
      markerLabel: 'KEEL MEMORY · SECURED',
      requiresMarker: false
    });
  });

  it('authors oxygen on meaningful submersion and records falling thresholds once', () => {
    tickAuthoredDive({ authored: true, submergence: 0.7, oxygen: 100, worldId: '-1,-1' });
    expect(isStoryOxygenOnline()).toBe(true);
    expect(hasMilestone('story:sense:oxygen')).toBe(true);

    tickAuthoredDive({ authored: true, submergence: 1, oxygen: 74, worldId: '-1,-1' });
    tickAuthoredDive({ authored: true, submergence: 1, oxygen: 73, worldId: '-1,-1' });
    expect(hasMilestone(AUTHORED_DIVE_MILESTONES.oxygen75)).toBe(true);
    expect(getEmergentStoryEvents().filter(event => event.type === 'oxygen_threshold')).toHaveLength(1);
    expect(getObservation(AUTHORED_DIVE_TWO_CLOCKS_OBSERVATION_ID)).toMatchObject({
      actorId: 'local',
      evidenceHistory: [{
        worldId: '-1,-1',
        sourceKey: 'sc.dive.two-clocks',
        data: {
          oxygen: 74,
          oxygenThreshold: 75,
          submergence: 1,
          worldClockSignal: 'underwater-harmonic-stretch',
          bodyClockSignal: 'oxygen-pulse-accelerating'
        }
      }],
      revisionHistory: [{ kind: 'attend' }]
    });
    expect(getEmergentStoryEvents().filter(event => event.type === 'observation_recorded')).toEqual([
      expect.objectContaining({
        actorId: 'local',
        worldId: '-1,-1',
        payload: {
          observationId: AUTHORED_DIVE_TWO_CLOCKS_OBSERVATION_ID,
          revisionKind: 'attend'
        }
      })
    ]);
  });

  it('keeps the two-clock observation actor/world scoped and optional', () => {
    tickAuthoredDive({
      authored: true,
      actorId: 'diver-a',
      worldId: 'origin',
      submergence: 0.8,
      oxygen: 100
    });
    tickAuthoredDive({
      authored: true,
      actorId: 'diver-a',
      worldId: 'origin',
      submergence: 0.9,
      oxygen: 74
    });
    tickAuthoredDive({
      authored: true,
      actorId: 'diver-b',
      worldId: 'sibling',
      submergence: 0.8,
      oxygen: 100
    });
    tickAuthoredDive({
      authored: true,
      actorId: 'diver-b',
      worldId: 'sibling',
      submergence: 0.9,
      oxygen: 74
    });

    expect(getObservation(AUTHORED_DIVE_TWO_CLOCKS_OBSERVATION_ID, 'diver-a'))
      .toMatchObject({ actorId: 'diver-a', evidenceHistory: [{ worldId: 'origin' }] });
    expect(getObservation(AUTHORED_DIVE_TWO_CLOCKS_OBSERVATION_ID, 'diver-b'))
      .toMatchObject({ actorId: 'diver-b', evidenceHistory: [{ worldId: 'sibling' }] });

    // Missing world evidence may never block the physical oxygen receipt.
    tickAuthoredDive({ authored: true, actorId: 'diver-c', submergence: 0.8, oxygen: 100 });
    tickAuthoredDive({ authored: true, actorId: 'diver-c', submergence: 0.9, oxygen: 74 });
    expect(hasMilestone(AUTHORED_DIVE_MILESTONES.oxygen75, 'diver-c')).toBe(true);
    expect(getObservation(AUTHORED_DIVE_TWO_CLOCKS_OBSERVATION_ID, 'diver-c')).toBeUndefined();
  });

  it('requires real submersion to free the Keel and real surfacing before shore bank', () => {
    tickAuthoredDive({ authored: true, submergence: 0.8, oxygen: 100 });
    expect(acquireKestrelKeelFromDive('keel:too-dry', 0.1)).toBe(false);
    expect(acquireKestrelKeelFromDive('keel:before-sonar', 0.9)).toBe(false);
    expect(commitKeelSonarReveal(false, 4, 0.9, 0.95)).toBe(false);
    expect(commitKeelSonarReveal(true, 4, 0.2, 0.95)).toBe(false);
    expect(commitKeelSonarReveal(true, 4, 0.9, 0.1)).toBe(false);
    // Oxygen can stay full: it is a survival signal, not a navigation gate.
    expect(commitKeelSonarReveal(true, 4, 0.9, 0.95)).toBe(true);
    expect(acquireKestrelKeelFromDive('keel:freed', 0.9)).toBe(true);
    expect(getItemCount('kestrel_keel_memory')).toBe(1);
    const dryShore = { feetInWater: false, physicallySupported: true, shoreDistance: 0 };
    expect(bankSurfacedKestrelKeel('keel:early-bank', 88, 0.9, undefined, undefined, dryShore)).toBe(false);

    tickAuthoredDive({ authored: true, submergence: 0, oxygen: 88 });
    expect(hasMilestone(AUTHORED_DIVE_MILESTONES.surfacedWithKeel)).toBe(true);
    expect(bankSurfacedKestrelKeel('keel:shore-bank', 88, 0, undefined, undefined, dryShore)).toBe(true);
    expect(listAccomplishments().map(entry => entry.id)).toContain('returned_with_keel_memory');
    expect(getEmergentStoryEvents().map(event => event.type)).toEqual(expect.arrayContaining([
      'keel_revealed',
      'keel_memory_acquired',
      'dive_surfaced',
      'keel_memory_banked'
    ]));
  });

  it('makes the Maw freeing hold cancel-safe and foreground-time based', () => {
    let freeing = beginKestrelKeelFreeing();
    freeing = advanceKestrelKeelFreeing(freeing, 0.8, true);
    expect(freeing).toMatchObject({ active: true, elapsedSeconds: 0.8, readyToCommit: false });

    freeing = advanceKestrelKeelFreeing(freeing, 10, false);
    expect(freeing).toEqual({
      active: false,
      elapsedSeconds: 0,
      readyToCommit: false,
      authorityWaitSeconds: 0
    });

    freeing = beginKestrelKeelFreeing();
    freeing = advanceKestrelKeelFreeing(freeing, 1.59, true);
    freeing = advanceKestrelKeelFreeing(freeing, 0.01, true);
    expect(freeing).toEqual({
      active: false,
      elapsedSeconds: 1.6,
      readyToCommit: true,
      authorityWaitSeconds: 0
    });

    freeing = advanceKestrelKeelAuthorityWait(freeing, 4.9, false);
    expect(freeing).toMatchObject({ readyToCommit: true, authorityWaitSeconds: 4.9 });
    freeing = advanceKestrelKeelAuthorityWait(freeing, 0.1, false);
    expect(freeing).toEqual({
      active: false,
      elapsedSeconds: 0,
      readyToCommit: false,
      authorityWaitSeconds: 0
    });
  });

  it('reconciles a surfaced receipt when an authoritative Keel acknowledgement arrives late', () => {
    tickAuthoredDive({ authored: true, submergence: 0.8, oxygen: 100 });
    tickAuthoredDive({ authored: true, submergence: 0, oxygen: 91 });
    expect(hasMilestone(AUTHORED_DIVE_MILESTONES.surfacedWithKeel)).toBe(false);

    // Represents the inventory + unique-item progression written by a delayed
    // authority acknowledgement after the physical waterline crossing.
    addItem('kestrel_keel_memory', 1);
    markMilestone('story:item:kestrel-keel-memory:acquired');
    tickAuthoredDive({ authored: true, submergence: 0, oxygen: 92 });

    expect(hasMilestone(AUTHORED_DIVE_MILESTONES.surfacedWithKeel)).toBe(true);
    expect(getEmergentStoryEvents().filter(event => event.type === 'dive_surfaced')).toHaveLength(1);
  });

  it('does not treat reset or reload relocation as physical surfacing', () => {
    tickAuthoredDive({ authored: true, submergence: 0.8, oxygen: 90 });
    addItem('kestrel_keel_memory', 1);
    markMilestone('story:item:kestrel-keel-memory:acquired');

    invalidateAuthoredDiveMotionContinuity();
    tickAuthoredDive({ authored: true, submergence: 0, oxygen: 100 });
    expect(hasMilestone(AUTHORED_DIVE_MILESTONES.surfacedWithKeel)).toBe(false);

    tickAuthoredDive({ authored: true, submergence: 0.8, oxygen: 99 });
    tickAuthoredDive({ authored: true, submergence: 0, oxygen: 98 });
    expect(hasMilestone(AUTHORED_DIVE_MILESTONES.surfacedWithKeel)).toBe(true);
  });

  it('requires supported dry shore contact before banking', () => {
    expect(isSupportedDryDiveBankEvidence(undefined)).toBe(false);
    expect(isSupportedDryDiveBankEvidence({
      feetInWater: true,
      physicallySupported: true,
      shoreDistance: 0
    })).toBe(false);
    expect(isSupportedDryDiveBankEvidence({
      feetInWater: false,
      physicallySupported: false,
      shoreDistance: 0
    })).toBe(false);
    expect(isSupportedDryDiveBankEvidence({
      feetInWater: false,
      physicallySupported: true,
      shoreDistance: 4.21
    })).toBe(false);
    expect(isSupportedDryDiveBankEvidence({
      feetInWater: false,
      physicallySupported: true,
      shoreDistance: 4.2
    })).toBe(true);
  });
});
