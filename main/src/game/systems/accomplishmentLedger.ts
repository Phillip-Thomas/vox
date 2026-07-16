// --- Accomplishment ledger --------------------------------------------------
//
// Accomplishments are durable facts about what an actor has done. They are
// intentionally separate from observations, which remain interpretive.

import { getLocalActorId, type ActorId } from '../playerActors.ts';
import {
  canonicalEvidence,
  compareLedgerEvents,
  isLedgerObject,
  ledgerId,
  ledgerSequence,
  nextLedgerSequence,
  normalizeEvidence,
  parseEvidence,
  type LedgerEvidence,
  type LedgerEvidenceInput
} from './ledgerEvidence.ts';

export const ACCOMPLISHMENT_LEDGER_SCHEMA_VERSION = 1 as const;

export interface AccomplishmentRecord {
  id: string;
  actorId: ActorId;
  firstEvidenceSequence: number;
  lastEvidenceSequence: number;
  firstEvidenceAt?: number;
  lastEvidenceAt?: number;
  evidenceHistory: LedgerEvidence[];
}

export interface AccomplishmentLedgerState {
  schemaVersion: typeof ACCOMPLISHMENT_LEDGER_SCHEMA_VERSION;
  nextSequence: number;
  records: AccomplishmentRecord[];
}

export type AccomplishmentLedgerSnapshot = AccomplishmentLedgerState;

export interface RecordAccomplishmentCommand {
  actorId: ActorId;
  accomplishmentId: string;
  evidence: LedgerEvidenceInput;
}

let ledger = createAccomplishmentLedgerState();
const listeners = new Set<() => void>();

export function createAccomplishmentLedgerState(): AccomplishmentLedgerState {
  return {
    schemaVersion: ACCOMPLISHMENT_LEDGER_SCHEMA_VERSION,
    nextSequence: 1,
    records: []
  };
}

export function reduceAccomplishmentLedger(
  state: AccomplishmentLedgerState,
  command: RecordAccomplishmentCommand
): AccomplishmentLedgerState {
  const actorId = ledgerId(command.actorId);
  const accomplishmentId = ledgerId(command.accomplishmentId);
  if (!actorId || !accomplishmentId) return state;

  const current = state.records.find(record =>
    record.actorId === actorId && record.id === accomplishmentId
  );
  const evidenceId = ledgerId(command.evidence.id);
  if (!evidenceId || current?.evidenceHistory.some(item => item.id === evidenceId)) return state;

  const sequence = ledgerSequence(command.evidence.sequence) ?? state.nextSequence;
  const evidence = normalizeEvidence(command.evidence, sequence);
  if (!evidence) return state;

  const next = serializeAccomplishmentLedger(state);
  const record = next.records.find(item => item.actorId === actorId && item.id === accomplishmentId);
  if (record) {
    record.evidenceHistory = canonicalEvidence([...record.evidenceHistory, evidence]);
    applyEvidenceBounds(record);
  } else {
    next.records.push(recordFromEvidence(actorId, accomplishmentId, [evidence]));
  }
  next.records.sort(compareRecords);
  next.nextSequence = nextLedgerSequence(next.nextSequence, [evidence]);
  return next;
}

export function serializeAccomplishmentLedger(
  state: AccomplishmentLedgerState
): AccomplishmentLedgerSnapshot {
  return hydrateAccomplishmentLedger(state);
}

/** Accepts versionless/partial JSON and skips malformed records or evidence. */
export function hydrateAccomplishmentLedger(value: unknown): AccomplishmentLedgerState {
  if (!isLedgerObject(value)) return createAccomplishmentLedgerState();
  const rawRecords = Array.isArray(value.records) ? value.records : [];
  const merged = new Map<string, AccomplishmentRecord>();

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
    applyEvidenceBounds(existing);
  }

  const records = [...merged.values()].sort(compareRecords);
  const evidence = records.flatMap(record => record.evidenceHistory);
  return {
    schemaVersion: ACCOMPLISHMENT_LEDGER_SCHEMA_VERSION,
    nextSequence: nextLedgerSequence(ledgerSequence(value.nextSequence) ?? 1, evidence),
    records
  };
}

export function recordAccomplishment(
  accomplishmentId: string,
  evidence: LedgerEvidenceInput,
  actorId: ActorId = getLocalActorId()
): boolean {
  const next = reduceAccomplishmentLedger(ledger, { actorId, accomplishmentId, evidence });
  if (next === ledger) return false;
  ledger = next;
  emit();
  return true;
}

