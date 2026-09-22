/** Chapter-local receipts use the existing actor-keyed, saved milestone ledger. */
export const UM = Object.freeze({
  opened: 'story:ch14:record-opened',
  indexed: 'story:ch14:survey-indexed',
  scar: 'story:ch14:scar-observed',
  survived: 'story:ch14:question-survived',
  changed: 'story:ch14:question-changed',
  retained: 'story:ch14:question-retained',
  selected: 'story:ch14:return-selected',
  returned: 'story:ch14:return-recorded',
  complete: 'story:ch14:complete'
});
export type MapQuestion = 'survived' | 'changed';
export const MAP_QUESTIONS = {
  survived: 'what survived the repair?',
  changed: 'what did the repair change?'
} as const;
export function unfinishedMapState(has: (id: string) => boolean) {
  const opened = has(UM.opened);
  const indexed = opened && has(UM.indexed);
  const scar = indexed && has(UM.scar);
  const question: MapQuestion | null = scar
    ? has(UM.survived) ? 'survived' : has(UM.changed) ? 'changed' : null : null;
  const retained = question !== null && has(UM.retained);
  const selected = retained && has(UM.selected);
  const returned = selected && has(UM.returned);
  const complete = returned && has(UM.complete);
  const beat = complete ? 'done' : !opened ? null : !indexed ? 'ch14-record'
    : !scar ? 'ch14-scar' : !retained ? 'ch14-question' : 'ch14-return';
  return { opened, indexed, scar, question, retained, selected, returned, complete, beat } as const;
}
export interface MapAttendance {
  foreground: boolean;
  origin: boolean;
  onFoot: boolean;
  actorMatches: boolean;
  priorComplete: boolean;
  reciprocalProof: boolean;
  targetAvailable: boolean;
  distance: number;
}
/** Neither gaze, prior scar accomplishments nor elapsed time enters this gate. */
export function canAttendMapPlace(facts: MapAttendance, reach: number): boolean {
  return facts.foreground && facts.origin && facts.onFoot && facts.actorMatches
    && facts.priorComplete && facts.reciprocalProof && facts.targetAvailable
    && Number.isFinite(facts.distance) && facts.distance <= reach;
}
