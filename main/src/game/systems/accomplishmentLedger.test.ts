import { beforeEach, describe, expect, it } from 'vitest';
import {
  ACCOMPLISHMENT_LEDGER_SCHEMA_VERSION,
  applyAccomplishmentLedgerSnapshot,
  createAccomplishmentLedgerState,
  getAccomplishment,
  getAccomplishmentLedgerSnapshot,
  hydrateAccomplishmentLedger,
  listAccomplishments,
  recordAccomplishment,
  reduceAccomplishmentLedger,
  resetAccomplishments,
  serializeAccomplishmentLedger
} from './accomplishmentLedger.ts';

beforeEach(() => resetAccomplishments());

describe('accomplishment ledger', () => {
  it('keeps actor-owned facts and their evidence history separate', () => {
    expect(recordAccomplishment('maw_repaired', {
      id: 'repair:first-power',
      observedAt: 1_000,
      worldId: '5,-2:p0'
    }, 'ada')).toBe(true);
    expect(recordAccomplishment('maw_repaired', {
      id: 'repair:diagnostic',
      observedAt: 1_250,
      sourceKey: 'maw.console'
    }, 'ada')).toBe(true);
    expect(recordAccomplishment('maw_repaired', {
      id: 'repair:other-actor'
    }, 'lin')).toBe(true);

    expect(listAccomplishments('ada')).toHaveLength(1);
    expect(getAccomplishment('maw_repaired', 'ada')).toMatchObject({
      actorId: 'ada',
      firstEvidenceSequence: 1,
      lastEvidenceSequence: 2,
      firstEvidenceAt: 1_000,
      lastEvidenceAt: 1_250,
      evidenceHistory: [
        { id: 'repair:first-power', sequence: 1 },
        { id: 'repair:diagnostic', sequence: 2 }
      ]
    });
    expect(getAccomplishment('maw_repaired', 'lin')?.evidenceHistory).toHaveLength(1);
  });

  it('deduplicates stable evidence ids without allocating another sequence', () => {
    recordAccomplishment('first_dive', { id: 'dive:water-entry' }, 'ada');
    const before = getAccomplishmentLedgerSnapshot();

    expect(recordAccomplishment('first_dive', {
      id: 'dive:water-entry',
      observedAt: 99_999
    }, 'ada')).toBe(false);

    expect(getAccomplishmentLedgerSnapshot()).toEqual(before);
  });

  it('is pure and serializes canonically regardless of command insertion order', () => {
    const initial = createAccomplishmentLedgerState();
    const first = reduceAccomplishmentLedger(initial, {
      actorId: 'zeta',
      accomplishmentId: 'ship_repaired',
      evidence: { id: 'ship:power', sequence: 8, data: { z: 2, a: 1 } }
    });
    const left = reduceAccomplishmentLedger(first, {
      actorId: 'alpha',
      accomplishmentId: 'maw_repaired',
      evidence: { id: 'maw:online', sequence: 3 }
    });
    const rightFirst = reduceAccomplishmentLedger(initial, {
      actorId: 'alpha',
      accomplishmentId: 'maw_repaired',
      evidence: { id: 'maw:online', sequence: 3 }
    });
    const right = reduceAccomplishmentLedger(rightFirst, {
      actorId: 'zeta',
      accomplishmentId: 'ship_repaired',
      evidence: { id: 'ship:power', sequence: 8, data: { a: 1, z: 2 } }
    });

    expect(initial).toEqual(createAccomplishmentLedgerState());
    expect(serializeAccomplishmentLedger(left)).toEqual(serializeAccomplishmentLedger(right));
    expect(serializeAccomplishmentLedger(left).records.map(record => record.actorId)).toEqual([
      'alpha',
      'zeta'
    ]);
    expect(serializeAccomplishmentLedger(left).nextSequence).toBe(9);
  });

  it('hydrates versionless legacy and malformed JSON without losing valid facts', () => {
    const migrated = hydrateAccomplishmentLedger({
      nextSequence: -20,
      ignoredFutureField: true,
      records: [
        null,
        { id: '', actorId: 'ada', evidenceHistory: [] },
        {
          id: 'maw_repaired',
          actorId: 'ada',
          firstEvidenceSequence: 12,
          firstEvidenceAt: 5_000
        },
        {
          id: 'ship_repaired',
          actorId: 'ada',
          evidenceHistory: [
            { id: 'bad-sequence', sequence: 'nope' },
            { id: 'ship:online', sequence: 18 }
          ]
        }
      ]
    });

    expect(migrated.schemaVersion).toBe(ACCOMPLISHMENT_LEDGER_SCHEMA_VERSION);
    expect(migrated.records).toHaveLength(2);
    expect(migrated.records[0]?.evidenceHistory[0]).toMatchObject({
      id: 'legacy:ada:maw_repaired:first',
      sequence: 12,
      observedAt: 5_000
    });
    expect(migrated.nextSequence).toBe(19);

    applyAccomplishmentLedgerSnapshot(migrated);
    expect(getAccomplishment('ship_repaired', 'ada')).toBeDefined();
  });
});
