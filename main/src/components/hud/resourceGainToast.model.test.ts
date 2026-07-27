import { describe, expect, it } from 'vitest';
import {
  RESOURCE_GAIN_LINGER_MS,
  RESOURCE_GAIN_MAX_ROWS,
  RESOURCE_GAIN_MERGE_WINDOW_MS,
  createResourceGainToastState,
  formatResourceGainQty,
  getResourceGainDisplay,
  ingestResourceGain,
  normalizeResourceGainDeltas,
  pruneResourceGainRows,
  type ResourceGainToastState
} from './resourceGainToast.model.ts';

function ingestRaw(state: ResourceGainToastState, deltas: unknown, nowMs: number) {
  return ingestResourceGain(state, normalizeResourceGainDeltas(deltas), nowMs);
}

describe('resourceGainToast normalize', () => {
  it('accepts the flat [{ id, qty }] delta shape (tree/stone/forage/craft)', () => {
    expect(normalizeResourceGainDeltas([{ id: 'wood', qty: 3 }])).toEqual([{ id: 'wood', qty: 3 }]);
  });

  it('accepts the mineVoxel { drops: [...] } wrapper shape', () => {
    const deltas = { drops: [{ id: 'stone', qty: 2 }], exposedNeighbors: 4, flooded: [] };
    expect(normalizeResourceGainDeltas(deltas)).toEqual([{ id: 'stone', qty: 2 }]);
  });

  it('ignores empty, undefined, and non-gain command deltas', () => {
    expect(normalizeResourceGainDeltas(undefined)).toEqual([]);
    expect(normalizeResourceGainDeltas([])).toEqual([]);
    expect(normalizeResourceGainDeltas({ drops: [] })).toEqual([]);
    expect(normalizeResourceGainDeltas({ amount: 60 })).toEqual([]);
  });

  it('drops zero, negative, and malformed entries defensively', () => {
    const deltas = [
      { id: 'wood', qty: 4 },
      { id: 'stone', qty: 0 },
      { id: 'silica', qty: -2 },
      { id: '', qty: 5 },
      { qty: 5 },
      { id: 'iron_trace' },
      { id: 'resin', qty: Number.NaN }
    ];
    expect(normalizeResourceGainDeltas(deltas)).toEqual([{ id: 'wood', qty: 4 }]);
  });
});

describe('resourceGainToast aggregation', () => {
  it('merges same-id gains within the rolling window into one growing chip', () => {
    let s = createResourceGainToastState();
    s = ingestRaw(s, [{ id: 'stone', qty: 1 }], 0);
    s = ingestRaw(s, [{ id: 'stone', qty: 1 }], 300);
    s = ingestRaw(s, [{ id: 'stone', qty: 2 }], RESOURCE_GAIN_MERGE_WINDOW_MS); // still within window
    const display = getResourceGainDisplay(s, RESOURCE_GAIN_MERGE_WINDOW_MS);
    expect(display.rows).toHaveLength(1);
    expect(display.rows[0]).toMatchObject({ id: 'stone', qty: 4 });
  });

  it('restarts the count when a same-id gain lands after the window but before expiry', () => {
    let s = createResourceGainToastState();
    s = ingestRaw(s, [{ id: 'stone', qty: 5 }], 0);
    const after = RESOURCE_GAIN_MERGE_WINDOW_MS + 1; // window passed, still lingering
    s = ingestRaw(s, [{ id: 'stone', qty: 2 }], after);
    const display = getResourceGainDisplay(s, after);
    expect(display.rows).toHaveLength(1);
    expect(display.rows[0]).toMatchObject({ id: 'stone', qty: 2 });
  });

  it('shows distinct items as separate rows, most-recent first', () => {
    let s = createResourceGainToastState();
    s = ingestRaw(s, [{ id: 'wood', qty: 3 }], 0);
    s = ingestRaw(s, [{ id: 'stone', qty: 2 }], 100);
    const display = getResourceGainDisplay(s, 100);
    expect(display.rows.map(r => r.id)).toEqual(['stone', 'wood']);
    expect(display.overflowCount).toBe(0);
  });

  it('caps visible rows and collapses the remainder into an overflow count', () => {
    let s = createResourceGainToastState();
    s = ingestRaw(s, [{ id: 'wood', qty: 1 }], 0);
    s = ingestRaw(s, [{ id: 'stone', qty: 1 }], 10);
    s = ingestRaw(s, [{ id: 'silica', qty: 1 }], 20);
    s = ingestRaw(s, [{ id: 'resin', qty: 1 }], 30);
    s = ingestRaw(s, [{ id: 'biofiber', qty: 1 }], 40);
    const display = getResourceGainDisplay(s, 40);
    expect(display.rows).toHaveLength(RESOURCE_GAIN_MAX_ROWS);
    expect(display.rows.map(r => r.id)).toEqual(['biofiber', 'resin', 'silica']);
    expect(display.overflowCount).toBe(2);
  });

  it('merges a multi-drop command batch atomically at one timestamp', () => {
    let s = createResourceGainToastState();
    // A single command can carry several drops (deposit bonus): one nowMs.
    s = ingestRaw(s, { drops: [{ id: 'stone', qty: 2 }, { id: 'copper_ore', qty: 1 }] }, 500);
    const display = getResourceGainDisplay(s, 500);
    expect(display.rows.map(r => `${r.id}:${r.qty}`).sort()).toEqual(['copper_ore:1', 'stone:2']);
  });
});

describe('resourceGainToast linger & expiry', () => {
  it('keeps a row visible until the linger window elapses, then drops it', () => {
    let s = createResourceGainToastState();
    s = ingestRaw(s, [{ id: 'wood', qty: 4 }], 0);
    expect(getResourceGainDisplay(s, RESOURCE_GAIN_LINGER_MS - 1).rows).toHaveLength(1);
    expect(getResourceGainDisplay(s, RESOURCE_GAIN_LINGER_MS).rows).toHaveLength(0);
  });

  it('prunes expired rows from state without touching live ones', () => {
    let s = createResourceGainToastState();
    s = ingestRaw(s, [{ id: 'wood', qty: 1 }], 0);
    s = ingestRaw(s, [{ id: 'stone', qty: 1 }], RESOURCE_GAIN_LINGER_MS - 100);
    s = pruneResourceGainRows(s, RESOURCE_GAIN_LINGER_MS);
    expect(s.rows.map(r => r.id)).toEqual(['stone']);
  });

  it('ingesting after full expiry starts fresh rather than resurrecting a chip', () => {
    let s = createResourceGainToastState();
    s = ingestRaw(s, [{ id: 'stone', qty: 9 }], 0);
    s = ingestRaw(s, [{ id: 'stone', qty: 2 }], RESOURCE_GAIN_LINGER_MS + 5);
    const display = getResourceGainDisplay(s, RESOURCE_GAIN_LINGER_MS + 5);
    expect(display.rows).toHaveLength(1);
    expect(display.rows[0]).toMatchObject({ id: 'stone', qty: 2 });
  });

  it('an empty batch prunes but never creates a row', () => {
    let s = createResourceGainToastState();
    s = ingestRaw(s, undefined, 0);
    expect(s.rows).toHaveLength(0);
    s = ingestRaw(s, { drops: [] }, 0);
    expect(s.rows).toHaveLength(0);
  });
});

describe('resourceGainToast format', () => {
  it('formats a terse signed quantity', () => {
    expect(formatResourceGainQty(4)).toBe('+4');
    expect(formatResourceGainQty(1)).toBe('+1');
    expect(formatResourceGainQty(12.6)).toBe('+13');
  });
});
