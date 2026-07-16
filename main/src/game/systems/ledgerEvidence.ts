// Shared, JSON-safe evidence primitives for player-owned narrative ledgers.
//
// The ledgers deliberately use logical sequence numbers as their ordering
// authority. Wall-clock timestamps are optional context only: two clients can
// replay the same commands and still serialize byte-for-byte equivalent state.

export type LedgerJsonValue =
  | string
  | number
  | boolean
  | null
  | LedgerJsonValue[]
  | { [key: string]: LedgerJsonValue };

export interface LedgerEvidence {
  id: string;
  sequence: number;
  observedAt?: number;
  worldId?: string;
  sourceKey?: string;
  data?: { [key: string]: LedgerJsonValue };
}

export interface LedgerEvidenceInput {
  id: string;
  sequence?: number;
  observedAt?: number;
  worldId?: string;
  sourceKey?: string;
  data?: { [key: string]: LedgerJsonValue };
}

export interface LedgerActionInput {
  id: string;
  sequence?: number;
  observedAt?: number;
}

export function isLedgerObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function ledgerId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const id = value.trim();
  return id.length > 0 ? id : null;
}

export function ledgerSequence(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

export function ledgerTimestamp(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

export function compareLedgerEvents(
  left: Pick<LedgerEvidence, 'sequence' | 'id'>,
  right: Pick<LedgerEvidence, 'sequence' | 'id'>
): number {
  return left.sequence - right.sequence || left.id.localeCompare(right.id);
}

export function normalizeEvidence(
  input: LedgerEvidenceInput,
  fallbackSequence: number
): LedgerEvidence | null {
  const id = ledgerId(input.id);
  if (!id) return null;
  const explicitSequence = ledgerSequence(input.sequence);
  const sequence = explicitSequence ?? fallbackSequence;
  const observedAt = ledgerTimestamp(input.observedAt);
  const worldId = ledgerId(input.worldId);
  const sourceKey = ledgerId(input.sourceKey);
  const data = normalizeJsonObject(input.data);
  return {
    id,
    sequence,
    ...(observedAt === undefined ? {} : { observedAt }),
    ...(worldId === null ? {} : { worldId }),
    ...(sourceKey === null ? {} : { sourceKey }),
    ...(data === undefined ? {} : { data })
  };
}

export function parseEvidence(value: unknown): LedgerEvidence | null {
  if (!isLedgerObject(value)) return null;
  const id = ledgerId(value.id);
  const sequence = ledgerSequence(value.sequence);
  if (!id || sequence === null) return null;
  return normalizeEvidence({
    id,
    sequence,
    observedAt: ledgerTimestamp(value.observedAt),
    worldId: ledgerId(value.worldId) ?? undefined,
    sourceKey: ledgerId(value.sourceKey) ?? undefined,
    data: normalizeJsonObject(value.data)
  }, sequence);
}

export function canonicalEvidence(values: readonly LedgerEvidence[]): LedgerEvidence[] {
  const ordered = values
    .map(value => parseEvidence(value))
    .filter((value): value is LedgerEvidence => value !== null)
    .sort(compareLedgerEvents);
  const seen = new Set<string>();
  const result: LedgerEvidence[] = [];
  for (const value of ordered) {
    if (seen.has(value.id)) continue;
    seen.add(value.id);
    result.push(value);
  }
  return result;
}

export function nextLedgerSequence(
  current: number,
  events: ReadonlyArray<{ sequence: number }>
): number {
  let next = Math.max(1, ledgerSequence(current) ?? 1);
  for (const event of events) next = Math.max(next, event.sequence + 1);
  return next;
}

function normalizeJsonObject(value: unknown): { [key: string]: LedgerJsonValue } | undefined {
  if (!isLedgerObject(value)) return undefined;
  const result: { [key: string]: LedgerJsonValue } = {};
  for (const key of Object.keys(value).sort()) {
    const normalized = normalizeJsonValue(value[key]);
    if (normalized !== undefined) result[key] = normalized;
  }
  return result;
}

function normalizeJsonValue(value: unknown): LedgerJsonValue | undefined {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value)) {
    return value
      .map(normalizeJsonValue)
      .filter((item): item is LedgerJsonValue => item !== undefined);
  }
  return normalizeJsonObject(value);
}
