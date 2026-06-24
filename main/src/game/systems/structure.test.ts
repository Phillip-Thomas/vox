import { describe, it, expect, beforeEach } from 'vitest';
import {
  placePiece, placeDoorway, removePiece, hasFoundationInCell, hasFoundationOnFace, hasPanel, getPieces, resetStructures,
  faceIndexForNormal, oppositeFace, setFreeBuild, canAfford
} from './structureSystem.ts';
import { pieceCost } from '../data/buildMaterials.ts';
import { addItem, getItemCount, resetInventory } from './inventorySystem.ts';

beforeEach(() => { resetStructures(); resetInventory(); setFreeBuild(false); });

function stockWood(n: number) { addItem('wood', n); }
const FOUNDATION_WOOD = pieceCost('foundation', 'wood')[0].qty;

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
    stockWood(FOUNDATION_WOOD);
    expect(placePiece([0, 0, 0], 3, 'foundation', 'wood')).toBe(true);
    expect(hasFoundationInCell(0, 0, 0)).toBe(true);
    expect(hasFoundationOnFace(0, 0, 0, 3)).toBe(true);
    expect(hasFoundationOnFace(0, 0, 0, 1)).toBe(false); // a different face is free
    expect(hasPanel(0, 0, 0, 3)).toBe(true);
    expect(getItemCount('wood')).toBe(0);
    expect(getPieces()).toHaveLength(1);
  });

  it('fails (no spend) without enough wood', () => {
    stockWood(1);
    expect(placePiece([0, 0, 0], 3, 'foundation', 'wood')).toBe(false);
    expect(getItemCount('wood')).toBe(1);
    expect(getPieces()).toHaveLength(0);
  });

  it('refuses a second panel on the same face', () => {
    stockWood(99);
    expect(placePiece([0, 0, 0], 0, 'wall', 'wood')).toBe(true);
    expect(placePiece([0, 0, 0], 0, 'wall', 'wood')).toBe(false);
  });

  it('allows foundations on DIFFERENT faces of the same cell (build around a cube edge)', () => {
    stockWood(99);
    expect(placePiece([0, 0, 0], 3, 'foundation', 'wood')).toBe(true); // floor for the +Y surface
    expect(placePiece([0, 0, 0], 1, 'foundation', 'wood')).toBe(true); // floor for the +X surface (same cell!)
    expect(hasFoundationOnFace(0, 0, 0, 3)).toBe(true);
    expect(hasFoundationOnFace(0, 0, 0, 1)).toBe(true);
  });
});

describe('doorway (2 cells tall)', () => {
  it('places a linked lower+upper pair and removes both as a unit', () => {
    stockWood(99);
    // build up = +Y (upIdx 2); doorway on the +X face (0) of cell [0,0,0].
    expect(placeDoorway([0, 0, 0], 0, 2, 'wood')).toBe(true);
    expect(hasPanel(0, 0, 0, 0)).toBe(true);  // lower half
    expect(hasPanel(0, 1, 0, 0)).toBe(true);  // upper half (one cell up along +Y)
    expect(getPieces().filter(p => p.type === 'doorway')).toHaveLength(2);
    // removing EITHER half removes both
    expect(removePiece([0, 1, 0], 0)).toBe(true);
    expect(hasPanel(0, 0, 0, 0)).toBe(false);
    expect(hasPanel(0, 1, 0, 0)).toBe(false);
  });
});

describe('free build (debug)', () => {
  it('places with no resources and spends nothing when free build is on', () => {
    setFreeBuild(true);
    expect(canAfford('foundation', 'wood')).toBe(true);
    expect(getItemCount('wood')).toBe(0);
    expect(placePiece([0, 0, 0], 3, 'foundation', 'wood')).toBe(true);
    expect(getItemCount('wood')).toBe(0); // nothing spent
    expect(hasFoundationInCell(0, 0, 0)).toBe(true);
  });
});

describe('removePiece', () => {
  it('removes a foundation, clears the cell, refunds half', () => {
    stockWood(FOUNDATION_WOOD);
    placePiece([0, 0, 0], 3, 'foundation', 'wood');
    expect(removePiece([0, 0, 0], 3)).toBe(true);
    expect(hasFoundationInCell(0, 0, 0)).toBe(false);
    expect(getPieces()).toHaveLength(0);
    expect(getItemCount('wood')).toBe(Math.floor(FOUNDATION_WOOD / 2));
  });

  it('removing a missing panel is a no-op', () => {
    expect(removePiece([5, 5, 5], 0)).toBe(false);
  });
});
