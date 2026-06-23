import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { resolveBuildTarget, type BuildHit } from '../../utils/buildPlacement.ts';
import { placePiece, resetStructures } from './structureSystem.ts';
import { addItem, resetInventory } from './inventorySystem.ts';
import { voxelCoordToWorld } from '../../utils/cubeGravityConstants.ts';

// Use a cell well out on the +Y face so local up is unambiguously +Y (upIdx 2).
const CELL: [number, number, number] = [0, 30, 0];
function worldOf(cell: [number, number, number]): THREE.Vector3 {
  return voxelCoordToWorld(cell[0], cell[1], cell[2], new THREE.Vector3());
}

beforeEach(() => { resetStructures(); resetInventory(); addItem('wood', 999); });

describe('resolveBuildTarget', () => {
  it('foundation snaps to the cell above a terrain TOP-face hit', () => {
    const below: [number, number, number] = [CELL[0], CELL[1] - 1, CELL[2]];
    const hit: BuildHit = { cell: below, point: worldOf(below), isPanel: false, normalIdx: 2 /* +Y top */ };
    const t = resolveBuildTarget(hit, 'foundation');
    expect(t).toBeTruthy();
    expect(t!.cell).toEqual(CELL);
    expect(t!.face).toBe(3); // down face
    expect(t!.valid).toBe(true);
  });

  it('wall snaps to the foundation cell vertical face you point at', () => {
    placePiece(CELL, 3, 'foundation');
    const point = worldOf(CELL).add(new THREE.Vector3(1, 0, 0)); // toward +X edge
    const hit: BuildHit = { cell: CELL, point, isPanel: true, panelType: 'foundation', panelFace: 3, normalIdx: -1 };
    const t = resolveBuildTarget(hit, 'wall');
    expect(t!.cell).toEqual(CELL);
    expect(t!.face).toBe(0); // +X
    expect(t!.valid).toBe(true);
  });

  it('a wall hit STACKS a wall one cell up on the same face (the requested fix)', () => {
    const hit: BuildHit = { cell: CELL, point: worldOf(CELL), isPanel: true, panelType: 'wall', panelFace: 0, normalIdx: -1 };
    const t = resolveBuildTarget(hit, 'wall');
    expect(t!.cell).toEqual([0, 31, 0]); // one cell up
    expect(t!.face).toBe(0);             // same face
    expect(t!.valid).toBe(true);
  });

  it('ceiling caps a foundation cell on its up face', () => {
    placePiece(CELL, 3, 'foundation');
    const hit: BuildHit = { cell: CELL, point: worldOf(CELL), isPanel: true, panelType: 'foundation', panelFace: 3, normalIdx: -1 };
    const t = resolveBuildTarget(hit, 'ceiling');
    expect(t!.cell).toEqual(CELL);
    expect(t!.face).toBe(2); // +Y up
    expect(t!.valid).toBe(true);
  });
});
