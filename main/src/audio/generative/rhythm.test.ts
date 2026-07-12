import { describe, expect, it } from 'vitest';
import {
  euclid,
  humanizeOffsetMs,
  RHYTHM_CELL_IDS,
  RHYTHM_CELLS,
  rotatePattern,
  SLOTS_PER_BAR
} from './rhythm.ts';
import { HUMAN_JITTER_MS } from './tuning.ts';

describe('Euclidean generator (§8.2, Toussaint)', () => {
  it('E(3,8) is the tresillo', () => {
    expect(euclid(3, 8)).toEqual([0, 3, 6]);
  });

  it('always distributes exactly k onsets over n slots', () => {
    for (let n = 1; n <= 16; n++) {
      for (let k = 0; k <= n; k++) {
        const onsets = euclid(k, n);
        expect(onsets.length).toBe(k);
        for (const slot of onsets) {
          expect(slot).toBeGreaterThanOrEqual(0);
          expect(slot).toBeLessThan(n);
        }
      }
    }
  });

  it('degenerates sensibly at the edges', () => {
    expect(euclid(0, 8)).toEqual([]);
    expect(euclid(8, 8)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(euclid(3, 0)).toEqual([]);
  });
});

describe('rotation — THE variation operator (§8.2)', () => {
  it('rotates and re-sorts', () => {
    expect(rotatePattern([0, 3, 6], 8, 2)).toEqual([0, 2, 5]);
  });

  it('preserves onset count and full-cycle rotation is identity', () => {
    const base = euclid(5, 16);
    for (let r = 0; r < 16; r++) {
      expect(rotatePattern(base, 16, r).length).toBe(base.length);
    }
    expect(rotatePattern(base, 16, 16)).toEqual(base);
    expect(rotatePattern(base, 16, -16)).toEqual(base);
  });
});

describe('the curated cell library (§7.1)', () => {
  it('contains exactly the eight documented cells', () => {
    expect(RHYTHM_CELL_IDS).toEqual([
      'CELL_TIME', 'CELL_DAYONE', 'CELL_TRESILLO', 'CELL_CINQUILLO',
      'CELL_EIGHTS', 'CELL_HALF', 'CELL_OFFBEAT', 'CELL_GALLOP'
    ]);
    expect(Object.keys(RHYTHM_CELLS).sort()).toEqual([...RHYTHM_CELL_IDS].sort());
  });

  it('keeps every cell well-formed on the 16-slot bar', () => {
    for (const id of RHYTHM_CELL_IDS) {
      const cell = RHYTHM_CELLS[id];
      expect(cell.id).toBe(id);
      expect(cell.onsets.length).toBeGreaterThan(0);
      for (let i = 0; i < cell.onsets.length; i++) {
        expect(cell.onsets[i]).toBeGreaterThanOrEqual(0);
        expect(cell.onsets[i]).toBeLessThan(SLOTS_PER_BAR);
        if (i > 0) expect(cell.onsets[i]).toBeGreaterThan(cell.onsets[i - 1]);
      }
    }
  });

  it('CELL_TRESILLO and CELL_CINQUILLO are true Euclidean patterns', () => {
    // Tresillo: E(3,8) on the 8th grid, doubled onto sixteenths.
    expect(RHYTHM_CELLS.CELL_TRESILLO.onsets).toEqual(euclid(3, 8).map((s) => s * 2));
    // Cinquillo: the classic rotation of E(5,8), doubled onto sixteenths.
    expect(RHYTHM_CELLS.CELL_CINQUILLO.onsets).toEqual(
      rotatePattern(euclid(5, 8), 8, 6).map((s) => s * 2)
    );
  });
});

describe('humanization (§8.2)', () => {
  it('is machine-perfect at organic 0 (chip law)', () => {
    for (let i = 0; i < 32; i++) expect(humanizeOffsetMs(99, i, 0)).toBe(0);
  });

  it('is bounded by HUMAN_JITTER_MS × organic and deterministic', () => {
    for (const organic of [0.25, 0.5, 1]) {
      for (let i = 0; i < 64; i++) {
        const a = humanizeOffsetMs(1234, i, organic);
        expect(Math.abs(a)).toBeLessThanOrEqual(HUMAN_JITTER_MS * organic);
        expect(humanizeOffsetMs(1234, i, organic)).toBe(a);
      }
    }
  });

  it('varies across notes and seeds', () => {
    const values = new Set<number>();
    for (let i = 0; i < 16; i++) values.add(humanizeOffsetMs(7, i, 1));
    expect(values.size).toBeGreaterThan(8);
    expect(humanizeOffsetMs(7, 3, 1)).not.toBe(humanizeOffsetMs(8, 3, 1));
  });
});
