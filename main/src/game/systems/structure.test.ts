import { describe, it, expect, beforeEach } from 'vitest';
import {
  placePiece, placeDoorway, fitDoor, placeVolume, toggleDoor, removePiece, hasFoundationInCell, hasFoundationOnFace,
  hasPanel, hasVolume, getVolumeAt, getPieceAt, getPieces, resetStructures,
  faceIndexForNormal, oppositeFace, setFreeBuild, canAfford, isStructurePieceSolid,
  getStructureVersion, subscribeStructures
} from './structureSystem.ts';
import { pieceCost } from '../data/buildMaterials.ts';
import { addItem, getItemCount, resetAllInventories } from './inventorySystem.ts';

beforeEach(() => { resetStructures(); resetAllInventories(); setFreeBuild(false); });

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

  it('records owner metadata for actor-scoped placement', () => {
    addItem('wood', FOUNDATION_WOOD, 'alice');
    expect(placePiece([0, 0, 0], 3, 'foundation', 'wood', undefined, 'alice')).toBe(true);
    expect(getPieceAt(0, 0, 0, 3)).toMatchObject({ ownerId: 'alice', placedBy: 'alice' });
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

describe('door fits into a doorway as a leaf (not on bare walls)', () => {
  it('requires a doorway, adds a closeable leaf to both halves, toggles + removes together', () => {
    setFreeBuild(true);
    expect(fitDoor([0, 0, 0], 0, 'wood')).toBe(false); // no doorway here → no door

    expect(placeDoorway([0, 0, 0], 0, 2, 'wood')).toBe(true); // build-up = +Y (idx 2)
    expect(fitDoor([0, 0, 0], 0, 'wood')).toBe(true);         // fit a leaf into it
    expect(getPieceAt(0, 0, 0, 0)?.leaf).toBe(true);
    expect(getPieceAt(0, 1, 0, 0)?.leaf).toBe(true);          // both halves get the leaf
    expect(fitDoor([0, 0, 0], 0, 'wood')).toBe(false);        // already doored

    expect(getPieceAt(0, 0, 0, 0)?.open).toBeFalsy();         // closed by default
    expect(toggleDoor([0, 1, 0], 0)).toBe(true);              // toggle from either half
    expect(getPieceAt(0, 0, 0, 0)?.open).toBe(true);
    expect(getPieceAt(0, 1, 0, 0)?.open).toBe(true);

    expect(removePiece([0, 1, 0], 0)).toBe(true);             // removes both halves
    expect(hasPanel(0, 0, 0, 0)).toBe(false);
    expect(hasPanel(0, 1, 0, 0)).toBe(false);
  });

  it('treats fitted closed doorways as solid physics and open doorways as passable', () => {
    setFreeBuild(true);

    expect(placeDoorway([0, 0, 0], 0, 2, 'wood')).toBe(true);
    expect(isStructurePieceSolid(getPieceAt(0, 0, 0, 0)!)).toBe(false);

    expect(fitDoor([0, 0, 0], 0, 'wood')).toBe(true);
    expect(isStructurePieceSolid(getPieceAt(0, 0, 0, 0)!)).toBe(true);
    expect(isStructurePieceSolid(getPieceAt(0, 1, 0, 0)!)).toBe(true);

    expect(toggleDoor([0, 0, 0], 0)).toBe(true);
    expect(isStructurePieceSolid(getPieceAt(0, 0, 0, 0)!)).toBe(false);
    expect(isStructurePieceSolid(getPieceAt(0, 1, 0, 0)!)).toBe(false);
  });
});

describe('build frame is stored on each piece (corner-build consistency)', () => {
  it('placePiece records the build-up axis so connecting pieces can inherit it', () => {
    setFreeBuild(true);
    placePiece([5, 0, 0], 3, 'foundation', 'wood', 2); // up = +Y
    expect(getPieceAt(5, 0, 0, 3)?.up).toBe(2);
    placePiece([6, 0, 0], 1, 'wall', 'wood', 0); // a wall framed to +X
    expect(getPieceAt(6, 0, 0, 1)?.up).toBe(0);
  });
});

describe('volume pieces (stairs/roof) + door toggle', () => {
  it('places an oriented volume piece in a cell and blocks a second in the same cell', () => {
    setFreeBuild(true);
    expect(placeVolume([0, 0, 0], 2, 1, 'stairs', 'wood')).toBe(true);
    expect(hasVolume(0, 0, 0)).toBe(true);
    const v = getVolumeAt(0, 0, 0);
    expect(v?.type).toBe('stairs');
    expect(v?.up).toBe(2);
    expect(v?.orient).toBe(1);
    expect(placeVolume([0, 0, 0], 2, 0, 'sloped_roof', 'wood')).toBe(false); // cell's volume slot taken
    // a panel can still occupy the same cell's faces (volume slot is separate)
    expect(placePiece([0, 0, 0], 0, 'wall', 'wood')).toBe(true);
  });

  it('a door toggles open/closed; non-openable pieces do not', () => {
    setFreeBuild(true);
    expect(placePiece([1, 0, 0], 0, 'door', 'wood')).toBe(true);
    expect(getPieceAt(1, 0, 0, 0)?.open).toBeFalsy(); // closed by default
    expect(toggleDoor([1, 0, 0], 0)).toBe(true);
    expect(getPieceAt(1, 0, 0, 0)?.open).toBe(true);
    expect(toggleDoor([1, 0, 0], 0)).toBe(true);
    expect(getPieceAt(1, 0, 0, 0)?.open).toBe(false);
    placePiece([2, 0, 0], 0, 'wall', 'wood');
    expect(toggleDoor([2, 0, 0], 0)).toBe(false); // a wall isn't openable
  });

  it('bumps structure version and subscribers for collider-affecting edits', () => {
    setFreeBuild(true);
    let emits = 0;
    const unsubscribe = subscribeStructures(() => { emits += 1; });
    const start = getStructureVersion();

    expect(placePiece([1, 0, 0], 0, 'door', 'wood')).toBe(true);
    const placed = getStructureVersion();
    expect(placed).toBeGreaterThan(start);

    expect(toggleDoor([1, 0, 0], 0)).toBe(true);
    const toggled = getStructureVersion();
    expect(toggled).toBeGreaterThan(placed);
    expect(isStructurePieceSolid(getPieceAt(1, 0, 0, 0)!)).toBe(false);

    expect(removePiece([1, 0, 0], 0)).toBe(true);
    expect(getStructureVersion()).toBeGreaterThan(toggled);
    expect(emits).toBe(3);
    unsubscribe();
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

  it('refunds removed pieces to the owner, not the actor doing removal', () => {
    addItem('wood', FOUNDATION_WOOD, 'alice');
    placePiece([0, 0, 0], 3, 'foundation', 'wood', undefined, 'alice');

    expect(removePiece([0, 0, 0], 3, 'bob')).toBe(true);

    expect(getItemCount('wood', 'alice')).toBe(Math.floor(FOUNDATION_WOOD / 2));
    expect(getItemCount('wood', 'bob')).toBe(0);
  });

  it('removing a missing panel is a no-op', () => {
    expect(removePiece([5, 5, 5], 0)).toBe(false);
  });
});
