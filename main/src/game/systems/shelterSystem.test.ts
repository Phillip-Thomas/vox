import { beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { addItem, resetInventory } from './inventorySystem.ts';
import {
  applyDoorLeaf,
  placeDoorway,
  placePiece,
  resetStructures,
  setDoorOpen,
  setFreeBuild
} from './structureSystem.ts';
import { analyzeShelterCell, findShelterSpawn, isNearCampfire } from './shelterSystem.ts';
import { placeCampfire, resetCampfires } from './campfires.ts';
import { getBuildPiece } from '../data/buildPieces.ts';

const LOWER: [number, number, number] = [0, 30, 0];
const UPPER: [number, number, number] = [0, 31, 0];

function buildTwoCellRoom(withDoor = false) {
  placePiece(LOWER, 3, 'foundation', 'wood', 2);
  placePiece(UPPER, 2, 'ceiling', 'wood', 2);
  for (const cell of [LOWER, UPPER] as const) {
    for (const face of [0, 1, 4, 5]) {
      if (withDoor && face === 0) continue;
      placePiece(cell, face, 'wall', 'wood', 2);
    }
  }
  if (withDoor) placeDoorway(LOWER, 0, 2, 'wood');
}

beforeEach(() => {
  resetStructures();
  resetCampfires();
  resetInventory();
  addItem('wood', 999);
  setFreeBuild(true);
});

describe('shelter enclosure', () => {
  it('recognizes a two-cell-tall sealed room', () => {
    buildTwoCellRoom();
    const result = analyzeShelterCell(LOWER);
    expect(result.sheltered).toBe(true);
    expect(result.interiorCells).toContainEqual(UPPER);
    expect(result.insulation).toBeGreaterThan(0);
  });

  it('treats a missing wall as exposure', () => {
    buildTwoCellRoom();
    resetStructures();
    placePiece(LOWER, 3, 'foundation', 'wood', 2);
    placePiece(UPPER, 2, 'ceiling', 'wood', 2);
    for (const cell of [LOWER, UPPER] as const) {
      for (const face of [0, 1, 4]) placePiece(cell, face, 'wall', 'wood', 2);
    }
    expect(analyzeShelterCell(LOWER).sheltered).toBe(false);
  });

  it('a fitted door seals only while closed', () => {
    buildTwoCellRoom(true);
    expect(analyzeShelterCell(LOWER).sheltered).toBe(false);
    expect(applyDoorLeaf(LOWER, 0)).toBe(true);
    expect(analyzeShelterCell(LOWER).sheltered).toBe(true);
    expect(setDoorOpen(LOWER, 0, true)).toBe(true);
    expect(analyzeShelterCell(LOWER).sheltered).toBe(false);
  });

  it('an unfinished window opening remains exposed', () => {
    buildTwoCellRoom();
    resetStructures();
    placePiece(LOWER, 3, 'foundation', 'wood', 2);
    placePiece(UPPER, 2, 'ceiling', 'wood', 2);
    for (const cell of [LOWER, UPPER] as const) {
      for (const face of [0, 1, 4, 5]) {
        placePiece(cell, face, cell === LOWER && face === 4 ? 'window' : 'wall', 'wood', 2);
      }
    }
    expect(analyzeShelterCell(LOWER).sheltered).toBe(false);
  });

  it('certifies a room built on a vertical cube face', () => {
    const lower: [number, number, number] = [30, 0, 0];
    const upper: [number, number, number] = [31, 0, 0];
    placePiece(lower, 1, 'foundation', 'wood', 0);
    placePiece(upper, 0, 'ceiling', 'wood', 0);
    for (const cell of [lower, upper] as const) {
      for (const face of [2, 3, 4, 5]) placePiece(cell, face, 'wall', 'wood', 0);
    }
    expect(analyzeShelterCell(lower).sheltered).toBe(true);
    expect(findShelterSpawn(new THREE.Vector3(60, 0, 0))?.up.toArray()).toEqual([1, 0, 0]);
  });

  it('ignores an unrelated distant build when certifying a local shelter', () => {
    buildTwoCellRoom();
    placePiece([100, 100, 100], 3, 'foundation', 'wood', 2);
    expect(analyzeShelterCell(LOWER).sheltered).toBe(true);
  });

  it('selects a valid standing recovery point inside the nearest sealed room', () => {
    buildTwoCellRoom();
    const spawn = findShelterSpawn(new THREE.Vector3(0, 60, 0));
    expect(spawn).not.toBeNull();
    expect(spawn?.cell).toEqual(LOWER);
    expect(spawn?.up.toArray()).toEqual([0, 1, 0]);
    expect(spawn?.position.y).toBeGreaterThan(LOWER[1] * 2);
  });

  it('uses a bounded campfire warmth radius', () => {
    placeCampfire(new THREE.Vector3(0, 60, 0), new THREE.Vector3(0, 1, 0));
    expect(isNearCampfire(new THREE.Vector3(5, 60, 0))).toBe(true);
    expect(isNearCampfire(new THREE.Vector3(8, 60, 0))).toBe(false);
  });

  it('labels sloped roofs as decorative until volume sealing is implemented', () => {
    expect(getBuildPiece('sloped_roof')).toMatchObject({
      name: 'Sloped Roof (Decorative)',
      shape: 'volume',
      seals: false
    });
  });
});
