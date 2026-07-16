// --- Observation ledger ----------------------------------------------------
//
// Observations preserve what an actor noticed and how their interpretation
// changed. They are evidence for presentation and authored interpretation, not
// prerequisites: Story progression must never gate on this ledger.

import { getLocalActorId, type ActorId } from '../playerActors.ts';
import {
  canonicalEvidence,
  isLedgerObject,
  ledgerId,
  ledgerSequence,
  ledgerTimestamp,
  nextLedgerSequence,
  normalizeEvidence,
  parseEvidence,
  type LedgerActionInput,
  type LedgerEvidence,
  type LedgerEvidenceInput
} from './ledgerEvidence.ts';

export const OBSERVATION_LEDGER_SCHEMA_VERSION = 1 as const;

export type ObservationStage = 'noticed' | 'pattern' | 'hypothesis';
export type ObservationAcknowledgement = 'unacknowledged' | 'kept' | 'compared' | 'doubted';
export type ObservationRevisionKind = 'attend' | 'keep' | 'compare' | 'doubt';

export interface ObservationRevision {
  id: string;
  kind: ObservationRevisionKind;
  sequence: number;
  observedAt?: number;
  evidenceId?: string;
  interpretationVariantId?: string;
  relatedObservationId?: string;
}

export interface ObservationRecord {
  id: string;
  actorId: ActorId;
  firstEvidenceSequence: number;
  lastEvidenceSequence: number;
  firstEvidenceAt?: number;
  lastEvidenceAt?: number;
  evidenceHistory: LedgerEvidence[];
  interpretationVariantId?: string;
  contradictionIds: string[];
  comparisonIds: string[];
  revisionHistory: ObservationRevision[];
  acknowledgement: ObservationAcknowledgement;
  stage: ObservationStage;
}

export interface ObservationLedgerState {
  schemaVersion: typeof OBSERVATION_LEDGER_SCHEMA_VERSION;
  nextSequence: number;
  records: ObservationRecord[];
}

export type ObservationLedgerSnapshot = ObservationLedgerState;

export type ObservationCommand =
  | {
      type: 'attend';
      actorId: ActorId;
      observationId: string;
      action: LedgerActionInput;
      evidence: LedgerEvidenceInput;
    }
  | {
      type: 'keep';
      actorId: ActorId;
      observationId: string;
      action: LedgerActionInput;
      interpretationVariantId?: string;
    }
  | {
      type: 'compare';
      actorId: ActorId;
      observationId: string;
      action: LedgerActionInput;
      relatedObservationId: string;
      interpretationVariantId?: string;
    }
  | {
      type: 'doubt';
      actorId: ActorId;
      observationId: string;
      action: LedgerActionInput;
      contradictionObservationId?: string;
      interpretationVariantId?: string;
    };

let ledger = createObservationLedgerState();
const listeners = new Set<() => void>();

export function createObservationLedgerState(): ObservationLedgerState {
  return {
    schemaVersion: OBSERVATION_LEDGER_SCHEMA_VERSION,
    nextSequence: 1,
    records: []
  };
}

