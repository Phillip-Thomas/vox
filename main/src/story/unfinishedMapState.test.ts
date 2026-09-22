import { describe, expect, it } from 'vitest';
import { UM, canAttendMapPlace, unfinishedMapState, type MapAttendance } from './unfinishedMapState.ts';

describe('the unfinished map: earned record and physical visits', () => {
  it('resumes each unearned action from the existing saved receipts', () => {
    const receipts = new Set<string>();
    const read = () => unfinishedMapState(id => receipts.has(id));
    expect(read().beat).toBe(null);
    receipts.add(UM.opened); expect(read().beat).toBe('ch14-record');
    receipts.add(UM.indexed); expect(read().beat).toBe('ch14-scar');
    receipts.add(UM.scar); expect(read().beat).toBe('ch14-question');
    receipts.add(UM.changed); receipts.add(UM.retained);
    expect(read()).toMatchObject({ beat: 'ch14-return', question: 'changed', selected: false });
    receipts.add(UM.selected); expect(read().complete).toBe(false);
    receipts.add(UM.returned); expect(read().complete).toBe(false);
    receipts.add(UM.complete); expect(read()).toMatchObject({ complete: true, beat: 'done' });
  });
  it('does not make selection or a stray completion receipt into a visit', () => {
    expect(unfinishedMapState(id => id === UM.complete || id === UM.selected)).toMatchObject({ opened: false, complete: false });
  });
  const facts: MapAttendance = { foreground: true, origin: true, onFoot: true, actorMatches: true,
    priorComplete: true, reciprocalProof: true, targetAvailable: true, distance: 1.9 };
  it.each(['foreground', 'origin', 'onFoot', 'actorMatches', 'priorComplete', 'reciprocalProof', 'targetAvailable'] as const)
    ('blocks a visit when %s is absent; reentry remains recoverable', key => {
      expect(canAttendMapPlace({ ...facts, [key]: false }, 2)).toBe(false);
      expect(canAttendMapPlace(facts, 2)).toBe(true);
    });
  it('rejects remote and invalid poses without a timer or gaze predicate', () => {
    for (const distance of [2.01, 500, Infinity, NaN]) expect(canAttendMapPlace({ ...facts, distance }, 2)).toBe(false);
  });
  it.each(['survived', 'changed'] as const)('retains the %s question with identical completion rules', question => {
    const receipts = new Set([UM.opened, UM.indexed, UM.scar, UM[question], UM.retained]);
    expect(unfinishedMapState(id => receipts.has(id as never))).toMatchObject({ question, retained: true, complete: false });
  });
});
