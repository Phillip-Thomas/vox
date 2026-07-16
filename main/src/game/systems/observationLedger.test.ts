import { beforeEach, describe, expect, it } from 'vitest';
import { hasMilestone, markMilestone, resetProgression } from './progressionSystem.ts';
import {
  OBSERVATION_LEDGER_SCHEMA_VERSION,
  attendObservation,
  compareObservation,
  createObservationLedgerState,
  doubtObservation,
  getObservation,
  getObservationLedgerSnapshot,
  hydrateObservationLedger,
  keepObservation,
  listObservations,
  reduceObservationLedger,
  resetObservations,
  serializeObservationLedger
} from './observationLedger.ts';

beforeEach(() => {
  resetObservations();
  resetProgression();
});

describe('observation ledger', () => {
  it('records Attend -> Keep as explicit evidence-backed revisions', () => {
    expect(attendObservation(
      'maw.hum.changed',
      { id: 'audio:maw-hum-01', observedAt: 1_000, sourceKey: 'maw.audio' },
      { id: 'attention:maw-hum-01', observedAt: 1_010 },
      'ada'
    )).toBe(true);
    expect(keepObservation(
      'maw.hum.changed',
      { id: 'keep:maw-hum-01', observedAt: 1_100 },
      'variant:protective',
      'ada'
    )).toBe(true);

    expect(getObservation('maw.hum.changed', 'ada')).toMatchObject({
      acknowledgement: 'kept',
      stage: 'noticed',
      interpretationVariantId: 'variant:protective',
      firstEvidenceSequence: 1,
      lastEvidenceSequence: 1,
      evidenceHistory: [{ id: 'audio:maw-hum-01', sequence: 1 }],
      revisionHistory: [
        { id: 'attention:maw-hum-01', kind: 'attend', sequence: 1 },
        { id: 'keep:maw-hum-01', kind: 'keep', sequence: 2 }
      ]
    });
  });

  it('supports Compare and Doubt with stable relationship links and stage changes', () => {
    attendObservation('signal.alpha', { id: 'e:alpha' }, { id: 'a:alpha' }, 'ada');
    attendObservation('signal.beta', { id: 'e:beta' }, { id: 'a:beta' }, 'ada');
    attendObservation('signal.gamma', { id: 'e:gamma' }, { id: 'a:gamma' }, 'ada');

    expect(compareObservation(
      'signal.alpha',
      'signal.beta',
      { id: 'compare:alpha-beta' },
      'variant:repeating',
      'ada'
    )).toBe(true);
    expect(doubtObservation(
      'signal.alpha',
      { id: 'doubt:alpha-gamma' },
      'signal.gamma',
      'variant:contradicted',
      'ada'
    )).toBe(true);

    expect(getObservation('signal.alpha', 'ada')).toMatchObject({
      acknowledgement: 'doubted',
      stage: 'hypothesis',
      interpretationVariantId: 'variant:contradicted',
      comparisonIds: ['signal.beta'],
      contradictionIds: ['signal.gamma'],
      revisionHistory: [
        { kind: 'attend' },
        { kind: 'compare', relatedObservationId: 'signal.beta' },
        { kind: 'doubt', relatedObservationId: 'signal.gamma' }
      ]
    });
  });

  it('rejects impossible cross-actor/self comparisons and deduplicates action replay', () => {
    attendObservation('signal.alpha', { id: 'e:alpha' }, { id: 'a:alpha' }, 'ada');
    attendObservation('signal.beta', { id: 'e:beta' }, { id: 'a:beta' }, 'lin');
    const before = getObservationLedgerSnapshot();

    expect(compareObservation('signal.alpha', 'signal.alpha', { id: 'bad:self' }, undefined, 'ada')).toBe(false);
    expect(compareObservation('signal.alpha', 'signal.beta', { id: 'bad:actor' }, undefined, 'ada')).toBe(false);
    expect(attendObservation('signal.alpha', { id: 'e:new' }, { id: 'a:alpha' }, 'ada')).toBe(false);
    expect(getObservationLedgerSnapshot()).toEqual(before);
    expect(listObservations('ada')).toHaveLength(1);
    expect(listObservations('lin')).toHaveLength(1);
  });

  it('does not make observations a Story progression gate', () => {
    markMilestone('unrelated_story_fact');
    attendObservation('water.looked-at', { id: 'e:water' }, { id: 'a:water' }, 'ada');
    keepObservation('water.looked-at', { id: 'k:water' }, undefined, 'ada');

    expect(hasMilestone('unrelated_story_fact')).toBe(true);
    expect(hasMilestone('water.looked-at')).toBe(false);
  });

  it('uses explicit sequences for canonical replay independent of insertion order', () => {
    const initial = createObservationLedgerState();
    const leftA = reduceObservationLedger(initial, {
      type: 'attend',
      actorId: 'zeta',
      observationId: 'b',
      evidence: { id: 'e:b', sequence: 9 },
      action: { id: 'a:b', sequence: 9 }
    });
    const left = reduceObservationLedger(leftA, {
      type: 'attend',
      actorId: 'alpha',
      observationId: 'a',
      evidence: { id: 'e:a', sequence: 3 },
      action: { id: 'a:a', sequence: 3 }
    });
    const rightA = reduceObservationLedger(initial, {
      type: 'attend',
      actorId: 'alpha',
      observationId: 'a',
      evidence: { id: 'e:a', sequence: 3 },
      action: { id: 'a:a', sequence: 3 }
    });
    const right = reduceObservationLedger(rightA, {
      type: 'attend',
      actorId: 'zeta',
      observationId: 'b',
      evidence: { id: 'e:b', sequence: 9 },
      action: { id: 'a:b', sequence: 9 }
    });

    expect(initial).toEqual(createObservationLedgerState());
    expect(serializeObservationLedger(left)).toEqual(serializeObservationLedger(right));
    expect(serializeObservationLedger(left).nextSequence).toBe(10);
  });

  it('migrates partial legacy observations and filters malformed links and events', () => {
    const migrated = hydrateObservationLedger({
      records: [
        {
          id: 'signal.alpha',
          actorId: 'ada',
          firstEvidenceSequence: 7,
          firstEvidenceAt: 7_000,
          acknowledgement: 'kept',
          stage: 'noticed',
          interpretationVariantId: 'variant:legacy',
          comparisonIds: ['signal.beta', 'signal.missing', 'signal.alpha'],
          contradictionIds: ['signal.beta', 12]
        },
        {
          id: 'signal.beta',
          actorId: 'ada',
          evidenceHistory: [
            { id: 'bad', sequence: false },
            { id: 'e:beta', sequence: 4 }
          ],
          revisionHistory: [{ id: 'broken', kind: 'attend', sequence: 'later' }]
        },
        { id: 'empty', actorId: 'ada' }
      ]
    });

    expect(migrated.schemaVersion).toBe(OBSERVATION_LEDGER_SCHEMA_VERSION);
    expect(migrated.records).toHaveLength(2);
    const alpha = migrated.records.find(record => record.id === 'signal.alpha');
    expect(alpha).toMatchObject({
      acknowledgement: 'kept',
      interpretationVariantId: 'variant:legacy',
      comparisonIds: ['signal.beta'],
      contradictionIds: ['signal.beta'],
      evidenceHistory: [{ sequence: 7, observedAt: 7_000 }],
      revisionHistory: [{ kind: 'attend' }, { kind: 'keep' }]
    });
    expect(migrated.nextSequence).toBe(9);
  });
});