export function reduceObservationLedger(
  state: ObservationLedgerState,
  command: ObservationCommand
): ObservationLedgerState {
  const actorId = ledgerId(command.actorId);
  const observationId = ledgerId(command.observationId);
  const actionId = ledgerId(command.action.id);
  if (!actorId || !observationId || !actionId) return state;

  const current = findRecord(state.records, actorId, observationId);
  if (current?.revisionHistory.some(revision => revision.id === actionId)) return state;

  if (command.type !== 'attend' && !current) return state;
  if (command.type === 'compare') {
    const relatedId = ledgerId(command.relatedObservationId);
    if (!relatedId || relatedId === observationId || !findRecord(state.records, actorId, relatedId)) return state;
  }
  if (command.type === 'doubt' && command.contradictionObservationId !== undefined) {
    const contradictionId = ledgerId(command.contradictionObservationId);
    if (!contradictionId || contradictionId === observationId ||
        !findRecord(state.records, actorId, contradictionId)) return state;
  }

  const sequence = ledgerSequence(command.action.sequence)
    ?? (command.type === 'attend' ? ledgerSequence(command.evidence.sequence) : null)
    ?? state.nextSequence;
  const next = serializeObservationLedger(state);
  let record = findRecord(next.records, actorId, observationId);

  if (command.type === 'attend') {
    const evidence = normalizeEvidence(command.evidence, sequence);
    if (!evidence) return state;
    if (!record) {
      record = createRecord(actorId, observationId, [evidence]);
      next.records.push(record);
    } else if (!record.evidenceHistory.some(item => item.id === evidence.id)) {
      record.evidenceHistory = canonicalEvidence([...record.evidenceHistory, evidence]);
    }
    record.revisionHistory.push(createRevision(
      command.action,
      actionId,
      'attend',
      sequence,
      { evidenceId: evidence.id }
    ));
  } else if (command.type === 'keep' && record) {
    const interpretationVariantId = ledgerId(command.interpretationVariantId) ?? undefined;
    record.revisionHistory.push(createRevision(
      command.action,
      actionId,
      'keep',
      sequence,
      { interpretationVariantId }
    ));
  } else if (command.type === 'compare' && record) {
    const relatedObservationId = ledgerId(command.relatedObservationId);
    if (!relatedObservationId) return state;
    record.comparisonIds = sortedIds([...record.comparisonIds, relatedObservationId], observationId);
    const interpretationVariantId = ledgerId(command.interpretationVariantId) ?? undefined;
    record.revisionHistory.push(createRevision(
      command.action,
      actionId,
      'compare',
      sequence,
      { relatedObservationId, interpretationVariantId }
    ));
  } else if (command.type === 'doubt' && record) {
    const relatedObservationId = ledgerId(command.contradictionObservationId) ?? undefined;
    if (relatedObservationId) {
      record.contradictionIds = sortedIds([...record.contradictionIds, relatedObservationId], observationId);
    }
    const interpretationVariantId = ledgerId(command.interpretationVariantId) ?? undefined;
    record.revisionHistory.push(createRevision(
      command.action,
      actionId,
      'doubt',
      sequence,
      { relatedObservationId, interpretationVariantId }
    ));
  }

  if (!record) return state;
  canonicalizeRecord(record);
  next.records.sort(compareRecords);
  next.nextSequence = nextLedgerSequence(next.nextSequence, [
    ...record.evidenceHistory,
    ...record.revisionHistory
  ]);
  return next;
}

export function serializeObservationLedger(state: ObservationLedgerState): ObservationLedgerSnapshot {
  return hydrateObservationLedger(state);
}

/** Accepts versionless/partial JSON and deterministically repairs legacy data. */
export function hydrateObservationLedger(value: unknown): ObservationLedgerState {
  if (!isLedgerObject(value)) return createObservationLedgerState();
  const rawRecords = Array.isArray(value.records) ? value.records : [];
  const merged = new Map<string, ObservationRecord>();

  for (const raw of rawRecords) {
    const record = parseRecord(raw);
    if (!record) continue;
    const key = recordKey(record.actorId, record.id);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, record);
      continue;
    }
    existing.evidenceHistory = canonicalEvidence([
      ...existing.evidenceHistory,
      ...record.evidenceHistory
    ]);
    existing.revisionHistory = canonicalRevisions([
      ...existing.revisionHistory,
      ...record.revisionHistory
    ]);
    existing.contradictionIds = sortedIds([
      ...existing.contradictionIds,
      ...record.contradictionIds
    ], existing.id);
    existing.comparisonIds = sortedIds([
      ...existing.comparisonIds,
      ...record.comparisonIds
    ], existing.id);
    canonicalizeRecord(existing);
  }

  const records = [...merged.values()].sort(compareRecords);
  const validKeys = new Set(records.map(record => recordKey(record.actorId, record.id)));
  for (const record of records) {
    record.contradictionIds = record.contradictionIds.filter(id =>
      validKeys.has(recordKey(record.actorId, id))
    );
    record.comparisonIds = record.comparisonIds.filter(id =>
      validKeys.has(recordKey(record.actorId, id))
    );
  }
  const events = records.flatMap(record => [
    ...record.evidenceHistory,
    ...record.revisionHistory
  ]);
  return {
    schemaVersion: OBSERVATION_LEDGER_SCHEMA_VERSION,
    nextSequence: nextLedgerSequence(ledgerSequence(value.nextSequence) ?? 1, events),
    records
  };
}

