import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearJourneyEntityState,
  getJourneyEntitySnapshot,
  publishJourneyEntityState,
  resetJourneyEntityRuntimeForTests
} from './journeyRuntime.ts';

describe('journey entity runtime', () => {
  beforeEach(resetJourneyEntityRuntimeForTests);

  it('preserves explicit absence after a mounted entity leaves', () => {
    publishJourneyEntityState('actor:w7744', {
      mounted: true,
      visible: true,
      position: [1.234, 2.345, 3.456],
      phase: 'grounded-exit',
      source: 'AuditWorker'
    });
    clearJourneyEntityState('actor:w7744', 'AuditWorker');

    const snapshot = getJourneyEntitySnapshot();
    expect(snapshot.entities['actor:w7744']).toMatchObject({
      mounted: false,
      visible: false,
      position: null,
      phase: 'unmounted'
    });
    expect(snapshot.events.map(event => event.visible)).toEqual([true, false]);
  });

  it('coalesces identical frames while retaining real lifecycle changes', () => {
    const state = {
      mounted: true,
      visible: true,
      position: [1, 2, 3] as const,
      phase: 'present',
      source: 'FieldPack'
    };
    publishJourneyEntityState('prop:field-pack', state);
    publishJourneyEntityState('prop:field-pack', state);
    publishJourneyEntityState('prop:field-pack', { ...state, visible: false });

    const snapshot = getJourneyEntitySnapshot();
    expect(snapshot.revision).toBe(2);
    expect(snapshot.events).toHaveLength(2);
  });
});