export function getAccomplishment(
  accomplishmentId: string,
  actorId: ActorId = getLocalActorId()
): AccomplishmentRecord | undefined {
  const record = ledger.records.find(item => item.actorId === actorId && item.id === accomplishmentId);
  return record ? recordFromEvidence(record.actorId, record.id, record.evidenceHistory) : undefined;
}

export function listAccomplishments(actorId: ActorId = getLocalActorId()): AccomplishmentRecord[] {
  return ledger.records
    .filter(record => record.actorId === actorId)
    .map(record => recordFromEvidence(record.actorId, record.id, record.evidenceHistory));
}

export function getAccomplishmentLedgerSnapshot(): AccomplishmentLedgerSnapshot {
  return serializeAccomplishmentLedger(ledger);
}

export function applyAccomplishmentLedgerSnapshot(
  snapshot: unknown,
  options: { replace?: boolean } = {}
): void {
  const incoming = hydrateAccomplishmentLedger(snapshot);
  ledger = options.replace ?? true
    ? incoming
    : hydrateAccomplishmentLedger({
        nextSequence: Math.max(ledger.nextSequence, incoming.nextSequence),
        records: [...ledger.records, ...incoming.records]
      });
  emit();
}

export function resetAccomplishments(actorId?: ActorId): void {
  if (actorId === undefined) {
    ledger = createAccomplishmentLedgerState();
  } else {
    ledger = hydrateAccomplishmentLedger({
      nextSequence: ledger.nextSequence,
      records: ledger.records.filter(record => record.actorId !== actorId)
    });
  }
  emit();
}

export function subscribeAccomplishments(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function parseRecord(value: unknown): AccomplishmentRecord | null {
  if (!isLedgerObject(value)) return null;
  const actorId = ledgerId(value.actorId);
  const id = ledgerId(value.id);
  if (!actorId || !id) return null;
  const rawHistory = Array.isArray(value.evidenceHistory) ? value.evidenceHistory : [];
  let evidenceHistory = canonicalEvidence(
    rawHistory.map(parseEvidence).filter((item): item is LedgerEvidence => item !== null)
  );
  if (evidenceHistory.length === 0) {
    const legacySequence = ledgerSequence(value.firstEvidenceSequence);
    if (legacySequence !== null) {
      const legacy = normalizeEvidence({
        id: `legacy:${actorId}:${id}:first`,
        sequence: legacySequence,
        observedAt: typeof value.firstEvidenceAt === 'number' ? value.firstEvidenceAt : undefined
      }, legacySequence);
      if (legacy) evidenceHistory = [legacy];
    }
  }
  return evidenceHistory.length > 0 ? recordFromEvidence(actorId, id, evidenceHistory) : null;
}

function recordFromEvidence(
  actorId: ActorId,
  id: string,
  input: readonly LedgerEvidence[]
): AccomplishmentRecord {
  const evidenceHistory = canonicalEvidence(input);
  const record: AccomplishmentRecord = {
    id,
    actorId,
    firstEvidenceSequence: evidenceHistory[0]?.sequence ?? 0,
    lastEvidenceSequence: evidenceHistory[evidenceHistory.length - 1]?.sequence ?? 0,
    evidenceHistory
  };
  applyEvidenceBounds(record);
  return record;
}

function applyEvidenceBounds(record: AccomplishmentRecord): void {
  record.evidenceHistory.sort(compareLedgerEvents);
  const first = record.evidenceHistory[0];
  const last = record.evidenceHistory[record.evidenceHistory.length - 1];
  record.firstEvidenceSequence = first?.sequence ?? 0;
  record.lastEvidenceSequence = last?.sequence ?? 0;
  if (first?.observedAt === undefined) delete record.firstEvidenceAt;
  else record.firstEvidenceAt = first.observedAt;
  if (last?.observedAt === undefined) delete record.lastEvidenceAt;
  else record.lastEvidenceAt = last.observedAt;
}

function recordKey(actorId: ActorId, id: string): string {
  return `${actorId}\u0000${id}`;
}

function compareRecords(left: AccomplishmentRecord, right: AccomplishmentRecord): number {
  return left.actorId.localeCompare(right.actorId) || left.id.localeCompare(right.id);
}

function emit(): void {
  for (const listener of listeners) listener();
}