export function attendObservation(
  observationId: string,
  evidence: LedgerEvidenceInput,
  action: LedgerActionInput,
  actorId: ActorId = getLocalActorId()
): boolean {
  return dispatch({ type: 'attend', actorId, observationId, action, evidence });
}

export function keepObservation(
  observationId: string,
  action: LedgerActionInput,
  interpretationVariantId?: string,
  actorId: ActorId = getLocalActorId()
): boolean {
  return dispatch({ type: 'keep', actorId, observationId, action, interpretationVariantId });
}

export function compareObservation(
  observationId: string,
  relatedObservationId: string,
  action: LedgerActionInput,
  interpretationVariantId?: string,
  actorId: ActorId = getLocalActorId()
): boolean {
  return dispatch({
    type: 'compare',
    actorId,
    observationId,
    relatedObservationId,
    action,
    interpretationVariantId
  });
}

export function doubtObservation(
  observationId: string,
  action: LedgerActionInput,
  contradictionObservationId?: string,
  interpretationVariantId?: string,
  actorId: ActorId = getLocalActorId()
): boolean {
  return dispatch({
    type: 'doubt',
    actorId,
    observationId,
    action,
    contradictionObservationId,
    interpretationVariantId
  });
}

export function getObservation(
  observationId: string,
  actorId: ActorId = getLocalActorId()
): ObservationRecord | undefined {
  const record = findRecord(ledger.records, actorId, observationId);
  return record ? cloneRecord(record) : undefined;
}

export function listObservations(actorId: ActorId = getLocalActorId()): ObservationRecord[] {
  return ledger.records.filter(record => record.actorId === actorId).map(cloneRecord);
}

export function getObservationLedgerSnapshot(): ObservationLedgerSnapshot {
  return serializeObservationLedger(ledger);
}

export function applyObservationLedgerSnapshot(
  snapshot: unknown,
  options: { replace?: boolean } = {}
): void {
  const incoming = hydrateObservationLedger(snapshot);
  ledger = options.replace ?? true
    ? incoming
    : hydrateObservationLedger({
        nextSequence: Math.max(ledger.nextSequence, incoming.nextSequence),
        records: [...ledger.records, ...incoming.records]
      });
  emit();
}

export function resetObservations(actorId?: ActorId): void {
  if (actorId === undefined) {
    ledger = createObservationLedgerState();
  } else {
    ledger = hydrateObservationLedger({
      nextSequence: ledger.nextSequence,
      records: ledger.records.filter(record => record.actorId !== actorId)
    });
  }
  emit();
}

