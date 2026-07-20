import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MaterialType } from '../types/materials.ts';
import {
  fitDoor,
  placeDoorway,
  placePiece,
  placeVolume,
  resetStructures,
  setFreeBuild,
  toggleDoor
} from '../game/systems/structureSystem.ts';
import {
  markTreeHarvested,
  resetTreeHarvest,
  unmarkTreeHarvested
} from '../game/systems/treeHarvest.ts';
import { buildFaunaProfile } from './faunaField.ts';
import { voxelSystem } from './efficientVoxelSystem.ts';
import { shouldPlaceTreeAtVoxel } from './treePopulation.ts';
import {
  createLiveFaunaNavigationObstacles,
  isFaunaStructureAnchorBlocked,
  isFaunaStructureRouteBlocked
} from './faunaNavigationObstacles.ts';

const grassColor = new THREE.Color(0x7cb342);
const TERRAIN_SEED = 3215739679;

afterEach(() => {
  resetStructures();
  resetTreeHarvest();
  voxelSystem.reset();
  setFreeBuild(false);
});

describe('faunaNavigationObstacles', () => {
  it('blocks a solid panel from either side of an edge but not parallel travel', () => {
    setFreeBuild(true);
    expect(placePiece([0, 26, 0], 0, 'wall', 'wood', 2)).toBe(true);
    expect(isFaunaStructureRouteBlocked(0, 25, 0, 1, 25, 0)).toBe(true);
    expect(isFaunaStructureRouteBlocked(0, 25, 0, 0, 25, 1)).toBe(false);

    resetStructures();
    expect(placePiece([1, 26, 0], 1, 'wall', 'wood', 2)).toBe(true);
    expect(isFaunaStructureRouteBlocked(0, 25, 0, 1, 25, 0)).toBe(true);
  });

  it('honors doorway and door solidity immediately', () => {
    setFreeBuild(true);
    expect(placeDoorway([0, 26, 0], 0, 2, 'wood')).toBe(true);
    expect(isFaunaStructureRouteBlocked(0, 25, 0, 1, 25, 0)).toBe(false);
    expect(fitDoor([0, 26, 0], 0, 'wood')).toBe(true);
    expect(isFaunaStructureRouteBlocked(0, 25, 0, 1, 25, 0)).toBe(true);
    expect(toggleDoor([0, 26, 0], 0)).toBe(true);
    expect(isFaunaStructureRouteBlocked(0, 25, 0, 1, 25, 0)).toBe(false);
    expect(toggleDoor([0, 26, 0], 0)).toBe(true);
    expect(isFaunaStructureRouteBlocked(0, 25, 0, 1, 25, 0)).toBe(true);
  });

  it('treats volumes as occupied but foundations underfoot as walkable', () => {
    setFreeBuild(true);
    expect(placePiece([1, 26, 0], 3, 'foundation', 'wood', 2)).toBe(true);
    expect(isFaunaStructureAnchorBlocked(1, 25, 0)).toBe(false);
    expect(isFaunaStructureRouteBlocked(0, 25, 0, 1, 25, 0)).toBe(false);

    expect(placeVolume([1, 26, 0], 2, 0, 'stairs', 'wood')).toBe(true);
    expect(isFaunaStructureAnchorBlocked(1, 25, 0)).toBe(true);
    expect(isFaunaStructureRouteBlocked(0, 25, 0, 1, 25, 0)).toBe(true);
  });

  it('respects species body height beneath solid ceilings', () => {
    setFreeBuild(true);
    expect(placePiece([0, 26, 0], 2, 'ceiling', 'wood', 2)).toBe(true);
    expect(isFaunaStructureAnchorBlocked(0, 25, 0, 1)).toBe(false);
    expect(isFaunaStructureAnchorBlocked(0, 25, 0, 2)).toBe(true);
  });

  it('maps wall edges correctly on all six cube faces', () => {
    setFreeBuild(true);
    const cases = [
      { from: [0, 25, 0], to: [1, 25, 0], standing: [0, 26, 0], face: 0 },
      { from: [0, -25, 0], to: [1, -25, 0], standing: [0, -26, 0], face: 0 },
      { from: [25, 0, 0], to: [25, 1, 0], standing: [26, 0, 0], face: 2 },
      { from: [-25, 0, 0], to: [-25, 1, 0], standing: [-26, 0, 0], face: 2 },
      { from: [0, 0, 25], to: [1, 0, 25], standing: [0, 0, 26], face: 0 },
      { from: [0, 0, -25], to: [1, 0, -25], standing: [0, 0, -26], face: 0 }
    ] as const;
    for (const entry of cases) {
      resetStructures();
      expect(placePiece([...entry.standing], entry.face, 'wall', 'wood', 2)).toBe(true);
      expect(isFaunaStructureRouteBlocked(
        entry.from[0], entry.from[1], entry.from[2],
        entry.to[0], entry.to[1], entry.to[2]
      )).toBe(true);
    }
  });

  it('projects each endpoint independently across a cube edge', () => {
    setFreeBuild(true);
    // Top support -> right-face support. The destination floor is its -X face;
    // it must not be mistaken for the incoming +Y wall edge.
    expect(placePiece([26, 24, 0], 1, 'foundation', 'wood', 0)).toBe(true);
    expect(isFaunaStructureRouteBlocked(24, 25, 0, 25, 24, 0)).toBe(false);

    expect(placePiece([24, 26, 0], 0, 'wall', 'wood', 2)).toBe(true);
    expect(isFaunaStructureRouteBlocked(24, 25, 0, 25, 24, 0)).toBe(true);

    resetStructures();
    expect(placePiece([26, 24, 0], 2, 'wall', 'wood', 0)).toBe(true);
    expect(isFaunaStructureRouteBlocked(24, 25, 0, 25, 24, 0)).toBe(true);
  });

  it('keeps exact cube-edge tie steps open instead of inventing a seam wall', () => {
    setFreeBuild(true);
    // The destination tie resolves to +X up, making its incoming projection
    // radial; only the top-face source has a meaningful tangent boundary.
    expect(placePiece([26, 25, 0], 1, 'foundation', 'wood', 0)).toBe(true);
    expect(isFaunaStructureRouteBlocked(24, 25, 0, 25, 25, 0)).toBe(false);
    expect(isFaunaStructureRouteBlocked(25, 25, 0, 24, 25, 0)).toBe(false);

    expect(placePiece([24, 26, 0], 0, 'wall', 'wood', 2)).toBe(true);
    expect(isFaunaStructureRouteBlocked(24, 25, 0, 25, 25, 0)).toBe(true);
  });

  it('checks both stored sides of a wall during height-changing steps', () => {
    setFreeBuild(true);
    expect(isFaunaStructureRouteBlocked(0, 25, 0, 1, 26, 0)).toBe(false);

    // Same lower boundary, stored on the raised neighbor rather than source.
    expect(placePiece([1, 26, 0], 1, 'wall', 'wood', 2)).toBe(true);
    expect(isFaunaStructureRouteBlocked(0, 25, 0, 1, 26, 0)).toBe(true);

    resetStructures();
    // A tall animal must also see an upper-level boundary during the climb.
    expect(placePiece([0, 27, 0], 0, 'wall', 'wood', 2)).toBe(true);
    expect(isFaunaStructureRouteBlocked(0, 25, 0, 1, 26, 0, 2)).toBe(true);
  });

  it('uses the rendered tree placement and harvest state as live occupancy', () => {
    const profile = buildFaunaProfile(TERRAIN_SEED);
    let treeCoord: [number, number, number] | null = null;
    let clearNeighbor: [number, number, number] | null = null;
    const voxel = { material: MaterialType.GRASS };
    for (let z = -20; z <= 20 && !treeCoord; z++) {
      for (let x = -20; x < 20 && !treeCoord; x++) {
        const treeHere = shouldPlaceTreeAtVoxel(voxel, x, 25, z, 1, TERRAIN_SEED, profile.artDirection);
        const treeNext = shouldPlaceTreeAtVoxel(voxel, x + 1, 25, z, 1, TERRAIN_SEED, profile.artDirection);
        if (treeHere && !treeNext) {
          treeCoord = [x, 25, z];
          clearNeighbor = [x + 1, 25, z];
        }
      }
    }
    expect(treeCoord).not.toBeNull();
    expect(clearNeighbor).not.toBeNull();
    const coord = treeCoord!;
    const neighbor = clearNeighbor!;
    voxelSystem.addVoxel(coord[0], coord[1], coord[2], MaterialType.GRASS, grassColor);
    voxelSystem.addVoxel(neighbor[0], neighbor[1], neighbor[2], MaterialType.GRASS, grassColor);
    const obstacles = createLiveFaunaNavigationObstacles({
      terrainSeed: TERRAIN_SEED,
      treeDensity: 1,
      artDirection: profile.artDirection
    });

    const beforeRevision = obstacles.revision?.();
    expect(obstacles.isAnchorBlocked('grazer', ...coord)).toBe(true);
    expect(obstacles.isAnchorBlocked('grazer', ...neighbor)).toBe(true);
    expect(obstacles.isAnchorBlocked('woolly', ...neighbor)).toBe(true);
    expect(obstacles.isAnchorBlocked('runner', ...neighbor)).toBe(false);
    markTreeHarvested(...coord);
    expect(obstacles.revision?.()).not.toBe(beforeRevision);
    expect(obstacles.isAnchorBlocked('grazer', ...coord)).toBe(false);
    expect(obstacles.isAnchorBlocked('grazer', ...neighbor)).toBe(false);
    expect(unmarkTreeHarvested(...coord)).toBe(true);
    expect(obstacles.isAnchorBlocked('grazer', ...coord)).toBe(true);

    const noTrees = createLiveFaunaNavigationObstacles({
      terrainSeed: TERRAIN_SEED,
      treeDensity: 0,
      artDirection: profile.artDirection
    });
    expect(noTrees.isAnchorBlocked('grazer', ...coord)).toBe(false);
  });

  it('rejects malformed diagonal or multi-cell routes', () => {
    expect(isFaunaStructureRouteBlocked(0, 25, 0, 2, 25, 0)).toBe(true);
    expect(isFaunaStructureRouteBlocked(0, 25, 0, 1, 25, 1)).toBe(true);
  });
});
