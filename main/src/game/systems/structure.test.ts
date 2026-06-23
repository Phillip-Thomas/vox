import { describe, it, expect, beforeEach } from 'vitest';
import {
  placePiece, removePiece, hasFoundation, hasPanel, getPieces, resetStructures,
  faceIndexForNormal, oppositeFace
} from './structureSystem.ts';
import { BUILD_PIECES } from '../data/buildPieces.ts';
import { addItem, getItemCount, resetInventory } from './inventorySystem.ts';

beforeEach(() => { resetStructures(); resetInventory(); });

function stockWood(n: number) { addItem('wood', n); }

describe('face helpers', () => {
  it('faceIndexForNormal picks the nearest axis face', () => {
    expect(faceIndexForNormal(0.9, 0.1, 0)).toBe(0);   // +X
    expect(faceIndexForNormal(0, 1, 0)).toBe(2);        // +Y
    expect(faceIndexForNormal(0, 0, -1)).toBe(5);       // -Z
  });
  it('oppositeFace flips along the same axis', () => {
    expect(oppositeFace(2)).toBe(3);
    expect(oppositeFace(3)).toBe(2);
  });
});

describe('placePiece / cost', () => {
  it('places a foundation, spends wood, and registers the cell', () => {
    stockWood(BUILD_PIECES.foundation.cost[0].qty);
    expect(placePiece([0, 0, 0], 3, 'foundation')).toBe(true);
    expect(hasFoundation(0, 0, 0)).toBe(true);
    expect(hasPanel(0, 0, 0, 3)).toBe(true);
    expect(getItemCount('wood')).toBe(0);
    expect(getPieces()).toHaveLength(1);
  });

  it('fails (no spend) without enough wood', () => {
    stockWood(1);
    expect(placePiece([0, 0, 0], 3, 'foundation')).toBe(false);
    expect(getItemCount('wood')).toBe(1);
    expect(getPieces()).toHaveLength(0);
  });

  it('refuses a second panel on the same face', () => {
    stockWood(99);
    expect(placePiece([0, 0, 0], 0, 'wall')).toBe(true);
    expect(placePiece([0, 0, 0], 0, 'wall')).toBe(false);
  });
});

describe('removePiece', () => {
  it('removes a foundation, clears the cell, refunds half', () => {
    stockWood(BUILD_PIECES.foundation.cost[0].qty);
    placePiece([0, 0, 0], 3, 'foundation');
    expect(removePiece([0, 0, 0], 3)).toBe(true);
    expect(hasFoundation(0, 0, 0)).toBe(false);
    expect(getPieces()).toHaveLength(0);
    expect(getItemCount('wood')).toBe(Math.floor(BUILD_PIECES.foundation.cost[0].qty / 2));
  });

  it('removing a missing panel is a no-op', () => {
    expect(removePiece([5, 5, 5], 0)).toBe(false);
  });
});