export function subscribeObservations(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function dispatch(command: ObservationCommand): boolean {
  const next = reduceObservationLedger(ledger, command);
  if (next === ledger) return false;
  ledger = next;
  emit();
  return true;
}

function parseRecord(value: unknown): ObservationRecord | null {
  if (!isLedgerObject(value)) return null;
  const actorId = ledgerId(value.actorId);
  const id = ledgerId(value.id);
  if (!actorId || !id) return null;
  const rawEvidence = Array.isArray(value.evidenceHistory) ? value.evidenceHistory : [];
  let evidenceHistory = canonicalEvidence(
    rawEvidence.map(parseEvidence).filter((item): item is LedgerEvidence => item !== null)
  );
  if (evidenceHistory.length === 0) {
    const sequence = ledgerSequence(value.firstEvidenceSequence);
    if (sequence !== null) {
      const legacy = normalizeEvidence({
        id: `legacy:${actorId}:${id}:evidence`,
        sequence,
        observedAt: ledgerTimestamp(value.firstEvidenceAt)
      }, sequence);
      if (legacy) evidenceHistory = [legacy];
    }
  }
  if (evidenceHistory.length === 0) return null;

  const rawRevisions = Array.isArray(value.revisionHistory) ? value.revisionHistory : [];
  let revisionHistory = canonicalRevisions(
    rawRevisions.map(parseRevision).filter((item): item is ObservationRevision => item !== null)
  );
  if (revisionHistory.length === 0) {
    const evidence = evidenceHistory[0];
    revisionHistory = [{
      id: `legacy:${actorId}:${id}:attend`,
      kind: 'attend',
      sequence: evidence.sequence,
      ...(evidence.observedAt === undefined ? {} : { observedAt: evidence.observedAt }),
      evidenceId: evidence.id
    }];
    const acknowledgement = parseAcknowledgement(value.acknowledgement);
    const kind = acknowledgementKind(acknowledgement);
    if (kind) {
      const sequence = Math.max(
        evidenceHistory[evidenceHistory.length - 1]?.sequence ?? evidence.sequence,
        evidence.sequence
      ) + 1;
      revisionHistory.push({
        id: `legacy:${actorId}:${id}:${kind}`,
        kind,
        sequence,
        ...(ledgerId(value.interpretationVariantId) === null
          ? {}
          : { interpretationVariantId: ledgerId(value.interpretationVariantId) ?? undefined })
      });
    }
  }

  const record: ObservationRecord = {
    id,
    actorId,
    firstEvidenceSequence: evidenceHistory[0]?.sequence ?? 0,
    lastEvidenceSequence: evidenceHistory[evidenceHistory.length - 1]?.sequence ?? 0,
    evidenceHistory,
    contradictionIds: parseIdArray(value.contradictionIds, id),
    comparisonIds: parseIdArray(value.comparisonIds, id),
    revisionHistory,
    acknowledgement: parseAcknowledgement(value.acknowledgement),
    stage: parseStage(value.stage),
    ...(ledgerId(value.interpretationVariantId) === null
      ? {}
      : { interpretationVariantId: ledgerId(value.interpretationVariantId) ?? undefined })
  };
  canonicalizeRecord(record);
  return record;
}

function parseRevision(value: unknown): ObservationRevision | null {
  if (!isLedgerObject(value)) return null;
  const id = ledgerId(value.id);
  const sequence = ledgerSequence(value.sequence);
  const kind = parseRevisionKind(value.kind);
  if (!id || sequence === null || !kind) return null;
  const observedAt = ledgerTimestamp(value.observedAt);
  const evidenceId = ledgerId(value.evidenceId);
  const interpretationVariantId = ledgerId(value.interpretationVariantId);
  const relatedObservationId = ledgerId(value.relatedObservationId);
  return {
    id,
    kind,
    sequence,
    ...(observedAt === undefined ? {} : { observedAt }),
    ...(evidenceId === null ? {} : { evidenceId }),
    ...(interpretationVariantId === null ? {} : { interpretationVariantId }),
    ...(relatedObservationId === null ? {} : { relatedObservationId })
  };
}

function createRecord(
  actorId: ActorId,
  id: string,
  evidenceHistory: LedgerEvidence[]
): ObservationRecord {
  const record: ObservationRecord = {
    id,
    actorId,
    firstEvidenceSequence: 0,
    lastEvidenceSequence: 0,
    evidenceHistory: canonicalEvidence(evidenceHistory),
    contradictionIds: [],
    comparisonIds: [],
    revisionHistory: [],
    acknowledgement: 'unacknowledged',
    stage: 'noticed'
  };
  applyEvidenceBounds(record);
  return record;
}

function createRevision(
  action: LedgerActionInput,
  id: string,
  kind: ObservationRevisionKind,
  sequence: number,
  extras: Pick<ObservationRevision, 'evidenceId' | 'interpretationVariantId' | 'relatedObservationId'>
): ObservationRevision {
  const observedAt = ledgerTimestamp(action.observedAt);
  return {
    id,
    kind,
    sequence,
    ...(observedAt === undefined ? {} : { observedAt }),
    ...(extras.evidenceId === undefined ? {} : { evidenceId: extras.evidenceId }),
    ...(extras.interpretationVariantId === undefined
      ? {}
      : { interpretationVariantId: extras.interpretationVariantId }),
    ...(extras.relatedObservationId === undefined
      ? {}
      : { relatedObservationId: extras.relatedObservationId })
  };
}

function canonicalizeRecord(record: ObservationRecord): void {
  record.evidenceHistory = canonicalEvidence(record.evidenceHistory);
  record.revisionHistory = canonicalRevisions(record.revisionHistory);
  record.contradictionIds = sortedIds(record.contradictionIds, record.id);
  record.comparisonIds = sortedIds(record.comparisonIds, record.id);
  applyEvidenceBounds(record);

  let stage: ObservationStage = record.stage;
  let acknowledgement: ObservationAcknowledgement = record.acknowledgement;
  let interpretationVariantId = ledgerId(record.interpretationVariantId) ?? undefined;
  for (const revision of record.revisionHistory) {
    if (revision.kind === 'attend') acknowledgement = 'unacknowledged';
    else if (revision.kind === 'keep') acknowledgement = 'kept';
    else if (revision.kind === 'compare') {
      acknowledgement = 'compared';
      stage = maxStage(stage, 'pattern');
    } else {
      acknowledgement = 'doubted';
      stage = maxStage(stage, 'hypothesis');
    }
    if (revision.interpretationVariantId) {
      interpretationVariantId = revision.interpretationVariantId;
    }
  }
  record.stage = stage;
  record.acknowledgement = acknowledgement;
  if (interpretationVariantId === undefined) delete record.interpretationVariantId;
  else record.interpretationVariantId = interpretationVariantId;
}

function canonicalRevisions(values: readonly ObservationRevision[]): ObservationRevision[] {
  const ordered = values
    .map(parseRevision)
    .filter((value): value is ObservationRevision => value !== null)
    .sort(compareRevisions);
  const seen = new Set<string>();
  const result: ObservationRevision[] = [];
  for (const revision of ordered) {
    if (seen.has(revision.id)) continue;
    seen.add(revision.id);
    result.push(revision);
  }
  return result;
}

function applyEvidenceBounds(record: ObservationRecord): void {
  const first = record.evidenceHistory[0];
  const last = record.evidenceHistory[record.evidenceHistory.length - 1];
  record.firstEvidenceSequence = first?.sequence ?? 0;
  record.lastEvidenceSequence = last?.sequence ?? 0;
  if (first?.observedAt === undefined) delete record.firstEvidenceAt;
  else record.firstEvidenceAt = first.observedAt;
  if (last?.observedAt === undefined) delete record.lastEvidenceAt;
  else record.lastEvidenceAt = last.observedAt;
}

function cloneRecord(record: ObservationRecord): ObservationRecord {
  // Clone the record without running whole-ledger referential filtering: a
  // single-record read still needs to expose links to its sibling records.
  const clone = parseRecord(record);
  if (!clone) throw new Error('Observation record failed canonical clone');
  return clone;
}

function findRecord(
  records: readonly ObservationRecord[],
  actorId: ActorId,
  id: string
): ObservationRecord | undefined {
  return records.find(record => record.actorId === actorId && record.id === id);
}

function parseRevisionKind(value: unknown): ObservationRevisionKind | null {
  return value === 'attend' || value === 'keep' || value === 'compare' || value === 'doubt'
    ? value
    : null;
}

function parseAcknowledgement(value: unknown): ObservationAcknowledgement {
  return value === 'kept' || value === 'compared' || value === 'doubted'
    ? value
    : 'unacknowledged';
}

function acknowledgementKind(value: ObservationAcknowledgement): Exclude<ObservationRevisionKind, 'attend'> | null {
  if (value === 'kept') return 'keep';
  if (value === 'compared') return 'compare';
  if (value === 'doubted') return 'doubt';
  return null;
}

function parseStage(value: unknown): ObservationStage {
  return value === 'pattern' || value === 'hypothesis' ? value : 'noticed';
}

function maxStage(left: ObservationStage, right: ObservationStage): ObservationStage {
  const rank: Record<ObservationStage, number> = { noticed: 0, pattern: 1, hypothesis: 2 };
  return rank[left] >= rank[right] ? left : right;
}

function parseIdArray(value: unknown, selfId: string): string[] {
  return Array.isArray(value) ? sortedIds(value, selfId) : [];
}

function sortedIds(values: readonly unknown[], selfId: string): string[] {
  return [...new Set(values.map(ledgerId).filter((id): id is string => id !== null && id !== selfId))]
    .sort((left, right) => left.localeCompare(right));
}

function compareRevisions(left: ObservationRevision, right: ObservationRevision): number {
  return left.sequence - right.sequence || left.id.localeCompare(right.id);
}

function compareRecords(left: ObservationRecord, right: ObservationRecord): number {
  return left.actorId.localeCompare(right.actorId) || left.id.localeCompare(right.id);
}

function recordKey(actorId: ActorId, id: string): string {
  return `${actorId}\u0000${id}`;
}

function emit(): void {
  for (const listener of listeners) listener();
}
