// Pure aggregation model for the subtle "+4 STONE" resource-gain HUD toast.
//
// Gameplay commands funnel every resource gain through `CommandAccepted.deltas`.
// The shape is deliberately NOT uniform (see gameplayCommands.ts):
//   - tree / loose-stone / forage / flora / craft / harvestVoxel:  `[{ id, qty }]`
//   - mineVoxelCommand (the live in-game mine path):  `{ drops: [{ id, qty }], … }`
// so `normalizeResourceGainDeltas` accepts either and yields positive gains only.
//
// No command ever writes a negative qty into `deltas`: crafting/consume inputs
// are recorded in `rollback.refundItems`, never in `deltas`. We still filter to
// qty > 0 defensively so a future subtractive delta can never render "-3 WOOD".
//
// Time is injected (`nowMs`) so window-merge, row cap, and linger/expiry are
// deterministic under test with no timers.

/** A single normalized positive gain: `{ id: 'stone', qty: 4 }`. */
export interface ResourceGainDelta {
  id: string;
  qty: number;
}

/** One live accumulation row, keyed by item id, refreshed on each merge. */
export interface ResourceGainRow {
  id: string;
  qty: number;
  updatedAt: number;
}

export interface ResourceGainToastState {
  rows: ResourceGainRow[];
}

/** Rapid same-id gains inside this window accumulate into one growing chip. */
export const RESOURCE_GAIN_MERGE_WINDOW_MS = 1200;
/** A row stays visible this long after its last gain, then expires/fades out. */
export const RESOURCE_GAIN_LINGER_MS = 1800;
/** Distinct item rows shown at once; the remainder collapses into "+N MORE". */
export const RESOURCE_GAIN_MAX_ROWS = 3;

export interface ResourceGainDisplay {
  /** Visible rows, most-recently-updated first, capped at MAX_ROWS. */
  rows: ResourceGainRow[];
  /** Count of additional distinct item rows not shown (0 when nothing hidden). */
  overflowCount: number;
}

export function createResourceGainToastState(): ResourceGainToastState {
  return { rows: [] };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toGain(entry: unknown): ResourceGainDelta | null {
  if (!isPlainRecord(entry)) return null;
  const id = entry.id;
  const qty = entry.qty;
  if (typeof id !== 'string' || id.length === 0) return null;
  if (typeof qty !== 'number' || !Number.isFinite(qty) || qty <= 0) return null;
  return { id, qty };
}

/**
 * Coerces a raw `CommandAccepted.deltas` value into positive gains, tolerating
 * both the flat `[{ id, qty }]` array and the `{ drops: [...] }` mine wrapper.
 * Anything else (empty, undefined, non-gain command) yields `[]`.
 */
export function normalizeResourceGainDeltas(deltas: unknown): ResourceGainDelta[] {
  const list = Array.isArray(deltas)
    ? deltas
    : isPlainRecord(deltas) && Array.isArray(deltas.drops)
      ? deltas.drops
      : null;
  if (!list) return [];
  const gains: ResourceGainDelta[] = [];
  for (const entry of list) {
    const gain = toGain(entry);
    if (gain) gains.push(gain);
  }
  return gains;
}

/** Drops rows whose last gain is older than the linger window. */
export function pruneResourceGainRows(
  state: ResourceGainToastState,
  nowMs: number
): ResourceGainToastState {
  const rows = state.rows.filter(row => nowMs - row.updatedAt < RESOURCE_GAIN_LINGER_MS);
  return rows.length === state.rows.length ? state : { rows };
}

/**
 * Folds a batch of gains into the state at `nowMs`. Same-id gains within the
 * merge window accumulate (`+4` then `+2` → `+6 STONE`); a same-id gain after
 * the window (but before expiry) restarts that row's count fresh.
 */
export function ingestResourceGain(
  state: ResourceGainToastState,
  deltas: ResourceGainDelta[],
  nowMs: number
): ResourceGainToastState {
  if (deltas.length === 0) return pruneResourceGainRows(state, nowMs);

  // Start from the still-live rows so expiry never resurrects a stale chip.
  const rows = state.rows.filter(row => nowMs - row.updatedAt < RESOURCE_GAIN_LINGER_MS);
  const index = new Map<string, number>();
  rows.forEach((row, i) => index.set(row.id, i));

  for (const gain of deltas) {
    const existing = index.get(gain.id);
    if (existing === undefined) {
      index.set(gain.id, rows.length);
      rows.push({ id: gain.id, qty: gain.qty, updatedAt: nowMs });
      continue;
    }
    const row = rows[existing];
    const withinWindow = nowMs - row.updatedAt <= RESOURCE_GAIN_MERGE_WINDOW_MS;
    rows[existing] = {
      id: row.id,
      qty: withinWindow ? row.qty + gain.qty : gain.qty,
      updatedAt: nowMs
    };
  }

  return { rows };
}

/**
 * Selects the visible rows (most-recent-first, capped) plus the hidden-row
 * count. Deterministic tie-break by id so a multi-drop command renders stably.
 */
export function getResourceGainDisplay(
  state: ResourceGainToastState,
  nowMs: number
): ResourceGainDisplay {
  const live = state.rows
    .filter(row => nowMs - row.updatedAt < RESOURCE_GAIN_LINGER_MS)
    .sort((a, b) => (b.updatedAt - a.updatedAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return {
    rows: live.slice(0, RESOURCE_GAIN_MAX_ROWS),
    overflowCount: Math.max(0, live.length - RESOURCE_GAIN_MAX_ROWS)
  };
}

/** Terse gain label body, e.g. `+4`. Item name is resolved by the component. */
export function formatResourceGainQty(qty: number): string {
  return `+${Math.max(0, Math.round(qty))}`;
}
